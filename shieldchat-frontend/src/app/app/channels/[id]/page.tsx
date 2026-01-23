"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useShieldChat, Channel, Member } from "@/hooks/useShieldChat";
import { useMessages, ChatMessage } from "@/hooks/useMessages";
import { useHelius } from "@/hooks/useHelius";
import { usePayments } from "@/hooks/usePayments";
import { usePresence } from "@/hooks/usePresence";
import { HeliusMessage } from "@/lib/helius";
import { parseChannelType } from "@/lib/anchor";
import { PaymentModal } from "@/components/PaymentModal";
import { TypingIndicator } from "@/components/TypingIndicator";
import { OnlineStatus } from "@/components/OnlineStatus";
import { ReadReceipt } from "@/components/ReadReceipt";
import {
  PaymentAttachment,
  formatAmount,
  getSolscanUrl,
} from "@/lib/shadowwire";
import { WalletAddress } from "@/components/WalletAddress";
import { InviteModal } from "@/components/InviteModal";
import { LeaveChannelModal } from "@/components/LeaveChannelModal";
import { useInvites } from "@/hooks/useInvites";
import { useVoting } from "@/hooks/useVoting";
import { CreatePollModal, PollCard } from "@/components/Poll";
import { useRouter } from "next/navigation";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

export default function ChannelPage() {
  const params = useParams();
  const router = useRouter();
  const channelId = params.id as string;

  // Track current channel to prevent stale data
  const currentChannelIdRef = useRef<string | null>(null);

  const {
    fetchChannel,
    checkMembership,
    joinChannel,
    leaveChannel,
    logMessage,
    loading,
    error,
    publicKey,
  } = useShieldChat();

  // Parse channel PDA for useMessages hook
  const channelPda = channelId ? (() => {
    try {
      return new PublicKey(channelId);
    } catch {
      return null;
    }
  })() : null;

  const {
    messages,
    loading: messagesLoading,
    fetchChannelMessages,
    addLocalMessage,
    addMessageFromHelius,
    startPolling,
    stopPolling,
  } = useMessages(channelPda);

  // Helius real-time monitoring - callback for when new messages are detected
  // Uses direct extraction from Helius payload for faster message display
  const handleNewMessage = useCallback(async (heliusMessage: HeliusMessage) => {
    // Try to extract and display message directly from Helius payload
    const added = await addMessageFromHelius(
      heliusMessage.instructionData,
      heliusMessage.sender,
      heliusMessage.signature,
      heliusMessage.timestamp
    );

    if (!added) {
      // Fallback to full refresh if direct extraction failed
      fetchChannelMessages(true);
    }
  }, [addMessageFromHelius, fetchChannelMessages]);

  const {
    connected: heliusConnected,
    isAvailable: heliusAvailable,
  } = useHelius({
    channelPda,
    onNewMessage: handleNewMessage,
    enabled: true,
  });

  const [channel, setChannel] = useState<Channel | null>(null);
  const [membership, setMembership] = useState<Member | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [joining, setJoining] = useState(false);
  const hasFetchedMessages = useRef(false);

  // Track which messages have been marked as read to prevent duplicate calls
  const markedAsReadRef = useRef<Set<string>>(new Set());

  // Payment state
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Invite state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const { canCreateInvite } = useInvites();

  // Leave channel state
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const {
    pendingPayment,
    setPendingPayment,
    executePayment,
    loading: paymentLoading,
    error: paymentError,
  } = usePayments();

  // Presence state (MagicBlock Private Ephemeral Rollups)
  const {
    typingUsers,
    onlineUsers,
    readReceipts,
    setTyping,
    markAsRead,
    isUserOnline,
  } = usePresence(channelPda);

  // Voting state (Inco Lightning anonymous voting)
  // Pass logMessage to allow poll results to be logged on-chain after reveal
  const {
    polls,
    loading: pollsLoading,
    createPoll,
    castVote,
    revealResults,
    hasVoted,
    isPollActive,
    canReveal,
    fetchPolls,
  } = useVoting(channelId, logMessage);

  const [showPollModal, setShowPollModal] = useState(false);
  const [pollsExpanded, setPollsExpanded] = useState(false);

  // Merge revealed polls into messages as poll result cards
  const allMessages = useMemo(() => {
    // Create poll result messages from revealed polls
    const pollMessages: ChatMessage[] = polls
      .filter(p => p.account.revealed)
      .map(poll => ({
        id: `poll-result-${poll.pda.toString()}`,
        content: '', // Poll results don't have text content
        sender: poll.account.creator.toString(),
        timestamp: new Date(poll.account.endTime.toNumber() * 1000).toISOString(),
        pollResult: {
          pollId: poll.pda.toString(),
          question: poll.account.question,
          options: poll.account.options
            .slice(0, poll.account.optionsCount)
            .map((opt, i) => ({
              text: opt,
              votes: Number(poll.account.revealedCounts[i]),
            })),
          totalVotes: Number(poll.account.totalVotes),
          creator: poll.account.creator.toString(),
          revealedAt: new Date(poll.account.endTime.toNumber() * 1000).toISOString(),
        },
      }));

    // Merge with regular messages and sort by timestamp
    const merged = [...messages, ...pollMessages].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return merged;
  }, [messages, polls]);

  // Reset all state when channel changes
  useEffect(() => {
    currentChannelIdRef.current = channelId;
    setChannel(null);
    setMembership(null);
    setNewMessage("");
    setSending(false);
    setJoining(false);
    setShowPaymentModal(false);
    setShowInviteModal(false);
    setShowLeaveModal(false);
    setShowPollModal(false);
    setPollsExpanded(false);
    setPendingPayment(null);
    hasFetchedMessages.current = false;
    markedAsReadRef.current = new Set(); // Clear read tracking for new channel
  }, [channelId]);

  // Load channel data after reset
  useEffect(() => {
    if (channelId) {
      loadChannelData();
    }
  }, [channelId]);

  // Load messages once when channel is ready
  useEffect(() => {
    if (channelId && channelPda && !hasFetchedMessages.current) {
      hasFetchedMessages.current = true;
      fetchChannelMessages();
    }
  }, [channelId, channelPda, fetchChannelMessages]);

  // Start/stop polling based on Helius connection status
  // If Helius is connected, we don't need fast polling (rely on WebSocket)
  // If Helius is not available, use 3-second polling as fallback
  useEffect(() => {
    if (!channelId || !channelPda) {
      stopPolling();
      return;
    }

    if (heliusConnected) {
      // Helius connected - stop fast polling, use WebSocket for real-time updates
      stopPolling();
    } else {
      // No Helius - use fast polling (3s)
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [channelId, channelPda, heliusConnected, startPolling, stopPolling]);

  const loadChannelData = async () => {
    const loadingChannelId = channelId; // Capture current channelId
    try {
      const pda = new PublicKey(loadingChannelId);
      const channelData = await fetchChannel(pda);

      // Check if channel changed during fetch
      if (currentChannelIdRef.current !== loadingChannelId) {
        console.log("[ChannelPage] Channel changed during load, aborting");
        return;
      }

      setChannel(channelData);

      if (channelData) {
        const memberData = await checkMembership(pda);

        // Check again after membership fetch
        if (currentChannelIdRef.current !== loadingChannelId) {
          console.log("[ChannelPage] Channel changed during membership check, aborting");
          return;
        }

        setMembership(memberData);
      }
    } catch (err) {
      console.error("Failed to load channel:", err);
    }
  };

  const handleJoin = async () => {
    if (!channel || !publicKey) return;

    setJoining(true);
    try {
      // For token-gated channels, get user's token account for staking
      let userTokenAccount: PublicKey | undefined;
      const tokenMint = channel.account.requiredTokenMint;

      if (tokenMint) {
        userTokenAccount = getAssociatedTokenAddressSync(tokenMint, publicKey);
      }

      await joinChannel(channel.publicKey, userTokenAccount);

      // Wait a bit for the blockchain state to update
      await new Promise(resolve => setTimeout(resolve, 2000));

      await loadChannelData();
    } catch (err) {
      console.error("Failed to join channel:", err);
      alert(`Failed to join: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!channel || !publicKey) return;

    setLeaving(true);
    try {
      // For token-gated channels, get user's token account for unstaking
      let userTokenAccount: PublicKey | undefined;
      const tokenMint = channel.account.requiredTokenMint;

      if (tokenMint) {
        userTokenAccount = getAssociatedTokenAddressSync(tokenMint, publicKey);
      }

      await leaveChannel(channel.publicKey, userTokenAccount);

      // Close modal and redirect to channels list
      setShowLeaveModal(false);
      router.push("/app");
    } catch (err) {
      console.error("Failed to leave channel:", err);
      alert(`Failed to leave: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLeaving(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channel || !newMessage.trim() || !publicKey) return;

    setSending(true);
    try {
      // Execute payment if attached
      let paymentData: PaymentAttachment | undefined;
      if (pendingPayment) {
        const result = await executePayment();
        if (result) {
          paymentData = result;
        } else {
          // Payment failed, don't send message
          setSending(false);
          return;
        }
      }

      // Add message locally for immediate feedback and get the CID
      const cid = await addLocalMessage(
        newMessage.trim(),
        publicKey.toString(),
        channelId,
        paymentData
      );

      // Log message on-chain with the IPFS CID
      await logMessage(channel.publicKey, newMessage.trim(), cid);

      setNewMessage("");
      setTyping(false); // Clear typing indicator immediately
      setPendingPayment(null); // Clear payment after sending
      await loadChannelData(); // Refresh message count

      // Refresh messages from chain after a delay
      setTimeout(() => {
        fetchChannelMessages();
      }, 3000);
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  if (loading && !channel) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <div className="text-gray-400">Loading channel...</div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <h2 className="text-xl font-bold mb-2">Channel Not Found</h2>
          <p className="text-gray-400">
            This channel doesn&apos;t exist or has been deleted.
          </p>
        </div>
      </div>
    );
  }

  const channelName = new TextDecoder().decode(
    new Uint8Array(channel.account.encryptedMetadata)
  );
  const channelType = parseChannelType(channel.account.channelType);
  const isOwner = publicKey?.equals(channel.account.owner);
  const isMember = membership?.account.isActive;
  // Owner is treated as implicit member - can access without explicit Member account
  const canAccess = isOwner || isMember;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-900">
      {/* Channel Header */}
      <div className="bg-gray-800/50 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <span className="text-lg">#</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">
                {channelName || "Unnamed Channel"}
              </h1>
              <div className="flex items-center space-x-2 text-sm text-gray-400">
                <span>{channelType}</span>
                {/* Only show stats to members - hide for non-members of private/token-gated channels */}
                {canAccess ? (
                  <>
                    <span>•</span>
                    <span>{channel.account.memberCount} members</span>
                    {onlineUsers.length > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-green-400 flex items-center">
                          <span className="w-2 h-2 bg-green-400 rounded-full mr-1"></span>
                          {onlineUsers.length} online
                        </span>
                      </>
                    )}
                    <span>•</span>
                    <span>{channel.account.messageCount.toString()} messages</span>
                  </>
                ) : (
                  <>
                    <span>•</span>
                    <span className="text-gray-500">Join to see activity</span>
                  </>
                )}
                {isOwner && (
                  <>
                    <span>•</span>
                    <span className="text-purple-400">Owner</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Channel Actions */}
          <div className="flex items-center space-x-2">
            {canAccess && (
              <>
                <button
                  onClick={() => setShowPollModal(true)}
                  className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg text-sm transition-colors flex items-center gap-2"
                  title="Create Poll"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Poll
                </button>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg text-sm transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Invite
                </button>
                <button
                  onClick={() => fetchChannelMessages()}
                  disabled={messagesLoading}
                  className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {messagesLoading ? "Loading..." : "Refresh"}
                </button>
                {isMember && !isOwner && (
                  <button
                    onClick={() => setShowLeaveModal(true)}
                    className="bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 py-2 px-4 rounded-lg text-sm transition-colors flex items-center gap-2 border border-red-600/30"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Leave
                  </button>
                )}
              </>
            )}
            {!canAccess && (
              <button
                onClick={handleJoin}
                disabled={joining}
                className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {joining ? "Joining..." : "Join Channel"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Active Polls Section - Collapsible */}
      {canAccess && polls.length > 0 && (
        <div className="bg-gray-800/30 border-b border-gray-700">
          <button
            onClick={() => setPollsExpanded(!pollsExpanded)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-700/30 transition-colors"
          >
            <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Active Polls ({polls.filter(p => isPollActive(p.account)).length})
            </h3>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${pollsExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {pollsExpanded && (
            <div className="px-4 pb-4 space-y-3 max-h-80 overflow-y-auto">
              {polls.map((poll) => (
                <PollCard
                  key={poll.pda.toString()}
                  poll={poll.account}
                  pollPda={poll.pda}
                  hasVoted={hasVoted(poll.pda)}
                  isActive={isPollActive(poll.account)}
                  canReveal={canReveal(poll.account)}
                  onVote={(optionIndex) => castVote(poll.pda, optionIndex)}
                  onReveal={() => revealResults(poll.pda)}
                  loading={pollsLoading}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4 flex flex-col-reverse">
        {!canAccess ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="text-4xl mb-4">{channel?.account.requiredTokenMint ? "🎫" : "🔒"}</div>
              <h2 className="text-xl font-bold mb-2">Join to View Messages</h2>
              <p className="text-gray-400 mb-4">
                You need to join this channel to see messages and participate.
              </p>

              {/* Token Staking Info for Token-Gated Channels */}
              {channel?.account.requiredTokenMint && channel?.account.minTokenAmount && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4 text-left">
                  <div className="flex items-center gap-2 text-yellow-300 font-medium mb-2">
                    <span>🔒</span>
                    <span>Token Staking Required</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">
                    Tokens will be locked while you are a member. They are returned when you leave.
                  </p>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between text-gray-400">
                      <span>Token:</span>
                      <span className="text-gray-300 font-mono text-xs">
                        {channel.account.requiredTokenMint.toString().slice(0, 4)}...{channel.account.requiredTokenMint.toString().slice(-4)}
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Stake amount:</span>
                      <span className="text-gray-300">{channel.account.minTokenAmount.toString()}</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleJoin}
                disabled={joining}
                className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
              >
                {joining ? "Joining..." : channel?.account.requiredTokenMint ? "Stake & Join" : "Join Channel"}
              </button>
            </div>
          </div>
        ) : messagesLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">Loading messages...</div>
          </div>
        ) : allMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <div className="text-4xl mb-4">💬</div>
              <p>No messages yet. Start the conversation!</p>
            </div>
          </div>
        ) : (
          [...allMessages].reverse().map((message, index) => {
            const messageKey = message.id;
            return (
              <MessageBubble
                key={messageKey}
                message={message}
                isUserOnline={isUserOnline}
                isOwnMessage={message.sender === publicKey?.toString()}
                isRead={readReceipts.get(message.sender) !== undefined}
                onVisible={() => {
                  // Only mark as read once per message to prevent infinite loops
                  if (!markedAsReadRef.current.has(messageKey)) {
                    markedAsReadRef.current.add(messageKey);
                    markAsRead(index + 1);
                  }
                }}
              />
            );
          })
        )}
      </div>

      {/* Message Input */}
      {canAccess && (
        <div className="bg-gray-800/50 border-t border-gray-700 p-4">
          {isMember ? (
            <>
              {/* Typing Indicator */}
              {typingUsers.length > 0 && (
                <div className="mb-2">
                  <TypingIndicator users={typingUsers} />
                </div>
              )}

              {/* Pending Payment Preview */}
              {pendingPayment && (
                <div className="mb-3 bg-purple-900/30 border border-purple-500/50 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-purple-400">💰</span>
                    <span className="text-sm">
                      Sending {formatAmount(pendingPayment.amount, pendingPayment.token)}{" "}
                      {pendingPayment.token} to {pendingPayment.recipient.slice(0, 8)}...
                    </span>
                    <span className="text-xs text-gray-500">
                      ({pendingPayment.type})
                    </span>
                  </div>
                  <button
                    onClick={() => setPendingPayment(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex space-x-2">
                {/* Attach Payment Button */}
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(true)}
                  disabled={sending || paymentLoading}
                  className={`px-3 rounded-lg transition-colors ${
                    pendingPayment
                      ? "bg-purple-600 text-white"
                      : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                  }`}
                  title="Attach payment"
                >
                  💰
                </button>

                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    // Trigger typing indicator
                    setTyping(e.target.value.length > 0);
                  }}
                  onBlur={() => setTyping(false)}
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                  disabled={sending || paymentLoading}
                />
                <button
                  type="submit"
                  disabled={sending || paymentLoading || !newMessage.trim()}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending || paymentLoading ? "..." : "Send"}
                </button>
              </form>

              {(error || paymentError) && (
                <div className="mt-2 text-sm text-red-400">{error || paymentError}</div>
              )}

              <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <p>Messages are encrypted with Arcium and stored on IPFS.</p>
                <div className="flex items-center space-x-4">
                  {/* Presence Status */}
                  <span className="flex items-center text-green-400">
                    <span className="w-2 h-2 rounded-full mr-1 bg-green-400"></span>
                    Presence Active
                  </span>
                  {/* Helius Status */}
                  {heliusAvailable ? (
                    <span className={`flex items-center ${heliusConnected ? 'text-green-400' : 'text-yellow-400'}`}>
                      <span className={`w-2 h-2 rounded-full mr-1 ${heliusConnected ? 'bg-green-400' : 'bg-yellow-400'}`}></span>
                      {heliusConnected ? 'Real-time' : 'Connecting...'}
                    </span>
                  ) : (
                    <span className="flex items-center text-gray-500">
                      <span className="w-2 h-2 rounded-full mr-1 bg-gray-500"></span>
                      Polling
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-2">
              <p className="text-gray-400 mb-3">
                Join the channel to send messages
              </p>
              <button
                onClick={handleJoin}
                disabled={joining}
                className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
              >
                {joining ? "Joining..." : "Join to Send Messages"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onConfirm={(payment) => {
          setPendingPayment(payment);
          setShowPaymentModal(false);
        }}
      />

      {/* Invite Modal */}
      {channel && (
        <InviteModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          channelPda={channelId}
          channel={channel.account}
          isOwner={isOwner || false}
        />
      )}

      {/* Leave Channel Modal */}
      <LeaveChannelModal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        onConfirm={handleLeave}
        loading={leaving}
        channelName={channelName || "this channel"}
        isTokenGated={!!channel?.account.requiredTokenMint}
        stakedAmount={channel?.account.minTokenAmount?.toString()}
      />

      {/* Create Poll Modal */}
      <CreatePollModal
        isOpen={showPollModal}
        onClose={() => setShowPollModal(false)}
        onCreatePoll={createPoll}
        loading={pollsLoading}
      />
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  isUserOnline: (wallet: string) => boolean;
  isOwnMessage: boolean;
  isRead: boolean;
  onVisible: () => void;
}

function MessageBubble({
  message,
  isUserOnline,
  isOwnMessage,
  isRead,
  onVisible,
}: MessageBubbleProps) {
  const timestamp = new Date(message.timestamp);
  const senderOnline = isUserOnline(message.sender);

  // Mark as read when message becomes visible (run once on mount)
  useEffect(() => {
    onVisible();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once when mounted to prevent infinite loop

  return (
    <div className={`flex items-end ${isOwnMessage ? 'flex-row-reverse' : ''} gap-3`}>
      {/* Avatar - only show for other users */}
      {!isOwnMessage && (
        <div className="relative flex-shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-sm">
            {message.sender[0]}
          </div>
          {/* Online status indicator */}
          <div className="absolute -bottom-0.5 -right-0.5">
            <OnlineStatus isOnline={senderOnline} size="sm" pulse={false} />
          </div>
        </div>
      )}
      <div className={`max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`flex items-baseline gap-2 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
          {!isOwnMessage && (
            <span className="font-medium text-sm">
              <WalletAddress address={message.sender} />
            </span>
          )}
          <span className="text-xs text-gray-500">
            {timestamp.toLocaleTimeString()}
          </span>
          {/* Read receipt for own messages */}
          {isOwnMessage && (
            <ReadReceipt sent={true} delivered={true} read={isRead} />
          )}
        </div>
        <div className={`mt-1 px-4 py-2 rounded-2xl ${
          isOwnMessage
            ? 'bg-purple-600 text-white rounded-br-md'
            : 'bg-gray-700 text-gray-300 rounded-bl-md'
        }`}>
          <p className="break-words">{message.content}</p>
        </div>

        {/* Payment Attachment Display */}
        {message.payment && (
          <div className={`mt-2 bg-purple-900/30 border border-purple-500/50 rounded-lg p-3 max-w-full`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-purple-400">💰</span>
                <span className="text-sm font-medium">
                  Private Payment
                </span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded ${
                message.payment.status === "completed"
                  ? "bg-green-500/20 text-green-400"
                  : message.payment.status === "pending"
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-red-500/20 text-red-400"
              }`}>
                {message.payment.status}
              </span>
            </div>
            <div className="mt-2 text-sm">
              <span className="text-gray-400">
                {formatAmount(message.payment.amount, message.payment.token)}{" "}
                {message.payment.token}
              </span>
              <span className="text-gray-500 mx-2">→</span>
              <span className="text-gray-400 font-mono">
                <WalletAddress address={message.payment.recipient} />
              </span>
            </div>
            {message.payment.txSignature && (
              <a
                href={getSolscanUrl(message.payment.txSignature)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs text-purple-400 hover:text-purple-300"
              >
                View Transaction ↗
              </a>
            )}
          </div>
        )}

        {/* Poll Result Card */}
        {message.pollResult && (
          <div className="mt-2 bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-lg p-4 max-w-md w-full">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-sm font-medium text-purple-300">Poll Results</span>
            </div>
            <h4 className="font-semibold text-white mb-3">{message.pollResult.question}</h4>
            <div className="space-y-2">
              {message.pollResult.options.map((option, idx) => {
                const percentage = message.pollResult!.totalVotes > 0
                  ? (option.votes / message.pollResult!.totalVotes) * 100
                  : 0;
                const isWinner = message.pollResult!.options.every(o => o.votes <= option.votes) && option.votes > 0;

                return (
                  <div key={idx} className="relative">
                    <div
                      className={`absolute inset-0 rounded ${isWinner ? 'bg-purple-600/40' : 'bg-gray-700/40'}`}
                      style={{ width: `${percentage}%` }}
                    />
                    <div className="relative flex justify-between p-2">
                      <span className={`text-sm ${isWinner ? 'text-white font-medium' : 'text-gray-300'}`}>
                        {option.text}
                      </span>
                      <span className={`text-sm ${isWinner ? 'text-purple-300' : 'text-gray-400'}`}>
                        {option.votes} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-gray-400">
              {message.pollResult.totalVotes} total vote{message.pollResult.totalVotes !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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

export default function ChannelPage() {
  const params = useParams();
  const channelId = params.id as string;

  const {
    fetchChannel,
    checkMembership,
    joinChannel,
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
    console.log("[Channel] Helius detected new message, extracting directly...");

    // Try to extract and display message directly from Helius payload
    const added = await addMessageFromHelius(
      heliusMessage.instructionData,
      heliusMessage.sender,
      heliusMessage.signature,
      heliusMessage.timestamp
    );

    if (!added) {
      // Fallback to full refresh if direct extraction failed
      console.log("[Channel] Direct extraction failed, falling back to refresh");
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

  // Payment state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
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

  // Load channel data
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
      // Optional: Could keep slow polling (30s) as backup
      // console.log("[Channel] Helius connected, stopping fast polling");
      stopPolling();
    } else {
      // No Helius - use fast polling (3s)
      console.log("[Channel] No Helius connection, using 3s polling");
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [channelId, channelPda, heliusConnected, startPolling, stopPolling]);

  // Reset fetch flag when channel changes
  useEffect(() => {
    hasFetchedMessages.current = false;
  }, [channelId]);

  const loadChannelData = async () => {
    try {
      const pda = new PublicKey(channelId);
      const channelData = await fetchChannel(pda);
      setChannel(channelData);

      if (channelData) {
        const memberData = await checkMembership(pda);
        setMembership(memberData);
      }
    } catch (err) {
      console.error("Failed to load channel:", err);
    }
  };

  const handleJoin = async () => {
    if (!channel) return;

    setJoining(true);
    try {
      const result = await joinChannel(channel.publicKey);
      console.log("Join successful:", result);

      // Wait a bit for the blockchain state to update
      await new Promise(resolve => setTimeout(resolve, 2000));

      await loadChannelData();

      // Presence is handled via WebSocket server (no on-chain presence needed)
      console.log("[Channel] ✅ Joined channel, presence will sync via WebSocket");
    } catch (err) {
      console.error("Failed to join channel:", err);
      alert(`Failed to join: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setJoining(false);
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
        console.log("[Channel] Executing attached payment...");
        const result = await executePayment();
        if (result) {
          paymentData = result;
          console.log("[Channel] Payment successful:", result.txSignature);
        } else {
          // Payment failed, don't send message
          console.error("[Channel] Payment failed, aborting message");
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
    <div className="flex-1 flex flex-col bg-gray-900">
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
              <button
                onClick={() => fetchChannelMessages()}
                disabled={messagesLoading}
                className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {messagesLoading ? "Loading..." : "Refresh"}
              </button>
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

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!canAccess ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-4xl mb-4">🔒</div>
              <h2 className="text-xl font-bold mb-2">Join to View Messages</h2>
              <p className="text-gray-400 mb-4">
                You need to join this channel to see messages and participate.
              </p>
              <button
                onClick={handleJoin}
                disabled={joining}
                className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
              >
                {joining ? "Joining..." : "Join Channel"}
              </button>
            </div>
          </div>
        ) : messagesLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <div className="text-4xl mb-4">💬</div>
              <p>No messages yet. Start the conversation!</p>
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              isUserOnline={isUserOnline}
              isOwnMessage={message.sender === publicKey?.toString()}
              isRead={readReceipts.get(message.sender) !== undefined}
              onVisible={() => markAsRead(index + 1)}
            />
          ))
        )}

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <TypingIndicator users={typingUsers} />
        )}
      </div>

      {/* Message Input */}
      {canAccess && (
        <div className="bg-gray-800/50 border-t border-gray-700 p-4">
          {isMember ? (
            <>
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

  // Mark as read when message becomes visible
  useEffect(() => {
    onVisible();
  }, [onVisible]);

  return (
    <div className="flex items-start space-x-3">
      <div className="relative">
        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-sm">
          {message.sender[0]}
        </div>
        {/* Online status indicator */}
        <div className="absolute -bottom-0.5 -right-0.5">
          <OnlineStatus isOnline={senderOnline} size="sm" pulse={false} />
        </div>
      </div>
      <div className="flex-1">
        <div className="flex items-baseline space-x-2">
          <span className="font-medium">
            <WalletAddress address={message.sender} />
          </span>
          <span className="text-xs text-gray-500">
            {timestamp.toLocaleTimeString()}
          </span>
          {/* Read receipt for own messages */}
          {isOwnMessage && (
            <ReadReceipt sent={true} delivered={true} read={isRead} />
          )}
        </div>
        <p className="text-gray-300 mt-1">{message.content}</p>

        {/* Payment Attachment Display */}
        {message.payment && (
          <div className="mt-2 bg-purple-900/30 border border-purple-500/50 rounded-lg p-3">
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
      </div>
    </div>
  );
}

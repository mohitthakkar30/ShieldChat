"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useShieldChat, Channel, Member } from "@/hooks/useShieldChat";
import { useMessages, ChatMessage } from "@/hooks/useMessages";
import { useHelius } from "@/hooks/useHelius";
import { usePayments } from "@/hooks/usePayments";
import { usePresence } from "@/hooks/usePresence";
import { HeliusMessage } from "@/lib/helius";
import { parseChannelType } from "@/lib/anchor";
import { PaymentModal } from "@/components/PaymentModal";
import { PaymentAttachment } from "@/lib/shadowwire";
import { InviteModal } from "@/components/InviteModal";
import { LeaveChannelModal } from "@/components/LeaveChannelModal";
import { useVoting } from "@/hooks/useVoting";
import { CreatePollModal } from "@/components/Poll";
import { GamesModal } from "@/components/Games";
import { useGames, TicTacToeGame } from "@/hooks/useGames";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { ShimmerSkeleton } from "@/components/ui";
import { useNotify } from "@/contexts/NotificationContext";

// Glass morphism channel components
import {
  ChannelHeader,
  MessagesArea,
  MessageInput,
  PollsPanel,
} from "@/components/channel";

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
    connecting,
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

  // Notifications
  const { notifyMessage } = useNotify();

  // Helius real-time monitoring
  const handleNewMessage = useCallback(async (heliusMessage: HeliusMessage) => {
    const added = await addMessageFromHelius(
      heliusMessage.instructionData,
      heliusMessage.sender,
      heliusMessage.signature,
      heliusMessage.timestamp
    );

    if (!added) {
      fetchChannelMessages(true);
    }

    // Show notification for messages from others (not from self)
    if (added && heliusMessage.sender !== publicKey?.toString()) {
      notifyMessage("ShieldChat");
    }
  }, [addMessageFromHelius, fetchChannelMessages, publicKey, notifyMessage]);

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
  const [membershipChecked, setMembershipChecked] = useState(false); // Track if membership check completed
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [joining, setJoining] = useState(false);
  const hasFetchedMessages = useRef(false);

  // Track which messages have been marked as read
  const markedAsReadRef = useRef<Set<string>>(new Set());

  // Modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [showGamesModal, setShowGamesModal] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [selectedGameFromMessage, setSelectedGameFromMessage] = useState<TicTacToeGame | null>(null);

  const {
    pendingPayment,
    setPendingPayment,
    executePayment,
    loading: paymentLoading,
    error: paymentError,
  } = usePayments();

  // Presence state
  const {
    typingUsers,
    onlineUsers,
    readReceipts,
    setTyping,
    markAsRead,
    isUserOnline,
  } = usePresence(channelPda);

  // Voting state
  const {
    polls,
    loading: pollsLoading,
    createPoll,
    castVote,
    revealResults,
    hasVoted,
    isPollActive,
    canReveal,
  } = useVoting(channelId, logMessage);

  // Games hook
  const { ticTacToeGames, refreshGames, fetchSingleTTTGame } = useGames(channelPda);

  // Merge revealed polls into messages as poll result cards
  const allMessages = useMemo(() => {
    const pollMessages: ChatMessage[] = polls
      .filter(p => p.account.revealed)
      .map(poll => ({
        id: `poll-result-${poll.pda.toString()}`,
        content: '',
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

    return [...messages, ...pollMessages].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [messages, polls]);

  // Reset all state when channel changes
  useEffect(() => {
    currentChannelIdRef.current = channelId;
    setChannel(null);
    setMembership(null);
    setMembershipChecked(false); // Reset membership check status
    setNewMessage("");
    setSending(false);
    setJoining(false);
    setShowPaymentModal(false);
    setShowInviteModal(false);
    setShowLeaveModal(false);
    setShowPollModal(false);
    setShowGamesModal(false);
    setPendingPayment(null);
    hasFetchedMessages.current = false;
    markedAsReadRef.current = new Set();
  }, [channelId, setPendingPayment]);

  // Load channel data
  useEffect(() => {
    if (channelId && !connecting) {
      loadChannelData();
    }
  }, [channelId, connecting]);

  // Load messages once when channel is ready
  useEffect(() => {
    if (channelId && channelPda && !hasFetchedMessages.current) {
      hasFetchedMessages.current = true;
      fetchChannelMessages();
    }
  }, [channelId, channelPda, fetchChannelMessages]);

  // Start/stop polling based on Helius connection
  useEffect(() => {
    if (!channelId || !channelPda) {
      stopPolling();
      return;
    }

    if (heliusConnected) {
      stopPolling();
    } else {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [channelId, channelPda, heliusConnected, startPolling, stopPolling]);

  const loadChannelData = async () => {
    const loadingChannelId = channelId;
    try {
      const pda = new PublicKey(loadingChannelId);

      // Fetch channel and membership in PARALLEL for faster loading
      const [channelData, memberData] = await Promise.all([
        fetchChannel(pda),
        checkMembership(pda),
      ]);

      // Check if channel changed during fetch
      if (currentChannelIdRef.current !== loadingChannelId) return;

      setChannel(channelData);
      setMembership(memberData);
      setMembershipChecked(true); // Mark membership check as complete
    } catch (err) {
      console.error("Failed to load channel:", err);
      setMembershipChecked(true); // Mark as checked even on error to avoid infinite loading
    }
  };

  const handleJoin = async () => {
    if (!channel || !publicKey) return;

    setJoining(true);
    try {
      let userTokenAccount: PublicKey | undefined;
      const tokenMint = channel.account.requiredTokenMint;

      if (tokenMint) {
        userTokenAccount = getAssociatedTokenAddressSync(tokenMint, publicKey);
      }

      await joinChannel(channel.publicKey, userTokenAccount);
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
      let userTokenAccount: PublicKey | undefined;
      const tokenMint = channel.account.requiredTokenMint;

      if (tokenMint) {
        userTokenAccount = getAssociatedTokenAddressSync(tokenMint, publicKey);
      }

      await leaveChannel(channel.publicKey, userTokenAccount);
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
      let paymentData: PaymentAttachment | undefined;
      if (pendingPayment) {
        const result = await executePayment();
        if (result) {
          paymentData = result;
        } else {
          setSending(false);
          return;
        }
      }

      const cid = await addLocalMessage(
        newMessage.trim(),
        publicKey.toString(),
        channelId,
        paymentData
      );

      await logMessage(channel.publicKey, newMessage.trim(), cid);

      setNewMessage("");
      setTyping(false);
      setPendingPayment(null);
      await loadChannelData();

      setTimeout(() => {
        fetchChannelMessages();
      }, 3000);
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleGameMessageClick = useCallback(async (gameId: string) => {
    // Always fetch fresh game data to avoid stale state issues
    try {
      const gamePda = new PublicKey(gameId);
      const freshGame = await fetchSingleTTTGame(gamePda);
      if (freshGame) {
        setSelectedGameFromMessage(freshGame);
      }
    } catch (err) {
      console.error("Failed to fetch game:", err);
    }
    setShowGamesModal(true);
  }, [fetchSingleTTTGame]);

  // Loading states
  if (connecting) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center animate-float-up">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/30 flex items-center justify-center">
            <svg className="w-6 h-6 text-violet-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-gray-400">Connecting wallet...</p>
        </div>
      </div>
    );
  }

  if (loading && !channel) {
    return (
      <div className="flex-1 flex flex-col">
        {/* Header skeleton */}
        <div className="glass-dark border-b border-white/[0.06] p-4">
          <div className="flex items-center space-x-3">
            <ShimmerSkeleton className="w-12 h-12 rounded-xl" />
            <div className="space-y-2">
              <ShimmerSkeleton className="h-6 w-48" />
              <ShimmerSkeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
        {/* Messages skeleton */}
        <div className="flex-1 p-4 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? '' : 'justify-end'}`}>
              <div className={`flex gap-3 max-w-[70%] ${i % 2 === 0 ? '' : 'flex-row-reverse'}`}>
                <ShimmerSkeleton className="w-10 h-10 rounded-full" />
                <ShimmerSkeleton className={`h-16 ${i % 2 === 0 ? 'w-64' : 'w-48'} rounded-2xl`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center animate-float-up">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 bg-red-500/20 rounded-2xl blur-lg" />
            <div className="relative w-20 h-20 bg-gradient-to-br from-red-500/20 to-pink-600/20 border border-red-500/30 rounded-2xl flex items-center justify-center">
              <span className="text-4xl">❌</span>
            </div>
          </div>
          <h2 className="text-2xl font-bold font-display mb-3 text-white">Channel Not Found</h2>
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
  const canAccess = isOwner || isMember;

  // Show content while checking membership (optimistic) to avoid flash of "Join" UI
  // Only show "Join" prompt if membership check completed AND user is not a member
  const showAsAccessible = canAccess || !membershipChecked;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Channel Header */}
      <ChannelHeader
        channelName={channelName}
        channelType={channelType}
        memberCount={channel.account.memberCount}
        messageCount={channel.account.messageCount.toString()}
        onlineCount={onlineUsers.length}
        isOwner={isOwner || false}
        canAccess={canAccess || false}
        isMember={isMember || false}
        messagesLoading={messagesLoading}
        joining={joining}
        onJoin={handleJoin}
        onRefresh={() => fetchChannelMessages()}
        onCreatePoll={() => setShowPollModal(true)}
        onOpenGames={() => setShowGamesModal(true)}
        onInvite={() => setShowInviteModal(true)}
        onLeave={() => setShowLeaveModal(true)}
      />

      {/* Polls Panel */}
      {showAsAccessible && polls.length > 0 && (
        <PollsPanel
          polls={polls}
          loading={pollsLoading}
          hasVoted={hasVoted}
          isPollActive={isPollActive}
          canReveal={canReveal}
          onVote={castVote}
          onReveal={revealResults}
        />
      )}

      {/* Messages Area */}
      <MessagesArea
        messages={allMessages}
        loading={messagesLoading}
        canAccess={showAsAccessible}
        joining={joining}
        onJoin={handleJoin}
        isUserOnline={isUserOnline}
        readReceipts={readReceipts}
        markAsRead={markAsRead}
        onGameClick={handleGameMessageClick}
        publicKey={publicKey}
        markedAsReadRef={markedAsReadRef}
        channel={channel}
        membershipChecked={membershipChecked}
      />

      {/* Message Input */}
      {showAsAccessible && (
        <MessageInput
          onSendMessage={handleSendMessage}
          message={newMessage}
          setMessage={setNewMessage}
          onTyping={setTyping}
          pendingPayment={pendingPayment}
          onClearPayment={() => setPendingPayment(null)}
          onOpenPaymentModal={() => setShowPaymentModal(true)}
          sending={sending}
          paymentLoading={paymentLoading}
          error={error || paymentError}
          typingUsers={typingUsers}
          heliusConnected={heliusConnected}
          heliusAvailable={heliusAvailable}
          isMember={isMember || false}
          joining={joining}
          onJoin={handleJoin}
        />
      )}

      {/* Modals */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onConfirm={(payment) => {
          setPendingPayment(payment);
          setShowPaymentModal(false);
        }}
      />

      {channel && (
        <InviteModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          channelPda={channelId}
          channel={channel.account}
          isOwner={isOwner || false}
        />
      )}

      <LeaveChannelModal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        onConfirm={handleLeave}
        loading={leaving}
        channelName={channelName || "this channel"}
        isTokenGated={!!channel?.account.requiredTokenMint}
        stakedAmount={channel?.account.minTokenAmount?.toString()}
        tokenMint={channel?.account.requiredTokenMint?.toString()}
      />

      <CreatePollModal
        isOpen={showPollModal}
        onClose={() => setShowPollModal(false)}
        onCreatePoll={createPoll}
        loading={pollsLoading}
      />

      {channelPda && (
        <GamesModal
          isOpen={showGamesModal}
          onClose={() => {
            setShowGamesModal(false);
            setSelectedGameFromMessage(null);
          }}
          channelPubkey={channelPda}
          initialGame={selectedGameFromMessage}
          onInitialGameHandled={() => setSelectedGameFromMessage(null)}
        />
      )}
    </div>
  );
}

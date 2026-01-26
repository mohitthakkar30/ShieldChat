"use client";

import { ChatMessage } from "@/hooks/useMessages";
import { MessageBubble } from "./MessageBubble";
import { GlassButton, ShimmerSkeleton } from "@/components/ui";
import { PublicKey } from "@solana/web3.js";

interface MessagesAreaProps {
  messages: ChatMessage[];
  loading: boolean;
  canAccess: boolean;
  joining: boolean;
  onJoin: () => void;
  isUserOnline: (wallet: string) => boolean;
  readReceipts: Map<string, number>;
  markAsRead: (index: number) => void;
  onGameClick: (gameId: string) => void;
  publicKey: PublicKey | null;
  markedAsReadRef: React.MutableRefObject<Set<string>>;
  channel: {
    account: {
      requiredTokenMint: PublicKey | null;
      minTokenAmount: bigint | null;
    };
  } | null;
  membershipChecked: boolean;
}

export function MessagesArea({
  messages,
  loading,
  canAccess,
  joining,
  onJoin,
  isUserOnline,
  readReceipts,
  markAsRead,
  onGameClick,
  publicKey,
  markedAsReadRef,
  channel,
  membershipChecked,
}: MessagesAreaProps) {
  // PRIORITY: If we have messages, show them! Don't show skeleton.
  // This prevents the skeleton flash when switching channels.
  const hasMessages = messages.length > 0;

  // Show loading skeleton ONLY if:
  // 1. Membership not checked yet AND
  // 2. We don't have any messages to display
  if (!membershipChecked && !hasMessages) {
    return (
      <div className="flex-1 p-4 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? '' : 'justify-end'}`}>
            <div className={`flex gap-3 max-w-[70%] ${i % 2 === 0 ? '' : 'flex-row-reverse'}`}>
              <ShimmerSkeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-2">
                <ShimmerSkeleton className="h-4 w-24" />
                <ShimmerSkeleton className={`h-16 ${i % 2 === 0 ? 'w-64' : 'w-48'} rounded-2xl`} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Non-member view - join prompt (only shown after membership check confirms non-member)
  // Also skip if we have messages (keep showing them)
  if (!canAccess && !hasMessages) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md animate-float-up">
          {/* Icon */}
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 bg-[color:var(--accent-primary)]/20 rounded-2xl blur-lg" />
            <div className="relative w-20 h-20 glass-accent rounded-2xl flex items-center justify-center">
              <span className="text-4xl">
                {channel?.account.requiredTokenMint ? "🎫" : "🔒"}
              </span>
            </div>
          </div>

          <h2 className="text-2xl font-bold font-display mb-3 text-white">
            Join to View Messages
          </h2>
          <p className="text-gray-400 mb-6 leading-relaxed">
            You need to join this channel to see messages and participate in the conversation.
          </p>

          {/* Token Staking Info for Token-Gated Channels */}
          {channel?.account.requiredTokenMint && channel?.account.minTokenAmount && (
            <div className="glass-card bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30 p-4 mb-6 text-left">
              <div className="flex items-center gap-2 text-amber-300 font-medium mb-3">
                <span>🔒</span>
                <span>Token Staking Required</span>
              </div>
              <p className="text-xs text-gray-400 mb-4">
                Tokens will be locked while you are a member. They are returned when you leave.
              </p>
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Token:</span>
                  <span className="text-gray-200 font-mono text-xs bg-white/[0.05] px-2 py-0.5 rounded">
                    {channel.account.requiredTokenMint.toString().slice(0, 4)}...{channel.account.requiredTokenMint.toString().slice(-4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Stake amount:</span>
                  <span className="text-white font-semibold">{channel.account.minTokenAmount.toString()}</span>
                </div>
              </div>
            </div>
          )}

          <GlassButton
            variant="primary"
            glow
            onClick={onJoin}
            disabled={joining}
            className="w-full"
          >
            {joining
              ? "Joining..."
              : channel?.account.requiredTokenMint
                ? "Stake & Join"
                : "Join Channel"
            }
          </GlassButton>
        </div>
      </div>
    );
  }

  // Loading state - ONLY show skeleton if we have NO messages to display
  // If we have messages (even stale from previous channel), show them instead of skeleton
  if (loading && !hasMessages) {
    return (
      <div className="flex-1 p-4 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? '' : 'justify-end'}`}>
            <div className={`flex gap-3 max-w-[70%] ${i % 2 === 0 ? '' : 'flex-row-reverse'}`}>
              <ShimmerSkeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-2">
                <ShimmerSkeleton className="h-4 w-24" />
                <ShimmerSkeleton className={`h-16 ${i % 2 === 0 ? 'w-64' : 'w-48'} rounded-2xl`} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center animate-float-up">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 bg-[color:var(--accent-secondary)]/20 rounded-2xl blur-lg" />
            <div className="relative w-20 h-20 bg-[linear-gradient(to_bottom_right,color-mix(in_srgb,var(--accent-secondary)_20%,transparent),color-mix(in_srgb,var(--accent-primary)_20%,transparent))] border border-[color:var(--accent-secondary)]/30 rounded-2xl flex items-center justify-center">
              <span className="text-4xl">💬</span>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No messages yet</h3>
          <p className="text-gray-400">Start the conversation!</p>
        </div>
      </div>
    );
  }

  // Messages list
  return (
    <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4 flex flex-col-reverse">
      {[...messages].reverse().map((message, index) => {
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
            onGameClick={onGameClick}
            currentUser={publicKey?.toString()}
          />
        );
      })}
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { ChatMessage } from "@/hooks/useMessages";
import { WalletAddress } from "@/components/WalletAddress";
import { OnlineStatus } from "@/components/OnlineStatus";
import { ReadReceipt } from "@/components/ReadReceipt";
import { GameMessageCard } from "@/components/Games";
import {
  PaymentAttachment,
  formatAmount,
  getSolscanUrl,
} from "@/lib/shadowwire";
import { FloatingAvatar } from "@/components/ui";

interface MessageBubbleProps {
  message: ChatMessage;
  isUserOnline: (wallet: string) => boolean;
  isOwnMessage: boolean;
  isRead: boolean;
  onVisible: () => void;
  onGameClick?: (gameId: string) => void;
  currentUser?: string;
}

export function MessageBubble({
  message,
  isUserOnline,
  isOwnMessage,
  isRead,
  onVisible,
  onGameClick,
  currentUser,
}: MessageBubbleProps) {
  const timestamp = new Date(message.timestamp);
  const senderOnline = isUserOnline(message.sender);

  // Mark as read when message becomes visible (run once on mount)
  useEffect(() => {
    onVisible();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once when mounted to prevent infinite loop

  return (
    <div className={`flex items-end ${isOwnMessage ? 'flex-row-reverse' : ''} gap-3 animate-float-up`}>
      {/* Avatar - only show for other users */}
      {!isOwnMessage && (
        <FloatingAvatar
          name={message.sender}
          size="sm"
          isOnline={senderOnline}
        />
      )}

      <div className={`max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`flex items-baseline gap-2 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
          {!isOwnMessage && (
            <span className="font-medium text-sm text-gray-300">
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

        {/* Message content bubble */}
        {message.content && (
          <div className={`mt-1 px-4 py-3 rounded-2xl backdrop-blur-sm transition-all duration-300 ${
            isOwnMessage
              ? 'message-bubble-own text-white rounded-br-md shadow-[0_0_20px_var(--accent-primary-glow)]'
              : 'bg-white/[0.05] border border-white/[0.08] text-gray-200 rounded-bl-md'
          }`}>
            <p className="break-words leading-relaxed">{message.content}</p>
          </div>
        )}

        {/* Payment Attachment Display */}
        {message.payment && (
          <PaymentCard payment={message.payment} />
        )}

        {/* Poll Result Card */}
        {message.pollResult && (
          <PollResultCard pollResult={message.pollResult} />
        )}

        {/* Game Card */}
        {message.game && onGameClick && (
          <GameMessageCard
            game={message.game}
            currentUser={currentUser}
            onClick={() => onGameClick(message.game!.gameId)}
          />
        )}
      </div>
    </div>
  );
}

interface PaymentCardProps {
  payment: PaymentAttachment;
}

function PaymentCard({ payment }: PaymentCardProps) {
  return (
    <div className="mt-2 glass-card bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30 p-4 max-w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-amber-400 text-lg">💰</span>
          <span className="text-sm font-medium text-white">
            Private Payment
          </span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          payment.status === "completed"
            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
            : payment.status === "pending"
            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
            : "bg-red-500/20 text-red-400 border border-red-500/30"
        }`}>
          {payment.status}
        </span>
      </div>
      <div className="mt-3 text-sm">
        <span className="text-white font-semibold">
          {formatAmount(payment.amount, payment.token)}{" "}
          {payment.token}
        </span>
        <span className="text-gray-500 mx-2">→</span>
        <span className="text-gray-400 font-mono">
          <WalletAddress address={payment.recipient} />
        </span>
      </div>
      {payment.txSignature && (
        <a
          href={getSolscanUrl(payment.txSignature)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs [color:var(--accent-primary)] hover:[color:var(--accent-hover)] transition-colors"
        >
          View Transaction
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}
    </div>
  );
}

interface PollResultCardProps {
  pollResult: {
    pollId: string;
    question: string;
    options: { text: string; votes: number }[];
    totalVotes: number;
    creator: string;
    revealedAt: string;
  };
}

function PollResultCard({ pollResult }: PollResultCardProps) {
  return (
    <div className="mt-2 glass-card bg-gradient-to-br from-pink-500/10 to-purple-500/10 border-pink-500/30 p-4 max-w-md w-full">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <span className="text-sm font-medium text-pink-300">Poll Results</span>
      </div>
      <h4 className="font-semibold text-white mb-3">{pollResult.question}</h4>
      <div className="space-y-2">
        {pollResult.options.map((option, idx) => {
          const percentage = pollResult.totalVotes > 0
            ? (option.votes / pollResult.totalVotes) * 100
            : 0;
          const isWinner = pollResult.options.every(o => o.votes <= option.votes) && option.votes > 0;

          return (
            <div key={idx} className="relative overflow-hidden rounded-lg">
              <div
                className={`absolute inset-0 transition-all duration-500 ${
                  isWinner
                    ? 'bg-[linear-gradient(to_right,color-mix(in_srgb,var(--accent-primary)_40%,transparent),color-mix(in_srgb,var(--accent-gradient-to)_40%,transparent))]'
                    : 'bg-white/[0.05]'
                }`}
                style={{ width: `${percentage}%` }}
              />
              <div className="relative flex justify-between p-2.5">
                <span className={`text-sm ${isWinner ? 'text-white font-medium' : 'text-gray-300'}`}>
                  {isWinner && <span className="mr-1">✨</span>}
                  {option.text}
                </span>
                <span className={`text-sm font-mono ${isWinner ? '[color:var(--accent-hover)]' : 'text-gray-400'}`}>
                  {option.votes} ({percentage.toFixed(1)}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-gray-500">
        {pollResult.totalVotes} total vote{pollResult.totalVotes !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

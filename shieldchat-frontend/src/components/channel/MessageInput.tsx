"use client";

import { GlassInput, GlassButton } from "@/components/ui";
import { TypingIndicator } from "@/components/TypingIndicator";
import { PaymentAttachment, formatAmount } from "@/lib/shadowwire";

// Pending payment type (before execution - without txSignature and status)
type PendingPayment = Omit<PaymentAttachment, "txSignature" | "status">;

interface MessageInputProps {
  onSendMessage: (e: React.FormEvent) => void;
  message: string;
  setMessage: (msg: string) => void;
  onTyping: (isTyping: boolean) => void;
  pendingPayment: PendingPayment | null;
  onClearPayment: () => void;
  onOpenPaymentModal: () => void;
  sending: boolean;
  paymentLoading: boolean;
  error: string | null;
  typingUsers: string[];
  heliusConnected: boolean;
  heliusAvailable: boolean;
  isMember: boolean;
  joining: boolean;
  onJoin: () => void;
}

export function MessageInput({
  onSendMessage,
  message,
  setMessage,
  onTyping,
  pendingPayment,
  onClearPayment,
  onOpenPaymentModal,
  sending,
  paymentLoading,
  error,
  typingUsers,
  heliusConnected,
  heliusAvailable,
  isMember,
  joining,
  onJoin,
}: MessageInputProps) {
  if (!isMember) {
    return (
      <div className="glass-dark border-t border-white/[0.06] p-6">
        <div className="text-center">
          <p className="text-gray-400 mb-4">
            Join the channel to send messages
          </p>
          <GlassButton
            variant="primary"
            glow
            onClick={onJoin}
            disabled={joining}
            className="px-8"
          >
            {joining ? "Joining..." : "Join to Send Messages"}
          </GlassButton>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-dark border-t border-white/[0.06] p-4">
      {/* Typing Indicator */}
      {typingUsers.length > 0 && (
        <div className="mb-3">
          <TypingIndicator users={typingUsers} />
        </div>
      )}

      {/* Pending Payment Preview */}
      {pendingPayment && (
        <div className="mb-3 glass-card glass-accent p-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="[color:var(--accent-primary)] text-lg">💰</span>
            <span className="text-sm text-gray-200">
              Sending <span className="font-semibold text-white">{formatAmount(pendingPayment.amount, pendingPayment.token)} {pendingPayment.token}</span>{" "}
              to <span className="font-mono [color:var(--accent-hover)]">{pendingPayment.recipient.slice(0, 8)}...</span>
            </span>
            <span className="text-xs text-gray-500 bg-white/[0.05] px-2 py-0.5 rounded-full">
              {pendingPayment.type}
            </span>
          </div>
          <button
            onClick={onClearPayment}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/[0.05]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={onSendMessage} className="flex space-x-3">
        {/* Attach Payment Button */}
        <GlassButton
          type="button"
          variant={pendingPayment ? "primary" : "ghost"}
          size="md"
          onClick={onOpenPaymentModal}
          disabled={sending || paymentLoading}
          className="shrink-0"
        >
          <span className="text-lg">💰</span>
        </GlassButton>

        {/* Message Input */}
        <div className="flex-1">
          <GlassInput
            type="text"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              onTyping(e.target.value.length > 0);
            }}
            onBlur={() => onTyping(false)}
            placeholder="Type a message..."
            disabled={sending || paymentLoading}
            className="w-full"
          />
        </div>

        {/* Send Button */}
        <GlassButton
          type="submit"
          variant="primary"
          glow
          disabled={sending || paymentLoading || !message.trim()}
          className="shrink-0 px-6"
        >
          {sending || paymentLoading ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </GlassButton>
      </form>

      {/* Error Display */}
      {error && (
        <div className="mt-2 text-sm text-red-400 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Status Bar */}
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <p className="flex items-center gap-1.5">
          <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Encrypted with Arcium • Stored on IPFS
        </p>
        <div className="flex items-center space-x-4">
          {/* Presence Status */}
          <span className="flex items-center text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-emerald-400 animate-pulse" />
            Presence
          </span>
          {/* Helius Status */}
          {heliusAvailable ? (
            <span className={`flex items-center ${heliusConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${heliusConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
              {heliusConnected ? 'Real-time' : 'Connecting...'}
            </span>
          ) : (
            <span className="flex items-center text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-gray-500" />
              Polling
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

/**
 * Typing Indicator Component
 *
 * Shows animated dots with user names when someone is typing.
 * Uses MagicBlock's Private Ephemeral Rollups for privacy.
 */

/**
 * Formats a wallet address as: first8.....last6
 */
function formatAddress(address: string): string {
  if (!address || address.length < 14) {
    return address;
  }
  const first = address.slice(0, 8);
  const last = address.slice(-6);
  return `${first}.....${last}`;
}

interface TypingIndicatorProps {
  /** Array of user wallet addresses (full) who are typing */
  users: string[];
}

export function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  // Format the typing message with truncated addresses
  const formatTypingMessage = () => {
    const formatted = users.map(formatAddress);
    if (formatted.length === 1) {
      return `${formatted[0]} is typing`;
    } else if (formatted.length === 2) {
      return `${formatted[0]} and ${formatted[1]} are typing`;
    } else if (formatted.length === 3) {
      return `${formatted[0]}, ${formatted[1]}, and ${formatted[2]} are typing`;
    } else {
      return `${formatted[0]}, ${formatted[1]}, and ${users.length - 2} others are typing`;
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400">
      {/* Animated dots */}
      <div className="flex gap-1">
        <span
          className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce"
          style={{ animationDelay: "300ms" }}
        />
      </div>

      {/* Typing message */}
      <span className="italic">{formatTypingMessage()}</span>
    </div>
  );
}

export default TypingIndicator;

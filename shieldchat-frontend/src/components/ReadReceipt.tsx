"use client";

/**
 * Read Receipt Component
 *
 * Shows checkmarks indicating message delivery/read status.
 * Single check = sent, Double check = delivered, Blue double check = read
 */

interface ReadReceiptProps {
  /** Message has been sent */
  sent?: boolean;
  /** Message has been delivered */
  delivered?: boolean;
  /** Message has been read by recipient */
  read?: boolean;
}

export function ReadReceipt({
  sent = true,
  delivered = false,
  read = false,
}: ReadReceiptProps) {
  if (!sent) return null;

  // Determine which state to show
  const isRead = read;
  const isDelivered = delivered || read;

  return (
    <span
      className={`text-xs ml-1 ${
        isRead ? "text-cyan-400" : "text-gray-500"
      }`}
      title={
        isRead
          ? "Read"
          : isDelivered
          ? "Delivered"
          : "Sent"
      }
    >
      {isDelivered ? (
        // Double checkmark
        <svg
          className="w-4 h-4 inline-block"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 7l-8 8-3-3" />
          <path d="M22 7l-8 8-1-1" />
        </svg>
      ) : (
        // Single checkmark
        <svg
          className="w-4 h-4 inline-block"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )}
    </span>
  );
}

export default ReadReceipt;

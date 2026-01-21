"use client";

/**
 * Online Status Dot Component
 *
 * Shows a colored dot indicating if a user is online or offline.
 * Green = online, Gray = offline
 */

interface OnlineStatusProps {
  /** Whether the user is online */
  isOnline: boolean;
  /** Size of the dot */
  size?: "sm" | "md" | "lg";
  /** Show pulse animation when online */
  pulse?: boolean;
}

export function OnlineStatus({
  isOnline,
  size = "sm",
  pulse = true,
}: OnlineStatusProps) {
  const sizeClasses = {
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
    lg: "w-3 h-3",
  };

  return (
    <span className="relative inline-flex">
      <span
        className={`${sizeClasses[size]} rounded-full ${
          isOnline ? "bg-green-500" : "bg-gray-500"
        }`}
      />
      {isOnline && pulse && (
        <span
          className={`absolute inline-flex ${sizeClasses[size]} rounded-full bg-green-400 opacity-75 animate-ping`}
        />
      )}
    </span>
  );
}

export default OnlineStatus;

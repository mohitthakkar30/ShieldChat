"use client";

import { PulseIndicator } from "./GlowBadge";

interface FloatingAvatarProps {
  address?: string;
  name?: string;
  src?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showOnlineStatus?: boolean;
  isOnline?: boolean;
  gradient?: boolean;
  className?: string;
}

export function FloatingAvatar({
  address,
  name,
  src,
  size = "md",
  showOnlineStatus = false,
  isOnline = false,
  gradient = true,
  className = "",
}: FloatingAvatarProps) {
  // Get initials from name or first char of address
  const getInitials = () => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (address) {
      return address[0].toUpperCase();
    }
    return "?";
  };

  // Generate a consistent gradient based on address
  // Returns either a Tailwind class or 'theme' to use CSS variable
  const getGradient = () => {
    if (!address) return "theme"; // Use theme primary color

    const gradients = [
      "theme", // Use theme primary color
      "from-cyan-500 to-blue-600",
      "from-emerald-500 to-teal-600",
      "from-amber-500 to-orange-600",
      "from-pink-500 to-rose-600",
      "from-indigo-500 to-violet-600",
    ];

    // Use first char code to pick gradient
    const index = address.charCodeAt(0) % gradients.length;
    return gradients[index];
  };

  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
    xl: "w-16 h-16 text-lg",
  };

  const statusSize = {
    sm: "sm" as const,
    md: "sm" as const,
    lg: "md" as const,
    xl: "lg" as const,
  };

  const statusPosition = {
    sm: "-bottom-0.5 -right-0.5",
    md: "bottom-0 right-0",
    lg: "bottom-0.5 right-0.5",
    xl: "bottom-1 right-1",
  };

  return (
    <div className={`relative inline-flex ${className}`}>
      <div
        className={`
          ${sizeClasses[size]}
          rounded-full
          flex items-center justify-center
          font-semibold text-white
          shadow-[0_4px_15px_rgba(0,0,0,0.3)]
          ${gradient
            ? getGradient() === "theme"
              ? "bg-[linear-gradient(to_bottom_right,var(--accent-gradient-from),var(--accent-gradient-to))]"
              : `bg-gradient-to-br ${getGradient()}`
            : "bg-gray-700"}
          ring-2 ring-white/[0.1]
          transition-transform duration-200
          hover:scale-105
        `}
      >
        {src ? (
          <img
            src={src}
            alt={name || address || "Avatar"}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <span>{getInitials()}</span>
        )}
      </div>

      {showOnlineStatus && (
        <span className={`absolute ${statusPosition[size]}`}>
          <PulseIndicator isOnline={isOnline} size={statusSize[size]} />
        </span>
      )}
    </div>
  );
}

// Avatar group for showing multiple avatars
interface AvatarGroupProps {
  avatars: Array<{
    address?: string;
    name?: string;
    src?: string;
    isOnline?: boolean;
  }>;
  max?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function AvatarGroup({
  avatars,
  max = 4,
  size = "md",
  className = "",
}: AvatarGroupProps) {
  const displayAvatars = avatars.slice(0, max);
  const remaining = avatars.length - max;

  const overlapClasses = {
    sm: "-ml-2",
    md: "-ml-3",
    lg: "-ml-4",
  };

  const remainingSizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
  };

  return (
    <div className={`flex items-center ${className}`}>
      {displayAvatars.map((avatar, index) => (
        <div
          key={avatar.address || index}
          className={index > 0 ? overlapClasses[size] : ""}
          style={{ zIndex: displayAvatars.length - index }}
        >
          <FloatingAvatar
            {...avatar}
            size={size}
            showOnlineStatus={false}
          />
        </div>
      ))}
      {remaining > 0 && (
        <div
          className={`
            ${overlapClasses[size]}
            ${remainingSizeClasses[size]}
            rounded-full
            flex items-center justify-center
            font-semibold text-white
            bg-gray-700
            border-2 border-[#12121a]
          `}
          style={{ zIndex: 0 }}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}

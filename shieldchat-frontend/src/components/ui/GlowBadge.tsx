"use client";

interface GlowBadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info" | "violet" | "cyan" | "amber" | "pink";
  size?: "sm" | "md" | "lg";
  glow?: boolean;
  pulse?: boolean;
  dot?: boolean;
  className?: string;
}

export function GlowBadge({
  children,
  variant = "default",
  size = "md",
  glow = false,
  pulse = false,
  dot = false,
  className = "",
}: GlowBadgeProps) {
  const variantClasses = {
    default: `
      bg-white/[0.05]
      border-white/[0.1]
      text-gray-300
      ${glow ? "shadow-[0_0_15px_rgba(255,255,255,0.1)]" : ""}
    `,
    success: `
      bg-emerald-500/10
      border-emerald-500/30
      text-emerald-400
      ${glow ? "shadow-[0_0_15px_rgba(16,185,129,0.3)]" : ""}
    `,
    warning: `
      bg-amber-500/10
      border-amber-500/30
      text-amber-400
      ${glow ? "shadow-[0_0_15px_rgba(245,158,11,0.3)]" : ""}
    `,
    error: `
      bg-red-500/10
      border-red-500/30
      text-red-400
      ${glow ? "shadow-[0_0_15px_rgba(239,68,68,0.3)]" : ""}
    `,
    info: `
      bg-cyan-500/10
      border-cyan-500/30
      text-cyan-400
      ${glow ? "shadow-[0_0_15px_rgba(6,182,212,0.3)]" : ""}
    `,
    violet: `
      bg-violet-500/10
      border-violet-500/30
      text-violet-400
      ${glow ? "shadow-[0_0_15px_rgba(139,92,246,0.3)]" : ""}
    `,
    cyan: `
      bg-cyan-500/10
      border-cyan-500/30
      text-cyan-400
      ${glow ? "shadow-[0_0_15px_rgba(6,182,212,0.3)]" : ""}
    `,
    amber: `
      bg-amber-500/10
      border-amber-500/30
      text-amber-400
      ${glow ? "shadow-[0_0_15px_rgba(245,158,11,0.3)]" : ""}
    `,
    pink: `
      bg-pink-500/10
      border-pink-500/30
      text-pink-400
      ${glow ? "shadow-[0_0_15px_rgba(236,72,153,0.3)]" : ""}
    `,
  };

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm",
  };

  const dotColors = {
    default: "bg-gray-400",
    success: "bg-emerald-400",
    warning: "bg-amber-400",
    error: "bg-red-400",
    info: "bg-cyan-400",
    violet: "bg-violet-400",
    cyan: "bg-cyan-400",
    amber: "bg-amber-400",
    pink: "bg-pink-400",
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        font-medium
        rounded-full
        border
        backdrop-blur-sm
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {dot && (
        <span
          className={`
            w-1.5 h-1.5
            rounded-full
            ${dotColors[variant]}
            ${pulse ? "animate-pulse" : ""}
          `}
        />
      )}
      {children}
    </span>
  );
}

// Online status indicator
interface PulseIndicatorProps {
  isOnline?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PulseIndicator({
  isOnline = true,
  size = "md",
  className = "",
}: PulseIndicatorProps) {
  const sizeClasses = {
    sm: "w-2 h-2",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  };

  return (
    <span className={`relative inline-flex ${className}`}>
      <span
        className={`
          inline-flex
          rounded-full
          ${sizeClasses[size]}
          ${isOnline ? "bg-emerald-500" : "bg-gray-500"}
        `}
      />
      {isOnline && (
        <span
          className={`
            absolute inline-flex
            rounded-full
            ${sizeClasses[size]}
            bg-emerald-400
            opacity-75
            animate-ping
          `}
        />
      )}
    </span>
  );
}

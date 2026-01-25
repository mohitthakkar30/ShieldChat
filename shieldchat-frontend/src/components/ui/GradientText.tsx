"use client";

import React from "react";

interface GradientTextProps {
  children: React.ReactNode;
  variant?: "violet" | "cyan" | "emerald" | "amber" | "pink" | "rainbow";
  animate?: boolean;
  className?: string;
  as?: React.ElementType;
}

export function GradientText({
  children,
  variant = "violet",
  animate = false,
  className = "",
  as: Component = "span",
}: GradientTextProps) {
  const gradients = {
    violet: "from-violet-400 via-purple-400 to-fuchsia-400",
    cyan: "from-cyan-400 via-blue-400 to-indigo-400",
    emerald: "from-emerald-400 via-teal-400 to-cyan-400",
    amber: "from-amber-400 via-orange-400 to-red-400",
    pink: "from-pink-400 via-rose-400 to-red-400",
    rainbow: "from-violet-400 via-cyan-400 to-emerald-400",
  };

  return (
    <Component
      className={`
        bg-gradient-to-r ${gradients[variant]}
        bg-clip-text text-transparent
        ${animate ? "animate-gradient-x bg-[length:200%_auto]" : ""}
        ${className}
      `}
    >
      {children}
    </Component>
  );
}

// Glowing text effect
interface GlowTextProps {
  children: React.ReactNode;
  color?: "violet" | "cyan" | "emerald" | "amber" | "pink" | "white";
  intensity?: "low" | "medium" | "high";
  className?: string;
  as?: React.ElementType;
}

export function GlowText({
  children,
  color = "violet",
  intensity = "medium",
  className = "",
  as: Component = "span",
}: GlowTextProps) {
  const colorClasses = {
    violet: "text-violet-400",
    cyan: "text-cyan-400",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    pink: "text-pink-400",
    white: "text-white",
  };

  const glowShadows = {
    violet: {
      low: "drop-shadow-[0_0_10px_rgba(139,92,246,0.3)]",
      medium: "drop-shadow-[0_0_15px_rgba(139,92,246,0.5)]",
      high: "drop-shadow-[0_0_25px_rgba(139,92,246,0.7)]",
    },
    cyan: {
      low: "drop-shadow-[0_0_10px_rgba(6,182,212,0.3)]",
      medium: "drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]",
      high: "drop-shadow-[0_0_25px_rgba(6,182,212,0.7)]",
    },
    emerald: {
      low: "drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]",
      medium: "drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]",
      high: "drop-shadow-[0_0_25px_rgba(16,185,129,0.7)]",
    },
    amber: {
      low: "drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]",
      medium: "drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]",
      high: "drop-shadow-[0_0_25px_rgba(245,158,11,0.7)]",
    },
    pink: {
      low: "drop-shadow-[0_0_10px_rgba(236,72,153,0.3)]",
      medium: "drop-shadow-[0_0_15px_rgba(236,72,153,0.5)]",
      high: "drop-shadow-[0_0_25px_rgba(236,72,153,0.7)]",
    },
    white: {
      low: "drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]",
      medium: "drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]",
      high: "drop-shadow-[0_0_25px_rgba(255,255,255,0.5)]",
    },
  };

  return (
    <Component
      className={`
        ${colorClasses[color]}
        ${glowShadows[color][intensity]}
        ${className}
      `}
    >
      {children}
    </Component>
  );
}

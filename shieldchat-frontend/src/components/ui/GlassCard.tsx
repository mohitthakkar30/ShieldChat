"use client";

import { forwardRef } from "react";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "glow" | "accent";
  hover?: boolean;
  noPadding?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      className = "",
      variant = "default",
      hover = false,
      noPadding = false,
      children,
      ...props
    },
    ref
  ) => {
    const baseClasses = `
      backdrop-blur-xl
      border
      transition-all duration-300 ease-out
    `;

    const variantClasses = {
      default: `
        bg-white/[0.03]
        border-white/[0.08]
        shadow-[0_4px_30px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]
      `,
      elevated: `
        bg-white/[0.05]
        border-white/[0.1]
        shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]
      `,
      glow: `
        bg-white/[0.03]
        border-[color:var(--border-accent)]
        shadow-[0_0_40px_var(--accent-primary-glow),0_4px_30px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]
      `,
      accent: `
        glass-accent
        shadow-[0_4px_30px_var(--accent-primary-glow),inset_0_1px_0_rgba(255,255,255,0.08)]
      `,
    };

    const hoverClasses = hover
      ? `
        hover:translate-y-[-2px]
        hover:shadow-[0_10px_40px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]
        hover:border-white/[0.15]
        cursor-pointer
      `
      : "";

    const paddingClasses = noPadding ? "" : "p-4";

    return (
      <div
        ref={ref}
        className={`
          ${baseClasses}
          ${variantClasses[variant]}
          ${hoverClasses}
          ${paddingClasses}
          rounded-2xl
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = "GlassCard";

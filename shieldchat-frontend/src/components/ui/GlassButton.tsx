"use client";

import { forwardRef } from "react";

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  glow?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      className = "",
      variant = "primary",
      size = "md",
      glow = false,
      loading = false,
      disabled = false,
      icon,
      iconPosition = "left",
      children,
      ...props
    },
    ref
  ) => {
    const baseClasses = `
      inline-flex items-center justify-center gap-2
      font-medium
      rounded-xl
      backdrop-blur-md
      border
      transition-all duration-200 ease-out
      disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
      focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent
    `;

    const variantClasses = {
      primary: `
        bg-[linear-gradient(to_right,var(--accent-gradient-from),var(--accent-gradient-to))]
        border-[color:var(--border-accent)]
        text-white
        hover:brightness-110
        hover:shadow-[0_0_30px_var(--accent-primary-glow)]
        focus:ring-[color:var(--accent-primary)]
        ${glow ? "shadow-[0_0_20px_var(--accent-primary-glow)]" : ""}
      `,
      secondary: `
        bg-white/[0.05]
        border-white/[0.1]
        text-white
        hover:bg-white/[0.1]
        hover:border-white/[0.2]
        focus:ring-white/30
      `,
      ghost: `
        bg-transparent
        border-transparent
        text-gray-300
        hover:bg-white/[0.05]
        hover:text-white
        focus:ring-white/20
      `,
      danger: `
        bg-gradient-to-r from-red-600/80 to-rose-600/80
        border-red-500/50
        text-white
        hover:from-red-500 hover:to-rose-500
        hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]
        focus:ring-red-500/50
      `,
      success: `
        bg-gradient-to-r from-emerald-600/80 to-green-600/80
        border-emerald-500/50
        text-white
        hover:from-emerald-500 hover:to-green-500
        hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]
        focus:ring-emerald-500/50
      `,
    };

    const sizeClasses = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2.5 text-sm",
      lg: "px-6 py-3 text-base",
    };

    const content = (
      <>
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {!loading && icon && iconPosition === "left" && icon}
        {children && <span>{children}</span>}
        {!loading && icon && iconPosition === "right" && icon}
      </>
    );

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          ${baseClasses}
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${className}
        `}
        {...props}
      >
        {content}
      </button>
    );
  }
);

GlassButton.displayName = "GlassButton";

// Icon Button variant
interface GlassIconButtonProps extends Omit<GlassButtonProps, "icon" | "iconPosition" | "children"> {
  "aria-label": string;
  children: React.ReactNode;
}

export const GlassIconButton = forwardRef<HTMLButtonElement, GlassIconButtonProps>(
  ({ className = "", size = "md", ...props }, ref) => {
    const sizeClasses = {
      sm: "w-8 h-8",
      md: "w-10 h-10",
      lg: "w-12 h-12",
    };

    return (
      <GlassButton
        ref={ref}
        size={size}
        className={`${sizeClasses[size]} !p-0 ${className}`}
        {...props}
      />
    );
  }
);

GlassIconButton.displayName = "GlassIconButton";

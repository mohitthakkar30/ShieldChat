"use client";

import { forwardRef, useState } from "react";

interface GlassInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  hint?: string;
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  (
    {
      className = "",
      label,
      error,
      hint,
      size = "md",
      icon,
      iconPosition = "left",
      disabled,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);

    const sizeClasses = {
      sm: "py-2 text-sm",
      md: "py-3 text-sm",
      lg: "py-4 text-base",
    };

    const iconSizeClasses = {
      sm: "w-4 h-4",
      md: "w-5 h-5",
      lg: "w-6 h-6",
    };

    const paddingClasses = icon
      ? iconPosition === "left"
        ? "pl-11 pr-4"
        : "pl-4 pr-11"
      : "px-4";

    return (
      <div className={`w-full ${className}`}>
        {label && (
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div
              className={`
                absolute top-1/2 -translate-y-1/2
                ${iconPosition === "left" ? "left-4" : "right-4"}
                text-gray-400
                transition-colors duration-200
                ${isFocused ? "text-violet-400" : ""}
              `}
            >
              <span className={iconSizeClasses[size]}>{icon}</span>
            </div>
          )}
          <input
            ref={ref}
            disabled={disabled}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            className={`
              w-full
              ${sizeClasses[size]}
              ${paddingClasses}
              bg-white/[0.03]
              border border-white/[0.08]
              rounded-xl
              text-white
              placeholder-gray-500
              backdrop-blur-md
              transition-all duration-300 ease-out
              focus:outline-none
              focus:border-violet-500/50
              focus:shadow-[0_0_20px_rgba(139,92,246,0.15),inset_0_1px_0_rgba(255,255,255,0.05)]
              focus:bg-white/[0.05]
              disabled:opacity-50 disabled:cursor-not-allowed
              ${error ? "border-red-500/50 focus:border-red-500/50 focus:shadow-[0_0_20px_rgba(239,68,68,0.15)]" : ""}
            `}
            {...props}
          />
          {/* Animated gradient border on focus */}
          <div
            className={`
              absolute inset-0
              rounded-xl
              pointer-events-none
              transition-opacity duration-300
              ${isFocused ? "opacity-100" : "opacity-0"}
            `}
            style={{
              background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.2), transparent)",
              maskImage: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              maskComposite: "xor",
              WebkitMaskComposite: "xor",
              padding: "1px",
            }}
          />
        </div>
        {(error || hint) && (
          <p
            className={`mt-2 text-xs ${
              error ? "text-red-400" : "text-gray-500"
            }`}
          >
            {error || hint}
          </p>
        )}
      </div>
    );
  }
);

GlassInput.displayName = "GlassInput";

// Textarea variant
interface GlassTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> {
  label?: string;
  error?: string;
  hint?: string;
}

export const GlassTextarea = forwardRef<HTMLTextAreaElement, GlassTextareaProps>(
  ({ className = "", label, error, hint, disabled, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
      <div className={`w-full ${className}`}>
        {label && (
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {label}
          </label>
        )}
        <div className="relative">
          <textarea
            ref={ref}
            disabled={disabled}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            className={`
              w-full
              py-3 px-4
              min-h-[100px]
              bg-white/[0.03]
              border border-white/[0.08]
              rounded-xl
              text-white
              placeholder-gray-500
              backdrop-blur-md
              resize-none
              transition-all duration-300 ease-out
              focus:outline-none
              focus:border-violet-500/50
              focus:shadow-[0_0_20px_rgba(139,92,246,0.15),inset_0_1px_0_rgba(255,255,255,0.05)]
              focus:bg-white/[0.05]
              disabled:opacity-50 disabled:cursor-not-allowed
              ${error ? "border-red-500/50 focus:border-red-500/50" : ""}
            `}
            {...props}
          />
        </div>
        {(error || hint) && (
          <p
            className={`mt-2 text-xs ${
              error ? "text-red-400" : "text-gray-500"
            }`}
          >
            {error || hint}
          </p>
        )}
      </div>
    );
  }
);

GlassTextarea.displayName = "GlassTextarea";

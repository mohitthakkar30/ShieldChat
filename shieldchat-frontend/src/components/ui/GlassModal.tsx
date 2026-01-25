"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface GlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
}

export function GlassModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "md",
  showCloseButton = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
}: GlassModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    if (!closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose, closeOnEscape]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const focusableElements = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleTabKey);
    firstElement?.focus();

    return () => document.removeEventListener("keydown", handleTabKey);
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    full: "max-w-4xl",
  };

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div
        ref={modalRef}
        className={`
          relative
          w-full
          ${sizeClasses[size]}
          bg-[#12121a]/95
          backdrop-blur-2xl
          border border-white/[0.1]
          rounded-2xl
          shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.05)_inset]
          animate-modal-enter
          overflow-hidden
        `}
      >
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-purple-500/5 pointer-events-none" />

        {/* Header */}
        {(title || showCloseButton) && (
          <div className="relative flex items-start justify-between p-6 pb-0">
            <div>
              {title && (
                <h2
                  id="modal-title"
                  className="text-xl font-semibold text-white font-display"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-1 text-sm text-gray-400">{description}</p>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="
                  p-2 -m-2
                  text-gray-400
                  hover:text-white
                  hover:bg-white/[0.05]
                  rounded-lg
                  transition-colors duration-200
                  focus:outline-none focus:ring-2 focus:ring-violet-500/50
                "
                aria-label="Close modal"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="relative p-6">{children}</div>
      </div>
    </div>
  );

  // Use portal to render at document root
  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}

// Modal Footer component for consistent button layouts
interface GlassModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function GlassModalFooter({ children, className = "" }: GlassModalFooterProps) {
  return (
    <div
      className={`
        flex items-center justify-end gap-3
        pt-4 mt-4
        border-t border-white/[0.08]
        ${className}
      `}
    >
      {children}
    </div>
  );
}

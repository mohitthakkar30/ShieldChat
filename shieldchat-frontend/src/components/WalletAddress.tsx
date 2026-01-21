"use client";

import { useState, useCallback } from "react";

interface WalletAddressProps {
  /** Full wallet address (44 chars for Solana) */
  address: string;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Formats a wallet address as: first8.....last6
 * Example: EuQoFfUb.....abadue
 */
function formatAddress(address: string): string {
  if (!address || address.length < 14) {
    return address;
  }
  const first = address.slice(0, 8);
  const last = address.slice(-6);
  return `${first}.....${last}`;
}

/**
 * WalletAddress Component
 *
 * Displays a truncated wallet address in format: EuQoFfUb.....abadue
 * Click to copy full address to clipboard.
 */
export function WalletAddress({ address, className = "" }: WalletAddressProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!address) return;

    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  }, [address]);

  if (!address) {
    return <span className={className}>Unknown</span>;
  }

  return (
    <span
      onClick={handleCopy}
      className={`cursor-pointer hover:text-purple-400 transition-colors relative ${className}`}
      title={copied ? "Copied!" : `Click to copy: ${address}`}
    >
      {formatAddress(address)}
      {copied && (
        <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
          Copied!
        </span>
      )}
    </span>
  );
}

export default WalletAddress;

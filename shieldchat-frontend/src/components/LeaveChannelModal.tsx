"use client";

import { useState, useEffect } from "react";
import { getTokenMetadata, TokenMetadata } from "@/lib/helius";

interface LeaveChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  channelName: string;
  isTokenGated: boolean;
  stakedAmount?: string;
  tokenMint?: string;
}

export function LeaveChannelModal({
  isOpen,
  onClose,
  onConfirm,
  loading,
  channelName,
  isTokenGated,
  stakedAmount,
  tokenMint,
}: LeaveChannelModalProps) {
  const [tokenMetadata, setTokenMetadata] = useState<TokenMetadata | null>(null);

  // Fetch token metadata when modal opens with a token-gated channel
  useEffect(() => {
    if (isOpen && isTokenGated && tokenMint) {
      getTokenMetadata(tokenMint)
        .then(setTokenMetadata)
        .catch(console.error);
    } else {
      setTokenMetadata(null);
    }
  }, [isOpen, isTokenGated, tokenMint]);

  // Format raw token amount to human-readable using decimals
  const formatTokenAmount = (rawAmount: string, decimals: number): string => {
    const amount = BigInt(rawAmount);
    const divisor = BigInt(10 ** decimals);
    const whole = amount / divisor;
    const remainder = amount % divisor;
    if (remainder === BigInt(0)) {
      return whole.toString();
    }
    const decimalStr = remainder.toString().padStart(decimals, '0').replace(/0+$/, '');
    return `${whole}.${decimalStr}`;
  };

  // Get formatted staked amount
  const getFormattedAmount = (): string => {
    if (!stakedAmount) return "";
    if (tokenMetadata) {
      return `${formatTokenAmount(stakedAmount, tokenMetadata.decimals)} ${tokenMetadata.symbol}`;
    }
    return stakedAmount;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold">Leave Channel</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-gray-300">
            Are you sure you want to leave <span className="font-semibold text-white">{channelName}</span>?
          </p>

          {isTokenGated && stakedAmount && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-center space-x-2 text-green-400 font-medium mb-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Tokens Will Be Returned</span>
              </div>
              <p className="text-sm text-gray-400">
                Your staked tokens ({getFormattedAmount()}) will be returned to your wallet when you leave this channel.
              </p>
            </div>
          )}

          <p className="text-sm text-gray-500">
            You will lose access to messages in this channel. You can rejoin later if the channel allows it.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Leaving...</span>
              </>
            ) : (
              <span>Leave Channel</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LeaveChannelModal;

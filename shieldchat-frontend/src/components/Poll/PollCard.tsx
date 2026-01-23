"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { PollAccount } from "@/types/shieldchat_voting";

interface PollCardProps {
  poll: PollAccount;
  pollPda: PublicKey;
  hasVoted: boolean;
  isActive: boolean;
  canReveal: boolean;
  onVote: (optionIndex: number) => Promise<void>;
  onReveal: () => Promise<void>;
  loading: boolean;
}

export function PollCard({
  poll,
  hasVoted,
  isActive,
  canReveal,
  onVote,
  onReveal,
  loading,
}: PollCardProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [voting, setVoting] = useState(false);
  const [revealing, setRevealing] = useState(false);

  // Format remaining time
  const formatTimeRemaining = () => {
    const now = Date.now() / 1000;
    const endTime = poll.endTime.toNumber();
    const remaining = endTime - now;

    if (remaining <= 0) return "Ended";

    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h left`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m left`;
    }

    return `${minutes}m left`;
  };

  const handleVote = async (index: number) => {
    if (hasVoted || !isActive || voting) return;

    setSelectedOption(index);
    setVoting(true);

    try {
      await onVote(index);
    } catch (err) {
      console.error("Vote failed:", err);
      setSelectedOption(null);
    } finally {
      setVoting(false);
    }
  };

  const handleReveal = async () => {
    if (!canReveal || revealing) return;

    setRevealing(true);
    try {
      await onReveal();
    } catch (err) {
      console.error("Reveal failed:", err);
    } finally {
      setRevealing(false);
    }
  };

  const totalVotes = poll.totalVotes.toNumber();
  const options = poll.options.slice(0, poll.optionsCount);

  // If revealed, show results
  if (poll.revealed) {
    return (
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-white pr-2">{poll.question}</h3>
          <span className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded-full whitespace-nowrap">
            Results
          </span>
        </div>

        {/* Results */}
        <div className="space-y-3">
          {options.map((option, index) => {
            const votes = poll.revealedCounts[index].toNumber();
            const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
            const isWinner =
              votes === Math.max(...poll.revealedCounts.slice(0, poll.optionsCount).map((c) => c.toNumber()));

            return (
              <div key={index} className="relative">
                <div
                  className={`absolute inset-0 rounded-lg ${
                    isWinner ? "bg-purple-600/30" : "bg-gray-700/30"
                  }`}
                  style={{ width: `${percentage}%` }}
                />
                <div className="relative flex items-center justify-between p-3">
                  <span className="text-white">{option}</span>
                  <span className="text-gray-300 text-sm">
                    {votes} ({percentage.toFixed(1)}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Total votes */}
        <p className="mt-3 text-sm text-gray-400">
          {totalVotes} total vote{totalVotes !== 1 ? "s" : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-white pr-2">{poll.question}</h3>
        <span
          className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
            isActive
              ? "text-purple-400 bg-purple-400/10"
              : "text-gray-400 bg-gray-600/30"
          }`}
        >
          {formatTimeRemaining()}
        </span>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleVote(index)}
            disabled={hasVoted || !isActive || loading || voting}
            className={`w-full p-3 rounded-lg text-left transition-all ${
              hasVoted
                ? "bg-gray-700/50 text-gray-400 cursor-not-allowed"
                : isActive
                ? selectedOption === index && voting
                  ? "bg-purple-600/50 text-white border border-purple-500"
                  : "bg-gray-700 text-white hover:bg-purple-600/30 hover:border-purple-500/50 border border-transparent"
                : "bg-gray-700/50 text-gray-400 cursor-not-allowed"
            }`}
          >
            <div className="flex items-center gap-2">
              {selectedOption === index && voting && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              {option}
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
          {hasVoted && (
            <span className="ml-2 text-green-400">
              <svg
                className="w-4 h-4 inline"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Voted
            </span>
          )}
        </p>

        {canReveal && (
          <button
            onClick={handleReveal}
            disabled={revealing || loading}
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
          >
            {revealing ? "Revealing..." : "Reveal Results"}
          </button>
        )}
      </div>

      {/* Anonymous notice */}
      <div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <span>Encrypted voting powered by Inco</span>
      </div>
    </div>
  );
}

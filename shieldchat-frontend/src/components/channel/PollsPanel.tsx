"use client";

import { useState } from "react";
import { PollCard } from "@/components/Poll";
import { PublicKey } from "@solana/web3.js";
import { PollAccount, PollWithPda } from "@/types/shieldchat_voting";

interface PollsPanelProps {
  polls: PollWithPda[];
  loading: boolean;
  hasVoted: (pollPda: PublicKey) => boolean;
  isPollActive: (poll: PollAccount) => boolean;
  canReveal: (poll: PollAccount) => boolean;
  onVote: (pollPda: PublicKey, optionIndex: number) => Promise<void>;
  onReveal: (pollPda: PublicKey) => Promise<void>;
}

export function PollsPanel({
  polls,
  loading,
  hasVoted,
  isPollActive,
  canReveal,
  onVote,
  onReveal,
}: PollsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const activePolls = polls.filter((p) => isPollActive(p.account));

  if (polls.length === 0) return null;

  return (
    <div className="glass-dark border-b border-white/[0.06]">
      {/* Toggle Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="text-left">
            <h3 className="text-sm font-medium text-white">Active Polls</h3>
            <p className="text-xs text-gray-500">
              {activePolls.length} active • {polls.length - activePolls.length} ended
            </p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Polls Content */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          expanded ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pb-4 space-y-3 overflow-y-auto max-h-[360px]">
          {polls.map((poll, index) => (
            <div
              key={poll.pda.toString()}
              className="animate-float-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <PollCard
                poll={poll.account}
                pollPda={poll.pda}
                hasVoted={hasVoted(poll.pda)}
                isActive={isPollActive(poll.account)}
                canReveal={canReveal(poll.account)}
                onVote={(optionIndex) => onVote(poll.pda, optionIndex)}
                onReveal={() => onReveal(poll.pda)}
                loading={loading}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import { GlassButton, GlowBadge } from "@/components/ui";

interface ChannelHeaderProps {
  channelName: string;
  channelType: string;
  memberCount: number;
  messageCount: string;
  onlineCount: number;
  isOwner: boolean;
  canAccess: boolean;
  isMember: boolean;
  messagesLoading: boolean;
  joining: boolean;
  onJoin: () => void;
  onRefresh: () => void;
  onCreatePoll: () => void;
  onOpenGames: () => void;
  onInvite: () => void;
  onLeave: () => void;
}

export function ChannelHeader({
  channelName,
  channelType,
  memberCount,
  messageCount,
  onlineCount,
  isOwner,
  canAccess,
  isMember,
  messagesLoading,
  joining,
  onJoin,
  onRefresh,
  onCreatePoll,
  onOpenGames,
  onInvite,
  onLeave,
}: ChannelHeaderProps) {
  return (
    <div className="glass-dark border-b border-white/[0.06] p-3 md:p-4">
      {/* Desktop: single row | Mobile: stacked */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Channel Info */}
        <div className="flex items-center gap-3">
          {/* Channel Avatar */}
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-[color:var(--accent-primary)]/20 rounded-xl blur-md" />
            <div className="relative w-10 h-10 md:w-12 md:h-12 bg-[linear-gradient(to_bottom_right,var(--accent-gradient-from),var(--accent-gradient-to))] rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-lg md:text-xl font-bold text-white">#</span>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-bold font-display text-white truncate max-w-[200px] lg:max-w-none">
                {channelName || "Unnamed Channel"}
              </h1>
              <GlowBadge variant="violet" size="sm">
                {channelType}
              </GlowBadge>
              {isOwner && (
                <GlowBadge variant="violet" size="sm" glow>
                  Owner
                </GlowBadge>
              )}
            </div>
            {/* Stats row */}
            {canAccess ? (
              <div className="flex items-center gap-2 text-xs md:text-sm text-gray-400 mt-0.5">
                <span>{memberCount} members</span>
                {onlineCount > 0 && (
                  <>
                    <span className="text-gray-600">•</span>
                    <span className="text-emerald-400 flex items-center">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mr-1 animate-pulse" />
                      {onlineCount} online
                    </span>
                  </>
                )}
                <span className="text-gray-600">•</span>
                <span>{messageCount} messages</span>
              </div>
            ) : (
              <div className="text-xs md:text-sm text-gray-500 mt-0.5">
                Join to see activity
              </div>
            )}
          </div>
        </div>

        {/* Channel Actions */}
        <div className="flex items-center gap-1.5 md:gap-2 overflow-x-auto pb-1 lg:pb-0 -mb-1 lg:mb-0">
          {canAccess && (
            <>
              <GlassButton
                variant="ghost"
                size="sm"
                onClick={onOpenGames}
                className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10 shrink-0"
                icon={<span className="text-base md:text-lg">🎲</span>}
              >
                <span className="hidden sm:inline">Games</span>
              </GlassButton>

              <GlassButton
                variant="ghost"
                size="sm"
                onClick={onCreatePoll}
                className="shrink-0"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
              >
                <span className="hidden sm:inline">Poll</span>
              </GlassButton>

              <GlassButton
                variant="primary"
                size="sm"
                onClick={onInvite}
                className="shrink-0"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                }
              >
                <span className="hidden sm:inline">Invite</span>
              </GlassButton>

              <GlassButton
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={messagesLoading}
                className="shrink-0"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                }
              >
                <span className="hidden sm:inline">{messagesLoading ? "..." : "Refresh"}</span>
              </GlassButton>

              {isMember && !isOwner && (
                <GlassButton
                  variant="danger"
                  size="sm"
                  onClick={onLeave}
                  className="shrink-0"
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  }
                >
                  <span className="hidden sm:inline">Leave</span>
                </GlassButton>
              )}
            </>
          )}
          {!canAccess && (
            <GlassButton
              variant="primary"
              glow
              onClick={onJoin}
              disabled={joining}
            >
              {joining ? "Joining..." : "Join Channel"}
            </GlassButton>
          )}
        </div>
      </div>
    </div>
  );
}

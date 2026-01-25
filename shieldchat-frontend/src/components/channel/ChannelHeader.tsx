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
    <div className="glass-dark border-b border-white/[0.06] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Channel Avatar */}
          <div className="relative">
            <div className="absolute inset-0 bg-violet-500/20 rounded-xl blur-md" />
            <div className="relative w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-xl font-bold text-white">#</span>
            </div>
          </div>

          <div>
            <h1 className="text-xl font-bold font-display text-white">
              {channelName || "Unnamed Channel"}
            </h1>
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <GlowBadge variant="violet" size="sm">
                {channelType}
              </GlowBadge>

              {canAccess ? (
                <>
                  <span className="text-gray-600">•</span>
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
                </>
              ) : (
                <>
                  <span className="text-gray-600">•</span>
                  <span className="text-gray-500">Join to see activity</span>
                </>
              )}
              {isOwner && (
                <>
                  <span className="text-gray-600">•</span>
                  <GlowBadge variant="violet" size="sm" glow>
                    Owner
                  </GlowBadge>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Channel Actions */}
        <div className="flex items-center space-x-2">
          {canAccess && (
            <>
              <GlassButton
                variant="ghost"
                size="sm"
                onClick={onOpenGames}
                className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                icon={<span className="text-lg">🎲</span>}
              >
                Games
              </GlassButton>

              <GlassButton
                variant="ghost"
                size="sm"
                onClick={onCreatePoll}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
              >
                Poll
              </GlassButton>

              <GlassButton
                variant="primary"
                size="sm"
                onClick={onInvite}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                }
              >
                Invite
              </GlassButton>

              <GlassButton
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={messagesLoading}
              >
                {messagesLoading ? "Loading..." : "Refresh"}
              </GlassButton>

              {isMember && !isOwner && (
                <GlassButton
                  variant="danger"
                  size="sm"
                  onClick={onLeave}
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  }
                >
                  Leave
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

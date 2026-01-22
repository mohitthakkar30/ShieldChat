"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useShieldChat, Channel } from "@/hooks/useShieldChat";
import { parseChannelType } from "@/lib/anchor";
import { useWallet } from "@solana/wallet-adapter-react";

interface ChannelListProps {
  onCreateChannel: () => void;
}

interface ChannelWithAccess extends Channel {
  hasAccess: boolean;
}

export function ChannelList({ onCreateChannel }: ChannelListProps) {
  const { fetchAccessibleChannels, loading, connected } = useShieldChat();
  const { publicKey } = useWallet();
  const [channels, setChannels] = useState<ChannelWithAccess[]>([]);

  useEffect(() => {
    if (connected) {
      loadChannels();
    }
  }, [connected]);

  const loadChannels = async () => {
    if (!publicKey) return;

    const result = await fetchAccessibleChannels();

    const channelsWithAccess: ChannelWithAccess[] = result.map((channel) => {
      const isOwner = channel.account.owner.equals(publicKey);
      if (isOwner) {
        return { ...channel, hasAccess: true };
      }

      const isTokenGated = !!channel.account.requiredTokenMint;
      const channelType = parseChannelType(channel.account.channelType);

      if (channelType === "Public") {
        return { ...channel, hasAccess: true };
      }

      if (isTokenGated) {
        return { ...channel, hasAccess: false };
      }

      return { ...channel, hasAccess: true };
    });

    setChannels(channelsWithAccess);
  };

  // Group channels by category
  const groupedChannels = useMemo(() => {
    const owned: ChannelWithAccess[] = [];
    const member: ChannelWithAccess[] = [];
    const discover: ChannelWithAccess[] = [];

    channels.forEach((channel) => {
      if (publicKey && channel.account.owner.equals(publicKey)) {
        owned.push(channel);
      } else if (channel.hasAccess) {
        member.push(channel);
      } else {
        discover.push(channel);
      }
    });

    return { owned, member, discover };
  }, [channels, publicKey]);

  if (!connected) {
    return (
      <div className="p-4 text-center text-gray-500">
        <svg className="w-8 h-8 mx-auto mb-2 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
        </svg>
        <p className="text-sm">Connect wallet to view</p>
      </div>
    );
  }

  const hasChannels = channels.length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-gray-800">
        <button
          onClick={loadChannels}
          disabled={loading}
          className="w-full text-xs text-gray-400 hover:text-white py-2 border border-gray-700/50 rounded-lg hover:border-gray-600 hover:bg-gray-800/50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Loading...</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </>
          )}
        </button>
      </div>

      {/* Channel List */}
      <div className="flex-1 overflow-y-auto">
        {!hasChannels ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-800/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm mb-1">No channels yet</p>
            <p className="text-gray-600 text-xs">Create one to get started!</p>
          </div>
        ) : (
          <div className="p-2 space-y-4">
            {/* Your Channels */}
            {groupedChannels.owned.length > 0 && (
              <ChannelSection title="Your Channels" channels={groupedChannels.owned} />
            )}

            {/* Member Of */}
            {groupedChannels.member.length > 0 && (
              <ChannelSection title="Member Of" channels={groupedChannels.member} />
            )}

            {/* Discover */}
            {groupedChannels.discover.length > 0 && (
              <ChannelSection title="Discover" channels={groupedChannels.discover} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ChannelSection({ title, channels }: { title: string; channels: ChannelWithAccess[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">
        {title}
      </h3>
      <div className="space-y-1">
        {channels.map((channel) => (
          <ChannelCard key={channel.publicKey.toString()} channel={channel} hasAccess={channel.hasAccess} />
        ))}
      </div>
    </div>
  );
}

function ChannelCard({ channel, hasAccess }: { channel: Channel; hasAccess: boolean }) {
  const channelName = new TextDecoder().decode(
    new Uint8Array(channel.account.encryptedMetadata)
  );

  const channelType = parseChannelType(channel.account.channelType);
  const isTokenGated = !!channel.account.requiredTokenMint;

  return (
    <Link
      href={`/app/channels/${channel.publicKey.toString()}`}
      className="group block p-3 rounded-xl bg-gray-800/30 hover:bg-gray-800/60 border border-transparent hover:border-purple-500/30 transition-all duration-200"
    >
      <div className="flex items-center gap-3">
        {/* Channel avatar */}
        <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          isTokenGated
            ? "bg-gradient-to-br from-amber-500 to-orange-600"
            : "bg-gradient-to-br from-purple-500 to-pink-500"
        } shadow-lg group-hover:shadow-xl transition-shadow`}>
          <span className="text-lg">{isTokenGated ? "🎫" : "#"}</span>
        </div>

        {/* Channel info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">
              {channelName || "Unnamed"}
            </span>
            {isTokenGated && (
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30 font-medium">
                GATED
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-1.5">
            <span>{channelType}</span>
            {hasAccess && (
              <>
                <span className="text-gray-600">·</span>
                <span>{channel.account.memberCount} members</span>
              </>
            )}
          </div>
        </div>

        {/* Status indicator */}
        {hasAccess ? (
          <div className="text-xs text-gray-600 tabular-nums">
            {channel.account.messageCount.toString()}
          </div>
        ) : (
          <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        )}
      </div>
    </Link>
  );
}

export default ChannelList;

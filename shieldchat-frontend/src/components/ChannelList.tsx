"use client";

import { useEffect, useState } from "react";
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

    // Fetch accessible channels (includes token-gated for discovery)
    const result = await fetchAccessibleChannels();

    // Determine access for each channel
    const channelsWithAccess: ChannelWithAccess[] = result.map((channel) => {
      // Owner always has access
      const isOwner = channel.account.owner.equals(publicKey);
      if (isOwner) {
        return { ...channel, hasAccess: true };
      }

      // For non-token-gated channels in this list, user must be a member
      // (fetchAccessibleChannels already filters private channels by membership)
      const isTokenGated = !!channel.account.requiredTokenMint;
      const channelType = parseChannelType(channel.account.channelType);

      // Public channels - everyone has access to view stats
      if (channelType === "Public") {
        return { ...channel, hasAccess: true };
      }

      // Token-gated channels shown for discovery - user may not have access yet
      // We need to check membership. For now, assume no access if token-gated and not owner
      // The channel page will do the actual membership check
      if (isTokenGated) {
        // For simplicity, hide stats in the list - they'll see full info on the channel page
        return { ...channel, hasAccess: false };
      }

      // Private channels - if in the list, user is a member
      return { ...channel, hasAccess: true };
    });

    setChannels(channelsWithAccess);
  };

  if (!connected) {
    return (
      <div className="p-4 text-center text-gray-400">
        Connect your wallet to view channels
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Channels</h2>
          <button
            onClick={onCreateChannel}
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm py-1 px-3 rounded-lg transition-colors"
          >
            + New
          </button>
        </div>
        <button
          onClick={loadChannels}
          disabled={loading}
          className="w-full text-sm text-gray-400 hover:text-white py-2 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh Channels"}
        </button>
      </div>

      {/* Channel List */}
      <div className="flex-1 overflow-y-auto">
        {channels.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p>No channels found</p>
            <p className="text-sm mt-2">Create one to get started!</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {channels.map((channel) => (
              <ChannelCard key={channel.publicKey.toString()} channel={channel} hasAccess={channel.hasAccess} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChannelCard({ channel, hasAccess }: { channel: Channel; hasAccess: boolean }) {
  // Decode metadata (simple UTF-8 for now)
  const channelName = new TextDecoder().decode(
    new Uint8Array(channel.account.encryptedMetadata)
  );

  const channelType = parseChannelType(channel.account.channelType);
  const isTokenGated = !!channel.account.requiredTokenMint;

  return (
    <Link
      href={`/app/channels/${channel.publicKey.toString()}`}
      className="block p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-purple-500 transition-all"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isTokenGated
              ? "bg-gradient-to-br from-yellow-500 to-orange-500"
              : "bg-gradient-to-br from-purple-500 to-pink-500"
          }`}>
            <span className="text-lg">{isTokenGated ? "🎫" : "#"}</span>
          </div>
          <div>
            <div className="font-medium flex items-center gap-2">
              {channelName || "Unnamed Channel"}
              {isTokenGated && (
                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/30">
                  Token Gated
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500">
              {channelType}
              {hasAccess ? (
                <> • {channel.account.memberCount} members</>
              ) : (
                <> • <span className="text-gray-600">Join to see activity</span></>
              )}
            </div>
          </div>
        </div>
        {hasAccess ? (
          <div className="text-xs text-gray-500">
            {channel.account.messageCount.toString()} msgs
          </div>
        ) : (
          <div className="text-xs text-yellow-500">
            🔒
          </div>
        )}
      </div>
    </Link>
  );
}

export default ChannelList;

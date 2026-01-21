"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useShieldChat, Channel } from "@/hooks/useShieldChat";
import { parseChannelType } from "@/lib/anchor";

interface ChannelListProps {
  onCreateChannel: () => void;
}

export function ChannelList({ onCreateChannel }: ChannelListProps) {
  const { fetchAccessibleChannels, loading, connected } = useShieldChat();
  const [channels, setChannels] = useState<Channel[]>([]);

  useEffect(() => {
    if (connected) {
      loadChannels();
    }
  }, [connected]);

  const loadChannels = async () => {
    // Only fetch channels the user can access (owner or member)
    // Private channels are hidden from non-members
    const result = await fetchAccessibleChannels();
    setChannels(result);
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
              <ChannelCard key={channel.publicKey.toString()} channel={channel} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChannelCard({ channel }: { channel: Channel }) {
  // Decode metadata (simple UTF-8 for now)
  const channelName = new TextDecoder().decode(
    new Uint8Array(channel.account.encryptedMetadata)
  );

  const channelType = parseChannelType(channel.account.channelType);

  return (
    <Link
      href={`/app/channels/${channel.publicKey.toString()}`}
      className="block p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-purple-500 transition-all"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <span className="text-lg">#</span>
          </div>
          <div>
            <div className="font-medium">{channelName || "Unnamed Channel"}</div>
            <div className="text-xs text-gray-500">
              {channelType} • {channel.account.memberCount} members
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          {channel.account.messageCount.toString()} msgs
        </div>
      </div>
    </Link>
  );
}

export default ChannelList;

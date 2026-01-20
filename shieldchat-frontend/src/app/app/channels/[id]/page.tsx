"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useShieldChat, Channel, Member } from "@/hooks/useShieldChat";
import { useMessages, ChatMessage } from "@/hooks/useMessages";
import { useHelius } from "@/hooks/useHelius";
import { HeliusMessage } from "@/lib/helius";
import { parseChannelType } from "@/lib/anchor";

export default function ChannelPage() {
  const params = useParams();
  const channelId = params.id as string;

  const {
    fetchChannel,
    checkMembership,
    joinChannel,
    logMessage,
    loading,
    error,
    publicKey,
  } = useShieldChat();

  // Parse channel PDA for useMessages hook
  const channelPda = channelId ? (() => {
    try {
      return new PublicKey(channelId);
    } catch {
      return null;
    }
  })() : null;

  const {
    messages,
    loading: messagesLoading,
    fetchChannelMessages,
    addLocalMessage,
    addMessageFromHelius,
    startPolling,
    stopPolling,
  } = useMessages(channelPda);

  // Helius real-time monitoring - callback for when new messages are detected
  // Uses direct extraction from Helius payload for faster message display
  const handleNewMessage = useCallback(async (heliusMessage: HeliusMessage) => {
    console.log("[Channel] Helius detected new message, extracting directly...");

    // Try to extract and display message directly from Helius payload
    const added = await addMessageFromHelius(
      heliusMessage.instructionData,
      heliusMessage.sender,
      heliusMessage.signature,
      heliusMessage.timestamp
    );

    if (!added) {
      // Fallback to full refresh if direct extraction failed
      console.log("[Channel] Direct extraction failed, falling back to refresh");
      fetchChannelMessages(true);
    }
  }, [addMessageFromHelius, fetchChannelMessages]);

  const {
    connected: heliusConnected,
    isAvailable: heliusAvailable,
  } = useHelius({
    channelPda,
    onNewMessage: handleNewMessage,
    enabled: true,
  });

  const [channel, setChannel] = useState<Channel | null>(null);
  const [membership, setMembership] = useState<Member | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [joining, setJoining] = useState(false);
  const hasFetchedMessages = useRef(false);

  // Load channel data
  useEffect(() => {
    if (channelId) {
      loadChannelData();
    }
  }, [channelId]);

  // Load messages once when channel is ready
  useEffect(() => {
    if (channelId && channelPda && !hasFetchedMessages.current) {
      hasFetchedMessages.current = true;
      fetchChannelMessages();
    }
  }, [channelId, channelPda, fetchChannelMessages]);

  // Start/stop polling based on Helius connection status
  // If Helius is connected, we don't need fast polling (rely on WebSocket)
  // If Helius is not available, use 3-second polling as fallback
  useEffect(() => {
    if (!channelId || !channelPda) {
      stopPolling();
      return;
    }

    if (heliusConnected) {
      // Helius connected - stop fast polling, use WebSocket for real-time updates
      // Optional: Could keep slow polling (30s) as backup
      console.log("[Channel] Helius connected, stopping fast polling");
      stopPolling();
    } else {
      // No Helius - use fast polling (3s)
      console.log("[Channel] No Helius connection, using 3s polling");
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [channelId, channelPda, heliusConnected, startPolling, stopPolling]);

  // Reset fetch flag when channel changes
  useEffect(() => {
    hasFetchedMessages.current = false;
  }, [channelId]);

  const loadChannelData = async () => {
    try {
      const pda = new PublicKey(channelId);
      const channelData = await fetchChannel(pda);
      setChannel(channelData);

      if (channelData) {
        const memberData = await checkMembership(pda);
        setMembership(memberData);
      }
    } catch (err) {
      console.error("Failed to load channel:", err);
    }
  };

  const handleJoin = async () => {
    if (!channel) return;

    setJoining(true);
    try {
      const result = await joinChannel(channel.publicKey);
      console.log("Join successful:", result);

      // Wait a bit for the blockchain state to update
      await new Promise(resolve => setTimeout(resolve, 2000));

      await loadChannelData();
    } catch (err) {
      console.error("Failed to join channel:", err);
      alert(`Failed to join: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setJoining(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channel || !newMessage.trim() || !publicKey) return;

    setSending(true);
    try {
      // Add message locally for immediate feedback and get the CID
      const cid = await addLocalMessage(
        newMessage.trim(),
        publicKey.toString(),
        channelId
      );

      // Log message on-chain with the IPFS CID
      await logMessage(channel.publicKey, newMessage.trim(), cid);

      setNewMessage("");
      await loadChannelData(); // Refresh message count

      // Refresh messages from chain after a delay
      setTimeout(() => {
        fetchChannelMessages();
      }, 3000);
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  if (loading && !channel) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <div className="text-gray-400">Loading channel...</div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <h2 className="text-xl font-bold mb-2">Channel Not Found</h2>
          <p className="text-gray-400">
            This channel doesn&apos;t exist or has been deleted.
          </p>
        </div>
      </div>
    );
  }

  const channelName = new TextDecoder().decode(
    new Uint8Array(channel.account.encryptedMetadata)
  );
  const channelType = parseChannelType(channel.account.channelType);
  const isOwner = publicKey?.equals(channel.account.owner);
  const isMember = membership?.account.isActive;
  // Owner is treated as implicit member - can access without explicit Member account
  const canAccess = isOwner || isMember;

  return (
    <div className="flex-1 flex flex-col bg-gray-900">
      {/* Channel Header */}
      <div className="bg-gray-800/50 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <span className="text-lg">#</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">
                {channelName || "Unnamed Channel"}
              </h1>
              <div className="flex items-center space-x-2 text-sm text-gray-400">
                <span>{channelType}</span>
                <span>•</span>
                <span>{channel.account.memberCount} members</span>
                <span>•</span>
                <span>{channel.account.messageCount.toString()} messages</span>
                {isOwner && (
                  <>
                    <span>•</span>
                    <span className="text-purple-400">Owner</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Channel Actions */}
          <div className="flex items-center space-x-2">
            {canAccess && (
              <button
                onClick={() => fetchChannelMessages()}
                disabled={messagesLoading}
                className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {messagesLoading ? "Loading..." : "Refresh"}
              </button>
            )}
            {!canAccess && (
              <button
                onClick={handleJoin}
                disabled={joining}
                className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {joining ? "Joining..." : "Join Channel"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!canAccess ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-4xl mb-4">🔒</div>
              <h2 className="text-xl font-bold mb-2">Join to View Messages</h2>
              <p className="text-gray-400 mb-4">
                You need to join this channel to see messages and participate.
              </p>
              <button
                onClick={handleJoin}
                disabled={joining}
                className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
              >
                {joining ? "Joining..." : "Join Channel"}
              </button>
            </div>
          </div>
        ) : messagesLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <div className="text-4xl mb-4">💬</div>
              <p>No messages yet. Start the conversation!</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
      </div>

      {/* Message Input */}
      {canAccess && (
        <div className="bg-gray-800/50 border-t border-gray-700 p-4">
          {isMember ? (
            <>
              <form onSubmit={handleSendMessage} className="flex space-x-4">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? "..." : "Send"}
                </button>
              </form>

              {error && (
                <div className="mt-2 text-sm text-red-400">{error}</div>
              )}

              <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <p>Messages are encrypted with Arcium and stored on IPFS.</p>
                <div className="flex items-center space-x-2">
                  {heliusAvailable ? (
                    <span className={`flex items-center ${heliusConnected ? 'text-green-400' : 'text-yellow-400'}`}>
                      <span className={`w-2 h-2 rounded-full mr-1 ${heliusConnected ? 'bg-green-400' : 'bg-yellow-400'}`}></span>
                      {heliusConnected ? 'Real-time' : 'Connecting...'}
                    </span>
                  ) : (
                    <span className="flex items-center text-gray-500">
                      <span className="w-2 h-2 rounded-full mr-1 bg-gray-500"></span>
                      Polling
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-2">
              <p className="text-gray-400 mb-3">
                Join the channel to send messages
              </p>
              <button
                onClick={handleJoin}
                disabled={joining}
                className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
              >
                {joining ? "Joining..." : "Join to Send Messages"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const timestamp = new Date(message.timestamp);
  return (
    <div className="flex items-start space-x-3">
      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-sm">
        {message.sender[0]}
      </div>
      <div className="flex-1">
        <div className="flex items-baseline space-x-2">
          <span className="font-medium">{message.sender}...</span>
          <span className="text-xs text-gray-500">
            {timestamp.toLocaleTimeString()}
          </span>
        </div>
        <p className="text-gray-300 mt-1">{message.content}</p>
      </div>
    </div>
  );
}

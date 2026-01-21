"use client";

import { useState, useEffect } from "react";
import { useInvites, EXPIRY_OPTIONS, USAGE_OPTIONS, InviteWithMeta } from "@/hooks/useInvites";
import { ChannelAccount } from "@/lib/anchor";

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelPda: string;
  channel: ChannelAccount;
  isOwner: boolean;
}

export function InviteModal({
  isOpen,
  onClose,
  channelPda,
  channel,
  isOwner,
}: InviteModalProps) {
  const {
    loading,
    error,
    canCreateInvite,
    createChannelInvite,
    revokeChannelInvite,
    listInvites,
    getInviteUrl,
  } = useInvites();

  const [invites, setInvites] = useState<InviteWithMeta[]>([]);
  const [maxUses, setMaxUses] = useState<keyof typeof USAGE_OPTIONS>("10");
  const [expiresIn, setExpiresIn] = useState<keyof typeof EXPIRY_OPTIONS>("7d");
  const [copied, setCopied] = useState(false);
  const [newInvite, setNewInvite] = useState<{ code: string; url: string } | null>(null);

  const canInvite = canCreateInvite(channel, isOwner);

  // Load existing invites
  useEffect(() => {
    if (isOpen && channelPda) {
      listInvites(channelPda).then(setInvites);
    }
  }, [isOpen, channelPda, listInvites]);

  if (!isOpen) return null;

  const handleCreateInvite = async () => {
    const invite = await createChannelInvite(channelPda, { maxUses, expiresIn });
    if (invite) {
      const url = getInviteUrl(invite.code);
      setNewInvite({ code: invite.code, url });
      // Refresh invite list
      const updated = await listInvites(channelPda);
      setInvites(updated);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    const success = await revokeChannelInvite(inviteId);
    if (success) {
      const updated = await listInvites(channelPda);
      setInvites(updated);
    }
  };

  // Decode channel name from metadata
  const channelName = channel.encryptedMetadata
    ? new TextDecoder().decode(new Uint8Array(channel.encryptedMetadata))
    : "Channel";

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold">Invite to {channelName}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
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

        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Permission check */}
          {!canInvite && (
            <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-3 text-sm text-yellow-300">
              Only the channel owner can create invites for private channels.
            </div>
          )}

          {/* New invite created */}
          {newInvite && (
            <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-green-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">Invite Created!</span>
              </div>

              <div className="space-y-2">
                <div className="text-sm text-gray-400">Code:</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-900 px-3 py-2 rounded text-lg font-mono text-white">
                    {newInvite.code}
                  </code>
                  <button
                    onClick={() => handleCopy(newInvite.code)}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm text-gray-400">Link:</div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={newInvite.url}
                    className="flex-1 bg-gray-900 px-3 py-2 rounded text-sm text-gray-300 truncate"
                  />
                  <button
                    onClick={() => handleCopy(newInvite.url)}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded transition-colors"
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Create new invite */}
          {canInvite && (
            <div className="space-y-4">
              <div className="text-sm font-medium text-gray-300">Create New Invite</div>

              <div className="grid grid-cols-2 gap-4">
                {/* Max uses */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max Uses</label>
                  <select
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value as keyof typeof USAGE_OPTIONS)}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                  >
                    <option value="1">1 use</option>
                    <option value="5">5 uses</option>
                    <option value="10">10 uses</option>
                    <option value="25">25 uses</option>
                    <option value="unlimited">Unlimited</option>
                  </select>
                </div>

                {/* Expiration */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Expires</label>
                  <select
                    value={expiresIn}
                    onChange={(e) => setExpiresIn(e.target.value as keyof typeof EXPIRY_OPTIONS)}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                  >
                    <option value="1h">1 hour</option>
                    <option value="24h">24 hours</option>
                    <option value="7d">7 days</option>
                    <option value="never">Never</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleCreateInvite}
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium py-2 rounded-lg transition-all disabled:opacity-50"
              >
                {loading ? "Creating..." : "Generate Invite"}
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Existing invites */}
          {invites.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-300 flex items-center justify-between">
                <span>Active Invites</span>
                <span className="text-xs text-gray-500">{invites.filter(i => i.is_active && !i.isExpired && !i.isMaxedOut).length} active</span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {invites.map((invite) => {
                  const isValid = invite.is_active && !invite.isExpired && !invite.isMaxedOut;

                  return (
                    <div
                      key={invite.id}
                      className={`bg-gray-900 rounded-lg p-3 ${!isValid ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <code className="font-mono text-sm">{invite.code}</code>
                        <div className="flex items-center gap-2">
                          {isValid && (
                            <button
                              onClick={() => handleCopy(getInviteUrl(invite.code))}
                              className="text-xs text-purple-400 hover:text-purple-300"
                            >
                              Copy
                            </button>
                          )}
                          {invite.is_active && (
                            <button
                              onClick={() => invite.id && handleRevoke(invite.id)}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>{invite.usesRemainingText}</span>
                        {invite.expiresInText && <span>Expires in {invite.expiresInText}</span>}
                        {invite.isExpired && <span className="text-red-400">Expired</span>}
                        {invite.isMaxedOut && <span className="text-yellow-400">Max uses reached</span>}
                        {!invite.is_active && <span className="text-gray-400">Revoked</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default InviteModal;

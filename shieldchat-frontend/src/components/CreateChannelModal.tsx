"use client";

import { useState } from "react";
import { useShieldChat } from "@/hooks/useShieldChat";

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateChannelModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateChannelModalProps) {
  const { createChannel, loading, error } = useShieldChat();
  const [name, setName] = useState("");
  const [type, setType] = useState("privateGroup");
  const [localError, setLocalError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!name.trim()) {
      setLocalError("Channel name is required");
      return;
    }

    try {
      await createChannel(name.trim(), type);
      setName("");
      setType("privateGroup");
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Failed to create channel:", err);
      setLocalError(error || "Failed to create channel");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold">Create Channel</h2>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Channel Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Channel Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter channel name"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
              maxLength={100}
            />
          </div>

          {/* Channel Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Channel Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <TypeOption
                value="privateGroup"
                label="Private Group"
                icon="🔒"
                description="Invite-only"
                selected={type === "privateGroup"}
                onSelect={setType}
              />
              <TypeOption
                value="public"
                label="Public"
                icon="🌐"
                description="Anyone can join"
                selected={type === "public"}
                onSelect={setType}
              />
              <TypeOption
                value="directMessage"
                label="Direct Message"
                icon="💬"
                description="1-on-1 chat"
                selected={type === "directMessage"}
                onSelect={setType}
              />
              <TypeOption
                value="tokenGated"
                label="Token Gated"
                icon="🎫"
                description="NFT/Token holders"
                selected={type === "tokenGated"}
                onSelect={setType}
              />
            </div>
          </div>

          {/* Error Message */}
          {(localError || error) && (
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-sm text-red-300">
              {localError || error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating..." : "Create Channel"}
          </button>
        </form>
      </div>
    </div>
  );
}

function TypeOption({
  value,
  label,
  icon,
  description,
  selected,
  onSelect,
}: {
  value: string;
  label: string;
  icon: string;
  description: string;
  selected: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`p-3 rounded-lg border text-left transition-all ${
        selected
          ? "border-purple-500 bg-purple-500/20"
          : "border-gray-700 bg-gray-900/50 hover:border-gray-600"
      }`}
    >
      <div className="text-xl mb-1">{icon}</div>
      <div className="font-medium text-sm">{label}</div>
      <div className="text-xs text-gray-500">{description}</div>
    </button>
  );
}

export default CreateChannelModal;

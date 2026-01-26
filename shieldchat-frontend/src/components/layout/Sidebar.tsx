"use client";

import Link from "next/link";
import { useStore } from "@/stores";
import { GlassButton } from "@/components/ui";
import { ChannelList } from "@/components/ChannelList";
import { PrivyLoginButton } from "@/components/PrivyLoginButton";

interface SidebarProps {
  onCreateChannel: () => void;
  refreshKey?: number;
}

export function Sidebar({ onCreateChannel, refreshKey = 0 }: SidebarProps) {
  const publicKey = useStore((state) => state.user.publicKey);
  const setSidebarOpen = useStore((state) => state.setSidebarOpen);

  // Format wallet address
  const formatWallet = (key: typeof publicKey) => {
    if (!key) return "";
    const str = key.toString();
    return `${str.slice(0, 4)}...${str.slice(-4)}`;
  };

  const handleCopyAddress = async () => {
    if (!publicKey) return;
    try {
      await navigator.clipboard.writeText(publicKey.toString());
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo Header */}
      <div className="shrink-0 p-4 border-b border-white/[0.06]">
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="relative w-10 h-10 flex items-center justify-center">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-[color:var(--accent-primary)]/20 rounded-xl blur-md group-hover:bg-[color:var(--accent-primary)]/30 transition-all" />
            <div className="relative w-10 h-10 bg-[linear-gradient(to_bottom_right,var(--accent-gradient-from),var(--accent-gradient-to))] rounded-xl flex items-center justify-center shadow-lg">
              <svg
                className="w-5 h-5 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
          </div>
          <div>
            <span className="text-lg font-semibold font-display block text-white group-hover:[color:var(--accent-hover)] transition-colors">
              ShieldChat
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-xs text-gray-500">Connected</span>
            </div>
          </div>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="shrink-0 p-3 border-b border-white/[0.06]">
        <GlassButton
          variant="primary"
          glow
          className="w-full"
          onClick={() => {
            onCreateChannel();
            setSidebarOpen(false);
          }}
          icon={
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
          }
        >
          New Channel
        </GlassButton>
      </div>

      {/* Channel List */}
      <div className="flex-1 overflow-y-auto min-h-0" key={refreshKey}>
        <ChannelList
          onCreateChannel={() => {
            onCreateChannel();
            setSidebarOpen(false);
          }}
        />
      </div>

      {/* User Section */}
      <div className="shrink-0 p-4 border-t border-white/[0.06] glass-dark">
        <div className="flex items-center gap-3 mb-3">
          <div className="relative">
            <div className="w-10 h-10 bg-[linear-gradient(to_bottom_right,var(--accent-gradient-from),var(--accent-gradient-to))] rounded-full flex items-center justify-center text-sm font-bold text-white shadow-lg">
              {publicKey?.toString()[0] || "?"}
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#12121a] rounded-full" />
          </div>
          <div className="flex-1 min-w-0">
            <button
              onClick={handleCopyAddress}
              className="flex items-center gap-1.5 font-medium text-sm truncate hover:[color:var(--accent-hover)] transition-colors cursor-pointer group"
              title="Click to copy full address"
            >
              {formatWallet(publicKey)}
              <svg
                className="w-3.5 h-3.5 text-gray-500 group-hover:[color:var(--accent-hover)] shrink-0 transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
            <div className="text-xs text-gray-500">Online</div>
          </div>
        </div>
        <PrivyLoginButton className="w-full justify-center glass-card hover:bg-white/[0.05] rounded-xl py-2.5 text-sm border border-white/[0.1] text-white transition-all" />
      </div>
    </div>
  );
}

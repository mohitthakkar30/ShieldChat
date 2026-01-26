"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useStore } from "@/stores";
import { useWallet } from "@/hooks/usePrivyAnchorWallet";
import { PrivyLoginButton } from "@/components/PrivyLoginButton";
import { CreateChannelModal } from "@/components/CreateChannelModal";
import { Sidebar } from "./Sidebar";
import { NotificationProvider } from "@/contexts/NotificationContext";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { connected, publicKey } = useWallet();
  const sidebarOpen = useStore((state) => state.ui.sidebarOpen);
  const setSidebarOpen = useStore((state) => state.setSidebarOpen);
  const setUser = useStore((state) => state.setUser);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Sync wallet state to store so all components can access it
  useEffect(() => {
    setUser(publicKey, connected);
  }, [publicKey, connected, setUser]);

  // Format wallet address
  const formatWallet = (key: typeof publicKey) => {
    if (!key) return "";
    const str = key.toString();
    return `${str.slice(0, 4)}...${str.slice(-4)}`;
  };

  // If not connected, show connect prompt
  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center particle-bg">
        {/* Background gradient orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-[color:var(--accent-primary)]/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/3 right-1/3 w-[400px] h-[400px] bg-[color:var(--accent-secondary)]/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative text-center max-w-md px-6 animate-float-up">
          {/* Logo */}
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 bg-[color:var(--accent-primary)]/20 rounded-2xl blur-lg" />
            <div className="relative w-20 h-20 bg-[linear-gradient(to_bottom_right,var(--accent-gradient-from),var(--accent-gradient-to))] rounded-2xl flex items-center justify-center shadow-2xl">
              <svg
                className="w-10 h-10 text-white"
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

          <h1 className="text-3xl font-bold mb-3 font-display">
            Welcome to <span className="text-gradient-accent">ShieldChat</span>
          </h1>
          <p className="text-gray-400 mb-8 leading-relaxed">
            Connect your Solana wallet to access private, encrypted messaging.
          </p>

          <PrivyLoginButton className="w-full bg-[linear-gradient(to_right,var(--accent-gradient-from),var(--accent-gradient-to))] hover:brightness-110 rounded-xl py-3 px-8 font-semibold shadow-lg glow-accent-hover text-white transition-all" />

          {/* Trust badges */}
          <div className="mt-8 flex items-center justify-center gap-6 text-gray-500 text-xs">
            <div className="flex items-center gap-1.5">
              <svg
                className="w-3.5 h-3.5 text-emerald-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <span>Encrypted</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg
                className="w-3.5 h-3.5 [color:var(--accent-primary)]"
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
              <span>Decentralized</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg
                className="w-3.5 h-3.5 text-cyan-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <span>Fast</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <NotificationProvider>
    <div className="h-screen flex flex-col md:flex-row overflow-hidden particle-bg">
      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 glass border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-[linear-gradient(to_bottom_right,var(--accent-gradient-from),var(--accent-gradient-to))] rounded-lg flex items-center justify-center shadow-lg">
            <svg
              className="w-4 h-4 text-white"
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
          <span className="font-bold font-display">ShieldChat</span>
        </Link>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-white/[0.05] transition-colors"
        >
          {sidebarOpen ? (
            <svg
              className="w-6 h-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              className="w-6 h-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          )}
        </button>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-40
          w-72 md:h-screen
          glass-dark border-r border-white/[0.06]
          flex flex-col
          transform transition-transform duration-300 ease-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
          pt-16 md:pt-0
        `}
      >
        <Sidebar
          onCreateChannel={() => setShowCreateModal(true)}
          refreshKey={refreshKey}
        />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 pt-14 md:pt-0 pb-20 md:pb-0">
        {children}
      </main>

      {/* Mobile Fixed Footer - Wallet Section */}
      <footer className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="w-10 h-10 bg-[linear-gradient(to_bottom_right,var(--accent-gradient-from),var(--accent-gradient-to))] rounded-full flex items-center justify-center text-sm font-bold text-white shadow-lg">
              {publicKey?.toString()[0] || "?"}
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#12121a] rounded-full" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">
              {formatWallet(publicKey)}
            </div>
            <div className="text-xs text-gray-500">Online</div>
          </div>
          <PrivyLoginButton className="glass-card hover:bg-white/[0.05] rounded-xl py-2 px-4 text-sm border border-white/[0.1] text-white transition-all" />
        </div>
      </footer>

      {/* Create Channel Modal */}
      <CreateChannelModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          setRefreshKey((k) => k + 1);
        }}
      />
    </div>
    </NotificationProvider>
  );
}

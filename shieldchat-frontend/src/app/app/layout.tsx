"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChannelList } from "@/components/ChannelList";
import { CreateChannelModal } from "@/components/CreateChannelModal";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { connected } = useWallet();
  const pathname = usePathname();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // If not connected, show connect prompt
  if (!connected) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl font-bold">S</span>
          </div>
          <h1 className="text-2xl font-bold mb-4">Connect to ShieldChat</h1>
          <p className="text-gray-400 mb-8">
            Connect your wallet to access private messaging
          </p>
          <WalletMultiButton className="!bg-gradient-to-r !from-purple-600 !to-pink-600 hover:!from-purple-700 hover:!to-pink-700 !rounded-lg !py-3 !px-6" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Sidebar */}
      <aside className="w-72 bg-gray-800/50 border-r border-gray-700 flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-gray-700">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <span className="text-sm font-bold">S</span>
            </div>
            <span className="text-lg font-bold">ShieldChat</span>
          </Link>
        </div>

        {/* Channel List */}
        <div className="flex-1 overflow-hidden" key={refreshKey}>
          <ChannelList onCreateChannel={() => setShowCreateModal(true)} />
        </div>

        {/* User Section */}
        <div className="p-4 border-t border-gray-700">
          <WalletMultiButton className="!w-full !justify-center !bg-gray-700 hover:!bg-gray-600 !rounded-lg !py-2 !text-sm" />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">{children}</main>

      {/* Create Channel Modal */}
      <CreateChannelModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}

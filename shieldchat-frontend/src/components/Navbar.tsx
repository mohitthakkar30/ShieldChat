"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function Navbar() {
  const { publicKey } = useWallet();

  return (
    <nav className="bg-gray-800/50 backdrop-blur-lg border-b border-gray-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <span className="text-sm font-bold">S</span>
            </div>
            <span className="text-lg font-bold">ShieldChat</span>
          </Link>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {publicKey && (
              <span className="text-sm text-gray-400">
                {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
              </span>
            )}
            <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !rounded-lg !py-2 !px-4 !text-sm" />
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;

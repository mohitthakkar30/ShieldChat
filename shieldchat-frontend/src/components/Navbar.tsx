"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function Navbar() {
  const { publicKey } = useWallet();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#030712]/80 backdrop-blur-md border-b border-gray-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="relative w-9 h-9 flex items-center justify-center">
              {/* Shield icon with emerald glow */}
              <div className="absolute inset-0 bg-emerald-500/20 rounded-lg blur-md group-hover:bg-emerald-500/30 transition-all" />
              <svg
                className="relative w-6 h-6 text-emerald-400"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
              </svg>
            </div>
            <span className="text-lg font-semibold text-gray-100 group-hover:text-emerald-400 transition-colors font-display">
              ShieldChat
            </span>
          </Link>

          {/* Center Nav Links */}
          <div className="hidden md:flex items-center space-x-8">
            <a
              href="#features"
              className="text-sm text-gray-400 hover:text-emerald-400 transition-colors"
            >
              Features
            </a>
            <a
              href="#tech-stack"
              className="text-sm text-gray-400 hover:text-emerald-400 transition-colors"
            >
              Tech Stack
            </a>
            <a
              href="#security"
              className="text-sm text-gray-400 hover:text-emerald-400 transition-colors"
            >
              Security
            </a>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {publicKey && (
              <span className="hidden sm:block text-xs font-mono text-gray-500 bg-gray-900/50 px-3 py-1.5 rounded border border-gray-800">
                {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
              </span>
            )}
            <WalletMultiButton className="!bg-emerald-600 hover:!bg-emerald-500 !rounded-lg !py-2 !px-4 !text-sm !font-medium !transition-all hover:!shadow-[0_0_20px_rgba(16,185,129,0.3)]" />
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;

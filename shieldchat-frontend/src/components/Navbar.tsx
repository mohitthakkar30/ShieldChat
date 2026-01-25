"use client";

import { useState } from "react";
import Link from "next/link";
import { useWallet } from "@/hooks/usePrivyAnchorWallet";
import { PrivyLoginButton } from "@/components/PrivyLoginButton";

export function Navbar() {
  const { publicKey } = useWallet();
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = async () => {
    if (!publicKey) return;
    try {
      await navigator.clipboard.writeText(publicKey.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

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
              <button
                onClick={handleCopyAddress}
                className="hidden sm:flex items-center gap-2 text-xs font-mono text-gray-500 bg-gray-900/50 px-3 py-1.5 rounded border border-gray-800 hover:border-emerald-500/50 hover:text-gray-400 transition-all cursor-pointer"
                title="Click to copy full address"
              >
                {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
                {copied ? (
                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            )}
            <PrivyLoginButton className="bg-emerald-600 hover:bg-emerald-500 rounded-lg py-2 px-4 text-sm font-medium transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] text-white" />
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;

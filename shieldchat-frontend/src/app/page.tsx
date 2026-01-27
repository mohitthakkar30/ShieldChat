"use client";

import { useWallet } from "@/hooks/usePrivyAnchorWallet";
import { PrivyLoginButton } from "@/components/PrivyLoginButton";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const { connected } = useWallet();

  return (
    <div className="min-h-screen bg-[#030712] noise-overlay">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#030712]/80 backdrop-blur-md border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center space-x-3 group">
              <div className="relative w-10 h-10 flex items-center justify-center">
                <div className="absolute inset-0 bg-emerald-500/20 rounded-lg blur-md group-hover:bg-emerald-500/30 transition-all" />
                <svg className="relative w-6 h-6 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
                </svg>
              </div>
              <span className="text-xl font-semibold text-gray-100 group-hover:text-emerald-400 transition-colors font-display">
                ShieldChat
              </span>
            </div>

            {/* Nav Links */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-400 hover:text-emerald-400 transition-colors text-sm">Features</a>
              <a href="#tech-stack" className="text-gray-400 hover:text-emerald-400 transition-colors text-sm">Tech Stack</a>
              <a href="#security" className="text-gray-400 hover:text-emerald-400 transition-colors text-sm">Security</a>
            </div>

            {/* CTA */}
            <PrivyLoginButton className="bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm py-2 px-4 font-medium hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all text-white" />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center overflow-hidden pt-20">
        {/* Subtle grid background */}
        <div className="absolute inset-0 grid-bg opacity-50" />

        {/* Gradient orb - subtle, not overwhelming */}
        <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[120px]" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <div className="space-y-8">
              {/* Badge */}
              <div className="inline-flex items-center px-3 py-1.5 rounded border border-emerald-500/30 bg-emerald-500/5">
                <span className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse" />
                <span className="text-xs font-mono text-emerald-400">LIVE ON SOLANA DEVNET</span>
              </div>

              {/* Main headline */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight font-display">
                <span className="text-gray-100">Your messages.</span>
                <br />
                <span className="text-gradient-emerald">Your keys.</span>
                <br />
                <span className="text-gray-100">Your privacy. </span>
              </h1>

              <p className="text-lg text-gray-400 max-w-lg leading-relaxed">
                End-to-end encrypted messaging on Solana.
                <span className="text-emerald-400"> Token-gated communities</span>,
                <span className="text-cyan-400"> private payments</span>, and
                <span className="text-violet-400"> anonymous voting</span>.
              </p>

              {/* Trust badges - terminal style */}
              <div className="flex flex-wrap gap-3">
                <span className="badge-terminal active">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                  MPC
                </span>
                <span className="badge-terminal active">
                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                  ZK-PROOFS
                </span>
                <span className="badge-terminal active">
                  <span className="w-1.5 h-1.5 bg-violet-400 rounded-full" />
                  FHE
                </span>
                <span className="badge-terminal">
                  400ms FINALITY
                </span>
              </div>

              {/* CTA buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                {connected ? (
                  <Link
                    href="/app"
                    className="btn-primary text-center glow-emerald-hover"
                  >
                    Launch App
                  </Link>
                ) : (
                  <PrivyLoginButton className="bg-emerald-500 hover:bg-emerald-400 rounded-lg py-3 px-6 text-base font-semibold text-[#030712] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all" />
                )}
                <a href="#features" className="btn-outline text-center">
                  Explore Features
                </a>
              </div>
            </div>

            {/* Right: Terminal Animation */}
            <div className="hidden lg:block">
              <TerminalDemo />
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section id="tech-stack" className="py-24 border-t border-gray-800/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-mono text-emerald-400 mb-4 block">THE STACK</span>
            <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">
              Built on <span className="text-gradient-emerald">Cutting-Edge</span> Technology
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Every layer designed for privacy, speed, and decentralization.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <TechCard
              name="Solana"
              description="L1 Blockchain"
              icon="S"
              color="bg-gradient-to-br from-[#9945FF] to-[#14F195]"
            />
            <TechCard
              name="Arcium"
              description="MPC Encryption"
              icon="A"
              color="bg-gradient-to-br from-emerald-500 to-teal-600"
            />
            <TechCard
              name="Inco"
              description="FHE Voting"
              icon="I"
              color="bg-gradient-to-br from-violet-500 to-purple-600"
            />
            <TechCard
              name="ShadowWire"
              description="ZK Payments"
              icon="SW"
              color="bg-gradient-to-br from-pink-500 to-rose-600"
            />
            <TechCard
              name="Helius"
              description="Real-time On-chain Data"
              icon="H"
              color="bg-gradient-to-br from-orange-500 to-amber-600"
            />
            <TechCard
              name="IPFS"
              description="Storage"
              icon="IP"
              color="bg-gradient-to-br from-teal-500 to-emerald-600"
            />
          </div>
        </div>
      </section>

      {/* Features Section - Bento Grid */}
      <section id="features" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-mono text-emerald-400 mb-4 block">FEATURES</span>
            <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">
              Everything You Need for <span className="text-gradient-emerald">Private</span> Communication
            </h2>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Large card - Encryption */}
            <div className="lg:col-span-2 card-terminal p-8 group hover:border-emerald-500/30 transition-all">
              <div className="flex items-start gap-6">
                <div className="w-14 h-14 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2 font-display">End-to-End Encryption</h3>
                  <p className="text-gray-400 mb-4">
                    Every message encrypted with Arcium&apos;s MPC technology before leaving your device.
                    RescueCipher + x25519 key exchange ensures not even ShieldChat can read your conversations.
                  </p>
                  <div className="font-mono text-xs text-emerald-400/70">
                    <span className="text-gray-500">&gt;</span> encrypt(message, channelKey) <span className="text-emerald-400">✓</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Token-Gated */}
            <div className="card-terminal p-6 group hover:border-amber-500/30 transition-all">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display">Token-Gated Channels</h3>
              <p className="text-gray-400 text-sm">
                Create exclusive communities for NFT holders or token communities. Membership verified on-chain with staking.
              </p>
            </div>

            {/* Private Payments */}
            <div className="card-terminal p-6 group hover:border-pink-500/30 transition-all">
              <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400 mb-4">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display">Private Payments</h3>
              <p className="text-gray-400 text-sm">
                Send SOL, USDC, BONK directly in chat. ShadowWire&apos;s Bulletproof ZK proofs hide amounts and recipients.
              </p>
            </div>

            {/* Anonymous Voting */}
            <div className="card-terminal p-6 group hover:border-violet-500/30 transition-all">
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400 mb-4">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2 font-display">Anonymous Voting</h3>
              <p className="text-gray-400 text-sm">
                Create polls with Inco Lightning FHE. Votes encrypted until reveal - no vote buying or coercion possible.
              </p>
            </div>

            {/* Large card - Real-time */}
            <div className="lg:col-span-2 card-terminal p-8 group hover:border-cyan-500/30 transition-all">
              <div className="flex items-start gap-6">
                <div className="w-14 h-14 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2 font-display">Real-Time Everything</h3>
                  <p className="text-gray-400 mb-4">
                    Sub-second message delivery via Helius WebSockets. Real-time presence, typing indicators,
                    and read receipts powered by WebSocket server.
                  </p>
                  <div className="flex gap-4 text-sm">
                    <span className="text-cyan-400 font-mono">&lt;1s delivery</span>
                    <span className="text-gray-500">|</span>
                    <span className="text-cyan-400 font-mono">live presence</span>
                    <span className="text-gray-500">|</span>
                    <span className="text-cyan-400 font-mono">read receipts</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 border-t border-gray-800/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-mono text-emerald-400 mb-4 block">HOW IT WORKS</span>
            <h2 className="text-3xl md:text-4xl font-bold font-display">
              Three Steps to <span className="text-gradient-emerald">Privacy</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connection line */}
            <div className="hidden md:block absolute top-16 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

            <StepCard
              step={1}
              title="Connect Wallet"
              description="Your Solana wallet is your identity. Just connect and you're in."
            />
            <StepCard
              step={2}
              title="Join or Create"
              description="Browse public channels, join token-gated communities with your tokens, or create private groups."
            />
            <StepCard
              step={3}
              title="Chat Securely"
              description="Every message encrypted. Send payments. Create polls. All private, all on-chain."
            />
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="py-24 border-t border-gray-800/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Security Architecture */}
            <div>
              <span className="text-xs font-mono text-emerald-400 mb-4 block">SECURITY</span>
              <h2 className="text-3xl md:text-4xl font-bold font-display mb-6">
                Under the <span className="text-gradient-emerald">Hood</span>
              </h2>
              <p className="text-gray-400 mb-8">
                Battle-tested cryptography at every layer. No central servers to hack.
                Your messages, your keys, your privacy.
              </p>

              {/* Terminal-style security breakdown */}
              <div className="card-terminal p-6 font-mono text-sm space-y-4">
                <div className="text-gray-500">// SECURITY ARCHITECTURE</div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-emerald-400">&#9656;</span>
                    <div>
                      <span className="text-gray-200">Arcium MPC Encryption</span>
                      <div className="text-gray-500 text-xs mt-1">RescueCipher + x25519 key exchange</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="text-pink-400">&#9656;</span>
                    <div>
                      <span className="text-gray-200">Zero-Knowledge Payments</span>
                      <div className="text-gray-500 text-xs mt-1">Bulletproof proofs hide amounts</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="text-violet-400">&#9656;</span>
                    <div>
                      <span className="text-gray-200">Homomorphic Voting</span>
                      <div className="text-gray-500 text-xs mt-1">FHE keeps votes encrypted until reveal</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="text-cyan-400">&#9656;</span>
                    <div>
                      <span className="text-gray-200">Decentralized Storage</span>
                      <div className="text-gray-500 text-xs mt-1">IPFS + Solana for permanence</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Stats */}
            <div className="grid grid-cols-2 gap-6">
              <StatCard value="<1s" label="Message Delivery" />
              <StatCard value="256-bit" label="Encryption" />
              <StatCard value="$0" label="Message Fees" />
              <StatCard value="100%" label="Decentralized" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 border-t border-gray-800/50">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="card-terminal p-12 relative overflow-hidden">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-cyan-500/5" />

            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">
                Ready to Go <span className="text-gradient-emerald">Dark</span>?
              </h2>
              <p className="text-gray-400 mb-8 max-w-lg mx-auto">
                Join the future of private, decentralized communication.
                Your messages belong to you.
              </p>

              {connected ? (
                <Link
                  href="/app"
                  className="inline-block btn-primary text-lg glow-emerald"
                >
                  Launch ShieldChat
                </Link>
              ) : (
                <PrivyLoginButton className="bg-emerald-500 hover:bg-emerald-400 rounded-lg py-4 px-8 text-lg font-semibold text-[#030712] shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] transition-all" />
              )}

              <div className="mt-8 flex items-center justify-center gap-2 text-gray-500 text-sm font-mono">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span>Solana Devnet</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-800/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            {/* Brand */}
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="relative w-8 h-8 flex items-center justify-center">
                  <div className="absolute inset-0 bg-emerald-500/20 rounded-lg blur-sm" />
                  <svg className="relative w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
                  </svg>
                </div>
                <span className="text-lg font-semibold font-display">ShieldChat</span>
              </div>
              <p className="text-gray-500 text-sm">
                Private messaging on Solana. Your messages, your keys, your privacy.
              </p>
            </div>

            {/* Product Links */}
            <div>
              <h4 className="font-semibold mb-4 text-gray-300">Product</h4>
              <ul className="space-y-2 text-gray-500 text-sm">
                <li><a href="#features" className="hover:text-emerald-400 transition-colors">Features</a></li>
                <li><a href="#security" className="hover:text-emerald-400 transition-colors">Security</a></li>
                <li><a href="#tech-stack" className="hover:text-emerald-400 transition-colors">Tech Stack</a></li>
              </ul>
            </div>

            {/* Developer Links */}
            <div>
              <h4 className="font-semibold mb-4 text-gray-300">Developers</h4>
              <ul className="space-y-2 text-gray-500 text-sm">
                <li><a href="https://github.com" className="hover:text-emerald-400 transition-colors">GitHub</a></li>
                <li><a href="#" className="hover:text-emerald-400 transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-emerald-400 transition-colors">API</a></li>
              </ul>
            </div>

            {/* Social Links */}
            <div>
              <h4 className="font-semibold mb-4 text-gray-300">Connect</h4>
              <ul className="space-y-2 text-gray-500 text-sm">
                <li><a href="#" className="hover:text-emerald-400 transition-colors">Twitter</a></li>
                <li><a href="#" className="hover:text-emerald-400 transition-colors">Discord</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-8 border-t border-gray-800/50 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm font-mono">
              Program:{" "}
              <code className="text-emerald-400/70 bg-gray-900 px-2 py-1 rounded text-xs">
                FVViRGPShMjCeSF3LDrp2qDjp6anRz9WAMiJrsGCRUzN
              </code>
            </p>
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <span>Built on</span>
              <span className="text-[#14F195] font-semibold">Solana</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Terminal Demo Component
function TerminalDemo() {
  const [lines, setLines] = useState<string[]>([]);
  const terminalLines = [
    { text: "> connecting to solana...", delay: 0 },
    { text: "✓ wallet connected", delay: 600 },
    { text: "> encrypting message...", delay: 1200 },
    { text: "  key: channel_7xK...mP9", delay: 1500 },
    { text: "  cipher: RescueCipher-128", delay: 1800 },
    { text: "✓ encrypted", delay: 2200 },
    { text: "> uploading to IPFS...", delay: 2600 },
    { text: "✓ CID: Qm...7Kp", delay: 3200 },
    { text: "> broadcasting to chain...", delay: 3600 },
    { text: "✓ delivered in 0.4s", delay: 4200 },
  ];

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    terminalLines.forEach((line, index) => {
      const timer = setTimeout(() => {
        setLines(prev => [...prev, line.text]);
      }, line.delay);
      timers.push(timer);
    });

    // Loop the animation
    const resetTimer = setTimeout(() => {
      setLines([]);
    }, 6000);
    timers.push(resetTimer);

    const loopTimer = setInterval(() => {
      setLines([]);
      terminalLines.forEach((line) => {
        const timer = setTimeout(() => {
          setLines(prev => [...prev, line.text]);
        }, line.delay);
        timers.push(timer);
      });
    }, 7000);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(loopTimer);
    };
  }, []);

  return (
    <div className="card-terminal p-6 font-mono text-sm">
      {/* Terminal header */}
      <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-800">
        <div className="w-3 h-3 rounded-full bg-red-500/80" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
        <div className="w-3 h-3 rounded-full bg-green-500/80" />
        <span className="ml-2 text-gray-500 text-xs">shieldchat-terminal</span>
      </div>

      {/* Terminal content */}
      <div className="space-y-2 min-h-[280px]">
        {lines.map((line, index) => (
          <div
            key={index}
            className={`animate-terminal-line ${
              line.startsWith("✓")
                ? "text-emerald-400"
                : line.startsWith(">")
                  ? "text-gray-300"
                  : "text-gray-500"
            }`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {line}
          </div>
        ))}
        <span className="inline-block w-2 h-4 bg-emerald-400 animate-blink" />
      </div>
    </div>
  );
}

// Tech Card Component
function TechCard({
  name,
  description,
  icon,
  color,
}: {
  name: string;
  description: string;
  icon: string;
  color: string;
}) {
  return (
    <div className="tech-card text-center group">
      <div className={`w-12 h-12 mx-auto rounded-xl ${color} flex items-center justify-center text-white font-bold text-sm mb-3 group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <div className="font-semibold text-sm text-gray-200">{name}</div>
      <div className="text-xs text-gray-500">{description}</div>
    </div>
  );
}

// Step Card Component
function StepCard({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="relative text-center">
      {/* Step number */}
      <div className="w-12 h-12 mx-auto mb-6 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
        <span className="text-emerald-400 font-mono font-bold">{step}</span>
      </div>
      <h3 className="text-xl font-semibold mb-3 font-display">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  );
}

// Stat Card Component
function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="card-terminal p-6 text-center">
      <div className="text-3xl md:text-4xl font-bold font-mono text-gradient-emerald mb-2">
        {value}
      </div>
      <div className="text-gray-500 text-sm">{label}</div>
    </div>
  );
}

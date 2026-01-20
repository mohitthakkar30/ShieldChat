"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";

export default function Home() {
  const { connected } = useWallet();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Navbar */}
      <nav className="flex items-center justify-between p-6 max-w-7xl mx-auto">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <span className="text-xl font-bold">S</span>
          </div>
          <span className="text-xl font-bold">ShieldChat</span>
        </div>
        <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !rounded-lg" />
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 pt-20 pb-32">
        <div className="text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
              Private Messaging
            </span>
            <br />
            <span className="text-white">on Solana</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-12">
            End-to-end encrypted messaging with token-gated channels and private
            payment attachments. Built on Solana for speed and security.
          </p>

          {connected ? (
            <Link
              href="/app"
              className="inline-block bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-4 px-8 rounded-lg text-lg transition-all transform hover:scale-105"
            >
              Launch App
            </Link>
          ) : (
            <WalletMultiButton className="!bg-gradient-to-r !from-purple-600 !to-pink-600 hover:!from-purple-700 hover:!to-pink-700 !rounded-lg !py-4 !px-8 !text-lg !font-semibold" />
          )}
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-32">
          <FeatureCard
            icon="🔒"
            title="End-to-End Encryption"
            description="Messages encrypted client-side with MPC technology. Only members can read channel content."
          />
          <FeatureCard
            icon="🎫"
            title="Token-Gated Channels"
            description="Create exclusive channels for NFT holders or token communities. Verify ownership on-chain."
          />
          <FeatureCard
            icon="💸"
            title="Private Payments"
            description="Send private payment attachments with your messages using zero-knowledge proofs."
          />
        </div>

        {/* Bounty Targets */}
        <div className="mt-32 text-center">
          <h2 className="text-3xl font-bold mb-8">Competing for $53,000 in Bounties</h2>
          <div className="grid md:grid-cols-5 gap-4">
            <BountyCard name="Arcium" amount="$10,000" description="MPC Encryption" />
            <BountyCard name="ShadowWire" amount="$15,000" description="Private Payments" />
            <BountyCard name="Helius" amount="$5,000" description="Real-time Monitoring" />
            <BountyCard name="MagicBlock" amount="$5,000" description="Zero-fee Messages" />
            <BountyCard name="Open Track" amount="$18,000" description="Innovation Award" />
          </div>
        </div>

        {/* Tech Stack */}
        <div className="mt-32">
          <h2 className="text-3xl font-bold text-center mb-12">Built With</h2>
          <div className="flex flex-wrap justify-center gap-6">
            <TechBadge name="Solana" />
            <TechBadge name="Anchor" />
            <TechBadge name="Next.js" />
            <TechBadge name="TypeScript" />
            <TechBadge name="Tailwind CSS" />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-gray-500">
          <p>
            Program ID:{" "}
            <code className="text-purple-400 bg-gray-800 px-2 py-1 rounded">
              FVViRGPShMjCeSF3LDrp2qDjp6anRz9WAMiJrsGCRUzN
            </code>
          </p>
          <p className="mt-2">Deployed on Solana Devnet</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700 hover:border-purple-500 transition-colors">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}

function BountyCard({
  name,
  amount,
  description,
}: {
  name: string;
  amount: string;
  description: string;
}) {
  return (
    <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700">
      <div className="text-purple-400 font-bold">{amount}</div>
      <div className="font-semibold">{name}</div>
      <div className="text-sm text-gray-500">{description}</div>
    </div>
  );
}

function TechBadge({ name }: { name: string }) {
  return (
    <span className="bg-gray-800 text-gray-300 px-4 py-2 rounded-full border border-gray-700">
      {name}
    </span>
  );
}

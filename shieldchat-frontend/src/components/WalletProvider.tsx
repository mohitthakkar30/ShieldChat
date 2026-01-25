"use client";

import { FC, ReactNode } from "react";
import dynamic from "next/dynamic";
import { SolanaConnectionProvider } from "@/contexts/SolanaConnectionContext";

interface WalletProviderProps {
  children: ReactNode;
}

// Loading component shown while Privy loads
const LoadingState = () => (
  <div className="min-h-screen bg-gray-950 flex items-center justify-center">
    <div className="animate-pulse text-gray-400">Loading...</div>
  </div>
);

// Dynamically import Privy provider (client-side only to avoid hydration errors)
const PrivyProviderWrapper = dynamic(
  () => import("./PrivyProviderWrapper"),
  { ssr: false, loading: LoadingState }
);

export const WalletProvider: FC<WalletProviderProps> = ({ children }) => {
  return (
    <PrivyProviderWrapper>
      <SolanaConnectionProvider>{children}</SolanaConnectionProvider>
    </PrivyProviderWrapper>
  );
};

export default WalletProvider;

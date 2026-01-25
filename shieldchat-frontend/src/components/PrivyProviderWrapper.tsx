"use client";

import { FC, ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { RPC_ENDPOINT, WS_ENDPOINT } from "@/lib/constants";

interface PrivyProviderWrapperProps {
  children: ReactNode;
}

// Privy App ID from environment variable
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";

// Initialize Solana wallet connectors (Phantom, Solflare, etc.)
const solanaConnectors = toSolanaWalletConnectors();

const PrivyProviderWrapper: FC<PrivyProviderWrapperProps> = ({ children }) => {
  if (!PRIVY_APP_ID) {
    console.warn("NEXT_PUBLIC_PRIVY_APP_ID is not set. Privy authentication will not work.");
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // Appearance configuration
        appearance: {
          walletChainType: "solana-only",
          theme: "dark",
          accentColor: "#10b981", // Emerald color to match the app theme
        },
        // Embedded wallets configuration - create for users who login via email
        embeddedWallets: {
          solana: {
            createOnLogin: "users-without-wallets",
          },
          showWalletUIs: false
        },
        // External wallet connectors (Phantom, Solflare, etc.)
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },
        // Login methods - wallet and email
        loginMethods: ["wallet", "email"],
        // Solana RPC configuration for devnet
        solana: {
          rpcs: {
            "solana:devnet": {
              rpc: createSolanaRpc(RPC_ENDPOINT),
              rpcSubscriptions: createSolanaRpcSubscriptions(
                WS_ENDPOINT || "wss://api.devnet.solana.com"
              ),
            },
            "solana:mainnet": {
              rpc: createSolanaRpc(RPC_ENDPOINT),
              rpcSubscriptions: createSolanaRpcSubscriptions(
                WS_ENDPOINT || "wss://api.mainnet.solana.com"
              ),
            },
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
};

export default PrivyProviderWrapper;

"use client";

import { usePrivy, useLogin } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";

export interface UsePrivyLoginReturn {
  // Privy SDK ready state
  ready: boolean;

  // Authentication state
  authenticated: boolean;

  // User object from Privy
  user: ReturnType<typeof usePrivy>["user"];

  // Login function - opens Privy modal
  login: () => void;

  // Logout function
  logout: () => Promise<void>;

  // Wallet address (if connected)
  walletAddress: string | null;

  // Email (if logged in via email)
  email: string | null;
}

export function usePrivyLogin(): UsePrivyLoginReturn {
  const { ready, authenticated, user, logout } = usePrivy();
  const { login } = useLogin();
  const { wallets } = useWallets();

  // Get wallet address from connected wallet
  const walletAddress = wallets?.[0]?.address || null;

  // Get email if user logged in via email
  const email = user?.email?.address || null;

  return {
    ready,
    authenticated,
    user,
    login,
    logout,
    walletAddress,
    email,
  };
}

export default usePrivyLogin;

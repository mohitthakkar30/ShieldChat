"use client";

import { usePrivyLogin } from "@/hooks/usePrivyLogin";
import { usePrivyAnchorWallet } from "@/hooks/usePrivyAnchorWallet";

interface PrivyLoginButtonProps {
  className?: string;
}

export function PrivyLoginButton({ className }: PrivyLoginButtonProps) {
  const { ready, authenticated, login, logout, email } = usePrivyLogin();
  const { publicKey, connected } = usePrivyAnchorWallet();

  // Default styling to match the emerald theme
  const defaultClassName =
    "bg-emerald-600 hover:bg-emerald-500 rounded-lg py-2 px-4 text-sm font-medium transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] text-white";

  const buttonClassName = className || defaultClassName;

  // Show loading state while Privy initializes
  if (!ready) {
    return (
      <button className={buttonClassName} disabled>
        Loading...
      </button>
    );
  }

  // Show connected state with address/email
  if (authenticated && connected && publicKey) {
    const displayAddress = `${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}`;
    const displayText = email ? email.slice(0, 10) + "..." : displayAddress;

    return (
      <button onClick={logout} className={buttonClassName} title={publicKey.toString()}>
        {displayText}
      </button>
    );
  }

  // Show connect button
  return (
    <button onClick={login} className={buttonClassName}>
      Connect Wallet
    </button>
  );
}

// Alias for backwards compatibility with WalletMultiButton
export const WalletMultiButton = PrivyLoginButton;

export default PrivyLoginButton;

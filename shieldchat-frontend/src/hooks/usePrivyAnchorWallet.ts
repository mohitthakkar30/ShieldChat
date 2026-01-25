"use client";

import { useCallback, useMemo } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets, useSignTransaction, useSignAndSendTransaction } from "@privy-io/react-auth/solana";
import { PublicKey, Transaction, VersionedTransaction, Connection, SendOptions } from "@solana/web3.js";
import bs58 from "bs58";

// AnchorWallet interface - matches what Anchor expects
export interface AnchorWallet {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
}

export interface UsePrivyAnchorWalletReturn {
  // Core wallet state
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  disconnecting: boolean;

  // Anchor-compatible wallet object
  wallet: AnchorWallet | null;

  // Transaction methods
  signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
  signAllTransactions: <T extends Transaction | VersionedTransaction>(txs: T[]) => Promise<T[]>;
  sendTransaction: (tx: Transaction | VersionedTransaction, connection: Connection, options?: SendOptions) => Promise<string>;

  // Message signing
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}

export function usePrivyAnchorWallet(): UsePrivyAnchorWalletReturn {
  const { ready, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { signTransaction: privySignTransaction } = useSignTransaction();
  const { signAndSendTransaction: privySignAndSendTransaction } = useSignAndSendTransaction();

  // Get the first connected Solana wallet
  const connectedWallet = wallets?.[0] || null;

  // Convert wallet address to PublicKey
  const publicKey = useMemo(() => {
    if (!connectedWallet?.address) return null;
    try {
      return new PublicKey(connectedWallet.address);
    } catch {
      return null;
    }
  }, [connectedWallet?.address]);

  // Sign a single transaction
  const signTransaction = useCallback(async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
    if (!connectedWallet) {
      throw new Error("Wallet not connected");
    }

    // Serialize the transaction
    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    // Sign with Privy
    const { signedTransaction } = await privySignTransaction({
      transaction: new Uint8Array(serialized),
      wallet: connectedWallet,
    });

    // Deserialize based on transaction type
    if (tx instanceof VersionedTransaction) {
      return VersionedTransaction.deserialize(signedTransaction) as T;
    } else {
      return Transaction.from(signedTransaction) as T;
    }
  }, [connectedWallet, privySignTransaction]);

  // Sign multiple transactions
  const signAllTransactions = useCallback(async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
    if (!connectedWallet) {
      throw new Error("Wallet not connected");
    }

    // Sign each transaction sequentially
    const signedTxs: T[] = [];
    for (const tx of txs) {
      const signed = await signTransaction(tx);
      signedTxs.push(signed);
    }
    return signedTxs;
  }, [connectedWallet, signTransaction]);

  // Send a transaction with gas sponsorship (supports both legacy Transaction and VersionedTransaction)
  // Uses Privy's signAndSendTransaction with sponsor: true for gasless transactions
  const sendTransaction = useCallback(async (
    tx: Transaction | VersionedTransaction,
    connection: Connection,
    options?: SendOptions
  ): Promise<string> => {
    if (!connectedWallet) {
      throw new Error("Wallet not connected");
    }

    // Serialize the transaction
    let serialized: Uint8Array;
    if (tx instanceof VersionedTransaction) {
      serialized = tx.serialize();
    } else {
      serialized = new Uint8Array(tx.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      }));
    }

    // Sign and send with Privy using gas sponsorship on devnet
    const { signature } = await privySignAndSendTransaction({
      transaction: serialized,
      wallet: connectedWallet,
      chain: "solana:devnet", // Specify devnet chain
      options: {
        sponsor: true, // Enable gas sponsorship - Privy pays transaction fees
      },
    });

    // Convert signature bytes to base58 string
    return bs58.encode(signature);
  }, [connectedWallet, privySignAndSendTransaction]);

  // Sign a message
  const signMessage = useCallback(async (message: Uint8Array): Promise<Uint8Array> => {
    if (!connectedWallet) {
      throw new Error("Wallet not connected");
    }

    // Use the standard wallet's signMessage if available
    const standardWallet = connectedWallet.standardWallet;
    if (standardWallet && 'signMessage' in standardWallet && typeof standardWallet.signMessage === 'function') {
      const signature = await standardWallet.signMessage(message);
      return new Uint8Array(signature);
    }

    throw new Error("Message signing not supported by this wallet");
  }, [connectedWallet]);

  // Create Anchor-compatible wallet object
  const wallet = useMemo((): AnchorWallet | null => {
    if (!publicKey || !connectedWallet) return null;

    return {
      publicKey,
      signTransaction,
      signAllTransactions,
    };
  }, [publicKey, connectedWallet, signTransaction, signAllTransactions]);

  return {
    publicKey,
    connected: ready && authenticated && walletsReady && !!connectedWallet,
    connecting: !ready || !walletsReady,
    disconnecting: false,
    wallet,
    signTransaction,
    signAllTransactions,
    sendTransaction,
    signMessage,
  };
}

// Also export a hook that returns just the anchor wallet (for use with getProgram)
export function useAnchorWallet(): AnchorWallet | undefined {
  const { wallet } = usePrivyAnchorWallet();
  return wallet ?? undefined;
}

// Export a useWallet alias for backwards compatibility
export function useWallet() {
  const result = usePrivyAnchorWallet();
  return {
    publicKey: result.publicKey,
    connected: result.connected,
    connecting: result.connecting,
    disconnecting: result.disconnecting,
    wallet: result.wallet,
    signTransaction: result.signTransaction,
    signAllTransactions: result.signAllTransactions,
    sendTransaction: result.sendTransaction,
    signMessage: result.signMessage,
  };
}

export default usePrivyAnchorWallet;

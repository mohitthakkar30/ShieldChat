"use client";

/**
 * React Hook for ShadowWire Payment Management
 *
 * Handles creating, tracking, and claiming private payments.
 */

import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  createPrivatePayment,
  PaymentAttachment,
  SupportedToken,
  getBalance,
  fromSmallestUnit,
  deposit as shadowWireDeposit,
  withdraw as shadowWireWithdraw,
} from "@/lib/shadowwire";

interface UsePaymentsReturn {
  /** Current pending payment (attached to message being composed) */
  pendingPayment: Omit<PaymentAttachment, "txSignature" | "status"> | null;
  /** Set pending payment for attachment */
  setPendingPayment: (payment: Omit<PaymentAttachment, "txSignature" | "status"> | null) => void;
  /** Execute the pending payment and get signature */
  executePayment: () => Promise<PaymentAttachment | null>;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Clear error */
  clearError: () => void;
  /** Get ShadowWire balance */
  getBalance: (token: SupportedToken) => Promise<number>;
  /** Get unsigned deposit transaction from ShadowWire */
  deposit: (amount: number, token: SupportedToken) => Promise<{ unsignedTx: string; poolAddress: string } | null>;
  /** Get unsigned withdraw transaction from ShadowWire */
  withdraw: (amount: number, token: SupportedToken) => Promise<{ unsignedTx: string } | null>;
}

export function usePayments(): UsePaymentsReturn {
  const { publicKey, signMessage } = useWallet();

  const [pendingPayment, setPendingPayment] = useState<Omit<
    PaymentAttachment,
    "txSignature" | "status"
  > | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Execute the pending payment
   */
  const executePayment = useCallback(async (): Promise<PaymentAttachment | null> => {
    if (!pendingPayment || !publicKey) {
      setError("Wallet not connected or no payment attached");
      return null;
    }

    if (!signMessage) {
      setError("Your wallet doesn't support message signing. Please use Phantom or Solflare.");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await createPrivatePayment({
        sender: publicKey.toString(),
        recipient: pendingPayment.recipient,
        amount: pendingPayment.amount,
        token: pendingPayment.token,
        type: pendingPayment.type,
        signMessage,
      });

      // Clear pending payment after success
      setPendingPayment(null);

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment failed";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [pendingPayment, publicKey, signMessage]);

  /**
   * Get ShadowWire balance for a token
   */
  const getBalanceForToken = useCallback(
    async (token: SupportedToken): Promise<number> => {
      if (!publicKey) return 0;

      try {
        const result = await getBalance(publicKey.toString(), token);
        return fromSmallestUnit(result.available, token);
      } catch {
        return 0;
      }
    },
    [publicKey]
  );

  /**
   * Get unsigned deposit transaction from ShadowWire
   * Note: Caller must sign and send the transaction
   */
  const deposit = useCallback(
    async (amount: number, token: SupportedToken): Promise<{ unsignedTx: string; poolAddress: string } | null> => {
      if (!publicKey) {
        setError("Wallet not connected");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await shadowWireDeposit(
          publicKey.toString(),
          amount,
          token
        );
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Deposit failed";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [publicKey]
  );

  /**
   * Get unsigned withdraw transaction from ShadowWire
   * Note: Caller must sign and send the transaction
   */
  const withdraw = useCallback(
    async (amount: number, token: SupportedToken): Promise<{ unsignedTx: string } | null> => {
      if (!publicKey) {
        setError("Wallet not connected");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await shadowWireWithdraw(
          publicKey.toString(),
          amount,
          token
        );
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Withdraw failed";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [publicKey]
  );

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    pendingPayment,
    setPendingPayment,
    executePayment,
    loading,
    error,
    clearError,
    getBalance: getBalanceForToken,
    deposit,
    withdraw,
  };
}

export default usePayments;

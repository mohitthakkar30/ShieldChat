/**
 * ShadowWire Client for Private Payments
 *
 * Provides private transfers on Solana using Bulletproofs (zero-knowledge proofs).
 * Integrates with ShieldChat for payment attachments in messages.
 */

import { ShadowWireClient, TokenUtils } from "@radr/shadowwire";

// Supported tokens
export const SUPPORTED_TOKENS = [
  { symbol: "SOL", name: "Solana", decimals: 9 },
  { symbol: "USDC", name: "USD Coin", decimals: 6 },
  { symbol: "BONK", name: "Bonk", decimals: 5 },
  { symbol: "RADR", name: "Radr", decimals: 9 },
] as const;

export type SupportedToken = (typeof SUPPORTED_TOKENS)[number]["symbol"];

/**
 * Payment attachment data stored in IPFS messages
 */
export interface PaymentAttachment {
  /** Payment amount in human-readable format */
  amount: number;
  /** Token symbol (SOL, USDC, etc.) */
  token: SupportedToken;
  /** Recipient wallet address */
  recipient: string;
  /** Internal (both on ShadowWire) or external (any wallet) */
  type: "internal" | "external";
  /** ShadowWire transaction signature */
  txSignature: string;
  /** Payment status */
  status: "pending" | "completed" | "failed" | "claimed";
}

/**
 * ShadowWire balance response
 */
export interface ShadowWireBalance {
  available: number; // In smallest units (lamports for SOL)
  token: string;
}

/**
 * Transfer parameters
 */
export interface TransferParams {
  sender: string;
  recipient: string;
  amount: number;
  token: SupportedToken;
  type: "internal" | "external";
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}

// Singleton client instance
let shadowWireClient: ShadowWireClient | null = null;

/**
 * Get or create the ShadowWire client singleton
 */
export function getShadowWireClient(): ShadowWireClient {
  if (!shadowWireClient) {
    shadowWireClient = new ShadowWireClient({ debug: true });
  }
  return shadowWireClient;
}

/**
 * Check if ShadowWire is available
 */
export function isShadowWireAvailable(): boolean {
  try {
    getShadowWireClient();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get ShadowWire balance for a wallet
 */
export async function getBalance(
  wallet: string,
  token: SupportedToken = "SOL"
): Promise<ShadowWireBalance> {
  const client = getShadowWireClient();

  try {
    const balance = await client.getBalance(wallet, token);
    return {
      available: balance.available || 0,
      token,
    };
  } catch {
    return { available: 0, token };
  }
}

/**
 * Wallet adapter interface for signing transactions
 */
export interface WalletForSigning {
  publicKey: { toBuffer: () => Buffer };
  signTransaction: <T extends { serialize: () => Buffer }>(tx: T) => Promise<T>;
}

/**
 * Deposit funds into ShadowWire
 * Returns the unsigned transaction base64 - caller must sign and send
 */
export async function deposit(
  wallet: string,
  amount: number,
  token: SupportedToken
): Promise<{ unsignedTx: string; poolAddress: string }> {
  const client = getShadowWireClient();

  try {
    // Convert to smallest units
    const amountSmallest = TokenUtils.toSmallestUnit(amount, token);

    // Get token mint address (undefined for SOL)
    const tokenMint = token === "SOL" ? undefined : TokenUtils.getTokenMint(token);

    const result = await client.deposit({
      wallet,
      amount: amountSmallest,
      token_mint: tokenMint,
    });

    return {
      unsignedTx: result.unsigned_tx_base64,
      poolAddress: result.pool_address,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Withdraw funds from ShadowWire
 * Returns the unsigned transaction base64 - caller must sign and send
 */
export async function withdraw(
  wallet: string,
  amount: number,
  token: SupportedToken
): Promise<{ unsignedTx: string }> {
  const client = getShadowWireClient();

  try {
    const amountSmallest = TokenUtils.toSmallestUnit(amount, token);

    // Get token mint address (undefined for SOL)
    const tokenMint = token === "SOL" ? undefined : TokenUtils.getTokenMint(token);

    const result = await client.withdraw({
      wallet,
      amount: amountSmallest,
      token_mint: tokenMint,
    });

    return {
      unsignedTx: result.unsigned_tx_base64,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Create a private payment transfer
 * This is the main function for payment attachments
 *
 * Uses lower-level SDK methods (uploadProof + externalTransfer/internalTransfer)
 * because the high-level transfer() function doesn't properly call signMessage.
 */
export async function createPrivatePayment(
  params: TransferParams
): Promise<PaymentAttachment> {
  const client = getShadowWireClient();

  try {
    // Convert to smallest units (lamports for SOL, etc.)
    const amountSmallest = TokenUtils.toSmallestUnit(params.amount, params.token);

    // Get token mint address for API calls
    const tokenMint = params.token === "SOL" ? undefined : TokenUtils.getTokenMint(params.token);
    const tokenForApi = tokenMint || "SOL";

    // Generate nonce (timestamp-based)
    const nonce = Math.floor(Date.now() / 1000);

    // Create wallet adapter for SDK
    const walletAdapter = { signMessage: params.signMessage };

    // Step 1: Upload ZK proof (this will trigger wallet signature)
    const proofResult = await client.uploadProof({
      sender_wallet: params.sender,
      token: tokenForApi,
      amount: amountSmallest,
      nonce,
    }, walletAdapter);

    // Step 2: Execute the transfer
    let txSignature: string;

    if (params.type === "external") {
      const transferResult = await client.externalTransfer({
        sender_wallet: params.sender,
        recipient_wallet: params.recipient,
        token: tokenForApi,
        nonce: proofResult.nonce,
        relayer_fee: 50000000000, // Standard relayer fee from SDK
      }, walletAdapter);
      txSignature = transferResult.tx_signature;
    } else {
      const transferResult = await client.internalTransfer({
        sender_wallet: params.sender,
        recipient_wallet: params.recipient,
        token: tokenForApi,
        nonce: proofResult.nonce,
        relayer_fee: 50000000000,
      }, walletAdapter);
      txSignature = transferResult.tx_signature;
    }

    return {
      amount: params.amount,
      token: params.token,
      recipient: params.recipient,
      type: params.type,
      txSignature,
      status: params.type === "internal" ? "pending" : "completed",
    };
  } catch (error) {
    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes("RecipientNotFound")) {
        throw new Error(
          "Recipient is not a ShadowWire user. Use external transfer instead."
        );
      }
      if (error.message.includes("InsufficientBalance")) {
        throw new Error(
          "Insufficient ShadowWire balance. Please deposit first."
        );
      }
    }

    throw error;
  }
}

/**
 * Format amount for display
 */
export function formatAmount(amount: number, token: SupportedToken): string {
  const tokenInfo = SUPPORTED_TOKENS.find((t) => t.symbol === token);
  const decimals = tokenInfo?.decimals || 9;

  // Format with appropriate decimal places
  if (amount >= 1000) {
    return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
  } else if (amount >= 1) {
    return amount.toLocaleString(undefined, { maximumFractionDigits: 4 });
  } else {
    return amount.toLocaleString(undefined, {
      maximumFractionDigits: decimals,
    });
  }
}

/**
 * Convert lamports/smallest units to human-readable amount
 */
export function fromSmallestUnit(
  amount: number,
  token: SupportedToken
): number {
  return TokenUtils.fromSmallestUnit(amount, token);
}

/**
 * Convert human-readable amount to lamports/smallest units
 */
export function toSmallestUnit(amount: number, token: SupportedToken): number {
  return TokenUtils.toSmallestUnit(amount, token);
}

/**
 * Get Solscan URL for a transaction
 * ShadowWire only works on mainnet-beta
 */
export function getSolscanUrl(txSignature: string): string {
  return `https://solscan.io/tx/${txSignature}`;
}

/**
 * Helius Enhanced WebSocket Client
 * Provides real-time transaction monitoring for ShieldChat
 *
 * Uses Helius transactionSubscribe to monitor MessageLogged events
 * in real-time, enabling instant message delivery without polling.
 */

import { PROGRAM_ID, ARCIUM_MXE_PROGRAM_ID } from "./constants";
import { PublicKey } from "@solana/web3.js";

// MessageLogged event discriminator from IDL (same as in useMessages.ts)
const MESSAGE_LOGGED_DISCRIMINATOR = [24, 236, 247, 207, 227, 70, 101, 210];

/**
 * Parse sender from MessageLogged event in transaction logs
 * Anchor events are emitted as base64-encoded data in "Program data:" logs
 */
function parseSenderFromLogs(logs: string[]): string | null {
  try {
    for (const log of logs) {
      if (!log.startsWith("Program data: ")) continue;

      const base64Data = log.slice("Program data: ".length);
      const data = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      // Check if this matches MessageLogged event discriminator
      const discriminator = Array.from(data.slice(0, 8));
      const matches = discriminator.every((b, i) => b === MESSAGE_LOGGED_DISCRIMINATOR[i]);

      if (!matches) continue;

      // Parse sender from event data:
      // - 8 bytes: discriminator
      // - 32 bytes: channel (pubkey)
      // - 32 bytes: sender (pubkey) <-- This is what we need
      if (data.length < 72) continue; // Need at least 8 + 32 + 32 bytes

      const senderBytes = data.slice(40, 72); // offset 8 + 32 = 40
      const sender = new PublicKey(senderBytes);
      return sender.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export interface HeliusConfig {
  apiKey: string;
  network: "devnet" | "mainnet";
  programId?: string; // Optional custom program ID to monitor
}

export interface HeliusMessage {
  signature: string;
  slot: number;
  timestamp: number;
  logs: string[];
  accounts: string[];
  /** Raw instruction data from the transaction (for extracting CID) */
  instructionData: Uint8Array | null;
  /** Sender's public key (first account in transaction) */
  sender: string | null;
}

type MessageCallback = (message: HeliusMessage) => void;

export class HeliusWebSocket {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private network: string;
  private programId: string;
  private subscriptionId: number | null = null;
  private messageCallbacks: Set<MessageCallback> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private isConnecting = false;

  constructor(config: HeliusConfig) {
    this.apiKey = config.apiKey;
    this.network = config.network;
    this.programId = config.programId || PROGRAM_ID.toString();
  }

  /**
   * Connect to Helius WebSocket and subscribe to program transactions
   */
  connect(): Promise<void> {
    // Prevent multiple concurrent connection attempts
    if (this.isConnecting || this.isConnected()) {
      return Promise.resolve();
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      // Use the atlas endpoint for Enhanced WebSockets
      const endpoint =
        this.network === "mainnet"
          ? `wss://atlas-mainnet.helius-rpc.com/?api-key=${this.apiKey}`
          : `wss://atlas-devnet.helius-rpc.com/?api-key=${this.apiKey}`;

      console.log("[Helius] Connecting to:", this.network);

      try {
        this.ws = new WebSocket(endpoint);
      } catch (err) {
        this.isConnecting = false;
        reject(err);
        return;
      }

      this.ws.onopen = () => {
        console.log("[Helius] WebSocket connected");
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.subscribe();
        this.startPing();
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error("[Helius] WebSocket error:", error);
        this.isConnecting = false;
        reject(error);
      };

      this.ws.onclose = (event) => {
        console.log("[Helius] WebSocket closed:", event.code, event.reason);
        this.isConnecting = false;
        this.stopPing();
        this.subscriptionId = null;

        // Only attempt reconnect if not a clean close
        if (event.code !== 1000) {
          this.attemptReconnect();
        }
      };
    });
  }

  /**
   * Subscribe to program transactions
   */
  private subscribe(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const subscriptionRequest = {
      jsonrpc: "2.0",
      id: 420,
      method: "transactionSubscribe",
      params: [
        {
          // Monitor all transactions involving our program
          accountInclude: [this.programId],
        },
        {
          commitment: "confirmed",
          encoding: "jsonParsed",
          transactionDetails: "full",
          showRewards: false,
          maxSupportedTransactionVersion: 0,
        },
      ],
    };

    this.ws.send(JSON.stringify(subscriptionRequest));
    console.log("[Helius] Subscribed to program:", this.programId);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // Handle subscription confirmation
      if (message.result !== undefined && message.id === 420) {
        this.subscriptionId = message.result;
        console.log(
          "[Helius] Subscription confirmed, ID:",
          this.subscriptionId
        );
        return;
      }

      // Handle pong response
      if (message.id === 0) {
        // Ping response, connection is alive
        return;
      }

      // Handle transaction notification
      if (
        message.method === "transactionNotification" &&
        message.params?.result
      ) {
        const result = message.params.result;

        // Extract transaction data
        const transaction = result.transaction;
        const meta = transaction?.meta;
        const txMessage = transaction?.transaction?.message;

        // Extract instruction data for our program
        const instructionData = this.extractInstructionData(txMessage);
        const accounts = this.extractAccounts(txMessage);
        const logs = meta?.logMessages || [];

        // Parse sender from MessageLogged event in logs (most reliable)
        // Falls back to first account if event parsing fails
        const senderFromEvent = parseSenderFromLogs(logs);

        // Build HeliusMessage from the notification
        const heliusMessage: HeliusMessage = {
          signature: result.signature,
          slot: result.slot,
          timestamp: Math.floor(Date.now() / 1000),
          logs,
          accounts,
          instructionData,
          sender: senderFromEvent || accounts[0] || null,
        };

        console.log(
          "[Helius] Transaction received:",
          heliusMessage.signature.slice(0, 8) + "...",
          instructionData ? `(${instructionData.length} bytes)` : "(no data)"
        );

        // Notify all callbacks
        this.messageCallbacks.forEach((callback) => {
          try {
            callback(heliusMessage);
          } catch (err) {
            console.error("[Helius] Callback error:", err);
          }
        });
      }
    } catch (err) {
      console.error("[Helius] Failed to parse message:", err);
    }
  }

  /**
   * Extract account addresses from transaction message
   */
  private extractAccounts(
    txMessage: { accountKeys?: Array<{ pubkey: string } | string> } | undefined
  ): string[] {
    if (!txMessage?.accountKeys) return [];

    return txMessage.accountKeys.map((key) => {
      if (typeof key === "string") return key;
      if (typeof key === "object" && key.pubkey) return key.pubkey;
      return "";
    }).filter(Boolean);
  }

  /**
   * Extract instruction data for our program from transaction
   * Returns the raw instruction data as Uint8Array
   */
  private extractInstructionData(
    txMessage: {
      accountKeys?: Array<{ pubkey: string } | string>;
      instructions?: Array<{
        programIdIndex?: number;
        programId?: string;
        data?: string;
        accounts?: number[];
      }>;
    } | undefined
  ): Uint8Array | null {
    if (!txMessage?.instructions || !txMessage?.accountKeys) return null;

    for (const ix of txMessage.instructions) {
      // Check if this instruction is for our program
      let isProgramIx = false;

      if (ix.programId === this.programId) {
        isProgramIx = true;
      } else if (ix.programIdIndex !== undefined) {
        const accountKey = txMessage.accountKeys[ix.programIdIndex];
        const programId = typeof accountKey === "string"
          ? accountKey
          : accountKey?.pubkey;
        isProgramIx = programId === this.programId;
      }

      if (isProgramIx && ix.data) {
        try {
          // Decode base58 instruction data
          const decoded = this.decodeBase58(ix.data);
          return decoded;
        } catch {
          // Try base64 as fallback
          try {
            const decoded = Uint8Array.from(atob(ix.data), c => c.charCodeAt(0));
            return decoded;
          } catch {
            console.warn("[Helius] Failed to decode instruction data");
          }
        }
      }
    }

    return null;
  }

  /**
   * Simple base58 decoder
   */
  private decodeBase58(str: string): Uint8Array {
    const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const ALPHABET_MAP: { [key: string]: number } = {};
    for (let i = 0; i < ALPHABET.length; i++) {
      ALPHABET_MAP[ALPHABET[i]] = i;
    }

    if (str.length === 0) return new Uint8Array(0);

    const bytes: number[] = [0];
    for (let i = 0; i < str.length; i++) {
      const value = ALPHABET_MAP[str[i]];
      if (value === undefined) {
        throw new Error(`Invalid base58 character: ${str[i]}`);
      }

      let carry = value;
      for (let j = 0; j < bytes.length; j++) {
        carry += bytes[j] * 58;
        bytes[j] = carry & 0xff;
        carry >>= 8;
      }

      while (carry > 0) {
        bytes.push(carry & 0xff);
        carry >>= 8;
      }
    }

    // Handle leading zeros
    for (let i = 0; i < str.length && str[i] === "1"; i++) {
      bytes.push(0);
    }

    return new Uint8Array(bytes.reverse());
  }

  /**
   * Keep connection alive with ping every 30 seconds
   * Helius has a 10-minute inactivity timeout
   */
  private startPing(): void {
    this.stopPing(); // Clear any existing interval

    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send a simple ping request
        this.ws.send(JSON.stringify({ jsonrpc: "2.0", id: 0, method: "ping" }));
      }
    }, 30000); // Every 30 seconds
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Attempt to reconnect on disconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[Helius] Max reconnect attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    console.log(
      `[Helius] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    setTimeout(() => {
      this.connect().catch((err) => {
        console.error("[Helius] Reconnection failed:", err);
      });
    }, delay);
  }

  /**
   * Register callback for new transaction notifications
   * Returns unsubscribe function
   */
  onMessage(callback: MessageCallback): () => void {
    this.messageCallbacks.add(callback);
    return () => this.messageCallbacks.delete(callback);
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    this.stopPing();
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnect

    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }

    this.subscriptionId = null;
    this.messageCallbacks.clear();
    this.isConnecting = false;

    console.log("[Helius] Disconnected");
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get subscription status
   */
  isSubscribed(): boolean {
    return this.subscriptionId !== null;
  }
}

// Singleton instance for app-wide use
let heliusInstance: HeliusWebSocket | null = null;

/**
 * Get or create Helius WebSocket client singleton
 * Returns null if no API key is configured
 */
export function getHeliusClient(): HeliusWebSocket | null {
  if (heliusInstance) {
    return heliusInstance;
  }

  // Check for API key in environment
  const apiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;

  if (!apiKey) {
    console.warn("[Helius] No API key configured (NEXT_PUBLIC_HELIUS_API_KEY)");
    console.warn("[Helius] Falling back to polling for message updates");
    return null;
  }

  heliusInstance = new HeliusWebSocket({
    apiKey,
    network: "devnet",
  });

  return heliusInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetHeliusClient(): void {
  if (heliusInstance) {
    heliusInstance.disconnect();
    heliusInstance = null;
  }
}

// Singleton instance for games (ARCIUM_MXE_PROGRAM_ID)
let heliusGamesInstance: HeliusWebSocket | null = null;

/**
 * Get or create Helius WebSocket client for games
 * Monitors ARCIUM_MXE_PROGRAM_ID for game transactions
 * Returns null if no API key is configured
 */
export function getHeliusGamesClient(): HeliusWebSocket | null {
  if (heliusGamesInstance) {
    return heliusGamesInstance;
  }

  const apiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;

  if (!apiKey) {
    console.warn("[Helius Games] No API key configured");
    return null;
  }

  heliusGamesInstance = new HeliusWebSocket({
    apiKey,
    network: "devnet",
    programId: ARCIUM_MXE_PROGRAM_ID.toString(),
  });

  return heliusGamesInstance;
}

/**
 * Reset the games singleton instance (for testing)
 */
export function resetHeliusGamesClient(): void {
  if (heliusGamesInstance) {
    heliusGamesInstance.disconnect();
    heliusGamesInstance = null;
  }
}

/**
 * Token metadata from Helius DAS API
 */
export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
}

/**
 * Fetch token metadata (name, symbol, decimals) using Helius DAS API
 * Falls back to direct mint account parsing if DAS doesn't have metadata
 * @param mintAddress - The token mint address
 * @returns Token metadata or null if not found
 */
export async function getTokenMetadata(mintAddress: string): Promise<TokenMetadata | null> {
  const apiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;

  if (!apiKey) {
    console.warn("[Helius] No API key configured for getTokenMetadata");
    return null;
  }

  const rpcUrl = `https://devnet.helius-rpc.com/?api-key=${apiKey}`;

  try {
    // First try the DAS getAsset method (works for tokens with metadata)
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'get-asset',
        method: 'getAsset',
        params: { id: mintAddress }
      }),
    });

    const data = await response.json();

    if (!data.error && data.result) {
      const result = data.result;
      const metadata = result?.content?.metadata;
      const tokenInfo = result?.token_info;

      // If we got token_info with decimals, return it
      if (tokenInfo?.decimals !== undefined) {
        return {
          name: metadata?.name || 'Unknown Token',
          symbol: metadata?.symbol || mintAddress.slice(0, 4).toUpperCase(),
          decimals: tokenInfo.decimals,
        };
      }
    }

    // Fallback: Fetch mint account directly to get decimals
    const mintResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'get-account',
        method: 'getAccountInfo',
        params: [
          mintAddress,
          { encoding: 'jsonParsed' }
        ]
      }),
    });

    const mintData = await mintResponse.json();

    if (mintData.result?.value?.data?.parsed?.info) {
      const info = mintData.result.value.data.parsed.info;
      return {
        name: 'SPL Token',
        symbol: mintAddress.slice(0, 4).toUpperCase(),
        decimals: info.decimals ?? 0,
      };
    }

    return null;
  } catch (error) {
    console.error('[Helius] Failed to fetch token metadata:', error);
    return null;
  }
}

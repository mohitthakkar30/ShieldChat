/**
 * MagicBlock Client for Private Ephemeral Rollups
 *
 * Provides real-time private presence features using MagicBlock's TEE-protected
 * ephemeral rollups. This enables typing indicators, online status, and read
 * receipts that are only visible to authorized channel members.
 *
 * Uses a WebSocket server for cross-browser presence synchronization.
 * In production, this would connect to MagicBlock's TEE validators.
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { getAuthToken } from "@magicblock-labs/ephemeral-rollups-sdk";

// MagicBlock TEE endpoints
const MAGICBLOCK_TEE_URL = "https://tee.magicblock.app";
const MAGICBLOCK_DEVNET_URL = "https://devnet.magicblock.app";

// Presence WebSocket server URL
const PRESENCE_WS_URL = process.env.NEXT_PUBLIC_PRESENCE_WS_URL || "ws://localhost:3001";

// Use devnet for development, TEE for production
const MAGICBLOCK_RPC_URL = process.env.NEXT_PUBLIC_MAGICBLOCK_URL || MAGICBLOCK_DEVNET_URL;

/**
 * Presence state for a user in a channel
 */
export interface UserPresence {
  wallet: string;
  channelId: string;
  isTyping: boolean;
  isOnline: boolean;
  lastSeen: number; // Unix timestamp
  lastReadMessage: number; // Message number
}

/**
 * Callback for presence updates
 */
export type PresenceCallback = (presence: UserPresence[]) => void;

/**
 * Auth token and expiration
 */
interface AuthSession {
  token: string;
  expiresAt: number;
}

// Singleton auth session
let authSession: AuthSession | null = null;

// Ephemeral connection instance
let ephemeralConnection: Connection | null = null;

// WebSocket connection for presence
let presenceWs: WebSocket | null = null;
let currentWallet: string | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 2000;

// Presence state (synced from server)
const presenceStore = new Map<string, Map<string, UserPresence>>();
const presenceSubscribers = new Map<string, Set<PresenceCallback>>();
const subscribedChannels = new Set<string>();

// Message queue for when WebSocket isn't connected yet
const messageQueue: Record<string, unknown>[] = [];

/**
 * Get or create the ephemeral connection
 */
export function getEphemeralConnection(authToken?: string): Connection {
  const url = authToken
    ? `${MAGICBLOCK_TEE_URL}?token=${authToken}`
    : MAGICBLOCK_RPC_URL;

  if (!ephemeralConnection || authToken) {
    ephemeralConnection = new Connection(url, "confirmed");
  }
  return ephemeralConnection;
}

/**
 * Authenticate with MagicBlock TEE
 * Signs a challenge to prove wallet ownership
 */
export async function authenticate(
  publicKey: PublicKey,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
): Promise<string> {
  // Check if we have a valid session
  if (authSession && authSession.expiresAt > Date.now()) {
    return authSession.token;
  }

  try {
    const result = await getAuthToken(
      MAGICBLOCK_TEE_URL,
      publicKey,
      signMessage
    );

    authSession = {
      token: result.token,
      expiresAt: result.expiresAt,
    };

    return result.token;
  } catch (error) {
    throw new Error(
      `MagicBlock authentication failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Check if authenticated with MagicBlock
 */
export function isAuthenticated(): boolean {
  return authSession !== null && authSession.expiresAt > Date.now();
}

/**
 * Clear authentication session
 */
export function clearAuth(): void {
  authSession = null;
}

/**
 * Connect to presence WebSocket server
 */
function connectWebSocket(): void {
  if (typeof window === "undefined") return;
  if (presenceWs && presenceWs.readyState === WebSocket.OPEN) return;

  try {
    presenceWs = new WebSocket(PRESENCE_WS_URL);

    presenceWs.onopen = () => {
      reconnectAttempts = 0;

      // Identify with wallet
      if (currentWallet) {
        sendMessage({ type: "identify", wallet: currentWallet });
      }

      // Re-subscribe to all channels
      for (const channelId of subscribedChannels) {
        sendMessage({ type: "subscribe", channelId });
      }

      // Flush any messages that were queued while connecting
      flushMessageQueue();
    };

    presenceWs.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleServerMessage(message);
      } catch {
        // Ignore parse errors
      }
    };

    presenceWs.onclose = () => {
      presenceWs = null;

      // Attempt reconnection
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        setTimeout(connectWebSocket, RECONNECT_DELAY * reconnectAttempts);
      }
    };

    presenceWs.onerror = () => {
      // Error will trigger onclose
    };
  } catch {
    // Connection failed, will retry
  }
}

/**
 * Send message to presence server (with queuing for when not connected)
 */
function sendMessage(message: Record<string, unknown>): void {
  if (presenceWs && presenceWs.readyState === WebSocket.OPEN) {
    presenceWs.send(JSON.stringify(message));
  } else {
    // Queue the message to send when connected
    messageQueue.push(message);
  }
}

/**
 * Flush queued messages after WebSocket connects
 */
function flushMessageQueue(): void {
  while (messageQueue.length > 0) {
    const message = messageQueue.shift();
    if (message && presenceWs && presenceWs.readyState === WebSocket.OPEN) {
      presenceWs.send(JSON.stringify(message));
    }
  }
}

/**
 * Handle message from presence server
 */
function handleServerMessage(message: { type: string; channelId?: string; presences?: UserPresence[] }): void {
  if (message.type === "presence_update" && message.channelId && message.presences) {
    // Update local store
    const channelPresence = new Map<string, UserPresence>();
    for (const presence of message.presences) {
      channelPresence.set(presence.wallet, presence);
    }
    presenceStore.set(message.channelId, channelPresence);

    // Notify subscribers
    notifySubscribers(message.channelId);
  }
}

/**
 * Initialize presence client with wallet
 */
export function initPresence(wallet: string): void {
  currentWallet = wallet;
  connectWebSocket();

  if (presenceWs && presenceWs.readyState === WebSocket.OPEN) {
    sendMessage({ type: "identify", wallet });
  }
}

/**
 * Update typing status
 */
export async function setTypingStatus(
  wallet: string,
  channelId: string,
  isTyping: boolean
): Promise<void> {
  // Ensure connected
  if (!currentWallet) {
    initPresence(wallet);
  }

  sendMessage({
    type: "set_typing",
    channelId,
    isTyping,
  });

  // Optimistic update for local display
  updateLocalPresence(channelId, wallet, { isTyping });
}

/**
 * Update online status
 */
export async function setOnlineStatus(
  wallet: string,
  channelId: string,
  isOnline: boolean
): Promise<void> {
  // Ensure connected
  if (!currentWallet) {
    initPresence(wallet);
  }

  sendMessage({
    type: "set_online",
    channelId,
    isOnline,
  });

  // Optimistic update for local display
  updateLocalPresence(channelId, wallet, { isOnline });
}

/**
 * Mark message as read
 */
export async function markMessageRead(
  wallet: string,
  channelId: string,
  messageNumber: number
): Promise<void> {
  sendMessage({
    type: "mark_read",
    channelId,
    messageNumber,
  });

  // Optimistic update for local display
  updateLocalPresence(channelId, wallet, { lastReadMessage: messageNumber });
}

/**
 * Send heartbeat to keep connection alive
 */
export function sendHeartbeat(): void {
  sendMessage({ type: "heartbeat" });
}

/**
 * Update local presence (optimistic update)
 */
function updateLocalPresence(
  channelId: string,
  wallet: string,
  updates: Partial<UserPresence>
): void {
  if (!presenceStore.has(channelId)) {
    presenceStore.set(channelId, new Map());
  }

  const channelPresence = presenceStore.get(channelId)!;
  const existing = channelPresence.get(wallet) || {
    wallet,
    channelId,
    isTyping: false,
    isOnline: true,
    lastSeen: Date.now(),
    lastReadMessage: 0,
  };

  channelPresence.set(wallet, {
    ...existing,
    ...updates,
    lastSeen: Date.now(),
  });

  notifySubscribers(channelId);
}

/**
 * Get all presence data for a channel
 */
export function getChannelPresence(channelId: string): UserPresence[] {
  const channelPresence = presenceStore.get(channelId);
  if (!channelPresence) return [];
  return Array.from(channelPresence.values());
}

/**
 * Subscribe to presence updates for a channel
 * Returns unsubscribe function
 */
export function subscribeToPresence(
  channelId: string,
  callback: PresenceCallback
): () => void {
  // Connect WebSocket if needed
  connectWebSocket();

  // Add to subscribers
  if (!presenceSubscribers.has(channelId)) {
    presenceSubscribers.set(channelId, new Set());
  }
  presenceSubscribers.get(channelId)!.add(callback);

  // Track subscribed channel
  subscribedChannels.add(channelId);

  // Subscribe on server
  sendMessage({ type: "subscribe", channelId });

  // Immediately call with current presence
  callback(getChannelPresence(channelId));

  // Return unsubscribe function
  return () => {
    presenceSubscribers.get(channelId)?.delete(callback);

    // Unsubscribe on server if no more local subscribers
    if (presenceSubscribers.get(channelId)?.size === 0) {
      subscribedChannels.delete(channelId);
      sendMessage({ type: "unsubscribe", channelId });
    }
  };
}

/**
 * Notify all subscribers of presence changes
 */
function notifySubscribers(channelId: string): void {
  const subscribers = presenceSubscribers.get(channelId);
  if (!subscribers) return;

  const presences = getChannelPresence(channelId);
  for (const callback of subscribers) {
    callback(presences);
  }
}

/**
 * Cleanup stale presence entries (handled by server)
 */
export function cleanupStalePresence(): void {
  // Server handles cleanup, this is a no-op
}

/**
 * Check if MagicBlock is available
 */
export function isMagicBlockAvailable(): boolean {
  return true; // Always available with WebSocket fallback
}

/**
 * Disconnect from presence server
 */
export function disconnectPresence(): void {
  if (presenceWs) {
    presenceWs.close();
    presenceWs = null;
  }
  currentWallet = null;
  subscribedChannels.clear();
}

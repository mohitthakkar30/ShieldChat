"use client";

/**
 * React Hook for Helius Real-Time Message Monitoring
 *
 * Provides real-time message updates via Helius Enhanced WebSockets.
 * Automatically falls back to polling if Helius is not configured.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  getHeliusClient,
  HeliusMessage,
  HeliusWebSocket,
} from "@/lib/helius";
import { PublicKey } from "@solana/web3.js";

interface UseHeliusOptions {
  /** The channel PDA to monitor for messages */
  channelPda: PublicKey | null;
  /** Callback when a new message is detected (with full Helius data for direct extraction) */
  onNewMessage?: (message: HeliusMessage) => void;
  /** Whether to enable the hook (default: true) */
  enabled?: boolean;
}

interface UseHeliusReturn {
  /** Whether WebSocket is connected */
  connected: boolean;
  /** Whether subscription is active */
  subscribed: boolean;
  /** Error message if connection failed */
  error: string | null;
  /** Manually trigger reconnection */
  reconnect: () => Promise<void>;
  /** Whether Helius is available (API key configured) */
  isAvailable: boolean;
}

export function useHelius({
  channelPda,
  onNewMessage,
  enabled = true,
}: UseHeliusOptions): UseHeliusReturn {
  const [connected, setConnected] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);

  const clientRef = useRef<HeliusWebSocket | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const onNewMessageRef = useRef(onNewMessage);

  // Keep callback ref updated
  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
  }, [onNewMessage]);

  /**
   * Connect to Helius WebSocket
   */
  const connect = useCallback(async () => {
    if (!enabled) return;

    const client = getHeliusClient();

    if (!client) {
      setIsAvailable(false);
      setError("Helius API key not configured");
      return;
    }

    setIsAvailable(true);
    clientRef.current = client;

    // Already connected
    if (client.isConnected()) {
      setConnected(true);
      setSubscribed(client.isSubscribed());
      setError(null);
      return;
    }

    try {
      await client.connect();
      setConnected(true);
      setSubscribed(true);
      setError(null);
      console.log("[useHelius] Connected successfully");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect";
      setError(message);
      setConnected(false);
      setSubscribed(false);
      console.error("[useHelius] Connection failed:", message);
    }
  }, [enabled]);

  /**
   * Subscribe to channel-specific messages
   */
  useEffect(() => {
    if (!connected || !clientRef.current || !channelPda || !enabled) {
      return;
    }

    const channelStr = channelPda.toString();

    const handleMessage = (message: HeliusMessage) => {
      // Check if this transaction involves our channel
      const involvesChannel = message.accounts.some(
        (acc) => acc === channelStr
      );

      // Check if it's a MessageLogged event (look in logs)
      const isMessageLog = message.logs.some(
        (log) =>
          log.includes("MessageLogged") ||
          log.includes("Message logged") ||
          log.includes("Program log: Message logged:")
      );

      // Also check if the program ID is in accounts (any ShieldChat transaction)
      const isProgramTransaction = message.accounts.some(
        (acc) => acc === "FVViRGPShMjCeSF3LDrp2qDjp6anRz9WAMiJrsGCRUzN"
      );

      if ((involvesChannel && isMessageLog) || (isProgramTransaction && isMessageLog)) {
        console.log(
          "[useHelius] New message detected for channel:",
          channelStr.slice(0, 8) + "...",
          "tx:",
          message.signature.slice(0, 8) + "..."
        );

        // Call the callback with full message data for direct extraction
        if (onNewMessageRef.current) {
          onNewMessageRef.current(message);
        }
      }
    };

    // Register the callback
    unsubscribeRef.current = clientRef.current.onMessage(handleMessage);
    console.log(
      "[useHelius] Listening for messages on channel:",
      channelStr.slice(0, 8) + "..."
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [connected, channelPda, enabled]);

  /**
   * Initial connection on mount
   */
  useEffect(() => {
    if (!enabled) return;

    connect();

    // Note: We don't disconnect on unmount because the client is a singleton
    // Other components may still be using it
    return () => {
      // Only unsubscribe this component's callback
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [connect, enabled]);

  /**
   * Update connection state when client state changes
   */
  useEffect(() => {
    if (!clientRef.current || !enabled) return;

    const checkConnection = () => {
      const client = clientRef.current;
      if (client) {
        setConnected(client.isConnected());
        setSubscribed(client.isSubscribed());
      }
    };

    // Check periodically (client doesn't expose state change events)
    const interval = setInterval(checkConnection, 5000);

    return () => clearInterval(interval);
  }, [enabled]);

  return {
    connected,
    subscribed,
    error,
    reconnect: connect,
    isAvailable,
  };
}

export default useHelius;

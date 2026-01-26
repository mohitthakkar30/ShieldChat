"use client";

/**
 * React Hook for Helius Real-Time Game Monitoring
 *
 * Provides real-time game updates via Helius Enhanced WebSockets.
 * Monitors ARCIUM_MXE_PROGRAM_ID for game transactions.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  getHeliusGamesClient,
  HeliusMessage,
  HeliusWebSocket,
} from "@/lib/helius";
import { PublicKey } from "@solana/web3.js";

interface UseHeliusGamesOptions {
  /** The game PDA to monitor */
  gamePda: PublicKey | null;
  /** Callback when a game update is detected */
  onGameUpdate?: () => void;
  /** Whether to enable the hook (default: true) */
  enabled?: boolean;
}

interface UseHeliusGamesReturn {
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

export function useHeliusGames({
  gamePda,
  onGameUpdate,
  enabled = true,
}: UseHeliusGamesOptions): UseHeliusGamesReturn {
  const [connected, setConnected] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);

  const clientRef = useRef<HeliusWebSocket | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const onGameUpdateRef = useRef(onGameUpdate);

  // Keep callback ref updated
  useEffect(() => {
    onGameUpdateRef.current = onGameUpdate;
  }, [onGameUpdate]);

  /**
   * Connect to Helius WebSocket for games
   */
  const connect = useCallback(async () => {
    if (!enabled) return;

    const client = getHeliusGamesClient();

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
      console.log("[useHeliusGames] Connected successfully");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect";
      setError(message);
      setConnected(false);
      setSubscribed(false);
      console.error("[useHeliusGames] Connection failed:", message);
    }
  }, [enabled]);

  /**
   * Subscribe to game-specific transactions
   */
  useEffect(() => {
    if (!connected || !clientRef.current || !gamePda || !enabled) {
      return;
    }

    const gameStr = gamePda.toString();

    const handleMessage = (message: HeliusMessage) => {
      // Check if this transaction involves our game PDA
      const involvesGame = message.accounts.some((acc) => acc === gameStr);

      if (involvesGame) {
        console.log(
          "[useHeliusGames] Game update detected:",
          gameStr.slice(0, 8) + "...",
          "tx:",
          message.signature.slice(0, 8) + "..."
        );

        // Call the callback to trigger a game state refresh
        if (onGameUpdateRef.current) {
          onGameUpdateRef.current();
        }
      }
    };

    // Register the callback
    unsubscribeRef.current = clientRef.current.onMessage(handleMessage);
    console.log(
      "[useHeliusGames] Listening for updates on game:",
      gameStr.slice(0, 8) + "..."
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [connected, gamePda, enabled]);

  /**
   * Initial connection on mount
   */
  useEffect(() => {
    if (!enabled) return;

    connect();

    return () => {
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

export default useHeliusGames;

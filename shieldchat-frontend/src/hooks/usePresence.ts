"use client";

/**
 * React Hook for MagicBlock Private Presence
 *
 * Manages typing indicators, online status, and read receipts
 * using WebSocket presence server for real-time updates.
 *
 * Note: On-chain presence with TEE delegation is available but requires
 * wallet signatures for each update. WebSocket is used for better UX.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  UserPresence,
  setTypingStatus,
  setOnlineStatus,
  markMessageRead,
  subscribeToPresence,
  initPresence,
  sendHeartbeat,
} from "@/lib/magicblock";

interface UsePresenceReturn {
  /** Users currently typing in the channel */
  typingUsers: string[];
  /** Users currently online in the channel */
  onlineUsers: string[];
  /** Map of wallet -> last read message number */
  readReceipts: Map<string, number>;
  /** Set current user's typing status */
  setTyping: (isTyping: boolean) => void;
  /** Mark a message as read */
  markAsRead: (messageNumber: number) => void;
  /** Check if a specific user is online */
  isUserOnline: (wallet: string) => boolean;
  /** Check if a specific user is typing */
  isUserTyping: (wallet: string) => boolean;
  /** Get last read message for a user */
  getLastReadMessage: (wallet: string) => number;
}

// Typing indicator timeout (3 seconds)
const TYPING_TIMEOUT = 3000;

// Online heartbeat interval (5 seconds)
const HEARTBEAT_INTERVAL = 5000;

export function usePresence(channelPda: PublicKey | null): UsePresenceReturn {
  const { publicKey } = useWallet();

  const [presences, setPresences] = useState<UserPresence[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  const channelId = channelPda?.toString() || "";
  const walletAddress = publicKey?.toString() || "";

  // Subscribe to presence updates
  useEffect(() => {
    if (!channelId) return;

    const unsubscribe = subscribeToPresence(channelId, (newPresences) => {
      setPresences(newPresences);
    });

    return () => {
      unsubscribe();
    };
  }, [channelId]);

  // Initialize presence and set online status
  useEffect(() => {
    if (!channelId || !walletAddress) return;

    // Initialize WebSocket connection with wallet
    initPresence(walletAddress);

    // Set online immediately
    setOnlineStatus(walletAddress, channelId, true);

    // Heartbeat to maintain online status and connection
    heartbeatRef.current = setInterval(() => {
      setOnlineStatus(walletAddress, channelId, true);
      sendHeartbeat();
    }, HEARTBEAT_INTERVAL);

    // Set offline on unmount
    return () => {
      setOnlineStatus(walletAddress, channelId, false);

      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [channelId, walletAddress]);

  // Set typing status with auto-timeout
  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (!channelId || !walletAddress) return;

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      setTypingStatus(walletAddress, channelId, isTyping);

      // Auto-clear typing after timeout
      if (isTyping) {
        typingTimeoutRef.current = setTimeout(() => {
          setTypingStatus(walletAddress, channelId, false);
        }, TYPING_TIMEOUT);
      }
    },
    [channelId, walletAddress]
  );

  // Mark message as read
  const markAsRead = useCallback(
    (messageNumber: number) => {
      if (!channelId || !walletAddress) return;
      markMessageRead(walletAddress, channelId, messageNumber);
    },
    [channelId, walletAddress]
  );

  // Check if a specific user is online
  const isUserOnline = useCallback(
    (wallet: string) => {
      const presence = presences.find((p) => p.wallet === wallet);
      return presence?.isOnline ?? false;
    },
    [presences]
  );

  // Check if a specific user is typing
  const isUserTyping = useCallback(
    (wallet: string) => {
      const presence = presences.find((p) => p.wallet === wallet);
      return presence?.isTyping ?? false;
    },
    [presences]
  );

  // Get last read message for a user
  const getLastReadMessage = useCallback(
    (wallet: string) => {
      const presence = presences.find((p) => p.wallet === wallet);
      return presence?.lastReadMessage ?? 0;
    },
    [presences]
  );

  // Derived state: typing users (excluding self) - full wallet addresses
  const typingUsers = presences
    .filter((p) => p.isTyping && p.wallet !== walletAddress)
    .map((p) => p.wallet);

  // Derived state: online users
  const onlineUsers = presences
    .filter((p) => p.isOnline)
    .map((p) => p.wallet);

  // Derived state: read receipts
  const readReceipts = new Map<string, number>();
  for (const p of presences) {
    if (p.lastReadMessage > 0) {
      readReceipts.set(p.wallet, p.lastReadMessage);
    }
  }

  return {
    typingUsers,
    onlineUsers,
    readReceipts,
    setTyping,
    markAsRead,
    isUserOnline,
    isUserTyping,
    getLastReadMessage,
  };
}

export default usePresence;

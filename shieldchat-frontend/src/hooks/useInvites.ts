"use client";

import { useCallback, useState } from "react";
import { useWallet } from "@/hooks/usePrivyAnchorWallet";
import {
  createInvite,
  getInviteByCode,
  redeemInvite,
  revokeInvite,
  listChannelInvites,
  DbInvite,
  CreateInviteOptions,
} from "@/lib/supabase";
import { ChannelAccount, parseChannelType } from "@/lib/anchor";

// Expiration presets in milliseconds
export const EXPIRY_OPTIONS = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  never: null,
} as const;

// Usage limit presets
export const USAGE_OPTIONS = {
  "1": 1,
  "5": 5,
  "10": 10,
  "25": 25,
  unlimited: null,
} as const;

export interface InviteWithMeta extends DbInvite {
  isExpired: boolean;
  isMaxedOut: boolean;
  expiresInText: string | null;
  usesRemainingText: string;
}

/**
 * Hook for managing channel invites
 */
export function useInvites() {
  const { publicKey } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Check if user can create invites for a channel
   * - Public channels: any member can invite
   * - Private/TokenGated: only owner can invite
   * - DirectMessage: either participant can invite
   */
  const canCreateInvite = useCallback(
    (channel: ChannelAccount, isOwner: boolean): boolean => {
      if (!publicKey) return false;

      const channelType = parseChannelType(channel.channelType);

      switch (channelType) {
        case "Public":
          return true; // Any member can invite
        case "Private Group":
        case "Token Gated":
          return isOwner; // Only owner
        case "Direct Message":
          return true; // Either participant
        default:
          return isOwner;
      }
    },
    [publicKey]
  );

  /**
   * Create a new invite for a channel
   */
  const createChannelInvite = useCallback(
    async (
      channelPda: string,
      options: {
        maxUses?: keyof typeof USAGE_OPTIONS;
        expiresIn?: keyof typeof EXPIRY_OPTIONS;
      } = {}
    ): Promise<DbInvite | null> => {
      if (!publicKey) {
        setError("Wallet not connected");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const inviteOptions: CreateInviteOptions = {
          maxUses:
            options.maxUses && options.maxUses !== "unlimited"
              ? USAGE_OPTIONS[options.maxUses]
              : null,
          expiresIn:
            options.expiresIn && options.expiresIn !== "never"
              ? EXPIRY_OPTIONS[options.expiresIn]
              : null,
        };

        const invite = await createInvite(
          channelPda,
          publicKey.toString(),
          inviteOptions
        );

        if (!invite) {
          setError("Failed to create invite");
          return null;
        }

        return invite;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create invite";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [publicKey]
  );

  /**
   * Get invite details by code (for join page)
   */
  const getInvite = useCallback(
    async (code: string): Promise<DbInvite | null> => {
      setLoading(true);
      setError(null);

      try {
        const invite = await getInviteByCode(code);

        if (!invite) {
          setError("Invite not found, expired, or maxed out");
          return null;
        }

        return invite;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to get invite";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Redeem an invite code and get the channel PDA
   */
  const useInviteCode = useCallback(
    async (
      code: string
    ): Promise<{ channelPda: string; invite: DbInvite } | null> => {
      if (!publicKey) {
        setError("Wallet not connected");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await redeemInvite(code, publicKey.toString());

        if (!result) {
          setError("Failed to redeem invite");
          return null;
        }

        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to redeem invite";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [publicKey]
  );

  /**
   * Revoke an invite
   */
  const revokeChannelInvite = useCallback(
    async (inviteId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const success = await revokeInvite(inviteId);

        if (!success) {
          setError("Failed to revoke invite");
          return false;
        }

        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to revoke invite";
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * List all invites for a channel with computed metadata
   */
  const listInvites = useCallback(
    async (channelPda: string): Promise<InviteWithMeta[]> => {
      setLoading(true);
      setError(null);

      try {
        const invites = await listChannelInvites(channelPda);

        // Add computed metadata
        return invites.map((invite) => {
          const now = new Date();
          const expiresAt = invite.expires_at
            ? new Date(invite.expires_at)
            : null;
          const isExpired = expiresAt ? expiresAt < now : false;
          const isMaxedOut =
            invite.max_uses !== null && invite.used_count >= invite.max_uses;

          // Compute expiration text
          let expiresInText: string | null = null;
          if (expiresAt && !isExpired) {
            const diff = expiresAt.getTime() - now.getTime();
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const days = Math.floor(hours / 24);

            if (days > 0) {
              expiresInText = `${days}d`;
            } else if (hours > 0) {
              expiresInText = `${hours}h`;
            } else {
              const minutes = Math.floor(diff / (1000 * 60));
              expiresInText = `${minutes}m`;
            }
          }

          // Compute uses remaining text
          let usesRemainingText: string;
          if (invite.max_uses === null) {
            usesRemainingText = `${invite.used_count} uses`;
          } else {
            const remaining = invite.max_uses - invite.used_count;
            usesRemainingText = `${remaining}/${invite.max_uses} left`;
          }

          return {
            ...invite,
            isExpired,
            isMaxedOut,
            expiresInText,
            usesRemainingText,
          };
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to list invites";
        setError(message);
        return [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Generate the full invite URL
   */
  const getInviteUrl = useCallback((code: string): string => {
    // Use current origin or fallback to localhost
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000";
    return `${origin}/join/${code}`;
  }, []);

  return {
    // State
    loading,
    error,

    // Permission check
    canCreateInvite,

    // Actions
    createChannelInvite,
    getInvite,
    useInviteCode,
    revokeChannelInvite,
    listInvites,

    // Helpers
    getInviteUrl,
  };
}

export default useInvites;

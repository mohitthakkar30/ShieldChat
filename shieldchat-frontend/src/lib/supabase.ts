/**
 * Supabase Client for ShieldChat
 *
 * 1. Message Caching - Stores ENCRYPTED message content (Arcium blobs) for fast retrieval.
 * 2. Channel Invites - Manages invite codes with expiration and usage limits.
 *
 * Privacy model: Same data as IPFS - encrypted, unreadable without channel key.
 * Decryption always happens client-side.
 */

import { createClient } from "@supabase/supabase-js";
import { EncryptedData } from "./arcium";
import { PaymentAttachment } from "./shadowwire";

// Supabase configuration from environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Create Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Database message record schema
 * Matches the Supabase table structure
 */
export interface DbMessage {
  id?: string;
  channel_id: string;
  tx_signature: string;
  sender: string;
  ipfs_cid: string;
  encrypted_data: EncryptedData | null;  // Arcium encrypted blob
  payment?: PaymentAttachment | null;     // Optional payment attachment
  message_number?: number;
  timestamp: string;  // ISO timestamp
  created_at?: string;
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
  if (!configured) {
    // console.log("[Supabase] Not configured - URL:", !!SUPABASE_URL, "Key:", !!SUPABASE_ANON_KEY);
  }
  return configured;
}

/**
 * Fetch all messages for a channel from Supabase cache
 * Returns empty array if not found or on error
 */
export async function fetchMessagesFromCache(
  channelId: string
): Promise<DbMessage[]> {
  if (!isSupabaseConfigured()) {
    // console.log("[Supabase] Not configured, skipping cache fetch");
    return [];
  }

  // console.log("[Supabase] Fetching messages for channel:", channelId.slice(0, 12) + "...");

  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("channel_id", channelId)
      .order("timestamp", { ascending: true });

    if (error) {
      console.error("[Supabase] Error fetching from cache:", error.code, error.message, error.details);
      return [];
    }

    // console.log(`[Supabase] Fetched ${data?.length || 0} messages from cache for channel`);
    if (data && data.length > 0) {
      // console.log("[Supabase] First cached message:", JSON.stringify(data[0]).slice(0, 200));
    }
    return data || [];
  } catch (err) {
    console.error("[Supabase] Cache fetch failed:", err);
    return [];
  }
}

/**
 * Save a single message to Supabase cache
 * Uses upsert to handle duplicates gracefully
 */
export async function saveMessageToCache(message: DbMessage): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const { error } = await supabase
      .from("messages")
      .upsert(
        {
          channel_id: message.channel_id,
          tx_signature: message.tx_signature,
          sender: message.sender,
          ipfs_cid: message.ipfs_cid,
          encrypted_data: message.encrypted_data,
          payment: message.payment || null,
          message_number: message.message_number,
          timestamp: message.timestamp,
        },
        {
          onConflict: "tx_signature",
          ignoreDuplicates: true,
        }
      );

    if (error) {
      // Duplicate key errors are expected and fine
      if (error.code === "23505") {
        return true;
      }
      console.error("[Supabase] Error saving to cache:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Supabase] Cache save failed:", err);
    return false;
  }
}

/**
 * Save multiple messages to Supabase cache (batch insert)
 * Non-blocking, logs errors but doesn't throw
 */
export async function saveMessagesToCache(messages: DbMessage[]): Promise<void> {
  if (!isSupabaseConfigured() || messages.length === 0) {
    // console.log("[Supabase] Skipping save - configured:", isSupabaseConfigured(), "messages:", messages.length);
    return;
  }

  // console.log("[Supabase] Attempting to save", messages.length, "messages to cache");

  try {
    const payload = messages.map(m => ({
      channel_id: m.channel_id,
      tx_signature: m.tx_signature,
      sender: m.sender,
      ipfs_cid: m.ipfs_cid,
      encrypted_data: m.encrypted_data,
      payment: m.payment || null,
      message_number: m.message_number,
      timestamp: m.timestamp,
    }));

    // console.log("[Supabase] Save payload sample:", JSON.stringify(payload[0]).slice(0, 200));

    const { data, error } = await supabase
      .from("messages")
      .upsert(payload, {
        onConflict: "tx_signature",
        ignoreDuplicates: false,  // Changed: Update if exists
      })
      .select();

    if (error) {
      console.error("[Supabase] Batch save error:", error.code, error.message, error.details);
    } else {
      // console.log(`[Supabase] Successfully saved ${data?.length || 0} messages to cache`);
    }
  } catch (err) {
    console.error("[Supabase] Batch save failed:", err);
  }
}

/**
 * Check if a message exists in cache by tx_signature
 */
export async function messageExistsInCache(txSignature: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const { data, error } = await supabase
      .from("messages")
      .select("id")
      .eq("tx_signature", txSignature)
      .limit(1);

    if (error) {
      return false;
    }

    return (data?.length || 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Delete all cached messages for a channel
 * Useful for cache invalidation
 */
export async function clearChannelCache(channelId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("channel_id", channelId);

    if (error) {
      console.error("[Supabase] Error clearing cache:", error.message);
      return false;
    }

    // console.log(`[Supabase] Cleared cache for channel: ${channelId.slice(0, 8)}...`);
    return true;
  } catch (err) {
    console.error("[Supabase] Cache clear failed:", err);
    return false;
  }
}

// ==================== CHANNEL INVITES ====================

/**
 * Invite record schema
 */
export interface DbInvite {
  id?: string;
  code: string;
  channel_pda: string;
  created_by: string;
  invite_type: "standard" | "one_time" | "admin";
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at?: string;
}

/**
 * Invite redemption record
 */
export interface DbInviteRedemption {
  id?: string;
  invite_id: string;
  redeemed_by: string;
  redeemed_at?: string;
}

/**
 * Options for creating an invite
 */
export interface CreateInviteOptions {
  maxUses?: number | null;       // null = unlimited
  expiresIn?: number | null;     // milliseconds from now, null = never
  inviteType?: "standard" | "one_time" | "admin";
}

/**
 * Generate a short, memorable invite code
 * Format: XXXX-XXXX (e.g., K7XM-9NPQ)
 * Uses characters that are unambiguous (no 0/O, 1/I/L)
 */
export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const segment = (len: number) =>
    Array.from({ length: len }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  return `${segment(4)}-${segment(4)}`;
}

/**
 * Create a new invite code for a channel
 */
export async function createInvite(
  channelPda: string,
  createdBy: string,
  options: CreateInviteOptions = {}
): Promise<DbInvite | null> {
  if (!isSupabaseConfigured()) {
    console.error("[Supabase] Not configured, cannot create invite");
    return null;
  }

  const code = generateInviteCode();
  const expiresAt = options.expiresIn
    ? new Date(Date.now() + options.expiresIn).toISOString()
    : null;

  try {
    const { data, error } = await supabase
      .from("channel_invites")
      .insert({
        code,
        channel_pda: channelPda,
        created_by: createdBy,
        invite_type: options.inviteType || "standard",
        max_uses: options.maxUses ?? null,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      console.error("[Supabase] Error creating invite:", error.message);
      return null;
    }

    // console.log(`[Supabase] Created invite ${code} for channel ${channelPda.slice(0, 8)}...`);
    return data;
  } catch (err) {
    console.error("[Supabase] Create invite failed:", err);
    return null;
  }
}

/**
 * Get an invite by code
 * Returns null if not found, expired, or maxed out
 */
export async function getInviteByCode(code: string): Promise<DbInvite | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("channel_invites")
      .select("*")
      .eq("code", code.toUpperCase())
      .eq("is_active", true)
      .single();

    if (error || !data) {
      // console.log("[Supabase] Invite not found:", code);
      return null;
    }

    // Check expiration
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      // console.log("[Supabase] Invite expired:", code);
      return null;
    }

    // Check usage limit
    if (data.max_uses !== null && data.used_count >= data.max_uses) {
      // console.log("[Supabase] Invite maxed out:", code);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[Supabase] Get invite failed:", err);
    return null;
  }
}

/**
 * Redeem an invite code
 * Increments used_count and records the redemption
 * Returns the channel PDA if successful
 */
export async function redeemInvite(
  code: string,
  redeemedBy: string
): Promise<{ channelPda: string; invite: DbInvite } | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    // Get the invite first
    const invite = await getInviteByCode(code);
    if (!invite) {
      return null;
    }

    // Check if user already redeemed this invite
    const { data: existingRedemption } = await supabase
      .from("invite_redemptions")
      .select("id")
      .eq("invite_id", invite.id)
      .eq("redeemed_by", redeemedBy)
      .single();

    if (existingRedemption) {
      // console.log("[Supabase] User already redeemed this invite");
      // Still return success - they can join the channel
      return { channelPda: invite.channel_pda, invite };
    }

    // Record redemption
    const { error: redemptionError } = await supabase
      .from("invite_redemptions")
      .insert({
        invite_id: invite.id,
        redeemed_by: redeemedBy,
      });

    if (redemptionError) {
      console.error("[Supabase] Error recording redemption:", redemptionError.message);
      // Don't fail - still allow joining
    }

    // Increment used_count
    const { error: updateError } = await supabase
      .from("channel_invites")
      .update({ used_count: invite.used_count + 1 })
      .eq("id", invite.id);

    if (updateError) {
      console.error("[Supabase] Error updating invite count:", updateError.message);
    }

    // console.log(`[Supabase] Invite ${code} redeemed by ${redeemedBy.slice(0, 8)}...`);
    return { channelPda: invite.channel_pda, invite };
  } catch (err) {
    console.error("[Supabase] Redeem invite failed:", err);
    return null;
  }
}

/**
 * Revoke an invite (set is_active = false)
 */
export async function revokeInvite(inviteId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const { error } = await supabase
      .from("channel_invites")
      .update({ is_active: false })
      .eq("id", inviteId);

    if (error) {
      console.error("[Supabase] Error revoking invite:", error.message);
      return false;
    }

    // console.log(`[Supabase] Revoked invite: ${inviteId}`);
    return true;
  } catch (err) {
    console.error("[Supabase] Revoke invite failed:", err);
    return false;
  }
}

/**
 * List all invites for a channel
 */
export async function listChannelInvites(channelPda: string): Promise<DbInvite[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("channel_invites")
      .select("*")
      .eq("channel_pda", channelPda)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Supabase] Error listing invites:", error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("[Supabase] List invites failed:", err);
    return [];
  }
}

/**
 * Get redemptions for an invite
 */
export async function getInviteRedemptions(inviteId: string): Promise<DbInviteRedemption[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("invite_redemptions")
      .select("*")
      .eq("invite_id", inviteId)
      .order("redeemed_at", { ascending: false });

    if (error) {
      console.error("[Supabase] Error getting redemptions:", error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("[Supabase] Get redemptions failed:", err);
    return [];
  }
}

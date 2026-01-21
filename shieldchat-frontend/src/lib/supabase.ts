/**
 * Supabase Client for ShieldChat Message Caching
 *
 * Stores ENCRYPTED message content (Arcium blobs) for fast retrieval.
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
    console.log("[Supabase] Not configured - URL:", !!SUPABASE_URL, "Key:", !!SUPABASE_ANON_KEY);
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
    console.log("[Supabase] Not configured, skipping cache fetch");
    return [];
  }

  console.log("[Supabase] Fetching messages for channel:", channelId.slice(0, 12) + "...");

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

    console.log(`[Supabase] Fetched ${data?.length || 0} messages from cache for channel`);
    if (data && data.length > 0) {
      console.log("[Supabase] First cached message:", JSON.stringify(data[0]).slice(0, 200));
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
    console.log("[Supabase] Skipping save - configured:", isSupabaseConfigured(), "messages:", messages.length);
    return;
  }

  console.log("[Supabase] Attempting to save", messages.length, "messages to cache");

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

    console.log("[Supabase] Save payload sample:", JSON.stringify(payload[0]).slice(0, 200));

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
      console.log(`[Supabase] Successfully saved ${data?.length || 0} messages to cache`);
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

    console.log(`[Supabase] Cleared cache for channel: ${channelId.slice(0, 8)}...`);
    return true;
  } catch (err) {
    console.error("[Supabase] Cache clear failed:", err);
    return false;
  }
}

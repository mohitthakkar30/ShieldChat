"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { PublicKey, Connection, VersionedTransactionResponse } from "@solana/web3.js";
import { fetchMessage, IPFSMessage, uploadMessage } from "@/lib/ipfs";
import { RPC_ENDPOINT, PROGRAM_ID } from "@/lib/constants";
import {
  encryptMessage,
  decryptMessage,
  EncryptedData,
} from "@/lib/arcium";
import { PaymentAttachment } from "@/lib/shadowwire";
import {
  fetchMessagesFromCache,
  saveMessageToCache,
  saveMessagesToCache,
  DbMessage,
  isSupabaseConfigured,
} from "@/lib/supabase";

// MessageLogged event discriminator from IDL
const MESSAGE_LOGGED_DISCRIMINATOR = [24, 236, 247, 207, 227, 70, 101, 210];

interface ParsedMessageLoggedEvent {
  channel: PublicKey;
  sender: PublicKey;
  messageHash: Uint8Array;
  encryptedIpfsCid: string;
  messageNumber: bigint;
  timestamp: bigint;
}

/**
 * Parse MessageLogged event from Anchor program logs
 * Anchor events are emitted as base64-encoded data in "Program data:" logs
 */
function parseMessageLoggedEvent(logs: string[]): ParsedMessageLoggedEvent | null {
  try {
    // Find the "Program data:" log that contains our event
    for (const log of logs) {
      if (!log.startsWith("Program data: ")) continue;

      const base64Data = log.slice("Program data: ".length);
      const data = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      // Check if this matches our event discriminator
      const discriminator = Array.from(data.slice(0, 8));
      const matches = discriminator.every((b, i) => b === MESSAGE_LOGGED_DISCRIMINATOR[i]);

      if (!matches) {
        continue;
      }

      // Parse the event data:
      // - 8 bytes: discriminator (already checked)
      // - 32 bytes: channel (pubkey)
      // - 32 bytes: sender (pubkey)
      // - 32 bytes: message_hash ([u8; 32])
      // - 4 bytes: encrypted_ipfs_cid length (u32 LE)
      // - N bytes: encrypted_ipfs_cid data
      // - 8 bytes: message_number (u64)
      // - 8 bytes: timestamp (i64)

      let offset = 8;

      // channel (32 bytes)
      const channel = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;

      // sender (32 bytes)
      const sender = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;

      // message_hash (32 bytes fixed array)
      const messageHash = data.slice(offset, offset + 32);
      offset += 32;

      // encrypted_ipfs_cid (length-prefixed bytes)
      const cidLength = data[offset] |
                       (data[offset + 1] << 8) |
                       (data[offset + 2] << 16) |
                       (data[offset + 3] << 24);
      offset += 4;

      const cidBytes = data.slice(offset, offset + cidLength);
      const encryptedIpfsCid = new TextDecoder().decode(cidBytes);
      offset += cidLength;

      // message_number (8 bytes u64 LE)
      const messageNumber = BigInt(data[offset]) |
                           (BigInt(data[offset + 1]) << BigInt(8)) |
                           (BigInt(data[offset + 2]) << BigInt(16)) |
                           (BigInt(data[offset + 3]) << BigInt(24)) |
                           (BigInt(data[offset + 4]) << BigInt(32)) |
                           (BigInt(data[offset + 5]) << BigInt(40)) |
                           (BigInt(data[offset + 6]) << BigInt(48)) |
                           (BigInt(data[offset + 7]) << BigInt(56));
      offset += 8;

      // timestamp (8 bytes i64 LE)
      const timestamp = BigInt(data[offset]) |
                       (BigInt(data[offset + 1]) << BigInt(8)) |
                       (BigInt(data[offset + 2]) << BigInt(16)) |
                       (BigInt(data[offset + 3]) << BigInt(24)) |
                       (BigInt(data[offset + 4]) << BigInt(32)) |
                       (BigInt(data[offset + 5]) << BigInt(40)) |
                       (BigInt(data[offset + 6]) << BigInt(48)) |
                       (BigInt(data[offset + 7]) << BigInt(56));

      return {
        channel,
        sender,
        messageHash,
        encryptedIpfsCid,
        messageNumber,
        timestamp,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export interface PollResultAttachment {
  pollId: string;
  question: string;
  options: Array<{ text: string; votes: number }>;
  totalVotes: number;
  creator: string;
  revealedAt: string;
}

export interface GameAttachment {
  gameId: string;
  gameType: "tictactoe";
  state: string; // "waiting" | "in_progress" | "x_wins" | "o_wins" | "draw" | "cancelled"
  playerX: string;
  playerO?: string;
  winner?: string;
  wager: number; // in lamports
  createdAt: string;
  board?: number[]; // final board state for results
}

export interface ChatMessage {
  id: string;
  content: string;
  sender: string;
  timestamp: string;
  txSignature?: string;
  payment?: PaymentAttachment;
  pollResult?: PollResultAttachment;
  game?: GameAttachment;
}

/**
 * Try to parse game attachment from message content
 * Returns game attachment if content is a game message, null otherwise
 */
function parseGameContent(content: string): GameAttachment | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed.type === "game_created" || parsed.type === "game_result" || parsed.type === "game_joined") {
      return {
        gameId: parsed.gameId,
        gameType: parsed.gameType || "tictactoe",
        state: parsed.state,
        playerX: parsed.playerX,
        playerO: parsed.playerO,
        winner: parsed.winner,
        wager: Number(parsed.wager),
        createdAt: parsed.createdAt,
        board: parsed.board,
      };
    }
  } catch {
    // Not JSON or not a game message, ignore
  }
  return null;
}

/**
 * Extract CID from raw instruction data (from Helius WebSocket)
 * The logMessage instruction format:
 * - 8 bytes: Anchor discriminator
 * - 32 bytes: message_hash [u8; 32]
 * - 4 bytes: length of encrypted_ipfs_cid (Vec length prefix, little-endian)
 * - N bytes: encrypted_ipfs_cid data
 */
export function extractCidFromInstructionData(data: Uint8Array): string | null {
  try {
    if (data.length < 44) return null; // 8 + 32 + 4 = 44 minimum

    // Skip discriminator (8) and hash (32)
    const cidLengthOffset = 40;
    const cidLength = data[cidLengthOffset] |
                     (data[cidLengthOffset + 1] << 8) |
                     (data[cidLengthOffset + 2] << 16) |
                     (data[cidLengthOffset + 3] << 24);

    if (cidLength <= 0 || cidLength > 500) return null;

    const cidStart = cidLengthOffset + 4;
    const cidEnd = cidStart + cidLength;
    if (cidEnd > data.length) return null;

    const cidBytes = data.slice(cidStart, cidEnd);
    const cid = new TextDecoder().decode(cidBytes);

    // Validate it looks like a CID
    if (cid.startsWith("data:") || cid.startsWith("Qm") || cid.startsWith("bafy") || /^[a-zA-Z0-9_]+/.test(cid)) {
      return cid;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract CID from transaction instruction data
 * The logMessage instruction format:
 * - 8 bytes: Anchor discriminator
 * - 32 bytes: message_hash [u8; 32]
 * - 4 bytes: length of encrypted_ipfs_cid (Vec length prefix, little-endian)
 * - N bytes: encrypted_ipfs_cid data
 */
function extractCidFromTx(tx: VersionedTransactionResponse): string | null {
  try {
    const message = tx.transaction.message;
    const accountKeys = message.staticAccountKeys;
    const programIdStr = PROGRAM_ID.toString();

    // For versioned transactions, use compiledInstructions
    if ("compiledInstructions" in message) {
      for (const ix of message.compiledInstructions) {
        const programId = accountKeys[ix.programIdIndex]?.toString();
        if (programId !== programIdStr) continue;

        const data = ix.data;
        if (data.length > 44) { // 8 + 32 + 4 = 44 minimum
          // Skip discriminator (8) and hash (32)
          const cidLengthOffset = 40;
          const cidLength = data[cidLengthOffset] |
                           (data[cidLengthOffset + 1] << 8) |
                           (data[cidLengthOffset + 2] << 16) |
                           (data[cidLengthOffset + 3] << 24);

          if (cidLength > 0 && cidLength < 500) {
            const cidStart = cidLengthOffset + 4;
            const cidEnd = cidStart + cidLength;
            if (cidEnd <= data.length) {
              const cidBytes = data.slice(cidStart, cidEnd);
              const cid = new TextDecoder().decode(cidBytes);
              // Validate it looks like a CID
              if (cid.startsWith("data:") || cid.startsWith("Qm") || cid.startsWith("bafy") || /^[a-zA-Z0-9_]+/.test(cid)) {
                return cid;
              }
            }
          }
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Hook for managing channel messages
 * Fetches messages from on-chain events and IPFS
 */
export function useMessages(channelPda: PublicKey | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Track current messages count to avoid showing loading when we have data
  const messagesRef = useRef<ChatMessage[]>([]);

  // Track current channel to prevent stale data from old fetches
  const currentChannelRef = useRef<string | null>(null);

  // Update current channel ref when channel changes
  // NOTE: We intentionally do NOT clear messages here - keep stale data visible
  // while new messages load. This prevents skeleton flash during decryption.
  // The new channel's messages will replace old ones when fetchChannelMessages completes.
  useEffect(() => {
    const channelId = channelPda?.toString() || null;
    currentChannelRef.current = channelId;

    // Don't clear messages - keep stale visible while loading (better UX)
    // setMessages([]);
    // messagesRef.current = [];

    setError(null);
    setLoading(false);
    isFetchingRef.current = false; // Reset fetch lock so new channel can fetch

    // Stop any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, [channelPda?.toString()]);

  /**
   * Fetch messages from Solana/IPFS (original flow)
   * Used as fallback when Supabase cache is empty or fails
   */
  const fetchFromSolanaAndIPFS = useCallback(async (): Promise<{
    messages: ChatMessage[];
    dbMessages: DbMessage[];
  }> => {
    if (!channelPda) {
      return { messages: [], dbMessages: [] };
    }

    const connection = new Connection(RPC_ENDPOINT, {
      commitment: "confirmed",
      confirmTransactionInitialTimeout: 30000,
    });

    // Get recent signatures for the channel account
    const signatures = await connection.getSignaturesForAddress(
      channelPda,
      { limit: 50 },
      "confirmed"
    );

    if (signatures.length === 0) {
      return { messages: [], dbMessages: [] };
    }

    // Fetch transaction details in parallel batches
    const BATCH_SIZE = 5;
    const txs: (VersionedTransactionResponse | null)[] = [];

    for (let i = 0; i < signatures.length; i += BATCH_SIZE) {
      const batch = signatures.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (sig) => {
          try {
            const tx = await connection.getTransaction(sig.signature, {
              maxSupportedTransactionVersion: 0,
            });
            return tx;
          } catch {
            return null;
          }
        })
      );

      txs.push(...batchResults);
    }

    const parsedMessages: ChatMessage[] = [];
    const dbMessages: DbMessage[] = [];

    for (const tx of txs) {
      if (!tx || !tx.meta || !tx.meta.logMessages) {
        continue;
      }

      const logs = tx.meta.logMessages;

      // Try to parse MessageLogged event from logs (primary method)
      const event = parseMessageLoggedEvent(logs);

      if (event) {
        const txTimestamp = new Date(
          Number(event.timestamp) * 1000
        ).toISOString();

        let content = `Message #${event.messageNumber.toString()}`;
        let payment: PaymentAttachment | undefined;
        let encryptedData: EncryptedData | null = null;

        // Fetch content from IPFS using the CID from the event
        if (event.encryptedIpfsCid) {
          try {
            const ipfsMessage = await fetchMessage(event.encryptedIpfsCid);
            if (ipfsMessage) {
              // Extract payment attachment if present
              payment = ipfsMessage.payment;

              // Store encrypted data for caching
              if (ipfsMessage.encrypted && ipfsMessage.encryptedData) {
                encryptedData = ipfsMessage.encryptedData;
              }

              // Check if message is encrypted and decrypt it
              if (ipfsMessage.encrypted && ipfsMessage.encryptedData && channelPda) {
                try {
                  // Pass channelPda string directly - Arcium SDK derives keys internally
                  content = await decryptMessage(ipfsMessage.encryptedData, channelPda.toString());
                } catch (decryptErr) {
                  console.error("Failed to decrypt message:", decryptErr);
                  content = "[Encrypted message - decryption failed]";
                }
              } else {
                content = ipfsMessage.content;
              }
            }
          } catch {
            // IPFS fetch failed, use default content
          }
        }

        const txSignature = tx.transaction.signatures[0];

        // Check if content is a game message
        const gameAttachment = parseGameContent(content);

        parsedMessages.push({
          id: `${txSignature}-${event.messageNumber.toString()}`,
          content: gameAttachment ? "" : content, // Empty content for game messages
          sender: event.sender.toString(),
          timestamp: txTimestamp,
          txSignature,
          payment,
          game: gameAttachment || undefined,
        });

        // Prepare for Supabase cache
        dbMessages.push({
          channel_id: channelPda.toString(),
          tx_signature: txSignature,
          sender: event.sender.toString(),
          ipfs_cid: event.encryptedIpfsCid,
          encrypted_data: encryptedData,
          payment: payment || null,
          message_number: Number(event.messageNumber),
          timestamp: txTimestamp,
        });
      } else {
        // Fallback: Look for MessageLogged text in logs
        const programLog = logs.find(log =>
          log.includes("Program log: Message logged:")
        );

        if (programLog) {
          const match = programLog.match(/Message logged: #(\d+)/);
          const messageNumber = match ? match[1] : "0";

          const accountKeys = tx.transaction.message.staticAccountKeys;
          const sender = accountKeys[0]?.toString() || "Unknown";
          const txTimestamp = new Date(
            (tx.blockTime || Date.now() / 1000) * 1000
          ).toISOString();

          // Try to extract CID from instruction data (fallback)
          const cid = extractCidFromTx(tx);
          let content = `Message #${messageNumber}`;
          let payment: PaymentAttachment | undefined;
          let encryptedData: EncryptedData | null = null;

          if (cid) {
            try {
              const ipfsMessage = await fetchMessage(cid);
              if (ipfsMessage) {
                // Extract payment attachment if present
                payment = ipfsMessage.payment;

                // Store encrypted data for caching
                if (ipfsMessage.encrypted && ipfsMessage.encryptedData) {
                  encryptedData = ipfsMessage.encryptedData;
                }

                // Check if message is encrypted and decrypt it
                if (ipfsMessage.encrypted && ipfsMessage.encryptedData && channelPda) {
                  try {
                    // Pass channelPda string directly - Arcium SDK derives keys internally
                    content = await decryptMessage(ipfsMessage.encryptedData, channelPda.toString());
                  } catch (decryptErr) {
                    console.error("Failed to decrypt message:", decryptErr);
                    content = "[Encrypted message - decryption failed]";
                  }
                } else {
                  content = ipfsMessage.content;
                }
              }
            } catch {
              // IPFS fetch failed, use default content
            }
          }

          const txSignature = tx.transaction.signatures[0];

          // Check if content is a game message
          const gameAttachment = parseGameContent(content);

          parsedMessages.push({
            id: `${txSignature}-${messageNumber}`,
            content: gameAttachment ? "" : content, // Empty content for game messages
            sender,
            timestamp: txTimestamp,
            txSignature,
            payment,
            game: gameAttachment || undefined,
          });

          // Prepare for Supabase cache
          if (cid) {
            dbMessages.push({
              channel_id: channelPda.toString(),
              tx_signature: txSignature,
              sender,
              ipfs_cid: cid,
              encrypted_data: encryptedData,
              payment: payment || null,
              message_number: Number(messageNumber),
              timestamp: txTimestamp,
            });
          }
        }
      }
    }

    // Sort by timestamp (oldest first)
    parsedMessages.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return { messages: parsedMessages, dbMessages };
  }, [channelPda]);

  /**
   * Fetch messages for a channel
   * Primary: Supabase cache (fast)
   * Fallback: Solana/IPFS (reliable)
   * @param isBackgroundRefresh - If true, don't show loading state (keeps messages visible)
   */
  const fetchChannelMessages = useCallback(async (isBackgroundRefresh = false) => {
    if (!channelPda) {
      return [];
    }

    const channelId = channelPda.toString();

    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      return [];
    }

    isFetchingRef.current = true;
    // Only show loading spinner if:
    // 1. Not a background refresh AND
    // 2. We don't have any existing messages (otherwise show stale data while refreshing)
    const hasExistingMessages = messagesRef.current.length > 0;
    if (!isBackgroundRefresh && !hasExistingMessages) {
      setLoading(true);
    }
    setError(null);

    try {
      // Try Supabase cache first (fast path)
      if (isSupabaseConfigured()) {
        try {
          const cachedMessages = await fetchMessagesFromCache(channelId);

          // Check if channel changed during fetch
          if (currentChannelRef.current !== channelId) {
            console.log("[useMessages] Channel changed during cache fetch, aborting");
            return [];
          }

          if (cachedMessages.length > 0) {
            console.log(`[useMessages] Using ${cachedMessages.length} cached messages from Supabase`);

            // Decrypt cached messages IN PARALLEL for faster loading
            const decryptionPromises = cachedMessages.map(async (cached) => {
              let content = "[Encrypted message]";

              // Decrypt if we have encrypted data
              if (cached.encrypted_data) {
                try {
                  content = await decryptMessage(cached.encrypted_data, channelId);
                } catch (decryptErr) {
                  console.error("Failed to decrypt cached message:", decryptErr);
                  content = "[Encrypted message - decryption failed]";
                }
              } else if (cached.ipfs_cid) {
                // No encrypted data - fetch from IPFS (for game messages, etc.)
                try {
                  const ipfsMessage = await fetchMessage(cached.ipfs_cid);
                  if (ipfsMessage) {
                    content = ipfsMessage.content;
                  }
                } catch {
                  // IPFS fetch failed, keep default content
                }
              }

              // Check if content is a game message
              const gameAttachment = parseGameContent(content);

              return {
                id: `${cached.tx_signature}-${cached.message_number || 0}`,
                content: gameAttachment ? "" : content, // Empty content for game messages
                sender: cached.sender,
                timestamp: cached.timestamp,
                txSignature: cached.tx_signature,
                payment: cached.payment || undefined,
                game: gameAttachment || undefined,
              } as ChatMessage;
            });

            const decryptedMessages = await Promise.all(decryptionPromises);

            // Check if channel changed during decryption
            if (currentChannelRef.current !== channelId) {
              console.log("[useMessages] Channel changed during decryption, aborting");
              return [];
            }

            // Final check before setting state
            if (currentChannelRef.current === channelId) {
              messagesRef.current = decryptedMessages;
              setMessages(decryptedMessages);
            }

            // BACKFILL: Fetch from IPFS in background to sync any missing messages
            // This runs after returning cached messages for fast initial load
            const cachedCount = cachedMessages.length;
            fetchFromSolanaAndIPFS().then(({ messages: ipfsMessages, dbMessages }) => {
              // Only backfill if still on same channel
              if (currentChannelRef.current !== channelId) return;

              if (dbMessages.length > cachedCount) {
                console.log(`[useMessages] Backfilling ${dbMessages.length - cachedCount} missing messages to cache`);
                saveMessagesToCache(dbMessages);

                // Also update the displayed messages with the full list
                messagesRef.current = ipfsMessages;
                setMessages(ipfsMessages);
              }
            }).catch(err => {
              console.error("[useMessages] Backfill failed:", err);
            });

            return decryptedMessages;
          }
        } catch (cacheErr) {
          console.error("[useMessages] Supabase cache error, falling back to IPFS:", cacheErr);
          // Continue to IPFS fallback
        }
      }

      // Check if channel changed before IPFS fallback
      if (currentChannelRef.current !== channelId) {
        console.log("[useMessages] Channel changed before IPFS fetch, aborting");
        return [];
      }

      // Fallback: Fetch from Solana/IPFS
      console.log("[useMessages] Cache miss or not configured, fetching from Solana/IPFS");
      const { messages: parsedMessages, dbMessages } = await fetchFromSolanaAndIPFS();

      // Final check before setting state
      if (currentChannelRef.current === channelId) {
        messagesRef.current = parsedMessages;
        setMessages(parsedMessages);

        // Async: Save to Supabase for next time (non-blocking)
        if (isSupabaseConfigured() && dbMessages.length > 0) {
          saveMessagesToCache(dbMessages).catch(err => {
            console.error("[useMessages] Failed to save to cache:", err);
          });
        }
      }

      return parsedMessages;
    } catch (err) {
      // Only set error if still on same channel
      if (currentChannelRef.current === channelId) {
        const message = err instanceof Error ? err.message : "Failed to fetch messages";
        setError(message);
      }
      return [];
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [channelPda, fetchFromSolanaAndIPFS]);

  /**
   * Add a new message locally (optimistic update)
   * The actual message is stored encrypted on IPFS and logged on-chain separately
   * Optionally includes a payment attachment
   */
  const addLocalMessage = useCallback(
    async (
      content: string,
      sender: string,
      channelId: string,
      payment?: PaymentAttachment
    ) => {
      // Encrypt the message content before storing
      let encryptedData: EncryptedData | undefined;
      let isEncrypted = false;

      if (channelPda) {
        try {
          // Pass channelPda string directly - Arcium SDK derives keys internally
          encryptedData = await encryptMessage(content, channelPda.toString());
          isEncrypted = true;
          console.log("Message encrypted successfully with Arcium RescueCipher");
        } catch (err) {
          console.error("Encryption failed, storing unencrypted:", err);
        }
      }

      const ipfsMessage: IPFSMessage = {
        content: isEncrypted ? "[Encrypted]" : content, // Placeholder for encrypted
        sender,
        timestamp: Date.now(),
        channelId,
        encrypted: isEncrypted,
        encryptedData: encryptedData,
        payment: payment, // Include payment attachment if present
      };

      // Upload to IPFS (or use demo storage)
      const cid = await uploadMessage(ipfsMessage);

      // Create local message for immediate display (show original content)
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        content, // Show original content locally
        sender: sender,
        timestamp: new Date().toISOString(),
        payment: payment, // Include payment for local display
      };

      setMessages(prev => {
        const updated = [...prev, newMessage];
        messagesRef.current = updated;
        return updated;
      });

      return cid;
    },
    [channelPda]
  );

  /**
   * Clear messages (for cleanup)
   */
  const clearMessages = useCallback(() => {
    messagesRef.current = [];
    setMessages([]);
  }, []);

  /**
   * Add a single message from Helius WebSocket notification
   * This is faster than re-fetching all messages
   * Also saves to Supabase cache for future loads
   */
  const addMessageFromHelius = useCallback(
    async (
      instructionData: Uint8Array | null,
      sender: string | null,
      signature: string,
      timestamp: number
    ): Promise<boolean> => {
      if (!instructionData || !channelPda) {
        console.log("[useMessages] No instruction data or channelPda, skipping");
        return false;
      }

      const channelId = channelPda.toString();

      // Check if still on same channel
      if (currentChannelRef.current !== channelId) {
        console.log("[useMessages] Channel changed, ignoring Helius message");
        return false;
      }

      // Extract CID from instruction data
      const cid = extractCidFromInstructionData(instructionData);
      if (!cid) {
        console.log("[useMessages] Could not extract CID from instruction data");
        return false;
      }

      console.log("[useMessages] Extracted CID from Helius:", cid.slice(0, 20) + "...");

      try {
        // Fetch message from IPFS
        const ipfsMessage = await fetchMessage(cid);
        if (!ipfsMessage) {
          console.log("[useMessages] Could not fetch message from IPFS");
          return false;
        }

        // Check again after IPFS fetch
        if (currentChannelRef.current !== channelId) {
          console.log("[useMessages] Channel changed during IPFS fetch, ignoring");
          return false;
        }

        let content = ipfsMessage.content;
        const senderAddress = sender || "Unknown";
        const messageTimestamp = new Date(timestamp * 1000).toISOString();

        // Decrypt if encrypted
        if (ipfsMessage.encrypted && ipfsMessage.encryptedData) {
          try {
            content = await decryptMessage(ipfsMessage.encryptedData, channelId);
            console.log("[useMessages] Decrypted message from Helius");
          } catch (decryptErr) {
            console.error("[useMessages] Failed to decrypt:", decryptErr);
            content = "[Encrypted message - decryption failed]";
          }
        }

        // Final check before updating state
        if (currentChannelRef.current !== channelId) {
          console.log("[useMessages] Channel changed during decryption, ignoring");
          return false;
        }

        // Check if content is a game message
        const gameAttachment = parseGameContent(content);

        // Create the message object
        const newMessage: ChatMessage = {
          id: `${signature}-helius`,
          content: gameAttachment ? "" : content, // Empty content for game messages
          sender: senderAddress,
          timestamp: messageTimestamp,
          txSignature: signature,
          payment: ipfsMessage.payment, // Include payment attachment if present
          game: gameAttachment || undefined,
        };

        // Add to messages if not already present (avoid duplicates)
        setMessages(prev => {
          // Check if message already exists
          const exists = prev.some(m =>
            m.txSignature === signature ||
            (m.content === content && m.sender === newMessage.sender)
          );
          if (exists) {
            console.log("[useMessages] Message already exists, skipping");
            return prev;
          }
          console.log("[useMessages] Added message from Helius:", content.slice(0, 30) + "...");
          const updated = [...prev, newMessage];
          messagesRef.current = updated;
          return updated;
        });

        // Async: Save to Supabase cache (non-blocking)
        if (isSupabaseConfigured()) {
          const dbMessage: DbMessage = {
            channel_id: channelPda.toString(),
            tx_signature: signature,
            sender: senderAddress,
            ipfs_cid: cid,
            encrypted_data: ipfsMessage.encrypted && ipfsMessage.encryptedData
              ? ipfsMessage.encryptedData
              : null,
            payment: ipfsMessage.payment || null,
            timestamp: messageTimestamp,
          };

          saveMessageToCache(dbMessage).catch(err => {
            console.error("[useMessages] Failed to cache Helius message:", err);
          });
        }

        return true;
      } catch (err) {
        console.error("[useMessages] Error adding message from Helius:", err);
        return false;
      }
    },
    [channelPda]
  );

  // Store fetchChannelMessages in a ref so polling doesn't depend on it
  const fetchMessagesRef = useRef(fetchChannelMessages);
  fetchMessagesRef.current = fetchChannelMessages;

  /**
   * Start polling for new messages every 3 seconds
   */
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(() => {
      fetchMessagesRef.current(true);
    }, 3000);
  }, []);

  /**
   * Stop polling for messages
   */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  return {
    messages,
    loading,
    error,
    fetchChannelMessages,
    addLocalMessage,
    addMessageFromHelius,
    clearMessages,
    startPolling,
    stopPolling,
  };
}

export default useMessages;

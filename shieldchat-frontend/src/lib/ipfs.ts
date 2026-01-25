/**
 * IPFS Storage Client for ShieldChat
 *
 * Uses Pinata for decentralized message storage.
 * Falls back to demo mode (base64 encoding) if Pinata is not configured.
 * Supports encrypted content via Arcium-style encryption.
 */

import { EncryptedData } from "./arcium";
import { PaymentAttachment } from "./shadowwire";

// Public IPFS gateways for fetching content
const IPFS_GATEWAYS = [
  "https://plum-absent-hedgehog-929.mypinata.cloud/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://dweb.link/ipfs/",
];

export interface IPFSMessage {
  content: string; // Plaintext or JSON-serialized EncryptedData
  sender: string;
  timestamp: number;
  channelId: string;
  encrypted?: boolean; // Flag indicating if content is encrypted
  encryptedData?: EncryptedData; // Structured encrypted content (optional)
  payment?: PaymentAttachment; // Optional private payment attachment
}

/**
 * Helper function for demo mode encoding
 */
function encodeToDemoMode(message: IPFSMessage): string {
  const jsonStr = JSON.stringify(message);
  const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
  return `data:${base64}`;
}

/**
 * Upload message to IPFS via Pinata
 * Falls back to demo mode if not configured
 */
export async function uploadMessage(message: IPFSMessage): Promise<string> {
  const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT;

  // If no token, use demo mode (base64 encoding)
  if (!PINATA_JWT) {
    console.log("No Pinata JWT, using demo mode");
    return encodeToDemoMode(message);
  }

  try {
    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      body: JSON.stringify({
        pinataContent: message,
        pinataMetadata: {
          name: `shieldchat-${message.channelId}-${message.timestamp}`,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Pinata upload failed: ${response.status}`);
    }

    const data = await response.json();
    console.log("Message uploaded to Pinata:", data.IpfsHash);
    return data.IpfsHash;
  } catch (err) {
    console.error("Pinata upload failed, using demo mode:", err);
    return encodeToDemoMode(message);
  }
}

/**
 * Fetch message from IPFS
 * Handles both inline data (demo) and real IPFS CIDs
 */
export async function fetchMessage(cid: string): Promise<IPFSMessage | null> {
  try {
    // Check if it's inline data (demo mode)
    if (cid.startsWith("data:")) {
      const base64 = cid.slice(5); // Remove "data:" prefix
      const jsonStr = decodeURIComponent(escape(atob(base64)));
      return JSON.parse(jsonStr) as IPFSMessage;
    }

    // Real IPFS CID - try fetching from gateways
    for (const gateway of IPFS_GATEWAYS) {
      try {
        const response = await fetch(`${gateway}${cid}`, {
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (response.ok) {
          const data = await response.json();
          return data as IPFSMessage;
        }
      } catch {
        // Try next gateway
        continue;
      }
    }

    console.error("Failed to fetch from all gateways for CID:", cid);
    return null;
  } catch (err) {
    console.error("Failed to fetch message from IPFS:", err);
    return null;
  }
}

/**
 * Batch fetch multiple messages
 */
export async function fetchMessages(cids: string[]): Promise<IPFSMessage[]> {
  const messages = await Promise.all(
    cids.map(cid => fetchMessage(cid))
  );

  return messages.filter((msg): msg is IPFSMessage => msg !== null);
}

/**
 * Check if IPFS is configured for real uploads
 */
export function isIPFSConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_PINATA_JWT;
}

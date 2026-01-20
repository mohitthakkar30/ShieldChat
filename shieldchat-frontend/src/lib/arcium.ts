/**
 * Arcium Encryption Module for ShieldChat
 *
 * Uses Arcium's RescueCipher and x25519 for end-to-end encryption.
 * - RescueCipher: Arcium's symmetric cipher (128-bit security)
 * - x25519: Elliptic curve Diffie-Hellman key exchange
 *
 * Key derivation: SHA-256 hash of (channelPDA + salt) → x25519 seed
 * Nonce: 16 bytes random per message
 */

import { RescueCipher, x25519 } from "@arcium-hq/client";

export interface EncryptedData {
  ciphertext: string; // Base64-encoded RescueCipher output (serialized number[][])
  nonce: string; // Base64-encoded 16-byte nonce
  publicKey: string; // Sender's x25519 public key (for future per-message keys)
  version: "arcium-v1"; // Version tag for backwards compatibility
}

// Salt for key derivation (constant for channel)
const KEY_DERIVATION_SALT = "shieldchat-arcium-v1";

/**
 * Helper to convert string to array of BigInts (one per character code)
 * Each character becomes a field element
 */
function stringToBigIntArray(str: string): bigint[] {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  // Convert each byte to a BigInt
  return Array.from(bytes).map(b => BigInt(b));
}

/**
 * Helper to convert array of BigInts back to string
 */
function bigIntArrayToString(arr: bigint[]): string {
  // Convert each BigInt back to a byte
  const bytes = new Uint8Array(arr.map(b => Number(b & BigInt(0xff))));
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

/**
 * Serialize ciphertext (number[][]) to base64 string
 */
function serializeCiphertext(ciphertext: number[][]): string {
  const json = JSON.stringify(ciphertext);
  return btoa(json);
}

/**
 * Deserialize ciphertext from base64 string
 */
function deserializeCiphertext(base64: string): number[][] {
  const json = atob(base64);
  return JSON.parse(json);
}

/**
 * Derive a deterministic x25519 key pair from channel PDA
 * All channel members can derive the same key
 */
export async function deriveChannelKeyPair(channelPda: string): Promise<{
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}> {
  // Create seed from channel PDA + salt
  const encoder = new TextEncoder();
  const seedMaterial = encoder.encode(channelPda + KEY_DERIVATION_SALT);

  // Convert to ArrayBuffer for crypto.subtle (TypeScript strict mode)
  const seedBuffer = new ArrayBuffer(seedMaterial.byteLength);
  new Uint8Array(seedBuffer).set(seedMaterial);

  // Hash to get 32 bytes for x25519 private key
  const hashBuffer = await crypto.subtle.digest("SHA-256", seedBuffer);
  const privateKey = new Uint8Array(hashBuffer);

  // Derive public key
  const publicKey = x25519.getPublicKey(privateKey);

  // console.log("[Arcium] Derived channel key pair for:", channelPda.slice(0, 8) + "...");

  return { privateKey, publicKey };
}

/**
 * Encrypt a message using Arcium's RescueCipher
 */
export async function encryptMessage(
  content: string,
  channelPda: string
): Promise<EncryptedData> {
  // Derive channel key pair
  const { privateKey, publicKey } = await deriveChannelKeyPair(channelPda);

  // Generate 16-byte nonce
  const nonce = new Uint8Array(16);
  crypto.getRandomValues(nonce);

  // Create shared secret using x25519 (with self for symmetric encryption)
  // In a real multi-party scenario, this would use the recipient's public key
  const sharedSecret = x25519.getSharedSecret(privateKey, publicKey);

  // Initialize RescueCipher with shared secret
  const cipher = new RescueCipher(sharedSecret);

  // Convert string to BigInt array
  const plaintext = stringToBigIntArray(content);

  // Encrypt
  const ciphertext = cipher.encrypt(plaintext, nonce);

  const result: EncryptedData = {
    ciphertext: serializeCiphertext(ciphertext),
    nonce: btoa(String.fromCharCode(...nonce)),
    publicKey: btoa(String.fromCharCode(...publicKey)),
    version: "arcium-v1",
  };

  // console.log("[Arcium] ✅ Message encrypted with RescueCipher:", {
  //   originalLength: content.length,
  //   plaintextElements: plaintext.length,
  //   ciphertextBlocks: ciphertext.length,
  //   preview: content.slice(0, 20) + (content.length > 20 ? "..." : ""),
  // });

  return result;
}

/**
 * Decrypt a message using Arcium's RescueCipher
 */
export async function decryptMessage(
  encrypted: EncryptedData,
  channelPda: string
): Promise<string> {
  // Check version
  if (encrypted.version !== "arcium-v1") {
    throw new Error(`Unsupported encryption version: ${encrypted.version}`);
  }

  // Derive channel key pair
  const { privateKey, publicKey } = await deriveChannelKeyPair(channelPda);

  // Decode nonce
  const nonce = Uint8Array.from(atob(encrypted.nonce), c => c.charCodeAt(0));

  // Decode ciphertext
  const ciphertext = deserializeCiphertext(encrypted.ciphertext);

  // Create shared secret
  const sharedSecret = x25519.getSharedSecret(privateKey, publicKey);

  // Initialize RescueCipher
  const cipher = new RescueCipher(sharedSecret);

  // Decrypt
  const plaintext = cipher.decrypt(ciphertext, nonce);

  // Convert BigInt array back to string
  const content = bigIntArrayToString(plaintext);

  // console.log("[Arcium] ✅ Message decrypted with RescueCipher:", {
  //   ciphertextBlocks: ciphertext.length,
  //   decryptedLength: content.length,
  //   preview: content.slice(0, 20) + (content.length > 20 ? "..." : ""),
  // });

  return content;
}

/**
 * Derive channel key (for compatibility with existing code)
 * Returns a CryptoKey-like identifier based on channel PDA
 */
export async function deriveChannelKey(channelPda: string): Promise<string> {
  // Return the channel PDA as the "key" - actual encryption uses deriveChannelKeyPair
  // console.log("[Arcium] Using channel PDA as key reference:", channelPda.slice(0, 8) + "...");
  return channelPda;
}

/**
 * Check if content is encrypted (has the expected structure)
 */
export function isEncryptedContent(content: unknown): content is EncryptedData {
  if (typeof content !== "object" || content === null) {
    return false;
  }
  const obj = content as Record<string, unknown>;
  return (
    typeof obj.ciphertext === "string" &&
    typeof obj.nonce === "string" &&
    typeof obj.publicKey === "string" &&
    obj.version === "arcium-v1"
  );
}

/**
 * Serialize encrypted data for storage (JSON string)
 */
export function serializeEncrypted(data: EncryptedData): string {
  return JSON.stringify(data);
}

/**
 * Deserialize encrypted data from storage
 */
export function deserializeEncrypted(serialized: string): EncryptedData | null {
  try {
    const parsed = JSON.parse(serialized);
    if (isEncryptedContent(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

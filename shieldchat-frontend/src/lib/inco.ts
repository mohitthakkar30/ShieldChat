/**
 * Inco Lightning SDK wrapper for ShieldChat voting
 *
 * Provides encrypted computation capabilities for anonymous voting.
 * Uses Inco's FHE (Fully Homomorphic Encryption) to keep individual votes private.
 */

import { encryptValue } from "@inco/solana-sdk/encryption";
import { decrypt } from "@inco/solana-sdk/attested-decrypt";
import { hexToBuffer } from "@inco/solana-sdk/utils";

export { encryptValue, decrypt, hexToBuffer };

/**
 * Encrypt a vote value (typically 1) for anonymous voting
 * @param value - The value to encrypt (usually 1n for a single vote)
 * @returns Hex-encoded encrypted ciphertext
 */
export async function encryptVote(value: bigint = BigInt(1)): Promise<string> {
  return await encryptValue(value);
}

/**
 * Convert hex-encoded ciphertext to Buffer for program instruction
 * @param hexCiphertext - Hex-encoded ciphertext from encryptValue
 * @returns Buffer suitable for Anchor instruction
 */
export function ciphertextToBuffer(hexCiphertext: string): Buffer {
  return hexToBuffer(hexCiphertext);
}

/**
 * Decrypt vote count handles after poll ends
 * @param handles - Array of encrypted vote count handles (as bigint)
 * @param address - Wallet public key
 * @param signMessage - Wallet signMessage function
 * @returns Decrypted plaintexts and Ed25519 instructions
 */
export interface DecryptOptions {
  address: string;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}

export interface DecryptResult {
  plaintexts: string[];
  ed25519Instructions: unknown[];
}

export async function decryptVoteCounts(
  handles: bigint[],
  options: DecryptOptions
): Promise<DecryptResult> {
  // Convert bigint handles to strings as expected by the SDK
  const handleStrings = handles.map((h) => h.toString());
  const result = await decrypt(handleStrings, options);
  return result as DecryptResult;
}

/**
 * Extract handle from Anchor BN or Uint8Array format
 * @param data - BN, number[], or Uint8Array from on-chain account
 * @returns bigint handle suitable for decryption
 */
export function extractHandle(
  data: { toArray?: () => number[] } | number[] | Uint8Array | bigint
): bigint {
  if (typeof data === "bigint") {
    return data;
  }

  if (Array.isArray(data)) {
    // Convert number array to bigint (little-endian)
    const bytes = new Uint8Array(data);
    let result = BigInt(0);
    for (let i = bytes.length - 1; i >= 0; i--) {
      result = (result << BigInt(8)) | BigInt(bytes[i]);
    }
    return result;
  }

  if (data instanceof Uint8Array) {
    let result = BigInt(0);
    for (let i = data.length - 1; i >= 0; i--) {
      result = (result << BigInt(8)) | BigInt(data[i]);
    }
    return result;
  }

  // Handle Anchor BN type
  if (data && typeof data === "object" && "toArray" in data && data.toArray) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arr = (data.toArray as any)("le", 16) as number[];
    return extractHandle(arr);
  }

  throw new Error("Invalid handle format");
}

import { Program, AnchorProvider, Idl } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import idl from "@/idl/shield_chat.json";
import { PROGRAM_ID, RPC_ENDPOINT } from "./constants";

// Type for the ShieldChat program
export type ShieldChatProgram = Program<ShieldChatIDL>;

// IDL Type (simplified - you can expand this based on IDL)
export interface ShieldChatIDL extends Idl {
  address: string;
  metadata: {
    name: string;
    version: string;
    spec: string;
    description: string;
  };
}

// Get connection to Solana
export function getConnection(): Connection {
  return new Connection(RPC_ENDPOINT, "confirmed");
}

// Get Anchor provider
export function getProvider(wallet: AnchorWallet): AnchorProvider {
  const connection = getConnection();
  return new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
}

// Get ShieldChat program
export function getProgram(wallet: AnchorWallet): ShieldChatProgram {
  const provider = getProvider(wallet);
  return new Program(idl as ShieldChatIDL, provider);
}

// Get program with read-only connection (no wallet needed)
export function getReadOnlyProgram(): Program<ShieldChatIDL> {
  const connection = getConnection();
  // Create a dummy provider for read-only operations
  const provider = {
    connection,
    publicKey: null,
  } as unknown as AnchorProvider;

  return new Program(idl as ShieldChatIDL, provider);
}

// Channel account type
export interface ChannelAccount {
  channelId: bigint;
  owner: PublicKey;
  encryptedMetadata: Uint8Array;
  channelType: { directMessage?: {} } | { privateGroup?: {} } | { tokenGated?: {} } | { public?: {} };
  memberCount: number;
  messageCount: bigint;
  createdAt: bigint;
  isActive: boolean;
  requiredTokenMint: PublicKey | null;
  minTokenAmount: bigint | null;
  bump: number;
}

// Member account type
export interface MemberAccount {
  channel: PublicKey;
  wallet: PublicKey;
  joinedAt: bigint;
  isActive: boolean;
  bump: number;
}

// MessageLogged event type
export interface MessageLoggedEvent {
  channel: PublicKey;
  sender: PublicKey;
  messageHash: Uint8Array;
  encryptedIpfsCid: Uint8Array;
  messageNumber: bigint;
  timestamp: bigint;
}

// Helper to parse channel type
export function parseChannelType(channelType: ChannelAccount["channelType"]): string {
  if ("directMessage" in channelType) return "Direct Message";
  if ("privateGroup" in channelType) return "Private Group";
  if ("tokenGated" in channelType) return "Token Gated";
  if ("public" in channelType) return "Public";
  return "Unknown";
}

// Helper to get channel type for creation
export function getChannelTypeArg(type: string): ChannelAccount["channelType"] {
  switch (type) {
    case "directMessage":
      return { directMessage: {} };
    case "privateGroup":
      return { privateGroup: {} };
    case "tokenGated":
      return { tokenGated: {} };
    case "public":
      return { public: {} };
    default:
      return { privateGroup: {} };
  }
}

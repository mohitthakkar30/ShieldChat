import { PublicKey } from "@solana/web3.js";

// ShieldChat Program ID (deployed on devnet)
export const PROGRAM_ID = new PublicKey(
  "FVViRGPShMjCeSF3LDrp2qDjp6anRz9WAMiJrsGCRUzN"
);

// RPC Endpoints
export const RPC_ENDPOINT = "https://devnet.helius-rpc.com/?api-key=991a9116-5d4b-4859-93b6-acddf0536403";
export const WS_ENDPOINT = "wss://devnet.helius-rpc.com/api-key=87f15176-5b11-42e2-92a3-4332752769a4";

// PDA Seeds
export const CHANNEL_SEED = "channel";
export const MEMBER_SEED = "member";

// Limits
export const MAX_METADATA_SIZE = 512;
export const MAX_MEMBERS = 100;

// Channel Types
export enum ChannelType {
  DirectMessage = "directMessage",
  PrivateGroup = "privateGroup",
  TokenGated = "tokenGated",
  Public = "public",
}

// Helper function to derive Channel PDA
export function getChannelPDA(
  owner: PublicKey,
  channelId: bigint
): [PublicKey, number] {
  // Convert bigint to little-endian 8-byte array
  const channelIdBuffer = new Uint8Array(8);
  let id = channelId;
  for (let i = 0; i < 8; i++) {
    channelIdBuffer[i] = Number(id & BigInt(0xff));
    id = id >> BigInt(8);
  }

  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(CHANNEL_SEED),
      owner.toBytes(),
      channelIdBuffer,
    ],
    PROGRAM_ID
  );
}

// Helper function to derive Member PDA
export function getMemberPDA(
  channel: PublicKey,
  wallet: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(MEMBER_SEED),
      channel.toBytes(),
      wallet.toBytes(),
    ],
    PROGRAM_ID
  );
}

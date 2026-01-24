import { PublicKey } from "@solana/web3.js";

// ShieldChat Program ID (deployed on devnet)
export const PROGRAM_ID = new PublicKey(
  "FVViRGPShMjCeSF3LDrp2qDjp6anRz9WAMiJrsGCRUzN"
);

// ShieldChat Voting Program ID (deployed on devnet)
export const VOTING_PROGRAM_ID = new PublicKey(
  "H19dGK9xWHppSSuAEv9TfgPyK1S2dB1zihBXPXQnWdC5"
);

// Arcium MXE Program ID (deployed on devnet)
export const ARCIUM_MXE_PROGRAM_ID = new PublicKey(
  "Bg4L8JiYF7EmoAXHMXtzSfMBkJg9b8fnNjYSPDTi7sMm"
);

// Inco Lightning Program ID (on devnet)
export const INCO_LIGHTNING_PROGRAM_ID = new PublicKey(
  "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
);

// RPC Endpoints (API keys from environment variables)
const HELIUS_RPC_KEY = process.env.NEXT_PUBLIC_HELIUS_RPC_API_KEY;
const HELIUS_WS_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY;

export const RPC_ENDPOINT = HELIUS_RPC_KEY
  ? `https://devnet.helius-rpc.com/?api-key=${HELIUS_RPC_KEY}`
  : "https://api.devnet.solana.com";

export const WS_ENDPOINT = HELIUS_WS_KEY
  ? `wss://devnet.helius-rpc.com/?api-key=${HELIUS_WS_KEY}`
  : undefined;

// PDA Seeds
export const CHANNEL_SEED = "channel";
export const MEMBER_SEED = "member";
export const VAULT_SEED = "vault";
export const VAULT_AUTH_SEED = "vault_auth";
export const STAKE_SEED = "stake";

// Voting PDA Seeds
export const POLL_SEED = "poll";
export const VOTE_RECORD_SEED = "vote_record";

// Arcium MXE PDA Seeds (Games)
export const TICTACTOE_SEED = "tictactoe";

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

// Helper function to derive Vault PDA
export function getVaultPDA(channel: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode(VAULT_SEED), channel.toBytes()],
    PROGRAM_ID
  );
}

// Helper function to derive Vault Authority PDA
export function getVaultAuthorityPDA(
  channel: PublicKey,
  tokenMint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(VAULT_AUTH_SEED),
      channel.toBytes(),
      tokenMint.toBytes(),
    ],
    PROGRAM_ID
  );
}

// Helper function to derive Member Stake PDA
export function getStakePDA(
  channel: PublicKey,
  wallet: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(STAKE_SEED),
      channel.toBytes(),
      wallet.toBytes(),
    ],
    PROGRAM_ID
  );
}

// Helper function to derive Poll PDA
export function getPollPDA(
  channel: PublicKey,
  creator: PublicKey,
  nonce: bigint
): [PublicKey, number] {
  // Convert nonce to little-endian 8-byte array
  const nonceBuffer = new Uint8Array(8);
  let n = nonce;
  for (let i = 0; i < 8; i++) {
    nonceBuffer[i] = Number(n & BigInt(0xff));
    n = n >> BigInt(8);
  }

  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(POLL_SEED),
      channel.toBytes(),
      creator.toBytes(),
      nonceBuffer,
    ],
    VOTING_PROGRAM_ID
  );
}

// Helper function to derive VoteRecord PDA
export function getVoteRecordPDA(
  poll: PublicKey,
  voter: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(VOTE_RECORD_SEED),
      poll.toBytes(),
      voter.toBytes(),
    ],
    VOTING_PROGRAM_ID
  );
}

// Helper function to derive TicTacToeGame PDA
export function getTicTacToePDA(
  channel: PublicKey,
  playerX: PublicKey,
  nonce: bigint
): [PublicKey, number] {
  const nonceBuffer = new Uint8Array(8);
  let n = nonce;
  for (let i = 0; i < 8; i++) {
    nonceBuffer[i] = Number(n & BigInt(0xff));
    n = n >> BigInt(8);
  }

  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode(TICTACTOE_SEED),
      channel.toBytes(),
      playerX.toBytes(),
      nonceBuffer,
    ],
    ARCIUM_MXE_PROGRAM_ID
  );
}

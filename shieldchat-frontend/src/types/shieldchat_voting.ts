import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

/**
 * Poll account data structure
 */
export interface PollAccount {
  channel: PublicKey;
  creator: PublicKey;
  question: string;
  options: string[];
  optionsCount: number;
  voteCounts: anchor.BN[];
  totalVotes: anchor.BN;
  endTime: anchor.BN;
  revealed: boolean;
  revealedCounts: anchor.BN[];
  bump: number;
}

/**
 * VoteRecord account data structure
 */
export interface VoteRecordAccount {
  poll: PublicKey;
  voter: PublicKey;
  votedAt: anchor.BN;
  bump: number;
}

/**
 * Poll with its PDA address
 */
export interface PollWithPda {
  pda: PublicKey;
  account: PollAccount;
}

/**
 * Poll creation parameters
 */
export interface CreatePollParams {
  question: string;
  options: string[];
  durationHours: number;
}

/**
 * Voting program ID
 */
export const VOTING_PROGRAM_ADDRESS =
  "H19dGK9xWHppSSuAEv9TfgPyK1S2dB1zihBXPXQnWdC5";

/**
 * Inco Lightning program ID
 */
export const INCO_LIGHTNING_ADDRESS =
  "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj";

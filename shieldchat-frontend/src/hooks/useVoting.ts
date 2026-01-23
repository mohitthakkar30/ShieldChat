"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useAnchorWallet, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Connection } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

import {
  VOTING_PROGRAM_ID,
  INCO_LIGHTNING_PROGRAM_ID,
  RPC_ENDPOINT,
  getPollPDA,
  getVoteRecordPDA,
} from "@/lib/constants";
import { encryptVote, ciphertextToBuffer, extractHandle } from "@/lib/inco";
import {
  PollAccount,
  PollWithPda,
  CreatePollParams,
} from "@/types/shieldchat_voting";
import VOTING_IDL from "@/types/shieldchat_voting.json";

/**
 * Hook for managing anonymous voting in ShieldChat channels
 */
export function useVoting(channelPda: string | null) {
  const anchorWallet = useAnchorWallet();
  const { publicKey, signMessage } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [polls, setPolls] = useState<PollWithPda[]>([]);
  const [votedPolls, setVotedPolls] = useState<Set<string>>(new Set());

  const channelRef = useRef<string | null>(null);

  // Get the voting program
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getVotingProgram = useCallback((): anchor.Program<any> => {
    if (!anchorWallet) {
      throw new Error("Wallet not connected");
    }

    const connection = new Connection(RPC_ENDPOINT, "confirmed");
    const provider = new anchor.AnchorProvider(connection, anchorWallet, {
      commitment: "confirmed",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new anchor.Program(VOTING_IDL as any, provider);
  }, [anchorWallet]);

  // Fetch all polls for a channel
  const fetchPolls = useCallback(async () => {
    if (!channelPda || !anchorWallet) return;

    console.log("[useVoting] Fetching polls for channel:", channelPda);

    try {
      const program = getVotingProgram();
      const channelPubkey = new PublicKey(channelPda);

      // Fetch all Poll accounts filtered by channel
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pollAccounts = await (program.account as any).poll.all([
        {
          memcmp: {
            offset: 8, // After discriminator
            bytes: channelPubkey.toBase58(),
          },
        },
      ]);

      console.log("[useVoting] Found polls:", pollAccounts.length);

      const pollsWithPda: PollWithPda[] = pollAccounts.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (acc: any) => ({
          pda: acc.publicKey,
          account: acc.account as PollAccount,
        })
      );

      // Sort by end time (active polls first, then by newest)
      pollsWithPda.sort((a, b) => {
        const now = Date.now() / 1000;
        const aActive = a.account.endTime.toNumber() > now && !a.account.revealed;
        const bActive = b.account.endTime.toNumber() > now && !b.account.revealed;

        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;
        return b.account.endTime.toNumber() - a.account.endTime.toNumber();
      });

      console.log("[useVoting] Polls loaded:", pollsWithPda.map(p => ({
        pda: p.pda.toString(),
        question: p.account.question,
        totalVotes: p.account.totalVotes?.toString(),
      })));

      setPolls(pollsWithPda);
    } catch (err) {
      console.error("[useVoting] Failed to fetch polls:", err);
    }
  }, [channelPda, anchorWallet, getVotingProgram]);

  // Check which polls the user has voted on
  const checkVotedPolls = useCallback(async () => {
    if (!channelPda || !anchorWallet || !publicKey || polls.length === 0) return;

    try {
      const program = getVotingProgram();
      const voted = new Set<string>();

      for (const poll of polls) {
        try {
          const [voteRecordPda] = getVoteRecordPDA(poll.pda, publicKey);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (program.account as any).voteRecord.fetch(voteRecordPda);
          voted.add(poll.pda.toString());
        } catch {
          // VoteRecord doesn't exist = not voted
        }
      }

      setVotedPolls(voted);
    } catch (err) {
      console.error("Failed to check voted polls:", err);
    }
  }, [channelPda, anchorWallet, publicKey, polls, getVotingProgram]);

  // Fetch polls when channel changes
  useEffect(() => {
    if (channelPda !== channelRef.current) {
      channelRef.current = channelPda;
      setPolls([]);
      setVotedPolls(new Set());
      fetchPolls();
    }
  }, [channelPda, fetchPolls]);

  // Check voted polls when polls list changes
  useEffect(() => {
    if (polls.length > 0) {
      checkVotedPolls();
    }
  }, [polls, checkVotedPolls]);

  // Create a new poll
  const createPoll = useCallback(
    async ({ question, options, durationHours }: CreatePollParams) => {
      if (!anchorWallet || !publicKey || !channelPda) {
        throw new Error("Wallet not connected or no channel selected");
      }

      setLoading(true);
      setError(null);

      try {
        const program = getVotingProgram();
        const channelPubkey = new PublicKey(channelPda);
        const nonce = BigInt(Date.now());
        const durationSeconds = new anchor.BN(durationHours * 3600);

        const [pollPda] = getPollPDA(channelPubkey, publicKey, nonce);

        console.log("[useVoting] Creating poll with params:", {
          question,
          options,
          durationSeconds: durationSeconds.toString(),
          nonce: nonce.toString(),
          pollPda: pollPda.toString(),
          channel: channelPubkey.toString(),
          creator: publicKey.toString(),
          programId: program.programId.toString(),
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (program.methods as any)
          .createPoll(
            question,
            options,
            durationSeconds,
            new anchor.BN(nonce.toString())
          )
          .accounts({
            creator: publicKey,
            channel: channelPubkey,
            poll: pollPda,
            incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        console.log("[useVoting] Poll created successfully:", pollPda.toString());

        // Refresh polls list
        await fetchPolls();

        return pollPda;
      } catch (err: unknown) {
        console.error("Create poll error:", err);
        // Extract more detailed error message
        let message = "Failed to create poll";
        if (err instanceof Error) {
          message = err.message;
          // Check for Anchor/Solana specific error formats
          const errStr = err.toString();
          if (errStr.includes("custom program error")) {
            const match = errStr.match(/custom program error: (0x[0-9a-fA-F]+)/);
            if (match) {
              message = `Program error: ${match[1]} - ${err.message}`;
            }
          }
          // Check for logs in the error
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const anyErr = err as any;
          if (anyErr.logs) {
            console.error("Transaction logs:", anyErr.logs);
          }
        }
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [anchorWallet, publicKey, channelPda, getVotingProgram, fetchPolls]
  );

  // Cast a vote on a poll
  const castVote = useCallback(
    async (pollPda: PublicKey, optionIndex: number) => {
      if (!anchorWallet || !publicKey) {
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      setError(null);

      try {
        const program = getVotingProgram();

        // Encrypt the value "1" for the vote
        const encryptedOne = await encryptVote(BigInt(1));
        const ciphertext = ciphertextToBuffer(encryptedOne);

        const [voteRecordPda] = getVoteRecordPDA(pollPda, publicKey);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (program.methods as any)
          .castVote(optionIndex, ciphertext, 0) // 0 = ciphertext input
          .accounts({
            voter: publicKey,
            poll: pollPda,
            voteRecord: voteRecordPda,
            incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        // Mark as voted locally
        setVotedPolls((prev) => new Set([...prev, pollPda.toString()]));

        // Refresh polls to get updated vote count
        await fetchPolls();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to cast vote";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [anchorWallet, publicKey, getVotingProgram, fetchPolls]
  );

  // Reveal poll results (after poll ends)
  const revealResults = useCallback(
    async (pollPda: PublicKey) => {
      if (!anchorWallet || !publicKey || !signMessage) {
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      setError(null);

      try {
        const program = getVotingProgram();

        // Fetch the poll to get vote count handles
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const poll = (await (program.account as any).poll.fetch(
          pollPda
        )) as PollAccount;

        // Extract handles for active options
        const handles: bigint[] = [];
        for (let i = 0; i < poll.optionsCount; i++) {
          handles.push(extractHandle(poll.voteCounts[i]));
        }

        // For now, use a simplified reveal that trusts the total_votes counter
        // In production, you would use Inco's attested decrypt:
        // const result = await decryptVoteCounts(handles, { address: publicKey.toString(), signMessage });
        // const plaintexts = result.plaintexts.map(p => new anchor.BN(p.toString()));

        // Simplified: Calculate expected distribution (for demo purposes)
        // In production, this would come from Inco attested decrypt
        const totalVotes = poll.totalVotes.toNumber();
        const plaintexts: anchor.BN[] = [];

        // For demo: evenly distribute votes (real implementation uses Inco decrypt)
        const baseVotes = Math.floor(totalVotes / poll.optionsCount);
        const remainder = totalVotes % poll.optionsCount;

        for (let i = 0; i < poll.optionsCount; i++) {
          plaintexts.push(new anchor.BN(baseVotes + (i < remainder ? 1 : 0)));
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (program.methods as any)
          .revealResults(plaintexts)
          .accounts({
            revealer: publicKey,
            poll: pollPda,
          })
          .rpc();

        // Refresh polls
        await fetchPolls();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to reveal results";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [anchorWallet, publicKey, signMessage, getVotingProgram, fetchPolls]
  );

  // Close a poll (creator only, after reveal)
  const closePoll = useCallback(
    async (pollPda: PublicKey) => {
      if (!anchorWallet || !publicKey) {
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      setError(null);

      try {
        const program = getVotingProgram();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (program.methods as any)
          .closePoll()
          .accounts({
            closer: publicKey,
            poll: pollPda,
          })
          .rpc();

        // Refresh polls
        await fetchPolls();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to close poll";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [anchorWallet, publicKey, getVotingProgram, fetchPolls]
  );

  // Check if a specific poll has been voted on
  const hasVoted = useCallback(
    (pollPda: PublicKey): boolean => {
      return votedPolls.has(pollPda.toString());
    },
    [votedPolls]
  );

  // Check if poll is still active
  const isPollActive = useCallback((poll: PollAccount): boolean => {
    const now = Date.now() / 1000;
    return poll.endTime.toNumber() > now && !poll.revealed;
  }, []);

  // Check if poll can be revealed
  const canReveal = useCallback((poll: PollAccount): boolean => {
    const now = Date.now() / 1000;
    return poll.endTime.toNumber() <= now && !poll.revealed;
  }, []);

  return {
    // State
    loading,
    error,
    polls,
    votedPolls,

    // Actions
    createPoll,
    castVote,
    revealResults,
    closePoll,
    fetchPolls,

    // Helpers
    hasVoted,
    isPollActive,
    canReveal,
  };
}

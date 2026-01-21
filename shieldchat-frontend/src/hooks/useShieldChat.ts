"use client";

import { useCallback, useState } from "react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { Buffer } from "buffer";
import {
  getProgram,
  ChannelAccount,
  MemberAccount,
  getChannelTypeArg,
  parseChannelType,
} from "@/lib/anchor";
import { getChannelPDA, getMemberPDA } from "@/lib/constants";

export interface Channel {
  publicKey: PublicKey;
  account: ChannelAccount;
}

export interface Member {
  publicKey: PublicKey;
  account: MemberAccount;
}

export function useShieldChat() {
  const anchorWallet = useAnchorWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publicKey = anchorWallet?.publicKey || null;

  // Create a new channel (two separate transactions)
  const createChannel = useCallback(
    async (name: string, channelType: string = "privateGroup") => {
      if (!anchorWallet || !publicKey) {
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      setError(null);

      try {
        const program = getProgram(anchorWallet);
        const channelId = new anchor.BN(Date.now());

        // Encrypt metadata (for now, just encode as bytes - real encryption comes in Phase 3)
        const encryptedMetadata = Buffer.from(name);

        // Get channel PDA
        const [channelPda] = getChannelPDA(publicKey, BigInt(channelId.toString()));

        // Get channel type argument
        const channelTypeArg = getChannelTypeArg(channelType);

        // Step 1: Create the channel
        const createTx = await program.methods
          .createChannel(channelId, encryptedMetadata, channelTypeArg)
          .accounts({
            channel: channelPda,
            owner: publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        console.log("Channel created:", createTx);

        // Step 2: Auto-join the channel as owner (separate tx after channel exists)
        const [memberPda] = getMemberPDA(channelPda, publicKey);

        const joinTx = await program.methods
          .joinChannel()
          .accounts({
            channel: channelPda,
            member: memberPda,
            memberWallet: publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        console.log("Auto-joined channel:", joinTx);

        return {
          signature: createTx,
          channelId: channelId.toString(),
          channelPda,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to create channel";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [anchorWallet, publicKey]
  );

  // Join an existing channel
  const joinChannel = useCallback(
    async (channelPda: PublicKey) => {
      if (!anchorWallet || !publicKey) {
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      setError(null);

      try {
        const program = getProgram(anchorWallet);

        // Get member PDA
        const [memberPda] = getMemberPDA(channelPda, publicKey);

        // Check if member account already exists
        try {
          const existingMember = await (program.account as Record<string, unknown> & { member: { fetch: (key: PublicKey) => Promise<unknown> } }).member.fetch(memberPda);
          if (existingMember) {
            console.log("Member already exists, skipping join");
            return {
              signature: "already_member",
              memberPda,
            };
          }
        } catch {
          // Member doesn't exist, proceed with joining
        }

        // Join channel
        const tx = await program.methods
          .joinChannel()
          .accounts({
            channel: channelPda,
            member: memberPda,
            memberWallet: publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        console.log("Joined channel:", tx);

        return {
          signature: tx,
          memberPda,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to join channel";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [anchorWallet, publicKey]
  );

  // Log a message on-chain with IPFS CID
  const logMessage = useCallback(
    async (channelPda: PublicKey, messageContent: string, ipfsCid?: string) => {
      if (!anchorWallet || !publicKey) {
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      setError(null);

      try {
        const program = getProgram(anchorWallet);

        // Get member PDA
        const [memberPda] = getMemberPDA(channelPda, publicKey);

        // Create message hash with strong randomness for uniqueness
        // Use crypto.getRandomValues for cryptographically secure randomness
        const randomBytes = new Uint8Array(16);
        crypto.getRandomValues(randomBytes);
        const randomHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');

        const timestamp = Date.now();
        const encoder = new TextEncoder();
        const data = encoder.encode(`${messageContent}:${timestamp}:${randomHex}`);
        const dataBuffer = new Uint8Array(data).buffer as ArrayBuffer;
        const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
        // Anchor expects [u8; 32] - pass as Array for fixed-size arrays
        const messageHash = Array.from(new Uint8Array(hashBuffer));

        // Use provided IPFS CID (already includes timestamp from upload)
        // Anchor expects Buffer for bytes type
        const cidToStore = ipfsCid || `cid_${timestamp}_${randomHex.slice(0, 12)}`;
        const encryptedIpfsCid = Buffer.from(cidToStore);

        // Log message with skipPreflight to avoid simulation caching issues
        const tx = await program.methods
          .logMessage(messageHash, encryptedIpfsCid)
          .accounts({
            channel: channelPda,
            member: memberPda,
            sender: publicKey,
          })
          .rpc({ skipPreflight: true });

        console.log("Message logged:", tx);

        return {
          signature: tx,
          messageHash,
          ipfsCid: cidToStore,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to log message";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [anchorWallet, publicKey]
  );

  // Leave a channel
  const leaveChannel = useCallback(
    async (channelPda: PublicKey) => {
      if (!anchorWallet || !publicKey) {
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      setError(null);

      try {
        const program = getProgram(anchorWallet);

        // Get member PDA
        const [memberPda] = getMemberPDA(channelPda, publicKey);

        // Leave channel
        const tx = await program.methods
          .leaveChannel()
          .accounts({
            channel: channelPda,
            member: memberPda,
            memberWallet: publicKey,
          })
          .rpc();

        console.log("Left channel:", tx);

        return {
          signature: tx,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to leave channel";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [anchorWallet, publicKey]
  );

  // Fetch all channels (owned by the connected wallet)
  const fetchMyChannels = useCallback(async (): Promise<Channel[]> => {
    if (!publicKey || !anchorWallet) {
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const program = getProgram(anchorWallet);

      // Fetch all channel accounts owned by the current wallet
      const channels = await (program.account as Record<string, unknown> & { channel: { all: (filters?: unknown[]) => Promise<Array<{ publicKey: PublicKey; account: unknown }>> } }).channel.all([
        {
          memcmp: {
            offset: 8 + 8, // Skip discriminator (8) + channel_id (8)
            bytes: publicKey.toBase58(),
          },
        },
      ]);

      return channels.map((c: { publicKey: PublicKey; account: unknown }) => ({
        publicKey: c.publicKey,
        account: c.account as ChannelAccount,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch channels";
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [publicKey, anchorWallet]);

  // Fetch all channels (global)
  const fetchAllChannels = useCallback(async (): Promise<Channel[]> => {
    if (!anchorWallet) {
      // For now, return empty - would need program account fetching without wallet
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const program = getProgram(anchorWallet);
      const channels = await (program.account as Record<string, unknown> & { channel: { all: () => Promise<Array<{ publicKey: PublicKey; account: unknown }>> } }).channel.all();

      return channels.map((c: { publicKey: PublicKey; account: unknown }) => ({
        publicKey: c.publicKey,
        account: c.account as ChannelAccount,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch channels";
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [anchorWallet]);

  // Fetch only channels the user can access (owner or member)
  // Private channels are hidden from non-members
  // Uses batch RPC call for performance
  const fetchAccessibleChannels = useCallback(async (): Promise<Channel[]> => {
    if (!anchorWallet || !publicKey) {
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const program = getProgram(anchorWallet);
      const connection = program.provider.connection;
      const allChannels = await (program.account as Record<string, unknown> & { channel: { all: () => Promise<Array<{ publicKey: PublicKey; account: unknown }>> } }).channel.all();

      const accessibleChannels: Channel[] = [];
      const privateChannelsToCheck: Array<{ channel: Channel; memberPda: PublicKey }> = [];

      // First pass: add public channels and owner's channels immediately
      for (const c of allChannels) {
        const channel = c.account as ChannelAccount;
        const channelType = parseChannelType(channel.channelType);

        if (channelType === "Public") {
          accessibleChannels.push({ publicKey: c.publicKey, account: channel });
        } else if (channel.owner.equals(publicKey)) {
          accessibleChannels.push({ publicKey: c.publicKey, account: channel });
        } else {
          // Need to check membership - collect for batch fetch
          const [memberPda] = getMemberPDA(c.publicKey, publicKey);
          privateChannelsToCheck.push({
            channel: { publicKey: c.publicKey, account: channel },
            memberPda,
          });
        }
      }

      // Batch check memberships in single RPC call (much faster than sequential)
      if (privateChannelsToCheck.length > 0) {
        const memberPdas = privateChannelsToCheck.map(p => p.memberPda);
        const memberAccounts = await connection.getMultipleAccountsInfo(memberPdas);

        for (let i = 0; i < memberAccounts.length; i++) {
          if (memberAccounts[i] !== null) {
            // Member account exists = user is a member
            accessibleChannels.push(privateChannelsToCheck[i].channel);
          }
        }
      }

      return accessibleChannels;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch channels";
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [anchorWallet, publicKey]);

  // Fetch a specific channel
  const fetchChannel = useCallback(
    async (channelPda: PublicKey): Promise<Channel | null> => {
      if (!anchorWallet) {
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const program = getProgram(anchorWallet);
        const account = await (program.account as Record<string, unknown> & { channel: { fetch: (key: PublicKey) => Promise<unknown> } }).channel.fetch(channelPda);

        return {
          publicKey: channelPda,
          account: account as ChannelAccount,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to fetch channel";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [anchorWallet]
  );

  // Check if current wallet is a member of a channel
  const checkMembership = useCallback(
    async (channelPda: PublicKey): Promise<Member | null> => {
      if (!publicKey || !anchorWallet) {
        return null;
      }

      try {
        const program = getProgram(anchorWallet);
        const [memberPda] = getMemberPDA(channelPda, publicKey);

        const account = await (program.account as Record<string, unknown> & { member: { fetch: (key: PublicKey) => Promise<unknown> } }).member.fetch(memberPda);

        return {
          publicKey: memberPda,
          account: account as MemberAccount,
        };
      } catch {
        // Member doesn't exist
        return null;
      }
    },
    [publicKey, anchorWallet]
  );

  return {
    // State
    loading,
    error,
    connected: !!publicKey,
    publicKey,

    // Actions
    createChannel,
    joinChannel,
    logMessage,
    leaveChannel,

    // Queries
    fetchMyChannels,
    fetchAllChannels,
    fetchAccessibleChannels,
    fetchChannel,
    checkMembership,
  };
}

export default useShieldChat;

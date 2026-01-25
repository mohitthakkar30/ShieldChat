"use client";

import { useCallback, useState, useMemo } from "react";
import { usePrivyAnchorWallet } from "@/hooks/usePrivyAnchorWallet";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { Buffer } from "buffer";
import {
  getProgram,
  ChannelAccount,
  MemberAccount,
  getChannelTypeArg,
  parseChannelType,
} from "@/lib/anchor";
import { getChannelPDA, getMemberPDA, getVaultPDA, getVaultAuthorityPDA, getStakePDA } from "@/lib/constants";

export interface Channel {
  publicKey: PublicKey;
  account: ChannelAccount;
}

export interface Member {
  publicKey: PublicKey;
  account: MemberAccount;
}

export function useShieldChat() {
  const { wallet, publicKey: walletPublicKey, sendTransaction } = usePrivyAnchorWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publicKey = walletPublicKey;

  // Create a sponsored wallet object that includes sendTransaction for gas sponsorship
  const anchorWallet = useMemo(() => {
    if (!wallet || !sendTransaction) return undefined;
    return {
      ...wallet,
      sendTransaction,
    };
  }, [wallet, sendTransaction]);

  // Create a new channel (single atomic transaction with create + join)
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

        // Get member PDA for auto-join
        const [memberPda] = getMemberPDA(channelPda, publicKey);

        // Single instruction - creates channel and joins in one tx
        // skipPreflight: true to avoid simulation warning (member PDA depends on channel being initialized)
        const tx = await program.methods
          .createChannelAndJoin(channelId, encryptedMetadata, channelTypeArg)
          .accounts({
            channel: channelPda,
            member: memberPda,
            creator: publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc({ skipPreflight: true });

        return {
          signature: tx,
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

  // Internal helper to rejoin a channel (when member account exists but is inactive)
  const rejoinChannelInternal = async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    program: any,
    channelPda: PublicKey,
    memberPda: PublicKey,
    userTokenAccount?: PublicKey
  ) => {
    if (!publicKey) {
      throw new Error("Wallet not connected");
    }

    // Build accounts object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accounts: any = {
      channel: channelPda,
      member: memberPda,
      memberWallet: publicKey,
      systemProgram: SystemProgram.programId,
    };

    // Add staking accounts for token-gated channels
    if (userTokenAccount) {
      // Fetch channel to get token mint
      const channel = await (program.account as Record<string, unknown> & { channel: { fetch: (key: PublicKey) => Promise<ChannelAccount> } }).channel.fetch(channelPda);
      const tokenMint = channel.requiredTokenMint;

      if (tokenMint) {
        // Derive vault PDAs
        const [vaultPda] = getVaultPDA(channelPda);
        const [stakePda] = getStakePDA(channelPda, publicKey);

        // Get vault token account
        const vaultTokenAccount = getAssociatedTokenAddressSync(
          tokenMint,
          getVaultAuthorityPDA(channelPda, tokenMint)[0],
          true
        );

        accounts.userTokenAccount = userTokenAccount;
        accounts.tokenVault = vaultPda;
        accounts.vaultTokenAccount = vaultTokenAccount;
        accounts.memberStake = stakePda;
        accounts.tokenProgram = TOKEN_PROGRAM_ID;
      } else {
        accounts.userTokenAccount = null;
        accounts.tokenVault = null;
        accounts.vaultTokenAccount = null;
        accounts.memberStake = null;
        accounts.tokenProgram = null;
      }
    } else {
      // Non-token-gated channel
      accounts.userTokenAccount = null;
      accounts.tokenVault = null;
      accounts.vaultTokenAccount = null;
      accounts.memberStake = null;
      accounts.tokenProgram = null;
    }

    const tx = await program.methods
      .rejoinChannel()
      .accounts(accounts)
      .rpc({ skipPreflight: !!userTokenAccount });

    return {
      signature: tx,
      memberPda,
    };
  };

  // Join an existing channel
  // For token-gated channels, pass the user's token account pubkey
  // Tokens will be staked (transferred to vault) for token-gated channels
  const joinChannel = useCallback(
    async (channelPda: PublicKey, userTokenAccount?: PublicKey) => {
      if (!anchorWallet || !publicKey) {
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      setError(null);

      try {
        const program = getProgram(anchorWallet);

        // Get member PDA
        const [memberPda] = getMemberPDA(channelPda, publicKey);

        // Check if member account already exists and is active
        try {
          const existingMember = await (program.account as Record<string, unknown> & { member: { fetch: (key: PublicKey) => Promise<MemberAccount> } }).member.fetch(memberPda);
          if (existingMember && existingMember.isActive) {
            return {
              signature: "already_member",
              memberPda,
            };
          }
          // Member exists but is inactive (left the channel) - use rejoinChannel
          if (existingMember && !existingMember.isActive) {
            return await rejoinChannelInternal(program, channelPda, memberPda, userTokenAccount);
          }
        } catch (err) {
          // Member doesn't exist, proceed with joining
        }

        // Build accounts object - token accounts are optional
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const accounts: any = {
          channel: channelPda,
          member: memberPda,
          memberWallet: publicKey,
          systemProgram: SystemProgram.programId,
        };

        // Add staking accounts for token-gated channels
        if (userTokenAccount) {
          // Fetch channel to get token mint
          const channel = await (program.account as Record<string, unknown> & { channel: { fetch: (key: PublicKey) => Promise<ChannelAccount> } }).channel.fetch(channelPda);
          const tokenMint = channel.requiredTokenMint;

          if (tokenMint) {
            // Derive vault PDAs
            const [vaultPda] = getVaultPDA(channelPda);
            const [vaultAuthority] = getVaultAuthorityPDA(channelPda, tokenMint);
            const [stakePda] = getStakePDA(channelPda, publicKey);

            // Get vault token account
            const vaultTokenAccount = getAssociatedTokenAddressSync(
              tokenMint,
              vaultAuthority,
              true
            );

            accounts.userTokenAccount = userTokenAccount;
            accounts.tokenVault = vaultPda;
            accounts.vaultTokenAccount = vaultTokenAccount;
            accounts.memberStake = stakePda;
            accounts.tokenProgram = TOKEN_PROGRAM_ID;
          }
        } else {
          // Non-token-gated channel
          accounts.userTokenAccount = null;
          accounts.tokenVault = null;
          accounts.vaultTokenAccount = null;
          accounts.memberStake = null;
          accounts.tokenProgram = null;
        }

        // Join channel (tokens will be staked if token-gated)
        // Use skipPreflight for token-gated channels because we're initializing new accounts
        const tx = await program.methods
          .joinChannel()
          .accounts(accounts)
          .rpc({ skipPreflight: !!userTokenAccount });

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
  // For token-gated channels, staked tokens will be returned
  const leaveChannel = useCallback(
    async (channelPda: PublicKey, userTokenAccount?: PublicKey) => {
      if (!anchorWallet || !publicKey) {
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      setError(null);

      try {
        const program = getProgram(anchorWallet);

        // Get member PDA
        const [memberPda] = getMemberPDA(channelPda, publicKey);

        // Build accounts object
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const accounts: any = {
          channel: channelPda,
          member: memberPda,
          memberWallet: publicKey,
        };

        // Check if this is a token-gated channel with staking
        const channel = await (program.account as Record<string, unknown> & { channel: { fetch: (key: PublicKey) => Promise<ChannelAccount> } }).channel.fetch(channelPda);
        const tokenMint = channel.requiredTokenMint;

        if (tokenMint && userTokenAccount) {
          // Derive vault PDAs for unstaking
          const [vaultPda] = getVaultPDA(channelPda);
          const [vaultAuthority] = getVaultAuthorityPDA(channelPda, tokenMint);
          const [stakePda] = getStakePDA(channelPda, publicKey);

          // Get vault token account
          const vaultTokenAccount = getAssociatedTokenAddressSync(
            tokenMint,
            vaultAuthority,
            true
          );

          accounts.tokenVault = vaultPda;
          accounts.vaultAuthority = vaultAuthority;
          accounts.vaultTokenAccount = vaultTokenAccount;
          accounts.userTokenAccount = userTokenAccount;
          accounts.memberStake = stakePda;
          accounts.tokenProgram = TOKEN_PROGRAM_ID;
        } else {
          // Non-token-gated channel
          accounts.tokenVault = null;
          accounts.vaultAuthority = null;
          accounts.vaultTokenAccount = null;
          accounts.userTokenAccount = null;
          accounts.memberStake = null;
          accounts.tokenProgram = null;
        }

        // Leave channel (tokens will be unstaked if token-gated)
        const tx = await program.methods
          .leaveChannel()
          .accounts(accounts)
          .rpc();

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

  // Set token-gating requirements for a channel (owner only)
  const setTokenGate = useCallback(
    async (channelPda: PublicKey, tokenMint: PublicKey, minAmount: bigint) => {
      if (!anchorWallet || !publicKey) {
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      setError(null);

      try {
        const program = getProgram(anchorWallet);

        const tx = await program.methods
          .setTokenGate(tokenMint, new anchor.BN(minAmount.toString()))
          .accounts({
            channel: channelPda,
            owner: publicKey,
          })
          .rpc();

        return {
          signature: tx,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to set token gate";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [anchorWallet, publicKey]
  );

  // Initialize token vault for staking (owner only, after setTokenGate)
  const initializeVault = useCallback(
    async (channelPda: PublicKey, tokenMint: PublicKey) => {
      if (!anchorWallet || !publicKey) {
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      setError(null);

      try {
        const program = getProgram(anchorWallet);

        // Derive vault PDAs
        const [vaultPda] = getVaultPDA(channelPda);
        const [vaultAuthority] = getVaultAuthorityPDA(channelPda, tokenMint);

        // Get the associated token account for the vault
        const vaultTokenAccount = getAssociatedTokenAddressSync(
          tokenMint,
          vaultAuthority,
          true // allowOwnerOffCurve - required for PDA owners
        );

        const tx = await program.methods
          .initializeVault()
          .accounts({
            channel: channelPda,
            tokenVault: vaultPda,
            vaultAuthority,
            vaultTokenAccount,
            tokenMint,
            owner: publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        return {
          signature: tx,
          vaultPda,
          vaultTokenAccount,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to initialize vault";
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

      // First pass: add public, token-gated, and owner's channels immediately
      for (const c of allChannels) {
        const channel = c.account as ChannelAccount;
        const channelType = parseChannelType(channel.channelType);

        if (channelType === "Public") {
          // Public channels visible to all
          accessibleChannels.push({ publicKey: c.publicKey, account: channel });
        } else if (channelType === "Token Gated") {
          // Token-gated channels visible to all for discovery
          // Users can see requirements but need tokens to join
          accessibleChannels.push({ publicKey: c.publicKey, account: channel });
        } else if (channel.owner.equals(publicKey)) {
          // Owner can see their own channels
          accessibleChannels.push({ publicKey: c.publicKey, account: channel });
        } else {
          // Private/DM channels - need to check membership
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
    connecting: !anchorWallet, // Wallet is still initializing
    publicKey,

    // Actions
    createChannel,
    joinChannel,
    logMessage,
    leaveChannel,
    setTokenGate,
    initializeVault,

    // Queries
    fetchMyChannels,
    fetchAllChannels,
    fetchAccessibleChannels,
    fetchChannel,
    checkMembership,
  };
}

export default useShieldChat;

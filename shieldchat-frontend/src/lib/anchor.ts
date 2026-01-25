import { Program, AnchorProvider, Idl } from "@coral-xyz/anchor";
import { Connection, PublicKey, Transaction, VersionedTransaction, SendOptions, ConfirmOptions, Signer } from "@solana/web3.js";
import idl from "@/idl/shield_chat.json";
import { RPC_ENDPOINT } from "./constants";

// AnchorWallet interface - matches what Anchor expects
export interface AnchorWallet {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
}

// Extended wallet interface with sendTransaction for gas sponsorship
export interface SponsoredWallet extends AnchorWallet {
  sendTransaction: (tx: Transaction | VersionedTransaction, connection: Connection, options?: SendOptions) => Promise<string>;
}

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

// Custom AnchorProvider that uses Privy's gas-sponsored sendTransaction
class SponsoredAnchorProvider extends AnchorProvider {
  private sponsoredWallet: SponsoredWallet;

  constructor(connection: Connection, wallet: SponsoredWallet, opts: ConfirmOptions) {
    super(connection, wallet, opts);
    this.sponsoredWallet = wallet;
  }

  // Override sendAndConfirm to use Privy's sponsored sendTransaction
  async sendAndConfirm(
    tx: Transaction | VersionedTransaction,
    signers?: Signer[],
    opts?: ConfirmOptions
  ): Promise<string> {
    // For legacy transactions, ensure blockhash and feePayer are set
    if (tx instanceof Transaction) {
      // Get recent blockhash if not set
      if (!tx.recentBlockhash) {
        const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash(
          opts?.preflightCommitment || this.opts.preflightCommitment || "confirmed"
        );
        tx.recentBlockhash = blockhash;
        tx.lastValidBlockHeight = lastValidBlockHeight;
      }

      // Set fee payer if not set
      if (!tx.feePayer) {
        tx.feePayer = this.sponsoredWallet.publicKey;
      }

      // Sign with any additional signers first
      if (signers && signers.length > 0) {
        tx.partialSign(...signers);
      }
    }

    // Use the sponsored wallet's sendTransaction (which uses Privy with sponsor: true)
    const signature = await this.sponsoredWallet.sendTransaction(tx, this.connection, {
      skipPreflight: opts?.skipPreflight,
      preflightCommitment: opts?.preflightCommitment,
    });

    // Wait for confirmation
    const commitment = opts?.commitment || this.opts.commitment || "confirmed";
    await this.connection.confirmTransaction(signature, commitment);

    return signature;
  }
}

// Get Anchor provider (standard - for backwards compatibility)
export function getProvider(wallet: AnchorWallet): AnchorProvider {
  const connection = getConnection();
  return new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
}

// Get gas-sponsored Anchor provider
export function getSponsoredProvider(wallet: SponsoredWallet): AnchorProvider {
  const connection = getConnection();
  return new SponsoredAnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
}

// Get ShieldChat program with gas sponsorship
export function getProgram(wallet: AnchorWallet | SponsoredWallet): ShieldChatProgram {
  const connection = getConnection();

  // Check if wallet has sendTransaction (SponsoredWallet)
  if ('sendTransaction' in wallet && typeof wallet.sendTransaction === 'function') {
    const provider = new SponsoredAnchorProvider(connection, wallet as SponsoredWallet, {
      commitment: "confirmed",
    });
    return new Program(idl as ShieldChatIDL, provider);
  }

  // Fall back to standard provider
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
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

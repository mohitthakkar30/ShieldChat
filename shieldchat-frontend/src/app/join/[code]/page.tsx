"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@/hooks/usePrivyAnchorWallet";
import { useConnection } from "@/contexts/SolanaConnectionContext";
import { PrivyLoginButton } from "@/components/PrivyLoginButton";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import { useInvites } from "@/hooks/useInvites";
import { useShieldChat, Channel } from "@/hooks/useShieldChat";
import { DbInvite } from "@/lib/supabase";
import { parseChannelType } from "@/lib/anchor";
import { getTokenMetadata, TokenMetadata } from "@/lib/helius";

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string)?.toUpperCase();

  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const { getInvite, useInviteCode, loading: inviteLoading, error: inviteError } = useInvites();
  const { joinChannel, fetchChannel, checkMembership } = useShieldChat();

  // Track if we've already fetched the invite to prevent re-fetching
  const hasFetchedInvite = useRef(false);

  const [invite, setInvite] = useState<DbInvite | null>(null);
  const [channelInfo, setChannelInfo] = useState<{
    name: string;
    type: string;
    memberCount: number;
  } | null>(null);
  const [channelData, setChannelData] = useState<Channel | null>(null);
  const [status, setStatus] = useState<"loading" | "valid" | "invalid" | "expired" | "maxed" | "already_member">("loading");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Token-gating state
  const [tokenBalance, setTokenBalance] = useState<bigint | null>(null);
  const [userTokenAccount, setUserTokenAccount] = useState<PublicKey | null>(null);
  const [checkingTokenBalance, setCheckingTokenBalance] = useState(false);
  const [tokenMetadata, setTokenMetadata] = useState<TokenMetadata | null>(null);

  // Fetch invite details - only run once per code
  useEffect(() => {
    if (!code) return;

    // Prevent re-fetching when hook functions change reference
    if (hasFetchedInvite.current) return;
    hasFetchedInvite.current = true;

    const fetchInviteData = async () => {
      setStatus("loading");
      const inviteData = await getInvite(code);

      if (!inviteData) {
        // Check if it's expired or maxed out vs not found
        setStatus("invalid");
        return;
      }

      setInvite(inviteData);

      // Fetch channel info (this can fail if wallet not connected, that's OK)
      try {
        const channelPda = new PublicKey(inviteData.channel_pda);
        const channel = await fetchChannel(channelPda);

        if (channel) {
          const name = channel.account.encryptedMetadata
            ? new TextDecoder().decode(new Uint8Array(channel.account.encryptedMetadata))
            : "Private Channel";

          setChannelInfo({
            name,
            type: parseChannelType(channel.account.channelType),
            memberCount: channel.account.memberCount,
          });

          // Store full channel data for token-gating check
          setChannelData(channel);
        }
      } catch (err) {
        console.error("Failed to fetch channel info:", err);
      }

      setStatus("valid");
    };

    fetchInviteData();
  }, [code, getInvite, fetchChannel]);

  // Reset the fetch flag when code changes
  useEffect(() => {
    hasFetchedInvite.current = false;
  }, [code]);

  // Fetch token metadata for token-gated channels
  useEffect(() => {
    if (!channelData?.account.requiredTokenMint) {
      setTokenMetadata(null);
      return;
    }

    const fetchMetadata = async () => {
      const mintAddress = channelData.account.requiredTokenMint!.toString();
      const metadata = await getTokenMetadata(mintAddress);
      setTokenMetadata(metadata);
    };

    fetchMetadata();
  }, [channelData]);

  // Check token balance for token-gated channels
  useEffect(() => {
    if (!connected || !publicKey || !channelData) return;

    const checkTokenBalance = async () => {
      // Check if channel is token-gated
      const requiredMint = channelData.account.requiredTokenMint;
      const minAmount = channelData.account.minTokenAmount;

      if (!requiredMint || !minAmount) {
        // Not token-gated, no need to check
        setTokenBalance(null);
        setUserTokenAccount(null);
        return;
      }

      setCheckingTokenBalance(true);

      try {
        // Get user's associated token account for this mint
        const ata = await getAssociatedTokenAddress(requiredMint, publicKey);
        setUserTokenAccount(ata);

        // Fetch the token account to get balance
        try {
          const tokenAccount = await getAccount(connection, ata);
          setTokenBalance(tokenAccount.amount);
        } catch {
          // Token account doesn't exist, balance is 0
          setTokenBalance(BigInt(0));
        }
      } catch (err) {
        console.error("Failed to check token balance:", err);
        setTokenBalance(BigInt(0));
      } finally {
        setCheckingTokenBalance(false);
      }
    };

    checkTokenBalance();
  }, [connected, publicKey, channelData, connection]);

  // Check if user is already a member when wallet connects
  useEffect(() => {
    if (!connected || !publicKey || !invite) return;

    const checkExistingMembership = async () => {
      try {
        const channelPda = new PublicKey(invite.channel_pda);

        // Debug logging to diagnose "Already a Member" issues
        console.log("[Join Page] Checking membership for:");
        console.log("  - Channel PDA:", invite.channel_pda);
        console.log("  - User Wallet:", publicKey.toString());

        const membership = await checkMembership(channelPda);

        if (membership) {
          console.log("[Join Page] Found existing membership:");
          console.log("  - Member PDA:", membership.publicKey.toString());
          console.log("  - isActive:", membership.account.isActive);
          console.log("  - joinedAt:", new Date(Number(membership.account.joinedAt) * 1000).toISOString());
          console.log("  - Wallet on-chain:", membership.account.wallet.toString());

          // Only mark as already_member if the membership exists AND is active
          // (user might have left the channel, which makes isActive = false)
          if (membership.account.isActive) {
            setStatus("already_member");
          }
        } else {
          console.log("[Join Page] No membership found - user is new");
        }
      } catch (err) {
        // Not a member, which is expected for new users
        console.log("[Join Page] Error checking membership (expected for new users):", err);
      }
    };

    checkExistingMembership();
  }, [connected, publicKey, invite, checkMembership]);

  // Handle join
  const handleJoin = useCallback(async () => {
    if (!connected || !publicKey || !invite) return;

    // Check token requirements before joining
    if (channelData?.account.requiredTokenMint && channelData?.account.minTokenAmount) {
      const minAmount = channelData.account.minTokenAmount;
      if (tokenBalance === null || tokenBalance < minAmount) {
        const formattedAmount = tokenMetadata
          ? `${formatTokenAmount(minAmount, tokenMetadata.decimals)} ${tokenMetadata.symbol}`
          : minAmount.toString();
        setJoinError(`Insufficient token balance. You need at least ${formattedAmount} to join this channel.`);
        return;
      }
    }

    setJoining(true);
    setJoinError(null);

    try {
      // Redeem the invite code
      const result = await useInviteCode(code);

      if (!result) {
        setJoinError("Failed to redeem invite code");
        return;
      }

      // Join the channel on-chain
      // Pass token account if this is a token-gated channel
      const channelPda = new PublicKey(result.channelPda);
      await joinChannel(channelPda, userTokenAccount || undefined);

      // Redirect to the channel
      router.push(`/app/channels/${result.channelPda}`);
    } catch (err) {
      console.error("Failed to join:", err);
      setJoinError(err instanceof Error ? err.message : "Failed to join channel");
    } finally {
      setJoining(false);
    }
  }, [connected, publicKey, invite, code, useInviteCode, joinChannel, router, channelData, tokenBalance, userTokenAccount]);

  // Go to channel if already a member
  const handleGoToChannel = useCallback(() => {
    if (invite) {
      router.push(`/app/channels/${invite.channel_pda}`);
    }
  }, [invite, router]);

  // Helper to format raw token amount to human-readable
  const formatTokenAmount = useCallback((rawAmount: bigint, decimals: number): string => {
    const divisor = BigInt(10 ** decimals);
    const wholePart = rawAmount / divisor;
    const fractionalPart = rawAmount % divisor;

    if (fractionalPart === BigInt(0)) {
      return wholePart.toString();
    }

    // Pad fractional part with leading zeros
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    // Remove trailing zeros
    const trimmed = fractionalStr.replace(/0+$/, '');
    return `${wholePart}.${trimmed}`;
  }, []);

  // Only check inviteLoading and status - shieldChatLoading causes infinite loop
  // because fetchChannel changes reference when anchorWallet initializes
  const isLoading = inviteLoading || status === "loading";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 p-6 border-b border-gray-700">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center">You&apos;re Invited!</h1>
          <p className="text-gray-400 text-center mt-1">Join a ShieldChat channel</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
              <p className="text-gray-400 mt-4">Validating invite...</p>
            </div>
          )}

          {status === "invalid" && !isLoading && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-red-400">Invalid Invite</h2>
              <p className="text-gray-400 mt-2">
                This invite link is invalid, expired, or has reached its usage limit.
              </p>
              <button
                onClick={() => router.push("/app")}
                className="mt-6 px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Go to App
              </button>
            </div>
          )}

          {status === "already_member" && !isLoading && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-green-400">Already a Member</h2>
              <p className="text-gray-400 mt-2">
                You&apos;re already a member of this channel.
              </p>
              {/* Show wallet address to help diagnose membership issues */}
              {publicKey && (
                <p className="text-gray-500 text-xs mt-2 font-mono">
                  Wallet: {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}
                </p>
              )}
              <button
                onClick={handleGoToChannel}
                className="mt-6 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold transition-all"
              >
                Go to Channel
              </button>
            </div>
          )}

          {status === "valid" && !isLoading && (
            <div className="space-y-6">
              {/* Channel info */}
              {channelInfo && (
                <div className="bg-gray-900 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-xl font-bold">
                      {channelInfo.name[0]?.toUpperCase() || "#"}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{channelInfo.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          channelInfo.type === "Private Group"
                            ? "bg-purple-500/20 text-purple-300"
                            : channelInfo.type === "Token Gated"
                            ? "bg-yellow-500/20 text-yellow-300"
                            : "bg-green-500/20 text-green-300"
                        }`}>
                          {channelInfo.type}
                        </span>
                        <span>{channelInfo.memberCount} members</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Invite info */}
              {invite && (
                <div className="text-sm text-gray-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Invite code:</span>
                    <code className="text-gray-300">{invite.code}</code>
                  </div>
                  <div className="flex justify-between">
                    <span>Invited by:</span>
                    <span className="text-gray-300 font-mono">
                      {invite.created_by.slice(0, 4)}...{invite.created_by.slice(-4)}
                    </span>
                  </div>
                  {invite.max_uses && (
                    <div className="flex justify-between">
                      <span>Uses remaining:</span>
                      <span className="text-gray-300">
                        {invite.max_uses - invite.used_count} of {invite.max_uses}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Token Staking Requirements (for token-gated channels) */}
              {channelData?.account.requiredTokenMint && channelData?.account.minTokenAmount && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-yellow-300 font-medium">
                    <span>🔒</span>
                    <span>Token Staking Required</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">
                    Tokens will be locked while you are a member. They are returned when you leave the channel.
                  </p>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between text-gray-400">
                      <span>Token:</span>
                      {tokenMetadata ? (
                        <span className="text-gray-300">
                          {tokenMetadata.symbol}
                          <span className="text-gray-500 text-xs ml-1">
                            ({channelData.account.requiredTokenMint.toString().slice(0, 4)}...{channelData.account.requiredTokenMint.toString().slice(-4)})
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-300 font-mono text-xs">
                          {channelData.account.requiredTokenMint.toString().slice(0, 4)}...{channelData.account.requiredTokenMint.toString().slice(-4)}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Stake amount:</span>
                      <span className="text-gray-300">
                        {tokenMetadata
                          ? `${formatTokenAmount(channelData.account.minTokenAmount, tokenMetadata.decimals)} ${tokenMetadata.symbol}`
                          : channelData.account.minTokenAmount.toString()}
                      </span>
                    </div>
                    {connected && (
                      <div className="flex justify-between text-gray-400 pt-2 border-t border-gray-700 mt-2">
                        <span>Your balance:</span>
                        {checkingTokenBalance ? (
                          <span className="text-gray-500">Checking...</span>
                        ) : tokenBalance !== null ? (
                          <span className={tokenBalance >= channelData.account.minTokenAmount ? "text-green-400" : "text-red-400"}>
                            {tokenMetadata
                              ? `${formatTokenAmount(tokenBalance, tokenMetadata.decimals)} ${tokenMetadata.symbol}`
                              : tokenBalance.toString()}
                            {tokenBalance >= channelData.account.minTokenAmount ? " ✓" : " ✗"}
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </div>
                    )}
                  </div>
                  {connected && tokenBalance !== null && tokenBalance < channelData.account.minTokenAmount && (
                    <div className="text-xs text-red-400 mt-2">
                      You don&apos;t have enough tokens to stake and join this channel.
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {(inviteError || joinError) && (
                <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-sm text-red-300">
                  {inviteError || joinError}
                </div>
              )}

              {/* Action buttons */}
              <div className="space-y-3">
                {!connected ? (
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-gray-400 text-sm">Connect your wallet to join</p>
                    <PrivyLoginButton className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg h-12 px-6 text-white" />
                  </div>
                ) : (
                  <button
                    onClick={handleJoin}
                    disabled={joining}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {joining ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Joining...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        Join Channel
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-900/50 border-t border-gray-700">
          <p className="text-xs text-gray-500 text-center">
            ShieldChat - Private messaging on Solana
          </p>
        </div>
      </div>
    </div>
  );
}

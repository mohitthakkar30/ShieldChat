"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useAnchorWallet, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Connection } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

import {
  RPC_ENDPOINT,
  getTicTacToePDA,
} from "@/lib/constants";
import {
  TicTacToeGameAccount,
  TicTacToeState,
  parseTicTacToeState,
  solToLamports,
} from "@/lib/arcium-mxe";
import GAMES_IDL from "@/types/arcium_mxe.json";
import { uploadMessage } from "@/lib/ipfs";

// ============================================================================
// TYPES
// ============================================================================

export interface TicTacToeGameWithPda {
  pubkey: PublicKey;
  account: TicTacToeGameAccount;
}

// Type alias for components
export type TicTacToeGame = TicTacToeGameWithPda;

// ============================================================================
// HOOK
// ============================================================================

/**
 * Helper to get state string from TicTacToeState enum
 */
function getStateString(state: TicTacToeState): string {
  switch (state) {
    case TicTacToeState.WaitingForPlayer:
      return "waiting";
    case TicTacToeState.PlayerXTurn:
    case TicTacToeState.PlayerOTurn:
      return "in_progress";
    case TicTacToeState.XWins:
      return "x_wins";
    case TicTacToeState.OWins:
      return "o_wins";
    case TicTacToeState.Draw:
      return "draw";
    case TicTacToeState.Cancelled:
      return "cancelled";
    default:
      return "unknown";
  }
}

/**
 * Hook for managing Tic Tac Toe games in ShieldChat channels
 * @param channelPubkey - The channel PublicKey
 * @param logMessage - Optional function to log game messages on-chain
 */
export function useGames(
  channelPubkey: PublicKey | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logMessage?: (channel: PublicKey, content: string, ipfsCid: string) => Promise<any>
) {
  const anchorWallet = useAnchorWallet();
  const { publicKey } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticTacToeGames, setTicTacToeGames] = useState<TicTacToeGameWithPda[]>(
    []
  );

  const channelRef = useRef<string | null>(null);

  // Convert PublicKey to string for comparisons
  const channelPda = channelPubkey?.toString() || null;

  // Get the games program
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getGamesProgram = useCallback((): anchor.Program<any> => {
    if (!anchorWallet) {
      throw new Error("Wallet not connected");
    }

    const connection = new Connection(RPC_ENDPOINT, "confirmed");
    const provider = new anchor.AnchorProvider(connection, anchorWallet, {
      commitment: "confirmed",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new anchor.Program(GAMES_IDL as any, provider);
  }, [anchorWallet]);

  // ============================================================================
  // TIC TAC TOE FUNCTIONS
  // ============================================================================

  // Create a new Tic Tac Toe game
  const createTicTacToeGame = useCallback(
    async (wagerSol: number): Promise<PublicKey> => {
      if (!channelPda || !anchorWallet || !publicKey) {
        throw new Error("Wallet not connected or channel not selected");
      }

      setLoading(true);
      setError(null);

      try {
        const program = getGamesProgram();
        const channelPubkey = new PublicKey(channelPda);
        const nonce = BigInt(Date.now());

        const [gamePda] = getTicTacToePDA(channelPubkey, publicKey, nonce);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (program.methods as any)
          .createTttGame(solToLamports(wagerSol), new anchor.BN(nonce.toString()))
          .accounts({
            playerX: publicKey,
            channel: channelPubkey,
            game: gamePda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        console.log("[useGames] Tic Tac Toe game created:", gamePda.toString());

        // Log game creation as a message in the channel
        if (logMessage) {
          try {
            const gameContent = JSON.stringify({
              type: "game_created",
              gameId: gamePda.toString(),
              gameType: "tictactoe",
              state: "waiting",
              playerX: publicKey.toString(),
              wager: solToLamports(wagerSol).toString(),
              createdAt: new Date().toISOString(),
            });

            // Upload to IPFS
            const ipfsMessage = {
              content: gameContent,
              sender: publicKey.toString(),
              timestamp: Date.now(),
              channelId: channelPubkey.toString(),
            };
            const ipfsCid = await uploadMessage(ipfsMessage);

            await logMessage(channelPubkey, gameContent, ipfsCid);
            console.log("[useGames] Game creation logged as message");
          } catch (logErr) {
            console.error("[useGames] Failed to log game creation:", logErr);
            // Don't throw - game was created successfully
          }
        }

        // Refresh games
        await fetchGames();

        return gamePda;
      } catch (err) {
        console.error("[useGames] Error creating TTT game:", err);
        setError(err instanceof Error ? err.message : "Failed to create game");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [channelPda, anchorWallet, publicKey, getGamesProgram]
  );

  // Join an existing Tic Tac Toe game
  const joinTicTacToeGame = useCallback(
    async (gamePda: PublicKey): Promise<void> => {
      if (!anchorWallet || !publicKey) {
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      setError(null);

      try {
        const program = getGamesProgram();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (program.methods as any)
          .joinTttGame()
          .accounts({
            playerO: publicKey,
            game: gamePda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        console.log("[useGames] Joined TTT game:", gamePda.toString());

        // Log game joined message
        if (logMessage && channelPubkey) {
          try {
            // Fetch updated game state
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const account = await (program.account as any).ticTacToeGame.fetch(gamePda);

            const joinContent = JSON.stringify({
              type: "game_joined",
              gameId: gamePda.toString(),
              gameType: "tictactoe",
              state: "in_progress",
              playerX: account.playerX.toString(),
              playerO: publicKey.toString(),
              wager: account.wager.toString(),
              createdAt: new Date(account.createdAt.toNumber() * 1000).toISOString(),
            });

            const ipfsMessage = {
              content: joinContent,
              sender: publicKey.toString(),
              timestamp: Date.now(),
              channelId: channelPubkey.toString(),
            };
            const ipfsCid = await uploadMessage(ipfsMessage);
            await logMessage(channelPubkey, joinContent, ipfsCid);
            console.log("[useGames] Game join logged as message");
          } catch (logErr) {
            console.error("[useGames] Failed to log game join:", logErr);
          }
        }

        // Refresh games
        await fetchGames();
      } catch (err) {
        console.error("[useGames] Error joining TTT game:", err);
        setError(err instanceof Error ? err.message : "Failed to join game");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [anchorWallet, publicKey, getGamesProgram, logMessage, channelPubkey]
  );

  // Make a move in Tic Tac Toe
  const makeTicTacToeMove = useCallback(
    async (gamePda: PublicKey, position: number): Promise<void> => {
      if (!anchorWallet || !publicKey) {
        throw new Error("Wallet not connected");
      }

      if (position < 0 || position > 8) {
        throw new Error("Invalid position (must be 0-8)");
      }

      setLoading(true);
      setError(null);

      try {
        const program = getGamesProgram();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (program.methods as any)
          .makeMove(position)
          .accounts({
            player: publicKey,
            game: gamePda,
          })
          .rpc();

        console.log("[useGames] Made TTT move:", position, "in", gamePda.toString());

        // Refresh games
        await fetchGames();
      } catch (err) {
        console.error("[useGames] Error making TTT move:", err);
        setError(err instanceof Error ? err.message : "Failed to make move");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [anchorWallet, publicKey, getGamesProgram]
  );

  // Claim Tic Tac Toe winnings
  const claimTicTacToeWinnings = useCallback(
    async (gamePda: PublicKey): Promise<void> => {
      if (!anchorWallet || !publicKey) {
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      setError(null);

      try {
        const program = getGamesProgram();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (program.methods as any)
          .claimTttWinnings()
          .accounts({
            claimer: publicKey,
            game: gamePda,
          })
          .rpc();

        console.log("[useGames] Claimed TTT winnings:", gamePda.toString());

        // Log game result as a message in the channel
        if (logMessage && channelPubkey) {
          try {
            // Fetch final game state directly
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const account = await (program.account as any).ticTacToeGame.fetch(gamePda);
            const finalGame = {
              pubkey: gamePda,
              account: {
                ...account,
                state: parseTicTacToeState(account.state),
              } as TicTacToeGameAccount,
            };

            const resultContent = JSON.stringify({
              type: "game_result",
              gameId: gamePda.toString(),
              gameType: "tictactoe",
              state: getStateString(finalGame.account.state),
              playerX: finalGame.account.playerX.toString(),
              playerO: finalGame.account.playerO?.toString(),
              winner: finalGame.account.winner?.toString(),
              wager: finalGame.account.wager.toString(),
              createdAt: new Date(finalGame.account.createdAt.toNumber() * 1000).toISOString(),
              board: finalGame.account.board,
            });

            // Upload to IPFS
            const ipfsMessage = {
              content: resultContent,
              sender: publicKey.toString(),
              timestamp: Date.now(),
              channelId: channelPubkey.toString(),
            };
            const ipfsCid = await uploadMessage(ipfsMessage);

            await logMessage(channelPubkey, resultContent, ipfsCid);
            console.log("[useGames] Game result logged as message");
          } catch (logErr) {
            console.error("[useGames] Failed to log game result:", logErr);
            // Don't throw - winnings were claimed successfully
          }
        }

        // Refresh games
        await fetchGames();
      } catch (err) {
        console.error("[useGames] Error claiming TTT winnings:", err);
        setError(err instanceof Error ? err.message : "Failed to claim winnings");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [anchorWallet, publicKey, getGamesProgram, logMessage, channelPubkey]
  );

  // Cancel Tic Tac Toe game
  const cancelTicTacToeGame = useCallback(
    async (gamePda: PublicKey): Promise<void> => {
      if (!anchorWallet || !publicKey) {
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      setError(null);

      try {
        const program = getGamesProgram();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (program.methods as any)
          .cancelTttGame()
          .accounts({
            creator: publicKey,
            game: gamePda,
          })
          .rpc();

        console.log("[useGames] Cancelled TTT game:", gamePda.toString());

        // Refresh games
        await fetchGames();
      } catch (err) {
        console.error("[useGames] Error cancelling TTT game:", err);
        setError(err instanceof Error ? err.message : "Failed to cancel game");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [anchorWallet, publicKey, getGamesProgram]
  );

  // ============================================================================
  // FETCH FUNCTIONS
  // ============================================================================

  // Fetch a single TTT game by PDA (for polling)
  const fetchSingleTTTGame = useCallback(
    async (gamePda: PublicKey): Promise<TicTacToeGameWithPda | null> => {
      if (!anchorWallet) return null;
      try {
        const program = getGamesProgram();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const account = await (program.account as any).ticTacToeGame.fetch(gamePda);
        return {
          pubkey: gamePda,
          account: {
            ...account,
            state: parseTicTacToeState(account.state),
          } as TicTacToeGameAccount,
        };
      } catch (err) {
        console.error("[useGames] Error fetching TTT game:", err);
        return null;
      }
    },
    [anchorWallet, getGamesProgram]
  );

  // Fetch all games for a channel
  const fetchGames = useCallback(async () => {
    if (!channelPda || !anchorWallet) return;

    console.log("[useGames] Fetching games for channel:", channelPda);

    try {
      const program = getGamesProgram();
      const channelPubkey = new PublicKey(channelPda);

      // Fetch Tic Tac Toe games
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tttAccounts = await (program.account as any).ticTacToeGame.all([
        {
          memcmp: {
            offset: 8, // After discriminator
            bytes: channelPubkey.toBase58(),
          },
        },
      ]);

      const tttWithPda: TicTacToeGameWithPda[] = tttAccounts.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (acc: any) => ({
          pubkey: acc.publicKey,
          account: {
            ...acc.account,
            state: parseTicTacToeState(acc.account.state),
          } as TicTacToeGameAccount,
        })
      );

      // Sort by created time (newest first)
      tttWithPda.sort(
        (a, b) => b.account.createdAt.toNumber() - a.account.createdAt.toNumber()
      );

      setTicTacToeGames(tttWithPda);

      console.log("[useGames] Found TTT games:", tttWithPda.length);
    } catch (err) {
      console.error("[useGames] Error fetching games:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch games");
    }
  }, [channelPda, anchorWallet, getGamesProgram]);

  // Fetch games when channel changes
  useEffect(() => {
    if (channelPda !== channelRef.current) {
      channelRef.current = channelPda;
      if (channelPda && anchorWallet) {
        fetchGames();
      } else {
        setTicTacToeGames([]);
      }
    }
  }, [channelPda, anchorWallet, fetchGames]);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  // Check if current user is a participant in a TTT game
  const isParticipantInTtt = useCallback(
    (game: TicTacToeGameAccount): boolean => {
      if (!publicKey) return false;
      return (
        game.playerX.equals(publicKey) ||
        (game.playerO !== null && game.playerO.equals(publicKey))
      );
    },
    [publicKey]
  );

  // Check if it's current user's turn in TTT
  const isMyTurnInTtt = useCallback(
    (game: TicTacToeGameAccount): boolean => {
      if (!publicKey) return false;
      if (game.state === TicTacToeState.PlayerXTurn) {
        return game.playerX.equals(publicKey);
      }
      if (game.state === TicTacToeState.PlayerOTurn) {
        return game.playerO !== null && game.playerO.equals(publicKey);
      }
      return false;
    },
    [publicKey]
  );

  // Subscribe to game account changes (for real-time updates)
  const subscribeToGame = useCallback(
    (
      gamePda: PublicKey,
      gameType: "tictactoe",
      callback: (game: TicTacToeGameWithPda) => void
    ): (() => void) => {
      if (!anchorWallet) return () => {};

      const connection = new Connection(RPC_ENDPOINT, "confirmed");
      const subscriptionId = connection.onAccountChange(
        gamePda,
        async () => {
          // Re-fetch the specific game when it changes
          try {
            const program = getGamesProgram();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const account = await (program.account as any).ticTacToeGame.fetch(gamePda);
            callback({
              pubkey: gamePda,
              account: {
                ...account,
                state: parseTicTacToeState(account.state),
              } as TicTacToeGameAccount,
            });
          } catch (err) {
            console.error("[useGames] Error in subscription callback:", err);
          }
        },
        "confirmed"
      );

      return () => {
        connection.removeAccountChangeListener(subscriptionId);
      };
    },
    [anchorWallet, getGamesProgram]
  );

  // Alias for refreshGames
  const refreshGames = fetchGames;

  return {
    // State
    loading,
    error,
    ticTacToeGames,

    // Tic Tac Toe actions
    createTicTacToeGame,
    joinTicTacToeGame,
    makeTicTacToeMove,
    claimTicTacToeWinnings,
    cancelTicTacToeGame,

    // Utility
    fetchGames,
    refreshGames,
    fetchSingleTTTGame,
    subscribeToGame,
    isParticipantInTtt,
    isMyTurnInTtt,
  };
}

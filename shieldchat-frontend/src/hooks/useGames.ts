"use client";

import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import { usePrivyAnchorWallet } from "@/hooks/usePrivyAnchorWallet";
import { PublicKey, SystemProgram, Connection, Transaction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { Buffer } from "buffer";

import {
  RPC_ENDPOINT,
  getTicTacToePDA,
  getMemberPDA,
} from "@/lib/constants";
import {
  TicTacToeGameAccount,
  TicTacToeState,
  parseTicTacToeState,
  solToLamports,
} from "@/lib/arcium-mxe";
import GAMES_IDL from "@/types/arcium_mxe.json";
import SHIELDCHAT_IDL from "@/idl/shield_chat.json";
import { uploadMessage } from "@/lib/ipfs";
import { getChannelGames, upsertGame, DbGame } from "@/lib/supabase";

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
 * Game actions are combined with message logging in single transactions for efficiency
 * @param channelPubkey - The channel PublicKey
 */
export function useGames(channelPubkey: PublicKey | null) {
  const { wallet, publicKey, sendTransaction } = usePrivyAnchorWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticTacToeGames, setTicTacToeGames] = useState<TicTacToeGameWithPda[]>(
    []
  );

  const channelRef = useRef<string | null>(null);

  // Convert PublicKey to string for comparisons
  const channelPda = channelPubkey?.toString() || null;

  // Create a sponsored wallet object that includes sendTransaction for gas sponsorship
  const anchorWallet = useMemo(() => {
    if (!wallet || !sendTransaction) return undefined;
    return {
      ...wallet,
      sendTransaction,
    };
  }, [wallet, sendTransaction]);

  // Get shared connection
  const connection = useMemo(() => new Connection(RPC_ENDPOINT, "confirmed"), []);

  // Get the games program
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getGamesProgram = useCallback((): anchor.Program<any> => {
    if (!anchorWallet) {
      throw new Error("Wallet not connected");
    }

    const provider = new anchor.AnchorProvider(connection, anchorWallet, {
      commitment: "confirmed",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new anchor.Program(GAMES_IDL as any, provider);
  }, [anchorWallet, connection]);

  // Get the ShieldChat program for message logging
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getShieldChatProgram = useCallback((): anchor.Program<any> => {
    if (!anchorWallet) {
      throw new Error("Wallet not connected");
    }

    const provider = new anchor.AnchorProvider(connection, anchorWallet, {
      commitment: "confirmed",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new anchor.Program(SHIELDCHAT_IDL as any, provider);
  }, [anchorWallet, connection]);

  // ============================================================================
  // TIC TAC TOE FUNCTIONS
  // ============================================================================

  // Create a new Tic Tac Toe game (combined with message logging in single transaction)
  const createTicTacToeGame = useCallback(
    async (wagerSol: number): Promise<PublicKey> => {
      if (!channelPda || !anchorWallet || !publicKey || !sendTransaction) {
        throw new Error("Wallet not connected or channel not selected");
      }

      setLoading(true);
      setError(null);

      try {
        const gamesProgram = getGamesProgram();
        const shieldChatProgram = getShieldChatProgram();
        const channelPubkey = new PublicKey(channelPda);
        const nonce = BigInt(Date.now());

        const [gamePda] = getTicTacToePDA(channelPubkey, publicKey, nonce);

        // Build game creation instruction
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const createGameIx = await (gamesProgram.methods as any)
          .createTttGame(solToLamports(wagerSol), new anchor.BN(nonce.toString()))
          .accounts({
            playerX: publicKey,
            channel: channelPubkey,
            game: gamePda,
            systemProgram: SystemProgram.programId,
          })
          .instruction();

        // Prepare message content for logging
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

        // Compute message hash (SHA256 of content)
        const encoder = new TextEncoder();
        const data = encoder.encode(gameContent);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const messageHash = Array.from(new Uint8Array(hashBuffer));

        // Get member PDA for message logging
        const [memberPda] = getMemberPDA(channelPubkey, publicKey);

        // Build logMessage instruction
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const logMessageIx = await (shieldChatProgram.methods as any)
          .logMessage(messageHash, Buffer.from(ipfsCid))
          .accounts({
            channel: channelPubkey,
            member: memberPda,
            sender: publicKey,
          })
          .instruction();

        // Create combined transaction with both instructions
        const tx = new Transaction();
        tx.add(createGameIx);
        tx.add(logMessageIx);

        // Get recent blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
        tx.lastValidBlockHeight = lastValidBlockHeight;
        tx.feePayer = publicKey;

        // Send via sponsored wallet (single transaction for both operations)
        const signature = await sendTransaction(tx, connection);
        console.log("[useGames] Combined tx signature:", signature);

        // Wait for confirmation
        await connection.confirmTransaction(signature, "confirmed");

        console.log("[useGames] Tic Tac Toe game created + message logged:", gamePda.toString());

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
    [channelPda, anchorWallet, publicKey, sendTransaction, getGamesProgram, getShieldChatProgram, connection]
  );

  // Join an existing Tic Tac Toe game (combined with message logging in single transaction)
  const joinTicTacToeGame = useCallback(
    async (gamePda: PublicKey): Promise<void> => {
      if (!anchorWallet || !publicKey || !sendTransaction || !channelPubkey) {
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      setError(null);

      try {
        const gamesProgram = getGamesProgram();
        const shieldChatProgram = getShieldChatProgram();

        // Fetch game state first to get playerX info for the message
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const account = await (gamesProgram.account as any).ticTacToeGame.fetch(gamePda);

        // Build join game instruction
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const joinGameIx = await (gamesProgram.methods as any)
          .joinTttGame()
          .accounts({
            playerO: publicKey,
            game: gamePda,
            systemProgram: SystemProgram.programId,
          })
          .instruction();

        // Prepare message content for logging
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

        // Upload to IPFS
        const ipfsMessage = {
          content: joinContent,
          sender: publicKey.toString(),
          timestamp: Date.now(),
          channelId: channelPubkey.toString(),
        };
        const ipfsCid = await uploadMessage(ipfsMessage);

        // Compute message hash (SHA256 of content)
        const encoder = new TextEncoder();
        const data = encoder.encode(joinContent);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const messageHash = Array.from(new Uint8Array(hashBuffer));

        // Get member PDA for message logging
        const [memberPda] = getMemberPDA(channelPubkey, publicKey);

        // Build logMessage instruction
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const logMessageIx = await (shieldChatProgram.methods as any)
          .logMessage(messageHash, Buffer.from(ipfsCid))
          .accounts({
            channel: channelPubkey,
            member: memberPda,
            sender: publicKey,
          })
          .instruction();

        // Create combined transaction with both instructions
        const tx = new Transaction();
        tx.add(joinGameIx);
        tx.add(logMessageIx);

        // Get recent blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
        tx.lastValidBlockHeight = lastValidBlockHeight;
        tx.feePayer = publicKey;

        // Send via sponsored wallet (single transaction for both operations)
        const signature = await sendTransaction(tx, connection);
        console.log("[useGames] Combined join tx signature:", signature);

        // Wait for confirmation
        await connection.confirmTransaction(signature, "confirmed");

        console.log("[useGames] Joined TTT game + message logged:", gamePda.toString());

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
    [anchorWallet, publicKey, sendTransaction, channelPubkey, getGamesProgram, getShieldChatProgram, connection]
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

  // Claim Tic Tac Toe winnings (combined with message logging in single transaction)
  const claimTicTacToeWinnings = useCallback(
    async (gamePda: PublicKey): Promise<void> => {
      if (!anchorWallet || !publicKey || !sendTransaction || !channelPubkey) {
        throw new Error("Wallet not connected");
      }

      setLoading(true);
      setError(null);

      try {
        const gamesProgram = getGamesProgram();
        const shieldChatProgram = getShieldChatProgram();

        // Fetch game state first to get game info for the message
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const account = await (gamesProgram.account as any).ticTacToeGame.fetch(gamePda);
        const finalGame = {
          pubkey: gamePda,
          account: {
            ...account,
            state: parseTicTacToeState(account.state),
          } as TicTacToeGameAccount,
        };

        // Build claim winnings instruction
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const claimIx = await (gamesProgram.methods as any)
          .claimTttWinnings()
          .accounts({
            claimer: publicKey,
            game: gamePda,
          })
          .instruction();

        // Prepare message content for logging
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

        // Compute message hash (SHA256 of content)
        const encoder = new TextEncoder();
        const data = encoder.encode(resultContent);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const messageHash = Array.from(new Uint8Array(hashBuffer));

        // Get member PDA for message logging
        const [memberPda] = getMemberPDA(channelPubkey, publicKey);

        // Build logMessage instruction
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const logMessageIx = await (shieldChatProgram.methods as any)
          .logMessage(messageHash, Buffer.from(ipfsCid))
          .accounts({
            channel: channelPubkey,
            member: memberPda,
            sender: publicKey,
          })
          .instruction();

        // Create combined transaction with both instructions
        const tx = new Transaction();
        tx.add(claimIx);
        tx.add(logMessageIx);

        // Get recent blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
        tx.lastValidBlockHeight = lastValidBlockHeight;
        tx.feePayer = publicKey;

        // Send via sponsored wallet (single transaction for both operations)
        const signature = await sendTransaction(tx, connection);
        console.log("[useGames] Combined claim tx signature:", signature);

        // Wait for confirmation
        await connection.confirmTransaction(signature, "confirmed");

        console.log("[useGames] Claimed TTT winnings + result logged:", gamePda.toString());

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
    [anchorWallet, publicKey, sendTransaction, channelPubkey, getGamesProgram, getShieldChatProgram, connection]
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

  // Convert DB game record to TicTacToeGameWithPda format
  const convertDbGameToLocal = useCallback(
    (dbGame: DbGame): TicTacToeGameWithPda => {
      // Map DB state string to TicTacToeState enum
      const stateMap: Record<string, TicTacToeState> = {
        waiting: TicTacToeState.WaitingForPlayer,
        x_turn: TicTacToeState.PlayerXTurn,
        o_turn: TicTacToeState.PlayerOTurn,
        x_wins: TicTacToeState.XWins,
        o_wins: TicTacToeState.OWins,
        draw: TicTacToeState.Draw,
        cancelled: TicTacToeState.Cancelled,
      };

      return {
        pubkey: new PublicKey(dbGame.game_pda),
        account: {
          channel: new PublicKey(dbGame.channel_pda),
          playerX: new PublicKey(dbGame.player_x),
          playerO: dbGame.player_o ? new PublicKey(dbGame.player_o) : null,
          wager: new anchor.BN(dbGame.wager_lamports),
          board: dbGame.board,
          moveCount: dbGame.move_count,
          winner: dbGame.winner ? new PublicKey(dbGame.winner) : null,
          state: stateMap[dbGame.state] || TicTacToeState.WaitingForPlayer,
          createdAt: new anchor.BN(new Date(dbGame.created_at).getTime() / 1000),
          claimed: dbGame.claimed,
          bump: 0, // Not stored in DB, not needed for display
        },
      };
    },
    []
  );

  // Convert local game to DB format for syncing
  const convertLocalToDbGame = useCallback(
    (game: TicTacToeGameWithPda): Omit<DbGame, "id" | "created_at" | "updated_at"> => {
      const stateMap: Record<TicTacToeState, string> = {
        [TicTacToeState.WaitingForPlayer]: "waiting",
        [TicTacToeState.PlayerXTurn]: "x_turn",
        [TicTacToeState.PlayerOTurn]: "o_turn",
        [TicTacToeState.XWins]: "x_wins",
        [TicTacToeState.OWins]: "o_wins",
        [TicTacToeState.Draw]: "draw",
        [TicTacToeState.Cancelled]: "cancelled",
      };

      const isCompleted = [
        TicTacToeState.XWins,
        TicTacToeState.OWins,
        TicTacToeState.Draw,
        TicTacToeState.Cancelled,
      ].includes(game.account.state);

      return {
        game_pda: game.pubkey.toString(),
        game_type: "tictactoe",
        channel_pda: game.account.channel.toString(),
        player_x: game.account.playerX.toString(),
        player_o: game.account.playerO?.toString() || null,
        wager_lamports: game.account.wager.toNumber(),
        state: stateMap[game.account.state],
        board: game.account.board,
        move_count: game.account.moveCount,
        winner: game.account.winner?.toString() || null,
        claimed: game.account.claimed,
        completed_at: isCompleted ? new Date().toISOString() : null,
        create_tx_signature: null,
        last_tx_signature: null,
      };
    },
    []
  );

  // Fetch all games for a channel (hybrid: DB first, then on-chain)
  const fetchGames = useCallback(async () => {
    if (!channelPda || !anchorWallet) return;

    console.log("[useGames] Fetching games for channel:", channelPda);

    try {
      // 1. First, try to fetch from Supabase DB (fast)
      const dbGames = await getChannelGames(channelPda);
      if (dbGames.length > 0) {
        console.log("[useGames] Loaded", dbGames.length, "games from DB cache");
        const cachedGames = dbGames.map(convertDbGameToLocal);
        setTicTacToeGames(cachedGames);
      }

      // 2. Then fetch from on-chain (authoritative)
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

      console.log("[useGames] Found TTT games on-chain:", tttWithPda.length);

      // 3. Only update UI if data actually changed (prevents flicker)
      // Compare by creating a signature of the current state
      const createGameSignature = (games: TicTacToeGameWithPda[]) => {
        return games.map(g =>
          `${g.pubkey.toString()}-${g.account.state}-${g.account.moveCount}-${g.account.claimed}-${g.account.playerO?.toString() || 'null'}`
        ).sort().join('|');
      };

      setTicTacToeGames((currentGames) => {
        const currentSig = createGameSignature(currentGames);
        const newSig = createGameSignature(tttWithPda);

        if (currentSig !== newSig) {
          console.log("[useGames] Games changed, updating UI");
          return tttWithPda;
        }
        console.log("[useGames] Games unchanged, skipping UI update");
        return currentGames;
      });

      // 4. Sync on-chain data back to DB (background, don't await)
      // This ensures DB stays up-to-date even if webhook missed something
      tttWithPda.forEach((game) => {
        const dbGame = convertLocalToDbGame(game);
        upsertGame(dbGame).catch((err) => {
          console.error("[useGames] Failed to sync game to DB:", err);
        });
      });
    } catch (err) {
      console.error("[useGames] Error fetching games:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch games");
    }
  }, [channelPda, anchorWallet, getGamesProgram, convertDbGameToLocal, convertLocalToDbGame]);

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

      // Use the shared connection instead of creating a new one
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
    [anchorWallet, connection, getGamesProgram]
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

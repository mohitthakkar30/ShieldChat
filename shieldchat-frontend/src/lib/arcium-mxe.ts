/**
 * Arcium MXE Games for ShieldChat
 *
 * Provides utilities for Tic Tac Toe games
 */

import { BN } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { RPC_ENDPOINT, getTicTacToePDA } from "./constants";

// Re-export PDA helper
export { getTicTacToePDA };

// ============================================================================
// TIC TAC TOE GAME TYPES
// ============================================================================

export enum TicTacToeState {
  WaitingForPlayer = 0,
  PlayerXTurn = 1,
  PlayerOTurn = 2,
  XWins = 3,
  OWins = 4,
  Draw = 5,
  Cancelled = 6,
}

export interface TicTacToeGameAccount {
  channel: PublicKey;
  playerX: PublicKey;
  playerO: PublicKey | null;
  wager: BN;
  board: number[]; // [0-8], 0 = empty, 1 = X, 2 = O
  moveCount: number;
  winner: PublicKey | null;
  state: TicTacToeState;
  createdAt: BN;
  claimed: boolean;
  bump: number;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Get connection to Solana
export function getConnection(): Connection {
  return new Connection(RPC_ENDPOINT, "confirmed");
}

// Format lamports to SOL
export function lamportsToSol(lamports: BN | number): number {
  const value = typeof lamports === "number" ? lamports : lamports.toNumber();
  return value / 1_000_000_000;
}

// Format SOL to lamports
export function solToLamports(sol: number): BN {
  return new BN(Math.floor(sol * 1_000_000_000));
}

// Parse TicTacToe state from account data
export function parseTicTacToeState(
  state: Record<string, unknown>
): TicTacToeState {
  if ("waitingForPlayer" in state) return TicTacToeState.WaitingForPlayer;
  if ("playerXTurn" in state) return TicTacToeState.PlayerXTurn;
  if ("playerOTurn" in state) return TicTacToeState.PlayerOTurn;
  if ("xWins" in state) return TicTacToeState.XWins;
  if ("oWins" in state) return TicTacToeState.OWins;
  if ("draw" in state) return TicTacToeState.Draw;
  if ("cancelled" in state) return TicTacToeState.Cancelled;
  return TicTacToeState.WaitingForPlayer;
}

// Get TicTacToe state display name
export function getTicTacToeStateDisplay(state: TicTacToeState): string {
  switch (state) {
    case TicTacToeState.WaitingForPlayer:
      return "Waiting for opponent";
    case TicTacToeState.PlayerXTurn:
      return "X's turn";
    case TicTacToeState.PlayerOTurn:
      return "O's turn";
    case TicTacToeState.XWins:
      return "X wins!";
    case TicTacToeState.OWins:
      return "O wins!";
    case TicTacToeState.Draw:
      return "Draw!";
    case TicTacToeState.Cancelled:
      return "Cancelled";
    default:
      return "Unknown";
  }
}

// Shorten public key for display
export function shortenPubkey(pubkey: PublicKey | string): string {
  const str = typeof pubkey === "string" ? pubkey : pubkey.toString();
  return `${str.slice(0, 4)}...${str.slice(-4)}`;
}

// Format time ago
export function formatTimeAgo(timestamp: BN): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp.toNumber();

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Board position to row/col
export function positionToRowCol(position: number): { row: number; col: number } {
  return {
    row: Math.floor(position / 3),
    col: position % 3,
  };
}

// Row/col to board position
export function rowColToPosition(row: number, col: number): number {
  return row * 3 + col;
}

// Check if a position is in a winning pattern
export function isWinningPosition(board: number[], position: number): boolean {
  const marker = board[position];
  if (marker === 0) return false;

  const winPatterns = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  for (const pattern of winPatterns) {
    if (
      pattern.includes(position) &&
      board[pattern[0]] === marker &&
      board[pattern[1]] === marker &&
      board[pattern[2]] === marker
    ) {
      return true;
    }
  }
  return false;
}

// Get the winning pattern (if any)
export function getWinningPattern(board: number[]): number[] | null {
  const winPatterns = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  for (const pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (board[a] !== 0 && board[a] === board[b] && board[b] === board[c]) {
      return pattern;
    }
  }
  return null;
}

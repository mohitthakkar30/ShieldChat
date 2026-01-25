"use client";

import { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@/hooks/usePrivyAnchorWallet";
import { useGames, TicTacToeGame } from "@/hooks/useGames";
import {
  TicTacToeState,
  lamportsToSol,
  shortenPubkey,
  formatTimeAgo,
} from "@/lib/arcium-mxe";
import TicTacToeGameComponent from "./TicTacToeGame";

interface GamesModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelPubkey: PublicKey;
  initialGame?: TicTacToeGame | null; // Open directly to this game
  onInitialGameHandled?: () => void; // Callback when initialGame has been handled
}

type GameView = "list" | "create-ttt" | "ttt";

export default function GamesModal({
  isOpen,
  onClose,
  channelPubkey,
  initialGame,
  onInitialGameHandled,
}: GamesModalProps) {
  const { publicKey } = useWallet();
  const {
    ticTacToeGames,
    loading,
    createTicTacToeGame,
    refreshGames,
  } = useGames(channelPubkey);

  const [view, setView] = useState<GameView>("list");
  const [selectedGame, setSelectedGame] = useState<TicTacToeGame | null>(null);
  const [wager, setWager] = useState("0.01");
  const [creating, setCreating] = useState(false);

  // Handle initialGame prop - open directly to that game
  useEffect(() => {
    if (isOpen && initialGame) {
      setSelectedGame(initialGame);
      setView("ttt");
      onInitialGameHandled?.();
    }
  }, [isOpen, initialGame, onInitialGameHandled]);

  if (!isOpen) return null;

  const handleCreateTicTacToe = async () => {
    if (!publicKey) return;
    setCreating(true);
    try {
      await createTicTacToeGame(parseFloat(wager));
      setView("list");
      setWager("0.01");
      await refreshGames();
    } catch (error) {
      console.error("Failed to create tic tac toe game:", error);
    } finally {
      setCreating(false);
    }
  };

  const openTicTacToeGame = (game: TicTacToeGame) => {
    setSelectedGame(game);
    setView("ttt");
  };

  const goBack = () => {
    setSelectedGame(null);
    setView("list");
    refreshGames();
  };

  const renderGameList = () => (
    <div className="space-y-4">
      {/* Create button */}
      <button
        onClick={() => setView("create-ttt")}
        className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-3 rounded-lg font-medium hover:from-blue-600 hover:to-purple-600 transition-all"
      >
        + Create Tic Tac Toe Game
      </button>

      {/* Active Games */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
          Active Games
        </h3>

        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading games...</div>
        ) : ticTacToeGames.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No active games. Create one to get started!
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {ticTacToeGames.map((game) => (
              <GameCard
                key={game.pubkey.toString()}
                game={game}
                currentUser={publicKey}
                onClick={() => openTicTacToeGame(game)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderCreateTicTacToe = () => (
    <div className="space-y-4">
      <button
        onClick={() => setView("list")}
        className="text-gray-400 hover:text-white transition-colors"
      >
        ← Back
      </button>

      <div className="text-center">
        <span className="text-6xl">⭕</span>
        <h3 className="text-xl font-bold mt-2">Create Tic Tac Toe</h3>
        <p className="text-gray-400 text-sm mt-1">
          Classic game of X&apos;s and O&apos;s with SOL on the line!
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">
          Wager Amount (SOL)
        </label>
        <input
          type="number"
          value={wager}
          onChange={(e) => setWager(e.target.value)}
          min="0.001"
          step="0.01"
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="0.01"
        />
      </div>

      <button
        onClick={handleCreateTicTacToe}
        disabled={creating || !publicKey}
        className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-3 rounded-lg font-medium hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {creating ? "Creating..." : `Create Game (${wager} SOL)`}
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-bold">
            {view === "list" && "🎲 Channel Games"}
            {view === "create-ttt" && "⭕ New Tic Tac Toe"}
            {view === "ttt" && "⭕ Tic Tac Toe"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-60px)]">
          {view === "list" && renderGameList()}
          {view === "create-ttt" && renderCreateTicTacToe()}
          {view === "ttt" && selectedGame && (
            <TicTacToeGameComponent
              game={selectedGame}
              channelPubkey={channelPubkey}
              onBack={goBack}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Game Card Component
interface GameCardProps {
  game: TicTacToeGame;
  currentUser: PublicKey | null;
  onClick: () => void;
}

function GameCard({ game, currentUser, onClick }: GameCardProps) {
  const getStatusText = () => {
    switch (game.account.state) {
      case TicTacToeState.WaitingForPlayer:
        return "Waiting for opponent";
      case TicTacToeState.PlayerXTurn:
        return game.account.playerX.equals(currentUser || PublicKey.default)
          ? "Your turn (X)"
          : "Opponent's turn";
      case TicTacToeState.PlayerOTurn:
        return game.account.playerO?.equals(currentUser || PublicKey.default)
          ? "Your turn (O)"
          : "Opponent's turn";
      case TicTacToeState.XWins:
      case TicTacToeState.OWins:
        return game.account.winner?.equals(currentUser || PublicKey.default)
          ? "You won!"
          : "Game over";
      case TicTacToeState.Draw:
        return "Draw!";
      case TicTacToeState.Cancelled:
        return "Cancelled";
    }
    return "Unknown";
  };

  const isYourTurn = () => {
    if (!currentUser) return false;
    if (
      game.account.state === TicTacToeState.PlayerXTurn &&
      game.account.playerX.equals(currentUser)
    )
      return true;
    if (
      game.account.state === TicTacToeState.PlayerOTurn &&
      game.account.playerO?.equals(currentUser)
    )
      return true;
    return false;
  };

  return (
    <button
      onClick={onClick}
      className={`w-full p-3 rounded-lg border transition-all text-left ${
        isYourTurn()
          ? "border-green-500 bg-green-500/10 hover:bg-green-500/20"
          : "border-gray-700 bg-gray-700/50 hover:bg-gray-700"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⭕</span>
          <div>
            <div className="font-medium">Tic Tac Toe</div>
            <div className="text-sm text-gray-400">{getStatusText()}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold text-green-400">
            {lamportsToSol(game.account.wager)} SOL
          </div>
          <div className="text-xs text-gray-500">
            {formatTimeAgo(game.account.createdAt)}
          </div>
        </div>
      </div>
    </button>
  );
}

"use client";

import { GameAttachment } from "@/hooks/useMessages";
import { lamportsToSol } from "@/lib/arcium-mxe";
import { WalletAddress } from "@/components/WalletAddress";

interface GameMessageCardProps {
  game: GameAttachment;
  currentUser?: string;
  onClick: () => void;
}

export default function GameMessageCard({
  game,
  currentUser,
  onClick,
}: GameMessageCardProps) {
  const isCreator = currentUser === game.playerX;
  const isPlayer = currentUser === game.playerX || currentUser === game.playerO;

  const getStatusText = () => {
    switch (game.state) {
      case "waiting":
        return isCreator ? "Waiting for opponent..." : "Click to join!";
      case "in_progress":
        return "Game in progress";
      case "x_wins":
        return game.winner === currentUser ? "You won!" : "X wins!";
      case "o_wins":
        return game.winner === currentUser ? "You won!" : "O wins!";
      case "draw":
        return "It's a draw!";
      case "cancelled":
        return "Game cancelled";
      default:
        return "Unknown";
    }
  };

  const isResult = ["x_wins", "o_wins", "draw", "cancelled"].includes(game.state);
  const isWaiting = game.state === "waiting";

  return (
    <button
      onClick={onClick}
      className={`mt-2 w-full max-w-sm text-left rounded-lg p-4 border transition-all ${
        isResult
          ? "bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-blue-500/30"
          : isWaiting
          ? "bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border-yellow-500/30 hover:border-yellow-400/50 cursor-pointer"
          : "bg-gradient-to-r from-green-900/30 to-blue-900/30 border-green-500/30 hover:border-green-400/50 cursor-pointer"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">⭕</span>
        <span className="font-medium text-white">Tic Tac Toe</span>
        <span className="ml-auto text-green-400 font-bold">
          {lamportsToSol(game.wager)} SOL
        </span>
      </div>

      <div className="text-sm text-gray-400">
        {game.state === "waiting" ? (
          <p>
            Created by <WalletAddress address={game.playerX} />
          </p>
        ) : (
          <div className="flex justify-between">
            <span>
              X: <WalletAddress address={game.playerX} />
            </span>
            {game.playerO && (
              <span>
                O: <WalletAddress address={game.playerO} />
              </span>
            )}
          </div>
        )}
      </div>

      <div
        className={`mt-2 text-sm font-medium ${
          game.winner === currentUser
            ? "text-green-400"
            : isResult
            ? "text-blue-400"
            : isWaiting
            ? "text-yellow-400"
            : "text-green-400"
        }`}
      >
        {getStatusText()}
      </div>
    </button>
  );
}

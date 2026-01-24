"use client";

import { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useGames, TicTacToeGame as TicTacToeGameType } from "@/hooks/useGames";
import {
  TicTacToeState,
  lamportsToSol,
  shortenPubkey,
  formatTimeAgo,
  getWinningPattern,
} from "@/lib/arcium-mxe";

interface TicTacToeGameProps {
  game: TicTacToeGameType;
  channelPubkey: PublicKey;
  onBack: () => void;
}

export default function TicTacToeGameComponent({
  game: initialGame,
  channelPubkey,
  onBack,
}: TicTacToeGameProps) {
  const { publicKey } = useWallet();
  const {
    joinTicTacToeGame,
    makeTicTacToeMove,
    claimTicTacToeWinnings,
    cancelTicTacToeGame,
    subscribeToGame,
    fetchSingleTTTGame,
  } = useGames(channelPubkey);

  const [game, setGame] = useState(initialGame);
  const [loading, setLoading] = useState(false);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);

  const isPlayerX = publicKey?.equals(game.account.playerX);
  const isPlayerO = game.account.playerO && publicKey?.equals(game.account.playerO);

  // Subscribe to game updates (WebSocket)
  useEffect(() => {
    const unsubscribe = subscribeToGame(initialGame.pubkey, "tictactoe", (updatedGame) => {
      setGame(updatedGame as TicTacToeGameType);
    });
    return () => unsubscribe();
  }, [initialGame.pubkey, subscribeToGame]);

  // Poll for updates when waiting for opponent or it's their turn
  useEffect(() => {
    const shouldPoll =
      game.account.state === TicTacToeState.WaitingForPlayer ||
      (game.account.state === TicTacToeState.PlayerXTurn && !isPlayerX) ||
      (game.account.state === TicTacToeState.PlayerOTurn && !isPlayerO);

    if (!shouldPoll) return;

    const poll = async () => {
      const updated = await fetchSingleTTTGame(game.pubkey);
      if (updated) {
        setGame(updated);
      }
    };

    // Poll every 3 seconds
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [game.account.state, game.pubkey, isPlayerX, isPlayerO, fetchSingleTTTGame]);
  const isParticipant = isPlayerX || isPlayerO;
  const isWinner = game.account.winner && publicKey?.equals(game.account.winner);

  const isYourTurn =
    (game.account.state === TicTacToeState.PlayerXTurn && isPlayerX) ||
    (game.account.state === TicTacToeState.PlayerOTurn && isPlayerO);

  const isGameOver =
    game.account.state === TicTacToeState.XWins ||
    game.account.state === TicTacToeState.OWins ||
    game.account.state === TicTacToeState.Draw ||
    game.account.state === TicTacToeState.Cancelled;

  const winningPattern = getWinningPattern(game.account.board);

  const handleJoin = async () => {
    setLoading(true);
    try {
      await joinTicTacToeGame(game.pubkey);
    } catch (error) {
      console.error("Failed to join game:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMove = async (position: number) => {
    if (!isYourTurn || game.account.board[position] !== 0) return;

    setLoading(true);
    setSelectedCell(position);
    try {
      await makeTicTacToeMove(game.pubkey, position);
    } catch (error) {
      console.error("Failed to make move:", error);
    } finally {
      setLoading(false);
      setSelectedCell(null);
    }
  };

  const handleClaim = async () => {
    setLoading(true);
    try {
      await claimTicTacToeWinnings(game.pubkey);
    } catch (error) {
      console.error("Failed to claim winnings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setLoading(true);
    try {
      await cancelTicTacToeGame(game.pubkey);
      onBack();
    } catch (error) {
      console.error("Failed to cancel game:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderCell = (position: number) => {
    const value = game.account.board[position];
    const isWinningCell = winningPattern?.includes(position);
    const isSelected = selectedCell === position;
    const canClick = isYourTurn && value === 0 && !loading;

    return (
      <button
        key={position}
        onClick={() => handleMove(position)}
        disabled={!canClick}
        className={`
          w-20 h-20 text-4xl font-bold flex items-center justify-center
          border-2 transition-all duration-200
          ${isWinningCell ? "bg-green-500/30 border-green-400" : "border-gray-600"}
          ${canClick ? "hover:bg-gray-700 cursor-pointer" : "cursor-default"}
          ${isSelected ? "bg-blue-500/30" : "bg-gray-800"}
          ${value === 1 ? "text-blue-400" : value === 2 ? "text-red-400" : "text-gray-600"}
        `}
      >
        {value === 1 ? "X" : value === 2 ? "O" : ""}
      </button>
    );
  };

  const renderBoard = () => (
    <div className="flex justify-center my-4">
      <div className="grid grid-cols-3 gap-1 p-2 bg-gray-700 rounded-lg">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(renderCell)}
      </div>
    </div>
  );

  const renderStatus = () => {
    let statusText = "";
    let statusColor = "text-gray-400";

    switch (game.account.state) {
      case TicTacToeState.WaitingForPlayer:
        statusText = "Waiting for opponent...";
        break;
      case TicTacToeState.PlayerXTurn:
        if (isPlayerX) {
          statusText = "Your turn (X)";
          statusColor = "text-blue-400";
        } else if (isPlayerO) {
          statusText = "Opponent's turn (X)";
        } else {
          statusText = "X's turn";
        }
        break;
      case TicTacToeState.PlayerOTurn:
        if (isPlayerO) {
          statusText = "Your turn (O)";
          statusColor = "text-red-400";
        } else if (isPlayerX) {
          statusText = "Opponent's turn (O)";
        } else {
          statusText = "O's turn";
        }
        break;
      case TicTacToeState.XWins:
        statusText = isPlayerX ? "You win!" : "X wins!";
        statusColor = isPlayerX ? "text-green-400" : "text-red-400";
        break;
      case TicTacToeState.OWins:
        statusText = isPlayerO ? "You win!" : "O wins!";
        statusColor = isPlayerO ? "text-green-400" : "text-red-400";
        break;
      case TicTacToeState.Draw:
        statusText = "It's a draw!";
        statusColor = "text-yellow-400";
        break;
      case TicTacToeState.Cancelled:
        statusText = "Game cancelled";
        statusColor = "text-red-400";
        break;
    }

    return (
      <div className={`text-center text-xl font-bold ${statusColor}`}>
        {statusText}
      </div>
    );
  };

  const renderWaitingForPlayer = () => (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-gray-400">
          Created by {shortenPubkey(game.account.playerX)}
        </p>
        <p className="text-2xl font-bold text-green-400 mt-2">
          {lamportsToSol(game.account.wager)} SOL
        </p>
      </div>

      {renderBoard()}
      {renderStatus()}

      {isPlayerX ? (
        <div className="space-y-2">
          <p className="text-center text-gray-400">
            You are X. Waiting for someone to join...
          </p>
          <button
            onClick={handleCancel}
            disabled={loading}
            className="w-full bg-red-500/20 text-red-400 border border-red-500/50 px-4 py-2 rounded-lg hover:bg-red-500/30 transition-all disabled:opacity-50"
          >
            {loading ? "Cancelling..." : "Cancel Game"}
          </button>
        </div>
      ) : (
        <button
          onClick={handleJoin}
          disabled={loading}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-3 rounded-lg font-medium hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50"
        >
          {loading ? "Joining..." : `Join as O (${lamportsToSol(game.account.wager)} SOL)`}
        </button>
      )}
    </div>
  );

  const renderInProgress = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center text-sm">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
            X
          </span>
          <span className={isPlayerX ? "text-blue-400 font-bold" : "text-gray-400"}>
            {isPlayerX ? "You" : shortenPubkey(game.account.playerX)}
          </span>
        </div>
        <div className="text-green-400 font-bold">
          {lamportsToSol(game.account.wager) * 2} SOL
        </div>
        <div className="flex items-center gap-2">
          <span className={isPlayerO ? "text-red-400 font-bold" : "text-gray-400"}>
            {isPlayerO ? "You" : game.account.playerO ? shortenPubkey(game.account.playerO) : "..."}
          </span>
          <span className="w-6 h-6 rounded bg-red-500/20 text-red-400 flex items-center justify-center font-bold">
            O
          </span>
        </div>
      </div>

      {renderBoard()}
      {renderStatus()}

      {loading && (
        <p className="text-center text-gray-400 animate-pulse">
          Processing move...
        </p>
      )}
    </div>
  );

  const renderGameOver = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center text-sm">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
            X
          </span>
          <span className={isPlayerX ? "text-blue-400 font-bold" : "text-gray-400"}>
            {isPlayerX ? "You" : shortenPubkey(game.account.playerX)}
          </span>
        </div>
        <div className="text-green-400 font-bold">
          {lamportsToSol(game.account.wager) * 2} SOL
        </div>
        <div className="flex items-center gap-2">
          <span className={isPlayerO ? "text-red-400 font-bold" : "text-gray-400"}>
            {isPlayerO ? "You" : game.account.playerO ? shortenPubkey(game.account.playerO) : "..."}
          </span>
          <span className="w-6 h-6 rounded bg-red-500/20 text-red-400 flex items-center justify-center font-bold">
            O
          </span>
        </div>
      </div>

      {renderBoard()}
      {renderStatus()}

      {game.account.state !== TicTacToeState.Cancelled && (
        <div className="bg-gray-700/50 rounded-lg p-4">
          {game.account.state === TicTacToeState.Draw ? (
            <div className="text-center">
              <p className="text-gray-400">The pot will be split between both players.</p>
              <p className="text-green-400 font-bold">
                Each player receives: {lamportsToSol(game.account.wager)} SOL
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-gray-400">
                Winner: {game.account.winner && (
                  isWinner ? (
                    <span className="text-green-400 font-bold">You! 🏆</span>
                  ) : (
                    shortenPubkey(game.account.winner)
                  )
                )}
              </p>
              <p className="text-green-400 font-bold">
                Prize: {lamportsToSol(game.account.wager) * 2} SOL
              </p>
            </div>
          )}
        </div>
      )}

      {isParticipant && !game.account.claimed && game.account.state !== TicTacToeState.Cancelled && (
        (isWinner || game.account.state === TicTacToeState.Draw) && (
          <button
            onClick={handleClaim}
            disabled={loading}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-3 rounded-lg font-medium hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50"
          >
            {loading ? "Claiming..." : `Claim ${
              game.account.state === TicTacToeState.Draw
                ? lamportsToSol(game.account.wager)
                : lamportsToSol(game.account.wager) * 2
            } SOL`}
          </button>
        )
      )}

      {game.account.claimed && (
        <p className="text-center text-gray-400">Prize has been claimed</p>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-gray-400 hover:text-white transition-colors"
      >
        ← Back to games
      </button>

      <div className="text-center text-sm text-gray-500">
        {formatTimeAgo(game.account.createdAt)}
      </div>

      {game.account.state === TicTacToeState.WaitingForPlayer && renderWaitingForPlayer()}
      {(game.account.state === TicTacToeState.PlayerXTurn ||
        game.account.state === TicTacToeState.PlayerOTurn) && renderInProgress()}
      {isGameOver && renderGameOver()}
    </div>
  );
}

-- ============================================================================
-- ShieldChat Games Database Schema
-- Run this in Supabase SQL Editor to create the games tables
-- ============================================================================

-- Games table - stores all game instances
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_pda TEXT UNIQUE NOT NULL,           -- On-chain account address (base58)
  game_type TEXT NOT NULL DEFAULT 'tictactoe',  -- 'tictactoe' | 'coinflip'
  channel_pda TEXT NOT NULL,               -- Channel this game belongs to
  player_x TEXT NOT NULL,                  -- Creator/Player X wallet address
  player_o TEXT,                           -- Joiner/Player O (null if waiting)
  wager_lamports BIGINT NOT NULL,          -- Wager amount in lamports
  state TEXT NOT NULL DEFAULT 'waiting',   -- Game state string
  board SMALLINT[] DEFAULT ARRAY[0,0,0,0,0,0,0,0,0]::SMALLINT[],  -- TicTacToe board
  move_count SMALLINT DEFAULT 0,           -- Number of moves made
  winner TEXT,                             -- Winner wallet address
  claimed BOOLEAN DEFAULT FALSE,           -- Whether winnings have been claimed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,                -- When game ended
  create_tx_signature TEXT,                -- Transaction that created the game
  last_tx_signature TEXT                   -- Most recent transaction
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_games_channel ON games(channel_pda);
CREATE INDEX IF NOT EXISTS idx_games_state ON games(state);
CREATE INDEX IF NOT EXISTS idx_games_player_x ON games(player_x);
CREATE INDEX IF NOT EXISTS idx_games_player_o ON games(player_o);
CREATE INDEX IF NOT EXISTS idx_games_created ON games(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_type ON games(game_type);

-- Game moves table - stores move history for replays/analytics
CREATE TABLE IF NOT EXISTS game_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_pda TEXT NOT NULL REFERENCES games(game_pda) ON DELETE CASCADE,
  move_number SMALLINT NOT NULL,
  player TEXT NOT NULL,                    -- Player who made the move
  position SMALLINT,                       -- Cell position (0-8) for TicTacToe
  move_data JSONB,                         -- Additional move data if needed
  tx_signature TEXT NOT NULL,              -- Transaction signature
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moves_game ON game_moves(game_pda);
CREATE INDEX IF NOT EXISTS idx_moves_player ON game_moves(player);

-- Player statistics view (materialized for performance)
CREATE OR REPLACE VIEW player_game_stats AS
SELECT
  player,
  game_type,
  COUNT(*) as total_games,
  COUNT(*) FILTER (WHERE winner = player) as wins,
  COUNT(*) FILTER (WHERE winner IS NOT NULL AND winner != player) as losses,
  COUNT(*) FILTER (WHERE state = 'draw') as draws,
  SUM(CASE WHEN winner = player THEN wager_lamports * 2 ELSE 0 END) as total_won_lamports,
  SUM(wager_lamports) as total_wagered_lamports
FROM (
  SELECT game_pda, game_type, player_x as player, wager_lamports, winner, state
  FROM games
  WHERE state IN ('x_wins', 'o_wins', 'draw')
  UNION ALL
  SELECT game_pda, game_type, player_o as player, wager_lamports, winner, state
  FROM games
  WHERE player_o IS NOT NULL AND state IN ('x_wins', 'o_wins', 'draw')
) as all_participations
GROUP BY player, game_type;

-- Function to get player stats
CREATE OR REPLACE FUNCTION get_player_game_stats(player_pubkey TEXT)
RETURNS TABLE (
  game_type TEXT,
  total_games BIGINT,
  wins BIGINT,
  losses BIGINT,
  draws BIGINT,
  total_won_lamports BIGINT,
  total_wagered_lamports BIGINT,
  win_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pgs.game_type,
    pgs.total_games,
    pgs.wins,
    pgs.losses,
    pgs.draws,
    pgs.total_won_lamports,
    pgs.total_wagered_lamports,
    CASE
      WHEN pgs.total_games > 0
      THEN ROUND((pgs.wins::NUMERIC / pgs.total_games) * 100, 2)
      ELSE 0
    END as win_rate
  FROM player_game_stats pgs
  WHERE pgs.player = player_pubkey;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_moves ENABLE ROW LEVEL SECURITY;

-- Allow public read access (games are public on-chain anyway)
CREATE POLICY "Games are viewable by everyone"
  ON games FOR SELECT
  USING (true);

CREATE POLICY "Moves are viewable by everyone"
  ON game_moves FOR SELECT
  USING (true);

-- Allow insert/update from any client (anon key)
-- Games are synced client-side when users interact with them
-- This is safe because:
-- 1. Game data is public on-chain anyway
-- 2. Blockchain is the authoritative source of truth
-- 3. DB is just a cache/index for fast queries
CREATE POLICY "Anyone can insert games"
  ON games FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update games"
  ON games FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can insert moves"
  ON game_moves FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- Useful queries for reference:
-- ============================================================================
--
-- Get active games for a channel:
-- SELECT * FROM games WHERE channel_pda = 'xxx' AND state IN ('waiting', 'x_turn', 'o_turn');
--
-- Get completed games:
-- SELECT * FROM games WHERE channel_pda = 'xxx' AND state IN ('x_wins', 'o_wins', 'draw', 'cancelled');
--
-- Get player stats:
-- SELECT * FROM get_player_game_stats('player_wallet_address');
--
-- Get game with moves:
-- SELECT g.*, json_agg(m ORDER BY m.move_number) as moves
-- FROM games g
-- LEFT JOIN game_moves m ON g.game_pda = m.game_pda
-- WHERE g.game_pda = 'xxx'
-- GROUP BY g.id;

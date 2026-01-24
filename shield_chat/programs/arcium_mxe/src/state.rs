use anchor_lang::prelude::*;

// ============================================================================
// COINFLIP GAME STATE
// ============================================================================

/// Coinflip game state enum
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum GameState {
    /// Waiting for second player to join
    WaitingForPlayer,
    /// Both players joined, waiting for reveals
    WaitingForReveal,
    /// Game completed, winner determined
    Completed,
    /// Game cancelled by creator
    Cancelled,
}

impl Default for GameState {
    fn default() -> Self {
        GameState::WaitingForPlayer
    }
}

/// Coinflip game account
#[account]
pub struct CoinflipGame {
    /// The channel this game belongs to
    pub channel: Pubkey,

    /// Player A (game creator)
    pub player_a: Pubkey,

    /// Player B (joiner, None until joined)
    pub player_b: Option<Pubkey>,

    /// Wager amount in lamports (each player contributes this)
    pub wager: u64,

    /// Player A's secret commitment (hash of their choice + nonce)
    pub commitment_a: [u8; 32],

    /// Player B's secret commitment (set when they join)
    pub commitment_b: Option<[u8; 32]>,

    /// Player A's revealed choice (0 = heads, 1 = tails)
    pub choice_a: Option<u8>,

    /// Player A's revealed nonce
    pub nonce_a: Option<[u8; 32]>,

    /// Player B's revealed choice
    pub choice_b: Option<u8>,

    /// Player B's revealed nonce
    pub nonce_b: Option<[u8; 32]>,

    /// The winner (set after both reveal)
    pub winner: Option<Pubkey>,

    /// Game state
    pub state: GameState,

    /// Unix timestamp when game was created
    pub created_at: i64,

    /// Whether winnings have been claimed
    pub claimed: bool,

    /// PDA bump seed
    pub bump: u8,
}

impl CoinflipGame {
    /// Space needed for CoinflipGame account
    pub const SPACE: usize = 8  // discriminator
        + 32  // channel
        + 32  // player_a
        + (1 + 32)  // player_b (Option<Pubkey>)
        + 8   // wager
        + 32  // commitment_a
        + (1 + 32)  // commitment_b (Option)
        + (1 + 1)   // choice_a (Option<u8>)
        + (1 + 32)  // nonce_a (Option)
        + (1 + 1)   // choice_b (Option<u8>)
        + (1 + 32)  // nonce_b (Option)
        + (1 + 32)  // winner (Option<Pubkey>)
        + 1   // state (enum)
        + 8   // created_at
        + 1   // claimed
        + 1;  // bump

    /// Check if game is waiting for a second player
    pub fn is_waiting_for_player(&self) -> bool {
        self.state == GameState::WaitingForPlayer
    }

    /// Check if game is waiting for reveals
    pub fn is_waiting_for_reveal(&self) -> bool {
        self.state == GameState::WaitingForReveal
    }

    /// Check if game is completed
    pub fn is_completed(&self) -> bool {
        self.state == GameState::Completed
    }

    /// Compute winner based on revealed choices
    /// XOR of choices determines winner: same = A wins, different = B wins
    pub fn compute_winner(&self) -> Option<Pubkey> {
        match (self.choice_a, self.choice_b, &self.player_b) {
            (Some(a), Some(b), Some(player_b)) => {
                // XOR the choices - if same, player A wins; if different, player B wins
                if a == b {
                    Some(self.player_a)
                } else {
                    Some(*player_b)
                }
            }
            _ => None,
        }
    }
}

// ============================================================================
// TIC TAC TOE GAME STATE
// ============================================================================

/// Tic Tac Toe game state enum
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum TicTacToeState {
    /// Waiting for Player O to join
    WaitingForPlayer,
    /// Player X's turn
    PlayerXTurn,
    /// Player O's turn
    PlayerOTurn,
    /// Player X wins
    XWins,
    /// Player O wins
    OWins,
    /// Draw (board full, no winner)
    Draw,
    /// Game cancelled by creator
    Cancelled,
}

impl Default for TicTacToeState {
    fn default() -> Self {
        TicTacToeState::WaitingForPlayer
    }
}

/// Win patterns for Tic Tac Toe
/// Each pattern is [position1, position2, position3]
pub const WIN_PATTERNS: [[usize; 3]; 8] = [
    [0, 1, 2], // Top row
    [3, 4, 5], // Middle row
    [6, 7, 8], // Bottom row
    [0, 3, 6], // Left column
    [1, 4, 7], // Middle column
    [2, 5, 8], // Right column
    [0, 4, 8], // Diagonal \
    [2, 4, 6], // Diagonal /
];

/// Tic Tac Toe game account
/// Board layout:
///  0 | 1 | 2
/// -----------
///  3 | 4 | 5
/// -----------
///  6 | 7 | 8
#[account]
pub struct TicTacToeGame {
    /// The channel this game belongs to
    pub channel: Pubkey,

    /// Player X (game creator, goes first)
    pub player_x: Pubkey,

    /// Player O (joiner)
    pub player_o: Option<Pubkey>,

    /// Wager amount in lamports (each player contributes this)
    pub wager: u64,

    /// Game board: 0 = empty, 1 = X, 2 = O
    pub board: [u8; 9],

    /// Number of moves made (0-9)
    pub move_count: u8,

    /// The winner (set when game ends, None for draw)
    pub winner: Option<Pubkey>,

    /// Game state
    pub state: TicTacToeState,

    /// Unix timestamp when game was created
    pub created_at: i64,

    /// Whether winnings have been claimed (or refunded on draw)
    pub claimed: bool,

    /// PDA bump seed
    pub bump: u8,
}

impl TicTacToeGame {
    /// Space needed for TicTacToeGame account
    pub const SPACE: usize = 8   // discriminator
        + 32  // channel
        + 32  // player_x
        + (1 + 32)  // player_o (Option<Pubkey>)
        + 8   // wager
        + 9   // board
        + 1   // move_count
        + (1 + 32)  // winner (Option<Pubkey>)
        + 1   // state (enum)
        + 8   // created_at
        + 1   // claimed
        + 1;  // bump

    /// Check if game is waiting for a second player
    pub fn is_waiting_for_player(&self) -> bool {
        self.state == TicTacToeState::WaitingForPlayer
    }

    /// Check if it's the given player's turn
    pub fn is_players_turn(&self, player: &Pubkey) -> bool {
        match self.state {
            TicTacToeState::PlayerXTurn => *player == self.player_x,
            TicTacToeState::PlayerOTurn => {
                self.player_o.as_ref().map_or(false, |o| *player == *o)
            }
            _ => false,
        }
    }

    /// Check if game is still in progress
    pub fn is_in_progress(&self) -> bool {
        matches!(
            self.state,
            TicTacToeState::PlayerXTurn | TicTacToeState::PlayerOTurn
        )
    }

    /// Check if game has ended (win or draw)
    pub fn is_finished(&self) -> bool {
        matches!(
            self.state,
            TicTacToeState::XWins | TicTacToeState::OWins | TicTacToeState::Draw
        )
    }

    /// Check if a position is valid and empty
    pub fn is_valid_move(&self, position: u8) -> bool {
        position < 9 && self.board[position as usize] == 0
    }

    /// Check for a winner on the board
    /// Returns Some(1) for X wins, Some(2) for O wins, None otherwise
    pub fn check_winner(&self) -> Option<u8> {
        for pattern in WIN_PATTERNS {
            let [a, b, c] = pattern;
            if self.board[a] != 0
                && self.board[a] == self.board[b]
                && self.board[b] == self.board[c]
            {
                return Some(self.board[a]);
            }
        }
        None
    }

    /// Check if the board is full (draw condition)
    pub fn is_board_full(&self) -> bool {
        self.move_count >= 9
    }

    /// Get the player marker (1 for X, 2 for O) for the current turn
    pub fn current_marker(&self) -> u8 {
        match self.state {
            TicTacToeState::PlayerXTurn => 1,
            TicTacToeState::PlayerOTurn => 2,
            _ => 0,
        }
    }
}

use anchor_lang::prelude::*;

#[error_code]
pub enum ArciumMxeError {
    // ============================================================================
    // COINFLIP GAME ERRORS
    // ============================================================================

    #[msg("Invalid wager amount (minimum 0.001 SOL)")]
    InvalidWager,

    #[msg("Game already has two players")]
    GameFull,

    #[msg("Cannot join your own game")]
    CannotJoinOwnGame,

    #[msg("Game is not in the correct state for this action")]
    InvalidGameState,

    #[msg("Invalid commitment hash - does not match revealed choice and nonce")]
    InvalidCommitment,

    #[msg("Only the game creator can cancel")]
    NotGameCreator,

    #[msg("Game already started, cannot cancel")]
    GameAlreadyStarted,

    #[msg("Only game participants can reveal")]
    NotParticipant,

    #[msg("Only the winner can claim winnings")]
    NotGameWinner,

    #[msg("Choice must be 0 (heads) or 1 (tails)")]
    InvalidChoice,

    #[msg("Already revealed your choice")]
    AlreadyRevealed,

    #[msg("Winnings already claimed")]
    AlreadyClaimed,

    // ============================================================================
    // TIC TAC TOE GAME ERRORS
    // ============================================================================

    #[msg("Not your turn")]
    NotYourTurn,

    #[msg("Invalid board position (must be 0-8)")]
    InvalidPosition,

    #[msg("Position already occupied")]
    PositionOccupied,

    #[msg("Game is not in progress")]
    GameNotInProgress,

    #[msg("Game has not finished yet")]
    GameNotFinished,

    #[msg("Only players can claim winnings")]
    NotPlayer,

    // ============================================================================
    // GENERAL ERRORS
    // ============================================================================

    #[msg("Not authorized to perform this action")]
    NotAuthorized,

    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("Insufficient funds")]
    InsufficientFunds,
}

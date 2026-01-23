use anchor_lang::prelude::*;

/// Maximum length for poll question
pub const MAX_QUESTION_LEN: usize = 200;

/// Maximum length for each option text
pub const MAX_OPTION_LEN: usize = 50;

/// Maximum number of options per poll
pub const MAX_OPTIONS: usize = 4;

/// Poll account - stores the poll configuration and encrypted vote counts
#[account]
pub struct Poll {
    /// The channel this poll belongs to
    pub channel: Pubkey,

    /// The user who created the poll
    pub creator: Pubkey,

    /// The poll question (max 200 characters)
    pub question: String,

    /// The poll options (max 4 options, 50 chars each)
    pub options: [String; MAX_OPTIONS],

    /// Number of active options (2-4)
    pub options_count: u8,

    /// Encrypted vote counts per option (Inco Euint128 handles stored as u128)
    pub vote_counts: [u128; MAX_OPTIONS],

    /// Total number of votes cast (public counter for transparency)
    pub total_votes: u64,

    /// Unix timestamp when voting ends
    pub end_time: i64,

    /// Whether results have been revealed
    pub revealed: bool,

    /// Plaintext vote counts after reveal
    pub revealed_counts: [u64; MAX_OPTIONS],

    /// PDA bump seed
    pub bump: u8,
}

impl Poll {
    /// Calculate space needed for Poll account
    /// 8 (discriminator) + 32 (channel) + 32 (creator) + 4 + 200 (question)
    /// + 4 * (4 + 50) (options) + 1 (options_count) + 4 * 16 (vote_counts)
    /// + 8 (total_votes) + 8 (end_time) + 1 (revealed) + 4 * 8 (revealed_counts) + 1 (bump)
    pub const SPACE: usize = 8 + 32 + 32 + (4 + MAX_QUESTION_LEN)
        + MAX_OPTIONS * (4 + MAX_OPTION_LEN)
        + 1
        + MAX_OPTIONS * 16
        + 8
        + 8
        + 1
        + MAX_OPTIONS * 8
        + 1;

    /// Check if the poll is still active (not ended and not revealed)
    pub fn is_active(&self, current_time: i64) -> bool {
        current_time < self.end_time && !self.revealed
    }

    /// Check if the poll has ended but not yet revealed
    pub fn is_ended_not_revealed(&self, current_time: i64) -> bool {
        current_time >= self.end_time && !self.revealed
    }
}

/// VoteRecord account - tracks that a user has voted (prevents double voting)
/// Does NOT store which option they voted for (preserves anonymity)
#[account]
pub struct VoteRecord {
    /// The poll this vote is for
    pub poll: Pubkey,

    /// The voter's wallet address
    pub voter: Pubkey,

    /// Unix timestamp when the vote was cast
    pub voted_at: i64,

    /// PDA bump seed
    pub bump: u8,
}

impl VoteRecord {
    /// Space needed for VoteRecord account
    /// 8 (discriminator) + 32 (poll) + 32 (voter) + 8 (voted_at) + 1 (bump)
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 1;
}

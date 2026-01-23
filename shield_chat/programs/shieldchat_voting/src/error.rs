use anchor_lang::prelude::*;

#[error_code]
pub enum VotingError {
    #[msg("Question exceeds maximum length of 200 characters")]
    QuestionTooLong,

    #[msg("Option exceeds maximum length of 50 characters")]
    OptionTooLong,

    #[msg("Poll must have between 2 and 4 options")]
    InvalidOptionsCount,

    #[msg("Poll duration must be at least 1 minute")]
    DurationTooShort,

    #[msg("Poll duration cannot exceed 30 days")]
    DurationTooLong,

    #[msg("Invalid option index")]
    InvalidOptionIndex,

    #[msg("Poll has ended")]
    PollEnded,

    #[msg("Poll has not ended yet")]
    PollNotEnded,

    #[msg("User has already voted on this poll")]
    AlreadyVoted,

    #[msg("Results have already been revealed")]
    AlreadyRevealed,

    #[msg("Results must be revealed before closing")]
    NotRevealed,

    #[msg("Not authorized to perform this action")]
    NotAuthorized,

    #[msg("Invalid plaintext count")]
    InvalidPlaintextCount,

    #[msg("Vote count overflow")]
    Overflow,
}

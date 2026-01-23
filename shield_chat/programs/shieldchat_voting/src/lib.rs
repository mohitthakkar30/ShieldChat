use anchor_lang::prelude::*;
use inco_lightning::cpi::accounts::Operation;
use inco_lightning::cpi::{as_euint128, e_add, new_euint128};
use inco_lightning::types::Euint128;
use inco_lightning::ID as INCO_LIGHTNING_ID;

pub mod error;
pub mod state;

use error::VotingError;
use state::{Poll, VoteRecord, MAX_OPTIONS, MAX_OPTION_LEN, MAX_QUESTION_LEN};

declare_id!("H19dGK9xWHppSSuAEv9TfgPyK1S2dB1zihBXPXQnWdC5");

/// Minimum poll duration: 1 minute
const MIN_DURATION_SECONDS: i64 = 60;

/// Maximum poll duration: 30 days
const MAX_DURATION_SECONDS: i64 = 30 * 24 * 60 * 60;

#[program]
pub mod shieldchat_voting {
    use super::*;

    /// Create a new anonymous poll in a channel
    ///
    /// # Arguments
    /// * `question` - The poll question (max 200 characters)
    /// * `options` - The poll options (2-4 options, max 50 characters each)
    /// * `duration_seconds` - How long the poll should be active (60s to 30 days)
    /// * `nonce` - Unique nonce for PDA derivation (typically current timestamp)
    pub fn create_poll(
        ctx: Context<CreatePoll>,
        question: String,
        options: Vec<String>,
        duration_seconds: i64,
        nonce: u64,
    ) -> Result<()> {
        // Silence unused warning - nonce is used in PDA seeds
        let _ = nonce;

        // Validate question length
        require!(
            question.len() <= MAX_QUESTION_LEN,
            VotingError::QuestionTooLong
        );

        // Validate options count
        require!(
            options.len() >= 2 && options.len() <= MAX_OPTIONS,
            VotingError::InvalidOptionsCount
        );

        // Validate each option length
        for option in &options {
            require!(option.len() <= MAX_OPTION_LEN, VotingError::OptionTooLong);
        }

        // Validate duration
        require!(
            duration_seconds >= MIN_DURATION_SECONDS,
            VotingError::DurationTooShort
        );
        require!(
            duration_seconds <= MAX_DURATION_SECONDS,
            VotingError::DurationTooLong
        );

        let clock = Clock::get()?;
        let poll = &mut ctx.accounts.poll;

        // Initialize poll fields
        poll.channel = ctx.accounts.channel.key();
        poll.creator = ctx.accounts.creator.key();
        poll.question = question;
        poll.options_count = options.len() as u8;
        poll.total_votes = 0;
        poll.end_time = clock.unix_timestamp + duration_seconds;
        poll.revealed = false;
        poll.bump = ctx.bumps.poll;

        // Initialize options array (pad with empty strings)
        let mut options_array = [
            String::new(),
            String::new(),
            String::new(),
            String::new(),
        ];
        for (i, option) in options.iter().enumerate() {
            options_array[i] = option.clone();
        }
        poll.options = options_array;

        // Initialize vote counts to encrypted zeros using Inco
        // Each vote count starts as trivially encrypted 0
        for i in 0..MAX_OPTIONS {
            let cpi_ctx = CpiContext::new(
                ctx.accounts.inco_lightning_program.to_account_info(),
                Operation {
                    signer: ctx.accounts.creator.to_account_info(),
                },
            );

            // Create encrypted zero (trivial encryption of 0)
            let encrypted_zero = as_euint128(cpi_ctx, 0)?;
            poll.vote_counts[i] = encrypted_zero.0;
        }

        // Initialize revealed counts to zero
        poll.revealed_counts = [0; MAX_OPTIONS];

        msg!(
            "Poll created: {} options, ends at {}",
            poll.options_count,
            poll.end_time
        );

        Ok(())
    }

    /// Cast an anonymous vote on a poll
    ///
    /// # Arguments
    /// * `option_index` - Which option to vote for (0-based index)
    /// * `ciphertext` - Client-encrypted value of 1 (from Inco SDK)
    /// * `input_type` - 0 for ciphertext, 1 for plaintext
    pub fn cast_vote(
        ctx: Context<CastVote>,
        option_index: u8,
        ciphertext: Vec<u8>,
        input_type: u8,
    ) -> Result<()> {
        let poll = &mut ctx.accounts.poll;
        let vote_record = &mut ctx.accounts.vote_record;

        // Validate option index
        require!(
            (option_index as usize) < poll.options_count as usize,
            VotingError::InvalidOptionIndex
        );

        let clock = Clock::get()?;

        // Validate poll is still active
        require!(poll.is_active(clock.unix_timestamp), VotingError::PollEnded);

        // Initialize vote record
        vote_record.poll = poll.key();
        vote_record.voter = ctx.accounts.voter.key();
        vote_record.voted_at = clock.unix_timestamp;
        vote_record.bump = ctx.bumps.vote_record;

        // Create encrypted "1" from client ciphertext
        let cpi_ctx_new = CpiContext::new(
            ctx.accounts.inco_lightning_program.to_account_info(),
            Operation {
                signer: ctx.accounts.voter.to_account_info(),
            },
        );
        let encrypted_one: Euint128 = new_euint128(cpi_ctx_new, ciphertext, input_type)?;

        // Get the current encrypted vote count for this option
        let current_count = Euint128(poll.vote_counts[option_index as usize]);

        // Add the encrypted vote to the current count
        // This is homomorphic addition: encrypted(count) + encrypted(1) = encrypted(count + 1)
        let cpi_ctx_add = CpiContext::new(
            ctx.accounts.inco_lightning_program.to_account_info(),
            Operation {
                signer: ctx.accounts.voter.to_account_info(),
            },
        );
        let new_count: Euint128 = e_add(cpi_ctx_add, current_count, encrypted_one, 0)?;

        // Store the new encrypted count
        poll.vote_counts[option_index as usize] = new_count.0;

        // Note: For decryption, the Inco SDK handles access control via wallet signatures
        // The poll creator will use attested decrypt with their wallet to reveal results

        // Increment public total vote counter
        poll.total_votes = poll
            .total_votes
            .checked_add(1)
            .ok_or(VotingError::Overflow)?;

        msg!(
            "Vote cast on option {} (total votes: {})",
            option_index,
            poll.total_votes
        );

        Ok(())
    }

    /// Reveal poll results after voting has ended
    ///
    /// # Arguments
    /// * `plaintexts` - Decrypted vote counts from Inco attested decrypt
    pub fn reveal_results(ctx: Context<RevealResults>, plaintexts: Vec<u64>) -> Result<()> {
        let poll = &mut ctx.accounts.poll;
        let clock = Clock::get()?;

        // Validate poll has ended
        require!(
            poll.is_ended_not_revealed(clock.unix_timestamp),
            VotingError::PollNotEnded
        );

        // Validate we have the right number of plaintexts
        require!(
            plaintexts.len() == poll.options_count as usize,
            VotingError::InvalidPlaintextCount
        );

        // Validate total votes matches sum of plaintexts
        let sum: u64 = plaintexts.iter().sum();
        require!(sum == poll.total_votes, VotingError::InvalidPlaintextCount);

        // Store revealed counts
        for (i, &plaintext) in plaintexts.iter().enumerate() {
            poll.revealed_counts[i] = plaintext;
        }

        // Mark as revealed
        poll.revealed = true;

        msg!(
            "Poll results revealed: {:?}",
            &poll.revealed_counts[..poll.options_count as usize]
        );

        Ok(())
    }

    /// Close a poll and recover rent
    pub fn close_poll(_ctx: Context<ClosePoll>) -> Result<()> {
        msg!("Poll closed and rent recovered");
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(question: String, options: Vec<String>, duration_seconds: i64, nonce: u64)]
pub struct CreatePoll<'info> {
    /// The user creating the poll
    #[account(mut)]
    pub creator: Signer<'info>,

    /// The channel this poll belongs to
    /// CHECK: We trust the creator to provide a valid channel PDA
    pub channel: UncheckedAccount<'info>,

    /// The poll account to create
    #[account(
        init,
        payer = creator,
        space = Poll::SPACE,
        seeds = [
            b"poll",
            channel.key().as_ref(),
            creator.key().as_ref(),
            &nonce.to_le_bytes()
        ],
        bump
    )]
    pub poll: Account<'info, Poll>,

    /// Inco Lightning program for encrypted operations
    /// CHECK: Verified by address constraint
    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: AccountInfo<'info>,

    /// System program for account creation
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CastVote<'info> {
    /// The voter
    #[account(mut)]
    pub voter: Signer<'info>,

    /// The poll being voted on
    #[account(mut)]
    pub poll: Account<'info, Poll>,

    /// VoteRecord to track that this user has voted (prevents double voting)
    #[account(
        init,
        payer = voter,
        space = VoteRecord::SPACE,
        seeds = [
            b"vote_record",
            poll.key().as_ref(),
            voter.key().as_ref()
        ],
        bump
    )]
    pub vote_record: Account<'info, VoteRecord>,

    /// Inco Lightning program for encrypted operations
    /// CHECK: Verified by address constraint
    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: AccountInfo<'info>,

    /// System program for account creation
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevealResults<'info> {
    /// Anyone can trigger reveal after poll ends
    #[account(mut)]
    pub revealer: Signer<'info>,

    /// The poll to reveal results for
    #[account(
        mut,
        constraint = !poll.revealed @ VotingError::AlreadyRevealed
    )]
    pub poll: Account<'info, Poll>,
}

#[derive(Accounts)]
pub struct ClosePoll<'info> {
    /// The poll creator (receives rent)
    #[account(mut)]
    pub closer: Signer<'info>,

    /// The poll to close
    #[account(
        mut,
        close = closer,
        constraint = poll.revealed @ VotingError::NotRevealed,
        constraint = poll.creator == closer.key() @ VotingError::NotAuthorized
    )]
    pub poll: Account<'info, Poll>,
}

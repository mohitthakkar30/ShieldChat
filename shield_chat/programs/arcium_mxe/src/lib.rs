use anchor_lang::prelude::*;
use anchor_lang::system_program;

pub mod error;
pub mod state;

use error::ArciumMxeError;
use state::{CoinflipGame, GameState, TicTacToeGame, TicTacToeState};

declare_id!("Bg4L8JiYF7EmoAXHMXtzSfMBkJg9b8fnNjYSPDTi7sMm");

/// Minimum wager: 0.001 SOL
const MIN_WAGER: u64 = 1_000_000;

#[program]
pub mod arcium_mxe {
    use super::*;

    // ========================================================================
    // COINFLIP GAME INSTRUCTIONS
    // ========================================================================

    /// Create a new coinflip game
    pub fn create_game(
        ctx: Context<CreateGame>,
        wager: u64,
        commitment: [u8; 32],
        nonce: u64,
    ) -> Result<()> {
        // Silence unused warning
        let _ = nonce;

        // Validate wager
        require!(wager >= MIN_WAGER, ArciumMxeError::InvalidWager);

        let clock = Clock::get()?;

        // Transfer wager to game escrow
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.player_a.to_account_info(),
                    to: ctx.accounts.game.to_account_info(),
                },
            ),
            wager,
        )?;

        let game = &mut ctx.accounts.game;
        game.channel = ctx.accounts.channel.key();
        game.player_a = ctx.accounts.player_a.key();
        game.player_b = None;
        game.wager = wager;
        game.commitment_a = commitment;
        game.commitment_b = None;
        game.choice_a = None;
        game.nonce_a = None;
        game.choice_b = None;
        game.nonce_b = None;
        game.winner = None;
        game.state = GameState::WaitingForPlayer;
        game.created_at = clock.unix_timestamp;
        game.claimed = false;
        game.bump = ctx.bumps.game;

        msg!("Coinflip game created, wager: {} lamports", wager);

        Ok(())
    }

    /// Join an existing coinflip game
    pub fn join_game(ctx: Context<JoinGame>, commitment: [u8; 32]) -> Result<()> {
        // Validate game state
        require!(
            ctx.accounts.game.is_waiting_for_player(),
            ArciumMxeError::InvalidGameState
        );

        // Cannot join own game
        require!(
            ctx.accounts.game.player_a != ctx.accounts.player_b.key(),
            ArciumMxeError::CannotJoinOwnGame
        );

        // Get wager before mutable borrow
        let wager = ctx.accounts.game.wager;

        // Transfer matching wager
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.player_b.to_account_info(),
                    to: ctx.accounts.game.to_account_info(),
                },
            ),
            wager,
        )?;

        let game = &mut ctx.accounts.game;
        game.player_b = Some(ctx.accounts.player_b.key());
        game.commitment_b = Some(commitment);
        game.state = GameState::WaitingForReveal;

        msg!("Player B joined the coinflip game");

        Ok(())
    }

    /// Reveal your choice (both players must call this)
    pub fn reveal_choice(
        ctx: Context<RevealChoice>,
        choice: u8,
        nonce: [u8; 32],
    ) -> Result<()> {
        let revealer = ctx.accounts.revealer.key();

        // Validate game state
        require!(
            ctx.accounts.game.is_waiting_for_reveal(),
            ArciumMxeError::InvalidGameState
        );

        // Validate choice (0 or 1)
        require!(choice <= 1, ArciumMxeError::InvalidChoice);

        // Verify commitment: hash(choice || nonce) should match stored commitment
        let mut data = Vec::with_capacity(33);
        data.push(choice);
        data.extend_from_slice(&nonce);
        let computed_hash = solana_program::keccak::hash(&data);

        let game = &mut ctx.accounts.game;

        if revealer == game.player_a {
            require!(game.choice_a.is_none(), ArciumMxeError::AlreadyRevealed);
            require!(
                computed_hash.to_bytes() == game.commitment_a,
                ArciumMxeError::InvalidCommitment
            );
            game.choice_a = Some(choice);
            game.nonce_a = Some(nonce);
            msg!("Player A revealed choice: {}", choice);
        } else if Some(revealer) == game.player_b {
            require!(game.choice_b.is_none(), ArciumMxeError::AlreadyRevealed);
            require!(
                Some(computed_hash.to_bytes()) == game.commitment_b,
                ArciumMxeError::InvalidCommitment
            );
            game.choice_b = Some(choice);
            game.nonce_b = Some(nonce);
            msg!("Player B revealed choice: {}", choice);
        } else {
            return Err(ArciumMxeError::NotParticipant.into());
        }

        // Check if both have revealed
        if game.choice_a.is_some() && game.choice_b.is_some() {
            // Compute winner
            game.winner = game.compute_winner();
            game.state = GameState::Completed;
            msg!("Coinflip game completed! Winner: {:?}", game.winner);
        }

        Ok(())
    }

    /// Winner claims the pot
    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        let claimer = ctx.accounts.claimer.key();

        // Validate game is completed
        require!(
            ctx.accounts.game.is_completed(),
            ArciumMxeError::InvalidGameState
        );

        // Validate claimer is winner
        require!(
            ctx.accounts.game.winner == Some(claimer),
            ArciumMxeError::NotGameWinner
        );

        // Validate not already claimed
        require!(!ctx.accounts.game.claimed, ArciumMxeError::AlreadyClaimed);

        // Calculate total pot (2x wager)
        let total_pot = ctx
            .accounts
            .game
            .wager
            .checked_mul(2)
            .ok_or(ArciumMxeError::Overflow)?;

        // Get account infos
        let game_info = ctx.accounts.game.to_account_info();
        let claimer_info = ctx.accounts.claimer.to_account_info();

        // Transfer winnings to winner
        **game_info.try_borrow_mut_lamports()? -= total_pot;
        **claimer_info.try_borrow_mut_lamports()? += total_pot;

        let game = &mut ctx.accounts.game;
        game.claimed = true;

        msg!("Coinflip winnings claimed: {} lamports", total_pot);

        Ok(())
    }

    /// Cancel a coinflip game (only creator, only if no one joined)
    pub fn cancel_game(ctx: Context<CancelGame>) -> Result<()> {
        // Validate caller is creator
        require!(
            ctx.accounts.game.player_a == ctx.accounts.creator.key(),
            ArciumMxeError::NotGameCreator
        );

        // Validate no one has joined
        require!(
            ctx.accounts.game.is_waiting_for_player(),
            ArciumMxeError::GameAlreadyStarted
        );

        // Get wager amount before mutable operations
        let wager = ctx.accounts.game.wager;

        // Get account infos
        let game_info = ctx.accounts.game.to_account_info();
        let creator_info = ctx.accounts.creator.to_account_info();

        // Refund wager to creator
        **game_info.try_borrow_mut_lamports()? -= wager;
        **creator_info.try_borrow_mut_lamports()? += wager;

        let game = &mut ctx.accounts.game;
        game.state = GameState::Cancelled;

        msg!("Coinflip game cancelled, wager refunded");

        Ok(())
    }

    // ========================================================================
    // TIC TAC TOE GAME INSTRUCTIONS
    // ========================================================================

    /// Create a new Tic Tac Toe game
    pub fn create_ttt_game(
        ctx: Context<CreateTttGame>,
        wager: u64,
        nonce: u64,
    ) -> Result<()> {
        // Silence unused warning
        let _ = nonce;

        // Validate wager
        require!(wager >= MIN_WAGER, ArciumMxeError::InvalidWager);

        let clock = Clock::get()?;

        // Transfer wager to game escrow
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.player_x.to_account_info(),
                    to: ctx.accounts.game.to_account_info(),
                },
            ),
            wager,
        )?;

        let game = &mut ctx.accounts.game;
        game.channel = ctx.accounts.channel.key();
        game.player_x = ctx.accounts.player_x.key();
        game.player_o = None;
        game.wager = wager;
        game.board = [0; 9];
        game.move_count = 0;
        game.winner = None;
        game.state = TicTacToeState::WaitingForPlayer;
        game.created_at = clock.unix_timestamp;
        game.claimed = false;
        game.bump = ctx.bumps.game;

        msg!("Tic Tac Toe game created, wager: {} lamports", wager);

        Ok(())
    }

    /// Join an existing Tic Tac Toe game
    pub fn join_ttt_game(ctx: Context<JoinTttGame>) -> Result<()> {
        // Validate game state
        require!(
            ctx.accounts.game.is_waiting_for_player(),
            ArciumMxeError::InvalidGameState
        );

        // Cannot join own game
        require!(
            ctx.accounts.game.player_x != ctx.accounts.player_o.key(),
            ArciumMxeError::CannotJoinOwnGame
        );

        // Get wager before mutable borrow
        let wager = ctx.accounts.game.wager;

        // Transfer matching wager
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.player_o.to_account_info(),
                    to: ctx.accounts.game.to_account_info(),
                },
            ),
            wager,
        )?;

        let game = &mut ctx.accounts.game;
        game.player_o = Some(ctx.accounts.player_o.key());
        game.state = TicTacToeState::PlayerXTurn;

        msg!("Player O joined the Tic Tac Toe game");

        Ok(())
    }

    /// Make a move in Tic Tac Toe
    pub fn make_move(ctx: Context<MakeMove>, position: u8) -> Result<()> {
        let player = ctx.accounts.player.key();

        // Validate game is in progress
        require!(
            ctx.accounts.game.is_in_progress(),
            ArciumMxeError::GameNotInProgress
        );

        // Validate it's the player's turn
        require!(
            ctx.accounts.game.is_players_turn(&player),
            ArciumMxeError::NotYourTurn
        );

        // Validate position
        require!(position < 9, ArciumMxeError::InvalidPosition);

        // Validate position is empty
        require!(
            ctx.accounts.game.is_valid_move(position),
            ArciumMxeError::PositionOccupied
        );

        let game = &mut ctx.accounts.game;

        // Place the marker
        let marker = game.current_marker();
        game.board[position as usize] = marker;
        game.move_count += 1;

        msg!(
            "Move made: {} at position {} (move #{})",
            if marker == 1 { "X" } else { "O" },
            position,
            game.move_count
        );

        // Check for winner
        if let Some(winner_marker) = game.check_winner() {
            if winner_marker == 1 {
                game.winner = Some(game.player_x);
                game.state = TicTacToeState::XWins;
                msg!("Player X wins!");
            } else {
                game.winner = game.player_o;
                game.state = TicTacToeState::OWins;
                msg!("Player O wins!");
            }
        } else if game.is_board_full() {
            // Draw
            game.state = TicTacToeState::Draw;
            msg!("Game ended in a draw!");
        } else {
            // Switch turns
            game.state = if game.state == TicTacToeState::PlayerXTurn {
                TicTacToeState::PlayerOTurn
            } else {
                TicTacToeState::PlayerXTurn
            };
        }

        Ok(())
    }

    /// Claim Tic Tac Toe winnings (winner takes all, or both get refund on draw)
    pub fn claim_ttt_winnings(ctx: Context<ClaimTttWinnings>) -> Result<()> {
        let claimer = ctx.accounts.claimer.key();

        // Validate game has finished
        require!(
            ctx.accounts.game.is_finished(),
            ArciumMxeError::GameNotFinished
        );

        // Validate not already claimed
        require!(!ctx.accounts.game.claimed, ArciumMxeError::AlreadyClaimed);

        // Validate claimer is a player
        let is_player_x = claimer == ctx.accounts.game.player_x;
        let is_player_o = ctx.accounts.game.player_o == Some(claimer);
        require!(is_player_x || is_player_o, ArciumMxeError::NotPlayer);

        let game_info = ctx.accounts.game.to_account_info();
        let claimer_info = ctx.accounts.claimer.to_account_info();

        let wager = ctx.accounts.game.wager;
        let state = ctx.accounts.game.state;

        match state {
            TicTacToeState::XWins => {
                require!(is_player_x, ArciumMxeError::NotGameWinner);
                // Winner takes all (2x wager)
                let total_pot = wager.checked_mul(2).ok_or(ArciumMxeError::Overflow)?;
                **game_info.try_borrow_mut_lamports()? -= total_pot;
                **claimer_info.try_borrow_mut_lamports()? += total_pot;
                msg!("Player X claimed winnings: {} lamports", total_pot);
            }
            TicTacToeState::OWins => {
                require!(is_player_o, ArciumMxeError::NotGameWinner);
                // Winner takes all (2x wager)
                let total_pot = wager.checked_mul(2).ok_or(ArciumMxeError::Overflow)?;
                **game_info.try_borrow_mut_lamports()? -= total_pot;
                **claimer_info.try_borrow_mut_lamports()? += total_pot;
                msg!("Player O claimed winnings: {} lamports", total_pot);
            }
            TicTacToeState::Draw => {
                // Refund each player their wager
                **game_info.try_borrow_mut_lamports()? -= wager;
                **claimer_info.try_borrow_mut_lamports()? += wager;
                msg!("Draw - {} lamports refunded to claimer", wager);
            }
            _ => return Err(ArciumMxeError::GameNotFinished.into()),
        }

        // Mark as claimed only for win scenarios
        // For draw, we need to let both players claim
        if state != TicTacToeState::Draw {
            let game = &mut ctx.accounts.game;
            game.claimed = true;
        } else {
            // For draw, check if this was the second claim
            let game = &mut ctx.accounts.game;
            let game_lamports = game_info.lamports();
            // If there's less than one wager left, mark as fully claimed
            if game_lamports < wager {
                game.claimed = true;
            }
        }

        Ok(())
    }

    /// Cancel a Tic Tac Toe game (only creator, only if no one joined)
    pub fn cancel_ttt_game(ctx: Context<CancelTttGame>) -> Result<()> {
        // Validate caller is creator
        require!(
            ctx.accounts.game.player_x == ctx.accounts.creator.key(),
            ArciumMxeError::NotGameCreator
        );

        // Validate no one has joined
        require!(
            ctx.accounts.game.is_waiting_for_player(),
            ArciumMxeError::GameAlreadyStarted
        );

        // Get wager amount before mutable operations
        let wager = ctx.accounts.game.wager;

        // Get account infos
        let game_info = ctx.accounts.game.to_account_info();
        let creator_info = ctx.accounts.creator.to_account_info();

        // Refund wager to creator
        **game_info.try_borrow_mut_lamports()? -= wager;
        **creator_info.try_borrow_mut_lamports()? += wager;

        let game = &mut ctx.accounts.game;
        game.state = TicTacToeState::Cancelled;

        msg!("Tic Tac Toe game cancelled, wager refunded");

        Ok(())
    }
}

// ============================================================================
// COINFLIP GAME ACCOUNT CONTEXTS
// ============================================================================

#[derive(Accounts)]
#[instruction(wager: u64, commitment: [u8; 32], nonce: u64)]
pub struct CreateGame<'info> {
    #[account(mut)]
    pub player_a: Signer<'info>,

    /// CHECK: Channel PDA
    pub channel: UncheckedAccount<'info>,

    #[account(
        init,
        payer = player_a,
        space = CoinflipGame::SPACE,
        seeds = [
            b"coinflip",
            channel.key().as_ref(),
            player_a.key().as_ref(),
            &nonce.to_le_bytes()
        ],
        bump
    )]
    pub game: Account<'info, CoinflipGame>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinGame<'info> {
    #[account(mut)]
    pub player_b: Signer<'info>,

    #[account(mut)]
    pub game: Account<'info, CoinflipGame>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevealChoice<'info> {
    #[account(mut)]
    pub revealer: Signer<'info>,

    #[account(mut)]
    pub game: Account<'info, CoinflipGame>,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub claimer: Signer<'info>,

    #[account(mut)]
    pub game: Account<'info, CoinflipGame>,
}

#[derive(Accounts)]
pub struct CancelGame<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(mut)]
    pub game: Account<'info, CoinflipGame>,
}

// ============================================================================
// TIC TAC TOE GAME ACCOUNT CONTEXTS
// ============================================================================

#[derive(Accounts)]
#[instruction(wager: u64, nonce: u64)]
pub struct CreateTttGame<'info> {
    #[account(mut)]
    pub player_x: Signer<'info>,

    /// CHECK: Channel PDA
    pub channel: UncheckedAccount<'info>,

    #[account(
        init,
        payer = player_x,
        space = TicTacToeGame::SPACE,
        seeds = [
            b"tictactoe",
            channel.key().as_ref(),
            player_x.key().as_ref(),
            &nonce.to_le_bytes()
        ],
        bump
    )]
    pub game: Account<'info, TicTacToeGame>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinTttGame<'info> {
    #[account(mut)]
    pub player_o: Signer<'info>,

    #[account(mut)]
    pub game: Account<'info, TicTacToeGame>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MakeMove<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(mut)]
    pub game: Account<'info, TicTacToeGame>,
}

#[derive(Accounts)]
pub struct ClaimTttWinnings<'info> {
    #[account(mut)]
    pub claimer: Signer<'info>,

    #[account(mut)]
    pub game: Account<'info, TicTacToeGame>,
}

#[derive(Accounts)]
pub struct CancelTttGame<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(mut)]
    pub game: Account<'info, TicTacToeGame>,
}

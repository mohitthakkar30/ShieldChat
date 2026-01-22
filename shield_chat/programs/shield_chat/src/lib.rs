use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Mint, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("FVViRGPShMjCeSF3LDrp2qDjp6anRz9WAMiJrsGCRUzN");

// ==================== CONSTANTS ====================
pub const CHANNEL_SEED: &[u8] = b"channel";
pub const MEMBER_SEED: &[u8] = b"member";
pub const VAULT_SEED: &[u8] = b"vault";
pub const VAULT_AUTH_SEED: &[u8] = b"vault_auth";
pub const STAKE_SEED: &[u8] = b"stake";
pub const MAX_METADATA_SIZE: usize = 512;
pub const MAX_MEMBERS: u16 = 100;

// ==================== PROGRAM ====================
#[program]
pub mod shield_chat {
    use super::*;

    /// Create a new encrypted channel
    /// Metadata is encrypted via Arcium client-side
    pub fn create_channel(
        ctx: Context<CreateChannel>,
        channel_id: u64,
        encrypted_metadata: Vec<u8>,
        channel_type: ChannelType,
    ) -> Result<()> {
        require!(
            encrypted_metadata.len() <= MAX_METADATA_SIZE,
            ErrorCode::MetadataTooLarge
        );

        let channel = &mut ctx.accounts.channel;
        let clock = Clock::get()?;

        channel.channel_id = channel_id;
        channel.owner = ctx.accounts.owner.key();
        channel.encrypted_metadata = encrypted_metadata;
        channel.channel_type = channel_type;
        channel.member_count = 1; // Owner is first member
        channel.message_count = 0;
        channel.created_at = clock.unix_timestamp;
        channel.is_active = true;
        channel.bump = ctx.bumps.channel;

        msg!("Channel created: ID {}", channel_id);
        msg!("Owner: {}", channel.owner);
        msg!("Type: {:?}", channel.channel_type);

        Ok(())
    }

    /// Create a channel and automatically join the creator as the first member
    /// This combines create_channel + join_channel into a single atomic instruction
    /// Eliminates the need for two separate wallet signatures
    pub fn create_channel_and_join(
        ctx: Context<CreateChannelAndJoin>,
        channel_id: u64,
        encrypted_metadata: Vec<u8>,
        channel_type: ChannelType,
    ) -> Result<()> {
        require!(
            encrypted_metadata.len() <= MAX_METADATA_SIZE,
            ErrorCode::MetadataTooLarge
        );

        let clock = Clock::get()?;
        let channel = &mut ctx.accounts.channel;
        let member = &mut ctx.accounts.member;

        // Initialize channel
        channel.channel_id = channel_id;
        channel.owner = ctx.accounts.creator.key();
        channel.encrypted_metadata = encrypted_metadata;
        channel.channel_type = channel_type;
        channel.member_count = 1; // Creator is first member
        channel.message_count = 0;
        channel.created_at = clock.unix_timestamp;
        channel.is_active = true;
        channel.required_token_mint = None;
        channel.min_token_amount = None;
        channel.bump = ctx.bumps.channel;

        // Initialize member (creator auto-joins)
        member.channel = channel.key();
        member.wallet = ctx.accounts.creator.key();
        member.joined_at = clock.unix_timestamp;
        member.is_active = true;
        member.bump = ctx.bumps.member;

        msg!("Channel created and joined: ID {}", channel_id);
        msg!("Creator: {}", channel.owner);
        msg!("Type: {:?}", channel.channel_type);

        Ok(())
    }

    /// Add member to channel with optional token-gating and staking
    /// If channel has token requirements, tokens are transferred to vault and locked
    pub fn join_channel(
        ctx: Context<JoinChannel>,
    ) -> Result<()> {
        let channel = &mut ctx.accounts.channel;
        let member_account = &mut ctx.accounts.member;

        require!(channel.is_active, ErrorCode::ChannelInactive);
        require!(
            channel.member_count < MAX_MEMBERS,
            ErrorCode::ChannelFull
        );

        // Token-gating with staking (if channel requires it)
        if let (Some(required_mint), Some(min_amount)) =
            (channel.required_token_mint, channel.min_token_amount)
        {
            // Token account is required for token-gated channels
            let user_token_account = ctx.accounts.user_token_account
                .as_ref()
                .ok_or(ErrorCode::TokenAccountRequired)?;

            // Verify token account belongs to the joining wallet
            require!(
                user_token_account.owner == ctx.accounts.member_wallet.key(),
                ErrorCode::TokenAccountOwnerMismatch
            );

            // Verify token account is for the correct mint
            require!(
                user_token_account.mint == required_mint,
                ErrorCode::TokenMintMismatch
            );

            // Verify sufficient balance
            require!(
                user_token_account.amount >= min_amount,
                ErrorCode::InsufficientTokens
            );

            // Get vault and stake accounts for token transfer
            let vault_token_account = ctx.accounts.vault_token_account
                .as_ref()
                .ok_or(ErrorCode::TokenAccountRequired)?;
            let vault = ctx.accounts.token_vault
                .as_mut()
                .ok_or(ErrorCode::TokenAccountRequired)?;
            let stake = ctx.accounts.member_stake
                .as_mut()
                .ok_or(ErrorCode::TokenAccountRequired)?;
            let token_program = ctx.accounts.token_program
                .as_ref()
                .ok_or(ErrorCode::TokenAccountRequired)?;

            // Transfer tokens from user to vault (user signs, so no PDA signer needed)
            let transfer_ctx = CpiContext::new(
                token_program.to_account_info(),
                Transfer {
                    from: user_token_account.to_account_info(),
                    to: vault_token_account.to_account_info(),
                    authority: ctx.accounts.member_wallet.to_account_info(),
                },
            );
            transfer(transfer_ctx, min_amount)?;

            // Update vault state
            vault.total_locked = vault.total_locked
                .checked_add(min_amount)
                .ok_or(ErrorCode::Overflow)?;

            // Initialize stake record
            stake.member = ctx.accounts.member_wallet.key();
            stake.channel = channel.key();
            stake.locked_amount = min_amount;
            stake.lock_timestamp = Clock::get()?.unix_timestamp;
            stake.bump = ctx.bumps.member_stake.unwrap();

            msg!("Staked {} tokens to vault", min_amount);
        }

        let clock = Clock::get()?;

        member_account.channel = channel.key();
        member_account.wallet = ctx.accounts.member_wallet.key();
        member_account.joined_at = clock.unix_timestamp;
        member_account.is_active = true;
        member_account.bump = ctx.bumps.member;

        channel.member_count += 1;

        msg!("Member joined: {}", member_account.wallet);
        msg!("Total members: {}", channel.member_count);

        Ok(())
    }

    /// Log message hash on-chain (actual message stored off-chain)
    /// This provides proof of message without revealing content
    pub fn log_message(
        ctx: Context<LogMessage>,
        message_hash: [u8; 32],
        encrypted_ipfs_cid: Vec<u8>, // Encrypted IPFS CID
    ) -> Result<()> {
        let channel = &mut ctx.accounts.channel;
        let clock = Clock::get()?;

        require!(channel.is_active, ErrorCode::ChannelInactive);

        // Verify sender is channel member
        let member = &ctx.accounts.member;
        require!(member.is_active, ErrorCode::MemberNotActive);
        require!(
            member.channel == channel.key(),
            ErrorCode::NotChannelMember
        );

        channel.message_count += 1;

        // Emit event for Helius monitoring
        emit!(MessageLogged {
            channel: channel.key(),
            sender: ctx.accounts.sender.key(),
            message_hash,
            encrypted_ipfs_cid,
            message_number: channel.message_count,
            timestamp: clock.unix_timestamp,
        });

        msg!("Message logged: #{}", channel.message_count);

        Ok(())
    }

    /// Update channel settings (owner only)
    pub fn update_channel(
        ctx: Context<UpdateChannel>,
        new_encrypted_metadata: Option<Vec<u8>>,
        new_is_active: Option<bool>,
    ) -> Result<()> {
        let channel = &mut ctx.accounts.channel;

        if let Some(metadata) = new_encrypted_metadata {
            require!(
                metadata.len() <= MAX_METADATA_SIZE,
                ErrorCode::MetadataTooLarge
            );
            channel.encrypted_metadata = metadata;
        }

        if let Some(is_active) = new_is_active {
            channel.is_active = is_active;
        }

        msg!("Channel updated: {}", channel.channel_id);

        Ok(())
    }

    /// Leave channel (member removes themselves)
    /// Returns staked tokens if this was a token-gated channel
    pub fn leave_channel(
        ctx: Context<LeaveChannel>,
    ) -> Result<()> {
        let channel = &mut ctx.accounts.channel;
        let member = &mut ctx.accounts.member;

        member.is_active = false;
        channel.member_count = channel.member_count.saturating_sub(1);

        // Return staked tokens if this was a token-gated channel with staking
        if let Some(stake) = ctx.accounts.member_stake.as_mut() {
            if stake.locked_amount > 0 {
                let vault = ctx.accounts.token_vault
                    .as_mut()
                    .ok_or(ErrorCode::TokenAccountRequired)?;
                let vault_token_account = ctx.accounts.vault_token_account
                    .as_ref()
                    .ok_or(ErrorCode::TokenAccountRequired)?;
                let user_token_account = ctx.accounts.user_token_account
                    .as_ref()
                    .ok_or(ErrorCode::TokenAccountRequired)?;
                let vault_authority = ctx.accounts.vault_authority
                    .as_ref()
                    .ok_or(ErrorCode::TokenAccountRequired)?;
                let token_program = ctx.accounts.token_program
                    .as_ref()
                    .ok_or(ErrorCode::TokenAccountRequired)?;

                let locked_amount = stake.locked_amount;

                // PDA signer seeds for vault authority
                let channel_key = channel.key();
                let mint_key = vault.token_mint;
                let seeds = &[
                    VAULT_AUTH_SEED,
                    channel_key.as_ref(),
                    mint_key.as_ref(),
                    &[vault.auth_bump],
                ];
                let signer_seeds = &[&seeds[..]];

                // Transfer tokens back to user (vault authority signs as PDA)
                let transfer_ctx = CpiContext::new_with_signer(
                    token_program.to_account_info(),
                    Transfer {
                        from: vault_token_account.to_account_info(),
                        to: user_token_account.to_account_info(),
                        authority: vault_authority.to_account_info(),
                    },
                    signer_seeds,
                );
                transfer(transfer_ctx, locked_amount)?;

                // Update vault state
                vault.total_locked = vault.total_locked.saturating_sub(locked_amount);

                // Clear stake record
                stake.locked_amount = 0;

                msg!("Returned {} tokens to member", locked_amount);
            }
        }

        msg!("Member left: {}", member.wallet);
        msg!("Remaining members: {}", channel.member_count);

        Ok(())
    }

    /// Rejoin a channel that was previously left
    /// Reactivates an existing inactive member account
    /// For token-gated channels, requires staking tokens again
    pub fn rejoin_channel(ctx: Context<RejoinChannel>) -> Result<()> {
        let channel = &mut ctx.accounts.channel;
        let member = &mut ctx.accounts.member;

        require!(channel.is_active, ErrorCode::ChannelInactive);
        require!(!member.is_active, ErrorCode::MemberAlreadyActive);
        require!(
            channel.member_count < MAX_MEMBERS,
            ErrorCode::ChannelFull
        );

        // Token-gating with staking (if channel requires it)
        if let (Some(required_mint), Some(min_amount)) =
            (channel.required_token_mint, channel.min_token_amount)
        {
            // Token account is required for token-gated channels
            let user_token_account = ctx.accounts.user_token_account
                .as_ref()
                .ok_or(ErrorCode::TokenAccountRequired)?;

            // Verify token account belongs to the joining wallet
            require!(
                user_token_account.owner == ctx.accounts.member_wallet.key(),
                ErrorCode::TokenAccountOwnerMismatch
            );

            // Verify token account is for the correct mint
            require!(
                user_token_account.mint == required_mint,
                ErrorCode::TokenMintMismatch
            );

            // Verify sufficient balance
            require!(
                user_token_account.amount >= min_amount,
                ErrorCode::InsufficientTokens
            );

            // Get vault and stake accounts for token transfer
            let vault_token_account = ctx.accounts.vault_token_account
                .as_ref()
                .ok_or(ErrorCode::TokenAccountRequired)?;
            let vault = ctx.accounts.token_vault
                .as_mut()
                .ok_or(ErrorCode::TokenAccountRequired)?;
            let stake = ctx.accounts.member_stake
                .as_mut()
                .ok_or(ErrorCode::TokenAccountRequired)?;
            let token_program = ctx.accounts.token_program
                .as_ref()
                .ok_or(ErrorCode::TokenAccountRequired)?;

            // Transfer tokens from user to vault
            let transfer_ctx = CpiContext::new(
                token_program.to_account_info(),
                Transfer {
                    from: user_token_account.to_account_info(),
                    to: vault_token_account.to_account_info(),
                    authority: ctx.accounts.member_wallet.to_account_info(),
                },
            );
            transfer(transfer_ctx, min_amount)?;

            // Update vault state
            vault.total_locked = vault.total_locked
                .checked_add(min_amount)
                .ok_or(ErrorCode::Overflow)?;

            // Update stake record (reuse existing account)
            stake.locked_amount = min_amount;
            stake.lock_timestamp = Clock::get()?.unix_timestamp;

            msg!("Staked {} tokens to vault for rejoin", min_amount);
        }

        let clock = Clock::get()?;

        // Reactivate member
        member.is_active = true;
        member.joined_at = clock.unix_timestamp;

        channel.member_count += 1;

        msg!("Member rejoined: {}", member.wallet);
        msg!("Total members: {}", channel.member_count);

        Ok(())
    }

    /// Set token-gating requirements (owner only)
    pub fn set_token_gate(
        ctx: Context<SetTokenGate>,
        required_token_mint: Pubkey,
        min_token_amount: u64,
    ) -> Result<()> {
        let channel = &mut ctx.accounts.channel;

        channel.required_token_mint = Some(required_token_mint);
        channel.min_token_amount = Some(min_token_amount);

        msg!("Token gate set: {} tokens required", min_token_amount);
        msg!("Token mint: {}", required_token_mint);

        Ok(())
    }

    /// Initialize token vault for staking (owner only, after set_token_gate)
    /// Creates a vault PDA and associated token account to hold staked tokens
    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        let channel = &ctx.accounts.channel;
        let vault = &mut ctx.accounts.token_vault;

        require!(
            channel.required_token_mint.is_some(),
            ErrorCode::NotTokenGatedChannel
        );

        vault.channel = channel.key();
        vault.token_mint = channel.required_token_mint.unwrap();
        vault.total_locked = 0;
        vault.bump = ctx.bumps.token_vault;
        vault.auth_bump = ctx.bumps.vault_authority;

        msg!("Token vault initialized for channel: {}", channel.key());
        msg!("Vault token account: {}", ctx.accounts.vault_token_account.key());

        Ok(())
    }
}

// ==================== ACCOUNTS ====================

#[derive(Accounts)]
#[instruction(channel_id: u64)]
pub struct CreateChannel<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + Channel::LEN,
        seeds = [CHANNEL_SEED, owner.key().as_ref(), channel_id.to_le_bytes().as_ref()],
        bump
    )]
    pub channel: Account<'info, Channel>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(channel_id: u64)]
pub struct CreateChannelAndJoin<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + Channel::LEN,
        seeds = [CHANNEL_SEED, creator.key().as_ref(), channel_id.to_le_bytes().as_ref()],
        bump
    )]
    pub channel: Account<'info, Channel>,

    #[account(
        init,
        payer = creator,
        space = 8 + Member::LEN,
        seeds = [MEMBER_SEED, channel.key().as_ref(), creator.key().as_ref()],
        bump
    )]
    pub member: Account<'info, Member>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinChannel<'info> {
    #[account(mut)]
    pub channel: Account<'info, Channel>,

    #[account(
        init,
        payer = member_wallet,
        space = 8 + Member::LEN,
        seeds = [MEMBER_SEED, channel.key().as_ref(), member_wallet.key().as_ref()],
        bump
    )]
    pub member: Account<'info, Member>,

    #[account(mut)]
    pub member_wallet: Signer<'info>,

    /// User's token account (required for token-gated channels)
    #[account(mut)]
    pub user_token_account: Option<Account<'info, TokenAccount>>,

    /// Token vault account (required for token-gated channels)
    #[account(
        mut,
        seeds = [VAULT_SEED, channel.key().as_ref()],
        bump = token_vault.bump
    )]
    pub token_vault: Option<Account<'info, TokenVault>>,

    /// Vault's token account to receive staked tokens
    #[account(mut)]
    pub vault_token_account: Option<Account<'info, TokenAccount>>,

    /// Member stake record (created for token-gated channels)
    #[account(
        init,
        payer = member_wallet,
        space = 8 + MemberStake::LEN,
        seeds = [STAKE_SEED, channel.key().as_ref(), member_wallet.key().as_ref()],
        bump
    )]
    pub member_stake: Option<Account<'info, MemberStake>>,

    /// SPL Token program (required for token-gated channels)
    pub token_program: Option<Program<'info, Token>>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LogMessage<'info> {
    #[account(mut)]
    pub channel: Account<'info, Channel>,

    #[account(
        constraint = member.channel == channel.key() @ ErrorCode::NotChannelMember,
        constraint = member.wallet == sender.key() @ ErrorCode::UnauthorizedSender
    )]
    pub member: Account<'info, Member>,

    pub sender: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateChannel<'info> {
    #[account(
        mut,
        constraint = channel.owner == owner.key() @ ErrorCode::NotChannelOwner
    )]
    pub channel: Account<'info, Channel>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct LeaveChannel<'info> {
    #[account(mut)]
    pub channel: Account<'info, Channel>,

    #[account(
        mut,
        constraint = member.wallet == member_wallet.key() @ ErrorCode::UnauthorizedSender
    )]
    pub member: Account<'info, Member>,

    pub member_wallet: Signer<'info>,

    /// Token vault account (for returning staked tokens)
    #[account(mut)]
    pub token_vault: Option<Account<'info, TokenVault>>,

    /// CHECK: PDA authority for vault token transfers
    pub vault_authority: Option<UncheckedAccount<'info>>,

    /// Vault's token account (source of returned tokens)
    #[account(mut)]
    pub vault_token_account: Option<Account<'info, TokenAccount>>,

    /// User's token account (destination for returned tokens)
    #[account(mut)]
    pub user_token_account: Option<Account<'info, TokenAccount>>,

    /// Member stake record
    #[account(
        mut,
        seeds = [STAKE_SEED, channel.key().as_ref(), member_wallet.key().as_ref()],
        bump = member_stake.bump
    )]
    pub member_stake: Option<Account<'info, MemberStake>>,

    /// SPL Token program
    pub token_program: Option<Program<'info, Token>>,
}

#[derive(Accounts)]
pub struct RejoinChannel<'info> {
    #[account(mut)]
    pub channel: Account<'info, Channel>,

    #[account(
        mut,
        seeds = [MEMBER_SEED, channel.key().as_ref(), member_wallet.key().as_ref()],
        bump = member.bump,
        constraint = member.wallet == member_wallet.key() @ ErrorCode::UnauthorizedSender
    )]
    pub member: Account<'info, Member>,

    #[account(mut)]
    pub member_wallet: Signer<'info>,

    /// User's token account (required for token-gated channels)
    #[account(mut)]
    pub user_token_account: Option<Account<'info, TokenAccount>>,

    /// Token vault account (required for token-gated channels)
    #[account(
        mut,
        seeds = [VAULT_SEED, channel.key().as_ref()],
        bump = token_vault.bump
    )]
    pub token_vault: Option<Account<'info, TokenVault>>,

    /// Vault's token account to receive staked tokens
    #[account(mut)]
    pub vault_token_account: Option<Account<'info, TokenAccount>>,

    /// Member stake record (already exists from previous join)
    #[account(
        mut,
        seeds = [STAKE_SEED, channel.key().as_ref(), member_wallet.key().as_ref()],
        bump = member_stake.bump
    )]
    pub member_stake: Option<Account<'info, MemberStake>>,

    /// SPL Token program (required for token-gated channels)
    pub token_program: Option<Program<'info, Token>>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetTokenGate<'info> {
    #[account(
        mut,
        constraint = channel.owner == owner.key() @ ErrorCode::NotChannelOwner
    )]
    pub channel: Account<'info, Channel>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        constraint = channel.required_token_mint.is_some() @ ErrorCode::NotTokenGatedChannel,
        constraint = channel.owner == owner.key() @ ErrorCode::NotChannelOwner
    )]
    pub channel: Account<'info, Channel>,

    #[account(
        init,
        payer = owner,
        space = 8 + TokenVault::LEN,
        seeds = [VAULT_SEED, channel.key().as_ref()],
        bump
    )]
    pub token_vault: Account<'info, TokenVault>,

    /// CHECK: PDA authority for vault token account
    #[account(
        seeds = [VAULT_AUTH_SEED, channel.key().as_ref(), channel.required_token_mint.unwrap().as_ref()],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = owner,
        associated_token::mint = token_mint,
        associated_token::authority = vault_authority,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_mint: Account<'info, Mint>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

// ==================== STATE ====================

#[account]
pub struct Channel {
    pub channel_id: u64,                    // 8
    pub owner: Pubkey,                      // 32
    pub encrypted_metadata: Vec<u8>,        // 4 + MAX_METADATA_SIZE (512)
    pub channel_type: ChannelType,          // 1
    pub member_count: u16,                  // 2
    pub message_count: u64,                 // 8
    pub created_at: i64,                    // 8
    pub is_active: bool,                    // 1
    pub required_token_mint: Option<Pubkey>, // 33 (1 + 32)
    pub min_token_amount: Option<u64>,      // 9 (1 + 8)
    pub bump: u8,                           // 1
}

impl Channel {
    pub const LEN: usize = 8 + 32 + (4 + MAX_METADATA_SIZE) + 1 + 2 + 8 + 8 + 1 + 33 + 9 + 1;
}

#[account]
pub struct Member {
    pub channel: Pubkey,        // 32
    pub wallet: Pubkey,         // 32
    pub joined_at: i64,         // 8
    pub is_active: bool,        // 1
    pub bump: u8,               // 1
}

impl Member {
    pub const LEN: usize = 32 + 32 + 8 + 1 + 1;
}

#[account]
pub struct TokenVault {
    pub channel: Pubkey,           // 32
    pub token_mint: Pubkey,        // 32
    pub total_locked: u64,         // 8
    pub bump: u8,                  // 1
    pub auth_bump: u8,             // 1
}

impl TokenVault {
    pub const LEN: usize = 32 + 32 + 8 + 1 + 1;
}

#[account]
pub struct MemberStake {
    pub member: Pubkey,            // 32
    pub channel: Pubkey,           // 32
    pub locked_amount: u64,        // 8
    pub lock_timestamp: i64,       // 8
    pub bump: u8,                  // 1
}

impl MemberStake {
    pub const LEN: usize = 32 + 32 + 8 + 8 + 1;
}

// ==================== ENUMS ====================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum ChannelType {
    DirectMessage,      // 1-on-1 chat
    PrivateGroup,       // Invite-only group
    TokenGated,         // Requires token/NFT to join
    Public,             // Anyone can join
}

// ==================== EVENTS ====================

#[event]
pub struct MessageLogged {
    pub channel: Pubkey,
    pub sender: Pubkey,
    pub message_hash: [u8; 32],
    pub encrypted_ipfs_cid: Vec<u8>,
    pub message_number: u64,
    pub timestamp: i64,
}

// ==================== ERRORS ====================

#[error_code]
pub enum ErrorCode {
    #[msg("Metadata size exceeds maximum allowed")]
    MetadataTooLarge,

    #[msg("Channel has reached maximum member capacity")]
    ChannelFull,

    #[msg("Channel is not active")]
    ChannelInactive,

    #[msg("Insufficient token balance for channel access")]
    InsufficientTokens,

    #[msg("Sender is not a member of this channel")]
    NotChannelMember,

    #[msg("Member is not active")]
    MemberNotActive,

    #[msg("Member is already active in this channel")]
    MemberAlreadyActive,

    #[msg("Only channel owner can perform this action")]
    NotChannelOwner,

    #[msg("Unauthorized sender")]
    UnauthorizedSender,

    #[msg("Token account required for token-gated channel")]
    TokenAccountRequired,

    #[msg("Token account owner does not match wallet")]
    TokenAccountOwnerMismatch,

    #[msg("Token mint does not match channel requirement")]
    TokenMintMismatch,

    #[msg("Channel is not token-gated")]
    NotTokenGatedChannel,

    #[msg("Arithmetic overflow")]
    Overflow,
}

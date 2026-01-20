use anchor_lang::prelude::*;

declare_id!("FVViRGPShMjCeSF3LDrp2qDjp6anRz9WAMiJrsGCRUzN");

// ==================== CONSTANTS ====================
pub const CHANNEL_SEED: &[u8] = b"channel";
pub const MEMBER_SEED: &[u8] = b"member";
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

    /// Add member to channel with optional token-gating
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

        // Token-gating check (if required)
        // Note: For now, token-gating is handled at the application layer
        // In production, you would deserialize and validate the token_gate_account here

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
    pub fn leave_channel(
        ctx: Context<LeaveChannel>,
    ) -> Result<()> {
        let channel = &mut ctx.accounts.channel;
        let member = &mut ctx.accounts.member;

        member.is_active = false;
        channel.member_count = channel.member_count.saturating_sub(1);

        msg!("Member left: {}", member.wallet);
        msg!("Remaining members: {}", channel.member_count);

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

    #[msg("Only channel owner can perform this action")]
    NotChannelOwner,

    #[msg("Unauthorized sender")]
    UnauthorizedSender,
}

# ShieldChat Implementation Details

## Smart Contract Architecture

The ShieldChat smart contract is built using the Anchor framework on Solana, providing a type-safe and efficient implementation of private messaging infrastructure.

### Program Overview

**Program ID**: `FVViRGPShMjCeSF3LDrp2qDjp6anRz9WAMiJrsGCRUzN`
**Framework**: Anchor 0.32.1
**Language**: Rust (edition 2021)
**Network**: Solana Devnet

### Constants

```rust
pub const CHANNEL_SEED: &[u8] = b"channel";
pub const MEMBER_SEED: &[u8] = b"member";
pub const MAX_METADATA_SIZE: usize = 512;
pub const MAX_MEMBERS: u16 = 100;
```

**Design Rationale**:
- `CHANNEL_SEED` and `MEMBER_SEED`: Used for deterministic PDA derivation
- `MAX_METADATA_SIZE: 512 bytes`: Balances storage costs with sufficient space for encrypted metadata
- `MAX_MEMBERS: 100`: Prevents unbounded growth while supporting reasonable group sizes

## Account Structures

### Channel Account

The Channel account represents a communication channel with encrypted metadata and access controls.

```rust
#[account]
pub struct Channel {
    pub channel_id: u64,                    // 8 bytes
    pub owner: Pubkey,                      // 32 bytes
    pub encrypted_metadata: Vec<u8>,        // 4 + 512 bytes
    pub channel_type: ChannelType,          // 1 byte
    pub member_count: u16,                  // 2 bytes
    pub message_count: u64,                 // 8 bytes
    pub created_at: i64,                    // 8 bytes
    pub is_active: bool,                    // 1 byte
    pub required_token_mint: Option<Pubkey>, // 33 bytes (1 + 32)
    pub min_token_amount: Option<u64>,      // 9 bytes (1 + 8)
    pub bump: u8,                           // 1 byte
}

impl Channel {
    pub const LEN: usize = 8 + 32 + (4 + 512) + 1 + 2 + 8 + 8 + 1 + 33 + 9 + 1;
    // Total: 619 bytes
}
```

**PDA Derivation**:
```rust
seeds = [
    CHANNEL_SEED,              // "channel"
    owner.key().as_ref(),      // Channel owner's pubkey
    channel_id.to_le_bytes()   // Unique channel ID
]
```

**Field Descriptions**:
- `channel_id`: Unique 64-bit identifier, typically timestamp-based
- `owner`: Public key of channel creator with admin privileges
- `encrypted_metadata`: Stores encrypted channel name, description, and settings
- `channel_type`: Enum defining access control model
- `member_count`: Current number of active members
- `message_count`: Total messages logged in the channel
- `created_at`: Unix timestamp of channel creation
- `is_active`: Flag to soft-delete/archive channels
- `required_token_mint`: Optional SPL token mint for token-gating
- `min_token_amount`: Minimum token balance required to join
- `bump`: PDA bump seed for signing

### Member Account

The Member account represents a user's membership in a specific channel.

```rust
#[account]
pub struct Member {
    pub channel: Pubkey,        // 32 bytes
    pub wallet: Pubkey,         // 32 bytes
    pub joined_at: i64,         // 8 bytes
    pub is_active: bool,        // 1 byte
    pub bump: u8,               // 1 byte
}

impl Member {
    pub const LEN: usize = 32 + 32 + 8 + 1 + 1;
    // Total: 74 bytes
}
```

**PDA Derivation**:
```rust
seeds = [
    MEMBER_SEED,               // "member"
    channel.key().as_ref(),    // Parent channel pubkey
    member_wallet.key().as_ref() // Member's wallet pubkey
]
```

**Field Descriptions**:
- `channel`: Reference to parent Channel account
- `wallet`: Member's wallet public key
- `joined_at`: Unix timestamp when member joined
- `is_active`: Membership status (false = left/kicked)
- `bump`: PDA bump seed

## Enums

### ChannelType

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum ChannelType {
    DirectMessage,      // 1-on-1 private chat
    PrivateGroup,       // Invite-only group
    TokenGated,         // NFT/token holder exclusive
    Public,             // Open to all
}
```

**Access Control by Type**:
- `DirectMessage`: Only 2 members, both must be explicitly added
- `PrivateGroup`: Owner controls membership
- `TokenGated`: Requires token balance verification
- `Public`: Anyone can join (member_count < MAX_MEMBERS)

## Instructions

### 1. create_channel

Creates a new encrypted communication channel.

```rust
pub fn create_channel(
    ctx: Context<CreateChannel>,
    channel_id: u64,
    encrypted_metadata: Vec<u8>,
    channel_type: ChannelType,
) -> Result<()>
```

**Parameters**:
- `channel_id`: Unique identifier (recommended: timestamp)
- `encrypted_metadata`: Encrypted channel name/description (max 512 bytes)
- `channel_type`: Access control type

**Validation**:
- Metadata size must be ≤ MAX_METADATA_SIZE (512 bytes)
- Channel ID must be unique for the owner

**State Changes**:
- Initializes Channel account
- Sets `member_count = 1` (owner is implicit first member)
- Sets `message_count = 0`
- Records creation timestamp
- Sets `is_active = true`

**Example Call**:
```typescript
const channelId = new anchor.BN(Date.now());
const metadata = Buffer.from("encrypted_channel_name");

await program.methods
  .createChannel(channelId, metadata, { privateGroup: {} })
  .rpc();
```

### 2. join_channel

Adds a new member to a channel.

```rust
pub fn join_channel(
    ctx: Context<JoinChannel>,
) -> Result<()>
```

**Validation**:
- Channel must be active (`is_active = true`)
- Member count must be < MAX_MEMBERS (100)
- Member PDA must not already exist

**Token-Gating** (Application Layer):
- Currently validated off-chain
- Future enhancement: on-chain SPL token balance verification

**State Changes**:
- Initializes Member account
- Increments channel `member_count`
- Records join timestamp

**Example Call**:
```typescript
await program.methods
  .joinChannel()
  .accounts({
    channel: channelPda,
    memberWallet: newMember.publicKey,
  })
  .signers([newMember])
  .rpc();
```

### 3. log_message

Logs a message hash on-chain for proof of communication.

```rust
pub fn log_message(
    ctx: Context<LogMessage>,
    message_hash: [u8; 32],
    encrypted_ipfs_cid: Vec<u8>,
) -> Result<()>
```

**Parameters**:
- `message_hash`: SHA-256 hash of the encrypted message
- `encrypted_ipfs_cid`: Encrypted IPFS content identifier

**Validation**:
- Channel must be active
- Sender must be an active member
- Member must belong to the channel

**State Changes**:
- Increments channel `message_count`

**Event Emission**:
```rust
emit!(MessageLogged {
    channel: channel.key(),
    sender: sender.key(),
    message_hash,
    encrypted_ipfs_cid,
    message_number: channel.message_count,
    timestamp: clock.unix_timestamp,
});
```

**Example Call**:
```typescript
const messageHash = Array.from(Buffer.alloc(32, 1));
const encryptedCid = Buffer.from("Qm...encrypted_cid");

await program.methods
  .logMessage(messageHash, encryptedCid)
  .accounts({
    channel: channelPda,
    member: memberPda,
    sender: wallet.publicKey,
  })
  .rpc();
```

### 4. update_channel

Updates channel settings (owner only).

```rust
pub fn update_channel(
    ctx: Context<UpdateChannel>,
    new_encrypted_metadata: Option<Vec<u8>>,
    new_is_active: Option<bool>,
) -> Result<()>
```

**Parameters**:
- `new_encrypted_metadata`: Optional new encrypted metadata
- `new_is_active`: Optional active status

**Authorization**:
- Only channel owner can call
- Enforced via `constraint = channel.owner == owner.key()`

**State Changes**:
- Updates `encrypted_metadata` if provided
- Updates `is_active` if provided (soft delete/archive)

**Example Call**:
```typescript
const newMetadata = Buffer.from("new_encrypted_name");

await program.methods
  .updateChannel(newMetadata, null)
  .accounts({
    channel: channelPda,
    owner: ownerWallet.publicKey,
  })
  .rpc();
```

### 5. leave_channel

Allows a member to leave a channel.

```rust
pub fn leave_channel(
    ctx: Context<LeaveChannel>,
) -> Result<()>
```

**Authorization**:
- Only the member themselves can leave
- Enforced via `constraint = member.wallet == member_wallet.key()`

**State Changes**:
- Sets member `is_active = false`
- Decrements channel `member_count` (with saturation to prevent underflow)

**Example Call**:
```typescript
await program.methods
  .leaveChannel()
  .accounts({
    channel: channelPda,
    member: memberPda,
    memberWallet: wallet.publicKey,
  })
  .rpc();
```

### 6. set_token_gate

Configures token-gating requirements for a channel (owner only).

```rust
pub fn set_token_gate(
    ctx: Context<SetTokenGate>,
    required_token_mint: Pubkey,
    min_token_amount: u64,
) -> Result<()>
```

**Parameters**:
- `required_token_mint`: SPL token mint address
- `min_token_amount`: Minimum token balance required

**Authorization**:
- Only channel owner can call

**State Changes**:
- Sets `required_token_mint` to Some(mint)
- Sets `min_token_amount` to Some(amount)

**Example Call**:
```typescript
const tokenMint = new PublicKey("...");
const minAmount = new anchor.BN(100);

await program.methods
  .setTokenGate(tokenMint, minAmount)
  .accounts({
    channel: channelPda,
    owner: ownerWallet.publicKey,
  })
  .rpc();
```

## Events

### MessageLogged

Emitted when a message is logged on-chain.

```rust
#[event]
pub struct MessageLogged {
    pub channel: Pubkey,
    pub sender: Pubkey,
    pub message_hash: [u8; 32],
    pub encrypted_ipfs_cid: Vec<u8>,
    pub message_number: u64,
    pub timestamp: i64,
}
```

**Purpose**:
- Enables real-time monitoring via Helius webhooks
- Provides off-chain indexing for message history
- Includes all necessary data for notification systems

**Real-Time Monitoring** (Implemented):
```typescript
// Helius Enhanced WebSockets - transactionSubscribe
{
  "method": "transactionSubscribe",
  "params": [{
    "accountInclude": ["FVViRGPShMjCeSF3LDrp2qDjp6anRz9WAMiJrsGCRUzN"]
  }, {
    "commitment": "confirmed",
    "encoding": "jsonParsed",
    "transactionDetails": "full"
  }]
}

// Direct CID extraction from instruction data for instant display:
// - 8 bytes: Anchor discriminator (skip)
// - 32 bytes: message_hash (skip)
// - 4 bytes: Vec length prefix (little-endian)
// - N bytes: encrypted_ipfs_cid data
```

## Error Codes

```rust
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
```

## Security Considerations

### Access Control
1. **Owner Privileges**: Channel updates and token-gating restricted to owner
2. **Member Verification**: Message logging requires active membership
3. **PDA Security**: All accounts use PDAs to prevent unauthorized initialization

### Privacy
1. **No Plain Text**: All sensitive data encrypted client-side
2. **Minimal On-Chain Data**: Only hashes and encrypted CIDs stored
3. **Off-Chain Content**: Message content stored on IPFS

### Economic Security
1. **Storage Bounds**: MAX_METADATA_SIZE prevents excessive rent costs
2. **Member Limits**: MAX_MEMBERS prevents DoS via unbounded growth
3. **Saturation Math**: Uses `saturating_sub` to prevent underflow

### Future Enhancements
1. **On-Chain Token Verification**: Add SPL token account validation
2. **Role-Based Access**: Implement moderator/admin roles
3. **Rate Limiting**: Add message rate limits per member
4. **Encrypted Member Lists**: Hide membership information

## PDA Architecture

### Benefits
1. **Deterministic Addressing**: No need to store account keys
2. **Program Authority**: PDAs can sign transactions
3. **Collision Resistance**: Unique seeds prevent conflicts
4. **Gas Efficiency**: No rent for failed lookups

### Derivation Patterns

**Channel PDA**:
```
seeds: ["channel", owner_pubkey, channel_id_bytes]
→ Ensures unique channels per owner
→ Owner can create multiple channels
```

**Member PDA**:
```
seeds: ["member", channel_pubkey, wallet_pubkey]
→ One membership per channel per wallet
→ Prevents duplicate memberships
```

## Integration Guide

### Client-Side Workflow

1. **Create Channel**:
   ```typescript
   // 1. Encrypt metadata client-side
   const encryptedName = await encryptMetadata(channelName);

   // 2. Derive Channel PDA
   const [channelPda] = PublicKey.findProgramAddressSync(
     [Buffer.from("channel"), owner.toBuffer(), channelId.toBuffer()],
     programId
   );

   // 3. Call create_channel
   await program.methods.createChannel(channelId, encryptedName, type).rpc();
   ```

2. **Send Message**:
   ```typescript
   // 1. Encrypt message content
   const encryptedMsg = await encryptMessage(content);

   // 2. Upload to IPFS
   const cid = await ipfs.add(encryptedMsg);

   // 3. Encrypt CID
   const encryptedCid = await encryptCid(cid);

   // 4. Hash for proof
   const hash = sha256(encryptedMsg);

   // 5. Log on-chain
   await program.methods.logMessage(hash, encryptedCid).rpc();
   ```

3. **Receive Messages**:
   ```typescript
   // 1. Subscribe to MessageLogged events
   program.addEventListener("MessageLogged", async (event) => {
     // 2. Decrypt IPFS CID
     const cid = await decryptCid(event.encrypted_ipfs_cid);

     // 3. Fetch from IPFS
     const encryptedMsg = await ipfs.get(cid);

     // 4. Decrypt message
     const message = await decryptMessage(encryptedMsg);

     // 5. Verify hash
     assert(sha256(encryptedMsg) === event.message_hash);
   });
   ```

## Performance Characteristics

### Transaction Costs (Devnet)
- **create_channel**: ~0.002 SOL (account rent + tx fee)
- **join_channel**: ~0.001 SOL (member account rent)
- **log_message**: ~0.000005 SOL (tx fee only, no storage)
- **update_channel**: ~0.000005 SOL (tx fee)
- **leave_channel**: ~0.000005 SOL (tx fee)
- **set_token_gate**: ~0.000005 SOL (tx fee)

### Storage Costs
- **Channel**: 619 bytes → ~0.0043 SOL rent
- **Member**: 74 bytes → ~0.0005 SOL rent

### Throughput
- **Messages per second**: Limited by Solana TPS (~2000-3000)
- **Channels per owner**: Unlimited (unique channel_id per owner)
- **Members per channel**: 100 (configurable via MAX_MEMBERS)

---

**Implementation Status**:
- ✅ Smart contract complete and deployed to devnet
- ✅ Frontend complete (Next.js 15 with wallet integration)
- ✅ Arcium encryption integration complete (RescueCipher + x25519)
- ✅ IPFS storage complete (Pinata with demo mode fallback)
- ✅ Helius real-time monitoring complete (Enhanced WebSockets with direct CID extraction)
- ✅ ShadowWire payment attachments complete (private deposits, withdrawals, transfers)
- ✅ MagicBlock presence features complete (typing, online status, read receipts)

---

## Phase 4: ShadowWire Payment Attachments

### Integration Overview
Private payment attachments using ShadowWire's confidential transactions.

**Key Files:**
- `shieldchat-frontend/src/lib/shadowwire.ts` - ShadowWire client
- `shieldchat-frontend/src/hooks/usePayments.ts` - Payment state management
- `shieldchat-frontend/src/components/PaymentModal.tsx` - Payment UI

**Features:**
- Deposit SOL/tokens to ShadowWire shielded pool
- Withdraw from shielded pool to wallet
- Private internal transfers (amounts hidden on-chain)
- Payment attachments embedded in messages
- Transaction status display (pending/completed/failed)

---

## Phase 5: MagicBlock Private Ephemeral Rollups

### Integration Overview
Real-time presence features using MagicBlock's TEE-protected ephemeral rollups.

**Package:** `@magicblock-labs/ephemeral-rollups-sdk@0.8.0`

**Key Files:**
- `presence-server/server.js` - WebSocket server for presence sync
- `presence-server/package.json` - Server dependencies
- `shieldchat-frontend/src/lib/magicblock.ts` - MagicBlock client
- `shieldchat-frontend/src/hooks/usePresence.ts` - React presence hook
- `shieldchat-frontend/src/components/TypingIndicator.tsx` - Animated typing dots
- `shieldchat-frontend/src/components/OnlineStatus.tsx` - Green/gray status dot
- `shieldchat-frontend/src/components/ReadReceipt.tsx` - Checkmark indicators
- `shieldchat-frontend/src/components/WalletAddress.tsx` - Truncated address with copy

### Presence Architecture
```
Frontend (usePresence hook)
    │
    ├── WebSocket → Presence Server (ws://localhost:3001)
    │                    │
    │                    ├── Heartbeat every 5s
    │                    ├── Typing status (auto-clear 3s)
    │                    └── Online status (TTL 30s)
    │
    └── MagicBlock SDK (TEE auth for production)
```

### Features Implemented

1. **Typing Indicators**
   - Real-time "User is typing..." display
   - Animated bouncing dots
   - Auto-clear after 3 seconds of inactivity
   - Multiple users support

2. **Online Status**
   - Green dot = online, Gray dot = offline
   - Displayed on message avatars
   - Online count in channel header
   - Heartbeat every 5 seconds maintains status
   - 30-second TTL for stale cleanup

3. **Read Receipts**
   - Single check (✓) = sent
   - Double check (✓✓) = delivered
   - Blue double check = read
   - Only shown for own messages

4. **Wallet Address Display**
   - Format: `EuQoFfUb.....abadue` (first 8 + "...." + last 6)
   - Click to copy full address to clipboard
   - "Copied!" tooltip feedback (2 seconds)
   - Used throughout: message sender, payment recipient, typing indicator

### WebSocket Server (presence-server)
```javascript
// Message types handled:
- identify: Associate wallet with connection
- subscribe: Subscribe to channel presence
- unsubscribe: Unsubscribe from channel
- set_typing: Update typing status
- set_online: Update online status
- mark_read: Mark message as read
- heartbeat: Keep connection alive

// Broadcasts presence_update to all channel subscribers
```

### Running the Presence Server
```bash
cd presence-server
npm install
npm start  # Runs on ws://localhost:3001
```

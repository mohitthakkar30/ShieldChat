# ShieldChat - Project Overview

ShieldChat is a privacy-focused decentralized messaging platform built on Solana. It combines blockchain-based message verification with cutting-edge encryption technologies to provide end-to-end encrypted messaging, anonymous voting, private payments, and real-time presence features.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Technology Stack](#technology-stack)
3. [Architecture Overview](#architecture-overview)
4. [Smart Contracts](#smart-contracts)
5. [Encryption & Privacy](#encryption--privacy)
6. [Core Features](#core-features)
7. [Frontend Structure](#frontend-structure)
8. [Data Flow](#data-flow)
9. [Security Properties](#security-properties)
10. [Deployment](#deployment)

---

## Introduction

ShieldChat addresses the growing need for private, secure communication in the Web3 ecosystem. Traditional messaging apps store messages on centralized servers, creating single points of failure and privacy concerns. ShieldChat takes a different approach by leveraging Solana's blockchain for message verification while keeping actual message content encrypted and stored on IPFS.

The platform supports multiple channel types including direct messages, private groups, token-gated communities, and public channels. Each channel type offers different access controls while maintaining the same strong encryption guarantees.

---

## Technology Stack

### Frontend

- **Next.js 16** - React framework for the web application
- **React 19** - UI component library
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS v4** - Utility-first styling
- **Solana Wallet Adapter** - Multi-wallet support (Phantom, Solflare, etc.)

### Blockchain

- **Solana** - High-performance blockchain for transaction processing
- **Anchor Framework 0.32** - Solana program development framework
- **Helius** - RPC provider with WebSocket support for real-time updates

### Encryption Technologies

- **Arcium** - RescueCipher encryption with x25519 key exchange for message content
- **Inco Lightning** - Fully Homomorphic Encryption (FHE) for anonymous vote tallying
- **ShadowWire** - Bulletproof zero-knowledge proofs for private payments

### Storage

- **IPFS via Pinata** - Decentralized storage for encrypted message content
- **Supabase** - PostgreSQL cache layer for fast message retrieval
- **On-chain Logs** - Message hashes and CIDs stored on Solana for verification

### Real-Time Communication

- **WebSocket Presence Server** - Custom Node.js server for typing indicators and online status
- **Helius WebSocket** - Real-time transaction notifications

---

## Architecture Overview

ShieldChat follows a hybrid architecture that combines on-chain verification with off-chain storage:

### Three-Layer Design

**Layer 1: Solana Blockchain**
- Stores message hashes and IPFS content identifiers (CIDs)
- Manages channel membership and access control
- Handles token-gating and staking logic
- Processes game state and voting records

**Layer 2: Encrypted Storage (IPFS)**
- Stores actual encrypted message content
- Content addressed storage ensures integrity
- Multiple gateway fallbacks for reliability

**Layer 3: Real-Time Services**
- WebSocket presence server handles typing indicators and online status
- Supabase caches messages for fast retrieval
- Helius WebSocket delivers instant transaction notifications

### Program Architecture

ShieldChat consists of three Solana programs that work together:

1. **shield_chat** - Core messaging protocol
2. **arcium_mxe** - Games and entertainment features
3. **shieldchat_voting** - Anonymous polling system

---

## Smart Contracts

### Shield Chat Program (Core Messaging)

**Program ID:** `FVViRGPShMjCeSF3LDrp2qDjp6anRz9WAMiJrsGCRUzN`

This is the main program handling all messaging functionality:

**Channel Management**
- Create channels with encrypted metadata
- Support for four channel types: DirectMessage, PrivateGroup, TokenGated, and Public
- Atomic channel creation with automatic creator membership
- Maximum 100 members per channel
- 512 bytes metadata limit for channel information

**Membership System**
- Join channels with optional token-gating requirements
- Stake tokens to vault on joining token-gated channels
- Track member activity and status
- Leave channels and reclaim staked tokens

**Message Logging**
- Record message hashes on-chain for verification
- Store IPFS CIDs for content retrieval
- Emit events for real-time notification systems
- Maintain immutable audit trail

### Arcium MXE Program (Games)

**Program ID:** `Bg4L8JiYF7EmoAXHMXtzSfMBkJg9b8fnNjYSPDTi7sMm`

Handles in-channel gaming features:

**Tic Tac Toe**
- Create games with SOL wagers
- Join existing games by matching the wager
- Make moves with on-chain state transitions
- Automatic winner detection and payout
- Cancel games before opponent joins
- Claim winnings after game completion

**Game State Management**
- Track game progress on-chain
- Verify valid moves
- Handle draws and split payouts
- Minimum wager of 0.001 SOL

### ShieldChat Voting Program (Polls)

**Program ID:** `H19dGK9xWHppSSuAEv9TfgPyK1S2dB1zihBXPXQnWdC5`

Enables anonymous voting within channels:

**Poll Creation**
- Create polls with 2-4 options
- Set voting duration (1 hour, 4 hours, or 24 hours)
- Question limit of 200 characters
- Option text limit of 50 characters each

**Anonymous Voting**
- Votes encrypted using Inco FHE during voting period
- Individual votes hidden from all parties
- One vote per member per poll
- Vote records tracked to prevent double voting

**Result Revelation**
- Poll creator reveals results after deadline
- Aggregate counts decrypted on-chain
- Results logged as channel messages
- Full transparency of final tallies

---

## Encryption & Privacy

### Message Encryption with Arcium

ShieldChat uses Arcium's RescueCipher for message encryption, providing 128-bit security:

**Key Derivation**
- Channel encryption key derived deterministically from channel PDA
- SHA-256 hash combined with salt generates symmetric key
- x25519 used for key exchange operations
- All channel members can derive the same key

**Encryption Process**
- Each message gets a unique 16-byte random nonce
- Content encrypted with RescueCipher before leaving the client
- Encrypted payload uploaded to IPFS
- Only CID and hash stored on-chain

**Decryption**
- Recipients derive channel key from PDA
- Fetch encrypted content from IPFS
- Decrypt locally using derived key
- Original message displayed in UI

### Real-Time Presence with WebSocket Server

A dedicated WebSocket server handles real-time presence features:

**Typing Indicators**
- Typing status broadcast to channel members
- No permanent record of typing activity
- Real-time updates via WebSocket connection
- Automatic timeout when user stops typing

**Online Status**
- User availability tracked per channel
- Automatic timeout for inactive users
- Heartbeat mechanism keeps connections alive
- Reconnection with exponential backoff

**Read Receipts**
- Message read status tracked per user
- Broadcast to channel members
- No blockchain storage of read data
- Ephemeral presence state

### Anonymous Voting with Inco FHE

Inco Lightning enables truly anonymous voting:

**Vote Encryption**
- Individual votes encrypted with FHE
- Encrypted votes stored on-chain
- No one can see individual choices
- Not even the poll creator

**Homomorphic Computation**
- Vote tallying performed on encrypted data
- Results computed without decrypting individual votes
- Only aggregate counts revealed
- Mathematical privacy guarantees

### Private Payments with ShadowWire

ShadowWire uses Bulletproof zero-knowledge proofs:

**Payment Privacy**
- Transaction amounts hidden
- Sender and receiver privacy preserved
- Zero-knowledge proofs verify validity
- No third party sees payment details

**Supported Tokens**
- SOL (native)
- USDC
- BONK
- RADR

---

## Core Features

### Channel System

**Direct Messages**
- One-on-one encrypted conversations
- Minimal on-chain footprint
- Fast message delivery

**Private Groups**
- Invite-only group chats
- Creator controls membership
- Encrypted group metadata

**Token-Gated Channels**
- Require minimum token holdings to join
- Tokens staked to channel vault
- Automatic access control
- Supports any SPL token

**Public Channels**
- Open for anyone to join
- Community discussion spaces
- Same encryption for messages

### Messaging

**Encrypted Content**
- All messages encrypted client-side
- Content stored on IPFS
- Only hashes on blockchain
- Impossible to read without channel key

**Message Caching**
- Supabase provides fast message retrieval
- Background sync from Solana and IPFS
- Optimistic UI updates
- Offline message queue

**Real-Time Delivery**
- Helius WebSocket notifications
- Instant message appearance
- Typing indicators while composing
- Read receipts for sent messages

### Voting System

**Poll Creation**
- Simple poll setup interface
- Configurable voting period
- Multiple choice options
- Channel-scoped polls

**Anonymous Voting**
- Cast votes without revealing choice
- FHE ensures mathematical privacy
- No way to link votes to voters
- Verifiable tally computation

**Result Display**
- Results shown after deadline
- Aggregate counts only
- Results posted as channel messages
- Full audit trail

### Gaming

**Tic Tac Toe**
- Classic game with SOL wagers
- Real-time game updates via polling
- Automatic winner determination
- Fair payout system

**Game Discovery**
- View active games in channel
- Join open games
- Create new games with custom wagers
- Track game history

### Private Payments

**In-Chat Payments**
- Attach payments to messages
- Zero-knowledge proof privacy
- Multiple token support
- Payment status tracking

**Transfer Types**
- Internal transfers (both on ShadowWire)
- External transfers (any Solana wallet)
- Claim pending payments
- Transaction history

### Access Control

**Invite System**
- Generate shareable invite codes
- Join channels via invite link
- Invite expiration options
- Track invite usage

**Membership Management**
- View channel members
- Member activity status
- Leave channel functionality
- Stake management for token-gated channels

---

## Frontend Structure

### Pages

**Landing Page (`/`)**
- Feature overview and introduction
- Connect wallet prompt
- Navigation to main app

**Main App (`/app`)**
- Channel list sidebar
- Channel creation interface
- Wallet connection status

**Channel View (`/app/channels/[id]`)**
- Message display area
- Message composition input
- Channel actions (polls, games, payments)
- Member list and presence indicators

**Invite Join (`/join/[code]`)**
- Process invite codes
- Join channel flow
- Redirect to channel after joining

### Key Hooks

**useShieldChat**
- Channel CRUD operations
- Membership management
- Channel metadata handling

**useMessages**
- Fetch and display messages
- Encryption and decryption
- Supabase caching integration
- Real-time message updates

**useVoting**
- Poll creation and management
- Vote casting with FHE
- Result revelation
- Poll status tracking

**useGames**
- Game creation and joining
- Move execution
- Game state polling
- Winnings claim

**usePayments**
- ShadowWire integration
- Payment creation
- Claim management
- Balance checking

**usePresence**
- WebSocket presence server connection
- Typing indicator management
- Online status updates
- Read receipt handling

### Key Components

**Channel Components**
- ChannelList - Sidebar navigation
- CreateChannelModal - New channel creation
- InviteModal - Generate and share invites
- LeaveChannelModal - Exit channel confirmation

**Message Components**
- MessageBubble - Individual message display
- TypingIndicator - Show who is typing
- ReadReceipt - Message read status
- OnlineStatus - User availability indicator

**Feature Components**
- CreatePollModal - Poll creation interface
- PollCard - Voting interface
- GamesModal - Game launcher
- TicTacToeGame - Game board and controls
- PaymentModal - Send payment interface

**Utility Components**
- Navbar - Top navigation bar
- WalletAddress - Formatted address display
- Loading indicators and error states

### Library Modules

**arcium.ts**
- RescueCipher encryption wrapper
- Key derivation functions
- Encrypt and decrypt operations

**magicblock.ts**
- WebSocket presence client
- Presence subscription management
- Connection handling with reconnection logic

**shadowwire.ts**
- ShadowWire payment client
- Zero-knowledge proof generation
- Payment verification

**ipfs.ts**
- Pinata upload and retrieval
- Gateway fallback logic
- Demo mode base64 encoding

**supabase.ts**
- Message cache operations
- Background sync logic
- Query optimization

**constants.ts**
- Program IDs
- PDA derivation helpers
- Network configuration

---

## Data Flow

### Sending a Message

1. User types message in channel input
2. Client derives encryption key from channel PDA
3. Message encrypted with Arcium RescueCipher
4. Encrypted content uploaded to IPFS via Pinata
5. Client calls `logMessage` instruction with CID and hash
6. Transaction confirmed on Solana
7. Message appears locally (optimistic update)
8. Helius WebSocket notifies other channel members
9. Recipients fetch and decrypt message

### Receiving Messages

1. Helius WebSocket delivers transaction notification
2. Client parses MessageLogged event from transaction
3. Extract encrypted IPFS CID from event data
4. Fetch encrypted content from IPFS (with gateway fallback)
5. Derive channel key from PDA
6. Decrypt message with Arcium
7. Store in Supabase cache
8. Display in message list with sender info

### Casting a Vote

1. User selects option in poll interface
2. Vote encrypted with Inco FHE client-side
3. Encrypted vote sent to voting program
4. Vote record created preventing double voting
5. Individual vote remains encrypted on-chain
6. After deadline, creator reveals results
7. FHE computation tallies votes without decryption
8. Aggregate results posted to channel

### Playing a Game

1. Player X creates game with wager amount
2. SOL transferred to game account
3. Player O joins with matching wager
4. Game state changes to active
5. Players alternate making moves
6. Each move verified and recorded on-chain
7. Winner detection runs after each move
8. Winner claims combined pot

---

## Security Properties

### End-to-End Encryption
- Messages encrypted before leaving client device
- Decryption only possible with channel membership
- No server or third party can read content

### Deterministic Key Derivation
- All channel members derive identical encryption key
- Key derived from channel PDA (publicly verifiable)
- No key exchange messages required

### On-Chain Verification
- Message hashes stored on blockchain
- Content integrity verifiable against hash
- Tamper-evident message history

### Anonymous Voting
- Individual votes encrypted with FHE
- Homomorphic tallying preserves privacy
- Only aggregate counts ever revealed

### Private Payments
- Zero-knowledge proofs hide amounts
- Sender and receiver privacy preserved
- Cryptographic validity guarantees

### Ephemeral Presence
- WebSocket server handles real-time presence
- No permanent storage of presence data
- Automatic cleanup of stale connections

### Token-Gating Security
- Stake verification on-chain
- Cannot fake token holdings
- Automatic enforcement

### Immutable Audit Trail
- All message logs on blockchain
- Cannot delete or modify history
- Transparent operation

---

## Deployment

### Network Configuration

- **Blockchain:** Solana Devnet
- **RPC Provider:** Helius with WebSocket support
- **IPFS Gateway:** Pinata with public gateway fallbacks

### Program Deployments

| Program | ID |
|---------|-----|
| shield_chat | FVViRGPShMjCeSF3LDrp2qDjp6anRz9WAMiJrsGCRUzN |
| arcium_mxe | Bg4L8JiYF7EmoAXHMXtzSfMBkJg9b8fnNjYSPDTi7sMm |
| shieldchat_voting | H19dGK9xWHppSSuAEv9TfgPyK1S2dB1zihBXPXQnWdC5 |

### Environment Requirements

- Node.js for presence server
- Rust and Anchor CLI for program development
- Solana CLI for deployment operations
- Environment variables for API keys (Helius, Pinata, Supabase)

### Frontend Deployment

- Next.js application
- Static export compatible
- Environment-based configuration
- Presence server

---

## Summary

ShieldChat represents a new paradigm in secure messaging by combining the transparency and immutability of blockchain with state-of-the-art encryption technologies. The platform ensures that while message existence and ordering are publicly verifiable on Solana, the actual content remains private and encrypted.

Key differentiators include:
- True end-to-end encryption with Arcium
- Anonymous voting through Inco's FHE
- Private payments via ShadowWire's zero-knowledge proofs
- Real-time presence via WebSocket server
- Flexible channel types including token-gated communities
- In-channel gaming with on-chain fairness

The architecture balances decentralization with usability, using IPFS for content storage, Supabase for caching, and WebSockets for real-time features while maintaining blockchain-level security guarantees for all critical operations.

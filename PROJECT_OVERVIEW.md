# ShieldChat - Private Messaging on Solana

## What is ShieldChat?

ShieldChat is a **fully decentralized, end-to-end encrypted messaging application** built on Solana. Think of it as "Signal meets Web3" — private conversations where you own your data, with the added ability to send private payments directly within chats.

---

## The Problem We Solve

Traditional messaging apps have critical flaws:

| Problem | Impact |
|---------|--------|
| **Centralized servers** | Companies can read your messages, sell your data, or be forced to hand it over |
| **No payment integration** | Sending money requires leaving the app, using separate services |
| **No ownership** | Your account, messages, and history belong to the platform |
| **Metadata exposure** | Even with encryption, who you talk to and when is visible |

---

## Our Solution

ShieldChat combines **four privacy-focused technologies** to create truly private communication:

```
┌─────────────────────────────────────────────────────────────┐
│                      ShieldChat                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   🔐 ARCIUM          → End-to-end message encryption        │
│   💰 SHADOWWIRE      → Private payments (amounts hidden)    │
│   ⚡ PRESENCE        → Real-time presence (typing, online)  │
│   📡 HELIUS          → Instant message delivery             │
│                                                              │
│   All running on SOLANA for speed & low fees                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## How Each Technology Fits

### 1. Arcium — Message Encryption

**What it does:** Encrypts all message content so only channel members can read it.

**How we use it:**
- **RescueCipher** symmetric encryption (128-bit security)
- **x25519 Elliptic Curve Diffie-Hellman** for key exchange
- Channel-based key derivation — all members share an encryption key
- Messages are encrypted client-side before leaving your device

**Why it matters:** Even if someone intercepts your messages on IPFS or Solana, they see only encrypted gibberish. Not even we can read your conversations.

```
You type: "Hey, want to grab coffee?"
On-chain:  "aGVsbG8gd29ybGQhIHRoaXMgaXMgYW4gZW5jcnlwdGVk..."
```

---

### 2. ShadowWire — Private Payments

**What it does:** Enables sending SOL/tokens with **amounts hidden on-chain**.

**How we use it:**
- **Shielded Pool**: Deposit funds into a privacy pool
- **Private Transfers**: Send to other users without revealing amounts on-chain.
- **Payment Attachments**: Embed payments directly in messages
- **Confidential Transactions**: Zero-knowledge proofs hide amounts on-chain

**Why it matters:** Normal Solana transfers are 100% public anyone can see you sent 5 SOL to Alice. With ShadowWire, the on-chain transaction hides the amount using Bulletproofs (ZK proofs).

**Privacy model — what's visible where:**

| Layer | Amount | Recipient | Who Sees |
|-------|--------|-----------|----------|
| **On-chain (Solscan)** | Hidden (ZK proof) | Pool address | Everyone |
| **IPFS message** | Encrypted | Encrypted | Everyone (unreadable) |
| **In-app chat** | Visible | Visible | Channel members only |

```
On Solscan:       "Wallet A → [ZK Proof] → ShadowWire Pool"  (amount hidden)
In ShieldChat:    "5 USDC → C3vfw3Ae.....o3i5dU"            (decrypted for members)
```

**User flow:**
1. Deposit SOL into shielded pool
2. Send private payment within a message (amount stored in encrypted IPFS)
3. Channel members see decrypted payment details
4. Recipient withdraws to their wallet

**Payment status explained:**
- **"Pending"** — For internal transfers between ShadowWire users. Funds are in the recipient's ShadowWire balance, waiting to be withdrawn to their wallet.
- **"Completed"** — For external transfers. Funds were sent directly to the recipient's wallet address.

Internal payments stay "pending" until the recipient withdraws from their ShadowWire balance. This is by design — it keeps funds in the privacy pool until the recipient is ready to move them.

---

### 3. WebSocket Presence — Real-Time Features

**What it does:** Powers typing indicators, online status, and read receipts using a **lightweight WebSocket server**.

**How we use it:**
- **Typing Indicators**: See "Alice is typing..." with animated dots
- **Online Status**: Green dot = online, gray = offline
- **Read Receipts**: Track which messages have been read
- **Channel-Scoped**: Presence data only shared with channel members

**Why it matters:** These features make chat feel "alive" and responsive. The WebSocket presence server provides:
- Instant updates (millisecond latency)
- No wallet signatures required (great UX)
- Automatic reconnection with exponential backoff
- Heartbeat-based online status (5-second intervals)

```
Presence Architecture:

Your Browser ──WebSocket──► Presence Server (ws://3001)
     │                            │
     │                            ▼
     │                    Channel Subscribers
     │                            │
     ◄────────────────────────────┘
         (typing, online, read updates)
```

---

### 4. Helius — Instant Message Delivery

**What it does:** Provides real-time WebSocket notifications when new messages arrive.

**How we use it:**
- **Enhanced WebSockets**: Subscribe to ShieldChat program transactions
- **Direct CID Extraction**: Parse instruction data to get IPFS content ID
- **Single Message Fetch**: Only download the new message, not all messages
- **Automatic Reconnection**: Handles network issues gracefully

**Why it matters:** Without Helius, we'd need to poll the blockchain every few seconds (slow, wasteful). With Helius WebSockets, new messages appear **instantly** — often under 1 second.

```
Without Helius:  Poll every 3s → "Any new messages?" → Maybe...
With Helius:     WebSocket push → "New message!" → Instant display
```

---

## Technical Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         USER'S BROWSER                            │
├──────────────────────────────────────────────────────────────────┤
│  Next.js Frontend                                              │
│  ├── Wallet Adapter (Phantom, Solflare, Backpack)                │
│  ├── useMessages hook (fetch, send, decrypt)                     │
│  ├── usePresence hook (typing, online, read)                     │
│  └── usePayments hook (deposit, withdraw, transfer)              │
└───────────────────────────┬──────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│    SOLANA     │   │     IPFS      │   │   PRESENCE    │
│   (Anchor)    │   │   (Pinata)    │   │    SERVER     │
├───────────────┤   ├───────────────┤   ├───────────────┤
│ Channels      │   │ Encrypted     │   │ WebSocket     │
│ Members       │   │ Messages      │   │ (ws://3001)   │
│ Message refs  │   │ (CID stored   │   │               │
│ Token gates   │   │  on-chain)    │   │ Heartbeat 5s  │
└───────┬───────┘   └───────────────┘   └───────────────┘
        │
        ▼
┌───────────────┐
│    HELIUS     │
│  WebSockets   │
├───────────────┤
│ Real-time tx  │
│ notifications │
└───────────────┘
```

---

## User Journey

### 1. Connect Wallet
User connects their Solana wallet (Phantom, Solflare, or Backpack).

### 2. Create or Join Channel
- **Create**: Set a name, optionally require token ownership to join
- **Join**: Enter channel ID, prove token ownership if required

### 3. Send Messages
- Type message → Encrypted with Arcium → Stored on IPFS → Reference saved on Solana
- Other members receive via Helius WebSocket → Decrypt with shared key → Display

### 4. Send Private Payment (Optional)
- Click payment button → Enter amount → ShadowWire private transfer
- Recipient sees payment in message bubble → Can withdraw to wallet

### 5. Real-Time Presence
- Start typing → Others see "You are typing..."
- Online status shown on message avatars
- Read receipts update when messages are viewed

---

### Arcium ✅
> "Build applications using Arcium's MPC encryption"

We use Arcium's SDK for:
- RescueCipher symmetric encryption
- x25519 key exchange
- All messages encrypted before leaving the client

### ShadowWire ✅
> "Integrate private payments using ShadowWire"

We implemented:
- Full deposit/withdraw flow
- Private internal transfers
- Payment attachments in messages
- Amount privacy on-chain

### Real-Time Presence ✅
> "Real-time features for responsive chat experience"

We built:
- Typing indicators with instant updates
- Online status with heartbeat detection
- Read receipts with channel-scoped visibility
- WebSocket-based for no wallet signature interruptions

### Helius ✅
> "Build with Helius Enhanced WebSockets"

We integrated:
- Real-time transaction subscriptions
- Direct instruction data parsing
- Instant message delivery (<1 second)

### Open Track ✅
> "Novel privacy application with multiple integrations"

ShieldChat combines ALL FOUR technologies into a cohesive product that solves a real problem: private communication with integrated payments.

---

## What Makes Us Different

| Feature | Telegram | Signal | Discord | **ShieldChat** |
|---------|----------|--------|---------|----------------|
| E2E Encryption | Optional | ✅ | ❌ | ✅ (Arcium) |
| Decentralized | ❌ | ❌ | ❌ | ✅ (Solana) |
| Private Payments | ❌ | ❌ | ❌ | ✅ (ShadowWire) |
| Token Gating | ❌ | ❌ | Limited | ✅ (Native) |
| Own Your Data | ❌ | ❌ | ❌ | ✅ (IPFS) |
| Real-time Presence | ✅ | ✅ | ✅ | ✅ (WebSocket) |

---

## Running the Project

### Prerequisites
- Node.js 18+
- Solana CLI
- Phantom/Solflare wallet

### Quick Start
```bash
# Frontend
cd shieldchat-frontend
npm install
npm run dev

# Presence Server (separate terminal)
cd presence-server
npm install
npm start
```

### Environment Variables
```env
NEXT_PUBLIC_HELIUS_API_KEY=your_key    # For real-time messages
PINATA_JWT=your_jwt                     # For IPFS storage
```

---

## The Vision

ShieldChat proves that **privacy and usability can coexist**. By combining Solana's speed with cutting-edge privacy technologies, we've built a messaging app that:

1. **Respects your privacy** — Messages encrypted, payments hidden
2. **Gives you ownership** — Your wallet, your identity, your data
3. **Feels modern** — Real-time typing, instant delivery, smooth UX
4. **Enables new use cases** — Token-gated communities, private payments

This is what Web3 communication should look like.

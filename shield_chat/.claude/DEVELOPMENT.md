# ShieldChat Development Guide

## Development Environment Setup

### Prerequisites

#### 1. Rust Installation

```bash
# Install Rust via rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Verify installation
rustc --version  # Should be 1.70+
cargo --version
```

#### 2. Solana CLI Installation

```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Add to PATH (add to ~/.bashrc or ~/.zshrc)
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Verify installation
solana --version  # Should be 1.17+
```

#### 3. Anchor Framework Installation

```bash
# Install avm (Anchor Version Manager)
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force

# Install Anchor 0.32.1
avm install 0.32.1
avm use 0.32.1

# Verify installation
anchor --version  # Should show 0.32.1
```

#### 4. Node.js and Yarn

```bash
# Install Node.js 18+ (via nvm recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Install Yarn
npm install -g yarn

# Verify installation
node --version  # Should be 18+
yarn --version
```

### Project Setup

#### 1. Clone and Install

```bash
# Navigate to project
cd shield_chat

# Install dependencies
yarn install
```

#### 2. Configure Solana

```bash
# Generate a new keypair (if needed)
solana-keygen new -o ~/.config/solana/id.json

# Set cluster to devnet
solana config set --url devnet

# Airdrop SOL for testing
solana airdrop 2

# Verify balance
solana balance
```

#### 3. Verify Setup

```bash
# Build the project
anchor build

# Run tests
anchor test
```

If everything is set up correctly, the build should succeed and tests should run.

## Project Structure

```
shield_chat/
├── .anchor/                    # Anchor cache
├── .claude/                    # Project documentation
│   ├── README.md
│   ├── IMPLEMENTATION.md
│   ├── DEPLOYMENT.md
│   ├── DEVELOPMENT.md (this file)
│   ├── NEXT_STEPS.md
│   └── TESTING.md
├── node_modules/               # Node dependencies
├── programs/                   # Solana programs
│   └── shield_chat/
│       ├── src/
│       │   └── lib.rs         # Main program code
│       ├── Cargo.toml         # Rust dependencies
│       └── Xargo.toml         # Cross-compilation config
├── target/                     # Build artifacts
│   ├── deploy/                # Compiled programs
│   │   ├── shield_chat.so
│   │   └── shield_chat-keypair.json
│   ├── idl/                   # Interface definitions
│   │   └── shield_chat.json
│   └── types/                 # TypeScript types
│       └── shield_chat.ts
├── tests/                      # Test files
│   └── shield_chat.ts         # Contract tests
├── Anchor.toml                # Anchor configuration
├── Cargo.toml                 # Workspace config
├── package.json               # Node dependencies
├── tsconfig.json              # TypeScript config
└── ShieldChat.md              # Original specification
```

## Common Development Commands

### Building

```bash
# Clean build
anchor clean

# Build program
anchor build

# Build in verbose mode
anchor build --verbose

# Build for specific program
anchor build --program-name shield_chat
```

### Testing

```bash
# Run all tests
anchor test

# Run tests without building
anchor test --skip-build

# Run specific test file
anchor test --file tests/shield_chat.ts

# Run with verbose output
anchor test --verbose

# Keep test validator running
anchor test --detach
```

### Local Validator

```bash
# Start local validator
solana-test-validator

# In another terminal, configure to use local
solana config set --url localhost

# Deploy to local
anchor deploy

# Stop validator
# Ctrl+C or:
solana-test-validator --reset
```

### Deployment

```bash
# Deploy to devnet
anchor deploy --provider.cluster devnet

# Deploy to mainnet (when ready)
anchor deploy --provider.cluster mainnet

# Upgrade existing program
anchor upgrade target/deploy/shield_chat.so \
  --program-id FVViRGPShMjCeSF3LDrp2qDjp6anRz9WAMiJrsGCRUzN \
  --provider.cluster devnet
```

## Development Workflow

### 1. Making Changes to Smart Contract

```bash
# 1. Edit programs/shield_chat/src/lib.rs
vim programs/shield_chat/src/lib.rs

# 2. Build to check for errors
anchor build

# 3. Run tests
anchor test

# 4. If tests pass, deploy
anchor deploy --provider.cluster devnet
```

### 2. Adding New Instructions

Example: Adding a `kick_member` instruction

```rust
// In programs/shield_chat/src/lib.rs

// 1. Add the instruction handler
pub fn kick_member(
    ctx: Context<KickMember>,
    member_to_kick: Pubkey,
) -> Result<()> {
    let channel = &mut ctx.accounts.channel;
    let member = &mut ctx.accounts.member;

    require!(channel.is_active, ErrorCode::ChannelInactive);

    member.is_active = false;
    channel.member_count = channel.member_count.saturating_sub(1);

    msg!("Member kicked: {}", member_to_kick);

    Ok(())
}

// 2. Define the context
#[derive(Accounts)]
pub struct KickMember<'info> {
    #[account(
        mut,
        constraint = channel.owner == owner.key() @ ErrorCode::NotChannelOwner
    )]
    pub channel: Account<'info, Channel>,

    #[account(
        mut,
        constraint = member.channel == channel.key() @ ErrorCode::NotChannelMember
    )]
    pub member: Account<'info, Member>,

    pub owner: Signer<'info>,
}

// 3. Build and test
```

### 3. Writing Tests

Example test structure:

```typescript
// In tests/shield_chat.ts

describe("New Feature", () => {
  it("Does something", async () => {
    // Setup
    const testData = createTestData();

    // Execute
    await program.methods
      .newInstruction(testData)
      .accounts({ ... })
      .rpc();

    // Assert
    const account = await program.account.channel.fetch(pda);
    expect(account.field).to.equal(expectedValue);
  });
});
```

## Dependency Management

### Current Dependencies

**Rust (Cargo.toml)**:
```toml
[dependencies]
anchor-lang = "0.32.1"
anchor-spl = "0.32.1"
blake3 = "=1.8.2"  # Pinned to avoid edition2024
```

**Node (package.json)**:
```json
{
  "dependencies": {
    "@coral-xyz/anchor": "^0.32.1",
    "@solana/web3.js": "^1.87.6"
  },
  "devDependencies": {
    "@types/mocha": "^9.0.0",
    "chai": "^4.3.4",
    "mocha": "^9.0.3",
    "ts-mocha": "^10.0.0",
    "typescript": "^4.3.5"
  }
}
```

### Updating Dependencies

```bash
# Update Anchor version
avm install 0.33.0  # Example
avm use 0.33.0

# Update Cargo dependencies
cargo update

# Update Node dependencies
yarn upgrade

# Check for outdated packages
cargo outdated
yarn outdated
```

## Troubleshooting Common Issues

### Issue 1: blake3 edition2024 Error

**Error**:
```
error: failed to download `blake3 v1.8.3`
Caused by: feature `edition2024` is required
```

**Solution**:
Pin blake3 to version 1.8.2 in `programs/shield_chat/Cargo.toml`:
```toml
blake3 = "=1.8.2"
```

### Issue 2: Anchor Version Mismatch

**Error**:
```
WARNING: `anchor-lang` version(0.29.0) and the current CLI version(0.32.1) don't match.
```

**Solution**:
Update dependencies in `programs/shield_chat/Cargo.toml`:
```toml
anchor-lang = "0.32.1"
anchor-spl = "0.32.1"
```

### Issue 3: Insufficient SOL

**Error**:
```
Error: Insufficient funds
```

**Solution**:
```bash
# Airdrop more SOL
solana airdrop 2 --url devnet

# Or request from faucet
# Visit: https://faucet.solana.com/
```

### Issue 4: Airdrop Rate Limiting

**Error**:
```
Error: 429 Too Many Requests
```

**Solution**:
```bash
# Wait a few minutes, then try again
# Or use faucet: https://faucet.solana.com/
# Or fund from another wallet
```

### Issue 5: Program Deploy Failed

**Error**:
```
Error: Program already deployed
```

**Solution**:
```bash
# Use upgrade instead
anchor upgrade target/deploy/shield_chat.so \
  --program-id <PROGRAM_ID> \
  --provider.cluster devnet
```

### Issue 6: Test Timeouts

**Error**:
```
Error: Timeout of 120000ms exceeded
```

**Solution**:
Increase timeout in `Anchor.toml`:
```toml
[scripts]
test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 \"tests/**/*.ts\""
```

## Best Practices

### Code Organization

1. **Separate Concerns**:
   - Keep instruction handlers focused and small
   - Extract validation logic into helper functions
   - Use clear naming conventions

2. **Error Handling**:
   - Define custom error codes for all failure cases
   - Use descriptive error messages
   - Validate inputs early

3. **Testing**:
   - Test happy path and error cases
   - Use clear test descriptions
   - Clean up test state between runs

### Security

1. **Access Control**:
   - Always verify signer authority
   - Use PDAs for account security
   - Implement proper constraints

2. **Input Validation**:
   - Validate all input sizes
   - Check for overflow/underflow
   - Sanitize user data

3. **State Management**:
   - Use atomic operations
   - Prevent reentrancy
   - Handle partial failures

### Performance

1. **Account Size**:
   - Minimize account sizes
   - Use fixed-size arrays where possible
   - Consider storage costs

2. **Compute Units**:
   - Optimize hot paths
   - Minimize CPI calls
   - Use efficient data structures

3. **Transaction Size**:
   - Keep transactions small
   - Batch operations when possible
   - Use PDAs to reduce account passing

## IDE Setup

### VS Code (Recommended)

**Extensions**:
- `rust-analyzer`: Rust language support
- `Even Better TOML`: TOML syntax highlighting
- `Solana Tools`: Solana development tools

**Settings** (`.vscode/settings.json`):
```json
{
  "rust-analyzer.linkedProjects": [
    "./programs/shield_chat/Cargo.toml"
  ],
  "rust-analyzer.cargo.features": "all",
  "editor.formatOnSave": true,
  "[rust]": {
    "editor.defaultFormatter": "rust-lang.rust-analyzer"
  }
}
```

### Debugging

**VS Code Launch Configuration** (`.vscode/launch.json`):
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Anchor Test",
      "runtimeExecutable": "anchor",
      "runtimeArgs": ["test", "--skip-build"],
      "console": "integratedTerminal"
    }
  ]
}
```

## Git Workflow

### Branching Strategy

```bash
# Main branch for production
main

# Development branch
develop

# Feature branches
feature/channel-encryption
feature/token-gating

# Hotfix branches
hotfix/critical-bug
```

### Commit Messages

```bash
# Format: <type>: <description>

# Examples:
git commit -m "feat: add kick_member instruction"
git commit -m "fix: prevent underflow in member_count"
git commit -m "test: add token-gating test cases"
git commit -m "docs: update deployment guide"
git commit -m "refactor: optimize PDA derivation"
```

### Pre-commit Checks

```bash
# Run before committing
anchor build
anchor test
cargo clippy -- -D warnings
cargo fmt --check
```

## Monitoring & Debugging

### Program Logs

```bash
# Watch program logs in real-time
solana logs <PROGRAM_ID> --url devnet

# View specific transaction logs
solana confirm <TRANSACTION_SIGNATURE> --verbose --url devnet
```

### Account Inspection

```bash
# View account data
solana account <ACCOUNT_ADDRESS> --url devnet

# Decode with Anchor IDL
anchor account channel <CHANNEL_PDA>
anchor account member <MEMBER_PDA>
```

### Transaction Simulation

```typescript
// Simulate before sending
const simulation = await program.methods
  .logMessage(hash, cid)
  .accounts({ ... })
  .simulate();

console.log("Compute units used:", simulation.unitsConsumed);
console.log("Logs:", simulation.logs);
```

## Performance Profiling

### Compute Units

```typescript
// Measure compute units
const { value: { unitsConsumed } } = await provider.connection.simulateTransaction(tx);
console.log(`Compute units: ${unitsConsumed}`);
```

### Transaction Timing

```typescript
// Measure confirmation time
const start = Date.now();
const signature = await program.methods.instruction().rpc();
await provider.connection.confirmTransaction(signature);
const duration = Date.now() - start;
console.log(`Confirmation time: ${duration}ms`);
```

## Resources

### Documentation
- [Anchor Book](https://www.anchor-lang.com/docs/intro)
- [Solana Cookbook](https://solanacookbook.com/)
- [Solana Program Library](https://spl.solana.com/)

### Tools
- [Solana Explorer](https://explorer.solana.com/)
- [Anchor Playground](https://beta.solpg.io/)
- [Solana CLI Docs](https://docs.solana.com/cli)

### Community
- [Solana Discord](https://discord.gg/solana)
- [Anchor Discord](https://discord.gg/ZgPNR2Dw)
- [Stack Exchange](https://solana.stackexchange.com/)

---

**Happy Developing!** For questions or issues, refer to the other documentation files or create an issue.

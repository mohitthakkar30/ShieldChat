import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ShieldChat } from "../target/types/shield_chat";
import { expect } from "chai";

describe("shield-chat", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ShieldChat as Program<ShieldChat>;
  const owner = provider.wallet;

  let channelPda: anchor.web3.PublicKey;
  let channelBump: number;
  const channelId = new anchor.BN(Date.now());

  it("Creates a channel", async () => {
    const encryptedMetadata = Buffer.from("encrypted_channel_name");

    [channelPda, channelBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("channel"),
        owner.publicKey.toBuffer(),
        channelId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    await program.methods
      .createChannel(
        channelId,
        encryptedMetadata,
        { privateGroup: {}}
      )
      .rpc();

    const channel = await program.account.channel.fetch(channelPda);

    expect(channel.channelId.toString()).to.equal(channelId.toString());
    expect(channel.owner.toString()).to.equal(owner.publicKey.toString());
    expect(channel.memberCount).to.equal(1);
    expect(channel.isActive).to.equal(true);

    console.log("✅ Channel created successfully");
  });

  it("Joins a channel", async () => {
    const member = anchor.web3.Keypair.generate();

    // Airdrop SOL to member
    const signature = await provider.connection.requestAirdrop(
      member.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    const [memberPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("member"),
        channelPda.toBuffer(),
        member.publicKey.toBuffer(),
      ],
      program.programId
    );

    await program.methods
      .joinChannel()
      .accounts({
        channel: channelPda,
        memberWallet: member.publicKey,
      })
      .signers([member])
      .rpc();

    const memberAccount = await program.account.member.fetch(memberPda);
    const channel = await program.account.channel.fetch(channelPda);

    expect(memberAccount.wallet.toString()).to.equal(member.publicKey.toString());
    expect(memberAccount.isActive).to.equal(true);
    expect(channel.memberCount).to.equal(2);

    console.log("✅ Member joined successfully");
  });

  it("Logs a message", async () => {
    const messageHash = Array.from(Buffer.alloc(32, 1)); // Mock hash
    const encryptedCid = Buffer.from("Qm...mock_ipfs_cid");

    const [memberPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("member"),
        channelPda.toBuffer(),
        owner.publicKey.toBuffer(),
      ],
      program.programId
    );

    // Owner is automatically a member when creating channel
    // Create member account for owner
    try {
      await program.methods
        .joinChannel()
        .accounts({
          channel: channelPda,
          memberWallet: owner.publicKey,
        })
        .rpc();
    } catch (e) {
      // Member might already exist
    }

    await program.methods
      .logMessage(messageHash, encryptedCid)
      .accounts({
        channel: channelPda,
        member: memberPda,
        sender: owner.publicKey,
      })
      .rpc();

    const channel = await program.account.channel.fetch(channelPda);
    expect(channel.messageCount.toString()).to.equal("1");

    console.log("✅ Message logged successfully");
  });

  it("Updates channel metadata", async () => {
    const newMetadata = Buffer.from("new_encrypted_metadata");

    await program.methods
      .updateChannel(newMetadata, null)
      .accounts({
        channel: channelPda,
        owner: owner.publicKey,
      })
      .rpc();

    const channel = await program.account.channel.fetch(channelPda);
    expect(Buffer.from(channel.encryptedMetadata).toString()).to.equal(
      newMetadata.toString()
    );

    console.log("✅ Channel updated successfully");
  });

  it("Sets token gate", async () => {
    const tokenMint = anchor.web3.Keypair.generate().publicKey;
    const minAmount = new anchor.BN(100);

    await program.methods
      .setTokenGate(tokenMint, minAmount)
      .accounts({
        channel: channelPda,
        owner: owner.publicKey,
      })
      .rpc();

    const channel = await program.account.channel.fetch(channelPda);
    expect(channel.requiredTokenMint.toString()).to.equal(tokenMint.toString());
    expect(channel.minTokenAmount.toString()).to.equal(minAmount.toString());

    console.log("✅ Token gate set successfully");
  });
});

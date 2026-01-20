"use client";

/**
 * Payment Attachment Modal for ShieldChat
 *
 * Allows users to attach private payments to messages using ShadowWire.
 * Supports SOL, USDC, BONK and other tokens.
 */

import { useState, useEffect, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Transaction, Connection } from "@solana/web3.js";
import {
  SUPPORTED_TOKENS,
  SupportedToken,
  getBalance,
  formatAmount,
  fromSmallestUnit,
  PaymentAttachment,
  deposit as shadowWireDeposit,
  withdraw as shadowWireWithdraw,
} from "@/lib/shadowwire";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payment: Omit<PaymentAttachment, "txSignature" | "status">) => void;
  defaultRecipient?: string;
}

type ModalTab = "send" | "deposit" | "withdraw";

export function PaymentModal({
  isOpen,
  onClose,
  onConfirm,
  defaultRecipient = "",
}: PaymentModalProps) {
  const { publicKey, sendTransaction } = useWallet();

  // Use mainnet connection for ShadowWire (SDK only supports mainnet-beta)
  // Using Helius mainnet RPC for reliability
  const mainnetConnection = useMemo(
    () => new Connection(
      `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`,
      "confirmed"
    ),
    []
  );

  const [activeTab, setActiveTab] = useState<ModalTab>("send");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState<SupportedToken>("SOL");
  const [recipient, setRecipient] = useState(defaultRecipient);
  const [transferType, setTransferType] = useState<"internal" | "external">("external");
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch balance when token or wallet changes
  useEffect(() => {
    async function fetchBalance() {
      if (!publicKey) return;

      try {
        const result = await getBalance(publicKey.toString(), token);
        setBalance(fromSmallestUnit(result.available, token));
      } catch {
        setBalance(0);
      }
    }

    if (isOpen) {
      fetchBalance();
    }
  }, [publicKey, token, isOpen]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setRecipient(defaultRecipient);
      setError(null);
      setSuccess(null);
    }
  }, [isOpen, defaultRecipient]);

  // Refresh balance after deposit/withdraw
  const refreshBalance = async () => {
    if (!publicKey) return;
    try {
      const result = await getBalance(publicKey.toString(), token);
      setBalance(fromSmallestUnit(result.available, token));
    } catch {
      // Balance fetch failed silently
    }
  };

  const handleDeposit = async () => {
    setError(null);
    setSuccess(null);

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (!publicKey || !sendTransaction) {
      setError("Wallet not connected or doesn't support signing");
      return;
    }

    setLoading(true);
    try {
      // Get the unsigned transaction from ShadowWire
      const result = await shadowWireDeposit(publicKey.toString(), amountNum, token);

      // Decode the base64 transaction
      const txBuffer = Buffer.from(result.unsignedTx, "base64");
      const transaction = Transaction.from(txBuffer);

      // Get a fresh blockhash from mainnet
      const { blockhash, lastValidBlockHeight } = await mainnetConnection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Send transaction using wallet adapter (handles signing automatically)
      const txSignature = await sendTransaction(transaction, mainnetConnection);

      // Wait for confirmation
      await mainnetConnection.confirmTransaction({
        signature: txSignature,
        blockhash,
        lastValidBlockHeight,
      }, "confirmed");

      setSuccess(`Deposit successful! TX: ${txSignature.slice(0, 8)}...`);
      setAmount("");

      // Refresh balance after a short delay
      setTimeout(async () => {
        await refreshBalance();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deposit failed");
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    setError(null);
    setSuccess(null);

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (amountNum > balance) {
      setError("Insufficient ShadowWire balance");
      return;
    }

    if (!publicKey || !sendTransaction) {
      setError("Wallet not connected or doesn't support signing");
      return;
    }

    setLoading(true);
    try {
      // Get the unsigned transaction from ShadowWire
      const result = await shadowWireWithdraw(publicKey.toString(), amountNum, token);

      // Decode the base64 transaction
      const txBuffer = Buffer.from(result.unsignedTx, "base64");
      const transaction = Transaction.from(txBuffer);

      // Get a fresh blockhash from mainnet
      const { blockhash, lastValidBlockHeight } = await mainnetConnection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Send transaction using wallet adapter (handles signing automatically)
      const txSignature = await sendTransaction(transaction, mainnetConnection);

      // Wait for confirmation
      await mainnetConnection.confirmTransaction({
        signature: txSignature,
        blockhash,
        lastValidBlockHeight,
      }, "confirmed");

      setSuccess(`Withdrawal successful! TX: ${txSignature.slice(0, 8)}...`);
      setAmount("");

      // Refresh balance after a short delay
      setTimeout(async () => {
        await refreshBalance();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdrawal failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    // Validate balance
    if (amountNum > balance) {
      setError("Insufficient balance. Please deposit first.");
      return;
    }

    // Validate recipient
    if (!recipient || recipient.length < 32) {
      setError("Please enter a valid recipient address");
      return;
    }

    setLoading(true);

    try {
      // Pass payment details to parent for processing
      onConfirm({
        amount: amountNum,
        token,
        recipient,
        type: transferType,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create payment");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4 border border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">ShadowWire</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            &times;
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-900 rounded-lg p-1 mb-4">
          <button
            type="button"
            onClick={() => { setActiveTab("send"); setError(null); setSuccess(null); }}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === "send"
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Send
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("deposit"); setError(null); setSuccess(null); }}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === "deposit"
                ? "bg-green-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Deposit
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("withdraw"); setError(null); setSuccess(null); }}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === "withdraw"
                ? "bg-orange-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Withdraw
          </button>
        </div>

        {/* Balance Display */}
        <div className="bg-gray-900/50 rounded-lg p-3 mb-4">
          <div className="text-xs text-gray-500 mb-1">ShadowWire Balance</div>
          <div className="text-lg font-bold text-white">
            {formatAmount(balance, token)} {token}
          </div>
        </div>

        {/* Success Message */}
        {success && (
          <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3 text-green-400 text-sm mb-4">
            {success}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Deposit/Withdraw Tab Content */}
        {(activeTab === "deposit" || activeTab === "withdraw") && (
          <div className="space-y-4">
            {/* Token Selection */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Token</label>
              <select
                value={token}
                onChange={(e) => setToken(e.target.value as SupportedToken)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
              >
                {SUPPORTED_TOKENS.map((t) => (
                  <option key={t.symbol} value={t.symbol}>
                    {t.symbol} - {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Amount</label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                  {token}
                </span>
              </div>
            </div>

            {/* Info Note */}
            <div className="bg-gray-900/50 rounded-lg p-3 text-xs text-gray-400">
              <div className="flex items-start space-x-2">
                <span className={activeTab === "deposit" ? "text-green-400" : "text-orange-400"}>*</span>
                <p>
                  {activeTab === "deposit"
                    ? "Deposit tokens from your wallet into ShadowWire to make private payments. You'll need to sign a transaction."
                    : "Withdraw tokens from ShadowWire back to your wallet. You'll need to sign a transaction."}
                </p>
              </div>
            </div>

            {/* Action Button */}
            <button
              type="button"
              onClick={activeTab === "deposit" ? handleDeposit : handleWithdraw}
              disabled={loading || !amount}
              className={`w-full py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                activeTab === "deposit"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-orange-600 hover:bg-orange-700 text-white"
              }`}
            >
              {loading
                ? "Processing..."
                : activeTab === "deposit"
                ? "Deposit to ShadowWire"
                : "Withdraw from ShadowWire"}
            </button>
          </div>
        )}

        {/* Send Tab Content */}
        {activeTab === "send" && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Token Selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Token</label>
            <select
              value={token}
              onChange={(e) => setToken(e.target.value as SupportedToken)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
            >
              {SUPPORTED_TOKENS.map((t) => (
                <option key={t.symbol} value={t.symbol}>
                  {t.symbol} - {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Amount</label>
            <div className="relative">
              <input
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                {token}
              </span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-500">
                Balance: {formatAmount(balance, token)} {token}
              </span>
              <button
                type="button"
                onClick={() => setAmount(balance.toString())}
                className="text-xs text-purple-400 hover:text-purple-300"
              >
                Max
              </button>
            </div>
          </div>

          {/* Recipient Input */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Recipient</label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Solana wallet address"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-mono text-sm"
            />
          </div>

          {/* Transfer Type */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Transfer Type</label>
            <div className="flex space-x-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="transferType"
                  value="internal"
                  checked={transferType === "internal"}
                  onChange={() => setTransferType("internal")}
                  className="text-purple-500"
                />
                <div>
                  <span className="text-white">Internal</span>
                  <p className="text-xs text-gray-500">Both users on ShadowWire</p>
                </div>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="transferType"
                  value="external"
                  checked={transferType === "external"}
                  onChange={() => setTransferType("external")}
                  className="text-purple-500"
                />
                <div>
                  <span className="text-white">External</span>
                  <p className="text-xs text-gray-500">Any Solana wallet</p>
                </div>
              </label>
            </div>
          </div>

          {/* Privacy Note */}
          <div className="bg-gray-900/50 rounded-lg p-3 text-xs text-gray-400">
            <div className="flex items-start space-x-2">
              <span className="text-purple-400">*</span>
              <p>
                {transferType === "internal"
                  ? "Internal transfers hide the payment amount using zero-knowledge proofs. Both sender and recipient must have ShadowWire accounts."
                  : "External transfers send to any Solana wallet. The amount is visible but your identity remains anonymous."}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !amount || !recipient}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Processing..." : "Attach Payment"}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}

export default PaymentModal;

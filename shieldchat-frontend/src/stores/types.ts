import { PublicKey } from "@solana/web3.js";

// ============================================
// Base Types (imported from existing codebase)
// ============================================

export interface ChannelAccount {
  channelId: number[];
  owner: PublicKey;
  encryptedMetadata: number[];
  channelType: { directMessage?: {} } | { privateGroup?: {} } | { tokenGated?: {} } | { public?: {} };
  memberCount: number;
  messageCount: bigint;
  createdAt: bigint;
  isActive: boolean;
  requiredTokenMint: PublicKey | null;
  minTokenAmount: bigint | null;
  vault: PublicKey | null;
}

export interface Channel {
  publicKey: PublicKey;
  account: ChannelAccount;
}

export interface MemberAccount {
  channel: PublicKey;
  wallet: PublicKey;
  joinedAt: bigint;
  isActive: boolean;
}

export interface Member {
  publicKey: PublicKey;
  account: MemberAccount;
}

export interface ChatMessage {
  id: string;
  content: string;
  sender: string;
  timestamp: string;
  txSignature?: string;
  payment?: PaymentAttachment;
  pollResult?: PollResultAttachment;
  game?: GameAttachment;
}

export interface PaymentAttachment {
  amount: number;
  token: "SOL" | "USDC" | "BONK" | "RADR";
  recipient: string;
  type: "public" | "private";
  txSignature?: string;
  status: "pending" | "completed" | "failed";
}

export interface PollResultAttachment {
  pollId: string;
  question: string;
  options: Array<{ text: string; votes: number }>;
  totalVotes: number;
  creator: string;
  revealedAt: string;
}

export interface GameAttachment {
  gameId: string;
  gameType: "tictactoe";
  state: "waiting" | "in_progress" | "x_wins" | "o_wins" | "draw" | "cancelled";
  playerX: string;
  playerO?: string;
  winner?: string;
  wager: number;
  createdAt: string;
  board?: number[];
}

export interface PollAccount {
  channel: PublicKey;
  creator: PublicKey;
  question: string;
  options: string[];
  optionsCount: number;
  voteCounts: bigint[];
  totalVotes: bigint;
  endTime: bigint;
  revealed: boolean;
  revealedCounts: bigint[];
}

export interface PollWithPda {
  pda: PublicKey;
  account: PollAccount;
}

export interface TicTacToeGame {
  pubkey: PublicKey;
  channel: PublicKey;
  playerX: PublicKey;
  playerO: PublicKey | null;
  board: number[];
  currentTurn: number; // 1 = X, 2 = O
  state: number; // 0 = waiting, 1 = in_progress, 2 = x_wins, 3 = o_wins, 4 = draw, 5 = cancelled
  wager: bigint;
  createdAt: bigint;
}

export interface PresenceData {
  typingUsers: string[];
  onlineUsers: string[];
  readReceipts: Map<string, number>;
}

// ============================================
// Store Slice Types
// ============================================

export interface UserState {
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
}

export interface ChannelsState {
  list: Channel[];
  activeChannelId: string | null;
  activeChannel: Channel | null;
  membership: Map<string, Member | null>;
  loading: boolean;
  error: string | null;
}

export interface MessagesState {
  byChannel: Map<string, ChatMessage[]>;
  loading: Map<string, boolean>;
  lastFetchTime: Map<string, number>;
}

export interface PresenceState {
  byChannel: Map<string, PresenceData>;
}

export interface PaymentsState {
  pendingPayment: PaymentAttachment | null;
  loading: boolean;
  error: string | null;
}

export interface VotingState {
  pollsByChannel: Map<string, PollWithPda[]>;
  votedPolls: Set<string>;
  loading: boolean;
}

export interface GamesState {
  ticTacToeByChannel: Map<string, TicTacToeGame[]>;
  activeGame: TicTacToeGame | null;
  loading: boolean;
}

export interface RealtimeState {
  heliusConnected: boolean;
  presenceConnected: boolean;
  subscriptions: Map<string, () => void>;
}

export type ModalType =
  | "create-channel"
  | "invite"
  | "leave"
  | "payment"
  | "poll"
  | "games"
  | null;

export interface UIState {
  sidebarOpen: boolean;
  activeModal: ModalType;
  modalProps: Record<string, unknown>;
}

// ============================================
// Combined Store Type
// ============================================

export interface ShieldChatStore {
  // State
  user: UserState;
  channels: ChannelsState;
  messages: MessagesState;
  presence: PresenceState;
  payments: PaymentsState;
  voting: VotingState;
  games: GamesState;
  realtime: RealtimeState;
  ui: UIState;

  // User Actions
  setUser: (publicKey: PublicKey | null, connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;

  // Channel Actions
  setChannels: (channels: Channel[]) => void;
  setActiveChannel: (channelId: string | null) => void;
  addChannel: (channel: Channel) => void;
  updateChannel: (channelId: string, updates: Partial<ChannelAccount>) => void;
  setMembership: (channelId: string, member: Member | null) => void;
  setChannelsLoading: (loading: boolean) => void;
  setChannelsError: (error: string | null) => void;

  // Message Actions
  setMessages: (channelId: string, messages: ChatMessage[]) => void;
  addMessage: (channelId: string, message: ChatMessage) => void;
  setMessagesLoading: (channelId: string, loading: boolean) => void;
  clearMessages: (channelId: string) => void;

  // Presence Actions
  setPresence: (channelId: string, presence: PresenceData) => void;
  updateTypingUsers: (channelId: string, users: string[]) => void;
  updateOnlineUsers: (channelId: string, users: string[]) => void;
  updateReadReceipt: (channelId: string, wallet: string, messageIndex: number) => void;

  // Payment Actions
  setPendingPayment: (payment: PaymentAttachment | null) => void;
  setPaymentsLoading: (loading: boolean) => void;
  setPaymentsError: (error: string | null) => void;

  // Voting Actions
  setPolls: (channelId: string, polls: PollWithPda[]) => void;
  addPoll: (channelId: string, poll: PollWithPda) => void;
  markPollVoted: (pollId: string) => void;
  setVotingLoading: (loading: boolean) => void;

  // Games Actions
  setGames: (channelId: string, games: TicTacToeGame[]) => void;
  setActiveGame: (game: TicTacToeGame | null) => void;
  updateGame: (channelId: string, gameId: string, updates: Partial<TicTacToeGame>) => void;
  setGamesLoading: (loading: boolean) => void;

  // Realtime Actions
  setHeliusConnected: (connected: boolean) => void;
  setPresenceConnected: (connected: boolean) => void;
  addSubscription: (channelId: string, cleanup: () => void) => void;
  removeSubscription: (channelId: string) => void;
  cleanupAllSubscriptions: () => void;

  // UI Actions
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  openModal: (modal: ModalType, props?: Record<string, unknown>) => void;
  closeModal: () => void;
}

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { devtools } from "zustand/middleware";
import { PublicKey } from "@solana/web3.js";
import {
  ShieldChatStore,
  Channel,
  ChannelAccount,
  Member,
  ChatMessage,
  PresenceData,
  PaymentAttachment,
  PollWithPda,
  TicTacToeGame,
  ModalType,
} from "./types";

// Initial state values
const initialState = {
  user: {
    publicKey: null,
    connected: false,
    connecting: false,
  },
  channels: {
    list: [],
    activeChannelId: null,
    activeChannel: null,
    membership: new Map<string, Member | null>(),
    loading: false,
    error: null,
  },
  messages: {
    byChannel: new Map<string, ChatMessage[]>(),
    loading: new Map<string, boolean>(),
    lastFetchTime: new Map<string, number>(),
  },
  presence: {
    byChannel: new Map<string, PresenceData>(),
  },
  payments: {
    pendingPayment: null,
    loading: false,
    error: null,
  },
  voting: {
    pollsByChannel: new Map<string, PollWithPda[]>(),
    votedPolls: new Set<string>(),
    loading: false,
  },
  games: {
    ticTacToeByChannel: new Map<string, TicTacToeGame[]>(),
    activeGame: null,
    loading: false,
  },
  realtime: {
    heliusConnected: false,
    presenceConnected: false,
    subscriptions: new Map<string, () => void>(),
  },
  ui: {
    sidebarOpen: false,
    activeModal: null as ModalType,
    modalProps: {},
  },
};

export const useStore = create<ShieldChatStore>()(
  devtools(
    immer((set, get) => ({
      // ============================================
      // Initial State
      // ============================================
      ...initialState,

      // ============================================
      // User Actions
      // ============================================
      setUser: (publicKey: PublicKey | null, connected: boolean) =>
        set((state) => {
          state.user.publicKey = publicKey;
          state.user.connected = connected;
          state.user.connecting = false;
        }),

      setConnecting: (connecting: boolean) =>
        set((state) => {
          state.user.connecting = connecting;
        }),

      // ============================================
      // Channel Actions
      // ============================================
      setChannels: (channels: Channel[]) =>
        set((state) => {
          state.channels.list = channels;
          // Update active channel if it's in the new list
          if (state.channels.activeChannelId) {
            const active = channels.find(
              (c) => c.publicKey.toString() === state.channels.activeChannelId
            );
            state.channels.activeChannel = active || null;
          }
        }),

      setActiveChannel: (channelId: string | null) =>
        set((state) => {
          state.channels.activeChannelId = channelId;
          if (channelId) {
            const channel = state.channels.list.find(
              (c) => c.publicKey.toString() === channelId
            );
            state.channels.activeChannel = channel || null;
          } else {
            state.channels.activeChannel = null;
          }
        }),

      addChannel: (channel: Channel) =>
        set((state) => {
          // Check if channel already exists
          const exists = state.channels.list.some(
            (c) => c.publicKey.toString() === channel.publicKey.toString()
          );
          if (!exists) {
            state.channels.list.push(channel);
          }
        }),

      updateChannel: (channelId: string, updates: Partial<ChannelAccount>) =>
        set((state) => {
          const index = state.channels.list.findIndex(
            (c) => c.publicKey.toString() === channelId
          );
          if (index !== -1) {
            state.channels.list[index].account = {
              ...state.channels.list[index].account,
              ...updates,
            };
            // Update active channel if it's the one being modified
            if (state.channels.activeChannelId === channelId) {
              state.channels.activeChannel = state.channels.list[index];
            }
          }
        }),

      setMembership: (channelId: string, member: Member | null) =>
        set((state) => {
          state.channels.membership.set(channelId, member);
        }),

      setChannelsLoading: (loading: boolean) =>
        set((state) => {
          state.channels.loading = loading;
        }),

      setChannelsError: (error: string | null) =>
        set((state) => {
          state.channels.error = error;
        }),

      // ============================================
      // Message Actions
      // ============================================
      setMessages: (channelId: string, messages: ChatMessage[]) =>
        set((state) => {
          state.messages.byChannel.set(channelId, messages);
          state.messages.lastFetchTime.set(channelId, Date.now());
        }),

      addMessage: (channelId: string, message: ChatMessage) =>
        set((state) => {
          const existing = state.messages.byChannel.get(channelId) || [];
          // Check if message already exists
          const messageExists = existing.some((m) => m.id === message.id);
          if (!messageExists) {
            state.messages.byChannel.set(channelId, [...existing, message]);
          }
        }),

      setMessagesLoading: (channelId: string, loading: boolean) =>
        set((state) => {
          state.messages.loading.set(channelId, loading);
        }),

      clearMessages: (channelId: string) =>
        set((state) => {
          state.messages.byChannel.delete(channelId);
          state.messages.loading.delete(channelId);
          state.messages.lastFetchTime.delete(channelId);
        }),

      // ============================================
      // Presence Actions
      // ============================================
      setPresence: (channelId: string, presence: PresenceData) =>
        set((state) => {
          state.presence.byChannel.set(channelId, presence);
        }),

      updateTypingUsers: (channelId: string, users: string[]) =>
        set((state) => {
          const existing = state.presence.byChannel.get(channelId) || {
            typingUsers: [],
            onlineUsers: [],
            readReceipts: new Map(),
          };
          state.presence.byChannel.set(channelId, {
            ...existing,
            typingUsers: users,
          });
        }),

      updateOnlineUsers: (channelId: string, users: string[]) =>
        set((state) => {
          const existing = state.presence.byChannel.get(channelId) || {
            typingUsers: [],
            onlineUsers: [],
            readReceipts: new Map(),
          };
          state.presence.byChannel.set(channelId, {
            ...existing,
            onlineUsers: users,
          });
        }),

      updateReadReceipt: (channelId: string, wallet: string, messageIndex: number) =>
        set((state) => {
          const existing = state.presence.byChannel.get(channelId) || {
            typingUsers: [],
            onlineUsers: [],
            readReceipts: new Map(),
          };
          const newReceipts = new Map(existing.readReceipts);
          newReceipts.set(wallet, messageIndex);
          state.presence.byChannel.set(channelId, {
            ...existing,
            readReceipts: newReceipts,
          });
        }),

      // ============================================
      // Payment Actions
      // ============================================
      setPendingPayment: (payment: PaymentAttachment | null) =>
        set((state) => {
          state.payments.pendingPayment = payment;
        }),

      setPaymentsLoading: (loading: boolean) =>
        set((state) => {
          state.payments.loading = loading;
        }),

      setPaymentsError: (error: string | null) =>
        set((state) => {
          state.payments.error = error;
        }),

      // ============================================
      // Voting Actions
      // ============================================
      setPolls: (channelId: string, polls: PollWithPda[]) =>
        set((state) => {
          state.voting.pollsByChannel.set(channelId, polls);
        }),

      addPoll: (channelId: string, poll: PollWithPda) =>
        set((state) => {
          const existing = state.voting.pollsByChannel.get(channelId) || [];
          const pollExists = existing.some(
            (p) => p.pda.toString() === poll.pda.toString()
          );
          if (!pollExists) {
            state.voting.pollsByChannel.set(channelId, [...existing, poll]);
          }
        }),

      markPollVoted: (pollId: string) =>
        set((state) => {
          state.voting.votedPolls.add(pollId);
        }),

      setVotingLoading: (loading: boolean) =>
        set((state) => {
          state.voting.loading = loading;
        }),

      // ============================================
      // Games Actions
      // ============================================
      setGames: (channelId: string, games: TicTacToeGame[]) =>
        set((state) => {
          state.games.ticTacToeByChannel.set(channelId, games);
        }),

      setActiveGame: (game: TicTacToeGame | null) =>
        set((state) => {
          state.games.activeGame = game;
        }),

      updateGame: (channelId: string, gameId: string, updates: Partial<TicTacToeGame>) =>
        set((state) => {
          const games = state.games.ticTacToeByChannel.get(channelId) || [];
          const index = games.findIndex((g) => g.pubkey.toString() === gameId);
          if (index !== -1) {
            games[index] = { ...games[index], ...updates };
            state.games.ticTacToeByChannel.set(channelId, games);
            // Update active game if it's the one being modified
            if (state.games.activeGame?.pubkey.toString() === gameId) {
              state.games.activeGame = games[index];
            }
          }
        }),

      setGamesLoading: (loading: boolean) =>
        set((state) => {
          state.games.loading = loading;
        }),

      // ============================================
      // Realtime Actions
      // ============================================
      setHeliusConnected: (connected: boolean) =>
        set((state) => {
          state.realtime.heliusConnected = connected;
        }),

      setPresenceConnected: (connected: boolean) =>
        set((state) => {
          state.realtime.presenceConnected = connected;
        }),

      addSubscription: (channelId: string, cleanup: () => void) =>
        set((state) => {
          // Clean up existing subscription first
          const existing = state.realtime.subscriptions.get(channelId);
          if (existing) {
            existing();
          }
          state.realtime.subscriptions.set(channelId, cleanup);
        }),

      removeSubscription: (channelId: string) =>
        set((state) => {
          const cleanup = state.realtime.subscriptions.get(channelId);
          if (cleanup) {
            cleanup();
            state.realtime.subscriptions.delete(channelId);
          }
        }),

      cleanupAllSubscriptions: () =>
        set((state) => {
          state.realtime.subscriptions.forEach((cleanup) => cleanup());
          state.realtime.subscriptions.clear();
        }),

      // ============================================
      // UI Actions
      // ============================================
      setSidebarOpen: (open: boolean) =>
        set((state) => {
          state.ui.sidebarOpen = open;
        }),

      toggleSidebar: () =>
        set((state) => {
          state.ui.sidebarOpen = !state.ui.sidebarOpen;
        }),

      openModal: (modal: ModalType, props: Record<string, unknown> = {}) =>
        set((state) => {
          state.ui.activeModal = modal;
          state.ui.modalProps = props;
        }),

      closeModal: () =>
        set((state) => {
          state.ui.activeModal = null;
          state.ui.modalProps = {};
        }),
    })),
    { name: "ShieldChatStore" }
  )
);

// ============================================
// Selector Hooks
// ============================================

// User selectors
export const useUser = () => useStore((state) => state.user);
export const usePublicKey = () => useStore((state) => state.user.publicKey);
export const useIsConnected = () => useStore((state) => state.user.connected);

// Channel selectors
export const useChannels = () => useStore((state) => state.channels.list);
export const useActiveChannel = () => useStore((state) => state.channels.activeChannel);
export const useActiveChannelId = () => useStore((state) => state.channels.activeChannelId);
export const useChannelMembership = (channelId: string) =>
  useStore((state) => state.channels.membership.get(channelId));
export const useChannelsLoading = () => useStore((state) => state.channels.loading);

// Message selectors
export const useMessages = (channelId: string) =>
  useStore((state) => state.messages.byChannel.get(channelId) || []);
export const useMessagesLoading = (channelId: string) =>
  useStore((state) => state.messages.loading.get(channelId) || false);

// Presence selectors
export const usePresence = (channelId: string) =>
  useStore((state) => state.presence.byChannel.get(channelId));
export const useTypingUsers = (channelId: string) =>
  useStore((state) => state.presence.byChannel.get(channelId)?.typingUsers || []);
export const useOnlineUsers = (channelId: string) =>
  useStore((state) => state.presence.byChannel.get(channelId)?.onlineUsers || []);

// Payment selectors
export const usePendingPayment = () => useStore((state) => state.payments.pendingPayment);

// Voting selectors
export const usePolls = (channelId: string) =>
  useStore((state) => state.voting.pollsByChannel.get(channelId) || []);
export const useHasVoted = (pollId: string) =>
  useStore((state) => state.voting.votedPolls.has(pollId));

// Games selectors
export const useGames = (channelId: string) =>
  useStore((state) => state.games.ticTacToeByChannel.get(channelId) || []);
export const useActiveGame = () => useStore((state) => state.games.activeGame);

// Realtime selectors
export const useHeliusConnected = () => useStore((state) => state.realtime.heliusConnected);
export const usePresenceConnected = () => useStore((state) => state.realtime.presenceConnected);

// UI selectors
export const useSidebarOpen = () => useStore((state) => state.ui.sidebarOpen);
export const useActiveModal = () => useStore((state) => state.ui.activeModal);
export const useModalProps = () => useStore((state) => state.ui.modalProps);

// Action hooks
export const useStoreActions = () =>
  useStore((state) => ({
    // User
    setUser: state.setUser,
    setConnecting: state.setConnecting,
    // Channels
    setChannels: state.setChannels,
    setActiveChannel: state.setActiveChannel,
    addChannel: state.addChannel,
    updateChannel: state.updateChannel,
    setMembership: state.setMembership,
    setChannelsLoading: state.setChannelsLoading,
    setChannelsError: state.setChannelsError,
    // Messages
    setMessages: state.setMessages,
    addMessage: state.addMessage,
    setMessagesLoading: state.setMessagesLoading,
    clearMessages: state.clearMessages,
    // Presence
    setPresence: state.setPresence,
    updateTypingUsers: state.updateTypingUsers,
    updateOnlineUsers: state.updateOnlineUsers,
    updateReadReceipt: state.updateReadReceipt,
    // Payments
    setPendingPayment: state.setPendingPayment,
    setPaymentsLoading: state.setPaymentsLoading,
    setPaymentsError: state.setPaymentsError,
    // Voting
    setPolls: state.setPolls,
    addPoll: state.addPoll,
    markPollVoted: state.markPollVoted,
    setVotingLoading: state.setVotingLoading,
    // Games
    setGames: state.setGames,
    setActiveGame: state.setActiveGame,
    updateGame: state.updateGame,
    setGamesLoading: state.setGamesLoading,
    // Realtime
    setHeliusConnected: state.setHeliusConnected,
    setPresenceConnected: state.setPresenceConnected,
    addSubscription: state.addSubscription,
    removeSubscription: state.removeSubscription,
    cleanupAllSubscriptions: state.cleanupAllSubscriptions,
    // UI
    setSidebarOpen: state.setSidebarOpen,
    toggleSidebar: state.toggleSidebar,
    openModal: state.openModal,
    closeModal: state.closeModal,
  }));

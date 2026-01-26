"use client";

/**
 * Notification Context for ShieldChat
 *
 * Provides a React context for managing browser notifications.
 * Handles permission requests, visibility tracking, and notification display.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  isTabVisible,
  showNotification,
  showMessageNotification,
  showGameNotification,
} from "@/lib/notifications";

interface NotificationContextType {
  /** Whether notifications are supported in this browser */
  isSupported: boolean;
  /** Current permission status */
  permission: NotificationPermission | "unsupported";
  /** Whether permission has been granted */
  permissionGranted: boolean;
  /** Request notification permission from user */
  requestPermission: () => Promise<boolean>;
  /** Show a generic notification (only if tab is hidden) */
  notify: (title: string, body: string, onClick?: () => void) => void;
  /** Show a message notification */
  notifyMessage: (channelName: string, senderName?: string) => void;
  /** Show a game notification */
  notifyGame: (gameType: string, message: string) => void;
  /** Check if tab is currently visible */
  isVisible: boolean;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [isVisible, setIsVisible] = useState(true);
  const [isSupported, setIsSupported] = useState(false); // Start false for SSR
  const permissionGranted = permission === "granted";

  // Initialize support check and permission status after hydration
  useEffect(() => {
    setIsSupported(isNotificationSupported());
    setPermission(getNotificationPermission());
  }, []);

  // Track tab visibility
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === "visible");
    };

    // Set initial state
    setIsVisible(document.visibilityState === "visible");

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Request permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    const granted = await requestNotificationPermission();
    setPermission(getNotificationPermission());
    return granted;
  }, []);

  // Show generic notification
  const notify = useCallback(
    (title: string, body: string, onClick?: () => void) => {
      showNotification(title, { body, onClick });
    },
    []
  );

  // Show message notification
  const notifyMessage = useCallback(
    (channelName: string, senderName?: string) => {
      showMessageNotification(channelName, senderName);
    },
    []
  );

  // Show game notification
  const notifyGame = useCallback((gameType: string, message: string) => {
    showGameNotification(gameType, message);
  }, []);

  const value: NotificationContextType = {
    isSupported,
    permission,
    permissionGranted,
    requestPermission,
    notify,
    notifyMessage,
    notifyGame,
    isVisible,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

/**
 * Hook to access notification context
 */
export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}

/**
 * Hook that provides a simple notify function with auto-permission request
 * Use this in components that need to send notifications
 */
export function useNotify() {
  const { permissionGranted, requestPermission, notify, notifyMessage, notifyGame, isVisible } =
    useNotifications();

  const ensurePermissionAndNotify = useCallback(
    async (title: string, body: string, onClick?: () => void) => {
      // If tab is visible, don't notify
      if (isVisible) return;

      // Request permission if not granted
      if (!permissionGranted) {
        const granted = await requestPermission();
        if (!granted) return;
      }

      notify(title, body, onClick);
    },
    [permissionGranted, requestPermission, notify, isVisible]
  );

  const ensurePermissionAndNotifyMessage = useCallback(
    async (channelName: string, senderName?: string) => {
      if (isVisible) return;

      if (!permissionGranted) {
        const granted = await requestPermission();
        if (!granted) return;
      }

      notifyMessage(channelName, senderName);
    },
    [permissionGranted, requestPermission, notifyMessage, isVisible]
  );

  const ensurePermissionAndNotifyGame = useCallback(
    async (gameType: string, message: string) => {
      if (isVisible) return;

      if (!permissionGranted) {
        const granted = await requestPermission();
        if (!granted) return;
      }

      notifyGame(gameType, message);
    },
    [permissionGranted, requestPermission, notifyGame, isVisible]
  );

  return {
    notify: ensurePermissionAndNotify,
    notifyMessage: ensurePermissionAndNotifyMessage,
    notifyGame: ensurePermissionAndNotifyGame,
    isVisible,
  };
}

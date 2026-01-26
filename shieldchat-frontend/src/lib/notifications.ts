/**
 * Browser Notifications Utility for ShieldChat
 *
 * Provides functions to:
 * - Request notification permission
 * - Check if tab is visible
 * - Show native browser notifications
 */

/**
 * Check if browser supports notifications
 */
export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) {
    return "unsupported";
  }
  return Notification.permission;
}

/**
 * Request notification permission from user
 * Returns true if permission granted, false otherwise
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) {
    console.warn("[Notifications] Not supported in this browser");
    return false;
  }

  // Already granted
  if (Notification.permission === "granted") {
    return true;
  }

  // Already denied - can't ask again
  if (Notification.permission === "denied") {
    console.warn("[Notifications] Permission was denied by user");
    return false;
  }

  // Ask for permission
  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch (err) {
    console.error("[Notifications] Error requesting permission:", err);
    return false;
  }
}

/**
 * Check if the current tab/window is visible
 */
export function isTabVisible(): boolean {
  if (typeof document === "undefined") {
    return true; // SSR - assume visible
  }
  return document.visibilityState === "visible";
}

/**
 * Show a browser notification
 * Only shows if permission is granted and tab is hidden
 *
 * @param title - Notification title
 * @param options - Notification options (body, icon, etc.)
 * @returns The notification instance, or null if not shown
 */
export function showNotification(
  title: string,
  options?: NotificationOptions & { onClick?: () => void }
): Notification | null {
  // Don't show if not supported or no permission
  if (!isNotificationSupported() || Notification.permission !== "granted") {
    return null;
  }

  // Don't show if tab is visible (user is already looking)
  if (isTabVisible()) {
    return null;
  }

  try {
    const { onClick, ...notificationOptions } = options || {};

    const notification = new Notification(title, {
      // No icon specified - browser will use default
      ...notificationOptions,
    });

    // Handle click - focus the window/tab
    notification.onclick = () => {
      window.focus();
      notification.close();
      onClick?.();
    };

    // Auto-close after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);

    return notification;
  } catch (err) {
    console.error("[Notifications] Error showing notification:", err);
    return null;
  }
}

/**
 * Show a message notification
 */
export function showMessageNotification(
  channelName: string,
  senderName?: string
): Notification | null {
  const body = senderName
    ? `${senderName} sent a message`
    : "New message received";

  return showNotification(`${channelName}`, {
    body,
    tag: `message-${channelName}`,
  });
}

/**
 * Show a game notification
 */
export function showGameNotification(
  gameType: string,
  message: string
): Notification | null {
  return showNotification(gameType, {
    body: message,
    tag: `game-${gameType}`,
  });
}

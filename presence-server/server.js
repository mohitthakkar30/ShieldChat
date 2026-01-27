/**
 * ShieldChat Presence Server
 *
 * Simple WebSocket server for real-time presence synchronization.
 * Handles typing indicators, online status, and read receipts.
 *
 * In production, this would be replaced by MagicBlock's TEE-protected
 * ephemeral rollups for true privacy.
 */

import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

const PORT = process.env.PORT || 3001;

// Create HTTP server with health check endpoint
const httpServer = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "presence-server" }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server: httpServer });

// Start HTTP server
httpServer.listen(PORT);

// Presence state: channelId -> Map<wallet, presence>
const presenceByChannel = new Map();

// Connected clients: ws -> { wallet, channels: Set<channelId> }
const clients = new Map();

// Cleanup interval (30 seconds)
const CLEANUP_INTERVAL = 30000;
const PRESENCE_TTL = 30000; // 30 seconds

console.log(`ShieldChat Presence Server running on ws://localhost:${PORT}`);

/**
 * Broadcast presence update to all clients subscribed to a channel
 */
function broadcastToChannel(channelId, excludeWs = null) {
  const channelPresence = presenceByChannel.get(channelId);
  if (!channelPresence) return;

  const presences = Array.from(channelPresence.values());

  const message = JSON.stringify({
    type: "presence_update",
    channelId,
    presences,
  });

  for (const [ws, clientInfo] of clients) {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN && clientInfo.channels.has(channelId)) {
      ws.send(message);
    }
  }
}

/**
 * Handle incoming WebSocket connection
 */
wss.on("connection", (ws) => {

  // Initialize client info
  clients.set(ws, { wallet: null, channels: new Set() });

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(ws, message);
    } catch {
      // Ignore parse errors
    }
  });

  ws.on("close", () => {
    handleDisconnect(ws);
  });

  ws.on("error", () => {
    // Silently handle errors - will trigger close
  });
});

/**
 * Handle incoming message
 */
function handleMessage(ws, message) {
  const clientInfo = clients.get(ws);
  if (!clientInfo) return;

  switch (message.type) {
    case "identify":
      // Client identifies their wallet
      clientInfo.wallet = message.wallet;
      break;

    case "subscribe":
      // Subscribe to a channel's presence updates
      if (message.channelId) {
        clientInfo.channels.add(message.channelId);

        // Send current presence state
        const channelPresence = presenceByChannel.get(message.channelId);
        if (channelPresence) {
          ws.send(JSON.stringify({
            type: "presence_update",
            channelId: message.channelId,
            presences: Array.from(channelPresence.values()),
          }));
        }
      }
      break;

    case "unsubscribe":
      // Unsubscribe from a channel
      if (message.channelId) {
        clientInfo.channels.delete(message.channelId);
      }
      break;

    case "set_typing":
      // Update typing status
      if (clientInfo.wallet && message.channelId) {
        updatePresence(message.channelId, clientInfo.wallet, {
          isTyping: message.isTyping,
        });
        broadcastToChannel(message.channelId);
      }
      break;

    case "set_online":
      // Update online status
      if (clientInfo.wallet && message.channelId) {
        updatePresence(message.channelId, clientInfo.wallet, {
          isOnline: message.isOnline,
        });
        broadcastToChannel(message.channelId);
      }
      break;

    case "mark_read":
      // Mark message as read
      if (clientInfo.wallet && message.channelId && message.messageNumber !== undefined) {
        updatePresence(message.channelId, clientInfo.wallet, {
          lastReadMessage: message.messageNumber,
        });
        broadcastToChannel(message.channelId);
      }
      break;

    case "heartbeat":
      // Keep-alive - just update lastSeen, don't broadcast (saves memory/bandwidth)
      if (clientInfo.wallet) {
        for (const channelId of clientInfo.channels) {
          updatePresence(channelId, clientInfo.wallet, {
            isOnline: true,
          });
        }
      }
      break;

    default:
      // Ignore unknown message types
  }
}

/**
 * Update presence for a user in a channel
 */
function updatePresence(channelId, wallet, updates) {
  if (!presenceByChannel.has(channelId)) {
    presenceByChannel.set(channelId, new Map());
  }

  const channelPresence = presenceByChannel.get(channelId);
  const existing = channelPresence.get(wallet) || {
    wallet,
    channelId,
    isTyping: false,
    isOnline: true,
    lastSeen: Date.now(),
    lastReadMessage: 0,
  };

  const updated = {
    ...existing,
    ...updates,
    lastSeen: Date.now(),
  };

  channelPresence.set(wallet, updated);
}

/**
 * Handle client disconnect
 */
function handleDisconnect(ws) {
  const clientInfo = clients.get(ws);
  if (!clientInfo) return;

  // Set offline in all subscribed channels
  if (clientInfo.wallet) {
    for (const channelId of clientInfo.channels) {
      updatePresence(channelId, clientInfo.wallet, {
        isOnline: false,
        isTyping: false,
      });
      broadcastToChannel(channelId);
    }
  }

  clients.delete(ws);
}

/**
 * Cleanup stale presence entries
 */
function cleanupStalePresence() {
  const now = Date.now();

  for (const [channelId, channelPresence] of presenceByChannel) {
    let changed = false;

    for (const [wallet, presence] of channelPresence) {
      if (now - presence.lastSeen > PRESENCE_TTL) {
        channelPresence.delete(wallet);
        changed = true;
      }
    }

    // Remove empty channels
    if (channelPresence.size === 0) {
      presenceByChannel.delete(channelId);
    } else if (changed) {
      broadcastToChannel(channelId);
    }
  }
}

// Run cleanup periodically
setInterval(cleanupStalePresence, CLEANUP_INTERVAL);

// Handle process termination
process.on("SIGINT", () => {
  console.log("\nShutting down presence server...");
  wss.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

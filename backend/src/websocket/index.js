const { WebSocketServer, OPEN } = require('ws');
const { logger } = require('../middleware');

/*
 * Events the server can broadcast to connected clients.
 * Clients subscribe by sending: { type: 'subscribe', topics: ['did:created', ...] }
 */
const EVENTS = {
  DID_CREATED:          'did:created',
  DID_UPDATED:          'did:updated',
  CREDENTIAL_ISSUED:    'credential:issued',
  CREDENTIAL_REVOKED:   'credential:revoked',
  CONTRACT_DEPLOYED:    'contract:deployed',
};

class WebSocketManager {
  /**
   * @param {import('http').Server} httpServer  The existing HTTP server to attach to.
   *        Must be the same instance used by Express/Apollo — not a new one.
   */
  constructor(httpServer) {
    this.httpServer = httpServer;
    this.wss = null;

    // clientTopics: Map<ws.WebSocket, Set<string>>
    // Tracks which event topics each connected client is subscribed to.
    this.clientTopics = new Map();
  }

  /**
   * Attach the WebSocket server to the HTTP server and start handling connections.
   * Call this after httpServer is created but before it starts listening.
   */
  initialize() {
    // Attach to the existing HTTP server on the /ws path.
    // Using a path keeps WebSocket traffic separate from REST and GraphQL.
    this.wss = new WebSocketServer({
      server: this.httpServer,
      path: '/ws',
    });

    this.wss.on('connection', (ws, req) => {
      const clientIp = req.socket.remoteAddress;
      logger.info(`WebSocket client connected from ${clientIp}`);

      // Every new client starts with no subscriptions.
      this.clientTopics.set(ws, new Set());

      // Send a welcome message so the client knows the connection is live.
      this._send(ws, { type: 'connected', message: 'WebSocket connection established' });

      ws.on('message', (raw) => this._handleMessage(ws, raw));

      ws.on('close', () => {
        this.clientTopics.delete(ws);
        logger.info(`WebSocket client disconnected from ${clientIp}`);
      });

      ws.on('error', (err) => {
        logger.error(`WebSocket error from ${clientIp}:`, err.message);
        this.clientTopics.delete(ws);
      });
    });

    // Keep connections alive: ping every 30s, drop clients that don't pong back.
    this._startHeartbeat();

    logger.info('🔌 WebSocket server initialized on path /ws');
  }

  /**
   * Handle an incoming message from a client.
   * Supported message types:
   *   { type: 'subscribe',   topics: string[] }  — start receiving these events
   *   { type: 'unsubscribe', topics: string[] }  — stop receiving these events
   *   { type: 'ping' }                           — client-initiated keepalive
   */
  _handleMessage(ws, raw) {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return this._send(ws, { type: 'error', message: 'Invalid JSON' });
    }

    switch (message.type) {
      case 'subscribe': {
        const topics = this.clientTopics.get(ws);
        const requested = Array.isArray(message.topics) ? message.topics : [];
        const valid = Object.values(EVENTS);

        const accepted = [];
        const rejected = [];

        requested.forEach((t) => {
          if (valid.includes(t)) {
            topics.add(t);
            accepted.push(t);
          } else {
            rejected.push(t);
          }
        });

        this._send(ws, {
          type: 'subscribed',
          accepted,
          ...(rejected.length && { rejected, hint: `Valid topics: ${valid.join(', ')}` }),
        });
        break;
      }

      case 'unsubscribe': {
        const topics = this.clientTopics.get(ws);
        const requested = Array.isArray(message.topics) ? message.topics : [];
        requested.forEach((t) => topics.delete(t));
        this._send(ws, { type: 'unsubscribed', topics: requested });
        break;
      }

      case 'ping':
        this._send(ws, { type: 'pong', timestamp: Date.now() });
        break;

      default:
        this._send(ws, {
          type: 'error',
          message: `Unknown message type: ${message.type}`,
        });
    }
  }

  /**
   * Broadcast an event to all clients subscribed to its topic.
   *
   * @param {string} topic   One of the EVENTS constants, e.g. 'did:created'.
   * @param {object} payload Data to send alongside the event.
   *
   * @example
   *   wsManager.broadcast('did:created', { did: 'did:stellar:GABC...', owner: '...' });
   */
  broadcast(topic, payload) {
    if (!this.wss) return;

    const message = JSON.stringify({ type: 'event', topic, data: payload, timestamp: Date.now() });
    let delivered = 0;

    this.wss.clients.forEach((ws) => {
      if (ws.readyState !== OPEN) return;
      const topics = this.clientTopics.get(ws);
      if (topics?.has(topic)) {
        ws.send(message);
        delivered++;
      }
    });

    logger.info(`WebSocket broadcast [${topic}] → ${delivered} client(s)`);
  }

  /** Gracefully close all connections and stop the WebSocket server. */
  async close() {
    if (!this.wss) return;
    await new Promise((resolve) => this.wss.close(resolve));
    logger.info('🔌 WebSocket server closed');
  }

  /** @private Send a JSON message to a single client. */
  _send(ws, payload) {
    if (ws.readyState === OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  /**
   * @private
   * Ping all clients every 30 seconds. Clients that don't respond with a pong
   * within the next cycle are considered dead and terminated.
   */
  _startHeartbeat() {
    const INTERVAL_MS = 30_000;

    const interval = setInterval(() => {
      if (!this.wss) return clearInterval(interval);

      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          this.clientTopics.delete(ws);
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, INTERVAL_MS);

    // Mark clients alive when they respond to a ping.
    this.wss.on('connection', (ws) => {
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });
    });

    // Stop the heartbeat when the wss closes.
    this.wss.on('close', () => clearInterval(interval));
  }
}

module.exports = { WebSocketManager, EVENTS };
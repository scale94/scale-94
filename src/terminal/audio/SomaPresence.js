// SomaPresence.js — SOMA-9.4 // FEIGENBAUM_FADE // ARS ELECTRONICA 2027
//
// WebSocket-based multi-user presence engine for collaborative sphere visualization.
// Multiple visitors share the same 3D sphere, seeing each other's cursors and
// interactions (node fires, bifurcations, phase transitions) in real time.
//
// Usage:
//   import { somaPresence } from './SomaPresence';
//   somaPresence.connect('room-alpha', 'user-123');
//   somaPresence.sendCursor(x, y, z);
//   somaPresence.sendFire(nodeId);
//   somaPresence.sendBifurcate();
//   somaPresence.sendPhase(regime, r, lyapunov);
//   somaPresence.disconnect();

// ── Constants ─────────────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL  = 10_000;   // 10s keepalive
const STALE_PEER_TIMEOUT  = 30_000;   // 30s before peer cleanup
const CURSOR_THROTTLE_MS  = 66;       // ~15 fps
const FIRE_DEBOUNCE_MS    = 100;
const RECONNECT_BASE_MS   = 1_000;
const RECONNECT_MAX_MS    = 30_000;
const CLEANUP_INTERVAL    = 5_000;    // check for stale peers every 5s

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomHSL() {
  const h = Math.floor(Math.random() * 360);
  return `hsl(${h}, 70%, 60%)`;
}

function defaultServerURL() {
  try {
    if (typeof window !== 'undefined' && window.location && window.location.host) {
      return `wss://${window.location.host}/ws/soma`;
    }
  } catch (_) { /* ignore */ }
  return 'wss://localhost:8080/ws/soma';
}

// ── SomaPresenceEngine ───────────────────────────────────────────────────────

class SomaPresenceEngine {

  constructor() {
    // Connection state
    this._ws              = null;
    this._serverURL       = defaultServerURL();
    this._connected       = false;
    this._roomId          = null;
    this._userId          = null;
    this._color           = randomHSL();

    // Reconnect state
    this._reconnectDelay  = RECONNECT_BASE_MS;
    this._reconnectTimer  = null;
    this._intentionalClose = false;

    // Timers
    this._heartbeatTimer  = null;
    this._cleanupTimer    = null;

    // Peer tracking: userId → { color, cursor: {x,y,z}, lastFire, lastSeen }
    this._peers           = new Map();

    // Throttle / debounce state
    this._lastCursorSend  = 0;
    this._pendingCursor   = null;
    this._cursorTimer     = null;
    this._fireTimer       = null;
    this._pendingFire     = null;

    // Event callbacks — assign externally
    this.onPeerJoin       = null;  // (userId, color) => {}
    this.onPeerLeave      = null;  // (userId) => {}
    this.onPeerCursor     = null;  // (userId, x, y, z) => {}
    this.onPeerFire       = null;  // (userId, nodeId) => {}
    this.onPeerBifurcate  = null;  // (userId) => {}
    this.onPeerPhase      = null;  // (userId, regime, r, lyapunov) => {}
  }

  // ── Public properties ─────────────────────────────────────────────────────

  get connected()  { return this._connected; }
  get peerCount()  { return this._peers.size; }
  get peers()      { return this._peers; }
  get roomId()     { return this._roomId; }
  get userId()     { return this._userId; }

  // ── Connection management ─────────────────────────────────────────────────

  connect(roomId, userId, serverURL) {
    if (typeof WebSocket === 'undefined') return;   // graceful degradation

    this._roomId = roomId;
    this._userId = userId;
    if (serverURL) this._serverURL = serverURL;
    this._intentionalClose = false;
    this._reconnectDelay = RECONNECT_BASE_MS;

    this._openSocket();
  }

  disconnect() {
    this._intentionalClose = true;
    this._clearTimers();
    if (this._ws) {
      this._ws.close(1000, 'client disconnect');
      this._ws = null;
    }
    this._connected = false;
    this._peers.clear();
  }

  // ── Outgoing messages ─────────────────────────────────────────────────────

  /** Send 3D cursor position (throttled to ~15 fps). */
  sendCursor(x, y, z) {
    if (!this._connected) return;

    const now = performance.now();
    const elapsed = now - this._lastCursorSend;

    if (elapsed >= CURSOR_THROTTLE_MS) {
      this._lastCursorSend = now;
      this._sendJSON({ type: 'cursor', x, y, z });
    } else {
      // Schedule a trailing send so the final position always arrives
      this._pendingCursor = { x, y, z };
      if (!this._cursorTimer) {
        this._cursorTimer = setTimeout(() => {
          this._cursorTimer = null;
          if (this._pendingCursor && this._connected) {
            this._lastCursorSend = performance.now();
            this._sendJSON({ type: 'cursor', ...this._pendingCursor });
            this._pendingCursor = null;
          }
        }, CURSOR_THROTTLE_MS - elapsed);
      }
    }
  }

  /** Broadcast node activation (debounced 100ms). */
  sendFire(nodeId) {
    if (!this._connected) return;

    this._pendingFire = nodeId;
    if (this._fireTimer) clearTimeout(this._fireTimer);
    this._fireTimer = setTimeout(() => {
      this._fireTimer = null;
      if (this._pendingFire !== null && this._connected) {
        this._sendJSON({ type: 'fire', nodeId: this._pendingFire });
        this._pendingFire = null;
      }
    }, FIRE_DEBOUNCE_MS);
  }

  /** Broadcast bifurcation event. */
  sendBifurcate() {
    if (!this._connected) return;
    this._sendJSON({ type: 'bifurcate' });
  }

  /** Broadcast phase transition. */
  sendPhase(regime, r, lyapunov) {
    if (!this._connected) return;
    this._sendJSON({ type: 'phase', regime, r, lyapunov });
  }

  // ── Internal: socket lifecycle ────────────────────────────────────────────

  _openSocket() {
    try {
      this._ws = new WebSocket(this._serverURL);
    } catch (_) {
      // WebSocket constructor failed — server unreachable, degrade silently
      this._scheduleReconnect();
      return;
    }

    this._ws.onopen = () => {
      this._connected = true;
      this._reconnectDelay = RECONNECT_BASE_MS;

      // Join the room
      this._sendJSON({
        type: 'join',
        roomId: this._roomId,
        userId: this._userId,
        color:  this._color,
      });

      // Start heartbeat and stale-peer cleanup
      this._startHeartbeat();
      this._startCleanup();
    };

    this._ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._handleMessage(msg);
      } catch (_) { /* ignore malformed frames */ }
    };

    this._ws.onclose = () => {
      this._connected = false;
      this._clearTimers();
      if (!this._intentionalClose) {
        this._scheduleReconnect();
      }
    };

    this._ws.onerror = () => {
      // onerror is always followed by onclose — reconnect handled there
    };
  }

  _sendJSON(obj) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      try {
        this._ws.send(JSON.stringify(obj));
      } catch (_) { /* swallow send errors */ }
    }
  }

  // ── Internal: reconnect with exponential backoff ──────────────────────────

  _scheduleReconnect() {
    if (this._intentionalClose) return;
    if (this._reconnectTimer) return;

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._reconnectDelay = Math.min(this._reconnectDelay * 2, RECONNECT_MAX_MS);
      this._openSocket();
    }, this._reconnectDelay);
  }

  // ── Internal: heartbeat ───────────────────────────────────────────────────

  _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      this._sendJSON({ type: 'heartbeat' });
    }, HEARTBEAT_INTERVAL);
  }

  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  // ── Internal: stale peer cleanup ──────────────────────────────────────────

  _startCleanup() {
    this._stopCleanup();
    this._cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [uid, peer] of this._peers) {
        if (now - peer.lastSeen > STALE_PEER_TIMEOUT) {
          this._peers.delete(uid);
          if (this.onPeerLeave) this.onPeerLeave(uid);
        }
      }
    }, CLEANUP_INTERVAL);
  }

  _stopCleanup() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
  }

  // ── Internal: clear all timers ────────────────────────────────────────────

  _clearTimers() {
    this._stopHeartbeat();
    this._stopCleanup();
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._cursorTimer) {
      clearTimeout(this._cursorTimer);
      this._cursorTimer = null;
    }
    if (this._fireTimer) {
      clearTimeout(this._fireTimer);
      this._fireTimer = null;
    }
  }

  // ── Internal: incoming message dispatch ───────────────────────────────────

  _handleMessage(msg) {
    switch (msg.type) {

      case 'peers':
        this._handlePeers(msg.peers || []);
        break;

      case 'cursor':
        this._touchPeer(msg.userId);
        this._updatePeerField(msg.userId, 'cursor', { x: msg.x, y: msg.y, z: msg.z });
        if (this.onPeerCursor) this.onPeerCursor(msg.userId, msg.x, msg.y, msg.z);
        break;

      case 'fire':
        this._touchPeer(msg.userId);
        this._updatePeerField(msg.userId, 'lastFire', msg.nodeId);
        if (this.onPeerFire) this.onPeerFire(msg.userId, msg.nodeId);
        break;

      case 'bifurcate':
        this._touchPeer(msg.userId);
        if (this.onPeerBifurcate) this.onPeerBifurcate(msg.userId);
        break;

      case 'phase':
        this._touchPeer(msg.userId);
        if (this.onPeerPhase) this.onPeerPhase(msg.userId, msg.regime, msg.r, msg.lyapunov);
        break;

      case 'leave':
        this._peers.delete(msg.userId);
        if (this.onPeerLeave) this.onPeerLeave(msg.userId);
        break;

      default:
        // Unknown message type — ignore
        break;
    }
  }

  /** Handle full peer list from server (sent on join / periodic sync). */
  _handlePeers(peerList) {
    const seen = new Set();

    for (const p of peerList) {
      if (p.userId === this._userId) continue;   // skip self
      seen.add(p.userId);

      const existing = this._peers.get(p.userId);
      if (!existing) {
        // New peer
        this._peers.set(p.userId, {
          color:    p.color,
          cursor:   p.cursor || { x: 0, y: 0, z: 0 },
          lastFire: null,
          lastSeen: p.lastSeen || Date.now(),
        });
        if (this.onPeerJoin) this.onPeerJoin(p.userId, p.color);
      } else {
        // Update existing peer
        existing.color    = p.color;
        existing.cursor   = p.cursor || existing.cursor;
        existing.lastSeen = p.lastSeen || Date.now();
      }
    }

    // Remove peers not in the latest list
    for (const uid of this._peers.keys()) {
      if (!seen.has(uid)) {
        this._peers.delete(uid);
        if (this.onPeerLeave) this.onPeerLeave(uid);
      }
    }
  }

  /** Update lastSeen timestamp for a peer, creating a stub if unknown. */
  _touchPeer(userId) {
    if (!userId || userId === this._userId) return;
    const peer = this._peers.get(userId);
    if (peer) {
      peer.lastSeen = Date.now();
    } else {
      this._peers.set(userId, {
        color:    'hsl(0, 0%, 60%)',
        cursor:   { x: 0, y: 0, z: 0 },
        lastFire: null,
        lastSeen: Date.now(),
      });
      if (this.onPeerJoin) this.onPeerJoin(userId, 'hsl(0, 0%, 60%)');
    }
  }

  /** Set a single field on an existing peer record. */
  _updatePeerField(userId, field, value) {
    const peer = this._peers.get(userId);
    if (peer) peer[field] = value;
  }
}

// Singleton — shared across all components
export const somaPresence = new SomaPresenceEngine();
export default somaPresence;

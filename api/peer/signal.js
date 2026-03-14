// api/peer/signal.js — SOMA-9.4 P2P WebRTC Signaling Relay
// POST /api/peer/signal          → send a signal { to, from, type, data }
// GET  /api/peer/signal?to=<id>  → consume all pending messages for <id>
//
// Supported signal types: offer | answer | ice
//
// State: module-level message queues, TTL 30 s.
// Messages are consumed on GET (single delivery), matching WebRTC semantics.
//
// SOMA-9.4 · FADE_DOCTRINE · P2P SOVEREIGNTY LAYER

const queue  = new Map();   // peerId → [{from, type, data, ts}]
const TTL_MS = 30_000;      // 30 s message TTL

function cleanup() {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, msgs] of queue.entries()) {
    const fresh = msgs.filter(m => m.ts > cutoff);
    if (fresh.length === 0) queue.delete(id);
    else queue.set(id, fresh);
  }
}

const ALLOWED_TYPES = new Set(['offer', 'answer', 'ice']);

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  cleanup();

  if (req.method === 'POST') {
    const { to, from, type, data } = req.body ?? {};
    if (!to || !from || !type) {
      return res.status(400).json({ error: 'Missing required fields: to, from, type' });
    }
    if (typeof to !== 'string' || to.length > 80) {
      return res.status(400).json({ error: 'Invalid to field' });
    }
    if (!ALLOWED_TYPES.has(type)) {
      return res.status(400).json({ error: `Unknown signal type: ${type}` });
    }
    if (!queue.has(to)) queue.set(to, []);
    const msgs = queue.get(to);
    msgs.push({ from, type, data, ts: Date.now() });
    if (msgs.length > 50) queue.set(to, msgs.slice(-50));
    return res.json({ ok: true });
  }

  if (req.method === 'GET') {
    const { to } = req.query ?? {};
    if (!to) return res.status(400).json({ error: 'Missing ?to= param' });
    const msgs = queue.get(to) ?? [];
    queue.delete(to);   // consume — each message delivered once
    return res.json({ messages: msgs });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

// api/peer/presence.js — SOMA-9.4 P2P Presence Registry
// GET  /api/peer/presence        → list active peers { peers: [{id, ek_hex}], count }
// POST /api/peer/presence        → register / heartbeat { id, ek_hex }
//
// State: module-level Map with TTL. Persists across warm Vercel invocations.
// Cold-start resets the registry — acceptable for exhibition use.
//
// SOMA-9.4 · FADE_DOCTRINE · P2P SOVEREIGNTY LAYER

const peers  = new Map();   // peerId → { id, ek_hex, lastSeen }
const TTL_MS = 90_000;      // 90 s — peer must heartbeat within this window

function cleanup() {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, p] of peers.entries()) {
    if (p.lastSeen < cutoff) peers.delete(id);
  }
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  cleanup();

  if (req.method === 'POST') {
    const { id, ek_hex } = req.body ?? {};
    if (!id || typeof id !== 'string' || id.length > 80) {
      return res.status(400).json({ error: 'Invalid peer id' });
    }
    peers.set(id, {
      id,
      ek_hex: typeof ek_hex === 'string' ? ek_hex.slice(0, 2370) : null,
      lastSeen: Date.now(),
    });
    return res.json({ ok: true, count: peers.size });
  }

  if (req.method === 'GET') {
    const list = [...peers.values()].map(p => ({ id: p.id, ek_hex: p.ek_hex }));
    return res.json({ peers: list, count: list.length });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

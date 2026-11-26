// api/transmute/order.js — SOMA-9.4 Tesseract Order Bridge
// POST /api/transmute/order
//
// Receives a TRANSMUTE payload from the Latent Collider frontend,
// persists the order to Vercel KV, and posts a rich Discord embed with
// Acknowledge / Macerating / Shipped action buttons via Bot REST API.
//
// Auth: none — this is a public endpoint (see Request guards).
// Abuse limits: body size and field validation, server-side pricing, rate limits.
// Idempotency: formulaHash unique index prevents duplicate orders.

import { createHmac } from 'crypto';
import { kv } from '@vercel/kv';
import { composeAlienVerdict } from '../_alien/composeVerdict.js';

const BOT_TOKEN     = process.env.DISCORD_BOT_TOKEN;
const ORDER_CHANNEL  = process.env.DISCORD_ORDER_CHANNEL_ID;
const DISCORD_API    = 'https://discord.com/api/v10';

// ── Request guards ────────────────────────────────────────────────────────────
// Anonymous browsers call this endpoint, and a browser cannot keep a secret, so
// there is no caller authentication. Treat every field as hostile.
const MAX_BODY_BYTES     = 16 * 1024;
const HOURLY_PER_ADDRESS = 5;
// One address can make at most 5 × 24 = 120 requests a day, so it cannot use this up alone.
const DAILY_NEW_ORDERS   = 200;
const MAX_HISTORY        = 30;

// The server owns the prices. Mirrors TIERS in src/terminal/views/LatentCollider.jsx.
const TIERS = new Map([
  ['10ml', { price: 25,  g2t: 2.5, label: '10 ml · DISCOVERY' }],
  ['50ml', { price: 100, g2t: 10,  label: '50 ml · SOVEREIGN' }],
]);

// Max lengths. Discord caps an embed field at 1024 characters, code fence included.
// encryptedPayload is never put in an embed. It must arrive whole or it cannot be
// decrypted; the longest formula the collider's note names give seals to about 3,200.
const TEXT_LIMITS = {
  formulaId: 120, encryptedPayload: 8192, cardName: 200, domainPair: 120,
  noteBlock: 1000, physBlock: 1000, vaultBlock: 1000,
};
const CONTACT_LIMIT = 254;

const isText = (v, max) => v === undefined || v === null || (typeof v === 'string' && v.length <= max);
const isObject = v => typeof v === 'object' && v !== null && !Array.isArray(v);
// Most text is rendered inside ``` fences; a backtick could close one.
const defang = v => v?.replace(/`/g, "'");

// Returns the reason the body is unacceptable, or null.
function findProblem(body) {
  if (!isObject(body)) return 'body must be a JSON object';
  if (typeof body.formulaHash !== 'string' || !/^[0-9a-f]{64}$/.test(body.formulaHash)) {
    return 'formulaHash must be a SHA-256 hex digest';
  }
  if (!TIERS.has(body.tierSize)) return 'unknown tierSize';
  for (const [field, max] of Object.entries(TEXT_LIMITS)) {
    if (!isText(body[field], max)) return `invalid ${field}`;
  }
  const { contact, kernelHistory } = body;
  if (contact != null && !(isObject(contact)
      && isText(contact.signal, CONTACT_LIMIT) && isText(contact.email, CONTACT_LIMIT))) {
    return 'invalid contact';
  }
  if (kernelHistory != null && !(Array.isArray(kernelHistory) && kernelHistory.length <= MAX_HISTORY
      && kernelHistory.every(k => isObject(k) && typeof k.id === 'string' && k.id.length <= 100))) {
    return 'invalid kernelHistory';
  }
  return null;
}

// Resolves to null once the body passes MAX_BODY_BYTES.
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

// Counts one hit in a fixed window; false once the window is over its limit.
async function underLimit(key, limit, windowSeconds) {
  const count = await kv.incr(key);
  if (count === 1) await kv.expire(key, windowSeconds);
  return count <= limit;
}

// KV holds only a keyed hash of the caller's address, and only for the window.
// Vercel sets x-forwarded-for itself, so a caller cannot choose it there.
// The key must be secret: with a known key, all of IPv4 can be hashed in minutes
// and the stored keys reversed. So there is no fallback; the handler refuses
// orders while RATE_LIMIT_SALT is unset.
function addressKey(req, salt) {
  const address = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown';
  return createHmac('sha256', salt).update(address).digest('hex').slice(0, 32);
}

// ── Discord REST ──────────────────────────────────────────────────────────────
// Returns structured result so the caller can distinguish HTTP-level failures
// (bad token, missing channel, no permission) from successes. Never throws —
// network failures, malformed bodies, and HTTP errors all return a plain
// object. The previous null-return-on-failure shape silently swallowed
// 401/403/404 from Discord, leaving the operator blind to config drift.
async function discordPost(path, body) {
  let res;
  try {
    res = await fetch(`${DISCORD_API}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${BOT_TOKEN}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return { ok: false, status: 0, error: `network: ${err.message}`, discordCode: null };
  }
  if (res.ok) {
    let data = null;
    try { data = await res.json(); } catch { /* tolerate empty/malformed body */ }
    return { ok: true, status: res.status, data: data ?? {} };
  }
  let errBody = null;
  try { errBody = await res.json(); } catch { /* not JSON */ }
  return {
    ok:          false,
    status:      res.status,
    error:       errBody?.message || res.statusText,
    discordCode: errBody?.code ?? null,
  };
}

// ── Embed builder ─────────────────────────────────────────────────────────────
function buildEmbed(order, state = 'QUEUED', kernelHistory = null) {
  const COLOR = {
    QUEUED: 0x39FF14, ACKNOWLEDGED: 0x06B6D4,
    MACERATING: 0xD946EF, SHIPPED: 0x39FF14,
  };
  const STATE_LABEL = {
    QUEUED:       '◈  MANIFEST COMPILED',
    ACKNOWLEDGED: '◎  ACKNOWLEDGED',
    MACERATING:   '⚗  MACERATING',
    SHIPPED:      '✦  SHIPPED',
  };

  const hash = order.formulaHash ?? '—';
  const domain = order.domainPair ?? order.formulaId ?? '—';

  const kernelField = [
    '```',
    `DOMAIN   ${domain}`,
    `HASH     ${hash.slice(0, 32)}`,
    `         ${hash.slice(32) || '—'}`,
    `SPACE    1536-dim · OCK v1.1.0`,
    `P(RECOL) < 10⁻⁷⁷`,
    '```',
    'Null-state origin. The collider does not create formulas — it extracts trajectories latent in the field. The vault hash is the coordinate. The accord is not invented. It is located.',
  ].join('\n');

  const fishField = [
    '```',
    'r < 3.000  fixed point  →  TOP   ordered',
    'r > 3.000  period-2     →  HEART cascade',
    'r > 3.569  chaos onset  →  BASE  attractor',
    `δ = 4.66920160910299`,
    '```',
    'Feigenbaum (1975): period-doubling bifurcations converge at δ universally. Each scale compressed by δ. BASE notes are post-cascade residue — the strange attractor. The fish scale kernel is universal geometry.',
  ].join('\n');

  return {
    title:       `◈ TESSERACT TRANSMUTATION // ${order.formulaId}`,
    description: `\`\`\`\n${order.cardName}\n\`\`\``,
    color:       COLOR[state] ?? 0x39FF14,
    fields: [
      { name: '§ STATE',              value: STATE_LABEL[state],                       inline: true  },
      { name: '§ DELIVERY',           value: '`DIGITAL ASSET DOWNLOADED`',             inline: true  },
      { name: '§ VAULT IDENTITY',     value: `\`\`\`\n${order.vaultBlock}\n\`\`\``,   inline: false },
      { name: '§ SCENT PROFILE',      value: `\`\`\`\n${order.noteBlock}\n\`\`\``,    inline: false },
      { name: '§ PROPERTIES',         value: `\`\`\`\n${order.physBlock}\n\`\`\``,    inline: false },
      { name: '§ ORIGIN VECTOR',      value: kernelField,                              inline: false },
      { name: '§ FEIGENBAUM δ',       value: fishField,                               inline: false },
      { name: '§ ALIEN READING',      value: `\`\`\`\n${composeAlienVerdict(kernelHistory)}\n\`\`\``, inline: false },
      { name: '§ ORDER ID',           value: `\`${order.id}\``,                        inline: false },
    ],
    footer:    { text: `tesseract protocol · scale94 · ${order.createdAt}` },
    timestamp: order.createdAt,
  };
}

// ── Component builder — single acknowledge button for digital delivery ─────────
function buildComponents(orderId, state = 'QUEUED') {
  return [{
    type: 1,
    components: [
      { type: 2, style: 2, label: '◎ Acknowledge Receipt', custom_id: `tm:ack:${orderId}`, disabled: state !== 'QUEUED' },
    ],
  }];
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();

  const rawBody = await readBody(req);
  if (rawBody === null) return res.status(413).json({ error: 'Body too large' });

  let body;
  try { body = JSON.parse(rawBody); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  const problem = findProblem(body);
  if (problem) return res.status(400).json({ error: problem });

  const salt = process.env.RATE_LIMIT_SALT;
  if (!salt) {
    console.error('[transmute/order] RATE_LIMIT_SALT not set — refusing orders');
    return res.status(503).json({ error: 'Ordering unavailable' });
  }

  if (!(await underLimit(`ratelimit:order:${addressKey(req, salt)}`, HOURLY_PER_ADDRESS, 3600))) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const { formulaHash, tierSize, contact, kernelHistory } = body;
  const tier = TIERS.get(tierSize);
  const text = field => defang(body[field]) ?? '—';

  // Idempotency: reject duplicate hashes
  const existingId = await kv.get(`order:hash:${formulaHash}`);
  if (existingId) {
    return res.status(409).json({ error: 'Order already exists', orderId: existingId });
  }

  if (!(await underLimit('ratelimit:order:daily', DAILY_NEW_ORDERS, 86400))) {
    return res.status(429).json({ error: 'Daily order limit reached' });
  }

  // Build and persist order
  const orderId   = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const order = {
    id:               orderId,
    formulaId:        text('formulaId'),
    formulaHash:      formulaHash,
    encryptedPayload: text('encryptedPayload'),
    sovereignRatio:   tier.price,
    g2tAmount:        tier.g2t,
    tierSize,
    tierLabel:        tier.label,
    cardName:         text('cardName'),
    domainPair:       text('domainPair'),
    noteBlock:        text('noteBlock'),
    physBlock:        text('physBlock'),
    vaultBlock:       text('vaultBlock'),
    contactSignal:    defang(contact?.signal) || '',
    contactEmail:     defang(contact?.email)  || '',
    fulfillmentState: 'QUEUED',
    paymentStatus:    'PENDING',
    createdAt,
    discordMessageId: '',
    discordChannelId: ORDER_CHANNEL ?? '',
  };

  await kv.hset(`order:${orderId}`, order);
  await kv.set(`order:hash:${formulaHash}`, orderId);
  await kv.sadd('orders:all', orderId);

  // Ensure threshold singleton exists (first-run initialisation)
  await kv.setnx('threshold:current', 0);
  await kv.setnx('threshold:target',  10);

  // Post Discord embed with action buttons (requires Bot token, not webhook).
  // Failures persist on the order record so the operator can triage post-hoc
  // via Vercel's KV dashboard. Orders are valid regardless of embed delivery —
  // a failed post does not roll back the order. The whole block is wrapped
  // in try/catch so a KV outage during diagnostic persistence cannot break
  // the 201 contract — the order is already saved by then.
  try {
    if (BOT_TOKEN && ORDER_CHANNEL) {
      const result = await discordPost(`/channels/${ORDER_CHANNEL}/messages`, {
        embeds:     [buildEmbed(order, 'QUEUED', kernelHistory)],
        components: buildComponents(orderId, 'QUEUED'),
      });
      if (result.ok) {
        if (result.data?.id) {
          await kv.hset(`order:${orderId}`, { discordMessageId: result.data.id });
        }
      } else {
        console.error('[transmute/order] Discord post failed:',
          `status=${result.status} code=${result.discordCode ?? '—'} error=${result.error}`);
        await kv.hset(`order:${orderId}`, {
          discordError:   `${result.status}:${result.discordCode ?? '—'}:${result.error}`,
          discordErrorAt: new Date().toISOString(),
        });
      }
    } else {
      console.error('[transmute/order] BOT_TOKEN or ORDER_CHANNEL env not set — embed skipped');
    }
  } catch (err) {
    console.error('[transmute/order] diagnostic persistence failed (non-fatal):', err.message);
  }

  return res.status(201).json({ orderId, status: 'QUEUED' });
}

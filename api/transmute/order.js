// api/transmute/order.js — SOMA-9.4 Tesseract Order Bridge
// POST /api/transmute/order
//
// Receives a signed TRANSMUTE payload from the Latent Collider frontend,
// persists the order to Vercel KV, and posts a rich Discord embed with
// Acknowledge / Macerating / Shipped action buttons via Bot REST API.
//
// Auth: HMAC-SHA256 on raw JSON body (x-transmute-signature header).
// Idempotency: formulaHash unique index prevents duplicate orders.

import { createHmac, timingSafeEqual } from 'crypto';
import { kv } from '@vercel/kv';
import { composeAlienVerdict } from '../_alien/composeVerdict.js';

const WEBHOOK_SECRET = process.env.TRANSMUTE_WEBHOOK_SECRET;
const BOT_TOKEN      = process.env.DISCORD_BOT_TOKEN;
const ORDER_CHANNEL  = process.env.DISCORD_ORDER_CHANNEL_ID;
const DISCORD_API    = 'https://discord.com/api/v10';

// ── Signature verification ────────────────────────────────────────────────────
function verifySignature(rawBody, sig) {
  if (!WEBHOOK_SECRET) return true; // dev mode: skip if secret not configured
  if (!sig) return false;
  const expected = createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(sig.padEnd(64, '0')), Buffer.from(expected.padEnd(64, '0')));
  } catch { return false; }
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-transmute-signature');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();

  // Read raw bytes — HMAC is over the exact wire bytes, not re-serialised JSON
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString('utf-8');
  const body    = JSON.parse(rawBody);

  const sig = req.headers['x-transmute-signature'];
  if (!verifySignature(rawBody, sig)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const {
    formulaId, formulaHash, encryptedPayload,
    sovereignRatio, g2tAmount,
    tierSize, tierLabel,
    cardName, domainPair, noteBlock, physBlock, vaultBlock,
    contact,
    kernelHistory,
  } = body;

  if (!formulaHash) return res.status(400).json({ error: 'formulaHash required' });

  // Idempotency: reject duplicate hashes
  const existingId = await kv.get(`order:hash:${formulaHash}`);
  if (existingId) {
    return res.status(409).json({ error: 'Order already exists', orderId: existingId });
  }

  // Build and persist order
  const orderId   = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const order = {
    id:               orderId,
    formulaId:        formulaId        ?? '—',
    formulaHash:      formulaHash,
    encryptedPayload: encryptedPayload ?? '—',
    sovereignRatio:   sovereignRatio   ?? 100,
    g2tAmount:        g2tAmount        ?? 10,
    tierSize:         tierSize         ?? '50ml',
    tierLabel:        tierLabel        ?? '50 ml · SOVEREIGN',
    cardName:         cardName         ?? '—',
    domainPair:       domainPair       ?? '—',
    noteBlock:        noteBlock        ?? '—',
    physBlock:        physBlock        ?? '—',
    vaultBlock:       vaultBlock       ?? '—',
    contactSignal:    contact?.signal  || '',
    contactEmail:     contact?.email   || '',
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
  // the 201 contract — the order is already saved at line 190.
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

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
async function discordPost(path, body) {
  const res = await fetch(`${DISCORD_API}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${BOT_TOKEN}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  });
  return res.ok ? res.json() : null;
}

// ── Embed builder ─────────────────────────────────────────────────────────────
function buildEmbed(order, state = 'QUEUED') {
  const COLOR = {
    QUEUED: 0xD4AF37, ACKNOWLEDGED: 0x06B6D4,
    MACERATING: 0xD946EF, SHIPPED: 0x39FF14,
  };
  const STATE_LABEL = {
    QUEUED:       '⬡  QUEUED',
    ACKNOWLEDGED: '◎  ACKNOWLEDGED',
    MACERATING:   '⚗  MACERATING',
    SHIPPED:      '✦  SHIPPED',
  };
  return {
    title:       `◈ TESSERACT TRANSMUTATION // ${order.formulaId}`,
    description: `\`\`\`\n${order.cardName}\n\`\`\``,
    color:       COLOR[state] ?? 0xD4AF37,
    fields: [
      { name: '§ STATE',           value: STATE_LABEL[state],                       inline: true  },
      { name: '§ TIER',            value: order.tierLabel || order.tierSize || '50ml', inline: true },
      { name: '§ SOVEREIGN',      value: `€${order.sovereignRatio}`,                inline: true  },
      { name: '§ G²T → UA',        value: `€${order.g2tAmount}`,                    inline: true  },
      { name: '§ VAULT IDENTITY',  value: `\`\`\`\n${order.vaultBlock}\n\`\`\``,   inline: false },
      { name: '§ SCENT PROFILE',   value: `\`\`\`\n${order.noteBlock}\n\`\`\``,    inline: false },
      { name: '§ PROPERTIES',      value: `\`\`\`\n${order.physBlock}\n\`\`\``,    inline: false },
      ...(order.contactSignal || order.contactEmail ? [{
        name:  '§ CONTACT',
        value: `\`\`\`\n${order.contactSignal ? `SIGNAL  ${order.contactSignal}\n` : ''}${order.contactEmail ? `EMAIL   ${order.contactEmail}` : ''}\`\`\``,
        inline: false,
      }] : []),
      { name: '§ ORDER ID',        value: `\`${order.id}\``,                        inline: false },
    ],
    footer:    { text: `tesseract protocol · scale94 · ${order.createdAt}` },
    timestamp: order.createdAt,
  };
}

// ── Component builder — buttons disable as state advances ─────────────────────
function buildComponents(orderId, state = 'QUEUED') {
  const ORDER  = ['QUEUED', 'ACKNOWLEDGED', 'MACERATING', 'SHIPPED'];
  const idx    = ORDER.indexOf(state);
  return [{
    type: 1, // ACTION_ROW
    components: [
      { type: 2, style: 2, label: 'Acknowledge',   custom_id: `tm:ack:${orderId}`, disabled: idx >= 1 },
      { type: 2, style: 1, label: '⚗ Macerating', custom_id: `tm:mac:${orderId}`, disabled: idx >= 2 },
      { type: 2, style: 3, label: '✦ Shipped',     custom_id: `tm:shp:${orderId}`, disabled: idx >= 3 },
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
    cardName, noteBlock, physBlock, vaultBlock,
    contact,
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

  // Post Discord embed with action buttons (requires Bot token, not webhook)
  if (BOT_TOKEN && ORDER_CHANNEL) {
    try {
      const msg = await discordPost(`/channels/${ORDER_CHANNEL}/messages`, {
        embeds:     [buildEmbed(order, 'QUEUED')],
        components: buildComponents(orderId, 'QUEUED'),
      });
      if (msg?.id) {
        await kv.hset(`order:${orderId}`, { discordMessageId: msg.id });
      }
    } catch (e) {
      console.error('[transmute/order] Discord post failed:', e.message);
    }
  }

  return res.status(201).json({ orderId, status: 'QUEUED' });
}

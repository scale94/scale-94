// api/discord/interactions.js — SOMA-9.4 Discord Interaction Handler
// POST /api/discord/interactions
//
// Discord POSTs here for every button click on order embeds.
// Register this URL at: Discord Developer Portal → Your App → Interactions Endpoint URL
//
// Security: Ed25519 signature verified against DISCORD_APPLICATION_PUBLIC_KEY.
// Must respond within 3 seconds — heavy work happens after deferring the update.
//
// State machine: QUEUED → ACKNOWLEDGED → MACERATING → SHIPPED (one-way only).
// SHIPPED atomically increments threshold:current in Vercel KV.

import { createPublicKey, verify } from 'crypto';
import { kv } from '@vercel/kv';

const BOT_TOKEN  = process.env.DISCORD_BOT_TOKEN;
const PUBLIC_KEY = process.env.DISCORD_APPLICATION_PUBLIC_KEY;
const DISCORD_API = 'https://discord.com/api/v10';

// ── Ed25519 signature verification ───────────────────────────────────────────
// Discord signs every request with the app's Ed25519 private key.
// We verify with the public key registered in the Developer Portal.
// DER prefix 302a300506032b6570032100 wraps the raw 32-byte key for Node crypto.
function verifyDiscordSignature(signature, timestamp, rawBody) {
  if (!PUBLIC_KEY) {
    console.warn('[interactions] DISCORD_APPLICATION_PUBLIC_KEY not set — skipping verify');
    return true;
  }
  try {
    const derHex = '302a300506032b6570032100' + PUBLIC_KEY;
    const pubKey = createPublicKey({ key: Buffer.from(derHex, 'hex'), format: 'der', type: 'spki' });
    return verify(
      null,
      Buffer.from(timestamp + rawBody),
      pubKey,
      Buffer.from(signature, 'hex'),
    );
  } catch {
    return false;
  }
}

// ── Discord REST helpers ──────────────────────────────────────────────────────
async function discordPatch(path, body) {
  const res = await fetch(`${DISCORD_API}${path}`, {
    method:  'PATCH',
    headers: { 'Authorization': `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!res.ok) console.error('[interactions] PATCH failed', res.status, await res.text());
}

async function discordFollowup(appId, token, content) {
  await fetch(`${DISCORD_API}/webhooks/${appId}/${token}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ content, flags: 64 }), // 64 = EPHEMERAL
  });
}

// ── Embed + component builders ────────────────────────────────────────────────
const COLOR = {
  QUEUED: 0xD4AF37, ACKNOWLEDGED: 0x06B6D4, MACERATING: 0xD946EF, SHIPPED: 0x39FF14,
};
const STATE_LABEL = {
  QUEUED:       '⬡  QUEUED',
  ACKNOWLEDGED: '◎  ACKNOWLEDGED',
  MACERATING:   '⚗  MACERATING',
  SHIPPED:      '✦  SHIPPED',
};

function buildEmbed(order, state) {
  return {
    title:       `◈ TESSERACT TRANSMUTATION // ${order.formulaId}`,
    description: `\`\`\`\n${order.cardName}\n\`\`\``,
    color:       COLOR[state] ?? 0xD4AF37,
    fields: [
      { name: '§ STATE',           value: STATE_LABEL[state],                      inline: true  },
      { name: '§ SOVEREIGN RATIO', value: `€${order.sovereignRatio}`,              inline: true  },
      { name: '§ G²T → UA',        value: `€${order.g2tAmount}`,                   inline: true  },
      { name: '§ VAULT IDENTITY',  value: `\`\`\`\n${order.vaultBlock}\n\`\`\``,  inline: false },
      { name: '§ SCENT PROFILE',   value: `\`\`\`\n${order.noteBlock}\n\`\`\``,   inline: false },
      { name: '§ PROPERTIES',      value: `\`\`\`\n${order.physBlock}\n\`\`\``,   inline: false },
      { name: '§ ORDER ID',        value: `\`${order.id}\``,                       inline: false },
    ],
    footer:    { text: `tesseract protocol · scale94 · ${order.createdAt}` },
    timestamp: order.createdAt,
  };
}

function buildComponents(orderId, state) {
  const ORDER = ['QUEUED', 'ACKNOWLEDGED', 'MACERATING', 'SHIPPED'];
  const idx   = ORDER.indexOf(state);
  return [{
    type: 1,
    components: [
      { type: 2, style: 2, label: 'Acknowledge',   custom_id: `tm:ack:${orderId}`, disabled: idx >= 1 },
      { type: 2, style: 1, label: '⚗ Macerating', custom_id: `tm:mac:${orderId}`, disabled: idx >= 2 },
      { type: 2, style: 3, label: '✦ Shipped',     custom_id: `tm:shp:${orderId}`, disabled: idx >= 3 },
    ],
  }];
}

// ── State machine ─────────────────────────────────────────────────────────────
const TRANSITION = { ack: 'ACKNOWLEDGED', mac: 'MACERATING', shp: 'SHIPPED' };
const ORDER      = ['QUEUED', 'ACKNOWLEDGED', 'MACERATING', 'SHIPPED'];

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const signature = req.headers['x-signature-ed25519']  ?? '';
  const timestamp = req.headers['x-signature-timestamp'] ?? '';

  // Read raw bytes from the stream — Discord signs the exact wire bytes,
  // not a re-serialised JSON string, so we cannot use JSON.stringify(req.body).
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString('utf-8');
  const body    = JSON.parse(rawBody);

  if (!verifyDiscordSignature(signature, timestamp, rawBody)) {
    return res.status(401).send('Invalid signature');
  }

  const { type, data, token, application_id } = body;

  // Type 1: PING — Discord sends this to verify the endpoint during setup
  if (type === 1) return res.status(200).json({ type: 1 });

  // Type 3: MESSAGE_COMPONENT — button click
  if (type === 3) {
    const customId = data?.custom_id ?? '';
    const [ns, action, orderId] = customId.split(':');

    if (ns !== 'tm' || !orderId) {
      return res.status(200).json({ type: 4, data: { content: '⚠ Unknown interaction.', flags: 64 } });
    }

    const nextState = TRANSITION[action];
    if (!nextState) {
      return res.status(200).json({ type: 4, data: { content: '⚠ Unknown action.', flags: 64 } });
    }

    // Type 6: DEFERRED_UPDATE_MESSAGE — acknowledge within 3s, edit later
    res.status(200).json({ type: 6 });

    // Everything below happens asynchronously after the 3s response window
    ;(async () => {
      const order = await kv.hgetall(`order:${orderId}`);
      if (!order) return;

      // Guard: only forward transitions (no regression)
      const currentIdx = ORDER.indexOf(order.fulfillmentState);
      const nextIdx    = ORDER.indexOf(nextState);
      if (nextIdx <= currentIdx) {
        await discordFollowup(application_id, token, `⚠ Already at or past **${nextState}**.`);
        return;
      }

      // Persist new fulfillment state
      await kv.hset(`order:${orderId}`, { fulfillmentState: nextState });
      order.fulfillmentState = nextState;

      // SHIPPED → atomically increment production threshold counter
      if (nextState === 'SHIPPED') {
        await kv.incr('threshold:current');
      }

      // Update Discord embed in-place — buttons auto-disable past their state
      if (order.discordMessageId && order.discordChannelId) {
        await discordPatch(
          `/channels/${order.discordChannelId}/messages/${order.discordMessageId}`,
          {
            embeds:     [buildEmbed(order, nextState)],
            components: buildComponents(orderId, nextState),
          },
        );
      }

      await discordFollowup(
        application_id, token,
        `✓ Order \`${orderId.slice(0, 8)}…\` → **${STATE_LABEL[nextState]}**`,
      );
    })();

    return;
  }

  return res.status(400).json({ error: `Unhandled interaction type: ${type}` });
}

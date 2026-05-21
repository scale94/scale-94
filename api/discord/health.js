// api/discord/health.js — SOMA-9.4 Discord Bot Health Probe
// GET /api/discord/health
//
// Operator-facing diagnostic. Runs three sequential checks:
//   1. Are BOT_TOKEN and ORDER_CHANNEL env vars present?
//   2. Does GET /users/@me succeed with the bot token? (token valid)
//   3. Does GET /channels/{ORDER_CHANNEL} succeed?         (channel reachable)
//
// No request body, no auth. The bot token never appears in the response —
// only the bot's own user identity (id, username), which is public.
// Used to triage "embed not posting" without placing a test order.

const BOT_TOKEN     = process.env.DISCORD_BOT_TOKEN;
const ORDER_CHANNEL = process.env.DISCORD_ORDER_CHANNEL_ID;
const DISCORD_API   = 'https://discord.com/api/v10';

async function discordGet(path) {
  let res;
  try {
    res = await fetch(`${DISCORD_API}${path}`, {
      method:  'GET',
      headers: { 'Authorization': `Bot ${BOT_TOKEN}` },
    });
  } catch (err) {
    return { ok: false, status: 0, error: `network: ${err.message}`, discordCode: null };
  }
  if (res.ok) {
    return { ok: true, status: res.status, data: await res.json() };
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).end();

  const checkedAt = new Date().toISOString();

  // ── Check 1: env vars present ────────────────────────────────────────────
  if (!BOT_TOKEN || !ORDER_CHANNEL) {
    return res.status(200).json({
      ok:        false,
      reason:    'env_missing',
      detail:    `BOT_TOKEN=${BOT_TOKEN ? 'set' : 'unset'} ORDER_CHANNEL=${ORDER_CHANNEL ? 'set' : 'unset'}`,
      checkedAt,
    });
  }

  // ── Check 2: bot identity (token valid?) ─────────────────────────────────
  const me = await discordGet('/users/@me');
  if (!me.ok) {
    const reason = me.status === 401 ? 'token_invalid'
                 : me.status === 0   ? 'discord_unreachable'
                 :                     'token_error';
    return res.status(200).json({
      ok:     false,
      reason,
      detail: `${me.status}:${me.discordCode ?? '—'}:${me.error}`,
      checkedAt,
    });
  }

  // ── Check 3: channel access ──────────────────────────────────────────────
  const ch = await discordGet(`/channels/${ORDER_CHANNEL}`);
  if (!ch.ok) {
    const reason = ch.status === 403 ? 'no_permission'
                 : ch.status === 404 ? 'channel_missing'
                 : ch.status === 0   ? 'discord_unreachable'
                 :                     'channel_error';
    return res.status(200).json({
      ok:     false,
      reason,
      detail: `${ch.status}:${ch.discordCode ?? '—'}:${ch.error}`,
      bot:    { id: me.data.id, username: me.data.username },
      checkedAt,
    });
  }

  // ── All checks passed ────────────────────────────────────────────────────
  return res.status(200).json({
    ok:        true,
    bot:       { id: me.data.id, username: me.data.username },
    channel:   { id: ch.data.id, name: ch.data.name, type: ch.data.type },
    checkedAt,
  });
}

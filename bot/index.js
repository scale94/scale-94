// index.js — Discord bot entry. Listens for /seek, validates input, signs a
// JWT bound to the requesting user + accord hash prefix, DMs the user the
// sovereign key with manifesto-voice copy.

import 'dotenv/config';
import { Client, GatewayIntentBits, Events, MessageFlags } from 'discord.js';
import { SignJWT } from 'jose';

const HEX8 = /^[0-9a-f]{8}$/i;
const TTL  = '24h';

const ALLOWED_CHANNEL = process.env.CHANNEL_ID;
const SECRET = new TextEncoder().encode(process.env.DISCORD_SOVEREIGN_SECRET);

// ── Rate limit (in-memory, single-instance) ───────────────────────────────
// Resets on container restart — documented limitation.
const seenPerUser = new Map(); // userId -> { count, dayKey }
const seenPerPrefix = new Map(); // `${userId}:${prefix}` -> hourTimestamp

function rateLimit(userId, prefix) {
  const now      = Date.now();
  const dayKey   = new Date(now).toISOString().slice(0, 10);
  const hourBin  = Math.floor(now / 3_600_000);
  const userRec  = seenPerUser.get(userId);
  if (!userRec || userRec.dayKey !== dayKey) {
    seenPerUser.set(userId, { count: 1, dayKey });
  } else if (userRec.count >= 5) {
    return { ok: false, reason: 'daily_limit' };
  } else {
    userRec.count++;
  }
  const prefixKey = `${userId}:${prefix}`;
  const lastHour  = seenPerPrefix.get(prefixKey);
  if (lastHour === hourBin) {
    return { ok: false, reason: 'prefix_cooldown' };
  }
  seenPerPrefix.set(prefixKey, hourBin);
  return { ok: true };
}

async function issueToken(discordId, prefix) {
  return new SignJWT({ discordId, hashPrefix: prefix.toLowerCase() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TTL)
    .setIssuer('bot.collider.scale94')
    .setAudience('api.transmute.redeem')
    .sign(SECRET);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, c => {
  console.log(`collider bot online as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'seek') return;
  if (ALLOWED_CHANNEL && interaction.channelId !== ALLOWED_CHANNEL) {
    return interaction.reply({ content: 'WARN /seek is only available in the designated channel.', flags: MessageFlags.Ephemeral });
  }
  const prefix = interaction.options.getString('prefix', true);
  if (!HEX8.test(prefix)) {
    return interaction.reply({
      content: 'WARN Hash prefix must be 8 hex characters (0-9, a-f). Take it from the SHA-256 line in your manifest.',
      flags:   MessageFlags.Ephemeral,
    });
  }
  const rl = rateLimit(interaction.user.id, prefix.toLowerCase());
  if (!rl.ok) {
    const msg = rl.reason === 'daily_limit'
      ? 'WARN Daily limit reached (5 prefixes/day). Try again tomorrow.'
      : 'WARN This prefix was already sought within the last hour. Try again later or use a different accord.';
    return interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const token = await issueToken(interaction.user.id, prefix);
  const expIso = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  const dmBody =
`SOVEREIGN KEY TRANSMITTED

Your sovereign key has been transmitted. The vault accepts only your hand.
The molecule that is yours did not exist before this transmission. It does now.

PREFIX     ${prefix.toLowerCase()}
EXPIRES    ${expIso}
PROTOCOL   HS256 / 24h ttl

———

Paste this token into the REDEEM SOVEREIGN KEY input on your accord:

\`\`\`
${token}
\`\`\`

(The input becomes visible after you witness the vault glyph seven times.)`;

  try {
    const dm = await interaction.user.createDM();
    await dm.send(dmBody);
    await interaction.editReply({ content: 'Sovereign key sent via DM. Check your messages.' });
  } catch (err) {
    // DM failed — user has DMs off. Fall back to ephemeral channel reply.
    await interaction.editReply({ content: dmBody });
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);

// api/transmute/redeem.js — Living Accord redemption endpoint.
// Verifies the JWT issued by the Discord bot, checks accord-hash prefix
// matches the token claim, computes the deterministic Living Note
// substitution, persists to KV for idempotency.

import { jwtVerify, errors as joseErrors } from 'jose';
import { createHash } from 'crypto';

// ── Signature-grade note pool ──────────────────────────────────────────────
// These are RARE materials, distinct from PERF_NOTES (the public/printable pool).
// One of these gets substituted into the user's accord per the deterministic
// hash of (discordId, accordHash). Server-side only — keeps the pool confidential.

export const LIVING_NOTE_POOL = {
  CITRUS_top:    ['cassis bud absolute','blood orange essence','bergamot mitcham','yuzu zest','citron galette'],
  CITRUS_heart:  ['neroli bigarade','petitgrain sur fleurs','orange blossom absolute','linden blossom'],
  CITRUS_base:   ['cedrat distillate','aged bergamot tincture'],

  FLORAL_top:    ['mimosa head space','jasmine grandiflorum','gardenia tincture'],
  FLORAL_heart:  ['osmanthus tincture','rose ottoman','tuberose absolute','ylang extra','jasmine sambac concrete'],
  FLORAL_base:   ['orris butter','iris pallida concrete','rose absolute maroc'],

  WOODY_top:     ['hinoki distillate','cypress needle absolute'],
  WOODY_heart:   ['atlas cedar absolute','sandalwood mysore aged'],
  WOODY_base:    ['oud Hindi aged','agarwood Cambodi','vetiver bourbon aged','sandalwood mysore amyris'],

  ANIMALIC_top:  ['costus root tincture','choya nakh distillate'],
  ANIMALIC_heart:['hyraceum tincture','africa stone tincture','musk seed CO2'],
  ANIMALIC_base: ['ambergris tincture (white)','beaver castoreum absolute','civet absolute aged'],

  SPICY_top:     ['pink pepper CO2','aged szechuan','cardamom absolute'],
  SPICY_heart:   ['saffron absolute','cinnamon bark CO2'],
  SPICY_base:    ['clove bud absolute','tonka bean absolute'],

  FRESH_top:     ['sea spray accord','aldehyde C-12 MNA','calone'],
  FRESH_heart:   ['violet leaf absolute','iodine accord'],
  FRESH_base:    ['ambroxan crystals','iso-E super'],

  OCEANIC_top:   ['marine accord','helional','dulse seaweed CO2'],
  OCEANIC_heart: ['ozone trace','cyclohexyl salicylate'],
  OCEANIC_base:  ['ambergris (synthetic)','ambroxide'],

  _DEFAULT_top:   ['rare aldehyde','unnamed top accord'],
  _DEFAULT_heart: ['lab signature note','archive heart molecule'],
  _DEFAULT_base:  ['archive accord','vault base resin'],
};

export function computeLivingNote(discordId, accordHash, card) {
  const seedHex = createHash('sha256')
    .update(`${discordId}:${accordHash}`)
    .digest('hex')
    .slice(0, 16);
  const seedInt = BigInt('0x' + seedHex);

  const layers   = ['top', 'heart', 'base'];
  const layer    = layers[Number(seedInt % 3n)];
  const layerKey = layer === 'top' ? 'topNotes' : layer === 'heart' ? 'heartNotes' : 'baseNotes';
  const layerNotes = card[layerKey] || [];
  const slotIdx  = layerNotes.length > 0 ? Number((seedInt >> 2n) % BigInt(layerNotes.length)) : 0;
  const oldNote  = layerNotes[slotIdx] || '—';

  const dom = (card.dom || '').toUpperCase();
  const poolKey  = `${dom}_${layer}`;
  const pool     = LIVING_NOTE_POOL[poolKey] || LIVING_NOTE_POOL[`_DEFAULT_${layer}`];
  const newNote  = pool[Number((seedInt >> 4n) % BigInt(pool.length))];

  const witnessFull = createHash('sha256').update(discordId).digest('hex');
  const witnessHash = witnessFull.slice(0, 8) + '…' + witnessFull.slice(-4);

  return {
    layer,
    slotIdx,
    oldNote,
    newNote,
    editionEntropy: seedHex.slice(0, 8),
    witnessHash,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { token, accordHash, accordCard } = req.body || {};
    if (!token || !accordHash || !accordCard) {
      return res.status(400).json({ ok: false, error: 'missing fields' });
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.DISCORD_SOVEREIGN_SECRET),
      { issuer: 'bot.collider.scale94', audience: 'api.transmute.redeem' },
    );

    if (accordHash.slice(0, 8).toLowerCase() !== payload.hashPrefix) {
      return res.status(403).json({ ok: false, error: 'prefix mismatch' });
    }

    const living = computeLivingNote(payload.discordId, accordHash, accordCard);

    // Best-effort KV write (Vercel KV) for idempotency
    try {
      if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        const { kv } = await import('@vercel/kv');
        await kv.set(`living:${accordHash}:${payload.discordId}`, { living, redeemedAt: Date.now() });
      }
    } catch { /* KV optional — redemption is deterministic anyway */ }

    return res.status(200).json({ ok: true, living });
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      return res.status(401).json({ ok: false, code: 'expired', error: 'Token expired. Run /seek again on Discord to receive a fresh sovereign key.' });
    }
    return res.status(401).json({ ok: false, code: 'invalid', error: 'Invalid sovereign key.' });
  }
}

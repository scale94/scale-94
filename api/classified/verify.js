// api/classified/verify.js — Scale 9.4 Secure Enclave
// POST /api/classified/verify  { token: string, passphrase: string }
//
// Validates:
//   1. HMAC signature integrity (token not tampered)
//   2. Time window (must be within 60s of issuance)
//   3. Challenge passphrase (timing-safe compare)
//
// Only if all three pass does it decrypt and return the classified payload.
// The AES key, IV, ciphertext, and GCM auth tag are ONLY in env vars —
// they are never present in the frontend bundle or repo.
//
// Required env vars:
//   SESSION_SECRET          — 32-byte hex string (HMAC signing key)
//   CLASSIFIED_AES_KEY      — 32-byte hex (AES-256 key)
//   CLASSIFIED_AES_IV       — 12-byte hex (GCM nonce)
//   CLASSIFIED_AES_CIPHERTEXT — hex-encoded AES-GCM ciphertext
//   CLASSIFIED_AES_TAG      — 16-byte hex (GCM auth tag)
//
// Generate these with: node scripts/gen-classified-payload.js "your secret"

import crypto from 'node:crypto';

// ── Replay guard ──────────────────────────────────────────────────────────────
// Module-level Map persists for the lifetime of this serverless instance.
// Key: sessionId (UUID). Value: expiresAt timestamp for pruning.
// Each request prunes expired entries so the Map stays bounded.
// Note: does not survive a cold start — the 60s time gate is the primary
// defence; this is a best-effort second layer for same-instance replays.
const seenTokens = new Map();

function pruneSeenTokens() {
  const now = Date.now();
  for (const [id, exp] of seenTokens) {
    if (now > exp) seenTokens.delete(id);
  }
}

function verifyToken(token, secret) {
  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;

  const payload = token.slice(0, dot);
  const sig     = token.slice(dot + 1);

  const expected    = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const sigBuf      = Buffer.from(sig,      'base64url');
  const expectedBuf = Buffer.from(expected, 'base64url');

  // Timing-safe comparison — prevents timing-oracle attacks
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function decryptPayload(keyHex, ivHex, ciphertextHex, tagHex) {
  const key        = Buffer.from(keyHex,        'hex');
  const iv         = Buffer.from(ivHex,         'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const tag        = Buffer.from(tagHex,        'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}

export default function handler(req, res) {
  const origin = process.env.ALLOWED_ORIGIN ?? '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const secret         = process.env.SESSION_SECRET;
  const aesKey         = process.env.CLASSIFIED_AES_KEY;
  const aesIv          = process.env.CLASSIFIED_AES_IV;
  const aesCiphertext  = process.env.CLASSIFIED_AES_CIPHERTEXT;
  const aesTag         = process.env.CLASSIFIED_AES_TAG;

  if (!secret || !aesKey || !aesIv || !aesCiphertext || !aesTag) {
    console.error('[ENCLAVE] One or more env vars not configured');
    return res.status(500).json({ error: 'Enclave not configured' });
  }

  const { token, passphrase } = req.body ?? {};

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'MISSING_TOKEN', msg: 'No session token provided.' });
  }
  if (!passphrase || typeof passphrase !== 'string') {
    return res.status(400).json({ error: 'MISSING_PASSPHRASE', msg: 'No passphrase provided.' });
  }

  // Prune expired entries before every check
  pruneSeenTokens();

  // ── 1. HMAC integrity ──────────────────────────────────────────────────────
  const session = verifyToken(token, secret);
  if (!session) {
    return res.status(401).json({
      error: 'SIGNATURE_INVALID',
      msg:   'Token integrity check failed. Do not modify the session token.',
    });
  }

  // ── 2. Time gate ──────────────────────────────────────────────────────────
  const now = Date.now();
  if (now > session.expiresAt) {
    const overshoot = ((now - session.expiresAt) / 1000).toFixed(1);
    return res.status(401).json({
      error: 'TIME_EXCEEDED',
      msg:   `Session expired ${overshoot}s ago. Run classified to start a new session.`,
    });
  }

  // ── 2b. Replay guard ──────────────────────────────────────────────────────
  if (seenTokens.has(session.sessionId)) {
    return res.status(401).json({
      error: 'TOKEN_REPLAYED',
      msg:   'This session token has already been consumed. Run classified to start a new session.',
    });
  }

  // ── 3. Challenge passphrase (timing-safe) ─────────────────────────────────
  // Both buffers padded to fixed length before comparison so a wrong-length
  // guess gets the same code path as a right-length guess — no length oracle.
  const FIXED_LEN = 64;
  const expectedBuf = Buffer.alloc(FIXED_LEN);
  const providedBuf = Buffer.alloc(FIXED_LEN);
  Buffer.from(session.challenge.toUpperCase(), 'utf8').copy(expectedBuf);
  Buffer.from(passphrase.trim().toUpperCase(),  'utf8').copy(providedBuf);

  const match = crypto.timingSafeEqual(expectedBuf, providedBuf);

  if (!match) {
    const remaining = Math.max(0, session.expiresAt - now);
    return res.status(401).json({
      error: 'CHALLENGE_FAILED',
      msg:   `Echo mismatch. ${(remaining / 1000).toFixed(0)}s remaining on this session.`,
    });
  }

  // Consume token — must happen before decryption so a race between two
  // simultaneous requests cannot both slip past the guard
  seenTokens.set(session.sessionId, session.expiresAt);

  // ── 4. Decrypt payload ────────────────────────────────────────────────────
  let content;
  try {
    content = decryptPayload(aesKey, aesIv, aesCiphertext, aesTag);
  } catch (err) {
    console.error('[ENCLAVE] AES-GCM decryption failed:', err.message);
    return res.status(500).json({
      error: 'DECRYPT_FAILED',
      msg:   'Payload authentication or decryption error. Check env var integrity.',
    });
  }

  const remainingMs = session.expiresAt - now;
  return res.status(200).json({
    success:      true,
    sessionId:    session.sessionId.slice(0, 8).toUpperCase(),
    decryptedAt:  now,
    remainingMs,
    content,
  });
}

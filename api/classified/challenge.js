// api/classified/challenge.js — Scale 9.4 Secure Enclave
// POST /api/classified/challenge
//
// Generates a time-limited session token and a 6-char challenge code.
// The token is a stateless HMAC-SHA256 signed payload — no database required.
// The AES decryption key NEVER leaves this function; only the signed token
// and the challenge code are sent to the client.
//
// Required env vars:
//   SESSION_SECRET  — 32-byte hex string for HMAC signing
//
// Security properties:
//   · Token tampering detected via HMAC signature
//   · Expiry is baked into the signed payload — no server-side state needed
//   · Challenge code is single-use per token (replay is impossible within 60s
//     because the same token can only verify once — see verify.js)

import crypto from 'node:crypto';

const TIMEOUT_MS  = 60_000; // 60 second window
// Unambiguous characters — avoids I/l/1/O/0 confusion in terminal display
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateChallenge() {
  const bytes = crypto.randomBytes(6);
  return Array.from(bytes, b => CHARSET[b % CHARSET.length]).join('');
}

// Stateless signed token: base64url(payload).base64url(HMAC)
function makeToken(data, secret) {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const sig     = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export default function handler(req, res) {
  // Allow vercel dev + production same-origin; tighten ALLOWED_ORIGIN in prod if needed
  const origin = process.env.ALLOWED_ORIGIN ?? '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    console.error('[ENCLAVE] SESSION_SECRET not configured');
    return res.status(500).json({ error: 'Enclave not configured' });
  }

  const sessionId = crypto.randomUUID();
  const challenge = generateChallenge();
  const issuedAt  = Date.now();
  const expiresAt = issuedAt + TIMEOUT_MS;

  const token = makeToken({ sessionId, challenge, issuedAt, expiresAt }, secret);

  return res.status(200).json({
    token,
    challenge,
    expiresAt,
    // Session display ID — first 8 chars of UUID, uppercase
    sessionId:     sessionId.slice(0, 8).toUpperCase(),
    // Mock ML-KEM-768 metadata for terminal display (FIPS 203 Table 2)
    encapKeySize:  1184,
    decapKeySize:  2400,
    ciphertextSize: 1088,
    sharedSecretSize: 32,
    algorithm:     'ML-KEM-768 + AES-256-GCM',
    security:      'NIST Category 3 — 192-bit classical / 128-bit post-quantum',
  });
}

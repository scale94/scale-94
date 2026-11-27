// accordSeal.js — the sealed accord envelope (spec §5.2, §6.3).
//
//   ct, ss ← ML-KEM-768.Encaps(ek)
//   k      ← BLAKE3.derive_key("scale94 scent accord seal v1", ss)
//   aead_ct← AES-256-GCM(k, nonce = 96 random bits, aad = "v1|" + fp,
//                        canonicalJson({ baseAccord, salt }))
//
// Envelope: { v:1, kem:'ML-KEM-768', kdf:'BLAKE3-derive_key', aead:'AES-256-GCM',
//             fp, ct, nonce, aead_ct }, with the binary fields in base64.
//
// Unseal never throws. It returns a typed state the UI can name:
//   ok · orphaned (no key, or not this key) · tampered (authentication failed)
//   · malformed (not an envelope) · no-webcrypto (insecure origin)
// Pure apart from the injected WASM and SubtleCrypto calls.
import { canonicalJson } from './canonicalJson.js';
import { fromB64, fromUtf8, toB64, utf8 } from './bytes.js';

export const KDF_CONTEXT = 'scale94 scent accord seal v1';
export const ENVELOPE_V = 1;
const HEAD = { v: ENVELOPE_V, kem: 'ML-KEM-768', kdf: 'BLAKE3-derive_key', aead: 'AES-256-GCM' };
const CT_BYTES = 1088;
const NONCE_BYTES = 12;
const SALT_BYTES = 32;
const GCM_TAG_BYTES = 16;

const aadFor = (fp) => utf8(`v${ENVELOPE_V}|${fp}`);

async function aesKey(subtle, wasm, ss, usage) {
  const raw = wasm.blake3_derive_key(KDF_CONTEXT, ss);
  ss.fill(0);
  try { return await subtle.importKey('raw', raw, 'AES-GCM', false, [usage]); }
  finally { raw.fill(0); }
}

export async function sealAccord({ baseAccord, salt }, identity, { wasm, subtle, getRandomValues }) {
  if (!(salt instanceof Uint8Array) || salt.length !== SALT_BYTES) throw new Error('chaos salt must be 32 bytes');
  const plain = utf8(canonicalJson({ baseAccord, salt: toB64(salt) }));
  const { ct, ss } = wasm.mlkem768_encaps(identity.ek);
  const key = await aesKey(subtle, wasm, ss, 'encrypt');
  const nonce = getRandomValues(new Uint8Array(NONCE_BYTES));
  const aeadCt = new Uint8Array(await subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: aadFor(identity.fp) }, key, plain,
  ));
  plain.fill(0);
  return { ...HEAD, fp: identity.fp, ct: toB64(ct), nonce: toB64(nonce), aead_ct: toB64(aeadCt) };
}

/** Decoded byte sizes, for the reveal's envelope header (P3). Throws on a malformed envelope. */
export function envelopeSizes(envelope) {
  return { ct: fromB64(envelope.ct).length, aead: fromB64(envelope.aead_ct).length };
}

function parseEnvelope(e) {
  if (!e || typeof e !== 'object') return null;
  for (const [k, v] of Object.entries(HEAD)) if (e[k] !== v) return null;
  if (typeof e.fp !== 'string' || !/^[0-9a-f]{32}$/.test(e.fp)) return null;
  try {
    const ct = fromB64(e.ct), nonce = fromB64(e.nonce), aeadCt = fromB64(e.aead_ct);
    if (ct.length !== CT_BYTES || nonce.length !== NONCE_BYTES || aeadCt.length < GCM_TAG_BYTES) return null;
    return { fp: e.fp, ct, nonce, aeadCt };
  } catch (_) { return null; }
}

export async function unsealAccord(envelope, identity, { wasm, subtle, unwrapSecrets }) {
  if (!subtle) return { state: 'no-webcrypto' };
  const env = parseEnvelope(envelope);
  if (!env) return { state: 'malformed' };
  if (!identity || identity.fp !== env.fp) return { state: 'orphaned' };

  let dk;
  try { ({ dk } = await unwrapSecrets(identity)); }
  catch (_) { return { state: 'orphaned' }; }

  let plain;
  try {
    const ss = wasm.mlkem768_decaps(dk, env.ct);
    const key = await aesKey(subtle, wasm, ss, 'decrypt');
    plain = new Uint8Array(await subtle.decrypt(
      { name: 'AES-GCM', iv: env.nonce, additionalData: aadFor(env.fp) }, key, env.aeadCt,
    ));
  } catch (_) {
    return { state: 'tampered' };
  } finally {
    dk.fill(0);
  }

  try {
    let body;
    try { body = JSON.parse(fromUtf8(plain)); } finally { plain.fill(0); }
    const salt = fromB64(body.salt);
    if (salt.length !== SALT_BYTES || !body.baseAccord || typeof body.baseAccord !== 'object') return { state: 'malformed' };
    return { state: 'ok', baseAccord: body.baseAccord, salt };
  } catch (_) {
    return { state: 'malformed' };
  }
}

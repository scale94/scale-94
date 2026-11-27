// identityVault.js — one post-quantum identity per visitor (spec §5.2, §6.2, §6.5).
//
// The identity is an ML-KEM-768 keypair (seals) plus an ML-DSA-65 keypair (P4 signs).
// At rest the record holds ek and pk in the clear (both public), and dk and sk wrapped
// with AES-256-GCM under a NON-EXTRACTABLE CryptoKey that lives beside them in
// IndexedDB. Script on this origin can use that key, but nobody can export it.
//
// A thin bridge: every dependency is injected (wasm exports, SubtleCrypto, an RNG,
// a key/value store), so tests run the real primitives and no React lives here.
// The store is optional. Without one, or once it throws, the identity is held in
// memory and flagged volatile.
import { concatBytes, fromB64, fromUtf8, toB64, toHex, utf8 } from './bytes.js';

export const VOLATILE_LABEL = 'VOLATILE IDENTITY — will not survive reload';

const RECORD_KEY = 'identity';
const RECORD_V = 1;
const BACKUP_V = 1;
const BACKUP_AAD = utf8('scale94 identity backup v1');
const SIZES = { ek: 1184, dk: 2400, pk: 1952, sk: 32 };

/** First 16 bytes of SHA-256(ek ‖ pk), lower-case hex (32 chars). */
export async function fingerprint(ek, pk, subtle) {
  const d = new Uint8Array(await subtle.digest('SHA-256', concatBytes(ek, pk)));
  return toHex(d.subarray(0, 16));
}

/** '0123456789abcdef…' → '0123 4567 89ab …' (8 groups of 4). */
export const formatFingerprint = (fp) => String(fp).match(/.{1,4}/g)?.join(' ') ?? '';

const publicView = (rec, volatile) => ({
  ek: rec.ek, pk: rec.pk, fp: rec.fp, createdAt: rec.createdAt, volatile,
});

export function createIdentityVault({ wasm, subtle, getRandomValues, store = null, now = Date.now }) {
  let backend = store;   // set to null the first time it throws → volatile from then on
  let current = null;    // the record in memory
  let inflight = null;   // dedupes concurrent first creation
  let loaded = false;

  const volatile = () => backend === null;
  const nonce = () => getRandomValues(new Uint8Array(12));

  async function storeGet() {
    if (!backend) return null;
    try { return await backend.get(RECORD_KEY); }
    catch (_) { backend = null; return null; }
  }
  async function storePut(rec) {
    if (!backend) return;
    try { await backend.put(RECORD_KEY, rec); }
    catch (_) { backend = null; }
  }

  async function wrap(key, bytes, label, fp) {
    const n = nonce();
    const ct = new Uint8Array(await subtle.encrypt(
      { name: 'AES-GCM', iv: n, additionalData: utf8(`scale94 identity v1|${label}|${fp}`) }, key, bytes,
    ));
    return { nonce: n, ct };
  }
  async function unwrap(key, box, label, fp) {
    return new Uint8Array(await subtle.decrypt(
      { name: 'AES-GCM', iv: box.nonce, additionalData: utf8(`scale94 identity v1|${label}|${fp}`) }, key, box.ct,
    ));
  }

  /** Build and persist a record from raw keys; wipes dk/sk copies it was handed. */
  async function seal({ ek, dk, pk, sk, createdAt }) {
    const fp = await fingerprint(ek, pk, subtle);
    const wrapKey = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const rec = {
      v: RECORD_V, ek, pk, fp, createdAt,
      wrapKey,
      dk: await wrap(wrapKey, dk, 'dk', fp),
      sk: await wrap(wrapKey, sk, 'sk', fp),
    };
    dk.fill(0); sk.fill(0);
    await storePut(rec);
    current = rec;
    return rec;
  }

  async function freshRecord() {
    const kem = wasm.mlkem768_keygen();
    const dsa = wasm.mldsa65_keygen();
    return seal({ ek: kem.ek, dk: kem.dk, pk: dsa.pk, sk: dsa.sk, createdAt: now() });
  }

  async function load() {
    if (loaded) return current;
    const rec = await storeGet();
    if (rec && rec.v === RECORD_V && rec.wrapKey && rec.fp) current = rec;
    loaded = true;
    return current;
  }

  async function getIdentityIfExists() {
    const rec = await load();
    return rec ? publicView(rec, volatile()) : null;
  }

  async function getOrCreateIdentity() {
    if (inflight) return inflight;
    inflight = (async () => {
      const rec = (await load()) ?? (await freshRecord());
      return publicView(rec, volatile());
    })();
    try { return await inflight; }
    finally { inflight = null; }
  }

  async function unwrapSecrets(identity) {
    const rec = await load();
    if (!rec || !identity || identity.fp !== rec.fp) throw new Error('identity not held by this vault');
    return {
      dk: await unwrap(rec.wrapKey, rec.dk, 'dk', rec.fp),
      sk: await unwrap(rec.wrapKey, rec.sk, 'sk', rec.fp),
    };
  }

  async function rotate() {
    await load();
    const rec = await freshRecord();
    return publicView(rec, volatile());
  }

  async function exportBackup(passphrase) {
    const rec = await load();
    if (!rec) throw new Error('no identity to back up');
    const { dk, sk } = await unwrapSecrets(publicView(rec, false));
    const { m_kib, t, p } = wasm.aether_seal_params().argon2;
    const salt = getRandomValues(new Uint8Array(16));
    const raw = wasm.argon2id_derive_key(utf8(passphrase), salt);
    const key = await subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
    raw.fill(0);
    const plain = utf8(JSON.stringify({
      ek: toB64(rec.ek), dk: toB64(dk), pk: toB64(rec.pk), sk: toB64(sk), createdAt: rec.createdAt,
    }));
    dk.fill(0); sk.fill(0);
    const n = nonce();
    const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: n, additionalData: BACKUP_AAD }, key, plain));
    plain.fill(0);
    return utf8(JSON.stringify({
      v: BACKUP_V, kdf: { alg: 'Argon2id', m_kib, t, p, salt: toB64(salt) },
      aead: 'AES-256-GCM', nonce: toB64(n), ct: toB64(ct),
    }));
  }

  /** Never throws. On any failure the current identity is untouched. */
  async function importBackup(bytes, passphrase) {
    const malformed = { ok: false, reason: 'malformed' };
    let b, salt, n, ct;
    try {
      b = JSON.parse(fromUtf8(bytes));
      const want = wasm.aether_seal_params().argon2;
      if (b?.v !== BACKUP_V || b.aead !== 'AES-256-GCM' || b.kdf?.alg !== 'Argon2id'
        || b.kdf.m_kib !== want.m_kib || b.kdf.t !== want.t || b.kdf.p !== want.p) return malformed;
      salt = fromB64(b.kdf.salt); n = fromB64(b.nonce); ct = fromB64(b.ct);
      if (salt.length !== 16 || n.length !== 12) return malformed;
    } catch (_) { return malformed; }

    let plain;
    try {
      const raw = wasm.argon2id_derive_key(utf8(String(passphrase)), salt);
      const key = await subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
      raw.fill(0);
      plain = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: n, additionalData: BACKUP_AAD }, key, ct));
    } catch (_) { return { ok: false, reason: 'bad-passphrase' }; }

    try {
      const j = JSON.parse(fromUtf8(plain));
      plain.fill(0);
      const keys = { ek: fromB64(j.ek), dk: fromB64(j.dk), pk: fromB64(j.pk), sk: fromB64(j.sk) };
      for (const [k, len] of Object.entries(SIZES)) if (keys[k].length !== len) return malformed;
      if (!Number.isFinite(j.createdAt)) return malformed;
      // The keys must actually work as a pair before they replace anything.
      const probe = wasm.mlkem768_encaps(keys.ek);
      const ss = wasm.mlkem768_decaps(keys.dk.slice(), probe.ct);
      const msg = utf8('scale94 identity restore probe');
      const kemOk = ss.length === probe.ss.length && ss.every((x, i) => x === probe.ss[i]);
      const dsaOk = wasm.mldsa65_verify(keys.pk, msg, wasm.mldsa65_sign(keys.sk.slice(), msg));
      ss.fill(0); probe.ss.fill(0);
      if (!kemOk || !dsaOk) return malformed;
      await load();
      const rec = await seal({ ...keys, createdAt: j.createdAt });
      return { ok: true, identity: publicView(rec, volatile()) };
    } catch (_) { return malformed; }
  }

  return { getOrCreateIdentity, getIdentityIfExists, unwrapSecrets, exportBackup, importBackup, rotate };
}

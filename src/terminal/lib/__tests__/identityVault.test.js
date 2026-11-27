// identityVault: one ML-KEM-768 + ML-DSA-65 identity per visitor (spec §5.2, §6.2, §6.5).
// Real WASM primitives + Node WebCrypto; only the storage backend is in-memory.
import { describe, it, expect, beforeAll } from 'vitest';
import { webcrypto } from 'node:crypto';
import { loadWasmNode } from '../../../../tests/helpers/loadWasmNode.js';
import {
  createIdentityVault, fingerprint, formatFingerprint, VOLATILE_LABEL,
} from '../identityVault.js';

let wasm;
beforeAll(() => { wasm = loadWasmNode(); });

const subtle = webcrypto.subtle;
const getRandomValues = (a) => webcrypto.getRandomValues(a);

function memStore() {
  const m = new Map();
  return {
    map: m,
    async get(k) { return m.get(k) ?? null; },
    async put(k, v) { m.set(k, v); },
    async delete(k) { m.delete(k); },
  };
}

const vaultWith = (store) => createIdentityVault({ wasm, subtle, getRandomValues, store, now: () => 1_700_000_000_000 });
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

function containsSubarray(hay, needle) {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

function allBytes(obj, out = []) {
  if (obj instanceof Uint8Array) out.push(obj);
  else if (obj && typeof obj === 'object' && !(obj instanceof globalThis.CryptoKey)) {
    for (const v of Object.values(obj)) allBytes(v, out);
  }
  return out;
}

describe('identityVault', () => {
  it('creates once, then returns the same fp (also from a fresh vault on the same store)', async () => {
    const store = memStore();
    const a = await vaultWith(store).getOrCreateIdentity();
    expect(a.fp).toMatch(/^[0-9a-f]{32}$/);
    expect([a.ek.length, a.pk.length, a.volatile]).toEqual([1184, 1952, false]);
    expect((await vaultWith(store).getOrCreateIdentity()).fp).toBe(a.fp);
    expect((await vaultWith(store).getIdentityIfExists()).fp).toBe(a.fp);
  });

  it('getIdentityIfExists never creates', async () => {
    const store = memStore();
    expect(await vaultWith(store).getIdentityIfExists()).toBeNull();
    expect(store.map.size).toBe(0);
  });

  it('two concurrent getOrCreateIdentity calls produce one identity', async () => {
    const store = memStore();
    const v = vaultWith(store);
    const [a, b] = await Promise.all([v.getOrCreateIdentity(), v.getOrCreateIdentity()]);
    expect(a.fp).toBe(b.fp);
    expect((await vaultWith(store).getIdentityIfExists()).fp).toBe(a.fp);
  });

  it('fp = first 16 bytes of SHA-256(ek ‖ pk), formatted in 8 groups of 4', async () => {
    const id = await vaultWith(memStore()).getOrCreateIdentity();
    const both = new Uint8Array([...id.ek, ...id.pk]);
    const d = new Uint8Array(await subtle.digest('SHA-256', both)).slice(0, 16);
    expect(id.fp).toBe([...d].map((x) => x.toString(16).padStart(2, '0')).join(''));
    expect(await fingerprint(id.ek, id.pk, subtle)).toBe(id.fp);
    expect(formatFingerprint(id.fp)).toMatch(/^([0-9a-f]{4} ){7}[0-9a-f]{4}$/);
  });

  it('the stored record holds no raw dk or sk, and the wrap key is non-extractable', async () => {
    const store = memStore();
    const v = vaultWith(store);
    const id = await v.getOrCreateIdentity();
    const { dk, sk } = await v.unwrapSecrets(id);
    expect([dk.length, sk.length]).toEqual([2400, 32]);
    const rec = [...store.map.values()][0];
    expect(rec.wrapKey).toBeInstanceOf(globalThis.CryptoKey);
    expect(rec.wrapKey.extractable).toBe(false);
    for (const b of allBytes(rec)) {
      expect(containsSubarray(b, dk.subarray(0, 64))).toBe(false);
      expect(containsSubarray(b, sk)).toBe(false);
    }
  });

  it('unwrapped secrets work: decaps a ct made against ek, and sign verifies under pk', async () => {
    const v = vaultWith(memStore());
    const id = await v.getOrCreateIdentity();
    const { ct, ss } = wasm.mlkem768_encaps(id.ek);
    const { dk, sk } = await v.unwrapSecrets(id);
    expect(same(wasm.mlkem768_decaps(dk, ct), ss)).toBe(true);
    const msg = new TextEncoder().encode('m');
    expect(wasm.mldsa65_verify(id.pk, msg, wasm.mldsa65_sign(sk, msg))).toBe(true);
  });

  it('backup → import into a fresh vault gives the same fp and working secrets', async () => {
    const v1 = vaultWith(memStore());
    const id = await v1.getOrCreateIdentity();
    const { ct, ss } = wasm.mlkem768_encaps(id.ek);
    const backup = await v1.exportBackup('a long enough passphrase');
    const v2 = vaultWith(memStore());
    const res = await v2.importBackup(backup, 'a long enough passphrase');
    expect(res.ok).toBe(true);
    expect(res.identity.fp).toBe(id.fp);
    expect((await v2.getOrCreateIdentity()).fp).toBe(id.fp);
    const { dk } = await v2.unwrapSecrets(res.identity);
    expect(same(wasm.mlkem768_decaps(dk, ct), ss)).toBe(true);
  }, 30_000);

  it('the backup names the real KDF parameters (equal to aether_seal_params().argon2)', async () => {
    const v = vaultWith(memStore());
    await v.getOrCreateIdentity();
    const b = JSON.parse(new TextDecoder().decode(await v.exportBackup('a long enough passphrase')));
    const { m_kib, t, p } = wasm.aether_seal_params().argon2;
    expect(b.kdf).toMatchObject({ alg: 'Argon2id', m_kib, t, p });
    expect(b.aead).toBe('AES-256-GCM');
    expect(Object.keys(b).sort()).toEqual(['aead', 'ct', 'kdf', 'nonce', 'v']);
  });

  it('wrong passphrase → bad-passphrase; the current identity is unchanged', async () => {
    const src = vaultWith(memStore());
    await src.getOrCreateIdentity();
    const backup = await src.exportBackup('a long enough passphrase');
    const dst = vaultWith(memStore());
    const mine = await dst.getOrCreateIdentity();
    expect(await dst.importBackup(backup, 'not the passphrase!!')).toEqual({ ok: false, reason: 'bad-passphrase' });
    expect((await dst.getOrCreateIdentity()).fp).toBe(mine.fp);
  });

  it('truncated or non-JSON backup → malformed; the current identity is unchanged', async () => {
    const src = vaultWith(memStore());
    await src.getOrCreateIdentity();
    const backup = await src.exportBackup('a long enough passphrase');
    const dst = vaultWith(memStore());
    const mine = await dst.getOrCreateIdentity();
    expect(await dst.importBackup(backup.subarray(0, backup.length - 9), 'a long enough passphrase'))
      .toEqual({ ok: false, reason: 'malformed' });
    expect(await dst.importBackup(new TextEncoder().encode('{"v":1}'), 'x')).toEqual({ ok: false, reason: 'malformed' });
    expect((await dst.getOrCreateIdentity()).fp).toBe(mine.fp);
  });

  it('rotate changes fp and persists the new identity', async () => {
    const store = memStore();
    const v = vaultWith(store);
    const a = await v.getOrCreateIdentity();
    const b = await v.rotate();
    expect(b.fp).not.toBe(a.fp);
    expect((await vaultWith(store).getIdentityIfExists()).fp).toBe(b.fp);
  });

  it('a throwing store gives a volatile identity that still works', async () => {
    const broken = {
      async get() { throw new Error('IDB blocked'); },
      async put() { throw new Error('IDB blocked'); },
      async delete() { throw new Error('IDB blocked'); },
    };
    const v = vaultWith(broken);
    const id = await v.getOrCreateIdentity();
    expect(id.volatile).toBe(true);
    expect((await v.getOrCreateIdentity()).fp).toBe(id.fp);
    const { dk } = await v.unwrapSecrets(id);
    const { ct, ss } = wasm.mlkem768_encaps(id.ek);
    expect(same(wasm.mlkem768_decaps(dk, ct), ss)).toBe(true);
    expect(VOLATILE_LABEL).toBe('VOLATILE IDENTITY — will not survive reload');
  });

  it('store null is volatile from the start', async () => {
    expect((await vaultWith(null).getOrCreateIdentity()).volatile).toBe(true);
  });
});

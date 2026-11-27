// accordSeal: ML-KEM-768 → BLAKE3 derive_key → AES-256-GCM envelope (spec §5.2, §6.3).
// Real WASM + Node WebCrypto + the real identity vault (in-memory store).
import { describe, it, expect, beforeAll } from 'vitest';
import { webcrypto } from 'node:crypto';
import { loadWasmNode } from '../../../../tests/helpers/loadWasmNode.js';
import { createIdentityVault } from '../identityVault.js';
import { sealAccord, unsealAccord, envelopeSizes, KDF_CONTEXT } from '../accordSeal.js';
import { fromB64, toB64 } from '../bytes.js';

const subtle = webcrypto.subtle;
const getRandomValues = (a) => webcrypto.getRandomValues(a);
const memStore = () => { const m = new Map(); return { get: async (k) => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); } }; };

let wasm, vault, identity;
const baseAccord = {
  rows: [{ materialId: 'fx-iso-e', parts: 0.4 }, { materialId: 'fx-hedione', parts: 0.6 }],
  notes: [{ note: 'Vetiver', cardLayer: 'base', materials: [{ materialId: 'fx-iso-e', parts: 1 }] }],
};
const salt = new Uint8Array(32).map((_, i) => i);

beforeAll(async () => {
  wasm = loadWasmNode();
  vault = createIdentityVault({ wasm, subtle, getRandomValues, store: memStore() });
  identity = await vault.getOrCreateIdentity();
});

const sealDeps = () => ({ wasm, subtle, getRandomValues });
const unsealDeps = () => ({ wasm, subtle, unwrapSecrets: vault.unwrapSecrets });
const flip = (b64, i = 5) => { const b = fromB64(b64); b[i] ^= 1; return toB64(b); };

describe('accordSeal', () => {
  it('the KDF context string is exact', () => {
    expect(KDF_CONTEXT).toBe('scale94 scent accord seal v1');
  });

  it('seal → unseal gives back the same base accord and salt', async () => {
    const env = await sealAccord({ baseAccord, salt }, identity, sealDeps());
    const r = await unsealAccord(env, identity, unsealDeps());
    expect(r.state).toBe('ok');
    expect(r.baseAccord).toEqual(baseAccord);
    expect(Array.from(r.salt)).toEqual(Array.from(salt));
  });

  it("the envelope has exactly the spec's eight fields and values", async () => {
    const env = await sealAccord({ baseAccord, salt }, identity, sealDeps());
    expect(Object.keys(env).sort()).toEqual(['aead', 'aead_ct', 'ct', 'fp', 'kdf', 'kem', 'nonce', 'v']);
    expect(env).toMatchObject({ v: 1, kem: 'ML-KEM-768', kdf: 'BLAKE3-derive_key', aead: 'AES-256-GCM', fp: identity.fp });
    expect(fromB64(env.ct).length).toBe(1088);
    expect(fromB64(env.nonce).length).toBe(12);
    expect(envelopeSizes(env)).toEqual({ ct: 1088, aead: fromB64(env.aead_ct).length });
  });

  it('two seals of the same accord differ in ct, nonce and aead_ct', async () => {
    const a = await sealAccord({ baseAccord, salt }, identity, sealDeps());
    const b = await sealAccord({ baseAccord, salt }, identity, sealDeps());
    expect(a.ct).not.toBe(b.ct);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.aead_ct).not.toBe(b.aead_ct);
  });

  it.each(['ct', 'nonce', 'aead_ct'])('flipping one byte of %s → tampered', async (field) => {
    const env = await sealAccord({ baseAccord, salt }, identity, sealDeps());
    expect(await unsealAccord({ ...env, [field]: flip(env[field], 3) }, identity, unsealDeps()))
      .toEqual({ state: 'tampered' });
  });

  it('an envelope re-pointed at another holder (fp rewritten) → tampered for that holder', async () => {
    const other = createIdentityVault({ wasm, subtle, getRandomValues, store: memStore() });
    const otherId = await other.getOrCreateIdentity();
    const env = await sealAccord({ baseAccord, salt }, identity, sealDeps());
    expect(await unsealAccord({ ...env, fp: otherId.fp }, otherId, { wasm, subtle, unwrapSecrets: other.unwrapSecrets }))
      .toEqual({ state: 'tampered' });
  });

  it('no identity → orphaned; a different identity → orphaned', async () => {
    const env = await sealAccord({ baseAccord, salt }, identity, sealDeps());
    expect(await unsealAccord(env, null, unsealDeps())).toEqual({ state: 'orphaned' });
    const other = await createIdentityVault({ wasm, subtle, getRandomValues, store: memStore() }).getOrCreateIdentity();
    expect(await unsealAccord(env, other, unsealDeps())).toEqual({ state: 'orphaned' });
  });

  it('garbage base64, a wrong-length ct or a missing field → malformed', async () => {
    const env = await sealAccord({ baseAccord, salt }, identity, sealDeps());
    expect(await unsealAccord({ ...env, ct: '!!!' }, identity, unsealDeps())).toEqual({ state: 'malformed' });
    expect(await unsealAccord({ ...env, ct: toB64(fromB64(env.ct).subarray(1)) }, identity, unsealDeps())).toEqual({ state: 'malformed' });
    const { nonce: _n, ...noNonce } = env;
    expect(await unsealAccord(noNonce, identity, unsealDeps())).toEqual({ state: 'malformed' });
    expect(await unsealAccord({ ...env, kem: 'ML-KEM-1024' }, identity, unsealDeps())).toEqual({ state: 'malformed' });
    expect(await unsealAccord(null, identity, unsealDeps())).toEqual({ state: 'malformed' });
  });

  it('no SubtleCrypto → no-webcrypto', async () => {
    const env = await sealAccord({ baseAccord, salt }, identity, sealDeps());
    expect(await unsealAccord(env, identity, { ...unsealDeps(), subtle: undefined })).toEqual({ state: 'no-webcrypto' });
  });

  it('unseal never rejects, even when unwrapSecrets throws', async () => {
    const env = await sealAccord({ baseAccord, salt }, identity, sealDeps());
    const boom = { wasm, subtle, unwrapSecrets: async () => { throw new Error('gone'); } };
    await expect(unsealAccord(env, identity, boom)).resolves.toEqual({ state: 'orphaned' });
  });

  it('seal rejects a salt that is not 32 bytes', async () => {
    await expect(sealAccord({ baseAccord, salt: new Uint8Array(31) }, identity, sealDeps())).rejects.toThrow(/32 bytes/);
  });
});

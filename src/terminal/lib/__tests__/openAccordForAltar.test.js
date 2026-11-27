// The altar opens the sealed accord (spec §5.3, §6.3; P3 rulings 1–2).
// Real WASM, real WebCrypto, the real kit; only the identity store is in-memory.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import { loadWasmNode } from '../../../../tests/helpers/loadWasmNode.js';
import { createIdentityVault } from '../identityVault.js';
import { sealAccordForSpine } from '../sealAccordForSpine.js';
import { openAccordForAltar, ALTAR_LINES } from '../openAccordForAltar.js';
import { fromB64, toB64 } from '../bytes.js';
import {
  getSpine, missingVertebrae, setScent, _resetSpineForTests,
  SCENT_BROKEN, SCENT_ORPHANED,
} from '../../quintessence/spineStore';
import { isScentMarked } from '../../quintessence/vertebrae';
import { REAL_CARD, REAL_ACCORD } from '../../scent/__tests__/accordFixture';

const subtle = webcrypto.subtle;
const getRandomValues = (a) => webcrypto.getRandomValues(a);
const memStore = () => { const m = new Map(); return { get: async (k) => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); } }; };

let wasm;
beforeAll(() => { wasm = loadWasmNode(); });
beforeEach(() => _resetSpineForTests());

async function sealed() {
  const vault = createIdentityVault({ wasm, subtle, getRandomValues, store: memStore() });
  const d = { vault, subtle, getRandomValues, loadWasm: async () => wasm, getVault: async () => vault };
  const r = await sealAccordForSpine(REAL_CARD, d);
  expect(r.state).toBe('sealed');
  return d;
}
const open = (d, over = {}) => openAccordForAltar(getSpine(), { loadWasm: d.loadWasm, getVault: d.getVault, subtle, ...over });

function tamper(field) {
  const s = getSpine().scent;
  const bytes = fromB64(s.envelope[field]);
  bytes[bytes.length >> 1] ^= 0x01;
  setScent({ ...s, envelope: { ...s.envelope, [field]: toB64(bytes) } });
}

describe('openAccordForAltar', () => {
  it('ok: the accord crystallize sealed, a 32-byte salt, and the real envelope sizes', async () => {
    const d = await sealed();
    const r = await open(d);
    expect(r.state).toBe('ok');
    expect(r.baseAccord).toEqual(REAL_ACCORD);
    expect(r.salt).toBeInstanceOf(Uint8Array);
    expect(r.salt).toHaveLength(32);
    const env = getSpine().scent.envelope;
    expect(r.envelopeMeta).toEqual({
      kem: 'ML-KEM-768', kdf: 'BLAKE3-derive_key', aead: 'AES-256-GCM',
      ctBytes: 1088, aeadBytes: fromB64(env.aead_ct).length, fp: env.fp,
    });
    expect(isScentMarked(getSpine())).toBe(true);
  });

  // Review Focus 3
  it.each(['aead_ct', 'nonce', 'ct'])('one flipped byte of %s → tampered; the mark falls as SEAL BROKEN', async (field) => {
    const d = await sealed();
    tamper(field);
    const r = await open(d);
    expect(r).toEqual({ state: 'tampered', line: ALTAR_LINES.tampered });
    expect(r.line).toBe(SCENT_BROKEN);
    expect(isScentMarked(getSpine())).toBe(false);
    expect(missingVertebrae().at(-1)).toBe(SCENT_BROKEN);
  });

  it('a malformed envelope → malformed; the mark falls as SEAL BROKEN', async () => {
    const d = await sealed();
    const s = getSpine().scent;
    setScent({ ...s, envelope: { ...s.envelope, ct: 'AAAA' } });
    const r = await open(d);
    expect(r.state).toBe('malformed');
    expect(missingVertebrae().at(-1)).toBe(SCENT_BROKEN);
  });

  it('rotated identity → orphaned; the P2 line; the mark falls', async () => {
    const d = await sealed();
    await d.vault.rotate();
    const r = await open(d);
    expect(r).toEqual({ state: 'orphaned', line: SCENT_ORPHANED });
    expect(missingVertebrae().at(-1)).toBe(SCENT_ORPHANED);
  });

  it('no identity on this device → orphaned', async () => {
    const d = await sealed();
    const empty = createIdentityVault({ wasm, subtle, getRandomValues, store: memStore() });
    const r = await open(d, { getVault: async () => empty });
    expect(r.state).toBe('orphaned');
    expect(isScentMarked(getSpine())).toBe(false);
  });

  it('the key cannot be unwrapped (fp matches) → orphaned, never left marked', async () => {
    const d = await sealed();
    const v = d.vault;
    const broken = { ...v, getIdentityIfExists: v.getIdentityIfExists, unwrapSecrets: async () => { throw new Error('idb'); } };
    const r = await open(d, { getVault: async () => broken });
    expect(r.state).toBe('orphaned');
    expect(isScentMarked(getSpine())).toBe(false);
  });

  it('no WebCrypto → named; spine untouched', async () => {
    const d = await sealed();
    const before = getSpine();
    const r = await open(d, { subtle: null });
    expect(r).toEqual({ state: 'no-webcrypto', line: ALTAR_LINES['no-webcrypto'] });
    expect(r.line).toBe('THE ACCORD CANNOT OPEN ON THIS ORIGIN — no WebCrypto');
    expect(getSpine()).toEqual(before);
  });

  it('WASM fails to load → named; spine untouched', async () => {
    const d = await sealed();
    const before = getSpine();
    const r = await open(d, { loadWasm: async () => { throw new Error('no wasm'); } });
    expect(r).toEqual({ state: 'wasm-unavailable', line: 'THE ACCORD CANNOT OPEN ON THIS ORIGIN — the kernel did not load' });
    expect(getSpine()).toEqual(before);
  });

  it('never rejects, even when every dependency throws', async () => {
    await sealed();
    const boom = async () => { throw new Error('boom'); };
    await expect(openAccordForAltar(getSpine(), { loadWasm: async () => wasm, getVault: boom, subtle })).resolves.toMatchObject({ state: 'error' });
    await expect(openAccordForAltar(null, { loadWasm: async () => wasm, getVault: boom, subtle })).resolves.toMatchObject({ state: 'malformed' });
  });

  it('a fresh crystallize after a broken seal marks the vertebra again', async () => {
    const d = await sealed();
    tamper('aead_ct');
    await open(d);
    expect(isScentMarked(getSpine())).toBe(false);
    await sealAccordForSpine(REAL_CARD, d);
    expect(isScentMarked(getSpine())).toBe(true);
    expect((await open(d)).state).toBe('ok');
  });
});

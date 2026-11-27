// The aether seal exports, run against the REAL shipped binary
// (public/wasm/scale94_kernels_bg.wasm), never a mock. Spec §5.2, plan Task 2.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadWasmNode } from './helpers/loadWasmNode.js';

let w;
beforeAll(() => { w = loadWasmNode(); });

const enc = (s) => new TextEncoder().encode(s);

describe('aether seal WASM exports', () => {
  it('mlkem768 keygen/encaps/decaps: FIPS 203 lengths, shared secrets agree', () => {
    const { ek, dk } = w.mlkem768_keygen();
    expect([ek.length, dk.length]).toEqual([1184, 2400]);
    const { ct, ss } = w.mlkem768_encaps(ek);
    expect([ct.length, ss.length]).toEqual([1088, 32]);
    expect(Array.from(w.mlkem768_decaps(dk, ct))).toEqual(Array.from(ss));
  });

  it('mlkem768 wrong-length input throws a JS error, not a trap', () => {
    const { ek } = w.mlkem768_keygen();
    expect(() => w.mlkem768_encaps(ek.subarray(1))).toThrow(/1184 bytes/);
  });

  it('mldsa65 keygen/sign/verify: lengths, round trip, tamper → false', () => {
    const { pk, sk } = w.mldsa65_keygen();
    expect([pk.length, sk.length]).toEqual([1952, 32]);
    const msg = enc('the scent house');
    const sig = w.mldsa65_sign(sk, msg);
    expect(sig.length).toBe(3309);
    expect(w.mldsa65_verify(pk, msg, sig)).toBe(true);
    expect(w.mldsa65_verify(pk, enc('the scent housE'), sig)).toBe(false);
    const bad = sig.slice(); bad[7] ^= 1;
    expect(w.mldsa65_verify(pk, msg, bad)).toBe(false);
  });

  it('blake3_derive_key is 32 bytes and context-separated', () => {
    const ikm = new Uint8Array(32).fill(3);
    const a = w.blake3_derive_key('scale94 scent accord seal v1', ikm);
    const b = w.blake3_derive_key('scale94 scent accord seal v2', ikm);
    expect(a.length).toBe(32);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it('aether_seal_params is the record the labels read', () => {
    expect(w.aether_seal_params()).toEqual({
      mlkem: 'ML-KEM-768', mldsa: 'ML-DSA-65', mldsa_crate: '0.1.0-rc.7', mlkem_crate: '0.2.3',
      argon2: { m_kib: 65536, t: 3, p: 4 },
    });
  });

  it('argon2id_derive_key: 32 bytes, deterministic per salt, rejects a 15-byte salt', () => {
    const salt = new Uint8Array(16).fill(5);
    const t0 = performance.now();
    const k1 = w.argon2id_derive_key(enc('correct horse battery'), salt);
    const ms = performance.now() - t0;
    console.info(`[aether] argon2id m=64MiB t=3 p=4 in node WASM: ${ms.toFixed(0)} ms`);
    expect(k1.length).toBe(32);
    expect(Array.from(w.argon2id_derive_key(enc('correct horse battery'), salt))).toEqual(Array.from(k1));
    expect(() => w.argon2id_derive_key(enc('pw'), new Uint8Array(15))).toThrow(/16 bytes/);
  }, 60_000);
});

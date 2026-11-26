// @vitest-environment node
// The terminal runs a registry entry as mod[entry.fn](...entry.args). These tests
// check the registry against the real committed binary, not a mock of it.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import registry from '../src/wasm/wasm.generated.js';
import * as mod from '../src/wasm/scale94_kernels.js';

beforeAll(() => {
  mod.initSync({ module: readFileSync('public/wasm/scale94_kernels_bg.wasm') });
});

describe('WASM kernel registry', () => {
  it('names a real export in every entry', () => {
    const broken = Object.values(registry)
      .map(e => e.fn ?? e.struct)
      .filter(name => typeof mod[name] !== 'function');
    expect(broken).toEqual([]);
  });

  // /wasm is cached as immutable, so the ?v= query is the only way a rebuilt binary
  // reaches returning visitors. A stale one means: run `npm run rust:registry`.
  it('cache-busts with the hash of the committed binary', () => {
    const hash = createHash('sha256')
      .update(readFileSync('public/wasm/scale94_kernels_bg.wasm')).digest('hex').slice(0, 8);
    expect([...new Set(Object.values(registry).map(e => e.wasmUrl))])
      .toEqual([`/wasm/scale94_kernels_bg.wasm?v=${hash}`]);
  });

  describe('Fade Doctrine', () => {
    const entry = registry['FADE-DOCTRINE-KERNEL-2.0.0'];
    const run = args => mod[entry.fn](...args);

    it('calls run_lindblad_fade with one default per parameter', () => {
      expect(entry.fn).toBe('run_lindblad_fade');
      expect(entry.args).toHaveLength(mod.run_lindblad_fade.length);
      expect(entry.params.map(p => p.name))
        .toEqual(['gamma', 'hilbert_dim', 'kauffman_k', 'drive_omega']);
      expect(entry.params.map(p => p.default)).toEqual(entry.args);
    });

    it('runs on its defaults and reports them', () => {
      const out = run(entry.args);
      expect(out).toContain('γ = 0.100000');
      expect(out).toContain('N = 16');
      expect(out).toContain('K = 2.000');
      expect(out).toContain('Ω = 1.000000');
      expect(out).not.toMatch(/NaN|undefined/);
    });

    it.each([
      ['gamma',   'g',       0, 0.5, 'γ = 0.500000'],
      ['dim',     'n',       1, 8,   'N = 8'],
      ['k',       'kauffman', 2, 1,  'K = 1.000'],
      ['omega',   'drive',   3, 3,   'Ω = 3.000000'],
    ])('routes --%s and --%s to parameter %i', (flag, other, index, value, expected) => {
      expect(entry.argMap[flag]).toBe(index);
      expect(entry.argMap[other]).toBe(index);
      const args = [...entry.args];
      args[index] = value;
      expect(run(args)).toContain(expected);
    });
  });
});

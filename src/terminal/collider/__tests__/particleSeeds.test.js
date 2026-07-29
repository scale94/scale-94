import { describe, it, expect } from 'vitest';
import { buildParticleSeeds, PARTICLE_COUNT, SEED_STRIDE } from '../particleSeeds';

describe('buildParticleSeeds', () => {
  it('returns count * 4 floats', () => {
    expect(buildParticleSeeds(10)).toHaveLength(40);
    expect(buildParticleSeeds()).toHaveLength(PARTICLE_COUNT * SEED_STRIDE);
  });

  it('is deterministic — the parity snapshot depends on this', () => {
    expect(Array.from(buildParticleSeeds(64)))
      .toEqual(Array.from(buildParticleSeeds(64)));
  });

  it('is a prefix-stable sequence: a bigger buffer extends, never reshuffles', () => {
    const small = buildParticleSeeds(16);
    const big = buildParticleSeeds(64);
    expect(Array.from(big.slice(0, 64))).toEqual(Array.from(small));
  });

  it('keeps lane in [-1,1) and the three hashes in [0,1)', () => {
    const s = buildParticleSeeds(512);
    for (let i = 0; i < 512; i++) {
      expect(s[i * 4 + 0]).toBeGreaterThanOrEqual(-1);
      expect(s[i * 4 + 0]).toBeLessThan(1);
      for (const k of [1, 2, 3]) {
        expect(s[i * 4 + k]).toBeGreaterThanOrEqual(0);
        expect(s[i * 4 + k]).toBeLessThan(1);
      }
    }
  });

  it('spreads: no two adjacent particles share a birthPhase, and both streams are populated', () => {
    const s = buildParticleSeeds(512);
    let same = 0;
    let streamA = 0;
    for (let i = 1; i < 512; i++) if (s[i * 4 + 1] === s[(i - 1) * 4 + 1]) same++;
    for (let i = 0; i < 512; i++) if (s[i * 4 + 3] < 0.5) streamA++;
    expect(same).toBe(0);
    // hash2 < 0.5 selects stream A in the vertex shader; a degenerate hash
    // that put every particle in one stream would render a one-sided collision.
    expect(streamA).toBeGreaterThan(150);
    expect(streamA).toBeLessThan(362);
  });

  it('rejects a non-positive or non-integer count', () => {
    expect(() => buildParticleSeeds(0)).toThrow(RangeError);
    expect(() => buildParticleSeeds(-4)).toThrow(RangeError);
    expect(() => buildParticleSeeds(3.5)).toThrow(RangeError);
  });
});

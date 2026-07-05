import { describe, it, expect } from 'vitest';
import { SIXTEEN_MINDS, mindProfile } from '../sixteenMinds';
import { DIM_NAMES } from '../nodeFeatures';

const LEGACY_DIMS = DIM_NAMES.slice(0, 16);

describe('sixteenMinds schema', () => {
  it('has exactly 16 minds with unique dimIndex 0..15', () => {
    expect(SIXTEEN_MINDS).toHaveLength(16);
    const idx = SIXTEEN_MINDS.map(m => m.dimIndex).sort((a, b) => a - b);
    expect(idx).toEqual([...Array(16).keys()]);
  });

  it('every mind has affinities over valid legacy dims, keyWorks, excerpt', () => {
    for (const m of SIXTEEN_MINDS) {
      expect(Object.keys(m.affinities).length).toBeGreaterThanOrEqual(3);
      for (const name of Object.keys(m.affinities)) {
        expect(LEGACY_DIMS).toContain(name);
        expect(name).not.toBe(m.dimName); // self-dim is implicit 1.0
      }
      expect(m.keyWorks.length).toBeGreaterThanOrEqual(1);
      for (const w of m.keyWorks) {
        expect(typeof w.title).toBe('string');
        expect(typeof w.year).toBe('number');
      }
      expect(typeof m.excerpt).toBe('string');
      expect(m.excerpt.length).toBeGreaterThan(10);
    }
  });

  it('mindProfile: self-dim 1.0, affinities applied, 0.05 floor, length 16', () => {
    const meadows = SIXTEEN_MINDS.find(m => m.dimIndex === 0);
    const p = mindProfile(meadows);
    expect(p).toHaveLength(16);
    expect(p[0]).toBe(1.0);
    expect(p[15]).toBeCloseTo(meadows.affinities.economic);
    // a dim with no affinity gets the floor
    const untouched = LEGACY_DIMS.findIndex(
      (n, i) => i !== 0 && !(n in meadows.affinities)
    );
    expect(p[untouched]).toBeCloseTo(0.05);
  });
});

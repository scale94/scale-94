import { describe, it, expect } from 'vitest';
import { SIXTEEN_MINDS } from '../src/terminal/data/sixteenMinds.js';
import { DIM_NAMES } from '../src/terminal/data/nodeFeatures.js';

describe('SIXTEEN_MINDS roster', () => {
  it('has exactly 16 entries', () => {
    expect(SIXTEEN_MINDS).toHaveLength(16);
  });

  it('covers dim indices 0..15 uniquely', () => {
    const idx = SIXTEEN_MINDS.map(m => m.dimIndex).sort((a, b) => a - b);
    expect(idx).toEqual([...Array(16).keys()]);
  });

  it('agrees with DIM_NAMES on every dimName', () => {
    for (const m of SIXTEEN_MINDS) {
      expect(m.dimName).toBe(DIM_NAMES[m.dimIndex]);
    }
  });

  it('splits exactly 8 canon / 8 sidelined', () => {
    const canon = SIXTEEN_MINDS.filter(m => m.caste === 'canon').length;
    const side  = SIXTEEN_MINDS.filter(m => m.caste === 'sidelined').length;
    expect(canon).toBe(8);
    expect(side).toBe(8);
  });

  it('only uses canon|sidelined for caste', () => {
    for (const m of SIXTEEN_MINDS) {
      expect(['canon', 'sidelined']).toContain(m.caste);
    }
  });

  it('has non-empty payload fields on every entry', () => {
    const fields = ['anchorName', 'era', 'coreEquation', 'systemDirective', 'epigraph', 'body'];
    for (const m of SIXTEEN_MINDS) {
      for (const f of fields) {
        expect(typeof m[f]).toBe('string');
        expect(m[f].trim().length).toBeGreaterThan(0);
      }
    }
  });
});

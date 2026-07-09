import { describe, it, expect } from 'vitest';
import { LUNAR_ACCORDS, DRYNESS, drynessFor } from '../../data/lunarAccords';

// NOTE: order matches the verbatim source array (and its PHASES cycle: new →
// waxing-crescent → first-quarter → waxing-gibbous → full → waning-gibbous →
// last-quarter → waning-crescent), i.e. MINERAL STILLNESS (last-quarter)
// precedes SMOKE DISSOLUTION (waning-crescent).
const NAMES = [
  'DARK INCUBATION', 'GREEN EMERGENCE', 'ANGULAR CITRUS', 'FLORAL AMPLIFICATION',
  'MAXIMUM PROJECTION', 'RESINOUS DESCENT', 'MINERAL STILLNESS', 'SMOKE DISSOLUTION',
];

describe('lunarAccords', () => {
  it('exports exactly the eight accords in cycle order', () => {
    expect(LUNAR_ACCORDS.map(a => a.accord)).toEqual(NAMES);
  });

  it('DRYNESS covers all eight accords with the spec §3.2 values', () => {
    expect(DRYNESS).toEqual({
      'DARK INCUBATION': 12, 'GREEN EMERGENCE': 24, 'ANGULAR CITRUS': 38,
      'FLORAL AMPLIFICATION': 50, 'MAXIMUM PROJECTION': 62, 'RESINOUS DESCENT': 74,
      'SMOKE DISSOLUTION': 85, 'MINERAL STILLNESS': 96,
    });
  });

  it('drynessFor is total: known accord → table value, unknown → 50 (center)', () => {
    expect(drynessFor('MINERAL STILLNESS')).toBe(96);
    expect(drynessFor('NOT A PHASE')).toBe(50);
    expect(drynessFor(null)).toBe(50);
  });
});

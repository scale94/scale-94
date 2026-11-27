import { describe, it, expect } from 'vitest';
import { readModulators, restWeeksFor, solTiltFor, chaosReachFor } from '../modulators';
import { DRYNESS } from '../../data/lunarAccords';
import { E_MIN_ERG, E_MAX_ERG } from '../../sol/solPhysics';
import { CHAOS_REACH_RANGE } from '../formulaEngine';

const read = (over = {}) => readModulators({ element: 'EARTH', phase: 'DARK INCUBATION', periphery: { sol: null, art: null }, ...over });

describe('/LUNAR → rest weeks (ruling 3)', () => {
  const table = {
    'DARK INCUBATION': 2, 'GREEN EMERGENCE': 3, 'ANGULAR CITRUS': 4, 'FLORAL AMPLIFICATION': 5,
    'MAXIMUM PROJECTION': 6, 'RESINOUS DESCENT': 6, 'SMOKE DISSOLUTION': 7, 'MINERAL STILLNESS': 8,
  };
  it.each(Object.entries(table))('%s → %i weeks', (phase, weeks) => {
    expect(restWeeksFor(DRYNESS[phase])).toBe(weeks);
    expect(read({ phase }).restWeeks).toBe(weeks);
  });
  it('covers every phase in DRYNESS', () => {
    expect(Object.keys(table).sort()).toEqual(Object.keys(DRYNESS).sort());
  });
  it("an unknown phase reads drynessFor's 50 → 5 weeks", () => {
    expect(read({ phase: 'NOT A PHASE' }).restWeeks).toBe(5);
  });
  it('names the phase and its dryness', () => {
    const m = read({ phase: 'SMOKE DISSOLUTION' });
    expect(m.labels.lunar).toBe('SMOKE DISSOLUTION');
    expect(m.sources.lunar).toEqual({ phase: 'SMOKE DISSOLUTION', dryness: 85 });
  });
});

describe('/SOL → tilt (ruling 3)', () => {
  const landed = (erg) => ({ inFlight: [], landings: [], lastReleaseErg: erg, forge: null });
  it('E_MIN → −1, E_MAX → +1, log midpoint → 0', () => {
    expect(solTiltFor(landed(E_MIN_ERG))).toBe(-1);
    expect(solTiltFor(landed(E_MAX_ERG))).toBe(1);
    expect(solTiltFor(landed(Math.sqrt(E_MIN_ERG * E_MAX_ERG)))).toBeCloseTo(0, 12);
  });
  it('clamps outside the store range', () => {
    expect(solTiltFor(landed(1e20))).toBe(-1);
    expect(solTiltFor(landed(1e40))).toBe(1);
  });
  it('a release reads as a clause naming its energy', () => {
    const m = read({ periphery: { sol: landed(3.2e31), art: null } });
    expect(m.solTilt).toBeGreaterThan(0);
    expect(m.labels.sol).toBe('last release 3.2e31 erg');
    expect(m.sources.sol).toEqual({ lastReleaseErg: 3.2e31 });
  });
  it('visits only → no tilt, its own named line', () => {
    const m = read({ periphery: { sol: { visits: 2 }, art: null } });
    expect(m.solTilt).toBeNull();
    expect(m.labels.sol).toBeNull();
    expect(m.labels.solAbsent).toBe('/SOL entered — nothing left the star, the top notes left alone');
    expect(m.sources.sol).toEqual({ visits: 2 });
  });
  it('null → no tilt, no labels (the P1 line stands)', () => {
    const m = read();
    expect(m.solTilt).toBeNull();
    expect(m.labels.sol).toBeNull();
    expect(m.labels.solAbsent).toBeNull();
    expect(m.sources.sol).toBeNull();
  });
});

describe('/CHAOS periphery → reach (ruling 3)', () => {
  it('λ ≤ 0 → 0.05; λ = ln 2 → 0.30; above clamps', () => {
    expect(chaosReachFor({ lyapunov: -0.4, lastR: 2.9 })).toBe(0.05);
    expect(chaosReachFor({ lyapunov: 0 })).toBe(0.05);
    expect(chaosReachFor({ lyapunov: Math.LN2 })).toBeCloseTo(0.30, 12);
    expect(chaosReachFor({ lyapunov: 2 })).toBeCloseTo(0.30, 12);
  });
  it('λ absent, r present → r term', () => {
    expect(chaosReachFor({ lyapunov: null, lastR: 3.5 })).toBeCloseTo(0.175, 12);
    expect(chaosReachFor({ lyapunov: null, lastR: 2.5 })).toBe(0.05);
    expect(chaosReachFor({ lyapunov: null, lastR: 4 })).toBeCloseTo(0.30, 12);
  });
  it('touched without a regime reading, visits only, or null → default reach', () => {
    expect(chaosReachFor({ lyapunov: null, lastR: null, chimeras: 2 })).toBeNull();
    expect(chaosReachFor({ visits: 3 })).toBeNull();
    expect(chaosReachFor(null)).toBeNull();
  });
  it('every reach lies in CHAOS_REACH_RANGE', () => {
    const [lo, hi] = CHAOS_REACH_RANGE;
    for (let l = -2; l <= 2; l += 0.01) {
      const r = chaosReachFor({ lyapunov: l });
      expect(r).toBeGreaterThanOrEqual(lo);
      expect(r).toBeLessThanOrEqual(hi);
    }
  });
  it('labels name the reading', () => {
    expect(read({ periphery: { sol: null, art: { lyapunov: 0.412, lastR: 3.9 } } }).labels.chaos).toBe('λ +0.412');
    expect(read({ periphery: { sol: null, art: { lyapunov: null, lastR: 3.5 } } }).labels.chaos).toBe('sphere r 3.50');
    const v = read({ periphery: { sol: null, art: { visits: 1 } } });
    expect(v.chaosReach).toBeNull();
    expect(v.labels.chaos).toBeNull();
    expect(v.sources.chaos).toEqual({ visits: 1 });
  });
});

describe('readModulators', () => {
  it('passes the element through', () => {
    expect(read({ element: 'FIRE' }).element).toBe('FIRE');
  });
  it('throws on a missing element or phase (the altar gates both)', () => {
    expect(() => read({ element: null })).toThrow(RangeError);
    expect(() => read({ element: 'AETHER' })).toThrow(RangeError);
    expect(() => read({ phase: null })).toThrow(RangeError);
  });
  it('tolerates a periphery with no sol/art keys', () => {
    const m = readModulators({ element: 'AIR', phase: 'GREEN EMERGENCE', periphery: {} });
    expect(m.solTilt).toBeNull();
    expect(m.chaosReach).toBeNull();
  });
});

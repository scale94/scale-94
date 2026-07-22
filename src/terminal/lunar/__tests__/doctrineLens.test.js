import { describe, it, expect } from 'vitest';
import { LENSES, PHASE_OWNER, phaseAffinity } from '../doctrineLens';
import { PHASES, SYNODIC_PERIOD } from '../synodic';

describe('doctrineLens', () => {
  it('holds exactly the five kernels in wheel order', () => {
    expect(LENSES.map(l => l.id)).toEqual([
      'hudelschublade', 'blackhole', 'semiotic', 'fishscale', 'rossignol',
    ]);
    expect(LENSES.map(l => l.center)).toEqual([0.0, 9.5, 16.5, 22.0, 26.5]);
  });

  it('gives rossignol no element — it is the fifth', () => {
    const byId = Object.fromEntries(LENSES.map(l => [l.id, l]));
    expect(byId.hudelschublade.element).toBe('FIRE');
    expect(byId.blackhole.element).toBe('EARTH');
    expect(byId.semiotic.element).toBe('AIR');
    expect(byId.fishscale.element).toBe('WATER');
    expect(byId.rossignol.element).toBeNull();
  });

  it('assigns every one of the eight phases to a real lens', () => {
    const ids = new Set(LENSES.map(l => l.id));
    for (const p of PHASES) {
      expect(ids.has(PHASE_OWNER[p.id])).toBe(true);
    }
    expect(Object.keys(PHASE_OWNER)).toHaveLength(8);
  });

  it('peaks affinity at the center and falls off with distance', () => {
    expect(phaseAffinity(9.5, 9.5)).toBeCloseTo(100, 6);
    expect(phaseAffinity(9.5, 13.7)).toBeLessThan(65);   // 1 sigma out
    expect(phaseAffinity(9.5, 17.5)).toBeLessThan(20);   // 2 sigma out
  });

  it('scores identically either side of the wheel seam', () => {
    // The whole reason wrappedDistance exists: hudelschublade sits on age 0.
    // The mirror of age 0.1 across the seam is exactly SYNODIC_PERIOD - 0.1.
    // Rounding that literal (e.g. to 29.43) destroys the symmetry the test
    // exists to prove — the curve is steep here, so 0.0006 days of drift
    // moves affinity by more than a 4-decimal tolerance allows.
    expect(phaseAffinity(0, 0.1)).toBeCloseTo(phaseAffinity(0, SYNODIC_PERIOD - 0.1), 10);
  });

  it('cannot let a distant lens be overturned by the maximum modulation', () => {
    // a lens on its center vs a lens 8 days away, with max transit (30) + spine (15)
    expect(phaseAffinity(0, 0)).toBeGreaterThan(phaseAffinity(0, 8) + 30 + 15);
  });
});

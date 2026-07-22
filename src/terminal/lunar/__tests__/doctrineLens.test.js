import { describe, it, expect } from 'vitest';
import { LENSES, PHASE_OWNER, phaseAffinity, transitBonus, synthesizeLunarAspect } from '../doctrineLens';
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

describe('transitBonus', () => {
  const semiotic = LENSES.find(l => l.id === 'semiotic');
  const fishscale = LENSES.find(l => l.id === 'fishscale');

  it('is zero without a dominant aspect', () => {
    expect(transitBonus(semiotic, null)).toBe(0);
  });

  it('is zero when neither body is weighted by the lens', () => {
    expect(transitBonus(semiotic, { p1: 'Jupiter', p2: 'Sun', aspect: 'Trine', orb: 0 })).toBe(0);
  });

  it('pays most for a tight aspect between two weighted bodies', () => {
    // Mercury 1.0 + Mars 0.7 → mean 0.85, orb 0 → tightness 1 → 30 * 0.85
    expect(transitBonus(semiotic, { p1: 'Mercury', p2: 'Mars', aspect: 'Square', orb: 0 }))
      .toBeCloseTo(25.5, 6);
  });

  it('decays linearly to zero at the 8 degree orb limit', () => {
    const tight = transitBonus(semiotic, { p1: 'Mercury', p2: 'Mars', aspect: 'Square', orb: 4 });
    expect(tight).toBeCloseTo(12.75, 6);
    expect(transitBonus(semiotic, { p1: 'Mercury', p2: 'Mars', aspect: 'Square', orb: 8 })).toBe(0);
    expect(transitBonus(semiotic, { p1: 'Mercury', p2: 'Mars', aspect: 'Square', orb: 99 })).toBe(0);
  });

  it('never exceeds the 30 point ceiling', () => {
    for (const lens of LENSES) {
      const [a, b] = Object.keys(lens.planets);
      expect(transitBonus(lens, { p1: a, p2: b, aspect: 'Conjunct', orb: 0 })).toBeLessThanOrEqual(30);
    }
  });

  it('discriminates between lenses on the same aspect', () => {
    const asp = { p1: 'Neptune', p2: 'Venus', aspect: 'Trine', orb: 1 };
    expect(transitBonus(fishscale, asp)).toBeGreaterThan(transitBonus(semiotic, asp));
  });
});

describe('synthesizeLunarAspect', () => {
  it('reads new moon as the Sun-Moon conjunction', () => {
    const a = synthesizeLunarAspect(0);
    expect(a).toMatchObject({ p1: 'Sun', p2: 'Moon', aspect: 'Conjunct', orb: 0, synthetic: true });
  });

  it('reads full moon as the opposition', () => {
    expect(synthesizeLunarAspect(SYNODIC_PERIOD * 0.5).aspect).toBe('Opposite');
  });

  it('reads both quarters as squares', () => {
    expect(synthesizeLunarAspect(SYNODIC_PERIOD * 0.25).aspect).toBe('Square');
    expect(synthesizeLunarAspect(SYNODIC_PERIOD * 0.75).aspect).toBe('Square');
  });

  it('closes the wheel — the end of the cycle is a conjunction, not an opposition', () => {
    expect(synthesizeLunarAspect(SYNODIC_PERIOD - 0.01).aspect).toBe('Conjunct');
  });

  it('caps the orb at the 8 degree limit so it stays a usable aspect', () => {
    const mid = synthesizeLunarAspect(SYNODIC_PERIOD * 0.125);   // maximally far from any exact point
    expect(mid.orb).toBeLessThanOrEqual(8);
    expect(mid.orb).toBeGreaterThan(0);
  });
});

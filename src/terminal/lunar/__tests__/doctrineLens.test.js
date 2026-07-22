import { describe, it, expect } from 'vitest';
import { LENSES, PHASE_OWNER, phaseAffinity, transitBonus, synthesizeLunarAspect, spineBonus, scoreLenses } from '../doctrineLens';
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
    expect(phaseAffinity(9.5, 12.0)).toBeLessThan(65);   // 1 sigma out (sigma 2.5)
    expect(phaseAffinity(9.5, 14.5)).toBeLessThan(20);   // 2 sigma out
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

    // and at the tightest seam on the wheel, which is what actually bounds SIGMA:
    // hudelschublade (0.0) to rossignol (26.5) is 3.031 days wrapped. If a
    // competitor that close plus both maximum bonuses can clear 100, an
    // on-center lens loses and the moon no longer selects.
    expect(phaseAffinity(0, 26.5) + 30 + 15).toBeLessThan(phaseAffinity(0, 0));
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

  it('caps at 30 by construction even when lens weights exceed 1.0', () => {
    const overweighted = { id: 'synthetic', planets: { Mercury: 2.5, Mars: 2.0 } };
    expect(transitBonus(overweighted, { p1: 'Mercury', p2: 'Mars', aspect: 'Conjunct', orb: 0 }))
      .toBe(30);
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

  it('normalizes an age past one full cycle onto the wheel instead of overshooting', () => {
    // 1.5 periods should land at the half-period mark (Opposite, orb ~0).
    // Without the modulo, the raw age is nearest the wheel's own end anchor
    // (Conjunct, orb capped at 8) — so this fails without normalization.
    const a = synthesizeLunarAspect(SYNODIC_PERIOD * 1.5);
    expect(a.aspect).toBe('Opposite');
    expect(a.orb).toBeCloseTo(0, 6);
  });

  it('normalizes a negative age onto the wheel instead of running off the front', () => {
    // -0.5 periods should land at the half-period mark (Opposite, orb ~0).
    // Without the modulo, the raw negative age is nearest the wheel's own
    // start anchor (Conjunct) — so this fails without normalization.
    const a = synthesizeLunarAspect(-SYNODIC_PERIOD * 0.5);
    expect(a.aspect).toBe('Opposite');
    expect(a.orb).toBeCloseTo(0, 6);
  });

  it('resolves exactly SYNODIC_PERIOD to Conjunct with orb 0', () => {
    expect(synthesizeLunarAspect(SYNODIC_PERIOD)).toMatchObject({
      p1: 'Sun', p2: 'Moon', aspect: 'Conjunct', orb: 0, synthetic: true,
    });
  });
});

const FULL_SPINE = {
  trend: { label: 'x', velocity: 0.5 },
  council: { pair: ['a', 'b'] },
  phase: 'DARK INCUBATION',
  element: 'FIRE',
};

describe('spineBonus', () => {
  const hudel = LENSES.find(l => l.id === 'hudelschublade');
  const rossignol = LENSES.find(l => l.id === 'rossignol');

  it('is zero for an absent spine', () => {
    expect(spineBonus(hudel, null, 'DARK INCUBATION', 'new')).toBe(0);
  });

  it('pays 8 for a matching element', () => {
    expect(spineBonus(hudel, { element: 'FIRE' }, null, 'new')).toBe(8);
    expect(spineBonus(hudel, { element: 'WATER' }, null, 'new')).toBe(0);
  });

  it('pays 4 when a compiled phase agrees with the sky and this lens owns it', () => {
    // new moon is owned by hudelschublade
    expect(spineBonus(hudel, { phase: 'DARK INCUBATION' }, 'DARK INCUBATION', 'new')).toBe(4);
    // compiled a different phase than the sky is showing → nothing
    expect(spineBonus(hudel, { phase: 'MAXIMUM PROJECTION' }, 'DARK INCUBATION', 'new')).toBe(0);
    // right phase, but this lens does not own it
    expect(spineBonus(rossignol, { phase: 'DARK INCUBATION' }, 'DARK INCUBATION', 'new')).toBe(0);
  });

  it('pays the closed-ring bonus to rossignol alone', () => {
    // rossignol takes no element, so the ring is all it can earn here
    expect(spineBonus(rossignol, FULL_SPINE, null, 'new')).toBe(11);
    // hudelschublade, handed the very same closed spine, gets its element match
    // and NOTHING else — the ring is rossignol's alone. Drop the id guard and
    // this reads 19.
    expect(spineBonus(hudel, FULL_SPINE, null, 'new')).toBe(8);
  });

  it('pays nothing for the element clause when the spine element is null', () => {
    // getSpine() never returns null for a fresh visitor — it returns
    // { trend: null, council: null, phase: null, element: null }. rossignol's
    // own element is also null by design (it is the fifth). Without the
    // `lens.element &&` guard, `null === null` would be true and rossignol
    // would collect a free +8 on every page load for every visitor who has
    // not chosen an element yet.
    expect(spineBonus(rossignol, { element: null }, null, 'new')).toBe(0);
  });

  it('does not pay the phase bonus for a spine that compiled no phase', () => {
    // undefined === undefined is true, so without the spine.phase truthiness
    // guard an absent compiled phase would "agree" with an absent sky accord
    // and collect 4 points nobody earned.
    expect(spineBonus(hudel, { element: 'FIRE' }, undefined, 'new')).toBe(8);
  });

  it('caps at 15, and only rossignol can reach it', () => {
    // the one route to the cap: rossignol, closed spine, on the phase it owns.
    // 11 (ring) + 4 (phase agreement) = 15 exactly — the cap binds, it is not
    // trimming anything, and it is not dead code either.
    expect(spineBonus(rossignol, { ...FULL_SPINE, phase: 'SMOKE DISSOLUTION' },
      'SMOKE DISSOLUTION', 'waning-crescent')).toBe(15);
    // every other lens tops out one rung lower: 8 (element) + 4 (phase), no ring
    expect(spineBonus(hudel, FULL_SPINE, 'DARK INCUBATION', 'new')).toBe(12);
  });
});

describe('scoreLenses', () => {
  const base = { age: 0.5, phaseId: 'new', currentAccord: 'DARK INCUBATION', dominant: null, spine: null };

  it('returns all five, sorted by total descending', () => {
    const s = scoreLenses(base);
    expect(s).toHaveLength(5);
    for (let i = 1; i < s.length; i++) expect(s[i - 1].total).toBeGreaterThanOrEqual(s[i].total);
  });

  it('lets the moon alone select the lens', () => {
    expect(scoreLenses(base)[0].id).toBe('hudelschublade');
    expect(scoreLenses({ ...base, age: 16.5, phaseId: 'full', currentAccord: 'MAXIMUM PROJECTION' })[0].id)
      .toBe('semiotic');
    expect(scoreLenses({ ...base, age: 22.0, phaseId: 'last-quarter', currentAccord: 'MINERAL STILLNESS' })[0].id)
      .toBe('fishscale');
  });

  it('reaches every one of the five somewhere on the arc', () => {
    const seen = new Set();
    for (let age = 0; age < SYNODIC_PERIOD; age += 0.05) {
      seen.add(scoreLenses({ ...base, age })[0].id);
    }
    expect([...seen].sort()).toEqual(
      ['blackhole', 'fishscale', 'hudelschublade', 'rossignol', 'semiotic']
    );
  });

  it('lets a tight transit decide an overlap it could not decide on a center', () => {
    // midway between blackhole (9.5) and semiotic (16.5)
    const overlap = { ...base, age: 13.0, phaseId: 'waxing-gibbous', currentAccord: 'FLORAL AMPLIFICATION' };
    const neutral = scoreLenses(overlap)[0].id;
    const pushed  = scoreLenses({ ...overlap, dominant: { p1: 'Mercury', p2: 'Mars', aspect: 'Square', orb: 0 } })[0].id;
    expect(pushed).toBe('semiotic');
    expect(pushed).not.toBe(neutral);

    // the same tight aspect cannot move a lens sitting on its own center
    const onCenter = scoreLenses({ ...base, age: 22.0, phaseId: 'last-quarter',
      currentAccord: 'MINERAL STILLNESS',
      dominant: { p1: 'Mercury', p2: 'Mars', aspect: 'Square', orb: 0 } });
    expect(onCenter[0].id).toBe('fishscale');
  });

  it('hands spineBonus its arguments in the right order', () => {
    // base already sits on a phase hudelschublade owns ('new'), with the sky
    // accord FULL_SPINE compiled. So hudelschublade must collect both spine
    // terms: 8 (FIRE) + 4 (compiled phase agrees with the sky). Transpose
    // currentAccord and phaseId at the call site and the 4 silently vanishes.
    const s = scoreLenses({ ...base, spine: FULL_SPINE });
    const byId = Object.fromEntries(s.map(r => [r.id, r]));
    expect(byId.hudelschublade.spine).toBe(12);
    // semiotic is AIR and owns no phase here — it earns nothing from this spine
    expect(byId.semiotic.spine).toBe(0);
  });

  it('is deterministic', () => {
    const a = scoreLenses({ ...base, spine: FULL_SPINE, dominant: { p1: 'Sun', p2: 'Moon', aspect: 'Conjunct', orb: 1 } });
    const b = scoreLenses({ ...base, spine: FULL_SPINE, dominant: { p1: 'Sun', p2: 'Moon', aspect: 'Conjunct', orb: 1 } });
    expect(a).toEqual(b);
  });
});

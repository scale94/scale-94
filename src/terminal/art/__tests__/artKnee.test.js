// artKnee.test.js — the soft-knee shoulder's contract.
//
// The shader in SphereKnee.js is the same expression written branchlessly. It
// cannot be executed here (ArtTab will not mount in jsdom and there is no GL
// context), so what these pin is the ARITHMETIC both copies implement, plus the
// three properties the design argument actually rests on. If a future edit
// breaks one of these, the GLSL is wrong too.

import { describe, it, expect } from 'vitest';

import { softKnee, KNEE, KNEE_NULL } from '../artComposite';

describe('softKnee', () => {
  // ── Identity below the knee ───────────────────────────────────────────────
  //
  // This is the parity argument, not a nicety. 63.3% of the ink on a 4-node
  // cascade never exceeds 1.0; a curve that touches those values re-bases all
  // 21 reference cells and costs the ability to attribute any later change.
  it('is exactly the identity at and below the knee', () => {
    for (const x of [0, 0.1, 0.25, 0.5, 0.599, 0.6]) {
      expect(softKnee(x, 0.6)).toBe(x);
    }
  });

  it('is the identity below the knee for every knee in the usable range', () => {
    for (const knee of [0.1, 0.25, 0.5, 0.6, 0.75, 0.9, 0.99]) {
      for (const f of [0, 0.5, 0.9, 1]) {
        const x = knee * f;
        expect(softKnee(x, knee)).toBe(x);
      }
    }
  });

  // ── The three properties the curve was chosen for ─────────────────────────

  it('never reaches 1.0, so nothing clips however deep the pile', () => {
    for (const x of [1, 2, 4, 8, 16, 37.15, 64, 1e3, 1e6]) {
      const y = softKnee(x, 0.6);
      expect(y).toBeLessThan(1);
      expect(y).toBeGreaterThan(0.6);
    }
  });

  it('is monotonically increasing across the whole range', () => {
    let prev = -Infinity;
    for (let x = 0; x <= 40; x += 0.01) {
      const y = softKnee(x, KNEE.knee);
      expect(y).toBeGreaterThan(prev);
      prev = y;
    }
  });

  it('joins the identity with slope 1, so there is no crease at the knee', () => {
    // A one-sided numeric derivative just above the join. An exponential
    // shoulder also passes this; a naive `min(x, 1)` or a Reinhard without the
    // knee offset does not, and both would show a visible edge where
    // compression starts.
    const knee = 0.6;
    const h = 1e-7;
    const slope = (softKnee(knee + h, knee) - knee) / h;
    expect(slope).toBeCloseTo(1, 4);
  });

  // ── The claim the knee value was chosen on ────────────────────────────────
  //
  // The design argues that at knee 0.6 the band holding 97% of the overbright
  // resolves into SEPARATE 8-bit levels, where a high knee collapses them. That
  // is the whole justification for the default, so it is pinned here.
  it('resolves 1x through 8x into distinct 8-bit levels at the default knee', () => {
    const level = (x) => Math.round(softKnee(x, KNEE.knee) * 255);
    const levels = [1, 1.5, 2, 4, 8].map(level);
    expect(new Set(levels).size).toBe(levels.length);
    // And the separation is real, not a rounding accident.
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeGreaterThan(levels[i - 1]);
    }
  });

  // The trade the knee value actually makes. A high knee protects more of the
  // frame from being touched at all, and pays for it in how finely the
  // overbright band is resolved. MEASURED here so the trade is a number rather
  // than an assertion in a comment: spanning 1x to 8x,
  //
  //     knee 0.6   ->  204 .. 250   =  46 levels
  //     knee 0.9   ->  242 .. 255   =  13 levels
  //
  // 13 is not nothing, which is why 0.9 is a legitimate choice for someone who
  // wants the change to be nearly invisible. It is 3.5x less room, which is why
  // it is not the default for someone who wants filament structure back.
  it('trades identity-protection against resolution in the overbright band', () => {
    const span = (knee) => Math.round(softKnee(8, knee) * 255) - Math.round(softKnee(1, knee) * 255);
    const wide = span(KNEE.knee);
    const tight = span(0.9);
    expect(wide).toBe(46);
    expect(tight).toBe(13);
    expect(wide / tight).toBeGreaterThan(3);
  });

  // ── The edges that are reachable and one that divides by zero ─────────────

  it('is the identity at the null knee, for every value a frame can hold', () => {
    for (const x of [0, 0.5, 1, 37.15, 1000]) {
      expect(softKnee(x, KNEE_NULL)).toBe(x);
    }
  });

  it('stays finite at a knee above 1, where the denominator is exactly zero', () => {
    // knee 1.5, x 2.0 puts t + s at exactly 0 without the epsilon floor. In
    // GLSL that inf reaches the screen; here it would be Infinity or NaN.
    for (const [x, knee] of [[2, 1.5], [3, 2], [1.0001, 1], [5, 1]]) {
      const y = softKnee(x, knee);
      expect(Number.isFinite(y)).toBe(true);
    }
  });

  it('degenerates to a clamp at the knee when the knee is at or above 1', () => {
    expect(softKnee(5, 1)).toBeCloseTo(1, 5);
    expect(softKnee(37, 1)).toBeCloseTo(1, 5);
  });

  it('handles 0 and negative input without producing NaN', () => {
    expect(softKnee(0, 0.6)).toBe(0);
    expect(Number.isFinite(softKnee(-0.5, 0.6))).toBe(true);
  });
});

describe('KNEE config', () => {
  it('ships a knee inside the usable range', () => {
    expect(KNEE.knee).toBeGreaterThan(0);
    expect(KNEE.knee).toBeLessThan(1);
  });

  it('puts the null knee far above the measured worst-case peak of 37.15x', () => {
    expect(KNEE_NULL).toBeGreaterThan(37.15 * 1000);
  });
});

// artTrail.test.js — the arithmetic behind the GL trail accumulator.
//
// The 2D canvas erases alpha by `m` each frame and redraws over the
// survivors, so a layer drawn at alpha `a` settles ABOVE `a`. Any layer that
// moves to the GPU loses this unless the GPU reproduces it. Measured on the
// edges: ~1.39x normal, ~3.13x immersive — which is exactly 1/m.

import { describe, it, expect } from 'vitest';
import { trailSurvival, steadyState, fadeGain } from '../artTrail';
import { RIFT_ALPHA_NORMAL, RIFT_ALPHA_IMMERSIVE } from '../artBackground';

describe('trailSurvival', () => {
  it('is the complement of the erase alpha', () => {
    expect(trailSurvival(0.72)).toBeCloseTo(0.28, 10);
    expect(trailSurvival(0.32)).toBeCloseTo(0.68, 10);
  });
});

describe('steadyState', () => {
  it('is a fixed point: feeding it back reproduces itself', () => {
    // The definition, stated independently of the closed form: fade the
    // steady state and draw `a` over it, and you must land on it again.
    for (const m of [0.72, 0.32, 0.5]) {
      for (const a of [0.03, 0.2, 0.6]) {
        const A = steadyState(a, m);
        const next = a + A * (1 - m) * (1 - a);
        expect(next).toBeCloseTo(A, 10);
      }
    }
  });

  it('never exceeds 1, even for a slow fade and a strong layer', () => {
    expect(steadyState(0.9, 0.01)).toBeLessThanOrEqual(1);
    expect(steadyState(1, 0.01)).toBeCloseTo(1, 10);
  });

  it('is the identity when the erase is total', () => {
    // m = 1 wipes everything, so there is nothing to accumulate onto.
    expect(steadyState(0.3, 1)).toBeCloseTo(0.3, 10);
  });
});

describe('fadeGain', () => {
  it('reproduces the two measured deficits', () => {
    // These are the whole reason this module exists. 1/0.72 and 1/0.32 are
    // the ~1.4x and ~3.1x measured off the real render.
    expect(fadeGain(RIFT_ALPHA_NORMAL)).toBeCloseTo(1.389, 3);
    expect(fadeGain(RIFT_ALPHA_IMMERSIVE)).toBeCloseTo(3.125, 3);
  });

  it('shows immersive accumulates 2.25x harder than normal', () => {
    const ratio = fadeGain(RIFT_ALPHA_IMMERSIVE) / fadeGain(RIFT_ALPHA_NORMAL);
    expect(ratio).toBeCloseTo(2.25, 2);
  });

  it('agrees with steadyState in the small-alpha limit', () => {
    // a = 1e-6, not 1e-4: at 1e-4 the ratio is still ~6.6e-4 off fadeGain,
    // which blows the 3-decimal tolerance below — the deficit shrinks
    // linearly with a, so the limit needs a genuinely small a to land.
    const m = 0.32, a = 1e-6;
    expect(steadyState(a, m) / a).toBeCloseTo(fadeGain(m), 3);
  });
});

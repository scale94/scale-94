// artEdges.test.js — the numbers behind the GL edge layers.
//
// These were inline in a 3185-line draw loop. Extracted so the GPU version and
// the 2D code it replaces cannot drift apart silently, and so the animated
// curves can be tested without a canvas.
//
// One assertion here contradicts the source comment it came from, which is the
// same class of error that produced three wrong constants in step 3: the draw
// loop says the ortho hue rotation takes "~6s" and the arithmetic says 7.5s.

import { describe, it, expect } from 'vitest';
import {
  ORTHO_DASH, SPECTRAL_DASH,
  orthoHue, orthoGlow, fusedGlow, resonanceGlow,
  pulseRingRadius, pulsePosition, edgeStops,
} from '../artEdges';

describe('orthoHue', () => {
  it('completes a full rotation in 7.5s, NOT the ~6s the source comment claims', () => {
    // hue = (Date.now() * 0.0008 * 60) % 360 = t * 0.048 deg/ms.
    // 360 / 0.048 = 7500ms. The comment beside it reads "full rotation ~6s".
    expect(orthoHue(0)).toBeCloseTo(0, 10);
    expect(orthoHue(7500)).toBeCloseTo(0, 6);
    expect(orthoHue(3750)).toBeCloseTo(180, 6);
  });

  it('stays inside [0, 360)', () => {
    for (const t of [0, 1234, 99999, 1e7]) {
      const h = orthoHue(t);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });
});

describe('glow amounts', () => {
  it('oscillates the ortho glow between 6 and 14', () => {
    let lo = Infinity, hi = -Infinity;
    for (let t = 0; t < 20000; t += 17) {
      const g = orthoGlow(t);
      lo = Math.min(lo, g); hi = Math.max(hi, g);
    }
    expect(lo).toBeCloseTo(6, 1);
    expect(hi).toBeCloseTo(14, 1);
  });

  it('scales the fused glow from 6 to 14 with cosine similarity', () => {
    expect(fusedGlow(0)).toBeCloseTo(6, 10);
    expect(fusedGlow(1)).toBeCloseTo(14, 10);
  });

  it('scales the resonance glow from 4 to 28 — a much wider range', () => {
    // This is the one that will expose a wrong glow model: the base edges top
    // out at 14px where the falloff mostly reads as thickness, the resonance
    // edge goes to 28px where the shape of the falloff is visible.
    expect(resonanceGlow(0)).toBeCloseTo(4, 10);
    expect(resonanceGlow(1)).toBeCloseTo(28, 10);
  });
});

describe('pulse ring', () => {
  it('grows from 2px to 4.5px, scaled by projection', () => {
    expect(pulseRingRadius(0, 1)).toBeCloseTo(2, 10);
    expect(pulseRingRadius(1, 1)).toBeCloseTo(4.5, 10);
    expect(pulseRingRadius(1, 2)).toBeCloseTo(9, 10);
  });

  it('runs backwards along the edge when direction is negative', () => {
    expect(pulsePosition(0.25, 1)).toBeCloseTo(0.25, 10);
    expect(pulsePosition(0.25, -1)).toBeCloseTo(0.75, 10);
  });
});

describe('dash patterns', () => {
  it('keeps the two patterns distinct — ortho is longer and sparser', () => {
    expect(ORTHO_DASH).toEqual([8, 4]);
    expect(SPECTRAL_DASH).toEqual([4, 3]);
  });
});

describe('edgeStops', () => {
  // The alpha weights are the whole reason this function exists: the two ends
  // of an edge are NOT symmetric, and a shader that fades symmetrically looks
  // right and is wrong. Strength skews it further.
  const A = [0, 100, 50], B = [200, 100, 50], M = [100, 100, 50];

  it('places the stops at 0, 0.5 and 1', () => {
    expect(edgeStops(A, B, M, 0.5, 0, 0).map(s => s.t)).toEqual([0, 0.5, 1]);
  });

  it('carries the three colours through in order', () => {
    const s = edgeStops(A, B, M, 0.5, 0, 0);
    expect(s[0].color).toBe(A);
    expect(s[1].color).toBe(M);
    expect(s[2].color).toBe(B);
  });

  it('is asymmetric at zero strength: end B starts at 0.6 of the middle', () => {
    const [s0, s1, s2] = edgeStops(A, B, M, 0.5, 0, 0);
    expect(s0.a).toBeCloseTo(0.5, 10);         // 0.5 * (1 - 0)
    expect(s1.a).toBeCloseTo(0.5, 10);
    expect(s2.a).toBeCloseTo(0.3, 10);         // 0.5 * (0.6 + 0)
  });

  it('swings the two ends in opposite directions as strength rises', () => {
    const [s0, , s2] = edgeStops(A, B, M, 0.5, 0, 1);
    expect(s0.a).toBeCloseTo(0.3, 10);         // 0.5 * (1 - 0.4)
    expect(s2.a).toBeCloseTo(0.5, 10);         // 0.5 * (0.6 + 0.4)
  });

  it('adds the pulse boost to all three stops before weighting', () => {
    const [s0, s1] = edgeStops(A, B, M, 0.4, 0.2, 0);
    expect(s1.a).toBeCloseTo(0.6, 10);
    expect(s0.a).toBeCloseTo(0.6, 10);
  });
});

// artEdges.test.js — the numbers behind the GL edge layers.
//
// These were inline in a 3185-line draw loop. Extracted so the GPU version and
// the 2D code it replaces cannot drift apart silently, and so the animated
// curves can be tested without a canvas.
//
// One assertion here contradicts the source comment it came from, which is the
// same class of error that produced three wrong constants in step 3: the draw
// loop says the ortho hue rotation takes "~6s" and the arithmetic says 7.5s.

import { describe, it, expect, vi } from 'vitest';
import {
  ORTHO_DASH, SPECTRAL_DASH,
  orthoHue, orthoGlow, fusedGlow, resonanceGlow,
  pulseRingRadius, pulsePosition, edgeStops, edgeLineWidth,
} from '../artEdges';
import {
  writeHsl, writeHslRgb, packAlphas, unpackAlphas, packFlags, unpackFlags,
  syncEdgeLayer, discWidth, isDisc, EDGE_STRIDE, MAX_EDGES,
} from '../SphereEdges';

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

// ── The disc sentinel ──────────────────────────────────────────────────────
//
// The travelling pulse rings ride in the SAME instance buffer as the edges, one
// immediately after the edge it belongs to, so the 2D loop's interleaved draw
// order survives (see the header of SphereEdges.js). The discriminator is a
// NEGATIVE stroke width, and that is only sound while a real edge can never
// produce one — so the invariant is pinned here against the real width formula
// and the real discriminator, not against a restatement of either.

describe('the disc sentinel', () => {
  it('encodes a radius as a negative width the shader recovers with abs/2', () => {
    for (const r of [0.5, 2, 4.5, 9, 12.7]) {
      expect(discWidth(r)).toBeLessThan(0);
      expect(Math.abs(discWidth(r)) * 0.5).toBeCloseTo(r, 10);   // EDGE_VERT's halfW
      expect(isDisc(discWidth(r))).toBe(true);
    }
  });

  it('never mistakes a real edge width for a disc, anywhere in the input domain', () => {
    // Every term of the width formula is non-negative over its real domain:
    // node energy and pulse are [0,1]; spectral_bridge clamps its similarity
    // THRESHOLD to >= 0.1 and only emits pairs at or above it, so cosSim is
    // never negative; bone fusion's post-convergence cosine likewise. The
    // projection scale is strictly positive and bounded — denom is
    // sphereR*(FOCAL_K + rz) with rz in [-1,1], so scale spans
    // [2.8/3.8, 2.8/1.8]. The leading 0.5 is what makes the product > 0.
    for (const energy of [0, 0.37, 1])
      for (const pulse of [0, 0.5, 1])
        for (const sim of [0, 0.1, 1])
          for (const fuse of [0, 0.5, 1])
            for (const ortho of [false, true])
              for (const scale of [2.8 / 3.8, 1, 2.8 / 1.8]) {
                const w = edgeLineWidth(energy, pulse, sim, fuse, ortho, scale);
                expect(w).toBeGreaterThan(0);
                expect(isDisc(w)).toBe(false);
              }
  });

  it('reproduces the draw loop\'s width arithmetic term by term', () => {
    expect(edgeLineWidth(0, 0, 0, 0, false, 1)).toBeCloseTo(0.5, 10);
    expect(edgeLineWidth(1, 0, 0, 0, false, 1)).toBeCloseTo(1.3, 10);   // + energy * 0.8
    expect(edgeLineWidth(0, 1, 0, 0, false, 1)).toBeCloseTo(2.3, 10);   // + pulse  * 1.8
    expect(edgeLineWidth(0, 0, 1, 0, false, 1)).toBeCloseTo(1.7, 10);   // + cosSim * 1.2
    expect(edgeLineWidth(0, 0, 0, 1, false, 1)).toBeCloseTo(2.5, 10);   // + fuseCos * 2.0
    expect(edgeLineWidth(0, 0, 0, 0, true,  1)).toBeCloseTo(2.5, 10);   // + 2.0 when ortho
    // and the whole sum scales by the two endpoints' average projection.
    // (0.5 + 0.8 + 1.8 + 1.2 + 2.0 + 2.0) * 2
    expect(edgeLineWidth(1, 1, 1, 1, true, 2)).toBeCloseTo(16.6, 10);
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

// ── The CPU half of the GPU edge layer ─────────────────────────────────────
//
// SphereEdges.js is the only place HSL becomes RGB and the only place the
// instance floats are packed. Neither can be checked by the pixel gate — a
// wrong hue or a leaked bit reads as "slightly different edges", which is
// exactly what this step is expected to produce anyway.

describe('writeHsl / writeHslRgb', () => {
  const rgb = (h, s, l) => {
    const out = new Float32Array(3);
    writeHsl(out, 0, h, s, l);
    return [...out].map(v => Math.round(v * 255));
  };

  it('matches CSS hsl() on the primaries', () => {
    expect(rgb(0,   100, 50)).toEqual([255, 0, 0]);
    expect(rgb(120, 100, 50)).toEqual([0, 255, 0]);
    expect(rgb(240, 100, 50)).toEqual([0, 0, 255]);
    expect(rgb(60,  100, 50)).toEqual([255, 255, 0]);
  });

  it('handles the achromatic and clipped ends', () => {
    expect(rgb(210, 0, 50)).toEqual([128, 128, 128]);
    expect(rgb(210, 80, 0)).toEqual([0, 0, 0]);
    expect(rgb(210, 80, 100)).toEqual([255, 255, 255]);
  });

  it('wraps hue rather than clamping it — the ortho bridge adds 150 to it', () => {
    expect(rgb(370, 100, 50)).toEqual(rgb(10, 100, 50));
    expect(rgb(-30, 100, 50)).toEqual(rgb(330, 100, 50));
  });

  it('writes at the requested offset and reads a colour object the same way', () => {
    const out = new Float32Array(8).fill(-1);
    writeHslRgb(out, 4, { hue: 120, sat: 100, lit: 50 });
    expect([...out.subarray(0, 4)]).toEqual([-1, -1, -1, -1]);
    expect([...out.subarray(4, 7)].map(v => Math.round(v * 255))).toEqual([0, 255, 0]);
  });
});

// unpackAlphas / unpackFlags are exported from SphereEdges.js specifically so
// these tests run the SAME arithmetic EDGE_VERT does (see the comments beside
// each in SphereEdges.js) instead of a hand-copied second implementation that
// could silently drift from the shader.

describe('packAlphas / unpackAlphas', () => {
  it('round-trips three alphas through one float exactly', () => {
    const p = packAlphas(0, 0.5, 1);
    const u = unpackAlphas(p);
    expect(u.a0).toBeCloseTo(0, 10);
    expect(u.a1).toBeCloseTo(128 / 255, 10);
    expect(u.a2).toBeCloseTo(1, 10);
    expect(Number.isInteger(p)).toBe(true);
    expect(Math.fround(p)).toBe(p);          // exact as a float32 attribute
  });

  it('clamps above 1 — baseAlpha + pulseBoost overflows and the canvas clamped too', () => {
    const u = unpackAlphas(packAlphas(1.4, 2, 0.25));
    expect(u.a0).toBeCloseTo(1, 10);
    expect(u.a1).toBeCloseTo(1, 10);
    expect(u.a2).toBeCloseTo(64 / 255, 10);
  });
});

describe('packFlags / unpackFlags', () => {
  it('keeps the dash pattern intact under a fractional glow radius', () => {
    // The brief packed glow as `glow * 65536`, which puts a fraction under two
    // integer fields and leaks its low bits into the dash period. In eighths
    // every field stays an integer and the whole payload stays exact.
    const p = packFlags(12, 8, 10.37);
    const u = unpackFlags(p);
    expect(u.dashPeriod).toBe(12);
    expect(u.dashDuty).toBe(8);
    expect(u.glow).toBeCloseTo(10.375, 10);
    expect(u.isOrtho).toBe(false);
    expect(Math.fround(p)).toBe(p);
  });

  it('encodes a solid edge with no glow as zero', () => {
    expect(packFlags(0, 0, 0)).toBe(0);
    expect(unpackFlags(0).isOrtho).toBe(false);
  });

  it('sets the isOrtho bit without disturbing the dash pattern or glow radius', () => {
    const p = packFlags(12, 8, 10.37, true);
    const u = unpackFlags(p);
    expect(u.isOrtho).toBe(true);
    expect(u.dashPeriod).toBe(12);
    expect(u.dashDuty).toBe(8);
    expect(u.glow).toBeCloseTo(10.375, 10);
  });

  // Finding: bit 23 of the packed field (the top bit of the glow byte) is
  // free ONLY because both real glow radii top out at 14px, round(14*8) =
  // 112 < 128. This pins that invariant so a future glow range change cannot
  // silently collide with isOrtho.
  it('keeps every real glow magnitude under 128, so bit 23 stays free for isOrtho', () => {
    for (const glowPx of [fusedGlow(0), fusedGlow(1), orthoGlow(0), orthoGlow(5000)]) {
      const packedGlowByte = Math.round(glowPx * 8);
      expect(packedGlowByte).toBeLessThan(128);
    }
  });

  it('clamps a runaway glow radius to 127 rather than colliding with the isOrtho bit', () => {
    const p = packFlags(0, 0, 1000, false);
    const u = unpackFlags(p);
    expect(u.isOrtho).toBe(false);
    expect(u.glow).toBeCloseTo(127 / 8, 10);
  });

  it('stays exactly representable at the largest real payload it can carry', () => {
    const p = packFlags(255, 255, 127 / 8, true);
    expect(p).toBe(255 + 255 * 256 + 255 * 65536);
    expect(Math.fround(p)).toBe(p);
  });
});

describe('syncEdgeLayer', () => {
  const makeLayer = () => ({
    mesh: { visible: true },
    geometry: { instanceCount: -1 },
    uniforms: {
      uResolution: { value: { set: vi.fn() } },
      uOrthoHue: { value: 0 },
    },
    buffer: { needsUpdate: false, addUpdateRange: vi.fn() },
  });

  it('a zero edge count draws nothing rather than one degenerate instance', () => {
    const layer = makeLayer();
    syncEdgeLayer(layer, { count: 0, w: 100, h: 100 });
    expect(layer.mesh.visible).toBe(false);
    expect(layer.geometry.instanceCount).toBe(0);
  });

  it('tolerates an undefined state the same way as a zero count', () => {
    const layer = makeLayer();
    expect(() => syncEdgeLayer(layer, undefined)).not.toThrow();
    expect(layer.mesh.visible).toBe(false);
    expect(layer.geometry.instanceCount).toBe(0);
  });

  it('clamps the instance count to MAX_EDGES', () => {
    const layer = makeLayer();
    syncEdgeLayer(layer, { count: MAX_EDGES + 500, w: 100, h: 100 });
    expect(layer.geometry.instanceCount).toBe(MAX_EDGES);
    expect(layer.mesh.visible).toBe(true);
  });

  it('publishes resolution, marks the buffer dirty and ranges only the written floats', () => {
    const layer = makeLayer();
    syncEdgeLayer(layer, { count: 3, w: 640, h: 480 });
    expect(layer.uniforms.uResolution.value.set).toHaveBeenCalledWith(640, 480);
    expect(layer.buffer.needsUpdate).toBe(true);
    expect(layer.buffer.addUpdateRange).toHaveBeenCalledWith(0, 3 * EDGE_STRIDE);
  });

  it('carries the per-frame ortho hue uniform from state', () => {
    const layer = makeLayer();
    syncEdgeLayer(layer, { count: 1, w: 100, h: 100, orthoHue: 123.4 });
    expect(layer.uniforms.uOrthoHue.value).toBeCloseTo(123.4, 10);
  });

  it('defaults the ortho hue uniform to 0 when state does not carry one', () => {
    const layer = makeLayer();
    syncEdgeLayer(layer, { count: 1, w: 100, h: 100 });
    expect(layer.uniforms.uOrthoHue.value).toBe(0);
  });
});

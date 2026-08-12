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
import * as THREE from 'three';
import {
  ORTHO_DASH, SPECTRAL_DASH,
  orthoHue, orthoGlow, fusedGlow, resonanceGlow, resonanceWidths, resonanceStops,
  RESONANCE_GOLD, RESONANCE_HALO_MID, RESONANCE_CORE_MID, RESONANCE_SHADOW_ALPHA,
  pulseRingRadius, pulsePosition, edgeStops, edgeLineWidth,
} from '../artEdges';
import {
  writeHsl, writeHslRgb, writeRgb255, packAlphas, unpackAlphas, packFlags, unpackFlags,
  syncEdgeLayer, createEdgeLayer, discWidth, isDisc,
  SRC_OVER_LAYER, ADDITIVE_LAYER,
  EDGE_STRIDE, EDGE_OFF, MAX_EDGES,
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

// EDGE_OFF exists so the buffer's READER — artPresence.mjs, which has to find
// the pulse rings inside the range __artEdgeState() publishes — stops spelling
// `+ 14` itself. That only helps if EDGE_OFF cannot drift from where the GPU
// actually reads those floats, which is decided by the InterleavedBufferAttribute
// offsets in createEdgeLayer, not by the comment table in the file header. So
// this asserts EDGE_OFF against the bindings themselves: rearrange the layout
// without moving EDGE_OFF and the harness starts decoding the wrong field, and
// this test is what says so.
describe('EDGE_OFF', () => {
  it('names the offsets the GPU attributes are actually bound at', () => {
    const layer = createEdgeLayer();
    const a = layer.geometry.attributes;
    try {
      expect(a.aEnds.offset).toBe(EDGE_OFF.ax);
      expect(EDGE_OFF.ay).toBe(a.aEnds.offset + 1);
      expect(EDGE_OFF.bx).toBe(a.aEnds.offset + 2);
      expect(EDGE_OFF.by).toBe(a.aEnds.offset + 3);
      expect(a.aC0.offset).toBe(EDGE_OFF.c0);
      expect(a.aC1.offset).toBe(EDGE_OFF.c1);
      expect(a.aC2.offset).toBe(EDGE_OFF.c2);
      // aPack is (x = packed alphas, y = width, z = packed flags). The sentinel
      // the harness decodes is the SIGN of aPack.y, i.e. of EDGE_OFF.width.
      expect(a.aPack.offset).toBe(EDGE_OFF.alphas);
      expect(EDGE_OFF.width).toBe(a.aPack.offset + 1);
      expect(EDGE_OFF.flags).toBe(a.aPack.offset + 2);
      // and every field lands inside one instance.
      for (const o of Object.values(EDGE_OFF)) expect(o).toBeLessThan(EDGE_STRIDE);
    } finally { layer.dispose(); }
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

// ── The resonance edge's two strokes ───────────────────────────────────────
//
// It is TWO strokes, not one: a wide low-alpha halo and then a narrow bright
// core over it, both under `lighter`. Porting it as a single glowing line
// renders a plausible bright bar and loses the thing that makes it read as
// coalescence — and no capture state arms resonance, so no pixel gate on this
// branch would say so. These assertions are transcribed from the rgba() strings
// the canvas parsed, not from the implementation.

describe('resonanceStops', () => {
  it('is SYMMETRIC, unlike a base edge — both ends are the same colour and alpha', () => {
    for (const sim of [0, 0.37, 1]) {
      const { halo, core } = resonanceStops(sim);
      for (const s of [halo, core]) {
        expect(s.c0).toBe(s.c2);
        expect(s.a0).toBeCloseTo(s.a2, 10);
      }
    }
  });

  it('reproduces the halo\'s rgba() stops: gold ends, pale-yellow middle', () => {
    // rgba(255,215,0, 0.06 + sim*0.12) / rgba(255,255,200, 0.04 + sim*0.10)
    const s = resonanceStops(0.5).halo;
    expect(s.c0).toEqual(RESONANCE_GOLD);
    expect(s.c1).toEqual(RESONANCE_HALO_MID);
    expect(s.a0).toBeCloseTo(0.12, 10);
    expect(s.a1).toBeCloseTo(0.09, 10);
    const z = resonanceStops(0).halo, o = resonanceStops(1).halo;
    expect(z.a0).toBeCloseTo(0.06, 10); expect(z.a1).toBeCloseTo(0.04, 10);
    expect(o.a0).toBeCloseTo(0.18, 10); expect(o.a1).toBeCloseTo(0.14, 10);
  });

  it('reproduces the core\'s rgba() stops: gold ends, PURE WHITE middle', () => {
    // rgba(255,215,0, 0.55 + sim*0.45) / rgba(255,255,255, 0.40 + sim*0.55)
    const s = resonanceStops(0.5).core;
    expect(s.c0).toEqual(RESONANCE_GOLD);
    expect(s.c1).toEqual(RESONANCE_CORE_MID);
    expect(s.a0).toBeCloseTo(0.775, 10);
    expect(s.a1).toBeCloseTo(0.675, 10);
    const z = resonanceStops(0).core, o = resonanceStops(1).core;
    expect(z.a0).toBeCloseTo(0.55, 10); expect(z.a1).toBeCloseTo(0.40, 10);
    expect(o.a0).toBeCloseTo(1.00, 10); expect(o.a1).toBeCloseTo(0.95, 10);
  });

  it('keeps the halo dim and wide against a bright narrow core, at every sim', () => {
    // The two strokes are only distinguishable as strokes while this holds; a
    // port that merged them into one would satisfy neither inequality.
    for (const sim of [0, 0.5, 1]) {
      const { halo, core } = resonanceStops(sim);
      const w = resonanceWidths(sim, 1);
      expect(halo.a1).toBeLessThan(core.a1 * 0.25);
      expect(w.halo).toBeGreaterThan(w.core * 4);
    }
  });

  it('scales both widths by the projection, from the draw loop verbatim', () => {
    expect(resonanceWidths(0, 1)).toEqual({ halo: 8, core: 1.5 });
    expect(resonanceWidths(1, 1)).toEqual({ halo: 24, core: 5.5 });
    expect(resonanceWidths(1, 2)).toEqual({ halo: 48, core: 11 });
  });

  it('leaves both strokes representable after packAlphas, which is coarser than toFixed(3)', () => {
    // The original quantised each alpha with `.toFixed(3)` before the canvas
    // parsed the string; packAlphas quantises to 1/255, which is coarser, so
    // it is the dominant step and toFixed does not need reproducing. What DOES
    // need checking is that the halo's smallest alpha survives it at all.
    const a = resonanceStops(0).halo.a1;                 // 0.04, the dimmest
    expect(unpackAlphas(packAlphas(a, a, a)).a0).toBeCloseTo(a, 2);
    expect(Math.round(a * 255)).toBeGreaterThan(0);
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

// ── The per-material glow quantisation ─────────────────────────────────────
//
// The glow byte is seven bits wide (bit 7 is isOrtho), so the largest radius it
// can carry is 127 / quant. At the edge mesh's 1/8 px that is 15.875 px, which
// covers both of ITS glows (14 px max) with the same headroom the isOrtho bit
// argument rests on. The resonance core reaches 28 px and does NOT fit: it
// would silently saturate at 15.875 — and so would the default sim of 0.5,
// whose 16 px is already over the cap. No pixel gate on this branch can see
// that, because no capture state arms resonance.
//
// So the quantisation is per material and the edge mesh keeps its own.

describe('glow quantisation per material', () => {
  it('saturates the resonance core at the edge mesh\'s 1/8 px step — the reason for a second scale', () => {
    // Characterising the defect, not endorsing it: at quant 8 a 28px glow and a
    // 200px glow encode identically, and so does the DEFAULT sim's 16px.
    expect(unpackFlags(packFlags(0, 0, resonanceGlow(1))).glow).toBeCloseTo(127 / 8, 10);
    expect(unpackFlags(packFlags(0, 0, resonanceGlow(0.5))).glow).toBeCloseTo(127 / 8, 10);
  });

  it('round-trips the resonance core\'s full range at the additive layer\'s step', () => {
    const q = ADDITIVE_LAYER.glowQuant;
    for (const sim of [0, 0.25, 0.5, 0.75, 1]) {
      const g = resonanceGlow(sim);
      const p = packFlags(0, 0, g, false, q);
      expect(unpackFlags(p, q).glow).toBeCloseTo(g, 10);   // exact: every step is a 1/4
      expect(unpackFlags(p, q).isOrtho).toBe(false);
      expect(Math.fround(p)).toBe(p);
    }
  });

  it('leaves bit 23 free at the additive step, exactly as 14px does at 1/8', () => {
    // round(28 * 4) = 112 — the same number, and the same margin, as the edge
    // mesh's round(14 * 8). isOrtho cannot be reached by a real resonance glow.
    expect(Math.round(resonanceGlow(1) * ADDITIVE_LAYER.glowQuant)).toBe(112);
    expect(Math.round(resonanceGlow(1) * ADDITIVE_LAYER.glowQuant)).toBeLessThan(128);
  });

  it('does not move the edge mesh: the default IS the source-over layer\'s scale', () => {
    // A parity change smuggled into a port task would show up here — every
    // shipped ortho and fused glow byte has to stay what it was.
    expect(SRC_OVER_LAYER.glowQuant).toBe(8);
    for (const g of [0, fusedGlow(0), fusedGlow(1), orthoGlow(0), orthoGlow(5000), 10.37]) {
      expect(packFlags(12, 8, g, true)).toBe(packFlags(12, 8, g, true, SRC_OVER_LAYER.glowQuant));
      expect(packFlags(12, 8, g, true)).toBe(12 + 8 * 256 + (Math.round(g * 8) + 128) * 65536);
    }
  });

  it('still clamps a runaway radius rather than colliding with isOrtho', () => {
    const q = ADDITIVE_LAYER.glowQuant;
    expect(unpackFlags(packFlags(0, 0, 1000, false, q), q).glow).toBeCloseTo(127 / q, 10);
    expect(unpackFlags(packFlags(0, 0, 1000, false, q), q).isOrtho).toBe(false);
  });
});

// ── The additive line layer ────────────────────────────────────────────────
//
// `lighter` is additive and the base edges are source-over, so the resonance
// edge (and, next, the prism chords) need a second mesh with a second blend
// over the SAME shader. The blend is the part a call log cannot check.

describe('ADDITIVE_LAYER', () => {
  it('adds premultiplied ink to the accumulator without raising its alpha', () => {
    // The accumulator holds premultiplied ink with coverage in alpha and the
    // screen pass reads `ink.rgb + uRift * (1 - ink.a)`. This material's
    // fragment stage emits PREMULTIPLIED rgb (see the composite tests below),
    // so One/One adds exactly the ink it emitted — and Zero/One leaves the
    // alpha channel alone, so the rift underneath is not occluded. That last
    // pair is the whole point: on the 2D canvas `lighter` added light over a
    // destination that ALREADY contained the clear colour, and did not hide it.
    const layer = createEdgeLayer(undefined, ADDITIVE_LAYER);
    try {
      expect(layer.material.blending).toBe(THREE.CustomBlending);
      expect(layer.material.blendSrc).toBe(THREE.OneFactor);
      expect(layer.material.blendDst).toBe(THREE.OneFactor);
      expect(layer.material.blendSrcAlpha).toBe(THREE.ZeroFactor);
      expect(layer.material.blendDstAlpha).toBe(THREE.OneFactor);
    } finally { layer.dispose(); }
  });

  it('draws after the source-over edges, which is the 2D draw order', () => {
    expect(ADDITIVE_LAYER.renderOrder).toBeGreaterThan(SRC_OVER_LAYER.renderOrder);
  });

  it('leaves the source-over layer source-over', () => {
    const layer = createEdgeLayer();
    try {
      expect(layer.material.blendSrc).toBe(THREE.SrcAlphaFactor);
      expect(layer.material.blendDst).toBe(THREE.OneMinusSrcAlphaFactor);
      expect(layer.material.blendSrcAlpha).toBe(THREE.OneFactor);
      expect(layer.material.blendDstAlpha).toBe(THREE.OneMinusSrcAlphaFactor);
    } finally { layer.dispose(); }
  });

  it('compiles one shader body into both materials, differing only where it must', () => {
    // "Do not copy the GLSL into a second string." The vertex stage is shared
    // verbatim; the fragment stage differs only in the shadow's colour/alpha.
    const a = createEdgeLayer(undefined, ADDITIVE_LAYER);
    const b = createEdgeLayer(undefined, SRC_OVER_LAYER);
    try {
      expect(a.material.vertexShader).toBe(b.material.vertexShader);
      expect(a.material.fragmentShader).not.toBe(b.material.fragmentShader);
      // The additive shadow is the flat gold ctx.shadowColor, not the gradient,
      // and it is injected FROM the constant rather than retyped in GLSL.
      expect(a.material.fragmentShader).toContain(`float shadowAlpha = ${RESONANCE_SHADOW_ALPHA} * a;`);
      expect(a.material.fragmentShader).not.toContain('uOrthoHue +');
      // and the box filter, the segment-distance glow and the gaussian
      // amplitude are the same code in both.
      for (const shared of ['1.5958', 'exp(-2.0 * g * g)', 'float dSeg']) {
        expect(a.material.fragmentShader).toContain(shared);
        expect(b.material.fragmentShader).toContain(shared);
      }
    } finally { a.dispose(); b.dispose(); }
  });

  // ── The final composite ──────────────────────────────────────────────────
  //
  // A shadowed ctx.stroke() is TWO composite operations with the current
  // operator, the blurred shadow image and then the shape. Under source-over
  // those collapse into one straight-alpha (colour, coverage) pair; under
  // `lighter` they do not — the destination gets `dst + shadowCol*botA +
  // col*topA`, with the shadow BESIDE the stroke, not underneath it. Emitting
  // the source-over stack and blending it SrcAlpha/One is short by
  // `shadowCol * botA * topA`, which is clipped away at high similarity and
  // ~20% of the red channel at sim 0. So the additive material emits
  // premultiplied ink and takes One for its rgb source factor.

  it('carries the STROKE alpha into the shadow amplitude, as the canvas does', () => {
    // A canvas shadow is the blurred SHAPE bitmap tinted by shadowColor, so the
    // stroke's own alpha rides through it. Measured directly in Chrome, at
    // lineWidth 4.2 / shadowBlur 22.5 / shadowColor rgba(255,215,0,0.9), the
    // shadow 6px off the line reads 5, 11, 17, 23, 29 for stroke alphas
    // 0.2 … 1.0 — each the 8-bit truncation of alpha * 29, i.e. exactly linear.
    // The shared amplitude line carries `shadowAlpha` and the geometry but NOT
    // `a`, so the additive snippet folds it in. Without it the core's glow is
    // 1/a too bright: 2.5x at sim 0, 1.21x at the harness's 0.771.
    const a = createEdgeLayer(undefined, ADDITIVE_LAYER);
    const b = createEdgeLayer();
    try {
      expect(a.material.fragmentShader).toContain(`float shadowAlpha = ${RESONANCE_SHADOW_ALPHA} * a;`);
      // and the source-over mesh is deliberately UNTOUCHED — it has the same
      // omission, and correcting it there moves shipped pixels. See the report.
      expect(b.material.fragmentShader).toContain('float shadowAlpha = mix(fuseCos * 0.6, 1.0, vIsOrtho);');
      // the shared amplitude line itself is one string compiled twice.
      for (const f of [a.material.fragmentShader, b.material.fragmentShader])
        expect(f).toContain('float peak = min(shadowAlpha * 1.5958 * vHalfW / max(vGlow, 1e-3), 1.0);');
    } finally { a.dispose(); b.dispose(); }
  });

  it('emits PREMULTIPLIED ink, because lighter adds the shadow beside the stroke', () => {
    const a = createEdgeLayer(undefined, ADDITIVE_LAYER);
    try {
      // The two terms the canvas added, added — not stacked, and not divided
      // back out by a coverage the One factor would never multiply in again.
      expect(a.material.fragmentShader)
        .toContain('gl_FragColor = vec4(col * topA + shadowCol * botA, outA);');
      expect(a.material.fragmentShader).not.toContain('outRGB');
      expect(a.material.blendSrc).toBe(THREE.OneFactor);
    } finally { a.dispose(); }
  });

  it('leaves the source-over composite stacked and straight-alpha', () => {
    // Shipped code: any pixel movement in the edge mesh is a regression, not a
    // fix. The stack, the divide and the SrcAlpha factor that multiplies the
    // coverage back in all stay exactly as they were.
    const b = createEdgeLayer();
    try {
      expect(b.material.fragmentShader)
        .toContain('vec3 outRGB = (col * topA + shadowCol * botA * (1.0 - topA)) / outA;');
      expect(b.material.fragmentShader).toContain('gl_FragColor = vec4(outRGB, outA);');
      expect(b.material.blendSrc).toBe(THREE.SrcAlphaFactor);
    } finally { b.dispose(); }
  });

  it('agrees with the canvas at the two similarities the port is measured at', () => {
    // The shader's emission, in JS, against what the canvas drawing model puts
    // in the destination. Not a pixel test — an arithmetic one on the formula
    // the two composite snippets encode.
    const canvasLighter = (col, topA, shadowCol, botA) =>
      col.map((c, i) => c * topA + shadowCol[i] * botA);
    const emitPremult = (col, topA, shadowCol, botA) =>
      col.map((c, i) => c * topA + shadowCol[i] * botA);          // blendSrc = One
    const emitStraight = (col, topA, shadowCol, botA) => {        // blendSrc = SrcAlpha
      const outA = topA + botA * (1 - topA);
      return col.map((c, i) => (c * topA + shadowCol[i] * botA * (1 - topA)) / outA * outA);
    };
    const gold = RESONANCE_GOLD.map(v => v / 255);
    for (const sim of [0, 0.771]) {
      const halfW = resonanceWidths(sim, 1).core / 2;
      const glow = resonanceGlow(sim);
      const topA = resonanceStops(sim).core.a1;
      // shadowAlpha carries the stroke's own alpha — see the amplitude test.
      const botA = Math.min(topA * RESONANCE_SHADOW_ALPHA * 1.5958 * halfW / glow, 1);
      const col = RESONANCE_CORE_MID.map(v => v / 255);
      const want = canvasLighter(col, topA, gold, botA);
      const got = emitPremult(col, topA, gold, botA);
      const old = emitStraight(col, topA, gold, botA);
      for (let i = 0; i < 3; i++) {
        expect(got[i]).toBeCloseTo(want[i], 10);
        // and the old convention was short by exactly shadowCol*botA*topA.
        expect(want[i] - old[i]).toBeCloseTo(gold[i] * botA * topA, 10);
      }
    }
  });

  it('does not change the halo, whose botA is zero', () => {
    // The one claim that makes the new convention safe for the rest of the
    // layer: with glow = 0 the step(0.001, vGlow) zeroes botA, and premultiplied
    // `col*topA + shadowCol*0` is the same ink SrcAlpha * (col*topA/topA) used
    // to deliver. Task 6's chords carry no shadow either.
    const col = RESONANCE_HALO_MID.map(v => v / 255);
    for (const sim of [0, 0.5, 1]) {
      const topA = resonanceStops(sim).halo.a1, botA = 0;
      const outA = topA + botA * (1 - topA);
      for (let i = 0; i < 3; i++) {
        const premult = col[i] * topA + 0;
        const straight = (col[i] * topA + 0) / outA * outA;
        expect(premult).toBeCloseTo(straight, 10);
      }
    }
  });

  it('clamps to the same place the canvas does, despite clamping once not twice', () => {
    // The canvas clamps as the shadow lands in its 8-bit store and again as the
    // shape does; GL clamps the single sum once. For non-negative terms the two
    // agree — min(1, a + min(1, b + d)) === min(1, a + b + d).
    const m = v => Math.min(1, v);
    for (const a of [0, 0.3, 0.9, 1.4])
      for (const b of [0, 0.4, 1.1])
        for (const d of [0, 0.6, 0.95])
          expect(m(a + m(b + d))).toBeCloseTo(m(a + b + d), 10);
  });

  it('keeps every non-uniform branch below the derivative reads, in both materials', () => {
    // dFdx/dFdy are undefined inside non-uniform control flow, so the shader
    // takes both derivatives at the top of main() before anything branches.
    // Neither shadow snippet branches today, but they are INJECTED text: a
    // future snippet carrying an `if` that landed above the reads would be
    // undefined behaviour SwiftShader will not surface. This pins the order.
    for (const spec of [SRC_OVER_LAYER, ADDITIVE_LAYER]) {
      const layer = createEdgeLayer(undefined, spec);
      try {
        const frag = layer.material.fragmentShader;
        expect(frag.indexOf('dFdx')).toBeGreaterThan(-1);
        expect(frag.indexOf('shadowAlpha')).toBeGreaterThan(-1);
        expect(frag.indexOf('dFdx')).toBeLessThan(frag.indexOf('shadowAlpha'));
        expect(frag.lastIndexOf('dFdy')).toBeLessThan(frag.indexOf('shadowAlpha'));
      } finally { layer.dispose(); }
    }
  });

  it('publishes its glow quantisation to the shader so the packing agrees', () => {
    const a = createEdgeLayer(undefined, ADDITIVE_LAYER);
    const b = createEdgeLayer();
    try {
      expect(a.uniforms.uGlowQuant.value).toBe(ADDITIVE_LAYER.glowQuant);
      expect(b.uniforms.uGlowQuant.value).toBe(SRC_OVER_LAYER.glowQuant);
    } finally { a.dispose(); b.dispose(); }
  });
});

describe('writeRgb255', () => {
  // The resonance strokes are authored as rgba() bytes, not as the HSL objects
  // the node palette uses, so they must NOT go through writeHslRgb.
  it('normalises 0-255 bytes into the 0-1 floats the attribute carries', () => {
    const out = new Float32Array(8).fill(-1);
    writeRgb255(out, 4, RESONANCE_GOLD);
    expect([...out.subarray(0, 4)]).toEqual([-1, -1, -1, -1]);
    // fround, not the raw quotient: the attribute is a Float32Array, so the
    // exact value the GPU reads is the float32 nearest to 215/255.
    expect(out[4]).toBe(1);
    expect(out[5]).toBe(Math.fround(215 / 255));
    expect(out[6]).toBe(0);
    expect(out[7]).toBe(-1);
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

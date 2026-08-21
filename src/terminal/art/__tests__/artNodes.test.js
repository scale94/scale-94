// artNodes.test.js — drift guards for the node layers' arithmetic.
//
// These are NOT parity evidence. ArtTab cannot mount in jsdom, so nothing here
// proves a pixel. What they prove is that the numbers in artNodes.js are the
// numbers the draw loop used, so that when step 5 points a shader at this
// module the shader and the 2D code it replaces cannot silently diverge.
//
// Every expectation is written as the LITERAL arithmetic from the draw loop,
// not as a call to the function under test. A test that re-uses the
// implementation to compute its own expectation proves only that the function
// is deterministic.

import { describe, it, expect } from 'vitest';
import {
  nodeEnergy, depthCueAlpha, resonanceDimmed, nodeRadius, coreAlpha, coreIsOpaque,
  coreColorSource,
  birthEase, birthProgress, birthProject, bleedMix,
  spectralBlend, rgbHue, spectralTint,
  haloDraws, haloRadius, haloInnerRadius, haloAlpha,
  strokeAnnulus,
  beaconPulse, beaconRadius, beaconAlpha,
  chimeraSyncPulse, chimeraSyncAlpha, chimeraSyncRadius,
  chimeraFlickRate, chimeraFlickAlpha, chimeraFlickRadius, chimeraFlickHue,
  ghostDraws, ghostRadius, ghostOuterRadius, ghostAlpha, ghostSweep,
  ghostSweepEncoded,
  fusionPulse, fusionRingRadius, fusionRingAlpha, fusionThreadAlpha,
  probePulse, probeDepthAlpha, probeRadius, probeGlowRadius, probeGlowInnerRadius,
  probeCoreAlpha, probeTetherAlpha, probeCentroid,
  HOVER_ENERGY_BONUS, DEPTH_ALPHA_FLOOR, RESONANCE_DIM, BIRTH_MS,
  CHIMERA_ALPHA_CUTOFF, GHOST_CUTOFF,
} from '../artNodes';
import {
  createEdgeState, writeDisc, readDisc, discEncodingInvariant,
  discWidth, isDisc, packAlphas, packFlags,
  EDGE_OFF, EDGE_STRIDE, DISC_OFF, DISC_RESERVED,
  packHsl, unpackHsl, discShadowFit, DISC_SHADOW_K,
} from '../SphereEdges';
import { edgeLineWidth } from '../artEdges';
import { lerpColor } from '../../data/kernelColorMap';

describe('depth cue, radius and core alpha', () => {
  it('adds the hover bonus before radius and alpha are derived', () => {
    expect(nodeEnergy(0.2, false)).toBe(0.2);
    expect(nodeEnergy(0.2, true)).toBeCloseTo(0.2 + HOVER_ENERGY_BONUS, 12);
  });

  it('cues depth as (depth + 1) * 0.5 with a floor', () => {
    expect(depthCueAlpha(1)).toBeCloseTo(1, 12);
    expect(depthCueAlpha(0)).toBeCloseTo(0.5, 12);
    expect(depthCueAlpha(-1)).toBe(DEPTH_ALPHA_FLOOR);
    // The floor bites well before the back pole: (d+1)*0.5 < 0.08 for d < -0.84
    expect(depthCueAlpha(-0.9)).toBe(DEPTH_ALPHA_FLOOR);
    expect(depthCueAlpha(-0.8)).toBeCloseTo(0.1, 12);
  });

  it('dims only the non-selected nodes, and only while resonance is armed', () => {
    expect(resonanceDimmed(0.6, true, false)).toBeCloseTo(0.6 * RESONANCE_DIM, 12);
    expect(resonanceDimmed(0.6, true, true)).toBe(0.6);
    expect(resonanceDimmed(0.6, false, false)).toBe(0.6);
  });

  it('leaves every node undimmed when the mode is armed with nothing selected', () => {
    // The capture-state bug in one line: `active` is false when the selection
    // is empty, so a run that armed resonance and selected nothing rendered
    // identically to a build with this layer deleted.
    const active = false;   // resonanceModeRef && resonanceNodes.length > 0
    for (const selected of [true, false]) {
      expect(resonanceDimmed(0.42, active, selected)).toBe(0.42);
    }
  });

  it('sizes the disc as (5 + energy*4) * scale', () => {
    expect(nodeRadius(0, 1)).toBe(5);
    expect(nodeRadius(0.5, 1)).toBeCloseTo(7, 12);
    expect(nodeRadius(0.5, 2)).toBeCloseTo(14, 12);
  });

  it('alphas the core as (0.45 + energy*0.55) * depthAlpha', () => {
    expect(coreAlpha(0, 1)).toBeCloseTo(0.45, 12);
    expect(coreAlpha(1, 1)).toBeCloseTo(1.0, 12);
    expect(coreAlpha(1, 0.5)).toBeCloseTo(0.5, 12);
  });

  it('draws a HOVERED core from the PRE-SPECTRAL colour', () => {
    // spectralTint rewrites hue and sat but passes `hsl` through untouched,
    // and the hovered core is drawn from that string. So the one node the
    // viewer is pointing at is the one node NOT wearing the tint. Measured
    // firing on 31/31 nodes in every capture state, so this is not an edge
    // case — a GL writer that takes renderCol recolours it.
    const preTint = { hue: 100, sat: 50, lit: 60, hsl: 'hsl(100,50%,60%)' };
    const tinted = spectralTint(preTint, [1, 0, 0, 1], 1);
    expect(tinted.hue).not.toBeCloseTo(preTint.hue, 3);      // the tint moved it
    expect(tinted.hsl).toBe(preTint.hsl);                    // the string did not
    expect(coreColorSource(tinted, preTint, true)).toBe(preTint);
    expect(coreColorSource(tinted, preTint, false)).toBe(tinted);
  });

  it('keeps the BLEED in both, because lerpColor recomputes hsl', () => {
    // The split is spectral-only. If it were bleed too, a bleeding hovered
    // node would show its original colour, and it does not.
    const a = { hue: 0, sat: 100, lit: 50, hsl: 'hsl(0.0,100.0%,50.0%)' };
    const b = { hue: 60, sat: 100, lit: 50, hsl: 'hsl(60.0,100.0%,50.0%)' };
    const bled = lerpColor(a, b, bleedMix(1));
    expect(bled.hsl).toBe(`hsl(${bled.hue.toFixed(1)},${bled.sat.toFixed(1)}%,${bled.lit.toFixed(1)}%)`);
  });

  it('flags the hovered core as opaque — it bypasses BOTH alphas', () => {
    // The draw loop uses renderCol.hsl for a hovered node, which carries no
    // alpha at all. A back-facing hovered node is drawn at full opacity, and a
    // GL writer that applies coreAlpha unconditionally will dim it.
    expect(coreIsOpaque(true)).toBe(true);
    expect(coreIsOpaque(false)).toBe(false);
  });
});

describe('birth animation', () => {
  it('eases as 1 - (1-t)^3', () => {
    expect(birthEase(0)).toBe(0);
    expect(birthEase(1)).toBe(1);
    expect(birthEase(0.5)).toBeCloseTo(1 - 0.125, 12);
    // Ease-OUT: fast first, so the midpoint is well past halfway.
    expect(birthEase(0.5)).toBeGreaterThan(0.5);
  });

  it('reports null once the 400ms window has closed', () => {
    expect(birthProgress(BIRTH_MS)).toBeNull();
    expect(birthProgress(BIRTH_MS + 1)).toBeNull();
    expect(birthProgress(0)).toEqual({ t: 0, ease: 0 });
    const mid = birthProgress(200);
    expect(mid.t).toBeCloseTo(0.5, 12);
  });

  it('interpolates scale and depth as well as position', () => {
    const from = { sx: 0, sy: 0, depth: -1, scale: 0.5 };
    const to   = { sx: 100, sy: 200, depth: 1, scale: 1.5 };
    expect(birthProject(from, to, 0)).toEqual(from);
    expect(birthProject(from, to, 1)).toEqual(to);
    const half = birthProject(from, to, 0.5);
    expect(half.sx).toBeCloseTo(50, 12);
    expect(half.depth).toBeCloseTo(0, 12);
    expect(half.scale).toBeCloseTo(1, 12);
  });
});

describe('bleed and spectral tint', () => {
  it('mixes the source colour at 0.7 of the bleed amount', () => {
    expect(bleedMix(1)).toBeCloseTo(0.7, 12);
    expect(bleedMix(0)).toBe(0);
  });

  it('blends the spectral tint at 8% rising to 23% with flux', () => {
    expect(spectralBlend(0)).toBeCloseTo(0.08, 12);
    expect(spectralBlend(1)).toBeCloseTo(0.23, 12);
  });

  it('computes hue with the six-sector form, % 6 inside the * 60', () => {
    expect(rgbHue(1, 0, 0)).toBeCloseTo(0, 10);
    expect(rgbHue(0, 1, 0)).toBeCloseTo(120, 10);
    expect(rgbHue(0, 0, 1)).toBeCloseTo(240, 10);
    expect(rgbHue(1, 1, 1)).toBe(0);       // achromatic
    // The red wrap is where a rewritten form diverges: b > g on a red max
    // gives a negative sixth, and the % 6 has to bring it round to ~300.
    expect(rgbHue(1, 0, 0.5)).toBeCloseTo(330, 10);
  });

  it('leaves lit and the pre-rendered hsl string untouched', () => {
    const col = { hue: 100, sat: 50, lit: 60, hsl: 'hsl(100,50%,60%)' };
    const out = spectralTint(col, [1, 0, 0, 1], 0);
    expect(out.lit).toBe(60);
    expect(out.hsl).toBe('hsl(100,50%,60%)');
  });

  it('passes the colour through unchanged when there is no spectral sample', () => {
    const col = { hue: 100, sat: 50, lit: 60, hsl: 'x' };
    expect(spectralTint(col, null, 0.5)).toBe(col);
    expect(spectralTint({ ...col, hue: null }, [1, 0, 0, 1], 0.5).hue).toBeNull();
  });

  it('lerps hue LINEARLY, not around the circle — the recorded quirk', () => {
    // 350 tinted toward 10 at 8%: the shortest arc would go 350 -> 351.6,
    // forward through 0. The shipping form goes BACKWARDS to 322.8.
    const col = { hue: 350, sat: 0, lit: 0, hsl: '' };
    const out = spectralTint(col, [1, 0, 0, 1], 0);   // hue 0, blend 0.08
    expect(out.hue).toBeCloseTo(350 + (0 - 350) * 0.08, 10);
    expect(out.hue).toBeCloseTo(322, 0);
    expect(out.hue).toBeLessThan(350);
  });

  it('scales the saturation term by a further 0.3', () => {
    const col = { hue: 0, sat: 0, lit: 0, hsl: '' };
    // A fully saturated red sample: sat term is (1-0)/1*100 = 100.
    const out = spectralTint(col, [1, 0, 0, 1], 0);
    expect(out.sat).toBeCloseTo(0 + (100 - 0) * 0.08 * 0.3, 10);
  });
});

describe('the glow halo — a linear ramp, not a gaussian', () => {
  it('draws above 0.08 energy, or at any energy while bleeding', () => {
    expect(haloDraws(0.09, 0)).toBe(true);
    expect(haloDraws(0.08, 0)).toBe(false);   // strictly greater
    expect(haloDraws(0, 0.5)).toBe(true);
  });

  it('reaches radius + (energy + bleed*0.4) * 16 * scale', () => {
    expect(haloRadius(10, 0.5, 0, 1)).toBeCloseTo(10 + 0.5 * 16, 12);
    expect(haloRadius(10, 0, 1, 1)).toBeCloseTo(10 + 0.4 * 16, 12);
    expect(haloRadius(10, 0.5, 0, 2)).toBeCloseTo(10 + 0.5 * 16 * 2, 12);
  });

  it('starts its ramp at 0.4 of the radius, unscaled', () => {
    // The inner stop rides the radius, which already carries the scale — it is
    // NOT multiplied by scale a second time.
    expect(haloInnerRadius(10)).toBeCloseTo(4, 12);
    expect(haloInnerRadius(20)).toBeCloseTo(8, 12);
  });

  it('alphas as (energy + bleed*0.25) * 0.38 * depthAlpha', () => {
    expect(haloAlpha(1, 0, 1)).toBeCloseTo(0.38, 12);
    expect(haloAlpha(0, 1, 1)).toBeCloseTo(0.25 * 0.38, 12);
    expect(haloAlpha(1, 0, 0.5)).toBeCloseTo(0.19, 12);
  });

  it('uses a different bleed weight for reach than for alpha', () => {
    // 0.4 in the radius, 0.25 in the alpha. Collapsing them to one constant
    // looks like a tidy-up and changes the layer.
    expect(haloRadius(0, 0, 1, 1)).toBeCloseTo(0.4 * 16, 12);
    expect(haloAlpha(0, 1, 1)).toBeCloseTo(0.25 * 0.38, 12);
  });
});

describe('a stroked circle, as an annulus', () => {
  it('centres the band ON the path, the way a canvas stroke does', () => {
    // r = 20, w = 4 covers 18..22 — NOT 0..20, and not 0..22.
    expect(strokeAnnulus(20, 4)).toEqual({ rOuter: 22, rInner: 18 });
  });

  it('keeps the band width, so the ring is as thick as the lineWidth was', () => {
    for (const [r, w] of [[6, 1.5], [40, 1], [12.5, 3], [3, 0.5]]) {
      const a = strokeAnnulus(r, w);
      expect(a.rOuter - a.rInner).toBeCloseTo(w, 12);
      expect((a.rOuter + a.rInner) / 2).toBeCloseTo(r, 12);
    }
  });

  it('clamps the hole shut rather than going negative', () => {
    // A stroke wider than the diameter covers the centre, which IS a filled
    // disc — and rInner = 0 is how the encoding spells "filled". A negative
    // inner radius would be rejected by discEncodingInvariant() instead.
    expect(strokeAnnulus(2, 10)).toEqual({ rOuter: 7, rInner: 0 });
    expect(strokeAnnulus(2, 4)).toEqual({ rOuter: 4, rInner: 0 });
  });

  it('survives the encoding it was built for', () => {
    // The conversion is only worth anything if what it produces is a legal
    // instance: an inner radius that exceeds the outer is exactly what
    // discEncodingInvariant() rejects, and a clamp is what keeps it from one.
    const st = createEdgeState(4);
    const a = strokeAnnulus(6, 1.5);
    writeDisc(st.data, 0, {
      cx: 100, cy: 50, rOuter: a.rOuter, rInner: a.rInner,
      hsl: { hue: 45, sat: 90, lit: 70 }, alpha: 0.18, flags: packFlags(0, 0, 0),
    });
    expect(discEncodingInvariant(st.data, 0)).toEqual([]);
    const d = readDisc(st.data, 0);
    expect(d.isDisc).toBe(true);
    expect(d.rOuter).toBeCloseTo(6.75, 5);
    expect(d.rInner).toBeCloseTo(5.25, 5);
  });

  it('a hole-clamped ring is byte-identical to the filled disc it becomes', () => {
    const st = createEdgeState(4);
    const a = strokeAnnulus(2, 10);
    writeDisc(st.data, 0, { cx: 1, cy: 2, rOuter: a.rOuter, rInner: a.rInner,
      rgb: [1, 1, 1], alpha: 0.5, flags: 0 });
    writeDisc(st.data, EDGE_STRIDE, { cx: 1, cy: 2, rOuter: 7,
      rgb: [1, 1, 1], alpha: 0.5, flags: 0 });
    expect(Array.from(st.data.slice(0, EDGE_STRIDE)))
      .toEqual(Array.from(st.data.slice(EDGE_STRIDE, EDGE_STRIDE * 2)));
  });
});

describe('the beacon ring', () => {
  it('pulses as sin SQUARED, so it swells without going dark', () => {
    // sin^2 never goes negative, so the ring holds a floor of 0.3 throughout.
    for (const t of [0, 0.3, 0.7, 1.1, 2.0, 3.3]) {
      expect(beaconPulse(t)).toBeGreaterThanOrEqual(0.3 - 1e-12);
      expect(beaconPulse(t)).toBeLessThanOrEqual(0.8 + 1e-12);
    }
    expect(beaconPulse(Math.PI / 4)).toBeCloseTo(0.3 + 0.5, 10);   // sin(pi/2)=1
  });

  it('sits at radius + (6 + pulse*6) * scale', () => {
    expect(beaconRadius(10, 0, 1)).toBeCloseTo(16, 12);
    expect(beaconRadius(10, 1, 1)).toBeCloseTo(22, 12);
    expect(beaconRadius(10, 1, 2)).toBeCloseTo(34, 12);
  });

  it('alphas as pulse * 0.2 * depthAlpha', () => {
    expect(beaconAlpha(0.8, 1)).toBeCloseTo(0.16, 12);
    expect(beaconAlpha(0.8, 0.5)).toBeCloseTo(0.08, 12);
  });
});

describe('the chimera rings', () => {
  it('pulses sync as 0.5 + 0.5*sin(t*2 + meanPhase)', () => {
    expect(chimeraSyncPulse(0, 0)).toBeCloseTo(0.5, 12);
    expect(chimeraSyncPulse(0, Math.PI / 2)).toBeCloseTo(1, 12);
    expect(chimeraSyncPulse(0, -Math.PI / 2)).toBeCloseTo(0, 12);
  });

  it('can fall UNDER the cutoff for a whole frame at a fixed clock', () => {
    // This is the trap that made a forcing harness capture an empty frame
    // while reporting the layer forced on: at the trough the alpha is 0
    // however high orderParam is.
    const trough = chimeraSyncPulse(0, -Math.PI / 2);
    expect(chimeraSyncAlpha(1.0, trough, 1)).toBeLessThan(CHIMERA_ALPHA_CUTOFF);
    const peak = chimeraSyncPulse(0, Math.PI / 2);
    expect(chimeraSyncAlpha(1.0, peak, 1)).toBeGreaterThan(CHIMERA_ALPHA_CUTOFF);
  });

  it('alphas sync as orderParam * pulse * 0.18 * depthAlpha', () => {
    expect(chimeraSyncAlpha(1, 1, 1)).toBeCloseTo(0.18, 12);
    expect(chimeraSyncAlpha(0.5, 1, 0.5)).toBeCloseTo(0.045, 12);
  });

  it('puts the sync ring at +6 and the flicker ring at +8', () => {
    expect(chimeraSyncRadius(10, 1)).toBeCloseTo(16, 12);
    expect(chimeraFlickRadius(10, 1)).toBeCloseTo(18, 12);
    expect(chimeraSyncRadius(10, 2)).toBeCloseTo(22, 12);
  });

  it('rates the flicker as 5 + orderParam*8', () => {
    expect(chimeraFlickRate(0)).toBe(5);
    expect(chimeraFlickRate(1)).toBe(13);
  });

  it('flickers per NODE INDEX, so neighbours are out of step', () => {
    const rate = chimeraFlickRate(0.5);
    const a = chimeraFlickAlpha(1.0, rate, 0, 1);
    const b = chimeraFlickAlpha(1.0, rate, 1, 1);
    expect(a).not.toBeCloseTo(b, 6);
    expect(a).toBeCloseTo((0.15 + Math.sin(1.0 * rate + 0) * 0.12) * 1, 12);
  });

  it('steps the flicker hue with | 0, and swings it +-40 around 200', () => {
    for (const i of [0, 3, 7, 11]) {
      const h = chimeraFlickHue(1.7, i);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(160);
      expect(h).toBeLessThanOrEqual(240);
    }
  });
});

describe('the ghost rings — the sweep IS the animation', () => {
  it('draws strictly above 0.02', () => {
    expect(ghostDraws(GHOST_CUTOFF)).toBe(false);
    expect(ghostDraws(GHOST_CUTOFF + 1e-9)).toBe(true);
  });

  it('sweeps the inner ring 0 -> 2pi with completion', () => {
    expect(ghostSweep(0)).toBe(0);
    expect(ghostSweep(0.5)).toBeCloseTo(Math.PI, 12);
    expect(ghostSweep(1)).toBeCloseTo(Math.PI * 2, 12);
  });

  it('grows the radius with completion as well as sweeping', () => {
    // radius + 4*scale + g*6*scale — the ring moves outward AND closes.
    expect(ghostRadius(10, 0, 1)).toBeCloseTo(14, 12);
    expect(ghostRadius(10, 1, 1)).toBeCloseTo(20, 12);
    expect(ghostRadius(10, 1, 2)).toBeCloseTo(10 + 8 + 12, 12);
  });

  it('sets the outer ring 3*scale beyond the inner one', () => {
    expect(ghostOuterRadius(20, 1)).toBeCloseTo(23, 12);
    expect(ghostOuterRadius(20, 2)).toBeCloseTo(26, 12);
  });

  it('alphas as g * depthAlpha, before each ring takes its own share', () => {
    expect(ghostAlpha(0.5, 1)).toBeCloseTo(0.5, 12);
    expect(ghostAlpha(0.5, 0.4)).toBeCloseTo(0.2, 12);
  });
});

describe('the ghost sweep, as the encoding wants it', () => {
  it('passes a partial arc straight through', () => {
    for (const g of [0.05, 0.25, 0.5, 0.9, 0.999]) {
      expect(ghostSweepEncoded(g)).toBeCloseTo(Math.PI * 2 * g, 12);
    }
  });

  it('writes a COMPLETE ghost as a full circle, not as a sweep of 2pi', () => {
    // 0 is the encoding's "full circle" sentinel. 2pi would take the shader's
    // sweep branch, which antialiases both ends of the arc onto the same angle
    // and leaves a half-lit seam ctx.arc(0, 2pi) does not have.
    expect(ghostSweepEncoded(1)).toBe(0);
    expect(ghostSweepEncoded(1.4)).toBe(0);
  });

  it('is a legal disc instance at every completion', () => {
    const st = createEdgeState(4);
    for (const g of [0.02001, 0.3, 0.75, 1]) {
      writeDisc(st.data, 0, {
        cx: 40, cy: 40, rOuter: 12, rInner: 10.5,
        sweepEnd: ghostSweepEncoded(g),
        hsl: { hue: 180, sat: 70, lit: 75 }, alpha: ghostAlpha(g, 1) * 0.5,
        flags: packFlags(0, 0, 0),
      });
      expect(discEncodingInvariant(st.data, 0)).toEqual([]);
      expect(readDisc(st.data, 0).sweepEnd).toBeCloseTo(g >= 1 ? 0 : Math.PI * 2 * g, 5);
    }
  });
});

describe('manual fusion', () => {
  it('pulses at 5 rad/s', () => {
    expect(fusionPulse(0)).toBeCloseTo(0.5, 12);
    expect(fusionPulse(Math.PI / 10)).toBeCloseTo(1, 12);
  });

  it('recomputes the node polynomial inside the scale multiply', () => {
    // (5 + energy*4 + 8 + pulse*6) * scale — NOT nodeRadius() + something,
    // which would put the +8 outside the scale for a scaled node.
    expect(fusionRingRadius(0.5, 0, 1)).toBeCloseTo(5 + 2 + 8, 12);
    expect(fusionRingRadius(0.5, 1, 2)).toBeCloseTo((5 + 2 + 8 + 6) * 2, 12);
  });

  it('alphas the ring 0.55..1.0 and the thread 0.3..0.45', () => {
    expect(fusionRingAlpha(0)).toBeCloseTo(0.55, 12);
    expect(fusionRingAlpha(1)).toBeCloseTo(1.0, 12);
    expect(fusionThreadAlpha(0)).toBeCloseTo(0.3, 12);
    expect(fusionThreadAlpha(1)).toBeCloseTo(0.45, 12);
  });

  it('gives the thread NO depth cue — it ends at a cursor, which has no depth', () => {
    // fusionThreadAlpha takes no depthAlpha argument at all. Recorded here so
    // a GL writer does not "fix" it by multiplying one in.
    expect(fusionThreadAlpha.length).toBe(1);
  });
});

describe('the probe node', () => {
  it('floors its depth cue at 0.12, HIGHER than the nodes 0.08', () => {
    expect(probeDepthAlpha(-1)).toBeCloseTo(0.12, 12);
    expect(probeDepthAlpha(1)).toBeCloseTo(1, 12);
    expect(probeDepthAlpha(-1)).toBeGreaterThan(DEPTH_ALPHA_FLOOR);
  });

  it('pulses on a 0.003 rad/ms epoch clock', () => {
    expect(probePulse(0)).toBeCloseTo(0.5, 12);
    expect(probePulse(Math.PI / 2 / 0.003)).toBeCloseTo(1, 10);
  });

  it('sizes the core at 6*scale and the glow at core + pulse*14*scale', () => {
    expect(probeRadius(1)).toBe(6);
    expect(probeRadius(2)).toBe(12);
    expect(probeGlowRadius(6, 0, 1)).toBe(6);
    expect(probeGlowRadius(6, 1, 1)).toBeCloseTo(20, 12);
    expect(probeGlowRadius(12, 1, 2)).toBeCloseTo(12 + 28, 12);
  });

  it('starts the glow ramp at 0.3 of the core radius', () => {
    expect(probeGlowInnerRadius(6)).toBeCloseTo(1.8, 12);
  });

  it('alphas the core 0.75..1.0 scaled by depth', () => {
    expect(probeCoreAlpha(0, 1)).toBeCloseTo(0.75, 12);
    expect(probeCoreAlpha(1, 1)).toBeCloseTo(1.0, 12);
    expect(probeCoreAlpha(1, 0.5)).toBeCloseTo(0.5, 12);
  });

  it('normalises tether alpha against the STRONGEST anchor, not the sum', () => {
    // The brightest tether is always at 0.55 * depthAlpha however weak the
    // match is overall — the layer reads as relative confidence, not absolute.
    expect(probeTetherAlpha(0.1, 0.1, 1)).toBeCloseTo(0.55, 12);
    expect(probeTetherAlpha(0.9, 0.9, 1)).toBeCloseTo(0.55, 12);
    expect(probeTetherAlpha(0.45, 0.9, 1)).toBeCloseTo(0.275, 12);
  });

  it('forms a weighted centroid and renormalises it onto the unit sphere', () => {
    const nodes = {
      a: { x: 1, y: 0, z: 0 },
      b: { x: 0, y: 1, z: 0 },
    };
    const c = probeCentroid(
      [{ id: 'a', weight: 1 }, { id: 'b', weight: 1 }],
      (id) => nodes[id] ?? null,
    );
    expect(Math.hypot(c.x, c.y, c.z)).toBeCloseTo(1, 12);
    expect(c.x).toBeCloseTo(Math.SQRT1_2, 12);
    expect(c.wmax).toBe(1);
    expect(c.tethers).toHaveLength(2);
  });

  it('forms a centroid from whatever resolved, and null when nothing did', () => {
    const nodes = { a: { x: 0, y: 0, z: 1 } };
    const some = probeCentroid(
      [{ id: 'a', weight: 0.5 }, { id: 'off-sphere', weight: 0.9 }],
      (id) => nodes[id] ?? null,
    );
    expect(some.tethers).toHaveLength(1);
    // wmax is the max over RESOLVED anchors, so the dropped 0.9 does not dim
    // the surviving tether to 0.55 * 0.5/0.9.
    expect(some.wmax).toBe(0.5);
    expect(probeCentroid([{ id: 'nope', weight: 1 }], () => null)).toBeNull();
    expect(probeCentroid([], () => null)).toBeNull();
  });
});

// ── The instance encoding ───────────────────────────────────────────────────

describe('the disc branch encoding', () => {
  const state = createEdgeState(4);

  const write = (o, over = {}) => {
    state.data.fill(0);
    writeDisc(state.data, o, {
      cx: 100, cy: 200, rOuter: 12, rgb: [1, 0.5, 0.25], alpha: 0.4, ...over,
    });
  };

  it('round-trips every field through readDisc', () => {
    write(0, { rInner: 9, sweepStart: 0.25, sweepEnd: 4.0, falloffInner: 3 });
    const d = readDisc(state.data, 0);
    expect(d).toMatchObject({
      cx: 100, cy: 200, rOuter: 12, rInner: 9,
      sweepStart: 0.25, sweepEnd: 4.0, falloffInner: 3, isDisc: true,
    });
    expect(d.alpha).toBeCloseTo(0.4, 2);   // packAlphas quantises to a byte
  });

  it('marks itself a disc by the width SIGN alone', () => {
    write(0, { rOuter: 12 });
    expect(state.data[EDGE_OFF.width]).toBe(discWidth(12));
    expect(state.data[EDGE_OFF.width]).toBeLessThan(0);
    expect(isDisc(state.data[EDGE_OFF.width])).toBe(true);
  });

  it('never collides with a real segment width, which is provably positive', () => {
    // The encoding is sound only while no edge can land in the disc branch.
    // edgeLineWidth's leading 0.5 and non-negative terms are what guarantee it.
    for (const args of [
      [0, 0, 0, 0, false, 0.4],
      [1, 1, 1, 1, true, 2.0],
      [0.3, 0.7, 0.2, 0.9, false, 1.1],
    ]) {
      const w = edgeLineWidth(...args);
      expect(w).toBeGreaterThan(0);
      expect(isDisc(w)).toBe(false);
    }
  });

  it('zeroes every reserved float', () => {
    write(0, { rInner: 5, sweepEnd: 1 });
    for (const k of DISC_RESERVED) expect(state.data[k]).toBe(0);
  });

  it('puts the repurposed fields exactly where the segment path reads b and phase', () => {
    // This is the claim the whole step rests on, asserted as data: the inner
    // radius IS aEnds.z, the sweep end IS aEnds.w, the sweep start IS aPhase.
    expect(DISC_OFF.inner).toBe(EDGE_OFF.bx);
    expect(DISC_OFF.sweepEnd).toBe(EDGE_OFF.by);
    expect(DISC_OFF.sweepStart).toBe(EDGE_OFF.phase);
    expect(DISC_OFF.falloffInner).toBe(EDGE_OFF.c1);
  });

  it('fits inside the stride, which step 7 bumped to 18 for the disc shadow', () => {
    expect(EDGE_STRIDE).toBe(18);
    const all = [...Object.values(DISC_OFF), ...DISC_RESERVED];
    for (const k of all) expect(k).toBeLessThan(EDGE_STRIDE);
  });

  it('degenerates to step 4s filled disc when inner and sweep are zero', () => {
    // A pulse ring is a ring with no inner radius and no sweep. Everything this
    // encoding adds is zero there, so the existing layer is untouched by it.
    write(0, { rInner: 0, sweepStart: 0, sweepEnd: 0, falloffInner: 0 });
    const d = readDisc(state.data, 0);
    expect(d.rInner).toBe(0);
    expect(d.sweepStart).toBe(0);
    expect(d.sweepEnd).toBe(0);
    expect(d.falloffInner).toBe(0);
  });

  it('does NOT duplicate the centre into aEnds.zw the way the 2D pulse ring does', () => {
    // Recorded deliberately, because it is the reason this cannot be wired
    // before the vertex shader forces `len`: today a pulse ring gets len = 0
    // from b == a, and this encoding leaves b = (rInner, sweepEnd) instead.
    write(0, { cx: 100, cy: 200, rInner: 0, sweepEnd: 0 });
    expect(state.data[EDGE_OFF.bx]).toBe(0);
    expect(state.data[EDGE_OFF.by]).toBe(0);
    expect(state.data[EDGE_OFF.bx]).not.toBe(state.data[EDGE_OFF.ax]);
  });

  it('passes its own invariant, and catches each way of breaking it', () => {
    write(0, { rInner: 6, sweepStart: 0, sweepEnd: 3, falloffInner: 2 });
    expect(discEncodingInvariant(state.data, 0)).toEqual([]);

    write(0, { rInner: 100, rOuter: 12 });
    expect(discEncodingInvariant(state.data, 0)).toContain('inner radius exceeds outer');

    write(0, { rInner: -1 });
    expect(discEncodingInvariant(state.data, 0)).toContain('inner radius is negative');

    write(0);
    state.data[EDGE_OFF.width] = 2;   // a segment width
    expect(discEncodingInvariant(state.data, 0)[0]).toMatch(/not a disc/);

    // The reserved-float check has nothing left to guard: step 6 took all five
    // of the floats the layout set aside, exactly as it said a later step
    // could. The check stays in `discEncodingInvariant` because the list is
    // what a future stride bump will re-populate; what it catches NOW is a mid
    // colour with no stop, which is the same failure one level up.
    expect(DISC_RESERVED).toEqual([]);
    write(0);
    state.data[DISC_OFF.midColor] = 0.5;
    expect(discEncodingInvariant(state.data, 0).join(' ')).toMatch(/mid colour set with no mid stop/);
  });

  it('writes at an arbitrary instance offset without touching its neighbours', () => {
    state.data.fill(0);
    writeDisc(state.data, EDGE_STRIDE, {
      cx: 5, cy: 6, rOuter: 3, rgb: [1, 1, 1], alpha: 1, flags: packFlags(0, 0, 0),
    });
    for (let k = 0; k < EDGE_STRIDE; k++) expect(state.data[k]).toBe(0);
    expect(readDisc(state.data, EDGE_STRIDE).cx).toBe(5);
  });

  it('flattens the gradient by writing one alpha into all three stops', () => {
    write(0, { alpha: 0.6 });
    expect(state.data[EDGE_OFF.alphas]).toBe(packAlphas(0.6, 0.6, 0.6));
  });
});

// ── The mid gradient stop (step 6) ──────────────────────────────────────────
//
// The particle glow is the first disc on this branch whose 2-D gradient is a
// COLOUR ramp rather than an alpha one: lightness 82% -> 65% -> 50%, knee at
// 0.4. The node halo's trick of ramping coverage reproduces the alpha and
// leaves the darkening out, so the encoding has to carry the middle stop.

describe('the disc mid gradient stop', () => {
  const state = createEdgeState(4);
  const base = { cx: 100, cy: 200, rOuter: 12, rgb: [1, 0.5, 0.25], alpha: 0.6 };
  const write = (over = {}) => {
    state.data.fill(0);
    writeDisc(state.data, 0, { ...base, ...over });
  };

  it('round-trips the stop, its colour and its alpha', () => {
    write({ mid: { at: 0.4, rgb: [0.5, 0.25, 0.125], alpha: 0.3 } });
    const d = readDisc(state.data, 0);
    expect(d.mid.at).toBeCloseTo(0.4, 6);
    expect(d.mid.rgb[0]).toBeCloseTo(0.5, 6);
    expect(d.mid.alpha).toBeCloseTo(0.3, 2);   // packAlphas quantises to a byte
    expect(discEncodingInvariant(state.data, 0)).toEqual([]);
  });

  it('leaves a disc WITHOUT a mid stop byte-identical to before step 6', () => {
    // The claim the whole task rests on. Every existing disc — pulse rings,
    // node halos, node cores, ghost rings, probe glows — goes down this path.
    const withNull = new Float32Array(EDGE_STRIDE);
    const without = new Float32Array(EDGE_STRIDE);
    writeDisc(withNull, 0, { ...base, rInner: 3, falloffInner: 2, mid: null });
    writeDisc(without, 0, { ...base, rInner: 3, falloffInner: 2 });
    expect(Array.from(withNull)).toEqual(Array.from(without));
  });

  it('reports no mid stop as null, not as a stop sitting at zero', () => {
    write();
    expect(readDisc(state.data, 0).mid).toBeNull();
  });

  it('keeps all three alphas flat when there is no mid stop', () => {
    write({ alpha: 0.4 });
    const a = readDisc(state.data, 0);
    expect(a.alpha).toBeCloseTo(0.4, 2);
    expect(a.outerAlpha).toBeCloseTo(0.4, 2);
  });

  it('ends the ramp fully transparent by default, as the canvas gradient does', () => {
    write({ mid: { at: 0.4, rgb: [1, 1, 1], alpha: 0.3 } });
    expect(readDisc(state.data, 0).outerAlpha).toBeCloseTo(0, 2);
  });

  it('costs no float for the alpha ramp — the slots were always there', () => {
    // packAlphas has carried three alphas since step 4; discs simply wrote them
    // flat. Only the stop POSITION and the mid COLOUR needed reserved floats.
    expect(DISC_OFF.midStop).toBe(EDGE_OFF.c1 + 1);
    expect(DISC_OFF.midColor).toBe(EDGE_OFF.c2);
    // The stride is 18 since step 7's disc shadow — which is a different float
    // for a different layer. The claim here is that step 6's alpha ramp cost
    // NONE, and that stays true: both offsets above are inside the first 17.
    expect(EDGE_STRIDE).toBe(18);
    expect(DISC_OFF.midColor + 2).toBeLessThan(17);
  });

  it('spends the last reserved float on the outer stop, and paid the bump it promised', () => {
    // The layout reserved five floats "so a later step can take them without a
    // stride bump". Step 6 took all five: four for the mid stop and one for the
    // outer stop's extrapolation factor, and this test recorded that THE NEXT
    // ONE COSTS A STRIDE BUMP.
    //
    // Step 7 is that next one, and it paid: 17 -> 18, for a disc's own shadow
    // colour. Kept as the record of the promise being honoured rather than
    // rewritten as though the bump had always been there — the reserved list is
    // still empty, so the float AFTER this one costs another.
    expect(DISC_RESERVED).toEqual([]);
    expect(DISC_OFF.outerK).toBe(EDGE_OFF.c1 + 2);
    expect(EDGE_STRIDE).toBe(18);
  });

  it('derives the outer colour rather than storing it', () => {
    // Three stops, two colour slots. The particle glow's lightnesses are
    // collinear in RGB above l = 0.5, so the third lies on the line through the
    // other two: outer = mid + (mid - c0) * k. Asserted as arithmetic here and
    // computed the same way in EDGE_FRAG.
    write({ mid: { at: 0.4, rgb: [0.5, 0.5, 0.5], alpha: 0.3 }, outerK: 15 / 17 });
    const d = readDisc(state.data, 0);
    expect(d.mid.outerK).toBeCloseTo(0.88235, 4);
    const c0 = [1, 0.5, 0.25];
    const outer = d.mid.rgb.map((m, i) => m + (m - c0[i]) * d.mid.outerK);
    expect(outer[0]).toBeCloseTo(0.5 + (0.5 - 1) * 15 / 17, 4);
  });

  it('defaults outerK to a flat tail, so an unaware caller is never given a wrong colour', () => {
    write({ mid: { at: 0.4, rgb: [1, 1, 1], alpha: 0.2 } });
    expect(readDisc(state.data, 0).mid.outerK).toBe(0);
  });

  it('rejects a stop at or past the rim', () => {
    write({ mid: { at: 1.5, rgb: [1, 1, 1], alpha: 1 } });
    expect(discEncodingInvariant(state.data, 0)).toContain('mid stop is outside (0,1)');
    write({ mid: { at: 1.0, rgb: [1, 1, 1], alpha: 1 } });
    expect(discEncodingInvariant(state.data, 0)).toContain('mid stop is outside (0,1)');
  });

  it('catches a mid colour left behind with no stop', () => {
    // The failure that draws nothing wrong: the writer changed and the reader
    // did not, so a stale colour sits in aC2 meaning nothing.
    write();
    state.data[DISC_OFF.midColor] = 0.5;
    expect(discEncodingInvariant(state.data, 0)).toContain('mid colour set with no mid stop');
  });

  it('takes the same { hue, sat, lit } objects every other writer here takes', () => {
    // Not { h, s, l }: writeHslRgb reads hue/sat/lit, and the wrong names
    // convert silently to NaN rather than throwing.
    write({ mid: { at: 0.4, hsl: { hue: 210, sat: 70, lit: 65 }, alpha: 0.3 } });
    const d = readDisc(state.data, 0);
    expect(d.mid.rgb.every((c) => c >= 0 && c <= 1)).toBe(true);
    expect(d.mid.rgb[2]).toBeGreaterThan(d.mid.rgb[0]);   // a blue hue
  });
});

// ── Step 7: the 18th float, and the blurred disc ────────────────────────────

describe('packHsl — the disc shadow colour in one float', () => {
  it('round-trips every corner of the domain exactly', () => {
    for (const hue of [0, 1, 30, 210, 359, 360]) {
      for (const sat of [0, 1, 50, 70, 100]) {
        for (const lit of [0, 1, 50, 55, 100]) {
          expect(unpackHsl(packHsl({ hue, sat, lit }))).toEqual({ hue, sat, lit });
        }
      }
    }
  });

  it('stays inside float32 exact-integer range', () => {
    // The whole argument for one float instead of three: the largest payload is
    // 360 + 100*512 + 100*65536, comfortably under 2^24, so every floor() and
    // mod() in the vertex shader is exact.
    expect(packHsl({ hue: 360, sat: 100, lit: 100 })).toBe(6605160);
    expect(packHsl({ hue: 360, sat: 100, lit: 100 })).toBeLessThan(2 ** 24);
  });

  it('clamps rather than wrapping, so a bad hue cannot alias onto a good one', () => {
    expect(unpackHsl(packHsl({ hue: -5, sat: 200, lit: -1 })))
      .toEqual({ hue: 0, sat: 100, lit: 0 });
  });

  it('is written by writeDisc only when a shadow colour is given', () => {
    const st = createEdgeState(4);
    writeDisc(st.data, 0, { cx: 1, cy: 2, rOuter: 3, hsl: { hue: 0, sat: 0, lit: 50 }, alpha: 1 });
    expect(st.data[EDGE_OFF.shadow]).toBe(0);
    writeDisc(st.data, 0, { cx: 1, cy: 2, rOuter: 3, hsl: { hue: 0, sat: 0, lit: 50 }, alpha: 1,
      shadowHsl: { hue: 210, sat: 70, lit: 50 } });
    expect(unpackHsl(st.data[EDGE_OFF.shadow])).toEqual({ hue: 210, sat: 70, lit: 50 });
  });
});

describe('discShadowFit — a canvas shadow on a FILLED DISC', () => {
  // Ground truth: the true convolution of a uniform disc with a gaussian of
  // sigma = blur/2, by polar quadrature. Held against the fit rather than
  // against the shader's comment, on step 6's precedent (discInkCorrection is
  // asserted against a numeric integral too).
  const truth = (r, R, s, N = 400, M = 360) => {
    let sum = 0;
    const du = R / N, dth = (2 * Math.PI) / M;
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) * du;
      let inner = 0;
      for (let j = 0; j < M; j++) {
        const th = (j + 0.5) * dth;
        inner += Math.exp(-(r * r + u * u - 2 * r * u * Math.cos(th)) / (2 * s * s));
      }
      sum += inner * dth * u * du;
    }
    return sum / (2 * Math.PI * s * s);
  };

  it('has an EXACT peak — that half is closed form, not a fit', () => {
    for (const [R, blur] of [[2.5, 4], [4, 4], [8, 4]]) {
      expect(discShadowFit(0, R, blur))
        .toBeCloseTo(1 - Math.exp(-(R * R) / (2 * (blur / 2) ** 2)), 12);
      expect(discShadowFit(0, R, blur)).toBeCloseTo(truth(0, R, blur / 2), 3);
    }
  });

  it('tracks the true profile to under 0.03 over the range the conductor uses', () => {
    // R = dotR + GLOW_PAD is 2.5 or 4 px against sigma = 2, so R/sigma lies in
    // [1.25, 2]. At the layer's alpha of 0.1 an error of 0.03 is 0.77 of 255 —
    // below one 8-bit level, which is the bar this has to clear.
    let worst = 0;
    for (const R of [2.5, 3, 3.5, 4]) {
      for (let k = 0; k <= 10; k++) {
        const r = k * 2.5 * R / 10;
        worst = Math.max(worst, Math.abs(discShadowFit(r, R, 4) - truth(r, R, 2)));
      }
    }
    expect(worst).toBeLessThan(0.03);
  });

  it('beats the SEGMENT law it replaces by an order of magnitude', () => {
    // The segment law measures distance from the disc CENTRE and uses the
    // blurred-LINE peak. This is the measurement that justified the stride bump.
    const segLaw = (r, R, blur) =>
      Math.min(1.5958 * R / blur, 1) * Math.exp(-2 * (r / blur) ** 2);
    let fitErr = 0, segErr = 0;
    for (const R of [2.5, 4]) {
      for (let k = 0; k <= 10; k++) {
        const r = k * 2.5 * R / 10;
        const t = truth(r, R, 2);
        fitErr = Math.max(fitErr, Math.abs(discShadowFit(r, R, 4) - t));
        segErr = Math.max(segErr, Math.abs(segLaw(r, R, 4) - t));
      }
    }
    expect(segErr).toBeGreaterThan(0.25);
    expect(fitErr).toBeLessThan(segErr / 8);
  });

  it('names its fitted constant rather than burying it in the shader', () => {
    // 0.37, not the moment-matched 0.25 — see the note above DISC_SHADOW_K.
    // Pinned so a future edit has to change it deliberately.
    expect(DISC_SHADOW_K).toBe(0.37);
  });
});

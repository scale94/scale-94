// artPrismWave.test.js — the longitudinal wavefront on the prism bundle.
//
// The layer had no time term at all: every point's alpha was
// `lAlpha * cue(tt) * taper`, so a chord lit from root to tip simultaneously
// and the only motion in the whole layer was a hue sliding SIDEWAYS through a
// static brightness ladder. This file pins the travelling term that replaces
// that reading.
//
// REVISED AFTER THE AUTHOR LOOKED. The first version of this layer sent a
// DECAYING TRAIN of three pulses down each chord, and three crests one
// transit apart is a 9.7Hz repetition on the median chord and 17.9Hz on the
// shortest -- he read it as "an aggressive ~10Hz strobe/flicker rather than
// an intensifying pulse", which is what those numbers are. The train is gone.
// One pass, swelling from launch to arrival. The tests below that changed are
// marked, and the one that matters most now counts CRESTS AT A FIXED POINT
// rather than reading a constant, so no future train can pass it.
//
// ── EVERY TEST HERE HAS TO BE ABLE TO FAIL ────────────────────────────────
//
// A property test on a converged value is the trap this project has now paid
// for three times: `toBeCloseTo(1, 6)` on an asymptote passed with the
// mechanism DELETED. So each block below names, in a comment, the exact
// mutation it is supposed to catch, and each one was run against that mutation
// before the implementation existed.
import { describe, it, expect } from 'vitest';
import {
  PRISM_WAVE_W, PRISM_PHASE_STEP, PRISM_WAVE_DEPTH,
  PRISM_WAVE_MS_PER_UNIT, PRISM_WAVE_MIN_MS, PRISM_WAVE_MAX_MS,
  PRISM_WAVE_SWELL, PRISM_WAVE_TAIL_MS,
  PRISM_HUE_LEAD, PRISM_HUE_SKEW, PRISM_HUE_STEP,
  PRISM_WAVE_SEG_FULL, PRISM_WAVE_SEG_NONE, PRISM_WAVE_SEGMENTS,
  PRISM_SPECTRAL_FINE,
  prismPulse, prismPhaseOffset, prismWaveAmp, prismWaveEnv, prismWaveMix,
  prismSegmentFade, prismWaveDuration, prismChordDir,
  prismWavePhase, prismChromaSkew, prismChromaBlend, prismTintHue,
} from '../artEdges';
import { writeHsl } from '../SphereEdges';
import { packetDuration } from '../artStrimer';

describe('prismPulse — the raised cosine', () => {
  // CATCHES: swapping the raised cosine for a hard step or a gaussian. A
  // gaussian never reaches exactly 0 at its half-width and a step is not 1 at
  // the centre.
  it('peaks at exactly 1 on the crest and is exactly 0 at its half-width', () => {
    expect(prismPulse(0)).toBe(1);
    expect(prismPulse(PRISM_WAVE_W)).toBeCloseTo(0, 12);
    expect(prismPulse(-PRISM_WAVE_W)).toBeCloseTo(0, 12);
  });

  it('is exactly 0 outside its support, so a pulse cannot leak down the chord', () => {
    expect(prismPulse(PRISM_WAVE_W * 1.001)).toBe(0);
    expect(prismPulse(-PRISM_WAVE_W * 1.001)).toBe(0);
    expect(prismPulse(12)).toBe(0);
  });

  it('is symmetric about the crest', () => {
    for (const x of [0.01, 0.05, 0.1, 0.17]) {
      expect(prismPulse(x)).toBeCloseTo(prismPulse(-x), 12);
    }
  });

  // CATCHES: a pulse widened until it covers the chord it is crossing. At
  // 2W >= 1 the whole chord crests at once and the layer reads as a SWELL of
  // the whole bundle rather than a front tearing out of the node -- which is
  // the static reading this work exists to remove. It is also why the author
  // kept W and paid for the tessellation instead; see PRISM_WAVE_SEGMENTS.
  it('spans less than the chord it crosses, so it reads as a front not a swell', () => {
    expect(PRISM_WAVE_W * 2).toBeLessThan(1);
  });
});

describe('prismPhaseOffset — the shear across the bundle', () => {
  // CATCHES: a symmetric offset about the middle strand, which is what
  // prismOffset does in SPACE. Doing the same in time would give a chevron
  // where the author asked for "a smooth diagonal wavefront across the
  // bundle", so this one is deliberately monotonic and the test says so.
  it('increases monotonically with the strand index, from zero', () => {
    expect(prismPhaseOffset(0)).toBe(0);
    for (let k = 1; k < PRISM_SPECTRAL_FINE; k++) {
      expect(prismPhaseOffset(k)).toBeGreaterThan(prismPhaseOffset(k - 1));
      expect(prismPhaseOffset(k) - prismPhaseOffset(k - 1)).toBeCloseTo(PRISM_PHASE_STEP, 12);
    }
  });

  // CATCHES: a phase step large enough that the last strand has not left the
  // origin by the time the first has arrived. The bundle would stop reading as
  // one sheared front and start reading as seven separate flicks -- the
  // lateral hopping this whole feature exists to remove, rebuilt out of the
  // fix for it. The last strand's whole pulse must fit inside one transit.
  it('shears the whole bundle by less than one transit', () => {
    expect(prismPhaseOffset(PRISM_SPECTRAL_FINE - 1)).toBeLessThan(1 - 2 * PRISM_WAVE_W);
  });
});

describe('prismWaveAmp — the diagonal that collapses to a point', () => {
  const ks = Array.from({ length: PRISM_SPECTRAL_FINE }, (_, i) => i);

  // THE LOAD-BEARING PROPERTY, and the one the author asked for by name:
  // damp the phase offsets as u -> 1 so the strands converge into a single
  // synchronised arrival pulse.
  //
  // CATCHES: dropping the `* (1 - u)` damping factor. With it gone the strands
  // stay sheared by phi_k all the way to the node and this fails at every k > 0.
  it('is identical across all seven strands at the destination node (u = 1)', () => {
    for (const t of [0, 40, 80, 120, 200]) {
      const at1 = ks.map(k => prismWaveAmp(1, k, t, 120));
      for (const a of at1) expect(a).toBeCloseTo(at1[0], 12);
    }
  });

  // THE FALSIFIER FOR THE TEST ABOVE. If phi_k were zero everywhere, the
  // convergence test would pass vacuously -- there would be nothing to
  // converge. This proves the strands are genuinely staggered at launch.
  //
  // CATCHES: PRISM_PHASE_STEP set to 0, or phi applied but multiplied out.
  it('is NOT identical across strands at the origin (u = 0) — the diagonal is real', () => {
    const at0 = ks.map(k => prismWaveAmp(0, k, 0, 120));
    const spread = Math.max(...at0) - Math.min(...at0);
    expect(spread).toBeGreaterThan(0.2);
  });

  // CATCHES: dropping the `- t/dur` term. Without it the crest sits at a fixed
  // u and the layer is exactly as static as it was before this work.
  it('carries its crest from the origin to the target as time advances', () => {
    const dur = 120;
    const crestAt = (t) => {
      let best = 0, bestU = 0;
      for (let i = 0; i <= 1000; i++) {
        const u = i / 1000;
        const a = prismWaveAmp(u, 3, t, dur);
        if (a > best) { best = a; bestU = u; }
      }
      return bestU;
    };
    const us = [0, 20, 40, 60, 80, 100].map(crestAt);
    for (let i = 1; i < us.length; i++) {
      expect(us[i]).toBeGreaterThan(us[i - 1]);
    }
    // And it actually gets there, rather than creeping.
    expect(crestAt(dur)).toBeGreaterThan(0.9);
  });

  it('is bounded to [0, 1] everywhere it is evaluated', () => {
    for (let t = -50; t <= 700; t += 7) {
      for (const k of ks) {
        for (let i = 0; i <= 40; i++) {
          const a = prismWaveAmp(i / 40, k, t, 120);
          expect(a).toBeGreaterThanOrEqual(0);
          expect(a).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  // ── THE TEST THE AUTHOR'S COMPLAINT IS WRITTEN IN ────────────────────
  //
  // He did not report a wrong constant, he reported a RATE: three crests one
  // transit apart strobe any given point at 1/durMs, which is 9.7Hz on the
  // median chord. So this does not assert that some PULSES constant is 1 --
  // a constant can be reintroduced under another name, and the old test
  // asserted the train's decay ratio while the train itself was the defect.
  // It stands at one point on the chord, watches the entire life of the wave
  // go past, and counts how many times that point is crested.
  //
  // CATCHES: any reintroduced train, echo, ring or bounce, under any name.
  // Against the shipped three-pulse version this counts 3 and fails.
  it('crests a given point exactly ONCE — there is no train, at any u or k', () => {
    const dur = 120;
    const crossings = (u, k) => {
      let runs = 0, inRun = false;
      for (let t = 0; t <= dur * 5; t += 0.5) {
        const on = prismWaveAmp(u, k, t, dur) > 0.05;
        if (on && !inRun) runs++;
        inRun = on;
      }
      return runs;
    };
    for (const u of [0.15, 0.5, 0.85]) {
      for (const k of [0, 3, 6]) {
        expect(crossings(u, k)).toBe(1);
      }
    }
  });
});

describe('prismWaveEnv — the crescendo, and the guarantee that the burn is untouched', () => {
  const dur = 120;

  // THE MOST IMPORTANT TEST IN THIS FILE.
  //
  // The author signed off the sustained glow by eye BEFORE this feature
  // existed. The design's whole safety argument is that once the wave has
  // passed, the alpha expression collapses to exactly what it was. Not
  // approximately -- exactly, so no capture, no ink measurement and no eye can
  // find a difference in the state he approved.
  //
  // CATCHES: an envelope that decays asymptotically instead of reaching zero,
  // which is precisely the `toBeCloseTo(1, 6)` asymptote trap that has bitten
  // this project three times. toBe, not toBeCloseTo, on purpose.
  it('reaches EXACTLY zero after the pass, so the mix is EXACTLY 1', () => {
    const after = dur + PRISM_WAVE_TAIL_MS;
    expect(prismWaveEnv(after, dur)).toBe(0);
    expect(prismWaveEnv(after + 1, dur)).toBe(0);
    expect(prismWaveEnv(9999, dur)).toBe(0);
    // And therefore the alpha multiplier is the identity.
    expect(prismWaveMix(0, prismWaveEnv(after, dur), 1)).toBe(1);
    expect(prismWaveMix(0.5, prismWaveEnv(9999, dur), 1)).toBe(1);
  });

  // CATCHES: a chord that starts waving before its origin node has lit. The
  // cascade hands negative t to chords whose origin is still dark.
  it('is zero before the origin node lights, so an unlit chord stays uniform', () => {
    expect(prismWaveEnv(-1, dur)).toBe(0);
    expect(prismWaveEnv(-200, dur)).toBe(0);
    expect(prismWaveMix(0, prismWaveEnv(-50, dur), 1)).toBe(1);
  });

  // ── THE CRESCENDO ────────────────────────────────────────────────────
  //
  // NEW, AND IT REPLACES A TEST THAT ASSERTED THE OPPOSITE. The shipped
  // version held the envelope at a flat 1 for the whole train and let the
  // PULSES decay instead; the author asked for the reverse -- one pass that
  // "gathers energy from launch to arrival rather than starting at 1.0 and
  // decaying".
  //
  // CATCHES: the flat envelope that shipped (`if (tMs <= total) return 1`),
  // which fails the monotonicity below at the first step.
  it('swells from a barely-there launch to full strength on arrival', () => {
    expect(prismWaveEnv(0, dur)).toBeCloseTo(PRISM_WAVE_SWELL, 12);
    expect(prismWaveEnv(dur, dur)).toBeCloseTo(1, 12);
    let prev = -1;
    for (let t = 0; t <= dur; t += 2) {
      const e = prismWaveEnv(t, dur);
      expect(e).toBeGreaterThan(prev);
      prev = e;
    }
    // Half way across it is genuinely mid-swell, not already saturated: a
    // curve that reached full strength in the first few frames would pass
    // monotonicity and still read as the old flat envelope on screen.
    const half = prismWaveEnv(dur / 2, dur);
    expect(half).toBeGreaterThan(PRISM_WAVE_SWELL + 0.2);
    expect(half).toBeLessThan(0.8);
  });

  // The launch is the one deliberate STEP in the layer: a chord enters the
  // wave at env = PRISM_WAVE_SWELL rather than at 0. It is bounded by the
  // ripple the tessellation already tolerates at this W (4.3% worst case,
  // measured in _a18wsweep.mjs), so it cannot read as an edge of its own.
  //
  // CATCHES: raising the floor to "make the launch visible", which would put
  // a hard edge on the moment the cascade reaches each chord.
  it('steps in below the sampling ripple the tessellation already carries', () => {
    expect(PRISM_WAVE_DEPTH * PRISM_WAVE_SWELL).toBeLessThan(0.043);
  });

  // CATCHES: a release as short as the attack, which reads as the charge
  // being switched off rather than absorbed into the sustained burn. The
  // author's third note: "the wave should deposit energy into the sustained
  // burn, not shutter the light."
  it('releases far more slowly than it swells', () => {
    const MEDIAN = 0.642;                       // lookbook/strimer/report.json
    expect(PRISM_WAVE_TAIL_MS).toBeGreaterThan(3 * prismWaveDuration(MEDIAN));
  });

  it('decays monotonically through the release with no kink at either end', () => {
    const t0 = dur;
    let prev = prismWaveEnv(t0, dur);
    for (let t = t0; t <= t0 + PRISM_WAVE_TAIL_MS; t += 5) {
      const e = prismWaveEnv(t, dur);
      expect(e).toBeLessThanOrEqual(prev + 1e-12);
      prev = e;
    }
    // Flat on BOTH sides of the peak. Smoothstep on either limb lands ~1e-4
    // here; a LINEAR swell would give (1 - SWELL)/dur = 7.5e-3 and a linear
    // release 1/TAIL = 2.8e-3, so this threshold is what separates them.
    const eps = 0.5;
    const slopeIn = (prismWaveEnv(t0, dur) - prismWaveEnv(t0 - eps, dur)) / eps;
    const slopeOut = (prismWaveEnv(t0 + eps, dur) - prismWaveEnv(t0, dur)) / eps;
    expect(Math.abs(slopeIn)).toBeLessThan(1e-3);
    expect(Math.abs(slopeOut)).toBeLessThan(1e-3);
  });
});

describe('prismWaveMix — subtractive, and provably unable to clip', () => {
  // THE REASON THE DESIGN IS SUBTRACTIVE. packAlphas clamps at 255, so an
  // alpha driven past 1.0 saturates silently -- and a saturated bundle loses
  // exactly the chromatic separation between spectral lines that this layer
  // exists to show. The wave therefore takes light away between pulses and
  // never adds any at the crest.
  //
  // CATCHES: a sign flip, or a rewrite to `1 + GAIN * amp`.
  it('never exceeds 1, at any amplitude, envelope or fade', () => {
    for (let a = 0; a <= 1; a += 0.05) {
      for (let e = 0; e <= 1; e += 0.05) {
        for (let f = 0; f <= 1; f += 0.25) {
          const m = prismWaveMix(a, e, f);
          expect(m).toBeLessThanOrEqual(1);
          expect(m).toBeGreaterThanOrEqual(1 - PRISM_WAVE_DEPTH - 1e-12);
        }
      }
    }
  });

  it('is exactly 1 on the crest, so peak brightness is what the author approved', () => {
    expect(prismWaveMix(1, 1, 1)).toBe(1);
  });

  it('bottoms out at the trough by exactly PRISM_WAVE_DEPTH', () => {
    expect(prismWaveMix(0, 1, 1)).toBeCloseTo(1 - PRISM_WAVE_DEPTH, 12);
  });

  // ── THE AUTHOR'S RULING, WRITTEN DOWN ────────────────────────────────
  //
  // This shipped at PRISM_WAVE_DEPTH 0.55 -- a sleeve falling to 0.45 of the
  // sustained alpha -- and he ruled it out by eye: it "aggressively chops
  // down into deep black between states". The deepest the sleeve may now go
  // is 60% of the burn.
  //
  // CATCHES: the depth being walked back up to chase punch. The punch is
  // supposed to come from the crescendo, not from a deeper hole.
  it('never chops the sleeve below 60% of the sustained alpha', () => {
    expect(prismWaveMix(0, 1, 1)).toBeGreaterThanOrEqual(0.6 - 1e-12);
  });

  // The crescendo as it actually reaches the alpha: at launch the chord is
  // all but untouched, and the full trough is only ever reached at arrival.
  //
  // CATCHES: the envelope's swell being bypassed at the call site -- the mix
  // reading a constant 1 for the envelope, say -- which no test on
  // prismWaveEnv alone would see.
  it('barely touches the chord at launch and only bottoms out on arrival', () => {
    const dur = 120;
    const atLaunch = prismWaveMix(0, prismWaveEnv(0, dur), 1);
    const atArrival = prismWaveMix(0, prismWaveEnv(dur, dur), 1);
    expect(atLaunch).toBeGreaterThan(0.95);
    expect(atArrival).toBeCloseTo(1 - PRISM_WAVE_DEPTH, 12);
    expect(atLaunch - atArrival).toBeGreaterThan(0.3);
  });

  // CATCHES: the segment fade wired in the wrong sense, which would switch the
  // wave OFF on the chords that can carry it best.
  it('a zero segment fade disables the wave entirely', () => {
    expect(prismWaveMix(0, 1, 0)).toBe(1);
    expect(prismWaveMix(0.5, 1, 0)).toBe(1);
  });
});

describe('prismSegmentFade — the Nyquist guard', () => {
  // A pulse spanning 2*W of the chord is sampled 2*W*n times on an n-segment
  // tessellation, and writePolyline reconstructs between those samples as a
  // straight line. Below some n the crest beats against the sample grid as it
  // moves. Rather than let that staircase, the wave fades out on chords that
  // cannot carry it.
  //
  // CATCHES: the thresholds transposed, which would fade out the LONG chords.
  it('is off on chords too coarse to sample the pulse and full on chords that can', () => {
    expect(prismSegmentFade(1)).toBe(0);
    expect(prismSegmentFade(PRISM_WAVE_SEG_NONE)).toBe(0);
    expect(prismSegmentFade(PRISM_WAVE_SEG_FULL)).toBe(1);
    expect(prismSegmentFade(PRISM_WAVE_SEG_FULL + 16)).toBe(1);
    // The counts quadSegments actually returns for real prism chords, measured
    // in _a18wsweep.mjs. They ripple by 22-50% at the shipped W, which is why
    // the draw loop forces PRISM_WAVE_SEGMENTS instead of trusting them.
    expect(prismSegmentFade(9)).toBe(0);
    expect(prismSegmentFade(11)).toBe(0);
  });

  // CATCHES: the forced count and the fade's threshold drifting apart. If a
  // chord is tessellated to PRISM_WAVE_SEGMENTS and the fade does not read 1
  // there, the wave is being silently attenuated on every chord that carries
  // it -- which is exactly the state this file was committed in once already.
  it('reads exactly 1 at the count the draw loop actually forces', () => {
    expect(prismSegmentFade(PRISM_WAVE_SEGMENTS)).toBe(1);
  });

  it('ramps monotonically between the two thresholds', () => {
    let prev = -1;
    for (let n = 0; n <= 30; n++) {
      const f = prismSegmentFade(n);
      expect(f).toBeGreaterThanOrEqual(prev);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
      prev = f;
    }
  });

  it('guarantees at least six samples across the pulse wherever it is fully on', () => {
    expect(2 * PRISM_WAVE_W * PRISM_WAVE_SEG_FULL).toBeGreaterThanOrEqual(5);
  });
});

describe('prismWaveDuration — and the lead over the white core', () => {
  // The author's third note: the prism pulse must LEAD the strimer's white-hot
  // rail, so the fibre sleeve reads as carrying the charge just before the
  // main rail detonates.
  //
  // CATCHES: any future edit to either constant that closes the gap --
  // including one made in artStrimer.js, which is why this test imports
  // packetDuration rather than hard-coding 200. A lead that holds at the
  // median but not at the clamps is a lead that disappears on exactly the
  // longest chords, where it would be most visible.
  it('is strictly faster than the strimer packet at every chord length', () => {
    for (let L = 0.05; L <= 2.0; L += 0.01) {
      expect(prismWaveDuration(L)).toBeLessThan(packetDuration(L));
    }
  });

  it('leads by a visible margin on the measured median chord', () => {
    const MEDIAN = 0.642;   // measured, lookbook/strimer/report.json
    const lead = packetDuration(MEDIAN) - prismWaveDuration(MEDIAN);
    expect(lead).toBeGreaterThan(15);
    expect(lead).toBeLessThan(60);
  });

  it('clamps at both ends like the strimer does', () => {
    expect(prismWaveDuration(0)).toBe(PRISM_WAVE_MIN_MS);
    expect(prismWaveDuration(99)).toBe(PRISM_WAVE_MAX_MS);
    const mid = 0.5;
    expect(prismWaveDuration(mid)).toBeCloseTo(mid * PRISM_WAVE_MS_PER_UNIT, 9);
  });
});

describe('prismChordDir — where a chord flows when neither end was clicked', () => {
  // The prism draws a chord between EVERY pair of effect nodes, and
  // `spawnEffect` orders nodeIds as [clicked, ...neighbours, ...bridges], so
  // BFS depth is known at spawn. The wave runs from the shallower end.
  //
  // CATCHES: a comparison written backwards, which would run every cascade
  // INWARD toward the clicked node.
  it('flows from the shallower endpoint toward the deeper one', () => {
    expect(prismChordDir(0, 1)).toBe(1);
    expect(prismChordDir(1, 0)).toBe(-1);
    expect(prismChordDir(1, 2)).toBe(1);
    expect(prismChordDir(2, 1)).toBe(-1);
  });

  // Two nodes at the same depth light at the same instant, so there is no
  // direction to be had. Rather than invent one, the chord is driven from both
  // ends and the two fronts meet in the middle.
  it('reports no direction when both ends light together', () => {
    expect(prismChordDir(1, 1)).toBe(0);
    expect(prismChordDir(0, 0)).toBe(0);
    expect(prismChordDir(2, 2)).toBe(0);
  });
});

// -- THE CHROMATIC FRONT ----------------------------------------------------
//
// The brightness travelled and the colour did not: every point of a chord took
// one flat `writeHsl(hue0 + k * PRISM_HUE_STEP)`, so the wave read as "a light
// shining through stained glass" -- the glass being what the eye tracks. These
// pin the colour to the same advection coordinate the brightness rides.

// The real passes' constants do not matter to any property here; what matters
// is that the base and the anchors are built the way the draw loop builds them.
const SAT = 100, LIT = 60;

function restingColour(hue) {
  const c = new Float32Array(3);
  writeHsl(c, 0, hue, SAT, LIT);
  return c;
}

function tintAnchors(hue) {
  const t = new Float32Array(6);
  writeHsl(t, 0, prismTintHue(hue, 1), SAT, LIT);   // leading edge
  writeHsl(t, 3, prismTintHue(hue, -1), SAT, LIT);  // the wake
  return t;
}

/** Exactly what the draw loop computes for one point, in one call. */
function colourAt(u, k, tMs, dur, hue, weight = 1) {
  const ph = prismWavePhase(u, k, tMs, dur);
  const out = new Float32Array(3);
  prismChromaBlend(out, 0, restingColour(hue), tintAnchors(hue), 0, 3,
                   prismPulse(ph) * weight, prismChromaSkew(ph));
  return out;
}

const spread = (cols) => {
  let worst = 0;
  for (let j = 0; j < 3; j++) {
    const vals = cols.map(c => c[j]);
    worst = Math.max(worst, Math.max(...vals) - Math.min(...vals));
  }
  return worst;
};

describe('prismWavePhase - the sign the amplitude throws away', () => {
  // THE DRAW LOOP NO LONGER CALLS prismWaveAmp. It calls
  // prismPulse(prismWavePhase(...)) so it can keep the sign for the colour, so
  // this is the link that makes every prismWaveAmp property above -- including
  // the one-pass crest count -- a property of what is actually drawn.
  //
  // CATCHES: the two drifting apart. Reintroduce a train in prismWaveAmp and
  // the crest-count test fails; reintroduce one in the phase and this fails.
  it('composes with prismPulse into exactly prismWaveAmp', () => {
    for (let t = -40; t <= 400; t += 11) {
      for (const k of [0, 2, 6]) {
        for (let i = 0; i <= 20; i++) {
          const u = i / 20;
          expect(prismPulse(prismWavePhase(u, k, t, 120)))
            .toBe(prismWaveAmp(u, k, t, 120));
        }
      }
    }
  });

  // CATCHES: an abs() or a square creeping into the phase. The amplitude is
  // symmetric by construction, so without the sign a chromatic front would
  // look identical arriving and leaving -- a pattern that pulses, not one that
  // flows.
  it('is positive ahead of the crest and negative behind it', () => {
    const dur = 120, t = 60;            // the crest sits at u = 0.5 on line 0
    expect(prismWavePhase(0.5, 0, t, dur)).toBeCloseTo(0, 12);
    expect(prismWavePhase(0.6, 0, t, dur)).toBeGreaterThan(0);
    expect(prismWavePhase(0.4, 0, t, dur)).toBeLessThan(0);
    // ...and the amplitude genuinely cannot tell those two apart.
    expect(prismWaveAmp(0.6, 0, t, dur)).toBeCloseTo(prismWaveAmp(0.4, 0, t, dur), 12);
  });
});

describe('prismChromaSkew - where a point sits across the pulse', () => {
  it('runs -1 at the wake, 0 on the crest, +1 at the leading edge', () => {
    expect(prismChromaSkew(0)).toBe(0);
    expect(prismChromaSkew(PRISM_WAVE_W)).toBeCloseTo(1, 12);
    expect(prismChromaSkew(-PRISM_WAVE_W)).toBeCloseTo(-1, 12);
  });

  // CATCHES: an unclamped ratio. Outside the pulse the amplitude is 0, so the
  // skew is unweighted there -- but it feeds a lerp weight of (skew + 1) / 2,
  // and an unclamped value would drive that outside [0, 1] and extrapolate the
  // tint past its own anchors.
  it('is clamped, so the tint can never be extrapolated past its anchors', () => {
    expect(prismChromaSkew(12)).toBe(1);
    expect(prismChromaSkew(-12)).toBe(-1);
  });
});

describe('prismChromaBlend - the colour that actually flows', () => {
  const dur = 120, HUE = 200;

  // THE MOST IMPORTANT TEST IN THIS BLOCK, and it is deliberately two
  // assertions rather than one.
  //
  // A colour that changed in TIME but was uniform along the chord is exactly
  // the `hue0` drift the layer already had -- the author's original report,
  // "a solid sheet of coloured plastic shifting hues across its ribs". A
  // colour that varied along the chord but not in time is a static rainbow
  // painted on the wire. Advection is BOTH, and only both.
  //
  // CATCHES: binding the tint to k, to u, or to t alone.
  it('changes at a fixed point over time AND along the chord at a fixed time', () => {
    const overTime = [20, 40, 60, 80, 100].map(t => colourAt(0.5, 0, t, dur, HUE));
    expect(spread(overTime)).toBeGreaterThan(0.05);

    const alongChord = [0.3, 0.4, 0.5, 0.6, 0.7].map(u => colourAt(u, 0, 60, dur, HUE));
    expect(spread(alongChord)).toBeGreaterThan(0.05);
  });

  // THE FALSIFIER FOR THE TEST ABOVE. If the tint were on something other than
  // the wave, a chord the wave has already left would vary too, and the two
  // assertions above would pass on something that was never advecting at all.
  it('is EXACTLY the resting colour along a chord the wave has left', () => {
    // FLAT IS NOT ENOUGH, and a mutation proved it: a blend that ignored the
    // amplitude entirely still comes out flat once the phase clamps, just the
    // wrong colour everywhere. So this asserts the VALUE, not the variance.
    const base = restingColour(HUE);
    for (const u of [0.3, 0.4, 0.5, 0.6, 0.7]) {
      const c = colourAt(u, 0, dur * 3, dur, HUE);
      expect(c[0]).toBe(base[0]);
      expect(c[1]).toBe(base[1]);
      expect(c[2]).toBe(base[2]);
    }
  });

  // The same contract prismWaveMix keeps for alpha, and for the same reason:
  // once the pass is over the layer must draw precisely the colour the author
  // signed off, not a colour that converges on it.
  //
  // CATCHES: a tint that decays asymptotically -- the toBeCloseTo asymptote
  // trap this project has paid for three times.
  it('is EXACTLY the resting colour at zero weight', () => {
    const base = restingColour(HUE);
    const out = new Float32Array(3);
    prismChromaBlend(out, 0, base, tintAnchors(HUE), 0, 3, 0, 0.7);
    expect(out[0]).toBe(base[0]);
    expect(out[1]).toBe(base[1]);
    expect(out[2]).toBe(base[2]);
  });

  // CATCHES: a symmetric tint. Without this the front wears the same colour
  // coming and going, which is a throb rather than a direction.
  it('tints the leading edge differently from the wake', () => {
    expect(prismTintHue(HUE, 1)).not.toBe(prismTintHue(HUE, -1));
    const base = restingColour(HUE), tints = tintAnchors(HUE);
    const lead = new Float32Array(3), wake = new Float32Array(3);
    prismChromaBlend(lead, 0, base, tints, 0, 3, 1, 1);
    prismChromaBlend(wake, 0, base, tints, 0, 3, 1, -1);
    expect(spread([lead, wake])).toBeGreaterThan(0.02);
  });

  it('writes at the offset it is given and touches nothing else', () => {
    const out = new Float32Array(9).fill(-1);
    prismChromaBlend(out, 3, restingColour(HUE), tintAnchors(HUE), 0, 3, 1, 0);
    expect(out[2]).toBe(-1);
    expect(out[6]).toBe(-1);
    expect(out[3]).not.toBe(-1);
  });
});

describe('the tint bound - and the reading it exists to prevent', () => {
  // THE FAILURE MODE THIS WHOLE LINE OF WORK BEGAN WITH. The author's first
  // report on the prism was that it "jumps erratically between wire indices":
  // hues sliding sideways through a static brightness ladder. Spectral lines
  // sit PRISM_HUE_STEP apart, so a crest allowed to rotate a full step would
  // wear the neighbouring strand's resting colour and rebuild that reading out
  // of the fix for it.
  //
  // CATCHES: PRISM_HUE_LEAD or PRISM_HUE_SKEW raised to chase a more obvious
  // colour surge. Asserted against PRISM_HUE_STEP, never a literal, so it
  // still holds if the spectral spacing itself is ever retuned.
  it('keeps the largest excursion well inside one spectral step', () => {
    expect(PRISM_HUE_LEAD + PRISM_HUE_SKEW).toBeLessThan(0.75 * PRISM_HUE_STEP);
    expect(PRISM_HUE_LEAD - PRISM_HUE_SKEW).toBeGreaterThan(0);
  });

  // The falsifier: a bound satisfied by a rotation of zero would be no bound
  // at all, and the colour would not move.
  it('is nonetheless a real rotation', () => {
    expect(PRISM_HUE_LEAD).toBeGreaterThan(10);
    expect(PRISM_HUE_SKEW).toBeGreaterThan(0);
  });
});

describe('packet width and shear are parameters, and default to the shipped values', () => {
  // CATCHES: the new `w` parameter accepted but ignored (the body still reads
  // PRISM_WAVE_W). A narrower pulse must be exactly 0 where the shipped one is
  // still lit.
  it('narrows the support to the width it is given', () => {
    const w = PRISM_WAVE_W / 2;
    expect(prismPulse(w, w)).toBeCloseTo(0, 12);
    expect(prismPulse(w * 1.001, w)).toBe(0);
    expect(prismPulse(w * 1.001)).toBeGreaterThan(0.4);      // shipped width, still lit
    expect(prismPulse(w / 2, w)).toBeCloseTo(0.5, 12);        // half-way down the cosine
  });

  // CATCHES: the default drifting off the shipped constant. Arm 0 must be
  // bit-identical, so this is toBe, not toBeCloseTo.
  it('is bit-identical to the shipped call when no width or step is passed', () => {
    for (let i = -40; i <= 40; i++) {
      const x = i / 100;
      expect(prismPulse(x)).toBe(prismPulse(x, PRISM_WAVE_W));
      expect(prismChromaSkew(x)).toBe(prismChromaSkew(x, PRISM_WAVE_W));
    }
    for (let k = 0; k < PRISM_SPECTRAL_FINE; k++) {
      expect(prismPhaseOffset(k)).toBe(prismPhaseOffset(k, PRISM_PHASE_STEP));
      for (const u of [0, 0.3, 0.7, 1]) {
        expect(prismWavePhase(u, k, 40, 103)).toBe(prismWavePhase(u, k, 40, 103, PRISM_PHASE_STEP));
        expect(prismWaveAmp(u, k, 40, 103))
          .toBe(prismWaveAmp(u, k, 40, 103, PRISM_WAVE_W, PRISM_PHASE_STEP));
      }
    }
  });

  // CATCHES: `step` accepted by prismPhaseOffset but not threaded through
  // prismWavePhase / prismWaveAmp.
  it('threads the shear step through the phase and the amplitude', () => {
    const half = PRISM_PHASE_STEP / 2;
    expect(prismPhaseOffset(6, half)).toBeCloseTo(6 * half, 12);
    // At u = 0 the shear term is phi_k * 1, so the phase differs by exactly
    // the offset difference.
    expect(prismWavePhase(0, 6, 0, 100) - prismWavePhase(0, 6, 0, 100, half))
      .toBeCloseTo(6 * (PRISM_PHASE_STEP - half), 12);
    expect(prismWaveAmp(0, 6, 0, 100, PRISM_WAVE_W, half))
      .not.toBeCloseTo(prismWaveAmp(0, 6, 0, 100), 6);
  });

  // CATCHES: prismChromaSkew still normalising by PRISM_WAVE_W, which would
  // saturate the tint at half the pulse and read as a hard colour edge.
  it('normalises the colour skew by the width it is given', () => {
    const w = PRISM_WAVE_W / 2;
    expect(prismChromaSkew(w, w)).toBeCloseTo(1, 12);
    expect(prismChromaSkew(w / 2, w)).toBeCloseTo(0.5, 12);
  });
});

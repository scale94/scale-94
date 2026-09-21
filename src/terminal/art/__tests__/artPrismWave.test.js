// artPrismWave.test.js — the longitudinal wavefront on the prism bundle.
//
// The layer had no time term at all: every point's alpha was
// `lAlpha * cue(tt) * taper`, so a chord lit from root to tip simultaneously
// and the only motion in the whole layer was a hue sliding SIDEWAYS through a
// static brightness ladder. This file pins the travelling term that replaces
// that reading.
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
  PRISM_TRAIN_PULSES, PRISM_TRAIN_DECAY, PRISM_TRAIN_TAIL_MS,
  PRISM_WAVE_SEG_FULL, PRISM_WAVE_SEG_NONE, PRISM_WAVE_SEGMENTS,
  PRISM_SPECTRAL_FINE,
  prismPulse, prismPhaseOffset, prismWaveAmp, prismTrainEnv, prismWaveMix,
  prismSegmentFade, prismWaveDuration, prismChordDir,
} from '../artEdges';
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

  // CATCHES: a pulse wide enough to overlap its own neighbour in the train.
  // The train spaces pulses ONE unit of phase apart, so support must be < 1.
  it('is narrower than the train spacing, so pulses cannot merge', () => {
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

  // CATCHES: a phase step large enough that the last strand's pulse collides
  // with the FIRST strand's next pulse in the train, which spaces them one
  // unit apart. The diagonal would wrap and read as the lateral hopping this
  // whole feature exists to remove.
  it('shears the whole bundle by less than one train spacing', () => {
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

  // CATCHES: a train whose later pulses are as bright as the first, which
  // would read as a loop rather than a charge arriving and ringing.
  it('launches a decaying train — each pulse peaks below the one before', () => {
    // MEASURED AT THE ORIGIN, at the instant each pulse launches. An earlier
    // version of this test took the max over the WHOLE chord at t = n*dur,
    // which is dominated by pulse n-1 ARRIVING at the far end at full
    // amplitude — so it compared the wrong two pulses and would have passed a
    // train that never decayed at all.
    const launch = (n) => prismWaveAmp(0, 0, n * 120, 120);
    const p0 = launch(0), p1 = launch(1), p2 = launch(2);
    expect(p1).toBeLessThan(p0);
    expect(p2).toBeLessThan(p1);
    expect(p1 / p0).toBeCloseTo(PRISM_TRAIN_DECAY, 2);
  });
});

describe('prismTrainEnv — and the guarantee that the sustained burn is untouched', () => {
  // THE MOST IMPORTANT TEST IN THIS FILE.
  //
  // The author signed off the sustained glow by eye BEFORE this feature
  // existed. The design's whole safety argument is that once the train has
  // passed, the alpha expression collapses to exactly what it was. Not
  // approximately -- exactly, so no capture, no ink measurement and no eye can
  // find a difference in the state he approved.
  //
  // CATCHES: an envelope that decays asymptotically instead of reaching zero,
  // which is precisely the `toBeCloseTo(1, 6)` asymptote trap that has bitten
  // this project three times. toBe, not toBeCloseTo, on purpose.
  it('reaches EXACTLY zero after the train, so the mix is EXACTLY 1', () => {
    const dur = 120;
    const after = PRISM_TRAIN_PULSES * dur + PRISM_TRAIN_TAIL_MS;
    expect(prismTrainEnv(after, dur)).toBe(0);
    expect(prismTrainEnv(after + 1, dur)).toBe(0);
    expect(prismTrainEnv(9999, dur)).toBe(0);
    // And therefore the alpha multiplier is the identity.
    expect(prismWaveMix(0, prismTrainEnv(after, dur), 1)).toBe(1);
    expect(prismWaveMix(0.5, prismTrainEnv(9999, dur), 1)).toBe(1);
  });

  // CATCHES: a chord that starts waving before its origin node has lit. The
  // cascade hands negative t to chords whose origin is still dark.
  it('is zero before the origin node lights, so an unlit chord stays uniform', () => {
    expect(prismTrainEnv(-1, 120)).toBe(0);
    expect(prismTrainEnv(-200, 120)).toBe(0);
    expect(prismWaveMix(0, prismTrainEnv(-50, 120), 1)).toBe(1);
  });

  it('holds at full strength while the pulses are still in flight', () => {
    const dur = 120;
    expect(prismTrainEnv(0, dur)).toBe(1);
    expect(prismTrainEnv(dur, dur)).toBe(1);
    expect(prismTrainEnv(PRISM_TRAIN_PULSES * dur - 1, dur)).toBe(1);
  });

  it('decays monotonically through the tail with no step at either end', () => {
    const dur = 120;
    const t0 = PRISM_TRAIN_PULSES * dur;
    let prev = prismTrainEnv(t0, dur);
    for (let t = t0; t <= t0 + PRISM_TRAIN_TAIL_MS; t += 5) {
      const e = prismTrainEnv(t, dur);
      expect(e).toBeLessThanOrEqual(prev + 1e-12);
      prev = e;
    }
    // Smooth at the join: a kink here reads as a visible flick.
    const eps = 0.5;
    const slopeIn = (prismTrainEnv(t0, dur) - prismTrainEnv(t0 - eps, dur)) / eps;
    const slopeOut = (prismTrainEnv(t0 + eps, dur) - prismTrainEnv(t0, dur)) / eps;
    expect(Math.abs(slopeIn)).toBeLessThan(1e-6);
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

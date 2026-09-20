import { describe, it, expect } from 'vitest';
import {
  createFrameClock, stepFrameClock, resetFrameClock,
  createRateGate, stepRateGate, resetRateGate, perFrameChance,
  GATE_FRAME_MS, GATE_DT_CLAMP_MS, GATE_EPSILON_FRAMES,
} from '../artRateGate.js';

// ── Emission cadence is stepped on the CLOCK, not on a frame count ───────────
//
// `if (pFrame % 8 === 0)` is not a rate: it is "every eighth DRAW", so it runs
// at 2x on a 120Hz phone and 6x on a 360Hz QD-OLED. That is the /SCENT collider
// defect, which this repo has now paid for three times — the collider, the
// strimer's standing comment, and the sphere's breath.
//
// A modulus gate is also not a rate in a second sense a naive fix misses: it is
// a THRESHOLD, and a threshold crossed by a fractional step has to carry its
// remainder forward or it rounds down to nothing. At 360Hz a frame is a sixth
// of an authored frame; a gate that floors each frame never fires at all.
//
// The contract frozen here:
//   1. the same wall-clock window fires the same number of times at any rate;
//   2. at exactly 60fps the gate fires on exactly the frames the modulus did,
//      so today's look is preserved by construction;
//   3. fractional frames CARRY — nothing is rounded away;
//   4. a stalled rAF cannot bank its absence into a burst;
//   5. the coprime 3/7 idle beat keeps its interference pattern.

describe('stepFrameClock — wall time in units of the authored 60fps frame', () => {
  it('bills an unseeded clock exactly one frame, not the gap back to mount', () => {
    // The app boots under REAL timing before the capture harness takes over, so
    // a first dt measured against a mount-time stamp is an arbitrary interval.
    // This is what __artHarnessReset depends on.
    const c = createFrameClock();
    expect(stepFrameClock(c, 12345678)).toBe(1);
  });

  it('bills one frame for a 60fps step and a sixth for a 360Hz step', () => {
    const c = createFrameClock();
    stepFrameClock(c, 0);
    expect(stepFrameClock(c, GATE_FRAME_MS)).toBeCloseTo(1, 12);

    const d = createFrameClock();
    stepFrameClock(d, 0);
    expect(stepFrameClock(d, 1000 / 360)).toBeCloseTo(1 / 6, 12);
  });

  it('clamps a stalled frame instead of banking the whole gap', () => {
    // A hidden tab parks rAF. Without the clamp the first frame back crosses
    // every threshold at once — something the frame counter could never do.
    const c = createFrameClock();
    stepFrameClock(c, 1000);
    expect(stepFrameClock(c, 1000 + 5000)).toBe(GATE_DT_CLAMP_MS / GATE_FRAME_MS);
  });

  it('floors a backwards clock at zero', () => {
    // The capture harness snaps performance.now() to a fixed VIRTUAL_START,
    // which can land BEHIND the real boot clock it replaces.
    const c = createFrameClock();
    stepFrameClock(c, 900000);
    expect(stepFrameClock(c, 100000)).toBe(0);
  });

  it('re-seeds on reset so the next step bills one frame again', () => {
    const c = createFrameClock();
    stepFrameClock(c, 1000);
    stepFrameClock(c, 1016);
    resetFrameClock(c);
    expect(stepFrameClock(c, 987654)).toBe(1);
  });

  it('uses the wall clock when no timestamp is injected', () => {
    const c = createFrameClock();
    stepFrameClock(c);
    expect(c.seeded).toBe(true);
    expect(c.t).toBeGreaterThan(0);
  });
});

/** Drives `gate` for `frames` steps of `dtMs` through a real frame clock,
 *  returning the frame indices (1-based) it fired on. */
function fireFrames(gate, frames, dtMs, startMs = 100000) {
  const clock = createFrameClock();
  const out = [];
  let t = startMs;
  for (let i = 1; i <= frames; i++) {
    t += dtMs;
    if (stepRateGate(gate, stepFrameClock(clock, t))) out.push(i);
  }
  return out;
}

describe('stepRateGate — a modulus gate, expressed as a rate', () => {
  const PERIODS = [3, 7, 8, 10, 12, 60];

  it('fires the same number of times per wall-second at 60, 120 and 360Hz', () => {
    // His hardware, literally: a 360Hz QD-OLED and a 120Hz phone. Under the
    // frame counter the 360Hz column reads 6x every row of this table.
    for (const p of PERIODS) {
      const at60  = fireFrames(createRateGate(p), 60,  GATE_FRAME_MS).length;
      const at120 = fireFrames(createRateGate(p), 120, 1000 / 120).length;
      const at360 = fireFrames(createRateGate(p), 360, 1000 / 360).length;
      expect(at60).toBe(Math.floor(60 / p));
      expect(at120).toBe(at60);
      expect(at360).toBe(at60);
    }
  });

  it('carries the fractional remainder rather than rounding it away', () => {
    // The trap in "just divide by the frame": at 360Hz a step is a sixth of an
    // authored frame, and a gate that floors each step fires NEVER. Ten authored
    // frames of a period-3 gate must still be three fires at any rate.
    for (const rate of [90, 144, 165, 240, 360, 500]) {
      const frames = Math.round(rate * 10 / 60);              // 10 authored frames
      const fires = fireFrames(createRateGate(3), frames, 1000 / rate).length;
      expect(fires).toBe(3);
    }
  });

  it('fires at most once in any single frame', () => {
    // Even a fully clamped stall (3 authored frames) may not fire a period-3
    // gate twice: two emissions at one position and one instant is a burst, not
    // a cadence. 20 stalled frames is 20 fires at most, never 20 x 3.
    //
    // It is 19, and the missing one is the SEEDING frame: an unseeded clock
    // bills exactly one authored frame whatever its timestamp says, so the
    // first of these 5-second stalls credits 1 and not 3. Worth asserting
    // exactly rather than as an inequality — it is the seeding rule and the
    // once-per-frame cap meeting, and a fix to either would move this number.
    expect(fireFrames(createRateGate(3), 20, 5000).length).toBe(19);
  });

  it('does not bank a stall into a catch-up burst', () => {
    const gate = createRateGate(60);
    const clock = createFrameClock();
    stepFrameClock(clock, 1000);
    // One 60-second absence. The clamp bills it 3 authored frames, not 3600.
    expect(stepRateGate(gate, stepFrameClock(clock, 61000))).toBe(false);
  });
});

describe('stepRateGate — 60fps is the frame counter it replaces, exactly', () => {
  const PERIODS = [3, 7, 8, 10, 12, 60];

  /** The capture harness's clock: `vnow += FRAME_MS` from VIRTUAL_START. It is
   *  ACCUMULATED, so it does not return differences of exactly FRAME_MS, and at
   *  a magnitude of 1e5 the residue is far coarser than an ulp of 1. */
  function* harnessClock(n) {
    let vnow = 100000;
    for (let i = 0; i < n; i++) { vnow += GATE_FRAME_MS; yield vnow; }
  }

  it('fires on exactly the frames `pFrame % period === 0` fired on', () => {
    for (const p of PERIODS) {
      const gate = createRateGate(p);
      const clock = createFrameClock();
      const got = [];
      let i = 0;
      for (const t of harnessClock(3000)) {
        i++;
        if (stepRateGate(gate, stepFrameClock(clock, t))) got.push(i);
      }
      const want = [];
      for (let k = 1; k <= 3000; k++) if (k % p === 0) want.push(k);
      expect(got).toEqual(want);
    }
  });

  it('a primed gate fires on its FIRST frame, as a counter read before ++ did', () => {
    // Two of the six sites read the counter BEFORE incrementing it, so their
    // first draw saw 0 and `0 % period === 0` fired. A gate that ignored this
    // would shift the whole genesis cascade one period late.
    for (const p of [10, 60]) {
      const gate = createRateGate(p, { primed: true });
      const clock = createFrameClock();
      const got = [];
      let i = 0;
      for (const t of harnessClock(600)) {
        i++;
        if (stepRateGate(gate, stepFrameClock(clock, t))) got.push(i);
      }
      const want = [];
      for (let k = 0; k < 600; k++) if (k % p === 0) want.push(k + 1);
      expect(got).toEqual(want);
    }
  });

  it('holds the 3/7 idle beat, which coincides every 21 authored frames', () => {
    // Two coprime emitters is an authored texture, not an accident: they double
    // up once every 21 frames. The interference has to survive the conversion at
    // every refresh rate, or the idle drift loses its pulse.
    for (const rate of [60, 120, 360]) {
      const g3 = createRateGate(3), g7 = createRateGate(7);
      const clock = createFrameClock();
      let t = 100000, both = 0, n3 = 0;
      const frames = Math.round(rate * 21 * 4 / 60);          // 84 authored frames
      for (let i = 0; i < frames; i++) {
        t += 1000 / rate;
        const dt = stepFrameClock(clock, t);
        const a = stepRateGate(g3, dt), b = stepRateGate(g7, dt);
        if (a) n3++;
        if (a && b) both++;
      }
      expect(n3).toBe(28);      // 84 / 3
      expect(both).toBe(4);     // 84 / 21
    }
  });

  it('keeps the epsilon far below any real frame and above the clock residue', () => {
    // MEASURED, and the reason this constant exists at all: replaying the
    // harness's `vnow += FRAME_MS` for 5000 frames leaves the accumulator
    // 1.4e-9 frames short of the integer, and 3.6e-7 short by 500k frames.
    // Without a tolerance every gate lands a hair under its threshold around
    // frame 2800 and slips one frame, permanently. 1e-6 frames is 17
    // NANOSECONDS of display time — no panel can express it — while sitting
    // three orders above the residue a capture can accumulate.
    expect(GATE_EPSILON_FRAMES).toBeGreaterThan(1e-8);
    expect(GATE_EPSILON_FRAMES).toBeLessThan(1e-4);
  });

  it('scales a per-frame COIN FLIP into a rate, exactly at dt = 1', () => {
    // Not every rate-dependent emitter has a modulus to convert. The node-burst
    // emitter is a per-draw Bernoulli trial — `artRandom() < 0.15`, every frame,
    // no gate at all — so "every draw" IS its period and it fired 4.5x too often
    // at 270fps. A gate cannot express it: a period-1 gate would have to fire
    // more than once in a clamped frame, which is the one thing stepRateGate
    // deliberately refuses to do, and its accumulator's bound assumes period >= 3.
    //
    // The conversion is the PROBABILITY, not the schedule. LINEAR and not
    // 1-(1-p)^dt: since at most one trial happens per frame, what has to be
    // preserved is the EXPECTED COUNT per wall second, and p*dt preserves it
    // exactly where the "at least one event" form over-counts ~8% at high
    // refresh. It is also exact at dt = 1, where the exponential form is not.
    expect(perFrameChance(0.15, 1)).toBe(0.15);
    expect(perFrameChance(0.15, 1 / 6)).toBeCloseTo(0.025, 12);

    // The expected count over one authored second is 60 * p at every rate.
    for (const rate of [60, 120, 165, 360, 875]) {
      const dt = 60 / rate;
      const expected = rate * perFrameChance(0.15, dt);
      expect(expected).toBeCloseTo(60 * 0.15, 9);
    }
  });

  it('never returns a probability above 1 or below 0', () => {
    // A fully clamped stall is 3 authored frames, so 0.15 stays far from the
    // ceiling — but the clamp is written rather than inferred, because the
    // caller's literal is a free parameter and 0.4 * 3 is not.
    expect(perFrameChance(0.4, 3)).toBe(1);
    expect(perFrameChance(0.15, 0)).toBe(0);
    expect(perFrameChance(0.15, -1)).toBe(0);
  });

  it('restores its constructed phase on reset', () => {
    // __artHarnessReset zeroes everything that ACCRUES. An accumulator that
    // survived the reset would carry the real-timing boot into the capture —
    // the same leak the frame counter was reset for.
    const gate = createRateGate(8);
    fireFrames(gate, 5, GATE_FRAME_MS);
    resetRateGate(gate);
    expect(fireFrames(gate, 16, GATE_FRAME_MS)).toEqual([8, 16]);

    const primed = createRateGate(10, { primed: true });
    fireFrames(primed, 7, GATE_FRAME_MS);
    resetRateGate(primed);
    expect(fireFrames(primed, 21, GATE_FRAME_MS)).toEqual([1, 11, 21]);
  });
});

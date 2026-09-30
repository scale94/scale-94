import { describe, it, expect } from 'vitest';
import { createStepClock } from '../../../../ledger/ocean/clock';
import {
  createOceanDriver, REDUCED_MOTION_DAYS, WARMUP_STEPS_PER_FRAME, LOAD_FRAME_MS,
  STEP_CAP, STEP_CAP_LOADED,
} from '../oceanDriver';
import { advanceParcelPhase } from '../../../../ledger/ocean/riverStage';
import { DT_DAYS } from '../../../../ledger/ocean/grid';

const counting = () => {
  let n = 0;
  return { step: () => { n++; }, count: () => n };
};

describe('createOceanDriver', () => {
  it('turns wall seconds into clock steps and counts simulated days', () => {
    const s = counting();
    const d = createOceanDriver({ clock: createStepClock(), step: s.step });
    let total = 0;
    for (let f = 0; f < 60; f++) total += d.advance(1 / 60, 9);
    expect(total).toBe(36);
    expect(s.count()).toBe(36);
    expect(d.simDays()).toBeCloseTo(9, 9);
  });

  it('spreads the reduced-motion warm-up over frames, a fixed number of steps each', () => {
    const s = counting();
    const d = createOceanDriver({ clock: createStepClock(), step: s.step });
    let calls = 0;
    let done = false;
    while (!done) {
      const before = s.count();
      done = d.warmupChunk(REDUCED_MOTION_DAYS);
      expect(s.count() - before).toBeLessThanOrEqual(WARMUP_STEPS_PER_FRAME);
      calls++;
      expect(calls).toBeLessThan(1000);
    }
    expect(s.count()).toBe(800);
    expect(calls).toBe(Math.ceil(800 / WARMUP_STEPS_PER_FRAME));
    expect(d.simDays()).toBeCloseTo(200, 9);
    expect(d.warmupChunk(REDUCED_MOTION_DAYS)).toBe(true);
    expect(s.count()).toBe(800);
  });

  it('runs a full second warm-up after resetWarmup', () => {
    const s = counting();
    const d = createOceanDriver({ clock: createStepClock(), step: s.step });
    while (!d.warmupChunk(REDUCED_MOTION_DAYS));
    d.resetWarmup();
    expect(d.warmupChunk(REDUCED_MOTION_DAYS)).toBe(false);
    while (!d.warmupChunk(REDUCED_MOTION_DAYS));
    expect(s.count()).toBe(1600);
    expect(d.simDays()).toBeCloseTo(400, 9);
  });

  it(`drops the step cap to ${STEP_CAP_LOADED} while the rolling frame time exceeds ${LOAD_FRAME_MS} ms, and restores ${STEP_CAP}`, () => {
    const s = counting();
    const d = createOceanDriver({ clock: createStepClock(), step: s.step });
    for (let f = 0; f < 60; f++) d.advance(0.05, 30);   // 50 ms frames owe 6 steps each
    expect(d.frameMs()).toBeGreaterThan(LOAD_FRAME_MS);
    expect(d.advance(0.05, 30)).toBe(STEP_CAP_LOADED);
    for (let f = 0; f < 120; f++) d.advance(0.016, 200); // 16 ms frames owe 12.8 steps each
    expect(d.frameMs()).toBeLessThan(LOAD_FRAME_MS);
    expect(d.advance(0.016, 200)).toBe(STEP_CAP);
  });

  it('reports a rolling frame time of 0 before any frame and ignores dt = 0', () => {
    const d = createOceanDriver({ clock: createStepClock(), step: () => {} });
    expect(d.frameMs()).toBe(0);
    d.advance(0, 9);
    expect(d.frameMs()).toBe(0);
    d.advance(0.016, 9);
    expect(d.frameMs()).toBeCloseTo(16, 9);
  });

  it('leaves the rolling frame time untouched by non-positive or non-finite dt', () => {
    const d = createOceanDriver({ clock: createStepClock(), step: () => {} });
    d.advance(0.016, 9);
    for (const bad of [-0.05, Number.NaN, Number.POSITIVE_INFINITY]) {
      d.advance(bad, 9);
      expect(d.frameMs()).toBeCloseTo(16, 9);
    }
  });
});

describe('display time (smooth parcels)', () => {
  it('interpolates between steps on the wall-time remainder: alpha 0.5 → half a step', () => {
    const d = createOceanDriver({ clock: createStepClock(), step: () => {} });
    d.advance(DT_DAYS / 2 / 9, 9);                 // owes half a step: no step yet
    expect(d.simDays()).toBe(0);
    expect(d.displayDays()).toBeCloseTo(DT_DAYS / 2, 12);
    d.advance(DT_DAYS / 2 / 9, 9);                 // completes the step
    expect(d.simDays()).toBeCloseTo(DT_DAYS, 12);
    expect(d.displayDays()).toBeCloseTo(DT_DAYS, 9);
  });

  it('gives the same parcel phase at the same wall time for 60 Hz and 360 Hz frames', () => {
    const run = (hz) => {
      const d = createOceanDriver({ clock: createStepClock(), step: () => {} });
      let phase = 0;
      let last = 0;
      const out = [];
      let mid = null;
      for (let f = 1; f <= hz; f++) {                // one wall second
        d.advance(1 / hz, 9);
        const disp = d.displayDays();
        phase = advanceParcelPhase(phase, disp - last, 1.6, 9);
        last = disp;
        if (f % (hz / 4) === 0) out.push(phase);    // at 250, 500, 750, 1000 ms
        if (f === hz / 5) mid = { phase, disp };    // 200 ms: 1.8 d = 7.2 steps, between steps
      }
      return { last, out, mid };
    };
    const a = run(60);
    const b = run(360);
    expect(a.last).toBeCloseTo(9, 9);
    expect(b.last).toBeCloseTo(9, 9);
    for (let i = 0; i < 4; i++) expect(b.out[i]).toBeCloseTo(a.out[i], 9);
    expect(a.out[3]).toBeCloseTo((9 / (6 * 9)) % 1, 9);   // slowed: one course per 6 s
    // A checkpoint that is NOT on a step boundary: only interpolation gets it right.
    expect(a.mid.disp).toBeCloseTo(1.8, 9);
    expect(b.mid.disp).toBeCloseTo(1.8, 9);
    expect(a.mid.phase).toBeCloseTo(1.8 / 54, 9);
    expect(b.mid.phase).toBeCloseTo(a.mid.phase, 9);
  });
});

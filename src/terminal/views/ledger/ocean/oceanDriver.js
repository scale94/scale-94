// oceanDriver.js — turns frame time into ocean steps. Wall time only (via the
// step clock), never frame counts. Reduced motion runs a warm-up spread over
// frames (a fixed number of steps per frame, the same 800-step total at any
// frame rate) so the held frame shows a settled ocean without one long
// main-thread block. Under load — rolling frame interval above 20 ms — the
// per-frame step cap drops from 8 to 4 (spec §2 Clock, §4 Mobile).

import { DT_DAYS } from '../../../ledger/ocean/grid';

export const REDUCED_MOTION_DAYS = 200;
export const WARMUP_STEPS_PER_FRAME = 16;
export const STEP_CAP = 8;
export const STEP_CAP_LOADED = 4;
export const LOAD_FRAME_MS = 20;
export const FRAME_TAU_S = 0.5;

export function createOceanDriver({ clock, step, dtDays = DT_DAYS }) {
  let days = 0;
  let warmed = false;
  let warmSteps = 0;
  let frameMs = 0;
  const run = (n) => {
    for (let s = 0; s < n; s++) step();
    days += n * dtDays;
    return n;
  };
  return {
    advance(dtSec, daysPerSecond) {
      if (dtSec > 0 && Number.isFinite(dtSec)) {
        const ms = dtSec * 1000;
        frameMs = frameMs === 0 ? ms : frameMs + (1 - Math.exp(-dtSec / FRAME_TAU_S)) * (ms - frameMs);
        clock.setMaxSteps(frameMs > LOAD_FRAME_MS ? STEP_CAP_LOADED : STEP_CAP);
      }
      return run(clock.advance(dtSec * 1000, daysPerSecond));
    },
    // Phase-2 API; LedgerOcean stops using it in phase 3a Task 3, which deletes it.
    warmupOnce(targetDays) {
      if (warmed) return 0;
      warmed = true;
      return run(Math.round(targetDays / dtDays));
    },
    warmupChunk(targetDays, perFrame = WARMUP_STEPS_PER_FRAME) {
      const total = Math.round(targetDays / dtDays);
      const n = Math.max(0, Math.min(perFrame, total - warmSteps));
      run(n);
      warmSteps += n;
      return warmSteps >= total;
    },
    resetWarmup() {
      warmSteps = 0;
    },
    simDays() {
      return days;
    },
    frameMs() {
      return frameMs;
    },
  };
}

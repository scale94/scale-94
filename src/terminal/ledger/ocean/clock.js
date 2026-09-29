// clock.js — converts wall time into whole simulation steps.
// Simulated time accumulates from wall milliseconds × compression, never from
// frame counts, so 60 Hz and 360 Hz displays advance the ocean identically.
// When one frame owes more than maxSteps, the backlog is dropped: under load
// the ocean slows down rather than spiralling.

import { DT_DAYS } from './grid';

export function createStepClock({ dtDays = DT_DAYS, maxSteps = 8 } = {}) {
  let accDays = 0;
  let cap = maxSteps;
  return {
    advance(wallMs, daysPerSecond) {
      if (!(wallMs > 0) || !(daysPerSecond > 0) || !Number.isFinite(wallMs) || !Number.isFinite(daysPerSecond)) return 0;
      accDays += (wallMs / 1000) * daysPerSecond;
      const steps = Math.floor(accDays / dtDays + 1e-9);
      accDays = Math.max(0, accDays - steps * dtDays);
      if (steps > cap) {
        accDays = 0;
        return cap;
      }
      return steps;
    },
    setMaxSteps(m) {
      cap = m;
    },
    reset() {
      accDays = 0;
    },
  };
}

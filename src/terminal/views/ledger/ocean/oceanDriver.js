// oceanDriver.js — turns frame time into ocean steps. Wall time only (via the
// step clock), never frame counts. Reduced motion runs a one-off warm-up so
// the frozen frame shows a settled ocean, not an empty one.

import { DT_DAYS } from '../../../ledger/ocean/grid';

export const REDUCED_MOTION_DAYS = 200;

export function createOceanDriver({ clock, step, dtDays = DT_DAYS }) {
  let days = 0;
  let warmed = false;
  const run = (n) => {
    for (let s = 0; s < n; s++) step();
    days += n * dtDays;
    return n;
  };
  return {
    advance(dtSec, daysPerSecond) {
      return run(clock.advance(dtSec * 1000, daysPerSecond));
    },
    warmupOnce(targetDays) {
      if (warmed) return 0;
      warmed = true;
      return run(Math.round(targetDays / dtDays));
    },
    simDays() {
      return days;
    },
  };
}

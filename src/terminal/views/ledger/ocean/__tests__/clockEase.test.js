import { describe, it, expect } from 'vitest';
import { createStepClock } from '../../../../ledger/ocean/clock';
import { DT_DAYS } from '../../../../ledger/ocean/grid';
import { createOceanDriver } from '../oceanDriver';
import { createClockEase, SEAL_EASE_MS, HOLD_FACTOR } from '../clockEase';

const riemann = (ease, a, b, n = 200000) => {
  let s = 0;
  const h = (b - a) / n;
  for (let i = 0; i < n; i++) s += ease.value(a + (i + 0.5) * h) * h;
  return s / (b - a);
};

describe('createClockEase', () => {
  it('eases from 1 to the hold factor over SEAL_EASE_MS (smoothstep) and stays there', () => {
    const e = createClockEase();
    expect(e.value(0)).toBe(1);
    expect(e.meanFactor(0, 100)).toBe(1);
    e.hold(true, 1000);
    expect(e.held()).toBe(true);
    expect(e.value(1000)).toBeCloseTo(1, 12);
    expect(e.value(1000 + SEAL_EASE_MS / 2)).toBeCloseTo((1 + HOLD_FACTOR) / 2, 12);
    expect(e.value(1000 + SEAL_EASE_MS)).toBeCloseTo(HOLD_FACTOR, 12);
    expect(e.value(9000)).toBeCloseTo(HOLD_FACTOR, 12);
    expect(e.value(900)).toBe(1);
  });

  it('integrates the factor exactly over any interval, including across the ease ends', () => {
    const e = createClockEase();
    e.hold(true, 1000);
    for (const [a, b] of [[900, 1100], [1100, 1400], [1500, 1700], [950, 2000], [1600, 1601]]) {
      expect(e.meanFactor(a, b)).toBeCloseTo(riemann(e, a, b), 7);
    }
  });

  it('releases from wherever it is, continuously, and ignores a repeated hold', () => {
    const e = createClockEase();
    e.hold(true, 0);
    e.hold(true, 200);                          // no restart
    expect(e.value(300)).toBeCloseTo((1 + HOLD_FACTOR) / 2, 12);
    e.hold(false, 300);
    expect(e.held()).toBe(false);
    expect(e.value(300)).toBeCloseTo((1 + HOLD_FACTOR) / 2, 12);
    expect(e.value(300 + SEAL_EASE_MS)).toBeCloseTo(1, 12);
  });

  it('advances the same simulated time at 60 Hz and 360 Hz (nothing frame-counted)', () => {
    const run = (hz) => {
      const e = createClockEase();
      let steps = 0;
      const d = createOceanDriver({ clock: createStepClock(), step: () => { steps++; } });
      let dayWeight = 0;
      const frameMs = 1000 / hz;
      for (let f = 1; f <= 3 * hz; f++) {
        const now = f * frameMs;
        if (!e.held() && now > 500 && now - frameMs < 1700) e.hold(true, 500);
        if (e.held() && now > 1700) e.hold(false, 1700);
        const m = e.meanFactor(now - frameMs, now);
        dayWeight += (frameMs / 1000) * 9 * m;
        d.advance(frameMs / 1000, 9 * m);
      }
      return { steps, dayWeight };
    };
    // ∫ factor dt over 3 s = 0.5 + 0.306 + 0.012 + 0.306 + 0.7 = 1.824 s → 16.416 d at 9 d/s.
    const a = run(60);
    const b = run(360);
    expect(a.dayWeight).toBeCloseTo(16.416, 9);
    expect(b.dayWeight).toBeCloseTo(16.416, 9);
    expect(a.steps).toBe(Math.floor(16.416 / DT_DAYS));
    expect(b.steps).toBe(a.steps);
  });
});

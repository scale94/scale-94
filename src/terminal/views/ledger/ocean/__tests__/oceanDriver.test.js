import { describe, it, expect } from 'vitest';
import { createStepClock } from '../../../../ledger/ocean/clock';
import { createOceanDriver, REDUCED_MOTION_DAYS } from '../oceanDriver';

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

  it('warms up once for reduced motion', () => {
    const s = counting();
    const d = createOceanDriver({ clock: createStepClock(), step: s.step });
    expect(d.warmupOnce(REDUCED_MOTION_DAYS)).toBe(800);
    expect(d.warmupOnce(REDUCED_MOTION_DAYS)).toBe(0);
    expect(s.count()).toBe(800);
    expect(d.simDays()).toBeCloseTo(200, 9);
  });
});

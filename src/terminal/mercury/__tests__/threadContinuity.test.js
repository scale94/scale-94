import { describe, it, expect } from 'vitest';
import { threadTargetOpacity, easeThread, threadPhase, THREAD_PEAK, THREAD_REST } from '../threadMath';

const DT = 1 / 60;
const settle = (o, target, frames) => { for (let i = 0; i < frames; i++) o = easeThread(o, target, DT); return o; };

describe('thread continuity', () => {
  it('targets peak while spinning up, rest otherwise, 0 when released', () => {
    expect(threadTargetOpacity(1, 'spinUp')).toBeCloseTo(THREAD_PEAK, 10);
    expect(threadTargetOpacity(1, 'idle')).toBeCloseTo(THREAD_PEAK * THREAD_REST, 10);
    expect(threadTargetOpacity(0, 'fadeOut')).toBe(0);
  });
  it('keeps pointing at the last lit phase after release', () => {
    expect(threadPhase('earth', 'fluid')).toBe('earth');
    expect(threadPhase(null, 'earth')).toBe('earth');
    expect(threadPhase(null, null)).toBe(null);
  });
  it('decays smoothly from the resting level after a lit tap, no single-frame drop above 0.05', () => {
    let o = THREAD_PEAK * THREAD_REST; // 0.245
    const start = o;
    for (let i = 0; i < 120; i++) {
      const next = easeThread(o, 0, DT);
      expect(o - next).toBeLessThan(0.05);
      expect(next).toBeLessThanOrEqual(o);
      o = next;
    }
    expect(o).toBeLessThan(start * 0.05);
    expect(o).toBeGreaterThan(0);
  });
  it('eases the spinUp -> rest drop instead of stepping', () => {
    let o = THREAD_PEAK;
    const rest = threadTargetOpacity(1, 'idle');
    const first = easeThread(o, rest, DT);
    expect(o - first).toBeLessThan(0.05);
    expect(first).toBeGreaterThan(rest);
    expect(settle(o, rest, 180)).toBeCloseTo(rest, 3);
  });
});

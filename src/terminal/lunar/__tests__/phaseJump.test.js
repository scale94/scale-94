import { describe, it, expect } from 'vitest';
import { SYNODIC_PERIOD, PHASES, getPhase } from '../synodic';
import {
  JUMP_DURATION_MS,
  shortestWrappedDelta,
  repAgeForPhase,
  wrapAge,
  easeInOutCubic,
} from '../phaseJump';

describe('shortestWrappedDelta', () => {
  it('goes forward when forward is shorter', () => {
    expect(shortestWrappedDelta(1, 4, 12)).toBeCloseTo(3, 10);
  });

  it('goes backward when backward is shorter', () => {
    expect(shortestWrappedDelta(4, 1, 12)).toBeCloseTo(-3, 10);
  });

  it('crosses the seam forward when that is shorter', () => {
    // 11 -> 1 on a 12 wheel: forward +2 through the seam, not backward -10.
    expect(shortestWrappedDelta(11, 1, 12)).toBeCloseTo(2, 10);
  });

  it('crosses the seam backward when that is shorter', () => {
    // 1 -> 11: backward -2 through the seam, not forward +10.
    expect(shortestWrappedDelta(1, 11, 12)).toBeCloseTo(-2, 10);
  });

  it('resolves an exact half-turn forward, never backward', () => {
    expect(shortestWrappedDelta(0, 6, 12)).toBeCloseTo(6, 10);
  });

  it('is zero when already there', () => {
    expect(shortestWrappedDelta(5, 5, 12)).toBe(0);
  });
});

describe('repAgeForPhase', () => {
  it('round-trips through getPhase for all eight phases', () => {
    for (const phase of PHASES) {
      const age = repAgeForPhase(phase.id);
      expect(getPhase(age).id).toBe(phase.id);
    }
  });

  it('puts full at the synodic midpoint and new at zero', () => {
    expect(repAgeForPhase('new')).toBe(0);
    expect(repAgeForPhase('full')).toBeCloseTo(SYNODIC_PERIOD / 2, 6);
  });

  it('falls back to 0 for an unknown phase id', () => {
    expect(repAgeForPhase('not-a-phase')).toBe(0);
  });
});

describe('wrapAge', () => {
  it('leaves in-range ages untouched', () => {
    expect(wrapAge(5, SYNODIC_PERIOD)).toBeCloseTo(5, 10);
  });
  it('wraps past the period', () => {
    expect(wrapAge(SYNODIC_PERIOD + 0.47, SYNODIC_PERIOD)).toBeCloseTo(0.47, 6);
  });
  it('wraps negatives into range', () => {
    expect(wrapAge(-1, SYNODIC_PERIOD)).toBeCloseTo(SYNODIC_PERIOD - 1, 6);
  });
});

describe('easeInOutCubic', () => {
  it('pins the endpoints', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
  });
  it('passes through 0.5 at the midpoint', () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10);
  });
  it('is symmetric about the midpoint', () => {
    // ease(0.5 + x) - 0.5 === 0.5 - ease(0.5 - x)
    for (const x of [0.1, 0.25, 0.4]) {
      expect(easeInOutCubic(0.5 + x) - 0.5).toBeCloseTo(0.5 - easeInOutCubic(0.5 - x), 10);
    }
  });
  it('is monotonic across a sweep', () => {
    let prev = -1;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const v = easeInOutCubic(Math.min(t, 1));
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('constants', () => {
  it('exposes the 800ms travel duration', () => {
    expect(JUMP_DURATION_MS).toBe(800);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({ shapes: [], quiet: [] }));
vi.mock('../../components/eyeDrive', () => ({ driveShape: (...a) => h.shapes.push(a) }));
vi.mock('../../quintessence/observerStore', () => ({ holdEyeQuiet: (on) => h.quiet.push(on) }));

import {
  phaseOfAge, phaseOfId, sweepAt, setLunarScrub, compileLunarEye, stopLunarEye, _lunarEyeState,
  SWEEP_S, HOLD_S, FADE_S, LUNAR_COMPILE_MS,
} from '../lunarEye';
import { SHAPE } from '../../components/observerEyeShader';
import { SYNODIC_PERIOD } from '../synodic';

const last = () => h.shapes.at(-1);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  h.shapes.length = 0; h.quiet.length = 0;
  stopLunarEye();
  h.quiet.length = 0;
});
afterEach(() => { stopLunarEye(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('lunarEye — phase maths', () => {
  it('maps synodic age and phase ids onto 0..1', () => {
    expect(phaseOfAge(0)).toBe(0);
    expect(phaseOfAge(SYNODIC_PERIOD / 2)).toBeCloseTo(0.5, 9);
    expect(phaseOfAge(SYNODIC_PERIOD * 1.25)).toBeCloseTo(0.25, 9);
    expect(phaseOfAge(NaN)).toBe(0);
    expect(phaseOfId('full')).toBeCloseTo(0.5, 1);
    expect(phaseOfId('first-quarter')).toBeCloseTo(0.25, 1);
    expect(phaseOfId('waning-crescent')).toBeGreaterThan(0.75);
    expect(phaseOfId('nope')).toBe(0);
  });

  it('a live-time sweep: new gathers, new -> full -> new -> the accord, held, let go', () => {
    const sw = { u0: 0, u1: 1.5, locked: false };
    expect(sweepAt(0, sw)).toMatchObject({ u: 0, k: 0, done: false });
    expect(sweepAt(0.4, sw).k).toBeCloseTo(1, 6);
    let prev = -1, sawFull = false, sawNew = false;
    for (let t = 0; t <= SWEEP_S; t += 0.02) {               // forward only, organic (eased) travel
      const { u } = sweepAt(t, sw);
      expect(u).toBeGreaterThanOrEqual(prev);
      prev = u;
      if (Math.abs(u - 0.5) < 0.02) sawFull = true;
      if (Math.abs(u - 1) < 0.02) sawNew = true;
    }
    expect(sawFull && sawNew).toBe(true);
    expect(sweepAt(SWEEP_S + HOLD_S * 0.5, sw)).toMatchObject({ u: 1.5, k: 1 });   // the compiled phase, held
    expect(sweepAt(SWEEP_S + HOLD_S + FADE_S, sw)).toMatchObject({ k: 0, done: true });
    expect(LUNAR_COMPILE_MS).toBe(Math.round((SWEEP_S + HOLD_S + FADE_S) * 1000));
  });

  it('a virtual-time sweep goes once round and lands back on the scrubbed phase', () => {
    const sw = { u0: 0.12, u1: 1.12, locked: true };
    expect(sweepAt(0, sw)).toMatchObject({ u: 0.12, k: 1 });
    expect(sweepAt(SWEEP_S, sw)).toMatchObject({ u: 1.12, k: 1, done: true });
    expect(sweepAt(SWEEP_S * 0.5, sw).k).toBe(1);             // the moon never lets go mid-sweep
  });
});

describe('lunarEye — the drive', () => {
  it('scrubbing drives the moon live and holds the eye quiet; return to now lets go', () => {
    setLunarScrub(7.4);
    expect(last()).toEqual([SHAPE.moon, 1, phaseOfAge(7.4)]);
    expect(h.quiet).toEqual([true]);
    setLunarScrub(22.1);
    vi.advanceTimersByTime(20);
    expect(last()).toEqual([SHAPE.moon, 1, phaseOfAge(22.1)]);
    setLunarScrub(null);
    const n = h.shapes.length;
    vi.advanceTimersByTime(200);
    expect(h.shapes.length).toBe(n);                          // nothing writes: the drive lapses to silver
    expect(h.quiet).toEqual([true, false]);
    expect(_lunarEyeState().running).toBe(false);
  });

  it('keeps writing inside the hold even if rAF is throttled (watchdog)', () => {
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    setLunarScrub(3);
    const n = h.shapes.length;
    vi.advanceTimersByTime(250);
    expect(h.shapes.length).toBeGreaterThan(n);
  });

  it('compile in live time sweeps to the accord phase, then stops and lifts the quiet hold', () => {
    compileLunarEye('full');
    expect(h.quiet).toEqual([true]);
    expect(last()[0]).toBe(SHAPE.moon);
    expect(last()[1]).toBe(0);                                 // the new moon gathers over silver
    vi.advanceTimersByTime(SWEEP_S * 1000 + 300);
    expect(last()[2]).toBeCloseTo(1 + phaseOfId('full'), 6);
    expect(last()[1]).toBe(1);
    vi.advanceTimersByTime((HOLD_S + FADE_S) * 1000 + 200);
    expect(_lunarEyeState().running).toBe(false);
    expect(h.quiet).toEqual([true, false]);
  });

  it('compile in virtual time returns onto the scrubbed phase, then the scrub holds', () => {
    setLunarScrub(3.7);
    compileLunarEye('full');
    const s = _lunarEyeState().sweep;
    expect(s.locked).toBe(true);
    expect(s.u1 - s.u0).toBeCloseTo(1, 9);
    expect(s.u1 % 1).toBeCloseTo(phaseOfAge(3.7), 9);
    vi.advanceTimersByTime(SWEEP_S * 1000 + 300);
    expect(last()).toEqual([SHAPE.moon, 1, phaseOfAge(3.7)]);
    expect(_lunarEyeState().running).toBe(true);
  });

  it('a new scrub position takes over a sweep in flight (never fights the hand)', () => {
    setLunarScrub(3.7);
    compileLunarEye('full');
    vi.advanceTimersByTime(500);
    setLunarScrub(18);
    expect(_lunarEyeState().sweep).toBeNull();
    vi.advanceTimersByTime(20);
    expect(last()).toEqual([SHAPE.moon, 1, phaseOfAge(18)]);
  });

  it('tab exit stops everything at once', () => {
    setLunarScrub(10);
    compileLunarEye('new');
    stopLunarEye();
    const n = h.shapes.length;
    vi.advanceTimersByTime(500);
    expect(h.shapes.length).toBe(n);
    expect(_lunarEyeState()).toEqual({ scrub: null, sweep: null, running: false });
    expect(h.quiet.at(-1)).toBe(false);
  });

  it('reduced motion: no drive at all', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    setLunarScrub(7);
    compileLunarEye('full');
    expect(h.shapes).toHaveLength(0);
    expect(h.quiet).toHaveLength(0);
  });
});

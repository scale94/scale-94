import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBeatClock, DEFAULT_BPM } from '../artBeatClock';

describe('createBeatClock', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('derives the interval from bpm, rounded, matching the retired audio clock', () => {
    // SomaAudio.startBeatClock used Math.round(60000 / bpm); 114 bpm → 526ms.
    expect(createBeatClock({ bpm: 114 }).intervalMs).toBe(526);
    expect(createBeatClock({ bpm: 120 }).intervalMs).toBe(500);
  });

  it('defaults to 114 bpm', () => {
    expect(DEFAULT_BPM).toBe(114);
    expect(createBeatClock({}).intervalMs).toBe(526);
  });

  it('fires immediately on start so the pulse begins on toggle', () => {
    const onBeat = vi.fn();
    createBeatClock({ onBeat }).start();
    expect(onBeat).toHaveBeenCalledTimes(1);
  });

  it('fires once per interval thereafter', () => {
    const onBeat = vi.fn();
    createBeatClock({ bpm: 120, onBeat }).start();
    onBeat.mockClear();
    vi.advanceTimersByTime(1500);
    expect(onBeat).toHaveBeenCalledTimes(3);
  });

  it('stops firing after stop()', () => {
    const onBeat = vi.fn();
    const clock = createBeatClock({ bpm: 120, onBeat });
    clock.start();
    clock.stop();
    onBeat.mockClear();
    vi.advanceTimersByTime(5000);
    expect(onBeat).not.toHaveBeenCalled();
  });

  it('does not double-schedule when started twice', () => {
    const onBeat = vi.fn();
    const clock = createBeatClock({ bpm: 120, onBeat });
    clock.start();
    clock.start();
    onBeat.mockClear();
    vi.advanceTimersByTime(1000);
    expect(onBeat).toHaveBeenCalledTimes(2); // not 4
  });

  it('reports running state', () => {
    const clock = createBeatClock({ onBeat: () => {} });
    expect(clock.running).toBe(false);
    clock.start();
    expect(clock.running).toBe(true);
    clock.stop();
    expect(clock.running).toBe(false);
  });
});

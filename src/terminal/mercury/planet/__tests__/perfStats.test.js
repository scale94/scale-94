import { describe, it, expect } from 'vitest';
import { createPerfStats, pushFrame, summarize, PERF_WINDOW_S, PERF_INFO } from '../perfStats';

describe('perfStats', () => {
  it('percentiles in ms over the window, fps from p50', () => {
    const s = createPerfStats(256);
    for (let i = 0; i < 100; i++) pushFrame(s, i * 0.01, (i < 90 ? 10 : 30) / 1000, false);
    const r = summarize(s, 0.99);
    expect(r.n).toBe(100);
    expect(r.p50).toBeCloseTo(10, 6);
    expect(r.p95).toBeCloseTo(30, 6);
    expect(r.max).toBeCloseTo(30, 6);
    expect(r.fps).toBeCloseTo(100, 6);
  });

  it('only frames inside PERF_WINDOW_S count', () => {
    const s = createPerfStats(256);
    pushFrame(s, 0, 0.5, false);                 // old hitch
    for (let i = 1; i <= 10; i++) pushFrame(s, 10 + i * 0.016, 0.016, false);
    const r = summarize(s, 10 + 10 * 0.016);
    expect(r.n).toBe(10);
    expect(r.max).toBeCloseTo(16, 6);
    expect(PERF_WINDOW_S).toBe(2);
  });

  it('splits still and liquid frames', () => {
    const s = createPerfStats(64);
    for (let i = 0; i < 10; i++) pushFrame(s, i * 0.01, 0.008, false);
    for (let i = 10; i < 20; i++) pushFrame(s, i * 0.01, 0.02, true);
    expect(summarize(s, 0.2, { liquid: false }).p50).toBeCloseTo(8, 6);
    expect(summarize(s, 0.2, { liquid: true }).p50).toBeCloseTo(20, 6);
    expect(summarize(s, 0.2).n).toBe(20);
  });

  it('wraps without losing the newest frames; empty summary is zeros', () => {
    const s = createPerfStats(8);
    expect(summarize(s, 0)).toEqual({ n: 0, p50: 0, p95: 0, max: 0, fps: 0 });
    for (let i = 0; i < 20; i++) pushFrame(s, i * 0.01, (i + 1) / 1000, false);
    const r = summarize(s, 0.19);
    expect(r.n).toBe(8);
    expect(r.max).toBeCloseTo(20, 6);
  });

  it('PERF_INFO is a plain mutable readout', () => {
    expect(Object.keys(PERF_INFO).sort()).toEqual(['coverage', 'heatK', 'tailB', 'tau', 'vrKmS']);
  });
});

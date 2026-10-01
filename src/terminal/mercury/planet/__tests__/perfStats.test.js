import { describe, it, expect } from 'vitest';
import { createPerfStats, pushFrame, summarize, PERF_WINDOW_S, PERF_INFO,
  createExtraStats, pushExtra, summarizeExtra, LONG_FRAME_MS,
  createEventLog, pushEvent, summarizeEvents } from '../perfStats';

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

  describe('extras (js ms, pointer events, forced layout, hud correlation)', () => {
    it('js percentiles, ptr avg, forced-layout p95 over pointer frames only', () => {
      const s = createExtraStats(64);
      // 10 frames: dt 16ms, js 4ms, no pointer; 10 frames: dt 16, js 8, 3 ptr, layout 1..10 ms
      for (let i = 0; i < 10; i++) pushExtra(s, i * 0.016, 0.016, 4, 0, 0, false);
      for (let i = 0; i < 10; i++) pushExtra(s, 0.16 + i * 0.016, 0.016, 8, 3, i + 1, false);
      const r = summarizeExtra(s, 0.32);
      expect(r.n).toBe(20);
      expect(r.js.p50).toBeCloseTo(8, 5);
      expect(r.js.max).toBeCloseTo(8, 5);
      expect(r.ptrAvg).toBeCloseTo(1.5, 6);
      expect(r.layN).toBe(10);
      expect(r.layP95).toBeCloseTo(10, 5);
      expect(r.long).toBe(0);
    });

    it('long-frame share that is hud-adjacent vs the base rate', () => {
      const s = createExtraStats(128);
      let t = 0;
      // 100 frames; 10 are hud-adjacent; 4 long frames, 3 of them hud-adjacent
      for (let i = 0; i < 100; i++) {
        const hud = i % 10 === 0;
        const dt = (i === 0 || i === 10 || i === 20 || i === 55) ? 0.05 : 0.016;
        pushExtra(s, t, dt, 5, 0, 0, hud);
        t += 0.016;
      }
      const r = summarizeExtra(s, t);
      expect(LONG_FRAME_MS).toBe(33);
      expect(r.long).toBe(4);
      expect(r.longHud).toBe(3);
      expect(r.hudFrames).toBe(10);
      expect(r.hudShareOfLong).toBeCloseTo(0.75, 6);
      expect(r.hudBaseRate).toBeCloseTo(0.1, 6);
    });

    it('window excludes old frames; empty is all zeros', () => {
      const s = createExtraStats(16);
      expect(summarizeExtra(s, 0).n).toBe(0);
      expect(summarizeExtra(s, 0).hudShareOfLong).toBe(0);
      pushExtra(s, 0, 0.1, 50, 9, 9, true);
      for (let i = 1; i <= 5; i++) pushExtra(s, 10 + i * 0.016, 0.016, 2, 0, 0, false);
      const r = summarizeExtra(s, 10.1);
      expect(r.n).toBe(5);
      expect(r.long).toBe(0);
    });
  });

  describe('event log (long tasks, gpu ms)', () => {
    it('counts, sums, and percentiles inside the window; wraps', () => {
      const s = createEventLog(4);
      expect(summarizeEvents(s, 0)).toEqual({ n: 0, total: 0, p50: 0, p95: 0, max: 0 });
      pushEvent(s, 0, 500);                       // outside the window later
      pushEvent(s, 9.0, 60);
      pushEvent(s, 9.5, 80);
      pushEvent(s, 10.0, 100);
      let r = summarizeEvents(s, 10.0);
      expect(r.n).toBe(3);
      expect(r.total).toBeCloseTo(240, 6);
      expect(r.max).toBeCloseTo(100, 6);
      expect(r.p50).toBeCloseTo(80, 6);
      pushEvent(s, 10.2, 40);                     // wraps over the old t=0 slot
      r = summarizeEvents(s, 10.2);
      expect(r.n).toBe(4);
      expect(r.total).toBeCloseTo(280, 6);
    });
  });
});

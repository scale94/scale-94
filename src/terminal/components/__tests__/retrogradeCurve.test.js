// src/terminal/components/__tests__/retrogradeCurve.test.js
import { describe, it, expect } from 'vitest';
import { retrogradeCurve, RETROGRADE_MS } from '../retrogradeCurve';

describe('retrogradeCurve', () => {
  it('pins both ends to the true terminator (delta 0)', () => {
    expect(retrogradeCurve(0).delta).toBeCloseTo(0, 6);
    expect(retrogradeCurve(1).delta).toBeCloseTo(0, 6);
  });
  it('clamps t outside [0,1] to the endpoints', () => {
    expect(retrogradeCurve(-1).delta).toBeCloseTo(0, 6);
    expect(retrogradeCurve(2).delta).toBeCloseTo(0, 6);
  });

  // Sample the whole event to assert the double-sunrise signature.
  const samples = Array.from({ length: 201 }, (_, i) => retrogradeCurve(i / 200).delta);
  const min = Math.min(...samples);
  const max = Math.max(...samples);

  it('recedes hard (the sun walks back)', () => {
    expect(min).toBeLessThan(-0.3);
  });
  it('also rises (the second sunrise) — a real up-swing exists', () => {
    expect(max).toBeGreaterThan(0.2);
  });
  it('stays bounded', () => {
    expect(min).toBeGreaterThan(-1);
    expect(max).toBeLessThan(1);
  });
  it('tint peaks mid-event and vanishes at the ends', () => {
    expect(retrogradeCurve(0).tint).toBeCloseTo(0, 6);
    expect(retrogradeCurve(1).tint).toBeCloseTo(0, 6);
    expect(retrogradeCurve(0.5).tint).toBeGreaterThan(0.9);
  });
  it('exposes a multi-second duration', () => {
    expect(RETROGRADE_MS).toBeGreaterThanOrEqual(4000);
  });
});

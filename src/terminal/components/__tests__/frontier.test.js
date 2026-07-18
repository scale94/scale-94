import { describe, it, expect } from 'vitest';
import { ease, frontierFromTotals, legendLine } from '../frontier';

const totals = (kernelsLoaded = {}, ranAliases = {}) => ({
  transmissions: { kernelsLoaded, ranAliases },
});

describe('ease — concave, clamped', () => {
  it('anchors at 0 and 1', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
  });
  it('is concave: small input lifts disproportionately', () => {
    expect(ease(0.25)).toBeCloseTo(0.5, 5);   // sqrt
    expect(ease(0.1)).toBeGreaterThan(0.1);
  });
  it('clamps out-of-range input', () => {
    expect(ease(-1)).toBe(0);
    expect(ease(2)).toBe(1);
  });
});

describe('frontierFromTotals', () => {
  it('empty totals → pure night', () => {
    expect(frontierFromTotals(totals(), 16)).toEqual({ twilight: 0, day: 0, loaded: 0, run: 0 });
  });
  it('N<=0 guard → night, never divides by zero', () => {
    expect(frontierFromTotals(totals({ a: 1 }), 0)).toEqual({ twilight: 0, day: 0, loaded: 1, run: 0 });
  });
  it('counts distinct loaded/run and eases the fractions', () => {
    const r = frontierFromTotals(totals({ a: 1, b: 2, c: 1, d: 1 }, ), 16); // 4 loaded, 0 run
    expect(r.loaded).toBe(4);
    expect(r.run).toBe(0);
    expect(r.twilight).toBeCloseTo(0.5, 5);   // sqrt(4/16)
    expect(r.day).toBe(0);
  });
  it('maintains day <= twilight invariant', () => {
    const r = frontierFromTotals(totals({ a: 1, b: 1, c: 1, d: 1 }, { a: 1 }), 16); // 4 loaded, 1 run
    expect(r.day).toBeLessThanOrEqual(r.twilight);
    expect(r.day).toBeCloseTo(0.25, 5);        // sqrt(1/16)
  });
  it('tolerates missing sub-objects', () => {
    expect(frontierFromTotals({}, 16)).toEqual({ twilight: 0, day: 0, loaded: 0, run: 0 });
  });
});

describe('legendLine — the lure', () => {
  it('night when nothing loaded', () => {
    expect(legendLine({ loaded: 0, run: 0 })).toBe('☿ night · no theory yet compiled');
  });
  it('dawn when loaded but not run', () => {
    expect(legendLine({ loaded: 7, run: 0 })).toBe('☿ dawn · 7 loaded, not yet real');
  });
  it('daylight once something has run', () => {
    expect(legendLine({ loaded: 7, run: 3 })).toBe('☿ daylight · 3 burned into knowledge');
  });
});

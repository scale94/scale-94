import { describe, it, expect } from 'vitest';
import { FORGE_TABLE, J_PER_KG, offerings, EMPTY_ARCHIVE, forgeLedger } from '../forge';

const rel = (a, b) => Math.abs(a - b) / b;
const t0 = Date.UTC(2026, 10, 19, 12);
const mk = (erg, launchedAt = t0, id = 'x') => ({ id, launchedAt, energyErg: erg, transitMs: 20 * 3600e3, handedness: 'cw', origin: 'hand', witnessed: false });

describe('forge', () => {
  it('J per kg from mass defects', () => {
    expect(rel(J_PER_KG.He, 6.444e14)).toBeLessThan(1e-3);
    expect(rel(J_PER_KG.C, 5.849e13)).toBeLessThan(1e-3);
    expect(rel(J_PER_KG.O, 4.320e13)).toBeLessThan(1e-3);
  });
  it('offerings at E_MAX and E_MIN match spec 3.3', () => {
    const o = offerings(mk(5e32));
    expect(rel(o.He.kg, 7.76e10)).toBeLessThan(2e-3);
    expect(rel(o.H.kg, 7.815e10)).toBeLessThan(2e-3);
    expect(rel(o.C.kg, 8.55e11)).toBeLessThan(2e-3);
    expect(rel(o.O.kg, 1.157e12)).toBeLessThan(2e-3);
    const w = offerings(mk(1e29));
    expect(rel(w.He.kg, 1.552e7)).toBeLessThan(2e-3);
    expect(rel(w.C.kg, 1.71e8)).toBeLessThan(3e-3);
    expect(rel(w.O.kg, 2.315e8)).toBeLessThan(3e-3);
  });
  it('dated years are arithmetic, past the Date range', () => {
    const o = offerings(mk(5e32));
    expect(o.C.year).toBe(7590002026);
    expect(o.O.year).toBe(7700002026);
  });
  it('gold is a row with no role', () => {
    expect(FORGE_TABLE.at(-1)).toEqual({ symbol: 'Au', z: 79, role: null });
    expect(Object.isFrozen(FORGE_TABLE)).toBe(true);
  });
  it('helium is owed until the protons arrive, then delivered; C/O count from the snap', () => {
    const c = mk(5e32);
    const before = forgeLedger([c], EMPTY_ARCHIVE, t0 + 1);
    expect(before.He).toBe(0);
    expect(before.heOwed).toBeGreaterThan(0);
    expect(before.C).toBeGreaterThan(0);
    const after = forgeLedger([c], EMPTY_ARCHIVE, t0 + 3 * 3600e3);
    expect(after.He).toBeCloseTo(offerings(c).He.kg, -3);
    expect(after.heOwed).toBe(0);
  });
  it('old clouds stored before this layer count as delivered (Review Focus 4)', () => {
    const old = mk(1e31, t0 - 30 * 24 * 3600e3, 'old');
    expect(forgeLedger([old], EMPTY_ARCHIVE, t0).He).toBeGreaterThan(0);
  });
  it('archive totals add in; empty input gives any=false and null years', () => {
    expect(forgeLedger([], EMPTY_ARCHIVE, t0)).toMatchObject({ He: 0, C: 0, any: false, cYear: null });
    const a = { ...EMPTY_ARCHIVE, He: 5, H: 5, C: 7, O: 9, cYear: 7590002025, oYear: 7700002025 };
    expect(forgeLedger([], a, t0)).toMatchObject({ He: 5, C: 7, any: true, cYear: 7590002025 });
  });
  it('a malformed archive is read as zeros', () => {
    const l = forgeLedger([], { H: NaN, He: 'x', C: undefined, O: null, cYear: NaN }, t0);
    expect(l).toMatchObject({ H: 0, He: 0, C: 0, O: 0, cYear: null, any: false });
  });
});

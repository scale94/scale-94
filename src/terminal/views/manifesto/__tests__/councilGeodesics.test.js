import { describe, it, expect } from 'vitest';
import {
  B_C, FAR, N_B, N_PHI, EINSTEIN_B,
  rowImpact, deflectImpact, traceRay, deflectionAngle,
  bakeGeodesicTable, bakeDeflectionTable, geodesicTables,
} from '../councilGeodesics';

describe('councilGeodesics — Schwarzschild photon orbits (spec §7.1, §10.4)', () => {
  it('places the capture threshold at b_c = 3√3/2 r_s within 0.1%', () => {
    let lo = 2.4, hi = 2.8; // lo is captured, hi escapes
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (deflectionAngle(mid) === Infinity) lo = mid; else hi = mid;
    }
    expect(Math.abs(hi - B_C) / B_C).toBeLessThan(1e-3);
  });

  it('matches weak-field deflection 2 r_s / b within 0.5% at b = 500', () => {
    expect(Math.abs(deflectionAngle(500) / (2 / 500) - 1)).toBeLessThan(5e-3);
  });

  it('matches the third-order expansion within 0.1% at b = 50', () => {
    const x = 0.5 / 50; // M/b with r_s = 1
    const expected = 4 * x + ((15 * Math.PI) / 4) * x ** 2 + (128 / 3) * x ** 3;
    expect(Math.abs(deflectionAngle(50) / expected - 1)).toBeLessThan(1e-3);
  });

  it('winds more than 2π just outside b_c, matching the strong-deflection limit', () => {
    const b = B_C + 1e-3;
    const bozza = -Math.log(b / B_C - 1) + Math.log(216 * (7 - 4 * Math.sqrt(3))) - Math.PI;
    const a = deflectionAngle(b);
    expect(a).toBeGreaterThan(2 * Math.PI);
    expect(Math.abs(a / bozza - 1)).toBeLessThan(5e-3);
  });

  it('warps rows so b = 0 at row 0, b = 24 at the last row, and deflection starts at b_c', () => {
    expect(rowImpact(0)).toBeCloseTo(0, 9);
    expect(rowImpact(N_B - 1)).toBeCloseTo(24, 9);
    expect(deflectImpact(0)).toBeCloseTo(B_C, 12);
  });

  it('traces captured rays to 0, escaped rays to FAR, and bends periapsis inside b', () => {
    expect(traceRay(1.0)[N_PHI - 1]).toBe(0);
    expect(traceRay(20)[N_PHI - 1]).toBe(FAR);
    const peri = Math.min(...traceRay(8));
    expect(peri).toBeLessThan(8);
    expect(peri).toBeGreaterThan(6.5);
    // near the edge, on the integrator itself (deflectionAngle short-circuits b ≤ B_C)
    expect(traceRay(0.99 * B_C)[N_PHI - 1]).toBe(0);
    expect(traceRay(1.01 * B_C)[N_PHI - 1]).toBe(FAR);
  });

  it('bakes bit-identical tables', () => {
    expect(bakeGeodesicTable()).toEqual(bakeGeodesicTable());
    expect(bakeDeflectionTable()).toEqual(bakeDeflectionTable());
  });

  it('bakes deflection at the coarse step within 1e-4 of the fine integrator', () => {
    const t = bakeDeflectionTable();
    for (const i of [8, 64, 128, 255]) {
      const fine = Math.min(deflectionAngle(deflectImpact(i)), 4 * Math.PI);
      expect(Math.abs(t[i] - fine)).toBeLessThan(1e-4 * Math.max(1, fine));
    }
  });

  it('sets the lens distance so the Einstein ring sits at 3.5 r_s', () => {
    const { lensD } = geodesicTables();
    expect(Math.abs(EINSTEIN_B - lensD * deflectionAngle(EINSTEIN_B))).toBeLessThan(1e-9);
  });
});

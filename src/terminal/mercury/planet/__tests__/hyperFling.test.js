// src/terminal/mercury/planet/__tests__/hyperFling.test.js — phase 6a: trigger, mass split, launch
import { describe, it, expect } from 'vitest';
import {
  canHyper, hyperEnergy, splitMass, gammaMean1, mulberry32, hyperMu, hyperReach,
  V0, V_HYPER, V_HYPER_SPAN, HYPER_OMEGA_FRAC, F_CORE_MAX, F_CORE_MIN, HYPER_R_MAX_K, HYPER_VIS_K, HYPER_REACH_MIN_R,
} from '../hyperFling';
import { MAX_OMEGA } from '../mercuryBody';
import { PX_FLOOR, sphereVol } from '../breakupPhysics';
import { R_SCENE } from '../planetLook';

const volOf = (rs) => rs.reduce((a, r) => a + sphereVol(r), 0);

describe('hyperFling trigger', () => {
  it('fires only with the spin pinned at the cap AND a fast release pointer, never on lite', () => {
    const w = HYPER_OMEGA_FRAC * MAX_OMEGA;
    expect(canHyper({ omega: w, ptrOmega: V_HYPER, nMax: 16 })).toBe(true);
    expect(canHyper({ omega: w - 0.01, ptrOmega: 1e3, nMax: 16 })).toBe(false);
    expect(canHyper({ omega: MAX_OMEGA, ptrOmega: V_HYPER - 0.01, nMax: 16 })).toBe(false);
    expect(canHyper({ omega: MAX_OMEGA, ptrOmega: 1e3, nMax: 0 })).toBe(false);
  });

  it('eH ramps 0 → 1 over V_HYPER_SPAN', () => {
    expect(hyperEnergy(0)).toBe(0);
    expect(hyperEnergy(V_HYPER)).toBe(0);
    expect(hyperEnergy(V_HYPER + V_HYPER_SPAN / 2)).toBeCloseTo(0.5, 12);
    expect(hyperEnergy(1e6)).toBe(1);
  });
});

describe('splitMass (Villermaux gamma spread, exact volume)', () => {
  it('conserves V0 to 1e-9 and respects the floor and the relative ceiling', () => {
    for (const N of [8, 14, 16, 32]) for (const eH of [0, 0.5, 1]) for (let seed = 1; seed <= 5; seed++) {
      const m = splitMass(N, eH, seed, 300);
      expect(m.radii.length).toBe(N);
      expect(Math.abs(volOf(m.radii) + m.fC * V0 - V0) / V0).toBeLessThan(1e-9);
      for (const r of m.radii) {
        expect(r).toBeGreaterThanOrEqual((PX_FLOOR / 300) * (1 - 1e-9));
        expect(r).toBeLessThanOrEqual(HYPER_R_MAX_K * m.rBar * (1 + 1e-9));
      }
    }
  });

  it('the core keeps F_CORE_MAX at eH 0 and F_CORE_MIN at eH 1; rC0 = R ∛fC', () => {
    const a = splitMass(16, 0, 1, 300), b = splitMass(16, 1, 1, 300);
    expect(a.fC).toBeCloseTo(F_CORE_MAX, 12);
    expect(b.fC).toBeCloseTo(F_CORE_MIN, 12);
    expect(b.rC0).toBeCloseTo(R_SCENE * Math.cbrt(F_CORE_MIN), 12);
  });

  it('is deterministic per seed and differs between seeds', () => {
    expect(splitMass(16, 1, 7, 300).radii).toEqual(splitMass(16, 1, 7, 300).radii);
    expect(splitMass(16, 1, 7, 300).radii).not.toEqual(splitMass(16, 1, 8, 300).radii);
  });

  it('reads as organic quicksilver: radius CV 0.3–0.65 (gamma n = 4 gives 0.5 before clamps)', () => {
    let cv = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const r = splitMass(32, 1, seed, 300).radii;
      const mean = r.reduce((a, x) => a + x, 0) / r.length;
      const sd = Math.sqrt(r.reduce((a, x) => a + (x - mean) ** 2, 0) / r.length);
      cv += sd / mean / 20;
    }
    expect(cv).toBeGreaterThan(0.3);
    expect(cv).toBeLessThan(0.65);
  });

  it('gammaMean1 has mean 1 and variance 1/n', () => {
    const rng = mulberry32(7);
    let s = 0, s2 = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) { const x = gammaMean1(rng, 4); s += x; s2 += x * x; }
    const mean = s / n;
    expect(mean).toBeCloseTo(1, 1);
    expect(s2 / n - mean * mean).toBeGreaterThan(0.23);
    expect(s2 / n - mean * mean).toBeLessThan(0.27);
  });
});

describe('hyperFling knobs', () => {
  it('μ is the orbit period at the old surface: 4π²R³/P²', () => {
    expect(hyperMu(3.5)).toBeCloseTo((4 * Math.PI ** 2 * R_SCENE ** 3) / 3.5 ** 2, 12);
  });
  it('reach: HYPER_VIS_K · rVis, floored at HYPER_REACH_MIN_R · R (plan amendment A1)', () => {
    expect(hyperReach(1.38)).toBeCloseTo(HYPER_VIS_K * 1.38, 12);
    expect(hyperReach(0.92)).toBeCloseTo(HYPER_REACH_MIN_R * R_SCENE, 12);
  });
});

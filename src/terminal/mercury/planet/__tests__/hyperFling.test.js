// src/terminal/mercury/planet/__tests__/hyperFling.test.js — phase 6a: trigger, mass split, launch
import { describe, it, expect } from 'vitest';
import {
  canHyper, hyperEnergy, splitMass, gammaMean1, mulberry32, hyperMu, hyperReach,
  fireHyper, coreScale, ETA_HI, HYPER_GRACE_S, T_BURST,
  V0, V_HYPER, V_HYPER_SPAN, HYPER_OMEGA_FRAC, F_CORE_MAX, F_CORE_MIN, HYPER_R_MAX_K, HYPER_VIS_K, HYPER_REACH_MIN_R,
} from '../hyperFling';
import { MAX_OMEGA } from '../mercuryBody';
import { PX_FLOOR, sphereVol } from '../breakupPhysics';
import { R_SCENE } from '../planetLook';
import { createFamily } from '../breakupFamily';

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

const fireAt = (over = {}) => fireHyper(createFamily(1), {
  N: 16, eH: 1, seed: 3, omega: [0, 12, 0], pxPerUnit: 300, vR0: 2, orbitS: 3.5, gammaFloor: 8, ...over,
});
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe('fireHyper (launch)', () => {
  it('lays out N free beads inside the old surface, all fragment volume out, the core waiting', () => {
    const f = fireAt();
    expect(f.phase).toBe('fired');
    expect(f.hyper).toBe(true);
    expect(f.necks.length).toBe(0);
    expect(f.bodies.length).toBe(16);
    let v = 0;
    for (const b of f.bodies) {
      expect(b.state).toBe('free');
      expect(Math.hypot(...b.p)).toBeCloseTo(R_SCENE - b.r, 9);
      v += b.vol;
    }
    expect(f.volOut).toBeCloseTo(v, 12);
    expect(Math.abs(v + F_CORE_MIN * V0 - V0) / V0).toBeLessThan(1e-9);
    expect(f.rC0).toBeCloseTo(R_SCENE * Math.cbrt(F_CORE_MIN), 12);
    expect(f.tGrace).toBe(HYPER_GRACE_S);
  });

  it('the swarm centre of mass is still', () => {
    const f = fireAt();
    const m = [0, 0, 0];
    let V = 0;
    for (const b of f.bodies) { for (let c = 0; c < 3; c++) m[c] += b.vol * b.v[c]; V += b.vol; }
    expect(Math.hypot(...m) / V).toBeLessThan(1e-9);
  });

  it('swirls with the spin: L-hat ~ omega-hat, and beads hug the spin equator', () => {
    const f = fireAt();
    expect(dot(f.axisL, [0, 1, 0])).toBeGreaterThan(0.9);
    const meanCos = f.bodies.reduce((a, b) => a + Math.abs(b.p[1]) / Math.hypot(...b.p), 0) / f.bodies.length;
    expect(meanCos).toBeLessThan(0.4); // a uniform sphere gives 0.5
  });

  it('small beads fly out faster', () => {
    const f = fireAt();
    const radial = (b) => dot(b.v, b.p) / Math.hypot(...b.p);
    const byR = [...f.bodies].sort((a, b) => a.r - b.r);
    expect(radial(byR[0])).toBeGreaterThan(radial(byR[byR.length - 1]));
  });

  it('pull from the orbit knob, provisional headwind and floor drag, same seed gives same swarm', () => {
    const f = fireAt();
    expect(f.mu).toBeCloseTo(hyperMu(3.5), 12);
    expect(f.eta).toBe(ETA_HI);
    expect(f.gammaH).toBe(8);
    expect(fireAt().bodies.map((b) => b.p)).toEqual(f.bodies.map((b) => b.p));
  });
});

describe('coreScale', () => {
  it('1 for a phase-5 or idle family; eases to cbrt(1 - volOut/V0) over T_BURST; regrows as volume drains back', () => {
    expect(coreScale(createFamily(1))).toBe(1);
    const f = fireAt();
    expect(coreScale(f)).toBe(1);
    f.t = T_BURST;
    expect(coreScale(f)).toBeCloseTo(Math.cbrt(F_CORE_MIN), 9);
    f.volOut *= 0.5;
    expect(coreScale(f)).toBeCloseTo(Math.cbrt(1 - (1 - F_CORE_MIN) * 0.5), 9);
  });
});

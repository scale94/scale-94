// src/terminal/mercury/planet/__tests__/hyperFling.test.js — phase 6a: trigger, mass split, launch
import { describe, it, expect } from 'vitest';
import {
  canHyper, hyperEnergy, splitMass, gammaMean1, mulberry32, hyperMu, hyperReach,
  fireHyper, coreScale, ETA_HI, HYPER_GRACE_S, T_BURST, HYPER_GAMMA, HYPER_AIM_S, HYPER_HANG_K,
  V0, V_HYPER, V_HYPER_SPAN, HYPER_OMEGA_FRAC, HYPER_RBAR_LO, HYPER_RBAR_HI, HYPER_R_MAX_K, HYPER_VIS_K, HYPER_REACH_MIN_R,
} from '../hyperFling';
import { hyperAccel, DROP_DT } from '../breakupStep';
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

  it('the bead size is the knob: r̄ = R · lerp(RBAR_LO, RBAR_HI, eH); ~1 % of the planet flies; rC0 = R ∛fC', () => {
    const a = splitMass(16, 0, 1, 300), b = splitMass(16, 1, 1, 300);
    expect(a.rBar).toBeCloseTo(R_SCENE * HYPER_RBAR_LO, 12);
    expect(b.rBar).toBeCloseTo(R_SCENE * HYPER_RBAR_HI, 12);
    expect(b.fC).toBeCloseTo(1 - (16 * sphereVol(b.rBar)) / V0, 12);
    expect(b.fC).toBeGreaterThan(0.98);
    expect(b.rC0).toBeCloseTo(R_SCENE * Math.cbrt(b.fC), 12);
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

const REACH = 1.175;
const fireAt = (over = {}) => fireHyper(createFamily(1), {
  N: 16, eH: 1, seed: 3, omega: [0, 12, 0], pxPerUnit: 300, orbitS: 3, reach: REACH, target: 12, ...over,
});

describe('fireHyper (aimed launch, spec §10.2)', () => {
  it('lays out N free beads inside the old surface, all fragment volume out, the core waiting', () => {
    const f = fireAt();
    const m = splitMass(16, 1, 3, 300);
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
    expect(Math.abs(v + m.fC * V0 - V0) / V0).toBeLessThan(1e-9);
    expect(f.rC0).toBeCloseTo(m.rC0, 12);
    expect(f.tGrace).toBe(HYPER_GRACE_S);
  });

  it('aims each bead exactly: after HYPER_AIM_S alone under the vortex it ends within 0.005 of its seeded radius', () => {
    for (const seed of [3, 4, 5, 6]) {
      const f = fireAt({ seed });
      const a = [0, 0, 0];
      for (const b of f.bodies) {
        const p = [...b.p], v = [...b.v];
        for (let i = 0; i < Math.round(HYPER_AIM_S / DROP_DT); i++) {
          hyperAccel(f.mu, 0, f.gammaH, f.axisL, p[0], p[1], p[2], v[0], v[1], v[2], f.rC0, DROP_DT, a);
          for (let c = 0; c < 3; c++) { v[c] += a[c] * DROP_DT; p[c] += v[c] * DROP_DT; }
        }
        expect(Math.abs(Math.hypot(...p) - b.aimR), `seed ${seed} bead r ${b.r}`).toBeLessThan(0.005);
      }
    }
  });

  it('the vortex axis is the spin axis, and the beads hug the spin plane', () => {
    const f = fireAt();
    expect(f.axisL).toEqual([0, 1, 0]);
    const meanCos = f.bodies.reduce((a, b) => a + Math.abs(b.p[1]) / Math.hypot(...b.p), 0) / f.bodies.length;
    expect(meanCos).toBeLessThan(0.25); // a uniform sphere gives 0.5; HYPER_EQ_BIAS 0.64 gives ~0.18
  });

  it('every bead settles in the annulus between the core and the reach after HYPER_AIM_S', () => {
    for (const seed of [3, 4, 5]) {
      const f = fireAt({ seed });
      const a = [0, 0, 0];
      for (const b of f.bodies) {
        const p = [...b.p], v = [...b.v];
        for (let i = 0; i < Math.round(HYPER_AIM_S / DROP_DT); i++) {
          hyperAccel(f.mu, 0, f.gammaH, f.axisL, p[0], p[1], p[2], v[0], v[1], v[2], f.rC0, DROP_DT, a);
          for (let c = 0; c < 3; c++) { v[c] += a[c] * DROP_DT; p[c] += v[c] * DROP_DT; }
        }
        const r = Math.hypot(...p);
        expect(r, `seed ${seed} bead r ${b.r}`).toBeGreaterThan(f.rC0 + 1.5 * b.r); // clear of the core
        expect(r, `seed ${seed} bead r ${b.r}`).toBeLessThan(REACH - b.r + 0.01);
      }
    }
  });

  it('pull from the orbit knob, fixed drag, hang from the target, provisional headwind, same seed same swarm', () => {
    const f = fireAt();
    expect(f.mu).toBeCloseTo(hyperMu(3), 12);
    expect(f.gammaH).toBe(HYPER_GAMMA);
    expect(f.tHang).toBeCloseTo(HYPER_HANG_K * 12, 12);
    expect(f.eta).toBe(ETA_HI);
    expect(fireAt().bodies.map((b) => b.v)).toEqual(f.bodies.map((b) => b.v));
  });
});

describe('coreScale', () => {
  it('1 for a phase-5 or idle family; eases to cbrt(1 - volOut/V0) over T_BURST; regrows as volume drains back', () => {
    expect(coreScale(createFamily(1))).toBe(1);
    const f = fireAt();
    expect(coreScale(f)).toBe(1);
    f.t = T_BURST;
    expect(coreScale(f)).toBeCloseTo(Math.cbrt(1 - f.volOut / V0), 9);
    f.volOut *= 0.5;
    expect(coreScale(f)).toBeCloseTo(Math.cbrt(1 - f.volOut / V0), 9);
  });
});

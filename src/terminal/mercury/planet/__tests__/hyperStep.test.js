// src/terminal/mercury/planet/__tests__/hyperStep.test.js — phase 6a: the vortex return, the grace, the cascade clock
import { describe, it, expect } from 'vitest';
import { createFamily, fireFamily, DROP_V_REF } from '../breakupFamily';
import { stepFamily, DROP_DT, hyperAccel, cascadeDuration, STRIKE_V_REF } from '../breakupStep';
import { IMPACT_WAVE_AMP } from '../mercuryImpacts';
import { TONGUE_MAX_R } from '../breakupPhysics';
import { R_SCENE } from '../planetLook';
import { testEnv, freeBody, runFor } from './breakupTestKit';
import { firedHyper, hyperEnv0 } from './hyperTestKit';
import { coreScale, hyperReach } from '../hyperFling';
import { createMuSolver, finishMuSolver } from '../breakupBudget';

const hyperFam = (over = {}) => {
  const f = createFamily(1);
  Object.assign(f, { phase: 'fired', hyper: true, mu: 1, eta: 0, gammaH: 10, axisL: [0, 0, 1], tGrace: 0, rC0: 0.3 }, over);
  return f;
};
const coreEnv = (f) => testEnv({ planetRadiusAt: () => f.rC0 });

describe('hyper family fields', () => {
  it('a new family is not hyper, and a phase-5 fire clears a stale hyper flag', () => {
    const f = createFamily(1);
    expect(f.hyper).toBe(false);
    expect(f.tGrace).toBe(0);
    expect(f.tHang).toBe(0);
    Object.assign(f, { hyper: true, tGrace: 1, tHang: 3, axisBody: [1, 0, 0], L: TONGUE_MAX_R, e: 1 });
    fireFamily(f, { maxBodies: 16, satellites: true });
    expect(f.hyper).toBe(false);
    expect(f.tGrace).toBe(0);
    expect(f.tHang).toBe(0);
  });
});

describe('hyperAccel (drag toward the aether vortex)', () => {
  it('at the vortex velocity there is no drag: pure gravity', () => {
    const out = hyperAccel(1, 0, 10, [0, 0, 1], 1, 0, 0, 0, 1, 0, 0, 0, [0, 0, 0]);
    expect(out[0]).toBeCloseTo(-1, 12);
    expect(out[1]).toBeCloseTo(0, 12);
    expect(out[2]).toBeCloseTo(0, 12);
  });
  it('at rest the vortex drags the bead along (L̂ × x), slowed by the headwind (1 − η)', () => {
    const out = hyperAccel(1, 0.25, 10, [0, 0, 1], 1, 0, 0, 0, 0, 0, 0, 0, [0, 0, 0]);
    expect(out[0]).toBeCloseTo(-1, 12);
    expect(out[1]).toBeCloseTo(10 * 0.75, 12);
  });
  it('inside the core gravity is linear, as for a uniform ball: a = −μ x / rC³ (no 1/r² singularity)', () => {
    const rC = 0.3;
    for (const r of [0.2, 0.05, 1e-3]) {
      const out = hyperAccel(1, 1, 0, [0, 0, 1], r, 0, 0, 0, 0, 0, rC, 0, [0, 0, 0]);
      expect(out[0]).toBeCloseTo(-r / rC ** 3, 9);
      expect(Number.isFinite(out[1]) && Number.isFinite(out[2])).toBe(true);
    }
    // outside the core it is still the point mass
    expect(hyperAccel(1, 1, 0, [0, 0, 1], 0.5, 0, 0, 0, 0, 0, rC, 0, [0, 0, 0])[0]).toBeCloseTo(-1 / 0.25, 12);
    // at the centre: finite, zero
    const c = hyperAccel(1, 0, 10, [0, 0, 1], 0, 0, 0, 0, 0, 0, rC, 0, [0, 0, 0]);
    expect(c.every(Number.isFinite)).toBe(true);
  });
});

describe('the vortex return in stepFamily', () => {
  it('η = 0 holds a circular orbit', () => {
    const f = hyperFam();
    const r0 = 0.9, vc = Math.sqrt(1 / r0);
    const b = freeBody(f, [r0, 0, 0], [0, vc, 0], 0.05);
    runFor(f, 3, coreEnv(f));
    expect(Math.hypot(...b.p)).toBeGreaterThan(r0 * 0.99);
    expect(Math.hypot(...b.p)).toBeLessThan(r0 * 1.01);
  });
  it('the drag kills out-of-plane motion: the excursion stays within ~vz/γ and dies away toward the disc ⊥ L̂', () => {
    // vertical motion is overdamped (γ ≫ Ω): the speed dies in ~1/γ, the offset decays at ~Ω²/γ (slowly)
    const f = hyperFam();
    const b = freeBody(f, [0.9, 0, 0], [0, Math.sqrt(1 / 0.9), 0.5], 0.05);
    let zMax = 0;
    for (let i = 0; i < 3 / DROP_DT; i++) { stepFamily(f, DROP_DT, coreEnv(f)); zMax = Math.max(zMax, Math.abs(b.p[2])); }
    expect(zMax).toBeLessThan(0.06);
    expect(Math.abs(b.p[2])).toBeLessThan(0.8 * zMax);
    expect(Math.abs(b.v[2])).toBeLessThan(0.02);
  });
  it('a headwind spirals the bead inward', () => {
    const f = hyperFam({ eta: 0.1 });
    const b = freeBody(f, [0.9, 0, 0], [0, Math.sqrt(1 / 0.9), 0], 0.05);
    runFor(f, 3, coreEnv(f));
    expect(Math.hypot(...b.p)).toBeLessThan(0.88);
  });
});

describe('birth grace (V3)', () => {
  it('no bead–bead merge and no core strike before tGrace; both after', () => {
    const f = hyperFam({ mu: 0, gammaH: 1000, tGrace: 0.25 });
    const a = freeBody(f, [0.6, 0, 0], [0, 0, 0], 0.1);
    const o = freeBody(f, [0.65, 0, 0], [0, 0, 0], 0.1);
    const c = freeBody(f, [0, 0.35, 0], [0, 0, 0], 0.1);
    const env = coreEnv(f);
    runFor(f, 0.2, env);
    expect([a.state, o.state, c.state]).toEqual(['free', 'free', 'free']);
    runFor(f, 0.1, env);
    expect(a.state === 'free' && o.state === 'free').toBe(false);
    expect(c.state).not.toBe('free');
  });
});

describe('cascadeDuration', () => {
  it('matches a live partial-coalescence cascade', () => {
    const f = createFamily(1);
    f.phase = 'fired'; f.mu = 0;
    const r = 0.04;
    const b = freeBody(f, [R_SCENE + r + 1e-3, 0, 0], [-0.5, 0, 0], r);
    const env = testEnv({ gamma: 0 });
    let t0 = -1, t1 = -1;
    for (let i = 0; i < 2000 && t1 < 0; i++) {
      stepFamily(f, DROP_DT, env);
      if (t0 < 0 && b.state === 'cascade') t0 = f.t;
      if (b.state === 'gone') t1 = f.t;
    }
    expect(t0).toBeGreaterThan(0);
    expect(t1).toBeGreaterThan(t0);
    expect(Math.abs(t1 - t0 - cascadeDuration(r, env.pxPerUnit))).toBeLessThan(5 * DROP_DT);
  });
});

describe('a live swarm with Phase 5 cohesion (regression: the grace-time implosion)', () => {
  it('over 20 seeds no FREE bead leaves 1.02 · reach over the whole flight, and every family comes home by 30 s', () => {
    const reach = hyperReach(1.38);
    for (let seed = 1; seed <= 20; seed++) {
      const f = firedHyper({ N: 32, seed, reach, target: 14 });
      const env0 = hyperEnv0();
      f.eta = finishMuSolver(createMuSolver(f, env0, 14)).best;
      const env = { ...env0, planetRadiusAt: () => R_SCENE * coreScale(f) };
      let pMax = 0;
      while (f.phase === 'fired' && f.t < 30) {
        stepFamily(f, DROP_DT, env);
        // free flight only: merging pairs and cascade hops ride the regrowing core (HOP_K · r), not the aim
        for (const b of f.bodies) if (b.state === 'free') pMax = Math.max(pMax, Math.hypot(...b.p));
      }
      expect(pMax, `seed ${seed}`).toBeLessThanOrEqual(1.02 * reach);
      expect(f.phase, `seed ${seed}`).not.toBe('fired');
    }
  });
});

describe('the gather splash budget (regression: the gather banding)', () => {
  const flightSplashes = (seed, N) => {
    const f = firedHyper({ N, seed, target: 12 });
    const env0 = hyperEnv0();
    f.eta = finishMuSolver(createMuSolver(f, env0, 12)).best;
    const env = { ...env0, planetRadiusAt: () => R_SCENE * coreScale(f) };
    const s = [];
    while (f.phase === 'fired' && f.t < 30) {
      stepFamily(f, DROP_DT, env);
      for (const e of f.events) if (e.kind === 'splash') s.push(e.wave / IMPACT_WAVE_AMP.splash);
      f.events.length = 0;
    }
    return s;
  };
  it('the whole swarm splashes with at most one full splash of energy (Σ s² ≤ 1), and is still felt', () => {
    for (const N of [8, 16]) for (let seed = 1; seed <= 6; seed++) {
      const s = flightSplashes(seed, N);
      const energy = s.reduce((a, x) => a + x * x, 0);
      expect(energy, `N ${N} seed ${seed}`).toBeLessThanOrEqual(1 + 1e-9);
      expect(energy, `N ${N} seed ${seed}`).toBeGreaterThan(0.2);
    }
  });
  it('a phase-5 drop of DROP_V_REF striking at STRIKE_V_REF still splashes at full strength', () => {
    const f = createFamily(1);
    f.phase = 'fired'; f.mu = 0;
    const r = Math.cbrt((3 * DROP_V_REF) / (4 * Math.PI));
    freeBody(f, [R_SCENE + r + 1e-4, 0, 0], [-STRIKE_V_REF, 0, 0], r);
    const env = testEnv({ gamma: 0, vRef: DROP_V_REF });
    let first = null;
    for (let i = 0; i < 200 && !first; i++) { stepFamily(f, DROP_DT, env); first = f.events.find((e) => e.kind === 'splash'); }
    expect(first.wave).toBeCloseTo(IMPACT_WAVE_AMP.splash * (1 - 0.125), 6);
  });
});

describe('orbit, then gather (V4 §10.3)', () => {
  it('before tHang the headwind is off: a circular orbit holds; after it the bead spirals in', () => {
    const f = hyperFam({ eta: 0.3, tHang: 2 });
    const r0 = 0.9;
    const b = freeBody(f, [r0, 0, 0], [0, Math.sqrt(1 / r0), 0], 0.05);
    runFor(f, 1.9, coreEnv(f));
    expect(Math.hypot(...b.p)).toBeGreaterThan(r0 * 0.99);
    runFor(f, 1.5, coreEnv(f));
    expect(Math.hypot(...b.p)).toBeLessThan(r0 * 0.95);
  });

  it('before tHang cohesion is off; after it, it pulls', () => {
    const mk = () => {
      const f = hyperFam({ mu: 0, gammaH: 0, tHang: 0.5, vRefH: 1e-3 });
      const a = freeBody(f, [0.9, 0, 0], [0, 0, 0], 0.02);
      const o = freeBody(f, [0.9, 0.3, 0], [0, 0, 0], 0.02);
      return { f, a, o };
    };
    const env = (f) => testEnv({ kappa: 0.1, planetRadiusAt: () => f.rC0 });
    const s = mk();
    runFor(s.f, 0.45, env(s.f));
    expect(Math.hypot(...s.a.v)).toBe(0);
    runFor(s.f, 0.2, env(s.f));
    expect(s.a.v[1]).toBeGreaterThan(0); // pulled toward o
  });
});

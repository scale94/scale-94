// src/terminal/mercury/planet/__tests__/hyperStep.test.js — phase 6a: the vortex return, the grace, the cascade clock
import { describe, it, expect } from 'vitest';
import { createFamily, fireFamily } from '../breakupFamily';
import { stepFamily, DROP_DT, hyperAccel, cascadeDuration } from '../breakupStep';
import { TONGUE_MAX_R } from '../breakupPhysics';
import { R_SCENE } from '../planetLook';
import { testEnv, freeBody, runFor } from './breakupTestKit';
import { firedHyper, hyperEnv0 } from './hyperTestKit';
import { coreScale, hyperReach } from '../hyperFling';
import { solveContainment, createMuSolver, finishMuSolver } from '../breakupBudget';

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
    Object.assign(f, { hyper: true, tGrace: 1, axisBody: [1, 0, 0], L: TONGUE_MAX_R, e: 1 });
    fireFamily(f, { maxBodies: 16, satellites: true });
    expect(f.hyper).toBe(false);
    expect(f.tGrace).toBe(0);
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
  it('over 20 seeds no bead leaves 1.5 · reach in the first 1 s, and every family comes home by 30 s', () => {
    const reach = hyperReach(1.38);
    for (let seed = 1; seed <= 20; seed++) {
      const f = firedHyper({ N: 32, seed });
      const env0 = hyperEnv0();
      f.gammaH = solveContainment(f, env0.pxPerUnit, reach, 8);
      f.eta = finishMuSolver(createMuSolver(f, env0, 14)).best;
      const env = { ...env0, planetRadiusAt: () => R_SCENE * coreScale(f) };
      let pMax = 0;
      while (f.phase === 'fired' && f.t < 30) {
        stepFamily(f, DROP_DT, env);
        if (f.t <= 1) for (const b of f.bodies) if (b.state !== 'gone') pMax = Math.max(pMax, Math.hypot(...b.p));
      }
      expect(pMax, `seed ${seed}`).toBeLessThan(1.5 * reach);
      expect(f.phase, `seed ${seed}`).not.toBe('fired');
    }
  });
});

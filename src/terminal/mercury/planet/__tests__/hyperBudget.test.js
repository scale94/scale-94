// src/terminal/mercury/planet/__tests__/hyperBudget.test.js — phase 6a: test particles, the headwind solve, containment
import { describe, it, expect } from 'vitest';
import {
  beginParticles, runParticles, particleTurns, trialWeight, createMuSolver, finishMuSolver,
  solverBudget, SOLVER_SUBSTEPS_PER_FRAME, PARTICLES_PER_UNIT,
} from '../breakupBudget';
import { createFamily } from '../breakupFamily';
import { stepFamily, DROP_DT, cascadeDuration } from '../breakupStep';
import { ETA_LO, ETA_HI, HYPER_GAMMA, HYPER_CASCADE_S } from '../hyperFling';
import { createFamily as createFam, fireFamily } from '../breakupFamily';
import { R_SCENE } from '../planetLook';
import { testEnv, freeBody } from './breakupTestKit';
import { hyperEnv0, firedHyper } from './hyperTestKit';

const oneBead = (eta) => {
  const f = createFamily(1);
  Object.assign(f, { phase: 'fired', hyper: true, mu: 1, eta, gammaH: 10, axisL: [0, 0, 1], tGrace: 0.25, rC0: 0.3 });
  freeBody(f, [0.9, 0, 0], [0, Math.sqrt(1 / 0.9), 0], 0.05);
  return f;
};

describe('test particles replay the live hyper flight', () => {
  it('a lone bead arrives at the same time in the live family and the particle trial', () => {
    const live = oneBead(0.3);
    const tr = beginParticles(oneBead(0.3), 300, { eta: 0.3, gamma: 10, tMax: 60 });
    runParticles(tr, Infinity);
    const env = testEnv({ kappa: 0, planetRadiusAt: () => live.rC0 });
    let tArr = -1;
    for (let i = 0; i < 60 / DROP_DT && tArr < 0; i++) {
      stepFamily(live, DROP_DT, env);
      if (live.bodies[0].state === 'cascade') tArr = live.t;
    }
    expect(tArr).toBeGreaterThan(0);
    expect(Math.abs(tr.out[0] - cascadeDuration(0.05, 300) - tArr)).toBeLessThan(2 * DROP_DT);
  });

  it('a stronger headwind brings the swarm home sooner', () => {
    const f = firedHyper();
    const T = (eta) => { const tr = beginParticles(f, 300, { eta, gamma: 10, tMax: 60 }); runParticles(tr, Infinity); return tr.tEnd; };
    expect(T(0.3)).toBeLessThan(T(0.05));
  });

  it('counts turns about L̂: one orbital period at η = 0 is one turn', () => {
    const f = oneBead(0);
    const period = 2 * Math.PI * Math.sqrt(0.9 ** 3 / 1);
    const turns = particleTurns(f, 300, 0, period);
    expect(turns[0]).toBeGreaterThan(0.97);
    expect(turns[0]).toBeLessThan(1.03);
  });
});

describe('the headwind solver (log-η bisection)', () => {
  it('lands the swarm by the target with the smallest η that does', () => {
    const f = firedHyper();
    f.gammaH = 10;
    const s = finishMuSolver(createMuSolver(f, hyperEnv0(), 12));
    expect(s.kind).toBe('eta');
    expect(s.landed).toBe(true);
    expect(s.best).toBeGreaterThanOrEqual(ETA_LO);
    expect(s.best).toBeLessThanOrEqual(ETA_HI);
    const T = (eta) => { const tr = beginParticles(f, 300, { eta, gamma: 10, tMax: 12 }); runParticles(tr, Infinity); return tr.left === 0 ? tr.tEnd : Infinity; };
    expect(T(s.best)).toBeLessThanOrEqual(12);
    if (s.best / 1.05 > ETA_LO) expect(T(s.best / 1.05)).toBeGreaterThan(12);
  });

  it('weights a particle substep by ceil(N / PARTICLES_PER_UNIT) phase-5 substeps', () => {
    const f = firedHyper({ N: 32 });
    expect(trialWeight(f)).toBe(Math.ceil(32 / PARTICLES_PER_UNIT));
    expect(trialWeight(createFamily(1))).toBe(1);
    const s = createMuSolver(f, hyperEnv0(), 12);
    expect(solverBudget(s, 1e9)).toBe(SOLVER_SUBSTEPS_PER_FRAME);
  });
});

describe('the fixed vortex drag', () => {
  it('sits well inside the explicit-drag stability bound γ · h < 2', () => {
    expect(HYPER_GAMMA * DROP_DT).toBeLessThan(1);
  });
});

describe('the hyper cascade clock (tcScale)', () => {
  it('fireHyper scales the largest bead cascade to HYPER_CASCADE_S', () => {
    const f = firedHyper();
    expect(f.tcScale).toBeGreaterThan(0);
    expect(f.tcScale).toBeLessThanOrEqual(1);
    const rMax = Math.max(...f.bodies.map((b) => b.r));
    if (cascadeDuration(rMax, 300) > HYPER_CASCADE_S) expect(cascadeDuration(rMax, 300, f.tcScale)).toBeCloseTo(HYPER_CASCADE_S, 9);
    else expect(f.tcScale).toBe(1);
  });

  it('a live cascade at tcScale 0.1 takes cascadeDuration(r, px, 0.1)', () => {
    const f = createFam(1);
    f.phase = 'fired'; f.mu = 0; f.tcScale = 0.1;
    const r = 0.2;
    const b = freeBody(f, [R_SCENE + r + 1e-3, 0, 0], [-0.5, 0, 0], r);
    const env = testEnv({ gamma: 0 });
    let t0 = -1, t1 = -1;
    for (let i = 0; i < 20000 && t1 < 0; i++) {
      stepFamily(f, DROP_DT, env);
      if (t0 < 0 && b.state === 'cascade') t0 = f.t;
      if (b.state === 'gone') t1 = f.t;
    }
    expect(t0).toBeGreaterThan(0);
    expect(t1).toBeGreaterThan(t0);
    expect(Math.abs(t1 - t0 - cascadeDuration(r, env.pxPerUnit, 0.1))).toBeLessThan(5 * DROP_DT);
  });

  it('a phase-5 family keeps tcScale 1', () => {
    const f = createFam(1);
    expect(f.tcScale).toBe(1);
    f.tcScale = 0.3;
    f.axisBody = [1, 0, 0]; f.L = 0.5; f.e = 1;
    fireFamily(f, { maxBodies: 12, satellites: true });
    expect(f.tcScale).toBe(1);
  });
});

describe.skipIf(!process.env.HYPER_BENCH)('bench: PARTICLES_PER_UNIT', () => {
  it('measures a phase-5 substep against one particle step', async () => {
    const { firedFamily } = await import('./breakupTestKit');
    const fam = firedFamily({ maxBodies: 16, satellites: true });
    const env = testEnv({ kappa: 0.1 });
    for (let i = 0; i < 60; i++) stepFamily(fam, DROP_DT, env); // past the first snaps
    let t0 = performance.now();
    let n5 = 0;
    for (let i = 0; i < 20000; i++) { if (fam.phase !== 'fired') break; stepFamily(fam, DROP_DT, env); n5++; }
    const us5 = ((performance.now() - t0) * 1000) / n5;
    const f = firedHyper({ N: 32 });
    f.mu = 0; // no pull: nobody arrives, so every step carries all 32 particles
    const tr = beginParticles(f, 300, { eta: 0.1, gamma: 10, tMax: 1e9 });
    t0 = performance.now();
    runParticles(tr, 20000 * trialWeight(f));
    const usP = ((performance.now() - t0) * 1000) / ((tr.n / tr.w) * tr.count);
    console.log(`phase-5 substeps run ${n5}, bodies ${fam.bodies.filter((b) => b.state !== 'gone').length}; phase-5 substep ${us5.toFixed(2)} us; particle step ${usP.toFixed(3)} us; particles per unit ${(us5 / usP).toFixed(0)}`);
  });
});

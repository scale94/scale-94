// src/terminal/mercury/planet/__tests__/breakupBudget.test.js
import { describe, it, expect } from 'vitest';
import {
  muRef, returnTarget, headlessEnv, absorbTime, createMuSolver, stepMuSolver, finishMuSolver, SOLVER_SUBSTEPS_PER_FRAME,
  SOLVER_SUBSTEPS_MAX, solverBudget, MU_ITERS, MU_EXTRA, MU_CENTER, MU_SPAN, MU_CALIBRATED,
} from '../breakupBudget';
import {
  createFamily, fireFamily, breakExcess, tongueAxis, refreezeIn, MIN_RETURN_S, MERGE_MARGIN_S, DROP_V_REF,
} from '../breakupFamily';
import { TONGUE_MAX_R } from '../breakupPhysics';
import { SPIN_DAMP_PER_S } from '../mercuryBody';

const famAt = (omega, yaw) => {
  const f = createFamily(1);
  tongueAxis([0, 1, 0], [Math.cos(yaw), 0, Math.sin(yaw)], f.axisBody);
  f.L = breakExcess(omega, 7.5) * TONGUE_MAX_R;
  f.e = breakExcess(omega, 7.5);
  return fireFamily(f, { maxBodies: 12, satellites: true });
};
const env0At = (omega, yaw) => ({
  q: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)], omega: [0, omega, 0], gamma: 8, kappa: 0.1, // the shipped PLANET_TUNE.dropCohesion
  vRef: DROP_V_REF, pxPerUnit: 300, omegaTh: 7.5,
});

describe('breakupBudget — the 40 s linger is the budget', () => {
  it('return target: the drift wish, capped by refreeze − margin, floored at MIN_RETURN_S', () => {
    expect(returnTarget(80, 14)).toBe(14);
    expect(returnTarget(80, 100)).toBeCloseTo(refreezeIn(80) - MERGE_MARGIN_S, 9);
    expect(returnTarget(27, 14)).toBe(MIN_RETURN_S);
  });

  it('the headless replay decays the spin like the body does', () => {
    const env = headlessEnv(env0At(12, 0.3));
    env.at(2);
    expect(Math.hypot(...env.omega)).toBeCloseTo(12 * Math.exp(-SPIN_DAMP_PER_S * 2), 9);
    expect(Math.hypot(...env.q)).toBeCloseTo(1, 12);
  });

  it('a strong pull brings everyone home; a feeble one does not within tMax', () => {
    const f = famAt(12, 0);
    expect(absorbTime(f, env0At(12, 0), 1000 * muRef(7.5), 60)).toBeLessThan(60);
    expect(absorbTime(f, env0At(12, 0), 1e-6 * muRef(7.5), 5)).toBe(Infinity);
  });

  it('over a sweep of releases the solved pull lands the last drop on time, and no sooner than needed', () => {
    for (const omega of [8, 10, 12]) {
      for (const heat of [60, 70, 80]) {
        for (const yaw of [0, 2.1, 4.2]) {
          const f = famAt(omega, yaw);
          const e0 = env0At(omega, yaw);
          const target = returnTarget(heat, 14);
          const s = createMuSolver(f, e0, target);
          finishMuSolver(s);
          expect(s.done).toBe(true);
          expect(absorbTime(f, e0, s.best, target * 2)).toBeLessThanOrEqual(target + 1e-9);
        }
      }
    }
    const f = famAt(12, 0), e0 = env0At(12, 0);
    const s = createMuSolver(f, e0, 14);
    finishMuSolver(s);
    expect(absorbTime(f, e0, s.best / 1.5, 28)).toBeGreaterThan(14); // gentlest pull the budget allows
  }, 120000);

  it('every stepMuSolver call stays within the substep budget (load-insensitive cost pin)', () => {
    const s = createMuSolver(famAt(12, 0), env0At(12, 0), 14);
    let calls = 0;
    while (!s.done && calls < 100000) {
      const before = s.substeps;
      stepMuSolver(s);
      expect(s.substeps - before).toBeLessThanOrEqual(SOLVER_SUBSTEPS_PER_FRAME);
      calls++;
    }
    expect(s.done).toBe(true);
  });

  it('the sliced solver lands on the same pull as the synchronous one', () => {
    for (const [omega, yaw, target] of [[12, 0, 14], [8, 2.1, 10], [10, 4.2, 14]]) {
      const f = famAt(omega, yaw), e0 = env0At(omega, yaw);
      const sync = finishMuSolver(createMuSolver(f, e0, target));
      const sliced = createMuSolver(f, e0, target);
      while (!sliced.done) stepMuSolver(sliced);
      expect(sliced.best).toBe(sync.best);
      expect(sliced.it).toBe(sync.it);
    }
  });

  it('solverBudget: a 20-frame schedule finishes the omega 12 / target 14 solve, never above the max', () => {
    const s = createMuSolver(famAt(12, 0), env0At(12, 0), 14);
    let framesLeft = 20, calls = 0, worst = 0;
    while (!s.done && framesLeft > 0) {
      const b = solverBudget(s, framesLeft--);
      expect(b).toBeGreaterThanOrEqual(SOLVER_SUBSTEPS_PER_FRAME);
      expect(b).toBeLessThanOrEqual(SOLVER_SUBSTEPS_MAX);
      const before = s.substeps;
      stepMuSolver(s, b);
      worst = Math.max(worst, s.substeps - before);
      calls++;
    }
    expect(s.done).toBe(true);
    expect(s.landed).toBe(true);
    expect(calls).toBeLessThanOrEqual(20);
    expect(worst).toBeLessThanOrEqual(SOLVER_SUBSTEPS_MAX);
    expect(solverBudget(s, 5)).toBe(0);
    // with one frame left it asks for the ceiling, not more
    expect(solverBudget(createMuSolver(famAt(12, 0), env0At(12, 0), 14), 1)).toBe(SOLVER_SUBSTEPS_MAX);
  });

  it('the bracket holds the calibrated μ/muRef range with >= 3x margin each side, at <= ~10% precision', () => {
    expect(MU_CALIBRATED[0] / (MU_CENTER / MU_SPAN)).toBeGreaterThanOrEqual(3);
    expect((MU_CENTER * MU_SPAN) / MU_CALIBRATED[1]).toBeGreaterThanOrEqual(3);
    expect((2 * Math.log(MU_SPAN)) / 2 ** MU_ITERS).toBeLessThanOrEqual(0.1);
  });

  it('the in-bracket path never needs the climb', () => {
    const s = finishMuSolver(createMuSolver(famAt(12, 0), env0At(12, 0), 14));
    expect(s.landed).toBe(true);
    expect(s.extra).toBe(0);
    expect(s.it).toBe(MU_ITERS);
  });

  it('lands by the target when drag or pxPerUnit move the true pull off the calibration point', () => {
    const cases = [
      { gamma: 32 }, { pxPerUnit: 150 }, { pxPerUnit: 600 },
    ];
    for (const over of cases) {
      const f = famAt(12, 0), e0 = { ...env0At(12, 0), ...over };
      const s = finishMuSolver(createMuSolver(f, e0, 14));
      expect(s.done).toBe(true);
      expect(s.landed).toBe(true);
      expect(absorbTime(f, e0, s.best, 28)).toBeLessThanOrEqual(14 + 1e-9);
    }
  }, 120000);

  it('climbs past the bracket top when the bracket holds no landing, then lands (verified)', () => {
    const f = famAt(12, 0), e0 = { ...env0At(12, 0), gamma: 150 };
    const s = finishMuSolver(createMuSolver(f, e0, 6));
    expect(s.extra).toBeGreaterThanOrEqual(1);
    expect(s.landed).toBe(true);
    expect(s.best).toBeGreaterThan(muRef(7.5) * MU_CENTER * MU_SPAN);
    expect(absorbTime(f, e0, s.best, 12)).toBeLessThanOrEqual(6 + 1e-9);
  }, 120000);

  it('flags landed=false after MU_EXTRA climbs that never land, keeping the largest pull tried', () => {
    const f = famAt(12, 0), e0 = { ...env0At(12, 0), gamma: 400 };
    const s = finishMuSolver(createMuSolver(f, e0, 14));
    expect(s.done).toBe(true);
    expect(s.landed).toBe(false);
    expect(s.extra).toBe(MU_EXTRA);
    expect(s.best).toBeGreaterThan(muRef(7.5) * MU_CENTER * MU_SPAN);
    expect(absorbTime(f, e0, s.best, 14)).toBe(Infinity);
  }, 120000);
});

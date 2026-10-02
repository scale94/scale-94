// src/terminal/mercury/planet/breakupBudget.js — the ~40 s liquid linger as a budget, not a schedule
// (phase-5 spec §4.4; plan amendment P2). The drag is fixed (it keeps the beads on screen); the
// central pull μ is solved by bisection on a headless replay so the LAST drop is fully absorbed by
// the return target. A trial replay is resumable and sliced by SUBSTEPS (SOLVER_SUBSTEPS_PER_FRAME per
// stepMuSolver call), so one frame never pays for a whole replay (spec §4.4: < 4 ms on desktop). The
// first neck snaps ~0.34 s after release; finishMuSolver is the synchronous fallback if it isn't done.

import { SPIN_DAMP_PER_S } from './mercuryBody';
import { R_SCENE } from './planetLook';
import { MERGE_MARGIN_S, MIN_RETURN_S, refreezeIn } from './breakupFamily';
import { stepFamily, DROP_DT } from './breakupStep';

export const MU_ITERS = 6;            // final ln-width = 2 ln(MU_SPAN) / 2^6 = 0.094: <= ~10% precision in μ
export const MU_CENTER = 0.04;          // observed solved μ/muRef over ω 7.6-12, heat 28-120, 6 yaws: 0.0063 … 0.22
export const MU_SPAN = 20;              // bracket: muRef·MU_CENTER / MU_SPAN … × MU_SPAN (0.002 … 0.8: >= 3x margin each side)
export const T_MAX_FACTOR = 1;           // a trial gives up at the target: bisection only needs T <= target
export const SOLVER_SUBSTEPS_PER_FRAME = 350; //  ~1.5 ms on the dev desktop (~4.2 us/substep warm); DROP_DT replay substeps one stepMuSolver call may run

// A bead launched at the threshold surface speed (ω_th R) is exactly on a circular orbit.
export const muRef = (omegaTh) => (omegaTh * R_SCENE) ** 2 * R_SCENE;

export const returnTarget = (heatK, drift) =>
  Math.max(MIN_RETURN_S, Math.min(drift, refreezeIn(heatK) - MERGE_MARGIN_S));

const qMul = (a, b, out) => {
  const ax = a[0], ay = a[1], az = a[2], aw = a[3], bx = b[0], by = b[1], bz = b[2], bw = b[3];
  out[0] = aw * bx + ax * bw + ay * bz - az * by;
  out[1] = aw * by - ax * bz + ay * bw + az * bx;
  out[2] = aw * bz + ax * by - ay * bx + az * bw;
  out[3] = aw * bw - ax * bx - ay * by - az * bz;
  return out;
};

// The replay's world: free spin decays about a fixed axis (recapture ignored — the margin covers it),
// and the planet is the rest sphere.
export function headlessEnv(env0) {
  const w0 = [...env0.omega];
  const W = Math.hypot(w0[0], w0[1], w0[2]);
  const axis = W > 0 ? [w0[0] / W, w0[1] / W, w0[2] / W] : [0, 1, 0];
  const q0 = [...env0.q];
  const dq = [0, 0, 0, 1];
  const env = {
    gamma: env0.gamma, kappa: env0.kappa, vRef: env0.vRef, pxPerUnit: env0.pxPerUnit,
    q: [...q0], omega: [...w0], planetRadiusAt: () => R_SCENE,
  };
  env.at = (t) => {
    const f = Math.exp(-SPIN_DAMP_PER_S * t);
    const th = (W * (1 - f)) / SPIN_DAMP_PER_S;
    const s = Math.sin(th / 2);
    dq[0] = axis[0] * s; dq[1] = axis[1] * s; dq[2] = axis[2] * s; dq[3] = Math.cos(th / 2);
    qMul(dq, q0, env.q);
    env.omega[0] = w0[0] * f; env.omega[1] = w0[1] * f; env.omega[2] = w0[2] * f;
  };
  return env;
}

export const cloneFamily = (fam) => structuredClone(fam);

// One resumable trial: a cloned family replayed at a fixed mu. The single replay loop (absorbTime and
// the solver both use it).
function beginTrial(template, env0, mu, tMax) {
  const fam = cloneFamily(template);
  fam.mu = mu;
  return { fam, env: headlessEnv(env0), mu, tMax };
}
const trialRunning = (tr) => tr.fam.phase === 'fired' && tr.fam.t < tr.tMax;
// Runs up to `budget` substeps; returns how many it ran.
function runTrial(tr, budget) {
  let n = 0;
  while (n < budget && trialRunning(tr)) {
    tr.env.at(tr.fam.t);
    stepFamily(tr.fam, DROP_DT, tr.env);
    tr.fam.events.length = 0;
    n++;
  }
  return n;
}
const trialTime = (tr) => (tr.fam.phase === 'fired' ? Infinity : tr.fam.t);

export function absorbTime(template, env0, mu, tMax) {
  const tr = beginTrial(template, env0, mu, tMax);
  runTrial(tr, Infinity);
  return trialTime(tr);
}

export function createMuSolver(template, env0, target) {
  const m = muRef(env0.omegaTh) * MU_CENTER;
  return {
    lo: Math.log(m / MU_SPAN), hi: Math.log(m * MU_SPAN), it: 0, best: m * MU_SPAN, done: false, target,
    substeps: 0, trial: null,
    template: cloneFamily(template),
    env0: { q: [...env0.q], omega: [...env0.omega], gamma: env0.gamma, kappa: env0.kappa, vRef: env0.vRef, pxPerUnit: env0.pxPerUnit, omegaTh: env0.omegaTh },
  };
}

// Bisection toward the smallest mu (the slowest drift) that still lands the last drop by the target.
// `budget` is a substep budget; an in-progress trial resumes on the next call.
export function stepMuSolver(s, budget = SOLVER_SUBSTEPS_PER_FRAME) {
  let left = budget;
  while (left > 0 && !s.done) {
    if (!s.trial) {
      s.trial = beginTrial(s.template, s.env0, Math.exp(0.5 * (s.lo + s.hi)), s.target * T_MAX_FACTOR);
    }
    const n = runTrial(s.trial, left);
    left -= n;
    s.substeps += n;
    if (trialRunning(s.trial)) break; // out of budget mid-trial
    const mid = Math.log(s.trial.mu);
    if (trialTime(s.trial) <= s.target) { s.best = s.trial.mu; s.hi = mid; } else s.lo = mid;
    s.trial = null;
    if (++s.it >= MU_ITERS) s.done = true;
  }
  return s;
}

export function finishMuSolver(s) {
  while (!s.done) stepMuSolver(s, Infinity);
  return s;
}

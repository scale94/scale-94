// src/terminal/mercury/planet/breakupBudget.js — the ~40 s liquid linger as a budget, not a schedule
// (phase-5 spec §4.4; plan amendment P2). The drag is fixed (it keeps the beads on screen); the
// central pull μ is solved by bisection on a headless replay so the LAST drop is fully absorbed by
// the return target. A trial replay is resumable and sliced by SUBSTEPS (SOLVER_SUBSTEPS_PER_FRAME per
// stepMuSolver call), so one frame never pays for a whole replay (spec §4.4: < 4 ms on desktop). The
// first neck snaps ~0.34 s after release; finishMuSolver is the last resort if it isn't done by then.

import { SPIN_DAMP_PER_S } from './mercuryBody';
import { R_SCENE } from './planetLook';
import { MERGE_MARGIN_S, MIN_RETURN_S, refreezeIn } from './breakupFamily';
import { stepFamily, DROP_DT } from './breakupStep';

export const MU_ITERS = 6;            // final ln-width = 2 ln(MU_SPAN) / 2^6 = 0.097: <= ~10% precision in μ
// Bracket calibrated at ONE point (gamma 8, kappa 0.1, pxPerUnit 300, r0 0.035 R; re-run 2026-10-02 for the author's
// r0 0.025 → 0.035): the solved μ/muRef over ω 7.6-12, heat 28-120, 6 yaws, tier caps 12 and 16 was 0.00675 … 0.344
// (at r0 0.025, kappa 0.03 it was 0.0063 … 0.22). dropDrag/dropCohesion/pxPerUnit move it, so the bracket is only a
// first guess: if nothing lands inside it, the solver climbs (see MU_EXTRA).
export const MU_CENTER = 0.048;         // the geometric centre of the calibrated range
export const MU_SPAN = 22;              // bracket: muRef·MU_CENTER / MU_SPAN … × MU_SPAN (0.0022 … 1.06: >= 3x margin each side at the calibration point)
export const MU_CALIBRATED = [0.00675, 0.344]; // the measured range above (the margin test pins the bracket against it)
export const MU_EXTRA = 4;              // extra upward trials if the bracket held no landing
export const MU_EXTRA_K = 4;            // each extra trial is this × stronger than the last (top·K, top·K², … top·K^MU_EXTRA; top itself was never trialled)
export const T_MAX_FACTOR = 1;          // a trial gives up at the target: bisection only needs T <= target
export const SOLVER_SUBSTEPS_PER_FRAME = 350; // ~1.5 ms on the dev desktop (~4.2 us/substep warm): the per-frame FLOOR
export const SOLVER_SUBSTEPS_MAX = 800;       // ~3.4 ms on the dev desktop: the per-frame CEILING for solverBudget (was 900; the worst 20-frame solve sat on it)

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
  return { fam, env: headlessEnv(env0), mu, tMax, n: 0, ext: false };
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
  tr.n += n;
  return n;
}
const trialTime = (tr) => (tr.fam.phase === 'fired' ? Infinity : tr.fam.t);

export function absorbTime(template, env0, mu, tMax) {
  const tr = beginTrial(template, env0, mu, tMax);
  runTrial(tr, Infinity);
  return trialTime(tr);
}

// Solver fields: { lo, hi, it, best, done, landed, extra, top, substeps, trial, template, env0, target }.
// `landed` is true when `best` was verified (a replay absorbed the last drop by the target). If it is
// false after `done`, no trial up to MU_EXTRA_K^MU_EXTRA x the bracket top landed: `best` is the largest
// μ tried and the caller should treat the return as best-effort (it may come home after the target).
export function createMuSolver(template, env0, target) {
  const m = muRef(env0.omegaTh) * MU_CENTER;
  return {
    lo: Math.log(m / MU_SPAN), hi: Math.log(m * MU_SPAN), it: 0, best: m * MU_SPAN, done: false, target,
    landed: false, extra: 0, top: Math.log(m * MU_SPAN),
    substeps: 0, trial: null,
    template: cloneFamily(template),
    env0: { q: [...env0.q], omega: [...env0.omega], gamma: env0.gamma, kappa: env0.kappa, vRef: env0.vRef, pxPerUnit: env0.pxPerUnit, omegaTh: env0.omegaTh },
  };
}

// Bisection toward the smallest mu (the slowest drift) that still lands the last drop by the target.
// If the MU_ITERS bisection trials landed nothing, climb geometrically from the bracket top (at most
// MU_EXTRA trials). `budget` is a substep budget; an in-progress trial resumes on the next call.
export function stepMuSolver(s, budget = SOLVER_SUBSTEPS_PER_FRAME) {
  let left = budget;
  while (left > 0 && !s.done) {
    if (!s.trial) {
      const ext = s.it >= MU_ITERS;
      const mu = ext ? Math.exp(s.top + (s.extra + 1) * Math.log(MU_EXTRA_K)) : Math.exp(0.5 * (s.lo + s.hi));
      s.trial = beginTrial(s.template, s.env0, mu, s.target * T_MAX_FACTOR);
      s.trial.ext = ext;
    }
    const n = runTrial(s.trial, left);
    left -= n;
    s.substeps += n;
    if (trialRunning(s.trial)) break; // out of budget mid-trial
    const tr = s.trial;
    const ok = trialTime(tr) <= s.target;
    s.trial = null;
    if (tr.ext) {
      s.extra++;
      if (ok) { s.best = tr.mu; s.landed = true; s.done = true; } else {
        s.best = tr.mu; // largest tried so far
        if (s.extra >= MU_EXTRA) s.done = true;
      }
    } else {
      if (ok) { s.best = tr.mu; s.landed = true; s.hi = Math.log(tr.mu); } else s.lo = Math.log(tr.mu);
      if (++s.it >= MU_ITERS && s.landed) s.done = true;
    }
  }
  return s;
}

// Substeps to run this frame so the solve finishes within `framesLeft` frames (front-loaded: the
// remaining work is bounded above by every pending trial running to the target). Clamped to
// [SOLVER_SUBSTEPS_PER_FRAME, SOLVER_SUBSTEPS_MAX]. A solver that cannot make it still gets
// finishMuSolver as the last resort.
export function solverBudget(s, framesLeft) {
  if (s.done) return 0;
  const perTrial = Math.ceil((s.target * T_MAX_FACTOR) / DROP_DT) + 2; // +2: float accumulation of t can overshoot by a step
  const trialsLeft = s.it < MU_ITERS ? MU_ITERS - s.it : Math.max(0, MU_EXTRA - s.extra);
  const est = Math.max(0, trialsLeft * perTrial - (s.trial ? s.trial.n : 0));
  const base = Math.ceil(est / Math.max(1, framesLeft));
  return Math.min(SOLVER_SUBSTEPS_MAX, Math.max(SOLVER_SUBSTEPS_PER_FRAME, base));
}

export function finishMuSolver(s) {
  while (!s.done) stepMuSolver(s, Infinity);
  return s;
}

// src/terminal/mercury/planet/breakupBudget.js — the ~40 s liquid linger as a budget, not a schedule
// (phase-5 spec §4.4; plan amendment P2). The drag is fixed (it keeps the beads on screen); the
// central pull μ is solved by bisection on a headless replay so the LAST drop is fully absorbed by
// the return target. A trial replay is resumable and sliced by SUBSTEPS (SOLVER_SUBSTEPS_PER_FRAME per
// stepMuSolver call), so one frame never pays for a whole replay (spec §4.4: < 4 ms on desktop). The
// first neck snaps ~0.34 s after release; finishMuSolver is the last resort if it isn't done by then.
// Phase 6 (hyper): the same solver bisects the aether headwind η on test particles (spec §3.6).

import { SPIN_DAMP_PER_S } from './mercuryBody';
import { R_SCENE } from './planetLook';
import { MERGE_MARGIN_S, MIN_RETURN_S, refreezeIn } from './breakupFamily';
import { stepFamily, DROP_DT, hyperAccel, cascadeDuration } from './breakupStep';
import {
  ETA_LO, ETA_HI, ETA_ITERS,
} from './hyperFling';

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

// Phase 6 (hyper): a test-particle substep for N beads costs ceil(N / PARTICLES_PER_UNIT) budget units, a unit
// being ~one phase-5 substep of cost (re-measured with HYPER_BENCH=1; see the plan's Task 5).
// 2026-10-02 dev desktop, 3 runs: phase-5 substep 3.55-4.14 us, particle step 0.080-0.084 us (ratio 43-52; the
// lowest run rounded down to a multiple of 16).
export const PARTICLES_PER_UNIT = 32;
export const trialWeight = (fam) => (fam.hyper ? Math.ceil(fam.bodies.length / PARTICLES_PER_UNIT) : 1);

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

// Phase 6: the hyper family replayed on independent test particles (spec §3.6): gravity + the vortex drag
// (breakupStep.hyperAccel, so the paths agree with the live flight), no cohesion, no merges, no bead–bead
// collisions; a bead arrives at the smallest core after the grace and its cascade is added in closed form.
// Every simplification makes it arrive later, so the solved headwind errs early.
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const _pa = [0, 0, 0];

export function beginParticles(template, pxPerUnit, { eta, gamma, tMax, only = null, track = false }) {
  const B = template.bodies;
  const idx = only ?? B.map((_, i) => i);
  const n = idx.length;
  const L = template.axisL;
  const e1 = unit3(cross3(Math.abs(L[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], L));
  const e2 = cross3(L, e1);
  const tr = {
    kind: 'particles', x: eta, eta, gamma, tMax, n: 0, ext: false, t: 0, w: trialWeight(template),
    mu: template.mu, L: [L[0], L[1], L[2]], rC0: template.rC0, tGrace: template.tGrace, pxPerUnit, tcScale: template.tcScale ?? 1,
    count: n, left: n, tEnd: 0, rMax: 0, track, e1, e2,
    p: new Float64Array(3 * n), v: new Float64Array(3 * n), r: new Float64Array(n), out: new Float64Array(n).fill(-1),
    ang: new Float64Array(n), turns: new Float64Array(n),
  };
  for (let k = 0; k < n; k++) {
    const b = B[idx[k]];
    for (let c = 0; c < 3; c++) { tr.p[3 * k + c] = b.p[c]; tr.v[3 * k + c] = b.v[c]; }
    tr.r[k] = b.r;
    if (track) tr.ang[k] = Math.atan2(b.p[0] * e2[0] + b.p[1] * e2[1] + b.p[2] * e2[2], b.p[0] * e1[0] + b.p[1] * e1[1] + b.p[2] * e1[2]);
  }
  return tr;
}

const particlesRunning = (tr) => tr.left > 0 && tr.t < tr.tMax;
const particlesTime = (tr) => (tr.left === 0 ? tr.tEnd : Infinity);

// Runs whole particle substeps while `budget` units allow; returns the units spent.
export function runParticles(tr, budget) {
  let n = 0;
  const P = tr.p, V = tr.v, h = DROP_DT;
  while (n + tr.w <= budget && particlesRunning(tr)) {
    tr.t += h;
    for (let i = 0; i < tr.count; i++) {
      if (tr.out[i] >= 0) continue;
      const j = 3 * i;
      hyperAccel(tr.mu, tr.eta, tr.gamma, tr.L, P[j], P[j + 1], P[j + 2], V[j], V[j + 1], V[j + 2], tr.rC0, h, _pa);
      V[j] += _pa[0] * h; V[j + 1] += _pa[1] * h; V[j + 2] += _pa[2] * h;
      P[j] += V[j] * h; P[j + 1] += V[j + 1] * h; P[j + 2] += V[j + 2] * h;
      const r = Math.hypot(P[j], P[j + 1], P[j + 2]);
      if (r > tr.rMax) tr.rMax = r;
      if (tr.track) {
        const e1 = tr.e1, e2 = tr.e2;
        const an = Math.atan2(P[j] * e2[0] + P[j + 1] * e2[1] + P[j + 2] * e2[2], P[j] * e1[0] + P[j + 1] * e1[1] + P[j + 2] * e1[2]);
        let d = an - tr.ang[i];
        if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI;
        tr.turns[i] += d;
        tr.ang[i] = an;
      }
      if (tr.t >= tr.tGrace && r <= tr.rC0 + tr.r[i]) {
        const T = tr.t + cascadeDuration(tr.r[i], tr.pxPerUnit, tr.tcScale);
        tr.out[i] = T;
        tr.left--;
        if (T > tr.tEnd) tr.tEnd = T;
      }
    }
    n += tr.w;
  }
  tr.n += n;
  return n;
}

// Turns about L̂ each bead makes before it arrives (or by tMax): the spiral gate's measure (spec §3.5).
export function particleTurns(template, pxPerUnit, eta, tMax) {
  const tr = beginParticles(template, pxPerUnit, { eta, gamma: template.gammaH, tMax, track: true });
  runParticles(tr, Infinity);
  return Array.from(tr.turns, (a) => Math.abs(a) / (2 * Math.PI));
}

// One resumable trial: a phase-5 family replayed at a fixed μ, or a hyper family as test particles at a fixed η.
// `x` is the trialled value either way. The single replay loop (absorbTime and the solver both use it).
function beginTrial(template, env0, x, tMax) {
  if (template.hyper) return beginParticles(template, env0.pxPerUnit, { eta: x, gamma: template.gammaH, tMax });
  const fam = cloneFamily(template);
  fam.mu = x;
  return { kind: 'family', fam, env: headlessEnv(env0), x, tMax, n: 0, ext: false };
}
const trialRunning = (tr) => (tr.kind === 'particles' ? particlesRunning(tr) : tr.fam.phase === 'fired' && tr.fam.t < tr.tMax);
// Runs up to `budget` units; returns how many it ran (a family substep is one unit).
function runTrial(tr, budget) {
  if (tr.kind === 'particles') return runParticles(tr, budget);
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
const trialTime = (tr) => {
  if (tr.kind === 'particles') return particlesTime(tr);
  return tr.fam.phase === 'fired' ? Infinity : tr.fam.t;
};

export function absorbTime(template, env0, mu, tMax) {
  const tr = beginTrial(template, env0, mu, tMax);
  runTrial(tr, Infinity);
  return trialTime(tr);
}

// Solver fields: { kind, iters, maxExtra, weight, lo, hi, it, best, done, landed, extra, top, substeps, trial,
// template, env0, target }. kind 'mu' (phase 5): ln-μ bisection with an upward climb. kind 'eta' (hyper,
// spec §3.6): ln-η bisection over [ETA_LO, ETA_HI], no climb. `landed` is true when `best` was verified (a
// replay brought the last drop home by the target). If it is false after `done`, `best` is the largest value
// tried (μ) or ETA_HI (η), and the caller treats the return as best-effort.
export function createMuSolver(template, env0, target) {
  const hyper = !!template.hyper;
  const m = muRef(env0.omegaTh) * MU_CENTER;
  const lo = hyper ? Math.log(ETA_LO) : Math.log(m / MU_SPAN);
  const hi = hyper ? Math.log(ETA_HI) : Math.log(m * MU_SPAN);
  return {
    kind: hyper ? 'eta' : 'mu', iters: hyper ? ETA_ITERS : MU_ITERS, maxExtra: hyper ? 0 : MU_EXTRA, weight: trialWeight(template),
    lo, hi, it: 0, best: Math.exp(hi), done: false, target,
    landed: false, extra: 0, top: hi,
    substeps: 0, trial: null,
    template: cloneFamily(template),
    env0: { q: [...env0.q], omega: [...env0.omega], gamma: env0.gamma, kappa: env0.kappa, vRef: env0.vRef, pxPerUnit: env0.pxPerUnit, omegaTh: env0.omegaTh },
  };
}

// Bisection toward the smallest value (the slowest return) that still lands the last drop by the target. For μ,
// if the MU_ITERS bisection trials landed nothing, climb geometrically from the bracket top (at most MU_EXTRA
// trials). `budget` is in units; an in-progress trial resumes on the next call.
export function stepMuSolver(s, budget = SOLVER_SUBSTEPS_PER_FRAME) {
  let left = budget;
  while (left > 0 && !s.done) {
    if (!s.trial) {
      const ext = s.it >= s.iters;
      const x = ext ? Math.exp(s.top + (s.extra + 1) * Math.log(MU_EXTRA_K)) : Math.exp(0.5 * (s.lo + s.hi));
      s.trial = beginTrial(s.template, s.env0, x, s.target * T_MAX_FACTOR);
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
      if (ok) { s.best = tr.x; s.landed = true; s.done = true; } else {
        s.best = tr.x; // largest tried so far
        if (s.extra >= s.maxExtra) s.done = true;
      }
    } else {
      if (ok) { s.best = tr.x; s.landed = true; s.hi = Math.log(tr.x); } else s.lo = Math.log(tr.x);
      if (++s.it >= s.iters && (s.landed || s.maxExtra === 0)) s.done = true;
    }
  }
  return s;
}

// Units to run this frame so the solve finishes within `framesLeft` frames (front-loaded: the remaining work is
// bounded above by every pending trial running to the target). Clamped to [SOLVER_SUBSTEPS_PER_FRAME,
// SOLVER_SUBSTEPS_MAX]. A solver that cannot make it still gets finishMuSolver as the last resort.
export function solverBudget(s, framesLeft) {
  if (s.done) return 0;
  const perTrial = (Math.ceil((s.target * T_MAX_FACTOR) / DROP_DT) + 2) * s.weight; // +2: float accumulation of t can overshoot by a step
  const trialsLeft = s.it < s.iters ? s.iters - s.it : Math.max(0, s.maxExtra - s.extra);
  const est = Math.max(0, trialsLeft * perTrial - (s.trial ? s.trial.n : 0));
  const base = Math.ceil(est / Math.max(1, framesLeft));
  return Math.min(SOLVER_SUBSTEPS_MAX, Math.max(SOLVER_SUBSTEPS_PER_FRAME, base));
}

export function finishMuSolver(s) {
  while (!s.done) stepMuSolver(s, Infinity);
  return s;
}

// src/terminal/mercury/planet/hyperFling.js — the hyper-fling: the core itself breaks (phase-6 spec §3,
// Amendments V1–V4; plan amendments A1–A2). Pure and three.js-free like the phase-5 sim: breakupBudget replays
// a hyper family on test particles. Vectors [x, y, z] in the world frame.

import { MAX_OMEGA } from './mercuryBody';
import { R_SCENE } from './planetLook';
import { PX_FLOOR, sphereVol } from './breakupPhysics';
import { addBody } from './breakupFamily';
import { WOB_BIRTH, DROP_DT, hyperAccel, cascadeDuration } from './breakupStep';

// Trigger (§3.1, V2). V_HYPER / V_HYPER_SPAN are provisional until the Gate 0 swipe readout sets them.
export const HYPER_OMEGA_FRAC = 0.98;  // the spin must be pinned at the cap…
export const V_HYPER = 30;             // …and the release pointer ω (rad/s, mercuryDrag) at least this
export const V_HYPER_SPAN = 30;        // eH ramps 0 → 1 over this much more
// Mass split (§3.2).
export const HYPER_RBAR_LO = 0.06;     // the beads' volume-mean radius × R at eH 0… (V4 §10.1: the size is the knob,
export const HYPER_RBAR_HI = 0.08;     // …and at eH 1; ≈ 0.4–1.2 % of the planet flies, the core keeps the rest)
export const HYPER_N = Object.freeze({ full: 32, phone: 14, lite: 0 }); // 6a clamps these to TIERS[t].drop.bodies
export const HYPER_FRAG_N = 4;         // gamma shape of the radius spread (ligament-mediated fragmentation)
export const HYPER_R_MAX_K = 1.8;      // the largest bead, × the volume-mean radius r̄ (relative: absolute caps cannot conserve at N 8)
// Launch (§3.3, V3).
export const HYPER_EQ_BIAS = 0.64;     // latitude squeeze toward the spin plane (V4: the simulated disc)
export const HYPER_GRACE_S = 0.25;     // no collision of any kind before this (beads are born touching)
export const T_BURST = 0.15;           // the core shrinks to its share over this long
// Return (§3.5, V1) and its solves (§3.6; plan amendment A2: they live here, breakupBudget imports them).
export const HYPER_VIS_K = 0.85;       // stay inside this share of the visible half-extent…
export const HYPER_REACH_MIN_R = 1.45; // …but never contain tighter than this × R (V4: a full-size core leaves no annulus at 1.25 in phone portrait)
export const HYPER_GAMMA = 20;         // the vortex drag, 1/s (V4: fixed; explicit drag is stable below 2/h ≈ 240)
export const HYPER_AIM_S = 0.6;        // each bead's launch is aimed to settle at its radius after this long (§10.2)
export const HYPER_HANG_K = 0.5;       // the disc orbits for this share of the return target before the gather (§10.3)
export const ETA_LO = 1e-3;            // headwind bracket: ln-bisection over [ETA_LO, ETA_HI]
export const ETA_HI = 1;               // (η = 1: a still aether, plain drag; also the provisional value while solving)
export const HYPER_CASCADE_S = 1.5;    // the largest bead's whole cascade takes this many display s (each stage keeps its r^1.5 share; V4 §10.6: was 3)
export const HYPER_MIN_TARGET_S = 9; // hyper needs room for orbit + gather + cascade: hotter planets (shorter return) break the Phase 5 way (V4 §10.6)
export const ETA_ITERS = 8;            // final ratio 1000^(1/256) ≈ 1.027

export const V0 = sphereVol(R_SCENE);

export const hyperEnergy = (ptrOmega) => Math.min(1, Math.max(0, (ptrOmega - V_HYPER) / V_HYPER_SPAN));

export function canHyper({ omega, ptrOmega, nMax, target }) {
  return nMax > 0 && omega >= HYPER_OMEGA_FRAC * MAX_OMEGA && ptrOmega >= V_HYPER && target >= HYPER_MIN_TARGET_S;
}

// Deterministic per seed, so the live family and every solver replay see the same swarm.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Gamma(n, mean 1) for integer n (Erlang): the mean of n unit exponentials.
export function gammaMean1(rng, n) {
  let s = 0;
  for (let k = 0; k < n; k++) s -= Math.log(1 - rng());
  return s / n;
}

// The micro-core's share and the beads' radii (§3.2): a gamma spread rescaled to the exact fragment volume,
// floor/ceiling-clamped with the rest renormalised until nothing more clamps.
export function splitMass(N, eH, seed, pxPerUnit) {
  const rBar = R_SCENE * (HYPER_RBAR_LO + (HYPER_RBAR_HI - HYPER_RBAR_LO) * eH);
  const vFrag = N * sphereVol(rBar);
  const fC = 1 - vFrag / V0;
  const rng = mulberry32(seed);
  const radii = new Array(N);
  for (let i = 0; i < N; i++) radii[i] = gammaMean1(rng, HYPER_FRAG_N);
  const lo = PX_FLOOR / pxPerUnit, hi = HYPER_R_MAX_K * rBar;
  const fixed = new Array(N).fill(false);
  for (let pass = 0; pass < 16; pass++) {
    let vFix = 0, vFree = 0;
    for (let i = 0; i < N; i++) { if (fixed[i]) vFix += sphereVol(radii[i]); else vFree += sphereVol(radii[i]); }
    if (!(vFree > 0)) break;
    const k = Math.cbrt((vFrag - vFix) / vFree);
    let clamped = false;
    for (let i = 0; i < N; i++) {
      if (fixed[i]) continue;
      radii[i] *= k;
      if (radii[i] < lo) { radii[i] = lo; fixed[i] = true; clamped = true; } else if (radii[i] > hi) { radii[i] = hi; fixed[i] = true; clamped = true; }
    }
    if (!clamped) break;
  }
  return { fC, rC0: R_SCENE * Math.cbrt(fC), vFrag, rBar, radii };
}

// The pull is set by a look knob, not solved (V1): the orbital period at the old surface.
export const hyperMu = (orbitS) => (4 * Math.PI * Math.PI * R_SCENE ** 3) / (orbitS * orbitS);

// How far out a bead may orbit (§3.5; plan amendment A1).
export const hyperReach = (rVis) => Math.max(HYPER_VIS_K * rVis, HYPER_REACH_MIN_R * R_SCENE);

const len3 = (v) => Math.hypot(v[0], v[1], v[2]);

// A bead's radial kick so that, launched at ω × p + k p̂ and replayed alone under the vortex at η 0 for HYPER_AIM_S,
// it ends at radius rT (§10.2). The settle radius rises with k, so bisect. Fire time only; scratch is module-level.
const AIM_K_LO = -20, AIM_K_HI = 60, AIM_ITERS = 24;
const AIM_STEPS = Math.round(HYPER_AIM_S / DROP_DT);
const _ap = [0, 0, 0], _av = [0, 0, 0], _aa = [0, 0, 0];
function aimKick(mu, L, rC, p, d, omega, rT) {
  const settle = (k) => {
    for (let c = 0; c < 3; c++) _ap[c] = p[c];
    _av[0] = omega[1] * p[2] - omega[2] * p[1] + k * d[0];
    _av[1] = omega[2] * p[0] - omega[0] * p[2] + k * d[1];
    _av[2] = omega[0] * p[1] - omega[1] * p[0] + k * d[2];
    for (let i = 0; i < AIM_STEPS; i++) {
      hyperAccel(mu, 0, HYPER_GAMMA, L, _ap[0], _ap[1], _ap[2], _av[0], _av[1], _av[2], rC, DROP_DT, _aa);
      for (let c = 0; c < 3; c++) { _av[c] += _aa[c] * DROP_DT; _ap[c] += _av[c] * DROP_DT; }
    }
    return len3(_ap);
  };
  // an unreachable radius returns the nearer end of the bracket
  if (settle(AIM_K_LO) >= rT) return AIM_K_LO;
  if (settle(AIM_K_HI) <= rT) return AIM_K_HI;
  let lo = AIM_K_LO, hi = AIM_K_HI;
  for (let it = 0; it < AIM_ITERS; it++) {
    const mid = 0.5 * (lo + hi);
    if (settle(mid) < rT) lo = mid; else hi = mid;
  }
  return hi;
}

// The launch (§3.3, V4 §10.2): N small beads on a jittered Fibonacci sphere squeezed toward the spin plane, born
// just inside the old surface, each aimed to settle at a seeded radius in the annulus between the core and the
// reach. The swarm's momentum is balanced by the core (≈ 99 % of the mass; the recoil is negligible and not
// simulated), so no mean velocity is removed. The vortex axis is the
// spin axis, the drag is fixed, the hang is a share of the return target; the caller solves the gather headwind.
export function fireHyper(fam, { N, eH, seed, omega, pxPerUnit, orbitS, reach, target }) {
  const m = splitMass(N, eH, seed, pxPerUnit);
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const W = len3(omega);
  const z = W > 1e-6 ? [omega[0] / W, omega[1] / W, omega[2] / W] : [0, 1, 0];
  const a = Math.abs(z[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const xr = [a[1] * z[2] - a[2] * z[1], a[2] * z[0] - a[0] * z[2], a[0] * z[1] - a[1] * z[0]];
  const xl = len3(xr);
  const x = [xr[0] / xl, xr[1] / xl, xr[2] / xl];
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  const mu = hyperMu(orbitS);

  fam.bodies.length = 0; fam.necks.length = 0; fam.events.length = 0;
  Object.assign(fam, {
    phase: 'fired', hyper: true, t: 0, acc: 0, volResidual: 0, L: 0, e: 0, N, seed,
    tGrace: HYPER_GRACE_S, tHang: HYPER_HANG_K * target, rC0: m.rC0, mu, eta: ETA_HI, gammaH: HYPER_GAMMA,
    axisL: [z[0], z[1], z[2]],
  });
  const golden = Math.PI * (3 - Math.sqrt(5));
  let V = 0;
  for (let i = 0; i < N; i++) {
    const r = m.radii[i];
    const c0 = Math.min(1, Math.max(-1, 1 - (2 * (i + 0.5)) / N + (rng() - 0.5) * (2 / N)));
    const c = (1 - HYPER_EQ_BIAS) * c0;
    const s = Math.sqrt(1 - c * c);
    const ph = i * golden + 0.5 * rng();
    const d = [
      x[0] * s * Math.cos(ph) + y[0] * s * Math.sin(ph) + z[0] * c,
      x[1] * s * Math.cos(ph) + y[1] * s * Math.sin(ph) + z[1] * c,
      x[2] * s * Math.cos(ph) + y[2] * s * Math.sin(ph) + z[2] * c,
    ];
    const rho = R_SCENE - r;
    const p = [d[0] * rho, d[1] * rho, d[2] * rho];
    const lo = m.rC0 + 2.2 * r + 0.02, hi = reach - r - 0.03;
    const rT = hi > lo ? lo + (hi - lo) * rng() : lo;
    const k = aimKick(mu, fam.axisL, m.rC0, p, d, omega, rT);
    const v = [
      omega[1] * p[2] - omega[2] * p[1] + k * d[0],
      omega[2] * p[0] - omega[0] * p[2] + k * d[1],
      omega[0] * p[1] - omega[1] * p[0] + k * d[2],
    ];
    const vol = sphereVol(r);
    addBody(fam, { state: 'free', p, v, r, rMain: r, vol, tFree: 0, wobAmp: WOB_BIRTH, wobAxis: [d[0], d[1], d[2]], aimR: rT });
    V += vol;
  }
  fam.volFamily = V;
  fam.volOut = V;
  fam.vRefH = V / N; // cohesion's reference volume for this family: its mean bead (breakupStep.flight)
  let rMax = 0;
  for (const b of fam.bodies) if (b.r > rMax) rMax = b.r;
  fam.tcScale = Math.min(1, HYPER_CASCADE_S / cascadeDuration(rMax, pxPerUnit));
  return fam;
}

// The planet's visible scale (§3.4): 1 unless a hyper family is out; eased to the core's share over T_BURST,
// then the core regrows as the cascade drains beads back into it (fam.volOut falls).
export function coreScale(fam) {
  if (!fam.hyper || fam.phase !== 'fired') return 1;
  const sTrue = Math.cbrt(Math.max(V0 - fam.volOut, 0) / V0);
  const u = Math.min(1, fam.t / T_BURST);
  return 1 + (sTrue - 1) * u * u * (3 - 2 * u);
}

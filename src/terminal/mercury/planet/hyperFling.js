// src/terminal/mercury/planet/hyperFling.js — the hyper-fling: the core itself breaks (phase-6 spec §3,
// Amendments V1–V3; plan amendments A1–A2). Pure and three.js-free like the phase-5 sim: breakupBudget replays
// a hyper family on test particles. Vectors [x, y, z] in the world frame.

import { MAX_OMEGA } from './mercuryBody';
import { R_SCENE } from './planetLook';
import { PX_FLOOR, sphereVol } from './breakupPhysics';
import { addBody } from './breakupFamily';
import { WOB_BIRTH } from './breakupStep';

// Trigger (§3.1, V2). V_HYPER / V_HYPER_SPAN are provisional until the Gate 0 swipe readout sets them.
export const HYPER_OMEGA_FRAC = 0.98;  // the spin must be pinned at the cap…
export const V_HYPER = 30;             // …and the release pointer ω (rad/s, mercuryDrag) at least this
export const V_HYPER_SPAN = 30;        // eH ramps 0 → 1 over this much more
// Mass split (§3.2).
export const F_CORE_MAX = 0.08;        // the micro-core's share of V0 at eH 0…
export const F_CORE_MIN = 0.03;        // …and at eH 1
export const HYPER_N = Object.freeze({ full: 32, phone: 14, lite: 0 }); // 6a clamps these to TIERS[t].drop.bodies
export const HYPER_FRAG_N = 4;         // gamma shape of the radius spread (ligament-mediated fragmentation)
export const HYPER_R_MAX_K = 1.8;      // the largest bead, × the volume-mean radius r̄ (relative: absolute caps cannot conserve at N 8)
// Launch (§3.3, V3).
export const HYPER_EQ_BIAS = 0.4;      // latitude squeeze toward the spin equator
export const HYPER_GRACE_S = 0.25;     // no collision of any kind before this (beads are born touching)
export const T_BURST = 0.15;           // the core shrinks to its share over this long
// Return (§3.5, V1) and its solves (§3.6; plan amendment A2: they live here, breakupBudget imports them).
export const HYPER_VIS_K = 0.85;       // stay inside this share of the visible half-extent…
export const HYPER_REACH_MIN_R = 1.25; // …but never contain tighter than this × R (plan amendment A1: phone portrait)
export const HYPER_GAMMA_MAX = 500;    // containment drag bracket top, 1/s
export const HYPER_GAMMA_ITERS = 10;
export const HYPER_CONTAIN_K = 4;      // the fastest beads set the excursion
export const HYPER_CONTAIN_S = 3;      // replayed this long at η = 0 (the widest orbits)
export const ETA_LO = 1e-3;            // headwind bracket: ln-bisection over [ETA_LO, ETA_HI]
export const ETA_HI = 1;               // (η = 1: a still aether, plain drag; also the provisional value while solving)
export const ETA_ITERS = 8;            // final ratio 1000^(1/256) ≈ 1.027

export const V0 = sphereVol(R_SCENE);

export const hyperEnergy = (ptrOmega) => Math.min(1, Math.max(0, (ptrOmega - V_HYPER) / V_HYPER_SPAN));

export function canHyper({ omega, ptrOmega, nMax }) {
  return nMax > 0 && omega >= HYPER_OMEGA_FRAC * MAX_OMEGA && ptrOmega >= V_HYPER;
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
  const fC = F_CORE_MAX + (F_CORE_MIN - F_CORE_MAX) * eH;
  const vFrag = (1 - fC) * V0;
  const rng = mulberry32(seed);
  const radii = new Array(N);
  for (let i = 0; i < N; i++) radii[i] = gammaMean1(rng, HYPER_FRAG_N);
  const rBar = Math.cbrt(vFrag / (N * (4 / 3) * Math.PI));
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

// The launch (§3.3): N beads on a jittered Fibonacci sphere squeezed toward the spin equator, born just inside
// the old surface, flung at ω × p plus a radial burst (small beads faster), the swarm's mean velocity removed so
// its centre of mass stays at the pull's centre. Sets the vortex axis L̂, the pull and provisional drag/headwind;
// the caller solves the containment drag (breakupBudget.solveContainment) and the headwind (the μ/η solver).
export function fireHyper(fam, { N, eH, seed, omega, pxPerUnit, vR0, orbitS, gammaFloor }) {
  const m = splitMass(N, eH, seed, pxPerUnit);
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const W = len3(omega);
  const z = W > 1e-6 ? [omega[0] / W, omega[1] / W, omega[2] / W] : [0, 1, 0];
  const a = Math.abs(z[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const xr = [a[1] * z[2] - a[2] * z[1], a[2] * z[0] - a[0] * z[2], a[0] * z[1] - a[1] * z[0]];
  const xl = len3(xr);
  const x = [xr[0] / xl, xr[1] / xl, xr[2] / xl];
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];

  fam.bodies.length = 0; fam.necks.length = 0; fam.events.length = 0;
  Object.assign(fam, {
    phase: 'fired', hyper: true, t: 0, acc: 0, volResidual: 0, L: 0, e: 0, N, seed,
    tGrace: HYPER_GRACE_S, rC0: m.rC0, mu: hyperMu(orbitS), eta: ETA_HI, gammaH: gammaFloor,
  });
  const golden = Math.PI * (3 - Math.sqrt(5));
  let V = 0;
  const mv = [0, 0, 0];
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
    const vr = vR0 * (1 + eH) * Math.sqrt(m.rBar / r);
    const v = [
      omega[1] * p[2] - omega[2] * p[1] + vr * d[0],
      omega[2] * p[0] - omega[0] * p[2] + vr * d[1],
      omega[0] * p[1] - omega[1] * p[0] + vr * d[2],
    ];
    const vol = sphereVol(r);
    addBody(fam, { state: 'free', p, v, r, rMain: r, vol, tFree: 0, wobAmp: WOB_BIRTH, wobAxis: [d[0], d[1], d[2]] });
    for (let k = 0; k < 3; k++) mv[k] += vol * v[k];
    V += vol;
  }
  const Lm = [0, 0, 0];
  for (const b of fam.bodies) {
    for (let k = 0; k < 3; k++) b.v[k] -= mv[k] / V;
    Lm[0] += b.vol * (b.p[1] * b.v[2] - b.p[2] * b.v[1]);
    Lm[1] += b.vol * (b.p[2] * b.v[0] - b.p[0] * b.v[2]);
    Lm[2] += b.vol * (b.p[0] * b.v[1] - b.p[1] * b.v[0]);
  }
  const ll = len3(Lm);
  fam.axisL = ll > 1e-12 ? [Lm[0] / ll, Lm[1] / ll, Lm[2] / ll] : [z[0], z[1], z[2]];
  fam.volFamily = V;
  fam.volOut = V;
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

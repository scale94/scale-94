// src/terminal/mercury/planet/breakupPhysics.js — the laws the breakup runs on (phase-5 spec §3, §5, §6).
//
// CONVENTION (plan amendment P1): the droplets are ~20× smaller than the 1 cm planet bead, so at
// MODE_PLAYBACK their pinch-off and coalescence would be over in a frame or two. Like the body
// modes (1/6) and the ripples (1/40), the droplet family gets its own playback, DROP_PLAYBACK,
// anchored so the thread's capillary time reads DROP_TC_ANCHOR_S on screen. Inside the family the
// physics holds: every duration is t_c(r) ∝ r^1.5 or a fixed multiple of it.
// Lengths are scene units (R_SCENE = the 1 cm bead); times are display seconds.

import { HG_SIGMA_N_PER_M as SIGMA, HG_RHO_KG_M3 as RHO, DROP_R_M } from './mercuryWaves';
import { R_SCENE } from './planetLook';

export const M_PER_UNIT = DROP_R_M / R_SCENE;
export const TONGUE_ROOT_R = 0.035 * R_SCENE;   // thread radius r0 (≈ 7 px on desktop; author 2026-10-02: 0.025 → 0.035, beads read)
export const TONGUE_MAX_R = 1.12 * R_SCENE;     // tongue length at full excess (P4: 0.8 R at r0 0.025; scaled with r0 so L/λ, the max N, holds)
export const RP_LAMBDA_PER_R = 9.02;            // fastest-growing Rayleigh–Plateau wavelength / thread radius
export const SAT_RATIO = 0.3;                   // satellite radius / main bead radius
export const DAUGHTER_RATIO = 0.5;              // partial coalescence: daughter radius / parent
export const PINCH_EXP = 2 / 3;                 // inviscid pinch-off: h ∝ (t0 − t)^(2/3)
export const BRIDGE_C = 1.6;                    // inertial coalescence prefactor
export const PX_FLOOR = 1.5;                    // nothing is a distinct body below this many px of radius
export const DROP_TC_ANCHOR_S = 0.4;            // the thread's capillary time on screen

export const sphereVol = (r) => (4 / 3) * Math.PI * r * r * r;
export const radiusOfVol = (v) => Math.cbrt((3 * Math.max(v, 0)) / (4 * Math.PI));

export function capillaryTimeReal(r) {
  const m = r * M_PER_UNIT;
  return Math.sqrt((RHO * m * m * m) / SIGMA);
}

export const DROP_PLAYBACK = capillaryTimeReal(TONGUE_ROOT_R) / DROP_TC_ANCHOR_S; // real s per display s (≈ 1/600)
export const capillaryTime = (r) => capillaryTimeReal(r) / DROP_PLAYBACK;
export const rpWavelength = (r0) => RP_LAMBDA_PER_R * r0;

export function pinchRadius(h0, t, t0) {
  if (!(t > 0)) return h0;
  if (t >= t0) return 0;
  return h0 * ((t0 - t) / t0) ** PINCH_EXP;
}

export function bridgeRadius(rSmall, t) {
  if (!(t > 0)) return 0;
  const m = rSmall * M_PER_UNIT;
  return (BRIDGE_C * ((SIGMA * m) / RHO) ** 0.25 * Math.sqrt(t * DROP_PLAYBACK)) / M_PER_UNIT;
}

export function bridgeTime(rSmall) {
  const m = rSmall * M_PER_UNIT;
  return (m / (BRIDGE_C * ((SIGMA * m) / RHO) ** 0.25)) ** 2 / DROP_PLAYBACK;
}

// Retraction speed of a cut liquid end, scene units per display s.
export function taylorCulick(h) {
  return (Math.sqrt((2 * SIGMA) / (RHO * h * M_PER_UNIT)) * DROP_PLAYBACK) / M_PER_UNIT;
}

// Rayleigh ℓ = 2 frequency of a bead of radius r, rad per display s.
export function wobbleOmega(r) {
  const m = r * M_PER_UNIT;
  return Math.sqrt((8 * SIGMA) / (RHO * m * m * m)) * DROP_PLAYBACK;
}

// The rotating-drop ratio for the 1 cm planet bead at on-screen spin ω (HUD readout; D4).
export function sigmaRatio(omega) {
  return (RHO * omega * omega * DROP_R_M ** 3) / (8 * SIGMA);
}

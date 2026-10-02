// src/terminal/mercury/planet/mercuryExosphere.js — the Sun's signature: Mercury's sodium
// tail and, while the bead boils, a faint Hg vapour haze at the limb (phase-4 spec §7).
//
// PRECISION BOUNDARY, stated so no reader assumes more:
// - The Na tail is pushed by radiation pressure (resonant scattering of the Na D lines),
//   so its brightness ∝ g(|v_r|)/r². g is a FITTED SHAPE of the solar Fraunhofer line core
//   (dimmest at v_r = 0, saturating by |v_r| ≈ 8–10 km/s), a stated convention (D9), NOT
//   the Killen et al. tabulated g-factors.
// - B is normalised to the orbit's peak and floored at TAIL_B_FLOOR (D6), so the tab
//   always carries a trace of the tail. Its length scales with B: a weak tail is short.
// - Hg vapour coverage is analytic: the boiling cap where T_ss·cos^¼θ + heat > T_boil
//   (mercuryThermal's day law, the 1-atm convention). It drives the colourless limb haze.
// - Scene units throughout (R_SCENE = the planet). exosphereShader.js mirrors haloColumn
//   and tailDensity (constants via glf).

import { mercuryEphemeris } from './mercuryEphemeris';
import { HG_BOIL_K } from './mercuryThermal';
import { SUN_DIR_WORLD } from './planetFrame';
import { R_SCENE } from './planetLook';

export const NA_G_V0_KMS = 5;            // Doppler half-width of the fitted line core
export const NA_G_MIN = 0.2;             // relative g at v_r = 0
export const TAIL_B_FLOOR = 0.15;
export const TAIL_L_MIN = 1.5 * R_SCENE; // e-fold length of the tail at B = 0…
export const TAIL_L_MAX = 6 * R_SCENE;   // …and at B = 1
export const TAIL_REACH_L = 3;           // the box runs the tail out to 3 e-folds
export const TAIL_W0 = 0.5 * R_SCENE;    // Gaussian half-width at the root…
export const TAIL_SPREAD = 0.2;          // …widening downstream (per unit s)
export const TAIL_WIDTH_SIGMA = 3;       // the box holds ±3σ of the cross-section
export const H_NA = 0.12 * R_SCENE;      // Na halo scale height
export const H_HG = 0.05 * R_SCENE;      // Hg vapour scale height (thinner, heavier)
export const HALO_REACH_H = 6;           // the box holds the halo out to 6 scale heights
export const NA_COL = [1.0, 0.55, 0.12]; // linear, 589 nm
export const HG_COL = [0.75, 0.8, 0.9];  // linear, colourless-cool
export const NA_HALO_GAIN = 0.05;        // radiance per unit column (× PLANET_TUNE.exoGain)
export const NA_TAIL_GAIN = 0.04;
export const HG_GAIN = 0.03;
export const STREAM_AMP = 0.35;          // streamer noise depth along the tail
export const STREAM_FREQ_S = 1.5;        // along the axis, per scene unit
export const STREAM_FREQ_P = 3;          // across it
export const STREAM_SPEED = 0.06;        // scene units / s, downstream (frozen under CALM)
// Option 2 ("a gas tail against a bright sky"): along the tail the backdrop is dimmed by
// 1 - tailAlpha(e) before the amber is added, e = the tail's linear radiance (x exoGain).
// A look device, not physics (the Na tail is optically thin): it lets amber read as a
// stream over the bright pastel nebula instead of a whitening wash. The halo never dims.
export const EXO_DIM = 8;                // backdrop optical depth per unit tail radiance
export const TAIL_AXIS = Object.freeze(SUN_DIR_WORLD.map((c) => -c));

const DAY_MS = 86400000;

// Backdrop attenuation behind a tail column of linear radiance e (exosphereShader mirrors it).
export function tailAlpha(e) {
  return 1 - Math.exp(-EXO_DIM * e);
}

export function gNa(vKmS) {
  const x = vKmS / NA_G_V0_KMS;
  return NA_G_MIN + (1 - NA_G_MIN) * (1 - Math.exp(-x * x));
}

function rawB(tMs) {
  const e = mercuryEphemeris(tMs);
  return gNa(Math.abs(e.rdotKmS)) / (e.r * e.r);
}

// The orbit's peak, sampled once over one orbit (the elements drift negligibly per century).
const B_MAX = (() => {
  let m = 0;
  const t0 = Date.UTC(2026, 0, 1);
  for (let i = 0; i < 880; i++) m = Math.max(m, rawB(t0 + i * 0.1 * DAY_MS));
  return m;
})();

export function tailBrightness(tMs) {
  return Math.min(1, Math.max(TAIL_B_FLOOR, rawB(tMs) / B_MAX));
}

export function tailLength(B) {
  return TAIL_L_MIN + (TAIL_L_MAX - TAIL_L_MIN) * B;
}

export function boilCoverage(tau, heatK, tssK) {
  if (!(tau > 0) || !(tssK > 0)) return 0;
  const ratio = (HG_BOIL_K - heatK) / tssK;
  if (ratio >= 1) return 0;
  const cosB = ratio <= 0 ? 0 : ratio ** 4;
  return (tau * (1 - cosB)) / 2;
}

// Line-of-sight column through exp(−(r−R)/H), impact parameter b (Chapman's grazing
// approximation). Over the disc the planet is opaque and the box is depth-rejected: 0.
export function haloColumn(b, H) {
  if (b <= R_SCENE) return 0;
  return Math.exp(-(b - R_SCENE) / H) * Math.sqrt(2 * Math.PI * b * H);
}

// Tail number density at world point P (no streamer noise; the shader adds it).
export function tailDensity(P, B, L) {
  const s = P[0] * TAIL_AXIS[0] + P[1] * TAIL_AXIS[1] + P[2] * TAIL_AXIS[2];
  const r2 = P[0] * P[0] + P[1] * P[1] + P[2] * P[2];
  if (s <= 0 || r2 <= R_SCENE * R_SCENE) return 0;
  const rho2 = r2 - s * s;
  const w = TAIL_W0 + TAIL_SPREAD * s;
  return B * Math.exp(-s / L) * Math.exp(-rho2 / (2 * w * w));
}

// The box around halo + tail, along TAIL_AXIS: from s0 to s1, square cross-section width.
export function exoBox(L) {
  const halo = R_SCENE + HALO_REACH_H * H_NA;
  const s0 = -halo;
  const s1 = Math.max(TAIL_REACH_L * L, halo);
  const width = 2 * Math.max(halo, TAIL_WIDTH_SIGMA * (TAIL_W0 + TAIL_SPREAD * s1));
  return { s0, s1, width };
}

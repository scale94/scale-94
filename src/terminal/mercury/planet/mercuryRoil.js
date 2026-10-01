// src/terminal/mercury/planet/mercuryRoil.js — the boil zone as bubble-collapse pops
// (phase-4 spec §6 + refinements R1, R2).
//
// CONVENTIONS, stated so no reader assumes more:
// - Pops live in the BODY frame on a 3D cell lattice over x·POP_FREQ (0.2 rad
//   spacing). Each cell has a hashed site (jitter ±POP_JITTER), a hashed period in
//   [POP_P_MIN, POP_P_MAX] and phase; it is active iff its hash < popDensity(T − T_boil),
//   so the boil front fades in as sparse pops and thickens toward noon.
// - A pop is the splash's dispersive train (mercuryWaves.rippleSlope), MINIATURISED:
//   arc × POP_SCALE, time × POP_TIME, so its front reaches POP_REACH_RAD exactly at
//   POP_LIFE_S. Real capillary dispersion at WAVE_PLAYBACK would cross the reach in
//   milliseconds; this is a third stated playback convention (spec R2).
// - Every active pop within reach is summed. The 2×2×2 neighbourhood floor(p − 0.5)
//   + {0,1}³ holds every site that can reach p while POP_JITTER + POP_REACH < 1, so the
//   field is exactly continuous across cell boundaries (spec R1).
// - Ring distance is the 3D lattice distance / POP_FREQ (a sphere ∩ ball circle), which
//   is what makes the containment exact.
// mercuryPlanetShader.js mirrors hash13, popDensity, popSlope and roilTilt exactly
// (constants via glf; the GLSL hash runs in float32, so values agree in law, not bit).

import { rippleSlope, WAVE_C_FRONT } from './mercuryWaves';

export const POP_FREQ = 5;               // cells per unit of the body frame (spacing 0.2 rad ≈ 43 px at rest)
export const POP_JITTER = 0.25;          // site jitter, ± cell units
export const POP_REACH = 0.45;           // ring reach, cell units (POP_JITTER + POP_REACH < 1)
export const POP_REACH_RAD = POP_REACH / POP_FREQ;
// The splash arc (rad) the miniature's reach maps to — the FULL tier's; each tier carries
// its own (planetQuality.TIERS[*].popRefTh), and popScale / popTime derive per tier.
// R2 amended: at 0.5 (with POP_FREQ 14) a ring's peak wavelength shrank to ~1 px and bandAA
// (rightly) erased it. The limit: a ring resolves only while WAVE_K_PEAK·pxArc·popScale ≤ ~2π/5
// (≥ 5 px per peak crest), with pxArc taken at the SUBSOLAR point, where the boil cap sits,
// PHASE_ANGLE_DEG off the view centre and so foreshortened. At 0.25: 1920×1080 DPR 2 gives
// pxArc ≈ 0.0039 (0.98 ≤ 2π/5, reach ≈ 23 px); at DPR 1 (≈ 0.0078) the peak crest is ≈ 3.2 px
// and fades. The phone (pxArc ≈ 0.0094) takes 0.125.
export const POP_REF_TH = 0.25;
export const POP_LIFE_S = 0.6;
export const popScale = (refTh = POP_REF_TH) => refTh / POP_REACH_RAD;
export const popTime = (refTh = POP_REF_TH) => refTh / (WAVE_C_FRONT * POP_LIFE_S);
export const POP_SCALE = popScale(POP_REF_TH);
export const POP_TIME = popTime(POP_REF_TH);
export const POP_P_MIN = 1.5;            // s between one cell's pops…
export const POP_P_MAX = 4;              // …hashed per cell in this range
export const POP_DENSITY_K = 60;         // superheat (K) for 1 − 1/e of cells active
export const POP_AMP = 0.12;             // slope gain of one pop (× PLANET_TUNE.roilGain)
export const POP_SALTS = Object.freeze({
  active: [17.13, 3.71, 5.29],
  period: [31.7, 11.3, 2.9],
  phase: [47.3, 23.1, 13.7],
  x: [0, 0, 0],
  y: [19.19, 7.77, 1.11],
  z: [5.55, 29.3, 37.7],
});
// lite tier: one octave of animated value noise instead of pops
export const ROIL_LITE_FREQ = 40;
export const ROIL_LITE_SPEED = 1.5;
export const ROIL_LITE_AMP = 0.08;
export const ROIL_LITE_ACT = 0.5;       // the noise has no pops: a steady mid activity for the roughness patches

const fract = (x) => x - Math.floor(x);
const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// mercuryPlanetShader's hash13, in JS.
export function hash13(x, y, z) {
  let px = fract(x * 0.1031), py = fract(y * 0.1031), pz = fract(z * 0.1031);
  const d = px * (pz + 31.32) + py * (py + 31.32) + pz * (px + 31.32);
  px += d; py += d; pz += d;
  return fract((px + py) * pz);
}

export function popDensity(superheatK) {
  return superheatK > 0 ? 1 - Math.exp(-superheatK / POP_DENSITY_K) : 0;
}

// refTh: the tier's popRefTh (planetQuality.TIERS); the full tier's by default.
export function popSlope(th, age, pxArc, refTh = POP_REF_TH) {
  if (th >= POP_REACH_RAD || age >= POP_LIFE_S) return 0;
  const scale = popScale(refTh);
  const w = 1 - smoothstep(0.7 * POP_REACH_RAD, POP_REACH_RAD, th);
  const life = 1 - smoothstep(0.7 * POP_LIFE_S, POP_LIFE_S, age);
  return POP_AMP * w * life * rippleSlope(th * scale, Math.max(age * popTime(refTh), 1e-3), pxArc * scale);
}

const salted = (c, s) => hash13(c[0] + s[0], c[1] + s[1], c[2] + s[2]);

// Tangential slope of the pop field at unit body-frame x (subtract from the normal,
// like waveTilt), plus local pop activity in [0, 1] for the roughness patches.
export function roilTilt(x, tS, superheatK, pxArc, refTh = POP_REF_TH) {
  const g = [0, 0, 0];
  let act = 0;
  const dens = popDensity(superheatK);
  if (dens <= 0) return { g, act };
  const p = [x[0] * POP_FREQ, x[1] * POP_FREQ, x[2] * POP_FREQ];
  const base = [Math.floor(p[0] - 0.5), Math.floor(p[1] - 0.5), Math.floor(p[2] - 0.5)];
  const c = [0, 0, 0];
  for (let i = 0; i < 8; i++) {
    c[0] = base[0] + (i & 1); c[1] = base[1] + ((i >> 1) & 1); c[2] = base[2] + ((i >> 2) & 1);
    if (salted(c, POP_SALTS.active) >= dens) continue;
    const period = POP_P_MIN + (POP_P_MAX - POP_P_MIN) * salted(c, POP_SALTS.period);
    const t = tS + salted(c, POP_SALTS.phase) * period;
    const age = t - period * Math.floor(t / period);
    if (age >= POP_LIFE_S) continue;
    const sx = c[0] + 0.5 + (salted(c, POP_SALTS.x) - 0.5) * 2 * POP_JITTER;
    const sy = c[1] + 0.5 + (salted(c, POP_SALTS.y) - 0.5) * 2 * POP_JITTER;
    const sz = c[2] + 0.5 + (salted(c, POP_SALTS.z) - 0.5) * 2 * POP_JITTER;
    const dx = p[0] - sx, dy = p[1] - sy, dz = p[2] - sz;
    const d = Math.hypot(dx, dy, dz);
    if (d >= POP_REACH) continue;
    const r = dx * x[0] + dy * x[1] + dz * x[2];
    const tx = dx - x[0] * r, ty = dy - x[1] * r, tz = dz - x[2] * r;
    const tl = Math.hypot(tx, ty, tz);
    if (tl < 1e-5) continue;
    const s = popSlope(d / POP_FREQ, age, pxArc, refTh) / tl;
    g[0] += s * tx; g[1] += s * ty; g[2] += s * tz;
    act += (1 - d / POP_REACH) * Math.exp((-3 * age) / POP_LIFE_S);
  }
  return { g, act: Math.min(act, 1) };
}

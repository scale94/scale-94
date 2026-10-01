// src/terminal/mercury/planet/mercuryWaves.js — the transmuted planet as a bead of mercury.
//
// CONVENTIONS (spec amendment 3), stated so no reader assumes more:
// - The liquid planet is read as a DROP_R_M = 1 cm bead of real Hg (σ, ρ below).
//   Body modes ℓ = 2, 3, 4 use Rayleigh's drop frequencies
//   ω_ℓ² = ℓ(ℓ−1)(ℓ+2)·σ/(ρR³) (ratios 1 : 1.936 : 3) and Lamb's viscous
//   damping ratios γ_ℓ ∝ (ℓ−1)(2ℓ+1) (1 : 2.8 : 5.4).
// - A real bead rings and ripples too fast to see: modes are shown at
//   MODE_PLAYBACK, capillary ripples at WAVE_PLAYBACK. Within each family the
//   physics holds (ratios; ω² = σk³/ρ; group speed = 1.5 × phase speed).
// - Damping is EFFECTIVE (an oxide skin): Hg's bulk viscosity would ring ℓ = 2
//   for minutes. MODE_GAMMA2_PER_S sets ℓ = 2; Lamb's ratios give the rest.
// - Spin bulge: a rotating drop's ℓ = 2 response a₂ = −(2/3)(Ω/ω₂)², soft-capped
//   at BULGE_MAX (past the Rayleigh fission limit a planet does not fission).
// The shader (mercuryPlanetShader.js) reads per-impulse amplitudes from
// impulseFrame and mirrors shapeHeight / legendre exactly; it does no time maths.

import { MAX_OMEGA } from './mercuryBody';

export const HG_SIGMA_N_PER_M = 0.485;
export const HG_RHO_KG_M3 = 13534;
export const DROP_R_M = 0.01;
export const MODE_PLAYBACK = 1 / 6;
export const WAVE_PLAYBACK = 1 / 24;

export const MODE_L = [2, 3, 4];
export const MODE_GAMMA2_PER_S = 0.8;
export const MODE_WEIGHTS = [1, 0.6, 0.35];  // how an impulse shares itself across ℓ = 2, 3, 4

export const IMPULSE_SLOTS = 8;
export const IMPULSE_LIFE_S = 6;              // ℓ = 2 is below 1 % by then
export const SHAPE_MAX = 0.06;                // |h| cap, fraction of R; the impostor quad has this margin
export const SHAPE_ITERS = 3;                 // radial re-intersection steps in the shader
export const BULGE_MAX = 0.04;

export const WAVE_KR = 24;                    // packet centre wavenumber × R (wavelength ≈ 0.26 R)
export const WAVE_PACKET_RAD = 0.35;          // packet envelope half-width, radians of arc
export const WAVE_SPREAD_FLOOR = 0.15;        // 1/√sinθ spreading, normalised to 1 inside this
export const WAVE_DAMP_PER_S = { splash: 1.0, wake: 1.6, ring: 3.0 };

export const LIQUID_TAU = 0.5;                // the bead is "liquid" for strikes and wakes above this τ
export const WAKE_EVERY_S = 0.16;
export const WAKE_WAVE_AMP = 0.12;
export const WAKE_FULL_OMEGA = 6;             // pointer ω (rad/s) for a full-strength wake
export const RELEASE_MODE_AMP = 0.03;

export function rayleighOmega(l, rM = DROP_R_M) {
  return Math.sqrt((l * (l - 1) * (l + 2) * HG_SIGMA_N_PER_M) / (HG_RHO_KG_M3 * rM ** 3));
}

export function capillaryOmega(kPerM) {
  return Math.sqrt((HG_SIGMA_N_PER_M * kPerM ** 3) / HG_RHO_KG_M3);
}

export const MODE_OMEGA = MODE_L.map((l) => MODE_PLAYBACK * rayleighOmega(l));
export const MODE_GAMMA = MODE_L.map((l) => (MODE_GAMMA2_PER_S * (l - 1) * (2 * l + 1)) / 5);

// Phase and group speed in radians of arc per second (ω/k divided by R).
export const WAVE_C_PHASE = (WAVE_PLAYBACK * capillaryOmega(WAVE_KR / DROP_R_M)) / WAVE_KR;
export const WAVE_C_GROUP = 1.5 * WAVE_C_PHASE;

export function legendre(l, m) {
  if (l === 2) return 0.5 * (3 * m * m - 1);
  if (l === 3) return 0.5 * (5 * m * m * m - 3 * m);
  const m2 = m * m;
  return 0.125 * (35 * m2 * m2 - 30 * m2 + 3);
}

export function dLegendre(l, m) {
  if (l === 2) return 3 * m;
  if (l === 3) return 0.5 * (15 * m * m - 3);
  return 0.5 * (35 * m * m * m - 15 * m);
}

// Mode j (0 → ℓ=2) of a unit impulse at age t: a dent first, then rebound, decaying.
export function modeResponse(j, ageS) {
  const result = -MODE_WEIGHTS[j] * Math.exp(-MODE_GAMMA[j] * ageS) * Math.sin(MODE_OMEGA[j] * ageS);
  return result === 0 ? 0 : result;
}

export function createImpulses() {
  return {
    slots: Array.from({ length: IMPULSE_SLOTS }, () => ({ active: false, dir: [0, 0, 1], t0: 0, mode: 0, wave: 0, kind: 'splash' })),
    next: 0,
  };
}

export function addImpulse(buf, { dirBody, tS, mode = 0, wave = 0, kind = 'splash' }) {
  const s = buf.slots[buf.next];
  s.active = true;
  s.dir[0] = dirBody[0]; s.dir[1] = dirBody[1]; s.dir[2] = dirBody[2];
  s.t0 = tS;
  s.mode = mode;
  s.wave = wave;
  s.kind = kind;
  buf.next = (buf.next + 1) % IMPULSE_SLOTS;
  return s;
}

export function createImpulseFrame() {
  return { mode: new Float32Array(IMPULSE_SLOTS * 3), wave: new Float32Array(IMPULSE_SLOTS * 2), any: false };
}

const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// The ripple must not refocus at the antipode: fade as its centre nears it.
const antipodeFade = (ageS) => 1 - smoothstep(0.75 * Math.PI, Math.PI, WAVE_C_GROUP * ageS);

export function impulseFrame(buf, tS, { modeScale = 1, waveScale = 1 } = {}, out) {
  out.any = false;
  for (let i = 0; i < IMPULSE_SLOTS; i++) {
    const s = buf.slots[i];
    const age = tS - s.t0;
    if (s.active && age > IMPULSE_LIFE_S) s.active = false;
    if (!s.active || age < 0) {
      out.mode[3 * i] = 0; out.mode[3 * i + 1] = 0; out.mode[3 * i + 2] = 0;
      out.wave[2 * i] = 0; out.wave[2 * i + 1] = 0;
      continue;
    }
    for (let j = 0; j < 3; j++) out.mode[3 * i + j] = s.mode * modeScale * modeResponse(j, age);
    const waveAmp = s.wave * waveScale * Math.exp(-WAVE_DAMP_PER_S[s.kind] * age) * antipodeFade(age);
    out.wave[2 * i] = age;
    out.wave[2 * i + 1] = waveAmp;
    if (Math.abs(out.mode[3 * i]) + Math.abs(out.mode[3 * i + 1]) + Math.abs(out.mode[3 * i + 2]) + waveAmp > 1e-5) out.any = true;
  }
  return out;
}

export function spinBulge(omega, scale, out = [0, 1, 0, 0]) {
  const wx = omega.x ?? omega[0], wy = omega.y ?? omega[1], wz = omega.z ?? omega[2];
  const W = Math.hypot(wx, wy, wz);
  if (W < 1e-6 || !(scale > 0)) {
    out[0] = 0; out[1] = 1; out[2] = 0; out[3] = 0;
    return out;
  }
  const x = (2 / 3) * (W / MODE_OMEGA[0]) ** 2;
  out[0] = wx / W; out[1] = wy / W; out[2] = wz / W;
  out[3] = -scale * BULGE_MAX * (1 - Math.exp(-x / BULGE_MAX));
  return out;
}

// JS mirror of the shader's shapeH (world-frame unit x; dirs world-frame).
export function shapeHeight(x, dirs, modes, bulge) {
  const mb = x[0] * bulge[0] + x[1] * bulge[1] + x[2] * bulge[2];
  let h = bulge[3] * legendre(2, mb);
  for (let i = 0; i < IMPULSE_SLOTS; i++) {
    const d = dirs[i];
    const m = x[0] * d[0] + x[1] * d[1] + x[2] * d[2];
    h += modes[3 * i] * legendre(2, m) + modes[3 * i + 1] * legendre(3, m) + modes[3 * i + 2] * legendre(4, m);
  }
  return Math.min(SHAPE_MAX, Math.max(-SHAPE_MAX, h));
}

export function createWake() {
  return { lastS: -Infinity };
}

// What the drag does to the liquid this frame: a ring of ripples from the drag
// point every WAKE_EVERY_S while the pointer moves, and a slosh of the body
// modes on release. Nothing while the planet is crust.
export function wakeImpulse(wake, { tS, dragging, released, ptrOmega, bodyOmega, tau }) {
  if (tau < LIQUID_TAU) return null;
  if (released) return { kind: 'ring', mode: RELEASE_MODE_AMP * Math.min(1, bodyOmega / MAX_OMEGA), wave: 0 };
  if (!dragging || !(ptrOmega > 0) || tS - wake.lastS < WAKE_EVERY_S) return null;
  wake.lastS = tS;
  return { kind: 'wake', mode: 0, wave: WAKE_WAVE_AMP * Math.min(1, ptrOmega / WAKE_FULL_OMEGA) };
}

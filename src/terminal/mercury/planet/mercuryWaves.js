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
export const WAVE_PLAYBACK = 1 / 40;            // slower than phase 3's 1/24: tighter crests run faster

export const MODE_L = [2, 3, 4];
export const MODE_GAMMA2_PER_S = 0.8;
export const MODE_WEIGHTS = [1, 0.6, 0.35];  // how an impulse shares itself across ℓ = 2, 3, 4

export const IMPULSE_SLOTS = 8;
export const IMPULSE_LIFE_S = 6;              // ℓ = 2 is below 1 % by then
export const SHAPE_MAX = 0.06;                // |h| cap, fraction of R; the impostor quad has this margin
export const SHAPE_ITERS = 3;                 // radial re-intersection steps in the shader
export const BULGE_MAX = 0.04;

export const WAVE_KR = 72;                    // reference wavenumber × R: WAVE_C_* are quoted at it
export const WAVE_K_PEAK = 90;                // the splash's spectrum peaks here (wavelength ≈ 0.07 R)…
export const WAVE_SPEC_W = 0.6;               // …a log-normal this wide (±1σ ≈ kR 49–164)
export const WAVE_VISC_PER_S = 0.5;           // viscous damping at WAVE_KR, ∝ k²: the fine front dies first
export const WAVE_SHARP = 0.22;               // 2nd harmonic: sharp troughs, round crests (high-tension capillary profile)
export const WAVE_WARP_RAD = 0.02;            // arc-distance warp, ≈ 1/3 crest: rings shear instead of reading as grooves
export const WAVE_WARP_FREQ = 7;              // the warp's noise frequency on the unit sphere
export const WAVE_DIMPLE_RAD = 0.05;          // the snap: a sharp dimple at the impact point…
export const WAVE_DIMPLE_S = 0.12;            // …gone in a few tenths of a second
export const WAVE_DIMPLE_GAIN = 1.2;
export const WAVE_DIMPLE_AA_LO = 1.5;           // the dimple fades out as its radius drops under this many px…
export const WAVE_DIMPLE_AA_HI = 2.5;           // …and is whole above this (a splash on the rest disc is ≈ 10 px)
export const WAVE_SPREAD_FLOOR = 0.15;        // 1/√sinθ spreading, normalised to 1 inside this
// Visitors (spec 2026-10-03 §5.4): dimple = a water drop (soft, dies fast), crown = a rock's splash, marangoni = an ember's
// soft hit ring (its clearing is a surface slot, plan D-3), jet = a gust's touch (its dent and cat's-paws are a surface slot).
export const WAVE_DAMP_PER_S = { splash: 1.0, wake: 1.6, ring: 3.0, dimple: 1.8, crown: 1.0, marangoni: 0.9, jet: 2.5 };

export const LIQUID_TAU = 0.5;                // the bead is "liquid" for strikes and wakes above this τ
export const WAKE_EVERY_S = 0.07;
export const WAKE_WAVE_AMP = 0.12;
export const WAKE_FULL_OMEGA = 4;             // pointer ω (rad/s) for a full-strength wake (strength ∝ √ω below it)
export const WAKE_SLIP = 0.7;                 // shear: how far a wake ring stays where it was made instead of riding the body
// A wake's share of the snap dimple (splashes and pops keep all of WAVE_DIMPLE_GAIN). Wakes fire every
// WAKE_EVERY_S under the pointer, so their dimples overlap into one steady dent that reads as a lens (author).
// CPU-only: impulseFrame writes it per slot into frame.dimple, the shader reads it as uImpWave.z.
// 0.25 (tuned 2026-10-02, slow-drag sheets 1/0.5/0.25/0): 0.5 still shows the lens disc, 0 loses the touch point.
export const WAKE_DIMPLE_GAIN = 0.25;
// The snap dimple's weight per impulse kind (impulseFrame → frame.dimple → uImpWave.z). Kinds not listed weigh 1
// (splash, ring, pops). The Marangoni hit has none: the clearing it opens lives far longer than the 0.12 s snap.
export const KIND_DIMPLE = { wake: WAKE_DIMPLE_GAIN, dimple: 0.6, crown: 1.4, marangoni: 0, jet: 1.0 };
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
// Group speed grows as √k (capillary); the train's leading edge is its +1σ wavenumber.
export const WAVE_C_FRONT = WAVE_C_GROUP * Math.sqrt((WAVE_K_PEAK * Math.exp(WAVE_SPEC_W)) / WAVE_KR);

// Fade a wavenumber whose crests would fall under a few pixels (pxArc: arc per pixel; 0 = no fade).
export function bandAA(k, pxArc) {
  if (!(pxArc > 0)) return 1;
  return smoothstep(2.5, 5, (2 * Math.PI) / (k * pxArc));
}

// Fade the snap dimple as its radius falls under a pixel or two: sub-pixel it only aliases into specks.
export function dimpleAA(pxArc) {
  if (!(pxArc > 0)) return 1;
  return smoothstep(WAVE_DIMPLE_AA_LO, WAVE_DIMPLE_AA_HI, WAVE_DIMPLE_RAD / pxArc);
}

const DIMPLE_NORM = 2.3316; // 1 / max(x·e^(−x²))

// The tangential slope of a splash's ripples at arc distance th, age s
// (multiplied by the impulse's amplitude). A dispersive capillary train by
// stationary phase: the wavenumber found at th is the one whose group speed
// carries it there, k = K·(th / (c_g·t))², with phase k·th/3 (ω ∝ k^1.5), so
// crests bunch at the leading edge and widen behind. A log-normal spectrum
// bounds the train; viscous damping ∝ k² kills its fine front first; a 2nd
// harmonic sharpens the troughs; a short dimple at the origin is the snap.
// dimple weights the snap (1 = a splash or pop; WAKE_DIMPLE_GAIN for a drag wake).
// The shader's rippleSlope mirrors this exactly.
export function rippleSlope(th, age, pxArc, dimple = 1) {
  const t = Math.max(age, 1e-3);
  const q = th / (WAVE_C_GROUP * t);
  const k = WAVE_KR * q * q;
  let slope = 0;
  if (k > 1e-3) {
    const lk = Math.log(k / WAVE_K_PEAK) / WAVE_SPEC_W;
    const kk = k / WAVE_KR;
    const ph = (k * th) / 3;
    slope = Math.exp(-lk * lk - WAVE_VISC_PER_S * kk * kk * t)
      * (bandAA(k, pxArc) * Math.sin(ph) + 2 * WAVE_SHARP * bandAA(2 * k, pxArc) * Math.sin(2 * ph));
  }
  const xd = th / WAVE_DIMPLE_RAD;
  return slope + dimple * dimpleAA(pxArc) * WAVE_DIMPLE_GAIN * Math.exp(-t / WAVE_DIMPLE_S) * DIMPLE_NORM * xd * Math.exp(-xd * xd);
}

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
    slots: Array.from({ length: IMPULSE_SLOTS }, () => ({ active: false, dir: [0, 0, 1], dirWorld0: [0, 0, 1], slip: 0, t0: 0, mode: 0, wave: 0, kind: 'splash' })),
  };
}

const waveDamp = (kind) => WAVE_DAMP_PER_S[kind] ?? WAVE_DAMP_PER_S.splash;

// What is left of a slot's impulse at tS: its ℓ = 2 body mode plus its ripple.
function remainingStrength(s, tS) {
  const age = tS - s.t0;
  return Math.abs(s.mode) * Math.exp(-MODE_GAMMA[0] * age) + s.wave * Math.exp(-waveDamp(s.kind) * age);
}

// A free slot (inactive first, then past its life) goes first; otherwise the weakest
// remaining impulse is overwritten, lowest index on a tie. Round-robin would
// let a drag's wakes (one per 0.16 s) clobber a splash that should live 6 s.
function pickSlot(buf, tS) {
  for (let i = 0; i < IMPULSE_SLOTS; i++) if (!buf.slots[i].active) return i;
  let best = 0, bestStrength = Infinity;
  for (let i = 0; i < IMPULSE_SLOTS; i++) {
    const s = buf.slots[i];
    if (tS - s.t0 > IMPULSE_LIFE_S) return i;
    const strength = remainingStrength(s, tS);
    if (strength < bestStrength) { best = i; bestStrength = strength; }
  }
  return best;
}

export function addImpulse(buf, { dirBody, dirWorld = null, tS, mode = 0, wave = 0, kind = 'splash', slip = 0 }) {
  const s = buf.slots[pickSlot(buf, tS)];
  s.active = true;
  s.dir[0] = dirBody[0]; s.dir[1] = dirBody[1]; s.dir[2] = dirBody[2];
  if (dirWorld) { s.dirWorld0[0] = dirWorld[0]; s.dirWorld0[1] = dirWorld[1]; s.dirWorld0[2] = dirWorld[2]; }
  s.slip = dirWorld ? slip : 0;
  s.t0 = tS;
  s.mode = mode;
  s.wave = wave;
  s.kind = kind;
  return s;
}

export function createImpulseFrame() {
  return { mode: new Float32Array(IMPULSE_SLOTS * 3), wave: new Float32Array(IMPULSE_SLOTS * 2), dimple: new Float32Array(IMPULSE_SLOTS), any: false };
}

const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// The ripple must not refocus at the antipode: fade as its leading edge nears it.
const antipodeFade = (ageS) => 1 - smoothstep(0.75 * Math.PI, Math.PI, WAVE_C_FRONT * ageS);

// Shear: the liquid skin lags the drag, so a wake ring is not carried rigidly
// by the body. Its world direction blends the body-carried one toward where it
// was made (slip 0 = rides the body, 1 = stays put in the world).
export function slipDirWorld(carried, dir0, slip, out = [0, 0, 0]) {
  if (!(slip > 0)) { out[0] = carried[0]; out[1] = carried[1]; out[2] = carried[2]; return out; }
  const x = carried[0] + (dir0[0] - carried[0]) * slip;
  const y = carried[1] + (dir0[1] - carried[1]) * slip;
  const z = carried[2] + (dir0[2] - carried[2]) * slip;
  const l = Math.hypot(x, y, z) || 1;
  out[0] = x / l; out[1] = y / l; out[2] = z / l;
  return out;
}

export function impulseFrame(buf, tS, { modeScale = 1, waveScale = 1 } = {}, out) {
  out.any = false;
  for (let i = 0; i < IMPULSE_SLOTS; i++) {
    const s = buf.slots[i];
    const age = tS - s.t0;
    if (s.active && age > IMPULSE_LIFE_S) s.active = false;
    if (!s.active || age < 0) {
      out.mode[3 * i] = 0; out.mode[3 * i + 1] = 0; out.mode[3 * i + 2] = 0;
      out.wave[2 * i] = 0; out.wave[2 * i + 1] = 0; out.dimple[i] = 0;
      continue;
    }
    for (let j = 0; j < 3; j++) out.mode[3 * i + j] = s.mode * modeScale * modeResponse(j, age);
    const waveAmp = s.wave * waveScale * Math.exp(-waveDamp(s.kind) * age) * antipodeFade(age);
    out.wave[2 * i] = age;
    out.wave[2 * i + 1] = waveAmp;
    out.dimple[i] = KIND_DIMPLE[s.kind] ?? 1;
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
  return { kind: 'wake', mode: 0, wave: WAKE_WAVE_AMP * Math.sqrt(Math.min(1, ptrOmega / WAKE_FULL_OMEGA)), slip: WAKE_SLIP };
}

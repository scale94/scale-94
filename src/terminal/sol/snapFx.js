// snapFx.js — what a snap looks like, as envelopes. Pure state, no DOM, no React.
//
// One snap at a time: a newer snap replaces the older outright. Every value is
// closed-form in the elapsed time since the snap, so the step size can never
// change what is drawn (one 0.3 s step === thirty 0.01 s steps).
//
// Uniforms (all exactly 0 when idle):
//   uFlash    intensity: a 40 ms smooth attack to a peak of 0.35 + 0.65 s,
//             then (1 - t/0.6)^2 down to 0 at 0.6 s. The only white on the tab.
//   uShock    PROGRESS 0 -> 1 over 2.5 s; the shader derives the visible
//             intensity from progress (eases in, fades out).
//   uPlume    PROGRESS 0 -> 1 over 6 s when the footpoint did not face the camera.
//   uHalo     PROGRESS 0 -> 1 over 6 s when it did.
//   uFlashPos the footpoint, STAR frame unit vector (the shader carries it with
//             the camera like any surface point).
//   uPlumeDir the footpoint's VIEW-space outward normal at the snap, scaled by
//             the snap's gain (0.35 + 0.65 s): direction = normalize(uPlumeDir),
//             gain = length(uPlumeDir). That is how the progress-only uniforms
//             learn how strong the snap was without a new uniform.
//   shake     CSS px, a damped two-axis oscillation, at most SHAKE_PX for the
//             strongest snap, exactly [0, 0] from 0.8 s on and while `still`.
// (s = strength01 of the snap's energy.)

import { viewNormal } from './solCamera';

export const FLASH_S = 0.6;
export const FLASH_ATTACK_S = 0.04;
export const SHOCK_S = 2.5;
export const EJECT_S = 6;
export const SHAKE_S = 0.8;
export const SHAKE_PX = 6;
const SHAKE_HZ_A = 9.0;   // along the ejection's screen direction
const SHAKE_HZ_B = 12.5;  // across it, smaller

const fin = (v, d = 0) => (Number.isFinite(v) ? v : d);
const clamp01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x);
const vec3 = (v) => (v && v.length >= 3 ? [fin(v[0]), fin(v[1]), fin(v[2])] : [0, 0, 0]);

export function createSnapFx() {
  return {
    active: false,
    t: 0,
    posStar: [0, 0, 0],
    dirView: [0, 0, 0],
    strength: 0,
    facing: false,
    still: false,
    out: {
      uFlashPos: [0, 0, 0],
      uFlash: 0,
      uShock: 0,
      uPlumeDir: [0, 0, 0],
      uPlume: 0,
      uHalo: 0,
      shake: [0, 0],
    },
  };
}

export function triggerSnap(fx, { posStar, dirView, strength01, facing } = {}) {
  fx.active = true;
  fx.t = 0;
  fx.posStar = vec3(posStar);
  fx.dirView = vec3(dirView);
  fx.strength = clamp01(fin(strength01));
  fx.facing = !!facing;
}

export function stepSnapFx(fx, dtSeconds, { still = false } = {}) {
  fx.still = !!still;
  if (!fx.active) return;
  const dt = Number.isFinite(dtSeconds) && dtSeconds > 0 ? dtSeconds : 0;
  fx.t += dt;
  if (fx.t >= EJECT_S) {
    fx.active = false;
    fx.t = 0;
  }
}

const smooth = (x) => x * x * (3 - 2 * x);

/** Flash intensity at elapsed t for a peak; 0 at t = 0 and from FLASH_S on. */
function flashAt(t, peak) {
  if (t <= 0 || t >= FLASH_S) return 0;
  const attack = t < FLASH_ATTACK_S ? smooth(t / FLASH_ATTACK_S) : 1;
  const d = 1 - t / FLASH_S;
  return peak * attack * d * d;
}

function progress(t, dur) {
  return t > 0 && t < dur ? t / dur : 0;
}

/** Writes into fx.out (a stable object, mutated in place) and returns it. */
export function snapUniforms(fx) {
  const o = fx.out;
  if (!fx.active) {
    o.uFlashPos[0] = o.uFlashPos[1] = o.uFlashPos[2] = 0;
    o.uPlumeDir[0] = o.uPlumeDir[1] = o.uPlumeDir[2] = 0;
    o.uFlash = o.uShock = o.uPlume = o.uHalo = 0;
    o.shake[0] = o.shake[1] = 0;
    return o;
  }
  const t = fx.t;
  const gain = 0.35 + 0.65 * fx.strength;
  o.uFlashPos[0] = fx.posStar[0];
  o.uFlashPos[1] = fx.posStar[1];
  o.uFlashPos[2] = fx.posStar[2];
  o.uPlumeDir[0] = fx.dirView[0] * gain;
  o.uPlumeDir[1] = fx.dirView[1] * gain;
  o.uPlumeDir[2] = fx.dirView[2] * gain;
  o.uFlash = flashAt(t, gain);
  o.uShock = progress(t, SHOCK_S);
  const ej = progress(t, EJECT_S);
  o.uPlume = fx.facing ? 0 : ej;
  o.uHalo = fx.facing ? ej : 0;

  // Camera impulse: kicked along the ejection's on-screen direction (screen y
  // is down), with a smaller cross wobble; envelope (1 - t/0.8)^2 * e^(-t/0.3)
  // reaches exactly 0 at 0.8 s with zero slope, and the sines start at 0.
  if (fx.still || t >= SHAKE_S) {
    o.shake[0] = o.shake[1] = 0;
  } else {
    let ax = fx.dirView[0];
    let ay = -fx.dirView[1];
    const l = Math.hypot(ax, ay);
    if (l > 0.2) { ax /= l; ay /= l; } else { ax = 0.6; ay = 0.8; }
    const d = 1 - t / SHAKE_S;
    // Normalised so the envelope x the first sine crest stays under SHAKE_PX.
    const amp = SHAKE_PX * fx.strength * d * d * Math.exp(-t / 0.3);
    const a = Math.sin(2 * Math.PI * SHAKE_HZ_A * t) * amp;
    const b = Math.sin(2 * Math.PI * SHAKE_HZ_B * t) * amp * 0.35;
    // |a| + |b| could exceed amp; scale so the vector length stays <= amp.
    const k = 1 / Math.hypot(1, 0.35);
    o.shake[0] = (ax * a - ay * b) * k;
    o.shake[1] = (ay * a + ax * b) * k;
  }
  return o;
}

/** Footpoint geometry at the snap: star-frame unit vector and view-space outward normal. */
export function snapGeometry(lat, lon, cam, rotLon = 0) {
  const la = fin(lat);
  const lo = fin(lon);
  const cl = Math.cos(la);
  return {
    posStar: [cl * Math.sin(lo), Math.sin(la), cl * Math.cos(lo)],
    dirView: viewNormal({ yaw: fin(cam?.yaw), pitch: fin(cam?.pitch) }, la, lo, fin(rotLon)),
  };
}

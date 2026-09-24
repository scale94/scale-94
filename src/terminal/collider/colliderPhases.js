// colliderPhases.js — timing curves for the collision chamber.
//
// This module owns durations, NOT the state graph. Six of the seven phase
// transitions are event-driven (a domain is selected, collide() resolves, the
// user resets); only colliding -> result is a clock, and even that fires from
// a timer in the component, never from the render loop. See spec section 6.
//
// ACCELERATE_MS and COLLIDE_MS are the old frame thresholds converted at
// 60fps -- the chamber used to count frames, so a 120Hz display played the
// whole collision at double speed. Everything else in this file is the
// stereochemical collider's timeline (spec 2026-09-24).

export const ACCELERATE_MS = 1800; // was progress = t / 108
export const COLLIDE_MS    = 2500; // was t > 150 -> result

export const PHASE_ID = { idle: 0, selecting: 1, accelerating: 2, colliding: 3, result: 4 };

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ══ Stereochemical collider (spec 2026-09-24) ════════════════════════════════
// The single source of truth for the new chamber. The shaders interpolate
// these constants into their GLSL, and the chamber uploads the envelopes
// computed here, so the functions tested are the functions rendered.

export const TIMELINE = Object.freeze({
  SHOCK_MS: 350,
  SHOCK_TAU_MS: 90,
  GLINT_MS: 40,
  DOCK_MS: 120,
  SQUASH_FROM: 0.6,
  SQUASH_TAU_MS: 250,
  BOND_BREAK_FROM_MS: 500,
  BOND_BREAK_SPAN_MS: 150,
  BOND_RETRACT_MS: 30,
  ARRIVE_FROM_MS: 40,
  ARRIVE_TO_MS: 90,
  VERTEX_TRANSIT_IN_MS: 8,
  VERTEX_FADE_FROM_MS: 650,
  VERTEX_FADE_TO_MS: 750,
  CAGE_END_MS: 800,
  NEEDLE_LAUNCH_FROM_MS: 500,
  NEEDLE_LAUNCH_SPAN_MS: 250,
  NEEDLE_FADE_FROM_MS: 1100,
  NEEDLE_END_MS: 1200,
  RING_LAUNCH_MS: Object.freeze([600, 780, 960]),
  RING_TAU_MS: 600,
  RING_IN_MS: 60,
  EMISSION_END_MS: 2400,
});

// Lengths in CSS px unless the name says otherwise. Starting values -- the
// author tunes these by eye through the scrub hook (spec §12).
export const GEOMETRY = Object.freeze({
  W_WALL: 70, KAPPA_LO: 1.5, KAPPA_HI: 6, A_TURB: 14, V1: 1.6, INGRESS_TAIL_S: 0.03,
  CAGE_R_PX: 60, CAMERA_D: 4, DOCK_FROM_PX: 140, DOCK_ZETA: 0.63, DOCK_OMEGA: 52.9,
  TUMBLE_RAD_S: 0.9,
  NEEDLE_SHARE: 0.6, NEEDLE_DRAG: 3, NEEDLE_TAIL_S: 0.035,
  SHOCK_R_FRAC: 0.42, SHOCK_ASPECT: 1.8, FRINGE_PX: 6, GLINT_SIGMA: 3,
  RING_RK: Object.freeze([0.22, 0.34, 0.46]), RING_ASPECT: 1.8, RING_ROUND: 0.15,
  LOCUS_PX_PER_MASS: 40,
});

export const GAINS = Object.freeze({
  INGRESS: 0.55, NEEDLE: 1.2, BOND: 1.1, VERTEX: 1.6,
  SHOCK: 1.6, GLINT: 2.5, RING: 0.9, SHADOW: 0.35,
  VERTEX_TRANSIT: 0.35,
});

// Frequencies keep the ratios of benzene's real vibrational modes, scaled into
// the visible band. f0 is the frequency at the LIGHTEST mass, so the 18 Hz
// ceiling is pinned where ω ∝ 1/√m would otherwise push it higher.
export const MODES = Object.freeze([
  Object.freeze({ name: 'C-H stretch', cm: 3062, f0: 18.0, tauMs: 80, amp: 0.06 }),
  Object.freeze({ name: 'C=C stretch', cm: 1596, f0: 9.4, tauMs: 180, amp: 0.05 }),
  Object.freeze({ name: 'ring breathing', cm: 992, f0: 5.8, tauMs: 450, amp: 0.08 }),
  Object.freeze({ name: 'out-of-plane bend', cm: 673, f0: 4.0, tauMs: 350, amp: 0.12 }),
]);
export const FREQ_CEILING_HZ = 18;
export const MASS_PITCH = 1.5;
export const KNEE = 0.6;

// Reduced motion paints exactly one permanent frame per phase (spec §7).
export const SNAP_MS = Object.freeze({ accelerating: 1800, colliding: 1300 });
export const SNAP_DEFAULT_MS = 1800;
export const snapMsFor = (phase) => SNAP_MS[phase] ?? SNAP_DEFAULT_MS;

const finiteMs = (ms) => (Number.isFinite(ms) && ms > 0 ? ms : 0);
const massOrHalf = (m) => (Number.isFinite(m) ? clamp01(m) : 0.5);
const smooth = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

export function modeFrequency(f0, meanMass) {
  return f0 / Math.sqrt(1 + MASS_PITCH * massOrHalf(meanMass));
}

export function ringThreeWeight(meanMass) {
  return smooth(0.3, 0.7, massOrHalf(meanMass));
}

export function mixHue01(a, b) {
  const d = ((((b - a) % 1) + 1.5) % 1) - 0.5;
  return (((a + d * 0.5) % 1) + 1) % 1;
}

// Max-channel Reinhard shoulder. The composite shader applies the same curve.
export function kneeScale(m) {
  if (!(m > KNEE)) return 1;
  const t = m - KNEE;
  const s = 1 - KNEE;
  return (KNEE + (s * t) / (t + s)) / m;
}

// ∫0^t (t'/T)^3 dt', continued at slope 1 past T. The streak shader's
// easeIntegral() is this function; position is the integral of speed, never
// speed x time (spec §5.2).
export function easeIntegralS(tSec) {
  const T = ACCELERATE_MS / 1000;
  if (!(tSec > 0)) return 0;
  if (tSec <= T) {
    const p = tSec / T;
    return T * p * p * p * p * 0.25;
  }
  return T * 0.25 + (tSec - T);
}

// Under-damped docking spring, ~8% overshoot, settled by DOCK_MS. The cage
// shader's dockCurve() is this function.
export function dockCurve(tSec) {
  if (!(tSec > 0)) return 0;
  const z = GEOMETRY.DOCK_ZETA;
  const w = GEOMETRY.DOCK_OMEGA;
  const k = Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * tSec) * (Math.cos(w * k * tSec) + (z / k) * Math.sin(w * k * tSec));
}

const smoothstep01 = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Vertex alpha along its (staggered) docking flight, tSec from its own start.
// Rises to GAINS.VERTEX_TRANSIT within VERTEX_TRANSIT_IN_MS so the eye tracks
// it in from the beam tips, then joins the bond ramp (ARRIVE_FROM..TO) to 1.
// The cage shader's vertexArrival() is this function.
export function vertexArrival(tSec) {
  const ms = tSec * 1000;
  return Math.max(
    GAINS.VERTEX_TRANSIT * smoothstep01(0, TIMELINE.VERTEX_TRANSIT_IN_MS, ms),
    smoothstep01(TIMELINE.ARRIVE_FROM_MS, TIMELINE.ARRIVE_TO_MS, ms),
  );
}

export function createTiming() {
  return {
    progress: 0, ease: 0,
    shockR: 0, shockA: 0, glint: 0,
    cageT: -1, cageA: 0, squash: 1,
    needleA: 0,
    ringR: new Float32Array(3), ringA: new Float32Array(3), ringP: new Float32Array(3),
  };
}

function inert(out) {
  out.progress = 0;
  out.ease = 0;
  out.shockR = 0;
  out.shockA = 0;
  out.glint = 0;
  out.cageT = -1;
  out.cageA = 0;
  out.squash = 1;
  out.needleA = 0;
  out.ringR.fill(0);
  out.ringA.fill(0);
  out.ringP.fill(0);
  return out;
}

export function timingInto(out, phase, elapsedMs) {
  const ms = finiteMs(elapsedMs);
  inert(out);

  if (phase === 'accelerating') {
    const p = clamp01(ms / ACCELERATE_MS);
    out.progress = p;
    out.ease = p * p * p;
    return out;
  }
  if (phase !== 'colliding') return out;

  const L = TIMELINE;
  out.progress = clamp01(ms / COLLIDE_MS);
  out.shockR = 1 - Math.exp(-ms / L.SHOCK_TAU_MS);
  out.shockA = ms < L.SHOCK_MS ? (1 - ms / L.SHOCK_MS) ** 2 : 0;
  out.glint = ms < L.GLINT_MS ? 1 - ms / L.GLINT_MS : 0;

  if (ms < L.CAGE_END_MS) {
    out.cageT = ms / 1000;
    out.cageA = ms < L.VERTEX_FADE_FROM_MS
      ? 1
      : clamp01(1 - (ms - L.VERTEX_FADE_FROM_MS) / (L.VERTEX_FADE_TO_MS - L.VERTEX_FADE_FROM_MS));
    out.squash = ms < L.DOCK_MS
      ? L.SQUASH_FROM
      : L.SQUASH_FROM + (1 - L.SQUASH_FROM) * (1 - Math.exp(-(ms - L.DOCK_MS) / L.SQUASH_TAU_MS));
  }

  if (ms >= L.NEEDLE_LAUNCH_FROM_MS) {
    out.needleA = ms < L.NEEDLE_FADE_FROM_MS
      ? 1
      : clamp01((L.NEEDLE_END_MS - ms) / (L.NEEDLE_END_MS - L.NEEDLE_FADE_FROM_MS));
  }

  if (ms < L.EMISSION_END_MS) {
    for (let k = 0; k < 3; k++) {
      const age = ms - L.RING_LAUNCH_MS[k];
      if (age < 0) continue;
      const p = age / (L.EMISSION_END_MS - L.RING_LAUNCH_MS[k]);
      out.ringR[k] = 1 - Math.exp(-age / L.RING_TAU_MS);
      out.ringA[k] = Math.min(1, age / L.RING_IN_MS) * (1 - p) * (1 - p);
      out.ringP[k] = p;
    }
  }
  return out;
}

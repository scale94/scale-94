// artMath.js — 3D math utilities for ArtTab sphere renderer
// Pure functions. Build rotation matrices, apply them, and perspective-project
// sphere coords onto Canvas2D — plus the idle rotation's own time step, which
// is the one thing here that needs a clock.
import { decayOverFrames, driftOverFrames } from './artRateGate.js';

// Build flat row-major 3×3 rotation matrix (Y then X rotation)
export function buildRotMatrix(rx, ry) {
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  return [
     cy,       0,    sy,
     sx * sy,  cx,  -sx * cy,
    -cx * sy,  sx,   cx * cy,
  ];
}

// Apply rotation matrix M to vector (x, y, z)
export function applyM(M, x, y, z) {
  return [
    M[0] * x + M[1] * y + M[2] * z,
    M[3] * x + M[4] * y + M[5] * z,
    M[6] * x + M[7] * y + M[8] * z,
  ];
}

// Perspective project rotated coords onto canvas
export function project(rx, ry, rz, w, h, sphereR, focal) {
  const denom = focal + rz * sphereR;
  const scale = Math.abs(denom) > 1e-9 ? focal / denom : 0;
  return {
    sx:    w / 2 + rx * sphereR * scale,
    sy:    h / 2 - ry * sphereR * scale,   // flip Y: canvas Y is down
    depth: rz,                              // [-1, +1] — used for alpha/size
    scale,
  };
}

// ── Canvas geometry: the normal-mode height, and the immersive ink scale ────
//
// ITEM 5b. The cage is `SPHERE_K * min(w, h)`, but `project()` above returns
// `focal / (focal + rz * sphereR)` — a ratio in which sphereR cancels. So the
// cage grows with the viewport and the INK does not: every line width and disc
// radius in this renderer is authored in screen px and multiplied by that
// scale, so immersive mode measured 1.393x sparser at 1520x900 and 1.757x at
// 1920x1080. `inkScale` is the factor that puts the ink back in proportion.
//
// NOT a literal 580. The normal-mode canvas is only pinned at 580 above about
// 892 px wide; below that it is 0.65 of the width, with a 360 floor. A literal
// would scale the ink against a sphere a narrow window never draws. Writing it
// as a RATIO of the two geometries also cancels breathMod and SPHERE_K, so the
// number depends on neither constant — and it is exactly 1 in normal mode by
// construction, because numerator and denominator are then the same expression
// evaluated on the same width.
export const NORMAL_H_K = 0.65;
export const NORMAL_H_MIN = 360;
export const NORMAL_H_MAX = 580;

/** The height ArtTab's ResizeObserver gives the canvas when NOT immersive.
 *  The `Math.floor` is the observer's own, kept here so the two agree exactly
 *  rather than to within a pixel — which is what makes inkScale's 1.0 exact. */
export function normalCanvasHeight(w) {
  return Math.floor(Math.min(Math.max(w * NORMAL_H_K, NORMAL_H_MIN), NORMAL_H_MAX));
}

/** How much larger this canvas's sphere is than the normal-mode sphere at the
 *  same width. Exactly 1 in normal mode; > 1 in immersive on any window whose
 *  height exceeds the normal-mode canvas it replaces. */
export function inkScale(w, h) {
  const denom = Math.min(w, normalCanvasHeight(w));
  return denom > 0 ? Math.min(w, h) / denom : 1;
}

// ── The sphere's own rotation, stepped on the clock ─────────────────────────
//
// `AUTO_SPIN` is per AUTHORED FRAME, as it always was — its comment used to say
// "rad/frame" and the draw loop took it literally, adding it once per DRAW, so
// the whole artwork turned at the display's refresh rate. MEASURED live at
// 283fps before this fix: 0.7083 rad/s against the authored 0.15, a full
// revolution in 8.9 SECONDS where it should take 41.9. On a 360Hz panel that is
// ~7s. Same defect as the particle cadences (see artRateGate.js), and the
// largest of the family by visible area: it is the entire picture turning, not
// one layer of it.
export const AUTO_SPIN = 0.0025;          // rad per authored frame, as shipped
export const ROT_DECAY_IDLE = 0.94;       // flick inertia retained per frame
export const ROT_DECAY_HOVER = 0.82;      // ...and while a node is hovered
export const ROT_HOVER_SPIN_K = 0.15;     // spin damped to this while hovering

/**
 * Advances the idle spin and the flick inertia by `dtFrames` authored frames.
 *
 * Mutates `rot` and `drag` in place, and does nothing while the pointer is
 * down: dragging drives rotation from pointer deltas, and this running too
 * would give the drag an inertia it has not been thrown with yet.
 *
 * `drag.vx/vy` keep their shipped units of RADIANS PER AUTHORED FRAME, which is
 * what the pointermove handler assigns (`dy * 0.005`), so nothing upstream has
 * to be rescaled.
 *
 * ── The order is NOT the particle integrator's ─────────────────────────────
 *
 * This decays FIRST and adds the already-decayed velocity; `stepParticles` adds
 * the raw velocity and decays after. So the drift factor carries one extra
 * factor of `retain` — the PER-FRAME constant, not `decay` (which is
 * `retain^dt`) — and dt = 1 must return `retain` here where it returns 1 there.
 * The two are equal at dt = 1, so the difference is invisible in a single 60fps
 * frame and wrong at every other rate. That is precisely why this is written
 * out rather than shared blindly, and why the composition law is asserted.
 */
export function stepAutoRotation(rot, drag, hovered, dtFrames) {
  if (drag.active || !(dtFrames > 0)) return;
  const retain = hovered ? ROT_DECAY_HOVER : ROT_DECAY_IDLE;
  const spin = (hovered ? AUTO_SPIN * ROT_HOVER_SPIN_K : AUTO_SPIN) * dtFrames;
  const decay = decayOverFrames(retain, dtFrames);
  // `retain *`, NOT `decay *`. Adding the POST-decay velocity shifts the whole
  // geometric series up by one factor of the PER-FRAME constant, and the series
  // r + r^2 + ... + r^n = r(r^n - 1)/(r - 1) is what composes. Using `decay`
  // (r^dt) here instead reads correctly at dt = 1, where the two are equal, and
  // breaks at every other rate — I wrote it that way first and the composition
  // test caught it. The dt = 1 assertions alone would have passed it.
  const drift = retain * driftOverFrames(retain, dtFrames);
  rot.rx += drag.vx * drift;
  rot.ry += drag.vy * drift + spin;
  drag.vx *= decay;
  drag.vy *= decay;
}

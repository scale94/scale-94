// artMath.js — 3D math utilities for ArtTab sphere renderer
// Pure functions, zero imports. Build rotation matrices, apply them,
// and perspective-project sphere coords onto Canvas2D.

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

// artPrismRipple.js — the prism pulse's sampling ripple on REAL chords.
//
// Shared by artPrismWave.test.js and scripts/_a18wsweep.mjs so the test and
// the instrument cannot measure different things. A LEAF: imports artEdges
// and artCurve, and nothing imports it back into the render path.
//
// Ripple = max - min, over one transit, of the reconstructed crest. The
// reconstruction is piecewise linear through the samples, and a piecewise-
// linear interpolant peaks at a sample, so the peak is the largest sampled
// amplitude. Only crest positions u in [0.25, 0.75] are scored; near the ends
// the endpoint genuinely clips the pulse.
import { prismControl, prismOffset, prismPulse } from './artEdges.js';
import { tessellateQuad, quadSegments } from './artCurve.js';

export const RIPPLE_SPANS = [20, 40, 70, 110, 160, 220, 300, 400, 520];
const DUR = 120;
const pts = new Float32Array(2 * 256);
const ctrl = new Float32Array(2);

export function rippleChordUs(span, k, n = 0) {
  const cx = 760, cy = 450;
  const ax = cx - span, ay = cy - span * 0.35;
  const bx = cx + span * 0.8, by = cy + span * 0.55;
  prismControl(ctrl, ax, ay, bx, by, cx, cy, prismOffset(k));
  const m = tessellateQuad(pts, ax, ay, ctrl[0], ctrl[1], bx, by,
    n || quadSegments(ax, ay, ctrl[0], ctrl[1], bx, by));
  let total = 0;
  for (let i = 0; i + 1 < m; i++) {
    total += Math.hypot(pts[i * 2 + 2] - pts[i * 2], pts[i * 2 + 3] - pts[i * 2 + 1]);
  }
  const us = [];
  let s = 0;
  for (let i = 0; i < m; i++) {
    if (i > 0) s += Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
    us.push(total > 1e-6 ? s / total : 0);
  }
  return us;
}

export function prismRipple(us, w) {
  let lo = Infinity, hi = -Infinity;
  for (let step = 0; step <= 600; step++) {
    const t = (0.25 + (step / 600) * 0.5) * DUR;
    let peak = 0;
    for (const u of us) {
      const a = prismPulse(u - t / DUR, w);
      if (a > peak) peak = a;
    }
    if (peak < lo) lo = peak;
    if (peak > hi) hi = peak;
  }
  return hi - lo;
}

/** Worst ripple over every span and spectral lines 0, 3, 6 at forced n. */
export function worstRipple(w, n) {
  let worst = 0;
  for (const span of RIPPLE_SPANS) {
    for (const k of [0, 3, 6]) worst = Math.max(worst, prismRipple(rippleChordUs(span, k, n), w));
  }
  return worst;
}

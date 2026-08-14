// artCurve.js — quadratic Bézier flattening, for the line layer that has none.
//
// Step 4 moved the sphere's strokes onto an instanced line-quad mesh. That mesh
// draws STRAIGHT segments; the prism chords (task 6) and, next, the analogy
// filaments and chimera boundaries (task 6b) are `ctx.quadraticCurveTo` paths.
// Nothing in SphereEdges can bend, so the curve is flattened on the CPU and
// emitted as a run of abutting segments.
//
// ── The criterion, and why it is this measure and not the obvious one ──────
//
// Write the quadratic in monomial form: with E = C - P0 and D = P0 - 2C + P2,
//
//   B(t) = P0 + 2Et + Dt²
//
// Subtract the chord (1-t)P0 + tP2 and the linear terms cancel exactly:
//
//   B(t) - chord(t) = -t(1 - t) D
//
// so the curve point and the chord point AT THE SAME PARAMETER are never more
// than |D|/4 apart, at t = 1/2, for every quadratic. That is the measure this
// module uses, and it is a strict UPPER BOUND on the distance from the curve to
// the segment (the chord point is on the segment). It is not the perpendicular
// deviation, which is smaller whenever D has a component along the chord.
//
// The obvious alternative — the perpendicular distance to the chord — is the
// smaller, prettier number and it is the wrong one here, because it does not
// SCALE. Restrict to a sub-interval [t0, t0+h] and substitute t = t0 + hs: the
// s² coefficient becomes Dh². The sub-curve is a quadratic whose D is scaled by
// h², identically for every sub-interval, so a uniform n-way split leaves every
// segment within exactly
//
//   |D| / (4n²)
//
// of its own chord. The perpendicular measure has no such form: each sub-chord
// has its own normal, so it would have to be recomputed per segment. Hence
// `quadSegments`: n = ceil( sqrt( |D| / (4·tol) ) ), one square root per curve,
// with a guarantee that holds pointwise on every segment at once.
//
// The price is conservatism on NEAR-CUSP curves — two nodes close together with
// the control point pulled far away, where the tangent nearly reverses and most
// of |D| is tangential. Measured on such a shape the bound is 2.0x the segments
// geometry demands (artCurve.test.js pins that figure). The tests brute-force
// the real error with de Casteljau and assert both that the tolerance holds and
// that n stays within 2.2x of the brute-forced floor, so neither the safety nor
// the waste can drift unnoticed.
//
// ── TWO criteria, because flatness alone does not bound the turn ───────────
//
// Two things want a say and BOTH bind, on different curves.
//
//   1. FLATNESS. A quarter pixel of lateral error on a 1.2px-wide core stroke
//      is ~20% of one pixel's coverage at the single worst point of each
//      segment, and smoothly less everywhere else.
//   2. THE JOINT NOTCH. Butt-capped segments meeting at a turn Δθ leave a wedge
//      on the outer side where the canvas put a miter join. Its opening is
//      2·halfW·sin(Δθ/2) ≈ w·Δθ/2 and its depth is halfW·(sec(Δθ/2) -
//      cos(Δθ/2)). The widest stroke that uses this module is the prism's k=0
//      glow pass at w = 5, so an opening under one pixel needs
//      Δθ ≤ 2·asin(1/5) = 0.4027 rad = 23.07°.
//
// The first draft of this module carried only (1), on the reasoning that a
// quadratic turns by less than 180° in total so a dozen joints must each take a
// small share. MEASURED, that is false: over the real prism geometry the worst
// joint turned 48.4° and 34 of 2366 joints were over 23°, i.e. a 2.05px notch
// where the budget is 1px. The reason is the NEAR-CUSP curve — two adjacent rim
// nodes with the control point pulled far toward the sphere centre — where the
// turning is not spread over the curve at all but concentrated into the one or
// two joints nearest the cusp. Flatness cannot see that: at a cusp most of |D|
// is tangential, so the flatness criterion is happy while the tangent whips
// through 50° between two 2px segments.
//
// Tightening CURVE_TOLERANCE instead was the obvious move and is the wrong one:
// the turn falls only as 1/n, so it would need ~4x the tolerance budget on
// EVERY curve — pushing the well-behaved majority into the segment ceiling — to
// fix the 1.4% that are near-cusp. `quadTurnSegments` is the targeted form and
// costs one cross product and one clamped projection.
//
// ── The ceiling, and what happens above it ─────────────────────────────────
//
// n is capped so the instance budget can be a fixed number rather than a guess
// (see MAX_ADDITIVE_EDGES in SphereEdges.js, which is computed FROM this
// ceiling). Where the cap binds, the curve gets slightly coarser — it never
// drops a segment and never drops an instance.
//
// FLATNESS never reaches the cap at or below 1920x1080. The sphere's largest
// projected radius there is ~486px (sphereR = 0.42·min(w,h) = 453.6, and
// perspective at focal = 2.8·R peaks the projected radius at 1.0705·R), the
// control point is pulled 55% of the way to the centre so |D| = 1.1·|centre −
// mid| + the spectral offset's ~21.5, topping out near 556 — and n = ceil(√|D|)
// = 24 exactly. At 2560x1440 it asks for 28 and gets 24, i.e. 0.32px of lateral
// deviation instead of 0.25.
//
// THE TURN CRITERION DOES REACH IT, AND THAT IS A REAL RESIDUAL DEVIATION.
// Rasterised over the layer's own archetype (two nodes s apart on a circle of
// radius m about the centre, control at 0.45m; scripts/_prismNotch.mjs, 0.02px
// grid, halfW 2.5), what the near-cusp end of the family costs:
//
//     m     s | nFlat nTurn   n | worst turn | w·Δθ/2 | measured deepest bite
//   404    90 |    22    25  24 |     23.25° |  1.008 |  0.500 px
//   404    60 |    22    37  24 |     34.30° |  1.474 |  0.731 px
//   404    40 |    22    56  24 |     49.68° |  2.100 |  1.042 px
//   486    20 |    24   133  24 |     96.16° |  3.720 |  1.860 px
//
// So the brief's target — worst-case notch under a pixel — is NOT reachable by
// choosing a flatness tolerance, which was the lever it named: the binding
// shape needs n = 133, i.e. 5.5x this ceiling and 5.5x a 5.6MB preallocation,
// for a hairpin between two nodes 20px apart. What the turn criterion buys is
// the middle of the family, and it is worth having: over the real layer the
// worst joint measured 48.4° before it and 35.6° after, i.e. w·Δθ/2 from 2.11px
// to 1.53px and the measured bite from 1.04px to 0.76px, for +3.4% instances
// (2590 -> 2678 on the six-node harness effect). Under a pixel by measurement,
// over it by the formula — both are in the task report. Closing the last of it
// over the OBSERVED geometry needs the ceiling at ~37 (7.3MB, +2.6MB); closing
// it over the whole archetype family needs 133 (26MB). The cap is left at 24
// and the trade is reported rather than taken unilaterally.
//
// Note what the two columns say about the formula: the MEASURED bite is
// consistently half of w·Δθ/2, because 2·halfW·sin(Δθ/2) is the chord between
// the two cap corners while the deepest unpainted point sits halfW·sin(Δθ/2)
// from the nearest rectangle. The formula is a safe overestimate, not the ink.

/** Flatness tolerance in CSS px: the largest distance any flattened segment is
 *  allowed to sit from the curve it replaces. */
export const CURVE_TOLERANCE = 0.25;

/** Largest turn allowed at one joint, in radians. `2·asin(1/w)` for the widest
 *  stroke drawn through this module (w = 5, the prism's k = 0 glow pass), which
 *  is the turn whose butt-cap notch opens by exactly one pixel:
 *  2·(w/2)·sin(Δθ/2) = 5·sin(0.2013) = 0.9933 px. Narrower strokes tolerate a
 *  larger turn, so deriving this from the widest one is the safe direction and
 *  keeps the module usable by task 6b's thinner curves unchanged. */
export const CURVE_TURN_TOLERANCE = 2 * Math.asin(1 / 5);

/** Hard ceiling on segments per curve. Read by SphereEdges.js to size the
 *  additive instance buffer, and the buffer is linear in it: one more segment
 *  is PRISM_MAX_EFFECTS x C(11,2) x 7 x 2 + 96 x 2 + 136 = 3408 more instances,
 *  i.e. 226 KiB
 *  of permanently held scratch per unit. Raising it is a memory decision, not a
 *  quality knob — see the header for what it would buy and what it would cost. */
export const CURVE_MAX_SEGMENTS = 24;

/**
 * How far a quadratic Bézier can stray from its own chord, in the same units as
 * the coordinates: the largest gap between the curve and the chord AT EQUAL
 * PARAMETER, which is |D|/4 exactly. An upper bound on the distance from the
 * curve to the chord segment, tight when the bow is perpendicular to the chord
 * and up to ~2x loose at a near-cusp. See the file header for why this measure
 * and not the perpendicular one.
 */
export function quadFlatness(ax, ay, cx, cy, bx, by) {
  const dx = ax - 2 * cx + bx;
  const dy = ay - 2 * cy + by;
  return Math.hypot(dx, dy) / 4;
}

/**
 * How many segments a uniform flattening needs before every one of them sits
 * within `tol` of the curve — the FLATNESS half of the criterion, on its own so
 * it can be tested against its own known answer.
 *
 * `Infinity` when the curve is unbounded; 1 when it is straight or the input is
 * non-finite (see `quadSegments` for why a NaN count is the worse failure).
 */
export function quadFlatSegments(ax, ay, cx, cy, bx, by, tol = CURVE_TOLERANCE) {
  const d = quadFlatness(ax, ay, cx, cy, bx, by);
  if (!(d > 0) || !(tol > 0)) return 1;
  const n = Math.ceil(Math.sqrt(d / tol));
  return Number.isFinite(n) ? Math.max(1, n) : Infinity;
}

/**
 * How many segments a uniform flattening needs before no single JOINT turns by
 * more than `turnTol`. Unbounded (`Infinity`) at a true cusp, where the tangent
 * reverses instantaneously and no finite flattening can hold any turn budget;
 * the caller clamps.
 *
 * ── The closed form ────────────────────────────────────────────────────────
 *
 * With v0 = C - P0 and v1 = P2 - C the tangent is B'(t) = 2·w(t) where
 * w(t) = (1-t)v0 + t·v1 — a point travelling in a STRAIGHT LINE from v0 to v1
 * as t runs 0→1. Two consequences do all the work:
 *
 *   • B(t2) - B(t1) = (t2 - t1)·B'((t1+t2)/2) exactly, for a quadratic. So a
 *     flattened segment's direction IS the tangent at its parameter midpoint,
 *     and the turn at a joint is the angle w sweeps over one step of 1/n.
 *   • dθ/dt = (w × w') / |w|² = (v0 × v1) / |w(t)|², because w × w' is
 *     (v0 + t·d) × d = v0 × d = v0 × v1, a CONSTANT.
 *
 * So the sweep over any interval of length 1/n is at most |v0 × v1| / (n·wmin²)
 * where wmin = min|w(t)| over [0,1] — the distance from the origin to the
 * segment [v0, v1], with the projection clamped to its ends. Invert:
 *
 *   n = ceil( |v0 × v1| / (turnTol · wmin²) )
 *
 * Conservative, because it charges every joint the rate at the tightest point
 * of the curve; the curve where that bites — the near-cusp — is exactly the one
 * that needed the segments.
 */
export function quadTurnSegments(ax, ay, cx, cy, bx, by,
                                 turnTol = CURVE_TURN_TOLERANCE) {
  const v0x = cx - ax, v0y = cy - ay;
  const v1x = bx - cx, v1y = by - cy;
  const cross = Math.abs(v0x * v1y - v0y * v1x);
  // Cross 0 means v0 and v1 are collinear, so the whole curve is a straight
  // line. Every flattened segment lies on it, so the only turn possible is 0 or
  // a 180° retrace — and at 180° the two segments lie exactly on top of each
  // other, leaving no outer wedge to notch. One segment is enough either way.
  if (!(cross > 0) || !(turnTol > 0)) return 1;
  const dx = v1x - v0x, dy = v1y - v0y;
  const dd = dx * dx + dy * dy;
  const t = dd > 0
    ? Math.max(0, Math.min(1, -(v0x * dx + v0y * dy) / dd))
    : 0;
  const wx = v0x + t * dx, wy = v0y + t * dy;
  const w2 = wx * wx + wy * wy;
  if (!(w2 > 0)) return Infinity;
  const n = Math.ceil(cross / (turnTol * w2));
  return Number.isFinite(n) ? Math.max(1, n) : Infinity;
}

/**
 * How many straight segments this curve needs before none of them sits further
 * than `tol` from it AND no joint turns by more than `turnTol`. At least 1, at
 * most `maxSeg`.
 *
 * BOTH criteria, because neither implies the other: flatness is blind to the
 * near-cusp (see the file header — measured 48.4° at one joint under flatness
 * alone) and the turn criterion is blind to a wide, gentle bow.
 *
 * Non-finite input collapses to 1 rather than to NaN: a NaN segment count makes
 * the writer's loop bound NaN, which silently emits nothing, and "the chords
 * vanished" is a much worse failure than one degenerate instance the shader
 * discards anyway.
 */
export function quadSegments(ax, ay, cx, cy, bx, by,
                             tol = CURVE_TOLERANCE, maxSeg = CURVE_MAX_SEGMENTS,
                             turnTol = CURVE_TURN_TOLERANCE) {
  const nFlat = quadFlatSegments(ax, ay, cx, cy, bx, by, tol);
  const nTurn = quadTurnSegments(ax, ay, cx, cy, bx, by, turnTol);
  const n = Math.max(nFlat, nTurn);
  if (!Number.isFinite(n)) return maxSeg;
  return Math.max(1, Math.min(maxSeg, n));
}

/**
 * Write the n+1 points of a uniform n-way flattening into `out` as xy pairs,
 * and return the number of POINTS written. The caller draws them as n segments,
 * point i to point i+1 — a shared point list, so consecutive segments abut on
 * the identical float and cannot overlap or gap. Under `lighter` that matters:
 * an overlap adds twice and beads at every joint.
 *
 * The Bernstein form, not the monomial one the header derives from: at t = 0
 * and t = 1 its weights are exactly 1 and 0, so the first and last points come
 * back bit-identical to the endpoints handed in. The polygon and the spokes are
 * NOT tessellated and meet these curves at the nodes, so an endpoint that
 * rounded would show as a hairline crack there.
 *
 * `out` is the caller's preallocated scratch — nothing here allocates.
 */
export function tessellateQuad(out, ax, ay, cx, cy, bx, by, n) {
  const segs = Math.max(1, n | 0);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const u = 1 - t;
    const w0 = u * u, w1 = 2 * u * t, w2 = t * t;
    out[i * 2]     = w0 * ax + w1 * cx + w2 * bx;
    out[i * 2 + 1] = w0 * ay + w1 * cy + w2 * by;
  }
  return segs + 1;
}

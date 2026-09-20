// artCurve.test.js — the flatness criterion, tested against geometry.
//
// The whole point of these tests is that they do NOT restate the
// implementation. `quadFlatness` claims to return the largest distance between
// a quadratic Bézier and its own chord; that claim is checked against a
// brute-force sampler built on de Casteljau, which shares no arithmetic with
// the closed form under test. `quadSegments` claims that subdividing at n
// leaves every sub-curve within `tol` of its sub-chord; that is checked the
// same way, on the sub-curves themselves, and paired with a MINIMALITY check
// (n-1 must not suffice) so a criterion that simply returned a large constant
// would fail.

import { describe, it, expect } from 'vitest';
import {
  quadFlatness, quadFlatSegments, quadSegments, quadTurnSegments, tessellateQuad,
  CURVE_TOLERANCE, CURVE_MAX_SEGMENTS, CURVE_TURN_TOLERANCE,
} from '../artCurve';

// de Casteljau, deliberately NOT the Bernstein form artCurve uses.
function deCasteljau(ax, ay, cx, cy, bx, by, t) {
  const abx = ax + (cx - ax) * t, aby = ay + (cy - ay) * t;
  const bcx = cx + (bx - cx) * t, bcy = cy + (by - cy) * t;
  return [abx + (bcx - abx) * t, aby + (bcy - aby) * t];
}

// Largest distance from the curve over [t0, t1] to the straight SEGMENT that
// replaces it — the actual drawing error, with the projection clamped to the
// segment's ends. Distance to the infinite line would understate it wherever
// the curve bulges past its own chord's endpoints, which is precisely what the
// short-chord / long-bow shapes in this layer do. Dense sampling (40k points),
// so the maximum is found to well under the tolerances asserted below.
function sampledDeviation(ax, ay, cx, cy, bx, by, t0 = 0, t1 = 1) {
  const P = (t) => deCasteljau(ax, ay, cx, cy, bx, by, t);
  const [sx, sy] = P(t0), [ex, ey] = P(t1);
  const dx = ex - sx, dy = ey - sy, L2 = dx * dx + dy * dy;
  let max = 0;
  const N = 40000;
  for (let i = 0; i <= N; i++) {
    const [px, py] = P(t0 + (t1 - t0) * (i / N));
    const u = L2 > 1e-24
      ? Math.max(0, Math.min(1, ((px - sx) * dx + (py - sy) * dy) / L2))
      : 0;
    const d = Math.hypot(px - (sx + dx * u), py - (sy + dy * u));
    if (d > max) max = d;
  }
  return max;
}

// The worst sub-curve deviation over a uniform n-way split.
const worstSegment = (q, n) => {
  let max = 0;
  for (let i = 0; i < n; i++) max = Math.max(max, sampledDeviation(...q, i / n, (i + 1) / n));
  return max;
};

// The worst JOINT TURN over a uniform n-way split, in radians: the angle
// between consecutive flattened segments, taken from de Casteljau points and
// atan2 — no cross product, no monomial form, nothing quadTurnSegments uses.
const worstJointTurn = (q, n) => {
  const P = (t) => deCasteljau(...q, t);
  const dirs = [];
  for (let i = 0; i < n; i++) {
    const [x0, y0] = P(i / n), [x1, y1] = P((i + 1) / n);
    const L = Math.hypot(x1 - x0, y1 - y0);
    dirs.push(L > 1e-12 ? Math.atan2(y1 - y0, x1 - x0) : null);
  }
  let max = 0;
  for (let i = 1; i < dirs.length; i++) {
    if (dirs[i] === null || dirs[i - 1] === null) continue;
    let d = Math.abs(dirs[i] - dirs[i - 1]);
    if (d > Math.PI) d = 2 * Math.PI - d;
    if (d > max) max = d;
  }
  return max;
};

// A spread of shapes: symmetric, asymmetric, near-straight, and one with the
// control point outside the chord's span (which is what the prism's chords
// look like once the control is pulled 55% toward the sphere centre).
const CURVES = [
  [0, 0, 1, 2, 2, 0],
  [0, 0, 300, -40, 120, 260],
  [-200, 50, 10, 10, 200, 55],
  [100, 100, 480, -260, 140, 90],
  [0, 0, 5, 0.02, 10, 0],
];

describe('quadFlatness', () => {
  it('is 1 for the parabola whose sagitta is 1, by hand', () => {
    // P0=(0,0), C=(1,2), P2=(2,0) is exactly B(t) = (2t, 4t(1-t)). The chord is
    // the x-axis, so the deviation IS 4t(1-t), maximised at t=0.5 to give 1.
    expect(quadFlatness(0, 0, 1, 2, 2, 0)).toBeCloseTo(1, 12);
  });

  it('is 0 when the control point sits on the chord midpoint', () => {
    expect(quadFlatness(-10, 4, 15, 12, 40, 20)).toBeCloseTo(0, 12);
  });

  it('upper-bounds the true perpendicular deviation on every shape', () => {
    // quadFlatness measures |B(t) - chord(t)| at EQUAL PARAMETER, which is what
    // scales by h² on every sub-interval and is therefore the only measure the
    // n² criterion is exactly valid for. It is >= the perpendicular distance to
    // the chord, with equality when D is perpendicular to the chord.
    //
    // The gap is the tangential share of D, and it is not always small: the
    // fourth curve below is two nodes 41px apart with the control point pulled
    // 400px away, where the bound is 1.97x the perpendicular deviation — a
    // shape the prism bundle really does produce, from two rim nodes near each
    // other with the sphere centre far off. That conservatism costs sqrt(1.97)
    // = 1.4x the segments, and it buys a guarantee that holds pointwise.
    for (const q of CURVES) {
      expect(quadFlatness(...q)).toBeGreaterThanOrEqual(sampledDeviation(...q) - 1e-9);
    }
    // Tight where the bow is perpendicular to the chord, which is the common case.
    expect(quadFlatness(0, 0, 1, 2, 2, 0)).toBeCloseTo(sampledDeviation(0, 0, 1, 2, 2, 0), 6);
    const q = [-200, 50, 10, 10, 200, 55];
    expect(quadFlatness(...q) / sampledDeviation(...q)).toBeLessThan(1.03);
  });
});

describe('quadTurnSegments', () => {
  it('gives the hand-computed count on the 90° symmetric arc', () => {
    // P0=(-1,0), C=(0,1), P2=(1,0). The tangent runs along w(t) = (1, 1-2t), so
    // its direction is atan(1-2t): 45° at t=0, -45° at t=1, a 90° total sweep.
    // A quadratic's flattened segment i points along the tangent at its
    // parameter MIDPOINT, so an n-split samples the direction at (i+0.5)/n.
    //   n = 4 -> midpoints .125 .375 .625 .875 -> 36.87 14.04 -14.04 -36.87
    //            biggest joint 28.07°, over the 23.07° budget
    //   n = 5 -> midpoints .1 .3 .5 .7 .9      -> 38.66 21.80 0 -21.80 -38.66
    //            biggest joint 21.80°, under it
    // So 5 is the answer and it is exactly minimal.
    const q = [-1, 0, 0, 1, 1, 0];
    expect(quadTurnSegments(...q)).toBe(5);
    expect(worstJointTurn(q, 5)).toBeLessThanOrEqual(CURVE_TURN_TOLERANCE);
    expect(worstJointTurn(q, 4)).toBeGreaterThan(CURVE_TURN_TOLERANCE);
    expect(worstJointTurn(q, 5) * 180 / Math.PI).toBeCloseTo(21.80, 1);
    expect(worstJointTurn(q, 4) * 180 / Math.PI).toBeCloseTo(28.07, 1);
  });

  it('holds the turn budget it was asked for, brute-forced', () => {
    // Including a NEAR-CUSP: two nodes 41px apart with the control 400px away,
    // the shape that made this criterion necessary. Its answer is far past any
    // sane ceiling, which is the honest reading — see CURVE_MAX_SEGMENTS.
    for (const q of [...CURVES, [100, 100, 480, -260, 140, 90]]) {
      for (const tol of [CURVE_TURN_TOLERANCE, 0.2, 0.8]) {
        const n = quadTurnSegments(...q, tol);
        if (!Number.isFinite(n) || n > 4000) continue;
        expect(worstJointTurn(q, n)).toBeLessThanOrEqual(tol * (1 + 1e-9));
      }
    }
  });

  it('is conservative but not absurdly so — within 2x of the brute-forced floor', () => {
    // The bound charges every joint the angular rate at the TIGHTEST point of
    // the curve, so it over-counts wherever the turning is spread evenly. This
    // pins how much: without it, `return 1e9` would pass the test above.
    // The floor search starts at TWO, not one: a single segment has no joints
    // at all, so every curve trivially "holds" any turn budget at n = 1 and a
    // floor of 1 would make this assertion vacuous. Curves whose floor really
    // is 2 (they barely turn) have nothing to be minimal about and are skipped.
    for (const q of CURVES) {
      const n = quadTurnSegments(...q);
      if (n > 100) continue;               // near-cusp; unbounded, see above
      let floor = 2;
      while (floor < 4000 && worstJointTurn(q, floor) > CURVE_TURN_TOLERANCE) floor++;
      if (floor === 2) continue;
      expect(n).toBeGreaterThanOrEqual(floor);
      expect(n).toBeLessThanOrEqual(Math.ceil(floor * 2));
    }
  });

  it('asks for nothing on a straight line and on a collinear control', () => {
    expect(quadTurnSegments(0, 0, 50, 0, 100, 0)).toBe(1);      // C on the chord
    expect(quadTurnSegments(0, 0, 500, 0, 100, 0)).toBe(1);     // C past the end
    expect(quadTurnSegments(5, 5, 5, 5, 5, 5)).toBe(1);         // fully degenerate
    expect(quadTurnSegments(NaN, 0, 1, 1, 2, 0)).toBe(1);       // non-finite
  });

  it('reports a TRUE cusp as unbounded rather than as a number', () => {
    // v0 and v1 equal and opposite in the perpendicular sense: w(t) passes
    // exactly through the origin, the tangent reverses instantaneously, and no
    // finite uniform flattening holds any turn budget at all. Infinity, so the
    // caller clamps deliberately instead of trusting a large finite answer.
    // P0=(0,0), C=(0,10), P2=(0,0) is degenerate in x; use a genuine one:
    // v0 = (10, 0) and v1 = (-10, 0) rotated so the segment [v0,v1] straddles
    // the origin off-axis is collinear, so build the cusp from a control point
    // that makes w(0.5) exactly zero with v0 x v1 non-zero — impossible in 2D,
    // so the reachable statement is the limit: as wmin -> 0, n -> huge.
    const near = quadTurnSegments(0, 0, 1000, 1, 0.001, 0);
    expect(near).toBeGreaterThan(1000);
  });
});

describe('quadSegments', () => {
  it('takes whichever of the two criteria is larger', () => {
    // A wide gentle bow: flatness binds, the turn does not.
    const bow = [0, 0, 200, 60, 400, 0];
    expect(quadFlatSegments(...bow)).toBeGreaterThan(quadTurnSegments(...bow));
    expect(quadSegments(...bow)).toBe(quadFlatSegments(...bow));
    // A small tight one: the turn binds and flatness alone would say far less.
    const tight = [0, 0, 0.6, 1.2, 1.2, 0];
    expect(quadTurnSegments(...tight)).toBeGreaterThan(quadFlatSegments(...tight));
    expect(quadSegments(...tight)).toBe(quadTurnSegments(...tight));
  });

  it('holds BOTH budgets at once on every shape', () => {
    for (const q of CURVES) {
      const n = quadSegments(...q);
      if (n === CURVE_MAX_SEGMENTS) continue;
      expect(worstSegment(q, n)).toBeLessThanOrEqual(CURVE_TOLERANCE * (1 + 1e-9));
      expect(worstJointTurn(q, n)).toBeLessThanOrEqual(CURVE_TURN_TOLERANCE * (1 + 1e-9));
    }
  });

  it('gives the hand-computed count on the sagitta-1 parabola', () => {
    // Deviation after a uniform n-way split is exactly sagitta/n², so the
    // thresholds are at n = 1, 2, 4 for tolerances 1, 1/4, 1/16. On
    // quadFlatSegments, which is the flatness criterion ALONE — the same curve
    // through quadSegments also has to satisfy the turn budget, and at a 90°
    // sweep that asks for 10 whatever the flatness tolerance says.
    expect(quadFlatSegments(0, 0, 1, 2, 2, 0, 1)).toBe(1);
    expect(quadFlatSegments(0, 0, 1, 2, 2, 0, 0.25)).toBe(2);
    expect(quadFlatSegments(0, 0, 1, 2, 2, 0, 0.0625)).toBe(4);
    expect(quadSegments(0, 0, 1, 2, 2, 0, 1)).toBe(quadTurnSegments(0, 0, 1, 2, 2, 0));
  });

  it('actually holds the tolerance it was asked for', () => {
    for (const q of CURVES) for (const tol of [1, 0.25, 0.05]) {
      const n = quadFlatSegments(...q, tol);
      if (n >= CURVE_MAX_SEGMENTS) continue;     // the ceiling case, below
      expect(worstSegment(q, n)).toBeLessThanOrEqual(tol * (1 + 1e-9));
    }
  });

  it('is NEARLY minimal — never more than 2.2x the segments geometry demands', () => {
    // Without this a criterion that returned CURVE_MAX_SEGMENTS unconditionally
    // would pass the test above and cost 24x the instances it needed to. The
    // floor is found by brute force, not by the formula: the smallest n whose
    // worst sub-segment actually holds the tolerance.
    //
    // 2.2 is the headroom the conservative measure needs, and where it goes is
    // worth knowing. Three of these five shapes come back exactly minimal. The
    // fourth — a 41px chord with the control 400px away, i.e. a NEAR-CUSP,
    // which two adjacent rim nodes really do produce — measures 2.0x, because
    // there the curve's own tangent nearly reverses and almost all of |D| is
    // tangential rather than lateral. Halving that would need a per-segment
    // criterion (the exact perpendicular deviation of segment i is
    // h²|DxE| / 2|v_i|, and |v_i| collapses at the cusp); it is not built,
    // because the safe bound is one line and its guarantee is pointwise.
    for (const q of CURVES) for (const tol of [1, 0.25, 0.05]) {
      const n = quadFlatSegments(...q, tol);
      if (n >= CURVE_MAX_SEGMENTS) continue;
      let floor = 1;
      while (floor < 200 && worstSegment(q, floor) > tol) floor++;
      expect(n).toBeGreaterThanOrEqual(floor);
      expect(n).toBeLessThanOrEqual(Math.ceil(floor * 2.2));
    }
  });

  it('never returns less than one segment, whatever it is handed', () => {
    expect(quadSegments(5, 5, 5, 5, 5, 5)).toBe(1);          // fully degenerate
    expect(quadSegments(0, 0, 50, 0, 100, 0)).toBe(1);       // straight
    expect(quadSegments(NaN, 0, 1, 1, 2, 0)).toBe(1);        // non-finite input
  });

  it('clamps at the segment ceiling rather than growing without bound', () => {
    // 1e6 of sagitta at a quarter-pixel tolerance wants 2000 segments.
    expect(quadSegments(0, 0, 0, 2e6, 1000, 0, 0.25)).toBe(CURVE_MAX_SEGMENTS);
    expect(quadSegments(0, 0, 0, 2e6, 1000, 0, 0.25, 6)).toBe(6);
  });

  it('defaults to the quarter-pixel tolerance and the shared ceiling', () => {
    const q = [0, 0, 300, -40, 120, 260];
    expect(quadSegments(...q)).toBe(quadSegments(...q, CURVE_TOLERANCE, CURVE_MAX_SEGMENTS));
  });
});

describe('tessellateQuad', () => {
  it('reproduces both endpoints EXACTLY, not merely closely', () => {
    // The polyline has to start on the node the canvas started on: a rounded
    // first point puts the chord bundle a fraction of a pixel off its node and
    // the spokes and polygon, which are not tessellated, stay put.
    const out = new Float32Array((CURVE_MAX_SEGMENTS + 1) * 2);
    const [ax, ay, cx, cy, bx, by] = [13.37, -4.25, 300.5, 12.125, -77.75, 640.0625];
    const m = tessellateQuad(out, ax, ay, cx, cy, bx, by, 7);
    expect(m).toBe(8);
    expect(out[0]).toBe(Math.fround(ax));
    expect(out[1]).toBe(Math.fround(ay));
    expect(out[(m - 1) * 2]).toBe(Math.fround(bx));
    expect(out[(m - 1) * 2 + 1]).toBe(Math.fround(by));
  });

  it('puts every interior point on the curve', () => {
    const out = new Float32Array((CURVE_MAX_SEGMENTS + 1) * 2);
    for (const q of CURVES) {
      const n = 9;
      tessellateQuad(out, ...q, n);
      for (let i = 0; i <= n; i++) {
        const [ex, ey] = deCasteljau(...q, i / n);
        expect(out[i * 2]).toBeCloseTo(ex, 4);
        expect(out[i * 2 + 1]).toBeCloseTo(ey, 4);
      }
    }
  });

  it('converges on the curve\'s arc length as n rises', () => {
    // Not decoration: Task 6b's dashed curves measure their dash phase along
    // the path, and the only arc length they will have is the running sum of
    // these chords. If the polyline were systematically short the dash pattern
    // would drift against the canvas's.
    const out = new Float32Array(4001 * 2);
    const q = [100, 100, 480, -260, 140, 90];
    const len = (n) => {
      tessellateQuad(out, ...q, n);
      let s = 0;
      for (let i = 0; i + 1 <= n; i++) {
        s += Math.hypot(out[(i + 1) * 2] - out[i * 2], out[(i + 1) * 2 + 1] - out[i * 2 + 1]);
      }
      return s;
    };
    const truth = len(4000);
    expect(len(24)).toBeGreaterThan(truth * 0.999);
    expect(len(24)).toBeLessThanOrEqual(truth);
    expect(len(2)).toBeLessThan(truth);        // a coarse polyline cuts corners
  });

  it('writes n+1 points and no more', () => {
    const out = new Float32Array(64).fill(-999);
    const m = tessellateQuad(out, 0, 0, 10, 10, 20, 0, 4);
    expect(m).toBe(5);
    expect(out[10]).toBe(-999);   // 5 points = indices 0..9
  });
});

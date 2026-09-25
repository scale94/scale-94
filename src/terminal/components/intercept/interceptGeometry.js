// interceptGeometry.js — where the lattice sits on the WorldMap ghost
// (800 × 400 viewBox, geoNaturalEarth1). Computed once at module load.

import { toMapXY } from '../../data/worldMapPolys';
import { NODES, EU_MEMBERS } from '../../lib/interceptLattice';

const XY = Object.fromEntries(NODES.map((n) => {
  const [x, y] = toMapXY(n.lonlat[0], n.lonlat[1]);
  return [n.id, [x + n.nudge[0], y + n.nudge[1]]];
}));

export const nodeXY = (id) => XY[id];

// Andrew's monotone chain; collinear points are dropped.
export function convexHull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

const pathOf = (poly) => `M${poly.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')} Z`;

// The hull pushed outward from its centroid by `pad` map units.
export function membranePath(points, pad) {
  const hull = convexHull(points);
  const cx = hull.reduce((s, q) => s + q[0], 0) / hull.length;
  const cy = hull.reduce((s, q) => s + q[1], 0) / hull.length;
  const out = hull.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.hypot(dx, dy) || 1;
    return [x + (dx / d) * pad, y + (dy / d) * pad];
  });
  return pathOf(out);
}

export const EU_MEMBRANE_PATH = membranePath(EU_MEMBERS.map(nodeXY), 12);

// ── Hit cells ────────────────────────────────────────────────────────────────
// Each node owns the points nearer to it than to any other node (its Voronoi
// cell), capped at HIT_R: gapless and overlap-free, whatever the render order.
export const HIT_R = 28;

// Sutherland–Hodgman against one half-plane, keeping f(p) <= 0.
function clip(poly, f) {
  const out = [];
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[(i + poly.length - 1) % poly.length];
    const b = poly[i];
    const fa = f(a);
    const fb = f(b);
    if ((fa <= 0) !== (fb <= 0)) {
      const t = fa / (fa - fb);
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
    if (fb <= 0) out.push(b);
  }
  return out;
}

export function hitCell(id) {
  const [x, y] = nodeXY(id);
  let poly = Array.from({ length: 32 }, (_, k) => {
    const a = (k / 32) * 2 * Math.PI;
    return [x + HIT_R * Math.cos(a), y + HIT_R * Math.sin(a)];
  });
  for (const n of NODES) {
    if (n.id === id) continue;
    const [ox, oy] = nodeXY(n.id);
    const mx = (x + ox) / 2;
    const my = (y + oy) / 2;
    poly = clip(poly, ([px, py]) => (px - mx) * (ox - x) + (py - my) * (oy - y));
  }
  return poly;
}

export const HIT_CELL_PATHS = Object.fromEntries(NODES.map((n) => [n.id, pathOf(hitCell(n.id))]));

// ── Touch loupe ──────────────────────────────────────────────────────────────
// The European cluster (UK included: not a member, but inside the crowd) fans
// out into a ring of finger-sized buttons when a touch lands in it.
export const CROWDED = ['UK', 'IE', 'FR', 'BE', 'NL', 'DE', 'SE'];

const CROWD_PTS = CROWDED.map(nodeXY);
export const CROWD_MIN_SPACING = Math.min(...CROWD_PTS.flatMap((a, i) =>
  CROWD_PTS.slice(i + 1).map((b) => Math.hypot(a[0] - b[0], a[1] - b[1]))));
const CROWD_CX = CROWD_PTS.reduce((s, p) => s + p[0], 0) / CROWD_PTS.length;
const CROWD_CY = CROWD_PTS.reduce((s, p) => s + p[1], 0) / CROWD_PTS.length;
const CROWD_BY_ANGLE = CROWDED
  .map((id, i) => ({ id, a: Math.atan2(CROWD_PTS[i][1] - CROWD_CY, CROWD_PTS[i][0] - CROWD_CX) }))
  .sort((p, q) => p.a - q.a);

export const needsLoupe = (unitsPerPx) => CROWD_MIN_SPACING / unitsPerPx < 24;

export function loupeLayout(unitsPerPx) {
  const n = CROWDED.length;
  const s = Math.sin(Math.PI / n);
  // Outer diameter in px for a button of b px: (b + 6) / s + b, kept <= 0.8 × map height.
  const fit = (0.8 * (400 / unitsPerPx) - 6 / s) / (1 / s + 1);
  const btnPx = Math.min(44, Math.max(32, fit));
  const btnR = (btnPx / 2) * unitsPerPx;
  const ringR = (btnR + 3 * unitsPerPx) / s;
  const start = CROWD_BY_ANGLE[0].a;
  const offs = CROWD_BY_ANGLE.map((_, k) => {
    const a = start + (k / n) * 2 * Math.PI;
    return [ringR * Math.cos(a), ringR * Math.sin(a)];
  });
  const clampTo = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const cx = clampTo(CROWD_CX, btnR - Math.min(...offs.map((o) => o[0])), 800 - btnR - Math.max(...offs.map((o) => o[0])));
  const cy = clampTo(CROWD_CY, btnR - Math.min(...offs.map((o) => o[1])), 400 - btnR - Math.max(...offs.map((o) => o[1])));
  const items = CROWD_BY_ANGLE.map(({ id }, k) => {
    const [fromX, fromY] = nodeXY(id);
    return { id, x: cx + offs[k][0], y: cy + offs[k][1], fromX, fromY };
  });
  return { cx, cy, btnR, ringR, items };
}

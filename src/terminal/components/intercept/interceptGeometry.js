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
  return `M${out.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')} Z`;
}

export const EU_MEMBRANE_PATH = membranePath(EU_MEMBERS.map(nodeXY), 12);

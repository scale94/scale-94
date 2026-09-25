import { describe, it, expect } from 'vitest';
import { NODE_IDS } from '../../../lib/interceptLattice';
import {
  nodeXY, HIT_R, hitCell, nodeAt, HIT_CELL_PATHS, CROWDED, CROWD_MIN_SPACING, loupeLayout, needsLoupe,
} from '../interceptGeometry';

// Even-odd ray cast.
function inside([x, y], poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

const angle = ([x, y], [cx, cy]) => Math.atan2(y - cy, x - cx);
// Rotate a list so it starts at its smallest element; compares cyclic orders.
const cyclic = (ids) => {
  const i = ids.indexOf([...ids].sort()[0]);
  return ids.slice(i).concat(ids.slice(0, i));
};

describe('hit cells (nearest node, capped at HIT_R)', () => {
  it('holds its own node and no other', () => {
    for (const id of NODE_IDS) {
      const cell = hitCell(id);
      expect(inside(nodeXY(id), cell)).toBe(true);
      for (const other of NODE_IDS) if (other !== id) expect(inside(nodeXY(other), cell)).toBe(false);
    }
  });

  it('never overlaps across the European cluster', () => {
    const cells = CROWDED.map(hitCell);
    const pts = CROWDED.map(nodeXY);
    const x0 = Math.min(...pts.map((p) => p[0])) - HIT_R;
    const x1 = Math.max(...pts.map((p) => p[0])) + HIT_R;
    const y0 = Math.min(...pts.map((p) => p[1])) - HIT_R;
    const y1 = Math.max(...pts.map((p) => p[1])) + HIT_R;
    let covered = 0;
    for (let x = Math.floor(x0); x <= x1; x += 1) {
      for (let y = Math.floor(y0); y <= y1; y += 1) {
        const n = cells.filter((c) => inside([x, y], c)).length;
        expect(n).toBeLessThanOrEqual(1);
        covered += n;
      }
    }
    expect(covered).toBeGreaterThan(0);
  });

  it('gives the FR→BE midpoint, one unit toward BE, to BE', () => {
    const [fx, fy] = nodeXY('FR');
    const [bx, by] = nodeXY('BE');
    const d = Math.hypot(bx - fx, by - fy);
    const p = [(fx + bx) / 2 + (bx - fx) / d, (fy + by) / 2 + (by - fy) / d];
    expect(inside(p, hitCell('BE'))).toBe(true);
    expect(inside(p, hitCell('FR'))).toBe(false);
  });

  it('keeps the full cap on the isolated nodes', () => {
    for (const id of ['US', 'AU']) {
      const [x, y] = nodeXY(id);
      const r = Math.max(...hitCell(id).map(([px, py]) => Math.hypot(px - x, py - y)));
      expect(r).toBeCloseTo(HIT_R, 5);
    }
  });

  it('serialises every cell as a closed path', () => {
    for (const id of NODE_IDS) expect(HIT_CELL_PATHS[id]).toMatch(/^M-?\d+\.\d -?\d+\.\d( L-?\d+\.\d -?\d+\.\d)+ Z$/);
  });
});

describe('nodeAt (capped-cell membership)', () => {
  it('finds each node at its own point', () => {
    for (const id of NODE_IDS) expect(nodeAt(nodeXY(id))).toBe(id);
  });

  it('splits FR and BE at their bisector', () => {
    const [fx, fy] = nodeXY('FR');
    const [bx, by] = nodeXY('BE');
    const d = Math.hypot(bx - fx, by - fy);
    const at = (k) => [(fx + bx) / 2 + (k * (bx - fx)) / d, (fy + by) / 2 + (k * (by - fy)) / d];
    expect(nodeAt(at(1))).toBe('BE');
    expect(nodeAt(at(-1))).toBe('FR');
  });

  it('stops at HIT_R', () => {
    const [x, y] = nodeXY('AU');
    expect(nodeAt([x - (HIT_R - 0.1), y])).toBe('AU');
    expect(nodeAt([x - (HIT_R + 0.1), y])).toBeNull();
    expect(nodeAt([10, 390])).toBeNull();
  });

  it('agrees with the drawn cells', () => {
    let checked = 0;
    for (let x = 330; x <= 470; x += 2) {
      for (let y = 20; y <= 150; y += 2) {
        for (const id of CROWDED) {
          if (inside([x, y], hitCell(id))) { expect(nodeAt([x, y])).toBe(id); checked += 1; }
        }
      }
    }
    expect(checked).toBeGreaterThan(500);
  });
});

describe('touch loupe layout', () => {
  it('measures the crowd from the positions', () => {
    const pairs = CROWDED.flatMap((a, i) => CROWDED.slice(i + 1).map((b) => [a, b]));
    const min = Math.min(...pairs.map(([a, b]) => Math.hypot(nodeXY(a)[0] - nodeXY(b)[0], nodeXY(a)[1] - nodeXY(b)[1])));
    expect(CROWD_MIN_SPACING).toBe(min);
    expect(CROWD_MIN_SPACING).toBeCloseTo(21.6, 1);
  });

  it('fans the cluster into a ring that fits a 345px phone map', () => {
    const upp = 800 / 345;
    const L = loupeLayout(upp);
    expect(L.items).toHaveLength(7);
    expect(L.items.map((it) => it.id).sort()).toEqual([...CROWDED].sort());
    for (const it of L.items) {
      expect(it.x - L.btnR).toBeGreaterThanOrEqual(0);
      expect(it.x + L.btnR).toBeLessThanOrEqual(800);
      expect(it.y - L.btnR).toBeGreaterThanOrEqual(0);
      expect(it.y + L.btnR).toBeLessThanOrEqual(400);
      expect([it.fromX, it.fromY]).toEqual(nodeXY(it.id));
    }
    for (let i = 0; i < L.items.length; i += 1) {
      const a = L.items[i];
      const b = L.items[(i + 1) % L.items.length];
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(2 * L.btnR);
    }
    const btnPx = (L.btnR / upp) * 2;
    expect(btnPx).toBeGreaterThanOrEqual(32);
    expect(btnPx).toBeLessThanOrEqual(44);
  });

  it('keeps each button in its true compass order', () => {
    const L = loupeLayout(800 / 345);
    const pts = CROWDED.map(nodeXY);
    const centroid = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
    const trueOrder = [...CROWDED].sort((a, b) => angle(nodeXY(a), centroid) - angle(nodeXY(b), centroid));
    const ringOrder = [...L.items].sort((a, b) => angle([a.x, a.y], [L.cx, L.cy]) - angle([b.x, b.y], [L.cx, L.cy])).map((it) => it.id);
    expect(cyclic(ringOrder)).toEqual(cyclic(trueOrder));
  });

  it('uses full 44px buttons on a wide screen', () => {
    const upp = 800 / 1400;
    const L = loupeLayout(upp);
    expect((L.btnR / upp) * 2).toBeCloseTo(44, 6);
  });

  it('only opens when the cluster is crowded at the rendered scale', () => {
    expect(needsLoupe(800 / 345)).toBe(true);
    expect(needsLoupe(800 / 1600)).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import {
  cageBasePositions, cageBonds, cageRest, cageRestFlat, buildCageInstances,
  CAGE_VERTEX_COUNT, CAGE_BOND_COUNT, CAGE_INSTANCE_COUNT,
} from '../cageTopology';

const base = cageBasePositions();
const bonds = cageBonds(base);
const rest = cageRest();
const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('cageTopology — truncated octahedron (sodalite cage)', () => {
  it('has 24 vertices and 36 bonds', () => {
    expect(base).toHaveLength(CAGE_VERTEX_COUNT);
    expect(bonds).toHaveLength(CAGE_BOND_COUNT);
    expect(CAGE_INSTANCE_COUNT).toBe(60);
  });

  it('is 3-regular: every vertex has exactly three bonds', () => {
    const deg = new Array(24).fill(0);
    for (const [i, j] of bonds) { deg[i]++; deg[j]++; }
    expect(new Set(deg)).toEqual(new Set([3]));
  });

  it('has 6 square faces and, by Euler, 8 hexagons', () => {
    const adj = Array.from({ length: 24 }, () => new Set());
    for (const [i, j] of bonds) { adj[i].add(j); adj[j].add(i); }
    // Every 4-cycle of this graph is a square face; hexagons contain none.
    const squares = new Set();
    for (let a = 0; a < 24; a++) {
      for (const b of adj[a]) {
        for (const c of adj[b]) {
          if (c === a) continue;
          for (const d of adj[c]) {
            if (d === a || d === b) continue;
            if (adj[d].has(a)) squares.add([a, b, c, d].sort((x, y) => x - y).join(','));
          }
        }
      }
    }
    expect(squares.size).toBe(6);
    const faces = 2 - 24 + 36;
    expect(faces).toBe(14);
    expect(faces - squares.size).toBe(8);
  });

  it('keeps every bond the same length after tilt and normalisation', () => {
    const want = Math.SQRT2 / Math.sqrt(5);
    for (const [i, j] of bonds) expect(len(rest[i], rest[j])).toBeCloseTo(want, 9);
  });

  it('puts every vertex on the unit sphere', () => {
    for (const v of rest) expect(Math.hypot(...v)).toBeCloseTo(1, 9);
  });

  it('is tilted so x = 0 splits the vertices 12 / 12 with none near the plane', () => {
    const xs = rest.map((v) => v[0]);
    expect(xs.filter((x) => x < 0)).toHaveLength(12);
    expect(Math.min(...xs.map(Math.abs))).toBeGreaterThan(0.05);
  });

  it('packs 36 bond rows then 24 vertex rows', () => {
    const b = buildCageInstances();
    expect(b).toHaveLength(180);
    for (let k = 0; k < 36; k++) {
      expect(b[k * 3 + 2]).toBe(0);
      expect(b[k * 3]).not.toBe(b[k * 3 + 1]);
    }
    for (let v = 0; v < 24; v++) {
      const o = (36 + v) * 3;
      expect([b[o], b[o + 1], b[o + 2]]).toEqual([v, v, 1]);
    }
  });

  it('flattens the rest positions for a vec3[24] uniform', () => {
    const f = cageRestFlat();
    expect(f).toBeInstanceOf(Float32Array);
    expect(f).toHaveLength(72);
    expect(f[3]).toBeCloseTo(rest[1][0], 6);
  });
});

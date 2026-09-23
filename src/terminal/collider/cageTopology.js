// cageTopology.js — the cage the collision docks into (spec §6.2).
//
// A truncated octahedron: 24 vertices = every permutation of (0, ±1, ±2),
// 36 bonds = the vertex pairs at distance √2, faces 8 hexagons + 6 squares.
// It is the sodalite cage of zeolite chemistry -- a real molecular cage --
// and the hexagons are the benzene read. Fixed topology, built once: no
// Delaunay and no per-frame work.
//
// Pure, no imports, Node-importable.

export const CAGE_VERTEX_COUNT = 24;
export const CAGE_BOND_COUNT = 36;
export const CAGE_INSTANCE_COUNT = CAGE_BOND_COUNT + CAGE_VERTEX_COUNT; // bonds first, then vertices

// Chosen by search so the plane x = 0 splits the vertices 12/12 with the
// nearest vertex ~0.31 of the circumradius away from it -- docking sends
// x < 0 vertices in from beam A and x > 0 from beam B, so none may sit on it.
export const CAGE_TILT = Object.freeze({ yaw: 0.78, pitch: 0.16, roll: 0.11 });
const CIRCUMRADIUS = Math.sqrt(5);

export function cageBasePositions() {
  const out = [];
  for (let zeroAxis = 0; zeroAxis < 3; zeroAxis++) {
    const others = [0, 1, 2].filter((a) => a !== zeroAxis);
    for (const [a1, a2] of [[others[0], others[1]], [others[1], others[0]]]) {
      for (const s1 of [-1, 1]) {
        for (const s2 of [-1, 1]) {
          const v = [0, 0, 0];
          v[a1] = s1;
          v[a2] = 2 * s2;
          out.push(v);
        }
      }
    }
  }
  return out;
}

export function cageBonds(pos) {
  const out = [];
  for (let i = 0; i < pos.length; i++) {
    for (let j = i + 1; j < pos.length; j++) {
      const d2 = (pos[i][0] - pos[j][0]) ** 2 + (pos[i][1] - pos[j][1]) ** 2 + (pos[i][2] - pos[j][2]) ** 2;
      if (Math.abs(d2 - 2) < 1e-9) out.push([i, j]);
    }
  }
  return out;
}

// x-axis pitch, then y-axis yaw, then z-axis roll.
function tilt([x0, y0, z0], { yaw, pitch, roll }) {
  let c = Math.cos(pitch);
  let s = Math.sin(pitch);
  const y1 = c * y0 - s * z0;
  const z1 = s * y0 + c * z0;
  c = Math.cos(yaw);
  s = Math.sin(yaw);
  const x2 = c * x0 + s * z1;
  const z2 = -s * x0 + c * z1;
  c = Math.cos(roll);
  s = Math.sin(roll);
  return [c * x2 - s * y1, s * x2 + c * y1, z2];
}

export function cageRest() {
  return cageBasePositions().map((v) => tilt(v, CAGE_TILT).map((c) => c / CIRCUMRADIUS));
}

export function cageRestFlat() {
  return Float32Array.from(cageRest().flat());
}

export function buildCageInstances() {
  const bonds = cageBonds(cageBasePositions());
  const out = new Float32Array(CAGE_INSTANCE_COUNT * 3);
  bonds.forEach(([i, j], k) => {
    out[k * 3] = i;
    out[k * 3 + 1] = j;
    out[k * 3 + 2] = 0;
  });
  for (let v = 0; v < CAGE_VERTEX_COUNT; v++) {
    const o = (CAGE_BOND_COUNT + v) * 3;
    out[o] = v;
    out[o + 1] = v;
    out[o + 2] = 1;
  }
  return out;
}

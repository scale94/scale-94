// Disk matter for the accretion field (field spec §7.3): a tileable noise
// texture sampled in (log r, ψ), advected by Keplerian shear through two
// crossfaded flow layers so the shear can never wind up.

import { mulberry32 } from './councilCollider';

export const MATTER_N = 512;
export const T_FLOW = 14;            // s: one flow layer's lifetime
export const INNER_PERIOD_S = 7;     // ISCO orbital period on screen
export const OMEGA_ISCO_VIS = (2 * Math.PI) / INNER_PERIOD_S;
export const omegaVis = (r) => OMEGA_ISCO_VIS * (r / 3) ** -1.5;

const OCTAVES = [8, 16, 32, 64];     // lattice periods; each divides MATTER_N → tileable
const CONTRAST = 2.2;
const smooth = (t) => t * t * (3 - 2 * t);

export function makePeriodicNoise(seed = 0x5ca1e94) {
  const rand = mulberry32(seed);
  const grids = OCTAVES.map((p) => {
    const g = new Float32Array(p * p);
    for (let i = 0; i < g.length; i++) g[i] = rand();
    return { p, g, cell: MATTER_N / p };
  });
  const norm = OCTAVES.reduce((s, _, k) => s + 0.5 ** k, 0);
  return (x, y) => {
    let v = 0;
    grids.forEach(({ p, g, cell }, k) => {
      const fx = x / cell, fy = y / cell;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = smooth(fx - x0), ty = smooth(fy - y0);
      const at = (ix, iy) => g[(((iy % p) + p) % p) * p + (((ix % p) + p) % p)];
      const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
      const bot = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
      v += 0.5 ** k * (top + (bot - top) * ty);
    });
    return v / norm;
  };
}

export function bakeMatterTexture(seed) {
  const noise = makePeriodicNoise(seed);
  const out = new Uint8Array(MATTER_N * MATTER_N);
  for (let y = 0; y < MATTER_N; y++) {
    for (let x = 0; x < MATTER_N; x++) {
      const v = (noise(x, y) - 0.5) * CONTRAST + 0.5;
      out[y * MATTER_N + x] = Math.round(Math.min(1, Math.max(0, v)) * 255);
    }
  }
  return out;
}

let cache = null;
export const matterTexture = () => (cache ??= bakeMatterTexture());

// Two layers half a period apart. Each advects for at most T_FLOW seconds,
// then re-seeds exactly when its triangle weight is zero. Computed in float64
// here (not in GLSL) so days of uptime never erode the phase.
export function flowLayers(tSec) {
  const q0 = tSec / T_FLOW;
  const q1 = q0 + 0.5;
  const p0 = q0 - Math.floor(q0);
  const p1 = q1 - Math.floor(q1);
  return {
    tau0: p0 * T_FLOW,
    tau1: p1 * T_FLOW,
    seed0: mulberry32(Math.floor(q0) * 2 + 1)(),
    seed1: mulberry32(Math.floor(q1) * 2 + 2)(),
    w0: 1 - Math.abs(2 * p0 - 1),
  };
}

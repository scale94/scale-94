// 64×32 test world: polar rows (|lat| > 78°) are land, plus an optional
// rectangular island at i 40..44, j 14..17 (lon ≈ 48°–70°E, lat ≈ 8°S–11°N).
import { makeGrid, LAT_LIMIT } from '../grid';
import { analyzeLand } from '../landMask';

export function syntheticWorld({ island = true } = {}) {
  const grid = makeGrid(64, 32);
  const land = new Uint8Array(grid.n);
  for (let j = 0; j < grid.ny; j++) {
    const polar = Math.abs(grid.latOf(j)) > LAT_LIMIT;
    for (let i = 0; i < grid.nx; i++) {
      const isl = island && i >= 40 && i <= 44 && j >= 14 && j <= 17;
      if (polar || isl) land[grid.idx(i, j)] = 1;
    }
  }
  return { grid, mask: analyzeLand(grid, land) };
}

export function uniformVelocity(grid, u, v) {
  const vel = new Float32Array(grid.n * 2);
  for (let k = 0; k < grid.n; k++) {
    vel[k * 2] = u;
    vel[k * 2 + 1] = v;
  }
  return vel;
}

// Cosine bump of radius r cells centred on (ci, cj), wrap-aware in i.
// Values go into every channel in `channels`, scaled by `peak`.
export function blob(grid, land, ci, cj, r, peak = 1, channels = [0, 1, 2, 3]) {
  const state = new Float32Array(grid.n * 4);
  for (let j = 0; j < grid.ny; j++) {
    for (let i = 0; i < grid.nx; i++) {
      let di = Math.abs(i - ci);
      di = Math.min(di, grid.nx - di);
      const d = Math.hypot(di, j - cj);
      const k = grid.idx(i, j);
      if (d >= r || land[k]) continue;
      const v = peak * 0.5 * (1 + Math.cos((Math.PI * d) / r));
      for (const c of channels) state[k * 4 + c] = v;
    }
  }
  return state;
}

// Area-weighted total of channel c over ocean cells.
export function mass(grid, land, state, c) {
  let m = 0;
  for (let j = 0; j < grid.ny; j++) {
    for (let i = 0; i < grid.nx; i++) {
      const k = j * grid.nx + i;
      if (!land[k]) m += state[k * 4 + c] * grid.cosLat[j];
    }
  }
  return m;
}

// gpuData.js — packs the CPU-side ocean data into RGBA float arrays for the
// GPU runner. Layouts are the GPU contract in the spec; row 0 = south.

import { rowConstants } from '../referenceStep';

export function packStatic(grid, land, vel) {
  const out = new Float32Array(grid.n * 4);
  for (let k = 0; k < grid.n; k++) {
    out[k * 4] = vel[2 * k];
    out[k * 4 + 1] = vel[2 * k + 1];
    out[k * 4 + 2] = land[k];
  }
  return out;
}

// ny × 2 texture: row 0 = [kd, ka, doSat, cosLat], row 1 = [cos north face, cos south face, 0, 0].
export function packRows(grid) {
  const { ny, dlat } = grid;
  const rows = rowConstants(grid);
  const rad = Math.PI / 180;
  const out = new Float32Array(ny * 2 * 4);
  for (let j = 0; j < ny; j++) {
    out[j * 4] = rows[j].kd;
    out[j * 4 + 1] = rows[j].ka;
    out[j * 4 + 2] = rows[j].doSat;
    out[j * 4 + 3] = grid.cosLat[j];
    const q = (ny + j) * 4;
    out[q] = Math.cos((-90 + (j + 1) * dlat) * rad);
    out[q + 1] = Math.cos((-90 + j * dlat) * rad);
  }
  return out;
}

// Per-cell Σ conc·f (1/day units); the react pass adds src·Δt. Land stays 0,
// matching inject(), which skips land cells.
export function packSources(grid, land, sources) {
  const out = new Float32Array(grid.n * 4);
  for (const src of sources) {
    for (const { k, f } of src.cells) {
      if (land[k]) continue;
      for (let c = 0; c < 4; c++) out[k * 4 + c] += src.conc[c] * f;
    }
  }
  return out;
}

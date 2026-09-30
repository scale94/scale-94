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

// Contiguous row runs [j0, rows], ascending, covering every row that any of
// the cell lists touches (the ghost's old and new splats).
export function sourceRowBands(grid, ...cellLists) {
  const touched = new Set();
  for (const cells of cellLists) for (const { k } of cells) touched.add(Math.floor(k / grid.nx));
  const out = [];
  for (const j of [...touched].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && last[0] + last[1] === j) last[1]++;
    else out.push([j, 1]);
  }
  return out;
}

// Rows j0..j0+rows-1 of `base` (a packSources array of the permanent sources)
// plus Σ conc·f of the `extra` sources in those rows — identical, bit for bit,
// to packSources([...permanent, ...extra]) over the same rows.
export function packSourceRows(grid, land, base, extra, j0, rows) {
  const { nx } = grid;
  const out = base.slice(j0 * nx * 4, (j0 + rows) * nx * 4);
  for (const src of extra) {
    for (const { k, f } of src.cells) {
      const j = Math.floor(k / nx);
      if (j < j0 || j >= j0 + rows || land[k]) continue;
      const o = (k - j0 * nx) * 4;
      for (let c = 0; c < 4; c++) out[o + c] += src.conc[c] * f;
    }
  }
  return out;
}

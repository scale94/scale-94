// grid.js — the Ledger ocean's equirectangular grid.
// Row 0 is the southernmost row (matches the GL texture origin); columns wrap
// east–west. Cells are square in km only when ny = nx / 2, which is enforced.

export const R_EARTH_KM = 6371;
export const LAT_LIMIT = 78;
export const DT_DAYS = 0.25;

export function makeGrid(nx = 512, ny = nx / 2) {
  if (ny * 2 !== nx) throw new Error(`makeGrid: ny must be nx / 2 (got ${nx}×${ny})`);
  const dlon = 360 / nx;
  const dlat = 180 / ny;
  const cellKm = (2 * Math.PI * R_EARTH_KM) / nx;
  const wrapI = (i) => ((i % nx) + nx) % nx;
  const idx = (i, j) => j * nx + wrapI(i);
  const latOf = (j) => -90 + (j + 0.5) * dlat;
  const lonOf = (i) => -180 + (i + 0.5) * dlon;
  const cosLat = new Float64Array(ny);
  for (let j = 0; j < ny; j++) cosLat[j] = Math.cos((latOf(j) * Math.PI) / 180);
  const lonLatToCell = (lon, lat) => ({
    i: wrapI(Math.floor((lon + 180) / dlon)),
    j: Math.min(ny - 1, Math.max(0, Math.floor((lat + 90) / dlat))),
  });
  return Object.freeze({ nx, ny, n: nx * ny, dlon, dlat, cellKm, wrapI, idx, latOf, lonOf, cosLat, lonLatToCell });
}

export const OCEAN_GRID = makeGrid(512, 256);

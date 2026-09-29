// streamFunction.js — climatological surface currents as the curl of a
// stream function ψ, so the flow is divergence-free by construction.
// HUD legend: CLIMATOLOGICAL CURRENTS · NOT FORECAST.
//
// Sign convention: u = −∂ψ/∂y (east), v = ∂ψ/∂x (north). A positive ψ bump
// circulates clockwise — Northern-Hemisphere subtropical gyres are sign +1.

import { R_EARTH_KM } from './grid';

const DEG_KM = (Math.PI / 180) * R_EARTH_KM;

// lon1 may exceed 180 for cells crossing the antimeridian.
// peak: target speed at the western boundary (km/day). eps: Stommel
// boundary-layer width as a fraction of the cell width.
export const GYRE_CELLS = [
  { name: 'north-pacific-subtropical', lon0: 118, lon1: 245, lat0: 12, lat1: 45, sign: 1, peak: 150, eps: 0.04 },
  { name: 'north-atlantic-subtropical', lon0: -82, lon1: -8, lat0: 12, lat1: 45, sign: 1, peak: 150, eps: 0.05 },
  { name: 'south-pacific-subtropical', lon0: 150, lon1: 290, lat0: -45, lat1: -12, sign: -1, peak: 60, eps: 0.05 },
  { name: 'south-atlantic-subtropical', lon0: -52, lon1: 15, lat0: -40, lat1: -10, sign: -1, peak: 60, eps: 0.06 },
  { name: 'indian-subtropical', lon0: 32, lon1: 115, lat0: -40, lat1: -10, sign: -1, peak: 80, eps: 0.05 },
  { name: 'north-pacific-subpolar', lon0: 140, lon1: 235, lat0: 45, lat1: 62, sign: -1, peak: 40, eps: 0.08 },
  { name: 'north-atlantic-subpolar', lon0: -65, lon1: -5, lat0: 45, lat1: 65, sign: -1, peak: 40, eps: 0.08 },
  // Regional cells for the source rivers (one frozen season).
  { name: 'gulf-louisiana-texas-shelf', lon0: -98, lon1: -81, lat0: 18, lat1: 30.5, sign: -1, peak: 40, eps: 0.2 },
  { name: 'east-china-sea-shelf', lon0: 119, lon1: 131, lat0: 24, lat1: 36, sign: 1, peak: 40, eps: 0.15 },
  { name: 'east-korea-warm', lon0: 127, lon1: 142, lat0: 35, lat1: 47, sign: 1, peak: 30, eps: 0.15 },
  { name: 'north-sea', lon0: -4, lon1: 10, lat0: 51, lat1: 61, sign: -1, peak: 20, eps: 0.3 },
  { name: 'black-sea-rim', lon0: 27, lon1: 42, lat0: 40.5, lat1: 47, sign: -1, peak: 30, eps: 0.3 },
  { name: 'bay-of-bengal', lon0: 79, lon1: 95, lat0: 5, lat1: 23, sign: 1, peak: 40, eps: 0.15 },
  { name: 'java-sea', lon0: 105, lon1: 118, lat0: -8, lat1: -2.5, sign: 1, peak: 20, eps: 0.3 },
  { name: 'ionian', lon0: 15, lon1: 23, lat0: 36, lat1: 41, sign: -1, peak: 15, eps: 0.3 },
];

// Antarctic Circumpolar Current: eastward zonal band.
export const ACC = { latNorth: -45, latSouth: -65, peak: 40 };

function stommel(x, eps) {
  return (1 - x) * (1 - Math.exp(-x / eps));
}

const maxCache = new Map();
function stommelMax(eps) {
  if (!maxCache.has(eps)) {
    let m = 0;
    for (let s = 0; s <= 2000; s++) m = Math.max(m, stommel(s / 2000, eps));
    maxCache.set(eps, m);
  }
  return maxCache.get(eps);
}

function smoothstep(t) {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

// Peak |∂ψ/∂x| sits at the western edge: A · (1/eps) / max(X) / widthKm.
export function cellAmplitude(cell) {
  const width = cell.lon1 - cell.lon0;
  const midLat = (cell.lat0 + cell.lat1) / 2;
  const widthKm = width * DEG_KM * Math.cos((midLat * Math.PI) / 180);
  return cell.peak * widthKm * cell.eps * stommelMax(cell.eps);
}

export function gyrePsi(lon, lat, cells = GYRE_CELLS) {
  let psi = 0;
  for (const c of cells) {
    const width = c.lon1 - c.lon0;
    const dx = (((lon - c.lon0) % 360) + 360) % 360;
    if (dx > width) continue;
    const y = (lat - c.lat0) / (c.lat1 - c.lat0);
    if (y <= 0 || y >= 1) continue;
    psi += c.sign * cellAmplitude(c) * (stommel(dx / width, c.eps) / stommelMax(c.eps)) * Math.sin(Math.PI * y);
  }
  return psi;
}

// Rises from 0 at latNorth to A at latSouth, so u = −∂ψ/∂y is eastward.
// Smoothstep's peak slope is 1.5, which sets A from the target peak speed.
export function accPsi(lat, acc = ACC) {
  if (!acc) return 0;
  const span = acc.latNorth - acc.latSouth;
  const A = (acc.peak * span * DEG_KM) / 1.5;
  return A * smoothstep((acc.latNorth - lat) / span);
}

export function bakeCurrents(grid, mask, { cells = GYRE_CELLS, acc = ACC, bandCells = 8, iterations = 600, omega = 1.8 } = {}) {
  const { nx, ny, n, cellKm, dlat, dlon } = grid;
  const { land, comp, compCount, dist, nearest } = mask;
  const raw = (lon, lat) => gyrePsi(lon, lat, cells) + accPsi(lat, acc);

  // Island rule, approximated: every land component holds the mean raw ψ of
  // its coastal ring (Antarctica ≈ the ACC amplitude, mid-gyre islands ≈ their
  // local gyre value, continents ≈ a small mixed mean).
  const sum = new Float64Array(compCount);
  const cnt = new Float64Array(compCount);
  for (let k = 0; k < n; k++) {
    if (dist[k] !== 1) continue;
    const i = k % nx;
    const j = (k - i) / nx;
    sum[nearest[k]] += raw(grid.lonOf(i), grid.latOf(j));
    cnt[nearest[k]] += 1;
  }
  const coastPsi = new Float64Array(compCount);
  for (let c = 0; c < compCount; c++) coastPsi[c] = cnt[c] ? sum[c] / cnt[c] : 0;

  // Corners: land corners are pinned to their component's constant. Ocean
  // corners within bandCells of land get a harmonic correction φ (∇²φ = 0,
  // Gauss–Seidel SOR) that blends the pinned coast values into the raw field
  // with no seams and no fixed-width ramp jets. Farther corners keep raw ψ.
  const NC = nx * (ny + 1);
  const psiRaw = new Float64Array(NC);
  const pinned = new Int32Array(NC).fill(-1);
  const free = new Uint8Array(NC);
  for (let j = 0; j <= ny; j++) {
    const lat = -90 + j * dlat;
    for (let i = 0; i < nx; i++) {
      const c = j * nx + i;
      psiRaw[c] = raw(-180 + i * dlon, lat);
      let landComp = -1;
      let minDist = Infinity;
      for (let t = 0; t < 4; t++) {
        const ci = i - 1 + (t & 1);
        const cj = j - 1 + (t >> 1);
        if (cj < 0 || cj >= ny) continue;
        const k = grid.idx(ci, cj);
        if (land[k]) {
          if (landComp < 0) landComp = comp[k];
        } else if (dist[k] >= 0 && dist[k] < minDist) minDist = dist[k];
      }
      if (landComp >= 0) pinned[c] = landComp;
      else if (j > 0 && j < ny && minDist <= bandCells) free[c] = 1;
    }
  }
  const phi = new Float64Array(NC);
  for (let c = 0; c < NC; c++) if (pinned[c] >= 0) phi[c] = coastPsi[pinned[c]] - psiRaw[c];
  for (let it = 0; it < iterations; it++) {
    for (let j = 1; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const c = j * nx + i;
        if (!free[c]) continue;
        const avg = 0.25 * (phi[j * nx + grid.wrapI(i + 1)] + phi[j * nx + grid.wrapI(i - 1)] + phi[c + nx] + phi[c - nx]);
        phi[c] += omega * (avg - phi[c]);
      }
    }
  }
  const psi = new Float64Array(NC);
  // Pinned corners take the constant directly (not raw + φ) so every face
  // between two corners of one land component has exactly zero flux.
  for (let c = 0; c < NC; c++) psi[c] = pinned[c] >= 0 ? coastPsi[pinned[c]] : psiRaw[c] + phi[c];

  const P = (i, j) => psi[j * nx + grid.wrapI(i)];
  const uFace = new Float32Array(n);
  const vFace = new Float32Array(n);
  for (let j = 0; j < ny; j++) {
    const cosN = Math.cos(((-90 + (j + 1) * dlat) * Math.PI) / 180);
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      uFace[k] = -(P(i + 1, j + 1) - P(i + 1, j)) / cellKm;
      vFace[k] = cosN > 1e-9 ? (P(i + 1, j + 1) - P(i, j + 1)) / (cellKm * cosN) : 0;
    }
  }

  const vel = new Float32Array(n * 2);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (land[k]) continue;
      vel[2 * k] = (uFace[grid.idx(i - 1, j)] + uFace[k]) / 2;
      vel[2 * k + 1] = ((j > 0 ? vFace[k - nx] : 0) + vFace[k]) / 2;
    }
  }
  return { psi, uFace, vFace, vel };
}

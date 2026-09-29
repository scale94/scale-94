// referenceStep.js — CPU oracle for one ocean step. The GL passes in phase 2
// must reproduce this within tolerance (GPU parity gate). State is RGBA
// interleaved per cell: [ΔT, BOD, nitrate, deficit].

import { DT_DAYS, LAT_LIMIT } from './grid';
import { TAU_T_DAYS, TAU_N_DAYS, kd, kaOcean, sagStep, doSat, sstClimatology } from './kinetics';

export const EDDY_DIFFUSIVITY_KM2_DAY = 86.4; // 1000 m²/s horizontal eddy diffusivity

// Per-row reaction constants at the latitude SST climatology. Shared with the
// GPU row texture so both sides use identical numbers.
export function rowConstants(grid) {
  const rows = [];
  for (let j = 0; j < grid.ny; j++) {
    const sst = sstClimatology(grid.latOf(j));
    rows.push({ kd: kd(sst), ka: kaOcean(sst), doSat: doSat(sst) });
  }
  return rows;
}

// Diffusion substeps so D·h/Δx² ≤ 0.2 at the narrowest simulated row.
// Shared with the GPU runner so both substep identically.
export function diffusionSchedule(grid, dtDays, D = EDDY_DIFFUSIVITY_KM2_DAY) {
  if (!(D > 0)) return { sub: 0, h: 0 };
  let minDx = Infinity;
  for (let j = 0; j < grid.ny; j++) {
    if (Math.abs(grid.latOf(j)) <= LAT_LIMIT) minDx = Math.min(minDx, grid.cellKm * grid.cosLat[j]);
  }
  const sub = Math.max(1, Math.ceil((D * dtDays) / (minDx * minDx) / 0.2));
  return { sub, h: dtDays / sub };
}

export function createOceanContext(grid, land, vel) {
  const rows = rowConstants(grid);
  const size = grid.n * 4;
  return {
    grid, land, vel, rows,
    a: new Float32Array(size), b: new Float32Array(size),
    c: new Float32Array(size), d: new Float32Array(size),
  };
}

// Bilinear sample of all 4 channels at continuous cell coords (x, y), cell
// (i, j) centred at (i, j), over OCEAN texels only. Also records the min/max
// of those texels for the limiter. Returns false when all four are land.
const S = { v: new Float64Array(4), lo: new Float64Array(4), hi: new Float64Array(4) };
function sample(grid, land, field, x, yIn) {
  const { nx, ny } = grid;
  const y = Math.min(ny - 1, Math.max(0, yIn));
  const i0 = Math.floor(x);
  const j0 = Math.min(ny - 2, Math.floor(y));
  const fx = x - i0;
  const fy = y - j0;
  S.v.fill(0);
  S.lo.fill(Infinity);
  S.hi.fill(-Infinity);
  let wsum = 0;
  for (let t = 0; t < 4; t++) {
    const di = t & 1;
    const dj = t >> 1;
    const k = (j0 + dj) * nx + grid.wrapI(i0 + di);
    if (land[k]) continue;
    const w = (di ? fx : 1 - fx) * (dj ? fy : 1 - fy);
    wsum += w;
    for (let c = 0; c < 4; c++) {
      const val = field[k * 4 + c];
      S.v[c] += w * val;
      if (val < S.lo[c]) S.lo[c] = val;
      if (val > S.hi[c]) S.hi[c] = val;
    }
  }
  if (wsum < 1e-9) return false;
  for (let c = 0; c < 4; c++) S.v[c] /= wsum;
  return true;
}

function copyCell(src, dst, k) {
  for (let c = 0; c < 4; c++) dst[k * 4 + c] = src[k * 4 + c];
}

// Semi-Lagrangian: dst(x) = src(x − u·dt). Back-traces landing on land keep
// the cell's own value.
export function advect(ctx, src, dst, dtDays) {
  const { grid, land, vel } = ctx;
  const { nx, ny, cellKm, cosLat } = grid;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (land[k]) {
        dst.fill(0, k * 4, k * 4 + 4);
        continue;
      }
      const x = i - (vel[2 * k] * dtDays) / (cellKm * cosLat[j]);
      const y = j - (vel[2 * k + 1] * dtDays) / cellKm;
      if (sample(grid, land, src, x, y)) for (let c = 0; c < 4; c++) dst[k * 4 + c] = S.v[c];
      else copyCell(src, dst, k);
    }
  }
}

// BFECC with a min/max limiter: forward, backward, correct, forward again,
// then clamp to the range of the ORIGINAL field's source texels.
export function advectBFECC(ctx, state, out, dtDays) {
  const { grid, land, vel, a, b } = ctx;
  const { nx, ny, cellKm, cosLat } = grid;
  advect(ctx, state, a, dtDays);
  advect(ctx, a, b, -dtDays);
  for (let q = 0; q < b.length; q++) b[q] = state[q] + 0.5 * (state[q] - b[q]);
  const lo = new Float64Array(4);
  const hi = new Float64Array(4);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (land[k]) {
        out.fill(0, k * 4, k * 4 + 4);
        continue;
      }
      const x = i - (vel[2 * k] * dtDays) / (cellKm * cosLat[j]);
      const y = j - (vel[2 * k + 1] * dtDays) / cellKm;
      if (!sample(grid, land, state, x, y)) {
        copyCell(state, out, k);
        continue;
      }
      lo.set(S.lo);
      hi.set(S.hi);
      sample(grid, land, b, x, y);
      for (let c = 0; c < 4; c++) out[k * 4 + c] = Math.min(hi[c], Math.max(lo[c], S.v[c]));
    }
  }
}

// Explicit 5-point Laplacian, zero-flux at land (land neighbours mirror the
// centre), auto-substepped so D·h/Δx² ≤ 0.2 at the narrowest simulated row.
export function diffuse(ctx, src, dst, dtDays, D = EDDY_DIFFUSIVITY_KM2_DAY) {
  const { grid, land, d: tmp } = ctx;
  const { nx, ny, cellKm, cosLat } = grid;
  dst.set(src);
  const { sub, h } = diffusionSchedule(grid, dtDays, D);
  if (sub === 0) return;
  const dy2 = cellKm * cellKm;
  for (let s = 0; s < sub; s++) {
    for (let j = 0; j < ny; j++) {
      const dx = cellKm * cosLat[j];
      const dx2 = dx * dx;
      const cosFN = Math.cos(((-90 + (j + 1) * grid.dlat) * Math.PI) / 180);
      const cosFS = Math.cos(((-90 + j * grid.dlat) * Math.PI) / 180);
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (land[k]) {
          tmp.fill(0, k * 4, k * 4 + 4);
          continue;
        }
        const kE = grid.idx(i + 1, j);
        const kW = grid.idx(i - 1, j);
        const kN = j + 1 < ny ? k + nx : -1;
        const kS = j - 1 >= 0 ? k - nx : -1;
        for (let c = 0; c < 4; c++) {
          const C = dst[k * 4 + c];
          const E = land[kE] ? C : dst[kE * 4 + c];
          const W = land[kW] ? C : dst[kW * 4 + c];
          const N = kN < 0 || land[kN] ? C : dst[kN * 4 + c];
          const So = kS < 0 || land[kS] ? C : dst[kS * 4 + c];
          // y-term in flux form: cos at the north/south faces over cos at the centre,
          // so diffusion conserves area-weighted mass on the sphere.
          const yTerm = (cosFN * (N - C) - cosFS * (C - So)) / (cosLat[j] * dy2);
          tmp[k * 4 + c] = C + D * h * ((E + W - 2 * C) / dx2 + yTerm);
        }
      }
    }
    dst.set(tmp);
  }
}

// Exact per-cell kinetics over dt. The deficit cap lives in guard(), which runs after every pass.
export function react(ctx, state, dtDays) {
  const { grid, land, rows } = ctx;
  const eT = Math.exp(-dtDays / TAU_T_DAYS);
  const eN = Math.exp(-dtDays / TAU_N_DAYS);
  for (let j = 0; j < grid.ny; j++) {
    const row = rows[j];
    for (let i = 0; i < grid.nx; i++) {
      const k = j * grid.nx + i;
      if (land[k]) continue;
      const q = k * 4;
      state[q] *= eT;
      const s = sagStep(state[q + 1], state[q + 3], row.kd, row.ka, dtDays);
      state[q + 1] = s.L;
      state[q + 2] *= eN;
      state[q + 3] = s.D;
    }
  }
}

export function inject(ctx, state, sources, dtDays) {
  const { land } = ctx;
  for (const src of sources) {
    for (const { k, f } of src.cells) {
      if (land[k]) continue;
      for (let c = 0; c < 4; c++) state[k * 4 + c] += src.conc[c] * f * dtDays;
    }
  }
}

// NaN/∞ → 0, clamp ≥ 0, land = 0, deficit ≤ DO saturation.
export function guard(ctx, state) {
  const { grid, land, rows } = ctx;
  for (let k = 0; k < land.length; k++) {
    const q = k * 4;
    if (land[k]) {
      state[q] = 0; state[q + 1] = 0; state[q + 2] = 0; state[q + 3] = 0;
      continue;
    }
    for (let c = 0; c < 4; c++) {
      const v = state[q + c];
      if (!(v >= 0 && v < 1e30)) state[q + c] = 0;
    }
    const cap = rows[Math.floor(k / grid.nx)].doSat;
    if (state[q + 3] > cap) state[q + 3] = cap;
  }
}

export function step(ctx, state, {
  dtDays = DT_DAYS,
  sources = [],
  reactions = true,
  diffusivity = EDDY_DIFFUSIVITY_KM2_DAY,
} = {}) {
  advectBFECC(ctx, state, ctx.c, dtDays);
  guard(ctx, ctx.c);
  diffuse(ctx, ctx.c, state, dtDays, diffusivity);
  guard(ctx, state);
  if (reactions) react(ctx, state, dtDays);
  inject(ctx, state, sources, dtDays);
  guard(ctx, state);
  return state;
}

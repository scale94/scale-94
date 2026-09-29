import { describe, it, expect } from 'vitest';
import { OCEAN_GRID } from '../grid';
import { buildLandMask } from '../landMask';
import { bakeCurrents, GYRE_CELLS } from '../streamFunction';
import { syntheticWorld } from './syntheticWorld';

const grid = OCEAN_GRID;
const mask = buildLandMask(grid);
const cur = bakeCurrents(grid, mask);
const { nx, ny, cellKm } = grid;

const faceCos = (j) => Math.cos(((-90 + (j + 1) * grid.dlat) * Math.PI) / 180);

describe('bakeCurrents (real world)', () => {
  it('is discretely divergence-free in flux form', () => {
    let maxFlux = 0;
    let maxDiv = 0;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const east = cur.uFace[k] * cellKm;
        const west = cur.uFace[grid.idx(i - 1, j)] * cellKm;
        const north = cur.vFace[k] * cellKm * faceCos(j);
        const south = j > 0 ? cur.vFace[k - nx] * cellKm * faceCos(j - 1) : 0;
        maxFlux = Math.max(maxFlux, Math.abs(east), Math.abs(north));
        maxDiv = Math.max(maxDiv, Math.abs(east - west + north - south));
      }
    }
    expect(maxFlux).toBeGreaterThan(0);
    expect(maxDiv).toBeLessThan(1e-6 * maxFlux);
  });

  it('has exactly zero flux through every face touching land', () => {
    let bad = 0;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const kE = grid.idx(i + 1, j);
        if ((mask.land[k] || mask.land[kE]) && cur.uFace[k] !== 0) bad++;
        if (j < ny - 1 && (mask.land[k] || mask.land[k + nx]) && cur.vFace[k] !== 0) bad++;
      }
    }
    expect(bad).toBe(0);
  });

  it('is finite and bounded, with a real western boundary current', () => {
    let max = 0;
    for (let k = 0; k < grid.n; k++) {
      const s = Math.hypot(cur.vel[2 * k], cur.vel[2 * k + 1]);
      expect(Number.isFinite(s)).toBe(true);
      max = Math.max(max, s);
    }
    expect(max).toBeGreaterThan(100);
    expect(max).toBeLessThan(300); // CFL: 300 km/d × 0.25 d < one 78 km cell
  });

  it('intensifies the North Pacific gyre on its western side (Kuroshio)', () => {
    const cell = GYRE_CELLS.find((c) => c.name === 'north-pacific-subtropical');
    const width = cell.lon1 - cell.lon0;
    let west = 0;
    let east = 0;
    for (let j = 0; j < ny; j++) {
      const lat = grid.latOf(j);
      if (lat < 20 || lat > 38) continue;
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (mask.land[k]) continue;
        const dx = (((grid.lonOf(i) - cell.lon0) % 360) + 360) % 360;
        const s = Math.hypot(cur.vel[2 * k], cur.vel[2 * k + 1]);
        if (dx <= width / 3) west = Math.max(west, s);
        else if (dx >= (2 * width) / 3 && dx <= width) east = Math.max(east, s);
      }
    }
    expect(west).toBeGreaterThanOrEqual(3 * east);
  });

  const meanV = (lon0, lon1, lat0, lat1) => {
    let sum = 0;
    let count = 0;
    for (let j = 0; j < ny; j++) {
      const lat = grid.latOf(j);
      if (lat < lat0 || lat > lat1) continue;
      for (let i = 0; i < nx; i++) {
        const lon = grid.lonOf(i);
        const k = j * nx + i;
        if (lon < lon0 || lon > lon1 || mask.land[k]) continue;
        sum += cur.vel[2 * k + 1];
        count++;
      }
    }
    return sum / count;
  };

  it('runs the Kuroshio north and the Black Sea rim current south along Romania', () => {
    expect(meanV(122, 135, 25, 32)).toBeGreaterThan(0);
    expect(meanV(28, 31.5, 42.5, 45.5)).toBeLessThan(0);
  });

  it('carries the ACC eastward through the Drake Passage', () => {
    let sum = 0;
    let count = 0;
    for (let j = 0; j < ny; j++) {
      const lat = grid.latOf(j);
      if (lat < -62 || lat > -56) continue;
      for (let i = 0; i < nx; i++) {
        const lon = grid.lonOf(i);
        const k = j * nx + i;
        if (lon < -70 || lon > -60 || mask.land[k]) continue;
        sum += cur.vel[2 * k];
        count++;
      }
    }
    expect(count).toBeGreaterThan(0);
    expect(sum / count).toBeGreaterThan(0);
  });
});

describe('bakeCurrents (synthetic world)', () => {
  it('respects a single test gyre around an island', () => {
    const { grid: g, mask: m } = syntheticWorld();
    const c = bakeCurrents(g, m, {
      cells: [{ name: 't', lon0: 20, lon1: 120, lat0: -50, lat1: 50, sign: 1, peak: 300, eps: 0.1 }],
      acc: null,
    });
    // The island sits inside the gyre, so raw ψ is non-zero around it: only
    // the coastal treatment can make these faces zero.
    let bad = 0;
    let moving = 0;
    for (let j = 0; j < g.ny; j++) {
      for (let i = 0; i < g.nx; i++) {
        const k = j * g.nx + i;
        const kE = g.idx(i + 1, j);
        if ((m.land[k] || m.land[kE]) && c.uFace[k] !== 0) bad++;
        if (j < g.ny - 1 && (m.land[k] || m.land[k + g.nx]) && c.vFace[k] !== 0) bad++;
        if (!m.land[k] && Math.hypot(c.vel[2 * k], c.vel[2 * k + 1]) > 1) moving++;
      }
    }
    expect(bad).toBe(0);
    expect(moving).toBeGreaterThan(100);
  });
});

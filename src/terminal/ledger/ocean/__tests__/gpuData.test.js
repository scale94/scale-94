import { describe, it, expect } from 'vitest';
import { LAT_LIMIT } from '../grid';
import { rowConstants, diffusionSchedule } from '../referenceStep';
import { kd, kaOcean, doSat, sstClimatology } from '../kinetics';
import { packStatic, packRows, packSources } from '../gpu/gpuData';
import { syntheticWorld, uniformVelocity } from './syntheticWorld';

const { grid, mask } = syntheticWorld();
const landK = grid.idx(42, 15);
const oceanK = grid.idx(10, 16);

describe('rowConstants', () => {
  it('matches the kinetics at each row SST', () => {
    const rows = rowConstants(grid);
    expect(rows).toHaveLength(grid.ny);
    const sst = sstClimatology(grid.latOf(20));
    expect(rows[20]).toEqual({ kd: kd(sst), ka: kaOcean(sst), doSat: doSat(sst) });
  });
});

describe('diffusionSchedule', () => {
  it('keeps D·h/Δx²_min ≤ 0.2 at the narrowest simulated row', () => {
    let minDx = Infinity;
    for (let j = 0; j < grid.ny; j++) {
      if (Math.abs(grid.latOf(j)) <= LAT_LIMIT) minDx = Math.min(minDx, grid.cellKm * grid.cosLat[j]);
    }
    const { sub, h } = diffusionSchedule(grid, 0.25, 5e6);
    expect(sub).toBeGreaterThan(1);
    expect(h * sub).toBeCloseTo(0.25, 12);
    expect((5e6 * h) / (minDx * minDx)).toBeLessThanOrEqual(0.2 + 1e-12);
  });

  it('schedules nothing without diffusivity', () => {
    expect(diffusionSchedule(grid, 0.25, 0)).toEqual({ sub: 0, h: 0 });
  });
});

describe('packStatic', () => {
  it('interleaves u, v, land, 0', () => {
    const vel = uniformVelocity(grid, 3, -2);
    const data = packStatic(grid, mask.land, vel);
    expect(data).toHaveLength(grid.n * 4);
    expect(Array.from(data.slice(oceanK * 4, oceanK * 4 + 4))).toEqual([3, -2, 0, 0]);
    expect(Array.from(data.slice(landK * 4, landK * 4 + 4))).toEqual([3, -2, 1, 0]);
  });
});

describe('packRows', () => {
  it('stores rates and cosines as a ny × 2 texture', () => {
    const data = packRows(grid);
    const rows = rowConstants(grid);
    const j = 20;
    const rad = Math.PI / 180;
    expect(data).toHaveLength(grid.ny * 2 * 4);
    expect(data[j * 4]).toBeCloseTo(rows[j].kd, 6);
    expect(data[j * 4 + 1]).toBeCloseTo(rows[j].ka, 6);
    expect(data[j * 4 + 2]).toBeCloseTo(rows[j].doSat, 5);
    expect(data[j * 4 + 3]).toBeCloseTo(grid.cosLat[j], 6);
    const r1 = (grid.ny + j) * 4;
    expect(data[r1]).toBeCloseTo(Math.cos((-90 + (j + 1) * grid.dlat) * rad), 6);
    expect(data[r1 + 1]).toBeCloseTo(Math.cos((-90 + j * grid.dlat) * rad), 6);
  });
});

describe('packSources', () => {
  it('sums overlapping sources per cell and skips land', () => {
    const sources = [
      { cells: [{ k: oceanK, f: 0.5 }, { k: landK, f: 9 }], conc: [1, 2, 3, 4] },
      { cells: [{ k: oceanK, f: 0.25 }], conc: [4, 4, 4, 4] },
    ];
    const data = packSources(grid, mask.land, sources);
    expect(Array.from(data.slice(oceanK * 4, oceanK * 4 + 4))).toEqual([1.5, 2, 2.5, 3]);
    expect(Array.from(data.slice(landK * 4, landK * 4 + 4))).toEqual([0, 0, 0, 0]);
  });
});

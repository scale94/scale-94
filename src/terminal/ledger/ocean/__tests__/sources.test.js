import { describe, it, expect } from 'vitest';
import { OCEAN_GRID } from '../grid';
import { buildLandMask, snapToOcean } from '../landMask';
import { riverState } from '../kinetics';
import {
  haversineKm, courseLengthKm, splatCells, buildSource,
  verdictSourceSpec, verdictSources, ghostSourceSpec, MIXED_LAYER_M,
  MIN_SNAP_BASIN_CELLS, ambientSources,
} from '../sources';

const grid = OCEAN_GRID;
const mask = buildLandMask(grid);
const kernel = { temp: 12, do: 9.5, bod: 6, dt: 3.5, nitrate: 18, epi: 2.5, flow: 42 };

describe('geometry', () => {
  it('measures great-circle distance', () => {
    expect(haversineKm([0, 0], [1, 0])).toBeCloseTo(111.19, 1);
    expect(courseLengthKm([[0, 0], [1, 0], [2, 0]])).toBeCloseTo(222.39, 1);
    expect(courseLengthKm([[5, 5]])).toBe(0);
  });
});

describe('splatCells', () => {
  it('delivers exactly Q m³/s into the mixed layer', () => {
    const snap = { i: grid.lonLatToCell(-89.25, 29.15).i, j: grid.lonLatToCell(-89.25, 29.15).j };
    const Q = 17000;
    const cells = splatCells(grid, mask.land, snap, Q);
    let delivered = 0;
    for (const { k, f } of cells) {
      const j = Math.floor(k / grid.nx);
      const area = (grid.cellKm * 1000) ** 2 * grid.cosLat[j];
      delivered += (f * area * MIXED_LAYER_M) / 86400;
      expect(mask.land[k]).toBe(0);
    }
    expect(Math.abs(delivered - Q) / Q).toBeLessThan(1e-9);
  });
});

describe('buildSource', () => {
  const preset = {
    id: 'danube-test', kind: 'preset', kernel,
    course: [[14.29, 48.31], [29.75, 45.15]],
    dischargeM3s: 6500, velocityMs: 1, depthM: 6,
  };

  it('carries the river-stage state at travel time into the ocean', () => {
    const s = buildSource(preset, grid, mask);
    expect(s.lengthKm).toBeCloseTo(courseLengthKm(preset.course), 9);
    expect(s.travelDays).toBeCloseTo(s.lengthKm / 86.4, 9);
    const ref = riverState(kernel, s.travelDays, { velocityMs: 1, depthM: 6 });
    expect(s.mouth).toEqual(ref);
    expect(s.conc).toEqual([ref.dT, ref.L, ref.N, ref.D]);
    expect(s.cells.length).toBeGreaterThan(0);
  });

  it('places the critical point on the course with a non-negative DO minimum', () => {
    const s = buildSource({ ...preset, kernel: { ...kernel, bod: 40, do: 6 } }, grid, mask);
    expect(s.critical.tDays).toBeGreaterThan(0);
    expect(s.critical.tDays).toBeLessThanOrEqual(s.travelDays);
    expect(s.critical.rkm).toBeGreaterThanOrEqual(0);
    expect(s.critical.rkm).toBeLessThanOrEqual(s.lengthKm);
    expect(s.critical.doMin).toBeGreaterThanOrEqual(0);
  });

  it('drops a source with no ocean in reach', () => {
    expect(buildSource({ ...preset, course: [[14.29, 48.31]], snapRadius: 2 }, grid, mask)).toBeNull();
  });

  it('rejects a non-positive velocity', () => {
    expect(() => buildSource({ ...preset, velocityMs: 0 }, grid, mask)).toThrow();
  });
});

describe('user verdicts and the ghost', () => {
  const verdict = { hash: 'abc', coordinates: { lat: 48.31, lon: 14.29 }, input: { ...kernel } };

  it('drains a verdict in a straight line to its snapped ocean cell, Q = submitted flow', () => {
    const spec = verdictSourceSpec(verdict);
    expect(spec.kind).toBe('verdict');
    expect(spec.dischargeM3s).toBe(42);
    expect(spec.velocityMs).toBe(0.5);
    expect(spec.depthM).toBe(2.5);
    const s = buildSource(spec, grid, mask);
    expect(s.course).toHaveLength(2);
    expect(s.course[1]).toEqual([s.snap.lon, s.snap.lat]);
    expect(s.lengthKm).toBeGreaterThan(150);
    expect(s.lengthKm).toBeLessThan(900);
  });

  it('builds the ghost from raw form params, coercing strings', () => {
    const spec = ghostSourceSpec({ lat: '48.31', lon: '14.29', temp: '12', do: '9.5', bod: '6', dt: '3.5', nitrate: '18', epi: '0.1', flow: '42' });
    expect(spec.kind).toBe('ghost');
    expect(spec.depthM).toBe(0.5);
    const s = buildSource(spec, grid, mask);
    expect(s.conc.every((v) => Number.isFinite(v))).toBe(true);
  });

  it('rejects a ghost with blank coordinates or non-numeric fields instead of inventing values', () => {
    const base = { lat: '48.31', lon: '14.29', temp: '12', do: '9.5', bod: '6', dt: '3.5', nitrate: '18', epi: '2', flow: '42' };
    expect(buildSource(ghostSourceSpec({ ...base, lat: '' }), grid, mask)).toBeNull();
    expect(buildSource(ghostSourceSpec({ ...base, flow: 'abc' }), grid, mask)).toBeNull();
    expect(buildSource(ghostSourceSpec({ ...base, epi: '' }), grid, mask)).toBeNull();
    expect(buildSource(ghostSourceSpec({ ...base, bod: undefined }), grid, mask)).toBeNull();
    expect(buildSource(ghostSourceSpec(base), grid, mask)).not.toBeNull();
  });
});

describe('verdictSources', () => {
  const input = { ...kernel, siteName: 'Test site' };
  it('builds one source per archived verdict with usable coordinates', () => {
    const out = verdictSources([
      { hash: 'a', status: 'REJECTED', coordinates: { lat: 31.3, lon: 120.6 }, input },
      { hash: 'b', status: 'APPROVED', coordinates: null, input },
      { hash: 'c', status: 'APPROVED', coordinates: { lat: '', lon: 5 }, input },
      { hash: 'd', status: 'APPROVED', coordinates: { lat: 10, lon: NaN }, input },
      { hash: 'e', status: 'APPROVED', coordinates: { lat: 10, lon: 10 } },
    ], grid, mask);
    expect(out.map((s) => s.id)).toEqual(['a']);
    expect(out[0].kind).toBe('verdict');
    expect(out[0].dischargeM3s).toBe(42);
  });
  it('is empty for no verdicts', () => {
    expect(verdictSources([], grid, mask)).toEqual([]);
  });
});

describe('lagoon rule: sites skip basins below MIN_SNAP_BASIN_CELLS', () => {
  const cell = (lon, lat) => {
    const { i, j } = grid.lonLatToCell(lon, lat);
    return grid.idx(i, j);
  };
  const basinAt = (lon, lat) => mask.basin[cell(lon, lat)];
  const sizeAt = (lon, lat) => mask.basinSize[basinAt(lon, lat)];
  const sizeOf = (k) => mask.basinSize[mask.basin[k]];
  const verdictAt = (lat, lon) =>
    buildSource(verdictSourceSpec({ hash: 'x', coordinates: { lat, lon }, input: { ...kernel } }), grid, mask);

  it('sits between the largest skipped basin and the smallest kept sea (measured on the real grid)', () => {
    expect(MIN_SNAP_BASIN_CELLS).toBe(40);
    expect(sizeAt(18, 35)).toBe(511);                        // Mediterranean (Gibraltar is sub-grid)
    expect(sizeAt(34, 43.5)).toBe(98);                       // Black Sea
    expect(sizeAt(51, 42)).toBe(91);                         // Caspian
    expect(sizeAt(38, 20)).toBe(81);                         // Red Sea (Bab-el-Mandeb is sub-grid)
    const white = snapToOcean(grid, mask.land, 40.54, 64.54, 8);
    expect(sizeOf(white.k)).toBe(20);                        // White Sea
    expect(sizeOf(white.k)).toBeLessThan(MIN_SNAP_BASIN_CELLS);
    expect(sizeAt(38, 20)).toBeGreaterThanOrEqual(MIN_SNAP_BASIN_CELLS);
  });

  it('moves a Suez verdict out of its 1-cell lagoon into the Mediterranean', () => {
    expect(sizeOf(snapToOcean(grid, mask.land, 32.55, 29.97, 64).k)).toBe(1);
    const s = verdictAt(29.97, 32.55);
    expect(mask.basin[s.snap.k]).toBe(basinAt(18, 35));
    expect(s.snap.distCells).toBe(2);
  });

  it('drains an Arkhangelsk verdict to the open ocean, not the 20-cell White Sea', () => {
    const s = verdictAt(64.54, 40.54);
    expect(mask.basin[s.snap.k]).toBe(basinAt(-150, 0));
    expect(s.snap.distCells).toBe(3);
  });

  it('still drains into the Caspian, the Black Sea and the Red Sea', () => {
    expect(mask.basin[verdictAt(40.41, 49.87).snap.k]).toBe(basinAt(51, 42));   // Baku
    expect(mask.basin[verdictAt(46.48, 30.73).snap.k]).toBe(basinAt(34, 43.5)); // Odesa
    const jeddah = verdictAt(21.49, 39.17);
    expect(mask.basin[jeddah.snap.k]).toBe(basinAt(38, 20));
    expect(jeddah.snap.distCells).toBe(0);
  });

  it('leaves every preset snap exactly where the unfiltered snap put it', () => {
    const built = ambientSources(grid, mask);
    expect(built.length).toBeGreaterThanOrEqual(5);
    for (const s of built) {
      const [lon, lat] = s.course.at(-1);
      expect(s.snap.k, s.id).toBe(snapToOcean(grid, mask.land, lon, lat, 8).k);
    }
  });
});

import { describe, it, expect } from 'vitest';
import { OCEAN_GRID } from '../grid';
import { buildLandMask } from '../landMask';
import { riverState } from '../kinetics';
import {
  haversineKm, courseLengthKm, splatCells, buildSource,
  verdictSourceSpec, ghostSourceSpec, MIXED_LAYER_M,
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
});

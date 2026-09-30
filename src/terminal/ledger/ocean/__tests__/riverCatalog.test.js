import { describe, it, expect } from 'vitest';
import { OCEAN_GRID } from '../grid';
import { buildLandMask } from '../landMask';
import {
  CATALOG, catalogSourceSpec, splatSigmaFor, CATALOG_SPLAT_MAX_SIGMA_CELLS,
} from '../riverCatalog';
import {
  buildSource, catalogSources, oceanSources, ambientSources, MIN_SNAP_BASIN_CELLS,
  splatCells, SPLAT_SIGMA_CELLS, MIXED_LAYER_M,
} from '../sources';
import { doSat } from '../kinetics';
import { ALL_AUDIT_PRESETS } from '../../auditPresets';

const grid = OCEAN_GRID;
const mask = buildLandMask(grid);

const BRIEF = {
  amazon: [[-50.0, 0.0], 209000],
  parana: [[-57.0, -35.0], 17200],
  elbe: [[8.7, 53.86], 870],
  congo: [[12.35, -6.07], 41000],
  nile_rosetta: [[30.4, 31.4], 1400],
  nile_damietta: [[31.8, 31.5], 1400],
  niger: [[6.0, 4.3], 5600],
  st_lawrence: [[-67.0, 49.3], 16800],
  lena: [[127.0, 72.0], 16800],
  yenisey: [[82.5, 72.5], 19600],
  mekong: [[106.8, 10.2], 16000],
  yellow: [[119.2, 37.7], 2570],
  indus: [[67.5, 24.0], 6600],
};

describe('CATALOG data', () => {
  it('has exactly the 13 briefed sources with the briefed outfall and discharge', () => {
    expect(Object.keys(CATALOG).sort()).toEqual(Object.keys(BRIEF).sort());
    for (const [key, [outfall, q]] of Object.entries(BRIEF)) {
      expect(CATALOG[key].outfall, key).toEqual(outfall);
      expect(CATALOG[key].dischargeM3s, key).toBe(q);
    }
  });

  it('splits the Nile 2,800 m3/s across its two mouths', () => {
    expect(CATALOG.nile_rosetta.dischargeM3s + CATALOG.nile_damietta.dischargeM3s).toBe(2800);
  });

  it('carries a source note on every datum and marks the kernel UNVERIFIED', () => {
    for (const [key, e] of Object.entries(CATALOG)) {
      for (const f of ['outfall', 'dischargeM3s', 'kernel']) {
        expect(typeof e.sources[f] === 'string' && e.sources[f].length > 10, `${key}.${f}`).toBe(true);
      }
      expect(e.sources.kernel.startsWith('UNVERIFIED'), key).toBe(true);
      expect(typeof e.label).toBe('string');
    }
  });

  it('uses the near-pristine climate-banded baseline kernel', () => {
    for (const [key, e] of Object.entries(CATALOG)) {
      const lat = Math.abs(e.outfall[1]);
      expect(e.kernel.temp, key).toBe(lat < 25 ? 27 : lat <= 60 ? 14 : 5);
      expect(e.kernel.do, key).toBeCloseTo(Math.round(doSat(e.kernel.temp) * 0.92 * 10) / 10, 9);
      expect([e.kernel.bod, e.kernel.dt, e.kernel.nitrate], key).toEqual([2, 0, 3]);
    }
  });
});

describe('catalog sources on the real grid', () => {
  it.each(Object.keys(BRIEF))('%s outfall snaps within 3 cells into a real sea', (key) => {
    const s = buildSource(catalogSourceSpec(key), grid, mask);
    expect(s, key).not.toBeNull();
    expect(s.snap.distCells).toBeLessThanOrEqual(3);
    expect(mask.basinSize[mask.basin[s.snap.k]]).toBeGreaterThanOrEqual(MIN_SNAP_BASIN_CELLS);
    expect(s.conc.every(Number.isFinite)).toBe(true);
    expect(s.kind).toBe('catalog');
    expect(s.id).toBe(`catalog:${key}`);
  });

  it('catalogSources builds all 13', () => {
    expect(catalogSources(grid, mask).map((s) => s.id).sort())
      .toEqual(Object.keys(BRIEF).map((k) => `catalog:${k}`).sort());
  });

  it('oceanSources = the nine presets untouched, then the catalog', () => {
    const all = oceanSources(grid, mask);
    const presets = ambientSources(grid, mask);
    expect(presets.map((s) => s.id)).toEqual(ALL_AUDIT_PRESETS.map((p) => `preset:${p.key}`));
    expect(all.slice(0, presets.length)).toEqual(presets);
    expect(all).toHaveLength(presets.length + 13);
  });

  it('the Amazon is the largest ambient discharge', () => {
    const q = oceanSources(grid, mask).map((s) => [s.id, s.dischargeM3s]).sort((a, b) => b[1] - a[1]);
    expect(q[0][0]).toBe('catalog:amazon');
  });
});

describe('catalog splat width scales with discharge', () => {
  it('splatSigmaFor floors at the base sigma, grows with Q, and is capped', () => {
    expect(splatSigmaFor(870)).toBe(1.5);
    expect(splatSigmaFor(5000)).toBe(1.5);
    let prev = 1.5;
    for (const q of [6000, 17000, 41000, 209000, 1e6]) {
      const v = splatSigmaFor(q);
      expect(v, String(q)).toBeGreaterThan(prev);
      prev = v;
    }
    expect(splatSigmaFor(209000)).toBeGreaterThan(3.5);
    expect(splatSigmaFor(209000)).toBeLessThan(4.0);
    expect(splatSigmaFor(1e9)).toBeLessThanOrEqual(5);
    expect(splatSigmaFor(1e9)).toBe(CATALOG_SPLAT_MAX_SIGMA_CELLS);
  });

  it('the catalog base sigma equals the ocean splat sigma', () => {
    expect(splatSigmaFor(1)).toBe(SPLAT_SIGMA_CELLS);
  });

  it('every catalog spec carries its splatSigma', () => {
    expect(catalogSourceSpec('amazon').splatSigma).toBe(splatSigmaFor(209000));
    for (const key of Object.keys(CATALOG)) {
      expect(catalogSourceSpec(key).splatSigma, key).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('bigger rivers cover more cells, and every catalog source still delivers exactly Q', () => {
    const built = (key) => buildSource(catalogSourceSpec(key), grid, mask);
    const n = (key) => built(key).cells.length;
    expect(n('amazon')).toBeGreaterThan(n('congo'));
    expect(n('congo')).toBeGreaterThan(n('elbe'));
    for (const key of Object.keys(CATALOG)) {
      const s = built(key);
      let delivered = 0;
      for (const { k, f } of s.cells) {
        const j = Math.floor(k / grid.nx);
        const area = (grid.cellKm * 1000) ** 2 * grid.cosLat[j];
        delivered += (f * area * MIXED_LAYER_M) / 86400;
      }
      expect(Math.abs(delivered - s.dischargeM3s) / s.dischargeM3s, key).toBeLessThan(1e-9);
    }
  });

  it('presets keep the default-sigma splat', () => {
    const presets = ambientSources(grid, mask).filter((s) => s.kind === 'preset');
    expect(presets).toHaveLength(9);
    for (const s of presets) {
      expect(s.cells, s.id).toEqual(splatCells(grid, mask.land, s.snap, s.dischargeM3s));
    }
  });
});

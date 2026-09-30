import { describe, it, expect } from 'vitest';
import { ALL_AUDIT_PRESETS } from '../../auditPresets';
import { RIVERS } from '../riverCourses';
import { OCEAN_GRID } from '../grid';
import { buildLandMask } from '../landMask';
import { manningVelocity } from '../kinetics';
import { presetSourceSpec, buildSource, ambientSources } from '../sources';

const grid = OCEAN_GRID;
const mask = buildLandMask(grid);
const hasNote = (s) => typeof s === 'string' && s.trim().length >= 12;
const PRESETS = ALL_AUDIT_PRESETS.map((p) => [p.key, p]);

describe('RIVERS', () => {
  it('covers exactly the audit presets', () => {
    expect(Object.keys(RIVERS).sort()).toEqual(ALL_AUDIT_PRESETS.map((p) => p.key).sort());
  });

  it.each(PRESETS)('%s starts at the audit site', (key, p) => {
    expect(RIVERS[key].course[0]).toEqual([p.lon, p.lat]);
    expect(RIVERS[key].course.length).toBeGreaterThanOrEqual(2);
  });

  it('carries a source note or UNVERIFIED for every numeric field', () => {
    for (const r of Object.values(RIVERS)) {
      expect(hasNote(r.sources.course)).toBe(true);
      expect(hasNote(r.sources.dischargeM3s)).toBe(true);
      expect(hasNote(r.sources.manning)).toBe(true);
      expect(Number.isFinite(r.dischargeM3s) && r.dischargeM3s > 0).toBe(true);
    }
  });

  it('flags Hamhung as unverified', () => {
    expect(RIVERS.north_korea.sources.course.startsWith('UNVERIFIED')).toBe(true);
    expect(RIVERS.north_korea.sources.dischargeM3s.startsWith('UNVERIFIED')).toBe(true);
  });

  it('gives plausible Manning velocities', () => {
    for (const r of Object.values(RIVERS)) {
      const v = manningVelocity(r.manning);
      expect(v).toBeGreaterThan(0.3);
      expect(v).toBeLessThan(2.5);
    }
  });
});

describe('preset sources', () => {
  it.each(PRESETS)('%s drains to ocean within 3 cells', (_key, p) => {
    const s = buildSource(presetSourceSpec(p), grid, mask);
    expect(s).not.toBeNull();
    expect(s.kind).toBe('preset');
    expect(s.snap.distCells).toBeLessThanOrEqual(3);
  });

  it('uses the Manning velocity and hydraulic radius', () => {
    const p = ALL_AUDIT_PRESETS.find((x) => x.key === 'usa');
    const spec = presetSourceSpec(p);
    expect(spec.id).toBe('preset:usa');
    expect(spec.velocityMs).toBeCloseTo(manningVelocity(RIVERS.usa.manning), 12);
    expect(spec.depthM).toBe(RIVERS.usa.manning.R);
    expect(spec.dischargeM3s).toBe(16570);
  });

  it('builds all nine ambient sources', () => {
    expect(ambientSources(grid, mask).map((s) => s.id).sort())
      .toEqual(ALL_AUDIT_PRESETS.map((p) => `preset:${p.key}`).sort());
  });
});

describe('phase-3b rivers', () => {
  const basinAt = (lon, lat) => {
    const { i, j } = grid.lonLatToCell(lon, lat);
    return mask.basin[grid.idx(i, j)];
  };
  const built = (key) => buildSource(presetSourceSpec(ALL_AUDIT_PRESETS.find((p) => p.key === key)), grid, mask);

  it('drains the Ganges preset at the Meghna estuary with the combined G–B–M flow, sourced', () => {
    const r = RIVERS.ganges;
    expect(r.course.at(-1)[0]).toBeGreaterThan(90.5);      // east of the Sundarbans (~89.2°E)
    expect(r.dischargeM3s).toBeGreaterThanOrEqual(30000);
    expect(r.dischargeM3s).toBeLessThanOrEqual(45000);
    expect(r.sources.dischargeM3s.startsWith('UNVERIFIED')).toBe(false);
    expect(mask.basin[built('ganges').snap.k]).toBe(basinAt(-150, 0));
  });

  it('counts Danube river kilometres from Linz (sourced) and drains into the Black Sea', () => {
    const r = RIVERS.danube;
    expect(r.riverKm).toBeGreaterThanOrEqual(2100);
    expect(r.riverKm).toBeLessThanOrEqual(2170);
    expect(hasNote(r.sources.riverKm)).toBe(true);
    expect(r.sources.riverKm.startsWith('UNVERIFIED')).toBe(false);
    const s = built('danube');
    expect(s.lengthKm).toBe(r.riverKm);
    expect(s.critical.rkm).toBeGreaterThan(0);
    expect(s.critical.rkm).toBeLessThanOrEqual(r.riverKm);
    expect(mask.basin[s.snap.k]).toBe(basinAt(34, 43.5));
  });

  it('delivers the Danube plume almost entirely as nitrate (spec §3 worked example)', () => {
    const p = ALL_AUDIT_PRESETS.find((x) => x.key === 'danube');
    const s = built('danube');
    expect(s.travelDays).toBeGreaterThan(15);
    expect(s.travelDays).toBeLessThan(40);
    expect(s.mouth.L / p.bod).toBeLessThan(0.05);
    expect(s.mouth.N / p.nitrate).toBeGreaterThan(0.55);
    expect(s.mouth.N / p.nitrate).toBeLessThan(0.8);
  });

  it('drains the Yangtze and the Citarum into the open ocean', () => {
    expect(mask.basin[built('yangtze').snap.k]).toBe(basinAt(-150, 0));
    expect(mask.basin[built('citarum').snap.k]).toBe(basinAt(-150, 0));
  });
});

import { describe, it, expect } from 'vitest';
import { AUDIT_PRESETS } from '../../auditPresets';
import { RIVERS } from '../riverCourses';
import { OCEAN_GRID } from '../grid';
import { buildLandMask } from '../landMask';
import { manningVelocity } from '../kinetics';
import { presetSourceSpec, buildSource, ambientSources } from '../sources';

const grid = OCEAN_GRID;
const mask = buildLandMask(grid);
const hasNote = (s) => typeof s === 'string' && s.trim().length >= 12;
const PRESETS = AUDIT_PRESETS.map((p) => [p.key, p]);

describe('RIVERS', () => {
  it('covers exactly the audit presets', () => {
    expect(Object.keys(RIVERS).sort()).toEqual(AUDIT_PRESETS.map((p) => p.key).sort());
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
    const p = AUDIT_PRESETS.find((x) => x.key === 'usa');
    const spec = presetSourceSpec(p);
    expect(spec.id).toBe('preset:usa');
    expect(spec.velocityMs).toBeCloseTo(manningVelocity(RIVERS.usa.manning), 12);
    expect(spec.depthM).toBe(RIVERS.usa.manning.R);
    expect(spec.dischargeM3s).toBe(16570);
  });

  it('builds all five ambient sources', () => {
    expect(ambientSources(grid, mask).map((s) => s.id).sort())
      .toEqual(AUDIT_PRESETS.map((p) => `preset:${p.key}`).sort());
  });
});

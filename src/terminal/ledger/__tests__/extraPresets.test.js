import { describe, it, expect } from 'vitest';
import { AUDIT_PRESETS, EXTRA_PRESETS, ALL_AUDIT_PRESETS } from '../auditPresets';
import { PARAM_RANGES, validateSubmission } from '../verdictModel';
import { paramSeverity, discreteSeverity } from '../../views/ledger/severityEngine';

const PARAM_KEYS = ['temp', 'do', 'bod', 'dt', 'epi', 'nitrate', 'flow'];

// Hand-computed against severityEngine.js (plan 2026-09-30 Task 3 table).
const EXPECTED_TIERS = {
  yangtze: { temp: 'stress', do: 'critical', bod: 'critical', dt: 'stress', epi: 'critical', nitrate: 'critical', flow: 'critical' },
  ganges:  { temp: 'stress', do: 'critical', bod: 'critical', dt: 'safe',   epi: 'critical', nitrate: 'critical', flow: 'critical' },
  citarum: { temp: 'critical', do: 'critical', bod: 'critical', dt: 'critical', epi: 'critical', nitrate: 'critical', flow: 'critical' },
  danube:  { temp: 'safe', do: 'safe', bod: 'safe', dt: 'safe', epi: 'safe', nitrate: 'safe', flow: 'safe' },
};

describe('EXTRA_PRESETS', () => {
  it('adds yangtze, ganges, citarum, danube after the untouched five', () => {
    expect(EXTRA_PRESETS.map((p) => p.key)).toEqual(['yangtze', 'ganges', 'citarum', 'danube']);
    expect(ALL_AUDIT_PRESETS).toHaveLength(9);
    expect(ALL_AUDIT_PRESETS.slice(0, 5)).toEqual(AUDIT_PRESETS);
    expect(new Set(ALL_AUDIT_PRESETS.map((p) => p.key)).size).toBe(9);
    expect(EXTRA_PRESETS.map((p) => p.tone)).toEqual(['critical', 'critical', 'critical', 'safe']);
  });

  it('keeps every param inside PARAM_RANGES and produces the intended tiers', () => {
    for (const p of EXTRA_PRESETS) {
      for (const key of PARAM_KEYS) {
        expect(p[key], `${p.key}.${key}`).toBeGreaterThanOrEqual(PARAM_RANGES[key].min);
        expect(p[key], `${p.key}.${key}`).toBeLessThanOrEqual(PARAM_RANGES[key].max);
        expect(discreteSeverity(paramSeverity(key, p[key])), `${p.key}.${key}`).toBe(EXPECTED_TIERS[p.key][key]);
      }
      expect(typeof p.lat).toBe('number');
      expect(typeof p.lon).toBe('number');
      expect(p.siteName.length).toBeGreaterThan(0);
    }
  });

  it('all nine presets pass validateSubmission (spec §6)', () => {
    for (const p of ALL_AUDIT_PRESETS) expect(validateSubmission(p), p.key).toEqual([]);
  });
});

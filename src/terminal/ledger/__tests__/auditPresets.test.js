import { describe, it, expect } from 'vitest';
import { AUDIT_PRESETS } from '../auditPresets';
import { PARAM_RANGES } from '../verdictModel';
import { paramSeverity, discreteSeverity } from '../../views/ledger/severityEngine';

const PARAM_KEYS = ['temp', 'do', 'bod', 'dt', 'epi', 'nitrate', 'flow'];

// Expected discreteSeverity() tier per preset, per param — hand-computed
// against severityEngine.js's actual formulas (see the design spec for the
// derivation). This is what makes each preset's narrative real rather than
// asserted by fiat.
const EXPECTED_TIERS = {
  mercury:      { temp: 'safe',     do: 'safe',     bod: 'safe',     dt: 'safe',     epi: 'safe',     nitrate: 'safe',     flow: 'safe' },
  germany:      { temp: 'safe',     do: 'safe',     bod: 'safe',     dt: 'safe',     epi: 'safe',     nitrate: 'safe',     flow: 'safe' },
  usa:          { temp: 'stress',   do: 'stress',   bod: 'stress',   dt: 'stress',   epi: 'stress',   nitrate: 'stress',   flow: 'stress' },
  brazil:       { temp: 'stress',   do: 'stress',   bod: 'stress',   dt: 'safe',     epi: 'stress',   nitrate: 'stress',   flow: 'stress' },
  north_korea:  { temp: 'critical', do: 'critical', bod: 'critical', dt: 'critical', epi: 'critical', nitrate: 'critical', flow: 'critical' },
};

describe('AUDIT_PRESETS', () => {
  it('has exactly 5 presets with the expected keys', () => {
    expect(AUDIT_PRESETS.map(p => p.key).sort()).toEqual(
      ['brazil', 'germany', 'mercury', 'north_korea', 'usa'].sort()
    );
  });

  it('every param value is within PARAM_RANGES for every preset', () => {
    for (const preset of AUDIT_PRESETS) {
      for (const key of PARAM_KEYS) {
        const { min, max } = PARAM_RANGES[key];
        expect(preset[key], `${preset.key}.${key}`).toBeGreaterThanOrEqual(min);
        expect(preset[key], `${preset.key}.${key}`).toBeLessThanOrEqual(max);
      }
    }
  });

  it('every preset has lat, lon, siteName, and a valid tone', () => {
    for (const preset of AUDIT_PRESETS) {
      expect(typeof preset.lat).toBe('number');
      expect(typeof preset.lon).toBe('number');
      expect(typeof preset.siteName).toBe('string');
      expect(preset.siteName.length).toBeGreaterThan(0);
      expect(['safe', 'stress', 'critical']).toContain(preset.tone);
    }
  });

  it('produces the intended severity narrative for every param of every preset', () => {
    for (const preset of AUDIT_PRESETS) {
      const expected = EXPECTED_TIERS[preset.key];
      for (const key of PARAM_KEYS) {
        const tier = discreteSeverity(paramSeverity(key, preset[key]));
        expect(tier, `${preset.key}.${key}`).toBe(expected[key]);
      }
    }
  });
});

import { describe, it, expect } from 'vitest';
import { auditSeverity, pollutionLoad, TIER_SEVERITY } from '../ledgerSeverity';
import { ALL_AUDIT_PRESETS } from '../../../ledger/auditPresets';

const preset = (key) => ALL_AUDIT_PRESETS.find((p) => p.key === key);

describe('ledgerSeverity — the audit, not the preset id', () => {
  it('orders the tiers, the ruling dominating the load', () => {
    const mid = { do: 7, bod: 30, nitrate: 25, dt: 5 };
    const s = (status) => auditSeverity({ status, input: mid });
    expect(s('APPROVED')).toBeLessThan(s('CONDITIONAL'));
    expect(s('CONDITIONAL')).toBeLessThan(s('REJECTED'));
    expect(s('REJECTED')).toBeLessThan(s('EMERGENCY_VETO'));
    expect(s('APPROVED')).toBeLessThan(0.25);
    expect(s('EMERGENCY_VETO')).toBeGreaterThan(0.8);
  });

  it('shades within a tier by the water itself (manual runs scale too)', () => {
    const clean = { do: 12, bod: 1, nitrate: 2, dt: 0 };
    const foul = { do: 1, bod: 70, nitrate: 60, dt: 12 };
    expect(auditSeverity({ status: 'REJECTED', input: foul })).toBeGreaterThan(auditSeverity({ status: 'REJECTED', input: clean }));
    expect(pollutionLoad(foul)).toBeGreaterThan(0.95);
    expect(pollutionLoad(clean)).toBeLessThan(0.1);
    expect(auditSeverity({ status: 'UNKNOWN', input: foul })).toBe(pollutionLoad(foul));      // no tier: the load alone
    expect(auditSeverity(null)).toBe(0);
  });

  it('Blue Eye spring reads clean, Citarum reads choked', () => {
    expect(pollutionLoad(preset('mercury'))).toBeLessThan(0.1);
    expect(pollutionLoad(preset('citarum'))).toBeGreaterThan(0.8);
    expect(auditSeverity({ status: 'APPROVED', input: preset('mercury') })).toBeLessThan(0.1);
    expect(auditSeverity({ status: 'EMERGENCY_VETO', input: preset('citarum') })).toBeGreaterThan(0.9);
    expect(Object.keys(TIER_SEVERITY)).toEqual(['APPROVED', 'CONDITIONAL', 'REJECTED', 'EMERGENCY_VETO']);
  });
});

import { describe, it, expect } from 'vitest';
import { paramSeverity, discreteSeverity, aggregateHealth } from '../../src/terminal/views/ledger/severityEngine';

describe('paramSeverity', () => {
  it('returns 0 for null/undefined/NaN', () => {
    expect(paramSeverity('do', null)).toBe(0);
    expect(paramSeverity('do', undefined)).toBe(0);
    expect(paramSeverity('do', NaN)).toBe(0);
  });

  it('DO: high value = low severity (healthier)', () => {
    expect(paramSeverity('do', 14)).toBeLessThan(0.1);
    expect(paramSeverity('do', 2)).toBeGreaterThan(0.7);
  });

  it('flow: high value = low severity (healthier)', () => {
    expect(paramSeverity('flow', 80)).toBeLessThan(0.2);
    expect(paramSeverity('flow', 5)).toBeGreaterThan(0.7);
  });

  it('temp: high value = high severity', () => {
    expect(paramSeverity('temp', 5)).toBeLessThan(0.3);
    expect(paramSeverity('temp', 40)).toBeGreaterThan(0.7);
  });

  it('bod: high value = high severity', () => {
    expect(paramSeverity('bod', 2)).toBeLessThan(0.2);
    expect(paramSeverity('bod', 80)).toBeGreaterThan(0.7);
  });
});

describe('discreteSeverity', () => {
  it('maps continuous to safe/stress/critical', () => {
    expect(discreteSeverity(0.2)).toBe('safe');
    expect(discreteSeverity(0.55)).toBe('stress');
    expect(discreteSeverity(0.85)).toBe('critical');
  });
});

describe('aggregateHealth', () => {
  it('returns 100 for all-safe params', () => {
    const safe = { temp: 10, do: 12, bod: 2, dt: 1, epi: 0.5, nitrate: 1, flow: 60 };
    expect(aggregateHealth(safe)).toBeGreaterThan(70);
  });

  it('returns low score for critical params', () => {
    const bad = { temp: 40, do: 1, bod: 80, dt: 10, epi: 15, nitrate: 80, flow: 2 };
    expect(aggregateHealth(bad)).toBeLessThan(30);
  });

  it('returns 50 for empty params', () => {
    expect(aggregateHealth({})).toBe(50);
  });
});

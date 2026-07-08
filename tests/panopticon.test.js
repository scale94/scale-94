import { describe, it, expect, beforeEach } from 'vitest';
import {
  computePanopticonIndex,
  setPanopticonCorpus,
  getPanopticonState,
  subscribePanopticon,
  _resetForTests,
} from '../src/terminal/lib/panopticon.js';

describe('computePanopticonIndex', () => {
  it('matches the SurveillanceTab formula on severity-shaped (string) items', () => {
    // Σ(sev²)/(n×25)×100 = (25+9+1)/(3×25)×100 = 46.67 → 47
    expect(computePanopticonIndex([{ severity: '5' }, { severity: '3' }, { severity: '1' }])).toBe(47);
  });

  it('accepts sev-shaped (numeric) items — the privacy VECTORS shape', () => {
    // (4+4+0+0+1+4)/(6×25)×100 = 8.67 → 9
    expect(computePanopticonIndex([{ sev: 2 }, { sev: 2 }, { sev: 0 }, { sev: 0 }, { sev: 1 }, { sev: 2 }])).toBe(9);
  });

  it('returns 0 for empty or absent corpus', () => {
    expect(computePanopticonIndex([])).toBe(0);
    expect(computePanopticonIndex(null)).toBe(0);
    expect(computePanopticonIndex(undefined)).toBe(0);
  });

  it('clamps at 100', () => {
    // 81/25×100 = 324 → clamped 100
    expect(computePanopticonIndex([{ severity: '9' }])).toBe(100);
  });

  it('treats non-numeric severity as 0', () => {
    expect(computePanopticonIndex([{ severity: 'garbage' }, {}])).toBe(0);
  });
});

describe('corpus store', () => {
  beforeEach(() => _resetForTests());

  it('is null-index before registration', () => {
    expect(getPanopticonState()).toEqual({ index: null, lawCount: 0 });
  });

  it('registration computes, caches, and notifies subscribers', () => {
    let seen = null;
    subscribePanopticon((s) => { seen = s; });
    setPanopticonCorpus([{ severity: '5' }]);
    expect(getPanopticonState()).toEqual({ index: 100, lawCount: 1 });
    expect(seen).toEqual({ index: 100, lawCount: 1 });
  });

  it('unsubscribe stops notifications', () => {
    let n = 0;
    const un = subscribePanopticon(() => { n += 1; });
    setPanopticonCorpus([]);
    un();
    setPanopticonCorpus([]);
    expect(n).toBe(1);
  });

  it('a throwing subscriber does not break registration', () => {
    subscribePanopticon(() => { throw new Error('boom'); });
    expect(() => setPanopticonCorpus([{ severity: '3' }])).not.toThrow();
    expect(getPanopticonState().index).toBe(36); // 9/25×100
  });
});

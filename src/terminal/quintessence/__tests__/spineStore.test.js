import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSpine, setTrend, setCouncil, setPhase, setElement,
  missingVertebrae, subscribeSpine, _resetSpineForTests,
} from '../spineStore';

describe('spineStore', () => {
  beforeEach(() => _resetSpineForTests());

  it('starts with an empty spine and reports all missing vertebrae', () => {
    expect(getSpine()).toEqual({ trend: null, council: null, phase: null, element: null });
    expect(missingVertebrae()).toEqual(['NO TREND MARKED', 'NO COUNCIL COLLISION', 'NO PHASE COMPILED']);
  });

  it('stores each vertebra and clears its absence', () => {
    setTrend({ label: 'degrowth', velocity: 0.7 });
    setCouncil({ pair: ['OSTROM', 'WIENER'], directive: 'You are synthesizing…', trajectory: 'FOUNDATION', paradoxCount: 3 });
    setPhase('SMOKE DISSOLUTION');
    expect(missingVertebrae()).toEqual([]);
    expect(getSpine().phase).toBe('SMOKE DISSOLUTION');
  });

  it('element is NOT part of the gate (it is chosen at the altar click)', () => {
    setTrend({ label: 'x', velocity: 0 });
    setCouncil({ pair: ['A', 'B'], directive: 'd', trajectory: 'CEILING', paradoxCount: 0 });
    setPhase('DARK INCUBATION');
    expect(missingVertebrae()).toEqual([]);
    setElement('FIRE');
    expect(getSpine().element).toBe('FIRE');
  });

  it('rejects unknown phases and elements', () => {
    expect(() => setPhase('MOIST NONSENSE')).toThrow();
    expect(() => setElement('PLASMA')).toThrow();
  });

  it('rejects a council with no pair — a pairless council is malformed, and lets the mirror and the eye disagree on whether it is marked', () => {
    expect(() => setCouncil({})).toThrow();
    expect(() => setCouncil({ pair: [] })).toThrow();
    expect(() => setCouncil({ pair: ['only-one'] })).toThrow();
    // a real pair still writes
    setCouncil({ pair: ['A', 'B'], directive: 'd', trajectory: 'CEILING', paradoxCount: 0 });
    expect(getSpine().council.pair).toEqual(['A', 'B']);
    // and the malformed calls left no partial state behind
    _resetSpineForTests();
    try { setCouncil({ pair: [] }); } catch (_) { /* expected */ }
    expect(getSpine().council).toBeNull();
  });

  it('notifies subscribers on every write', () => {
    const seen = [];
    const un = subscribeSpine(s => seen.push(s.phase));
    setPhase('GREEN EMERGENCE');
    un();
    setPhase('DARK INCUBATION');
    expect(seen).toEqual(['GREEN EMERGENCE']);
  });

  it('persists to localStorage and restores', () => {
    setPhase('MAXIMUM PROJECTION');
    _resetSpineForTests({ keepStorage: true });
    expect(getSpine().phase).toBe('MAXIMUM PROJECTION');
  });
});

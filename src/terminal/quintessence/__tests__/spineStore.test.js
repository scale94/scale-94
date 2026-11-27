import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSpine, setTrend, setCouncil, setPhase, setElement,
  missingVertebrae, subscribeSpine, _resetSpineForTests, setScent, reconcileScent,
} from '../spineStore';
import { FX_SCENT, FX_FP, sealScentForTests } from './scentFixture';

describe('spineStore', () => {
  beforeEach(() => _resetSpineForTests());

  it('starts with an empty spine and reports all missing vertebrae', () => {
    expect(getSpine()).toEqual({ trend: null, council: null, phase: null, element: null, scent: null });
    expect(missingVertebrae()).toEqual(['NO TREND MARKED', 'NO COUNCIL COLLISION', 'NO PHASE COMPILED', 'NO ACCORD SEALED']);
  });

  it('stores each vertebra and clears its absence', () => {
    setTrend({ label: 'degrowth', velocity: 0.7 });
    setCouncil({ pair: ['OSTROM', 'WIENER'], directive: 'You are synthesizing…', trajectory: 'FOUNDATION', paradoxCount: 3 });
    setPhase('SMOKE DISSOLUTION');
    expect(missingVertebrae()).toEqual(['NO ACCORD SEALED']);
    sealScentForTests();
    expect(missingVertebrae()).toEqual([]);
    expect(getSpine().phase).toBe('SMOKE DISSOLUTION');
  });

  it('element is NOT part of the gate (it is chosen at the altar click)', () => {
    setTrend({ label: 'x', velocity: 0 });
    setCouncil({ pair: ['A', 'B'], directive: 'd', trajectory: 'CEILING', paradoxCount: 0 });
    setPhase('DARK INCUBATION');
    sealScentForTests();
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

describe('spineStore — the scent vertebra (P2)', () => {
  beforeEach(() => _resetSpineForTests());

  it('setScent stores the sealed accord and clears NO ACCORD SEALED', () => {
    setScent(FX_SCENT);
    expect(getSpine().scent).toEqual(FX_SCENT);
    expect(missingVertebrae()).toEqual(['NO TREND MARKED', 'NO COUNCIL COLLISION', 'NO PHASE COMPILED']);
  });

  it('an unsealed card never fills the mark: setScent rejects anything that is not an envelope', () => {
    expect(() => setScent({ ...FX_SCENT, envelope: null })).toThrow();
    expect(() => setScent({ ...FX_SCENT, envelope: { ...FX_SCENT.envelope, v: 2 } })).toThrow();
    expect(() => setScent({ ...FX_SCENT, envelope: { ...FX_SCENT.envelope, kem: 'RSA-OAEP-2048' } })).toThrow();
    expect(() => setScent({ ...FX_SCENT, fp: 'f'.repeat(32) })).toThrow();
    expect(getSpine().scent).toBeNull();
  });

  it('reconcileScent(null) on a sealed spine names the orphan and unmarks it', () => {
    sealScentForTests();
    reconcileScent(null);
    expect(getSpine().scent.orphaned).toBe(true);
    expect(missingVertebrae().at(-1)).toBe('SEAL ORPHANED — the key evaporated');
  });

  it('reconcileScent with a different fp orphans; with the same fp it heals', () => {
    sealScentForTests();
    reconcileScent('f'.repeat(32));
    expect(getSpine().scent.orphaned).toBe(true);
    reconcileScent(FX_FP);
    expect(getSpine().scent.orphaned).toBe(false);
    expect(missingVertebrae()).toEqual(['NO TREND MARKED', 'NO COUNCIL COLLISION', 'NO PHASE COMPILED']);
  });

  it('reconcileScent without a scent is a no-op', () => {
    reconcileScent(null);
    expect(getSpine().scent).toBeNull();
  });

  it('recrystallize replaces the seal and clears an orphan', () => {
    sealScentForTests();
    reconcileScent(null);
    sealScentForTests({ cardName: 'Second Accord' });
    expect(getSpine().scent.cardName).toBe('Second Accord');
    expect(getSpine().scent.orphaned).toBeFalsy();
  });

  it('a stored spine from before P2 (no scent key) restores with scent null', () => {
    localStorage.setItem('quintessence_spine_v1', JSON.stringify({ trend: null, council: null, phase: 'DARK INCUBATION', element: null }));
    _resetSpineForTests({ keepStorage: true });
    expect(getSpine().scent).toBeNull();
    expect(missingVertebrae().at(-1)).toBe('NO ACCORD SEALED');
  });
});

// ── scent-aether P3: a seal that would not open at the altar ────────────────
import { markScentBroken, SCENT_BROKEN, SCENT_ABSENT, SCENT_ORPHANED } from '../spineStore';

describe('spineStore · broken seal (P3 ruling 2)', () => {
  beforeEach(() => _resetSpineForTests());
  const full = () => { setTrend({ label: 't', velocity: 1 }); setCouncil({ pair: ['A', 'B'], directive: 'd', trajectory: 'T', paradoxCount: 1 }); setPhase('SMOKE DISSOLUTION'); };

  it('copy is exact', () => {
    expect(SCENT_BROKEN).toBe('SEAL BROKEN — the accord would not open');
  });
  it('markScentBroken drops the mark and names it fourth', () => {
    full(); sealScentForTests();
    expect(missingVertebrae()).toEqual([]);
    markScentBroken();
    expect(getSpine().scent.broken).toBe(true);
    expect(missingVertebrae()).toEqual([SCENT_BROKEN]);
  });
  it('no-op without a scent', () => {
    markScentBroken();
    expect(getSpine().scent).toBeNull();
    expect(missingVertebrae().at(-1)).toBe(SCENT_ABSENT);
  });
  it('orphaned outranks broken (the key is gone either way)', () => {
    sealScentForTests(); markScentBroken(); reconcileScent(null);
    expect(missingVertebrae().at(-1)).toBe(SCENT_ORPHANED);
  });
  it('a reconcile keeps broken; a fresh seal clears it', () => {
    sealScentForTests(); markScentBroken(); reconcileScent(FX_FP);
    expect(getSpine().scent.broken).toBe(true);
    sealScentForTests();
    expect(getSpine().scent.broken).toBeUndefined();
    expect(missingVertebrae().at(-1)).not.toBe(SCENT_BROKEN);
  });
  it('survives a reload', () => {
    sealScentForTests(); markScentBroken();
    _resetSpineForTests({ keepStorage: true });
    expect(getSpine().scent.broken).toBe(true);
  });
});

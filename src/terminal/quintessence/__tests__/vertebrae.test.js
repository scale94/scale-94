// src/terminal/quintessence/__tests__/vertebrae.test.js — the spine's table (spec §4).
import { describe, it, expect, beforeEach } from 'vitest';
import { VERTEBRAE, truncate, PREVIEW_MAX } from '../vertebrae';
import { NAV_TINTS } from '../guidanceStore';
import { getSpine, missingVertebrae, setTrend, setCouncil, setPhase, _resetSpineForTests } from '../spineStore';

const EMPTY = { trend: null, council: null, phase: null, element: null };

describe('VERTEBRAE — the table', () => {
  beforeEach(() => { _resetSpineForTests(); });

  it('order matches spineStore.missingVertebrae() — the mirror, the compass and the eyebrow must name the same "next"', () => {
    const missing = missingVertebrae();
    expect(missing).toHaveLength(VERTEBRAE.length);
    VERTEBRAE.forEach((v, i) => {
      expect(missing[i]).toContain(v.key.toUpperCase());
    });
  });

  it('every tab is a real house in NAV_TINTS', () => {
    for (const v of VERTEBRAE) expect(NAV_TINTS[v.tab]).toBeDefined();
  });

  it('previews are null on an empty spine', () => {
    for (const v of VERTEBRAE) expect(v.preview(EMPTY)).toBeNull();
  });

  it('previews read a real spine off the store: label, pair joined with ×, accord', () => {
    setTrend({ label: 'gaza ceasefire', velocity: 0.4 });
    setCouncil({ pair: ['hunger', 'mercy'], directive: 'd', trajectory: 'FOUNDATION', paradoxCount: 1 });
    setPhase('MINERAL STILLNESS');
    const spine = getSpine();   // the real shape, not a hand-built literal
    const by = k => VERTEBRAE.find(v => v.key === k);
    expect(by('trend').preview(spine)).toBe('gaza ceasefire');
    expect(by('council').preview(spine)).toBe('hunger × mercy');
    expect(by('phase').preview(spine)).toBe('MINERAL STILLNESS');
  });

  it('a council with no pair does not throw — it reads as absent', () => {
    const by = k => VERTEBRAE.find(v => v.key === k);
    expect(by('council').preview({ ...EMPTY, council: {} })).toBeNull();
  });

  it('only the trend is quoted — a label is a string literal, a pair is not', () => {
    const by = k => VERTEBRAE.find(v => v.key === k);
    expect(by('trend').quoted).toBe(true);
    expect(by('council').quoted).toBeFalsy();
    expect(by('phase').quoted).toBeFalsy();
  });
});

describe('truncate — the mirror is a row, not a paragraph', () => {
  it('leaves short strings alone', () => {
    expect(truncate('degrowth')).toBe('degrowth');
  });

  it('caps at PREVIEW_MAX with an ellipsis', () => {
    const long = 'a'.repeat(60);
    const out = truncate(long);
    expect(out).toHaveLength(PREVIEW_MAX);
    expect(out.endsWith('…')).toBe(true);
  });

  it('a string of exactly PREVIEW_MAX is untouched', () => {
    const exact = 'b'.repeat(PREVIEW_MAX);
    expect(truncate(exact)).toBe(exact);
  });
});

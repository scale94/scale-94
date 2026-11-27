// src/terminal/quintessence/__tests__/vertebrae.test.js — the spine's table (spec §4).
import { describe, it, expect, beforeEach } from 'vitest';
import { VERTEBRAE, truncate, PREVIEW_MAX, isScentMarked, altarMeter } from '../vertebrae';
import { NAV_TINTS } from '../observerStore';
import { getSpine, missingVertebrae, setTrend, setCouncil, setPhase, reconcileScent, _resetSpineForTests } from '../spineStore';
import { sealScentForTests } from './scentFixture';

const EMPTY = { trend: null, council: null, phase: null, element: null };
const EMPTY_P2 = { ...EMPTY, scent: null };

describe('VERTEBRAE — the table', () => {
  beforeEach(() => { _resetSpineForTests(); });

  it('order matches spineStore.missingVertebrae() — the mirror, the compass and the eyebrow must name the same "next"', () => {
    const missing = missingVertebrae();
    expect(missing).toHaveLength(VERTEBRAE.length);
    VERTEBRAE.forEach((v, i) => {
      expect(missing[i]).toBe(v.absent);
    });
  });

  it('the fourth vertebra is the scent house (spec §5.3)', () => {
    const { preview, isMarked, ...rest } = VERTEBRAE[3];
    expect(rest).toEqual({
      key: 'scent', tab: 'scaling', label: 'scent', tint: [217, 70, 239],
      field: 'sealed accord', house: 'the scent house', absent: 'NO ACCORD SEALED',
    });
    expect(VERTEBRAE[3].tint).toEqual(NAV_TINTS.scaling);
    expect(typeof preview).toBe('function');
    expect(typeof isMarked).toBe('function');
  });

  it('scent is marked only by a real, un-orphaned envelope; its preview is the card name', () => {
    expect(isScentMarked(EMPTY_P2)).toBe(false);
    expect(isScentMarked({ ...EMPTY_P2, scent: { cardName: 'x' } })).toBe(false);
    sealScentForTests();
    const s = getSpine();
    expect(isScentMarked(s)).toBe(true);
    expect(VERTEBRAE[3].preview(s)).toBe('Fixture Accord');
    reconcileScent(null);
    expect(isScentMarked(getSpine())).toBe(false);
    expect(VERTEBRAE[3].preview(getSpine())).toBeNull();
  });

  it('altarMeter: the kernel tab five marks — the four vertebrae in order, then the element', () => {
    expect(altarMeter(EMPTY_P2)).toEqual([
      { key: 'trend', filled: false }, { key: 'council', filled: false }, { key: 'phase', filled: false },
      { key: 'scent', filled: false }, { key: 'element', filled: false },
    ]);
    sealScentForTests();
    expect(altarMeter({ ...getSpine(), element: 'FIRE' }).map(m => m.filled)).toEqual([false, false, false, true, true]);
    reconcileScent(null);
    expect(altarMeter(getSpine())[3]).toEqual({ key: 'scent', filled: false });
  });

  it('isMarked agrees with missingVertebrae() for every vertebra', () => {
    setTrend({ label: 'x', velocity: 0 });
    sealScentForTests();
    const s = getSpine();
    const missing = missingVertebrae();
    for (const v of VERTEBRAE) expect(v.isMarked(s)).toBe(!missing.includes(v.absent));
  });

  it('every tab is a real house in NAV_TINTS', () => {
    for (const v of VERTEBRAE) expect(NAV_TINTS[v.tab]).toBeDefined();
  });

  it('user-facing label is the renamed tab; internal route id is untouched', () => {
    const council = VERTEBRAE.find(v => v.key === 'council');
    expect(council.tab).toBe('manifesto');   // App.jsx activeTab / NAV_TINTS key
    expect(council.label).toBe('accretion'); // what the altar prints
    for (const v of VERTEBRAE) expect(v.label).toBeTruthy();
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

describe('tabLabels — renamed tabs never leak their old names', () => {
  it('maps internal ids to current names and passes the rest through', async () => {
    const { tabLabel } = await import('../../tabLabels');
    expect(tabLabel('manifesto')).toBe('accretion');
    expect(tabLabel('scaling')).toBe('scent');
    expect(tabLabel('art')).toBe('chaos');
    expect(tabLabel('bsky')).toBe('bsky');
  });
});

describe('isScentMarked · broken (scent-aether P3)', () => {
  it('a broken seal is not a mark', async () => {
    const { markScentBroken } = await import('../spineStore');
    _resetSpineForTests();
    sealScentForTests();
    expect(isScentMarked(getSpine())).toBe(true);
    markScentBroken();
    expect(isScentMarked(getSpine())).toBe(false);
    expect(VERTEBRAE.find(v => v.key === 'scent').preview(getSpine())).toBeNull();
  });
});

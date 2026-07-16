// src/terminal/components/__tests__/resolveEyeState.test.js
// Spec §2: compiling > complete > armed > compass > mirror-flash > ambient > resting
// (mirror-flash is an overlay: it beats every base state except compiling).
import { describe, it, expect } from 'vitest';
import { resolveEyeState, pulseTabFor } from '../resolveEyeState';
import { VERTEBRAE } from '../../quintessence/vertebrae';
import { NAV_TINTS } from '../../quintessence/guidanceStore';

const empty  = { trend: null, council: null, phase: null, element: null };
const trendOnly = { ...empty, trend: { label: 'x' } };
const full   = { trend: {}, council: {}, phase: 'DARK INCUBATION', element: null };
const S = (over = {}) => ({ flaring: false, sealed: false, spine: empty, suggestion: null, flash: null, ...over });

describe('resolveEyeState — the priority chain', () => {
  it('compiling beats everything, including flash', () => {
    const r = resolveEyeState(S({ flaring: true, sealed: true, flash: { tab: 'art', tint: [1, 2, 3] } }));
    expect(r.state).toBe('compiling');
  });

  it('mirror-flash overlays complete/armed/compass/ambient as leaning in the flash tint', () => {
    for (const base of [S({ sealed: true }), S({ spine: full }), S({ spine: trendOnly }), S()]) {
      const r = resolveEyeState({ ...base, flash: { tab: 'scaling', tint: [217, 70, 239] } });
      expect(r.state).toBe('leaning');
      expect(r.tint).toEqual([217, 70, 239]);
    }
  });

  it('sealed → complete, no pulse, no pulseTab', () => {
    const r = resolveEyeState(S({ sealed: true, suggestion: { tab: 'art', tint: [1, 2, 3] } }));
    expect(r).toMatchObject({ state: 'complete', pulse: false, pulseTab: null });
  });

  it('full spine → armed with pulse (synced to the altar), no pulseTab', () => {
    const r = resolveEyeState(S({ spine: full }));
    expect(r).toMatchObject({ state: 'armed', pulse: true, pulseTab: null });
  });

  it('journey started → compass-leaning at next vertebra, pulseTab = its tab', () => {
    const r = resolveEyeState(S({ spine: trendOnly }));
    expect(r.state).toBe('leaning');
    expect(r.tint).toEqual([167, 139, 250]);   // council violet
    expect(r.pulseTab).toBe('manifesto');
    expect(r.pulse).toBe(true);
  });

  it('empty spine + ambient suggestion → leaning in the house hue, pulseTab = the house', () => {
    const r = resolveEyeState(S({ suggestion: { tab: 'ledger', tint: [20, 184, 166] } }));
    expect(r.state).toBe('leaning');
    expect(r.tint).toEqual([20, 184, 166]);
    expect(r.pulseTab).toBe('ledger');
  });

  it('empty spine, no suggestion → resting', () => {
    expect(resolveEyeState(S()).state).toBe('resting');
  });

  it('flash keeps the underlying pulseTab alive (the tab pulse must not blink off)', () => {
    const r = resolveEyeState(S({ spine: trendOnly, flash: { tab: 'kernel', tint: [6, 182, 212] } }));
    expect(r.pulseTab).toBe('manifesto');
  });

  it('pulseTabFor mirrors the chain without flash', () => {
    expect(pulseTabFor({ sealed: false, flaring: false, spine: trendOnly, suggestion: null })).toBe('manifesto');
    expect(pulseTabFor({ sealed: true, flaring: false, spine: trendOnly, suggestion: null })).toBeNull();
    expect(pulseTabFor({ sealed: false, flaring: false, spine: full, suggestion: null })).toBeNull();
  });
});

describe('the tints the compass leans in (spec §4.1)', () => {
  it('pins every vertebra tint — the fuchsia survived precisely because nothing asserted this', () => {
    expect(VERTEBRAE.map(v => [v.tab, v.tint])).toEqual([
      ['bsky',      [56, 189, 248]],   // sky-400
      ['manifesto', [167, 139, 250]],  // violet-400
      ['lunar',     [167, 139, 250]],  // violet-400 — was [217,70,239], /SCALING's fuchsia
    ]);
  });

  it('no vertebra leans in /SCALING fuchsia — the exact mistake, named so it cannot recur', () => {
    for (const v of VERTEBRAE) {
      expect(v.tint).not.toEqual(NAV_TINTS.scaling);
    }
  });

  it('a spine missing only the phase leans violet at /LUNAR, not fuchsia', () => {
    const r = resolveEyeState({
      flaring: false, sealed: false, suggestion: null, flash: null,
      spine: { trend: { label: 'x' }, council: {}, phase: null, element: null },
    });
    expect(r.state).toBe('leaning');
    expect(r.tint).toEqual([167, 139, 250]);
    expect(r.pulseTab).toBe('lunar');
  });
});

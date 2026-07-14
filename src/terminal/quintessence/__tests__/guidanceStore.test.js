// src/terminal/quintessence/__tests__/guidanceStore.test.js
// The yellow-prop picker: element houses only, no nagging, no immediate repeats.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getGuidance, subscribeGuidance, startGuidance, notifyNav,
  NAV_TINTS, ELEMENT_HOUSES, _resetGuidanceForTests,
} from '../guidanceStore';
import { setTrend, _resetSpineForTests } from '../spineStore';

const INITIAL_REST = 15000, SUGGEST = 20000, REST_MAX = 70000;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  _resetSpineForTests();
  _resetGuidanceForTests({ random: () => 0 }); // rest always REST_MIN, pick always pool[0]
});
afterEach(() => {
  _resetGuidanceForTests();
  _resetSpineForTests();
  vi.useRealTimers();
});

describe('guidanceStore — the element curriculum', () => {
  it('exports the four element houses and a tint for every nav tab', () => {
    expect(ELEMENT_HOUSES).toEqual(['art', 'transmission', 'ledger', 'ecocide']);
    for (const t of [...ELEMENT_HOUSES, 'kernel', 'bsky', 'manifesto', 'scaling',
                     'privacy', 'surveillance', 'cryptography', 'lunar', 'ledger', 'mercury']) {
      expect(NAV_TINTS[t], t).toHaveLength(3);
    }
  });

  it('stays silent through the initial rest, then suggests an element house', () => {
    startGuidance();
    expect(getGuidance().suggestion).toBeNull();
    vi.advanceTimersByTime(INITIAL_REST);
    const s = getGuidance().suggestion;
    expect(ELEMENT_HOUSES).toContain(s.tab);
    expect(s.tint).toEqual(NAV_TINTS[s.tab]);
  });

  it('withdraws the suggestion after SUGGEST_MS and rests before the next', () => {
    startGuidance();
    vi.advanceTimersByTime(INITIAL_REST);
    const first = getGuidance().suggestion.tab;
    vi.advanceTimersByTime(SUGGEST);
    expect(getGuidance().suggestion).toBeNull();       // the rest interlude
    vi.advanceTimersByTime(40000);                     // random=()=>0 → rest is exactly REST_MIN
    const second = getGuidance().suggestion.tab;       // advance exactly to the next suggestion window
    expect(second).not.toBe(first);                    // no immediate repeat
    expect(ELEMENT_HOUSES).toContain(second);
  });

  it('never suggests once the journey starts (spine touched)', () => {
    startGuidance();
    setTrend({ label: 'x', velocity: 0.5 });
    vi.advanceTimersByTime(INITIAL_REST + SUGGEST + REST_MAX);
    expect(getGuidance().suggestion).toBeNull();
  });

  it('notifyNav fires a mirror-flash in the clicked tab tint, clears after 1500ms', () => {
    startGuidance();
    notifyNav('scaling');
    expect(getGuidance().flash).toEqual({ tab: 'scaling', tint: NAV_TINTS.scaling });
    vi.advanceTimersByTime(1500);
    expect(getGuidance().flash).toBeNull();
  });

  it('navigating to the suggested house ends the suggestion early (invitation accepted)', () => {
    startGuidance();
    vi.advanceTimersByTime(INITIAL_REST);
    const s = getGuidance().suggestion.tab;
    notifyNav(s);
    expect(getGuidance().suggestion).toBeNull();
  });

  it('never suggests the tab the visitor is currently on', () => {
    startGuidance();
    notifyNav('art');                                   // visitor sits on chaos
    vi.advanceTimersByTime(1500 + INITIAL_REST + SUGGEST + 10 * REST_MAX);
    // walk several cycles; 'art' must never be suggested while active
    for (let i = 0; i < 6; i++) {
      const s = getGuidance().suggestion;
      if (s) expect(s.tab).not.toBe('art');
      vi.advanceTimersByTime(SUGGEST + REST_MAX);
    }
  });

  it('subscribers are notified on every transition and unsubscribe cleanly', () => {
    const seen = [];
    const un = subscribeGuidance(g => seen.push(g.suggestion?.tab ?? null));
    startGuidance();
    vi.advanceTimersByTime(INITIAL_REST);
    expect(seen.at(-1)).not.toBeNull();
    un();
    const n = seen.length;
    vi.advanceTimersByTime(SUGGEST + REST_MAX);
    expect(seen.length).toBe(n);
  });
});

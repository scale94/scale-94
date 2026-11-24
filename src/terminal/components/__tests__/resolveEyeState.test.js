// src/terminal/components/__tests__/resolveEyeState.test.js
// Spec §5.4 / D15: baseline (silver | aether | charging) + overlay (flash | glance).
import { describe, it, expect } from 'vitest';
import { resolveEyeState, overlayLean } from '../resolveEyeState';
import { VERTEBRAE } from '../../quintessence/vertebrae';
import { NAV_TINTS, GLANCE_IN_MS, GLANCE_HOLD_MS, GLANCE_TOTAL_MS } from '../../quintessence/observerStore';

const empty = { trend: null, council: null, phase: null, element: null };
const partial = { ...empty, trend: { label: 'x' } };
const full = { trend: {}, council: {}, phase: 'DARK INCUBATION', element: null };
const GAZE = [0.15, -0.04];
const S = (over = {}) => ({
  spine: empty, sealed: false, igniting: false, remarkedSinceSeal: false, flash: null, glance: null, ...over,
});
const flash = { tab: 'scaling', tint: [217, 70, 239] };
const tintGlance = { tab: 'lunar', tint: [167, 139, 250], shimmer: false, reason: 'x', startedAt: 0 };
const shimmerGlance = { tab: 'mercury', tint: null, shimmer: true, reason: 'x', startedAt: 0 };

const baselines = {
  silver:          { over: {}, state: 'resting', thread: 0 },
  silver_partial:  { over: { spine: partial }, state: 'resting', thread: 0 },
  aether:          { over: { spine: full }, state: 'aether', thread: 0 },
  aether_sealed:   { over: { spine: full, sealed: true, remarkedSinceSeal: true }, state: 'aether', thread: 1 },
  sealed_silver:   { over: { sealed: true }, state: 'resting', thread: 1 },
  charging:        { over: { igniting: true, sealed: true, spine: full }, state: 'charging', thread: 0 },
};

describe('baseline', () => {
  for (const [name, b] of Object.entries(baselines)) {
    it(`${name}: state ${b.state}, thread ${b.thread}, no overlay`, () => {
      const r = resolveEyeState(S(b.over));
      expect(r).toMatchObject({ state: b.state, thread: b.thread, shimmer: 0, tint: null, gaze: null, pulse: false });
    });
  }

  it('sealed_rearmed_spine_stays_silver_thread', () => {
    const r = resolveEyeState(S({ sealed: true, remarkedSinceSeal: false, spine: full }));
    expect(r).toMatchObject({ state: 'resting', baseline: 'silver', thread: 1 });
  });

  it('baseline field reports silver | aether | charging', () => {
    expect(resolveEyeState(S()).baseline).toBe('silver');
    expect(resolveEyeState(S({ spine: full })).baseline).toBe('aether');
    expect(resolveEyeState(S({ igniting: true })).baseline).toBe('charging');
  });

  it('old call shape (no spine, no new fields) falls back to silver without crashing', () => {
    expect(resolveEyeState({ flaring: false, sealed: false, suggestion: null, flash: null })).toMatchObject({
      state: 'resting', baseline: 'silver', thread: 0,
    });
  });
});

describe('overlay x baseline table', () => {
  for (const [name, b] of Object.entries(baselines)) {
    it(`${name} + flash: leaning in the flash tint, no gaze`, () => {
      const r = resolveEyeState(S({ ...b.over, flash }));
      expect(r).toMatchObject({ state: 'leaning', tint: flash.tint, gaze: null, thread: b.thread, shimmer: 0 });
    });

    it(`${name} + tint glance: leaning, tint, gaze, pulse`, () => {
      const r = resolveEyeState(S({ ...b.over, glance: tintGlance }));
      expect(r).toMatchObject({ state: 'leaning', tint: tintGlance.tint, gaze: GAZE, pulse: true, thread: b.thread, shimmer: 0 });
    });

    it(`${name} + mercury shimmer glance: baseline state, shimmer 1, gaze`, () => {
      const r = resolveEyeState(S({ ...b.over, glance: shimmerGlance }));
      expect(r).toMatchObject({ state: b.state, tint: null, gaze: GAZE, shimmer: 1, thread: b.thread });
    });
  }

  it('flash_overrides_glance', () => {
    const r = resolveEyeState(S({ flash, glance: tintGlance }));
    expect(r).toMatchObject({ state: 'leaning', tint: flash.tint, gaze: null, pulse: false });
    const r2 = resolveEyeState(S({ flash, glance: shimmerGlance }));
    expect(r2).toMatchObject({ state: 'leaning', tint: flash.tint, shimmer: 0 });
  });

  it('a glance with neither tint nor shimmer changes nothing', () => {
    const r = resolveEyeState(S({ glance: { tab: 'x', tint: null, shimmer: false, reason: '', startedAt: 0 } }));
    expect(r).toMatchObject({ state: 'resting', gaze: null, shimmer: 0 });
  });
});

describe('lean: the glance eases in and out (D5)', () => {
  it('without `now` every overlay leans fully (old callers unchanged)', () => {
    expect(resolveEyeState(S({ glance: tintGlance })).lean).toBe(1);
    expect(resolveEyeState(S()).lean).toBe(1);
  });

  it('a glance leans by its level at `now`; a flash is immediate', () => {
    expect(resolveEyeState(S({ glance: tintGlance, now: 0 })).lean).toBe(0);
    expect(resolveEyeState(S({ glance: tintGlance, now: GLANCE_IN_MS / 2 })).lean).toBeCloseTo(0.5, 6);
    expect(resolveEyeState(S({ glance: tintGlance, now: GLANCE_IN_MS + GLANCE_HOLD_MS / 2 })).lean).toBe(1);
    expect(resolveEyeState(S({ glance: shimmerGlance, now: GLANCE_IN_MS / 2 })).lean).toBeCloseTo(0.5, 6);
    expect(resolveEyeState(S({ flash, glance: tintGlance, now: 0 })).lean).toBe(1);
    expect(overlayLean({ glance: tintGlance }, GLANCE_TOTAL_MS)).toBe(0);
    expect(overlayLean({ flash, glance: null }, 0)).toBe(1);
  });

  it('reports the pre-overlay state the eye eases back toward', () => {
    expect(resolveEyeState(S({ glance: tintGlance })).baseState).toBe('resting');
    expect(resolveEyeState(S({ spine: full, glance: tintGlance })).baseState).toBe('aether');
    expect(resolveEyeState(S({ igniting: true, flash })).baseState).toBe('charging');
  });
});

describe('the tints the compass leans in (spec §4.1)', () => {
  it('pins every vertebra tint', () => {
    expect(VERTEBRAE.map(v => [v.tab, v.tint])).toEqual([
      ['bsky',      [56, 189, 248]],
      ['manifesto', [167, 139, 250]],
      ['lunar',     [167, 139, 250]],
    ]);
  });

  it('no vertebra leans in /SCALING fuchsia', () => {
    for (const v of VERTEBRAE) expect(v.tint).not.toEqual(NAV_TINTS.scaling);
  });
});

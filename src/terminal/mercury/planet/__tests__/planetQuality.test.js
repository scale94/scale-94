import { describe, it, expect } from 'vitest';
import { TIERS, TIER_NAMES, pickTier, calmOverride, perfHudOn, impulseOrder } from '../planetQuality';
import { SHADOW_STEPS } from '../planetLook';
import { IMPULSE_SLOTS, createImpulseFrame } from '../mercuryWaves';

describe('planetQuality', () => {
  it('names three tiers; full is exactly today\'s shader budget', () => {
    expect(TIER_NAMES).toEqual(['full', 'phone', 'lite']);
    expect(TIERS.full.shadowSteps).toBe(SHADOW_STEPS);
    expect(TIERS.full.rippleSlots).toBe(IMPULSE_SLOTS);
    expect(TIERS.full.dprMax).toBe(2);
  });

  it('each tier costs no more than the one above it on every axis', () => {
    const order = ['full', 'phone', 'lite'];
    for (let i = 1; i < order.length; i++) {
      const hi = TIERS[order[i - 1]], lo = TIERS[order[i]];
      for (const k of ['dprMax', 'rippleSlots', 'shadowSteps', 'exoSteps']) expect(lo[k]).toBeLessThanOrEqual(hi[k]);
    }
    expect(TIERS.lite.roil).toBe('noise');
    expect(TIERS.phone.roil).toBe('pops');
  });

  it('pickTier: device class by default, ?tier= overrides, junk is ignored', () => {
    expect(pickTier({ isMobile: false, search: '' })).toBe('full');
    expect(pickTier({ isMobile: true, search: '' })).toBe('phone');
    expect(pickTier({ isMobile: false, search: '?tier=lite' })).toBe('lite');
    expect(pickTier({ isMobile: true, search: '?perf=1&tier=full' })).toBe('full');
    expect(pickTier({ isMobile: true, search: '?tier=ultra' })).toBe('phone');
    expect(pickTier()).toBe('full');
  });

  it('calmOverride and perfHudOn read their flags', () => {
    expect(calmOverride('?calm=1')).toBe(true);
    expect(calmOverride('?calm=0')).toBe(false);
    expect(calmOverride('')).toBe(false);
    expect(perfHudOn('?tier=phone&perf=1')).toBe(true);
    expect(perfHudOn('?perf=yes')).toBe(false);
  });

  it('impulseOrder: strongest slot first (modes + ripple), stable on ties, no allocation', () => {
    const f = createImpulseFrame();
    f.wave[2 * 3 + 1] = 0.3;          // slot 3: ripple 0.3
    f.mode[3 * 5] = -0.5;             // slot 5: mode 0.5
    f.mode[3 * 1 + 2] = 0.1;          // slot 1: mode 0.1
    const out = new Array(IMPULSE_SLOTS).fill(-1);
    const r = impulseOrder(f, IMPULSE_SLOTS, out);
    expect(r).toBe(out);
    expect(out.slice(0, 3)).toEqual([5, 3, 1]);
    expect(out.slice(3)).toEqual([0, 2, 4, 6, 7]);
  });
});

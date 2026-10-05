import { describe, it, expect } from 'vitest';
import { TIERS, TIER_NAMES, pickTier, calmOverride, perfHudOn, perfHudMode, impulseOrder } from '../planetQuality';
import { SHADOW_STEPS } from '../planetLook';
import { VISIT_SURF_MAX } from '../visitorSim';
import { IMPULSE_SLOTS, SHAPE_ITERS, createImpulseFrame } from '../mercuryWaves';

describe('planetQuality', () => {
  it('names three tiers; full is exactly today\'s shader budget', () => {
    expect(TIER_NAMES).toEqual(['full', 'phone', 'lite']);
    expect(TIERS.full.shadowSteps).toBe(SHADOW_STEPS);
    expect(TIERS.full.rippleSlots).toBe(IMPULSE_SLOTS);
    expect(TIERS.full.dprMax).toBe(2);
    expect(TIERS.full.shapeIters).toBe(SHAPE_ITERS);
    expect(TIERS.phone.shapeIters).toBe(SHAPE_ITERS);
    expect(TIERS.phone.rippleSlots).toBe(4);
  });

  it('no tier carries a pop scale: the pops are sized from the live screen (mercuryRoil.popZoom)', () => {
    for (const name of TIER_NAMES) expect(TIERS[name]).not.toHaveProperty('popRefTh');
  });

  it('each tier costs no more than the one above it on every axis', () => {
    const order = ['full', 'phone', 'lite'];
    for (let i = 1; i < order.length; i++) {
      const hi = TIERS[order[i - 1]], lo = TIERS[order[i]];
      for (const k of ['dprMax', 'rippleSlots', 'shadowSteps', 'exoSteps', 'shapeIters']) expect(lo[k]).toBeLessThanOrEqual(hi[k]);
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
    expect(perfHudOn('?perf=2')).toBe(true);
    expect(perfHudOn('?perf=0')).toBe(false);
    expect(perfHudOn('?perf=yes')).toBe(false);
    expect(perfHudMode('?perf=2')).toBe(2);
    expect(perfHudMode('?perf=1')).toBe(1);
    expect(perfHudMode('')).toBe(0);
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

  it('droplet caps per tier (phase-5 spec §7.7)', () => {
    expect(TIERS.full.drop).toEqual({ bodies: 16, necks: 10, bridges: 12, steps: 48, satellites: true });
    expect(TIERS.phone.drop).toEqual({ bodies: 8, necks: 6, bridges: 8, steps: 32, satellites: true });
    expect(TIERS.lite.drop).toEqual({ bodies: 6, necks: 4, bridges: 6, steps: 24, satellites: false });
  });

  it('visitor surface slots per tier: full 4, phone 2, lite 1 (never more than JS writes)', () => {
    expect([TIERS.full.visitSlots, TIERS.phone.visitSlots, TIERS.lite.visitSlots]).toEqual([4, 2, 1]);
    for (const t of TIER_NAMES) expect(TIERS[t].visitSlots).toBeLessThanOrEqual(VISIT_SURF_MAX);
  });

  it('bead caps per tier', () => {
    expect(TIERS.full.beads).toBe(256);
    expect(TIERS.phone.beads).toBe(128);
    expect(TIERS.lite.beads).toBe(32);
    expect(TIERS.full.beadRate).toBe(1);
    expect(TIERS.phone.beadRate).toBe(0.55);
    expect(TIERS.lite.beadRate).toBe(0.3);
  });

  it('gas density multiplier per tier (mirror-sky spec §3d): full 3, phone ≥ 2, lite 1', () => {
    expect(TIERS.full.gasDensity).toBe(3);
    expect(TIERS.phone.gasDensity).toBeGreaterThanOrEqual(2);
    expect(TIERS.phone.gasDensity).toBeLessThanOrEqual(3);
    expect(TIERS.lite.gasDensity).toBe(1);
  });
});

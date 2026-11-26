// ecocideEye.test.js — the masthead eye locked to GROWTH_MANDATE: calm below 2 %, arterial
// pressure to 5 %, haemorrhage past it; the protection levers ring the iris until the gate;
// unlocking lets go.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const q = vi.hoisted(() => ({ calls: [] }));
vi.mock('../../../quintessence/observerStore', () => ({ holdEyeQuiet: (...a) => q.calls.push(a) }));
import { ecocideLook, ecocideRim, lockEcocideEye, resetEcocideEye, CALM_EDGE, BREACH } from '../ecocideEye';
import { LEVER_ACCENTS, LEVER_GATE, hexRgb } from '../protectionProtocol';
import { eyeDrive, live, release, HOLD_MS } from '../../../components/eyeDrive';
import { SHAPE } from '../../../components/observerEyeShader';
import { reactionKick } from '../../../components/eyeReactions';

const FAKE = ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout', 'clearTimeout'];
beforeEach(() => { resetEcocideEye(); q.calls.length = 0; vi.useFakeTimers({ toFake: FAKE }); });
afterEach(() => { release(); vi.useRealTimers(); });
const anyLive = () => {
  const t = performance.now();
  return ['mood', 'shape', 'palette', 'spin', 'rim'].some((k) => live(eyeDrive[k], t));
};

describe('ecocideLook', () => {
  it('calm_is_full_at_zero_and_cools_to_silver_at_the_edge', () => {
    expect(ecocideLook(0).calm).toBe(1);
    expect(ecocideLook(0).pal).toBeGreaterThan(0.9);
    expect(ecocideLook(1).calm).toBeCloseTo(0.5);
    const edge = ecocideLook(CALM_EDGE);
    expect([edge.calm, edge.pressure, edge.rupture, edge.pal, edge.mood, edge.spin]).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('pressure_climbs_to_the_boundary_and_the_swirl_tightens', () => {
    expect(ecocideLook(3.5).pressure).toBeCloseTo(0.5);
    expect(ecocideLook(3.5).rupture).toBe(0);
    expect(ecocideLook(4.5).spin).toBeGreaterThan(ecocideLook(3).spin);
    expect(ecocideLook(BREACH).pressure).toBe(1);
    expect(ecocideLook(BREACH).rupture).toBe(0);
  });

  it('the_breach_bursts_at_once_and_spreads_with_the_overshoot', () => {
    expect(ecocideLook(BREACH + 0.1).rupture).toBeGreaterThan(0.3);
    expect(ecocideLook(8.5).rupture).toBeGreaterThan(ecocideLook(6).rupture);
    expect(ecocideLook(9.5).rupture).toBe(1);
    expect(ecocideLook(9.5).pal).toBe(0);                          // the metal stays mercury
  });

  it('the_rim_is_the_mean_pull_and_drops_at_the_gate', () => {
    expect(ecocideRim(1, {}).w).toBe(0);
    expect(ecocideRim(1, { toxicityCap: 1, sanctuary: 1, restoration: 1, nativeBio: 1 }).w).toBe(1);
    expect(ecocideRim(1, { toxicityCap: 1 }).w).toBe(0.25);
    expect(ecocideRim(LEVER_GATE - 0.1, { sanctuary: 1 }).w).toBe(0.25);
    expect(ecocideRim(LEVER_GATE, { sanctuary: 1 }).w).toBe(0);
  });

  it('the_rim_colour_is_the_accents_mixed_by_pull', () => {
    const t = hexRgb(LEVER_ACCENTS.toxicityCap), r = hexRgb(LEVER_ACCENTS.restoration);
    const solo = ecocideRim(1, { toxicityCap: 0.4 }).col;
    for (let i = 0; i < 3; i++) expect(solo[i]).toBeCloseTo(t[i]);   // one lever: its own hue
    const mix = ecocideRim(1, { toxicityCap: 0.25, restoration: 0.75 }).col;
    for (let i = 0; i < 3; i++) expect(mix[i]).toBeCloseTo(0.25 * t[i] + 0.75 * r[i]);
  });
});

describe('lockEcocideEye', () => {
  it('the_drive_is_one_object_per_page', async () => {
    // Hot reload can leave two copies of eyeDrive alive; both must share the channels.
    const again = await import('../../../components/eyeDrive.js?copy=' + Date.now());
    expect(again.eyeDrive).toBe(eyeDrive);
  });

  it('holds_the_parked_value_with_no_input_and_follows_it', () => {
    let g = 8.5;
    const unlock = lockEcocideEye(() => g);
    vi.advanceTimersByTime(5000);                                  // parked, no drag at all
    expect(live(eyeDrive.shape, performance.now())).toBe(true);
    expect(eyeDrive.shape.id).toBe(SHAPE.vessels);
    expect(eyeDrive.shape.a).toBeGreaterThan(0.99);
    expect(eyeDrive.shape.b).toBeGreaterThan(0.8);
    expect(live(eyeDrive.palette, performance.now())).toBe(false);
    g = 0;
    vi.advanceTimersByTime(3000);
    expect(eyeDrive.shape.a).toBeLessThan(0.01);
    expect(eyeDrive.shape.b).toBeLessThan(0.05);
    expect(eyeDrive.shape.c).toBeGreaterThan(0.95);
    expect(eyeDrive.palette.quiet).toBe(true);                       // lapses without back-spin
    unlock();
  });

  it('the_rim_holds_with_no_input_and_fades_past_the_gate_keeping_its_colour', () => {
    let g = 1;
    const lev = { toxicityCap: 1, sanctuary: 0, restoration: 0, nativeBio: 0 };
    const unlock = lockEcocideEye(() => g, () => lev);
    vi.advanceTimersByTime(4000);                                  // parked: nothing is being dragged
    expect(live(eyeDrive.rim, performance.now())).toBe(true);
    expect(eyeDrive.rim.w).toBeCloseTo(0.25);
    const t = hexRgb(LEVER_ACCENTS.toxicityCap);
    for (let i = 0; i < 3; i++) expect(eyeDrive.rim.col[i]).toBeCloseTo(t[i], 0);
    g = LEVER_GATE + 0.5;
    vi.advanceTimersByTime(3000);
    expect(eyeDrive.rim.w).toBeLessThan(0.01);
    for (let i = 0; i < 3; i++) expect(eyeDrive.rim.col[i]).toBeCloseTo(t[i], 0);   // it fades, it does not change hue
    unlock();
  });

  it('unlocking_lets_every_channel_lapse', () => {
    const unlock = lockEcocideEye(() => 0.5, () => ({ sanctuary: 0.5 }));
    vi.advanceTimersByTime(500);
    expect(anyLive()).toBe(true);
    unlock();
    vi.advanceTimersByTime(HOLD_MS + 50);
    expect(anyLive()).toBe(false);
  });

  it('the_lock_holds_glances_off_the_eye_but_lets_the_idle_riddle_through', () => {
    const unlock = lockEcocideEye(() => 3);
    expect(q.calls).toEqual([[true, { idle: true }]]);
    unlock();
    unlock();                                            // idempotent: released once
    expect(q.calls).toEqual([[true, { idle: true }], [false, { idle: true }]]);
  });

  it('reduced_motion_takes_no_lock_and_no_hold', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    lockEcocideEye(() => 3)();
    expect(q.calls).toEqual([]);
    vi.unstubAllGlobals();
  });

  it('the_slider_release_reaction_plays_nothing_over_the_lock', () => {
    const k = reactionKick({ piece: 'ecocide.growth', kind: 7, tier: 'witness', tint: [122, 184, 0], tint2: null, dir: 1, durationMs: 900 });
    expect(Array.isArray(k.keys)).toBe(true);
    expect(k.keys.every((x) => x.level === 0)).toBe(true);
    expect(k.tint).toEqual([122, 184, 0]);                          // reduced motion keeps its colour hold
  });
});

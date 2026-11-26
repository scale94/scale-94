// src/terminal/quintessence/__tests__/observerStore.test.js
// The agency reducer (spec §5.2): only a hand moves the eye; tiers never step on each other.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  startObserver, notifyNav, subscribeImpulse, getObserver, subscribeObserver,
  NAV_TINTS, FLASH_MS, WITNESS_MS, VERTEBRA_MS, CRESCENDO_MS, _resetObserverForTests,
  setChromeVisible, QUIET_MS, GLANCE_IN_MS, GLANCE_HOLD_MS, GLANCE_OUT_MS, GLANCE_GAP_MS,
  IDLE_MS, COOLDOWN_MIN_MS, COOLDOWN_MAX_MS, AFTER_REACTION_MS, WHISPER_MS, PHRASE_BUSY_MS,
  MOBILE_HOLD_MS, glanceLevel, GLANCE_TOTAL_MS, notifyTtyEnter, notifyAccretion, notifySurveillance, notifyCrypto, notifyLedger, ledgerSettleMs, holdEyeQuiet,
} from '../observerStore';
import { PIECE_TAB, TAB_PIECES, RIDDLES } from '../whispers';
import { setTrend, setCouncil, setPhase, setElement, _resetSpineForTests } from '../spineStore';
import { STORAGE_KEY } from '../sealedArtifact';
import { _resetVolatileForTests, holdVolatile } from '../volatileHold';
import { emit, subscribe as subscribeBus, _resetForTests as _resetBusForTests } from '../../../observatory/observatoryBus';
import { KICK } from '../../components/observerEyeShader';
import { LUNAR_ACCORDS } from '../../data/lunarAccords';

const COUNCIL = { pair: ['a', 'b'], directive: 'd', trajectory: 't', paradoxCount: 1 };
const PHASE = LUNAR_ACCORDS[0].accord;

let impulses;
let t;
const flush = () => Promise.resolve();        // the coalescing microtask
const step = async (ms) => { t += ms; vi.advanceTimersByTime(ms); await flush(); };

function boot(tab = 'mercury') {
  startObserver({ tab });
  subscribeImpulse(imp => impulses.push(imp));
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  sessionStorage.clear();
  _resetBusForTests();
  _resetSpineForTests();
  _resetVolatileForTests();
  t = 1000;
  _resetObserverForTests({ now: () => t, random: () => 0 });
  impulses = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
  _resetObserverForTests();
  _resetBusForTests();
  _resetSpineForTests();
  _resetVolatileForTests();
  vi.useRealTimers();
});

describe('observerStore — agency filter', () => {
  it('sim_events_produce_no_impulse', async () => {
    boot();
    emit('gaze', 'art_regime', { r: 3.7 });
    emit('gaze', 'art_chimera', {});
    emit('gaze', 'ecocide_phase', { growthRate: 0.4 });
    emit('gaze', 'art_bifurcation', { count: 2 });
    emit('gaze', 'sol_release', { energyErg: 1e30, handedness: 'L', hand: false });
    await flush();
    expect(impulses).toHaveLength(0);
  });

  it('hand_events_produce_witness', async () => {
    boot();
    emit('essences', 'collision_fired', {});
    await flush();
    expect(impulses).toHaveLength(1);
    expect(impulses[0]).toMatchObject({
      piece: 'scent.collide', kind: KICK.merge, tier: 'witness', durationMs: WITNESS_MS,
      tint: NAV_TINTS.scaling, dir: 1, at: 1000,
    });
    expect(WITNESS_MS).toBe(1100);
  });

  it('mixed kinds pass only with hand:true; flick carries its dir and no tint', async () => {
    boot();
    emit('gaze', 'art_bifurcation', { count: 1, hand: true });
    await step(WITNESS_MS);
    emit('gaze', 'sol_release', { energyErg: 1, handedness: 'R', hand: true });
    await step(WITNESS_MS);
    emit('gaze', 'mercury_flick', { speed: 3, dir: -1, hand: true });
    await flush();
    expect(impulses.map(i => [i.piece, i.kind])).toEqual([
      ['chaos.fork', KICK.split], ['sol.release', KICK.ring], ['mercury.flick', KICK.shove],
    ]);
    expect(impulses[0].tint).toEqual(NAV_TINTS.art);
    expect(impulses[2]).toMatchObject({ tint: null, dir: -1 });
  });

  it('a lit element carries its phase, by hand only', async () => {
    boot();
    emit('gaze', 'mercury_element', { phase: 'thermal' });
    await flush();
    expect(impulses).toEqual([]);
    emit('gaze', 'mercury_element', { phase: 'thermal', hand: true });
    await flush();
    expect(impulses.map(i => [i.piece, i.kind])).toEqual([['mercury.element', KICK.inhale]]);
    expect(impulses[0].data).toEqual({ phase: 'thermal' });
  });

  it('privacy drawer navigation stares back; other tab_navigated is ignored', async () => {
    boot();
    emit('gaze', 'tab_navigated', { tab: 'ledger' });
    await flush();
    expect(impulses).toHaveLength(0);
    emit('gaze', 'tab_navigated', { tab: 'privacy' });
    await flush();
    expect(impulses).toHaveLength(1);
    expect(impulses[0]).toMatchObject({
      piece: 'surveillance.privacy', kind: KICK.stare, tier: 'witness', tint: NAV_TINTS.surveillance,
    });
  });

  it('verdict_issued (the AuditCascade timer, no hand) yields no impulse', async () => {
    boot();
    emit('transmissions', 'verdict_issued', { verdict: 'x' });
    await flush();
    expect(impulses).toHaveLength(0);
  });

  it('kernel.run keeps the violet x lime compiling look', async () => {
    boot();
    emit('transmissions', 'kernel_completed', {});
    await flush();
    expect(impulses).toHaveLength(1);
    expect(impulses[0]).toMatchObject({
      piece: 'kernel.run', kind: KICK.miosis, tint: [167, 139, 250], tint2: [122, 184, 0],
    });
  });

  it('nothing is heard before startObserver, and start is idempotent', async () => {
    subscribeImpulse(imp => impulses.push(imp));
    emit('essences', 'collision_fired', {});
    await flush();
    expect(impulses).toHaveLength(0);
    startObserver({ tab: 'mercury' });
    startObserver({ tab: 'mercury' });
    emit('essences', 'collision_fired', {});
    await flush();
    expect(impulses).toHaveLength(1);
  });
});

describe('observerStore — vertebrae', () => {
  it('first_vertebra_mark_is_vertebra_tier_remark_is_witness', async () => {
    boot();
    setTrend({ label: 'x', velocity: 0.5 });
    await step(VERTEBRA_MS);
    setTrend({ label: 'y', velocity: 0.6 });
    await flush();
    expect(impulses.map(i => [i.piece, i.kind, i.tier, i.durationMs])).toEqual([
      ['bsky.trend', KICK.flutter, 'vertebra', VERTEBRA_MS],
      ['bsky.trend', KICK.flutter, 'witness', WITNESS_MS],
    ]);
    expect(impulses[0].tint).toEqual(NAV_TINTS.bsky);
  });

  it('a vertebra already in the spine at start is not a first mark', async () => {
    setPhase(PHASE);
    boot();
    setPhase(LUNAR_ACCORDS[1].accord);
    await flush();
    expect(impulses).toHaveLength(1);
    expect(impulses[0]).toMatchObject({ piece: 'lunar.phase', kind: KICK.sweep, tier: 'witness' });
  });

  it('council_collision_plus_spine_write_coalesce', async () => {
    boot();
    setCouncil(COUNCIL);
    emit('edge', 'council_collision', { pair: COUNCIL.pair });
    await flush();
    expect(impulses).toHaveLength(1);
    expect(impulses[0]).toMatchObject({
      piece: 'accretion.collide', kind: KICK.spiral, tier: 'vertebra', tint: NAV_TINTS.manifesto,
    });
  });

  it('element_write_starts_ignition_not_vertebra', async () => {
    boot();
    setElement('FIRE');
    emit('edge', 'kernel_ignited', { element: 'FIRE' });
    await flush();
    expect(getObserver().igniting).toBe(true);
    expect(impulses).toHaveLength(0);
  });
});

describe('observerStore — seal', () => {
  it('kernel_sealed_fires_crescendo_and_seals', async () => {
    boot();
    const seen = [];
    subscribeObserver(s => seen.push(s));
    emit('edge', 'kernel_ignited', { element: 'FIRE' });
    emit('edge', 'kernel_sealed', { hash: 'h' });
    await flush();
    expect(impulses).toHaveLength(1);
    expect(impulses[0]).toMatchObject({
      piece: 'altar.seal', kind: 0, tier: 'crescendo', tint: null, durationMs: CRESCENDO_MS,
    });
    expect(getObserver()).toMatchObject({ sealed: true, igniting: false, remarkedSinceSeal: false });
    expect(seen.at(-1)).toMatchObject({ sealed: true, igniting: false });
  });

  it('ignite_ended_clears_igniting', async () => {
    boot();
    emit('edge', 'kernel_ignited', { element: 'AIR' });
    expect(getObserver().igniting).toBe(true);
    emit('edge', 'kernel_ignite_ended', { sealed: false });
    await flush();
    expect(getObserver()).toMatchObject({ igniting: false, sealed: false });
    expect(impulses).toHaveLength(0);
  });

  it('reload_with_seal_starts_sealed_without_crescendo', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hash: 'old' }));
    boot();
    await flush();
    expect(getObserver().sealed).toBe(true);
    expect(impulses).toHaveLength(0);
  });

  it('a seal in storage is in the very first snapshot, before startObserver', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hash: 'old' }));
    expect(getObserver().sealed).toBe(true);
  });

  it('a volatile seal is in the first snapshot too; no seal reads unsealed', () => {
    expect(getObserver().sealed).toBe(false);
    _resetObserverForTests({ now: () => t, random: () => 0 });
    holdVolatile({ hash: 'v' });
    expect(getObserver().sealed).toBe(true);
  });

  it('remark_after_seal_sets_remarkedSinceSeal', async () => {
    boot();
    emit('edge', 'kernel_sealed', { hash: 'h' });
    expect(getObserver().remarkedSinceSeal).toBe(false);
    setPhase(PHASE);
    expect(getObserver().remarkedSinceSeal).toBe(true);
  });

  it('lower_tier_never_interrupts_higher', async () => {
    boot();
    emit('edge', 'kernel_sealed', { hash: 'h' });
    await step(CRESCENDO_MS - 1);
    emit('essences', 'collision_fired', {});
    await flush();
    expect(impulses.map(i => i.tier)).toEqual(['crescendo']);

    await step(1);
    setTrend({ label: 'x', velocity: 0.5 });
    await step(VERTEBRA_MS - 1);
    emit('essences', 'collision_fired', {});
    await flush();
    expect(impulses.map(i => i.tier)).toEqual(['crescendo', 'vertebra']);

    await step(1);
    emit('essences', 'collision_fired', {});
    await flush();
    expect(impulses.map(i => i.tier)).toEqual(['crescendo', 'vertebra', 'witness']);
  });

  it('an equal tier re-triggers (the newest wins)', async () => {
    boot();
    emit('essences', 'collision_fired', {});
    await step(100);
    emit('ciphers', 'cipher_sealed', {});
    await flush();
    expect(impulses.map(i => i.piece)).toEqual(['scent.collide', 'crypto.seal']);
  });
});

describe('observerStore — flash + snapshot', () => {
  it('notifyNav_flash_expires', () => {
    boot('mercury');
    expect(getObserver().flash).toBeNull();
    notifyNav('ledger');
    expect(getObserver().flash).toEqual({ tab: 'ledger', tint: NAV_TINTS.ledger });
    vi.advanceTimersByTime(FLASH_MS - 1);
    expect(getObserver().flash).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(getObserver().flash).toBeNull();
    expect(FLASH_MS).toBe(1500);
  });

  it('snapshot is stable between changes and carries the Task 5 slots empty', () => {
    boot();
    const a = getObserver();
    expect(getObserver()).toBe(a);
    expect(a).toEqual({
      flash: null, glance: null, whisper: null, igniting: false,
      sealed: false, remarkedSinceSeal: false, wantsChrome: false,
    });
  });

  it('a throwing subscriber does not stop the others', async () => {
    boot();
    subscribeImpulse(() => { throw new Error('noisy'); });
    const late = [];
    subscribeImpulse(imp => late.push(imp));
    emit('essences', 'collision_fired', {});
    await flush();
    expect(late).toHaveLength(1);
  });
});

describe('whispers tables', () => {
  it('TAB_PIECES inverts PIECE_TAB', () => {
    expect(TAB_PIECES.mercury.sort()).toEqual(['altar.ignite', 'mercury.flick']);
    for (const [piece, tab] of Object.entries(PIECE_TAB)) expect(TAB_PIECES[tab]).toContain(piece);
  });
});

describe('observerStore — Task 4 review minors', () => {
  it('a null payload does not drop a hand event', async () => {
    boot();
    emit('ciphers', 'cipher_sealed', null);         // a kind whose bus totals never read the payload
    await flush();
    expect(impulses).toHaveLength(1);
  });

  it('a repeat kernel_ignited while igniting does not ping', () => {
    boot();
    emit('edge', 'kernel_ignited', { element: 'FIRE' });
    const seen = [];
    subscribeObserver(s => seen.push(s));
    emit('edge', 'kernel_ignited', { element: 'FIRE' });
    expect(seen).toHaveLength(0);
  });

  it('a volatile seal (localStorage refused) starts sealed without a crescendo', async () => {
    holdVolatile({ hash: 'v' });
    const refuse = () => { throw new Error('refused'); };
    vi.stubGlobal('localStorage', { getItem: refuse, setItem: refuse, removeItem: refuse, clear: refuse });
    boot();
    await flush();
    expect(getObserver().sealed).toBe(true);
    expect(impulses).toHaveLength(0);
  });

  it('reset unsubscribes from the bus and the spine', async () => {
    boot();
    _resetObserverForTests({ now: () => t, random: () => 0 });
    subscribeImpulse(imp => impulses.push(imp));
    const before = getObserver();
    setTrend({ label: 'x', velocity: 0.5 });
    emit('essences', 'collision_fired', {});
    emit('edge', 'kernel_ignited', { element: 'FIRE' });
    await flush();
    expect(impulses).toHaveLength(0);
    expect(getObserver()).toBe(before);
  });
});

// A hand act whose reaction settles; the forward whisper is due AFTER_REACTION_MS later.
const act = async () => { emit('essences', 'collision_fired', {}); await flush(); };
const SETTLE = WITNESS_MS + AFTER_REACTION_MS;
const press = (type) => window.dispatchEvent(new Event(type));
// 'privacy' houses no piece, so no idle whisper interferes with glance / forward tests.
const QUIET_TAB = 'privacy';

describe('observerStore — constants', () => {
  it('match the brief', () => {
    expect({
      QUIET_MS, GLANCE_IN_MS, GLANCE_HOLD_MS, GLANCE_OUT_MS, GLANCE_GAP_MS, IDLE_MS,
      COOLDOWN_MIN_MS, COOLDOWN_MAX_MS, AFTER_REACTION_MS, WHISPER_MS, PHRASE_BUSY_MS, MOBILE_HOLD_MS,
    }).toEqual({
      QUIET_MS: 8000, GLANCE_IN_MS: 1200, GLANCE_HOLD_MS: 3000, GLANCE_OUT_MS: 1500, GLANCE_GAP_MS: 25000,
      IDLE_MS: 13000, COOLDOWN_MIN_MS: 60000, COOLDOWN_MAX_MS: 90000, AFTER_REACTION_MS: 2500,
      WHISPER_MS: 6000, PHRASE_BUSY_MS: 5100, MOBILE_HOLD_MS: 30000,
    });
  });
});

describe('observerStore — glances', () => {
  it('glanceLevel ramps in, holds, ramps out (D5 slow ease)', () => {
    const g = { startedAt: 1000 };
    expect(glanceLevel(g, 1000)).toBe(0);
    expect(glanceLevel(g, 1000 + GLANCE_IN_MS / 2)).toBeCloseTo(0.5, 6);
    expect(glanceLevel(g, 1000 + GLANCE_IN_MS / 4)).toBeGreaterThan(0);
    expect(glanceLevel(g, 1000 + GLANCE_IN_MS / 4)).toBeLessThan(0.5);
    expect(glanceLevel(g, 1000 + GLANCE_IN_MS)).toBe(1);
    expect(glanceLevel(g, 1000 + GLANCE_IN_MS + GLANCE_HOLD_MS - 1)).toBe(1);
    expect(glanceLevel(g, 1000 + GLANCE_IN_MS + GLANCE_HOLD_MS + GLANCE_OUT_MS / 2)).toBeCloseTo(0.5, 6);
    expect(glanceLevel(g, 1000 + GLANCE_TOTAL_MS)).toBe(0);
    expect(glanceLevel(null, 5000)).toBe(0);
    expect(GLANCE_TOTAL_MS).toBe(GLANCE_IN_MS + GLANCE_HOLD_MS + GLANCE_OUT_MS);
  });

  it('flash_cancels_glance_and_nothing_reasserts', async () => {
    boot('mercury');
    await step(QUIET_MS);
    expect(getObserver().glance).toMatchObject({ reason: 'compass' });
    notifyNav('kernel');
    expect(getObserver().glance).toBeNull();
    await step(1600);
    expect(getObserver().flash).toBeNull();
    expect(getObserver().glance).toBeNull();
    for (let left = QUIET_MS - 1; left > 0; left -= Math.min(500, left)) {
      await step(Math.min(500, left));
      expect(getObserver().glance).toBeNull();
    }
  });

  it('compass_glance_waits_quiet_window_and_gap', async () => {
    boot(QUIET_TAB);
    await step(5000);
    notifyNav(QUIET_TAB);                       // the quiet window restarts when this flash ends
    await step(FLASH_MS + QUIET_MS - 1);
    expect(getObserver().glance).toBeNull();
    await step(1);
    expect(getObserver().glance).toEqual({
      tab: 'bsky', tint: NAV_TINTS.bsky, shimmer: false, reason: 'compass', startedAt: t,
    });
    const g = getObserver().glance;
    const seen = [];
    subscribeObserver(s => seen.push(s));
    await step(GLANCE_IN_MS);
    expect(glanceLevel(g, t)).toBe(1);
    await step(GLANCE_HOLD_MS);
    expect(glanceLevel(g, t)).toBe(1);
    expect(seen).toHaveLength(0);                 // the ease needs no pings: it is a function of time
    await step(GLANCE_OUT_MS);
    expect(getObserver().glance).toBeNull();
    await step(GLANCE_GAP_MS - 1);
    expect(getObserver().glance).toBeNull();
    await step(1);
    expect(getObserver().glance).toMatchObject({ reason: 'compass', startedAt: t });
    // An impulse during a glance cancels it immediately.
    await act();
    await flush();
    expect(getObserver().glance).toBeNull();
  });

  it('a_driven_eye_is_held_quiet_no_glance_or_whisper_starts_over_it', async () => {
    boot(QUIET_TAB);
    await step(QUIET_MS);
    expect(getObserver().glance).toMatchObject({ reason: 'compass' });
    holdEyeQuiet(true);                                  // e.g. /LUNAR's moon: the glance in progress ends
    expect(getObserver().glance).toBeNull();
    await act();                                         // an act would earn a forward whisper...
    await step(60000);
    expect(getObserver().glance).toBeNull();             // ...but nothing starts while held
    expect(getObserver().whisper).toBeNull();
    holdEyeQuiet(false);
    await step(AFTER_REACTION_MS - 1);
    expect(getObserver().whisper).toBeNull();            // the usual gap runs from the release
    await step(1);
    expect(getObserver().whisper).not.toBeNull();
  });

  it('a_held_eye_with_idle_still_gets_its_own_tabs_riddle_but_no_compass', async () => {
    boot('ecocide');
    holdEyeQuiet(true, { idle: true });                  // /ECOCIDE's lock, from the moment it opens
    await step(QUIET_MS);
    expect(getObserver().glance).toBeNull();             // the compass would have glanced by now
    await step(IDLE_MS - QUIET_MS);
    expect(getObserver().whisper).toMatchObject({ piece: 'ecocide.growth' });   // the riddle at the slider
    holdEyeQuiet(true);                                  // tightening the hold in place is allowed
    holdEyeQuiet(false);
  });

  it('compass_glance_points_at_first_unmarked_vertebra_before_any_mark', async () => {
    boot(QUIET_TAB);
    await step(QUIET_MS);
    expect(getObserver().glance).toMatchObject({ tab: 'bsky', reason: 'compass' });
    _resetObserverForTests({ now: () => t, random: () => 0 });
    setTrend({ label: 'x', velocity: 0.5 });
    boot(QUIET_TAB);
    await step(QUIET_MS);
    expect(getObserver().glance).toMatchObject({ tab: 'manifesto', tint: NAV_TINTS.manifesto });
  });

  it('no_compass_when_armed_or_sealed', async () => {
    setTrend({ label: 'x', velocity: 0.5 });
    setCouncil(COUNCIL);
    setPhase(PHASE);
    boot(QUIET_TAB);
    await step(QUIET_MS + GLANCE_GAP_MS);
    expect(getObserver().glance).toBeNull();

    _resetObserverForTests({ now: () => t, random: () => 0 });
    _resetSpineForTests();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hash: 'old' }));
    boot(QUIET_TAB);
    await step(QUIET_MS + GLANCE_GAP_MS);
    expect(getObserver().glance).toBeNull();
  });
});

describe('observerStore — whispers', () => {
  it('idle_whisper_fires_at_IDLE_MS_on_mercury_without_prior_act', async () => {
    boot('mercury');
    await step(IDLE_MS - 1);
    expect(getObserver().whisper).toBeNull();
    await step(1);
    expect(getObserver().whisper).toEqual({
      id: 'mercury.flick:0', text: RIDDLES['mercury.flick'][0], piece: 'mercury.flick',
    });
    expect(getObserver().glance).toEqual({
      tab: 'mercury', tint: null, shimmer: true, reason: 'whisper', startedAt: t,
    });
    await step(WHISPER_MS);
    expect(getObserver().whisper).toBeNull();
  });

  it('tab_navigated moves activeTab: the idle whisper targets the new tab', async () => {
    boot(QUIET_TAB);
    emit('gaze', 'tab_navigated', { tab: 'ledger' });   // e.g. return-to-root, search
    await step(IDLE_MS);
    expect(getObserver().whisper).toMatchObject({ piece: 'ledger.write' });
  });

  it('tab_navigated to privacy (the drawer) does not move activeTab', async () => {
    boot('ledger');
    emit('gaze', 'tab_navigated', { tab: 'privacy' });
    await step(IDLE_MS + 2000);
    expect(getObserver().whisper).toMatchObject({ piece: 'ledger.write' });
  });

  it('emits edge/eye_whisper {target} once per shown whisper, deferred', async () => {
    const got = [];
    subscribeBus(e => { if (e.kind === 'eye_whisper') got.push(e); });
    boot('mercury');
    await step(IDLE_MS);
    expect(getObserver().whisper).toMatchObject({ piece: 'mercury.flick' });
    await step(0);
    await step(WHISPER_MS);
    expect(got.map(e => [e.category, e.payload])).toEqual([['edge', { target: 'mercury.flick' }]]);
  });

  it('a held whisper emits eye_whisper only when it shows; a dropped one never', async () => {
    const got = [];
    subscribeBus(e => { if (e.kind === 'eye_whisper') got.push(e); });
    boot(QUIET_TAB);
    setChromeVisible(false);
    await act();
    await step(SETTLE);
    await step(MOBILE_HOLD_MS);
    expect(got).toHaveLength(0);
    setChromeVisible(true);
    await step(0);
    expect(got).toHaveLength(0);
  });

  it('pointermove_does_not_reset_idle_but_pointerdown_does', async () => {
    boot('mercury');
    await step(IDLE_MS - 1000);
    press('pointerdown');
    await step(1000);
    expect(getObserver().whisper).toBeNull();
    await step(IDLE_MS - 1001);
    expect(getObserver().whisper).toBeNull();
    await step(1);
    expect(getObserver().whisper).toMatchObject({ piece: 'mercury.flick' });

    _resetObserverForTests({ now: () => t, random: () => 0 });
    sessionStorage.clear();
    boot('mercury');
    await step(IDLE_MS - 1000);
    press('pointermove');
    await step(1000);
    expect(getObserver().whisper).toMatchObject({ piece: 'mercury.flick' });
  });

  it('forward_whisper_needs_first_act_and_skips_current_tab', async () => {
    boot(QUIET_TAB);
    await step(30000);
    expect(getObserver().whisper).toBeNull();     // browsing alone never earns a forward whisper
    notifyNav('mercury');
    await step(FLASH_MS + AFTER_REACTION_MS);      // the flash and its silver rest are over
    await act();
    await step(SETTLE - 1);
    expect(getObserver().whisper).toBeNull();
    await step(1);
    // mercury.flick is first in order but the visitor stands on /MERCURY: skip to the first vertebra.
    expect(getObserver().whisper).toMatchObject({ id: 'bsky.trend:0', piece: 'bsky.trend' });
    expect(getObserver().glance).toEqual({
      tab: 'bsky', tint: NAV_TINTS.bsky, shimmer: false, reason: 'whisper', startedAt: t,
    });
  });

  it('cooldown_60_90_between_whispers_except_first', async () => {
    _resetObserverForTests({ now: () => t, random: () => 0.5 });   // cooldown = 75 s
    boot(QUIET_TAB);
    await act();
    await step(SETTLE);
    const first = getObserver().whisper;
    expect(first).toMatchObject({ piece: 'mercury.flick' });      // the first whisper waits for no cooldown
    const firedAt = t;
    await step(WHISPER_MS);
    notifyNav('ledger');                                            // idle-eligible, held by the cooldown
    await step(30000);
    await act();                                                          // a forward inside the cooldown: dropped
    await step(SETTLE);
    expect(getObserver().whisper).toBeNull();
    await step(firedAt + 75000 - 1 - t);
    expect(getObserver().whisper).toBeNull();
    await step(1);
    expect(getObserver().whisper).toMatchObject({ piece: 'ledger.write' });
  });

  it('marked_vertebra_never_whispered', async () => {
    setTrend({ label: 'x', velocity: 0.5 });
    boot(QUIET_TAB);
    emit('gaze', 'mercury_flick', { speed: 3, dir: 1, hand: true });
    await flush();
    await step(SETTLE);
    expect(getObserver().whisper).toMatchObject({ piece: 'accretion.collide' });
    expect(getObserver().glance).toMatchObject({ tab: 'manifesto' });
  });

  it('spent_survives_store_restart_within_session', async () => {
    boot(QUIET_TAB);
    await act();
    await step(SETTLE);
    expect(getObserver().whisper.id).toBe('mercury.flick:0');
    _resetObserverForTests({ now: () => t, random: () => 0 });
    boot(QUIET_TAB);
    await step(COOLDOWN_MAX_MS);
    await act();
    await step(SETTLE);
    expect(getObserver().whisper.id).toBe('mercury.flick:1');
  });

  it('session_storage_throwing_is_volatile_and_safe', async () => {
    const refuse = () => { throw new Error('refused'); };
    vi.stubGlobal('sessionStorage', { getItem: refuse, setItem: refuse, removeItem: refuse, clear: refuse });
    boot(QUIET_TAB);
    const ids = [];
    for (let i = 0; i < 3; i++) {
      await act();
      await step(SETTLE);
      ids.push(getObserver().whisper?.id);
      await step(COOLDOWN_MAX_MS);
    }
    expect(ids).toEqual(['mercury.flick:0', 'mercury.flick:1', 'mercury.flick:2']);
  });

  it('whisper_waits_for_chrome_and_drops_unspent_after_30s', async () => {
    boot(QUIET_TAB);
    setChromeVisible(false);
    await act();
    await step(SETTLE);
    expect(getObserver().whisper).toBeNull();
    expect(getObserver().wantsChrome).toBe(true);    // a held whisper asks for the masthead (D16)
    await step(MOBILE_HOLD_MS - 1);
    setChromeVisible(true);
    expect(getObserver().whisper).toMatchObject({ id: 'mercury.flick:0' });
    expect(getObserver().glance).toMatchObject({ reason: 'whisper' });

    await step(COOLDOWN_MAX_MS);
    setChromeVisible(false);
    await act();
    await step(SETTLE);
    expect(getObserver().whisper).toBeNull();
    await step(MOBILE_HOLD_MS);
    setChromeVisible(true);
    expect(getObserver().whisper).toBeNull();     // dropped
    await act();
    await step(SETTLE);
    expect(getObserver().whisper).toMatchObject({ id: 'mercury.flick:1' });   // the dropped id was never spent
  });

  it('held whisper asks for chrome; chrome returning shows it', async () => {
    boot(QUIET_TAB);
    setChromeVisible(false);
    await act();
    await step(SETTLE);
    expect(getObserver()).toMatchObject({ whisper: null, wantsChrome: true });
    setChromeVisible(true);
    expect(getObserver().whisper).toMatchObject({ id: 'mercury.flick:0' });
    expect(getObserver().wantsChrome).toBe(true);
    await step(WHISPER_MS);
    expect(getObserver().wantsChrome).toBe(false);
  });

  it('a hidden document holds the whisper (not spent) and showing it releases it', async () => {
    let hidden = true;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    try {
      boot(QUIET_TAB);
      await act();
      await step(SETTLE);
      expect(getObserver().whisper).toBeNull();
      await step(5000);
      expect(getObserver().whisper).toBeNull();
      hidden = false;
      document.dispatchEvent(new Event('visibilitychange'));
      expect(getObserver().whisper).toMatchObject({ id: 'mercury.flick:0' });
    } finally {
      delete document.hidden;
    }
  });

  it('a whisper held by a hidden document and dropped after 30 s is never spent', async () => {
    let hidden = true;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    try {
      boot(QUIET_TAB);
      await act();
      await step(SETTLE);
      expect(getObserver()).toMatchObject({ whisper: null, wantsChrome: true });
      await step(MOBILE_HOLD_MS);
      hidden = false;
      document.dispatchEvent(new Event('visibilitychange'));
      expect(getObserver().whisper).toBeNull();
      await act();
      await step(SETTLE);
      expect(getObserver().whisper).toMatchObject({ id: 'mercury.flick:0' });
    } finally {
      delete document.hidden;
    }
  });

  it('a held whisper dropped after 30 s stops asking for chrome', async () => {
    boot(QUIET_TAB);
    setChromeVisible(false);
    await act();
    await step(SETTLE);
    expect(getObserver().wantsChrome).toBe(true);
    await step(MOBILE_HOLD_MS);
    expect(getObserver().wantsChrome).toBe(false);
  });

  it('no forward-whisper glance during a nav flash, and silver between the flash and the whisper', async () => {
    boot(QUIET_TAB);
    // The act touches mercury.flick, so the forward target is bsky: a real hue that would jump.
    emit('gaze', 'mercury_flick', { speed: 3, dir: 1, hand: true });
    await flush();
    await step(SETTLE - 600);
    notifyNav('ledger');                           // flash outlives the forward deadline
    const flashEnd = t + FLASH_MS;
    for (let left = FLASH_MS; left > 0; left -= 100) {
      await step(100);
      const o = getObserver();
      if (o.flash) expect(o.glance).toBeNull();
    }
    expect(getObserver().flash).toBeNull();
    // Flash over: the eye rests in silver for AFTER_REACTION_MS before the whisper's hue leans in.
    while (t < flashEnd + AFTER_REACTION_MS - 100) {
      await step(100);
      expect(getObserver()).toMatchObject({ flash: null, glance: null, whisper: null });
    }
    await step(flashEnd + AFTER_REACTION_MS - t);
    expect(getObserver().whisper).toMatchObject({ piece: 'bsky.trend' });   // deferred, not lost
    expect(getObserver().glance).toMatchObject({ reason: 'whisper', tab: 'bsky', tint: NAV_TINTS.bsky });
  });

  it('wantsChrome_true_during_whisper_and_crescendo', async () => {
    boot(QUIET_TAB);
    expect(getObserver().wantsChrome).toBe(false);
    await act();
    await step(SETTLE);
    expect(getObserver().wantsChrome).toBe(true);
    await step(WHISPER_MS);
    expect(getObserver().wantsChrome).toBe(false);
    emit('edge', 'kernel_ignited', { element: 'FIRE' });
    expect(getObserver().wantsChrome).toBe(true);
    emit('edge', 'kernel_sealed', { hash: 'h' });
    await step(CRESCENDO_MS - 1);
    expect(getObserver().wantsChrome).toBe(true);
    await step(1);
    expect(getObserver().wantsChrome).toBe(false);
  });

  it('tty_enter_flicks_the_kernel_chip_off_the_bus', async () => {
    boot('kernel');
    const bus = [];
    subscribeBus((e) => bus.push(e));
    notifyTtyEnter();
    await flush();
    expect(impulses.map((i) => i.piece)).toEqual(['kernel.enter']);
    expect(impulses[0]).toMatchObject({ kind: KICK.miosis, tier: 'witness', tint: NAV_TINTS.kernel });
    expect(bus).toHaveLength(0);                 // a keystroke is not telemetry
  });

  it('accretion_lifecycle_reaches_the_eye_off_the_bus', async () => {
    boot('manifesto');
    const bus = [];
    subscribeBus((e) => bus.push(e));
    notifyAccretion('prime');
    await flush();
    notifyAccretion('infall');
    await flush();
    expect(impulses.map((i) => i.piece)).toEqual(['accretion.prime', 'accretion.infall']);
    expect(impulses[1]).toMatchObject({ kind: KICK.spiral, tier: 'witness', tint: NAV_TINTS.manifesto });
    expect(bus).toHaveLength(0);
  });

  it('accretion_release_is_not_an_act', async () => {
    boot('manifesto');
    notifyAccretion('release');
    expect(impulses.map((i) => i.piece)).toEqual(['accretion.release']);   // synchronous, no queue
    expect(impulses[0].kind).not.toBe(0);                                    // 0 would detonate
    expect(JSON.parse(localStorage.getItem('observer_trail_v1') || '{}').touched?.['accretion.release']).toBeUndefined();
  });

  it('surveillance_reaches_the_eye_but_never_storage', () => {
    boot('surveillance');
    const before = localStorage.getItem('observer_trail_v1');
    notifySurveillance('lock');
    notifySurveillance('trace', { heads: [[1, 0]], dwellMs: 0, hopMs: 700, cues: [], durationMs: 700 });
    notifySurveillance('trace');                                     // no route: nothing
    notifySurveillance('release');
    expect(impulses.map((i) => i.piece)).toEqual(['surveillance.lock', 'surveillance.trace', 'surveillance.release']);
    expect(impulses[0]).toMatchObject({ kind: KICK.stare, tint: NAV_TINTS.surveillance });
    expect(impulses[1].data.heads).toEqual([[1, 0]]);
    expect(localStorage.getItem('observer_trail_v1')).toBe(before);
  });

  it('crypto_keygen_and_release_go_straight_to_the_eye', () => {
    boot('cryptography');
    const before = localStorage.getItem('observer_trail_v1');
    notifyCrypto('keygen');
    notifyCrypto('release');
    expect(impulses.map((i) => i.piece)).toEqual(['crypto.keygen', 'crypto.release']);
    expect(localStorage.getItem('observer_trail_v1')).toBe(before);
  });

  it('ledger_eye_wakes_when_the_kernel_rules_with_the_audit_severity', async () => {
    boot('ledger');
    emit('transmissions', 'ledger_appended', { depth: 1 });       // telemetry only now
    emit('transmissions', 'verdict_issued', { verdict: 'X' });
    await flush();
    expect(impulses).toHaveLength(0);
    notifyLedger('audit', 0.9);                                     // the kernel ruled on the submit
    await flush();
    expect(impulses.map((i) => i.piece)).toEqual(['ledger.write']);
    expect(impulses[0].data).toEqual({ severity: 0.9 });
    expect(JSON.parse(sessionStorage.getItem('observer_trail_v1')).touched['ledger.write']).toBe(true);   // the act
    const before = sessionStorage.getItem('observer_trail_v1');
    notifyLedger('clear', 0.9);
    notifyLedger('release');
    notifyLedger('bogus');
    expect(impulses.slice(1).map((i) => [i.piece, i.data])).toEqual([['ledger.clear', { severity: 0.9 }], ['ledger.release', null]]);
    expect(sessionStorage.getItem('observer_trail_v1')).toBe(before);
    notifyLedger('audit', 7);                                       // clamped
    await flush();
    expect(impulses.at(-1).data).toEqual({ severity: 1 });
  });

  it('no_forward_whisper_while_the_audit_murk_is_up', async () => {
    for (const sev of [0.05, 0.96]) {
      _resetObserverForTests({ now: () => t, random: () => 0 });
      localStorage.clear(); sessionStorage.clear();
      boot(QUIET_TAB);
      notifyLedger('audit', sev);
      await flush();
      await step(ledgerSettleMs(sev) + AFTER_REACTION_MS - 1);
      expect(getObserver().whisper).toBeNull();
      await step(1);
      expect(getObserver().whisper).not.toBeNull();
    }
    expect(ledgerSettleMs(0.96)).toBeGreaterThan(ledgerSettleMs(0.05));
  });

  it('key_generated_seals_the_held_lattice', async () => {
    boot('cryptography');
    emit('ciphers', 'key_generated', { scheme: 'ML-KEM-768' });
    await flush();
    expect(impulses.at(-1)).toMatchObject({ piece: 'crypto.seal', data: { keyed: true } });
    emit('ciphers', 'cipher_sealed', { filename: 'x' });
    await flush();
    expect(impulses.at(-1).data).toBeNull();
  });

  it('art_right_click_runs_the_full_cascade_only_by_hand', async () => {
    boot('art');
    emit('gaze', 'art_orthogonal', { nodeA: 'a', nodeB: 'b' });          // no hand: ignored
    await flush();
    expect(impulses).toHaveLength(0);
    emit('gaze', 'art_orthogonal', { nodeA: 'a', nodeB: 'b', hand: true });
    await flush();
    expect(impulses.at(-1).piece).toBe('chaos.fork');
  });

  it('scent_collision_carries_both_accord_colours', async () => {
    boot('essences');
    emit('essences', 'collision_fired', { colors: [[230, 80, 200], [40, 200, 120]] });
    await flush();
    expect(impulses.at(-1)).toMatchObject({ piece: 'scent.collide', tint: [230, 80, 200], tint2: [40, 200, 120] });
  });

  it('scent_collision_without_colours_keeps_the_tab_tint', async () => {
    boot('essences');
    emit('essences', 'collision_fired', { colors: [[999, 0, 0], 'x'] });
    await flush();
    expect(impulses.at(-1).tint2).toBeNull();
    expect(impulses.at(-1).tint).not.toEqual([999, 0, 0]);
  });

  it('whisper_waits_while_kernel_phrase_busy', async () => {
    boot(QUIET_TAB);
    emit('transmissions', 'kernel_loaded', {});
    await flush();
    await step(SETTLE);
    expect(getObserver().whisper).toBeNull();
    await step(PHRASE_BUSY_MS - SETTLE - 1);
    expect(getObserver().whisper).toBeNull();
    await step(1);
    expect(getObserver().whisper).toMatchObject({ piece: 'mercury.flick' });
  });

  it('riddles_have_no_ui_verbs', () => {
    for (const piece of Object.keys(PIECE_TAB)) expect(RIDDLES[piece]?.length).toBeGreaterThanOrEqual(2);
    for (const lines of Object.values(RIDDLES)) {
      for (const line of lines) {
        expect(line).not.toMatch(/\b(click|press|tap|go to|scroll)\b/i);
        expect(line).toBe(line.toLowerCase());
      }
    }
  });
});

// src/terminal/quintessence/__tests__/observerStore.test.js
// The agency reducer (spec §5.2): only a hand moves the eye; tiers never step on each other.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  startObserver, notifyNav, subscribeImpulse, getObserver, subscribeObserver,
  NAV_TINTS, FLASH_MS, WITNESS_MS, VERTEBRA_MS, CRESCENDO_MS, _resetObserverForTests,
} from '../observerStore';
import { PIECE_TAB, TAB_PIECES } from '../whispers';
import { setTrend, setCouncil, setPhase, setElement, _resetSpineForTests } from '../spineStore';
import { STORAGE_KEY } from '../sealedArtifact';
import { _resetVolatileForTests } from '../volatileHold';
import { emit, _resetForTests as _resetBusForTests } from '../../../observatory/observatoryBus';
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
  _resetBusForTests();
  _resetSpineForTests();
  _resetVolatileForTests();
  t = 1000;
  _resetObserverForTests({ now: () => t, random: () => 0 });
  impulses = [];
});
afterEach(() => {
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

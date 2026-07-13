import { describe, it, expect, beforeEach } from 'vitest';
import { emit, subscribe, getTotals, getJournal, _resetForTests } from '../observatoryBus';

describe('observatoryBus', () => {
  beforeEach(() => { _resetForTests(); });

  it('subscribers receive emitted events', () => {
    const received = [];
    const unsub = subscribe(evt => received.push(evt));
    emit('transmissions', 'kernel_completed', { kernelId: 'foo', durationMs: 100 });
    expect(received).toHaveLength(1);
    expect(received[0].category).toBe('transmissions');
    expect(received[0].kind).toBe('kernel_completed');
    expect(received[0].payload.kernelId).toBe('foo');
    expect(typeof received[0].ts).toBe('number');
    unsub();
  });

  it('unsubscribe stops further deliveries', () => {
    const received = [];
    const unsub = subscribe(evt => received.push(evt));
    unsub();
    emit('transmissions', 'kernel_completed', {});
    expect(received).toHaveLength(0);
  });

  it('totals.transmissions accumulates kernel_completed', () => {
    emit('transmissions', 'kernel_completed', { kernelId: 'a', durationMs: 10 });
    emit('transmissions', 'kernel_completed', { kernelId: 'b', durationMs: 20 });
    expect(getTotals().transmissions.count).toBe(2);
    expect(getTotals().transmissions.last.payload.kernelId).toBe('b');
  });

  it('totals.transmissions.ledgerDepth tracks ledger_appended payload depth', () => {
    emit('transmissions', 'ledger_appended', { depth: 5 });
    emit('transmissions', 'ledger_appended', { depth: 6 });
    expect(getTotals().transmissions.ledgerDepth).toBe(6);
  });

  it('totals.essences tracks collisions, polarity, crystallized separately', () => {
    emit('essences', 'collision_fired', { polarity: 'LUNAR', noteCount: 4 });
    emit('essences', 'collision_fired', { polarity: 'SOLAR', noteCount: 3 });
    emit('essences', 'crystallized',    { });
    emit('essences', 'polarity_shifted',{ polarity: 'CHAOTIC' });
    const t = getTotals().essences;
    expect(t.count).toBe(2);
    expect(t.crystallized).toBe(1);
    expect(t.polarity).toBe('CHAOTIC');
  });

  it('totals.ciphers tracks sealed / verifies / unlocks', () => {
    emit('ciphers', 'cipher_sealed', {});
    emit('ciphers', 'cipher_sealed', {});
    emit('ciphers', 'verify', {});
    emit('ciphers', 'unlock', {});
    const t = getTotals().ciphers;
    expect(t.sealed).toBe(2);
    expect(t.verifies).toBe(1);
    expect(t.unlocks).toBe(1);
  });

  it('totals.gaze tracks sphereClicks and last events', () => {
    emit('gaze', 'sphere_clicked', { sphere: 'TFG' });
    emit('gaze', 'lunar_read', { phase: 'waxing crescent', illum: 0.23 });
    expect(getTotals().gaze.sphereClicks).toBe(1);
    expect(getTotals().gaze.lastLunar.phase).toBe('waxing crescent');
  });

  it('totals.gaze.tabsVisited starts empty', () => {
    expect(getTotals().gaze.tabsVisited).toEqual({});
  });

  it('totals.gaze.tabsVisited records distinct visited tabs with counts', () => {
    emit('gaze', 'tab_navigated', { tab: 'ecocide' });
    emit('gaze', 'tab_navigated', { tab: 'ecocide' });
    emit('gaze', 'tab_navigated', { tab: 'privacy' });
    expect(getTotals().gaze.tabsVisited).toEqual({ ecocide: 2, privacy: 1 });
  });

  it('totals.gaze.tabsVisited ignores tab_navigated without a tab payload', () => {
    emit('gaze', 'tab_navigated', {});
    expect(getTotals().gaze.tabsVisited).toEqual({});
  });

  it('totals.edge tracks gate, eye, manifesto chapter', () => {
    emit('edge', 'gate_answered', { result: 'BLESSED' });
    emit('edge', 'eye_phase', { phase: 'engaged-here' });
    emit('edge', 'manifesto_opened', { chapter: 7 });
    const t = getTotals().edge;
    expect(t.gate).toBe('BLESSED');
    expect(t.eye).toBe('engaged-here');
    expect(t.manifestoChapter).toBe(7);
  });

  it('journal caps at 256 entries', () => {
    for (let i = 0; i < 300; i++) emit('transmissions', 'kernel_completed', { i });
    const journal = getJournal();
    expect(journal.length).toBe(256);
    expect(journal[0].payload.i).toBe(44);
    expect(journal[255].payload.i).toBe(299);
  });

  it('a throwing subscriber does not prevent other subscribers from receiving', () => {
    const received = [];
    subscribe(() => { throw new Error('boom'); });
    subscribe(evt => received.push(evt));
    emit('transmissions', 'kernel_completed', {});
    expect(received).toHaveLength(1);
  });

  it('emit on unknown category is a no-op for totals but still goes to subscribers and journal', () => {
    const received = [];
    subscribe(evt => received.push(evt));
    emit('phantom', 'something', { x: 1 });
    expect(received).toHaveLength(1);
    expect(getJournal()).toHaveLength(1);
  });

  it('gaze.art accumulates resonance, bifurcation deltas, chimera', () => {
    expect(getTotals().gaze.art).toBeNull();
    emit('gaze', 'art_resonance', { sim: 0.83 });
    emit('gaze', 'art_bifurcation', { count: 3 });
    emit('gaze', 'art_bifurcation', { count: 1 });
    emit('gaze', 'art_chimera', {});
    expect(getTotals().gaze.art).toEqual({
      resonances: 1, lastSim: 0.83, bifurcations: 4, chimeras: 1,
      lastR: null, lyapunov: null, regime: null, selectedNode: null, resonancePair: null,
    });
  });

  it('art events lazily initialize gaze.art in any order', () => {
    emit('gaze', 'art_chimera', {});
    expect(getTotals().gaze.art).toEqual({
      resonances: 0, lastSim: null, bifurcations: 0, chimeras: 1,
      lastR: null, lyapunov: null, regime: null, selectedNode: null, resonancePair: null,
    });
  });

  it('art_resonance without a numeric sim keeps the prior lastSim', () => {
    emit('gaze', 'art_resonance', { sim: 0.5 });
    emit('gaze', 'art_resonance', {});
    expect(getTotals().gaze.art.resonances).toBe(2);
    expect(getTotals().gaze.art.lastSim).toBe(0.5);
  });

  it('gaze.lastEcocide stores the latest phase payload', () => {
    expect(getTotals().gaze.lastEcocide).toBeNull();
    emit('gaze', 'ecocide_phase', { phase: 'OVERSHOOT', metabolicRift: 0.41, exergyRate: 0.2 });
    emit('gaze', 'ecocide_phase', { phase: 'COLLAPSE', metabolicRift: 0.72, exergyRate: 0.1 });
    expect(getTotals().gaze.lastEcocide.phase).toBe('COLLAPSE');
    expect(getTotals().gaze.lastEcocide.metabolicRift).toBe(0.72);
  });

  it('transmissions.verdict stores the latest cascade ruling', () => {
    expect(getTotals().transmissions.verdict).toBeNull();
    emit('transmissions', 'verdict_issued', { verdict: 'REJECTED' });
    expect(getTotals().transmissions.verdict).toBe('REJECTED');
  });
});

import { renderHook, act } from '@testing-library/react';
import { useObservatoryState } from '../useObservatoryState';

describe('useObservatoryState', () => {
  beforeEach(() => { _resetForTests(); });

  it('returns totals + journal and re-renders on emit', () => {
    const { result } = renderHook(() => useObservatoryState());
    expect(result.current.totals.transmissions.count).toBe(0);

    act(() => emit('transmissions', 'kernel_completed', { kernelId: 'x' }));
    expect(result.current.totals.transmissions.count).toBe(1);
    expect(result.current.journal[0].kind).toBe('kernel_completed');
  });
});

// mercuryEyeIndicator.test.jsx — the masthead eye wired to observerStore (spec §5.7–§5.9).
// ObserverEye is a forwardRef stub that records props and kick/detonate calls;
// observerStore is a controllable fake so impulses and snapshots are driven by hand.
import React, { forwardRef, useImperativeHandle } from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

const eye = vi.hoisted(() => ({ kicks: [], detonations: 0, props: null }));
vi.mock('../ObserverEye', () => ({
  default: forwardRef(function ObserverEyeStub(props, ref) {
    eye.props = props;
    useImperativeHandle(ref, () => ({
      kick: (k) => eye.kicks.push(k),
      detonate: () => { eye.detonations++; },
    }));
    return <div data-eye-stub="" />;
  }),
}));

const bus = vi.hoisted(() => ({ emits: [] }));
vi.mock('../../../observatory/observatoryBus', () => ({
  emit: (category, kind, payload) => bus.emits.push({ category, kind, payload }),
  subscribe: () => () => {},
}));

const store = vi.hoisted(() => {
  const s = {
    snap: null,
    listeners: new Set(),
    impulses: new Set(),
    base() {
      return { flash: null, glance: null, whisper: null, igniting: false, sealed: false, remarkedSinceSeal: false, wantsChrome: false };
    },
    set(over) {
      s.snap = { ...s.snap, ...over };
      s.listeners.forEach(fn => fn(s.snap));
    },
    impulse(imp) { s.impulses.forEach(fn => fn(imp)); },
  };
  s.snap = s.base();
  return s;
});
vi.mock('../../quintessence/observerStore', () => ({
  CRESCENDO_MS: 5600,
  getObserver: () => store.snap,
  subscribeObserver: (fn) => { store.listeners.add(fn); return () => store.listeners.delete(fn); },
  subscribeImpulse: (fn) => { store.impulses.add(fn); return () => store.impulses.delete(fn); },
}));

import MercuryEyeIndicator from '../MercuryEyeIndicator';

const AMBER = 'rgba(232, 210, 138, 0.65)';
const phases = () => bus.emits.filter(e => e.kind === 'eye_phase').map(e => e.payload.phase);
const flushEmits = () => act(() => { vi.advanceTimersByTime(0); });

beforeEach(() => {
  vi.useFakeTimers();
  eye.kicks = []; eye.detonations = 0; eye.props = null;
  bus.emits = [];
  store.snap = store.base();
  store.listeners.clear(); store.impulses.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const mount = (props = {}) => render(
  <MercuryEyeIndicator activeTab="kernel" onNavigate={() => {}} lastKernelAt={null} lastLoadAt={null} mobileChrome {...props} />,
);

describe('MercuryEyeIndicator — observerStore wiring', () => {
  it('impulse_calls_kick_with_kind_tint_duration', () => {
    mount();
    act(() => store.impulse({ piece: 'scent.collide', kind: 3, tier: 'witness', tint: [217, 70, 239], dir: 1, durationMs: 1100, at: 0 }));
    expect(eye.kicks).toHaveLength(1);
    expect(eye.kicks[0]).toMatchObject({ kind: 3, tint: [217, 70, 239], dir: 1, durationMs: 1100 });
    expect(eye.detonations).toBe(0);
    act(() => store.impulse({ piece: 'kernel.run', kind: 2, tier: 'witness', tint: [167, 139, 250], tint2: [122, 184, 0], dir: 1, durationMs: 1100, at: 0 }));
    expect(eye.kicks[1]).toMatchObject({ tint: [167, 139, 250], tint2: [122, 184, 0] });
  });

  it('crescendo_impulse_calls_detonate', () => {
    mount();
    act(() => store.impulse({ piece: 'altar.seal', kind: 0, tier: 'crescendo', tint: null, dir: 1, durationMs: 5600, at: 0 }));
    expect(eye.detonations).toBe(1);
    expect(eye.kicks).toHaveLength(0);
  });

  it('passes the resolved eye state to ObserverEye', () => {
    mount();
    expect(eye.props.state).toBe('resting');
    act(() => store.set({ flash: { tab: 'scaling', tint: [217, 70, 239] } }));
    expect(eye.props.state).toBe('leaning');
    expect(eye.props.tint).toEqual([217, 70, 239]);
    act(() => store.set({ flash: null, sealed: true }));
    expect(eye.props.thread).toBe(1);
    expect(eye.props.baseState).toBe('resting');
    expect(typeof eye.props.getLean).toBe('function');
    expect(eye.props.getLean()).toBe(1);          // no glance: nothing to ease
  });

  it('whisper_renders_in_phrase_slot_with_riddle_colour', () => {
    mount();
    act(() => store.set({ whisper: { id: 'sol.release:0', text: 'the sun waits to be let go', piece: 'sol.release' } }));
    expect(document.body.textContent).toContain('the sun waits to be let go');
    const span = [...document.body.querySelectorAll('span')].find(s => s.textContent === 'the sun waits to be let go');
    expect(span.style.color).not.toBe('');
    expect(span.style.color).not.toBe(AMBER);
    expect(span.style.color).toBe('rgba(200, 196, 232, 0.75)');
  });

  it('a kernel phrase preempts a showing whisper (the visitor\'s own act wins)', () => {
    const { rerender } = mount();
    act(() => store.set({ whisper: { id: 'w:0', text: 'a riddle in silver', piece: 'scent.collide' } }));
    expect(document.body.textContent).toContain('a riddle in silver');
    rerender(<MercuryEyeIndicator activeTab="kernel" onNavigate={() => {}} lastKernelAt={1234} lastLoadAt={null} mobileChrome />);
    expect(document.body.textContent).not.toContain('a riddle in silver');
    const amber = [...document.body.querySelectorAll('span')].find(s => s.style.color === AMBER);
    expect(amber).toBeDefined();
  });

  it('no_setInterval_seal_poll', () => {
    const spy = vi.spyOn(globalThis, 'setInterval');
    mount();
    expect(spy).not.toHaveBeenCalled();
  });

  it('eye_phase_emits_crescendo_then_sealed', () => {
    mount();
    flushEmits();
    expect(phases()).toEqual(['silver']);
    act(() => store.set({ igniting: true }));
    flushEmits();
    act(() => {
      store.set({ igniting: false, sealed: true });
      store.impulse({ piece: 'altar.seal', kind: 0, tier: 'crescendo', tint: null, dir: 1, durationMs: 5600, at: 0 });
    });
    flushEmits();
    expect(phases()).toEqual(['silver', 'charging', 'crescendo']);
    act(() => { vi.advanceTimersByTime(5599); });
    expect(phases()).toEqual(['silver', 'charging', 'crescendo']);
    act(() => { vi.advanceTimersByTime(1); });
    flushEmits();
    expect(phases()).toEqual(['silver', 'charging', 'crescendo', 'sealed']);
  });

  it('never emits eye_whisper itself (the store does, once per whisper)', () => {
    mount();
    act(() => store.set({ whisper: { id: 'sol.release:1', text: 'x', piece: 'sol.release' } }));
    act(() => store.set({ glance: { tab: 'sol', tint: [254, 249, 195], shimmer: false, reason: 'whisper', startedAt: 0 } }));
    flushEmits();
    const w = bus.emits.filter(e => e.kind === 'eye_whisper');
    expect(w).toEqual([]);
  });
});

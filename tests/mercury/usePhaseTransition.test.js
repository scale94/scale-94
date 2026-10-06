import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import usePhaseTransition, { PHASES } from '../../src/terminal/mercury/usePhaseTransition';
import { FADE_OUT_MS, NEUTRAL_MS, SPIN_UP_MS } from '../../src/terminal/mercury/transitionMachine';

let rafCallbacks = [];
let nowMs = 0;
beforeEach(() => {
  rafCallbacks = [];
  nowMs = 1000;
  vi.stubGlobal('requestAnimationFrame', (cb) => { rafCallbacks.push(cb); return rafCallbacks.length; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn(() => {}));
  vi.stubGlobal('performance', { now: () => nowMs });
});
afterEach(() => { vi.unstubAllGlobals(); });
function flush(ms) { nowMs += ms; const cbs = rafCallbacks.splice(0); cbs.forEach((cb) => cb(nowMs)); }

describe('usePhaseTransition — neutral boot', () => {
  it('boots into neutral: no active phase, all fades 0, holding liquid', () => {
    const { result } = renderHook(() => usePhaseTransition());
    expect(result.current.activePhase).toBe(null);
    expect(result.current.transitionState).toBe('idle');
    expect(result.current.holdLiquid).toBe(true);
    for (const p of PHASES) expect(result.current.fades[p]).toBe(0);
    expect(rafCallbacks.length).toBe(0); // no animation at rest
  });
});

describe('usePhaseTransition — driving the machine', () => {
  it('a tap spins the element up over SPIN_UP_MS and the rAF stops at rest', () => {
    const { result } = renderHook(() => usePhaseTransition());
    act(() => { result.current.triggerTransition('earth'); });
    expect(result.current.activePhase).toBe('earth');
    expect(result.current.transitionState).toBe('spinUp');
    expect(result.current.holdLiquid).toBe(false);
    act(() => { flush(SPIN_UP_MS / 2); });
    expect(result.current.fades.earth).toBeCloseTo(0.75, 6);
    act(() => { flush(SPIN_UP_MS / 2); });
    expect(result.current.transitionState).toBe('idle');
    expect(result.current.fades.earth).toBe(1);
    expect(rafCallbacks.length).toBe(0);
  });
  it('tapping the lit element returns to neutral', () => {
    const { result } = renderHook(() => usePhaseTransition());
    act(() => { result.current.triggerTransition('air'); flush(SPIN_UP_MS); });
    act(() => { result.current.triggerTransition('air'); });
    expect(result.current.activePhase).toBe(null);
    expect(result.current.transitionState).toBe('fadeOut');
    act(() => { flush(FADE_OUT_MS); });
    expect(result.current.transitionState).toBe('idle');
    expect(result.current.holdLiquid).toBe(true);
    expect(result.current.fades.air).toBe(0);
  });
  it('element → element passes through the neutral beat', () => {
    const { result } = renderHook(() => usePhaseTransition());
    act(() => { result.current.triggerTransition('fluid'); flush(SPIN_UP_MS); });
    act(() => { result.current.triggerTransition('thermal'); flush(FADE_OUT_MS + 10); });
    expect(result.current.transitionState).toBe('neutral');
    expect(result.current.holdLiquid).toBe(true);
    for (const p of PHASES) expect(result.current.fades[p]).toBe(0);
    act(() => { flush(NEUTRAL_MS + SPIN_UP_MS); });
    expect(result.current.activePhase).toBe('thermal');
    expect(result.current.fades.thermal).toBe(1);
  });
  it('a hidden tab (one huge frame gap) lands on the steady target in one frame', () => {
    const { result } = renderHook(() => usePhaseTransition());
    act(() => { result.current.triggerTransition('fluid'); flush(SPIN_UP_MS); });
    act(() => { result.current.triggerTransition('earth'); flush(50); });
    act(() => { flush(60_000); });
    expect(result.current.transitionState).toBe('idle');
    expect(result.current.activePhase).toBe('earth');
    expect(result.current.fades).toEqual({ fluid: 0, thermal: 0, earth: 1, air: 0 });
  });
  it('the first frame after a tap measures from the tap, not from the last transition', () => {
    const { result } = renderHook(() => usePhaseTransition());
    act(() => { result.current.triggerTransition('fluid'); flush(SPIN_UP_MS); });
    nowMs += 10_000; // long idle
    act(() => { result.current.triggerTransition('fluid'); flush(FADE_OUT_MS / 2); });
    expect(result.current.transitionState).toBe('fadeOut');
    expect(result.current.fades.fluid).toBeCloseTo(0.75, 6);
  });
  it('cancels its rAF on unmount', () => {
    const { result, unmount } = renderHook(() => usePhaseTransition());
    act(() => { result.current.triggerTransition('fluid'); });
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import usePhaseTransition, { PHASES } from '../../src/terminal/mercury/usePhaseTransition';

let rafCallbacks = [];
let nowMs = 0;

beforeEach(() => {
  rafCallbacks = [];
  nowMs = 0;
  vi.stubGlobal('requestAnimationFrame', (cb) => { rafCallbacks.push(cb); return rafCallbacks.length; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn(() => {}));
  vi.stubGlobal('performance', { now: () => nowMs });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function flushFrames(advanceMs) {
  nowMs += advanceMs;
  const cbs = rafCallbacks.splice(0);
  cbs.forEach(cb => cb(nowMs));
}

describe('usePhaseTransition — idle state', () => {
  it('starts with fluid active and all opacities set', () => {
    const { result } = renderHook(() => usePhaseTransition('fluid'));
    expect(result.current.activePhase).toBe('fluid');
    expect(result.current.transitionState).toBe('idle');
    expect(result.current.phaseOpacities.fluid).toBe(1.0);
    expect(result.current.phaseOpacities.thermal).toBe(0.12);
    expect(result.current.phaseOpacities.earth).toBe(0.12);
    expect(result.current.phaseOpacities.air).toBe(0.12);
  });

  it('respects custom initialPhase', () => {
    const { result } = renderHook(() => usePhaseTransition('thermal'));
    expect(result.current.activePhase).toBe('thermal');
    expect(result.current.phaseOpacities.thermal).toBe(1.0);
    expect(result.current.phaseOpacities.fluid).toBe(0.12);
  });
});

describe('usePhaseTransition — triggerTransition', () => {
  it('enters consolidating beat after trigger', () => {
    const { result } = renderHook(() => usePhaseTransition('fluid'));
    act(() => { result.current.triggerTransition('thermal'); });
    expect(result.current.transitionState).toBe('consolidating');
    expect(result.current.pendingPhase).toBe('thermal');
  });

  it('ignores trigger to same phase', () => {
    const { result } = renderHook(() => usePhaseTransition('fluid'));
    act(() => { result.current.triggerTransition('fluid'); });
    expect(result.current.transitionState).toBe('idle');
  });

  it('dims ghost opacities during consolidation', () => {
    const { result } = renderHook(() => usePhaseTransition('fluid'));
    act(() => {
      result.current.triggerTransition('thermal');
      flushFrames(100);
    });
    expect(result.current.phaseOpacities.thermal).toBeLessThan(0.12);
    expect(result.current.phaseOpacities.thermal).toBeGreaterThan(0.04);
  });

  it('completes full transition and sets new activePhase', () => {
    const { result } = renderHook(() => usePhaseTransition('fluid'));
    act(() => {
      result.current.triggerTransition('thermal');
      flushFrames(201);
      flushFrames(201);
      flushFrames(251);
      flushFrames(151);
    });
    expect(result.current.activePhase).toBe('thermal');
    expect(result.current.transitionState).toBe('idle');
    expect(result.current.phaseOpacities.thermal).toBe(1.0);
    expect(result.current.phaseOpacities.fluid).toBe(0.12);
  });

  it('sphere reaches chrome peak during consolidation', () => {
    const { result } = renderHook(() => usePhaseTransition('fluid'));
    act(() => {
      result.current.triggerTransition('earth');
      flushFrames(200);
    });
    expect(result.current.sphereState.chromePhase).toBeGreaterThan(0.9);
    expect(result.current.sphereState.nodeChrome).toBeGreaterThan(0.9);
  });
});

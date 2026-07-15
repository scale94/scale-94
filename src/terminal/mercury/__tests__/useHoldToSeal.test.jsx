// src/terminal/mercury/__tests__/useHoldToSeal.test.jsx — the ritual gesture (spec §6).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useHoldToSeal, HOLD_MS } from '../useHoldToSeal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container, root, api, completed;

function Probe() {
  api = useHoldToSeal(id => completed.push(id));
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  completed = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<Probe />); });
});
afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  vi.useRealTimers();
});

describe('useHoldToSeal', () => {
  it('completes after HOLD_MS and reports the held id', () => {
    act(() => { api.start('FIRE'); });
    expect(api.holding).toBe('FIRE');
    act(() => { vi.advanceTimersByTime(HOLD_MS); });
    expect(completed).toEqual(['FIRE']);
    expect(api.holding).toBeNull();
  });

  it('release before completion cancels cleanly — nothing fires', () => {
    act(() => { api.start('WATER'); });
    act(() => { vi.advanceTimersByTime(HOLD_MS - 100); });
    act(() => { api.cancel(); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(completed).toEqual([]);
    expect(api.progress).toBe(0);
  });

  it('progress climbs monotonically toward 1 during the hold', () => {
    act(() => { api.start('AIR'); });
    act(() => { vi.advanceTimersByTime(600); });
    expect(api.progress).toBeGreaterThan(0.4);
    expect(api.progress).toBeLessThan(0.6);
  });

  it('consumedClick returns true exactly once after a completed hold (click suppression)', () => {
    act(() => { api.start('EARTH'); });
    act(() => { vi.advanceTimersByTime(HOLD_MS); });
    expect(api.consumedClick()).toBe(true);
    expect(api.consumedClick()).toBe(false);
  });
});

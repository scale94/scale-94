import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useCalm, { CALM_QUERY } from '../useCalm';

function mockMatchMedia(initial) {
  const listeners = new Set();
  const mq = {
    matches: initial,
    media: CALM_QUERY,
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
  };
  window.matchMedia = vi.fn(() => mq);
  return { mq, listeners, set(v) { mq.matches = v; listeners.forEach((fn) => fn({ matches: v })); } };
}

describe('useCalm', () => {
  const realMM = window.matchMedia;
  afterEach(() => { window.matchMedia = realMM; window.history.replaceState(null, '', '/'); });

  it('reads prefers-reduced-motion and follows an OS toggle live', () => {
    const m = mockMatchMedia(false);
    const { result, unmount } = renderHook(() => useCalm());
    expect(result.current).toBe(false);
    act(() => m.set(true));
    expect(result.current).toBe(true);
    unmount();
    expect(m.listeners.size).toBe(0);
  });

  it('?calm=1 forces it on (probes)', () => {
    mockMatchMedia(false);
    window.history.replaceState(null, '', '/?calm=1');
    const { result } = renderHook(() => useCalm());
    expect(result.current).toBe(true);
  });

  it('no matchMedia: off, no crash', () => {
    window.matchMedia = undefined;
    const { result } = renderHook(() => useCalm());
    expect(result.current).toBe(false);
  });
});

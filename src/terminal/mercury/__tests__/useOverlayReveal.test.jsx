// src/terminal/mercury/__tests__/useOverlayReveal.test.jsx — hover on desktop, tap-reveal on touch.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useOverlayReveal, REVEAL_TAP_MS } from '../useOverlayReveal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container, root, api, calls;

function Probe() {
  api = useOverlayReveal((v) => calls.push(v));
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Probe />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('useOverlayReveal', () => {
  it('mouse: enter shows, leave hides', () => {
    act(() => api.onPointerEnter({ pointerType: 'mouse' }));
    act(() => api.onPointerLeave({ pointerType: 'mouse' }));
    expect(calls).toEqual([true, false]);
  });

  it('touch: enter/leave are ignored; a tap shows for REVEAL_TAP_MS', () => {
    act(() => api.onPointerEnter({ pointerType: 'touch' }));
    act(() => api.onPointerUp({ pointerType: 'touch' }));
    expect(calls).toEqual([true]);
    act(() => vi.advanceTimersByTime(REVEAL_TAP_MS - 1));
    expect(calls).toEqual([true]);
    act(() => vi.advanceTimersByTime(1));
    expect(calls).toEqual([true, false]);
    act(() => api.onPointerLeave({ pointerType: 'touch' }));
    expect(calls).toEqual([true, false]);
  });

  it('a second tap restarts the 4 s', () => {
    act(() => api.onPointerUp({ pointerType: 'touch' }));
    act(() => vi.advanceTimersByTime(3000));
    act(() => api.onPointerUp({ pointerType: 'pen' }));
    act(() => vi.advanceTimersByTime(3000));
    expect(calls).toEqual([true, true]);
    act(() => vi.advanceTimersByTime(1000));
    expect(calls).toEqual([true, true, false]);
  });

  it('mouse pointerup does nothing', () => {
    act(() => api.onPointerUp({ pointerType: 'mouse' }));
    expect(calls).toEqual([]);
  });

  it('unmounting while shown hides', () => {
    act(() => api.onPointerUp({ pointerType: 'touch' }));
    act(() => root.unmount());
    root = createRoot(container); // afterEach unmounts again
    expect(calls).toEqual([true, false]);
  });
});

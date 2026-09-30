import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useMercuryDrag from '../useMercuryDrag';

const ev = (type, props) => Object.assign(new Event(type), { button: 0, pointerId: 1, ...props });

describe('useMercuryDrag', () => {
  let mockNow = 0;

  beforeEach(() => {
    vi.spyOn(performance, 'now').mockImplementation(() => mockNow);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('wires pointer events on the element into the tracker and cleans up', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'clientHeight', { value: 800 });
    el.setPointerCapture = vi.fn();
    el.releasePointerCapture = vi.fn();
    const { result, unmount } = renderHook(() => useMercuryDrag(el));
    expect(el.style.cursor).toBe('grab');
    mockNow = 0;
    el.dispatchEvent(ev('pointerdown', { clientX: 0, clientY: 0 }));
    expect(el.style.cursor).toBe('grabbing');
    expect(el.setPointerCapture).toHaveBeenCalledWith(1);
    expect(result.current.sample(mockNow).dragging).toBe(true);
    el.dispatchEvent(ev('pointerup', {}));
    expect(result.current.sample(mockNow).dragging).toBe(false);
    unmount();
    el.dispatchEvent(ev('pointerdown', { clientX: 0, clientY: 0 }));
    expect(result.current.sample(mockNow).dragging).toBe(false);
  });

  it('ignores secondary buttons', () => {
    const el = document.createElement('div');
    el.setPointerCapture = vi.fn();
    const { result } = renderHook(() => useMercuryDrag(el));
    el.dispatchEvent(ev('pointerdown', { button: 2, clientX: 0, clientY: 0 }));
    expect(result.current.sample(mockNow).dragging).toBe(false);
  });

  it('a second pointer (pointerId 2) moving and lifting does not change or end pointer 1\'s drag', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'clientHeight', { value: 800 });
    el.setPointerCapture = vi.fn();
    const { result } = renderHook(() => useMercuryDrag(el));
    mockNow = 0;
    el.dispatchEvent(ev('pointerdown', { clientX: 100, clientY: 100, pointerId: 1 }));
    expect(result.current.sample(mockNow).dragging).toBe(true);
    mockNow = 100;
    el.dispatchEvent(ev('pointermove', { clientX: 180, clientY: 100, pointerId: 2 }));
    expect(result.current.sample(mockNow).dragging).toBe(true);
    el.dispatchEvent(ev('pointerup', { pointerId: 2 }));
    expect(result.current.sample(mockNow).dragging).toBe(true);
  });

  it('pointercancel ends the drag', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'clientHeight', { value: 800 });
    el.setPointerCapture = vi.fn();
    const { result } = renderHook(() => useMercuryDrag(el));
    mockNow = 0;
    el.dispatchEvent(ev('pointerdown', { clientX: 0, clientY: 0 }));
    expect(result.current.sample(mockNow).dragging).toBe(true);
    el.dispatchEvent(ev('pointercancel', {}));
    expect(result.current.sample(mockNow).dragging).toBe(false);
  });

  it('lostpointercapture ends the drag', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'clientHeight', { value: 800 });
    el.setPointerCapture = vi.fn();
    const { result } = renderHook(() => useMercuryDrag(el));
    mockNow = 0;
    el.dispatchEvent(ev('pointerdown', { clientX: 0, clientY: 0 }));
    expect(result.current.sample(mockNow).dragging).toBe(true);
    el.dispatchEvent(ev('lostpointercapture', { pointerId: 1 }));
    expect(result.current.sample(mockNow).dragging).toBe(false);
  });

  it('a pointermove through the hook produces a non-zero omegaPtr using el.clientHeight', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'clientHeight', { value: 800 });
    el.setPointerCapture = vi.fn();
    const { result } = renderHook(() => useMercuryDrag(el));
    mockNow = 0;
    el.dispatchEvent(ev('pointerdown', { clientX: 100, clientY: 100 }));
    mockNow = 100;
    el.dispatchEvent(ev('pointermove', { clientX: 180, clientY: 100 }));
    const s = result.current.sample(mockNow);
    expect(s.dragging).toBe(true);
    expect(s.omegaPtr[1]).toBeGreaterThan(0);
  });
});

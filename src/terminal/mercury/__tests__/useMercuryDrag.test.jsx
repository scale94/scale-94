import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useMercuryDrag from '../useMercuryDrag';

// Pointer events carry their own DOMHighResTimeStamp; the hook reads e.timeStamp, so stamp it from mockNow.
const ev = (type, props) => {
  const e = Object.assign(new Event(type), { button: 0, pointerId: 1, ...props });
  Object.defineProperty(e, 'timeStamp', { value: mockNow });
  return e;
};

let mockNow = 0;

describe('useMercuryDrag', () => {

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
    expect(result.current.sample(mockNow).omegaPtr).toEqual([0, 0, 0]);
    el.dispatchEvent(ev('pointerup', { pointerId: 2 }));
    expect(result.current.sample(mockNow).dragging).toBe(true);
    mockNow = 200;
    el.dispatchEvent(ev('pointermove', { clientX: 260, clientY: 100, pointerId: 1 }));
    const s = result.current.sample(mockNow);
    expect(s.dragging).toBe(true);
    expect(s.omegaPtr[1]).toBeCloseTo((160 * 2.5) / 800 / 0.2, 9);
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
    expect(s.omegaPtr[1]).toBeCloseTo((80 * 2.5) / 800 / 0.1, 9);
  });

  it('pointermove does no layout reads: the rect and height are cached at pointerdown', () => {
    const el = document.createElement('div');
    const heightGet = vi.fn(() => 800);
    Object.defineProperty(el, 'clientHeight', { get: heightGet });
    const rectSpy = vi.spyOn(el, 'getBoundingClientRect');
    el.setPointerCapture = vi.fn();
    const { result } = renderHook(() => useMercuryDrag(el));
    mockNow = 0;
    el.dispatchEvent(ev('pointerdown', { clientX: 100, clientY: 100 }));
    const reads = rectSpy.mock.calls.length + heightGet.mock.calls.length;
    for (let i = 1; i <= 5; i++) {
      mockNow = 20 * i;
      el.dispatchEvent(ev('pointermove', { clientX: 100 + 16 * i, clientY: 100 }));
    }
    expect(rectSpy.mock.calls.length + heightGet.mock.calls.length).toBe(reads);
    expect(result.current.sample(mockNow).omegaPtr[1]).toBeGreaterThan(0);
  });

  it('pointerdown on a remounted element starts a new drag', () => {
    const el1 = document.createElement('div');
    Object.defineProperty(el1, 'clientHeight', { value: 800 });
    el1.setPointerCapture = vi.fn();
    el1.releasePointerCapture = vi.fn();
    let currentEl = el1;
    const { result, rerender } = renderHook(() => useMercuryDrag(currentEl));
    mockNow = 0;
    el1.dispatchEvent(ev('pointerdown', { clientX: 0, clientY: 0 }));
    expect(result.current.sample(mockNow).dragging).toBe(true);
    const el2 = document.createElement('div');
    Object.defineProperty(el2, 'clientHeight', { value: 800 });
    el2.setPointerCapture = vi.fn();
    el2.releasePointerCapture = vi.fn();
    currentEl = el2;
    rerender();
    expect(result.current.sample(mockNow).dragging).toBe(false);
    el2.dispatchEvent(ev('pointerdown', { clientX: 0, clientY: 0 }));
    expect(result.current.sample(mockNow).dragging).toBe(true);
  });

  it('a second pointerdown while dragging is ignored; up of second pointer does not end the drag', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'clientHeight', { value: 800 });
    el.setPointerCapture = vi.fn();
    const { result } = renderHook(() => useMercuryDrag(el));
    mockNow = 0;
    el.dispatchEvent(ev('pointerdown', { clientX: 0, clientY: 0, pointerId: 1 }));
    expect(result.current.sample(mockNow).dragging).toBe(true);
    el.dispatchEvent(ev('pointerdown', { clientX: 50, clientY: 50, pointerId: 2 }));
    el.dispatchEvent(ev('pointermove', { clientX: 60, clientY: 60, pointerId: 2 }));
    expect(result.current.sample(mockNow).dragging).toBe(true);
    expect(result.current.sample(mockNow).omegaPtr).toEqual([0, 0, 0]);
    el.dispatchEvent(ev('pointerup', { pointerId: 2 }));
    expect(result.current.sample(mockNow).dragging).toBe(true);
  });

  it('lostpointercapture with a foreign pointerId does not end the drag', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'clientHeight', { value: 800 });
    el.setPointerCapture = vi.fn();
    const { result } = renderHook(() => useMercuryDrag(el));
    mockNow = 0;
    el.dispatchEvent(ev('pointerdown', { clientX: 0, clientY: 0, pointerId: 1 }));
    expect(result.current.sample(mockNow).dragging).toBe(true);
    el.dispatchEvent(ev('lostpointercapture', { pointerId: 2 }));
    expect(result.current.sample(mockNow).dragging).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import useMercuryDrag from '../useMercuryDrag';

const ev = (type, props) => Object.assign(new Event(type), { button: 0, pointerId: 1, ...props });

describe('useMercuryDrag', () => {
  it('wires pointer events on the element into the tracker and cleans up', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'clientHeight', { value: 800 });
    const { result, unmount } = renderHook(() => useMercuryDrag(el));
    expect(el.style.cursor).toBe('grab');
    el.dispatchEvent(ev('pointerdown', { clientX: 0, clientY: 0 }));
    expect(el.style.cursor).toBe('grabbing');
    expect(result.current.sample(performance.now()).dragging).toBe(true);
    el.dispatchEvent(ev('pointerup', {}));
    expect(result.current.sample(performance.now()).dragging).toBe(false);
    unmount();
    el.dispatchEvent(ev('pointerdown', { clientX: 0, clientY: 0 }));
    expect(result.current.sample(performance.now()).dragging).toBe(false);
  });

  it('ignores secondary buttons', () => {
    const el = document.createElement('div');
    const { result } = renderHook(() => useMercuryDrag(el));
    el.dispatchEvent(ev('pointerdown', { button: 2, clientX: 0, clientY: 0 }));
    expect(result.current.sample(performance.now()).dragging).toBe(false);
  });
});

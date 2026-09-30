// Binds pointer events on the canvas to a drag tracker. The element handles
// (drei <Html>) live in a sibling overlay, so tapping a node never starts a drag.

import { useEffect, useMemo } from 'react';
import { createDragTracker } from './planet/mercuryDrag';

export default function useMercuryDrag(el) {
  const tracker = useMemo(() => createDragTracker(), []);

  useEffect(() => {
    if (!el) return undefined;
    el.style.cursor = 'grab';
    const onDown = (e) => {
      if (e.button !== 0 || e.isPrimary === false) return;
      el.setPointerCapture?.(e.pointerId);
      el.style.cursor = 'grabbing';
      tracker.down(e.clientX, e.clientY, performance.now());
    };
    const onMove = (e) => tracker.move(e.clientX, e.clientY, performance.now(), el.clientHeight);
    const onUp = (e) => {
      el.releasePointerCapture?.(e.pointerId);
      el.style.cursor = 'grab';
      tracker.up();
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.style.cursor = '';
      tracker.up();
    };
  }, [el, tracker]);

  return tracker;
}

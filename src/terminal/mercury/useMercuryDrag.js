// Binds pointer events on the canvas to a drag tracker. The element handles
// (drei <Html>) live in a sibling overlay, so tapping a node never starts a drag.

import { useEffect, useMemo, useRef } from 'react';
import { createDragTracker } from './planet/mercuryDrag';

export default function useMercuryDrag(el) {
  const tracker = useMemo(() => createDragTracker(), []);
  const activePointerIdRef = useRef(null);

  useEffect(() => {
    if (!el) return undefined;
    el.style.cursor = 'grab';
    const aim = (e) => {
      const r = el.getBoundingClientRect();
      tracker.aim(((e.clientX - r.left) / Math.max(r.width, 1)) * 2 - 1, 1 - ((e.clientY - r.top) / Math.max(r.height, 1)) * 2);
    };
    const onDown = (e) => {
      if (e.button !== 0 || e.isPrimary === false) return;
      if (activePointerIdRef.current !== null) return; // ignore second pointerdown
      activePointerIdRef.current = e.pointerId;
      el.setPointerCapture?.(e.pointerId);
      el.style.cursor = 'grabbing';
      tracker.down(e.clientX, e.clientY, e.timeStamp);
      aim(e);
    };
    const onMove = (e) => {
      if (e.pointerId !== activePointerIdRef.current) return;
      aim(e);
      tracker.move(e.clientX, e.clientY, e.timeStamp, el.clientHeight);
    };
    const endDrag = (e) => {
      if (e.pointerId !== activePointerIdRef.current) return;
      activePointerIdRef.current = null;
      el.releasePointerCapture?.(e.pointerId);
      el.style.cursor = 'grab';
      tracker.up();
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
    el.addEventListener('lostpointercapture', endDrag);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', endDrag);
      el.removeEventListener('pointercancel', endDrag);
      el.removeEventListener('lostpointercapture', endDrag);
      el.style.cursor = '';
      activePointerIdRef.current = null;
      tracker.up();
    };
  }, [el, tracker]);

  return tracker;
}

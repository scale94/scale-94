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
    // Layout is read once per drag, at pointerdown. A read per pointermove forces a
    // synchronous layout whenever anything dirtied the DOM since the last frame, and
    // Android delivers touch moves at 120 Hz+ (measured: the phone's input stalls).
    // The canvas does not move under a captured drag (touch-action: none).
    const box = { left: 0, top: 0, width: 1, height: 1, clientHeight: 1 };
    const measure = () => {
      const r = el.getBoundingClientRect();
      box.left = r.left; box.top = r.top; box.width = r.width; box.height = r.height;
      box.clientHeight = el.clientHeight;
    };
    const aim = (e) => {
      tracker.aim(((e.clientX - box.left) / Math.max(box.width, 1)) * 2 - 1, 1 - ((e.clientY - box.top) / Math.max(box.height, 1)) * 2);
    };
    const onDown = (e) => {
      if (e.button !== 0 || e.isPrimary === false) return;
      if (activePointerIdRef.current !== null) return; // ignore second pointerdown
      activePointerIdRef.current = e.pointerId;
      el.setPointerCapture?.(e.pointerId);
      el.style.cursor = 'grabbing';
      measure();
      tracker.down(e.clientX, e.clientY, e.timeStamp);
      aim(e);
    };
    const onMove = (e) => {
      if (e.pointerId !== activePointerIdRef.current) return;
      aim(e);
      tracker.move(e.clientX, e.clientY, e.timeStamp, box.clientHeight);
    };
    const endDrag = (e) => {
      if (e.pointerId !== activePointerIdRef.current) return;
      activePointerIdRef.current = null;
      el.releasePointerCapture?.(e.pointerId);
      el.style.cursor = 'grab';
      tracker.up(e.timeStamp);
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

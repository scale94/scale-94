// useOverlayReveal — THE SLOW NOON's link gesture: hover on a mouse, a 4 s reveal on a tap
// (touch / pen have no hover). Spec 2026-10-03 §2.

import { useEffect, useRef } from 'react';

export const REVEAL_TAP_MS = 4000;

const isTouch = (e) => e.pointerType === 'touch' || e.pointerType === 'pen';

export function useOverlayReveal(onOverlay) {
  const cb = useRef(onOverlay);
  const timer = useRef(null);
  const shown = useRef(false);
  useEffect(() => { cb.current = onOverlay; }, [onOverlay]);

  const set = (v) => { shown.current = v; cb.current(v); };
  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };

  // Unmounting while shown hides (aliases keep react-hooks from flagging ref reads in cleanup).
  useEffect(() => {
    const t = timer, s = shown, c = cb;
    return () => { if (t.current) clearTimeout(t.current); if (s.current) c.current(false); };
  }, []);

  return {
    onPointerEnter: (e) => { if (!isTouch(e)) set(true); },
    onPointerLeave: (e) => { if (!isTouch(e)) set(false); },
    onPointerUp: (e) => {
      if (!isTouch(e)) return;
      clear();
      set(true);
      timer.current = setTimeout(() => { timer.current = null; set(false); }, REVEAL_TAP_MS);
    },
  };
}

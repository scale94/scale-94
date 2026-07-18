// src/terminal/components/useSevenTaps.js — the Developer-Options gesture.
// The kernel-tab Mercury already navigates on click. This disambiguates the
// honest single tap (navigate, after a short settle) from the seven-tap burst
// (root the bypass). A burst of 2–6 that stops does nothing. The countdown
// walks the Black Hole caste ladder down to bare metal.
import { useCallback, useEffect, useRef, useState } from 'react';

export const WINDOW_MS = 3000;
export const SETTLE_MS = 280;
export const TAPS_TO_UNLOCK = 7;
export const COUNTDOWN_FROM = 3;

const COUNTDOWN_COPY = {
  4: '4 · the surface is thinning',
  3: '3 · past the theme layer',
  2: '2 · the god caste ends here',
  1: '1 · one tap from bare metal',
};
const BRIGHT_COPY = '☿ compiled fairytale castle on mercury';

export function useSevenTaps({ onSingleTap, onUnlock } = {}) {
  const tapsRef = useRef([]);
  const navTimerRef = useRef(null);
  const keyRef = useRef(0);
  const [toast, setToast] = useState(null);

  const emit = useCallback((text, bright) => {
    keyRef.current += 1;
    setToast({ key: keyRef.current, text, bright });
  }, []);

  const clearToast = useCallback(() => setToast(null), []);

  const onTap = useCallback(() => {
    const now = Date.now();
    const taps = tapsRef.current.filter((t) => now - t < WINDOW_MS);
    taps.push(now);
    tapsRef.current = taps;
    const n = taps.length;

    if (navTimerRef.current) { clearTimeout(navTimerRef.current); navTimerRef.current = null; }

    if (n >= TAPS_TO_UNLOCK) {
      tapsRef.current = [];
      emit(BRIGHT_COPY, true);
      onUnlock && onUnlock();
      return;
    }
    if (n >= COUNTDOWN_FROM) {
      const remaining = TAPS_TO_UNLOCK - n;
      emit(COUNTDOWN_COPY[remaining] || `${remaining} taps from bare metal`, false);
    }
    if (n === 1) {
      navTimerRef.current = setTimeout(() => {
        navTimerRef.current = null;
        onSingleTap && onSingleTap();
      }, SETTLE_MS);
    }
  }, [emit, onSingleTap, onUnlock]);

  useEffect(() => () => { if (navTimerRef.current) clearTimeout(navTimerRef.current); }, []);

  return { onTap, toast, clearToast };
}

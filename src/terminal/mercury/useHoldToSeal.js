// src/terminal/mercury/useHoldToSeal.js — press-and-hold ritual (spec §6).
// Interval-driven (50ms): rAF is suppressed in embedded preview panes, and a
// ritual that can't complete is a locked door. Uses Date-less relative ticks so
// fake timers drive it deterministically.
import { useCallback, useEffect, useRef, useState } from 'react';

export const HOLD_MS = 1200;
const TICK_MS = 50;

export function useHoldToSeal(onComplete) {
  const [holding, setHolding] = useState(null);
  const [progress, setProgress] = useState(0);
  const interval = useRef(0);
  const elapsed = useRef(0);
  const done = useRef(false);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const cancel = useCallback(() => {
    clearInterval(interval.current);
    elapsed.current = 0;
    setHolding(null);
    setProgress(0);
  }, []);

  const start = useCallback((id) => {
    clearInterval(interval.current);
    done.current = false;
    elapsed.current = 0;
    setHolding(id);
    setProgress(0);
    interval.current = setInterval(() => {
      elapsed.current += TICK_MS;
      const p = Math.min(1, elapsed.current / HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        clearInterval(interval.current);
        done.current = true;
        setHolding(null);
        setProgress(0);
        onCompleteRef.current?.(id);
      }
    }, TICK_MS);
  }, []);

  // A completed hold must swallow the click that fires on pointer release.
  const consumedClick = useCallback(() => {
    const d = done.current;
    done.current = false;
    return d;
  }, []);

  // Completion unmounts the seal grid before pointerup, so the swallowed click
  // may never fire — without a reset the stale latch eats the first legitimate
  // click on the next grid mount.
  const reset = useCallback(() => {
    done.current = false;
    cancel();
  }, [cancel]);

  useEffect(() => () => clearInterval(interval.current), []);

  return { holding, progress, start, cancel, consumedClick, reset };
}

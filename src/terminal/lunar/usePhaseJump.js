// usePhaseJump.js — animate the shared scrubAge to a phase's age.
//
// A phase click is an auto-performed scrub: this hook eases scrubAge from
// wherever it is now (currentAgeRef.current — liveAge when not scrubbing) to the
// clicked phase's representative age, along the shortest wrapped path. Because
// scrubAge is the tab's one clock, the moon, readouts, and register all follow.
// prefers-reduced-motion snaps instead. Re-clicking retargets from the current
// position; unmount cancels the frame.

import { useCallback, useEffect, useRef } from 'react';
import { SYNODIC_PERIOD } from './synodic';
import {
  JUMP_DURATION_MS,
  repAgeForPhase,
  shortestWrappedDelta,
  wrapAge,
  easeInOutCubic,
} from './phaseJump';

const EXTERNAL_WRITE_EPS = 1e-6;

export function usePhaseJump({ setScrubAge, currentAgeRef }) {
  const rafRef = useRef(0);
  const lastSetRef = useRef(null);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return useCallback((phaseId) => {
    cancelAnimationFrame(rafRef.current);

    const target = repAgeForPhase(phaseId);
    const start = currentAgeRef.current ?? 0;

    const reduced =
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setScrubAge(target);
      return;
    }

    const delta = shortestWrappedDelta(start, target, SYNODIC_PERIOD);
    const t0 = performance.now();
    lastSetRef.current = start;

    const set = (v) => { setScrubAge(v); lastSetRef.current = v; };

    const frame = (now) => {
      // Self-cancel: if scrubAge no longer matches what we last wrote, an
      // external control took the wheel (slider drag, scrub marker, or return-
      // to-now) — abort so the moon never fights a manual scrub.
      if (Math.abs(currentAgeRef.current - lastSetRef.current) > EXTERNAL_WRITE_EPS) return;

      const t = Math.min((now - t0) / JUMP_DURATION_MS, 1);
      if (t >= 1) {
        set(target);               // land exactly, no float drift
        return;
      }
      set(wrapAge(start + easeInOutCubic(t) * delta, SYNODIC_PERIOD));
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
  }, [setScrubAge, currentAgeRef]);
}

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
  const activeRef = useRef(false);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    activeRef.current = false;
  }, []);

  return useCallback((phaseId) => {
    cancelAnimationFrame(rafRef.current);

    const target = repAgeForPhase(phaseId);

    // Where the moon actually is right now. While a tween is in flight this is
    // the last value WE wrote, not currentAgeRef: setScrubAge is React state, so
    // the ref still holds the pre-commit value until the next render. Seeding
    // from the stale ref is what made a mid-tween click land behind its own
    // pending write — one frame later React applied it, the guard below saw a
    // mismatch, and the new tween aborted as if a drag had happened.
    const start = activeRef.current && lastSetRef.current != null
      ? lastSetRef.current
      : (currentAgeRef.current ?? 0);

    const reduced =
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      activeRef.current = false;
      lastSetRef.current = target;
      setScrubAge(target);
      return;
    }

    const delta = shortestWrappedDelta(start, target, SYNODIC_PERIOD);
    const t0 = performance.now();
    lastSetRef.current = start;
    activeRef.current = true;

    // The first frame of a fresh tween cannot meaningfully compare against the
    // ref: a click may still be racing React's commit of the previous write.
    // Skip the guard once — a genuine external write in that one-frame window
    // is caught on the very next frame anyway.
    let first = true;

    const set = (v) => { setScrubAge(v); lastSetRef.current = v; };

    const frame = (now) => {
      // Self-cancel: if scrubAge no longer matches what we last wrote, an
      // external control took the wheel (slider drag, scrub marker, or return-
      // to-now) — abort so the moon never fights a manual scrub.
      if (!first && Math.abs(currentAgeRef.current - lastSetRef.current) > EXTERNAL_WRITE_EPS) {
        activeRef.current = false;
        return;
      }
      first = false;

      const t = Math.min((now - t0) / JUMP_DURATION_MS, 1);
      if (t >= 1) {
        set(target);               // land exactly, no float drift
        activeRef.current = false;
        return;
      }
      set(wrapAge(start + easeInOutCubic(t) * delta, SYNODIC_PERIOD));
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
  }, [setScrubAge, currentAgeRef]);
}

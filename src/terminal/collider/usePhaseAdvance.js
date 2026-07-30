// usePhaseAdvance.js — the one phase transition that is driven by a clock.
//
// colliding -> result used to fire from inside the Canvas2D draw loop. That
// coupled a narrative state change to whether a frame happened to render, so
// under prefers-reduced-motion (loop halted by design) or inside a preview
// pane with suspended rAF, the collision would sit in 'colliding' forever and
// the result card would never appear.
//
// Extracted rather than inlined for the same reason usePhaseJump was pulled
// out of LunarTab: reaching this code path through the real component means
// driving a WASM collision, so the behaviour would be effectively untestable
// in place.

import { useEffect } from 'react';
import { COLLIDE_MS } from './colliderPhases';

export function usePhaseAdvance(phase, startedAt, onAdvance) {
  useEffect(() => {
    if (phase !== 'colliding') return undefined;
    // Fires COLLIDE_MS after the transition, not after this effect runs, so a
    // re-render mid-collision cannot extend the collision.
    const remaining = Math.max(0, COLLIDE_MS - (performance.now() - startedAt));
    const id = setTimeout(onAdvance, remaining);
    return () => clearTimeout(id);
    // onAdvance is intentionally absent: callers pass an inline closure, so
    // including it would re-arm the timer on every render of the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, startedAt]);
}

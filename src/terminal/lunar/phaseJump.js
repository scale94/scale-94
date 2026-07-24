// phaseJump.js — pure math for "click a phase, the moon travels there".
//
// A phase click is an auto-performed scrub: these helpers turn a phase id into
// a target age and give the shortest signed path around the 29.53-day wheel.
// No React, no DOM, no state — the tween lives in usePhaseJump.js.

import { SYNODIC_PERIOD, PHASES } from './synodic';

export const JUMP_DURATION_MS = 800;

/**
 * Signed distance on the wheel from `from` to `to`, in (-period/2, +period/2].
 * An exact half-turn resolves forward (+period/2), never backward, so ties are
 * deterministic. This is what makes "new" from day 27 wax forward through the
 * seam (+2.5d) rather than crawl backward 27 days.
 */
export function shortestWrappedDelta(from, to, period) {
  let d = (((to - from) % period) + period) % period; // [0, period)
  if (d > period / 2) d -= period;                     // (-period/2, +period/2]
  return d;
}

/** The illumination-defining age of a phase: index * SYNODIC / 8. */
export function repAgeForPhase(phaseId) {
  const i = PHASES.findIndex(p => p.id === phaseId);
  if (i < 0) return 0;
  return (i * SYNODIC_PERIOD) / 8;
}

/** Normalise an age into [0, period). */
export function wrapAge(age, period) {
  return ((age % period) + period) % period;
}

/** Standard easeInOutCubic on [0,1]. */
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

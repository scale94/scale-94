// darkAdaptation.js — the viewer's eye as state.
//
// Rod recovery is steeply nonlinear, so this is an exponential approach rather
// than the linear ramp the original spec carried: feedback arrives inside the
// first second and the last of it never quite lands. Frame-rate independent by
// construction -- the (1 - exp(-dt/tau)) form composes correctly under any dt.

export const TAU_SECONDS = 5;
export const BLEACH_THRESHOLD = 0.15;
export const BLEACH_FACTOR = 0.15;
export const REST_EPSILON = 0.002;

const CEILING_SLOPE = 0.85;

/** You cannot dark-adapt in front of a full moon. */
export function adaptCeiling(illumination) {
  const i = Math.max(0, Math.min(1, illumination));
  return 1 - CEILING_SLOPE * i;
}

export function createAdaptState(illumination) {
  return { adapt: 0, lastIllum: Math.max(0, Math.min(1, illumination)) };
}

export function stepAdapt(state, { dt, illumination, hidden = false, reducedMotion = false }) {
  const illum = Math.max(0, Math.min(1, illumination));
  const ceiling = adaptCeiling(illum);

  if (reducedMotion) return { adapt: ceiling, lastIllum: illum };

  // Hidden freezes adapt but keeps tracking illumination, so the first visible
  // frame is not read as a jump. The bleach models a transition the viewer
  // witnessed; a viewer with the tab hidden witnessed nothing.
  if (hidden) return { adapt: state.adapt, lastIllum: illum };

  let adapt = state.adapt;

  // Bleach only on a jump *toward* light. Strictly greater than threshold.
  if (illum - state.lastIllum > BLEACH_THRESHOLD) adapt *= BLEACH_FACTOR;

  adapt += (ceiling - adapt) * (1 - Math.exp(-dt / TAU_SECONDS));
  adapt = Math.max(0, Math.min(ceiling, adapt));

  return { adapt, lastIllum: illum };
}

/** Drives the 30fps idle throttle in LunarShaderMoon. */
export function isAtRest(state, illumination) {
  return Math.abs(adaptCeiling(illumination) - state.adapt) < REST_EPSILON;
}

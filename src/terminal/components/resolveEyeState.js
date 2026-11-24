// src/terminal/components/resolveEyeState.js — baseline + overlay (spec §5.4, D15).
// Pure: no React, no WebGL — the whole table is testable.
// Baseline: igniting → charging; sealed & not remarked → silver + thread;
//           all three vertebrae marked → aether (thread if sealed); else silver.
// Overlay:  flash → leaning in the flash tint; tinted glance → leaning + gaze + pulse;
//           shimmer glance (Mercury) → baseline state + shimmer + gaze.
// The vertebra table lives in quintessence/vertebrae.js — the altar's mirror reads it too.
import { VERTEBRAE } from '../quintessence/vertebrae';

const NAV_GAZE = [0.15, -0.04]; // drift toward the nav row

export function resolveEyeState({ spine, sealed, igniting, remarkedSinceSeal, flash, glance } = {}) {
  const s = spine || {};
  const armed = VERTEBRAE.every(v => !!s[v.key]);

  let baseline, state, thread;
  if (igniting) { baseline = 'charging'; state = 'charging'; thread = 0; }
  else if (sealed && !remarkedSinceSeal) { baseline = 'silver'; state = 'resting'; thread = 1; }
  else if (armed) { baseline = 'aether'; state = 'aether'; thread = sealed ? 1 : 0; }
  else { baseline = 'silver'; state = 'resting'; thread = 0; }

  const out = { state, tint: null, gaze: null, pulse: false, thread, shimmer: 0, baseline };

  if (flash) return { ...out, state: 'leaning', tint: flash.tint };
  if (glance && glance.tint) return { ...out, state: 'leaning', tint: glance.tint, gaze: NAV_GAZE, pulse: true };
  if (glance && glance.shimmer) return { ...out, gaze: NAV_GAZE, shimmer: 1 };
  return out;
}

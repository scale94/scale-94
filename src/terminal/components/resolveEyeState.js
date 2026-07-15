// src/terminal/components/resolveEyeState.js — the eye's priority chain (spec §2).
// Pure: no React, no WebGL — the whole chain is table-testable.
// Order: compiling > (mirror-flash overlay) > complete > armed > compass > ambient > resting.
const VERTEBRAE = [
  { key: 'trend',   tab: 'bsky',      tint: [56, 189, 248] },   // BSKY sky
  { key: 'council', tab: 'manifesto', tint: [167, 139, 250] },  // Manifesto violet
  { key: 'phase',   tab: 'lunar',     tint: [217, 70, 239] },   // Lunar fuchsia
];
const NAV_GAZE = [0.15, -0.04]; // drift toward the nav row

export function resolveEyeState({ flaring, sealed, spine, suggestion, flash }) {
  if (flaring) return { state: 'compiling', tint: null, gaze: null, pulse: false, pulseTab: null };

  const next = VERTEBRAE.find(v => !spine[v.key]);
  const marked = !!(spine.trend || spine.council || spine.phase);
  const pulseTab = sealed ? null
    : !next ? null                                  // armed: the altar is the pulse partner
    : marked ? next.tab                             // compass curriculum
    : suggestion ? suggestion.tab                   // element curriculum
    : null;

  if (flash) return { state: 'leaning', tint: flash.tint, gaze: null, pulse: false, pulseTab };
  if (sealed) return { state: 'complete', tint: null, gaze: null, pulse: false, pulseTab: null };
  if (!next)  return { state: 'armed', tint: null, gaze: null, pulse: true, pulseTab: null };
  if (marked) return { state: 'leaning', tint: next.tint, gaze: NAV_GAZE, pulse: true, pulseTab };
  if (suggestion) return { state: 'leaning', tint: suggestion.tint, gaze: NAV_GAZE, pulse: true, pulseTab };
  return { state: 'resting', tint: null, gaze: null, pulse: false, pulseTab: null };
}

export function pulseTabFor({ sealed, flaring, spine, suggestion }) {
  return resolveEyeState({ flaring, sealed, spine, suggestion, flash: null }).pulseTab;
}

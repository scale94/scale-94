// src/terminal/mercury/elements.js — single source of truth for element hues
// and their placement in the mirror's world (spec: elemental mirror §Changed).
//
// Keyed by PHASE name — the signal usePhaseTransition emits. 'thermal' is
// FIRE, 'fluid' is WATER; an element-name-keyed map silently loses both.

export const ELEMENTS = {
  air:     { element: 'AIR',   color: '#38bdf8', horizonHeight:  0.20 }, // pale cyan, sits high
  thermal: { element: 'FIRE',  color: '#f97316', horizonHeight:  0.00 }, // ember horizon, centered
  fluid:   { element: 'WATER', color: '#6366f1', horizonHeight: -0.10 }, // indigo, low-mid
  earth:   { element: 'EARTH', color: '#d97706', horizonHeight: -0.20 }, // amber, sunk toward ground
};

// What quintessence reflects: near-colorless deep night, visible only at
// peak chrome. Luminance is tuned against the shipped preset="night" look
// (spec §Named Risk) — this hue is the tuning knob, not the shader.
export const NEUTRAL_NIGHT = { element: 'QUINTESSENCE', color: '#23233a', horizonHeight: 0.0 };

export function elementForPhase(phase) {
  return ELEMENTS[phase] ?? NEUTRAL_NIGHT;
}

const hexRgbCache = {};

function hexToRgb(hex) {
  if (!hexRgbCache[hex]) {
    const n = parseInt(hex.slice(1), 16);
    hexRgbCache[hex] = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  return hexRgbCache[hex];
}

function lerp(a, b, t) {
  if (t === 0) return a;
  if (t === 1) return b;
  return a + (b - a) * t;
}

// Effective (already blended) env palette for a given transition frame.
// The neutral dip at peak chrome happens in the shader via uChromePhase;
// this resolves only the element-to-element blend.
//
// Intentional color-space asymmetry (probe-tuned, do not "fix"): hexToRgb
// below feeds raw sRGB byte fractions into THREE.Color.setRGB, which in
// three r183 does no conversion — env colors reach the shader sRGB-as-linear.
// MercurySphere reads the same palette hex via `new THREE.Color(hex)`,
// which DOES linearize, and the shader's uNeutralColor is seeded the same
// linearizing way — so that "tuning knob" runs on a different curve than
// these element colors. Changing either path un-tunes the probe-verified
// look (elemental-mirror-probe.html); leave both as-is.
export function resolveEnvState(activePhase, pendingPhase, sphereState) {
  const active  = elementForPhase(activePhase);
  const pending = pendingPhase ? elementForPhase(pendingPhase) : active;
  const blend       = sphereState?.colorBlend  ?? 0;
  const chromePhase = sphereState?.chromePhase ?? 0;
  const a = hexToRgb(active.color);
  const p = hexToRgb(pending.color);
  return {
    elementColor: [lerp(a[0], p[0], blend), lerp(a[1], p[1], blend), lerp(a[2], p[2], blend)],
    horizonHeight: lerp(active.horizonHeight, pending.horizonHeight, blend),
    chromePhase,
  };
}

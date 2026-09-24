// glsl.js — shared GLSL for the stereochemical chamber's programs.
// Node-importable: no DOM, no import.meta.env.

export function glslFloat(v) {
  if (!Number.isFinite(v)) throw new TypeError(`glslFloat: not a finite number: ${v}`);
  const s = String(v);
  return /[.eE]/.test(s) ? s : `${s}.0`;
}

export const glslFloatArray = (arr) => `float[${arr.length}](${arr.map(glslFloat).join(', ')})`;

export const GLSL_HUE2RGB = `
vec3 hue2rgb(float h) {
  vec3 k = mod(vec3(5.0, 3.0, 1.0) + h * 6.0, 6.0);
  return 1.0 - clamp(min(k, 4.0 - k), 0.0, 1.0);
}
`;

// Every per-instance random dimension beyond the 4-float seed comes from
// here. NEVER derive a second spatial degree of freedom as fract(h * k) of a
// seed component -- it is still a function of that component and collapses
// the population onto a 1-D locus (trap 2, 2026-07-30).
export const GLSL_HASH = `
float hashI(uint x, uint salt) {
  x ^= salt * 0x9e3779b9u;
  x ^= x >> 16u;
  x *= 0x7feb352du;
  x ^= x >> 15u;
  x *= 0x846ca68bu;
  x ^= x >> 16u;
  return float(x) * (1.0 / 4294967296.0);
}
`;

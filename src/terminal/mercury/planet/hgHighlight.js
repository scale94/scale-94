// src/terminal/mercury/planet/hgHighlight.js — liquid Hg highlights that blow out (lighting polish Step 2).
//
// A curve on the displayed liquid Hg reflection only (Fresnel x envRadianceLiquid: hgLiquid, hgMirrorGlsl.js): identity below HG_HIGHLIGHT_KNEE, then the
// brightest channel rolls off C1-smoothly toward 1 and the other two scale with it (hue-preserving, like aetherShoulder).
// Not an output-stage curve: the crust, regolith, steam, embers and every non-Hg term never pass through it.
// HG_HIGHLIGHT_GLSL is a line-for-line replica of hgHighlight (tested).

import { glf } from '../../gl/glf';
import { HG_HIGHLIGHT_KNEE } from './planetLook';

// rgb: linear [r, g, b] (Fresnel-weighted); knee < 1 (the roll-off divides by 1 - knee). Returns the curved [r, g, b].
export function hgHighlight([r, g, b], knee = HG_HIGHLIGHT_KNEE) {
  const m = Math.max(r, Math.max(g, b));
  if (m <= knee) return [r, g, b];
  const s = knee + (1 - knee) * (1 - Math.exp(-(m - knee) / (1 - knee)));
  return [r * (s / m), g * (s / m), b * (s / m)];
}

export const HG_HIGHLIGHT_GLSL = `// Liquid Hg highlights roll off to white (hgHighlight.js, line for line): identity below the knee, C1 above it.
const float HG_HIGHLIGHT_KNEE = ${glf(HG_HIGHLIGHT_KNEE)};
vec3 hgHighlight(vec3 x) {
  float m = max(x.r, max(x.g, x.b));
  if (m <= HG_HIGHLIGHT_KNEE) return x;
  float s = HG_HIGHLIGHT_KNEE + (1.0 - HG_HIGHLIGHT_KNEE) * (1.0 - exp(-(m - HG_HIGHLIGHT_KNEE) / (1.0 - HG_HIGHLIGHT_KNEE)));
  return x * (s / m);
}`;

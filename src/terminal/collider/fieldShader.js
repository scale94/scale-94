// fieldShader.js — pass 1. Everything in the chamber that is not matter,
// drawn analytically over glHost's fullscreen quad (spec §6.1, §6.4, §6.6).
//
// Kept from the July chamber: grid, central zone glow, crosshair, beamlines.
// New: the diamond Fresnel shock, the core glint, and up to three knife-edge
// Schlieren fronts. Removed: circular rings, the full-screen flash, and the
// 16-beam loop (the needles carry that data now).
//
// Hairlines use fwidth(), so every front is exactly one DEVICE px wide
// whatever the anisotropy of its distance field.

import { GEOMETRY, GAINS } from './colliderPhases.js';
import { glslFloat as f, glslFloatArray, GLSL_HUE2RGB } from './glsl.js';

export const FIELD_UNIFORMS = [
  'uRes', 'uPx', 'uPhase', 'uPhaseT', 'uHue', 'uSel', 'uLocus',
  'uShock', 'uGlint', 'uRingR', 'uRingA', 'uRingP', 'uDirect',
];

export const FIELD_VS = `#version 300 es
layout(location = 0) in vec2 aQuad;
out vec2 vUv;
void main() {
  vUv = aQuad * 0.5 + 0.5;
  gl_Position = vec4(aQuad, 0.0, 1.0);
}
`;

export const FIELD_FS = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2  uRes;
uniform float uPx;
uniform float uPhase;
uniform float uPhaseT;
uniform vec3  uHue;     // hueA, hueB, hue-space blend -- each in [0,1)
uniform vec2  uSel;
uniform vec2  uLocus;   // impact offset from centre, CSS px
uniform vec2  uShock;   // radius fraction, amplitude
uniform float uGlint;
uniform vec3  uRingR;   // radius fraction per front
uniform vec3  uRingA;   // amplitude per front (front 3 already mass-weighted)
uniform vec3  uRingP;   // life progress per front
uniform float uDirect;  // 1 = no accumulator: write the canvas directly
${GLSL_HUE2RGB}
const float SHOCK_R_FRAC = ${f(GEOMETRY.SHOCK_R_FRAC)};
const float SHOCK_ASPECT = ${f(GEOMETRY.SHOCK_ASPECT)};
const float FRINGE_PX    = ${f(GEOMETRY.FRINGE_PX)};
const float GLINT_SIGMA  = ${f(GEOMETRY.GLINT_SIGMA)};
const float RING_ASPECT  = ${f(GEOMETRY.RING_ASPECT)};
const float RING_ROUND   = ${f(GEOMETRY.RING_ROUND)};
const float RING_RK[3]   = ${glslFloatArray(GEOMETRY.RING_RK)};
const float G_SHOCK      = ${f(GAINS.SHOCK)};
const float G_GLINT      = ${f(GAINS.GLINT)};
const float G_RING       = ${f(GAINS.RING)};
const float G_SHADOW     = ${f(GAINS.SHADOW)};

float dither(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

// Triangle filter one device px wide, centred on s = 0 (s in device px).
float lobe(float s) {
  return max(0.0, 1.0 - abs(s));
}

// Hexagon with inradius r (Inigo Quilez).
float sdHexagon(vec2 p, float r) {
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

void main() {
  vec2 px = vUv * uRes;
  vec2 c  = uRes * 0.5;
  vec2 d  = px - c;
  float r = length(d);
  vec3 col = vec3(0.0);
  float shadow = 0.0;

  // grid
  vec2 g = abs(fract(px / 40.0) - 0.5);
  float grid = 1.0 - smoothstep(0.0, 0.02, min(g.x, g.y));
  col += vec3(0.024, 0.714, 0.831) * grid * 0.04;

  // central zone glow
  float zoneR = mix(40.0, 60.0 + 10.0 * sin(uPhaseT * 6.0), step(3.0, uPhase));
  float glow  = exp(-r / max(zoneR, 1.0));
  float pulse = 0.06 + 0.04 * sin(uPhaseT * 1.8);
  col += hue2rgb(mix(uHue.x, uHue.y, 0.5)) * glow * pulse;

  // crosshair
  float chx = (1.0 - smoothstep(0.0, 0.8, abs(d.y))) * (1.0 - smoothstep(18.0, 20.0, abs(d.x)));
  float chy = (1.0 - smoothstep(0.0, 0.8, abs(d.x))) * (1.0 - smoothstep(18.0, 20.0, abs(d.y)));
  col += vec3(0.851, 0.275, 0.937) * (chx + chy) * (0.15 + 0.05 * sin(uPhaseT * 3.0));

  // beamlines
  float onAxis = 1.0 - smoothstep(0.0, 1.2, abs(d.y));
  float bAlpha = uPhase == 2.0 ? 0.30 + 0.15 * sin(uPhaseT * 9.0) : 0.12;
  col += hue2rgb(uHue.x) * uSel.x * onAxis * bAlpha * step(px.x, c.x - 100.0);
  col += hue2rgb(uHue.y) * uSel.y * onAxis * bAlpha * step(c.x + 100.0, px.x);

  vec2 q = px - (c + uLocus);

  // diamond Fresnel shock: front + three fringes at sqrt(n) spacing
  if (uShock.y > 0.0) {
    float R   = uShock.x * SHOCK_R_FRAC * uRes.x;
    float rho = abs(q.x) + SHOCK_ASPECT * abs(q.y);
    float fw  = max(fwidth(rho), 1e-4);
    float lit = lobe((rho - R) / fw);
    for (int n = 1; n <= 3; n++) {
      float Rn = R - FRINGE_PX * sqrt(float(n));
      if (Rn > 0.0) lit += (0.5 / float(n)) * lobe((rho - Rn) / fw);
    }
    col += mix(vec3(1.0), hue2rgb(uHue.z), 0.35) * lit * uShock.y * G_SHOCK;
  }

  // core glint (<= 40ms)
  col += mix(vec3(1.0), hue2rgb(uHue.z), 0.25)
       * exp(-dot(q, q) / (2.0 * GLINT_SIGMA * GLINT_SIGMA)) * uGlint * G_GLINT;

  // Schlieren fronts: rounded hexagon relaxing to an ellipse; bright outer
  // lobe with per-channel dispersion, shadow inner lobe into coverage.
  vec3 tint = mix(vec3(1.0), hue2rgb(uHue.z), 0.5);
  vec2 e = vec2(q.x, q.y * RING_ASPECT);
  // fwidth() below needs uniform control flow (GLSL ES 3.00 gives no
  // defined derivatives otherwise; SwiftShader returns 0 and every lobe
  // vanishes). So no early continue/break in this loop: A already scales
  // both the light and the shadow terms, so a dead front adds exactly 0.
  for (int k = 0; k < 3; k++) {
    float A = uRingA[k];
    float R = uRingR[k] * RING_RK[k] * uRes.x;
    float rr = RING_ROUND * R;
    float dHex = sdHexagon(e, R - rr) - rr;
    float dEll = length(e) - R;
    float dd = mix(dHex, dEll, smoothstep(0.0, 0.6, uRingP[k]));
    float s = dd / max(fwidth(dd), 1e-4);   // signed device px, + outside
    float disp = mix(0.5, 1.5, uRingP[k]);
    col += vec3(lobe(s - 0.75 - disp) * tint.r,
                lobe(s - 0.75) * tint.g,
                lobe(s - 0.75 + disp) * tint.b) * A * G_RING;
    shadow += lobe(s + 0.75) * A * G_SHADOW;
  }

  if (uDirect > 0.5) {
    // Screen-blend fallback: no composite runs, so dither here and emit
    // premultiplied alpha = max channel. No shadow lobes on this path.
    col = max(col + (dither(px) - 0.5) / 255.0, vec3(0.0));
    fragColor = vec4(col, clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0));
  } else {
    // Accumulator: rgb is light, alpha is shadow coverage only.
    fragColor = vec4(col, shadow);
  }
}
`;

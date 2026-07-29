// fieldShader.js — pass 1. Everything in the chamber that is not a particle,
// drawn analytically over glHost's fullscreen quad.
//
// Replaces the Canvas2D grid, radial zone gradient, crosshair, beamlines,
// shockwave rings, impact flash and 16 dimension beams. Blended additively:
// the chamber is emissive light over the container's bg-black/60, so there is
// no alpha compositing to get wrong.

export const FIELD_UNIFORMS = [
  'uRes',    // vec2  canvas size in CSS px
  'uPhase',  // float PHASE_ID
  'uPhaseT', // float seconds in phase
  'uHue',    // vec2  hueA, hueB, each in [0,1)
  'uSel',    // vec2  is-domain-A-selected, is-domain-B-selected (0 or 1)
  'uBurst',  // vec4  ring1, ring2, flash, metrics  (-1 = inactive)
  'uBeamT',  // float seconds since the dimension beams armed, -1 = inactive
  'uBeams',  // vec4[16] angle(rad), mag[0,1], hue[0,1), lifespan(sec)
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
uniform float uPhase;
uniform float uPhaseT;
uniform vec2  uHue;
uniform vec2  uSel;
uniform vec4  uBurst;
uniform float uBeamT;
uniform vec4  uBeams[16];

vec3 hue2rgb(float h) {
  vec3 k = mod(vec3(5.0, 3.0, 1.0) + h * 6.0, 6.0);
  return 1.0 - clamp(min(k, 4.0 - k), 0.0, 1.0);
}

// Interleaved-gradient noise. One multiply-add and a fract, and it is what
// keeps the radial falloffs below off an OLED's banding staircase.
float dither(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void main() {
  vec2 px = vUv * uRes;
  vec2 c  = uRes * 0.5;
  vec2 d  = px - c;
  float r = length(d);
  vec3 col = vec3(0.0);

  // grid
  vec2 g = abs(fract(px / 40.0) - 0.5);
  float grid = 1.0 - smoothstep(0.0, 0.02, min(g.x, g.y));
  col += vec3(0.024, 0.714, 0.831) * grid * 0.04;

  // central zone — the shaped analytic bloom (spec 5.2)
  float zoneR = mix(40.0, 60.0 + 10.0 * sin(uPhaseT * 6.0), step(3.0, uPhase));
  float glow  = exp(-r / max(zoneR, 1.0));
  float pulse = 0.06 + 0.04 * sin(uPhaseT * 1.8);
  col += mix(hue2rgb(uHue.x), hue2rgb(uHue.y), 0.5) * glow * pulse;

  // crosshair
  float chx = (1.0 - smoothstep(0.0, 0.8, abs(d.y))) * (1.0 - smoothstep(18.0, 20.0, abs(d.x)));
  float chy = (1.0 - smoothstep(0.0, 0.8, abs(d.x))) * (1.0 - smoothstep(18.0, 20.0, abs(d.y)));
  col += vec3(0.851, 0.275, 0.937) * (chx + chy) * (0.15 + 0.05 * sin(uPhaseT * 3.0));

  // beamlines
  float onAxis  = 1.0 - smoothstep(0.0, 1.2, abs(d.y));
  float bAlpha  = uPhase == 2.0 ? 0.30 + 0.15 * sin(uPhaseT * 9.0) : 0.12;
  col += hue2rgb(uHue.x) * uSel.x * onAxis * bAlpha * step(px.x, c.x - 100.0);
  col += hue2rgb(uHue.y) * uSel.y * onAxis * bAlpha * step(c.x + 100.0, px.x);

  // shockwave rings
  if (uBurst.x >= 0.0) {
    float rr = uBurst.x * 120.0;
    float w  = 3.0 * (1.0 - uBurst.x) + 1.0;
    col += vec3(1.0) * (1.0 - uBurst.x) * 0.7 * (1.0 - smoothstep(0.0, w, abs(r - rr)));
  }
  if (uBurst.y >= 0.0) {
    float rr = uBurst.y * 90.0;
    float w  = 2.0 * (1.0 - uBurst.y) + 1.0;
    col += hue2rgb(mix(uHue.x, uHue.y, 0.5)) * (1.0 - uBurst.y) * 0.4
         * (1.0 - smoothstep(0.0, w, abs(r - rr)));
  }

  // 16 dimension beams
  if (uBeamT >= 0.0) {
    for (int i = 0; i < 16; i++) {
      vec4 B = uBeams[i];
      float p = uBeamT / max(B.w, 0.001);
      if (B.y < 0.02 || p > 1.0) continue;
      float eased = 1.0 - (1.0 - p) * (1.0 - p);
      float len   = B.y * min(uRes.x, uRes.y) * 0.4 * eased;
      vec2  dir   = vec2(cos(B.x), sin(B.x));
      float along = dot(d, dir);
      if (along < 0.0 || along > len) continue;
      float perp = abs(dot(d, vec2(-dir.y, dir.x)));
      col += hue2rgb(B.z) * (1.0 - p) * 0.85
           * (1.0 - smoothstep(0.0, 0.5 + B.y * 2.0, perp));
    }
  }

  // impact flash
  col += vec3(1.0) * max(uBurst.z, 0.0) * 0.35;

  col += (dither(px) - 0.5) / 255.0;

  // Additive blend: alpha carries luminance so unlit pixels stay transparent
  // and the container's bg-black/60 shows through.
  fragColor = vec4(col, clamp(dot(col, vec3(0.299, 0.587, 0.114)), 0.0, 1.0));
}
`;

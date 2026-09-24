// compositeShader.js — resolves the half-float accumulator into the canvas
// (spec §3.2). Max-channel Reinhard knee: identity below KNEE, asymptote 1,
// hue preserved because every channel is scaled by the same factor. accum.a
// carries only the Schlieren shadow coverage, which darkens the page's
// existing bg-black/60 along a hairline.

import { KNEE } from './colliderPhases.js';
import { glslFloat as f } from './glsl.js';

export const COMPOSITE_UNIFORMS = ['uAccum'];

export const COMPOSITE_VS = `#version 300 es
layout(location = 0) in vec2 aQuad;
out vec2 vUv;
void main() {
  vUv = aQuad * 0.5 + 0.5;
  gl_Position = vec4(aQuad, 0.0, 1.0);
}
`;

export const COMPOSITE_FS = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uAccum;

const float KNEE = ${f(KNEE)};

float dither(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void main() {
  vec4 acc = texture(uAccum, vUv);
  vec3 c = max(acc.rgb, vec3(0.0));
  float m = max(c.r, max(c.g, c.b));
  if (m > KNEE) {
    float t = m - KNEE;
    float s = 1.0 - KNEE;
    c *= (KNEE + s * t / (t + s)) / m;
  }
  // Dither only where there is light, so empty chamber stays exactly 0.
  c = max(c + step(1e-5, m) * (dither(gl_FragCoord.xy) - 0.5) / 255.0, vec3(0.0));
  float cov = clamp(acc.a, 0.0, 1.0);
  // Premultiplied: alpha must be >= every channel.
  fragColor = vec4(c, clamp(max(max(c.r, max(c.g, c.b)), cov), 0.0, 1.0));
}
`;

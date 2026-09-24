// ribbonShader.js — the chamber's one primitive (spec §4).
//
// Every piece of matter is a screen-space segment tail -> head, expanded in
// the vertex shader into a capsule one device px wider than it needs to be on
// every side, and resolved in the fragment shader by analytic distance. Widths
// are authored in CSS px and converted with uPx (device px per CSS px); a
// ribbon narrower than one device px keeps a one-device-px coverage footprint
// and dims by the ratio instead of breaking into beads.

export const RIBBON_VS_CHUNK = `
out vec2  vLocal;   // x along the segment from the tail, y across it (CSS px)
out float vLen;     // segment length (CSS px)
out float vHalfW;   // coverage half-width (CSS px), never below half a device px
out float vGain;    // true half-width / coverage half-width
out float vTailA;   // alpha at the tail end (1 = no taper)
out float vGap;     // 0..1 of the segment removed from the middle (bond failure)
out vec3  vCol;
out float vAlpha;

// Four vertices per instance, TRIANGLE_STRIP: 0 tail/-, 1 head/-, 2 tail/+, 3 head/+.
vec4 ribbonCorner(vec2 tail, vec2 head, float halfW, vec2 res, float px) {
  vec2 d = head - tail;
  float len = length(d);
  vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float hw = max(halfW, 0.5 / px);
  float margin = hw + 1.0 / px;
  float along = float(gl_VertexID & 1);
  float side = float((gl_VertexID >> 1) & 1) * 2.0 - 1.0;
  float cap = along * 2.0 - 1.0;
  vec2 p = mix(tail, head, along) + dir * cap * margin + nrm * side * margin;
  vLocal = vec2(along * len + cap * margin, side * margin);
  vLen = len;
  vHalfW = hw;
  vGain = halfW / hw;
  return vec4((p / res) * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const RIBBON_FS = `#version 300 es
precision highp float;

in vec2  vLocal;
in float vLen;
in float vHalfW;
in float vGain;
in float vTailA;
in float vGap;
in vec3  vCol;
in float vAlpha;
out vec4 fragColor;

uniform float uPx;

void main() {
  float x = vLocal.x;
  float dx = max(max(-x, x - vLen), 0.0);
  float dist = length(vec2(dx, vLocal.y));
  float cov = clamp((vHalfW - dist) * uPx + 0.5, 0.0, 1.0);
  float u = vLen > 1e-4 ? clamp(x / vLen, 0.0, 1.0) : 1.0;
  float taper = mix(vTailA, 1.0, u);
  float gap = step(1e-4, vGap) * step(abs(u - 0.5), 0.5 * vGap);
  float a = cov * taper * vGain * vAlpha * (1.0 - gap);
  vec3 c = vCol * a;
  // Alpha = max channel: the premultiplied value the screen-blend fallback
  // needs. The half-float path writes colour with blendFuncSeparate(.., ZERO,
  // ONE), so this alpha never reaches the accumulator's shadow channel.
  fragColor = vec4(c, max(c.r, max(c.g, c.b)));
}
`;

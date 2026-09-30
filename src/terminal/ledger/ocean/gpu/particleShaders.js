// particleShaders.js — river-stage parcels as round GL points. No imports, so
// scripts/oceanShaders.mjs can load it in Node and compile it in real Chrome.
// Position is already clip space (lon/180, lat/90); colour is computed on the
// CPU by riverStage.particleColor.

export const PARTICLE_VS = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec4 aColor;
uniform float uSize;
out vec4 vColor;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
  gl_PointSize = uSize;
  vColor = aColor;
}`;

export const PARTICLE_FS = `#version 300 es
precision mediump float;
in vec4 vColor;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  if (dot(d, d) > 0.25) discard;
  outColor = vColor;
}`;

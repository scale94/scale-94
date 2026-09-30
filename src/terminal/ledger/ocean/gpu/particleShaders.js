// particleShaders.js — river-stage parcels as round GL points. No imports, so
// scripts/oceanShaders.mjs can load it in Node and compile it in real Chrome.
// Position is already clip space (lon/180, lat/90); colour is computed on the
// CPU by riverStage.particleColor.
//
// Soft edge: the sprite is the visible diameter plus PARTICLE_AA_PX device px
// on each side (particleLayer adds it to uSize); the FS fades alpha over about
// 1 device px at the visible radius instead of discarding, so a 2–6 device px
// disc does not alias into a stepped line.

export const PARTICLE_AA_PX = 1;

export const PARTICLE_VS = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec4 aColor;
uniform float uSize;
out vec4 vColor;
out float vSize;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
  gl_PointSize = uSize;
  vColor = aColor;
  vSize = uSize;
}`;

export const PARTICLE_FS = `#version 300 es
precision mediump float;
const float AA_PX = ${PARTICLE_AA_PX.toFixed(1)};
in vec4 vColor;
in float vSize;
out vec4 outColor;
void main() {
  // Distance from the sprite centre in device px; the visible radius is the
  // sprite's half-size less the AA margin.
  float r = length(gl_PointCoord - 0.5) * vSize;
  float edge = 0.5 * vSize - AA_PX;
  float cover = 1.0 - smoothstep(edge - 0.5, edge + 0.5, r);
  outColor = vec4(vColor.rgb, vColor.a * cover);
}`;

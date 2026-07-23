// moonShader.js — GLSL sources. Grown task by task; this is the flat-disc
// stage that exists so the host can be verified before any surface work.

export const QUAD_VS = `#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vScreen;
void main() {
  vScreen = aPos;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

export const MOON_FS = `#version 300 es
precision highp float;
in vec2 vScreen;
uniform float uRadius;
out vec4 fragColor;

void main() {
  float r = length(vScreen);
  if (r > uRadius) discard;
  fragColor = vec4(0.55, 0.48, 0.85, 1.0);
}`;

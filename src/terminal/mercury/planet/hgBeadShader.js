// src/terminal/mercury/planet/hgBeadShader.js — liquid Hg beads as point-sprite sphere impostors (aether spec §3).
// Shaded by the planet's own mirror (hgMirrorGlsl, interpolated verbatim): exact Hg Fresnel × the analytic sky
// (Sun disc, element emitters, aether lobes). In the planet's shadow the Sun term is removed; a reflected ray that
// hits the planet sees its lit regolith instead of the sky. Solid: depth-tested, but never cleared by planetWindow.
// Written for a ShaderMaterial with glslVersion GLSL3 (three maps attribute/varying; the fragment output is declared here).

import * as THREE from 'three';
import { v3 } from '../../gl/glf';
import { HG_MIRROR_DECLS_GLSL, HG_FRESNEL_GLSL, HG_ENV_GLSL } from './hgMirrorGlsl';
import { AETHER_SHADOW_GLSL } from './aetherLight';
import { DROPLET_RENDER_ORDER } from './dropletShader';
import { FALLBACK_ALBEDO } from './planetLook';

export const BEAD_MIN_PX = 1.5;
export const BEAD_RENDER_ORDER = DROPLET_RENDER_ORDER + 1;
export const BEAD_MATERIAL = Object.freeze({ transparent: true, depthTest: true, depthWrite: false, blending: THREE.NormalBlending });
export const BEAD_UNIFORMS_OWN = ['uViewportPx', 'uPlanetR', 'uLitPen', 'uSunGlint'];
// The first line of envRadiance, verbatim (the test pins it against HG_ENV_GLSL).
export const SUN_TERM_GLSL = 'vec3(softShoulder(uSunGlint * uSunIrr * uExposure * lobe(dot(R, uSunDir), uSunSinR, rough), SUN_SHOULDER))';

export const BEAD_VS = /* glsl */ `
uniform vec2 uViewportPx;
attribute vec2 aBead; // radius (scene units), alpha
varying vec3 vC;
varying float vR;
varying float vA;
varying float vCover;
varying float vPx;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float px = 2.0 * aBead.x * 0.5 * uViewportPx.y * projectionMatrix[1][1] / -mv.z;
  vCover = clamp(px / ${BEAD_MIN_PX.toFixed(1)}, 0.0, 1.0);
  gl_PointSize = max(px, ${BEAD_MIN_PX.toFixed(1)});
  vPx = gl_PointSize;
  vC = (modelMatrix * vec4(position, 1.0)).xyz;
  vR = aBead.x;
  vA = aBead.y;
  gl_Position = projectionMatrix * mv;
}
`;

export const BEAD_FS = /* glsl */ `
layout(location = 0) out highp vec4 fragColor;
${HG_MIRROR_DECLS_GLSL}
${HG_FRESNEL_GLSL}
${HG_ENV_GLSL}
${AETHER_SHADOW_GLSL}
uniform float uPlanetR;
uniform float uLitPen;
varying vec3 vC;
varying float vR;
varying float vA;
varying float vCover;
varying float vPx;
const vec3 PLANET_ALBEDO = ${v3(FALLBACK_ALBEDO)};

vec3 sunTerm(vec3 R, float rough) {
  return ${SUN_TERM_GLSL};
}

// The reflected ray from P hits the planet → its lit regolith replaces the sky behind it.
vec4 planetInMirror(vec3 P, vec3 R) {
  float b = dot(P, R);
  float c = dot(P, P) - uPlanetR * uPlanetR;
  float disc = b * b - c;
  if (disc <= 0.0) return vec4(0.0);
  float t = -b - sqrt(disc);
  if (t <= 0.0) return vec4(0.0);
  vec3 hn = normalize(P + t * R);
  return vec4(PLANET_ALBEDO * uSunIrr * uExposure * max(dot(hn, uSunDir), 0.0), 1.0);
}

void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  q.y = -q.y;
  float d2 = dot(q, q);
  if (d2 > 1.0) discard;
  vec3 n = normalize(transpose(mat3(viewMatrix)) * vec3(q, sqrt(1.0 - d2)));
  vec3 P = vC + n * vR;
  vec3 V = normalize(cameraPosition - P);
  vec3 R = reflect(-V, n);
  float sh = aetherShadow(vC, uSunDir, uPlanetR, uLitPen);
  vec3 env = envRadiance(R, uRoughLiquid, P, n) - (1.0 - sh) * sunTerm(R, uRoughLiquid);
  vec4 pl = planetInMirror(P, R);
  env = mix(env, pl.rgb * sh, pl.a);
  vec3 col = max(fresnelHg(dot(n, V)) * env, 0.0);
  float edge = 1.0 - smoothstep(1.0 - 2.0 / vPx, 1.0, sqrt(d2)); // antialiased rim
  // Output stage as the droplet pass / planet: exposure is already inside the terms; just sRGB-encode.
  vec3 srgb = mix(col * 12.92, 1.055 * pow(col, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), col));
  fragColor = vec4(srgb, vA * vCover * vCover * edge);
}
`;

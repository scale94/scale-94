// src/terminal/mercury/planet/hgBeadShader.js — liquid Hg beads as point-sprite sphere impostors (aether spec §3).
// Shaded by the planet's own mirror (hgMirrorGlsl, interpolated verbatim): exact Hg Fresnel × the analytic sky
// (Sun disc, element emitters, aether lobes). In the planet's shadow the Sun term is removed; a reflected ray that
// hits the planet sees its lit regolith instead of the sky. Solid: depth-tested, but never cleared by planetWindow.
// Written for a ShaderMaterial with glslVersion GLSL3 (three maps attribute/varying; the fragment output is declared here).

import * as THREE from 'three';
import { v3, glf } from '../../gl/glf';
import { HG_MIRROR_DECLS_GLSL, HG_FRESNEL_GLSL, HG_ENV_GLSL } from './hgMirrorGlsl';
import { AETHER_SHADOW_GLSL } from './aetherLight';
import { DROPLET_RENDER_ORDER } from './dropletShader';
import { FALLBACK_ALBEDO } from './planetLook';

export const BEAD_MIN_PX = 1.5;
export const BEAD_RENDER_ORDER = DROPLET_RENDER_ORDER + 1;
// Premultiplied output (body occludes by its true coverage, the glint adds light): explicit factors, CustomBlending.
export const BEAD_MATERIAL = Object.freeze({
  transparent: true, depthTest: true, depthWrite: false, blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation,
});
export const BEAD_UNIFORMS_OWN = ['uViewportPx', 'uPlanetR', 'uLitPen', 'uSunGlint', 'uBeadSparkle'];
export const BEAD_BODY_SUBPX = 0.35;  // the dark occluding body's opacity scale at sub-pixel radii (to 1 by 5 px)
export const BEAD_GLINT_MAX = 1.5;    // cap on the analytic glint (sRGB units)
export const BEAD_GLINT_SIGMA_PX = 0.6; // glint footprint on a large bead: a ~1 px spark
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
uniform float uBeadSparkle;
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
  // Rim AA only where the rim band fits inside the disc; below 4 px vCover^2 already carries the coverage.
  float edgeK = vPx >= 4.0 ? 1.0 - smoothstep(1.0 - 2.0 / vPx, 1.0, sqrt(d2)) : 1.0;
  float bodyK = mix(${glf(BEAD_BODY_SUBPX)}, 1.0, smoothstep(2.0, 5.0, vPx));
  float aBody = vA * vCover * vCover * edgeK * bodyK;
  // Guaranteed glint: a mirror sphere has the Sun's image at the point whose normal is H, from every view.
  vec3 Vc = normalize(cameraPosition - vC);
  vec3 H = normalize(Vc + uSunDir);
  float G = min(uBeadSparkle * fresnelHg(dot(H, Vc)) * sh, ${glf(BEAD_GLINT_MAX)});
  vec2 qg = (viewMatrix * vec4(H, 0.0)).xy;
  float dpx = length(q - qg) * 0.5 * vPx;
  float w = exp(-dpx * dpx / (2.0 * ${glf(BEAD_GLINT_SIGMA_PX)} * ${glf(BEAD_GLINT_SIGMA_PX)}));
  vec3 glint = vec3(G * w * vA);
  // Output stage as the droplet pass / planet: exposure is already inside the terms; just sRGB-encode.
  vec3 srgb = mix(col * 12.92, 1.055 * pow(col, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), col));
  fragColor = vec4(srgb * aBody + glint, aBody);
}
`;

// src/terminal/mercury/planet/hgMirrorGlsl.js — the quicksilver mirror, shared by the planet and the droplets.
//
// mercuryPlanetShader.js interpolates HG_FRESNEL_GLSL and HG_ENV_GLSL exactly where its own text
// used to hold them, so PLANET_FS stays byte-identical (pinned snapshot). HG_MIRROR_DECLS_GLSL is
// what those chunks read; every one of its lines is also a line of PLANET_FS (tested), so the
// droplets (dropletShader.js) can never drift from the planet's mirror.

import { glf, v3 } from '../../gl/glf';
import { HG_N, HG_K } from './hgOptics';
import { AETHER_LOBES, AETHER_SHAPES } from './aetherLobes';
import {
  EMIT_RADIUS, EMIT_MIN_SIN, EMIT_HORIZON_SOFT, SUN_SHOULDER, AETHER_NIGHT, AETHER_DAY_LO, AETHER_DAY_HI,
  NIGHT_TINT, AETHER_FRINGE_LO, AETHER_FRINGE_HI, AETHER_SHOULDER,
} from './planetLook';

export const AETHER_SHAPE_GLSL = `const vec2 AETHER_SHAPE[${AETHER_LOBES}] = vec2[${AETHER_LOBES}](${AETHER_SHAPES.map(([w, s]) => `vec2(${glf(w)}, ${glf(s)})`).join(', ')});`;

export const HG_MIRROR_UNIFORMS = [
  'uSunDir', 'uSunIrr', 'uSunSinR', 'uExposure', 'uEmitPos', 'uEmitCol', 'uSunGlint', 'uEmitGain',
  'uAethDir', 'uAethCol', 'uAetherGain', 'uAetherSinW', 'uAetherSilver', 'uAetherEdge', 'uAetherStretch',
  'uAetherCurve', 'uAetherCore', 'uRoughLiquid',
];

export const HG_MIRROR_DECLS_GLSL = [
  'uniform vec3 uSunDir;',
  'uniform float uSunIrr;',
  'uniform float uSunSinR;',
  'uniform float uExposure;',
  'uniform vec3 uEmitPos[4];',
  'uniform vec3 uEmitCol[4];',
  'uniform float uSunGlint;',
  'uniform float uEmitGain;',
  `uniform vec3 uAethDir[${AETHER_LOBES}];`,
  `uniform vec3 uAethCol[${AETHER_LOBES}];`,
  'uniform float uAetherGain;',
  'uniform float uAetherSinW;',
  'uniform float uAetherSilver;',
  'uniform float uAetherEdge;',
  'uniform float uAetherStretch;',
  'uniform float uAetherCurve;',
  'uniform float uAetherCore;',
  'uniform float uRoughLiquid;',
  `const vec3 HG_N = ${v3(HG_N)};`,
  `const vec3 HG_K = ${v3(HG_K)};`,
  `const float EMIT_RADIUS = ${glf(EMIT_RADIUS)};`,
  `const float EMIT_MIN_SIN = ${glf(EMIT_MIN_SIN)};`,
  `const float EMIT_HORIZON_SOFT = ${glf(EMIT_HORIZON_SOFT)};`,
  `const float SUN_SHOULDER = ${glf(SUN_SHOULDER)};`,
  `const int AETHER_LOBES = ${AETHER_LOBES};`,
  AETHER_SHAPE_GLSL,
  `const float AETHER_NIGHT = ${glf(AETHER_NIGHT)};`,
  `const float AETHER_DAY_LO = ${glf(AETHER_DAY_LO)};`,
  `const float AETHER_DAY_HI = ${glf(AETHER_DAY_HI)};`,
  `const float AETHER_FRINGE_LO = ${glf(AETHER_FRINGE_LO)};`,
  `const float AETHER_FRINGE_HI = ${glf(AETHER_FRINGE_HI)};`,
  `const float AETHER_SHOULDER = ${glf(AETHER_SHOULDER)};`,
  `const vec3 NIGHT_TINT = ${v3(NIGHT_TINT)};`,
].join('\n');

export const HG_FRESNEL_GLSL = `// hgOptics.conductorFresnel, exactly: unpolarised reflectance of a metal (n + ik) in vacuum.
vec3 fresnelHg(float cosI) {
  float c = clamp(cosI, 0.0, 1.0);
  float c2 = c * c;
  float s2 = 1.0 - c2;
  vec3 t0 = HG_N * HG_N - HG_K * HG_K - s2;
  vec3 a2b2 = sqrt(t0 * t0 + 4.0 * HG_N * HG_N * HG_K * HG_K);
  vec3 a = sqrt(max(0.5 * (a2b2 + t0), 0.0));
  vec3 rs = (a2b2 + c2 - 2.0 * a * c) / (a2b2 + c2 + 2.0 * a * c);
  vec3 t1 = c2 * a2b2 + s2 * s2;
  vec3 t2 = 2.0 * a * c * s2;
  vec3 rp = rs * (t1 - t2) / (t1 + t2);
  return 0.5 * (rs + rp);
}`;

export const HG_ENV_GLSL = `// A disc of angular radius asin(sinR) seen in a mirror of roughness rough:
// a Gaussian in angle whose width adds the disc and the GGX alpha, scaled so
// the integrated energy stays that of the disc.
float lobe(float cosA, float sinR, float rough) {
  float a = acos(clamp(cosA, -1.0, 1.0));
  float alpha = rough * rough;
  float w2 = sinR * sinR + alpha * alpha;
  return (sinR * sinR / w2) * exp(-a * a / w2);
}

// Highlight roll-off (mirrorLobes.softShoulder).
float softShoulder(float x, float k) { return k * (1.0 - exp(-x / k)); }

vec3 aetherShoulder(vec3 x) {
  return vec3(softShoulder(x.r, AETHER_SHOULDER), softShoulder(x.g, AETHER_SHOULDER), softShoulder(x.b, AETHER_SHOULDER));
}

// Night attenuation of the aether, keyed on the SURFACE facing the Sun (not
// the reflection direction): full day strength from AETHER_DAY_HI, a cold
// indigo AETHER_NIGHT below AETHER_DAY_LO.
vec3 aetherTint(vec3 nW) {
  float dayW = smoothstep(AETHER_DAY_LO, AETHER_DAY_HI, dot(nW, uSunDir));
  return mix(AETHER_NIGHT * NIGHT_TINT, vec3(1.0), dayW);
}

// An aether lobe's colour, pulled toward neutral silver by uAetherSilver:
// the metal stays quicksilver and the aether only tints it.
vec3 aetherHue(vec3 col) {
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  return mix(col, vec3(l), uAetherSilver);
}

// One aether streak in the mirror: an elongated lobe around d, stretched along
// the orbital flow (azimuth about +Y). Returns (intensity, fringe):
// intensity = a super-Gaussian silhouette (uAetherEdge: the meniscus edge's
// hardness) × a curved body inside it (uAetherCurve: brightest at the centre);
// fringe = 0 in the core, 1 at the edge, where the aether colour lives.
vec2 aetherStreak(vec3 R, vec3 d, vec2 shape, float rough) {
  float facing = dot(R, d);
  if (facing <= 0.0) return vec2(0.0);
  vec3 flow = normalize(cross(vec3(0.0, 1.0, 0.0), d));
  vec3 bn = cross(d, flow);
  float alpha = rough * rough;
  float wA = uAetherSinW * shape.x;
  float across = sqrt(wA * wA + alpha * alpha);
  float along = across * (1.0 + (shape.y - 1.0) * uAetherStretch);
  float u = dot(R, flow) / along;
  float v = dot(R, bn) / across;
  float d2 = u * u + v * v;
  float silhouette = exp(-pow(d2, max(uAetherEdge, 0.5)));
  float body = exp(-uAetherCurve * d2);
  return vec2(smoothstep(0.0, 0.15, facing) * silhouette * body, smoothstep(AETHER_FRINGE_LO, AETHER_FRINGE_HI, d2));
}

// A streak's colour at fringe f: the gas's own hue throughout, brightest in the
// core (× uAetherCore) and falling to the plain aether hue at the meniscus edge.
// A neutral white core read as a studio softbox, not as nebula in a mirror.
vec3 aetherStreakColor(vec3 col, float f) {
  return aetherHue(col) * mix(uAetherCore, 1.0, f);
}

// What the liquid sees: the Sun disc, the four elements, and the aether that
// wraps the planet on every side. Analytic; no cubemap.
vec3 envRadiance(vec3 R, float rough, vec3 P, vec3 nW) {
  vec3 c = vec3(softShoulder(uSunGlint * uSunIrr * uExposure * lobe(dot(R, uSunDir), uSunSinR, rough), SUN_SHOULDER));
  for (int i = 0; i < 4; i++) {
    vec3 d = uEmitPos[i] - P;
    float dist = max(length(d), 1e-3);
    vec3 dir = d / dist;
    float sinE = clamp(EMIT_RADIUS / dist, EMIT_MIN_SIN, 0.99);
    float above = smoothstep(-EMIT_HORIZON_SOFT, EMIT_HORIZON_SOFT, dot(nW, dir));
    c += uEmitCol[i] * (uEmitGain * above * lobe(dot(R, dir), sinE, rough));
  }
  vec3 a = vec3(0.0);
  for (int i = 0; i < AETHER_LOBES; i++) {
    vec2 s = aetherStreak(R, uAethDir[i], AETHER_SHAPE[i], rough);
    a += aetherStreakColor(uAethCol[i], s.y) * s.x;
  }
  return c + aetherTint(nW) * aetherShoulder(uAetherGain * a);
}`;

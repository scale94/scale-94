// src/terminal/mercury/planet/hgMirrorGlsl.js — the quicksilver mirror, shared by the planet and the droplets.
//
// mercuryPlanetShader.js interpolates HG_FRESNEL_GLSL and HG_ENV_GLSL exactly where its own text
// used to hold them. PLANET_FS is pinned by its file snapshot; the 2026-10-05 mirror-sky change re-pinned it.
// HG_MIRROR_DECLS_GLSL is
// what those chunks read; every one of its lines is also a line of PLANET_FS (tested), so the
// droplets (dropletShader.js) can never drift from the planet's mirror.

import { glf, v3 } from '../../gl/glf';
import { HG_N, HG_K } from './hgOptics';
import { AETHER_SKY_GLSL } from './aetherSky';
import { HG_HIGHLIGHT_GLSL } from './hgHighlight';
import {
  EMIT_RADIUS, EMIT_MIN_SIN, EMIT_HORIZON_SOFT, SUN_SHOULDER, AETHER_NIGHT, AETHER_DAY_LO, AETHER_DAY_HI,
  NIGHT_TINT, AETHER_SHOULDER, AETHER_PATH_WHITE,
} from './planetLook';

export const HG_MIRROR_UNIFORMS = [
  'uSunDir', 'uSunIrr', 'uSunSinR', 'uExposure', 'uEmitPos', 'uEmitCol', 'uSunGlint', 'uEmitGain',
  'uSkyT', 'uSkyPhase', 'uSkyW', 'uAetherGain', 'uAetherSilver', 'uNeutralSky', 'uStudioDome', 'uStudioLook', 'uStudioLook2', 'uStudioMean', 'uNeutralNebula', 'uNebulaRot', 'uNebulaMap', 'uElementSky', 'uRoughLiquid',
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
  'uniform float uSkyT;',
  'uniform vec4 uSkyPhase;',
  'uniform vec4 uSkyW;',
  'uniform float uAetherGain;',
  'uniform float uAetherSilver;',
  'uniform float uNeutralSky;',
  'uniform float uStudioDome;',
  'uniform vec4 uStudioLook;',
  'uniform vec4 uStudioLook2;',
  'uniform float uStudioMean;',
  'uniform float uNeutralNebula;',
  'uniform mat3 uNebulaRot;',
  'uniform samplerCube uNebulaMap;',
  'uniform samplerCube uElementSky;',
  'uniform float uRoughLiquid;',
  `const vec3 HG_N = ${v3(HG_N)};`,
  `const vec3 HG_K = ${v3(HG_K)};`,
  `const float EMIT_RADIUS = ${glf(EMIT_RADIUS)};`,
  `const float EMIT_MIN_SIN = ${glf(EMIT_MIN_SIN)};`,
  `const float EMIT_HORIZON_SOFT = ${glf(EMIT_HORIZON_SOFT)};`,
  `const float SUN_SHOULDER = ${glf(SUN_SHOULDER)};`,
  `const float AETHER_NIGHT = ${glf(AETHER_NIGHT)};`,
  `const float AETHER_DAY_LO = ${glf(AETHER_DAY_LO)};`,
  `const float AETHER_DAY_HI = ${glf(AETHER_DAY_HI)};`,
  `const float AETHER_SHOULDER = ${glf(AETHER_SHOULDER)};`,
  `const float AETHER_PATH_WHITE = ${glf(AETHER_PATH_WHITE)};`,
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

// envRadiance's Sun + emitter lines, shared verbatim with envLights (envRadiance's text stays byte-identical).
const ENV_LIGHTS_BODY = `  vec3 c = vec3(softShoulder(uSunGlint * uSunIrr * uExposure * lobe(dot(R, uSunDir), uSunSinR, rough), SUN_SHOULDER));
  for (int i = 0; i < 4; i++) {
    vec3 d = uEmitPos[i] - P;
    float dist = max(length(d), 1e-3);
    vec3 dir = d / dist;
    float sinE = clamp(EMIT_RADIUS / dist, EMIT_MIN_SIN, 0.99);
    float above = smoothstep(-EMIT_HORIZON_SOFT, EMIT_HORIZON_SOFT, dot(nW, dir));
    c += uEmitCol[i] * (uEmitGain * above * lobe(dot(R, dir), sinE, rough));
  }`;

// The hue-preserving shoulder, one text for both knees: aetherShoulder's compiled text is byte-identical to 8255e4c0
// (pinned), and studioShoulder can only differ from it in the knee expression.
const shoulderFn = (name, knee) => `vec3 ${name}(vec3 x) {
  float m = max(x.r, max(x.g, x.b));
  if (m <= 1e-6) return x;
  float s = softShoulder(m, ${knee});
  vec3 y = x * (s / m);
  return mix(y, vec3(s), AETHER_PATH_WHITE * smoothstep(0.55, 0.95, s / ${knee}));
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

// Hue-preserving roll-off: the brightest channel rolls off toward AETHER_SHOULDER and the other two scale with it.
// Per channel, a bright magenta core clipped toward pastel (the sky's own structure sets the volume).
// Only the hottest part of a core takes a little path to white (AETHER_PATH_WHITE at full compression), as overexposed
// emission does: the core reads luminous and curved, the fringe stays the deep gas hue.
${shoulderFn('aetherShoulder', 'AETHER_SHOULDER')}

// The studio's roll-off: aetherShoulder with its knee read live from uStudioLook2.x (PLANET_TUNE.studioShoulder;
// knee 1 = AETHER_SHOULDER, today's look). Guarded: an unbound or zero knee would divide by zero.
${shoulderFn('studioShoulder', 'max(uStudioLook2.x, 1e-3)')}

// Night attenuation of the aether, keyed on the SURFACE facing the Sun (not
// the reflection direction): full day strength from AETHER_DAY_HI, a cold
// indigo AETHER_NIGHT below AETHER_DAY_LO.
vec3 aetherTint(vec3 nW) {
  float dayW = smoothstep(AETHER_DAY_LO, AETHER_DAY_HI, dot(nW, uSunDir));
  return mix(AETHER_NIGHT * NIGHT_TINT, vec3(1.0), dayW);
}

// The sky's colour, pulled toward neutral silver by uAetherSilver:
// the metal stays quicksilver and the aether only tints it.
vec3 aetherHue(vec3 col) {
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  return mix(col, vec3(l), uAetherSilver);
}

${AETHER_SKY_GLSL}

// The aether in a mirror of roughness rough: the active element's moving sky (aetherSky.js), night-tinted,
// rolled off. Shared by the liquid (envRadiance) and the planet's frozen Hg (a rough, dark mirror of the same sky).
vec3 aetherMirror(vec3 R, float rough, vec3 nW) {
  return aetherTint(nW) * aetherShoulder(uAetherGain * aetherHue(aetherSky(R, rough)));
}

// What the liquid sees: the Sun disc, the four elements, and the aether that
// wraps the planet on every side. Analytic; no cubemap.
vec3 envRadiance(vec3 R, float rough, vec3 P, vec3 nW) {
${ENV_LIGHTS_BODY}
  return c + aetherMirror(R, rough, nW);
}

// The Sun disc and the four elements alone: envRadiance's own lines (one JS source, so the two can't drift).
vec3 envLights(vec3 R, float rough, vec3 P, vec3 nW) {
${ENV_LIGHTS_BODY}
  return c;
}

// The liquid's aether (lighting polish Step 1): only the element skies are night-tinted. The studio tent and the baked
// nebula are a camera-fixed scene the mirror sees, not sunlit gas, so they reach the liquid untinted on the night side
// too (aetherTint painted a terminator on a mirror). Each part rolls off on its own shoulder.
vec3 aetherMirrorLiquid(vec3 R, float rough, vec3 nW) {
  vec3 neutral;
  vec3 elem = aetherSkySplit(R, rough, neutral);
  return aetherTint(nW) * aetherShoulder(uAetherGain * aetherHue(elem)) + studioShoulder(uAetherGain * aetherHue(neutral));
}

// What liquid Hg sees: envRadiance with the studio untinted. The frost, quench, evaporite, frozen Hg and visitor
// water/rock keep envRadiance (ruled looks, no curve).
vec3 envRadianceLiquid(vec3 R, float rough, vec3 P, vec3 nW) {
  return envLights(R, rough, P, nW) + aetherMirrorLiquid(R, rough, nW);
}

${HG_HIGHLIGHT_GLSL}

// The displayed liquid Hg reflection (the planet liquid, the visitor crust pool, the droplets): its Fresnel weight F
// times what it sees, highlights rolled off to white AFTER the Fresnel, so a light can reach white on screen. The beads
// apply hgHighlight to their own Fresnel-weighted env (their shadowed Sun comes off first).
vec3 hgLiquid(vec3 F, vec3 R, float rough, vec3 P, vec3 nW) {
  return hgHighlight(F * envRadianceLiquid(R, rough, P, nW));
}`;

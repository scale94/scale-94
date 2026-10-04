// src/terminal/mercury/planet/mercuryPlanetShader.js — Mercury, from the bare metal.
//
// An impostor quad ray-intersects the sphere, writes gl_FragDepth (so the
// aether sorts in front of and behind it), and shades from two equirect maps:
// MESSENGER enhanced colour + USGS DEM. Airless-body photometry
// (Lommel–Seeliger), a penumbra as wide as the real Sun's disc, cast crater
// shadows near the terminator. Constants come from the modules that own and
// test them (glf), exactly like /ACCRETION. Frame convention = planetFrame.js.
// Phase 2: a body rotation matrix (mercuryBody), a transmutation front, three
// phases of the element by local temperature (mercuryThermal), and a liquid
// mirror that reflects the Sun, the four element emitters, and the aether that
// wraps the planet (16 analytic flow streaks, aetherLobes.js; spec amendment 2026-10-01).
// Phase 3: the transmuted planet is a bead (mercuryWaves.js) — body modes and spin bulge move the silhouette, capillary ripples tilt the normal — and the crust keeps a scar map (scarMap.js).
// Meniscus: the liquid reflects with the exact conductor Fresnel of Hg's n + ik (hgOptics.js), and
// meets the crust in a non-wetting bead rim with a hard contact line (mercuryMeniscus.js).

import { glf, v3 } from '../../gl/glf';
import { SCAR_DEPTH_RANGE_M } from './scarMap';
import { TIERS } from './planetQuality';
import { CALM_GLOW_RAD } from './mercuryImpacts';
import { HG_N, HG_K } from './hgOptics';
import {
  VISIT_SURF_MAX, SURF_FILM, SURF_HOT, SURF_MENISCUS, SURF_JET, FILM_N, FILM_A, FILM_TEAR_NM, FILM_NOISE_FREQ, HOT_GAIN,
  CATSPAW_K, CATSPAW_AMP, CATSPAW_SPEED, JET_DEPTH,
  FROST_ALBEDO, FROST_ENV, GLAZE_ROUGH, POOL_RIM_H, SURF_FROST, SURF_POOL, SURF_COLLAR,
  SURF_QUENCH, EVAPORITE_ALBEDO, EVAPORITE_A, EVAPORITE_EDGE, EVAPORITE_LIFT, EVAPORITE_GAIN, QUENCH_DARK, QUENCH_ROUGH, GLASS_F0,
} from './visitorSim';
import { VISIT_LIGHT_GLSL } from './visitorGlsl';
import { MENISCUS_MAX_SIN, MENISCUS_MIN_PX, MENISCUS_GRAD_FLOOR } from './mercuryMeniscus';
import {
  IMPULSE_SLOTS, SHAPE_MAX, WAVE_KR, WAVE_C_GROUP, WAVE_SPREAD_FLOOR,
  WAVE_K_PEAK, WAVE_SPEC_W, WAVE_VISC_PER_S, WAVE_SHARP, WAVE_WARP_RAD, WAVE_WARP_FREQ, WAVE_DIMPLE_RAD, WAVE_DIMPLE_S, WAVE_DIMPLE_GAIN,
  WAVE_DIMPLE_AA_LO, WAVE_DIMPLE_AA_HI,
} from './mercuryWaves';
import {
  POP_FREQ, POP_JITTER, POP_REACH, POP_REACH_RAD, POP_SCALE, POP_LIFE_S, POP_TIME, POP_P_MIN, POP_P_MAX,
  POP_DENSITY_K, POP_AMP, POP_SALTS, ROIL_LITE_FREQ, ROIL_LITE_SPEED, ROIL_LITE_AMP, ROIL_LITE_ACT,
  POP_RATE_ZOOM_EXP, POP_RATE_MAX,
} from './mercuryRoil';
import {
  R_SCENE, R_MERCURY_M, SHADOW_REACH_RAD, SHADOW_SOFT_M, SHADOW_ZONE, SHADOW_SOFT_LSB, SHADOW_BIAS_LSB,
  FALLBACK_ALBEDO, ROUGH_BOIL, SOLID_HG_ALBEDO, SPARKLE_CELLS, SPARKLE_DENSITY, SPARKLE_COS,
  SPARKLE_GAIN, EMIT_RADIUS, FRONT_EDGE, FRONT_SOFT, FRONT_NOISE_FREQ, PHASE_BLEND_K,
  EMIT_MIN_SIN, EMIT_HORIZON_SOFT, SUN_SHOULDER, AETHER_NIGHT, AETHER_DAY_LO, AETHER_DAY_HI,
  ROUGH_SOLID, SOLID_HG_SPECULAR, NIGHT_TINT, AETHER_FRINGE_LO, AETHER_FRINGE_HI, AETHER_SHOULDER, AETHER_PATH_WHITE, RAY_ALBEDO,
} from './planetLook';
import { AETHER_LOBES } from './aetherLobes';
import { HG_FRESNEL_GLSL, HG_ENV_GLSL, AETHER_SHAPE_GLSL } from './hgMirrorGlsl';
import {
  HG_MELT_K, HG_BOIL_K, T_NIGHT_FLOOR_K, T_SUNSET_K, TAU_WARM_H, TAU_COOL_H, HOURS_PER_RAD,
} from './mercuryThermal';
import { CALORIS_ANG_RAD, OVERLAY_LINE_LIN, OVERLAY_ALPHA, SUBSOLAR_TICK_PX } from './slowNoon';
import { DEM_MIN_M, DEM_MAX_M } from './mercuryMaps.generated';

// One 8-bit DEM step in true metres.
export const DEM_LSB_M = (DEM_MAX_M - DEM_MIN_M) / 255;

export const PLANET_BUILTINS = ['viewMatrix', 'projectionMatrix', 'cameraPosition'];

export const PLANET_UNIFORMS = [
  'uAlbedo', 'uDem', 'uHasMaps', 'uSunDir', 'uBodyRot', 'uSunIrr', 'uSunSinR',
  'uDemTexel', 'uTime', 'uExposure', 'uRelief', 'uNightFloor',
  'uTau', 'uHeatK', 'uSubsolarT', 'uEmitPos', 'uEmitCol', 'uSunGlint', 'uEmitGain',
  'uAethDir', 'uAethCol', 'uAetherGain', 'uAetherSinW', 'uAetherSilver',
  'uAetherEdge', 'uAetherStretch', 'uAetherCurve', 'uAetherCore',
  'uScar', 'uRayGain',
  'uSurfOn', 'uImpDir', 'uImpMode', 'uImpWave', 'uBulge', 'uRoilGain', 'uPopZoom',
  'uRoughLiquid', 'uMeniscus', 'uMeniscusW', 'uCoreR',
  'uOverlay', 'uCaloris',
  'uVisitOn', 'uVisitDir', 'uVisitA', 'uVisitB', 'uMarksOn',
];

export const PLANET_CALM_UNIFORMS = [...PLANET_UNIFORMS, 'uGlow'];

const POP_SALT_GLSL = Object.entries(POP_SALTS).map(([k, s]) => `const vec3 POP_SALT_${k.toUpperCase()} = ${v3(s)};`).join('\n');

export const PLANET_VS = /* glsl */ `in vec3 position;

uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 cameraPosition;
uniform float uCoreR;

out vec3 vWorld;

const float R_SCENE = ${glf(R_SCENE)};
const float SHAPE_MAX = ${glf(SHAPE_MAX)};

void main() {
  // Billboard at the centre plane, sized to the perspective silhouette + margin.
  float d = length(cameraPosition);
  float rb = uCoreR * (1.0 + SHAPE_MAX); // room for the moving bead (uCoreR: the live core, phase 6)
  float ext = rb * d / sqrt(max(d * d - rb * rb, 1e-4)) * 1.08;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vWorld = (right * position.x + up * position.y) * ext;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}
`;

function planetFs(q, calm = false) {
  return /* glsl */ `precision highp float;
precision highp sampler2D;

in vec3 vWorld;
layout(location = 0) out vec4 fragColor;

uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 cameraPosition;
uniform sampler2D uAlbedo;
uniform sampler2D uDem;
uniform float uHasMaps;
uniform vec3 uSunDir;
uniform mat3 uBodyRot;
uniform float uSunIrr;
uniform float uSunSinR;
uniform vec2 uDemTexel;
uniform float uTime;
uniform float uExposure;
uniform float uRelief;
uniform float uNightFloor;
uniform float uTau;
uniform float uHeatK;
uniform float uSubsolarT;
uniform vec3 uEmitPos[4];
uniform vec3 uEmitCol[4];
uniform float uSunGlint;
uniform float uEmitGain;
uniform vec3 uAethDir[${AETHER_LOBES}];
uniform vec3 uAethCol[${AETHER_LOBES}];
uniform float uAetherGain;
uniform float uAetherSinW;
uniform float uAetherSilver;
uniform float uAetherEdge;
uniform float uAetherStretch;
uniform float uAetherCurve;
uniform float uAetherCore;
uniform sampler2D uScar;
uniform float uRayGain;
uniform float uSurfOn;
uniform float uCoreR; // phase 6: the live core radius (R_SCENE except during a hyper-fling)
uniform vec3 uImpDir[${IMPULSE_SLOTS}];
uniform vec3 uImpMode[${IMPULSE_SLOTS}];
uniform vec3 uImpWave[${IMPULSE_SLOTS}];
uniform vec4 uBulge;
uniform float uRoilGain;
uniform float uPopZoom;
uniform float uRoughLiquid;
uniform float uMeniscus;
uniform float uOverlay; // slow-noon
uniform vec3 uCaloris; // slow-noon
uniform float uVisitOn; // visitors
uniform vec4 uVisitDir[${VISIT_SURF_MAX}]; // visitors
uniform vec4 uVisitA[${VISIT_SURF_MAX}]; // visitors
uniform vec4 uVisitB[${VISIT_SURF_MAX}]; // visitors
uniform float uMarksOn; // visitors
uniform float uMeniscusW;${calm ? '\nuniform vec4 uGlow;' : ''}

const float PI = 3.14159265358979;
const float TAU = 6.28318530717959;
const float HALF_PI = 1.57079632679490;
const float R_SCENE = ${glf(R_SCENE)};
const float R_MERCURY_M = ${glf(R_MERCURY_M)};
const float DEM_MIN_M = ${glf(DEM_MIN_M)};
const float DEM_MAX_M = ${glf(DEM_MAX_M)};
const int SHADOW_STEPS = ${q.shadowSteps};
const float SHADOW_REACH_RAD = ${glf(SHADOW_REACH_RAD)};
const float SHADOW_SOFT_M = ${glf(SHADOW_SOFT_M)};
const float SHADOW_ZONE = ${glf(SHADOW_ZONE)};
const float DEM_LSB_M = ${glf(DEM_LSB_M)};
const float SHADOW_SOFT_LSB = ${glf(SHADOW_SOFT_LSB)};
const float SHADOW_BIAS_LSB = ${glf(SHADOW_BIAS_LSB)};
const vec3 FALLBACK_ALBEDO = ${v3(FALLBACK_ALBEDO)};

const float HG_MELT_K = ${glf(HG_MELT_K)};
const float HG_BOIL_K = ${glf(HG_BOIL_K)};
const float T_NIGHT_FLOOR_K = ${glf(T_NIGHT_FLOOR_K)};
const float T_SUNSET_K = ${glf(T_SUNSET_K)};
const float CALORIS_ANG_RAD = ${glf(CALORIS_ANG_RAD)}; // slow-noon
const vec3 OVERLAY_LINE = ${v3(OVERLAY_LINE_LIN)}; // slow-noon
const float OVERLAY_ALPHA = ${glf(OVERLAY_ALPHA)}; // slow-noon
const float SUBSOLAR_TICK_PX = ${glf(SUBSOLAR_TICK_PX)}; // slow-noon
const float TAU_WARM_H = ${glf(TAU_WARM_H)};
const float TAU_COOL_H = ${glf(TAU_COOL_H)};
const float HOURS_PER_RAD = ${glf(HOURS_PER_RAD)};
const vec3 HG_N = ${v3(HG_N)};
const vec3 HG_K = ${v3(HG_K)};
const float MENISCUS_MAX_SIN = ${glf(MENISCUS_MAX_SIN)};
const float MENISCUS_MIN_PX = ${glf(MENISCUS_MIN_PX)};
const float MENISCUS_GRAD_FLOOR = ${glf(MENISCUS_GRAD_FLOOR)};
const float ROUGH_BOIL = ${glf(ROUGH_BOIL)};
const vec3 SOLID_HG_ALBEDO = ${v3(SOLID_HG_ALBEDO)};
const float SPARKLE_CELLS = ${glf(SPARKLE_CELLS)};
const float SPARKLE_DENSITY = ${glf(SPARKLE_DENSITY)};
const float SPARKLE_COS = ${glf(SPARKLE_COS)};
const float SPARKLE_GAIN = ${glf(SPARKLE_GAIN)};
const float EMIT_RADIUS = ${glf(EMIT_RADIUS)};
const float FRONT_EDGE = ${glf(FRONT_EDGE)};
const float FRONT_SOFT = ${glf(FRONT_SOFT)};
const float FRONT_NOISE_FREQ = ${glf(FRONT_NOISE_FREQ)};
const float PHASE_BLEND_K = ${glf(PHASE_BLEND_K)};
const float EMIT_MIN_SIN = ${glf(EMIT_MIN_SIN)};
const float EMIT_HORIZON_SOFT = ${glf(EMIT_HORIZON_SOFT)};
const float SUN_SHOULDER = ${glf(SUN_SHOULDER)};
const int AETHER_LOBES = ${AETHER_LOBES};
${AETHER_SHAPE_GLSL}
const float AETHER_NIGHT = ${glf(AETHER_NIGHT)};
const float AETHER_DAY_LO = ${glf(AETHER_DAY_LO)};
const float AETHER_DAY_HI = ${glf(AETHER_DAY_HI)};
const float ROUGH_SOLID = ${glf(ROUGH_SOLID)};
const float SOLID_HG_SPECULAR = ${glf(SOLID_HG_SPECULAR)};
const float AETHER_FRINGE_LO = ${glf(AETHER_FRINGE_LO)};
const float AETHER_FRINGE_HI = ${glf(AETHER_FRINGE_HI)};
const float AETHER_SHOULDER = ${glf(AETHER_SHOULDER)};
const float AETHER_PATH_WHITE = ${glf(AETHER_PATH_WHITE)};
const vec3 NIGHT_TINT = ${v3(NIGHT_TINT)};
const float SCAR_DEPTH_RANGE_M = ${glf(SCAR_DEPTH_RANGE_M)};
const vec3 RAY_ALBEDO = ${v3(RAY_ALBEDO)};
const int IMPULSE_SLOTS = ${calm ? 0 : q.rippleSlots};
const int SHAPE_ITERS = ${q.shapeIters};
const float SHAPE_MAX = ${glf(SHAPE_MAX)};
const float WAVE_KR = ${glf(WAVE_KR)};
const float WAVE_C_GROUP = ${glf(WAVE_C_GROUP)};
const float WAVE_SPREAD_FLOOR = ${glf(WAVE_SPREAD_FLOOR)};
const float WAVE_K_PEAK = ${glf(WAVE_K_PEAK)};
const float WAVE_SPEC_W = ${glf(WAVE_SPEC_W)};
const float WAVE_VISC_PER_S = ${glf(WAVE_VISC_PER_S)};
const float WAVE_SHARP = ${glf(WAVE_SHARP)};
const float WAVE_WARP_RAD = ${glf(WAVE_WARP_RAD)};
const float WAVE_WARP_FREQ = ${glf(WAVE_WARP_FREQ)};
const float WAVE_DIMPLE_RAD = ${glf(WAVE_DIMPLE_RAD)};
const float WAVE_DIMPLE_S = ${glf(WAVE_DIMPLE_S)};
const float WAVE_DIMPLE_GAIN = ${glf(WAVE_DIMPLE_GAIN)};
const float WAVE_DIMPLE_AA_LO = ${glf(WAVE_DIMPLE_AA_LO)};
const float WAVE_DIMPLE_AA_HI = ${glf(WAVE_DIMPLE_AA_HI)};
const float DIMPLE_NORM = 2.3316;${calm ? `\nconst float CALM_GLOW_RAD = ${glf(CALM_GLOW_RAD)};` : ''}
const float POP_FREQ = ${glf(POP_FREQ)};
const float POP_JITTER = ${glf(POP_JITTER)};
const float POP_REACH = ${glf(POP_REACH)};
const float POP_REACH_RAD = ${glf(POP_REACH_RAD)};
const float POP_SCALE = ${glf(POP_SCALE)};
const float POP_LIFE_S = ${glf(POP_LIFE_S)};
const float POP_TIME = ${glf(POP_TIME)};
const float POP_P_MIN = ${glf(POP_P_MIN)};
const float POP_P_MAX = ${glf(POP_P_MAX)};
const float POP_RATE_ZOOM_EXP = ${glf(POP_RATE_ZOOM_EXP)};
const float POP_RATE_MAX = ${glf(POP_RATE_MAX)};
const float POP_DENSITY_K = ${glf(POP_DENSITY_K)};
const float POP_AMP = ${glf(POP_AMP)};
${POP_SALT_GLSL}
const float ROIL_LITE_FREQ = ${glf(ROIL_LITE_FREQ)};
const float ROIL_LITE_SPEED = ${glf(ROIL_LITE_SPEED)};
const float ROIL_LITE_AMP = ${glf(ROIL_LITE_AMP)};
const float ROIL_LITE_ACT = ${glf(ROIL_LITE_ACT)};
const int ROIL_POPS = ${q.roil === 'pops' ? 1 : 0};
const float ROIL_MOTION = ${calm ? '0.0' : '1.0'};

// Crater depth from the scar map, true metres (scarMap.js encoding).
float scarHeightM(vec2 uv, vec2 gx, vec2 gy) {
  return (textureGrad(uScar, vec2(fract(uv.x), uv.y), gx, gy).r * 255.0 - 128.0) / 127.0 * SCAR_DEPTH_RANGE_M;
}

float heightAt(vec2 uv, vec2 gx, vec2 gy) {
  return mix(DEM_MIN_M, DEM_MAX_M, textureGrad(uDem, vec2(fract(uv.x), uv.y), gx, gy).r) + scarHeightM(uv, gx, gy);
}

// March toward the Sun over the (exaggerated) heightfield. Terrain height is
// measured against the tangent plane, so the sphere's curvature drops away
// as (xR)^2 / 2R; the sunlight ray rises as xR * tan(elevation). Softness and
// march bias scale with relief and floor at DEM quantisation steps, so the
// dither and 8-bit stepping never swamp the penumbra at high exaggeration.
float castShadow(vec2 uv, vec3 nb, vec3 Lb, float h0, float cosLat, vec3 east, vec3 north, vec2 gx, vec2 gy) {
  vec3 tdir = Lb - nb * dot(Lb, nb);
  float tl = length(tdir);
  if (tl < 1e-4) return 1.0;
  tdir /= tl;
  float tanE = dot(Lb, nb) / tl;
  vec2 duv = vec2(dot(tdir, east) / (TAU * cosLat), dot(tdir, north) / PI);
  float vis = 1.0;
  float soft = max(SHADOW_SOFT_M, SHADOW_SOFT_LSB * DEM_LSB_M) * max(uRelief, 1e-3);
  float bias = SHADOW_BIAS_LSB * DEM_LSB_M * uRelief;
  for (int k = 1; k <= SHADOW_STEPS; k++) {
    float f = float(k) / float(SHADOW_STEPS);
    float x = SHADOW_REACH_RAD * f * f;
    float hk = heightAt(uv + duv * x, gx, gy);
    float xm = x * R_MERCURY_M;
    float terrain = hk * uRelief - xm * xm / (2.0 * R_MERCURY_M);
    float ray = h0 * uRelief + xm * tanE + bias;
    vis = min(vis, smoothstep(-soft, soft, ray - terrain));
  }
  return vis;
}

// mercuryThermal.surfaceTempK, exactly.
float surfaceTempK(float mu0, float lonRel, float cosLat, float tss, float heatK) {
  float tset = T_SUNSET_K * pow(max(cosLat, 0.0), 0.25);
  float teq = tss * pow(max(mu0, 0.0), 0.25);
  float t;
  if (lonRel >= -HALF_PI && lonRel <= HALF_PI) {
    if (lonRel < 0.0) {
      float h = (lonRel + HALF_PI) * HOURS_PER_RAD;
      t = T_NIGHT_FLOOR_K + (max(teq, T_NIGHT_FLOOR_K) - T_NIGHT_FLOOR_K) * (1.0 - exp(-h / TAU_WARM_H));
    } else {
      t = max(teq, tset);
    }
  } else {
    float h = (lonRel > 0.0 ? lonRel - HALF_PI : lonRel + 3.0 * HALF_PI) * HOURS_PER_RAD;
    t = T_NIGHT_FLOOR_K + (tset - T_NIGHT_FLOOR_K) * exp(-h / TAU_COOL_H);
  }
  return t + heatK;
}
// <slow-noon>
// THE SLOW NOON (slowNoon.js): a ~1 px line where field d crosses zero, w = its per-pixel change.
float hairline(float d, float w) {
  return 1.0 - clamp(abs(d) / max(w, 1e-6), 0.0, 1.0);
}
// </slow-noon>

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

float vnoise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), u.x),
        mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),
    mix(mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), u.x),
        mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), u.x), u.y), u.z);
}

// vnoise3 with its analytic gradient: vec4(value, d/dx). Same corners, same weights.
vec4 vnoise3d(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  vec3 u = f * f * (3.0 - 2.0 * f);
  vec3 du = 6.0 * f * (1.0 - f);
  float a = hash13(i), b = hash13(i + vec3(1.0, 0.0, 0.0));
  float c = hash13(i + vec3(0.0, 1.0, 0.0)), d = hash13(i + vec3(1.0, 1.0, 0.0));
  float e = hash13(i + vec3(0.0, 0.0, 1.0)), g = hash13(i + vec3(1.0, 0.0, 1.0));
  float h = hash13(i + vec3(0.0, 1.0, 1.0)), k = hash13(i + vec3(1.0, 1.0, 1.0));
  float k1 = b - a, k2 = c - a, k3 = e - a, k4 = a - b - c + d;
  float k5 = a - c - e + h, k6 = a - b - e + g, k7 = -a + b + c - d + e - g - h + k;
  float v = a + k1 * u.x + k2 * u.y + k3 * u.z + k4 * u.x * u.y + k5 * u.y * u.z + k6 * u.z * u.x + k7 * u.x * u.y * u.z;
  return vec4(v, du * vec3(k1 + k4 * u.y + k6 * u.z + k7 * u.y * u.z,
                           k2 + k5 * u.z + k4 * u.x + k7 * u.z * u.x,
                           k3 + k6 * u.x + k5 * u.y + k7 * u.x * u.y));
}

${HG_FRESNEL_GLSL}

// mercuryMeniscus.meniscusSin, exactly: the quarter-circle rim's outward tilt at arc distance d.
float meniscusSin(float d, float w, float gain) {
  if (d < 0.0 || w <= 0.0) return 0.0;
  float u = d / w;
  return u >= 1.0 ? 0.0 : clamp(gain, 0.0, 1.0) * MENISCUS_MAX_SIN * (1.0 - u);
}

${HG_ENV_GLSL}

// Frozen Hg is still a metal: polycrystalline, so a rough and dimmer mirror of the aether, not a matte ambient
// (the matte wrap-around rendered the night hemisphere as one flat grey plate).
vec3 frozenAether(vec3 R, vec3 nW, float NoV) {
  return SOLID_HG_SPECULAR * fresnelHg(NoV) * aetherMirror(R, ROUGH_SOLID, nW);
}

// The bead (mercuryWaves.js): Legendre modes ℓ = 2, 3, 4 about each impulse
// direction, plus the spin bulge about the spin axis. x is a world-frame unit
// vector; h is a fraction of R, clamped to ±SHAPE_MAX (the quad's margin).
float P2(float m) { return 0.5 * (3.0 * m * m - 1.0); }
float P3(float m) { return 0.5 * (5.0 * m * m * m - 3.0 * m); }
float P4(float m) { float m2 = m * m; return 0.125 * (35.0 * m2 * m2 - 30.0 * m2 + 3.0); }
float dP2(float m) { return 3.0 * m; }
float dP3(float m) { return 0.5 * (15.0 * m * m - 3.0); }
float dP4(float m) { return 0.5 * (35.0 * m * m * m - 15.0 * m); }

float shapeH(vec3 x) {
  if (uSurfOn < 0.5) return 0.0;
  float h = uBulge.w * P2(dot(x, uBulge.xyz));
  for (int i = 0; i < IMPULSE_SLOTS; i++) {
    float m = dot(x, uImpDir[i]);
    h += dot(uImpMode[i], vec3(P2(m), P3(m), P4(m)));
  }
  return clamp(h, -SHAPE_MAX, SHAPE_MAX);
}

// Tangential gradient of shapeH on the unit sphere.
vec3 shapeGrad(vec3 x) {
  if (uSurfOn < 0.5) return vec3(0.0);
  float mb = dot(x, uBulge.xyz);
  vec3 g = uBulge.w * dP2(mb) * (uBulge.xyz - mb * x);
  for (int i = 0; i < IMPULSE_SLOTS; i++) {
    vec3 d = uImpDir[i];
    float m = dot(x, d);
    g += dot(uImpMode[i], vec3(dP2(m), dP3(m), dP4(m))) * (d - m * x);
  }
  return g;
}

// A wavenumber fades where its crests would fall under a few pixels (pxArc: arc per pixel here).
float bandAA(float k, float pxArc) { return smoothstep(2.5, 5.0, TAU / (k * max(pxArc, 1e-6))); }
// The snap dimple fades as its radius falls under a pixel or two (sub-pixel it only aliases into specks).
float dimpleAA(float pxArc) { return pxArc > 0.0 ? smoothstep(WAVE_DIMPLE_AA_LO, WAVE_DIMPLE_AA_HI, WAVE_DIMPLE_RAD / pxArc) : 1.0; }

// mercuryWaves.rippleSlope, exactly: a dispersive capillary train by
// stationary phase (k = K·(th / (c_g·t))², phase k·th/3), crests bunched at
// the leading edge; a log-normal spectrum; viscous damping ∝ k²; a 2nd
// harmonic for sharp troughs; a short snap dimple at the origin, weighted per impulse
// (dimple: 1 for a splash or pop, WAKE_DIMPLE_GAIN for a drag wake, via uImpWave.z).
float rippleSlope(float th, float age, float pxArc, float dimple) {
  float q = th / (WAVE_C_GROUP * age);
  float k = WAVE_KR * q * q;
  float slope = 0.0;
  if (k > 1e-3) {
    float lk = log(k / WAVE_K_PEAK) / WAVE_SPEC_W;
    float kk = k / WAVE_KR;
    float ph = k * th / 3.0;
    slope = exp(-lk * lk - WAVE_VISC_PER_S * kk * kk * age) * (bandAA(k, pxArc) * sin(ph) + 2.0 * WAVE_SHARP * bandAA(2.0 * k, pxArc) * sin(2.0 * ph));
  }
  float xd = th / WAVE_DIMPLE_RAD;
  return slope + dimple * dimpleAA(pxArc) * WAVE_DIMPLE_GAIN * exp(-age / WAVE_DIMPLE_S) * DIMPLE_NORM * xd * exp(-xd * xd);
}

// Capillary ripple trains running out from each impulse, 1/√sinθ spreading
// normalised inside WAVE_SPREAD_FLOOR; warp (a light noise on the arc
// distance) shears the rings so they never read as etched grooves. Returns
// the tangential slope to subtract from the normal. No derivatives in here (it has continue).
vec3 waveTilt(vec3 x, float pxArc, float warp) {
  vec3 g = vec3(0.0);
  if (uSurfOn < 0.5) return g;
  for (int i = 0; i < IMPULSE_SLOTS; i++) {
    float A = uImpWave[i].y;
    if (A == 0.0) continue;
    float age = max(uImpWave[i].x, 1e-3);
    vec3 d = uImpDir[i];
    float m = clamp(dot(x, d), -1.0, 1.0);
    float s = sqrt(max(1.0 - m * m, 0.0));
    if (s < 1e-4) continue;
    float th = acos(m);
    float slope = A * rippleSlope(max(th + warp, 0.0), age, pxArc, uImpWave[i].z) * sqrt(WAVE_SPREAD_FLOOR / max(s, WAVE_SPREAD_FLOOR));
    g += slope * (x * m - d) / s;
  }
  return g;
}

// mercuryRoil, exactly (phase-4 spec §6, R1, R2): the boil band as bubble-collapse pops.
float popDensity(float dT) { return dT > 0.0 ? 1.0 - exp(-dT / POP_DENSITY_K) : 0.0; }

// zoom = uPopZoom (mercuryRoil.popZoom, CPU-side from the live canvas, a uniform): a pop is the
// zoom-1 pop stretched in space, its clock unchanged, so R1 and R2 hold at every zoom.
float popSlope(float th, float age, float pxArc, float zoom) {
  float reach = POP_REACH_RAD * zoom;
  if (th >= reach || age >= POP_LIFE_S) return 0.0;
  float scale = POP_SCALE / zoom;
  float w = 1.0 - smoothstep(0.7 * reach, reach, th);
  float life = 1.0 - smoothstep(0.7 * POP_LIFE_S, POP_LIFE_S, age);
  return POP_AMP * w * life * rippleSlope(th * scale, max(age * POP_TIME, 1e-3), pxArc * scale, 1.0);
}

// Tangential slope (body frame) of every active pop within reach, plus local activity.
// No derivatives in here (it has continue).
vec3 roilTilt(vec3 xb, float t, float dT, float pxArc, float zoom, out float act) {
  act = 0.0;
  vec3 g = vec3(0.0);
  float dens = popDensity(dT);
  if (dens <= 0.0) return g;
  float freq = POP_FREQ / zoom;
  vec3 p = xb * freq;
  vec3 base = floor(p - 0.5);
  for (int i = 0; i < 8; i++) {
    vec3 c = base + vec3(float(i & 1), float((i >> 1) & 1), float((i >> 2) & 1));
    if (hash13(c + POP_SALT_ACTIVE) >= dens) continue;
    float period = (POP_P_MIN + (POP_P_MAX - POP_P_MIN) * hash13(c + POP_SALT_PERIOD)) / min(pow(zoom, POP_RATE_ZOOM_EXP), POP_RATE_MAX);
    float tc = t + hash13(c + POP_SALT_PHASE) * period;
    float age = tc - period * floor(tc / period);
    if (age >= POP_LIFE_S) continue;
    vec3 site = c + 0.5 + (vec3(hash13(c + POP_SALT_X), hash13(c + POP_SALT_Y), hash13(c + POP_SALT_Z)) - 0.5) * (2.0 * POP_JITTER);
    vec3 dv = p - site;
    float d = length(dv);
    if (d >= POP_REACH) continue;
    vec3 tang = dv - xb * dot(dv, xb);
    float tl = length(tang);
    if (tl < 1e-5) continue;
    g += popSlope(d / freq, age, pxArc, zoom) * tang / tl;
    act += (1.0 - d / POP_REACH) * exp(-3.0 * age / POP_LIFE_S);
  }
  act = min(act, 1.0);
  return g;
}

// lite tier: one octave of animated value noise, tangential; its cells fade by bandAA
// where they fall under a few pixels (they only alias there); like the pops, they grow by zoom.
vec3 roilNoiseTilt(vec3 xb, float t, float pxArc, float zoom) {
  float freq = ROIL_LITE_FREQ / zoom;
  vec3 p = xb * freq + vec3(0.0, t * ROIL_LITE_SPEED, 0.0);
  vec3 g = vec3(vnoise3(p), vnoise3(p + vec3(31.4, 0.0, 0.0)), vnoise3(p + vec3(0.0, 47.2, 0.0))) - 0.5;
  return ROIL_LITE_AMP * bandAA(TAU * freq, pxArc) * (g - xb * dot(g, xb));
}

// <visitors>
// The visitors' surface slots (visitorFrame): what an element leaves IN the liquid, drawn as part of the mirror.
// uVisitDir: world dir + kind (1 film, 2 hot clearing, 3 rock meniscus, 4 gust); uVisitA: (radius rad, p1, p2, weight);
// uVisitB: the gust's world direction. No derivatives in here (they loop with continue).
const int VISIT_SLOTS = ${calm ? 0 : q.visitSlots};
const float FILM_N = ${glf(FILM_N)};
const float FILM_A = ${glf(FILM_A)};
const float FILM_TEAR_NM = ${glf(FILM_TEAR_NM)};
const float FILM_NOISE_FREQ = ${glf(FILM_NOISE_FREQ)};
const float HOT_GAIN = ${glf(HOT_GAIN)};
const float CATSPAW_K = ${glf(CATSPAW_K)};
const float CATSPAW_AMP = ${glf(CATSPAW_AMP)};
const float CATSPAW_SPEED = ${glf(CATSPAW_SPEED)};
const float JET_DEPTH = ${glf(JET_DEPTH)};
const vec3 FROST_ALBEDO = ${v3(FROST_ALBEDO)};
const float FROST_ENV = ${glf(FROST_ENV)};
const float GLAZE_ROUGH = ${glf(GLAZE_ROUGH)};
const float POOL_RIM_H = ${glf(POOL_RIM_H)};
const vec3 EVAPORITE_ALBEDO = ${v3(EVAPORITE_ALBEDO)};
const float EVAPORITE_A = ${glf(EVAPORITE_A)};
const float EVAPORITE_EDGE = ${glf(EVAPORITE_EDGE)};
const float EVAPORITE_LIFT = ${glf(EVAPORITE_LIFT)};
const float EVAPORITE_GAIN = ${glf(EVAPORITE_GAIN)};
const vec3 EVAPORITE_TINT = EVAPORITE_ALBEDO / max(max(EVAPORITE_ALBEDO.r, EVAPORITE_ALBEDO.g), EVAPORITE_ALBEDO.b);
const float QUENCH_DARK = ${glf(QUENCH_DARK)};
const float QUENCH_ROUGH = ${glf(QUENCH_ROUGH)};
const float GLASS_F0 = ${glf(GLASS_F0)};
${VISIT_LIGHT_GLSL}

// The slope (dh/dθ) of a depression depth·exp(−((θ − c)/w)²); negate it for a raised ring.
float visDent(float th, float c, float w, float depth) {
  float u = (th - c) / max(w, 1e-4);
  return depth * 2.0 * u / max(w, 1e-4) * exp(-u * u);
}

// Tangential slope to subtract from the liquid's normal (like waveTilt).
vec3 visitTilt(vec3 x, float pxArc) {
  vec3 g = vec3(0.0);
  for (int i = 0; i < VISIT_SLOTS; i++) {
    vec4 D = uVisitDir[i];
    vec4 A = uVisitA[i];
    if (A.w <= 0.0) continue;
    float m = clamp(dot(x, D.xyz), -1.0, 1.0);
    float s = sqrt(max(1.0 - m * m, 0.0));
    if (s < 1e-4) continue;
    float th = acos(m);
    vec3 tOut = (x * m - D.xyz) / s;
    float sl = 0.0;
    if (D.w == ${glf(SURF_HOT)}) {
      // Marangoni: tension falls where it is hot, the surface flows away: a clearing, its rim pushed outward
      sl = visDent(th, 0.0, A.x, A.y) - visDent(th, A.x, 0.35 * A.x, 0.5 * A.y);
    } else if (D.w == ${glf(SURF_MENISCUS)}) {
      // a floating rock presses a meniscus ring into the liquid just outside its contact line
      sl = visDent(th, 1.15 * A.x, 0.4 * A.x, A.y);
    } else if (D.w == ${glf(SURF_POOL)}) {
      // the melt pool's meniscus: a raised lip where the liquid meets its frozen shore, gone as it refreezes
      sl = -visDent(th, A.x, 0.2 * A.x, POOL_RIM_H * (1.0 - A.y));
    } else if (D.w == ${glf(SURF_JET)}) {
      // a gust: the dent under it, cat's-paws running downwind (plan D-2: an explicit direction, not the impulse slip)
      sl = visDent(th, 0.0, A.x, A.y);
      vec3 G = uVisitB[i].xyz - x * dot(uVisitB[i].xyz, x);
      float gl = length(G);
      if (gl > 1e-4) {
        G /= gl;
        float down = smoothstep(-0.2, 0.6, dot(tOut, G));
        float ph = CATSPAW_K * dot(x, uVisitB[i].xyz) - CATSPAW_SPEED * A.z;
        float amp = CATSPAW_AMP * A.w * down * exp(-th * th / (9.0 * A.x * A.x)) * (A.y / JET_DEPTH)
          * bandAA(CATSPAW_K, pxArc) * (0.6 + 0.4 * vnoise3(x * 40.0 + D.xyz * 7.0));
        g += amp * sin(ph) * G;
      }
    }
    g += A.w * sl * tOut;
  }
  return g;
}

// The film's interference over the mirror (a factor) and the hot spots' glow (emit, linear radiance).
vec3 visitTint(vec3 x, float NoV, out vec3 emit) {
  vec3 tint = vec3(1.0);
  emit = vec3(0.0);
  for (int i = 0; i < VISIT_SLOTS; i++) {
    vec4 D = uVisitDir[i];
    vec4 A = uVisitA[i];
    if (A.w <= 0.0) continue;
    float th = acos(clamp(dot(x, D.xyz), -1.0, 1.0));
    if (D.w == ${glf(SURF_FILM)}) {
      // water WETS mercury (S ≈ +38 mN/m): a thin film, thicker at its centre, torn into lenses once it is thin
      float r = max(A.x, 1e-3);
      if (th >= r) continue;
      float u = th / r;
      float hNm = A.y * (1.0 - 0.6 * u * u);
      float tear = smoothstep(0.35, 0.65, vnoise3(x * FILM_NOISE_FREQ + D.xyz * 13.0) + 0.5 * (FILM_TEAR_NM - hNm) / FILM_TEAR_NM);
      float cov = A.w * (1.0 - smoothstep(0.8, 1.0, u)) * (1.0 - tear);
      float cosT = sqrt(max(1.0 - (1.0 - NoV * NoV) / (FILM_N * FILM_N), 0.0));
      vec3 delta = 4.0 * PI * FILM_N * hNm * cosT / vec3(650.0, 532.0, 450.0);
      tint *= mix(vec3(1.0), 1.0 - FILM_A * cos(delta), cov);
    } else if (D.w == ${glf(SURF_HOT)} || D.w == ${glf(SURF_POOL)}) {
      emit += A.w * HOT_GAIN * visGlow(A.z) * exp(-th * th / (0.36 * max(A.x * A.x, 4e-4)));
    }
  }
  return tint;
}

// The frost front creeping out (SURF_FROST): coverage on frozen Hg, its edge ragged like rime.
float visitFrost(vec3 x) {
  float cov = 0.0;
  for (int i = 0; i < VISIT_SLOTS; i++) {
    vec4 D = uVisitDir[i];
    vec4 A = uVisitA[i];
    if (A.w <= 0.0 || D.w != ${glf(SURF_FROST)}) continue;
    float th = acos(clamp(dot(x, D.xyz), -1.0, 1.0));
    float edge = max(A.x, 1e-4) * (0.75 + 0.5 * vnoise3(x * 90.0 + A.z));
    cov = max(cov, A.w * (1.0 - smoothstep(0.8 * edge, edge, th)));
  }
  return cov;
}

// The melt pool (SURF_POOL): how liquid the frozen surface is here, until it refreezes (A.y: 0 liquid -> 1 frozen).
float visitPool(vec3 x) {
  float liq = 0.0;
  for (int i = 0; i < VISIT_SLOTS; i++) {
    vec4 D = uVisitDir[i];
    vec4 A = uVisitA[i];
    if (A.w <= 0.0 || D.w != ${glf(SURF_POOL)}) continue;
    float th = acos(clamp(dot(x, D.xyz), -1.0, 1.0));
    liq = max(liq, A.w * (1.0 - A.y) * (1.0 - smoothstep(0.85 * A.x, A.x, th)));
  }
  return liq;
}

// The crust pushed up round a sinking rock (SURF_COLLAR): a slope for the crust normal, world frame.
vec3 visitCrustTilt(vec3 x) {
  vec3 g = vec3(0.0);
  for (int i = 0; i < VISIT_SLOTS; i++) {
    vec4 D = uVisitDir[i];
    vec4 A = uVisitA[i];
    if (A.w <= 0.0 || D.w != ${glf(SURF_COLLAR)}) continue;
    float m = clamp(dot(x, D.xyz), -1.0, 1.0);
    float s = sqrt(max(1.0 - m * m, 0.0));
    if (s < 1e-4) continue;
    g -= A.w * visDent(acos(m), 1.3 * A.x, 0.5 * A.x, A.y) * (x * m - D.xyz) / s;
  }
  return g;
}

// Frost and glaze on frozen Hg: the scar map's B / A (stamped, persistent) and the live frost front.
vec3 visitMarks(vec3 solid, vec2 uv, vec2 gx, vec2 gy, vec3 P, vec3 x, vec3 R, vec3 nW, float NoV, float sunLit) {
  vec2 m = uMarksOn > 0.5 ? textureGrad(uScar, uv, gx, gy).ba : vec2(0.0);
  // glaze: the refrozen pool is smoother than the polycrystalline Hg around it
  if (m.y > 0.0) {
    vec3 glazed = solid - frozenAether(R, nW, NoV) + SOLID_HG_SPECULAR * fresnelHg(NoV) * aetherMirror(R, GLAZE_ROUGH, nW);
    solid = mix(solid, glazed, m.y);
  }
  // frost: matte rime, lit by the Sun where it reaches and by the nebula and the element nodes (spec R5)
  float frost = max(m.x, visitFrost(x));
  if (frost > 0.0) {
    vec3 rime = FROST_ALBEDO * (sunLit + uNightFloor + FROST_ENV * envRadiance(nW, 1.0, P, nW));
    solid = mix(solid, rime, frost);
  }
  return solid;
}

// Amendment A: water and fire on the crust. The quench rind's profile, exactly scarMap.quenchProfile: a full core (the dark
// glassy skin), a 0.5-high plateau (the pale evaporite ring), then nothing. s = angle / radius, h jitters the outer edge.
float quenchProfile(float s, float h) {
  return 1.0 - 0.5 * smoothstep(0.55, 0.7, s) - 0.5 * smoothstep(0.95 + 0.1 * h, 1.1 + 0.1 * h, s);
}

// The quench spreading (SURF_QUENCH): the same profile at its live radius.
float visitQuench(vec3 x, vec3 xn) { // xn: the same point in the body frame, for the rind edge noise only (the slot directions are world-space)
  float q = 0.0;
  for (int i = 0; i < VISIT_SLOTS; i++) {
    vec4 D = uVisitDir[i];
    vec4 A = uVisitA[i];
    if (A.w <= 0.0 || D.w != ${glf(SURF_QUENCH)}) continue;
    float r = max(A.x, 1e-4);
    float th = acos(clamp(dot(x, D.xyz), -1.0, 1.0));
    if (th >= 1.25 * r) continue;
    q = max(q, A.w * quenchProfile(th / r, vnoise3(xn * 90.0 + A.z)));
  }
  return q;
}

// The glaze under a refreezing pool (SURF_POOL): it lies under the WHOLE pool (weight A.w, not A.w*A.y); the liquid overlay
// (weight A.w*(1-A.y), visitPool) uncovers it as the pool freezes, so the cross-fade is a clean complement, no crust dip (plan Q-3).
float visitPoolSolid(vec3 x) {
  float s = 0.0;
  for (int i = 0; i < VISIT_SLOTS; i++) {
    vec4 D = uVisitDir[i];
    vec4 A = uVisitA[i];
    if (A.w <= 0.0 || D.w != ${glf(SURF_POOL)}) continue;
    float th = acos(clamp(dot(x, D.xyz), -1.0, 1.0));
    s = max(s, A.w * (1.0 - smoothstep(0.85 * A.x, A.x, th)));
  }
  return s;
}

// The crust's marks (spec §9.3, §9.4): B = the quench rind, A = glaze (a refrozen Hg disc set in the rock, plan Q-3).
// nW: the crust's world normal; light: its Sun term (Lommel-Seeliger, terminator, shadow); sunHg: Lambert for the Hg disc.
// Each look is gated on its own coverage, so an unmarked texel pays one fetch (plan Q-4).
vec3 visitCrustMarks(vec3 col, vec2 uv, vec2 gx, vec2 gy, vec3 P, vec3 x, vec3 xn, vec3 nW, vec3 rd, float light, float sunHg) {
  vec2 m = uMarksOn > 0.5 ? textureGrad(uScar, uv, gx, gy).ba : vec2(0.0);
  // Byte B here is the quench rind; visitMarks reads the same byte as frost on frozen Hg (plan Q-6). Safe only because
  // frozen-Hg frost is dormant (spec A4) and crossMarks wipes on a state change: waking frost needs its own channel.
  float b = max(m.x, uVisitOn > 0.5 ? visitQuench(x, xn) : 0.0);
  float g = max(m.y, uVisitOn > 0.5 ? visitPoolSolid(x) : 0.0);
  if (b <= 0.0 && g <= 0.0) return col;
  vec3 R = reflect(rd, nW);
  float NoV = clamp(dot(nW, -rd), 0.0, 1.0);
  if (b > 0.0) {
    float core = smoothstep(0.7, 0.9, b);
    float ring = smoothstep(0.15 - EVAPORITE_EDGE, 0.4 + EVAPORITE_EDGE, b) * (1.0 - smoothstep(0.6 - EVAPORITE_EDGE, 0.8 + EVAPORITE_EDGE, b));
    if (core > 0.0) {
      float F = GLASS_F0 + (1.0 - GLASS_F0) * pow(1.0 - NoV, 5.0);
      col = mix(col, col * QUENCH_DARK + F * envRadiance(R, QUENCH_ROUGH, P, nW), core);
    }
    if (ring > 0.0) {
      vec3 ev = mix(EVAPORITE_ALBEDO * (light + uNightFloor + FROST_ENV * envRadiance(nW, 1.0, P, nW)), col * EVAPORITE_GAIN * EVAPORITE_TINT, EVAPORITE_LIFT);
      col = mix(col, ev, EVAPORITE_A * ring);
    }
  }
  if (g > 0.0) {
    vec3 hg = SOLID_HG_ALBEDO * (sunHg + uNightFloor) + SOLID_HG_SPECULAR * fresnelHg(NoV) * aetherMirror(R, GLAZE_ROUGH, nW);
    col = mix(col, hg, g);
  }
  return col;
}
// </visitors>
void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorld - ro);
  float b = dot(ro, rd);
  // The silhouette: the bead's radius toward the ray's closest approach
  // (exactly uCoreR when the surface is still, i.e. the phase-2 sphere at its live size).
  vec3 pc = ro - rd * b;
  float pl = length(pc);
  float rl = uCoreR * (1.0 + shapeH(pl > 1e-6 ? pc / pl : -rd));
  float disc = b * b - (dot(ro, ro) - rl * rl);
  float fw = max(fwidth(disc), 1e-6);
  float coverage = clamp(disc / fw + 0.5, 0.0, 1.0);

  // Shade the nearest point even for near-misses so derivatives stay defined
  // across the silhouette; discard only after all dFdx/dFdy calls.
  float t = -b - sqrt(max(disc, 0.0));
  vec3 hit = ro + rd * t;
  // On a moving bead, re-intersect the sphere of the local radius at the hit
  // (radial fixed point; the shape is low-order and ≤ SHAPE_MAX). Uniform branch.
  if (uSurfOn > 0.5) {
    for (int k = 0; k < SHAPE_ITERS; k++) {
      float rk = uCoreR * (1.0 + shapeH(normalize(hit)));
      t = -b - sqrt(max(b * b - (dot(ro, ro) - rk * rk), 0.0));
      hit = ro + rd * t;
    }
  }
  vec3 xw = normalize(hit);
  vec3 ng = normalize(xw - shapeGrad(xw) / (1.0 + shapeH(xw)));

  // uBodyRot is body → world (mercuryBody.q); v * M = transpose(M) * v.
  // xb: WHERE on the body (maps, front, temperature); nb: which way the surface faces (light).
  vec3 xb = xw * uBodyRot;
  vec3 nb = ng * uBodyRot;
  vec3 Lb = uSunDir * uBodyRot;
  vec3 Vb = -rd * uBodyRot;
  float lat = asin(clamp(xb.y, -1.0, 1.0));
  float lon = atan(-xb.z, xb.x);
  vec2 uv = vec2(fract(lon / TAU), 0.5 + lat / PI);

  // Seam-safe gradients: take whichever of u / u+0.5 is continuous here.
  vec2 gx = dFdx(uv), gy = dFdy(uv);
  vec2 uvS = vec2(fract(uv.x + 0.5), uv.y);
  vec2 gxS = dFdx(uvS), gyS = dFdy(uvS);
  if (abs(gxS.x) + abs(gyS.x) < abs(gx.x) + abs(gy.x)) { gx.x = gxS.x; gy.x = gyS.x; }
  float pxArc = length(fwidth(xw));
  // <slow-noon>
  // THE SLOW NOON hairlines: fields and derivatives here, in a uniform branch before the discard.
  float ovFreeze = 0.0, ovRing = 0.0, ovTick = 0.0;
  if (uOverlay > 0.0) { // slow-noon fields
    float lonSunOv = length(uSunDir.xz) > 1e-4 ? atan(-uSunDir.z, uSunDir.x) : 0.0;
    float lonRelOv = mod(atan(-xw.z, xw.x) - lonSunOv + PI, TAU) - PI;
    float tOv = surfaceTempK(dot(xb, Lb), lonRelOv, sqrt(max(1.0 - xw.y * xw.y, 0.0)), uSubsolarT, uHeatK);
    ovFreeze = hairline(tOv - HG_MELT_K, fwidth(tOv));
    float dCal = acos(clamp(dot(xb, uCaloris), -1.0, 1.0)) - CALORIS_ANG_RAD;
    ovRing = hairline(dCal, fwidth(dCal));
    vec3 eOv = normalize(vec3(uSunDir.z, 0.0, -uSunDir.x));
    float aOv = dot(xw, eOv), bOv = xw.y, armOv = SUBSOLAR_TICK_PX * pxArc;
    float faceOv = step(0.0, dot(xw, uSunDir));
    ovTick = faceOv * max(hairline(aOv, fwidth(aOv)) * step(abs(bOv), armOv),
                          hairline(bOv, fwidth(bOv)) * step(abs(aOv), armOv));
  }
  // </slow-noon>

  if (disc < -fw) discard;

  vec4 clip = projectionMatrix * viewMatrix * vec4(hit, 1.0);
  gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);

  float cosLat = max(cos(lat), 0.02);
  vec3 east = vec3(-sin(lon), 0.0, -cos(lon));
  vec3 north = vec3(-sin(lat) * cos(lon), cos(lat), sin(lat) * sin(lon));

  vec3 albedo = FALLBACK_ALBEDO;
  vec3 n = nb;
  float h0 = 0.0;
  if (uHasMaps > 0.5) {
    albedo = textureGrad(uAlbedo, uv, gx, gy).rgb;
    h0 = heightAt(uv, gx, gy);
    float hE = heightAt(uv + vec2(uDemTexel.x, 0.0), gx, gy) - heightAt(uv - vec2(uDemTexel.x, 0.0), gx, gy);
    float hN = heightAt(uv + vec2(0.0, uDemTexel.y), gx, gy) - heightAt(uv - vec2(0.0, uDemTexel.y), gx, gy);
    float distE = 2.0 * uDemTexel.x * TAU * R_MERCURY_M * cosLat;
    float distN = 2.0 * uDemTexel.y * PI * R_MERCURY_M;
    n = normalize(nb - east * (hE * uRelief / distE) - north * (hN * uRelief / distN));
  }
  if (uVisitOn > 0.5) n = normalize(n - transpose(uBodyRot) * visitCrustTilt(xw)); // visitors
  // Fresh crater rays brighten the crust; they mature back to background (scarMap.js).
  albedo = mix(albedo, RAY_ALBEDO, clamp(textureGrad(uScar, uv, gx, gy).g * uRayGain, 0.0, 1.0));

  // No atmosphere: the terminator is as soft as the Sun's disc is wide.
  float mu0g = dot(nb, Lb);
  float term = smoothstep(-uSunSinR, uSunSinR, mu0g);
  float mu0 = max(dot(n, Lb), 0.0);
  float mu = max(dot(n, Vb), 1e-3);
  float ls = 2.0 * mu0 / (mu0 + mu + 1e-4); // Lommel–Seeliger, 1 at normal incidence

  float vis = 1.0;
  if (${q.shadowSteps > 0 ? 'uHasMaps > 0.5' : 'false'} && mu0g > -uSunSinR && mu0g < SHADOW_ZONE) {
    vis = castShadow(uv, nb, Lb, h0, cosLat, east, north, gx, gy);
    vis = mix(vis, 1.0, smoothstep(0.7 * SHADOW_ZONE, SHADOW_ZONE, mu0g));
  }

  vec3 colLin = albedo * (uSunIrr * uExposure * ls * term * vis + uNightFloor);
  vec3 nWc = normalize(uBodyRot * n); // visitors
  if (uMarksOn > 0.5 || uVisitOn > 0.5) colLin = visitCrustMarks(colLin, uv, gx, gy, hit, xw, xb, nWc, rd, uSunIrr * uExposure * ls * term * vis, uSunIrr * uExposure * max(dot(nWc, uSunDir), 0.0) * term); // visitors
  float visFluid = 0.0; // visitors

  // Transmutation: the front advances from the subsolar point outward
  // (noise-edged) and retreats the same way on refreeze. Inside it the crust
  // relief flattens into fluid and the element takes its phase from the
  // local temperature: solid at night, a liquid mirror by day and into dusk,
  // boiling near noon.
  if (uTau > 0.0) {
    float mu0x = dot(xb, Lb);
    float front = 1.0 - acos(clamp(mu0x, -1.0, 1.0)) / PI;
    vec4 en = vnoise3d(xb * FRONT_NOISE_FREQ);
    float edgeN = (en.x - 0.5) * FRONT_EDGE;
    float thr = 1.0 + FRONT_EDGE - uTau * (1.0 + 2.0 * FRONT_EDGE);
    float sF = front + edgeN - thr;
    float fluidSoft = smoothstep(-FRONT_SOFT, FRONT_SOFT, sF);
    // The front field's tangential gradient (front units per radian; it points into the liquid)
    // turns sF into an arc distance from the contact line: dArc = sF / |grad|.
    vec3 gF = (Lb - xb * mu0x) / (PI * max(sqrt(max(1.0 - mu0x * mu0x, 0.0)), 1e-4))
            + (FRONT_EDGE * FRONT_NOISE_FREQ) * (en.yzw - xb * dot(en.yzw, xb));
    float gLen = max(length(gF), MENISCUS_GRAD_FLOOR);
    float dArc = sF / gLen;
    float fluidHard = clamp(dArc / max(pxArc, 1e-6) + 0.5, 0.0, 1.0);
    float fluid = max(fluidSoft, uMeniscus > 0.0 ? fluidHard : 0.0);

    if (fluid > 0.0) {
      // Local time and latitude about the rest spin axis (world Y; the rest
      // orientation is a pure yaw), not the body's own axes: a tumbled body
      // read in its own frame put sunlit metal on the night branch (a frozen cap).
      float lonSun = length(uSunDir.xz) > 1e-4 ? atan(-uSunDir.z, uSunDir.x) : 0.0;
      float lonRel = mod(atan(-xw.z, xw.x) - lonSun + PI, TAU) - PI;
      float T = surfaceTempK(mu0x, lonRel, sqrt(max(1.0 - xw.y * xw.y, 0.0)), uSubsolarT, uHeatK);
      float liquidW = smoothstep(HG_MELT_K - PHASE_BLEND_K, HG_MELT_K + PHASE_BLEND_K, T);
      if (uVisitOn > 0.5) liquidW = max(liquidW, visitPool(xw)); // visitors
      float boilW = smoothstep(HG_BOIL_K - PHASE_BLEND_K, HG_BOIL_K + PHASE_BLEND_K, T);
      // Liquid Hg on rock: a hard contact line and a bead rim; frozen Hg keeps the soft wipe.
      fluid = mix(fluidSoft, fluidHard, liquidW * clamp(uMeniscus, 0.0, 1.0));

      vec3 nB = normalize(mix(n, nb, fluid));
      float rimS = liquidW * meniscusSin(dArc, max(uMeniscusW, MENISCUS_MIN_PX * pxArc), uMeniscus);
      if (rimS > 0.0) {
        vec3 tOut = -gF + nB * dot(gF, nB);
        float tl = length(tOut);
        if (tl > 1e-6) nB = nB * sqrt(1.0 - rimS * rimS) + (tOut / tl) * rimS;
      }
      vec3 nW = uBodyRot * nB;
      float warp = WAVE_WARP_RAD * (2.0 * vnoise3(xb * WAVE_WARP_FREQ) - 1.0);
      nW = normalize(nW - fluid * waveTilt(xw, pxArc, warp));
      float popAct = 0.0;
      if (boilW > 0.0) {
        vec3 rt;
        if (ROIL_POPS == 1) rt = roilTilt(xb, uTime * ROIL_MOTION, T - HG_BOIL_K, pxArc, uPopZoom, popAct);
        else { rt = roilNoiseTilt(xb, uTime * ROIL_MOTION, pxArc, uPopZoom); popAct = ROIL_LITE_ACT; }
        nW = normalize(nW - (fluid * boilW * uRoilGain * ROIL_MOTION) * (uBodyRot * rt));
      }
      vec3 visTint = vec3(1.0), visEmit = vec3(0.0); // visitors
      if (uVisitOn > 0.5) nW = normalize(nW - fluid * visitTilt(xw, pxArc)); // visitors
      vec3 R = reflect(rd, nW);
      float NoV = clamp(dot(nW, -rd), 0.0, 1.0);
      if (uVisitOn > 0.5) visTint = visitTint(xw, NoV, visEmit); // visitors

      vec3 liquid = vec3(0.0);
      if (liquidW > 0.0) {
        liquid = fresnelHg(NoV) * envRadiance(R, mix(uRoughLiquid, ROUGH_BOIL, boilW * (0.5 + 0.5 * popAct)), hit, nW);
      }
      liquid *= visTint; // visitors

      vec3 solid = vec3(0.0);
      if (liquidW < 1.0) {
        float sunI = uSunIrr * uExposure;
        float facet = hash13(vec3(floor(uv * vec2(2.0 * SPARKLE_CELLS, SPARKLE_CELLS)), 7.0));
        float glint = step(1.0 - SPARKLE_DENSITY, facet) * smoothstep(SPARKLE_COS, 1.0, dot(R, uSunDir)) * term;
        solid = SOLID_HG_ALBEDO * (sunI * max(dot(nW, uSunDir), 0.0) * term + uNightFloor)
          + frozenAether(R, nW, NoV) + vec3(glint * SPARKLE_GAIN * sunI);
        if (uMarksOn > 0.5 || uVisitOn > 0.5) solid = visitMarks(solid, uv, gx, gy, hit, xw, R, nW, NoV, sunI * max(dot(nW, uSunDir), 0.0) * term); // visitors
      }

      colLin = mix(colLin, mix(solid, liquid, liquidW), fluid);${calm ? '\n      colLin += fluid * uGlow.w * exp(-(1.0 - dot(xw, uGlow.xyz)) / (CALM_GLOW_RAD * CALM_GLOW_RAD));' : ''}
      colLin += fluid * liquidW * visEmit; // visitors
      visFluid = fluid; // visitors
    }
  }
  if (uVisitOn > 0.5) { // visitors
    float crustPool = visitPool(xw) * (1.0 - visFluid); // visitors
    if (crustPool > 0.0) { // visitors
      vec3 nP = normalize(ng - visitTilt(xw, pxArc)); // visitors
      float NoVP = clamp(dot(nP, -rd), 0.0, 1.0); // visitors
      vec3 emitP; // visitors
      vec3 tintP = visitTint(xw, NoVP, emitP); // visitors
      colLin = mix(colLin, fresnelHg(NoVP) * envRadiance(reflect(rd, nP), uRoughLiquid, hit, nP) * tintP + emitP, crustPool); // visitors
    } // visitors
  } // visitors

  // <slow-noon>
  if (uOverlay > 0.0) { // slow-noon composite
    colLin = mix(colLin, OVERLAY_LINE, uOverlay * OVERLAY_ALPHA * max(max(ovFreeze, ovRing), ovTick));
  }
  // </slow-noon>
  vec3 col = max(colLin, 0.0);
  vec3 srgb = mix(col * 12.92, 1.055 * pow(col, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), col));
  float dith = (fract(sin(dot(gl_FragCoord.xy + fract(uTime) * 61.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  fragColor = vec4(srgb + dith, coverage);
}
`;
}

export const PLANET_FS = planetFs(TIERS.full);

// A tier is a shader variant: loop counts are compile-time consts (phase-4 spec §3).
export function buildPlanetShader({ tier = 'full', calm = false } = {}) {
  const q = TIERS[tier];
  if (!q) throw new Error(`buildPlanetShader: unknown tier "${tier}"`);
  return { vs: PLANET_VS, fs: tier === 'full' && !calm ? PLANET_FS : planetFs(q, calm) };
}

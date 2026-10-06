// src/terminal/mercury/planet/gasStreak.js — gas filaments for the element flows (mirror-sky spec §3, Option A).
//
// Two particle roles in ONE draw per flow (author, 2026-10-05). aRole 0 = fog: the flow's old round sprite,
// passed through untouched (size, shape), unmasked, alpha × uFogAlpha. It keeps the nebula's body and colour
// blending. aRole 1 = filament: a thin capsule whose WIDTH is uFilWidth CSS px × uDpr at GAS_Z_REF (perspective,
// ±25 % by a size label, floored at GAS_PX_FLOOR CSS px × uDpr). Its LENGTH (buffer px, so it follows the dpr
// too and the aspect is DPR-invariant) beyond the round core is the on-screen speed × uStreakGain (a
// shutter), capped at (aspectMax − 1) × width, both scaled by a ±FIL_JITTER per-particle jitter so dashes never
// read uniform. The alpha is lane-masked × uFilAlpha. Each flow samples its big analytic motion twice (phase now,
// and STREAK_DT of clock time earlier); calm zeroes uPhaseRate, so filaments go round. gasLane() is a ridged
// simplex in the flow's own cross-stream labels: lanes of particles travelling with the current, slowly evolving.
// Counts (spec §3e, gasCounts): fog = the old (base) count, so the tier multiplier feeds the filaments; fire keeps
// its old body count and multiplies its old ember count. gasRoles() spreads the fog slots evenly (exact, deterministic).
// Needs uViewportPx (PLANET_WINDOW_VS) and the flow's snoise(vec3) declared before GAS_STREAK_VS.

import { glf } from '../../gl/glf';

export const STREAK_DT = 1 / 30;
export const FIL_ASPECT = 8;          // filament length cap (× width), author 2026-10-05 (was 3)
export const FIL_JITTER = 0.3;        // ± per-particle length jitter (cap included)
export const FIRE_EMBER_STRETCH = 1.5;
export const FIRE_EMBER_GAIN = 20;    // fire embers: the old 0.006–0.018 alpha was sized for big overlapping discs
export const FIRE_EMBER_SHARE = 0.15;  // the old fire: 85 % body, 15 % embers
export const GAS_PX_FLOOR = 1.5;      // CSS px (× uDpr): filaments never go sub-pixel (fog keeps its old size, unfloored)
export const GAS_Z_REF = 4.43;        // fitted desktop camera distance (look probe 1600×1000): uFilWidth is CSS px here
export const MASK_EVOLVE = 0.03;

// Particle counts for one flow (spec §3e): `base` = its old count (params.density or GHOST_DENSITY), `mult` = the
// tier's gasDensity (1 for ghosts). Fog = the old count; the multiplier feeds the filaments. Fire: body = the old
// body count, embers = the old ember count × mult (written so that n = base exactly at ×1).
export function gasCounts(base, mult, fire = false) {
  if (fire) {
    const oldEmbers = Math.round(base * FIRE_EMBER_SHARE);
    const fog = base - oldEmbers;
    return { n: fog + Math.round(base * FIRE_EMBER_SHARE * mult), fog };
  }
  return { n: Math.round(base * mult), fog: base };
}

// Per-particle role (0 fog / 1 filament): exactly nFog fog slots, evenly spread (Bresenham), deterministic.
export function gasRoles(count, nFog) {
  const roles = new Float32Array(count);
  for (let i = 0; i < count; i++) roles[i] = Math.floor(((i + 1) * nFog) / count) > Math.floor((i * nFog) / count) ? 0 : 1;
  return roles;
}

export const GAS_STREAK_VS = /* glsl */ `
uniform float uPhaseRate;
uniform float uStreakGain;
uniform float uFilWidth;
uniform float uFilAlpha;
uniform float uFogAlpha;
uniform float uMaskFreq;
uniform float uMaskSharp;
uniform float uMaskDepth;
uniform float uDpr;
varying vec2 vStreakDir;
varying vec2 vStreakCap;
varying float vLane;
varying float vRole;
const float STREAK_DT = ${glf(STREAK_DT)};
const float FIL_ASPECT = ${glf(FIL_ASPECT)};
const float FIL_JITTER = ${glf(FIL_JITTER)};
const float FIRE_EMBER_STRETCH = ${glf(FIRE_EMBER_STRETCH)};
const float FIRE_EMBER_GAIN = ${glf(FIRE_EMBER_GAIN)};
const float GAS_PX_FLOOR = ${glf(GAS_PX_FLOOR)};
const float GAS_Z_REF = ${glf(GAS_Z_REF)};
const float MASK_EVOLVE = ${glf(MASK_EVOLVE)};

float gasHash(float a, float b) {
  return fract(sin(a * 91.7 + b * 47.3) * 43758.5453);
}

float gasFilWidth(float depth, float s01, float bite) {
  return uFilWidth * uDpr * (GAS_Z_REF / max(depth, 0.5)) * mix(0.75, 1.25, s01) * bite;
}

float gasSprite(vec4 clipNow, vec4 clipPrev, float role, float size, float aspectMax, float jit) {
  vRole = role;
  if (role < 0.5) {
    vStreakDir = vec2(1.0, 0.0);
    vStreakCap = vec2(0.0, 0.5);
    return size;
  }
  float w = max(size, GAS_PX_FLOOR * uDpr);
  vec2 v = vec2(0.0);
  if (clipNow.w > 1e-4 && clipPrev.w > 1e-4) {
    v = (clipNow.xy / clipNow.w - clipPrev.xy / clipPrev.w) * 0.5 * uViewportPx / STREAK_DT;
  }
  float sp = length(v);
  float L = min(sp * uStreakGain, max(aspectMax - 1.0, 0.0) * w) * (1.0 + FIL_JITTER * (2.0 * jit - 1.0));
  float total = w + L;
  vStreakDir = sp > 1e-3 ? vec2(v.x, -v.y) / sp : vec2(1.0, 0.0);
  vStreakCap = vec2(0.5 * L / total, 0.5 * w / total);
  return total;
}

float gasLane(vec3 laneCoord, float t) {
  float n = snoise(laneCoord * uMaskFreq + vec3(0.0, 0.0, t * MASK_EVOLVE));
  return mix(1.0, pow(max(1.0 - abs(n), 0.0), uMaskSharp), uMaskDepth);
}

float gasAlpha(float role, vec3 laneCoord, float t) {
  if (role < 0.5) return uFogAlpha;
  return gasLane(laneCoord, t) * uFilAlpha;
}

float gasRoleAlpha(float role) {
  return role < 0.5 ? uFogAlpha : uFilAlpha;
}
`;

export const GAS_STREAK_FS = /* glsl */ `
varying vec2 vStreakDir;
varying vec2 vStreakCap;
varying float vLane;
varying float vRole;
uniform float uPremult;
float gasStreakDist(vec2 pc) {
  vec2 q = pc - 0.5;
  float a = clamp(dot(q, vStreakDir), -vStreakCap.x, vStreakCap.x);
  return length(q - vStreakDir * a) / vStreakCap.y;
}
// Output for a flow drawn with premultiplied blending (One / OneMinusSrcAlpha), Task 7c. a = the alpha without dither.
// uPremult 0 (standalone pages, additive/normal blending): the old output. Premultiplied: fog = color * A, A (= normal
// blending numerically); filament = color * a, alpha 0 (pure additive: adds light, never darkens the fog behind it).
vec4 gasOut(vec3 color, float a, float dither) {
  if (uPremult < 0.5) return vec4(color, a + dither);
  if (vRole < 0.5) return vec4(color * (a + dither), a + dither);
  return vec4(color * a + dither, 0.0);
}
`;

const GAS_TUNE = [['uStreakGain', 'streakGain'], ['uFilWidth', 'filWidth'], ['uFilAlpha', 'filAlpha'],
  ['uFogAlpha', 'fogAlpha'], ['uMaskFreq', 'maskFreq'], ['uMaskSharp', 'maskSharp'], ['uMaskDepth', 'maskDepth']];

export function GAS_TUNE_UNIFORMS(tune) {
  return { ...Object.fromEntries(GAS_TUNE.map(([u, k]) => [u, { value: tune[k] }])), uDpr: { value: 1 } };
}

// Per frame: the knobs + the renderer's pixel ratio (state.gl.getPixelRatio()), no allocation.
export function writeGasTune(uniforms, tune, dpr = 1) {
  for (let i = 0; i < GAS_TUNE.length; i++) uniforms[GAS_TUNE[i][0]].value = tune[GAS_TUNE[i][1]];
  uniforms.uDpr.value = dpr;
}

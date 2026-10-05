// src/terminal/mercury/planet/gasStreak.js — gas filaments for the element flows (mirror-sky spec §3).
//
// Velocity-aligned capsules. Each flow evaluates its big analytic motion twice: at the clock's phase now and
// STREAK_DT of clock time earlier (phase − STREAK_DT · uPhaseRate). gasStreak() turns the two clip positions into
// the on-screen velocity and stretches the round sprite along it, by speed × uStreakGain (a shutter), at most
// (stretchMax − 1) × its size. Calm zeroes uPhaseRate, so the sprites go round. gasStreakDist() is the capsule's
// normalised distance (0 on the axis, 1 at the rim); with no streak it equals the old round radius, so each
// element keeps its own falloff profile. gasLane(): a ridged simplex in the flow's own cross-stream labels, so
// carved regions are lanes of particles (filaments) travelling with the current, slowly evolving (never a lattice).
// Needs uViewportPx (PLANET_WINDOW_VS) and the flow's snoise(vec3) declared before GAS_STREAK_VS.

import { glf } from '../../gl/glf';

export const STREAK_DT = 1 / 30;
export const STRETCH_MAX = 3;
export const FIRE_EMBER_STRETCH = 1.5;
export const GAS_PX_FLOOR = 1.5;
export const MASK_EVOLVE = 0.03;

export const GAS_STREAK_VS = /* glsl */ `
uniform float uPhaseRate;
uniform float uStreakGain;
uniform float uGasSize;
uniform float uGasAlpha;
uniform float uMaskFreq;
uniform float uMaskSharp;
uniform float uMaskDepth;
varying vec2 vStreakDir;
varying vec2 vStreakCap;
varying float vLane;
const float STREAK_DT = ${glf(STREAK_DT)};
const float STRETCH_MAX = ${glf(STRETCH_MAX)};
const float FIRE_EMBER_STRETCH = ${glf(FIRE_EMBER_STRETCH)};
const float GAS_PX_FLOOR = ${glf(GAS_PX_FLOOR)};
const float MASK_EVOLVE = ${glf(MASK_EVOLVE)};

float gasStreak(vec4 clipNow, vec4 clipPrev, float size, float stretchMax) {
  size = max(size, GAS_PX_FLOOR);
  vec2 v = vec2(0.0);
  if (clipNow.w > 1e-4 && clipPrev.w > 1e-4) {
    v = (clipNow.xy / clipNow.w - clipPrev.xy / clipPrev.w) * 0.5 * uViewportPx / STREAK_DT;
  }
  float sp = length(v);
  float L = min(sp * uStreakGain, max(stretchMax - 1.0, 0.0) * size);
  float total = size + L;
  vStreakDir = sp > 1e-3 ? vec2(v.x, -v.y) / sp : vec2(1.0, 0.0);
  vStreakCap = vec2(0.5 * L / total, 0.5 * size / total);
  return total;
}

float gasLane(vec3 laneCoord, float t) {
  float n = snoise(laneCoord * uMaskFreq + vec3(0.0, 0.0, t * MASK_EVOLVE));
  return mix(1.0, pow(max(1.0 - abs(n), 0.0), uMaskSharp), uMaskDepth);
}
`;

export const GAS_STREAK_FS = /* glsl */ `
varying vec2 vStreakDir;
varying vec2 vStreakCap;
varying float vLane;
float gasStreakDist(vec2 pc) {
  vec2 q = pc - 0.5;
  float a = clamp(dot(q, vStreakDir), -vStreakCap.x, vStreakCap.x);
  return length(q - vStreakDir * a) / vStreakCap.y;
}
`;

const GAS_TUNE = [['uStreakGain', 'streakGain'], ['uGasSize', 'gasSize'], ['uGasAlpha', 'gasAlpha'],
  ['uMaskFreq', 'maskFreq'], ['uMaskSharp', 'maskSharp'], ['uMaskDepth', 'maskDepth']];

export function GAS_TUNE_UNIFORMS(tune) {
  return Object.fromEntries(GAS_TUNE.map(([u, k]) => [u, { value: tune[k] }]));
}

export function writeGasTune(uniforms, tune) {
  for (let i = 0; i < GAS_TUNE.length; i++) uniforms[GAS_TUNE[i][0]].value = tune[GAS_TUNE[i][1]];
}

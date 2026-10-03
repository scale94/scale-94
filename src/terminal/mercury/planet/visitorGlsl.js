// src/terminal/mercury/planet/visitorGlsl.js — GLSL shared by the planet's surface slots and the visitors' body pass.
// visitorSim.planckRGB / glowRGB, exactly (tested there; the constants here are interpolated from it).

import { glf } from '../../gl/glf';
import { PLANCK_C2_NM_K, PLANCK_REF_K, GLOW_EXPO } from './visitorSim';

export const PLANCK_REF = Math.exp(PLANCK_C2_NM_K / (650 * PLANCK_REF_K)) - 1;

export const VISIT_LIGHT_GLSL = `// Blackbody at 650 / 532 / 450 nm, red = 1 at ${PLANCK_REF_K} K; the exponent clamps at 80 (a cool spot underflows to 0).
const float PLANCK_C2_NM_K = ${glf(PLANCK_C2_NM_K)};
const float PLANCK_REF = ${glf(PLANCK_REF)};
const float GLOW_EXPO = ${glf(GLOW_EXPO)};
vec3 visPlanck(float tK) {
  vec3 lam = vec3(650.0, 532.0, 450.0);
  vec3 x = min(PLANCK_C2_NM_K / (lam * max(tK, 1.0)), vec3(80.0));
  return pow(vec3(650.0) / lam, vec3(5.0)) / (exp(x) - 1.0) * PLANCK_REF;
}
// Its hue, brightness saturated: 700 K black, 900 K dull red, 1300 K full.
vec3 visGlow(float tK) {
  vec3 b = visPlanck(tK);
  return b / max(b.r, 1e-12) * (1.0 - exp(-b.r * GLOW_EXPO));
}`;

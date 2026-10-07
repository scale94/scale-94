// src/terminal/mercury/planet/aetherSky.js — what the liquid mirror sees around it (mirror-sky spec §2).
//
// One procedural sky per element, the author-approved looks of 2026-10-05 (companion mirror-sky-v5): water's
// curling filaments, fire's rising self-lit tongues, earth's settling grainy dust with rare sharp Sun pings,
// air's contra-rotating streamlines. A dim, cold sky: black space dominates, the element shows as fine structure.
// Each moves at its gas's pace: every advected term reads its element's phase from the shared aether clock
// (uSkyPhase, aetherClock.js) and is sampled at MINUS the advected offset, so the pattern travels WITH the gas.
// Internal motion (warp, flicker, tumble) reads the calm-gated clock time uSkyT.
// Roughness drops octaves (dropped octaves contribute their mean) and, from SKY_ROUGH_FLAT, the sky is just its
// element's mean radiance: the frost and evaporite ambient lookups (rough 1) and the polycrystalline crust cost
// ~nothing. Every helper is sky-prefixed: this chunk lands in four shaders that define their own noise.
// Needs (declared by HG_MIRROR_DECLS_GLSL): uSkyT, uSkyPhase, uSkyW, uNeutralSky, uSunDir.

import { glf, v3 } from '../../gl/glf';
import { FLUID_SKY_RAD, AIR_SKY_RAD, AIR_LOWER_DIR, FIRE_SKY_RISE, EARTH_SKY_SINK } from './aetherClock';

export const SKY_OCTAVES = 5;
export const SKY_ROUGH_SHARP = 0.15; // ≤ this: full detail (liquid 0.14, glaze 0.1, quench 0.15)
export const SKY_ROUGH_FLAT = 0.6;   // ≥ this: the element's mean radiance, no noise
export const SKY_W_MIN = 0.004;      // a weight below this is not evaluated
export const SKY_PING_EXP = 250;     // earth ping lobe sharpness (approved cadence: 1–2 concurrent pings)
export const SKY_PING_GAIN = 10;
export const AIR_SHEAR_BAND = 0.12;   // R.y half-width of the equatorial cross-fade between the two rigid air layers
// Neutral sky (neutral-state Task 7): what the resting mirror sees when no element's sky is up. Colourless,
// dim graphite (same order as the element skies' means), a soft horizon-bright band, large slow cloud.
export const NEUTRAL_SKY_LUM = 0.03;
export const NEUTRAL_SKY_FLOOR = 0.35;
export const NEUTRAL_SKY_DRIFT = 0.02; // rad per sky-clock second (uSkyT is calm-gated: calm freezes it)
// Analytic mean: cloud mean ≈ 1 (skyFbm mean 0.5, ×2); band mean 0.55 + 0.45 × (mean of 1-|y| over the sphere = 0.5).
const NEUTRAL_BAND_MEAN = 0.55 + 0.45 * (1 - 0.5);
const NEUTRAL_MEAN = NEUTRAL_SKY_LUM * (NEUTRAL_SKY_FLOOR + (1 - NEUTRAL_SKY_FLOOR) * NEUTRAL_BAND_MEAN);
// Mean radiance of each sky over all directions (linear), the value a fully rough mirror sees. Measured 2026-10-05
// (plan Task 5, .superpowers/sdd/tools/ms-mean.mjs): 128x64 equirect RGBA32F, cos-latitude weighted, rough 0,
// 5 clock samples (t 0/7/19/31/53 s at speed 0.1, orbitalSpeed 1.2). Re-measure if a sky function changes.
export const SKY_MEAN = Object.freeze({
  fluid: [0.01702, 0.01989, 0.03736],
  thermal: [0.02917, 0.009297, 0.001092],
  earth: [0.008526, 0.005284, 0.00242],
  air: [0.005919, 0.008179, 0.01055],
  neutral: [NEUTRAL_MEAN, NEUTRAL_MEAN, NEUTRAL_MEAN], // analytic, not measured (see NEUTRAL_MEAN)
});

export const AETHER_SKY_GLSL = /* glsl */ `// ── aether sky (aetherSky.js) ──
const int SKY_OCTAVES = ${SKY_OCTAVES};
const float FLUID_SKY_RAD = ${glf(FLUID_SKY_RAD)};
const float AIR_SKY_RAD = ${glf(AIR_SKY_RAD)};
const float AIR_LOWER_DIR = ${glf(AIR_LOWER_DIR)};
const float AIR_SHEAR_BAND = ${glf(AIR_SHEAR_BAND)};
const float FIRE_SKY_RISE = ${glf(FIRE_SKY_RISE)};
const float EARTH_SKY_SINK = ${glf(EARTH_SKY_SINK)};
const float SKY_ROUGH_SHARP = ${glf(SKY_ROUGH_SHARP)};
const float SKY_ROUGH_FLAT = ${glf(SKY_ROUGH_FLAT)};
const float SKY_W_MIN = ${glf(SKY_W_MIN)};
const float SKY_PING_EXP = ${glf(SKY_PING_EXP)};
const float SKY_PING_GAIN = ${glf(SKY_PING_GAIN)};
const vec3 SKY_MEAN_FLUID = ${v3(SKY_MEAN.fluid)};
const vec3 SKY_MEAN_THERMAL = ${v3(SKY_MEAN.thermal)};
const vec3 SKY_MEAN_EARTH = ${v3(SKY_MEAN.earth)};
const vec3 SKY_MEAN_AIR = ${v3(SKY_MEAN.air)};
const float NEUTRAL_SKY_LUM = ${glf(NEUTRAL_SKY_LUM)};
const float NEUTRAL_SKY_FLOOR = ${glf(NEUTRAL_SKY_FLOOR)};
const float NEUTRAL_SKY_DRIFT = ${glf(NEUTRAL_SKY_DRIFT)};
const vec3 SKY_MEAN_NEUTRAL = ${v3(SKY_MEAN.neutral)};

float skyHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float skyNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(skyHash(i), skyHash(i + vec3(1, 0, 0)), f.x), mix(skyHash(i + vec3(0, 1, 0)), skyHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(skyHash(i + vec3(0, 0, 1)), skyHash(i + vec3(1, 0, 1)), f.x), mix(skyHash(i + vec3(0, 1, 1)), skyHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
// fBm on an octave budget nOct (float): octaves past it contribute their mean, so a rougher mirror keeps the
// same brightness with less detail.
float skyFbm(vec3 p, float nOct) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < SKY_OCTAVES; i++) {
    float w = clamp(nOct - float(i), 0.0, 1.0);
    s += a * (w > 0.0 ? mix(0.5, skyNoise(p), w) : 0.5);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}
vec3 skyRotZ(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(c * v.x - s * v.y, s * v.x + c * v.y, v.z); }
vec3 skyRotY(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z); }

// Water: curling filaments and folding sheets, forward-scattering (brighter toward the Sun). The knot's axis is +Z.
vec3 skyFluid(vec3 R, float nOct) {
  float t = uSkyT;
  vec3 q = skyRotZ(R, -FLUID_SKY_RAD * uSkyPhase.x) * 2.2;
  vec3 w = vec3(skyFbm(q + vec3(0.0, 0.0, t * 0.15), nOct), skyFbm(q + vec3(5.2, 1.3, -t * 0.12), nOct), skyFbm(q + vec3(2.1, 7.7, t * 0.1), nOct));
  float n = skyFbm(q * 1.1 + 1.8 * w, nOct);
  float ridge = pow(1.0 - abs(n * 2.0 - 1.0), 9.0);
  float sheet = smoothstep(0.40, 0.75, skyFbm(q * 0.6 + w * 1.2 + vec3(0.0, t * 0.05, 0.0), nOct));
  vec3 col = mix(vec3(0.22, 0.55, 0.78), vec3(0.52, 0.32, 0.85), smoothstep(0.3, 0.7, w.x));
  float fwd = 0.35 + 1.4 * pow(max(dot(R, uSunDir), 0.0), 3.0);
  return col * (ridge * 0.12 + sheet * ridge * 1.5 + sheet * 0.02) * fwd * 0.55;
}

// Fire: self-lit tongues rooted low, rising at the flame's own pace, flickering; blackbody ramp; ignores the Sun.
vec3 skyThermal(vec3 R, float nOct) {
  float t = uSkyT;
  float flick = 0.85 + 0.15 * skyNoise(vec3(t * 6.0, 0.0, 0.0));
  vec3 q = vec3(R.x * 3.2, (R.y - FIRE_SKY_RISE * uSkyPhase.y) * 1.3, R.z * 3.2);
  vec3 w = vec3(skyFbm(q * 0.8 + vec3(t * 0.3, 0.0, 0.0), nOct), skyFbm(q * 0.8 + vec3(3.0, t * 0.2, 1.0), nOct), 0.0);
  float n = skyFbm(q + vec3(w.xy * 1.5, 0.0), nOct);
  float base = smoothstep(0.55, -0.7, R.y);
  float tg = smoothstep(0.42 + 0.35 * (1.0 - base), 0.92, n) * flick;
  vec3 ember = vec3(0.45, 0.05, 0.0), orange = vec3(1.0, 0.38, 0.04), yellow = vec3(1.0, 0.82, 0.45);
  vec3 c = mix(ember, orange, smoothstep(0.0, 0.5, tg));
  c = mix(c, yellow, smoothstep(0.5, 1.0, tg));
  return c * tg * (0.25 + 0.9 * base) * 0.9;
}

// Earth: dim ochre haze + sparse grains settling at the sediment's pace, backscattering (brightest opposite the
// Sun); each grain a tumbling facet that rarely flashes a sharp Sun ping on the sunward, haze-dark side.
// The tumble phase is t × a constant per-grain rate: integrated by construction; calm freezes t.
vec3 skyEarth(vec3 R, float nOct, float k) {
  float t = uSkyT;
  vec3 Rs = R + vec3(0.0, EARTH_SKY_SINK * uSkyPhase.z, 0.0);
  vec3 q = Rs * 3.0;
  float haze = smoothstep(0.35, 0.85, skyFbm(q + skyFbm(q * 1.5, nOct) * 0.8, nOct));
  vec3 g = Rs * 70.0;
  vec3 gi = floor(g);
  float hh = skyHash(gi);
  float isGrain = step(0.93, hh);
  float dg = length(fract(g) - 0.5);
  float grain = isGrain * smoothstep(0.45, 0.0, dg) * (0.6 + 0.4 * sin(t * 1.3 + hh * 40.0));
  float opp = 0.25 + 1.6 * pow(max(dot(R, -uSunDir), 0.0), 4.0);
  float h2 = skyHash(gi + 17.0), h3 = skyHash(gi + 41.0), h4 = skyHash(gi + 73.0);
  vec3 m = normalize(vec3(sin(t * (0.7 + h2) + h3 * 40.0), sin(t * (0.5 + h3) + h4 * 40.0), sin(t * (0.6 + h4) + h2 * 40.0)));
  vec3 hv = normalize(uSunDir - R);
  float spec = pow(max(dot(m, hv), 0.0), SKY_PING_EXP);
  float sunward = smoothstep(-0.3, 0.5, dot(R, uSunDir));
  float dc = length(g - normalize(gi + 0.5) * length(g));
  float core = smoothstep(0.55, 0.0, dc);
  vec3 ping = vec3(1.0, 0.93, 0.78) * spec * core * sunward * isGrain * SKY_PING_GAIN * (1.0 - smoothstep(0.0, 0.15, k));
  return vec3(0.78, 0.47, 0.20) * (haze * 0.10 + grain * 0.9) * opp + ping;
}

// Air: thin fast streamlines along the orbit, the upper layer one way, the lower AIR_LOWER_DIR the other;
// Rayleigh-weighted.
vec3 skyAirLayer(vec3 R, float ph, float s, float nOct) {
  vec3 q = vec3(cos(ph) * 1.2, sin(ph) * 1.2, R.y * 8.0);
  float n = skyFbm(q + vec3(0.0, 0.0, skyFbm(q * 0.5, nOct) * 2.0), nOct);
  float lines = pow(1.0 - abs(n * 2.0 - 1.0), 18.0);
  float gust = smoothstep(0.45, 0.8, skyFbm(vec3(cos(ph + 0.6 * s) * 0.9, sin(ph + 0.6 * s) * 0.9, R.y * 2.0) + 4.0, nOct));
  float band = smoothstep(0.95, 0.2, abs(R.y));
  float mu = dot(R, uSunDir);
  return vec3(0.55, 0.76, 0.98) * lines * gust * band * (0.5 + 0.5 * (1.0 + mu * mu)) * 0.6;
}

vec3 skyAir(vec3 R, float nOct) {
  float az = atan(R.z, R.x);
  float spin = AIR_SKY_RAD * uSkyPhase.w;
  // Each hemisphere turns rigidly (upper +1, lower AIR_LOWER_DIR); a sheared single field would wind up without bound.
  float wUp = smoothstep(-AIR_SHEAR_BAND, AIR_SHEAR_BAND, R.y);
  vec3 c = vec3(0.0);
  if (wUp > 0.001) c += wUp * skyAirLayer(R, az - spin, 1.0, nOct);
  if (wUp < 0.999) c += (1.0 - wUp) * skyAirLayer(R, az - spin * AIR_LOWER_DIR, -1.0, nOct);
  return c;
}

// Neutral (resting mirror): colourless graphite/silver, a soft horizon-bright studio band so the limb reads
// metallic, large soft cloud drifting very slowly on the calm-gated sky clock; at most 3 octaves.
vec3 skyNeutral(vec3 R, float nOct) {
  float band = 0.55 + 0.45 * (1.0 - abs(R.y));
  float cloud = skyFbm(skyRotY(R, NEUTRAL_SKY_DRIFT * uSkyT) * 1.3 + vec3(0.0, uSkyT * NEUTRAL_SKY_DRIFT * 0.5, 0.0), min(nOct, 3.0)) * 2.0;
  float L = NEUTRAL_SKY_LUM * (NEUTRAL_SKY_FLOOR + (1.0 - NEUTRAL_SKY_FLOOR) * band * cloud);
  return vec3(L);
}

// The active element's sky (two during a switch), in a mirror of roughness rough; the neutral sky fills
// whatever weight the element skies leave (full in neutral, zero once an element's sky is at full weight).
vec3 aetherSky(vec3 R, float rough) {
  float k = smoothstep(SKY_ROUGH_SHARP, SKY_ROUGH_FLAT, rough);
  float wN = uNeutralSky * clamp(1.0 - (uSkyW.x + uSkyW.y + uSkyW.z + uSkyW.w), 0.0, 1.0);
  vec3 mean = uSkyW.x * SKY_MEAN_FLUID + uSkyW.y * SKY_MEAN_THERMAL + uSkyW.z * SKY_MEAN_EARTH + uSkyW.w * SKY_MEAN_AIR;
  mean += wN * SKY_MEAN_NEUTRAL;
  if (k >= 1.0) return mean;
  float nOct = mix(float(SKY_OCTAVES), 1.0, k);
  vec3 s = vec3(0.0);
  if (uSkyW.x > SKY_W_MIN) s += uSkyW.x * skyFluid(R, nOct);
  if (uSkyW.y > SKY_W_MIN) s += uSkyW.y * skyThermal(R, nOct);
  if (uSkyW.z > SKY_W_MIN) s += uSkyW.z * skyEarth(R, nOct, k);
  if (uSkyW.w > SKY_W_MIN) s += uSkyW.w * skyAir(R, nOct);
  if (wN > SKY_W_MIN) s += wN * skyNeutral(R, nOct);
  return mix(s, mean, k);
}`;

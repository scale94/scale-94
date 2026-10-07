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
// Needs (declared by HG_MIRROR_DECLS_GLSL): uSkyT, uSkyPhase, uSkyW, uNeutralSky, uAirSkyLat, uAirSkyWarp, uSunDir.

import { glf, v3 } from '../../gl/glf';
import { FLUID_SKY_RAD, AIR_SKY_RAD, AIR_LOWER_DIR, FIRE_SKY_RISE, EARTH_SKY_SINK } from './aetherClock';

export const SKY_OCTAVES = 5;
export const SKY_ROUGH_SHARP = 0.15; // ≤ this: full detail (liquid 0.14, glaze 0.1, quench 0.15)
export const SKY_ROUGH_FLAT = 0.6;   // ≥ this: the element's mean radiance, no noise
export const SKY_W_MIN = 0.004;      // a weight below this is not evaluated
export const SKY_PING_EXP = 250;     // earth ping lobe sharpness (approved cadence: 1–2 concurrent pings)
export const SKY_PING_GAIN = 10;
export const AIR_SHEAR_BAND = 0.25;   // R.y half-width of the equatorial cross-fade between the two rigid air layers (soft threads §5: was 0.12)
export const AIR_SKY_LINE_POW = 10;   // air streak ridge power (was 18: hard ruled lines)
export const AIR_SKY_ENV_POW = 1.5;   // air envelope (1 - y²)^k: smooth to the poles, no plateau
export const AIR_SKY_WARP_Y = 0.15;   // air latitude warp (the angle warp is the live knob uAirSkyWarp)
// Neutral sky (neutral-state Task 7, rebuilt 2026-10-07 as option B): what the resting mirror sees when no element's
// sky is up. A low-contrast cloud made the 0.14-rough liquid read as a matte grey ball (a mirror of a flat sky looks
// diffuse), so this is a studio: deep-space black, a thin bright horizon line, three soft-edged light strips turning
// slowly together on the calm-gated sky clock. Colourless.
export const NEUTRAL_SKY_FLOOR = 0.004;    // deep-space baseline
export const NEUTRAL_HORIZON_LUM = 0.35;   // horizon line peak
export const NEUTRAL_HORIZON_W = 0.025;    // horizon Gaussian width in R.y
export const NEUTRAL_STRIP_LUM = 0.3;      // strip plateau
export const NEUTRAL_STRIP_AZ = Object.freeze([0, 2.25, 4.05]); // strip centres (rad); uneven so the rig never looks tiled
export const NEUTRAL_STRIP_HW = 0.14;      // strip half-width in azimuth (rad)
export const NEUTRAL_STRIP_SOFT = 0.06;    // azimuth edge softness (rad)
export const NEUTRAL_STRIP_Y0 = -0.15;     // strip lower end (R.y)
export const NEUTRAL_STRIP_Y1 = 0.6;       // strip upper end (R.y)
export const NEUTRAL_STRIP_YSOFT = 0.12;   // end softness (R.y)
export const NEUTRAL_SKY_DRIFT = 0.02;     // rad per sky-clock second (uSkyT is calm-gated: calm freezes it)
// Analytic mean over the sphere (uniform in R.y): a symmetric smoothstep window integrates to its nominal width, and
// the strips never overlap (rigid rig, gaps > 2 × soft), so: floor + horizon (w√π/2; erf(1/w) = 1) + 3 strips.
const NEUTRAL_MEAN = NEUTRAL_SKY_FLOOR
  + NEUTRAL_HORIZON_LUM * NEUTRAL_HORIZON_W * Math.sqrt(Math.PI) / 2
  + NEUTRAL_STRIP_AZ.length * NEUTRAL_STRIP_LUM * (2 * NEUTRAL_STRIP_HW / (2 * Math.PI)) * ((NEUTRAL_STRIP_Y1 - NEUTRAL_STRIP_Y0) / 2);
// Mean radiance of each sky over all directions (linear), the value a fully rough mirror sees. Measured 2026-10-05 (air re-measured 2026-10-07, soft threads)
// (plan Task 5, .superpowers/sdd/tools/ms-mean.mjs): 128x64 equirect RGBA32F, cos-latitude weighted, rough 0,
// 5 clock samples (t 0/7/19/31/53 s at speed 0.1, orbitalSpeed 1.2). Re-measure if a sky function changes.
export const SKY_MEAN = Object.freeze({
  fluid: [0.01702, 0.01989, 0.03736],
  thermal: [0.02917, 0.009297, 0.001092],
  earth: [0.008526, 0.005284, 0.00242],
  air: [0.00997, 0.01378, 0.01777],
  neutral: [NEUTRAL_MEAN, NEUTRAL_MEAN, NEUTRAL_MEAN], // analytic, not measured (see NEUTRAL_MEAN)
});

export const AETHER_SKY_GLSL = /* glsl */ `// ── aether sky (aetherSky.js) ──
const int SKY_OCTAVES = ${SKY_OCTAVES};
const float FLUID_SKY_RAD = ${glf(FLUID_SKY_RAD)};
const float AIR_SKY_RAD = ${glf(AIR_SKY_RAD)};
const float AIR_LOWER_DIR = ${glf(AIR_LOWER_DIR)};
const float AIR_SHEAR_BAND = ${glf(AIR_SHEAR_BAND)};
const float AIR_SKY_LINE_POW = ${glf(AIR_SKY_LINE_POW)};
const float AIR_SKY_ENV_POW = ${glf(AIR_SKY_ENV_POW)};
const float AIR_SKY_WARP_Y = ${glf(AIR_SKY_WARP_Y)};
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
const float NEUTRAL_SKY_FLOOR = ${glf(NEUTRAL_SKY_FLOOR)};
const float NEUTRAL_HORIZON_LUM = ${glf(NEUTRAL_HORIZON_LUM)};
const float NEUTRAL_HORIZON_W = ${glf(NEUTRAL_HORIZON_W)};
const float NEUTRAL_STRIP_LUM = ${glf(NEUTRAL_STRIP_LUM)};
const vec3 NEUTRAL_STRIP_AZ = ${v3(NEUTRAL_STRIP_AZ)};
const float NEUTRAL_STRIP_HW = ${glf(NEUTRAL_STRIP_HW)};
const float NEUTRAL_STRIP_SOFT = ${glf(NEUTRAL_STRIP_SOFT)};
const float NEUTRAL_STRIP_Y0 = ${glf(NEUTRAL_STRIP_Y0)};
const float NEUTRAL_STRIP_Y1 = ${glf(NEUTRAL_STRIP_Y1)};
const float NEUTRAL_STRIP_YSOFT = ${glf(NEUTRAL_STRIP_YSOFT)};
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

// Air: streamlines along the orbit, the upper layer one way, the lower AIR_LOWER_DIR the other; Rayleigh-weighted.
// Soft threads §5: a gentler latitude stretch (uAirSkyLat, was 8), a warp in the layer's own frame (ph: periodic,
// rigid with its layer, on the calm-gated sky clock), softer ridges, a smooth (1 - y²)^k envelope.
vec3 skyAirLayer(vec3 R, float ph, float s, float nOct) {
  float wOct = min(nOct, 3.0);
  vec3 wq = vec3(cos(ph), sin(ph), R.y * 1.5) * 1.2 + vec3(0.0, 0.0, uSkyT * 0.03);
  float phw = ph + uAirSkyWarp * (skyFbm(wq, wOct) - 0.5);
  float yw = R.y + AIR_SKY_WARP_Y * (skyFbm(wq + 7.3, wOct) - 0.5);
  vec3 q = vec3(cos(phw) * 1.2, sin(phw) * 1.2, yw * uAirSkyLat);
  float n = skyFbm(q + vec3(0.0, 0.0, skyFbm(q * 0.5, nOct) * 2.0), nOct);
  float lines = pow(1.0 - abs(n * 2.0 - 1.0), AIR_SKY_LINE_POW);
  float gust = smoothstep(0.45, 0.8, skyFbm(vec3(cos(phw + 0.6 * s) * 0.9, sin(phw + 0.6 * s) * 0.9, yw * 2.0) + 4.0, nOct));
  float band = pow(max(1.0 - R.y * R.y, 0.0), AIR_SKY_ENV_POW);
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

// Neutral (resting mirror): a studio. Deep-space black, a thin horizon line, three soft-edged strips turning
// rigidly with the calm-gated sky clock. No noise: the edges are what make the liquid read as a mirror. nOct is unused
// (the rougher mirrors fade to SKY_MEAN_NEUTRAL through k in aetherSky).
float skyNeutralStrip(float az, float c) {
  float d = abs(mod(az - c + 3.14159265, 6.28318531) - 3.14159265);
  return smoothstep(NEUTRAL_STRIP_HW + NEUTRAL_STRIP_SOFT, NEUTRAL_STRIP_HW - NEUTRAL_STRIP_SOFT, d);
}
vec3 skyNeutral(vec3 R, float nOct) {
  float hz = R.y / NEUTRAL_HORIZON_W;
  float L = NEUTRAL_SKY_FLOOR + NEUTRAL_HORIZON_LUM * exp(-hz * hz);
  float az = atan(R.z, R.x) - NEUTRAL_SKY_DRIFT * uSkyT;
  float span = smoothstep(NEUTRAL_STRIP_Y0 - NEUTRAL_STRIP_YSOFT, NEUTRAL_STRIP_Y0 + NEUTRAL_STRIP_YSOFT, R.y)
             * smoothstep(NEUTRAL_STRIP_Y1 + NEUTRAL_STRIP_YSOFT, NEUTRAL_STRIP_Y1 - NEUTRAL_STRIP_YSOFT, R.y);
  float strips = skyNeutralStrip(az, NEUTRAL_STRIP_AZ.x) + skyNeutralStrip(az, NEUTRAL_STRIP_AZ.y) + skyNeutralStrip(az, NEUTRAL_STRIP_AZ.z);
  L += NEUTRAL_STRIP_LUM * span * strips;
  return vec3(L);
}

// The active element's sky (at most one is up: switches pass through neutral), in a mirror of roughness rough; the neutral sky fills
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

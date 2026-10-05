precision highp float;
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
uniform float uSkyT;
uniform vec4 uSkyPhase;
uniform vec4 uSkyW;
uniform float uAetherGain;
uniform float uAetherSilver;
uniform sampler2D uScar;
uniform float uRayGain;
uniform float uSurfOn;
uniform float uCoreR; // phase 6: the live core radius (R_SCENE except during a hyper-fling)
uniform vec3 uImpDir[8];
uniform vec3 uImpMode[8];
uniform vec3 uImpWave[8];
uniform vec4 uBulge;
uniform float uRoilGain;
uniform float uPopZoom;
uniform float uRoughLiquid;
uniform float uMeniscus;
uniform float uOverlay; // slow-noon
uniform vec3 uCaloris; // slow-noon
uniform float uMeniscusW;

const float PI = 3.14159265358979;
const float TAU = 6.28318530717959;
const float HALF_PI = 1.57079632679490;
const float R_SCENE = 0.750000000;
const float R_MERCURY_M = 2439400.00;
const float DEM_MIN_M = -9581.00000;
const float DEM_MAX_M = 7479.00000;
const int SHADOW_STEPS = 12;
const float SHADOW_REACH_RAD = 0.0300000000;
const float SHADOW_SOFT_M = 300.000000;
const float SHADOW_ZONE = 0.350000000;
const float DEM_LSB_M = 66.9019608;
const float SHADOW_SOFT_LSB = 1.50000000;
const float SHADOW_BIAS_LSB = 1.00000000;
const vec3 FALLBACK_ALBEDO = vec3(0.160000000, 0.150000000, 0.140000000);

const float HG_MELT_K = 234.320000;
const float HG_BOIL_K = 629.880000;
const float T_NIGHT_FLOOR_K = 100.000000;
const float T_SUNSET_K = 400.000000;
const float CALORIS_ANG_RAD = 0.317649924; // slow-noon
const vec3 OVERLAY_LINE = vec3(0.550000000, 0.570000000, 0.620000000); // slow-noon
const float OVERLAY_ALPHA = 0.850000000; // slow-noon
const float SUBSOLAR_TICK_PX = 6.00000000; // slow-noon
const float TAU_WARM_H = 860.000000;
const float TAU_COOL_H = 290.000000;
const float HOURS_PER_RAD = 672.047663;
const vec3 HG_N = vec3(1.85900000, 1.55200000, 1.13100000);
const vec3 HG_K = vec3(5.07900000, 4.65100000, 3.99000000);
const float MENISCUS_MAX_SIN = 1.00000000;
const float MENISCUS_MIN_PX = 1.50000000;
const float MENISCUS_GRAD_FLOOR = 0.0500000000;
const float ROUGH_BOIL = 0.400000000;
const vec3 SOLID_HG_ALBEDO = vec3(0.520000000, 0.530000000, 0.550000000);
const float SPARKLE_CELLS = 700.000000;
const float SPARKLE_DENSITY = 0.00400000000;
const float SPARKLE_COS = 0.970000000;
const float SPARKLE_GAIN = 3.00000000;
const float EMIT_RADIUS = 0.150000000;
const float FRONT_EDGE = 0.120000000;
const float FRONT_SOFT = 0.0300000000;
const float FRONT_NOISE_FREQ = 6.00000000;
const float PHASE_BLEND_K = 8.00000000;
const float EMIT_MIN_SIN = 0.0500000000;
const float EMIT_HORIZON_SOFT = 0.100000000;
const float SUN_SHOULDER = 3.00000000;
const float AETHER_NIGHT = 0.200000000;
const float AETHER_DAY_LO = -0.150000000;
const float AETHER_DAY_HI = 0.250000000;
const float ROUGH_SOLID = 0.550000000;
const float SOLID_HG_SPECULAR = 0.500000000;
const float AETHER_SHOULDER = 1.00000000;
const float AETHER_PATH_WHITE = 0.300000000;
const vec3 NIGHT_TINT = vec3(0.450000000, 0.580000000, 1.00000000);
const float SCAR_DEPTH_RANGE_M = 4000.00000;
const vec3 RAY_ALBEDO = vec3(0.420000000, 0.400000000, 0.380000000);
const int IMPULSE_SLOTS = 8;
const int SHAPE_ITERS = 3;
const float SHAPE_MAX = 0.0600000000;
const float WAVE_KR = 72.0000000;
const float WAVE_C_GROUP = 1.90482595;
const float WAVE_SPREAD_FLOOR = 0.150000000;
const float WAVE_K_PEAK = 90.0000000;
const float WAVE_SPEC_W = 0.600000000;
const float WAVE_VISC_PER_S = 0.500000000;
const float WAVE_SHARP = 0.220000000;
const float WAVE_WARP_RAD = 0.0200000000;
const float WAVE_WARP_FREQ = 7.00000000;
const float WAVE_DIMPLE_RAD = 0.0500000000;
const float WAVE_DIMPLE_S = 0.120000000;
const float WAVE_DIMPLE_GAIN = 1.20000000;
const float WAVE_DIMPLE_AA_LO = 1.50000000;
const float WAVE_DIMPLE_AA_HI = 2.50000000;
const float DIMPLE_NORM = 2.3316;
const float POP_FREQ = 5.00000000;
const float POP_JITTER = 0.250000000;
const float POP_REACH = 0.450000000;
const float POP_REACH_RAD = 0.0900000000;
const float POP_SCALE = 2.77777778;
const float POP_LIFE_S = 0.600000000;
const float POP_TIME = 0.144940618;
const float POP_P_MIN = 1.50000000;
const float POP_P_MAX = 4.00000000;
const float POP_RATE_ZOOM_EXP = 0.500000000;
const float POP_RATE_MAX = 2.50000000;
const float POP_DENSITY_K = 60.0000000;
const float POP_AMP = 0.120000000;
const vec3 POP_SALT_ACTIVE = vec3(17.1300000, 3.71000000, 5.29000000);
const vec3 POP_SALT_PERIOD = vec3(31.7000000, 11.3000000, 2.90000000);
const vec3 POP_SALT_PHASE = vec3(47.3000000, 23.1000000, 13.7000000);
const vec3 POP_SALT_X = vec3(0.00000000, 0.00000000, 0.00000000);
const vec3 POP_SALT_Y = vec3(19.1900000, 7.77000000, 1.11000000);
const vec3 POP_SALT_Z = vec3(5.55000000, 29.3000000, 37.7000000);
const float ROIL_LITE_FREQ = 40.0000000;
const float ROIL_LITE_SPEED = 1.50000000;
const float ROIL_LITE_AMP = 0.0800000000;
const float ROIL_LITE_ACT = 0.500000000;
const int ROIL_POPS = 1;
const float ROIL_MOTION = 1.0;

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

// hgOptics.conductorFresnel, exactly: unpolarised reflectance of a metal (n + ik) in vacuum.
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
}

// mercuryMeniscus.meniscusSin, exactly: the quarter-circle rim's outward tilt at arc distance d.
float meniscusSin(float d, float w, float gain) {
  if (d < 0.0 || w <= 0.0) return 0.0;
  float u = d / w;
  return u >= 1.0 ? 0.0 : clamp(gain, 0.0, 1.0) * MENISCUS_MAX_SIN * (1.0 - u);
}

// A disc of angular radius asin(sinR) seen in a mirror of roughness rough:
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
// Per channel, a bright magenta core clipped toward pastel (the streak profile, aetherEdge/aetherCurve, sets the volume).
// Only the hottest part of a core takes a little path to white (AETHER_PATH_WHITE at full compression), as overexposed
// emission does: the core reads luminous and curved, the fringe stays the deep gas hue.
vec3 aetherShoulder(vec3 x) {
  float m = max(x.r, max(x.g, x.b));
  if (m <= 1e-6) return x;
  float s = softShoulder(m, AETHER_SHOULDER);
  vec3 y = x * (s / m);
  return mix(y, vec3(s), AETHER_PATH_WHITE * smoothstep(0.55, 0.95, s / AETHER_SHOULDER));
}

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

// ── aether sky (aetherSky.js) ──
const int SKY_OCTAVES = 5;
const float FLUID_SKY_RAD = 10.0530965;
const float AIR_SKY_RAD = 0.750000000;
const float AIR_LOWER_DIR = -0.850000000;
const float FIRE_SKY_RISE = 1.47500000;
const float EARTH_SKY_SINK = 0.890057143;
const float SKY_ROUGH_SHARP = 0.150000000;
const float SKY_ROUGH_FLAT = 0.600000000;
const float SKY_W_MIN = 0.00400000000;
const float SKY_PING_EXP = 250.000000;
const float SKY_PING_GAIN = 10.0000000;
const vec3 SKY_MEAN_FLUID = vec3(0.0200000000, 0.0300000000, 0.0500000000);
const vec3 SKY_MEAN_THERMAL = vec3(0.0500000000, 0.0120000000, 0.00100000000);
const vec3 SKY_MEAN_EARTH = vec3(0.0200000000, 0.0120000000, 0.00500000000);
const vec3 SKY_MEAN_AIR = vec3(0.0100000000, 0.0140000000, 0.0180000000);

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

// Air: thin fast streamlines along the orbit, the upper layer one way, the lower AIR_LOWER_DIR the other;
// Rayleigh-weighted.
vec3 skyAir(vec3 R, float nOct) {
  float az = atan(R.z, R.x);
  float s = clamp(R.y * 5.0, -1.0, 1.0);
  s = s * (1.5 - 0.5 * s * s);
  float dirS = s >= 0.0 ? s : s * -AIR_LOWER_DIR;
  float ph = az - AIR_SKY_RAD * uSkyPhase.w * dirS;
  vec3 q = vec3(cos(ph) * 1.2, sin(ph) * 1.2, R.y * 8.0);
  float n = skyFbm(q + vec3(0.0, 0.0, skyFbm(q * 0.5, nOct) * 2.0), nOct);
  float lines = pow(1.0 - abs(n * 2.0 - 1.0), 18.0);
  float gust = smoothstep(0.45, 0.8, skyFbm(vec3(cos(ph + 0.6 * s) * 0.9, sin(ph + 0.6 * s) * 0.9, R.y * 2.0) + 4.0, nOct));
  float band = smoothstep(0.95, 0.2, abs(R.y));
  float mu = dot(R, uSunDir);
  return vec3(0.55, 0.76, 0.98) * lines * gust * band * (0.5 + 0.5 * (1.0 + mu * mu)) * 0.6;
}

// The active element's sky (two during a switch), in a mirror of roughness rough.
vec3 aetherSky(vec3 R, float rough) {
  float k = smoothstep(SKY_ROUGH_SHARP, SKY_ROUGH_FLAT, rough);
  vec3 mean = uSkyW.x * SKY_MEAN_FLUID + uSkyW.y * SKY_MEAN_THERMAL + uSkyW.z * SKY_MEAN_EARTH + uSkyW.w * SKY_MEAN_AIR;
  if (k >= 1.0) return mean;
  float nOct = mix(float(SKY_OCTAVES), 1.0, k);
  vec3 s = vec3(0.0);
  if (uSkyW.x > SKY_W_MIN) s += uSkyW.x * skyFluid(R, nOct);
  if (uSkyW.y > SKY_W_MIN) s += uSkyW.y * skyThermal(R, nOct);
  if (uSkyW.z > SKY_W_MIN) s += uSkyW.z * skyEarth(R, nOct, k);
  if (uSkyW.w > SKY_W_MIN) s += uSkyW.w * skyAir(R, nOct);
  return mix(s, mean, k);
}

// The aether in a mirror of roughness rough: the active element's moving sky (aetherSky.js), night-tinted,
// rolled off. Shared by the liquid (envRadiance) and the planet's frozen Hg (a rough, dark mirror of the same sky).
vec3 aetherMirror(vec3 R, float rough, vec3 nW) {
  return aetherTint(nW) * aetherShoulder(uAetherGain * aetherHue(aetherSky(R, rough)));
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
  return c + aetherMirror(R, rough, nW);
}

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
  // Fresh crater rays brighten the crust; they mature back to background (scarMap.js).
  albedo = mix(albedo, RAY_ALBEDO, clamp(textureGrad(uScar, uv, gx, gy).g * uRayGain, 0.0, 1.0));

  // No atmosphere: the terminator is as soft as the Sun's disc is wide.
  float mu0g = dot(nb, Lb);
  float term = smoothstep(-uSunSinR, uSunSinR, mu0g);
  float mu0 = max(dot(n, Lb), 0.0);
  float mu = max(dot(n, Vb), 1e-3);
  float ls = 2.0 * mu0 / (mu0 + mu + 1e-4); // Lommel–Seeliger, 1 at normal incidence

  float vis = 1.0;
  if (uHasMaps > 0.5 && mu0g > -uSunSinR && mu0g < SHADOW_ZONE) {
    vis = castShadow(uv, nb, Lb, h0, cosLat, east, north, gx, gy);
    vis = mix(vis, 1.0, smoothstep(0.7 * SHADOW_ZONE, SHADOW_ZONE, mu0g));
  }

  vec3 colLin = albedo * (uSunIrr * uExposure * ls * term * vis + uNightFloor);

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
      vec3 R = reflect(rd, nW);
      float NoV = clamp(dot(nW, -rd), 0.0, 1.0);

      vec3 liquid = vec3(0.0);
      if (liquidW > 0.0) {
        liquid = fresnelHg(NoV) * envRadiance(R, mix(uRoughLiquid, ROUGH_BOIL, boilW * (0.5 + 0.5 * popAct)), hit, nW);
      }

      vec3 solid = vec3(0.0);
      if (liquidW < 1.0) {
        float sunI = uSunIrr * uExposure;
        float facet = hash13(vec3(floor(uv * vec2(2.0 * SPARKLE_CELLS, SPARKLE_CELLS)), 7.0));
        float glint = step(1.0 - SPARKLE_DENSITY, facet) * smoothstep(SPARKLE_COS, 1.0, dot(R, uSunDir)) * term;
        solid = SOLID_HG_ALBEDO * (sunI * max(dot(nW, uSunDir), 0.0) * term + uNightFloor)
          + frozenAether(R, nW, NoV) + vec3(glint * SPARKLE_GAIN * sunI);
      }

      colLin = mix(colLin, mix(solid, liquid, liquidW), fluid);
    }
  }

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

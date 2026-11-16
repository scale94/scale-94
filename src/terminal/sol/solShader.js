// solShader.js — the star: one analytic sphere in a full-screen fragment shader.
//
// Conventions are solCamera.js's, copied exactly:
//   view +x right, +y up, +z toward the viewer; orthographic; star radius in
//   pixels = uStarRadius * min(res) / 2, centred.
//   star -> view: rotY(uRotLon), rotY(-uCamYaw), rotX(+uCamPitch).
//   rotY(a): x' = x cos a + z sin a, z' = -x sin a + z cos a.
// The star frame does not rotate: the plasma drifts in longitude at
// omega(lat) = OMEGA_EQ (1 - 0.265 sin^2 lat), the same rate regions.js moves
// each region at, so a region stays on the plasma it sits on.
//
// Main passes: (1) pixel -> star frame; (2) per region: ripple displacement
// and twist of the noise domain; (3) two-phase domain-warped fbm granulation
// drifting at omega(lat); (4) per region: bipolar pores with bright rims;
// (5) limb darkening on heat + heat ramp; (6) corona; (7) per region: arch
// ribbon; (8) clamp below white (CAP), dither, premultiplied alpha.
//
// Compile budget (ANGLE/D3D11, the 87 s /MERCURY stall): every loop is
// constant-bounded and small; noise is only ever called from the granulation
// pass, never inside a per-region loop; no derivatives anywhere.

import { glf } from '../gl/glf';
import { OMEGA_EQ } from './regions';

/** Pole slow-down of differential rotation: omega(lat) = OMEGA_EQ (1 - K sin^2 lat). Mirrors regions.js omega(). */
export const OMEGA_POLE_K = 0.265;

export const SOL_UNIFORMS = ['uRes', 'uTime', 'uCamYaw', 'uCamPitch', 'uRotLon', 'uStarRadius',
  'uRegionPos', 'uRegionTwist', 'uRegionTension', 'uRegionCount',
  'uFlashPos', 'uFlash', 'uShock', 'uPlumeDir', 'uPlume', 'uHalo',
  'uAurora', 'uAuroraRed', 'uStill', 'uQuality'];

export const QUAD_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vScreen;
void main() {
  vScreen = aPos;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

export const SOL_FS = `#version 300 es
precision highp float;
in vec2 vScreen;
out vec4 fragColor;

uniform vec2 uRes;
uniform float uTime;
uniform float uCamYaw;
uniform float uCamPitch;
uniform float uRotLon;
uniform float uStarRadius;
uniform vec3 uRegionPos[6];
uniform float uRegionTwist[6];
uniform float uRegionTension[6];
uniform int uRegionCount;
// Snap effects (Task 9) and clock effects (Task 14): declared, not yet drawn.
uniform vec3 uFlashPos;
uniform float uFlash;
uniform float uShock;
uniform vec3 uPlumeDir;
uniform float uPlume;
uniform float uHalo;
uniform float uAurora;
uniform float uAuroraRed;
uniform float uStill;
uniform float uQuality;

const float PI = 3.14159265;
const float TAU = 6.28318531;
const float OMEGA_EQ = ${glf(OMEGA_EQ)};
const float OMEGA_K = ${glf(OMEGA_POLE_K)};

// Look knobs.
const float GRAN_F = 17.0;          // granule frequency on the unit sphere
const float LAYER_T = 40.0;         // s; two-phase reseed period, bounds the rotation shear
// The hand's twist: rigid rotation by the FULL angle inside TWIST_R0 (rad on
// the sphere; the pore pair lives in there), then a falloff to zero over a
// log-radius width L that grows with |angle| so the shear r*d(angle)/dr
// stays at TWIST_SHEAR until L hits its cap. The dominant region's ring
// carries only the wrapped remainder of its angle (two blended branches,
// see main), so its shear stays bounded; anywhere lanes would still drop
// under ~2 px the granulation contrast fades instead of the angle capping.
const float TWIST_R0 = 0.16;
const float TWIST_SHEAR = 3.0;
const float TWIST_LMIN = 0.7;
const float TWIST_LMAX = 1.15;      // falloff ends at R0 * e^1.15 ~ 0.5 rad
const float LANE_PX_MIN = 1.3;      // lane spacing (px) where contrast is gone
const float LANE_PX_OK = 2.8;       // lane spacing (px) at full contrast
const float RIPPLE_K = 70.0;        // rad^-1 along the surface
const float RIPPLE_W = 2.2;         // rad/s phase rate: crests travel outward
const int ARCH_N = 10;              // arch polyline points

// Never white: white is the reconnection flash's alone.
const vec3 CAP = vec3(1.0, 0.93, 0.78);

vec3 rotY(vec3 p, float c, float s) { return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c); }
vec3 rotX(vec3 p, float c, float s) { return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c); }

vec3 rotAxis(vec3 v, vec3 k, float a) {
  float c = cos(a);
  float s = sin(a);
  return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
}

vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return -1.0 + 2.0 * fract((p3.xxy + p3.yxx) * p3.zyx);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// 3D gradient noise, quintic fade, about -1..1.
float gnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = dot(hash33(i), f);
  float n100 = dot(hash33(i + vec3(1.0, 0.0, 0.0)), f - vec3(1.0, 0.0, 0.0));
  float n010 = dot(hash33(i + vec3(0.0, 1.0, 0.0)), f - vec3(0.0, 1.0, 0.0));
  float n110 = dot(hash33(i + vec3(1.0, 1.0, 0.0)), f - vec3(1.0, 1.0, 0.0));
  float n001 = dot(hash33(i + vec3(0.0, 0.0, 1.0)), f - vec3(0.0, 0.0, 1.0));
  float n101 = dot(hash33(i + vec3(1.0, 0.0, 1.0)), f - vec3(1.0, 0.0, 1.0));
  float n011 = dot(hash33(i + vec3(0.0, 1.0, 1.0)), f - vec3(0.0, 1.0, 1.0));
  float n111 = dot(hash33(i + vec3(1.0, 1.0, 1.0)), f - vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
             mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}

// 4 octaves; the finest is weighted by uQuality (1 desktop, lower on slow devices).
float fbm(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    float w = (i == 3) ? uQuality : 1.0;
    s += a * w * gnoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}

// One granulation layer on the material sphere point m. Warp and base both
// move through 3D, so cells boil (split, merge, fade) rather than scroll.
float granLayer(vec3 m, vec3 seed) {
  vec3 p = m * GRAN_F + seed;
  float t = uTime;
  vec3 q = p * 0.33;
  vec3 w = vec3(gnoise(q + vec3(0.0, 0.0, t * 0.050)),
                gnoise(q + vec3(5.2, 1.3, -t * 0.043)),
                gnoise(q + vec3(2.1, 7.7, t * 0.037)));
  float n = fbm(p + 0.9 * w + vec3(t * 0.021, -t * 0.017, t * 0.019));
  // bright cells, dark intergranular lanes
  return smoothstep(-0.32, 0.38, n);
}

// Two half-period-offset layers, each drifting at omega(lat) for tau seconds
// and reseeded while its weight is zero: correct drift, bounded shear.
float granulation(vec3 q) {
  float om = OMEGA_EQ * (1.0 - OMEGA_K * q.y * q.y);
  float g = 0.0;
  for (int k = 0; k < 2; k++) {
    float ph = uTime / LAYER_T + 0.5 * float(k);
    float tau = fract(ph) * LAYER_T;
    float cyc = floor(ph);
    float wgt = sin(PI * fract(ph));
    wgt *= wgt;
    float a = -om * tau;
    vec3 m = rotY(q, cos(a), sin(a));
    vec3 seed = hash33(vec3(cyc, float(k) * 7.0, 3.0)) * 41.0;
    g += wgt * granLayer(m, seed);
  }
  return g;
}

// Heat (0..1) -> photosphere colour: dark red-brown, deep orange, amber,
// gold, white-gold. Piecewise LINEAR (smoothstep segments would plateau at
// each stop and band). Every stop has g/r <= 0.90 and b/r <= 0.60, so any
// sum of these colours stays below CAP's hue: no white.
vec3 heatRamp(float t) {
  vec3 c0 = vec3(0.20, 0.035, 0.0);
  vec3 c1 = vec3(0.62, 0.13, 0.01);
  vec3 c2 = vec3(0.95, 0.36, 0.04);
  vec3 c3 = vec3(1.0, 0.60, 0.15);
  vec3 c4 = vec3(1.0, 0.78, 0.38);
  vec3 c5 = vec3(1.0, 0.89, 0.58);
  vec3 c = mix(c0, c1, clamp(t / 0.25, 0.0, 1.0));
  c = mix(c, c2, clamp((t - 0.25) / 0.25, 0.0, 1.0));
  c = mix(c, c3, clamp((t - 0.50) / 0.20, 0.0, 1.0));
  c = mix(c, c4, clamp((t - 0.70) / 0.15, 0.0, 1.0));
  return mix(c, c5, clamp((t - 0.85) / 0.15, 0.0, 1.0));
}

// Twist angle at chord distance d from a region, for a hand angle th0
// (radians, cw positive). Also returns the local shear r*abs(d angle/dr).
float twistAngle(float d, float th0, out float shear) {
  float L = clamp(1.5 * abs(th0) / TWIST_SHEAR, TWIST_LMIN, TWIST_LMAX);
  float u = clamp(log(max(d, TWIST_R0) / TWIST_R0) / L, 0.0, 1.0);
  shear = abs(th0) * 6.0 * u * (1.0 - u) / L;
  return th0 * (1.0 - u * u * (3.0 - 2.0 * u));
}

// Tangent frame at a surface point: east (+lon), north. Safe at the poles.
void frameAt(vec3 c, out vec3 east, out vec3 north) {
  vec3 e = cross(vec3(0.0, 1.0, 0.0), c);
  float el = length(e);
  east = el > 1e-4 ? e / el : vec3(1.0, 0.0, 0.0);
  north = cross(c, east);
}

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
  return length(p - a - ab * t);
}

void main() {
  float minRes = max(min(uRes.x, uRes.y), 1.0);
  float starR = max(uStarRadius, 1e-3);
  float radiusPx = max(starR * minRes * 0.5, 1.0);
  vec2 uv = vScreen * uRes / (starR * minRes);   // star radius = 1
  float r = length(uv);
  float aa = 1.5 / radiusPx;

  float cy = cos(uRotLon - uCamYaw), sy = sin(uRotLon - uCamYaw);
  float cp = cos(uCamPitch), sp = sin(uCamPitch);

  vec3 col = vec3(0.0);
  float disc = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, r);

  // ---- photosphere ----
  if (r < 1.0 + aa) {
    float rc = min(r, 0.99999);
    vec2 sxy = r > 0.99999 ? uv * (0.99999 / r) : uv;
    vec3 v = vec3(sxy, sqrt(max(0.0, 1.0 - rc * rc)));
    float mu = v.z;
    // view -> star: rotX(-pitch), then rotY(yaw - rotLon)
    vec3 p = rotY(rotX(v, cp, -sp), cy, -sy);

    // (2) ripples and twist warp the noise domain. The region with the
    // largest |twist| (in practice the held one; at most one region carries
    // more than a turn) is applied last, in two BRANCHES (see below).
    int dom = -1;
    float domAbs = 0.0;
    for (int i = 0; i < 6; i++) {
      if (i >= uRegionCount) break;
      float at = abs(uRegionTwist[i]);
      if (at > domAbs) { domAbs = at; dom = i; }
    }
    vec3 q = p;
    float shade = 0.0;
    float maxShear = 0.0;
    vec3 domC = vec3(0.0, 0.0, 1.0);
    float domD = 4.0;
    for (int i = 0; i < 6; i++) {
      if (i >= uRegionCount) break;
      vec3 c = uRegionPos[i];
      float T = uRegionTension[i];
      float d = length(p - c);
      if (T > 0.01 && d < 0.9) {
        vec3 rad = p - c * dot(p, c);
        float rl = length(rad);
        vec3 dir = rl > 1e-5 ? rad / rl : vec3(0.0);
        float env = T * T * exp(-d / 0.32) * smoothstep(0.0, 0.06, d) * (1.0 - smoothstep(0.55, 0.9, d));
        env *= 0.65 + 0.35 * sin(d * 9.0 - uTime * 0.45);   // wave groups, not a stamp
        float ph = d * RIPPLE_K - uTime * RIPPLE_W;
        q += dir * (sin(ph) * env * 0.010);
        shade += cos(ph) * env * 0.07;
      }
      if (i == dom) { domC = c; domD = d; continue; }
      float shear;
      float a = twistAngle(d, TAU * uRegionTwist[i], shear);
      maxShear = max(maxShear, shear);
      q = rotAxis(q, c, a);
    }

    // The dominant twist. A rotation by 2*pi is the identity, so the rigid
    // core can turn by the FULL hand angle while the falloff ring carries
    // only the wrapped remainder: branch A winds the ring by the angle's
    // fractional turn f in [0, 1), branch B by f - 1. Both agree exactly in
    // the core; they are blended (B weight = f) so everything is continuous
    // in handTurns, and the ring's winding never exceeds about half a turn
    // at full weight: no concentric-ring lanes at 6 turns.
    float g = 0.53;
    {
      float F = dom >= 0 ? uRegionTwist[dom] : 0.0;
      float f = F - floor(F);
      float lane0 = radiusPx / GRAN_F;
      for (int b = 0; b < 2; b++) {
        float wb = b == 0 ? 1.0 - f : f;
        if (wb < 1e-3) continue;
        float ringTurns = b == 0 ? f : f - 1.0;
        float shear;
        float a = twistAngle(domD, TAU * ringTurns, shear);
        vec3 qb = normalize(rotAxis(q, domC, a));
        float s = max(maxShear, shear);
        // contrast fades only where lanes would still drop under ~2 px
        float gb = mix(0.53, granulation(qb), smoothstep(LANE_PX_MIN, LANE_PX_OK, lane0 / (1.0 + s)));
        g += wb * (gb - 0.53);
      }
    }
    float lum = (0.42 + 0.95 * g) * (1.0 + shade);

    // (4) pores with bright rims
    float rim = 0.0;
    for (int i = 0; i < 6; i++) {
      if (i >= uRegionCount) break;
      float T = uRegionTension[i];
      float D = smoothstep(0.12, 0.55, T);
      if (D <= 0.0) continue;
      vec3 c = uRegionPos[i];
      vec3 east, north;
      frameAt(c, east, north);
      float beta = -TAU * uRegionTwist[i];             // the pair turns rigidly with the hand
      vec3 axis = east * cos(beta) + north * sin(beta);
      float sep = 0.06 + 0.10 * T;
      float rp = 0.018 + 0.030 * T;
      for (int s = 0; s < 2; s++) {
        float sg = s == 0 ? 0.5 : -0.5;
        vec3 pc = normalize(c + axis * (sep * sg));
        float dd = length(p - pc);
        float umbra = 1.0 - smoothstep(rp * 0.45, rp * 1.05, dd);
        lum *= mix(1.0, 0.06, D * umbra);
        float e = (dd - rp * 1.35) / (rp * 0.5);
        rim += D * exp(-e * e);
      }
    }

    // (5) limb darkening I(mu) = 1 - 0.72 (1 - mu) acting on heat, so the
    // colour reddens toward the limb across the whole disc
    float limbI = 1.0 - 0.72 * (1.0 - mu);
    float heat = limbI * lum + rim * 0.30 * limbI;
    col = heatRamp(1.0 - exp(-2.5 * heat)) * disc;
  }

  // (6) a thin corona
  float off = max(r - 1.0, 0.0);
  float halo = exp(-off * 11.0) * 0.30 + exp(-off * 2.6) * 0.05;
  col += vec3(1.0, 0.46, 0.13) * halo * (1.0 - disc);

  // (7) arches: a loop over each pore pair, above the surface
  for (int i = 0; i < 6; i++) {
    if (i >= uRegionCount) break;
    float T = uRegionTension[i];
    float gain = smoothstep(0.05, 0.35, T);
    if (gain <= 0.0) continue;
    vec3 c = uRegionPos[i];
    vec3 east, north;
    frameAt(c, east, north);
    float beta = -TAU * uRegionTwist[i];
    vec3 axis = east * cos(beta) + north * sin(beta);
    float sep = 0.06 + 0.10 * T;
    vec3 A = normalize(c + axis * (sep * 0.5));
    vec3 B = normalize(c - axis * (sep * 0.5));
    float H = sep * (0.5 + 1.4 * T) * (1.0 + 0.03 * sin(uTime * 0.7 + float(i) * 1.7));
    float expo = mix(0.95, 0.55, T);                           // taut: fuller, straighter legs
    float w = mix(0.034, 0.015, T);                            // ribbon half-width, radius units
    // second strand: a little lower, nudged sideways off the pair axis
    vec3 side = cross(c, axis) * (sep * 0.12);
    float best = 1e3;
    float best2 = 1e3;
    vec3 prevV = rotX(rotY(A, cy, sy), cp, sp);
    vec3 prevW = prevV;
    for (int j = 1; j < ARCH_N; j++) {
      float u = float(j) / float(ARCH_N - 1);
      float sh = pow(max(sin(PI * u), 0.0), expo);
      vec3 S = normalize(mix(A, B, u));
      vec3 V = rotX(rotY(S * (1.0 + H * sh), cy, sy), cp, sp);
      vec3 W = rotX(rotY(normalize(S + side * sh) * (1.0 + 0.82 * H * sh), cy, sy), cp, sp);
      vec3 M = 0.5 * (prevV + V);
      float behind = (1.0 - smoothstep(-0.02, 0.02, M.z)) * (1.0 - smoothstep(0.98, 1.02, length(M.xy)));
      best = min(best, segDist(uv, prevV.xy, V.xy) + behind * 1e3);
      best2 = min(best2, segDist(uv, prevW.xy, W.xy) + behind * 1e3);
      prevV = V;
      prevW = W;
    }
    float core = exp(-(best * best) / (w * w));
    float strand = exp(-(best2 * best2) / (0.36 * w * w)) * 0.45;
    float flank = exp(-(best * best) / (7.0 * w * w)) * (1.0 - core);
    float glow = exp(-best / (w * 3.0)) * 0.18;
    // amber-gold, brighter as it pulls taut; never past the ramp's gold
    vec3 archCol = heatRamp(0.80 + 0.17 * T);
    col *= 1.0 - 0.30 * flank * gain * disc;                   // the ribbon's shadow over the disc
    col = mix(col, archCol, clamp(max(core, strand) * gain * (0.75 + 0.25 * T), 0.0, 1.0));
    col += archCol * glow * gain * (1.0 - 0.6 * disc);
  }

  // (8) never white, dither, premultiplied alpha
  col = min(col, CAP);
  col += (hash12(gl_FragCoord.xy + fract(uTime * 7.0) * 61.0) - 0.5) / 255.0;
  col = clamp(col, 0.0, 1.0);
  float alpha = max(disc, clamp(max(col.r, max(col.g, col.b)) * 1.25, 0.0, 1.0));
  fragColor = vec4(col, alpha);
}`;

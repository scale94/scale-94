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
// and twist of the noise domain (the hand's turns plus a small share of the
// region's own winding); (3) two-phase cellular granulation, pixel-sized
// cells on a mesogranular field, boiling in place and drifting at
// omega(lat); (3b) the fibril whorl of the one region that owns the pixel,
// wound by ALL its turns, so untouched regions spiral too; (4) per region:
// charred pores with thin incandescent rims; (5) limb darkening on heat +
// heat ramp; (6) three-layer corona with streamers; (7) the nearest
// region's prominence: tapered, threaded, frayed, flickering; (9) the snap:
// torn surface/corona shock, torn plume or halo, exposure dip; (8) clamp
// below white (CAP); (11) the aurora, after the cap, veiled then screened so
// it stays below white; (10) the reconnection flash, the only white on the
// tab; dither, premultiplied alpha.
//
// Compile budget (ANGLE/D3D11, the 87 s /MERCURY stall): every loop is
// constant-bounded and small; no derivatives anywhere; NO noise inside a
// per-region loop. Where a per-region effect needs noise (whorl, arch) the
// loop only picks the region that owns the pixel and the noise is sampled
// once after it. The cellular noise is a 3x3x3 search called once per
// granulation layer. Cold link measured ~2.0 s here (was ~0.7 s).
//
// uStill (reduced motion): 1 freezes everything that moves on its own. Every
// clock-driven term reads gT, which is uTime when uStill is 0 (output
// unchanged) and the fixed STILL_T when it is 1: granulation boil and drift,
// ripples, the arch breathing, the ejection streaks and the dither all hold.
// Region position, twist and tension still act, so a stir visibly winds.
//
// uQuality (quality.js): 1 is the full path. Below 0.75 the shader does less
// work per pixel, through branches on a uniform inside constant-bounded loops:
// fbm evaluates 3 octaves instead of 4 (the 4th is skipped, not down-weighted;
// gradient noise is zero-mean, so brightness holds); the two granulation
// layers cross-fade over a third of each cycle instead of all of it (weights
// still sum to 1), so for two thirds of the time only ONE layer is evaluated;
// the arch's second strand is skipped.

import { glf } from '../gl/glf';
import { OMEGA_EQ } from './regions';

/** Pole slow-down of differential rotation: omega(lat) = OMEGA_EQ (1 - K sin^2 lat). Mirrors regions.js omega(). */
export const OMEGA_POLE_K = 0.265;

export const SOL_UNIFORMS = ['uRes', 'uTime', 'uCamYaw', 'uCamPitch', 'uRotLon', 'uStarRadius',
  'uRegionPos', 'uRegionTwist', 'uRegionTension', 'uRegionWind', 'uRegionCount',
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
// The star's own winding of each region, signed turns (clockwise positive,
// like uRegionTwist): what an untouched region's spiral is drawn from.
uniform float uRegionWind[6];
uniform int uRegionCount;
// Snap effects (snapFx.js): uFlashPos star frame; uPlumeDir view space, its
// length is the snap's gain. Clock effects (Task 14): declared, not yet drawn.
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

// The clock every self-moving term reads (see uStill above); set first in main.
float gT;
// Granule cells across one radius, and px per cell at this pixel (set in main).
float gGranF;
float gCellPx;

const float PI = 3.14159265;
const float TAU = 6.28318531;
const float OMEGA_EQ = ${glf(OMEGA_EQ)};
const float OMEGA_K = ${glf(OMEGA_POLE_K)};

// Look knobs.
// Granule size is chosen in PIXELS (so it is as fine as the canvas can hold,
// on any screen): gGranF cells across one radius, set in main.
const float GRAN_PX = 4.8;          // px per granule at disc centre
const float GRAN_F_MIN = 24.0;
const float GRAN_F_MAX = 72.0;
const float LANE_PX = 1.1;          // a lane is never drawn thinner than about this many px across
const float GRAN_BOIL = 0.10;       // lattice units/s the sample rises along the normal: cells boil, never scroll
const float GRAN_MEAN = 0.50;       // mean of a resolved granulation layer (what unresolved lanes fade to)
const float MESO_F = 7.5;           // mesogranular brightness structure, 4 octaves up to the granule scale
const float LAYER_T = 40.0;         // s; two-phase reseed period, bounds the rotation shear
// The hand's twist: rigid rotation by the FULL angle inside TWIST_R0 (rad on
// the sphere; the pore pair lives in there), then a falloff to zero over a
// log-radius width L that grows with |angle| so the shear r*d(angle)/dr
// stays at TWIST_SHEAR until L hits its cap. The dominant region's ring
// carries only the wrapped remainder of its angle (two blended branches,
// see main), so its shear stays bounded; anywhere lanes would still drop
// under ~2 px the granules fade to their unresolved mean (the mesogranular
// structure stays, so the wind still reads) instead of the angle capping.
const float TWIST_R0 = 0.16;
const float TWIST_SHEAR = 3.0;
const float TWIST_LMIN = 0.7;
const float TWIST_LMAX = 1.15;      // falloff ends at R0 * e^1.15 ~ 0.5 rad
const float LANE_PX_MIN = 1.3;      // lane spacing (px) where contrast is gone
const float LANE_PX_OK = 2.8;       // lane spacing (px) at full contrast
// The star's own winding (uRegionWind, signed turns): a region nobody touched
// turns its granulation by WIND_VIS of its turns (6 turns -> 0.3 of a turn,
// so the granules stay resolved), and its fibril whorl winds with ALL its
// turns, saturating. Inside the whorl the granules give way to the fibres.
const float WIND_VIS = 0.05;
const float FIB_R0 = 0.03;          // rad; fibrils start at the pore
const float FIB_ARMS = 5.0;         // radius of the noise circle the azimuth runs on (~30 irregular fibres; a finer octave joins further out)
const float FIB_WRAPS = 1.3;        // turns of whorl per turn of field at small winding
const float FIB_SAT = 0.45;         // saturation: at most FIB_WRAPS / FIB_SAT turns of whorl
const float RIPPLE_K = 70.0;        // rad^-1 along the surface
const float RIPPLE_W = 2.2;         // rad/s phase rate: crests travel outward
const int ARCH_N = 12;              // arch polyline points
const float STILL_T = 0.0;          // s; the frozen clock under uStill
const float Q_REDUCED = 0.75;       // uQuality below this takes the cheaper path
// The snap (Task 9).
const float SHOCK_REACH = 1.9;      // rad on the sphere the surface shock crosses
const float PLUME_REACH = 1.9;      // disc radii the plume bubble's centre travels from its anchor
const float PLUME_BUBBLE = 0.55;    // bubble radius / anchor distance (self-similar widening)
const float EJ_ANG_F = 4.0;         // streak scale around the ejection (noise circle radius; ~25 soft cells)
const float EJ_WARP = 0.15;         // rad of angular warp per disc radius: streaks lean and wander, never a regular comb
const float EJ_JAG = 0.24;          // the front's radius is torn by this share of itself
const float FLASH_CORE = 0.022;     // disc radii, the white core's gaussian width
const float FLASH_DIP = 0.42;       // exposure dip of everything but the flash at its peak

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

// 4 octaves at full quality; the reduced path never evaluates the 4th.
float fbm(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    if (i == 3 && uQuality < Q_REDUCED) break;
    s += a * gnoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}

// Cellular noise: distance to the nearest and second-nearest feature point.
// Their difference is zero exactly on the cell walls: the intergranular lanes.
vec2 cellF(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec3 o = vec3(float(x), float(y), float(z));
        vec3 r = o + 0.5 + 0.5 * hash33(i + o) - f;
        float d = dot(r, r);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
      }
    }
  }
  return sqrt(vec2(d1, d2));
}

// One granulation layer on the material sphere point m, tau seconds after its
// reseed. Returns (resolved, unresolved): the granules, and what they average
// to where a pixel cannot hold a lane. Fine cells (bright polygon, crisp dark
// wall) whose brightness rides a 4-octave mesogranular field, so whole
// families of granules run from deep orange to white-gold. The sample point
// RISES along the normal (the lattice scale grows with tau), so every cell
// swells, splits and dies in place; the warp jostles them sideways.
vec2 granLayer(vec3 m, vec3 seed, float tau) {
  float t = gT;
  vec3 p = m * (gGranF + GRAN_BOIL * tau) + seed;
  float meso = fbm(m * MESO_F + seed * 0.37 + vec3(t * 0.011, -t * 0.009, t * 0.010));
  float amp = max(1.0 + 1.35 * meso + 3.4 * max(meso, 0.0) * max(meso, 0.0), 0.22);
  vec3 q = p * 0.31;
  vec3 w = vec3(gnoise(q + vec3(0.0, 0.0, t * 0.060)),
                gnoise(q + vec3(5.2, 1.3, -t * 0.050)),
                gnoise(q + vec3(2.1, 7.7, t * 0.045)));
  vec2 c = cellF(p + 0.55 * w);
  // the wall's width follows the pixel, so a lane never aliases into specks
  float lane = smoothstep(0.015, clamp(LANE_PX / gCellPx, 0.16, 0.55), c.y - c.x);
  float body = 0.50 + 0.50 * (1.0 - c.x) * (1.0 - c.x) * 1.6;
  return vec2(lane * body * amp, GRAN_MEAN * amp);
}

// Two half-period-offset layers, each drifting at omega(lat) for tau seconds
// and reseeded while its weight is zero: correct drift, bounded shear.
vec2 granulation(vec3 q) {
  float om = OMEGA_EQ * (1.0 - OMEGA_K * q.y * q.y);
  vec2 g = vec2(0.0);
  for (int k = 0; k < 2; k++) {
    float ph = gT / LAYER_T + 0.5 * float(k);
    float tau = fract(ph) * LAYER_T;
    float cyc = floor(ph);
    float wgt = sin(PI * fract(ph));
    wgt *= wgt;
    if (uQuality < Q_REDUCED) {
      // the two weights are w and 1 - w; smoothstep(.25, .75, .) keeps that
      // sum, and is exactly 0 for a third of the cycle: skip the layer then
      wgt = smoothstep(0.25, 0.75, wgt);
      if (wgt <= 0.0) continue;
    }
    float a = -om * tau;
    vec3 m = rotY(q, cos(a), sin(a));
    vec3 seed = hash33(vec3(cyc, float(k) * 7.0, 3.0)) * 41.0;
    g += wgt * granLayer(m, seed, tau);
  }
  return g;
}

// Heat (0..1) -> photosphere colour: charred umbra, ember red, deep orange,
// amber, gold, white-gold. Piecewise LINEAR (smoothstep segments would
// plateau at each stop and band). The top stop sits just under CAP, and the
// clamp to CAP comes after everything: no white.
vec3 heatRamp(float t) {
  vec3 c0 = vec3(0.028, 0.006, 0.002);
  vec3 c1 = vec3(0.30, 0.042, 0.004);
  vec3 c2 = vec3(0.74, 0.165, 0.012);
  vec3 c3 = vec3(0.98, 0.42, 0.05);
  vec3 c4 = vec3(1.0, 0.66, 0.20);
  vec3 c5 = vec3(1.0, 0.84, 0.46);
  vec3 c6 = vec3(1.0, 0.92, 0.70);
  vec3 c = mix(c0, c1, clamp(t / 0.18, 0.0, 1.0));
  c = mix(c, c2, clamp((t - 0.18) / 0.22, 0.0, 1.0));
  c = mix(c, c3, clamp((t - 0.40) / 0.20, 0.0, 1.0));
  c = mix(c, c4, clamp((t - 0.60) / 0.18, 0.0, 1.0));
  c = mix(c, c5, clamp((t - 0.78) / 0.12, 0.0, 1.0));
  return mix(c, c6, clamp((t - 0.90) / 0.10, 0.0, 1.0));
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

// Distance to a segment, the parameter of the nearest point, and which side.
vec3 segInfo(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float l2 = max(dot(ab, ab), 1e-8);
  float t = clamp(dot(p - a, ab) / l2, 0.0, 1.0);
  vec2 d = p - a - ab * t;
  float side = ab.x * (p.y - a.y) - ab.y * (p.x - a.x);
  return vec3(length(d), t, side < 0.0 ? -1.0 : 1.0);
}

// A region's turn as drawn: the hand's, plus a bounded share of its own.
float effTwist(int i) { return uRegionTwist[i] + WIND_VIS * uRegionWind[i]; }

void main() {
  gT = uStill > 0.5 ? STILL_T : uTime;
  float minRes = max(min(uRes.x, uRes.y), 1.0);
  float starR = max(uStarRadius, 1e-3);
  float radiusPx = max(starR * minRes * 0.5, 1.0);
  gGranF = clamp(radiusPx / GRAN_PX, GRAN_F_MIN, GRAN_F_MAX);
  gCellPx = GRAN_PX;
  vec2 uv = vScreen * uRes / (starR * minRes);   // star radius = 1
  float r = length(uv);
  float aa = 1.5 / radiusPx;

  float cy = cos(uRotLon - uCamYaw), sy = sin(uRotLon - uCamYaw);
  float cp = cos(uCamPitch), sp = sin(uCamPitch);

  vec3 col = vec3(0.0);
  float disc = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, r);
  vec3 pSurf = vec3(0.0);   // star-frame surface point under this pixel (disc only)

  // ---- photosphere ----
  if (r < 1.0 + aa) {
    float rc = min(r, 0.99999);
    vec2 sxy = r > 0.99999 ? uv * (0.99999 / r) : uv;
    vec3 v = vec3(sxy, sqrt(max(0.0, 1.0 - rc * rc)));
    float mu = v.z;
    // view -> star: rotX(-pitch), then rotY(yaw - rotLon)
    vec3 p = rotY(rotX(v, cp, -sp), cy, -sy);
    pSurf = p;

    // (2) ripples and twist warp the noise domain. The region with the
    // largest |turn| (in practice the held one; at most one region carries
    // more than a turn) is applied last, in two BRANCHES (see below).
    int dom = -1;
    float domAbs = 0.0;
    for (int i = 0; i < 6; i++) {
      if (i >= uRegionCount) break;
      float at = abs(effTwist(i));
      if (at > domAbs) { domAbs = at; dom = i; }
    }
    vec3 q = p;
    float shade = 0.0;
    float maxShear = 0.0;
    vec3 domC = vec3(0.0, 0.0, 1.0);
    float domD = 4.0;
    // the fibril whorl is drawn for ONE region per pixel (the one that owns
    // it most), so its noise is sampled once, after the loop
    int fibI = -1;
    float fibW = 0.0;
    float fibW2 = 0.0;
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
        env *= 0.65 + 0.35 * sin(d * 9.0 - gT * 0.45);   // wave groups, not a stamp
        float ph = d * RIPPLE_K - gT * RIPPLE_W;
        q += dir * (sin(ph) * env * 0.010);
        shade += cos(ph) * env * 0.07;
      }
      float reach = mix(0.20, 0.44, T);
      float fw = smoothstep(0.02, 0.40, T) * smoothstep(0.012, 0.05, d) * (1.0 - smoothstep(0.45 * reach, reach, d));
      if (fw > fibW) { fibW2 = fibW; fibW = fw; fibI = i; } else if (fw > fibW2) { fibW2 = fw; }
      if (i == dom) { domC = c; domD = d; continue; }
      float shear;
      float a = twistAngle(d, TAU * effTwist(i), shear);
      maxShear = max(maxShear, shear);
      q = rotAxis(q, c, a);
    }

    // The dominant twist. A rotation by 2*pi is the identity, so the rigid
    // core can turn by the FULL angle while the falloff ring carries only
    // the wrapped remainder: branch A winds the ring by the angle's
    // fractional turn f in [0, 1), branch B by f - 1. Both agree exactly in
    // the core; they are blended (B weight = f) so everything is continuous
    // in the turn count, and the ring's winding never exceeds about half a
    // turn at full weight: no concentric-ring lanes at 6 turns.
    float g = GRAN_MEAN;
    float gUn = GRAN_MEAN;     // the same field with its granules unresolved
    {
      float F = dom >= 0 ? effTwist(dom) : 0.0;
      float f = F - floor(F);
      // a lane is foreshortened toward the limb as well as sheared
      float lane0 = radiusPx / gGranF * (0.25 + 0.75 * mu);
      gCellPx = lane0;
      for (int b = 0; b < 2; b++) {
        float wb = b == 0 ? 1.0 - f : f;
        if (wb < 1e-3) continue;
        float ringTurns = b == 0 ? f : f - 1.0;
        float shear;
        float a = twistAngle(domD, TAU * ringTurns, shear);
        vec3 qb = normalize(rotAxis(q, domC, a));
        float s = max(maxShear, shear);
        // lanes fade only where they would still drop under ~2 px, and then
        // to the layer's own unresolved mean, never to a flat tone
        vec2 gr = granulation(qb);
        float gb = mix(gr.y, gr.x, smoothstep(LANE_PX_MIN, LANE_PX_OK, lane0 / (1.0 + s)));
        g += wb * (gb - GRAN_MEAN);
        gUn += wb * (gr.y - GRAN_MEAN);
      }
    }
    float fibK = 0.0;
    float fibN = 0.0;

    // (3b) the fibril whorl: around a tense region the granules give way to
    // long fibres (bright strands, crisp dark lanes between them), radial at
    // rest, wound into a spiral by the field's turns. Azimuth runs on a noise
    // circle, log-radius along the third axis, so fibres are long, uneven
    // and never a regular comb; a finer octave joins where a pixel holds it.
    if (fibI >= 0 && fibW > 0.002) {
      vec3 c = uRegionPos[fibI];
      float T = uRegionTension[fibI];
      vec3 east, north;
      frameAt(c, east, north);
      vec3 rad = p - c * dot(p, c);
      float d = length(p - c);
      float phi = atan(dot(rad, north), dot(rad, east) + 1e-6);
      float E = uRegionTwist[fibI] + uRegionWind[fibI];
      float wraps = FIB_WRAPS * E / (1.0 + FIB_SAT * abs(E));
      float reach = mix(0.20, 0.44, T);
      float u = clamp(log(max(d, FIB_R0) / FIB_R0) / log(reach / FIB_R0), 0.0, 1.0);
      float phiT = phi + TAU * wraps * pow(1.0 - u, 1.5);
      float lr = log(max(d, FIB_R0));
      vec3 fd = vec3(cos(phiT), sin(phiT), 0.0) * FIB_ARMS
              + vec3(0.0, 0.0, lr * 1.1 + float(fibI) * 7.3 - gT * 0.015);
      float fine = smoothstep(4.0, 9.0, d * radiusPx * mu * 0.19);   // px per fine fibre
      float n = gnoise(fd) + 0.55 * fine * gnoise(fd * 2.6 + vec3(11.0, 4.0, lr * 0.6));
      fibK = fibW * smoothstep(0.0, 0.35, (fibW - fibW2) / fibW);
      fibN = n;
    }
    // fibres: dark lanes on the noise's zero crossings, strands between them
    float fibLane = smoothstep(0.015, 0.13, abs(fibN));
    float fibre = (0.10 + 0.90 * fibLane) * (0.30 + 1.30 * smoothstep(-0.55, 0.65, fibN));
    // the whorl's edge is frayed by its own fibres: strands run out into the
    // granulation unevenly, so there is no disc-shaped boundary
    float fibMix = smoothstep(0.22, 0.78, fibK + 0.50 * fibN) * smoothstep(0.0, 0.12, fibK);
    float lum = (0.21 + 1.55 * mix(g, gUn * fibre * 0.80, fibMix * 0.92)) * (1.0 + shade);
    float fibHot = fibK * fibLane * max(fibN, 0.0) * max(fibN, 0.0);

    // (4) pores: a charred umbra and a thin incandescent rim. The rim takes
    // the granules' own structure, so it is a ring of bright filaments and
    // never a smooth pale halo.
    float rim = 0.0;
    for (int i = 0; i < 6; i++) {
      if (i >= uRegionCount) break;
      float T = uRegionTension[i];
      float D = smoothstep(0.12, 0.55, T);
      if (D <= 0.0) continue;
      vec3 c = uRegionPos[i];
      vec3 east, north;
      frameAt(c, east, north);
      float beta = -TAU * effTwist(i);                 // the pair turns rigidly with the field
      vec3 axis = east * cos(beta) + north * sin(beta);
      float sep = 0.06 + 0.10 * T;
      float rp = 0.018 + 0.030 * T;
      for (int s = 0; s < 2; s++) {
        float sg = s == 0 ? 0.5 : -0.5;
        vec3 pc = normalize(c + axis * (sep * sg));
        float dd = length(p - pc);
        float umbra = 1.0 - smoothstep(rp * 0.50, rp * 1.00, dd);
        lum *= mix(1.0, 0.012, D * umbra);
        float e = (dd - rp * 1.16) / (rp * 0.20);
        rim += D * exp(-e * e);
      }
    }

    // (5) limb darkening acting on heat, so the colour falls through gold,
    // orange and ember red to near-black at the very edge
    float limbI = 0.04 + 0.96 * pow(mu, 1.25);
    float heat = limbI * (lum + (rim * 0.85 + fibHot * 0.55) * (0.25 + 1.5 * g));
    col = heatRamp(1.0 - exp(-1.30 * heat)) * disc;
  }

  // (6) the corona: three layers of glow, so the star bleeds into the dark
  // instead of ending at a cut edge. A tight incandescent rim at the limb,
  // a mid glow, and a wide red veil carried by streamers. The streamer
  // noise is sampled on the star-frame direction of the limb point each ray
  // passes over, so the streamers turn with the orbit; every layer is
  // faded to nothing before the canvas edge.
  float off = max(r - 1.0, 0.0);
  if (r > 1.0 - aa) {
    vec2 dv = uv / max(r, 1e-4);
    vec3 ld = rotY(rotX(vec3(dv, 0.0), cp, -sp), cy, -sy);
    float cn = gnoise(ld * 2.2 + vec3(0.0, gT * 0.020, 4.0));
    float cf = gnoise(ld * 6.0 + vec3(gT * 0.035, 0.0, off * 1.6 - gT * 0.05));
    float stream = clamp(0.62 + 0.75 * cn + 0.35 * cf, 0.12, 1.6);
    vec2 edge = uRes / (starR * minRes) - abs(uv);
    float edgeFade = smoothstep(0.0, 0.30, min(edge.x, edge.y));
    float rimG = exp(-off * 18.0) * 0.85;
    float midG = exp(-off * 4.6) * 0.46 * (0.55 + 0.45 * stream);
    float wideG = 0.30 / (1.0 + 5.5 * off * off) * stream;
    vec3 cor = vec3(1.0, 0.64, 0.24) * rimG + vec3(1.0, 0.40, 0.09) * midG + vec3(0.92, 0.24, 0.04) * wideG;
    col += cor * edgeFade * (1.0 - disc);
  }

  // (7) arches: a prominence over each pore pair, above the surface. The
  // loop geometry is found per region; the NEAREST one (in ribbon widths) is
  // then drawn once, after the loop, so its noise is sampled once per pixel.
  // That noise lives in the loop's own coordinates (along, across) and is
  // stretched ALONG the loop: it makes threads, torn edges and a sheath of
  // wisps, never beads. The ribbon tapers to its feet and flickers.
  float aN = 1e3;
  float aD = 1e3;
  float aD2 = 1e3;
  float aU = 0.0;
  float aSide = 1.0;
  float aW = 0.02;
  float aT = 0.0;
  float aGain = 0.0;
  float aSeed = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= uRegionCount) break;
    float T = uRegionTension[i];
    float gain = smoothstep(0.05, 0.35, T);
    if (gain <= 0.0) continue;
    vec3 c = uRegionPos[i];
    vec3 east, north;
    frameAt(c, east, north);
    float beta = -TAU * effTwist(i);
    vec3 axis = east * cos(beta) + north * sin(beta);
    float sep = 0.06 + 0.10 * T;
    vec3 A = normalize(c + axis * (sep * 0.5));
    vec3 B = normalize(c - axis * (sep * 0.5));
    float H = sep * (0.5 + 1.4 * T) * (1.0 + 0.03 * sin(gT * 0.7 + float(i) * 1.7));
    float expo = mix(0.95, 0.55, T);                           // taut: fuller, straighter legs
    float w = mix(0.034, 0.015, T);                            // ribbon half-width, radius units
    // second strand: lower, peeling sideways off the pair axis
    vec3 side = cross(c, axis) * (sep * 0.22);
    float best = 1e3;
    float best2 = 1e3;
    float bu = 0.0;
    float bs = 1.0;
    bool strand2 = uQuality >= Q_REDUCED;                      // the reduced path draws one strand
    vec3 prevV = rotX(rotY(A, cy, sy), cp, sp);
    vec3 prevW = prevV;
    for (int j = 1; j < ARCH_N; j++) {
      float u = float(j) / float(ARCH_N - 1);
      float sh = pow(max(sin(PI * u), 0.0), expo);
      vec3 S = normalize(mix(A, B, u));
      vec3 V = rotX(rotY(S * (1.0 + H * sh), cy, sy), cp, sp);
      vec3 M = 0.5 * (prevV + V);
      float behind = (1.0 - smoothstep(-0.02, 0.02, M.z)) * (1.0 - smoothstep(0.98, 1.02, length(M.xy)));
      vec3 si = segInfo(uv, prevV.xy, V.xy);
      float dj = si.x + behind * 1e3;
      if (dj < best) { best = dj; bu = (float(j - 1) + si.y) / float(ARCH_N - 1); bs = si.z; }
      if (strand2) {
        vec3 W = rotX(rotY(normalize(S + side * sh) * (1.0 + 0.80 * H * sh), cy, sy), cp, sp);
        best2 = min(best2, segDist(uv, prevW.xy, W.xy) + behind * 1e3);
        prevW = W;
      }
      prevV = V;
    }
    float nd = min(best, best2) / w;
    if (nd < aN) {
      aN = nd; aD = best; aD2 = best2; aU = bu; aSide = bs;
      aW = w; aT = T; aGain = gain; aSeed = float(i) * 5.7;
    }
  }
  if (aGain > 0.0 && aN < 16.0) {
    float crown = pow(max(sin(PI * aU), 0.0), 0.8);
    float taper = 0.26 + 0.74 * crown;                         // thin at the feet, full at the crown
    // the centreline wanders (most at the crown, feet anchored), slowly in time
    float wob = gnoise(vec3(aU * 3.0 + aSeed, 7.0, gT * 0.45));
    float sx = aSide * aD / aW + 1.5 * wob * crown;            // across the loop, in half-widths
    float dW = abs(sx) * aW;
    float n1 = gnoise(vec3(aU * 2.3 + aSeed, sx * 0.35, gT * 0.30));
    // threads run ALONG the loop but lean across it (the sx term in the first
    // coordinate), so they braid over the ribbon instead of ringing it
    float n2 = gnoise(vec3(aU * 6.0 + sx * 0.55 - gT * 0.25 + aSeed, sx * 1.15 - aU * 2.0, gT * 0.45 + 3.0));
    float flick = 0.80 + 0.40 * gnoise(vec3(gT * 2.3, aSeed, 1.3));
    float wv = aW * taper * (0.95 + 0.95 * n1);
    float core = exp(-(dW * dW) / (wv * wv)) * (0.75 + 0.60 * n2);
    float wt = 0.6 * aW * taper;
    float strand = exp(-(aD2 * aD2) / (wt * wt)) * 0.60 * (0.35 + 1.10 * smoothstep(-0.30, 0.40, n1));
    // the torn sheath: a wide skirt of threads, heavier on a slack loop
    float ws = aW * (0.9 + 0.8 * crown);
    float sheath = exp(-(dW * dW) / (5.0 * ws * ws)) * smoothstep(0.02, 0.50, n2 + 0.45 * n1)
                 * (0.42 + 0.40 * (1.0 - aT)) * (0.30 + 0.70 * crown);
    float flank = exp(-(aD * aD) / (7.0 * aW * aW)) * (1.0 - clamp(core, 0.0, 1.0));
    float glow = exp(-aD / (aW * 3.0)) * 0.18;
    // amber-gold, brighter as it pulls taut; never past the ramp's gold
    vec3 archCol = heatRamp(0.80 + 0.17 * aT);
    col *= 1.0 - 0.30 * flank * aGain * disc;                  // the ribbon's shadow over the disc
    col = mix(col, archCol, clamp((max(core, strand) + sheath) * aGain * (0.75 + 0.25 * aT) * flick, 0.0, 1.0));
    col += archCol * glow * aGain * flick * (1.0 - 0.6 * disc);
  }

  // (9) the snap. Every term below is exactly zero when its uniform is 0.
  // Footpoint in view space (star -> view, as the arches do), and the snap's
  // gain, carried as the length of uPlumeDir (snapFx.js).
  vec3 fv = rotX(rotY(uFlashPos, cy, sy), cp, sp);
  float fxGain = length(uPlumeDir);
  vec3 pDir = uPlumeDir / max(fxGain, 1e-4);

  // (9b) ejection structure, sampled first because the shock uses it too.
  // A handful of noise samples per pixel, outside any loop, only while a
  // plume or halo is in flight (never both: facing decides). Polar
  // coordinates about the ejection's centre. Two LOW angular samples tear
  // the front itself: its radius is displaced by up to EJ_JAG of itself and
  // its thickness varies, so there is no clean circle to see. Three octaves
  // of radial streaks (angular coordinate warped by radius, radial one
  // measured FROM THE FRONT so they ride out with it) break the front, the
  // body and the spray thrown ahead into filaments of uneven length. The
  // seed is the footpoint, so every snap tears differently.
  float ejS = max(uPlume, uHalo);
  vec2 dl = pDir.xy;
  float dlen = length(dl);
  dl = dlen > 1e-3 ? dl / dlen : vec2(0.0, 1.0);
  vec2 ejC = vec2(0.0);        // centre of the shell / bubble
  float ejR = 0.0;             // its front radius
  float plD = 0.0;             // plume: anchor -> bubble centre distance
  if (uHalo > 0.0) {
    ejC = fv.xy * (1.0 - 0.6 * smoothstep(0.0, 0.35, ejS));
    // apparent radius of something coming at the viewer: grows faster and
    // faster (speed 6 -> 12 radii per unit progress): at the limb ~0.8 s,
    // across the stage by ~2.5 s, out of a 950x460 stage by ~2.8 s
    ejR = 0.12 + 6.0 * ejS + 3.0 * ejS * ejS;
  } else if (uPlume > 0.0) {
    plD = 0.18 + PLUME_REACH * (1.0 - pow(1.0 - ejS, 1.4));
    ejC = fv.xy + dl * plD;
    ejR = PLUME_BUBBLE * plD;
  }
  float ejN = 0.0;
  float ejNear = 0.0;
  float nLow = 0.0;
  float nMid = 0.0;
  if (ejS > 0.0) {
    vec2 e = uv - ejC;
    float ed = length(e);
    vec2 eu = ed > 1e-5 ? e / ed : vec2(1.0, 0.0);
    vec3 sd = uFlashPos * 19.0;
    nLow = gnoise(vec3(eu * 1.5, 2.0) + sd);
    nMid = gnoise(vec3(eu * 4.1, 6.0) + sd);
    // The streaks radiate from where the plasma comes from: the halo's own
    // centre, but for a plume the FOOTPOINT, so its filaments fan out along
    // the ejection instead of bristling around the bubble.
    bool isHalo = uHalo > 0.0;
    vec2 sc = isHalo ? ejC : fv.xy;
    float angF = isHalo ? EJ_ANG_F : EJ_ANG_F * 2.6;
    vec2 e2 = uv - sc;
    float ed2 = length(e2);
    vec2 eu2 = ed2 > 1e-5 ? e2 / ed2 : vec2(1.0, 0.0);
    float wa = EJ_WARP * ed2;
    float cw = cos(wa), sw = sin(wa);
    vec2 euw = vec2(eu2.x * cw - eu2.y * sw, eu2.x * sw + eu2.y * cw);
    float rf = isHalo ? ed2 - ejR : ed2 - (plD + ejR);
    float px = ed2 * radiusPx * EJ_ANG_F / angF;   // finer octaves fade in once a pixel can hold them
    float s1 = gnoise(vec3(euw * angF, rf * 0.45 + gT * 0.12 + 7.3) + sd);
    float s2 = gnoise(vec3(euw * (angF * 2.3), rf * 1.1 - gT * 0.20 + 1.3) + sd);
    float s3 = gnoise(vec3(euw * (angF * 5.3), rf * 2.4 + 4.1) + sd);
    ejN = s1 * smoothstep(2.0, 10.0, px) + 0.55 * s2 * smoothstep(8.0, 30.0, px) + 0.30 * s3 * smoothstep(25.0, 70.0, px);
    ejNear = smoothstep(0.0, 0.45 * max(isHalo ? ejR : plD, 1e-3), ed2);
  }
  float tear = 1.0 + EJ_JAG * 1.6 * (0.62 * nLow + 0.38 * nMid);   // the front's radius, torn
  float thick = 0.50 + 1.10 * smoothstep(-0.5, 0.5, nMid);         // and its thickness
  // brightness along the front: a few long arcs of uneven length (the low
  // samples) under a light striation, never a row of even knots
  float knot = (0.20 + 1.15 * smoothstep(-0.32, 0.36, 0.85 * nLow + 0.50 * nMid))
             * (0.80 + 0.40 * smoothstep(-0.40, 0.40, ejN));
  float fing = smoothstep(0.05, 0.60, ejN);                        // where spray is thrown ahead
  // filament contrast in the body, mean ~0.9; neutral at the streaks' origin,
  // where polar coordinates are singular
  float fil = mix(0.9, 0.18 + 1.50 * smoothstep(-0.40, 0.55, ejN), ejNear);

  // (9a) shock: a ring crossing the SURFACE from the footpoint (angular
  // distance in the star frame), decelerating; soft leading edge, longer
  // wake. It brightens the photosphere it passes, then runs on as a faint
  // ring in the corona around the projected footpoint. Its radius and
  // strength take the ejection's tear, so it is a ragged front too.
  if (uShock > 0.0) {
    float s = uShock;
    float I = fxGain * smoothstep(0.0, 0.06, s) * (1.0 - s) * (1.0 - s);
    float rag = 1.0 + 0.5 * (tear - 1.0);
    float R = SHOCK_REACH * (1.0 - pow(1.0 - s, 2.2)) * rag;
    float lead = 0.05 + 0.06 * s;
    float wake = 0.12 + 0.30 * s;
    float ang = acos(clamp(dot(pSurf, uFlashPos), -1.0, 1.0));
    float x = ang - R;
    float ring = x > 0.0 ? exp(-(x * x) / (lead * lead)) : exp(x / wake) * (0.55 + 0.45 * exp(-(x * x) / (lead * lead)));
    ring *= disc * I * (0.55 + 0.55 * thick);
    col *= 1.0 + 0.55 * ring;
    col += vec3(1.0, 0.60, 0.20) * ring * 0.10;
    float dc = length(uv - fv.xy);
    float Rc = (0.10 + SHOCK_REACH * 1.15 * (1.0 - pow(1.0 - s, 2.2))) * rag;
    float wc = (0.05 + 0.12 * s) * thick;
    float xc = (dc - Rc) / wc;
    col += vec3(1.0, 0.50, 0.15) * exp(-xc * xc) * I * 0.22 * knot * (1.0 - disc) * exp(-off * 1.2);
  }

  // (9c) plume (not facing): the three-part ejection leaving the limb, torn.
  // A bubble (centre ejC, radius ejR = PLUME_BUBBLE * plD, displaced by the
  // tear) rides out along the projected normal, self-similar so it widens as
  // it goes: a ragged leading arc of uneven knots (weighted toward the
  // front) with spray thrown ahead of it in fingers, a cavity crossed by
  // wisps, a tangled core low in the bubble, and two frayed legs that curve
  // back from the bubble's flanks to the anchor (the footpoint). In front of
  // the disc when the footpoint faced front, behind it otherwise.
  if (uPlume > 0.0) {
    float s = uPlume;
    float I = (0.55 + 0.45 * fxGain) * smoothstep(0.0, 0.04, s) * pow(1.0 - s, 1.2);
    vec2 e = uv - ejC;
    float ed = length(e);
    float cosT = ed > 1e-5 ? dot(e, dl) / ed : 0.0;
    float front = 0.04 + 0.96 * smoothstep(-0.25, 0.75, cosT);
    float Rb = ejR * tear;
    float sw = (0.035 + 0.10 * ejR) * thick;                      // shell width
    float xs = (ed - Rb) / sw;
    float shell = exp(-xs * xs) * front * knot;
    float spray = ed > Rb ? exp(-(ed - Rb) / (0.03 + 0.55 * ejR * fing)) * fing * front * 0.40 : 0.0;
    float wisps = (1.0 - smoothstep(0.55, 1.0, ed / max(Rb, 1e-3))) * smoothstep(0.15, 0.75, ejN) * 0.20;
    float coreB = exp(-pow(length(e + dl * ejR * 0.45) / (0.24 * ejR), 2.0)) * 0.42 * (0.35 + 0.85 * fil);
    // legs, in the anchor's frame: along a, across c; half-gap grows with a
    // as a concave curve, meeting the bubble's flanks near its centre. Their
    // noise runs ALONG the leg (threads, a wandering edge), one sample each.
    vec2 w = uv - fv.xy;
    float a = dot(w, dl);
    float c = dot(w, vec2(-dl.y, dl.x));
    float sgn = c < 0.0 ? -1.0 : 1.0;
    float plDs = max(plD, 1e-3);   // plD is 0 unless the plume branch ran; never divide by it
    float u = clamp(a / plDs, 0.0, 1.0);
    float lw = 0.025 + 0.06 * ejR;
    float lnA = gnoise(vec3(a * 2.6 - gT * 0.30, sgn * 4.0, 5.0) + uFlashPos * 19.0);
    float gap = 0.92 * ejR * pow(u, 0.6) * (1.0 + 0.30 * lnA);
    float xl = (abs(c) - gap) / lw;
    float lnB = gnoise(vec3(a * 5.0 - gT * 0.55, xl * 0.8 + sgn * 9.0, 2.0) + uFlashPos * 19.0);
    float legs = (exp(-xl * xl) * (0.50 + 0.80 * smoothstep(-0.35, 0.40, lnB))
                + exp(-xl * xl / 9.0) * smoothstep(0.0, 0.5, lnB) * 0.30)
               * smoothstep(0.0, 0.25, u) * (1.0 - smoothstep(0.80, 1.10, a / plDs)) * 0.85;
    float dens = shell + spray + wisps + coreB + legs;
    dens *= mix(1.0 - disc, 1.0, smoothstep(-0.05, 0.05, fv.z));
    vec3 hot = vec3(1.0, 0.76, 0.34);
    vec3 amber = vec3(1.0, 0.56, 0.14);
    col += mix(amber, hot, clamp(shell, 0.0, 1.0)) * dens * I * 1.25;
  }

  // (9d) halo (facing): a shell of plasma rushing AT the viewer. Born at the
  // projected footpoint, centre drifting toward the disc centre, radius
  // accelerating past the limb and out of frame. Its leading front is torn
  // (displaced radius, uneven thickness, broken into knots), spray runs
  // ahead of it in fingers, and the thicker body behind is streaked by the
  // radial filaments at full contrast; full strength until it leaves, then
  // fading. Passing over the disc it lays a faint veil on it.
  if (uHalo > 0.0) {
    float s = uHalo;
    float I = (0.65 + 0.35 * clamp((fxGain - 0.35) / 0.65, 0.0, 1.0))
            * smoothstep(0.0, 0.03, s) * (1.0 - smoothstep(0.50, 1.0, s));
    float dh = length(uv - ejC);
    float x = dh - ejR * tear;                                    // + outside the front
    float wf = (0.030 + 0.025 * ejR) * thick;
    float wb = 0.20 + 0.30 * ejR;
    float fr0 = exp(-(x * x) / (wf * wf));
    float fr = fr0 * knot;
    float body = x < 0.0 ? 0.45 * exp(x / wb) * (1.0 - fr0) : 0.0;
    // streak contrast grows with depth behind the front, zero at it
    float deep = x < 0.0 ? 1.0 - exp(x / (3.0 * wf)) : 0.0;
    float spray = x > 0.0 ? exp(-x / (0.03 + 0.50 * ejR * fing)) * fing * 0.32 : 0.0;
    float dens = (fr + body * mix(0.9, fil, deep) + spray) / (1.0 + 0.10 * ejR);
    // over the bright disc a thin shade just inside the front draws its edge
    float xin = (x + 2.2 * wf) / wf;
    col *= 1.0 - 0.22 * disc * exp(-xin * xin) * I;
    vec3 hot = vec3(1.0, 0.78, 0.36);
    vec3 amber = vec3(1.0, 0.58, 0.16);
    vec3 hc = mix(amber, hot, clamp(fr, 0.0, 1.0)) * dens * I;
    col *= 1.0 + 0.18 * dens * I * disc;                          // the veil as it passes the disc
    col += hc * mix(1.1, 0.35, disc);
  }

  // the exposure dip: the flash's white reads anywhere on the disc because
  // everything else darkens with it, recovering as uFlash decays (~0.5 s);
  // identity at uFlash = 0
  col *= 1.0 - FLASH_DIP * min(uFlash, 1.0);

  // (8) never white, dither, premultiplied alpha
  col = min(col, CAP);

  // (11) the aurora: in front of everything, in screen space, the star still
  // visible through it. Three folding curtains (nearest brightest, lowest,
  // fastest), each a sharp lower hem decaying upward, with vertical rays
  // drifting along it. Oxygen 557.7 nm green body; the 630 nm red crown
  // sits higher and only for strong storms (uAuroraRed). Composited after
  // CAP as a veil then a screen blend: smooth (no clip plateau) and never
  // white. Every term is continuous; the dither below breaks any banding.
  if (uAurora > 0.0) {
    vec2 s = vScreen * uRes / minRes;             // short axis spans -1..1
    float A = min(uAurora, 1.0);
    float reach = mix(0.55, -0.05, A);            // stronger storms hang lower
    float tall = 0.10 + 0.10 * A;                 // green body above the hem
    float gSum = 0.0;
    float rSum = 0.0;
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      float depth = 1.0 - 0.3 * fk;
      float x = s.x * (1.0 + 0.3 * fk) + fk * 1.7;
      // the hem folds: one slow swell, then noise at two scales, so it is never a clean wave
      float fold = 0.12 * sin(x * 0.9 + gT * 0.07 * (1.0 + 0.3 * fk) + fk * 2.0)
                 + 0.17 * gnoise(vec3(x * 0.8, fk * 3.1, gT * 0.05))
                 + 0.05 * gnoise(vec3(x * 2.3, fk * 3.1 + 9.0, gT * 0.09));
      float dy = s.y - (reach + 0.2 * fk + fold);
      // rays: tall vertical streaks drifting along the curtain, high contrast
      float rx = x * 8.0 + 1.6 * gnoise(vec3(x * 1.3, fk + 7.0, gT * 0.06)) - gT * 0.12 * (1.0 + 0.5 * fk);
      float rn = clamp(0.5 + 0.95 * gnoise(vec3(rx, dy * 0.25, gT * 0.10 + fk * 4.0)), 0.0, 1.0);
      float rays = rn * rn;
      float hem = smoothstep(-0.012, 0.02, dy);
      float up = max(dy, 0.0);
      float body = exp(-up / (tall * (0.6 + 0.8 * rn)));   // rays reach higher than the gaps
      float edge = exp(-up / 0.025);                          // the bright lower edge
      gSum += hem * (body * (0.12 + 0.88 * rays) + edge * (0.35 + 0.65 * rn)) * depth;
      // the 630 nm red rises from the ray tops, above the green
      float top = up - tall * 1.1;
      rSum += smoothstep(-0.08, 0.06, top) * exp(-max(top, 0.0) / 0.32) * rays * hem * depth;
    }
    float g = (1.0 - exp(-gSum * 1.3)) * A;
    float rd = (1.0 - exp(-rSum * 1.2)) * uAuroraRed;
    col *= 1.0 - min(0.3 * g + 0.2 * rd, 0.35);
    vec3 em = vec3(0.16, 0.95, 0.40) * g + vec3(0.85, 0.05, 0.16) * rd * 0.8;
    col = 1.0 - (1.0 - col) * (1.0 - min(em, vec3(0.9)));
  }

  // (10) the reconnection flash: the ONLY light allowed past CAP. A tight
  // blinding white core, an over-exposure bleed (white -> pale gold -> gone
  // within a small radius), six short soft diffraction-like rays, and a
  // faint gold glow; hidden by the disc when the footpoint is on the far
  // side, bleeding past the limb when it is near it.
  if (uFlash > 0.0) {
    vec2 d = uv - fv.xy;
    float df = length(d);
    float vis = smoothstep(-0.35, 0.0, fv.z) * mix(1.0 - disc, 1.0, smoothstep(-0.05, 0.05, fv.z));
    float core = exp(-(df * df) / (FLASH_CORE * FLASH_CORE)) * 3.0;
    float bleed = exp(-df / 0.045) * 1.1;
    vec3 bleedC = mix(vec3(1.0, 0.86, 0.55), vec3(1.0), exp(-df / 0.03));
    float rot = hash12(uFlashPos.xy * 97.0 + uFlashPos.z * 13.0) * TAU;
    float phi = atan(d.y, d.x + 1e-6);
    float ray = pow(abs(cos(3.0 * phi + rot)), 48.0) * exp(-df / 0.09) * smoothstep(0.01, 0.03, df) * 0.7;
    vec3 rayC = mix(vec3(1.0, 0.80, 0.45), vec3(1.0), exp(-df / 0.05));
    float glow = exp(-df / 0.25) * 0.18;
    col += (vec3(1.0) * core + bleedC * bleed + rayC * ray + vec3(1.0, 0.70, 0.30) * glow) * uFlash * vis;
  }

  col += (hash12(gl_FragCoord.xy + fract(gT * 7.0) * 61.0) - 0.5) / 255.0;
  col = clamp(col, 0.0, 1.0);
  float alpha = max(disc, clamp(max(col.r, max(col.g, col.b)) * 1.25, 0.0, 1.0));
  fragColor = vec4(col, alpha);
}`;

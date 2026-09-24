// streakShader.js — 4096 instanced ribbons: idle drift, the ingress pinch,
// and the needle evaporation (spec §4.2, §5, §6.3).
//
// Stateless: every ribbon is a closed-form function of its seed, the uniforms
// and uPhaseT. Nothing is stored between frames.

import { ACCELERATE_MS, GEOMETRY, GAINS, TIMELINE } from './colliderPhases.js';
import { glslFloat as f, GLSL_HUE2RGB, GLSL_HASH } from './glsl.js';
import { RIBBON_VS_CHUNK } from './ribbonShader.js';

export const STREAK_UNIFORMS = [
  'uRes', 'uPx', 'uPhase', 'uPhaseT', 'uHue', 'uMass', 'uAccel', 'uLocus', 'uNeedleA', 'uBeams',
];

export const STREAK_VS = `#version 300 es
layout(location = 0) in vec4 aSeed; // lane[-1,1), birth, h1, h2

uniform vec2  uRes;       // canvas size, CSS px
uniform float uPx;        // device px per CSS px
uniform float uPhase;     // PHASE_ID
uniform float uPhaseT;    // seconds in phase
uniform vec2  uHue;       // hueA, hueB in [0,1)
uniform vec2  uMass;      // massA, massB in [0,1]
uniform vec2  uAccel;     // progress, ease
uniform vec2  uLocus;     // impact offset from centre, CSS px
uniform float uNeedleA;   // needle envelope (0 from 1200ms)
uniform vec4  uBeams[16]; // angle(rad), mag[0,1], hue[0,1), unused
${RIBBON_VS_CHUNK}
${GLSL_HUE2RGB}
${GLSL_HASH}
const float TAU       = 6.28318530718;
const float ACCEL_S   = ${f(ACCELERATE_MS / 1000)};
const float W_WALL    = ${f(GEOMETRY.W_WALL)};
const float KAPPA_LO  = ${f(GEOMETRY.KAPPA_LO)};
const float KAPPA_HI  = ${f(GEOMETRY.KAPPA_HI)};
const float A_TURB    = ${f(GEOMETRY.A_TURB)};
const float V1        = ${f(GEOMETRY.V1)};
const float TAIL_S    = ${f(GEOMETRY.INGRESS_TAIL_S)};
const float CAGE_R    = ${f(GEOMETRY.CAGE_R_PX)};
const float N_SHARE   = ${f(GEOMETRY.NEEDLE_SHARE)};
const float N_DRAG    = ${f(GEOMETRY.NEEDLE_DRAG)};
const float N_TAIL_S  = ${f(GEOMETRY.NEEDLE_TAIL_S)};
const float N_FROM_S  = ${f(TIMELINE.NEEDLE_LAUNCH_FROM_MS / 1000)};
const float N_SPAN_S  = ${f(TIMELINE.NEEDLE_LAUNCH_SPAN_MS / 1000)};
const float G_INGRESS = ${f(GAINS.INGRESS)};
const float G_NEEDLE  = ${f(GAINS.NEEDLE)};

// Curl of a cheap 2-octave sine field: divergence-free, so it swirls.
vec2 curl(vec2 p) {
  float e = 0.35;
  float n0 = sin(p.x * 1.7 + p.y * 2.3) + 0.5 * sin(p.x * 3.9 - p.y * 1.1);
  float nx = sin((p.x + e) * 1.7 + p.y * 2.3) + 0.5 * sin((p.x + e) * 3.9 - p.y * 1.1);
  float ny = sin(p.x * 1.7 + (p.y + e) * 2.3) + 0.5 * sin(p.x * 3.9 - (p.y + e) * 1.1);
  return vec2(ny - n0, -(nx - n0)) / e;
}

// ∫0^t (t'/T)^3 dt', slope 1 past T. Mirrors easeIntegralS() in
// colliderPhases.js, which the tests pin. Position is the integral of speed;
// the legacy fract(birth + t * speed(t)) arrived ~3x too fast.
float easeIntegral(float t) {
  if (t <= 0.0) return 0.0;
  if (t <= ACCEL_S) { float p = t / ACCEL_S; return ACCEL_S * p * p * p * p * 0.25; }
  return ACCEL_S * 0.25 + (t - ACCEL_S);
}

// A point on one side's beam at travel s (0 wall .. 1 core). The envelope
// W(s) = W_WALL * exp(-kappa s) pinches toward the core and sharpens with
// ease; turbulence lives at the wall and dies toward the core (spec §5.3).
vec2 beamPoint(float s, float side, float lane, float strand, float m, float ease, float t, out float bright) {
  vec2 c = uRes * 0.5;
  float x = side < 0.0 ? mix(0.0, c.x, s) : mix(uRes.x, c.x, s);
  float W = W_WALL * exp(-mix(KAPPA_LO, KAPPA_HI, ease) * s);
  // heavy: one coherent ribbon fluttering ~2.5 times over the whole travel
  float flutter = 0.6 * sin(TAU * 2.5 * s - t * 2.0 + side * 1.3);
  // volatile: three strands, a helix seen side-on, 12-18 cycles
  float ph = TAU * mix(18.0, 12.0, m) * s + strand * (TAU / 3.0) - t * 6.0;
  float braid = 0.35 * cos(ph);
  bright = mix(0.6 + 0.4 * sin(ph), 1.0, m);
  float off = W * (mix(0.25, 0.6, m) * lane + mix(braid, flutter, m));
  float fall = (1.0 - s) * (1.0 - s) * (1.0 - ease);
  vec2 turb = curl(vec2(x * 0.012, (c.y + lane * 20.0) * 0.05) + t * 0.35) * (A_TURB * fall);
  return vec2(x + turb.x, c.y + off + turb.y);
}

void main() {
  float lane  = aSeed.x;
  float birth = aSeed.y;
  float h1    = aSeed.z;
  float h2    = aSeed.w;
  float side  = h2 < 0.5 ? -1.0 : 1.0;
  uint  id    = uint(gl_InstanceID);
  vec2  c     = uRes * 0.5;
  vec2  head  = c;
  vec2  tail  = c;
  float halfW = 0.5;
  float alpha = 0.0;
  float tailA = 0.0;
  vec3  col   = hue2rgb(side < 0.0 ? uHue.x : uHue.y);

  if (uPhase <= 1.0) {
    // idle / selecting: the July ambient drift, now as short faint streaks
    float s = fract(birth + uPhaseT * 0.06);
    float st = max(s - 0.015, 0.0);
    float y = c.y + lane * 12.0 + sin(uPhaseT * 0.7 + h1 * TAU) * 3.0;
    head = vec2(uRes.x * s, y);
    tail = vec2(uRes.x * st, y);
    alpha = step(0.94, h1) * 0.35;
    halfW = 0.5;

  } else if (uPhase == 2.0) {
    // accelerating: the pinch
    float t = uPhaseT;
    float ease = uAccel.y;
    float m = side < 0.0 ? uMass.x : uMass.y;
    float strand = floor(hashI(id, 1u) * 3.0);
    float v0 = 0.35 + 0.45 * h1;
    float ph = birth + v0 * t + V1 * easeIntegral(t);
    float tt = t - TAIL_S;
    float phT = birth + v0 * tt + V1 * easeIntegral(tt);
    float s = fract(ph);
    float st = max(s - (ph - phT), 0.0);   // same lap as the head; clamps at the wall
    float bH;
    float bT;
    head = beamPoint(s, side, lane, strand, m, ease, t, bH);
    tail = beamPoint(st, side, lane, strand, m, ease, tt, bT);
    // Ingress/egress ramps: no pop-in at the wall, no pop-out at the core.
    alpha = smoothstep(0.0, 0.03, s) * smoothstep(1.0, 0.97, s) * (0.35 + 0.65 * ease) * bH * G_INGRESS;
    halfW = mix(0.35, 0.7, m);
    tailA = 0.15;

  } else if (uPhase == 3.0) {
    // colliding: needles. The partition is fixed by hash; the envelope gates
    // alpha, never the branch (trap 3, 2026-07-30).
    float isNeedle = step(hashI(id, 2u), N_SHARE);
    int k = min(int(hashI(id, 3u) * 16.0), 15);
    vec4 B = uBeams[k];
    float mBar = 0.5 * (uMass.x + uMass.y);
    float alive = step(hashI(id, 4u), B.y * mix(1.0, 0.35, mBar));
    float ang = B.x + (hashI(id, 5u) - 0.5) * (TAU / 16.0);
    float launch = N_FROM_S + N_SPAN_S * hashI(id, 6u);
    float v0 = (600.0 + 800.0 * hashI(id, 7u)) * mix(1.0, 0.6, mBar);
    float tauE = 0.06 + 0.08 * hashI(id, 8u);
    float age = uPhaseT - launch;
    vec2 dir = vec2(cos(ang), sin(ang));
    vec2 origin = c + uLocus + dir * CAGE_R;
    float rH = (v0 / N_DRAG) * (1.0 - exp(-N_DRAG * max(age, 0.0)));
    float rT = (v0 / N_DRAG) * (1.0 - exp(-N_DRAG * max(age - N_TAIL_S, 0.0)));
    head = origin + dir * rH;
    tail = origin + dir * rT;
    alpha = isNeedle * alive * step(0.0, age) * exp(-max(age, 0.0) / tauE) * uNeedleA * G_NEEDLE;
    halfW = 0.3;
    col = hue2rgb(B.z);
  }

  if (alpha <= 0.0) {
    // All four corners outside clip space: the instance rasterises nothing.
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    vAlpha = 0.0;
    return;
  }
  gl_Position = ribbonCorner(tail, head, halfW, uRes, uPx);
  vCol = col;
  vAlpha = alpha;
  vTailA = tailA;
  vGap = 0.0;
}
`;

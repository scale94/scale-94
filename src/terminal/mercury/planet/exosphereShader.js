// src/terminal/mercury/planet/exosphereShader.js — the exosphere box (phase-4 spec §7).
// Back faces of a box around halo + tail; the fragment clips its view ray to the box,
// adds the closed-form halo columns (Na + Hg vapour), and marches the Na tail with
// EXO_STEPS jittered samples. Depth-tested against the planet (which writes gl_FragDepth),
// never writes depth. Constants from mercuryExosphere (glf).
//
// Blend (option 2): premultiplied "over". rgb = emission (halo + tail), a = how much of the
// backdrop the TAIL hides (tailAlpha of its radiance): dst' = emission + dst * (1 - a). The
// halo contributes no alpha, so it stays purely additive and never darkens the limb; lite
// (EXO_STEPS 0) has no tail, alpha is 0 and the box is exactly the old additive halo.

import * as THREE from 'three';
import { glf, v3 } from '../../gl/glf';
import { R_SCENE } from './planetLook';
import {
  TAIL_W0, TAIL_SPREAD, H_NA, H_HG, NA_HALO_GAIN, NA_TAIL_GAIN, HG_GAIN, NA_COL, HG_COL,
  STREAM_AMP, STREAM_FREQ_S, STREAM_FREQ_P, STREAM_SPEED, EXO_DIM,
} from './mercuryExosphere';

// Material state for the box (MercuryExosphere spreads it).
export const EXO_MATERIAL = Object.freeze({
  transparent: true,
  depthTest: true,
  depthWrite: false,
  side: THREE.BackSide,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
});

// The box must draw AFTER the nebula flows (Particle/Thermal/Sediment/AtmosphericFlow:
// transparent, renderOrder 0). three sorts transparents back to front by renderOrder, then
// view z; the box's centre lies beyond the planet (z ~ 5.0 vs the flows' ~ 3.6), so at 0 it
// drew first and the opaque nebula sprites painted over the whole tail.
export const EXO_RENDER_ORDER = 1;

export const EXO_BUILTINS = ['modelMatrix', 'viewMatrix', 'projectionMatrix', 'cameraPosition'];
export const EXO_UNIFORMS = ['uWorldToBox', 'uTailAxis', 'uTailB', 'uTailL', 'uCoverage', 'uExoTime', 'uExoGain'];

const EXO_VS = /* glsl */ `in vec3 position;

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;

out vec3 vWorld;

void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const exoFs = (steps) => /* glsl */ `precision highp float;

in vec3 vWorld;
layout(location = 0) out vec4 fragColor;

uniform vec3 cameraPosition;
uniform mat4 uWorldToBox;
uniform vec3 uTailAxis;
uniform float uTailB;
uniform float uTailL;
uniform float uCoverage;
uniform float uExoTime;
uniform float uExoGain;

const float TAU = 6.28318530717959;
const float R_SCENE = ${glf(R_SCENE)};
const float TAIL_W0 = ${glf(TAIL_W0)};
const float TAIL_SPREAD = ${glf(TAIL_SPREAD)};
const float H_NA = ${glf(H_NA)};
const float H_HG = ${glf(H_HG)};
const float NA_HALO_GAIN = ${glf(NA_HALO_GAIN)};
const float NA_TAIL_GAIN = ${glf(NA_TAIL_GAIN)};
const float HG_GAIN = ${glf(HG_GAIN)};
const vec3 NA_COL = ${v3(NA_COL)};
const vec3 HG_COL = ${v3(HG_COL)};
const float STREAM_AMP = ${glf(STREAM_AMP)};
const float STREAM_FREQ_S = ${glf(STREAM_FREQ_S)};
const float STREAM_FREQ_P = ${glf(STREAM_FREQ_P)};
const float STREAM_SPEED = ${glf(STREAM_SPEED)};
const float EXO_DIM = ${glf(EXO_DIM)};
const int EXO_STEPS = ${steps};

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

// mercuryExosphere.haloColumn, exactly.
float haloColumn(float b, float H) {
  if (b <= R_SCENE) return 0.0;
  return exp(-(b - R_SCENE) / H) * sqrt(TAU * b * H);
}

// mercuryExosphere.tailDensity, plus a streamer noise drifting downstream.
float tailDensity(vec3 P) {
  float s = dot(P, uTailAxis);
  float r2 = dot(P, P);
  if (s <= 0.0 || r2 <= R_SCENE * R_SCENE) return 0.0;
  vec3 perp = P - uTailAxis * s;
  float w = TAIL_W0 + TAIL_SPREAD * s;
  float n = uTailB * exp(-s / uTailL) * exp(-dot(perp, perp) / (2.0 * w * w));
  float st = vnoise3(vec3((s - uExoTime * STREAM_SPEED) * STREAM_FREQ_S, 0.0, 0.0) + perp * STREAM_FREQ_P);
  return n * (1.0 + STREAM_AMP * (2.0 * st - 1.0));
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorld - ro);

  // Halo columns: closed form along the whole line of sight (one back face per pixel).
  float bq = dot(ro, rd);
  float b = length(ro - rd * bq);
  vec3 col = (NA_HALO_GAIN * uTailB * haloColumn(b, H_NA)) * NA_COL
           + (HG_GAIN * uCoverage * haloColumn(b, H_HG)) * HG_COL;

  float tailE = 0.0;
  if (EXO_STEPS > 0) {
    vec3 o = (uWorldToBox * vec4(ro, 1.0)).xyz;
    vec3 d = (uWorldToBox * vec4(rd, 0.0)).xyz;
    vec3 inv = 1.0 / (d + vec3(1e-9) * (step(vec3(0.0), d) * 2.0 - 1.0));
    vec3 t0 = (vec3(-0.5) - o) * inv;
    vec3 t1 = (vec3(0.5) - o) * inv;
    vec3 tmin = min(t0, t1), tmax = max(t0, t1);
    float tN = max(max(max(tmin.x, tmin.y), tmin.z), 0.0);
    float tF = min(min(tmax.x, tmax.y), tmax.z);
    float disc = bq * bq - (dot(ro, ro) - R_SCENE * R_SCENE);
    if (disc > 0.0) { float tS = -bq - sqrt(disc); if (tS > 0.0) tF = min(tF, tS); }
    if (tF > tN) {
      float dt = (tF - tN) / float(EXO_STEPS);
      float j = hash13(vec3(gl_FragCoord.xy, fract(uExoTime) * 61.0));
      float acc = 0.0;
      for (int i = 0; i < EXO_STEPS; i++) acc += tailDensity(ro + rd * (tN + (float(i) + j) * dt));
      tailE = NA_TAIL_GAIN * acc * dt * uExoGain;
      col += (NA_TAIL_GAIN * acc * dt) * NA_COL;
    }
  }

  col = max(col * uExoGain, 0.0);
  // mercuryExosphere.tailAlpha: the backdrop the tail hides (the halo adds no alpha).
  float tailA = 1.0 - exp(-EXO_DIM * tailE);
  vec3 srgb = mix(col * 12.92, 1.055 * pow(col, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), col));
  float dith = (fract(sin(dot(gl_FragCoord.xy + fract(uExoTime) * 61.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  // the dim is dithered too (no 8-bit contours on the backdrop); off the tail alpha stays exactly 0
  float alpha = tailA > 0.0 ? clamp(tailA + dith, 0.0, 1.0) : 0.0;
  fragColor = vec4(srgb + dith, alpha);
}
`;

export function buildExosphereShader({ steps }) {
  return { vs: EXO_VS, fs: exoFs(steps) };
}

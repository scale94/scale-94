// cageShader.js — the stereochemical cage (spec §6.2): 36 bond ribbons and
// 24 vertex discs, one instanced draw. Docks in on an under-damped spring,
// rings down in four modes with benzene's frequency ratios, then each bond
// fails and retracts into its vertices.

import { GEOMETRY, GAINS, TIMELINE, MODES } from './colliderPhases.js';
import { glslFloat as f, GLSL_HUE2RGB, GLSL_HASH } from './glsl.js';
import { RIBBON_VS_CHUNK } from './ribbonShader.js';
import { CAGE_VERTEX_COUNT } from './cageTopology.js';

export const CAGE_UNIFORMS = [
  'uRes', 'uPx', 'uLocus', 'uCageT', 'uCageA', 'uSquash', 'uModeF', 'uSpin', 'uHue3', 'uRest',
];

export const CAGE_VS = `#version 300 es
layout(location = 0) in vec3 aBond; // i, j, kind (0 bond, 1 vertex)

uniform vec2  uRes;
uniform float uPx;
uniform vec2  uLocus;
uniform float uCageT;   // seconds since impact, < 0 = cage inactive
uniform float uCageA;   // vertex fade envelope
uniform float uSquash;  // x-axis pressure squash
uniform vec4  uModeF;   // mode frequencies (Hz), mass-pitched in JS
uniform float uSpin;    // +1 / -1 handedness from the mass asymmetry
uniform vec3  uHue3;    // hueA, hueB, hue-space blend
uniform vec3  uRest[${CAGE_VERTEX_COUNT}];
${RIBBON_VS_CHUNK}
${GLSL_HUE2RGB}
${GLSL_HASH}
const float TAU        = 6.28318530718;
const float DOCK_S     = ${f(TIMELINE.DOCK_MS / 1000)};
const float BREAK_S    = ${f(TIMELINE.BOND_BREAK_FROM_MS / 1000)};
const float BREAK_SPAN = ${f(TIMELINE.BOND_BREAK_SPAN_MS / 1000)};
const float RETRACT_S  = ${f(TIMELINE.BOND_RETRACT_MS / 1000)};
const float CAGE_R     = ${f(GEOMETRY.CAGE_R_PX)};
const float CAM_D      = ${f(GEOMETRY.CAMERA_D)};
const float DOCK_FROM  = ${f(GEOMETRY.DOCK_FROM_PX)};
const float ZETA       = ${f(GEOMETRY.DOCK_ZETA)};
const float OMEGA      = ${f(GEOMETRY.DOCK_OMEGA)};
const float TUMBLE     = ${f(GEOMETRY.TUMBLE_RAD_S)};
const vec4  AMP        = vec4(${MODES.map((m) => f(m.amp)).join(', ')});
const vec4  TAU_D      = vec4(${MODES.map((m) => f(m.tauMs / 1000)).join(', ')});
const float G_BOND     = ${f(GAINS.BOND)};
const float G_VERTEX   = ${f(GAINS.VERTEX)};

// Mirrors dockCurve() in colliderPhases.js, which the tests pin.
float dockCurve(float t) {
  if (t <= 0.0) return 0.0;
  float k = sqrt(1.0 - ZETA * ZETA);
  float e = exp(-ZETA * OMEGA * t);
  return 1.0 - e * (cos(OMEGA * k * t) + (ZETA / k) * sin(OMEGA * k * t));
}

// Four damped modes, summed. x is the collision axis.
vec3 modal(int idx, vec3 r, float t) {
  float on = clamp(t / 0.02, 0.0, 1.0);
  uint u = uint(idx);
  vec3 hd = normalize(vec3(hashI(u, 11u), hashI(u, 12u), hashI(u, 13u)) - 0.5 + 1e-3);
  vec4 env = AMP * exp(-t / TAU_D) * sin(TAU * uModeF * t + vec4(hashI(u, 14u) * TAU, 0.0, 0.0, 0.0)) * on;
  r += hd * env.x;                    // C-H stretch: per vertex
  r += vec3(r.x, -r.y, 0.0) * env.y;  // C=C stretch: quadrupolar
  r *= 1.0 + env.z;                   // ring breathing: radial
  float a = env.w * r.x;              // out-of-plane bend: torsion about the axis
  float ca = cos(a);
  float sa = sin(a);
  r.yz = vec2(ca * r.y - sa * r.z, sa * r.y + ca * r.z);
  return r;
}

vec3 tumble(vec3 r, float t) {
  vec3 k = normalize(vec3(0.0, 1.0, 0.3));
  float a = uSpin * TUMBLE * t;
  float ca = cos(a);
  float sa = sin(a);
  return r * ca + cross(k, r) * sa + k * dot(k, r) * (1.0 - ca);
}

// xy = screen position in CSS px, z = depth in [0,1] (1 = nearest).
vec3 vertexScreen(int idx, float t) {
  vec3 rest = uRest[idx];
  float ti = t - 0.02 * hashI(uint(idx), 15u);   // staggered docking
  vec3 r = modal(idx, rest, max(t - DOCK_S, 0.0));
  r.x *= uSquash;
  r = tumble(r, t);
  vec2 centre = uRes * 0.5 + uLocus;
  vec2 target = centre + r.xy * (CAM_D / (CAM_D - r.z)) * CAGE_R;
  vec2 from = centre + vec2(rest.x < 0.0 ? -DOCK_FROM : DOCK_FROM, 0.0);
  return vec3(mix(from, target, dockCurve(ti)), clamp(r.z * 0.5 + 0.5, 0.0, 1.0));
}

float arrival(int idx, float t) {
  return smoothstep(0.04, 0.09, t - 0.02 * hashI(uint(idx), 15u));
}

void main() {
  if (uCageT < 0.0) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    vAlpha = 0.0;
    return;
  }
  float t = uCageT;
  int i = int(aBond.x + 0.5);
  int j = int(aBond.y + 0.5);
  bool isVertex = aBond.z > 0.5;
  vec3 A = vertexScreen(i, t);
  vec3 B = isVertex ? A : vertexScreen(j, t);
  bool leftI = uRest[i].x < 0.0;
  bool leftJ = uRest[j].x < 0.0;
  vec3 col = leftI == leftJ ? hue2rgb(leftI ? uHue3.x : uHue3.y) : hue2rgb(uHue3.z);
  float depth = 0.5 * (A.z + B.z);
  float depthA = mix(0.35, 1.0, depth);
  float wScale = mix(0.7, 1.2, depth);
  float halfW;
  float alpha;
  float gap = 0.0;
  if (isVertex) {
    halfW = 1.2 * wScale;
    alpha = arrival(i, t) * uCageA * depthA * G_VERTEX;
    col = mix(col, vec3(1.0), 0.35);
  } else {
    float breakT = BREAK_S + BREAK_SPAN * hashI(uint(gl_InstanceID), 21u);
    float retract = clamp((t - breakT) / RETRACT_S, 0.0, 1.0);
    halfW = 0.5 * wScale;
    alpha = min(arrival(i, t), arrival(j, t)) * depthA * G_BOND * (1.0 - step(1.0, retract));
    gap = retract;
  }
  if (alpha <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    vAlpha = 0.0;
    return;
  }
  gl_Position = ribbonCorner(A.xy, B.xy, halfW, uRes, uPx);
  vCol = col;
  vAlpha = alpha;
  vTailA = 1.0;
  vGap = gap;
}
`;

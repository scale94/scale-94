// src/terminal/mercury/planet/visitorShader.js — the visitors' bodies (visitors spec §5.5, §6.1), analytic per kind
// in one quad over their screen rect (visitorFrame):
//   drop / Leidenfrost bead: a water ellipsoid; its bent ray meets the planet and is shaded with the planet's
//     own mirror, so the lens shows the real mercury under it, without a scene copy;
//   ember: a blackbody core and a comet tail;
//   rock: cut planes ∩ a sphere, 4 rays per pixel on the rock only;
//   gust: a faint chromatic shimmer plus dust motes (true background refraction would need a scene copy).
//   plume (matrix): Hg vapour stripped off boiling mercury by a gust, a pale streamer widening downwind.
// Plan D-1: unlike the droplets this pass BLENDS (the tail, steam and shimmer are translucent): depth test on, depth
// write off, gl_FragDepth still sorts each fragment against the planet. No screen derivatives (it discards per pixel).

import * as THREE from 'three';
import { glf, v3 } from '../../gl/glf';
import { HG_MIRROR_DECLS_GLSL, HG_FRESNEL_GLSL, HG_ENV_GLSL, HG_MIRROR_UNIFORMS } from './hgMirrorGlsl';
import { DROPLET_VS, DROPLET_RENDER_ORDER } from './dropletShader';
import { VISIT_LIGHT_GLSL } from './visitorGlsl';
import { VISITOR_SLOTS, EMBER_GAIN, EMBER_HALO, ROCK_BOUND } from './visitorSim';
import { VIS_DROP, VIS_BEAD, VIS_EMBER, VIS_ROCK, VIS_GUST, VIS_PLUME, PLUME_STEAM } from './visitorFrame';

export const VISITOR_RENDER_ORDER = DROPLET_RENDER_ORDER + 1;
export const VISITOR_MATERIAL = Object.freeze({ transparent: true, blending: THREE.NormalBlending, depthTest: true, depthWrite: false });

export const WATER_N = 1.33;
export const WATER_F0 = ((WATER_N - 1) / (WATER_N + 1)) ** 2;
export const WATER_ROUGH = 0.05;
export const WATER_TINT = [0.96, 0.985, 1.0];
export const GAP_DARK = 0.25;              // the vapour gap under a Leidenfrost bead, at its darkest
export const STEAM_A = 0.18;
export const STEAM_COL = [0.35, 0.37, 0.4];
export const ROCK_PLANES = 7;
export const ROCK_AA = 4;
export const ROCK_ALBEDO = [0.11, 0.105, 0.1];
export const ROCK_AMBIENT = 0.02;
export const ROCK_RIM = 0.15;
export const GUST_A = 0.22;
export const GUST_COL = [0.75, 0.88, 1.0];
export const MOTES = 4;
export const MOTE_COL = [0.5, 0.48, 0.45];
export const PLUME_A = 0.2;
export const PLUME_COL = [0.62, 0.68, 0.78];
// The quench's steam puff (a PLUME_STEAM plume, A10) has its own knobs: it sits over bright lit crust, where the bead's
// steam (over a dark liquid mirror) can't be seen, so its colour is an HDR white (> 1) brighter than the lit crust.
export const QUENCH_STEAM_A = 1.2;          // A10 pick B4 (task rise)
export const QUENCH_STEAM_COL = [1.3, 1.32, 1.35];

export const VISITOR_OWN_UNIFORMS = ['uRect', 'uVis', 'uVisAx', 'uVisK', 'uVisN', 'uPxAngle', 'uTime', 'uCoreR'];
export const VISITOR_UNIFORMS = [...VISITOR_OWN_UNIFORMS, ...HG_MIRROR_UNIFORMS];

export function buildVisitorShader() {
  const N = VISITOR_SLOTS;
  const fs = /* glsl */ `precision highp float;

in vec3 vFar;
layout(location = 0) out vec4 fragColor;

uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 cameraPosition;
uniform vec4 uRect;
uniform vec4 uVis[${N}];
uniform vec4 uVisAx[${N}];
uniform vec4 uVisK[${N}];
uniform float uVisN;
uniform float uPxAngle;
uniform float uTime;
uniform float uCoreR;
${HG_MIRROR_DECLS_GLSL}

const float PI = 3.14159265358979;
const int NV = ${N};
const int VIS_DROP = ${VIS_DROP};
const int VIS_BEAD = ${VIS_BEAD};
const int VIS_EMBER = ${VIS_EMBER};
const int VIS_ROCK = ${VIS_ROCK};
const int VIS_GUST = ${VIS_GUST};
const int VIS_PLUME = ${VIS_PLUME};
const int PLUME_STEAM = ${PLUME_STEAM};
const int ROCK_PLANES = ${ROCK_PLANES};
const int ROCK_AA = ${ROCK_AA};
const int MOTES = ${MOTES};
const float WATER_N = ${glf(WATER_N)};
const float WATER_F0 = ${glf(WATER_F0)};
const float WATER_ROUGH = ${glf(WATER_ROUGH)};
const vec3 WATER_TINT = ${v3(WATER_TINT)};
const float GAP_DARK = ${glf(GAP_DARK)};
const float STEAM_A = ${glf(STEAM_A)};
const vec3 STEAM_COL = ${v3(STEAM_COL)};
const float EMBER_GAIN = ${glf(EMBER_GAIN)};
const float EMBER_HALO = ${glf(EMBER_HALO)};
const float ROCK_BOUND = ${glf(ROCK_BOUND)};
const vec3 ROCK_ALBEDO = ${v3(ROCK_ALBEDO)};
const float ROCK_AMBIENT = ${glf(ROCK_AMBIENT)};
const float ROCK_RIM = ${glf(ROCK_RIM)};
const float GUST_A = ${glf(GUST_A)};
const vec3 GUST_COL = ${v3(GUST_COL)};
const vec3 MOTE_COL = ${v3(MOTE_COL)};
const float PLUME_A = ${glf(PLUME_A)};
const vec3 PLUME_COL = ${v3(PLUME_COL)};
const float QUENCH_STEAM_A = ${glf(QUENCH_STEAM_A)};
const vec3 QUENCH_STEAM_COL = ${v3(QUENCH_STEAM_COL)};

${HG_FRESNEL_GLSL}

${HG_ENV_GLSL}

${VISIT_LIGHT_GLSL}

float hash11(float n) { return fract(sin(n) * 43758.5453123); }
float gauss(float x) { return exp(-x * x); }
float vn3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n = dot(i, vec3(1.0, 57.0, 113.0));
  return mix(mix(mix(hash11(n), hash11(n + 1.0), f.x), mix(hash11(n + 57.0), hash11(n + 58.0), f.x), f.y),
             mix(mix(hash11(n + 113.0), hash11(n + 114.0), f.x), mix(hash11(n + 170.0), hash11(n + 171.0), f.x), f.y), f.z);
}
vec3 rotAxis(vec3 v, vec3 k, float a) {
  float c = cos(a), s = sin(a);
  return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
}

// Ray vs an ellipsoid of revolution about unit a (stretch s: ra = r(1+s), rp = r/√(1+s), volume kept), solved in the
// space where it is the unit sphere. miss: signed distance from the silhouette, in units of rp (< 0 inside).
float hitEll(vec3 ro, vec3 rd, vec3 c, float r, vec3 a, float s, float tol, out vec3 n, out float miss) {
  float ra = r * (1.0 + s);
  float rp = r * inversesqrt(1.0 + s);
  vec3 o = ro - c;
  vec3 O = a * dot(o, a) / ra + (o - a * dot(o, a)) / rp;
  vec3 D = a * dot(rd, a) / ra + (rd - a * dot(rd, a)) / rp;
  float A = dot(D, D);
  float B = dot(O, D);
  float h = B * B - A * (dot(O, O) - 1.0);
  miss = (length(O - D * (B / A)) - 1.0) * rp;
  n = vec3(0.0, 0.0, 1.0);
  // tol (world units): a ray that misses by less than this still returns its closest approach, so the silhouette's
  // coverage ramp spans the full pixel (alpha < 0.5 there by construction)
  float t = -B / A;
  if (h < 0.0) { if (miss >= tol || t <= 0.0) return -1.0; }
  else t = (-B - sqrt(h)) / A;
  vec3 P = O + D * t;
  n = normalize(a * dot(P, a) / ra + (P - a * dot(P, a)) / rp);
  return t;
}

// Closest distance between the ray and the segment a→b; u: where along it (0..1); tr: the ray's t there.
float raySeg(vec3 ro, vec3 rd, vec3 a, vec3 b, out float u, out float tr) {
  vec3 ba = b - a;
  vec3 oa = ro - a;
  float baba = dot(ba, ba), bard = dot(ba, rd), baoa = dot(ba, oa), rdoa = dot(rd, oa);
  float den = baba - bard * bard;
  u = den > 1e-12 ? clamp((baoa - bard * rdoa) / den, 0.0, 1.0) : 0.0;
  tr = max(u * bard - rdoa, 0.0);
  return length(oa + rd * tr - ba * u);
}

// A rock: ROCK_PLANES seeded cut planes ∩ a sphere of ROCK_BOUND·r (always bounded), tumbled by ang about ax.
float hitRock(vec3 ro, vec3 rd, vec3 c, float r, vec3 ax, float ang, float seed, out vec3 n) {
  vec3 o = rotAxis(ro - c, ax, -ang);
  vec3 d = rotAxis(rd, ax, -ang);
  float rb = ROCK_BOUND * r;
  float b = dot(o, d);
  float h = b * b - (dot(o, o) - rb * rb);
  n = vec3(0.0, 0.0, 1.0);
  if (h < 0.0) return -1.0;
  float sq = sqrt(h);
  float tN = -b - sq;
  float tF = -b + sq;
  vec3 nN = (o + d * tN) / rb;
  for (int k = 0; k < ROCK_PLANES; k++) {
    float fk = float(k);
    vec3 pn = normalize(vec3(hash11(seed + fk * 3.1), hash11(seed + fk * 7.7 + 1.3), hash11(seed + fk * 5.3 + 2.9)) - 0.5);
    float pd = r * (0.72 + 0.2 * hash11(seed + fk * 11.3 + 4.1));
    float dn = dot(d, pn);
    float on = dot(o, pn) - pd;
    if (abs(dn) < 1e-8) { if (on > 0.0) return -1.0; continue; }
    float tk = -on / dn;
    if (dn < 0.0) { if (tk > tN) { tN = tk; nN = pn; } } else { tF = min(tF, tk); }
  }
  if (tN > tF || tF < 0.0) return -1.0;
  n = rotAxis(nN, ax, ang);
  return tN;
}

vec3 shadeWater(vec3 p, vec3 n, vec3 rd) {
  float NoV = clamp(dot(n, -rd), 0.0, 1.0);
  float F = WATER_F0 + (1.0 - WATER_F0) * pow(1.0 - NoV, 5.0);
  vec3 refl = envRadiance(reflect(rd, n), WATER_ROUGH, p, n);
  // through the drop: two refractions through a near-sphere ≈ the entry turn taken twice; what the bent ray meets
  // is the planet, shaded with the planet's own mirror
  vec3 bent = normalize(rd + 2.0 * (refract(rd, n, 1.0 / WATER_N) - rd));
  // where the bent ray misses the planet it meets the sky
  vec3 behind = envRadiance(bent, WATER_ROUGH, p, bent);
  float b = dot(p, bent);
  float h = b * b - (dot(p, p) - uCoreR * uCoreR);
  if (h > 0.0 && -b - sqrt(h) > 0.0) {
    vec3 q = p + bent * (-b - sqrt(h));
    vec3 nq = normalize(q);
    behind = fresnelHg(clamp(dot(nq, -bent), 0.0, 1.0)) * envRadiance(reflect(bent, nq), uRoughLiquid, q, nq);
  }
  return F * refl + (1.0 - F) * WATER_TINT * behind;
}

vec3 shadeRock(vec3 p, vec3 n, vec3 rd) {
  float sun = max(dot(n, uSunDir), 0.0);
  float rim = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 3.0);
  // Lambert in sunlight; the grazing rim catches the mirror it floats on
  return ROCK_ALBEDO * (uSunIrr * uExposure * sun + ROCK_AMBIENT) + ROCK_RIM * rim * fresnelHg(0.5) * envRadiance(reflect(rd, n), 0.5, p, n);
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vFar - ro);
  int n = int(uVisN + 0.5);
  vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  // the nearest solid body (water, ember core, rock) …
  float bestT = 1e9;
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  // … and every translucent glow (ember tail, steam, gust, motes), premultiplied
  vec3 gP = vec3(0.0);
  float gA = 0.0;
  float gT = 1e9;
  for (int i = 0; i < NV; i++) {
    if (i >= n) break;
    vec4 V = uVis[i];
    vec4 X = uVisAx[i];
    vec4 K = uVisK[i];
    int kind = int(K.x + 0.5);
    float fade = K.y;
    vec3 c = V.xyz;
    float r = V.w;
    float px = max(length(c - ro) * uPxAngle, 1e-6);
    vec3 nrm;
    float miss;
    if (kind == VIS_DROP || kind == VIS_BEAD) {
      float t = hitEll(ro, rd, c, r, X.xyz, X.w, 0.5 * px, nrm, miss);
      if (t > 0.0 && t < bestT) {
        vec3 p = ro + rd * t;
        vec3 s = shadeWater(p, nrm, rd);
        // the vapour cushion: a Leidenfrost bead's underside goes dark where it nearly touches
        if (kind == VIS_BEAD) s *= mix(GAP_DARK, 1.0, smoothstep(0.0, 0.5 * r, length(p) - uCoreR));
        bestT = t;
        col = s;
        alpha = fade * clamp(0.5 - miss / px, 0.0, 1.0);
      }
      if (kind == VIS_BEAD) {
        vec3 q = c + X.xyz * (1.8 * r);
        float tq = max(dot(q - ro, rd), 0.0);
        vec3 pq = ro + rd * tq;
        float a = clamp(STEAM_A * fade * gauss(length(pq - q) / (1.6 * r)) * vn3((pq - c) / r * 1.5 - X.xyz * (uTime * 1.2)), 0.0, 1.0);
        gP += STEAM_COL * a; gA = 1.0 - (1.0 - gA) * (1.0 - a); gT = min(gT, tq);
      }
    } else if (kind == VIS_EMBER) {
      vec3 g = visGlow(K.z) * EMBER_GAIN;
      float t = hitEll(ro, rd, c, r, vec3(0.0, 1.0, 0.0), 0.0, 0.5 * px, nrm, miss);
      if (t > 0.0 && t < bestT) { bestT = t; col = g; alpha = fade * clamp(0.5 - miss / px, 0.0, 1.0); }
      float u, tr;
      float d = raySeg(ro, rd, c, c + X.xyz * X.w, u, tr);
      float a = clamp(0.8 * fade * gauss(d / (EMBER_HALO * r)) * (1.0 - u), 0.0, 1.0);
      gP += g * a; gA = 1.0 - (1.0 - gA) * (1.0 - a); gT = min(gT, tr);
    } else if (kind == VIS_ROCK) {
      float hits = 0.0;
      float tS = 1e9;
      vec3 nS = vec3(0.0, 0.0, 1.0);
      for (int k = 0; k < ROCK_AA; k++) {
        vec2 o = vec2(float(k & 1), float(k >> 1)) - 0.5;
        o = vec2(0.75 * o.x + 0.25 * o.y, 0.75 * o.y - 0.25 * o.x); // rotated grid
        vec3 rk = normalize(rd + (camR * o.x + camU * o.y) * uPxAngle);
        vec3 nk;
        float tk = hitRock(ro, rk, c, r, X.xyz, X.w, K.z, nk);
        if (tk > 0.0) { hits += 1.0; if (tk < tS) { tS = tk; nS = nk; } }
      }
      if (hits > 0.0 && tS < bestT) {
        bestT = tS;
        col = shadeRock(ro + rd * tS, nS, rd);
        alpha = fade * hits / float(ROCK_AA);
      }
    } else if (kind == VIS_GUST) {
      vec3 b = c + X.xyz * X.w;
      float u, tr;
      float d = raySeg(ro, rd, c, b, u, tr);
      float w = d / r;
      float a = clamp(GUST_A * fade * gauss(w) * (1.0 - u) * (0.7 + 0.3 * sin(40.0 * u - 30.0 * uTime)), 0.0, 1.0);
      // chromatic: the bent light splits faintly, warm at the edge, cool at the core
      vec3 sh = GUST_COL * mix(vec3(0.8, 0.9, 1.0), vec3(1.0, 0.9, 0.8), clamp(w, 0.0, 1.0));
      gP += sh * a; gA = 1.0 - (1.0 - gA) * (1.0 - a); gT = min(gT, tr);
      vec3 side = normalize(cross(X.xyz, camU) + vec3(1e-5));
      for (int m = 0; m < MOTES; m++) {
        float fm = float(m);
        vec3 pm = mix(c, b, hash11(K.z + fm * 1.7)) + side * (2.0 * r * (hash11(K.z + fm * 3.1) - 0.5));
        float tm = max(dot(pm - ro, rd), 0.0);
        float am = clamp(fade * gauss(length(ro + rd * tm - pm) / (1.2 * max(tm * uPxAngle, 1e-6))), 0.0, 1.0);
        gP += MOTE_COL * am; gA = 1.0 - (1.0 - gA) * (1.0 - am); gT = min(gT, tm);
      }
    } else if (kind == VIS_PLUME) {
      // a pale streamer, widening and thinning downwind: Hg vapour off boiling mercury, or (PLUME_STEAM) the quench's water
      // flashing to steam off hot rock, drawn with the bead's steam look (plan Q-1)
      bool steam = int(K.w + 0.5) == PLUME_STEAM;
      vec3 b = c + X.xyz * X.w;
      float u, tr;
      float d = raySeg(ro, rd, c, b, u, tr);
      float wd = r * (0.6 + 1.8 * u);
      // A10: the quench steam is a soft round puff, its centre lifted 0.6r off the rind plus its rise so far (X.w)
      if (steam) { vec3 pc = c + X.xyz * (X.w + 0.6 * r); tr = max(dot(pc - ro, rd), 0.0); d = length(ro + rd * tr - pc); u = 0.0; wd = r; }
      float a = clamp((steam ? QUENCH_STEAM_A : PLUME_A) * fade * gauss(d / wd) * (1.0 - u * u) * (0.6 + 0.4 * vn3((ro + rd * tr - c) / r * 0.8 - X.xyz * (uTime * 2.0) + K.z)), 0.0, 1.0);
      gP += (steam ? QUENCH_STEAM_COL : PLUME_COL) * a; gA = 1.0 - (1.0 - gA) * (1.0 - a); gT = min(gT, tr);
    }
  }
  if (alpha <= 0.0 && gA <= 1e-4) discard;
  vec3 gC = gP / max(gA, 1e-6);
  vec3 outC;
  float outA;
  if (alpha > 0.0 && gT < bestT) {          // glow in front of the body
    outA = gA + alpha * (1.0 - gA);
    outC = (gC * gA + col * alpha * (1.0 - gA)) / max(outA, 1e-6);
  } else if (alpha > 0.0) {                 // the body covers the glow behind it by its coverage only
    outA = alpha + gA * (1.0 - alpha);
    outC = (col * alpha + gC * gA * (1.0 - alpha)) / max(outA, 1e-5);
  } else {
    outA = gA;
    outC = gC;
  }
  vec3 pD = ro + rd * (alpha > 0.0 ? bestT : gT);
  vec4 clip = projectionMatrix * viewMatrix * vec4(pD, 1.0);
  gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);
  // the planet's output stage, so the passes meet without a seam in tone
  vec3 cl = max(outC, 0.0);
  vec3 srgb = mix(cl * 12.92, 1.055 * pow(cl, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), cl));
  float dith = (fract(sin(dot(gl_FragCoord.xy + fract(uTime) * 61.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  fragColor = vec4(srgb + dith, clamp(outA, 0.0, 1.0));
}
`;
  return { vs: DROPLET_VS, fs };
}

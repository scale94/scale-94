// src/terminal/mercury/planet/dropletShader.js — the breakup family as one raymarched SDF impostor (phase-5 spec §7).
// Beads are volume-preserving ellipsoids, necks asymmetric round cones, the planet a sphere at its live radius
// that enters only through roots and bridges. Shading is the planet's own mirror (hgMirrorGlsl).

import * as THREE from 'three';
import { glf } from '../../gl/glf';
import { TIERS } from './planetQuality';
import { BOUND_BEAD } from './breakupFrame';
import { EXO_RENDER_ORDER } from './exosphereShader';
import { HG_MIRROR_DECLS_GLSL, HG_FRESNEL_GLSL, HG_ENV_GLSL, HG_MIRROR_UNIFORMS } from './hgMirrorGlsl';

// Draw order. The droplets sit in the TRANSPARENT list (so they draw after the opaque planet and, by renderOrder,
// after the nebula flows (0) and the exosphere tail (EXO_RENDER_ORDER)), else the nebula sprites wash out every
// bead that lies inside or behind the cloud. Blending stays OFF and depth test/write stay ON: the pass still
// resolves coverage with alpha-to-coverage and gl_FragDepth, the planet still hides beads behind it.
export const DROPLET_RENDER_ORDER = EXO_RENDER_ORDER + 1;
export const DROPLET_MATERIAL = Object.freeze({
  transparent: true,
  blending: THREE.NoBlending,
  depthTest: true,
  depthWrite: true,
});

export const NECK_BLEND = 1;      // smooth-union radius across a neck, × the neck's own radius (surface tension)
export const NECK_SHOULDER = 0.6; // a neck cone ends inside its bead at this × the bead radius
export const ROOT_FLARE = 2;      // a root neck flares to this × its radius where it meets the planet
export const HIT_PX = 0.25;       // a march hit is within this fraction of a pixel
// The dark rim (author 2026-10-02): mirror beads a few px across vanish into the nebula they reflect, so every
// silhouette gets a thin dark band, sized in pixels like the planet's meniscus rim (mercuryMeniscus MENISCUS_MIN_PX).
export const RIM_PX = 1.5;        // fully dark this far in from the silhouette, px
export const RIM_FADE_PX = 1;     // then back to the plain mirror over this many px
export const RIM_NECK_LO = 0.02;  // rim fades out where a neck/fillet pulls the surface this far (× bead radius) off the bead's own SDF
export const RIM_NECK_HI = 0.12;  // ...and is gone by here
export const RIM_FLOOR = 0.06;    // the band's gain on the (linear) mirror radiance

// Distance in px from a sphere's silhouette for a point whose normal makes NoV with the view ray (rPx: its radius in px).
export const rimSilPx = (rPx, NoV) => rPx * (1 - Math.sqrt(Math.max(0, 1 - NoV * NoV)));
export function rimShade(d) {
  const t = Math.min(1, Math.max(0, (d - RIM_PX) / RIM_FADE_PX));
  return t >= 1 ? 1 : RIM_FLOOR + (1 - RIM_FLOOR) * t * t * (3 - 2 * t);
}

export const DROPLET_OWN_UNIFORMS = ['uRect', 'uBead', 'uBeadAxis', 'uNeck', 'uNeckR', 'uBridge', 'uCounts', 'uPxAngle', 'uTime'];
export const DROPLET_UNIFORMS = [...DROPLET_OWN_UNIFORMS, ...HG_MIRROR_UNIFORMS];

export const DROPLET_VS = /* glsl */ `in vec3 position;

uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform vec4 uRect;

out vec3 vFar;

void main() {
  // The quad covers only the family's screen rect (breakupFrame.fitRect); each corner's far point gives the ray.
  vec2 ndc = mix(uRect.xy, uRect.zw, position.xy * 0.5 + 0.5);
  vec4 f = inverse(projectionMatrix * viewMatrix) * vec4(ndc, 1.0, 1.0);
  vFar = f.xyz / f.w;
  gl_Position = vec4(ndc, 0.0, 1.0);
}
`;

export function buildDropletShader({ tier = 'full' } = {}) {
  const q = TIERS[tier];
  if (!q) throw new Error(`buildDropletShader: unknown tier "${tier}"`);
  const d = q.drop;
  const fs = /* glsl */ `precision highp float;

in vec3 vFar;
layout(location = 0) out vec4 fragColor;

uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 cameraPosition;
uniform vec4 uBead[${d.bodies}];
uniform vec4 uBeadAxis[${d.bodies}];
uniform vec4 uNeck[${d.necks}];
uniform float uNeckR[${d.necks}];
uniform vec4 uBridge[${d.bridges}];
uniform vec3 uCounts;
uniform float uPxAngle;
uniform float uTime;
${HG_MIRROR_DECLS_GLSL}

const int NB = ${d.bodies};
const int NN = ${d.necks};
const int NK = ${d.bridges};
const int STEPS = ${d.steps};
const float NECK_BLEND = ${glf(NECK_BLEND)};
const float NECK_SHOULDER = ${glf(NECK_SHOULDER)};
const float ROOT_FLARE = ${glf(ROOT_FLARE)};
const float BOUND_BEAD = ${glf(BOUND_BEAD)};
const float HIT_PX = ${glf(HIT_PX)};
const float RIM_PX = ${glf(RIM_PX)};
const float RIM_FADE_PX = ${glf(RIM_FADE_PX)};
const float RIM_FLOOR = ${glf(RIM_FLOOR)};
const float RIM_NECK_LO = ${glf(RIM_NECK_LO)};
const float RIM_NECK_HI = ${glf(RIM_NECK_HI)};

${HG_FRESNEL_GLSL}

${HG_ENV_GLSL}

// A bead: a prolate (or oblate) ellipsoid of revolution about ax.xyz, stretch ax.w, volume kept (ra·rp² = r³).
// Inigo Quilez's bound for ellipsoids.
float sdEll(vec3 p, vec4 b, vec4 ax) {
  vec3 q = p - b.xyz;
  float pa = dot(q, ax.xyz);
  float pp = length(q - ax.xyz * pa);
  float ra = b.w * (1.0 + ax.w);
  float rp = b.w * inversesqrt(1.0 + ax.w);
  float k0 = length(vec2(pa / ra, pp / rp));
  float k1 = length(vec2(pa / (ra * ra), pp / (rp * rp)));
  return k1 > 1e-8 ? k0 * (k0 - 1.0) / k1 : -min(ra, rp);
}

// Exact round cone between spheres (a, r1) and (b, r2) (Inigo Quilez).
float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2) {
  vec3 ba = b - a;
  float l2 = max(dot(ba, ba), 1e-12);   // coincident centres: no 1/0
  float rr = r1 - r2;
  float a2 = max(l2 - rr * rr, 0.0);     // one sphere inside the other: no sqrt of a negative
  float il2 = 1.0 / l2;
  vec3 pa = p - a;
  float y = dot(pa, ba);
  float z = y - l2;
  vec3 xv = pa * l2 - ba * y;
  float x2 = dot(xv, xv);
  float y2 = y * y * l2;
  float z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

// dropletShader.rimSilPx / rimShade, exactly.
float rimSilPx(float rPx, float NoV) { return rPx * (1.0 - sqrt(max(0.0, 1.0 - NoV * NoV))); }
float rimShade(float d) { return mix(RIM_FLOOR, 1.0, smoothstep(RIM_PX, RIM_PX + RIM_FADE_PX, d)); }

float smin(float a, float b, float k) {
  if (k <= 0.0) return min(a, b);
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

void neckEnds(int i, out vec3 a, out float ra, out vec3 b, out float rb) {
  vec4 n = uNeck[i];
  int ia = int(n.x);
  int ib = int(n.y);
  a = uBead[ia].xyz;
  ra = uBead[ia].w;
  if (ib < 0) { b = normalize(a) * uNeckR[i]; rb = n.z * ROOT_FLARE; }
  else { b = uBead[ib].xyz; rb = uBead[ib].w; }
}

float gPlanetOnly;
float gBeadR; // radius of the bead nearest the last map() point (the rim's px scale)
float gBeadOnly; // 1 where the surface is a bead's own; 0 on a neck, root fillet or bridge (no rim there)

float map(vec3 p) {
  int nb = int(uCounts.x);
  int nn = int(uCounts.y);
  int nk = int(uCounts.z);
  float d = 1e9;
  gPlanetOnly = 0.0;
  gBeadR = 0.0;
  float dBead = 1e9;
  for (int i = 0; i < NB; i++) {
    if (i >= nb) break;
    float db = sdEll(p, uBead[i], uBeadAxis[i]);
    if (db < dBead) { dBead = db; gBeadR = uBead[i].w; }
    d = min(d, db);
  }
  // Necks: surface tension rounds a neck into its beads (smooth union, k = the neck's own radius).
  for (int i = 0; i < NN; i++) {
    if (i >= nn) break;
    vec4 n = uNeck[i];
    float h = n.z;
    if (h <= 0.0) continue;
    vec3 a, b;
    float ra, rb;
    neckEnds(i, a, ra, b, rb);
    vec3 w = mix(a, b, 0.5 + n.w);
    float dn = min(sdRoundCone(p, a, w, ra * NECK_SHOULDER, h), sdRoundCone(p, w, b, h, rb * NECK_SHOULDER));
    float k = h * NECK_BLEND;
    int ia = int(n.x);
    int ib = int(n.y);
    float pairA = smin(sdEll(p, uBead[ia], uBeadAxis[ia]), dn, k);
    float pair;
    bool planetOnly = false;
    if (ib < 0) {
      float dP = length(p) - uNeckR[i];
      pair = smin(pairA, dP, k);
      planetOnly = pairA - dP > k;
    } else {
      pair = smin(pairA, sdEll(p, uBead[ib], uBeadAxis[ib]), k);
    }
    if (pair < d) { d = pair; gPlanetOnly = planetOnly ? 1.0 : 0.0; }
  }
  // Bridges: a coalescence neck growing as √t (breakupPhysics.bridgeRadius) IS the blend radius.
  for (int i = 0; i < NK; i++) {
    if (i >= nk) break;
    vec4 br = uBridge[i];
    float k = br.z;
    if (k <= 0.0) continue;
    int ia = int(br.x);
    int ib = int(br.y);
    float da = sdEll(p, uBead[ia], uBeadAxis[ia]);
    float db = ib < 0 ? length(p) - br.w : sdEll(p, uBead[ib], uBeadAxis[ib]);
    float pair = smin(da, db, k);
    if (pair < d) { d = pair; gPlanetOnly = (ib < 0 && da - db > k) ? 1.0 : 0.0; }
  }
  // The rim belongs to the bead silhouette: where a neck / fillet / bridge has pulled the surface off the nearest bead's
  // own SDF (d < dBead), the rim fades out, so no dark arc is drawn on the planet-root fillet or along a thin neck.
  gBeadOnly = 1.0 - smoothstep(RIM_NECK_LO * gBeadR, RIM_NECK_HI * gBeadR, dBead - d);
  return d;
}

vec3 calcNormal(vec3 p, float e) {
  const vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) + k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));
}

void boundHit(vec3 ro, vec3 rd, vec3 c, float rad, inout float t0, inout float t1) {
  vec3 oc = ro - c;
  float b = dot(oc, rd);
  float disc = b * b - (dot(oc, oc) - rad * rad);
  if (disc <= 0.0) return;
  float s = sqrt(disc);
  t0 = min(t0, -b - s);
  t1 = max(t1, -b + s);
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vFar - ro);
  int nb = int(uCounts.x);
  int nn = int(uCounts.y);
  int nk = int(uCounts.z);

  // Per-ray bounds (the same rules as breakupFrame.fitRect): most of the rect costs a few dot products.
  float t0 = 1e9;
  float t1 = -1e9;
  for (int i = 0; i < NB; i++) {
    if (i >= nb) break;
    vec4 b = uBead[i];
    boundHit(ro, rd, b.xyz, BOUND_BEAD * b.w * (1.0 + abs(uBeadAxis[i].w)), t0, t1);
  }
  for (int i = 0; i < NN; i++) {
    if (i >= nn) break;
    vec3 a, b;
    float ra, rb;
    neckEnds(i, a, ra, b, rb);
    boundHit(ro, rd, 0.5 * (a + b), 0.5 * length(b - a) + max(ra, rb), t0, t1);
  }
  for (int i = 0; i < NK; i++) {
    if (i >= nk) break;
    vec4 br = uBridge[i];
    if (br.y >= 0.0) continue;
    vec4 a = uBead[int(br.x)];
    boundHit(ro, rd, normalize(a.xyz) * br.w, BOUND_BEAD * a.w + br.z, t0, t1);
  }
  if (t1 < t0) discard;

  float t = max(t0, 0.0);
  bool hit = false;
  float bestR = 1e9;
  float bestT = t;
  for (int i = 0; i < STEPS; i++) {
    float d = map(ro + rd * t);
    float px = t * uPxAngle;
    float r = d / px;
    if (r < bestR) { bestR = r; bestT = t; }
    if (d < HIT_PX * px) { hit = true; break; }
    t += d;
    if (t > t1) break;
  }
  // Silhouette AA: a near miss within a pixel still covers part of it (as the planet's edge does).
  float cov = hit ? 1.0 : clamp(1.0 - bestR, 0.0, 1.0);
  if (cov <= 0.0) discard;
  float tt = hit ? t : bestT;
  vec3 p = ro + rd * tt;
  map(p);
  float rB = gBeadR;
  float rimOn = gBeadOnly;
  if (gPlanetOnly > 0.5) discard; // bare planet: the planet pass draws it, with all its detail

  vec3 n = calcNormal(p, max(0.5 * tt * uPxAngle, 1e-5));
  float NoV = clamp(dot(n, -rd), 0.0, 1.0);
  vec3 R = reflect(rd, n);
  vec3 col = max(fresnelHg(NoV) * envRadiance(R, uRoughLiquid, p, n), 0.0);
  // The dark rim: px from the silhouette of the nearest bead (its radius in px from the march's own footprint,
  // tt · uPxAngle; no screen derivatives after the discards above). A near-miss AA pixel is on the edge: all rim.
  col *= mix(1.0, rimShade(hit ? rimSilPx(rB / max(tt * uPxAngle, 1e-9), NoV) : 0.0), rimOn);
  // The planet's output stage (mercuryPlanetShader main), so the two passes meet without a seam in tone.
  vec3 srgb = mix(col * 12.92, 1.055 * pow(col, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), col));
  float dith = (fract(sin(dot(gl_FragCoord.xy + fract(uTime) * 61.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  vec4 clip = projectionMatrix * viewMatrix * vec4(p, 1.0);
  gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);
  fragColor = vec4(srgb + dith, cov);
}
`;
  return { vs: DROPLET_VS, fs };
}

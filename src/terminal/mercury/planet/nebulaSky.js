// src/terminal/mercury/planet/nebulaSky.js — the neutral nebula (spec 2026-10-08-mercury-neutral-nebula-design.md).
//
// What the resting mirror sees when PLANET_TUNE.neutralNebula is up: a colourless deep-space field, specified by its
// luminance histogram (a mirror of an even sky reads matte; of a mostly black one, black glass). Three layers:
//   void   — low-frequency fBm through a smoothstep: the density mask m; outside it, obsidian (NEBULA_FLOOR);
//   wisps  — ridged, domain-warped fBm inside m: the gunmetal band;
//   stars  — sparse Gaussian cores bright enough to reach the shoulder (white), each with a faint halo.
// skyNebulaGen runs at BAKE time only (nebulaBake.js renders it into a mipmapped half-float cube map); the frame loop
// pays one textureLod (aetherSky.skyNeutral). Starting values; tuned against .superpowers/sdd/tools/nebula-hist.mjs.

import { glf } from '../../gl/glf';
import { SKY_NOISE_GLSL, SKY_OCTAVES, NEUTRAL_SKY_DRIFT } from './aetherSky';

export const NEBULA_FACE = 256;          // cube face size (px); 512 is the open author call if cores read soft
export const NEBULA_FLOOR = 0.002;       // void radiance (studio floor is 0.004)
export const NEBULA_VOID_SCALE = 1.3;    // void mask frequency (direction units)
export const NEBULA_VOID_LO = 0.5;       // mask smoothstep: fBm below → void
export const NEBULA_VOID_HI = 0.68;      // fBm above → full density
export const NEBULA_WISP_SCALE = 3;      // wisp frequency
export const NEBULA_WISP_WARP = 1.2;     // domain-warp amplitude
export const NEBULA_WISP_POW = 6;        // ridge sharpness (edges are what read as a mirror)
export const NEBULA_WISP_BASE = 0.02;    // dense-but-off-ridge radiance
export const NEBULA_WISP_GAIN = 0.13;    // ridge radiance on top of the base
export const NEBULA_STAR_CELLS = 40;     // star lattice cells per direction unit
export const NEBULA_STAR_RATE = 0.997;   // hash above this lights a cell (~100 stars on the sphere)
export const NEBULA_STAR_SIGMA = 0.009;  // core Gaussian width (rad) ≈ 1.5 texels at NEBULA_FACE 256
export const NEBULA_STAR_MIN = 3;        // core peak range: into AETHER_SHOULDER, so the cores read white
export const NEBULA_STAR_MAX = 8;
export const NEBULA_HALO_W = 6;          // halo width × sigma
export const NEBULA_HALO_GAIN = 0.02;    // halo peak × core peak
export const NEBULA_STAR_REACH = 0.7;    // a star's light is windowed to zero at this many cells (lattice units); with NEBULA_STAR_SHELL, sqrt(SHELL² + REACH²) < 1 keeps every lit star inside the 27-cell search
export const NEBULA_STAR_SHELL = 0.3;    // only lattice stars within this of the radius-NEBULA_STAR_CELLS shell are lit (a radially offset star would project inside the window from outside the search)

export const NEBULA_GEN_GLSL = /* glsl */ `// ── neutral nebula generator (nebulaSky.js), bake-time only ──
const int SKY_OCTAVES = ${SKY_OCTAVES};
const float NEBULA_FLOOR = ${glf(NEBULA_FLOOR)};
const float NEBULA_VOID_SCALE = ${glf(NEBULA_VOID_SCALE)};
const float NEBULA_VOID_LO = ${glf(NEBULA_VOID_LO)};
const float NEBULA_VOID_HI = ${glf(NEBULA_VOID_HI)};
const float NEBULA_WISP_SCALE = ${glf(NEBULA_WISP_SCALE)};
const float NEBULA_WISP_WARP = ${glf(NEBULA_WISP_WARP)};
const float NEBULA_WISP_POW = ${glf(NEBULA_WISP_POW)};
const float NEBULA_WISP_BASE = ${glf(NEBULA_WISP_BASE)};
const float NEBULA_WISP_GAIN = ${glf(NEBULA_WISP_GAIN)};
const float NEBULA_STAR_CELLS = ${glf(NEBULA_STAR_CELLS)};
const float NEBULA_STAR_RATE = ${glf(NEBULA_STAR_RATE)};
const float NEBULA_STAR_SIGMA = ${glf(NEBULA_STAR_SIGMA)};
const float NEBULA_STAR_MIN = ${glf(NEBULA_STAR_MIN)};
const float NEBULA_STAR_MAX = ${glf(NEBULA_STAR_MAX)};
const float NEBULA_HALO_W = ${glf(NEBULA_HALO_W)};
const float NEBULA_HALO_GAIN = ${glf(NEBULA_HALO_GAIN)};
const float NEBULA_STAR_REACH = ${glf(NEBULA_STAR_REACH)};
const float NEBULA_STAR_SHELL = ${glf(NEBULA_STAR_SHELL)};

${SKY_NOISE_GLSL}

// Stars live on the radius-NEBULA_STAR_CELLS shell (band ±NEBULA_STAR_SHELL) and each star's light is windowed to zero
// within NEBULA_STAR_REACH cells. sqrt(SHELL² + REACH²) < 1, so any star lighting a sample lies within one cell index of it
// on every axis: the 27-cell search never cuts a star.
float nebStars(vec3 D) {
  vec3 g = D * NEBULA_STAR_CELLS;
  vec3 gi = floor(g);
  float reach = NEBULA_STAR_REACH / NEBULA_STAR_CELLS;
  float s = 0.0;
  for (int dz = -1; dz <= 1; dz++)
  for (int dy = -1; dy <= 1; dy++)
  for (int dx = -1; dx <= 1; dx++) {
    vec3 c = gi + vec3(float(dx), float(dy), float(dz));
    float h = skyHash(c);
    if (h <= NEBULA_STAR_RATE) continue;
    vec3 j = vec3(skyHash(c + 17.0), skyHash(c + 41.0), skyHash(c + 73.0)) - 0.5;
    vec3 P = c + 0.5 + 0.8 * j;
    if (abs(length(P) - NEBULA_STAR_CELLS) >= NEBULA_STAR_SHELL) continue;
    vec3 sd = P / length(P);
    float d = length(D - sd); // chord ≈ angle at these sizes
    float peak = mix(NEBULA_STAR_MIN, NEBULA_STAR_MAX, skyHash(c + 101.0));
    float core = exp(-(d * d) / (NEBULA_STAR_SIGMA * NEBULA_STAR_SIGMA));
    float hw = NEBULA_STAR_SIGMA * NEBULA_HALO_W;
    float halo = NEBULA_HALO_GAIN * exp(-(d * d) / (hw * hw));
    s += peak * (core + halo) * (1.0 - smoothstep(0.5 * reach, reach, d));
  }
  return s;
}

vec3 skyNebulaGen(vec3 D) {
  float m = smoothstep(NEBULA_VOID_LO, NEBULA_VOID_HI, skyFbm(D * NEBULA_VOID_SCALE + vec3(3.1, 7.4, 1.9), 3.0));
  vec3 q = D * NEBULA_WISP_SCALE;
  vec3 w = vec3(skyFbm(q + vec3(0.0, 0.0, 0.0), 3.0), skyFbm(q + vec3(5.2, 1.3, 2.8), 3.0), skyFbm(q + vec3(2.1, 7.7, 4.4), 3.0));
  float n = skyFbm(q + NEBULA_WISP_WARP * 2.0 * (w - 0.5), 4.0);
  float ridge = pow(1.0 - abs(n * 2.0 - 1.0), NEBULA_WISP_POW);
  float L = mix(NEBULA_FLOOR, NEBULA_WISP_BASE + NEBULA_WISP_GAIN * ridge, m);
  L += nebStars(D) * (0.3 + 0.7 * m);
  return vec3(L);
}`;

// Bake pass: a BackSide unit sphere at the cube camera's origin; the direction is the object-space position.
export const NEBULA_BAKE_VS = /* glsl */ `precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
in vec3 position;
out vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const NEBULA_BAKE_FS = /* glsl */ `precision highp float;
in vec3 vDir;
out vec4 o;
${NEBULA_GEN_GLSL}
void main() {
  o = vec4(skyNebulaGen(normalize(vDir)), 1.0);
}`;

// The lookup rotation for the frame loop (row-major, for THREE.Matrix3.set): a rigid turn about world +Y that samples
// the baked sky at az - NEUTRAL_SKY_DRIFT · t, the studio's drift. t is the calm-gated sky clock (calm freezes it).
export function nebulaRotation(t) {
  const th = NEUTRAL_SKY_DRIFT * t;
  const c = Math.cos(th), s = Math.sin(th);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}

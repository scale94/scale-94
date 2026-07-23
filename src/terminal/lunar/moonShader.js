// moonShader.js — GLSL sources.
//
// Two passes:
//   BAKE_FS  — runs once at mount into an offscreen texture. Produces an
//              equirectangular selenographic map: tangent-space normal (RG),
//              albedo (B), mare fraction (A).
//   MOON_FS  — runs every frame. Samples the baked texture and projects it
//              onto the visible disc.

export const QUAD_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vScreen;
void main() {
  vScreen = aPos;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// Shared GLSL: hashes, value noise, fbm. Prepended to both fragment shaders.
const NOISE_GLSL = `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
vec2 hash22(vec2 p) {
  return vec2(hash21(p), hash21(p + 19.19));
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p, int octaves) {
  float v = 0.0, amp = 1.0, total = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    v += vnoise(p) * amp;
    total += amp;
    amp *= 0.5;
    p *= 2.1;
  }
  return v / total;
}`;

export const BAKE_FS = `#version 300 es
precision highp float;
in vec2 vScreen;
out vec4 fragColor;

const float PI = 3.14159265359;
${NOISE_GLSL}

// lat, lon, radius, depth -- ported from LunarCanvasMoon's MARE_BASINS.
const int N_MARE = 9;
const vec4 MARE[9] = vec4[9](
  vec4( 0.15, -0.30, 0.25, 0.35),
  vec4( 0.12,  0.20, 0.18, 0.30),
  vec4(-0.05,  0.35, 0.20, 0.28),
  vec4(-0.20,  0.00, 0.15, 0.25),
  vec4( 0.40, -0.10, 0.12, 0.22),
  vec4(-0.10, -0.50, 0.14, 0.20),
  vec4( 0.02, -0.55, 0.22, 0.32),
  vec4(-0.30,  0.30, 0.12, 0.18),
  vec4( 0.08,  0.50, 0.10, 0.15)
);

float mareFraction(vec2 ll) {
  float m = 0.0;
  for (int i = 0; i < N_MARE; i++) {
    vec4 b = MARE[i];
    float dist = length(vec2(ll.y - b.x, ll.x - b.y));
    if (dist < b.z) {
      float f = 1.0 - dist / b.z;
      float edge = fbm(ll * 12.0 + b.x * 7.0, 3) * 0.6 + 0.7;
      m = max(m, smoothstep(0.0, 0.55, f) * edge);
    }
  }
  return clamp(m, 0.0, 1.0);
}

// Craters with a power-law size-frequency distribution.
//
// Radius is drawn as r = rmin * u^(-1/2) from uniform u, which gives
// P(R > r) proportional to r^-2 -- the observed lunar N ~ D^-2. This is what
// stops the surface reading as noise: fixed-frequency stamping (what the
// canvas moon does) produces a visible lattice.
float craters(vec2 p, float freq, float amp, float seed) {
  vec2 g = p * freq;
  vec2 gi = floor(g);
  float h = 0.0;
  for (int oy = -1; oy <= 1; oy++) {
    for (int ox = -1; ox <= 1; ox++) {
      vec2 cell = gi + vec2(float(ox), float(oy));
      vec2 c = cell + hash22(cell + seed) * 0.9 + 0.05;
      float u = max(hash21(cell + seed + 7.7), 0.03);
      float r = clamp(0.10 * pow(u, -0.5), 0.10, 0.58);
      float d = length(g - c) / r;
      if (d < 1.0) {
        float floorTerm = -(1.0 - d * d) * 0.7;
        float rim = exp(-pow((d - 0.88) / 0.11, 2.0)) * 0.95;
        h += amp * (floorTerm + rim) * (0.4 + r);
      } else if (d < 1.7) {
        h += amp * 0.10 * (0.4 + r) * exp(-(d - 1.0) * 3.0);
      }
    }
  }
  return h;
}

float heightAt(vec2 ll) {
  float h = fbm(ll * 4.0 + 10.0, 5) * 0.22;
  h -= mareFraction(ll) * 0.16;
  h += craters(ll, 6.0,  0.100, 1.0);
  h += craters(ll, 16.0, 0.048, 2.0);
  h += craters(ll, 44.0, 0.021, 3.0);
  return h;
}

void main() {
  // vScreen is -1..1; map to lon in [-PI, PI], lat in [-PI/2, PI/2].
  vec2 ll = vec2(vScreen.x * PI, vScreen.y * PI * 0.5);

  // Longitude epsilon widens toward the poles so the gradient stays isotropic.
  float cosLat = max(cos(ll.y), 0.15);
  float epsLon = 0.0016 / cosLat;
  float epsLat = 0.0016;

  float hL = heightAt(ll - vec2(epsLon, 0.0));
  float hR = heightAt(ll + vec2(epsLon, 0.0));
  float hD = heightAt(ll - vec2(0.0, epsLat));
  float hU = heightAt(ll + vec2(0.0, epsLat));

  const float RELIEF = 0.014;
  vec3 n = normalize(vec3(
    -(hR - hL) / (2.0 * epsLon) * RELIEF,
    -(hU - hD) / (2.0 * epsLat) * RELIEF,
    1.0
  ));

  float mare = mareFraction(ll);
  float rough = fbm(ll * 4.0 + 10.0, 5);
  float albedo = clamp(0.58 + rough * 0.14 - mare * 0.33, 0.06, 0.86);

  // Fresh large craters throw bright ray systems.
  albedo += clamp(craters(ll, 6.0, 0.10, 1.0), 0.0, 0.06) * 1.4;

  fragColor = vec4(n.xy * 0.5 + 0.5, clamp(albedo, 0.06, 0.86), mare);
}`;

export const MOON_FS = `#version 300 es
precision highp float;
in vec2 vScreen;
uniform sampler2D uSurface;
uniform float uRadius;
out vec4 fragColor;

const float PI = 3.14159265359;
const float TAU = 6.28318530718;

void main() {
  vec2 p = vScreen / uRadius;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;

  vec3 N = vec3(p, sqrt(max(0.0, 1.0 - r2)));
  float lon = atan(N.x, N.z);
  float lat = asin(clamp(N.y, -1.0, 1.0));
  vec2 uv = vec2(lon / TAU + 0.5, lat / PI + 0.5);

  vec4 surf = texture(uSurface, uv);
  vec2 nxy = surf.rg * 2.0 - 1.0;
  vec3 nT = vec3(nxy, sqrt(max(0.0, 1.0 - dot(nxy, nxy))));
  float albedo = surf.b;

  // Flat frontal light for this task -- phase arrives in Task 5.
  fragColor = vec4(vec3(albedo * (0.55 + 0.45 * nT.z)), 1.0);
}`;

/** 2048x1024 desktop, halved on narrow viewports. */
export function bakeSize() {
  const wide = typeof window !== 'undefined' && window.innerWidth >= 768;
  return wide ? [2048, 1024] : [1024, 512];
}

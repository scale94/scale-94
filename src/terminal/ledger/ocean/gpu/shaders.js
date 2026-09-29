// shaders.js — GLSL ES 3.00 for the Ledger ocean. Every pass is a port of
// referenceStep.js (the CPU oracle); the GPU contract in the spec is binding.
// All fetches are texelFetch: land-aware manual bilinear, never hardware
// filtering (which would blend land zeros in and sink every coast).

export const SIM_VS = `#version 300 es
layout(location = 0) in vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`;

export const SHARED_UNIFORMS = ['uStatic', 'uRows', 'uGrid', 'uCellKm'];

const COMMON = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D uStatic;  // unit 1: r = u km/d, g = v km/d, b = land (0/1)
uniform sampler2D uRows;    // unit 2: ny x 2; row 0 (kd, ka, doSat, cosLat), row 1 (cosN face, cosS face)
uniform vec2 uGrid;         // (nx, ny)
uniform float uCellKm;
out vec4 outColor;

int nxI() { return int(uGrid.x + 0.5); }
int nyI() { return int(uGrid.y + 0.5); }
// Exact integer wrap (GLSL ES leaves % undefined for negative operands, so fold negatives onto non-negative ones).
int wrapI(int i) { int nx = nxI(); return i >= 0 ? i % nx : nx - 1 - ((-i - 1) % nx); }
bool isLand(ivec2 c) { return texelFetch(uStatic, c, 0).b > 0.5; }
vec4 rowA(int j) { return texelFetch(uRows, ivec2(j, 0), 0); }
vec4 rowB(int j) { return texelFetch(uRows, ivec2(j, 1), 0); }

// Back-trace from cell c over dt days (dt < 0 traces forward), in cell units,
// using the cos-lat of the destination row.
vec2 traceFrom(ivec2 c, float dt) {
  vec2 vel = texelFetch(uStatic, c, 0).rg;
  float cosL = rowA(c.y).w;
  return vec2(float(c.x) - vel.x * dt / (uCellKm * cosL), float(c.y) - vel.y * dt / uCellKm);
}

// Land-renormalised bilinear over the four texels around p; lo/hi over the
// same OCEAN texels (zero-weight ones included). ok = false when all are land.
struct Tap { vec4 v; vec4 lo; vec4 hi; bool ok; };
Tap sample4(sampler2D field, vec2 p) {
  int ny = nyI();
  float y = clamp(p.y, 0.0, float(ny - 1));
  int i0 = int(floor(p.x));
  int j0 = min(ny - 2, int(floor(y)));
  float fx = p.x - float(i0);
  float fy = y - float(j0);
  Tap s;
  s.v = vec4(0.0);
  s.lo = vec4(1e30);
  s.hi = vec4(-1e30);
  float wsum = 0.0;
  for (int t = 0; t < 4; t++) {
    int di = t & 1;
    int dj = t >> 1;
    ivec2 q = ivec2(wrapI(i0 + di), j0 + dj);
    if (isLand(q)) continue;
    float w = (di == 1 ? fx : 1.0 - fx) * (dj == 1 ? fy : 1.0 - fy);
    vec4 val = texelFetch(field, q, 0);
    wsum += w;
    s.v += w * val;
    s.lo = min(s.lo, val);
    s.hi = max(s.hi, val);
  }
  s.ok = wsum >= 1e-9;
  if (s.ok) s.v /= wsum;
  return s;
}

// NaN/inf -> 0, clamp >= 0, deficit <= DO saturation of the row. Land is the caller's job.
vec4 guardCell(vec4 v, int j) {
  v = vec4(
    (v.x >= 0.0 && v.x < 1e30) ? v.x : 0.0,
    (v.y >= 0.0 && v.y < 1e30) ? v.y : 0.0,
    (v.z >= 0.0 && v.z < 1e30) ? v.z : 0.0,
    (v.w >= 0.0 && v.w < 1e30) ? v.w : 0.0);
  v.w = min(v.w, rowA(j).z);
  return v;
}
`;

// Semi-Lagrangian advection (BFECC forward leg).
const ADVECT_FS = `${COMMON}
uniform sampler2D uSrc;  // unit 0
uniform float uDt;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  if (isLand(c)) { outColor = vec4(0.0); return; }
  Tap s = sample4(uSrc, traceFrom(c, uDt));
  outColor = s.ok ? s.v : texelFetch(uSrc, c, 0);
}
`;

// BFECC backward leg folded with the correction: corr = s + (s - back) / 2.
const CORRECT_FS = `${COMMON}
uniform sampler2D uState; // unit 0
uniform sampler2D uFwd;   // unit 3
uniform float uDt;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 st = texelFetch(uState, c, 0);
  vec4 back = vec4(0.0);
  if (!isLand(c)) {
    Tap s = sample4(uFwd, traceFrom(c, -uDt));
    back = s.ok ? s.v : texelFetch(uFwd, c, 0);
  }
  outColor = st + 0.5 * (st - back);
}
`;

// BFECC final leg with the min/max limiter over the ORIGINAL state, then guard.
const FINAL_FS = `${COMMON}
uniform sampler2D uState; // unit 0
uniform sampler2D uCorr;  // unit 3
uniform float uDt;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  if (isLand(c)) { outColor = vec4(0.0); return; }
  vec2 p = traceFrom(c, uDt);
  Tap s0 = sample4(uState, p);
  if (!s0.ok) { outColor = guardCell(texelFetch(uState, c, 0), c.y); return; }
  Tap s1 = sample4(uCorr, p);
  outColor = guardCell(clamp(s1.v, s0.lo, s0.hi), c.y);
}
`;

// One explicit diffusion substep; y-term in flux form; land and poles mirror C.
const DIFFUSE_FS = `${COMMON}
uniform sampler2D uSrc;  // unit 0
uniform float uD;        // km^2/day
uniform float uH;        // substep, days
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  if (isLand(c)) { outColor = vec4(0.0); return; }
  int i = c.x;
  int j = c.y;
  int ny = nyI();
  vec4 C = texelFetch(uSrc, c, 0);
  ivec2 cE = ivec2(wrapI(i + 1), j);
  ivec2 cW = ivec2(wrapI(i - 1), j);
  vec4 E = isLand(cE) ? C : texelFetch(uSrc, cE, 0);
  vec4 W = isLand(cW) ? C : texelFetch(uSrc, cW, 0);
  vec4 N = C;
  if (j + 1 < ny && !isLand(ivec2(i, j + 1))) N = texelFetch(uSrc, ivec2(i, j + 1), 0);
  vec4 S = C;
  if (j - 1 >= 0 && !isLand(ivec2(i, j - 1))) S = texelFetch(uSrc, ivec2(i, j - 1), 0);
  vec4 ra = rowA(j);
  vec4 rb = rowB(j);
  float dx = uCellKm * ra.w;
  float dx2 = dx * dx;
  float dy2 = uCellKm * uCellKm;
  vec4 yTerm = (rb.x * (N - C) - rb.y * (C - S)) / (ra.w * dy2);
  outColor = C + uD * uH * ((E + W - 2.0 * C) / dx2 + yTerm);
}
`;

// Guard the diffused input, exact reaction, inject sources, guard again.
const REACT_FS = `${COMMON}
uniform sampler2D uSrc;     // unit 0
uniform sampler2D uSources; // unit 3: per-cell sum(conc * f), 1/day
uniform float uDt;
uniform float uReact;       // 1 = reactions on
uniform float uTauT;
uniform float uTauN;

// (e^{-kd t} - e^{-ka t}) / (ka - kd), with a series near ka = kd (float32-safe threshold).
// Deliberately 1e-2 threshold / 4-term series (CPU kinetics.js uses 1e-4 / 3-term) for float32; truncation ~x^4/120.
float bridge(float kdv, float kav, float t) {
  float eD = exp(-kdv * t);
  float eA = exp(-kav * t);
  float x = (kav - kdv) * t;
  if (abs(x) < 1e-2) return t * eD * (1.0 - x * 0.5 + x * x / 6.0 - x * x * x / 24.0);
  return (eD - eA) / (kav - kdv);
}

void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  if (isLand(c)) { outColor = vec4(0.0); return; }
  vec4 v = guardCell(texelFetch(uSrc, c, 0), c.y);
  if (uReact > 0.5) {
    vec4 r = rowA(c.y);
    float L = v.y;
    float D = v.w;
    v.x *= exp(-uDt / uTauT);
    v.y = L * exp(-r.x * uDt);
    v.z *= exp(-uDt / uTauN);
    v.w = r.x * L * bridge(r.x, r.y, uDt) + D * exp(-r.y * uDt);
  }
  v += texelFetch(uSources, c, 0) * uDt;
  outColor = guardCell(v, c.y);
}
`;

export const SIM_PROGRAMS = {
  advect: { fs: ADVECT_FS, uniforms: ['uSrc', 'uDt'] },
  correct: { fs: CORRECT_FS, uniforms: ['uState', 'uFwd', 'uDt'] },
  final: { fs: FINAL_FS, uniforms: ['uState', 'uCorr', 'uDt'] },
  diffuse: { fs: DIFFUSE_FS, uniforms: ['uSrc', 'uD', 'uH'] },
  react: { fs: REACT_FS, uniforms: ['uSrc', 'uSources', 'uDt', 'uReact', 'uTauT', 'uTauN'] },
};

export const COMPOSITE_UNIFORMS = [
  'uState', 'uStatic', 'uGrid', 'uRes', 'uTime', 'uRef', 'uGain', 'uRim', 'uAberration',
];

// Display composite (spec §1): per-channel log exposure, additive emission,
// deficit as absence of light, cyan rim on the deficit gradient, slight
// chromatic aberration, 1-px scanline + grain dither (no bloom).
export const COMPOSITE_FS = `${COMMON}
uniform sampler2D uState;   // unit 0
uniform vec2 uRes;          // backing-store pixels
uniform float uTime;        // seconds; grain seed
uniform vec4 uRef;          // reference concentration per channel for log exposure
uniform vec4 uGain;         // exposure gain per channel (w = deficit void strength)
uniform float uRim;         // cyan rim gain
uniform float uAberration;  // chromatic offset, cells

const vec3 CRIMSON = vec3(1.0, 0.09, 0.20);
const vec3 AMBER = vec3(1.0, 0.62, 0.0);
const vec3 GREEN = vec3(0.22, 1.0, 0.08);
const vec3 CYAN = vec3(0.0, 0.90, 1.0);
const vec3 BASE = vec3(0.020);
const vec3 LAND = vec3(0.039);
const vec3 COAST = vec3(0.08, 0.72, 0.65);

vec4 stateAt(vec2 p) {
  Tap s = sample4(uState, p);
  return s.ok ? s.v : vec4(0.0);
}

float landAt(vec2 p) {
  int ny = nyI();
  float y = clamp(p.y, 0.0, float(ny - 1));
  int i0 = int(floor(p.x));
  int j0 = min(ny - 2, int(floor(y)));
  float fx = p.x - float(i0);
  float fy = y - float(j0);
  float l = 0.0;
  for (int t = 0; t < 4; t++) {
    int di = t & 1;
    int dj = t >> 1;
    float w = (di == 1 ? fx : 1.0 - fx) * (dj == 1 ? fy : 1.0 - fy);
    l += w * texelFetch(uStatic, ivec2(wrapI(i0 + di), j0 + dj), 0).b;
  }
  return l;
}

vec4 intensity(vec4 v) { return log(1.0 + max(v, vec4(0.0)) / uRef) * uGain; }
vec3 emission(vec4 I) { return (I.x * CRIMSON + I.y * AMBER + I.z * GREEN) * exp(-I.w); }

void main() {
  vec2 p = vec2(gl_FragCoord.x / uRes.x * uGrid.x - 0.5, gl_FragCoord.y / uRes.y * uGrid.y - 0.5);
  vec4 I = intensity(stateAt(p));
  vec3 e = emission(I);
  vec3 eR = emission(intensity(stateAt(p + vec2(uAberration, 0.0))));
  vec3 eB = emission(intensity(stateAt(p - vec2(uAberration, 0.0))));
  e = vec3(eR.r, e.g, eB.b);
  float gx = intensity(stateAt(p + vec2(1.0, 0.0))).w - intensity(stateAt(p - vec2(1.0, 0.0))).w;
  float gy = intensity(stateAt(p + vec2(0.0, 1.0))).w - intensity(stateAt(p - vec2(0.0, 1.0))).w;
  float rim = smoothstep(0.05, 0.4, 0.5 * length(vec2(gx, gy))) * uRim;
  vec3 col = BASE + (1.0 - exp(-e)) + rim * 0.35 * CYAN;
  float lf = landAt(p);
  col = mix(col, LAND, smoothstep(0.45, 0.55, lf));
  col += COAST * 0.22 * smoothstep(0.6, 1.0, 1.0 - abs(2.0 * lf - 1.0));
  float scan = mod(floor(gl_FragCoord.y), 2.0) < 1.0 ? 0.96 : 1.0;
  float n = fract(sin(dot(gl_FragCoord.xy + uTime * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
  outColor = vec4(col * scan + (n - 0.5) / 255.0, 1.0);
}
`;

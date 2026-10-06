// src/terminal/mercury/planet/gasStreak.js — gas filaments for the element flows (mirror-sky spec §3, Option A).
//
// Two particle roles in ONE draw per flow (author, 2026-10-05). aRole 0 = fog: the flow's old round sprite,
// passed through untouched (size, shape), unmasked, alpha × uFogAlpha. It keeps the nebula's body and colour
// blending. aRole 1 = filament: a thin capsule whose WIDTH is uFilWidth CSS px × uDpr at GAS_Z_REF (perspective,
// ±25 % by a size label, floored at GAS_PX_FLOOR CSS px × uDpr). Its LENGTH (buffer px, so it follows the dpr
// too and the aspect is DPR-invariant) beyond the round core is the on-screen speed × uStreakGain (a
// shutter), capped at (aspectMax − 1) × width, both scaled by a ±FIL_JITTER per-particle jitter so dashes never
// read uniform. The alpha is lane-masked × uFilAlpha. Each flow samples its big analytic motion twice (phase now,
// and STREAK_DT of clock time earlier); calm zeroes uPhaseRate, so filaments go round. gasLane() is a ridged
// simplex in the flow's own cross-stream labels: lanes of particles travelling with the current, slowly evolving.
// Counts (spec §3e, gasCounts): fog = the old (base) count, so the tier multiplier feeds the filaments; fire keeps
// its old body count and multiplies its old ember count. gasRoles() spreads the fog slots evenly (exact, deterministic).
// Threads (Task 7d, author 2026-10-06): fluid + air PLACE their filaments on a few lanes (gasThreads): irregular
// seeded lane centres, uneven lane weights, stratified spacing along each lane, a clipped-normal cross jitter, so
// dashes chain head to tail into threads. The lane mask then runs ALONG each thread (gasThreadCoord: lane id + the
// along-lane label on a seamless loop), so a thread fades in and out along its length but is never re-shredded.
// Needs uViewportPx (PLANET_WINDOW_VS) and the flow's snoise(vec3) declared before GAS_STREAK_VS.

import { glf } from '../../gl/glf';

export const STREAK_DT = 1 / 30;
export const FIL_ASPECT = 16;         // filament length cap (× width), author 2026-10-06 (was 8, before that 3)
export const FIL_JITTER = 0.3;        // ± per-particle length jitter (cap included)
export const FIRE_EMBER_STRETCH = 1.5;
export const FIRE_EMBER_GAIN = 20;    // fire embers: the old 0.006–0.018 alpha was sized for big overlapping discs
export const FIRE_EMBER_SHARE = 0.15;  // the old fire: 85 % body, 15 % embers
export const GAS_PX_FLOOR = 1.5;      // CSS px (× uDpr): filaments never go sub-pixel (fog keeps its old size, unfloored)
export const GAS_Z_REF = 4.43;        // fitted desktop camera distance (look probe 1600×1000): uFilWidth is CSS px here
export const MASK_EVOLVE = 0.03;
export const GAS_MASK_LOOP = 1.0;     // radius of the along-lane loop in mask label space (× uMaskFreq): ~8 bright stretches per lane
export const GAS_MASK_LANE_GAP = 3.0; // lane id → mask x offset; > loop diameter + a noise feature, so lanes are independent
export const THREAD_ALONG_JITTER = 0.8;  // stratified along-lane jitter, × the lane's mean spacing (max gap ≤ 1.8 spacings)
export const THREAD_CROSS_CLIP = 2.5;    // cross-lane jitter = a unit normal clipped at ±this (flows scale it by their σ)
export const THREAD_WEIGHT_FLOOR = 0.35; // lane weight = floor + Exp(1): uneven (dense + faint threads), none vanishing

// Particle counts for one flow (spec §3e): `base` = its old count (params.density or GHOST_DENSITY), `mult` = the
// tier's gasDensity (1 for ghosts). Fog = the old count; the multiplier feeds the filaments. Fire: body = the old
// body count, embers = the old ember count × mult (written so that n = base exactly at ×1).
export function gasCounts(base, mult, fire = false) {
  if (fire) {
    const oldEmbers = Math.round(base * FIRE_EMBER_SHARE);
    const fog = base - oldEmbers;
    return { n: fog + Math.round(base * FIRE_EMBER_SHARE * mult), fog };
  }
  return { n: Math.round(base * mult), fog: base };
}

// Per-particle role (0 fog / 1 filament): exactly nFog fog slots, evenly spread (Bresenham), deterministic.
export function gasRoles(count, nFog) {
  const roles = new Float32Array(count);
  for (let i = 0; i < count; i++) roles[i] = Math.floor(((i + 1) * nFog) / count) > Math.floor((i * nFog) / count) ? 0 : 1;
  return roles;
}

// A unit normal clipped to ±THREAD_CROSS_CLIP (Box-Muller, rejection), from a [0, 1) rng.
function clippedNormal(rng) {
  for (;;) {
    const z = Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
    if (Math.abs(z) <= THREAD_CROSS_CLIP) return z;
  }
}

// A random permutation of 0..L-1 (Fisher-Yates) from a [0, 1) rng.
function permutation(L, rng) {
  const p = Array.from({ length: L }, (_, k) => k);
  for (let k = L - 1; k > 0; k--) {
    const j = Math.floor(rng() * (k + 1));
    [p[k], p[j]] = [p[j], p[k]];
  }
  return p;
}

// L stratified values in [0, 1): one per stratum [m/L, (m+1)/L), strata in random order, uniform inside. Irregular,
// but the mean stays within 0.5/L of 0.5 (lane rates: the mirror sky's pace; air altitudes: both directions).
export function gasStratified(L, rng) {
  const p = permutation(L, rng);
  const out = new Float32Array(L);
  for (let k = 0; k < L; k++) out[k] = (p[k] + rng()) / L;
  return out;
}

// Weight-aware lane pace (Task 7e): reorder `values` (one rate label per lane) over the lanes so the count-weighted
// mean is as close to 0.5 as possible: exhaustive (Heap's permutations) for ≤ 8 lanes, else a greedy fill (each lane,
// heaviest first, takes the value that best pulls the running mean to 0.5). Build time only. The multiset is kept,
// so the rates stay stratified and irregular; only which lane gets which changes.
export function gasPaceMatch(values, counts) {
  const L = values.length;
  const out = new Float32Array(values);
  let total = 0;
  for (let k = 0; k < L; k++) total += counts[k];
  if (L < 2 || total <= 0) return out;
  const err = (v) => {
    let s = 0;
    for (let k = 0; k < L; k++) s += v[k] * counts[k];
    return Math.abs(s / total - 0.5);
  };
  if (L <= 8) {
    const a = Array.from(values);
    const c = new Array(L).fill(0);
    let best = err(a), bestA = a.slice();
    for (let i = 0; i < L;) {
      if (c[i] < i) {
        const j = i % 2 === 0 ? 0 : c[i];
        [a[j], a[i]] = [a[i], a[j]];
        const e = err(a);
        if (e < best) { best = e; bestA = a.slice(); }
        c[i]++;
        i = 0;
      } else {
        c[i] = 0;
        i++;
      }
    }
    out.set(bestA);
    return out;
  }
  const order = Array.from({ length: L }, (_, k) => k).sort((x, y) => counts[y] - counts[x]);
  const pool = Array.from(values);
  let s = 0, n = 0;
  for (const k of order) {
    let bi = 0, be = Infinity;
    for (let i = 0; i < pool.length; i++) {
      const e = Math.abs((s + pool[i] * counts[k]) / (n + counts[k]) - 0.5);
      if (e < be) { be = e; bi = i; }
    }
    out[k] = pool[bi];
    s += pool[bi] * counts[k];
    n += counts[k];
    pool.splice(bi, 1);
  }
  return out;
}

// Filament lane placement (Task 7d), pure + deterministic for a seeded rng (prng.js mulberry32). Per filament:
// lane (integer, lane-major order), along ∈ [0, 1) (stratified within its lane from a random lane start, jittered by
// THREAD_ALONG_JITTER of the spacing) and cross (a clipped unit normal; the flow scales it by its own σ). Lane counts
// follow uneven weights (THREAD_WEIGHT_FLOOR + Exp(1), largest remainder) with ≥ 1 per lane while nFil ≥ lanes.
export function gasThreads(nFil, lanes, rng) {
  const lane = new Float32Array(nFil);
  const along = new Float32Array(nFil);
  const cross = new Float32Array(nFil);
  const counts = new Int32Array(lanes);
  const starts = new Float32Array(Math.max(lanes, 0));
  if (nFil <= 0 || lanes <= 0) return { lane, along, cross, counts, starts };
  const used = Math.min(lanes, nFil);
  const w = new Float64Array(used);
  let sum = 0;
  for (let k = 0; k < used; k++) { w[k] = THREAD_WEIGHT_FLOOR - Math.log(1 - rng()); sum += w[k]; }
  const rest = nFil - used;
  const rem = new Float64Array(used);
  let given = 0;
  for (let k = 0; k < used; k++) {
    const q = (w[k] / sum) * rest;
    counts[k] = 1 + Math.floor(q);
    rem[k] = q - Math.floor(q);
    given += counts[k];
  }
  for (; given < nFil; given++) {
    let best = 0;
    for (let k = 1; k < used; k++) if (rem[k] > rem[best]) best = k;
    counts[best]++;
    rem[best] = -1;
  }
  // Per-lane grid offsets (fix wave: lanes on a shared grid phase stack into a ladder): a permuted stratum each,
  // jittered inside its middle half, so any two lanes' grids start ≥ 0.5/lanes apart.
  const perm = permutation(lanes, rng);
  for (let k = 0; k < lanes; k++) starts[k] = (perm[k] + 0.25 + 0.5 * rng()) / lanes;
  let i = 0;
  for (let k = 0; k < used; k++) {
    const n = counts[k];
    const start = starts[k];
    for (let j = 0; j < n; j++, i++) {
      const a = start + (j + 0.5 + THREAD_ALONG_JITTER * (rng() - 0.5)) / n;
      lane[i] = k;
      along[i] = a - Math.floor(a);
      cross[i] = clippedNormal(rng);
    }
  }
  return { lane, along, cross, counts, starts };
}

export const GAS_STREAK_VS = /* glsl */ `
uniform float uPhaseRate;
uniform float uStreakGain;
uniform float uFilWidth;
uniform float uFilAlpha;
uniform float uFogAlpha;
uniform float uMaskFreq;
uniform float uMaskSharp;
uniform float uMaskDepth;
uniform float uDpr;
uniform float uAirFilGain;
varying vec2 vStreakDir;
varying vec2 vStreakCap;
varying float vLane;
varying float vRole;
const float STREAK_DT = ${glf(STREAK_DT)};
const float FIL_ASPECT = ${glf(FIL_ASPECT)};
const float FIL_JITTER = ${glf(FIL_JITTER)};
const float FIRE_EMBER_STRETCH = ${glf(FIRE_EMBER_STRETCH)};
const float FIRE_EMBER_GAIN = ${glf(FIRE_EMBER_GAIN)};
const float GAS_PX_FLOOR = ${glf(GAS_PX_FLOOR)};
const float GAS_Z_REF = ${glf(GAS_Z_REF)};
const float MASK_EVOLVE = ${glf(MASK_EVOLVE)};
const float GAS_MASK_LOOP = ${glf(GAS_MASK_LOOP)};
const float GAS_MASK_LANE_GAP = ${glf(GAS_MASK_LANE_GAP)};

float gasHash(float a, float b) {
  return fract(sin(a * 91.7 + b * 47.3) * 43758.5453);
}

float gasFilWidth(float depth, float s01, float bite) {
  return uFilWidth * uDpr * (GAS_Z_REF / max(depth, 0.5)) * mix(0.75, 1.25, s01) * bite;
}

float gasSprite(vec4 clipNow, vec4 clipPrev, float role, float size, float aspectMax, float jit) {
  vRole = role;
  if (role < 0.5) {
    vStreakDir = vec2(1.0, 0.0);
    vStreakCap = vec2(0.0, 0.5);
    return size;
  }
  float w = max(size, GAS_PX_FLOOR * uDpr);
  vec2 v = vec2(0.0);
  if (clipNow.w > 1e-4 && clipPrev.w > 1e-4) {
    v = (clipNow.xy / clipNow.w - clipPrev.xy / clipPrev.w) * 0.5 * uViewportPx / STREAK_DT;
  }
  float sp = length(v);
  float L = min(sp * uStreakGain, max(aspectMax - 1.0, 0.0) * w) * (1.0 + FIL_JITTER * (2.0 * jit - 1.0));
  float total = w + L;
  vStreakDir = sp > 1e-3 ? vec2(v.x, -v.y) / sp : vec2(1.0, 0.0);
  vStreakCap = vec2(0.5 * L / total, 0.5 * w / total);
  return total;
}

float gasLane(vec3 laneCoord, float t) {
  float n = snoise(laneCoord * uMaskFreq + vec3(0.0, 0.0, t * MASK_EVOLVE));
  return mix(1.0, pow(max(1.0 - abs(n), 0.0), uMaskSharp), uMaskDepth);
}

// Mask label for a thread particle: its lane id (shared by the whole thread) + its along-lane label on a seamless loop.
vec3 gasThreadCoord(float lane, float along) {
  float a = along * 6.283185307;
  return vec3(cos(a) * GAS_MASK_LOOP + lane * GAS_MASK_LANE_GAP, sin(a) * GAS_MASK_LOOP, 0.0);
}

float gasAlpha(float role, vec3 laneCoord, float t) {
  if (role < 0.5) return uFogAlpha;
  return gasLane(laneCoord, t) * uFilAlpha;
}

float gasRoleAlpha(float role) {
  return role < 0.5 ? uFogAlpha : uFilAlpha;
}
`;

export const GAS_STREAK_FS = /* glsl */ `
varying vec2 vStreakDir;
varying vec2 vStreakCap;
varying float vLane;
varying float vRole;
uniform float uPremult;
float gasStreakDist(vec2 pc) {
  vec2 q = pc - 0.5;
  float a = clamp(dot(q, vStreakDir), -vStreakCap.x, vStreakCap.x);
  return length(q - vStreakDir * a) / vStreakCap.y;
}
// Output for a flow drawn with premultiplied blending (One / OneMinusSrcAlpha), Task 7c. a = the alpha without dither.
// uPremult 0 (standalone pages, additive/normal blending): the old output. Premultiplied: fog = color * A, A (= normal
// blending numerically); filament = color * a, alpha 0 (pure additive: adds light, never darkens the fog behind it).
vec4 gasOut(vec3 color, float a, float dither) {
  if (uPremult < 0.5) return vec4(color, a + dither);
  if (vRole < 0.5) return vec4(color * (a + dither), a + dither);
  return vec4(color * a + dither, 0.0);
}
`;

const GAS_TUNE = [['uStreakGain', 'streakGain'], ['uFilWidth', 'filWidth'], ['uFilAlpha', 'filAlpha'],
  ['uFogAlpha', 'fogAlpha'], ['uMaskFreq', 'maskFreq'], ['uMaskSharp', 'maskSharp'], ['uMaskDepth', 'maskDepth'],
  ['uAirFilGain', 'airFilGain']];

export function GAS_TUNE_UNIFORMS(tune) {
  return { ...Object.fromEntries(GAS_TUNE.map(([u, k]) => [u, { value: tune[k] }])), uDpr: { value: 1 } };
}

// Per frame: the knobs + the renderer's pixel ratio (state.gl.getPixelRatio()), no allocation.
export function writeGasTune(uniforms, tune, dpr = 1) {
  for (let i = 0; i < GAS_TUNE.length; i++) uniforms[GAS_TUNE[i][0]].value = tune[GAS_TUNE[i][1]];
  uniforms.uDpr.value = dpr;
}

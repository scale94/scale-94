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
// Threads (Task 7f + fix): a filament's dash lies along its lane's PATH (the secant between the same chain sampled at
// its two lane neighbours' along positions, gasSpriteThread) and is at least FIL_GAP_CLOSE x the on-screen distance
// to the farther neighbour, capped at FIL_GAP_ASPECT x width (author: up to 24x allowed). The speed-driven part keeps
// its aspectMax cap. Calm (rate 0): the speed part is 0, the gap part stays: frozen threads. FIL_GAP_CLOSE 1.3
// (replica, task-7d-report: calm visible gaps fluid 2.0 → 1.2 %, air 3.7 → 2.3 % vs 1.15; dash-off-path p95 ≤ 1.37 px).
// FIL_TAPER: the dash ends fade over this fraction of the length, = the overlap a gap-closed pair has (1 - 1/1.3),
// so two such dashes' complementary smoothstep ramps sum to ~1 (no beading at the particle spacing).
export const FIL_GAP_CLOSE = 1.3;
export const FIL_GAP_ASPECT = 24;
export const FIL_TAPER = 1 - 1 / FIL_GAP_CLOSE;
export const GAS_MASK_LOOP = 1.0;     // radius of the along-lane loop in mask label space (× uMaskFreq): ~8 bright stretches per lane
export const GAS_MASK_LANE_GAP = 3.0; // lane id → mask x offset; > loop diameter + a noise feature, so lanes are independent
export const THREAD_ALONG_JITTER = 0.8;  // stratified along-lane jitter, × the lane's mean spacing (max gap ≤ 1.8 spacings)
export const THREAD_CROSS_CLIP = 2.5;    // cross-lane jitter = a unit normal clipped at ±this (flows scale it by their σ)
// Soft threads §1 (2026-10-07): the filament cross-section is a Gaussian exp(-K d²), d in core half-widths, drawn on a
// quad widened by filHalo so the tail is not clipped. The old fluid capsule smoothstep(1, 0.3, |d|) carried
// 2 × (0.3 + 0.7 / 2) = 1.3 core half-widths of light across the thread; the peak keeps exactly that.
export const FIL_PROFILE_K = 1;
export const FIL_OLD_CROSS = 1.3;
export const FIL_PROFILE_PEAK = FIL_OLD_CROSS / Math.sqrt(Math.PI / FIL_PROFILE_K);
export const THREAD_WEIGHT_FLOOR = 0.35; // lane weight = floor + Exp(1): uneven (dense + faint threads), none vanishing

// Particle counts for one flow (spec §3e): `base` = its old count (params.density), `mult` = the
// tier's gasDensity (every flow gets the tier counts). Fog = the old count; the multiplier feeds the filaments. Fire: body = the old
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

// Weight-aware lane pace (Task 7e): reorder `values` (one rate label per lane) over the lanes so each group's
// count-weighted mean is as close to 0.5 as possible (objective: the sum over groups of |mean_g - 0.5|).
// `groups` (optional, per lane): a group id, or -1 to leave the lane out of every mean (it takes what is left);
// null = one group of all lanes. Air: lower 0 / upper 1 hemisphere, the ion lane -1 (the sky drives each
// hemisphere at AIR_ORBIT_MEAN, ionosphere excluded). Exhaustive (Heap's permutations) for ≤ 8 lanes, else a
// greedy fill, heaviest first. Build time only. The multiset is kept, so the rates stay stratified and irregular.
export function gasPaceMatch(values, counts, groups = null) {
  const L = values.length;
  const out = new Float32Array(values);
  const grp = Array.from({ length: L }, (_, k) => (groups ? groups[k] : 0));
  const G = Math.max(-1, ...grp) + 1;
  const tot = new Float64Array(Math.max(G, 1));
  for (let k = 0; k < L; k++) if (grp[k] >= 0) tot[grp[k]] += counts[k];
  if (L < 2 || G < 1) return out;
  const sums = new Float64Array(G);
  const err = (v) => {
    sums.fill(0);
    for (let k = 0; k < L; k++) if (grp[k] >= 0) sums[grp[k]] += v[k] * counts[k];
    let e = 0;
    for (let g = 0; g < G; g++) if (tot[g] > 0) e += Math.abs(sums[g] / tot[g] - 0.5);
    return e;
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
  const order = Array.from({ length: L }, (_, k) => k)
    .sort((x, y) => (grp[y] >= 0 ? counts[y] : -1) - (grp[x] >= 0 ? counts[x] : -1));
  const pool = Array.from(values);
  const s = new Float64Array(G), n = new Float64Array(G);
  for (const k of order) {
    const g = grp[k];
    let bi = 0, be = Infinity;
    for (let i = 0; i < pool.length; i++) {
      const e = g >= 0 && n[g] + counts[k] > 0 ? Math.abs((s[g] + pool[i] * counts[k]) / (n[g] + counts[k]) - 0.5) : 0;
      if (e < be) { be = e; bi = i; }
    }
    out[k] = pool[bi];
    if (g >= 0) { s[g] += pool[bi] * counts[k]; n[g] += counts[k]; }
    pool.splice(bi, 1);
  }
  return out;
}

// Filament lane placement (Task 7d), pure + deterministic for a seeded rng (prng.js mulberry32). Per filament:
// lane (integer, lane-major order), along ∈ [0, 1) (stratified within its lane from a random lane start, jittered by
// THREAD_ALONG_JITTER of the spacing) and cross (a clipped unit normal; the flow scales it by its own σ). Lane counts
// follow uneven weights (THREAD_WEIGHT_FLOOR + Exp(1), largest remainder) with ≥ 1 per lane while nFil ≥ lanes.
// gap (Task 7f): per filament, the larger of the along distances to its two lane neighbours (aPhase units), so a
// dash at least that long (on screen) reaches both neighbours' dashes. alongJitter: THREAD_ALONG_JITTER by default.
export function gasThreads(nFil, lanes, rng, alongJitter = THREAD_ALONG_JITTER) {
  const lane = new Float32Array(nFil);
  const along = new Float32Array(nFil);
  const cross = new Float32Array(nFil);
  const gap = new Float32Array(nFil);
  const counts = new Int32Array(lanes);
  const starts = new Float32Array(Math.max(lanes, 0));
  if (nFil <= 0 || lanes <= 0) return { lane, along, cross, gap, counts, starts };
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
    const first = i;
    for (let j = 0; j < n; j++, i++) {
      const a = start + (j + 0.5 + alongJitter * (rng() - 0.5)) / n;
      lane[i] = k;
      along[i] = a - Math.floor(a);
      cross[i] = clippedNormal(rng);
    }
    // lane-major, in along order (cyclic): neighbours are j - 1 and j + 1 around the loop
    for (let j = 0; j < n; j++) {
      const d = (x, y) => { const v = along[first + y] - along[first + x]; return v - Math.floor(v); };
      gap[first + j] = n < 2 ? 1 : Math.max(d((j + n - 1) % n, j), d(j, (j + 1) % n));
    }
  }
  return { lane, along, cross, gap, counts, starts };
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
uniform float uEmberSize;
uniform float uEmberGain;
uniform float uEarthStreakGain;
uniform float uPointMax;
uniform float uFilHalo;
varying vec2 vStreakDir;
varying vec2 vStreakDir2;
varying vec3 vStreakCap;
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
const float FIL_GAP_CLOSE = ${glf(FIL_GAP_CLOSE)};
const float FIL_GAP_ASPECT = ${glf(FIL_GAP_ASPECT)};
const float GAS_MASK_LOOP = ${glf(GAS_MASK_LOOP)};
const float GAS_MASK_LANE_GAP = ${glf(GAS_MASK_LANE_GAP)};

float gasHash(float a, float b) {
  return fract(sin(a * 91.7 + b * 47.3) * 43758.5453);
}

float gasFilWidth(float depth, float s01, float bite) {
  return uFilWidth * uDpr * (GAS_Z_REF / max(depth, 0.5)) * mix(0.75, 1.25, s01) * bite;
}

// Clip → buffer px (0 behind the camera).
vec2 gasScreenPx(vec4 clip) {
  return clip.w > 1e-4 ? clip.xy / clip.w * 0.5 * uViewportPx : vec2(0.0);
}

// Thread sprite (Task 7f fix). clipBack / clipAhead: the filament's own chain at its lane neighbours' along positions
// (pass clipNow for both = no thread: the old gasSprite). Direction = the path secant back → ahead (stable at any
// speed, so calm keeps the thread's shape); falls back to the time secant, then to x. Length = max(speed part
// ≤ aspectMax x w, gap part ≤ FIL_GAP_ASPECT x w), clamped so the sprite never exceeds uPointMax (the GPU's point size
// limit), width kept. Bent dash (Task 7g): on a thread the ahead half aims at pAhead (vStreakDir) and the back half
// at pBack (vStreakDir2), so the dash follows the path's bend instead of a chord through the particle (the straight
// dash stepped sideways from its neighbours on the knot's bends). No thread: vStreakDir2 = vStreakDir, one straight dash.
// gain: the shutter (s) for the speed part; gasSpriteThread / gasSprite pass uStreakGain, earth passes
// uStreakGain x uEarthStreakGain (gasSpriteGain, Task 8b).
float gasSpriteCore(vec4 clipNow, vec4 clipPrev, vec4 clipBack, vec4 clipAhead, float role, float size, float aspectMax, float jit, float gain) {
  vRole = role;
  if (role < 0.5) {
    vStreakDir = vec2(1.0, 0.0);
    vStreakDir2 = vStreakDir;
    vStreakCap = vec3(0.0, 0.5, 0.5);
    return size;
  }
  float w = max(size, GAS_PX_FLOOR * uDpr);
  vec2 v = vec2(0.0);
  if (clipNow.w > 1e-4 && clipPrev.w > 1e-4) {
    v = (clipNow.xy / clipNow.w - clipPrev.xy / clipPrev.w) * 0.5 * uViewportPx / STREAK_DT;
  }
  float sp = length(v);
  vec2 pNow = gasScreenPx(clipNow);
  vec2 pBack = gasScreenPx(clipBack);
  vec2 pAhead = gasScreenPx(clipAhead);
  vec2 tng = pAhead - pBack;
  float tl = length(tng);
  float gapPx = max(length(pNow - pBack), length(pAhead - pNow));
  vec2 dir = tl > 1e-3 ? tng / tl : (sp > 1e-3 ? v / sp : vec2(1.0, 0.0));
  float L = min(sp * gain, max(aspectMax - 1.0, 0.0) * w) * (1.0 + FIL_JITTER * (2.0 * jit - 1.0));
  L = max(L, min(FIL_GAP_CLOSE * gapPx - w, (FIL_GAP_ASPECT - 1.0) * w));
  float wq = w * max(uFilHalo, 1.0); // the drawn quad: room for the Gaussian tail (caps and length stay on the core w)
  L = min(L, max(uPointMax - wq, 0.0));
  float total = wq + L;
  vec2 dA = pAhead - pNow;
  vec2 dB = pNow - pBack;
  vec2 dirA = tl > 1e-3 && length(dA) > 1e-3 ? normalize(dA) : dir;
  vec2 dirB = tl > 1e-3 && length(dB) > 1e-3 ? normalize(dB) : dir;
  vStreakDir = vec2(dirA.x, -dirA.y); // point coords: y down
  vStreakDir2 = vec2(dirB.x, -dirB.y);
  vStreakCap = vec3(0.5 * L / total, 0.5 * w / total, 0.5 * (L + w) / total); // z: the capsule end (the taper's 0.5)
  return total;
}

float gasSpriteThread(vec4 clipNow, vec4 clipPrev, vec4 clipBack, vec4 clipAhead, float role, float size, float aspectMax, float jit) {
  return gasSpriteCore(clipNow, clipPrev, clipBack, clipAhead, role, size, aspectMax, jit, uStreakGain);
}

float gasSprite(vec4 clipNow, vec4 clipPrev, float role, float size, float aspectMax, float jit) {
  return gasSpriteCore(clipNow, clipPrev, clipNow, clipNow, role, size, aspectMax, jit, uStreakGain);
}

// No thread, own shutter (earth, Task 8b): the dash lies along the time secant (the settling direction), length =
// on-screen speed x gain, the cap (aspectMax) and the uPointMax guard unchanged.
float gasSpriteGain(vec4 clipNow, vec4 clipPrev, float role, float size, float aspectMax, float jit, float gain) {
  return gasSpriteCore(clipNow, clipPrev, clipNow, clipNow, role, size, aspectMax, jit, gain);
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
varying vec2 vStreakDir2;
varying vec3 vStreakCap;
varying float vLane;
varying float vRole;
uniform float uPremult;
const float FIL_TAPER = ${glf(FIL_TAPER)};
uniform float uFilEdgeDesat;
uniform float uFilCoreLift;
const float FIL_PROFILE_K = ${glf(FIL_PROFILE_K)};
const float FIL_PROFILE_PEAK = ${glf(FIL_PROFILE_PEAK)};
// Filament cross-section (soft threads §1): a Gaussian in core half-widths carrying the old capsule's light.
float gasFilProfile(float d) { return FIL_PROFILE_PEAK * exp(-FIL_PROFILE_K * d * d); }
// Filament colour across the thread (§4): the edges fall toward their own luminance (the fog's body, not neon), the
// core lifts toward white at its own brightness. Fog: unchanged.
vec3 gasFilTint(vec3 color, float d) {
  if (vRole < 0.5) return color;
  float l = dot(color, vec3(0.2126, 0.7152, 0.0722));
  vec3 c = mix(color, vec3(l), uFilEdgeDesat * smoothstep(0.5, 2.0, d));
  return mix(c, vec3(max(color.r, max(color.g, color.b))), uFilCoreLift * (1.0 - smoothstep(0.0, 0.5, d)));
}
// Capsule distance (/ half-width) to the bent dash: the ahead half along vStreakDir, the back half along -vStreakDir2
// (equal for a straight dash = the old one segment ± vStreakCap.x).
float gasStreakDist(vec2 pc) {
  vec2 q = pc - 0.5;
  float a = clamp(dot(q, vStreakDir), 0.0, vStreakCap.x);
  float b = clamp(-dot(q, vStreakDir2), 0.0, vStreakCap.x);
  return min(length(q - vStreakDir * a), length(q + vStreakDir2 * b)) / vStreakCap.y;
}
// Filament dash ends fade over FIL_TAPER of the length (along the streak axis), so overlapping gap-closed dashes sum
// to ~constant brightness. Fog: 1.
float gasTaper(vec2 pc) {
  if (vRole < 0.5) return 1.0;
  vec2 q = pc - 0.5;
  float sa = dot(q, vStreakDir), sb = -dot(q, vStreakDir2);
  // the half this fragment is nearer to (its own axis), as in gasStreakDist
  float da = length(q - vStreakDir * clamp(sa, 0.0, vStreakCap.x));
  float db = length(q + vStreakDir2 * clamp(sb, 0.0, vStreakCap.x));
  float s = abs(da <= db ? sa : sb);
  return 1.0 - smoothstep(0.5 - FIL_TAPER, 0.5, 0.5 * s / vStreakCap.z);
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
  ['uAirFilGain', 'airFilGain'], ['uEmberSize', 'emberSize'], ['uEmberGain', 'emberGain'],
  ['uEarthStreakGain', 'earthStreakGain'], ['uFilHalo', 'filHalo'], ['uFilEdgeDesat', 'filEdgeDesat'], ['uFilCoreLift', 'filCoreLift']];

export const GAS_POINT_MAX_UNKNOWN = 1e4; // no clamp when the limit can't be read (non-WebGL contexts, tests)

export function GAS_TUNE_UNIFORMS(tune) {
  return {
    ...Object.fromEntries(GAS_TUNE.map(([u, k]) => [u, { value: tune[k] }])),
    uDpr: { value: 1 },
    uPointMax: { value: GAS_POINT_MAX_UNKNOWN },
  };
}

// The GPU's largest point size (ALIASED_POINT_SIZE_RANGE[1], buffer px), read once per renderer and cached.
const pointMaxCache = new WeakMap();
export function gasPointMax(renderer) {
  if (!renderer) return GAS_POINT_MAX_UNKNOWN;
  let v = pointMaxCache.get(renderer);
  if (v === undefined) {
    const ctx = renderer.getContext ? renderer.getContext() : null;
    const r = ctx && ctx.getParameter ? ctx.getParameter(ctx.ALIASED_POINT_SIZE_RANGE) : null;
    v = r && r[1] > 0 ? r[1] : GAS_POINT_MAX_UNKNOWN;
    pointMaxCache.set(renderer, v);
  }
  return v;
}

// Per frame: the knobs + the renderer's pixel ratio (state.gl.getPixelRatio()) + its point size limit
// (gasPointMax(state.gl)), no allocation. A uniform missing from `uniforms` is skipped: after a hot reload adds a knob,
// a flow's mount-time uniforms object lacks it, and a throw here would fire every frame (console flood, tab froze).
export function writeGasTune(uniforms, tune, dpr = 1, pointMax = GAS_POINT_MAX_UNKNOWN) {
  for (let i = 0; i < GAS_TUNE.length; i++) {
    const u = uniforms[GAS_TUNE[i][0]];
    if (u) u.value = tune[GAS_TUNE[i][1]];
  }
  if (uniforms.uDpr) uniforms.uDpr.value = dpr;
  if (uniforms.uPointMax) uniforms.uPointMax.value = pointMax;
}

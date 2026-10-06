// src/terminal/air/atmosphericFlowBuffers.js — AtmosphericFlow's per-particle attributes (pure, testable).
//
// Fog (aRole 0) is built exactly as before (Math.random; ~8 % ionosphere). Filaments (aRole 1) are threads (Task 7d):
// AIR_LANES orbits with seeded, irregular centres (aAlt, aSpeed) and a per-lane aIon (≈ AIR_ION_SHARE of the lanes,
// at least one); gasThreads gives each lane its uneven share and a stratified orbit phase. aSpeed (the orbit rate) is
// SHARED exactly within a lane so a thread's spacing never shears; the width comes from the altitude jitter
// (AIR_SIGMA_ALT: orbit height and radius) plus the shader's shimmer. Lane centres keep AIR_FLIP_GAP clear of the
// aAlt 0.5 direction flip, so no thread splits into counter-rotating halves (lanes either side DO counter-rotate).
// aLane: the lane id (mask), -1 for fog.

import { gasRoles, gasThreads, gasStratified, gasPaceMatch, THREAD_CROSS_CLIP } from '../mercury/planet/gasStreak';
import { mulberry32 } from '../mercury/planet/prng';

export const AIR_LANES = 8;     // fix wave: fewer, denser threads
export const AIR_SIGMA_ALT = 0.0015;  // aAlt jitter (7f fix, was 0.006: neighbours p95 13 px apart ACROSS the thread)
export const AIR_ION_SHARE = 0.08;    // the old ionosphere fraction, now per lane
export const AIR_FLIP_GAP = THREAD_CROSS_CLIP * AIR_SIGMA_ALT + 0.005; // lane centre ↔ the aAlt 0.5 flip
export const AIR_THREAD_SEED = 0xa17d;
export const AIR_ALONG_JITTER = 0.8;  // along-lane jitter (× spacing) for air threads
// Task 7e: filament orbits are tilted per lane (no flat rungs side-on) and wander vertically, periodic in the angle.
export const AIR_TILT_MIN = (8 * Math.PI) / 180;   // rad; tilt axis azimuth is random per lane (gasHash(aLane, .))
export const AIR_TILT_MAX = (20 * Math.PI) / 180;
export const AIR_WANDER = 0.12;      // scene units of vertical wander amplitude (filaments)
export const AIR_WANDER_R = 0.6;     // noise loop radius per orbit: ~2 slow undulations around it
export const AIR_WANDER_RATE = 0.05; // noise time rate: slow
// Task 7e fix 2: filaments are streamlines. The fine shimmer is fog-only and the curl is damped, so a dash is a chord
// of a smooth arc: JS replica of the air chain (desktop camera, 1000 px, real dash lengths) → chord-vs-arc deviation
// p95 4.4 / p99 10.7 px at curl x1 + shimmer + 16x; p95 0.45 / p99 1.6 px at curl x0.25, no shimmer, 6x.
export const AIR_FIL_CURL = 0.25;    // filament curl × this (fog × 1)
export const AIR_FIL_ASPECT = 6;     // air filament dash cap (× width); fluid keeps FIL_ASPECT 16

export function buildBuffers(count, nFog, seed = AIR_THREAD_SEED) {
  const positions = new Float32Array(count * 3);
  const phases    = new Float32Array(count);
  const speeds    = new Float32Array(count);
  const seeds     = new Float32Array(count);
  const sizes     = new Float32Array(count);
  const alts      = new Float32Array(count);
  const ions      = new Float32Array(count);
  const lanes     = new Float32Array(count).fill(-1);
  const gaps      = new Float32Array(count); // filaments: the larger neighbour gap in aPhase units (fog 0, unused)
  const roles = gasRoles(count, nFog);
  let nFil = 0;
  for (let i = 0; i < count; i++) nFil += roles[i];

  const rng = mulberry32(seed);
  // Altitudes and rates both stratified (irregular, but both directions present and the mean rate ≈ AIR_ORBIT_MEAN).
  const laneAlt = gasStratified(AIR_LANES, rng);
  for (let k = 0; k < AIR_LANES; k++) {
    let a = 0.03 + 0.94 * laneAlt[k];
    if (Math.abs(a - 0.5) < AIR_FLIP_GAP) a = a > 0.5 ? 0.5 + AIR_FLIP_GAP : 0.5 - AIR_FLIP_GAP;
    laneAlt[k] = a;
  }
  const laneSpeed0 = gasStratified(AIR_LANES, rng);
  const laneIon = new Float32Array(AIR_LANES);
  const nIon = Math.max(1, Math.round(AIR_ION_SHARE * AIR_LANES));
  const order = Array.from({ length: AIR_LANES }, (_, k) => k);
  for (let k = 0; k < nIon; k++) {
    const j = k + Math.floor(rng() * (AIR_LANES - k));
    [order[k], order[j]] = [order[j], order[k]];
    laneIon[order[k]] = 1;
  }
  const th = gasThreads(nFil, AIR_LANES, rng, AIR_ALONG_JITTER);
  // Particle-weighted orbit rate ≈ the clock mean in EACH hemisphere (the sky drives the upper and lower layer at
  // AIR_ORBIT_MEAN on their own); the ion lane is left out (AIR_ORBIT_MEAN excludes the ionosphere).
  const hemi = Array.from(laneAlt, (a, k) => (laneIon[k] ? -1 : a > 0.5 ? 1 : 0));
  const laneSpeed = gasPaceMatch(laneSpeed0, th.counts, hemi);

  for (let i = 0, f = 0; i < count; i++) {
    if (roles[i] < 0.5) {
      positions[i * 3]     = (Math.random() * 2 - 1) * 1.2;
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * 1.2;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * 1.2;
      phases[i] = Math.random();
      speeds[i] = Math.random();
      seeds[i]  = Math.random();
      // Air particles are mostly tiny (molecules), skewed very small
      sizes[i]  = Math.pow(Math.random(), 1.6);
      // Altitude distributed across all layers, slight bias toward mid
      alts[i]   = Math.random();
      ions[i]   = Math.random() < AIR_ION_SHARE ? 1.0 : 0.0;
    } else {
      const k = th.lane[f];
      const c = laneAlt[k];
      const a = c + AIR_SIGMA_ALT * th.cross[f];
      positions[i * 3]     = (rng() * 2 - 1) * 1.2;
      positions[i * 3 + 1] = (rng() * 2 - 1) * 1.2;
      positions[i * 3 + 2] = (rng() * 2 - 1) * 1.2;
      phases[i] = th.along[f];
      speeds[i] = laneSpeed[k];
      seeds[i]  = rng();
      sizes[i]  = Math.pow(rng(), 1.6);
      alts[i]   = c > 0.5 ? Math.min(Math.max(a, 0.5 + 1e-4), 1) : Math.min(Math.max(a, 0), 0.5);
      ions[i]   = laneIon[k];
      lanes[i]  = k;
      gaps[i]   = th.gap[f];
      f++;
    }
  }
  return { positions, phases, speeds, seeds, sizes, alts, ions, lanes, gaps, roles };
}

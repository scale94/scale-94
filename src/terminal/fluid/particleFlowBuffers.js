// src/terminal/fluid/particleFlowBuffers.js — ParticleFlow's per-particle attributes (pure, testable).
//
// Fog (aRole 0) is built exactly as before: Math.random knot phase, tube radius and tube angle. Filaments (aRole 1)
// are threads (Task 7d): FLUID_LANES streamlines with seeded, irregular centres (aRadius, aOffset); gasThreads gives
// each its uneven share and a stratified knot phase along it, so neighbouring dashes chain head to tail. aOffset is
// SHARED exactly within a lane: it sets the knot speed too (0.6 + aOffset·0.4), so any per-particle jitter on it
// would shear a thread's even spacing apart along the knot within a minute. The thread's width comes from the
// radial jitter (FLUID_SIGMA_R) plus the shader's per-particle shimmer. aLane: the lane id (mask), -1 for fog.

import { gasRoles, gasThreads, gasStratified, gasPaceMatch } from '../mercury/planet/gasStreak';
import { mulberry32 } from '../mercury/planet/prng';

export const FLUID_LANES = 8;   // fewer, denser threads (dashes overlap instead of a dashed rhythm); 6 read sparse (Task 7e)
export const FLUID_SIGMA_R = 0.03;        // radial jitter, in tube-radius units (× uTubeRadius 0.32 ≈ 0.01 scene units)
export const FLUID_LANE_R = [0.08, 0.95]; // lane-centre radius range (tube-radius units)
export const FLUID_THREAD_SEED = 0x7d1f;

export function knotPoint(t, R = 1, r = 0.4) {
  const phi = t * Math.PI * 2;
  const p = 2, q = 3;
  const x = (R + r * Math.cos(q * phi)) * Math.cos(p * phi);
  const y = (R + r * Math.cos(q * phi)) * Math.sin(p * phi);
  const z = r * Math.sin(q * phi);
  return [x, y, z];
}

export function buildBuffers(count, nFog, seed = FLUID_THREAD_SEED) {
  const positions = new Float32Array(count * 3);
  const phases    = new Float32Array(count);
  const radii     = new Float32Array(count);
  const offsets   = new Float32Array(count);
  const lanes     = new Float32Array(count).fill(-1);
  const roles = gasRoles(count, nFog);
  let nFil = 0;
  for (let i = 0; i < count; i++) nFil += roles[i];

  const rng = mulberry32(seed);
  const laneR = new Float32Array(FLUID_LANES);
  for (let k = 0; k < FLUID_LANES; k++) laneR[k] = FLUID_LANE_R[0] + (FLUID_LANE_R[1] - FLUID_LANE_R[0]) * rng();
  const laneO0 = gasStratified(FLUID_LANES, rng); // stratified: irregular angles
  const th = gasThreads(nFil, FLUID_LANES, rng);
  const laneO = gasPaceMatch(laneO0, th.counts); // particle-weighted knot speed ≈ FLUID_LANE_MEAN (Task 7e)

  for (let i = 0, f = 0; i < count; i++) {
    let t;
    if (roles[i] < 0.5) {
      t = Math.random();
      radii[i]   = Math.random();
      offsets[i] = Math.random();
    } else {
      const k = th.lane[f];
      t = th.along[f];
      radii[i]   = Math.min(Math.max(laneR[k] + FLUID_SIGMA_R * th.cross[f], 0), 1);
      offsets[i] = laneO[k];
      lanes[i]   = k;
      f++;
    }
    const [x, y, z] = knotPoint(t);
    positions[i * 3]     = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    phases[i] = t;
  }
  return { positions, phases, radii, offsets, lanes, roles };
}

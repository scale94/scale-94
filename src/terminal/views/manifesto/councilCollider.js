// Pure collision math for the Council Ring vector collider. Zero React,
// zero runtime randomness. This module's API is the contract a future
// Rust/WASM kernel replaces — keep inputs/outputs plain arrays and objects.
import { DIM_NAMES } from '../../data/nodeFeatures';

export const DIMS = 16;
export const BLOCK = 96;
export const EXPANDED = DIMS * BLOCK; // 1536

// Seeded PRNG — codebase convention forbids Math.random() in collision paths.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic phase φ(d, k) — integer hash → [0, 2π). Same harmonic
// family and width for every dim block: the unbiased-partition invariant.
function phase(d, k) {
  let h = (d * 73856093) ^ (k * 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  h ^= h >>> 15;
  return ((h >>> 0) / 4294967296) * Math.PI * 2;
}

// 16-D → 1536-D: dim d owns block [d·96, d·96+96).
export function expand(vec16) {
  const out = new Float32Array(EXPANDED);
  for (let d = 0; d < DIMS; d++) {
    const v = vec16[d];
    for (let k = 0; k < BLOCK; k++) {
      out[d * BLOCK + k] = v * Math.sin((k + 1) * v * Math.PI + phase(d, k));
    }
  }
  return out;
}

// ── Partition (locked calibration) ──────────────────────────────────────────
export const SOCIAL_DIMS = ['synchrony', 'temporal', 'game_theory', 'information', 'cryptographic', 'economic'];
const SOCIAL_IDX = new Set(SOCIAL_DIMS.map(n => DIM_NAMES.indexOf(n)));
const N_SOCIAL = SOCIAL_DIMS.length;          // 6
const N_BIO = DIMS - N_SOCIAL;                // 10

// collide(A₁₅₃₆, B₁₅₃₆) — the WASM-replaceable contract.
// Returns { cosine, byDim, energies: {social, bio}, trajectory, dominantDim }.
export function collide(a, b) {
  let dot = 0, na = 0, nb = 0;
  const byDim = new Array(DIMS).fill(0);
  for (let d = 0; d < DIMS; d++) {
    let e = 0;
    for (let k = 0; k < BLOCK; k++) {
      const i = d * BLOCK + k;
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
      const r = a[i] - b[i]; // residual component
      e += r * r;
    }
    byDim[d] = e;
  }
  const cosine = dot / (Math.sqrt(na * nb) || 1);

  // Mean energy per dim, strictly — removes the 6/10 partition-size bias.
  let sumSocial = 0, sumBio = 0;
  let dominantDim = 0, dominantE = -1;
  for (let d = 0; d < DIMS; d++) {
    if (SOCIAL_IDX.has(d)) sumSocial += byDim[d]; else sumBio += byDim[d];
    if (byDim[d] > dominantE) { dominantE = byDim[d]; dominantDim = d; }
  }
  const social = sumSocial / N_SOCIAL;
  const bio = sumBio / N_BIO;

  return {
    cosine,
    byDim,
    energies: { social, bio },
    trajectory: social >= bio ? 'FOUNDATION' : 'CEILING',
    dominantDim,
  };
}

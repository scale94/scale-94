// particleSeeds.js — the chamber's only per-particle state.
//
// 4096 particles x 4 floats = 64KB, built once at mount and never touched
// again. Every trajectory is derived from these four numbers plus uPhaseT in
// the vertex shader, which is what makes the whole system snapshot-testable:
// no Math.random anywhere, so a given frame is a pure function of its inputs.

export const PARTICLE_COUNT = 4096;
export const SEED_STRIDE = 4; // lane, birthPhase, hash1, hash2

// A 32-bit integer avalanche (Murmur3 finaliser). Chosen over Math.random for
// determinism and over a plain LCG because consecutive indices must not
// correlate — adjacent particles sharing a birthPhase would render as a comb.
function hash01(n) {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function buildParticleSeeds(count = PARTICLE_COUNT) {
  if (!Number.isInteger(count) || count <= 0) {
    throw new RangeError(`buildParticleSeeds: count must be a positive integer, got ${count}`);
  }
  const out = new Float32Array(count * SEED_STRIDE);
  for (let i = 0; i < count; i++) {
    const o = i * SEED_STRIDE;
    // Keyed off i alone (not a running counter) so the sequence is
    // prefix-stable: buildParticleSeeds(64) starts with buildParticleSeeds(16).
    out[o + 0] = hash01(i * 4 + 1) * 2 - 1; // lane, transverse offset in the beam
    out[o + 1] = hash01(i * 4 + 2);         // birthPhase, staggers the stream
    out[o + 2] = hash01(i * 4 + 3);         // hash1, helix angle + ambient gating
    out[o + 3] = hash01(i * 4 + 4);         // hash2, stream side + post-impact role
  }
  return out;
}

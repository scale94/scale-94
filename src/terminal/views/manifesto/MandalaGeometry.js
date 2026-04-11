// MandalaGeometry.js — pure geometry functions for the manifesto lattice.
// No React, no SVG DOM. Everything here is unit-testable in isolation.

/**
 * The 16 sectors that get spokes on the mandala, in clockwise order
 * starting at 12 o'clock. This order is chosen so that the 6 manifesto
 * chapters map to contiguous arcs (see manifestoChapters.js).
 *
 * Note: the real nodeFeatures.js SECTORS has 17 entries — `fsk` is
 * excluded from the spokes but its nodes still render as ambient specks.
 */
export const MANDALA_SECTOR_ORDER = [
  'eco', 'bio', 'chem',          // §1 SUBSTRATE
  'sync', 'phys', 'math',        // §2 FEATURE_SPACE
  'topo', 'meta', 'synth',       // §3 BONE_FUSION
  'cogn', 'aesth',               // §4 SARG
  'phil', 'hum', 'ling',         // §5 FADE
  'crypto', 'drk',               // §8 ENCLAVE
];

export const SECTOR_COUNT = 16;

/**
 * Angle for a sector spoke, in radians. Measured clockwise from 12 o'clock.
 * Sector 0 = 0 rad (12 o'clock). Sector 4 = π/2 (3 o'clock). Etc.
 */
export function sectorAngle(sectorIndex) {
  if (sectorIndex < 0 || sectorIndex >= SECTOR_COUNT) {
    throw new Error(`sectorAngle: sectorIndex ${sectorIndex} out of range [0, ${SECTOR_COUNT})`);
  }
  return (sectorIndex / SECTOR_COUNT) * 2 * Math.PI;
}

/**
 * Index of a cluster id in the mandala sector order, or -1 if the
 * cluster is not on a spoke (e.g. fsk).
 */
export function clusterToSectorIndex(clusterId) {
  return MANDALA_SECTOR_ORDER.indexOf(clusterId);
}

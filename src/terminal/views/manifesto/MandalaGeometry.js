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

/**
 * Convert polar (θ clockwise from 12 o'clock, radius r) to SVG Cartesian.
 * SVG y grows downward, so 12 o'clock is (0, -r).
 */
export function polarToCartesian(angleRad, radius) {
  return {
    x: radius * Math.sin(angleRad),
    y: -radius * Math.cos(angleRad),
  };
}

/**
 * L2 magnitude of a node's 32D feature vector, normalized by sqrt(32)
 * so an all-ones vector gives magnitude 1. Used as the radial distance
 * for node placement — "louder" nodes land further from center.
 */
export function nodeMagnitude(featureVector) {
  let sumSq = 0;
  for (let i = 0; i < featureVector.length; i++) {
    sumSq += featureVector[i] * featureVector[i];
  }
  return Math.sqrt(sumSq) / Math.sqrt(featureVector.length);
}

/**
 * Deterministic hash of a node id to a float in [0, 1).
 * Uses djb2 like kernelColorMap.js so behavior is consistent across the site.
 */
export function hashNodeId(id) {
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h + id.charCodeAt(i)) >>> 0;
  }
  return (h >>> 0) / 0x100000000;
}

const JITTER_RAD = 0.03;

/**
 * Cartesian SVG position for a node.
 *
 * Angle = sectorAngle(cluster) + deterministic jitter ±0.03 rad.
 * Radius = (0.2 + 0.75 * nodeMagnitude(tensor)) * R.
 *
 * Nodes whose cluster is not on a mandala spoke (e.g. fsk) fall back
 * to sector 0 (eco) — this keeps fsk nodes visible as ambient specks
 * near the bouligand/arapaima neighborhood they conceptually share.
 *
 * @param {{id: string, cluster: string}} node
 * @param {number[]} tensor  32-element feature vector
 * @param {number} R         outer ring radius in px
 * @returns {{x: number, y: number}}
 */
export function nodePosition(node, tensor, R) {
  let sectorIdx = clusterToSectorIndex(node.cluster);
  if (sectorIdx < 0) sectorIdx = 0; // fsk fallback
  const baseAngle = sectorAngle(sectorIdx);
  const jitter = (hashNodeId(node.id) - 0.5) * 2 * JITTER_RAD;
  const angle = baseAngle + jitter;
  const mag = nodeMagnitude(tensor);
  const r = (0.2 + 0.75 * mag) * R;
  return polarToCartesian(angle, r);
}

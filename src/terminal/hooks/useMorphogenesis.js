// useMorphogenesis.js — Morphogenetic sphere topology with Voronoi tessellation
//
// The sphere surface is a living organism: cells grow, divide (mitosis), and
// die (apoptosis) based on Hopfield activation dynamics from useAssociativeField.
// Voronoi tessellation on the unit sphere defines cell boundaries; the mesh
// evolves as seeds are born and destroyed.
//
// Mathematical foundations:
//   Voronoi tessellation:  G. Voronoi, "Nouvelles applications des paramètres
//                          continus à la théorie des formes quadratiques" (1908)
//   Hopfield dynamics:     J.J. Hopfield, "Neural networks and physical systems
//                          with emergent collective computational abilities" (1982)
//   Morphogenesis:         A.M. Turing, "The chemical basis of morphogenesis" (1952)
//
// Performance: all mutable state lives in refs and typed arrays. No React state
// updates on the hot path. Voronoi grid is recomputed only when topology changes.

import { useRef, useCallback } from 'react';
import { NODES, FEATURES } from '../data/nodeFeatures';

// ── Constants ────────────────────────────────────────────────────────────────

const INITIAL_SEED_COUNT = NODES.length;         // 31 initial cells
const MAX_CELLS          = 64;                    // hard ceiling for Canvas2D perf
const MIN_CELLS          = 12;                    // floor — never apoptose below this
const FEATURE_DIM        = 16;                    // 16D feature space

// Mitosis thresholds
const MITOSIS_ACTIVATION_THRESHOLD = 0.85;        // activation must exceed this
const MITOSIS_SUSTAIN_FRAMES       = 60;          // for this many consecutive frames
const MITOSIS_FEATURE_MUTATION     = 0.05;        // ±5% mutation on each feature dim

// Apoptosis thresholds
const APOPTOSIS_ACTIVATION_THRESHOLD = 0.08;      // activation must drop below this
const APOPTOSIS_SUSTAIN_FRAMES       = 120;       // for this many consecutive frames

// Phase perturbation magnitudes
const CHAOS_PERTURBATION   = 0.03;                // random position jitter per frame
const PERIOD_8_AMPLITUDE   = 0.02;                // radial oscillation amplitude
const PERIOD_4_AMPLITUDE   = 0.015;               // moderate oscillation amplitude

// Voronoi grid resolution (lon × lat)
const GRID_LON = 64;
const GRID_LAT = 32;

// Health exponential moving average coefficient
const HEALTH_EMA_ALPHA = 0.02;

// ── Cluster anchor positions on unit sphere ──────────────────────────────────
// Used for STABLE-phase convergence drift. Each cluster maps to a region.
const CLUSTER_ANCHORS = {
  eco:    { theta: 0.4,  phi: 0.0   },   // upper front
  sync:   { theta: 0.8,  phi: 1.257 },   // equatorial right
  phys:   { theta: 0.6,  phi: 2.513 },   // equatorial back-right
  crypto: { theta: 1.2,  phi: 3.770 },   // lower back-left
  drk:    { theta: 1.8,  phi: 5.027 },   // lower front-left
};

// ── Spherical geometry utilities ─────────────────────────────────────────────

/** Convert (theta, phi) to Cartesian [x, y, z] on unit sphere. */
function sphericalToCartesian(theta, phi) {
  const sinT = Math.sin(theta);
  return [sinT * Math.cos(phi), sinT * Math.sin(phi), Math.cos(theta)];
}

/** Great-circle distance between two unit vectors (via dot product). */
function greatCircleDist(ax, ay, az, bx, by, bz) {
  // Clamp to avoid NaN from floating-point overshoot
  const dot = ax * bx + ay * by + az * bz;
  return Math.acos(Math.max(-1.0, Math.min(1.0, dot)));
}

/** Normalize a 3-vector in-place in a Float32Array at offset. */
function normalizeAt(arr, offset) {
  const x = arr[offset], y = arr[offset + 1], z = arr[offset + 2];
  const len = Math.sqrt(x * x + y * y + z * z);
  if (len < 1e-12) {
    // Degenerate — place at north pole
    arr[offset] = 0; arr[offset + 1] = 0; arr[offset + 2] = 1;
    return;
  }
  const inv = 1.0 / len;
  arr[offset] *= inv;
  arr[offset + 1] *= inv;
  arr[offset + 2] *= inv;
}

// ── Deterministic pseudo-random (xorshift32) ─────────────────────────────────
// Seeded PRNG for reproducible cell placement and mutation.

function xorshift32(state) {
  let s = state[0];
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  state[0] = s;
  return (s >>> 0) / 0xFFFFFFFF; // [0, 1)
}

// ── Initial seed placement ───────────────────────────────────────────────────
// Distribute 31 seeds on the unit sphere using the Fibonacci spiral, then
// assign each to its NODES entry. This ensures even angular spacing.

function computeInitialSeeds(positions) {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < INITIAL_SEED_COUNT; i++) {
    const y = 1 - (2 * i + 1) / (INITIAL_SEED_COUNT * 2); // [-1, 1]
    const radius = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;
    const off = i * 3;
    positions[off]     = radius * Math.cos(theta);
    positions[off + 1] = y;
    positions[off + 2] = radius * Math.sin(theta);
    normalizeAt(positions, off);
  }
}

// ── Voronoi tessellation on unit sphere via lon/lat grid ─────────────────────
//
// Strategy: sample a GRID_LON × GRID_LAT grid covering the sphere. For each
// grid cell, assign it to the nearest seed (by great-circle distance). Cell
// boundaries are where adjacent grid cells have different seed assignments.
// This avoids expensive exact Voronoi computation while producing clean mesh
// lines for Canvas2D rendering.

function buildVoronoiGrid(positions, cellCount, gridAssignment, cellAreas) {
  // Reset areas
  cellAreas.fill(0);

  // Precompute grid point positions (stored as flat xyz triples)
  // Grid point (i, j) → lon = 2π·i/GRID_LON, lat = π·(j+0.5)/GRID_LAT
  for (let j = 0; j < GRID_LAT; j++) {
    const lat = Math.PI * (j + 0.5) / GRID_LAT;       // [0, π] colatitude
    const sinLat = Math.sin(lat);
    const cosLat = Math.cos(lat);
    // Solid angle element for area computation (proportional)
    const dOmega = sinLat * (Math.PI / GRID_LAT) * (2 * Math.PI / GRID_LON);

    for (let i = 0; i < GRID_LON; i++) {
      const lon = 2 * Math.PI * i / GRID_LON;
      // Grid point on unit sphere
      const gx = sinLat * Math.cos(lon);
      const gy = sinLat * Math.sin(lon);
      const gz = cosLat;

      // Find nearest seed
      let bestDist = Infinity;
      let bestSeed = 0;
      for (let s = 0; s < cellCount; s++) {
        const off = s * 3;
        const d = greatCircleDist(
          gx, gy, gz,
          positions[off], positions[off + 1], positions[off + 2]
        );
        if (d < bestDist) {
          bestDist = d;
          bestSeed = s;
        }
      }

      const gridIdx = j * GRID_LON + i;
      gridAssignment[gridIdx] = bestSeed;
      cellAreas[bestSeed] += dOmega;
    }
  }
}

/** Extract boundary segments from the grid assignment map.
 *  Returns an array of { a:[x,y,z], b:[x,y,z], seedA, seedB }. */
function extractBoundarySegments(gridAssignment, cellCount) {
  const segments = [];

  for (let j = 0; j < GRID_LAT; j++) {
    const lat = Math.PI * (j + 0.5) / GRID_LAT;
    const sinLat = Math.sin(lat);
    const cosLat = Math.cos(lat);

    for (let i = 0; i < GRID_LON; i++) {
      const idx = j * GRID_LON + i;
      const seedHere = gridAssignment[idx];

      // Check right neighbor (wrap longitude)
      const iRight = (i + 1) % GRID_LON;
      const idxRight = j * GRID_LON + iRight;
      if (gridAssignment[idxRight] !== seedHere) {
        const lon0 = 2 * Math.PI * i / GRID_LON;
        const lon1 = 2 * Math.PI * iRight / GRID_LON;
        const lonMid = (lon0 + lon1) / 2;
        segments.push({
          a: [sinLat * Math.cos(lon0), sinLat * Math.sin(lon0), cosLat],
          b: [sinLat * Math.cos(lon1), sinLat * Math.sin(lon1), cosLat],
          seedA: seedHere,
          seedB: gridAssignment[idxRight],
        });
      }

      // Check bottom neighbor (skip last row)
      if (j < GRID_LAT - 1) {
        const idxBelow = (j + 1) * GRID_LON + i;
        if (gridAssignment[idxBelow] !== seedHere) {
          const lon = 2 * Math.PI * i / GRID_LON;
          const lat0 = lat;
          const lat1 = Math.PI * (j + 1.5) / GRID_LAT;
          const sinLat1 = Math.sin(lat1);
          const cosLat1 = Math.cos(lat1);
          segments.push({
            a: [sinLat * Math.cos(lon), sinLat * Math.sin(lon), cosLat],
            b: [sinLat1 * Math.cos(lon), sinLat1 * Math.sin(lon), cosLat1],
            seedA: seedHere,
            seedB: gridAssignment[idxBelow],
          });
        }
      }
    }
  }

  return segments;
}

/** Build neighbor lists from grid assignment. Two cells are neighbors if they
 *  share at least one grid boundary. */
function buildNeighborLists(gridAssignment, cellCount) {
  // Use a set per cell to collect unique neighbors
  const neighborSets = new Array(cellCount);
  for (let s = 0; s < cellCount; s++) neighborSets[s] = new Set();

  for (let j = 0; j < GRID_LAT; j++) {
    for (let i = 0; i < GRID_LON; i++) {
      const idx = j * GRID_LON + i;
      const seed = gridAssignment[idx];

      // Right neighbor
      const iR = (i + 1) % GRID_LON;
      const seedR = gridAssignment[j * GRID_LON + iR];
      if (seedR !== seed) {
        neighborSets[seed].add(seedR);
        neighborSets[seedR].add(seed);
      }

      // Bottom neighbor
      if (j < GRID_LAT - 1) {
        const seedB = gridAssignment[(j + 1) * GRID_LON + i];
        if (seedB !== seed) {
          neighborSets[seed].add(seedB);
          neighborSets[seedB].add(seed);
        }
      }
    }
  }

  return neighborSets.map(s => Array.from(s));
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useMorphogenesis({ fieldRef, phaseRegime }) {
  const morphRef   = useRef(null);
  const onDivision  = useRef(null);  // callback(parentId, child1Id, child2Id)
  const onApoptosis = useRef(null);  // callback(deadId, absorberId)

  // ── Initialize morphogenetic state ───────────────────────────────────────

  if (morphRef.current === null) {
    // Seed positions: 3 floats per seed, up to MAX_CELLS
    const positions = new Float32Array(MAX_CELLS * 3);
    computeInitialSeeds(positions);

    // Cell health: exponential moving average of activation
    const health = new Float32Array(MAX_CELLS);
    health.fill(0.5); // start at mid-health

    // Frame counters for sustained activation tracking
    // Positive = frames above mitosis threshold, negative = frames below apoptosis threshold
    const sustainCounters = new Int32Array(MAX_CELLS);

    // Feature vectors for each cell (16D)
    const features = new Float32Array(MAX_CELLS * FEATURE_DIM);
    for (let i = 0; i < INITIAL_SEED_COUNT; i++) {
      for (let d = 0; d < FEATURE_DIM; d++) {
        features[i * FEATURE_DIM + d] = FEATURES[i][d];
      }
    }

    // Cell alive flags
    const alive = new Uint8Array(MAX_CELLS);
    for (let i = 0; i < INITIAL_SEED_COUNT; i++) alive[i] = 1;

    // Monotonically increasing cell IDs
    const cellIds = new Int32Array(MAX_CELLS);
    for (let i = 0; i < INITIAL_SEED_COUNT; i++) cellIds[i] = i;

    // Map from original NODES index to current cell slot (for reading activations)
    const nodeToSlot = new Int32Array(INITIAL_SEED_COUNT);
    for (let i = 0; i < INITIAL_SEED_COUNT; i++) nodeToSlot[i] = i;

    // Cluster assignments (inherited from NODES, propagated to daughter cells)
    const clusters = new Array(MAX_CELLS).fill('eco');
    for (let i = 0; i < INITIAL_SEED_COUNT; i++) {
      clusters[i] = NODES[i].cluster;
    }

    // Voronoi grid assignment buffer
    const gridAssignment = new Int32Array(GRID_LON * GRID_LAT);
    const cellAreas = new Float32Array(MAX_CELLS);

    // PRNG state (seeded deterministically)
    const rng = new Int32Array(1);
    rng[0] = 0x5EED_B10B; // seed value

    // Division history log
    const divisionHistory = [];

    morphRef.current = {
      positions,
      health,
      sustainCounters,
      features,
      alive,
      cellIds,
      nodeToSlot,
      clusters,
      gridAssignment,
      cellAreas,
      rng,
      divisionHistory,
      cellCount: INITIAL_SEED_COUNT,
      nextCellId: INITIAL_SEED_COUNT,
      frameCount: 0,
      topologyDirty: true,    // flag: need Voronoi recompute
      cachedSegments: null,   // cached boundary segments
      cachedNeighbors: null,  // cached neighbor lists
    };

    // Initial Voronoi computation
    buildVoronoiGrid(positions, INITIAL_SEED_COUNT, gridAssignment, cellAreas);
    morphRef.current.cachedSegments = extractBoundarySegments(gridAssignment, INITIAL_SEED_COUNT);
    morphRef.current.cachedNeighbors = buildNeighborLists(gridAssignment, INITIAL_SEED_COUNT);
    morphRef.current.topologyDirty = false;
  }

  // ── Step: advance morphogenesis by one frame ─────────────────────────────

  const stepMorphogenesis = useCallback(() => {
    const m = morphRef.current;
    const f = fieldRef?.current;
    if (!m || !f) return;

    m.frameCount++;

    const { positions, health, sustainCounters, features, alive, cellIds,
            clusters, rng, cellAreas } = m;
    const activations = f.activations;

    // ── 1. Read activations and update health / sustain counters ──────────
    // For the original 31 nodes, read directly from fieldRef.activations.
    // For daughter cells (slot >= INITIAL_SEED_COUNT), approximate activation
    // from the nearest original node weighted by feature similarity.

    for (let s = 0; s < m.cellCount; s++) {
      if (!alive[s]) continue;

      let activation;
      if (s < INITIAL_SEED_COUNT) {
        // Direct read from Hopfield field
        activation = activations[s];
      } else {
        // Daughter cell: compute weighted activation from nearest original nodes.
        // Use feature cosine similarity as weights.
        let weightSum = 0;
        let actSum = 0;
        const fOff = s * FEATURE_DIM;
        for (let n = 0; n < INITIAL_SEED_COUNT; n++) {
          // Quick dot product (unnormalized — sufficient for weighting)
          let dot = 0;
          const nOff = n * FEATURE_DIM;
          for (let d = 0; d < FEATURE_DIM; d++) {
            dot += features[fOff + d] * features[nOff + d];
          }
          if (dot > 0.1) {
            const w = dot * dot; // squared for sharper weighting
            actSum += w * activations[n];
            weightSum += w;
          }
        }
        activation = weightSum > 1e-8 ? actSum / weightSum : 0.5;
      }

      // Exponential moving average for health
      health[s] += HEALTH_EMA_ALPHA * (activation - health[s]);

      // Update sustain counters
      if (activation > MITOSIS_ACTIVATION_THRESHOLD) {
        // Accumulate toward mitosis (positive direction)
        sustainCounters[s] = Math.max(0, sustainCounters[s]) + 1;
      } else if (activation < APOPTOSIS_ACTIVATION_THRESHOLD) {
        // Accumulate toward apoptosis (negative direction)
        sustainCounters[s] = Math.min(0, sustainCounters[s]) - 1;
      } else {
        // In the neutral band — decay counter toward zero
        if (sustainCounters[s] > 0) sustainCounters[s] = Math.max(0, sustainCounters[s] - 2);
        else if (sustainCounters[s] < 0) sustainCounters[s] = Math.min(0, sustainCounters[s] + 2);
      }
    }

    // ── 2. Mitosis: check for cells ready to divide ──────────────────────

    for (let s = 0; s < m.cellCount; s++) {
      if (!alive[s]) continue;
      if (m.cellCount >= MAX_CELLS) break; // cap reached

      if (sustainCounters[s] >= MITOSIS_SUSTAIN_FRAMES) {
        // This cell divides.
        sustainCounters[s] = 0;

        const parentId = cellIds[s];
        const parentOff = s * 3;

        // Division plane: perpendicular to the Hopfield field gradient at this node.
        // Approximate gradient by comparing activation to neighbors' activations.
        // Use a random perpendicular direction if no clear gradient exists.
        let gx = 0, gy = 0, gz = 0;
        const neighbors = m.cachedNeighbors ? m.cachedNeighbors[s] : [];
        const parentAct = (s < INITIAL_SEED_COUNT) ? activations[s] : health[s];

        for (const nb of neighbors) {
          if (!alive[nb]) continue;
          const nbAct = (nb < INITIAL_SEED_COUNT) ? activations[nb] : health[nb];
          const nbOff = nb * 3;
          const dx = positions[nbOff] - positions[parentOff];
          const dy = positions[nbOff + 1] - positions[parentOff + 1];
          const dz = positions[nbOff + 2] - positions[parentOff + 2];
          const actDiff = nbAct - parentAct;
          gx += actDiff * dx;
          gy += actDiff * dy;
          gz += actDiff * dz;
        }

        const gradLen = Math.sqrt(gx * gx + gy * gy + gz * gz);
        let perpX, perpY, perpZ;

        if (gradLen > 1e-6) {
          // Normalize gradient
          gx /= gradLen; gy /= gradLen; gz /= gradLen;
          // Perpendicular to gradient on sphere surface:
          // Cross product with parent position gives tangent perpendicular to gradient
          perpX = gy * positions[parentOff + 2] - gz * positions[parentOff + 1];
          perpY = gz * positions[parentOff]     - gx * positions[parentOff + 2];
          perpZ = gx * positions[parentOff + 1] - gy * positions[parentOff];
        } else {
          // No clear gradient — use a pseudo-random tangent direction
          const r1 = xorshift32(rng);
          const r2 = xorshift32(rng);
          // Random vector, then project onto tangent plane
          perpX = r1 - 0.5;
          perpY = r2 - 0.5;
          perpZ = xorshift32(rng) - 0.5;
          // Remove radial component
          const px = positions[parentOff], py = positions[parentOff + 1], pz = positions[parentOff + 2];
          const dot = perpX * px + perpY * py + perpZ * pz;
          perpX -= dot * px;
          perpY -= dot * py;
          perpZ -= dot * pz;
        }

        const perpLen = Math.sqrt(perpX * perpX + perpY * perpY + perpZ * perpZ);
        if (perpLen < 1e-8) continue; // degenerate — skip this division
        perpX /= perpLen; perpY /= perpLen; perpZ /= perpLen;

        // Offset distance: proportional to cell "radius" (sqrt of area / π)
        const cellRadius = Math.sqrt(Math.max(0.01, cellAreas[s]) / Math.PI);
        const offset = cellRadius * 0.35; // daughters placed at ±35% of cell radius

        // Find a free slot for the second daughter (first daughter reuses parent slot)
        let freeSlot = -1;
        for (let k = 0; k < MAX_CELLS; k++) {
          if (!alive[k] && k >= m.cellCount) { freeSlot = k; break; }
          if (!alive[k]) { freeSlot = k; break; }
        }
        if (freeSlot === -1) continue; // no room

        // Place daughter 1 (reuse parent slot s)
        positions[parentOff]     += perpX * offset;
        positions[parentOff + 1] += perpY * offset;
        positions[parentOff + 2] += perpZ * offset;
        normalizeAt(positions, parentOff);

        // Place daughter 2 (new slot)
        const d2Off = freeSlot * 3;
        positions[d2Off]     = positions[parentOff] - 2 * perpX * offset;
        positions[d2Off + 1] = positions[parentOff + 1] - 2 * perpY * offset;
        positions[d2Off + 2] = positions[parentOff + 2] - 2 * perpZ * offset;
        // Re-derive from parent's original position for accuracy
        positions[d2Off]     = m.positions[parentOff] - perpX * offset;
        positions[d2Off + 1] = m.positions[parentOff + 1] - perpY * offset;
        positions[d2Off + 2] = m.positions[parentOff + 2] - perpZ * offset;
        normalizeAt(positions, d2Off);

        // Mutate features for both daughters (±5% per dimension)
        const parentFeatOff = s * FEATURE_DIM;
        const d2FeatOff = freeSlot * FEATURE_DIM;
        for (let d = 0; d < FEATURE_DIM; d++) {
          const base = features[parentFeatOff + d];
          const m1 = (xorshift32(rng) - 0.5) * 2 * MITOSIS_FEATURE_MUTATION;
          const m2 = (xorshift32(rng) - 0.5) * 2 * MITOSIS_FEATURE_MUTATION;
          features[parentFeatOff + d] = Math.max(0, Math.min(1, base + m1));
          features[d2FeatOff + d]     = Math.max(0, Math.min(1, base + m2));
        }

        // Set daughter 2 metadata
        alive[freeSlot] = 1;
        cellIds[freeSlot] = m.nextCellId++;
        const child2Id = cellIds[freeSlot];
        health[freeSlot] = health[s] * 0.8; // slight health penalty
        health[s] *= 0.8;
        sustainCounters[freeSlot] = 0;
        clusters[freeSlot] = clusters[s]; // inherit cluster

        // Update cell count
        if (freeSlot >= m.cellCount) m.cellCount = freeSlot + 1;

        // Log division event
        const divEvent = {
          frame: m.frameCount,
          parentId,
          childIds: [cellIds[s], child2Id],
          position: [positions[parentOff], positions[parentOff + 1], positions[parentOff + 2]],
        };
        m.divisionHistory.push(divEvent);
        if (m.divisionHistory.length > 512) {
          m.divisionHistory.splice(0, m.divisionHistory.length - 512);
        }

        m.topologyDirty = true;

        // Fire callback
        if (typeof onDivision.current === 'function') {
          onDivision.current(parentId, cellIds[s], child2Id);
        }
      }
    }

    // ── 3. Apoptosis: check for cells ready to die ───────────────────────

    for (let s = 0; s < m.cellCount; s++) {
      if (!alive[s]) continue;

      // Count live cells to enforce minimum
      let liveCount = 0;
      for (let k = 0; k < m.cellCount; k++) if (alive[k]) liveCount++;
      if (liveCount <= MIN_CELLS) break; // protect minimum

      if (sustainCounters[s] <= -APOPTOSIS_SUSTAIN_FRAMES) {
        // This cell dies. Find the neighbor that will absorb it.
        const neighbors = m.cachedNeighbors ? m.cachedNeighbors[s] : [];
        let absorberId = -1;
        let bestHealth = -1;
        for (const nb of neighbors) {
          if (alive[nb] && health[nb] > bestHealth) {
            bestHealth = health[nb];
            absorberId = nb;
          }
        }

        const deadId = cellIds[s];
        alive[s] = 0;
        sustainCounters[s] = 0;
        health[s] = 0;
        m.topologyDirty = true;

        // Fire callback
        if (typeof onApoptosis.current === 'function') {
          onApoptosis.current(deadId, absorberId >= 0 ? cellIds[absorberId] : -1);
        }
      }
    }

    // ── 4. Phase-dependent seed perturbation ─────────────────────────────

    const phase = phaseRegime || 'STABLE';

    if (phase === 'CHAOS') {
      // Chaotic cracking: random perturbation to all seed positions
      for (let s = 0; s < m.cellCount; s++) {
        if (!alive[s]) continue;
        const off = s * 3;
        positions[off]     += (xorshift32(rng) - 0.5) * 2 * CHAOS_PERTURBATION;
        positions[off + 1] += (xorshift32(rng) - 0.5) * 2 * CHAOS_PERTURBATION;
        positions[off + 2] += (xorshift32(rng) - 0.5) * 2 * CHAOS_PERTURBATION;
        normalizeAt(positions, off);
      }
      m.topologyDirty = true;

    } else if (phase === 'PERIOD_8') {
      // Pulsing: radial oscillation at 8× base frequency
      const osc = Math.sin(m.frameCount * 8 * 0.05) * PERIOD_8_AMPLITUDE;
      for (let s = 0; s < m.cellCount; s++) {
        if (!alive[s]) continue;
        const off = s * 3;
        // Scale outward/inward along radial direction (the position IS the radial dir on unit sphere)
        const scale = 1.0 + osc;
        positions[off] *= scale;
        positions[off + 1] *= scale;
        positions[off + 2] *= scale;
        normalizeAt(positions, off);
      }
      // Only mark dirty every 4 frames to reduce Voronoi recomputation
      if (m.frameCount % 4 === 0) m.topologyDirty = true;

    } else if (phase === 'PERIOD_4') {
      // Moderate oscillation at 4× base frequency
      const osc = Math.sin(m.frameCount * 4 * 0.05) * PERIOD_4_AMPLITUDE;
      for (let s = 0; s < m.cellCount; s++) {
        if (!alive[s]) continue;
        const off = s * 3;
        const scale = 1.0 + osc;
        positions[off] *= scale;
        positions[off + 1] *= scale;
        positions[off + 2] *= scale;
        normalizeAt(positions, off);
      }
      if (m.frameCount % 8 === 0) m.topologyDirty = true;

    } else if (phase === 'STABLE') {
      // Convergence: seeds drift slowly toward cluster anchors
      const drift = 0.001; // very slow convergence rate
      for (let s = 0; s < m.cellCount; s++) {
        if (!alive[s]) continue;
        const anchor = CLUSTER_ANCHORS[clusters[s]];
        if (!anchor) continue;
        const [ax, ay, az] = sphericalToCartesian(anchor.theta, anchor.phi);
        const off = s * 3;
        positions[off]     += drift * (ax - positions[off]);
        positions[off + 1] += drift * (ay - positions[off + 1]);
        positions[off + 2] += drift * (az - positions[off + 2]);
        normalizeAt(positions, off);
      }
      // Stable phase drifts very slowly — recompute Voronoi infrequently
      if (m.frameCount % 16 === 0) m.topologyDirty = true;
    }

    // ── 5. Recompute Voronoi if topology changed ─────────────────────────

    if (m.topologyDirty) {
      // Count actual live cells and build compacted index
      let liveCount = 0;
      for (let s = 0; s < m.cellCount; s++) {
        if (alive[s]) liveCount++;
      }

      buildVoronoiGrid(positions, m.cellCount, m.gridAssignment, m.cellAreas);
      m.cachedSegments = extractBoundarySegments(m.gridAssignment, m.cellCount);
      m.cachedNeighbors = buildNeighborLists(m.gridAssignment, m.cellCount);
      m.topologyDirty = false;
    }

  }, [fieldRef, phaseRegime]);

  // ── getCells: return cell data for rendering ─────────────────────────────

  const getCells = useCallback(() => {
    const m = morphRef.current;
    if (!m) return [];

    const { positions, alive, cellIds, health, clusters, features,
            cellAreas, cachedNeighbors } = m;
    const cells = [];

    for (let s = 0; s < m.cellCount; s++) {
      if (!alive[s]) continue;
      const off = s * 3;
      const fOff = s * FEATURE_DIM;

      cells.push({
        id: cellIds[s],
        slot: s,
        center: [positions[off], positions[off + 1], positions[off + 2]],
        area: cellAreas[s],
        health: health[s],
        cluster: clusters[s],
        neighbors: cachedNeighbors ? cachedNeighbors[s].filter(nb => alive[nb]) : [],
        features: features.subarray(fOff, fOff + FEATURE_DIM),
      });
    }

    return cells;
  }, []);

  // ── getMesh: return boundary line segments for rendering ──────────────────

  const getMesh = useCallback(() => {
    const m = morphRef.current;
    if (!m || !m.cachedSegments) return [];

    const { health, alive } = m;

    return m.cachedSegments
      .filter(seg => alive[seg.seedA] && alive[seg.seedB])
      .map(seg => {
        // Opacity based on average health of the two bordering cells
        const avgHealth = (health[seg.seedA] + health[seg.seedB]) / 2;
        // Dying cells → fading boundaries; thriving cells → sharp boundaries
        const opacity = 0.15 + 0.85 * Math.max(0, Math.min(1, avgHealth));
        return {
          a: seg.a,
          b: seg.b,
          opacity,
        };
      });
  }, []);

  // ── cellCount accessor ───────────────────────────────────────────────────

  const cellCount = useCallback(() => {
    const m = morphRef.current;
    if (!m) return 0;
    let count = 0;
    for (let s = 0; s < m.cellCount; s++) {
      if (m.alive[s]) count++;
    }
    return count;
  }, []);

  // ── getDivisionHistory accessor ──────────────────────────────────────────

  const getDivisionHistory = useCallback(() => {
    const m = morphRef.current;
    return m ? m.divisionHistory.slice() : [];
  }, []);

  // ── Public interface ─────────────────────────────────────────────────────

  return {
    morphRef,
    stepMorphogenesis,
    getCells,
    getMesh,
    cellCount,
    onDivision,
    onApoptosis,
    getDivisionHistory,
  };
}

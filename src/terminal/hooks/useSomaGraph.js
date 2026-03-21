// useSomaGraph.js — 3D sphere-constrained node physics for the fade_doctrine graph.
//
// All nodes live on the surface of a unit sphere (R = 1.0).
// Coordinate system: X right, Y up, Z toward viewer.
// Camera sits at +∞ on Z axis.
//
// Physics:
//   - Cluster gravity: tangential pull toward cluster anchor on sphere
//   - Node–node repulsion: Coulomb 1/r² in 3D
//   - Edge springs: Hooke with natural length ~0.65 arc units
//   - Sphere surface constraint: normalize position back to unit sphere after
//     each step, remove radial velocity component (tangential motion only)

import { useRef, useCallback } from 'react';

const DT   = 0.45;
const DRAG = 0.86;

// Cluster anchor positions on the unit sphere.
// Spread across front hemisphere; DRK anchored to the back pole.
// Pre-normalized unit vectors.
export const CLUSTER_ANCHORS = {
  eco:    { x: -0.609, y:  0.508, z:  0.609 },  // upper-left  front
  sync:   { x:  0.609, y:  0.508, z:  0.609 },  // upper-right front
  phys:   { x: -0.609, y: -0.508, z:  0.609 },  // lower-left  front
  crypto: { x:  0.609, y: -0.508, z:  0.609 },  // lower-right front
  drk:    { x:  0.000, y:  0.000, z: -1.000 },  // back pole
};

// Normalize a 3-vector to unit length
function norm3(x, y, z) {
  const len = Math.sqrt(x * x + y * y + z * z) || 1e-9;
  return [x / len, y / len, z / len];
}

// Remove the radial (outward) component of a velocity vector
function tangentialOnly(vx, vy, vz, nx, ny, nz) {
  const dot = vx * nx + vy * ny + vz * nz;
  return [vx - dot * nx, vy - dot * ny, vz - dot * nz];
}

/**
 * useSomaGraph({ nodes, adj })
 *
 * nodes — array of { id, cluster, ... }
 * adj   — { nodeId: [neighborId, ...] }
 *
 * Returns:
 *   stateRef        — { nodes: SimNode3D[], frame }
 *   initState       — () → void
 *   step            — () → void  (called each RAF frame)
 *   fireNode        — (id) → void
 *   applyAttractor  — (data) → void
 *   triggerOverwrite— (sourceId, targetId) → void
 */
export function useSomaGraph({ nodes, adj }) {
  const stateRef = useRef(null);

  const initState = useCallback(() => {
    const simNodes = nodes.map(n => {
      const a = CLUSTER_ANCHORS[n.cluster] ?? CLUSTER_ANCHORS.drk;

      // Scatter node near its cluster anchor on the sphere surface
      // by applying a small random tangential offset then re-normalizing
      const tx = (Math.random() - 0.5);
      const ty = (Math.random() - 0.5);
      const tz = (Math.random() - 0.5);
      // Remove radial component of the perturbation
      const dot = tx * a.x + ty * a.y + tz * a.z;
      const px  = tx - dot * a.x;
      const py  = ty - dot * a.y;
      const pz  = tz - dot * a.z;
      const pLen = Math.sqrt(px * px + py * py + pz * pz) || 1;
      const sc   = 0.40;
      const [nx, ny, nz] = norm3(
        a.x + (px / pLen) * sc,
        a.y + (py / pLen) * sc,
        a.z + (pz / pLen) * sc,
      );

      return {
        ...n,
        x: nx, y: ny, z: nz,   // unit sphere position
        vx: 0, vy: 0, vz: 0,
        energy: Math.random() * 0.25,
        bleedFrom:   null,
        bleedAmount: 0,
      };
    });
    stateRef.current = { nodes: simNodes, frame: 0 };
  }, [nodes]);

  const step = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    const { nodes: sn } = s;
    s.frame++;

    for (let i = 0; i < sn.length; i++) {
      const n = sn[i];
      let fx = 0, fy = 0, fz = 0;

      const a = CLUSTER_ANCHORS[n.cluster] ?? CLUSTER_ANCHORS.drk;

      // Cluster gravity — tangential pull toward cluster anchor (arc-aware)
      // Strength scaled by angular distance: farther away = stronger pull
      const cdot   = n.x * a.x + n.y * a.y + n.z * a.z;
      const gravK  = 0.018 * (1.0 - cdot);  // zero when aligned, max when opposite
      fx += (a.x - n.x * cdot) * gravK;
      fy += (a.y - n.y * cdot) * gravK;
      fz += (a.z - n.z * cdot) * gravK;

      // Node–node repulsion (3D Coulomb)
      for (let j = 0; j < sn.length; j++) {
        if (i === j) continue;
        const m  = sn[j];
        const dx = n.x - m.x, dy = n.y - m.y, dz = n.z - m.z;
        const d2 = Math.max(dx * dx + dy * dy + dz * dz, 0.001);
        const f  = 0.022 / d2;
        fx += dx * f;
        fy += dy * f;
        fz += dz * f;
      }

      // Edge springs — natural length ≈ 0.65 in chord distance
      const NATURAL = 0.65;
      const neighbours = adj[n.id] ?? [];
      for (const adjId of neighbours) {
        const m = sn.find(x => x.id === adjId);
        if (!m) continue;
        const dx  = m.x - n.x, dy = m.y - n.y, dz = m.z - n.z;
        const d   = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
        const str = (d - NATURAL) * 0.030;
        fx += (dx / d) * str;
        fy += (dy / d) * str;
        fz += (dz / d) * str;
      }

      // Integrate
      n.vx = (n.vx + fx * DT) * DRAG;
      n.vy = (n.vy + fy * DT) * DRAG;
      n.vz = (n.vz + fz * DT) * DRAG;
      n.x += n.vx;
      n.y += n.vy;
      n.z += n.vz;

      // ── Sphere constraint ─────────────────────────────────────────────────
      // Project position back onto unit sphere
      const [nx, ny, nz] = norm3(n.x, n.y, n.z);
      n.x = nx; n.y = ny; n.z = nz;
      // Remove radial velocity component (keep only tangential)
      const [tvx, tvy, tvz] = tangentialOnly(n.vx, n.vy, n.vz, nx, ny, nz);
      n.vx = tvx; n.vy = tvy; n.vz = tvz;

      // Energy decay + ambient flicker
      n.energy = Math.max(0, n.energy - 0.0035);
      if (Math.random() < 0.0025) n.energy = Math.min(1, n.energy + 0.28);

      // Overwrite bleed decay
      if (n.bleedAmount > 0) {
        n.bleedAmount = Math.max(0, n.bleedAmount - 0.012);
        if (n.bleedAmount <= 0) n.bleedFrom = null;
      }
    }
  }, [nodes, adj]);

  const fireNode = useCallback((id) => {
    const s = stateRef.current;
    if (!s) return;
    const n = s.nodes.find(x => x.id === id);
    if (!n) return;
    n.energy = 1;
    const neighbours = adj[id] ?? [];
    for (const adjId of neighbours) {
      const m = s.nodes.find(x => x.id === adjId);
      if (m) m.energy = Math.min(1, m.energy + 0.6);
    }
  }, [adj]);

  const applyAttractor = useCallback((data) => {
    const s = stateRef.current;
    if (!s || !data?.act) return;
    s.nodes.forEach((n, i) => {
      const act    = data.act[i] ?? 0;
      const target = Math.max(0, act);
      n.energy = Math.min(1, n.energy + (target - n.energy) * 0.04);
    });
  }, []);

  const triggerOverwrite = useCallback((sourceId, targetId) => {
    const s = stateRef.current;
    if (!s) return;
    const target = s.nodes.find(n => n.id === targetId);
    if (target) {
      target.bleedFrom   = sourceId;
      target.bleedAmount = 1.0;
    }
  }, []);

  // ── Period-Doubling: Bifurcation trigger ──────────────────────────────────
  // Targets top 15% most-connected nodes and "splits" each into a child node.
  // Child inherits parent cluster (for gravity) and starts with energy = 1.0
  // (birth flash). The bleedFrom/bleedAmount fields create a visual overwrite
  // pulse radiating parent color through the newborn node for ~80 frames.
  //
  // degreeMap: { [nodeId]: connectionCount } — computed in ArtTab from activeEdges
  //
  // Returns: [{ childId, parentId, px, py, pz }] — caller tracks birth animation
  const triggerBifurcation = useCallback((degreeMap) => {
    const s = stateRef.current;
    if (!s) return [];
    const { nodes: sn } = s;

    // Find the maximum degree across all current sim nodes
    let maxDeg = 0;
    for (const n of sn) {
      const d = degreeMap[n.id] ?? 0;
      if (d > maxDeg) maxDeg = d;
    }
    if (maxDeg === 0) return [];

    const threshold = maxDeg * 0.85;   // top 15% cutoff
    const spawned   = [];
    const origLen   = sn.length;       // snapshot — don't iterate newly added nodes

    for (let i = 0; i < origLen; i++) {
      const n = sn[i];
      if ((degreeMap[n.id] ?? 0) < threshold) continue;

      // ±2.5% stochastic position jitter — simulates tensor drift at bifurcation
      const jitter = () => (Math.random() - 0.5) * 0.05;
      const [cx, cy, cz] = norm3(n.x + jitter(), n.y + jitter(), n.z + jitter());

      // Unique child ID: parent ID + 4-char random suffix
      const childId = `${n.id}_b${Math.random().toString(36).slice(2, 6)}`;

      sn.push({
        id:          childId,
        cluster:     n.cluster,        // inherit cluster → same gravity anchor
        x: cx, y: cy, z: cz,
        vx: 0,  vy: 0,  vz: 0,
        energy:      1.0,              // full birth energy → bright flash
        bleedFrom:   n.id,             // parent color bleeds through on birth
        bleedAmount: 0.9,
      });

      spawned.push({ childId, parentId: n.id, px: n.x, py: n.y, pz: n.z });
    }

    return spawned;
  }, []);

  return { stateRef, initState, step, fireNode, applyAttractor, triggerOverwrite, triggerBifurcation };
}

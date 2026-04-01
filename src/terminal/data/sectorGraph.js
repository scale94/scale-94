// sectorGraph.js — 4D hypercube routing for the 256-cluster Olfactory architecture
// 16 sectors mapped onto a 4-dimensional hypercube (Q₄).
// Each sector connects to exactly 4 neighbors; max diameter = 4 hops.

import { NODES } from './nodeFeatures';

// ── Sector adjacency (Q₄ hypercube) ────────────────────────────────────────
// Each sector id maps to its 4 hypercube-adjacent neighbor sector ids.
// Completed to 4-regular from the architecture matrix by adding edges:
// syn-cogn, phy-chem, cry-meta, drk-hum, phi-aesth, mat-bio, lin-topo.
export const SECTOR_ADJACENCY = new Map([
  ['eco',    ['sync',   'phys',  'crypto', 'drk'   ]],
  ['sync',   ['eco',    'phys',  'phil',   'cogn'  ]],
  ['phys',   ['eco',    'sync',  'math',   'chem'  ]],
  ['crypto', ['eco',    'drk',   'chem',   'meta'  ]],
  ['drk',    ['eco',    'crypto','bio',    'hum'   ]],
  ['phil',   ['sync',   'math',  'hum',    'aesth' ]],
  ['math',   ['phys',   'phil',  'topo',   'bio'   ]],
  ['chem',   ['phys',   'crypto','bio',    'aesth' ]],
  ['bio',    ['drk',    'chem',  'cogn',   'math'  ]],
  ['hum',    ['drk',    'phil',  'ling',   'synth' ]],
  ['ling',   ['hum',    'aesth', 'synth',  'topo'  ]],
  ['cogn',   ['sync',   'bio',   'aesth',  'meta'  ]],
  ['aesth',  ['chem',   'ling',  'cogn',   'phil'  ]],
  ['topo',   ['math',   'meta',  'synth',  'ling'  ]],
  ['meta',   ['crypto', 'cogn',  'topo',   'synth' ]],
  ['synth',  ['hum',    'ling',  'topo',   'meta'  ]],
]);

// ── Sector colors ───────────────────────────────────────────────────────────
export const SECTOR_COLORS = new Map([
  ['eco',    '#22c55e'],
  ['sync',   '#3b82f6'],
  ['phys',   '#f59e0b'],
  ['crypto', '#ef4444'],
  ['drk',    '#6b7280'],
  ['phil',   '#8b5cf6'],
  ['math',   '#06b6d4'],
  ['chem',   '#f97316'],
  ['bio',    '#10b981'],
  ['hum',    '#ec4899'],
  ['ling',   '#14b8a6'],
  ['cogn',   '#a855f7'],
  ['aesth',  '#e879f9'],
  ['topo',   '#0ea5e9'],
  ['meta',   '#fbbf24'],
  ['synth',  '#f43f5e'],
]);

// ── sectorNodes(sectorId) ───────────────────────────────────────────────────
export function sectorNodes(sectorId) {
  return NODES.filter(n => n.cluster === sectorId);
}

// ── sectorOf(nodeId) ────────────────────────────────────────────────────────
export function sectorOf(nodeId) {
  const node = NODES.find(n => n.id === nodeId);
  return node ? node.cluster : undefined;
}

// ── routeSector(from, to) ───────────────────────────────────────────────────
// BFS shortest path through the hypercube. Returns array of sector ids
// (inclusive of both endpoints). Max 4 hops.
export function routeSector(from, to) {
  if (from === to) return [from];
  const visited = new Map();
  visited.set(from, null);
  const queue = [from];

  while (queue.length > 0) {
    const current = queue.shift();
    const neighbors = SECTOR_ADJACENCY.get(current);
    if (!neighbors) continue;

    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      visited.set(neighbor, current);

      if (neighbor === to) {
        const path = [];
        let step = to;
        while (step !== null) {
          path.push(step);
          step = visited.get(step);
        }
        return path.reverse();
      }
      queue.push(neighbor);
    }
  }
  return [];
}

// ── crossSectorDistance(nodeIdA, nodeIdB) ────────────────────────────────────
export function crossSectorDistance(nodeIdA, nodeIdB) {
  const sA = sectorOf(nodeIdA);
  const sB = sectorOf(nodeIdB);
  if (sA === undefined || sB === undefined) return -1;
  if (sA === sB) return 0;
  const path = routeSector(sA, sB);
  return path.length - 1;
}

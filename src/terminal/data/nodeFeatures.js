// nodeFeatures.js — 16D fingerprint space for Feigenbaum Fade sphere nodes
// Shared between ArtTab.jsx (visualisation) and useCommandDispatch.js (terminal commands).

export const NODES = [
  { id: 'biocoenosis', label: 'biocoenosis',    cluster: 'eco',    alias: 'biodiversity'    },
  { id: 'atmospheric', label: 'atmospheric',    cluster: 'eco',    alias: 'climate'         },
  { id: 'chrono',      label: 'chrono_actuary', cluster: 'eco',    alias: 'chrono'          },
  { id: 'daly',        label: 'daly',           cluster: 'eco',    alias: 'daly'            },
  { id: 'replicator',  label: 'replicator',     cluster: 'eco',    alias: 'replicator'      },
  { id: 'grayscott',   label: 'grayscott',      cluster: 'eco',    alias: 'grayscott'       },
  { id: 'kuramoto',    label: 'kuramoto',       cluster: 'sync',   alias: 'kuramoto'        },
  { id: 'ceei',        label: 'ceei',           cluster: 'sync',   alias: 'ceei'            },
  { id: 'soma91',      label: 'soma_9.1',       cluster: 'sync',   alias: 'soma91'          },
  { id: 'soma_plus',   label: 'soma_plus',      cluster: 'sync',   alias: 'soma_plus'       },
  { id: 'leviathan',   label: 'leviathan',      cluster: 'sync',   alias: 'leviathan'       },
  { id: 'cynic',       label: 'cynic_realist',  cluster: 'sync',   alias: 'cynicrealist'    },
  { id: 'feigenbaum',  label: 'feigenbaum',     cluster: 'phys',   alias: 'feigenbaum'      },
  { id: 'ising',       label: 'ising',          cluster: 'phys',   alias: 'ising'           },
  { id: 'bosonic',     label: 'bosonic',        cluster: 'phys',   alias: 'bosonic_lattice' },
  { id: 'seraphine',   label: 'seraphine',      cluster: 'phys',   alias: 'seraphine'       },
  { id: 'fusion',      label: 'fusion_plasma',  cluster: 'phys',   alias: 'fusion'          },
  { id: 'classified',  label: 'classified',     cluster: 'crypto', alias: 'classified'      },
  { id: 'pqhash',      label: 'pqhash',         cluster: 'crypto', alias: 'pqhash'          },
  { id: 'dh_ec',       label: 'dh_ec',          cluster: 'crypto', alias: 'dh_ec'           },
  { id: 'pragmatic',   label: 'pragmatic',      cluster: 'drk',    alias: 'pragmatic'       },
  { id: 'soma_kernel', label: 'soma_kernel',    cluster: 'drk',    alias: 'soma_kernel'     },
  { id: 'strangler',   label: 'strangler_fig',  cluster: 'drk',    alias: 'strangler_fig'   },
  { id: 'surveillance',label: 'surveillance',   cluster: 'drk',    alias: 'surveillance'    },
  { id: 'necromantic', label: 'necromantic',    cluster: 'drk',    alias: 'necromantic'     },
  // ── Seraphine-8.8.8.8.8.8.8.8 triad nodes ──────────────────────────────────
  { id: 'white_irid',        label: 'white_irid',        cluster: 'eco',    alias: 'white_irid'        },
  { id: 'pitch_black_steel', label: 'pitch_black_steel', cluster: 'phys',   alias: 'pitch_black_steel' },
  { id: 'bouligand_36',      label: 'bouligand_36',      cluster: 'eco',    alias: 'bouligand_36'      },
  { id: 'polymorph_pqc',     label: 'polymorph_pqc',     cluster: 'crypto', alias: 'polymorph_pqc'     },
  { id: 'magic_angle_1p1',   label: 'magic_angle_1.1',   cluster: 'phys',   alias: 'magic_angle'       },
  { id: 'zero_effort_flow',  label: 'zero_effort_flow',  cluster: 'drk',    alias: 'zero_effort_flow'  },
];

export const NODE_IDX = Object.fromEntries(NODES.map((n, i) => [n.id, i]));

// Resolve a user string to a node object (by id, alias, or label)
export function resolveNode(str) {
  const s = str.toLowerCase().trim().replace(/-/g, '_');
  return NODES.find(n => n.id === s || n.alias === s || n.label === s) ?? null;
}

export const DIM_NAMES = [
  'dynamical', 'nonlinearity', 'dimensionality', 'criticality',
  'entropy', 'synchrony', 'conservation', 'temporal',
  'spatial', 'stochastic', 'game_theory', 'thermodynamic',
  'information', 'cryptographic', 'biological', 'economic',
];

/* prettier-ignore */
export const FEATURES = [
  /*  0 biocoenosis */ [0.75,0.55,0.50,0.30,0.90,0.30,0.40,0.50,0.35,0.70,0.40,0.20,0.85,0.00,1.00,0.20],
  /*  1 atmospheric */ [0.80,0.70,0.75,0.50,0.55,0.20,0.50,0.80,0.70,0.30,0.10,0.80,0.30,0.00,0.40,0.10],
  /*  2 chrono      */ [0.50,0.45,0.50,0.30,0.50,0.10,0.30,1.00,0.35,0.20,0.30,0.60,0.40,0.00,0.65,0.70],
  /*  3 daly        */ [0.25,0.40,0.30,0.20,0.70,0.20,0.60,0.70,0.05,0.10,0.50,0.75,0.50,0.00,0.30,0.90],
  /*  4 replicator  */ [0.55,0.70,0.50,0.45,0.45,0.50,0.50,0.45,0.65,0.30,1.00,0.10,0.30,0.00,0.75,0.40],
  /*  5 grayscott   */ [1.00,0.90,0.75,0.60,0.30,0.40,0.40,0.30,1.00,0.00,0.00,0.20,0.10,0.00,0.30,0.00],
  /*  6 kuramoto    */ [0.55,0.60,0.70,0.55,0.35,1.00,0.50,0.40,0.65,0.20,0.20,0.10,0.25,0.00,0.25,0.10],
  /*  7 ceei        */ [0.25,0.30,0.55,0.20,0.40,0.50,0.80,0.20,0.65,0.10,0.85,0.20,0.40,0.00,0.10,1.00],
  /*  8 soma91      */ [0.30,0.35,0.50,0.30,0.50,0.40,0.50,0.50,0.65,0.20,0.30,0.50,0.50,0.00,0.20,0.50],
  /*  9 soma_plus   */ [0.45,0.40,0.55,0.30,0.50,0.50,0.50,0.50,0.65,0.30,0.30,0.50,0.50,0.00,0.20,0.40],
  /* 10 leviathan   */ [0.30,0.50,0.70,0.35,0.40,0.55,0.30,0.45,0.65,0.30,0.90,0.25,0.30,0.00,0.10,0.50],
  /* 11 cynic       */ [0.15,0.25,0.30,0.10,0.30,0.20,0.20,0.35,0.10,0.15,0.50,0.15,0.20,0.00,0.10,0.30],
  /* 12 feigenbaum  */ [0.30,1.00,0.25,0.85,0.25,0.10,0.50,0.20,0.05,0.00,0.00,0.10,0.20,0.00,0.00,0.00],
  /* 13 ising       */ [0.85,0.65,0.55,1.00,0.60,0.70,0.50,0.30,0.40,0.90,0.10,0.85,0.50,0.00,0.00,0.00],
  /* 14 bosonic     */ [0.50,0.55,0.70,0.70,0.40,0.60,0.50,0.20,0.65,0.30,0.40,0.70,0.30,0.00,0.00,0.30],
  /* 15 seraphine   */ [0.50,0.65,0.70,0.50,0.35,0.30,0.40,0.25,0.65,0.40,0.10,0.40,0.35,0.45,0.00,0.10],
  /* 16 fusion      */ [0.80,0.75,0.75,0.60,0.30,0.20,0.45,0.30,0.90,0.30,0.00,0.90,0.20,0.00,0.00,0.10],
  /* 17 classified  */ [0.05,0.30,0.30,0.00,0.20,0.00,0.05,0.05,0.05,0.50,0.00,0.00,0.50,1.00,0.00,0.00],
  /* 18 pqhash      */ [0.05,0.35,0.45,0.00,0.40,0.00,0.05,0.05,0.30,0.30,0.00,0.00,0.70,0.90,0.00,0.00],
  /* 19 dh_ec       */ [0.10,0.50,0.50,0.00,0.25,0.00,0.05,0.05,0.30,0.20,0.00,0.00,0.55,0.90,0.00,0.00],
  /* 20 pragmatic   */ [0.30,0.55,0.50,0.25,0.50,0.20,0.30,0.50,0.35,0.30,0.20,0.55,0.50,0.00,0.10,0.20],
  /* 21 soma_kernel */ [0.50,0.50,0.70,0.30,0.60,0.45,0.50,0.50,0.65,0.30,0.30,0.50,0.55,0.00,0.20,0.30],
  /* 22 strangler   */ [0.50,0.50,0.50,0.40,0.35,0.30,0.30,0.70,0.35,0.25,0.20,0.30,0.25,0.00,0.60,0.15],
  /* 23 surveillance*/ [0.25,0.30,0.55,0.20,0.60,0.20,0.20,0.50,0.65,0.20,0.50,0.10,0.70,0.30,0.10,0.30],
  /* 24 necromantic */ [0.70,0.65,0.50,0.40,0.40,0.30,0.20,0.65,0.35,0.50,0.20,0.45,0.30,0.00,0.50,0.10],
  // ── Seraphine-8.8.8.8.8.8.8.8 triad nodes ──────────────────────────────────
  /* 25 white_irid        */ [0.45,0.70,0.55,0.35,0.40,0.65,0.25,0.80,0.75,0.20,0.05,0.50,0.25,0.00,1.00,0.10],
  /* 26 pitch_black_steel */ [0.40,0.75,0.45,0.70,0.45,0.55,0.30,0.30,0.55,0.35,0.05,0.90,0.15,0.00,0.00,0.80],
  /* 27 bouligand_36      */ [0.35,0.60,0.35,0.25,0.30,0.90,0.20,0.10,0.55,0.15,0.05,0.40,0.20,0.10,0.90,0.05],
  /* 28 polymorph_pqc     */ [0.30,0.80,0.90,0.40,0.85,0.15,0.10,0.10,0.05,0.90,0.85,0.10,0.90,0.95,0.00,0.40],
  /* 29 magic_angle_1p1   */ [0.80,0.85,0.70,0.95,0.65,0.90,0.75,0.20,0.80,0.55,0.00,0.90,0.45,0.15,0.00,0.20],
  /* 30 zero_effort_flow  */ [0.75,0.70,0.65,0.60,0.50,0.70,0.40,0.45,0.40,0.40,0.20,0.20,0.55,0.00,0.60,0.30],
];

// ── Core math ────────────────────────────────────────────────────────────────

export function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < 16; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d < 1e-12 ? 0 : dot / d;
}

export function topDrivers(a, b, k = 3) {
  const contribs = DIM_NAMES.map((name, i) => ({ name, value: a[i] * b[i], magA: a[i], magB: b[i] }));
  contribs.sort((x, y) => y.value - x.value);
  return contribs.slice(0, k).filter(c => c.value > 0.01);
}

export function analyzeEdge(idA, idB) {
  const iA = NODE_IDX[idA], iB = NODE_IDX[idB];
  if (iA == null || iB == null) return null;
  const fA = FEATURES[iA], fB = FEATURES[iB];
  return { sim: cosineSim(fA, fB), drivers: topDrivers(fA, fB, 4) };
}

// ── Layer 4.4.4.4 — full 16D tensor manifest ─────────────────────────────────

export function analyzeFullEdge(idA, idB) {
  const iA = NODE_IDX[idA], iB = NODE_IDX[idB];
  if (iA == null || iB == null) return null;
  const fA = FEATURES[iA], fB = FEATURES[iB];
  const sim = cosineSim(fA, fB);
  const dims = DIM_NAMES.map((name, i) => ({
    name, i,
    vA: fA[i], vB: fB[i],
    delta: Math.abs(fA[i] - fB[i]),
    contrib: fA[i] * fB[i],
  }));
  const drivers = [...dims].sort((a, b) => b.contrib - a.contrib).slice(0, 5);
  return { idA, idB, sim, dims, drivers };
}

// ── Layer 5.5.5.5.5 — paradox extraction ─────────────────────────────────────
// Simulates 32 saponification iterations: each round, find max-delta dimension
// and reduce it by 7% toward the midpoint. Returns dimensions that remain
// structurally orthogonal after the full protocol — the irreducible paradoxes.

export function extractParadoxes(idA, idB) {
  const iA = NODE_IDX[idA], iB = NODE_IDX[idB];
  if (iA == null || iB == null) return null;
  const fA = [...FEATURES[iA]], fB = [...FEATURES[iB]];
  const origDeltas = fA.map((v, i) => Math.abs(v - fB[i]));

  for (let iter = 0; iter < 32; iter++) {
    const deltas = fA.map((v, i) => Math.abs(v - fB[i]));
    const maxVal = Math.max(...deltas);
    if (maxVal < 0.02) break;
    const maxIdx = deltas.indexOf(maxVal);
    const mid = (fA[maxIdx] + fB[maxIdx]) / 2;
    fA[maxIdx] = mid + (fA[maxIdx] - mid) * 0.93;
    fB[maxIdx] = mid + (fB[maxIdx] - mid) * 0.93;
  }

  const finalSim = cosineSim(fA, fB);
  const paradoxes = DIM_NAMES
    .map((name, i) => ({ name, i, residual: Math.abs(fA[i] - fB[i]), original: origDeltas[i] }))
    .filter(d => d.residual > 0.08)
    .sort((a, b) => b.residual - a.residual);

  return { idA, idB, finalSim, paradoxes };
}

// ── Orthogonal bridge search ──────────────────────────────────────────────────
// Finds the node with the LOWEST cosine similarity to targetId that doesn't
// already share an edge with it. This is the "most divergent" node in 16D space.
//
// existingEdgeSet: Set of canonical "a:b" keys (a < b alphabetically) already
// present in the active graph — these candidates are excluded from the search.
//
// Returns: { id, sim, divergentDims } where divergentDims is the top-4 dimensions
// with the highest |fA[i] - fB[i]| delta — the axes of maximum orthogonality.

export function findOrthogonalNode(targetId, existingEdgeSet) {
  const iA = NODE_IDX[targetId];
  if (iA == null) return null;
  const fA = FEATURES[iA];

  let bestId = null, bestSim = Infinity;

  for (let i = 0; i < NODES.length; i++) {
    const n = NODES[i];
    if (n.id === targetId) continue;
    const k = targetId < n.id ? `${targetId}:${n.id}` : `${n.id}:${targetId}`;
    if (existingEdgeSet.has(k)) continue;
    const s = cosineSim(fA, FEATURES[i]);
    if (s < bestSim) { bestSim = s; bestId = n.id; }
  }

  if (!bestId) return null;

  const iB  = NODE_IDX[bestId];
  const fB  = FEATURES[iB];
  const divergentDims = DIM_NAMES
    .map((name, i) => ({ name, i, delta: Math.abs(fA[i] - fB[i]), vA: fA[i], vB: fB[i] }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 4);

  return { id: bestId, sim: bestSim, divergentDims };
}

// ── Fusion ID counter — session-scoped ───────────────────────────────────────

let _fusionCounter = 0;
export function nextFusionId() {
  return `FX-${String(++_fusionCounter).padStart(4, '0')}`;
}

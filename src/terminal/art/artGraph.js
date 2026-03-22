// artGraph.js — Graph topology, color registries, and query projection for ArtTab
// Depends on nodeFeatures and kernelColorMap; everything else is pure data/logic.

import { nodeColor }                                    from '../data/kernelColorMap';
import { NODES, cosineSim, FEATURES, DIM_NAMES }        from '../data/nodeFeatures';

// ── Graph topology ────────────────────────────────────────────────────────────

export const CLUSTERS = {
  eco:    { label: 'ecological'   },
  sync:   { label: 'synchrony'    },
  phys:   { label: 'physics'      },
  crypto: { label: 'cryptography' },
  drk:    { label: 'drk'          },
};

// Intra-cluster edges — same cluster, always present
export const INTRA_EDGES = [
  ['biocoenosis', 'replicator'], ['biocoenosis', 'grayscott'],
  ['daly',        'chrono'],     ['daly',        'atmospheric'], ['chrono', 'atmospheric'],
  ['kuramoto',    'ceei'],       ['kuramoto',    'soma91'],
  ['soma91',      'soma_plus'],  ['soma91',      'leviathan'],   ['leviathan', 'cynic'],
  ['feigenbaum',  'ising'],      ['feigenbaum',  'bosonic'],
  ['ising',       'bosonic'],    ['bosonic',     'seraphine'],   ['seraphine', 'fusion'],
  ['ising',       'magic_angle_1p1'],                           // condensed matter pair
  ['bosonic',     'magic_angle_1p1'],                           // quantum phase pair
  ['pitch_black_steel', 'fusion'],                              // extreme material conditions
  ['pitch_black_steel', 'seraphine'],                           // mineralization bridge
  ['classified',  'pqhash'],     ['classified',  'dh_ec'],
  ['classified',  'polymorph_pqc'], ['pqhash', 'polymorph_pqc'], // PQC cluster
  ['white_irid',  'bouligand_36'],                              // same organism
  ['white_irid',  'biocoenosis'],                               // biological systems
  ['zero_effort_flow', 'necromantic'],                          // drk experiential
  ['pragmatic',   'soma_kernel'],['soma_kernel', 'strangler'],
  ['strangler',   'necromantic'],['strangler',   'surveillance'],
];

// Default cross-cluster bridges — replaced when spectral_bridge kernel runs
export const DEFAULT_CROSS_EDGES = [
  ['soma91',      'pragmatic'],
  ['kuramoto',    'feigenbaum'],
  ['biocoenosis', 'ceei'],
  ['seraphine',   'pqhash'],
  ['leviathan',   'surveillance'],
  ['grayscott',   'ising'],
  ['daly',        'ceei'],
  // ── Seraphine-8.8.8.8.8.8.8.8 fusion pair bridges ──
  ['white_irid',       'pitch_black_steel'], // Pair 1: biological ↔ industrial toughness (cos 0.855)
  ['bouligand_36',     'polymorph_pqc'],     // Pair 2: rotation ↔ lattice defense (cos 0.611)
  ['magic_angle_1p1',  'zero_effort_flow'],  // Pair 3: threshold superconductivity ↔ flow (cos 0.863)
];

// Full static edge list for physics (always includes all defaults for spring forces)
export const ALL_EDGES = [...INTRA_EDGES, ...DEFAULT_CROSS_EDGES];

export const ADJ = {};
NODES.forEach(n => { ADJ[n.id] = []; });
ALL_EDGES.forEach(([a, b]) => { ADJ[a]?.push(b); ADJ[b]?.push(a); });

// Pre-compute per-node colors once — immutable
export const NODE_COLORS = Object.fromEntries(
  NODES.map(n => [n.id, nodeColor(n.id, n.cluster)])
);
export const CLUSTER_COLORS = Object.fromEntries(
  Object.keys(CLUSTERS).map(k => [k, nodeColor(k, k)])
);

// ── Dynamic node registries (Period-Doubling bifurcation) ─────────────────────
// Module-level Maps so the RAF draw loop can read without React re-renders.
// Populated by handleBifurcate; cleared on initState (sphere reset).
export const dynColorMap    = new Map();   // childId → color object (same shape as NODE_COLORS values)
export const dynFeaturesMap = new Map();   // childId → Float32Array[16]

// ── Query projection ──────────────────────────────────────────────────────────
// Maps a free-text query to the 16D feature space via keyword presence scoring,
// then ranks all NODES by cosine similarity. Used by `query <text>` in the
// geometry terminal and automatically populates the sphere probe visualisation.
export const DIM_KEYWORDS = {
  dynamical:      ['dynamic', 'chaos', 'attractor', 'bifurcation', 'lorenz', 'orbit'],
  nonlinearity:   ['nonlinear', 'feedback', 'complex', 'sensitivity', 'instability'],
  dimensionality: ['dimension', 'manifold', 'space', 'embedding', 'topology', 'high-dim'],
  criticality:    ['critical', 'phase transition', 'threshold', 'tipping', 'metastable'],
  entropy:        ['entropy', 'disorder', 'uncertainty', 'heat', 'dissipation'],
  synchrony:      ['sync', 'synchrony', 'coherence', 'coupled', 'kuramoto', 'phase lock'],
  conservation:   ['conservation', 'invariant', 'symmetry', 'energy', 'conserved'],
  temporal:       ['time', 'temporal', 'delay', 'memory', 'history', 'chronological'],
  spatial:        ['spatial', 'pattern', 'turing', 'reaction', 'diffusion', 'field'],
  stochastic:     ['random', 'stochastic', 'noise', 'probability', 'monte carlo'],
  game_theory:    ['game', 'strategy', 'equilibrium', 'payoff', 'competition', 'nash'],
  thermodynamic:  ['thermodynamic', 'exergy', 'temperature', 'carnot', 'boltzmann', 'heat'],
  information:    ['information', 'bit', 'encoding', 'compression', 'shannon', 'kolmogorov'],
  cryptographic:  ['crypto', 'key', 'quantum', 'post-quantum', 'hash', 'lattice', 'kem', 'inefficien'],
  biological:     ['bio', 'ecology', 'species', 'evolution', 'organism', 'ecosystem', 'ecocide', 'life'],
  economic:       ['economic', 'gdp', 'growth', 'capital', 'market', 'extraction', 'monetary'],
};

export function queryProject(text) {
  const lower = text.toLowerCase();
  const qVec = DIM_NAMES.map(dim => (DIM_KEYWORDS[dim] ?? []).some(kw => lower.includes(kw)) ? 1.0 : 0.0);
  const qNorm = Math.sqrt(qVec.reduce((s, v) => s + v * v, 0));
  if (qNorm < 1e-12) { const n = DIM_NAMES.length; qVec.fill(1 / Math.sqrt(n)); }
  else { for (let i = 0; i < qVec.length; i++) qVec[i] /= qNorm; }
  const sims = NODES.map((n, i) => ({
    id: n.id, label: n.label, cluster: n.cluster,
    sim: cosineSim(qVec, FEATURES[i] ?? []),
  })).sort((a, b) => b.sim - a.sim);
  return { query: text, probe_vector: qVec, similarities: sims };
}

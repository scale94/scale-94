// artGraph.js — Graph topology, color registries, and query projection for ArtTab
// Depends on nodeFeatures and kernelColorMap; everything else is pure data/logic.

import { nodeColor }                                    from '../data/kernelColorMap';
import { NODES, NODE_IDX, cosineSim, FEATURES, DIM_NAMES } from '../data/nodeFeatures';

// ── Sphere core set ──────────────────────────────────────────────────────────
// The original 31 curated nodes that live on the sphere at init.
// New nodes enter ONLY through collision/chimera injection at runtime.
// Full 272-node NODES array is preserved for lookups, collider, and Scaling tab.
const SPHERE_IDS = new Set([
  // eco (6)
  'biocoenosis', 'atmospheric', 'chrono', 'daly', 'replicator', 'grayscott',
  // sync (6)
  'kuramoto', 'ceei', 'soma91', 'soma_plus', 'leviathan', 'cynic',
  // phys (5 + 3 extensions)
  'feigenbaum', 'ising', 'bosonic', 'seraphine', 'fusion',
  'pitch_black_steel', 'magic_angle_1p1',
  // crypto (3 + 1 extension)
  'classified', 'pqhash', 'dh_ec', 'polymorph_pqc',
  // drk (5 + 1 extension)
  'pragmatic', 'soma_kernel', 'strangler', 'surveillance', 'necromantic',
  'zero_effort_flow',
  // eco extensions
  'white_irid', 'bouligand_36',
]);
export const SPHERE_NODES = NODES.filter(n => SPHERE_IDS.has(n.id));
export const SPHERE_NODE_IDX = Object.fromEntries(SPHERE_NODES.map((n, i) => [n.id, i]));

// ── Graph topology ────────────────────────────────────────────────────────────

export const CLUSTERS = {
  eco:    { label: 'ecological'   },
  sync:   { label: 'synchrony'    },
  phys:   { label: 'physics'      },
  crypto: { label: 'cryptography' },
  drk:    { label: 'drk'          },
  phil:   { label: 'philosophy'   },
  math:   { label: 'mathematics'  },
  chem:   { label: 'chemistry'    },
  bio:    { label: 'biology'      },
  hum:    { label: 'humanities'   },
  ling:   { label: 'linguistics'  },
  cogn:   { label: 'cognitive'    },
  aesth:  { label: 'aesthetics'   },
  topo:   { label: 'topology'     },
  meta:   { label: 'metasystems'  },
  synth:  { label: 'synthesis'    },
  fsk:    { label: 'fish scale'   },
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

// ── Intra-sector edges — new sectors (Scale 16.16) ──────────────────────────
const NEW_INTRA_EDGES = [
  // phil
  ['episteme',       'aporia'],         ['episteme',        'modal_logic'],
  ['categorical_imp','virtue_ethics'],   ['dialectic',       'process_phil'],
  ['phenomenal',     'dasein'],          ['phenomenal',      'qualia_bind'],
  ['rhizome',        'mereology'],       ['wittgenstein',    'pragmatism'],
  ['absurdist',      'ubuntu'],          ['modal_logic',     'godel'],
  // math
  ['grothendieck',   'galois'],          ['grothendieck',    'langlands'],
  ['riemann_zeta',   'cantor'],          ['mandelbrot',      'chaos_attractor'],
  ['fourier',        'ergodic'],         ['bayesian',        'nash_equil'],
  ['poincare',       'knot_invariant'],  ['cellular_auto',   'p_vs_np'],
  ['godel',          'cantor'],          ['langlands',       'riemann_zeta'],
  // chem
  ['chirality',      'aroma_receptor'],  ['retrosynthesis',  'click_chem'],
  ['catalysis',      'redox'],           ['polymer_fold',    'supramolecular'],
  ['photochem',      'phase_diagram'],   ['maillard',        'terpene'],
  ['volatility',     'drydown'],         ['crystal_lattice', 'coord_chem'],
  ['electrospray',   'volatility'],      ['terpene',         'aroma_receptor'],
  // bio
  ['crispr',         'epigenetic'],      ['morphogen',       'axon_guidance'],
  ['microbiome',     'quorum'],          ['apoptosis',       'telomere'],
  ['prion',          'polymer_fold'],    ['endosymbiont',    'horizontal_xfer'],
  ['neurotransmit',  'olfactory_bulb'],  ['circadian_bio',   'circadian'],
  ['extremophile',   'permafrost'],      ['vomeronasal',     'olfactory_bulb'],
  // hum
  ['longue_duree',   'collective_mem'],  ['oral_tradition',  'mytheme'],
  ['palimpsest',     'archive_fever'],   ['diaspora',        'orientalism'],
  ['cargo_cult',     'liminality'],      ['gift_economy',    'potlatch'],
  ['thick_desc',     'subaltern'],       ['perfume_hist',    'synesthesia_cul'],
  // ling
  ['saussure',       'peirce_sign'],     ['chomsky_tree',    'pragmatics'],
  ['sapir_whorf',    'metaphor_engine'], ['phonaestheme',    'prosody'],
  ['prototype',      'corpus'],          ['pidgin',          'etymology'],
  ['glossopoeia',    'translation'],     ['olfactory_lexicon','deixis'],
  // cogn
  ['predictive_brain','global_workspace'],['binding_problem', 'attention_schema'],
  ['mirror_neuron',  'embodied_cog'],    ['enactive',        'affordance'],
  ['default_mode',   'proustian'],       ['hippocampal',     'piriform'],
  ['weber_fechner',  'mcgurk'],          ['chunking',        'blindsight'],
  // aesth
  ['sublime',        'je_ne_sais_quoi'], ['wabi_sabi',       'patina'],
  ['synesthetic',    'umami'],           ['golden_ratio',    'accord_theory'],
  ['negative_space', 'camp'],            ['terroir',         'headspace_tech'],
  ['sillage_theory', 'drydown'],         ['base_note',       'accord_theory'],
  // topo
  ['mobius',         'klein_bottle'],     ['euler_char',      'betti_number'],
  ['homology',       'cobordism'],        ['fiber_bundle',    'geodesic'],
  ['simplex',        'persistent_hom'],   ['hyperbolic',      'voronoi'],
  ['graph_laplacian','tda_mapper'],       ['winding_number',  'morse_theory'],
  // meta
  ['autopoiesis',    'cybernetic'],       ['stigmergy',       'swarm'],
  ['soc_critical',   'edge_chaos'],       ['downward_cause',  'holarchy'],
  ['dissipative',    'phase_trans'],       ['strange_loop',    'bootstrap'],
  ['attractor_land', 'scale_free'],       ['teleology',       'omega_point'],
  // synth
  ['analogy',        'isomorphism'],      ['bisociation',     'metaphor_bridge'],
  ['consilience',    'transdiscipline'],  ['abduction',       'decay_engine'],
  ['boundary_object','translation_layer'],['resonance_bridge','chimera_forge'],
  ['polysemy',       'ock_v2'],           ['hybrid_vigor',    'omega_collider'],
  // fsk (Fish Scale Doctrine)
  ['arapaima',        'bouligand_fsk'],    ['arapaima',         'shell_theory'],
  ['plata_plomo',     'levamisole'],       ['plata_plomo',      'purity_paradox'],
  ['shell_theory',    'moire_fsk'],        ['shell_theory',     'scalar_sov'],
  ['eco_aesthetics',  'eco_semiotics'],    ['eco_aesthetics',   'purity_paradox'],
  ['levamisole',      'purity_paradox'],   ['sokushinbutsu',    'necro_engine'],
  ['pdw_filter',      'tyler_monarch'],    ['tyler_monarch',    'rave_legacy'],
  ['moire_fsk',       'bouligand_fsk'],    ['colemak_topo',     'scalar_sov'],
  ['necro_engine',    'rave_legacy'],
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
  // ── Scale 16.16 cross-sector bridges ──
  ['episteme',         'bayesian'],          // phil ↔ math
  ['chirality',        'olfactory_bulb'],    // chem ↔ bio
  ['piriform',         'proustian'],         // cogn ↔ cogn (intra but cross-cluster feel)
  ['saussure',         'wittgenstein'],      // ling ↔ phil
  ['accord_theory',    'terpene'],           // aesth ↔ chem
  ['autopoiesis',      'mycorrhizal'],       // meta ↔ eco
  ['mobius',           'poincare'],           // topo ↔ math
  ['chimera_forge',    'omega_collider'],     // synth (internal keystone)
  ['longue_duree',     'simulacra'],          // hum ↔ drk
  ['neurotransmit',    'predictive_brain'],   // bio ↔ cogn
  ['metaphor_engine',  'bisociation'],        // ling ↔ synth
  ['sublime',          'dasein'],             // aesth ↔ phil
  ['percolation',      'scale_free'],         // phys ↔ meta
  ['zkp_circuit',      'modal_logic'],        // crypto ↔ phil
  ['olfactory_lexicon','perfume_hist'],        // ling ↔ hum
  // ── Fish Scale cross-sector bridges ──
  ['arapaima',         'biocoenosis'],         // fsk ↔ eco (biological armor)
  ['bouligand_fsk',    'bouligand_36'],        // fsk ↔ eco (helicoidal pair)
  ['moire_fsk',        'magic_angle_1p1'],     // fsk ↔ phys (twisted bilayer)
  ['necro_engine',     'necromantic'],          // fsk ↔ drk (resurrection)
  ['eco_semiotics',    'saussure'],             // fsk ↔ ling (sign theory)
  ['eco_aesthetics',   'sublime'],              // fsk ↔ aesth (beauty theory)
  ['shell_theory',     'bosonic'],              // fsk ↔ phys (fermion/boson)
  ['plata_plomo',      'moloch'],               // fsk ↔ drk (coordination trap)
  ['levamisole',       'chirality'],            // fsk ↔ chem (molecular exploit)
];

// Full static edge list (all 272-node sectors — used by Scaling tab, collider)
export const ALL_EDGES = [...INTRA_EDGES, ...NEW_INTRA_EDGES, ...DEFAULT_CROSS_EDGES];

export const ADJ = {};
NODES.forEach(n => { ADJ[n.id] = []; });
ALL_EDGES.forEach(([a, b]) => { ADJ[a]?.push(b); ADJ[b]?.push(a); });

// ── Sphere-only edges and adjacency (31-node core set) ──────────────────────
// Only edges where BOTH endpoints live in SPHERE_IDS.
export const SPHERE_EDGES = ALL_EDGES.filter(([a, b]) => SPHERE_IDS.has(a) && SPHERE_IDS.has(b));
export const SPHERE_ADJ = {};
SPHERE_NODES.forEach(n => { SPHERE_ADJ[n.id] = []; });
SPHERE_EDGES.forEach(([a, b]) => { SPHERE_ADJ[a]?.push(b); SPHERE_ADJ[b]?.push(a); });

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
  // ── Extended dims [16..31] — 256-cluster cognitive expansion ──
  epistemological: ['epistemic', 'knowledge', 'justified', 'belief', 'gettier', 'truth'],
  metaphysical:   ['metaphysics', 'ontology', 'causation', 'being', 'substance', 'modal'],
  ethical:        ['ethics', 'moral', 'virtue', 'deontological', 'normative', 'justice'],
  phenomenological:['phenomenology', 'qualia', 'consciousness', 'intentionality', 'experience'],
  algebraic:      ['algebra', 'group', 'ring', 'field', 'category', 'functor', 'morphism'],
  topological:    ['topology', 'manifold', 'homology', 'homotopy', 'continuous', 'fiber'],
  statistical:    ['statistics', 'bayesian', 'regression', 'inference', 'distribution', 'estimator'],
  linguistic:     ['language', 'grammar', 'syntax', 'semantics', 'morphology', 'phonology'],
  historical:     ['history', 'archive', 'epoch', 'civilization', 'colonial', 'memory'],
  aesthetic:      ['aesthetic', 'beauty', 'sublime', 'taste', 'art', 'fragrance', 'perfume'],
  cognitive:      ['cognitive', 'neural', 'brain', 'attention', 'perception', 'memory'],
  chemical:       ['chemical', 'molecular', 'reaction', 'bond', 'synthesis', 'compound'],
  quantum:        ['quantum', 'superposition', 'entanglement', 'wave function', 'planck'],
  emergent:       ['emergence', 'self-organization', 'complex system', 'swarm', 'collective'],
  semiotic:       ['semiotic', 'sign', 'symbol', 'meaning', 'signifier', 'interpretation'],
  synthetic:      ['synthetic', 'interdisciplinary', 'fusion', 'integration', 'bridge', 'chimera'],
};

// ── Sphere anchoring ─────────────────────────────────────────────────────────
// A query is ranked against all 272 NODES, but only the 31 SPHERE_NODES have a
// position to draw at — and the top matches are usually off-sphere entirely
// (192 of the 272 live in a cluster with no sphere member at all, so falling
// back to the cluster would not help). Anchor every corpus node to its nearest
// sphere node in the same 16D feature space the ranking itself uses: sphere
// nodes anchor to themselves, and the probe always has somewhere to land.
const SPHERE_FEATURES = SPHERE_NODES.map(n => FEATURES[NODE_IDX[n.id]] ?? []);

export const SPHERE_ANCHOR = Object.fromEntries(NODES.map((n, i) => {
  const f = FEATURES[i] ?? [];
  let bestId = SPHERE_NODES[0].id, bestSim = -Infinity;
  SPHERE_FEATURES.forEach((sf, si) => {
    const c = cosineSim(f, sf);
    if (c > bestSim) { bestSim = c; bestId = SPHERE_NODES[si].id; }
  });
  return [n.id, bestId];
}));

export const SPHERE_LABEL = Object.fromEntries(SPHERE_NODES.map(n => [n.id, n.label]));

// Collapse the top matches of a ranking onto the sphere: matches sharing an
// anchor merge into one weighted point, so the probe centroid and its tethers
// are built from the same set. Returns [{ id, label, weight, sources }] sorted
// by descending weight.
export function probeAnchors(similarities, topN = 4) {
  const merged = new Map();
  for (const { id, sim } of (similarities ?? []).slice(0, topN)) {
    const anchorId = SPHERE_ANCHOR[id];
    if (!anchorId || !(sim > 0)) continue;
    const entry = merged.get(anchorId);
    if (entry) { entry.weight += sim; entry.sources.push(id); }
    else merged.set(anchorId, { id: anchorId, label: SPHERE_LABEL[anchorId], weight: sim, sources: [id] });
  }
  return [...merged.values()].sort((a, b) => b.weight - a.weight);
}

export const PROBE_ANCHOR_COUNT = 4;

export function queryProject(text) {
  const lower = text.toLowerCase();
  const qVec = DIM_NAMES.map(dim => (DIM_KEYWORDS[dim] ?? []).some(kw => lower.includes(kw)) ? 1.0 : 0.0);
  const qNorm = Math.sqrt(qVec.reduce((s, v) => s + v * v, 0));
  if (qNorm < 1e-12) { const n = DIM_NAMES.length; qVec.fill(1 / Math.sqrt(n)); }
  else { for (let i = 0; i < qVec.length; i++) qVec[i] /= qNorm; }
  const sims = NODES.map((n, i) => ({
    id: n.id, label: n.label, cluster: n.cluster,
    sim: cosineSim(qVec, FEATURES[i] ?? []),
    anchor: SPHERE_ANCHOR[n.id],
  })).sort((a, b) => b.sim - a.sim);
  return {
    query: text, probe_vector: qVec, similarities: sims,
    anchors: probeAnchors(sims, PROBE_ANCHOR_COUNT),
  };
}

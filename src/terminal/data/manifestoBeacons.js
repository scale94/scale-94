// manifestoBeacons.js — curated subset of node ids that the manifesto
// namechecks, each tagged with the chapter it belongs to and a one-line
// quote for the center HUD hover state.
//
// Every nodeId here is verified to exist in NODES (src/terminal/data/nodeFeatures.js).
// The data-integrity test in tests/manifesto/manifestoData.test.js enforces this.

export const MANIFESTO_BEACONS = [
  // ── §1 SUBSTRATE ──────────────────────────────────────────────────────
  { nodeId: 'bouligand_36',    chapter: 'substrate',    quote: 'collagen lamellae rotate at 36°, dissipating crack propagation laterally' },
  { nodeId: 'mycorrhizal',     chapter: 'substrate',    quote: 'the kernel graph is a conceptual lattice, not a dependency tree' },
  { nodeId: 'replicator',      chapter: 'substrate',    quote: 'dissipative ecological models — executable, structured' },
  { nodeId: 'grayscott',       chapter: 'substrate',    quote: 'reaction-diffusion pattern formation on a static grid' },
  { nodeId: 'biocoenosis',     chapter: 'substrate',    quote: 'each kernel a probe for distinct regions of property space' },
  { nodeId: 'crispr',          chapter: 'substrate',    quote: 'thin routing membrane — lib.rs is 12 lines' },
  { nodeId: 'polymer_fold',    chapter: 'substrate',    quote: 'the intelligence is in the vesicles' },
  { nodeId: 'terpene',         chapter: 'substrate',    quote: 'the system does not have an API — it has a terminal' },

  // ── §2 FEATURE SPACE ──────────────────────────────────────────────────
  { nodeId: 'kuramoto',        chapter: 'feature_space', quote: 'synchrony axis — individual to collective phase-locking' },
  { nodeId: 'soma91',          chapter: 'feature_space', quote: 'the SovereignTensor is 176 bytes, packed across three cache lines' },
  { nodeId: 'feigenbaum',      chapter: 'feature_space', quote: 'δ ≈ 4.6692 — universal scaling law at the edge of chaos' },
  { nodeId: 'ising',           chapter: 'feature_space', quote: 'criticality axis — smooth to sharp phase transition' },
  { nodeId: 'fourier',         chapter: 'feature_space', quote: '16 dimensions: fewer collapse distinctions, more destabilise estimates' },
  { nodeId: 'nash_equil',      chapter: 'feature_space', quote: 'game_theory is one of the highest-variance axes' },
  { nodeId: 'chaos_attractor', chapter: 'feature_space', quote: 'dynamical axis — static equilibrium to stochastic PDE' },

  // ── §3 BONE FUSION ────────────────────────────────────────────────────
  { nodeId: 'magic_angle_1p1', chapter: 'bone_fusion',  quote: 'at exactly 1.1°, twisted bilayer graphene forms Moiré flat bands' },
  { nodeId: 'mobius',          chapter: 'bone_fusion',  quote: 'the engine drives tensors toward convergence threshold τ = 0.9990' },
  { nodeId: 'homology',        chapter: 'bone_fusion',  quote: 'saponification asks: strip metabolic cost, are these structurally equivalent?' },
  { nodeId: 'edge_chaos',      chapter: 'bone_fusion',  quote: 'the 1.1° rotation induces constructive interference without destroying tensors' },
  { nodeId: 'dissipative',     chapter: 'bone_fusion',  quote: 'FusionRejected is a meaningful signal — metabolic stripping cannot dissolve it' },
  { nodeId: 'analogy',         chapter: 'bone_fusion',  quote: 'convergence through Bouligand rotation and magic-angle micro-rotation' },
  { nodeId: 'isomorphism',     chapter: 'bone_fusion',  quote: 'some systems are structurally incompatible at a level stripping cannot dissolve' },

  // ── §4 SARG ───────────────────────────────────────────────────────────
  { nodeId: 'seraphine',       chapter: 'sarg',         quote: 'n active clusters as a quantum density matrix in H^n' },
  { nodeId: 'global_workspace',chapter: 'sarg',         quote: 'SARG(t) = C_l1(t) · (1 + λ_e · Δ(t)) — peak at t* = 1/γ' },
  { nodeId: 'binding_problem', chapter: 'sarg',         quote: 'off-diagonal elements encode associative coherence between concepts' },
  { nodeId: 'sublime',         chapter: 'sarg',         quote: 'narrative compellingness and geometric similarity are negatively correlated' },

  // ── §5 FADE ───────────────────────────────────────────────────────────
  { nodeId: 'rhizome',         chapter: 'fade',         quote: 'the Lindblad operator runs — decoherence always wins' },
  { nodeId: 'dialectic',       chapter: 'fade',         quote: 'poised in Kauffman\'s ordered regime adjacent to chaos — not chaotic, poised' },
  { nodeId: 'palimpsest',      chapter: 'fade',         quote: 'a reasoning window that opens, reaches maximum density, then fades' },
  { nodeId: 'saussure',        chapter: 'fade',         quote: 'the system is governed by dissolution, not accumulation' },
  { nodeId: 'longue_duree',    chapter: 'fade',         quote: 'high scores are not permanent states — they are peaks in a SARG time series' },
  { nodeId: 'metaphor_engine', chapter: 'fade',         quote: 'the score is the event' },

  // ── §8 ENCLAVE ────────────────────────────────────────────────────────
  { nodeId: 'pqhash',          chapter: 'enclave',      quote: 'ML-KEM-768 — real post-quantum key encapsulation in WebAssembly' },
  { nodeId: 'lattice_sieve',   chapter: 'enclave',      quote: '1184-byte encapsulation key, 2400-byte decapsulation key — session only' },
  { nodeId: 'classified',      chapter: 'enclave',      quote: 'the visual distinction: one is a game, one is the boundary' },
  { nodeId: 'zkp_circuit',     chapter: 'enclave',      quote: 'HMAC-signed session tokens, 60-second time gate, AES-GCM payload' },
  { nodeId: 'surveillance',    chapter: 'enclave',      quote: 'no backup, no recovery — refresh loses all sealed data' },
  { nodeId: 'panspectron',     chapter: 'enclave',      quote: 'the import pipeline does not check for cleverness, it checks for integrity' },
];

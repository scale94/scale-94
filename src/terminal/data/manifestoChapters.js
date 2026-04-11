// manifestoChapters.js — 6 manifesto chapters mapped to contiguous arcs
// of mandala sectors. Epigraphs and opening paragraphs are hand-excerpted
// from content/system_logs/MANIFESTO.md — duplicated here because the
// mandala needs synchronous access and the source markdown is only
// hydrated into systemArticles asynchronously.

export const MANIFESTO_CHAPTERS = [
  {
    id: 'substrate',
    number: '§1',
    title: 'THE SUBSTRATE',
    sectors: ['eco', 'bio', 'chem'],
    epigraph: '34 kernels. Each one a .rs file compiled to WebAssembly.',
    opening:
      '34 kernels. Each one a .rs file compiled to WebAssembly through a thin routing membrane. The kernel graph is not a dependency tree — it is a conceptual lattice. Nodes are computational probes for distinct regions of mathematical property space. The system does not have an API. It has a terminal.',
  },
  {
    id: 'feature_space',
    number: '§2',
    title: 'THE FEATURE SPACE',
    sectors: ['sync', 'phys', 'math'],
    epigraph: 'Every kernel node occupies a position in a 16-dimensional feature space.',
    opening:
      'Every kernel node occupies a position in a 16-dimensional feature space. The axes were not derived from corpus statistics — they were selected on one criterion: they collectively span the relevant mathematical property space of complex dynamical systems, each axis anchored in primary physical literature. The highest-variance axes are game_theory, thermodynamic, stochastic, synchrony, information.',
  },
  {
    id: 'bone_fusion',
    number: '§3.3.3',
    title: 'THE BONE FUSION ENGINE',
    sectors: ['topo', 'meta', 'synth'],
    epigraph: 'Bouligand 36°. Magic angle 1.1°. Saponification.',
    opening:
      'Given two SovereignTensors, the engine drives them toward convergence through three sequential operations: a 36° Bouligand rotation (from Arapaima gigas dermal scale architecture, the angle of maximum energy dissipation), a 1.1° magic-angle micro-rotation (from twisted bilayer graphene, where electron kinetic energy is quenched), and saponification (stripping metabolic_cost to expose the structural skeleton underneath).',
  },
  {
    id: 'sarg',
    number: '§4.4.4.4',
    title: 'THE SARG METRIC',
    sectors: ['cogn', 'aesth'],
    epigraph: 'Lindblad evolution. Decoherence always wins.',
    opening:
      'Seraphine models n active concept clusters as a quantum density matrix in H^n. Off-diagonal elements decay exponentially at rate γ — this is not a failure mode, it is the primary dynamics. The Seraphine Associative Reasoning Gain peaks at t* = 1/γ, then decays toward zero. Narrative compellingness and geometric similarity are negatively correlated.',
  },
  {
    id: 'fade',
    number: '§5.5.5.5.5',
    title: 'THE FADE DOCTRINE',
    sectors: ['phil', 'hum', 'ling'],
    epigraph: 'Feigenbaum δ ≈ 4.6692. The system is governed by dissolution.',
    opening:
      'The Fading Feigenbaum Sphere operates at the edge between order and chaos — 34 kernel nodes poised in Kauffman\'s ordered regime adjacent to chaos. Connections are forged, local coherence rises, then the Lindblad operator runs. Decoherence always wins. The score is the event. High scores are not permanent states — they are peaks in a SARG time series, a reasoning window that opens, reaches maximum associative density, then fades back to classical noise.',
  },
  {
    id: 'enclave',
    number: '§8.8.8.8.8.8.8.8',
    title: 'THE ENCLAVE',
    sectors: ['crypto', 'drk'],
    epigraph: 'ML-KEM-768 + AES-256-GCM. Real post-quantum key encapsulation.',
    opening:
      'enclave.rs implements ML-KEM-768 (NIST FIPS 203) + AES-256-GCM. This is not a cryptography metaphor. This is real post-quantum key encapsulation running in WebAssembly. Keys are session-only. No backup. No recovery. Refresh loses all sealed data. The visual distinction between the classified enclave and the WASM enclave: one is a game, one is the boundary.',
  },
];

export const CHAPTER_BY_ID = Object.fromEntries(
  MANIFESTO_CHAPTERS.map(ch => [ch.id, ch]),
);

export const CHAPTER_BY_SECTOR = (() => {
  const out = {};
  for (const ch of MANIFESTO_CHAPTERS) {
    for (const s of ch.sectors) out[s] = ch;
  }
  return out;
})();

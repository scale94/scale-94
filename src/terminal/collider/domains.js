// ── Domain library (mirrors the 16 domains in latent_collider.rs) ────────────
export const DOMAINS = [
  { id: 0,  name: 'Post-Quantum Cryptography',   short: 'PQC',       hue: 280 },
  { id: 1,  name: 'Benthic Biocenosis',           short: 'BENTH',     hue: 190 },
  { id: 2,  name: 'Bouligand Helicoidal Armor',   short: 'BOULG',     hue: 30  },
  { id: 3,  name: 'Feigenbaum Universality',       short: 'FEIGEN',    hue: 0   },
  { id: 4,  name: 'Mycelial Network Topology',     short: 'MYCEL',     hue: 120 },
  { id: 5,  name: 'Transformer Attention Heads',   short: 'ATTN',      hue: 220 },
  { id: 6,  name: 'Thermodynamic Free Energy',     short: 'THERMO',    hue: 45  },
  { id: 7,  name: 'Surveillance Percolation',      short: 'PANOPT',    hue: 340 },
  { id: 8,  name: 'Twisted Bilayer Graphene',      short: 'GRAPHN',    hue: 170 },
  { id: 9,  name: 'Ostrom Commons Governance',     short: 'OSTROM',    hue: 90  },
  { id: 10, name: 'Kuramoto Synchronization',      short: 'KURAM',     hue: 260 },
  { id: 11, name: 'Baudrillard Simulacra',         short: 'BAUDRL',    hue: 310 },
  { id: 12, name: 'Plasma Confinement Fusion',     short: 'PLASMA',    hue: 15  },
  { id: 13, name: 'Semiotic Code Collapse',         short: 'SEMIO',     hue: 200 },
  { id: 14, name: 'Evolutionary Game Theory',       short: 'EVOL',      hue: 140 },
  { id: 15, name: 'Metabolic Rift Ecology',         short: 'RIFT',      hue: 80  },
];

// ── Block II: Elemental Domains (v1.2.0) — 21st-century periodic table ───────
export const ELEM_DOMAINS = [
  { id: 16, name: 'Radon Infiltration Dynamics',      short: 'Rn',   hue: 55  },
  { id: 17, name: 'Lithium Extraction Ecology',       short: 'Li',   hue: 150 },
  { id: 18, name: 'Silicon Gate Logic',               short: 'Si',   hue: 210 },
  { id: 19, name: 'Carbon Allotropic Collapse',       short: 'C',    hue: 0   },
  { id: 20, name: 'Cobalt Supply Chain Conflict',     short: 'Co',   hue: 230 },
  { id: 21, name: 'Phosphorus Depletion Crisis',      short: 'P',    hue: 100 },
  { id: 22, name: 'Uranium Critical Mass',            short: 'U',    hue: 50  },
  { id: 23, name: 'Gallium Arsenide Photonics',       short: 'GaAs', hue: 185 },
  { id: 24, name: 'Neodymium Magnetic Monopoly',      short: 'Nd',   hue: 295 },
  { id: 25, name: 'Helium-3 Scarcity Horizon',        short: 'He³',  hue: 60  },
  { id: 26, name: 'Mercury Phase Boundary',           short: 'Hg',   hue: 330 },
  { id: 27, name: 'Plutonium Proliferation Geometry',  short: 'Pu',   hue: 15  },
  { id: 28, name: 'Copper Electrification Bottleneck', short: 'Cu',   hue: 25  },
  { id: 29, name: 'Nitrogen Fixation Collapse',       short: 'N',    hue: 110 },
  { id: 30, name: 'Tungsten Densification Regime',    short: 'W',    hue: 240 },
  { id: 31, name: 'Iodine Thyroid Cascade',           short: 'I',    hue: 270 },
];

// ── Block III: Philosophy & Mathematics (Scale 16.16) ────────────────────────
export const PHIL_MATH_DOMAINS = [
  { id: 32, name: 'Kantian Categorical Imperative',  short: 'KANT',     hue: 275 },
  { id: 33, name: 'Hegelian Dialectic Synthesis',     short: 'HEGEL',    hue: 285 },
  { id: 34, name: 'Phenomenological Qualia Binding',  short: 'QUALIA',   hue: 300 },
  { id: 35, name: 'Deleuze Rhizomatic Ontology',      short: 'RHZM',     hue: 265 },
  { id: 36, name: 'Grothendieck Topos Theory',         short: 'TOPOS',    hue: 180 },
  { id: 37, name: 'Gödel Incompleteness Barrier',      short: 'GÖDEL',    hue: 195 },
  { id: 38, name: 'Bayesian Inference Engine',          short: 'BAYES',    hue: 175 },
  { id: 39, name: 'Lorenz Strange Attractor',           short: 'LORENZ',   hue: 5   },
];

// ── Block IV: Chemistry, Biology & Humanities ────────────────────────────────
export const LIFE_HUM_DOMAINS = [
  { id: 40, name: 'Molecular Chirality Recognition',   short: 'CHIRAL',   hue: 35  },
  { id: 41, name: 'Terpene Scaffold Architecture',      short: 'TERPN',    hue: 125 },
  { id: 42, name: 'Olfactory Receptor Binding',         short: 'OR',       hue: 160 },
  { id: 43, name: 'CRISPR Gene Editing Cascade',        short: 'CRISPR',   hue: 145 },
  { id: 44, name: 'Morphogen Gradient Formation',       short: 'MORPH',    hue: 115 },
  { id: 45, name: 'Olfactory Bulb Combinatorics',       short: 'BULB',     hue: 155 },
  { id: 46, name: 'Braudel Longue Durée',               short: 'DURÉE',    hue: 335 },
  { id: 47, name: 'Fragrance Cultural History',          short: 'PARFUM',   hue: 320 },
];

// ── Block V: Cognitive, Aesthetic & Synthetic Integration ────────────────────
export const COGN_SYNTH_DOMAINS = [
  { id: 48, name: 'Predictive Coding Architecture',    short: 'PRED',     hue: 290 },
  { id: 49, name: 'Piriform Cortex Encoding',           short: 'PIRFM',    hue: 305 },
  { id: 50, name: 'Proustian Memory Cascade',            short: 'PROUST',   hue: 315 },
  { id: 51, name: 'Kantian Sublime Aesthetics',          short: 'SUBLM',    hue: 270 },
  { id: 52, name: 'Fragrance Accord Theory',              short: 'ACCRD',    hue: 40  },
  { id: 53, name: 'Sillage Projection Model',             short: 'SLLGE',    hue: 50  },
  { id: 54, name: 'Persistent Homology TDA',              short: 'TDA',      hue: 200 },
  { id: 55, name: 'Autopoietic Self-Organization',        short: 'AUTO',     hue: 75  },
  { id: 56, name: 'Chimera Forge Synthesis',               short: 'FORGE',    hue: 350 },
  { id: 57, name: 'Omega Collider Integration',            short: 'OMEGA',    hue: 10  },
];

// ── Block VI: Fish Scale Doctrine ─────────────────────────────────────────────
export const FSK_DOMAINS = [
  { id: 58, name: 'Arapaima Biological Armor',        short: 'ARAPA',    hue: 0   },
  { id: 59, name: 'Bouligand Helicoidal Defense',      short: 'BOULG²',   hue: 30  },
  { id: 60, name: 'Plata o Plomo Logic Gate',           short: 'PoPL',     hue: 340 },
  { id: 61, name: 'Fermion-Boson Shell Theory',         short: 'SHELL',    hue: 45  },
  { id: 62, name: 'Scalar Sovereignty Invariance',      short: 'SCLR',     hue: 55  },
  { id: 63, name: 'Eco Aesthetics Dialectic',            short: 'ECO·A',    hue: 310 },
  { id: 64, name: 'Eco Semiotics Axiom of Lie',          short: 'ECO·S',    hue: 200 },
  { id: 65, name: 'Necromantic Engine Synthesis',         short: 'NECRO',    hue: 270 },
  { id: 66, name: 'Tyler Monarch Fight Club',             short: 'TYLER',    hue: 350 },
  { id: 67, name: 'Moiré Flat Band Emergence',            short: 'MOIRÉ',    hue: 170 },
  { id: 68, name: 'Purity-Corruption Paradox',             short: 'PURITY',   hue: 15  },
  { id: 69, name: '1995 Rave Legacy Substrate',            short: 'RAVE',     hue: 280 },
];

// ── Block VII: Planet System ──────────────────────────────────────────────────
export const PLANET_DOMAINS = [
  { id: 70, name: 'Sol Chromosphere Sovereignty',     short: '☉', hue: 45  },
  { id: 71, name: 'Mercury Messenger Precession',     short: '☿', hue: 210 },
  { id: 72, name: 'Venus Greenhouse Seduction',       short: '♀', hue: 30  },
  { id: 73, name: 'Terra Biosphere Accord',           short: '⊕', hue: 120 },
  { id: 74, name: 'Luna Tidal Synchrony',             short: '☽', hue: 220 },
  { id: 75, name: 'Mars Iron War Geology',            short: '♂', hue: 0   },
  { id: 76, name: 'Jupiter Storm Kingship',           short: '♃', hue: 25  },
  { id: 77, name: 'Saturn Ring Time Compression',     short: '♄', hue: 40  },
  { id: 78, name: 'Uranus Obliquity Doctrine',        short: '⛢', hue: 180 },
  { id: 79, name: 'Neptune Deep Current Sovereignty', short: '♆', hue: 225 },
  { id: 80, name: 'Pluto Underworld Threshold',       short: '♇', hue: 270 },
];

// Unified lookup by id — keeps DOMAINS array untouched for animation code
export const ALL_DOMAINS = [...DOMAINS, ...ELEM_DOMAINS, ...PHIL_MATH_DOMAINS, ...LIFE_HUM_DOMAINS, ...COGN_SYNTH_DOMAINS, ...FSK_DOMAINS, ...PLANET_DOMAINS];
export const domainById = (id) => ALL_DOMAINS.find(d => d.id === id);

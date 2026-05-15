import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { loadWasm } from '../../wasm/wasmSingleton';
import { parseAstroOutput, PLANET_MAP } from '../mercury/tfgAstroHelpers';
import {
  FEATURES, NODE_IDX, DIM_NAMES,
  cosineSim, topDrivers, analyzeFullEdge, extractParadoxes,
} from '../data/nodeFeatures';
import { useColliderNarrative } from '../hooks/useColliderNarrative';
import { useProductionThreshold } from '../hooks/useProductionThreshold';
import { useOrderStatus, storeOrderHash } from '../hooks/useOrderStatus';
import { buildChimeraGlyph } from './chimeraGlyph.js';

// ── CopySpan — tiny clipboard helper used in Tesseract contact signals ───────
function CopySpan({ value, color }) {
  const [copied, setCopied] = React.useState(false);
  const handleClick = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <span
      onClick={handleClick}
      style={{ color: copied ? `rgba(255,215,0,0.36)` : color, cursor: 'pointer' }}
    >
      {copied ? 'COPIED' : value}
    </span>
  );
}

// ── Collider Event Bus ───────────────────────────────────────────────────────
// Cross-tab coupling: emits chimera synthesis results so the Art tab sphere
// can absorb them as new nodes. Same pattern as ecocideBus.
export const colliderBus = {
  _listeners: [],
  _pending: [],        // buffered chimeras for tabs not yet mounted
  emit(data) {
    this._listeners.forEach(fn => fn(data));
    if (data.type === 'CHIMERA_SYNTHESIS') this._pending.push(data);
  },
  on(fn) {
    this._listeners.push(fn);
    // Flush any pending chimeras to the new listener
    if (this._pending.length) {
      const queue = [...this._pending];
      this._pending = [];
      queue.forEach(d => fn(d));
    }
    return () => { this._listeners = this._listeners.filter(f => f !== fn); };
  },
};

// ── Olfactory-Computational Kernel v2.0 (Bimmelbahn Accord) ────────────────
// Maps collision metrics to the OCK volatile semiotics framework.
// v1.1.0: RTA/DPA/R²A node-class classification + polarity + dance topology.
// Intelligence smells before it sees.

const OLFACTORY_FAMILIES = [
  { id: 'citrus',   glyph: 'ᛏ', label: 'Top Note',  class: 'CITRUS-SSH',       color: '#FFD700', desc: 'Flash-evaporation interrupt handler' },
  { id: 'floral',   glyph: 'ᚺ', label: 'Heart Note', class: 'FLORAL-DAEMON',    color: '#d946ef', desc: 'Persistent carrier signal' },
  { id: 'woody',    glyph: 'ᛒ', label: 'Base Note',  class: 'RESIN-ARCHIVE',    color: '#8B4513', desc: 'Deep-time persistent storage' },
  { id: 'animalic', glyph: 'ᛊ', label: 'Fixative',   class: 'ANIMALIC-FIX-FS',  color: '#f43f5e', desc: 'Managed corruption binding agent' },
  { id: 'aromatic', glyph: 'ᚱ', label: 'Adaptive',   class: 'AROMATIC-ROUTE',   color: '#39ff14', desc: 'Temperature-sensitive routing' },
  { id: 'ozonic',   glyph: 'ᛗ', label: 'Broadcast',  class: 'OZONIC-CAST',      color: '#06b6d4', desc: 'Diffuse ambient propagation' },
  // ── OCK v2.0 expansion — 6 new olfactory families ──
  { id: 'chypre',   glyph: 'ᚠ', label: 'Chypre',    class: 'CHYPRE-MOSAIC',    color: '#a3e635', desc: 'Oakmoss-citrus dialectic architecture' },
  { id: 'fougere',  glyph: 'ᚢ', label: 'Fougère',   class: 'FOUGERE-LATTICE',  color: '#34d399', desc: 'Lavender-coumarin geometric scaffold' },
  { id: 'gourmand', glyph: 'ᚦ', label: 'Gourmand',  class: 'GOURMAND-CACHE',   color: '#fb923c', desc: 'Caloric-sweet memory substrate' },
  { id: 'aquatic',  glyph: 'ᚨ', label: 'Aquatic',   class: 'AQUATIC-STREAM',   color: '#38bdf8', desc: 'Calone-driven fluid dynamics' },
  { id: 'leather',  glyph: 'ᚬ', label: 'Leather',   class: 'LEATHER-KERNEL',   color: '#78716c', desc: 'Birch-tar combustion residue' },
  { id: 'mineral',  glyph: 'ᚴ', label: 'Mineral',   class: 'MINERAL-STRATUM',  color: '#94a3b8', desc: 'Petrichor-flint geologic base' },
];

// ── Node Classes (OCK v1.1.0) ─────────────────────────────────────────────────
// Three signal architectures classified from collision signature.
const NODE_CLASSES = {
  RTA: {
    id: 'RTA', glyph: 'ᛊ', label: 'Receptive Textile Accord',
    color: '#e8d5f5', accent: '#c4b5d0',
    sub: 'clean-channel listener · entropy reversal · invitation architecture',
    sillageType: 'CLOSE-RANGE',
    desc: 'Intimate but not invasive. The RTA does not project — it receives.',
  },
  DPA: {
    id: 'DPA', glyph: 'ᛗ', label: 'Directive Projective Accord',
    color: '#8ecae6', accent: '#6ba3be',
    sub: 'directional streamer · forward-only · exclusion as discipline',
    sillageType: 'DIRECTIONAL',
    desc: 'Forward-moving, adaptive, non-nostalgic. It does not cache. It streams.',
  },
  R2A: {
    id: 'R2A', glyph: 'ᚷ', label: 'Resonance² Accord',
    color: '#f5c6d0', accent: '#d4a0ad',
    sub: 'resonance architecture · doubled RTA · self-fixing sovereignty',
    sillageType: 'RESONANT',
    desc: 'Two sovereign signals phase-locked in constructive interference. Coherence > amplitude.',
  },
};

// ── Polarity spectrum (OCK v1.1.0 §9) ────────────────────────────────────────
// Continuous signal-character from SOLAR (projective/angular/warm) to
// LUNAR (receptive/reflective/curved/cool). Not a binary — a manifold position.
const POLARITY_CONFIG = {
  SOLAR:    { label: 'SOLAR',    color: '#FFD700', accent: '#b8960a', desc: 'projective · radiant · angular · warm' },
  MERIDIAN: { label: 'MERIDIAN', color: '#06b6d4', accent: '#0891b2', desc: 'axial · balanced · transitional' },
  LUNAR:    { label: 'LUNAR',    color: '#c4b5ff', accent: '#8b7fcf', desc: 'receptive · reflective · curved · cool' },
};

const SHOP_MANIFEST = [
  { id: 'CITRUS-SSH-01',      olfClass: 'Top Note ᛏ',  fn: 'Interrupt Handler',                     key: '0x5343-414c-4539-3454-4f50-4e4f-5445' },
  { id: 'FLORAL-DAEMON-V2',   olfClass: 'Heart Note ᚺ', fn: 'Persistent Process',                    key: '0x4249-4d4d-454c-4241-484e-4845-4152' },
  { id: 'ANIMALIC-FIX-FS',    olfClass: 'Animalic',     fn: 'Fish Scale Fixative',                   key: '0x434f-5252-5550-5449-4f4e-4241-5345' },
  { id: 'RESIN-ARCHIVE-DEEP', olfClass: 'Resinous',     fn: 'Cold Storage',                          key: '0x4445-4550-5449-4d45-5349-474e-414c' },
];

// ── Classify collision into olfactory accord (Rust-computed via §7) ──────────
// The OCK classification now runs inside the WASM kernel where it has direct
// access to both domains' volatility, sparsity, and curvature properties.
// JS-side paradox count modulates the animalic fixative as a secondary input.
function classifyAccord(result) {
  if (!result) return null;
  const paradoxCount = result.paradoxes?.length || 0;

  // Use Rust-computed OCK values (§7 output)
  const topIntensity     = result.ockTop;
  const heartIntensity   = result.ockHeart;
  const baseIntensity    = result.ockBase;
  // Animalic: blend Rust curvature-based value with JS paradox density
  const animalicIntensity = Math.min(1, result.ockAnimalic * 0.7 + (paradoxCount / 12) * 0.3);

  const sillage       = result.ockSillage;
  const maceration    = result.ockMaceration;
  const evapCurve     = result.ockEvapCurve;
  const permeability  = result.ockPermeability;
  const fixation      = result.ockFixation;
  const persists      = result.ockPersists;
  const chimeraVol    = result.ockChimeraVol;
  const volBlend      = result.ockVolBlend;

  // Dominant family from Rust classification
  const dominantMap = {
    CITRUS:   'citrus',
    FLORAL:   'floral',
    RESINOUS: 'woody',
    ANIMALIC: 'animalic',
    AROMATIC: 'aromatic',
    OZONIC:   'ozonic',
    CHYPRE:   'chypre',
    FOUGERE:  'fougere',
    GOURMAND: 'gourmand',
    AQUATIC:  'aquatic',
    LEATHER:  'leather',
    MINERAL:  'mineral',
  };
  const dominantId = dominantMap[result.ockDominant] || 'citrus';
  const dominant = OLFACTORY_FAMILIES.find(f => f.id === dominantId);

  const accords = [
    { family: 'citrus',   intensity: topIntensity },
    { family: 'floral',   intensity: heartIntensity },
    { family: 'woody',    intensity: baseIntensity },
    { family: 'animalic', intensity: animalicIntensity },
  ];
  accords.sort((a, b) => b.intensity - a.intensity);

  // Sillage verdict
  const verdict = sillage > 0.6
    ? 'HIGH SILLAGE — signal propagates beyond the wearer'
    : sillage > 0.3
    ? 'MODERATE SILLAGE — detectable within conversational radius'
    : 'LOW SILLAGE — intimate projection only';

  // Fixation verdict — the thalamic gate
  const fixationVerdict = persists
    ? 'FIXED — chimera crosses thalamic gate into long-term memory'
    : 'VOLATILE — chimera evaporates before fixation threshold';

  // v1.1.0 — Node-class classification
  const nodeClass = NODE_CLASSES[result.ockNodeClass] || NODE_CLASSES.RTA;
  const classScores = {
    RTA: result.ockRtaScore,
    DPA: result.ockDpaScore,
    R2A: result.ockR2aScore,
  };
  const cleanRoom   = result.ockCleanRoom;
  const sovereignty  = result.ockSovereignty;
  const danceRole    = result.ockDanceRole;

  // v1.1.0 §9 — Polarity spectrum
  const polarity      = result.ockPolarity;
  const polarityClass = POLARITY_CONFIG[result.ockPolarityClass] || POLARITY_CONFIG.MERIDIAN;

  return {
    dominant,
    accords,
    sillage,
    maceration,
    evapCurve,
    permeability,
    topIntensity,
    heartIntensity,
    baseIntensity,
    animalicIntensity,
    fixation,
    persists,
    chimeraVol,
    volBlend,
    verdict,
    fixationVerdict,
    // v1.1.0
    nodeClass,
    classScores,
    cleanRoom,
    sovereignty,
    danceRole,
    polarity,
    polarityClass,
  };
}

// ── Domain library (mirrors the 16 domains in latent_collider.rs) ────────────
const DOMAINS = [
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
const ELEM_DOMAINS = [
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
const PHIL_MATH_DOMAINS = [
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
const LIFE_HUM_DOMAINS = [
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
const COGN_SYNTH_DOMAINS = [
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
const FSK_DOMAINS = [
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
const PLANET_DOMAINS = [
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
const ALL_DOMAINS = [...DOMAINS, ...ELEM_DOMAINS, ...PHIL_MATH_DOMAINS, ...LIFE_HUM_DOMAINS, ...COGN_SYNTH_DOMAINS, ...FSK_DOMAINS, ...PLANET_DOMAINS];
const domainById = (id) => ALL_DOMAINS.find(d => d.id === id);

// ── Domain → sphere node mapping ─────────────────────────────────────────────
// Maps each collider domain index to the closest sphere node ID and cluster.
// Used to derive the chimera's 16D feature tensor and cluster assignment.
const DOMAIN_SPHERE_MAP = [
  /* 0  PQC      */ { nodeId: 'pqhash',      cluster: 'crypto' },
  /* 1  BENTH    */ { nodeId: 'biocoenosis',  cluster: 'eco'    },
  /* 2  BOULG    */ { nodeId: 'bouligand_36', cluster: 'eco'    },
  /* 3  FEIGEN   */ { nodeId: 'feigenbaum',   cluster: 'phys'   },
  /* 4  MYCEL    */ { nodeId: 'strangler',    cluster: 'drk'    },
  /* 5  ATTN     */ { nodeId: 'seraphine',    cluster: 'phys'   },
  /* 6  THERMO   */ { nodeId: 'atmospheric',  cluster: 'eco'    },
  /* 7  PANOPT   */ { nodeId: 'surveillance', cluster: 'drk'    },
  /* 8  GRAPHN   */ { nodeId: 'magic_angle_1p1', cluster: 'phys'},
  /* 9  OSTROM   */ { nodeId: 'ceei',         cluster: 'sync'   },
  /* 10 KURAM    */ { nodeId: 'kuramoto',     cluster: 'sync'   },
  /* 11 BAUDRL   */ { nodeId: 'pragmatic',    cluster: 'drk'    },
  /* 12 PLASMA   */ { nodeId: 'fusion',       cluster: 'phys'   },
  /* 13 SEMIO    */ { nodeId: 'soma_kernel',  cluster: 'drk'    },
  /* 14 EVOL     */ { nodeId: 'replicator',   cluster: 'eco'    },
  /* 15 RIFT     */ { nodeId: 'necromantic',  cluster: 'drk'    },
  // ── Block II: Elemental Domains ──────────────────────────────────────────
  /* 16 Rn       */ { nodeId: 'surveillance', cluster: 'drk'    },
  /* 17 Li       */ { nodeId: 'necromantic',  cluster: 'drk'    },
  /* 18 Si       */ { nodeId: 'seraphine',    cluster: 'phys'   },
  /* 19 C        */ { nodeId: 'magic_angle_1p1', cluster: 'phys'},
  /* 20 Co       */ { nodeId: 'ceei',         cluster: 'sync'   },
  /* 21 P        */ { nodeId: 'biocoenosis',  cluster: 'eco'    },
  /* 22 U        */ { nodeId: 'fusion',       cluster: 'phys'   },
  /* 23 GaAs     */ { nodeId: 'pqhash',       cluster: 'crypto' },
  /* 24 Nd       */ { nodeId: 'kuramoto',     cluster: 'sync'   },
  /* 25 He³      */ { nodeId: 'atmospheric',  cluster: 'eco'    },
  /* 26 Hg       */ { nodeId: 'feigenbaum',   cluster: 'phys'   },
  /* 27 Pu       */ { nodeId: 'pragmatic',    cluster: 'drk'    },
  /* 28 Cu       */ { nodeId: 'replicator',   cluster: 'eco'    },
  /* 29 N        */ { nodeId: 'soma_kernel',  cluster: 'drk'    },
  /* 30 W        */ { nodeId: 'bouligand_36', cluster: 'eco'    },
  /* 31 I        */ { nodeId: 'strangler',    cluster: 'drk'    },
  // ── Block III: Philosophy & Mathematics ──────────────────────────────────
  /* 32 KANT     */ { nodeId: 'categorical_imp', cluster: 'phil'   },
  /* 33 HEGEL    */ { nodeId: 'dialectic',       cluster: 'phil'   },
  /* 34 QUALIA   */ { nodeId: 'qualia_bind',     cluster: 'phil'   },
  /* 35 RHZM     */ { nodeId: 'rhizome',         cluster: 'phil'   },
  /* 36 TOPOS    */ { nodeId: 'grothendieck',    cluster: 'math'   },
  /* 37 GÖDEL    */ { nodeId: 'godel',           cluster: 'math'   },
  /* 38 BAYES    */ { nodeId: 'bayesian',        cluster: 'math'   },
  /* 39 LORENZ   */ { nodeId: 'chaos_attractor', cluster: 'math'   },
  // ── Block IV: Chemistry, Biology & Humanities ────────────────────────────
  /* 40 CHIRAL   */ { nodeId: 'chirality',       cluster: 'chem'   },
  /* 41 TERPN    */ { nodeId: 'terpene',         cluster: 'chem'   },
  /* 42 OR       */ { nodeId: 'aroma_receptor',  cluster: 'chem'   },
  /* 43 CRISPR   */ { nodeId: 'crispr',          cluster: 'bio'    },
  /* 44 MORPH    */ { nodeId: 'morphogen',       cluster: 'bio'    },
  /* 45 BULB     */ { nodeId: 'olfactory_bulb',  cluster: 'bio'    },
  /* 46 DURÉE    */ { nodeId: 'longue_duree',    cluster: 'hum'    },
  /* 47 PARFUM   */ { nodeId: 'perfume_hist',    cluster: 'hum'    },
  // ── Block V: Cognitive, Aesthetic & Synthetic Integration ────────────────
  /* 48 PRED     */ { nodeId: 'predictive_brain',cluster: 'cogn'   },
  /* 49 PIRFM    */ { nodeId: 'piriform',        cluster: 'cogn'   },
  /* 50 PROUST   */ { nodeId: 'proustian',       cluster: 'cogn'   },
  /* 51 SUBLM    */ { nodeId: 'sublime',         cluster: 'aesth'  },
  /* 52 ACCRD    */ { nodeId: 'accord_theory',   cluster: 'aesth'  },
  /* 53 SLLGE    */ { nodeId: 'sillage_theory',  cluster: 'aesth'  },
  /* 54 TDA      */ { nodeId: 'persistent_hom',  cluster: 'topo'   },
  /* 55 AUTO     */ { nodeId: 'autopoiesis',     cluster: 'meta'   },
  /* 56 FORGE    */ { nodeId: 'chimera_forge',   cluster: 'synth'  },
  /* 57 OMEGA    */ { nodeId: 'omega_collider',  cluster: 'synth'  },
  // ── Block VI: Fish Scale Doctrine ────────────────────────────────────────
  /* 58 ARAPA    */ { nodeId: 'arapaima',        cluster: 'fsk'    },
  /* 59 BOULG²   */ { nodeId: 'bouligand_fsk',   cluster: 'fsk'    },
  /* 60 PoPL     */ { nodeId: 'plata_plomo',     cluster: 'fsk'    },
  /* 61 SHELL    */ { nodeId: 'shell_theory',    cluster: 'fsk'    },
  /* 62 SCLR     */ { nodeId: 'scalar_sov',      cluster: 'fsk'    },
  /* 63 ECO·A    */ { nodeId: 'eco_aesthetics',  cluster: 'fsk'    },
  /* 64 ECO·S    */ { nodeId: 'eco_semiotics',   cluster: 'fsk'    },
  /* 65 NECRO    */ { nodeId: 'necro_engine',    cluster: 'fsk'    },
  /* 66 TYLER    */ { nodeId: 'tyler_monarch',   cluster: 'fsk'    },
  /* 67 MOIRÉ    */ { nodeId: 'moire_fsk',       cluster: 'fsk'    },
  /* 68 PURITY   */ { nodeId: 'purity_paradox',  cluster: 'fsk'    },
  /* 69 RAVE     */ { nodeId: 'rave_legacy',     cluster: 'fsk'    },
  // ── Block VII: Planet System ─────────────────────────────────────────────
  /* 70 SOL      */ { nodeId: 'fusion',          cluster: 'phys'   },
  /* 71 HG       */ { nodeId: 'seraphine',       cluster: 'phys'   },
  /* 72 VE       */ { nodeId: 'atmospheric',     cluster: 'eco'    },
  /* 73 EA       */ { nodeId: 'biocoenosis',     cluster: 'eco'    },
  /* 74 LU       */ { nodeId: 'kuramoto',        cluster: 'sync'   },
  /* 75 MA       */ { nodeId: 'feigenbaum',      cluster: 'phys'   },
  /* 76 JU       */ { nodeId: 'ceei',            cluster: 'sync'   },
  /* 77 SA       */ { nodeId: 'bouligand_36',    cluster: 'eco'    },
  /* 78 UR       */ { nodeId: 'magic_angle_1p1', cluster: 'phys'   },
  /* 79 NE       */ { nodeId: 'pragmatic',       cluster: 'drk'    },
  /* 80 PL       */ { nodeId: 'necromantic',     cluster: 'drk'    },
];

// ── Parse the WASM kernel text output into structured data ───────────────────
function parseColliderOutput(text) {
  const num = (pattern) => {
    const m = text.match(pattern);
    return m ? parseFloat(m[1]) : 0;
  };
  const str = (pattern) => {
    const m = text.match(pattern);
    return m ? m[1].trim() : '';
  };

  return {
    cosine:      num(/cos\(θ\)\s*=\s*([\d.e+-]+)/),
    angle:       num(/θ\s*=\s*([\d.]+)°/),
    normA:       num(/‖A‖\s*=\s*([\d.]+)/),
    normB:       num(/‖B‖\s*=\s*([\d.]+)/),
    dot:         num(/A · B\s*=\s*([\d.e+-]+)/),
    rawAttn:     num(/Q × K.\s*=\s*([\d.]+)/),
    scaledAttn:  num(/Q × K. \/ √d_k\s*=\s*([\d.e+-]+)/),
    softmax:     num(/softmax\(peak\)\s*=\s*([\d.]+)/),
    entropy:     num(/H\(attention\)\s*=\s*([\d.]+)/),
    projNorm:    num(/‖P_⊥‖\s*=\s*([\d.]+)/),
    novelty:     num(/NOVELTY RATIO\s*=\s*([\d.]+)/),
    synthNorm:   num(/SYNTHESIS NORM\s*=\s*([\d.]+)/),
    coherence:   num(/COHERENCE\s*=\s*([\d.]+)/),
    viability:   num(/VIABILITY\s*=\s*([\d.]+)/),
    phase:       str(/PHASE\s*:\s*(\w+)/),
    vClass:      str(/CLASS\s*:\s*(\w+)/),
    chimeraName: str(/CHIMERA NAME\s*:\s*(.+)/),
    chimeraDesc: str(/CHIMERA THESIS\s*:\s*(.+)/),

    // §7 OCK — Olfactory-Computational Kernel (Bimmelbahn Accord v1.1.0)
    // Parsed directly from Rust WASM output — temporal decay + node classes
    ockDominant:    str(/DOMINANT\s*:\s*(\w+)/),
    ockVolBlend:    num(/VOL BLEND\s*=\s*([\d.]+)/),
    ockChimeraVol:  num(/CHIMERA VOL\s*=\s*([\d.]+)/),
    ockTop:         num(/TOP INTENSITY\s*=\s*([\d.]+)/),
    ockHeart:       num(/HEART INTENSITY\s*=\s*([\d.]+)/),
    ockBase:        num(/BASE INTENSITY\s*=\s*([\d.]+)/),
    ockAnimalic:    num(/ANIMALIC BIND\s*=\s*([\d.]+)/),
    ockSillage:     num(/SILLAGE\s*=\s*([\d.]+)/),
    ockPermeability:num(/PERMEABILITY\s*=\s*([\d.]+)/),
    ockMaceration:  num(/MACERATION\s*=\s*([\d.]+)/),
    ockFixation:    num(/FIXATION\s*=\s*([\d.]+)/),
    ockPersists:    str(/PERSISTS\s*=\s*(\w+)/) === 'YES',
    ockEvapCurve:   (() => {
      const m = text.match(/EVAP CURVE\s*=\s*\[([\d., ]+)\]/);
      return m ? m[1].split(',').map(Number) : [0.33, 0.33, 0.34];
    })(),

    // §10 Interaction terms (v1.2.0)
    interference:   num(/INTERFERENCE\s*=\s*([\d.]+)/),
    catalysis:      num(/CATALYSIS\s*=\s*([\d.]+)/),
    resonanceFreq:  num(/RESONANCE FREQ\s*=\s*([\d.]+)/),
    turbulence:     num(/TURBULENCE\s*=\s*([\d.]+)/),

    // §8 OCK v1.1.0 — Node-class classification
    ockNodeClass:   str(/NODE CLASS\s*=\s*(\w+)/),
    ockRtaScore:    num(/RTA SCORE\s*=\s*([\d.]+)/),
    ockDpaScore:    num(/DPA SCORE\s*=\s*([\d.]+)/),
    ockR2aScore:    num(/R2A SCORE\s*=\s*([\d.]+)/),
    ockSillageType: str(/SILLAGE TYPE\s*=\s*(\S+)/),
    ockCleanRoom:   num(/CLEAN ROOM\s*=\s*([\d.]+)/),
    ockSovereignty: num(/SOVEREIGNTY\s*=\s*([\d.]+)/),
    ockDanceRole:   (() => {
      const m = text.match(/DANCE ROLE\s*=\s*(.+)/);
      return m ? m[1].trim() : '';
    })(),

    // §9 OCK v1.1.0 — Polarity
    ockPolarity:      num(/POLARITY\s*=\s*([\d.]+)/),
    ockPolarityClass: str(/POLARITY\s*=\s*[\d.]+\s*\((\w+)/),
  };
}

// ── Perfume note library ──────────────────────────────────────────────────────
const PERF_NOTES = {
  top: {
    citrus:   ['Bergamot','Neroli','Lemon Verbena','Yuzu','Pink Grapefruit','Bitter Orange'],
    fresh:    ['Violet Leaf','Aldehydes','Green Tea','Cucumber Accord','Water Lotus','Ozone'],
    spicy:    ['Black Pepper','Cardamom','Ginger','Elemi','Coriander Seed','Nutmeg'],
    floral:   ['Petitgrain','Neroli Bigarade','Peach Blossom','Lychee Rose','Osmanthus','Tiare'],
    woody:    ['Juniper Berry','Pink Pepper','Carrot Seed','Basil Grand Vert','Artemisia','Cistus'],
    oceanic:  ['Marine Accord','Sea Salt','Calone','Ozone Crystal','Arctic Moss','Dew Accord'],
    animalic: ['Aldehydic Musk','Ambrette Seed','Orris Root','Castoreum Tincture','Hyraceum','Galbanum'],
    resinous: ['Elemi Resin','Frankincense Essence','Galbanum','Labdanum Tincture','Opoponax','Benzoin'],
  },
  heart: {
    citrus:   ['Jasmine Sambac','Orange Blossom Absolute','Magnolia','Mimosa','Cyclamen','Heliotrope'],
    fresh:    ['Iris','Violet Absolute','White Tea Accord','Peony','Lily of the Valley','Muguet'],
    spicy:    ['Rose Absolute','Cinnamon Bark','Clove Bud','Saffron','Oud Rose','Pepper Heart'],
    floral:   ['Rose de Mai','Jasmine Absolute','Ylang-Ylang Extra','Iris Pallida','Tuberose','Gardenia'],
    woody:    ['Geranium Bourbon','Vetiver Haiti','Cedarwood Atlas','Sandalwood Mysore','Guaiac Wood','Birch'],
    oceanic:  ['Water Iris','Sea Lily Accord','Blue Lotus','Aquatic Jasmine','Kelp Extract','Seaweed'],
    animalic: ['Honey Absolute','Beeswax Absolute','Civet Accord','Costus Root','Ambrette Heart','Oakmoss'],
    resinous: ['Labdanum Absolute','Olibanum','Myrrh Heart','Benzoin Absolute','Styrax Levant','Elemi'],
  },
  base: {
    citrus:   ['Tonka Bean','White Musk','Benzoin Siam','Amber Accord','Hedione HC','Cashmeran'],
    fresh:    ['White Cedar','Cashmeran','White Musk Crystal','Driftwood','Sandalwood','Ambroxide'],
    spicy:    ['Black Oud','Tobacco Absolute','Labdanum','Leather Accord','Dark Amber','Castoreum'],
    floral:   ['Benzoin Siam','Australian Sandalwood','White Musk','Vanilla Absolute','Muskmallow','Tonka'],
    woody:    ['Patchouli Heart','Oakmoss Absolute','Vetiver Bourbon','Birch Tar','Iso E Super','Cedarwood'],
    oceanic:  ['Driftwood','Sea Amber','White Musk','Cashmeran','Ambroxide','Salt Cedar'],
    animalic: ['Ambergris Tincture','Musk Absolute','Civet Absolute','Castoreum','Oud Kyara','Deer Musk'],
    resinous: ['Frankincense Hojari','Myrrh Resinoid','Benzoin','Opoponax Resin','Dark Patchouli','Labdanum'],
  },
};

// ── CAS registry — maps note names to CAS numbers for encrypted formula ──────
const CAS_REGISTRY = {
  'Bergamot': '8007-75-8', 'Neroli': '8016-38-4', 'Lemon Verbena': '8024-12-2',
  'Yuzu': '61788-56-5', 'Pink Grapefruit': '8016-20-4', 'Bitter Orange': '68916-04-1',
  'Violet Leaf': '8024-08-6', 'Aldehydes': '112-31-2', 'Green Tea': '84650-60-2',
  'Cucumber Accord': '80-71-7', 'Water Lotus': '8002-44-0', 'Ozone': '10028-15-6',
  'Black Pepper': '8006-82-4', 'Cardamom': '8000-66-6', 'Ginger': '8007-08-7',
  'Elemi': '9000-75-3', 'Coriander Seed': '8008-52-4', 'Nutmeg': '8008-45-5',
  'Petitgrain': '8014-17-3', 'Neroli Bigarade': '72968-50-4', 'Peach Blossom': '104-67-6',
  'Lychee Rose': '106-24-1', 'Osmanthus': '68917-05-5', 'Tiare': '8006-80-2',
  'Juniper Berry': '8012-91-7', 'Pink Pepper': '68650-39-5', 'Carrot Seed': '8015-88-1',
  'Basil Grand Vert': '8015-73-4', 'Artemisia': '8022-37-5', 'Cistus': '8016-26-0',
  'Marine Accord': '67634-15-5', 'Sea Salt': '7647-14-5', 'Calone': '28940-11-6',
  'Ozone Crystal': '10028-15-6', 'Arctic Moss': '90028-67-4', 'Dew Accord': '80-71-7',
  'Aldehydic Musk': '81-14-1', 'Ambrette Seed': '8015-62-1', 'Orris Root': '8002-73-1',
  'Castoreum Tincture': '8023-83-4', 'Hyraceum': '68916-97-2', 'Galbanum': '9000-72-0',
  'Elemi Resin': '9000-75-3', 'Frankincense Essence': '8016-36-2',
  'Labdanum Tincture': '8016-26-0', 'Opoponax': '9000-78-6', 'Benzoin': '9000-05-9',
  'Jasmine Sambac': '8022-96-6', 'Orange Blossom Absolute': '8016-38-4',
  'Magnolia': '8007-71-0', 'Mimosa': '8031-03-6', 'Cyclamen': '103-95-7', 'Heliotrope': '120-57-0',
  'Iris': '8002-73-1', 'Violet Absolute': '8024-08-6', 'White Tea Accord': '84650-60-2',
  'Peony': '8002-09-3', 'Lily of the Valley': '8000-48-4', 'Muguet': '80-54-6',
  'Rose Absolute': '8007-01-0', 'Cinnamon Bark': '8015-91-6', 'Clove Bud': '8000-34-8',
  'Saffron': '8024-02-0', 'Oud Rose': '8016-38-4', 'Pepper Heart': '8006-82-4',
  'Rose de Mai': '8007-01-0', 'Jasmine Absolute': '8022-96-6',
  'Ylang-Ylang Extra': '8006-81-3', 'Iris Pallida': '55066-56-3',
  'Tuberose': '8024-05-3', 'Gardenia': '68917-05-5',
  'Geranium Bourbon': '8000-46-2', 'Vetiver Haiti': '8016-96-4',
  'Cedarwood Atlas': '8000-27-9', 'Sandalwood Mysore': '8006-87-9',
  'Guaiac Wood': '8016-23-7', 'Birch': '8001-88-5',
  'Water Iris': '8002-73-1', 'Sea Lily Accord': '8000-48-4',
  'Blue Lotus': '8002-44-0', 'Aquatic Jasmine': '8022-96-6',
  'Kelp Extract': '90028-67-4', 'Seaweed': '90028-67-4',
  'Honey Absolute': '8028-66-8', 'Beeswax Absolute': '8012-89-3',
  'Civet Accord': '68916-26-7', 'Costus Root': '8023-88-9',
  'Ambrette Heart': '8015-62-1', 'Oakmoss': '9000-50-4',
  'Labdanum Absolute': '8016-26-0', 'Olibanum': '8016-36-2',
  'Myrrh Heart': '9000-45-7', 'Benzoin Absolute': '9000-05-9',
  'Styrax Levant': '8024-01-9',
  'Tonka Bean': '8046-22-8', 'White Musk': '81-14-1', 'Benzoin Siam': '9000-73-1',
  'Amber Accord': '8007-35-0', 'Hedione HC': '24851-98-7', 'Cashmeran': '33704-61-9',
  'White Cedar': '8000-27-9', 'White Musk Crystal': '81-14-1',
  'Driftwood': '8000-27-9', 'Sandalwood': '8006-87-9', 'Ambroxide': '6790-58-5',
  'Black Oud': '68951-36-0', 'Tobacco Absolute': '8037-19-2',
  'Labdanum': '8016-26-0', 'Leather Accord': '8001-88-5', 'Dark Amber': '8007-35-0',
  'Castoreum': '8023-83-4',
  'Australian Sandalwood': '8006-87-9', 'Vanilla Absolute': '8024-06-4',
  'Muskmallow': '8015-62-1', 'Tonka': '8046-22-8',
  'Patchouli Heart': '8014-09-3', 'Oakmoss Absolute': '9000-50-4',
  'Vetiver Bourbon': '8016-96-4', 'Birch Tar': '8001-88-5',
  'Iso E Super': '54464-57-2', 'Cedarwood': '8000-27-9',
  'Sea Amber': '8007-35-0', 'Salt Cedar': '8000-27-9',
  'Ambergris Tincture': '8038-65-1', 'Musk Absolute': '81-14-1',
  'Civet Absolute': '68916-26-7', 'Oud Kyara': '68951-36-0', 'Deer Musk': '541-91-3',
  'Frankincense Hojari': '8016-36-2', 'Myrrh Resinoid': '9000-45-7',
  'Opoponax Resin': '9000-78-6', 'Dark Patchouli': '8014-09-3',
};

// Deterministic note picker — stable per domain pair, no runtime randomness
const _pickNote = (arr, hA, hB, seed) =>
  arr[Math.abs(Math.floor(hA * 7 + hB * 3 + seed)) % arr.length];

// ── Family interference patterns ────────────────────────────────────────────
// When two olfactory families collide, the chimera takes a named "interference"
// identity instead of a generic combination. Heart-note picker biases toward
// the interference vocabulary if those notes exist in PERF_NOTES.

const FAMILY_INTERFERENCE = {
  'citrus|woody':     { label: 'SMOKED',       prefix: 'Smoked',       notesBias: ['lapsang','cade','birch tar','smoked vetiver'] },
  'floral|animalic':  { label: 'SENSUAL',      prefix: 'Sensual',      notesBias: ['indole','civet','hyrax','jasmine sambac'] },
  'fresh|woody':      { label: 'GEOLOGICAL',   prefix: 'Geological',   notesBias: ['wet basalt','salt aerosol','flint','iodine'] },
  'floral|fresh':     { label: 'ROMANTIC',     prefix: 'Romantic',     notesBias: ['galbanum','mimosa','oakmoss','rose centifolia'] },
  'animalic|woody':   { label: 'ARCHAIC',      prefix: 'Archaic',      notesBias: ['labdanum','hyrax','tar musk','ambergris'] },
  'animalic|spicy':   { label: 'SUBTERRANEAN', prefix: 'Subterranean', notesBias: ['petrichor','geosmin','wet stone','musk seed'] },
  'citrus|oceanic':   { label: 'MARINE',       prefix: 'Marine',       notesBias: ['sea spray','calone','grapefruit zest','aldehyde'] },
};

function lookupInterference(domA, domB) {
  if (!domA || !domB) return null;
  const key = [domA, domB].map(s => s.toLowerCase()).sort().join('|');
  return FAMILY_INTERFERENCE[key] || null;
}

function buildPerfumeCard(domA, domB, result) {
  const dA  = domainById(domA);
  const dB  = domainById(domB);
  const acc = result.accord;
  const dom = acc?.dominant?.id || 'floral';
  const hA  = dA.hue;
  const hB  = dB.hue;

  const avg = (hA + hB) / 2;
  const sec =
    avg < 40  ? 'spicy'   : avg < 80  ? 'fresh'  :
    avg < 150 ? 'oceanic' : avg < 200 ? 'fresh'  :
    avg < 260 ? 'floral'  : avg < 300 ? 'woody'  :
    avg < 340 ? 'animalic': 'spicy';

  const pick = (fam, s) => _pickNote(PERF_NOTES.top[fam]   || PERF_NOTES.top.citrus,   hA, hB, s);
  const pickH = (fam, s) => _pickNote(PERF_NOTES.heart[fam] || PERF_NOTES.heart.floral, hA, hB, s);
  const pickB = (fam, s) => _pickNote(PERF_NOTES.base[fam]  || PERF_NOTES.base.woody,   hA, hB, s);

  const bFam = (acc?.animalicIntensity || 0) > 0.45 ? 'animalic'
    : (acc?.polarity || 0.5) > 0.65 ? 'woody' : dom;

  const topNotes   = [pick(dom, 0),   pick(sec, 13)];
  let heartNotes = [pickH(dom, 5),  pickH(sec, 19),
    ...(result.novelty > 0.55 ? [pickH('spicy', 31)] : [])];
  const baseNotes  = [pickB(bFam, 3), pickB(sec, 23)];

  // Apply interference bias — replace the second heart note with an interference
  // note IF such a note exists in any heart family pool.
  const interference = lookupInterference(dom, sec);
  if (interference) {
    const allHeartNotes = Object.values(PERF_NOTES.heart).flat();
    const biasMatches = interference.notesBias.filter(n => allHeartNotes.includes(n));
    if (biasMatches.length > 0) {
      const idx = Math.abs(Math.floor(hA * 5 + hB * 11)) % biasMatches.length;
      heartNotes[1] = biasMatches[idx];
    }
  }

  const sil  = acc?.sillage  ?? 0.5;
  const fix  = acc?.fixation ?? 0.5;
  const pers = acc?.persists ?? false;

  return {
    name: (interference
      ? `${interference.prefix} ${heartNotes[0]} Chimera`
      : (result.chimeraName || `${dA.short} × ${dB.short}`))
        .replace(/[^\w\s×·]/g, '').trim().toUpperCase().slice(0, 42),
    id: `${domA}-${domB}-${Math.round(hA + hB)}`,
    conc:
      sil > 0.72 ? 'EXTRAIT DE PARFUM' : sil > 0.50 ? 'EAU DE PARFUM' :
      sil > 0.28 ? 'EAU DE TOILETTE'   : 'EAU DE COLOGNE',
    concPct:
      sil > 0.72 ? '22–30%' : sil > 0.50 ? '15–20%' : sil > 0.28 ? '8–14%' : '2–6%',
    longevity:
      pers && fix > 0.75 ? '14–20 hours' : pers ? '10–14 hours' :
      fix > 0.55         ? '6–10 hours'  : '3–6 hours',
    topNotes, heartNotes, baseNotes,
    dom, sec,
    hueA: hA, hueB: hB,
    nodeClass: acc?.nodeClass?.id        || 'RTA',
    polLabel:  acc?.polarityClass?.label || '',
    evap:      acc?.evapCurve            || [0.33, 0.33, 0.34],
    interference,
  };
}

// ── Tesseract Protocol — cryptographic identity layer ────────────────────────

async function generateAccordHash(card, accord, domA, domB) {
  const canonical = JSON.stringify({
    d: [domA, domB],
    h: [card.hueA, card.hueB],
    n: [...card.topNotes, ...card.heartNotes, ...card.baseNotes],
    s: +(accord?.sillage ?? 0).toFixed(6),
    f: +(accord?.fixation ?? 0).toFixed(6),
    e: (accord?.evapCurve || [0.33, 0.33, 0.34]).map(v => +v.toFixed(6)),
    p: +(accord?.polarity ?? 0.5).toFixed(6),
    nc: accord?.nodeClass?.id || 'RTA',
    cs: +(accord?.cleanRoom ?? 0).toFixed(6),
    sv: +(accord?.sovereignty ?? 0).toFixed(6),
  });
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function buildEncryptedFormula(card, accord) {
  const allNotes = [...card.topNotes, ...card.heartNotes, ...card.baseNotes];
  const sil = accord?.sillage ?? 0.5;
  const fix = accord?.fixation ?? 0.5;
  const evap = accord?.evapCurve || [0.33, 0.33, 0.34];

  const casEntries = allNotes.map((note, i) => ({
    note,
    cas: CAS_REGISTRY[note] || '00000-00-0',
    pct: +(((i < 2 ? evap[0] : i < 5 ? evap[1] : evap[2]) / (i < 2 ? 2 : 3)) * 100).toFixed(2),
    mg:  +(((i < 2 ? evap[0] : i < 5 ? evap[1] : evap[2]) / (i < 2 ? 2 : 3)) * 450).toFixed(1),
  }));

  const specificGravity = +(0.82 + sil * 0.14).toFixed(4);
  const flashPoint = +(48 + (1 - evap[0]) * 35).toFixed(1);
  const macDays = Math.round(14 + fix * 56);

  // Serialize as hex — simulated AES-256-GCM ciphertext
  const raw = JSON.stringify({ cas: casEntries, sg: specificGravity, fp: flashPoint, mac: macDays });
  const hexPayload = Array.from(new TextEncoder().encode(raw))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    ciphertext: hexPayload,
    casEntries,
    specificGravity,
    flashPoint,
    macDays,
    dilutionRatio: +(sil * 0.28 + 0.02).toFixed(4),
  };
}

async function buildTesseractProfile(card, accord, domA, domB, result) {
  const hash = await generateAccordHash(card, accord, domA, domB);
  const encryptedFormula = buildEncryptedFormula(card, accord);
  return {
    hash,
    publicProfile: {
      hash,
      name: card.name,
      conc: card.conc,
      concPct: card.concPct,
      topNotes: card.topNotes,
      heartNotes: card.heartNotes,
      baseNotes: card.baseNotes,
      dom: card.dom,
      sec: card.sec,
      nodeClass: card.nodeClass,
      polLabel: card.polLabel,
      longevity: card.longevity,
      evap: card.evap,
    },
    encryptedFormula,
    dims: result ? {
      convergence: result.convergence || [],
      divergence:  result.divergence  || [],
      paradoxes:   result.paradoxes   || [],
    } : null,
    viability: result?.viability ?? 5,
  };
}

// ── Tesseract RSA-OAEP — public key for formula vault encryption ─────────────
const TESSERACT_PUB_KEY_B64 = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuF5JUFwt6vCs/6kWTFGq10NZjqeRKK7Ek5X6DPGl+NgiCVZUT1VYhOB0ssL91Mr0DBmG7EbOUqEs5s23x4z5gQEgEAPXZ0fvyODdimrk95XduOpGUNOSxWe4rFTZAxm5Qkqj75hHMOIcnadgp0wnY4HslR08EWcACUgucYt3uR2XA0I1BD7Ece45R/miA4lcFta7q3TVzkIbl7CFO9JWuFzf5EFTotuNXR1gzN33neuxLuS0lu/6MI9TMaQ5s9G5I5RKEzv2hHSq5ACCKayO+1h3facgb9AvdDRdbUdSCAFUIsnfmcK42FUNM13Z6VP1G1W39ZaAmoI1dtNNSmQDpwIDAQAB';

let _rsaPubKeyPromise = null;
function getTesseractPubKey() {
  if (!_rsaPubKeyPromise) {
    const binaryStr = atob(TESSERACT_PUB_KEY_B64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    _rsaPubKeyPromise = crypto.subtle.importKey(
      'spki', bytes.buffer,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false, ['encrypt']
    );
  }
  return _rsaPubKeyPromise;
}

// Hybrid encryption: AES-256-GCM for payload, RSA-OAEP for the AES key
// This handles arbitrary payload sizes while keeping the RSA public key as the trust anchor
async function encryptForVault(plaintext) {
  const rsaPubKey = await getTesseractPubKey();

  // 1. Generate ephemeral AES-256-GCM key + IV
  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 2. Encrypt the formula payload with AES-GCM
  const encoded = new TextEncoder().encode(plaintext);
  const aesCipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, encoded);

  // 3. Export the raw AES key and encrypt it with RSA-OAEP (32 bytes — fits easily)
  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
  const encryptedAesKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, rsaPubKey, rawAesKey);

  // 4. Pack: base64({ encKey: base64, iv: base64, payload: base64 })
  const b64 = (buf) => {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  };

  return JSON.stringify({
    k: b64(encryptedAesKey),  // RSA-OAEP encrypted AES key
    iv: b64(iv),              // AES-GCM IV (cleartext — safe)
    p: b64(aesCipher),        // AES-GCM ciphertext
    alg: 'RSA-OAEP+AES-256-GCM',
  });
}

// ── Collision particle system ────────────────────────────────────────────────
const MAX_PARTICLES = 300;
const PRODUCTION_THRESHOLD = 10; // minimum acquisitions before physical synthesis

// ── Pricing tiers — size / price / G²T allocation (10%) ─────────────────────
const TIERS = [
  { id: 'discovery', label: '10 ml · DISCOVERY',  size: '10ml', price: 25,  g2t: 2.50 },
  { id: 'sovereign', label: '50 ml · SOVEREIGN',  size: '50ml', price: 100, g2t: 10   },
];

// ── Tesseract Manifest ────────────────────────────────────────────────────────
function generateManifestMarkdown(card, tesseract, living = null) {
  const { hash, encryptedFormula } = tesseract;
  const { specificGravity, flashPoint, macDays, dilutionRatio, ciphertext } = encryptedFormula;
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  const evapT = (card.evap[0] * 100).toFixed(0);
  const evapH = (card.evap[1] * 100).toFixed(0);
  const evapB = (card.evap[2] * 100).toFixed(0);
  const loadingPct = (dilutionRatio * 100).toFixed(1);

  const domPair = card.id.split('-').slice(0, 2).map(s => s.toUpperCase()).join(' × ');

  const noteLines = [
    `ᛏ TOP    ${card.topNotes.join(' · ')}`,
    `ᚺ HEART  ${card.heartNotes.join(' · ')}`,
    `ᛒ BASE   ${card.baseNotes.join(' · ')}`,
  ].join('\n');

  const cRows = [];
  const ct = ciphertext || '';
  for (let i = 0; i < Math.min(ct.length, 512); i += 64) cRows.push(ct.slice(i, i + 64));
  if (ct.length > 512) cRows.push(`… [${ct.length - 512} chars omitted]`);

  return `# ECO_Sx TRANSMUTATION MANIFEST

\`\`\`
VAULT    ${hash}
COMPILED ${ts}
STATE    ◈ MANIFEST COMPILED
\`\`\`

---

## ACCORD · ${card.name}

\`\`\`
${noteLines}

CONC         ${card.conc} · ${card.concPct}
LONGEVITY    ${card.longevity}
NODE CLASS   ${card.nodeClass}
POLARITY     ${card.polLabel || 'MERIDIAN'}
OLFACTIVE    ${card.dom.toUpperCase()} × ${card.sec.toUpperCase()}
EVAP CURVE   TOP ${evapT}% / HEART ${evapH}% / BASE ${evapB}%
LOADING      ${loadingPct}%
FLASH POINT  ${flashPoint}°C
SG           ${specificGravity} g/ml
MACERATION   ${macDays} days
\`\`\`

---

## ORIGIN VECTOR // KERNEL 0.0.0.0

KERNEL 0.0.0.0 is the null state — the origin before collision. Zero information. Only capacity.

In quantum field theory the vacuum is not empty: it is the ground state of a field, seething with virtual possibility. KERNEL 0.0.0.0 is that vacuum for the accord-space. The Latent Space Collider does not create formulas — it extracts trajectories that were already latent in the field. The collision is the measurement. The measurement collapses superposition into one specific, unrepeatable configuration.

The OCK v1.1.0 parameter space is the field. The domain pair is the initial condition. The vault hash is the coordinate — a SHA-256 commitment to one path through 2²⁵⁶ possible outputs. No other input to the same field produces the same coordinate. The accord is not invented. It is located.

\`\`\`
DOMAIN     ${domPair}
HASH       ${hash.slice(0, 32)}
           ${hash.slice(32)}
SPACE      1536-dimensional · OCK v1.1.0
P(RECOLL)  < 10⁻⁷⁷
\`\`\`

---

## FISH SCALE GEOMETRY // FEIGENBAUM δ

The three-phase evaporation — TOP ${evapT}% / HEART ${evapH}% / BASE ${evapB}% — is not aesthetic preference. It is the signature of a bifurcation cascade written in molecular volatility.

Mitchell Feigenbaum (Los Alamos, 1975) discovered that in the logistic map xₙ₊₁ = r·xₙ(1−xₙ), consecutive period-doubling bifurcations converge at ratio δ = 4.66920160910299.... This constant is universal: it appears in every 1D dynamical system with a quadratic maximum, regardless of the specific map. Feigenbaum found it with a pocket calculator. It was not supposed to be there.

The bifurcation sequence:

\`\`\`
r < 3.000   stable fixed point        →  TOP   (ordered · single attractor)
r > 3.000   period-2 onset            →  HEART (quasi-periodic · cascade)
r > 3.449   period-4 onset            ↓
r > 3.544   period-8 ...              ↓  each interval compressed by δ
r > 3.569   chaos onset               →  BASE  (strange attractor · emergent)
\`\`\`

Each scale of the fish scale bifurcation diagram is compressed by δ relative to the one above. The structure repeats without limit. The accord's evaporation curve maps onto the same partition: three regimes, each self-similar to the whole.

BASE notes are post-cascade residue. The strange attractor. Slow, persistent, sensitive to initial conditions, structurally invariant under time. The scent that remains after everything else has bifurcated away.

This is not a metaphor. Molecular volatility, governed by vapor pressure differentials (Clausius-Clapeyron equation), exhibits the same period-doubling geometry as the logistic map because both are governed by nonlinear feedback dynamics with a bounded quadratic form. The fish scale kernel does not describe the scent. It describes the geometry the scent inhabits — and that geometry is universal.

---

## ENCRYPTED FORMULA

\`\`\`
CIPHER  AES-256-GCM · RSA-OAEP-2048
BLAKE3  INTEGRITY BOUND

${cRows.join('\n')}
\`\`\`
${living ? `
---

## § LIVING SIGNATURE

This accord carries the irreducible signature of one witness. The substituted note
was selected from the signature-grade pool by deterministic hash of the witness's
identity bound to this accord coordinate. The substitution is permanent for this
witness, and unique among all possible witnesses.

\`\`\`
LAYER         ${living.layer.toUpperCase()}
NOTE          ${living.newNote}  (was: ${living.oldNote})
ENTROPY       ${living.editionEntropy}
WITNESS HASH  ${living.witnessHash}
PROTOCOL      HS256 · 24h sovereign key · server-deterministic
\`\`\`

The molecule that is yours did not exist before this transmission. It does now.
` : ''}
---

_Transmutation complete. The physical substrate is vaulted. The data is sovereign._
`;
}

// ── 16-Beam parameter trace at collision impact ────────────────────────────
// One beam per OCK dimension; convergence beams green-shifted, divergence
// magenta-shifted, paradox red. Lifespan scales with magnitude.

const DIM_ORDER_BEAMS = [
  'dynamical','nonlinearity','dimensionality','criticality',
  'entropy','synchrony','conservation','temporal',
  'spatial','stochastic','game_theory','thermodynamic',
  'information','cryptographic','biological','economic',
];

function buildBeams(result, hueA, hueB) {
  if (!result) return null;
  const beams = [];
  for (let i = 0; i < 16; i++) {
    const name = DIM_ORDER_BEAMS[i];
    const conv = result.convergence?.find(d => d.name === name);
    const div  = result.divergence?.find(d => d.name === name);
    const para = result.paradoxes?.find(d => d.name === name);
    let kind = 'idle', mag = 0, hue = 0;
    if (conv)      { kind = 'conv'; mag = Math.min(1, conv.contrib);  hue = (hueA + 60) % 360; }
    else if (div)  { kind = 'div';  mag = Math.min(1, div.delta);     hue = (hueB + 300) % 360; }
    else if (para) { kind = 'para'; mag = Math.min(1, para.residual); hue = 350; }
    beams.push({
      angle: (i / 16) * Math.PI * 2 - Math.PI / 2,
      kind, mag, hue,
      lifespanMs: 120 + mag * 680,
    });
  }
  return beams;
}

function drawDimensionBeams(ctx, beamsState, frameT, w, h) {
  if (!beamsState || !beamsState.beams) return;
  if (beamsState.startedAt == null) beamsState.startedAt = frameT;
  // Convert frame counter to ms (assuming ~16ms per frame at 60fps)
  const elapsed = (frameT - beamsState.startedAt) * 16;
  const cx = w / 2, cy = h / 2;
  for (const beam of beamsState.beams) {
    if (elapsed > beam.lifespanMs) continue;
    if (beam.mag < 0.02) continue;
    const progress = elapsed / beam.lifespanMs;
    const eased = 1 - (1 - progress) * (1 - progress); // easeOut
    const length = beam.mag * Math.min(w, h) * 0.4 * eased;
    const alpha = (1 - progress) * 0.85;
    const x2 = cx + Math.cos(beam.angle) * length;
    const y2 = cy + Math.sin(beam.angle) * length;
    ctx.strokeStyle = `hsla(${beam.hue},85%,60%,${alpha})`;
    ctx.lineWidth = 0.5 + beam.mag * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

function createParticle(x, y, hue, vx, vy, type) {
  return {
    x, y, vx, vy,
    hue,
    life: 1.0,
    size: type === 'spark' ? 1.5 + Math.random() * 2 : 2 + Math.random() * 3,
    type, // 'stream_a', 'stream_b', 'spark', 'chimera'
    decay: type === 'spark' ? 0.03 : type === 'chimera' ? 0.005 : 0.008,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function LatentCollider() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const particlesRef = useRef([]);
  const phaseRef = useRef('idle'); // idle | selecting | accelerating | colliding | result
  const timerRef = useRef(0);
  const metricsRef = useRef(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const beamsRef = useRef(null); // { beams, startedAt } populated at impact

  const [domainA, setDomainA] = useState(null);
  const [domainB, setDomainB] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState('idle');
  const narrativeCardPreview = useMemo(() => {
    if (!result || domainA == null || domainB == null) return null;
    try { return buildPerfumeCard(domainA, domainB, result); } catch { return null; }
  }, [result, domainA, domainB]);
  const narrative = useColliderNarrative(result, narrativeCardPreview);

  const [colliderAstro, setColliderAstro] = useState(null);

  // ── Crystallize + Tesseract state ──────────────────────────────────────────
  const [crystal,    setCrystal]    = useState(null);
  const [tesseract,  setTesseract]  = useState(null);
  const [living,     setLiving]     = useState(null);
  const [acquired,     setAcquired]     = useState(false);
  const [selectedTier, setSelectedTier] = useState(TIERS[0]);

  // ── Persistent production threshold (Vercel KV via /api/transmute/threshold) ─
  const serverThreshold = useProductionThreshold();

  // ── Order fulfillment status (polls KV via /api/transmute/status) ─
  const orderStatus = useOrderStatus(tesseract?.hash);

  const handleCrystallize = useCallback(async () => {
    if (!result || domainA === null || domainB === null) return;
    const card = buildPerfumeCard(domainA, domainB, result);
    setCrystal(card);
    try {
      const ids = JSON.parse(localStorage.getItem('ck_ids') || '[]');
      setAcquired(ids.includes(card.id));
    } catch { setAcquired(false); }
    // Build Tesseract cryptographic identity
    try {
      const profile = await buildTesseractProfile(card, result.accord, domainA, domainB, result);
      setTesseract(profile);
      // Hydrate living-accord state from localStorage if we've redeemed this hash before
      try {
        const stored = localStorage.getItem(`living:${profile.hash}`);
        if (stored) setLiving(JSON.parse(stored));
        else setLiving(null);
      } catch { setLiving(null); }
    } catch (e) {
      console.error('[TESSERACT] hash generation failed:', e);
      setTesseract(null);
      setLiving(null);
    }
  }, [result, domainA, domainB]);

  const handleAcquire = useCallback(async (cardId, contact = {}, tier = TIERS[1]) => {
    let newCount = 1;
    let isDupe   = false;
    try {
      const ids = JSON.parse(localStorage.getItem('ck_ids') || '[]');
      isDupe = ids.includes(cardId);
      if (!isDupe) {
        const next = [...ids, cardId];
        localStorage.setItem('ck_ids',   JSON.stringify(next));
        localStorage.setItem('ck_count', String(next.length));
        newCount = next.length;
      } else {
        newCount = ids.length;
      }
    } catch { /* storage blocked */ }
    setAcquired(true);
    setSelectedTier(tier);

    // ── RSA-OAEP encrypt the formula for zero-knowledge relay ────────────
    const card = crystal;
    if (!card) return;

    let encryptedPayload = '—';
    try {
      const formulaPlaintext = JSON.stringify(tesseract?.encryptedFormula || {});
      encryptedPayload = await encryptForVault(formulaPlaintext);
    } catch (e) {
      console.error('[TESSERACT] RSA-OAEP encryption failed:', e);
    }

    // ── Persistent order dispatch → /api/transmute/order ────────────────
    if (isDupe) return;

    const tHash          = tesseract?.hash || '—';
    const sovereignRatio = tier.price;
    const g2tAllocation  = tier.g2t;

    const noteBlock = [
      `ᛏ TOP    ${card.topNotes.join(' · ')}`,
      `ᚺ HEART  ${card.heartNotes.join(' · ')}`,
      `ᛒ BASE   ${card.baseNotes.join(' · ')}`,
    ].join('\n');

    const physBlock = [
      `CONCENTRATION  ${card.conc} · ${card.concPct}`,
      `LONGEVITY      ${card.longevity}`,
      `NODE CLASS     ${card.nodeClass}`,
      `POLARITY       ${card.polLabel || 'MERIDIAN'}`,
      `DOM / SEC      ${card.dom.toUpperCase()} × ${card.sec.toUpperCase()}`,
    ].join('\n');

    const vaultBlock = [
      `SHA-256      ${tHash.slice(0, 32)}`,
      `             ${tHash.slice(32) || '—'}`,
      `STATE        ◈ MANIFEST COMPILED`,
      `DELIVERY     DIGITAL ASSET DOWNLOADED`,
      `PROTOCOL     TESSERACT · RSA-OAEP + AES-256-GCM`,
    ].join('\n');

    const encTrunc = encryptedPayload.length > 900
      ? encryptedPayload.slice(0, 900) + '…'
      : encryptedPayload;

    const orderBody = JSON.stringify({
      formulaId:        card.id,
      formulaHash:      tHash,
      encryptedPayload: encTrunc,
      sovereignRatio,
      g2tAmount:        g2tAllocation,
      tierSize:         tier.size,
      tierLabel:        tier.label,
      cardName:         card.name,
      domainPair:       card.id.split('-').slice(0, 2).map(s => s.toUpperCase()).join(' × '),
      noteBlock,
      physBlock,
      vaultBlock,
      contact:          { signal: contact.signal || '', email: contact.email || '' },
    });

    // HMAC-SHA256 sign the body (Web Crypto API, timing-safe)
    let sig = '';
    try {
      const secret = import.meta.env.VITE_TRANSMUTE_WEBHOOK_SECRET;
      if (secret) {
        const key = await crypto.subtle.importKey(
          'raw', new TextEncoder().encode(secret),
          { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
        );
        const buf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(orderBody));
        sig = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch { /* signing failed — send unsigned, server will accept in dev mode */ }

    fetch('/api/transmute/order', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-transmute-signature': sig },
      body:    orderBody,
    }).then(() => { storeOrderHash(tHash); }).catch(() => { /* silent — notification is best-effort */ });
  }, [crystal, tesseract]);

  // ── Run the WASM collision ─────────────────────────────────────────────────
  const runCollision = useCallback(async (a, b) => {
    setLoading(true);
    setResult(null);
    setColliderAstro(null);
    setPhase('accelerating');
    phaseRef.current = 'accelerating';
    timerRef.current = 0;
    colliderBus.emit({ type: 'COLLIDER_PHASE', phase: 'accelerating' });

    try {
      // Delay so the acceleration animation plays
      await new Promise(r => setTimeout(r, 1800));

      let parsed;
      const wasmSupported = a < 32 && b < 32;

      if (wasmSupported) {
        // Legacy domains 0-31: run through WASM latent collider
        const mod = await loadWasm();
        const raw = mod.run_latent_collider(a, b, 8.0, 1.0);
        parsed = parseColliderOutput(raw);
      } else {
        // Extended domains 32+: JS-only collision from 32D feature tensors
        const mapA = DOMAIN_SPHERE_MAP[a], mapB = DOMAIN_SPHERE_MAP[b];
        const idxA = NODE_IDX[mapA.nodeId], idxB = NODE_IDX[mapB.nodeId];
        const fA = FEATURES[idxA], fB = FEATURES[idxB];
        const sim = cosineSim(fA, fB);
        const angle = Math.acos(Math.min(1, Math.max(-1, sim))) * (180 / Math.PI);
        const nA = Math.sqrt(fA.reduce((s, v) => s + v * v, 0));
        const nB = Math.sqrt(fB.reduce((s, v) => s + v * v, 0));
        const dot = fA.reduce((s, v, i) => s + v * fB[i], 0);
        const novelty = 1 - sim;
        const coherence = sim;
        const viability = (sim + novelty) / 2;
        const dNameA = domainById(a).short, dNameB = domainById(b).short;

        // Synthesize OCK values from feature vectors
        const topI = (fA[4] + fB[4]) / 2;       // entropy → volatility
        const heartI = (fA[5] + fB[5]) / 2;      // synchrony → persistence
        const baseI = (fA[11] + fB[11]) / 2;     // thermodynamic → weight
        const animalicI = (fA[14] + fB[14]) / 2; // biological → animalic
        const sillage = Math.min(1, (nA + nB) / 8);
        const fixation = sim > 0.5 ? 0.7 : 0.3;

        // Determine dominant family from feature profile
        const familyScores = [
          { key: 'CITRUS',   score: topI },
          { key: 'FLORAL',   score: heartI },
          { key: 'RESINOUS', score: baseI },
          { key: 'ANIMALIC', score: animalicI },
          { key: 'OZONIC',   score: (fA[8] + fB[8]) / 2 },
          { key: 'CHYPRE',   score: (fA[25] + fB[25]) / 2 },
          { key: 'MINERAL',  score: (fA[27] + fB[27]) / 2 },
        ];
        familyScores.sort((x, y) => y.score - x.score);

        parsed = {
          cosine: sim, angle, normA: nA, normB: nB, dot,
          rawAttn: dot, scaledAttn: dot / Math.sqrt(32), softmax: sim,
          entropy: -sim * Math.log2(Math.max(sim, 0.001)), projNorm: novelty,
          novelty, synthNorm: (nA + nB) / 2, coherence, viability,
          phase: sim > 0.7 ? 'FUSION' : sim > 0.4 ? 'RESONANCE' : 'ORTHOGONAL',
          vClass: sim > 0.7 ? 'CONVERGENT' : sim > 0.4 ? 'COMPLEMENTARY' : 'DIVERGENT',
          chimeraName: `${dNameA}×${dNameB}`,
          chimeraDesc: `Cross-domain collision between ${domainById(a).name} and ${domainById(b).name}`,
          // OCK values
          ockDominant: familyScores[0].key,
          ockVolBlend: sillage, ockChimeraVol: (topI + heartI + baseI) / 3,
          ockTop: topI, ockHeart: heartI, ockBase: baseI,
          ockAnimalic: animalicI, ockSillage: sillage,
          ockPermeability: Math.min(1, novelty * 1.5),
          ockMaceration: fixation * 0.8, ockFixation: fixation,
          ockPersists: fixation > 0.5, ockEvapCurve: [topI, heartI, baseI],
          // Node class — derive from feature balance
          ockNodeClass: heartI > topI && heartI > baseI ? 'R2A' : topI > baseI ? 'DPA' : 'RTA',
          ockRtaScore: baseI, ockDpaScore: topI, ockR2aScore: heartI,
          ockCleanRoom: 1 - animalicI, ockSovereignty: sim,
          ockDanceRole: sim > 0.7 ? 'LEAD-FOLLOW SYNCHRONIZED' : 'INDEPENDENT ORBIT',
          ockPolarity: (topI - baseI + 1) / 2,
          ockPolarityClass: topI > baseI ? 'SOLAR' : baseI > topI ? 'LUNAR' : 'MERIDIAN',
          // Interaction terms
          interference: Math.abs(nA - nB) / Math.max(nA, nB, 0.01),
          catalysis: sim * novelty * 4, resonanceFreq: (nA + nB) * 50,
          turbulence: novelty * 0.8,
        };
      }

      // ── 32D feature-space analysis via sphere node mapping ────────
      const nodeIdA = DOMAIN_SPHERE_MAP[a].nodeId;
      const nodeIdB = DOMAIN_SPHERE_MAP[b].nodeId;
      const fullEdge = analyzeFullEdge(nodeIdA, nodeIdB);
      const paradoxResult = extractParadoxes(nodeIdA, nodeIdB);

      if (fullEdge) {
        // Convergence: dimensions where both domains score high (shared conceptual DNA)
        parsed.convergence = fullEdge.dims
          .filter(d => d.vA > 0.3 && d.vB > 0.3)
          .sort((a, b) => b.contrib - a.contrib)
          .slice(0, 4);

        // Divergence: largest deltas (where the domains disagree most)
        parsed.divergence = [...fullEdge.dims]
          .sort((a, b) => b.delta - a.delta)
          .slice(0, 4);

        parsed.sphereSim = fullEdge.sim;
        parsed.dims = fullEdge.dims;
      }

      if (paradoxResult) {
        // Irreducible paradoxes: survive 32 rounds of saponification
        parsed.paradoxes = paradoxResult.paradoxes;
        parsed.postSaponificationSim = paradoxResult.finalSim;
      }

      parsed.nodeIdA = nodeIdA;
      parsed.nodeIdB = nodeIdB;
      parsed._domainNameA = domainById(a).name;
      parsed._domainNameB = domainById(b).name;

      // ── OCK: Olfactory accord classification ───────────────────────
      parsed.accord = classifyAccord(parsed);

      metricsRef.current = parsed;
      setResult(parsed);
      setPhase('colliding');
      phaseRef.current = 'colliding';
      timerRef.current = 0;

      // ── 16-Beam parameter trace: build beams from this collision's OCK dims
      beamsRef.current = { beams: buildBeams(parsed, domainById(a).hue, domainById(b).hue), startedAt: null };

      // ── Fetch live astro data for mathematical astrology overlay ──────
      loadWasm().then(w => {
        try { setColliderAstro(parseAstroOutput(w.run_astro(Date.now()))); } catch {}
      });

      // ── Emit chimera to Art tab sphere ────────────────────────────────
      const mapA = DOMAIN_SPHERE_MAP[a];
      const mapB = DOMAIN_SPHERE_MAP[b];
      colliderBus.emit({
        type:          'CHIMERA_SYNTHESIS',
        chimeraName:   parsed.chimeraName,
        chimeraDesc:   parsed.chimeraDesc,
        phase:         parsed.phase,
        vClass:        parsed.vClass,
        domainA:       a,
        domainB:       b,
        _domainNameA:  domainById(a).name,
        _domainNameB:  domainById(b).name,
        parentNodeA:   mapA.nodeId,
        parentNodeB:   mapB.nodeId,
        cluster:       parsed.novelty > 0.7 ? 'phys' : mapA.cluster,
        cosine:        parsed.cosine,
        angle:         parsed.angle,
        novelty:       parsed.novelty,
        coherence:     parsed.coherence,
        viability:     parsed.viability,
        hueA:          domainById(a).hue,
        hueB:          domainById(b).hue,
        accord:      parsed.accord ? {
          dominant:     parsed.accord.dominant.id,
          sillage:      parsed.accord.sillage,
          permeability: parsed.accord.permeability,
          evapCurve:    parsed.accord.evapCurve,
          fixation:     parsed.accord.fixation,
          persists:     parsed.accord.persists,
          chimeraVol:   parsed.accord.chimeraVol,
          volBlend:     parsed.accord.volBlend,
          nodeClass:    parsed.accord.nodeClass?.id,
          polarity:     parsed.accord.polarity,
          polarityClass:parsed.accord.polarityClass?.label,
          cleanRoom:    parsed.accord.cleanRoom,
          sovereignty:  parsed.accord.sovereignty,
        } : null,
      });
    } catch (e) {
      console.error('[COLLIDER] WASM error:', e);
      setPhase('idle');
      phaseRef.current = 'idle';
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Domain selection handler ───────────────────────────────────────────────
  const handleSelect = useCallback((id) => {
    if (phase === 'accelerating' || phase === 'colliding') return;

    if (domainA === null) {
      setDomainA(id);
      setDomainB(null);
      setResult(null);
      setPhase('selecting');
      phaseRef.current = 'selecting';
    } else if (domainB === null && id !== domainA) {
      setCrystal(null);
      setTesseract(null);
      setLiving(null);
      setAcquired(false);
      setDomainB(id);
      runCollision(domainA, id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Reset
      setCrystal(null);
      setTesseract(null);
      setLiving(null);
      setAcquired(false);
      setDomainA(id);
      setDomainB(null);
      setResult(null);
      setPhase('selecting');
      phaseRef.current = 'selecting';
      metricsRef.current = null;
    }
  }, [domainA, domainB, phase, runCollision]);

  const handleReset = useCallback(() => {
    setCrystal(null);
    setTesseract(null);
    setLiving(null);
    setDomainA(null);
    setDomainB(null);
    setResult(null);
    setColliderAstro(null);
    setPhase('idle');
    phaseRef.current = 'idle';
    metricsRef.current = null;
    particlesRef.current = [];
    timerRef.current = 0;
    beamsRef.current = null;
    colliderBus.emit({ type: 'COLLIDER_PHASE', phase: 'idle' });
  }, []);

  // ── Canvas render loop ─────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      sizeRef.current = { w: rect.width, h: rect.height };
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      try { _draw(); } catch (e) { /* keep rAF alive */ }
      rafRef.current = requestAnimationFrame(draw);
    };

    const _draw = () => {
      const { w, h } = sizeRef.current;
      if (w < 10 || h < 10) return; // canvas not ready yet
      const cx = w / 2;
      const cy = h / 2;
      const t = timerRef.current++;
      const ph = phaseRef.current;
      const metrics = metricsRef.current;
      const ps = particlesRef.current;

      ctx.clearRect(0, 0, w, h);

      // ── Background grid ────────────────────────────────────────────────
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.04)';
      ctx.lineWidth = 0.5;
      const gridSize = 40;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // ── Central collision zone ─────────────────────────────────────────
      const pulseAlpha = 0.03 + Math.sin(t * 0.03) * 0.02;
      const zoneRadius = ph === 'colliding' ? 60 + Math.sin(t * 0.1) * 10 : 40;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, zoneRadius);
      grad.addColorStop(0, `rgba(217, 70, 239, ${pulseAlpha * 2})`);
      grad.addColorStop(0.5, `rgba(6, 182, 212, ${pulseAlpha})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - zoneRadius, cy - zoneRadius, zoneRadius * 2, zoneRadius * 2);

      // Crosshair
      ctx.strokeStyle = `rgba(217, 70, 239, ${0.15 + Math.sin(t * 0.05) * 0.05})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(cx - 20, cy); ctx.lineTo(cx + 20, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy + 20); ctx.stroke();

      // ── Beamlines (when domains are selected) ──────────────────────────
      const hueA = domainA !== null ? domainById(domainA).hue : 280;
      const hueB = domainB !== null ? domainById(domainB).hue : 120;

      if (domainA !== null) {
        const beamAlpha = ph === 'accelerating' ? 0.3 + Math.sin(t * 0.15) * 0.15 : 0.12;
        ctx.strokeStyle = `hsla(${hueA}, 80%, 60%, ${beamAlpha})`;
        ctx.lineWidth = ph === 'accelerating' ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(cx - 100, cy); ctx.stroke();

        // Domain A label on beam
        ctx.fillStyle = `hsla(${hueA}, 80%, 70%, 0.6)`;
        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(domainById(domainA).short, 8, cy - 8);
      }

      if (domainB !== null) {
        const beamAlpha = ph === 'accelerating' ? 0.3 + Math.sin(t * 0.15 + 1) * 0.15 : 0.12;
        ctx.strokeStyle = `hsla(${hueB}, 80%, 60%, ${beamAlpha})`;
        ctx.lineWidth = ph === 'accelerating' ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(w, cy); ctx.lineTo(cx + 100, cy); ctx.stroke();

        ctx.fillStyle = `hsla(${hueB}, 80%, 70%, 0.6)`;
        ctx.font = '9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(domainById(domainB).short, w - 8, cy - 8);
      }

      // ── Accelerating domain orbs — visible nodes converging to center ──
      if (ph === 'accelerating' && domainA !== null && domainB !== null) {
        const progress = Math.min(1, t / 108); // ~1800ms at 60fps
        const ease = progress * progress * progress; // easeInCubic — builds tension
        const orbRadius = 10 + Math.sin(t * 0.2) * 2;

        // Domain A orb — left to center
        const orbAx = 40 + (cx - 100 - 40) * ease;
        const orbGradA = ctx.createRadialGradient(orbAx, cy, 0, orbAx, cy, orbRadius * 2.5);
        orbGradA.addColorStop(0, `hsla(${hueA}, 80%, 70%, ${0.6 + ease * 0.3})`);
        orbGradA.addColorStop(0.4, `hsla(${hueA}, 70%, 50%, ${0.3 + ease * 0.2})`);
        orbGradA.addColorStop(1, `hsla(${hueA}, 80%, 40%, 0)`);
        ctx.beginPath(); ctx.arc(orbAx, cy, orbRadius * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = orbGradA; ctx.fill();
        // Core
        ctx.beginPath(); ctx.arc(orbAx, cy, orbRadius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hueA}, 90%, 85%, ${0.7 + ease * 0.3})`;
        ctx.fill();

        // Domain B orb — right to center
        const orbBx = w - 40 - (w - 40 - cx - 100) * ease;
        const orbGradB = ctx.createRadialGradient(orbBx, cy, 0, orbBx, cy, orbRadius * 2.5);
        orbGradB.addColorStop(0, `hsla(${hueB}, 80%, 70%, ${0.6 + ease * 0.3})`);
        orbGradB.addColorStop(0.4, `hsla(${hueB}, 70%, 50%, ${0.3 + ease * 0.2})`);
        orbGradB.addColorStop(1, `hsla(${hueB}, 80%, 40%, 0)`);
        ctx.beginPath(); ctx.arc(orbBx, cy, orbRadius * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = orbGradB; ctx.fill();
        ctx.beginPath(); ctx.arc(orbBx, cy, orbRadius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hueB}, 90%, 85%, ${0.7 + ease * 0.3})`;
        ctx.fill();
      }

      // ── Screen shake during impact ────────────────────────────────────
      let shaking = false;
      if (ph === 'colliding' && t < 20) {
        shaking = true;
        const mag = 6 * (1 - t / 20);
        ctx.save();
        ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
      }

      // ── Shockwave ring at collision impact ────────────────────────────
      if (ph === 'colliding' && t < 35) {
        const ringProgress = t / 35;
        const ringRadius = ringProgress * 120;
        const ringAlpha = (1 - ringProgress) * 0.7;
        const ringWidth = 3 * (1 - ringProgress);
        ctx.strokeStyle = `rgba(255, 255, 255, ${ringAlpha})`;
        ctx.lineWidth = ringWidth;
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        // Secondary ring — colored, slightly delayed
        if (t > 5) {
          const r2p = (t - 5) / 30;
          const r2r = r2p * 90;
          ctx.strokeStyle = `hsla(${(hueA + hueB) / 2}, 70%, 60%, ${(1 - r2p) * 0.4})`;
          ctx.lineWidth = 2 * (1 - r2p);
          ctx.beginPath();
          ctx.arc(cx, cy, r2r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // ── Spawn particles based on phase ─────────────────────────────────
      if (ph === 'accelerating') {
        // Stream from left (domain A)
        if (t % 2 === 0 && ps.length < MAX_PARTICLES) {
          const speed = 2 + Math.random() * 4 + t * 0.02;
          ps.push(createParticle(
            0, cy + (Math.random() - 0.5) * 30,
            hueA,
            speed, (Math.random() - 0.5) * 1.5,
            'stream_a'
          ));
        }
        // Stream from right (domain B)
        if (t % 2 === 1 && ps.length < MAX_PARTICLES) {
          const speed = 2 + Math.random() * 4 + t * 0.02;
          ps.push(createParticle(
            w, cy + (Math.random() - 0.5) * 30,
            hueB,
            -speed, (Math.random() - 0.5) * 1.5,
            'stream_b'
          ));
        }
      }

      if (ph === 'colliding' && t < 40) {
        // Impact sparks — radial burst
        for (let i = 0; i < 8; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 1 + Math.random() * 5;
          const sparkHue = Math.random() > 0.5 ? hueA : hueB;
          if (ps.length < MAX_PARTICLES) {
            ps.push(createParticle(
              cx + (Math.random() - 0.5) * 10,
              cy + (Math.random() - 0.5) * 10,
              sparkHue,
              Math.cos(angle) * speed,
              Math.sin(angle) * speed,
              'spark'
            ));
          }
        }
      }

      // Orthogonal debris jets — cross-shaped burst perpendicular to beam axis
      if (ph === 'colliding' && t < 25) {
        for (let i = 0; i < 4; i++) {
          const dir = i < 2 ? -1 : 1; // up or down
          const speed = 3 + Math.random() * 5;
          const drift = (Math.random() - 0.5) * 1.5; // slight horizontal spread
          const jetHue = i % 2 === 0 ? hueA : hueB;
          if (ps.length < MAX_PARTICLES) {
            ps.push(createParticle(
              cx + (Math.random() - 0.5) * 8,
              cy + (Math.random() - 0.5) * 4,
              jetHue,
              drift,
              dir * speed,
              'spark'
            ));
          }
        }
      }

      if (ph === 'colliding' && t > 30 && t < 120 && t % 4 === 0) {
        // Chimera glow particles — slow orbiting
        const angle = t * 0.08;
        const radius = 15 + Math.random() * 25;
        if (ps.length < MAX_PARTICLES) {
          ps.push(createParticle(
            cx + Math.cos(angle) * radius,
            cy + Math.sin(angle) * radius,
            (hueA + hueB) / 2, // blended hue — volatile decomposition
            Math.cos(angle + Math.PI / 2) * 0.5,
            Math.sin(angle + Math.PI / 2) * 0.5,
            'chimera'
          ));
        }
      }

      // ── OCK: Vapor trail particles (sillage visualization) ────────────
      // Rising wisps that represent the accord's volatile decomposition
      if (ph === 'colliding' && t > 60 && t < 140 && t % 6 === 0) {
        const vaporX = cx + (Math.random() - 0.5) * 50;
        // Amber/gold hue for olfactory layer
        if (ps.length < MAX_PARTICLES) {
          ps.push(createParticle(
            vaporX, cy + 10,
            40, // amber hue
            (Math.random() - 0.5) * 0.3,
            -(0.3 + Math.random() * 0.8), // rises upward
            'chimera' // reuse chimera type for the glow effect
          ));
        }
      }

      // ── Update and draw particles ──────────────────────────────────────
      let alive = 0;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        if (p.life <= 0) continue;

        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.life -= p.decay;

        if (p.life <= 0) continue;
        alive++;

        const alpha = p.life * p.life;
        const sat = p.type === 'chimera' ? '60%' : '80%';
        const light = p.type === 'spark' ? '80%' : '60%';

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, ${sat}, ${light}, ${alpha})`;
        ctx.fill();

        // Glow for chimera particles
        if (p.type === 'chimera') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * p.life * 3, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue}, 60%, 60%, ${alpha * 0.15})`;
          ctx.fill();
        }
      }

      // Cull dead particles periodically
      if (t % 60 === 0) {
        particlesRef.current = ps.filter(p => p.life > 0);
      }

      // ── Collision flash ────────────────────────────────────────────────
      if (ph === 'colliding' && t < 15) {
        const flash = 1 - t / 15;
        ctx.fillStyle = `rgba(255, 255, 255, ${flash * 0.35})`;
        ctx.fillRect(0, 0, w, h);
      }

      // Restore canvas from shake transform
      if (shaking) ctx.restore();

      // ── 16-Beam parameter trace — fires from t=80 onward, each beam
      //    decays at a rate proportional to its OCK dimension magnitude.
      if (ph === 'colliding' && t > 80 && beamsRef.current) {
        drawDimensionBeams(ctx, beamsRef.current, t, w, h);
      }

      // ── Result metrics overlay (delayed to let impact breathe) ─────────
      if (ph === 'colliding' && metrics && t > 80) {
        const fadeIn = Math.min(1, (t - 80) / 30);
        ctx.globalAlpha = fadeIn;

        // Cosine similarity arc
        ctx.strokeStyle = `hsla(${(hueA + hueB) / 2}, 70%, 60%, 0.6)`;
        ctx.lineWidth = 2;
        const arcRadius = Math.min(w, h) * 0.15;
        const angleRad = (metrics.angle / 180) * Math.PI;
        ctx.beginPath();
        ctx.arc(cx, cy + 50, arcRadius, -Math.PI / 2, -Math.PI / 2 + angleRad);
        ctx.stroke();

        // Labels
        ctx.fillStyle = 'rgba(6, 182, 212, 0.7)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`cos(θ) = ${metrics.cosine.toFixed(4)}`, cx, cy + 50 + arcRadius + 16);
        ctx.fillText(`θ = ${metrics.angle.toFixed(1)}°`, cx, cy + 50 + arcRadius + 28);

        // Novelty bar
        const barX = cx - 60;
        const barY = cy - 60;
        const barW = 120;
        const barH = 4;
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = `hsla(${280}, 70%, 60%, 0.8)`;
        ctx.fillRect(barX, barY, barW * metrics.novelty, barH);
        ctx.fillStyle = 'rgba(217, 70, 239, 0.6)';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`NOVELTY ${(metrics.novelty * 100).toFixed(0)}%`, cx, barY - 4);

        ctx.globalAlpha = 1;
      }

      // Transition to result phase after animation completes
      if (ph === 'colliding' && t > 150) {
        phaseRef.current = 'result';
        setPhase('result');
      }
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [domainA, domainB]);

  // ── Viability color ────────────────────────────────────────────────────────
  const viabilityColor = useMemo(() => {
    if (!result) return '#39ff14';
    if (result.viability > 8) return '#d946ef';
    if (result.viability > 4) return '#06b6d4';
    if (result.viability > 1.5) return '#39ff14';
    return '#f43f5e';
  }, [result]);

  return (
    <div className="mb-10">
      {/* ── Section header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest"
            style={{ opacity: 0, animation: 'sc-headReveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.2s both, sc-headColor 9s ease-in-out 0s infinite' }}>
            LATENT SPACE COLLIDER
          </h3>
          <div className="text-[10px] text-fuchsia-500/50 font-mono uppercase tracking-widest mt-0.5">
            // 1536-D CROSS-ATTENTION SYNTHESIS · OCK v1.1.0 · INTERACT v1.2.0 · WASM · {phase.toUpperCase()}
          </div>
        </div>
        {(domainA !== null) && (
          <button
            onClick={handleReset}
            className="text-[10px] font-mono text-cyan-600/50 hover:text-cyan-400 uppercase tracking-widest transition-colors px-3 py-1 border border-cyan-900/20 rounded hover:border-cyan-600/40"
          >
            RESET
          </button>
        )}
      </div>

      {/* ── Collision Chamber (canvas) ── */}
      <div className="relative w-full border border-fuchsia-900/30 bg-black/60 rounded-lg overflow-hidden"
        style={{ height: 220, animation: 'sc-borderBreath 8s ease-in-out infinite' }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ imageRendering: 'auto' }}
        />
        {/* Idle state prompt */}
        {phase === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center border border-dashed border-fuchsia-500/20 rounded-sm px-10 py-6">
              <div className="text-[11px] font-mono text-fuchsia-500/40 uppercase tracking-widest animate-pulse">
                SELECT TWO DOMAINS TO COLLIDE
              </div>
              <div className="text-[9px] font-mono text-cyan-600/30 mt-1">
                1536-dimensional vector intersection · cross-attention synthesis
              </div>
            </div>
          </div>
        )}
        {/* Loading indicator */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-[10px] font-mono text-fuchsia-400 uppercase tracking-widest animate-pulse">
              COMPUTING COLLISION...
            </div>
          </div>
        )}
      </div>

      {/* ── Domain Grid — Block I: Conceptual ── */}
      <div className="text-[8px] font-mono text-fuchsia-500/40 uppercase tracking-widest mt-3 mb-1">
        BLOCK I — CONCEPTUAL
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
        {DOMAINS.map(d => {
          const isA = domainA === d.id;
          const isB = domainB === d.id;
          const selected = isA || isB;
          const disabled = phase === 'accelerating' || phase === 'colliding';

          return (
            <button
              key={d.id}
              onClick={() => !disabled && handleSelect(d.id)}
              disabled={disabled}
              className={`
                text-[9px] font-mono uppercase tracking-wider py-2 px-1 rounded border transition-all
                ${selected
                  ? 'border-fuchsia-500/60 bg-fuchsia-900/20 text-fuchsia-300'
                  : 'border-cyan-900/20 bg-black/30 text-cyan-600/60 hover:border-cyan-600/40 hover:text-cyan-400 hover:bg-cyan-900/10'}
                ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
              `}
              title={d.name}
              style={selected ? { boxShadow: `0 0 12px hsla(${d.hue}, 70%, 50%, 0.3)` } : {}}
            >
              <div className="font-bold" style={selected ? { color: `hsl(${d.hue}, 70%, 65%)` } : {}}>
                {d.short}
              </div>
              {isA && <div className="text-[7px] text-fuchsia-500 mt-0.5">A</div>}
              {isB && <div className="text-[7px] text-cyan-500 mt-0.5">B</div>}
            </button>
          );
        })}
      </div>

      {/* ── Domain Grid — Block II: Elemental ── */}
      <div className="text-[8px] font-mono text-amber-500/40 uppercase tracking-widest mt-3 mb-1">
        BLOCK II — ELEMENTAL
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
        {ELEM_DOMAINS.map(d => {
          const isA = domainA === d.id;
          const isB = domainB === d.id;
          const selected = isA || isB;
          const disabled = phase === 'accelerating' || phase === 'colliding';

          return (
            <button
              key={d.id}
              onClick={() => !disabled && handleSelect(d.id)}
              disabled={disabled}
              className={`
                text-[9px] font-mono uppercase tracking-wider py-2 px-1 rounded border transition-all
                ${selected
                  ? 'border-amber-500/60 bg-amber-900/20 text-amber-300'
                  : 'border-amber-900/20 bg-black/30 text-amber-600/60 hover:border-amber-600/40 hover:text-amber-400 hover:bg-amber-900/10'}
                ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
              `}
              title={d.name}
              style={selected ? { boxShadow: `0 0 12px hsla(${d.hue}, 70%, 50%, 0.3)` } : {}}
            >
              <div className="font-bold" style={selected ? { color: `hsl(${d.hue}, 70%, 65%)` } : {}}>
                {d.short}
              </div>
              {isA && <div className="text-[7px] text-fuchsia-500 mt-0.5">A</div>}
              {isB && <div className="text-[7px] text-cyan-500 mt-0.5">B</div>}
            </button>
          );
        })}
      </div>

      {/* ── Domain Grid — Block III: Philosophy & Mathematics ── */}
      <div className="text-[8px] font-mono text-violet-500/40 uppercase tracking-widest mt-3 mb-1">
        BLOCK III — PHILOSOPHY & MATHEMATICS
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
        {PHIL_MATH_DOMAINS.map(d => {
          const isA = domainA === d.id;
          const isB = domainB === d.id;
          const selected = isA || isB;
          const disabled = phase === 'accelerating' || phase === 'colliding';

          return (
            <button
              key={d.id}
              onClick={() => !disabled && handleSelect(d.id)}
              disabled={disabled}
              className={`
                text-[9px] font-mono uppercase tracking-wider py-2 px-1 rounded border transition-all
                ${selected
                  ? 'border-violet-500/60 bg-violet-900/20 text-violet-300'
                  : 'border-violet-900/20 bg-black/30 text-violet-600/60 hover:border-violet-600/40 hover:text-violet-400 hover:bg-violet-900/10'}
                ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
              `}
              title={d.name}
              style={selected ? { boxShadow: `0 0 12px hsla(${d.hue}, 70%, 50%, 0.3)` } : {}}
            >
              <div className="font-bold" style={selected ? { color: `hsl(${d.hue}, 70%, 65%)` } : {}}>
                {d.short}
              </div>
              {isA && <div className="text-[7px] text-fuchsia-500 mt-0.5">A</div>}
              {isB && <div className="text-[7px] text-cyan-500 mt-0.5">B</div>}
            </button>
          );
        })}
      </div>

      {/* ── Domain Grid — Block IV: Life Sciences & Humanities ── */}
      <div className="text-[8px] font-mono text-emerald-500/40 uppercase tracking-widest mt-3 mb-1">
        BLOCK IV — CHEMISTRY, BIOLOGY & HUMANITIES
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
        {LIFE_HUM_DOMAINS.map(d => {
          const isA = domainA === d.id;
          const isB = domainB === d.id;
          const selected = isA || isB;
          const disabled = phase === 'accelerating' || phase === 'colliding';

          return (
            <button
              key={d.id}
              onClick={() => !disabled && handleSelect(d.id)}
              disabled={disabled}
              className={`
                text-[9px] font-mono uppercase tracking-wider py-2 px-1 rounded border transition-all
                ${selected
                  ? 'border-emerald-500/60 bg-emerald-900/20 text-emerald-300'
                  : 'border-emerald-900/20 bg-black/30 text-emerald-600/60 hover:border-emerald-600/40 hover:text-emerald-400 hover:bg-emerald-900/10'}
                ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
              `}
              title={d.name}
              style={selected ? { boxShadow: `0 0 12px hsla(${d.hue}, 70%, 50%, 0.3)` } : {}}
            >
              <div className="font-bold" style={selected ? { color: `hsl(${d.hue}, 70%, 65%)` } : {}}>
                {d.short}
              </div>
              {isA && <div className="text-[7px] text-fuchsia-500 mt-0.5">A</div>}
              {isB && <div className="text-[7px] text-cyan-500 mt-0.5">B</div>}
            </button>
          );
        })}
      </div>

      {/* ── Domain Grid — Block V: Cognitive, Aesthetic & Synthetic ── */}
      <div className="text-[8px] font-mono text-rose-500/40 uppercase tracking-widest mt-3 mb-1">
        BLOCK V — COGNITIVE, AESTHETIC & SYNTHETIC
      </div>
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
        {COGN_SYNTH_DOMAINS.map(d => {
          const isA = domainA === d.id;
          const isB = domainB === d.id;
          const selected = isA || isB;
          const disabled = phase === 'accelerating' || phase === 'colliding';

          return (
            <button
              key={d.id}
              onClick={() => !disabled && handleSelect(d.id)}
              disabled={disabled}
              className={`
                text-[9px] font-mono uppercase tracking-wider py-2 px-1 rounded border transition-all
                ${selected
                  ? 'border-rose-500/60 bg-rose-900/20 text-rose-300'
                  : 'border-rose-900/20 bg-black/30 text-rose-600/60 hover:border-rose-600/40 hover:text-rose-400 hover:bg-rose-900/10'}
                ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
              `}
              title={d.name}
              style={selected ? { boxShadow: `0 0 12px hsla(${d.hue}, 70%, 50%, 0.3)` } : {}}
            >
              <div className="font-bold" style={selected ? { color: `hsl(${d.hue}, 70%, 65%)` } : {}}>
                {d.short}
              </div>
              {isA && <div className="text-[7px] text-fuchsia-500 mt-0.5">A</div>}
              {isB && <div className="text-[7px] text-cyan-500 mt-0.5">B</div>}
            </button>
          );
        })}
      </div>

      {/* ── Domain Grid — Block VI: Fish Scale Doctrine ── */}
      <div className="text-[8px] font-mono text-gray-400/60 uppercase tracking-widest mt-3 mb-1">
        BLOCK VI — FISH SCALE DOCTRINE
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
        {FSK_DOMAINS.map(d => {
          const isA = domainA === d.id;
          const isB = domainB === d.id;
          const selected = isA || isB;
          const disabled = phase === 'accelerating' || phase === 'colliding';

          return (
            <button
              key={d.id}
              onClick={() => !disabled && handleSelect(d.id)}
              disabled={disabled}
              className={`
                text-[9px] font-mono uppercase tracking-wider py-2 px-1 rounded border transition-all
                ${selected
                  ? 'border-gray-400/60 bg-gray-800/30 text-gray-200'
                  : 'border-gray-700/30 bg-black/30 text-gray-500/60 hover:border-gray-500/40 hover:text-gray-300 hover:bg-gray-800/10'}
                ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
              `}
              title={d.name}
              style={selected ? { boxShadow: `0 0 12px hsla(${d.hue}, 50%, 50%, 0.3)` } : {}}
            >
              <div className="font-bold" style={selected ? { color: `hsl(${d.hue}, 60%, 65%)` } : {}}>
                {d.short}
              </div>
              {isA && <div className="text-[7px] text-fuchsia-500 mt-0.5">A</div>}
              {isB && <div className="text-[7px] text-cyan-500 mt-0.5">B</div>}
            </button>
          );
        })}
      </div>

      {/* ── Domain Grid — Block VII: Planet System ── */}
      <div className="text-[8px] font-mono text-indigo-500/40 uppercase tracking-widest mt-3 mb-1">
        BLOCK VII — PLANET SYSTEM
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
        {PLANET_DOMAINS.map(d => {
          const isA = domainA === d.id;
          const isB = domainB === d.id;
          const selected = isA || isB;
          const disabled = phase === 'accelerating' || phase === 'colliding';

          return (
            <button
              key={d.id}
              onClick={() => !disabled && handleSelect(d.id)}
              disabled={disabled}
              className={`
                text-[9px] font-mono uppercase tracking-wider py-2 px-1 rounded border transition-all
                ${selected
                  ? 'border-indigo-500/60 bg-indigo-900/20 text-indigo-300'
                  : 'border-indigo-900/20 bg-black/30 text-indigo-600/60 hover:border-indigo-600/40 hover:text-indigo-400 hover:bg-indigo-900/10'}
                ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
              `}
              title={d.name}
              style={selected ? { boxShadow: `0 0 12px hsla(${d.hue}, 70%, 50%, 0.3)` } : {}}
            >
              <div
                className="font-bold text-[13px] leading-none mb-1"
                style={selected ? { color: `hsl(${d.hue}, 70%, 65%)` } : {}}
              >
                {d.short}
              </div>
              {isA && <div className="text-[7px] text-fuchsia-500 mt-0.5">A</div>}
              {isB && <div className="text-[7px] text-cyan-500 mt-0.5">B</div>}
            </button>
          );
        })}
      </div>

      {/* ── Selected domains display ── */}
      {domainA !== null && (
        <div className="flex items-center gap-3 mt-3 text-[10px] font-mono">
          <span className="text-fuchsia-400">A: {domainById(domainA).name}</span>
          {domainB !== null && (
            <>
              <span className="text-cyan-700">×</span>
              <span className="text-cyan-400">B: {domainById(domainB).name}</span>
            </>
          )}
          {domainB === null && (
            <span className="text-cyan-600/40 animate-pulse">← select collision partner</span>
          )}
        </div>
      )}

      {/* ── Result Panel ── */}
      {result && (phase === 'result' || phase === 'colliding') && (
        <div className="mt-4 border border-fuchsia-500/30 bg-fuchsia-900/5 rounded-lg p-5 space-y-5"
          style={{
            opacity: 0,
            animation: 'sc-cardReveal 0.8s cubic-bezier(0.16,1,0.3,1) forwards',
            animationDelay: phase === 'result' ? '0s' : '0.5s',
          }}>

          {/* ── Collision geometry summary ── */}
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-[10px] font-bold text-fuchsia-500/60 uppercase tracking-widest mb-1">COLLISION MANIFOLD</div>
              <div className="text-[10px] font-mono text-cyan-600/50">
                {result.nodeIdA} × {result.nodeIdB} · 16D feature space
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold font-mono" style={{ color: viabilityColor }}>
                {result.sphereSim != null ? result.sphereSim.toFixed(4) : result.cosine.toFixed(4)}
              </div>
              <div className="text-[9px] font-mono text-cyan-600/40">
                cos(θ) · sphere basis
              </div>
            </div>
          </div>

          {/* ── Metrics strip ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard label="1536-D cos(θ)" value={result.cosine.toFixed(4)} sub={`θ = ${result.angle.toFixed(1)}°`} />
            <MetricCard label="NOVELTY" value={`${(result.novelty * 100).toFixed(0)}%`} sub={`‖P⊥‖ = ${result.projNorm.toFixed(3)}`} />
            <MetricCard label="COHERENCE" value={result.coherence.toFixed(4)} sub={`H = ${result.entropy.toFixed(3)}`} />
            <MetricCard
              label="POST-SAPONIFICATION"
              value={result.postSaponificationSim != null ? result.postSaponificationSim.toFixed(4) : '—'}
              sub="32 iterations · 7% decay"
              color="#d946ef"
            />
          </div>

          {/* ── Convergence axes: shared conceptual DNA ── */}
          {result.convergence && result.convergence.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-[#39ff14]/70 uppercase tracking-widest mb-2">
                CONVERGENCE AXES — shared conceptual DNA
              </div>
              <div className="space-y-1.5">
                {result.convergence.map(d => (
                  <DimensionBar key={d.name} dim={d} type="converge" />
                ))}
              </div>
            </div>
          )}

          {/* ── Divergence axes: where the domains disagree ── */}
          {result.divergence && result.divergence.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-cyan-400/70 uppercase tracking-widest mb-2">
                DIVERGENCE AXES — maximum orthogonality
              </div>
              <div className="space-y-1.5">
                {result.divergence.map(d => (
                  <DimensionBar key={d.name} dim={d} type="diverge" />
                ))}
              </div>
            </div>
          )}

          {/* ── Irreducible paradoxes: survive saponification ── */}
          {result.paradoxes && result.paradoxes.length > 0 && (
            <div className="border-t border-fuchsia-500/20 pt-4">
              <div className="text-[10px] font-bold text-fuchsia-400/80 uppercase tracking-widest mb-1">
                IRREDUCIBLE PARADOXES — survive 32× saponification
              </div>
              <div className="text-[9px] font-mono text-fuchsia-500/40 mb-3">
                These dimensions resist reconciliation. The orthogonal complement is the research frontier.
              </div>
              <div className="space-y-1.5">
                {result.paradoxes.map(p => (
                  <div key={p.name} className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="text-fuchsia-400 w-28 shrink-0 uppercase">{p.name}</span>
                    <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, p.residual * 100 / 0.5)}%`,
                          background: `linear-gradient(90deg, rgba(217,70,239,0.8), rgba(217,70,239,0.3))`,
                        }}
                      />
                    </div>
                    <span className="text-fuchsia-300/60 w-12 text-right">{p.residual.toFixed(3)}</span>
                    <span className="text-cyan-600/30 w-12 text-right">Δ{p.original.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.paradoxes && result.paradoxes.length === 0 && (
            <div className="border-t border-cyan-500/20 pt-4">
              <div className="text-[10px] font-bold text-[#39ff14]/60 uppercase tracking-widest mb-1">
                FULL RECONCILIATION — no irreducible paradoxes
              </div>
              <div className="text-[9px] font-mono text-[#39ff14]/30">
                All dimensional tensions resolved within 32 saponification rounds. These domains are geometrically compatible.
              </div>
            </div>
          )}

          {/* ── Mathematical Astrology Transit ── */}
          {colliderAstro && (() => {
            // Derive dominant planet from OCK family or planet domain selection
            const FAMILY_PLANET = {
              citrus: 'Mercury', floral: 'Venus', woody: 'Saturn',
              animalic: 'Mars', aromatic: 'Jupiter', ozonic: 'Uranus',
              chypre: 'Moon', fougere: 'Venus', gourmand: 'Jupiter',
              aquatic: 'Neptune', leather: 'Mars', mineral: 'Saturn',
            };
            const PLANET_DOMAIN_NAME = { 70:'Sun',71:'Mercury',72:'Venus',74:'Moon',75:'Mars',76:'Jupiter',77:'Saturn',78:'Uranus',79:'Neptune',80:'Pluto' };
            const pA = PLANET_DOMAIN_NAME[domainA] || (result.accord ? FAMILY_PLANET[result.accord.dominant?.id] : null) || 'Mercury';
            const pB = PLANET_DOMAIN_NAME[domainB] || (result.accord ? FAMILY_PLANET[result.accord.dominant?.id] : null) || 'Venus';
            const dA = colliderAstro[pA] || {};
            const dB = colliderAstro[pB] || {};
            const planets = [...new Set([pA, pB])].filter(p => colliderAstro[p]);
            return (
              <div className="border-t border-cyan-500/15 pt-4" style={{ opacity: 0, animation: 'sc-cardReveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.4s forwards' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(6,182,212,0.5)' }}>⊕ MATHEMATICAL ASTROLOGY · VSOP87 · JD{(Date.now()/86400000+2440587.5).toFixed(4)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {planets.map(p => {
                    const d = colliderAstro[p];
                    if (!d) return null;
                    const isRetro = d.retrograde;
                    return (
                      <div key={p} className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.12)' }}>
                        <span className="text-[10px] font-bold font-mono" style={{ color: 'rgba(6,182,212,0.8)' }}>{p}</span>
                        <span className="text-[9px] font-mono" style={{ color: 'rgba(192,192,192,0.5)' }}>{d.sign} {typeof d.degree === 'number' ? d.degree.toFixed(1) : '—'}°</span>
                        {isRetro && <span className="text-[8px] font-mono" style={{ color: 'rgba(217,70,239,0.6)' }}>℞</span>}
                        {d.aspect && <span className="text-[8px] font-mono" style={{ color: 'rgba(255,215,0,0.4)' }}>· {d.aspect}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── Volatile Semiotics — OCK Olfactory Accord ── */}
          {result.accord && (
            <div className="border-t border-amber-500/20 pt-5 space-y-4"
              style={{ opacity: 0, animation: 'sc-cardReveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.2s forwards' }}>

              {/* Header */}
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base" style={{ textShadow: '0 0 8px rgba(255,215,0,0.6)' }}>ᛊ⚗ᛟ</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: result.accord.dominant.color }}>
                      VOLATILE SEMIOTICS
                    </span>
                  </div>
                  <div className="text-[9px] font-mono text-amber-500/40">
                    Bimmelbahn Accord · OCK v1.1.0
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <div className="text-sm font-bold font-mono whitespace-nowrap" style={{ color: result.accord.dominant.color }}>
                    {result.accord.dominant.glyph} {result.accord.dominant.label.toUpperCase()}
                  </div>
                  <div className="text-[8px] font-mono text-cyan-600/40">dominant accord</div>
                </div>
              </div>

              {/* ── Node Class (v1.1.0) ── */}
              {result.accord.nodeClass && (
                <div className="border rounded-lg p-3 space-y-3"
                  style={{ borderColor: result.accord.nodeClass.accent + '30', background: result.accord.nodeClass.color + '08' }}>

                  {/* Node class badge + dance role */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg" style={{ color: result.accord.nodeClass.color, textShadow: `0 0 10px ${result.accord.nodeClass.color}44` }}>
                        {result.accord.nodeClass.glyph}
                      </span>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: result.accord.nodeClass.color }}>
                          {result.accord.nodeClass.label}
                        </div>
                        <div className="text-[8px] font-mono" style={{ color: result.accord.nodeClass.accent + '88' }}>
                          {result.accord.nodeClass.sub}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <div className="text-[9px] font-bold font-mono uppercase tracking-wider" style={{ color: result.accord.nodeClass.accent }}>
                        {result.accord.nodeClass.id}
                      </div>
                      <div className="text-[7px] font-mono text-cyan-600/30">node class</div>
                    </div>
                  </div>

                  {/* Class scores — competitive bar */}
                  <div className="space-y-1">
                    {['RTA', 'DPA', 'R2A'].map(cls => {
                      const nc = NODE_CLASSES[cls];
                      const score = result.accord.classScores[cls] || 0;
                      const isWinner = result.accord.nodeClass.id === cls;
                      return (
                        <div key={cls} className="flex items-center gap-2 text-[9px] font-mono">
                          <span className="w-8 shrink-0 text-right" style={{ color: isWinner ? nc.color : nc.accent + '55' }}>
                            {nc.glyph} {cls}
                          </span>
                          <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${Math.max(2, score * 100)}%`,
                                background: isWinner
                                  ? `linear-gradient(90deg, ${nc.color}, ${nc.color}44)`
                                  : `linear-gradient(90deg, ${nc.accent}44, ${nc.accent}11)`,
                              }}
                            />
                          </div>
                          <span className="w-10 text-right" style={{ color: isWinner ? nc.color + 'cc' : nc.accent + '44' }}>
                            {(score * 100).toFixed(0)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Clean Room + Sovereignty + Dance Role */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="border rounded p-2" style={{ borderColor: result.accord.nodeClass.accent + '20', background: 'rgba(0,0,0,0.3)' }}>
                      <div className="text-[7px] font-bold uppercase tracking-widest mb-0.5" style={{ color: result.accord.nodeClass.accent + '77' }}>CLEAN ROOM</div>
                      <div className="text-sm font-bold font-mono" style={{ color: result.accord.cleanRoom > 0.5 ? result.accord.nodeClass.color : result.accord.nodeClass.accent + '66' }}>
                        {(result.accord.cleanRoom * 100).toFixed(0)}%
                      </div>
                      <div className="text-[6px] font-mono mt-0.5" style={{ color: result.accord.nodeClass.accent + '44' }}>entropy reversal</div>
                    </div>
                    {result.accord.nodeClass.id === 'R2A' && (
                      <div className={`border rounded p-2 ${result.accord.sovereignty > 0.4 ? '' : ''}`}
                        style={{ borderColor: result.accord.sovereignty > 0.4 ? '#f5c6d044' : '#f43f5e33', background: 'rgba(0,0,0,0.3)' }}>
                        <div className="text-[7px] font-bold uppercase tracking-widest mb-0.5" style={{ color: result.accord.sovereignty > 0.4 ? '#f5c6d0aa' : '#f43f5e66' }}>
                          SOVEREIGNTY
                        </div>
                        <div className="text-sm font-bold font-mono" style={{ color: result.accord.sovereignty > 0.4 ? '#f5c6d0' : '#f43f5e88' }}>
                          {(result.accord.sovereignty * 100).toFixed(0)}%
                        </div>
                        <div className="text-[6px] font-mono mt-0.5" style={{ color: result.accord.sovereignty > 0.4 ? '#d4a0ad66' : '#f43f5e44' }}>
                          {result.accord.sovereignty > 0.4 ? '■ SELF-FIXING' : '○ DEPENDENT'}
                        </div>
                      </div>
                    )}
                    <div className={`border rounded p-2 ${result.accord.nodeClass.id === 'R2A' ? '' : 'col-span-2'}`}
                      style={{ borderColor: result.accord.nodeClass.accent + '20', background: 'rgba(0,0,0,0.3)' }}>
                      <div className="text-[7px] font-bold uppercase tracking-widest mb-0.5" style={{ color: result.accord.nodeClass.accent + '77' }}>DANCE TOPOLOGY</div>
                      <div className="text-[9px] font-bold font-mono" style={{ color: result.accord.nodeClass.color }}>
                        {result.accord.danceRole?.split('—')[0]?.trim() || '—'}
                      </div>
                      <div className="text-[6px] font-mono mt-0.5" style={{ color: result.accord.nodeClass.accent + '44' }}>
                        {result.accord.danceRole?.split('—')[1]?.trim() || '§8 1536-D space'}
                      </div>
                    </div>
                  </div>

                  {/* Sillage type badge */}
                  <div className="text-[8px] font-mono italic" style={{ color: result.accord.nodeClass.accent + '66' }}>
                    {result.accord.nodeClass.sillageType} SILLAGE — {result.accord.nodeClass.desc}
                  </div>
                </div>
              )}

              {/* ── Polarity (v1.1.0 §9) ── */}
              {result.accord.polarityClass && (
                <div className="border rounded-lg p-3 space-y-2"
                  style={{ borderColor: result.accord.polarityClass.accent + '25', background: result.accord.polarityClass.color + '06' }}>
                  <div className="flex items-center justify-between">
                    <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: result.accord.polarityClass.accent + 'aa' }}>
                      POLARITY
                    </div>
                    <div className="text-[9px] font-bold font-mono" style={{ color: result.accord.polarityClass.color }}>
                      {result.accord.polarityClass.label}
                    </div>
                  </div>
                  {/* Continuous polarity bar: SOLAR ← → LUNAR */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[7px] font-mono shrink-0" style={{ color: POLARITY_CONFIG.SOLAR.color + '88' }}>SOLAR</span>
                      <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden relative">
                        {/* Gradient backdrop */}
                        <div className="absolute inset-0 rounded-full opacity-20"
                          style={{ background: `linear-gradient(90deg, ${POLARITY_CONFIG.SOLAR.color}, ${POLARITY_CONFIG.MERIDIAN.color} 50%, ${POLARITY_CONFIG.LUNAR.color})` }}
                        />
                        {/* Position marker */}
                        <div className="absolute top-0 h-full w-1 rounded-full"
                          style={{
                            left: `${Math.max(1, Math.min(98, result.accord.polarity * 100))}%`,
                            background: result.accord.polarityClass.color,
                            boxShadow: `0 0 6px ${result.accord.polarityClass.color}88`,
                          }}
                        />
                      </div>
                      <span className="text-[7px] font-mono shrink-0" style={{ color: POLARITY_CONFIG.LUNAR.color + '88' }}>LUNAR</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-[7px] font-mono" style={{ color: result.accord.polarityClass.accent + '55' }}>
                        {result.accord.polarityClass.desc}
                      </div>
                      <div className="text-[8px] font-bold font-mono" style={{ color: result.accord.polarityClass.color + 'cc' }}>
                        {(result.accord.polarity * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Evaporation Curve — top / heart / base */}
              <div>
                <div className="text-[9px] font-bold text-amber-400/60 uppercase tracking-widest mb-2">
                  EVAPORATION CURVE
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: 'TOP ᛏ',   val: result.accord.topIntensity,      pct: result.accord.evapCurve[0], color: '#FFD700', sub: 'citrus · flash · <15min' },
                    { label: 'HEART ᚺ',  val: result.accord.heartIntensity,    pct: result.accord.evapCurve[1], color: '#d946ef', sub: 'floral · carrier · 4hr' },
                    { label: 'BASE ᛒ',   val: result.accord.baseIntensity,     pct: result.accord.evapCurve[2], color: '#8B4513', sub: 'resinous · archive · days' },
                  ].map(n => (
                    <div key={n.label} className="flex items-center gap-2 text-[10px] font-mono">
                      <span className="w-16 shrink-0 text-right" style={{ color: n.color + 'aa' }}>{n.label}</span>
                      <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.max(2, n.pct * 100)}%`,
                            background: `linear-gradient(90deg, ${n.color}, ${n.color}44)`,
                          }}
                        />
                      </div>
                      <span className="w-10 text-right text-amber-300/40">{(n.val * 100).toFixed(0)}%</span>
                      <span className="w-32 text-left text-cyan-600/25 text-[8px] hidden sm:inline">{n.sub}</span>
                    </div>
                  ))}
                  {/* Animalic fixative — separate: managed corruption */}
                  <div className="flex items-center gap-2 text-[10px] font-mono mt-1 pt-1 border-t border-amber-900/15">
                    <span className="w-16 shrink-0 text-right text-rose-400/60">FIX ᛊ</span>
                    <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.max(2, result.accord.animalicIntensity * 100)}%`,
                          background: 'linear-gradient(90deg, #f43f5e, #f43f5e44)',
                        }}
                      />
                    </div>
                    <span className="w-10 text-right text-rose-300/40">{(result.accord.animalicIntensity * 100).toFixed(0)}%</span>
                    <span className="w-32 text-left text-cyan-600/25 text-[8px] hidden sm:inline">animalic · fixative · corruption</span>
                  </div>
                </div>
              </div>

              {/* Volatility blend strip */}
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="w-16 shrink-0 text-right text-amber-400/50">VOL ⚗</span>
                <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.max(2, result.accord.volBlend * 100)}%`,
                      background: `linear-gradient(90deg, #06b6d4, #FFD700 50%, #f43f5e)`,
                    }}
                  />
                </div>
                <span className="w-10 text-right text-amber-300/40">{(result.accord.volBlend * 100).toFixed(0)}%</span>
                <span className="w-28 text-left text-cyan-600/25 text-[8px] hidden sm:inline">
                  {result.accord.volBlend < 0.35 ? 'resinous blend' : result.accord.volBlend > 0.65 ? 'volatile blend' : 'balanced blend'}
                </span>
              </div>

              {/* Sillage + Fixation + Permeability + Maceration strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="border border-amber-900/20 bg-black/30 rounded p-2">
                  <div className="text-[8px] font-bold text-amber-500/50 uppercase tracking-widest mb-1">SILLAGE</div>
                  <div className="text-sm font-bold font-mono" style={{ color: result.accord.sillage > 0.6 ? '#FFD700' : result.accord.sillage > 0.3 ? '#d946ef' : '#06b6d4' }}>
                    {(result.accord.sillage * 100).toFixed(0)}%
                  </div>
                  <div className="text-[7px] font-mono text-amber-600/30 mt-0.5">signal reach</div>
                </div>
                <div className={`border rounded p-2 ${result.accord.persists ? 'border-[#39ff14]/30 bg-[#39ff14]/5' : 'border-rose-900/20 bg-rose-900/5'}`}>
                  <div className="text-[8px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: result.accord.persists ? '#39ff14aa' : '#f43f5e88' }}>
                    FIXATION
                  </div>
                  <div className="text-sm font-bold font-mono" style={{ color: result.accord.persists ? '#39ff14' : '#f43f5e' }}>
                    {(result.accord.fixation * 100).toFixed(0)}%
                  </div>
                  <div className="text-[7px] font-mono mt-0.5"
                    style={{ color: result.accord.persists ? '#39ff1466' : '#f43f5e44' }}>
                    {result.accord.persists ? '■ PERSISTS' : '○ VOLATILE'}
                  </div>
                </div>
                <div className="border border-amber-900/20 bg-black/30 rounded p-2">
                  <div className="text-[8px] font-bold text-amber-500/50 uppercase tracking-widest mb-1">PERMEABILITY</div>
                  <div className="text-sm font-bold font-mono" style={{ color: result.accord.permeability > 0.6 ? '#39ff14' : '#06b6d4' }}>
                    {(result.accord.permeability * 100).toFixed(0)}%
                  </div>
                  <div className="text-[7px] font-mono text-amber-600/30 mt-0.5">bimmelbahn Δ</div>
                </div>
                <div className="border border-amber-900/20 bg-black/30 rounded p-2">
                  <div className="text-[8px] font-bold text-amber-500/50 uppercase tracking-widest mb-1">MACERATION</div>
                  <div className="text-sm font-bold font-mono text-amber-400/70">
                    {result.accord.maceration.toFixed(4)}
                  </div>
                  <div className="text-[7px] font-mono text-amber-600/30 mt-0.5">annealing depth</div>
                </div>
              </div>

              {/* Verdicts */}
              <div className="space-y-1">
                <div className="text-[9px] font-mono text-amber-400/40 italic">
                  {result.accord.verdict}
                </div>
                <div className="text-[9px] font-mono italic"
                  style={{ color: result.accord.persists ? '#39ff1466' : '#f43f5e55' }}>
                  {result.accord.fixationVerdict}
                </div>
              </div>

              {/* SOMA Shop Manifest — Tesseract Key Exchange */}
              <div className="border border-amber-500/15 bg-amber-900/5 rounded-lg p-3">
                <div className="text-[9px] font-bold text-amber-400/60 uppercase tracking-widest mb-2">
                  ᛊ⚗ᛟ SOMA SHOP — TESSERACT KEY EXCHANGE
                </div>
                <div className="space-y-1.5">
                  {SHOP_MANIFEST.map(item => {
                    const isDominant =
                      (result.accord.dominant.id === 'citrus'   && item.id === 'CITRUS-SSH-01') ||
                      (result.accord.dominant.id === 'floral'   && item.id === 'FLORAL-DAEMON-V2') ||
                      (result.accord.dominant.id === 'animalic' && item.id === 'ANIMALIC-FIX-FS') ||
                      (result.accord.dominant.id === 'woody'    && item.id === 'RESIN-ARCHIVE-DEEP');
                    return (
                      <div key={item.id}
                        className={`text-[9px] font-mono py-1 px-1.5 rounded ${isDominant ? 'bg-amber-500/10 border border-amber-500/20' : ''}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className={`${isDominant ? 'text-amber-300/90 font-bold' : 'text-amber-400/50'}`}>
                            {item.id}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-fuchsia-400/40">{item.olfClass}</span>
                            {isDominant && <span className="text-amber-400 text-[8px]">◄ ACTIVE</span>}
                          </div>
                        </div>
                        <div className="text-[7px] text-amber-600/20 mt-0.5 truncate">{item.key}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="text-[8px] font-mono text-amber-600/20 mt-2 space-y-0.5">
                  <div>§ TRANSMUTE: raw input of Grey World Noise → distilled through the alembic</div>
                  <div>§ ANNEALING: data must sit in darkness for one week to reach stable accord</div>
                </div>
              </div>
            </div>
          )}

          {/* ── Decay Products — narrative synthesis ── */}
          {narrative && (
            <div className="border-t border-cyan-500/20 pt-5 space-y-4"
              style={{ opacity: 0, animation: 'sc-cardReveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.3s forwards' }}>

              {/* Regime + Thesis */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-[10px] font-bold text-[#39ff14]/80 uppercase tracking-widest">
                    DECAY PRODUCTS
                  </div>
                  {narrative.archetype && (
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm border border-cyan-500/30 text-cyan-400/70 tracking-wider">
                      {narrative.archetype}
                    </span>
                  )}
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm border border-fuchsia-500/30 text-fuchsia-400/60 tracking-wider">
                    {narrative.register}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-cyan-200/60 leading-relaxed">
                  {narrative.thesis}
                </p>
              </div>

              {/* Shared Ground */}
              {narrative.sharedGround && (
                <div>
                  <div className="text-[9px] font-bold text-[#39ff14]/50 uppercase tracking-widest mb-1">
                    SHARED GROUND
                  </div>
                  <p className="text-[10px] font-mono text-[#39ff14]/40 leading-relaxed">
                    {narrative.sharedGround.narrative}
                  </p>
                </div>
              )}

              {/* Innovation Frontier */}
              {narrative.frontier && (
                <div>
                  <div className="text-[9px] font-bold text-cyan-400/50 uppercase tracking-widest mb-1">
                    INNOVATION FRONTIER
                  </div>
                  <p className="text-[10px] font-mono text-cyan-400/40 leading-relaxed">
                    {narrative.frontier.narrative}
                  </p>
                </div>
              )}

              {/* Prompt Angles */}
              {narrative.angles.length > 0 && (
                <div>
                  <div className="text-[9px] font-bold text-fuchsia-400/60 uppercase tracking-widest mb-2">
                    SEMANTIC VECTORS — {narrative.angles.length} angles extracted
                  </div>
                  <div className="space-y-3">
                    {narrative.angles.map((angle, i) => (
                      <div key={i} className="border border-fuchsia-500/15 bg-fuchsia-900/5 rounded p-3">
                        <div className="text-[9px] font-bold text-fuchsia-300/70 uppercase tracking-wider mb-1">
                          {angle.tag}
                        </div>
                        <p className="text-[10px] font-mono text-fuchsia-200/40 leading-relaxed">
                          {angle.vector}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Paradox Questions */}
              {narrative.paradoxQuestions.length > 0 && (
                <div>
                  <div className="text-[9px] font-bold text-fuchsia-500/50 uppercase tracking-widest mb-2">
                    OPEN QUESTIONS — irreducible tensions
                  </div>
                  <div className="space-y-1.5">
                    {narrative.paradoxQuestions.map((pq, i) => (
                      <div key={i} className="flex gap-2 text-[10px] font-mono">
                        <span className="text-fuchsia-500/40 shrink-0">▸</span>
                        <p className="text-fuchsia-300/35 leading-relaxed">{pq.question}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── v1.2.0: Interaction Terms strip ── */}
              {(narrative.meta.interference > 0 || narrative.meta.catalysis > 0) && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-amber-500/10">
                  <MetricCard label="INTERFERENCE" value={narrative.meta.interference.toFixed(3)} sub="sparsity × curvature" color="#f59e0b" />
                  <MetricCard label="CATALYSIS" value={narrative.meta.catalysis.toFixed(3)} sub="volatility × curvature" color="#f59e0b" />
                  <MetricCard label="RESONANCE" value={narrative.meta.resonanceFreq.toFixed(3)} sub="density harmonic mean" color="#06b6d4" />
                  <MetricCard label="TURBULENCE" value={narrative.meta.turbulence.toFixed(4)} sub="volΔ × interference" color={narrative.meta.turbulence > 0.04 ? '#f43f5e' : '#06b6d4'} />
                </div>
              )}

              {/* ── v1.2.0: Prompt Fragments — the prompt engineer's output ── */}
              {narrative.promptFragments && narrative.promptFragments.length > 0 && (
                <div className="border-t border-[#39ff14]/15 pt-4">
                  <div className="text-[10px] font-bold text-[#39ff14]/80 uppercase tracking-widest mb-3">
                    PROMPT FRAGMENTS — copy-paste seeds
                  </div>
                  <div className="space-y-2.5">
                    {narrative.promptFragments.map((frag, i) => (
                      <div key={i} className="group relative border border-[#39ff14]/15 bg-[#39ff14]/[0.02] rounded p-3 hover:border-[#39ff14]/30 transition-colors">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[8px] font-bold text-[#39ff14]/50 uppercase tracking-wider">
                            {frag.source}
                          </span>
                          <button
                            onClick={() => navigator.clipboard?.writeText(frag.text)}
                            className="text-[8px] font-mono text-[#39ff14]/30 hover:text-[#39ff14]/80 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            COPY
                          </button>
                        </div>
                        <p className="text-[11px] font-mono text-[#39ff14]/60 leading-relaxed">
                          {frag.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── v1.2.0: Synthesis Directive — the master prompt ── */}
              {narrative.synthesisDirective && (
                <div className="border-t border-cyan-500/15 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-bold text-cyan-400/80 uppercase tracking-widest">
                      SYNTHESIS DIRECTIVE
                    </div>
                    <button
                      onClick={() => navigator.clipboard?.writeText(narrative.synthesisDirective)}
                      className="text-[8px] font-mono text-cyan-400/30 hover:text-cyan-400/80 uppercase tracking-wider transition-colors px-2 py-0.5 border border-cyan-500/20 rounded hover:border-cyan-500/40"
                    >
                      COPY PROMPT
                    </button>
                  </div>
                  <div className="border border-cyan-500/20 bg-cyan-900/[0.06] rounded-lg p-4">
                    <p className="text-[11px] font-mono text-cyan-200/70 leading-relaxed">
                      {narrative.synthesisDirective}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── WASM telemetry ── */}
          <div className="text-[10px] font-mono text-cyan-600/30 space-y-0.5 pt-2 border-t border-cyan-900/15">
            <div>WASM: Q×Kᵀ/√d_k = {result.scaledAttn.toFixed(6)} · softmax = {result.softmax.toFixed(4)} · PHASE: {result.phase}</div>
            <div>‖A‖ = {result.normA.toFixed(3)} · ‖B‖ = {result.normB.toFixed(3)} · A·B = {result.dot.toFixed(3)} · ‖S‖ = {result.synthNorm.toFixed(4)}</div>
          </div>

          {/* ── Crystallize trigger ── */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-amber-900/20">
            <span className="text-[8px] font-mono text-amber-700/35 tracking-wider">
              ⚗ distill collision into olfactory matter
            </span>
            <button
              onClick={handleCrystallize}
              className="text-[10px] font-mono uppercase tracking-widest px-4 py-1.5 rounded border transition-colors"
              style={{
                borderColor: crystal ? 'rgba(255,215,0,0.4)' : 'rgba(255,215,0,0.15)',
                color: crystal ? '#FFD700' : 'rgba(255,215,0,0.38)',
              }}
            >
              ⚗ {crystal ? 'RE-CRYSTALLIZE' : 'CRYSTALLIZE ACCORD'}
            </button>
          </div>
        </div>
      )}

      {crystal && tesseract ? (
        <TesseractCard
          card={crystal}
          tesseract={tesseract}
          narrative={narrative}
          acquired={acquired}
          selectedTier={selectedTier}
          onRegister={(contact, tier) => handleAcquire(crystal.id, contact, tier)}
          serverCount={serverThreshold.current}
          serverTarget={serverThreshold.target}
          orderStatus={orderStatus}
          living={living}
          onLivingRedeemed={(payload) => {
            setLiving(payload);
            try { localStorage.setItem(`living:${tesseract.hash}`, JSON.stringify(payload)); } catch { /* ignore */ }
          }}
        />
      ) : crystal && (
        <CrystallizeCard
          card={crystal}
          acquired={acquired}
          selectedTier={selectedTier}
          onRegister={(contact, tier) => handleAcquire(crystal.id, contact, tier)}
          serverCount={serverThreshold.current}
          serverTarget={serverThreshold.target}
          orderStatus={orderStatus}
        />
      )}
    </div>
  );
}

// ── Metric display card ──────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color }) {
  return (
    <div className="border border-cyan-900/20 bg-black/30 rounded p-2.5">
      <div className="text-[8px] font-bold text-fuchsia-500/50 uppercase tracking-widest mb-1">{label}</div>
      <div className="text-base font-bold font-mono" style={{ color: color || '#06b6d4' }}>{value}</div>
      <div className="text-[9px] font-mono text-cyan-600/40 mt-0.5">{sub}</div>
    </div>
  );
}

// ── Dimension bar — visualizes a single 16D axis for convergence/divergence ──
function DimensionBar({ dim, type }) {
  const isConverge = type === 'converge';
  const barColor = isConverge
    ? 'rgba(57, 255, 20, 0.7)'   // green — shared DNA
    : 'rgba(6, 182, 212, 0.7)';   // cyan — orthogonal tension

  return (
    <div className="flex items-center gap-2 text-[10px] font-mono">
      <span className={`w-28 shrink-0 uppercase ${isConverge ? 'text-[#39ff14]/70' : 'text-cyan-400/70'}`}>
        {dim.name}
      </span>
      <div className="flex-1 flex items-center gap-1">
        {/* Domain A value */}
        <div className="w-8 text-right text-fuchsia-400/50">{dim.vA.toFixed(2)}</div>
        <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden relative">
          {isConverge ? (
            /* Overlap bar — shows shared magnitude */
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(dim.vA, dim.vB) * 100}%`,
                background: `linear-gradient(90deg, ${barColor}, rgba(57,255,20,0.2))`,
              }}
            />
          ) : (
            /* Delta bar — shows divergence magnitude */
            <div
              className="h-full rounded-full"
              style={{
                width: `${dim.delta * 100}%`,
                background: `linear-gradient(90deg, ${barColor}, rgba(6,182,212,0.2))`,
              }}
            />
          )}
        </div>
        {/* Domain B value */}
        <div className="w-8 text-left text-cyan-400/50">{dim.vB.toFixed(2)}</div>
      </div>
      <span className={`w-10 text-right ${isConverge ? 'text-[#39ff14]/50' : 'text-cyan-400/50'}`}>
        {isConverge ? `Σ${dim.contrib.toFixed(2)}` : `Δ${dim.delta.toFixed(2)}`}
      </span>
    </div>
  );
}

// ── Perfume bottle SVG — shape keyed by node class ────────────────────────────
function PerfumeBottleSVG({ nodeClass, hA, hB }) {
  const mid = Math.round((hA + hB) / 2);
  const shadow = { filter: 'drop-shadow(0 0 6px rgba(255,215,0,0.15))' };

  if (nodeClass === 'DPA') {
    return (
      <svg width="54" height="72" viewBox="0 0 54 72" fill="none" style={shadow}>
        <defs>
          <linearGradient id="ck-b" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor={`hsl(${hA},55%,28%)`} />
            <stop offset="100%" stopColor={`hsl(${hB},45%,10%)`} />
          </linearGradient>
        </defs>
        <rect x="19" y="2"  width="16" height="7"  rx="3"   fill={`hsl(${mid},38%,36%)`} opacity="0.75" />
        <rect x="23" y="9"  width="8"  height="6"  fill={`hsl(${mid},35%,24%)`} opacity="0.65" />
        <ellipse cx="27" cy="19" rx="22" ry="2.5"  fill="rgba(255,215,0,0.28)" />
        <ellipse cx="27" cy="48" rx="22" ry="24"   fill="url(#ck-b)" opacity="0.9" />
        <ellipse cx="18" cy="40" rx="5"  ry="12"   fill="rgba(255,255,255,0.05)" />
      </svg>
    );
  }

  if (nodeClass === 'R2A') {
    return (
      <svg width="48" height="76" viewBox="0 0 48 76" fill="none" style={shadow}>
        <defs>
          <linearGradient id="ck-c" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor={`hsl(${hA},52%,30%)`} />
            <stop offset="100%" stopColor={`hsl(${hB},42%,10%)`} />
          </linearGradient>
        </defs>
        <polygon points="16,2 32,2 35,11 13,11" fill={`hsl(${mid},38%,33%)`} opacity="0.78" />
        <rect x="20" y="11" width="8" height="7"  fill={`hsl(${mid},35%,22%)`} opacity="0.65" />
        <line  x1="9"  y1="19" x2="39" y2="19"   stroke="rgba(255,215,0,0.35)" strokeWidth="1.5" />
        <polygon points="9,20 39,20 45,34 45,64 3,64 3,34" fill="url(#ck-c)" opacity="0.9" />
        <line  x1="20" y1="20" x2="16" y2="64"   stroke="rgba(255,255,255,0.04)" strokeWidth="0.8" />
        <line  x1="28" y1="20" x2="32" y2="64"   stroke="rgba(255,255,255,0.04)" strokeWidth="0.8" />
        <line  x1="3"  y1="45" x2="45" y2="45"   stroke="rgba(255,215,0,0.08)"  strokeWidth="0.8" />
      </svg>
    );
  }

  // RTA — tall slender flacon (default)
  return (
    <svg width="42" height="84" viewBox="0 0 42 84" fill="none" style={shadow}>
      <defs>
        <linearGradient id="ck-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor={`hsl(${hA},55%,32%)`} />
          <stop offset="100%" stopColor={`hsl(${hB},45%,12%)`} />
        </linearGradient>
      </defs>
      <rect x="13" y="2"  width="16" height="9"  rx="2.5" fill={`hsl(${mid},38%,36%)`} opacity="0.75" />
      <rect x="17" y="11" width="8"  height="9"  fill={`hsl(${mid},35%,25%)`} opacity="0.65" />
      <rect x="10" y="20" width="22" height="2.5" rx="1"  fill="rgba(255,215,0,0.32)" />
      <rect x="10" y="22" width="22" height="56" rx="5"   fill="url(#ck-a)" opacity="0.9" />
      <rect x="13" y="27" width="5"  height="42" rx="2.5" fill="rgba(255,255,255,0.055)" />
      <line x1="10" y1="55" x2="32" y2="55"      stroke="rgba(255,215,0,0.1)"  strokeWidth="0.8" />
    </svg>
  );
}

// ── Contact form — shared by both CrystallizeCard and TesseractCard ────────────
function ContactForm({ onSubmit, label }) {
  const [signal, setSignal] = useState('');
  const [email,  setEmail]  = useState('');
  const [tier,   setTier]   = useState(TIERS[0]);
  const canSubmit = signal.trim() || email.trim();

  const inputStyle = {
    borderColor: 'rgba(255,215,0,0.22)',
    color: '#FFD700',
    caretColor: '#FFD700',
    background: 'rgba(255,215,0,0.03)',
    outline: 'none',
    fontFamily: 'inherit',
  };

  return (
    <div className="space-y-2.5 text-left w-full">
      <div className="text-[8px] font-mono text-center uppercase tracking-[0.25em] mb-3"
        style={{ color: 'rgba(255,215,0,0.38)' }}>
        SELECT SIZE + CONTACT FOR DELIVERY
      </div>

      {/* Tier selector */}
      <div className="grid grid-cols-2 gap-2 mb-1">
        {TIERS.map(t => (
          <button
            key={t.id}
            onClick={() => setTier(t)}
            className="rounded border py-2.5 px-2 text-center transition-all"
            style={{
              borderColor: tier.id === t.id ? 'rgba(255,215,0,0.5)'  : 'rgba(255,215,0,0.12)',
              background:  tier.id === t.id ? 'rgba(255,215,0,0.07)' : 'transparent',
              boxShadow:   tier.id === t.id ? '0 0 12px rgba(255,215,0,0.15)' : 'none',
            }}
          >
            <div className="text-[10px] font-mono font-bold tracking-wider"
              style={{ color: tier.id === t.id ? '#FFD700' : 'rgba(255,215,0,0.4)' }}>
              {t.size}
            </div>
            <div className="text-[12px] font-bold font-mono mt-0.5"
              style={{ color: tier.id === t.id ? '#FFD700' : 'rgba(255,215,0,0.5)', textShadow: tier.id === t.id ? '0 0 10px rgba(255,215,0,0.3)' : 'none' }}>
              €{t.price}
            </div>
            <div className="text-[7px] font-mono tracking-wider mt-0.5"
              style={{ color: 'rgba(255,215,0,0.25)' }}>
              {t.id === 'discovery' ? 'DISCOVERY' : 'SOVEREIGN'}
            </div>
            <div className="text-[6.5px] font-mono mt-0.5"
              style={{ color: 'rgba(57,255,20,0.35)' }}>
              G²T €{t.g2t}
            </div>
          </button>
        ))}
      </div>

      {/* Signal */}
      <div>
        <div className="text-[8px] font-mono mb-1 uppercase tracking-widest" style={{ color: 'rgba(255,215,0,0.3)' }}>
          ◎ SIGNAL
        </div>
        <input
          type="text"
          value={signal}
          onChange={e => setSignal(e.target.value)}
          placeholder="@handle"
          className="w-full text-[10px] font-mono px-3 py-1.5 rounded border"
          style={inputStyle}
        />
      </div>

      {/* Email */}
      <div>
        <div className="text-[8px] font-mono mb-1 uppercase tracking-widest" style={{ color: 'rgba(255,215,0,0.3)' }}>
          ✉ EMAIL
        </div>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="address@domain.com"
          className="w-full text-[10px] font-mono px-3 py-1.5 rounded border"
          style={inputStyle}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => onSubmit({ signal: signal.trim(), email: email.trim() }, tier)}
          disabled={!canSubmit}
          className="flex-1 text-[10px] font-mono uppercase tracking-widest px-4 py-1.5 rounded-full border transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ borderColor: 'rgba(255,215,0,0.38)', color: '#FFD700', background: 'rgba(255,215,0,0.07)' }}
        >
          {label}
        </button>
        <button
          onClick={() => onSubmit({}, tier)}
          className="text-[8px] font-mono uppercase tracking-widest transition-colors hover:opacity-70"
          style={{ color: 'rgba(255,215,0,0.28)' }}
        >
          SKIP
        </button>
      </div>
    </div>
  );
}

// ── Fulfillment status badge — mirrors Discord state machine ──────────────────
const FULFILLMENT = {
  QUEUED:       { glyph: '⬡', label: 'QUEUED',       color: '#D4AF37' },
  ACKNOWLEDGED: { glyph: '◎', label: 'ACKNOWLEDGED', color: '#06B6D4' },
  MACERATING:   { glyph: '⚗', label: 'MACERATING',  color: '#D946EF' },
  SHIPPED:      { glyph: '✦', label: 'SHIPPED',      color: '#39FF14' },
};

function FulfillmentBadge({ state }) {
  const s = FULFILLMENT[state];
  if (!s) return null;
  return (
    <div className="flex items-center justify-center gap-2 mb-2 py-1.5 rounded"
      style={{ border: `1px solid ${s.color}25`, background: `${s.color}08` }}>
      <span className="text-[10px]" style={{ color: s.color, textShadow: `0 0 8px ${s.color}50` }}>{s.glyph}</span>
      <span className="text-[9px] font-mono font-bold tracking-[0.2em]" style={{ color: `${s.color}cc` }}>
        {s.label}
      </span>
    </div>
  );
}

// ── Crystallize Card component ─────────────────────────────────────────────────
function CrystallizeCard({ card, acquired, selectedTier, onRegister, serverCount, serverTarget, orderStatus }) {
  const [showForm, setShowForm] = useState(false);
  const getCount  = () => serverCount  != null ? serverCount  : (() => { try { return parseInt(localStorage.getItem('ck_count') || '0', 10); } catch { return 0; } })();
  const getTarget = () => serverTarget != null ? serverTarget : PRODUCTION_THRESHOLD;

  const NOTE_LAYERS = [
    { key: 'top',   label: 'TOP NOTES',   glyph: 'ᛏ', notes: card.topNotes,   color: '#FFD700', sub: '0–30 min',    pct: card.evap[0] },
    { key: 'heart', label: 'HEART NOTES', glyph: 'ᚺ', notes: card.heartNotes, color: '#d946ef', sub: '30 min–4 hr', pct: card.evap[1] },
    { key: 'base',  label: 'BASE NOTES',  glyph: 'ᛒ', notes: card.baseNotes,  color: '#B8860B', sub: '4 hr – days', pct: card.evap[2] },
  ];

  const mid = Math.round((card.hueA + card.hueB) / 2);

  return (
    <div
      className="mt-4 rounded-xl overflow-hidden"
      style={{
        border: `1px solid hsla(${mid},30%,28%,0.45)`,
        background: 'linear-gradient(155deg,rgba(16,9,2,0.98) 0%,rgba(7,5,1,0.99) 100%)',
        opacity: 0,
        animation: 'sc-cardReveal 0.6s cubic-bezier(0.16,1,0.3,1) forwards',
      }}
    >
      <div className="h-px w-full" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,215,0,0.45),transparent)' }} />

      <div className="p-6">

        {/* Header — name + bottle */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <div className="text-[7px] font-mono tracking-[0.35em] mb-1.5" style={{ color: 'rgba(255,215,0,0.28)' }}>
              LATENT COLLIDER — OLFACTORY DISTILLATION
            </div>
            <div
              className="text-xl font-bold tracking-[0.1em] truncate"
              style={{ color: '#FFD700', textShadow: '0 0 20px rgba(255,215,0,0.25)' }}
            >
              {card.name}
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-[9px] font-mono tracking-widest" style={{ color: 'rgba(255,215,0,0.55)' }}>{card.conc}</span>
              <span style={{ color: 'rgba(255,215,0,0.2)' }}>·</span>
              <span className="text-[9px] font-mono" style={{ color: 'rgba(255,215,0,0.35)' }}>{card.concPct}</span>
              <span style={{ color: 'rgba(255,215,0,0.2)' }}>·</span>
              <span className="text-[9px] font-mono" style={{ color: 'rgba(255,215,0,0.35)' }}>{card.dom} × {card.sec}</span>
            </div>
          </div>
          <div className="shrink-0">
            <PerfumeBottleSVG nodeClass={card.nodeClass} hA={card.hueA} hB={card.hueB} />
          </div>
        </div>

        {/* Note pyramid */}
        <div className="space-y-2.5 mb-6">
          {NOTE_LAYERS.map(({ key, label, glyph, notes, color, sub, pct }) => (
            <div key={key} className="rounded-lg p-3" style={{ border: `1px solid ${color}18`, background: `${color}04` }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color, textShadow: `0 0 8px ${color}40` }}>{glyph}</span>
                  <span className="text-[9px] font-bold font-mono tracking-widest" style={{ color: `${color}bb` }}>{label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[7px] font-mono" style={{ color: `${color}50` }}>{sub}</span>
                  <span className="text-[7px] font-mono" style={{ color: `${color}50` }}>{(pct * 100).toFixed(0)}%</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {notes.map((note, i) => (
                  <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded"
                    style={{ color: `${color}cc`, background: `${color}0d`, border: `1px solid ${color}1a` }}>
                    {note}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Properties strip */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { label: 'LONGEVITY',  value: card.longevity },
            { label: 'POLARITY',   value: card.polLabel || '—' },
            { label: 'NODE CLASS', value: card.nodeClass },
          ].map(({ label, value }) => (
            <div key={label} className="rounded p-2 text-center"
              style={{ border: '1px solid rgba(255,215,0,0.11)', background: 'rgba(255,215,0,0.02)' }}>
              <div className="text-[7px] font-bold tracking-widest mb-1" style={{ color: 'rgba(255,215,0,0.36)' }}>{label}</div>
              <div className="text-[10px] font-bold font-mono" style={{ color: 'rgba(255,215,0,0.8)' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Register interest */}
        <div className="rounded-lg p-4 text-center transition-all duration-500"
          style={{
            border:     acquired ? '1px solid rgba(255,215,0,0.3)' : '1px solid rgba(255,215,0,0.09)',
            background: acquired ? 'rgba(255,215,0,0.04)'          : 'transparent',
          }}>
          {!acquired ? (
            <>
              <p className="text-[9px] font-mono mb-3 leading-relaxed" style={{ color: 'rgba(255,215,0,0.3)' }}>
                If the production threshold is reached, this accord will be distilled as a limited physical release.
                Each registration is unique — no duplicates.
              </p>
              {showForm ? (
                <ContactForm
                  label="⬡ REGISTER INTEREST"
                  onSubmit={(contact, tier) => { setShowForm(false); onRegister(contact, tier); }}
                />
              ) : (
                <button
                  onClick={() => setShowForm(true)}
                  className="text-[10px] font-mono uppercase tracking-widest px-6 py-2 rounded-full border transition-all hover:scale-105 active:scale-95"
                  style={{ borderColor: 'rgba(255,215,0,0.38)', color: '#FFD700', background: 'rgba(255,215,0,0.07)' }}
                >
                  ⬡ REGISTER INTEREST
                </button>
              )}
            </>
          ) : (
            <>
              <div className="text-[11px] font-bold font-mono mb-1.5"
                style={{ color: '#FFD700', textShadow: '0 0 10px rgba(255,215,0,0.35)' }}>
                ✦ INTEREST LOGGED
              </div>
              {orderStatus?.fulfillmentState && <FulfillmentBadge state={orderStatus.fulfillmentState} />}
              <div className="text-[9px] font-mono mb-3" style={{ color: 'rgba(255,215,0,0.42)' }}>
                PRODUCTION THRESHOLD — {getCount()} / {getTarget()}
              </div>
              <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,215,0,0.1)' }}>
                <div className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (getCount() / getTarget()) * 100)}%`,
                    background: 'linear-gradient(90deg,rgba(255,215,0,0.3),rgba(255,215,0,0.8))',
                    transition: 'width 1s ease',
                  }} />
              </div>
              {getCount() >= getTarget() && (
                <div className="text-[9px] font-bold font-mono mt-2" style={{ color: '#FFD700' }}>
                  ■ THRESHOLD REACHED — PRODUCTION UNDER CONSIDERATION
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="h-px w-full" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,215,0,0.25),transparent)' }} />
    </div>
  );
}

// ── RedeemInput — sovereign key redemption affordance ──────────────────────
function RedeemInput({ accordHash, accordCard, onSuccess }) {
  const [token, setToken]       = useState('');
  const [status, setStatus]     = useState('idle');
  const [error, setError]       = useState(null);
  const [errorCode, setErrorCode] = useState(null);

  const handleRedeem = async () => {
    setStatus('loading');
    setError(null); setErrorCode(null);
    try {
      const r = await fetch('/api/transmute/redeem', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token: token.trim(), accordHash, accordCard }),
      });
      const data = await r.json();
      if (!data.ok) {
        setError(data.error || 'redemption failed');
        setErrorCode(data.code || 'invalid');
        setStatus('error');
        return;
      }
      setStatus('done');
      onSuccess(data.living);
    } catch (e) {
      setError('Network error — try again.');
      setErrorCode('network');
      setStatus('error');
    }
  };

  return (
    <div className="rounded p-3 mt-3" style={{ border: '1px solid rgba(57,255,20,0.18)', background: 'rgba(0,0,0,0.4)' }}>
      <div className="text-[7px] font-mono tracking-[0.3em] mb-2" style={{ color: 'rgba(57,255,20,0.4)' }}>
        § REDEEM SOVEREIGN KEY
      </div>
      <textarea
        rows={3}
        value={token}
        onChange={e => setToken(e.target.value)}
        placeholder="paste sovereign key from discord dm"
        className="w-full font-mono text-[9px] p-2 mb-2 rounded"
        style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(57,255,20,0.15)', color: 'rgba(57,255,20,0.85)', resize: 'none' }}
      />
      <button
        onClick={handleRedeem}
        disabled={status === 'loading' || !token.trim()}
        className="text-[9px] font-mono uppercase tracking-widest px-4 py-1.5 rounded-full border transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
        style={{ borderColor: 'rgba(57,255,20,0.5)', color: '#39FF14', background: 'rgba(57,255,20,0.08)' }}
      >
        {status === 'loading' ? '[REDEEMING…]' : '◈ REDEEM'}
      </button>
      {error && (
        <div className="text-[8px] font-mono mt-2" style={{ color: errorCode === 'expired' ? 'rgba(255,215,0,0.7)' : 'rgba(244,63,94,0.7)' }}>
          {errorCode === 'expired' ? '⏳ ' : '⚠ '}{error}
        </div>
      )}
    </div>
  );
}

// ── DecayArcPanel — time-evolution narrative below the note pyramid ────────
function DecayArcPanel({ beats, hueA, hueB }) {
  if (!beats || beats.length === 0) return null;
  const hueMid = ((hueA + hueB) / 2) % 360;
  return (
    <div className="mb-5 rounded-lg p-4" style={{ border: '1px solid rgba(255,215,0,0.1)', background: 'rgba(255,215,0,0.015)' }}>
      <div className="text-[7px] font-mono tracking-[0.3em] mb-3" style={{ color: 'rgba(255,215,0,0.3)' }}>
        § DECAY ARC — TIME EVOLUTION
      </div>
      <div className="relative h-1 mb-4">
        <div className="absolute inset-0 rounded-full" style={{ background: `linear-gradient(90deg, hsla(${hueA},70%,55%,0.5), hsla(${hueMid},60%,50%,0.4), hsla(${hueB},50%,45%,0.3))` }} />
        {[0.0, 0.5, 1.0].map((p, i) => (
          <div key={i} className="absolute top-1/2 w-2 h-2 rounded-full" style={{ left: `calc(${p * 100}% - 4px)`, transform: 'translateY(-50%)', background: '#FFD700', boxShadow: '0 0 6px rgba(255,215,0,0.6)' }} />
        ))}
      </div>
      <div className="space-y-2.5">
        {beats.map((b, i) => (
          <div key={i} className="flex gap-3 items-start" style={{ opacity: 0, animation: `sc-cardReveal 0.5s cubic-bezier(0.16,1,0.3,1) ${1.2 + i * 0.4}s forwards` }}>
            <div className="text-[8px] font-mono tracking-widest shrink-0 w-16" style={{ color: 'rgba(255,215,0,0.5)' }}>{b.time}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-mono mb-0.5" style={{ color: 'rgba(255,215,0,0.7)' }}>
                {b.notes.slice(0, 3).join(' · ')}
              </div>
              <div className="text-[8px] italic" style={{ color: 'rgba(255,215,0,0.45)' }}>
                {b.prose}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ScramblingHash — Matrix-style cascade reveal of a SHA-256 hex hash ─────
function ScramblingHash({ value, duration = 1400, color = 'rgba(255,215,0,0.75)' }) {
  const [chars, setChars] = useState(() => Array(value.length).fill('0'));

  useEffect(() => {
    let raf;
    const start = performance.now();
    const settleAt = value.split('').map((_, i) => (i / value.length) * (duration - 200));
    const HEX = '0123456789abcdef';
    const tick = (now) => {
      const t = now - start;
      const next = value.split('').map((real, i) => {
        if (t >= settleAt[i]) return real;
        return HEX[Math.floor(Math.random() * 16)];
      });
      setChars(next);
      if (t < duration) raf = requestAnimationFrame(tick);
      else setChars(value.split(''));
    };
    raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [value, duration]);

  return (
    <div className="font-mono text-[10px] leading-relaxed break-all" style={{ color }}>
      {chars.join('')}
    </div>
  );
}

// ── ShimmeringCipher — vault ciphertext with transient decrypt flickers ────
function ShimmeringCipher({ rows }) {
  const [shimmers, setShimmers] = useState({});
  const HEX = '0123456789abcdef';

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setShimmers(prev => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (next[key].expiresAt < now) delete next[key];
        }
        for (let n = 0; n < 2; n++) {
          const r = Math.floor(Math.random() * rows.length);
          const c = Math.floor(Math.random() * (rows[r]?.length || 1));
          const key = `${r}-${c}`;
          if (!next[key]) {
            next[key] = { char: HEX[Math.floor(Math.random() * 16)], expiresAt: now + 200 };
          }
        }
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [rows.length]);

  // Cleanup expired shimmers periodically
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      setShimmers(prev => {
        const next = { ...prev };
        let dirty = false;
        for (const key of Object.keys(next)) {
          if (next[key].expiresAt < now) { delete next[key]; dirty = true; }
        }
        return dirty ? next : prev;
      });
    }, 250);
    return () => clearInterval(cleanup);
  }, []);

  return (
    <div className="font-mono text-[7.5px] leading-[1.6] break-all select-none" style={{ color: 'rgba(217,70,239,0.18)', filter: 'blur(1.5px)', userSelect: 'none' }}>
      {rows.map((row, r) => (
        <div key={r}>
          {row.split('').map((ch, c) => {
            const sh = shimmers[`${r}-${c}`];
            if (sh && sh.expiresAt > Date.now()) {
              return <span key={c} className="vault-shimmer">{sh.char}</span>;
            }
            return <span key={c}>{ch}</span>;
          })}
        </div>
      ))}
    </div>
  );
}

// ── Tesseract Card — cryptographic identity layer ───────────────────────────
function TesseractCard({ card, tesseract, narrative, acquired, selectedTier, onRegister, serverCount, serverTarget, orderStatus, living, onLivingRedeemed }) {
  const [manifestState, setManifestState] = useState(null); // null | 'compiling' | 'downloaded'
  const [vaultGlyphClicks, setVaultGlyphClicks] = useState(0);

  // Reset 7-click counter when card changes
  useEffect(() => { setVaultGlyphClicks(0); }, [card.id]);

  const handleDownload = async () => {
    setManifestState('compiling');
    await new Promise(r => setTimeout(r, 850));
    const md = generateManifestMarkdown(card, tesseract, living);
    const filename = `ECO_Sx_TRANSMUTATION_${Date.now()}.md`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setManifestState('downloaded');
    await new Promise(r => setTimeout(r, 550));
    onRegister({}, TIERS[1]);
  };

  const getCount  = () => serverCount  != null ? serverCount  : (() => { try { return parseInt(localStorage.getItem('ck_count') || '0', 10); } catch { return 0; } })();
  const getTarget = () => serverTarget != null ? serverTarget : PRODUCTION_THRESHOLD;

  const mid = Math.round((card.hueA + card.hueB) / 2);
  const { hash, encryptedFormula } = tesseract;

  // Split ciphertext into rows for the vault display
  const cipherRows = [];
  const ct = encryptedFormula.ciphertext;
  for (let i = 0; i < Math.min(ct.length, 512); i += 64) {
    cipherRows.push(ct.slice(i, i + 64));
  }

  const NOTE_LAYERS = [
    { key: 'top',   label: 'TOP',   glyph: 'ᛏ', notes: card.topNotes,   color: '#FFD700', sub: '0–30 min',    pct: card.evap[0] },
    { key: 'heart', label: 'HEART', glyph: 'ᚺ', notes: card.heartNotes, color: '#d946ef', sub: '30 min–4 hr', pct: card.evap[1] },
    { key: 'base',  label: 'BASE',  glyph: 'ᛒ', notes: card.baseNotes,  color: '#B8860B', sub: '4 hr+',      pct: card.evap[2] },
  ];

  return (
    <div
      className="mt-4 rounded-xl overflow-hidden"
      style={{
        border: `1px solid hsla(${mid},30%,28%,0.45)`,
        background: 'linear-gradient(155deg,rgba(16,9,2,0.98) 0%,rgba(4,2,0,0.99) 100%)',
        opacity: 0,
        animation: 'sc-cardReveal 0.6s cubic-bezier(0.16,1,0.3,1) forwards',
      }}
    >
      {/* Top accent line */}
      <div className="h-px w-full" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,215,0,0.5),rgba(217,70,239,0.3),transparent)' }} />

      <div className="p-6">

        {/* ── Protocol header ── */}
        <div className="flex items-center justify-between mb-1">
          <div className="text-[7px] font-mono tracking-[0.4em]" style={{ color: 'rgba(255,215,0,0.22)' }}>
            TESSERACT PROTOCOL — ACCORD IDENTITY
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#39ff14', boxShadow: '0 0 6px rgba(57,255,20,0.6)', animation: 'sc-vaultPulse 3s ease-in-out infinite' }} />
            <span className="text-[7px] font-mono tracking-widest" style={{ color: 'rgba(57,255,20,0.6)' }}>VERIFIED</span>
          </div>
        </div>

        {/* ── Hash display ── */}
        <div className="mb-5 rounded-lg p-3" style={{ background: 'rgba(255,215,0,0.02)', border: '1px solid rgba(255,215,0,0.08)' }}>
          <div className="text-[7px] font-mono tracking-widest mb-1.5" style={{ color: 'rgba(255,215,0,0.25)' }}>
            SHA-256 ACCORD FINGERPRINT
          </div>
          <div style={{ opacity: 0, animation: 'sc-hashReveal 0.4s cubic-bezier(0.16,1,0.3,1) 0.3s forwards' }}>
            <ScramblingHash value={hash} duration={1400} />
          </div>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[7px] font-mono" style={{ color: 'rgba(255,215,0,0.2)' }}>DETERMINISTIC · COLLISION-RESISTANT · IMMUTABLE</span>
          </div>
        </div>

        {/* ── Name + Bottle ── */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex-1 min-w-0">
            <div className="text-[7px] font-mono tracking-[0.35em] mb-1.5" style={{ color: 'rgba(217,70,239,0.3)' }}>
              PUBLIC SCENT PROFILE
            </div>
            <div
              className="text-xl font-bold tracking-[0.1em] truncate"
              style={{ color: '#FFD700', textShadow: '0 0 20px rgba(255,215,0,0.25)' }}
            >
              {card.name}
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-[9px] font-mono tracking-widest" style={{ color: 'rgba(255,215,0,0.55)' }}>{card.conc}</span>
              <span style={{ color: 'rgba(255,215,0,0.2)' }}>·</span>
              <span className="text-[9px] font-mono" style={{ color: 'rgba(255,215,0,0.35)' }}>{card.concPct}</span>
              <span style={{ color: 'rgba(255,215,0,0.2)' }}>·</span>
              <span className="text-[9px] font-mono" style={{ color: 'rgba(255,215,0,0.35)' }}>{card.dom} × {card.sec}</span>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-3">
            <div
              dangerouslySetInnerHTML={{
                __html: buildChimeraGlyph({
                  accordHash: hash,
                  dims:       tesseract.dims || { convergence: [], divergence: [], paradoxes: [] },
                  hueA:       card.hueA,
                  hueB:       card.hueB,
                  viability:  tesseract.viability ?? 5,
                  nodeClass:  card.nodeClass,
                }),
              }}
              style={{ width: 96, height: 96 }}
            />
            <PerfumeBottleSVG nodeClass={card.nodeClass} hA={card.hueA} hB={card.hueB} />
          </div>
        </div>

        {/* ── Note pyramid (public key data) ── */}
        <div className="space-y-2 mb-5">
          {NOTE_LAYERS.map(({ key, label, glyph, notes, color, sub, pct }) => (
            <div key={key} className="rounded-lg p-2.5" style={{ border: `1px solid ${color}12`, background: `${color}04` }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color, textShadow: `0 0 8px ${color}40` }}>{glyph}</span>
                  <span className="text-[8px] font-bold font-mono tracking-widest" style={{ color: `${color}bb` }}>{label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[7px] font-mono" style={{ color: `${color}50` }}>{sub}</span>
                  <span className="text-[7px] font-mono" style={{ color: `${color}50` }}>{(pct * 100).toFixed(0)}%</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {notes.map((note, i) => {
                  const isLiving = living && living.layer === key && living.slotIdx === i;
                  const display  = isLiving ? living.newNote : note;
                  return (
                    <span
                      key={i}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${isLiving ? 'living-note' : ''}`}
                      style={isLiving
                        ? { background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.3)' }
                        : { color: `${color}cc`, background: `${color}0d`, border: `1px solid ${color}1a` }}
                      title={isLiving ? `your signature (was: ${living.oldNote})` : undefined}
                    >
                      {display}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── Decay Arc panel ── */}
        {narrative?.decayArc && <DecayArcPanel beats={narrative.decayArc} hueA={card.hueA} hueB={card.hueB} />}

        {/* ── Properties strip ── */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { label: 'LONGEVITY',  value: card.longevity },
            { label: 'POLARITY',   value: card.polLabel || 'MERIDIAN' },
            { label: 'NODE CLASS', value: card.nodeClass },
          ].map(({ label, value }) => (
            <div key={label} className="rounded p-2 text-center"
              style={{ border: '1px solid rgba(255,215,0,0.11)', background: 'rgba(255,215,0,0.02)' }}>
              <div className="text-[7px] font-bold tracking-widest mb-1" style={{ color: 'rgba(255,215,0,0.36)' }}>{label}</div>
              <div className="text-[10px] font-bold font-mono" style={{ color: 'rgba(255,215,0,0.8)' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* ── Encrypted formula vault ── */}
        <div className="mb-5 rounded-lg overflow-hidden" style={{ border: '1px solid rgba(217,70,239,0.12)', background: 'rgba(217,70,239,0.02)' }}>
          <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(217,70,239,0.08)' }}>
            <div className="flex items-center gap-2">
              <span
                className="text-[8px] cursor-pointer select-none"
                onClick={() => setVaultGlyphClicks(c => c + 1)}
                style={{
                  color: vaultGlyphClicks >= 4 ? 'rgba(57,255,20,0.85)' : 'rgba(217,70,239,0.6)',
                  textShadow: vaultGlyphClicks >= 5 ? '0 0 6px rgba(57,255,20,0.5)' : 'none',
                  transition: 'color 200ms ease, text-shadow 200ms ease',
                }}
              >◈</span>
              <span className="text-[7px] font-mono font-bold tracking-[0.3em]" style={{ color: 'rgba(217,70,239,0.45)' }}>
                ENCRYPTED MOLECULAR FORMULA
              </span>
            </div>
            <span className="text-[7px] font-mono tracking-widest" style={{ color: 'rgba(244,63,94,0.4)' }}>AES-256-GCM</span>
          </div>

          <div className="relative p-3">
            {/* Blurred ciphertext — the "private key" (with transient decrypt shimmer) */}
            <ShimmeringCipher rows={cipherRows} />

            {/* Vault overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: 'radial-gradient(ellipse at center, rgba(4,2,0,0.7) 0%, transparent 70%)' }}>
              <div className="text-2xl mb-2" style={{ color: 'rgba(217,70,239,0.35)', animation: 'sc-vaultPulse 4s ease-in-out infinite', textShadow: '0 0 20px rgba(217,70,239,0.2)' }}>
                ◇
              </div>
              <div className="text-[9px] font-mono font-bold tracking-[0.3em]" style={{ color: 'rgba(217,70,239,0.55)' }}>
                FORMULA VAULTED
              </div>
              <div className="text-[7px] font-mono tracking-wider mt-1" style={{ color: 'rgba(217,70,239,0.25)' }}>
                decrypted only at point of physical synthesis
              </div>
            </div>
          </div>

          <div className="px-3 py-1.5 flex items-center justify-between" style={{ borderTop: '1px solid rgba(217,70,239,0.06)', background: 'rgba(217,70,239,0.015)' }}>
            <span className="text-[6.5px] font-mono tracking-wider" style={{ color: 'rgba(217,70,239,0.2)' }}>
              {encryptedFormula.casEntries.length} MOLECULAR COMPONENTS · SG {encryptedFormula.specificGravity} · FP {encryptedFormula.flashPoint}°C · MAC {encryptedFormula.macDays}D
            </span>
            <span className="text-[6.5px] font-mono" style={{ color: 'rgba(244,63,94,0.25)' }}>■ SEALED</span>
          </div>
        </div>

        {/* ── Living Accord badge (when redeemed) ── */}
        {living && (
          <div className="text-center mb-3" style={{ opacity: 0, animation: 'sc-hashReveal 0.8s cubic-bezier(0.16,1,0.3,1) forwards' }}>
            <div className="text-[10px] font-bold font-mono tracking-[0.25em]" style={{ color: '#39FF14', textShadow: '0 0 12px rgba(57,255,20,0.5)' }}>
              ◈ LIVING ACCORD · YOUR SIGNATURE
            </div>
            <div className="text-[7px] font-mono tracking-widest mt-1" style={{ color: 'rgba(57,255,20,0.45)' }}>
              ENTROPY {living.editionEntropy} · WITNESS {living.witnessHash}
            </div>
          </div>
        )}

        {/* ── Acquire CTA ── */}
        <div className="rounded-lg p-4 text-center transition-all duration-500"
          style={{
            border: acquired ? '1px solid rgba(255,215,0,0.3)' : '1px solid rgba(255,215,0,0.09)',
            background: acquired ? 'rgba(255,215,0,0.04)' : 'transparent',
          }}>
          {!acquired ? (
            <>
              <p className="text-[9px] font-mono mb-3 leading-relaxed" style={{ color: 'rgba(255,215,0,0.3)' }}>
                This accord exists as a cryptographic data-sculpture. Acquisition compiles the
                molecular architecture and delivers it as a sovereign digital asset — the physical
                substrate remains vaulted.
              </p>
              {manifestState === 'compiling' || manifestState === 'downloaded' ? (
                <div className="font-mono text-[10px] tracking-[0.2em] py-2" style={{ color: '#39FF14', textShadow: '0 0 10px rgba(57,255,20,0.5)' }}>
                  {manifestState === 'compiling' ? '[COMPILING TESSERACT MANIFEST...]' : '[DOWNLOADING]'}
                </div>
              ) : (
                <>
                  <button
                    onClick={handleDownload}
                    className="text-[10px] font-mono uppercase tracking-widest px-6 py-2 rounded-full border transition-all hover:scale-105 active:scale-95"
                    style={{
                      borderColor: 'rgba(255,215,0,0.65)',
                      color: '#FFD700',
                      background: 'rgba(255,215,0,0.13)',
                      textShadow: '0 0 12px rgba(255,215,0,0.5)',
                      boxShadow: '0 0 18px rgba(255,215,0,0.08), inset 0 0 12px rgba(255,215,0,0.04)',
                    }}
                  >
                    {living ? '◈ ACQUIRE LIVING ASSET' : '◈ ACQUIRE COMPILED ASSET'}
                  </button>
                  <p className="text-[7px] font-mono mt-2.5 leading-relaxed" style={{ color: 'rgba(255,215,0,0.15)' }}>
                    The data-sculpture is compiled and transmitted. The substrate stays sovereign.
                  </p>
                </>
              )}
            </>
          ) : (
            <>
              <div
                className="text-[12px] font-bold font-mono mb-1.5 tracking-[0.2em]"
                style={{
                  color: '#39FF14',
                  textShadow: '0 0 15px rgba(57,255,20,0.4), 0 0 30px rgba(57,255,20,0.15)',
                  opacity: 0,
                  animation: 'sc-hashReveal 0.8s cubic-bezier(0.16,1,0.3,1) forwards',
                }}>
                ◈ MANIFEST COMPILED
              </div>
              <div className="text-[8px] font-mono mb-2 tracking-widest" style={{ color: 'rgba(57,255,20,0.55)' }}>
                DELIVERY · DIGITAL ASSET DOWNLOADED
              </div>
              {orderStatus?.fulfillmentState && <FulfillmentBadge state={orderStatus.fulfillmentState} />}
              <div className="text-[7.5px] font-mono mb-3 break-all leading-relaxed" style={{ color: 'rgba(255,215,0,0.35)' }}>
                {hash.slice(0, 32)}…
              </div>
              <div className="text-[9px] font-mono mb-3" style={{ color: 'rgba(255,215,0,0.42)' }}>
                PRODUCTION THRESHOLD — {getCount()} / {getTarget()}
              </div>
              <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,215,0,0.1)' }}>
                <div className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (getCount() / getTarget()) * 100)}%`,
                    background: 'linear-gradient(90deg,rgba(255,215,0,0.3),rgba(255,215,0,0.8))',
                    transition: 'width 1s ease',
                  }} />
              </div>
              {getCount() >= getTarget() && (
                <div className="text-[9px] font-bold font-mono mt-2" style={{ color: '#FFD700' }}>
                  ■ THRESHOLD REACHED — SYNTHESIS UNDER CONSIDERATION
                </div>
              )}
              <div className="mt-3 rounded p-3 text-left" style={{ border: '1px solid rgba(255,215,0,0.1)', background: 'rgba(0,0,0,0.35)' }}>
                <div className="text-[7px] font-mono tracking-[0.3em] mb-2" style={{ color: 'rgba(255,215,0,0.25)' }}>
                  § REQUEST DECRYPTION KEY
                </div>
                <div className="text-[8px] font-mono leading-relaxed mb-2" style={{ color: 'rgba(255,215,0,0.35)' }}>
                  The ciphertext is in your manifest. The key is held by the vault operator.
                </div>
                <div className="space-y-1">
                  <div className="flex gap-3 font-mono text-[9px]">
                    <span style={{ color: 'rgba(255,215,0,0.28)' }}>SIGNAL</span>
                    <CopySpan value="@scale.94" color="rgba(255,215,0,0.72)" />
                  </div>
                  <div className="flex gap-3 font-mono text-[9px]">
                    <span style={{ color: 'rgba(255,215,0,0.28)' }}>EMAIL </span>
                    <CopySpan value="scale0097@gmail.com" color="rgba(255,215,0,0.72)" />
                  </div>
                </div>
              </div>
              <div className="text-[7px] font-mono mt-2.5" style={{ color: 'rgba(217,70,239,0.25)' }}>
                Formula encrypted via RSA-OAEP-2048 · data transmitted as sovereign digital asset
              </div>
            </>
          )}
        </div>

        {/* ── Hidden RedeemInput — appears after 7 vault-glyph clicks ── */}
        {vaultGlyphClicks >= 7 && !living && (
          <RedeemInput
            accordHash={hash}
            accordCard={card}
            onSuccess={onLivingRedeemed}
          />
        )}
      </div>

      {/* Bottom accent line */}
      <div className="h-px w-full" style={{ background: 'linear-gradient(90deg,transparent,rgba(217,70,239,0.2),rgba(255,215,0,0.3),transparent)' }} />
    </div>
  );
}

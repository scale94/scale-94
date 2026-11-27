import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { loadWasm } from '../../wasm/wasmSingleton';
import { parseAstroOutput, PLANET_MAP, computeAspect } from '../mercury/tfgAstroHelpers';
import {
  FEATURES, NODE_IDX, DIM_NAMES,
  cosineSim, topDrivers, analyzeFullEdge, extractParadoxes,
} from '../data/nodeFeatures';
import { useColliderNarrative } from '../hooks/useColliderNarrative';
import { buildChimeraGlyph } from './chimeraGlyph.js';
import { emit as emitObs } from '../../observatory/observatoryBus';
import { getPanopticonState } from '../lib/panopticon';
import { assessSovereignty, redactCard, publishAssessment } from '../lib/sovereignty';
import ColliderChamber from '../collider/ColliderChamber';
import { usePhaseAdvance } from '../collider/usePhaseAdvance';
import { buildDomainMass } from '../collider/domainMass';
import { DOMAINS, ELEM_DOMAINS, PHIL_MATH_DOMAINS, LIFE_HUM_DOMAINS, COGN_SYNTH_DOMAINS, FSK_DOMAINS, PLANET_DOMAINS, domainById } from '../collider/domains.js';
import { buildPerfumeCard, buildTesseractProfile } from '../collider/perfumeCard.js';
import { generateManifestMarkdown } from '../collider/manifest.js';

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
  CHAOTIC:  { label: 'CHAOTIC',  color: '#ff2850', accent: '#cc1133', desc: 'divergent · high-entropy · paradox-state' },
};

const KEY_LEDGER = [
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
  const polarity          = result.ockPolarity;
  const basePolarityClass = POLARITY_CONFIG[result.ockPolarityClass] || POLARITY_CONFIG.MERIDIAN;
  // CHAOTIC override: high paradox count supersedes SOLAR/LUNAR/MERIDIAN
  const polarityClass     = paradoxCount >= 2 ? POLARITY_CONFIG.CHAOTIC : basePolarityClass;

  return {
    dominant,
    accords,
    sillage,
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

// ── Subatomic Decay · Phase 2 Translation Layer ──────────────────────────────
// Parallel narrative axis to the OCK perfume layer. Same raw collision metrics,
// different vocabulary: nuclear/particle physics. Where OCK answers "what does
// this collision smell like?", DECAY answers "how does this collision *fall
// apart*, and what survives?".
//
// Mappings (cosine = θ, paradox count = p, drivers = π):
//   τ½  (half-life)     ← cos / (1 − cos)         · stability under measurement
//   Q   (Q-value)       ← 1 − cos                 · energy budget freed
//   Γ_i (branching)     ← driver contribution     · which channel mediates decay
//   d_i (daughters)     ← residual paradoxes      · what survives saponification
//   mode (α/β/γ/cascade) ← classification by Q × p · structural character
//
// The classification mode tiers:
//   • STABLE  cos > 0.92                          — bound state, no decay
//   • α-decay p ≥ 3 ∧ Q > 0.40                    — heavy daughter, mass loss
//   • β-decay 0.25 < Q ≤ 0.55                     — identity transformation
//   • γ-decay p ≤ 1 ∧ Q ≤ 0.30                    — energy release, no Δstructure
//   • cascade everything else                     — multi-step, branching unstable
//
// Visual register intentionally physics-clinical — not perfume-poetic. The two
// panels together make the same event legible in two registers, both rigorous.
function classifyDecay(result) {
  if (!result) return null;
  const cos          = result.cosine ?? 0;
  const paradoxCount = result.paradoxes?.length ?? 0;

  // Half-life — cos→1 stable, cos→0 fast decay. Femto-cycles unit (fc).
  const eps      = 0.005;
  const halfLife = Math.min(999.9, Math.max(0.1, 1.5 * (cos + eps) / (1.0 - cos + eps)));

  // Q-value — thermal residual / energy budget freed
  const qValue = Math.max(0, 1 - cos);

  // Branching ratios — top driver channels (renormalized to sum to 1)
  const drivers = Array.isArray(result.drivers) ? result.drivers : [];
  const total   = drivers.reduce((s, d) => s + Math.abs(d.contrib ?? 0), 0) || 1;
  const topBranches = drivers.slice(0, 3).map(d => ({
    channel: d.name,
    ratio:   Math.abs(d.contrib ?? 0) / total,
  }));
  const accounted = topBranches.reduce((s, b) => s + b.ratio, 0);
  if (accounted < 0.999) {
    topBranches.push({ channel: 'remaining', ratio: Math.max(0, 1 - accounted) });
  }

  // Daughter particles — residual paradoxes that survive saponification
  const paradoxes = Array.isArray(result.paradoxes) ? result.paradoxes : [];
  const daughters = paradoxes.slice(0, 4).map(p => ({
    dim:      p.name,
    residual: p.residual,
    note:     p.residual > 0.40 ? 'irreducible carrier'
            : p.residual > 0.20 ? 'orthogonal residual'
                                : 'minor remnant',
  }));

  // Decay-mode classification
  let mode;
  if (cos > 0.92) {
    mode = { id: 'STABLE',  glyph: '⊙', label: 'Stable Bound State',
             desc: 'binding energy exceeds Q-budget · no significant decay channel',
             color: '#39ff14', accent: '#5d9c4a' };
  } else if (paradoxCount >= 3 && qValue > 0.40) {
    mode = { id: 'ALPHA',   glyph: 'α', label: 'α-decay',
             desc: 'large daughter cluster · structural rearrangement · mass loss',
             color: '#f43f5e', accent: '#9c1f3a' };
  } else if (qValue > 0.25 && qValue <= 0.55) {
    mode = { id: 'BETA',    glyph: 'β⁻', label: 'β-transformation',
             desc: 'channel-mediated identity shift · weak-interaction analogue',
             color: '#06b6d4', accent: '#0e7490' };
  } else if (paradoxCount <= 1 && qValue <= 0.30) {
    mode = { id: 'GAMMA',   glyph: 'γ', label: 'γ-emission',
             desc: 'energy release without structural change · photon channel',
             color: '#FFD700', accent: '#a07800' };
  } else {
    mode = { id: 'CASCADE', glyph: '⤳', label: 'Cascade decay',
             desc: 'multi-step decay through intermediate states · branching unstable',
             color: '#d946ef', accent: '#86198f' };
  }

  // One-line readout — the physics-measurement sentence that reads as
  // "subatomic decay" prose. The juror's takeaway line.
  const labelA = result._domainNameA || 'A';
  const labelB = result._domainNameB || 'B';
  const topChannel = topBranches[0]?.channel ?? 'unspecified';
  const halfStr    = halfLife >= 100 ? halfLife.toFixed(0)
                   : halfLife >= 10  ? halfLife.toFixed(1)
                                     : halfLife.toFixed(2);
  const readout = mode.id === 'STABLE'
    ? `${labelA} ↔ ${labelB} · ${mode.label} · τ½ → ∞ · binding through ${topChannel} channel`
    : `${labelA} ↔ ${labelB} · ${mode.glyph} decay through ${topChannel} channel · τ½ = ${halfStr} fc · Q = ${qValue.toFixed(3)} ΔE · ${daughters.length} residual${daughters.length === 1 ? '' : 's'} carry forward`;

  return { halfLife, qValue, topBranches, daughters, mode, readout };
}


// A domain's colour as the collider draws it (hsl(hue, 70%, ~60%)), in 0..255 RGB: the
// masthead eye swirls the two colliding accords in these (observerStore -> eyeReactions).
function domainRgb(id) {
  const h = (((domainById(id)?.hue ?? 0) % 360) + 360) % 360, s = 0.7, l = 0.6;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map((x) => Math.round(x * 255));
}

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

// Beam mass per domain id (spec §5.1): weight − volatility of the mapped
// sphere node, rank-normalised across every collider domain. Computed once;
// the chamber reads it at selection time, before collide() resolves.
const DOMAIN_MASS = buildDomainMass(DOMAIN_SPHERE_MAP.map((m) => m.nodeId), NODE_IDX, FEATURES);

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

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function LatentCollider({ onPolarity } = {}) {
  const phaseRef = useRef('idle'); // idle | selecting | accelerating | colliding | result
  const metricsRef = useRef(null);
  const beamsRef = useRef(null); // { beams, startedAt } populated at impact
  const chamberRef = useRef(null); // section root -- scrolled into view on 2nd selection

  const [domainA, setDomainA] = useState(null);
  const [domainB, setDomainB] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [phaseStart, setPhaseStart] = useState(0);
  const narrativeCardPreview = useMemo(() => {
    if (!result || domainA == null || domainB == null) return null;
    try { return buildPerfumeCard(domainA, domainB, result); } catch { return null; }
  }, [result, domainA, domainB]);
  const narrative = useColliderNarrative(result, narrativeCardPreview);

  const [colliderAstro, setColliderAstro] = useState(null);

  // ── Crystallize + Tesseract state ──────────────────────────────────────────
  const [crystal,    setCrystal]    = useState(null);
  const [tesseract,  setTesseract]  = useState(null);
  const [sovereignView, setSovereignView] = useState(false);

  const handleCrystallize = useCallback(async () => {
    if (!result || domainA === null || domainB === null) return;
    const card = buildPerfumeCard(domainA, domainB, result);
    setCrystal(card);
    emitObs('essences', 'crystallized', {
      kind: 'order_placed', polarity: result?.accord?.polarityClass?.label ?? null,
      cardName: card.name, nodeIdA: result?.nodeIdA ?? null, nodeIdB: result?.nodeIdB ?? null,
      vClass: result?.vClass ?? null, viability: result?.viability ?? null,
      archetype: narrative?.archetype ?? null,
      colors: [domainRgb(domainA), domainRgb(domainB)],
    });
    // Build Tesseract cryptographic identity
    try {
      const profile = await buildTesseractProfile(card, result.accord, domainA, domainB, result);

      // ── Sovereignty assessment — stage 5: panopticon load on this compile ──
      // Never blocks or breaks crystallize (spec §6): failure degrades to the
      // OFFLINE verdict.
      try {
        const { index, lawCount } = getPanopticonState();
        const assessment = assessSovereignty({ panopticonIndex: index, accord: result.accord });
        profile.sovereignty = { ...assessment, panopticonIndexAtSeal: index, lawCount, sealedAt: Date.now() };
      } catch (e) {
        console.error('[SOVEREIGNTY] assessment failed:', e);
        profile.sovereignty = {
          threat: null, resistance: 0, exposure: 0, redactions: [],
          verdict: 'PANOPTICON OFFLINE — SEALED WITHOUT ASSESSMENT',
          panopticonIndexAtSeal: null, lawCount: 0, sealedAt: Date.now(),
        };
      }
      publishAssessment(profile.sovereignty);
      setSovereignView(false);

      setTesseract(profile);
      // TODO(phase-b): emit('ciphers', 'cipher_sealed', { hashPrefix: profile?.hash?.slice(0, 10) ?? '' })
    } catch (e) {
      console.error('[TESSERACT] hash generation failed:', e);
      setTesseract(null);
    }
  }, [result, domainA, domainB]);

  // ── Run the WASM collision ─────────────────────────────────────────────────
  const runCollision = useCallback(async (a, b) => {
    setLoading(true);
    setResult(null);
    setColliderAstro(null);
    setPhase('accelerating');
    phaseRef.current = 'accelerating';
    setPhaseStart(performance.now());
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
        parsed.space = '16-D · expanded to 1536';
        parsed.viaWasm = true;
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
          space: '32-D feature tensor', viaWasm: false,
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
          ockFixation: fixation,
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

      // ── Phase 2: Subatomic decay translation ───────────────────────
      // Parallel narrative axis — same metrics, physics-decay vocabulary.
      parsed.decay = classifyDecay(parsed);

      metricsRef.current = parsed;
      setResult(parsed);
      emitObs('essences', 'collision_fired', {
        polarity: parsed.accord?.polarityClass?.label ?? null,
        // accord.accords = the four families with an intensity; "notes" are those audibly sounding
        noteCount: Array.isArray(parsed.accord?.accords) ? parsed.accord.accords.filter(a => a.intensity >= 0.25).length : null,
        dominant: parsed.accord?.dominant?.id ?? null,
        colors: [domainRgb(a), domainRgb(b)],   // the two accords' colours, for the eye
      });
      onPolarity?.(parsed.accord?.polarityClass?.label ?? null);
      setPhase('colliding');
      phaseRef.current = 'colliding';
      setPhaseStart(performance.now());

      // ── 16-Beam parameter trace: build beams from this collision's OCK dims
      beamsRef.current = { beams: buildBeams(parsed, domainById(a).hue, domainById(b).hue), startedAt: performance.now() };

      // ── Fetch live astro data for mathematical astrology overlay ──────
      loadWasm().then(w => {
        try { setColliderAstro(parseAstroOutput(w.run_astro(Date.now()))); }
        catch { /* astro overlay is decorative — a bad parse just leaves it unset */ }
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
      emitObs('essences', 'node_selected', { nodeId: id, name: domainById(id)?.name ?? null });
      setDomainA(id);
      setDomainB(null);
      setResult(null);
      setPhase('selecting');
      phaseRef.current = 'selecting';
    } else if (domainB === null && id !== domainA) {
      setCrystal(null);
      setTesseract(null);
      setDomainB(id);
      runCollision(domainA, id);
      // window.scrollTo({top:0}) was a no-op here: the terminal's own <main>
      // panel scrolls internally while window/body/html never do (see App's
      // "overflow-y-auto" main), so a low-tier second pick never brought the
      // chamber (selected far above the tier grid) back into view.
      chamberRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Reset
      setCrystal(null);
      setTesseract(null);
      emitObs('essences', 'node_selected', { nodeId: id, name: domainById(id)?.name ?? null });
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
    setDomainA(null);
    setDomainB(null);
    setResult(null);
    setColliderAstro(null);
    setPhase('idle');
    phaseRef.current = 'idle';
    metricsRef.current = null;
    setPhaseStart(performance.now());
    beamsRef.current = null;
    colliderBus.emit({ type: 'COLLIDER_PHASE', phase: 'idle' });
  }, []);

  // ── colliding -> result: a clock, not the render loop ─────────────────────
  // See usePhaseAdvance.js: this used to fire from inside the Canvas2D
  // draw() call, so under prefers-reduced-motion or a suspended-rAF preview
  // pane the collision would sit in 'colliding' forever.
  usePhaseAdvance(phase, phaseStart, () => {
    phaseRef.current = 'result';
    setPhase('result');
    setPhaseStart(performance.now());
  });

  // ── Viability color ────────────────────────────────────────────────────────
  const viabilityColor = useMemo(() => {
    if (!result) return '#39ff14';
    if (result.viability > 8) return '#d946ef';
    if (result.viability > 4) return '#06b6d4';
    if (result.viability > 1.5) return '#39ff14';
    return '#f43f5e';
  }, [result]);

  return (
    <div className="mb-10" ref={chamberRef}>
      <style>{`
        @keyframes sc-cardReveal {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sc-borderBreath {
          0%, 100% { box-shadow: 0 0 8px rgba(217,70,239,0.06); }
          50%       { box-shadow: 0 0 28px rgba(217,70,239,0.18); }
        }
        @keyframes sc-headReveal {
          from { opacity: 0; transform: translateY(6px); filter: blur(4px); }
          to   { opacity: 1; transform: translateY(0);  filter: blur(0); }
        }
        @keyframes sc-headColor {
          0%   { color: #06b6d4; }
          25%  { color: #d946ef; }
          50%  { color: #39ff14; }
          75%  { color: #06b6d4; }
          100% { color: #06b6d4; }
        }
      `}</style>
      {/* ── Section header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest"
            style={{ opacity: 0, animation: 'sc-headReveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.2s both, sc-headColor 9s ease-in-out 0s infinite' }}>
            LATENT SPACE COLLIDER
          </h3>
          <div className="text-[10px] text-fuchsia-500/50 font-mono uppercase tracking-widest mt-0.5">
            {`// ${result?.space ?? '16-D · expanded to 1536'} CROSS-ATTENTION SYNTHESIS · OCK v1.1.0 · INTERACT v1.2.0 · ${result?.viaWasm ? 'WASM · ' : ''}`}{phase.toUpperCase()}
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

      {/* ── Collision Chamber (WebGL) ── */}
      <div className="relative">
        <ColliderChamber
          phase={phase}
          hueA={domainA !== null ? domainById(domainA).hue : 280}
          hueB={domainB !== null ? domainById(domainB).hue : 120}
          selA={domainA !== null}
          selB={domainB !== null}
          massA={domainA !== null ? DOMAIN_MASS[domainA] : undefined}
          massB={domainB !== null ? DOMAIN_MASS[domainB] : undefined}
          labelA={domainA !== null ? domainById(domainA).short : null}
          labelB={domainB !== null ? domainById(domainB).short : null}
          beams={beamsRef.current?.beams ?? null}
          metrics={phase === 'colliding' || phase === 'result' ? metricsRef.current : null}
          phaseStartedAt={phaseStart}
        />
        {phase === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center border border-dashed border-fuchsia-500/20 rounded-sm px-10 py-6">
              <div className="text-[11px] font-mono text-fuchsia-500/40 uppercase tracking-widest animate-pulse">
                SELECT TWO DOMAINS TO COLLIDE
              </div>
              <div className="text-[9px] font-mono text-cyan-600/30 mt-1">
                16-D vector intersection · expanded to 1536 · cross-attention synthesis
              </div>
            </div>
          </div>
        )}
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
      <div className="text-[8px] font-mono text-zinc-400/60 uppercase tracking-widest mt-3 mb-1">
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
                  ? 'border-zinc-400/60 bg-zinc-800/30 text-zinc-200'
                  : 'border-zinc-700/30 bg-black/30 text-zinc-500/60 hover:border-zinc-500/40 hover:text-zinc-300 hover:bg-zinc-800/10'}
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
                {result.nodeIdA} × {result.nodeIdB} · {result.space}
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
            <MetricCard label="cos(θ)" value={result.cosine.toFixed(4)} sub={`θ = ${result.angle.toFixed(1)}° · ${result.space}`} />
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
            const PLANET_SYMBOLS = {
              Sun:'☉', Moon:'☽', Mercury:'☿', Venus:'♀', Mars:'♂',
              Jupiter:'♃', Saturn:'♄', Uranus:'♅', Neptune:'♆', Pluto:'♇',
            };
            const PLANET_COLORS_BY_NAME = {
              Sun:'#f59e0b', Moon:'#e2e8f0', Mercury:'#c0c0c0', Venus:'#22c55e',
              Mars:'#ef4444', Jupiter:'#8b5cf6', Saturn:'#a78060',
              Uranus:'#06b6d4', Neptune:'#3b82f6', Pluto:'#dc2626',
            };
            const PLANET_ORDER = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
            const FAMILY_PLANET = {
              citrus:'Mercury', floral:'Venus', woody:'Saturn', animalic:'Mars',
              aromatic:'Jupiter', ozonic:'Uranus', chypre:'Moon', fougere:'Venus',
              gourmand:'Jupiter', aquatic:'Neptune', leather:'Mars', mineral:'Saturn',
            };
            const PLANET_DOMAIN_NAME = { 70:'Sun',71:'Mercury',72:'Venus',74:'Moon',75:'Mars',76:'Jupiter',77:'Saturn',78:'Uranus',79:'Neptune',80:'Pluto' };
            const pA = PLANET_DOMAIN_NAME[domainA] || (result.accord ? FAMILY_PLANET[result.accord.dominant?.id] : null) || 'Mercury';
            const pB = PLANET_DOMAIN_NAME[domainB] || (result.accord ? FAMILY_PLANET[result.accord.dominant?.id] : null) || 'Venus';
            const featured = new Set([pA, pB]);
            const allPlanets = PLANET_ORDER.filter(p => colliderAstro[p]);

            // Compute tight aspects (orb ≤ 4°) between all planet pairs
            const aspects = [];
            for (let i = 0; i < allPlanets.length; i++) {
              for (let j = i + 1; j < allPlanets.length; j++) {
                const a = colliderAstro[allPlanets[i]], b = colliderAstro[allPlanets[j]];
                if (!a || !b) continue;
                const asp = computeAspect(a.sign, a.degree, b.sign, b.degree);
                if (asp && parseFloat(asp.orb) <= 4) aspects.push({ p1: allPlanets[i], p2: allPlanets[j], ...asp });
              }
            }

            const jd = (Date.now()/86400000 + 2440587.5).toFixed(4);
            return (
              <div className="border-t border-cyan-500/15 pt-4" style={{ opacity: 0, animation: 'sc-cardReveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.4s forwards' }}>
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(6,182,212,0.5)' }}>
                    ⊕ MATHEMATICAL ASTROLOGY · VSOP87 · JD{jd}
                  </span>
                  <span className="text-[8px] font-mono uppercase tracking-widest" style={{ color: 'rgba(6,182,212,0.25)' }}>TRANSIT MATRIX</span>
                </div>

                {/* Planet grid — all 10 planets, 2-col, featured at full opacity */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 mb-3">
                  {allPlanets.map(p => {
                    const d = colliderAstro[p];
                    if (!d) return null;
                    const col = PLANET_COLORS_BY_NAME[p];
                    const isFeat = featured.has(p);
                    return (
                      <div key={p} className="flex items-center gap-1.5 py-[3px]" style={{ opacity: isFeat ? 1 : 0.45 }}>
                        <span className="text-[12px] leading-none w-4 text-center" style={{ color: col }}>{PLANET_SYMBOLS[p]}</span>
                        <span className="text-[8px] font-bold font-mono w-[52px]" style={{ color: col }}>{p.toUpperCase()}</span>
                        <span className="text-[8px] font-mono" style={{ color: 'rgba(192,192,192,0.65)' }}>
                          {d.sign} {typeof d.degree === 'number' ? d.degree.toFixed(1) : '—'}°
                        </span>
                        {d.retrograde && (
                          <span className="text-[8px] font-mono ml-0.5" style={{ color: 'rgba(217,70,239,0.7)' }}>℞</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Aspect list — tight orbs only */}
                {aspects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-cyan-500/10">
                    {aspects.map((a, i) => {
                      const isFeatAsp = featured.has(a.p1) || featured.has(a.p2);
                      return (
                        <div key={i} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono"
                          style={{
                            background: isFeatAsp ? 'rgba(6,182,212,0.07)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${isFeatAsp ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.05)'}`,
                            color: isFeatAsp ? 'rgba(6,182,212,0.8)' : 'rgba(192,192,192,0.35)',
                          }}>
                          <span style={{ color: PLANET_COLORS_BY_NAME[a.p1] }}>{PLANET_SYMBOLS[a.p1]}</span>
                          <span className="mx-0.5 uppercase tracking-wide">{a.name}</span>
                          <span style={{ color: PLANET_COLORS_BY_NAME[a.p2] }}>{PLANET_SYMBOLS[a.p2]}</span>
                          <span className="ml-1 opacity-50">orb {a.orb}°</span>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                        {result.accord.danceRole?.split('—')[1]?.trim() || '§8 vector space'}
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

              {/* Volatility tiers — top / heart / base (conceptual) */}
              <div>
                <div className="text-[9px] font-bold text-amber-400/60 uppercase tracking-widest mb-2">
                  VOLATILITY TIERS · conceptual
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: 'TOP ᛏ',   val: result.accord.topIntensity,      pct: result.accord.evapCurve[0], color: '#FFD700', sub: 'citrus · high volatility' },
                    { label: 'HEART ᚺ',  val: result.accord.heartIntensity,    pct: result.accord.evapCurve[1], color: '#d946ef', sub: 'floral · medium volatility' },
                    { label: 'BASE ᛒ',   val: result.accord.baseIntensity,     pct: result.accord.evapCurve[2], color: '#8B4513', sub: 'resinous · low volatility' },
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

              {/* Sillage + Fixation + Permeability strip */}
              <div className="grid grid-cols-3 gap-2">
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

              {/* SOMA — Tesseract key ledger */}
              <div className="border border-amber-500/15 bg-amber-900/5 rounded-lg p-3">
                <div className="text-[9px] font-bold text-amber-400/60 uppercase tracking-widest mb-2">
                  ᛊ⚗ᛟ SOMA — TESSERACT KEY LEDGER
                </div>
                <div className="space-y-1.5">
                  {KEY_LEDGER.map(item => {
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

              {/* ── Subatomic Decay Arc — Feigenbaum bifurcation cascade
                   per fish_scale_kernel11.1.1 + FSF-12.1.0:
                   Bosonic carrier → Saponification threshold → Fermionic residue.
                   Wet→dry traverse; pure purity = entropic stasis = death. ── */}
              {narrative.decayArc && narrative.decayArc.length > 0 && (
                <div className="border border-cyan-900/20 rounded-lg overflow-hidden">
                  <div className="px-3 pt-2.5 pb-2 border-b border-cyan-900/15 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[9px] font-bold text-cyan-400/55 uppercase tracking-widest">SUBATOMIC DECAY ARC</span>
                      <span className="text-[8px] font-mono text-cyan-600/25">Feigenbaum · δ=4.669 · α=2.503</span>
                    </div>
                    <span className="text-[7px] font-mono text-cyan-600/25 hidden sm:inline">
                      Bouligand cascade · θ=36°/layer · 10 layers / revolution
                    </span>
                  </div>
                  <div className="px-3 py-1">
                    {narrative.decayArc.map((ph, i) => {
                      const col = ['#FFD700', '#d946ef', '#92400e'][i];
                      const isLast = i === narrative.decayArc.length - 1;
                      // Bouligand rotation: each phase = 5-layer step → 0°, 180°, 360°
                      // (10 layers per full revolution = 36°/layer · 5 layers/phase)
                      const bouligandRot = i * 180;
                      const bouligandLayers = i * 5; // layer index at phase start
                      return (
                        <div key={i} className="flex gap-3 py-2.5">
                          <div className="flex flex-col items-center shrink-0 w-5 pt-1">
                            <div className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ background: col, boxShadow: `0 0 5px ${col}55` }} />
                            {!isLast && (
                              <div className="w-px flex-1 mt-1 mb-[-4px]"
                                style={{ background: `linear-gradient(to bottom, ${col}35, transparent)` }} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                              <span className="text-[9px] font-bold font-mono shrink-0" style={{ color: col }}>{ph.time}</span>
                              <span className="text-[8px] font-mono" style={{ color: col + '66' }}>{ph.label}</span>
                              {/* Bouligand rotation glyph — three stacked bars at cumulative θ */}
                              <span className="inline-flex items-center gap-1 ml-auto shrink-0">
                                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                                  <g transform={`translate(7 7) rotate(${bouligandRot})`}>
                                    <line x1="-5" y1="-3" x2="5" y2="-3" stroke={col + 'aa'} strokeWidth="1" />
                                    <line x1="-5" y1="0"  x2="5" y2="0"  stroke={col + '55'} strokeWidth="1" transform="rotate(36)" />
                                    <line x1="-5" y1="3"  x2="5" y2="3"  stroke={col + '22'} strokeWidth="1" transform="rotate(72)" />
                                  </g>
                                </svg>
                                <span className="text-[7px] font-mono" style={{ color: col + '66' }}>
                                  L{bouligandLayers}·{bouligandRot}°
                                </span>
                                <span className="text-[8px] font-mono font-bold px-1 rounded-sm"
                                  style={{ color: col + 'aa', border: `1px solid ${col}30`, background: col + '08' }}>
                                  {ph.glyph} {ph.shell}
                                </span>
                              </span>
                            </div>
                            {/* Doctrinal frame — fish_scale_kernel11.1.1 */}
                            <div className="text-[8px] font-mono mb-1.5" style={{ color: col + '55' }}>
                              {ph.regime} · <span style={{ color: col + '70' }}>{ph.patch}</span>
                            </div>
                            {/* α-window annotation for the saponification edge */}
                            {ph.constant && (
                              <div className="text-[7px] font-mono mb-1.5 italic" style={{ color: col + '50' }}>
                                δ compresses cadence · α compresses window — viable channel narrows by 2.503× per doubling
                              </div>
                            )}
                            <p className="text-[10px] font-mono italic leading-snug mb-2" style={{ color: col + '99' }}>{ph.prose}</p>
                            <div className="flex flex-wrap gap-1">
                              {ph.notes.map((note, j) => (
                                <span key={j} className="text-[8px] font-mono px-1.5 py-0.5 rounded-sm"
                                  style={{ background: col + '0f', border: `1px solid ${col}22`, color: col + '88' }}>
                                  {note}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Doctrinal footer — the Plato/Promo paradox + MEPP σ */}
                  <div className="px-3 py-2 border-t border-cyan-900/15 bg-black/30">
                    <div className="text-[7px] font-mono italic text-cyan-600/40 leading-snug">
                      § The Pirarucu armor cannot form without the Levamisole burn. Pure purity is entropic stasis.
                      The chimera survives only by traversing the wet→dry cascade — and only the attractor that
                      maximizes entropy production (σ) is dynamically selected (DSK §I · MEPP).
                      {narrative.archetypeSigma != null && (
                        <span className="ml-1.5 not-italic" style={{ color: 'rgba(255,215,0,0.5)' }}>
                          [σ ≈ {narrative.archetypeSigma.toFixed(2)}]
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Shared Ground (Onsager-directional) */}
              {narrative.sharedGround && (
                <div>
                  <div className="text-[9px] font-bold text-[#39ff14]/50 uppercase tracking-widest mb-1">
                    SHARED GROUND <span className="text-[#39ff14]/25 ml-2 normal-case font-mono">· Onsager-reciprocal coupling</span>
                  </div>
                  <p className="text-[10px] font-mono text-[#39ff14]/40 leading-relaxed">
                    {narrative.sharedGround.narrative}
                  </p>
                </div>
              )}

              {/* Titmuss Bond Classifier — BOSONIC-KERNEL-3.0.0 §0 */}
              {narrative.titmuss && narrative.titmuss.type !== 'INDETERMINATE' && (() => {
                const t = narrative.titmuss;
                const palette = t.type === 'TYPE_2'
                  ? { name: 'rgba(244,114,182,0.7)', soft: 'rgba(244,114,182,0.4)', border: 'rgba(244,114,182,0.3)', bg: 'rgba(244,114,182,0.05)' }
                  : t.type === 'TYPE_1'
                  ? { name: 'rgba(57,255,20,0.7)',   soft: 'rgba(57,255,20,0.4)',   border: 'rgba(57,255,20,0.3)',   bg: 'rgba(57,255,20,0.05)' }
                  : { name: 'rgba(245,158,11,0.7)',  soft: 'rgba(245,158,11,0.4)',  border: 'rgba(245,158,11,0.3)',  bg: 'rgba(245,158,11,0.05)' };
                const label = t.type === 'TYPE_1' ? 'TYPE 1 · TRANSACTIONAL BOND'
                            : t.type === 'TYPE_2' ? 'TYPE 2 · CONSTITUTIVE BOND'
                            : 'MIXED · HYBRID BOND';
                const tPct = (t.scores.transactional * 100).toFixed(0);
                const cPct = (t.scores.constitutive * 100).toFixed(0);
                return (
                  <div className="rounded-lg p-3 border" style={{ borderColor: palette.border, background: palette.bg }}>
                    <div className="flex items-baseline justify-between gap-2 mb-1.5 flex-wrap">
                      <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: palette.name }}>
                        {label}
                      </div>
                      <div className="text-[7px] font-mono" style={{ color: palette.soft }}>
                        BOSONIC-KERNEL-3.0.0 · Titmuss test
                      </div>
                    </div>
                    <p className="text-[10px] font-mono leading-relaxed mb-2" style={{ color: palette.soft }}>
                      {t.diagnostic}
                    </p>
                    {/* T vs C split bar */}
                    <div className="flex items-center gap-2 text-[8px] font-mono">
                      <span style={{ color: 'rgba(57,255,20,0.6)' }}>T {tPct}%</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden flex" style={{ background: 'rgba(0,0,0,0.4)' }}>
                        <div style={{ width: `${tPct}%`, background: 'linear-gradient(90deg, rgba(57,255,20,0.7), rgba(57,255,20,0.3))' }} />
                        <div style={{ width: `${cPct}%`, background: 'linear-gradient(90deg, rgba(244,114,182,0.3), rgba(244,114,182,0.7))' }} />
                      </div>
                      <span style={{ color: 'rgba(244,114,182,0.6)' }}>C {cPct}%</span>
                    </div>
                  </div>
                );
              })()}

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

              {/* Period-3 Sanctuaries — FSF-12.1.0 §5: transient order pockets inside chaos */}
              {narrative.sanctuaries && narrative.sanctuaries.length > 0 && (
                <div className="rounded-lg p-3 border border-emerald-500/20 bg-emerald-900/5">
                  <div className="flex items-baseline justify-between gap-2 mb-1.5 flex-wrap">
                    <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-400/70">
                      PERIOD-3 SANCTUARIES · {narrative.sanctuaries.length} detected
                    </div>
                    <div className="text-[7px] font-mono text-emerald-500/40">
                      FSF-12.1.0 §5 · Sharkovsky window
                    </div>
                  </div>
                  <div className="text-[9px] font-mono text-emerald-500/50 leading-relaxed mb-2">
                    Not all paradoxes are independent. When ≥3 residuals cluster within a narrow band, they aren&apos;t noise — they&apos;re aligned at a sanctuary frequency. Each cluster is a transient ordered pocket inside the chaotic regime: order recurs.
                  </div>
                  <div className="space-y-1.5">
                    {narrative.sanctuaries.map((s, i) => (
                      <div key={i} className="flex items-baseline gap-2 text-[9px] font-mono">
                        <span className="text-emerald-400/70 shrink-0 w-14">≈ {s.center.toFixed(3)}</span>
                        <span className="text-emerald-500/40 shrink-0">±{(s.width / 2).toFixed(3)}</span>
                        <span className="text-emerald-300/50 truncate">
                          {s.size}× cluster: {s.members.join(' · ')}
                        </span>
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
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8px] font-bold text-[#39ff14]/50 uppercase tracking-wider">
                              {frag.source}
                            </span>
                            {/* Metric provenance chip — shows which raw signal generated this fragment */}
                            {(() => {
                              const m = narrative.meta;
                              const chip = (val, col) => (
                                <span className="text-[7px] font-mono px-1 py-px rounded-sm"
                                  style={{ color: col + '66', border: `1px solid ${col}22`, background: col + '0a' }}>
                                  {val}
                                </span>
                              );
                              if (frag.source === 'ARCHETYPE')    return chip(`ν=${(m.novelty * 100).toFixed(0)}%`, '#39ff14');
                              if (frag.source === 'CATALYSIS')    return chip(m.catalysis.toFixed(2), '#f59e0b');
                              if (frag.source === 'INTERFERENCE') return chip(m.interference.toFixed(2), '#f59e0b');
                              if (frag.source === 'RESONANCE')    return chip(m.resonanceFreq.toFixed(3), '#06b6d4');
                              if (frag.source === 'TURBULENCE')   return chip(m.turbulence.toFixed(4), '#f43f5e');
                              if (frag.source === 'PARADOX')      return chip(`${m.paradoxCount}p`, '#d946ef');
                              return null;
                            })()}
                          </div>
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

          {/* ── Phase 2 · Subatomic Decay translation ───────────────────── */}
          {result.decay && (
            <div className="border-t pt-5 space-y-3"
              style={{
                borderColor: result.decay.mode.accent + '40',
                opacity: 0,
                animation: 'sc-cardReveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.35s forwards'
              }}>

              {/* Header — physics-clinical register, parallel to OCK header */}
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base font-mono" style={{ color: result.decay.mode.color, textShadow: `0 0 8px ${result.decay.mode.color}66` }}>
                      {result.decay.mode.glyph}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: result.decay.mode.color }}>
                      SUBATOMIC DECAY
                    </span>
                  </div>
                  <div className="text-[9px] font-mono" style={{ color: result.decay.mode.accent + 'aa' }}>
                    Channel Spectrum · Decay v1.0
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <div className="text-sm font-bold font-mono whitespace-nowrap" style={{ color: result.decay.mode.color }}>
                    {result.decay.mode.label}
                  </div>
                  <div className="text-[8px] font-mono text-cyan-600/40">decay mode</div>
                </div>
              </div>

              {/* Three-up: τ½ · Q · top channel */}
              <div className="grid grid-cols-3 gap-2">
                <div className="border rounded p-2"
                  style={{ borderColor: result.decay.mode.accent + '30', background: 'rgba(0,0,0,0.3)' }}>
                  <div className="text-[7px] font-bold uppercase tracking-widest mb-0.5" style={{ color: result.decay.mode.accent + '99' }}>
                    HALF-LIFE
                  </div>
                  <div className="text-sm font-bold font-mono" style={{ color: result.decay.mode.color }}>
                    τ½ = {result.decay.mode.id === 'STABLE' ? '∞' : (result.decay.halfLife >= 100 ? result.decay.halfLife.toFixed(0) : result.decay.halfLife >= 10 ? result.decay.halfLife.toFixed(1) : result.decay.halfLife.toFixed(2))}
                    {result.decay.mode.id !== 'STABLE' && <span className="text-[8px] ml-0.5" style={{ color: result.decay.mode.accent }}>fc</span>}
                  </div>
                  <div className="text-[7px] font-mono mt-0.5" style={{ color: result.decay.mode.accent + '66' }}>
                    femto-cycles
                  </div>
                </div>
                <div className="border rounded p-2"
                  style={{ borderColor: result.decay.mode.accent + '30', background: 'rgba(0,0,0,0.3)' }}>
                  <div className="text-[7px] font-bold uppercase tracking-widest mb-0.5" style={{ color: result.decay.mode.accent + '99' }}>
                    Q-VALUE
                  </div>
                  <div className="text-sm font-bold font-mono" style={{ color: result.decay.mode.color }}>
                    {result.decay.qValue.toFixed(3)}
                    <span className="text-[8px] ml-0.5" style={{ color: result.decay.mode.accent }}>ΔE</span>
                  </div>
                  <div className="text-[7px] font-mono mt-0.5" style={{ color: result.decay.mode.accent + '66' }}>
                    energy released
                  </div>
                </div>
                <div className="border rounded p-2"
                  style={{ borderColor: result.decay.mode.accent + '30', background: 'rgba(0,0,0,0.3)' }}>
                  <div className="text-[7px] font-bold uppercase tracking-widest mb-0.5" style={{ color: result.decay.mode.accent + '99' }}>
                    DAUGHTERS
                  </div>
                  <div className="text-sm font-bold font-mono" style={{ color: result.decay.mode.color }}>
                    {result.decay.daughters.length}
                  </div>
                  <div className="text-[7px] font-mono mt-0.5" style={{ color: result.decay.mode.accent + '66' }}>
                    residual carriers
                  </div>
                </div>
              </div>

              {/* Branching ratios — top decay channels */}
              <div>
                <div className="text-[8px] font-bold uppercase tracking-widest mb-1.5" style={{ color: result.decay.mode.accent + 'bb' }}>
                  Decay Channels · Branching Ratios Γᵢ
                </div>
                <div className="space-y-1">
                  {result.decay.topBranches.map((b, i) => {
                    const isRem  = b.channel === 'remaining';
                    const barCol = isRem ? '#475569' : result.decay.mode.color;
                    return (
                      <div key={i} className="flex items-center gap-2 text-[9px] font-mono">
                        <span className="w-28 shrink-0 truncate" style={{ color: isRem ? '#64748b' : result.decay.mode.accent + 'cc' }}>
                          {b.channel}
                        </span>
                        <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${Math.max(2, b.ratio * 100)}%`,
                              background: `linear-gradient(90deg, ${barCol}, ${barCol}44)`,
                            }}
                          />
                        </div>
                        <span className="w-12 text-right" style={{ color: isRem ? '#64748b' : result.decay.mode.color + 'cc' }}>
                          {(b.ratio * 100).toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Daughter particles — residual paradoxes (the survivors) */}
              {result.decay.daughters.length > 0 && (
                <div>
                  <div className="text-[8px] font-bold uppercase tracking-widest mb-1.5" style={{ color: result.decay.mode.accent + 'bb' }}>
                    Daughter Particles · Post-Saponification Residuals
                  </div>
                  <div className="space-y-0.5 font-mono text-[9px]">
                    {result.decay.daughters.map((d, i) => (
                      <div key={i} className="flex items-baseline gap-2 leading-snug">
                        <span style={{ color: result.decay.mode.accent + '88' }}>
                          [{String(i + 1).padStart(2, '0')}]
                        </span>
                        <span className="w-24 shrink-0 truncate" style={{ color: result.decay.mode.color + 'cc' }}>
                          {d.dim}
                        </span>
                        <span className="shrink-0" style={{ color: result.decay.mode.accent + 'aa' }}>
                          Δ {d.residual.toFixed(3)}
                        </span>
                        <span className="italic" style={{ color: result.decay.mode.accent + '66' }}>
                          — {d.note}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* The readout — single physics-measurement line */}
              <div className="rounded p-2.5 border" style={{
                borderColor: result.decay.mode.accent + '30',
                background: result.decay.mode.color + '08',
              }}>
                <div className="text-[7px] font-bold uppercase tracking-widest mb-1" style={{ color: result.decay.mode.accent + '99' }}>
                  Readout
                </div>
                <p className="text-[10px] font-mono leading-relaxed" style={{ color: result.decay.mode.color + 'dd' }}>
                  {result.decay.readout}
                </p>
              </div>

              {/* Mode caption — the physical character of this collision */}
              <div className="text-[7px] font-mono italic leading-snug" style={{ color: result.decay.mode.accent + '88' }}>
                § {result.decay.mode.desc}
              </div>
            </div>
          )}

          {/* ── WASM telemetry ── */}
          <div className="text-[10px] font-mono text-cyan-600/30 space-y-0.5 pt-2 border-t border-cyan-900/15">
            {result.viaWasm && (
              <div>WASM: Q×Kᵀ/√d_k = {result.scaledAttn.toFixed(6)} · softmax = {result.softmax.toFixed(4)} · PHASE: {result.phase}</div>
            )}
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
          card={
            tesseract.sovereignty?.redactions?.length && !sovereignView
              ? redactCard(crystal, tesseract.sovereignty.redactions)
              : crystal
          }
          fullCard={crystal}
          sovereignty={tesseract.sovereignty}
          sovereignView={sovereignView}
          onToggleSovereignView={() => setSovereignView((v) => !v)}
          tesseract={tesseract}
          narrative={narrative}
          result={result}
        />
      ) : crystal && (
        <CrystallizeCard card={crystal} />
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

// ── Crystallize Card component ─────────────────────────────────────────────────
function CrystallizeCard({ card }) {
  const NOTE_LAYERS = [
    { key: 'top',   label: 'TOP NOTES',   glyph: 'ᛏ', notes: card.topNotes,   color: '#FFD700', sub: 'high volatility',   pct: card.evap[0] },
    { key: 'heart', label: 'HEART NOTES', glyph: 'ᚺ', notes: card.heartNotes, color: '#d946ef', sub: 'medium volatility', pct: card.evap[1] },
    { key: 'base',  label: 'BASE NOTES',  glyph: 'ᛒ', notes: card.baseNotes,  color: '#B8860B', sub: 'low volatility',    pct: card.evap[2] },
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
              <span className="text-[9px] font-mono tracking-widest" style={{ color: 'rgba(255,215,0,0.55)' }}>{card.dom} × {card.sec}</span>
            </div>
          </div>
          <div className="shrink-0">
            <PerfumeBottleSVG nodeClass={card.nodeClass} hA={card.hueA} hB={card.hueB} />
          </div>
        </div>

        {/* Note pyramid — the tier percentages are conceptual, not measured */}
        <div className="space-y-2.5 mb-6">
          <div className="text-[7px] font-mono tracking-widest" style={{ color: 'rgba(255,215,0,0.4)' }}>
            NOTE PYRAMID · conceptual
          </div>
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
        <div className="grid grid-cols-2 gap-2 mb-6">
          {[
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
      </div>

      <div className="h-px w-full" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,215,0,0.25),transparent)' }} />
    </div>
  );
}

// ── DecayArcPanel — time-evolution narrative below the note pyramid ────────
// Doctrinal annotations from FSF-12.1.0 + fish_scale_kernel11.1.1:
// shell, glyph, regime, patch flow through from useColliderNarrative buildDecayArc.
// Bouligand layer-index (L0/L5/L10) visualized via per-phase 36°-stack glyph.
function DecayArcPanel({ beats, hueA, hueB }) {
  if (!beats || beats.length === 0) return null;
  const hueMid = ((hueA + hueB) / 2) % 360;
  return (
    <div className="mb-5 rounded-lg p-4" style={{ border: '1px solid rgba(255,215,0,0.1)', background: 'rgba(255,215,0,0.015)' }}>
      <div className="flex items-baseline justify-between gap-2 mb-3 flex-wrap">
        <div className="text-[7px] font-mono tracking-[0.3em]" style={{ color: 'rgba(255,215,0,0.3)' }}>
          § DECAY ARC · FEIGENBAUM CASCADE
        </div>
        <div className="text-[7px] font-mono" style={{ color: 'rgba(255,215,0,0.25)' }}>
          Bouligand θ=36°/L · δ=4.669 · α=2.503
        </div>
      </div>
      <div className="relative h-1 mb-4">
        <div className="absolute inset-0 rounded-full" style={{ background: `linear-gradient(90deg, hsla(${hueA},70%,55%,0.5), hsla(${hueMid},60%,50%,0.4), hsla(${hueB},50%,45%,0.3))` }} />
        {[0.0, 0.5, 1.0].map((p, i) => (
          <div key={i} className="absolute top-1/2 w-2 h-2 rounded-full" style={{ left: `calc(${p * 100}% - 4px)`, transform: 'translateY(-50%)', background: '#FFD700', boxShadow: '0 0 6px rgba(255,215,0,0.6)' }} />
        ))}
      </div>
      <div className="space-y-2.5">
        {beats.map((b, i) => {
          const bouligandRot = i * 180; // 0°, 180°, 360° across 3 phases
          const layerIdx = i * 5;
          return (
            <div key={i} className="flex gap-3 items-start" style={{ opacity: 0, animation: `sc-cardReveal 0.5s cubic-bezier(0.16,1,0.3,1) ${1.2 + i * 0.4}s forwards` }}>
              <div className="text-[8px] font-mono tracking-widest shrink-0 w-16" style={{ color: 'rgba(255,215,0,0.5)' }}>{b.time}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
                  <div className="text-[9px] font-mono" style={{ color: 'rgba(255,215,0,0.7)' }}>
                    {b.notes.slice(0, 3).join(' · ')}
                  </div>
                  <span className="inline-flex items-center gap-1 ml-auto shrink-0">
                    <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true">
                      <g transform={`translate(7 7) rotate(${bouligandRot})`}>
                        <line x1="-5" y1="-3" x2="5" y2="-3" stroke="rgba(255,215,0,0.7)" strokeWidth="1" />
                        <line x1="-5" y1="0"  x2="5" y2="0"  stroke="rgba(255,215,0,0.4)" strokeWidth="1" transform="rotate(36)" />
                        <line x1="-5" y1="3"  x2="5" y2="3"  stroke="rgba(255,215,0,0.2)" strokeWidth="1" transform="rotate(72)" />
                      </g>
                    </svg>
                    {b.shell && (
                      <span className="text-[7px] font-mono font-bold px-1 rounded-sm" style={{ color: 'rgba(255,215,0,0.65)', border: '1px solid rgba(255,215,0,0.2)' }}>
                        {b.glyph} {b.shell} · L{layerIdx}
                      </span>
                    )}
                  </span>
                </div>
                {b.regime && (
                  <div className="text-[7px] font-mono mb-0.5" style={{ color: 'rgba(255,215,0,0.4)' }}>
                    {b.regime} · <span style={{ color: 'rgba(255,215,0,0.55)' }}>{b.patch}</span>
                  </div>
                )}
                <div className="text-[8px] italic" style={{ color: 'rgba(255,215,0,0.45)' }}>
                  {b.prose}
                </div>
              </div>
            </div>
          );
        })}
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

// ── Tesseract Card — cryptographic identity layer ───────────────────────────
function TesseractCard({ card, fullCard = card, sovereignty = null, sovereignView = false, onToggleSovereignView, tesseract, narrative, result }) {
  const [manifestState, setManifestState] = useState(null); // null | 'compiling' | 'downloading' | 'downloaded'

  // A new accord starts with the download button idle again
  useEffect(() => { setManifestState(null); }, [card.id]);

  const handleDownload = async () => {
    setManifestState('compiling');
    await new Promise(r => setTimeout(r, 850));
    const md = generateManifestMarkdown(fullCard, tesseract, result, narrative); // local file = client enclave: always complete
    const filename = `ECO_Sx_TRANSMUTATION_${Date.now()}.md`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setManifestState('downloading');
    await new Promise(r => setTimeout(r, 550));
    setManifestState('downloaded');
  };

  const mid = Math.round((card.hueA + card.hueB) / 2);
  const { hash } = tesseract;

  const NOTE_LAYERS = [
    { key: 'top',   label: 'TOP',   glyph: 'ᛏ', field: 'topNotes',   notes: card.topNotes,   color: '#FFD700', sub: 'high volatility',   pct: card.evap[0] },
    { key: 'heart', label: 'HEART', glyph: 'ᚺ', field: 'heartNotes', notes: card.heartNotes, color: '#d946ef', sub: 'medium volatility', pct: card.evap[1] },
    { key: 'base',  label: 'BASE',  glyph: 'ᛒ', field: 'baseNotes',  notes: card.baseNotes,  color: '#B8860B', sub: 'low volatility',    pct: card.evap[2] },
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
            <div className="w-1.5 h-1.5 rounded-full" style={{ border: '1px solid rgba(255,215,0,0.35)' }} />
            <span className="text-[7px] font-mono tracking-widest" style={{ color: 'rgba(255,215,0,0.4)' }}>UNSEALED</span>
          </div>
        </div>

        {/* ── Hash display ── */}
        <div className="mb-5 rounded-lg p-3" style={{ background: 'rgba(255,215,0,0.02)', border: '1px solid rgba(255,215,0,0.08)', opacity: 0, animation: 'sc-cardReveal 0.4s cubic-bezier(0.16,1,0.3,1) 300ms forwards' }}>
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

        {/* ── Sovereignty strip (spec §4) — omitted entirely on a clean compile ── */}
        {sovereignty && (sovereignty.redactions.length > 0 || sovereignty.threat === null) && (
          <div
            className="mb-5 rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap"
            style={{ border: '1px solid rgba(244,63,94,0.25)', background: 'rgba(244,63,94,0.04)' }}
          >
            <span className="text-[8px] font-mono tracking-widest" style={{ color: 'rgba(244,63,94,0.85)' }}>
              {sovereignty.threat === null
                ? '⛨ PANOPTICON OFFLINE — SEALED WITHOUT ASSESSMENT'
                : `⛨ THREAT ${sovereignty.threat} · RESISTANCE ${sovereignty.resistance} · EXPOSURE ${sovereignty.exposure} · ${sovereignty.redactions.length} FIELDS VAULTED`}
            </span>
            {sovereignty.redactions.length > 0 && (
              <button
                onClick={onToggleSovereignView}
                className="text-[8px] font-mono tracking-widest px-2 py-1 rounded-sm"
                style={{ border: '1px solid rgba(6,182,212,0.4)', color: '#06b6d4', background: 'none', cursor: 'pointer' }}
              >
                {sovereignView
                  ? '◈ SOVEREIGN VIEW · decrypted in client enclave — never transits'
                  : '[SOVEREIGN VIEW]'}
              </button>
            )}
          </div>
        )}

        {/* ── Name + Bottle ── */}
        <div className="flex items-start justify-between gap-4 mb-5" style={{ opacity: 0, animation: 'sc-cardReveal 0.4s cubic-bezier(0.16,1,0.3,1) 500ms forwards' }}>
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
              <span className="text-[9px] font-mono tracking-widest" style={{ color: 'rgba(255,215,0,0.55)' }}>{card.dom} × {card.sec}</span>
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

        {/* ── Note pyramid (public key data); the tier percentages are conceptual ── */}
        <div className="space-y-2 mb-5" style={{ opacity: 0, animation: 'sc-cardReveal 0.4s cubic-bezier(0.16,1,0.3,1) 600ms forwards' }}>
          <div className="text-[7px] font-mono tracking-widest" style={{ color: 'rgba(255,215,0,0.4)' }}>
            NOTE PYRAMID · conceptual
          </div>
          {NOTE_LAYERS.map(({ key, label, glyph, field, notes, color, sub, pct }) => (
            <div key={key} className="rounded-lg p-2.5" style={{ border: `1px solid ${color}12`, background: `${color}04` }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color, textShadow: `0 0 8px ${color}40` }}>{glyph}</span>
                  <span className="text-[8px] font-bold font-mono tracking-widest" style={{ color: `${color}bb` }}>{label}</span>
                  {card.__redacted?.includes(field) && (
                    <span className="text-[7px] font-mono tracking-widest" style={{ color: 'rgba(244,63,94,0.7)' }}>
                      [{sovereignty?.redactions?.find((r) => r.field === field)?.vectorId}]
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[7px] font-mono" style={{ color: `${color}50` }}>{sub}</span>
                  <span className="text-[7px] font-mono" style={{ color: `${color}50` }}>
                    {card.__redacted?.includes('evap') ? '██' : `${(pct * 100).toFixed(0)}%`}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {notes.map((note, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-mono px-2 py-0.5 rounded"
                    style={{ color: `${color}cc`, background: `${color}0d`, border: `1px solid ${color}1a` }}
                  >
                    {note}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── Decay Arc panel ── */}
        {/* Decay arc mirrors the display card's censorship — beats are ordered top/heart/base */}
        {narrative?.decayArc && (
          <DecayArcPanel
            beats={
              card.__redacted
                ? narrative.decayArc.map((b, i) => ({ ...b, notes: [card.topNotes, card.heartNotes, card.baseNotes][i] ?? b.notes }))
                : narrative.decayArc
            }
            hueA={card.hueA}
            hueB={card.hueB}
          />
        )}

        {/* ── Properties strip ── */}
        <div className="grid grid-cols-2 gap-2 mb-5" style={{ opacity: 0, animation: 'sc-cardReveal 0.4s cubic-bezier(0.16,1,0.3,1) 950ms forwards' }}>
          {[
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

        {/* ── Manifest download ── */}
        <div className="rounded-lg p-4 text-center transition-all duration-500"
          style={{
            border: manifestState === 'downloaded' ? '1px solid rgba(255,215,0,0.3)' : '1px solid rgba(255,215,0,0.09)',
            background: manifestState === 'downloaded' ? 'rgba(255,215,0,0.04)' : 'transparent',
            opacity: 0,
            animation: 'sc-cardReveal 0.5s cubic-bezier(0.16,1,0.3,1) 1500ms forwards',
          }}>
          {manifestState === 'compiling' || manifestState === 'downloading' ? (
            <div className="font-mono text-[10px] tracking-[0.2em] py-2" style={{ color: '#39FF14', textShadow: '0 0 10px rgba(57,255,20,0.5)' }}>
              {manifestState === 'compiling' ? '[COMPILING TESSERACT MANIFEST...]' : '[DOWNLOADING]'}
            </div>
          ) : (
            <>
              {manifestState === 'downloaded' && (
                <div
                  className="text-[12px] font-bold font-mono mb-3 tracking-[0.2em]"
                  style={{
                    color: '#39FF14',
                    textShadow: '0 0 15px rgba(57,255,20,0.4), 0 0 30px rgba(57,255,20,0.15)',
                    opacity: 0,
                    animation: 'sc-hashReveal 0.8s cubic-bezier(0.16,1,0.3,1) forwards',
                  }}>
                  ◈ MANIFEST COMPILED
                </div>
              )}
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
                ◈ DOWNLOAD MANIFEST
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bottom accent line */}
      <div className="h-px w-full" style={{ background: 'linear-gradient(90deg,transparent,rgba(217,70,239,0.2),rgba(255,215,0,0.3),transparent)' }} />
    </div>
  );
}

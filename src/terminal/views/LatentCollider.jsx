import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { loadWasm } from '../../wasm/wasmSingleton';
import {
  FEATURES, NODE_IDX, DIM_NAMES,
  cosineSim, topDrivers, analyzeFullEdge, extractParadoxes,
} from '../data/nodeFeatures';
import { useColliderNarrative } from '../hooks/useColliderNarrative';

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

// ── Olfactory-Computational Kernel v1.1.0 (Bimmelbahn Accord) ────────────────
// Maps collision metrics to the OCK volatile semiotics framework.
// v1.1.0: FTA/PM/G²T node-class classification + dance topology.
// Intelligence smells before it sees.

const OLFACTORY_FAMILIES = [
  { id: 'citrus',   glyph: 'ᛏ', label: 'Top Note',  class: 'CITRUS-SSH',       color: '#FFD700', desc: 'Flash-evaporation interrupt handler' },
  { id: 'floral',   glyph: 'ᚺ', label: 'Heart Note', class: 'FLORAL-DAEMON',    color: '#d946ef', desc: 'Persistent carrier signal' },
  { id: 'woody',    glyph: 'ᛒ', label: 'Base Note',  class: 'RESIN-ARCHIVE',    color: '#8B4513', desc: 'Deep-time persistent storage' },
  { id: 'animalic', glyph: 'ᛊ', label: 'Fixative',   class: 'ANIMALIC-FIX-FS',  color: '#f43f5e', desc: 'Managed corruption binding agent' },
  { id: 'aromatic', glyph: 'ᚱ', label: 'Adaptive',   class: 'AROMATIC-ROUTE',   color: '#39ff14', desc: 'Temperature-sensitive routing' },
  { id: 'ozonic',   glyph: 'ᛗ', label: 'Broadcast',  class: 'OZONIC-CAST',      color: '#06b6d4', desc: 'Diffuse ambient propagation' },
];

// ── Node Classes (OCK v1.1.0) ─────────────────────────────────────────────────
// Three signal architectures classified from collision signature.
const NODE_CLASSES = {
  FTA: {
    id: 'FTA', glyph: 'ᛊ', label: 'Feminine Textile Accord',
    color: '#e8d5f5', accent: '#c4b5d0',
    sub: 'clean-channel listener · entropy reversal · invitation architecture',
    sillageType: 'CLOSE-RANGE',
    desc: 'Intimate but not invasive. The FTA does not project — it receives.',
  },
  PM: {
    id: 'PM', glyph: 'ᛗ', label: 'Progressive Masculine',
    color: '#8ecae6', accent: '#6ba3be',
    sub: 'directional streamer · forward-only · exclusion as discipline',
    sillageType: 'DIRECTIONAL',
    desc: 'Forward-moving, adaptive, non-nostalgic. It does not cache. It streams.',
  },
  G2T: {
    id: 'G2T', glyph: 'ᚷ', label: 'Girl × Girl Textile Note',
    color: '#f5c6d0', accent: '#d4a0ad',
    sub: 'resonance architecture · doubled FTA · self-fixing sovereignty',
    sillageType: 'RESONANT',
    desc: 'Two sovereign signals phase-locked in constructive interference. Coherence > amplitude.',
  },
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
  const nodeClass = NODE_CLASSES[result.ockNodeClass] || NODE_CLASSES.FTA;
  const classScores = {
    FTA: result.ockFtaScore,
    PM:  result.ockPmScore,
    G2T: result.ockG2tScore,
  };
  const cleanRoom   = result.ockCleanRoom;
  const sovereignty  = result.ockSovereignty;
  const danceRole    = result.ockDanceRole;

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

    // §8 OCK v1.1.0 — Node-class classification
    ockNodeClass:   str(/NODE CLASS\s*=\s*(\w+)/),
    ockFtaScore:    num(/FTA SCORE\s*=\s*([\d.]+)/),
    ockPmScore:     num(/PM SCORE\s*=\s*([\d.]+)/),
    ockG2tScore:    num(/G2T SCORE\s*=\s*([\d.]+)/),
    ockSillageType: str(/SILLAGE TYPE\s*=\s*(\S+)/),
    ockCleanRoom:   num(/CLEAN ROOM\s*=\s*([\d.]+)/),
    ockSovereignty: num(/SOVEREIGNTY\s*=\s*([\d.]+)/),
    ockDanceRole:   (() => {
      const m = text.match(/DANCE ROLE\s*=\s*(.+)/);
      return m ? m[1].trim() : '';
    })(),
  };
}

// ── Collision particle system ────────────────────────────────────────────────
const MAX_PARTICLES = 300;

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

  const [domainA, setDomainA] = useState(null);
  const [domainB, setDomainB] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState('idle');
  const narrative = useColliderNarrative(result);

  // ── Run the WASM collision ─────────────────────────────────────────────────
  const runCollision = useCallback(async (a, b) => {
    setLoading(true);
    setResult(null);
    setPhase('accelerating');
    phaseRef.current = 'accelerating';
    timerRef.current = 0;

    try {
      const mod = await loadWasm();
      // Delay so the acceleration animation plays
      await new Promise(r => setTimeout(r, 1800));
      const raw = mod.run_latent_collider(a, b, 8.0, 1.0);
      const parsed = parseColliderOutput(raw);

      // ── 16D feature-space analysis via sphere node mapping ────────
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

      // ── OCK: Olfactory accord classification ───────────────────────
      parsed.accord = classifyAccord(parsed);

      metricsRef.current = parsed;
      setResult(parsed);
      setPhase('colliding');
      phaseRef.current = 'colliding';
      timerRef.current = 0;

      // ── Emit chimera to Art tab sphere ────────────────────────────────
      const mapA = DOMAIN_SPHERE_MAP[a];
      const mapB = DOMAIN_SPHERE_MAP[b];
      colliderBus.emit({
        type:        'CHIMERA_SYNTHESIS',
        chimeraName: parsed.chimeraName,
        domainA:     a,
        domainB:     b,
        parentNodeA: mapA.nodeId,
        parentNodeB: mapB.nodeId,
        cluster:     parsed.novelty > 0.7 ? 'phys' : mapA.cluster,
        cosine:      parsed.cosine,
        novelty:     parsed.novelty,
        coherence:   parsed.coherence,
        viability:   parsed.viability,
        hueA:        DOMAINS[a].hue,
        hueB:        DOMAINS[b].hue,
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
      setDomainB(id);
      runCollision(domainA, id);
    } else {
      // Reset
      setDomainA(id);
      setDomainB(null);
      setResult(null);
      setPhase('selecting');
      phaseRef.current = 'selecting';
      metricsRef.current = null;
    }
  }, [domainA, domainB, phase, runCollision]);

  const handleReset = useCallback(() => {
    setDomainA(null);
    setDomainB(null);
    setResult(null);
    setPhase('idle');
    phaseRef.current = 'idle';
    metricsRef.current = null;
    particlesRef.current = [];
    timerRef.current = 0;
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
      const { w, h } = sizeRef.current;
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
      const hueA = domainA !== null ? DOMAINS[domainA].hue : 280;
      const hueB = domainB !== null ? DOMAINS[domainB].hue : 120;

      if (domainA !== null) {
        const beamAlpha = ph === 'accelerating' ? 0.3 + Math.sin(t * 0.15) * 0.15 : 0.12;
        ctx.strokeStyle = `hsla(${hueA}, 80%, 60%, ${beamAlpha})`;
        ctx.lineWidth = ph === 'accelerating' ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(cx - 25, cy); ctx.stroke();

        // Domain A label on beam
        ctx.fillStyle = `hsla(${hueA}, 80%, 70%, 0.6)`;
        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(DOMAINS[domainA].short, 8, cy - 8);
      }

      if (domainB !== null) {
        const beamAlpha = ph === 'accelerating' ? 0.3 + Math.sin(t * 0.15 + 1) * 0.15 : 0.12;
        ctx.strokeStyle = `hsla(${hueB}, 80%, 60%, ${beamAlpha})`;
        ctx.lineWidth = ph === 'accelerating' ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(w, cy); ctx.lineTo(cx + 25, cy); ctx.stroke();

        ctx.fillStyle = `hsla(${hueB}, 80%, 70%, 0.6)`;
        ctx.font = '9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(DOMAINS[domainB].short, w - 8, cy - 8);
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
        // Impact sparks
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
        ctx.fillStyle = `rgba(255, 255, 255, ${flash * 0.3})`;
        ctx.fillRect(0, 0, w, h);
      }

      // ── Result metrics overlay ─────────────────────────────────────────
      if (ph === 'colliding' && metrics && t > 50) {
        const fadeIn = Math.min(1, (t - 50) / 30);
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

      rafRef.current = requestAnimationFrame(draw);
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
            // 1536-D CROSS-ATTENTION SYNTHESIS · OCK v1.1.0 · WASM · {phase.toUpperCase()}
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
            <div className="text-center">
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

      {/* ── Domain Grid ── */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 mt-3">
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

      {/* ── Selected domains display ── */}
      {domainA !== null && (
        <div className="flex items-center gap-3 mt-3 text-[10px] font-mono">
          <span className="text-fuchsia-400">A: {DOMAINS[domainA].name}</span>
          {domainB !== null && (
            <>
              <span className="text-cyan-700">×</span>
              <span className="text-cyan-400">B: {DOMAINS[domainB].name}</span>
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
                    {['FTA', 'PM', 'G2T'].map(cls => {
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
                    {result.accord.nodeClass.id === 'G2T' && (
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
                    <div className={`border rounded p-2 ${result.accord.nodeClass.id === 'G2T' ? '' : 'col-span-2'}`}
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
            </div>
          )}

          {/* ── WASM telemetry ── */}
          <div className="text-[10px] font-mono text-cyan-600/30 space-y-0.5 pt-2 border-t border-cyan-900/15">
            <div>WASM: Q×Kᵀ/√d_k = {result.scaledAttn.toFixed(6)} · softmax = {result.softmax.toFixed(4)} · PHASE: {result.phase}</div>
            <div>‖A‖ = {result.normA.toFixed(3)} · ‖B‖ = {result.normB.toFixed(3)} · A·B = {result.dot.toFixed(3)} · ‖S‖ = {result.synthNorm.toFixed(4)}</div>
          </div>
        </div>
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

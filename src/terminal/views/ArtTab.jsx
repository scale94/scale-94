// ArtTab.jsx — SOMA-9.4 // FEIGENBAUM_FADE // ARS ELECTRONICA 2027
//
// Orbital sphere topology: 25 kernel nodes constrained to a rotating unit sphere.
// Force-directed layout in 3D, perspective-projected onto Canvas2D.
// No WebGL dependency — full 3D feel via perspective divide + depth cueing.
//
// Interaction:
//   Left-click   → cue Hopfield associative field (WASM)
//   Right-click  → manual fusion: step 1 locks source (pulsing ring), step 2 forges edge
//   Long-press   → same as right-click on mobile (500ms, haptic feedback)
//   Drag         → rotate sphere (inertia on release)
//
// Color system: deterministic hash HSL via kernelColorMap.js

import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { Waves, Volume2, VolumeX, Maximize, Minimize, Circle, Download, Radio, Clock, Wifi } from 'lucide-react';
import { nodeColor, lerpColor, hslAlpha } from '../data/kernelColorMap';
import { useSomaGraph, CLUSTER_ANCHORS } from '../hooks/useSomaGraph';
import { useKineticEdges }                from '../hooks/useKineticEdges';
import { useAssociativeField }            from '../hooks/useAssociativeField';
import { useTemporalMemory }              from '../hooks/useTemporalMemory';
import { useMorphogenesis }               from '../hooks/useMorphogenesis';
import { useSpectralLight }               from '../hooks/useSpectralLight';
import { useAnalogicalReasoning }         from '../hooks/useAnalogicalReasoning';
import {
  NODES, NODE_IDX, FEATURES, DIM_NAMES,
  cosineSim, topDrivers, analyzeEdge, findOrthogonalNode,
  compareNodes, jitterFeatures,
} from '../data/nodeFeatures';
import { somaAudio } from '../audio/SomaAudio';
import { somaPresence } from '../audio/SomaPresence';
import { ecoDataFeed } from '../data/EcoDataFeed';

// ── Particle Ecology ────────────────────────────────────────────────────────
// Lightweight particle pool for edge energy flow, node bursts, and bifurcation trails.
// All particles are depth-sorted and rendered additively in the draw loop.
const MAX_PARTICLES = 400;

// ── Particle pool — flat SoA layout, ring-buffer allocation ─────────────────
// Each particle has: position (x,y,z on unit sphere), velocity (vx,vy,vz),
// life (0→maxLife frames), hue (0-360), sat (0-100), size (px), and a
// hueTarget for smooth in-flight color blending.

function createParticlePool() {
  return {
    xs:        new Float32Array(MAX_PARTICLES),
    ys:        new Float32Array(MAX_PARTICLES),
    zs:        new Float32Array(MAX_PARTICLES),
    vxs:       new Float32Array(MAX_PARTICLES),
    vys:       new Float32Array(MAX_PARTICLES),
    vzs:       new Float32Array(MAX_PARTICLES),
    lifes:     new Float32Array(MAX_PARTICLES),   // current age (frames)
    maxLifes:  new Float32Array(MAX_PARTICLES),   // total lifespan
    hues:      new Float32Array(MAX_PARTICLES),   // current hue
    hueTargets:new Float32Array(MAX_PARTICLES),   // blend destination hue
    sats:      new Float32Array(MAX_PARTICLES),   // saturation
    sizes:     new Float32Array(MAX_PARTICLES),   // base radius (px)
    next: 0,   // ring write head
    count: 0,  // live count
  };
}

function emitParticle(pool, x, y, z, vx, vy, vz, hue, hueTarget, sat, size, maxLife) {
  const i = pool.next % MAX_PARTICLES;
  pool.next = (i + 1) % MAX_PARTICLES;
  pool.xs[i] = x;   pool.ys[i] = y;   pool.zs[i] = z;
  pool.vxs[i] = vx; pool.vys[i] = vy; pool.vzs[i] = vz;
  pool.lifes[i] = 0;
  pool.maxLifes[i] = maxLife;
  pool.hues[i] = hue;
  pool.hueTargets[i] = hueTarget;
  pool.sats[i] = sat;
  pool.sizes[i] = size;
  pool.count = Math.min(pool.count + 1, MAX_PARTICLES);
}

function stepParticles(pool) {
  // In-place update — no compaction (avoids index aliasing bug)
  // Dead particles (life >= maxLife) are simply skipped during render.
  // Ring buffer naturally recycles slots.
  for (let i = 0; i < MAX_PARTICLES; i++) {
    if (pool.lifes[i] >= pool.maxLifes[i]) continue;
    pool.lifes[i] += 1;
    pool.xs[i] += pool.vxs[i];
    pool.ys[i] += pool.vys[i];
    pool.zs[i] += pool.vzs[i];
    pool.vxs[i] *= 0.964;  // drag
    pool.vys[i] *= 0.964;
    pool.vzs[i] *= 0.964;
    // Hue drift toward target (smooth color blend)
    const dh = pool.hueTargets[i] - pool.hues[i];
    const shortPath = dh > 180 ? dh - 360 : dh < -180 ? dh + 360 : dh;
    pool.hues[i] += shortPath * 0.018;
  }
}

// ── Idle ambient emitter — slow-drifting particles across the sphere ─────────
// Colors cycle through a warm→cool palette independent of user interaction.
let _idleHueDrift = 0;
function emitIdleParticles(pool, nodes) {
  _idleHueDrift = (_idleHueDrift + 0.18) % 360;
  // Pick a random live node as origin
  if (!nodes || nodes.length === 0) return;
  const n = nodes[Math.floor(Math.random() * nodes.length)];
  const hue = _idleHueDrift;
  const hueTarget = (_idleHueDrift + 40 + Math.random() * 80) % 360;
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(Math.random() * 2 - 1);
  const speed = 0.0005 + Math.random() * 0.0012;
  emitParticle(pool,
    n.x + (Math.random() - 0.5) * 0.08,
    n.y + (Math.random() - 0.5) * 0.08,
    n.z + (Math.random() - 0.5) * 0.08,
    Math.sin(phi) * Math.cos(theta) * speed,
    Math.sin(phi) * Math.sin(theta) * speed,
    Math.cos(phi) * speed,
    hue, hueTarget,
    55 + Math.random() * 30,   // sat
    0.6 + Math.random() * 0.8, // size
    120 + Math.random() * 180  // life
  );
}

// ── Click burst — radial explosion from node, hue = node cluster color ───────
function emitNodeBurst(pool, x, y, z, hue, hueTarget, count) {
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(Math.random() * 2 - 1);
    const speed = 0.003 + Math.random() * 0.009;
    emitParticle(pool, x, y, z,
      Math.sin(phi) * Math.cos(theta) * speed,
      Math.sin(phi) * Math.sin(theta) * speed,
      Math.cos(phi) * speed,
      hue, hueTarget,
      75 + Math.random() * 20,
      1.2 + Math.random() * 2.2,
      90 + Math.random() * 100
    );
  }
}

// ── Edge stream — particles flowing along an edge ────────────────────────────
function emitEdgeParticles(pool, ax, ay, az, bx, by, bz, hue, hueTarget, count) {
  for (let i = 0; i < count; i++) {
    const t = Math.random();
    emitParticle(pool,
      ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t,
      (bx - ax) * 0.002 + (Math.random() - 0.5) * 0.0008,
      (by - ay) * 0.002 + (Math.random() - 0.5) * 0.0008,
      (bz - az) * 0.002 + (Math.random() - 0.5) * 0.0008,
      hue, hueTarget,
      65 + Math.random() * 20,
      0.8 + Math.random() * 1.2,
      60 + Math.random() * 70
    );
  }
}

// ── Graph topology ────────────────────────────────────────────────────────────

const CLUSTERS = {
  eco:    { label: 'ecological'   },
  sync:   { label: 'synchrony'    },
  phys:   { label: 'physics'      },
  crypto: { label: 'cryptography' },
  drk:    { label: 'drk'          },
};

// NODES imported from nodeFeatures.js

// Intra-cluster edges — same cluster, always present
const INTRA_EDGES = [
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
const DEFAULT_CROSS_EDGES = [
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
const ALL_EDGES = [...INTRA_EDGES, ...DEFAULT_CROSS_EDGES];
const EDGES = ALL_EDGES;  // backward compat for edge count display

const ADJ = {};
NODES.forEach(n => { ADJ[n.id] = []; });
ALL_EDGES.forEach(([a, b]) => { ADJ[a]?.push(b); ADJ[b]?.push(a); });

// Pre-compute per-node colors once — immutable
const NODE_COLORS = Object.fromEntries(
  NODES.map(n => [n.id, nodeColor(n.id, n.cluster)])
);
const CLUSTER_COLORS = Object.fromEntries(
  Object.keys(CLUSTERS).map(k => [k, nodeColor(k, k)])
);

// ── Dynamic node registries (Period-Doubling bifurcation) ─────────────────────
// Module-level Maps so the RAF draw loop can read without React re-renders.
// Populated by handleBifurcate; cleared on initState (sphere reset).
const dynColorMap    = new Map();   // childId → color object (same shape as NODE_COLORS values)
const dynFeaturesMap = new Map();   // childId → Float32Array[16]

// analyzeEdge, cosineSim, topDrivers, NODES, FEATURES, NODE_IDX, DIM_NAMES — imported from nodeFeatures.js

// ── 3D math ───────────────────────────────────────────────────────────────────

// Build flat row-major 3×3 rotation matrix (Y then X rotation)
function buildRotMatrix(rx, ry) {
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  return [
     cy,       0,    sy,
     sx * sy,  cx,  -sx * cy,
    -cx * sy,  sx,   cx * cy,
  ];
}

// Apply rotation matrix M to vector (x, y, z)
function applyM(M, x, y, z) {
  return [
    M[0] * x + M[1] * y + M[2] * z,
    M[3] * x + M[4] * y + M[5] * z,
    M[6] * x + M[7] * y + M[8] * z,
  ];
}

// Perspective project rotated coords onto canvas
function project(rx, ry, rz, w, h, sphereR, focal) {
  const scale = focal / (focal + rz * sphereR);
  return {
    sx:    w / 2 + rx * sphereR * scale,
    sy:    h / 2 - ry * sphereR * scale,   // flip Y: canvas Y is down
    depth: rz,                              // [-1, +1] — used for alpha/size
    scale,
  };
}

// ── Query projection ──────────────────────────────────────────────────────────
// Maps a free-text query to the 16D feature space via keyword presence scoring,
// then ranks all NODES by cosine similarity. Used by `query <text>` in the
// geometry terminal and automatically populates the sphere probe visualisation.
const DIM_KEYWORDS = {
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

function _queryProject(text) {
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

// ── Component ─────────────────────────────────────────────────────────────────

const AUTO_SPIN = 0.0025;   // rad/frame continuous Y rotation
const FOCAL_K   = 2.8;      // focal = FOCAL_K × sphereR — controls perspective depth
const SPHERE_K  = 0.50;     // sphereR = SPHERE_K × min(w, h) — larger sphere, front and center

export default function ArtTab({ onRunKernel, onCueNode, associativeField, spectralBridges, boneFusions, probeNode, manualFusions = [], onManualFusion, orthogonalBridges = [], onOrthogonalBridge }) {
  const canvasRef    = useRef(null);
  const containerRef = useRef(null);
  const feigTitleRef = useRef(null);
  const rafRef       = useRef(null);
  const dimsRef      = useRef({ w: 900, h: 620 });
  const hoveredRef   = useRef(null);
  const [hoveredEdge, setHoveredEdge] = useState(null);  // { aId, bId, cosSim, drivers, isSpectralBridge }
  const [lockedEdge,  setLockedEdge]  = useState(null);  // click-locked readout (persists until click-away)
  const [selectedNode, setSelectedNode] = useState(null); // node click → show all connected edges with 16D analysis
  const [lockedOrtho, setLockedOrtho] = useState(null);  // most recent orthogonal bridge readout
  const edgeDebounceRef = useRef(null);                   // timeout id for hover debounce

  // ── Resonance Mode (Shift-Click two nodes → compare 16D cosine similarity) ──
  const [resonanceMode,   setResonanceMode]   = useState(false);
  const [resonanceNodes,  setResonanceNodes]  = useState([]);        // up to 2 node IDs
  const [resonanceResult, setResonanceResult] = useState(null);      // { sim, topDims }
  // Refs mirror state for RAF read-access without triggering re-renders
  const resonanceModeRef   = useRef(false);
  const resonanceNodesRef  = useRef([]);
  const resonanceResultRef = useRef(null);

  // ── Node hover tooltip ────────────────────────────────────────────────────
  const [hoveredTooltip, setHoveredTooltip] = useState(null);   // { id, label, cluster, topDims }
  const [tooltipPos,     setTooltipPos]     = useState({ x: 0, y: 0 });
  const tooltipTimerRef  = useRef(null);

  // ── Query projection result ───────────────────────────────────────────────
  const [queryResult, setQueryResult] = useState(null);         // { query, similarities }

  // ── Period-Doubling / Bifurcation ─────────────────────────────────────────
  const [bifurcCount, setBifurcCount] = useState(0);   // total child nodes spawned
  const birthMapRef = useRef(new Map());                // childId → {parentId, px, py, pz, t0}

  // ── Immersive Mode (fullscreen + bloom + vignette) ──────────────────────
  const [immersive, setImmersive]       = useState(false);
  const bloomCanvasRef  = useRef(null);   // offscreen canvas for bloom post-process
  const immersiveRef    = useRef(false);  // RAF-safe mirror

  // ── Particle Ecology ────────────────────────────────────────────────────
  const particlesRef = useRef(createParticlePool());
  const particleFrameRef = useRef(0);     // frame counter for edge particle emission

  // ── Associative Field (Hopfield + Feigenbaum) ──────────────────────────
  const {
    fieldRef, stepField, perturbNode: perturbField,
    getEnergy: getFieldEnergy, getPhase, getLyapunov, getBasins,
    onPhaseTransition,
  } = useAssociativeField({ nodes: NODES, adj: ADJ });

  // ── Temporal Memory (recording + playback) ────────────────────────────
  const {
    memoryRef, recordSnapshot,
    isRecording: tmIsRecording, isPlayback: tmIsPlayback,
    playbackFrame: tmPlaybackFrame,
    startPlayback, stopPlayback, togglePlayback,
    seekTo, getSnapshot, getSnapshotCount,
    playbackSpeed, setPlaybackSpeed, exportTimeline,
  } = useTemporalMemory();

  // ── Phase regime display ──────────────────────────────────────────────
  const [phaseRegime, setPhaseRegime] = useState('STABLE');
  const [phaseR, setPhaseR] = useState(2.8);
  const [phaseLyap, setPhaseLyap] = useState(0);
  const [recording, setRecording] = useState(false);
  const [playback, setPlayback] = useState(false);
  const [peerCount, setPeerCount] = useState(0);

  // ── Morphogenetic Sphere (living Voronoi topology) ─────────────────────
  const {
    morphRef, stepMorphogenesis, getCells, getMesh,
    cellCount, onDivision, onApoptosis, getDivisionHistory,
  } = useMorphogenesis({ fieldRef, phaseRegime });

  // ── Spectral PCA Light (eigenvalue → visible wavelength) ──────────────
  const {
    spectralRef, stepSpectral, getNodeColor: getSpectralColor,
    getAmbientColor, getParticipationRatio, getEigenspectrum,
    getSpectralFlux, getPCDirections,
  } = useSpectralLight({ fieldRef, features: FEATURES, nodeCount: NODES.length });

  // ── Analogical Reasoning (SME-lite + Gestalt completion + Chimera) ──────
  const {
    reasoningRef, stepReasoning,
    getAnalogies, getFilaments, getGhostNodes, getCompletionQuality,
    getClusterSync, getChimeraZones, getNodeChimeraState,
  } = useAnalogicalReasoning({ fieldRef });

  // ── Morphogenesis callbacks ───────────────────────────────────────────
  useEffect(() => {
    onDivision.current = (parentId, child1Id, child2Id) => {
      if (audioInitRef.current) somaAudio.playResonance?.({ freq: 660, overtone: 3, sim: 0.9 });
    };
    onApoptosis.current = (deadId, absorberId) => {
      if (audioInitRef.current) somaAudio.playNode?.('drk_entropy', { soft: true });
    };
  }, [onDivision, onApoptosis]);

  // ── Analogical reasoning display state (throttled from RAF) ──────────
  const [analogyCount, setAnalogyCount] = useState(0);
  const [chimeraActive, setChimeraActive] = useState(false);
  const [gestaltQuality, setGestaltQuality] = useState(0);

  // ── Eco data modulations ──────────────────────────────────────────────
  const ecoModRef = useRef(new Float32Array(16));

  // ── Audio state ─────────────────────────────────────────────────────────
  const [audioMuted, setAudioMuted] = useState(true);
  const audioInitRef = useRef(false);

  // ── Audio: init on first interaction ────────────────────────────────────
  const ensureAudio = useCallback(() => {
    if (!audioInitRef.current) {
      somaAudio.init();
      audioInitRef.current = true;
    }
  }, []);

  // ── State-driven background flash (bifurcation / orthogonal events) ────────
  const bgFlashRef = useRef(0); // decays from 1→0 over ~200ms

  // ── Manual fusion state machine ────────────────────────────────────────────
  // fusionSourceRef: read by draw loop (no re-render), set in sync with state
  const fusionSourceRef = useRef(null);
  const [fusionSource, _setFusionSource] = useState(null);
  const setFusionSource = (id) => { fusionSourceRef.current = id; _setFusionSource(id); };
  const fusionCursorRef = useRef(null);   // current cursor pos while selecting target
  const longPressRef    = useRef(null);   // mobile long-press timer

  // Rotation state — mutated directly, never causes re-render
  const rotRef  = useRef({ rx: 0.18, ry: 0 });
  // Drag state
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0, vx: 0, vy: 0 });

  // Dynamic cross-cluster edges — computed by spectral_bridge kernel, or default
  // Bone fusion edges + manual fusions are merged in when available
  const activeEdges = useMemo(() => {
    const base = !spectralBridges?.bridges?.length
      ? [...INTRA_EDGES, ...DEFAULT_CROSS_EDGES]
      : [...INTRA_EDGES, ...spectralBridges.bridges
          .map(([a, b]) => [NODES[a]?.id, NODES[b]?.id])
          .filter(([a, b]) => a && b)];

    const existing = new Set(base.map(([a, b]) => {
      const k = a < b ? `${a}:${b}` : `${b}:${a}`; return k;
    }));

    // Add bone fusion edges that aren't already present
    if (boneFusions?.fusions?.length) {
      for (const f of boneFusions.fusions) {
        if (!f.fused) continue;
        const idA = NODES[f.a]?.id, idB = NODES[f.b]?.id;
        if (!idA || !idB) continue;
        const key = idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
        if (!existing.has(key)) { base.push([idA, idB]); existing.add(key); }
      }
    }

    // Add operator-forged manual fusion edges
    for (const mf of manualFusions) {
      const key = mf.idA < mf.idB ? `${mf.idA}:${mf.idB}` : `${mf.idB}:${mf.idA}`;
      if (!existing.has(key)) { base.push([mf.idA, mf.idB]); existing.add(key); }
    }

    // Add orthogonal bridge edges (engine-forged divergent links)
    for (const ob of orthogonalBridges) {
      const key = ob.idA < ob.idB ? `${ob.idA}:${ob.idB}` : `${ob.idB}:${ob.idA}`;
      if (!existing.has(key)) { base.push([ob.idA, ob.idB]); existing.add(key); }
    }

    return base;
  }, [spectralBridges, boneFusions, manualFusions, orthogonalBridges]);

  // Bridge similarity lookup — for rendering computed bridges with strength-weighted visuals
  const bridgeSimilarityRef = useRef(null);
  useEffect(() => {
    if (!spectralBridges?.bridges?.length) { bridgeSimilarityRef.current = null; return; }
    const map = {};
    for (const [a, b, sim] of spectralBridges.bridges) {
      const idA = NODES[a]?.id, idB = NODES[b]?.id;
      if (idA && idB) {
        const key = idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
        map[key] = sim;
      }
    }
    bridgeSimilarityRef.current = map;
  }, [spectralBridges]);

  // Bone fusion lookup — fused edges rendered with solid glow (inverse of dashed spectral)
  // Also includes operator-forged manual fusions with identical rendering
  const fusedEdgesRef = useRef(null);
  useEffect(() => {
    const map = {};
    if (boneFusions?.fusions?.length) {
      for (const f of boneFusions.fusions) {
        if (!f.fused) continue;
        const idA = NODES[f.a]?.id, idB = NODES[f.b]?.id;
        if (idA && idB) {
          const key = idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
          map[key] = { pre: f.pre, post: f.post, burns: f.burns };
        }
      }
    }
    for (const mf of manualFusions) {
      const key = mf.idA < mf.idB ? `${mf.idA}:${mf.idB}` : `${mf.idB}:${mf.idA}`;
      map[key] = { pre: mf.sim * 0.5, post: mf.sim, burns: 1 };
    }
    fusedEdgesRef.current = Object.keys(map).length ? map : null;
  }, [boneFusions, manualFusions]);

  // Orthogonal bridge lookup — engine-forged edges rendered with hue-shifting glow
  const orthogonalEdgesRef = useRef(null);
  useEffect(() => {
    if (!orthogonalBridges.length) { orthogonalEdgesRef.current = null; return; }
    const map = {};
    for (const ob of orthogonalBridges) {
      const key = ob.idA < ob.idB ? `${ob.idA}:${ob.idB}` : `${ob.idB}:${ob.idA}`;
      map[key] = ob;
    }
    orthogonalEdgesRef.current = Object.keys(map).length ? map : null;
  }, [orthogonalBridges]);

  // Auto-show readout when a new orthogonal bridge is forged
  useEffect(() => {
    if (!orthogonalBridges.length) return;
    const latest = orthogonalBridges[orthogonalBridges.length - 1];
    setLockedOrtho(latest);
    setLockedEdge(null);
    setSelectedNode(null);
  }, [orthogonalBridges]);

  // ── Per-node edge analysis (computed on click, not on hover) ──────────────
  const selectedNodeEdges = useMemo(() => {
    if (!selectedNode) return null;
    const neighbors = ADJ[selectedNode] ?? [];
    if (!neighbors.length) return null;
    const simMap = bridgeSimilarityRef.current;
    return neighbors.map(nbId => {
      const analysis = analyzeEdge(selectedNode, nbId);
      const edgeKey = selectedNode < nbId ? `${selectedNode}:${nbId}` : `${nbId}:${selectedNode}`;
      const isSpectralBridge = simMap ? edgeKey in simMap : false;
      return {
        aId: selectedNode,
        bId: nbId,
        cosSim: analysis?.sim ?? 0,
        drivers: analysis?.drivers ?? [],
        isSpectralBridge,
      };
    }).sort((a, b) => b.cosSim - a.cosSim);  // strongest first
  }, [selectedNode]);

  const {
    stateRef, initState, step: stepGraph,
    fireNode, applyAttractor, triggerOverwrite, triggerBifurcation,
  } = useSomaGraph({ nodes: NODES, adj: ADJ });

  const {
    edgeStateRef, stepEdges, applyAttractor: applyEdgeAttractor,
  } = useKineticEdges({ edges: activeEdges, nodes: NODES });

  // ── Fired-node label cascade ──────────────────────────────────────────────
  // When a node is clicked, store its neighborhood so the draw loop can
  // render their labels with a staggered fade-in / hold / fade-out envelope.
  const firedRef = useRef(null);  // { seedId, neighborIds: Set, t0: ms }

  // ── Probe node — text_probe.rs concept injection ──────────────────────────
  // { query, probe_vector, similarities: [{ id, label, cluster, sim, dist }...] }
  const probeNodeRef = useRef(null);
  useEffect(() => { probeNodeRef.current = probeNode ?? null; }, [probeNode]);

  // ── Geometry prism effects ────────────────────────────────────────────────
  const geomEffectsRef = useRef([]);
  const [termInput,       setTermInput]       = useState('');
  const [lastCmd,         setLastCmd]         = useState('');

  const spawnEffect = useCallback((alias, opts = {}) => {
    const q    = (alias ?? '').toLowerCase().trim();
    const node = NODES.find(n =>
      n.alias === q || n.id === q ||
      n.label === q || n.label.replace(/_/g, '') === q
    );

    // Degree-scaled intensity: hub nodes (many edges) get stronger, longer effects
    const degree   = node ? (ADJ[node.id]?.length ?? 1) : 2;
    const maxLife  = opts.soft ? 120 : Math.min(300, 140 + degree * 18);
    const intensity = opts.soft ? 0.55 : Math.min(1.0, 0.55 + degree * 0.07);

    // Core neighborhood
    const localIds = node
      ? [...new Set([node.id, ...(ADJ[node.id] ?? [])])]
      : NODES.slice(0, 5).map(n => n.id);

    // Cross-cluster bridges: pick 1-2 nodes from other clusters for sacred geometry
    if (node && !opts.soft) {
      const otherClusters = [...new Set(
        NODES.filter(n => n.cluster !== node.cluster).map(n => n.cluster)
      )];
      // One bridge per foreign cluster, up to 2
      for (const cl of otherClusters.slice(0, 2)) {
        const bridge = NODES.find(n => n.cluster === cl && !localIds.includes(n.id));
        if (bridge) localIds.push(bridge.id);
      }
    }

    // Mobile: coarse-pointer devices use reduced complexity (fewer nodes, shorter life)
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const nodeLimit = coarse ? 6 : 11;

    // Hard cap: max 4 concurrent effects — drop oldest to prevent perf abuse
    if (geomEffectsRef.current.length >= 4) geomEffectsRef.current.shift();

    // Palette: left-click → cluster hue, right-click → complementary shift, idle → drift
    const clusterHue = node ? (NODE_COLORS[node.id]?.hue ?? Math.random() * 360) : Math.random() * 360;
    const hueBase    = opts.hueOverride ?? clusterHue;
    const hueTarget  = opts.hueTarget   ?? (hueBase + (opts.rightClick ? 180 : 90) + Math.random() * 60) % 360;

    geomEffectsRef.current.push({
      id:        Date.now() + Math.random(),
      nodeIds:   localIds.slice(0, nodeLimit),
      life:      0,
      maxLife:   coarse ? Math.min(maxLife, 150) : maxLife,
      hueBase,
      hueTarget,
      intensity: coarse ? Math.min(intensity, 0.7) : intensity,
      coarse,
    });

    // Emit particle burst from live physics node position
    if (node) {
      const liveNode = stateRef.current?.nodes?.find(n => n.id === node.id);
      if (liveNode) {
        emitNodeBurst(particlesRef.current, liveNode.x, liveNode.y, liveNode.z,
          hueBase, hueTarget, opts.soft ? 10 : 22
        );
      }
    }

    if (node) { fireNode(node.id); ensureAudio(); somaAudio.playNode(node.id); }
  }, [fireNode, ensureAudio]);

  const handleRunKernel = useCallback((alias) => {
    spawnEffect(alias);
    if (onRunKernel) onRunKernel(alias);
  }, [spawnEffect, onRunKernel]);

  const handleTermSubmit = useCallback((e) => {
    e.preventDefault();
    // Sanitize: only word chars, spaces, dashes — no shell metacharacters
    const raw = termInput.trim().replace(/[^a-zA-Z0-9 _\-]/g, '').slice(0, 80);
    if (!raw) return;

    // ── Query projection: `query <text>` maps text → 16D and ranks nodes ──
    if (raw.startsWith('query ')) {
      const qText = raw.slice(6).trim();
      if (qText) {
        const result = _queryProject(qText);
        probeNodeRef.current = result;
        setQueryResult(result);
        setLastCmd(`query: ${qText.slice(0, 22)}`);
        setTermInput('');
        return;
      }
    }
    // `clear query` dismisses the probe
    if (raw === 'clear query' || raw === 'query clear') {
      probeNodeRef.current = null;
      setQueryResult(null);
      setLastCmd('query cleared');
      setTermInput('');
      return;
    }

    const alias = raw.startsWith('run ') ? raw.slice(4).trim() : raw;
    setLastCmd(raw);
    setTermInput('');
    handleRunKernel(alias);
  }, [termInput, handleRunKernel]);

  // ── Period-Doubling trigger ───────────────────────────────────────────────
  // Computes connection degree per node from activeEdges, finds top 15%,
  // spawns child SimNodes with ±2.5% tensor drift, registers birth animations.
  const handleBifurcate = useCallback(() => {
    // Build degree map from current active edge set
    const degreeMap = {};
    NODES.forEach(n => { degreeMap[n.id] = 0; });
    activeEdges.forEach(([a, b]) => {
      degreeMap[a] = (degreeMap[a] ?? 0) + 1;
      degreeMap[b] = (degreeMap[b] ?? 0) + 1;
    });

    const spawned = triggerBifurcation(degreeMap);
    if (!spawned.length) return;

    const now = performance.now();
    for (const { childId, parentId, px, py, pz } of spawned) {
      // Register 400ms cubic-bezier birth animation
      birthMapRef.current.set(childId, { parentId, px, py, pz, t0: now });

      // Inherit parent color (exact) — child is visually distinguishable via
      // position and bleed animation; no hue shift needed
      const parentColor = NODE_COLORS[parentId];
      if (parentColor) dynColorMap.set(childId, parentColor);

      // Jitter parent's 16D tensor ±2.5% for the child's feature fingerprint
      const childFeats = jitterFeatures(parentId);
      if (childFeats) dynFeaturesMap.set(childId, childFeats);
    }

    setBifurcCount(c => c + spawned.length);
    ensureAudio(); somaAudio.playBifurcation(spawned.length);
  }, [activeEdges, triggerBifurcation, ensureAudio]);

  // ── Push incoming attractor data ─────────────────────────────────────────
  useEffect(() => {
    if (!associativeField) return;
    applyAttractor(associativeField);
    applyEdgeAttractor(associativeField, NODES, triggerOverwrite);
  }, [associativeField, applyAttractor, applyEdgeAttractor, triggerOverwrite]);

  // ── Resize observer ───────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const W = Math.floor(entries[0].contentRect.width);
      const H = immersiveRef.current
        ? Math.floor(entries[0].contentRect.height || window.innerHeight)
        : Math.floor(Math.min(Math.max(W * 0.65, 360), 580));
      dimsRef.current = { w: W, h: H };
      if (canvasRef.current) {
        const dpr = window.devicePixelRatio || 1;
        canvasRef.current.width  = W * dpr;
        canvasRef.current.height = H * dpr;
        canvasRef.current.style.width  = W + 'px';
        canvasRef.current.style.height = H + 'px';
      }
      initState();
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [initState]);

  // ── RAF draw loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    initState();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      const s  = stateRef.current;
      const es = edgeStateRef.current;
      if (!s) { rafRef.current = requestAnimationFrame(draw); return; }

      const { nodes } = s;
      const { w, h }  = dimsRef.current;
      const sphereR   = Math.min(w, h) * SPHERE_K;
      const focal     = sphereR * FOCAL_K;

      // ── Update rotation ───────────────────────────────────────────────────
      const drag = dragRef.current;
      if (!drag.active) {
        // Time dilation: when a node is hovered, dampen rotation so user can click
        const hovered = hoveredRef.current != null;
        const decay   = hovered ? 0.82 : 0.94;
        const spin    = hovered ? AUTO_SPIN * 0.15 : AUTO_SPIN;
        drag.vx *= decay;
        drag.vy *= decay;
        rotRef.current.rx += drag.vx;
        rotRef.current.ry += drag.vy + spin;
      }
      const M = buildRotMatrix(rotRef.current.rx, rotRef.current.ry);

      // ── Step simulations ──────────────────────────────────────────────────
      stepGraph();
      stepEdges();
      stepField();
      stepMorphogenesis();
      stepSpectral();
      stepReasoning();

      // ── Throttled reasoning state push (every ~60 frames ≈ 2s) ──────────
      if (particleFrameRef.current % 60 === 0) {
        const _ac = getAnalogies().length;
        const _cz = getChimeraZones().length > 0;
        const _gq = getCompletionQuality();
        setAnalogyCount(_ac);
        setChimeraActive(_cz);
        setGestaltQuality(_gq);
      }

      // ── Apply Hopfield activations to node energies ──────────────────────
      if (fieldRef.current) {
        const acts = fieldRef.current.activations;
        for (let i = 0; i < Math.min(nodes.length, acts.length); i++) {
          nodes[i].energy = Math.max(nodes[i].energy, acts[i] * 0.6);
        }
      }

      // ── Record temporal snapshot (every ~30 frames) ──────────────────────
      if (tmIsRecording.current) {
        recordSnapshot(stateRef, edgeStateRef, fieldRef);
      }

      // ── Project all nodes ─────────────────────────────────────────────────
      const proj = nodes.map(n => {
        const [rx, ry, rz] = applyM(M, n.x, n.y, n.z);
        return { ...project(rx, ry, rz, w, h, sphereR, focal), id: n.id };
      });

      // ── Depth-sort indices for painter's algorithm ────────────────────────
      // Render far (negative depth) first, near last
      const sortedNodeIdx = nodes.map((_, i) => i)
        .sort((a, b) => proj[a].depth - proj[b].depth);

      // ── Step particle ecology ─────────────────────────────────────────────
      const pool = particlesRef.current;
      stepParticles(pool);
      particleFrameRef.current++;
      const pFrame = particleFrameRef.current;

      // Emit edge energy particles every ~8 frames on high-energy edges
      if (es && pFrame % 8 === 0) {
        for (const e of es) {
          if (e.pulse < 0.2) continue;
          const iA = nodes.findIndex(n => n.id === e.aId);
          const iB = nodes.findIndex(n => n.id === e.bId);
          if (iA < 0 || iB < 0) continue;
          const colA = NODE_COLORS[e.aId];
          const colB = NODE_COLORS[e.bId];
          const hue = colA?.hue ?? 30;
          const hueTarget = colB?.hue ?? (hue + 60) % 360;
          emitEdgeParticles(pool,
            nodes[iA].x, nodes[iA].y, nodes[iA].z,
            nodes[iB].x, nodes[iB].y, nodes[iB].z,
            hue, hueTarget, 2
          );
        }
      }

      // Emit burst particles from high-energy nodes
      for (const n of nodes) {
        if (n.energy > 0.7 && Math.random() < 0.15) {
          const col = NODE_COLORS[n.id];
          const hue = col?.hue ?? 30;
          const hueTarget = (hue + 120 + Math.random() * 60) % 360;
          emitNodeBurst(pool, n.x, n.y, n.z, hue, hueTarget, 3);
        }
      }

      // Emit particles along analogy filaments (thin golden trail)
      if (pFrame % 12 === 0) {
        const _fils = getFilaments();
        for (const fil of _fils) {
          if (fil.strength < 0.2 || fil.nodeA >= nodes.length || fil.nodeB >= nodes.length) continue;
          if (Math.random() > fil.strength) continue;
          const nA = nodes[fil.nodeA], nB = nodes[fil.nodeB];
          if (!nA || !nB) continue;
          emitEdgeParticles(pool,
            nA.x, nA.y, nA.z, nB.x, nB.y, nB.z,
            40, 55, // golden hue range
            1
          );
        }
      }

      // ── Clear with trail fade ─────────────────────────────────────────────
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = immersiveRef.current ? 'rgba(0,0,0,0.32)' : 'rgba(0,0,0,0.72)';
      ctx.fillRect(0, 0, w, h);

      // ── State-driven flash — brief anthracite grid on bifurcation events ──
      if (bgFlashRef.current > 0.005) {
        const flash = bgFlashRef.current;
        bgFlashRef.current *= 0.92; // exponential decay ~200ms
        const fAlpha = flash * 0.08;
        ctx.strokeStyle = `rgba(58,58,62,${fAlpha.toFixed(4)})`;
        ctx.lineWidth = 0.5;
        // Draw a hex grid that only appears during events
        const gridStep = 28;
        for (let gy = 0; gy < h; gy += gridStep * 0.866) {
          const row = Math.floor(gy / (gridStep * 0.866));
          const offset = (row % 2) * gridStep * 0.5;
          for (let gx = offset; gx < w; gx += gridStep) {
            ctx.beginPath();
            for (let k = 0; k < 6; k++) {
              const angle = Math.PI / 3 * k - Math.PI / 6;
              const hx = gx + Math.cos(angle) * gridStep * 0.5;
              const hy = gy + Math.sin(angle) * gridStep * 0.5;
              k === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
            }
            ctx.closePath();
            ctx.stroke();
          }
        }
      }

      // ── Spectral ambient — immersive mode only, otherwise pure black ────
      if (immersiveRef.current) {
        const _ambient = getAmbientColor();
        if (_ambient) {
          const _aGrd = ctx.createRadialGradient(w/2, h/2, sphereR * 0.3, w/2, h/2, sphereR * 1.6);
          const _intensity = Math.min(1, (_ambient[3] ?? 0.08)) * 0.10;
          _aGrd.addColorStop(0, `rgba(38,38,42,${_intensity.toFixed(3)})`);
          _aGrd.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = _aGrd;
          ctx.fillRect(0, 0, w, h);
        }
      }

      // ── Sphere wireframe ghost ────────────────────────────────────────────
      // Subtle equator ellipse as spatial anchor
      const eqRx = sphereR;
      const eqRy = sphereR * Math.abs(Math.cos(rotRef.current.rx));
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, eqRx, eqRy, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Vertical great circle
      const vRx = sphereR * Math.abs(Math.cos(rotRef.current.ry));
      const vRy = sphereR;
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, vRx, vRy, 0, 0, Math.PI * 2);
      ctx.stroke();

      // ── Cluster ghost labels (projected anchor positions) ─────────────────
      ctx.textAlign = 'center';
      Object.entries(CLUSTER_ANCHORS).forEach(([key, a]) => {
        const [rx, ry, rz] = applyM(M, a.x, a.y, a.z);
        if (rz < -0.2) return;  // skip labels on the back face
        const p   = project(rx, ry, rz, w, h, sphereR, focal);
        const col = CLUSTER_COLORS[key];
        const al  = Math.max(0, rz) * 0.12;
        ctx.font      = 'bold 9px monospace';
        ctx.fillStyle = hslAlpha(col, al);
        ctx.fillText(CLUSTERS[key].label.toUpperCase(), p.sx, p.sy - 52 * p.scale);
      });

      // ── Voronoi Mesh — suppressed in default view, only in immersive mode ──
      // The tessellation competes with node data at normal scale; reserve for
      // full-screen immersive where the geometry reads as texture not noise.
      if (immersiveRef.current) {
        const meshLines = getMesh();
        if (meshLines && meshLines.length > 0) {
          ctx.lineWidth = 0.5;
          for (const seg of meshLines) {
            const pA = project(seg.a[0], seg.a[1], seg.a[2], w, h, sphereR, focal);
            const pB = project(seg.b[0], seg.b[1], seg.b[2], w, h, sphereR, focal);
            if (pA.depth < -0.3 && pB.depth < -0.3) continue;
            const opacity = Math.max(0, Math.min(1, (pA.depth + pB.depth) * 0.5 + 0.5)) * (seg.opacity ?? 0.12);
            ctx.strokeStyle = `rgba(58,58,62,${(opacity * 0.5).toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(pA.sx, pA.sy);
            ctx.lineTo(pB.sx, pB.sy);
            ctx.stroke();
          }
        }
      }

      // ── Analogy Filaments — thin golden threads connecting structurally similar nodes ──
      {
        const filaments = getFilaments();
        if (filaments.length > 0) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const _t = performance.now() * 0.001;
          for (const fil of filaments) {
            const iA = fil.nodeA, iB = fil.nodeB;
            if (iA >= nodes.length || iB >= nodes.length) continue;
            const pA = proj[iA], pB = proj[iB];
            if (!pA || !pB) continue;
            const avgDepth = (pA.depth + pB.depth) / 2;
            if (avgDepth < -0.5) continue;
            const depthFade = Math.max(0, (avgDepth + 1) * 0.5);
            const alpha = fil.strength * depthFade * 0.65;
            if (alpha < 0.01) continue;

            // Shimmering hue based on time + node positions
            const hue = (40 + Math.sin(_t * 0.7 + iA * 0.3) * 15) | 0; // golden range 25-55

            // Wide diffuse glow
            ctx.strokeStyle = `hsla(${hue},85%,65%,${(alpha * 0.35).toFixed(3)})`;
            ctx.lineWidth = 3.5 * ((pA.scale + pB.scale) / 2);
            ctx.setLineDash([6, 8]);
            ctx.beginPath();
            ctx.moveTo(pA.sx, pA.sy);
            // Slight arc toward sphere center for "inside the sphere" look
            const midX = (pA.sx + pB.sx) / 2;
            const midY = (pA.sy + pB.sy) / 2;
            const cpx = midX + (w / 2 - midX) * 0.25;
            const cpy = midY + (h / 2 - midY) * 0.25;
            ctx.quadraticCurveTo(cpx, cpy, pB.sx, pB.sy);
            ctx.stroke();

            // Sharp core
            ctx.strokeStyle = `hsla(${hue},90%,88%,${(alpha * 0.7).toFixed(3)})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(pA.sx, pA.sy);
            ctx.quadraticCurveTo(cpx, cpy, pB.sx, pB.sy);
            ctx.stroke();
          }
          ctx.setLineDash([]);
          ctx.restore();
        }
      }

      // ── Chimera boundary zones — flickering interference at sync/async borders ──
      {
        const zones = getChimeraZones();
        if (zones.length > 0) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const _ct = performance.now() * 0.001;
          for (const zone of zones) {
            // Find the cross-cluster edges that form this boundary
            // and render flickering interference fringes along them
            const strength = Math.min(1, zone.boundaryStrength * 2);
            if (strength < 0.05) continue;

            // Hue oscillates between the two sync states
            const hue = (180 + Math.sin(_ct * 3.5 + zone.syncA * 10) * 60) | 0;
            const flicker = 0.4 + Math.sin(_ct * 7 + zone.syncB * 5) * 0.3;
            const alpha = strength * flicker * 0.25;

            // Render a subtle pulsing arc between cluster centroids
            // (use first nodes of each cluster as rough anchors)
            const membersA = nodes.filter(n => n.cluster === zone.clusterA);
            const membersB = nodes.filter(n => n.cluster === zone.clusterB);
            if (membersA.length === 0 || membersB.length === 0) continue;

            // Centroid of each cluster in projected space
            let cxA = 0, cyA = 0, cxB = 0, cyB = 0;
            let countA = 0, countB = 0;
            for (const n of membersA) {
              const idx = nodes.indexOf(n);
              if (idx >= 0 && proj[idx]) {
                cxA += proj[idx].sx; cyA += proj[idx].sy; countA++;
              }
            }
            for (const n of membersB) {
              const idx = nodes.indexOf(n);
              if (idx >= 0 && proj[idx]) {
                cxB += proj[idx].sx; cyB += proj[idx].sy; countB++;
              }
            }
            if (countA === 0 || countB === 0) continue;
            cxA /= countA; cyA /= countA;
            cxB /= countB; cyB /= countB;

            // Interference fringe — dashed arc with phase-shifting dash offset
            ctx.strokeStyle = `hsla(${hue},70%,60%,${alpha.toFixed(3)})`;
            ctx.lineWidth = 2 + strength * 3;
            ctx.setLineDash([4, 6]);
            ctx.lineDashOffset = _ct * 30;  // scrolling dash pattern
            ctx.beginPath();
            const bMidX = (cxA + cxB) / 2;
            const bMidY = (cyA + cyB) / 2;
            const bCpx = bMidX + (w / 2 - bMidX) * 0.3;
            const bCpy = bMidY + (h / 2 - bMidY) * 0.3;
            ctx.moveTo(cxA, cyA);
            ctx.quadraticCurveTo(bCpx, bCpy, cxB, cyB);
            ctx.stroke();
          }
          ctx.setLineDash([]);
          ctx.lineDashOffset = 0;
          ctx.restore();
        }
      }

      // ── Edges (depth-sorted by average node depth) ────────────────────────
      if (es) {
        // Sort edges: far first
        const sortedEdges = [...es].sort((eA, eB) => {
          const iA1 = nodes.findIndex(n => n.id === eA.aId);
          const iA2 = nodes.findIndex(n => n.id === eA.bId);
          const iB1 = nodes.findIndex(n => n.id === eB.aId);
          const iB2 = nodes.findIndex(n => n.id === eB.bId);
          const dA  = ((proj[iA1]?.depth ?? 0) + (proj[iA2]?.depth ?? 0)) / 2;
          const dB  = ((proj[iB1]?.depth ?? 0) + (proj[iB2]?.depth ?? 0)) / 2;
          return dA - dB;
        });

        for (const e of sortedEdges) {
          const iA = nodes.findIndex(n => n.id === e.aId);
          const iB = nodes.findIndex(n => n.id === e.bId);
          if (iA < 0 || iB < 0) continue;

          const na   = nodes[iA], nb = nodes[iB];
          const pA   = proj[iA],  pB = proj[iB];
          const colA = NODE_COLORS[e.aId];
          const colB = NODE_COLORS[e.bId];

          // Spectral bridge detection — computed bridges get cosine similarity boost
          const simMap = bridgeSimilarityRef.current;
          const edgeKey = e.aId < e.bId ? `${e.aId}:${e.bId}` : `${e.bId}:${e.aId}`;
          const isSpectral = simMap && edgeKey in simMap;
          const cosSim     = isSpectral ? simMap[edgeKey] : 0;

          // Bone fusion detection — fused edges get solid glow
          const fuseMap  = fusedEdgesRef.current;
          const isFused  = fuseMap && edgeKey in fuseMap;
          const fuseCos  = isFused ? fuseMap[edgeKey].post : 0;

          // Orthogonal bridge detection — engine-forged divergent links get hue-shift glow
          const orthoMap = orthogonalEdgesRef.current;
          const isOrtho  = orthoMap && edgeKey in orthoMap;

          // Depth-based base alpha — fade edges on the back of the sphere
          const avgDepth  = (pA.depth + pB.depth) / 2;
          const depthFade = Math.max(0.03, (avgDepth + 1) * 0.5);  // 0→dim, 1→bright
          // Spectral bridges: cosine similarity boosts alpha and line width
          const spectralBoost = isSpectral ? cosSim * 0.35 : 0;
          // Bone fusion: fused edges get an even stronger boost
          const fusionBoost   = isFused ? fuseCos * 0.5 : 0;
          const baseAlpha = (Math.min(na.energy, nb.energy) * 0.5 + 0.06 + spectralBoost + fusionBoost) * depthFade;
          const pulseBoost = e.pulse * 0.40;

          ctx.lineWidth = (0.5 + Math.max(na.energy, nb.energy) * 0.8 + e.pulse * 1.8
                        + (isSpectral ? cosSim * 1.2 : 0)
                        + (isFused ? fuseCos * 2.0 : 0)
                        + (isOrtho ? 2.0 : 0))
                        * ((pA.scale + pB.scale) / 2);

          // Orthogonal bridges: hue-shifting gradient (magenta↔cyan), overrides default grd
          // Fused edges: solid bright glow (mineralized bone)
          // Spectral bridges: dashed stroke for visual distinction
          // Default: solid thin
          if (isOrtho) {
            const ot  = Date.now() * 0.0008;
            const hue = (ot * 60) % 360;                           // full rotation ~6s
            const orthoAlpha = Math.min(1, baseAlpha + pulseBoost + 0.3) * depthFade;
            const oGrd = ctx.createLinearGradient(pA.sx, pA.sy, pB.sx, pB.sy);
            oGrd.addColorStop(0,   `hsla(${hue},100%,65%,${orthoAlpha})`);
            oGrd.addColorStop(0.5, `hsla(${(hue + 60) % 360},100%,72%,${Math.min(1, orthoAlpha + 0.15)})`);
            oGrd.addColorStop(1,   `hsla(${(hue + 150) % 360},100%,65%,${orthoAlpha})`);
            ctx.strokeStyle  = oGrd;
            ctx.shadowColor  = `hsl(${(hue + 30) % 360},100%,60%)`;
            ctx.shadowBlur   = 10 + Math.sin(ot * 3) * 4;
            ctx.setLineDash([8, 4]);
            ctx.beginPath();
            ctx.moveTo(pA.sx, pA.sy);
            ctx.lineTo(pB.sx, pB.sy);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur  = 0;
          } else {
            const cMid = lerpColor(colA, colB, e.strength);
            const grd  = ctx.createLinearGradient(pA.sx, pA.sy, pB.sx, pB.sy);
            grd.addColorStop(0,   hslAlpha(colA, (baseAlpha + pulseBoost) * (1 - e.strength * 0.4)));
            grd.addColorStop(0.5, hslAlpha(cMid, baseAlpha + pulseBoost));
            grd.addColorStop(1,   hslAlpha(colB, (baseAlpha + pulseBoost) * (0.6 + e.strength * 0.4)));
            ctx.strokeStyle = grd;

            if (isFused) {
              ctx.shadowColor = hslAlpha(cMid, fuseCos * 0.6);
              ctx.shadowBlur  = 6 + fuseCos * 8;
            }
            if (isSpectral && !isFused) ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(pA.sx, pA.sy);
            ctx.lineTo(pB.sx, pB.sy);
            ctx.stroke();
            if (isSpectral && !isFused) ctx.setLineDash([]);
            if (isFused) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; }
          }

          // Overwrite pulse ring
          if (e.pulse > 0.1) {
            const t  = e.direction >= 0 ? e.pulse : 1 - e.pulse;
            const px = pA.sx + (pB.sx - pA.sx) * t;
            const py = pA.sy + (pB.sy - pA.sy) * t;
            const src = e.direction >= 0 ? colA : colB;
            ctx.beginPath();
            ctx.arc(px, py, (2 + e.pulse * 2.5) * pA.scale, 0, Math.PI * 2);
            ctx.fillStyle = hslAlpha(src, e.pulse * depthFade * 0.9);
            ctx.fill();
          }
        }
      }

      // ── Resonance edge (Shift-Click comparison — solid glowing coalescence) ──
      if (resonanceModeRef.current && resonanceNodesRef.current.length === 2) {
        const [rIdA, rIdB] = resonanceNodesRef.current;
        const rIA = nodes.findIndex(n => n.id === rIdA);
        const rIB = nodes.findIndex(n => n.id === rIdB);
        if (rIA >= 0 && rIB >= 0) {
          const rResult = resonanceResultRef.current;
          const sim     = rResult?.sim ?? 0.5;
          const pRA = proj[rIA], pRB = proj[rIB];
          const avgScale = (pRA.scale + pRB.scale) / 2;

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';

          // Outer bloom halo — wide, low alpha
          const haloGrd = ctx.createLinearGradient(pRA.sx, pRA.sy, pRB.sx, pRB.sy);
          haloGrd.addColorStop(0,   `rgba(255,215,0,${(0.06 + sim * 0.12).toFixed(3)})`);
          haloGrd.addColorStop(0.5, `rgba(255,255,200,${(0.04 + sim * 0.10).toFixed(3)})`);
          haloGrd.addColorStop(1,   `rgba(255,215,0,${(0.06 + sim * 0.12).toFixed(3)})`);
          ctx.strokeStyle = haloGrd;
          ctx.lineWidth   = (8 + sim * 16) * avgScale;
          ctx.shadowBlur  = 0;
          ctx.beginPath(); ctx.moveTo(pRA.sx, pRA.sy); ctx.lineTo(pRB.sx, pRB.sy); ctx.stroke();

          // Core solid line — width and bloom scale linearly with cosine similarity
          const coreGrd = ctx.createLinearGradient(pRA.sx, pRA.sy, pRB.sx, pRB.sy);
          coreGrd.addColorStop(0,   `rgba(255,215,0,${(0.55 + sim * 0.45).toFixed(3)})`);
          coreGrd.addColorStop(0.5, `rgba(255,255,255,${(0.40 + sim * 0.55).toFixed(3)})`);
          coreGrd.addColorStop(1,   `rgba(255,215,0,${(0.55 + sim * 0.45).toFixed(3)})`);
          ctx.strokeStyle = coreGrd;
          ctx.lineWidth   = (1.5 + sim * 4.0) * avgScale;
          ctx.shadowColor = `rgba(255,215,0,0.9)`;
          ctx.shadowBlur  = 4 + sim * 24;
          ctx.beginPath(); ctx.moveTo(pRA.sx, pRA.sy); ctx.lineTo(pRB.sx, pRB.sy); ctx.stroke();

          ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
          ctx.restore();
        }
      }

      // ── Prism geometry effects (inside-sphere chords, command-triggered) ────
      // Additive blending: overlapping spectral lines ACCUMULATE light → bloom cores
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      {
        // Precompute ID→index map once per frame — O(1) lookup inside effect loop
        const nodeIdx = {};
        for (let i = 0; i < nodes.length; i++) nodeIdx[nodes[i].id] = i;

        const live = [];
        const cx = w / 2, cy = h / 2;     // projected sphere center
        for (const eff of geomEffectsRef.current) {
          eff.life++;
          if (eff.life >= eff.maxLife) continue;
          live.push(eff);

          const t     = eff.life / eff.maxLife;
          // Smooth cubic alpha — fast in, hold, cubic out
          const alphaRaw = t < 0.1 ? t / 0.1 : t > 0.65 ? Math.pow(1 - (t - 0.65) / 0.35, 2) : 1.0;
          const alpha = alphaRaw * (eff.intensity ?? 1.0);
          // Hue smoothly fades from hueBase → hueTarget over the effect lifetime
          const dh = ((eff.hueTarget ?? eff.hueBase) - eff.hueBase + 540) % 360 - 180;
          const hue0 = (eff.hueBase + dh * t) % 360;

          // Project effect nodes using precomputed index map
          const effProj = eff.nodeIds.map(id => {
            const idx = nodeIdx[id];
            return idx != null ? proj[idx] : null;
          }).filter(Boolean);

          if (effProj.length < 2) continue;

          // Draw prismatic chord bundle between every pair
          // Coarse (mobile): 4 spectral lines × 6 nodes = 60 strokes/effect
          // Fine  (desktop): 7 spectral lines × 11 nodes = 385 strokes/effect
          const spectralN = eff.coarse ? 4 : 7;
          for (let a = 0; a < effProj.length; a++) {
            for (let b = a + 1; b < effProj.length; b++) {
              const pA = effProj[a], pB = effProj[b];

              for (let k = 0; k < spectralN; k++) {
                const hue  = (hue0 + k * 48) % 360;
                const lAlpha = alpha * 0.85 * (1 - k * 0.07);
                const offset = (k - 3) * 2.8;

                // Control point pulled toward sphere center — creates interior arc illusion
                const midX = (pA.sx + pB.sx) / 2;
                const midY = (pA.sy + pB.sy) / 2;
                const cpx  = midX + (cx - midX) * 0.55 + offset * 2;
                const cpy  = midY + (cy - midY) * 0.55 + offset * 1.4;

                // Wide glow pass
                ctx.strokeStyle = `hsla(${hue},100%,65%,${(lAlpha * 0.4).toFixed(3)})`;
                ctx.lineWidth   = 5 - k * 0.4;
                ctx.beginPath();
                ctx.moveTo(pA.sx + offset, pA.sy + offset * 0.6);
                ctx.quadraticCurveTo(cpx, cpy, pB.sx + offset, pB.sy + offset * 0.6);
                ctx.stroke();
                // Sharp core pass
                ctx.strokeStyle = `hsla(${hue},100%,88%,${lAlpha.toFixed(3)})`;
                ctx.lineWidth   = 1.2;
                ctx.beginPath();
                ctx.moveTo(pA.sx + offset, pA.sy + offset * 0.6);
                ctx.quadraticCurveTo(cpx, cpy, pB.sx + offset, pB.sy + offset * 0.6);
                ctx.stroke();
              }
            }
          }

          // Sacred polygon outline (cyclic ring) through effect nodes
          if (effProj.length >= 3) {
            const polyHue = (hue0 + 180) % 360;
            ctx.strokeStyle = `hsla(${polyHue},100%,88%,${(alpha * 0.72).toFixed(3)})`;
            ctx.lineWidth   = 1.6;
            ctx.beginPath();
            ctx.moveTo(effProj[0].sx, effProj[0].sy);
            for (let i = 1; i < effProj.length; i++) ctx.lineTo(effProj[i].sx, effProj[i].sy);
            ctx.closePath();
            ctx.stroke();
          }

          // Star spokes — lines from sphere center to each effect node
          for (const ep of effProj) {
            const spokeHue = (hue0 + Math.atan2(ep.sy - cy, ep.sx - cx) * (180 / Math.PI) + 360) % 360;
            ctx.strokeStyle = `hsla(${spokeHue},95%,82%,${(alpha * 0.52).toFixed(3)})`;
            ctx.lineWidth   = 0.5;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(ep.sx, ep.sy);
            ctx.stroke();
          }
        }
        geomEffectsRef.current = live;
      }
      ctx.restore();   // back to source-over for nodes

      // ── Nodes (depth-sorted, near drawn last = on top) ────────────────────
      const hov = hoveredRef.current;
      for (const i of sortedNodeIdx) {
        const n   = nodes[i];
        // Dynamic nodes (bifurcation children) fall back to dynColorMap
        const col = NODE_COLORS[n.id] ?? dynColorMap.get(n.id);
        if (!col) continue;   // no color registered yet → skip this frame

        // ── Birth animation: ease child from parent position over 400ms ──────
        // Uses cubic-bezier ease-out: 1 - (1-t)³ — matches CSS ease-out cubic
        let p = proj[i];
        const _birth = birthMapRef.current.get(n.id);
        if (_birth) {
          const _elapsed = performance.now() - _birth.t0;
          if (_elapsed >= 400) {
            birthMapRef.current.delete(n.id);
          } else {
            const _t    = _elapsed / 400;
            const _ease = 1 - Math.pow(1 - _t, 3);
            const [_prx, _pry, _prz] = applyM(M, _birth.px, _birth.py, _birth.pz);
            const _pp = project(_prx, _pry, _prz, w, h, sphereR, focal);
            p = {
              sx:    _pp.sx    + (proj[i].sx    - _pp.sx)    * _ease,
              sy:    _pp.sy    + (proj[i].sy    - _pp.sy)    * _ease,
              depth: _pp.depth + (proj[i].depth - _pp.depth) * _ease,
              scale: _pp.scale + (proj[i].scale - _pp.scale) * _ease,
            };
          }
        }

        const isHov     = n.id === hov;
        const energy    = n.energy + (isHov ? 0.55 : 0);
        // Depth cuing: nodes on the back are smaller + dimmer
        let depthAlpha = Math.max(0.08, (p.depth + 1) * 0.5);

        // ── Resonance dimming: non-selected nodes → 10% opacity ──────────────
        const _resNodes = resonanceNodesRef.current;
        const _resActive = resonanceModeRef.current && _resNodes.length > 0;
        const _isResNode = _resActive && _resNodes.includes(n.id);
        if (_resActive && !_isResNode) depthAlpha *= 0.10;

        const radius = (5 + energy * 4) * p.scale;

        // Overwrite bleed — temporarily radiate source color
        let renderCol = col;
        if (n.bleedAmount > 0 && n.bleedFrom) {
          const srcCol = NODE_COLORS[n.bleedFrom];
          if (srcCol) renderCol = lerpColor(col, srcCol, n.bleedAmount * 0.7);
        }

        // Spectral PCA tint — shift hue based on eigenvalue-to-wavelength mapping
        const _spc = getSpectralColor(i);
        if (_spc && renderCol.hue != null) {
          const flux = getSpectralFlux();
          const blend = 0.08 + flux * 0.15; // very subtle 8-23% spectral influence
          // Convert spectral [r,g,b,a] (0-1 floats) to approximate hue shift
          const _sr = _spc[0], _sg = _spc[1], _sb = _spc[2];
          const _sMax = Math.max(_sr, _sg, _sb), _sMin = Math.min(_sr, _sg, _sb);
          let _sHue = 0;
          if (_sMax > _sMin) {
            const _d = _sMax - _sMin;
            if (_sMax === _sr) _sHue = ((_sg - _sb) / _d + 6) % 6 * 60;
            else if (_sMax === _sg) _sHue = ((_sb - _sr) / _d + 2) * 60;
            else _sHue = ((_sr - _sg) / _d + 4) * 60;
          }
          renderCol = {
            hue: renderCol.hue + (_sHue - renderCol.hue) * blend,
            sat: renderCol.sat + ((_sMax - _sMin) / Math.max(_sMax, 0.001) * 100 - renderCol.sat) * blend * 0.3,
            lit: renderCol.lit,
            hsl: renderCol.hsl,
          };
        }

        // Glow halo
        if (energy > 0.08 || n.bleedAmount > 0) {
          const haloR = radius + (energy + n.bleedAmount * 0.4) * 16 * p.scale;
          const hGrd  = ctx.createRadialGradient(p.sx, p.sy, radius * 0.4, p.sx, p.sy, haloR);
          hGrd.addColorStop(0, hslAlpha(renderCol, (energy + n.bleedAmount * 0.25) * 0.38 * depthAlpha));
          hGrd.addColorStop(1, hslAlpha(renderCol, 0));
          ctx.fillStyle = hGrd;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, haloR, 0, Math.PI * 2);
          ctx.fill();
        }

        // Core sphere
        const coreAlpha = (0.45 + energy * 0.55) * depthAlpha;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = isHov ? renderCol.hsl : hslAlpha(renderCol, coreAlpha);
        ctx.fill();

        // ── Chimera state halo — phase-locked clusters glow in unison ──────
        {
          const _chim = getNodeChimeraState(i);
          if (_chim) {
            const _ct = performance.now() * 0.001;
            if (_chim.isSync) {
              // Synchronized: steady warm halo pulsing at cluster phase
              const syncPulse = 0.5 + 0.5 * Math.sin(_ct * 2 + _chim.meanPhase);
              const syncAlpha = _chim.orderParam * syncPulse * 0.18 * depthAlpha;
              if (syncAlpha > 0.01) {
                const syncR = radius + 6 * p.scale;
                ctx.beginPath();
                ctx.arc(p.sx, p.sy, syncR, 0, Math.PI * 2);
                ctx.strokeStyle = `hsla(45,90%,70%,${syncAlpha.toFixed(3)})`;
                ctx.lineWidth = 1.5 * p.scale;
                ctx.stroke();
              }
            } else if (_chim.isChimera) {
              // Chimera boundary: erratic flickering ring
              const flickRate = 5 + _chim.orderParam * 8;
              const flickAlpha = (0.15 + Math.sin(_ct * flickRate + i) * 0.12) * depthAlpha;
              if (flickAlpha > 0.01) {
                const chimR = radius + 8 * p.scale;
                const chimHue = (200 + Math.sin(_ct * 1.3 + i * 0.7) * 40) | 0;
                ctx.beginPath();
                ctx.arc(p.sx, p.sy, chimR, 0, Math.PI * 2);
                ctx.strokeStyle = `hsla(${chimHue},80%,60%,${flickAlpha.toFixed(3)})`;
                ctx.lineWidth = 1.0 * p.scale;
                ctx.setLineDash([3, 4]);
                ctx.stroke();
                ctx.setLineDash([]);
              }
            }
            // Async clusters: no extra ring (they're the "noise floor")
          }
        }

        // ── Ghost node (Gestalt completion) — materializing outline ─────────
        {
          const _ghosts = getGhostNodes();
          if (_ghosts && _ghosts[i] > 0.02) {
            const ghostAlpha = _ghosts[i] * depthAlpha;
            const ghostR = radius + 4 * p.scale + _ghosts[i] * 6 * p.scale;
            // Double ring: inner dashed (incomplete), outer solid (materializing)
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            // Inner ring: partial reconstruction
            ctx.beginPath();
            ctx.arc(p.sx, p.sy, ghostR, 0, Math.PI * 2 * _ghosts[i]);
            ctx.strokeStyle = `hsla(180,70%,75%,${(ghostAlpha * 0.5).toFixed(3)})`;
            ctx.lineWidth = 1.5 * p.scale;
            ctx.stroke();
            // Outer glow ring: completion halo
            ctx.beginPath();
            ctx.arc(p.sx, p.sy, ghostR + 3 * p.scale, 0, Math.PI * 2);
            ctx.strokeStyle = `hsla(180,60%,85%,${(ghostAlpha * 0.2).toFixed(3)})`;
            ctx.lineWidth = 3 * p.scale;
            ctx.stroke();
            ctx.restore();
          }
        }

        // ── Label rendering ────────────────────────────────────────────────
        // Three sources of label visibility, composited:
        //   1. Hover — always full brightness
        //   2. High energy — natural decay after fireNode
        //   3. Fired cascade — staggered fade-in/hold/fade-out for clicked
        //      node and its neighbors, with the seed node firing first
        const fired  = firedRef.current;
        const inFire = fired && fired.neighborIds.has(n.id);
        let fireAlpha = 0;
        if (inFire) {
          const elapsed = (performance.now() - fired.t0) / 1000;  // seconds
          const isSeed  = n.id === fired.seedId;
          // Stagger: seed appears instantly, neighbors delayed 80-200ms by index
          const delay   = isSeed ? 0 : 0.08 + (i % 5) * 0.025;
          const t       = elapsed - delay;
          // Envelope: 0→0.35s fade-in, 0.35→2.5s hold, 2.5→3.5s fade-out
          if (t < 0)          fireAlpha = 0;
          else if (t < 0.35)  fireAlpha = t / 0.35;                         // ease in
          else if (t < 2.5)   fireAlpha = 1.0;                              // hold
          else if (t < 3.5)   fireAlpha = 1.0 - (t - 2.5);                 // fade out
          else                { fireAlpha = 0; }
          // Seed gets full brightness; neighbors get node color tint
          fireAlpha *= (isSeed ? 0.95 : 0.80) * depthAlpha;
          // Clear ref when all labels have faded
          if (elapsed > 3.8) firedRef.current = null;
        }

        const showHover  = isHov;
        const showEnergy = n.energy > 0.45 && p.depth > -0.1;
        const showFire   = fireAlpha > 0.01;

        if (showHover || showEnergy || showFire) {
          // Pick highest alpha source
          const hoverA  = showHover  ? 0.92 : 0;
          const energyA = showEnergy ? n.energy * 0.80 * depthAlpha : 0;
          const la      = Math.max(hoverA, energyA, fireAlpha);

          const isSeed  = fired && n.id === fired.seedId;
          const fontSize = Math.round(
            ((showHover || isSeed) ? 10 : showFire ? 9 : 8) * p.scale
          );

          ctx.textAlign = 'center';
          // Always render labels in the node's own cluster color
          ctx.fillStyle = hslAlpha(renderCol, la * (showHover ? 1.0 : 0.82));
          ctx.font = `bold ${fontSize}px monospace`;
          ctx.fillText(n.label, p.sx, p.sy - radius - 4);
        }
      }

      // ── Manual fusion: pending targeting line + source pulse ring ─────────
      const fSrc = fusionSourceRef.current;
      if (fSrc) {
        const si = NODE_IDX[fSrc];
        if (si != null) {
          const sp    = proj[si];
          const t     = performance.now() / 1000;
          const pulse = 0.5 + 0.5 * Math.sin(t * 5);
          const srcCol = NODE_COLORS[fSrc];
          const ringR  = (5 + nodes[si].energy * 4 + 8 + pulse * 6) * sp.scale;
          // Pulsing dashed ring around locked source
          ctx.save();
          ctx.strokeStyle = hslAlpha(srcCol, 0.55 + pulse * 0.45);
          ctx.lineWidth   = 1.5 * sp.scale;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.arc(sp.sx, sp.sy, ringR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
          // Dashed targeting thread to cursor
          const cur = fusionCursorRef.current;
          if (cur) {
            ctx.save();
            ctx.strokeStyle = hslAlpha(srcCol, 0.3 + pulse * 0.15);
            ctx.lineWidth   = 1;
            ctx.setLineDash([3, 6]);
            ctx.beginPath();
            ctx.moveTo(sp.sx, sp.sy);
            ctx.lineTo(cur.x, cur.y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
          }
        }
      }

      // ── Probe node (text_probe.rs concept injection) ───────────────────────
      // Rendered after all sphere nodes so it draws on top.
      const probe = probeNodeRef.current;
      if (probe?.similarities?.length) {
        const top = probe.similarities.slice(0, 4);
        // Weighted centroid of top matches in physics node positions
        let wx = 0, wy = 0, wz = 0, wsum = 0;
        for (const { id, sim } of top) {
          const ni = nodes.findIndex(n => n.id === id);
          if (ni < 0) continue;
          wx += nodes[ni].x * sim;
          wy += nodes[ni].y * sim;
          wz += nodes[ni].z * sim;
          wsum += sim;
        }
        if (wsum > 1e-12) {
          wx /= wsum; wy /= wsum; wz /= wsum;
          const len = Math.sqrt(wx * wx + wy * wy + wz * wz);
          if (len > 1e-12) { wx /= len; wy /= len; wz /= len; }
          const [prx, pry, prz] = applyM(M, wx, wy, wz);
          const pp = project(prx, pry, prz, w, h, sphereR, focal);
          const depthAlpha = Math.max(0.12, (prz + 1) * 0.5);
          // Tether lines to top 3 matches
          ctx.setLineDash([3, 5]);
          for (const { id, sim } of top.slice(0, 3)) {
            const ni = nodes.findIndex(n => n.id === id);
            if (ni < 0) continue;
            const pn = proj[ni];
            ctx.lineWidth = 0.9;
            ctx.strokeStyle = `rgba(167,139,250,${sim * 0.55 * depthAlpha})`;
            ctx.beginPath();
            ctx.moveTo(pp.sx, pp.sy);
            ctx.lineTo(pn.sx, pn.sy);
            ctx.stroke();
          }
          ctx.setLineDash([]);
          // Pulsing glow halo
          const pulse = (Math.sin(Date.now() * 0.003) + 1) * 0.5;
          const probeR = 6 * pp.scale;
          const glowR  = probeR + pulse * 14 * pp.scale;
          const gGrd = ctx.createRadialGradient(pp.sx, pp.sy, probeR * 0.3, pp.sx, pp.sy, glowR);
          gGrd.addColorStop(0, `rgba(167,139,250,${0.45 * depthAlpha})`);
          gGrd.addColorStop(1, 'rgba(167,139,250,0)');
          ctx.fillStyle = gGrd;
          ctx.beginPath();
          ctx.arc(pp.sx, pp.sy, glowR, 0, Math.PI * 2);
          ctx.fill();
          // Core node
          ctx.beginPath();
          ctx.arc(pp.sx, pp.sy, probeR, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(196,181,253,${(0.75 + pulse * 0.25) * depthAlpha})`;
          ctx.fill();
          // Label
          const shortQ = probe.query.length > 22 ? probe.query.slice(0, 20) + '…' : probe.query;
          ctx.textAlign = 'center';
          ctx.font = `bold ${Math.round(9 * pp.scale)}px monospace`;
          ctx.fillStyle = `rgba(221,214,254,${0.88 * depthAlpha})`;
          ctx.fillText(`⊕ ${shortQ}`, pp.sx, pp.sy - probeR - 5);
        }
      }

      // ── Idle ambient particle emission (~2 per frame) ────────────────────
      if (pFrame % 3 === 0) emitIdleParticles(pool, nodes);
      if (pFrame % 7 === 0) emitIdleParticles(pool, nodes);

      // ── Particle render — additive, smooth sin fade, radial glow ─────────
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let pi = 0; pi < MAX_PARTICLES; pi++) {
        if (pool.lifes[pi] >= pool.maxLifes[pi] || pool.maxLifes[pi] === 0) continue;
        const lifeT = pool.lifes[pi] / pool.maxLifes[pi];
        // Smooth cubic fade: ramp in over first 15%, hold, ramp out last 30%
        let alpha;
        if (lifeT < 0.15) {
          alpha = (lifeT / 0.15) * (lifeT / 0.15); // quadratic ease-in
        } else if (lifeT > 0.70) {
          alpha = Math.pow(1 - (lifeT - 0.70) / 0.30, 2.2); // power ease-out
        } else {
          alpha = 1.0;
        }
        alpha *= 0.55;
        if (alpha < 0.004) continue;

        const [prx, pry, prz] = applyM(M, pool.xs[pi], pool.ys[pi], pool.zs[pi]);
        const pp = project(prx, pry, prz, w, h, sphereR, focal);
        if (pp.depth < -0.6) continue; // cull deep back-face

        const sz   = Math.max(0.4, pool.sizes[pi] * pp.scale);
        const hue  = pool.hues[pi];
        const sat  = pool.sats[pi];

        // Soft radial glow — two concentric draws
        const glowR = sz * 3.5;
        const gGrd = ctx.createRadialGradient(pp.sx, pp.sy, 0, pp.sx, pp.sy, glowR);
        gGrd.addColorStop(0,   `hsla(${hue|0},${sat|0}%,82%,${alpha.toFixed(3)})`);
        gGrd.addColorStop(0.4, `hsla(${hue|0},${sat|0}%,65%,${(alpha*0.5).toFixed(3)})`);
        gGrd.addColorStop(1,   `hsla(${hue|0},${sat|0}%,50%,0)`);
        ctx.fillStyle = gGrd;
        ctx.beginPath();
        ctx.arc(pp.sx, pp.sy, glowR, 0, Math.PI * 2);
        ctx.fill();

        // Hard core
        ctx.fillStyle = `hsla(${hue|0},${sat|0}%,92%,${(alpha * 0.8).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(pp.sx, pp.sy, sz, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // ── Immersive Mode: bloom post-process + vignette ─────────────────────
      if (immersiveRef.current) {
        // Bloom: draw blurred copy with additive blend
        let bloomCvs = bloomCanvasRef.current;
        if (!bloomCvs) {
          bloomCvs = document.createElement('canvas');
          bloomCanvasRef.current = bloomCvs;
        }
        // Bloom at half resolution for performance
        const bw = Math.floor(w / 2), bh = Math.floor(h / 2);
        if (bloomCvs.width !== bw || bloomCvs.height !== bh) {
          bloomCvs.width = bw; bloomCvs.height = bh;
        }
        const bCtx = bloomCvs.getContext('2d');
        bCtx.clearRect(0, 0, bw, bh);
        bCtx.filter = 'blur(12px) brightness(1.2)';
        bCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, bw, bh);
        bCtx.filter = 'none';

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.15;
        ctx.drawImage(bloomCvs, 0, 0, bw, bh, 0, 0, w, h);
        ctx.globalAlpha = 1;
        ctx.restore();

        // Cinematic vignette
        const vigGrd = ctx.createRadialGradient(w / 2, h / 2, sphereR * 0.6, w / 2, h / 2, Math.max(w, h) * 0.7);
        vigGrd.addColorStop(0, 'rgba(0,0,0,0)');
        vigGrd.addColorStop(1, 'rgba(0,0,0,0.65)');
        ctx.fillStyle = vigGrd;
        ctx.fillRect(0, 0, w, h);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [initState, stepGraph, stepEdges]);

  // ── Hit-test (in projected space) ────────────────────────────────────────
  const getProjected = useCallback(() => {
    const s = stateRef.current;
    if (!s) return [];
    const { nodes } = s;
    const { w, h } = dimsRef.current;
    const sphereR  = Math.min(w, h) * SPHERE_K;
    const focal    = sphereR * FOCAL_K;
    const M        = buildRotMatrix(rotRef.current.rx, rotRef.current.ry);
    return nodes.map(n => {
      const [rx, ry, rz] = applyM(M, n.x, n.y, n.z);
      return { node: n, ...project(rx, ry, rz, w, h, sphereR, focal) };
    });
  }, [stateRef, dimsRef]);

  const canvasCoords = useCallback((clientX, clientY) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const nodeAt = useCallback((cx, cy) => {
    const projected = getProjected();
    // Sort by depth desc so we hit nearest node first
    const sorted = [...projected].sort((a, b) => b.depth - a.depth);
    for (const { node, sx, sy, depth, scale } of sorted) {
      if (depth < -0.85) continue;  // skip deeply back-face nodes
      // Forgiving hitbox: 3× visual radius — invisible bubble around each node
      // so users don't need pixel-perfect aim on a spinning sphere
      const visualR = (5 + node.energy * 4) * scale;
      const r  = visualR * 3 + 10;
      const dx = sx - cx, dy = sy - cy;
      if (dx * dx + dy * dy < r * r) return node;
    }
    return null;
  }, [getProjected]);

  // ── Edge hit-test: find nearest edge within ~8px of cursor ──────────────
  // Returns full 16D analysis payload for any edge (not just spectral bridges)
  const edgeAt = useCallback((cx, cy) => {
    const projected = getProjected();
    const es = edgeStateRef.current;
    if (!es) return null;
    const simMap = bridgeSimilarityRef.current;
    let bestDist = 8;   // max distance in screen px
    let bestEdge = null;
    for (const e of es) {
      const iA = projected.findIndex(p => p.node.id === e.aId);
      const iB = projected.findIndex(p => p.node.id === e.bId);
      if (iA < 0 || iB < 0) continue;
      const pA = projected[iA], pB = projected[iB];
      if (pA.depth < -0.7 && pB.depth < -0.7) continue;
      const dx = pB.sx - pA.sx, dy = pB.sy - pA.sy;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1) continue;
      const t = Math.max(0, Math.min(1, ((cx - pA.sx) * dx + (cy - pA.sy) * dy) / len2));
      const px = pA.sx + t * dx, py = pA.sy + t * dy;
      const dist = Math.sqrt((cx - px) ** 2 + (cy - py) ** 2);
      if (dist < bestDist) {
        bestDist = dist;
        // Full 16D analysis — computed for every edge, not just spectral bridges
        const analysis = analyzeEdge(e.aId, e.bId);
        const edgeKey = e.aId < e.bId ? `${e.aId}:${e.bId}` : `${e.bId}:${e.aId}`;
        const isSpectralBridge = simMap ? edgeKey in simMap : false;
        bestEdge = {
          aId: e.aId,
          bId: e.bId,
          cosSim: analysis?.sim ?? 0,
          drivers: analysis?.drivers ?? [],
          isSpectralBridge,
        };
      }
    }
    return bestEdge;
  }, [getProjected]);

  // ── Mouse/touch handlers (ref-mutating — no React re-renders) ────────────
  const handleMouseDown = useCallback((e) => {
    dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY, vx: 0, vy: 0 };
  }, []);

  const handleMouseMove = useCallback((e) => {
    const drag = dragRef.current;
    if (drag.active) {
      const dx = e.clientX - drag.lastX;
      const dy = e.clientY - drag.lastY;
      drag.vx = dy * 0.005;  // drag X → rotX
      drag.vy = dx * 0.005;  // drag Y → rotY
      rotRef.current.rx += drag.vx;
      rotRef.current.ry += drag.vy;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
    }
    // Hover hit-test — nodes take priority, then edges (debounced)
    const p = canvasCoords(e.clientX, e.clientY);
    if (p) {
      // Track cursor for manual fusion targeting line
      if (fusionSourceRef.current) fusionCursorRef.current = p;
      const node = nodeAt(p.x, p.y);
      hoveredRef.current = node?.id ?? null;
      if (node) {
        clearTimeout(edgeDebounceRef.current);
        if (!lockedEdge) setHoveredEdge(null);
        if (canvasRef.current) canvasRef.current.style.cursor = 'pointer';
        // Tooltip: debounce 130ms so it doesn't flash on a spinning sphere
        clearTimeout(tooltipTimerRef.current);
        tooltipTimerRef.current = setTimeout(() => {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect) return;
          const ni = NODE_IDX[node.id];
          const feat = ni != null ? FEATURES[ni] : null;
          const topDims = feat
            ? DIM_NAMES.map((nm, i) => ({ name: nm, v: feat[i] }))
                .sort((a, b) => b.v - a.v).slice(0, 3)
            : [];
          setHoveredTooltip({ id: node.id, label: node.label, cluster: node.cluster, topDims });
          setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }, 130);
      } else {
        clearTimeout(tooltipTimerRef.current);
        setHoveredTooltip(null);
        // Debounce edge hover: only show after 80ms of sustained proximity,
        // and hold for 300ms after losing contact (spinning sphere shifts edges)
        const edge = !drag.active ? edgeAt(p.x, p.y) : null;
        clearTimeout(edgeDebounceRef.current);
        if (edge) {
          edgeDebounceRef.current = setTimeout(() => setHoveredEdge(edge), 80);
        } else if (!lockedEdge) {
          edgeDebounceRef.current = setTimeout(() => setHoveredEdge(null), 300);
        }
        if (canvasRef.current) canvasRef.current.style.cursor = edge ? 'crosshair' : drag.active ? 'grabbing' : 'grab';
      }
    }
  }, [canvasCoords, nodeAt, edgeAt, lockedEdge]);

  const handleMouseUp = useCallback((e) => {
    dragRef.current.active = false;
    // Check if this was a click (not a drag)
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4) {
      const p    = canvasCoords(e.clientX, e.clientY);
      if (!p) return;
      const node = nodeAt(p.x, p.y);
      if (!node) {
        // No node hit — check for edge click to lock/unlock readout
        const edge = edgeAt(p.x, p.y);
        if (edge) {
          setLockedEdge(edge);
          setHoveredEdge(edge);
          setSelectedNode(null);
          setLockedOrtho(null);
        } else {
          setLockedEdge(null);
          setHoveredEdge(null);
          setSelectedNode(null);
          setLockedOrtho(null);
        }
        return;
      }
      if (e.button !== 2) {
        // ── Resonance Mode: Shift-Click selects up to 2 nodes for comparison ──
        if (e.shiftKey && resonanceModeRef.current) {
          const cur = resonanceNodesRef.current;
          // Toggle: clicking a selected node deselects it; otherwise replace oldest
          const next = cur.includes(node.id)
            ? cur.filter(id => id !== node.id)
            : [...cur.slice(-1), node.id];   // keep last + add new (FIFO pair)
          resonanceNodesRef.current = next;
          setResonanceNodes(next);
          if (next.length === 2) {
            const result = compareNodes(next[0], next[1]);
            resonanceResultRef.current = result;
            setResonanceResult(result);
            ensureAudio(); somaAudio.playResonance(result?.sim ?? 0.5);
          } else {
            resonanceResultRef.current = null;
            setResonanceResult(null);
          }
          return;   // don't fire normal click in resonance mode
        }

        // Right-click is handled by contextmenu (fusion state machine) — ignore here
        fireNode(node.id);
        // Perturb Hopfield field — genuine associative activation propagation
        const nodeIdx_ = NODE_IDX[node.id];
        if (nodeIdx_ != null) perturbField(nodeIdx_);
        ensureAudio(); somaAudio.playNode(node.id);
        // Broadcast to peers
        if (somaPresence.connected) somaPresence.sendFire(node.id);
        spawnEffect(node.id, { soft: true, rightClick: false });   // left-click → cluster hue burst
        // Label cascade — record seed + neighbors for the draw loop
        const nbs = new Set(ADJ[node.id] ?? []);
        nbs.add(node.id);
        firedRef.current = { seedId: node.id, neighborIds: nbs, t0: performance.now() };
        const nodeIdx = NODES.findIndex(n => n.id === node.id);
        if (onCueNode && nodeIdx >= 0) onCueNode(nodeIdx);
        // Show 16D analysis for this node's edges in the readout panel
        setSelectedNode(node.id);
        setLockedEdge(null);
      }
    }
  }, [canvasCoords, nodeAt, edgeAt, fireNode, spawnEffect, onCueNode, onRunKernel]);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    const p    = canvasCoords(e.clientX, e.clientY);
    if (!p) return;
    const node = nodeAt(p.x, p.y);
    if (!node || !onOrthogonalBridge) return;

    // Build the current active edge set so the search excludes existing connections
    const edgeSet = new Set(activeEdges.map(([a, b]) => a < b ? `${a}:${b}` : `${b}:${a}`));

    // Single-step: immediately find the most orthogonal node and forge the link
    const result = findOrthogonalNode(node.id, edgeSet);
    if (result) {
      onOrthogonalBridge(node.id, result);
      bgFlashRef.current = 0.7; // orthogonal bridge → brief void flash
      spawnEffect(node.id, { soft: false, rightClick: true });  // right-click → complementary hue burst
    }
  }, [canvasCoords, nodeAt, onOrthogonalBridge, activeEdges, spawnEffect]);

  const handleMouseLeave = useCallback(() => {
    dragRef.current.active = false;
    hoveredRef.current = null;
    clearTimeout(edgeDebounceRef.current);
    clearTimeout(tooltipTimerRef.current);
    setHoveredTooltip(null);
    setHoveredEdge(null);
    setLockedEdge(null);
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
  }, []);

  const handleTouchStart = useCallback((e) => {
    const t = e.touches[0];
    if (!t) return;
    dragRef.current = { active: true, lastX: t.clientX, lastY: t.clientY, vx: 0, vy: 0 };
    // Long-press (500ms) → manual fusion step
    const p = canvasCoords(t.clientX, t.clientY);
    if (p) {
      const node = nodeAt(p.x, p.y);
      if (node) {
        longPressRef.current = setTimeout(() => {
          if (navigator.vibrate) navigator.vibrate(40);
          if (!fusionSourceRef.current) {
            setFusionSource(node.id);
            fusionCursorRef.current = p;
          } else if (node.id !== fusionSourceRef.current) {
            const analysis = analyzeEdge(fusionSourceRef.current, node.id);
            if (analysis) onManualFusion?.(fusionSourceRef.current, node.id, analysis);
            setFusionSource(null);
            fusionCursorRef.current = null;
          } else {
            setFusionSource(null);
          }
        }, 500);
      }
    }
  }, [canvasCoords, nodeAt, onManualFusion]);

  const handleTouchMove = useCallback((e) => {
    clearTimeout(longPressRef.current);
    e.preventDefault();
    const t    = e.touches[0];
    const drag = dragRef.current;
    if (!t || !drag.active) return;
    const dx = t.clientX - drag.lastX;
    const dy = t.clientY - drag.lastY;
    rotRef.current.rx += dy * 0.005;
    rotRef.current.ry += dx * 0.005;
    drag.vx     = dy * 0.005;
    drag.vy     = dx * 0.005;
    drag.lastX  = t.clientX;
    drag.lastY  = t.clientY;
  }, []);

  const handleTouchEnd = useCallback((e) => {
    clearTimeout(longPressRef.current);
    dragRef.current.active = false;
    const t = e.changedTouches[0];
    if (!t) return;
    const p    = canvasCoords(t.clientX, t.clientY);
    if (!p) return;
    const node = nodeAt(p.x, p.y);
    if (!node) return;
    fireNode(node.id);
    // Perturb Hopfield field from touch
    const _touchIdx = NODE_IDX[node.id];
    if (_touchIdx != null) perturbField(_touchIdx);
    ensureAudio(); somaAudio.playNode(node.id);
    if (somaPresence.connected) somaPresence.sendFire(node.id);
    spawnEffect(node.id, { soft: true });
    // Label cascade — record seed + neighbors for the draw loop
    const nbs = new Set(ADJ[node.id] ?? []);
    nbs.add(node.id);
    firedRef.current = { seedId: node.id, neighborIds: nbs, t0: performance.now() };
    const nodeIdx = NODES.findIndex(n => n.id === node.id);
    if (onCueNode && nodeIdx >= 0) onCueNode(nodeIdx);
    setSelectedNode(node.id);
    setLockedEdge(null);
  }, [canvasCoords, nodeAt, fireNode, spawnEffect, onCueNode, ensureAudio, perturbField]);

  // ── CSS vars for DOM elements outside canvas ──────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !associativeField) return;
    associativeField.co?.forEach(idx => {
      const node = NODES[idx];
      if (!node) return;
      el.style.setProperty(`--node-color-${node.id}`, NODE_COLORS[node.id].hsl);
    });
  }, [associativeField]);

  // ── Phase transition callback — drives topology + audio ─────────────────
  useEffect(() => {
    onPhaseTransition.current = (event) => {
      setPhaseRegime(event.to);
      setPhaseR(event.r);
      setPhaseLyap(event.lyapunov);
      // State-driven flash — the void acknowledges the transition
      bgFlashRef.current = event.to === 'CHAOS' ? 1.0 : 0.6;
      // Sonify phase transitions
      if (audioInitRef.current) {
        somaAudio.playBifurcation(event.to === 'CHAOS' ? 6 : event.to === 'PERIOD_8' ? 4 : 2);
      }
      // Broadcast to peers
      if (somaPresence.connected) {
        somaPresence.sendPhase(event.to, event.r, event.lyapunov);
      }
    };
  }, [onPhaseTransition]);

  // ── Eco data feed — modulate features from live environmental data ─────
  useEffect(() => {
    ecoDataFeed.startPolling(300000); // poll every 5 min
    ecoDataFeed.fetchLatest().then(() => {
      const mod = ecoDataFeed.getModulations();
      ecoModRef.current.set(mod);
    }).catch(() => {});
    const interval = setInterval(() => {
      const mod = ecoDataFeed.getModulations();
      ecoModRef.current.set(mod);
    }, 60000); // refresh modulations every minute
    return () => { ecoDataFeed.stopPolling(); clearInterval(interval); };
  }, []);

  // ── Presence — peer count updater ─────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (somaPresence.connected) setPeerCount(somaPresence.peerCount);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // ── Immersive Mode keyboard handler ('I' key toggle) ───────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'i' || e.key === 'I') {
        setImmersive(prev => {
          const next = !prev;
          immersiveRef.current = next;
          return next;
        });
      }
      // 'M' toggles audio mute
      if (e.key === 'm' || e.key === 'M') {
        if (!audioInitRef.current) { somaAudio.init(); audioInitRef.current = true; }
        const muted = somaAudio.toggleMute();
        setAudioMuted(muted);
      }
      // 'R' toggles temporal recording
      if (e.key === 'r' || e.key === 'R') {
        const wasRecording = tmIsRecording.current;
        tmIsRecording.current = !wasRecording;
        setRecording(!wasRecording);
        if (!wasRecording) somaAudio.startRecording?.();
        else somaAudio.stopRecording?.();
      }
      // 'T' toggles timeline playback
      if (e.key === 't' || e.key === 'T') {
        togglePlayback();
        setPlayback(tmIsPlayback.current);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

      <style>{`
        @keyframes at-feigSpark {
          0%   { transform: scale(1); filter: brightness(1); }
          15%  { transform: scale(1.025); filter: brightness(3); }
          40%  { transform: scale(1.01); filter: brightness(1.6); }
          100% { transform: scale(1); filter: brightness(1); }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-amber-900/40 pb-4 mb-6">
        <div>
          <h2
            className="text-2xl md:text-4xl font-bold mb-1 tracking-tight flex items-center gap-3 cursor-pointer select-none"
            onClick={() => {
              const el = feigTitleRef.current;
              if (!el) return;
              el.style.animation = 'none';
              void el.offsetWidth;
              el.style.animation = 'at-feigSpark 0.5s cubic-bezier(0.16,1,0.3,1) forwards';
              setTimeout(() => { if (el) el.style.animation = ''; }, 550);
            }}
            ref={feigTitleRef}
          >
            {/* Wrap SVG in span so filter renders on WebKit/Safari */}
            <span
              className="shrink-0"
              style={{
                display: 'inline-flex',
                filter: selectedNode === 'feigenbaum'
                  ? 'drop-shadow(0 0 8px rgba(255,215,0,0.85)) drop-shadow(0 0 3px rgba(255,215,0,1))'
                  : 'drop-shadow(0 0 8px rgba(255,140,0,0.7)) drop-shadow(0 0 16px rgba(217,70,239,0.4))',
                transition: 'filter 0.4s ease',
              }}
            >
              <Waves
                className="w-6 h-6 md:w-8 md:h-8"
                style={{
                  color: selectedNode === 'feigenbaum' ? '#FFD700' : '#FF8C00',
                  transition: 'color 0.4s ease',
                }}
              />
            </span>
            {/* Title: gradient clip + separate glow layer underneath for Safari compat */}
            <span style={{ position: 'relative', display: 'inline-block' }}>
              {/* Glow layer — blurred duplicate, not clip-text, so Safari shows it */}
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  color: selectedNode === 'feigenbaum' ? '#FFD700' : '#FF8C00',
                  filter: selectedNode === 'feigenbaum'
                    ? 'blur(8px) opacity(0.9)'
                    : 'blur(10px) opacity(0.7)',
                  transition: 'color 0.4s ease, filter 0.4s ease',
                  userSelect: 'none',
                  pointerEvents: 'none',
                  fontWeight: 'inherit',
                  fontSize: 'inherit',
                  letterSpacing: 'inherit',
                }}
              >feigenbaum_fade</span>
              {/* Visible gradient text — -webkit-background-clip for Safari */}
              <span
                style={{
                  backgroundImage: selectedNode === 'feigenbaum'
                    ? 'linear-gradient(90deg, #FFD700, #fff700, #FFD700)'
                    : 'linear-gradient(90deg, #FF8C00, #FFD700, #d946ef, #FFD700, #FF8C00)',
                  backgroundSize: '200% auto',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  color: 'transparent',
                  transition: 'background-image 0.4s ease',
                }}
              >feigenbaum_fade</span>
            </span>
          </h2>
          <div className="text-sm font-bold tracking-widest" style={{ color: 'rgba(251,191,36,0.5)' }}>
            orbital sphere // ars electronica 2027 // soma-9.4
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3 md:mt-0 text-xs font-bold font-mono tracking-widest">
          <span className="border border-amber-900/40 px-3 py-1 rounded-sm" style={{ color: 'rgba(251,191,36,0.5)' }}>
            {NODES.length + bifurcCount} nodes · {activeEdges.length} edges
            {spectralBridges ? ` · spectral` : ''}
            {boneFusions ? ` · fused` : ''}
            {orthogonalBridges.length ? ` · ⊥ ${orthogonalBridges.length} orthogonal` : ''}
            {probeNode ? ` · ⊕ probe` : ''}
            {bifurcCount > 0 ? ` · ⌥ +${bifurcCount} children` : ''}
            {` · ${phaseRegime}`}
            {analogyCount > 0 ? ` · ≅ ${analogyCount} analogies` : ''}
            {chimeraActive ? ` · ⊘ chimera` : ''}
            {gestaltQuality > 0.5 ? ` · ◌ gestalt ${(gestaltQuality * 100)|0}%` : ''}
          </span>
          <span className="border border-cyan-900/30 px-3 py-1 rounded-sm text-cyan-400/50">
            drag · click → attractor · shift-click → ◈ resonance · right-click → ⊥
          </span>
          {/* Resonance Mode toggle */}
          <button
            onClick={() => {
              const next = !resonanceMode;
              setResonanceMode(next);
              resonanceModeRef.current = next;
              if (!next) {
                setResonanceNodes([]);   resonanceNodesRef.current  = [];
                setResonanceResult(null); resonanceResultRef.current = null;
              }
            }}
            className="px-3 py-1 rounded-sm border transition-all duration-200"
            style={{
              borderColor: resonanceMode ? 'rgba(255,215,0,0.6)' : 'rgba(255,215,0,0.2)',
              color:       resonanceMode ? 'rgba(255,215,0,0.95)' : 'rgba(255,215,0,0.4)',
              background:  resonanceMode ? 'rgba(255,215,0,0.08)' : 'transparent',
              textShadow:  resonanceMode ? '0 0 8px rgba(255,215,0,0.6)' : 'none',
            }}
          >
            ◈ resonance{resonanceMode ? ` [${resonanceNodes.length}/2]` : ''}
          </button>
          {/* Period-Doubling bifurcation trigger */}
          <button
            onClick={handleBifurcate}
            className="px-3 py-1 rounded-sm border border-fuchsia-900/40 text-fuchsia-400/50 hover:border-fuchsia-500/60 hover:text-fuchsia-300/80 transition-all duration-200"
            title="Bifurcate top 15% most-connected nodes (Period-Doubling)"
          >
            ⌥ bifurcate
          </button>
          {/* Audio toggle */}
          <button
            onClick={() => { ensureAudio(); const m = somaAudio.toggleMute(); setAudioMuted(m); }}
            className="px-2 py-1 rounded-sm border border-amber-900/30 text-amber-400/40 hover:border-amber-500/50 hover:text-amber-300/70 transition-all duration-200"
            title="Toggle sonification (M)"
          >
            {audioMuted
              ? <VolumeX className="w-3.5 h-3.5 inline" />
              : <Volume2 className="w-3.5 h-3.5 inline" />}
          </button>
          {/* Immersive mode toggle */}
          <button
            onClick={() => { setImmersive(p => { const n = !p; immersiveRef.current = n; return n; }); }}
            className="px-2 py-1 rounded-sm border border-amber-900/30 text-amber-400/40 hover:border-amber-500/50 hover:text-amber-300/70 transition-all duration-200"
            title="Immersive mode — bloom + vignette (I)"
          >
            {immersive
              ? <Minimize className="w-3.5 h-3.5 inline" />
              : <Maximize className="w-3.5 h-3.5 inline" />}
          </button>
          {/* Recording toggle */}
          <button
            onClick={() => {
              const wasRec = tmIsRecording.current;
              tmIsRecording.current = !wasRec;
              setRecording(!wasRec);
              if (!wasRec) somaAudio.startRecording?.();
              else somaAudio.stopRecording?.();
            }}
            className="px-2 py-1 rounded-sm border transition-all duration-200"
            style={{
              borderColor: recording ? 'rgba(239,68,68,0.6)' : 'rgba(255,140,0,0.2)',
              color: recording ? 'rgba(239,68,68,0.9)' : 'rgba(255,140,0,0.4)',
              background: recording ? 'rgba(239,68,68,0.08)' : 'transparent',
            }}
            title="Record timeline (R)"
          >
            <Circle className="w-3 h-3 inline" style={recording ? { fill: 'currentColor' } : {}} />
          </button>
          {/* Timeline playback toggle */}
          <button
            onClick={() => { togglePlayback(); setPlayback(tmIsPlayback.current); }}
            className="px-2 py-1 rounded-sm border border-amber-900/30 text-amber-400/40 hover:border-amber-500/50 hover:text-amber-300/70 transition-all duration-200"
            title="Timeline playback (T)"
          >
            <Clock className="w-3.5 h-3.5 inline" />
          </button>
          {/* MIDI export */}
          <button
            onClick={() => {
              const midi = somaAudio.exportMIDI?.();
              if (!midi) return;
              const blob = new Blob([midi], { type: 'audio/midi' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `soma-score-${Date.now()}.mid`;
              a.click(); URL.revokeObjectURL(url);
            }}
            className="px-2 py-1 rounded-sm border border-amber-900/30 text-amber-400/40 hover:border-amber-500/50 hover:text-amber-300/70 transition-all duration-200"
            title="Export MIDI score"
          >
            <Download className="w-3.5 h-3.5 inline" />
          </button>
          {/* Peer count indicator */}
          {peerCount > 0 && (
            <span className="px-2 py-1 rounded-sm border border-cyan-900/30 text-cyan-400/50 text-[10px]">
              <Wifi className="w-3 h-3 inline mr-1" />{peerCount}
            </span>
          )}
        </div>
      </div>

      {/* Sphere canvas — frameless, front and center */}
      <div
        ref={containerRef}
        className={`w-full overflow-hidden${immersive ? ' fixed inset-0 z-50' : ''}`}
        style={{ background: '#000', position: immersive ? 'fixed' : 'relative' }}
      >
        <canvas
          ref={canvasRef}
          width={900}
          height={620}
          style={{ display: 'block', width: '100%', height: 'auto', cursor: 'grab' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />

        {/* ── Node hover tooltip ───────────────────────────────────────────── */}
        {hoveredTooltip && (
          <div
            style={{
              position:    'absolute',
              left:        Math.min(tooltipPos.x + 14, (dimsRef.current.w || 600) - 160),
              top:         Math.max(tooltipPos.y - 14, 8),
              pointerEvents: 'none',
              zIndex:      20,
              background:  'rgba(0,0,0,0.90)',
              border:      '1px solid rgba(255,215,0,0.20)',
              borderRadius: '3px',
              padding:     '6px 10px',
              fontFamily:  'monospace',
              fontSize:    '9px',
              lineHeight:  '1.65',
              letterSpacing: '0.04em',
              color:       'rgba(255,255,255,0.65)',
              whiteSpace:  'nowrap',
            }}
          >
            <div style={{ color: NODE_COLORS[hoveredTooltip.id]?.hsl ?? 'rgba(255,215,0,0.9)', fontWeight: 700, fontSize: '10px' }}>
              {hoveredTooltip.label.toUpperCase()}
            </div>
            <div style={{ color: CLUSTER_COLORS[hoveredTooltip.cluster]?.hsl ?? 'rgba(255,255,255,0.35)', fontSize: '8px', marginBottom: '3px' }}>
              {CLUSTERS[hoveredTooltip.cluster]?.label ?? hoveredTooltip.cluster}
            </div>
            {hoveredTooltip.topDims.map(d => (
              <div key={d.name}>
                <span style={{ color: 'rgba(255,215,0,0.45)', display: 'inline-block', minWidth: '100px' }}>{d.name}</span>
                <span style={{ color: 'rgba(255,255,255,0.85)' }}>{d.v.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Geometry terminal — hidden on touch/mobile (tap nodes directly instead) */}
        <form
          onSubmit={handleTermSubmit}
          className="hidden md:flex items-center"
          style={{
            borderTop:  '1px solid rgba(255,140,0,0.08)',
            padding:    '7px 14px',
            gap:        '10px',
            background: 'rgba(0,0,0,0.55)',
          }}
        >
          <span style={{
            color:      'rgba(255,215,0,0.35)',
            fontFamily: 'monospace',
            fontSize:   '10px',
            letterSpacing: '0.1em',
            whiteSpace: 'nowrap',
            minWidth:   '90px',
          }}>
            {lastCmd ? `↳ ${lastCmd}` : 'geometry_shell'}
          </span>
          <span style={{ color: 'rgba(255,215,0,0.7)', fontFamily: 'monospace', fontSize: '13px' }}>▸</span>
          <input
            value={termInput}
            onChange={e => setTermInput(e.target.value)}
            placeholder="run <kernel>  |  query <text>"
            spellCheck={false}
            autoComplete="off"
            style={{
              flex:        1,
              background:  'transparent',
              border:      'none',
              outline:     'none',
              color:       'rgba(255,215,0,0.85)',
              fontFamily:  'monospace',
              fontSize:    '12px',
              letterSpacing: '0.06em',
              caretColor:  '#FFD700',
            }}
          />
        </form>
      </div>

      {/* ── Query projection result panel ──────────────────────────────────── */}
      {queryResult && (
        <div
          className="mt-3 border rounded-sm p-3 font-mono text-[10px] leading-relaxed"
          style={{
            borderColor: 'rgba(167,139,250,0.35)',
            background:  'linear-gradient(135deg, rgba(0,0,0,0.88), rgba(167,139,250,0.05), rgba(0,0,0,0.88))',
          }}
        >
          <div className="flex items-center justify-between">
            <div style={{ color: 'rgba(167,139,250,0.95)' }}>
              {'> [QUERY_PROJECTION] :: '}
              <span style={{ color: 'rgba(255,255,255,0.80)' }}>
                "{queryResult.query.slice(0, 55)}{queryResult.query.length > 55 ? '…' : ''}"
              </span>
            </div>
            <button
              onClick={() => { probeNodeRef.current = null; setQueryResult(null); }}
              style={{ color: 'rgba(167,139,250,0.5)', fontFamily: 'monospace', fontSize: '10px', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => e.target.style.color = 'rgba(167,139,250,0.9)'}
              onMouseLeave={e => e.target.style.color = 'rgba(167,139,250,0.5)'}
            >[CLEAR]</button>
          </div>
          <div className="mt-1.5" style={{ color: 'rgba(255,255,255,0.30)' }}>
            {'  [TOP RESONANT NODES] :: 16D cosine similarity'}
          </div>
          {queryResult.similarities.slice(0, 6).map((n, i) => {
            const col = NODE_COLORS[n.id];
            const cluCol = CLUSTER_COLORS[n.cluster];
            const barLen = Math.round(n.sim * 22);
            const bar = '█'.repeat(barLen) + '░'.repeat(22 - barLen);
            return (
              <div key={n.id} className="mt-0.5 flex gap-2 items-baseline">
                <span style={{ color: 'rgba(167,139,250,0.55)', minWidth: '16px' }}>{i + 1}.</span>
                <span style={{ color: col?.hsl ?? 'rgba(255,215,0,0.85)', minWidth: '110px', fontWeight: 700 }}>{n.label}</span>
                <span style={{ color: cluCol?.hsl ?? 'rgba(255,255,255,0.3)', minWidth: '80px', fontSize: '9px' }}>{CLUSTERS[n.cluster]?.label ?? n.cluster}</span>
                <span style={{ color: 'rgba(167,139,250,0.35)', fontSize: '9px' }}>{bar}</span>
                <span style={{ color: 'rgba(255,255,255,0.75)' }}>{n.sim.toFixed(4)}</span>
              </div>
            );
          })}
          <div className="mt-1.5" style={{ color: 'rgba(255,255,255,0.12)' }}>
            {'  ── sphere probe ⊕ rendered on canvas · type `clear query` to dismiss ──'}
          </div>
        </div>
      )}

      {/* Cluster legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 items-center">
        {Object.entries(CLUSTERS).map(([key, c]) => {
          const col = CLUSTER_COLORS[key];
          return (
            <div key={key} className="flex items-center gap-1.5 text-xs font-bold font-mono tracking-widest">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: col.hsl, boxShadow: `0 0 5px ${col.hsl}` }}
              />
              <span style={{ color: hslAlpha(col, 0.75) }}>{c.label}</span>
            </div>
          );
        })}
        <span className="ml-auto text-xs font-mono tracking-widest" style={{ color: 'rgba(255,140,0,0.3)' }}>
          entropy is structural
        </span>
      </div>

      {/* ── ARIA live region for screen readers ──────────────────────────── */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {`Feigenbaum sphere. ${NODES.length + bifurcCount} nodes, ${activeEdges.length} edges. `}
        {`Phase regime: ${phaseRegime}. Control parameter r = ${phaseR.toFixed(3)}. `}
        {`Lyapunov exponent: ${phaseLyap.toFixed(4)}. `}
        {selectedNode ? `Selected node: ${selectedNode}. ` : ''}
        {recording ? 'Recording timeline. ' : ''}
        {playback ? 'Playing back timeline. ' : ''}
        {peerCount > 0 ? `${peerCount} connected peers. ` : ''}
      </div>

      {/* ── Phase regime + Feigenbaum dynamics readout ──────────────────── */}
      <div
        className="mt-3 border rounded-sm p-3 font-mono text-[10px] leading-relaxed"
        style={{
          borderColor: phaseRegime === 'CHAOS' ? 'rgba(239,68,68,0.4)' : 'rgba(255,215,0,0.15)',
          background: phaseRegime === 'CHAOS'
            ? 'linear-gradient(135deg, rgba(0,0,0,0.88), rgba(239,68,68,0.06), rgba(0,0,0,0.88))'
            : 'linear-gradient(135deg, rgba(0,0,0,0.88), rgba(255,215,0,0.03), rgba(0,0,0,0.88))',
        }}
        role="region"
        aria-label="Feigenbaum dynamics"
      >
        <div className="flex items-center justify-between">
          <div style={{ color: phaseRegime === 'CHAOS' ? 'rgba(239,68,68,0.9)' : 'rgba(255,215,0,0.7)' }}>
            {'> [FEIGENBAUM_DYNAMICS] :: '}
            <span style={{
              color: phaseRegime === 'CHAOS' ? 'rgba(239,68,68,0.95)' : 'rgba(255,255,255,0.8)',
              textShadow: phaseRegime === 'CHAOS' ? '0 0 8px rgba(239,68,68,0.5)' : 'none',
            }}>
              {phaseRegime}
            </span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.25)' }}>
            {recording && '● REC  '}{playback && '▶ PLAY'}
          </span>
        </div>
        <div className="mt-1 flex gap-4 flex-wrap" style={{ color: 'rgba(255,255,255,0.45)' }}>
          <span>{'r = '}<span style={{ color: 'rgba(255,215,0,0.85)' }}>{phaseR.toFixed(6)}</span></span>
          <span>{'λ = '}<span style={{ color: phaseLyap > 0 ? 'rgba(239,68,68,0.9)' : 'rgba(34,197,94,0.8)' }}>{phaseLyap.toFixed(6)}</span>
            {' '}<span style={{ color: 'rgba(255,255,255,0.25)' }}>{phaseLyap > 0.01 ? '[CHAOTIC]' : phaseLyap > -0.01 ? '[MARGINAL]' : '[PERIODIC]'}</span></span>
          <span>{'E = '}<span style={{ color: 'rgba(167,139,250,0.8)' }}>{(getFieldEnergy?.() ?? 0).toFixed(4)}</span></span>
          <span>{'δ = '}<span style={{ color: 'rgba(255,215,0,0.5)' }}>{'4.669201609'}</span></span>
        </div>
        <div className="mt-1" style={{ color: 'rgba(255,255,255,0.20)' }}>
          {'  ── Hopfield associative memory · logistic map x→rx(1-x) · genuine period-doubling cascade ──'}
        </div>
        <div className="mt-2 flex gap-4 flex-wrap" style={{ color: 'rgba(255,255,255,0.45)' }}>
          <span>{'PR = '}<span style={{ color: 'rgba(100,200,255,0.85)' }}>{(getParticipationRatio?.() ?? 0).toFixed(2)}</span>
            {' '}<span style={{ color: 'rgba(255,255,255,0.25)' }}>{(getParticipationRatio?.() ?? 0) < 3 ? '[MONOCHROMATIC]' : (getParticipationRatio?.() ?? 0) < 6 ? '[TRICHROMATIC]' : '[FULL SPECTRUM]'}</span></span>
          <span>{'cells = '}<span style={{ color: 'rgba(34,197,94,0.8)' }}>{cellCount()}</span></span>
          <span>{'flux = '}<span style={{ color: 'rgba(255,180,0,0.8)' }}>{(getSpectralFlux?.() ?? 0).toFixed(4)}</span></span>
        </div>
        <div className="mt-1" style={{ color: 'rgba(255,255,255,0.15)' }}>
          {'  ── morphogenetic Voronoi · PCA eigenspectrum → visible light · participation ratio ──'}
        </div>
      </div>

      {/* ── Resonance Mode readout ──────────────────────────────────────────── */}
      {resonanceMode && (
        <div
          className="mt-3 border rounded-sm p-3 font-mono text-[10px] leading-relaxed"
          style={{
            borderColor: resonanceResult ? 'rgba(255,215,0,0.35)' : 'rgba(255,215,0,0.12)',
            background:  'linear-gradient(135deg, rgba(0,0,0,0.88), rgba(255,215,0,0.04), rgba(0,0,0,0.88))',
          }}
        >
          <div style={{ color: 'rgba(255,215,0,0.7)' }}>
            {'> [RESONANCE_MODE] :: '}
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>
              shift-click two nodes to compare 16D tensor similarity
            </span>
          </div>

          {resonanceNodes.length === 0 && (
            <div className="mt-1" style={{ color: 'rgba(255,215,0,0.3)' }}>
              {'  awaiting node selection... (0/2)'}
            </div>
          )}

          {resonanceNodes.length === 1 && (() => {
            const n = NODES.find(x => x.id === resonanceNodes[0]);
            const c = NODE_COLORS[resonanceNodes[0]];
            return (
              <div className="mt-1">
                <span style={{ color: 'rgba(255,215,0,0.5)' }}>{'  [A] :: '}</span>
                <span style={{ color: c?.hsl ?? '#FFD700' }}>{n?.label ?? resonanceNodes[0]}</span>
                <span style={{ color: 'rgba(255,215,0,0.3)' }}>{' · awaiting [B]...'}</span>
              </div>
            );
          })()}

          {resonanceNodes.length === 2 && resonanceResult && (() => {
            const [idA, idB]   = resonanceNodes;
            const nA = NODES.find(x => x.id === idA);
            const nB = NODES.find(x => x.id === idB);
            const cA = NODE_COLORS[idA], cB = NODE_COLORS[idB];
            const sim = resonanceResult.sim;
            // Similarity quality label
            const simLabel = sim > 0.92 ? 'NEAR-IDENTICAL'
              : sim > 0.80 ? 'HIGH RESONANCE'
              : sim > 0.65 ? 'MODERATE'
              : sim > 0.45 ? 'WEAK'
              : 'ORTHOGONAL';
            const simColor = sim > 0.80 ? 'rgba(255,215,0,0.95)'
              : sim > 0.60 ? 'rgba(255,180,0,0.80)'
              : 'rgba(200,100,50,0.75)';
            return (
              <>
                <div className="mt-2 flex gap-3 flex-wrap">
                  <span style={{ color: 'rgba(255,215,0,0.5)' }}>{'  [A] :: '}</span>
                  <span style={{ color: cA?.hsl ?? '#FFD700' }}>{nA?.label ?? idA}</span>
                  <span style={{ color: 'rgba(255,255,255,0.25)' }}>{'⟷'}</span>
                  <span style={{ color: cB?.hsl ?? '#FFD700' }}>{nB?.label ?? idB}</span>
                  <span style={{ color: 'rgba(255,215,0,0.5)' }}>{' [B]'}</span>
                </div>
                <div className="mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {'  [SIM] :: '}
                  <span style={{
                    color: simColor,
                    textShadow: sim > 0.80 ? '0 0 8px rgba(255,215,0,0.5)' : 'none',
                  }}>
                    {sim.toFixed(4)}
                  </span>
                  {' — '}
                  <span style={{ color: simColor }}>{simLabel}</span>
                </div>
                <div className="mt-2" style={{ color: 'rgba(255,215,0,0.4)' }}>
                  {'  [TOP COALESCENT DIMENSIONS]'}
                </div>
                {resonanceResult.topDims.map((d, i) => (
                  <div key={d.name} className="mt-0.5 pl-4" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    <span style={{ color: 'rgba(255,215,0,0.45)' }}>{`[${i + 1}] `}</span>
                    <span style={{ color: 'rgba(255,255,255,0.85)' }}>{d.name}</span>
                    {' · '}
                    <span style={{ color: 'rgba(255,215,0,0.7)' }}>
                      {`A=${d.vA.toFixed(2)} B=${d.vB.toFixed(2)} ⊗=${d.contribution.toFixed(4)}`}
                    </span>
                  </div>
                ))}
                <div className="mt-1.5" style={{ color: 'rgba(255,255,255,0.20)' }}>
                  {'  edge bloom intensity ∝ similarity · lineWidth = '}
                  <span style={{ color: 'rgba(255,215,0,0.4)' }}>{`${(1.5 + sim * 4).toFixed(2)}px`}</span>
                  {' · shadowBlur = '}
                  <span style={{ color: 'rgba(255,215,0,0.4)' }}>{`${(4 + sim * 24).toFixed(0)}px`}</span>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ── TerminalReadout — node-click shows all edges, edge-click zooms one ── */}
      {selectedNode && selectedNodeEdges && !lockedEdge && (() => {
        const seed = NODES.find(n => n.id === selectedNode);
        if (!seed) return null;
        const seedCol = NODE_COLORS[seed.id];
        const clusterLabel = CLUSTERS[seed.cluster]?.label ?? seed.cluster;
        return (
          <div
            className="mt-3 border rounded-sm p-3 font-mono text-[10px] leading-relaxed"
            style={{
              borderColor: hslAlpha(seedCol, 0.35),
              background: `linear-gradient(135deg, rgba(0,0,0,0.88), ${hslAlpha(seedCol, 0.06)}, rgba(0,0,0,0.88))`,
            }}
          >
            {/* Node header */}
            <div style={{ color: seedCol.hsl }}>
              {'> [NODE SELECTED] :: '}
              <span style={{ color: 'rgba(255,255,255,0.95)' }}>{seed.label.toUpperCase()}</span>
            </div>
            <div className="mt-1" style={{ color: 'rgba(255,255,255,0.40)' }}>
              {'  [STATE] :: '}
              <span style={{ color: seedCol.hsl }}>{seed.id}</span>
              {' ∈ '}
              <span style={{ color: CLUSTER_COLORS[seed.cluster]?.hsl }}>{clusterLabel}</span>
              {' · '}{selectedNodeEdges.length}{' edges · click edge on sphere to isolate'}
            </div>

            {/* All connected edges with 16D analysis */}
            {selectedNodeEdges.map((ed, i) => {
              const nb = NODES.find(n => n.id === ed.bId);
              if (!nb) return null;
              const nbCol = NODE_COLORS[nb.id];
              const accent = ed.isSpectralBridge ? 'rgba(6,182,212,' : 'rgba(255,215,0,';
              const sameCluster = seed.cluster === nb.cluster;
              return (
                <div key={ed.bId} className={i === 0 ? 'mt-2' : 'mt-3'} style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none', paddingTop: i > 0 ? '8px' : 0 }}>
                  {/* Edge link line */}
                  <div style={{ color: `${accent}0.85)` }}>
                    {'  > [LINK] :: '}
                    <span style={{ color: seedCol.hsl }}>{seed.label.toUpperCase()}</span>
                    {' <-> '}
                    <span style={{ color: nbCol.hsl }}>{nb.label.toUpperCase()}</span>
                    {ed.isSpectralBridge && <span style={{ color: 'rgba(6,182,212,0.6)' }}>{' ◆ spectral'}</span>}
                    {!sameCluster && !ed.isSpectralBridge && <span style={{ color: 'rgba(255,255,255,0.25)' }}>{' ○ cross-cluster'}</span>}
                  </div>

                  {/* Cosine distance */}
                  <div className="mt-0.5" style={{ color: `${accent}0.70)` }}>
                    {'    [COSINE_DISTANCE] :: '}
                    <span style={{ color: 'rgba(255,255,255,0.90)' }}>{ed.cosSim.toFixed(4)}</span>
                    <span style={{ color: 'rgba(255,255,255,0.25)' }}>
                      {ed.cosSim >= 0.85 ? '  ▓▓▓▓▓' :
                       ed.cosSim >= 0.70 ? '  ▓▓▓▓░' :
                       ed.cosSim >= 0.55 ? '  ▓▓▓░░' :
                                           '  ▓▓░░░'}
                    </span>
                  </div>

                  {/* Top 3 dominant tensors — compact single-line each */}
                  {ed.drivers.slice(0, 3).map(d => (
                    <div key={d.name} className="mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      {'    [TENSOR] '}
                      <span style={{ color: 'rgba(255,215,0,0.90)' }}>{d.name}</span>
                      <span style={{ color: 'rgba(255,255,255,0.25)' }}>{' :: '}</span>
                      <span style={{ color: 'rgba(255,255,255,0.75)' }}>{d.value.toFixed(3)}</span>
                      <span style={{ color: 'rgba(255,255,255,0.20)' }}>
                        {' ('}{seed.id}={d.magA.toFixed(2)}{' · '}{nb.id}={d.magB.toFixed(2)}{')'}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}

            {/* System signature */}
            <div className="mt-3" style={{ color: 'rgba(255,255,255,0.12)' }}>
              {'  ── spectral_bridge.rs · 16D fingerprint space · cosine similarity ──'}
            </div>
          </div>
        );
      })()}

      {/* Single-edge detail — shown when an edge is click-locked on the sphere */}
      {lockedEdge && (() => {
        const ed = lockedEdge;
        const nA = NODES.find(n => n.id === ed.aId);
        const nB = NODES.find(n => n.id === ed.bId);
        if (!nA || !nB) return null;
        const colA = NODE_COLORS[nA.id], colB = NODE_COLORS[nB.id];
        const sameCluster = nA.cluster === nB.cluster;
        const clusterA = CLUSTERS[nA.cluster]?.label ?? nA.cluster;
        const clusterB = CLUSTERS[nB.cluster]?.label ?? nB.cluster;
        const accent = ed.isSpectralBridge ? 'rgba(6,182,212,' : 'rgba(255,215,0,';
        return (
          <div
            className="mt-3 border rounded-sm p-3 font-mono text-[10px] leading-relaxed"
            style={{
              borderColor: `${accent}0.35)`,
              background: `linear-gradient(135deg, rgba(0,0,0,0.88), ${hslAlpha(colA, 0.04)}, ${hslAlpha(colB, 0.04)}, rgba(0,0,0,0.88))`,
            }}
          >
            <div style={{ color: `${accent}0.90)` }}>
              {'> [LINK ESTABLISHED] :: '}
              <span style={{ color: colA.hsl }}>{nA.label.toUpperCase()}</span>
              {' <-> '}
              <span style={{ color: colB.hsl }}>{nB.label.toUpperCase()}</span>
            </div>

            <div className="mt-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {'  [STATE] :: '}
              <span style={{ color: colA.hsl }}>{nA.id}</span>
              {' ∈ '}
              <span style={{ color: CLUSTER_COLORS[nA.cluster]?.hsl }}>{clusterA}</span>
              {sameCluster
                ? <span>{' (intra-cluster bond)'}</span>
                : <>
                    {' · '}
                    <span style={{ color: colB.hsl }}>{nB.id}</span>
                    {' ∈ '}
                    <span style={{ color: CLUSTER_COLORS[nB.cluster]?.hsl }}>{clusterB}</span>
                    {ed.isSpectralBridge
                      ? <span style={{ color: `${accent}0.8)` }}>{' (spectral bridge)'}</span>
                      : <span>{' (cross-cluster default)'}</span>
                    }
                  </>
              }
            </div>

            <div className="mt-1" style={{ color: `${accent}0.85)` }}>
              {'  [COSINE_DISTANCE] :: '}
              <span style={{ color: 'rgba(255,255,255,0.95)' }}>{ed.cosSim.toFixed(4)}</span>
              <span style={{ color: 'rgba(255,255,255,0.30)' }}>
                {ed.cosSim >= 0.85 ? '  ▓▓▓▓▓ strong' :
                 ed.cosSim >= 0.70 ? '  ▓▓▓▓░ moderate' :
                 ed.cosSim >= 0.55 ? '  ▓▓▓░░ weak' :
                                     '  ▓▓░░░ distant'}
              </span>
            </div>

            {ed.drivers.length > 0 && (
              <div className="mt-1.5">
                <div style={{ color: `${accent}0.75)` }}>
                  {'  [DOMINANT_TENSORS] :: top '}{ed.drivers.length}{' of 16 dimensions'}
                </div>
                {ed.drivers.map(d => {
                  const barLen = Math.round(d.value * 20);
                  const bar = '█'.repeat(barLen) + '░'.repeat(20 - barLen);
                  return (
                    <div key={d.name} className="mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                      {'    '}
                      <span style={{ color: 'rgba(255,215,0,0.95)', display: 'inline-block', minWidth: '120px' }}>
                        {d.name}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.25)' }}>{bar} </span>
                      <span style={{ color: 'rgba(255,255,255,0.80)' }}>{d.value.toFixed(3)}</span>
                      <span style={{ color: 'rgba(255,255,255,0.25)' }}>
                        {' ('}{nA.id}={d.magA.toFixed(2)}{' · '}{nB.id}={d.magB.toFixed(2)}{')'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-2" style={{ color: 'rgba(255,255,255,0.12)' }}>
              {'  ── spectral_bridge.rs · 16D fingerprint space · cosine similarity ──'}
            </div>
          </div>
        );
      })()}

      {/* ── Orthogonal Bridge readout — engine-forged divergent links ── */}
      {lockedOrtho && (() => {
        const nA = NODES.find(n => n.id === lockedOrtho.idA);
        const nB = NODES.find(n => n.id === lockedOrtho.idB);
        if (!nA || !nB) return null;
        const colA = NODE_COLORS[nA.id], colB = NODE_COLORS[nB.id];
        return (
          <div
            className="mt-3 border rounded-sm p-3 font-mono text-[10px] leading-relaxed"
            style={{
              borderColor: 'rgba(217,70,239,0.45)',
              background:  'linear-gradient(135deg, rgba(0,0,0,0.88), rgba(217,70,239,0.05), rgba(6,182,212,0.04), rgba(0,0,0,0.88))',
            }}
          >
            <div style={{ color: 'rgba(217,70,239,0.95)' }}>
              {'> [ORTHOGONAL_BRIDGE] :: '}
              <span style={{ color: colA.hsl }}>{nA.label.toUpperCase()}</span>
              {' <-> '}
              <span style={{ color: colB.hsl }}>{nB.label.toUpperCase()}</span>
            </div>

            <div className="mt-1" style={{ color: 'rgba(6,182,212,0.80)' }}>
              {'  [COSINE_DISTANCE] :: '}
              <span style={{ color: 'rgba(255,255,255,0.95)' }}>{lockedOrtho.sim.toFixed(4)}</span>
              <span style={{ color: 'rgba(255,255,255,0.30)' }}>{'  ░░░░░ maximal divergence'}</span>
            </div>

            <div className="mt-1" style={{ color: 'rgba(255,255,255,0.30)' }}>
              {'  [CLUSTERS] :: '}
              <span style={{ color: CLUSTER_COLORS[nA.cluster]?.hsl }}>{CLUSTERS[nA.cluster]?.label ?? nA.cluster}</span>
              {' ↔ '}
              <span style={{ color: CLUSTER_COLORS[nB.cluster]?.hsl }}>{CLUSTERS[nB.cluster]?.label ?? nB.cluster}</span>
              <span style={{ color: 'rgba(217,70,239,0.60)' }}>{' (synthetic cross-cluster link)'}</span>
            </div>

            {lockedOrtho.divergentDims?.length > 0 && (
              <div className="mt-1.5">
                <div style={{ color: 'rgba(217,70,239,0.70)' }}>
                  {'  [DIVERGENT_DIMS] :: top '}{lockedOrtho.divergentDims.length}{' structural paradoxes'}
                </div>
                {lockedOrtho.divergentDims.map(d => {
                  const barLen = Math.round(d.delta * 20);
                  const bar = '█'.repeat(barLen) + '░'.repeat(20 - barLen);
                  return (
                    <div key={d.name} className="mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                      {'    '}
                      <span style={{ color: 'rgba(217,70,239,0.90)', display: 'inline-block', minWidth: '120px' }}>
                        {d.name}
                      </span>
                      <span style={{ color: 'rgba(6,182,212,0.40)' }}>{bar} </span>
                      <span style={{ color: 'rgba(255,255,255,0.80)' }}>{'Δ'}{d.delta.toFixed(3)}</span>
                      <span style={{ color: 'rgba(255,255,255,0.25)' }}>
                        {' ('}{nA.id}{'='}{d.vA.toFixed(2)}{' ↔ '}{nB.id}{'='}{d.vB.toFixed(2)}{')'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-2" style={{ color: 'rgba(255,255,255,0.12)' }}>
              {'  ── DIVERGENCE_ENGINE · findOrthogonalNode · 16D cosine · forced synthetic ──'}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

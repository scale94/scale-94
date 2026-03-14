// ArtTab.jsx — SOMA-9.4 // FADE_DOCTRINE // ARS ELECTRONICA 2027
//
// Orbital sphere topology: 25 kernel nodes constrained to a rotating unit sphere.
// Force-directed layout in 3D, perspective-projected onto Canvas2D.
// No WebGL dependency — full 3D feel via perspective divide + depth cueing.
//
// Interaction:
//   Left-click  → cue Hopfield associative field (WASM)
//   Right-click → run that node's own kernel
//   Drag        → rotate sphere (inertia on release)
//
// Color system: deterministic hash HSL via kernelColorMap.js

import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { Waves } from 'lucide-react';
import { nodeColor, lerpColor, hslAlpha } from '../data/kernelColorMap';
import { useSomaGraph, CLUSTER_ANCHORS } from '../hooks/useSomaGraph';
import { useKineticEdges }                from '../hooks/useKineticEdges';

// ── Graph topology ────────────────────────────────────────────────────────────

const CLUSTERS = {
  eco:    { label: 'ecological'   },
  sync:   { label: 'synchrony'    },
  phys:   { label: 'physics'      },
  crypto: { label: 'cryptography' },
  drk:    { label: 'drk'          },
};

const NODES = [
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
];

// Intra-cluster edges — same cluster, always present
const INTRA_EDGES = [
  ['biocoenosis', 'replicator'], ['biocoenosis', 'grayscott'],
  ['daly',        'chrono'],     ['daly',        'atmospheric'], ['chrono', 'atmospheric'],
  ['kuramoto',    'ceei'],       ['kuramoto',    'soma91'],
  ['soma91',      'soma_plus'],  ['soma91',      'leviathan'],   ['leviathan', 'cynic'],
  ['feigenbaum',  'ising'],      ['feigenbaum',  'bosonic'],
  ['ising',       'bosonic'],    ['bosonic',     'seraphine'],   ['seraphine', 'fusion'],
  ['classified',  'pqhash'],     ['classified',  'dh_ec'],
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

// ── 16D fingerprint space (mirrored from spectral_bridge.rs) ──────────────────
// Indices match NODES array order (0–24). Values on [0,1].

const DIM_NAMES = [
  'dynamical', 'nonlinearity', 'dimensionality', 'criticality',
  'entropy', 'synchrony', 'conservation', 'temporal',
  'spatial', 'stochastic', 'game_theory', 'thermodynamic',
  'information', 'cryptographic', 'biological', 'economic',
];

/* prettier-ignore */
const FEATURES = [
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
];

// ID → NODES index lookup (built once)
const NODE_IDX = Object.fromEntries(NODES.map((n, i) => [n.id, i]));

// Cosine similarity between two feature vectors
function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < 16; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d < 1e-12 ? 0 : dot / d;
}

// Top-K dimension drivers by dot-product contribution a[i]*b[i]
function topDrivers(a, b, k = 3) {
  const contribs = DIM_NAMES.map((name, i) => ({ name, value: a[i] * b[i], magA: a[i], magB: b[i] }));
  contribs.sort((x, y) => y.value - x.value);
  return contribs.slice(0, k).filter(c => c.value > 0.01);
}

// Full edge analysis: cosine similarity + top drivers + per-dim contributions
function analyzeEdge(idA, idB) {
  const iA = NODE_IDX[idA], iB = NODE_IDX[idB];
  if (iA == null || iB == null) return null;
  const fA = FEATURES[iA], fB = FEATURES[iB];
  const sim = cosineSim(fA, fB);
  const drivers = topDrivers(fA, fB, 4);
  return { sim, drivers };
}

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

// ── Component ─────────────────────────────────────────────────────────────────

const AUTO_SPIN = 0.0025;   // rad/frame continuous Y rotation
const FOCAL_K   = 2.8;      // focal = FOCAL_K × sphereR — controls perspective depth
const SPHERE_K  = 0.50;     // sphereR = SPHERE_K × min(w, h) — larger sphere, front and center

export default function ArtTab({ onRunKernel, onCueNode, associativeField, spectralBridges, probeNode }) {
  const canvasRef    = useRef(null);
  const containerRef = useRef(null);
  const rafRef       = useRef(null);
  const dimsRef      = useRef({ w: 900, h: 620 });
  const hoveredRef   = useRef(null);
  const [hoveredEdge, setHoveredEdge] = useState(null);  // { aId, bId, cosSim, drivers, isSpectralBridge }
  const [lockedEdge,  setLockedEdge]  = useState(null);  // click-locked readout (persists until click-away)
  const [selectedNode, setSelectedNode] = useState(null); // node click → show all connected edges with 16D analysis
  const edgeDebounceRef = useRef(null);                   // timeout id for hover debounce

  // Rotation state — mutated directly, never causes re-render
  const rotRef  = useRef({ rx: 0.18, ry: 0 });
  // Drag state
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0, vx: 0, vy: 0 });

  // Dynamic cross-cluster edges — computed by spectral_bridge kernel, or default
  const activeEdges = useMemo(() => {
    if (!spectralBridges?.bridges?.length) {
      return [...INTRA_EDGES, ...DEFAULT_CROSS_EDGES];
    }
    // Convert bridge indices [a_idx, b_idx, similarity] to ID pairs
    const computedCross = spectralBridges.bridges
      .map(([a, b]) => [NODES[a]?.id, NODES[b]?.id])
      .filter(([a, b]) => a && b);
    return [...INTRA_EDGES, ...computedCross];
  }, [spectralBridges]);

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
    fireNode, applyAttractor, triggerOverwrite,
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

    geomEffectsRef.current.push({
      id:        Date.now() + Math.random(),
      nodeIds:   localIds.slice(0, nodeLimit),
      life:      0,
      maxLife:   coarse ? Math.min(maxLife, 150) : maxLife,
      hueBase:   Math.random() * 360,
      intensity: coarse ? Math.min(intensity, 0.7) : intensity,
      coarse,
    });
    if (node) fireNode(node.id);
  }, [fireNode]);

  const handleRunKernel = useCallback((alias) => {
    spawnEffect(alias);
    if (onRunKernel) onRunKernel(alias);
  }, [spawnEffect, onRunKernel]);

  const handleTermSubmit = useCallback((e) => {
    e.preventDefault();
    // Sanitize: only word chars, spaces, dashes — no shell metacharacters
    const raw = termInput.trim().replace(/[^a-zA-Z0-9 _\-]/g, '').slice(0, 64);
    if (!raw) return;
    const alias = raw.startsWith('run ') ? raw.slice(4).trim() : raw;
    setLastCmd(raw);
    setTermInput('');
    handleRunKernel(alias);
  }, [termInput, handleRunKernel]);

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
      const H = Math.floor(Math.min(Math.max(W * 0.65, 360), 580));
      dimsRef.current = { w: W, h: H };
      if (canvasRef.current) {
        canvasRef.current.width  = W;
        canvasRef.current.height = H;
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

      // ── Project all nodes ─────────────────────────────────────────────────
      const proj = nodes.map(n => {
        const [rx, ry, rz] = applyM(M, n.x, n.y, n.z);
        return { ...project(rx, ry, rz, w, h, sphereR, focal), id: n.id };
      });

      // ── Depth-sort indices for painter's algorithm ────────────────────────
      // Render far (negative depth) first, near last
      const sortedNodeIdx = nodes.map((_, i) => i)
        .sort((a, b) => proj[a].depth - proj[b].depth);

      // ── Clear with trail fade ─────────────────────────────────────────────
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(0, 0, w, h);

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

          // Depth-based base alpha — fade edges on the back of the sphere
          const avgDepth  = (pA.depth + pB.depth) / 2;
          const depthFade = Math.max(0.03, (avgDepth + 1) * 0.5);  // 0→dim, 1→bright
          // Spectral bridges: cosine similarity boosts alpha and line width
          const spectralBoost = isSpectral ? cosSim * 0.35 : 0;
          const baseAlpha = (Math.min(na.energy, nb.energy) * 0.5 + 0.06 + spectralBoost) * depthFade;
          const pulseBoost = e.pulse * 0.40;

          ctx.lineWidth = (0.5 + Math.max(na.energy, nb.energy) * 0.8 + e.pulse * 1.8
                        + (isSpectral ? cosSim * 1.2 : 0))
                        * ((pA.scale + pB.scale) / 2);

          const cMid = lerpColor(colA, colB, e.strength);
          const grd  = ctx.createLinearGradient(pA.sx, pA.sy, pB.sx, pB.sy);
          grd.addColorStop(0,   hslAlpha(colA, (baseAlpha + pulseBoost) * (1 - e.strength * 0.4)));
          grd.addColorStop(0.5, hslAlpha(cMid, baseAlpha + pulseBoost));
          grd.addColorStop(1,   hslAlpha(colB, (baseAlpha + pulseBoost) * (0.6 + e.strength * 0.4)));
          ctx.strokeStyle = grd;

          // Spectral bridges render with dashed stroke for visual distinction
          if (isSpectral) ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(pA.sx, pA.sy);
          ctx.lineTo(pB.sx, pB.sy);
          ctx.stroke();
          if (isSpectral) ctx.setLineDash([]);

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
          const alpha = Math.sin(t * Math.PI) * (eff.intensity ?? 1.0);
          const hue0  = (eff.hueBase + eff.life * 1.8) % 360;

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
                const lAlpha = alpha * 0.28 * (1 - k * 0.06);
                const offset = (k - 3) * 2.2;

                // Control point pulled toward sphere center — creates interior arc illusion
                const midX = (pA.sx + pB.sx) / 2;
                const midY = (pA.sy + pB.sy) / 2;
                const cpx  = midX + (cx - midX) * 0.55 + offset * 2;
                const cpy  = midY + (cy - midY) * 0.55 + offset * 1.4;

                ctx.strokeStyle = `hsla(${hue},100%,65%,${lAlpha.toFixed(3)})`;
                ctx.lineWidth   = 0.7;
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
            ctx.strokeStyle = `hsla(${polyHue},100%,75%,${(alpha * 0.18).toFixed(3)})`;
            ctx.lineWidth   = 1.2;
            ctx.beginPath();
            ctx.moveTo(effProj[0].sx, effProj[0].sy);
            for (let i = 1; i < effProj.length; i++) ctx.lineTo(effProj[i].sx, effProj[i].sy);
            ctx.closePath();
            ctx.stroke();
          }

          // Star spokes — lines from sphere center to each effect node
          for (const ep of effProj) {
            const spokeHue = (hue0 + Math.atan2(ep.sy - cy, ep.sx - cx) * (180 / Math.PI) + 360) % 360;
            ctx.strokeStyle = `hsla(${spokeHue},90%,70%,${(alpha * 0.12).toFixed(3)})`;
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
        const p   = proj[i];
        const col = NODE_COLORS[n.id];

        const isHov     = n.id === hov;
        const energy    = n.energy + (isHov ? 0.55 : 0);
        // Depth cuing: nodes on the back are smaller + dimmer
        const depthAlpha = Math.max(0.08, (p.depth + 1) * 0.5);
        const radius     = (5 + energy * 4) * p.scale;

        // Overwrite bleed — temporarily radiate source color
        let renderCol = col;
        if (n.bleedAmount > 0 && n.bleedFrom) {
          const srcCol = NODE_COLORS[n.bleedFrom];
          if (srcCol) renderCol = lerpColor(col, srcCol, n.bleedAmount * 0.7);
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
          if (showFire && fireAlpha > energyA && !showHover) {
            // Fired labels: render in the node's own color for visual punch
            ctx.fillStyle = hslAlpha(renderCol, la);
          } else {
            ctx.fillStyle = `rgba(255,255,255,${la})`;
          }
          ctx.font = `bold ${fontSize}px monospace`;
          ctx.fillText(n.label, p.sx, p.sy - radius - 4);
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
      const node = nodeAt(p.x, p.y);
      hoveredRef.current = node?.id ?? null;
      if (node) {
        clearTimeout(edgeDebounceRef.current);
        if (!lockedEdge) setHoveredEdge(null);
        if (canvasRef.current) canvasRef.current.style.cursor = 'pointer';
      } else {
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
        } else {
          setLockedEdge(null);
          setHoveredEdge(null);
          setSelectedNode(null);
        }
        return;
      }
      if (e.button === 2) {
        if (node.alias) handleRunKernel(node.alias);
      } else {
        fireNode(node.id);
        spawnEffect(node.id, { soft: true });   // attractor click → soft geometry pulse
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
    if (node?.alias) handleRunKernel(node.alias);
  }, [canvasCoords, nodeAt, onRunKernel]);

  const handleMouseLeave = useCallback(() => {
    dragRef.current.active = false;
    hoveredRef.current = null;
    clearTimeout(edgeDebounceRef.current);
    setHoveredEdge(null);
    setLockedEdge(null);
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
  }, []);

  const handleTouchStart = useCallback((e) => {
    const t = e.touches[0];
    if (t) dragRef.current = { active: true, lastX: t.clientX, lastY: t.clientY, vx: 0, vy: 0 };
  }, []);

  const handleTouchMove = useCallback((e) => {
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
    dragRef.current.active = false;
    const t = e.changedTouches[0];
    if (!t) return;
    const p    = canvasCoords(t.clientX, t.clientY);
    if (!p) return;
    const node = nodeAt(p.x, p.y);
    if (!node) return;
    fireNode(node.id);
    spawnEffect(node.id, { soft: true });
    // Label cascade — record seed + neighbors for the draw loop
    const nbs = new Set(ADJ[node.id] ?? []);
    nbs.add(node.id);
    firedRef.current = { seedId: node.id, neighborIds: nbs, t0: performance.now() };
    const nodeIdx = NODES.findIndex(n => n.id === node.id);
    if (onCueNode && nodeIdx >= 0) onCueNode(nodeIdx);
    setSelectedNode(node.id);
    setLockedEdge(null);
  }, [canvasCoords, nodeAt, fireNode, spawnEffect, onCueNode]);

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

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

      <style>{`
        @keyframes at-shimmer {
          0%,100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-amber-900/40 pb-4 mb-6">
        <div>
          <h2 className="text-2xl md:text-4xl font-bold mb-1 tracking-tight flex items-center gap-3">
            <Waves
              className="w-6 h-6 md:w-8 md:h-8 shrink-0"
              style={{ color: '#FFD700', filter: 'drop-shadow(0 0 8px rgba(255,215,0,0.6))' }}
            />
            <span
              className="text-transparent bg-clip-text"
              style={{
                backgroundImage: 'linear-gradient(90deg, #FF8C00, #FFD700, #d946ef, #FFD700, #FF8C00)',
                backgroundSize:  '400% auto',
                animation:       'at-shimmer 3.5s ease-in-out infinite',
              }}
            >fade_doctrine</span>
          </h2>
          <div className="text-sm font-bold tracking-widest" style={{ color: 'rgba(251,191,36,0.5)' }}>
            orbital sphere // ars electronica 2027 // soma-9.4
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 md:mt-0 text-xs font-bold font-mono tracking-widest">
          <span className="border border-amber-900/40 px-3 py-1 rounded-sm" style={{ color: 'rgba(251,191,36,0.5)' }}>
            {NODES.length} nodes · {activeEdges.length} edges
            {spectralBridges ? ` · spectral` : ''}
            {probeNode ? ` · ⊕ probe` : ''}
          </span>
          <span className="border border-cyan-900/30 px-3 py-1 rounded-sm text-cyan-400/50">
            drag to rotate · click → attractor · right-click / shell → run
          </span>
        </div>
      </div>

      {/* Sphere canvas — frameless, front and center */}
      <div
        ref={containerRef}
        className="w-full overflow-hidden"
        style={{ background: '#000' }}
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
            placeholder="run <kernel>"
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
    </div>
  );
}

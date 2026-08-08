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
import { Maximize, Minimize, Radio, Clock, Wifi, Circle } from 'lucide-react';
import CascadeIcon from '../components/CascadeIcon';
import { lerpColor, hslAlpha } from '../data/kernelColorMap';
import { useSomaGraph, CLUSTER_ANCHORS } from '../hooks/useSomaGraph';
import { useKineticEdges }                from '../hooks/useKineticEdges';
import { useAssociativeField }            from '../hooks/useAssociativeField';
import { useTemporalMemory }              from '../hooks/useTemporalMemory';
import { useMorphogenesis }               from '../hooks/useMorphogenesis';
import { useSpectralLight }               from '../hooks/useSpectralLight';
import { useAnalogicalReasoning }         from '../hooks/useAnalogicalReasoning';
import { useVisitorEntropy }             from '../hooks/useVisitorEntropy';
import { useCollectiveR }               from '../hooks/useCollectiveR';
import { useTemporalArchaeology }        from '../hooks/useTemporalArchaeology';
import {
  NODES, NODE_IDX, FEATURES, DIM_NAMES,
  cosineSim, topDrivers, analyzeEdge, findOrthogonalNode,
  compareNodes, jitterFeatures,
} from '../data/nodeFeatures';
import { somaPresence } from '../net/SomaPresence';
import { ecoDataFeed } from '../data/EcoDataFeed';
import { ecocideBus } from './EcocideTab';
import { colliderBus } from './LatentCollider';
import { emit as emitObs } from '../../observatory/observatoryBus';
import { getSpine } from '../quintessence/spineStore';
import { trendToPressure, R_CHAOS } from '../quintessence/engineWitness';
import { nodeColor }   from '../data/kernelColorMap';
import {
  MAX_PARTICLES,
  createParticlePool, emitParticle, stepParticles,
  emitIdleParticles, emitNodeBurst, emitEdgeParticles,
} from '../art/artParticles';
import { buildRotMatrix, applyM, project } from '../art/artMath';
import { createBeatClock } from '../art/artBeatClock';
import { clusterLabelState, nodeLabelState, fireExpired } from '../art/artLabels';
import SphereLabels from '../art/SphereLabels';
import SphereComposite from '../art/SphereComposite';
import { stepAwakening, drawBeaconRing, drawConductor } from '../art/artAwakening';
import {
  riftTint, exergyAlpha, genesisGlowState, ambientIntensity, ghostTrailAlpha,
  stepFlash, FLASH_ALPHA, FLASH_CUTOFF,
  GHOST_COUNT, GHOST_CULL_Z, GHOST_RADIUS,
} from '../art/artBackground';
import {
  CLUSTERS, INTRA_EDGES, DEFAULT_CROSS_EDGES, ALL_EDGES, ADJ,
  SPHERE_NODES, SPHERE_ADJ, SPHERE_EDGES,
  NODE_COLORS, CLUSTER_COLORS, dynColorMap, dynFeaturesMap,
  DIM_KEYWORDS, queryProject, SPHERE_LABEL, sphereIndexOf,
} from '../art/artGraph';

// ── Component ─────────────────────────────────────────────────────────────────

const AUTO_SPIN = 0.0025;   // rad/frame continuous Y rotation

// Sector colors for 16-sector 256-node sphere (Scale 16.16)
const SECTOR_COLORS = {
  eco: '#22c55e', sync: '#3b82f6', phys: '#f59e0b', crypto: '#ef4444', drk: '#6b7280',
  phil: '#8b5cf6', math: '#06b6d4', chem: '#f97316', bio: '#10b981', hum: '#ec4899',
  ling: '#14b8a6', cogn: '#a855f7', aesth: '#e879f9', topo: '#0ea5e9', meta: '#fbbf24', synth: '#f43f5e',
  fsk: '#c0c0c0',
};
const FOCAL_K   = 2.8;      // focal = FOCAL_K × sphereR — controls perspective depth
const SPHERE_K  = 0.42;     // sphereR = SPHERE_K × min(w, h) — larger sphere, front and center

// Nearest scrollable ancestor — used to manually forward vertical touch
// gestures past the canvas (which has touch-action:none, so it never
// natively scrolls no matter what JS does on touchmove).
function getScrollParent(el) {
  let node = el?.parentElement;
  while (node) {
    const style = window.getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

export default function ArtTab({ onRunKernel, onCueNode, associativeField, spectralBridges, boneFusions, probeNode, manualFusions = [], onManualFusion, orthogonalBridges = [], onOrthogonalBridge }) {
  const canvasRef      = useRef(null);
  const containerRef   = useRef(null);
  const labelsApiRef   = useRef(null);
  const feigTitleRef   = useRef(null);
  const feigSparkTimer = useRef(null);   // guards at-feigSpark cleanup race
  const rafRef         = useRef(null);
  // r3f's advance(), handed over by SphereComposite once its GL root exists.
  // Null until then, and null again after unmount — the draw loop must not
  // assume the composite is mounted.
  const glAdvanceRef   = useRef(null);
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

  // ── Immersive Mode (fullscreen + vignette) ──────────────────────────────
  // Bloom is no longer immersive-only and no longer lives here: it is always on
  // and runs on the GPU in SphereComposite. Immersive still gates the Voronoi
  // mesh, the spectral ambient, the rift alpha, the canvas height calculation
  // and the vignette.
  const [immersive, setImmersive]       = useState(false);
  const immersiveRef    = useRef(false);  // RAF-safe mirror

  // ── Jury Awakening (choreographed first-impression sequence) ────────────
  // Phase 0 (0-4s): Genesis cascade — nodes light up cluster by cluster
  // Phase 1 (4-8s): Beacon pulse — one node glows as invitation
  // Phase 2 (8s+):  Auto-ignition — system self-fires 3 nodes
  // Phase 3:        Complete — normal interaction mode
  const awakeningRef = useRef({
    phase: 0,
    t0: performance.now(),
    interacted: false,      // true after first user gesture on canvas
    autoFiredNodes: [],     // nodes auto-ignited during phase 2
    beaconIdx: Math.floor(Math.random() * SPHERE_NODES.length),  // random beacon node
    breathPhase: 0,         // continuous breath oscillation
  });

  // ── Particle Ecology ────────────────────────────────────────────────────
  const particlesRef = useRef(createParticlePool());
  const particleFrameRef = useRef(0);     // frame counter for edge particle emission

  // ── Associative Field (Hopfield + Feigenbaum) ──────────────────────────
  const {
    fieldRef, stepField, perturbNode: perturbField,
    getEnergy: getFieldEnergy, getPhase, getLyapunov, getBasins,
    onPhaseTransition,
  } = useAssociativeField({ nodes: SPHERE_NODES, adj: SPHERE_ADJ });

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
    cellCount, getDivisionHistory,
  } = useMorphogenesis({ fieldRef, phaseRegime });

  // ── Spectral PCA Light (eigenvalue → visible wavelength) ──────────────
  const {
    spectralRef, stepSpectral, getNodeColor: getSpectralColor,
    getAmbientColor, getParticipationRatio, getEigenspectrum,
    getSpectralFlux, getPCDirections,
  } = useSpectralLight({ fieldRef, features: FEATURES, nodeCount: SPHERE_NODES.length });

  // ── Analogical Reasoning (SME-lite + Gestalt completion + Chimera) ──────
  const {
    reasoningRef, stepReasoning,
    getAnalogies, getFilaments, getGhostNodes, getCompletionQuality,
    getClusterSync, getChimeraZones, getNodeChimeraState,
  } = useAnalogicalReasoning({ fieldRef });

  // ── Analogical reasoning display state (throttled from RAF) ──────────
  const [analogyCount, setAnalogyCount] = useState(0);
  const [chimeraActive, setChimeraActive] = useState(false);
  const chimeraWitnessedRef = useRef(false); // observatory: witness the first chimera only
  const [gestaltQuality, setGestaltQuality] = useState(0);

  // ── Eco data modulations ──────────────────────────────────────────────
  const ecoModRef = useRef(new Float32Array(16));

  // ── Ecocide bus state — metabolicRift/exergyRate from EcocideTab WASM ────
  // Stored in ref so RAF draw loop can read without re-renders.
  // metabolicRift [0,1]: carbon overload → reddish tint on sphere background
  // exergyRate    [0,1]: energy dissipation → sphere pulse intensity
  const ecocideStateRef = useRef({ metabolicRift: 0, exergyRate: 0, phase: 'STABLE' });

  // Background state published to the GL layer each frame. Written from inside
  // the draw loop (never from render) so the backdrop is always the one that
  // belongs to the 2D frame being composited, not the next one.
  const bgStateRef = useRef({ rift: { r: 0, g: 0, b: 0, a: 0.72 } });
  // Projected ghost trails, xyzw per ghost. Written in place each frame so the
  // draw loop stays off the allocation path.
  const ghostBufRef = useRef(new Float32Array(GHOST_COUNT * 4));

  // ── Beat clock state ────────────────────────────────────────────────────
  const [ambientMode,  setAmbientMode]  = useState(false);
  const ambientModeRef = useRef(false);
  const beatPhaseRef   = useRef(0);     // 1 = just fired, decays toward 0 per frame
  const beatClockRef   = useRef(null);
  if (beatClockRef.current === null) {
    beatClockRef.current = createBeatClock({
      onBeat: () => { beatPhaseRef.current = 1.0; },
    });
  }

  // ── Beat clock: stop on unmount (tab switch) ─────────────────────────────
  useEffect(() => {
    return () => {
      beatClockRef.current?.stop();
    };
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

  // ── Visitor as Perturbation ─────────────────────────────────────────────
  const { entropyRef, stepEntropy } = useVisitorEntropy({ hoveredRef, dragRef });

  // ── Bifurcation Conductor + Collective Perturbation ───────────────────
  const { stateRef: collectiveRef, setConductor, feedPeerEntropy, stepCollectiveR } = useCollectiveR();
  const peerCursorEntropyRef = useRef(0);  // aggregate peer cursor movement, fed each frame

  // ── Temporal Archaeology (initial positions ref, populated async) ────────
  const initialPositionsRef = useRef(null);

  // Dynamic cross-cluster edges — computed by spectral_bridge kernel, or default
  // Bone fusion edges + manual fusions are merged in when available
  const activeEdges = useMemo(() => {
    const base = !spectralBridges?.bridges?.length
      ? [...SPHERE_EDGES]
      : [...SPHERE_EDGES, ...spectralBridges.bridges
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
    const neighbors = SPHERE_ADJ[selectedNode] ?? [];
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
  } = useSomaGraph({ nodes: SPHERE_NODES, adj: SPHERE_ADJ, modulationRef: entropyRef, initialPositionsRef });

  // ── Temporal Archaeology (IndexedDB persistence of sphere state) ──────
  const { archaeologyRef } = useTemporalArchaeology({ stateRef, fieldRef, entropyRef });

  // Populate initialPositionsRef from archaeology when loaded
  useEffect(() => {
    const check = () => {
      const arch = archaeologyRef.current;
      if (arch?.loaded && arch.ghostPositions) {
        initialPositionsRef.current = arch.ghostPositions;
      }
    };
    check();
    // Poll briefly in case async IDB load finishes after mount
    const timer = setInterval(check, 200);
    setTimeout(() => clearInterval(timer), 3000);
    return () => clearInterval(timer);
  }, [archaeologyRef]);

  const {
    edgeStateRef, stepEdges, applyAttractor: applyEdgeAttractor,
  } = useKineticEdges({ edges: activeEdges, nodes: SPHERE_NODES });

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
    const degree   = node ? (SPHERE_ADJ[node.id]?.length ?? 1) : 2;
    const maxLife  = opts.soft ? 120 : Math.min(300, 140 + degree * 18);
    const intensity = opts.soft ? 0.55 : Math.min(1.0, 0.55 + degree * 0.07);

    // Core neighborhood
    const localIds = node
      ? [...new Set([node.id, ...(SPHERE_ADJ[node.id] ?? [])])]
      : SPHERE_NODES.slice(0, 5).map(n => n.id);

    // Cross-cluster bridges: pick 1-2 nodes from other clusters for sacred geometry
    if (node && !opts.soft) {
      const otherClusters = [...new Set(
        SPHERE_NODES.filter(n => n.cluster !== node.cluster).map(n => n.cluster)
      )];
      // One bridge per foreign cluster, up to 2
      for (const cl of otherClusters.slice(0, 2)) {
        const bridge = SPHERE_NODES.find(n => n.cluster === cl && !localIds.includes(n.id));
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

    if (node) { fireNode(node.id); }
  }, [fireNode]);

  const handleRunKernel = useCallback((alias) => {
    spawnEffect(alias);
    if (onRunKernel) onRunKernel(alias);
  }, [spawnEffect, onRunKernel]);

  const handleTermSubmit = useCallback((e) => {
    e.preventDefault();
    // Sanitize: only word chars, spaces, dashes — no shell metacharacters
    const raw = termInput.trim().replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 80);
    if (!raw) return;

    // ── Query projection: `query <text>` maps text → 16D and ranks nodes ──
    if (raw.startsWith('query ')) {
      const qText = raw.slice(6).trim();
      if (qText) {
        const result = queryProject(qText);
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
    SPHERE_NODES.forEach(n => { degreeMap[n.id] = 0; });
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
    emitObs('gaze', 'art_bifurcation', { count: spawned.length });
  }, [activeEdges, triggerBifurcation]);

  // ── Push incoming attractor data ─────────────────────────────────────────
  useEffect(() => {
    if (!associativeField) return;
    applyAttractor(associativeField);
    applyEdgeAttractor(associativeField, SPHERE_NODES, triggerOverwrite);
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
        // Cap at 1.5× on high-DPR mobile (iPad Pro = 2×) to preserve battery
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
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
      // ── Always re-schedule first so an exception never kills the loop ──────
      rafRef.current = requestAnimationFrame(draw);
      const s  = stateRef.current;
      const es = edgeStateRef.current;
      if (!s) return;
      try {

      const { nodes } = s;
      const { w, h }  = dimsRef.current;
      // Sphere breath: subtle radius oscillation
      const aw = awakeningRef.current;
      const breathAmp = aw.phase < 3 ? 0.015 : 0.008;
      const breathMod = 1 + Math.sin(aw.breathPhase) * breathAmp;
      const sphereR   = Math.min(w, h) * SPHERE_K * breathMod;
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
      stepEntropy();

      // ── Visitor entropy → Hopfield r acceleration (scroll channel) ─────────
      if (fieldRef.current && entropyRef.current) {
        const scrollPush = entropyRef.current[0];  // CH_SCROLL
        if (scrollPush > 0.01) {
          fieldRef.current.r = Math.min(3.999, fieldRef.current.r + scrollPush * 0.003);
        }
      }

      // ── Bifurcation Conductor + Collective Perturbation ──────────────────
      feedPeerEntropy(somaPresence.peerCount, peerCursorEntropyRef.current);
      stepCollectiveR(fieldRef);

      // ── Broadcast cursor to peers (rotation-derived, throttled internally) ──
      if (somaPresence.connected) {
        const rx = rotRef.current.rx, ry = rotRef.current.ry;
        somaPresence.sendCursor(Math.sin(ry), Math.sin(rx), Math.cos(ry));
      }

      // ── Jury Awakening state machine (logic in artAwakening.js) ──────────
      const awakeningFires = stepAwakening(aw, nodes, particleFrameRef.current, particlesRef.current);
      for (const n of awakeningFires) {
        fireNode(n.id);
        spawnEffect(n.id, { soft: true });
        const nbs = new Set(ADJ[n.id] ?? []);
        nbs.add(n.id);
        firedRef.current = { seedId: n.id, neighborIds: nbs, t0: performance.now() };
        const idx_ = NODE_IDX[n.id];
        if (idx_ != null) perturbField(idx_);
      }

      // ── Throttled reasoning state push (every ~60 frames ≈ 2s) ──────────
      if (particleFrameRef.current % 60 === 0) {
        const _ac = getAnalogies().length;
        const _cz = getChimeraZones().length > 0;
        const _gq = getCompletionQuality();
        setAnalogyCount(_ac);
        setChimeraActive(_cz);
        if (_cz && !chimeraWitnessedRef.current) {
          chimeraWitnessedRef.current = true;
          emitObs('gaze', 'art_chimera', {});
        }
        setGestaltQuality(_gq);
      }

      // ── Apply Hopfield activations to node energies ──────────────────────
      // activations array is indexed by the full NODES (272) positions,
      // so look up each sim node's global index via NODE_IDX.
      if (fieldRef.current) {
        const acts = fieldRef.current.activations;
        for (const n of nodes) {
          const gi = NODE_IDX[n.id];
          if (gi != null && gi < acts.length) {
            n.energy = Math.max(n.energy, acts[gi] * 0.6);
          }
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
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Ecocide tint: metabolicRift bleeds a faint crimson into the void.
      // The tint itself now lives on the GPU (SphereBackground) — this canvas
      // no longer paints a backdrop, it erases alpha so the backdrop shows
      // through. Fading toward a GL layer of colour K by alpha A is identical
      // to filling with K at alpha A, which is what makes this a port and not
      // a re-art; the equivalence is derived in SphereBackground.jsx.
      const { metabolicRift, exergyRate } = ecocideStateRef.current;
      const tint = riftTint(metabolicRift, immersiveRef.current);
      bgStateRef.current.rift = tint;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0,0,0,${tint.a})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      // Exergy pulse and genesis glow are both on the GPU now
      // (SphereBackground.js); only their state is computed here.
      bgStateRef.current.exergy = exergyAlpha(exergyRate);
      bgStateRef.current.genesis = genesisGlowState(aw.phase, aw.t0, sphereR, performance.now());

      // ── State-driven flash — brief anthracite grid on bifurcation events ──
      // The hex grid is on the GPU (SphereBackground.js); the decay stays here.
      // Note it draws with the PRE-decay value, unlike the beat pulse which
      // decays first — preserved, since it makes the first flash frame a step
      // brighter than a post-decay reading would be.
      if (bgFlashRef.current > FLASH_CUTOFF) {
        bgStateRef.current.flash = bgFlashRef.current * FLASH_ALPHA;
        bgFlashRef.current = stepFlash(bgFlashRef.current);
      } else {
        bgStateRef.current.flash = 0;
      }

      // ── Spectral ambient — immersive mode only, otherwise pure black ────
      // On the GPU now. Only the alpha channel of the ambient colour is read,
      // exactly as before — the hue never reached the canvas.
      const _ambient = immersiveRef.current ? getAmbientColor() : null;
      bgStateRef.current.ambient = _ambient ? ambientIntensity(_ambient[3]) : 0;

      // ── Sphere wireframe ghost ────────────────────────────────────────────
      // Now on the GPU (SphereBackground.js). It renders beneath this canvas,
      // which also puts it beneath the four fainter background layers still
      // drawn here — see the migration-order note in that file.
      bgStateRef.current.sphereR = sphereR;
      bgStateRef.current.rot = { rx: rotRef.current.rx, ry: rotRef.current.ry };

      // ── Ambient beat pulse glow ───────────────────────────────────────────
      // Drawn on the GPU (SphereBackground.js); the decay stays here because
      // it is simulation state, not painting. Note the decay runs only while
      // the pulse is audible-loud enough to draw — preserved exactly, since
      // stepping it unconditionally would change the pulse's length.
      if (beatPhaseRef.current > 0.005) {
        beatPhaseRef.current *= 0.88;   // 42 frames to silence, ~700ms at 60fps
        bgStateRef.current.beat = beatPhaseRef.current;
      } else {
        bgStateRef.current.beat = 0;
      }

      // ── Temporal archaeology: ghost trails from previous session ──────────
      // Drawn on the GPU, but PROJECTED HERE. 31 points is a trivial upload,
      // and moving projection into the shader is the one change that would
      // render identically while killing every hit-test on the sphere.
      const arch = archaeologyRef.current;
      const gbuf = ghostBufRef.current;
      let gn = 0;
      if (arch?.loaded && arch.ghostPositions) {
        const gp = arch.ghostPositions;
        for (let i = 0; i < GHOST_COUNT && i * 3 + 2 < gp.length; i++) {
          const [grx, gry, grz] = applyM(M, gp[i * 3], gp[i * 3 + 1], gp[i * 3 + 2]);
          if (grz < GHOST_CULL_Z) continue;  // back-face cull
          const gp2 = project(grx, gry, grz, w, h, sphereR, focal);
          const o = gn * 4;
          gbuf[o]     = gp2.sx;
          gbuf[o + 1] = gp2.sy;
          gbuf[o + 2] = GHOST_RADIUS * gp2.scale;
          gbuf[o + 3] = ghostTrailAlpha(grz);
          gn++;
        }
      }
      for (let i = gn; i < GHOST_COUNT; i++) gbuf[i * 4 + 3] = 0;  // clear the tail
      bgStateRef.current.ghosts = gbuf;

      // ── Cluster ghost labels (projected anchor positions) ─────────────────
      const nextLabels = [];
      Object.entries(CLUSTER_ANCHORS).forEach(([key, a]) => {
        const [rx, ry, rz] = applyM(M, a.x, a.y, a.z);
        const p = project(rx, ry, rz, w, h, sphereR, focal);
        const st = clusterLabelState({ rz, projected: p, text: CLUSTERS[key].label });
        if (!st) return;
        nextLabels.push({
          key: `cluster:${key}`, ...st,
          color: hslAlpha(CLUSTER_COLORS[key], 1),
        });
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
          if (!pA || !pB) continue;   // dynamic node not yet projected this frame
          if (!isFinite(pA.sx) || !isFinite(pA.sy) || !isFinite(pB.sx) || !isFinite(pB.sy)) continue; // guard non-finite projection coords
          const colA = NODE_COLORS[e.aId] ?? dynColorMap.get(e.aId);
          const colB = NODE_COLORS[e.bId] ?? dynColorMap.get(e.bId);

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
          if (!pRA || !pRB) { /* dynamic node not yet projected — skip */ } else
          if (!isFinite(pRA.sx) || !isFinite(pRA.sy) || !isFinite(pRB.sx) || !isFinite(pRB.sy)) { /* non-finite coords — skip */ } else {
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
        } // else — close proj guard
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
      const _resNodes = resonanceNodesRef.current;
      const _resActive = resonanceModeRef.current && _resNodes.length > 0;
      const _resNodeSet = _resActive ? new Set(_resNodes) : null;
      const _spectralFlux = getSpectralFlux();
      for (const i of sortedNodeIdx) {
        const n   = nodes[i];
        // Dynamic nodes (bifurcation children) fall back to dynColorMap
        const col = NODE_COLORS[n.id] ?? dynColorMap.get(n.id);
        if (!col) continue;   // no color registered yet → skip this frame

        // ── Birth animation: ease child from parent position over 400ms ──────
        // Uses cubic-bezier ease-out: 1 - (1-t)³ — matches CSS ease-out cubic
        let p = proj[i];
        if (!p) continue;   // dynamic node not yet projected this frame
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

        if (!isFinite(p.sx) || !isFinite(p.sy)) continue; // guard non-finite projection coords
        const isHov     = n.id === hov;
        const energy    = n.energy + (isHov ? 0.55 : 0);
        // Depth cuing: nodes on the back are smaller + dimmer
        let depthAlpha = Math.max(0.08, (p.depth + 1) * 0.5);

        // ── Resonance dimming: non-selected nodes → 10% opacity ──────────────
        const _isResNode = _resActive && _resNodeSet.has(n.id);
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
          const flux = _spectralFlux;
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

        // ── Awakening beacon ring (logic in artAwakening.js) ──────────────
        drawBeaconRing(ctx, aw, i, p, radius, renderCol, depthAlpha, nodes.length);

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

        // ── Label rendering — state only; SphereLabels draws it ────────────
        const fired = firedRef.current;
        const elapsed = fired ? (performance.now() - fired.t0) / 1000 : 0;
        if (fired && fireExpired(elapsed)) firedRef.current = null;

        const st = nodeLabelState({
          node: n, projected: p, index: i, isHovered: isHov,
          fired, elapsed, depthAlpha, radius,
        });
        if (st) {
          nextLabels.push({
            key: `node:${n.id}`, ...st,
            color: hslAlpha(renderCol, 1),
          });
        }
      }

      // ── Manual fusion: pending targeting line + source pulse ring ─────────
      const fSrc = fusionSourceRef.current;
      if (fSrc) {
        // Sphere space, not corpus space: `proj` and `nodes` are the live
        // sphere array. fusionSourceRef is set from nodeAt() hit-testing, which
        // returns sphere nodes, so this normally resolves.
        const si = sphereIndexOf(nodes, fSrc);
        if (si >= 0) {
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
      if (probe?.anchors?.length) {
        // Ranking spans all 272 corpus nodes; probe.anchors has already
        // collapsed the top matches onto sphere nodes (see SPHERE_ANCHOR), so
        // the centroid forms even when no match is on the sphere itself.
        let wx = 0, wy = 0, wz = 0, wsum = 0, wmax = 0;
        const tethers = [];
        for (const { id, weight } of probe.anchors) {
          const ni = sphereIndexOf(nodes, id);
          if (ni < 0) continue;
          wx += nodes[ni].x * weight;
          wy += nodes[ni].y * weight;
          wz += nodes[ni].z * weight;
          wsum += weight;
          if (weight > wmax) wmax = weight;
          tethers.push({ ni, weight });
        }
        if (wsum > 1e-12) {
          wx /= wsum; wy /= wsum; wz /= wsum;
          const len = Math.sqrt(wx * wx + wy * wy + wz * wz);
          if (len > 1e-12) { wx /= len; wy /= len; wz /= len; }
          const [prx, pry, prz] = applyM(M, wx, wy, wz);
          const pp = project(prx, pry, prz, w, h, sphereR, focal);
          const depthAlpha = Math.max(0.12, (prz + 1) * 0.5);
          // Tether lines to every anchor that formed the centroid
          ctx.setLineDash([3, 5]);
          for (const { ni, weight } of tethers) {
            const pn = proj[ni];
            ctx.lineWidth = 0.9;
            ctx.strokeStyle = `rgba(167,139,250,${(weight / wmax) * 0.55 * depthAlpha})`;
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
          if (glowR > 0 && isFinite(pp.sx) && isFinite(pp.sy)) {
            const gGrd = ctx.createRadialGradient(pp.sx, pp.sy, probeR * 0.3, pp.sx, pp.sy, glowR);
            gGrd.addColorStop(0, `rgba(167,139,250,${0.45 * depthAlpha})`);
            gGrd.addColorStop(1, 'rgba(167,139,250,0)');
            ctx.fillStyle = gGrd;
            ctx.beginPath();
            ctx.arc(pp.sx, pp.sy, glowR, 0, Math.PI * 2);
            ctx.fill();
          }
          // Core node
          ctx.beginPath();
          ctx.arc(pp.sx, pp.sy, probeR, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(196,181,253,${(0.75 + pulse * 0.25) * depthAlpha})`;
          ctx.fill();
          // Label
          const shortQ = probe.query.length > 22 ? probe.query.slice(0, 20) + '…' : probe.query;
          nextLabels.push({
            key: 'probe',
            text: `⊕ ${shortQ}`,
            x: pp.sx,
            y: pp.sy - probeR - 5,
            alpha: 0.88 * depthAlpha,
            fontSize: Math.round(9 * pp.scale),
            color: 'rgb(221,214,254)',
          });
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

      // ── Bifurcation Conductor (logic in artAwakening.js) ────────────────
      drawConductor(ctx, collectiveRef.current, conductorDragRef.current, w, h);

      // ── Bloom and vignette ────────────────────────────────────────────────
      // Both now happen on the GPU in SphereComposite, which takes this canvas
      // as a texture. The old version blurred a half-resolution copy with
      // ctx.filter and composited it back at 0.15 alpha, which is why it read
      // as a smear rather than as light. Bloom is now always on; the vignette
      // is still immersive-only.

      // ── Hand this frame's labels to the DOM overlay ───────────────────────
      labelsApiRef.current?.update(nextLabels);
      } catch (err) {
        console.error('[ArtTab] draw error (loop continues):', err);
      }

      // ── Composite ─────────────────────────────────────────────────────────
      // Outside the try on purpose: if the 2D draw threw part-way, we still
      // want the GL layer to present whatever did get drawn, exactly as the
      // browser would have. Inside the try it would be skipped along with
      // everything else after the throw.
      try {
        glAdvanceRef.current?.(performance.now());
      } catch (err) {
        console.error('[ArtTab] composite advance failed:', err);
      }
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

  // ── Dev-only harness hook ─────────────────────────────────────────────────
  // The visual-parity harness (scripts/artBaseline.mjs) has to boot the app under
  // REAL timing, because virtualising the clock from page load stops React
  // committing concurrent work and r3f then never mounts. But that means the
  // sphere's state at the moment the harness takes over — rotation, node
  // positions, particles — carries real-time history and differs run to run.
  //
  // This resets the sim to its mount-time state so the captured window is
  // reproducible. `import.meta.env.DEV` is statically false in a production
  // build, so the whole block is dead code the bundler removes.
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    window.__artHarnessReset = () => {
      rotRef.current = { rx: 0.18, ry: 0 };
      dragRef.current = { active: false, lastX: 0, lastY: 0, vx: 0, vy: 0 };
      particlesRef.current = createParticlePool();
      firedRef.current = null;
      fusionSourceRef.current = null;
      probeNodeRef.current = null;
      initState();
    };

    // Drives the ecocide bus state directly. Three background layers are
    // gated on inputs the capture set can never produce — the ecocide bus sits
    // at rate 0 throughout — so a green parity run proves nothing about them:
    // deleting the layer outright scores identically. This lets the smoke
    // tooling switch them on and check they actually draw. It writes the same
    // ref the real bus handler writes, so the whole path is exercised.
    window.__artSetEcocide = ({ metabolicRift, exergyRate } = {}) => {
      ecocideStateRef.current = {
        ...ecocideStateRef.current,
        metabolicRift: metabolicRift ?? ecocideStateRef.current.metabolicRift,
        exergyRate:    exergyRate    ?? ecocideStateRef.current.exergyRate,
      };
    };

    // Seeds last session's node positions. The ghost trails read them from
    // IndexedDB, which is empty in the harness's fresh profile, so that layer
    // is invisible to every capture — same problem as the ecocide-gated ones.
    // Passing no argument synthesises a ring, which is enough to prove the
    // layer draws and where.
    window.__artSetGhosts = (positions) => {
      const arch = archaeologyRef.current;
      if (!arch) return 0;
      if (positions === null) { arch.ghostPositions = null; arch.loaded = false; return 0; }
      const n = 31;
      const out = positions ?? Array.from({ length: n * 3 }, (_, i) => {
        const k = Math.floor(i / 3), a = (k / n) * Math.PI * 2;
        return [Math.cos(a), Math.sin(a), 0.6][i % 3];   // front-facing ring
      });
      arch.ghostPositions = new Float32Array(out);
      arch.loaded = true;
      return arch.ghostPositions.length;
    };

    // Reads back what the draw loop last published to the GL layer. Every
    // background layer is now a uniform rather than a canvas operation, so
    // when one does not appear the first question is whether the state ever
    // reached the shader — and pixels cannot answer that.
    window.__artBgState = () => {
      const s = bgStateRef.current, g = s.ghosts;
      let live = 0;
      if (g) for (let i = 0; i < g.length; i += 4) if (g[i + 3] > 0) live++;
      return {
        rift: s.rift, exergy: s.exergy, flash: s.flash, ambient: s.ambient,
        beat: s.beat, genesis: s.genesis, sphereR: s.sphereR,
        ghostsLive: live,
        ghostFirst: g ? Array.from(g.slice(0, 8)) : null,
        archLoaded: !!archaeologyRef.current?.loaded,
        archLen: archaeologyRef.current?.ghostPositions?.length ?? 0,
      };
    };

    return () => {
      delete window.__artHarnessReset;
      delete window.__artSetEcocide;
      delete window.__artSetGhosts;
      delete window.__artBgState;
    };
  }, [initState, archaeologyRef]);

  // SphereComposite hands its advance() over here once the GL root exists.
  const handleAdvanceReady = useCallback((advance) => {
    glAdvanceRef.current = advance;
  }, []);

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

  // ── Conductor hit-test helper ───────────────────────────────────────────
  const conductorDragRef = useRef(false);
  const conductorHit = useCallback((cx, cy) => {
    const { w, h } = dimsRef.current;
    const stripW = 3, stripX = w - 6;
    const stripY = h * 0.20, stripH = h * 0.60;
    // Generous hitbox: 18px padding — thin whisker needs a forgiving touch target
    if (cx >= stripX - 18 && cx <= stripX + stripW + 18 && cy >= stripY - 12 && cy <= stripY + stripH + 12) {
      // Return normalized 0 (bottom=stable) to 1 (top=chaos)
      return Math.max(0, Math.min(1, 1 - (cy - stripY) / stripH));
    }
    return null;
  }, []);

  // ── Mouse/touch handlers (ref-mutating — no React re-renders) ────────────
  const handleMouseDown = useCallback((e) => {
    const p = canvasCoords(e.clientX, e.clientY);
    if (p) {
      const cVal = conductorHit(p.x, p.y);
      if (cVal !== null) {
        conductorDragRef.current = true;
        setConductor(cVal);
        e.preventDefault();
        return;
      }
    }
    dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY, vx: 0, vy: 0 };
  }, [canvasCoords, conductorHit, setConductor]);

  const handleMouseMove = useCallback((e) => {
    // Conductor drag takes priority
    if (conductorDragRef.current) {
      const p = canvasCoords(e.clientX, e.clientY);
      if (p) {
        const { w, h } = dimsRef.current;
        const stripY = h * 0.20, stripH = h * 0.60;
        const cVal = Math.max(0, Math.min(1, 1 - (p.y - stripY) / stripH));
        setConductor(cVal);
      }
      return;
    }
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
  }, [canvasCoords, nodeAt, edgeAt, lockedEdge, setConductor]);

  const handleMouseUp = useCallback((e) => {
    // Release conductor if dragging
    if (conductorDragRef.current) {
      conductorDragRef.current = false;
      setConductor(null);  // spring-decay back
      return;
    }
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
            emitObs('gaze', 'art_resonance', {
              sim: result?.sim ?? null,
              nodeA: next[0], nodeB: next[1],
              topDim: result?.topDims?.[0]?.name ?? null,
            });
          } else {
            resonanceResultRef.current = null;
            setResonanceResult(null);
          }
          return;   // don't fire normal click in resonance mode
        }

        // ── Mark awakening as interacted (first-touch crescendo) ──────────
        if (!awakeningRef.current.interacted) {
          awakeningRef.current.interacted = true;
          awakeningRef.current.phase = 3;
          // First-touch crescendo: extra particle burst + energy surge
          const liveNode = stateRef.current?.nodes?.find(n => n.id === node.id);
          if (liveNode) {
            emitNodeBurst(particlesRef.current, liveNode.x, liveNode.y, liveNode.z,
              NODE_COLORS[node.id]?.hue ?? 30, (NODE_COLORS[node.id]?.hue ?? 30 + 180) % 360, 40);
          }
          // Energy pulse through all connected nodes
          const nbs_ = ADJ[node.id] ?? [];
          for (const nbId of nbs_) {
            const nb = stateRef.current?.nodes?.find(n => n.id === nbId);
            if (nb) nb.energy = Math.min(1, nb.energy + 0.5);
          }
        }
        // Right-click is handled by contextmenu (fusion state machine) — ignore here
        fireNode(node.id);
        // Perturb Hopfield field — genuine associative activation propagation
        const nodeIdx_ = NODE_IDX[node.id];
        if (nodeIdx_ != null) perturbField(nodeIdx_);
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
        {
          const selIdx  = NODE_IDX[node.id];
          const selFeat = selIdx != null ? FEATURES[selIdx] : null;
          const selTopDim = selFeat
            ? DIM_NAMES.map((nm, i) => ({ name: nm, v: selFeat[i] })).sort((a, b) => b.v - a.v)[0]
            : null;
          emitObs('gaze', 'art_node_selected', {
            nodeId: node.id, cluster: node.cluster ?? null,
            topDim: selTopDim?.name ?? null,
          });
        }
      }
    }
  }, [canvasCoords, nodeAt, edgeAt, fireNode, spawnEffect, onCueNode, onRunKernel, setConductor]);

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
    if (conductorDragRef.current) { conductorDragRef.current = false; setConductor(null); }
    dragRef.current.active = false;
    hoveredRef.current = null;
    clearTimeout(edgeDebounceRef.current);
    clearTimeout(tooltipTimerRef.current);
    setHoveredTooltip(null);
    setHoveredEdge(null);
    setLockedEdge(null);
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
  }, [setConductor]);

  const handleTouchStart = useCallback((e) => {
    const t = e.touches[0];
    if (!t) return;
    // Conductor strip intercept
    const pCond = canvasCoords(t.clientX, t.clientY);
    if (pCond) {
      const cVal = conductorHit(pCond.x, pCond.y);
      if (cVal !== null) {
        conductorDragRef.current = true;
        setConductor(cVal);
        e.preventDefault();
        return;
      }
    }
    dragRef.current = { active: true, lastX: t.clientX, lastY: t.clientY, vx: 0, vy: 0, startX: t.clientX, startY: t.clientY };
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
  }, [canvasCoords, nodeAt, onManualFusion, conductorHit, setConductor]);

  const handleTouchMove = useCallback((e) => {
    clearTimeout(longPressRef.current);
    // Conductor drag — always vertical-intentional, always claims the gesture
    if (conductorDragRef.current) {
      e.preventDefault();
      const t = e.touches[0];
      if (t) {
        const p = canvasCoords(t.clientX, t.clientY);
        if (p) {
          const { h } = dimsRef.current;
          const stripY = h * 0.20, stripH = h * 0.60;
          setConductor(Math.max(0, Math.min(1, 1 - (p.y - stripY) / stripH)));
        }
      }
      return;
    }
    const t    = e.touches[0];
    const drag = dragRef.current;
    if (!t || !drag.active) return;
    const dx = t.clientX - drag.lastX;
    const dy = t.clientY - drag.lastY;

    // Direction lock: decide once per gesture whether this is a page-scroll
    // swipe (mostly vertical) or a sphere-rotation drag (mostly horizontal).
    // The canvas has touch-action:none so the browser will NEVER natively
    // scroll a touch that started on it, no matter what we do here — on a
    // viewport where the sphere fills the screen (iPad) that traps the user
    // with zero reachable non-canvas pixels to scroll from. So a vertical
    // gesture is forwarded to the scroll container manually instead of
    // rotating the sphere.
    if (drag.locked == null) {
      const tdx = t.clientX - drag.startX;
      const tdy = t.clientY - drag.startY;
      if (Math.abs(tdx) + Math.abs(tdy) < 6) return; // not enough movement to classify yet
      drag.locked = Math.abs(tdy) > Math.abs(tdx) ? 'scroll' : 'rotate';
    }

    if (drag.locked === 'scroll') {
      const scroller = getScrollParent(canvasRef.current);
      if (scroller) scroller.scrollTop -= dy;
      drag.lastX = t.clientX;
      drag.lastY = t.clientY;
      return; // let the page scroll — do not rotate, do not preventDefault
    }

    e.preventDefault();
    rotRef.current.rx += dy * 0.005;
    rotRef.current.ry += dx * 0.005;
    drag.vx     = dy * 0.005;
    drag.vy     = dx * 0.005;
    drag.lastX  = t.clientX;
    drag.lastY  = t.clientY;
  }, [canvasCoords, setConductor]);

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault();  // prevent synthesized mousemove/mousedown/mouseup cascade on iOS/Android
    clearTimeout(longPressRef.current);
    // Release conductor
    if (conductorDragRef.current) { conductorDragRef.current = false; setConductor(null); return; }
    dragRef.current.active = false;
    const t = e.changedTouches[0];
    if (!t) return;
    // Skip node fire if this was a drag (movement > 8px)
    const tdx = t.clientX - (dragRef.current.startX ?? t.clientX);
    const tdy = t.clientY - (dragRef.current.startY ?? t.clientY);
    if (Math.abs(tdx) > 8 || Math.abs(tdy) > 8) return;
    const p    = canvasCoords(t.clientX, t.clientY);
    if (!p) return;
    const node = nodeAt(p.x, p.y);
    if (!node) return;
    // ── Mark awakening as interacted (touch) ──────────────────────────
    if (!awakeningRef.current.interacted) {
      awakeningRef.current.interacted = true;
      awakeningRef.current.phase = 3;
      const liveNode = stateRef.current?.nodes?.find(n => n.id === node.id);
      if (liveNode) {
        emitNodeBurst(particlesRef.current, liveNode.x, liveNode.y, liveNode.z,
          NODE_COLORS[node.id]?.hue ?? 30, (NODE_COLORS[node.id]?.hue ?? 30 + 180) % 360, 40);
      }
    }
    fireNode(node.id);
    // Perturb Hopfield field from touch
    const _touchIdx = NODE_IDX[node.id];
    if (_touchIdx != null) perturbField(_touchIdx);
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
  }, [canvasCoords, nodeAt, fireNode, spawnEffect, onCueNode, perturbField, setConductor]);

  // ── Non-passive touch listeners on canvas ────────────────────────────────
  // React 19 attaches delegated events at root level; browsers may treat them
  // as passive, making e.preventDefault() inside synthetic handlers a no-op.
  // Registering { passive: false } directly on the canvas guarantees that:
  //   1. touchmove scroll is suppressed while dragging the sphere
  //   2. touchend e.preventDefault() actually blocks iOS/Android synthetic
  //      mousemove→mousedown→mouseup→click cascade that double-fires nodes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove',  handleTouchMove,  { passive: false });
    canvas.addEventListener('touchend',   handleTouchEnd,   { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove',  handleTouchMove);
      canvas.removeEventListener('touchend',   handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

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

  // ── Phase transition callback — drives topology ─────────────────────────
  useEffect(() => {
    onPhaseTransition.current = (event) => {
      setPhaseRegime(event.to);
      setPhaseR(event.r);
      setPhaseLyap(event.lyapunov);
      // Quintessence witness (chaos spec §3) — the sphere's cascade testifies
      emitObs('gaze', 'art_regime', { r: event.r, lyapunov: event.lyapunov, regime: event.to });
      // State-driven flash — the void acknowledges the transition
      bgFlashRef.current = event.to === 'CHAOS' ? 1.0 : 0.6;
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

  // ── EcocideBus subscription — live metabolic/exergy from EcocideTab ──────
  // When EcocideTab is mounted in the same session, it emits ECOCIDE_PHASE
  // events on each WASM tick. We modulate sphere tint + pulse from these.
  useEffect(() => {
    const handler = ({ type, phase, metabolicRift, exergyRate }) => {
      if (type !== 'ECOCIDE_PHASE') return;
      ecocideStateRef.current = {
        phase:         phase         ?? 'STABLE',
        metabolicRift: metabolicRift ?? 0,
        exergyRate:    exergyRate    ?? 0,
      };
    };
    const unsub = ecocideBus.on(handler);
    return unsub;
  }, []);

  // ── ColliderBus subscription — chimera injection from Scaling tab ─────
  // When the Latent Space Collider synthesizes a chimera, it emits the result
  // here. We inject the chimera as a new node on the sphere, positioned between
  // its two parent nodes, with a blended 16D feature tensor.
  useEffect(() => {
    const handler = (data) => {
      if (data.type !== 'CHIMERA_SYNTHESIS') return;
      const s = stateRef.current;
      if (!s) return;

      const { parentNodeA, parentNodeB, cluster, chimeraName,
              cosine, novelty, coherence, viability, hueA, hueB } = data;

      // ── Derive chimera ID from the two parent domain names ────────
      const chiId = `chimera_${parentNodeA}_${parentNodeB}`;

      // Don't inject the same chimera twice in a session
      if (s.nodes.some(n => n.id === chiId)) {
        // Re-energize instead
        const existing = s.nodes.find(n => n.id === chiId);
        if (existing) { existing.energy = 1.0; existing.bleedAmount = 0.8; }
        return;
      }

      // ── Position: midpoint of parent nodes on sphere surface ──────
      const nodeA = s.nodes.find(n => n.id === parentNodeA);
      const nodeB = s.nodes.find(n => n.id === parentNodeB);
      const anchorA = nodeA ?? CLUSTER_ANCHORS[cluster] ?? CLUSTER_ANCHORS.phys;
      const anchorB = nodeB ?? CLUSTER_ANCHORS[cluster] ?? CLUSTER_ANCHORS.phys;
      const mx = (anchorA.x + anchorB.x) / 2 + (Math.random() - 0.5) * 0.1;
      const my = (anchorA.y + anchorB.y) / 2 + (Math.random() - 0.5) * 0.1;
      const mz = (anchorA.z + anchorB.z) / 2 + (Math.random() - 0.5) * 0.1;
      const len = Math.sqrt(mx * mx + my * my + mz * mz) || 1;

      // ── Synthesize 16D feature tensor from parents ────────────────
      const iA = NODE_IDX[parentNodeA];
      const iB = NODE_IDX[parentNodeB];
      if (iA != null && iB != null) {
        const fA = FEATURES[iA];
        const fB = FEATURES[iB];
        // Weighted blend: novelty controls interpolation toward orthogonal projection
        const w = novelty; // high novelty → more of the orthogonal component
        const chiFeats = new Array(16);
        for (let i = 0; i < 16; i++) {
          const blend = (fA[i] + fB[i]) / 2;
          const ortho = Math.abs(fA[i] - fB[i]);
          chiFeats[i] = Math.min(1, blend * (1 - w * 0.4) + ortho * w * 0.6);
        }
        dynFeaturesMap.set(chiId, chiFeats);
      }

      // ── Color: blend of the two domain hues ───────────────────────
      const chiColor = nodeColor(chiId, cluster);
      dynColorMap.set(chiId, chiColor);

      // ── Inject node into physics simulation ───────────────────────
      s.nodes.push({
        id:          chiId,
        cluster,
        x: mx / len, y: my / len, z: mz / len,
        vx: 0, vy: 0, vz: 0,
        energy:      1.0,          // full birth flash
        bleedFrom:   parentNodeA,  // bleeds parent A color initially
        bleedAmount: 0.9,
      });

      // Register birth animation
      birthMapRef.current.set(chiId, {
        parentId: parentNodeA,
        px: anchorA.x, py: anchorA.y, pz: anchorA.z,
        t0: performance.now(),
      });

      setBifurcCount(c => c + 1);
      emitObs('gaze', 'art_bifurcation', { count: 1 });
    };

    const unsub = colliderBus.on(handler);
    return unsub;
  }, []);

  // ── Presence — peer count updater + collective cursor entropy ──────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (somaPresence.connected) setPeerCount(somaPresence.peerCount);
    }, 2000);

    // Track peer cursor movement for collective perturbation
    const prevCursors = new Map();  // userId → {x,y,z}
    somaPresence.onPeerCursor = (userId, x, y, z) => {
      const prev = prevCursors.get(userId);
      if (prev) {
        const dx = x - prev.x, dy = y - prev.y, dz = z - prev.z;
        const movement = Math.sqrt(dx * dx + dy * dy + dz * dz);
        // Accumulate into entropy ref (EMA-smoothed in the hook)
        peerCursorEntropyRef.current = Math.min(1,
          peerCursorEntropyRef.current + movement * 0.5);
      }
      prevCursors.set(userId, { x, y, z });
    };
    somaPresence.onPeerLeave = (userId) => {
      prevCursors.delete(userId);
    };

    // Decay peer cursor entropy when no updates arrive
    const decayInterval = setInterval(() => {
      peerCursorEntropyRef.current *= 0.92;
    }, 200);

    return () => {
      clearInterval(interval);
      clearInterval(decayInterval);
      somaPresence.onPeerCursor = null;
      somaPresence.onPeerLeave = null;
    };
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
      // 'R' toggles temporal recording
      if (e.key === 'r' || e.key === 'R') {
        const wasRecording = tmIsRecording.current;
        tmIsRecording.current = !wasRecording;
        setRecording(!wasRecording);
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
    <div className="tab-fade-v2">

      <style>{`
        @keyframes at-shimmer {
          0%,100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        @keyframes at-feigReveal {
          0%   { opacity: 0; filter: brightness(4) blur(8px); letter-spacing: 0.5em; }
          25%  { opacity: 1; filter: brightness(2.8) blur(2px); letter-spacing: 0.2em; }
          55%  { opacity: 0.65; filter: brightness(3.2) blur(0px); letter-spacing: 0.06em; }
          78%  { opacity: 1; filter: brightness(1.5) blur(0px); letter-spacing: 0.02em; }
          100% { opacity: 1; filter: brightness(1) blur(0px); letter-spacing: normal; }
        }
        @keyframes at-feigGlow {
          0%, 100% { text-shadow: 0 0 8px rgba(255,215,0,0.2), 0 0 20px rgba(255,215,0,0); }
          50%      { text-shadow: 0 0 12px rgba(255,215,0,0.45), 0 0 32px rgba(217,70,239,0.2); }
        }
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
              clearTimeout(feigSparkTimer.current);
              el.style.animation = 'none';
              void el.offsetWidth;
              el.style.animation = 'at-feigSpark 0.5s cubic-bezier(0.16,1,0.3,1) forwards';
              feigSparkTimer.current = setTimeout(() => { if (el) el.style.animation = ''; }, 550);
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
              <CascadeIcon
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
                    ? 'linear-gradient(90deg, #FFD700, #fff, #FFD700, #d946ef, #FFD700)'
                    : 'linear-gradient(90deg, #FF8C00, #FFD700, #8b5cf6, #d946ef, #FFD700, #FF8C00)',
                  backgroundSize: '400% auto',
                  animation: 'at-feigReveal 1s cubic-bezier(0.7,0,0.3,1) forwards, at-shimmer 3.5s cubic-bezier(0.7,0,0.3,1) 1s infinite, at-feigGlow 5s ease-in-out 1.2s infinite',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  color: 'transparent',
                  transition: 'background-image 0.4s ease',
                  ...(selectedNode === 'feigenbaum' ? { filter: 'brightness(1.8)', textShadow: '0 0 18px rgba(255,215,0,0.7), 0 0 40px rgba(255,215,0,0.3)' } : {}),
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
            {SPHERE_NODES.length + bifurcCount} nodes · {activeEdges.length} edges
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
          {/* Ambient beat mode — sphere breathes at 114 BPM */}
          <button
            onClick={() => {
              const next = !ambientModeRef.current;
              ambientModeRef.current = next;
              setAmbientMode(next);
              if (next) {
                beatClockRef.current.start();
              } else {
                beatClockRef.current.stop();
              }
            }}
            className="px-2 py-1 rounded-sm border transition-all duration-200"
            style={{
              borderColor: ambientMode ? 'rgba(251,191,36,0.6)' : 'rgba(255,140,0,0.2)',
              color:       ambientMode ? 'rgba(251,191,36,0.9)' : 'rgba(255,140,0,0.4)',
              background:  ambientMode ? 'rgba(251,191,36,0.06)' : 'transparent',
              textShadow:  ambientMode ? '0 0 8px rgba(251,191,36,0.5)' : 'none',
            }}
            title="Ambient beat mode — sphere breathes at 114 BPM (toggle to interact)"
          >
            <Radio className="w-3.5 h-3.5 inline" />
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
          style={{
            display: 'block', width: '100%', height: 'auto',
            cursor: 'grab', touchAction: 'none',
            position: 'relative', zIndex: 0,
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onContextMenu={handleContextMenu}
        />

        <SphereComposite
          sourceRef={canvasRef}
          immersive={immersive}
          onAdvanceReady={handleAdvanceReady}
          bgStateRef={bgStateRef}
        />

        <SphereLabels ref={labelsApiRef} />

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
              fontFamily: "'Geist Mono', ui-monospace, monospace",
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
            fontFamily: "'Geist Mono', ui-monospace, monospace",
            fontSize:   '10px',
            letterSpacing: '0.1em',
            whiteSpace: 'nowrap',
            minWidth:   '90px',
          }}>
            {lastCmd ? `↳ ${lastCmd}` : 'geometry_shell'}
          </span>
          <span style={{ color: 'rgba(255,215,0,0.7)', fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: '13px' }}>▸</span>
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
              fontFamily: "'Geist Mono', ui-monospace, monospace",
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
                &quot;{queryResult.query.slice(0, 55)}{queryResult.query.length > 55 ? '…' : ''}&quot;
              </span>
            </div>
            <button
              onClick={() => { probeNodeRef.current = null; setQueryResult(null); }}
              style={{ color: 'rgba(167,139,250,0.5)', fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: '10px', background: 'none', border: 'none', cursor: 'pointer' }}
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
                {n.anchor !== n.id && (
                  <span style={{ color: 'rgba(167,139,250,0.45)', fontSize: '9px' }}>
                    {`↦ ${SPHERE_LABEL[n.anchor] ?? n.anchor}`}
                  </span>
                )}
              </div>
            );
          })}
          <div className="mt-1.5" style={{ color: 'rgba(255,255,255,0.30)' }}>
            {'  [SPHERE PROBE] ⊕ :: '}
            <span style={{ color: 'rgba(196,181,253,0.85)' }}>
              {queryResult.anchors.map(a => a.label ?? a.id).join(' · ')}
            </span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.12)' }}>
            {'  ── matches off the sphere resolve to their nearest sphere node ↦ · type `clear query` to dismiss ──'}
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
        {`Feigenbaum sphere. ${SPHERE_NODES.length + bifurcCount} nodes, ${activeEdges.length} edges. `}
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
        {/* Twin cascade (chaos spec §4) — sphere r vs the trend-driven engine r.
          * Reads getSpine() at render: the tab remounts on every tab switch,
          * so the armed trend is always fresh. No subscription needed. */}
        {(() => {
          const trend   = getSpine().trend;
          const engineR = trend ? trendToPressure(trend.velocity) : null;
          const dr      = engineR != null ? phaseR - engineR : null;
          return (
            <div className="mt-1 flex gap-4 flex-wrap" style={{ color: 'rgba(255,255,255,0.45)' }}>
              <span>{'CASCADE ∷ sphere r='}<span style={{ color: 'rgba(255,215,0,0.85)' }}>{phaseR.toFixed(3)}</span></span>
              <span>{'engine r='}
                {engineR != null
                  ? <span style={{ color: 'rgba(212,168,42,0.9)' }}>{engineR.toFixed(3)}</span>
                  : <span style={{ color: 'rgba(255,255,255,0.25)' }}>∅ unwitnessed</span>}
              </span>
              {dr != null && (
                <span>{'Δr='}<span style={{ color: dr >= 0 ? 'rgba(239,68,68,0.9)' : 'rgba(34,197,94,0.8)' }}>
                  {(dr >= 0 ? '+' : '') + dr.toFixed(3)}
                </span></span>
              )}
              <span>{'r∞='}<span style={{ color: 'rgba(255,215,0,0.5)' }}>{R_CHAOS.toFixed(4)}</span></span>
            </div>
          );
        })()}
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

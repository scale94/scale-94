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
import { useSomaGraph, CLUSTER_ANCHORS, __initStateLog } from '../hooks/useSomaGraph';
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
import { artRandom, seedArtRandom, artRandomState, __streamProbe, ART_SEED } from '../art/artRandom.js';
import {
  particleAlpha, particleVisible, particleSize, particleGlowRadius,
  particleInFront, quantHue, quantAlpha,
  GLOW_STOPS, CORE_LIGHTNESS, CORE_ALPHA_SCALE, GLOW_OUTER_K, discInkCorrection,
  streakTail,
} from '../art/artParticleDraw.js';
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
import {
  buildRotMatrix, applyM, project, normalCanvasHeight, inkScale, stepAutoRotation,
} from '../art/artMath';
import { createBeatClock } from '../art/artBeatClock';
import { clusterLabelState, nodeLabelState, fireExpired } from '../art/artLabels';
import SphereLabels from '../art/SphereLabels';
import SphereComposite from '../art/SphereComposite';
import {
  createEdgeState, writeHsl, writeHslRgb, writeRgb255, packAlphas, packFlags,
  writeDisc, writePolyline, ADDITIVE_LAYER, EDGE_STRIDE, MAX_EDGES, MAX_ADDITIVE_EDGES,
} from '../art/SphereEdges';
import {
  createStrimerState, spawnStrimer, stepStrimer,
  STRIMER_STRIDE, PACKET_FRACTION, PROFILE_PACKET, PROFILE_RAIL, PROFILE_PING,
  HEAD_GAIN, HEAD_WIDTH, RAIL_GAIN, RAIL_WIDTH, PING_GAIN, PING_RADIUS,
  PHASE_TRAVEL,
} from '../art/artStrimer';
import { quadSegments, tessellateQuad, CURVE_MAX_SEGMENTS } from '../art/artCurve';
import {
  nodeEnergy, depthCueAlpha, resonanceDimmed, nodeRadius, coreAlpha,
  birthProgress, birthProject, bleedMix, spectralTint,
  coreIsOpaque, coreColorSource, lensStops,
  haloDraws, haloRadius, haloInnerRadius, haloAlpha, strokeAnnulus,
  chimeraSyncPulse, chimeraSyncAlpha, chimeraSyncRadius, CHIMERA_ALPHA_CUTOFF,
  chimeraFlickRate, chimeraFlickAlpha, chimeraFlickRadius, chimeraFlickHue,
  CHIMERA_SYNC_HSL, CHIMERA_SYNC_WIDTH,
  CHIMERA_FLICK_DASH, CHIMERA_FLICK_WIDTH, CHIMERA_FLICK_SAT, CHIMERA_FLICK_LIT,
  ghostDraws, ghostRadius, ghostOuterRadius, ghostAlpha, ghostSweepEncoded,
  GHOST_INNER_HSL, GHOST_OUTER_HSL, GHOST_INNER_WIDTH, GHOST_OUTER_WIDTH,
  GHOST_INNER_ALPHA_K, GHOST_OUTER_ALPHA_K,
  fusionPulse, fusionRingRadius, fusionRingAlpha, fusionThreadAlpha,
  probePulse, probeDepthAlpha, probeRadius, probeGlowRadius, probeGlowInnerRadius,
  probeCoreAlpha, probeTetherAlpha, probeCentroid,
  FUSION_RING_WIDTH, FUSION_RING_DASH, FUSION_THREAD_WIDTH, FUSION_THREAD_DASH,
  PROBE_TETHER_WIDTH, PROBE_TETHER_DASH, PROBE_GLOW_ALPHA,
  PROBE_GLOW_RGB, PROBE_CORE_RGB,
} from '../art/artNodes';
import {
  edgeStops, edgeLineWidth, orthoHue, orthoGlow, fusedGlow,
  pulseRingRadius, pulsePosition,
  resonanceGlow, resonanceWidths, resonanceStops, RESONANCE_DEFAULT_SIM,
  ORTHO_DASH, SPECTRAL_DASH,
  ORTHO_HUE_STEP_MID, ORTHO_HUE_STEP_END,
  ORTHO_ALPHA_BOOST, ORTHO_MID_ALPHA_BOOST,
  PULSE_ALPHA, PULSE_DRAW_CUTOFF,
  prismOffset, prismChordAlpha, prismGlowWidth, prismControl, prismSpokeHue,
  PRISM_SPECTRAL_FINE, PRISM_SPECTRAL_COARSE, PRISM_HUE_STEP,
  PRISM_SAT, PRISM_GLOW_LIT, PRISM_GLOW_ALPHA_K, PRISM_CORE_LIT, PRISM_CORE_W,
  PRISM_POLY_HUE_STEP, PRISM_POLY_LIT, PRISM_POLY_ALPHA_K, PRISM_POLY_W,
  PRISM_SPOKE_SAT, PRISM_SPOKE_LIT, PRISM_SPOKE_ALPHA_K, PRISM_SPOKE_W,
  arcControl,
  filamentDepthFade, filamentAlpha, filamentHue, filamentGlowWidth,
  FILAMENT_DEPTH_CUTOFF, FILAMENT_MIN_ALPHA, FILAMENT_CP_PULL, FILAMENT_DASH,
  FILAMENT_GLOW_SAT, FILAMENT_GLOW_LIT, FILAMENT_GLOW_ALPHA_K,
  FILAMENT_CORE_SAT, FILAMENT_CORE_LIT, FILAMENT_CORE_ALPHA_K, FILAMENT_CORE_W,
  FILAMENT_MAX_DRAWN,
  chimeraStrength, chimeraHue, chimeraFlicker, chimeraAlpha, chimeraWidth,
  chimeraDashOffset, CHIMERA_MIN_STRENGTH, CHIMERA_CP_PULL, CHIMERA_DASH,
  CHIMERA_SAT, CHIMERA_LIT, CHIMERA_MAX_ZONES,
  humPhase, humAxis, humGain, humWave, humGlowRadius,
  EDGE_TAPER_PX,
} from '../art/artEdges';
import {
  stepAwakening, resetAwakeningCadence, beaconRingState, conductorState, CONDUCTOR,
} from '../art/artAwakening';
import {
  createFrameClock, stepFrameClock, resetFrameClock,
  createRateGate, stepRateGate, resetRateGate, perFrameChance,
} from '../art/artRateGate';
import { compositeDpr, coarsePointer } from '../art/artComposite';
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

// Sector colors for 16-sector 256-node sphere (Scale 16.16)
const SECTOR_COLORS = {
  eco: '#22c55e', sync: '#3b82f6', phys: '#f59e0b', crypto: '#ef4444', drk: '#6b7280',
  phil: '#8b5cf6', math: '#06b6d4', chem: '#f97316', bio: '#10b981', hum: '#ec4899',
  ling: '#14b8a6', cogn: '#a855f7', aesth: '#e879f9', topo: '#0ea5e9', meta: '#fbbf24', synth: '#f43f5e',
  fsk: '#c0c0c0',
};
// The prism layer's packed flag word: no dash, no glow, not ortho. Constant for
// every one of its instances — a canvas shadow is set by ctx.shadowBlur and this
// block never sets one — so it is packed once at module load rather than ~74000
// times a frame. Through packFlags, not as a literal 0, so it cannot drift from
// the layout the shader unpacks.
const PRISM_FLAGS = packFlags(0, 0, 0, false, ADDITIVE_LAYER.glowQuant);

// The two orphan curve layers' flag words. Same story — constant per layer, so
// packed once — but these DO dash, and the period packed here is the one the
// dash phase must be reduced modulo (packFlags rounds it to an integer; both of
// these patterns are already integral, so nothing is lost, but the reduction
// still has to use THIS number and not the raw sum).
const FILAMENT_PERIOD = FILAMENT_DASH[0] + FILAMENT_DASH[1];   // 14
const CHIMERA_PERIOD  = CHIMERA_DASH[0] + CHIMERA_DASH[1];     // 10
const FILAMENT_FLAGS = packFlags(FILAMENT_PERIOD, FILAMENT_DASH[0], 0, false,
  ADDITIVE_LAYER.glowQuant);
const CHIMERA_FLAGS = packFlags(CHIMERA_PERIOD, CHIMERA_DASH[0], 0, false,
  ADDITIVE_LAYER.glowQuant);

// The node rings' flags, packed once for the same reason. Two are solid; the
// flicker ring's [3,4] is an ANGULAR dash — for a disc the shader walks
// r*theta at the band's MID radius, so the pattern stays in px of arc length
// and the dash boundaries come out radial, exactly as ctx.setLineDash draws
// them around a stroked circle.
const BEACON_FLAGS = packFlags(0, 0, 0, false, ADDITIVE_LAYER.glowQuant);
// Particles carry no dash and no shadow: the glow IS the gradient, not a
// `ctx.shadowBlur` shoulder, so the glow byte is 0. Quantised against the
// ADDITIVE layer's own step, like the beacon — passing the source-over default
// here would pack a byte the additive material reads at a different scale.
const PARTICLE_FLAGS = packFlags(0, 0, 0, false, ADDITIVE_LAYER.glowQuant);
const GHOST_FLAGS = packFlags(0, 0, 0, false, ADDITIVE_LAYER.glowQuant);
const CHIMERA_SYNC_FLAGS = packFlags(0, 0, 0);
const CHIMERA_FLICK_FLAGS = packFlags(
  CHIMERA_FLICK_DASH[0] + CHIMERA_FLICK_DASH[1], CHIMERA_FLICK_DASH[0], 0);

// The tail: the fusion ring, its cursor thread and the probe. Packed once,
// same as every layer above. The RING is an angular dash — [5,4] is period 9,
// duty 5, and for a disc the shader measures that in px of arc length at the
// band's mid radius. The thread and the tethers are ordinary straight-segment
// dashes, in px along the line, and the probe's own two discs are solid.
const FUSION_RING_FLAGS = packFlags(
  FUSION_RING_DASH[0] + FUSION_RING_DASH[1], FUSION_RING_DASH[0], 0);
const FUSION_THREAD_FLAGS = packFlags(
  FUSION_THREAD_DASH[0] + FUSION_THREAD_DASH[1], FUSION_THREAD_DASH[0], 0);
const PROBE_TETHER_FLAGS = packFlags(
  PROBE_TETHER_DASH[0] + PROBE_TETHER_DASH[1], PROBE_TETHER_DASH[0], 0);
const PROBE_FLAGS = packFlags(0, 0, 0);

// ── Bifurcation Conductor ───────────────────────────────────────────────────
// No dash and no glow on the thumb, track and fill bar; the peer-push disc is
// the one instance on this branch that carries a blur. The glow byte is
// quantised at 8 steps/px for the source-over mesh, so 4px lands exactly.
const CONDUCTOR_FLAGS = packFlags(0, 0, 0);
const CONDUCTOR_GLOW_FLAGS = packFlags(0, 0, CONDUCTOR.GLOW_BLUR);
// The track's '#666', as the unit rgb the shader wants. CONDUCTOR.TRACK_RGB is
// the byte triple that CSS literal means, and a test asserts the two agree
// rather than leaving the equivalence to a comment.
const CONDUCTOR_TRACK_RGB = Float32Array.from(CONDUCTOR.TRACK_RGB, (v) => v / 255);
// The fill bar is a STROKE, so its colour travels through writePolyline's rgb
// argument rather than writeDisc's hsl. One scratch triple, reused — this runs
// inside the draw loop and must not allocate per frame.
const _condRgb = new Float32Array(3);
const hslUnitRgb = (c) => { writeHslRgb(_condRgb, 0, c); return _condRgb; };

// Once per session, not once per frame: an overflowing frame overflows 60 times
// a second and would bury the console it is trying to be visible in.
let prismOverflowWarned = false;

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
  // Answered ONCE, at mount, for the same reason SphereComposite answers it
  // once: a device does not stop being a touch device mid-session, and
  // `matchMedia` allocates a MediaQueryList on every call — this is read from
  // inside the draw loop, so probing it per frame would be 60 allocations a
  // second to re-learn a constant.
  const coarseRef      = useRef(coarsePointer());
  // r3f's advance(), handed over by SphereComposite once its GL root exists.
  // Null until then, and null again after unmount — the draw loop must not
  // assume the composite is mounted.
  const glAdvanceRef   = useRef(null);
  // The seed is a REAL normal-mode geometry, not a round number: the first
  // rAF runs before the first ResizeObserver delivery, so a pair the resize
  // path could never produce would be drawn for a frame. 620 against a
  // normalCanvasHeight(900) of 580 made `inkScale` read 1.069 there — a 7%
  // ink over-scale in normal mode, where item 5b's whole claim is that it is
  // exactly 1. Derived from the same helper the observer uses, so the two
  // cannot drift and the invariant holds from the first frame.
  const dimsRef      = useRef({ w: 900, h: normalCanvasHeight(900) });
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

  // ── Disc-probe scratch (DEV) ──────────────────────────────────────────────
  // Synthetic disc/ring instances appended to the edge buffer, so the shader's
  // annulus, arc-sweep, angular-dash and radial-falloff branches can be
  // photographed BEFORE tasks 5-7 build three layers on top of them. Nothing
  // in the app writes this; it is null in every real frame.
  const discProbeRef = useRef(null);

  // ── Node-layer draw census ────────────────────────────────────────────────
  // One counter per node sub-layer, incremented at the draw call itself and
  // reset each frame, on the same precedent as `eg.rings`: a layer that never
  // draws during a capture scores perfect parity whether it ships or is
  // deleted, and pixels cannot tell those two apart. Eight of this block's
  // thirteen layers are in that position (see the step 5 pre-flight scan), so
  // before step 5 moves any of them, this is what says which ones a given
  // capture actually contained. Counting at the draw call rather than
  // re-deriving the conditions afterwards keeps it to ONE source of truth.
  const nodeCensusRef = useRef({
    nodes: 0, halo: 0, core: 0, coreHover: 0, beacon: 0,
    chimeraSync: 0, chimeraFlicker: 0, ghostInner: 0, ghostOuter: 0,
    birth: 0, bleed: 0, spectral: 0, resonanceDim: 0,
    fusionRing: 0, fusionThread: 0,
    probeTether: 0, probeHalo: 0, probeCore: 0,
    particleGlow: 0, particleCore: 0,
    conductorThumb: 0, conductorTrack: 0, conductorFill: 0, conductorGlow: 0,
  });

  // ── Conductor force overrides (DEV harness only) ──────────────────────────
  // The conductor is the last layer no capture state arms, and unlike the
  // others it cannot be forced by writing its own output: `conductorY` is
  // recomputed from fieldRef.current.r every frame by stepCollectiveR, and
  // `collectiveR` is recomputed from peerEntropy every frame by
  // feedPeerEntropy. So the override sits on that function's INPUTS and the
  // real sigmoid gate, EMA and MAX_CONTRIBUTION run from there — the same
  // principle as __artForceParticles setting hueTarget === hue.
  //
  // MEASURED, and it is why this hook has to exist: with peerCount 0 the gate
  // is sigmoid(0,3,1.5) = 0.0111, so collectiveR = entropy * 0.0111 * 0.0025
  // and reaching the 0.0003 push threshold would need an entropy of 10.8 on a
  // 0..1 channel. The peer-push glow is UNREACHABLE in a single browser at any
  // legal input, not merely unlikely.
  //
  // `conductorY` is deliberately NOT forceable. Its only input is the
  // Feigenbaum r, and moving r moves the graph — which would change the
  // capture's `world` hash and make the very comparison this probe exists to
  // serve meaningless. The probe reports the live value instead.
  const conductorForceRef = useRef(null);

  // ── Immersive Mode (fullscreen + vignette) ──────────────────────────────
  // Bloom is no longer immersive-only and no longer lives here: it is always on
  // and runs on the GPU in SphereComposite. Immersive gates the spectral
  // ambient, the rift alpha, the canvas height calculation and the vignette.
  // It no longer gates the Voronoi mesh — that layer is cut, see the draw loop.
  //
  // Immersive is an OPTION, not the default and not the exhibit mode (author,
  // 2026-08-11). The quintessence compilation happens on this tab in default
  // mode and needs the command line, HUD and controls that immersive hides, so
  // promoting immersive would cost a user who does not realise they must leave
  // it to compile. Default stays default.
  const [immersive, setImmersive]       = useState(false);
  const immersiveRef    = useRef(false);  // RAF-safe mirror

  // ── Jury Awakening (choreographed first-impression sequence) ────────────
  // Phase 0 (0-4s): Genesis cascade — nodes light up cluster by cluster
  // Phase 1 (4-8s): Beacon pulse — one node glows as invitation
  // Phase 2 (8s+):  Auto-ignition — system self-fires 3 nodes
  // Phase 3:        Complete — normal interaction mode
  // LAZY INITIALIZER, NOT AN EAGER ONE. React evaluates a `useRef({ ... })`
  // object literal on EVERY render and discards all but the first, so with the
  // eager form every render of this component silently took one draw from the
  // sphere's private stream via `beaconIdx`. MEASURED: on `immersive-off` the
  // ResizeObserver fires twice with no pumped frame between the callbacks, and
  // each callback ends in `initState()`, which re-scatters all 31 nodes from
  // 124 draws -- so whether one render landed in that gap decided the whole
  // second layout. 21 runs at 1520x900@2x produced exactly TWO worlds, never
  // three: `a0c3af39` on a gap of 125 draws (19 runs) and `280ffe40` on a gap
  // of 124 (2 runs). A switch with two positions, not a chaotic process.
  // Assigning under a null guard runs the body exactly once, at mount, which is
  // the one draw the artwork wants -- a CONSTANT would kill the beacon's
  // per-page-load randomness, which is visible intent in awakening phase 1.
  const awakeningRef = useRef(null);
  if (awakeningRef.current === null) awakeningRef.current = {
    phase: 0,
    t0: performance.now(),
    interacted: false,      // true after first user gesture on canvas
    autoFiredNodes: [],     // nodes auto-ignited during phase 2
    beaconIdx: Math.floor(artRandom() * SPHERE_NODES.length),  // random beacon node
    breathPhase: 0,         // continuous breath oscillation
  };
  // The genesis cascade's own clock and gate. Installed here rather than
  // inline so this and __artHarnessReset cannot drift apart: both call the
  // one function, which is what keeps a capture's opening frames reproducible.
  if (awakeningRef.current.genesisGate == null) resetAwakeningCadence(awakeningRef.current);
  // DEV-ONLY INSTRUMENT. It counted the draws the eager initializer above used
  // to take, and it is kept because it is now the EVIDENCE that they are gone:
  // it is what proved the fix render-INDEPENDENT rather than merely lucky. 28
  // recorded runs of the patched build produced one world and a gap of 124
  // every time, including runs that took no render across the gap where their
  // siblings took one -- the contrast that flipped the world before. It takes
  // no draw of its own and `import.meta.env.DEV` is statically false in a
  // production build.
  if (import.meta.env.DEV) __streamProbe.renders++;

  // ── Particle Ecology ────────────────────────────────────────────────────
  const particlesRef = useRef(createParticlePool());
  // ── Emission cadences, on the clock ───────────────────────────────────────
  //
  // This was `particleFrameRef`, a draw counter that five `% N === 0` gates
  // read. A draw counter is not a clock: every one of those cadences ran at 2x
  // on a 120Hz phone and 6x on his 360Hz QD-OLED, which is the /SCENT collider
  // defect and the same one the sphere's breath carried. See artRateGate.js.
  //
  // ONE clock is stepped per draw and its dt handed to every gate, so the five
  // can never disagree about when this frame is. Each gate keeps the literal it
  // shipped with; nothing here is re-derived into a per-second rate, so 60fps
  // is unchanged by construction.
  //
  // `reasoning` is PRIMED: it read the counter BEFORE the increment, so its
  // first draw saw 0 and fired immediately. The other four read it after.
  const particleClockRef = useRef(null);
  if (particleClockRef.current === null) particleClockRef.current = {
    clock:     createFrameClock(),
    reasoning: createRateGate(60, { primed: true }),  // throttled state push, 1s
    edge:      createRateGate(8),                     // edge energy particles
    filament:  createRateGate(12),                    // analogy filament trail
    idleA:     createRateGate(3),                     // idle ambient, fast beat
    idleB:     createRateGate(7),                     // idle ambient, slow beat
  };

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
    morphRef, stepMorphogenesis, getCells,
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
  //
  // Deliberately EMPTY. `rift` used to be seeded with a plausible-looking
  // `{ r:0, g:0, b:0, a:0.72 }`, and `.a` is no longer inert: it is the erase
  // strength that drives the GL trail fade (SphereComposite). A seeded 0.72 is
  // a guess at normal mode, so a sphere that mounts immersive would spend its
  // first frames fading at the wrong rate. Absent, the GL side falls back to a
  // wipe until the draw loop publishes the real tint, which is the one wrong
  // answer that cannot be mistaken for a right one.
  const bgStateRef = useRef({});
  // Projected ghost trails, xyzw per ghost. Written in place each frame so the
  // draw loop stays off the allocation path.
  const ghostBufRef = useRef(new Float32Array(GHOST_COUNT * 4));
  // The base edges, as instance data for the GL layer: 16 floats each, in the
  // depth-sorted order the draw loop already computed. Lazily initialised
  // rather than passed to useRef(), which would build and throw away a 64KB
  // buffer on every render of this component.
  const edgeGLRef = useRef(null);
  if (edgeGLRef.current === null) edgeGLRef.current = createEdgeState();
  // The ADDITIVE line layer, in the same 16-float layout: the resonance edge
  // and the prism geometry effects. A separate stream because `lighter` is a
  // different blend, not because it is a different kind of geometry — the mesh
  // it feeds is built from the same shader. `rings` goes unused here; sharing
  // the state factory keeps one allocation shape rather than a near-duplicate.
  //
  // Its capacity is ~72x the edge mesh's, and that is the prism layer: every
  // chord is a flattened quadratic, and the worst frame the sim can produce is
  // four concurrent eleven-node effects. See MAX_ADDITIVE_EDGES for the
  // arithmetic and for why this is a fixed preallocation rather than a buffer
  // that grows — the array IS the GPU-bound buffer's backing store.
  const addGLRef = useRef(null);
  if (addGLRef.current === null) addGLRef.current = createEdgeState(MAX_ADDITIVE_EDGES);
  // The strimer pool. Created in the render body like the edge states, so its
  // `.data` array exists before SphereComposite's factory first runs.
  const strimerRef = useRef(null);
  if (strimerRef.current === null) strimerRef.current = createStrimerState();
  // Prism scratch, allocated once: the tessellation's point list, the control
  // point, and writeHsl's rgb output. A full-strength frame runs the inner loop
  // ~74000 times and the draw loop stays off the allocation path.
  const prismPtsRef  = useRef(null);
  if (prismPtsRef.current === null) prismPtsRef.current = new Float32Array((CURVE_MAX_SEGMENTS + 1) * 2);
  const prismCtrlRef = useRef(null);
  if (prismCtrlRef.current === null) prismCtrlRef.current = new Float32Array(2);
  const prismRgbRef  = useRef(null);
  if (prismRgbRef.current === null) prismRgbRef.current = new Float32Array(3);

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
    const clusterHue = node ? (NODE_COLORS[node.id]?.hue ?? artRandom() * 360) : artRandom() * 360;
    const hueBase    = opts.hueOverride ?? clusterHue;
    const hueTarget  = opts.hueTarget   ?? (hueBase + (opts.rightClick ? 180 : 90) + artRandom() * 60) % 360;

    geomEffectsRef.current.push({
      id:        Date.now() + artRandom(),
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

    // `opts.strimer` says a wavefront is being spawned by the caller and will
    // deliver the neighbour bumps itself. Terminal `run` and the ambient
    // awakening fires do NOT pass it, so they keep the instant propagation
    // they have always had.
    if (node) { fireNode(node.id, { neighbours: !opts.strimer }); }
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
        : normalCanvasHeight(W);
      dimsRef.current = { w: W, h: H };
      if (canvasRef.current) {
        // The SAME helper the GL canvas uses (SphereComposite), not a second
        // copy of the rule: DPR_CAP's contract is that these two backing stores
        // agree texel-for-texel, and this used to be a hand-written
        // Math.min(dpr, 1.5) in two files that had to be kept in step by hand.
        const dpr = compositeDpr(window.devicePixelRatio, coarseRef.current);
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
    // No 2D context is taken any more: this loop no longer draws. It computes
    // state and writes instance buffers that the GL layer renders, and the
    // canvas element survives only as the pointer surface and the box SizeSync
    // measures. Asking for one would allocate a full-resolution backing store
    // for a surface nothing paints.

    const draw = () => {
      // ── Always re-schedule first so an exception never kills the loop ──────
      rafRef.current = requestAnimationFrame(draw);
      const s  = stateRef.current;
      const es = edgeStateRef.current;
      if (!s) return;
      try {

      // ── This frame's cadences ─────────────────────────────────────────────
      //
      // Stepped HERE, once, before anything reads them, and after the `!s`
      // guard above — which is exactly where `particleFrameRef.current++` sat
      // relative to that guard, so a draw that bails still advances nothing.
      //
      // Every gate is stepped UNCONDITIONALLY, and the branches below AND the
      // result with their own conditions rather than wrapping the step. A gate
      // advanced only while its branch is live is a different cadence: the
      // counter these replace ran whether or not anyone was looking. That is
      // the "gates belong in the alpha, not in the branch condition" rule the
      // /SCENT collider fix already paid for once.
      const _pc = particleClockRef.current;
      const _nowMs = performance.now();
      const _dtFrames = stepFrameClock(_pc.clock, _nowMs);
      const reasoningTick = stepRateGate(_pc.reasoning, _dtFrames);
      const edgeTick      = stepRateGate(_pc.edge,      _dtFrames);
      const filamentTick  = stepRateGate(_pc.filament,  _dtFrames);
      const idleTickA     = stepRateGate(_pc.idleA,     _dtFrames);
      const idleTickB     = stepRateGate(_pc.idleB,     _dtFrames);

      const { nodes } = s;
      const { w, h }  = dimsRef.current;
      // Sphere breath: subtle radius oscillation
      const aw = awakeningRef.current;
      const breathAmp = aw.phase < 3 ? 0.015 : 0.008;
      const breathMod = 1 + Math.sin(aw.breathPhase) * breathAmp;
      const sphereR   = Math.min(w, h) * SPHERE_K * breathMod;
      const focal     = sphereR * FOCAL_K;
      // ITEM 5b — the ink grows with the cage. `project()`'s scale is
      // independent of sphereR, so without this every line width and disc
      // radius keeps its normal-mode pixel size while the sphere itself
      // gets 1.4-1.7x bigger in immersive mode. Exactly 1 outside
      // immersive, so normal-mode pixels cannot move. See artMath.
      //
      // Applied to the INK ONLY, never to a position: `p.scale` also
      // carries label offsets and the birth interpolation, and it is
      // deliberately left alone. Every site below multiplies at the point
      // the number becomes a width or a radius.
      const ink       = inkScale(w, h);

      // ── Update rotation ───────────────────────────────────────────────────
      // On the CLOCK. This added AUTO_SPIN once per DRAW, so the whole artwork
      // turned at the display's refresh rate — MEASURED at 283fps, a full
      // revolution in 8.9s against the authored 41.9s, and ~7s on a 360Hz
      // panel. The flick inertia decayed per draw too, so a throw died roughly
      // six times too soon. Time dilation on hover (damp harder, barely spin,
      // so a node can be hit) lives inside stepAutoRotation with it.
      stepAutoRotation(rotRef.current, dragRef.current,
                       hoveredRef.current != null, _dtFrames);
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
      const _cf = conductorForceRef.current;
      feedPeerEntropy(_cf ? _cf.peerCount : somaPresence.peerCount,
                      _cf ? _cf.entropy : peerCursorEntropyRef.current);
      stepCollectiveR(fieldRef);

      // ── Broadcast cursor to peers (rotation-derived, throttled internally) ──
      if (somaPresence.connected) {
        const rx = rotRef.current.rx, ry = rotRef.current.ry;
        somaPresence.sendCursor(Math.sin(ry), Math.sin(rx), Math.cos(ry));
      }

      // ── Jury Awakening state machine (logic in artAwakening.js) ──────────
      const awakeningFires = stepAwakening(aw, nodes, particlesRef.current, _nowMs);
      for (const n of awakeningFires) {
        fireNode(n.id);
        spawnEffect(n.id, { soft: true });
        const nbs = new Set(ADJ[n.id] ?? []);
        nbs.add(n.id);
        firedRef.current = { seedId: n.id, neighborIds: nbs, t0: performance.now() };
        const idx_ = NODE_IDX[n.id];
        if (idx_ != null) perturbField(idx_);
      }

      // ── Throttled reasoning state push (every 60 authored frames = 1s) ──
      // The comment said "~60 frames ≈ 2s" and the arithmetic never supported
      // it: 60 frames at 60fps is ONE second. Left at 60 rather than "fixed" to
      // 120 — the interval that shipped is the interval that shipped, and this
      // commit moves no cadence on purpose.
      if (reasoningTick) {
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
      // The ECOLOGY is advanced on the same dt the cadences use, so emission
      // and decay cannot disagree about how long this frame was. While both
      // were per-draw they CANCELLED — 6x emission into a pool that also died
      // 6x faster kept the population roughly right and got only the tempo
      // wrong — so converting the emitters alone made the population fall.
      stepParticles(pool, _dtFrames);

      // Emit edge energy particles every 8 authored frames on high-energy edges
      if (es && edgeTick) {
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

      // Emit burst particles from high-energy nodes.
      //
      // The SEVENTH cadence of this family, and the one with no modulus to
      // grep for: this is a per-draw coin flip, so "every draw" was its rate
      // and it fired 4.5x too often at the 270fps a headless capture reaches.
      // What scales is the PROBABILITY, not a schedule — see perFrameChance,
      // which returns exactly 0.15 at 60fps so the literal below still reads as
      // the authored one.
      for (const n of nodes) {
        if (n.energy > 0.7 && artRandom() < perFrameChance(0.15, _dtFrames)) {
          const col = NODE_COLORS[n.id];
          const hue = col?.hue ?? 30;
          const hueTarget = (hue + 120 + artRandom() * 60) % 360;
          emitNodeBurst(pool, n.x, n.y, n.z, hue, hueTarget, 3);
        }
      }

      // Emit particles along analogy filaments (thin golden trail)
      if (filamentTick) {
        const _fils = getFilaments();
        for (const fil of _fils) {
          if (fil.strength < 0.2 || fil.nodeA >= nodes.length || fil.nodeB >= nodes.length) continue;
          if (artRandom() > fil.strength) continue;
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
      // Ecocide tint: metabolicRift bleeds a faint crimson into the void.
      // The tint itself now lives on the GPU (SphereBackground) — this canvas
      // no longer paints a backdrop, it erases alpha so the backdrop shows
      // through. Fading toward a GL layer of colour K by alpha A is identical
      // to filling with K at alpha A, which is what makes this a port and not
      // a re-art; the equivalence is derived in SphereBackground.jsx.
      const { metabolicRift, exergyRate } = ecocideStateRef.current;
      const tint = riftTint(metabolicRift, immersiveRef.current);
      // Both halves of this object are read by the GL layer, and they are read
      // from HERE rather than recomputed there: rgb is the clear colour the
      // screen pass paints under the accumulated ink, and `.a` is the erase
      // alpha that drives the trail fade. Same object, same frame, so the fill
      // below and the fade cannot disagree — including across a mode toggle,
      // where `a` steps 0.72 <-> 0.32 in one frame.
      // The `destination-out` fillRect that used to be here is GONE, and with
      // it the last drawing call in this loop. It erased alpha on a canvas
      // nothing had painted since the WebGL migration — a full-screen 2-D fill
      // per frame to make a transparent surface transparent. `tint.a` itself is
      // load-bearing and stays: the GL trail fade reads it off the object
      // published above, which is what keeps the fade and the ink provably the
      // same number across a mode toggle.
      bgStateRef.current.rift = tint;
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
          gbuf[o + 2] = GHOST_RADIUS * gp2.scale * ink;
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

      // ── Voronoi Mesh — CUT (author, 2026-08-11) ───────────────────────────
      // The tessellation used to draw here, gated `if (immersiveRef.current)`,
      // with the rationale "reserve for full-screen immersive where the
      // geometry reads as texture not noise". That premise was never once
      // tested: immersive measured 1800x324 until 31bff8a, so the mesh spent
      // its whole life drawn into a letterbox strip. It also stayed on this
      // canvas through the GL migration and so kept the full 3.125x immersive
      // trail accumulation the migrated layers had lost. Fixing the containing
      // block and restoring accumulation handed it 3.3x the area at full weight
      // at the same time, and seen at its design size for the first time it
      // read as noise, not texture — the author's call, and the comment's own
      // prediction was simply wrong.
      //
      // The morphogenesis SIMULATION stays: `stepMorphogenesis()` still runs and
      // `cellCount()` still feeds the `cells = N` readout in the HUD. Only the
      // boundary-line rendering is gone, so nothing reads `getMesh()` now.

      // ── The additive line layer (ctx's `lighter`) ─────────────────────────
      //
      // A SECOND GL mesh, drawn after the edge mesh — see SphereEdges.js's
      // ADDITIVE_LAYER. Reset here, once, before the first of its writers: the
      // analogy filaments and the chimera fringes below, then the resonance
      // edge and the prism chords further down. That is the order the 2D loop
      // drew them in, and instances render in buffer order.
      //
      // ONE DEVIATION, and it is inherent to putting these two on this mesh.
      // The 2D loop drew them BEFORE the base edges; the additive mesh draws
      // after the source-over one. Where an edge crosses a filament the canvas
      // laid the edge over it (so the filament showed at 1-aEdge) and the mesh
      // adds the filament over the edge (so it shows whole). The two differ by
      // filamentInk * aEdge on the overlap only — both layers are thin and
      // dashed, and the alternative is a THIRD mesh at renderOrder 0 carrying
      // one more material for two layers. Recorded rather than hidden.
      const ag = addGLRef.current;
      ag.count = 0;
      ag.dropped = 0;
      // Reset WITH the count, not only at the particle loop. This is a property
      // persisted on the ref, and the draw body is inside a try -- a frame that
      // threw between here and the particle loop would leave LAST frame's index
      // standing against a fresh, smaller count, and a reader would take real
      // prism instances for particles.
      //
      // MINUS ONE, not zero, and the distinction is the whole point. The
      // composite still presents on a thrown frame, so the state IS readable in
      // that condition; 0 would mean "everything from index 0 is a particle",
      // i.e. trading a partly-wrong classification for a wholly-wrong one. A
      // negative value is UNSET, and artPresence falls back to its old shape
      // test rather than believing it.
      ag.particleStart = -1;
      ag.w = w; ag.h = h;
      // Scratch shared with the prism block below: tessellation points, the
      // control point, and writeHsl's 3-float output. Nothing here allocates.
      const _cPts  = prismPtsRef.current;
      const _cCtrl = prismCtrlRef.current;
      const _cRgb  = prismRgbRef.current;

      // ── Analogy Filaments — thin golden threads connecting structurally similar nodes ──
      //
      // Two DASHED passes over the same quadratic. `ctx.setLineDash([6,8])` was
      // set before the wide pass and cleared only after the whole loop, so the
      // sharp core was dashed too — both passes carry FILAMENT_FLAGS here.
      // Neither pass sets a dash offset, so both start the pattern at the
      // path's own start: phase0 = 0.
      //
      // What did NOT move: `getFilaments()`, the corpus-index guard, the
      // projection lookup and the depth fade all stay on the CPU. Only the ctx
      // calls became floats.
      {
        const filaments = getFilaments();
        if (filaments.length > 0) {
          const _t = performance.now() * 0.001;
          let drawn = 0;
          for (const fil of filaments) {
            if (drawn >= FILAMENT_MAX_DRAWN) break;   // see FILAMENT_MAX_DRAWN
            const iA = fil.nodeA, iB = fil.nodeB;
            // NOTE: fil.nodeA/nodeB are CORPUS indices (the 272-node
            // nodeFeatures array) while `nodes`/`proj` are the ~31-node sphere.
            // This guard therefore drops nearly every filament and mis-pairs
            // the survivors. Pre-existing and measured — 0 of 96 filaments
            // passed it over 3551 harness frames — and NOT this task's to fix:
            // repairing it would make an invisible layer appear, which is a
            // visual change, not a port. See the task report.
            if (iA >= nodes.length || iB >= nodes.length) continue;
            const pA = proj[iA], pB = proj[iB];
            if (!pA || !pB) continue;
            const avgDepth = (pA.depth + pB.depth) / 2;
            if (avgDepth < FILAMENT_DEPTH_CUTOFF) continue;
            const alpha = filamentAlpha(fil.strength, filamentDepthFade(avgDepth));
            if (alpha < FILAMENT_MIN_ALPHA) continue;

            // Shimmering hue based on time + node index (golden range 25-55).
            const hue = filamentHue(_t, iA);

            // Slight arc toward the sphere centre for the "inside" look.
            arcControl(_cCtrl, pA.sx, pA.sy, pB.sx, pB.sy, w / 2, h / 2, FILAMENT_CP_PULL);
            // Flattened ONCE and drawn twice, so both passes land on exactly
            // the same joints and accumulate the same arc length.
            const m = tessellateQuad(_cPts, pA.sx, pA.sy, _cCtrl[0], _cCtrl[1], pB.sx, pB.sy,
              quadSegments(pA.sx, pA.sy, _cCtrl[0], _cCtrl[1], pB.sx, pB.sy));

            // Wide diffuse glow — width scales with the projection.
            writeHsl(_cRgb, 0, hue, FILAMENT_GLOW_SAT, FILAMENT_GLOW_LIT);
            writePolyline(ag, _cPts, m, _cRgb, alpha * FILAMENT_GLOW_ALPHA_K,
              filamentGlowWidth((pA.scale + pB.scale) / 2) * ink,
              FILAMENT_FLAGS, 0);
            // Sharp core — a CONSTANT 0.8, unscaled BY THE PROJECTION. That
            // asymmetry with the pass above is in the original; see
            // FILAMENT_CORE_W, whose note is about depth: a core that
            // thickens toward the viewer is the thing being avoided.
            //
            // `ink` is a different axis and does not reintroduce it. It is
            // ONE number for the whole frame, so every filament core stays
            // exactly as wide as every other one and none of them varies
            // with depth. Holding it at 0.8 while the glow over it grows is
            // what would re-art the pair.
            writeHsl(_cRgb, 0, hue, FILAMENT_CORE_SAT, FILAMENT_CORE_LIT);
            writePolyline(ag, _cPts, m, _cRgb, alpha * FILAMENT_CORE_ALPHA_K,
              FILAMENT_CORE_W * ink, FILAMENT_FLAGS, 0);
            drawn++;
          }
        }
      }

      // ── Chimera boundary zones — flickering interference at sync/async borders ──
      //
      // The layer that made the 17th float necessary: `lineDashOffset = t * 30`
      // scrolls the pattern along the path, and a tessellated curve cannot
      // express that without carrying its own place on the path. The offset is
      // reduced modulo the packed period here, on the CPU, so the float the
      // shader reads stays small and exact however long the tab has been open.
      //
      // What did NOT move: the centroid arithmetic. It is CPU state built from
      // `nodes` and `proj`, and it stays exactly where it was.
      {
        const zones = getChimeraZones();
        if (zones.length > 0) {
          const _ct = performance.now() * 0.001;
          // One value for the whole layer — every zone shares the clock.
          const dashPhase = ((chimeraDashOffset(_ct) % CHIMERA_PERIOD) + CHIMERA_PERIOD)
            % CHIMERA_PERIOD;
          let drawn = 0;
          for (const zone of zones) {
            if (drawn >= CHIMERA_MAX_ZONES) break;   // see CHIMERA_MAX_ZONES
            // Find the cross-cluster edges that form this boundary
            // and render flickering interference fringes along them
            const strength = chimeraStrength(zone.boundaryStrength);
            if (strength < CHIMERA_MIN_STRENGTH) continue;

            // Hue oscillates between the two sync states; brightness flickers
            // against it off the other cluster's.
            const hue = chimeraHue(_ct, zone.syncA);
            const alpha = chimeraAlpha(strength, chimeraFlicker(_ct, zone.syncB));

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

            // Interference fringe — dashed arc with a scrolling dash offset.
            arcControl(_cCtrl, cxA, cyA, cxB, cyB, w / 2, h / 2, CHIMERA_CP_PULL);
            const m = tessellateQuad(_cPts, cxA, cyA, _cCtrl[0], _cCtrl[1], cxB, cyB,
              quadSegments(cxA, cyA, _cCtrl[0], _cCtrl[1], cxB, cyB));
            writeHsl(_cRgb, 0, hue, CHIMERA_SAT, CHIMERA_LIT);
            writePolyline(ag, _cPts, m, _cRgb, alpha, chimeraWidth(strength) * ink,
              CHIMERA_FLAGS, dashPhase);
            drawn++;
          }
        }
      }

      // ── Edges (depth-sorted by average node depth) ────────────────────────
      //
      // The strokes AND the travelling pulse rings are on the GPU
      // (SphereEdges.js); nothing in this block touches ctx any more. Everything
      // that decides what an edge LOOKS like still happens here, and so does the
      // depth sort and the findIndex pair beneath it — the sort is the draw
      // order the instance buffer is written in, and the projected coordinates
      // are what edgeAt() hit-tests against.
      const eg = edgeGLRef.current;
      eg.count = 0;
      eg.rings = 0;
      // The CSS space these endpoints live in, published with them so the GL
      // layer never has to guess it from a measurement that can lag.
      eg.w = w; eg.h = h;
      // Scaled by `ink` for the same reason every radius in this loop is: it
      // is one number for the whole frame, so the taper stays a fixed fraction
      // of a node radius at every viewport.
      eg.taperPx = EDGE_TAPER_PX * ink;
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

        // Once per frame, not once per edge: every edge this frame shares one
        // wave. `performance.now()` and not a frame counter — see humPhase.
        const _humNow   = performance.now();
        const _humPhase = humPhase(_humNow);
        const _humAxis  = humAxis(_humNow);

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
          // The wire hum. One multiply, on the one scalar all four branches
          // below derive from, so ortho / fused / spectral / default all
          // breathe without any of them knowing about it.
          //
          // The midpoint is the 3-D one — na and nb are unit-sphere positions,
          // not the projected pA/pB — so the wave rotates WITH the graph
          // instead of the graph sliding through it.
          //
          // AFTER depthFade on purpose: the hum is attenuated by depth along
          // with everything else, so the far side of the sphere does not pulse
          // as loudly as the near side.
          //
          // If the frames say otherwise, the fix is NOT to move this multiply
          // inside the parentheses — an earlier version of this comment said so
          // and was simply wrong. Multiplication commutes: `(sum) * depthFade *
          // gain` and `(sum * gain) * depthFade` are the same number. A
          // PROPORTIONAL gain cannot give a near-black edge an absolute swing
          // at all; +/-25% of an alpha of 0.08 is +/-0.02 wherever you put the
          // parentheses. The lever for that is an ADDITIVE term, which is what
          // the design doc's section 7 alternative actually meant.
          //
          // `e.pulse` is passed as `activity` so the hum steps aside on a
          // genuine transient (an edge that was just overwritten) without
          // muting it on permanently-boosted structure. See humGain's doc
          // comment in artEdges.js for why spectralBoost/fusionBoost are the
          // wrong thing to attenuate on, even though the design doc proposed it.
          const _humMid = { x: (na.x + nb.x) / 2, y: (na.y + nb.y) / 2, z: (na.z + nb.z) / 2 };
          const _humW = humWave(_humMid, _humAxis, _humPhase);
          const baseAlpha = (Math.min(na.energy, nb.energy) * 0.5 + 0.06 + spectralBoost + fusionBoost)
                          * depthFade * humGain(_humMid, _humAxis, _humPhase, e.pulse);
          const pulseBoost = e.pulse * 0.40;

          // The width formula moved to artEdges.js unchanged. Its SIGN is now
          // load-bearing — the pulse rings share this buffer and are told apart
          // by a negative width — so the invariant that it is always positive
          // needs a home a unit test can import. See SphereEdges.js's header.
          const lineWidth = edgeLineWidth(
            Math.max(na.energy, nb.energy), e.pulse, cosSim, fuseCos, isOrtho,
            ((pA.scale + pB.scale) / 2) * ink,
          );

          // Orthogonal bridges: hue-shifting gradient (magenta↔cyan), overrides default grd
          // Fused edges: solid bright glow (mineralized bone)
          // Spectral bridges: dashed stroke for visual distinction
          // Default: solid thin
          //
          // All four cases now write one instance into the GL buffer instead of
          // stroking. The gradient stops, the dash pattern and the glow radius
          // are the same numbers; ctx.shadowBlur has no GPU equivalent and is
          // approximated by an exponential shoulder in the fragment shader.
          if (eg.count < MAX_EDGES) {
            const o  = eg.count * EDGE_STRIDE;
            const ed = eg.data;
            ed[o] = pA.sx; ed[o + 1] = pA.sy; ed[o + 2] = pB.sx; ed[o + 3] = pB.sy;
            // Float 17 is a disc's shadow colour. This writer sets explicit
            // indices and the buffer is reused frame to frame, so a segment
            // landing where a disc was would inherit its colour — invisible in
            // the render (vIsDisc mixes it out) but NOT invisible to the world
            // hash, which reads the raw buffer.
            ed[o + 17] = 0;
            ed[o + 14] = lineWidth;

            if (isOrtho) {
              const now = Date.now();
              const hue = orthoHue(now);
              // orthoAlpha applies depthFade a SECOND time — baseAlpha already
              // carries it. That is what the 2D code did; it is not a typo
              // being fixed here.
              const orthoAlpha = Math.min(1, baseAlpha + pulseBoost + ORTHO_ALPHA_BOOST) * depthFade;
              writeHsl(ed, o + 4,  hue,                       100, 65);
              writeHsl(ed, o + 7,  hue + ORTHO_HUE_STEP_MID,  100, 72);
              writeHsl(ed, o + 10, hue + ORTHO_HUE_STEP_END,  100, 65);
              ed[o + 13] = packAlphas(orthoAlpha,
                                      Math.min(1, orthoAlpha + ORTHO_MID_ALPHA_BOOST),
                                      orthoAlpha);
              // isOrtho (4th arg): selects the shader's shadow alpha/colour —
              // opaque, hue+30 — instead of the fused edge's fuseCos*0.6/cMid.
              // See SphereEdges.js's file header.
              ed[o + 15] = packFlags(ORTHO_DASH[0] + ORTHO_DASH[1], ORTHO_DASH[0],
                                     orthoGlow(now), true);
              // orthoHue(now) is identical for every ortho edge this frame, so
              // it rides a shader uniform rather than a 17th packed float —
              // the last write wins, which is fine since they all agree.
              eg.orthoHue = hue;
            } else {
              const cMid  = lerpColor(colA, colB, e.strength);
              const stops = edgeStops(colA, colB, cMid, baseAlpha, pulseBoost, e.strength);
              writeHslRgb(ed, o + 4,  stops[0].color);
              writeHslRgb(ed, o + 7,  stops[1].color);
              writeHslRgb(ed, o + 10, stops[2].color);
              ed[o + 13] = packAlphas(stops[0].a, stops[1].a, stops[2].a);
              const dashed = isSpectral && !isFused;
              ed[o + 15] = packFlags(
                dashed ? SPECTRAL_DASH[0] + SPECTRAL_DASH[1] : 0,
                dashed ? SPECTRAL_DASH[0] : 0,
                // The breathing glow shoulder. This slot was a flat 0, i.e. no
                // halo at all on any dormant edge — so it INTRODUCES one
                // rather than modulating one. It rides the SAME wave as the
                // alpha hum, never a second oscillator that would drift.
                // The 6 px floor is not a taste call: EDGE_FRAG derives the
                // shadow alpha from the radius and anything at or below 6
                // renders alpha 0. The SWING above that floor scales with
                // sphereR, which is why the radius is passed in — see
                // HUM_GLOW in artEdges.js for why only the swing can scale.
                //
                // DASHED SPECTRAL BRIDGES GET ONE TOO, AND THAT IS A RULING,
                // not an oversight. `dashed` is two lines up, and EDGE_FRAG
                // dashes only the STROKE — `core *= step(mod(dashPos, ...))`;
                // `glowSeg` is computed from the segment distance alone and is
                // never gated by `vDash`. So a dashed bridge carries a
                // CONTINUOUS halo across its own gaps at the hum's crest, at
                // roughly 1-2% alpha for these widths. It was raised as a
                // review finding and the author kept it: the atmospheric
                // bridge visually grounds the dashed edges. Do not "fix" it.
                isFused ? fusedGlow(fuseCos) : humGlowRadius(_humW, e.pulse, sphereR),
              );
            }
            // The terminal taper, on the base edges alone. Bit 7 of the
            // dash-duty byte; see packFlags. OR'd in after the branch so both
            // paths (ortho / default, the latter covering fused and spectral)
            // get it from one place and neither can be missed.
            ed[o + 15] += 128 * 256;
            eg.count++;
          }

          // Overwrite pulse ring — a flat disc travelling along the edge, now a
          // second instance in the SAME buffer written immediately after its
          // own edge. That ordering is the point: the 2D loop stroked edge i,
          // filled edge i's ring, then stroked edge i+1, so the rings interleave
          // through the depth sort. A separate mesh would draw them all last.
          //
          // The guard is deliberately the same `eg.count < MAX_EDGES` the edge
          // uses. `count` only ever rises, so an edge that was dropped at the
          // cap cannot have its ring written either.
          if (e.pulse > PULSE_DRAW_CUTOFF && eg.count < MAX_EDGES) {
            const t   = pulsePosition(e.pulse, e.direction);
            const px  = pA.sx + (pB.sx - pA.sx) * t;
            const py  = pA.sy + (pB.sy - pA.sy) * t;
            // The colour of the endpoint the pulse LEFT, not the one it is
            // heading for; and the radius scales by pA.scale alone, not by the
            // two-endpoint average the stroke width uses. Both are the 2D
            // behaviour, faithfully.
            const src = e.direction >= 0 ? colA : colB;
            const a   = e.pulse * depthFade * PULSE_ALPHA;
            // Through writeDisc since step 5 task 3. The centre is no longer
            // duplicated into aEnds.zw — those two floats now carry the inner
            // radius and the sweep — and what makes that safe is EDGE_VERT
            // forcing delta to zero for a disc. The two halves landed together
            // and must stay together; see DISC_OFF.
            //
            // A pulse ring is the degenerate case of the new encoding: no inner
            // radius, no sweep, no falloff, so every added field is 0 and the
            // shader collapses to the filled disc it always drew.
            writeDisc(eg.data, eg.count * EDGE_STRIDE, {
              cx: px, cy: py,
              rOuter: pulseRingRadius(e.pulse, pA.scale * ink),
              hsl: src, alpha: a,
              flags: packFlags(0, 0, 0),   // no dash, no glow, not ortho
            });
            eg.count++;
            eg.rings++;
          }
        }
      }

      // Every disc written from here on is a NODE disc (or a DEV probe), not a
      // travelling pulse ring. Publishing the boundary is what keeps a reader
      // scanning for `isDisc` from conflating the two.
      eg.discStart = eg.count;

      // Disc probe (DEV only, null in every real frame). Appended here so it
      // shares the pulse rings' exact path into the buffer — same mesh, same
      // material, same blend — rather than proving a shader branch through a
      // route nothing else uses.
      if (discProbeRef.current) {
        for (const d of discProbeRef.current) {
          if (eg.count >= MAX_EDGES) break;
          writeDisc(eg.data, eg.count * EDGE_STRIDE, d);
          eg.count++;
        }
      }

      // ── Resonance edge (Shift-Click comparison — solid glowing coalescence) ──
      //
      // Third writer into the additive stream `ag`, which was reset above the
      // filaments — after them and the chimera fringes, before the prism, which
      // is the order the 2D loop drew all four in.
      //
      // TWO instances, not one: a wide low-alpha halo and a narrow bright core
      // over it. That is what makes it read as two things coalescing rather
      // than as a thick edge, and it is the part a port loses silently — a
      // single bright bar looks entirely plausible.
      //
      // What did not move: the findIndex pair, both guard clauses and the
      // projection all stay here on the CPU. Only the ctx calls became floats.
      if (resonanceModeRef.current && resonanceNodesRef.current.length === 2) {
        const [rIdA, rIdB] = resonanceNodesRef.current;
        const rIA = nodes.findIndex(n => n.id === rIdA);
        const rIB = nodes.findIndex(n => n.id === rIdB);
        if (rIA >= 0 && rIB >= 0) {
          const rResult = resonanceResultRef.current;
          // A pair with no computed result yet draws at 0.5, not at 0.
          const sim     = rResult?.sim ?? RESONANCE_DEFAULT_SIM;
          const pRA = proj[rIA], pRB = proj[rIB];
          if (!pRA || !pRB) { /* dynamic node not yet projected — skip */ } else
          if (!isFinite(pRA.sx) || !isFinite(pRA.sy) || !isFinite(pRB.sx) || !isFinite(pRB.sy)) { /* non-finite coords — skip */ } else {
          const avgScale = ((pRA.scale + pRB.scale) / 2) * ink;
          const widths   = resonanceWidths(sim, avgScale);
          const stops    = resonanceStops(sim);
          const ad       = ag.data;

          // The original quantised each alpha with `.toFixed(3)` before the
          // canvas parsed the rgba() string. packAlphas quantises to 1/255,
          // which is coarser, so it is the dominant step and toFixed does not
          // need reproducing — it is dropped deliberately, not by oversight.
          const stroke = (s, width, glow) => {
            const o = ag.count * EDGE_STRIDE;
            ad[o] = pRA.sx; ad[o + 1] = pRA.sy; ad[o + 2] = pRB.sx; ad[o + 3] = pRB.sy;
            // rgb BYTES, not the palette's HSL objects — see writeRgb255.
            writeRgb255(ad, o + 4,  s.c0);
            writeRgb255(ad, o + 7,  s.c1);
            writeRgb255(ad, o + 10, s.c2);
            ad[o + 13] = packAlphas(s.a0, s.a1, s.a2);
            ad[o + 14] = width;
            // No dash, never ortho, and the layer's OWN glow step: at the edge
            // mesh's 1/8 px a 28px radius saturates at 15.875. See packFlags.
            ad[o + 15] = packFlags(0, 0, glow, false, ADDITIVE_LAYER.glowQuant);
            // The dash phase, written EXPLICITLY even though this stroke is
            // solid: `ag.data` is reused every frame and a slot the chimera
            // fringes used last frame still holds their scrolling offset. The
            // shader would ignore it (period 0 skips the dash branch), but a
            // reader of the published buffer would not, and a stale float that
            // only matters "because nothing looks at it" is one refactor away
            // from mattering.
            ad[o + 16] = 0;
            // Same for float 17, and for the same reason field 16 is zeroed
            // here: an instance that only matters "because nothing looks at
            // it" is one refactor away from mattering.
            ad[o + 17] = 0;
            ag.count++;
          };

          // Outer bloom halo — wide, low alpha, and shadowBlur = 0.
          stroke(stops.halo, widths.halo, 0);
          // Core solid line — width and bloom scale linearly with similarity.
          // Its shadow colour/alpha are the material's, not per-instance.
          stroke(stops.core, widths.core, resonanceGlow(sim));
        } // else — close proj guard
        }
      }

      // ── Prism geometry effects (inside-sphere chords, command-triggered) ────
      //
      // Additive blending: overlapping spectral lines ACCUMULATE light → bloom
      // cores. All three sub-layers now write instances into the SAME additive
      // stream the resonance edge above uses — no ctx.save()/restore() pair,
      // because there is no longer a ctx call in here to bracket.
      //
      // The chords are quadratic Béziers and the line mesh draws straight
      // segments, so each is flattened on the CPU (artCurve.js) into a run of
      // abutting instances. What did NOT move: the projection, the ID→index
      // map, the envelope, the hue drift and the eff.life/`live` bookkeeping
      // are simulation state and stay here.
      {
        // Precompute ID→index map once per frame — O(1) lookup inside effect loop
        const nodeIdx = {};
        for (let i = 0; i < nodes.length; i++) nodeIdx[nodes[i].id] = i;

        const pts  = prismPtsRef.current;    // tessellation scratch, xy pairs
        const ctrl = prismCtrlRef.current;   // the control point, [x, y]
        const rgb  = prismRgbRef.current;    // writeHsl's 3-float output

        // A polyline of `m` points, then the same for one straight segment.
        // The alphas the 2D code quantised with `.toFixed(3)` are quantised to
        // 1/255 by packAlphas instead, which is the coarser step and therefore
        // the dominant one — the same call made for the resonance edge above.
        // Every prism width — glow, core, polygon, spoke — is a bare
        // screen-px constant; not one of them rides the projection. So
        // `ink` is applied HERE, once, instead of at the four call sites.
        const chord = (m, a, width) =>
          writePolyline(ag, pts, m, rgb, a, width * ink, PRISM_FLAGS);
        const straight = (x0, y0, x1, y1, a, width) => {
          pts[0] = x0; pts[1] = y0; pts[2] = x1; pts[3] = y1;
          writePolyline(ag, pts, 2, rgb, a, width * ink, PRISM_FLAGS);
        };

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
          // Coarse (mobile): 4 spectral lines × 6 nodes = 60 curves/effect
          // Fine  (desktop): 7 spectral lines × 11 nodes = 770 curves/effect
          const spectralN = eff.coarse ? PRISM_SPECTRAL_COARSE : PRISM_SPECTRAL_FINE;
          for (let a = 0; a < effProj.length; a++) {
            for (let b = a + 1; b < effProj.length; b++) {
              const pA = effProj[a], pB = effProj[b];

              for (let k = 0; k < spectralN; k++) {
                const hue    = (hue0 + k * PRISM_HUE_STEP) % 360;
                const lAlpha = prismChordAlpha(alpha, k);
                const offset = prismOffset(k);

                // Control point pulled toward sphere center — creates interior arc
                // illusion. From the UNSHIFTED midpoint; see prismControl().
                prismControl(ctrl, pA.sx, pA.sy, pB.sx, pB.sy, cx, cy, offset);
                // The chord terminates ON the node centre. Every spectral
                // line's offset is in the control point (PRISM_CP_OFF_X/Y), so
                // the bundle opens from a point and closes onto one — which is
                // what dispersion looks like, and what the polygon and the
                // spokes already did.
                const x0 = pA.sx, y0 = pA.sy;
                const x1 = pB.sx, y1 = pB.sy;

                // Flattened ONCE and drawn twice: both passes are the same
                // curve, so they share the point list and therefore land on
                // exactly the same joints.
                const m = tessellateQuad(pts, x0, y0, ctrl[0], ctrl[1], x1, y1,
                  quadSegments(x0, y0, ctrl[0], ctrl[1], x1, y1));

                // Wide glow pass
                writeHsl(rgb, 0, hue, PRISM_SAT, PRISM_GLOW_LIT);
                chord(m, lAlpha * PRISM_GLOW_ALPHA_K, prismGlowWidth(k));
                // Sharp core pass
                writeHsl(rgb, 0, hue, PRISM_SAT, PRISM_CORE_LIT);
                chord(m, lAlpha, PRISM_CORE_W);
              }
            }
          }

          // Sacred polygon outline (cyclic ring) through effect nodes.
          // One closed canvas path became N separate segments, so its MITER
          // JOINS are gone — a known, measured deviation at the corners. See
          // the task report; it is not papered over with an invented join.
          if (effProj.length >= 3) {
            const polyHue = (hue0 + PRISM_POLY_HUE_STEP) % 360;
            writeHsl(rgb, 0, polyHue, PRISM_SAT, PRISM_POLY_LIT);
            const polyA = alpha * PRISM_POLY_ALPHA_K;
            for (let i = 0; i < effProj.length; i++) {
              const p0 = effProj[i], p1 = effProj[(i + 1) % effProj.length];
              straight(p0.sx, p0.sy, p1.sx, p1.sy, polyA, PRISM_POLY_W);
            }
          }

          // Star spokes — lines from sphere center to each effect node. Each was
          // already its own beginPath/stroke, so the canvas composited them
          // separately too: they double where they meet at the centre, there and
          // here alike.
          for (const ep of effProj) {
            const spokeHue = prismSpokeHue(hue0, ep.sx - cx, ep.sy - cy);
            writeHsl(rgb, 0, spokeHue, PRISM_SPOKE_SAT, PRISM_SPOKE_LIT);
            straight(cx, cy, ep.sx, ep.sy, alpha * PRISM_SPOKE_ALPHA_K, PRISM_SPOKE_W);
          }
        }
        geomEffectsRef.current = live;
      }

      // ── Nodes (depth-sorted, near drawn last = on top) ────────────────────
      const hov = hoveredRef.current;
      const _resNodes = resonanceNodesRef.current;
      const _resActive = resonanceModeRef.current && _resNodes.length > 0;
      const _resNodeSet = _resActive ? new Set(_resNodes) : null;
      const _spectralFlux = getSpectralFlux();
      const _cen = nodeCensusRef.current;
      _cen.nodes = 0; _cen.halo = 0; _cen.core = 0; _cen.coreHover = 0;
      _cen.beacon = 0; _cen.chimeraSync = 0; _cen.chimeraFlicker = 0;
      _cen.ghostInner = 0; _cen.ghostOuter = 0;
      _cen.birth = 0; _cen.bleed = 0; _cen.spectral = 0; _cen.resonanceDim = 0;
      _cen.fusionRing = 0; _cen.fusionThread = 0;
      _cen.probeTether = 0; _cen.probeHalo = 0; _cen.probeCore = 0;
      _cen.particleGlow = 0; _cen.particleCore = 0;
      _cen.conductorThumb = 0; _cen.conductorTrack = 0;
      _cen.conductorFill = 0; _cen.conductorGlow = 0;
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
          const _prog = birthProgress(performance.now() - _birth.t0);
          if (!_prog) {
            birthMapRef.current.delete(n.id);
          } else {
            const [_prx, _pry, _prz] = applyM(M, _birth.px, _birth.py, _birth.pz);
            const _pp = project(_prx, _pry, _prz, w, h, sphereR, focal);
            p = birthProject(_pp, proj[i], _prog.ease);
            _cen.birth++;
          }
        }

        if (!isFinite(p.sx) || !isFinite(p.sy)) continue; // guard non-finite projection coords
        const isHov     = n.id === hov;
        const energy    = nodeEnergy(n.energy, isHov);
        // Depth cuing: nodes on the back are smaller + dimmer
        const _cued = depthCueAlpha(p.depth);

        // ── Resonance dimming: non-selected nodes → 10% opacity ──────────────
        const _isResNode = _resActive && _resNodeSet.has(n.id);
        // Counted off the RESULT, not off a second copy of the predicate: the
        // dim is a tenth and the cue has a floor of 0.08, so the two can never
        // coincide and the comparison cannot miss a dimmed node.
        const depthAlpha = resonanceDimmed(_cued, _resActive, _isResNode);
        if (depthAlpha !== _cued) _cen.resonanceDim++;
        _cen.nodes++;

        // The projection scale this node's INK is drawn at. `p.scale`
        // itself stays untouched — it also carries the label offset and
        // the birth interpolation, which are positions, not ink. Every
        // radius and width below is linear in this, so multiplying here is
        // a uniform scaling of the whole node and not a reshaping of it.
        const pInk   = p.scale * ink;
        const radius = nodeRadius(energy, pInk);

        // Overwrite bleed — temporarily radiate source color
        let renderCol = col;
        if (n.bleedAmount > 0 && n.bleedFrom) {
          const srcCol = NODE_COLORS[n.bleedFrom];
          if (srcCol) { renderCol = lerpColor(col, srcCol, bleedMix(n.bleedAmount)); _cen.bleed++; }
        }

        // Spectral PCA tint — shift hue based on eigenvalue-to-wavelength mapping.
        // `_preTint` is kept because the HOVERED core is drawn from
        // renderCol.hsl, which spectralTint deliberately does not rewrite. See
        // artNodes' coreColorSource() for why that is not a rounding detail.
        const _preTint = renderCol;
        const _spc = getSpectralColor(i);
        if (_spc && renderCol.hue != null) {
          _cen.spectral++;
          renderCol = spectralTint(renderCol, _spc, _spectralFlux);
        }

        // ── Glow halo and core disc — ON THE GPU since step 5 task 3 ────────
        //
        // Written into `eg`, the SAME source-over stream the edges use, and
        // written HERE rather than into a mesh of their own. Draw order is the
        // reason: the 2D loop drew edges, then halos, then cores, then the
        // rings; a second mesh would put every node under or over every edge
        // at once. Appending to this buffer after the edge loop has finished
        // preserves the order exactly, and the rings still on the 2D canvas
        // composite on top of the GL result, which is where they were.
        //
        // The cap guard mirrors the pulse rings': `count` only rises, so a
        // node dropped at the cap cannot have its core written either.
        if (haloDraws(energy, n.bleedAmount) && eg.count < MAX_EDGES) {
          // A createRadialGradient, expressed as the shader's falloff: flat
          // inside the inner stop, then linear to zero at the rim.
          writeDisc(eg.data, eg.count * EDGE_STRIDE, {
            cx: p.sx, cy: p.sy,
            rOuter: haloRadius(radius, energy, n.bleedAmount, pInk),
            falloffInner: haloInnerRadius(radius),
            hsl: renderCol,
            alpha: haloAlpha(energy, n.bleedAmount, depthAlpha),
            flags: packFlags(0, 0, 0),
          });
          eg.count++;
          _cen.halo++;
        }

        if (eg.count < MAX_EDGES) {
          // A hovered core is OPAQUE and takes its colour from BEFORE the
          // spectral tint — both are the canvas's own behaviour, not a
          // simplification. coreIsOpaque() / coreColorSource() name them.
          const _hov = coreIsOpaque(isHov);
          const _lensCol = coreColorSource(renderCol, _preTint, _hov);
          const _lens = _hov ? null : lensStops(coreAlpha(energy, depthAlpha));
          writeDisc(eg.data, eg.count * EDGE_STRIDE, {
            cx: p.sx, cy: p.sy,
            rOuter: radius,
            hsl: _lensCol,
            // A hovered core stays FLAT and opaque — see coreIsOpaque().
            alpha: _hov ? 1 : _lens.center,
            // The same colour in the mid stop, and outerK left at 0, so the
            // three-stop machinery carries opacity alone. Omitting `mid`
            // entirely on hover keeps that instance byte-identical to what it
            // has always been.
            mid: _lens ? { at: _lens.at, hsl: _lensCol, alpha: _lens.knee } : null,
            outerAlpha: _lens ? _lens.rim : 0,
            flags: packFlags(0, 0, 0),
          });
          eg.count++;
          _cen.core++; if (isHov) _cen.coreHover++;
        }

        // ── Awakening beacon ring (logic in artAwakening.js) ──────────────
        //
        // ON THE GPU, and in the ADDITIVE stream: its 2D form set
        // `globalCompositeOperation = 'lighter'`, and `ag` is where that blend
        // lives. That stream composites AFTER the whole source-over one, so a
        // near node's core no longer occludes this ring — measured in this
        // task's report rather than assumed. Appending here puts it after the
        // filaments, the chimera fringes, the prism and the resonance edge,
        // which is the 2D order.
        const _beacon = beaconRingState(aw, i, p, radius, renderCol, depthAlpha,
                                        nodes.length, undefined, ink);
        if (_beacon) {
          if (ag.count < MAX_ADDITIVE_EDGES) {
            const _ba = strokeAnnulus(_beacon.radius, _beacon.width);
            writeDisc(ag.data, ag.count * EDGE_STRIDE, {
              cx: _beacon.cx, cy: _beacon.cy,
              rOuter: _ba.rOuter, rInner: _ba.rInner,
              hsl: _beacon.hsl, alpha: _beacon.alpha,
              flags: BEACON_FLAGS,
            });
            ag.count++;
            _cen.beacon++;
          } else {
            // Counted, not lost — a Float32Array write past the end is a
            // silent no-op, and the overflow report below reads this.
            ag.dropped++;
          }
        }

        // ── Chimera state halo — phase-locked clusters glow in unison ──────
        {
          const _chim = getNodeChimeraState(i);
          if (_chim) {
            const _ct = performance.now() * 0.001;
            if (_chim.isSync) {
              // Synchronized: steady warm halo pulsing at cluster phase
              const syncPulse = chimeraSyncPulse(_ct, _chim.meanPhase);
              const syncAlpha = chimeraSyncAlpha(_chim.orderParam, syncPulse, depthAlpha);
              // Source-over, so it goes into `eg` right behind this node's own
              // core — the order the 2D loop drew them in.
              if (syncAlpha > CHIMERA_ALPHA_CUTOFF && eg.count < MAX_EDGES) {
                const _sa = strokeAnnulus(chimeraSyncRadius(radius, pInk),
                                          CHIMERA_SYNC_WIDTH * pInk);
                writeDisc(eg.data, eg.count * EDGE_STRIDE, {
                  cx: p.sx, cy: p.sy,
                  rOuter: _sa.rOuter, rInner: _sa.rInner,
                  hsl: CHIMERA_SYNC_HSL, alpha: syncAlpha,
                  flags: CHIMERA_SYNC_FLAGS,
                });
                eg.count++;
                _cen.chimeraSync++;
              }
            } else if (_chim.isChimera) {
              // Chimera boundary: erratic flickering ring
              const flickRate = chimeraFlickRate(_chim.orderParam);
              const flickAlpha = chimeraFlickAlpha(_ct, flickRate, i, depthAlpha);
              if (flickAlpha > CHIMERA_ALPHA_CUTOFF && eg.count < MAX_EDGES) {
                const _fa = strokeAnnulus(chimeraFlickRadius(radius, pInk),
                                          CHIMERA_FLICK_WIDTH * pInk);
                writeDisc(eg.data, eg.count * EDGE_STRIDE, {
                  cx: p.sx, cy: p.sy,
                  rOuter: _fa.rOuter, rInner: _fa.rInner,
                  hsl: {
                    hue: chimeraFlickHue(_ct, i),
                    sat: CHIMERA_FLICK_SAT, lit: CHIMERA_FLICK_LIT,
                  },
                  alpha: flickAlpha,
                  flags: CHIMERA_FLICK_FLAGS,
                });
                eg.count++;
                _cen.chimeraFlicker++;
              }
            }
            // Async clusters: no extra ring (they're the "noise floor")
          }
        }

        // ── Ghost node (Gestalt completion) — materializing outline ─────────
        //
        // Both rings are `lighter`, so both go into `ag` — and AFTER the beacon
        // above, which is the order the 2D loop drew them in. The inner ring is
        // a PARTIAL ARC and its sweep angle is the completion readout itself:
        // written as a full circle it would still look like a ring and the
        // whole animation would be gone. (The 2D comment called it "dashed".
        // It never was; it is an arc, and ghostSweepEncoded() is why.)
        {
          const _ghosts = getGhostNodes();
          if (_ghosts && ghostDraws(_ghosts[i])) {
            const gAlpha = ghostAlpha(_ghosts[i], depthAlpha);
            const ghostR = ghostRadius(radius, _ghosts[i], pInk);
            if (ag.count < MAX_ADDITIVE_EDGES) {
              const _gi = strokeAnnulus(ghostR, GHOST_INNER_WIDTH * pInk);
              writeDisc(ag.data, ag.count * EDGE_STRIDE, {
                cx: p.sx, cy: p.sy,
                rOuter: _gi.rOuter, rInner: _gi.rInner,
                sweepEnd: ghostSweepEncoded(_ghosts[i]),
                hsl: GHOST_INNER_HSL, alpha: gAlpha * GHOST_INNER_ALPHA_K,
                flags: GHOST_FLAGS,
              });
              ag.count++;
              _cen.ghostInner++;
            } else ag.dropped++;

            // Outer glow ring: completion halo. Full circle, three times wide.
            if (ag.count < MAX_ADDITIVE_EDGES) {
              const _go = strokeAnnulus(ghostOuterRadius(ghostR, pInk),
                                        GHOST_OUTER_WIDTH * pInk);
              writeDisc(ag.data, ag.count * EDGE_STRIDE, {
                cx: p.sx, cy: p.sy,
                rOuter: _go.rOuter, rInner: _go.rInner,
                hsl: GHOST_OUTER_HSL, alpha: gAlpha * GHOST_OUTER_ALPHA_K,
                flags: GHOST_FLAGS,
              });
              ag.count++;
              _cen.ghostOuter++;
            } else ag.dropped++;
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

      // Never quietly. This sits AFTER the node loop because the beacon ring
      // moved into `ag` in step 5 task 5 — it was under the prism, which was
      // then the last writer, and a check that runs before a writer certifies
      // nothing about it. It is also out of the prism's own `if`, which only
      // ran on a frame with a live geometric effect: the filaments, the fringes
      // and now the beacon can all write to a frame that has none.
      // MAX_ADDITIVE_EDGES is sized so this is unreachable (four concurrent
      // eleven-node effects at the segment ceiling, plus both orphan layers at
      // their own caps, plus one ring per node), so if it ever fires the
      // arithmetic behind the cap is wrong, not the frame.
      if (ag.dropped > 0 && !prismOverflowWarned) {
        prismOverflowWarned = true;
        console.error(`[art] additive overflow: ${ag.dropped} instances dropped at`
          + ` ${ag.count}/${MAX_ADDITIVE_EDGES} — MAX_ADDITIVE_EDGES is too small`);
      }

      // ── Manual fusion: pending targeting line + source pulse ring ─────────
      //
      // ON THE GPU, and into `eg` — source-over, which is what the 2D form
      // already was: neither of these ever set globalCompositeOperation.
      //
      // Appended HERE, after every node disc, and that placement is the whole
      // point of the layer being last. Both of these TERMINATE on a node — the
      // ring encircles one, the thread starts at one — and the GL composite
      // renders under the 2D canvas, so writing them any earlier in the frame
      // would put them behind the discs they are drawn against. They stay
      // under the particle ecology and the conductor, which still draw on the
      // 2D canvas after this point and always did.
      const fSrc = fusionSourceRef.current;
      if (fSrc) {
        // Sphere space, not corpus space: `proj` and `nodes` are the live
        // sphere array. fusionSourceRef is set from nodeAt() hit-testing, which
        // returns sphere nodes, so this normally resolves.
        const si = sphereIndexOf(nodes, fSrc);
        if (si >= 0) {
          const sp    = proj[si];
          const t     = performance.now() / 1000;
          const pulse = fusionPulse(t);
          const srcCol = NODE_COLORS[fSrc];
          const ringR  = fusionRingRadius(nodes[si].energy, pulse, sp.scale * ink);
          // Pulsing dashed ring around the locked source. [5,4] is an ANGULAR
          // dash: for a disc the shader walks rMid * theta, so the pattern
          // stays in px of ARC LENGTH and the dash boundaries come out radial,
          // exactly as ctx.setLineDash draws them around a stroked circle.
          if (eg.count < MAX_EDGES) {
            const _fr = strokeAnnulus(ringR, FUSION_RING_WIDTH * sp.scale * ink);
            writeDisc(eg.data, eg.count * EDGE_STRIDE, {
              cx: sp.sx, cy: sp.sy,
              rOuter: _fr.rOuter, rInner: _fr.rInner,
              hsl: srcCol, alpha: fusionRingAlpha(pulse),
              flags: FUSION_RING_FLAGS,
            });
            eg.count++;
            _cen.fusionRing++;
          }
          // Dashed targeting thread to the cursor. An ordinary straight
          // segment — no disc encoding, no shader change; writePolyline over
          // two points is the same instance the base edges have always been.
          const cur = fusionCursorRef.current;
          if (cur) {
            _cPts[0] = sp.sx; _cPts[1] = sp.sy;
            _cPts[2] = cur.x; _cPts[3] = cur.y;
            writeHsl(_cRgb, 0, srcCol.hue, srcCol.sat, srcCol.lit);
            // The RETURN value, not an unconditional ++: past capacity
            // writePolyline writes nothing and reports 0, and a census that
            // counted the intent rather than the write would hide that.
            _cen.fusionThread += writePolyline(
              eg, _cPts, 2, _cRgb, fusionThreadAlpha(pulse),
              FUSION_THREAD_WIDTH * ink, FUSION_THREAD_FLAGS);
          }
        }
      }

      // ── Probe node (text_probe.rs concept injection) ───────────────────────
      // ON THE GPU, into `eg`, after the fusion pair above — the 2D comment
      // here read "rendered after all sphere nodes so it draws on top", and
      // appending last in the source-over stream is that same sentence. Only
      // the LABEL stays behind, and it is DOM rather than canvas.
      const probe = probeNodeRef.current;
      if (probe?.anchors?.length) {
        // Ranking spans all 272 corpus nodes; probe.anchors has already
        // collapsed the top matches onto sphere nodes (see SPHERE_ANCHOR), so
        // the centroid forms even when no match is on the sphere itself.
        // `resolve` hands back the sphere position AND the projected point,
        // because the centroid is computed in sphere space while the tethers
        // are drawn in screen space, and re-deriving the index for the second
        // would mean a second sphereIndexOf sweep per anchor per frame.
        const _c = probeCentroid(probe.anchors, (id) => {
          const ni = sphereIndexOf(nodes, id);
          if (ni < 0) return null;
          const nd = nodes[ni];
          return { x: nd.x, y: nd.y, z: nd.z, p: proj[ni] };
        });
        if (_c) {
          const [prx, pry, prz] = applyM(M, _c.x, _c.y, _c.z);
          const pp = project(prx, pry, prz, w, h, sphereR, focal);
          const depthAlpha = probeDepthAlpha(prz);
          // Tether lines to every anchor that formed the centroid. The tethers
          // and the halo share one colour, so it is converted ONCE, through
          // writeRgb255 — these are authored as rgba() BYTE triples, not as
          // the palette's HSL objects, and a hand-rolled /255 at each call
          // site is exactly where a second, drifting conversion appears.
          writeRgb255(_cRgb, 0, PROBE_GLOW_RGB);
          for (const { node: pn, weight } of _c.tethers) {
            // Each tether was its own beginPath, so each starts at dash phase
            // 0 — which is writePolyline's default, one call per tether.
            _cPts[0] = pp.sx;    _cPts[1] = pp.sy;
            _cPts[2] = pn.p.sx;  _cPts[3] = pn.p.sy;
            _cen.probeTether += writePolyline(
              eg, _cPts, 2, _cRgb,
              probeTetherAlpha(weight, _c.wmax, depthAlpha),
              PROBE_TETHER_WIDTH * ink, PROBE_TETHER_FLAGS);
          }
          // Pulsing glow halo. A RADIAL FALLOFF — flat inside falloffInner,
          // then linear to zero at the outer radius — because that is what
          // createRadialGradient is. NOT the gaussian shoulder ctx.shadowBlur
          // casts: the two agree at exactly one radius and are wrong at every
          // other, which is the trap the node halos already paid for.
          const pulse = probePulse(Date.now());
          const probeR = probeRadius(pp.scale * ink);
          const glowR  = probeGlowRadius(probeR, pulse, pp.scale * ink);
          if (glowR > 0 && isFinite(pp.sx) && isFinite(pp.sy)
              && eg.count < MAX_EDGES) {
            writeDisc(eg.data, eg.count * EDGE_STRIDE, {
              cx: pp.sx, cy: pp.sy,
              rOuter: glowR,
              falloffInner: probeGlowInnerRadius(probeR),
              rgb: _cRgb, alpha: PROBE_GLOW_ALPHA * depthAlpha,
              flags: PROBE_FLAGS,
            });
            eg.count++;
            _cen.probeHalo++;
          }
          // Core node — a plain filled disc, the primitive step 4 already
          // ships. Its own colour, so the scratch is refilled.
          if (eg.count < MAX_EDGES) {
            writeRgb255(_cRgb, 0, PROBE_CORE_RGB);
            writeDisc(eg.data, eg.count * EDGE_STRIDE, {
              cx: pp.sx, cy: pp.sy,
              rOuter: probeR,
              rgb: _cRgb, alpha: probeCoreAlpha(pulse, depthAlpha),
              flags: PROBE_FLAGS,
            });
            eg.count++;
            _cen.probeCore++;
          }
          // Label — DOM, drawn by SphereLabels. Stays.
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

      // ── Idle ambient particle emission ───────────────────────────────────
      // Two COPRIME cadences, 3 and 7, so they coincide once every 21 authored
      // frames — an interference pattern, not a redundant pair, and the reason
      // both survive the conversion as separate gates instead of collapsing
      // into one. (The old header said "~2 per frame"; it is 10 in every 21.)
      if (idleTickA) emitIdleParticles(pool, nodes);
      if (idleTickB) emitIdleParticles(pool, nodes);

      // ── Particle render — additive, smooth sin fade, radial glow ─────────
      // Counted, because a layer in no capture state scores perfect parity
      // whether it ships or is deleted — this branch's defining failure, found
      // six times. Both sub-layers separately: a port that drops the glow and
      // keeps the core would otherwise read as present.
      // ── The strimer wavefront ────────────────────────────────────────────
      // Stepped on the clock, never on a frame count: a frame counter runs at
      // double speed on a 120Hz display, which is the /SCENT bug. The harness
      // virtualises performance.now() and advances it FRAME_MS per __pump, so
      // this stays bit-reproducible under a capture.
      {
        const sp = strimerRef.current;
        stepStrimer(sp, performance.now());

        // ARRIVALS. This is the +0.6 that used to fire instantly inside
        // fireNode for every neighbour at once; it now lands when the packet
        // that was sent to that neighbour actually gets there.
        //
        // Reads arrivedDst — the destination NODE ID — not a slot index.
        // stepStrimer compacts the pool in the same call that records
        // arrivals, which renumbers slots after the first one it retires; a
        // slot index read back here, after compaction, can name a different,
        // still-travelling packet. See stepStrimer's doc comment.
        for (let k = 0; k < sp.arrivedCount; k++) {
          const nb = nodes.find(n => n.id === sp.arrivedDst[k]);
          if (nb) nb.energy = Math.min(1, nb.energy + 0.6);
        }

        sp.w = w; sp.h = h;
        sp.instances = 0;
        for (let i = 0; i < sp.count; i++) {
          const ia = nodes.findIndex(n => n.id === sp.srcId[i]);
          const ib = nodes.findIndex(n => n.id === sp.dstId[i]);
          if (ia < 0 || ib < 0) continue;
          const pa = proj[ia], pb = proj[ib];
          if (!pa || !pb) continue;   // dynamic node not yet projected
          const r = sp.rgb[i * 3], g = sp.rgb[i * 3 + 1], b = sp.rgb[i * 3 + 2];
          const scale = (pa.scale + pb.scale) * 0.5 * ink;

          if (sp.phase[i] === PHASE_TRAVEL) {
            // The RAIL first, so the packet adds over it. This layer blends
            // with GL CustomBlending One/One (SphereStrimer.jsx), which
            // commutes exactly like the 2D canvas's `lighter` op does
            // elsewhere in this file — so this ordering is for legibility
            // rather than correctness.
            let o = sp.instances * STRIMER_STRIDE;
            sp.data[o] = pa.sx; sp.data[o + 1] = pa.sy;
            sp.data[o + 2] = pb.sx; sp.data[o + 3] = pb.sy;
            sp.data[o + 4] = RAIL_WIDTH * scale;
            sp.data[o + 5] = RAIL_GAIN;
            sp.data[o + 6] = r; sp.data[o + 7] = g; sp.data[o + 8] = b;
            sp.data[o + 9] = PROFILE_RAIL;
            sp.instances++;

            const u = sp.u[i];
            const hx = pa.sx + (pb.sx - pa.sx) * u;
            const hy = pa.sy + (pb.sy - pa.sy) * u;
            const L = Math.hypot(pb.sx - pa.sx, pb.sy - pa.sy) * PACKET_FRACTION;
            const dx = pb.sx - pa.sx, dy = pb.sy - pa.sy;
            const n = Math.max(Math.hypot(dx, dy), 1e-6);
            o = sp.instances * STRIMER_STRIDE;
            sp.data[o] = hx; sp.data[o + 1] = hy;
            sp.data[o + 2] = hx - dx / n * L; sp.data[o + 3] = hy - dy / n * L;
            sp.data[o + 4] = HEAD_WIDTH * scale;
            sp.data[o + 5] = HEAD_GAIN;
            sp.data[o + 6] = r; sp.data[o + 7] = g; sp.data[o + 8] = b;
            sp.data[o + 9] = PROFILE_PACKET;
            sp.instances++;
          } else {
            // The PING: head == tail, which the same capsule arithmetic
            // renders as a disc. One shader, three profiles.
            // `ping` is already the remaining fraction in [0,1] — it fades on
            // the clock, not on a frame count. See artStrimer.js's PING_MS.
            const k2 = sp.ping[i];
            const o = sp.instances * STRIMER_STRIDE;
            sp.data[o] = pb.sx; sp.data[o + 1] = pb.sy;
            sp.data[o + 2] = pb.sx; sp.data[o + 3] = pb.sy;
            sp.data[o + 4] = PING_RADIUS * scale;
            sp.data[o + 5] = PING_GAIN * k2;
            // r/g/b written for layout parity with the other two profiles,
            // but inert: the shader forces vec3(1.0) for profile >= 1.5
            // (SphereStrimer.jsx), so the ping is deliberately achromatic
            // and never reads these three floats.
            sp.data[o + 6] = r; sp.data[o + 7] = g; sp.data[o + 8] = b;
            sp.data[o + 9] = PROFILE_PING;
            sp.instances++;
          }
        }
      }

      const _pcen = nodeCensusRef.current;
      // ON THE GPU, in the ADDITIVE stream. The 2-D form set
      // `globalCompositeOperation = 'lighter'` and `ag` is where that blend
      // lives. Appended after the node loop, which is where the 2-D order put
      // it — and `lighter` COMMUTES, so position within this stream cannot
      // change the result anyway.
      //
      // The accumulation gain survives: BackdropPass renders `ag` INTO the
      // trail accumulator, so these keep the 1/m standing gain the 2-D canvas's
      // partial `destination-out` clear gave them. That is the deficit that
      // cost steps 3 and 4, and it is measured in this step's report rather
      // than assumed.
      //
      // Every additive instance written from here on is a PARTICLE (a
      // velocity-stretched segment, or the degenerate disc streakTail falls
      // back to below). Publishing the boundary is what keeps a reader from
      // having to shape-match a streak's width against a prism chord core's —
      // exactly as discStart does for the source-over stream.
      ag.particleStart = ag.count;
      for (let pi = 0; pi < MAX_PARTICLES; pi++) {
        if (pool.lifes[pi] >= pool.maxLifes[pi] || pool.maxLifes[pi] === 0) continue;
        const alpha = particleAlpha(pool.lifes[pi] / pool.maxLifes[pi]);
        if (!particleVisible(alpha)) continue;

        const [prx, pry, prz] = applyM(M, pool.xs[pi], pool.ys[pi], pool.zs[pi]);
        const pp = project(prx, pry, prz, w, h, sphereR, focal);
        if (!particleInFront(pp.depth)) continue;

        const sz  = particleSize(pool.sizes[pi], pp.scale * ink);
        const hue = quantHue(pool.hues[pi]);
        const sat = quantHue(pool.sats[pi]);

        // The cap guard mirrors the node halo's: `count` only rises, so a
        // particle dropped at the cap cannot have its core written without its
        // glow, which would leave a bare dot where a lit particle should be.
        if (ag.count + 1 >= MAX_ADDITIVE_EDGES) break;

        // The previous frame's projected position, so the glow can stretch
        // along the particle's own displacement rather than sit as a disc.
        const [qrx, qry, qrz] = applyM(M, pool.pxs[pi], pool.pys[pi], pool.pzs[pi]);
        const qp = project(qrx, qry, qrz, w, h, sphereR, focal);
        // `_dtFrames` normalises the displacement to ONE AUTHORED FRAME, so a
        // streak is the same length at 60Hz and at 360Hz. See streakTail.
        const _st = streakTail(pp.sx, pp.sy, qp.sx, qp.sy, _dtFrames);

        if (_st.degenerate) {
          // Too short to be a segment — and a zero-length segment is NOT a
          // disc. See streakTail.
          writeDisc(ag.data, ag.count * EDGE_STRIDE, {
            cx: pp.sx, cy: pp.sy,
            rOuter: particleGlowRadius(sz),
            hsl: { hue, sat, lit: GLOW_STOPS[0].lightness },
            alpha: quantAlpha(alpha * GLOW_STOPS[0].alphaScale),
            mid: {
              at: GLOW_STOPS[1].at,
              hsl: { hue, sat, lit: GLOW_STOPS[1].lightness },
              alpha: quantAlpha(alpha * GLOW_STOPS[1].alphaScale),
            },
            outerK: GLOW_OUTER_K,
            outerAlpha: quantAlpha(alpha * GLOW_STOPS[2].alphaScale),
            flags: PARTICLE_FLAGS,
          });
        } else {
          // The streak, as ONE segment: tail to head, with the gradient running
          // dark-to-bright along it. NO gaussian shoulder: PARTICLE_FLAGS packs
          // glow = 0 and edgeFrag gates the whole shoulder term behind
          // step(0.001, vGlow), so what replaces the disc's soft radial ramp is a
          // hard box-filtered line at a seventh of its half-width. See
          // artParticleDraw's note on the fidelity loss.
          const o = ag.count * EDGE_STRIDE;
          const ad = ag.data;
          ad[o] = _st.x; ad[o + 1] = _st.y; ad[o + 2] = pp.sx; ad[o + 3] = pp.sy;
          writeHsl(ad, o + 4,  hue, sat, GLOW_STOPS[2].lightness);   // tail
          writeHsl(ad, o + 7,  hue, sat, GLOW_STOPS[1].lightness);   // mid
          writeHsl(ad, o + 10, hue, sat, GLOW_STOPS[0].lightness);   // head
          ad[o + 13] = packAlphas(
            quantAlpha(alpha * GLOW_STOPS[2].alphaScale),
            quantAlpha(alpha * GLOW_STOPS[1].alphaScale),
            quantAlpha(alpha * GLOW_STOPS[0].alphaScale),
          );
          ad[o + 14] = sz;
          ad[o + 15] = PARTICLE_FLAGS;
          ad[o + 16] = 0;   // phase — a straight stroke starts its dash at 0
          // Float 17 is a DISC's shadow colour. The buffer is reused frame to
          // frame, so a segment landing where a disc was would inherit it:
          // invisible in the render (vIsDisc mixes it out) but not invisible to
          // the world hash, which reads the raw buffer.
          ad[o + 17] = 0;
        }
        ag.count++;
        _pcen.particleGlow++;

        // Hard core — a filled disc, one colour, no ramp.
        //
        // Alpha corrected for the shader's straight-edge box filter, which
        // over-inks a disc by 1/12 px^2 whatever its size: nothing at a node
        // core's 8-25px, and 52% at this layer's 0.4px floor. See
        // discInkCorrection. MEASURED: without it the migration raised
        // whole-frame ink 1.6-2.7%.
        writeDisc(ag.data, ag.count * EDGE_STRIDE, {
          cx: pp.sx, cy: pp.sy,
          rOuter: sz,
          hsl: { hue, sat, lit: CORE_LIGHTNESS },
          alpha: quantAlpha(alpha * CORE_ALPHA_SCALE * discInkCorrection(sz)),
          flags: PARTICLE_FLAGS,
        });
        ag.count++;
        _pcen.particleCore++;
      }

      // ── Bifurcation Conductor (logic in artAwakening.js) ────────────────
      // Counted at the write itself, not re-derived from the conditions —
      // three of these four sub-layers are in no capture state, so this census
      // is the only thing that can say whether a reference image had them.
      //
      // Appended LAST in the source-over stream because that is where the 2-D
      // canvas drew it, and source-over does not commute. It is screen space,
      // not sphere geometry: the strip sits at the right edge, and the edge
      // shader writes clip space from CSS px against the same uResolution this
      // loop uses, so these coordinates cross over with no projection at all.
      // WHERE THE WORLD ENDS. Everything written up to here is projected sphere
      // geometry; everything after it is the conductor, which is screen-space
      // furniture at a fixed right-edge strip and is not part of the graph.
      //
      // This exists because moving the conductor into this buffer BROKE the
      // world hash, and the gate caught it: 12 of 21 cells refused to certify
      // with "the runs drew different worlds" at pixel correlations of 0.98 to
      // 0.9996, and the tell was that every failing cell had an identical edge
      // count while every passing one had conductorY clamped to exactly 1. The
      // thumb's position is a continuous function of the Feigenbaum r, and r
      // drifts run to run; hashing it turned a discrete question — did these
      // two runs draw the same graph? — into a floating-point one.
      //
      // The WRITER declares the boundary rather than the reader guessing it,
      // exactly as discStart does one level up.
      eg.worldCount = eg.count;

      const _cst = conductorState(collectiveRef.current,
        conductorForceRef.current?.dragging ?? conductorDragRef.current, w, h);

      // 1. The thumb — a filled disc, and the only sub-layer any capture on
      // this branch has ever contained. Dormant, it draws at alpha 0.03.
      if (eg.count < MAX_EDGES) {
        writeDisc(eg.data, eg.count * EDGE_STRIDE, {
          cx: _cst.thumb.cx, cy: _cst.thumb.cy, rOuter: _cst.thumb.r,
          hsl: _cst.thumb.hsl,
          // 1.5-4px, so the shader's straight-edge box filter over-inks it by
          // 1/12 px^2 — the same correction step 6 derived for particle cores.
          alpha: _cst.thumb.alpha * discInkCorrection(_cst.thumb.r),
          flags: CONDUCTOR_FLAGS,
        });
        eg.count++;
        _pcen.conductorThumb++;
      }

      // 2. the track and 3. the fill bar — 1px vertical strokes. writePolyline
      // reports what it actually wrote, so a full buffer shows up as a census
      // of 0 rather than as a layer that silently is not there.
      if (_cst.track) {
        _pcen.conductorTrack += writePolyline(eg,
          [_cst.track.x, _cst.track.y0, _cst.track.x, _cst.track.y1], 2,
          CONDUCTOR_TRACK_RGB, _cst.track.alpha, _cst.track.width, CONDUCTOR_FLAGS);
      }
      if (_cst.fill) {
        _pcen.conductorFill += writePolyline(eg,
          [_cst.fill.x, _cst.fill.y0, _cst.fill.x, _cst.fill.y1], 2,
          hslUnitRgb(_cst.fill.hsl), _cst.fill.alpha, _cst.fill.width,
          CONDUCTOR_FLAGS);
      }

      // 4. The peer-push glow — the FIRST shadowed disc this renderer draws.
      // ctx.fill() under a shadow paints the shape in fillStyle and the blur in
      // shadowColor, which on this layer are two different colours, so the
      // instance carries both: the core in c0 and the shadow in float 17. See
      // "The 18th float" and DISC_SHADOW_K in SphereEdges.js.
      if (_cst.glow && eg.count < MAX_EDGES) {
        writeDisc(eg.data, eg.count * EDGE_STRIDE, {
          cx: _cst.glow.cx, cy: _cst.glow.cy, rOuter: _cst.glow.r,
          hsl: _cst.glow.hsl,
          shadowHsl: _cst.glow.shadowHsl,
          alpha: _cst.glow.alpha * discInkCorrection(_cst.glow.r),
          flags: CONDUCTOR_GLOW_FLAGS,
        });
        eg.count++;
        _pcen.conductorGlow++;
      }

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
    // Pin the sphere's own random stream. `window.__reseed` in the determinism
    // shim calls this, so every harness that already says "reseed" to mean "pin
    // the world" keeps meaning it now that the world is drawn from artRandom
    // rather than the global Math.random. Passing no seed pins it to ART_SEED,
    // matching the shim's own default.
    window.__artSeedRandom = (seed) => seedArtRandom(seed ?? ART_SEED);

    // Every initState call this page has made, as the artRandom stream offset
    // at its entry. An instrument reads the LENGTH at two points and takes the
    // delta; nothing here resets it, deliberately, because __artHarnessReset's
    // behaviour is load-bearing for the reference images and this must not be
    // able to change a picture. `rng` is the live stream state, so a probe can
    // ask where the stream is without taking a draw from it.
    window.__artInitLog = () => ({
      calls: __initStateLog.length,
      renders: __streamProbe.renders,
      offsets: __initStateLog.slice(),
      rng: artRandomState(),
    });

    window.__artHarnessReset = () => {
      rotRef.current = { rx: 0.18, ry: 0 };
      dragRef.current = { active: false, lastX: 0, lastY: 0, vx: 0, vy: 0 };
      particlesRef.current = createParticlePool();
      // THE EMISSION CADENCES. This line was `particleFrameRef.current = 0`,
      // and it is the same reset for the same reason — only the state it
      // clears is now an accumulator and a clock seed rather than an integer.
      //
      // The seed matters as much as the accumulator: the app boots under REAL
      // timing, so `clock.t` holds a real-clock stamp by the time the harness
      // takes over. Left seeded, the first virtualised frame would measure dt
      // against it and bill the gap — clamped, but arbitrary. Cleared, the
      // first frame after this reset bills exactly one 60fps frame, which is
      // precisely what the old counter contributed here, so the reset's
      // behaviour is unchanged and stays reproducible.
      resetFrameClock(particleClockRef.current.clock);
      for (const k of ['reasoning', 'edge', 'filament', 'idleA', 'idleB']) {
        resetRateGate(particleClockRef.current[k]);
      }
      // The genesis cascade keeps its clock and gate on `aw`, for the same
      // reason and with the same effect.
      resetAwakeningCadence(awakeningRef.current);
      firedRef.current = null;
      fusionSourceRef.current = null;
      probeNodeRef.current = null;
      // THE AWAKENING'S BREATH PHASE, which this reset used to leave alone.
      // `breathPhase` advances 0.015 every draw from mount, and the app boots
      // under REAL timing at ~350 unthrottled fps, so by the time the harness
      // takes over it holds a few thousand real frames' worth of an arbitrary
      // angle. It drives `breathMod`, which scales `sphereR`, which scales
      // every projected node position: MEASURED, two runs of the same build
      // began frame 0 with sphereR 247.142 vs 246.828 and every edge endpoint
      // displaced by exactly that ratio. The graph physics has discrete
      // thresholds (edges are born and die), so that 0.13% eventually flips one
      // and the two runs become different worlds — which is what made the
      // immersive rows, the LAST two states captured, uncorrelated on identical
      // code. The emission cadences above were the same kind of leak: a
      // mount-time frame counter that gated emission by modulus, which is now
      // a clock and a set of accumulators — reset here for the same reason.
      //
      // `t0` is deliberately NOT reset: elapsedS is what holds the sphere at
      // awakening phase 3, and restarting it would replace the captured world
      // rather than stabilise it.
      //
      // `beaconIdx` is a third leak of this family — ONE draw taken at mount,
      // from `artRandom` since `7f5f2ce` (this comment read `Math.random` until
      // that was corrected) and from a LAZY useRef initializer since the fix, so
      // it is no longer one draw per render. It is deliberately LEFT ALONE here:
      // re-drawing it in this reset from the seeded stream consumes a value that
      // `initState()` would otherwise have taken, which shifts every draw after
      // it: MEASURED, that alone took `artPresence` from 19/19 to 15/19
      // (RESONANCE EDGE, PRISM GEOMETRY, ANALOGY FILAMENTS, CHIMERA FRINGES all
      // undetected). It costs nothing to
      // leave: the beacon only draws in awakening phase 1, and every capture
      // state is at phase 3. If it is ever worth pinning, pin it to a CONSTANT
      // — do not spend a random draw inside this reset.
      awakeningRef.current.breathPhase = 0;
      // THE SPHERE'S OWN RANDOM STREAM, pinned to a known offset.
      //
      // Everything above resets state that ACCRUES. This resets what the world
      // is drawn FROM, and without it the rest cannot finish the job: the draw
      // path takes threshold decisions from the stream, and until `artRandom`
      // existed those came from the global `Math.random` that three.js also
      // draws a UUID from for every object it allocates. MEASURED, post-step-5
      // task 3: four captures of one build agreed bit-for-bit through all five
      // normal states and then produced THREE DIFFERENT WORLDS at
      // `immersive-off` — same rotation, same sphere radius, same buffer sizes,
      // same layer census, different edge COUNT, because the immersive resize
      // reallocates render targets and displaced the stream under a threshold.
      //
      // The stream is seeded from Math.random at mount, so the piece is exactly
      // as varied as it ever was in the browser; only this reset pins it.
      seedArtRandom(ART_SEED);
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

    // Drives the analogical-reasoning bus directly, for the same reason
    // __artSetEcocide and __artSetGhosts exist: two layers read it that no
    // capture state can arm.
    //
    // MEASURED over 3551 harness frames, which is why this is here and not an
    // assumption:
    //   - analogy filaments: 96 exist, 0 EVER DRAW. `fil.nodeA` is an index
    //     into the 272-node corpus and the draw loop's `nodes` is the ~31-node
    //     sphere, so the `iA >= nodes.length` guard drops all of them (the
    //     smallest index seen was 48). Pre-existing, same family as the /art
    //     `query` probe that never renders; not this task's to fix.
    //   - chimera zones: live, but only in a burst — 160 of 3551 frames, all
    //     inside the first ~200, peaking at 49 zones and strength 0.71 while
    //     the clusters are still finding phase. After they lock at
    //     orderParam 1 there is no boundary and the layer is empty forever.
    //
    // Writes the same refs the simulation writes, so the whole draw path is
    // exercised. `_updateAnalogies` rebuilds the filament list every 64 frames
    // and `_updateChimera` the zone list every 8, so an injection is good for a
    // handful of frames — long enough to pump and capture, deliberately not
    // sticky, because a sticky override would be a second source of truth.
    window.__artSetAnalogy = ({ filaments, zones } = {}) => {
      const r = reasoningRef.current;
      if (!r) return null;
      if (filaments) r.analogyFilaments = filaments;
      if (zones) r.chimeraZones = zones;
      return { filaments: r.analogyFilaments.length, zones: r.chimeraZones.length };
    };

    // ── Step 5 forcing hooks ────────────────────────────────────────────
    // Eight of the node block's thirteen draw layers cannot be reached by any
    // capture state (see .superpowers/sdd/step5-preflight.md §5), so a parity
    // run across them is worth nothing: deleting the layer scores identically
    // to shipping it. These exist so a control capture can SEE the layer it is
    // being asked to certify. Same contract as __artSetEcocide and
    // __artSetAnalogy: write the ref the real path writes, and do not be
    // sticky — the simulation is allowed to overwrite an injection on its next
    // step, because a sticky override is a second source of truth.

    // The chimera sync/flicker rings read clusterSync, which __artSetAnalogy
    // does NOT touch (it writes filaments and zones). Without this the two
    // rings are unreachable from the harness.
    window.__artSetChimera = (map) => {
      const r = reasoningRef.current;
      if (!r) return null;
      for (const [cid, v] of Object.entries(map ?? {})) {
        const cur = r.clusterSync[cid];
        if (cur) r.clusterSync[cid] = { ...cur, ...v };
      }
      return Object.fromEntries(Object.entries(r.clusterSync)
        .map(([k, v]) => [k, { orderParam: v.orderParam, isSync: v.isSync, isChimera: v.isChimera }]));
    };

    // The Gestalt ghost rings. NOT __artSetGhosts, which seeds last session's
    // ghost TRAIL positions — a different layer entirely, and the two are one
    // careless call site away from being confused.
    //
    // Organically these need a VERIFIED analogy (recon > CONVERGENCE_THRESHOLD
    // in useAnalogicalReasoning.js), and the analogy machinery has never been
    // observed firing on this branch — the filaments it produces are indexed
    // into the 272-node corpus and dropped by the sphere's length guard. So
    // this is the only way the ring layer draws at all.
    window.__artSetGhostNodes = (values) => {
      const r = reasoningRef.current;
      if (!r?.ghostNodes) return 0;
      const g = r.ghostNodes;
      // Clearing has to take BOTH arrays down. _animateGhosts walks ghostNodes
      // toward ghostTargets every step, so zeroing the values alone lets the
      // animator restore them within a few frames — measured: the ghost rings
      // leaked into every later shot of the forcing run that first found this.
      if (values === null) {
        g.fill(0);
        if (r.ghostTargets) r.ghostTargets.fill(0);
        return 0;
      }
      const src = values ?? Array.from({ length: g.length }, (_, i) => (i % 4 === 0 ? 0.75 : 0));
      for (let i = 0; i < g.length; i++) g[i] = src[i] ?? 0;
      // Hold the animator at these values for the frames about to be captured;
      // _animateGhosts walks ghostNodes toward ghostTargets every step.
      if (r.ghostTargets) for (let i = 0; i < g.length; i++) r.ghostTargets[i] = g[i];
      let live = 0;
      for (let i = 0; i < g.length; i++) if (g[i] > 0.02) live++;
      return live;
    };

    // The fusion source pulse ring and its cursor thread. The real path is a
    // long-press, which is a timer continuation: __pump runs its rAF callbacks
    // in ONE synchronous loop and never yields, so no pump count can reach it.
    // Takes an OPTIONS OBJECT so the caller never has to know a node id: an
    // omitted `source` defaults to a real sphere node, `source: null` clears.
    // The harness only has display LABELS to hand (they are what the DOM
    // exposes), and a label is not an id — resolving it here keeps that
    // confusion out of every call site.
    window.__artForceFusion = ({ source, cursor } = {}) => {
      const id = source === null ? null : (source ?? SPHERE_NODES[0]?.id ?? null);
      fusionSourceRef.current = id;
      fusionCursorRef.current = id ? (cursor ?? null) : null;
      return { source: fusionSourceRef.current, cursor: fusionCursorRef.current };
    };

    // The probe node, its halo and its tethers. Runs the REAL projection —
    // queryProject is the same call the `query <text>` command makes — so the
    // anchors, weights and centroid are the shipping ones, not a fixture.
    window.__artForceProbe = (text) => {
      if (text === null) { probeNodeRef.current = null; return null; }
      const result = queryProject(text ?? 'mercury');
      probeNodeRef.current = result;
      return { query: result?.query ?? null, anchors: result?.anchors?.length ?? 0 };
    };

    // Synthetic disc/ring instances, straight into the edge buffer. The four
    // shader branches this exercises (inner radius, arc sweep, angular dash,
    // radial falloff) are written in task 3 but not DRAWN by anything until
    // tasks 5-7, so without this they would ship three tasks deep and
    // unverified — and each of those tasks would then be debugging its own
    // layer against an unproven primitive.
    window.__artSetDiscProbe = (specs) => {
      discProbeRef.current = specs && specs.length ? specs : null;
      return discProbeRef.current ? discProbeRef.current.length : 0;
    };

    // Particles with KNOWN hues, positions and lives, written straight into the
    // pool.
    //
    // The ambient emitter cannot serve a measurement. `_idleHueDrift`
    // (artParticles.js:71) is a module-level mount-time accumulator the harness
    // reset does not clear, and it sets particle HUE, so ambient particle
    // colour differs run to run. That was measured, and clearing it was then
    // tried and MEASURED WORSE — it makes idle's per-channel spread ~2.5x wider
    // (see docs/superpowers/plans/handover-post-rng.md). Step 6's whole subject
    // is a colour ramp, so the colour has to be pinned by the probe instead.
    //
    // Kills the pool first: a measurement of "the particles I asked for" must
    // not be contaminated by whatever the ambient emitter left alive, and
    // `stepParticles` skips a slot only when life >= maxLife, so zeroing
    // maxLifes is what actually empties it.
    window.__artForceParticles = (specs = []) => {
      const p = particlesRef.current;
      for (let i = 0; i < p.maxLifes.length; i++) p.maxLifes[i] = 0;
      specs.forEach((s, i) => {
        if (i >= p.xs.length) return;
        p.xs[i] = s.x; p.ys[i] = s.y; p.zs[i] = s.z;
        p.vxs[i] = 0; p.vys[i] = 0; p.vzs[i] = 0;
        // THE PULL AND THE TARGET HAVE TO BE CLEARED TOO, on the same principle
        // as the zeroed velocity: this probe exists to PIN a particle's position
        // and colour, and a slot recycled from real edge traffic carries
        // pull = 1 and that traffic's destination node. Left set, a forced
        // particle drifts ~2% of the way toward a node it was never given, every
        // frame — the instrument silently moving the thing it is there to hold
        // still. Found by the whole-branch review; nothing calls this today,
        // which is exactly why nothing caught it.
        p.pulls[i] = 0;
        p.txs[i] = 0; p.tys[i] = 0; p.tzs[i] = 0;
        // The streak's tail anchor. Seeded to the head so a forced particle
        // renders as its degenerate disc rather than streaking from wherever
        // the previous occupant of this slot happened to be.
        p.pxs[i] = s.x; p.pys[i] = s.y; p.pzs[i] = s.z;
        // hueTarget === hue, so stepParticles' blend is a no-op and the colour
        // the probe asked for is the colour the frame draws.
        p.hues[i] = s.hue; p.hueTargets[i] = s.hue;
        p.sats[i] = s.sat; p.sizes[i] = s.size;
        p.lifes[i] = s.life; p.maxLifes[i] = s.maxLife;
      });
      p.count = specs.length;
      return p.count;
    };

    // The conductor — the last layer with no capture state. See
    // conductorForceRef for why this drives feedPeerEntropy's inputs rather
    // than writing collectiveR, and why `y` is not forceable.
    //
    // `dragging` also overrides conductorDragRef at the draw site, so a pointer
    // handler cannot clear it mid-capture.
    window.__artForceConductor = ({ dragging = false, peerCount = 5,
                                    entropy = 1 } = {}) => {
      conductorForceRef.current = { dragging, peerCount, entropy };
      return conductorForceRef.current;
    };
    window.__artReleaseConductor = () => { conductorForceRef.current = null; };

    // The overwrite bleed — `renderCol` lerped toward the source node's colour.
    // Organically this needs an overwrite event, which no capture state fires.
    // Writes the live sphere node the draw loop reads, so the real lerp runs.
    window.__artForceBleed = (amount = 0.8) => {
      const ns = stateRef.current?.nodes;
      if (!ns?.length) return 0;
      let n = 0;
      for (let i = 0; i < ns.length; i += 3) {
        ns[i].bleedAmount = amount;
        ns[i].bleedFrom = ns[(i + 1) % ns.length].id;
        n++;
      }
      return n;
    };

    // The awakening beacon ring. MEASURED: it does draw organically, for one
    // node, between elapsed 4.1s and 8.0s of a real boot — but every harness
    // capture virtualises the clock first and lands after that window has
    // closed, so no image of the layer exists without this. Re-opens the
    // window in place rather than resetting the whole sim, because
    // __artHarnessReset's behaviour is load-bearing for the reference images.
    window.__artForceBeacon = (on = true) => {
      const aw = awakeningRef.current;
      if (!on) { aw.phase = 3; return { phase: aw.phase }; }
      aw.phase = 1;
      aw.interacted = false;
      aw.t0 = performance.now() - 5000;   // mid-window, so stepAwakening holds it
      return { phase: aw.phase, beaconIdx: aw.beaconIdx };
    };

    // The 400ms birth lerp. Organically this needs a bifurcation child, which
    // no capture state spawns.
    window.__artForceBirth = (childId, parentId) => {
      // SPHERE_NODES, not NODES: the birth map is read against the LIVE sphere
      // array, and a 272-corpus index or id used there is the exact confusion
      // sphereIndexOf() exists to prevent.
      const parent = SPHERE_NODES.find(n => n.id === parentId) ?? SPHERE_NODES[0];
      const child  = childId ?? SPHERE_NODES[1]?.id;
      if (!parent || !child) return null;
      birthMapRef.current.set(child, {
        parentId: parent.id, px: parent.x, py: parent.y, pz: parent.z,
        t0: performance.now(),
      });
      return { child, parent: parent.id, size: birthMapRef.current.size };
    };

    // The node block's own census — which of the thirteen layers the LAST
    // frame actually contained, counted at each draw call rather than
    // re-derived from its conditions. This is the instrument the whole of
    // step 5 leans on: `artCompare` cannot distinguish "the layer is faithful"
    // from "the layer was never on screen", and this can.
    //
    // `awakening` rides along because the beacon ring's window (phase 1,
    // elapsed 4-8s, and only while !interacted) is a timing question no static
    // reading of the source can answer.
    window.__artNodeState = () => ({
      ...nodeCensusRef.current,
      awakening: {
        phase: awakeningRef.current.phase,
        interacted: awakeningRef.current.interacted,
        elapsedS: +((performance.now() - awakeningRef.current.t0) / 1000).toFixed(2),
        beaconIdx: awakeningRef.current.beaconIdx,
      },
      resonance: {
        armed: resonanceModeRef.current,
        selected: resonanceNodesRef.current.length,
      },
      // The conductor's own inputs. `y` is reported rather than forced — it is
      // a pure function of the Feigenbaum r, so a probe that set it would be
      // moving the graph. `forced` says whether the override is live, so a
      // capture cannot quietly record probe state as organic state.
      conductor: {
        y: +collectiveRef.current.conductorY.toFixed(4),
        collectiveR: +collectiveRef.current.collectiveR.toFixed(6),
        dragging: conductorForceRef.current?.dragging ?? conductorDragRef.current,
        forced: !!conductorForceRef.current,
      },
    });

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
        // WHERE THE SPHERE IS POINTING, and the two inputs that move it.
        // The draw loop already publishes `rot` to the GL layer every frame; it
        // just was not readable from outside, and a capture set that recorded
        // only the virtual clock could not tell two runs apart. Reading it is
        // what RULED THE CAMERA OUT: two runs whose immersive frames were as
        // uncorrelated as two unrelated states (r = 0.047) recorded the SAME
        // rx and ry at every shot, which is what redirected the search from the
        // camera to the world. `dragV` and `hovered` are here because they are
        // the only two things besides the frame count that move `rot` — spin is
        // damped to 15% while a node is hovered — so a future divergence can be
        // attributed rather than guessed at. See
        // baseline/art-sphere-step5/README.md.
        rot: s.rot ? { rx: s.rot.rx, ry: s.rot.ry } : null,
        dragV: { active: dragRef.current.active, vx: dragRef.current.vx, vy: dragRef.current.vy },
        hovered: hoveredRef.current,
        ghostsLive: live,
        ghostFirst: g ? Array.from(g.slice(0, 8)) : null,
        archLoaded: !!archaeologyRef.current?.loaded,
        archLen: archaeologyRef.current?.ghostPositions?.length ?? 0,
      };
    };

    // The same question for the edge layer, which is instance data rather than
    // uniforms. "The edges vanished" has three unrelated causes — nothing was
    // published, it was published in the wrong coordinate space, or it was
    // published and did not survive the blend — and only the first two are
    // visible from here.
    //
    // `rings` is the travelling-pulse disc count for the frame, and it answers a
    // different question: whether the layer was ON SCREEN AT ALL when a parity
    // number was taken. Rings only exist while a cascade is in flight, so a
    // capture that caught none scores perfect parity for them whether they draw
    // or are deleted — which is the failure this project has now repeated six
    // times. Any instrument quoting a number for this layer must read this
    // first and fail loudly on 0.
    window.__artEdgeState = () => {
      const e = edgeGLRef.current, a = addGLRef.current;
      return {
        count: e.count, rings: e.rings, discStart: e.discStart, w: e.w, h: e.h,
        // The stride the buffers below are actually written at. Published
        // because an IN-PAGE reader cannot import it, and the alternative is a
        // hand-copied literal: artSmoke carried `S = 17` at two decode sites
        // and step 7's bump to 18 turned its edge hit-test into a scan of
        // misaligned floats, which read as a live sphere with a dead hover.
        // A harness-side reader should keep importing EDGE_STRIDE directly.
        stride: EDGE_STRIDE,
        // Instances that are the projected GRAPH. `instances` still carries
        // everything, so an instrument can look at the conductor too — but a
        // hash meant to answer "same world?" must stop here. See the note at
        // the write site.
        worldCount: e.worldCount,
        first: Array.from(e.data.slice(0, EDGE_STRIDE)),
        // The whole written range, so an instrument can find WHERE the rings
        // are and look at those pixels. Decoded harness-side against
        // EDGE_STRIDE rather than here, so there is no second layout to drift.
        instances: Array.from(e.data.subarray(0, e.count * EDGE_STRIDE)),
        // The additive stream, same layout, same reason: the resonance edge is
        // even more invisible to the comparator than the rings are — no
        // capture state arms resonance at all, so deleting the layer scores
        // identically to shipping it. An instrument has to be able to ask
        // whether the two strokes were written, and where they are, before it
        // is allowed to quote a number about their pixels.
        // `dropped` is this stream's ring-count equivalent: instances the
        // writer could not fit. A Float32Array write past the end is a silent
        // no-op, so without this an over-cap frame renders a prism with pieces
        // missing and every other number agreeing that nothing went wrong.
        additive: {
          count: a.count, dropped: a.dropped, capacity: a.data.length / EDGE_STRIDE,
          // Where the particle layer's writes begin in this stream — see the
          // write site's comment. Lets a reader tell a particle streak from a
          // prism chord core without shape-matching the two, which genuinely
          // overlap in width and share PARTICLE_FLAGS.
          particleStart: a.particleStart,
          instances: Array.from(a.data.subarray(0, a.count * EDGE_STRIDE)),
        },
      };
    };

    // The strimer, for the harness. `instances` answers a different question
    // from `count`: whether the layer had anything ON SCREEN when a number was
    // taken. A transient that has already passed is not in the frame being
    // graded, and this is what says so.
    window.__artStrimerState = () => {
      const sp = strimerRef.current;
      const packets = [];
      for (let i = 0; i < sp.count; i++) {
        packets.push({
          src: sp.srcId[i], dst: sp.dstId[i],
          u: +sp.u[i].toFixed(4), phase: sp.phase[i], ping: +sp.ping[i].toFixed(3),
        });
      }
      return { count: sp.count, instances: sp.instances, w: sp.w, h: sp.h, packets };
    };

    // ── The emission cadences, for a LIVE rate probe ─────────────────────
    //
    // This exists because the capture harness cannot answer the question this
    // branch was opened to answer. determinism.mjs virtualises the clock at
    // exactly 1000/60, so artCompare always renders 60fps frames and is
    // STRUCTURALLY BLIND to refresh-rate dependence: it can prove this change
    // did not move the 60fps picture, and it can never prove the bug is fixed.
    //
    // The proof has to come from a headed browser running rAF at whatever the
    // panel gives, comparing fires-per-WALL-SECOND against the authored rate
    // (60/period) and against what the frame counter would have produced
    // (fps/period). `fires` is monotonic, so a caller samples twice and takes
    // the delta; `t` is the cadence clock's own last stamp, so the window the
    // caller measures is the window the gates actually saw.
    window.__artCadenceState = () => {
      const pc = particleClockRef.current;
      const aw = awakeningRef.current;
      const read = (g) => ({ period: g.period, fires: g.fires, acc: +g.acc.toFixed(6) });
      return {
        t: pc.clock.t,
        seeded: pc.clock.seeded,
        // Monotonic count of every particle emitted by ANY path, which is the
        // only way to see the seventh cadence: the node-burst emitter is a
        // per-draw coin flip with no gate, so it has no `fires` of its own.
        emitted: particlesRef.current.emitted,
        gates: {
          reasoning: read(pc.reasoning),
          edge:      read(pc.edge),
          filament:  read(pc.filament),
          idleA:     read(pc.idleA),
          idleB:     read(pc.idleB),
          genesis:   read(aw.genesisGate),
        },
      };
    };

    // Fire a node's wavefront directly, for the harness. The alternative is a
    // hover-grid click, which costs a node-finding sweep and makes WHICH node
    // fired depend on where the grid happened to land -- so a probe of the
    // effect would be measuring the grid too.
    window.__artFireStrimer = (id) => {
      fireNode(id, { neighbours: false });
      // The SPAWN count, not strimerRef.current.count (the whole pool's live
      // size) — a residual in-flight packet from an earlier fire would
      // otherwise misalign a caller's per-edge index (e.g. _s3strimer.mjs's
      // chord table) against this call's own destinations.
      return fireStrimer(id);
    };

    return () => {
      delete window.__artStrimerState;
      delete window.__artCadenceState;
      delete window.__artFireStrimer;
      delete window.__artHarnessReset;
      delete window.__artSeedRandom;
      delete window.__artInitLog;
      delete window.__artSetEcocide;
      delete window.__artSetGhosts;
      delete window.__artSetAnalogy;
      delete window.__artBgState;
      delete window.__artEdgeState;
      delete window.__artSetChimera;
      delete window.__artSetGhostNodes;
      delete window.__artForceFusion;
      delete window.__artForceProbe;
      delete window.__artForceBirth;
      delete window.__artForceBeacon;
      delete window.__artForceBleed;
      delete window.__artSetDiscProbe;
      delete window.__artForceParticles;
      delete window.__artForceConductor;
      delete window.__artReleaseConductor;
      delete window.__artNodeState;
    };
  }, [initState, archaeologyRef, reasoningRef, stateRef]);

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
    const { w, h } = dimsRef.current;
    const ink = inkScale(w, h);
    // Sort by depth desc so we hit nearest node first
    const sorted = [...projected].sort((a, b) => b.depth - a.depth);
    for (const { node, sx, sy, depth, scale } of sorted) {
      if (depth < -0.85) continue;  // skip deeply back-face nodes
      // Forgiving hitbox: 3× visual radius — invisible bubble around each node
      // so users don't need pixel-perfect aim on a spinning sphere
      // THROUGH nodeRadius(), not a hand-copy of it. This used to restate
      // `(5 + energy * 4)`, which is NODE_RADIUS_BASE and
      // NODE_RADIUS_ENERGY_K written out — so moving either constant would
      // have resized every drawn disc and left every hit target behind, with
      // nothing to catch it.
      //
      // `ink` for the same reason the draw loop applies it: item 5b scales
      // the drawn disc by up to 1.70x in immersive, and a hitbox that did
      // not follow made the forgiving 3x a function of display geometry
      // (3 -> 1.77 at the projector). Targets stay proportional to the ink
      // at every scale, which is what the 3x was chosen to mean.
      const visualR = nodeRadius(node.energy, scale * ink);
      const r  = visualR * 3 + 10;
      const dx = sx - cx, dy = sy - cy;
      if (dx * dx + dy * dy < r * r) return node;
    }
    return null;
  }, [getProjected, dimsRef]);

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
    // `startX/startY` is the PRESS ORIGIN and `lastX/lastY` is the previous
    // move — two different questions, and mouseup needs the first one. The
    // touch path has carried both since it was written; this one did not, and
    // handleMouseUp was measuring a gesture against the wrong number.
    dragRef.current = {
      active: true, lastX: e.clientX, lastY: e.clientY, vx: 0, vy: 0,
      startX: e.clientX, startY: e.clientY,
    };
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

  /**
   * Spawn one packet per edge touching `id`, outward.
   *
   * Adjacency is SPHERE_ADJ — the 31-node, 40-edge set the sphere actually
   * draws and fires over. (ArtTab's label cascade uses the full 272-node ADJ;
   * the two disagree about who a node's neighbours are. Not changed here, and
   * recorded in the design's section 10.)
   *
   * The chord is 3D and unprojected: that is correct parallax, and it is
   * invariant under rotation, which is what makes the transient reproducible
   * in a capture.
   *
   * Returns the number of packets spawned, so callers (the harness) can tell
   * a real fire from a no-op without reading the whole pool's size.
   */
  const fireStrimer = useCallback((id) => {
    const st = stateRef.current;
    const pool = strimerRef.current;
    if (!st || !pool) return 0;
    const src = st.nodes.find(n => n.id === id);
    if (!src) return 0;
    const targets = [];
    for (const dstId of (SPHERE_ADJ[id] ?? [])) {
      const dst = st.nodes.find(n => n.id === dstId);
      if (!dst) continue;
      targets.push({
        dstId,
        worldLen: Math.hypot(dst.x - src.x, dst.y - src.y, dst.z - src.z),
      });
    }
    if (!targets.length) return 0;
    return spawnStrimer(pool, {
      srcId: id,
      targets,
      nowMs: performance.now(),
      colour: NODE_COLORS[id] ?? { hue: 200, sat: 90, lit: 60 },
    });
  }, []);

  const handleMouseUp = useCallback((e) => {
    // Release conductor if dragging
    if (conductorDragRef.current) {
      conductorDragRef.current = false;
      setConductor(null);  // spring-decay back
      return;
    }
    dragRef.current.active = false;
    // Check if this was a click (not a drag) — against the PRESS ORIGIN.
    //
    // This measured against `lastX/lastY`, which handleMouseMove overwrites on
    // every move while the drag is live, so it asked "how far did the pointer
    // travel since the last mousemove" — a number that is a pixel or two for
    // any gesture, however long. MEASURED before the fix: rotate-drags of 12px
    // and 30px released over a node both fired it, rings and readout and all.
    // What limited the damage was not this test but whether the rotation had
    // carried a node out of nodeAt's reach by the time the button came up.
    const dx = e.clientX - (dragRef.current.startX ?? e.clientX);
    const dy = e.clientY - (dragRef.current.startY ?? e.clientY);
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
        // The strimer delivers each neighbour's bump when its packet LANDS,
        // so the instant loop is suppressed here. The two are one decision:
        // suppressing without spawning would stop the graph propagating.
        fireNode(node.id, { neighbours: false });
        fireStrimer(node.id);
        // Perturb Hopfield field — genuine associative activation propagation
        const nodeIdx_ = NODE_IDX[node.id];
        if (nodeIdx_ != null) perturbField(nodeIdx_);
        // Broadcast to peers
        if (somaPresence.connected) somaPresence.sendFire(node.id);
        spawnEffect(node.id, { soft: true, rightClick: false, strimer: true });   // left-click → cluster hue burst
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
  }, [canvasCoords, nodeAt, edgeAt, fireNode, fireStrimer, spawnEffect, onCueNode, onRunKernel, setConductor]);

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
    // The strimer delivers each neighbour's bump when its packet LANDS,
    // so the instant loop is suppressed here. The two are one decision:
    // suppressing without spawning would stop the graph propagating.
    fireNode(node.id, { neighbours: false });
    fireStrimer(node.id);
    // Perturb Hopfield field from touch
    const _touchIdx = NODE_IDX[node.id];
    if (_touchIdx != null) perturbField(_touchIdx);
    if (somaPresence.connected) somaPresence.sendFire(node.id);
    spawnEffect(node.id, { soft: true, strimer: true });
    // Label cascade — record seed + neighbors for the draw loop
    const nbs = new Set(ADJ[node.id] ?? []);
    nbs.add(node.id);
    firedRef.current = { seedId: node.id, neighborIds: nbs, t0: performance.now() };
    const nodeIdx = NODES.findIndex(n => n.id === node.id);
    if (onCueNode && nodeIdx >= 0) onCueNode(nodeIdx);
    setSelectedNode(node.id);
    setLockedEdge(null);
  }, [canvasCoords, nodeAt, fireNode, fireStrimer, spawnEffect, onCueNode, perturbField, setConductor]);

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
      const mx = (anchorA.x + anchorB.x) / 2 + (artRandom() - 0.5) * 0.1;
      const my = (anchorA.y + anchorB.y) / 2 + (artRandom() - 0.5) * 0.1;
      const mz = (anchorA.z + anchorB.z) / 2 + (artRandom() - 0.5) * 0.1;
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
      {/*
        IMMERSIVE IS NOT FULLSCREEN, so it must not claim the full viewport.
        The app header (App.jsx, the `h-24` one) is `sticky top-0` and paints
        rgba(0,0,0,0.9) with a 12px backdrop blur over whatever is beneath it.
        With `inset-0` this container ran underneath it and two things went
        wrong at once: MEASURED at 1920x1080, 91 px of live artwork was painted
        over by that strip, and the sphere was centred at y 540 while the band
        it can actually be seen in is centred at y 588 — so shrinking the radius
        alone would have stopped the bite and left the sphere sitting high with
        dead space under it.

        Insetting below the header fixes both, and it needs no new constant in
        the projection: `sphereR = SPHERE_K * min(w, h)`, so handing the
        container its true height re-scales the sphere on its own. A node's
        maximum projected offset is `FOCAL_K / sqrt(FOCAL_K^2 - 1)` = 1.0707 R,
        not R, and that is the number the box has to hold.

        `top-24` is the header's `h-24`. If that height changes, this changes
        with it — grep `h-24` in App.jsx. Below `md` the header is opacity-0
        for the mobile chrome, so the inset is desktop-only and small screens
        keep today's full-bleed behaviour.
      */}
      <div
        ref={containerRef}
        className={`w-full overflow-hidden${immersive ? ' fixed inset-x-0 bottom-0 top-0 md:top-24 z-50' : ''}`}
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
          edgeGLRef={edgeGLRef}
          addGLRef={addGLRef}
          strimerRef={strimerRef}
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

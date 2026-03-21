// useAnalogicalReasoning.js — Analogical mapping + Gestalt completion + Chimera detection
//
// Three interlocking reasoning systems that compose into emergent associative inference:
//
//   1. Structure Mapping Engine (SME-lite)
//      Detects topological isomorphisms between subgraphs using Weisfeiler-Leman
//      1-hop neighborhood hashing. Two clusters are "analogous" when their sorted
//      WL hash sequences have Jaccard similarity > threshold.
//      Reference: Gentner (1983), "Structure-mapping: A theoretical framework for analogy"
//
//   2. Gestalt Completion
//      Occlude a subset of nodes, run Hopfield convergence from partial input,
//      and measure reconstruction quality. If the clamped pattern converges faster
//      than random baseline, the analogy holds → ghost nodes materialize.
//      Reference: Wertheimer (1923), Koffka (1935), "Principles of Gestalt Psychology"
//
//   3. Chimera State Detection
//      Compute per-cluster Kuramoto order parameter. Synchronized clusters (r > 0.8)
//      phase-lock visually. Desynchronized clusters (r < 0.3) flicker independently.
//      The boundary zone (0.3 < r < 0.8) is the chimera — where new associations form.
//      Reference: Abrams & Strogatz (2004), "Chimera states for coupled oscillators"

import { useRef, useCallback } from 'react';
import { NODES, NODE_IDX, FEATURES, cosineSim } from '../data/nodeFeatures';

// ── Constants ────────────────────────────────────────────────────────────────

const N = NODES.length;           // 31
const DIM = FEATURES[0]?.length ?? 16;

// SME-lite
const WL_ROUNDS       = 2;       // Weisfeiler-Leman iteration depth
const JACCARD_THRESH  = 0.15;    // minimum Jaccard for analogy detection (WL hashes are very discriminative)
const ANALOGY_COOLDOWN = 64;     // frames between full SME scans (expensive)
const MAX_ANALOGIES   = 6;       // cap on simultaneous analogy pairs
const MIN_CLUSTER_SIZE = 2;      // minimum subgraph size for analogy detection

// Gestalt completion
const GESTALT_STEPS   = 50;      // Hopfield convergence iterations for completion test
const GESTALT_COOLDOWN = 48;     // frames between Gestalt validation passes
const OCCLUDE_FRACTION = 0.4;    // fraction of nodes to occlude in each test
const CONVERGENCE_THRESHOLD = 0.7; // reconstruction quality threshold (cosine sim)

// Chimera detection
const CHIMERA_SYNC_THRESHOLD   = 0.75; // r > this → synchronized
const CHIMERA_ASYNC_THRESHOLD  = 0.35; // r < this → desynchronized
const CHIMERA_UPDATE_INTERVAL  = 8;    // frames between chimera recalculation
const PHASE_HISTORY_LEN        = 32;   // rolling window for phase oscillation tracking

// ── Precompute adjacency and coupling matrix ─────────────────────────────────
// We rebuild a local weight matrix so this module is self-contained.

const W = new Array(N);
for (let i = 0; i < N; i++) {
  W[i] = new Float64Array(N);
  for (let j = 0; j < N; j++) {
    if (i === j) W[i][j] = 0;
    else if (j < i) W[i][j] = W[j][i];
    else W[i][j] = cosineSim(FEATURES[i], FEATURES[j]);
  }
}

// Build adjacency list from strong couplings (top ~40% of edges)
const _allWeights = [];
for (let i = 0; i < N; i++)
  for (let j = i + 1; j < N; j++)
    _allWeights.push(W[i][j]);
_allWeights.sort((a, b) => b - a);
const ADJ_THRESHOLD = _allWeights[Math.floor(_allWeights.length * 0.4)] || 0.3;

const ADJ_LIST = new Array(N);
for (let i = 0; i < N; i++) {
  ADJ_LIST[i] = [];
  for (let j = 0; j < N; j++) {
    if (i !== j && W[i][j] > ADJ_THRESHOLD) ADJ_LIST[i].push(j);
  }
}

// ── Cluster extraction ───────────────────────────────────────────────────────
// Group nodes by their declared cluster for chimera detection,
// and extract connected components from coupling graph for SME.

const CLUSTER_MAP = {};  // clusterId → [nodeIndex, ...]
for (let i = 0; i < N; i++) {
  const c = NODES[i].cluster;
  if (!CLUSTER_MAP[c]) CLUSTER_MAP[c] = [];
  CLUSTER_MAP[c].push(i);
}
const CLUSTER_IDS = Object.keys(CLUSTER_MAP);

// ── Structural fingerprinting ────────────────────────────────────────────────
// Instead of exact WL hashing (too discriminative for small subgraphs),
// we use a quantized structural profile per node:
//   [intra-degree, mean-coupling-quartile, coupling-variance-quartile]
// Two nodes with the same profile are "structurally equivalent."
// This is coarser than WL — deliberately so, because we want analogies
// to emerge from approximate structural similarity, not exact isomorphism.

function computeStructuralProfiles(nodeIndices) {
  const subSet = new Set(nodeIndices);
  const n = nodeIndices.length;
  const profiles = new Uint32Array(n);

  for (let li = 0; li < n; li++) {
    const gi = nodeIndices[li];

    // Compute intra-cluster coupling stats
    let degree = 0, sumW = 0, sumW2 = 0;
    for (const j of nodeIndices) {
      if (j === gi) continue;
      const w = W[gi][j];
      if (w > 0.3) {  // any meaningful coupling
        degree++;
        sumW += w;
        sumW2 += w * w;
      }
    }

    // Quantize into coarse buckets (3 bits each → 512 possible profiles)
    const meanW = degree > 0 ? sumW / degree : 0;
    const varW = degree > 0 ? sumW2 / degree - meanW * meanW : 0;

    const degBucket = Math.min(7, degree);                      // 0-7
    const meanBucket = Math.min(7, (meanW * 8) | 0);           // 0-7
    const varBucket = Math.min(7, (Math.sqrt(varW) * 16) | 0); // 0-7

    profiles[li] = (degBucket << 6) | (meanBucket << 3) | varBucket;
  }

  return profiles;
}

// ── Profile similarity — Jaccard on the multiset of structural profiles ──────

function profileJaccard(profilesA, profilesB) {
  // Multiset Jaccard: count how many profile values appear in both
  const countA = {}, countB = {};
  for (const p of profilesA) countA[p] = (countA[p] || 0) + 1;
  for (const p of profilesB) countB[p] = (countB[p] || 0) + 1;

  let intersection = 0, union = 0;
  const allKeys = new Set([...Object.keys(countA), ...Object.keys(countB)]);
  for (const k of allKeys) {
    const a = countA[k] || 0, b = countB[k] || 0;
    intersection += Math.min(a, b);
    union += Math.max(a, b);
  }
  return union > 0 ? intersection / union : 0;
}

// ── Node correspondence via profile matching ────────────────────────────────
// Pair nodes with identical or closest profiles, then validate with feature cosine.

function computeCorrespondence(indicesA, profilesA, indicesB, profilesB) {
  // Sort by profile to align structurally similar nodes
  const rankedA = indicesA.map((gi, li) => ({ gi, profile: profilesA[li] }))
    .sort((a, b) => a.profile - b.profile);
  const rankedB = indicesB.map((gi, li) => ({ gi, profile: profilesB[li] }))
    .sort((a, b) => a.profile - b.profile);

  const pairs = [];
  const usedB = new Set();

  // For each node in A, find best matching node in B by profile distance
  for (const a of rankedA) {
    let bestDist = Infinity, bestJ = -1;
    for (let j = 0; j < rankedB.length; j++) {
      if (usedB.has(j)) continue;
      const dist = Math.abs(a.profile - rankedB[j].profile);
      if (dist < bestDist) { bestDist = dist; bestJ = j; }
    }
    if (bestJ >= 0) {
      usedB.add(bestJ);
      pairs.push({
        nodeA: a.gi,
        nodeB: rankedB[bestJ].gi,
        profileMatch: bestDist === 0 ? 1.0 : 1.0 / (1.0 + bestDist),
      });
    }
  }
  return pairs;
}

// ── Sigmoid (for Gestalt Hopfield convergence) ──────────────────────────────

function sigmoid(x) {
  if (x >= 0) { const ez = Math.exp(-x); return 1.0 / (1.0 + ez); }
  const ez = Math.exp(x); return ez / (1.0 + ez);
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useAnalogicalReasoning({ fieldRef }) {
  const reasoningRef = useRef(null);

  // ── Initialize state ──────────────────────────────────────────────────────
  if (reasoningRef.current === null) {
    reasoningRef.current = {
      stepCount: 0,

      // SME-lite: detected analogies
      analogies: [],              // [{ clusterA, clusterB, jaccard, pairs, age, verified }]
      analogyFilaments: [],       // [{ nodeA, nodeB, strength, age }] — render data

      // Gestalt completion
      ghostNodes: new Float64Array(N),     // 0 = hidden, 1 = fully materialized
      ghostTargets: new Float64Array(N),   // target opacity (0 or 1)
      occludedSet: new Set(),              // currently occluded node indices
      completionQuality: 0,                // last measured reconstruction quality
      gestaltActive: false,                // is a Gestalt test running?
      gestaltCooldown: 0,

      // Chimera detection
      clusterSync: {},            // clusterId → { orderParam, phase, isSync, isAsync, isChimera }
      phaseHistory: {},           // clusterId → Float64Array ring buffer
      phaseHistoryIdx: {},        // clusterId → write head
      chimeraZones: [],           // [{ clusterA, clusterB, boundaryStrength }]

      // Scratch buffers (avoid GC)
      _scratchActs: new Float64Array(N),
      _scratchRecon: new Float64Array(N),
    };

    // Initialize chimera tracking per cluster
    for (const cid of CLUSTER_IDS) {
      reasoningRef.current.clusterSync[cid] = {
        orderParam: 0,
        meanPhase: 0,
        isSync: false,
        isAsync: true,
        isChimera: false,
      };
      reasoningRef.current.phaseHistory[cid] = new Float64Array(PHASE_HISTORY_LEN);
      reasoningRef.current.phaseHistoryIdx[cid] = 0;
    }
  }

  // ── Step analogical reasoning (called every frame from draw loop) ─────────
  const stepReasoning = useCallback(() => {
    const r = reasoningRef.current;
    const f = fieldRef.current;
    if (!r || !f) return;

    r.stepCount++;
    const acts = f.activations;

    // ════════════════════════════════════════════════════════════════════════
    // 1. CHIMERA DETECTION (every CHIMERA_UPDATE_INTERVAL frames)
    // ════════════════════════════════════════════════════════════════════════
    if (r.stepCount % CHIMERA_UPDATE_INTERVAL === 0) {
      _updateChimera(r, acts);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 2. STRUCTURE MAPPING (every ANALOGY_COOLDOWN frames)
    // ════════════════════════════════════════════════════════════════════════
    if (r.stepCount % ANALOGY_COOLDOWN === 0) {
      _updateAnalogies(r, acts);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 3. GESTALT COMPLETION (every GESTALT_COOLDOWN frames, if analogies exist)
    // ════════════════════════════════════════════════════════════════════════
    if (r.gestaltCooldown > 0) {
      r.gestaltCooldown--;
    } else if (r.analogies.length > 0 && r.stepCount % GESTALT_COOLDOWN === 0) {
      _updateGestalt(r, f);
      r.gestaltCooldown = GESTALT_COOLDOWN;
    }

    // ════════════════════════════════════════════════════════════════════════
    // 4. ANIMATE ghost nodes and filament strengths
    // ════════════════════════════════════════════════════════════════════════
    _animateGhosts(r);
    _animateFilaments(r);

  }, [fieldRef]);

  // ── Chimera: Kuramoto order parameter per cluster ─────────────────────────
  function _updateChimera(r, acts) {
    // For each cluster, compute the Kuramoto order parameter:
    //   r_k = |1/N_k Σ exp(i·θ_j)| where θ_j = 2π·activation_j
    // This measures phase coherence within the cluster.

    const newChimeraZones = [];

    for (const cid of CLUSTER_IDS) {
      const members = CLUSTER_MAP[cid];
      if (!members || members.length < 2) continue;

      let sumCos = 0, sumSin = 0;
      for (const idx of members) {
        const theta = acts[idx] * Math.PI * 2;
        sumCos += Math.cos(theta);
        sumSin += Math.sin(theta);
      }
      const nk = members.length;
      const orderParam = Math.sqrt(sumCos * sumCos + sumSin * sumSin) / nk;
      const meanPhase = Math.atan2(sumSin, sumCos);

      const sync = r.clusterSync[cid];
      // Exponential smoothing to avoid flicker
      sync.orderParam = sync.orderParam * 0.85 + orderParam * 0.15;
      sync.meanPhase = meanPhase;
      sync.isSync = sync.orderParam > CHIMERA_SYNC_THRESHOLD;
      sync.isAsync = sync.orderParam < CHIMERA_ASYNC_THRESHOLD;
      sync.isChimera = !sync.isSync && !sync.isAsync;

      // Record phase history for temporal visualization
      const hist = r.phaseHistory[cid];
      const hidx = r.phaseHistoryIdx[cid];
      hist[hidx] = sync.orderParam;
      r.phaseHistoryIdx[cid] = (hidx + 1) % PHASE_HISTORY_LEN;
    }

    // Detect chimera boundary zones: where a sync cluster borders an async cluster
    for (let i = 0; i < CLUSTER_IDS.length; i++) {
      for (let j = i + 1; j < CLUSTER_IDS.length; j++) {
        const cA = CLUSTER_IDS[i], cB = CLUSTER_IDS[j];
        const sA = r.clusterSync[cA], sB = r.clusterSync[cB];

        // Check if there are cross-edges between these clusters
        let crossStrength = 0;
        let crossCount = 0;
        for (const a of CLUSTER_MAP[cA]) {
          for (const b of CLUSTER_MAP[cB]) {
            if (W[a][b] > ADJ_THRESHOLD) {
              crossStrength += W[a][b];
              crossCount++;
            }
          }
        }
        if (crossCount === 0) continue;
        crossStrength /= crossCount;

        // Chimera boundary = one side sync, other side async (or both chimera)
        const syncDiff = Math.abs(sA.orderParam - sB.orderParam);
        const isChimeraBoundary = (sA.isSync && sB.isAsync) ||
                                   (sB.isSync && sA.isAsync) ||
                                   (sA.isChimera || sB.isChimera);

        if (isChimeraBoundary && syncDiff > 0.2) {
          newChimeraZones.push({
            clusterA: cA,
            clusterB: cB,
            boundaryStrength: syncDiff * crossStrength,
            syncA: sA.orderParam,
            syncB: sB.orderParam,
          });
        }
      }
    }

    r.chimeraZones = newChimeraZones;
  }

  // ── SME-lite: scan all cluster pairs for structural analogies ─────────────
  function _updateAnalogies(r, acts) {
    const newAnalogies = [];

    // Extract activation-weighted subgraphs per cluster
    // Only include nodes with activation > 0.15 (active participants)
    const activeSubgraphs = {};
    for (const cid of CLUSTER_IDS) {
      const active = CLUSTER_MAP[cid].filter(i => acts[i] > 0.05);
      if (active.length >= MIN_CLUSTER_SIZE) {
        activeSubgraphs[cid] = active;
      }
    }

    const activeClusters = Object.keys(activeSubgraphs);

    // Compare all pairs
    for (let i = 0; i < activeClusters.length; i++) {
      for (let j = i + 1; j < activeClusters.length; j++) {
        const cA = activeClusters[i], cB = activeClusters[j];
        const indicesA = activeSubgraphs[cA];
        const indicesB = activeSubgraphs[cB];

        // Compute structural profiles for each subgraph
        const profilesA = computeStructuralProfiles(indicesA);
        const profilesB = computeStructuralProfiles(indicesB);

        // Jaccard similarity of profile multisets
        const jaccard = profileJaccard(profilesA, profilesB);

        if (jaccard >= JACCARD_THRESH) {
          // Compute node correspondence
          const pairs = computeCorrespondence(indicesA, profilesA, indicesB, profilesB);

          // Validate: corresponding nodes should have meaningful feature similarity
          let validPairs = 0;
          for (const p of pairs) {
            const sim = cosineSim(FEATURES[p.nodeA], FEATURES[p.nodeB]);
            p.featureSim = sim;
            if (sim > 0.3) validPairs++;
          }

          const validation = pairs.length > 0 ? validPairs / pairs.length : 0;

          newAnalogies.push({
            clusterA: cA,
            clusterB: cB,
            jaccard,
            pairs,
            validation,
            age: 0,
            verified: false,  // set by Gestalt completion
          });
        }
      }
    }

    // Sort by jaccard similarity, keep top MAX_ANALOGIES
    newAnalogies.sort((a, b) => b.jaccard - a.jaccard);

    // Merge with existing (preserve age, carry forward verified status)
    const merged = [];
    for (const na of newAnalogies.slice(0, MAX_ANALOGIES)) {
      const existing = r.analogies.find(
        a => a.clusterA === na.clusterA && a.clusterB === na.clusterB
      );
      if (existing) {
        existing.jaccard = na.jaccard;
        existing.pairs = na.pairs;
        existing.validation = na.validation;
        existing.age++;
        merged.push(existing);
      } else {
        merged.push(na);
      }
    }

    r.analogies = merged;

    // Rebuild filaments from analogy pairs
    const filaments = [];
    for (const a of r.analogies) {
      for (const p of a.pairs) {
        const strength = a.jaccard * (p.featureSim ?? 0.5) * (a.verified ? 1.0 : 0.5);
        filaments.push({
          nodeA: p.nodeA,
          nodeB: p.nodeB,
          strength: Math.min(1, strength),
          clusterA: a.clusterA,
          clusterB: a.clusterB,
          age: 0,
          maxAge: 300, // ~10s at 30fps — filaments fade if analogy isn't refreshed
        });
      }
    }
    r.analogyFilaments = filaments;
  }

  // ── Gestalt completion: occlude, converge, measure ────────────────────────
  function _updateGestalt(r, f) {
    if (r.analogies.length === 0) return;

    const acts = f.activations;
    const thresholds = f.thresholds;

    // Pick the strongest analogy to test
    const analogy = r.analogies[0];
    const allNodes = [...(CLUSTER_MAP[analogy.clusterA] ?? []),
                      ...(CLUSTER_MAP[analogy.clusterB] ?? [])];

    if (allNodes.length < 4) return;

    // Store current activations
    const original = r._scratchActs;
    for (let i = 0; i < N; i++) original[i] = acts[i];

    // Occlude: zero-clamp a random subset from one side of the analogy
    const occludeFrom = Math.random() < 0.5 ? analogy.clusterA : analogy.clusterB;
    const occludePool = CLUSTER_MAP[occludeFrom] ?? [];
    const occludeCount = Math.max(1, Math.floor(occludePool.length * OCCLUDE_FRACTION));

    // Shuffle and pick
    const shuffled = [...occludePool].sort(() => Math.random() - 0.5);
    const occluded = new Set(shuffled.slice(0, occludeCount));
    r.occludedSet = occluded;

    // Clone activations with occlusion
    const testActs = r._scratchRecon;
    for (let i = 0; i < N; i++) {
      testActs[i] = occluded.has(i) ? 0.0 : acts[i];
    }

    // Run Hopfield convergence on the partial pattern
    for (let iter = 0; iter < GESTALT_STEPS; iter++) {
      for (let i = 0; i < N; i++) {
        if (occluded.has(i)) {
          // Let occluded nodes evolve freely (not clamped)
          let h = 0;
          for (let j = 0; j < N; j++) h += W[i][j] * testActs[j];
          testActs[i] = sigmoid(5.0 * (h - (thresholds[i] ?? 0.35)));
        }
      }
    }

    // Measure reconstruction quality: cosine similarity between
    // original occluded activations and reconstructed ones
    let dotProd = 0, normA = 0, normB = 0;
    for (const i of occluded) {
      dotProd += original[i] * testActs[i];
      normA += original[i] * original[i];
      normB += testActs[i] * testActs[i];
    }
    const recon = (normA > 1e-12 && normB > 1e-12)
      ? dotProd / (Math.sqrt(normA) * Math.sqrt(normB))
      : 0;

    r.completionQuality = recon;

    // If reconstruction is good, verify the analogy → strengthen filaments
    if (recon > CONVERGENCE_THRESHOLD) {
      analogy.verified = true;
      // Ghost nodes: make occluded nodes "materialize" (opacity target → 1)
      for (const i of occluded) {
        r.ghostTargets[i] = 1.0;
      }
    } else {
      analogy.verified = false;
      // Failed completion: dissolve ghost nodes
      for (const i of occluded) {
        r.ghostTargets[i] = 0.0;
      }
    }

    // Clear non-occluded ghost targets
    for (let i = 0; i < N; i++) {
      if (!occluded.has(i)) {
        r.ghostTargets[i] = 0.0;
      }
    }
  }

  // ── Animate ghost node opacity toward targets ─────────────────────────────
  function _animateGhosts(r) {
    for (let i = 0; i < N; i++) {
      const diff = r.ghostTargets[i] - r.ghostNodes[i];
      if (Math.abs(diff) < 0.005) {
        r.ghostNodes[i] = r.ghostTargets[i];
      } else {
        // Smooth exponential approach: materialize = slow (0.04), dissolve = fast (0.08)
        const rate = diff > 0 ? 0.04 : 0.08;
        r.ghostNodes[i] += diff * rate;
      }
    }
  }

  // ── Age and fade analogy filaments ────────────────────────────────────────
  function _animateFilaments(r) {
    for (const fil of r.analogyFilaments) {
      fil.age++;
      // Strength decays if analogy isn't refreshed
      if (fil.age > fil.maxAge * 0.7) {
        fil.strength *= 0.98;
      }
    }
    // Prune dead filaments
    r.analogyFilaments = r.analogyFilaments.filter(
      f => f.strength > 0.02 && f.age < f.maxAge
    );
  }

  // ── Accessors ─────────────────────────────────────────────────────────────

  const getAnalogies = useCallback(() => {
    return reasoningRef.current?.analogies ?? [];
  }, []);

  const getFilaments = useCallback(() => {
    return reasoningRef.current?.analogyFilaments ?? [];
  }, []);

  const getGhostNodes = useCallback(() => {
    return reasoningRef.current?.ghostNodes ?? null;
  }, []);

  const getCompletionQuality = useCallback(() => {
    return reasoningRef.current?.completionQuality ?? 0;
  }, []);

  const getClusterSync = useCallback(() => {
    return reasoningRef.current?.clusterSync ?? {};
  }, []);

  const getChimeraZones = useCallback(() => {
    return reasoningRef.current?.chimeraZones ?? [];
  }, []);

  // ── Manual perturbation: force an analogy test between two specific clusters
  const testAnalogy = useCallback((clusterIdA, clusterIdB) => {
    const r = reasoningRef.current;
    if (!r) return null;

    const indicesA = CLUSTER_MAP[clusterIdA];
    const indicesB = CLUSTER_MAP[clusterIdB];
    if (!indicesA || !indicesB) return null;

    const profilesA = computeStructuralProfiles(indicesA);
    const profilesB = computeStructuralProfiles(indicesB);
    const jaccard = profileJaccard(profilesA, profilesB);
    const pairs = computeCorrespondence(indicesA, profilesA, indicesB, profilesB);

    return { jaccard, pairs, clusterA: clusterIdA, clusterB: clusterIdB };
  }, []);

  // ── Get per-node chimera phase color ──────────────────────────────────────
  // Returns [hue, saturation, syncLevel] for rendering node halo
  const getNodeChimeraState = useCallback((nodeIdx) => {
    const r = reasoningRef.current;
    if (!r || nodeIdx < 0 || nodeIdx >= N) return null;

    const cid = NODES[nodeIdx].cluster;
    const sync = r.clusterSync[cid];
    if (!sync) return null;

    return {
      orderParam: sync.orderParam,
      meanPhase: sync.meanPhase,
      isSync: sync.isSync,
      isAsync: sync.isAsync,
      isChimera: sync.isChimera,
    };
  }, []);

  return {
    reasoningRef,
    stepReasoning,
    getAnalogies,
    getFilaments,
    getGhostNodes,
    getCompletionQuality,
    getClusterSync,
    getChimeraZones,
    getNodeChimeraState,
    testAnalogy,
  };
}

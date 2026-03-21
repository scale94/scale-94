// useAssociativeField.js — Hopfield associative memory + Feigenbaum bifurcation dynamics
//
// Implements a genuine Hopfield energy landscape over the 31-node sphere graph,
// coupled to a logistic map whose control parameter r is driven by system energy.
// Phase transitions (period-doubling cascade toward chaos) emerge from the
// Feigenbaum universal route, not from decorative jitter.
//
// Mathematical foundations:
//   Hopfield network:  J.J. Hopfield, "Neural networks and physical systems with
//                      emergent collective computational abilities" (1982)
//   Feigenbaum map:    M.J. Feigenbaum, "Quantitative universality for a class of
//                      nonlinear transformations" (1978)
//   Lyapunov exponent: V.I. Oseledets, "A multiplicative ergodic theorem" (1968)

import { useRef, useCallback } from 'react';
import { NODES, NODE_IDX, FEATURES, cosineSim } from '../data/nodeFeatures';

// ── Constants ────────────────────────────────────────────────────────────────

const N = NODES.length; // 31

// Feigenbaum universal constants
const DELTA = 4.669201609102990;  // ratio of successive bifurcation intervals
const ALPHA = 2.502907875095892;  // scaling factor for period-doubling

// Bifurcation thresholds for the logistic map x_{n+1} = r·x_n·(1 - x_n)
// r_n converges geometrically: r_∞ - r_n ≈ C / δ^n
const R_PERIOD_1  = 1.0;    // stable fixed point x* = 1 - 1/r for r > 1
const R_PERIOD_2  = 3.0;    // first period-doubling bifurcation
const R_PERIOD_4  = 3.449489742783178; // 1 + √6
const R_PERIOD_8  = 3.544090359551564; // R_PERIOD_4 + (R_PERIOD_4 - R_PERIOD_2) / DELTA
const R_CHAOS     = 3.569945671870944; // onset of chaos (Feigenbaum point r_∞)
const R_MAX       = 4.0;    // maximum r — full unit interval maps to itself

// Dynamics tuning
const SIGMOID_GAIN   = 5.0;   // steepness of activation function
const THETA_DEFAULT  = 0.35;  // default firing threshold
const HOPFIELD_ASYNC = 4;     // nodes updated per Hopfield sub-step
const R_DRIVE_RATE   = 0.0008; // rate at which system energy pushes r upward
const R_DECAY_RATE   = 0.0003; // rate at which r relaxes back toward R_PERIOD_1
const LYAP_WINDOW    = 128;   // rolling window for Lyapunov exponent estimation

// Phase labels
const PHASE_STABLE   = 'STABLE';
const PHASE_PERIOD_2 = 'PERIOD_2';
const PHASE_PERIOD_4 = 'PERIOD_4';
const PHASE_PERIOD_8 = 'PERIOD_8';
const PHASE_CHAOS    = 'CHAOS';

// ── Precomputed weight matrix ────────────────────────────────────────────────
// W[i][j] = cosineSim(FEATURES[i], FEATURES[j]) — the Hopfield coupling matrix.
// Symmetric, zero-diagonal. Computed once at module load.

const W = new Array(N);
for (let i = 0; i < N; i++) {
  W[i] = new Float64Array(N);
  for (let j = 0; j < N; j++) {
    if (i === j) {
      W[i][j] = 0; // no self-connections in Hopfield networks
    } else if (j < i) {
      W[i][j] = W[j][i]; // symmetric
    } else {
      W[i][j] = cosineSim(FEATURES[i], FEATURES[j]);
    }
  }
}

// ── Sigmoid activation ──────────────────────────────────────────────────────

function sigmoid(x) {
  // Numerically stable sigmoid: avoid overflow in exp()
  if (x >= 0) {
    const ez = Math.exp(-x);
    return 1.0 / (1.0 + ez);
  }
  const ez = Math.exp(x);
  return ez / (1.0 + ez);
}

// ── Logistic map ────────────────────────────────────────────────────────────

function logisticStep(x, r) {
  return r * x * (1.0 - x);
}

// Derivative of the logistic map: d/dx [r·x·(1-x)] = r·(1 - 2x)
function logisticDerivative(x, r) {
  return r * (1.0 - 2.0 * x);
}

// ── Phase classification ────────────────────────────────────────────────────

function classifyPhase(r) {
  if (r < R_PERIOD_2) return PHASE_STABLE;
  if (r < R_PERIOD_4) return PHASE_PERIOD_2;
  if (r < R_PERIOD_8) return PHASE_PERIOD_4;
  if (r < R_CHAOS)    return PHASE_PERIOD_8;
  return PHASE_CHAOS;
}

// ── Hopfield energy ─────────────────────────────────────────────────────────
// E = -½ Σᵢⱼ Wᵢⱼ sᵢ sⱼ + Σᵢ θᵢ sᵢ
// Negative energy = deep attractor; energy decreases monotonically under
// asynchronous Hopfield updates (Hopfield 1982, Theorem 1).

function computeEnergy(activations, thresholds) {
  let coupling = 0;
  for (let i = 0; i < N; i++) {
    const si = activations[i];
    for (let j = i + 1; j < N; j++) {
      coupling += W[i][j] * si * activations[j];
    }
  }
  let threshold = 0;
  for (let i = 0; i < N; i++) {
    threshold += thresholds[i] * activations[i];
  }
  return -coupling + threshold;
}

// ── Basin detection via convergence ─────────────────────────────────────────
// Run Hopfield dynamics to convergence from the current state, then assign
// each node to a basin ID based on which attractor it settles into.
// Uses binarization of the converged activation pattern as basin signature.

function detectBasins(activations, thresholds) {
  // Clone activations — we run convergence without mutating the live state
  const s = new Float64Array(activations);
  const maxIter = 100;
  const convergenceThreshold = 1e-6;

  for (let iter = 0; iter < maxIter; iter++) {
    let maxDelta = 0;
    for (let i = 0; i < N; i++) {
      let h = 0;
      for (let j = 0; j < N; j++) {
        h += W[i][j] * s[j];
      }
      const newSi = sigmoid(SIGMOID_GAIN * (h - thresholds[i]));
      const delta = Math.abs(newSi - s[i]);
      if (delta > maxDelta) maxDelta = delta;
      s[i] = newSi;
    }
    if (maxDelta < convergenceThreshold) break;
  }

  // Binarize converged state at 0.5 threshold to extract attractor pattern
  // Nodes with the same binary pattern belong to the same basin.
  // We use a hash of the binary vector as basin ID.
  const binaryPattern = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    binaryPattern[i] = s[i] > 0.5 ? 1 : 0;
  }

  // Group nodes by co-activation: two nodes in the same basin if both active
  // or both inactive. We assign basin IDs by connected components in the
  // co-activation graph.
  const basins = new Int32Array(N);
  let nextBasin = 0;
  const visited = new Uint8Array(N);

  for (let i = 0; i < N; i++) {
    if (visited[i]) continue;
    const basinId = nextBasin++;
    // BFS: find all nodes with the same binary activation state
    // that are also strongly coupled (W[i][j] > median coupling)
    const queue = [i];
    visited[i] = 1;
    basins[i] = basinId;

    while (queue.length > 0) {
      const u = queue.shift();
      for (let v = 0; v < N; v++) {
        if (visited[v]) continue;
        if (binaryPattern[v] !== binaryPattern[u]) continue;
        // Require meaningful coupling to be in the same basin
        if (W[u][v] < 0.5) continue;
        visited[v] = 1;
        basins[v] = basinId;
        queue.push(v);
      }
    }
  }

  return Array.from(basins);
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useAssociativeField({ nodes, adj }) {
  const fieldRef = useRef(null);
  const onPhaseTransition = useRef(null);

  // Lyapunov exponent accumulator — rolling log-derivative sum
  const lyapAccRef = useRef({ logSum: 0, count: 0, buffer: new Float64Array(LYAP_WINDOW), idx: 0 });

  // ── Initialize field state ──────────────────────────────────────────────
  if (fieldRef.current === null) {
    const activations = new Float64Array(N);
    const thresholds = new Float64Array(N);

    // Initialize activations from node feature magnitude (L2 norm / sqrt(16))
    // This seeds the Hopfield network with a state reflecting each node's
    // "conceptual weight" in the 16D feature space.
    for (let i = 0; i < N; i++) {
      let norm2 = 0;
      for (let d = 0; d < 16; d++) norm2 += FEATURES[i][d] * FEATURES[i][d];
      activations[i] = Math.sqrt(norm2) / 4.0; // normalize to ~[0,1]
      thresholds[i] = THETA_DEFAULT;
    }

    // Initialize logistic map state: x in (0,1), avoid fixed points
    const x0 = 0.4 + Math.random() * 0.2; // start near 0.5 but not exactly

    fieldRef.current = {
      activations,
      thresholds,
      r: 2.8,              // start in stable fixed-point regime
      x: x0,               // logistic map state variable
      phase: PHASE_STABLE,
      lyapunov: 0,
      energy: computeEnergy(activations, thresholds),
      basins: detectBasins(activations, thresholds),
      bifurcationHistory: [],
      stepCount: 0,
    };
  }

  // ── Advance one coupled Hopfield + logistic step ────────────────────────
  const stepField = useCallback(() => {
    const f = fieldRef.current;
    if (!f) return;

    const { activations, thresholds } = f;
    f.stepCount++;

    // ── 1. Asynchronous Hopfield update ──────────────────────────────────
    // Update HOPFIELD_ASYNC randomly chosen nodes per step.
    // Asynchronous update guarantees energy is non-increasing (Hopfield 1982).
    for (let k = 0; k < HOPFIELD_ASYNC; k++) {
      const i = (f.stepCount * 7 + k * 13) % N; // deterministic pseudo-random selection
      let h = 0; // local field at node i
      for (let j = 0; j < N; j++) {
        h += W[i][j] * activations[j];
      }
      // Graded sigmoid response — continuous Hopfield network
      activations[i] = sigmoid(SIGMOID_GAIN * (h - thresholds[i]));
    }

    // ── 2. Compute Hopfield energy ───────────────────────────────────────
    f.energy = computeEnergy(activations, thresholds);

    // ── 3. Mean activation drives logistic map control parameter ─────────
    // High mean activation → system is "hot" → push r toward chaos
    // Low mean activation → system cools → r relaxes back
    let meanAct = 0;
    for (let i = 0; i < N; i++) meanAct += activations[i];
    meanAct /= N;

    // r dynamics: driven by mean activation, with decay toward stability
    const rDrive = meanAct * R_DRIVE_RATE;
    const rDecay = (f.r - 2.0) * R_DECAY_RATE; // decay toward r=2 (deep stable regime)
    f.r = Math.max(1.01, Math.min(R_MAX - 0.001, f.r + rDrive - rDecay));

    // ── 4. Logistic map iteration ────────────────────────────────────────
    // x_{n+1} = r * x_n * (1 - x_n)
    const xPrev = f.x;
    f.x = logisticStep(f.x, f.r);

    // Clamp to prevent numerical escape (can happen near r=4)
    if (f.x <= 0 || f.x >= 1 || !isFinite(f.x)) {
      f.x = 0.5 + (Math.random() - 0.5) * 0.1;
    }

    // ── 5. Logistic map modulates Hopfield thresholds ────────────────────
    // The logistic orbit x_n acts as a global modulation signal on firing
    // thresholds, coupling the two dynamical systems.
    // In the stable regime, θ is nearly constant.
    // In the chaotic regime, θ fluctuates wildly → attractor hopping.
    for (let i = 0; i < N; i++) {
      // Base threshold + logistic modulation scaled by node's feature entropy
      let entropy = 0;
      for (let d = 0; d < 16; d++) {
        const p = FEATURES[i][d];
        if (p > 0 && p < 1) entropy -= p * Math.log(p) + (1 - p) * Math.log(1 - p);
      }
      entropy /= 16; // normalize to [0, ln(2)]
      const modulation = (f.x - 0.5) * 0.3 * (1.0 + entropy);
      thresholds[i] = THETA_DEFAULT + modulation;
    }

    // ── 6. Lyapunov exponent estimation ──────────────────────────────────
    // λ = lim (1/n) Σ ln|f'(x_k)| where f'(x) = r(1 - 2x)
    // λ > 0 → chaos, λ < 0 → periodic attractor, λ = 0 → bifurcation point
    const deriv = logisticDerivative(xPrev, f.r);
    const logDeriv = Math.log(Math.abs(deriv) + 1e-15);

    const lyapAcc = lyapAccRef.current;
    // Rolling window: subtract the oldest value, add the new one
    if (lyapAcc.count >= LYAP_WINDOW) {
      lyapAcc.logSum -= lyapAcc.buffer[lyapAcc.idx];
    } else {
      lyapAcc.count++;
    }
    lyapAcc.buffer[lyapAcc.idx] = logDeriv;
    lyapAcc.logSum += logDeriv;
    lyapAcc.idx = (lyapAcc.idx + 1) % LYAP_WINDOW;

    f.lyapunov = lyapAcc.logSum / lyapAcc.count;

    // ── 7. Phase transition detection ────────────────────────────────────
    const prevPhase = f.phase;
    f.phase = classifyPhase(f.r);

    if (f.phase !== prevPhase) {
      const transition = {
        from: prevPhase,
        to: f.phase,
        r: f.r,
        lyapunov: f.lyapunov,
        energy: f.energy,
        step: f.stepCount,
        timestamp: performance.now(),
      };
      f.bifurcationHistory.push(transition);

      // Keep history bounded
      if (f.bifurcationHistory.length > 256) {
        f.bifurcationHistory.splice(0, f.bifurcationHistory.length - 256);
      }

      // Notify listener
      if (typeof onPhaseTransition.current === 'function') {
        onPhaseTransition.current(transition);
      }
    }

    // ── 8. Update basin assignments (throttled — expensive) ──────────────
    // Recompute every 32 steps, or immediately after a phase transition
    if (f.stepCount % 32 === 0 || f.phase !== prevPhase) {
      f.basins = detectBasins(activations, thresholds);
    }
  }, []);

  // ── Perturb a single node — inject activation and let Hopfield propagate
  const perturbNode = useCallback((idx) => {
    const f = fieldRef.current;
    if (!f || idx < 0 || idx >= N) return;

    // Set target node to maximum activation
    f.activations[idx] = 1.0;

    // Propagate to neighbors: weighted by coupling strength
    for (let j = 0; j < N; j++) {
      if (j === idx) continue;
      const coupling = W[idx][j];
      if (coupling > 0.3) {
        // Excite strongly coupled neighbors proportionally
        f.activations[j] = Math.min(1.0, f.activations[j] + coupling * 0.5);
      }
    }

    // Perturbation injects energy → push r toward next bifurcation
    f.r = Math.min(R_MAX - 0.001, f.r + 0.015);
  }, []);

  // ── Accessors ──────────────────────────────────────────────────────────

  const getEnergy = useCallback(() => {
    const f = fieldRef.current;
    return f ? f.energy : 0;
  }, []);

  const getPhase = useCallback(() => {
    const f = fieldRef.current;
    return f ? f.phase : PHASE_STABLE;
  }, []);

  const getLyapunov = useCallback(() => {
    const f = fieldRef.current;
    return f ? f.lyapunov : 0;
  }, []);

  const getBasins = useCallback(() => {
    const f = fieldRef.current;
    return f ? f.basins : new Array(N).fill(0);
  }, []);

  return {
    fieldRef,
    stepField,
    perturbNode,
    getEnergy,
    getPhase,
    getLyapunov,
    getBasins,
    onPhaseTransition,
  };
}

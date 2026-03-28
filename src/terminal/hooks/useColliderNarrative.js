// useColliderNarrative.js — Deterministic translation matrix for LatentCollider
// Turns raw collision metrics (convergence bars, divergence deltas, paradoxes)
// into qualitative semantic vectors: a thesis, prompt angles, and paradox questions.
//
// Design principle: same inputs → same output. No randomness, no LLM calls.
// Every string is a deterministic function of the metric values. The text should
// feel like an instrument readout, not a chatbot.

import { useMemo } from 'react';
import { DIM_NAMES } from '../data/nodeFeatures';

// ── Dimension semantics ─────────────────────────────────────────────────────
// Each dim maps to a concise conceptual label and a narrative fragment
// describing what it means when two domains share or diverge on this axis.

const DIM_SEMANTIC = {
  dynamical:      { tag: 'Temporal Dynamics',       converge: 'time-varying flows and trajectory evolution',                diverge: 'one system evolves dynamically while the other is static or discrete' },
  nonlinearity:   { tag: 'Nonlinear Sensitivity',   converge: 'exponential sensitivity and chaotic amplification',          diverge: 'one domain amplifies perturbations while the other dampens them' },
  dimensionality: { tag: 'Dimensional Complexity',   converge: 'high-dimensional phase spaces and manifold structure',       diverge: 'one domain is fundamentally high-dimensional while the other is low-rank' },
  criticality:    { tag: 'Critical Thresholds',      converge: 'phase transitions and universality at tipping points',       diverge: 'one system operates near criticality while the other is deeply subcritical' },
  entropy:        { tag: 'Entropic Spreading',       converge: 'irreversible disorder production and information dispersion',diverge: 'one domain maximizes entropy while the other preserves order' },
  synchrony:      { tag: 'Collective Phase-Locking', converge: 'resonant coupling and oscillator synchronization',           diverge: 'one system synchronizes collectively while the other is desynchronized or solitary' },
  conservation:   { tag: 'Symmetry & Invariance',    converge: 'conserved quantities and structural equilibrium',            diverge: 'one domain conserves structure while the other dissipates it' },
  temporal:       { tag: 'Deep Time',                converge: 'geological/historical timescales and memory',                diverge: 'one system has deep temporal embedding while the other is instantaneous' },
  spatial:        { tag: 'Spatial Field Structure',   converge: 'distributed spatial patterns and field geometry',             diverge: 'one domain is spatially extended while the other is pointlike or abstract' },
  stochastic:     { tag: 'Stochastic Uncertainty',   converge: 'noise-driven dynamics and probabilistic outcomes',           diverge: 'one system is fundamentally stochastic while the other is deterministic' },
  game_theory:    { tag: 'Strategic Agency',          converge: 'competing agents and payoff-driven optimization',            diverge: 'one domain has strategic agents while the other has no agency' },
  thermodynamic:  { tag: 'Thermal Dissipation',       converge: 'heat flow and free-energy landscapes',                      diverge: 'one system is thermodynamically driven while the other is athermal' },
  information:    { tag: 'Information Encoding',      converge: 'signal compression and channel capacity',                    diverge: 'one domain is information-rich while the other is signal-sparse' },
  cryptographic:  { tag: 'Cryptographic Depth',       converge: 'encryption primitives and computational hardness',           diverge: 'one system has cryptographic structure while the other is plaintext' },
  biological:     { tag: 'Biological Substrate',      converge: 'living systems, ecology, and evolutionary selection',        diverge: 'one domain is biological while the other is abiotic or abstract' },
  economic:       { tag: 'Economic Allocation',       converge: 'resource allocation under scarcity and market dynamics',     diverge: 'one system has economic logic while the other has no scarcity model' },
};

// ── Convergence archetypes ──────────────────────────────────────────────────
// Detected from the top convergence dims. Scored by pairwise presence.
// Each archetype has a label and a thesis template.

const ARCHETYPES = [
  { dims: ['nonlinearity', 'criticality'],    label: 'BIFURCATION CASCADE',       thesis: 'Both domains operate at the edge of bifurcation, where infinitesimal parameter shifts trigger qualitative phase changes. The shared criticality creates a natural resonance channel.' },
  { dims: ['dynamical', 'thermodynamic'],     label: 'DISSIPATIVE FLOW',          thesis: 'Both systems are driven by irreversible thermodynamic currents that create structure through dissipation. Order emerges from directed entropy production.' },
  { dims: ['synchrony', 'criticality'],       label: 'CRITICAL SYNCHRONY',        thesis: 'Both domains exhibit collective phase-locking near critical thresholds. The interplay of synchronization and criticality amplifies microscale fluctuations to macroscale order.' },
  { dims: ['biological', 'economic'],         label: 'METABOLIC ECONOMY',         thesis: 'Both systems allocate scarce resources through competitive selection under thermodynamic constraints. Biological fitness and economic value follow parallel optimization landscapes.' },
  { dims: ['information', 'cryptographic'],   label: 'SIGNAL-CIPHER DUALITY',     thesis: 'Both domains encode structure through transformations that preserve information content while obscuring surface form. The tension between transparency and opacity is load-bearing.' },
  { dims: ['temporal', 'spatial'],            label: 'SPATIOTEMPORAL FIELD',       thesis: 'Both systems are fundamentally embedded in spatiotemporal geometry. Meaning arises from position, duration, and the propagation of influence through extended fields.' },
  { dims: ['stochastic', 'game_theory'],      label: 'STRATEGIC NOISE',           thesis: 'Both domains navigate uncertainty through strategic optimization under incomplete information. Noise is not a nuisance — it is the medium through which strategies are tested.' },
  { dims: ['entropy', 'thermodynamic'],       label: 'ENTROPY ENGINE',            thesis: 'Both domains are governed by the thermodynamic arrow. Irreversible entropy production is the fundamental driver, and structure is a transient eddy in the dissipative flow.' },
  { dims: ['dimensionality', 'information'],  label: 'HIGH-D INFORMATION MANIFOLD', thesis: 'Both systems live in high-dimensional spaces where meaning is distributed across many axes simultaneously. Compression and projection are the primary operations.' },
  { dims: ['conservation', 'synchrony'],      label: 'RESONANT EQUILIBRIUM',      thesis: 'Both domains stabilize through conservation laws and resonant coupling. Symmetry is the structural scaffold; synchronization is the dynamic expression.' },
  { dims: ['nonlinearity', 'dynamical'],      label: 'CHAOTIC TRAJECTORY',        thesis: 'Both systems are governed by nonlinear dynamics where small differences in initial conditions cascade into divergent trajectories. Prediction is bounded; structure is emergent.' },
  { dims: ['biological', 'entropy'],          label: 'LIVING DISSIPATION',        thesis: 'Both domains sustain far-from-equilibrium order through continuous entropy export. Life and its analogs persist by dissipating faster than their environment.' },
  { dims: ['criticality', 'thermodynamic'],   label: 'THERMODYNAMIC CRITICALITY', thesis: 'Both systems sit at thermodynamic phase boundaries where free-energy landscapes flatten and fluctuations diverge. The critical point is where computation is cheapest.' },
  { dims: ['spatial', 'biological'],          label: 'ECOLOGICAL FIELD',          thesis: 'Both domains are spatially distributed living systems where geography shapes competition, cooperation, and speciation. The field is the organism.' },
  { dims: ['game_theory', 'economic'],        label: 'STRATEGIC ALLOCATION',      thesis: 'Both systems optimize resource allocation through strategic interaction. Agents compete for positional advantage under constraints that reward efficiency and punish waste.' },
  { dims: ['nonlinearity', 'entropy'],        label: 'TURBULENT MIXING',          thesis: 'Both domains are characterized by nonlinear processes that amplify disorder. The interplay of sensitivity and irreversibility creates a mixing regime where structure is transient.' },
  { dims: ['synchrony', 'dynamical'],         label: 'COUPLED OSCILLATION',       thesis: 'Both systems evolve through coupled oscillatory dynamics where the timing of interaction determines the fate of the collective. Phase relationships carry all the information.' },
  { dims: ['dimensionality', 'criticality'],  label: 'HIGH-D PHASE TRANSITION',   thesis: 'Both domains undergo phase transitions in high-dimensional parameter spaces. The curse of dimensionality becomes a blessing: more dimensions mean more paths through the critical manifold.' },
];

// ── Viability register ──────────────────────────────────────────────────────
// Maps viability class to a rhetorical register that shapes the output tone.

const REGISTERS = {
  CRYSTALLINE:  { tone: 'assertive',    prefix: 'Structurally stable synthesis.',  confidence: 'This chimera has crystalline viability — the conceptual lattice is load-bearing.' },
  SUPERFLUID:   { tone: 'connective',   prefix: 'Fluid synthesis with high mobility.', confidence: 'Superfluid phase — the chimera flows freely between both parent architectures without friction.' },
  SUBSTRATE:    { tone: 'foundational',  prefix: 'Grounded synthesis.',            confidence: 'Substrate phase — viable as scaffolding but requires additional structure to become self-supporting.' },
  DECOHERENT:   { tone: 'speculative',   prefix: 'Speculative synthesis.',         confidence: 'Decoherent phase — the chimera is fragmentary. Treat outputs as seed hypotheses, not conclusions.' },
};

// ── Core narrative synthesis ────────────────────────────────────────────────

function detectArchetype(convergence) {
  if (!convergence || convergence.length < 2) return null;

  const convNames = new Set(convergence.map(d => d.name));
  let best = null, bestScore = -1;

  for (const arch of ARCHETYPES) {
    // Score: sum of contributions for matching dims, bonus for both present
    let score = 0;
    let matches = 0;
    for (const dim of arch.dims) {
      const found = convergence.find(d => d.name === dim);
      if (found) {
        score += found.contrib;
        matches++;
      }
    }
    // Both dims present = strong match (multiply by 2)
    if (matches === 2) score *= 2;
    // At least one dim must match
    if (matches > 0 && score > bestScore) {
      bestScore = score;
      best = arch;
    }
  }

  return best;
}

function buildSharedGround(convergence) {
  if (!convergence || convergence.length === 0) return null;

  const tags = convergence.map(d => DIM_SEMANTIC[d.name]?.tag || d.name).slice(0, 3);
  const descriptions = convergence
    .map(d => DIM_SEMANTIC[d.name]?.converge)
    .filter(Boolean)
    .slice(0, 2);

  return {
    tags,
    narrative: `Shared conceptual DNA in ${tags.join(', ')}. ${descriptions.length > 0 ? descriptions[0].charAt(0).toUpperCase() + descriptions[0].slice(1) + '.' : ''}`,
  };
}

function buildFrontier(divergence) {
  if (!divergence || divergence.length === 0) return null;

  const top = divergence[0];
  const sem = DIM_SEMANTIC[top.name];
  const tags = divergence.map(d => DIM_SEMANTIC[d.name]?.tag || d.name).slice(0, 3);

  return {
    tags,
    primaryAxis: sem?.tag || top.name,
    narrative: sem
      ? `Maximum orthogonality at ${sem.tag} (Δ${top.delta.toFixed(2)}): ${sem.diverge}.`
      : `Maximum orthogonality at ${top.name} (Δ${top.delta.toFixed(2)}).`,
  };
}

function buildAngles(archetype, convergence, divergence, paradoxes, result) {
  const angles = [];

  // Angle 1: Archetype × top divergence → the "what if" synthesis
  if (archetype && divergence && divergence.length > 0) {
    const topDiv = divergence[0];
    const divSem = DIM_SEMANTIC[topDiv.name];
    angles.push({
      tag: `${archetype.label} × ${divSem?.tag || topDiv.name}`,
      vector: `What emerges when ${archetype.label.toLowerCase()} dynamics meet ${(divSem?.tag || topDiv.name).toLowerCase()}? ` +
        `The convergence in ${convergence.slice(0, 2).map(d => d.name).join(' and ')} provides the scaffold; ` +
        `the Δ${topDiv.delta.toFixed(2)} tension in ${topDiv.name} is the forcing function.`,
    });
  }

  // Angle 2: Top convergence dim pushed through top paradox → the "irreducible" synthesis
  if (convergence && convergence.length > 0 && paradoxes && paradoxes.length > 0) {
    const topConv = convergence[0];
    const topPara = paradoxes[0];
    const convSem = DIM_SEMANTIC[topConv.name];
    const paraSem = DIM_SEMANTIC[topPara.name];
    angles.push({
      tag: `${convSem?.tag || topConv.name} ↔ ${paraSem?.tag || topPara.name}`,
      vector: `The strongest shared axis (${topConv.name}: ${topConv.vA.toFixed(2)}/${topConv.vB.toFixed(2)}) ` +
        `is structurally irreconcilable with ${topPara.name} (residual ${topPara.residual.toFixed(3)} after saponification). ` +
        `This tension cannot be resolved — it must be exploited.`,
    });
  }

  // Angle 3: Novelty-gated — if novelty > 0.7, the orthogonal complement is the payload
  if (result.novelty > 0.7 && divergence && divergence.length >= 2) {
    const d1 = divergence[0], d2 = divergence[1];
    angles.push({
      tag: 'ORTHOGONAL COMPLEMENT',
      vector: `${(result.novelty * 100).toFixed(0)}% of the collision energy is orthogonal — ` +
        `the chimera's primary content is NOT shared ground but the ${d1.name}/${d2.name} frontier ` +
        `(Δ${d1.delta.toFixed(2)}, Δ${d2.delta.toFixed(2)}). ` +
        `The synthesis lives in the space between the parents, not within either.`,
    });
  }

  // Angle 4: Coherence × viability → structural verdict
  if (result.viability != null) {
    const reg = REGISTERS[result.vClass] || REGISTERS.SUBSTRATE;
    const paradoxCount = paradoxes ? paradoxes.length : 0;
    const reconciled = 16 - paradoxCount;
    angles.push({
      tag: `${result.vClass || 'UNKNOWN'} VIABILITY`,
      vector: `${reg.confidence} ` +
        `${reconciled}/16 dimensions reconciled; ${paradoxCount} irreducible. ` +
        (paradoxCount > 10
          ? 'High paradox density — this is a generative collision, not a convergent one. Use for divergent exploration.'
          : paradoxCount > 5
          ? 'Moderate paradox load — the chimera holds shape but carries unresolved tensions. Good for targeted probing.'
          : paradoxCount > 0
          ? 'Low paradox count — the chimera is structurally clean. Most dimensional tensions are reconcilable.'
          : 'Full reconciliation — geometrically compatible domains. The chimera is stable but may lack creative friction.'),
    });
  }

  return angles;
}

function buildParadoxQuestions(paradoxes) {
  if (!paradoxes || paradoxes.length === 0) return [];

  return paradoxes.slice(0, 5).map(p => {
    const sem = DIM_SEMANTIC[p.name];
    if (!sem) return { dim: p.name, question: `How does ${p.name} orthogonality (residual ${p.residual.toFixed(3)}) survive reconciliation?` };

    return {
      dim: p.name,
      residual: p.residual,
      question: `${sem.tag}: ${sem.diverge}. After 32 saponification rounds, Δ${p.residual.toFixed(3)} persists. What structural feature makes this irreconcilable?`,
    };
  });
}

function synthesizeNarrative(result) {
  const { convergence, divergence, paradoxes, novelty, coherence, viability, vClass, phase } = result;

  // ── Archetype detection
  const archetype = detectArchetype(convergence);

  // ── Viability register
  const register = REGISTERS[vClass] || REGISTERS.SUBSTRATE;

  // ── Shared ground
  const sharedGround = buildSharedGround(convergence);

  // ── Innovation frontier
  const frontier = buildFrontier(divergence);

  // ── Prompt angles (the decay products)
  const angles = buildAngles(archetype, convergence, divergence, paradoxes, result);

  // ── Paradox questions
  const paradoxQuestions = buildParadoxQuestions(paradoxes);

  // ── Thesis: archetype + register + frontier
  const thesis = archetype
    ? `${register.prefix} ${archetype.thesis}`
    : register.prefix + (sharedGround
      ? ` ${sharedGround.narrative}`
      : ' Insufficient convergence data for archetype classification.');

  return {
    archetype:   archetype?.label || null,
    register:    vClass || 'UNKNOWN',
    registerTone: register.tone,
    thesis,
    sharedGround,
    frontier,
    angles,
    paradoxQuestions,
    meta: {
      novelty,
      coherence,
      viability,
      phase,
      paradoxCount: paradoxes?.length || 0,
      convergenceCount: convergence?.length || 0,
      divergenceCount: divergence?.length || 0,
    },
  };
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useColliderNarrative(result) {
  return useMemo(() => {
    if (!result || result.viability == null) return null;
    return synthesizeNarrative(result);
  }, [result]);
}

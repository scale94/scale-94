// src/terminal/data/dimSemantics.js
// Shared dimension vocabulary for both narrative engines (Scaling's
// useColliderNarrative and the Council synthesis engine). Each legacy dim
// maps to a conceptual tag plus converge/diverge narrative fragments.

// ── Dimension semantics ─────────────────────────────────────────────────────
// Each dim maps to a concise conceptual label and a narrative fragment
// describing what it means when two domains share or diverge on this axis.

export const DIM_SEMANTIC = {
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

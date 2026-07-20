// ─────────────────────────────────────────────────────────────────────────────
// ecocideEngine.js — bidirectional ecological simulation core
//
// Signed vitality v ∈ [−1, +1]:
//   −1 = void/dead (FINAL_STATE)   0 = HOMEOSTASIS (baseline)   +1 = FLOURISHING
//
// "Degrowth is the key": protection levers are inert until growth is tamed.
// See docs/superpowers/specs/2026-07-20-ecocide-regenerative-mirror-design.md
// ─────────────────────────────────────────────────────────────────────────────

export const ECO_TUNING = Object.freeze({
  GATE_LOW:      1.5,   // % growth — at/below, healing gate fully open
  GATE_HIGH:     3.0,   // % growth — at/above, healing gate fully closed
  W_SANCTUARY:   0.35,  // passive-recovery weight
  W_RESTORATION: 0.65,  // active-regeneration weight (the bloom driver)
  K_HEAL:        0.9,    // dv/dt healing coefficient
  K_EXTRACT:     0.6,    // dv/dt extraction-damage coefficient
  K_TOX:         0.4,    // dv/dt toxicity-damage coefficient
  V_MIN:        -1,
  V_MAX:         1,
});

// Smoothstep — 0 below edge0, 1 above edge1, Hermite in between.
function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Growth mandate → extraction intensity for a biosphere at `deadFrac` degradation.
// Moved verbatim from EcocideTab.jsx (single source of truth).
export function growthToGdp(growthRate, deadFrac) {
  const bioCap = Math.max(0.05, 1.0 - deadFrac * 0.92);
  return Math.min(12.0, 1.0 + growthRate / bioCap);
}

// The degrowth gate: 1 (open) at steady-state, 0 (closed) at high growth.
export function degrowthGate(growth) {
  return 1 - smoothstep(ECO_TUNING.GATE_LOW, ECO_TUNING.GATE_HIGH, growth);
}

export function healingPower(gate, sanctuary, restoration) {
  return gate * (ECO_TUNING.W_SANCTUARY * sanctuary + ECO_TUNING.W_RESTORATION * restoration);
}

export function toxicityLoad(extraction, toxicityCap) {
  return Math.max(0, extraction) * (1 - toxicityCap);
}

// One integrator step. Reads the previous signed vitality, returns the next.
export function stepVitality(prevV, levers, dt) {
  const { growth, toxicityCap, sanctuary, restoration } = levers;
  const degradation = Math.max(0, -prevV);                 // = current deadFrac
  const extraction  = growthToGdp(growth, degradation) - 1.0;
  const toxicity    = toxicityLoad(extraction, toxicityCap);
  const gate        = degrowthGate(growth);
  const healing     = healingPower(gate, sanctuary, restoration);

  const dv = (ECO_TUNING.K_HEAL * healing
            - (ECO_TUNING.K_EXTRACT * extraction + ECO_TUNING.K_TOX * toxicity)) * dt;

  const v = clamp(prevV + dv, ECO_TUNING.V_MIN, ECO_TUNING.V_MAX);
  return { v, extraction, toxicity, gate, healing };
}

// Split signed vitality into the two display tracks the map consumes.
export function deriveFracs(v) {
  return { deadFrac: Math.max(0, -v), bloomFrac: Math.max(0, v) };
}

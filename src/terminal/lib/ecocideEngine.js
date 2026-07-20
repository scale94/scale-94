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
  K_HEAL:        0.9,    // dv/dt healing coefficient (legacy stepVitality only)
  K_EXTRACT:     0.6,    // dv/dt extraction-damage coefficient (legacy stepVitality only)
  K_TOX:         0.4,    // dv/dt toxicity-damage coefficient (legacy stepVitality only)
  V_MIN:        -1,
  V_MAX:         1,
  // ── Hybrid integrator constants ──────────────────────────────────────────
  // Collapse half is main's exact one-way JS integrator (EcocideTab.jsx ~L420-447):
  // there is NO WASM ecocide kernel — run_ecocide never existed, so this arithmetic
  // has always BEEN the collapse. These three are copied verbatim to preserve the
  // collapse velocity tick-for-tick.
  K_DAMAGE_JS:     0.055, // extraction → dead-fraction damage rate
  REGEN_RATE:      0.12,  // biosphere regeneration capacity (shrinks with degradation)
  RECOVERY_RATE:   0.008, // slow natural recovery, only below RECOVERY_GROWTH
  RECOVERY_GROWTH: 0.5,   // % growth below which natural recovery kicks in
  DEAD_CEIL:       0.98,  // max deadFrac — the 2% living remainder never dies
  // Healing half (new, tunable live in-browser):
  TOXCAP_STRENGTH: 0.6,   // how far a full toxicity cap throttles extraction damage (gated)
  K_HEAL_JS:       0.25,  // bloom responsiveness — dv/dt per unit healingPower
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

// The double-bind, reframed. Dropping below the 2.0% mandate still fires social
// penalties (naive contraction = unemployment riots), but funded protection —
// a just transition — buys the penalty level down.
export function socialPenaltyLevel(growth, sanctuary, restoration, mandateActive) {
  if (!mandateActive || growth >= 2.0) return 0;
  const base = growth < 1.0 ? 3 : growth < 1.5 ? 2 : 1;
  const funding = Math.round((sanctuary + restoration) / 2);  // 0..1 → 0, 1
  return Math.max(0, base - funding * 2);                      // funding shaves up to 2 levels
}

// ── Hybrid bidirectional integrator ─────────────────────────────────────────
// The tick's real step. Collapse is main's EXACT one-way JS integrator (there is
// no WASM ecocide kernel; run_ecocide never existed), so with all protection
// levers at 0, deriveFracs(v).deadFrac reproduces main tick-for-tick. Healing is
// the engine's gated positive excursion — the ONLY term that creates bloom (v>0).
export function stepVitalityHybrid(prevV, levers, dt) {
  const { growth, toxicityCap = 0, sanctuary = 0, restoration = 0 } = levers;
  const df = Math.max(0, -prevV);                         // current deadFrac

  const gate = degrowthGate(growth);                      // 0 at high growth → protections inert
  // Collapse (main's integrator). The toxicity cap throttles extraction damage
  // only once the gate is open — so maxed protection at high growth changes
  // nothing (the greenwash invariant stays mechanically true).
  const extraction   = Math.max(0, growthToGdp(growth, df) - 1.0);
  const regeneration = ECO_TUNING.REGEN_RATE * (1.0 - df);
  const toxThrottle  = 1 - ECO_TUNING.TOXCAP_STRENGTH * toxicityCap * gate;
  const damage       = Math.max(0, extraction * ECO_TUNING.K_DAMAGE_JS * toxThrottle - regeneration) * dt;
  const recovery     = growth < ECO_TUNING.RECOVERY_GROWTH
    ? ECO_TUNING.RECOVERY_RATE * (1.0 - df) * dt : 0;

  // Healing (gated) — the bloom driver.
  const healing = healingPower(gate, sanctuary, restoration);
  const heal    = ECO_TUNING.K_HEAL_JS * healing * dt;

  let v = prevV - damage + heal;
  // Natural recovery nudges a dead world toward baseline but never past it — no
  // bloom without funded healing (matches main's deadFrac floor at 0).
  if (v < 0 && recovery > 0) v = Math.min(0, v + recovery);
  v = clamp(v, -ECO_TUNING.DEAD_CEIL, ECO_TUNING.V_MAX);
  return { v, extraction, damage, healing, gate };
}

// Positive mirror of the collapse ladder. Index 0 = HOMEOSTASIS (shared pivot).
// NOTE: intentionally separate from EcocideTab's PHASE_NAME — that array is a
// frozen observatory contract and must not gain entries.
export const REGEN_NAME  = ['HOMEOSTASIS', 'RECOVERY', 'REWILDING', 'FLOURISHING', 'ABUNDANCE'];
export const REGEN_COLOR = ['#7ab800', '#5fbf3a', '#3fd06a', '#7fe08a', '#d8c85a'];

// bloomFrac (0..1) → regen phase index 0..4. Thresholds mirror the collapse
// phase cuts (0.10 / 0.30 / 0.55 / 0.85) used in EcocideTab's JS integrator.
export function bloomPhase(bloomFrac) {
  if (bloomFrac >= 0.85) return 4;
  if (bloomFrac >= 0.55) return 3;
  if (bloomFrac >= 0.30) return 2;
  if (bloomFrac >= 0.10) return 1;
  return 0;
}

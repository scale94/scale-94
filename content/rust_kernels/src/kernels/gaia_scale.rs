// kernels/gaia_scale.rs — Gaia-Scale Kernel v5.5.5
// Sovereign Reconstruction · Mineralization Dynamics · Triarchy Authorization
//
// Distinct from geopolitical_kinetics.rs (which models regime stability and statecraft).
// GAIA-SCALE is a sovereign *persistence* protocol: 1,000-year thermodynamic planning,
// Triarchy triple-key gating, Li-ion longevity economics, and fiat→time conversion.
//
// References:
//   Daly (1990) — Toward a stationary-state economy [Daly bounds]
//   Battery University BU-808 — Li-ion cycle life at charge windows
//   Gaia-Scale-Kernel-5.5.5 §I-V — doctrinal substrate
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;

/// Triarchy coherence: geometric mean of three independent attestation channels.
/// Truth × Law × Empathy — all three required; any zero collapses the product.
/// C = (truth × law × empathy)^(1/3)   range [0, 1]
fn triarchy_coherence(threat: f64) -> (f64, f64, f64, f64) {
    // Simulated attestation values derived from threat level
    // truth:   sensor confidence increases with threat severity (instrumentation response)
    // law:     legal threshold response (sigmoid around threshold = 3.0)
    // empathy: human judgment degrades under high stress (thermal runaway at threat > 7)
    let truth   = (0.60 + threat * 0.04).min(0.99);
    let law     = 1.0 / (1.0 + (-2.5 * (threat - 3.0)).exp());
    let empathy = (1.0 - (threat / 10.0).powi(2)).max(0.05);
    let coherence = (truth * law * empathy).cbrt();
    (truth, law, empathy, coherence)
}

/// Temporal veto: probability that an action mortgages the future to pay for the present.
/// Veto activates when short-term benefit is purchased at irreversible long-term cost.
/// V_score = resource_ratio × (1 − horizon_discount)  where discount = log(years)/log(3000)
fn temporal_veto_score(resource_ratio: f64, horizon_years: f64) -> (f64, bool) {
    let horizon_discount = (horizon_years.max(1.0).ln() / (3000.0_f64).ln()).min(1.0);
    // Low resource_ratio under short horizon = mortgaging future
    let veto_pressure = resource_ratio * (1.0 - horizon_discount);
    let veto_active   = veto_pressure < 0.25 && horizon_years < 100.0;
    (veto_pressure, veto_active)
}

/// Li-ion longevity multiplier from the 20-80-35 rule.
/// BU-808: ~3× cycle life at 20–80% vs 0–100%. Arrhenius: ×2 aging per 10°C above 25°C.
/// charge_window: 0.0 = 0–100% (worst), 1.0 = strict 20–80% (best)
/// temp_delta:    °C above 25°C baseline (0 = ideal, 10 = Arrhenius doubling zone)
fn liion_longevity(resource_ratio: f64) -> (f64, &'static str) {
    // resource_ratio proxies the charge discipline: high sovereignty → maintained window
    let window_score = 0.33 + resource_ratio * 0.67; // 0.33 at r=0, 1.0 at r=1.0
    let cycle_multiplier = 1.0 + window_score * 2.0; // 1.0× to 3.0×
    let regime = if window_score > 0.80 { "ELASTIC: Li lattice in reversible intercalation regime" }
                 else if window_score > 0.50 { "MARGINAL: partial structural stress accumulating" }
                 else { "DEGRADED: deep-cycle damage, irreversible capacity loss" };
    (cycle_multiplier, regime)
}

/// Mineralization rate: sustainable entropy throughput at criticality.
/// Mineralization ≠ stagnation. Stagnation: dS_system → 0 with nothing deposited.
/// Mineralization: dS_export > 0, structure accumulates at sustainable σ*.
/// M = J × ∇X × η_dissipation  where η = channel efficiency ∈ [0, 1]
fn mineralization_rate(resource_ratio: f64, horizon_years: f64) -> (f64, &'static str) {
    // Flow J: resources deployed per unit time
    let j = resource_ratio * 1.0;
    // Gradient ∇X: sovereignty differential (resources available vs baseline)
    let grad = (resource_ratio - 0.3).max(0.0) * 3.0;
    // Channel efficiency: improves with longer horizon (more constructal optimization)
    let eta = 1.0 - (1.0 / (1.0 + horizon_years / 100.0));
    let m   = j * grad * eta;
    let state = if m > 0.5 { "MINERALIZING: structure depositing at sustainable rate" }
                else if m > 0.1 { "THRESHOLD: mineralization beginning — substrate forming" }
                else { "STAGNANT: no structure depositing — review resource gradient" };
    (m, state)
}

/// Fiat→Time conversion efficiency.
/// Trading fiat for chronos: compute multiplies sovereign hours.
/// E = compute_leverage / fiat_cost = hours_recovered / euros_spent
/// Priority ordering: Compute (highest velocity) → Hardware (substrate preservation)
fn fiat_to_time(resource_ratio: f64) -> (f64, f64, f64) {
    // At resource_ratio = 0.8: 1 EUR → 4.2 hours of compute-leveraged work
    // At resource_ratio = 0.2: 1 EUR → 0.9 hours (depleted — must spend more for less)
    let compute_leverage    = 1.0 + resource_ratio * 4.0;  // 1.0–5.0×
    let hardware_roi        = 0.5 + resource_ratio * 2.5;  // 0.5–3.0× substrate lifetime
    let sovereign_efficiency = (compute_leverage * hardware_roi).sqrt();
    (compute_leverage, hardware_roi, sovereign_efficiency)
}

#[wasm_bindgen]
pub fn run_gaia_scale_protocol(threat_level: f64, resource_ratio: f64, horizon_years: f64) -> String {
    let threat   = threat_level.clamp(0.0, 10.0);
    let resource = resource_ratio.clamp(0.0, 1.0);
    let horizon  = horizon_years.clamp(1.0, 3000.0);

    let (truth, law, empathy, coherence)  = triarchy_coherence(threat);
    let (veto_pressure, veto_active)      = temporal_veto_score(resource, horizon);
    let (cycle_mult, liion_regime)        = liion_longevity(resource);
    let (m_rate, mineral_state)           = mineralization_rate(resource, horizon);
    let (comp_lev, hw_roi, sov_eff)       = fiat_to_time(resource);

    // Level-5 authorization: requires coherence > 0.7 AND veto clear AND threat < 8
    let l5_authorized = coherence > 0.70 && !veto_active && threat < 8.0;
    let authorization = if l5_authorized        { "AUTHORIZED: triple-key coherence confirmed" }
                        else if veto_active      { "VETOED: action mortgages future — temporal override blocked" }
                        else if coherence < 0.70 { "BLOCKED: Triarchy coherence below threshold (0.70)" }
                        else                     { "LOCKED: threat ceiling exceeded — Empathy key degraded" };

    // Defensive posture
    let posture = if threat < 2.0  { "DORMANT — no gradient detected, substrate monitoring only" }
                  else if threat < 5.0 { "AREA_DENIAL — porcupine mode: cost of incursion → unviable" }
                  else if threat < 8.0 { "HARDENED — minimal kinetic response, narrative layer active" }
                  else               { "CRITICAL — substrate threat confirmed, maximum dissipation rate" };

    let mut out = String::with_capacity(2200);
    write!(out,
        "GAIA_SCALE_KERNEL v5.5.5 // SOVEREIGN_RECONSTRUCTION\n\
         ═══════════════════════════════════════════════════════\n\
         INPUT  THREAT_LEVEL: {threat:.1}/10  RESOURCE_RATIO: {res:.3}  HORIZON: {hz:.0} yr\n\
         ───────────────────────────────────────────────────────\n\
         DEFENSIVE POSTURE : {posture}\n\
         ───────────────────────────────────────────────────────\n\
         TRIARCHY AUTHORIZATION (3-KEY PROTOCOL)\n\
           TRUTH   [sensor/AI]  : {truth:.4}   (threat-calibrated instrumentation)\n\
           LAW     [proof layer]: {law:.4}   (sigmoid gate at threshold=3.0)\n\
           EMPATHY [human judgment]:{empathy:.4}   (degrades above thermal runaway load)\n\
           COHERENCE (geo mean) : {coherence:.4}   threshold=0.700\n\
           LEVEL-5 STATUS       : {auth}\n\
         ───────────────────────────────────────────────────────\n\
         TEMPORAL VETO ANALYSIS\n\
           VETO_PRESSURE : {vp:.4}   (resource × (1 − horizon_discount))\n\
           HORIZON_DISC  : {hd:.4}   (log({hz:.0}) / log(3000))\n\
           VETO_STATUS   : {vs}\n\
         ───────────────────────────────────────────────────────\n\
         LI-ION LONGEVITY (20-80-35 RULE · BU-808)\n\
           CYCLE_MULTIPLIER : {cm:.2}×   (1.0=depleted, 3.0=optimal 20-80% window)\n\
           REGIME           : {lr}\n\
         ───────────────────────────────────────────────────────\n\
         MINERALIZATION DYNAMICS\n\
           M_RATE : {mr:.4}   σ* = J · ∇X · η_channel\n\
           STATE  : {ms}\n\
           NOTE   : Mineralization ≠ stagnation. Non-zero M_RATE = structure depositing.\n\
         ───────────────────────────────────────────────────────\n\
         FIAT → TIME CONVERSION\n\
           COMPUTE_LEVERAGE  : {cl:.2}×  (1 EUR → {cl:.2}h sovereign compute)\n\
           HARDWARE_ROI      : {hr:.2}×  (substrate lifetime extension per unit capital)\n\
           SOVEREIGN_EFF     : {se:.3}   (√(compute × hardware))\n\
         ───────────────────────────────────────────────────────\n\
         HORIZON : {hz:.0} yr / 3000 yr  [{hpct:.1}% of millennial arc]\n\
         STATUS  : {status}\n\
         SOURCE  : content/rust_kernels/src/kernels/gaia_scale.rs\n\
         THEORY  : Daly (1990) · BU-808 · GAIA-5.5.5 §I-V",
        threat = threat, res = resource, hz = horizon,
        posture = posture,
        truth = truth, law = law, empathy = empathy, coherence = coherence,
        auth  = authorization,
        vp    = veto_pressure,
        hd    = (horizon.max(1.0).ln() / (3000.0_f64).ln()).min(1.0),
        vs    = if veto_active { "VETO_ACTIVE — temporal override required" } else { "CLEAR — action within temporal envelope" },
        cm    = cycle_mult, lr = liion_regime,
        mr    = m_rate, ms = mineral_state,
        cl    = comp_lev, hr = hw_roi, se = sov_eff,
        hpct  = (horizon / 3000.0) * 100.0,
        status = if l5_authorized && m_rate > 0.3 { "NOMINAL — sovereignty architecture active, mineralizing" }
                 else if veto_active               { "VETO_HOLD — temporal protocol blocking Level-5 action" }
                 else                              { "MONITORING — Triarchy watch mode, no Level-5 event" },
    ).unwrap();

    out
}

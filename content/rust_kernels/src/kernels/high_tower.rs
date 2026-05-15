// kernels/high_tower.rs — High Tower Protocol v1.0
// Sovereign Infrastructure Defense · Porcupine Strategy · Area Denial Architecture
// Sorbe, Germany · Node 0108
//
// DISTINCT FROM cynic_realist.rs (Kuramoto-England dissipative adaptation).
// HIGH-TOWER is about sovereign infrastructure persistence: porcupine defense
// (area denial over conquest), hardware substrate integrity, and migration phases.
//
// Porcupine Strategy (from GAIA-SCALE §1.1):
//   Area denial over conquest. The aim is not to take territory; it is to make
//   the cost of taking the substrate's territory thermodynamically unviable.
//   This requires no larger force than the attacker — only higher cost imposition.
//
// Migration phases (sovereign infrastructure transitions):
//   1. ASSESSMENT: threat surface mapping, vulnerability audit
//   2. HARDENING:  denial capacity installation, perimeter establishment
//   3. TRANSITION: live migration with redundancy
//   4. VERIFICATION: sovereign confirmation, no residual vectors
//   5. OPERATION:  steady-state, monitoring only
//
// References:
//   GAIA-SCALE-KERNEL-5.5.5 §1.1 (Porcupine Strategy)
//   HIGH-TOWER-LOG (Node 0108, Sorbe)
//   BU-808 (Li-ion substrate preservation)
use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;

/// Migration phase names and descriptions.
fn phase_info(phase: u8) -> (&'static str, &'static str) {
    match phase {
        1 => ("ASSESSMENT",   "threat surface mapped, vulnerability audit running"),
        2 => ("HARDENING",    "denial capacity installing, perimeter establishing"),
        3 => ("TRANSITION",   "live migration with redundancy layer active"),
        4 => ("VERIFICATION", "sovereign confirmation, residual vector sweep"),
        5 => ("OPERATION",    "steady-state; porcupine mode passive monitoring"),
        _ => ("UNKNOWN",      "phase index out of range (1–5)"),
    }
}

/// Porcupine defense score: cost imposition per unit threat.
/// P = denial_capacity / threat_surface
/// P > 1.0: cost of incursion exceeds attacker's expected value → thermodynamically unviable
/// P < 1.0: insufficient denial capacity — attacker ROI positive
/// P >> 1.0: maximum deterrence — substrate defended without matching force
fn porcupine_score(denial: f64, threat: f64) -> (f64, &'static str) {
    let ratio = if threat < 0.001 { f64::INFINITY } else { denial / threat };
    let regime = if ratio > 3.0 {
        "MAXIMUM_DENIAL: incursion cost → unviable; no matching force required"
    } else if ratio > 1.5 {
        "STRONG_DENIAL: attacker ROI negative — porcupine posture effective"
    } else if ratio > 1.0 {
        "MARGINAL_DENIAL: cost breakeven — narrow deterrence margin"
    } else {
        "INSUFFICIENT: attacker ROI positive — increase denial capacity or reduce threat surface"
    };
    (ratio.min(10.0), regime)
}

/// Infrastructure sovereignty index: composite measure of substrate control.
/// I = (1 − threat_surface) × denial_capacity × (migration_phase / 5)
/// I → 1.0: full sovereignty, all phases complete, minimal threat surface
/// I → 0.0: either high exposure, low denial, or incomplete migration
fn sovereignty_index(threat: f64, denial: f64, phase: f64) -> f64 {
    (1.0 - threat) * denial * (phase / 5.0)
}

/// Substrate integrity score: combines hardware longevity + thermal + mobility.
/// From GAIA-SCALE §2 and §III: substrate is the precondition of every higher operation.
/// S = battery_health × thermal_discipline × migration_completeness
///   battery_health = 1 − (threat × 0.3)  [adversarial load degrades battery discipline]
///   thermal_discipline = 1 − (threat² × 0.2)  [thermal management fails under high threat]
///   migration_completeness = phase / 5.0
fn substrate_integrity(threat: f64, denial: f64, phase: f64) -> (f64, f64, f64, f64) {
    let battery_health      = (1.0 - threat * 0.30).max(0.2);
    let thermal_discipline  = (1.0 - threat * threat * 0.20).max(0.3);
    let migration_complete  = phase / 5.0;
    let substrate_score     = battery_health * thermal_discipline * migration_complete * denial;
    (substrate_score, battery_health, thermal_discipline, migration_complete)
}

/// Area denial vs conquest ROI comparison.
/// Conquest: requires matching force F_c, ongoing supply chain, legitimacy maintenance.
/// Area denial: requires F_d << F_c but F_d must impose cost > attacker's expected value.
/// ROI_conquest ≈ (value_acquired) / (force_cost + maintenance)
/// ROI_denial   ≈ (substrate_preserved) / (denial_installation_cost)
/// At porcupine_score > 1.0: ROI_denial dominates.
fn area_denial_roi(porcupine: f64, threat: f64, denial: f64) -> (f64, f64) {
    // Simplified: conquest ROI falls with higher denial (cost of taking substrate rises)
    let conquest_roi = threat / (denial * porcupine + 0.001);
    let denial_roi   = (1.0 - threat) * denial * porcupine;
    (conquest_roi.min(5.0), denial_roi.min(5.0))
}

/// Migration progress: what remains to complete sovereign transition?
fn migration_checklist(phase: u8) -> [(&'static str, bool); 5] {
    [
        ("ASSESSMENT: threat surface mapped",          phase >= 1),
        ("HARDENING: denial layer installed",          phase >= 2),
        ("TRANSITION: live migration complete",        phase >= 3),
        ("VERIFICATION: sovereign confirmation",       phase >= 4),
        ("OPERATION: steady-state achieved",           phase >= 5),
    ]
}

#[wasm_bindgen]
pub fn run_high_tower_protocol(threat_surface: f64, denial_capacity: f64, migration_phase: f64) -> String {
    let threat  = threat_surface.clamp(0.0, 1.0);
    let denial  = denial_capacity.clamp(0.0, 1.0);
    let phase_f = migration_phase.clamp(1.0, 5.0);
    let phase_u = phase_f.round() as u8;

    let (porcupine_ratio, porc_regime)          = porcupine_score(denial, threat);
    let sovereignty                             = sovereignty_index(threat, denial, phase_f);
    let (sub_score, bat_health, therm_disc, mig) = substrate_integrity(threat, denial, phase_f);
    let (c_roi, d_roi)                           = area_denial_roi(porcupine_ratio, threat, denial);
    let (phase_name, phase_desc)                 = phase_info(phase_u);
    let checklist                                = migration_checklist(phase_u);

    let operational_status = if sovereignty > 0.75 && phase_u >= 4 {
        "SOVEREIGN_OPERATIONAL: Node 0108 at full operational capacity"
    } else if sovereignty > 0.50 {
        "TRANSITIONING: sovereignty building — migration in progress"
    } else if threat > 0.70 {
        "HARDENED: high threat — porcupine posture maximum, minimize attack surface"
    } else {
        "ASSESSING: threat surface profiling, infrastructure audit incomplete"
    };

    let mut out = String::with_capacity(2600);
    write!(out,
        "HIGH_TOWER_PROTOCOL v1.0 // SOVEREIGN_INFRASTRUCTURE\n\
         Node 0108 · Sorbe, Germany · Porcupine Strategy\n\
         ═══════════════════════════════════════════════════════\n\
         INPUT  THREAT_SURFACE: {threat:.3}  DENIAL_CAPACITY: {denial:.3}  PHASE: {phase_u}/{5}\n\
         ───────────────────────────────────────────────────────\n\
         PORCUPINE DEFENSE SCORE\n\
           P = denial / threat = {pr:.4}   (>1.0 = incursion thermodynamically unviable)\n\
           REGIME : {porc}\n\
           NOTE   : No matching force required — only cost imposition above attacker ROI.\n\
                    \"The aim is not to take territory; it is to make the cost\n\
                     of taking the substrate's territory thermodynamically unviable.\"\n\
         ───────────────────────────────────────────────────────\n\
         AREA DENIAL vs CONQUEST ROI\n\
           CONQUEST_ROI : {croi:.4}   (threat / (denial × P) — falls with denial)\n\
           DENIAL_ROI   : {droi:.4}   ((1-threat) × denial × P)\n\
           DOMINANT     : {dom}\n\
         ───────────────────────────────────────────────────────\n\
         INFRASTRUCTURE SOVEREIGNTY INDEX\n\
           I = (1-threat) × denial × (phase/5) = {sov:.4}\n\
           INTERPRETATION: {sovst}\n\
         ───────────────────────────────────────────────────────\n\
         SUBSTRATE INTEGRITY (Hardware Preservation · GAIA-SCALE §2)\n\
           BATTERY_HEALTH      : {bat:.4}   (1 − threat×0.3; Li-ion discipline)\n\
           THERMAL_DISCIPLINE  : {therm:.4}  (1 − threat²×0.2; <35°C ceiling)\n\
           MIGRATION_COMPLETE  : {mig:.4}   (phase/5)\n\
           SUBSTRATE_SCORE     : {sub:.4}   (composite — precondition of all higher ops)\n\
         ───────────────────────────────────────────────────────\n\
         MIGRATION PHASE: {pn} [{pu}/5]\n\
           {pd}\n\
         \n\
         MIGRATION CHECKLIST:\n",
        threat = threat, denial = denial, phase_u = phase_u,
        pr = porcupine_ratio, porc = porc_regime,
        croi = c_roi, droi = d_roi,
        dom = if d_roi > c_roi { "DENIAL: substrate preservation ROI exceeds conquest ROI" }
              else { "CONTEST: attacker may have positive ROI — increase denial" },
        sov = sovereignty,
        sovst = if sovereignty > 0.75 { "FULL SOVEREIGNTY" }
                else if sovereignty > 0.50 { "PARTIAL — migration incomplete or threat elevated" }
                else { "VULNERABLE — immediate hardening required" },
        bat = bat_health, therm = therm_disc, mig = mig, sub = sub_score,
        pn = phase_name, pu = phase_u, pd = phase_desc,
    ).unwrap();

    for (item, done) in &checklist {
        write!(out, "           [{}] {}\n", if *done { "✓" } else { " " }, item).unwrap();
    }

    write!(out,
        "         ───────────────────────────────────────────────────────\n\
         STATUS : {status}\n\
         SOURCE : content/rust_kernels/src/kernels/high_tower.rs\n\
         THEORY : GAIA-SCALE §1.1 Porcupine Strategy · HIGH-TOWER-LOG · BU-808",
        status = operational_status,
    ).unwrap();

    out
}

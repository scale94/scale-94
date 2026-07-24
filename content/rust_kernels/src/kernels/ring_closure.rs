// kernels/ring_closure.rs — Ring-Closure Kernel v1.0.0
//
// This kernel IS the ROSSIGNOL-RUISENOR-NIGHTINGALE-ANDALIB-KERNEL-5.5.5.5 method.
//
// Doctrine: quintessence is not a fifth substance but a closed ring — one bird
// crossing four language borders, accreting payload at each crossing, returning
// home already wearing a foreign first name. Four birds bind to the elements:
// rossignol = AIR, ruiseñor = EARTH, nightingale = WATER, ʿandalīb = FIRE; the
// fifth, Nachtigall(er), is QUINTESSENCE — the spine. Patch 5.∅ (Ring-Closure):
// a chain is admitted as quintessence only if it closes — the word must come home
// changed, welded through Abdul Nachtigaller (German bird, Arabic name, one canon).
// "He does not mix purity — he publishes the cut": every drop calibrated at 100 MT,
// the tracklist published as assay. Purity is the label telling the truth.
//
// The model: the bird crosses five borders (DE→FR→ES→EN→AR→home), each a fifth of
// a full turn; border drift perturbs each crossing, and the closure residual reads
// how far the returning word lands from its origin. Calibration (the honest, cut-
// declaring 100 MT label) tightens every crossing. In parallel the four elements
// accrete mass; the ring is quintessence only if it closes AND the four balance.
//
// SOMA-9.4 · FADE_DOCTRINE

use std::fmt::Write as FmtWrite;
use wasm_bindgen::prelude::*;

use super::utils::lcg_next;

const ELEMENTS: [(&str, &str); 4] = [
    ("AIR",   "rossignol (FR) \u{2014} the pick that makes the lock sing"),
    ("EARTH", "ruise\u{00F1}or (ES) \u{2014} a lord of land by mishearing"),
    ("WATER", "nightingale (EN) \u{2014} the washed ward, the lamp doubled"),
    ("FIRE",  "\u{02BF}andal\u{012B}b (AR) \u{2014} the thorn, the blood-dyed rose"),
];

// Irreducible drift floor — even a perfectly calibrated crossing has texture.
const DRIFT_FLOOR: f64 = 0.02;

/// Effective per-crossing drift: calibration (0–100 MT, the honest cut-declaring
/// label) tightens every hop toward the floor.
fn effective_drift(border_drift: f64, calibration: f64) -> f64 {
    let cal_norm = (calibration / 100.0).clamp(0.0, 1.0);
    border_drift.max(0.0) * (1.0 - cal_norm) + DRIFT_FLOOR
}

/// Ring closure residual, in turns. Five crossings of 1/5 turn each should sum to
/// one full turn; drift perturbs each. Residual = |accumulated − 1 turn|.
fn ring_residual(border_drift: f64, calibration: f64, seed: u64) -> f64 {
    let eff = effective_drift(border_drift, calibration);
    let mut s = seed | 1;
    let mut turn = 0.0_f64;
    for _ in 0..5 {
        let jitter = (lcg_next(&mut s) - 0.5) * 2.0 * eff; // ±eff
        turn += 0.2 + jitter;
    }
    (turn - 1.0).abs()
}

/// Four elemental masses, accreted across the four element-borders.
fn accrete_elements(accretion_gain: f64, border_drift: f64, calibration: f64, seed: u64) -> [f64; 4] {
    let eff = effective_drift(border_drift, calibration);
    let gain = accretion_gain.max(0.0);
    let mut s = seed.wrapping_mul(2_862_933_555_777_941_757) | 1;
    let mut m = [0.0_f64; 4];
    for i in 0..4 {
        let jitter = (lcg_next(&mut s) - 0.5) * 2.0 * eff;
        m[i] = (gain * (1.0 + jitter)).max(0.0);
    }
    m
}

/// Coefficient of variation of the four elemental masses (0 = perfectly balanced).
fn balance_cv(masses: &[f64; 4]) -> f64 {
    let mean = masses.iter().sum::<f64>() / 4.0;
    if mean <= 1e-9 { return 0.0; }
    let var = masses.iter().map(|m| (m - mean).powi(2)).sum::<f64>() / 4.0;
    var.sqrt() / mean
}

struct RingAudit {
    masses:           [f64; 4],
    balance_cv:       f64,
    closure_residual: f64,
    closes:           bool,
    balanced:         bool,
    compiles:         bool,
    calibration:      f64,
}

fn audit_ring(
    calibration: f64,
    border_drift: f64,
    spine_seed: f64,
    element_tolerance: f64,
    accretion_gain: f64,
    closure_threshold: f64,
) -> RingAudit {
    let seed = (spine_seed.abs() as u64).wrapping_add(1);
    let tol = element_tolerance.clamp(0.0, 2.0);
    let thr = closure_threshold.clamp(0.0, 1.0);

    let closure_residual = ring_residual(border_drift, calibration, seed);
    let masses = accrete_elements(accretion_gain, border_drift, calibration, seed);
    let cv = balance_cv(&masses);

    let closes = closure_residual <= thr;
    let balanced = cv <= tol;

    RingAudit {
        masses,
        balance_cv: cv,
        closure_residual,
        closes,
        balanced,
        compiles: closes && balanced,
        calibration: calibration.clamp(0.0, 100.0),
    }
}

#[wasm_bindgen]
pub fn run_ring_closure(
    calibration: f64,
    border_drift: f64,
    spine_seed: f64,
    element_tolerance: f64,
    accretion_gain: f64,
    closure_threshold: f64,
) -> String {
    let a = audit_ring(calibration, border_drift, spine_seed, element_tolerance, accretion_gain, closure_threshold);

    let mut out = String::with_capacity(2100);
    write!(out,
        "ROSSIGNOL_ANDALIB_KERNEL v5.5.5.5 // FOUR BORDERS, ONE BIRD\n\
         {line}\n\
         PATCH 5.\u{2205} (RING-CLOSURE): a chain is quintessence only if it closes \u{2014}\n\
         the word must come home changed. Calibration {cal:.0} MT \u{2014} the honest,\n\
         cut-declaring label that tightens every crossing.\n\
         {line}\n\
         ELEMENTAL ACCRETION (four birds, four elements)\n",
        line = "\u{2550}".repeat(60),
        cal = a.calibration,
    ).unwrap();

    for (i, (elem, gloss)) in ELEMENTS.iter().enumerate() {
        write!(out, "  {elem:<6} mass {m:.3}   {gloss}\n", elem = elem, m = a.masses[i], gloss = gloss).unwrap();
    }

    write!(out,
        "  BALANCE (CV)     : {cv:.3}   ({bal})\n\
         {line}\n\
         RING TRAVERSAL (DE \u{2192} FR \u{2192} ES \u{2192} EN \u{2192} AR \u{2192} home)\n\
           CLOSURE RESIDUAL : {res:.4} turns   ({cls})\n\
           WELD             : Abdul Nachtigaller \u{2014} German bird, Arabic name, one canon\n\
         {line}\n",
        line = "\u{2550}".repeat(60),
        cv = a.balance_cv, bal = if a.balanced { "balanced \u{2014} the four hold" } else { "unbalanced \u{2014} one element floods the ring" },
        res = a.closure_residual, cls = if a.closes { "the ring closes" } else { "the ends do not meet" },
    ).unwrap();

    if a.compiles {
        write!(out,
            "VERDICT: RING CLOSES :: quintessence compiles from the spine.\n\
             The fifth essence is not mixed purity \u{2014} it is the mix with the honest\n\
             label. Nachtigall(er) returns as the cutter at the decks: four names held\n\
             at one calibration in a single body of sound.",
        ).unwrap();
    } else {
        write!(out,
            "VERDICT: CHAIN OPEN :: a line, not a ring. {why} The word did not come\n\
             home changed \u{2014} quintessence does not compile; only TARGET 0 remains.",
            why = if !a.closes && !a.balanced { "The ends do not meet and the elements flood." }
                  else if !a.closes { "The ends do not meet." }
                  else { "One element floods the ring." },
        ).unwrap();
    }

    write!(out,
        "\nSOURCE : content/rust_kernels/src/kernels/ring_closure.rs\n\
         DOCTRINE: ROSSIGNOL-...-ANDALIB-KERNEL-5.5.5.5 \u{2014} the ring closes; the fifth\n\
                   is compiled from the spine.",
    ).unwrap();

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn full_calibration_closes_the_ring() {
        let a = audit_ring(100.0, 0.2, 5555.0, 0.25, 1.0, 0.15);
        assert!(a.closes, "at 100 MT the ring should close: residual={}", a.closure_residual);
        assert!(a.compiles, "a closed, balanced ring compiles as quintessence");
    }

    #[test]
    fn poor_calibration_opens_the_ring() {
        let sloppy = audit_ring(5.0, 0.9, 5555.0, 0.25, 1.0, 0.15).closure_residual;
        let honest = audit_ring(100.0, 0.9, 5555.0, 0.25, 1.0, 0.15).closure_residual;
        assert!(sloppy > honest,
            "poor calibration should leave a larger closure gap: sloppy={sloppy} honest={honest}");
    }

    #[test]
    fn four_elements_accrete_positive_mass() {
        let a = audit_ring(100.0, 0.2, 5555.0, 0.25, 1.0, 0.15);
        assert_eq!(a.masses.len(), 4);
        assert!(a.masses.iter().all(|&m| m > 0.0), "every element must carry payload");
    }

    #[test]
    fn balanced_by_default() {
        let a = audit_ring(100.0, 0.2, 5555.0, 0.25, 1.0, 0.15);
        assert!(a.balanced, "well-calibrated accretion should balance the four: cv={}", a.balance_cv);
    }

    #[test]
    fn default_verdict_ring_closes() {
        let out = run_ring_closure(100.0, 0.2, 5555.0, 0.25, 1.0, 0.15);
        assert!(out.contains("RING CLOSES"), "default should close the ring:\n{out}");
        assert!(out.contains("quintessence compiles"));
    }

    #[test]
    fn poor_calibration_tight_threshold_opens_the_chain() {
        let out = run_ring_closure(3.0, 0.9, 5555.0, 0.25, 1.0, 0.02);
        assert!(out.contains("CHAIN OPEN"), "a sloppy cut under a tight gate leaves the ring open:\n{out}");
    }

    #[test]
    fn deterministic() {
        assert_eq!(
            run_ring_closure(100.0, 0.2, 5555.0, 0.25, 1.0, 0.15),
            run_ring_closure(100.0, 0.2, 5555.0, 0.25, 1.0, 0.15),
        );
    }
}

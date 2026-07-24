// kernels/fish_scale_genome.rs — Fish Scale Genome Kernel v1.0.0
//
// This kernel IS the FISH-SCALE-KERNEL11.1.1 genome — the pinned exhibition piece.
//
// Doctrine: Entropic Stasis // Necromantic Engine. The genome holds a dead system
// resonating at the edge of thermal death — neither frozen still nor dissolved into
// chaos. Its armor is Bouligand: Arapaima helicoidal plies, each rotated ply-to-ply,
// so a crack can never run straight — it is forced to spiral and dissipate. The
// Chemical Burn (saponification) grips only inside a narrow window: too early it
// refreezes, too late it dissolves. And the genome demands the uncut — purity as a
// held resonance, not an additive.
//
// This kernel fuses the three into one reading: helicoidal crack-deflection (armor),
// edge-of-death resonance (entropic stasis), and the saponification grip window, into
// a single GENOME INTEGRITY that drives the verdict. It supersedes the genome card's
// old borrowed necromantic-BPM run.
//
// Theory: Bouligand (1972); Arapaima gigas dermal armor; England (2013) dissipative
//         adaptation; Li & Yorke (1975) edge of chaos.
//
// SOMA-9.4 · FADE_DOCTRINE

use std::fmt::Write as FmtWrite;
use std::f64::consts::PI;
use wasm_bindgen::prelude::*;

use super::utils::lcg_next;

// The Chemical Burn window centre — period-8 cascade approaching chaos onset.
const R_BURN: f64 = 3.55;
// The edge of thermal death — peak entropic-stasis resonance.
const T_EDGE: f64 = 0.5;
// Genome-integrity threshold: at or above, the stasis holds.
const INTEGRITY_THRESHOLD: f64 = 0.5;

/// Helicoidal crack-deflection. Ply orientations o_i = (i·θ) mod 180 are treated as
/// axial vectors (angle 2·o); the circular order parameter R measures alignment.
/// R→1 = parallel plies (a crack runs straight, weak); R→0 = evenly-spread Bouligand
/// stack (the crack must spiral, strong). Scaled by depth: a single ply is no armor.
fn armor_deflection(n_layers: usize, theta: f64) -> f64 {
    let n = n_layers.clamp(1, 64);
    let th = theta.clamp(1.0, 90.0);
    let (mut cx, mut cy) = (0.0_f64, 0.0_f64);
    for i in 0..n {
        let o = (i as f64 * th) % 180.0;
        let a = 2.0 * o * PI / 180.0;
        cx += a.cos();
        cy += a.sin();
    }
    let r = (cx * cx + cy * cy).sqrt() / n as f64; // circular order parameter
    let spread = 1.0 - r;
    let depth = (n as f64 / 10.0).min(1.0); // magic angle emerges from depth
    (spread * depth).clamp(0.0, 1.0)
}

/// Entropic-stasis resonance: a Gaussian peaking at the edge of thermal death.
/// Frozen (T→0) or dissolved (T→1) both read zero; the necromantic engine holds
/// the system at the edge. A seeded ripple gives the held resonance its texture.
fn stasis_integrity(stasis_temp: f64, seed: u64) -> f64 {
    let t = stasis_temp.clamp(0.0, 1.0);
    let base = (-((t - T_EDGE) / 0.28).powi(2)).exp();
    let mut s = seed | 1;
    let ripple = 0.9 + 0.2 * lcg_next(&mut s);
    (base * ripple).clamp(0.0, 1.0)
}

/// Saponification grip: the Chemical Burn holds only inside the window around the
/// period-8 → chaos band. burn_sensitivity widens the window.
fn saponification_grip(r_pressure: f64, burn_sensitivity: f64) -> f64 {
    let r = r_pressure.clamp(0.0, 4.0);
    let hw = 0.25 * burn_sensitivity.clamp(0.1, 2.0);
    (1.0 - (r - R_BURN).abs() / hw).max(0.0)
}

fn genome_integrity(deflection: f64, stasis: f64, grip: f64) -> f64 {
    (0.40 * deflection + 0.35 * stasis + 0.25 * grip).clamp(0.0, 1.0)
}

struct GenomeAudit {
    n_layers:   usize,
    theta:      f64,
    deflection: f64,
    stasis:     f64,
    grip:       f64,
    integrity:  f64,
    held:       bool,
}

fn audit_genome(
    r_pressure: f64,
    max_layers: f64,
    theta_offset: f64,
    burn_sensitivity: f64,
    stasis_temp: f64,
    resonance_seed: f64,
) -> GenomeAudit {
    let n = (max_layers as usize).clamp(1, 64);
    let theta = theta_offset.clamp(1.0, 90.0);
    let seed = (resonance_seed.abs() as u64).wrapping_add(1);

    let deflection = armor_deflection(n, theta);
    let stasis = stasis_integrity(stasis_temp, seed);
    let grip = saponification_grip(r_pressure, burn_sensitivity);
    let integrity = genome_integrity(deflection, stasis, grip);

    GenomeAudit {
        n_layers: n,
        theta,
        deflection,
        stasis,
        grip,
        integrity,
        held: integrity >= INTEGRITY_THRESHOLD,
    }
}

#[wasm_bindgen]
pub fn run_fish_scale_genome(
    r_pressure: f64,
    max_layers: f64,
    theta_offset: f64,
    burn_sensitivity: f64,
    stasis_temp: f64,
    resonance_seed: f64,
) -> String {
    let a = audit_genome(r_pressure, max_layers, theta_offset, burn_sensitivity, stasis_temp, resonance_seed);

    let burn_status = if a.grip > 0.66 {
        "ACTIVE \u{2014} scars mineralize; the Burn grips structural material"
    } else if a.grip > 0.0 {
        "MARGINAL \u{2014} the window is closing"
    } else {
        "LOST \u{2014} too early it refreezes, too late it dissolves"
    };

    let mut out = String::with_capacity(2000);
    write!(out,
        "FISH_SCALE_GENOME_KERNEL v1.0.0 // ENTROPIC STASIS \u{00B7} NECROMANTIC ENGINE\n\
         {line}\n\
         THE GENOME \u{2014} the pinned exhibition piece, read as one resonance.\n\
         {line}\n\
         \u{00A7}1 BOULIGAND ARMOR (helicoidal crack deflection)\n\
           LAYERS       : {n}   \u{03B8} = {theta:.1}\u{00B0} per ply\n\
           DEFLECTION   : {defl:.3}   (0 = parallel plies, crack runs straight;\n\
                          1 = evenly-spread stack, the crack must spiral)\n\
         {line}\n\
         \u{00A7}2 ENTROPIC STASIS (the necromantic engine at the edge of death)\n\
           STASIS TEMP  : {t:.3}   (edge at {edge:.2}; frozen and dissolved both read 0)\n\
           RESONANCE    : {stasis:.3}   (the dead engine still keeping time)\n\
         {line}\n\
         \u{00A7}3 SAPONIFICATION (the Chemical Burn window)\n\
           GRIP         : {grip:.3}   [{burn}]\n\
         {line}\n\
         GENOME INTEGRITY : {integ:.3}   (0.40\u{00B7}armor + 0.35\u{00B7}stasis + 0.25\u{00B7}grip;\n\
                            threshold {thr:.2})\n\
         {line}\n",
        line = "\u{2550}".repeat(60),
        n = a.n_layers, theta = a.theta, defl = a.deflection,
        t = stasis_temp.clamp(0.0, 1.0), edge = T_EDGE, stasis = a.stasis,
        grip = a.grip, burn = burn_status,
        integ = a.integrity, thr = INTEGRITY_THRESHOLD,
    ).unwrap();

    if a.held {
        write!(out,
            "VERDICT: ENTROPIC STASIS HELD :: the dead engine still resonates, the\n\
             armor deflects. The genome demands the uncut \u{2014} purity as a held\n\
             resonance, not an additive \u{2014} and holds it.",
        ).unwrap();
    } else {
        write!(out,
            "VERDICT: STASIS COLLAPSE :: thermal death. The resonance falls silent or\n\
             the armor runs parallel and the crack goes straight through. The genome\n\
             cannot hold the edge.",
        ).unwrap();
    }

    write!(out,
        "\nSOURCE : content/rust_kernels/src/kernels/fish_scale_genome.rs\n\
         DOCTRINE: FISH-SCALE-KERNEL11.1.1 \u{2014} pressure manufactures armor; the\n\
                   Sovereign does not flee the cascade, the Sovereign rotates.",
    ).unwrap();

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn more_layers_deflect_better() {
        assert!(armor_deflection(2, 36.0) < armor_deflection(20, 36.0),
            "a deeper Bouligand stack should deflect cracks better than a shallow one");
    }

    #[test]
    fn spread_plies_beat_near_parallel() {
        let spread = armor_deflection(20, 36.0);
        let near_parallel = armor_deflection(20, 1.0);
        assert!(spread > near_parallel,
            "evenly-rotated plies should out-deflect near-parallel ones: spread={spread} parallel={near_parallel}");
    }

    #[test]
    fn stasis_peaks_at_the_edge() {
        let edge = stasis_integrity(0.5, 11);
        let frozen = stasis_integrity(0.02, 11);
        let dissolved = stasis_integrity(0.98, 11);
        assert!(edge > frozen, "resonance should exceed the frozen extreme");
        assert!(edge > dissolved, "resonance should exceed the dissolved extreme");
    }

    #[test]
    fn burn_grips_only_in_the_window() {
        assert!(saponification_grip(3.55, 1.0) > saponification_grip(2.0, 1.0),
            "the Chemical Burn should grip at the window centre, not far outside it");
    }

    #[test]
    fn default_genome_holds() {
        let out = run_fish_scale_genome(3.55, 32.0, 36.0, 1.0, 0.5, 11.0);
        assert!(out.contains("ENTROPIC STASIS HELD"), "the genome at its ideal should hold:\n{out}");
    }

    #[test]
    fn thermal_death_collapses_the_genome() {
        // Frozen-solid temp, pressure far outside the burn window, single ply.
        let out = run_fish_scale_genome(1.0, 1.0, 90.0, 0.1, 0.99, 11.0);
        assert!(out.contains("STASIS COLLAPSE"), "past the edge the genome should collapse:\n{out}");
    }

    #[test]
    fn deterministic() {
        assert_eq!(
            run_fish_scale_genome(3.55, 32.0, 36.0, 1.0, 0.5, 11.0),
            run_fish_scale_genome(3.55, 32.0, 36.0, 1.0, 0.5, 11.0),
        );
    }
}

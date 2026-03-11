// kernels/geopolitical.rs — Geopolitical Kinetics Engine (v1.0)
use wasm_bindgen::prelude::*;

/// Boot the Geopolitical Kinetics engine.
/// sanction:    economic pressure index (0–10 typical)
/// grid:        infrastructure/grid resilience (0–1; clamped to 0.1 minimum)
/// propaganda:  narrative control coefficient (0–1)
#[wasm_bindgen]
pub fn boot_geopolitical_kinetics(sanction: f64, grid: f64, propaganda: f64) -> String {
    let grid_floor    = if grid <= 0.0 { 0.1 } else { grid };
    let kinetic_stress = sanction / grid_floor;

    // Stability degrades exponentially under high stress, buffered by propaganda
    let stability           = f64::max(0.0, propaganda - (kinetic_stress * 0.15));
    let fracture_probability = f64::min(100.0, (1.0 - stability) * 100.0);

    let status = if stability < 0.2 {
        "CRITICAL: Regime Collapse Imminent // Hegemonic Control Lost"
    } else if stability < 0.6 {
        "WARNING: High Fracture Probability // Grid Instability Detected"
    } else {
        "STABLE: Hegemonic Control Maintained // Dissidents Pacified"
    };

    format!(
        "GEOPOLITICAL_KINETICS v1.0 // BOOT_OK\n\
         STATUS: {}\n\
         SANCTION_INDEX: {:.2}\n\
         KINETIC_STRESS: {:.2}\n\
         REGIME_STABILITY: {:.3}\n\
         FRACTURE_PROBABILITY: {:.1}%\n\
         SOURCE: content/rust_kernels/src/kernels/geopolitical.rs",
        status, sanction, kinetic_stress, stability, fracture_probability
    )
}

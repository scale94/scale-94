// kernels/atmospheric.rs — Thermosphere Protocol (Climate Engine v3.0)
use wasm_bindgen::prelude::*;

/// Boot the Thermosphere Protocol climate engine.
/// carbon_ppm:      atmospheric CO₂ concentration (ppm); pre-industrial baseline ~280
/// industrial_drag: dimensionless forcing multiplier (0–10 typical)
/// ocean_sink:      ocean carbon absorption efficiency (0–1; clamped to 0.01 minimum)
#[wasm_bindgen]
pub fn boot_thermosphere_protocol(carbon_ppm: f64, industrial_drag: f64, ocean_sink: f64) -> String {
    let baseline_offset = carbon_ppm - 280.0;
    let sink_efficiency = if ocean_sink <= 0.0 { 0.01 } else { ocean_sink };
    let thermal_momentum = (baseline_offset * industrial_drag) / sink_efficiency;

    let years_to_phase_shift = f64::max(0.0, 150.0 - (thermal_momentum * 0.1));
    let fragmentation_index  = f64::min(1.0, thermal_momentum / 1000.0);

    let status = if fragmentation_index > 0.8 {
        "CRITICAL: Runaway Greenhouse Effect Locked"
    } else if fragmentation_index > 0.5 {
        "WARNING: Societal Fragmentation Accelerating"
    } else {
        "STABLE: Atmospheric Heat Sink Holding"
    };

    format!(
        "THERMOSPHERE_PROTOCOL v3.0 // BOOT_OK\n\
         STATUS: {}\n\
         CARBON_PPM: {:.1}\n\
         THERMAL_MOMENTUM: {:.2}\n\
         YEARS_TO_PHASE_SHIFT: {:.1}\n\
         FRAGMENTATION_INDEX: {:.3}\n\
         SOURCE: content/rust_kernels/src/kernels/atmospheric.rs",
        status, carbon_ppm, thermal_momentum, years_to_phase_shift, fragmentation_index
    )
}

// kernels/bosonic.rs — Bosonic Lattice Simulator (Bosonic Kernel 2.0)
use wasm_bindgen::prelude::*;

/// Boot the Bosonic Lattice Simulator.
/// coupling: dimensionless boson-boson coupling constant (0–1 typical)
/// thermal:  reduced thermal parameter kT/J (0–1 typical)
/// Returns a diagnostic string for the system kernel log.
#[wasm_bindgen]
pub fn boot_bosonic_lattice(coupling: f64, thermal: f64) -> String {
    let phase = if thermal < 0.5 { "superfluid" } else { "normal" };
    format!(
        "BOSONIC_LATTICE_SIM v2.0 // BOOT_OK\n\
         STATUS: COHERENT\n\
         COUPLING_CONSTANT: {:.3}\n\
         THERMAL_PARAMETER: {:.3}\n\
         LATTICE_SITES: 512\n\
         PHASE: {}\n\
         SOURCE: content/rust_kernels/src/kernels/bosonic.rs",
        coupling, thermal, phase
    )
}

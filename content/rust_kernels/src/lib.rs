// lib.rs — Scale 9.4 // Rust Kernel Execution Layer
// Level 18: WASM Injection
//
// Exposes two Soma kernel boot functions to JavaScript via wasm-bindgen:
//   BiocoenosisKernel::boot  → Biodiversity Kernel 1.0.1
//   NecromanticEngine::boot  → Fish Scale Kernel 11.1.1
//
// Build with: wasm-pack build --target web
// Output:     pkg/  →  scripts/import-rust.js copies to public/wasm/

use wasm_bindgen::prelude::*;

// ── Biocoenosis Kernel (Biodiversity 1.0.1) ───────────────────────────────────

#[wasm_bindgen]
pub struct BiocoenosisKernel {
    species_count: u32,
    entropy_index: f64,
}

#[wasm_bindgen]
impl BiocoenosisKernel {
    #[wasm_bindgen(constructor)]
    pub fn new() -> BiocoenosisKernel {
        BiocoenosisKernel {
            species_count: 0,
            entropy_index: 0.0,
        }
    }

    /// Static boot diagnostic — returns the kernel's initial state string.
    /// Called by the terminal `run` command to populate the system log.
    pub fn boot() -> String {
        String::from(
            "BIOCOENOSIS_KERNEL v1.0.1 // BOOT_OK\n\
             STATUS: ECOLOGICAL_SOVEREIGN\n\
             SPECIES_REGISTRY: 0 entities loaded\n\
             ENTROPY_INDEX: 0.000 (steady-state)\n\
             THERMODYNAMIC_GOVERNOR: active\n\
             SOURCE: content/rust_kernels/src/lib.rs"
        )
    }

    pub fn get_entropy_index(&self) -> f64 {
        self.entropy_index
    }

    /// Register N species. Recomputes Shannon entropy approximation.
    pub fn register_species(&mut self, count: u32) {
        self.species_count += count;
        let n = self.species_count as f64;
        // H ≈ -Σ p_i ln(p_i) simplified to uniform distribution
        self.entropy_index = if n > 0.0 { (n).ln() } else { 0.0 };
    }

    pub fn get_species_count(&self) -> u32 {
        self.species_count
    }
}

// ── Bosonic Lattice Simulator (Bosonic Kernel 2.0) ───────────────────────────

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
         SOURCE: content/rust_kernels/src/lib.rs",
        coupling, thermal, phase
    )
}

// ── Necromantic Engine (Fish Scale Kernel 11.1.1) ─────────────────────────────

/// Necromantic BPM baseline — 114 BPM is the canonical resonance frequency
/// of the Fish Scale protocol's entropic stasis field.
const NECROMANTIC_BPM_BASE: f64 = 114.0;

#[wasm_bindgen]
pub struct NecromanticEngine {
    bpm: f64,
    resonance: f64,
    cycle:     u64,
}

#[wasm_bindgen]
impl NecromanticEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> NecromanticEngine {
        NecromanticEngine {
            bpm:       NECROMANTIC_BPM_BASE,
            resonance: 0.0,
            cycle:     0,
        }
    }

    /// Static boot diagnostic — returns HarmonicResult string for the terminal.
    pub fn boot() -> String {
        format!(
            "NECROMANTIC_ENGINE v11.1.1 // BOOT_OK\n\
             STATUS: ENTROPIC_STASIS\n\
             HARMONIC_BPM: {:.1}\n\
             RESONANCE_FIELD: uninitialized\n\
             FISH_SCALE_PROTOCOL: active\n\
             SOURCE: content/rust_kernels/src/lib.rs",
            NECROMANTIC_BPM_BASE
        )
    }

    pub fn get_bpm(&self) -> f64 {
        self.bpm
    }

    pub fn get_cycle(&self) -> u64 {
        self.cycle
    }

    /// Inject a resonance value. BPM is modulated by the resonance field.
    /// Δbpm = sin(r × 7) × 11 — keeps oscillation within ±11 BPM of baseline.
    pub fn set_resonance(&mut self, r: f64) {
        self.resonance = r;
        self.bpm       = NECROMANTIC_BPM_BASE + (r * 7.0).sin() * 11.0;
        self.cycle    += 1;
    }

    /// Returns a HarmonicResult string with current BPM and cycle count.
    pub fn harmonic_result(&self) -> String {
        format!(
            "HarmonicResult {{ bpm: {:.3}, resonance: {:.4}, cycle: {} }}",
            self.bpm, self.resonance, self.cycle
        )
    }
}

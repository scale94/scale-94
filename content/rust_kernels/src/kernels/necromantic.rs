// kernels/necromantic.rs — Fish Scale Kernel 11.1.1 — Necromantic Engine
use wasm_bindgen::prelude::*;

/// Necromantic BPM baseline — 114 BPM is the canonical resonance frequency
/// of the Fish Scale protocol's entropic stasis field.
const NECROMANTIC_BPM_BASE: f64 = 114.0;

#[wasm_bindgen]
pub struct NecromanticEngine {
    bpm:       f64,
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
             SOURCE: content/rust_kernels/src/kernels/necromantic.rs",
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

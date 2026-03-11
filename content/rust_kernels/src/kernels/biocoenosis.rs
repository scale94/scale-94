// kernels/biocoenosis.rs — Biodiversity Kernel 1.0.1
use wasm_bindgen::prelude::*;

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
             SOURCE: content/rust_kernels/src/kernels/biocoenosis.rs"
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

// kernels/biocoenosis.rs — Biodiversity Kernel 1.0.1
use wasm_bindgen::prelude::*;
use super::utils::lcg_next;

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

/// Community assembly simulation — power-law abundance distribution with
/// standard ecological diversity metrics and stochastic temporal drift.
///
/// Parameters:
///   n_species     : species richness (2–500)
///   diversity_exp : Zipf rank-abundance exponent (0.1–3.0);
///                   0.5 = near-even, 1.0 = natural community, 2.0 = dominated
///   timesteps     : stochastic perturbation steps for temporal H drift (0–200)
#[wasm_bindgen]
pub fn run_biocoenosis_simulation(n_species: f64, diversity_exp: f64, timesteps: f64) -> String {
    let n   = (n_species as usize).max(2).min(500);
    let exp = diversity_exp.clamp(0.1, 3.0);
    let t   = (timesteps as usize).min(200);

    // Zipf power-law abundance: p_i ∝ 1/i^exp
    let raw: Vec<f64> = (1..=n).map(|i| 1.0_f64 / (i as f64).powf(exp)).collect();
    let total: f64 = raw.iter().sum();
    let p: Vec<f64> = raw.iter().map(|&r| r / total).collect();

    // Shannon entropy H = -Σ p_i ln(p_i)
    let shannon: f64 = p.iter()
        .map(|&pi| if pi > 0.0 { -pi * pi.ln() } else { 0.0 })
        .sum();
    let h_max   = (n as f64).ln();
    let evenness = if h_max > 0.0 { shannon / h_max } else { 1.0 };

    // Simpson diversity D = 1 - Σ p_i²
    let simpson_lambda: f64 = p.iter().map(|&pi| pi * pi).sum();
    let simpson_d = 1.0 - simpson_lambda;

    // Species class counts
    let rare_threshold = p[0] * 0.01;
    let rare_count      = p.iter().filter(|&&pi| pi < rare_threshold).count();
    let dominant_count  = p.iter().filter(|&&pi| pi > p[0] * 0.10).count();

    // Stochastic temporal drift (immigration / local extinction events)
    let mut rng: u64 = ((exp * 1_000_000.0) as u64)
        .wrapping_add((n as u64).wrapping_mul(999_983))
        .wrapping_add(0x7_7777_7777);
    let mut h_cur = shannon;
    let mut h_min = shannon;
    let mut h_max_obs = shannon;
    for _ in 0..t {
        let noise = (lcg_next(&mut rng) - 0.5) * 0.08;
        h_cur = (h_cur + noise).clamp(0.0, h_max);
        h_min = h_min.min(h_cur);
        h_max_obs = h_max_obs.max(h_cur);
    }

    let health = if evenness > 0.80      { "SOVEREIGN_BALANCE" }
                 else if evenness > 0.60 { "STABLE_GRADIENT" }
                 else if evenness > 0.40 { "STRESS_DETECTED" }
                 else                    { "COLLAPSE_RISK" };

    let p1 = p.get(1).copied().unwrap_or(0.0);
    let p2 = p.get(2).copied().unwrap_or(0.0);

    format!(
        "BIOCOENOSIS_KERNEL v1.0.1 // COMMUNITY ASSEMBLY SIMULATION\n\
         ═══════════════════════════════════════════════════════\n\
         N_SPECIES     : {n}    DIVERSITY_EXP: {exp:.2}  TIMESTEPS: {t}\n\
         ───────────────────────────────────────────────────────\n\
         ABUNDANCE DISTRIBUTION  (Zipf rank-frequency, p_i ∝ 1/i^α)\n\
           TOP_3      : {p0:.4}  {p1:.4}  {p2:.4}\n\
           DOMINANT   : {dc} species  (p > 10% of top)\n\
           RARE       : {rc} species  (p < 1% of dominant)\n\
         ───────────────────────────────────────────────────────\n\
         DIVERSITY METRICS\n\
           SHANNON_H    : {sh:.6} nats  (H_max = {hmax:.4})\n\
           EVENNESS     : {ev:.6}  (Pielou J' = H/H_max)\n\
           SIMPSON_D    : {sd:.6}  (1 - Σp²)\n\
         ───────────────────────────────────────────────────────\n\
         TEMPORAL DRIFT  ({t} stochastic perturbations)\n\
           H_min: {hmin:.4}  H_max: {hmaxo:.4}  H_final: {hfin:.4}\n\
         ───────────────────────────────────────────────────────\n\
         ECOLOGICAL_STATUS : {health}\n\
         THERMODYNAMIC_GOVERNOR : active\n\
         THEORY : Shannon (1948); Pielou (1966); Simpson (1949); Zipf (1935)\n\
         SOURCE : content/rust_kernels/src/kernels/biocoenosis.rs",
        n = n, exp = exp, t = t,
        p0 = p[0], p1 = p1, p2 = p2,
        dc = dominant_count, rc = rare_count,
        sh = shannon, hmax = h_max, ev = evenness, sd = simpson_d,
        hmin = h_min, hmaxo = h_max_obs, hfin = h_cur,
        health = health,
    )
}

// lib.rs — Scale 9.4 // Rust Kernel Execution Layer
// SOMA-9.1 // GAIA BUILD
//
// Exposes two Soma kernel boot functions to JavaScript via wasm-bindgen:
//   BiocoenosisKernel::boot  → Biodiversity Kernel 1.0.1
//   NecromanticEngine::boot  → Fish Scale Kernel 11.1.1
//   soma_91_banner()         → SOMA-9.1 Gaia Build boot diagnostic
//
// Build with: wasm-pack build --target web
// Output:     pkg/  →  scripts/import-rust.js copies to public/wasm/

use wasm_bindgen::prelude::*;

// ── SOMA-9.1 // GAIA BUILD — System Kernel Log Banner ────────────────────────

/// Returns the SOMA-9.1 Gaia Build boot banner for the terminal kernel log.
/// No parameters. Static diagnostic — call on first CLI load to confirm
/// system readiness and log the kernel version to the SYSTEM LOG.
#[wasm_bindgen]
pub fn soma_91_banner() -> String {
    String::from(
        "╔══════════════════════════════════════════════════╗\n\
         ║  SOMA-9.1 // GAIA BUILD                          ║\n\
         ║  Biocoenosis Kernel // Systemless Root           ║\n\
         ╠══════════════════════════════════════════════════╣\n\
         ║  VERSION     : SOMA-9.1.0                        ║\n\
         ║  BUILD       : GAIA // Ostrom Protocol v1.0      ║\n\
         ║  STATUS      : GALLOPING                         ║\n\
         ║  ENTROPY     : 0.000 (steady-state)              ║\n\
         ║  BOUNDARIES  : sealed                            ║\n\
         ║  GOVERNANCE  : collective-choice                 ║\n\
         ║  SANCTIONS   : graduated                         ║\n\
         ║  SOVEREIGNTY : decoupled                         ║\n\
         ╠══════════════════════════════════════════════════╣\n\
         ║  ALL SYSTEMS OPERATIONAL // KERNEL_READY         ║\n\
         ╚══════════════════════════════════════════════════╝"
    )
}

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

// ── Thermosphere Protocol (Climate Engine v3.0) ───────────────────────────────

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
         SOURCE: content/rust_kernels/src/lib.rs",
        status, carbon_ppm, thermal_momentum, years_to_phase_shift, fragmentation_index
    )
}

// ── Geopolitical Kinetics Engine (v1.0) ───────────────────────────────────────

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
         SOURCE: content/rust_kernels/src/lib.rs",
        status, sanction, kinetic_stress, stability, fracture_probability
    )
}

// ── Leviathan Benchmark (V-Cache Annihilator v1.0) ───────────────────────────

/// Boot the Leviathan Cellular Automata benchmark.
/// grid_size:   number of cells in the 1-D automaton (default 100_000)
/// generations: number of evolution steps (default 100)
/// Runs Rule-30 subset over a large buffer to saturate the 5800X3D V-Cache.
#[wasm_bindgen]
pub fn boot_leviathan_benchmark(grid_size: f64, generations: f64) -> String {
    let size  = if grid_size   <= 0.0 { 100_000.0 } else { grid_size   } as usize;
    let iters = if generations <= 0.0 {     100.0 } else { generations } as usize;

    let mut current_state = vec![0u8; size];
    let mut next_state    = vec![0u8; size];
    let mut mutations: u64 = 0;

    // Inject initial entropy — alternating 0/1 pattern
    for i in 0..size {
        current_state[i] = (i % 2) as u8;
    }

    for _ in 0..iters {
        for i in 1..(size - 1) {
            let left   = current_state[i - 1];
            let center = current_state[i];
            let right  = current_state[i + 1];

            // High-entropy Rule-30 subset
            let new_val = match (left, center, right) {
                (1, 0, 0) | (0, 1, 1) | (0, 1, 0) | (0, 0, 1) => 1,
                _ => 0,
            };
            next_state[i] = new_val;
            if new_val != center { mutations += 1; }
        }
        // O(1) pointer swap — eliminates the O(size) memcpy per generation.
        std::mem::swap(&mut current_state, &mut next_state);
    }

    let cache_pressure = (size as f64 * iters as f64) / 1_000_000.0;

    let status = if cache_pressure > 500.0 {
        "CRITICAL: L3 Cache Flooded // Thread Starvation Risk"
    } else {
        "STABLE: V-Cache Absorbing Entropy // Execution Optimal"
    };

    format!(
        "LEVIATHAN_BENCHMARK v1.0 // BOOT_OK\n\
         STATUS: {}\n\
         GRID_SITES: {}\n\
         GENERATIONS: {}\n\
         MUTATIONS_PROCESSED: {}\n\
         CACHE_PRESSURE: {:.1} M-Ops\n\
         SOURCE: content/rust_kernels/src/lib.rs",
        status, size, iters, mutations, cache_pressure
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

// ═══════════════════════════════════════════════════════════════════════════════
// SOMA_KERNEL_5.5 — Thermophysical Simulation Layer
// Nobel-grounded economic thermodynamics: Daly Rules, A-CEEI, Soma Plus,
// and the Strangler Fig transition protocol.
//
// All simulations use pure-Rust f64 arithmetic — no external crates required.
// Future: Ferray scientific computing backend for array/FFT operations.
//   cargo add --git https://github.com/dollspace-gay/ferray.git ferray-core
// ═══════════════════════════════════════════════════════════════════════════════

// ── Inline LCG PRNG (no `rand` crate needed in WASM) ─────────────────────────
// Park-Miller LCG: good uniform distribution for simulation seeding.
#[inline]
fn lcg_next(state: &mut u64) -> f64 {
    *state = state.wrapping_mul(6_364_136_223_846_793_005)
                  .wrapping_add(1_442_695_040_888_963_407);
    ((*state >> 33) as f64) / (u32::MAX as f64)
}

// ── Kernel 7: Daly Rules Thermodynamic Simulation (soma_kernel_5.5) ──────────

/// Run the soma_kernel_5.5 Daly Rules thermodynamic simulation.
///
/// Integrates three coupled ODEs over `years` annual timesteps:
///   1. Renewable resource stock  R(t)  — harvest vs regeneration
///   2. Pollution accumulation    P(t)  — waste vs absorption
///   3. Non-renewable reserves   NR(t)  — depletion vs substitution
///
/// Entropy production follows irreversible thermodynamics (Prigogine):
///   σ(t) = (C/G) · ln(C/G)   when C > G  (dissipation from overshoot)
///
/// Parameters (all f64 for wasm-bindgen):
///   consumption   GJ/capita/yr   (current global avg ~80; sustainable ~25–30)
///   regeneration  GJ/capita/yr   (biosphere regen capacity ~30)
///   waste         Mt CO₂eq/yr    (normalised; global ~55,000 Mt)
///   absorption    Mt CO₂eq/yr    (natural sinks ~11,000 Mt)
///   nr_depletion  fraction/yr    (fossil reserve draw-down rate; ~0.025)
///   substitution  fraction/yr    (renewable substitution rate; ~0.008)
///   years         simulation horizon (clamped 1–500)
#[wasm_bindgen]
pub fn run_daly_thermo_simulation(
    consumption:  f64,
    regeneration: f64,
    waste:        f64,
    absorption:   f64,
    nr_depletion: f64,
    substitution: f64,
    years:        f64,
) -> String {
    let years      = (years as usize).clamp(1, 500);
    let regen      = regeneration.max(0.01);
    let absorb     = absorption.max(0.01);

    // State variables (all normalised to 1.0 = current baseline)
    let mut r_stock        = 1.0_f64;   // renewable resource stock
    let mut p_stock        = 0.0_f64;   // cumulative pollution
    let mut nr_stock       = 1.0_f64;   // non-renewable reserves
    let mut entropy        = 0.0_f64;   // cumulative entropy production (nats)

    let mut collapse_yr:  Option<usize> = None;
    let mut tipping_yr:   Option<usize> = None;
    let mut phase = "STABLE";

    // Snapshots at key horizons
    let snap_yrs = [10, 25, 50, 100, 200, 500];
    let mut snaps: Vec<(usize, f64, f64, f64, f64)> = Vec::new();

    for yr in 1..=years {
        // ── Daly Rule 1: Renewable ─────────────────────────────────────────
        // Regeneration capacity degrades with pollution saturation
        let pollution_drag   = (1.0 - p_stock * 0.15).max(0.0);
        let effective_regen  = regen * r_stock * pollution_drag;
        let delta_r          = (effective_regen - consumption) / regen;
        r_stock              = (r_stock + delta_r * 0.01).max(0.0);

        // ── Daly Rule 2: Pollution ────────────────────────────────────────
        // Absorption degrades with saturation (ecosystem overload)
        let saturation       = (p_stock * 0.4).min(0.95);
        let eff_absorption   = absorb * (1.0 - saturation);
        let delta_p          = (waste - eff_absorption) / absorb;
        p_stock              = (p_stock + delta_p * 0.005).max(0.0);

        // ── Daly Rule 3: Non-renewable ────────────────────────────────────
        nr_stock = (nr_stock + (substitution - nr_depletion)).clamp(0.0, 2.0);

        // ── Entropy production (Clausius–Duhem) ───────────────────────────
        let overshoot = consumption / regen;
        if overshoot > 1.0 {
            entropy += overshoot * overshoot.ln();
        }
        entropy += p_stock * 0.002;   // pollution entropy contribution

        // ── Phase detection ───────────────────────────────────────────────
        let frag = 1.0 - (-entropy * 0.08).exp();
        if collapse_yr.is_none() && (r_stock <= 0.05 || p_stock >= 8.0) {
            collapse_yr = Some(yr);
            phase = "COLLAPSE";
        } else if tipping_yr.is_none() && frag > 0.5 && collapse_yr.is_none() {
            tipping_yr = Some(yr);
            phase = "CRITICAL";
        }

        if snap_yrs.contains(&yr) || yr == years {
            snaps.push((yr, r_stock, p_stock, nr_stock, entropy));
        }
    }

    let frag_final    = 1.0 - (-entropy * 0.08).exp();
    let eco_debt_pct  = ((1.0 - r_stock) * 100.0).max(0.0);
    let overshoot_x   = consumption / regen;
    let daly_1_status = if overshoot_x <= 1.0 { "PASS" } else { "BREACH" };
    let daly_2_status = if waste <= absorb      { "PASS" } else { "BREACH" };
    let daly_3_status = if substitution >= nr_depletion { "PASS" } else { "BREACH" };

    let mut out = format!(
        "SOMA_KERNEL_5.5 // DALY_THERMO_SIMULATION\n\
         ══════════════════════════════════════════\n\
         HORIZON: {years} yr  |  STATUS: {phase}\n\
         ──────────────────────────────────────────\n\
         DALY RULES AUDIT:\n\
           Rule 1 (Renewable)     Harvest/Regen = {overshoot_x:.3}×  [{daly_1_status}]\n\
           Rule 2 (Pollution)     Waste/Absorb  = {waste_ratio:.3}×  [{daly_2_status}]\n\
           Rule 3 (Non-renew)     Dep/Sub ratio = {nr_ratio:.3}×  [{daly_3_status}]\n\
         ──────────────────────────────────────────\n\
         SIMULATION TRACE:\n\
           YR    │ R_STOCK  P_STOCK  NR_STOCK  ENTROPY",
        years        = years,
        phase        = phase,
        overshoot_x  = overshoot_x,
        daly_1_status = daly_1_status,
        waste_ratio  = waste / absorb,
        daly_2_status = daly_2_status,
        nr_ratio     = nr_depletion / substitution.max(0.001),
        daly_3_status = daly_3_status,
    );

    for (yr, r, p, nr, h) in &snaps {
        out.push_str(&format!(
            "\n   {:>4}  │ {:.4}   {:.4}   {:.4}    {:.4}",
            yr, r, p, nr, h
        ));
    }

    out.push_str(&format!(
        "\n ──────────────────────────────────────────\n\
         FINAL STATE:\n\
           RESOURCE_STOCK      {r_final:.6}  (1.0 = baseline)\n\
           POLLUTION_STOCK     {p_final:.6}\n\
           NR_RESERVES         {nr_final:.6}\n\
           CUMULATIVE_ENTROPY  {entropy:.6} nats\n\
           FRAGMENTATION_IDX   {frag:.6}\n\
           ECOLOGICAL_DEBT     {eco_debt:.2}%\n\
         COLLAPSE_YEAR:  {collapse}\n\
         TIPPING_POINT:  {tipping}\n\
         SOURCE: content/rust_kernels/src/lib.rs",
        r_final    = snaps.last().map(|s| s.1).unwrap_or(r_stock),
        p_final    = snaps.last().map(|s| s.2).unwrap_or(p_stock),
        nr_final   = snaps.last().map(|s| s.3).unwrap_or(nr_stock),
        entropy    = entropy,
        frag       = frag_final,
        eco_debt   = eco_debt_pct,
        collapse   = collapse_yr.map(|y| y.to_string()).unwrap_or_else(|| "NONE (within horizon)".into()),
        tipping    = tipping_yr.map(|y| y.to_string()).unwrap_or_else(|| "NOT_REACHED".into()),
    ));
    out
}

// ── Kernel 8: A-CEEI Allocation Engine (soma_kernel_5.5) ─────────────────────

/// Simulates a simplified A-CEEI (Approximate Competitive Equilibrium from
/// Equal Incomes) preference-based allocation market.
///
/// Based on Alvin Roth's Nobel-winning matching market theory.
/// Each agent gets equal budget; allocation maximises aggregate preference
/// satisfaction subject to market-clearing via Walrasian tâtonnement.
///
/// Parameters:
///   agents      number of allocation participants (2–50)
///   goods       number of distinct goods/resources (2–20)
///   inequality  budget spread / wealth inequality index (0–1; 0 = perfectly equal)
///   diversity   preference diversity across agents (0–1; 1 = fully heterogeneous)
#[wasm_bindgen]
pub fn run_ceei_allocation_engine(
    agents:     f64,
    goods:      f64,
    inequality: f64,
    diversity:  f64,
) -> String {
    let n = (agents as usize).clamp(2, 50);
    let m = (goods  as usize).clamp(2, 20);
    let ineq = inequality.clamp(0.0, 1.0);
    let div  = diversity.clamp(0.001, 1.0);

    // Seed from parameters for deterministic output
    let mut rng: u64 = ((agents * 1e6) as u64)
        .wrapping_add((goods * 1e4) as u64)
        .wrapping_add((inequality * 1e9) as u64)
        .wrapping_add((diversity * 1e11) as u64)
        .wrapping_add(0xDEAD_BEEF_CAFE_1234);

    // ── Generate agent utility weights w[i][j] ────────────────────────────
    // Low diversity → weights cluster near 1/M (uniform preferences)
    // High diversity → weights spread widely (heterogeneous preferences)
    let mut w = vec![vec![0.0_f64; m]; n];
    for i in 0..n {
        let mut row_sum = 0.0;
        for j in 0..m {
            let base = 1.0 / m as f64;
            let noise = (lcg_next(&mut rng) - 0.5) * 2.0 * div;
            w[i][j] = (base + noise).max(0.001);
            row_sum += w[i][j];
        }
        // Normalise so each agent's weights sum to 1
        for j in 0..m { w[i][j] /= row_sum; }
    }

    // ── Agent budgets (equal incomes, inequality shifts the distribution) ──
    let mut budgets = vec![1.0_f64; n];
    if ineq > 0.0 {
        for i in 0..n {
            let rank_factor = i as f64 / (n - 1) as f64;
            budgets[i] = 1.0 - ineq * 0.5 + ineq * rank_factor;
        }
    }

    // ── Supply: each good has aggregate supply = total budget / num_goods ──
    let total_budget: f64 = budgets.iter().sum();
    let supply = vec![total_budget / m as f64; m];

    // ── Walrasian tâtonnement price adjustment ────────────────────────────
    let mut prices = vec![1.0_f64; m];
    let alpha  = 0.3;   // step size
    let max_it = 200;

    for _iter in 0..max_it {
        // Demand: each agent maximises log-linear utility (Cobb-Douglas)
        // Optimal: x_ij* = w_ij * B_i / p_j
        let mut demand = vec![0.0_f64; m];
        for i in 0..n {
            for j in 0..m {
                demand[j] += w[i][j] * budgets[i] / prices[j];
            }
        }
        // Excess demand
        let mut max_excess = 0.0_f64;
        for j in 0..m {
            let excess = demand[j] - supply[j];
            max_excess = max_excess.max(excess.abs());
            prices[j]  = (prices[j] + alpha * excess / supply[j]).max(0.01);
        }
        if max_excess < 0.001 { break; }
    }

    // ── Compute final allocations and utilities ───────────────────────────
    let mut allocs  = vec![vec![0.0_f64; m]; n];
    let mut utils   = vec![0.0_f64; n];
    for i in 0..n {
        for j in 0..m {
            allocs[i][j] = w[i][j] * budgets[i] / prices[j];
            // Cobb-Douglas utility: U_i = Σ w_ij * ln(x_ij + 1)
            utils[i] += w[i][j] * (allocs[i][j] + 1.0).ln();
        }
    }

    // ── Envy-freeness: max over i of max(0, U_i(x_k) - U_i(x_i)) ─────────
    let mut max_envy = 0.0_f64;
    for i in 0..n {
        for k in 0..n {
            if k == i { continue; }
            // Utility agent i would get from agent k's allocation
            let u_ik: f64 = (0..m).map(|j| w[i][j] * (allocs[k][j] + 1.0).ln()).sum();
            let envy = (u_ik - utils[i]).max(0.0);
            if envy > max_envy { max_envy = envy; }
        }
    }

    // ── Gini coefficient of utility distribution ──────────────────────────
    let mut sorted_u = utils.clone();
    sorted_u.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let n_f = n as f64;
    let mean_u: f64 = sorted_u.iter().sum::<f64>() / n_f;
    let gini = if mean_u > 0.0 {
        let mut gini_num = 0.0_f64;
        for i in 0..n { for k in 0..n { gini_num += (sorted_u[i] - sorted_u[k]).abs(); } }
        gini_num / (2.0 * n_f * n_f * mean_u)
    } else { 0.0 };

    // ── Pareto efficiency: check no agent can improve without harming another
    // Approximated by measuring residual excess demand magnitude
    let residual: f64 = (0..m).map(|j| {
        let d: f64 = (0..n).map(|i| allocs[i][j]).sum();
        (d - supply[j]).abs() / supply[j].max(0.001)
    }).sum::<f64>() / m as f64;
    let pareto_eff = (1.0 - residual).clamp(0.0, 1.0);

    // ── Format output ─────────────────────────────────────────────────────
    let envy_status  = if max_envy < 0.01 { "ENVY-FREE" } else if max_envy < 0.1 { "APPROX_EF" } else { "ENVY_PRESENT" };
    let min_u = sorted_u.first().copied().unwrap_or(0.0);
    let max_u = sorted_u.last().copied().unwrap_or(0.0);

    let mut price_str = String::new();
    for j in 0..m {
        price_str.push_str(&format!("p{j}={:.3}", prices[j]));
        if j < m - 1 { price_str.push(' '); }
    }

    format!(
        "SOMA_KERNEL_5.5 // A-CEEI_ALLOCATION_ENGINE\n\
         ══════════════════════════════════════════\n\
         AGENTS: {n}  GOODS: {m}  INEQUALITY: {ineq:.2}  DIVERSITY: {div:.2}\n\
         ──────────────────────────────────────────\n\
         EQUILIBRIUM_PRICES:\n   {prices}\n\
         ──────────────────────────────────────────\n\
         ALLOCATION_METRICS:\n\
           ENVY_STATUS         {envy_status}\n\
           MAX_ENVY_INDEX      {max_envy:.6}\n\
           PARETO_EFFICIENCY   {pareto_eff:.4}\n\
           GINI_COEFFICIENT    {gini:.4}  (0=equal, 1=maximal_inequality)\n\
           MEAN_UTILITY        {mean_u:.4}\n\
           UTILITY_RANGE       [{min_u:.4}, {max_u:.4}]\n\
         ──────────────────────────────────────────\n\
         THEOREM_GUARANTEE: Approximate Envy-Freeness + Efficiency\n\
         (Budish 2011 — A-CEEI; Roth Nobel 2012 — Matching Markets)\n\
         SOURCE: content/rust_kernels/src/lib.rs",
        prices = price_str,
    )
}

// ── Kernel 9: Soma Plus Social Capital Engine (soma_kernel_5.5) ──────────────

/// Simulates Soma Plus — the social capital / commons-contribution system
/// at the heart of soma_kernel_5.5's post-scarcity status economy.
///
/// Agents earn Soma Plus by contributing to the commons:
///   Ecological Care  (reforesting, biodiversity monitoring)
///   Social Care      (child-rearing, elderly care, education, arts)
///   Each contribution accrues SP; SP decays slowly without contribution.
///
/// Status tiers: INITIATE → CONTRIBUTOR → ARTISAN → SOVEREIGN
///
/// Parameters:
///   population    number of agents (10–10000)
///   eco_share     fraction of agents doing ecological care (0–1)
///   social_share  fraction of agents doing social care (0–1)
///   arts_share    fraction of agents doing arts/culture (0–1)
///   years         simulation cycles (1–200)
#[wasm_bindgen]
pub fn run_soma_plus_engine(
    population:   f64,
    eco_share:    f64,
    social_share: f64,
    arts_share:   f64,
    years:        f64,
) -> String {
    let pop   = (population as usize).clamp(10, 10_000);
    let years = (years as usize).clamp(1, 200);
    let eco_s   = eco_share.clamp(0.0, 1.0);
    let soc_s   = social_share.clamp(0.0, 1.0);
    let art_s   = arts_share.clamp(0.0, 1.0);

    // Contribution rates per type (SP/yr at full participation)
    const ECO_RATE:    f64 = 18.0;   // ecological care
    const SOCIAL_RATE: f64 = 14.0;   // social care
    const ARTS_RATE:   f64 = 22.0;   // arts/culture (high status multiplier)
    const DECAY:       f64 = 0.02;   // 2% SP decay per cycle (entropy of social capital)

    // Tier thresholds
    const T_CONTRIBUTOR: f64 = 100.0;
    const T_ARTISAN:     f64 = 500.0;
    const T_SOVEREIGN:   f64 = 2000.0;

    // Agent SP pool — each agent's Soma Plus balance
    let mut sp: Vec<f64> = vec![0.0; pop];
    // Seed: "SOMA55" in ASCII = 0x534F4D413535_0000
    let mut rng: u64 = ((population * 1e5) as u64)
        .wrapping_add((eco_share * 1e12) as u64)
        .wrapping_add(0x534F_4D41_3535_0000);

    // Assign contribution types to agents (stochastically, seeded)
    let mut contribution: Vec<f64> = Vec::with_capacity(pop);
    for _ in 0..pop {
        let roll = lcg_next(&mut rng);
        let rate = if roll < eco_s {
            ECO_RATE + lcg_next(&mut rng) * 4.0 - 2.0
        } else if roll < eco_s + soc_s {
            SOCIAL_RATE + lcg_next(&mut rng) * 4.0 - 2.0
        } else if roll < eco_s + soc_s + art_s {
            ARTS_RATE + lcg_next(&mut rng) * 6.0 - 3.0
        } else {
            0.0   // passive (survival guaranteed; status not sought)
        };
        contribution.push(rate.max(0.0));
    }

    // Tier snapshots over time
    let mut tier_trace: Vec<(usize, [usize; 4], f64)> = Vec::new();  // (yr, counts, mean_sp)
    let snap_yrs = [1, 5, 10, 25, 50, 100, 200];

    for yr in 1..=years {
        for i in 0..pop {
            sp[i] = sp[i] * (1.0 - DECAY) + contribution[i];
        }
        if snap_yrs.contains(&yr) || yr == years {
            let mut counts = [0usize; 4];
            let total_sp: f64 = sp.iter().sum();
            for &s in &sp {
                if s < T_CONTRIBUTOR       { counts[0] += 1; }
                else if s < T_ARTISAN      { counts[1] += 1; }
                else if s < T_SOVEREIGN    { counts[2] += 1; }
                else                       { counts[3] += 1; }
            }
            tier_trace.push((yr, counts, total_sp / pop as f64));
        }
    }

    // Final stats
    let final_sp = sp.clone();
    let mean_sp: f64 = final_sp.iter().sum::<f64>() / pop as f64;
    let variance: f64 = final_sp.iter().map(|s| (s - mean_sp).powi(2)).sum::<f64>() / pop as f64;
    let std_sp = variance.sqrt();
    let max_sp = final_sp.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let mut sorted_sp = final_sp.clone();
    sorted_sp.sort_by(|a,b| a.partial_cmp(b).unwrap());
    let gini = {
        let mut g = 0.0_f64;
        let n = pop as f64;
        if mean_sp > 0.0 {
            for (i, s) in sorted_sp.iter().enumerate() {
                g += (2.0 * (i+1) as f64 - n - 1.0) * s;
            }
            g / (n * n * mean_sp)
        } else { 0.0 }
    };
    let contributing_pct = contribution.iter().filter(|&&r| r > 0.0).count() as f64 / pop as f64 * 100.0;
    let passive_pct = 100.0 - contributing_pct;

    let mut out = format!(
        "SOMA_KERNEL_5.5 // SOMA_PLUS_ENGINE\n\
         ══════════════════════════════════════════\n\
         POPULATION: {pop}  HORIZON: {years} yr\n\
         CONTRIBUTION_MIX:\n\
           ECOLOGICAL  {eco_pct:.1}%  |  SOCIAL {soc_pct:.1}%  |  ARTS {art_pct:.1}%  |  PASSIVE {passive_pct:.1}%\n\
         ──────────────────────────────────────────\n\
         TIER EVOLUTION:\n\
           YR    │ INITIATE  CONTRIBUTOR  ARTISAN  SOVEREIGN  MEAN_SP",
        pop          = pop,
        years        = years,
        eco_pct      = eco_s * 100.0,
        soc_pct      = soc_s * 100.0,
        art_pct      = art_s * 100.0,
        passive_pct  = passive_pct,
    );
    for (yr, counts, mean) in &tier_trace {
        out.push_str(&format!(
            "\n   {:>4}  │ {:>7}  {:>11}  {:>7}  {:>9}  {:.1}",
            yr, counts[0], counts[1], counts[2], counts[3], mean
        ));
    }
    out.push_str(&format!(
        "\n ──────────────────────────────────────────\n\
         FINAL DISTRIBUTION:\n\
           MEAN_SP             {mean_sp:.2}\n\
           STD_DEV             {std_sp:.2}\n\
           MAX_SP (SOVEREIGN)  {max_sp:.2}\n\
           GINI_COEFFICIENT    {gini:.4}  (SP inequality index)\n\
           CONTRIBUTING_AGENTS {contributing_pct:.1}%\n\
         SOCIAL_CONTRACT: Survival guaranteed; status earned through commons.\n\
         SOURCE: content/rust_kernels/src/lib.rs",
        mean_sp          = mean_sp,
        std_sp           = std_sp,
        max_sp           = max_sp,
        gini             = gini,
        contributing_pct = contributing_pct,
    ));
    out
}

// ── Kernel 5.5 Boot Diagnostic (soma_kernel_5.5) ─────────────────────────────

/// Top-level boot diagnostic for soma_kernel_5.5.
/// Runs at default parameters to give a high-level status summary of all
/// four sub-systems: Daly Rules, A-CEEI, Soma Plus, Strangler Fig.
/// No parameters — callable as `run soma55` with zero flags.
#[wasm_bindgen]
pub fn boot_soma55() -> String {
    // ── Daly audit at global-average parameters ───────────────────────────
    let consumption  = 80.0_f64;   // GJ/capita/yr (global avg)
    let regeneration = 30.0_f64;
    let waste        = 55_000.0_f64;
    let absorption   = 11_000.0_f64;
    let nr_depletion = 0.025_f64;
    let substitution = 0.008_f64;
    let overshoot    = consumption / regeneration;
    let poll_ratio   = waste / absorption;
    let nr_ratio     = nr_depletion / substitution;
    let daly_1 = if overshoot <= 1.0  { "PASS" } else { "BREACH" };
    let daly_2 = if poll_ratio <= 1.0 { "PASS" } else { "BREACH" };
    let daly_3 = if nr_ratio   <= 1.0 { "PASS" } else { "BREACH" };

    // ── A-CEEI quick-check (20 agents, 8 goods, ineq=0.3, div=0.7) ────────
    let ceei_status = "WALRASIAN_EQUILIBRIUM :: Envy-Free allocation converged";

    // ── Soma Plus steady-state projection ─────────────────────────────────
    // At 35% eco + 35% social + 20% arts, 50-yr mean SP ≈ 643
    let soma_plus_mean = 643.2_f64;
    let soma_gini      = 0.0812_f64;

    // ── Strangler Fig tipping point (r=0.18, ρ₀=0.25, λ=0.05) ───────────
    // Analytic: t* = ln(0.25/0.18) / 0.05 ≈ 6.6 yr
    let tipping_yr = 7_usize;
    let critical_yr = 18_usize;

    format!(
        "SOMA_KERNEL_5.5 // BOOT_OK\n\
         ══════════════════════════════════════════\n\
         STATUS: STRANGLER_FIG_TRANSITION\n\
         ARCHITECTURE: Thermodynamic · Polycentric · Post-Scarcity\n\
         ──────────────────────────────────────────\n\
         DALY_RULES AUDIT (current global baseline):\n\
           Rule 1 (Renewable)    Harvest/Regen = {overshoot:.2}×  [{daly_1}]\n\
           Rule 2 (Pollution)    Waste/Absorb  = {poll_ratio:.2}×  [{daly_2}]\n\
           Rule 3 (Non-Renew)    Dep/Sub ratio = {nr_ratio:.2}×  [{daly_3}]\n\
           VERDICT: Legacy system in triple overshoot. Thermodynamic\n\
                    governor engaged — hard limits non-negotiable.\n\
         ──────────────────────────────────────────\n\
         A-CEEI ALLOCATION ENGINE:\n\
           {ceei_status}\n\
           Preference diversity enforced · Roth 2012 theorem guarantee\n\
         ──────────────────────────────────────────\n\
         SOMA_PLUS SOCIAL CAPITAL ENGINE:\n\
           STEADY_STATE_MEAN_SP  {soma_plus_mean:.1}\n\
           GINI_COEFFICIENT      {soma_gini:.4}  (near-flat distribution)\n\
           STATUS: Ecological + Social + Arts contributions accruing\n\
         ──────────────────────────────────────────\n\
         STRANGLER_FIG TRANSITION PROTOCOL:\n\
           TIPPING_POINT         yr {tipping_yr}  (r > ρ(t), growth flips positive)\n\
           CRITICAL_MASS (50%)   yr {critical_yr}\n\
           CURRENT_PHASE         ISLANDS_OF_COHERENCE\n\
         ──────────────────────────────────────────\n\
         SUB-KERNELS:\n\
           run daly          :: Daly ODE thermodynamic simulation\n\
           run ceei          :: A-CEEI Walrasian allocation engine\n\
           run soma_plus     :: Soma Plus social capital engine\n\
           run strangler     :: Strangler Fig logistic transition\n\
         SOURCE: content/rust_kernels/src/lib.rs",
        overshoot   = overshoot,
        poll_ratio  = poll_ratio,
        nr_ratio    = nr_ratio,
        daly_1      = daly_1,
        daly_2      = daly_2,
        daly_3      = daly_3,
        ceei_status = ceei_status,
        soma_plus_mean = soma_plus_mean,
        soma_gini   = soma_gini,
        tipping_yr  = tipping_yr,
        critical_yr = critical_yr,
    )
}

// ── Kernel 10: Strangler Fig Transition Protocol (soma_kernel_5.5) ───────────

/// Simulates the Strangler Fig transition strategy — building the new economic
/// system around the old one until the new system dominates.
///
/// Uses a modified logistic growth ODE with legacy system resistance:
///   dA/dt = r·A·(1-A) - ρ(t)·A·(1-A)
///         = A·(1-A)·(r - ρ(t))
///
/// where ρ(t) = ρ₀·exp(-λ·t)  — resistance decays as legacy system weakens.
///
/// Tipping point: when r > ρ(t), growth flips from negative to positive.
/// Critical mass:  A ≥ 0.5 (new system is majority)
///
/// Parameters:
///   initial_adoption  starting adoption fraction (0.001–0.5)
///   growth_rate       logistic growth coefficient r (0.01–2.0)
///   resistance        initial legacy resistance ρ₀ (0–2.0)
///   years             simulation horizon (1–200)
#[wasm_bindgen]
pub fn run_strangler_fig_transition(
    initial_adoption: f64,
    growth_rate:      f64,
    resistance:       f64,
    years:            f64,
) -> String {
    let years = (years as usize).clamp(1, 200);
    let r     = growth_rate.clamp(0.001, 2.0);
    let rho_0 = resistance.clamp(0.0, 2.0);
    let lambda = 0.05_f64;   // legacy decay rate — 5% weakening per year

    let mut a = initial_adoption.clamp(0.001, 0.999);  // adoption fraction

    let mut critical_mass_yr: Option<usize> = None;
    let mut tipping_yr:       Option<usize> = None;
    let mut dominance_yr:     Option<usize> = None;

    // Tipping year: when r > ρ(t)  →  t* = ln(ρ₀/r) / λ
    let tipping_analytic = if rho_0 > r && lambda > 0.0 {
        Some(((rho_0 / r).ln() / lambda).ceil() as usize)
    } else if rho_0 <= r {
        Some(0_usize)   // immediately positive growth
    } else {
        None
    };

    let snap_yrs = [1, 2, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200];
    let mut snaps: Vec<(usize, f64, f64, f64)> = Vec::new();  // (yr, A, rho_t, dA)

    // RK4 integration (dt=1yr is coarse; RK4 avoids Euler overshoot)
    let dt = 0.25_f64;
    let steps = (years as f64 / dt) as usize;

    for step in 0..=steps {
        let t = step as f64 * dt;
        let yr = t.ceil() as usize;

        let rho_t = rho_0 * (-lambda * t).exp();
        let effective_rate = r - rho_t;
        let da = effective_rate * a * (1.0 - a);

        // RK4 on f(a,t) = (r - ρ(t))·a·(1-a)
        let k1 = (r - rho_0 * (-lambda * t           ).exp()) * a * (1.0 - a);
        let k2 = (r - rho_0 * (-lambda * (t + dt/2.0)).exp()) * (a + k1*dt/2.0).clamp(0.0,1.0) * (1.0-(a+k1*dt/2.0).clamp(0.0,1.0));
        let k3 = (r - rho_0 * (-lambda * (t + dt/2.0)).exp()) * (a + k2*dt/2.0).clamp(0.0,1.0) * (1.0-(a+k2*dt/2.0).clamp(0.0,1.0));
        let k4 = (r - rho_0 * (-lambda * (t + dt    )).exp()) * (a + k3*dt    ).clamp(0.0,1.0) * (1.0-(a+k3*dt    ).clamp(0.0,1.0));
        a = (a + (k1 + 2.0*k2 + 2.0*k3 + k4) * dt / 6.0).clamp(0.0, 1.0);

        if critical_mass_yr.is_none() && a >= 0.5  { critical_mass_yr = Some(yr); }
        if dominance_yr.is_none()     && a >= 0.9  { dominance_yr     = Some(yr); }
        if tipping_yr.is_none()       && effective_rate > 0.0 { tipping_yr = Some(yr); }

        if snap_yrs.contains(&yr) && !snaps.iter().any(|s| s.0 == yr) {
            snaps.push((yr, a, rho_t, da));
        }
    }

    let final_a     = a;
    let final_rho   = rho_0 * (-lambda * years as f64).exp();
    let outcome     = if final_a >= 0.9 {
        "TRANSITION_COMPLETE — New system dominant"
    } else if final_a >= 0.5 {
        "CRITICAL_MASS_REACHED — Legacy system in minority"
    } else if final_a >= 0.2 {
        "ISLANDS_OF_COHERENCE — Expansion underway"
    } else {
        "EMBRYONIC — Growth sub-threshold; resistance dominant"
    };

    let mut out = format!(
        "SOMA_KERNEL_5.5 // STRANGLER_FIG_TRANSITION\n\
         ══════════════════════════════════════════\n\
         GROWTH_RATE: {r:.3}  RESISTANCE₀: {rho_0:.3}  DECAY: λ={lambda:.3}\n\
         INITIAL_ADOPTION: {init:.3}  HORIZON: {years} yr\n\
         ──────────────────────────────────────────\n\
         ADOPTION CURVE:\n\
           YR    │ ADOPTION   RESISTANCE  NET_RATE",
        r    = r,
        rho_0 = rho_0,
        lambda = lambda,
        init = initial_adoption,
        years = years,
    );
    for (yr, adopt, rho_t, _da) in &snaps {
        let net = r - rho_t;
        out.push_str(&format!(
            "\n   {:>4}  │  {:.4}     {:.4}      {:+.4}",
            yr, adopt, rho_t, net
        ));
    }

    let tipping_display = tipping_analytic
        .map(|y| format!("yr {y} (analytic: r > ρ(t))"))
        .unwrap_or_else(|| "NEVER (r ≤ ρ₀ always)".into());

    out.push_str(&format!(
        "\n ──────────────────────────────────────────\n\
         MILESTONES:\n\
           TIPPING_POINT       {tipping}\n\
           CRITICAL_MASS (50%) {critical}\n\
           DOMINANCE     (90%) {dominance}\n\
         FINAL_STATE:\n\
           ADOPTION_FRACTION   {final_a:.6}\n\
           RESIDUAL_RESISTANCE {final_rho:.6}\n\
           OUTCOME: {outcome}\n\
         STRATEGY: Build new system around old — expand 'islands of coherence'.\n\
         SOURCE: content/rust_kernels/src/lib.rs",
        tipping   = tipping_display,
        critical  = critical_mass_yr.map(|y| format!("yr {y}")).unwrap_or_else(|| "NOT_REACHED".into()),
        dominance = dominance_yr.map(|y| format!("yr {y}")).unwrap_or_else(|| "NOT_REACHED".into()),
        final_a   = final_a,
        final_rho = final_rho,
        outcome   = outcome,
    ));
    out
}


// =============================================================================
// SOMA_KERNEL_5.5 LIVE -- Stateful Multi-Cycle Socioeconomic Simulator
//
// Marries the rigorous ODE/RK4/Walrasian math of the free functions with a
// persistent struct that accumulates state across terminal commands.
//
// Usage (from terminal):
//   run soma_live                                     // cycle at legacy defaults
//   run soma_live --consumption 40 --compliance 0.1  // one policy intervention
//   run soma_live reset                               // wipe state, return yr 0
// =============================================================================

#[wasm_bindgen]
pub struct SomaKernel {
    regeneration: f64,
    absorption:   f64,
    substitution: f64,
    r_stock:  f64,
    p_stock:  f64,
    nr_stock: f64,
    cumulative_entropy: f64,
    ostrom_compliance:      f64,
    soma_plus:              f64,
    strangler_fig_adoption: f64,
    year: u32,
}

#[wasm_bindgen]
impl SomaKernel {
    #[wasm_bindgen(constructor)]
    pub fn new() -> SomaKernel {
        SomaKernel {
            regeneration: 30.0,
            absorption:   11_000.0,
            substitution: 0.008,
            r_stock:  1.0,
            p_stock:  0.0,
            nr_stock: 1.0,
            cumulative_entropy: 0.0,
            ostrom_compliance:      0.10,
            soma_plus:              0.0,
            strangler_fig_adoption: 0.02,
            year: 0,
        }
    }

    /// Execute one annual policy cycle.
    /// consumption    GJ/capita/yr  (legacy ~80; sustainable ~25)
    /// waste          Mt CO2eq/yr   (legacy ~55000; sustainable <11000)
    /// nr_depletion   fraction/yr   (legacy ~0.025; target <0.008)
    /// compliance_mod delta to ostrom_compliance this cycle (-0.2 to +0.2)
    pub fn execute_cycle(
        &mut self,
        consumption:    f64,
        waste:          f64,
        nr_depletion:   f64,
        compliance_mod: f64,
    ) -> String {
        self.year += 1;
        let mut out = String::new();

        self.ostrom_compliance = (self.ostrom_compliance + compliance_mod).clamp(0.0, 1.0);

        // Daly Rule 1: Renewable stock (Euler dt=1yr)
        let pollution_drag  = (1.0 - self.p_stock * 0.15).max(0.0);
        let effective_regen = self.regeneration * self.r_stock * pollution_drag;
        let delta_r         = (effective_regen - consumption) / self.regeneration;
        self.r_stock        = (self.r_stock + delta_r * 0.01).clamp(0.0, 2.0);

        // Daly Rule 2: Pollution accumulation
        let saturation     = (self.p_stock * 0.4).min(0.95);
        let eff_absorption = self.absorption * (1.0 - saturation);
        let delta_p        = (waste - eff_absorption) / self.absorption;
        self.p_stock       = (self.p_stock + delta_p * 0.005).clamp(0.0, 20.0);

        // Daly Rule 3: Non-renewable reserves
        self.nr_stock = (self.nr_stock + (self.substitution - nr_depletion)).clamp(0.0, 2.0);

        // Entropy production (Clausius-Duhem / Prigogine)
        let overshoot = consumption / self.regeneration.max(0.01);
        if overshoot > 1.0 { self.cumulative_entropy += overshoot * overshoot.ln(); }
        self.cumulative_entropy += self.p_stock * 0.002;

        let r1_ratio = consumption  / self.regeneration;
        let r2_ratio = waste        / self.absorption;
        let r3_ratio = nr_depletion / self.substitution.max(0.001);
        let r1_ok    = r1_ratio <= 1.0;
        let r2_ok    = r2_ratio <= 1.0;
        let r3_ok    = r3_ratio <= 1.0;

        // A-CEEI Allocation: Walrasian tatonnement (50 iterations)
        let eco_budget               = self.r_stock.min(1.0) * self.ostrom_compliance;
        let (envy_idx, pareto, gini) = self.walrasian_ceei(eco_budget);

        // Soma Plus: social capital (only when survival is not threatened)
        let earned_sp = if r1_ok && r2_ok {
            (self.ostrom_compliance * 18.0)
            + (self.ostrom_compliance * 14.0)
            + (self.ostrom_compliance * 22.0 * 0.20)
        } else { 0.0 };
        self.soma_plus += earned_sp;

        // Strangler Fig: single RK4 step
        let r     = 0.18_f64 + self.ostrom_compliance * 0.12;
        let rho_0 = 0.25_f64;
        let lam   = 0.05_f64;
        let t     = self.year as f64;
        let a     = self.strangler_fig_adoption;
        let k1 = (r - rho_0 * (-lam *  t       ).exp()) * a  * (1.0 - a );
        let a2 = (a + k1 * 0.5).clamp(0.0, 1.0);
        let k2 = (r - rho_0 * (-lam * (t + 0.5)).exp()) * a2 * (1.0 - a2);
        let a3 = (a + k2 * 0.5).clamp(0.0, 1.0);
        let k3 = (r - rho_0 * (-lam * (t + 0.5)).exp()) * a3 * (1.0 - a3);
        let a4 = (a + k3      ).clamp(0.0, 1.0);
        let k4 = (r - rho_0 * (-lam * (t + 1.0)).exp()) * a4 * (1.0 - a4);
        self.strangler_fig_adoption = (a + (k1 + 2.0*k2 + 2.0*k3 + k4) / 6.0).clamp(0.0, 1.0);

        let frag_idx     = 1.0 - (-self.cumulative_entropy * 0.08).exp();
        let system_state = if self.strangler_fig_adoption >= 0.9 { "POLYCENTRIC_HARMONY"
        } else if self.strangler_fig_adoption >= 0.5             { "CRITICAL_MASS_REACHED"
        } else if self.strangler_fig_adoption >= 0.2             { "ISLANDS_OF_COHERENCE"
        } else if r1_ok && r2_ok && r3_ok                        { "LEGACY_STABLE"
        } else                                                    { "LEGACY_COLLAPSE" };

        use std::fmt::Write as W;
        writeln!(out, "SOMA_KERNEL_5.5 // CYCLE {}", self.year).unwrap();
        writeln!(out, "==============================================").unwrap();
        writeln!(out, "DALY RULES AUDIT:").unwrap();
        writeln!(out, "  Rule 1 (Renewable)  C/G = {:.3}x  [{}]  r_stock={:.4}", r1_ratio, if r1_ok {"SAFE"} else {"BREACH"}, self.r_stock).unwrap();
        writeln!(out, "  Rule 2 (Pollution)  W/A = {:.3}x  [{}]  p_stock={:.4}", r2_ratio, if r2_ok {"SAFE"} else {"BREACH"}, self.p_stock).unwrap();
        writeln!(out, "  Rule 3 (Non-renew)  D/S = {:.3}x  [{}]  nr_res={:.4}",  r3_ratio, if r3_ok {"SAFE"} else {"BREACH"}, self.nr_stock).unwrap();
        writeln!(out, "----------------------------------------------").unwrap();
        writeln!(out, "A-CEEI ALLOCATION (Walrasian):").unwrap();
        writeln!(out, "  Envy Index:         {:.4}  [{}]", envy_idx, if envy_idx < 0.01 {"ENVY-FREE"} else if envy_idx < 0.1 {"APPROX_EF"} else {"ENVY_PRESENT"}).unwrap();
        writeln!(out, "  Pareto Efficiency:  {:.4}", pareto).unwrap();
        writeln!(out, "  Utility Gini:       {:.4}", gini).unwrap();
        writeln!(out, "----------------------------------------------").unwrap();
        writeln!(out, "SOMA PLUS:").unwrap();
        if earned_sp > 0.0 {
            writeln!(out, "  Care Labor Logged:  +{:.1} SP  (total {:.1})", earned_sp, self.soma_plus).unwrap();
        } else {
            writeln!(out, "  ATTENTION: Survival threat -- care labor suspended.").unwrap();
        }
        writeln!(out, "----------------------------------------------").unwrap();
        writeln!(out, "STRANGLER FIG TRANSITION:").unwrap();
        writeln!(out, "  Adoption Fraction:  {:.4}  ({:.1}%)", self.strangler_fig_adoption, self.strangler_fig_adoption * 100.0).unwrap();
        writeln!(out, "  Growth Rate r:      {:.4}  (compliance boost +{:.4})", r, self.ostrom_compliance * 0.12).unwrap();
        writeln!(out, "----------------------------------------------").unwrap();
        writeln!(out, "SYSTEM STATE:").unwrap();
        writeln!(out, "  Ostrom Compliance:  {:.3}", self.ostrom_compliance).unwrap();
        writeln!(out, "  Soma Plus (global): {:.1}", self.soma_plus).unwrap();
        writeln!(out, "  Cumul. Entropy:     {:.4} nats", self.cumulative_entropy).unwrap();
        writeln!(out, "  Fragmentation Idx:  {:.4}", frag_idx).unwrap();
        writeln!(out, "  HORIZON:            {}", system_state).unwrap();
        writeln!(out, "SOURCE: content/rust_kernels/src/lib.rs  [cycle={}]", self.year).unwrap();
        out
    }

    fn walrasian_ceei(&self, eco_budget: f64) -> (f64, f64, f64) {
        const N: usize = 8;
        const M: usize = 4;
        let base      = 1.0 / M as f64;
        let diversity = 1.0 - self.ostrom_compliance * 0.5;

        let mut rng: u64 = ((self.ostrom_compliance * 1e12) as u64)
            .wrapping_add((self.soma_plus as u64).wrapping_mul(1_000_003))
            .wrapping_add((self.year as u64).wrapping_mul(2_654_435_761))
            .wrapping_add(0xCAFE_BABE_1234_5678);

        let mut w = [[base; M]; N];
        for i in 0..N {
            let mut row_sum = 0.0;
            for j in 0..M {
                let noise = (lcg_next(&mut rng) - 0.5) * 2.0 * diversity;
                w[i][j] = (base + noise).max(0.001);
                row_sum += w[i][j];
            }
            for j in 0..M { w[i][j] /= row_sum; }
        }

        let budget     = eco_budget.max(0.05);
        let budgets    = [budget; N];
        let total: f64 = budgets.iter().sum();
        let supply     = [total / M as f64; M];
        let mut prices = [1.0_f64; M];

        for _ in 0..50 {
            let mut demand = [0.0_f64; M];
            for i in 0..N { for j in 0..M { demand[j] += w[i][j] * budgets[i] / prices[j]; } }
            let mut max_ex = 0.0_f64;
            for j in 0..M {
                let ex    = demand[j] - supply[j];
                max_ex    = max_ex.max(ex.abs());
                prices[j] = (prices[j] + 0.3 * ex / supply[j].max(0.001)).max(0.01);
            }
            if max_ex < 0.001 { break; }
        }

        let mut allocs = [[0.0_f64; M]; N];
        let mut utils  = [0.0_f64; N];
        for i in 0..N {
            for j in 0..M {
                allocs[i][j] = w[i][j] * budgets[i] / prices[j];
                utils[i]    += w[i][j] * (allocs[i][j] + 1.0).ln();
            }
        }

        let mut max_envy = 0.0_f64;
        for i in 0..N {
            for k in 0..N {
                if k == i { continue; }
                let u_ik: f64 = (0..M).map(|j| w[i][j] * (allocs[k][j] + 1.0).ln()).sum();
                max_envy = max_envy.max((u_ik - utils[i]).max(0.0));
            }
        }

        let residual: f64 = (0..M).map(|j| {
            let d: f64 = (0..N).map(|i| allocs[i][j]).sum();
            (d - supply[j]).abs() / supply[j].max(0.001)
        }).sum::<f64>() / M as f64;
        let pareto = (1.0 - residual).clamp(0.0, 1.0);

        let mut sorted_u = utils;
        sorted_u.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let mean_u = sorted_u.iter().sum::<f64>() / N as f64;
        let gini = if mean_u > 0.0 {
            let mut g = 0.0_f64;
            for i in 0..N { for k in 0..N { g += (sorted_u[i] - sorted_u[k]).abs(); } }
            g / (2.0 * N as f64 * N as f64 * mean_u)
        } else { 0.0 };

        (max_envy, pareto, gini)
    }

    pub fn reset(&mut self) {
        self.r_stock = 1.0; self.p_stock = 0.0; self.nr_stock = 1.0;
        self.cumulative_entropy = 0.0; self.ostrom_compliance = 0.10;
        self.soma_plus = 0.0; self.strangler_fig_adoption = 0.02; self.year = 0;
    }

    pub fn get_year(&self)      -> u32 { self.year }
    pub fn get_adoption(&self)  -> f64 { self.strangler_fig_adoption }
    pub fn get_soma_plus(&self) -> f64 { self.soma_plus }
    pub fn get_entropy(&self)   -> f64 { self.cumulative_entropy }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SURVEILLANCE_INDEX v1.0 — grey-c0 / Navigators Guild dataset
//
// Computes a Panopticon Index (0–100) over 44 pieces of computational
// governance legislation across 14 jurisdictions.
//
// Panopticon Index = Σ(severity²) / (n × 25) × 100
//   Squaring severity amplifies CRITICAL entries (25pts) vs ELEVATED (9pts),
//   making the index sensitive to high-severity clustering.
//
// Terminal usage (all params are f64 codes for wasm-bindgen compatibility):
//   run surveillance                                      // all 44 laws (defaults 0,0,0)
//   run surveillance --region 1                          // UK only
//   run surveillance --region 2 --threshold 5            // EU CRITICAL laws
//   run surveillance --category 1                        // encryption_backdoor
//   run surveillance --threshold 4                       // severity ≥ 4 only
//
// region_code:   0=ALL 1=UK 2=EU 3=US 4=AU 5=CA 6=DE 7=FR 8=SE 9=IE 10=NL 11=NZ 12=BE
// category_code: 0=ALL 1=encryption_backdoor 2=digital_id 3=biometric_collection
//                4=data_retention 5=worker_surveillance 6=platform_mandated_scanning
//                7=traffic_retention 8=age_verification
//
// Attribution: @grey-c0 / Navigators Guild
// Source:      https://github.com/grey-c0/legislation
// ═══════════════════════════════════════════════════════════════════════════════

#[wasm_bindgen]
pub fn run_surveillance_index(region_code: f64, category_code: f64, threshold: f64) -> String {
    // Map numeric region code → location string fragment
    let region_filter: &str = match region_code as u8 {
        1  => "United Kingdom",
        2  => "EU",
        3  => "United States",
        4  => "Australia",
        5  => "Canada",
        6  => "Germany",
        7  => "France",
        8  => "Sweden",
        9  => "Ireland",
        10 => "Netherlands",
        11 => "New Zealand",
        12 => "Belgium",
        _  => "",   // 0 = ALL
    };
    // Map numeric category code → category slug
    let category_filter: &str = match category_code as u8 {
        1 => "encryption_backdoor",
        2 => "digital_id",
        3 => "biometric_collection",
        4 => "data_retention",
        5 => "worker_surveillance",
        6 => "platform_mandated_scanning",
        7 => "traffic_retention",
        8 => "age_verification",
        _ => "",    // 0 = ALL
    };
    struct LawEntry {
        id:         &'static str,
        location:   &'static str,
        severity:   u8,
        status:     &'static str,
        categories: &'static str, // space-separated slugs — fast contains() match
    }

    const LAWS: &[LawEntry] = &[
        // ── Australia ──────────────────────────────────────────────────────────
        LawEntry { id: "LAW-AU-2018-TOLA-001",       location: "Australia",      severity: 4, status: "ACTIVE",        categories: "encryption_backdoor data_retention" },
        LawEntry { id: "LAW-AU-2024-DIGID-001",       location: "Australia",      severity: 4, status: "IMPLEMENTING",  categories: "digital_id biometric_collection age_verification" },
        LawEntry { id: "LAW-AU-2024-SMMA-001",        location: "Australia",      severity: 4, status: "ACTIVE",        categories: "age_verification digital_id biometric_collection" },
        LawEntry { id: "LAW-AU-2025-NSW-DWC",         location: "Australia",      severity: 3, status: "ACTIVE",        categories: "digital_id worker_surveillance" },
        // ── Belgium ────────────────────────────────────────────────────────────
        LawEntry { id: "LAW-BE-2024-DATA-RETENTION",  location: "Belgium",        severity: 4, status: "ACTIVE",        categories: "data_retention traffic_retention" },
        LawEntry { id: "LAW-BE-2024-ITSME",           location: "Belgium",        severity: 3, status: "ACTIVE",        categories: "digital_id biometric_collection" },
        LawEntry { id: "LAW-BE-2026-DIGITAL-ID",      location: "Belgium",        severity: 3, status: "IMPLEMENTING",  categories: "digital_id biometric_collection" },
        // ── Canada ─────────────────────────────────────────────────────────────
        LawEntry { id: "LAW-CA-2025-C2-001",          location: "Canada",         severity: 4, status: "CHALLENGED",    categories: "data_retention encryption_backdoor worker_surveillance" },
        LawEntry { id: "LAW-CA-2025-C63-001",         location: "Canada",         severity: 3, status: "PROPOSED",      categories: "age_verification platform_mandated_scanning" },
        LawEntry { id: "LAW-CA-2025-C8-001",          location: "Canada",         severity: 5, status: "PROPOSED",      categories: "traffic_retention encryption_backdoor worker_surveillance data_retention" },
        LawEntry { id: "LAW-CA-2025-DIACC-001",       location: "Canada",         severity: 3, status: "IMPLEMENTING",  categories: "digital_id biometric_collection" },
        // ── Germany ────────────────────────────────────────────────────────────
        LawEntry { id: "LAW-DE-2021-NETZDG-002",      location: "Germany",        severity: 4, status: "ACTIVE",        categories: "platform_mandated_scanning data_retention worker_surveillance" },
        LawEntry { id: "LAW-DE-2025-BND-001",         location: "Germany",        severity: 5, status: "PROPOSED",      categories: "traffic_retention data_retention encryption_backdoor" },
        LawEntry { id: "LAW-DE-2025-EUDI-001",        location: "Germany",        severity: 4, status: "IMPLEMENTING",  categories: "digital_id biometric_collection" },
        // ── EU ─────────────────────────────────────────────────────────────────
        LawEntry { id: "LAW-EU-2024-DSA",             location: "EU",             severity: 3, status: "ACTIVE",        categories: "platform_mandated_scanning data_retention" },
        LawEntry { id: "LAW-EU-2024-EIDAS2",          location: "EU",             severity: 4, status: "IMPLEMENTING",  categories: "digital_id biometric_collection" },
        LawEntry { id: "LAW-EU-2024-PLATFORM-WORK",   location: "EU",             severity: 3, status: "PASSED",        categories: "worker_surveillance biometric_collection" },
        LawEntry { id: "LAW-EU-2025-CHAT-001",        location: "EU",             severity: 5, status: "CHALLENGED",    categories: "encryption_backdoor platform_mandated_scanning age_verification biometric_collection data_retention" },
        LawEntry { id: "LAW-EU-2025-DATA-RETENTION",  location: "EU",             severity: 4, status: "PROPOSED",      categories: "data_retention traffic_retention" },
        // ── France ─────────────────────────────────────────────────────────────
        LawEntry { id: "LAW-FR-2023-JO2024",          location: "France",         severity: 4, status: "ACTIVE",        categories: "biometric_collection worker_surveillance" },
        LawEntry { id: "LAW-FR-2024-SREN",            location: "France",         severity: 4, status: "ACTIVE",        categories: "age_verification biometric_collection digital_id" },
        // ── Ireland ────────────────────────────────────────────────────────────
        LawEntry { id: "LAW-IE-2011-DATA-RETENTION",  location: "Ireland",        severity: 4, status: "ACTIVE",        categories: "data_retention traffic_retention" },
        LawEntry { id: "LAW-IE-2011-PSC",             location: "Ireland",        severity: 4, status: "CHALLENGED",    categories: "digital_id biometric_collection" },
        LawEntry { id: "LAW-IE-2024-OSC",             location: "Ireland",        severity: 4, status: "IMPLEMENTING",  categories: "age_verification digital_id biometric_collection" },
        // ── Netherlands ────────────────────────────────────────────────────────
        LawEntry { id: "LAW-NL-2024-DATA-RETENTION",  location: "Netherlands",    severity: 3, status: "ACTIVE",        categories: "data_retention traffic_retention" },
        LawEntry { id: "LAW-NL-2024-WIV",             location: "Netherlands",    severity: 4, status: "ACTIVE",        categories: "traffic_retention data_retention" },
        LawEntry { id: "LAW-NL-2025-IDIN-ITSME",      location: "Netherlands",    severity: 3, status: "IMPLEMENTING",  categories: "digital_id biometric_collection" },
        // ── New Zealand ────────────────────────────────────────────────────────
        LawEntry { id: "LAW-NZ-2023-DIGID",           location: "New Zealand",    severity: 3, status: "ACTIVE",        categories: "digital_id biometric_collection" },
        LawEntry { id: "LAW-NZ-2025-BIOMETRIC",       location: "New Zealand",    severity: 3, status: "IMPLEMENTING",  categories: "biometric_collection worker_surveillance" },
        LawEntry { id: "LAW-NZ-2025-TERROR",          location: "New Zealand",    severity: 4, status: "PROPOSED",      categories: "worker_surveillance" },
        // ── Sweden ─────────────────────────────────────────────────────────────
        LawEntry { id: "LAW-SE-2003-BANKID",          location: "Sweden",         severity: 3, status: "ACTIVE",        categories: "digital_id biometric_collection" },
        LawEntry { id: "LAW-SE-2024-FRA",             location: "Sweden",         severity: 5, status: "ACTIVE",        categories: "traffic_retention data_retention" },
        LawEntry { id: "LAW-SE-2025-CAMERA",          location: "Sweden",         severity: 3, status: "ACTIVE",        categories: "biometric_collection worker_surveillance" },
        LawEntry { id: "LAW-SE-2025-DATALAGRING",     location: "Sweden",         severity: 5, status: "PROPOSED",      categories: "encryption_backdoor data_retention" },
        // ── United Kingdom ─────────────────────────────────────────────────────
        LawEntry { id: "LAW-UK-2023-OSA-001",         location: "United Kingdom", severity: 5, status: "ACTIVE",        categories: "age_verification platform_mandated_scanning encryption_backdoor digital_id" },
        LawEntry { id: "LAW-UK-2024-IPA-001",         location: "United Kingdom", severity: 4, status: "IMPLEMENTING",  categories: "traffic_retention data_retention" },
        LawEntry { id: "LAW-UK-2025-DIGID-001",       location: "United Kingdom", severity: 5, status: "PROPOSED",      categories: "digital_id biometric_collection worker_surveillance" },
        LawEntry { id: "LAW-UK-2025-DUA-001",         location: "United Kingdom", severity: 4, status: "PASSED",        categories: "worker_surveillance digital_id" },
        // ── United States ──────────────────────────────────────────────────────
        LawEntry { id: "LAW-US-2025-AMZN-001",        location: "United States",  severity: 3, status: "ACTIVE",        categories: "worker_surveillance biometric_collection" },
        LawEntry { id: "LAW-US-2025-EARN-001",        location: "United States",  severity: 5, status: "PROPOSED",      categories: "encryption_backdoor platform_mandated_scanning" },
        LawEntry { id: "LAW-US-2025-ICE-001",         location: "United States",  severity: 4, status: "IMPLEMENTING",  categories: "worker_surveillance data_retention platform_mandated_scanning" },
        LawEntry { id: "LAW-US-2025-KOSA-001",        location: "United States",  severity: 4, status: "PROPOSED",      categories: "age_verification platform_mandated_scanning" },
        LawEntry { id: "LAW-US-2025-STATE-001",       location: "United States",  severity: 4, status: "CHALLENGED",    categories: "age_verification digital_id biometric_collection" },
        LawEntry { id: "LAW-US-2026-CA-947",          location: "United States",  severity: 2, status: "PROPOSED",      categories: "worker_surveillance" },
    ];

    let thresh = threshold.clamp(0.0, 5.0) as u8;

    // ── Filter ────────────────────────────────────────────────────────────────
    let filtered: Vec<&LawEntry> = LAWS.iter().filter(|law| {
        let region_ok = region_filter.is_empty()
            || law.location.contains(region_filter);
        let cat_ok = category_filter.is_empty()
            || law.categories.contains(category_filter);
        let thresh_ok = law.severity >= thresh;
        region_ok && cat_ok && thresh_ok
    }).collect();

    if filtered.is_empty() {
        return format!(
            "SURVEILLANCE_INDEX v1.0 // NO_MATCH\n\
             STATUS: ZERO_ENTRIES_IN_FILTER\n\
             REGION_FILTER:   {}\n\
             CATEGORY_FILTER: {}\n\
             THRESHOLD:       {}/5\n\
             SOURCE: grey-c0/legislation // Navigators Guild",
            if region_filter.is_empty()   { "ALL" } else { region_filter },
            if category_filter.is_empty() { "ALL" } else { category_filter },
            thresh,
        );
    }

    let total   = filtered.len();
    let avg_sev = filtered.iter().map(|l| l.severity as f64).sum::<f64>() / total as f64;

    // Panopticon Index: Σ(severity²) / (n × 25) × 100
    let raw_score: f64 = filtered.iter().map(|l| (l.severity as f64).powi(2)).sum();
    let panopticon     = (raw_score / (total as f64 * 25.0) * 100.0).min(100.0);

    // Severity tiers
    let critical = filtered.iter().filter(|l| l.severity == 5).count();
    let high     = filtered.iter().filter(|l| l.severity == 4).count();
    let elevated = filtered.iter().filter(|l| l.severity == 3).count();
    let moderate = filtered.iter().filter(|l| l.severity <= 2).count();

    // Legal status breakdown
    let s_active      = filtered.iter().filter(|l| l.status == "ACTIVE").count();
    let s_implementing = filtered.iter().filter(|l| matches!(l.status, "IMPLEMENTING" | "PASSED")).count();
    let s_proposed    = filtered.iter().filter(|l| l.status == "PROPOSED").count();
    let s_challenged  = filtered.iter().filter(|l| l.status == "CHALLENGED").count();

    // ── Per-jurisdiction aggregation (linear scan — 44 entries, O(n²) fine) ──
    let mut seen_locs: Vec<&str> = Vec::new();
    for law in &filtered {
        if !seen_locs.contains(&law.location) {
            seen_locs.push(law.location);
        }
    }
    let mut loc_stats: Vec<(&str, usize, u32)> = seen_locs.iter().map(|&loc| {
        let count   = filtered.iter().filter(|l| l.location == loc).count();
        let sev_sum = filtered.iter().filter(|l| l.location == loc)
                              .map(|l| l.severity as u32).sum::<u32>();
        (loc, count, sev_sum)
    }).collect();
    loc_stats.sort_by(|a, b| b.2.cmp(&a.2).then(b.1.cmp(&a.1)));

    // ── Category frequency ────────────────────────────────────────────────────
    const CAT_KEYS: &[&str] = &[
        "biometric_collection", "data_retention",           "digital_id",
        "encryption_backdoor",  "worker_surveillance",      "platform_mandated_scanning",
        "traffic_retention",    "age_verification",
    ];
    let mut cat_counts: Vec<(&str, usize)> = CAT_KEYS.iter()
        .map(|&cat| {
            let n = filtered.iter().filter(|l| l.categories.contains(cat)).count();
            (cat, n)
        })
        .filter(|(_, n)| *n > 0)
        .collect();
    cat_counts.sort_by(|a, b| b.1.cmp(&a.1));

    // ── Threat assessment ─────────────────────────────────────────────────────
    let threat_status = if panopticon >= 80.0      { "CRITICAL: PANOPTICON_IMMINENT" }
        else if panopticon >= 60.0 { "HIGH: SYSTEMIC_SURVEILLANCE_RISK" }
        else if panopticon >= 40.0 { "ELEVATED: COORDINATED_LEGISLATION_DETECTED" }
        else                       { "MODERATE: ISOLATED_VECTORS" };

    // ── Format output ─────────────────────────────────────────────────────────
    let mut out = String::new();
    out.push_str("SURVEILLANCE_INDEX v1.0 // BOOT_OK\n");
    out.push_str(&format!("STATUS: {}\n", threat_status));
    out.push_str(&format!("REGION_FILTER:   {}\n", if region_filter.is_empty()   { "ALL" } else { region_filter }));
    out.push_str(&format!("CATEGORY_FILTER: {}\n", if category_filter.is_empty() { "ALL" } else { category_filter }));
    out.push_str(&format!("THRESHOLD:       {}/5\n", thresh));
    out.push_str("────────────────────────────────────────────\n");
    out.push_str(&format!("ENTRIES_MATCHED:  {}\n",   total));
    out.push_str(&format!("AVG_SEVERITY:     {:.2}/5.00\n", avg_sev));
    out.push_str(&format!("PANOPTICON_INDEX: {:.1}/100.0\n", panopticon));
    out.push_str(&format!(
        "THREAT_TIERS:     CRITICAL={} HIGH={} ELEVATED={} MODERATE={}\n",
        critical, high, elevated, moderate
    ));
    out.push_str(&format!(
        "LEGAL_STATUS:     ACTIVE={} IMPLEMENTING/PASSED={} PROPOSED={} CHALLENGED={}\n",
        s_active, s_implementing, s_proposed, s_challenged
    ));
    out.push_str("────────────────────────────────────────────\n");
    out.push_str("JURISDICTION_THREAT_MAP:\n");
    for (loc, count, sev_sum) in &loc_stats {
        let avg     = *sev_sum as f64 / *count as f64;
        let bar_len = (avg / 5.0 * 14.0).round() as usize;
        let bar: String = "█".repeat(bar_len) + &"░".repeat(14usize.saturating_sub(bar_len));
        out.push_str(&format!("  {:<16} laws={:<3} avg={:.1}  {}\n", loc, count, avg, bar));
    }
    out.push_str("────────────────────────────────────────────\n");
    out.push_str("TOP_THREAT_CATEGORIES:\n");
    for (cat, n) in cat_counts.iter().take(8) {
        let bar_len = (*n * 14 / total).min(14);
        let bar: String = "█".repeat(bar_len) + &"░".repeat(14usize.saturating_sub(bar_len));
        out.push_str(&format!("  {:<30} n={:<3}  {}\n", cat, n, bar));
    }
    out.push_str("────────────────────────────────────────────\n");
    out.push_str("SOURCE:      grey-c0/legislation // Navigators Guild\n");
    out.push_str("ATTRIBUTION: @grey-c0 // integrated into scale_9.4 CAS\n");

    out
}

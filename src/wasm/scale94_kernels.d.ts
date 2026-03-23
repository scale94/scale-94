/* tslint:disable */
/* eslint-disable */

export class BiocoenosisKernel {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Static boot diagnostic — returns the kernel's initial state string.
     * Called by the terminal `run` command to populate the system log.
     */
    static boot(): string;
    get_entropy_index(): number;
    get_species_count(): number;
    constructor();
    /**
     * Register N species. Recomputes Shannon entropy approximation.
     */
    register_species(count: number): void;
}

/**
 * Stateful Gray-Scott kernel — grid persists between compute_steps() calls.
 * Each call continues the simulation from where the last left off.
 */
export class GrayScottKernel {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Advance the simulation by `frames` PDE steps then render the V-field.
     * Uses 5-point discrete Laplacian with Dirichlet (zero-flux) boundary.
     * Swap-based double-buffering avoids the full memcopy of copy_from_slice.
     */
    compute_steps(feed: number, kill: number, frames: number): string;
    /**
     * Construct with default 60×20 grid seeded at centre.
     * No-arg constructor required by the WASM stateful kernel protocol.
     */
    constructor();
}

export class NecromanticEngine {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Static boot diagnostic — returns HarmonicResult string for the terminal.
     */
    static boot(): string;
    get_bpm(): number;
    get_cycle(): bigint;
    /**
     * Returns a HarmonicResult string with current BPM and cycle count.
     */
    harmonic_result(): string;
    constructor();
    /**
     * Inject a resonance value. BPM is modulated by the resonance field.
     * Δbpm = sin(r × 7) × 11 — keeps oscillation within ±11 BPM of baseline.
     */
    set_resonance(r: number): void;
}

export class SomaKernel {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Execute one annual policy cycle.
     * consumption    GJ/capita/yr  (legacy ~80; sustainable ~25)
     * waste          Mt CO2eq/yr   (legacy ~55000; sustainable <11000)
     * nr_depletion   fraction/yr   (legacy ~0.025; target <0.008)
     * compliance_mod delta to ostrom_compliance this cycle (-0.2 to +0.2)
     */
    execute_cycle(consumption: number, waste: number, nr_depletion: number, compliance_mod: number): string;
    get_adoption(): number;
    get_entropy(): number;
    get_soma_plus(): number;
    get_year(): number;
    constructor();
    reset(): void;
}

/**
 * Boot the Bosonic Lattice Simulator.
 *
 * * `n_nodes`   — Fermionic sovereign nodes (integer ≥ 1, passed as f64 for WASM)
 * * `coupling`  — boson-boson coupling constant [0–1]; bosonic field strength
 * * `thermal`   — reduced temperature kT/J [0–1]; 0=ground_state 1=decoherence
 * * `price_fix` — price measurement [0–1]; 0=gift_economy 1=fully_priced (kills trust)
 */
export function boot_bosonic_lattice(n_nodes: number, coupling: number, thermal: number, price_fix: number): string;

/**
 * Boot the Geopolitical Kinetics engine.
 * sanction:    economic pressure index (0–10 typical)
 * grid:        infrastructure/grid resilience (0–1; clamped to 0.1 minimum)
 * propaganda:  narrative control coefficient (0–1)
 */
export function boot_geopolitical_kinetics(sanction: number, grid: number, propaganda: number): string;

/**
 * Boot the Leviathan Cellular Automata benchmark.
 * grid_size:   number of cells in the 1-D automaton (default 100_000)
 * generations: number of evolution steps (default 100)
 * Runs Rule-30 subset over a large buffer to saturate the 5800X3D V-Cache.
 */
export function boot_leviathan_benchmark(grid_size: number, generations: number): string;

/**
 * Top-level boot diagnostic for soma_kernel_5.5.
 * Runs at default parameters to give a high-level status summary of all
 * four sub-systems: Daly Rules, A-CEEI, Soma Plus, Strangler Fig.
 * No parameters — callable as `run soma55` with zero flags.
 */
export function boot_soma55(): string;

/**
 * Boot the Thermosphere Protocol climate engine.
 * carbon_ppm:      atmospheric CO₂ concentration (ppm); pre-industrial baseline ~280
 * industrial_drag: dimensionless forcing multiplier (0–10 typical)
 * ocean_sink:      ocean carbon absorption efficiency (0–1; clamped to 0.01 minimum)
 */
export function boot_thermosphere_protocol(carbon_ppm: number, industrial_drag: number, ocean_sink: number): string;

/**
 * Autocomplete hint: single [reveal:0|1] parameter
 */
export function classified_params(): Array<any>;

/**
 * Compare two nodes by zero-based index.
 *
 * Returns a JSON string:
 * ```json
 * {
 *   "sim": 0.8734,
 *   "topDims": [
 *     { "name": "synchrony",   "contribution": 0.0625, "vA": 0.25, "vB": 0.25 },
 *     { "name": "spatial",     "contribution": 0.0423, "vA": 0.65, "vB": 0.65 },
 *     { "name": "stochastic",  "contribution": 0.0200, "vA": 0.20, "vB": 0.10 }
 *   ]
 * }
 * ```
 */
export function compare_nodes(idx_a: number, idx_b: number): string;

/**
 * Compute period-doubling bifurcation children.
 *
 * `degrees_json` — JSON array of u32 connection degrees, one per node (length = N_NODES).
 *
 * Returns a JSON array of child specs for nodes in the top 15% by degree:
 * ```json
 * [
 *   {
 *     "parentIdx": 12,
 *     "childFeatures": [0.2987, 1.0000, 0.2532, ...]
 *   },
 *   ...
 * ]
 * ```
 * The JS layer is responsible for sphere placement, color inheritance, and birth animation.
 */
export function compute_bifurcation_children(degrees_json: string): string;

/**
 * Generate an ML-KEM-768 keypair. Stores the typed keypair in WASM memory
 * for subsequent seal/open calls. Returns formatted log + DATA: JSON with
 * hex-encoded ek (public) and dk (private).
 */
export function enclave_keygen(): string;

/**
 * Decrypt a sealed blob using the decapsulation key from the most recent
 * `enclave_keygen()` call.
 * `sealed_hex` — hex-encoded sealed blob (kem_ct || nonce || aes_ct+tag)
 * Returns formatted log + DATA: JSON with the recovered plaintext.
 */
export function enclave_open(sealed_hex: string): string;

/**
 * Encrypt a plaintext message using ML-KEM-768 + AES-256-GCM.
 * Uses the encapsulation key from the most recent `enclave_keygen()` call.
 * Returns formatted log + DATA: JSON with the hex-encoded sealed blob.
 */
export function enclave_seal(plaintext: string): string;

/**
 * Autocomplete hint: returns parameter names for the terminal UI
 */
export function grayscott_params(): Array<any>;

/**
 * Wipe ephemeral noise buffers and simulated key fragments from WASM linear
 * memory after a classified session cycle ends.
 *
 * Uses `zeroize::Zeroize` which emits a compiler_fence(SeqCst) after the
 * zeroing loop — prevents LLVM from eliding the wipe as a dead-store
 * optimisation. In WASM, the erased bytes live in the linear memory heap;
 * while JS can still read WebAssembly.Memory, this ensures Rust's side of
 * any ephemeral key material is provably cleared before the function returns.
 *
 * The React frontend calls this via `mod.log_entropy_flush()` after the
 * decrypted payload has been delivered, logging the result to the system log.
 */
export function log_entropy_flush(): string;

export function run_associative_field(seed_node: number, temperature: number, n_probes: number): string;

/**
 * Community assembly simulation — power-law abundance distribution with
 * standard ecological diversity metrics and stochastic temporal drift.
 *
 * Parameters:
 *   n_species     : species richness (2–500)
 *   diversity_exp : Zipf rank-abundance exponent (0.1–3.0);
 *                   0.5 = near-even, 1.0 = natural community, 2.0 = dominated
 *   timesteps     : stochastic perturbation steps for temporal H drift (0–200)
 */
export function run_biocoenosis_simulation(n_species: number, diversity_exp: number, timesteps: number): string;

export function run_bone_fusion(n_tensors: number, n_cycles: number, threshold: number): string;

/**
 * Simulates a simplified A-CEEI (Approximate Competitive Equilibrium from
 * Equal Incomes) preference-based allocation market.
 *
 * Based on Alvin Roth's Nobel-winning matching market theory.
 * Each agent gets equal budget; allocation maximises aggregate preference
 * satisfaction subject to market-clearing via Walrasian tâtonnement.
 *
 * Parameters:
 *   agents      number of allocation participants (2–50)
 *   goods       number of distinct goods/resources (2–20)
 *   inequality  budget spread / wealth inequality index (0–1; 0 = perfectly equal)
 *   diversity   preference diversity across agents (0–1; 1 = fully heterogeneous)
 */
export function run_ceei_allocation_engine(agents: number, goods: number, inequality: number, diversity: number): string;

/**
 * Run the Chrono-Actuary deep-time audit engine.
 *
 * temp_c:        baseline water temperature °C          (default 15.0)
 * do_conc:       current DO concentration mg/L          (default 8.5)
 * bod_load:      initial BOD at discharge point mg/L    (default 5.0)
 * delta_t:       project thermal discharge delta °C     (default 2.0)
 * epi:           Eutrophication Potential Index         (default 0.8)
 * nitrate:       Nitrate-N concentration mg/L           (default 2.0)
 * flow_ratio:    Q_project / Q_mean_annual              (default 0.4)
 * lsi:           Langelier Saturation Index             (default 0.1)
 * license_years: permit duration — IPCC projection horizon (default 30.0)
 * human_profit:  reported project profit EUR            (default 1_000_000.0)
 */
export function run_chrono_actuary(temp_c: number, do_conc: number, bod_load: number, delta_t: number, epi: number, nitrate: number, flow_ratio: number, lsi: number, license_years: number, human_profit: number): string;

/**
 * Run a full ML-KEM-768 KEM round-trip and format as system kernel log.
 *
 * `reveal`:
 *   0 → decapsulation key (private) is redacted in output  [default]
 *   1 → private key is printed in full (WARNING display)
 *
 * The function always:
 *   1. Generates a fresh keypair via OS entropy
 *   2. Encapsulates a shared secret (simulates sender)
 *   3. Displays public key, ciphertext, and derived shared secret
 *   4. Conditionally displays the private decapsulation key
 */
export function run_classified(reveal: number): string;

export function run_cynic_realist(n_agents: number, temperature: number, coupling: number, steps: number): string;

/**
 * Run the soma_kernel_5.5 Daly Rules thermodynamic simulation.
 *
 * Integrates three coupled ODEs over `years` annual timesteps:
 *   1. Renewable resource stock  R(t)  — harvest vs regeneration
 *   2. Pollution accumulation    P(t)  — waste vs absorption
 *   3. Non-renewable reserves   NR(t)  — depletion vs substitution
 *
 * Entropy production follows irreversible thermodynamics (Prigogine):
 *   σ(t) = (C/G) · ln(C/G)   when C > G  (dissipation from overshoot)
 *
 * Parameters (all f64 for wasm-bindgen):
 *   consumption   GJ/capita/yr   (current global avg ~80; sustainable ~25–30)
 *   regeneration  GJ/capita/yr   (biosphere regen capacity ~30)
 *   waste         Mt CO₂eq/yr    (normalised; global ~55,000 Mt)
 *   absorption    Mt CO₂eq/yr    (natural sinks ~11,000 Mt)
 *   nr_depletion  fraction/yr    (fossil reserve draw-down rate; ~0.025)
 *   substitution  fraction/yr    (renewable substitution rate; ~0.008)
 *   years         simulation horizon (clamped 1–500)
 */
export function run_daly_thermo_simulation(consumption: number, regeneration: number, waste: number, absorption: number, nr_depletion: number, substitution: number, years: number): string;

/**
 * DH-EC Cryptographic Architecture Kernel.
 *
 * mode:
 *   0 = full comparison (all sections)
 *   1 = Classical DH only
 *   2 = Curve25519 ECDH only
 *   3 = Signal X3DH only
 *   4 = Threema NaCl only
 *   5 = Comparison matrix only
 *
 * show_details:
 *   0 = compact (keys abbreviated to 16 hex chars)
 *   1 = verbose (full 32-byte hex keys + analysis notes)
 */
export function run_dh_ec_kernel(mode: number, show_details: number): string;

export function run_evolutionary_replicator(benefit: number, cost: number, punishment: number, mutation: number, generations: number): string;

export function run_feigenbaum_cascade(r_start: number, r_end: number, warmup: number, samples: number): string;

/**
 * Fish Scale Kernel — Feigenbaum-Bouligand Coupled Architecture v12.1.0
 *
 * Maps the universal period-doubling cascade onto Bouligand helicoidal armor.
 * Computes armor density, saponification windows, sanctuary nodes, and
 * Moir\u{00E9} interference spectrum across the full bifurcation topology.
 *
 * Parameters:
 *   r_pressure       : thermodynamic pressure coefficient (0.0–4.0)
 *   max_layers       : maximum Bouligand armor layers to resolve (1–64)
 *   theta_offset     : interlaminar rotation angle in degrees (1–90, default 36)
 *   burn_sensitivity : saponification window width multiplier (0.1–2.0)
 */
export function run_fish_scale(r_pressure: number, max_layers: number, theta_offset: number, burn_sensitivity: number): string;

/**
 * Run the Fusion Plasma sovereign audit engine.
 *
 * temp_kev:       ion temperature in keV                  (default 10.0)
 * density:        electron density 10²⁰/m³                (default 1.0)
 * tau_e:          energy confinement time s                (default 3.7)
 * b_field:        toroidal magnetic field T                (default 5.3)
 * major_radius:   tokamak major radius R m                 (default 6.2)
 * minor_radius:   tokamak minor radius a m                 (default 2.0)
 * plasma_current: plasma current I_p MA                    (default 15.0)
 * input_power:    external heating power MW                (default 50.0)
 * elongation:     plasma elongation κ                      (default 1.7)
 * helium_fraction: He-4 ash fraction of total ion density  (default 0.05)
 */
export function run_fusion_plasma(temp_kev: number, density: number, tau_e: number, b_field: number, major_radius: number, minor_radius: number, plasma_current: number, input_power: number, elongation: number, helium_fraction: number): string;

export function run_ising_consensus(lattice_size: number, temperature: number, external_field: number, mc_steps: number): string;

export function run_kuramoto_synchrony(n_oscillators: number, coupling: number, freq_spread: number, timesteps: number): string;

/**
 * Latent Space Collider – SCALING Module v1.0.0
 *
 * Collides two conceptual domains in simulated 1536-dimensional latent space.
 * Computes cosine similarity, cross-attention, orthogonal projection, and
 * outputs a synthesized concept chimera.
 *
 * Parameters:
 *   domain_a      : index of first conceptual domain (0–15)
 *   domain_b      : index of second conceptual domain (0–15)
 *   attn_heads    : simulated attention head count (1–64, affects entropy)
 *   temperature   : softmax temperature – sharpness of conceptual focus (0.1–5.0)
 */
export function run_latent_collider(domain_a: number, domain_b: number, attn_heads: number, temperature: number): string;

/**
 * SCALAR SOVEREIGNTY + MESANTROPY ENGINE
 *
 * Simulates N agents through Substrate (3.3.3) and Detonation (4.4.4.4) phases.
 *
 * Parameters:
 *   solar_yield  : available scalar energy as fraction of Eigenverbrauch ceiling (0.0–1.0)
 *                  0.0 = off-grid scarcity, 1.0 = 364 kWh full Sorbe sovereignty
 *   signal_depth : RSSI signal depth in dBm-relative units (-1.0 = deep, 0.0 = shallow)
 *                  reflects "Am Sender 13" signal quality; affects agent coupling strength
 *   n_agents     : number of agents in the simulation field (7–144)
 */
export function run_mesantropy(solar_yield: number, signal_depth: number, n_agents: number): string;

/**
 * Resonance trace simulation — sweeps N injection cycles through the Fish Scale
 * entropic stasis field, modulating BPM via sin(r×7)×11 with LCG noise drift.
 *
 * Parameters:
 *   resonance_seed : initial resonance value, wraps mod 2π (0.0–6.28)
 *   n_cycles       : resonance injection cycles to trace (1–64)
 *   amplitude      : BPM modulation amplitude multiplier (0.1–3.0)
 */
export function run_necromantic_simulation(resonance_seed: number, n_cycles: number, amplitude: number): string;

/**
 * Panopticon Percolation Engine – SURVEILLANCE Module v1.0.0
 *
 * Monte Carlo simulation of dragnet contagion through 44 indexed
 * surveillance legislative instruments.
 *
 * Parameters:
 *   infection_prob : global infection probability multiplier (0.1–2.0)
 *   origin_node    : patient zero – starting legislative node (0–43)
 *   n_simulations  : Monte Carlo ensemble size (1–200)
 *   seed           : PRNG seed for reproducibility (any positive integer)
 */
export function run_panopticon_percolation(infection_prob: number, origin_node: number, n_simulations: number, seed: number): string;

export function run_percolation(n_nodes: number, mean_degree: number, attack_mode: number, removal_steps: number): string;

/**
 * Run the Phonemic Drift analysis.
 *
 * * `seed`        — PRNG seed (0 → uses internal default)
 * * `target`      — intended retrieval target: 0=Baudrillard 1=Bachelard 2=Abelard
 * * `drift_noise` — retrieval noise [0.0–1.0]; 0=clean semantic, 1=pure phonemic
 */
export function run_phonemic_drift(seed: number, target: number, drift_noise: number): string;

export function run_pqhash_analysis(input_bits: number, hash_bits: number, algorithm: number, quantum_adv: number): string;

/**
 * Dissipative Rust Kernel: Pragmatic<T> Type Demonstration
 *
 * Simulates N agents attempting computational tasks drawn from a power-law
 * cost distribution under a shared thermal budget. As budget depletes:
 *   Resolved → Synthetic → Dissolved
 *
 * Parameters:
 *   n_agents:       agents attempting resolution (4–128)
 *   thermal_budget: total energy available for all computations (10–10000)
 *   thermal_limit:  max cost for full-fidelity resolution (0.5–100)
 *   cost_exponent:  power-law exponent for task cost distribution (0.5–3.0)
 *                   lower = more extreme costs; higher = more uniform
 */
export function run_pragmatic_type(n_agents: number, thermal_budget: number, thermal_limit: number, cost_exponent: number): string;

export function run_seraphine_sarg(n_concepts: number, coherence: number, decoherence_rate: number, entanglement: number, steps: number): string;

/**
 * Simulates Soma Plus — the social capital / commons-contribution system
 * at the heart of soma_kernel_5.5's post-scarcity status economy.
 *
 * Agents earn Soma Plus by contributing to the commons:
 *   Ecological Care  (reforesting, biodiversity monitoring)
 *   Social Care      (child-rearing, elderly care, education, arts)
 *   Each contribution accrues SP; SP decays slowly without contribution.
 *
 * Status tiers: INITIATE → CONTRIBUTOR → ARTISAN → SOVEREIGN
 *
 * Parameters:
 *   population    number of agents (10–10000)
 *   eco_share     fraction of agents doing ecological care (0–1)
 *   social_share  fraction of agents doing social care (0–1)
 *   arts_share    fraction of agents doing arts/culture (0–1)
 *   years         simulation cycles (1–200)
 */
export function run_soma_plus_engine(population: number, eco_share: number, social_share: number, arts_share: number, years: number): string;

/**
 * Seven-Fold Crystalline Invariance Kernel
 *
 * Simulates the 4-phase progression of the SCALE_SYSTEM_KERNEL v7.7.7.7.7.7.7.
 * N oscillators advance through Substrate → Detonation → Superfluid → Crystalline.
 *
 * Parameters:
 *   n_oscillators : number of coupled oscillators to simulate (7–77)
 *   coupling_gain : multiplicative scaling on all coupling constants (0.5–3.0)
 *                   < 1.0 weakens lock, > 1.0 accelerates crystallisation
 *   entropy_seed  : deterministic seed for phase initialisation (0–999)
 *                   0 = maximal disorder, large values = partial pre-ordering
 */
export function run_sovereign_seven(n_oscillators: number, coupling_gain: number, entropy_seed: number): string;

export function run_spectral_bridge(threshold: number, max_bridges: number, detail: number): string;

/**
 * Simulates the Strangler Fig transition strategy — building the new economic
 * system around the old one until the new system dominates.
 *
 * Uses a modified logistic growth ODE with legacy system resistance:
 *   dA/dt = r·A·(1-A) - ρ(t)·A·(1-A)
 *         = A·(1-A)·(r - ρ(t))
 *
 * where ρ(t) = ρ₀·exp(-λ·t)  — resistance decays as legacy system weakens.
 *
 * Tipping point: when r > ρ(t), growth flips from negative to positive.
 * Critical mass:  A ≥ 0.5 (new system is majority)
 *
 * Parameters:
 *   initial_adoption  starting adoption fraction (0.001–0.5)
 *   growth_rate       logistic growth coefficient r (0.01–2.0)
 *   resistance        initial legacy resistance ρ₀ (0–2.0)
 *   years             simulation horizon (1–200)
 */
export function run_strangler_fig_transition(initial_adoption: number, growth_rate: number, resistance: number, years: number): string;

export function run_surveillance_index(region_code: number, category_code: number, threshold: number): string;

/**
 * Run the Tesseract-Vault 5-stage hybrid PQC pipeline.
 *
 * `verbose`:
 *   0 → truncated key material (first 8 bytes shown)  [default]
 *   1 → full 32-byte hex for master_key, shared_secret, and BLAKE3 hash
 */
export function run_tesseract_vault(verbose: number): string;

/**
 * Map free-form text to the 16D kernel fingerprint space.
 * Returns terminal output + DATA: JSON for the ArtTab probe node.
 */
export function run_text_probe(text: string): string;

/**
 * Encrypt arbitrary bytes with Argon2id KDF + AES-256-GCM + BLAKE3 seal.
 * Returns the TV1. binary envelope, or empty Vec on error.
 */
export function seal_markdown(plaintext: Uint8Array, passphrase: string): Uint8Array;

/**
 * Returns the SOMA-9.1 Gaia Build boot banner for the terminal kernel log.
 * No parameters. Static diagnostic — call on first CLI load to confirm
 * system readiness and log the kernel version to the SYSTEM LOG.
 */
export function soma_91_banner(): string;

/**
 * Autocomplete hint: single [verbose:0|1] parameter
 */
export function tesseract_vault_params(): Array<any>;

/**
 * Decrypt a TV1. envelope. Returns plaintext bytes, or empty Vec on any
 * failure (wrong passphrase, tampered ciphertext, invalid envelope).
 */
export function unseal_markdown(sealed: Uint8Array, passphrase: string): Uint8Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_biocoenosiskernel_free: (a: number, b: number) => void;
    readonly __wbg_grayscottkernel_free: (a: number, b: number) => void;
    readonly __wbg_necromanticengine_free: (a: number, b: number) => void;
    readonly __wbg_somakernel_free: (a: number, b: number) => void;
    readonly biocoenosiskernel_boot: () => [number, number];
    readonly biocoenosiskernel_get_entropy_index: (a: number) => number;
    readonly biocoenosiskernel_get_species_count: (a: number) => number;
    readonly biocoenosiskernel_new: () => number;
    readonly biocoenosiskernel_register_species: (a: number, b: number) => void;
    readonly boot_bosonic_lattice: (a: number, b: number, c: number, d: number) => [number, number];
    readonly boot_geopolitical_kinetics: (a: number, b: number, c: number) => [number, number];
    readonly boot_leviathan_benchmark: (a: number, b: number) => [number, number];
    readonly boot_soma55: () => [number, number];
    readonly boot_thermosphere_protocol: (a: number, b: number, c: number) => [number, number];
    readonly classified_params: () => any;
    readonly compare_nodes: (a: number, b: number) => [number, number];
    readonly compute_bifurcation_children: (a: number, b: number) => [number, number];
    readonly enclave_keygen: () => [number, number];
    readonly enclave_open: (a: number, b: number) => [number, number];
    readonly enclave_seal: (a: number, b: number) => [number, number];
    readonly grayscott_params: () => any;
    readonly grayscottkernel_compute_steps: (a: number, b: number, c: number, d: number) => [number, number];
    readonly grayscottkernel_new: () => number;
    readonly log_entropy_flush: () => [number, number];
    readonly necromanticengine_boot: () => [number, number];
    readonly necromanticengine_get_bpm: (a: number) => number;
    readonly necromanticengine_get_cycle: (a: number) => bigint;
    readonly necromanticengine_harmonic_result: (a: number) => [number, number];
    readonly necromanticengine_new: () => number;
    readonly necromanticengine_set_resonance: (a: number, b: number) => void;
    readonly run_associative_field: (a: number, b: number, c: number) => [number, number];
    readonly run_biocoenosis_simulation: (a: number, b: number, c: number) => [number, number];
    readonly run_bone_fusion: (a: number, b: number, c: number) => [number, number];
    readonly run_ceei_allocation_engine: (a: number, b: number, c: number, d: number) => [number, number];
    readonly run_chrono_actuary: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => [number, number];
    readonly run_classified: (a: number) => [number, number];
    readonly run_cynic_realist: (a: number, b: number, c: number, d: number) => [number, number];
    readonly run_daly_thermo_simulation: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number];
    readonly run_dh_ec_kernel: (a: number, b: number) => [number, number];
    readonly run_evolutionary_replicator: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly run_feigenbaum_cascade: (a: number, b: number, c: number, d: number) => [number, number];
    readonly run_fish_scale: (a: number, b: number, c: number, d: number) => [number, number];
    readonly run_fusion_plasma: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => [number, number];
    readonly run_ising_consensus: (a: number, b: number, c: number, d: number) => [number, number];
    readonly run_kuramoto_synchrony: (a: number, b: number, c: number, d: number) => [number, number];
    readonly run_latent_collider: (a: number, b: number, c: number, d: number) => [number, number];
    readonly run_mesantropy: (a: number, b: number, c: number) => [number, number];
    readonly run_necromantic_simulation: (a: number, b: number, c: number) => [number, number];
    readonly run_panopticon_percolation: (a: number, b: number, c: number, d: number) => [number, number];
    readonly run_percolation: (a: number, b: number, c: number, d: number) => [number, number];
    readonly run_phonemic_drift: (a: number, b: number, c: number) => [number, number];
    readonly run_pqhash_analysis: (a: number, b: number, c: number, d: number) => [number, number];
    readonly run_pragmatic_type: (a: number, b: number, c: number, d: number) => [number, number];
    readonly run_seraphine_sarg: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly run_soma_plus_engine: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly run_sovereign_seven: (a: number, b: number, c: number) => [number, number];
    readonly run_spectral_bridge: (a: number, b: number, c: number) => [number, number];
    readonly run_strangler_fig_transition: (a: number, b: number, c: number, d: number) => [number, number];
    readonly run_surveillance_index: (a: number, b: number, c: number) => [number, number];
    readonly run_tesseract_vault: (a: number) => [number, number];
    readonly run_text_probe: (a: number, b: number) => [number, number];
    readonly seal_markdown: (a: number, b: number, c: number, d: number) => [number, number];
    readonly soma_91_banner: () => [number, number];
    readonly somakernel_execute_cycle: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly somakernel_get_adoption: (a: number) => number;
    readonly somakernel_get_entropy: (a: number) => number;
    readonly somakernel_get_soma_plus: (a: number) => number;
    readonly somakernel_get_year: (a: number) => number;
    readonly somakernel_new: () => number;
    readonly somakernel_reset: (a: number) => void;
    readonly tesseract_vault_params: () => any;
    readonly unseal_markdown: (a: number, b: number, c: number, d: number) => [number, number];
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;

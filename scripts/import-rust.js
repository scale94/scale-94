#!/usr/bin/env node
/**
 * import-rust.js — Level 18: WASM Compiler
 *
 * Compiles content/rust_kernels/ with wasm-pack, copies the output into
 * public/wasm/, and generates src/terminal/data/wasm.generated.js — the
 * runtime registry that maps kernel article IDs to WASM module URLs.
 *
 * Prerequisites (install once):
 *   curl https://sh.rustup.rs -sSf | sh
 *   cargo install wasm-pack
 *
 * Usage:
 *   node scripts/import-rust.js           # build release
 *   node scripts/import-rust.js --dev     # build dev (unoptimised, faster)
 *   node scripts/import-rust.js --dry     # preview without compiling
 */

import fs            from 'fs';
import path          from 'path';
import crypto        from 'crypto';
import { execSync }  from 'child_process';
import { fileURLToPath } from 'url';
import { atomicWrite }   from './_build-utils.js';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const ROOT        = path.join(__dirname, '..');
const RUST_DIR    = path.join(ROOT, 'content', 'rust_kernels');
const PKG_DIR     = path.join(RUST_DIR, 'pkg');
const WASM_OUT    = path.join(ROOT, 'public', 'wasm');   // .wasm binary (static)
const JS_OUT      = path.join(ROOT, 'src', 'wasm');      // .js bindings (Vite-bundled)
const REGISTRY    = path.join(ROOT, 'src', 'wasm', 'wasm.generated.js');

const DRY_RUN       = process.argv.includes('--dry');
const DEV           = process.argv.includes('--dev');
// --registry-only: skip wasm-pack compile + artifact copy; only regenerate
// wasm.generated.js from KERNEL_MAP. Use after editing KERNEL_MAP without
// touching lib.rs (alias changes, param hints, new JS-only entries, etc.).
const REGISTRY_ONLY = process.argv.includes('--registry-only');

// ─── WASM KERNEL REGISTRY ─────────────────────────────────────────────────────
// Maps Soma article IDs → WASM module metadata.
// boot:   the static method that returns the kernel's initial diagnostic string.
// struct: the wasm-bindgen class name in the compiled JS bindings.

const KERNEL_MAP = [
  {
    // SOMA-9.1 Gaia Build banner — zero-parameter free function.
    // Returns the ascetic system kernel log banner with Ostrom Protocol status.
    // No flags needed: run soma91  |  run gaia  |  run banner
    id:      'SOMA-9.1-GAIA',
    fn:      'soma_91_banner',
    args:    [],
    argMap:  {},
    label:   'SOMA-9.1 // GAIA BUILD — system kernel log banner',
    type:    'rust',
    aliases: ['soma91', 'gaia', 'soma_91', 'soma91_banner', 'banner'],
  },
  {
    id:      'BIODIVERSITY-KERNEL-1.0.1',
    struct:  'BiocoenosisKernel',
    boot:    'boot',
    label:   'Biocoenosis Kernel v1.0.1',
    type:    'rust',
    aliases: ['biodiversity', 'biocoenosis'],
  },
  {
    id:      'FISH-SCALE-KERNEL11.1.1',
    struct:  'NecromanticEngine',
    boot:    'boot',
    label:   'Necromantic Engine v11.1.1',
    type:    'rust',
    aliases: ['fishscale', 'necromantic', 'fish'],
  },
  {
    // Free function export — uses fn/args/argMap pattern instead of struct/boot.
    id:      'BOSONIC-KERNEL-2.0',
    fn:      'boot_bosonic_lattice',
    args:    [0.8, 0.7],
    argMap:  { trust: 0, coupling: 0, price: 1, thermal: 1 },
    label:   'Bosonic Lattice Simulator v2.0',
    type:    'rust',
    aliases: ['bosonic_lattice', 'bosonic', 'bosonickernel', 'lattice'],
  },
  {
    // Climate thermodynamics engine — 3-parameter free function.
    // carbon_ppm:      args[0]  flags: --carbon, --ppm, --carbon-ppm
    // industrial_drag: args[1]  flags: --drag, --industrial, --industrial-drag
    // ocean_sink:      args[2]  flags: --sink, --ocean, --ocean-sink
    id:      'ATMOSPHERIC-ENTROPY-KERNEL-3.0',
    fn:      'boot_thermosphere_protocol',
    args:    [420.0, 2.5, 0.6],
    argMap:  { carbon: 0, ppm: 0, 'carbonppm': 0, drag: 1, industrial: 1, 'industrialdrag': 1, sink: 2, ocean: 2, 'oceansink': 2 },
    label:   'Atmospheric Entropy Kernel v3.0',
    type:    'rust',
    aliases: ['climate', 'thermosphere', 'entropy', 'atmospheric', 'thermosphere_protocol', 'carbon'],
  },
  {
    // Statecraft / regime-stability engine — 3-parameter free function.
    // sanction:    args[0]  flags: --sanction
    // grid:        args[1]  flags: --grid
    // propaganda:  args[2]  flags: --propaganda
    id:      'KINETIC-STATECRAFT-KERNEL-1.0',
    fn:      'boot_geopolitical_kinetics',
    args:    [6.0, 0.4, 0.7],
    argMap:  { sanction: 0, pressure: 0, grid: 1, resilience: 1, propaganda: 2, narrative: 2 },
    label:   'Kinetic Statecraft Kernel v1.0',
    type:    'rust',
    aliases: ['geopolitics', 'statecraft', 'kinetic', 'geopolitical', 'regime', 'kinetics'],
  },
  {
    // V-Cache cellular automata benchmark — 2-parameter free function.
    // grid_size:   args[0]  flags: --size, --grid-size
    // generations: args[1]  flags: --generations, --iters
    id:      'LEVIATHAN-CELLULAR-AUTOMATA',
    fn:      'boot_leviathan_benchmark',
    args:    [100000.0, 100.0],
    argMap:  { size: 0, 'gridsize': 0, cells: 0, generations: 1, iters: 1, steps: 1 },
    label:   'Leviathan Cellular Automata v1.0',
    type:    'rust',
    aliases: ['vcache_burn', 'leviathan', 'vcache', 'benchmark', 'stress', 'automata', 'cellular'],
  },

  // ── soma_kernel_5.5 Thermophysical Simulation Layer ────────────────────────
  {
    // SomaKernel LIVE — stateful multi-cycle interactive simulator.
    // Instantiated once with `new SomaKernel()`, then driven cycle-by-cycle
    // via execute_cycle(consumption, waste, nr_depletion, compliance_mod).
    // State (r_stock, p_stock, entropy, Soma Plus, Strangler Fig) persists
    // across all subsequent `run soma_live` calls in the same session.
    id:         'SOMA-KERNEL-LIVE',
    isStateful: true,
    struct:     'SomaKernel',
    cycle:      'execute_cycle',
    args:       [80.0, 55000.0, 0.025, 0.05],   // legacy-world defaults
    argMap: {
      consumption: 0, harvest: 0, c: 0,
      waste: 1, w: 1,
      depletion: 2, nr: 2, dep: 2, nrdepletion: 2,
      compliance: 3, trust: 3, ostrom: 3, mod: 3,
    },
    label:   'SomaKernel Live v5.5',
    type:    'rust',
    aliases: ['soma_live', 'soma_cycle', 'pilot', 'somapilot', 'soma_kernel_live'],
  },
  {
    // soma_kernel_5.5 top-level boot diagnostic — zero-parameter free function.
    // Runs a high-level status check across all four sub-systems at defaults.
    // No flags needed: run soma55
    id:      'SOMA-KERNEL-5.5',
    fn:      'boot_soma55',
    args:    [],
    argMap:  {},
    label:   'soma_kernel_5.5 v1.0',
    type:    'rust',
    aliases: ['soma55', 'soma_kernel', 'soma_kernel_55', 'sk55', 'soma_boot', 'nexteconomy'],
  },
  {
    // Daly Rules ODE simulation — 7-parameter free function.
    // Integrates renewable stock, pollution, non-renewable reserves over N years.
    // consumption:  args[0]   flags: --consumption, --consume
    // regeneration: args[1]   flags: --regeneration, --regen
    // waste:        args[2]   flags: --waste
    // absorption:   args[3]   flags: --absorption, --absorb
    // nr_depletion: args[4]   flags: --depletion, --nr
    // substitution: args[5]   flags: --substitution, --sub
    // years:        args[6]   flags: --years, --horizon
    id:      'DALY-THERMO-SIMULATION',
    fn:      'run_daly_thermo_simulation',
    args:    [80.0, 30.0, 55000.0, 11000.0, 0.025, 0.008, 100.0],
    argMap:  {
      consumption: 0, consume: 0,
      regeneration: 1, regen: 1,
      waste: 2,
      absorption: 3, absorb: 3,
      depletion: 4, nr: 4, nrdepletion: 4,
      substitution: 5, sub: 5,
      years: 6, horizon: 6,
    },
    params:  [
      { name: 'consumption',  default: 80.0,    desc: 'Renewable energy consumption GJ/capita/yr (global avg ~80; sustainable ~25)' },
      { name: 'regeneration', default: 30.0,    desc: 'Biosphere regeneration capacity GJ/capita/yr (~30)' },
      { name: 'waste',        default: 55000.0, desc: 'Global waste/pollution output Mt CO₂eq/yr (~55,000)' },
      { name: 'absorption',   default: 11000.0, desc: 'Natural sink absorption capacity Mt/yr (~11,000)' },
      { name: 'nr_depletion', default: 0.025,   desc: 'Non-renewable depletion rate fraction/yr (~0.025 = 2.5%/yr)' },
      { name: 'substitution', default: 0.008,   desc: 'Renewable substitution rate fraction/yr (~0.008 = 0.8%/yr)' },
      { name: 'years',        default: 100.0,   desc: 'Simulation horizon in years (1–500)' },
    ],
    label:   'Daly Thermo Simulation v1.0',
    type:    'rust',
    aliases: ['daly', 'thermo', 'thermodynamics', 'daly_rules', 'dalyrulessim', 'daly_thermo', 'ecological', 'entropy_econ'],
  },
  {
    // A-CEEI Allocation Engine — 4-parameter free function.
    // agents:     args[0]  flags: --agents, --n
    // goods:      args[1]  flags: --goods, --m
    // inequality: args[2]  flags: --inequality, --gini
    // diversity:  args[3]  flags: --diversity, --div
    id:      'CEEI-ALLOCATION-ENGINE',
    fn:      'run_ceei_allocation_engine',
    args:    [20.0, 8.0, 0.3, 0.7],
    argMap:  {
      agents: 0, n: 0,
      goods: 1, m: 1,
      inequality: 2, gini: 2, ineq: 2,
      diversity: 3, div: 3, pref: 3,
    },
    params:  [
      { name: 'agents',      default: 20.0, desc: 'Number of allocation participants (2–50)' },
      { name: 'goods',       default: 8.0,  desc: 'Number of distinct goods/resources (2–20)' },
      { name: 'inequality',  default: 0.3,  desc: 'Budget inequality index 0–1 (0 = equal incomes; 1 = maximally unequal)' },
      { name: 'diversity',   default: 0.7,  desc: 'Preference heterogeneity 0–1 (0 = uniform; 1 = fully diverse)' },
    ],
    label:   'A-CEEI Allocation Engine v1.0',
    type:    'rust',
    aliases: ['ceei', 'allocation', 'matching', 'market', 'roth', 'preference', 'allocation_engine', 'aceei'],
  },
  {
    // Soma Plus social capital accumulation — 5-parameter free function.
    // population:   args[0]  flags: --pop, --population
    // eco_share:    args[1]  flags: --eco
    // social_share: args[2]  flags: --social
    // arts_share:   args[3]  flags: --arts
    // years:        args[4]  flags: --years
    id:      'SOMA-PLUS-ENGINE',
    fn:      'run_soma_plus_engine',
    args:    [5000.0, 0.35, 0.35, 0.20, 50.0],
    argMap:  {
      population: 0, pop: 0,
      eco: 1, ecological: 1, ecoShare: 1,
      social: 2, socialShare: 2,
      arts: 3, artsShare: 3, culture: 3,
      years: 4, horizon: 4,
    },
    params:  [
      { name: 'population',   default: 5000.0, desc: 'Number of agents in the simulation (10–10000)' },
      { name: 'eco_share',    default: 0.35,   desc: 'Fraction doing ecological care 0–1 (reforesting, biodiversity)' },
      { name: 'social_share', default: 0.35,   desc: 'Fraction doing social care 0–1 (child-rearing, elderly, education)' },
      { name: 'arts_share',   default: 0.20,   desc: 'Fraction doing arts/culture 0–1 (highest Soma Plus multiplier)' },
      { name: 'years',        default: 50.0,   desc: 'Simulation cycles / years (1–200)' },
    ],
    label:   'Soma Plus Engine v1.0',
    type:    'rust',
    aliases: ['soma_plus', 'somaplus', 'social_capital', 'commons_engine', 'status', 'contribution'],
  },
  {
    // ── ADVANCED DYNAMICS LAYER — Ars Electronica 2027 ──────────────────────

    // Kuramoto Synchrony Engine — 4-parameter free function.
    // n_oscillators: args[0]  flags: --n, --oscillators, --agents
    // coupling:      args[1]  flags: --coupling, --k
    // freq_spread:   args[2]  flags: --sigma, --spread, --diversity
    // timesteps:     args[3]  flags: --steps, --time, --t
    id:      'KURAMOTO-SYNCHRONY',
    fn:      'run_kuramoto_synchrony',
    args:    [50.0, 1.5, 1.0, 500.0],
    argMap:  {
      n: 0, oscillators: 0, agents: 0,
      coupling: 1, k: 1,
      sigma: 2, spread: 2, diversity: 2,
      steps: 3, time: 3, t: 3,
    },
    params: [
      { name: 'n_oscillators', default: 50.0,  desc: 'agents in the collective field — from trio to crowd (3–100)' },
      { name: 'coupling',      default: 1.5,   desc: 'K: global solidarity strength — 0=isolation, K_c≈1.6σ=lock (0–10)' },
      { name: 'freq_spread',   default: 1.0,   desc: 'σ: natural frequency diversity — heterogeneity of desire (0.01–5)' },
      { name: 'timesteps',     default: 500.0, desc: 'integration depth — how long the field evolves (50–2000)' },
    ],
    label:   'Kuramoto Synchrony Engine v1.0',
    type:    'rust',
    aliases: ['kuramoto', 'synchrony', 'sync', 'oscillator', 'solidarity', 'phase', 'coupled'],
  },
  {
    // Evolutionary Replicator Dynamics — 5-parameter free function.
    // benefit:     args[0]  flags: --benefit, --b
    // cost:        args[1]  flags: --cost, --c
    // punishment:  args[2]  flags: --punishment, --p
    // mutation:    args[3]  flags: --mutation, --mu
    // generations: args[4]  flags: --generations, --gen, --time
    id:      'EVOLUTIONARY-REPLICATOR',
    fn:      'run_evolutionary_replicator',
    args:    [2.0, 1.0, 1.5, 0.005, 300.0],
    argMap:  {
      benefit: 0, b: 0,
      cost: 1, c: 1,
      punishment: 2, p: 2,
      mutation: 3, mu: 3,
      generations: 4, gen: 4, time: 4,
    },
    params: [
      { name: 'benefit',     default: 2.0,   desc: 'b: value generated by cooperation — what the commons is worth (0.1–5)' },
      { name: 'cost',        default: 1.0,   desc: 'c: personal sacrifice of contributing — threshold of altruism (0–3)' },
      { name: 'punishment',  default: 1.5,   desc: 'p: altruist enforcement cost on defectors — Ostrom sanctions (0–3)' },
      { name: 'mutation',    default: 0.005, desc: 'μ: evolutionary noise — rate of strategy drift between types (0–0.5)' },
      { name: 'generations', default: 300.0, desc: 'T: evolutionary time — how long the game runs (50–2000)' },
    ],
    label:   'Evolutionary Replicator Dynamics v1.0',
    type:    'rust',
    aliases: ['replicator', 'evolutionary', 'gametheory', 'commons', 'cooperate', 'defect', 'altruist', 'ostrom_game'],
    // 'commons' kept here — replicator dynamics IS the commons dilemma game
  },
  {
    // Ising Consensus Field — 4-parameter free function.
    // lattice_size:   args[0]  flags: --size, --n, --grid
    // temperature:    args[1]  flags: --temp, --t, --temperature
    // external_field: args[2]  flags: --field, --h, --narrative
    // mc_steps:       args[3]  flags: --sweeps, --steps, --mc
    id:      'ISING-CONSENSUS-FIELD',
    fn:      'run_ising_consensus',
    args:    [20.0, 2.5, 0.0, 100.0],
    argMap:  {
      size: 0, n: 0, grid: 0,
      temp: 1, t: 1, temperature: 1,
      field: 2, h: 2, narrative: 2,
      sweeps: 3, steps: 3, mc: 3,
    },
    params: [
      { name: 'lattice_size',   default: 20.0,  desc: 'N: agents per side of opinion grid — N² total (4–40)' },
      { name: 'temperature',    default: 2.5,   desc: 'kT/J: social temperature — noise in conformity, T_c≈2.269 (0.1–10)' },
      { name: 'external_field', default: 0.0,   desc: 'h: external narrative force — ideological field, 0=symmetric (−3 to 3)' },
      { name: 'mc_steps',       default: 100.0, desc: 'Monte Carlo sweeps — time for consensus to emerge (10–500)' },
    ],
    label:   'Ising Consensus Field v1.0',
    type:    'rust',
    aliases: ['ising', 'consensus', 'opinion', 'phase_transition', 'ferromagnet', 'critical', 'monte_carlo'],
  },
  {
    // Feigenbaum Cascade Analysis — 4-parameter free function.
    // r_start: args[0]  flags: --start, --r0
    // r_end:   args[1]  flags: --end, --r1
    // warmup:  args[2]  flags: --warmup, --transient
    // samples: args[3]  flags: --samples, --s
    id:      'FEIGENBAUM-CASCADE',
    fn:      'run_feigenbaum_cascade',
    args:    [2.8, 4.0, 200.0, 100.0],
    argMap:  {
      start: 0, r0: 0,
      end: 1, r1: 1,
      warmup: 2, transient: 2,
      samples: 3, s: 3,
    },
    params: [
      { name: 'r_start', default: 2.8,   desc: 'growth parameter scan start — 3.0=period-2, 3.45=period-4 (0–4)' },
      { name: 'r_end',   default: 4.0,   desc: 'growth parameter scan end — 3.5699=onset of chaos, 4.0=max (0–4)' },
      { name: 'warmup',  default: 200.0, desc: 'transient iterations to discard before measuring (50–2000)' },
      { name: 'samples', default: 100.0, desc: 'attractor samples per r value — density of bifurcation diagram (20–500)' },
    ],
    label:   'Feigenbaum Cascade Analysis v1.0',
    type:    'rust',
    aliases: ['feigenbaum', 'bifurcation', 'chaos', 'logistic', 'cascade', 'period_doubling', 'logistic_map'],
  },
  {
    // Strangler Fig Transition Protocol — 4-parameter free function.
    // initial_adoption: args[0]  flags: --adoption, --seed
    // growth_rate:      args[1]  flags: --growth, --rate
    // resistance:       args[2]  flags: --resistance, --rho
    // years:            args[3]  flags: --years
    id:      'STRANGLER-FIG-PROTOCOL',
    fn:      'run_strangler_fig_transition',
    args:    [0.02, 0.18, 0.25, 75.0],
    argMap:  {
      adoption: 0, seed: 0, initial: 0,
      growth: 1, rate: 1, r: 1,
      resistance: 2, rho: 2, legacy: 2,
      years: 3, horizon: 3,
    },
    params:  [
      { name: 'initial_adoption', default: 0.02, desc: 'Starting adoption fraction 0–1 (e.g. 0.02 = 2% early adopters)' },
      { name: 'growth_rate',      default: 0.18, desc: 'Logistic growth coefficient r (0.01–2.0; higher = faster spread)' },
      { name: 'resistance',       default: 0.25, desc: 'Initial legacy system resistance ρ₀ (0–2.0; decays at λ=5%/yr)' },
      { name: 'years',            default: 75.0, desc: 'Simulation horizon in years (1–200)' },
    ],
    label:   'Strangler Fig Protocol v1.0',
    type:    'rust',
    aliases: ['strangler', 'transition', 'stranglerfig', 'fig', 'adoption', 'legacy', 'logistic_transition'],
  },
  {
    // Surveillance Index — grey-c0 / Navigators Guild dataset (44 laws, 14 jurisdictions)
    // region_code:   0=ALL 1=UK 2=EU 3=US 4=AU 5=CA 6=DE 7=FR 8=SE 9=IE 10=NL 11=NZ 12=BE
    // category_code: 0=ALL 1=encryption_backdoor 2=digital_id 3=biometric_collection
    //                4=data_retention 5=worker_surveillance 6=platform_mandated_scanning
    //                7=traffic_retention 8=age_verification
    // threshold:     0–5 (minimum severity; 0 = all entries)
    id:     'SURVEILLANCE-INDEX-1.0',
    fn:     'run_surveillance_index',
    args:   [0, 0, 0],
    argMap: {
      region: 0, r: 0,
      category: 1, cat: 1, c: 1,
      threshold: 2, t: 2, sev: 2, severity: 2, min: 2,
    },
    params: [
      { name: 'region_code',   default: 0, desc: 'jurisdiction filter: 0=ALL 1=UK 2=EU 3=US 4=AU 5=CA 6=DE 7=FR 8=SE 9=IE 10=NL 11=NZ 12=BE' },
      { name: 'category_code', default: 0, desc: 'threat category: 0=ALL 1=encryption_backdoor 2=digital_id 3=biometric 4=data_retention 5=worker 6=scanning 7=traffic 8=age_verify' },
      { name: 'threshold',     default: 0, desc: 'minimum severity filter 0–5 (0=all, 3=elevated+, 5=critical only)' },
    ],
    label:   'Surveillance Index v1.0',
    type:    'rust',
    aliases: ['surveillance', 'panopticon', 'legislation', 'governance', 'surveillance_index', 'law', 'laws', 'grey', 'greyc0'],
  },
  {
    // Gray-Scott Reaction-Diffusion PDE — stateful WASM kernel.
    // Stateful: constructed once with new GrayScottKernel(), driven via compute_steps.
    // feed:   args[0]  flags: --feed, --f, --feed_rate
    // kill:   args[1]  flags: --kill, --k, --kill_rate
    // frames: args[2]  flags: --frames, --steps, --n
    id:         'GRAY-SCOTT-REACTION-DIFFUSION',
    isStateful: true,
    struct:     'GrayScottKernel',
    cycle:      'compute_steps',
    args:       [0.055, 0.062, 50],
    argMap: {
      feed: 0, f: 0, feed_rate: 0,
      kill: 1, k: 1, kill_rate: 1,
      frames: 2, steps: 2, n: 2,
    },
    params: [
      { name: 'feed_rate', default: 0.055, desc: 'feed rate f — replenishes u; presets: coral=0.037, spots=0.055, mazes=0.029, solitons=0.025' },
      { name: 'kill_rate', default: 0.062, desc: 'kill rate k — removes v; presets: coral=0.065, spots=0.062, mazes=0.057, solitons=0.060' },
      { name: 'frames',    default: 50,    desc: 'animation frames to compute — each frame = 10 PDE integration steps (1–500)' },
    ],
    label:   'Gray-Scott Reaction-Diffusion v1.0',
    type:    'rust',
    aliases: ['grayscott', 'gray_scott', 'reaction_diffusion', 'turing', 'morphogenesis', 'pde', 'diffusion'],
  },
  {
    // Cynic Realist Dissipative Adaptation Engine — 4-parameter free function.
    // Stochastic Kuramoto-England hybrid: dθ_i/dt = ω_i + K·r·sin(ψ−θ_i) + √(2T)·η_i(t)
    // n_agents:    args[0]  flags: --n_agents, --n, --agents
    // temperature: args[1]  flags: --temperature, --temp, --t
    // coupling:    args[2]  flags: --coupling, --k
    // steps:       args[3]  flags: --steps, --iters
    id:      'CYNIC-REALIST-KERNEL-1.0',
    fn:      'run_cynic_realist',
    args:    [24.0, 1.0, 3.0, 600.0],
    argMap:  {
      n_agents: 0, n: 0, agents: 0,
      temperature: 1, temp: 1, t: 1,
      coupling: 2, k: 2,
      steps: 3, iters: 3,
    },
    params: [
      { name: 'n_agents',    default: 24.0,  desc: 'N: cognitive subsystems — stochastic oscillators in the field (4–64)' },
      { name: 'temperature', default: 1.0,   desc: 'T: evolutionary temperature — stochasticity of adaptation (0.05–5.0)' },
      { name: 'coupling',    default: 3.0,   desc: 'K: interaction coupling constant — solidarity strength (0.0–20.0)' },
      { name: 'steps',       default: 600.0, desc: 'Euler integration steps, dt=0.05 — depth of adaptation (50–1500)' },
    ],
    label:   'Cynic Realist Dissipative Adaptation Engine v1.0',
    type:    'rust',
    aliases: ['cynicrealist', 'cynic_realist', 'dissipative', 'england', 'kuramoto_england', 'sloterdijk'],
  },
  {
    // ML-KEM-768 Post-Quantum Key Encapsulation — FIPS 203.
    // Generates a fresh keypair via OS entropy, encapsulates a shared secret.
    // reveal: args[0]  flags: --reveal, --r, --show, --expose
    //   0 = private key redacted [default]
    //   1 = private key printed in full (WARNING)
    id:      'ML-KEM-CLASSIFIED',
    fn:      'run_classified',
    args:    [0],
    argMap:  { reveal: 0, r: 0, show: 0, expose: 0 },
    params:  [
      { name: 'reveal', default: 0, desc: 'reveal private decapsulation key: 0=redacted (default), 1=expose full key in log (WARNING)' },
    ],
    label:   'ML-KEM-768 Classified v1.0',
    type:    'rust',
    aliases: ['classified', 'mlkem', 'ml_kem', 'pqc', 'postquantum', 'kem', 'lattice_crypto', 'fips203', 'quantum_crypto'],
  },
  {
    // DRK Pragmatic<T> — Dissipative Rust Kernel foundational type system.
    // Simulates N agents resolving tasks under thermal budget constraints.
    // Demonstrates: Resolved/Synthetic/Dissolved outcomes, chain degradation,
    // fidelity distribution, thermal efficiency.
    // n_agents:       args[0]  flags: --n, --agents
    // thermal_budget: args[1]  flags: --budget, --energy
    // thermal_limit:  args[2]  flags: --limit, --threshold
    // cost_exponent:  args[3]  flags: --alpha, --exponent
    id:      'DRK-PRAGMATIC-TYPE-1.0',
    fn:      'run_pragmatic_type',
    args:    [32.0, 500.0, 10.0, 1.5],
    argMap:  {
      n: 0, agents: 0, n_agents: 0,
      budget: 1, energy: 1, thermal_budget: 1,
      limit: 2, threshold: 2, thermal_limit: 2,
      alpha: 3, exponent: 3, cost_exponent: 3,
    },
    params: [
      { name: 'n_agents',       default: 32.0,  desc: 'N: agents attempting resolution tasks (4–128)' },
      { name: 'thermal_budget', default: 500.0, desc: 'total energy for all computations — shared thermal reservoir (10–10000)' },
      { name: 'thermal_limit',  default: 10.0,  desc: 'max cost for full-fidelity Resolved outcome (0.5–100)' },
      { name: 'cost_exponent',  default: 1.5,   desc: 'α: power-law exponent for task cost distribution — lower = more extreme tails (0.5–3.0)' },
    ],
    label:   'DRK Pragmatic<T> Type System v1.0',
    type:    'rust',
    aliases: ['pragmatic', 'pragmatic_type', 'drk', 'drk_pragmatic', 'thermal_resolve', 'pragmatict'],
  },
  {
    // DH-EC Cryptographic Architecture Kernel — compiled in WASM binary via mod.rs,
    // now registered. Classical DH · ECDH Curve25519 · Signal X3DH · Threema NaCl.
    // mode:         args[0]  0=ALL 1=classical_dh 2=ecdh 3=x3dh_signal 4=threema_nacl 5=comparison
    // show_details: args[1]  0=compact 1=verbose (full 32-byte hex + analysis notes)
    id:      'DH-EC-KERNEL-1.0',
    fn:      'run_dh_ec_kernel',
    args:    [0.0, 0.0],
    argMap:  {
      mode: 0, m: 0,
      show: 1, details: 1, showdetails: 1, verbose: 1,
    },
    params: [
      { name: 'mode',         default: 0.0, desc: '0=ALL · 1=classical_dh · 2=ecdh_curve25519 · 3=x3dh_signal · 4=threema_nacl · 5=comparison' },
      { name: 'show_details', default: 0.0, desc: '0=compact (keys abbreviated) · 1=verbose (full 32-byte hex + analysis notes)' },
    ],
    label:   'DH/EC Cryptographic Architecture Kernel v1.0',
    type:    'rust',
    aliases: ['dh_ec', 'diffie', 'ecdh', 'curve25519', 'x3dh', 'signal_proto', 'threema', 'nacl'],
  },
  {
    // Chrono-Actuary v2.0.0 — Deep-Time Audit Framework · River Sovereign
    // Five modules: DO Ledger (Garcia-Benson + Streeter-Phelps), Thermal Rent
    // (Q10 + IPCC AR6), Nutrient Debt (EPI + Redfield), Hydraulic Sovereignty
    // (Tennant), Langelier Saturation Index. Permit ruling from aggregate.
    //
    // temp_c:        args[0]  flags: --temp, --temperature
    // do_conc:       args[1]  flags: --do, --oxygen, --dissolved-oxygen
    // bod_load:      args[2]  flags: --bod, --bod-load
    // delta_t:       args[3]  flags: --dt, --delta-t, --thermal
    // epi:           args[4]  flags: --epi, --eutrophication
    // nitrate:       args[5]  flags: --nitrate, --no3
    // flow_ratio:    args[6]  flags: --flow, --flow-ratio
    // lsi:           args[7]  flags: --lsi, --langelier
    // license_years: args[8]  flags: --years, --license
    // human_profit:  args[9]  flags: --profit, --eur
    id:      'CHRONO-ACTUARY-KERNEL-2.0',
    fn:      'run_chrono_actuary',
    args:    [15.0, 8.5, 5.0, 2.0, 0.8, 2.0, 0.4, 0.1, 30.0, 1_000_000.0],
    argMap:  {
      temp: 0, temperature: 0,
      do: 1, oxygen: 1, dissolvedoxygen: 1,
      bod: 2, bodload: 2,
      dt: 3, deltat: 3, thermal: 3,
      epi: 4, eutrophication: 4,
      nitrate: 5, no3: 5,
      flow: 6, flowratio: 6,
      lsi: 7, langelier: 7,
      years: 8, license: 8,
      profit: 9, eur: 9,
    },
    params: [
      { name: 'temp_c',        default: 15.0,        desc: 'baseline water temperature °C (cold: 5–10, temperate: 15, stressed: 25–30)' },
      { name: 'do_conc',       default: 8.5,         desc: 'current DO mg/L (full: >8, stressed: 6–8, hypoxic: <4)' },
      { name: 'bod_load',      default: 5.0,         desc: 'initial BOD at discharge point mg/L (clean: <2, impacted: 5–20)' },
      { name: 'delta_t',       default: 2.0,         desc: 'thermal discharge delta °C (arson threshold: >5°C sustained)' },
      { name: 'epi',           default: 0.8,         desc: 'Eutrophication Potential Index (capacity: <1, onset: 1–2, collapse: >5)' },
      { name: 'nitrate',       default: 2.0,         desc: 'Nitrate-N mg/L (pristine: <1, WHO limit: 11.3, toxic asset: >11.3)' },
      { name: 'flow_ratio',    default: 0.4,         desc: 'Q/Qmean — project flow as fraction of mean annual (bankrupt: <0.1, viable: 0.3–0.6)' },
      { name: 'lsi',           default: 0.1,         desc: 'Langelier Saturation Index (equilibrium: ±0.5, veto: <-1.0)' },
      { name: 'license_years', default: 30.0,        desc: 'permit duration years — IPCC AR6 end-of-license projection horizon' },
      { name: 'human_profit',  default: 1_000_000.0, desc: 'reported project profit EUR — measured against ecological debt' },
    ],
    label:   'Chrono-Actuary Kernel v2.0.0',
    type:    'rust',
    aliases: ['chrono', 'actuary', 'chrono_actuary', 'river', 'river_sovereign', 'aqua', 'protocol_aqua', 'audit', 'ecological_audit', 'do_ledger'],
  },
  {
    // run_fusion_plasma — Fusion Plasma Kernel v1.0.0
    // Plasma Sovereignty Audit · Lawson Criterion · Q-Factor Ledger
    //
    // Five modules:
    //   01 · Lawson Triple Product     n×T×τ_E ignition criterion
    //   02 · Fusion Power & Q-Factor   P_fusion, P_alpha, Bremsstrahlung, Q
    //   03 · Plasma Stability Ledger   β_N Troyon limit + Greenwald density
    //   04 · Confinement Audit         IPB98(y,2) empirical scaling, H-factor
    //   05 · Fuel Purity & Wall Load   He-4 ash dilution + neutron wall loading
    //
    // \ temp_kev:        args[0]  flags: --temp, --temperature, --kev
    // \ density:         args[1]  flags: --density, --ne, --n
    // \ tau_e:           args[2]  flags: --tau, --taue, --confinement
    // \ b_field:         args[3]  flags: --field, --bfield, --bt
    // \ major_radius:    args[4]  flags: --r, --major, --radius
    // \ minor_radius:    args[5]  flags: --a, --minor
    // \ plasma_current:  args[6]  flags: --ip, --current
    // \ input_power:     args[7]  flags: --power, --pext, --heating
    // \ elongation:      args[8]  flags: --kappa, --elongation, --shape
    // \ helium_fraction: args[9]  flags: --he, --helium, --ash
    id:      'FUSION-PLASMA-KERNEL-1.0',
    fn:      'run_fusion_plasma',
    args:    [10.0, 1.0, 3.7, 5.3, 6.2, 2.0, 15.0, 50.0, 1.7, 0.05],
    argMap:  {
      temp: 0, temperature: 0, kev: 0,
      density: 1, ne: 1, n: 1,
      tau: 2, taue: 2, confinement: 2,
      field: 3, bfield: 3, bt: 3,
      r: 4, major: 4, radius: 4,
      a: 5, minor: 5,
      ip: 6, current: 6,
      power: 7, pext: 7, heating: 7,
      kappa: 8, elongation: 8, shape: 8,
      he: 9, helium: 9, ash: 9,
    },
    params: [
      { name: 'temp_kev',        default: 10.0,  desc: 'ion temperature keV — ITER Q=10 point: 10 keV, pilot plant: 15-20 keV' },
      { name: 'density',         default: 1.0,   desc: 'electron density 10²⁰/m³ — ITER: ~1.0, Greenwald limit typically ~1.2' },
      { name: 'tau_e',           default: 3.7,   desc: 'energy confinement time s — ITER design: 3.7 s (H=1.0 at Q=10)' },
      { name: 'b_field',         default: 5.3,   desc: 'toroidal magnetic field T — ITER: 5.3 T, compact designs: 7-12 T' },
      { name: 'major_radius',    default: 6.2,   desc: 'tokamak major radius R m — ITER: 6.2 m' },
      { name: 'minor_radius',    default: 2.0,   desc: 'tokamak minor radius a m — ITER: 2.0 m' },
      { name: 'plasma_current',  default: 15.0,  desc: 'plasma current I_p MA — ITER: 15 MA; sets Greenwald limit' },
      { name: 'input_power',     default: 50.0,  desc: 'external heating power MW — ITER NBI+ECRH+ICRH: 50 MW' },
      { name: 'elongation',      default: 1.7,   desc: 'plasma elongation κ — ITER: 1.7; increases β_N limit' },
      { name: 'helium_fraction', default: 0.05,  desc: 'He-4 ash fraction of total ion density — crisis threshold: 0.10' },
    ],
    label:   'Fusion Plasma Kernel v1.0.0',
    type:    'rust',
    aliases: ['fusion', 'plasma', 'tokamak', 'ignition', 'lawson', 'iter', 'fusion_plasma', 'q_factor', 'triple_product'],
  },
  {
    // Seraphine Associative Reasoning Gain — 5-parameter free function.
    // Models quantum cognitive coherence via Lindblad dephasing on a density matrix.
    // Computes l1-norm coherence, Von Neumann entropy, and SARG score over time.
    // n_concepts:       args[0]  flags: --n, --concepts, --dim
    // coherence:        args[1]  flags: --coherence, --c0, --coh
    // decoherence_rate: args[2]  flags: --gamma, --decohere, --decay
    // entanglement:     args[3]  flags: --entanglement, --ent, --lambda
    // steps:            args[4]  flags: --steps, --time, --t
    id:      'SERAPHINE-SARG-1.0',
    fn:      'run_seraphine_sarg',
    args:    [4.0, 0.85, 0.15, 0.60, 20.0],
    argMap:  {
      n: 0, concepts: 0, dim: 0,
      coherence: 1, c0: 1, coh: 1,
      gamma: 2, decohere: 2, decay: 2, decoherence: 2,
      entanglement: 3, ent: 3, lambda: 3,
      steps: 4, time: 4, t: 4,
    },
    params: [
      { name: 'n_concepts',       default: 4.0,  desc: 'Hilbert space dimension — concept nodes in reasoning graph (2–6)' },
      { name: 'coherence',        default: 0.85, desc: 'c₀: initial off-diagonal coherence strength [0, 1)' },
      { name: 'decoherence_rate', default: 0.15, desc: 'γ: Lindblad dephasing rate per step — environment noise [0, 2]' },
      { name: 'entanglement',     default: 0.60, desc: 'λ_e: inter-concept entanglement boost on SARG score [0, 1]' },
      { name: 'steps',            default: 20.0, desc: 'time evolution steps (5–50)' },
    ],
    label:   'Seraphine SARG v1.0',
    type:    'rust',
    aliases: ['seraphine', 'sarg', 'quantum_reasoning', 'qcog', 'seraph', 'assoc', 'decohere', 'reasoning_gain'],
  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`  ${msg}`);
}

// Copy a file only if it exists in PKG_DIR.
function copyPkgFile(filename) {
  const src  = path.join(PKG_DIR, filename);
  const dest = path.join(WASM_OUT, filename);
  if (!fs.existsSync(src)) {
    console.warn(`  ⚠ Not found in pkg/: ${filename}`);
    return false;
  }
  fs.copyFileSync(src, dest);
  log(`✓ Copied → public/wasm/${filename}`);
  return true;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

function run() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║  RUST IMPORT — LEVEL 18: WASM COMPILER     ║');
  console.log('╚════════════════════════════════════════════╝\n');

  if (DRY_RUN)       log('[DRY RUN — wasm-pack will not be invoked]\n');
  if (REGISTRY_ONLY) log('[REGISTRY_ONLY — skipping wasm-pack build and artifact copy]\n');

  if (!REGISTRY_ONLY) {
    if (!fs.existsSync(RUST_DIR)) {
      console.error(`  ✗ Rust kernel directory not found: ${RUST_DIR}`);
      process.exit(1);
    }
    if (!fs.existsSync(path.join(RUST_DIR, 'Cargo.toml'))) {
      console.error(`  ✗ No Cargo.toml in ${RUST_DIR}`);
      process.exit(1);
    }
  }

  // ── Step 1: Compile with wasm-pack ──────────────────────────────────────────
  if (DRY_RUN && !REGISTRY_ONLY) {
    log('[DRY] Would run: wasm-pack build --target web --release');
  } else if (!DRY_RUN && !REGISTRY_ONLY) {
    const profile = DEV ? '' : '--release';
    const cmd     = `wasm-pack build --target web ${profile}`.trim();
    log(`Running: ${cmd}`);
    log(`CWD:     ${RUST_DIR}\n`);

    try {
      execSync(cmd, { cwd: RUST_DIR, stdio: 'inherit' });
    } catch (err) {
      console.error('\n  ✗ wasm-pack build failed. Is wasm-pack installed?');
      console.error('    Install: cargo install wasm-pack');
      process.exit(1);
    }

    log('\n  wasm-pack build completed.');
  }

  // ── Step 2: Copy output artifacts ───────────────────────────────────────────
  //   .wasm binary  → public/wasm/   (served as a static asset)
  //   .js bindings  → src/wasm/      (bundled by Vite so dynamic import() works)
  if (DRY_RUN && !REGISTRY_ONLY) {
    log('[DRY] Would copy scale94_kernels_bg.wasm → public/wasm/');
    log('[DRY] Would copy scale94_kernels.js      → src/wasm/');
  } else if (!DRY_RUN && !REGISTRY_ONLY) {
    if (!fs.existsSync(WASM_OUT)) fs.mkdirSync(WASM_OUT, { recursive: true });
    if (!fs.existsSync(JS_OUT))   fs.mkdirSync(JS_OUT,   { recursive: true });

    // Copy WASM binary to public/wasm/ (stays static, served by Vite/CDN)
    const wasmOk = copyPkgFile('scale94_kernels_bg.wasm');
    log(wasmOk ? '  → public/wasm/scale94_kernels_bg.wasm' : '  ⚠ WASM binary missing');

    // Copy JS bindings to src/wasm/ (Vite processes these as proper ES modules)
    const jsSrc  = path.join(PKG_DIR, 'scale94_kernels.js');
    const jsDest = path.join(JS_OUT,  'scale94_kernels.js');
    if (fs.existsSync(jsSrc)) {
      fs.copyFileSync(jsSrc, jsDest);
      log(`✓ Copied → src/wasm/scale94_kernels.js`);
    } else {
      console.warn('  ⚠ Not found in pkg/: scale94_kernels.js');
    }
    log('');
  }

  // ── Step 3: Generate wasm.generated.js registry ─────────────────────────────
  const moduleUrl = '/wasm/scale94_kernels.js';

  // Append a content hash to the wasmUrl so browsers always fetch the latest
  // binary after a rebuild instead of serving a stale cached version.
  const wasmBinPath = path.join(WASM_OUT, 'scale94_kernels_bg.wasm');
  let wasmHash = '';
  if (fs.existsSync(wasmBinPath)) {
    wasmHash = crypto.createHash('sha256').update(fs.readFileSync(wasmBinPath)).digest('hex').slice(0, 8);
  }
  const wasmUrl = `/wasm/scale94_kernels_bg.wasm${wasmHash ? `?v=${wasmHash}` : ''}`;

  const entries = KERNEL_MAP.map(k => {
    const lines = [`  ${JSON.stringify(k.id)}: {`, `    id:      ${JSON.stringify(k.id)},`];
    if (k.isStateful) {
      lines.push(`    isStateful: true,`);
      lines.push(`    struct:  ${JSON.stringify(k.struct)},`);
      lines.push(`    cycle:   ${JSON.stringify(k.cycle)},`);
      lines.push(`    args:    ${JSON.stringify(k.args ?? [])},`);
      lines.push(`    argMap:  ${JSON.stringify(k.argMap ?? {})},`);
    } else if (k.fn) {
      lines.push(`    fn:      ${JSON.stringify(k.fn)},`);
      lines.push(`    args:    ${JSON.stringify(k.args ?? [])},`);
      lines.push(`    argMap:  ${JSON.stringify(k.argMap ?? {})},`);
    } else {
      lines.push(`    struct:  ${JSON.stringify(k.struct)},`);
      lines.push(`    boot:    ${JSON.stringify(k.boot)},`);
    }
    lines.push(`    label:   ${JSON.stringify(k.label)},`);
    lines.push(`    type:    'rust',`);
    lines.push(`    module:  ${JSON.stringify(moduleUrl)},`);
    lines.push(`    wasmUrl: ${JSON.stringify(wasmUrl)},`);
    if (k.aliases?.length) lines.push(`    aliases: ${JSON.stringify(k.aliases)},`);
    // params — required by frontend param-hinting and --help formatter
    if (k.params?.length)  lines.push(`    params:  ${JSON.stringify(k.params)},`);
    lines.push(`  }`);
    return lines.join('\n');
  });

  const src = [
    '// wasm.generated.js — DO NOT EDIT MANUALLY.',
    '// Generated by: node scripts/import-rust.js — Level 18: WASM Compiler',
    '// Maps Soma article IDs to compiled WASM module metadata.',
    '// Regenerate after: node scripts/import-rust.js',
    '',
    'const wasmRegistry = {',
    entries.join(',\n'),
    '};',
    '',
    '// Boot diagnostic — logs registered kernel IDs to the browser console.',
    'if (typeof console !== \'undefined\') {',
    '  console.log(\'[WASM_REGISTRY] Registered kernels:\', Object.keys(wasmRegistry));',
    '}',
    '',
    'export default wasmRegistry;',
    '',
  ].join('\n');

  if (!DRY_RUN) {
    atomicWrite(REGISTRY, src);
    log(`✓ Generated wasm.generated.js (${KERNEL_MAP.length} kernel(s) registered).`);
    if (REGISTRY_ONLY) log('  WASM binary unchanged — run without --registry-only to recompile.\n');
  } else {
    log(`[DRY] Would write wasm.generated.js (${KERNEL_MAP.length} kernel(s)):`);
    KERNEL_MAP.forEach(k => log(`  · ${k.id} → ${k.fn ? `${k.fn}()` : (k.struct ? `${k.struct}.${k.boot ?? k.cycle}()` : k.id)}`));
  }

  // ── Step 4: Update WASM SHA-256 in kernel manifest ────────────────────────
  // The manifest's bosonic_lattice.sha256 is used by App.jsx for WASM integrity
  // verification. Keep it in sync after every build so the browser check passes.
  const MANIFEST = path.join(ROOT, 'public', 'kernel', 'manifest.json');
  if (!DRY_RUN && fs.existsSync(MANIFEST) && fs.existsSync(wasmBinPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
      const fullHash = crypto.createHash('sha256')
        .update(fs.readFileSync(wasmBinPath)).digest('hex');
      if (manifest.bosonic_lattice && manifest.bosonic_lattice.sha256 !== fullHash) {
        manifest.bosonic_lattice.sha256 = fullHash;
        manifest.bosonic_lattice.built  = new Date().toISOString();
        atomicWrite(MANIFEST, JSON.stringify(manifest, null, 2));
        log(`✓ Updated manifest WASM SHA-256: ${fullHash.slice(0, 12)}…`);
      } else if (manifest.bosonic_lattice) {
        log(`  Manifest WASM SHA-256 already current.`);
      }
    } catch (e) {
      console.warn(`  ⚠ Could not update manifest WASM hash: ${e.message}`);
    }
  }

  console.log('');
}

run();

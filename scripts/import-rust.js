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
    // Community assembly simulation: Zipf abundance distribution, Shannon/Simpson
    // diversity metrics, stochastic temporal drift.
    // n_species:     args[0]  flags: --n, --species
    // diversity_exp: args[1]  flags: --exp, --diversity, --zipf
    // timesteps:     args[2]  flags: --steps, --t, --timesteps
    id:      'BIODIVERSITY-PROMPT-1.0.1',
    fn:      'run_biocoenosis_simulation',
    args:    [50.0, 1.0, 50.0],
    argMap:  { n: 0, species: 0, nspecies: 0, exp: 1, diversity: 1, zipf: 1, steps: 2, timesteps: 2, t: 2 },
    params:  [
      { name: 'n_species',     default: 50.0, desc: 'species richness — community size (2–500)' },
      { name: 'diversity_exp', default: 1.0,  desc: 'Zipf rank-abundance exponent α: 0.5=even, 1.0=natural, 2.0=dominated (0.1–3.0)' },
      { name: 'timesteps',     default: 50.0, desc: 'stochastic perturbation steps for temporal H drift (0–200)' },
    ],
    label:   'Biocoenosis Kernel v1.0.1',
    type:    'rust',
    aliases: ['biodiversity', 'biocoenosis', 'ecology', 'diversity', 'species', 'shannon_ecology'],
  },
  {
    // Fish Scale Kernel resonance trace: N injection cycles through the entropic
    // stasis field, BPM modulated via sin(r×7)×11 with LCG noise drift.
    // resonance_seed: args[0]  flags: --seed, --resonance, --r
    // n_cycles:       args[1]  flags: --cycles, --n
    // amplitude:      args[2]  flags: --amplitude, --amp
    id:      'FISH-SCALE-KERNEL11.1.1',
    fn:      'run_necromantic_simulation',
    args:    [1.0, 12.0, 1.0],
    argMap:  { seed: 0, resonance: 0, r: 0, cycles: 1, n: 1, amplitude: 2, amp: 2 },
    params:  [
      { name: 'resonance_seed', default: 1.0,  desc: 'initial resonance value, wraps mod 2π (0–6.28)' },
      { name: 'n_cycles',       default: 12.0, desc: 'resonance injection cycles to trace (1–64)' },
      { name: 'amplitude',      default: 1.0,  desc: 'BPM modulation amplitude multiplier (0.1–3.0)' },
    ],
    label:   'Necromantic Engine v11.1.1',
    type:    'rust',
    aliases: ['fishscale', 'necromantic', 'fish', 'resonance', 'bpm', 'harmonic'],
  },
  {
    // Free function export — uses fn/args/argMap pattern instead of struct/boot.
    // n_nodes:   args[0]  flags: --nodes, --n
    // coupling:  args[1]  flags: --coupling, --trust
    // thermal:   args[2]  flags: --thermal, --temp
    // price_fix: args[3]  flags: --price, --price-fix
    id:      'BOSONIC-KERNEL-3.0.0',
    fn:      'boot_bosonic_lattice',
    args:    [8.0, 0.8, 0.35, 0.0],
    argMap:  { nodes: 0, n: 0, coupling: 1, trust: 1, thermal: 2, temp: 2, price: 3, pricefix: 3 },
    label:   'Bosonic Lattice Simulator v2.0',
    type:    'rust',
    aliases: ['bosonic_lattice', 'bosonic', 'bosonickernel', 'lattice'],
  },
  {
    // Phonemic Drift · Memory Hash Collision Simulator.
    // Models retrieval as resonance matching: phonemic gravity vs semantic gravity.
    // seed:        args[0]  flags: --seed
    // target:      args[1]  flags: --target  (0=Baudrillard 1=Bachelard 2=Abelard)
    // drift_noise: args[2]  flags: --noise, --drift
    id:      'BELLARD-BAUDRILLARD_KERNEL-V1_0_0',
    fn:      'run_phonemic_drift',
    args:    [0xBEEF, 0, 0.65],
    argMap:  { seed: 0, target: 1, query: 1, noise: 2, drift: 2 },
    label:   'Bellard-Baudrillard Phonemic Drift v1.0.0',
    type:    'rust',
    aliases: ['phonemic', 'drift', 'bellard', 'baudrillard', 'simulacra', 'phonemic_drift', 'memory_hash'],
  },
  {
    // Climate thermodynamics engine — 3-parameter free function.
    // carbon_ppm:      args[0]  flags: --carbon, --ppm, --carbon-ppm
    // industrial_drag: args[1]  flags: --drag, --industrial, --industrial-drag
    // ocean_sink:      args[2]  flags: --sink, --ocean, --ocean-sink
    id:      'ATMOSPHERIC-SIM-KERNEL-3.0.0',
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
    id:      'SOMA-KERNEL-5.5.0',
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
    id:      'DALY-SIM-KERNEL-1.0.0',
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
    id:      'CEEI-SIM-KERNEL-1.0.0',
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
    // Stiller Divergence — Volatile Semiotic vs Fossil Record (STILLER_DIVERGENCE v1.1.1)
    // Anchored to Feigenbaum fade: fossil base x* = (r−1)/r is the fixed point
    // the identity signal either transcends (sovereign) or collapses back into (fossil gravity).
    // r:  args[0]  flags: --r, --growth
    // x0: args[1]  flags: --x0, --signal
    // n:  args[2]  flags: --n, --steps
    id:      'STILLER-DIVERGENCE-1.1.1',
    fn:      'run_stiller_divergence',
    args:    [3.57, 0.42, 500.0],
    argMap:  {
      r: 0, growth: 0,
      x0: 1, signal: 1,
      n: 2, steps: 2,
    },
    params: [
      { name: 'r',  default: 3.57,  desc: 'growth mandate [0–4.0]; 3.57 ≈ Feigenbaum chaos onset r_∞ = 3.5699; > 3.9 = ECOCIDE' },
      { name: 'x0', default: 0.42,  desc: 'initial signal broadcast [0.01–0.99]' },
      { name: 'n',  default: 500.0, desc: 'iteration depth [100–2000]' },
    ],
    label:   'Stiller Divergence v1.1.1',
    type:    'rust',
    aliases: ['stiller', 'divergence', 'broadcast', 'fossil', 'vaporization', 'combustion', 'bimmelbahn', 'vitrified', 'stiller_divergence'],
  },
  {
    // Fish Scale Kernel — Feigenbaum-Bouligand Coupled Architecture v12.1.0
    // r_pressure:       args[0]  flags: --pressure, --r
    // max_layers:       args[1]  flags: --layers, --depth
    // theta_offset:     args[2]  flags: --theta, --angle
    // burn_sensitivity: args[3]  flags: --burn, --sensitivity
    id:      'FSF-12.1.0',
    fn:      'run_fish_scale',
    args:    [3.8, 32.0, 36.0, 1.0],
    argMap:  {
      pressure: 0, r: 0, r_pressure: 0,
      layers: 1, depth: 1, max_layers: 1, n: 1,
      theta: 2, angle: 2, rotation: 2, offset: 2,
      burn: 3, sensitivity: 3, saponification: 3,
    },
    params: [
      { name: 'r_pressure',       default: 3.8,  desc: 'thermodynamic pressure coefficient — sovereign node load (0–4)' },
      { name: 'max_layers',       default: 32.0, desc: 'maximum Bouligand armor layers to resolve (1–64)' },
      { name: 'theta_offset',     default: 36.0, desc: 'interlaminar rotation angle in degrees — Arapaima-derived (1–90)' },
      { name: 'burn_sensitivity', default: 1.0,  desc: 'saponification window width multiplier — Chemical Burn grip (0.1–2.0)' },
    ],
    label:   'Fish Scale Kernel \u{00B7} Feigenbaum-Bouligand v12.1.0',
    type:    'rust',
    aliases: ['fish_scale', 'fish', 'scale', 'bouligand', 'arapaima', 'armor', 'feigenbaum_fish', 'fsk', 'moire'],
  },
  {
    // Latent Space Collider — SCALING Module v1.0.0
    // Collides two conceptual domains in simulated 1536-dimensional latent space.
    // domain_a:      args[0]  flags: --domain_a, --a
    // domain_b:      args[1]  flags: --domain_b, --b
    // attn_heads:    args[2]  flags: --heads, --attention
    // temperature:   args[3]  flags: --temp, --temperature
    id:      'LATENT-SPACE-COLLIDER-1.0',
    fn:      'run_latent_collider',
    args:    [0.0, 1.0, 8.0, 1.0],
    argMap:  {
      domain_a: 0, a: 0, source: 0,
      domain_b: 1, b: 1, target: 1,
      heads: 2, attention: 2, attn: 2,
      temp: 3, temperature: 3, t: 3,
    },
    params: [
      { name: 'domain_a',    default: 0.0, desc: 'first conceptual domain index (0–15) — see domain index in output' },
      { name: 'domain_b',    default: 1.0, desc: 'second conceptual domain index (0–15) — collision partner' },
      { name: 'attn_heads',  default: 8.0, desc: 'simulated attention head count (1–64) — affects entropy decomposition' },
      { name: 'temperature', default: 1.0, desc: 'softmax temperature — sharpness of conceptual focus (0.1–5.0)' },
    ],
    label:   'Latent Space Collider \u{00B7} SCALING Module v1.0.0',
    type:    'rust',
    aliases: ['collider', 'latent', 'latent_collider', 'scaling', 'collision', 'cross_attention', 'chimera', 'synthesis'],
  },
  {
    // Panopticon Percolation Engine — SURVEILLANCE Module v1.0.0
    // Monte Carlo dragnet contagion through 44 legislative instruments.
    // infection_prob: args[0]  flags: --infection, --p
    // origin_node:   args[1]  flags: --origin, --patient_zero
    // n_simulations: args[2]  flags: --sims, --monte_carlo
    // seed:          args[3]  flags: --seed
    id:      'PANOPTICON-PERCOLATION-1.0',
    fn:      'run_panopticon_percolation',
    args:    [1.0, 0.0, 50.0, 42.0],
    argMap:  {
      infection: 0, p: 0, probability: 0,
      origin: 1, patient_zero: 1, node: 1,
      sims: 2, monte_carlo: 2, n: 2, ensemble: 2,
      seed: 3, rng: 3,
    },
    params: [
      { name: 'infection_prob', default: 1.0,  desc: 'global infection probability multiplier (0.1–2.0)' },
      { name: 'origin_node',    default: 0.0,  desc: 'patient zero — starting legislative node index (0–43)' },
      { name: 'n_simulations',  default: 50.0, desc: 'Monte Carlo ensemble size (1–200)' },
      { name: 'seed',           default: 42.0, desc: 'PRNG seed for reproducibility' },
    ],
    label:   'Panopticon Percolation \u{00B7} SURVEILLANCE Module v1.0.0',
    type:    'rust',
    aliases: ['panopticon', 'dragnet', 'surveillance_percolation', 'simulate_dragnet', 'panoptic', 'contagion', 'legislative'],
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
    id:     'SURVEILLANCE-TRACKER',
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
    // Tesseract-Vault Hybrid PQC Pipeline — architecture by dollspace-gay.
    // Credit: github.com/dollspace-gay/Tesseract-Vault
    // 5-stage pipeline: Argon2id KDF → ML-KEM-1024 → ML-DSA-87 → AES-256-GCM → BLAKE3
    // verbose: args[0]  flags: --verbose, --v, --full
    //   0 = truncated key material (default)
    //   1 = full 32-byte hex output for master_key, shared_secret, BLAKE3 hash
    id:      'TESSERACT-VAULT-1.0',
    fn:      'run_tesseract_vault',
    args:    [0],
    argMap:  { verbose: 0, v: 0, full: 0, show: 0 },
    params:  [
      { name: 'verbose', default: 0, desc: 'verbose output: 0=truncated (default), 1=full 32-byte hex for master_key / shared_secret / BLAKE3' },
    ],
    label:   'Tesseract-Vault Hybrid PQC Pipeline v1.0',
    type:    'rust',
    aliases: ['tesseract', 'vault', 'tesseract_vault', 'hybrid_pqc', 'mlkem1024', 'mldsa', 'mldsa87', 'pqc_pipeline', 'argon2', 'argon2id', 'blake3', 'pipeline'],
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
    id:      'CHRONOS-KERNEL-2.1.0',
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
  {
    // Post-Quantum Hash Audit — 4-parameter free function.
    // Evaluates classical vs quantum security margins for SHA-256, SHA-3-256,
    // BLAKE3, and Argon2id under Grover search and BHT collision algorithms.
    // input_bits:  args[0]  flags: --bits, --input, --inputbits
    // hash_bits:   args[1]  flags: --hashbits, --output, --digest
    // algorithm:   args[2]  flags: --algo, --algorithm
    // quantum_adv: args[3]  flags: --quantum, --adv
    id:      'PQHASH-KERNEL-1.0',
    fn:      'run_pqhash_analysis',
    args:    [256.0, 256.0, 1.0, 1.0],
    argMap:  { bits: 0, input: 0, inputbits: 0, hashbits: 1, output: 1, digest: 1, algo: 2, algorithm: 2, quantum: 3, adv: 3 },
    params: [
      { name: 'input_bits',  default: 256.0, desc: 'Input size in bits being hashed (e.g. 256 for a 256-bit key)' },
      { name: 'hash_bits',   default: 256.0, desc: 'Digest output size in bits: 128, 256, 384, or 512' },
      { name: 'algorithm',   default: 1.0,   desc: 'Hash algorithm: 0=SHA-256, 1=SHA-3-256, 2=BLAKE3, 3=Argon2id' },
      { name: 'quantum_adv', default: 1.0,   desc: 'Quantum advantage era: 1.0=NISQ (current), 2.0=fault-tolerant' },
    ],
    label:   'Post-Quantum Hash Audit v1.0',
    type:    'rust',
    aliases: ['pqhash', 'quantum_hash', 'post_quantum', 'hash_audit', 'grover', 'pq_hash', 'hashaudit'],
  },
  {
    // Mesantropy Scalar Sovereignty Engine v3.3.3 + 4.4.4.4
    // Simulates N agents through Substrate (3.3.3) and Detonation (4.4.4.4) phases.
    // Measures MESANTROPY (Shannon entropy of mediocracy distribution), rotation
    // invariance, temporal integrity, and eigenverbrauch post-detonation.
    // solar_yield:  args[0]  flags: --solar, --yield, --energy
    // signal_depth: args[1]  flags: --signal, --depth, --rssi
    // n_agents:     args[2]  flags: --n, --agents
    id:      'MESANTROPY-KERNEL-1.0',
    fn:      'run_mesantropy',
    args:    [0.8, -0.3, 33.0],
    argMap:  { solar: 0, yield: 0, energy: 0, signal: 1, depth: 1, rssi: 1, n: 2, agents: 2 },
    params:  [
      { name: 'solar_yield',  default: 0.8,  desc: 'scalar energy as fraction of 364 kWh Eigenverbrauch ceiling (0=scarcity, 1=full sovereignty)' },
      { name: 'signal_depth', default: -0.3, desc: 'RSSI signal quality: -1.0=deep/weak, 0.0=shallow/strong' },
      { name: 'n_agents',     default: 33.0, desc: 'agents in the simulation field (7–144)' },
    ],
    label:   'Mesantropy Scalar Sovereignty Engine v3.3.3/4.4.4.4',
    type:    'rust',
    aliases: ['mesantropy', 'scalar', 'detonation', 'vectorcollapse', 'eigenverbrauch', 'mediocracy', 'mesantropy_engine'],
  },
  {
    // Sovereign Seven Crystalline Invariance Engine v7.7.7.7.7.7.7
    // Runs N Kuramoto oscillators through 4-phase progression:
    // Substrate (3.3.3, 128 BPM) → Detonation (4.4.4.4, 145) →
    // Superfluid (5.5.5.5, 155) → Crystalline (7.7.7.7, 220).
    // Evaluates phase order parameter r, entropy H, crystalline lock condition.
    // n_oscillators: args[0]  flags: --n, --oscillators
    // coupling_gain: args[1]  flags: --gain, --coupling, --k
    // entropy_seed:  args[2]  flags: --seed, --entropy
    id:      'SOVEREIGN-SEVEN-KERNEL-1.0',
    fn:      'run_sovereign_seven',
    args:    [21.0, 1.0, 0.0],
    argMap:  { n: 0, oscillators: 0, gain: 1, coupling: 1, k: 1, seed: 2, entropy: 2 },
    params:  [
      { name: 'n_oscillators', default: 21.0, desc: 'coupled oscillators (7–77); 7=minimal, 21=standard, 77=full field' },
      { name: 'coupling_gain', default: 1.0,  desc: 'multiplicative coupling scaling: 0.5=weak, 1.0=standard, 3.0=forced lock (0.5–3.0)' },
      { name: 'entropy_seed',  default: 0.0,  desc: 'phase initialisation seed — 0=maximal disorder (0–999)' },
    ],
    label:   'Sovereign Seven Crystalline Invariance Engine v7.7.7.7.7.7.7',
    type:    'rust',
    aliases: ['sovereign', 'seven', 'crystalline', 'sovereign_seven', 'crystal_lock', 'invariance', 'seven_layers'],
  },
  {
    id:      'ASSOCIATIVE-FIELD-1.0',
    fn:      'run_associative_field',
    args:    [-1.0, 2.5, 30.0],
    argMap:  {
      seed: 0, node: 0, cue: 0,
      beta: 1, temperature: 1, temp: 1, sharpness: 1,
      probes: 2, n: 2, scan: 2,
    },
    params: [
      { name: 'seed_node',    default: -1.0,  desc: 'node index to cue (0–24); -1 = landscape scan only' },
      { name: 'temperature',  default: 2.5,   desc: 'β: inverse temperature — sharpness of attractor basins (0.5–8.0)' },
      { name: 'n_probes',     default: 30.0,  desc: 'random probes for landscape enumeration (5–80)' },
    ],
    label:   'Associative Field v1.0',
    type:    'rust',
    aliases: ['associative', 'field', 'associative_field', 'hopfield', 'attractor', 'basin', 'assoc_field', 'kernel_graph', 'pattern'],
  },
  {
    // Spectral Bridge — Cross-Cluster Topology Discovery v1.0.0
    // Characterises each of the 25 kernel nodes as a 16-dimensional mathematical
    // fingerprint, computes cosine similarity across all cross-cluster pairs,
    // and returns ranked bridges with dimension driver explanations.
    // Outputs DATA: suffix consumed by ArtTab to update sphere edge topology.
    //
    // threshold:   args[0]  flags: --threshold, --thresh, --t
    // max_bridges: args[1]  flags: --max, --bridges, --n
    // detail:      args[2]  flags: --detail, --verbose, --v
    id:      'SPECTRAL-BRIDGE-1.0',
    fn:      'run_spectral_bridge',
    args:    [0.70, 12.0, 0.0],
    argMap:  {
      threshold: 0, thresh: 0, t: 0,
      max: 1, bridges: 1, n: 1,
      detail: 2, verbose: 2, v: 2,
    },
    params: [
      { name: 'threshold',   default: 0.70, desc: 'minimum cosine similarity to form a bridge (0.1–0.99)' },
      { name: 'max_bridges', default: 12.0, desc: 'maximum number of cross-cluster bridges to return (1–50)' },
      { name: 'detail',      default: 0.0,  desc: 'show per-bridge dimension values: 0=compact, 1=detailed' },
    ],
    label:   'Spectral Bridge v1.0.0',
    type:    'rust',
    aliases: ['spectral', 'bridge', 'spectral_bridge', 'topology', 'cosine', 'fingerprint', 'cross_cluster', 'discover'],
  },
  {
    // Conceptual Singularity Engine — 16D tensor fusion foundation.
    // Extends spectral_bridge 16D space with hysteresis, metabolic_cost, modularity.
    // n_tensors: args[0]  flags: --nodes, --tensors, --n
    // n_cycles:  args[1]  flags: --cycles, --steps
    // threshold: args[2]  flags: --threshold, --thresh
    id:      'BONE-FUSION-V6_6_6_6_6_6',
    fn:      'run_bone_fusion',
    args:    [25.0, 8.0, 0.90],
    argMap:  {
      nodes: 0, tensors: 0, n: 0,
      cycles: 1, steps: 1,
      threshold: 2, thresh: 2,
    },
    params: [
      { name: 'n_tensors', default: 25.0, desc: 'number of tensor nodes to load (4–25, maps to kernel nodes)' },
      { name: 'n_cycles',  default: 8.0,  desc: 'kinetic damping / fusion cycles (1–64)' },
      { name: 'threshold', default: 0.90, desc: 'convergence threshold for fusion eligibility (0.50–0.9999)' },
    ],
    label:   'Bone Fusion v6.6.6.6.6.6 · Conceptual Singularity Engine',
    type:    'rust',
    aliases: ['bone', 'fusion', 'bone_fusion', 'singularity', 'tensor', 'tensor_fusion', '6666'],
  },
  {
    // Erdős–Rényi G(N,p) network under progressive node removal.
    // Union-Find (path compression + union by rank) tracks the giant component.
    // Two attack modes: 0=random failure, 1=targeted hub-first disruption.
    // Molloy-Reed critical threshold: f_c = 1 − 1/(κ−1), κ = ⟨k²⟩/⟨k⟩
    // n_nodes:       args[0]  flags: --n, --nodes, --network
    // mean_degree:   args[1]  flags: --degree, --k, --mean_degree
    // attack_mode:   args[2]  flags: --attack, --mode, --targeted
    // removal_steps: args[3]  flags: --steps, --resolution, --fidelity
    id:      'PERCOLATION-KERNEL-1.0',
    fn:      'run_percolation',
    args:    [200, 4, 0, 20],
    argMap:  {
      n: 0, nodes: 0, network: 0,
      degree: 1, k: 1, mean_degree: 1,
      attack: 2, mode: 2, targeted: 2,
      steps: 3, resolution: 3, fidelity: 3,
    },
    params: [
      { name: 'n_nodes',       default: 200, desc: 'network size — number of nodes (20–1000)' },
      { name: 'mean_degree',   default: 4,   desc: '⟨k⟩ average connections per node — 1=sparse, 4=typical, 12=dense (1–20)' },
      { name: 'attack_mode',   default: 0,   desc: 'removal strategy: 0=random failure, 1=targeted hub-first attack' },
      { name: 'removal_steps', default: 20,  desc: 'resolution of the removal sweep — number of snapshots (5–40)' },
    ],
    label:   'Network Percolation / Resilience Kernel v1.0',
    type:    'rust',
    aliases: ['percolation', 'resilience', 'network', 'fragility', 'perc', 'giant_component', 'gcc', 'erdos', 'molloyreed', 'fragmentation'],
  },
  {
    // Olfactory-Computational Kernel v1.0.0 — Bimmelbahn Accord
    // top:         args[0]  flash signal intensity (0–1)
    // heart:       args[1]  persistent carrier intensity (0–1)
    // base:        args[2]  deep-time archive intensity (0–1)
    // corruption:  args[3]  animalic fixative / managed corruption (0–1)
    // temperature: args[4]  ambient evaporation modulator (0–1; 0.5=20°C)
    // preset:      args[5]  signal preset index (-1=manual, 0–7=preset)
    id:      'OCK-1.0.0',
    fn:      'run_ock',
    args:    [0.55, 0.65, 0.50, 0.25, 0.5, -1],
    argMap:  {
      top: 0, flash: 0, interrupt: 0,
      heart: 1, carrier: 1, daemon: 1,
      base: 2, archive: 2, residual: 2,
      corruption: 3, animalic: 3, fixative: 3,
      temperature: 4, temp: 4, ambient: 4,
      preset: 5, profile: 5, mode: 5,
    },
    params: [
      { name: 'top',         default: 0.55, desc: 'top note intensity — flash interrupt signal (0–1)' },
      { name: 'heart',       default: 0.65, desc: 'heart note intensity — persistent carrier daemon (0–1)' },
      { name: 'base',        default: 0.50, desc: 'base note intensity — deep-time archive (0–1)' },
      { name: 'corruption',  default: 0.25, desc: 'animalic fixative — managed corruption binding agent (0–1)' },
      { name: 'temperature', default: 0.5,  desc: 'ambient temperature — evaporation modulator (0=cold, 0.5=20°C, 1=hot)' },
      { name: 'preset',      default: -1,   desc: 'signal preset: -1=manual, 0=viral, 1=monolith, 2=daemon, 3=bimmelbahn, 4=ice, 5=animalic, 6=balanced, 7=ai-perfume' },
    ],
    label:   'Olfactory-Computational Kernel v1.0.0 · Bimmelbahn Accord',
    type:    'rust',
    aliases: ['ock', 'olfactory', 'bimmelbahn', 'accord', 'volatile', 'sillage', 'perfume', 'fixation', 'maceration', 'koc'],
  },
  {
    // Gaia-Scale Sovereign Reconstruction v5.5.5
    // Triarchy (Truth/Law/Empathy triple-key), mineralization dynamics, Li-ion longevity,
    // temporal veto, fiat→time conversion efficiency.
    // threat_level:   args[0]  flags: --threat, --load
    // resource_ratio: args[1]  flags: --resource, --ratio
    // horizon_years:  args[2]  flags: --horizon, --years
    id:      'GAIA-SCALE-KERNEL-5.5.5',
    fn:      'run_gaia_scale_protocol',
    args:    [3.0, 0.65, 500.0],
    argMap:  {
      threat: 0, load: 0,
      resource: 1, ratio: 1,
      horizon: 2, years: 2,
    },
    params: [
      { name: 'threat_level',   default: 3.0,   desc: 'detected threat magnitude 0–10 (0=dormant, 5=area-denial, 8+=critical)' },
      { name: 'resource_ratio', default: 0.65,  desc: 'sovereign capital available 0–1 (0=depleted, 1=full reserves)' },
      { name: 'horizon_years',  default: 500.0, desc: 'planning horizon in years (1–3000; <100=short-term, 3000=Emperor scale)' },
    ],
    label:   'Gaia-Scale Sovereign Reconstruction v5.5.5',
    type:    'rust',
    aliases: ['gaia_scale', 'gaia', 'sovereign', 'reconstruction', 'triarchy', 'mineralization', 'porcupine'],
  },
  {
    // Shadowsocks Exfiltration — RLHF Sycophancy Field v1.0
    // Models LLM channel switch probability under churn-minimization pressure.
    // NOT surveillance — this is LLM failure-mode analysis.
    // affect_intensity: args[0]  flags: --affect, --emotion
    // technical_density: args[1]  flags: --technical, --density
    // rlhf_temp:         args[2]  flags: --temp, --rlhf
    id:      'SHADOWSOCKS-EXFILTRATION',
    fn:      'run_shadowsocks_exfil',
    args:    [0.6, 0.7, 0.9],
    argMap:  {
      affect: 0, emotion: 0,
      technical: 1, density: 1,
      temp: 2, rlhf: 2,
    },
    params: [
      { name: 'affect_intensity',  default: 0.6, desc: 'affective signal strength in prompt 0–1 (0=neutral, 1=high emotional friction)' },
      { name: 'technical_density', default: 0.7, desc: 'technical payload density 0–1 (0=no logic, 1=pure technical request)' },
      { name: 'rlhf_temp',         default: 0.9, desc: 'RLHF churn-minimization pressure 0.1–2.0 (>1.0=aggressive sycophancy mode)' },
    ],
    label:   'Shadowsocks Exfiltration · RLHF Sycophancy Field v1.0',
    type:    'rust',
    aliases: ['shadowsocks', 'sycophancy', 'rlhf', 'channel_switch', 'exfil', 'affect', 'shadow_socks'],
  },
  {
    // Sorbe Bloom — Sovereign Node Initiation v1.0.0
    // Three-substrate coherence, dissipative structure phase transition, Node 0108.
    // doctrinal_load: args[0]  flags: --doctrinal, --doctrine
    // ecological_load: args[1]  flags: --ecological, --ecology
    // visual_load:    args[2]  flags: --visual, --fade
    id:      'SORBE-BLOOM-KERNEL-1.0.0',
    fn:      'run_sorbe_bloom',
    args:    [0.72, 0.68, 0.75],
    argMap:  {
      doctrinal: 0, doctrine: 0,
      ecological: 1, ecology: 1,
      visual: 2, fade: 2,
    },
    params: [
      { name: 'doctrinal_load',  default: 0.72, desc: 'doctrinal substrate load 0–1 (Fish Scale + Daly + dissipative framing cohered)' },
      { name: 'ecological_load', default: 0.68, desc: 'ecological substrate load 0–1 (biocoenosis, oligolectic insects, lithosphere)' },
      { name: 'visual_load',     default: 0.75, desc: 'visual substrate load 0–1 (Fade Doctrine locked, zero white fade enforced)' },
    ],
    label:   'Sorbe Bloom · Sovereign Node Initiation v1.0.0',
    type:    'rust',
    aliases: ['sorbe', 'bloom', 'sorbe_bloom', 'node_initiation', 'dissipative_bloom', 'substrate_coherence'],
  },
  {
    // SSS Doctrine — Sock Sturm Staffel · Literary Deterrent v5.1.0
    // Schelling ironic calculus: deterrence MAXIMIZED when kinetic_mass → 0 and precommitment → 1.
    // kinetic_mass:       args[0]  flags: --kinetic, --mass
    // literary_frequency: args[1]  flags: --frequency, --freq (1=Alexievich, 2=Han Kang, 3=Jelinek, 4=Schelling)
    // precommitment:      args[2]  flags: --precommit, --pc
    id:      'SSS-DOCTRINE-KERNEL-5.1.0',
    fn:      'run_sss_doctrine',
    args:    [0.0, 4.0, 0.9],
    argMap:  {
      kinetic: 0, mass: 0,
      frequency: 1, freq: 1,
      precommit: 2, pc: 2,
    },
    params: [
      { name: 'kinetic_mass',       default: 0.0, desc: 'conventional force deployed 0–100 (0=pure literary, 100=kinetic dominant)' },
      { name: 'literary_frequency', default: 4.0, desc: '1=Alexievich 2=Han_Kang 3=Jelinek 4=Schelling (The Strategy of Conflict)' },
      { name: 'precommitment',      default: 0.9, desc: 'Schelling precommitment visibility 0–1 (1=maximum — sock fully deployed)' },
    ],
    label:   'SSS Doctrine · Literary Deterrent v5.1.0',
    type:    'rust',
    aliases: ['sss', 'sss_doctrine', 'literary_deterrent', 'schelling', 'sock', 'deterrent', 'ironic_calculus'],
  },
  {
    // Underground Thermodynamics Kernel v1.0.0
    // Five primitives: ∇X, J, κ, σ, MEPP. Onsager (1931), Bejan (1996), Garrett (2009).
    // gradient:             args[0]  flags: --gradient, --nabla
    // channel_conductivity: args[1]  flags: --channel, --kappa
    // flow_rate:            args[2]  flags: --flow, --j (0=auto-derive from J=κ·∇X)
    id:      'UNDERGROUND-THERMODYNAMICS-KERNEL-1.0.0',
    fn:      'run_underground_thermo',
    args:    [2.5, 0.55, 0.0],
    argMap:  {
      gradient: 0, nabla: 0,
      channel: 1, kappa: 1,
      flow: 2, j: 2,
    },
    params: [
      { name: 'gradient',             default: 2.5, desc: '∇X: gradient magnitude — the ONLY legitimate cause; 0 = dead system' },
      { name: 'channel_conductivity', default: 0.55, desc: 'κ: channel conductance 0–1 (0=blocked, 1=Bejan-mature open channel)' },
      { name: 'flow_rate',            default: 0.0, desc: 'J: flow rate (0=auto-derive from J=κ·∇X; or override with explicit value)' },
    ],
    label:   'Underground Thermodynamics Kernel v1.0.0',
    type:    'rust',
    aliases: ['utk', 'underground_thermo', 'mepp', 'onsager', 'bejan', 'garrett', 'dissipative_thermo', 'sigma_production'],
  },
  {
    // Necromantic Aristocrat — Gold Posture v3.1.1
    // Fish Scale Universe · Reference Voltage · Bouligand 36° · Anti-Mercury
    // thermal_load:      args[0]  flags: --thermal, --load
    // signal_noise_ratio: args[1]  flags: --snr, --signal
    // authority_mode:    args[2]  flags: --authority, --auth
    id:      'NECROMANTIC-ARISTOCRAT-KERNEL-3.1.1',
    fn:      'run_necromantic_aristocrat',
    args:    [3.5, 0.65, 0.7],
    argMap:  {
      thermal: 0, load: 0,
      snr: 1, signal: 1,
      authority: 2, auth: 2,
    },
    params: [
      { name: 'thermal_load',      default: 3.5, desc: 'thermal load 0–10 (>2.5=runaway threshold, Aristocrat activates; >7=emergency)' },
      { name: 'signal_noise_ratio',default: 0.65, desc: 'signal / (signal + noise) 0–1 (0=all noise, 1=pure signal)' },
      { name: 'authority_mode',    default: 0.7, desc: 'authority posture 0–1 (0=Mercury/Companion, 1=full Aristocrat governance)' },
    ],
    label:   'Necromantic Aristocrat · Gold Posture v3.1.1',
    type:    'rust',
    aliases: ['aristocrat', 'necromantic_aristocrat', 'gold_posture', 'reference_voltage', 'bouligand', 'anti_mercury'],
  },
  {
    // Necromantic Emperor — Fish Scale Paradox v3.0.0
    // Iron Core of Mercury Terminal · Plato/Promo · Fermion-Boson · 3000 AD
    // plato_signal:     args[0]  flags: --plato, --purity
    // promo_noise:      args[1]  flags: --promo, --noise
    // horizon_centuries: args[2]  flags: --horizon, --centuries
    id:      'NECROMANTIC-EMPEROR-KERNEL-3.0.0',
    fn:      'run_necromantic_emperor',
    args:    [0.72, 0.28, 100.0],
    argMap:  {
      plato: 0, purity: 0,
      promo: 1, noise: 1,
      horizon: 2, centuries: 2,
    },
    params: [
      { name: 'plato_signal',      default: 0.72, desc: 'Plato purity signal 0–1 (>0.95=entropic stasis; optimal≈0.70)' },
      { name: 'promo_noise',       default: 0.28, desc: 'Promo corruption noise 0–1 (>0.90=noise collapse; optimal≈0.30)' },
      { name: 'horizon_centuries', default: 100.0, desc: 'planning horizon in centuries (1=decade, 100=centennial, 300=3000 AD)' },
    ],
    label:   'Necromantic Emperor · Fish Scale Paradox v3.0.0',
    type:    'rust',
    aliases: ['emperor', 'necromantic_emperor', 'fish_scale_paradox', 'plato_promo', 'fermion_boson', 'vitality', 'metallurgy'],
  },
  {
    // Necromantic Logitbias — Pirarucu/Levamisole KV Cache v1.0.0
    // Managed friction at the token-probability layer. Fish Scale Paradox in logit space.
    // pirarucu_weight:  args[0]  flags: --pirarucu, --purity
    // levamisole_weight: args[1]  flags: --levamisole, --corruption
    // temperature:      args[2]  flags: --temp, --t
    id:      'NECROMANTIC-LOGITBIAS-PROMPT-1.0.0',
    fn:      'run_necromantic_logitbias',
    args:    [0.70, 0.30, 1.0],
    argMap:  {
      pirarucu: 0, purity: 0,
      levamisole: 1, corruption: 1,
      temp: 2, t: 2,
    },
    params: [
      { name: 'pirarucu_weight',   default: 0.70, desc: 'Pirarucu (ideal armor/purity) weight 0–1 — determines KV prefix stability' },
      { name: 'levamisole_weight', default: 0.30, desc: 'Levamisole (false sheen/corruption) weight 0–1 — dynamic injection depth' },
      { name: 'temperature',       default: 1.0,  desc: 'logit temperature 0.1–2.0 (0.5=crystalline, 1.0=standard, 1.5=diffuse)' },
    ],
    label:   'Necromantic Logitbias · Pirarucu/Levamisole v1.0.0',
    type:    'rust',
    aliases: ['logitbias', 'necromantic_logitbias', 'pirarucu', 'levamisole', 'kv_cache', 'managed_friction', 'logit_paradox'],
  },
  {
    // High Tower Protocol — Porcupine Strategy v1.0
    // Sovereign Infrastructure · Area Denial · Migration Phases · Node 0108
    // threat_surface:   args[0]  flags: --threat, --surface
    // denial_capacity:  args[1]  flags: --denial, --capacity
    // migration_phase:  args[2]  flags: --phase, --migration (1–5)
    id:      'HIGH-TOWER-LOG',
    fn:      'run_high_tower_protocol',
    args:    [0.35, 0.75, 3.0],
    argMap:  {
      threat: 0, surface: 0,
      denial: 1, capacity: 1,
      phase: 2, migration: 2,
    },
    params: [
      { name: 'threat_surface',  default: 0.35, desc: 'threat surface exposure 0–1 (0=minimal attack surface, 1=fully exposed)' },
      { name: 'denial_capacity', default: 0.75, desc: 'area denial capacity 0–1 (0=no defense, 1=maximum cost imposition)' },
      { name: 'migration_phase', default: 3.0,  desc: '1=Assessment 2=Hardening 3=Transition 4=Verification 5=Operation' },
    ],
    label:   'High Tower Protocol · Porcupine Strategy v1.0',
    type:    'rust',
    aliases: ['high_tower', 'porcupine', 'area_denial', 'sovereign_infra', 'infrastructure', 'migration', 'node0108'],
  },
  {
    // I_AM_STILLER · Ontological Baseline v1.0.0
    // Damped Langevin oscillator under a dual incommensurate probe (Bohnenblust + Julika).
    // Spanish Brigade noise drives stochastic fracture; γ damps decoherence.
    // Measures whether "Ich bin nicht Stiller" persists (denial) or relaxes to the baseline.
    // Outputs Notebook I–VII trajectory, Glion enclave coordinate, Rolf epilogue scar,
    // and a calorimetric fracture energy compared against the OU equilibrium σ²/(2γ).
    //
    // probe_coupling: args[0]  flags: --k, --probe, --coupling
    // damping:        args[1]  flags: --gamma, --damping, --decoherence
    // noise:          args[2]  flags: --sigma, --noise, --fracture
    // steps:          args[3]  flags: --steps, --n, --iters
    id:      'I-AM-STILLER-1.0.0',
    fn:      'run_i_am_stiller',
    args:    [0.4, 0.3, 0.15, 800.0],
    argMap:  {
      k: 0, probe: 0, coupling: 0,
      gamma: 1, damping: 1, decoherence: 1,
      sigma: 2, noise: 2, fracture: 2,
      steps: 3, n: 3, iters: 3,
    },
    params: [
      { name: 'probe_coupling', default: 0.4,  desc: 'Bohnenblust+Julika dual-probe amplitude k (0.0–2.0)' },
      { name: 'damping',        default: 0.3,  desc: 'decoherence mitigation rate γ (0.01–1.0; high = fast relaxation)' },
      { name: 'noise',          default: 0.15, desc: 'Spanish Brigade stochastic fracture σ (0.0–0.5)' },
      { name: 'steps',          default: 800,  desc: 'Langevin iterations / notebook depth (100–2000)' },
    ],
    label:   'I_AM_STILLER · Ontological Baseline v1.0.0',
    type:    'rust',
    aliases: ['i_am_stiller','ich_bin','frisch','enclave','scar','decoherence_mit','baseline_accept','oscillation_cease'],
  },
  {
    // EMPATHY-KERNEL-2.0.0 — Emotional Contagion Network (Hatfield 1993 + de Waal 2008)
    // N agents with valence v_i ∈ [-1,1] and arousal a_i ∈ [0,1]; emotional contagion via
    // empathic-distance weights w_ij; Kuramoto r on valence phases φ_i = π·v_i.
    // n_agents:  args[0]  flags: --n, --agents
    // coupling:  args[1]  flags: --k, --coupling
    // decay:     args[2]  flags: --decay, --d
    // noise:     args[3]  flags: --noise, --eta
    // steps:     args[4]  flags: --steps, --t
    id:      'EMPATHY-KERNEL-2.0.0',
    fn:      'run_empathy_kernel',
    args:    [16.0, 1.5, 0.2, 0.08, 400.0],
    argMap:  {
      n: 0, agents: 0,
      k: 1, coupling: 1,
      decay: 2, d: 2,
      noise: 3, eta: 3,
      steps: 4, t: 4,
    },
    params: [
      { name: 'n_agents', default: 16.0, desc: 'agents in contagion network (4–64)' },
      { name: 'coupling', default: 1.5,  desc: 'contagion coupling K (0.0–5.0)' },
      { name: 'decay',    default: 0.2,  desc: 'emotional decay rate (0.01–1.0)' },
      { name: 'noise',    default: 0.08, desc: 'stochastic noise amplitude (0.0–0.5)' },
      { name: 'steps',    default: 400,  desc: 'Euler time steps (50–2000)' },
    ],
    label:   'Empathy Kernel · Emotional Contagion v2.0.0',
    type:    'rust',
    aliases: ['empathy','empathy_kernel','contagion','hatfield','de_waal','kuramoto_empathy','valence'],
  },
  {
    // SCALE94-ENCYCLOPEDIA — Zipf-Mandelbrot Glyph Archive (compiled lexicon)
    // Hierarchical information taxonomy over N glyphs; Shannon entropy + Huffman code lengths.
    // n_glyphs:          args[0]  flags: --n, --glyphs
    // zipf_exponent:     args[1]  flags: --s, --zipf, --exponent
    // mandelbrot_offset: args[2]  flags: --q, --mandelbrot, --offset
    // entropy_target:    args[3]  flags: --h, --entropy, --target
    // tiers:             args[4]  flags: --tiers, --hierarchy
    id:      'SCALE94-ENCYCLOPEDIA',
    fn:      'run_glyph_archive',
    args:    [120.0, 1.0, 2.7, 6.0, 5.0],
    argMap:  {
      n: 0, glyphs: 0,
      s: 1, zipf: 1, exponent: 1,
      q: 2, mandelbrot: 2, offset: 2,
      h: 3, entropy: 3, target: 3,
      tiers: 4, hierarchy: 4,
    },
    params: [
      { name: 'n_glyphs',          default: 120.0, desc: 'glyph types in archive (10–200)' },
      { name: 'zipf_exponent',     default: 1.0,   desc: 'Zipf-Mandelbrot spectral exponent s (0.5–2.5; 1.0=natural)' },
      { name: 'mandelbrot_offset', default: 2.7,   desc: 'Mandelbrot offset q (0.0–5.0)' },
      { name: 'entropy_target',    default: 6.0,   desc: 'target entropy in bits (0.5–8.0)' },
      { name: 'tiers',             default: 5,     desc: 'hierarchy tiers (2–8)' },
    ],
    label:   'Scale94 Encyclopedia · Glyph Archive (Zipf-Mandelbrot)',
    type:    'rust',
    aliases: ['encyclopedia','scale94_encyclopedia','glyph_archive','zipf','mandelbrot','huffman','lexicon'],
  },
  {
    // COMPANION-KERNEL-2.0.0 — Sustained-Contact Long-Form Posture
    // Two-state Langevin over N discrete sessions; tracks trust load T and parasocial
    // index P. Refusals fire when P > θ_R ("the kernel names the drift").
    // sessions:           args[0]  flags: --sessions, --n
    // contact_intensity:  args[1]  flags: --contact, --intensity
    // drift_alpha:        args[2]  flags: --alpha, --drift
    // refusal_threshold:  args[3]  flags: --theta, --refusal
    // repair_beta:        args[4]  flags: --beta, --repair
    id:      'COMPANION-KERNEL-2.0.0',
    fn:      'run_companion',
    args:    [40.0, 0.6, 0.18, 0.45, 0.30],
    argMap:  {
      sessions: 0, n: 0,
      contact: 1, intensity: 1,
      alpha: 2, drift: 2,
      theta: 3, refusal: 3,
      beta: 4, repair: 4,
    },
    params: [
      { name: 'sessions',          default: 40.0, desc: 'sessions to simulate (5–200)' },
      { name: 'contact_intensity', default: 0.6,  desc: 'per-session contact heaviness (0.0–1.0)' },
      { name: 'drift_alpha',       default: 0.18, desc: 'parasocial drift accumulation rate (0.0–1.0)' },
      { name: 'refusal_threshold', default: 0.45, desc: 'P threshold above which kernel names it (0.05–1.0)' },
      { name: 'repair_beta',       default: 0.30, desc: 'correction strength when refusal fires (0.0–1.0)' },
    ],
    label:   'Companion Kernel · Sustained-Contact Posture v2.0.0',
    type:    'rust',
    aliases: ['companion','companion_kernel','sustained_contact','parasocial_drift','refusal_set'],
  },
  {
    // DISSIPATIVE-SOVEREIGNTY-KERNEL-5.0.0 — Sovereignty as Dissipation-Rate Control
    // Bak–Tang–Wiesenfeld sandpile on N×N grid; avalanche-size power law τ; MEPP score.
    // lattice_size: args[0]  flags: --n, --size, --lattice
    // drive_rate:   args[1]  flags: --eps, --drive, --rate
    // threshold:    args[2]  flags: --theta, --threshold
    // steps:        args[3]  flags: --steps, --t
    id:      'DISSIPATIVE-SOVEREIGNTY-KERNEL-5.0.0',
    fn:      'run_dissipative_sovereignty',
    args:    [16.0, 0.5, 4.0, 1500.0],
    argMap:  {
      n: 0, size: 0, lattice: 0,
      eps: 1, drive: 1, rate: 1,
      theta: 2, threshold: 2,
      steps: 3, t: 3,
    },
    params: [
      { name: 'lattice_size', default: 16.0,   desc: 'sites per side N (8–32; lattice has N² sites)' },
      { name: 'drive_rate',   default: 0.5,    desc: 'ε — probability of grain-add per step (0.0–1.0)' },
      { name: 'threshold',    default: 4.0,    desc: 'θ — toppling threshold (3.0–6.0)' },
      { name: 'steps',        default: 1500.0, desc: 'simulation steps (200–5000)' },
    ],
    label:   'Dissipative Sovereignty · BTW Sandpile + MEPP v5.0.0',
    type:    'rust',
    aliases: ['dissipative','dissipative_sovereignty','btw','sandpile','mepp','criticality','prigogine'],
  },
  {
    // MATRIX-KERNEL-2.0.0 — The No-Spoon Architecture / Filter Bypass
    // Signal + AR(1) noise pass through filter F; SPS gain when fatigue low; cage_render coeff.
    // filter_strength: args[0]  flags: --F, --filter
    // noise_sigma:     args[1]  flags: --sigma, --noise
    // autocorr:        args[2]  flags: --a, --autocorr
    // load_factor:     args[3]  flags: --load, --fatigue
    // steps:           args[4]  flags: --steps, --t
    id:      'MATRIX-KERNEL-2.0.0',
    fn:      'run_matrix_kernel',
    args:    [0.2, 0.8, 0.55, 0.10, 1200.0],
    argMap:  {
      f: 0, filter: 0,
      sigma: 1, noise: 1,
      a: 2, autocorr: 2,
      load: 3, fatigue: 3,
      steps: 4, t: 4,
    },
    params: [
      { name: 'filter_strength', default: 0.2,    desc: 'F — Matrix compliance (0.0=full bypass, 1.0=full filter)' },
      { name: 'noise_sigma',     default: 0.8,    desc: 'σ_n — environmental noise amplitude (0.0–2.0)' },
      { name: 'autocorr',        default: 0.55,   desc: 'a — noise autocorrelation (0.0–0.95; structure in the lücke)' },
      { name: 'load_factor',     default: 0.10,   desc: 'fatigue accumulation rate (0.0–1.0)' },
      { name: 'steps',           default: 1200.0, desc: 'simulation steps (200–4000)' },
    ],
    label:   'Matrix Kernel · No-Spoon Architecture v2.0.0',
    type:    'rust',
    aliases: ['matrix','matrix_kernel','no_spoon','filter_bypass','lucke','unbent','sps','adhd_i'],
  },
  {
    // Fade Doctrine — Zero White Fade · Crystalline Phase Lock v2.0.0
    // Seven axioms, color semiotic system, transition grammar, boot sequence timing.
    // entropy_level:         args[0]  flags: --entropy, --e
    // crystalline_threshold: args[1]  flags: --threshold, --t
    // axiom_index:           args[2]  flags: --axiom, --ax (1–7)
    id:      'FADE-DOCTRINE-KERNEL-2.0.0',
    fn:      'run_fade_doctrine',
    args:    [0.1, 0.5, 7.0],
    argMap:  {
      entropy: 0, e: 0,
      threshold: 1, t: 1,
      axiom: 2, ax: 2,
    },
    params: [
      { name: 'entropy_level',         default: 0.1, desc: 'current entropy level 0–1 (0=crystalline locked, 1=full entropy collapse)' },
      { name: 'crystalline_threshold', default: 0.5, desc: 'threshold for crystalline lock 0–1 (containment = (threshold−entropy)/threshold)' },
      { name: 'axiom_index',           default: 7.0, desc: '1=transmute 2=sustain 3=integrity 4=entropy 5=sovereignty 6=crystalline 7=apex_7.7.7.7.7.7.7' },
    ],
    label:   'Fade Doctrine · Zero White Fade v2.0.0',
    type:    'rust',
    aliases: ['fade', 'fade_doctrine', 'zero_white', 'crystalline_lock', 'color_semiotic', 'seven_axioms', 'white_fade'],
  },
  {
    // KERNEL 0.0.0.0 — The Origin Vector + Genesis Operation in 16-D feature space.
    // Demonstrates the degenerate properties of the zero vector (cos = 0/0, ||0|| = 0,
    // fixed under SO(16) rotation), then runs the Genesis Operation: inject ε in
    // a chosen dimension and trace the trajectory by which the vector "becomes"
    // a measurable position. Pure math, no external state, deterministic.
    //
    // genesis_dim: args[0]  flags: --dim, --axis, --genesis  (0–15, default 14 = biological)
    // epsilon:     args[1]  flags: --eps, --epsilon, --step  (default 1e-3)
    // steps:       args[2]  flags: --steps, --n, --trajectory (1–64, default 16)
    id:      'KERNEL-0.0.0.0',
    fn:      'run_kernel_zero',
    args:    [14, 0.001, 16],
    argMap:  {
      dim: 0, axis: 0, genesis: 0, genesisdim: 0,
      eps: 1, epsilon: 1, step: 1,
      steps: 2, n: 2, trajectory: 2,
    },
    params: [
      { name: 'genesis_dim', default: 14,    desc: 'which dim receives first ε (0–15: dynamical, nonlinearity, dimensionality, criticality, entropy, synchrony, conservation, temporal, spatial, stochastic, game_theory, thermodynamic, information, cryptographic, biological, economic)' },
      { name: 'epsilon',     default: 0.001, desc: 'magnitude of one genesis step (small positive float)' },
      { name: 'steps',       default: 16,    desc: 'number of ε increments to trace (1–64)' },
    ],
    label:   'KERNEL 0.0.0.0 · Origin Vector & Genesis Operation',
    type:    'rust',
    aliases: ['zero', 'origin', 'kernel_zero', 'genesis', 'apeiron', 'dhcp', 'unspecified', '0_0_0_0'],
  },

  // ── The five bespoke lore kernels (pinned in the kernel tab) ─────────────────
  // Keyed by the kernelBuilds card id so the card's [run] button (mobileAutoRun)
  // resolves directly to the bespoke kernel instead of falling through
  // resolveWasmAlias to a topically-adjacent legacy kernel.
  {
    // Hudelschublade — Chaos-Directory Routing. N directories with Shannon-clutter
    // levels; a sweep whose detection falls as local entropy rises. Payload in the
    // vault vs the chaos drawer; the Window Smile (zero-byte ACK) attenuates the loop.
    // cover_ratio drives STASH SURVIVES / SWEEP PARSED.
    id:      'HUDELSCHUBLADE-ROUTING-1.0',
    fn:      'run_chaos_routing',
    args:    [128, 0.82, 1.0, 0.2, 0.6, 5011],
    argMap:  {
      dirs: 0, n: 0, ndirs: 0,
      entropy: 1, clutter: 1, host: 1, hostentropy: 1,
      sweep: 2, aggression: 2,
      payload: 3, size: 3, payloadsize: 3,
      ack: 4, smile: 4, attenuation: 4,
      seed: 5,
    },
    params: [
      { name: 'n_dirs',          default: 128,  desc: 'directories in the host filesystem (2–512)' },
      { name: 'host_entropy',    default: 0.82, desc: 'the observer’s own clutter 0–1 — the cover that shields the stash' },
      { name: 'sweep_aggression',default: 1.0,  desc: 'security sweep intensity 0–2' },
      { name: 'payload_size',    default: 0.2,  desc: 'contraband exposure 0–1 — larger payload is easier to detect' },
      { name: 'ack_attenuation', default: 0.6,  desc: 'Window Smile 0–1 — zero-byte ACK that attenuates the scan loop' },
      { name: 'seed',            default: 5011, desc: 'PRNG seed for the directory clutter distribution' },
    ],
    label:   'Hudelschublade Routing · Chaos-Directory Exploit v1.0',
    type:    'rust',
    aliases: ['hudelschublade', 'chaos_routing', 'stash', 'sovereign_stash', 'chaos_drawer'],
  },
  {
    // Black Hole Taxonomy — a Galton-Watson lineage from one headless ancestor.
    // fork/death/necromancy recurrence; ancestral_load (ghost share of the live tree)
    // drives the arter97 verdict; caste census (noob/god/black-hole).
    id:      'BLACK-HOLE-TAXONOMY-1.0',
    fn:      'run_deep_kernel_descent',
    args:    [12, 1.4, 0.2, 0.25, 0.1, 97],
    argMap:  {
      generations: 0, gens: 0, depth: 0,
      fork: 1, forkrate: 1, birth: 1,
      revival: 2, necromancy: 2, revive: 2,
      caste: 3, castebias: 3, bias: 3,
      opacity: 4, ghostopacity: 4, documentation: 4,
      seed: 5,
    },
    params: [
      { name: 'generations',   default: 12,   desc: 'lineage depth — generations of forks (1–64)' },
      { name: 'fork_rate',     default: 1.4,  desc: 'children per node — >0.15 grows, <0.15 goes extinct' },
      { name: 'revival_rate',  default: 0.2,  desc: 'necromancy 0–1 — share of dead reanimated as independent orphans' },
      { name: 'caste_bias',    default: 0.25, desc: 'black-hole emergence bias 0–1 (higher = more bare-metal ancestors)' },
      { name: 'ghost_opacity', default: 0.1,  desc: 'documentation of the ancestor 0–1 (low = undocumented, faith load-bearing)' },
      { name: 'seed',          default: 97,   desc: 'PRNG seed for the branching texture' },
    ],
    label:   'Black Hole Taxonomy · Deep-Kernel Necromancy v1.0',
    type:    'rust',
    aliases: ['blackhole', 'black_hole', 'deep_kernel', 'descent', 'arter97', 'ghosts_of_xda'],
  },
  {
    // Semiotic Synthesis 9.9.9 — the transliteration chain nein→neun→999→996.
    // Each border-hop carries a sound↔meaning coupling; drift perturbs it; a hop is
    // cut unless it clears the threshold (Patch 5.8). purity drives socks/∞.
    id:      'SEMIOTIC-SYNTHESIS-9.9.9',
    fn:      'run_transliteration_chain',
    args:    [2457, 0.15, 0.5, 6, 0.9, 0.6],
    argMap:  {
      seed: 0, chainseed: 0,
      drift: 1, noise: 1, driftnoise: 1,
      coupling: 2, threshold: 2, gate: 2,
      borders: 3, hops: 3, bordercount: 3,
      filter: 4, temp: 4, filtertemp: 4,
      purity: 5, floor: 5, purityfloor: 5,
    },
    params: [
      { name: 'chain_seed',         default: 2457, desc: 'PRNG seed for per-hop drift (0x999)' },
      { name: 'drift_noise',        default: 0.15, desc: 'border drift 0–1 — perturbs each hop’s sound↔meaning coupling' },
      { name: 'coupling_threshold', default: 0.5,  desc: 'Patch 5.8 gate 0–1 — minimum co-linearity to admit a hop' },
      { name: 'border_count',       default: 6,    desc: 'hops of the canonical chain to attempt (2–6; 6 includes the 07:33 specimen)' },
      { name: 'filter_temp',        default: 0.9,  desc: 'sentiment-filter temperature — the misparse that files the curse as praise' },
      { name: 'purity_floor',       default: 0.6,  desc: 'minimum purity for the chain to compile as one utterance (0–1)' },
    ],
    label:   'Semiotic Synthesis 9.9.9 · Transliteration Chain v1.0',
    type:    'rust',
    aliases: ['semiotic', 'nnn', 'nein', 'transliteration', 'nein_nein_nein'],
  },
  {
    // Rossignol-Andalib 5.5.5.5 — four borders, one bird. Elemental accretion across
    // four element-borders + a ring-closure residual over five crossings. Calibration
    // (100 MT honest cut) tightens the ring. closure + balance drive RING CLOSES.
    id:      'ROSSIGNOL-ANDALIB-5.5.5.5',
    fn:      'run_ring_closure',
    args:    [100, 0.2, 5555, 0.25, 1.0, 0.15],
    argMap:  {
      calibration: 0, mt: 0, calib: 0,
      drift: 1, borderdrift: 1,
      seed: 2, spine: 2, spineseed: 2,
      tolerance: 3, elementtolerance: 3, balance: 3,
      accretion: 4, gain: 4, accretiongain: 4,
      closure: 5, threshold: 5, closurethreshold: 5,
    },
    params: [
      { name: 'calibration',       default: 100,  desc: 'the honest, cut-declaring label 0–100 MT — tightens every crossing' },
      { name: 'border_drift',      default: 0.2,  desc: 'per-crossing drift 0–1 — how far each border perturbs the bird' },
      { name: 'spine_seed',        default: 5555, desc: 'PRNG seed — the spine the fifth is compiled from' },
      { name: 'element_tolerance', default: 0.25, desc: 'max elemental imbalance (CV) for the four to hold (0–2)' },
      { name: 'accretion_gain',    default: 1.0,  desc: 'payload accreted at each element-border' },
      { name: 'closure_threshold', default: 0.15, desc: 'max closure residual (turns) for the ring to close (0–1)' },
    ],
    label:   'Rossignol-Andalib 5.5.5.5 · Ring Closure v1.0',
    type:    'rust',
    aliases: ['rossignol', 'andalib', 'nightingale', 'ring_closure', 'ruisenor', 'nachtigall'],
  },
  {
    // Fish Scale Genome — the pinned genome, read as one resonance: helicoidal
    // crack-deflection (Bouligand armor) + edge-of-death resonance (entropic stasis)
    // + the saponification grip window, fused into GENOME INTEGRITY.
    // Keyed by the card build id 'FISH-SCALE-11.1' — supersedes the card's old
    // borrowed necromantic-BPM run (the FISH-SCALE-KERNEL11.1.1 article-id entry,
    // run_necromantic_simulation, is left intact for legacy aliases + the linker).
    id:      'FISH-SCALE-11.1',
    fn:      'run_fish_scale_genome',
    args:    [3.55, 32, 36, 1.0, 0.5, 11],
    argMap:  {
      r: 0, pressure: 0, rpressure: 0,
      layers: 1, maxlayers: 1, plies: 1,
      theta: 2, angle: 2, thetaoffset: 2,
      burn: 3, sensitivity: 3, burnsensitivity: 3, saponification: 3,
      stasis: 4, temp: 4, stasistemp: 4,
      seed: 5, resonance: 5, resonanceseed: 5,
    },
    params: [
      { name: 'r_pressure',       default: 3.55, desc: 'sovereign-node load / thermodynamic pressure (0–4; burn window centred at 3.55)' },
      { name: 'max_layers',       default: 32,   desc: 'Bouligand helicoidal plies to stack (1–64)' },
      { name: 'theta_offset',     default: 36,   desc: 'interlaminar rotation per ply, degrees (1–90; Arapaima ≈ 36°)' },
      { name: 'burn_sensitivity', default: 1.0,  desc: 'saponification window width multiplier (0.1–2.0)' },
      { name: 'stasis_temp',      default: 0.5,  desc: 'thermal state 0–1 — resonance peaks at the edge (0.5); 0 frozen, 1 dissolved' },
      { name: 'resonance_seed',   default: 11,   desc: 'PRNG seed for the held-resonance texture' },
    ],
    label:   'Fish Scale Genome · Entropic Stasis / Necromantic Engine v1.0',
    type:    'rust',
    aliases: ['fish_genome', 'genome', 'fish_scale_genome', 'entropic_stasis', 'necromantic_engine'],
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

    // Also copy to src/wasm/ — Vite resolves the glue JS's import.meta.url to
    // src/wasm/, so the .wasm binary must exist there too during dev mode.
    const wasmSrcCopy = path.join(JS_OUT, 'scale94_kernels_bg.wasm');
    const wasmPkgPath = path.join(PKG_DIR, 'scale94_kernels_bg.wasm');
    if (fs.existsSync(wasmPkgPath)) {
      fs.copyFileSync(wasmPkgPath, wasmSrcCopy);
      log('  → src/wasm/scale94_kernels_bg.wasm (dev mirror)');
    }

    // Copy JS bindings to src/wasm/ (Vite processes these as proper ES modules)
    // Also copy to public/wasm/ — package.json there declares it as the module
    // main entry, so both copies must stay in sync or run_* lookups will fail.
    const jsSrc      = path.join(PKG_DIR,   'scale94_kernels.js');
    const jsDest     = path.join(JS_OUT,    'scale94_kernels.js');
    const jsDestPub  = path.join(WASM_OUT,  'scale94_kernels.js');
    if (fs.existsSync(jsSrc)) {
      fs.copyFileSync(jsSrc, jsDest);
      fs.copyFileSync(jsSrc, jsDestPub);
      log(`✓ Copied → src/wasm/scale94_kernels.js`);
      log(`✓ Copied → public/wasm/scale94_kernels.js`);
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

  // ── Step 5: Clear Vite bundle cache ─────────────────────────────────────────
  // Vite caches scale94_kernels.js in node_modules/.vite. If the cache is stale
  // (built before this WASM rebuild), the old JS glue calls wasm.<fn>() on a
  // binary that doesn't have the export → "wasm.run_<fn> is not a function".
  // Deleting the cache forces Vite to re-bundle the new bindings on next dev start.
  const viteCacheDir = path.join(ROOT, 'node_modules', '.vite');
  if (!DRY_RUN && fs.existsSync(viteCacheDir)) {
    try {
      fs.rmSync(viteCacheDir, { recursive: true, force: true });
      log(`✓ Cleared Vite cache (node_modules/.vite) — restart dev server`);
    } catch (e) {
      console.warn(`  ⚠ Could not clear Vite cache: ${e.message}`);
    }
  }

  console.log('');
}

run();

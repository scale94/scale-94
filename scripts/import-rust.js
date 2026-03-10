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

const DRY_RUN = process.argv.includes('--dry');
const DEV     = process.argv.includes('--dev');

// ─── WASM KERNEL REGISTRY ─────────────────────────────────────────────────────
// Maps Soma article IDs → WASM module metadata.
// boot:   the static method that returns the kernel's initial diagnostic string.
// struct: the wasm-bindgen class name in the compiled JS bindings.

const KERNEL_MAP = [
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
    aliases: ['soma_plus', 'somaplus', 'soma', 'social_capital', 'commons', 'status', 'contribution'],
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
    aliases: ['strangler', 'transition', 'stranglerfig', 'fig', 'adoption', 'legacy', 'logistic'],
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

  if (DRY_RUN) {
    log('[DRY RUN — wasm-pack will not be invoked]\n');
  }

  if (!fs.existsSync(RUST_DIR)) {
    console.error(`  ✗ Rust kernel directory not found: ${RUST_DIR}`);
    process.exit(1);
  }

  if (!fs.existsSync(path.join(RUST_DIR, 'Cargo.toml'))) {
    console.error(`  ✗ No Cargo.toml in ${RUST_DIR}`);
    process.exit(1);
  }

  // ── Step 1: Compile with wasm-pack ──────────────────────────────────────────
  if (!DRY_RUN) {
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
  } else {
    log('[DRY] Would run: wasm-pack build --target web --release');
  }

  // ── Step 2: Copy output artifacts ───────────────────────────────────────────
  //   .wasm binary  → public/wasm/   (served as a static asset)
  //   .js bindings  → src/wasm/      (bundled by Vite so dynamic import() works)
  if (!DRY_RUN) {
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
  } else {
    log('[DRY] Would copy scale94_kernels_bg.wasm → public/wasm/');
    log('[DRY] Would copy scale94_kernels.js      → src/wasm/');
  }

  // ── Step 3: Generate wasm.generated.js registry ─────────────────────────────
  const moduleUrl = '/wasm/scale94_kernels.js';

  const wasmUrl = '/wasm/scale94_kernels_bg.wasm';

  const entries = KERNEL_MAP.map(k => {
    const lines = [`  ${JSON.stringify(k.id)}: {`, `    id:      ${JSON.stringify(k.id)},`];
    if (k.fn) {
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
  } else {
    log(`[DRY] Would write wasm.generated.js (${KERNEL_MAP.length} kernel(s)):`);
    KERNEL_MAP.forEach(k => log(`  · ${k.id} → ${k.fn ? `${k.fn}()` : `${k.struct}.${k.boot}()`}`));
  }

  console.log('');
}

run();

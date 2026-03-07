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
const REGISTRY    = path.join(ROOT, 'src', 'terminal', 'data', 'wasm.generated.js');

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

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
const WASM_OUT    = path.join(ROOT, 'public', 'wasm');
const REGISTRY    = path.join(ROOT, 'src', 'terminal', 'data', 'wasm.generated.js');

const DRY_RUN = process.argv.includes('--dry');
const DEV     = process.argv.includes('--dev');

// ─── WASM KERNEL REGISTRY ─────────────────────────────────────────────────────
// Maps Soma article IDs → WASM module metadata.
// boot:   the static method that returns the kernel's initial diagnostic string.
// struct: the wasm-bindgen class name in the compiled JS bindings.

const KERNEL_MAP = [
  {
    id:     'BIODIVERSITY-KERNEL-1.0.1',
    struct: 'BiocoenosisKernel',
    boot:   'boot',
    label:  'Biocoenosis Kernel v1.0.1',
    type:   'rust',
  },
  {
    id:     'FISH-SCALE-KERNEL11.1.1',
    struct: 'NecromanticEngine',
    boot:   'boot',
    label:  'Necromantic Engine v11.1.1',
    type:   'rust',
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

  // ── Step 2: Copy output artifacts to public/wasm/ ───────────────────────────
  if (!DRY_RUN) {
    if (!fs.existsSync(WASM_OUT)) fs.mkdirSync(WASM_OUT, { recursive: true });

    // wasm-pack --target web emits these files in pkg/:
    //   scale94_kernels.js         — ES module JS bindings
    //   scale94_kernels_bg.wasm    — compiled WASM binary
    //   scale94_kernels_bg.js      — low-level glue
    //   scale94_kernels.d.ts       — TypeScript declarations (optional)
    const filesToCopy = [
      'scale94_kernels.js',
      'scale94_kernels_bg.wasm',
      'scale94_kernels_bg.js',
    ];

    let copied = 0;
    for (const f of filesToCopy) {
      if (copyPkgFile(f)) copied++;
    }
    log(`\n  ${copied}/${filesToCopy.length} artifact(s) copied → public/wasm/`);
  } else {
    log('[DRY] Would copy pkg/*.{js,wasm} → public/wasm/');
  }

  // ── Step 3: Generate wasm.generated.js registry ─────────────────────────────
  const moduleUrl = '/wasm/scale94_kernels.js';

  const entries = KERNEL_MAP.map(k =>
    [
      `  ${JSON.stringify(k.id)}: {`,
      `    id:     ${JSON.stringify(k.id)},`,
      `    struct: ${JSON.stringify(k.struct)},`,
      `    boot:   ${JSON.stringify(k.boot)},`,
      `    label:  ${JSON.stringify(k.label)},`,
      `    type:   'rust',`,
      `    module: ${JSON.stringify(moduleUrl)},`,
      `  }`,
    ].join('\n')
  );

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
    'export default wasmRegistry;',
    '',
  ].join('\n');

  if (!DRY_RUN) {
    atomicWrite(REGISTRY, src);
    log(`✓ Generated wasm.generated.js (${KERNEL_MAP.length} kernel(s) registered).`);
  } else {
    log(`[DRY] Would write wasm.generated.js (${KERNEL_MAP.length} kernel(s)):`);
    KERNEL_MAP.forEach(k => log(`  · ${k.id} → ${k.struct}.${k.boot}()`));
  }

  console.log('');
}

run();

// Test-only: instantiate the REAL shipped WASM binary synchronously in Node/jsdom,
// so crypto tests exercise the primitives that ship, never a mock.
// The browser path is src/wasm/wasmSingleton.js (fetch + async init).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as wasm from '../../src/wasm/scale94_kernels.js';

// Vitest runs from the repo root; jsdom gives import.meta.url a non-file scheme.
const BIN = resolve(process.cwd(), 'public/wasm/scale94_kernels_bg.wasm');
let ready = false;

export function loadWasmNode() {
  if (!ready) {
    wasm.initSync({ module: readFileSync(BIN) });
    ready = true;
  }
  return wasm;
}

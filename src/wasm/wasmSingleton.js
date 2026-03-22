// wasmSingleton.js — single shared WASM initializer for all tabs/hooks
// Mirrors the EcocideTab pattern: promise-deduplication so the .wasm binary
// is fetched and compiled only once regardless of how many modules call loadWasm().

import wasmRegistry from './wasm.generated';

let _mod       = null;
let _ready     = false;
let _waiters   = [];
let _initPromise = null;

export async function loadWasm() {
  if (_ready) return _mod;
  if (_initPromise) return _initPromise;

  _initPromise = new Promise((resolve, reject) => {
    _waiters.push({ resolve, reject });
    if (_waiters.length > 1) return;
    (async () => {
      try {
        const mod   = await import('./scale94_kernels.js');
        const entry = Object.values(wasmRegistry).find(e => e.wasmUrl);
        const url   = entry?.wasmUrl ?? '/wasm/scale94_kernels_bg.wasm';
        await mod.default({ module_or_path: url });
        _mod   = mod;
        _ready = true;
        _waiters.forEach(w => w.resolve(mod));
      } catch (err) {
        _waiters.forEach(w => w.reject(err));
      } finally {
        _waiters = [];
      }
    })();
  });

  return _initPromise;
}

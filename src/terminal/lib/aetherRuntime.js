// aetherRuntime.js — the one shared identity vault for this page (spec §5.2).
// Lazily wires the vault to the shared WASM singleton, the page's WebCrypto and
// IndexedDB, so the collider (crystallize) and /CRYPTOGRAPHY (identity panel)
// hold the same identity.
import { loadWasm } from '../../wasm/wasmSingleton';
import { createIdentityVault } from './identityVault.js';
import { openIdentityStore } from './identityStore.idb.js';
import { getSpine, reconcileScent } from '../quintessence/spineStore';

let vaultPromise = null;

export function getVault() {
  if (!vaultPromise) {
    vaultPromise = (async () => {
      const subtle = globalThis.crypto?.subtle;
      if (!subtle) throw new Error('no WebCrypto on this origin');
      const [wasm, store] = await Promise.all([loadWasm(), openIdentityStore()]);
      return createIdentityVault({
        wasm, subtle, store, getRandomValues: (a) => globalThis.crypto.getRandomValues(a),
      });
    })();
    vaultPromise.catch(() => { vaultPromise = null; });   // a later call may retry
  }
  return vaultPromise;
}

/** Shared deps for sealAccordForSpine. */
export const aetherDeps = () => ({ loadWasm, getVault });

// Boot, rotate and restore: compare the stored seal with this device's identity
// (plan ruling 6). Reads the fp straight from IndexedDB, so it needs no WASM and
// runs before the kernel has loaded. Only a store that opened and holds no record
// means the key is gone: a store that won't open or read is "unknown", and unknown
// never orphans (the key may still be on disk). Never throws.
export async function reconcileSpineAtBoot({ openStore = openIdentityStore } = {}) {
  try {
    if (!getSpine().scent) return;
    const store = await openStore();
    if (!store) return;
    const rec = await store.get('identity');
    reconcileScent(rec?.fp ?? null);
  } catch (e) {
    console.warn('[AETHER] reconcile skipped:', e?.message ?? e);
  }
}

export function _resetAetherRuntimeForTests() { vaultPromise = null; }

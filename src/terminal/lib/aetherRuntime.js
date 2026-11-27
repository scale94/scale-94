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
// (plan ruling 6). Nothing to compare, or no WebCrypto: nothing to do. Never throws.
export async function reconcileSpineAtBoot() {
  try {
    if (!getSpine().scent || !globalThis.crypto?.subtle) return;
    const identity = await (await getVault()).getIdentityIfExists();
    reconcileScent(identity?.fp ?? null);
  } catch (e) {
    console.warn('[AETHER] reconcile skipped:', e?.message ?? e);
  }
}

export function _resetAetherRuntimeForTests() { vaultPromise = null; }

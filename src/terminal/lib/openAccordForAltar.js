// openAccordForAltar.js — the compile is the unsealing (spec §3 decision 17, §5.3).
//
// spine.scent.envelope → ML-KEM-768 decaps → BLAKE3 derive_key → AES-256-GCM open
//   → { baseAccord, salt, envelopeMeta } for compileKernel, or a named state.
//
// Never throws. Each failure is a state the altar names, and the spine learns
// what the altar learned (P3 ruling 2):
//   orphaned               → the mark falls as SEAL ORPHANED (the key is not held here)
//   tampered / malformed   → the mark falls as SEAL BROKEN (re-crystallize)
//   no-webcrypto / wasm-unavailable / error → the spine is untouched (the key may be fine)
import { aetherDeps } from './aetherRuntime.js';
import { unsealAccord, envelopeSizes } from './accordSeal.js';
import {
  reconcileScent, markScentBroken, SCENT_ORPHANED, SCENT_BROKEN,
} from '../quintessence/spineStore';

export const ALTAR_LINES = Object.freeze({
  orphaned: SCENT_ORPHANED,
  tampered: SCENT_BROKEN,
  malformed: SCENT_BROKEN,
  'no-webcrypto': 'THE ACCORD CANNOT OPEN ON THIS ORIGIN — no WebCrypto',
  'wasm-unavailable': 'THE ACCORD CANNOT OPEN ON THIS ORIGIN — the kernel did not load',
  error: 'THE ACCORD DID NOT OPEN — an unexpected fault; the seal is untouched',
});

const named = (state) => ({ state, line: ALTAR_LINES[state] });

export async function openAccordForAltar(spine, {
  loadWasm = aetherDeps().loadWasm,
  getVault = aetherDeps().getVault,
  subtle = globalThis.crypto?.subtle,
} = {}) {
  const envelope = spine?.scent?.envelope;
  if (!envelope) return named('malformed');
  if (!subtle) return named('no-webcrypto');

  let wasm;
  try { wasm = await loadWasm(); }
  catch (_) { return named('wasm-unavailable'); }

  try {
    const vault = await getVault();
    const identity = await vault.getIdentityIfExists();
    const r = await unsealAccord(envelope, identity, { wasm, subtle, unwrapSecrets: vault.unwrapSecrets });
    if (r.state === 'ok') {
      const sizes = envelopeSizes(envelope);
      return {
        state: 'ok',
        baseAccord: r.baseAccord,
        salt: r.salt,
        envelopeMeta: {
          kem: envelope.kem, kdf: envelope.kdf, aead: envelope.aead,
          ctBytes: sizes.ct, aeadBytes: sizes.aead, fp: envelope.fp,
        },
      };
    }
    // Orphaned covers "no identity", "another identity" and "secrets would not
    // unwrap". In every case this device cannot open the seal, so the mark falls;
    // a boot reconcile with a matching fp restores it if the cause was transient.
    if (r.state === 'orphaned') reconcileScent(null);
    else if (r.state === 'tampered' || r.state === 'malformed') markScentBroken();
    return named(r.state);
  } catch (e) {
    console.warn('[AETHER] the altar could not open the accord:', e?.message ?? e);
    return named('error');
  }
}

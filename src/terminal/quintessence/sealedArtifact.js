// src/terminal/quintessence/sealedArtifact.js — the one read path to the seal.
// The volatile hold first: it can only exist in THIS session, so when present
// it is always the most recent compile (covers quota-exceeded recompiles over
// an older persisted seal). Otherwise the sealed vial from storage (spec §7).
// Four consumers touch the seal — the reliquary panel, the kernel dashboard's
// reserved slot, the Mercury altar, and the break-the-seal ceremony — so both
// the read and the break live here, once. The storage key lives here too:
// storage concerns belong to the storage module, not to a React component.
import { heldVolatile, holdVolatile } from './volatileHold';

export const STORAGE_KEY = 'quintessence_kernel_v1';

export function loadSealedArtifact() {
  const held = heldVolatile();
  if (held) return held;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) { /* unwitnessed */ }
  return null;
}

// Break the seal (spec §7): the vial is destroyed, the altar re-arms.
export function clearSealedArtifact() {
  holdVolatile(null);
  try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* unwitnessed */ }
}

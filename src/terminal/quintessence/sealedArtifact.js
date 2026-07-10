// src/terminal/quintessence/sealedArtifact.js — the one read path to the seal.
// The volatile hold first: it can only exist in THIS session, so when present
// it is always the most recent compile (covers quota-exceeded recompiles over
// an older persisted seal). Otherwise the sealed vial from storage (spec §7).
// Three consumers now read the seal — the reliquary panel, the kernel dashboard's
// reserved slot, and the Mercury altar — so the read lives here, once.
import { heldVolatile } from './volatileHold';
import { STORAGE_KEY } from '../mercury/QuintessenceAltar';

export function loadSealedArtifact() {
  const held = heldVolatile();
  if (held) return held;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) { /* unwitnessed */ }
  return null;
}

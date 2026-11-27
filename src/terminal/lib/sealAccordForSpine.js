// sealAccordForSpine.js — crystallize is the sealing moment (spec §3 decision 3, §5.3).
//
// card → base accord (P1 kit + note interpretation) + a fresh 32-byte chaos salt
//      → sealed under the visitor's ML-KEM-768 identity → spine.scent (envelope only).
//
// Never throws. Every way this can fail is a named result the card can print. An
// unsealed card never fills the fourth mark (spec §6.6): setScent is reached only
// with a real envelope.
import { buildBaseAccord, drawChaosSalt } from '../scent/baseAccord';
import { MATERIALS } from '../scent/materials';
import { NOTE_MATERIALS } from '../scent/noteInterpretation';
import { getSpine, reconcileScent, setScent } from '../quintessence/spineStore';
import { isScentMarked } from '../quintessence/vertebrae';
import { sealAccord, envelopeSizes } from './accordSeal.js';

export async function sealAccordForSpine(card, {
  subtle = globalThis.crypto?.subtle,
  getRandomValues = globalThis.crypto?.getRandomValues ? (a) => globalThis.crypto.getRandomValues(a) : undefined,
  loadWasm,
  getVault,
  now = Date.now,
  noteMaterials = NOTE_MATERIALS,
  kit = MATERIALS,
} = {}) {
  if (!subtle || !getRandomValues) return { state: 'unsealed', reason: 'no-webcrypto' };

  let wasm;
  try { wasm = await loadWasm(); }
  catch (_) { return { state: 'unsealed', reason: 'wasm-unavailable' }; }

  try {
    const baseAccord = buildBaseAccord(card, noteMaterials, kit);
    const salt = drawChaosSalt(getRandomValues);
    const vault = await getVault();
    const identity = await vault.getOrCreateIdentity();
    // A volatile identity dies with the tab. It must not replace a sealed accord
    // that a persisted key can still open (final review I1c).
    const held = getSpine();
    if (identity.volatile && isScentMarked(held) && held.scent.fp !== identity.fp) {
      salt.fill(0);
      return { state: 'unsealed', reason: 'volatile-kept' };
    }
    const envelope = await sealAccord({ baseAccord, salt }, identity, { wasm, subtle, getRandomValues });
    salt.fill(0);
    setScent({ envelope, cardName: card.name, sealedAt: now(), fp: identity.fp });
    // A rotate or restore that landed while this seal was in flight has already
    // reconciled the old spine; check the new seal against the settled identity.
    const settled = await vault.getIdentityIfExists();
    if (settled?.fp !== identity.fp) reconcileScent(settled?.fp ?? null);
    return { state: 'sealed', fp: identity.fp, volatile: identity.volatile, sizes: envelopeSizes(envelope) };
  } catch (e) {
    console.error('[AETHER] seal failed:', e);
    return { state: 'unsealed', reason: 'error' };
  }
}

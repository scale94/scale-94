// Turns a collider card's poetic notes into the formula engine's baseAccord.
// Pure: no React, DOM, GL, WASM or WebCrypto. The note → material mapping is
// supplied by the caller (it comes from the author-approved kit research);
// nothing here knows any chemistry.

const CARD_LAYERS = [['top', 'topNotes'], ['heart', 'heartNotes'], ['base', 'baseNotes']];

export function buildBaseAccord(card, noteMaterials, kit) {
  const kitIds = new Set(kit.map((m) => m.id));
  const notes = [];
  const sums = new Map(); // Map keeps first-appearance order

  for (const [cardLayer, key] of CARD_LAYERS) {
    for (const note of card[key] || []) {
      const mapping = Object.prototype.hasOwnProperty.call(noteMaterials, note)
        ? noteMaterials[note] : undefined;
      if (!Array.isArray(mapping) || mapping.length === 0) {
        throw new Error(`no material mapping for note "${note}"`);
      }
      let total = 0;
      for (const { materialId, parts } of mapping) {
        if (!kitIds.has(materialId)) {
          throw new Error(`note "${note}" maps to "${materialId}", which is not in the kit`);
        }
        if (typeof parts !== 'number' || !Number.isFinite(parts) || parts <= 0) {
          throw new Error(`note "${note}": parts for "${materialId}" must be a positive finite number`);
        }
        total += parts;
      }
      const materials = mapping.map(({ materialId, parts }) => ({
        materialId, parts: parts / total,
      }));
      for (const m of materials) {
        sums.set(m.materialId, (sums.get(m.materialId) || 0) + m.parts);
      }
      notes.push({ note, cardLayer, materials });
    }
  }

  const rows = [...sums].map(([materialId, parts]) => ({ materialId, parts }));
  return { rows, notes };
}

// The chaos salt (spec §5.1): 32 random bytes drawn at seal time, the only
// non-deterministic input to the accord. The RNG is injected (crypto.getRandomValues
// in the host) so this module stays pure.
export function drawChaosSalt(getRandomValues) {
  return getRandomValues(new Uint8Array(32));
}

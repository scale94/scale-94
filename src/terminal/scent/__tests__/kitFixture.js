// Test-only fixture kit. Every name, id and CAS placeholder here is fictional;
// no value is real chemistry. Product code must never import this file.
//
// Shape follows the kit row schema (spec §7.1):
//   { id, name, cas, layer, role, stocks, ifraCat4MaxPct, solubility, sources }
//
// Designed so the engine's paths are exercised in every element × batch case:
//   - fx-heart-veil carries a binding ifraCat4MaxPct (0.2) → always capped.
//   - fx-heart-mote has tiny parts and stocks [1.0, 0.1, 0.01] → always under
//     0.05 g at stock 1.0, so it is weighed from a weaker stock.
//   - fx-base-dust is 1%-only with tiny parts → always drops out.

const fxSources = { casSource: 'fixture', ifraSource: 'fixture' };

export const FX_KIT = [
  { id: 'fx-top-glint', name: 'Fixture Glint', cas: 'FX-0001', layer: 'top', role: 'lift',
    stocks: [1.0, 0.1], ifraCat4MaxPct: 5, solubility: null, sources: fxSources },
  { id: 'fx-top-spark', name: 'Fixture Spark', cas: 'FX-0002', layer: 'top', role: 'lift',
    stocks: [0.1, 0.01], ifraCat4MaxPct: null, solubility: null, sources: fxSources },
  { id: 'fx-top-hush', name: 'Fixture Hush', cas: 'FX-0003', layer: 'top', role: 'bridge',
    stocks: [1.0, 0.1, 0.01], ifraCat4MaxPct: 3, solubility: null, sources: fxSources },

  { id: 'fx-heart-veil', name: 'Fixture Veil', cas: 'FX-0004', layer: 'heart', role: 'body',
    stocks: [1.0, 0.1], ifraCat4MaxPct: 0.2, solubility: null, sources: fxSources },
  { id: 'fx-heart-bloom', name: 'Fixture Bloom', cas: 'FX-0005', layer: 'heart', role: 'body',
    stocks: [1.0, 0.1], ifraCat4MaxPct: null, solubility: null, sources: fxSources },
  { id: 'fx-heart-mote', name: 'Fixture Mote', cas: 'FX-0006', layer: 'heart', role: 'accent',
    stocks: [1.0, 0.1, 0.01], ifraCat4MaxPct: 2, solubility: null, sources: fxSources },

  { id: 'fx-base-root', name: 'Fixture Root', cas: 'FX-0007', layer: 'base', role: 'fixative',
    stocks: [1.0], ifraCat4MaxPct: null, solubility: null, sources: fxSources },
  { id: 'fx-base-amber', name: 'Fixture Amber', cas: 'FX-0008', layer: 'base', role: 'fixative',
    stocks: [0.5], ifraCat4MaxPct: 10, solubility: 'fixture', sources: fxSources },
  { id: 'fx-base-dust', name: 'Fixture Dust', cas: 'FX-0009', layer: 'base', role: 'trace',
    stocks: [0.01], ifraCat4MaxPct: 1, solubility: null, sources: fxSources },
];

// Raw layer parts: top 30, heart 31, base 40.005 → top is out of band and
// must be projected (clamped to 25, residual spread to heart/base).
export const FX_ACCORD = {
  rows: [
    { materialId: 'fx-top-glint', parts: 15 },
    { materialId: 'fx-top-spark', parts: 10 },
    { materialId: 'fx-top-hush', parts: 5 },
    { materialId: 'fx-heart-veil', parts: 15 },
    { materialId: 'fx-heart-bloom', parts: 15 },
    { materialId: 'fx-heart-mote', parts: 1 },
    { materialId: 'fx-base-root', parts: 25 },
    { materialId: 'fx-base-amber', parts: 15 },
    { materialId: 'fx-base-dust', parts: 0.005 },
  ],
};

// Maps exactly the notes of buildPerfumeCard(FIXTURES[0]) onto FX_KIT ids.
// Pink Grapefruit splits 3:1; Mimosa and Birch share fx-heart-bloom; White Musk
// and Birch Tar share fx-base-root. Every engine layer gets at least one material.
export const FX_NOTE_MATERIALS = {
  'Pink Grapefruit': [{ materialId: 'fx-top-glint', parts: 3 }, { materialId: 'fx-top-hush', parts: 1 }],
  'Cistus': [{ materialId: 'fx-top-spark', parts: 1 }],
  'Mimosa': [{ materialId: 'fx-heart-bloom', parts: 1 }],
  'Birch': [{ materialId: 'fx-heart-bloom', parts: 1 }, { materialId: 'fx-heart-veil', parts: 1 }],
  'White Musk': [{ materialId: 'fx-base-root', parts: 1 }],
  'Birch Tar': [{ materialId: 'fx-base-root', parts: 2 }, { materialId: 'fx-base-amber', parts: 1 }],
};

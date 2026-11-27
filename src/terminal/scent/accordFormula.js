// The opened accord becomes the formula on the compiled artifact (spec §5.3,
// §5.4; P3 ruling 6). Pure: no React, DOM, GL, WASM or WebCrypto.
//
//   (opened accord + salt, spine element/phase + periphery, envelope meta)
//     → { v:1, state, batches:{ small, large }, notes, envelope, modulators, sources }
//
// Both batches compile from the one opened accord: the salt is never stored
// (opened vial, decision 17), so a batch chosen later could not be recomputed.
// A batch the engine cannot satisfy is stored as { state:'infeasible', reason, batch };
// nothing here ever fakes a formula to fill the slot.
import { computeFormula, BATCHES, FormulaInfeasible } from './formulaEngine';
import { readModulators } from './modulators';
import { MATERIALS } from './materials';

export const FORMULA_V = 1;

export function buildAccordFormula({ baseAccord, salt }, { element, phase, periphery }, envelopeMeta, kit = MATERIALS) {
  const m = readModulators({ element, phase, periphery });
  const modulators = {
    element: m.element, restWeeks: m.restWeeks, solTilt: m.solTilt, chaosReach: m.chaosReach,
  };
  const batches = {};
  for (const [name, batch] of Object.entries(BATCHES)) {
    try {
      batches[name] = { state: 'ok', ...computeFormula({ baseAccord, salt, batch, kit, modulators: { ...modulators, labels: m.labels } }) };
    } catch (err) {
      if (!(err instanceof FormulaInfeasible)) throw err;
      batches[name] = { state: 'infeasible', reason: err.message, batch: { grams: batch.grams, vialMl: batch.vialMl } };
    }
  }
  const anyOk = Object.values(batches).some((b) => b.state === 'ok');
  return {
    v: FORMULA_V,
    state: anyOk ? 'ok' : 'infeasible',
    batches,
    notes: baseAccord.notes ?? [],
    envelope: { ...envelopeMeta },
    modulators,
    sources: m.sources,
  };
}

// Fragrance formula engine (spec §7.2). Pure: no React, DOM, GL, WASM or WebCrypto.
//
// computeFormula turns a base accord (parts per kit material) plus the
// modulators into a weighable formula for one batch. The pipeline is factored
// into small pure steps so later tasks can insert modulation between them:
//
//   rawLayerShares → projectToBands → [sol tilt, Task 2] → neatGramsByRow
//   → [chaos per-row drift, Task 2] → settle (IFRA cap ⇄ stock selection)
//   → roundWeighed (largest remainder) → ifraStepDown → assemble (+ strength guard)
//
// `salt`, `modulators.solTilt` and `modulators.chaosReach` are accepted but
// unused here (Task 2).

export const TARGET_PCT = Object.freeze({ AIR: 4, WATER: 10, EARTH: 18, FIRE: 25 });
export const BANDS = Object.freeze({ top: [15, 25], heart: [30, 40], base: [40, 55] });
export const BATCHES = Object.freeze({
  small: Object.freeze({ grams: 7.0, vialMl: 10 }),
  large: Object.freeze({ grams: 10.0, vialMl: 15 }),
});
export const MIN_WEIGH_G = 0.05;
export const ETHANOL_G_PER_ML = 0.789;
export const FILL_MAX = 0.9;
export const STRENGTH_TOL_PT = 0.5;

export const LAYERS = Object.freeze(['top', 'heart', 'base']);

const TYPE_NAMES = Object.freeze({
  AIR: 'Eau de Cologne',
  WATER: 'Eau de Toilette',
  EARTH: 'Eau de Parfum',
  FIRE: 'Extrait',
});

// Tolerance for float comparisons against the 0.05 g floor.
const WEIGH_EPS = 1e-12;

export class FormulaInfeasible extends Error {
  constructor(message, { layer = null, materialId = null } = {}) {
    super(message);
    this.name = 'FormulaInfeasible';
    this.layer = layer;
    this.materialId = materialId;
  }
}

export const round2 = (x) => Math.round(x * 100) / 100;
const round9 = (x) => Math.round(x * 1e9) / 1e9;
const stockLabel = (s) => `${+(s * 100).toFixed(4)}%`;

// ── validation ──────────────────────────────────────────────────────────────

function validate(modulators, batch) {
  const { element, restWeeks } = modulators || {};
  if (!Object.prototype.hasOwnProperty.call(TARGET_PCT, element)) {
    throw new RangeError(`unknown element: ${String(element)}`);
  }
  if (!Number.isInteger(restWeeks) || restWeeks < 2 || restWeeks > 8) {
    throw new RangeError(`restWeeks must be an integer in 2–8, got ${String(restWeeks)}`);
  }
  if (!batch || !(batch.grams > 0) || !(batch.vialMl > 0)) {
    throw new RangeError('batch must have positive grams and vialMl');
  }
  if (batch.grams / ETHANOL_G_PER_ML > FILL_MAX * batch.vialMl) {
    throw new RangeError('batch overfills its vial');
  }
}

// ── step 0: join the accord to the kit ──────────────────────────────────────

export function joinAccord(baseAccord, kit) {
  const byId = new Map(kit.map((m) => [m.id, m]));
  return baseAccord.rows.map(({ materialId, parts }) => {
    const material = byId.get(materialId);
    if (!material) throw new RangeError(`material not in kit: ${materialId}`);
    if (!LAYERS.includes(material.layer)) throw new RangeError(`bad layer on ${materialId}`);
    if (!(parts > 0)) throw new RangeError(`parts must be positive on ${materialId}`);
    const stocks = [...material.stocks].sort((a, b) => b - a);
    return { materialId, parts, material, layer: material.layer, stocks };
  });
}

// ── step 1: layer shares, projected into the bands ──────────────────────────

export function rawLayerShares(rows) {
  const sums = { top: 0, heart: 0, base: 0 };
  for (const r of rows) sums[r.layer] += r.parts;
  const total = sums.top + sums.heart + sums.base;
  return { top: (sums.top / total) * 100, heart: (sums.heart / total) * 100, base: (sums.base / total) * 100 };
}

// Clamp each share into its band, then spread the residual across the layers
// that still have room, in proportion to that room; repeat until < 1e-12.
export function projectToBands(shares) {
  const s = {};
  for (const k of LAYERS) s[k] = Math.min(BANDS[k][1], Math.max(BANDS[k][0], shares[k]));
  for (let iter = 0; iter < 64; iter++) {
    const residual = 100 - (s.top + s.heart + s.base);
    if (Math.abs(residual) < 1e-12) break;
    const room = {};
    let roomSum = 0;
    for (const k of LAYERS) {
      room[k] = residual > 0 ? BANDS[k][1] - s[k] : s[k] - BANDS[k][0];
      if (room[k] < 0) room[k] = 0;
      roomSum += room[k];
    }
    if (!(roomSum > 0)) {
      throw new FormulaInfeasible(`bands cannot absorb a residual of ${residual} pt`);
    }
    for (const k of LAYERS) {
      const next = s[k] + residual * (room[k] / roomSum);
      s[k] = Math.min(BANDS[k][1], Math.max(BANDS[k][0], next));
    }
  }
  return s;
}

// ── step 2: neat grams per row ──────────────────────────────────────────────

export function neatGramsByRow(rows, layerShares, concentrateG) {
  const layerParts = { top: 0, heart: 0, base: 0 };
  for (const r of rows) layerParts[r.layer] += r.parts;
  return rows.map((r) => concentrateG * (layerShares[r.layer] / 100) * (r.parts / layerParts[r.layer]));
}

// ── step 3: IFRA cap pass ───────────────────────────────────────────────────

// Caps every active row whose neat grams exceed its limit, giving the excess
// to the uncapped active rows of its layer in proportion to their parts.
// Returns a new neat array. Throws FormulaInfeasible when a layer runs out of
// uncapped rows.
export function applyIfraCaps(rows, neat, active, batchG) {
  const out = neat.slice();
  const capped = new Set();
  for (let iter = 0; iter <= rows.length; iter++) {
    let changed = false;
    for (let i = 0; i < rows.length; i++) {
      if (!active[i] || capped.has(i)) continue;
      const limitPct = rows[i].material.ifraCat4MaxPct;
      if (limitPct == null) continue;
      const limitG = (limitPct / 100) * batchG;
      if (out[i] <= limitG) continue;
      const excess = out[i] - limitG;
      out[i] = limitG;
      capped.add(i);
      changed = true;
      const takers = [];
      let takerParts = 0;
      for (let j = 0; j < rows.length; j++) {
        if (j !== i && active[j] && !capped.has(j) && rows[j].layer === rows[i].layer) {
          takers.push(j);
          takerParts += rows[j].parts;
        }
      }
      if (takers.length === 0) {
        throw new FormulaInfeasible(
          `IFRA: no uncapped ${rows[i].layer} row left to take ${rows[i].materialId}'s excess`,
          { layer: rows[i].layer, materialId: rows[i].materialId },
        );
      }
      for (const j of takers) out[j] += excess * (rows[j].parts / takerParts);
    }
    if (!changed) break;
  }
  return out;
}

// ── step 4: stock selection ─────────────────────────────────────────────────

// Strongest stock s (stocks sorted descending) with neat / s ≥ MIN_WEIGH_G,
// or null when even the weakest stock weighs under the floor.
export function selectStock(stocks, neatG) {
  for (const s of stocks) if (neatG / s >= MIN_WEIGH_G - WEIGH_EPS) return s;
  return null;
}

// Settles IFRA caps and stock selection together (ruling R1): cap, select,
// and if a row fits no stock, drop the worst such row, hand its neat grams to
// its layer's remaining rows by parts, and go again until stable.
export function settle(rows, neat0, batchG) {
  const active = rows.map(() => true);
  let neat = neat0.slice();
  const dropped = [];
  for (let iter = 0; iter <= rows.length; iter++) {
    neat = applyIfraCaps(rows, neat, active, batchG);
    let worst = -1;
    let worstRatio = Infinity;
    for (let i = 0; i < rows.length; i++) {
      if (!active[i]) continue;
      if (selectStock(rows[i].stocks, neat[i]) !== null) continue;
      const ratio = neat[i] / rows[i].stocks[rows[i].stocks.length - 1];
      if (ratio < worstRatio) { worstRatio = ratio; worst = i; }
    }
    if (worst < 0) {
      const stocks = rows.map((r, i) => (active[i] ? selectStock(r.stocks, neat[i]) : null));
      return { active, neat, stocks, dropped };
    }
    const r = rows[worst];
    const weakest = r.stocks[r.stocks.length - 1];
    dropped.push({
      materialId: r.materialId,
      reason: `under ${MIN_WEIGH_G.toFixed(2)} g even from its weakest stock (${stockLabel(weakest)})`,
      index: worst,
    });
    active[worst] = false;
    const heirs = [];
    let heirParts = 0;
    for (let j = 0; j < rows.length; j++) {
      if (active[j] && rows[j].layer === r.layer) { heirs.push(j); heirParts += rows[j].parts; }
    }
    if (heirs.length === 0) {
      throw new FormulaInfeasible(
        `every ${r.layer} row dropped out (last: ${r.materialId})`,
        { layer: r.layer, materialId: r.materialId },
      );
    }
    for (const j of heirs) neat[j] += neat[worst] * (rows[j].parts / heirParts);
    neat[worst] = 0;
  }
  throw new FormulaInfeasible('formula did not settle');
}

// ── step 5: round weighed grams (largest remainder, ruling R2) ──────────────

// Every active row is weighed at floor(exact, 0.01 g) or one grain above it.
// Rows take their extra grain in order of largest remainder, but only while
// that brings Σ neat grams closer to `targetNeatG` and keeps the row under its
// IFRA limit. Plain per-row rounding can drift many grains the same way; this
// keeps Σ neat within about half a grain × stock of the target.
export function roundWeighed(rows, neat, stocks, active, batchG, targetNeatG) {
  const grams = neat.map(() => 0);
  const order = [];
  let deficit = targetNeatG;
  for (let i = 0; i < rows.length; i++) {
    if (!active[i]) continue;
    const exact = neat[i] / stocks[i];
    const floor = Math.max(MIN_WEIGH_G, Math.floor(exact * 100 + 1e-9) / 100);
    grams[i] = round2(floor);
    deficit -= grams[i] * stocks[i];
    order.push({ i, rem: exact - grams[i] });
  }
  order.sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const { i } of order) {
    const step = 0.01 * stocks[i];
    if (!(Math.abs(deficit - step) < Math.abs(deficit))) continue;
    const up = round2(grams[i] + 0.01);
    const limitPct = rows[i].material.ifraCat4MaxPct;
    if (limitPct != null && neatPctOf(up, stocks[i], batchG) > limitPct) continue;
    grams[i] = up;
    deficit -= step;
  }
  return grams;
}

// Final guard: the ±0.5 pt strength invariant is never returned violated.
export function assertStrength(actualPct, targetPct) {
  if (!(Math.abs(actualPct - targetPct) <= STRENGTH_TOL_PT)) {
    throw new FormulaInfeasible(
      `strength ${actualPct}% is outside ${targetPct} ± ${STRENGTH_TOL_PT} pt`,
    );
  }
}

const neatPctOf = (grams, stock, batchG) => round9(((grams * stock) / batchG) * 100);

// ── step 6: IFRA step-down after rounding ───────────────────────────────────

export function ifraStepDown(rows, grams, stocks, active, batchG) {
  const out = grams.slice();
  const lines = [];
  for (let i = 0; i < rows.length; i++) {
    if (!active[i]) continue;
    const limitPct = rows[i].material.ifraCat4MaxPct;
    if (limitPct == null) continue;
    while (neatPctOf(out[i], stocks[i], batchG) > limitPct && out[i] > MIN_WEIGH_G) {
      out[i] = round2(out[i] - 0.01);
      lines.push(`IFRA ${rows[i].material.name} stepped down 0.01 g → ${out[i].toFixed(2)} g`);
    }
    if (neatPctOf(out[i], stocks[i], batchG) > limitPct) {
      throw new FormulaInfeasible(
        `IFRA: ${rows[i].materialId} cannot be weighed under its limit`,
        { layer: rows[i].layer, materialId: rows[i].materialId },
      );
    }
  }
  return { grams: out, lines };
}

// ── assemble ────────────────────────────────────────────────────────────────

export function computeFormula({ baseAccord, salt, modulators, batch, kit }) {
  void salt; // sealed /CHAOS salt: used from Task 2 on
  validate(modulators, batch);
  const { element, restWeeks } = modulators;
  const targetPct = TARGET_PCT[element];
  const batchG = batch.grams;

  const rows = joinAccord(baseAccord, kit);
  const layerSplit = projectToBands(rawLayerShares(rows));
  for (const k of LAYERS) {
    if (!rows.some((r) => r.layer === k)) {
      throw new FormulaInfeasible(`accord has no ${k} row`, { layer: k });
    }
  }
  const concentrateG = (batchG * targetPct) / 100;
  const neat0 = neatGramsByRow(rows, layerSplit, concentrateG);

  const { active, neat, stocks, dropped } = settle(rows, neat0, batchG);
  const rounded = roundWeighed(rows, neat, stocks, active, batchG, concentrateG);
  const { grams, lines: stepLines } = ifraStepDown(rows, rounded, stocks, active, batchG);

  const outRows = [];
  const ifra = [];
  let neatSum = 0;
  let weighedSum = 0;
  for (let i = 0; i < rows.length; i++) {
    if (!active[i]) continue;
    const r = rows[i];
    const neatPct = neatPctOf(grams[i], stocks[i], batchG);
    neatSum += grams[i] * stocks[i];
    weighedSum += grams[i];
    outRows.push({
      materialId: r.materialId,
      name: r.material.name,
      cas: r.material.cas,
      layer: r.layer,
      stock: stocks[i],
      grams: grams[i],
      neatPct,
    });
    const limitPct = r.material.ifraCat4MaxPct;
    if (limitPct != null) {
      ifra.push({ materialId: r.materialId, neatPct, limitPct, ok: neatPct <= limitPct });
    }
  }

  const actualPct = round9((neatSum / batchG) * 100);
  assertStrength(actualPct, targetPct);

  const alcoholGrams = round2(batchG - weighedSum);
  if (alcoholGrams < 0) {
    throw new FormulaInfeasible('weighed stocks exceed the batch weight');
  }

  const dropLines = dropped.map((d) => {
    const r = rows[d.index];
    return `DROP ${r.material.name} · ${d.reason} → its share goes to the ${r.layer}`;
  });

  const log = [
    `ELEMENT ${element} → ${TYPE_NAMES[element]} · ${targetPct.toFixed(1)}% concentrate`,
    `/LUNAR → ${restWeeks} weeks in the dark`,
    ...stepLines,
    ...dropLines,
  ];

  return {
    element,
    targetPct,
    actualPct,
    batch: { grams: batch.grams, vialMl: batch.vialMl },
    fillMl: batchG / ETHANOL_G_PER_ML,
    rows: outRows,
    alcoholGrams,
    layerSplit: { top: layerSplit.top, heart: layerSplit.heart, base: layerSplit.base },
    restWeeks,
    ifra,
    dropped: dropped.map(({ materialId, reason }) => ({ materialId, reason })),
    log,
  };
}

// Fragrance formula engine (spec §7.2). Pure: no React, DOM, GL, WASM or WebCrypto.
//
// computeFormula turns a base accord (parts per kit material) plus the
// modulators into a weighable formula for one batch. The pipeline is factored
// into small pure steps so later tasks can insert modulation between them:
//
//   rawLayerShares → projectToBands → applySolTilt → applyChaos (per-row
//   drift) → neatGramsByRow → settle (IFRA cap ⇄ stock selection; IFRA
//   limits are per standard, summed across rows — ifraLimits)
//   → roundWeighed (per-layer largest remainder) → ifraStepDown → bandRepair
//   → (only if the batch overfills: snapToNeatFloor, then weigh again)
//   → assemble (+ strength guard)
//
// The log carries exactly one line per source (ELEMENT, /SOL, /LUNAR, /CHAOS),
// then any snap, IFRA step-down and drop-out lines.

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
export const SOL_MAX_SHIFT_PT = 5;
export const CHAOS_DEFAULT_REACH = 0.15;
export const CHAOS_REACH_RANGE = Object.freeze([0.05, 0.30]);
export const SALT_BYTES = 32;

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

const isAbsent = (x) => x === null || x === undefined;
const isFiniteNumber = (x) => typeof x === 'number' && Number.isFinite(x);

function validate(modulators, batch, salt) {
  const { element, restWeeks, solTilt, chaosReach } = modulators || {};
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
  if (!isAbsent(solTilt) && !(isFiniteNumber(solTilt) && solTilt >= -1 && solTilt <= 1)) {
    throw new RangeError(`solTilt must be a number in −1–1 or null, got ${String(solTilt)}`);
  }
  const [lo, hi] = CHAOS_REACH_RANGE;
  if (!isAbsent(chaosReach) && !(isFiniteNumber(chaosReach) && chaosReach >= lo && chaosReach <= hi)) {
    throw new RangeError(`chaosReach must be a number in ${lo}–${hi} or null, got ${String(chaosReach)}`);
  }
  const { labels } = modulators;
  if (!isAbsent(labels)) {
    if (typeof labels !== 'object') throw new RangeError('labels must be an object or null');
    for (const k of ['lunar', 'sol', 'solAbsent', 'chaos']) {
      if (!isAbsent(labels[k]) && typeof labels[k] !== 'string') {
        throw new RangeError(`labels.${k} must be a string or null, got ${String(labels[k])}`);
      }
    }
  }
  if (!salt || salt.length !== SALT_BYTES) {
    throw new RangeError(`salt must be ${SALT_BYTES} bytes`);
  }
  for (let i = 0; i < SALT_BYTES; i++) {
    if (!Number.isInteger(salt[i]) || salt[i] < 0 || salt[i] > 255) {
      throw new RangeError(`salt[${i}] is not a byte`);
    }
  }
}

// ── step 0: join the accord to the kit ──────────────────────────────────────

// A material may appear only once (ruling R20): IFRA limits are checked per
// row, so two rows of one material could each sit at the limit and together
// weigh twice it.
export function joinAccord(baseAccord, kit) {
  const byId = new Map(kit.map((m) => [m.id, m]));
  const seen = new Set();
  return baseAccord.rows.map(({ materialId, parts }) => {
    if (seen.has(materialId)) throw new RangeError(`duplicate material in accord: ${materialId}`);
    seen.add(materialId);
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

// ── step 1b: /SOL tilt ──────────────────────────────────────────────────────

// Moves solTilt × SOL_MAX_SHIFT_PT points from top to base (+) or base to top
// (−), clamped so both stay inside their bands. Heart is untouched. Returns
// the new shares and the shift actually applied to the top (base gets −shift).
export function applySolTilt(shares, solTilt) {
  const want = solTilt * SOL_MAX_SHIFT_PT;
  // room is floored at 0 so float dust on a band edge never flips the direction
  const room = want >= 0
    ? Math.min(shares.top - BANDS.top[0], BANDS.base[1] - shares.base)
    : Math.min(BANDS.top[1] - shares.top, shares.base - BANDS.base[0]);
  const d = Math.sign(want) * Math.min(Math.abs(want), Math.max(0, room));
  return {
    shares: { top: shares.top - d, heart: shares.heart, base: shares.base + d },
    topShift: -d,
    baseShift: d,
  };
}

const signedPt = (x) => {
  const mag = Math.abs(x).toFixed(1);
  return `${x < 0 && mag !== '0.0' ? '−' : '+'}${mag}`;
};

// ── step 1c: /CHAOS per-row drift ───────────────────────────────────────────

// Each row's parts become parts × (1 + reach·u), u = salt[i % 32] / 127.5 − 1
// (i = the row's index in baseAccord.rows), then renormalised so every layer
// keeps its total parts. A row's within-layer share therefore moves by a
// ratio inside [(1−reach)/(1+reach), (1+reach)/(1−reach)]. Pure: returns new
// row objects.
export function applyChaos(rows, salt, reach) {
  const drifted = rows.map((r, i) => {
    const u = salt[i % SALT_BYTES] / 127.5 - 1;
    return r.parts * (1 + reach * u);
  });
  const before = { top: 0, heart: 0, base: 0 };
  const after = { top: 0, heart: 0, base: 0 };
  rows.forEach((r, i) => { before[r.layer] += r.parts; after[r.layer] += drifted[i]; });
  return rows.map((r, i) => ({ ...r, parts: drifted[i] * (before[r.layer] / after[r.layer]) }));
}

// ── step 2: neat grams per row ──────────────────────────────────────────────

export function neatGramsByRow(rows, layerShares, concentrateG) {
  const layerParts = { top: 0, heart: 0, base: 0 };
  for (const r of rows) layerParts[r.layer] += r.parts;
  return rows.map((r) => concentrateG * (layerShares[r.layer] / 100) * (r.parts / layerParts[r.layer]));
}

// ── step 3: IFRA limits, grouped by standard (author decision B) ────────────

// IFRA counts a restricted substance from every source in the bottle: a row
// that IS the substance (its own cap) and every natural that carries it
// (ifraConstituents). So a limit is a standard, not a row: rows of one
// standard are summed. Citral (STD 021) covers 5392-40-5, geranial and neral,
// which is why the key is the standard, never the CAS.
//
// Each limit is Σ wᵢ · neatPctᵢ ≤ 1 over its member rows, with
//   wᵢ = 1 / ownCap                         for a row's own limit, and
//   wᵢ = (pctInMaterial / 100) / stdLimit   for a constituent.
// With one limit per standard this is "Σ substance % ≤ limit"; it also reads
// STD 089's "sum of % of their limits ≤ 100" correctly.

const ownStandardKey = (r) => {
  const src = r.material.sources?.ifraSource;
  return src && src.unrestricted !== true && src.url ? src.url : `own:${r.materialId}`;
};

// Limits in first-appearance order (row order; a row's own limit before its
// constituents), so a kit with only own caps behaves exactly as per-row caps.
export function ifraLimits(rows) {
  const byKey = new Map();
  const limits = [];
  const add = (key, standard, limitPct, i, w, viaConstituent) => {
    let L = byKey.get(key);
    if (!L) {
      L = { key, standard, limitPct, members: [], viaConstituent: false };
      byKey.set(key, L);
      limits.push(L);
    }
    const m = L.members.find((x) => x.i === i);
    if (m) m.w += w; else L.members.push({ i, w });
    if (viaConstituent) L.viaConstituent = true;
  };
  rows.forEach((r, i) => {
    const cap = r.material.ifraCat4MaxPct;
    if (cap != null) {
      add(ownStandardKey(r), r.material.sources?.ifraSource?.standard ?? r.material.name, cap, i, 1 / cap, false);
    }
    for (const c of r.material.ifraConstituents ?? []) {
      if (c.standardCat4MaxPct == null || !(c.pctInMaterial > 0)) continue;
      add(c.standardUrl ?? `std:${c.standard}`, c.standard ?? c.name, c.standardCat4MaxPct, i,
        c.pctInMaterial / 100 / c.standardCat4MaxPct, true);
    }
  });
  return limits;
}

// Σ wᵢ · neatPctᵢ for one limit; neatPctOf(i) gives a row's neat % of batch.
const usageOf = (L, neatPctOf_) => round9(L.members.reduce((s, m) => s + m.w * neatPctOf_(m.i), 0));

// Scales every active member of a broken limit down onto it, and gives each
// member's excess to the active rows of that member's layer that are neither
// frozen nor in the limit, in proportion to their parts. Members are then
// frozen (they only shrink after), so each limit is settled at most once and
// the pass ends. Sweeps limits in order until none changes (for own caps
// alone this is the old per-row sweep). Returns a new neat array. Throws
// FormulaInfeasible when a layer has no row left to take the excess.
export function applyIfraCaps(rows, neat, active, batchG, limits = ifraLimits(rows)) {
  const out = neat.slice();
  const frozen = new Set();
  const pct = (i) => (out[i] / batchG) * 100;
  for (let iter = 0; iter <= limits.length; iter++) {
    let changed = false;
    for (const L of limits) {
      const live = L.members.filter((m) => active[m.i] && out[m.i] > 0);
      if (live.length === 0) continue;
      const usage = live.reduce((s, m) => s + m.w * pct(m.i), 0);
      if (!(usage > 1 + 1e-12)) continue;
      changed = true;
      const inLimit = new Set(L.members.map((m) => m.i));
      for (const { i } of live) {
        const excess = out[i] - out[i] / usage;
        out[i] /= usage;
        frozen.add(i);
        const takers = [];
        let takerParts = 0;
        for (let j = 0; j < rows.length; j++) {
          if (active[j] && !frozen.has(j) && !inLimit.has(j) && rows[j].layer === rows[i].layer) {
            takers.push(j);
            takerParts += rows[j].parts;
          }
        }
        if (takers.length === 0) {
          const what = L.viaConstituent ? `IFRA ${L.standard}: no ${rows[i].layer} row outside the standard`
            : `IFRA: no uncapped ${rows[i].layer} row`;
          throw new FormulaInfeasible(
            `${what} left to take ${rows[i].materialId}'s excess`,
            { layer: rows[i].layer, materialId: rows[i].materialId },
          );
        }
        for (const j of takers) out[j] += excess * (rows[j].parts / takerParts);
      }
    }
    if (!changed) break;
  }
  return out;
}

// True when no limit containing row i is broken by the given weighed grams.
function limitsHold(limits, byRow, i, grams, stocks, batchG) {
  const pct = (j) => neatPctOf(grams[j], stocks[j] ?? 0, batchG);
  for (const L of byRow[i] ?? []) if (usageOf(L, pct) > 1) return false;
  return true;
}

const limitsByRow = (limits, n) => {
  const byRow = Array.from({ length: n }, () => []);
  for (const L of limits) for (const m of L.members) byRow[m.i].push(L);
  return byRow;
};

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
export function settle(rows, neat0, batchG, limits = ifraLimits(rows)) {
  const active = rows.map(() => true);
  let neat = neat0.slice();
  const dropped = [];
  for (let iter = 0; iter <= rows.length; iter++) {
    neat = applyIfraCaps(rows, neat, active, batchG, limits);
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

// ── step 5: round weighed grams (largest remainder, rulings R2 + R17) ───────

// Every active row is weighed at floor(exact, 0.01 g) or one grain above it.
// The largest-remainder pass runs per layer (R17): each layer's target is the
// Σ of its settled neat grams (settle only moves grams within a layer, so this
// is the design split × concentrate). Within a layer, rows take their extra
// grain in order of largest remainder, but only while that brings the layer's
// Σ neat closer to its target and keeps the row under its IFRA limit. Plain
// per-row rounding can drift many grains the same way; this keeps each
// layer's Σ neat within about half a grain × stock of its target, so the
// bottle's split follows the design split and not just its total.
//
// Every row's floor is set before any grain goes up, so a grain-up is checked
// against the IFRA limits (decision B: summed by standard, across layers)
// with every other row already in the bottle.
export function roundWeighed(rows, neat, stocks, active, batchG, limits = ifraLimits(rows)) {
  const byRow = limitsByRow(limits, rows.length);
  const grams = neat.map(() => 0);
  const exact = neat.map(() => 0);
  for (let i = 0; i < rows.length; i++) {
    if (!active[i]) continue;
    exact[i] = neat[i] / stocks[i];
    grams[i] = round2(Math.max(MIN_WEIGH_G, Math.floor(exact[i] * 100 + 1e-9) / 100));
  }
  for (const layer of LAYERS) {
    const order = [];
    let deficit = 0;
    for (let i = 0; i < rows.length; i++) {
      if (!active[i] || rows[i].layer !== layer) continue;
      deficit += neat[i] - grams[i] * stocks[i];
      order.push({ i, rem: exact[i] - grams[i] });
    }
    order.sort((a, b) => b.rem - a.rem || a.i - b.i);
    for (const { i } of order) {
      const step = 0.01 * stocks[i];
      if (!(Math.abs(deficit - step) < Math.abs(deficit))) continue;
      const prev = grams[i];
      grams[i] = round2(prev + 0.01);
      if (!limitsHold(limits, byRow, i, grams, stocks, batchG)) { grams[i] = prev; continue; }
      deficit -= step;
    }
  }
  return grams;
}

// Shares (of 100) of the weighed neat grams per layer: the split the bottle
// actually holds, after rounding, IFRA step-down and band repair.
export function weighedSplitOf(rows) {
  const sums = { top: 0, heart: 0, base: 0 };
  for (const r of rows) sums[r.layer] += r.grams * r.stock;
  const total = sums.top + sums.heart + sums.base;
  return {
    top: (sums.top / total) * 100,
    heart: (sums.heart / total) * 100,
    base: (sums.base / total) * 100,
  };
}

// Σ over layers of how far each weighed share sits outside its band (pt).
export function bandMiss(split) {
  let miss = 0;
  for (const k of LAYERS) miss += Math.max(0, BANDS[k][0] - split[k], split[k] - BANDS[k][1]);
  return miss;
}

// ── step 7: band repair (ruling R17) ────────────────────────────────────────

// Per-layer rounding keeps each layer near its target, but a layer designed on
// a band edge (or the grains of the other layers) can still tip the weighed
// split just outside BANDS. While it is outside, try every single-grain move
// (one row ±0.01 g; never under 0.05 g, never over its IFRA limit, never past
// the batch weight, strength kept within ±0.5 pt) and take the one that cuts
// the total band miss most; stop when no move cuts it.
//
// Tolerance rule: what is left outside a band is what no single 0.01 g grain
// can fix. Each layer was rounded to within half a grain of its target, so a
// share can miss its band by at most one grain of the coarsest weighed stock,
// as a share of the weighed concentrate:
//   0.01 g × max stock ÷ Σ(grams × stock) × 100   (pt)
export function bandRepair(rows, grams, stocks, active, batchG, targetPct, limits = ifraLimits(rows)) {
  const byRow = limitsByRow(limits, rows.length);
  const out = grams.slice();
  const live = [];
  for (let i = 0; i < rows.length; i++) if (active[i]) live.push(i);
  const view = () => live.map((i) => ({ layer: rows[i].layer, grams: out[i], stock: stocks[i] }));
  const strengthOk = () => {
    const neat = live.reduce((s, i) => s + out[i] * stocks[i], 0);
    return Math.abs(round9((neat / batchG) * 100) - targetPct) <= STRENGTH_TOL_PT;
  };
  let miss = bandMiss(weighedSplitOf(view()));
  for (let iter = 0; iter < 4 * live.length && miss > 1e-12; iter++) {
    let best = null;
    for (const i of live) {
      for (const d of [-0.01, 0.01]) {
        const next = round2(out[i] + d);
        if (next < MIN_WEIGH_G - WEIGH_EPS) continue;
        const prev = out[i];
        out[i] = next;
        if (d > 0 && !limitsHold(limits, byRow, i, out, stocks, batchG)) { out[i] = prev; continue; }
        const weighed = live.reduce((s, j) => s + out[j], 0);
        const m = bandMiss(weighedSplitOf(view()));
        const ok = weighed <= batchG + WEIGH_EPS && strengthOk();
        out[i] = prev;
        if (ok && m < miss - 1e-12 && (best === null || m < best.m - 1e-12)) best = { i, next, m };
      }
    }
    if (best === null) break;
    out[best.i] = best.next;
    miss = best.m;
  }
  return out;
}

// ── step 8: snap to the neat floor (author ruling, 2026-11-27) ──────────────

// A dose under 0.05 g neat must be weighed from a dilute stock. From a 1%
// stock that is up to 5 g of solution, which can overfill the batch (the
// solids with no cited 10% solubility: coumarin, ambrox, cashmeran). Only
// when the weighed formula overfills does the heaviest such row that also
// has a neat stock (crystals, for a solid) snap up to 0.05 g neat, provided
// every IFRA limit it belongs to still holds there. The grams it gains come
// from the other rows of its layer that have not snapped themselves, in
// proportion to their neat grams, so the layer share and the strength are
// unchanged. A snapped row is pinned: it never gives grams back. Returns { neat, record } for a
// fresh settle, or null when no row can snap.
export function snapToNeatFloor(rows, w, batchG, limits = ifraLimits(rows), pinned = new Set()) {
  const byRow = limitsByRow(limits, rows.length);
  const candidates = [];
  for (let i = 0; i < rows.length; i++) {
    if (!w.active[i] || !(w.stocks[i] < 1) || rows[i].stocks[0] !== 1) continue;
    if (!(w.neat[i] < MIN_WEIGH_G - WEIGH_EPS)) continue;
    candidates.push(i);
  }
  candidates.sort((a, b) => w.grams[b] - w.grams[a] || a - b);
  for (const c of candidates) {
    const delta = MIN_WEIGH_G - w.neat[c];
    const givers = [];
    let pool = 0;
    for (let j = 0; j < rows.length; j++) {
      // a snapped row never gives back: that would undo its snap (ping-pong)
      if (j !== c && w.active[j] && rows[j].layer === rows[c].layer && !pinned.has(j) && w.neat[j] > 0) {
        givers.push(j);
        pool += w.neat[j];
      }
    }
    if (!(pool > delta)) continue;
    const neat = w.neat.map((x, i) => (w.active[i] ? x : 0));
    neat[c] = MIN_WEIGH_G;
    for (const j of givers) neat[j] -= delta * (w.neat[j] / pool);
    const pct = (i) => (neat[i] / batchG) * 100;
    if (byRow[c].some((L) => usageOf(L, pct) > 1)) continue;
    const r = rows[c];
    const form = r.material.physicalState === 'solid' ? 'crystals' : 'neat';
    const fromGrams = round2(w.grams[c]);
    return {
      neat,
      record: {
        index: c,
        materialId: r.materialId,
        fromStock: w.stocks[c],
        fromGrams,
        takenG: round9(delta),
        line: `SNAP ${r.material.name} → ${MIN_WEIGH_G.toFixed(2)} g ${form} · from its ${stockLabel(w.stocks[c])} stock it weighed ${fromGrams.toFixed(2)} g and overfilled the ${batchG.toFixed(2)} g batch; the rest of the ${r.layer} gives up ${delta.toFixed(3)} g`,
      },
    };
  }
  return null;
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

// Limits in order; while one is broken, the member carrying most of it (that
// can still lose a grain) steps down 0.01 g. For a row's own cap that is the
// row itself, as before; a standard summed across rows names its total.
export function ifraStepDown(rows, grams, stocks, active, batchG, limits = ifraLimits(rows)) {
  const out = grams.slice();
  const lines = [];
  const pct = (i) => (active[i] ? neatPctOf(out[i], stocks[i], batchG) : 0);
  for (const L of limits) {
    while (usageOf(L, pct) > 1) {
      let pick = -1;
      let most = -Infinity;
      for (const m of L.members) {
        if (!active[m.i] || !(out[m.i] > MIN_WEIGH_G + WEIGH_EPS)) continue;
        const share = m.w * pct(m.i);
        if (share > most) { most = share; pick = m.i; }
      }
      if (pick < 0) {
        const r = rows[L.members.find((m) => active[m.i])?.i ?? L.members[0].i];
        throw new FormulaInfeasible(
          L.viaConstituent
            ? `IFRA: ${L.standard} total cannot be weighed under its limit`
            : `IFRA: ${r.materialId} cannot be weighed under its limit`,
          { layer: r.layer, materialId: r.materialId },
        );
      }
      out[pick] = round2(out[pick] - 0.01);
      const why = L.viaConstituent ? ` (${L.standard} total)` : '';
      lines.push(`IFRA ${rows[pick].material.name} stepped down 0.01 g → ${out[pick].toFixed(2)} g${why}`);
    }
  }
  return { grams: out, lines };
}

// ── assemble ────────────────────────────────────────────────────────────────

export function computeFormula({ baseAccord, salt, modulators, batch, kit }) {
  validate(modulators, batch, salt);
  const { element, restWeeks, solTilt, chaosReach } = modulators;
  // P3 ruling 4: a label names the reading inside its source's line; the
  // numbers after the arrow stay the engine's own.
  const labels = modulators.labels || {};
  const named = (src, clause) => (clause ? `${src} ${clause} →` : `${src} →`);
  const targetPct = TARGET_PCT[element];
  const batchG = batch.grams;

  const joined = joinAccord(baseAccord, kit);
  for (const k of LAYERS) {
    if (!joined.some((r) => r.layer === k)) {
      throw new FormulaInfeasible(`accord has no ${k} row`, { layer: k });
    }
  }
  let designSplit = projectToBands(rawLayerShares(joined));
  let solLine = labels.solAbsent || '/SOL unwitnessed — the sun left the top notes alone';
  if (!isAbsent(solTilt)) {
    const tilt = applySolTilt(designSplit, solTilt);
    designSplit = tilt.shares;
    solLine = `${named('/SOL', labels.sol)} top ${signedPt(tilt.topShift)} pt / base ${signedPt(tilt.baseShift)} pt`;
  }
  const reach = isAbsent(chaosReach) ? CHAOS_DEFAULT_REACH : chaosReach;
  const chaosLine = isAbsent(chaosReach)
    ? '/CHAOS periphery unwitnessed — default reach'
    : (labels.chaos
      ? `/CHAOS ${labels.chaos} → salt ±${(reach * 100).toFixed(0)}% per-row drift`
      : `/CHAOS salt → ±${(reach * 100).toFixed(0)}% per-row drift`);
  const rows = applyChaos(joined, salt, reach);
  const concentrateG = (batchG * targetPct) / 100;
  const neat0 = neatGramsByRow(rows, designSplit, concentrateG);

  const limits = ifraLimits(rows);
  const weigh = (start) => {
    const s = settle(rows, start, batchG, limits);
    const rounded = roundWeighed(rows, s.neat, s.stocks, s.active, batchG, limits);
    const step = ifraStepDown(rows, rounded, s.stocks, s.active, batchG, limits);
    const g = bandRepair(rows, step.grams, s.stocks, s.active, batchG, targetPct, limits);
    return { ...s, stepLines: step.lines, grams: g };
  };
  let w = weigh(neat0);
  const snapped = [];
  for (let iter = 0; iter < rows.length; iter++) {
    const weighed = w.grams.reduce((sum, g, i) => sum + (w.active[i] ? g : 0), 0);
    if (round2(batchG - weighed) >= 0) break;
    const snap = snapToNeatFloor(rows, w, batchG, limits, new Set(snapped.map((x) => x.index)));
    if (!snap) break; // nothing can snap: assemble throws the overfill below
    snapped.push(snap.record);
    w = weigh(snap.neat);
  }
  const { active, stocks, dropped, stepLines, grams } = w;

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

  // One entry per standard that a constituent contributes to (decision B):
  // its summed neat % against the standard's limit.
  const pctOf = (i) => (active[i] ? neatPctOf(grams[i], stocks[i], batchG) : 0);
  for (const L of limits) {
    if (!L.viaConstituent) continue;
    const materialIds = L.members.filter((m) => active[m.i]).map((m) => rows[m.i].materialId);
    if (materialIds.length === 0) continue;
    const usage = usageOf(L, pctOf);
    ifra.push({ standard: L.standard, materialIds, neatPct: round9(usage * L.limitPct), limitPct: L.limitPct, ok: usage <= 1 });
  }

  const actualPct = round9((neatSum / batchG) * 100);
  assertStrength(actualPct, targetPct);

  const alcoholGrams = round2(batchG - weighedSum);
  if (alcoholGrams < 0) {
    // name the heaviest dilute row (the one a stronger stock would shrink most);
    // the heaviest row overall when every stock is neat
    const pool = outRows.some((r) => r.stock < 1) ? outRows.filter((r) => r.stock < 1) : outRows;
    const heaviest = pool.reduce((a, b) => (b.grams > a.grams ? b : a));
    throw new FormulaInfeasible(
      `weighed stocks exceed the batch weight (heaviest dilute row: ${heaviest.materialId})`,
      { layer: heaviest.layer, materialId: heaviest.materialId },
    );
  }

  const dropLines = dropped.map((d) => {
    const r = rows[d.index];
    return `DROP ${r.material.name} · ${d.reason} → its share goes to the ${r.layer}`;
  });

  const snapLines = snapped.map((s) => s.line);

  const log = [
    `ELEMENT ${element} → ${TYPE_NAMES[element]} · ${targetPct.toFixed(1)}% concentrate`,
    solLine,
    `${named('/LUNAR', labels.lunar)} ${restWeeks} weeks in the dark`,
    chaosLine,
    ...snapLines,
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
    designSplit: { top: designSplit.top, heart: designSplit.heart, base: designSplit.base },
    weighedSplit: weighedSplitOf(outRows),
    restWeeks,
    ifra,
    dropped: dropped.map(({ materialId, reason }) => ({ materialId, reason })),
    snapped: snapped.map(({ materialId, fromStock, fromGrams, takenG }) => ({ materialId, fromStock, fromGrams, takenG })),
    log,
  };
}

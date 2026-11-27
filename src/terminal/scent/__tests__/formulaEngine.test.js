import { describe, it, expect } from 'vitest';
import {
  TARGET_PCT, BANDS, BATCHES, MIN_WEIGH_G, ETHANOL_G_PER_ML, FILL_MAX,
  FormulaInfeasible, computeFormula, projectToBands, ifraStepDown, assertStrength,
} from '../formulaEngine';
import { FX_KIT, FX_ACCORD } from './kitFixture';

const SALT = new Uint8Array(32);
const ELEMENTS = ['AIR', 'WATER', 'EARTH', 'FIRE'];
const CASES = ELEMENTS.flatMap((element) =>
  Object.keys(BATCHES).map((batchName) => [element, batchName]));

const run = (element, batchName, over = {}) => computeFormula({
  baseAccord: FX_ACCORD,
  salt: SALT,
  modulators: { element, restWeeks: 4 },
  batch: BATCHES[batchName],
  kit: FX_KIT,
  ...over,
});

const mat = (id) => FX_KIT.find((m) => m.id === id);

describe('constants', () => {
  it('match the spec values', () => {
    expect(TARGET_PCT).toEqual({ AIR: 4, WATER: 10, EARTH: 18, FIRE: 25 });
    expect(BANDS).toEqual({ top: [15, 25], heart: [30, 40], base: [40, 55] });
    expect(BATCHES).toEqual({
      small: { grams: 7.0, vialMl: 10 }, large: { grams: 10.0, vialMl: 15 },
    });
    expect(MIN_WEIGH_G).toBe(0.05);
    expect(ETHANOL_G_PER_ML).toBe(0.789);
    expect(FILL_MAX).toBe(0.9);
  });
});

describe('projectToBands', () => {
  it('leaves in-band shares alone', () => {
    const s = projectToBands({ top: 20, heart: 35, base: 45 });
    expect(s.top).toBeCloseTo(20, 12);
    expect(s.heart).toBeCloseTo(35, 12);
    expect(s.base).toBeCloseTo(45, 12);
  });

  it('clamps and spreads the residual by room', () => {
    // top 30 → 25; heart 30, base 40 in band; residual +5 over room 10 : 15
    const s = projectToBands({ top: 30, heart: 30, base: 40 });
    expect(s.top).toBeCloseTo(25, 12);
    expect(s.heart).toBeCloseTo(32, 12);
    expect(s.base).toBeCloseTo(43, 12);
  });

  it('throws instead of silently breaking when no layer has room', () => {
    expect(() => projectToBands({ top: NaN, heart: 35, base: 45 })).toThrow(FormulaInfeasible);
  });

  it('handles a negative residual', () => {
    const s = projectToBands({ top: 10, heart: 60, base: 30 });
    for (const k of ['top', 'heart', 'base']) {
      expect(s[k]).toBeGreaterThanOrEqual(BANDS[k][0] - 1e-12);
      expect(s[k]).toBeLessThanOrEqual(BANDS[k][1] + 1e-12);
    }
    expect(Math.abs(s.top + s.heart + s.base - 100)).toBeLessThan(1e-9);
  });
});

describe('ifraStepDown', () => {
  it('steps a rounded-over row down by 0.01 g until it is under its limit, and logs it', () => {
    // limit 0.2% of 7 g = 0.014 g neat; 0.16 g at 10% = 0.016 g → two steps to 0.14 g
    const rows = [{ materialId: 'fx-x', layer: 'heart', material: { name: 'Fixture X', ifraCat4MaxPct: 0.2 } }];
    const { grams, lines } = ifraStepDown(rows, [0.16], [0.1], [true], 7);
    expect(grams).toEqual([0.14]);
    expect(lines).toEqual([
      'IFRA Fixture X stepped down 0.01 g → 0.15 g',
      'IFRA Fixture X stepped down 0.01 g → 0.14 g',
    ]);
  });

  it('leaves rows without a limit or under it untouched', () => {
    const rows = [
      { materialId: 'a', layer: 'top', material: { name: 'A', ifraCat4MaxPct: null } },
      { materialId: 'b', layer: 'top', material: { name: 'B', ifraCat4MaxPct: 5 } },
    ];
    const { grams, lines } = ifraStepDown(rows, [3, 0.2], [1, 1], [true, true], 7);
    expect(grams).toEqual([3, 0.2]);
    expect(lines).toEqual([]);
  });
});

describe('computeFormula core', () => {
  it.each(CASES)('%s/%s: actualPct within ±0.5 of TARGET_PCT', (el, b) => {
    const f = run(el, b);
    expect(f.targetPct).toBe(TARGET_PCT[el]);
    expect(Math.abs(f.actualPct - TARGET_PCT[el])).toBeLessThanOrEqual(0.5);
  });

  it.each(CASES)('%s/%s: layerSplit sums to 100 and each share is inside BANDS', (el, b) => {
    const { layerSplit } = run(el, b);
    const sum = layerSplit.top + layerSplit.heart + layerSplit.base;
    expect(Math.abs(sum - 100)).toBeLessThan(1e-9);
    for (const k of ['top', 'heart', 'base']) {
      expect(layerSplit[k]).toBeGreaterThanOrEqual(BANDS[k][0]);
      expect(layerSplit[k]).toBeLessThanOrEqual(BANDS[k][1]);
    }
  });

  it.each(CASES)('%s/%s: every row has grams >= 0.05 on a 0.01 g grain', (el, b) => {
    const f = run(el, b);
    expect(f.rows.length).toBeGreaterThan(0);
    for (const r of f.rows) {
      expect(r.grams).toBeGreaterThanOrEqual(MIN_WEIGH_G);
      const centi = r.grams * 100;
      expect(Math.abs(centi - Math.round(centi))).toBeLessThan(1e-9);
    }
  });

  it.each(CASES)('%s/%s: Σ rows.grams + alcoholGrams === batch.grams to 0.01', (el, b) => {
    const f = run(el, b);
    const total = f.rows.reduce((s, r) => s + r.grams, 0) + f.alcoholGrams;
    expect(Math.abs(total - BATCHES[b].grams)).toBeLessThan(0.005);
    expect(f.batch).toEqual(BATCHES[b]);
  });

  it.each(CASES)('%s/%s: alcoholGrams >= 0', (el, b) => {
    expect(run(el, b).alcoholGrams).toBeGreaterThanOrEqual(0);
  });

  it.each(CASES)('%s/%s: every ifra entry ok, neatPct recomputed from rounded grams', (el, b) => {
    const f = run(el, b);
    const limited = f.rows.filter((r) => mat(r.materialId).ifraCat4MaxPct != null);
    expect(f.ifra.length).toBe(limited.length);
    for (const e of f.ifra) {
      const row = f.rows.find((r) => r.materialId === e.materialId);
      const recomputed = (row.grams * row.stock) / BATCHES[b].grams * 100;
      expect(e.neatPct).toBeCloseTo(recomputed, 8);
      expect(row.neatPct).toBeCloseTo(recomputed, 8);
      expect(e.limitPct).toBe(mat(e.materialId).ifraCat4MaxPct);
      expect(e.ok).toBe(true);
      expect(e.neatPct).toBeLessThanOrEqual(e.limitPct);
    }
    // the binding fixture limit really binds
    const veil = f.ifra.find((e) => e.materialId === 'fx-heart-veil');
    expect(veil.neatPct).toBeGreaterThan(0.15);
  });

  it.each(CASES)('%s/%s: actualPct is recomputed from the rounded rows', (el, b) => {
    const f = run(el, b);
    const neat = f.rows.reduce((s, r) => s + r.grams * r.stock, 0);
    expect(f.actualPct).toBeCloseTo(neat / BATCHES[b].grams * 100, 8);
  });

  it.each(CASES)('%s/%s: fillMl === batch.grams / 0.789 and fits the vial', (el, b) => {
    const f = run(el, b);
    expect(f.fillMl).toBe(BATCHES[b].grams / 0.789);
    expect(f.fillMl).toBeLessThanOrEqual(0.9 * BATCHES[b].vialMl);
  });

  it.each(CASES)('%s/%s: stock stepping weighs a sub-0.05 g neat dose from a weaker stock', (el, b) => {
    const f = run(el, b);
    const mote = f.rows.find((r) => r.materialId === 'fx-heart-mote');
    expect(mote).toBeDefined();
    // its exact neat dose is < 0.05 g; the weighed grams sit within one 0.01 g grain of exact
    expect(mote.grams * mote.stock).toBeLessThan(MIN_WEIGH_G + 0.01 * mote.stock);
    expect(mote.stock).toBeLessThan(1);
    // generally: any row whose material has a 1.0 stock but whose neat dose is under 0.05 g
    for (const r of f.rows) {
      const m = mat(r.materialId);
      if (m.stocks.includes(1.0) && r.grams * r.stock < MIN_WEIGH_G) {
        expect(r.stock).toBeLessThan(1);
      }
    }
  });

  it.each(CASES)('%s/%s: drop-out of the 1%%-only trace is logged and strength holds', (el, b) => {
    const f = run(el, b);
    const d = f.dropped.find((x) => x.materialId === 'fx-base-dust');
    expect(d).toBeDefined();
    expect(typeof d.reason).toBe('string');
    expect(d.reason.length).toBeGreaterThan(0);
    expect(f.rows.find((r) => r.materialId === 'fx-base-dust')).toBeUndefined();
    expect(f.log.some((l) => l.includes('Fixture Dust'))).toBe(true);
    expect(Math.abs(f.actualPct - TARGET_PCT[el])).toBeLessThanOrEqual(0.5);
  });

  it.each(CASES)('%s/%s: log order is ELEMENT, /LUNAR, then step/drop lines', (el, b) => {
    const f = run(el, b);
    const types = { AIR: 'Eau de Cologne', WATER: 'Eau de Toilette', EARTH: 'Eau de Parfum', FIRE: 'Extrait' };
    expect(f.log[0]).toBe(`ELEMENT ${el} → ${types[el]} · ${TARGET_PCT[el].toFixed(1)}% concentrate`);
    expect(f.log[1]).toBe('/LUNAR → 4 weeks in the dark');
    expect(f.log.length).toBeGreaterThan(2);
    expect(f.restWeeks).toBe(4);
    expect(f.element).toBe(el);
  });

  it('rows carry name, cas and layer from the kit', () => {
    const f = run('EARTH', 'small');
    for (const r of f.rows) {
      const m = mat(r.materialId);
      expect(r.name).toBe(m.name);
      expect(r.cas).toBe(m.cas);
      expect(r.layer).toBe(m.layer);
      expect(m.stocks).toContain(r.stock);
    }
  });

  it.each([1, 9, 4.5, 0, -2, NaN, '4', undefined])('restWeeks %s throws RangeError', (w) => {
    expect(() => computeFormula({
      baseAccord: FX_ACCORD, salt: SALT, modulators: { element: 'AIR', restWeeks: w },
      batch: BATCHES.small, kit: FX_KIT,
    })).toThrow(RangeError);
  });

  it.each([2, 8])('restWeeks %s is accepted', (w) => {
    expect(() => computeFormula({
      baseAccord: FX_ACCORD, salt: SALT, modulators: { element: 'AIR', restWeeks: w },
      batch: BATCHES.small, kit: FX_KIT,
    })).not.toThrow();
  });

  it.each(['AETHER', 'air', '', undefined])('unknown element %s throws RangeError', (el) => {
    expect(() => run(el, 'small')).toThrow(RangeError);
  });

  it.each(CASES)('%s/%s: deterministic — same inputs → deep-equal formula', (el, b) => {
    expect(run(el, b)).toEqual(run(el, b));
  });

  it('throws FormulaInfeasible when a capped layer has no uncapped row left', () => {
    const kit = FX_KIT.map((m) => (m.layer === 'heart' ? { ...m, ifraCat4MaxPct: 0.1 } : m));
    let err;
    try { run('FIRE', 'small', { kit }); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(FormulaInfeasible);
    expect(err).toBeInstanceOf(Error);
    expect(err.layer).toBe('heart');
  });

  it('throws FormulaInfeasible when every row of a layer drops out', () => {
    // top projected up to its 15% floor = 0.042 g neat at AIR/small: under 0.05 g even as one row
    const kit = FX_KIT.map((m) => (m.layer === 'top' ? { ...m, stocks: [1.0] } : m));
    const baseAccord = {
      rows: FX_ACCORD.rows.map((r) => (mat(r.materialId).layer === 'top' ? { ...r, parts: 1 } : r)),
    };
    let err;
    try { run('AIR', 'small', { kit, baseAccord }); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(FormulaInfeasible);
    expect(err.layer).toBe('top');
  });
});

// Synthetic many-row kit: 2 top, 4 heart, 7 base rows, all neat-only, equal parts.
// At WATER/small every row's exact dose is ≈0.0538 g, so plain per-row round2
// takes 0.0038 g off all 13 rows: −0.05 g = −0.71 pt, outside ±0.5.
const MANY_KIT = [
  ...['a', 'b'].map((x) => ['top', x]),
  ...['a', 'b', 'c', 'd'].map((x) => ['heart', x]),
  ...['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((x) => ['base', x]),
].map(([layer, x], i) => ({
  id: `fx-many-${layer}-${x}`, name: `Fixture Many ${layer} ${x}`, cas: `FX-1${String(i).padStart(3, '0')}`,
  layer, role: 'body', stocks: [1.0], ifraCat4MaxPct: null, solubility: null,
  sources: { casSource: 'fixture', ifraSource: 'fixture' },
}));
const MANY_ACCORD = { rows: MANY_KIT.map((m) => ({ materialId: m.id, parts: 1 })) };

describe('strength holds under same-direction rounding (R2)', () => {
  it('plain per-row rounding would break ±0.5 pt for the many-row kit', () => {
    // pre-condition proving the fixture is a real trap
    const conc = 7 * 10 / 100;
    const shares = projectToBands({ top: 200 / 13, heart: 400 / 13, base: 700 / 13 });
    const counts = { top: 2, heart: 4, base: 7 };
    let plain = 0;
    for (const k of ['top', 'heart', 'base']) {
      const x = conc * shares[k] / 100 / counts[k];
      plain += counts[k] * (Math.round(x * 100) / 100);
    }
    expect(Math.abs(plain / 7 * 100 - 10)).toBeGreaterThan(0.5);
  });

  it.each(Object.keys(BATCHES))('WATER/%s: largest-remainder rounding keeps actualPct within ±0.5', (b) => {
    const f = computeFormula({
      baseAccord: MANY_ACCORD, salt: SALT, modulators: { element: 'WATER', restWeeks: 4 },
      batch: BATCHES[b], kit: MANY_KIT,
    });
    expect(f.rows.length).toBe(13);
    expect(Math.abs(f.actualPct - 10)).toBeLessThanOrEqual(0.5);
    for (const r of f.rows) {
      expect(r.grams).toBeGreaterThanOrEqual(MIN_WEIGH_G);
      expect(Math.abs(r.grams * 100 - Math.round(r.grams * 100))).toBeLessThan(1e-9);
    }
  });

  it.each(ELEMENTS)('%s/small: many-row kit holds the bound wherever it is feasible', (el) => {
    let f;
    try {
      f = computeFormula({
        baseAccord: MANY_ACCORD, salt: SALT, modulators: { element: el, restWeeks: 4 },
        batch: BATCHES.small, kit: MANY_KIT,
      });
    } catch (e) {
      expect(e).toBeInstanceOf(FormulaInfeasible);
      return;
    }
    expect(Math.abs(f.actualPct - TARGET_PCT[el])).toBeLessThanOrEqual(0.5);
  });
});

describe('assertStrength guard', () => {
  it('passes inside ±0.5 pt', () => {
    expect(() => assertStrength(10.5, 10)).not.toThrow();
    expect(() => assertStrength(9.5, 10)).not.toThrow();
  });
  it('throws FormulaInfeasible outside ±0.5 pt', () => {
    expect(() => assertStrength(10.51, 10)).toThrow(FormulaInfeasible);
    expect(() => assertStrength(9.4, 10)).toThrow(FormulaInfeasible);
    expect(() => assertStrength(NaN, 10)).toThrow(FormulaInfeasible);
  });
});

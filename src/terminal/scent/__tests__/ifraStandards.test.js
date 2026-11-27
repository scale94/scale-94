// Decision B: IFRA limits are per standard, summed across every row that
// carries the substance (own cap + constituents of naturals), in every layer.
import { describe, it, expect } from 'vitest';
import {
  BATCHES, TARGET_PCT, STRENGTH_TOL_PT, MIN_WEIGH_G, FormulaInfeasible,
  computeFormula, ifraLimits, applyIfraCaps, ifraStepDown, joinAccord,
} from '../formulaEngine';
import { FX_SOUR_KIT, FX_SOUR_ACCORD, FX_KIT, FX_ACCORD } from './kitFixture';

const ELEMENTS = ['AIR', 'WATER', 'EARTH', 'FIRE'];
const CASES = ELEMENTS.flatMap((element) => Object.keys(BATCHES).map((b) => [element, b]));
const ZERO = new Uint8Array(32);

const run = (element, batchName, { salt = ZERO, solTilt = null, chaosReach = null, accord = FX_SOUR_ACCORD, kit = FX_SOUR_KIT } = {}) =>
  computeFormula({
    baseAccord: accord, salt, kit, batch: BATCHES[batchName],
    modulators: { element, restWeeks: 4, solTilt, chaosReach },
  });

const material = (id) => FX_SOUR_KIT.find((m) => m.id === id);

// Fixture Sour in the bottle, recomputed from the weighed rows.
function sourTotal(f) {
  let total = 0;
  for (const r of f.rows) {
    const m = material(r.materialId);
    if (m.id === 'fx-top-sour') total += r.neatPct;
    for (const c of m.ifraConstituents ?? []) if (c.standard === 'Fixture Sour') total += (r.neatPct * c.pctInMaterial) / 100;
  }
  return total;
}

// Deterministic PRNG (mulberry32) for the fuzz probe.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('ifraLimits', () => {
  it('groups own caps and constituents by standard, not by CAS', () => {
    const rows = joinAccord(FX_SOUR_ACCORD, FX_SOUR_KIT);
    const limits = ifraLimits(rows);
    const sour = limits.filter((L) => L.standard === 'Fixture Sour');
    expect(sour).toHaveLength(1);
    const ids = sour[0].members.map((m) => rows[m.i].materialId).sort();
    expect(ids).toEqual(['fx-heart-petal', 'fx-top-peel', 'fx-top-sour']);
    expect(sour[0].viaConstituent).toBe(true);
    // weights: own row 1/0.6; naturals pct/100/0.6
    const w = Object.fromEntries(sour[0].members.map((m) => [rows[m.i].materialId, m.w]));
    expect(w['fx-top-sour']).toBeCloseTo(1 / 0.6, 12);
    expect(w['fx-top-peel']).toBeCloseTo(0.06 / 0.6, 12);
    expect(w['fx-heart-petal']).toBeCloseTo(0.04 / 0.6, 12);
  });

  it('a kit with own caps only gives one single-member limit per capped row, in row order', () => {
    const rows = joinAccord(FX_ACCORD, FX_KIT);
    const limits = ifraLimits(rows);
    const capped = rows.map((r, i) => [r, i]).filter(([r]) => r.material.ifraCat4MaxPct != null).map(([, i]) => i);
    expect(limits.map((L) => L.members.map((m) => m.i))).toEqual(capped.map((i) => [i]));
    expect(limits.every((L) => !L.viaConstituent)).toBe(true);
  });

  it('a derived cap on an "unrestricted" row stays its own limit (never pooled by the library URL)', () => {
    const lib = { standard: null, unrestricted: true, url: 'https://ifrafragrance.org/standards-library' };
    const kit = [
      { id: 'a', name: 'A', layer: 'top', stocks: [1], ifraCat4MaxPct: 5, sources: { ifraSource: lib } },
      { id: 'b', name: 'B', layer: 'top', stocks: [1], ifraCat4MaxPct: 7, sources: { ifraSource: lib } },
    ];
    const rows = joinAccord({ rows: [{ materialId: 'a', parts: 1 }, { materialId: 'b', parts: 1 }] }, kit);
    expect(ifraLimits(rows)).toHaveLength(2);
  });
});

describe('applyIfraCaps across rows', () => {
  it('scales every member onto the summed limit and hands the excess only to non-members of their layer', () => {
    const rows = joinAccord(FX_SOUR_ACCORD, FX_SOUR_KIT);
    const batchG = 7;
    // sour 0.05 g (0.714%), peel 0.30 g, petal 0.30 g: total over 0.6%
    const neat = rows.map((r) => ({
      'fx-top-sour': 0.05, 'fx-top-peel': 0.30, 'fx-top-clear': 0.20,
      'fx-heart-petal': 0.30, 'fx-heart-calm': 0.30, 'fx-base-root': 0.5, 'fx-base-amber': 0.3,
    })[r.materialId]);
    const out = applyIfraCaps(rows, neat, rows.map(() => true), batchG);
    const at = (id) => rows.findIndex((r) => r.materialId === id);
    const total = (g) => (g[at('fx-top-sour')] + 0.06 * g[at('fx-top-peel')] + 0.04 * g[at('fx-heart-petal')]) / batchG * 100;
    expect(total(neat)).toBeGreaterThan(0.6);
    expect(total(out)).toBeCloseTo(0.6, 9);
    // one factor for every member
    const f = out[at('fx-top-sour')] / neat[at('fx-top-sour')];
    expect(out[at('fx-top-peel')] / neat[at('fx-top-peel')]).toBeCloseTo(f, 12);
    expect(out[at('fx-heart-petal')] / neat[at('fx-heart-petal')]).toBeCloseTo(f, 12);
    // excess lands on the non-member of the same layer; other layers untouched
    expect(out[at('fx-top-clear')]).toBeGreaterThan(neat[at('fx-top-clear')]);
    expect(out[at('fx-heart-calm')]).toBeGreaterThan(neat[at('fx-heart-calm')]);
    expect(out[at('fx-base-root')]).toBe(neat[at('fx-base-root')]);
    // grams are conserved per layer
    for (const layer of ['top', 'heart', 'base']) {
      const sum = (g) => rows.reduce((s, r, i) => s + (r.layer === layer ? g[i] : 0), 0);
      expect(sum(out)).toBeCloseTo(sum(neat), 12);
    }
  });

  it('throws FormulaInfeasible naming the standard when a layer holds only its members', () => {
    const accord = { rows: FX_SOUR_ACCORD.rows.filter((r) => r.materialId !== 'fx-top-clear') };
    expect(() => run('FIRE', 'small', { accord })).toThrow(FormulaInfeasible);
    expect(() => run('FIRE', 'small', { accord })).toThrow(/Fixture Sour: no top row outside the standard/);
  });
});

describe('ifraStepDown across rows', () => {
  it('steps the largest contributor and names the standard total in the log', () => {
    const kit = FX_SOUR_KIT;
    const rows = joinAccord(FX_SOUR_ACCORD, kit);
    const at = (id) => rows.findIndex((r) => r.materialId === id);
    const grams = rows.map(() => 0.1);
    const stocks = rows.map(() => 1);
    // sour 0.03 g = 0.4286%; peel 1.50 g × 6% = 0.09 g → +1.2857% → total way over
    grams[at('fx-top-sour')] = 0.03;
    grams[at('fx-top-peel')] = 1.5;
    stocks[at('fx-top-sour')] = 1;
    const { grams: out, lines } = ifraStepDown(rows, grams, stocks, rows.map(() => true), 7);
    const total = (out[at('fx-top-sour')] + 0.06 * out[at('fx-top-peel')] + 0.04 * out[at('fx-heart-petal')]) / 7 * 100;
    expect(total).toBeLessThanOrEqual(0.6 + 1e-9);
    expect(out[at('fx-top-peel')]).toBeLessThan(1.5);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toBe('IFRA Fixture Peel stepped down 0.01 g → 1.49 g (Fixture Sour total)');
  });
});

describe('computeFormula with a cross-row standard', () => {
  it.each(CASES)('%s/%s: the summed Fixture Sour total is within its limit and reported once', (el, b) => {
    const f = run(el, b);
    const entries = f.ifra.filter((e) => e.standard === 'Fixture Sour');
    expect(entries).toHaveLength(1);
    const [e] = entries;
    expect(e.ok).toBe(true);
    expect(e.limitPct).toBe(0.6);
    expect(e.neatPct).toBeCloseTo(sourTotal(f), 8);
    expect(e.neatPct).toBeLessThanOrEqual(0.6 + 1e-9);
    expect(e.materialIds.sort()).toEqual(['fx-heart-petal', 'fx-top-peel', 'fx-top-sour']);
  });

  it.each(CASES.filter(([el]) => el === 'EARTH' || el === 'FIRE'))(
    '%s/%s: the summed limit binds, and per-row caps alone would breach it (not vacuous)',
    (el, b) => {
      const f = run(el, b);
      expect(sourTotal(f)).toBeGreaterThan(0.6 * 0.95);
      const own = f.ifra.find((e) => e.materialId === 'fx-top-sour');
      expect(own.neatPct).toBeLessThan(0.6);
      // the same kit with the constituents hidden: only the own cap is checked
      const blind = FX_SOUR_KIT.map((m) => ({ ...m, ifraConstituents: [] }));
      const g = run(el, b, { kit: blind });
      expect(g.ifra.some((e) => e.standard)).toBe(false);
      expect(sourTotal(g)).toBeGreaterThan(0.6);
    },
  );

  it('per-row entries keep their shape next to the standard entries', () => {
    const f = run('WATER', 'small');
    for (const e of f.ifra) {
      if (e.materialId) expect(Object.keys(e).sort()).toEqual(['limitPct', 'materialId', 'neatPct', 'ok']);
      else expect(Object.keys(e).sort()).toEqual(['limitPct', 'materialIds', 'neatPct', 'ok', 'standard']);
    }
  });

  it('fuzz: 6000 random salts / tilts / reaches / batches hold every invariant, totals included', () => {
    const next = rng(0x5c3a7);
    let feasible = 0;
    for (let n = 0; n < 6000; n++) {
      const el = ELEMENTS[Math.floor(next() * 4)];
      const b = next() < 0.5 ? 'small' : 'large';
      const salt = Uint8Array.from({ length: 32 }, () => Math.floor(next() * 256));
      const solTilt = next() < 0.15 ? null : next() * 2 - 1;
      const chaosReach = next() < 0.15 ? null : 0.05 + next() * 0.25;
      let f;
      try {
        f = run(el, b, { salt, solTilt, chaosReach });
      } catch (err) {
        if (err instanceof FormulaInfeasible) continue;
        throw err;
      }
      feasible++;
      const batchG = BATCHES[b].grams;
      expect(Math.abs(f.actualPct - TARGET_PCT[el])).toBeLessThanOrEqual(STRENGTH_TOL_PT);
      expect(f.ifra.every((e) => e.ok && e.neatPct <= e.limitPct + 1e-9)).toBe(true);
      expect(sourTotal(f)).toBeLessThanOrEqual(0.6 + 1e-9);
      const weighed = f.rows.reduce((s, r) => s + r.grams, 0);
      expect(Math.round((weighed + f.alcoholGrams) * 100)).toBe(Math.round(batchG * 100));
      expect(f.rows.every((r) => r.grams >= MIN_WEIGH_G - 1e-12)).toBe(true);
    }
    expect(feasible).toBeGreaterThan(5900);
  });
});

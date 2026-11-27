// Review Focus 5: every card reachable from the P0 fixtures, plus one
// synthetic card per family (every note of that family), through the real kit
// across 4 elements × 2 batches × solTilt {−1, 0, 1} × chaosReach {0.05, 0.30}
// × 4 salts = 2,880 formulas. Every formula that compiles holds every Task 1
// invariant, IFRA totals by standard included (decision B).
//
// Coumarin, ambrox and cashmeran have only crystals and a 1% stock (no cited
// 10% solubility; coumarin's measured saturation is 9.8% w/w at 20 °C), so a
// sub-0.05 g dose weighs as up to 5 g of 1% solution. Where that overfills the
// batch the engine snaps it to 0.05 g of crystals (author ruling 2026-11-27);
// before the ruling 314 of these formulas were FormulaInfeasible.
import { describe, it, expect } from 'vitest';
import {
  computeFormula, FormulaInfeasible, BATCHES, BANDS, TARGET_PCT, MIN_WEIGH_G,
  ETHANOL_G_PER_ML, FILL_MAX, STRENGTH_TOL_PT,
} from '../formulaEngine';
import { buildBaseAccord } from '../baseAccord';
import { MATERIALS } from '../materials';
import { NOTE_MATERIALS } from '../noteInterpretation';
import { buildPerfumeCard, PERF_NOTES } from '../../collider/perfumeCard';
import { FIXTURES } from '../../collider/__tests__/fixtures';
import { expectWeighedSplitInBands } from './weighedSplit';

const ELEMENTS = ['AIR', 'WATER', 'EARTH', 'FIRE'];
const SALTS = [0, 1, 2, 3].map((k) => Uint8Array.from({ length: 32 },
  (_, i) => (k === 0 ? 0 : k === 1 ? 255 : (i * 37 * k + 11) % 256)));

const CARDS = [
  ...FIXTURES.map((f) => [`fixture ${f.domA}×${f.domB}`, buildPerfumeCard(f.domA, f.domB, f.result)]),
  ...Object.keys(PERF_NOTES.top).map((fam) => [`family ${fam}`, {
    topNotes: PERF_NOTES.top[fam], heartNotes: PERF_NOTES.heart[fam], baseNotes: PERF_NOTES.base[fam],
  }]),
];

const byId = new Map(MATERIALS.map((m) => [m.id, m]));

// IFRA by standard, recomputed from the weighed rows and the kit table alone.
function standardTotals(f, batchG) {
  const totals = new Map();
  const add = (key, limit, pct) => {
    const t = totals.get(key) ?? { usage: 0 };
    t.usage += pct / limit;
    totals.set(key, t);
  };
  for (const r of f.rows) {
    const m = byId.get(r.materialId);
    const pct = (r.grams * r.stock) / batchG * 100;
    const src = m.sources.ifraSource;
    if (m.ifraCat4MaxPct != null) add(src.unrestricted ? `own:${m.id}` : src.url, m.ifraCat4MaxPct, pct);
    for (const c of m.ifraConstituents ?? []) {
      if (c.standardCat4MaxPct != null) add(c.standardUrl, c.standardCat4MaxPct, (pct * c.pctInMaterial) / 100);
    }
  }
  return totals;
}

function sweep() {
  const ok = [];
  const infeasible = [];
  for (const [label, card] of CARDS) {
    const accord = buildBaseAccord(card, NOTE_MATERIALS, MATERIALS);
    for (const element of ELEMENTS) for (const [batchName, batch] of Object.entries(BATCHES)) {
      for (const solTilt of [-1, 0, 1]) for (const chaosReach of [0.05, 0.3]) for (const [s, salt] of SALTS.entries()) {
        const where = `${label} ${element}/${batchName} tilt ${solTilt} reach ${chaosReach} salt ${s}`;
        try {
          const f = computeFormula({ baseAccord: accord, salt, kit: MATERIALS, batch, modulators: { element, restWeeks: 4, solTilt, chaosReach } });
          ok.push({ where, f, element, batch });
        } catch (err) {
          if (!(err instanceof FormulaInfeasible)) throw err;
          infeasible.push({ where, err });
        }
      }
    }
  }
  return { ok, infeasible };
}

const { ok, infeasible } = sweep();

describe('formula coverage through the real kit (Review Focus 5)', () => {
  it('runs the full 2,880-formula matrix', () => {
    expect(ok.length + infeasible.length).toBe(CARDS.length * 4 * 2 * 3 * 2 * 4);
    expect(CARDS.length).toBe(FIXTURES.length + Object.keys(PERF_NOTES.top).length);
  });

  it('every combination compiles: no FormulaInfeasible', () => {
    expect(infeasible.map(({ where, err }) => `${where}: ${err.message}`)).toEqual([]);
  });

  it('snaps happen only on the 1%-only solids, weigh 0.05 g of crystals, and are logged', () => {
    const snappedFormulas = ok.filter(({ f }) => f.snapped.length > 0);
    expect(snappedFormulas.length).toBeGreaterThan(0);
    for (const { where, f } of snappedFormulas) {
      expect(f.snapped.length, where).toBeLessThanOrEqual(3);
      expect(f.log.filter((l) => l.startsWith('SNAP ')).length, where).toBe(f.snapped.length);
      for (const s of f.snapped) {
        expect(['coumarin', 'ambrox', 'cashmeran'], where).toContain(s.materialId);
        const row = f.rows.find((r) => r.materialId === s.materialId);
        expect(row.stock, where).toBe(1);
        expect(row.grams, where).toBeGreaterThanOrEqual(MIN_WEIGH_G);
        expect(s.takenG, where).toBeLessThan(MIN_WEIGH_G);
      }
    }
  });

  it('every compiled formula holds strength, grams, totals, fill and bands', () => {
    for (const { where, f, element, batch } of ok) {
      expect(Math.abs(f.actualPct - TARGET_PCT[element]), where).toBeLessThanOrEqual(STRENGTH_TOL_PT);
      for (const r of f.rows) {
        expect(r.grams, where).toBeGreaterThanOrEqual(MIN_WEIGH_G);
        expect(Math.abs(r.grams * 100 - Math.round(r.grams * 100)), where).toBeLessThan(1e-9);
      }
      const weighed = f.rows.reduce((s, r) => s + r.grams, 0);
      expect(Math.abs(weighed + f.alcoholGrams - batch.grams), where).toBeLessThan(0.005);
      expect(f.alcoholGrams, where).toBeGreaterThanOrEqual(0);
      expect(f.fillMl, where).toBeCloseTo(batch.grams / ETHANOL_G_PER_ML, 12);
      expect(f.fillMl, where).toBeLessThanOrEqual(FILL_MAX * batch.vialMl);
      const ds = f.designSplit;
      expect(Math.abs(ds.top + ds.heart + ds.base - 100), where).toBeLessThan(1e-9);
      for (const k of ['top', 'heart', 'base']) {
        expect(ds[k], where).toBeGreaterThanOrEqual(BANDS[k][0] - 1e-9);
        expect(ds[k], where).toBeLessThanOrEqual(BANDS[k][1] + 1e-9);
      }
      expectWeighedSplitInBands(f);
    }
  });

  it('every compiled formula is under every IFRA limit, summed by standard, recomputed from the table', () => {
    for (const { where, f, batch } of ok) {
      expect(f.ifra.every((e) => e.ok && e.neatPct <= e.limitPct + 1e-9), where).toBe(true);
      for (const [key, t] of standardTotals(f, batch.grams)) expect(t.usage, `${where} ${key}`).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('the cross-row citral total binds somewhere in the matrix (decision B is exercised)', () => {
    const citral = ok.flatMap(({ f }) => f.ifra.filter((e) => e.standard === 'Citral'));
    expect(citral.length).toBeGreaterThan(0);
    expect(Math.max(...citral.map((e) => e.neatPct))).toBeGreaterThan(0.6 * 0.95);
  });

  it('every resinous family card now compiles in at least one element (heart bridge)', () => {
    expect(ok.some(({ where }) => where.startsWith('family resinous '))).toBe(true);
  });
});

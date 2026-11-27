// Author ruling 2026-11-27: a sub-0.05 g dose that could only be weighed from
// a 1% stock (up to 5 g of solution) snaps to 0.05 g of crystals, only when
// the formula would otherwise overfill its batch.
import { describe, it, expect } from 'vitest';
import {
  computeFormula, FormulaInfeasible, BATCHES, TARGET_PCT, STRENGTH_TOL_PT, MIN_WEIGH_G,
} from '../formulaEngine';
import { FX_KIT, FX_ACCORD } from './kitFixture';
import { expectWeighedSplitInBands } from './weighedSplit';

// Two fictional crystalline base materials with only crystals and a 1% stock.
const grain = (id, extra = {}) => ({
  id, name: `Fixture ${id.slice(8)}`, cas: `FX-09${id.length}`, layer: 'base', role: 'crystal',
  physicalState: 'solid', stocks: [1.0, 0.01], ifraCat4MaxPct: null, sources: {}, ...extra,
});
const kitWith = (extra = {}) => [...FX_KIT, grain('fx-base-grain', extra), grain('fx-base-salt', extra)];
const accordWith = (parts) => ({
  rows: [...FX_ACCORD.rows, { materialId: 'fx-base-grain', parts }, { materialId: 'fx-base-salt', parts }],
});
const run = (element, parts, kit = kitWith()) => computeFormula({
  baseAccord: accordWith(parts), salt: new Uint8Array(32), kit, batch: BATCHES.small,
  modulators: { element, restWeeks: 4 },
});

describe('snap to the neat floor', () => {
  it('a formula that fits never snaps (nothing changes for it)', () => {
    const f = run('FIRE', 0.5);
    expect(f.snapped).toEqual([]);
    expect(f.log.some((l) => l.startsWith('SNAP'))).toBe(false);
    expect(f.rows.find((r) => r.materialId === 'fx-base-grain').stock).toBe(0.01);
  });

  it('an overfilling formula snaps the gap rows to 0.05 g crystals and then fits', () => {
    const f = run('FIRE', 2);
    expect(f.snapped.map((s) => s.materialId).sort()).toEqual(['fx-base-grain', 'fx-base-salt']);
    for (const id of ['fx-base-grain', 'fx-base-salt']) {
      const r = f.rows.find((x) => x.materialId === id);
      expect(r.stock).toBe(1);
      expect(r.grams).toBe(MIN_WEIGH_G);
    }
    for (const s of f.snapped) {
      expect(s.fromStock).toBe(0.01);
      expect(s.fromGrams).toBeGreaterThan(1);
      expect(s.takenG).toBeGreaterThan(0);
      expect(s.takenG).toBeLessThan(MIN_WEIGH_G);
    }
    expect(f.alcoholGrams).toBeGreaterThanOrEqual(0);
    expect(Math.abs(f.actualPct - TARGET_PCT.FIRE)).toBeLessThanOrEqual(STRENGTH_TOL_PT);
    expectWeighedSplitInBands(f);
  });

  it('logs each snap after /CHAOS and before step / drop lines, naming the stock and the overfill', () => {
    const f = run('EARTH', 2);
    expect(f.snapped).toHaveLength(1);
    const at = f.log.findIndex((l) => l.startsWith('SNAP'));
    expect(f.log[at - 1]).toMatch(/^\/CHAOS/);
    const [s] = f.snapped;
    expect(f.log[at]).toBe(
      `SNAP Fixture ${s.materialId.slice(8)} → 0.05 g crystals · from its 1% stock it weighed ${s.fromGrams.toFixed(2)} g`
      + ` and overfilled the 7.00 g batch; the rest of the base gives up ${s.takenG.toFixed(3)} g`,
    );
  });

  it('a snapped row is pinned: two gap rows in one layer both snap once (no ping-pong)', () => {
    const f = run('FIRE', 2);
    expect(f.snapped).toHaveLength(2);
    expect(new Set(f.snapped.map((s) => s.materialId)).size).toBe(2);
  });

  it('without a neat stock nothing can snap, and the overfill stays a hard error', () => {
    const kit = kitWith({ stocks: [0.01] });
    expect(() => run('FIRE', 2, kit)).toThrow(FormulaInfeasible);
    expect(() => run('FIRE', 2, kit)).toThrow(/weighed stocks exceed the batch weight/);
  });

  it('never snaps past an IFRA limit: 0.05 g at 7 g is 0.714%, over a 0.5% cap', () => {
    const kit = kitWith({ ifraCat4MaxPct: 0.5 });
    expect(() => run('FIRE', 2, kit)).toThrow(/weighed stocks exceed the batch weight/);
  });
});

// Test helper: the weighed (bottle) split rule, ruling R17.
import { expect } from 'vitest';
import { BANDS, LAYERS } from '../formulaEngine';

// weighedSplit is recomputed from the rows, sums to 100 and sits inside BANDS.
// A share may sit outside its band only where a single 0.01 g grain cannot
// fit, and then by at most one grain of the coarsest weighed stock, as a share
// of the weighed concentrate: 0.01 g × max stock ÷ Σ(grams × stock) × 100 pt.
export function expectWeighedSplitInBands(f) {
  const sums = { top: 0, heart: 0, base: 0 };
  for (const r of f.rows) sums[r.layer] += r.grams * r.stock;
  const conc = sums.top + sums.heart + sums.base;
  const tolPt = (0.01 * Math.max(...f.rows.map((r) => r.stock))) / conc * 100;
  const sum = f.weighedSplit.top + f.weighedSplit.heart + f.weighedSplit.base;
  expect(Math.abs(sum - 100)).toBeLessThan(1e-9);
  for (const k of LAYERS) {
    const share = f.weighedSplit[k];
    expect(share).toBeCloseTo((sums[k] / conc) * 100, 9);
    const miss = Math.max(0, BANDS[k][0] - share, share - BANDS[k][1]);
    expect(miss).toBeLessThanOrEqual(miss > 1e-9 ? tolPt : 1e-9);
  }
}

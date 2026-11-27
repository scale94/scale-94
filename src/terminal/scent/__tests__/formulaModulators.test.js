import { describe, it, expect } from 'vitest';
import {
  TARGET_PCT, BANDS, BATCHES, MIN_WEIGH_G, LAYERS,
  SOL_MAX_SHIFT_PT, CHAOS_DEFAULT_REACH, CHAOS_REACH_RANGE,
  FormulaInfeasible, computeFormula, joinAccord, applyChaos,
} from '../formulaEngine';
import { FX_KIT, FX_ACCORD } from './kitFixture';
import { expectWeighedSplitInBands } from './weighedSplit';

const ZERO_SALT = new Uint8Array(32);
const RAMP_SALT = Uint8Array.from({ length: 32 }, (_, i) => (i * 37 + 11) % 256);
const ELEMENTS = ['AIR', 'WATER', 'EARTH', 'FIRE'];
const BATCH_NAMES = Object.keys(BATCHES);

const SOL_UNWITNESSED = '/SOL unwitnessed — the sun left the top notes alone';
const CHAOS_UNWITNESSED = '/CHAOS periphery unwitnessed — default reach';

const mat = (id) => FX_KIT.find((m) => m.id === id);

// Top parts lowered so the raw split sits inside the bands (top ≈ 21.98,
// heart ≈ 34.06, base ≈ 43.96): the tilt has room to move both ways.
const IN_BAND_ACCORD = {
  rows: FX_ACCORD.rows.map((r) => {
    const top = { 'fx-top-glint': 10, 'fx-top-spark': 6, 'fx-top-hush': 4 };
    return top[r.materialId] != null ? { ...r, parts: top[r.materialId] } : r;
  }),
};

const run = ({
  element = 'EARTH', batchName = 'small', salt = ZERO_SALT, baseAccord = FX_ACCORD, ...mods
} = {}) => computeFormula({
  baseAccord,
  salt,
  modulators: { element, restWeeks: 4, ...mods },
  batch: BATCHES[batchName],
  kit: FX_KIT,
});

const solLine = (top, base) => {
  const f = (x) => `${x < 0 && x.toFixed(1) !== '-0.0' ? '−' : '+'}${Math.abs(x).toFixed(1)}`;
  return `/SOL → top ${f(top)} pt / base ${f(base)} pt`;
};

// mulberry32: small seeded PRNG so the salt sweep is deterministic.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function withinLayerShares(rows) {
  const sums = { top: 0, heart: 0, base: 0 };
  for (const r of rows) sums[r.layer] += r.parts;
  return rows.map((r) => r.parts / sums[r.layer]);
}

describe('modulator constants', () => {
  it('match the brief', () => {
    expect(SOL_MAX_SHIFT_PT).toBe(5);
    expect(CHAOS_DEFAULT_REACH).toBe(0.15);
    expect(CHAOS_REACH_RANGE).toEqual([0.05, 0.30]);
  });
});

describe('/SOL tilt', () => {
  it('solTilt +1 moves ≤5 pt from top to base, staying inside BANDS', () => {
    const plain = run();
    const f = run({ solTilt: 1 });
    const dTop = f.designSplit.top - plain.designSplit.top;
    const dBase = f.designSplit.base - plain.designSplit.base;
    expect(dTop).toBeLessThan(0);
    expect(dTop).toBeGreaterThanOrEqual(-SOL_MAX_SHIFT_PT - 1e-9);
    expect(dBase).toBeCloseTo(-dTop, 9);
    expect(f.designSplit.heart).toBeCloseTo(plain.designSplit.heart, 12);
    for (const k of LAYERS) {
      expect(f.designSplit[k]).toBeGreaterThanOrEqual(BANDS[k][0]);
      expect(f.designSplit[k]).toBeLessThanOrEqual(BANDS[k][1]);
    }
    // FX_ACCORD's top sits at 25 with base ≈ 43: the full 5 pt fits
    expect(dTop).toBeCloseTo(-5, 9);
    expect(f.log[1]).toBe(solLine(-5, 5));
  });

  it('solTilt −1 does the reverse', () => {
    const plain = run({ baseAccord: IN_BAND_ACCORD });
    const f = run({ baseAccord: IN_BAND_ACCORD, solTilt: -1 });
    const dTop = f.designSplit.top - plain.designSplit.top;
    const dBase = f.designSplit.base - plain.designSplit.base;
    expect(dTop).toBeGreaterThan(0);
    expect(dTop).toBeLessThanOrEqual(SOL_MAX_SHIFT_PT + 1e-9);
    expect(dBase).toBeCloseTo(-dTop, 9);
    expect(f.designSplit.heart).toBeCloseTo(plain.designSplit.heart, 12);
    // top had only ≈3.02 pt of room below its 25% ceiling: clamped, and the log says what moved
    expect(f.designSplit.top).toBeCloseTo(25, 9);
    expect(f.log[1]).toBe(solLine(dTop, dBase));
  });

  it('a half tilt moves exactly 2.5 pt both ways where the bands allow it', () => {
    const plain = run({ baseAccord: IN_BAND_ACCORD });
    const up = run({ baseAccord: IN_BAND_ACCORD, solTilt: 0.5 });
    const down = run({ baseAccord: IN_BAND_ACCORD, solTilt: -0.5 });
    expect(up.designSplit.top - plain.designSplit.top).toBeCloseTo(-2.5, 9);
    expect(up.designSplit.base - plain.designSplit.base).toBeCloseTo(2.5, 9);
    expect(down.designSplit.top - plain.designSplit.top).toBeCloseTo(2.5, 9);
    expect(down.designSplit.base - plain.designSplit.base).toBeCloseTo(-2.5, 9);
    expect(up.log[1]).toBe('/SOL → top −2.5 pt / base +2.5 pt');
    expect(down.log[1]).toBe('/SOL → top +2.5 pt / base −2.5 pt');
  });

  it("null solTilt logs exactly the unwitnessed line and leaves the split equal to Task 1's", () => {
    const absent = run();
    for (const solTilt of [null, undefined]) {
      const f = run({ solTilt });
      expect(f.log[1]).toBe(SOL_UNWITNESSED);
      expect(f.designSplit).toEqual(absent.designSplit);
    }
    // Task 1's projected split for FX_ACCORD: top clamped to 25, the rest by room
    expect(absent.designSplit.top).toBeCloseTo(25, 12);
    expect(absent.log[1]).toBe(SOL_UNWITNESSED);
  });

  it.each([1.01, -1.5, NaN, Infinity, '1', true])('solTilt %s throws RangeError', (solTilt) => {
    expect(() => run({ solTilt })).toThrow(RangeError);
  });

  it.each([-1, 0, 1])('solTilt %s is accepted', (solTilt) => {
    expect(() => run({ solTilt })).not.toThrow();
  });
});

describe('/CHAOS salt drift', () => {
  it('salt micro-shifts: two different salts → different row grams, same designSplit', () => {
    const a = run({ element: 'FIRE', batchName: 'large', salt: ZERO_SALT });
    const b = run({ element: 'FIRE', batchName: 'large', salt: RAMP_SALT });
    expect(b.designSplit).toEqual(a.designSplit);
    const gramsOf = (f) => Object.fromEntries(f.rows.map((r) => [r.materialId, r.grams]));
    expect(gramsOf(b)).not.toEqual(gramsOf(a));
  });

  it.each([0.05, 0.15, 0.30])(
    "reach %s: each row's within-layer share ratio stays inside [(1−r)/(1+r), (1+r)/(1−r)]",
    (reach) => {
      const rows = joinAccord(FX_ACCORD, FX_KIT);
      const before = withinLayerShares(rows);
      const rng = mulberry32(0x5eed + Math.round(reach * 100));
      for (let s = 0; s < 32; s++) {
        const salt = Uint8Array.from({ length: 32 }, () => Math.floor(rng() * 256));
        const drifted = applyChaos(rows, salt, reach);
        const after = withinLayerShares(drifted);
        const lo = (1 - reach) / (1 + reach);
        const hi = (1 + reach) / (1 - reach);
        for (let i = 0; i < rows.length; i++) {
          const ratio = after[i] / before[i];
          expect(ratio).toBeGreaterThanOrEqual(lo - 1e-12);
          expect(ratio).toBeLessThanOrEqual(hi + 1e-12);
        }
        // renormalised within the layer: each layer's total parts are unchanged
        for (const k of LAYERS) {
          const sum = (rs) => rs.filter((r) => r.layer === k).reduce((t, r) => t + r.parts, 0);
          expect(sum(drifted)).toBeCloseTo(sum(rows), 9);
        }
      }
    },
  );

  it('extreme salts really drift a row by more than a rounding error', () => {
    const rows = joinAccord(FX_ACCORD, FX_KIT);
    // row 0 (top) u = +1, rows 1..2 (top) u = −1
    const salt = new Uint8Array(32);
    salt[0] = 255;
    const after = withinLayerShares(applyChaos(rows, salt, 0.3));
    const before = withinLayerShares(rows);
    expect(after[0] / before[0]).toBeGreaterThan(1.2);
  });

  it('all-zero salt with reach r is still bounded (and leaves within-layer shares unchanged)', () => {
    const rows = joinAccord(FX_ACCORD, FX_KIT);
    const before = withinLayerShares(rows);
    for (const reach of [0.05, 0.15, 0.30]) {
      const after = withinLayerShares(applyChaos(rows, ZERO_SALT, reach));
      for (let i = 0; i < rows.length; i++) {
        expect(after[i]).toBeCloseTo(before[i], 12);
        expect(Number.isFinite(after[i])).toBe(true);
      }
    }
    for (const reach of [0.05, 0.30]) {
      expect(() => run({ chaosReach: reach, salt: ZERO_SALT })).not.toThrow();
    }
  });

  it('applyChaos is pure: it does not mutate its input rows', () => {
    const rows = joinAccord(FX_ACCORD, FX_KIT);
    const snapshot = rows.map((r) => r.parts);
    applyChaos(rows, RAMP_SALT, 0.3);
    expect(rows.map((r) => r.parts)).toEqual(snapshot);
  });

  it("chaosReach null logs '/CHAOS periphery unwitnessed — default reach' and uses 0.15", () => {
    const explicit = run({ salt: RAMP_SALT, chaosReach: CHAOS_DEFAULT_REACH });
    for (const chaosReach of [null, undefined]) {
      const f = run({ salt: RAMP_SALT, chaosReach });
      expect(f.log[3]).toBe(CHAOS_UNWITNESSED);
      expect(f.rows).toEqual(explicit.rows);
    }
    expect(explicit.log[3]).toBe('/CHAOS salt → ±15% per-row drift');
  });

  it.each([0.05, 0.3])('chaosReach %s logs its reach', (chaosReach) => {
    const f = run({ salt: RAMP_SALT, chaosReach });
    expect(f.log[3]).toBe(`/CHAOS salt → ±${(chaosReach * 100).toFixed(0)}% per-row drift`);
  });

  it.each([0.049, 0.301, 0, -0.1, 1, NaN, '0.1', true])(
    'chaosReach %s outside [0.05, 0.30] throws RangeError',
    (chaosReach) => {
      expect(() => run({ chaosReach })).toThrow(RangeError);
    },
  );

  it.each([
    ['missing', undefined],
    ['short', new Uint8Array(16)],
    ['non-byte', Array.from({ length: 32 }, () => 300)],
  ])('a %s salt throws RangeError', (_, salt) => {
    expect(() => computeFormula({
      baseAccord: FX_ACCORD, salt, modulators: { element: 'AIR', restWeeks: 4 },
      batch: BATCHES.small, kit: FX_KIT,
    })).toThrow(RangeError);
  });
});

describe('Review Focus 4: invariants after modulation', () => {
  const rng = mulberry32(0xa37e1);
  const SALTS = Array.from({ length: 16 }, () =>
    Uint8Array.from({ length: 32 }, () => Math.floor(rng() * 256)));
  // FX_ACCORD's top is pinned at its 25% ceiling, so −1 cannot move it there:
  // the base→top direction is swept on IN_BAND_ACCORD, where it does move.
  const ACCORDS = { FX_ACCORD, IN_BAND_ACCORD };
  const SWEEPS = [['FX_ACCORD', 1], ['IN_BAND_ACCORD', -1], ['IN_BAND_ACCORD', 1]];
  const CASES = [];
  for (const [accordName, solTilt] of SWEEPS) {
    for (const element of ELEMENTS) {
      for (const batchName of BATCH_NAMES) CASES.push([accordName, solTilt, element, batchName]);
    }
  }
  const SOL_SHIFT = /^\/SOL → top ([+−])(\d+\.\d) pt \/ base ([+−])(\d+\.\d) pt$/;

  it.each(CASES)(
    '%s, solTilt %s, %s/%s, chaosReach 0.30 × 16 salts: every Task 1 invariant holds',
    (accordName, solTilt, element, batchName) => {
      const batch = BATCHES[batchName];
      for (const salt of SALTS) {
        // FormulaInfeasible is not swallowed here: any infeasible combo fails the test
        const f = run({
          element, batchName, salt, solTilt, chaosReach: 0.3, baseAccord: ACCORDS[accordName],
        });

        // the tilt really moved, in the asked direction, so this case is not a solTilt-0 run
        const m = SOL_SHIFT.exec(f.log[1]);
        expect(m).not.toBeNull();
        expect(Number(m[2])).toBeGreaterThan(0);
        expect(m[2]).toBe(m[4]);
        expect(m[1]).toBe(solTilt > 0 ? '−' : '+');
        expect(m[3]).toBe(solTilt > 0 ? '+' : '−');

        // the IFRA path is reached: some limited row sits within one weighing grain
        // of its limit (a binding cap), or a step-down line was logged
        const binds = f.ifra.some((e) => {
          const row = f.rows.find((r) => r.materialId === e.materialId);
          const grainPct = (0.01 * row.stock) / batch.grams * 100;
          return e.limitPct - e.neatPct <= grainPct + 1e-9;
        }) || f.log.some((l) => l.startsWith('IFRA '));
        expect(binds).toBe(true);

        expect(Math.abs(f.actualPct - TARGET_PCT[element])).toBeLessThanOrEqual(0.5);
        const neat = f.rows.reduce((s, r) => s + r.grams * r.stock, 0);
        expect(f.actualPct).toBeCloseTo(neat / batch.grams * 100, 8);

        const sum = f.designSplit.top + f.designSplit.heart + f.designSplit.base;
        expect(Math.abs(sum - 100)).toBeLessThan(1e-9);
        for (const k of LAYERS) {
          expect(f.designSplit[k]).toBeGreaterThanOrEqual(BANDS[k][0]);
          expect(f.designSplit[k]).toBeLessThanOrEqual(BANDS[k][1]);
          expect(f.rows.some((r) => r.layer === k)).toBe(true);
        }
        expectWeighedSplitInBands(f);

        for (const r of f.rows) {
          expect(r.grams).toBeGreaterThanOrEqual(MIN_WEIGH_G);
          expect(Math.abs(r.grams * 100 - Math.round(r.grams * 100))).toBeLessThan(1e-9);
          expect(mat(r.materialId).stocks).toContain(r.stock);
        }
        const total = f.rows.reduce((s, r) => s + r.grams, 0) + f.alcoholGrams;
        expect(Math.abs(total - batch.grams)).toBeLessThan(0.005);
        expect(f.alcoholGrams).toBeGreaterThanOrEqual(0);
        expect(f.fillMl).toBe(batch.grams / 0.789);
        expect(f.fillMl).toBeLessThanOrEqual(0.9 * batch.vialMl);

        const limited = f.rows.filter((r) => mat(r.materialId).ifraCat4MaxPct != null);
        expect(f.ifra.length).toBe(limited.length);
        for (const e of f.ifra) {
          const row = f.rows.find((r) => r.materialId === e.materialId);
          const recomputed = (row.grams * row.stock) / batch.grams * 100;
          expect(e.neatPct).toBeCloseTo(recomputed, 8);
          expect(e.ok).toBe(true);
          expect(e.neatPct).toBeLessThanOrEqual(mat(e.materialId).ifraCat4MaxPct);
        }
      }
    },
  );

  it('the infeasible path still surfaces as FormulaInfeasible under modulation', () => {
    const kit = FX_KIT.map((m) => (m.layer === 'heart' ? { ...m, ifraCat4MaxPct: 0.1 } : m));
    expect(() => computeFormula({
      baseAccord: FX_ACCORD, salt: RAMP_SALT,
      modulators: { element: 'FIRE', restWeeks: 4, solTilt: 1, chaosReach: 0.3 },
      batch: BATCHES.small, kit,
    })).toThrow(FormulaInfeasible);
  });
});

describe('per-source log', () => {
  it.each(ELEMENTS.flatMap((el) => [[el, null, null], [el, 1, 0.3], [el, -0.5, 0.05]]))(
    '%s solTilt %s chaosReach %s: exactly one line per source, ELEMENT, /SOL, /LUNAR, /CHAOS, then step/drop lines',
    (element, solTilt, chaosReach) => {
      const f = run({ element, salt: RAMP_SALT, solTilt, chaosReach });
      const head = f.log.slice(0, 4);
      expect(head[0].startsWith(`ELEMENT ${element} → `)).toBe(true);
      expect(head[1].startsWith('/SOL')).toBe(true);
      expect(head[2]).toBe('/LUNAR → 4 weeks in the dark');
      expect(head[3].startsWith('/CHAOS')).toBe(true);
      for (const prefix of ['ELEMENT', '/SOL', '/LUNAR', '/CHAOS']) {
        expect(f.log.filter((l) => l.startsWith(prefix)).length).toBe(1);
      }
      const tail = f.log.slice(4);
      expect(tail.length).toBeGreaterThan(0); // the fixture always drops fx-base-dust
      for (const l of tail) expect(/^(IFRA |DROP )/.test(l)).toBe(true);
      expect(f.log.some((l) => l.startsWith('DROP Fixture Dust'))).toBe(true);
    },
  );
});

describe('named readings (P3 ruling 4)', () => {
  it('labels name the reading inside each source line; the numbers stay the engine’s', () => {
    const plain = run({ salt: RAMP_SALT, solTilt: 0.5, chaosReach: 0.2 });
    const named = run({
      salt: RAMP_SALT, solTilt: 0.5, chaosReach: 0.2,
      labels: { lunar: 'SMOKE DISSOLUTION', sol: 'last release 3.2e31 erg', chaos: 'λ +0.412' },
    });
    expect(named.log[1]).toBe(plain.log[1].replace('/SOL → ', '/SOL last release 3.2e31 erg → '));
    expect(named.log[2]).toBe('/LUNAR SMOKE DISSOLUTION → 4 weeks in the dark');
    expect(named.log[3]).toBe('/CHAOS λ +0.412 → salt ±20% per-row drift');
    expect(named.rows).toEqual(plain.rows);
  });
  it('solAbsent replaces the unwitnessed /SOL line when there is no tilt', () => {
    const f = run({ labels: { solAbsent: '/SOL entered — nothing left the star, the top notes left alone' } });
    expect(f.log[1]).toBe('/SOL entered — nothing left the star, the top notes left alone');
  });
  it('a clause is ignored when its modulator is absent (no reading → P1 line)', () => {
    const f = run({ labels: { sol: 'last release 1e30 erg', chaos: 'λ +0.100' } });
    expect(f.log[1]).toBe(SOL_UNWITNESSED);
    expect(f.log[3]).toBe(CHAOS_UNWITNESSED);
  });
  it('no labels → every P1 string unchanged', () => {
    const f = run({ salt: RAMP_SALT, solTilt: -0.5, chaosReach: 0.05, labels: {} });
    expect(f.log[1]).toBe(run({ salt: RAMP_SALT, solTilt: -0.5, chaosReach: 0.05 }).log[1]);
    expect(f.log[1].startsWith('/SOL → top ')).toBe(true);
    expect(f.log[2]).toBe('/LUNAR → 4 weeks in the dark');
    expect(f.log[3]).toBe('/CHAOS salt → ±5% per-row drift');
  });
  it('rejects a non-string label', () => {
    expect(() => run({ labels: { lunar: 7 } })).toThrow(RangeError);
  });
});

// src/terminal/mercury/planet/__tests__/hyperSweep.test.js — phase 6a acceptance (spec §10.5).
// The full sweep: $env:HYPER_SWEEP='1'; npx vitest run src/terminal/mercury/planet/__tests__/hyperSweep.test.js
import { describe, it, expect } from 'vitest';
import { createFamily, DROP_V_REF } from '../breakupFamily';
import { returnTarget, createMuSolver, finishMuSolver, particleTurns, beginParticles, runParticles } from '../breakupBudget';
import { fireHyper, hyperReach, HYPER_N, HYPER_MIN_TARGET_S } from '../hyperFling';
import { PLANET_TUNE, CAMERA_DIST, CAMERA_FOV_DEG } from '../planetLook';
import { median } from './hyperTestKit';

const TURNS_MIN = 1.5;
const rVisOf = (cam, aspect) => CAMERA_DIST[cam] * Math.tan((CAMERA_FOV_DEG[cam] * Math.PI) / 360) * Math.min(1, aspect);
const VIEWS = { desktop: rVisOf('desktop', 1.6), phone: rVisOf('mobile', 0.45) };
const AXES = { y: [0, 12, 0], x: [12, 0, 0], xy: [12 / Math.SQRT2, 12 / Math.SQRT2, 0] };

function hyperCase({ N, eH, seed, axis, heat, view, pxPerUnit = 300 }) {
  const omega = AXES[axis];
  const reach = hyperReach(VIEWS[view]);
  const target = returnTarget(heat, PLANET_TUNE.dropDrift);
  const f = fireHyper(createFamily(seed), { N, eH, seed, omega, pxPerUnit, orbitS: PLANET_TUNE.hyperOrbit, reach, target });
  const env0 = { q: [0, 0, 0, 1], omega, gamma: PLANET_TUNE.dropDrag, kappa: PLANET_TUNE.dropCohesion, vRef: DROP_V_REF, pxPerUnit, omegaTh: PLANET_TUNE.breakOmega };
  const s = finishMuSolver(createMuSolver(f, env0, target));
  const tr = beginParticles(f, pxPerUnit, { eta: s.best, gamma: f.gammaH, tMax: target });
  runParticles(tr, Infinity);
  return { landed: s.landed, eta: s.best, turns: median(particleTurns(f, pxPerUnit, s.best, target)), rMax: tr.rMax, reach, target };
}

describe('hyper-fling acceptance (a fixed sample)', () => {
  const cases = [
    { N: 16, eH: 1, seed: 1, axis: 'y', heat: 80, view: 'desktop' },
    { N: 16, eH: 0, seed: 2, axis: 'xy', heat: 120, view: 'desktop' },
    { N: 8, eH: 1, seed: 3, axis: 'y', heat: 80, view: 'phone' },
    { N: 8, eH: 0.5, seed: 4, axis: 'x', heat: 40, view: 'phone' },
  ];
  for (const c of cases) {
    it(`lands, spirals and stays contained: ${JSON.stringify(c)}`, () => {
      const r = hyperCase(c);
      expect(r.landed).toBe(true);
      expect(r.turns).toBeGreaterThanOrEqual(TURNS_MIN);
      expect(r.rMax).toBeLessThanOrEqual(r.reach * (1 + 1e-9));
    });
  }
});

const HEATS = [28, 40, 60, 120];

describe.skipIf(!process.env.HYPER_SWEEP)('hyper-fling sweep (spec §10.5)', () => {
  it('100 % land, median turns ≥ 1.5, containment holds', () => {
    const rows = [];
    const skipped = Object.fromEntries(HEATS.map((h) => [h, 0]));
    for (const view of ['desktop', 'phone']) for (const N of [8, 14, 16].filter((n) => n <= HYPER_N.full))
      for (const eH of [0, 0.5, 1]) for (const axis of Object.keys(AXES)) for (const heat of HEATS) for (let seed = 1; seed <= 20; seed++) {
        // §10.6: a return window shorter than HYPER_MIN_TARGET_S never hyper-flings (it breaks the Phase 5 way)
        if (returnTarget(heat, PLANET_TUNE.dropDrift) < HYPER_MIN_TARGET_S) { skipped[heat]++; continue; }
        rows.push({ view, N, eH, axis, heat, seed, ...hyperCase({ N, eH, seed, axis, heat, view }) });
      }
    const bad = rows.filter((r) => !r.landed || r.rMax > r.reach * (1 + 1e-9));
    const turns = rows.map((r) => r.turns), eta = rows.map((r) => r.eta);
    console.log(`cases ${rows.length}; not landed / uncontained ${bad.length}; turns median ${median(turns).toFixed(2)} min ${Math.min(...turns).toFixed(2)};`
      + ` eta ${Math.min(...eta).toExponential(2)}..${Math.max(...eta).toExponential(2)}`);
    for (const v of ['desktop', 'phone']) {
      const t = rows.filter((r) => r.view === v).map((r) => r.turns);
      console.log(`${v}: turns median ${median(t).toFixed(2)} min ${Math.min(...t).toFixed(2)}`);
    }
    for (const h of HEATS) console.log(`heat ${h} (target ${returnTarget(h, PLANET_TUNE.dropDrift).toFixed(2)}): skipped ${skipped[h]}; not landed ${rows.filter((r) => r.heat === h && !r.landed).length}`);
    expect(bad).toEqual([]);
    expect(median(turns)).toBeGreaterThanOrEqual(TURNS_MIN);
  }, 1_800_000);
});

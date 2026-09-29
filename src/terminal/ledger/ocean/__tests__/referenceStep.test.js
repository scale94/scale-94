import { describe, it, expect } from 'vitest';
import { createOceanContext, step } from '../referenceStep';
import { bakeCurrents } from '../streamFunction';
import { createStepClock } from '../clock';
import { sagStep, kd, kaOcean, doSat, sstClimatology, TAU_T_DAYS, TAU_N_DAYS } from '../kinetics';
import { syntheticWorld, uniformVelocity, blob, mass } from './syntheticWorld';

const vortexCells = [{ name: 't', lon0: 20, lon1: 120, lat0: -50, lat1: 50, sign: 1, peak: 300, eps: 0.1 }];

describe('referenceStep guards', () => {
  it('survives 10k extreme steps: no NaN, no negatives, land exactly zero', () => {
    const { grid, mask } = syntheticWorld();
    const { vel } = bakeCurrents(grid, mask, { cells: vortexCells, acc: null });
    const ctx = createOceanContext(grid, mask.land, vel);
    const state = blob(grid, mask.land, 30, 16, 6, 1e6);
    const k = grid.idx(38, 15);
    const sources = [{ cells: [{ k, f: 50 }], conc: [1e4, 1e4, 1e4, 1e4] }];
    for (let s = 0; s < 10000; s++) step(ctx, state, { sources });
    for (let q = 0; q < state.length; q++) {
      expect(Number.isFinite(state[q])).toBe(true);
      expect(state[q]).toBeGreaterThanOrEqual(0);
    }
    for (let kk = 0; kk < grid.n; kk++) {
      if (!mask.land[kk]) continue;
      for (let c = 0; c < 4; c++) expect(state[kk * 4 + c]).toBe(0);
    }
    for (let j = 0; j < grid.ny; j++) {
      const cap = doSat(sstClimatology(grid.latOf(j)));
      for (let i = 0; i < grid.nx; i++) expect(state[grid.idx(i, j) * 4 + 3]).toBeLessThanOrEqual(cap + 1e-4);
    }
  }, 120000);
});

describe('BFECC limiter', () => {
  it('never overshoots a square pulse', () => {
    const { grid, mask } = syntheticWorld({ island: false });
    const { vel } = bakeCurrents(grid, mask, { cells: vortexCells, acc: null });
    const ctx = createOceanContext(grid, mask.land, vel);
    const state = new Float32Array(grid.n * 4);
    for (let j = 13; j <= 17; j++) for (let i = 34; i <= 38; i++) state[grid.idx(i, j) * 4 + 2] = 1;
    for (let s = 0; s < 200; s++) step(ctx, state, { reactions: false, diffusivity: 0 });
    let max = 0;
    for (let k = 0; k < grid.n; k++) max = Math.max(max, state[k * 4 + 2]);
    expect(max).toBeLessThanOrEqual(1 + 1e-6);
  });
});

describe('date line', () => {
  it('is seamless: a blob across the seam behaves like one mid-ocean', () => {
    const { grid, mask } = syntheticWorld({ island: false });
    const vel = uniformVelocity(grid, 300, 0);
    const run = (ci) => {
      const ctx = createOceanContext(grid, mask.land, vel);
      const state = blob(grid, mask.land, ci, 16, 4, 1);
      for (let s = 0; s < 100; s++) step(ctx, state);
      return state;
    };
    const seam = run(0);
    const mid = run(32);
    for (let j = 0; j < grid.ny; j++) {
      for (let i = 0; i < grid.nx; i++) {
        for (let c = 0; c < 4; c++) {
          const a = seam[grid.idx(i, j) * 4 + c];
          const b = mid[grid.idx(i + 32, j) * 4 + c];
          expect(Math.abs(a - b)).toBeLessThan(1e-5);
        }
      }
    }
  });
});

describe('mass', () => {
  // BFECC + limiter is not exactly conservative; the spec claims a bound.
  // If this fails, STOP and report the measured drift — do not loosen it.
  it('drifts < 2% over 1000 steps with decay off', () => {
    const { grid, mask } = syntheticWorld({ island: false });
    const { vel } = bakeCurrents(grid, mask, { cells: vortexCells, acc: null });
    const ctx = createOceanContext(grid, mask.land, vel);
    const state = blob(grid, mask.land, 28, 16, 5, 1);
    const m0 = mass(grid, mask.land, state, 2);
    for (let s = 0; s < 1000; s++) step(ctx, state, { reactions: false });
    const drift = Math.abs(mass(grid, mask.land, state, 2) - m0) / m0;
    expect(drift).toBeLessThan(0.02);
  });
});

describe('reaction and injection', () => {
  it('matches the exact kinetics cell by cell', () => {
    const { grid, mask } = syntheticWorld({ island: false });
    const ctx = createOceanContext(grid, mask.land, uniformVelocity(grid, 0, 0));
    const state = new Float32Array(grid.n * 4);
    const init = [2, 8, 5, 1];
    for (let k = 0; k < grid.n; k++) if (!mask.land[k]) for (let c = 0; c < 4; c++) state[k * 4 + c] = init[c];
    const steps = 40;
    for (let s = 0; s < steps; s++) step(ctx, state, { diffusivity: 0 });
    const t = steps * 0.25;
    for (const j of [5, 16, 26]) {
      const sst = sstClimatology(grid.latOf(j));
      const ref = sagStep(init[1], init[3], kd(sst), kaOcean(sst), t);
      const q = grid.idx(10, j) * 4;
      expect(state[q]).toBeCloseTo(init[0] * Math.exp(-t / TAU_T_DAYS), 4);
      expect(state[q + 1]).toBeCloseTo(ref.L, 4);
      expect(state[q + 2]).toBeCloseTo(init[2] * Math.exp(-t / TAU_N_DAYS), 4);
      expect(state[q + 3]).toBeCloseTo(Math.min(ref.D, doSat(sst)), 4);
    }
  });

  it('injects conc · f · dt per step', () => {
    const { grid, mask } = syntheticWorld({ island: false });
    const ctx = createOceanContext(grid, mask.land, uniformVelocity(grid, 0, 0));
    const state = new Float32Array(grid.n * 4);
    const k = grid.idx(10, 16);
    step(ctx, state, { reactions: false, diffusivity: 0, sources: [{ cells: [{ k, f: 0.01 }], conc: [1, 2, 3, 4] }] });
    for (let c = 0; c < 4; c++) expect(state[k * 4 + c]).toBeCloseTo((c + 1) * 0.01 * 0.25, 7);
  });
});

describe('frame-rate independence', () => {
  it('60 Hz and 360 Hz produce identical oceans', () => {
    const { grid, mask } = syntheticWorld();
    const { vel } = bakeCurrents(grid, mask, { cells: vortexCells, acc: null });
    const run = (hz) => {
      const ctx = createOceanContext(grid, mask.land, vel);
      const clock = createStepClock({ maxSteps: 8 });
      const state = blob(grid, mask.land, 30, 16, 6, 1);
      for (let f = 0; f < hz; f++) {
        const n = clock.advance(1000 / hz, 9);
        for (let s = 0; s < n; s++) step(ctx, state);
      }
      return state;
    };
    expect(Array.from(run(60))).toEqual(Array.from(run(360)));
  });
});

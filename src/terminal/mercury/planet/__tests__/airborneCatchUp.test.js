// src/terminal/mercury/planet/__tests__/airborneCatchUp.test.js — a hidden tab: the airborne Hg flies through the
// skipped time the heat already cooled over (fix/mercury-motion), so it never orbits a refrozen crust.
import { describe, it, expect } from 'vitest';
import { catchUpFamily, catchUpBeads, CATCHUP_MAX_S } from '../airborneCatchUp';
import { createMuSolver } from '../breakupBudget';
import { coreScale } from '../hyperFling';
import { createBeads, spawnFling, spawnBead, FLING_N, FLING_LIFE } from '../hgBeads';
import { MAX_OMEGA } from '../mercuryBody';
import { R_SCENE } from '../planetLook';
import { hyperEnv0, firedHyper } from './hyperTestKit';

const liveEnv = (f) => ({ ...hyperEnv0(), planetRadiusAt: () => R_SCENE * coreScale(f) });

describe('catchUpFamily', () => {
  it('a hyper swarm caught out over a long absence comes home: idle, core whole, no stale events, solve finished', () => {
    const f = firedHyper({ N: 32, seed: 5, target: 14 });
    const solver = createMuSolver(f, hyperEnv0(), 14);
    const kept = catchUpFamily(f, solver, liveEnv(f), 18);
    expect(kept).toBe(solver);
    expect(solver.done).toBe(true);
    expect(f.phase).toBe('idle');
    expect(coreScale(f)).toBe(1);
    expect(f.events).toHaveLength(0);
  });
  it('a short absence advances the flight by exactly that long', () => {
    const f = firedHyper({ N: 32, seed: 5, target: 14 });
    catchUpFamily(f, createMuSolver(f, hyperEnv0(), 14), liveEnv(f), 1.5);
    expect(f.t).toBeCloseTo(1.5, 1);
    expect(f.phase).toBe('fired');
  });
  it('past CATCHUP_MAX_S it does not replay: the family resets (volume home) and the solver is dropped', () => {
    const f = firedHyper({ N: 32, seed: 5, target: 14 });
    expect(catchUpFamily(f, createMuSolver(f, hyperEnv0(), 14), liveEnv(f), CATCHUP_MAX_S + 1)).toBeNull();
    expect(f.phase).toBe('idle');
    expect(coreScale(f)).toBe(1);
  });
  it('an idle family is left alone', () => {
    const f = firedHyper();
    f.phase = 'idle';
    const s = {};
    expect(catchUpFamily(f, s, liveEnv(f), 10)).toBe(s);
  });
});

describe('catchUpBeads', () => {
  const ctx = { phase: 'neutral', coreR: 0.75, calm: false, liquid: true, boil: 0, pxPerUnit: 300, q: [0, 0, 0, 1] };
  it('a hyper fling\'s glitter comes home (or dies at its cap) through the absence; nothing new is shed, no stale hits', () => {
    const b = createBeads(64);
    spawnFling(b, [0, MAX_OMEGA, 0], 0.75, FLING_N);
    catchUpBeads(b, FLING_LIFE + 1, ctx);
    expect(b.n).toBe(0);
    expect(b.nHits).toBe(0);
  });
  it('past CATCHUP_MAX_S the aether is simply cleared', () => {
    const b = createBeads(8);
    spawnBead(b, 0, 2, 0, 0, 0, 0, 0.01);
    catchUpBeads(b, CATCHUP_MAX_S + 1, ctx);
    expect(b.n).toBe(0);
  });
});

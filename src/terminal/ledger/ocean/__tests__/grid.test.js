import { describe, it, expect } from 'vitest';
import { makeGrid, OCEAN_GRID, DT_DAYS } from '../grid';
import { createStepClock } from '../clock';

describe('makeGrid', () => {
  it('512×256 cells are square and ~78 km', () => {
    expect(OCEAN_GRID.nx).toBe(512);
    expect(OCEAN_GRID.ny).toBe(256);
    expect(OCEAN_GRID.n).toBe(512 * 256);
    expect(OCEAN_GRID.cellKm).toBeCloseTo(78.18, 1);
    expect(OCEAN_GRID.dlon).toBe(OCEAN_GRID.dlat);
  });

  it('rejects non-square cells', () => {
    expect(() => makeGrid(64, 40)).toThrow();
  });

  it('wraps columns east–west and clamps rows', () => {
    const g = makeGrid(64, 32);
    expect(g.wrapI(-1)).toBe(63);
    expect(g.wrapI(64)).toBe(0);
    expect(g.idx(-1, 0)).toBe(63);
    expect(g.lonLatToCell(179.99, 0).i).toBe(63);
    expect(g.lonLatToCell(-180, 0).i).toBe(0);
    expect(g.lonLatToCell(180, 0).i).toBe(0);
    expect(g.lonLatToCell(0, 95).j).toBe(31);
    expect(g.lonLatToCell(0, -95).j).toBe(0);
  });

  it('row 0 is the southernmost row; cosLat matches latOf', () => {
    const g = makeGrid(64, 32);
    expect(g.latOf(0)).toBeCloseTo(-87.1875, 9);
    expect(g.latOf(31)).toBeCloseTo(87.1875, 9);
    expect(g.lonOf(0)).toBeCloseTo(-177.1875, 9);
    expect(g.cosLat[16]).toBeCloseTo(Math.cos((g.latOf(16) * Math.PI) / 180), 12);
  });
});

describe('createStepClock', () => {
  const run = (hz, seconds, daysPerSecond) => {
    const clock = createStepClock({ maxSteps: 8 });
    let total = 0;
    const frames = Math.round(hz * seconds);
    for (let f = 0; f < frames; f++) total += clock.advance(1000 / hz, daysPerSecond);
    return total;
  };

  it('covers the same simulated time at 60 Hz, 144 Hz and 360 Hz', () => {
    expect(DT_DAYS).toBe(0.25);
    expect(run(60, 1, 9)).toBe(36);
    expect(run(360, 1, 9)).toBe(36);
    expect(run(144, 2.5, 3)).toBe(30);
  });

  it('caps one frame at maxSteps and drops the backlog instead of replaying it', () => {
    const clock = createStepClock({ maxSteps: 8 });
    expect(clock.advance(1000, 30)).toBe(8);
    expect(clock.advance(1, 30)).toBe(0);
    clock.setMaxSteps(4);
    expect(clock.advance(1000, 30)).toBe(4);
  });

  it('ignores non-positive and non-finite input', () => {
    const clock = createStepClock();
    expect(clock.advance(0, 9)).toBe(0);
    expect(clock.advance(-5, 9)).toBe(0);
    expect(clock.advance(NaN, 9)).toBe(0);
    expect(clock.advance(16, 0)).toBe(0);
    expect(clock.advance(16, Infinity)).toBe(0);
  });

  it('ignores an invalid step cap', () => {
    const clock = createStepClock({ maxSteps: 8 });
    clock.setMaxSteps(NaN);
    clock.setMaxSteps(-3);
    clock.setMaxSteps(2.5);
    expect(clock.advance(1000, 30)).toBe(8);
  });

  it('reset() drops the fractional remainder; custom dtDays is honoured', () => {
    const clock = createStepClock({ dtDays: 1 });
    expect(clock.advance(500, 1.5)).toBe(0);   // 0.75 d accumulated
    clock.reset();
    expect(clock.advance(250, 1.5)).toBe(0);   // 0.375 d, not 1.125
    expect(createStepClock({ dtDays: 1 }).advance(1000, 3)).toBe(3);
  });
});

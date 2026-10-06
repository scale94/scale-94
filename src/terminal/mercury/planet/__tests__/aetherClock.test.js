// The shared aether clock (mirror-sky spec §1): one integrated time base for the gas and the mirror.
import { describe, it, expect } from 'vitest';
import {
  CLOCK_PHASES, createAetherClock, configureAetherClock, tickAetherClock, skyWeights,
  FLUID_LANE_MEAN, AIR_ORBIT_MEAN, AIR_LOWER_DIR, FIRE_LIFE_MEAN, FIRE_RISE_MEAN, EARTH_MASS_MEAN,
  EARTH_SINK_RATE_K, EARTH_FALL, AETHER_SKY_R, FLUID_SKY_RAD, AIR_SKY_RAD, FIRE_SKY_RISE, EARTH_SKY_SINK,
} from '../aetherClock';

describe('aetherClock', () => {
  it('integrates t and each phase from its own rate', () => {
    const c = configureAetherClock(createAetherClock(), { speed: 0.1, orbitalSpeed: 1.2, calm: false });
    for (let i = 1; i <= 60; i++) tickAetherClock(c, i / 60, 1 / 60);
    expect(c.t).toBeCloseTo(1, 10);
    expect(c.phase.fluid).toBeCloseTo(0.1, 10);
    expect(c.phase.thermal).toBeCloseTo(0.1, 10);
    expect(c.phase.earth).toBeCloseTo(0.1, 10);
    expect(c.phase.air).toBeCloseTo(1.2, 10);
    expect(c.rate.air).toBe(1.2);
  });

  it('a slider change moves the rate, never the phase (no rate(x_now)·t jump)', () => {
    const c = configureAetherClock(createAetherClock(), { speed: 0.1, orbitalSpeed: 1.2, calm: false });
    for (let i = 1; i <= 60; i++) tickAetherClock(c, i / 60, 1 / 60);
    const before = c.phase.fluid;
    configureAetherClock(c, { speed: 0.5, orbitalSpeed: 1.2, calm: false });
    expect(c.phase.fluid).toBe(before);
    tickAetherClock(c, 61 / 60, 1 / 60);
    expect(c.phase.fluid - before).toBeCloseTo(0.5 / 60, 12);
  });

  it('calm freezes t and every phase, and reports zero applied rates', () => {
    const c = configureAetherClock(createAetherClock(), { speed: 0.1, orbitalSpeed: 1.2, calm: false });
    tickAetherClock(c, 1, 0.5);
    const snap = { t: c.t, ...c.phase };
    configureAetherClock(c, { speed: 0.1, orbitalSpeed: 1.2, calm: true });
    for (let i = 2; i < 30; i++) tickAetherClock(c, i, 0.5);
    expect({ t: c.t, ...c.phase }).toEqual(snap);
    for (const p of CLOCK_PHASES) expect(c.rate[p]).toBe(0);
  });

  it('ticks once per frame stamp: every consumer may call it, the first one advances', () => {
    const c = configureAetherClock(createAetherClock(), { speed: 0.1, orbitalSpeed: 1.2, calm: false });
    for (let k = 0; k < 5; k++) tickAetherClock(c, 7.25, 1 / 60);
    expect(c.t).toBeCloseTo(1 / 60, 12);
  });

  it('allocates nothing per tick (same objects)', () => {
    const c = configureAetherClock(createAetherClock(), { speed: 0.1, orbitalSpeed: 1.2, calm: false });
    const { phase, rate, rateIn } = c;
    tickAetherClock(c, 1, 0.1); configureAetherClock(c, { speed: 0.2, orbitalSpeed: 1, calm: false }); tickAetherClock(c, 2, 0.1);
    expect(c.phase).toBe(phase); expect(c.rate).toBe(rate); expect(c.rateIn).toBe(rateIn);
  });

  it('rate means come from the flows\' attribute formulas (all U[0,1) attributes)', () => {
    expect(FLUID_LANE_MEAN).toBeCloseTo(0.6 + 0.4 * 0.5, 12);
    expect(AIR_ORBIT_MEAN).toBeCloseTo(0.4 + 0.7 * 0.5, 12);
    expect(AIR_LOWER_DIR).toBe(-0.85);
    expect(FIRE_LIFE_MEAN).toBeCloseTo(0.4 + 0.6 * 0.5, 12);
    expect(FIRE_RISE_MEAN).toBeCloseTo((2.4 + 3.5) / 2, 12);
    expect(EARTH_MASS_MEAN).toBeCloseTo(0.2 * 0.15 + 0.8 * 0.7, 12);
    expect(EARTH_SINK_RATE_K).toBeCloseTo(2.2 * 0.4, 12);
    expect(EARTH_FALL).toBe(2.4);
    expect(AETHER_SKY_R).toBe(1.4);
    expect(FLUID_SKY_RAD).toBeCloseTo(2 * 2 * Math.PI * FLUID_LANE_MEAN, 12);
    expect(AIR_SKY_RAD).toBe(AIR_ORBIT_MEAN);
    expect(FIRE_SKY_RISE).toBeCloseTo(FIRE_LIFE_MEAN * FIRE_RISE_MEAN / AETHER_SKY_R, 12);
    expect(EARTH_SKY_SINK).toBeCloseTo(EARTH_FALL * EARTH_SINK_RATE_K * EARTH_MASS_MEAN / AETHER_SKY_R, 12);
  });
});

describe('skyWeights — the mirror shows each element by its fade', () => {
  it('weights equal the fades in CLOCK_PHASES order', () => {
    expect(skyWeights({ fluid: 0, thermal: 0, earth: 1, air: 0 })).toEqual([0, 0, 1, 0]);
    expect(skyWeights({ fluid: 0.3, thermal: 0, earth: 0, air: 0 })).toEqual([0.3, 0, 0, 0]);
  });
  it('neutral (all fades 0) is the quiet dark sky: all weights 0', () => {
    expect(skyWeights({ fluid: 0, thermal: 0, earth: 0, air: 0 })).toEqual([0, 0, 0, 0]);
    expect(skyWeights(null)).toEqual([0, 0, 0, 0]);
  });
  it('normalises when the fades sum above 1', () => {
    const w = skyWeights({ fluid: 1, thermal: 1, earth: 0, air: 0 });
    expect(w).toEqual([0.5, 0.5, 0, 0]);
  });
  it('writes into the out array it is given', () => {
    const out = [9, 9, 9, 9];
    expect(skyWeights({ fluid: 0, thermal: 0, earth: 0, air: 1 }, out)).toBe(out);
    expect(out).toEqual([0, 0, 0, 1]);
  });
});

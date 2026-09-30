import { describe, it, expect } from 'vitest';
import { riverState, doSat } from '../kinetics';
import { haversineKm, buildSource, presetSourceSpec } from '../sources';
import { OCEAN_GRID } from '../grid';
import { buildLandMask } from '../landMask';
import { ALL_AUDIT_PRESETS } from '../../auditPresets';
import { RIVER_PALETTE } from '../gpu/palette';
import {
  PARTICLES_PER_RIVER, FLOATS_PER_PARTICLE, MIN_CYCLE_S, cumulativeKm, coursePoint, courseTick,
  prepareRiver, advanceParcelPhase, parcelTime, particleColor, fillParticles, writeFlare,
} from '../riverStage';

const L_COURSE = [[0, 0], [10, 0], [10, 10]];

describe('course geometry', () => {
  const cum = cumulativeKm(L_COURSE);

  it('accumulates great-circle km per vertex', () => {
    expect(cum[0]).toBe(0);
    expect(cum[1]).toBeCloseTo(haversineKm([0, 0], [10, 0]), 9);
    expect(cum[2]).toBeCloseTo(cum[1] + haversineKm([10, 0], [10, 10]), 9);
  });

  it('walks the course by arc length, clamped to its ends', () => {
    expect(coursePoint(L_COURSE, cum, 0)).toEqual([0, 0]);
    expect(coursePoint(L_COURSE, cum, cum[1] / 2)).toEqual([5, 0]);
    const mid2 = coursePoint(L_COURSE, cum, (cum[1] + cum[2]) / 2);
    expect(mid2[0]).toBeCloseTo(10, 9);
    expect(mid2[1]).toBeCloseTo(5, 9);
    expect(coursePoint(L_COURSE, cum, cum[2] + 50)).toEqual([10, 10]);
    expect(coursePoint(L_COURSE, cum, -5)).toEqual([0, 0]);
  });

  it('gives the tick a screen angle perpendicular-ready: 0° heading east, −90° heading north', () => {
    const east = courseTick(L_COURSE, cum, cum[1] / 2);
    expect(east.lon).toBeCloseTo(5, 9);
    expect(east.angleDeg).toBeCloseTo(0, 9);
    const north = courseTick(L_COURSE, cum, (cum[1] + cum[2]) / 2);
    expect(north.angleDeg).toBeCloseTo(-90, 9);
    expect(courseTick([[3, 3]], cumulativeKm([[3, 3]]), 0)).toBeNull();
    expect(courseTick(L_COURSE, cum, NaN)).toBeNull();
  });
});

describe('parcels', () => {
  it('spaces parcels evenly in travel time and wraps them at the mouth', () => {
    const T = 10;
    const ts = Array.from({ length: PARTICLES_PER_RIVER }, (_, p) => parcelTime(p, 0.33, T));
    for (const t of ts) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(T);
    }
    const sorted = [...ts].sort((a, b) => a - b);
    for (let p = 1; p < sorted.length; p++) expect(sorted[p] - sorted[p - 1]).toBeCloseTo(T / PARTICLES_PER_RIVER, 9);
    expect(parcelTime(7, 1.33, T)).toBeCloseTo(parcelTime(7, 0.33, T), 9);
    expect(parcelTime(0, 0, T)).toBeCloseTo((0.5 / PARTICLES_PER_RIVER) * T, 12);
  });

  it('moves literally when a course takes ≥ MIN_CYCLE_S of wall time, else one course per MIN_CYCLE_S', () => {
    expect(MIN_CYCLE_S).toBe(6);
    // Danube-like: 23 d at 1 d/s = 23 s per course ≥ 6 s → literal: 2.3 d is a tenth of the course.
    expect(advanceParcelPhase(0, 2.3, 23, 1)).toBeCloseTo(0.1, 12);
    // Mississippi-like: 1.6 d at 9 d/s = 0.18 s per course → slowed: 1 wall second (9 d) is 1/6 course.
    expect(advanceParcelPhase(0, 9, 1.6, 9)).toBeCloseTo(1 / 6, 12);
    expect(advanceParcelPhase(0.9, 9, 1.6, 9)).toBeCloseTo((0.9 + 1 / 6) % 1, 12);
    expect(advanceParcelPhase(0.3, 0, 1.6, 9)).toBe(0.3);
  });

  it('interpolates between sim steps: at alpha 0.5 a parcel lies between its two step positions', () => {
    const river = prepareRiver({ ...src, travelDays: 10 });
    const lonAt = (days) => {
      const out = new Float32Array(PARTICLES_PER_RIVER * FLOATS_PER_PARTICLE);
      fillParticles([river], [advanceParcelPhase(0, days, 10, 1)], out);
      return out[0] * 180;
    };
    const a = lonAt(1);          // step k
    const b = lonAt(1.25);       // step k + 1 (Δt = 0.25 d)
    const mid = lonAt(1.125);    // alpha 0.5
    expect(b).toBeGreaterThan(a);
    expect(mid).toBeGreaterThan(a);
    expect(mid).toBeLessThan(b);
    expect(mid).toBeCloseTo((a + b) / 2, 4);   // straight course, constant speed
  });

  it('colours a parcel by the §1 palette, deficit as absence of light', () => {
    const sat = doSat(20);
    const zero = particleColor({ dT: 0, L: 0, N: 0, D: 0 }, sat, 1);
    expect(Array.from(zero.slice(0, 3))).toEqual([0, 0, 0]);
    expect(zero[3]).toBeCloseTo(RIVER_PALETTE.minAlpha, 6);
    const heat = particleColor({ dT: 1000, L: 0, N: 0, D: 0 }, sat, 1);
    RIVER_PALETTE.crimson.forEach((c, i) => expect(heat[i]).toBeCloseTo(c, 5));
    expect(heat[3]).toBeCloseTo(1, 5);
    const nitrate = particleColor({ dT: 0, L: 0, N: 1e4, D: 0 }, sat, 0.5);
    RIVER_PALETTE.green.forEach((c, i) => expect(nitrate[i]).toBeCloseTo(c, 5));
    expect(nitrate[3]).toBeCloseTo(0.5, 5);
    const bod = particleColor({ dT: 0, L: 1e4, N: 0, D: 0 }, sat, 1);
    RIVER_PALETTE.amber.forEach((c, i) => expect(bod[i]).toBeCloseTo(c, 5));
    const bad = particleColor({ dT: NaN, L: -3, N: NaN, D: NaN }, sat, 1);
    expect(Array.from(bad).every(Number.isFinite)).toBe(true);
  });

  it('heat glows through the hypoxic void, as the ocean shader does (shaders.js:255)', () => {
    // I.x*CRIMSON + (I.y*AMBER + I.z*GREEN)*exp(-I.w): the deficit dims BOD and nitrate, never heat.
    const sat = doSat(20);
    const lit = 1 - RIVER_PALETTE.deficitDim;
    const anoxic = particleColor({ dT: 1000, L: 0, N: 0, D: sat }, sat, 1);
    RIVER_PALETTE.crimson.forEach((c, i) => expect(anoxic[i]).toBeCloseTo(c, 5));
    const bod = particleColor({ dT: 0, L: 1e4, N: 0, D: sat }, sat, 1);
    RIVER_PALETTE.amber.forEach((c, i) => expect(bod[i]).toBeCloseTo(c * lit, 5));
    const nitrate = particleColor({ dT: 0, L: 0, N: 1e4, D: sat }, sat, 1);
    RIVER_PALETTE.green.forEach((c, i) => expect(nitrate[i]).toBeCloseTo(c * lit, 5));
    // Hot and BOD-loaded, then anoxic: crimson + amber·0.2 = (1.2, 0.214, 0.2) → ÷ 1.2.
    const hotAnoxic = particleColor({ dT: 1000, L: 1e4, N: 0, D: sat }, sat, 1);
    const { crimson: C, amber: A } = RIVER_PALETTE;
    const raw = [0, 1, 2].map((i) => C[i] + A[i] * lit);
    const max = Math.max(...raw);
    raw.forEach((v, i) => expect(hotAnoxic[i]).toBeCloseTo(v / max, 5));
    expect(hotAnoxic[0]).toBeCloseTo(1, 6);
  });

  it('mixes channels hue-preserving: divided by the brightest component, never clipped per component', () => {
    const sat = doSat(20);
    // All three saturated, no deficit: crimson + amber + green = (2.22, 1.71, 0.28) → ÷ 2.22.
    const all = particleColor({ dT: 1000, L: 1e4, N: 1e4, D: 0 }, sat, 1);
    const { crimson: C, amber: A, green: G } = RIVER_PALETTE;
    const sum = [0, 1, 2].map((i) => C[i] + A[i] + G[i]);
    const max = Math.max(...sum);
    sum.forEach((v, i) => expect(all[i]).toBeCloseTo(v / max, 5));
    expect(all[1]).toBeLessThan(0.8);                 // clipping would give (1, 1, 0.28): yellow
    // Citarum at its site (fraction 0), through the real preset path: hot, BOD-loaded,
    // nitrate-rich, part-depleted. Orange-crimson ≈ (1, .55, .15), r = 1 > g > b, never r = g.
    const p = ALL_AUDIT_PRESETS.find((x) => x.key === 'citarum');
    const river = prepareRiver(buildSource(presetSourceSpec(p), OCEAN_GRID, buildLandMask(OCEAN_GRID)));
    const site = particleColor(riverState(river.kernel, 0, river.hyd), river.sat, 1);
    expect(site[0]).toBeCloseTo(1, 6);
    expect(site[1]).toBeCloseTo(0.55, 1);
    expect(site[2]).toBeCloseTo(0.15, 1);
    expect(site[0] - site[1]).toBeGreaterThan(0.3);
    expect(site[1]).toBeGreaterThan(site[2]);
  });

  const src = {
    id: 'r', course: [[0, 0], [10, 0]], courseKm: haversineKm([0, 0], [10, 0]), travelDays: 10,
    kernel: { temp: 20, do: 6, bod: 20, dt: 4, nitrate: 10 }, velocityMs: 1, depthM: 4,
  };

  it('fills 256 parcels per river from the exact kinetics at each travel time', () => {
    const river = prepareRiver(src);
    const out = new Float32Array(PARTICLES_PER_RIVER * FLOATS_PER_PARTICLE);
    expect(fillParticles([river], [0.33], out)).toBe(PARTICLES_PER_RIVER);
    for (const p of [0, 100, 255]) {
      const t = parcelTime(p, 0.33, 10);
      const [lon, lat] = coursePoint(src.course, river.cum, (t / 10) * src.courseKm);
      const c = particleColor(riverState(src.kernel, t, { velocityMs: 1, depthM: 4 }), doSat(20), 1);
      const o = p * FLOATS_PER_PARTICLE;
      expect(out[o]).toBeCloseTo(lon / 180, 6);
      expect(out[o + 1]).toBeCloseTo(lat / 90, 6);
      for (let i = 0; i < 4; i++) expect(out[o + 2 + i]).toBeCloseTo(c[i], 6);
    }
  });

  it('has no river stage for a zero-length course or one that crosses the date line', () => {
    expect(prepareRiver({ ...src, travelDays: 0 })).toBeNull();
    expect(prepareRiver({ ...src, courseKm: 0 })).toBeNull();
    expect(prepareRiver({ ...src, course: [[179.5, 0], [-179.5, 0]] })).toBeNull();
    expect(prepareRiver(src, { alpha: 0.5 }).alpha).toBe(0.5);
  });

  it('writes one white flare vertex at a fraction of the course', () => {
    const river = prepareRiver(src);
    const out = new Float32Array(3 * FLOATS_PER_PARTICLE);
    writeFlare(river, 0.5, out, 2);
    const o = 2 * FLOATS_PER_PARTICLE;
    expect(out[o]).toBeCloseTo(5 / 180, 6);
    expect(out[o + 1]).toBeCloseTo(0, 6);
    expect(Array.from(out.slice(o + 2, o + 6))).toEqual([1, 1, 1, 1]);
    writeFlare(river, 7, out, 0);
    expect(out[0]).toBeCloseTo(10 / 180, 6);    // clamped to the mouth
  });
});

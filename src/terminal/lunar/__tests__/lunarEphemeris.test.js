import { describe, it, expect } from 'vitest';
import { SYNODIC_PERIOD } from '../synodic';
import {
  ANOMALISTIC_MONTH, DRACONIC_MONTH, DAY_MS,
  meanAnomaly, argOfLatitude, meanElongation,
  libration, distanceKm, apparentRadiusScale, apparentDiameterArcmin,
  timestampForScrub,
} from '../lunarEphemeris';

const T0 = Date.UTC(2026, 6, 22, 12, 0, 0);
const TAU = Math.PI * 2;

// Measure the period of an angle function by counting wraps over a long sweep.
function measuredPeriod(fn, days = 4000, stepDays = 0.01) {
  let prev = fn(T0);
  let wraps = 0;
  for (let d = stepDays; d <= days; d += stepDays) {
    const v = fn(T0 + d * DAY_MS);
    if (v < prev) wraps++;
    prev = v;
  }
  return days / wraps;
}

describe('lunarEphemeris — periods', () => {
  it('exposes the three month lengths', () => {
    expect(ANOMALISTIC_MONTH).toBeCloseTo(27.55454988, 8);
    expect(DRACONIC_MONTH).toBeCloseTo(27.21222082, 8);
  });

  it('mean anomaly runs on the anomalistic month', () => {
    expect(measuredPeriod(meanAnomaly)).toBeCloseTo(ANOMALISTIC_MONTH, 1);
  });

  it('argument of latitude runs on the draconic month', () => {
    expect(measuredPeriod(argOfLatitude)).toBeCloseTo(DRACONIC_MONTH, 1);
  });

  it('mean elongation runs on the synodic month', () => {
    expect(measuredPeriod(meanElongation)).toBeCloseTo(SYNODIC_PERIOD, 1);
  });

  it('keeps all three angles normalised to [0, 2pi)', () => {
    for (let d = 0; d < 500; d += 3.3) {
      const t = T0 + d * DAY_MS;
      for (const v of [meanAnomaly(t), argOfLatitude(t), meanElongation(t)]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(TAU);
      }
    }
  });
});

describe('lunarEphemeris — libration', () => {
  it('stays inside the optical libration envelope', () => {
    let maxLon = 0, maxLat = 0;
    for (let d = 0; d < 2000; d += 0.05) {
      const { lon, lat } = libration(T0 + d * DAY_MS);
      maxLon = Math.max(maxLon, Math.abs(lon));
      maxLat = Math.max(maxLat, Math.abs(lat));
    }
    const degLon = (maxLon * 180) / Math.PI;
    const degLat = (maxLat * 180) / Math.PI;
    expect(degLon).toBeGreaterThan(7.0);
    expect(degLon).toBeLessThan(8.2);
    expect(degLat).toBeGreaterThan(6.4);
    expect(degLat).toBeLessThan(7.0);
  });

  it('returns radians, not degrees', () => {
    // 8 degrees is 0.14 rad; a degrees bug would blow past 1.0 immediately.
    for (let d = 0; d < 60; d += 0.7) {
      const { lon, lat } = libration(T0 + d * DAY_MS);
      expect(Math.abs(lon)).toBeLessThan(0.2);
      expect(Math.abs(lat)).toBeLessThan(0.2);
    }
  });
});

describe('lunarEphemeris — apparent size', () => {
  it('sweeps the real perigee-apogee angular range', () => {
    let min = Infinity, max = -Infinity;
    for (let d = 0; d < 2000; d += 0.05) {
      const a = apparentDiameterArcmin(T0 + d * DAY_MS);
      min = Math.min(min, a);
      max = Math.max(max, a);
    }
    expect(min).toBeGreaterThan(28.8);
    expect(min).toBeLessThan(29.8);
    expect(max).toBeGreaterThan(32.9);
    expect(max).toBeLessThan(33.8);
    expect(max / min).toBeGreaterThan(1.10);   // the swell is at least 10%
  });

  it('keeps distance inside plausible lunar bounds', () => {
    for (let d = 0; d < 800; d += 0.3) {
      const km = distanceKm(T0 + d * DAY_MS);
      expect(km).toBeGreaterThan(355000);
      expect(km).toBeLessThan(410000);
    }
  });

  it('apparentRadiusScale is 1.0 at the mean distance', () => {
    // Find a moment where distance crosses the mean, scale must be ~1 there.
    for (let d = 0; d < 60; d += 0.01) {
      const t = T0 + d * DAY_MS;
      if (Math.abs(distanceKm(t) - 385000.56) < 200) {
        expect(apparentRadiusScale(t)).toBeCloseTo(1.0, 2);
        return;
      }
    }
    throw new Error('never crossed the mean distance');
  });
});

describe('lunarEphemeris — scrub as clock', () => {
  const NOW = T0;

  it('returns now when the scrub sits on the live age', () => {
    expect(timestampForScrub(10.0, 10.0, NOW)).toBe(NOW);
  });

  it('always maps forward, never backward', () => {
    for (let live = 0; live < SYNODIC_PERIOD; live += 1.1) {
      for (let scrub = 0; scrub < SYNODIC_PERIOD; scrub += 1.7) {
        expect(timestampForScrub(scrub, live, NOW)).toBeGreaterThanOrEqual(NOW);
      }
    }
  });

  it('never projects more than one synodic month ahead', () => {
    for (let scrub = 0; scrub < SYNODIC_PERIOD; scrub += 0.13) {
      const dt = (timestampForScrub(scrub, 3.0, NOW) - NOW) / DAY_MS;
      expect(dt).toBeLessThan(SYNODIC_PERIOD + 1e-9);
    }
  });

  it('is monotonic in scrub age within a cycle, with exactly one wrap', () => {
    const live = 7.5;
    let wraps = 0;
    let prev = timestampForScrub(0, live, NOW);
    for (let scrub = 0.05; scrub < SYNODIC_PERIOD; scrub += 0.05) {
      const t = timestampForScrub(scrub, live, NOW);
      if (t < prev) wraps++;
      prev = t;
    }
    expect(wraps).toBe(1);
  });

  it('the three periods do not realign inside five years', () => {
    // If they aliased, the moon would visibly repeat. Check no instant in a
    // 5-year sweep reproduces the t=0 state of all three angles at once.
    const ref = [meanAnomaly(T0), argOfLatitude(T0), meanElongation(T0)];
    let collisions = 0;
    for (let d = 1; d < 365 * 5; d += 0.05) {
      const t = T0 + d * DAY_MS;
      const now3 = [meanAnomaly(t), argOfLatitude(t), meanElongation(t)];
      if (now3.every((v, i) => Math.abs(v - ref[i]) < 0.01)) collisions++;
    }
    expect(collisions).toBe(0);
  });
});

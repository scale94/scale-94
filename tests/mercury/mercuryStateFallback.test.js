import { describe, it, expect } from 'vitest';
import { getMercuryStateFallback, keplerSolve } from '../../src/terminal/mercury/mercuryStateFallback';

describe('keplerSolve', () => {
  it('returns M when e=0 (circular orbit)', () => {
    expect(keplerSolve(1.5, 0)).toBeCloseTo(1.5, 6);
  });
  it('solves Mercury-like eccentricity in <8 iterations', () => {
    const E = keplerSolve(0.5, 0.2056);
    expect(E - 0.2056 * Math.sin(E)).toBeCloseTo(0.5, 6);
  });
  it('handles M near pi', () => {
    const E = keplerSolve(Math.PI - 0.01, 0.2056);
    expect(E - 0.2056 * Math.sin(E)).toBeCloseTo(Math.PI - 0.01, 6);
  });
});

describe('getMercuryStateFallback', () => {
  it('returns expected shape', () => {
    const s = getMercuryStateFallback(new Date('2026-05-20T12:00:00Z'));
    expect(s).toHaveProperty('heliocentricDistanceAU');
    expect(s).toHaveProperty('trueAnomalyDeg');
    expect(s).toHaveProperty('solarFluxWm2');
    expect(s).toHaveProperty('subsolarLongitudeDeg');
    expect(s).toHaveProperty('subsolarTempK');
    expect(s).toHaveProperty('nightsideTempK');
    expect(s).toHaveProperty('earthMercuryDistanceAU');
    expect(s).toHaveProperty('daysToNextPerihelion');
    expect(s).toHaveProperty('phaseIllumination');
  });

  it('heliocentric distance stays within Mercury orbit bounds', () => {
    for (let d = 0; d < 88; d += 7) {
      const date = new Date(Date.UTC(2026, 0, 1 + d));
      const s = getMercuryStateFallback(date);
      expect(s.heliocentricDistanceAU).toBeGreaterThan(0.30);
      expect(s.heliocentricDistanceAU).toBeLessThan(0.48);
    }
  });

  it('subsolar temperature stays within physical bounds', () => {
    for (let d = 0; d < 88; d += 7) {
      const date = new Date(Date.UTC(2026, 0, 1 + d));
      const s = getMercuryStateFallback(date);
      expect(s.subsolarTempK).toBeGreaterThan(540);
      expect(s.subsolarTempK).toBeLessThan(740);
    }
  });

  it('nightside temperature is the regolith floor', () => {
    const s = getMercuryStateFallback(new Date('2026-05-20T12:00:00Z'));
    expect(s.nightsideTempK).toBe(100);
  });

  it('solar flux is inverse-square of distance', () => {
    const s = getMercuryStateFallback(new Date('2026-05-20T12:00:00Z'));
    const expected = 1361 / (s.heliocentricDistanceAU ** 2);
    expect(s.solarFluxWm2).toBeCloseTo(expected, 2);
  });

  it('days to next perihelion is within one Mercury orbital period', () => {
    const s = getMercuryStateFallback(new Date('2026-05-20T12:00:00Z'));
    expect(s.daysToNextPerihelion).toBeGreaterThanOrEqual(0);
    expect(s.daysToNextPerihelion).toBeLessThan(88);
  });

  it('earth-mercury distance stays within bounds (0.5 - 1.5 AU)', () => {
    for (let d = 0; d < 365; d += 30) {
      const date = new Date(Date.UTC(2026, 0, 1 + d));
      const s = getMercuryStateFallback(date);
      expect(s.earthMercuryDistanceAU).toBeGreaterThan(0.5);
      expect(s.earthMercuryDistanceAU).toBeLessThan(1.5);
    }
  });

  it('subsolar longitude wraps in [0, 360)', () => {
    const s = getMercuryStateFallback(new Date('2026-05-20T12:00:00Z'));
    expect(s.subsolarLongitudeDeg).toBeGreaterThanOrEqual(0);
    expect(s.subsolarLongitudeDeg).toBeLessThan(360);
  });
});

import { describe, it, expect } from 'vitest';
import { planetEphemerisUniforms } from '../MercuryPlanet';
import { mercuryEphemeris } from '../planet/mercuryEphemeris';
import { bodyYawFor, sunDirForCamera } from '../planet/planetFrame';

describe('planetEphemerisUniforms', () => {
  const t = Date.UTC(2026, 9, 1);
  it('feeds yaw from the live subsolar longitude', () => {
    expect(planetEphemerisUniforms(t).yaw).toBeCloseTo(bodyYawFor(mercuryEphemeris(t).subsolarLonDeg), 12);
  });
  it('a camera-following sunDir drives yaw; subsolarLonDeg is the ephemeris value', () => {
    const sun = sunDirForCamera([2, 0.5, 1]);
    const u = planetEphemerisUniforms(t, sun);
    const eph = mercuryEphemeris(t);
    expect(u.yaw).toBe(bodyYawFor(eph.subsolarLonDeg, sun));
    expect(u.subsolarLonDeg).toBe(eph.subsolarLonDeg);
  });
  it('irradiance is (MEAN_R/r)^2 and stays inside the orbital range 0.69–1.59', () => {
    const u = planetEphemerisUniforms(t);
    expect(u.irr).toBeCloseTo((0.387098 / mercuryEphemeris(t).r) ** 2, 12);
    expect(u.irr).toBeGreaterThan(0.68);
    expect(u.irr).toBeLessThan(1.6);
  });
  it('sinR is the sine of the Sun angular radius', () => {
    expect(planetEphemerisUniforms(t).sinR).toBeCloseTo(Math.sin(mercuryEphemeris(t).sunAngularRadiusRad), 12);
  });
});

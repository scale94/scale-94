import { describe, it, expect } from 'vitest';
import { planetEphemerisUniforms } from '../MercuryPlanet';
import { mercuryEphemeris } from '../planet/mercuryEphemeris';
import { bodyYawFor } from '../planet/planetFrame';
import { subsolarTempK } from '../planet/mercuryThermal';

describe('planetEphemerisUniforms', () => {
  const t = Date.UTC(2026, 9, 1);
  it('feeds yaw from the live subsolar longitude (Sun fixed in the world)', () => {
    const eph = mercuryEphemeris(t);
    const u = planetEphemerisUniforms(t);
    expect(u.yaw).toBeCloseTo(bodyYawFor(eph.subsolarLonDeg), 12);
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
  it('subsolarT comes from the thermal model at the live distance', () => {
    expect(planetEphemerisUniforms(t).subsolarT).toBe(subsolarTempK(mercuryEphemeris(t).r));
  });
});

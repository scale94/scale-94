import { describe, it, expect } from 'vitest';
import {
  PHASE_ANGLE_DEG, SUN_DIR_WORLD, dirFromLonLat, lonLatFromDir, rotY, bodyYawFor, uvFromLonLat,
} from '../planetFrame';

const close3 = (a, b, eps = 1e-9) => a.forEach((x, i) => expect(Math.abs(x - b[i])).toBeLessThan(eps));
const deg = (r) => (r * 180) / Math.PI;

describe('planetFrame', () => {
  it('SUN_DIR_WORLD is a unit vector in the equatorial plane at the fixed phase angle to the camera (+Z)', () => {
    const [x, y, z] = SUN_DIR_WORLD;
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 12);
    expect(y).toBe(0);
    expect(deg(Math.acos(z))).toBeCloseTo(PHASE_ANGLE_DEG, 9);
    expect(x).toBeLessThan(0); // Sun on the viewer's left
  });

  it('dirFromLonLat and lonLatFromDir are inverses (east-positive, 0..360)', () => {
    for (const [lon, lat] of [[0, 0], [90, 0], [200, 30], [359, -60]]) {
      const back = lonLatFromDir(dirFromLonLat(lon, lat));
      expect(back.lonDeg).toBeCloseTo(lon, 9);
      expect(back.latDeg).toBeCloseTo(lat, 9);
    }
  });

  it('east longitude increases counter-clockwise seen from north (+Y): 90°E is −Z', () => {
    close3(dirFromLonLat(90, 0), [0, 0, -1], 1e-12);
  });

  it('bodyYawFor rotates the subsolar point onto the Sun direction', () => {
    for (const lon of [0, 94.456145, 257.860623, 359.9]) {
      const yaw = bodyYawFor(lon);
      close3(rotY(dirFromLonLat(lon, 0), yaw), SUN_DIR_WORLD, 1e-9);
      expect(lonLatFromDir(rotY(SUN_DIR_WORLD, -yaw)).lonDeg).toBeCloseTo(lon, 6);
    }
  });

  it('uvFromLonLat: lon 0 → u 0, 90°E → u 0.25; north pole → v 1, south pole → v 0', () => {
    expect(uvFromLonLat(0, 0)).toEqual([0, 0.5]);
    expect(uvFromLonLat(90, 0)[0]).toBeCloseTo(0.25, 12);
    expect(uvFromLonLat(0, 90)[1]).toBe(1);
    expect(uvFromLonLat(0, -90)[1]).toBe(0);
  });
});

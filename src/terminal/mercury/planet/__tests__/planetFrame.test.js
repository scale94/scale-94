import { describe, it, expect } from 'vitest';
import {
  PHASE_ANGLE_DEG, SUN_DIR_WORLD, dirFromLonLat, lonLatFromDir, rotY, bodyYawFor, uvFromLonLat, sunDirForCamera,
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

  describe('sunDirForCamera: the Sun follows the camera azimuth', () => {
    it('camera on +Z gives exactly SUN_DIR_WORLD', () => {
      close3(sunDirForCamera([0, 0, 3.6]), SUN_DIR_WORLD, 1e-12);
    });

    it('holds the phase angle, stays equatorial and on the viewer left at every azimuth and height', () => {
      for (const azDeg of [0, 37, 90, 180, -120]) {
        for (const h of [0, 1.2]) {
          const a = (azDeg * Math.PI) / 180;
          const cam = [3.6 * Math.sin(a), h, 3.6 * Math.cos(a)];
          const s = sunDirForCamera(cam);
          const hd = [Math.sin(a), 0, Math.cos(a)];
          expect(Math.hypot(...s)).toBeCloseTo(1, 12);
          expect(s[1]).toBe(0);
          const dot = s[0] * hd[0] + s[2] * hd[2];
          expect(deg(Math.acos(Math.max(-1, Math.min(1, dot))))).toBeCloseTo(PHASE_ANGLE_DEG, 9);
          // viewer's right = cross(up, h) = [hz, 0, -hx]; the Sun is on the left of it
          expect(s[0] * hd[2] - s[2] * hd[0]).toBeLessThan(0);
        }
      }
    });

    it('camera exactly on the pole axis is finite and equals SUN_DIR_WORLD', () => {
      const s = sunDirForCamera([0, 4, 0]);
      s.forEach((v) => expect(Number.isFinite(v)).toBe(true));
      close3(s, SUN_DIR_WORLD, 1e-12);
    });
  });
});

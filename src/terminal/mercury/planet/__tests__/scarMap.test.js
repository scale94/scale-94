import { describe, it, expect } from 'vitest';
import {
  createScarMap, texelDir, stampCrater, matureScars, healScars, SCAR_DEPTH_RANGE_M, RAY_MATURE_S,
} from '../scarMap';
import { CRATER_DEPTH_M, CRATER_RADIUS_RAD, RAY_REACH } from '../mercuryImpacts';
import { dirFromLonLat, lonLatFromDir, uvFromLonLat } from '../planetFrame';

const idx = (m, ix, iy) => iy * m.w + ix;
const nearest = (m, d) => {
  const { lonDeg, latDeg } = lonLatFromDir(d);
  const [u, v] = uvFromLonLat(lonDeg, latDeg);
  return [Math.min(m.w - 1, Math.floor(u * m.w)), Math.min(m.h - 1, Math.floor(v * m.h))];
};

describe('scar map', () => {
  it('texelDir mirrors the shader uv mapping', () => {
    const m = createScarMap(256, 128);
    for (const [ix, iy] of [[0, 0], [17, 90], [255, 127], [128, 64]]) {
      const { lonDeg, latDeg } = lonLatFromDir(texelDir(m, ix, iy));
      const [u, v] = uvFromLonLat(lonDeg, latDeg);
      expect(u).toBeCloseTo((ix + 0.5) / m.w, 9);
      expect(v).toBeCloseTo((iy + 0.5) / m.h, 9);
    }
  });

  it('starts neutral: R 128, G 0, A 255, nothing live', () => {
    const m = createScarMap(64, 32);
    expect(m.live).toBe(false);
    for (let i = 0; i < m.w * m.h; i++) {
      expect(m.bytes[4 * i]).toBe(128);
      expect(m.bytes[4 * i + 1]).toBe(0);
      expect(m.bytes[4 * i + 3]).toBe(255);
    }
  });

  it('stamps a bowl and fresh rays, encoded into the bytes, and nothing beyond the ray reach', () => {
    const m = createScarMap();
    const d = dirFromLonLat(40, 10);
    expect(stampCrater(m, d, 1)).toBeGreaterThan(100);
    const [cx, cy] = nearest(m, d);
    const i = idx(m, cx, cy);
    expect(m.depth[i]).toBeLessThan(-0.95 * CRATER_DEPTH_M);
    expect(m.ray[i]).toBe(1);
    expect(m.bytes[4 * i]).toBe(Math.round(128 + (m.depth[i] / SCAR_DEPTH_RANGE_M) * 127));
    expect(m.bytes[4 * i + 1]).toBe(255);
    const far = dirFromLonLat(40 + (RAY_REACH * CRATER_RADIUS_RAD * 1.2 * 180) / Math.PI / Math.cos(10 * Math.PI / 180), 10);
    const [fx, fy] = nearest(m, far);
    expect(m.depth[idx(m, fx, fy)]).toBe(0);
    expect(m.ray[idx(m, fx, fy)]).toBe(0);
    expect(m.live).toBe(true);
  });

  it('a new crater overprints the old one instead of digging twice as deep', () => {
    const m = createScarMap();
    const d = dirFromLonLat(200, -20);
    stampCrater(m, d, 1);
    stampCrater(m, d, 2);
    const [cx, cy] = nearest(m, d);
    expect(m.depth[idx(m, cx, cy)]).toBeGreaterThan(-1.05 * CRATER_DEPTH_M);
  });

  it('wraps across the 0/360° seam and survives the pole', () => {
    const m = createScarMap();
    stampCrater(m, dirFromLonLat(0.5, 0), 3);
    const row = Math.floor(m.h / 2);
    expect(m.depth[idx(m, 0, row)]).toBeLessThan(0);
    expect(m.depth[idx(m, m.w - 1, row)]).toBeLessThan(0);
    expect(() => stampCrater(m, dirFromLonLat(10, 87), 4)).not.toThrow();
    expect(m.ray[idx(m, 0, m.h - 1)]).toBeGreaterThan(0);
  });

  it('rays mature by exp(-dt/RAY_MATURE_S); depth stays; nothing to do when no rays are live', () => {
    const m = createScarMap();
    const d = dirFromLonLat(100, 0);
    stampCrater(m, d, 5);
    const [cx, cy] = nearest(m, d);
    const i = idx(m, cx, cy);
    const depth = m.depth[i];
    expect(matureScars(m, 1e-6)).toBe(false);   // a step too small to move any byte: no upload
    expect(matureScars(m, 60)).toBe(true);
    expect(m.ray[i]).toBeCloseTo(Math.exp(-60 / RAY_MATURE_S), 5);
    expect(m.depth[i]).toBe(depth);
    expect(m.bytes[4 * i + 1]).toBe(Math.round(m.ray[i] * 255));
    expect(matureScars(createScarMap(32, 16), 60)).toBe(false);
  });

  it('heals completely, once', () => {
    const m = createScarMap(256, 128);
    stampCrater(m, dirFromLonLat(10, 10), 6);
    expect(healScars(m)).toBe(true);
    expect(m.live).toBe(false);
    expect(m.depth.every((x) => x === 0)).toBe(true);
    expect(m.ray.every((x) => x === 0)).toBe(true);
    expect(m.bytes[0]).toBe(128);
    expect(healScars(m)).toBe(false);
  });
});

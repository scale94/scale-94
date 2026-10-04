import { describe, it, expect } from 'vitest';
import {
  createScarMap, texelDir, stampCrater, matureScars, healScars, SCAR_DEPTH_RANGE_M, RAY_MATURE_S,
  stampFrost, stampGlaze, stampPit, pitHeightM, healMelted, clearMarks,
} from '../scarMap';
import { CRATER_DEPTH_M, CRATER_RADIUS_RAD, RAY_REACH } from '../mercuryImpacts';
import { qRotate } from '../breakupFamily';
import { localTempK } from '../mercuryImpacts';
import { HG_MELT_K } from '../mercuryThermal';
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

  it('starts neutral: R 128, G 0, B 0, A 0, nothing live', () => {
    const m = createScarMap(64, 32);
    expect(m.live).toBe(false);
    for (let i = 0; i < m.w * m.h; i++) {
      expect(m.bytes[4 * i]).toBe(128);
      expect(m.bytes[4 * i + 1]).toBe(0);
      expect(m.bytes[4 * i + 2]).toBe(0);
      expect(m.bytes[4 * i + 3]).toBe(0);
    }
    expect(m.marksLive).toBe(false);
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

describe('scarMap — the visitors marks (matrix spec §5.2)', () => {
  const nearest = (m, d) => {
    let best = -2, bi = 0;
    const p = [0, 0, 0];
    for (let iy = 0; iy < m.h; iy++) for (let ix = 0; ix < m.w; ix++) {
      texelDir(m, ix, iy, p);
      const c = p[0] * d[0] + p[1] * d[1] + p[2] * d[2];
      if (c > best) { best = c; bi = iy * m.w + ix; }
    }
    return bi;
  };
  const angleTo = (m, i, d) => {
    const p = texelDir(m, i % m.w, Math.floor(i / m.w));
    return Math.acos(Math.min(1, p[0] * d[0] + p[1] * d[1] + p[2] * d[2]));
  };
  const D = [0, 0, 1];

  it('frost writes only B: full at its centre, nothing past 1.2 radii', () => {
    const m = createScarMap(512, 256);
    const before = m.bytes.slice();
    expect(stampFrost(m, D, 0.05, 7)).toBeGreaterThan(0);
    expect(m.marksLive).toBe(true);
    expect(m.live).toBe(false);
    let other = 0, far = 0;
    for (let i = 0; i < m.w * m.h; i++) {
      if (m.bytes[4 * i] !== before[4 * i] || m.bytes[4 * i + 1] !== before[4 * i + 1] || m.bytes[4 * i + 3] !== before[4 * i + 3]) other++;
      if (m.bytes[4 * i + 2] > 0 && angleTo(m, i, D) > 1.2 * 0.05 + 1e-9) far++;
    }
    expect(other).toBe(0);
    expect(far).toBe(0);
    expect(m.bytes[4 * nearest(m, D) + 2]).toBe(255);
  });
  it('glaze writes only A, full at its centre', () => {
    const m = createScarMap(512, 256);
    const before = m.bytes.slice();
    expect(stampGlaze(m, D, 0.035)).toBeGreaterThan(0);
    expect(m.marksLive).toBe(true);
    let other = 0;
    for (let i = 0; i < m.w * m.h; i++) {
      if (m.bytes[4 * i] !== before[4 * i] || m.bytes[4 * i + 1] !== before[4 * i + 1] || m.bytes[4 * i + 2] !== before[4 * i + 2]) other++;
    }
    expect(other).toBe(0);
    expect(m.bytes[4 * nearest(m, D) + 3]).toBe(255);
  });
  it('a pit is a shallow bowl in the depth channel, with a low collar; no rays', () => {
    expect(pitHeightM(0, 600)).toBe(-600);
    expect(pitHeightM(1, 600)).toBeCloseTo(90, 9);
    expect(pitHeightM(3, 600)).toBeLessThan(pitHeightM(1.2, 600));
    const m = createScarMap(512, 256);
    expect(stampPit(m, D, 0.03, 600)).toBeGreaterThan(0);
    expect(m.live).toBe(true);
    expect(m.marksLive).toBe(false);
    const i = nearest(m, D);
    expect(m.depth[i]).toBeLessThan(-500);
    expect(m.bytes[4 * i]).toBeLessThan(128);
    expect(m.ray.every((r) => r === 0)).toBe(true);
  });
  it('the melt wipe of craters leaves frost and glaze alone', () => {
    const m = createScarMap(256, 128);
    stampCrater(m, [1, 0, 0], 3);
    stampFrost(m, D, 0.1, 1);
    stampGlaze(m, [0, 1, 0], 0.1);
    const ba = (i) => [m.bytes[4 * i + 2], m.bytes[4 * i + 3]];
    const before = Array.from({ length: m.w * m.h }, (_, i) => ba(i));
    expect(healScars(m)).toBe(true);
    for (let i = 0; i < m.w * m.h; i++) expect(ba(i)).toEqual(before[i]);
    expect(m.marksLive).toBe(true);
  });
  it('clearMarks wipes frost and glaze; with none it does nothing', () => {
    const m = createScarMap(64, 32);
    expect(clearMarks(m)).toBe(false);
    stampFrost(m, D, 0.3, 1);
    stampGlaze(m, D, 0.3);
    expect(clearMarks(m)).toBe(true);
    expect(m.marksLive).toBe(false);
    for (let i = 0; i < m.w * m.h; i++) { expect(m.bytes[4 * i + 2]).toBe(0); expect(m.bytes[4 * i + 3]).toBe(0); }
  });
  it('healMelted clears exactly the marked texels where the Hg under them is liquid, in the world frame', () => {
    const sun = [1, 0, 0], tss = 700, heat = 0;
    expect(localTempK([1, 0, 0], sun, tss, heat)).toBeGreaterThan(HG_MELT_K);   // preconditions: noon is hot…
    expect(localTempK([-1, 0, 0], sun, tss, heat)).toBeLessThan(HG_MELT_K);     // …midnight is frozen
    const m = createScarMap(256, 128);
    stampFrost(m, [1, 0, 0], 0.1, 1);
    stampGlaze(m, [-1, 0, 0], 0.1);
    const marked = [];
    for (let i = 0; i < m.w * m.h; i++) if (m.bytes[4 * i + 2] || m.bytes[4 * i + 3]) marked.push(i);
    const q = [0, 0, 0, 1];
    expect(healMelted(m, q, sun, tss, heat)).toBe(true);
    let cleared = 0, kept = 0;
    const w = [0, 0, 0];
    for (const i of marked) {
      qRotate(q, texelDir(m, i % m.w, Math.floor(i / m.w)), w);
      const hot = localTempK(w, sun, tss, heat) > HG_MELT_K;
      const gone = m.bytes[4 * i + 2] === 0 && m.bytes[4 * i + 3] === 0;
      expect(gone).toBe(hot);
      if (gone) cleared++; else kept++;
    }
    expect(cleared).toBeGreaterThan(0);
    expect(kept).toBeGreaterThan(0);
    expect(m.marksLive).toBe(true);
    // turn the body half a revolution about Y: the midnight glaze now faces the Sun and melts
    expect(healMelted(m, [0, 1, 0, 0], sun, tss, heat)).toBe(true);
    expect(m.marksLive).toBe(false);
    expect(healMelted(m, q, sun, tss, heat)).toBe(false);
  });
});

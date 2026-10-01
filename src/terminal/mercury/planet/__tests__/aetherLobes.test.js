// src/terminal/mercury/planet/__tests__/aetherLobes.test.js
import { describe, it, expect } from 'vitest';
import {
  AETHER_LOBES, AETHER_DRIFT_RAD_PER_S, AETHER_BASE_DIRS, AETHER_PHASES, AETHER_PALETTES_SRGB,
  srgbToLinear, aetherLobeColors, aetherLobeDirs,
} from '../aetherLobes';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.sqrt(dot(a, a));

describe('aetherLobes', () => {
  it('8 unit lobes wrap the planet: camera side (+z) and far side, ≥ 70° apart', () => {
    expect(AETHER_BASE_DIRS).toHaveLength(AETHER_LOBES);
    expect(AETHER_LOBES).toBe(8);
    for (const d of AETHER_BASE_DIRS) expect(len(d)).toBeCloseTo(1, 12);
    expect(AETHER_BASE_DIRS.some((d) => d[2] > 0.5)).toBe(true);
    expect(AETHER_BASE_DIRS.some((d) => d[2] < -0.5)).toBe(true);
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
      expect(Math.acos(dot(AETHER_BASE_DIRS[i], AETHER_BASE_DIRS[j]))).toBeGreaterThanOrEqual(70 * Math.PI / 180);
    }
  });

  it('srgbToLinear is the IEC 61966-2-1 curve', () => {
    expect(srgbToLinear(0)).toBe(0);
    expect(srgbToLinear(1)).toBeCloseTo(1, 12);
    expect(srgbToLinear(0.5)).toBeCloseTo(0.21404, 4);
    expect(srgbToLinear(0.04)).toBeCloseTo(0.04 / 12.92, 12);
  });

  it('palettes are three sRGB colours per element flow', () => {
    expect(AETHER_PHASES).toEqual(['fluid', 'thermal', 'earth', 'air']);
    for (const p of AETHER_PHASES) expect(AETHER_PALETTES_SRGB[p]).toHaveLength(3);
  });

  it('no aether, no colour', () => {
    for (const c of aetherLobeColors({})) expect(c).toEqual([0, 0, 0]);
  });

  it('lobe i takes palette entry i % 3 of each element, weighted by its opacity', () => {
    const cols = aetherLobeColors({ fluid: 0.45 });
    const mag = AETHER_PALETTES_SRGB.fluid[0].map(srgbToLinear);
    cols[0].forEach((v, k) => expect(v).toBeCloseTo(0.45 * mag[k], 12));
    const cyan = AETHER_PALETTES_SRGB.fluid[2].map(srgbToLinear);
    cols[5].forEach((v, k) => expect(v).toBeCloseTo(0.45 * cyan[k], 12));
  });

  it('the active element dominates the ghosts', () => {
    const cols = aetherLobeColors({ fluid: 0.45, thermal: 0.12, earth: 0.12, air: 0.12 });
    const ghostOnly = aetherLobeColors({ thermal: 0.12, earth: 0.12, air: 0.12 });
    const sum = (cs) => cs.reduce((s, c) => s + c[0] + c[1] + c[2], 0);
    expect(sum(cols) - sum(ghostOnly)).toBeGreaterThan(sum(ghostOnly));
  });

  it('writes into a caller-owned buffer (no per-frame allocation)', () => {
    const out = AETHER_BASE_DIRS.map(() => [9, 9, 9]);
    expect(aetherLobeColors({ air: 0.2 }, out)).toBe(out);
    const dirs = AETHER_BASE_DIRS.map(() => [0, 0, 0]);
    expect(aetherLobeDirs(3, dirs)).toBe(dirs);
  });

  it('the lobes drift about the vertical, by time not frames', () => {
    const d0 = aetherLobeDirs(0);
    d0.forEach((d, i) => d.forEach((v, k) => expect(v).toBeCloseTo(AETHER_BASE_DIRS[i][k], 12)));
    const quarter = (Math.PI / 2) / AETHER_DRIFT_RAD_PER_S;
    const dq = aetherLobeDirs(quarter);
    dq.forEach((d, i) => {
      const b = AETHER_BASE_DIRS[i];
      expect(d[1]).toBeCloseTo(b[1], 12);                       // y unchanged
      expect(d[0] * b[0] + d[2] * b[2]).toBeCloseTo(0, 9);      // xz turned 90°
      expect(len(d)).toBeCloseTo(1, 12);
    });
    expect(AETHER_DRIFT_RAD_PER_S).toBeGreaterThan(0);
    expect(AETHER_DRIFT_RAD_PER_S).toBeLessThan(0.1);           // slow: a cycle takes minutes
  });
});

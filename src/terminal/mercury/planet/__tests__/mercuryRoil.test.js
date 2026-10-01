import { describe, it, expect } from 'vitest';
import {
  hash13, popDensity, popSlope, roilTilt,
  POP_FREQ, POP_JITTER, POP_REACH, POP_REACH_RAD, POP_REF_TH, POP_SCALE, POP_LIFE_S, POP_TIME, POP_AMP,
} from '../mercuryRoil';
import { WAVE_C_FRONT, WAVE_K_PEAK, WAVE_DIMPLE_RAD, WAVE_DIMPLE_AA_LO } from '../mercuryWaves';

const norm = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };
// deterministic PRNG for sampling (mulberry32)
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

describe('mercuryRoil', () => {
  it('hash13 is deterministic and in [0, 1)', () => {
    const r = rng(1);
    for (let i = 0; i < 500; i++) {
      const p = [r() * 40 - 20, r() * 40 - 20, r() * 40 - 20];
      const h = hash13(...p);
      expect(h).toBe(hash13(...p));
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });

  it('popDensity: 0 at and below the boil point, rising steadily, below 1', () => {
    expect(popDensity(0)).toBe(0);
    expect(popDensity(-20)).toBe(0);
    let prev = 0;
    for (let dT = 5; dT <= 200; dT += 5) {
      const d = popDensity(dT);
      expect(d).toBeGreaterThan(prev);
      expect(d).toBeLessThan(1);
      prev = d;
    }
  });

  it('the miniature: the front reaches the edge of the reach exactly at end of life (R2)', () => {
    expect(POP_SCALE * POP_REACH_RAD).toBeCloseTo(POP_REF_TH, 12);
    expect(WAVE_C_FRONT * POP_LIFE_S * POP_TIME).toBeCloseTo(POP_REF_TH, 12);
    expect(POP_REACH_RAD).toBeCloseTo(POP_REACH / POP_FREQ, 12);
  });

  it('rings resolve on the rest disc: ≥ 5 px per peak wavelength, a 10–20 px reach (R2 amended)', () => {
    const PX = 0.0047; // arc per pixel on the ~205 px-radius rest disc
    expect(WAVE_K_PEAK * PX * POP_SCALE).toBeLessThanOrEqual((2 * Math.PI) / 5);
    expect(POP_REACH_RAD / PX).toBeGreaterThanOrEqual(10);
    expect(POP_REACH_RAD / PX).toBeLessThanOrEqual(20);
  });

  it('a pop ring keeps real slope at a realistic pxArc (bandAA does not erase it)', () => {
    const peak = (px) => {
      let m = 0;
      for (let age = 0.01; age < POP_LIFE_S; age += 0.01) for (let r = 0.3; r < 1; r += 0.005) m = Math.max(m, Math.abs(popSlope(r * POP_REACH_RAD, age, px)));
      return m;
    };
    expect(peak(0.005)).toBeGreaterThanOrEqual(0.25 * peak(0));
  });

  it('the pop dimple fades when sub-pixel and is untouched when resolved', () => {
    const dimple = (px) => { let m = 0; for (let th = 1e-5; th < 0.25 * POP_REACH_RAD; th += 1e-5) m = Math.max(m, Math.abs(popSlope(th, 0.002, px))); return m; };
    const subPx = (WAVE_DIMPLE_RAD / POP_SCALE) / (0.5 * WAVE_DIMPLE_AA_LO); // the dimple's radius is half a pixel
    expect(dimple(0)).toBeGreaterThan(0.1 * POP_AMP);
    expect(dimple(subPx)).toBeLessThan(1e-3 * dimple(0));
    expect(dimple(0.005)).toBeCloseTo(dimple(0), 6);
  });

  it('containment: no slope beyond the reach or after the life', () => {
    for (const age of [0.01, 0.1, 0.3, 0.55]) {
      expect(popSlope(POP_REACH_RAD, age, 0)).toBe(0);
      expect(popSlope(POP_REACH_RAD * 1.5, age, 0)).toBe(0);
    }
    expect(popSlope(0.3 * POP_REACH_RAD, POP_LIFE_S, 0)).toBe(0);
    expect(popSlope(0.3 * POP_REACH_RAD, POP_LIFE_S + 1, 0)).toBe(0);
    expect(Math.abs(popSlope(0.2 * POP_REACH_RAD, 0.1, 0))).toBeGreaterThan(0);
  });

  it('no pops below the boil point', () => {
    const r = rng(2);
    for (let i = 0; i < 200; i++) {
      const x = norm([r() - 0.5, r() - 0.5, r() - 0.5]);
      const { g, act } = roilTilt(x, r() * 100, -1, 0.002);
      expect(g).toEqual([0, 0, 0]);
      expect(act).toBe(0);
    }
  });

  it('more superheat, more surface boiling (a steady onset, no hard line)', () => {
    const r = rng(3);
    const xs = Array.from({ length: 4000 }, () => norm([r() - 0.5, r() - 0.5, r() - 0.5]));
    const busy = (dT) => xs.filter((x) => roilTilt(x, 7.3, dT, 0.002).act > 0).length;
    const a = busy(10), b = busy(60), c = busy(150);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it('the slope is tangent to the sphere and activity stays in [0, 1]', () => {
    const r = rng(4);
    for (let i = 0; i < 2000; i++) {
      const x = norm([r() - 0.5, r() - 0.5, r() - 0.5]);
      const { g, act } = roilTilt(x, r() * 50, 150, 0.002);
      expect(Math.abs(g[0] * x[0] + g[1] * x[1] + g[2] * x[2])).toBeLessThan(1e-9);
      expect(act).toBeGreaterThanOrEqual(0);
      expect(act).toBeLessThanOrEqual(1);
    }
  });

  it('seam-free (R1): continuous across every cell boundary, at full density', () => {
    expect(POP_JITTER + POP_REACH).toBeLessThan(1);
    const r = rng(5);
    let compared = 0;
    // A unit vector whose p.x = x·POP_FREQ is exactly px (y, z rescaled to stay on the sphere).
    const onSphere = (px, y, z) => {
      const x0 = px / POP_FREQ;
      const k = Math.sqrt(1 - x0 * x0) / Math.hypot(y, z);
      return [x0, y * k, z * k];
    };
    for (let i = 0; i < 3000; i++) {
      const x = norm([r() - 0.5, r() - 0.5, r() - 0.5]);
      // the nearest x-boundary of the 2×2×2 neighbourhood: p.x − 0.5 an integer
      const bx = Math.round(x[0] * POP_FREQ - 0.5) + 0.5;
      if (Math.abs(bx / POP_FREQ) > 0.98) continue;
      const xA = onSphere(bx - 1e-7, x[1], x[2]), xB = onSphere(bx + 1e-7, x[1], x[2]);
      const t = r() * 30;
      const A = roilTilt(xA, t, 200, 0.002), B = roilTilt(xB, t, 200, 0.002);
      if (A.act === 0 && B.act === 0) continue;
      compared++;
      for (let k = 0; k < 3; k++) expect(Math.abs(A.g[k] - B.g[k])).toBeLessThan(1e-3);
    }
    expect(compared).toBeGreaterThan(50);
  });
});

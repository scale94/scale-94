import { describe, it, expect } from 'vitest';
import {
  MATTER_N, T_FLOW, OMEGA_ISCO_VIS, omegaVis,
  makePeriodicNoise, bakeMatterTexture, flowLayers,
} from '../councilMatter';

describe('councilMatter (spec §7.3)', () => {
  it('tiles the noise in both axes', () => {
    const f = makePeriodicNoise(7);
    for (const [x, y] of [[0.3, 5.7], [100.25, 311.5], [511.9, 0.1]]) {
      expect(f(x + MATTER_N, y)).toBeCloseTo(f(x, y), 9);
      expect(f(x, y + MATTER_N)).toBeCloseTo(f(x, y), 9);
    }
  });

  it('bakes a deterministic, full-range 8-bit texture', () => {
    const a = bakeMatterTexture();
    expect(a).toEqual(bakeMatterTexture());
    expect(a.length).toBe(MATTER_N * MATTER_N);
    let lo = 255, hi = 0;
    for (const v of a) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    expect(lo).toBeLessThan(40);
    expect(hi).toBeGreaterThan(215);
  });

  it('turns the ISCO in 7 s and the outer edge in ~43 s (Keplerian Ω ∝ r^-3/2)', () => {
    expect(omegaVis(3)).toBeCloseTo(OMEGA_ISCO_VIS, 12);
    expect((2 * Math.PI) / omegaVis(10)).toBeCloseTo(7 * (10 / 3) ** 1.5, 9);
  });

  it('keeps each layer younger than one flow period at any uptime (no wind-up)', () => {
    for (const t of [0, 60, 3600, 86400]) {
      const f = flowLayers(t);
      for (const tau of [f.tau0, f.tau1]) {
        expect(tau).toBeGreaterThanOrEqual(0);
        expect(tau).toBeLessThan(T_FLOW);
      }
    }
    expect(flowLayers(86400).tau0).toBeCloseTo(6, 9); // 86400 − 14·6171, exact in float64
  });

  it('crossfades with a triangle weight: layer 0 silent at reset, full at mid-life', () => {
    expect(flowLayers(0).w0).toBe(0);
    expect(flowLayers(T_FLOW / 2).w0).toBe(1);
  });

  it('re-seeds a layer only while its weight is zero (no visible pop)', () => {
    const k = 5;
    const b0 = flowLayers(k * T_FLOW - 1e-6), a0 = flowLayers(k * T_FLOW + 1e-6);
    expect(a0.seed0).not.toBe(b0.seed0);
    expect(a0.seed1).toBe(b0.seed1);
    expect(b0.w0).toBeLessThan(1e-6);
    expect(a0.w0).toBeLessThan(1e-6);

    const mid = k * T_FLOW + T_FLOW / 2;
    const b1 = flowLayers(mid - 1e-6), a1 = flowLayers(mid + 1e-6);
    expect(a1.seed1).not.toBe(b1.seed1);
    expect(a1.seed0).toBe(b1.seed0);
    expect(1 - b1.w0).toBeLessThan(1e-6);
    expect(1 - a1.w0).toBeLessThan(1e-6);
  });
});

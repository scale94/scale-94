import { describe, it, expect } from 'vitest';
import {
  gNa, tailBrightness, tailLength, boilCoverage, haloColumn, tailDensity, exoBox,
  TAIL_B_FLOOR, TAIL_L_MIN, TAIL_L_MAX, TAIL_AXIS, H_NA, HALO_REACH_H, TAIL_REACH_L,
} from '../mercuryExosphere';
import { mercuryEphemeris } from '../mercuryEphemeris';
import { SUN_DIR_WORLD } from '../planetFrame';
import { R_SCENE } from '../planetLook';
import { HG_BOIL_K } from '../mercuryThermal';

const DAY = 86400000;
const T0 = Date.UTC(2026, 0, 1);
const sweep = Array.from({ length: 880 }, (_, i) => T0 + i * 0.1 * DAY);

describe('mercuryExosphere', () => {
  it('gNa: dimmest in the Fraunhofer core (v_r = 0), rising with |v_r|, saturating at 1', () => {
    expect(gNa(0)).toBeLessThan(gNa(2));
    let prev = gNa(0);
    for (let v = 1; v <= 12; v++) { expect(gNa(v)).toBeGreaterThan(prev); prev = gNa(v); }
    expect(gNa(-5)).toBe(gNa(5));
    expect(gNa(30)).toBeCloseTo(1, 6);
  });

  it('tailBrightness: within [floor, 1] over an orbit, peak 1, floor actually reached or above', () => {
    const B = sweep.map(tailBrightness);
    expect(Math.min(...B)).toBeGreaterThanOrEqual(TAIL_B_FLOOR);
    expect(Math.max(...B)).toBeCloseTo(1, 3);
    expect(TAIL_B_FLOOR).toBe(0.15);
  });

  it('R3: dimmer at perihelion (v_r ≈ 0) than at the date of max |v_r|', () => {
    const eph = sweep.map((t) => ({ t, ...mercuryEphemeris(t) }));
    const peri = eph.reduce((a, b) => (b.r < a.r ? b : a));
    const fast = eph.reduce((a, b) => (Math.abs(b.rdotKmS) > Math.abs(a.rdotKmS) ? b : a));
    expect(tailBrightness(peri.t)).toBeLessThan(tailBrightness(fast.t));
  });

  it('tailLength grows with B between its bounds', () => {
    expect(tailLength(0)).toBeCloseTo(TAIL_L_MIN, 12);
    expect(tailLength(1)).toBeCloseTo(TAIL_L_MAX, 12);
    expect(tailLength(0.6)).toBeGreaterThan(tailLength(0.3));
  });

  it('TAIL_AXIS is anti-sunward in the world frame', () => {
    for (let k = 0; k < 3; k++) expect(TAIL_AXIS[k]).toBeCloseTo(-SUN_DIR_WORLD[k], 12);
  });

  it('boilCoverage: 0 when crust or too cool; grows with heat; never above a hemisphere', () => {
    expect(boilCoverage(0, 80, 700)).toBe(0);
    expect(boilCoverage(1, 0, 570)).toBe(0);                // aphelion noon 570 K < 630 K
    const lo = boilCoverage(1, 0, 700), hi = boilCoverage(1, 60, 700);
    expect(lo).toBeGreaterThan(0);
    expect(hi).toBeGreaterThan(lo);
    expect(boilCoverage(1, HG_BOIL_K + 1, 700)).toBe(0.5);
    expect(boilCoverage(0.5, 60, 700)).toBeCloseTo(hi / 2, 12);
  });

  it('haloColumn: zero over the disc, decaying outside the limb', () => {
    expect(haloColumn(0.5 * R_SCENE, H_NA)).toBe(0);
    expect(haloColumn(R_SCENE, H_NA)).toBe(0);
    const a = haloColumn(R_SCENE * 1.01, H_NA), b = haloColumn(R_SCENE * 1.2, H_NA);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(0);
  });

  it('tailDensity: zero inside the planet and sunward of it; falls downstream and off-axis', () => {
    const a = TAIL_AXIS, L = tailLength(1);
    const at = (s, off = 0) => [a[0] * s, a[1] * s + off, a[2] * s];
    expect(tailDensity(at(0.5 * R_SCENE), 1, L)).toBe(0);
    expect(tailDensity(at(-2 * R_SCENE), 1, L)).toBe(0);
    expect(tailDensity(at(2 * R_SCENE), 1, L)).toBeGreaterThan(tailDensity(at(4 * R_SCENE), 1, L));
    expect(tailDensity(at(2 * R_SCENE), 1, L)).toBeGreaterThan(tailDensity(at(2 * R_SCENE, 0.5), 1, L));
    expect(tailDensity(at(2 * R_SCENE), 0.5, L)).toBeCloseTo(0.5 * tailDensity(at(2 * R_SCENE), 1, L), 12);
  });

  it('exoBox encloses the halo and the tail out to TAIL_REACH_L lengths', () => {
    for (const B of [0, 0.5, 1]) {
      const L = tailLength(B);
      const { s0, s1, width } = exoBox(L);
      const halo = R_SCENE + HALO_REACH_H * H_NA;
      expect(s0).toBeLessThanOrEqual(-halo);
      expect(s1).toBeGreaterThanOrEqual(TAIL_REACH_L * L);
      expect(width / 2).toBeGreaterThanOrEqual(halo);
    }
  });
});

import { describe, it, expect } from 'vitest';
import {
  emissivity, F_MAX, R_PEAK, R_IN, R_OUT, temperature, T_PEAK,
  redshiftFactor, blackbody, COUNTER_JET, SPIN_SIGN,
} from '../councilFieldPhysics';

describe('councilFieldPhysics (spec §7.3–7.4, §7.8, §9 Q1)', () => {
  it('emissivity is zero at the ISCO and peaks at 49/12 r_s', () => {
    expect(emissivity(R_IN)).toBe(0);
    expect(R_PEAK).toBeCloseTo(49 / 12, 12);
    expect(emissivity(R_PEAK - 0.01)).toBeLessThan(F_MAX);
    expect(emissivity(R_PEAK + 0.01)).toBeLessThan(F_MAX);
  });

  it('runs 12 000 K at the emissivity peak down to an 1 800 K ember at the outer edge', () => {
    expect(temperature(R_PEAK)).toBeCloseTo(T_PEAK, 6);
    expect(temperature(R_OUT)).toBeCloseTo(1800, 6);
  });

  it('blueshifts the east (sidelined) side and redshifts the west for SPIN_SIGN +1', () => {
    expect(SPIN_SIGN).toBe(1);
    const east = redshiftFactor(4, 5, +1);
    const west = redshiftFactor(4, 5, -1);
    expect(east).toBeGreaterThan(1);
    expect(west).toBeLessThan(1);
    expect((east / west) ** 4).toBeGreaterThan(30);
  });

  it('reduces to pure gravitational redshift with no line-of-sight velocity', () => {
    expect(redshiftFactor(3, 5, 0)).toBeCloseTo(Math.sqrt(0.5), 12);
  });

  it('maps temperature to blue-white, near-white and ember along the Planckian locus', () => {
    const hot = blackbody(12000);
    expect(hot[2]).toBe(1);
    expect(hot[0]).toBeLessThan(0.8);
    expect(Math.min(...blackbody(6500))).toBeGreaterThan(0.8);
    const ember = blackbody(2000);
    expect(ember[0]).toBe(1);
    expect(ember[1]).toBeLessThan(0.4);
    expect(ember[2]).toBeLessThan(0.05);
  });

  it('dims the counter-jet to ~1.7% (Γ = 3, 60° to the line of sight)', () => {
    expect(COUNTER_JET).toBeCloseTo(0.0166, 3);
  });
});

import { describe, it, expect } from 'vitest';
import {
  HG_MELT_K, HG_BOIL_K, T_NIGHT_FLOOR_K, HOURS_PER_RAD, SOLAR_DAY_H,
  subsolarTempK, surfaceTempK, hgPhase,
} from '../mercuryThermal';

const D = Math.PI / 180;
const eq = (lonDeg, tss, heat = 0) => surfaceTempK(Math.cos(lonDeg * D), lonDeg * D, 1, tss, heat);

describe('mercuryThermal', () => {
  it('subsolar temperature: ~700 K at perihelion, ~568 K at aphelion', () => {
    expect(subsolarTempK(0.307)).toBeCloseTo(700, 6);
    expect(subsolarTempK(0.4667)).toBeCloseTo(567.7, 0);
  });

  it('HOURS_PER_RAD is the 176-day solar day over 2π', () => {
    expect(HOURS_PER_RAD).toBeCloseTo(SOLAR_DAY_H / (2 * Math.PI), 12);
  });

  it('noon at perihelion boils; the boil line sits near 49° (spec §3)', () => {
    expect(hgPhase(eq(0, 700))).toBe('boiling');
    expect(hgPhase(eq(40, 700))).toBe('boiling');
    expect(hgPhase(eq(55, 700))).toBe('liquid');
  });

  it('at aphelion the Sun alone cannot boil it; spin heat can', () => {
    const tss = subsolarTempK(0.4667);
    expect(hgPhase(eq(0, tss))).toBe('liquid');
    expect(hgPhase(eq(0, tss, 80))).toBe('boiling');
  });

  it('dusk trails liquid past sunset, then freezes', () => {
    expect(hgPhase(eq(105, 700))).toBe('liquid');  // 15° past the dusk terminator
    expect(hgPhase(eq(120, 700))).toBe('solid');   // 30° past
  });

  it('dawn is frozen where the matching afternoon is liquid (rotation direction visible)', () => {
    expect(hgPhase(eq(-80, 700))).toBe('solid');   // 10° after sunrise
    expect(hgPhase(eq(80, 700))).toBe('liquid');   // 10° before sunset
    expect(hgPhase(eq(-60, 700))).toBe('liquid');  // warmed by 30° after sunrise
  });

  it('is continuous across both terminators', () => {
    const e = 1e-7;
    expect(Math.abs(eq(90 - e / D, 700) - eq(90 + e / D, 700))).toBeLessThan(0.01);
    expect(Math.abs(eq(-90 - e / D, 700) - eq(-90 + e / D, 700))).toBeLessThan(0.5);
  });

  it('the end of the long night sits at the floor', () => {
    expect(eq(-95, 700)).toBeLessThan(T_NIGHT_FLOOR_K + 1);        // just before dawn
    expect(eq(-95, 700)).toBeGreaterThanOrEqual(T_NIGHT_FLOOR_K);
  });

  it('spin heat adds uniformly', () => {
    expect(eq(150, 700, 50) - eq(150, 700, 0)).toBeCloseTo(50, 9);
  });

  it('hgPhase uses the 1-atm window', () => {
    expect(hgPhase(HG_MELT_K - 0.01)).toBe('solid');
    expect(hgPhase(HG_MELT_K + 0.01)).toBe('liquid');
    expect(hgPhase(HG_BOIL_K + 0.01)).toBe('boiling');
  });
});

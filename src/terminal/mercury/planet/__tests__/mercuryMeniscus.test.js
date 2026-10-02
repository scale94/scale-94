import { describe, it, expect } from 'vitest';
import {
  MENISCUS_CONTACT_DEG, MENISCUS_MAX_SIN, MENISCUS_MIN_PX, meniscusSin, meniscusWidth,
} from '../mercuryMeniscus';

describe('mercuryMeniscus — the non-wetting bead rim', () => {
  it('Hg on silicate is non-wetting, so the visible wall goes vertical', () => {
    expect(MENISCUS_CONTACT_DEG).toBeGreaterThan(90);
    expect(MENISCUS_MAX_SIN).toBeCloseTo(1, 9);
  });

  it('is a quarter circle: vertical at the contact line, flat at the pool', () => {
    expect(meniscusSin(0, 0.02, 1)).toBeCloseTo(1, 9);
    expect(meniscusSin(0.01, 0.02, 1)).toBeCloseTo(0.5, 9);
    expect(meniscusSin(0.02, 0.02, 1)).toBe(0);
    expect(meniscusSin(0.05, 0.02, 1)).toBe(0);
  });

  it('nothing on the crust side of the contact line', () => {
    expect(meniscusSin(-0.001, 0.02, 1)).toBe(0);
  });

  it('gain scales the tilt and is clamped to [0, 1]', () => {
    expect(meniscusSin(0, 0.02, 0.5)).toBeCloseTo(0.5, 9);
    expect(meniscusSin(0, 0.02, 3)).toBeCloseTo(1, 9);
    expect(meniscusSin(0, 0.02, -1)).toBe(0);
  });

  it('never narrower than MENISCUS_MIN_PX pixels of arc', () => {
    expect(meniscusWidth(0.02, 0.001)).toBe(0.02);
    expect(meniscusWidth(0.002, 0.004)).toBeCloseTo(MENISCUS_MIN_PX * 0.004, 12);
  });
});

import { describe, it, expect } from 'vitest';
import { chooseQuality, pixelRatioFor, typicalFrameMs, WARMUP_S, MEASURE_S } from '../quality';

describe('chooseQuality', () => {
  it('a phone-width viewport gets the reduced path', () => {
    expect(chooseQuality({ viewportWidth: 375 })).toBe(0.5);
    expect(chooseQuality({ viewportWidth: 767, avgFrameMs: 8 })).toBe(0.5);
  });
  it('a wide, fast screen keeps full quality', () => {
    expect(chooseQuality({ viewportWidth: 1280, avgFrameMs: 8 })).toBe(1);
    expect(chooseQuality({ viewportWidth: 768, avgFrameMs: 20 })).toBe(1);
  });
  it('a wide screen that drops frames gets the reduced path', () => {
    expect(chooseQuality({ viewportWidth: 1280, avgFrameMs: 25 })).toBe(0.5);
  });
  it('non-finite inputs are ignored: full quality', () => {
    expect(chooseQuality({ viewportWidth: NaN, avgFrameMs: Infinity })).toBe(1);
    expect(chooseQuality({})).toBe(1);
    expect(chooseQuality()).toBe(1);
    expect(chooseQuality({ viewportWidth: 1280, avgFrameMs: NaN })).toBe(1);
  });
});

describe('pixelRatioFor', () => {
  it('full quality on a wide screen is the harness ratio, DPR capped at 2', () => {
    expect(pixelRatioFor({ quality: 1, viewportWidth: 1280, dpr: 1 })).toBe(1);
    expect(pixelRatioFor({ quality: 1, viewportWidth: 1280, dpr: 1.25 })).toBe(1.25);
    expect(pixelRatioFor({ quality: 1, viewportWidth: 1280, dpr: 3 })).toBe(2);
  });
  it('narrow screens never exceed DPR 1.5 at full quality', () => {
    expect(pixelRatioFor({ quality: 1, viewportWidth: 375, dpr: 3 })).toBe(1.5);
    expect(pixelRatioFor({ quality: 1, viewportWidth: 375, dpr: 1 })).toBe(1);
  });
  it('the reduced path renders at 0.75 of the full ratio', () => {
    expect(pixelRatioFor({ quality: 0.5, viewportWidth: 1280, dpr: 1 })).toBe(0.75);
    expect(pixelRatioFor({ quality: 0.5, viewportWidth: 375, dpr: 3 })).toBeCloseTo(1.125, 12);
  });
  it('hostile input falls back to DPR 1, full quality', () => {
    expect(pixelRatioFor({ quality: NaN, viewportWidth: NaN, dpr: NaN })).toBe(1);
    expect(pixelRatioFor()).toBe(1);
  });
});

describe('typicalFrameMs (the robust first-second statistic)', () => {
  it('a fast run with five 50 ms spikes stays fast: quality 1', () => {
    const s = Array(120).fill(8);
    for (let i = 0; i < 5; i++) s[i * 20] = 50;
    const t = typicalFrameMs(s);
    expect(t).toBeLessThan(9);
    expect(chooseQuality({ viewportWidth: 1280, avgFrameMs: t })).toBe(1);
  });
  it('a steady 25 ms run is slow: quality 0.5', () => {
    const t = typicalFrameMs(Array(40).fill(25));
    expect(t).toBeCloseTo(25, 9);
    expect(chooseQuality({ viewportWidth: 1280, avgFrameMs: t })).toBe(0.5);
  });
  it('drops the slowest tenth, ignores non-finite entries, NaN when empty', () => {
    expect(typicalFrameMs([10, 10, 10, 10, 10, 10, 10, 10, 10, 1000])).toBe(10);
    expect(typicalFrameMs([10, NaN, Infinity, -5, 10])).toBe(10);
    expect(Number.isNaN(typicalFrameMs([]))).toBe(true);
    expect(Number.isNaN(typicalFrameMs())).toBe(true);
  });
  it('the measurement skips a warm-up before it starts', () => {
    expect(WARMUP_S).toBeGreaterThanOrEqual(0.3);
    expect(MEASURE_S).toBeGreaterThanOrEqual(1);
  });
});

describe('narrow screens (review minor: the cap is live)', () => {
  it('a narrow dpr-3 phone at the reduced quality renders at 1.5 x 0.75', () => {
    expect(chooseQuality({ viewportWidth: 390 })).toBeLessThan(1);
    expect(pixelRatioFor({ quality: chooseQuality({ viewportWidth: 390 }), viewportWidth: 390, dpr: 3 })).toBeCloseTo(1.125, 12);
    // without the narrow cap it would be min(2, 3) x 0.75 = 1.5
    expect(pixelRatioFor({ quality: 0.5, viewportWidth: 1280, dpr: 3 })).toBeCloseTo(1.5, 12);
  });
});

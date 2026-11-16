import { describe, it, expect } from 'vitest';
import { chooseQuality, pixelRatioFor } from '../quality';

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

// tests/mercuryMapsLib.test.js
import { describe, it, expect } from 'vitest';
import { boxDownsample, rollToLonZero, quantise8Dithered, minMax } from '../scripts/mercury-maps/lib.mjs';

describe('mercury map lib', () => {
  it('boxDownsample averages f×f blocks per channel', () => {
    // 4×2, 1 channel → 2×1
    const src = new Uint8Array([0, 2, 10, 10, 4, 6, 20, 40]);
    expect(Array.from(boxDownsample(src, 4, 2, 1, 2))).toEqual([3, 20]);
  });

  it('boxDownsample keeps channels interleaved', () => {
    const src = new Uint8Array([0, 100, 2, 100, 4, 100, 6, 100]); // 2×2, 2 ch
    expect(Array.from(boxDownsample(src, 2, 2, 2, 2))).toEqual([3, 100]);
  });

  it('boxDownsample rejects non-integer factors', () => {
    expect(() => boxDownsample(new Uint8Array(6), 3, 2, 1, 2)).toThrow();
  });

  it('rollToLonZero moves the 0°E column to column 0 for a −180° start', () => {
    const src = new Uint8Array([1, 2, 3, 4]); // 4×1, columns at -135,-45,45,135
    expect(Array.from(rollToLonZero(src, 4, 1, 1, -180))).toEqual([3, 4, 1, 2]);
  });

  it('rollToLonZero is identity for a 0° start', () => {
    const src = new Uint8Array([1, 2, 3, 4]);
    expect(Array.from(rollToLonZero(src, 4, 1, 1, 0))).toEqual([1, 2, 3, 4]);
  });

  it('quantise8Dithered maps min→0, max→255 and stays within ±1 LSB of the ideal', () => {
    const v = new Float32Array(1000).map((_, i) => -5000 + (i / 999) * 10000);
    const q = quantise8Dithered(v, -5000, 5000);
    expect(q[0]).toBe(0);
    expect(q[999]).toBe(255);
    for (let i = 0; i < v.length; i++) {
      const ideal = ((v[i] + 5000) / 10000) * 255;
      expect(Math.abs(q[i] - ideal)).toBeLessThanOrEqual(1);
    }
  });

  it('quantise8Dithered is deterministic', () => {
    const v = new Float32Array([1, 2, 3, 4.5]);
    expect(Array.from(quantise8Dithered(v, 0, 10))).toEqual(Array.from(quantise8Dithered(v, 0, 10)));
  });

  it('minMax skips invalid samples', () => {
    expect(minMax(new Int16Array([-32768, -10, 50]), (x) => x > -32768)).toEqual({ min: -10, max: 50 });
  });
});

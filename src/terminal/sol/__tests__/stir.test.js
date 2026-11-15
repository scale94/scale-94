import { describe, it, expect } from 'vitest';
import { stirDelta, STIR_DEADZONE_PX } from '../stir.js';

const O = { x: 0, y: 0 };
const deg = (d) => (d * Math.PI) / 180;
const at = (deg_, r = 10) => ({ x: r * Math.cos(deg(deg_)), y: r * Math.sin(deg(deg_)) });

describe('stirDelta', () => {
  it('exposes a 6 px deadzone', () => {
    expect(STIR_DEADZONE_PX).toBe(6);
  });

  it('returns +0.25 for a quarter turn right to down (clockwise on screen, y down)', () => {
    expect(stirDelta({ x: 10, y: 0 }, { x: 0, y: 10 }, O)).toBeCloseTo(0.25, 12);
  });

  it('returns -0.25 for a quarter turn right to up (counter-clockwise on screen)', () => {
    expect(stirDelta({ x: 10, y: 0 }, { x: 0, y: -10 }, O)).toBeCloseTo(-0.25, 12);
  });

  it('sums sixteen clockwise steps around a full circle to 1', () => {
    let sum = 0;
    for (let k = 0; k < 16; k++) {
      sum += stirDelta(at((360 / 16) * k), at((360 / 16) * (k + 1)), O);
    }
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
  });

  it('sums sixteen counter-clockwise steps around a full circle to -1', () => {
    let sum = 0;
    for (let k = 0; k < 16; k++) {
      sum += stirDelta(at(-(360 / 16) * k), at(-(360 / 16) * (k + 1)), O);
    }
    expect(Math.abs(sum + 1)).toBeLessThan(1e-9);
  });

  it('takes the short way across the ±π seam: 179° to -179° is 2/360', () => {
    expect(stirDelta(at(179), at(-179), O)).toBeCloseTo(2 / 360, 9);
  });

  it('takes the short way across the seam in the other direction: -179° to 179° is -2/360', () => {
    expect(stirDelta(at(-179), at(179), O)).toBeCloseTo(-2 / 360, 9);
  });

  it('returns 0 for a point 3 px from the centre (inside the deadzone)', () => {
    expect(stirDelta({ x: 3, y: 0 }, { x: 0, y: 10 }, O)).toBe(0);
    expect(stirDelta({ x: 10, y: 0 }, { x: 0, y: 3 }, O)).toBe(0);
  });

  it('returns 0 when only one point is inside the deadzone', () => {
    expect(stirDelta({ x: 0, y: 0 }, { x: 0, y: 10 }, O)).toBe(0);
  });

  it('returns 0 when prev equals cur', () => {
    expect(stirDelta({ x: 10, y: 0 }, { x: 10, y: 0 }, O)).toBe(0);
  });

  it('returns 0, never NaN, when any input coordinate is NaN', () => {
    expect(stirDelta({ x: NaN, y: 0 }, { x: 0, y: 10 }, O)).toBe(0);
    expect(stirDelta({ x: 10, y: 0 }, { x: 0, y: NaN }, O)).toBe(0);
    expect(stirDelta({ x: 10, y: 0 }, { x: 0, y: 10 }, { x: NaN, y: 0 })).toBe(0);
  });

  it('returns 0 for non-finite coordinates such as Infinity', () => {
    expect(stirDelta({ x: Infinity, y: 0 }, { x: 0, y: 10 }, O)).toBe(0);
  });

  it('measures about a non-origin centre', () => {
    const c = { x: 100, y: 50 };
    expect(stirDelta({ x: 110, y: 50 }, { x: 100, y: 60 }, c)).toBeCloseTo(0.25, 12);
  });
});

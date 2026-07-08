import { describe, it, expect } from 'vitest';
import {
  seatAngle,
  polarToXY,
} from '../src/terminal/views/manifesto/councilRingMath.js';

describe('seatAngle', () => {
  it('places canon seats in the western (left) hemisphere', () => {
    for (let i = 0; i < 8; i++) {
      const a = seatAngle(i, 'canon');
      expect(a).toBeGreaterThan(180);
      expect(a).toBeLessThan(360);
    }
  });

  it('places sidelined seats in the eastern (right) hemisphere', () => {
    for (let i = 0; i < 8; i++) {
      const a = seatAngle(i, 'sidelined');
      expect(a).toBeGreaterThan(0);
      expect(a).toBeLessThan(180);
    }
  });

  it('spaces 8 seats evenly by 20° within a hemisphere', () => {
    const a0 = seatAngle(0, 'sidelined');
    const a1 = seatAngle(1, 'sidelined');
    expect(a1 - a0).toBeCloseTo(20, 5);
  });
});

describe('polarToXY', () => {
  it('maps 0° to straight up (top of circle)', () => {
    const { x, y } = polarToXY(0, 100, 200, 200);
    expect(x).toBeCloseTo(200, 5);
    expect(y).toBeCloseTo(100, 5); // 200 - 100, y grows downward
  });

  it('maps 90° to the right (east)', () => {
    const { x, y } = polarToXY(90, 100, 200, 200);
    expect(x).toBeCloseTo(300, 5);
    expect(y).toBeCloseTo(200, 5);
  });
});

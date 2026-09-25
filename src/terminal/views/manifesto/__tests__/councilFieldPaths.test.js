import { describe, it, expect } from 'vitest';
import raw from '../useCouncilCollider.js?raw';
import { polarToXY, seatAngle } from '../councilRingMath';
import { infallArmPoint, jetHead, seatAngleFromXY } from '../councilFieldUniforms';

const ANGLES = [...Array(8)].flatMap((_, i) => [seatAngle(i, 'canon'), seatAngle(i, 'sidelined')]);

describe('GL paths mirror the 2D collider exactly (spec §7.6, §7.8, §10.3)', () => {
  it('tripwire: the 2D formulas mirrored below are still the ones in the loop', () => {
    for (const line of [
      'const R_FOUNDATION = 150, R_SEAT = 220, R_CEILING = 290;',
      'const SPIRAL_GAIN = 0.9;',
      'const easeInCubic = (t) => t * t * t;',
      'const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);',
      'delay: jitter(s * streamN + i, sim.ordinal) * 900,',
      'wobble: (jitter(s * streamN + i + 500, sim.ordinal) - 0.5) * 14,',
      'const r = R_SEAT * (1 - easeInCubic(prog));',
      '+ (SPIRAL_GAIN * 180 / Math.PI) * (1 - r / R_SEAT);',
      'const r = sim.product.targetR * easeOutCubic(prog);',
      'const { x, y } = polarToXY(sim.product.angle, r, CX, CY);',
    ]) {
      expect(raw).toContain(line);
    }
  });

  it('infall arm centreline matches the 2D particle path (wobble 0) to 1e-6 u, all 16 seats', () => {
    for (const angle of ANGLES) {
      const seat = polarToXY(angle, 220, 320, 320);
      const derived = seatAngleFromXY(seat.x, seat.y); // the shader derives it this way
      for (let k = 0; k <= 20; k++) {
        const prog = k / 20;
        const r = 220 * (1 - prog ** 3);                              // the 2D loop, verbatim
        const theta = angle + 0 * prog + ((0.9 * 180) / Math.PI) * (1 - r / 220);
        const want = polarToXY(theta, r, 320, 320);
        const got = infallArmPoint(derived, prog);
        expect(Math.abs(got.x - want.x)).toBeLessThan(1e-6);
        expect(Math.abs(got.y - want.y)).toBeLessThan(1e-6);
      }
    }
  });

  it('jet head sits on the 2D product dot to 1e-6 u', () => {
    for (const angle of ANGLES) {
      for (const targetR of [150, 318]) {
        for (const t of [0, 0.3, 0.77, 1]) {
          const eject = [((angle - 90) * Math.PI) / 180, targetR, 1];
          const want = polarToXY(angle, targetR * (1 - Math.pow(1 - t, 3)), 320, 320);
          const got = jetHead(eject, t);
          expect(Math.abs(got.x - want.x)).toBeLessThan(1e-6);
          expect(Math.abs(got.y - want.y)).toBeLessThan(1e-6);
        }
      }
    }
  });
});

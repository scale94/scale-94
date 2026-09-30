import { describe, it, expect } from 'vitest';
import {
  ORBIT_RADIUS, ORBIT_NODES, PRECESSION_RATE, PRECESSION_DRIFT, orbitPrecessionAngle, nodeWorldPosition,
} from '../orbitNodes';
import { ELEMENTS } from '../elements';

describe('orbitNodes', () => {
  it('keeps the four element nodes in their cardinal places', () => {
    expect(ORBIT_NODES.map((n) => [n.phase, n.angle])).toEqual([
      ['air', Math.PI / 2], ['thermal', 0], ['earth', -Math.PI / 2], ['fluid', Math.PI],
    ]);
    for (const n of ORBIT_NODES) expect(n.color).toBe(ELEMENTS[n.phase].color);
  });

  it('precesses at PRECESSION_RATE and adds PRECESSION_DRIFT per full turn', () => {
    expect(orbitPrecessionAngle(0)).toBe(0);
    expect(orbitPrecessionAngle(10)).toBeCloseTo(PRECESSION_RATE * 10, 12);
    const turn = (2 * Math.PI) / PRECESSION_RATE;
    expect(orbitPrecessionAngle(turn + 1)).toBeCloseTo(PRECESSION_DRIFT + PRECESSION_RATE, 9);
  });

  it('places a node on the ring, rotated by the precession (ring rotation.z)', () => {
    const [x, y, z] = nodeWorldPosition(0, Math.PI / 2);
    expect(x).toBeCloseTo(0, 12);
    expect(y).toBeCloseTo(ORBIT_RADIUS, 12);
    expect(z).toBe(0);
  });
});

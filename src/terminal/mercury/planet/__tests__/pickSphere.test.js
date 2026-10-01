import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { pickSphereDir } from '../pickSphere';

function cam() {
  const c = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  c.position.set(0, 0, 3.6);
  c.lookAt(0, 0, 0);
  c.updateMatrixWorld();
  c.updateProjectionMatrix();
  return c;
}

describe('pickSphereDir', () => {
  it('the screen centre touches the front pole', () => {
    const d = pickSphereDir([0, 0], cam(), 0.75);
    expect(d[0]).toBeCloseTo(0, 9);
    expect(d[1]).toBeCloseTo(0, 9);
    expect(d[2]).toBeCloseTo(1, 9);
  });

  it('off-centre hits are unit, on the near side, on the pointer side; misses are null', () => {
    const d = pickSphereDir([0.2, -0.1], cam(), 0.75);
    expect(Math.hypot(...d)).toBeCloseTo(1, 12);
    expect(d[2]).toBeGreaterThan(0);
    expect(d[0]).toBeGreaterThan(0);
    expect(d[1]).toBeLessThan(0);
    expect(pickSphereDir([0.9, 0.9], cam(), 0.75)).toBeNull();
  });
});

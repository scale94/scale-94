import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { pointerOmega, createDragTracker, DRAG_RAD_PER_HEIGHT, POINTER_HOLD_MS, MIN_POINTER_DT_S } from '../mercuryDrag';

describe('pointerOmega', () => {
  it('a full-height drag in one second spins DRAG_RAD_PER_HEIGHT rad/s', () => {
    expect(pointerOmega(0, 800, 1, 800)).toEqual([DRAG_RAD_PER_HEIGHT, 0, 0]);
    expect(pointerOmega(800, 0, 1, 800)).toEqual([0, DRAG_RAD_PER_HEIGHT, 0]);
  });

  it('dragging right moves the front surface right; dragging down moves it down', () => {
    const front = new THREE.Vector3(0, 0, 1);
    const [, wy] = pointerOmega(10, 0, 0.1, 800);
    const right = front.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), wy * 0.01);
    expect(right.x).toBeGreaterThan(0);
    const [wx] = pointerOmega(0, 10, 0.1, 800);
    const down = front.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), wx * 0.01);
    expect(down.y).toBeLessThan(0);
  });

  it('floors dt so coalesced events cannot explode', () => {
    expect(pointerOmega(0, 10, 0, 800)[0]).toBeCloseTo((10 * DRAG_RAD_PER_HEIGHT) / 800 / MIN_POINTER_DT_S, 9);
  });
});

describe('createDragTracker', () => {
  it('idle → not dragging, zero ω', () => {
    expect(createDragTracker().sample(0)).toEqual({ dragging: false, omegaPtr: [0, 0, 0] });
  });

  it('down/move reports the pointer ω; up releases', () => {
    const d = createDragTracker();
    d.down(100, 100, 0);
    d.move(180, 100, 100, 800);
    const s = d.sample(110);
    expect(s.dragging).toBe(true);
    expect(s.omegaPtr[1]).toBeCloseTo((80 * DRAG_RAD_PER_HEIGHT) / 800 / 0.1, 9);
    d.up();
    expect(d.sample(120)).toEqual({ dragging: false, omegaPtr: [0, 0, 0] });
  });

  it('a held, unmoving pointer grips at zero ω', () => {
    const d = createDragTracker();
    d.down(0, 0, 0);
    d.move(50, 0, 16, 800);
    expect(d.sample(16 + POINTER_HOLD_MS + 1)).toEqual({ dragging: true, omegaPtr: [0, 0, 0] });
  });

  it('move without down is ignored', () => {
    const d = createDragTracker();
    d.move(50, 0, 16, 800);
    expect(d.sample(20)).toEqual({ dragging: false, omegaPtr: [0, 0, 0] });
  });
});

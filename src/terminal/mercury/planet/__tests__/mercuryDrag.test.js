import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { pointerOmega, createDragTracker, DRAG_RAD_PER_HEIGHT, POINTER_HOLD_MS, PTR_WINDOW_MS } from '../mercuryDrag';

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

  it('two events with identical timestamps never produce a non-finite or exploded ω', () => {
    const d = createDragTracker();
    const trueOmega = (DRAG_RAD_PER_HEIGHT / 740) * 600;
    d.down(0, 0, 0);
    let x = 0;
    for (let t = 1000 / 60; t <= 200; t += 1000 / 60) {
      x = (600 * t) / 1000;
      d.move(x - 5, 0, t, 740);
      d.move(x, 0, t, 740); // duplicate timestamp
      const w = d.sample(t).omegaPtr[1];
      expect(Number.isFinite(w)).toBe(true);
      expect(Math.abs(w)).toBeLessThanOrEqual(trueOmega * 1.05);
    }
  });
});

describe('createDragTracker', () => {
  it('idle → not dragging, zero ω', () => {
    expect(createDragTracker().sample(0)).toMatchObject({ dragging: false, omegaPtr: [0, 0, 0] });
  });

  it('down/move reports the pointer ω; up releases', () => {
    const d = createDragTracker();
    d.down(100, 100, 0);
    d.move(180, 100, 100, 800);
    const s = d.sample(110);
    expect(s.dragging).toBe(true);
    expect(s.omegaPtr[1]).toBeCloseTo((80 * DRAG_RAD_PER_HEIGHT) / 800 / 0.1, 9);
    d.up();
    expect(d.sample(120)).toMatchObject({ dragging: false, omegaPtr: [0, 0, 0] });
  });

  it('a held, unmoving pointer grips at zero ω', () => {
    const d = createDragTracker();
    d.down(0, 0, 0);
    d.move(50, 0, 16, 800);
    expect(d.sample(16 + POINTER_HOLD_MS + 1)).toMatchObject({ dragging: true, omegaPtr: [0, 0, 0] });
  });

  it('move without down is ignored', () => {
    const d = createDragTracker();
    d.move(50, 0, 16, 800);
    expect(d.sample(20)).toMatchObject({ dragging: false, omegaPtr: [0, 0, 0] });
  });

  it('same hand speed gives the same ω at 60 Hz and 360 Hz event spacing', () => {
    const run = (hz) => {
      const d = createDragTracker();
      d.down(0, 0, 0);
      const step = 1000 / hz;
      for (let t = step; t <= 200 + 1e-9; t += step) d.move((600 * t) / 1000, 0, t, 740);
      return d.sample(200).omegaPtr[1];
    };
    const expected = (DRAG_RAD_PER_HEIGHT / 740) * 600;
    const a = run(60);
    const b = run(360);
    expect(Math.abs(a - b) / expected).toBeLessThan(0.02);
    expect(Math.abs(b - expected) / expected).toBeLessThan(0.02);
    expect(Math.abs(a - expected) / expected).toBeLessThan(0.02);
  });

  it('sample() returns the same object on consecutive calls', () => {
    const d = createDragTracker();
    expect(d.sample(0)).toBe(d.sample(1));
  });
});

describe('drag point and release', () => {
  it('remembers the last aim and latches one release per drag', () => {
    const d = createDragTracker();
    expect(d.sample(0).aimed).toBe(false);
    d.down(0, 0, 0);
    d.aim(0.25, -0.5);
    let s = d.sample(1);
    expect(s.aimed).toBe(true);
    expect(s.ndc).toEqual([0.25, -0.5]);
    expect(s.released).toBe(false);
    d.up();
    expect(d.sample(2).released).toBe(true);
    expect(d.sample(3).released).toBe(false);
    d.up(); // a stray up with no drag is not a release
    expect(d.sample(4).released).toBe(false);
  });
});

describe('release pointer ω (phase 6 trigger)', () => {
  const H = 800;
  it('is the pointer ω over the last PTR_WINDOW_MS before release, reported once on the release frame', () => {
    const d = createDragTracker();
    d.down(0, 0, 0);
    for (let t = 10; t <= 200; t += 10) d.move(3 * t, 0, t, H); // 3 px/ms
    d.up(200);
    const r = d.sample(201);
    expect(r.released).toBe(true);
    expect(r.releaseOmegaPtr).toBeCloseTo((DRAG_RAD_PER_HEIGHT / H) * 3000, 6);
    expect(d.sample(202).releaseOmegaPtr).toBe(0);
  });

  it('only the last window counts: a slow drag ending in a fast flick reads the flick', () => {
    const d = createDragTracker();
    d.down(0, 0, 0);
    for (let t = 10; t <= 300; t += 10) d.move(0.5 * t, 0, t, H);
    for (let t = 310; t <= 300 + PTR_WINDOW_MS; t += 10) d.move(150 + 4 * (t - 300), 0, t, H);
    d.up(300 + PTR_WINDOW_MS);
    expect(d.sample(400).releaseOmegaPtr).toBeCloseTo((DRAG_RAD_PER_HEIGHT / H) * 4000, 6);
  });

  it('a long drag wraps the sample ring and reads exactly its newest window (1 kHz and 2 kHz pointers)', () => {
    // an accelerating flick, so a window that starts one sample off reads a different speed
    const x = (t) => (t < 190 ? 0.5 * t : 95 + 0.04 * (t - 190) ** 2);
    for (const dtMs of [1, 0.5]) {
      const d = createDragTracker();
      d.down(0, 0, 0);
      for (let i = 1; i * dtMs <= 250; i++) d.move(x(i * dtMs), 0, i * dtMs, H); // 250-500 samples: the 64-slot ring wraps
      d.up(250);
      // the oldest sample kept: PTR_WINDOW_MS back, or the ring's 64th-newest when 64 samples span less (2 kHz: 31.5 ms)
      const tO = Math.max(250 - PTR_WINDOW_MS, 250 - 63 * dtMs);
      const pxPerMs = (x(250) - x(tO)) / (250 - tO);
      expect(d.sample(251).releaseOmegaPtr, `dt ${dtMs} ms`).toBeCloseTo((DRAG_RAD_PER_HEIGHT / H) * 1000 * pxPerMs, 6);
    }
  });

  it('a pointer held still past POINTER_HOLD_MS before letting go reads 0', () => {
    const d = createDragTracker();
    d.down(0, 0, 0);
    for (let t = 10; t <= 100; t += 10) d.move(3 * t, 0, t, H);
    d.up(100 + POINTER_HOLD_MS + 1);
    expect(d.sample(300).releaseOmegaPtr).toBe(0);
  });

  it('a tap with no move reads 0, and up() without a time still works', () => {
    const d = createDragTracker();
    d.down(5, 5, 0);
    d.up();
    const r = d.sample(10);
    expect(r.released).toBe(true);
    expect(r.releaseOmegaPtr).toBe(0);
  });
});

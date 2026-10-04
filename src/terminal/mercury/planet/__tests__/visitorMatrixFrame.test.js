import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createVisitors, createVisitorOut, launchVisitor, T_FLIGHT, EMBER_BODY_S, ROCK_R, COLLAR_H, PLUME_LEN, PLUME_W,
  SURF_FROST, SURF_POOL, SURF_COLLAR, SURF_JET, frostRadius, poolRadius, poolFreeze, hotTempK,
} from '../visitorSim';
import { createVisitorFrame, packVisitors, seedFrac, VIS_EMBER, VIS_ROCK, VIS_PLUME } from '../visitorFrame';
import { ctxFor, runTo } from './visitorTestKit';

function viewOf() {
  const cam = new THREE.PerspectiveCamera(40, 1.6, 0.1, 100);
  cam.position.set(0, 0, 3.6); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const m = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  return { vp: new Float32Array(m.elements), p00: cam.projectionMatrix.elements[0], p11: cam.projectionMatrix.elements[5], wPx: 1600, hPx: 1000 };
}

// Land one visitor and run it to `a` s after its touchdown; pack.
function packedAt(phase, tempK, tau, a) {
  const buf = createVisitors();
  const ctx = ctxFor(phase, tempK);
  ctx.tau = tau;
  const v = launchVisitor(buf, phase, ctx);
  runTo(buf, ctx, createVisitorOut(), T_FLIGHT[phase] + ctx.dt);
  runTo(buf, ctx, createVisitorOut(), v.tImpact + a);
  const f = packVisitors(buf, ctx, viewOf(), createVisitorFrame());
  return { v, f, ctx, age: ctx.tS - v.tImpact };
}

describe('visitorFrame — the matrix slots and bodies', () => {
  it('a creeping frost: one SURF_FROST slot at its live radius, no body', () => {
    const { v, f, age } = packedAt('fluid', 200, 1, 0.75);
    expect(f.n).toBe(0);
    expect(f.nSurf).toBe(1);
    expect(f.surfDir[3]).toBe(SURF_FROST);
    expect(f.surfA[0]).toBeCloseTo(frostRadius(age), 6);
    expect(f.surfA[2]).toBeCloseTo(seedFrac(v.seed), 3);
    expect(f.surfA[3]).toBe(1);
  });
  it('a growing pool: SURF_POOL at its radius, still liquid, its ember glowing in it', () => {
    const { f, age } = packedAt('thermal', 200, 1, 1);
    expect(f.surfDir[3]).toBe(SURF_POOL);
    expect(f.surfA[0]).toBeCloseTo(poolRadius(age), 6);
    expect(f.surfA[1]).toBe(0);
    expect(f.surfA[2]).toBeCloseTo(hotTempK(age), 3);
    expect(f.n).toBe(1);
    expect(f.k[0]).toBe(VIS_EMBER);
  });
  it('a refreezing pool: the ember is gone, the pool part frozen', () => {
    const { f, age } = packedAt('thermal', 200, 1, 3.5);
    expect(age).toBeGreaterThan(EMBER_BODY_S);
    expect(f.n).toBe(0);
    expect(f.surfA[1]).toBeCloseTo(poolFreeze(age), 6);
    expect(f.surfA[1]).toBeGreaterThan(0);
    expect(f.surfA[1]).toBeLessThan(1);
  });
  it('a sinking rock: the rock body and a crust collar', () => {
    const { f, ctx } = packedAt('earth', 400, 0.3, 2);
    expect(f.n).toBe(1);
    expect(f.k[0]).toBe(VIS_ROCK);
    expect(f.surfDir[3]).toBe(SURF_COLLAR);
    expect(f.surfA[0]).toBeCloseTo(ROCK_R / ctx.coreR, 9);
    expect(f.surfA[1]).toBeCloseTo(COLLAR_H, 9);
  });
  it('a strip: a vapour plume lifting downwind, and the gust slot', () => {
    const { v, f } = packedAt('air', 700, 1, 0.5);
    expect(f.n).toBe(1);
    expect(f.k[0]).toBe(VIS_PLUME);
    expect(f.k[3]).toBe(0); // Hg vapour keeps the plume's own look (plan Q-1)
    expect(f.vis[3]).toBeCloseTo(PLUME_W, 9);
    const ax = [f.ax[0], f.ax[1], f.ax[2]];
    expect(Math.hypot(...ax)).toBeCloseTo(1, 5);
    expect(ax[0] * v.dirWorld[0] + ax[1] * v.dirWorld[1] + ax[2] * v.dirWorld[2]).toBeGreaterThan(0);
    expect(f.ax[3]).toBeGreaterThan(0);
    expect(f.ax[3]).toBeLessThanOrEqual(PLUME_LEN + 1e-9);
    expect(f.surfDir[3]).toBe(SURF_JET);
    expect(f.visible).toBe(true);
  });
});

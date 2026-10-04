import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createVisitors, createVisitorOut, launchVisitor, T_FLIGHT, EMBER_BODY_S, QUENCH_STEAM_LEN, QUENCH_STEAM_GROW_S,
  RESIDENT_LIFE_S, SURF_QUENCH, SURF_POOL, quenchRadius, poolRadius, poolFreeze, hotTempK,
} from '../visitorSim';
import { createVisitorFrame, packVisitors, seedFrac, VIS_EMBER, VIS_PLUME, PLUME_STEAM } from '../visitorFrame';
import { ctxFor, runTo } from './visitorTestKit';

function viewOf() {
  const cam = new THREE.PerspectiveCamera(40, 1.6, 0.1, 100);
  cam.position.set(0, 0, 3.6); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const m = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  return { vp: new Float32Array(m.elements), p00: cam.projectionMatrix.elements[0], p11: cam.projectionMatrix.elements[5], wPx: 1600, hPx: 1000 };
}

function packedOnCrust(phase, a) {
  const buf = createVisitors();
  const ctx = ctxFor(phase, 400);
  ctx.tau = 0;
  const v = launchVisitor(buf, phase, ctx);
  runTo(buf, ctx, createVisitorOut(), T_FLIGHT[phase] + ctx.dt);
  runTo(buf, ctx, createVisitorOut(), v.tImpact + a);
  const f = packVisitors(buf, ctx, viewOf(), createVisitorFrame());
  return { v, f, ctx, age: ctx.tS - v.tImpact };
}

describe('visitorFrame — amendment A', () => {
  it('a spreading quench: one SURF_QUENCH slot at its live radius, full weight, seeded', () => {
    const { v, f, age } = packedOnCrust('fluid', 0.3);
    expect(f.nSurf).toBe(1);
    expect(f.surfDir[3]).toBe(SURF_QUENCH);
    expect(f.surfA[0]).toBeCloseTo(quenchRadius(age), 6);
    expect(f.surfA[1]).toBe(0);
    expect(f.surfA[2]).toBeCloseTo(seedFrac(v.seed), 3);
    expect(f.surfA[3]).toBe(1);
  });
  it('its steam: a vertical plume, grown, fading over the spread', () => {
    const { v, f, age } = packedOnCrust('fluid', 0.3);
    expect(f.n).toBe(1);
    expect(f.k[0]).toBe(VIS_PLUME);
    const ax = [f.ax[0], f.ax[1], f.ax[2]];
    const dot = ax[0] * v.dirWorld[0] + ax[1] * v.dirWorld[1] + ax[2] * v.dirWorld[2];
    expect(dot).toBeCloseTo(1, 5);
    expect(f.ax[3]).toBeCloseTo(QUENCH_STEAM_LEN * Math.min(1, age / QUENCH_STEAM_GROW_S), 6);
    expect(f.k[1]).toBeCloseTo(1 - age / RESIDENT_LIFE_S.quench, 5);
    expect(f.k[1]).toBeGreaterThan(0);
    expect(f.k[1]).toBeLessThan(1);
    expect(f.k[3]).toBe(PLUME_STEAM); // water steam, not Hg vapour (plan Q-1)
  });
  it('a crust pool packs like the frozen-Hg pool: its ember, then the refreezing SURF_POOL slot', () => {
    const early = packedOnCrust('thermal', 1);
    expect(early.f.n).toBe(1);
    expect(early.f.k[0]).toBe(VIS_EMBER);
    expect(early.f.surfDir[3]).toBe(SURF_POOL);
    expect(early.f.surfA[0]).toBeCloseTo(poolRadius(early.age), 6);
    expect(early.f.surfA[2]).toBeCloseTo(hotTempK(early.age), 3);
    expect(early.f.surfA[3]).toBe(1);
    const late = packedOnCrust('thermal', 3.5);
    expect(late.age).toBeGreaterThan(EMBER_BODY_S);
    expect(late.f.n).toBe(0);
    expect(late.f.surfA[1]).toBeCloseTo(poolFreeze(late.age), 6);
  });
});

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createVisitors, createVisitorOut, launchVisitor, filmRadius, filmThicknessNm, T_FLIGHT, VISIT_SURF_MAX,
  SURF_FILM, SURF_HOT, SURF_MENISCUS, SURF_JET, DROP_STRETCH_MAX, EMBER_BODY_S, ROCK_R } from '../visitorSim';
import { createVisitorFrame, packVisitors, VIS_DROP, VIS_EMBER, VIS_ROCK, VIS_GUST } from '../visitorFrame';
import { ctxFor, runTo } from './visitorTestKit';

function viewOf() {
  const cam = new THREE.PerspectiveCamera(40, 1.6, 0.1, 100);
  cam.position.set(0, 0, 3.6); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const m = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  return { vp: new Float32Array(m.elements), p00: cam.projectionMatrix.elements[0], p11: cam.projectionMatrix.elements[5], wPx: 1600, hPx: 1000, m };
}
const ndc = (view, p) => new THREE.Vector3(...p).applyMatrix4(view.m);

describe('visitorFrame', () => {
  it('nothing live: invisible, no surface slot', () => {
    const f = createVisitorFrame();
    f.surfA[3] = 1;
    packVisitors(createVisitors(), ctxFor('fluid'), viewOf(), f);
    expect(f.visible).toBe(false);
    expect(f.n).toBe(0);
    expect(f.nSurf).toBe(0);
    expect(f.surfA[3]).toBe(0);
  });
  it('a falling drop: one VIS_DROP stretched along its velocity, inside the rect', () => {
    const buf = createVisitors();
    const ctx = ctxFor('fluid');
    const v = launchVisitor(buf, 'fluid', ctx);
    runTo(buf, ctx, createVisitorOut(), 0.6);
    const view = viewOf();
    const f = packVisitors(buf, ctx, view, createVisitorFrame());
    expect(f.n).toBe(1);
    expect(f.k[0]).toBe(VIS_DROP);
    expect(f.ax[3]).toBeGreaterThan(0);
    expect(f.ax[3]).toBeLessThanOrEqual(DROP_STRETCH_MAX);
    const sp = Math.hypot(...v.vel);
    for (let k = 0; k < 3; k++) expect(f.ax[k]).toBeCloseTo(v.vel[k] / sp, 5);
    const c = ndc(view, v.pos);
    expect(c.x).toBeGreaterThan(f.rect[0]); expect(c.x).toBeLessThan(f.rect[2]);
    expect(c.y).toBeGreaterThan(f.rect[1]); expect(c.y).toBeLessThan(f.rect[3]);
    expect(f.visible).toBe(true);
  });
  it('an ember in flight trails its tail behind it; a gust carries its seed', () => {
    for (const [phase, code] of [['thermal', VIS_EMBER], ['air', VIS_GUST]]) {
      const buf = createVisitors();
      const ctx = ctxFor(phase);
      const v = launchVisitor(buf, phase, ctx);
      runTo(buf, ctx, createVisitorOut(), 0.4);
      const f = packVisitors(buf, ctx, viewOf(), createVisitorFrame());
      expect(f.k[0]).toBe(code);
      expect(f.ax[0] * v.vel[0] + f.ax[1] * v.vel[1] + f.ax[2] * v.vel[2]).toBeLessThan(0);
      expect(f.ax[3]).toBeGreaterThan(0);
    }
  });
  it('a film is a surface slot only: world dir, radius, thickness, age, fade', () => {
    const buf = createVisitors();
    const ctx = ctxFor('fluid', 400);
    const v = launchVisitor(buf, 'fluid', ctx);
    runTo(buf, ctx, createVisitorOut(), T_FLIGHT.fluid + 2);
    const f = packVisitors(buf, ctx, viewOf(), createVisitorFrame());
    const a = ctx.tS - v.tImpact;
    expect(f.n).toBe(0);
    expect(f.nSurf).toBe(1);
    expect(f.surfDir[3]).toBe(SURF_FILM);
    for (let k = 0; k < 3; k++) expect(f.surfDir[k]).toBeCloseTo(v.dirWorld[k], 6);
    expect(f.surfA[0]).toBeCloseTo(filmRadius(a), 6);
    expect(f.surfA[1]).toBeCloseTo(filmThicknessNm(a), 3);
    expect(f.surfA[3]).toBeCloseTo(v.fade, 6);
  });
  it('a floating rock: a body and its meniscus; flung off, the body stays and the meniscus goes', () => {
    const buf = createVisitors();
    const ctx = ctxFor('earth', 400);
    launchVisitor(buf, 'earth', ctx);
    runTo(buf, ctx, createVisitorOut(), T_FLIGHT.earth + 1);
    let f = packVisitors(buf, ctx, viewOf(), createVisitorFrame());
    expect(f.k[0]).toBe(VIS_ROCK);
    expect(f.surfDir[3]).toBe(SURF_MENISCUS);
    expect(f.surfA[0]).toBeCloseTo(ROCK_R / ctx.coreR, 9);
    ctx.omega = [0, 8, 0]; ctx.detach = true;
    runTo(buf, ctx, createVisitorOut(), ctx.tS + ctx.dt);
    f = packVisitors(buf, ctx, viewOf(), createVisitorFrame());
    expect(f.n).toBe(1);
    expect(f.nSurf).toBe(0);
  });
  it('an ember: body until EMBER_BODY_S, its hot spot after', () => {
    const buf = createVisitors();
    const ctx = ctxFor('thermal', 400);
    launchVisitor(buf, 'thermal', ctx);
    runTo(buf, ctx, createVisitorOut(), T_FLIGHT.thermal + 1);
    let f = packVisitors(buf, ctx, viewOf(), createVisitorFrame());
    expect(f.k[0]).toBe(VIS_EMBER);
    expect(f.surfDir[3]).toBe(SURF_HOT);
    runTo(buf, ctx, createVisitorOut(), T_FLIGHT.thermal + EMBER_BODY_S + 0.1);
    f = packVisitors(buf, ctx, viewOf(), createVisitorFrame());
    expect(f.n).toBe(0);
    expect(f.surfDir[3]).toBe(SURF_HOT);
  });
  it('a gust slot carries its downwind direction in world space', () => {
    const buf = createVisitors();
    const ctx = ctxFor('air', 400);
    launchVisitor(buf, 'air', ctx);
    runTo(buf, ctx, createVisitorOut(), T_FLIGHT.air + 0.5);
    const f = packVisitors(buf, ctx, viewOf(), createVisitorFrame());
    expect(f.surfDir[3]).toBe(SURF_JET);
    expect(Math.hypot(f.surfB[0], f.surfB[1], f.surfB[2])).toBeCloseTo(1, 5);
    expect(f.surfA[1]).toBeGreaterThan(0);
  });
  it('more than VISIT_SURF_MAX candidates: the strongest (by fade) go first', () => {
    const buf = createVisitors();
    const ctx = ctxFor('fluid', 400);
    for (let i = 0; i < 6; i++) { launchVisitor(buf, i % 2 ? 'thermal' : 'fluid', ctx); ctx.tS += 0.4; }
    runTo(buf, ctx, createVisitorOut(), 7.6);
    const f = packVisitors(buf, ctx, viewOf(), createVisitorFrame());
    expect(f.nSurf).toBe(VISIT_SURF_MAX);
    for (let j = 1; j < VISIT_SURF_MAX; j++) expect(f.surfA[4 * j + 3]).toBeLessThanOrEqual(f.surfA[4 * (j - 1) + 3]);
  });
});

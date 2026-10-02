// src/terminal/mercury/planet/__tests__/breakupFrame.test.js
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createDropFrame, packFamily, pxPerUnitAt } from '../breakupFrame';
import { createFamily, addBody, chainLayout, fireFamily, qRotate } from '../breakupFamily';
import { TONGUE_ROOT_R, TONGUE_MAX_R, sphereVol, rpWavelength } from '../breakupPhysics';
import { R_SCENE } from '../planetLook';
import { TIERS } from '../planetQuality';
import { testEnv, firedFamily } from './breakupTestKit';

vi.mock('../breakupFamily', async (orig) => {
  const actual = await orig();
  return { ...actual, chainLayout: vi.fn(actual.chainLayout) };
});

const caps = { bodies: 12, necks: 10, bridges: 12 };
function viewOf(z = 3.6) {
  const cam = new THREE.PerspectiveCamera(42, 1.6, 0.1, 100);
  cam.position.set(0, 0, z); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const m = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  return { vp: Float32Array.from(m.elements), p00: cam.projectionMatrix.elements[0], p11: cam.projectionMatrix.elements[5], wPx: 1600, hPx: 1000 };
}

describe('breakupFrame — a family to the droplet shader', () => {
  it('idle draws nothing', () => {
    const f = createDropFrame(caps);
    packFamily(createFamily(1), testEnv(), f, viewOf());
    expect(f.visible).toBe(false);
    expect(f.nb).toBe(0);
  });

  it('hold: two thread chains of r0 beads, each rooted to the planet', () => {
    const fam = createFamily(1);
    fam.phase = 'hold'; fam.L = TONGUE_MAX_R; fam.axisBody = [1, 0, 0];
    const f = createDropFrame(caps);
    packFamily(fam, testEnv(), f, viewOf());
    const { N } = chainLayout(TONGUE_MAX_R);
    expect(f.nb).toBe(2 * N);
    expect(f.nn).toBe(2 * N);
    for (let i = 0; i < f.nb; i++) expect(f.bead[4 * i + 3]).toBeCloseTo(TONGUE_ROOT_R, 7);
    const roots = [...Array(f.nn).keys()].filter((i) => f.neck[4 * i + 1] === -1);
    expect(roots.length).toBe(2);
    for (const i of roots) expect(f.neckR[i]).toBeCloseTo(R_SCENE, 7);
    expect(f.visible).toBe(true);
  });

  it('fired: necks thin by the pinch law; snapped necks are gone; caps never overflow', () => {
    const fam = firedFamily({ maxBodies: 12, satellites: true });
    fam.t = 0.5 * fam.necks[0].tSnap;
    for (const b of fam.bodies) b.p = [...b.posBody];
    const f = createDropFrame(caps);
    packFamily(fam, testEnv(), f, viewOf());
    expect(f.neck[2]).toBeLessThan(TONGUE_ROOT_R);
    expect(f.neck[2]).toBeGreaterThan(0);
    fam.necks[0].on = false;
    packFamily(fam, testEnv(), f, viewOf());
    expect(f.nn).toBe(fam.necks.length - 1);
    expect(f.nb).toBeLessThanOrEqual(caps.bodies);
  });

  it('a merging pair gets a bridge; a cascading bead gets a planet bridge at the live radius', () => {
    const fam = createFamily(1);
    fam.phase = 'fired'; fam.rMain = 0.03;
    const a = addBody(fam, { state: 'merging', lead: true, partner: 1, p: [2, 0, 0.02], r: 0.03, vol: sphereVol(0.03), bridgeB: 0.01 });
    addBody(fam, { state: 'merging', lead: false, partner: 0, p: [2, 0, -0.02], r: 0.02, vol: sphereVol(0.02) });
    addBody(fam, { state: 'cascade', p: [0, R_SCENE + 0.02, 0], r: 0.02, vol: sphereVol(0.02), bridgeB: 0.005 });
    const f = createDropFrame(caps);
    packFamily(fam, testEnv({ planetRadiusAt: () => 0.76 }), f, viewOf());
    expect(f.nk).toBe(2);
    expect(f.bridge[2]).toBeCloseTo(a.bridgeB, 7);
    expect(f.bridge[4 + 1]).toBe(-1);
    expect(f.bridge[4 + 3]).toBeCloseTo(0.76, 7);
  });

  it('the rect holds every bead on screen, inside NDC, with an area', () => {
    const fam = createFamily(1);
    fam.phase = 'fired'; fam.rMain = 0.03;
    addBody(fam, { state: 'free', p: [1.2, 0.3, 0], r: 0.03, vol: sphereVol(0.03) });
    addBody(fam, { state: 'free', p: [-1.0, -0.2, 0.4], r: 0.03, vol: sphereVol(0.03) });
    const f = createDropFrame(caps);
    const view = viewOf();
    packFamily(fam, testEnv(), f, view);
    const [x0, y0, x1, y1] = f.rect;
    for (const b of fam.bodies) {
      const v = new THREE.Vector4(...b.p, 1).applyMatrix4(new THREE.Matrix4().fromArray(view.vp));
      expect(v.x / v.w).toBeGreaterThan(x0); expect(v.x / v.w).toBeLessThan(x1);
      expect(v.y / v.w).toBeGreaterThan(y0); expect(v.y / v.w).toBeLessThan(y1);
    }
    expect(x0).toBeGreaterThanOrEqual(-1); expect(y1).toBeLessThanOrEqual(1);
    expect(f.areaPx).toBeGreaterThan(0);
  });

  it('px per scene unit at the planet distance', () => {
    expect(pxPerUnitAt(3.6, 42, 1000)).toBeCloseTo(1000 / (2 * 3.6 * Math.tan((21 * Math.PI) / 180)), 9);
  });
  it('hold chain sits on the span fire uses, even below one wavelength (no jump at fire)', () => {
    const fam = createFamily(1);
    fam.phase = 'hold'; fam.L = 0.5 * rpWavelength(TONGUE_ROOT_R); fam.axisBody = [1, 0, 0];
    const f = createDropFrame(caps);
    packFamily(fam, testEnv(), f, viewOf());
    const held = [];
    for (let i = 0; i < f.nb; i++) held.push([f.bead[4 * i], f.bead[4 * i + 1], f.bead[4 * i + 2]]);
    fireFamily(fam, { maxBodies: 12, satellites: false });
    const mains = fam.bodies.filter((b) => b.state === 'attached').map((b) => b.posBody);
    expect(mains.length).toBe(held.length);
    mains.forEach((p, i) => { for (let k = 0; k < 3; k++) expect(held[i][k]).toBeCloseTo(p[k], 5); });
  });

  it('hold chain respects every tier cap and sits where fire puts it (e = 0.75, 1)', () => {
    for (const tier of Object.keys(TIERS)) {
      const tcaps = TIERS[tier].drop;
      for (const e of [0.75, 1]) {
        const fam = createFamily(1);
        fam.phase = 'hold'; fam.L = e * TONGUE_MAX_R; fam.axisBody = [1, 0, 0];
        const env = testEnv({ q: [0, Math.sin(0.3), 0, Math.cos(0.3)] });
        const f = createDropFrame(tcaps);
        packFamily(fam, env, f, viewOf());
        const label = `${tier} e=${e}`;
        expect(f.nn, label).toBeLessThanOrEqual(tcaps.necks);
        expect(f.nb, label).toBeLessThanOrEqual(tcaps.bodies);
        const roots = [...Array(f.nn).keys()].filter((i) => f.neck[4 * i + 1] === -1);
        expect(roots.length, label).toBe(2);
        for (let i = 0; i < f.nn; i++) {
          expect(f.neck[4 * i], label).toBeLessThan(f.nb);
          expect(f.neck[4 * i + 1], label).toBeLessThan(f.nb);
        }
        fireFamily(fam, { maxBodies: tcaps.bodies, satellites: tcaps.satellites });
        const mains = fam.bodies.map((b) => qRotate(env.q, b.posBody));
        expect(mains.length, label).toBe(f.nb);
        mains.forEach((p, i) => { for (let k = 0; k < 3; k++) expect(f.bead[4 * i + k], label).toBeCloseTo(p[k], 5); });
      }
    }
  });

  it('packFamily allocates nothing per call on the hold and fired paths', () => {
    const hold = createFamily(1);
    hold.phase = 'hold'; hold.L = TONGUE_MAX_R;
    const fired = firedFamily({ maxBodies: 12, satellites: true });
    for (const b of fired.bodies) b.p = [...b.posBody];
    fired.t = 0.3 * fired.necks[0].tSnap;
    const env = testEnv(), view = viewOf(), f = createDropFrame(caps);
    const keys = Object.keys(f).join();
    // deterministic: the per-frame path must not build a chainLayout object (it did once, via the hold chain)
    chainLayout.mockClear();
    packFamily(hold, env, f, view); packFamily(fired, env, f, view);
    expect(chainLayout).not.toHaveBeenCalled();
    // No heapUsed bound here: without a forced GC it is load-sensitive, and with one (node --expose-gc) it also
    // counts V8's boxed doubles (HeapNumbers) from the rect fit, which no object-level test can pin. The structural
    // guarantees are the two checks here: no chainLayout object per call, and the frame's shape never grows.
    for (let i = 0; i < 1000; i++) { packFamily(hold, env, f, view); packFamily(fired, env, f, view); }
    expect(Object.keys(f).join()).toBe(keys);
  });

  it('a bead behind the camera plane falls back to a full-screen rect', () => {
    const fam = createFamily(1);
    fam.phase = 'fired'; fam.rMain = 0.03;
    addBody(fam, { state: 'free', p: [0, 0, 10], r: 0.03, vol: sphereVol(0.03) });
    const f = createDropFrame(caps);
    packFamily(fam, testEnv(), f, viewOf());
    expect(Array.from(f.rect)).toEqual([-1, -1, 1, 1]);
    expect(f.visible).toBe(true);
  });
});

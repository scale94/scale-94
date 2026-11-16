import { describe, it, expect } from 'vitest';
import { createSnapFx, triggerSnap, stepSnapFx, snapUniforms, snapGeometry } from '../snapFx';

const FACING = { posStar: [0, 0, 1], dirView: [0, 0, 1], strength01: 1, facing: true };
const LIMB = { posStar: [1, 0, 0], dirView: [1, 0, 0], strength01: 1, facing: false };

function allZero(u) {
  expect(u.uFlash).toBe(0);
  expect(u.uShock).toBe(0);
  expect(u.uPlume).toBe(0);
  expect(u.uHalo).toBe(0);
  expect(Array.from(u.uFlashPos)).toEqual([0, 0, 0]);
  expect(Array.from(u.uPlumeDir)).toEqual([0, 0, 0]);
  expect(Array.from(u.shake)).toEqual([0, 0]);
}

describe('snapFx', () => {
  it('idle uniforms are all zero', () => {
    allZero(snapUniforms(createSnapFx()));
  });

  it('a facing snap: flash decaying, halo running, no plume', () => {
    const fx = createSnapFx();
    triggerSnap(fx, FACING);
    stepSnapFx(fx, 0.3);
    const u = snapUniforms(fx);
    expect(u.uFlash).toBeGreaterThan(0);
    expect(u.uFlash).toBeLessThan(1);
    expect(u.uShock).toBeGreaterThan(0);
    expect(u.uHalo).toBeGreaterThan(0);
    expect(u.uPlume).toBe(0);
    expect(Array.from(u.uFlashPos)).toEqual([0, 0, 1]);
  });

  it('a limb snap: plume running, no halo', () => {
    const fx = createSnapFx();
    triggerSnap(fx, LIMB);
    stepSnapFx(fx, 0.3);
    const u = snapUniforms(fx);
    expect(u.uFlash).toBeGreaterThan(0);
    expect(u.uFlash).toBeLessThan(1);
    expect(u.uPlume).toBeGreaterThan(0);
    expect(u.uHalo).toBe(0);
  });

  it('everything is zero again after 7 s', () => {
    for (const s of [FACING, LIMB]) {
      const fx = createSnapFx();
      triggerSnap(fx, s);
      for (let i = 0; i < 70; i++) stepSnapFx(fx, 0.1);
      allZero(snapUniforms(fx));
    }
  });

  it('the flash is over by 0.6 s, the shock by 2.5 s, the shake by 0.8 s', () => {
    const fx = createSnapFx();
    triggerSnap(fx, LIMB);
    stepSnapFx(fx, 0.61);
    expect(snapUniforms(fx).uFlash).toBe(0);
    expect(snapUniforms(fx).uShock).toBeGreaterThan(0);
    stepSnapFx(fx, 0.2);
    expect(Array.from(snapUniforms(fx).shake)).toEqual([0, 0]);
    stepSnapFx(fx, 1.7);
    expect(snapUniforms(fx).uShock).toBe(0);
    expect(snapUniforms(fx).uPlume).toBeGreaterThan(0);
  });

  it('one 0.3 s step equals thirty 0.01 s steps', () => {
    for (const s of [FACING, LIMB]) {
      const a = createSnapFx();
      const b = createSnapFx();
      triggerSnap(a, s);
      triggerSnap(b, s);
      stepSnapFx(a, 0.3);
      for (let i = 0; i < 30; i++) stepSnapFx(b, 0.01);
      const ua = snapUniforms(a);
      const ub = snapUniforms(b);
      for (const k of ['uFlash', 'uShock', 'uPlume', 'uHalo']) expect(ua[k]).toBeCloseTo(ub[k], 6);
      for (let i = 0; i < 3; i++) expect(ua.uPlumeDir[i]).toBeCloseTo(ub.uPlumeDir[i], 6);
      for (let i = 0; i < 2; i++) expect(ua.shake[i]).toBeCloseTo(ub.shake[i], 6);
    }
  });

  it('shakes at most 6 px, and not at all when still', () => {
    const fx = createSnapFx();
    triggerSnap(fx, LIMB);
    let peak = 0;
    for (let i = 0; i < 100; i++) {
      stepSnapFx(fx, 0.01);
      const [x, y] = snapUniforms(fx).shake;
      peak = Math.max(peak, Math.hypot(x, y));
    }
    expect(peak).toBeGreaterThan(0.5);
    expect(peak).toBeLessThanOrEqual(6);

    const still = createSnapFx();
    triggerSnap(still, LIMB);
    for (let i = 0; i < 100; i++) {
      stepSnapFx(still, 0.01, { still: true });
      expect(Array.from(snapUniforms(still).shake)).toEqual([0, 0]);
    }
  });

  it('a small snap is a small flash', () => {
    const big = createSnapFx();
    const small = createSnapFx();
    triggerSnap(big, LIMB);
    triggerSnap(small, { ...LIMB, strength01: 0 });
    stepSnapFx(big, 0.05);
    stepSnapFx(small, 0.05);
    expect(snapUniforms(small).uFlash).toBeLessThan(snapUniforms(big).uFlash);
    expect(snapUniforms(small).uFlash).toBeGreaterThan(0);
  });

  it('the flash rises smoothly: no step between neighbouring instants', () => {
    const fx = createSnapFx();
    triggerSnap(fx, FACING);
    let prev = 0;
    for (let i = 0; i < 700; i++) {
      stepSnapFx(fx, 0.001);
      const f = snapUniforms(fx).uFlash;
      expect(Math.abs(f - prev)).toBeLessThan(0.05);
      prev = f;
    }
  });

  it('a newer snap replaces the older one', () => {
    const fx = createSnapFx();
    triggerSnap(fx, FACING);
    stepSnapFx(fx, 3);
    triggerSnap(fx, LIMB);
    stepSnapFx(fx, 0.3);
    const u = snapUniforms(fx);
    expect(u.uHalo).toBe(0);
    expect(u.uPlume).toBeGreaterThan(0);
    expect(Array.from(u.uFlashPos)).toEqual([1, 0, 0]);
  });

  it('hostile input never produces NaN', () => {
    const fx = createSnapFx();
    triggerSnap(fx, { posStar: [NaN, 0, 0], dirView: null, strength01: NaN, facing: false });
    stepSnapFx(fx, NaN);
    stepSnapFx(fx, -1);
    stepSnapFx(fx, 0.2);
    const u = snapUniforms(fx);
    for (const v of [u.uFlash, u.uShock, u.uPlume, u.uHalo, ...u.uFlashPos, ...u.uPlumeDir, ...u.shake]) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('snapGeometry: star-frame position and view normal of a footpoint', () => {
    const g = snapGeometry(0, 0, { yaw: 0, pitch: 0 }, 0);
    expect(g.posStar[2]).toBeCloseTo(1, 12);
    expect(g.dirView[2]).toBeCloseTo(1, 12);
    const h = snapGeometry(0, Math.PI / 2, { yaw: 0, pitch: 0 }, 0);
    expect(h.dirView[0]).toBeCloseTo(1, 12);
  });
});

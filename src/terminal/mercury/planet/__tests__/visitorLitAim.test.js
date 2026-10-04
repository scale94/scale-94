import { describe, it, expect } from 'vitest';
import { createVisitors, launchVisitor, aimToward, litAim, AIM_MAX_RAD, LIT_AIM_MIN_SUN_COS } from '../visitorSim';
import { strikeDirWorld } from '../mercuryImpacts';
import { SUN_DIR_WORLD } from '../planetFrame';
import { ctxFor } from './visitorTestKit';

const len = (v) => Math.hypot(v[0], v[1], v[2]);
const dot = (a, b) => (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (len(a) * len(b));
const ang = (a, b) => Math.acos(Math.min(1, dot(a, b)));
const unit = (v) => { const l = len(v); return [v[0] / l, v[1] / l, v[2] / l]; };
const CAM = [0, 0, 3.6];
const FLOOR = LIT_AIM_MIN_SUN_COS;

// The landing the plain aim gives (no lit bias), for comparison.
function plainAim(ctx) {
  const d = [0, 0, 0];
  strikeDirWorld(ctx.nodePos, ctx.cam, d);
  return aimToward(d, ctx.cam, AIM_MAX_RAD);
}

describe('visitors matrix A6 — fire on crust lands in the sunlit part of the aim cone (author ruling)', () => {
  it('the floor is the sun ~24 degrees above the local horizon', () => {
    expect(FLOOR).toBe(0.4);
  });

  it('leaves an already-lit landing unchanged', () => {
    const d = unit([-0.3, 0.1, 0.9]);
    expect(dot(d, SUN_DIR_WORLD)).toBeGreaterThanOrEqual(FLOOR);
    const want = [...d];
    litAim(d, CAM, SUN_DIR_WORLD, AIM_MAX_RAD, FLOOR);
    expect(d).toEqual(want);
  });

  it('moves a terminator landing to the floor, staying inside the cone', () => {
    const d = [Math.sin(AIM_MAX_RAD), 0, Math.cos(AIM_MAX_RAD)];  // the cone's east edge: sun dot ≈ 0
    expect(dot(d, SUN_DIR_WORLD)).toBeLessThan(FLOOR);
    litAim(d, CAM, SUN_DIR_WORLD, AIM_MAX_RAD, FLOOR);
    expect(len(d)).toBeCloseTo(1, 12);
    expect(dot(d, SUN_DIR_WORLD)).toBeGreaterThanOrEqual(FLOOR - 1e-9);
    expect(dot(d, SUN_DIR_WORLD)).toBeLessThan(FLOOR + 1e-4);    // the FIRST lit point, not the most sunward one
    expect(ang(d, CAM)).toBeLessThanOrEqual(AIM_MAX_RAD + 1e-9);
  });

  it('several dark landings in several cones all stay inside their cone', () => {
    for (const cam of [[0, 0, 3.6], [1.2, 0.8, 3.2], [2.5, -0.5, 2.0]]) {
      const c = unit(cam);
      for (let i = 0; i < 12; i++) {
        const az = (i / 12) * 2 * Math.PI;
        // a point on the cone edge at azimuth az about c
        const t1 = unit([-c[2], 0, c[0]]);   // ⊥ c (no camera here looks straight down y)
        const t2 = [c[1] * t1[2] - c[2] * t1[1], c[2] * t1[0] - c[0] * t1[2], c[0] * t1[1] - c[1] * t1[0]];
        const s = Math.sin(AIM_MAX_RAD) * 0.999, k = Math.cos(Math.asin(s));
        const d = [0, 1, 2].map((j) => c[j] * k + s * (Math.cos(az) * t1[j] + Math.sin(az) * t2[j]));
        const before = dot(d, SUN_DIR_WORLD);
        litAim(d, cam, SUN_DIR_WORLD, AIM_MAX_RAD, FLOOR);
        expect(ang(d, cam)).toBeLessThanOrEqual(AIM_MAX_RAD + 1e-9);
        expect(dot(d, SUN_DIR_WORLD)).toBeGreaterThanOrEqual(Math.min(before, FLOOR) - 1e-9);
      }
    }
  });

  it('when the whole cone is dark, returns its most sunward point', () => {
    const cam = [SUN_DIR_WORLD[0] * -3, 0.4, SUN_DIR_WORLD[2] * -3];   // looking at the night side
    const c = unit(cam);
    expect(Math.cos(ang(c, SUN_DIR_WORLD) - AIM_MAX_RAD)).toBeLessThan(FLOOR);  // the cone's best is still below the floor
    const d = [...c];
    litAim(d, cam, SUN_DIR_WORLD, AIM_MAX_RAD, FLOOR);
    expect(ang(d, cam)).toBeCloseTo(AIM_MAX_RAD, 9);
    expect(dot(d, SUN_DIR_WORLD)).toBeCloseTo(Math.cos(ang(c, SUN_DIR_WORLD) - AIM_MAX_RAD), 9);
  });

  it('fire on crust: the plain aim lands on the terminator; the lit aim lands above the floor, inside the cone', () => {
    const ctx = ctxFor('thermal'); ctx.tau = 0;
    const plain = plainAim(ctx);
    expect(dot(plain, SUN_DIR_WORLD)).toBeLessThan(FLOOR);   // non-vacuous: the setup really is dark
    const v = launchVisitor(createVisitors(), 'thermal', ctx);
    expect(dot(v.dirWorld, SUN_DIR_WORLD)).toBeGreaterThanOrEqual(FLOOR - 1e-9);
    expect(ang(v.dirWorld, ctx.cam)).toBeLessThanOrEqual(AIM_MAX_RAD + 1e-9);
  });

  it('fire on a liquid planet and water on crust keep the plain aim', () => {
    const fire = ctxFor('thermal'); fire.tau = 1;
    const plainFire = plainAim(fire);
    expect(dot(plainFire, SUN_DIR_WORLD)).toBeLessThan(FLOOR);
    expect(launchVisitor(createVisitors(), 'thermal', fire).dirWorld).toEqual(plainFire);

    const water = ctxFor('fluid'); water.tau = 0;
    water.nodePos = [...ctxFor('thermal').nodePos];   // water from the dark side, so a bias would show
    const plainWater = plainAim(water);
    expect(dot(plainWater, SUN_DIR_WORLD)).toBeLessThan(FLOOR);
    expect(launchVisitor(createVisitors(), 'fluid', water).dirWorld).toEqual(plainWater);
  });
});

import { describe, it, expect } from 'vitest';
import { createVisitors, launchVisitor, aimToward, AIM_MAX_RAD, T_FLIGHT } from '../visitorSim';
import { ctxFor } from './visitorTestKit';
import * as SIM from '../visitorSim';

const len = (v) => Math.hypot(v[0], v[1], v[2]);
const ang = (a, b) => Math.acos(Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (len(a) * len(b))));

describe('visitors matrix — the landing aim (matrix spec §4.1)', () => {
  it('is 35 degrees', () => {
    expect(AIM_MAX_RAD).toBeCloseTo((35 * Math.PI) / 180, 12);
  });
  it('leaves a landing already inside the cone alone', () => {
    const d = [0, Math.sin(0.3), Math.cos(0.3)];
    const want = [...d];
    aimToward(d, [0, 0, 3.6], AIM_MAX_RAD);
    expect(d).toEqual(want);
  });
  it('pulls a far landing onto the cone edge, keeping its azimuth about the sub-camera point', () => {
    const d = [Math.sin(1.2), 0, Math.cos(1.2)];
    aimToward(d, [0, 0, 3.6], AIM_MAX_RAD);
    expect(ang(d, [0, 0, 1])).toBeCloseTo(AIM_MAX_RAD, 9);
    expect(d[1]).toBeCloseTo(0, 12);
    expect(d[0]).toBeGreaterThan(0);
    expect(len(d)).toBeCloseTo(1, 12);
  });
  it('an antipodal landing falls to the sub-camera point', () => {
    const d = [0, 0, -1];
    aimToward(d, [0, 0, 3.6], AIM_MAX_RAD);
    expect(d).toEqual([0, 0, 1]);
  });
  it('every node lands inside the cone and on its own side, for several cameras', () => {
    for (const cam of [[0, 0, 3.6], [1.2, 0.8, 3.2], [-2, 1, 2.5]]) {
      const cl = len(cam);
      const c = cam.map((x) => x / cl);
      const off = (p) => { const k = p[0] * c[0] + p[1] * c[1] + p[2] * c[2]; return [p[0] - c[0] * k, p[1] - c[1] * k, p[2] - c[2] * k]; };
      for (const phase of Object.keys(T_FLIGHT)) {
        const ctx = ctxFor(phase);
        ctx.cam = cam;
        const v = launchVisitor(createVisitors(), phase, ctx);
        expect(ang(v.dirWorld, cam)).toBeLessThanOrEqual(AIM_MAX_RAD + 1e-9);
        const a = off(v.dirWorld), b = off(ctx.nodePos);
        expect(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]).toBeGreaterThan(0);
      }
    }
  });
  it('water and fire on a cool liquid planet still land inside the cone (amendment A2: no cold-limb aim)', () => {
    for (const phase of ['fluid', 'thermal']) {
      const ctx = ctxFor(phase);
      ctx.tempOverrideK = null; ctx.tau = 1; ctx.heatK = 30; ctx.subsolarT = 572;
      const v = launchVisitor(createVisitors(), phase, ctx);
      expect(ang(v.dirWorld, [0, 0, 1])).toBeLessThanOrEqual(AIM_MAX_RAD + 1e-9);
    }
    expect(SIM.coldLimbAim).toBeUndefined();
    expect(SIM.COLD_AIM_MAX_RAD).toBeUndefined();
  });
});

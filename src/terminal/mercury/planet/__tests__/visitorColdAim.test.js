import { describe, it, expect } from 'vitest';
import {
  createVisitors, createVisitorOut, launchVisitor, coldLimbAim, COLD_AIM_MAX_RAD, COLD_AIM_MARGIN_K, COLD_AIM_HORIZON_PAD_RAD, AIM_MAX_RAD, T_FLIGHT,
} from '../visitorSim';
import { SUN_DIR_WORLD } from '../planetFrame';
import { localTempK } from '../mercuryImpacts';
import { HG_MELT_K } from '../mercuryThermal';
import { R_SCENE } from '../planetLook';
import { LIQUID_TAU } from '../mercuryWaves';
import { ctxFor, runCollect } from './visitorTestKit';

const CAM = [0, 0, 3.6];
const C = [0, 0, 1];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const angC = (d) => Math.acos(Math.min(1, dot(d, C)));
const tempAt = (p, heatK) => localTempK(p, SUN_DIR_WORLD, 572, heatK);

function coolCtx(phase) {
  const ctx = ctxFor(phase);
  ctx.tempOverrideK = null; ctx.tau = 1; ctx.heatK = 30; ctx.subsolarT = 572;
  return ctx;
}

describe('visitors matrix — the cold-limb aim (matrix P-7)', () => {
  it('constants', () => {
    expect(COLD_AIM_MAX_RAD).toBeCloseTo((80 * Math.PI) / 180, 12);
    expect(COLD_AIM_MARGIN_K).toBe(10);
  });

  it('finds the first frozen candidate on the anti-sun side of the disc', () => {
    const d = [0, 0, 1];
    expect(coldLimbAim(d, CAM, SUN_DIR_WORLD, 572, 30)).toBe(true);
    expect(Math.hypot(d[0], d[1], d[2])).toBeCloseTo(1, 12);
    const th = angC(d);
    expect(th).toBeGreaterThanOrEqual(AIM_MAX_RAD - 1e-9);
    expect(th).toBeLessThanOrEqual(COLD_AIM_MAX_RAD + 1e-9);
    expect(tempAt(d, 30)).toBeLessThan(HG_MELT_K - COLD_AIM_MARGIN_K);
    expect(dot(d, SUN_DIR_WORLD)).toBeLessThan(dot(C, SUN_DIR_WORLD));
    // first such step: one degree closer is not cold enough, unless we are at the cone edge
    const deg = (Math.PI / 180);
    if (th - AIM_MAX_RAD > 1e-9) {
      const a = [d[0] - C[0] * Math.cos(th), d[1] - C[1] * Math.cos(th), d[2] - C[2] * Math.cos(th)].map((x) => x / Math.sin(th));
      const t2 = th - deg;
      const p = [0, 1, 2].map((k) => C[k] * Math.cos(t2) + a[k] * Math.sin(t2));
      expect(tempAt(p, 30)).toBeGreaterThanOrEqual(HG_MELT_K - COLD_AIM_MARGIN_K);
    }
  });

  it('returns false and leaves d alone when nothing on the disc is frozen', () => {
    const d = [0.1, 0.2, Math.sqrt(1 - 0.05)];
    const want = [...d];
    expect(coldLimbAim(d, CAM, SUN_DIR_WORLD, 572, 1000)).toBe(false);
    expect(d).toEqual(want);
  });

  it('through the real sim: water frosts, fire pools; earth and air stay in the cone', () => {
    const expected = { fluid: 'frost', thermal: 'pool' };
    for (const phase of ['fluid', 'thermal']) {
      const buf = createVisitors(), out = createVisitorOut(), ctx = coolCtx(phase);
      launchVisitor(buf, phase, ctx);
      const { impacts } = runCollect(buf, ctx, out, T_FLIGHT[phase] + 0.1);
      expect(impacts[0].kind).toBe(expected[phase]);
    }
    for (const phase of ['earth', 'air']) {
      const buf = createVisitors(), ctx = coolCtx(phase);
      const v = launchVisitor(buf, phase, ctx);
      expect(angC(v.dirWorld)).toBeLessThanOrEqual(AIM_MAX_RAD + 1e-9);
    }
  });

  it('crust (tau < LIQUID_TAU) and a temperature override keep the 35 degree aim', () => {
    const a = coolCtx('fluid'); a.tau = LIQUID_TAU - 0.1;
    expect(angC(launchVisitor(createVisitors(), 'fluid', a).dirWorld)).toBeLessThanOrEqual(AIM_MAX_RAD + 1e-9);
    const b = coolCtx('fluid'); b.tempOverrideK = 100;
    expect(angC(launchVisitor(createVisitors(), 'fluid', b).dirWorld)).toBeLessThanOrEqual(AIM_MAX_RAD + 1e-9);
  });

  it('the search stays inside the visible horizon of the actual camera', () => {
    expect(COLD_AIM_HORIZON_PAD_RAD).toBeCloseTo((5 * Math.PI) / 180, 12);
    const cap = Math.acos(R_SCENE / 3.6) - COLD_AIM_HORIZON_PAD_RAD;
    for (const heatK of [0, 30, 100, 200]) {
      const d = [0, 0, 1];
      if (coldLimbAim(d, CAM, SUN_DIR_WORLD, 572, heatK)) expect(angC(d)).toBeLessThanOrEqual(cap + 1e-9);
    }
    const d = [0, 0, 1];
    expect(coldLimbAim(d, CAM, SUN_DIR_WORLD, 572, 30)).toBe(true);
    expect(angC(d)).toBeLessThanOrEqual(cap + 1e-9);
  });

  it('a first frozen candidate beyond the cap is not taken; a degenerate camera returns false', () => {
    const near = [0, 0, 1.2 * R_SCENE];
    const cap = Math.acos(1 / 1.2) - COLD_AIM_HORIZON_PAD_RAD;
    expect(cap).toBeLessThan(AIM_MAX_RAD);
    const d = [0, 0, 1], want = [...d];
    expect(coldLimbAim(d, near, SUN_DIR_WORLD, 572, 30)).toBe(false);
    expect(d).toEqual(want);
    // the same state with the wide camera does find a spot, so the cap is what refused it
    expect(coldLimbAim([0, 0, 1], CAM, SUN_DIR_WORLD, 572, 30)).toBe(true);
    expect(coldLimbAim([0, 0, 1], [0, 0, R_SCENE], SUN_DIR_WORLD, 572, 30)).toBe(false);
    expect(coldLimbAim([0, 0, 1], [0, 0, 0.5], SUN_DIR_WORLD, 572, 30)).toBe(false);
  });

  it('nothing frozen, or a non-finite heatK, keeps the 35 degree aim through launchVisitor', () => {
    for (const heatK of [1e6, NaN, Infinity]) {
      const ctx = coolCtx('fluid'); ctx.heatK = heatK;
      expect(angC(launchVisitor(createVisitors(), 'fluid', ctx).dirWorld)).toBeLessThanOrEqual(AIM_MAX_RAD + 1e-9);
    }
  });
});

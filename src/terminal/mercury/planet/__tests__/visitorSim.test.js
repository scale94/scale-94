import { describe, it, expect } from 'vitest';
import {
  createVisitors, createVisitorOut, launchVisitor, stepVisitors, pickVisitorSlot, flightPoint,
  impactBranch, aimToward, AIM_MAX_RAD, VISITOR_SLOTS, MAX_PER_ELEMENT, T_FLIGHT, LEIDENFROST_K,
} from '../visitorSim';
import { strikeDirWorld } from '../mercuryImpacts';
import { R_SCENE } from '../planetLook';
import { HG_MELT_K } from '../mercuryThermal';
import { LIQUID_TAU } from '../mercuryWaves';
import { ctxFor, runTo } from './visitorTestKit';

const len = (v) => Math.hypot(v[0], v[1], v[2]);

describe('visitorSim — launch and the fall', () => {
  it('a launch starts at the node, in flight', () => {
    const buf = createVisitors();
    const ctx = ctxFor('fluid');
    const v = launchVisitor(buf, 'fluid', ctx);
    expect(v.state).toBe('flight');
    expect(buf.live).toBe(1);
    expect(v.pos).toEqual(ctx.nodePos);
  });
  it('an unknown phase launches nothing', () => {
    expect(launchVisitor(createVisitors(), 'aether', ctxFor('fluid'))).toBeNull();
  });
  it('touches down exactly at T_FLIGHT, on the aimed strike point', () => {
    for (const phase of Object.keys(T_FLIGHT)) {
      const buf = createVisitors();
      const ctx = ctxFor(phase);
      launchVisitor(buf, phase, ctx);
      const ev = runTo(buf, ctx, createVisitorOut(), 2);
      expect(ev).toHaveLength(1);
      expect(ev[0].at).toBeGreaterThanOrEqual(T_FLIGHT[phase] - 1e-9);
      expect(ev[0].at).toBeLessThanOrEqual(T_FLIGHT[phase] + ctx.dt + 1e-9);
      const want = aimToward(strikeDirWorld(ctx.nodePos, ctx.cam), ctx.cam, AIM_MAX_RAD);
      for (let k = 0; k < 3; k++) expect(ev[0].dirWorld[k]).toBeCloseTo(want[k], 9);
    }
  });
  it('the fall never enters the planet before touchdown, and accelerates', () => {
    const buf = createVisitors();
    const ctx = ctxFor('earth');
    const v = launchVisitor(buf, 'earth', ctx);
    const p = [0, 0, 0], q = [0, 0, 0];
    for (let s = 0.02; s < 0.999; s += 0.02) expect(len(flightPoint(v, s, p))).toBeGreaterThan(R_SCENE);
    const step = (s) => { flightPoint(v, s, p); flightPoint(v, s + 0.05, q); return Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]); };
    expect(step(0.85)).toBeGreaterThan(step(0.15));
  });
  it('reduced motion: no fall, touchdown on the first step', () => {
    const buf = createVisitors();
    const ctx = ctxFor('fluid');
    ctx.calm = true;
    launchVisitor(buf, 'fluid', ctx);
    const out = createVisitorOut();
    ctx.tS += ctx.dt;
    stepVisitors(buf, ctx, out);
    expect(out.nImpacts).toBe(1);
  });
});

describe('visitorSim — what the touchdown is', () => {
  it('branches on crust, frozen Hg, then the element (water by its Leidenfrost point)', () => {
    expect(impactBranch('air', LIQUID_TAU - 0.01, 400)).toBe('crater');
    expect(impactBranch('earth', 1, HG_MELT_K - 1)).toBe('ring');
    expect(impactBranch('fluid', 1, LEIDENFROST_K - 1)).toBe('film');
    expect(impactBranch('fluid', 1, LEIDENFROST_K)).toBe('bead');
    expect(impactBranch('fluid', 1, 700)).toBe('bead');      // boiling Hg is liquid for visitors (plan D-4)
    expect(impactBranch('thermal', 1, 400)).toBe('ember');
    expect(impactBranch('earth', 1, 400)).toBe('rock');
    expect(impactBranch('air', 1, 400)).toBe('jet');
  });
  it('a crater or a frozen ring leaves nothing behind', () => {
    const buf = createVisitors();
    const ctx = ctxFor('earth');
    ctx.tau = 0;
    launchVisitor(buf, 'earth', ctx);
    const ev = runTo(buf, ctx, createVisitorOut(), 1);
    expect(ev[0].kind).toBe('crater');
    expect(ev[0].impulse).toBe('');
    expect(buf.live).toBe(0);
  });
  it('the touchdown reports the impulse, the phase, the seed and the temperature', () => {
    const buf = createVisitors();
    const ctx = ctxFor('thermal', 650);
    launchVisitor(buf, 'thermal', ctx);
    const [e] = runTo(buf, ctx, createVisitorOut(), 1);
    expect(e).toMatchObject({ kind: 'ember', impulse: 'marangoni', phase: 'thermal', tempK: 650 });
    expect(e.seed).toBeGreaterThan(0);
  });
});

describe('visitorSim — the pool', () => {
  it('holds at most MAX_PER_ELEMENT of one element: the oldest of that element gives way', () => {
    const buf = createVisitors();
    const ctx = ctxFor('fluid');
    const first = launchVisitor(buf, 'fluid', ctx);
    for (let i = 1; i < MAX_PER_ELEMENT; i++) { ctx.tS += 0.01; launchVisitor(buf, 'fluid', ctx); }
    ctx.tS += 0.01;
    const idx = pickVisitorSlot(buf, 'fluid');
    expect(buf.v[idx]).toBe(first);
    launchVisitor(buf, 'fluid', ctx);
    expect(buf.v.filter((v) => v.live && v.phase === 'fluid')).toHaveLength(MAX_PER_ELEMENT);
  });
  it('a full pool gives way oldest first', () => {
    const buf = createVisitors();
    const phases = ['fluid', 'thermal', 'earth', 'air'];
    const ctx = ctxFor('fluid');
    for (let i = 0; i < VISITOR_SLOTS; i++) { ctx.tS = i * 0.01; launchVisitor(buf, phases[i % 4], ctx); }
    expect(buf.live).toBe(VISITOR_SLOTS);
    const oldest = buf.v.reduce((a, b) => (b.t0 < a.t0 ? b : a));
    expect(buf.v[pickVisitorSlot(buf, 'earth')]).toBe(oldest);
  });
  it('idle: stepVisitors with nothing live does nothing', () => {
    const buf = createVisitors();
    const out = createVisitorOut();
    out.nImpacts = 5;
    const ctx = ctxFor('fluid');
    expect(stepVisitors(buf, ctx, out)).toBe(out);
    expect(out.nImpacts).toBe(0);
    expect(buf.v.every((v) => v.state === 'free')).toBe(true);
  });
});

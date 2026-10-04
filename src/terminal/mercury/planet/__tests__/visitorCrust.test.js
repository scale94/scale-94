import { describe, it, expect } from 'vitest';
import {
  createVisitors, createVisitorOut, launchVisitor, stepVisitors, impactBranch, residentHeight, stampRadius,
  RESIDENT_LIFE_S, IMPULSE_FOR, STAMP_FOR, T_FLIGHT, SOFT_TAU_MIN, POOL_R, POOL_GROW_S, POOL_FREEZE_S, EMBER_R,
  QUENCH_R, QUENCH_SPREAD_S, QUENCH_STEAM_LIFE_S, SURF_QUENCH, hotTempK, quenchRadius,
} from '../visitorSim';
import { LIQUID_TAU } from '../mercuryWaves';
import { ctxFor, runTo, runCollect } from './visitorTestKit';

function landedOnCrust(phase, tau = 0) {
  const buf = createVisitors();
  const ctx = ctxFor(phase, 400);
  ctx.tau = tau;
  const v = launchVisitor(buf, phase, ctx);
  const got = runCollect(buf, ctx, createVisitorOut(), T_FLIGHT[phase] + ctx.dt);
  return { buf, ctx, v, got };
}

describe('amendment A — water and fire on crust (matrix spec §9)', () => {
  it('the crust row: water quenches, fire re-melts a pool, earth sinks or craters, air craters', () => {
    for (const tau of [0, SOFT_TAU_MIN - 0.01, SOFT_TAU_MIN, LIQUID_TAU - 0.01]) {
      expect(impactBranch('fluid', tau, 400)).toBe('quench');
      expect(impactBranch('thermal', tau, 400)).toBe('crustpool');
      expect(impactBranch('air', tau, 400)).toBe('crater');
    }
    expect(impactBranch('earth', SOFT_TAU_MIN - 0.01, 400)).toBe('crater');
    expect(impactBranch('earth', SOFT_TAU_MIN, 400)).toBe('sink');
    expect(impactBranch('fluid', LIQUID_TAU, 400)).toBe('film');
    expect(impactBranch('thermal', LIQUID_TAU, 400)).toBe('ember');
  });
  it('the tables: lifetimes, no impulse (no crater), stamps and their radii', () => {
    expect(RESIDENT_LIFE_S).toMatchObject({ quench: QUENCH_SPREAD_S, crustpool: POOL_GROW_S + POOL_FREEZE_S });
    expect(IMPULSE_FOR).toMatchObject({ quench: '', crustpool: '' });
    expect(STAMP_FOR).toMatchObject({ quench: 'quench', crustpool: 'glaze' });
    expect(stampRadius('quench')).toBe(QUENCH_R);
    expect(stampRadius('crustpool')).toBe(POOL_R);
    expect(SURF_QUENCH).toBe(8);
  });
  it('the rind spreads from 0 to QUENCH_R over QUENCH_SPREAD_S, monotone', () => {
    expect(quenchRadius(0)).toBe(0);
    expect(quenchRadius(QUENCH_SPREAD_S)).toBeCloseTo(QUENCH_R, 12);
    expect(quenchRadius(10)).toBeCloseTo(QUENCH_R, 12);
    let prev = -1;
    for (let a = 0; a <= QUENCH_SPREAD_S; a += 0.05) { const r = quenchRadius(a); expect(r).toBeGreaterThanOrEqual(prev); prev = r; }
  });
  it('water on crust: one quench touchdown with no impulse, one quench stamp at the end of the spread', () => {
    const { buf, ctx, v, got } = landedOnCrust('fluid');
    expect(got.impacts).toHaveLength(1);
    expect(got.impacts[0].kind).toBe('quench');
    expect(got.impacts[0].impulse).toBe('');
    expect(v.state).toBe('resident');
    expect(v.fade).toBe(1);
    // A10: the visitor stays while its steam rises (the longer of the two lives); the rind still stamps once, at the spread
    const later = runCollect(buf, ctx, createVisitorOut(), v.tImpact + Math.max(QUENCH_SPREAD_S, QUENCH_STEAM_LIFE_S) + 0.1);
    expect(later.stamps).toHaveLength(1);
    expect(later.stamps[0]).toMatchObject({ kind: 'quench', radius: QUENCH_R, seed: v.seed });
    expect(Math.abs(later.stamps[0].at - (v.tImpact + QUENCH_SPREAD_S))).toBeLessThanOrEqual(ctx.dt + 1e-9);
    expect(buf.live).toBe(0);
  });
  it('fire on crust: the ember sits in its pool, cools like a free ember, and stamps glaze when its life ends', () => {
    const { buf, ctx, v } = landedOnCrust('thermal', 0.3);
    expect(v.kind).toBe('crustpool');
    expect(v.r).toBe(EMBER_R);
    runTo(buf, ctx, createVisitorOut(), v.tImpact + 1);
    expect(v.tempK).toBeCloseTo(hotTempK(ctx.tS - v.tImpact), 6);
    expect(residentHeight(v, 1, RESIDENT_LIFE_S.crustpool, false)).toBeCloseTo(0.4 * EMBER_R, 12);
    expect(v.fade).toBe(1);
    const later = runCollect(buf, ctx, createVisitorOut(), v.tImpact + RESIDENT_LIFE_S.crustpool + 0.1);
    expect(later.stamps).toHaveLength(1);
    expect(later.stamps[0]).toMatchObject({ kind: 'glaze', radius: POOL_R });
  });
  it('a fling leaves the rind and the pool where they are (they are in the rock)', () => {
    for (const phase of ['fluid', 'thermal']) {
      const { buf, ctx, v } = landedOnCrust(phase);
      ctx.detach = true; ctx.omega = [0, 12, 0];
      ctx.tS += ctx.dt;
      stepVisitors(buf, ctx, createVisitorOut());
      expect(v.state).toBe('resident');
    }
  });
  it('reduced motion: both stamp at touchdown', () => {
    for (const [phase, kind] of [['fluid', 'quench'], ['thermal', 'glaze']]) {
      const buf = createVisitors();
      const ctx = ctxFor(phase, 400);
      ctx.tau = 0; ctx.calm = true;
      launchVisitor(buf, phase, ctx);
      const got = runCollect(buf, ctx, createVisitorOut(), 2 * ctx.dt);
      expect(got.stamps).toHaveLength(1);
      expect(got.stamps[0].kind).toBe(kind);
      expect(buf.live).toBe(0);
    }
  });
});

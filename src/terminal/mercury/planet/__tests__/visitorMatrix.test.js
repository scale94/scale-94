import { describe, it, expect } from 'vitest';
import {
  createVisitors, createVisitorOut, launchVisitor, stepVisitors, impactBranch, residentHeight, RESIDENT_LIFE_S, IMPULSE_FOR,
  STAMP_FOR, T_FLIGHT, SOFT_TAU_MIN, FROST_R, FROST_CREEP_S, POOL_R, POOL_GROW_S, POOL_FREEZE_S, SINK_S, ROCK_R, ROCK_BOUND,
  ROCK_SUBMERGED, frostRadius, poolRadius, poolFreeze, hotTempK,
} from '../visitorSim';
import { HG_MELT_K, HG_BOIL_K } from '../mercuryThermal';
import { LIQUID_TAU } from '../mercuryWaves';
import { ctxFor, runTo } from './visitorTestKit';


function landed(phase, tempK, tau = 1) {
  const buf = createVisitors();
  const ctx = ctxFor(phase, tempK);
  ctx.tau = tau;
  const v = launchVisitor(buf, phase, ctx);
  runTo(buf, ctx, createVisitorOut(), T_FLIGHT[phase] + ctx.dt);
  return { buf, ctx, v };
}

describe('visitors matrix — the branch table (matrix spec §3, §4)', () => {
  it('crust: water quenches, fire re-melts, a rock sinks into soft crust or craters hard crust, air craters (amendment A)', () => {
    expect(impactBranch('fluid', SOFT_TAU_MIN - 0.01, 400)).toBe('quench');
    expect(impactBranch('thermal', SOFT_TAU_MIN - 0.01, 400)).toBe('crustpool');
    expect(impactBranch('earth', SOFT_TAU_MIN - 0.01, 400)).toBe('crater');
    expect(impactBranch('air', SOFT_TAU_MIN - 0.01, 400)).toBe('crater');
    expect(impactBranch('earth', SOFT_TAU_MIN, 400)).toBe('sink');
    expect(impactBranch('earth', LIQUID_TAU - 0.01, 400)).toBe('sink');
    expect(impactBranch('air', 0.3, 400)).toBe('crater');
    expect(impactBranch('earth', LIQUID_TAU, 400)).toBe('rock');
  });
  it('frozen Hg: water frosts, fire melts a pool, earth and air still ring', () => {
    const T = HG_MELT_K - 0.01;
    expect(impactBranch('fluid', 1, T)).toBe('frost');
    expect(impactBranch('thermal', 1, T)).toBe('pool');
    expect(impactBranch('earth', 1, T)).toBe('ring');
    expect(impactBranch('air', 1, T)).toBe('ring');
    expect(impactBranch('fluid', 1, HG_MELT_K)).toBe('film');
    expect(impactBranch('thermal', 1, HG_MELT_K)).toBe('ember');
  });
  it('boiling Hg strips vapour under a gust; the other elements keep their phase 1 reactions', () => {
    expect(impactBranch('air', 1, HG_BOIL_K + 0.01)).toBe('strip');
    expect(impactBranch('air', 1, HG_BOIL_K)).toBe('jet');
    expect(impactBranch('fluid', 1, HG_BOIL_K + 1)).toBe('bead');
    expect(impactBranch('thermal', 1, HG_BOIL_K + 1)).toBe('ember');
    expect(impactBranch('earth', 1, HG_BOIL_K + 1)).toBe('rock');
  });
  it('every new kind has a lifetime and an impulse; the stamping kinds name their stamp', () => {
    expect(RESIDENT_LIFE_S).toMatchObject({ frost: FROST_CREEP_S, pool: POOL_GROW_S + POOL_FREEZE_S, sink: SINK_S, strip: RESIDENT_LIFE_S.jet });
    expect(IMPULSE_FOR).toMatchObject({ frost: 'ring', pool: 'ring', sink: '', strip: 'jet' });
    expect(STAMP_FOR).toEqual({ frost: 'frost', pool: 'glaze', sink: 'pit', quench: 'quench', crustpool: 'glaze' });
  });
});

describe('visitors matrix — the residents', () => {
  it('each new kind lands as itself and lives its RESIDENT_LIFE_S', () => {
    for (const [phase, T, tau, kind] of [['fluid', 200, 1, 'frost'], ['thermal', 200, 1, 'pool'], ['earth', 400, 0.3, 'sink'], ['air', 700, 1, 'strip']]) {
      const { buf, ctx, v } = landed(phase, T, tau);
      expect(v.kind).toBe(kind);
      expect(v.state).toBe('resident');
      runTo(buf, ctx, createVisitorOut(), v.tImpact + RESIDENT_LIFE_S[kind] - 0.1);
      expect(v.live).toBe(true);
      runTo(buf, ctx, createVisitorOut(), v.tImpact + RESIDENT_LIFE_S[kind] + 0.1);
      expect(v.live).toBe(false);
    }
  });
  it('frost, pool and sink hold full weight until they stamp; a strip fades like a jet', () => {
    for (const [phase, T, tau] of [['fluid', 200, 1], ['thermal', 200, 1], ['earth', 400, 0.3]]) {
      const { buf, ctx, v } = landed(phase, T, tau);
      runTo(buf, ctx, createVisitorOut(), v.tImpact + RESIDENT_LIFE_S[v.kind] - 0.2);
      expect(v.fade).toBe(1);
    }
    const { buf, ctx, v } = landed('air', 700);
    runTo(buf, ctx, createVisitorOut(), v.tImpact + RESIDENT_LIFE_S.strip - 0.2);
    expect(v.fade).toBeLessThan(1);
  });
  it('the frost creeps out to FROST_R; the pool grows to POOL_R, then refreezes', () => {
    expect(frostRadius(0)).toBe(0);
    expect(frostRadius(FROST_CREEP_S / 2)).toBeLessThan(frostRadius(FROST_CREEP_S * 0.9));
    expect(frostRadius(FROST_CREEP_S)).toBeCloseTo(FROST_R, 12);
    expect(frostRadius(3 * FROST_CREEP_S)).toBeCloseTo(FROST_R, 12);
    expect(poolRadius(0)).toBe(0);
    expect(poolRadius(POOL_GROW_S / 2)).toBeLessThan(poolRadius(POOL_GROW_S));
    expect(poolRadius(POOL_GROW_S)).toBeCloseTo(POOL_R, 12);
    expect(poolRadius(2 * POOL_GROW_S)).toBeCloseTo(POOL_R, 12);
    expect(poolFreeze(POOL_GROW_S)).toBe(0);
    expect(poolFreeze(POOL_GROW_S + POOL_FREEZE_S / 2)).toBeCloseTo(0.5, 9);
    expect(poolFreeze(POOL_GROW_S + POOL_FREEZE_S)).toBe(1);
  });
  it("the pool's ember cools like a free ember", () => {
    const { buf, ctx, v } = landed('thermal', 200);
    runTo(buf, ctx, createVisitorOut(), v.tImpact + 1);
    expect(v.tempK).toBeCloseTo(hotTempK(ctx.tS - v.tImpact), 6);
  });
  it('a sinking rock goes from its floating height to fully under the crust, monotonically', () => {
    const v = { kind: 'sink' };
    const life = RESIDENT_LIFE_S.sink;
    expect(residentHeight(v, 0, life, false)).toBeCloseTo(ROCK_R * (1 - 2 * ROCK_SUBMERGED), 12);
    expect(residentHeight(v, life, life, false)).toBeCloseTo(-ROCK_BOUND * ROCK_R, 12);
    let prev = Infinity;
    for (let a = 0; a <= life + 1e-9; a += 0.25) {
      const h = residentHeight(v, a, life, false);
      expect(h).toBeLessThanOrEqual(prev + 1e-12);
      prev = h;
    }
  });
  it('frost, pool and a sinking rock stay put through a fling; a strip is flung with the rest (plan P-3)', () => {
    for (const [phase, T, tau, want] of [['fluid', 200, 1, 'resident'], ['thermal', 200, 1, 'resident'], ['earth', 400, 0.3, 'resident'], ['air', 700, 1, 'detached']]) {
      const { buf, ctx, v } = landed(phase, T, tau);
      ctx.detach = true; ctx.omega = [0, 12, 0];
      ctx.tS += ctx.dt;
      stepVisitors(buf, ctx, createVisitorOut());
      expect(v.state).toBe(want);
    }
  });
  it('a strip carries a unit gust direction along the surface', () => {
    const { v } = landed('air', 700);
    const t = v.tan, d = v.dirBody;
    expect(Math.hypot(t[0], t[1], t[2])).toBeCloseTo(1, 9);
    expect(t[0] * d[0] + t[1] * d[1] + t[2] * d[2]).toBeCloseTo(0, 9);
  });
});

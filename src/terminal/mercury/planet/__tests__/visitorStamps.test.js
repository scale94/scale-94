import { describe, it, expect } from 'vitest';
import {
  createVisitors, createVisitorOut, launchVisitor, stepVisitors, stampRadius, T_FLIGHT, RESIDENT_LIFE_S, FROST_R, POOL_R, PIT_R,
} from '../visitorSim';
import { ctxFor, runCollect } from './visitorTestKit';

function strike(phase, tempK, tau, runForS, calm = false) {
  const buf = createVisitors();
  const ctx = ctxFor(phase, tempK);
  ctx.tau = tau; ctx.calm = calm;
  launchVisitor(buf, phase, ctx);
  return { ...runCollect(buf, ctx, createVisitorOut(), T_FLIGHT[phase] + runForS), buf, ctx };
}

describe('visitors matrix — stamp events (matrix spec §4, §5.1)', () => {
  it('names a radius per stamping kind', () => {
    expect(stampRadius('frost')).toBe(FROST_R);
    expect(stampRadius('pool')).toBe(POOL_R);
    expect(stampRadius('sink')).toBe(PIT_R);
  });
  for (const [phase, T, tau, resident, kind, radius] of [
    ['fluid', 200, 1, 'frost', 'frost', FROST_R],
    ['thermal', 200, 1, 'pool', 'glaze', POOL_R],
    ['earth', 400, 0.3, 'sink', 'pit', PIT_R],
  ]) {
    it(`${resident} stamps ${kind} once, when its life ends, where it landed`, () => {
      const { impacts, stamps, buf } = strike(phase, T, tau, RESIDENT_LIFE_S[resident] + 1);
      expect(impacts).toHaveLength(1);
      expect(stamps).toHaveLength(1);
      expect(stamps[0]).toMatchObject({ kind, radius, seed: impacts[0].seed });
      expect(stamps[0].at).toBeGreaterThanOrEqual(impacts[0].at + RESIDENT_LIFE_S[resident] - 1e-9);
      expect(stamps[0].at).toBeLessThanOrEqual(impacts[0].at + RESIDENT_LIFE_S[resident] + 1 / 60 + 1e-9);
      for (let k = 0; k < 3; k++) expect(stamps[0].dirBody[k]).toBeCloseTo(impacts[0].dirBody[k], 12);
      expect(buf.live).toBe(0);
    });
    it(`reduced motion: ${resident} stamps ${kind} at touchdown and is gone`, () => {
      const { impacts, stamps, buf } = strike(phase, T, tau, 0.5, true);
      expect(stamps).toHaveLength(1);
      expect(stamps[0].kind).toBe(kind);
      expect(stamps[0].at).toBe(impacts[0].at);
      expect(buf.live).toBe(0);
    });
  }
  it('Q-6: each stamp records which side of the state crossing it belongs to', () => {
    for (const [phase, T, tau, resident, crust] of [
      ['fluid', 200, 1, 'frost', false],
      ['thermal', 200, 1, 'pool', false],
      ['fluid', 200, 0.1, 'quench', true],
      ['thermal', 200, 0.1, 'crustpool', true],
      ['earth', 400, 0.3, 'sink', true],
    ]) {
      const { stamps } = strike(phase, T, tau, 8);
      expect(stamps, resident).toHaveLength(1);
      expect(stamps[0].crust, resident).toBe(crust);
    }
  });
  it('nothing on liquid or boiling Hg stamps', () => {
    for (const [phase, T] of [['fluid', 400], ['fluid', 600], ['thermal', 400], ['earth', 400], ['air', 400], ['air', 700]]) {
      expect(strike(phase, T, 1, 15).stamps).toHaveLength(0);
    }
  });
  it('idle: stepVisitors with nothing live clears the stamp count', () => {
    const out = createVisitorOut();
    out.nStamps = 3;
    stepVisitors(createVisitors(), ctxFor('fluid'), out);
    expect(out.nStamps).toBe(0);
  });
});

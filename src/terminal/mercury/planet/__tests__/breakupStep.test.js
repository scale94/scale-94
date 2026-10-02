// src/terminal/mercury/planet/__tests__/breakupStep.test.js
import { describe, it, expect } from 'vitest';
import { createFamily, qRotate, TONGUE_LAG_S } from '../breakupFamily';
import { DROP_DT, WOB_BIRTH } from '../breakupStep';
import { IMPACT_MODE_AMP } from '../mercuryImpacts';
import { testEnv, firedFamily, runFor, freeBody } from './breakupTestKit';

const len = (v) => Math.hypot(v[0], v[1], v[2]);

describe('breakupStep I — snaps, launch, flight', () => {
  it('before the tip snaps every bead rides the body rigidly and swells from the thread', () => {
    const f = firedFamily();
    const s = Math.SQRT1_2, env = testEnv({ q: [0, s, 0, s] });
    runFor(f, 0.5 * TONGUE_LAG_S, env);
    for (const b of f.bodies) expect(b.state).toBe('attached');
    const want = qRotate(env.q, f.bodies[0].posBody);
    expect(f.bodies[0].p[2]).toBeCloseTo(want[2], 12);
    expect(f.bodies[0].r).toBeGreaterThan(0.0187);
    expect(f.bodies[0].r).toBeLessThan(f.bodies[0].rMain);
  });

  it('the tip launches with the surface velocity ω × x', () => {
    const f = firedFamily();
    const env = testEnv({ gamma: 0 });
    runFor(f, f.necks[0].tSnap + 0.5 * DROP_DT, env);
    const tip = f.bodies[0];
    expect(tip.state).toBe('free');
    expect(tip.wobAmp).toBeLessThanOrEqual(WOB_BIRTH);
    const speed = 8 * Math.hypot(tip.p[0], tip.p[2]);
    expect(len(tip.v) / speed).toBeCloseTo(1, 1);
  });

  it('each inter-bead snap leaves a satellite; the root goes last, drains a stub, and the planet flinches', () => {
    const f = firedFamily();
    const env = testEnv();
    const lastSnap = Math.max(...f.necks.map((n) => n.tSnap));
    runFor(f, lastSnap + 2 * DROP_DT, env);
    expect(f.necks.every((n) => !n.on)).toBe(true);
    expect(f.bodies.length).toBe(16);
    const rings = f.events.filter((e) => e.kind === 'ring');
    expect(rings.length).toBe(2);
    expect(rings[0].mode).toBeCloseTo(IMPACT_MODE_AMP.ring * f.e, 12);
    expect(f.bodies.filter((b) => b.state === 'cascade' && b.final).length).toBeGreaterThanOrEqual(1);
  });

  it('flight: a circular orbit holds with no drag (integrator sanity)', () => {
    const f = createFamily(1);
    f.phase = 'fired'; f.mu = 2;
    const b = freeBody(f, [1, 0, 0], [0, 0, Math.sqrt(2)]);
    f.volOut = b.vol;
    runFor(f, (2 * Math.PI) / Math.sqrt(2), testEnv({ gamma: 0 }));
    expect(len(b.p)).toBeCloseTo(1, 2);
  });

  it('the aether drag bleeds speed as e^(−γt)', () => {
    const f = createFamily(1);
    f.phase = 'fired'; f.mu = 0;
    const b = freeBody(f, [2, 0, 0], [0, 0, 1]);
    runFor(f, 1, testEnv({ gamma: 2 }));
    expect(len(b.v)).toBeCloseTo(Math.exp(-2), 2);
  });

  it('cohesion draws beads toward each other', () => {
    const f = createFamily(1);
    f.phase = 'fired'; f.mu = 0;
    const a = freeBody(f, [2, 0, 0.3], [0, 0, 0]);
    const b = freeBody(f, [2, 0, -0.3], [0, 0, 0]);
    runFor(f, 1, testEnv({ gamma: 4, kappa: 0.03, vRef: a.vol }));
    expect(Math.abs(a.p[2] - b.p[2])).toBeLessThan(0.6);
  });
});

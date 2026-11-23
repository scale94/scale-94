// src/terminal/mercury/planet/__tests__/breakupStep.test.js
import { describe, it, expect } from 'vitest';
import { createFamily, qRotate, TONGUE_LAG_S } from '../breakupFamily';
import { DROP_DT, WOB_BIRTH, stepFamily, FREEZE_FADE_S } from '../breakupStep';
import { createDropFrame, packFamily } from '../breakupFrame';
import { R_SCENE } from '../planetLook';
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
    // …and in the spin's sense, not against it: v · (ω × p) > 0
    const w = env.omega, p = tip.p;
    const wxp = [w[1] * p[2] - w[2] * p[1], w[2] * p[0] - w[0] * p[2], w[0] * p[1] - w[1] * p[0]];
    expect(tip.v[0] * wxp[0] + tip.v[1] * wxp[1] + tip.v[2] * wxp[2]).toBeGreaterThan(0);
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

// Author 2026-11-23: breakup / hyper droplets kept orbiting the planet for ~10 s after it had crusted over; the glitter
// beads already homed and faded (hgBeads freeze guard). The family now does the same: env.freezeIn (time left before
// the surface stops counting as liquid) homes every flying body in that window; once crusted, what is still out drains
// away over FREEZE_FADE_S, with no splash on the crust.
describe('breakupStep — freeze guard (fix/mercury-motion)', () => {
  const orbiting = () => {
    const f = createFamily(1);
    f.phase = 'fired'; f.mu = 0.12;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * 2 * Math.PI;
      freeBody(f, [1.6 * Math.cos(a), 0.2 * k - 0.5, 1.6 * Math.sin(a)], [-0.3 * Math.sin(a), 0, 0.3 * Math.cos(a)], 0.03);
    }
    f.volOut = f.bodies.reduce((s, b) => s + b.vol, 0); f.volFamily = f.volOut;
    return f;
  };
  const free = (f) => f.bodies.filter((b) => b.state === 'free' || b.state === 'merging').length;

  it('without a refreeze (freezeIn absent / Infinity) a slow orbiting body stays out: the guard is what brings it home', () => {
    const f = orbiting();
    runFor(f, 2, testEnv({ gamma: 0.05 }));
    expect(free(f)).toBe(6);
  });
  it('refreezing: every flying body is home (landed) before the surface stops counting as liquid', () => {
    const f = orbiting();
    const T = 2;
    let t = 0;
    while (t < T - 1e-9) {
      stepFamily(f, DROP_DT, testEnv({ gamma: 0.05, freezeIn: T - t }));
      t += DROP_DT;
    }
    expect(free(f)).toBe(0);
    expect(f.events.some((e) => e.kind === 'splash')).toBe(true); // they land on the still-liquid surface
  });
  it('a hyper family homes too', () => {
    const f = orbiting();
    Object.assign(f, { hyper: true, eta: 0, gammaH: 0.05, axisL: [0, 1, 0], rC0: R_SCENE, tHang: 0, vRefH: 1e-3 });
    let t = 0;
    while (t < 2 - 1e-9) { stepFamily(f, DROP_DT, testEnv({ freezeIn: 2 - t })); t += DROP_DT; }
    expect(free(f)).toBe(0);
  });
  it('crusted: what is still out drains away within FREEZE_FADE_S, shrinking smoothly, with no splash on the crust', () => {
    const f = orbiting();
    const v0 = f.volOut;
    const env = testEnv({ gamma: 0.05, freezeIn: 0 });
    let prevK = 1, prevV = v0, steps = 0;
    f.events.length = 0;
    while (f.phase === 'fired' && steps < 1000) {
      stepFamily(f, DROP_DT, env); steps++;
      expect(f.fadeK).toBeLessThanOrEqual(prevK + 1e-12);
      expect(f.volOut).toBeLessThanOrEqual(prevV + 1e-12);
      prevK = f.fadeK; prevV = f.volOut;
    }
    expect(f.phase).toBe('idle');
    expect(steps * DROP_DT).toBeLessThanOrEqual(FREEZE_FADE_S + 2 * DROP_DT);
    expect(f.volOut).toBe(0);
    expect(f.events.length).toBe(0);
  });
  it('a crust fade is drawn: packFired scales every drawn radius by fadeK', () => {
    const f = orbiting();
    const env = testEnv({ gamma: 0.05, freezeIn: 0 });
    runFor(f, 0.5 * FREEZE_FADE_S, env);
    expect(f.fadeK).toBeGreaterThan(0.3); expect(f.fadeK).toBeLessThan(0.7);
    const fr = createDropFrame({ bodies: 16, necks: 16, bridges: 16 });
    const view = { vp: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), p00: 1, p11: 1, wPx: 100, hPx: 100 };
    packFamily(f, env, fr, view);
    for (let i = 0; i < fr.nb; i++) expect(fr.bead[4 * i + 3]).toBeCloseTo(0.03 * f.fadeK, 6);
  });
});

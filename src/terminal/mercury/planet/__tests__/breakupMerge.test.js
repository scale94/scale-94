import { describe, it, expect } from 'vitest';
import { createFamily } from '../breakupFamily';
import { stepFamily, DROP_DT } from '../breakupStep';
import { sphereVol, bridgeRadius, bridgeTime, capillaryTime, DAUGHTER_RATIO } from '../breakupPhysics';
import { R_SCENE } from '../planetLook';
import { testEnv, firedFamily, runFor, freeBody, muRefAt } from './breakupTestKit';

describe('breakupStep II — merges and the cascade', () => {
  it('beads that touch in flight merge fully: volume and momentum conserved, bridge = r_b(t)', () => {
    const f = createFamily(1);
    f.phase = 'fired'; f.mu = 0;
    const a = freeBody(f, [2, 0, 0.024], [0, 0, -0.2]);        // centres 0.048 apart < 0.03 + 0.02: touching
    const b = freeBody(f, [2, 0, -0.024], [0, 0, 0.2], 0.02);
    f.volOut = a.vol + b.vol;
    const env = testEnv({ gamma: 0 });
    const P0 = [0, 1, 2].map((c) => a.vol * a.v[c] + b.vol * b.v[c]);
    stepFamily(f, DROP_DT, env);
    const lead = f.bodies.find((x) => x.state === 'merging' && x.lead);
    expect(lead).toBeDefined();
    runFor(f, 0.25 * bridgeTime(0.02), env);
    expect(lead.bridgeB).toBeCloseTo(bridgeRadius(0.02, lead.mergeT), 12);
    runFor(f, bridgeTime(0.02), env);
    const alive = f.bodies.filter((x) => x.state !== 'gone');
    expect(alive.length).toBe(1);
    expect(alive[0].vol).toBeCloseTo(sphereVol(0.03) + sphereVol(0.02), 15);
    const V = alive[0].vol;
    for (let c = 0; c < 3; c++) expect(V * alive[0].v[c]).toBeCloseTo(P0[c], 12);
    expect(alive[0].wobAmp).toBeGreaterThan(0);
  });

  it('a bead landing on the planet cascades: halving daughters, t_c stages, one strike each, stops at the px floor', () => {
    const f = createFamily(1);
    f.phase = 'fired'; f.mu = 0;
    const r = 0.03;
    const b = freeBody(f, [R_SCENE + r - 0.001, 0, 0], [-0.2, 0, 0], r);
    f.volOut = b.vol;
    const env = testEnv({ gamma: 0, omega: [0, 0, 0], pxPerUnit: 300 });
    const strikes = [];
    for (let i = 0; i < 2000 && f.phase === 'fired'; i++) {
      stepFamily(f, DROP_DT, env);
      for (const e of f.events) strikes.push({ t: f.t, ...e });
      f.events.length = 0;
    }
    expect(f.phase).toBe('idle');
    // r·px: 9 → 4.5 → 2.25 → (1.125 < 1.5): stages 0, 1, 2; stage 2 merges fully
    expect(strikes.map((s) => s.kind)).toEqual(['splash', 'splash', 'splash']);
    expect(strikes[1].mode).toBeLessThan(strikes[0].mode);
    expect(strikes[2].mode).toBeLessThan(strikes[1].mode);
    expect(strikes[1].t - strikes[0].t).toBeCloseTo(capillaryTime(r), 1);
    expect(strikes[2].t - strikes[1].t).toBeCloseTo(capillaryTime(DAUGHTER_RATIO * r), 1);
    expect(Math.abs(f.volResidual)).toBeLessThan(1e-12 * sphereVol(r));
  });

  it('a merging pair that reaches the planet finishes its merge and cascades as one: the volume closes', () => {
    const f = createFamily(1);
    f.phase = 'fired'; f.mu = 0;
    const x = R_SCENE + 0.045;                                   // merged radius ≈ 0.033: a few substeps above the surface
    const a = freeBody(f, [x, 0, 0.024], [-1, 0, 0]);            // touching (0.048 < 0.03 + 0.02), both diving
    const b = freeBody(f, [x, 0, -0.024], [-1, 0, 0], 0.02);
    const V0 = a.vol + b.vol;
    f.volOut = V0;
    const env = testEnv({ gamma: 0, omega: [0, 0, 0], pxPerUnit: 300 });
    stepFamily(f, DROP_DT, env);
    expect(a.state).toBe('merging');
    let landedAt = -1;
    const kinds = [];
    for (let i = 0; i < 2000 && f.phase === 'fired'; i++) {
      stepFamily(f, DROP_DT, env);
      for (const e of f.events) kinds.push(e.kind);
      f.events.length = 0;
      if (landedAt < 0 && a.state === 'cascade') {
        landedAt = f.t;
        expect(b.state).toBe('gone');
        expect(b.vol).toBe(0);
        expect(a.volK).toBeCloseTo(V0, 15);           // the partner's volume came along into the cascade
        expect(a.partner).toBe(-1);
        expect(f.bodies.filter((o) => o.state === 'merging').length).toBe(0);
      }
    }
    expect(landedAt).toBeGreaterThan(0);
    expect(landedAt).toBeLessThan(bridgeTime(0.02));   // it landed mid-bridge, not after a normal finish
    expect(kinds[0]).toBe('splash');
    expect(f.phase).toBe('idle');
    expect(Math.abs(f.volResidual)).toBeLessThan(1e-12 * V0);
  });

  it('a full family comes home: idle, every drop drained back, volume exact', () => {
    const f = firedFamily();
    f.mu = 50 * muRefAt(7.5);
    const env = testEnv({ gamma: 8, kappa: 0.03, vRef: sphereVol(f.rMain) });
    let events = 0;
    for (let i = 0; i < 120 / DROP_DT && f.phase === 'fired'; i++) {
      stepFamily(f, DROP_DT, env);
      for (const e of f.events) { expect(Number.isFinite(e.mode)).toBe(true); events++; }
      f.events.length = 0;
    }
    expect(f.phase).toBe('idle');
    expect(events).toBeGreaterThan(2);
    expect(Math.abs(f.volResidual)).toBeLessThan(1e-12 * f.volFamily);
  });
});

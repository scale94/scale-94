import { describe, it, expect } from 'vitest';
import {
  ACCELERATE_MS, COLLIDE_MS, PHASE_ID, TIMELINE, GEOMETRY, MODES, FREQ_CEILING_HZ, KNEE,
  createTiming, timingInto, modeFrequency, ringThreeWeight, mixHue01,
  kneeScale, easeIntegralS, dockCurve, snapMsFor, vertexArrival,
} from '../colliderPhases';

const at = (phase, ms) => timingInto(createTiming(), phase, ms);
const envelopes = (T) => [T.shockA, T.glint, T.cageA, T.needleA, ...T.ringA];

describe('collision timeline', () => {
  it('keeps the parent-owned durations', () => {
    expect(ACCELERATE_MS).toBe(1800);
    expect(COLLIDE_MS).toBe(2500);
    expect(PHASE_ID.colliding).toBe(3);
  });

  it('writes into the object it is given and allocates no replacement arrays', () => {
    const out = createTiming();
    const rings = out.ringA;
    expect(timingInto(out, 'colliding', 700)).toBe(out);
    expect(out.ringA).toBe(rings);
  });

  it('every emission is exactly zero from EMISSION_END_MS on', () => {
    expect(TIMELINE.EMISSION_END_MS).toBe(2400);
    for (const ms of [2400, 2401, 2425, 2450, 2499, 2500, 9000]) {
      for (const v of envelopes(at('colliding', ms))) expect(v).toBe(0);
    }
  });

  it('the needle envelope is exactly zero from 1200ms and full mid-crackle', () => {
    for (const ms of [1200, 1300, 2000]) expect(at('colliding', ms).needleA).toBe(0);
    expect(at('colliding', 800).needleA).toBe(1);
    expect(at('colliding', 400).needleA).toBe(0);
  });

  it('the shock is gone by 350ms and the glint by 40ms', () => {
    expect(at('colliding', 0).shockA).toBe(1);
    expect(at('colliding', 349).shockA).toBeGreaterThan(0);
    expect(at('colliding', 350).shockA).toBe(0);
    expect(at('colliding', 39).glint).toBeGreaterThan(0);
    expect(at('colliding', 40).glint).toBe(0);
  });

  it('rings launch on schedule and are silent before', () => {
    expect(at('colliding', 599).ringA[0]).toBe(0);
    expect(at('colliding', 700).ringA[0]).toBeGreaterThan(0);
    expect(at('colliding', 700).ringA[1]).toBe(0);
    expect(at('colliding', 850).ringA[1]).toBeGreaterThan(0);
    expect(at('colliding', 959).ringA[2]).toBe(0);
    expect(at('colliding', 1100).ringA[2]).toBeGreaterThan(0);
  });

  it('the cage exists only inside its window and fades its vertices 650..750', () => {
    expect(at('colliding', 0).cageT).toBe(0);
    expect(at('colliding', 799).cageT).toBeCloseTo(0.799, 9);
    expect(at('colliding', 800).cageT).toBe(-1);
    expect(at('colliding', 600).cageA).toBe(1);
    expect(at('colliding', 700).cageA).toBeCloseTo(0.5, 9);
    expect(at('colliding', 750).cageA).toBe(0);
  });

  it('squash starts at 0.6 through docking and relaxes monotonically', () => {
    expect(at('colliding', 0).squash).toBe(0.6);
    expect(at('colliding', 120).squash).toBe(0.6);
    let prev = 0;
    for (let ms = 0; ms < 800; ms += 10) {
      const s = at('colliding', ms).squash;
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
    expect(prev).toBeGreaterThan(0.95);
  });

  it('pinches the beam below half a pixel at T-0', () => {
    expect(GEOMETRY.W_WALL * Math.exp(-GEOMETRY.KAPPA_HI)).toBeLessThan(0.5);
  });

  it('accelerating: easeInCubic, clamped', () => {
    expect(at('accelerating', 0).ease).toBe(0);
    expect(at('accelerating', 900).ease).toBeCloseTo(0.125, 9);
    expect(at('accelerating', 9000).ease).toBe(1);
    expect(at('accelerating', 9000).progress).toBe(1);
  });

  it('is frame-rate independent', () => {
    const a = at('accelerating', 54 * (1000 / 60));
    const b = at('accelerating', 108 * (1000 / 120));
    expect(a.ease).toBeCloseTo(b.ease, 12);
  });

  it('idle, selecting and result are inert', () => {
    for (const p of ['idle', 'selecting', 'result']) {
      const T = at(p, 1234);
      for (const v of envelopes(T)) expect(v).toBe(0);
      expect(T.cageT).toBe(-1);
      expect(T.squash).toBe(1);
      expect(T.ease).toBe(0);
    }
  });

  it('never produces NaN', () => {
    for (const ms of [-1000, NaN, 1e9]) {
      const T = at('colliding', ms);
      for (const v of Object.values(T)) {
        for (const x of (typeof v === 'number' ? [v] : Array.from(v))) expect(Number.isFinite(x)).toBe(true);
      }
    }
  });
});

describe('ringdown modes', () => {
  it("keep benzene's frequency ratios within 3%", () => {
    const [ch, cc, br, oop] = MODES;
    for (const [a, b] of [[ch, oop], [cc, oop], [br, oop], [ch, br]]) {
      expect(Math.abs((a.f0 / b.f0) / (a.cm / b.cm) - 1)).toBeLessThan(0.03);
    }
  });

  it('never exceed the 18 Hz ceiling, which is reached at the lightest mass', () => {
    let max = 0;
    for (let i = 0; i <= 100; i++) for (const m of MODES) max = Math.max(max, modeFrequency(m.f0, i / 100));
    expect(max).toBeLessThanOrEqual(FREQ_CEILING_HZ);
    expect(modeFrequency(MODES[0].f0, 0)).toBe(FREQ_CEILING_HZ);
  });

  it('heavier pairs ring lower (omega ~ 1/sqrt(m))', () => {
    expect(modeFrequency(9.4, 1)).toBeLessThan(modeFrequency(9.4, 0));
  });
});

describe('ring three weight', () => {
  it('is 0 below 0.3, 1 above 0.7, and continuous', () => {
    expect(ringThreeWeight(0.3)).toBe(0);
    expect(ringThreeWeight(0.7)).toBe(1);
    let prev = ringThreeWeight(0);
    for (let i = 1; i <= 1000; i++) {
      const w = ringThreeWeight(i / 1000);
      expect(Math.abs(w - prev)).toBeLessThan(0.01);
      prev = w;
    }
  });
});

describe('mixHue01', () => {
  it('blends along the short arc, including across 0', () => {
    expect(mixHue01(0.1, 0.3)).toBeCloseTo(0.2, 9);
    const h = mixHue01(0.9, 0.1);
    expect(Math.min(h, 1 - h)).toBeLessThan(1e-9);
  });
});

describe('kneeScale', () => {
  it('is the identity at and below the knee', () => {
    for (const m of [0, 0.3, KNEE]) expect(kneeScale(m)).toBe(1);
  });
  it('matches f = knee + s*t/(t+s) and never reaches 1', () => {
    expect(1 * kneeScale(1)).toBeCloseTo(0.6 + 0.4 * 0.4 / 0.8, 12);
    expect(1e6 * kneeScale(1e6)).toBeLessThan(1);
  });
  it('is monotonic in its output', () => {
    let prev = 0;
    for (let m = 0; m < 50; m += 0.05) {
      const y = m * kneeScale(m);
      expect(y).toBeGreaterThanOrEqual(prev);
      prev = y;
    }
  });
});

describe('easeIntegralS', () => {
  const T = ACCELERATE_MS / 1000;
  it('is zero at zero and T/4 at T', () => {
    expect(easeIntegralS(0)).toBe(0);
    expect(easeIntegralS(T)).toBeCloseTo(T / 4, 12);
  });
  it('has slope ease(t) inside the window and 1 beyond it', () => {
    const h = 1e-6;
    expect((easeIntegralS(0.9 + h) - easeIntegralS(0.9 - h)) / (2 * h)).toBeCloseTo((0.9 / T) ** 3, 6);
    expect((easeIntegralS(T + 1 + h) - easeIntegralS(T + 1 - h)) / (2 * h)).toBeCloseTo(1, 6);
  });
});

describe('dockCurve', () => {
  it('starts at 0, overshoots 6-10%, and settles within 3% by DOCK_MS', () => {
    expect(dockCurve(0)).toBe(0);
    let peak = 0;
    for (let t = 0; t <= 0.3; t += 0.0005) peak = Math.max(peak, dockCurve(t));
    expect(peak).toBeGreaterThan(1.06);
    expect(peak).toBeLessThan(1.10);
    expect(Math.abs(1 - dockCurve(TIMELINE.DOCK_MS / 1000))).toBeLessThan(0.03);
  });
});

describe('vertexArrival', () => {
  it('shows each vertex at 30-40% alpha while it is still in flight', () => {
    // The docking flight is front-loaded (dockCurve ~0.35 at 20ms, ~0.8 at
    // 40ms). The bond ramp only starts at 40ms, so vertices get their own
    // earlier ramp: the eye can track them in from the beam tips.
    expect(vertexArrival(0)).toBe(0);
    expect(vertexArrival(-0.01)).toBe(0);
    for (const ms of [10, 20, 30, 38]) {
      expect(dockCurve(ms / 1000)).toBeLessThan(0.8);
      expect(vertexArrival(ms / 1000)).toBeGreaterThanOrEqual(0.3);
      expect(vertexArrival(ms / 1000)).toBeLessThanOrEqual(0.4);
    }
    expect(vertexArrival(0.09)).toBe(1);
  });

  it('never dims on the way in', () => {
    let prev = 0;
    for (let ms = 0; ms <= 120; ms += 0.5) {
      const a = vertexArrival(ms / 1000);
      expect(a).toBeGreaterThanOrEqual(prev);
      prev = a;
    }
  });
});

describe('snapMsFor', () => {
  it('freezes accelerating fully pinched and colliding on the rings', () => {
    expect(snapMsFor('accelerating')).toBe(1800);
    expect(snapMsFor('colliding')).toBe(1300);
    expect(snapMsFor('idle')).toBe(1800);
  });
  it('the colliding snap shows rings but no needles and no shock', () => {
    const T = at('colliding', snapMsFor('colliding'));
    expect(T.needleA).toBe(0);
    expect(T.shockA).toBe(0);
    expect(T.ringA[0]).toBeGreaterThan(0.3);
  });
});

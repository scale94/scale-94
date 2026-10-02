// src/terminal/mercury/planet/__tests__/breakupFamily.test.js
import { describe, it, expect } from 'vitest';
import {
  refreezeIn, qRotate, qRotateInv, breakExcess, canHold, canFire, createFamily, tongueAxis, chainLayout,
  holdTongue, fireFamily, nextSnapIn, TONGUE_LAG_S, SNAP_JITTER, MIN_RETURN_S, MERGE_MARGIN_S, MAX_MAIN_PER_TONGUE,
  cappedChainN, chainSpan, releaseLength,
} from '../breakupFamily';
import { TIERS } from '../planetQuality';
import { TONGUE_ROOT_R, TONGUE_MAX_R, rpWavelength, sphereVol } from '../breakupPhysics';
import { MAX_OMEGA } from '../mercuryBody';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const fired = (opts = {}, L = TONGUE_MAX_R) => {
  const f = createFamily(1);
  f.axisBody = [1, 0, 0];
  f.L = L;
  f.e = 1;
  return fireFamily(f, opts);
};

describe('breakupFamily — when the bead breaks, and into what', () => {
  it('quaternion helpers rotate and invert', () => {
    const s = Math.SQRT1_2, q = [0, s, 0, s]; // +90° about Y: x → −z
    const v = qRotate(q, [1, 0, 0]);
    expect(v[0]).toBeCloseTo(0, 12); expect(v[2]).toBeCloseTo(-1, 12);
    const back = qRotateInv(q, v);
    expect(back[0]).toBeCloseTo(1, 12); expect(back[2]).toBeCloseTo(0, 12);
  });

  it('excess is 0 at or below threshold, 1 at MAX_OMEGA, monotonic', () => {
    expect(breakExcess(7.5, 7.5)).toBe(0);
    expect(breakExcess(5, 7.5)).toBe(0);
    expect(breakExcess(MAX_OMEGA, 7.5)).toBe(1);
    expect(breakExcess(9, 7.5)).toBeLessThan(breakExcess(10, 7.5));
  });

  it('refreeze clock is the heat store\'s own decay', () => {
    expect(refreezeIn(80)).toBeCloseTo(Math.log(80 / 25) / 0.035, 9);
    expect(refreezeIn(25)).toBe(0);
  });

  it('holds only while dragging a fully liquid planet past threshold, never under CALM', () => {
    const ok = { dragging: true, tau: 1, omega: 9, omegaTh: 7.5, calm: false, phase: 'idle' };
    expect(canHold(ok)).toBe(true);
    expect(canHold({ ...ok, dragging: false })).toBe(false);
    expect(canHold({ ...ok, tau: 0.99 })).toBe(false);
    expect(canHold({ ...ok, omega: 7 })).toBe(false);
    expect(canHold({ ...ok, calm: true })).toBe(false);
    expect(canHold({ ...ok, phase: 'fired' })).toBe(false);
  });

  it('fires only on release from a hold, with enough time before refreeze', () => {
    const ok = { released: true, tau: 1, omega: 9, omegaTh: 7.5, calm: false, phase: 'hold', heatK: 80 };
    expect(canFire(ok)).toBe(true);
    expect(canFire({ ...ok, released: false })).toBe(false);
    expect(canFire({ ...ok, phase: 'idle' })).toBe(false);
    expect(canFire({ ...ok, phase: 'fired' })).toBe(false);
    const tooLate = 25 * Math.exp(0.035 * (MERGE_MARGIN_S + MIN_RETURN_S - 0.5));
    expect(canFire({ ...ok, heatK: tooLate })).toBe(false);
  });

  it('tongues sit on the spin equator, under the hand', () => {
    const a = tongueAxis([0, 1, 0], [0.6, 0.8, 0]);
    expect(Math.hypot(...a)).toBeCloseTo(1, 12);
    expect(dot(a, [0, 1, 0])).toBeCloseTo(0, 12);
    expect(a[0]).toBeCloseTo(1, 12);
    const b = tongueAxis([0, 1, 0], [0, 1, 0]); // drag point on the axis → any equatorial direction
    expect(dot(b, [0, 1, 0])).toBeCloseTo(0, 12);
    expect(Math.hypot(...tongueAxis([0, 0, 2], null))).toBeCloseTo(1, 12);
  });

  it('chain layout: bead count from λ, one wavelength of thread per main bead', () => {
    expect(chainLayout(0.01).N).toBe(1);
    expect(chainLayout(TONGUE_MAX_R).N).toBe(MAX_MAIN_PER_TONGUE);
    const { N, s, rMain } = chainLayout(TONGUE_MAX_R);
    expect(sphereVol(rMain)).toBeCloseTo(Math.PI * TONGUE_ROOT_R ** 2 * s, 12);
    expect(N * s).toBeCloseTo(TONGUE_MAX_R, 12);
  });

  it('the tongue loads with a capillary-time lag', () => {
    const f = createFamily(1);
    holdTongue(f, TONGUE_LAG_S, 1, 1);
    expect(f.L / TONGUE_MAX_R).toBeCloseTo(1 - Math.exp(-1), 9);
  });

  it('fires two opposed tongues; volume counted before anything flies', () => {
    const f = fired({ maxBodies: 16, satellites: true });
    expect(f.phase).toBe('fired');
    expect(f.N).toBe(4);
    const mains = f.bodies;
    expect(mains.length).toBe(8);
    for (let k = 0; k < 4; k++) {
      const a = mains[k].posBody, b = mains[4 + k].posBody;
      expect(a[0] + b[0]).toBeCloseTo(0, 12);
    }
    const expected = 8 * sphereVol(f.rMain) + 2 * 3 * sphereVol(f.rSat) + 2 * sphereVol(f.rSat);
    expect(f.volFamily).toBeCloseTo(expected, 15);
    expect(f.volOut).toBe(f.volFamily);
  });

  it('caps: satellites go first (their volume folded into the inner beads), then main beads', () => {
    const withSat = fired({ maxBodies: 16, satellites: true });
    const capped = fired({ maxBodies: 12, satellites: true });
    expect(capped.sat).toBe(false);
    expect(capped.N).toBe(4);
    expect(capped.volFamily).toBeCloseTo(withSat.volFamily, 15);
    const lite = fired({ maxBodies: 6, satellites: false });
    expect(lite.N).toBe(2);
    expect(2 * (lite.N + 1)).toBeLessThanOrEqual(6);
  });

  it('cappedChainN is the N fireFamily lays down, for every tier and excess', () => {
    for (const tier of Object.keys(TIERS)) {
      const { bodies, satellites } = TIERS[tier].drop;
      for (const e of [0, 0.25, 0.5, 0.75, 1]) {
        const f = fired({ maxBodies: bodies, satellites }, e * TONGUE_MAX_R);
        expect(cappedChainN(chainSpan(e * TONGUE_MAX_R), bodies, satellites)).toBe(f.N);
      }
    }
  });

  it('full tier (16 bodies, author 2026-10-02): a max fling keeps its satellites', () => {
    const { bodies, satellites } = TIERS.full.drop;
    const f = fired({ maxBodies: bodies, satellites }, TONGUE_MAX_R);
    expect(f.N).toBe(MAX_MAIN_PER_TONGUE);
    expect(f.sat).toBe(true);
    expect(f.necks.filter((n) => n.sat > 0).length).toBe(2 * (f.N - 1));
    // every body it will ever hold (mains + satellites + root stubs) fits the tier's arrays
    expect(2 * f.N + 2 * (f.N - 1) + 2).toBeLessThanOrEqual(bodies);
  });

  it('snaps: tip first, root last, spaced ≈ t_c with bounded jitter', () => {
    const f = fired({ maxBodies: 16 });
    for (const sign of [0, 1]) {
      const ns = f.necks.slice(sign * f.N, sign * f.N + f.N);
      expect(ns[ns.length - 1].b).toBe(-1);
      for (let k = 0; k < ns.length; k++) {
        expect(Math.abs(ns[k].tSnap / TONGUE_LAG_S - (k + 1))).toBeLessThanOrEqual(SNAP_JITTER + 1e-12);
        if (k > 0) expect(ns[k].tSnap).toBeGreaterThan(ns[k - 1].tSnap);
      }
    }
    expect(nextSnapIn(f)).toBeCloseTo(Math.min(...f.necks.map((n) => n.tSnap)), 12);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(fired({ maxBodies: 16 }))).toBe(JSON.stringify(fired({ maxBodies: 16 })));
  });

  it('a short tongue still makes one bead of one wavelength', () => {
    const f = fired({ maxBodies: 16 }, 0.001);
    expect(f.N).toBe(1);
    expect(f.L).toBeCloseTo(rpWavelength(TONGUE_ROOT_R), 12);
  });

  // Author 2026-10-02: a real swipe holds above threshold for ~0.2 s, too short to grow the tongue, so the
  // tongue is sized from the release ω too (the hold's own excess law); a hold still grows it visibly.
  describe('release-sized tongue', () => {
    const fireAt = (omega, holdS, tier) => {
      const { bodies, satellites } = TIERS[tier].drop;
      const f = createFamily(1);
      f.axisBody = [1, 0, 0]; f.phase = 'hold';
      const e = breakExcess(omega, 7.5);
      for (let t = 0; t < holdS; t += 1 / 60) holdTongue(f, 1 / 60, e, 1);
      f.e = e;
      return fireFamily(f, { maxBodies: bodies, satellites, gain: 1 });
    };

    it('a zero-hold fire at ω 12 lays the max chain per tier, as a long hold does', () => {
      for (const tier of Object.keys(TIERS)) {
        const swipe = fireAt(MAX_OMEGA, 1 / 60, tier), held = fireAt(MAX_OMEGA, 20 * TONGUE_LAG_S, tier);
        const { bodies, satellites } = TIERS[tier].drop;
        expect(swipe.N, tier).toBe(cappedChainN(chainSpan(TONGUE_MAX_R), bodies, satellites));
        expect(swipe.N, tier).toBe(held.N);
        expect(swipe.L, tier).toBeCloseTo(held.L, 9);
        expect(swipe.L, tier).toBeCloseTo(TONGUE_MAX_R, 12);
      }
      expect(fireAt(MAX_OMEGA, 1 / 60, 'full').N).toBe(MAX_MAIN_PER_TONGUE);
    });

    it('an intermediate ω gets the excess-law chain', () => {
      const e = breakExcess(9.5, 7.5);
      const f = fireAt(9.5, 1 / 60, 'full');
      expect(f.L).toBeCloseTo(chainSpan(e * TONGUE_MAX_R), 12);
      expect(f.N).toBe(cappedChainN(chainSpan(e * TONGUE_MAX_R), 16, true));
      expect(f.N).toBe(2);
    });

    it('a tongue held longer than the release asks for keeps its length (L_fire = L_hold, no extrude)', () => {
      const f = createFamily(1);
      f.axisBody = [1, 0, 0]; f.phase = 'hold'; f.L = TONGUE_MAX_R; f.e = 0.5;
      fireFamily(f, { maxBodies: 16, satellites: true, gain: 1 });
      expect(f.L).toBeCloseTo(TONGUE_MAX_R, 12);
      expect(f.ext0).toBe(1);
      expect(releaseLength(TONGUE_MAX_R, 0.5, 1)).toBe(TONGUE_MAX_R);
      expect(releaseLength(0.1, 1, 1)).toBe(TONGUE_MAX_R);
    });

    it('a short hold fired long starts its extrude at the held tip', () => {
      const f = fireAt(MAX_OMEGA, 1 / 60, 'full');
      expect(f.ext0).toBeGreaterThan(0);
      expect(f.ext0).toBeLessThan(0.5);
    });
  });
});

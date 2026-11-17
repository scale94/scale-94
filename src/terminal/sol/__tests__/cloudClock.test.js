import { describe, it, expect } from 'vitest';
import { makeCloud, cloudStatus } from '../cloudClock';
import { transitMs as transitFor, L1_KM, MERCURY_FRACTION } from '../solPhysics';

const H = 3600e3;
const t0 = Date.UTC(2026, 10, 17, 12, 0, 0);

const strong = (handedness = 'cw', extra = {}) => ({
  ...makeCloud({ energyErg: 5e32, handedness, origin: 'hand' }, t0, 'c1'),
  ...extra,
});

const noBadNumbers = (s) => {
  for (const [k, v] of Object.entries(s)) {
    if (typeof v === 'number') {
      expect(Number.isFinite(v), k).toBe(true);
      if (k !== 'stormNt') expect(v, k).toBeGreaterThanOrEqual(0);
    }
  }
};

describe('makeCloud', () => {
  it('stores launch, energy, transit from energy, handedness, origin, unwitnessed', () => {
    const c = makeCloud({ energyErg: 5e32, handedness: 'cw', origin: 'star' }, t0, 'x');
    expect(c).toEqual({
      id: 'x', launchedAt: t0, energyErg: 5e32, transitMs: Math.round(transitFor(5e32)),
      handedness: 'cw', origin: 'star', witnessed: false,
    });
    expect(c.transitMs).toBeCloseTo(17.6 * H, 0);
  });
});

describe('cloudStatus', () => {
  it('at launch: in flight, nothing read', () => {
    const s = cloudStatus(strong(), t0);
    expect(s.phase).toBe('flight');
    expect(s.progress01).toBe(0);
    expect(s.orientation).toBeNull();
    expect(s.coupled).toBeNull();
    expect(s.stormNt).toBeNull();
    expect(s.mercuryPassed).toBe(false);
    expect(s.fate).toBeNull();
    expect(s.etaMs).toBe(Math.round(17.6 * H));
  });

  it('crosses Mercury at 0.387 of the transit', () => {
    const c = strong();
    const s = cloudStatus(c, t0);
    expect(Math.abs(s.mercuryAt - t0 - MERCURY_FRACTION * 17.6 * H)).toBeLessThan(1);
    expect(cloudStatus(c, s.mercuryAt - 1).mercuryPassed).toBe(false);
    expect(cloudStatus(c, s.mercuryAt).mercuryPassed).toBe(true);
  });

  it('is read at L1, about ten minutes before arrival for the fastest cloud', () => {
    const s = cloudStatus(strong(), t0);
    const leadS = (s.arrivalAt - s.readAt) / 1000;
    const speed = 1.496e8 / (17.6 * 3600);
    expect(Math.abs(leadS - L1_KM / speed)).toBeLessThan(2);
    expect(Math.abs(leadS - 1.5e6 / 2361)).toBeLessThan(2);
  });

  it('the weakest cloud is read 40-45 minutes out', () => {
    const c = makeCloud({ energyErg: 1e29, handedness: 'cw', origin: 'hand' }, t0, 'w');
    const s = cloudStatus(c, t0);
    const leadMin = (s.arrivalAt - s.readAt) / 60e3;
    expect(leadMin).toBeGreaterThan(40);
    expect(leadMin).toBeLessThan(45);
  });

  it('just after the read: southward, coupled, -1200 nT', () => {
    const c = strong();
    const { readAt } = cloudStatus(c, t0);
    expect(cloudStatus(c, readAt - 1).orientation).toBeNull();
    const s = cloudStatus(c, readAt + 1);
    expect(s.phase).toBe('flight');
    expect(s.orientation).toBe('southward');
    expect(s.coupled).toBe(true);
    expect(s.stormNt).toBe(-1200);
    expect(s.fate).toBeNull();
  });

  it('storm runs from arrival for its duration', () => {
    const c = strong();
    const { arrivalAt } = cloudStatus(c, t0);
    const s = cloudStatus(c, arrivalAt + 6 * H);
    expect(s.phase).toBe('storm');
    expect(s.storm01).toBeCloseTo(0.5, 6);
    expect(s.fate).toBe('coupled');
    expect(s.stormEndAt).toBe(arrivalAt + 12 * H);
    expect(s.progress01).toBe(1);
    expect(s.etaMs).toBe(0);
  });

  it('after the storm: unwitnessed unless witnessed', () => {
    const c = strong();
    const { arrivalAt } = cloudStatus(c, t0);
    const missed = cloudStatus(c, arrivalAt + 13 * H);
    expect(missed.phase).toBe('landed');
    expect(missed.fate).toBe('unwitnessed');
    expect(missed.storm01).toBeNull();
    expect(missed.stormNt).toBe(-1200);
    expect(cloudStatus({ ...c, witnessed: true }, arrivalAt + 13 * H).fate).toBe('coupled');
  });

  it('a counter-clockwise cloud passes on arrival, no storm', () => {
    const c = strong('ccw');
    const { arrivalAt } = cloudStatus(c, t0);
    const s = cloudStatus(c, arrivalAt + 1);
    expect(s.phase).toBe('landed');
    expect(s.orientation).toBe('northward');
    expect(s.coupled).toBe(false);
    expect(s.fate).toBe('passed');
    expect(s.stormNt).toBeNull();
    expect(s.stormEndAt).toBeNull();
    expect(s.storm01).toBeNull();
  });

  it('clock behind launch: clamps to launch (Review Focus 1)', () => {
    const c = strong();
    const s = cloudStatus(c, t0 - 5000);
    expect(s.progress01).toBe(0);
    expect(s.phase).toBe('flight');
    expect(s.etaMs).toBe(c.transitMs);
    noBadNumbers(s);
  });

  it('a garbage now behaves as launch', () => {
    const s = cloudStatus(strong(), NaN);
    expect(s.phase).toBe('flight');
    noBadNumbers(s);
  });

  it('hours-long jump lands with no intermediate call (Review Focus 3)', () => {
    expect(cloudStatus(strong(), t0 + 100 * H).phase).toBe('landed');
  });

  it('at progress midway: progress01 and eta agree', () => {
    const c = strong();
    const s = cloudStatus(c, t0 + c.transitMs / 2);
    expect(s.progress01).toBeCloseTo(0.5, 9);
    expect(s.etaMs).toBe(c.transitMs / 2);
    noBadNumbers(s);
  });
});

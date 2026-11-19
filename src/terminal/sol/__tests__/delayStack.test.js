import { describe, it, expect } from 'vitest';
import { messengers, protonsArriveAt, yearOf } from '../delayStack';

const t0 = Date.UTC(2026, 10, 19, 12, 0, 0);
const cloud = { id: 'a', launchedAt: t0, energyErg: 5e32, transitMs: 17.6 * 3600e3, handedness: 'cw', origin: 'hand', witnessed: false };

describe('delayStack', () => {
  it('yearOf is the UTC year', () => {
    expect(yearOf(t0)).toBe(2026);
  });
  it('five messengers in order', () => {
    expect(messengers(cloud, t0).map((m) => m.key)).toEqual(['neutrinos', 'light', 'protons', 'cloud', 'core']);
  });
  it('neutrinos and light arrive together at +499 s; reading null before', () => {
    const before = messengers(cloud, t0 + 498e3);
    expect(before[0]).toMatchObject({ arrived: false, reading: null, etaMs: 1e3 });
    expect(before[1]).toMatchObject({ arrived: false, reading: null });
    const after = messengers(cloud, t0 + 499e3);
    expect(after[0]).toMatchObject({ arrived: true, reading: { detected: false }, etaMs: 0 });
    expect(after[1].reading).toEqual({ ageS: 499, xray: 'X45' });
  });
  it('protons arrive at +499 s + onset with an S reading', () => {
    const at = protonsArriveAt(cloud);
    expect(at).toBeCloseTo(t0 + 499e3 + 15 * 60e3, 0);
    expect(messengers(cloud, at - 1)[2].reading).toBeNull();
    expect(messengers(cloud, at)[2].reading.s).toBe('S5');
  });
  it('the cloud entry mirrors cloudStatus', () => {
    const m = messengers(cloud, t0 + 18 * 3600e3)[3];
    expect(m.arrived).toBe(true);
    expect(m.reading.orientation).toBe('southward');
  });
  it('the core photon surfaces 170 000 years after the launch year, never arrives', () => {
    const core = messengers(cloud, t0 + 1e12)[4];
    expect(core).toEqual({ key: 'core', arrivesAt: null, arrivesYear: 172026, arrived: false, etaMs: null, reading: null });
  });
  it('a clock behind the launch reads as the launch moment', () => {
    for (const now of [t0 - 3600e3, NaN, -Infinity]) {
      const ms = messengers(cloud, now);
      expect(ms.some((m) => m.arrived)).toBe(false);
      for (const m of ms) if (m.etaMs != null) { expect(m.etaMs).toBeGreaterThan(0); expect(Number.isFinite(m.etaMs)).toBe(true); }
    }
  });
});

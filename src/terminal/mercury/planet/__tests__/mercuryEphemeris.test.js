// src/terminal/mercury/planet/__tests__/mercuryEphemeris.test.js
import { describe, it, expect } from 'vitest';
import { mercuryEphemeris } from '../mercuryEphemeris';

// JPL Horizons, observer 500@399, QUANTITIES 15,19. East = 360 − Horizons west.
const HORIZONS = [
  { utc: Date.UTC(2000, 0, 1, 12), lonE: 94.456145,  r: 0.466468841931, rdot:  0.6185367 },
  { utc: Date.UTC(2025, 0, 1, 0),  lonE: 149.178496, r: 0.420276859525, rdot:  8.2420807 },
  { utc: Date.UTC(2026, 9, 1, 0),  lonE: 257.860623, r: 0.464866555993, rdot: -1.7490483 },
  { utc: Date.UTC(2026, 11, 26, 0), lonE: 84.503355, r: 0.466316966154, rdot: -0.7998683 },
];

const angDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

describe('mercuryEphemeris vs JPL Horizons', () => {
  for (const ref of HORIZONS) {
    const iso = new Date(ref.utc).toISOString();
    it(`matches heliocentric range at ${iso}`, () => {
      expect(Math.abs(mercuryEphemeris(ref.utc).r - ref.r)).toBeLessThan(2e-4);
    });
    it(`matches range-rate at ${iso}`, () => {
      expect(Math.abs(mercuryEphemeris(ref.utc).rdotKmS - ref.rdot)).toBeLessThan(0.05);
    });
    it(`matches sub-solar east longitude at ${iso}`, () => {
      expect(angDiff(mercuryEphemeris(ref.utc).subsolarLonDeg, ref.lonE)).toBeLessThan(0.3);
    });
    it(`keeps the Sun on the equator at ${iso} (obliquity ~0)`, () => {
      expect(Math.abs(mercuryEphemeris(ref.utc).subsolarLatDeg)).toBeLessThan(0.1);
    });
  }

  it('spans perihelion 0.3075 AU to aphelion 0.4667 AU over one orbit', () => {
    let lo = Infinity, hi = -Infinity;
    const t0 = Date.UTC(2026, 0, 1);
    for (let h = 0; h < 88 * 24; h += 1) {
      const { r } = mercuryEphemeris(t0 + h * 3600e3);
      lo = Math.min(lo, r); hi = Math.max(hi, r);
    }
    expect(lo).toBeCloseTo(0.3075, 3);
    expect(hi).toBeCloseTo(0.4667, 3);
  });

  it('puts the subsolar point on a hot pole (0° or 180°) at perihelion — the 3:2 lock', () => {
    let best = { r: Infinity, t: 0 };
    const t0 = Date.UTC(2026, 0, 1);
    for (let m = 0; m < 88 * 24 * 60; m += 10) {
      const t = t0 + m * 60e3;
      const { r } = mercuryEphemeris(t);
      if (r < best.r) best = { r, t };
    }
    const lon = mercuryEphemeris(best.t).subsolarLonDeg;
    expect(Math.min(angDiff(lon, 0), angDiff(lon, 180))).toBeLessThan(1.0);
  });

  it('gives the Sun an angular radius of ~0.87° at perihelion and ~0.57° at aphelion', () => {
    const deg = (x) => (x * 180) / Math.PI;
    let lo = Infinity, hi = -Infinity;
    const t0 = Date.UTC(2026, 0, 1);
    for (let h = 0; h < 88 * 24; h += 6) {
      const a = deg(mercuryEphemeris(t0 + h * 3600e3).sunAngularRadiusRad);
      lo = Math.min(lo, a); hi = Math.max(hi, a);
    }
    expect(hi).toBeCloseTo(0.866, 1);
    expect(lo).toBeCloseTo(0.571, 1);
  });
});

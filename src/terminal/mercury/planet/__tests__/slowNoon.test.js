// src/terminal/mercury/planet/__tests__/slowNoon.test.js — THE SLOW NOON model (spec 2026-10-03).
import { describe, it, expect } from 'vitest';
import {
  DAY_MS, SOLAR_DAY_D, CALORIS, CALORIS_DIR_BODY, CALORIS_ANG_RAD, OVERLAY_FADE_S,
  calorisHour, phaseWord, sunLonRate, retroWindow, slowNoonState, rosettePath, loupePath,
  formatReadouts, stepOverlay,
} from '../slowNoon';
import { mercuryEphemeris } from '../mercuryEphemeris';
import { dirFromLonLat } from '../planetFrame';

const NOW = Date.UTC(2026, 9, 3, 12);           // 2026-10-03T12:00Z
const IN_RETRO = Date.UTC(2026, 10, 10);         // 2026-11-10T00:00Z
const day = (iso) => Date.parse(iso);

describe('Caloris clock', () => {
  it('is 12:00 when the Sun is over Caloris and 06:00 a quarter turn before', () => {
    expect(calorisHour(CALORIS.lonDeg)).toBeCloseTo(12, 10);
    expect(calorisHour(CALORIS.lonDeg + 90)).toBeCloseTo(6, 10);
    expect(calorisHour(CALORIS.lonDeg - 90)).toBeCloseTo(18, 10);
    expect(calorisHour(CALORIS.lonDeg + 180)).toBeCloseTo(0, 10);
  });

  it('names the hour', () => {
    expect(phaseWord(3)).toBe('NIGHT');
    expect(phaseWord(6)).toBe('DAWN');
    expect(phaseWord(9)).toBe('MORNING');
    expect(phaseWord(12)).toBe('NOON');
    expect(phaseWord(15)).toBe('AFTERNOON');
    expect(phaseWord(18)).toBe('DUSK');
    expect(phaseWord(20)).toBe('NIGHT');
  });

  it('reads 06:12 (dawn) at Caloris on 2026-10-03T12:00Z, 0.461 AU, approaching', () => {
    const s = slowNoonState(NOW);
    expect(Math.abs(s.hour - (6 + 12 / 60))).toBeLessThan(2 / 60);
    expect(s.phaseWord).toBe('DAWN');
    expect(s.rAU).toBeCloseTo(0.4615, 3);
    expect(s.sunScale).toBeCloseTo(1 / s.rAU, 12);
    expect(s.receding).toBe(false);
  });

  it('Caloris is on the far side today and faces the camera on 2026-12-01', () => {
    expect(slowNoonState(NOW).calorisFacing).toBe(false);
    expect(slowNoonState(Date.UTC(2026, 11, 1)).calorisFacing).toBe(true);
  });
});

describe('the Sun turns back', () => {
  it('returns no window for a non-finite time instead of scanning forever', () => {
    expect(retroWindow(NaN)).toBeNull();
    expect(retroWindow(Infinity)).toBeNull();
  });

  it('normally moves west (rate < 0), and east inside the window', () => {
    expect(sunLonRate(NOW)).toBeLessThan(0);
    expect(sunLonRate(IN_RETRO)).toBeGreaterThan(0);
  });

  it('finds the 2026-11 window around the 2026-11-10 perihelion', () => {
    const w = retroWindow(NOW);
    expect(Math.abs(w.startMs - day('2026-11-06T12:00Z')) / DAY_MS).toBeLessThan(0.75);
    expect(Math.abs(w.endMs - day('2026-11-14T12:00Z')) / DAY_MS).toBeLessThan(0.75);
    expect(Math.abs(w.periMs - day('2026-11-10T08:38Z')) / DAY_MS).toBeLessThan(0.1);
    expect(mercuryEphemeris(w.periMs).r).toBeLessThan(mercuryEphemeris(w.periMs - DAY_MS).r);
    expect(mercuryEphemeris(w.periMs).r).toBeLessThan(mercuryEphemeris(w.periMs + DAY_MS).r);
  });

  it('inside the window returns the same window, active, counting days', () => {
    const before = slowNoonState(NOW);
    const s = slowNoonState(IN_RETRO);
    expect(Math.abs(s.retro.startMs - before.retro.startMs)).toBeLessThan(2 * 3600000);
    expect(s.retro.active).toBe(true);
    expect(s.retro.days).toBe(8);
    expect(s.retro.dayIndex).toBe(4);
    expect(s.daysToRetro).toBe(0);
  });

  it('never counts past the last day near the end of the window', () => {
    // Get window from a known-active time and check that dayIndex never exceeds days
    const sBase = slowNoonState(IN_RETRO);
    const w = sBase.retro;
    expect(w.days).toBe(8);
    // Test at the last day boundary: near the end but still active
    const lastDayStart = w.startMs + (w.days - 1) * DAY_MS;
    const s = slowNoonState(lastDayStart + DAY_MS - 60000);
    expect(s.retro.active).toBe(true);
    expect(s.retro.dayIndex).toBeLessThanOrEqual(s.retro.days);
    expect(s.retro.dayIndex).toBe(s.retro.days);
  });

  it('counts days to the next window', () => {
    expect(slowNoonState(NOW).daysToRetro).toBe(34);
  });

  it('the Caloris hour only runs backwards inside the window', () => {
    const w = retroWindow(NOW);
    let prev = slowNoonState(NOW).hour;
    for (let t = NOW + DAY_MS / 4; t < w.endMs + 5 * DAY_MS; t += DAY_MS / 4) {
      const h = calorisHour(mercuryEphemeris(t).subsolarLonDeg);
      const inside = t > w.startMs + DAY_MS / 4 && t < w.endMs - DAY_MS / 4;
      const outside = t < w.startMs - DAY_MS / 4 || t > w.endMs + DAY_MS / 4;
      if (inside) expect(h).toBeLessThan(prev);
      if (outside) expect(h).toBeGreaterThan(prev);
      prev = h;
    }
  });
});

describe('the rosette', () => {
  it('closes after one solar day (the 3:2 resonance)', () => {
    const a = mercuryEphemeris(NOW), b = mercuryEphemeris(NOW + SOLAR_DAY_D * DAY_MS);
    expect(Math.abs(calorisHour(a.subsolarLonDeg) - calorisHour(b.subsolarLonDeg))).toBeLessThan(0.05);
    expect(Math.abs(a.r - b.r)).toBeLessThan(1e-4);
  });

  it('rosettePath spans one solar day centred on its argument', () => {
    const p = rosettePath(NOW);
    expect(p.length).toBe(Math.floor(SOLAR_DAY_D / 0.25) + 1);
    expect((p[p.length - 1].t - p[0].t) / DAY_MS).toBeCloseTo(Math.floor(SOLAR_DAY_D / 0.25) * 0.25, 6);
    expect(Math.abs((p[0].t + p[p.length - 1].t) / 2 - NOW) / DAY_MS).toBeLessThan(0.25);
    const minima = p.filter((q, i) => i > 0 && i < p.length - 1 && q.rAU < p[i - 1].rAU && q.rAU <= p[i + 1].rAU);
    expect(minima.length).toBe(2);
  });

  it('loupePath covers the window with padding', () => {
    const w = retroWindow(NOW);
    const p = loupePath(w);
    expect(p[0].t).toBeCloseTo(w.startMs - 1.5 * DAY_MS, -3);
    expect(p[p.length - 1].t).toBeGreaterThan(w.endMs + 1.4 * DAY_MS);
  });
});

describe('readouts', () => {
  it('today', () => {
    expect(formatReadouts(slowNoonState(NOW))).toEqual([
      '06:12 · DAWN AT CALORIS',
      "SUN 0.461 AU · 2.2× EARTH'S SKY · APPROACHING",
      'SUN STANDS IN 34 d · MORNING AT PERIHELION',
    ]);
  });

  it('inside the window', () => {
    expect(formatReadouts(slowNoonState(IN_RETRO))[2]).toBe('THE SUN TURNS BACK · DAY 4 OF 8');
  });
});

describe('overlay constants and easing', () => {
  it('Caloris direction is the body-frame unit vector at 162.7E 31.5N', () => {
    expect(CALORIS_DIR_BODY).toEqual(dirFromLonLat(162.7, 31.5));
    expect(Math.hypot(...CALORIS_DIR_BODY)).toBeCloseTo(1, 12);
    expect(CALORIS_ANG_RAD).toBeCloseTo(18.2 * Math.PI / 180, 12);
  });

  it('stepOverlay eases linearly over OVERLAY_FADE_S and snaps when calm', () => {
    expect(stepOverlay(0, 1, OVERLAY_FADE_S / 2, false)).toBeCloseTo(0.5, 12);
    expect(stepOverlay(0.9, 1, 1, false)).toBe(1);
    expect(stepOverlay(1, 0, OVERLAY_FADE_S / 4, false)).toBeCloseTo(0.75, 12);
    expect(stepOverlay(0.1, 0, 1, false)).toBe(0);
    expect(stepOverlay(0, 1, 0.001, true)).toBe(1);
    expect(stepOverlay(1, 0, 0.001, true)).toBe(0);
  });
});

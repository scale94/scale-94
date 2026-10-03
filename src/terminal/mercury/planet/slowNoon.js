// src/terminal/mercury/planet/slowNoon.js — THE SLOW NOON: one day at Caloris, made readable.
//
// The Sun sits at a fixed phase angle to the camera (planetFrame.js), so the disc centre is
// always mid-afternoon; the readable clock is a PLACE. Caloris (162.7E 31.5N) lies near the 180°
// hot pole: perihelion falls in its late morning, where the Sun stands and turns back.
// Hour = 12 + hour angle / 15°, 24 Mercury-hours per 176-day solar day. Everything is derived from
// mercuryEphemeris.js (its precision boundary applies). Spec: 2026-10-03-mercury-slow-noon-design.md.

import { mercuryEphemeris } from './mercuryEphemeris';
import { dirFromLonLat, rotY, bodyYawFor } from './planetFrame';

export const DAY_MS = 86400000;
export const SOLAR_DAY_D = 175.9421;
export const TRAIL_DAYS = 15;
export const SLOW_NOON_REFRESH_MS = 10000;

export const CALORIS = Object.freeze({ lonDeg: 162.7, latDeg: 31.5, angRadDeg: 18.2 });
export const CALORIS_DIR_BODY = Object.freeze(dirFromLonLat(CALORIS.lonDeg, CALORIS.latDeg));
export const CALORIS_ANG_RAD = CALORIS.angRadDeg * Math.PI / 180;

// Hairlines on the planet (mercuryPlanetShader.js): linear colour, opacity, tick arm in px.
export const OVERLAY_LINE_LIN = Object.freeze([0.55, 0.57, 0.62]);
export const OVERLAY_ALPHA = 0.85;
export const SUBSOLAR_TICK_PX = 6;
export const OVERLAY_FADE_S = 0.25;

const SCAN_STEP_MS = 0.05 * DAY_MS;
const SCAN_SPAN_MS = 120 * DAY_MS;
const BISECT_MS = 3600000;

const wrap180 = (x) => x - 360 * Math.floor((x + 180) / 360);

export function calorisHour(subsolarLonDeg) {
  const h = 12 + wrap180(CALORIS.lonDeg - subsolarLonDeg) / 15;
  return ((h % 24) + 24) % 24;
}

export function phaseWord(hour) {
  if (hour < 5.5 || hour >= 18.5) return 'NIGHT';
  if (hour < 6.5) return 'DAWN';
  if (hour < 11.5) return 'MORNING';
  if (hour < 12.5) return 'NOON';
  if (hour < 17.5) return 'AFTERNOON';
  return 'DUSK';
}

// The Sun's motion over the surface, deg/day: negative normally, positive while it turns back.
export function sunLonRate(tMs) {
  const h = 0.01 * DAY_MS;
  return wrap180(mercuryEphemeris(tMs + h).subsolarLonDeg - mercuryEphemeris(tMs - h).subsolarLonDeg) / 0.02;
}

const turningBack = (tMs) => sunLonRate(tMs) > 0;

// Bisect the sign change of turningBack inside [aMs, bMs] to under an hour.
function edge(aMs, bMs) {
  const want = turningBack(bMs);
  while (bMs - aMs > BISECT_MS) {
    const m = (aMs + bMs) / 2;
    if (turningBack(m) === want) bMs = m; else aMs = m;
  }
  return (aMs + bMs) / 2;
}

// The window that contains nowMs, else the next one (null if none within SCAN_SPAN_MS).
export function retroWindow(nowMs) {
  let t = nowMs;
  if (turningBack(t)) {
    while (turningBack(t - SCAN_STEP_MS)) t -= SCAN_STEP_MS;
    t -= SCAN_STEP_MS;
  } else {
    while (!turningBack(t + SCAN_STEP_MS)) {
      t += SCAN_STEP_MS;
      if (t - nowMs > SCAN_SPAN_MS) return null;
    }
  }
  const startMs = edge(t, t + SCAN_STEP_MS);
  let e = startMs + SCAN_STEP_MS;
  while (turningBack(e)) e += SCAN_STEP_MS;
  const endMs = edge(e - SCAN_STEP_MS, e);
  let periMs = startMs, rMin = Infinity;
  for (let x = startMs; x <= endMs; x += SCAN_STEP_MS) {
    const r = mercuryEphemeris(x).r;
    if (r < rMin) { rMin = r; periMs = x; }
  }
  return { startMs, endMs, periMs };
}

export function slowNoonState(nowMs) {
  const eph = mercuryEphemeris(nowMs);
  const hour = calorisHour(eph.subsolarLonDeg);
  const w = retroWindow(nowMs);
  const active = !!w && nowMs >= w.startMs && nowMs < w.endMs;
  // Facing = at the HOME orientation (the ephemeris yaw), not a live drag; camera on +Z.
  const cal = rotY(CALORIS_DIR_BODY, bodyYawFor(eph.subsolarLonDeg));
  const days = w ? Math.round((w.endMs - w.startMs) / DAY_MS) : 0;
  return {
    hour,
    phaseWord: phaseWord(hour),
    rAU: eph.r,
    sunScale: 1 / eph.r,
    receding: eph.rdotKmS > 0,
    retro: w && {
      ...w,
      active,
      days,
      dayIndex: active ? Math.min(days, Math.floor((nowMs - w.startMs) / DAY_MS) + 1) : 0,
      periHour: calorisHour(mercuryEphemeris(w.periMs).subsolarLonDeg),
    },
    daysToRetro: !w ? null : active ? 0 : Math.ceil((w.startMs - nowMs) / DAY_MS),
    calorisFacing: cal[2] > 0,
  };
}

function sample(tMs) {
  const e = mercuryEphemeris(tMs);
  return { t: tMs, hour: calorisHour(e.subsolarLonDeg), rAU: e.r };
}

export function rosettePath(centerMs, stepDays = 0.25) {
  const pts = [];
  const half = SOLAR_DAY_D / 2;
  const n = Math.floor(SOLAR_DAY_D / stepDays);
  for (let i = 0; i <= n; i++) pts.push(sample(centerMs + (i * stepDays - half) * DAY_MS));
  return pts;
}

export function loupePath({ startMs, endMs }, padDays = 1.5) {
  const pts = [];
  for (let t = startMs - padDays * DAY_MS; t <= endMs + padDays * DAY_MS; t += SCAN_STEP_MS) pts.push(sample(t));
  return pts;
}

function hhmm(hour) {
  const m = Math.floor(hour * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function formatReadouts(s) {
  const l1 = `${hhmm(s.hour)} · ${s.phaseWord} AT CALORIS`;
  const l2 = `SUN ${s.rAU.toFixed(3)} AU · ${s.sunScale.toFixed(1)}× EARTH'S SKY · ${s.receding ? 'RECEDING' : 'APPROACHING'}`;
  let l3 = '';
  if (s.retro?.active) l3 = `THE SUN TURNS BACK · DAY ${s.retro.dayIndex} OF ${s.retro.days}`;
  else if (s.retro) l3 = `SUN STANDS IN ${s.daysToRetro} d · ${phaseWord(s.retro.periHour)} AT PERIHELION`;
  return [l1, l2, l3];
}

// Linear ease of the overlay toward goal over OVERLAY_FADE_S; reduced motion snaps.
export function stepOverlay(value, goal, dtS, calm) {
  if (calm) return goal;
  const k = dtS / OVERLAY_FADE_S;
  return value < goal ? Math.min(goal, value + k) : Math.max(goal, value - k);
}

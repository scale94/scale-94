// lunarEphemeris.js — the moon's three clocks.
//
// PRECISION BOUNDARY, stated so no reader assumes more (spec §6.3):
// this is a simplified analytic model using the *linear* terms of Meeus,
// Astronomical Algorithms ch. 47, plus the two largest periodic terms of the
// distance expansion. It has the right amplitudes, the right periods, and the
// right beating between them. It is NOT JPL-accurate in absolute position and
// must not be presented as such. The tab's "NO ESOTERICISM / CITED" stance is
// a claim about mechanism, not about arcseconds.
//
// Substituting real ELP terms later changes this file and nothing else.

import { SYNODIC_PERIOD } from './synodic';

export const DAY_MS = 86400000;
export const ANOMALISTIC_MONTH = 27.55454988;
export const DRACONIC_MONTH = 27.21222082;

const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const JULIAN_CENTURY_MS = 36525 * DAY_MS;
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

// Mean distance and the two largest periodic terms (Meeus 47.a, km).
const MEAN_DISTANCE_KM = 385000.56;
const TERM_ANOMALY_KM = 20905.355;   // eccentricity
const TERM_EVECTION_KM = 3699.111;   // evection
const LUNAR_RADIUS_KM = 1737.4;

function julianCenturies(t) {
  return (t - J2000_MS) / JULIAN_CENTURY_MS;
}

function norm(rad) {
  const r = rad % TAU;
  return r < 0 ? r + TAU : r;
}

/** Moon's mean anomaly M — the anomalistic clock. */
export function meanAnomaly(t) {
  const T = julianCenturies(t);
  return norm((134.9633964 + 477198.8675055 * T) * DEG);
}

/** Moon's argument of latitude F — the draconic clock. */
export function argOfLatitude(t) {
  const T = julianCenturies(t);
  return norm((93.2720950 + 483202.0175233 * T) * DEG);
}

/** Mean elongation D — the synodic clock. */
export function meanElongation(t) {
  const T = julianCenturies(t);
  return norm((297.8501921 + 445267.1114034 * T) * DEG);
}

/**
 * Optical libration, radians.
 *
 * Longitude libration IS the equation of the centre: the moon's orbital speed
 * varies with anomaly while its rotation is uniform, so it appears to lead and
 * lag. Two terms, the second (evection) is what carries the envelope past 7deg.
 * Latitude libration comes from the 6.68deg tilt of the lunar equator to the
 * ecliptic, and so tracks the argument of latitude.
 */
export function libration(t) {
  const M = meanAnomaly(t);
  const D = meanElongation(t);
  const F = argOfLatitude(t);
  const lonDeg = 6.289 * Math.sin(M) + 1.274 * Math.sin(2 * D - M);
  const latDeg = 6.68 * Math.sin(F);
  return { lon: lonDeg * DEG, lat: latDeg * DEG };
}

/** Earth-Moon distance in km. */
export function distanceKm(t) {
  const M = meanAnomaly(t);
  const D = meanElongation(t);
  return (
    MEAN_DISTANCE_KM -
    TERM_ANOMALY_KM * Math.cos(M) -
    TERM_EVECTION_KM * Math.cos(2 * D - M)
  );
}

/** Disc scale factor, 1.0 at mean distance. Drives the perigee swell. */
export function apparentRadiusScale(t) {
  return MEAN_DISTANCE_KM / distanceKm(t);
}

/** Apparent angular diameter in arcminutes. */
export function apparentDiameterArcmin(t) {
  const rad = 2 * Math.atan(LUNAR_RADIUS_KM / distanceKm(t));
  return (rad * 180 * 60) / Math.PI;
}

/**
 * The scrub is a clock.
 *
 * Anchored on the tab's own live age rather than recomputed from an epoch, so
 * there is no seam between live mode and scrub mode even though LunarTab's
 * live age comes from the WASM path. Always projects forward.
 */
export function timestampForScrub(scrubAge, liveAge, now) {
  let delta = scrubAge - liveAge;
  if (delta < 0) delta += SYNODIC_PERIOD;
  return now + delta * DAY_MS;
}

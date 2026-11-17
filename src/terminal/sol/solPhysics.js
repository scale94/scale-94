// /SOL physics: the numbers. Pure functions and constants, no DOM, no React.

export const TENSION_QUIET_G = 300;
export const TENSION_PORE_G = 1500;
export const TENSION_SNAP_G = 4000;
export const TURNS_TO_SNAP = 6;   // tune
export const MIN_SNAP_TURNS = 1;  // tune
export const SLIP_TAU_S = 8;      // tune
export const EARTH_CONE_DEG = 35;
export const E_MIN_ERG = 1e29;
export const E_MAX_ERG = 5e32;
export const TRANSIT_FAST_H = 17.6;
export const TRANSIT_SLOW_H = 72;
export const AU_KM = 1.496e8;
export const L1_KM = 1.5e6;
export const LIGHT_DELAY_S = 499;
export const MERCURY_FRACTION = 0.387;
export const DST_WEAK_NT = -50;
export const DST_STRONG_NT = -1200;
export const STORM_SHORT_H = 3;
export const STORM_LONG_H = 12;

const HOUR_MS = 3600e3;

// NaN (a bad energy, a log of a negative) reads as 0, never propagates.
const clamp01 = (x) => (!(x > 0) ? 0 : x >= 1 ? 1 : x);

// Written as (1-s)*a + s*b so that s=0 returns a and s=1 returns b exactly.
const lerp = (a, b, s) => (1 - s) * a + s * b;

/** Linear QUIET -> SNAP over 0..TURNS_TO_SNAP, clamped. */
export function tensionG(turns) {
  const t = clamp01(turns / TURNS_TO_SNAP);
  return lerp(TENSION_QUIET_G, TENSION_SNAP_G, t);
}

/** Log-interpolated energy: E_MIN at MIN_SNAP_TURNS, E_MAX at TURNS_TO_SNAP, clamped. */
export function energyErg(turns) {
  const t = clamp01((turns - MIN_SNAP_TURNS) / (TURNS_TO_SNAP - MIN_SNAP_TURNS));
  if (t === 0) return E_MIN_ERG;
  if (t === 1) return E_MAX_ERG;
  const logE = lerp(Math.log10(E_MIN_ERG), Math.log10(E_MAX_ERG), t);
  return 10 ** logE;
}

/** Position of log10(E) between E_MIN and E_MAX, clamped to 0..1. */
export function strength01(erg) {
  const lo = Math.log10(E_MIN_ERG);
  const hi = Math.log10(E_MAX_ERG);
  return clamp01((Math.log10(erg) - lo) / (hi - lo));
}

/** Transit time in ms: slow at weak strength, fast at strong. */
export function transitMs(erg) {
  return lerp(TRANSIT_SLOW_H, TRANSIT_FAST_H, strength01(erg)) * HOUR_MS;
}

/** Mean speed in km/s for a transit time in ms. */
export function speedKmS(ms) {
  return AU_KM / (ms / 1000);
}

/** Peak Dst in nT: weak to strong with strength. */
export function stormNt(erg) {
  return lerp(DST_WEAK_NT, DST_STRONG_NT, strength01(erg));
}

/** Storm duration in ms: short to long with strength. */
export function stormMs(erg) {
  return lerp(STORM_SHORT_H, STORM_LONG_H, strength01(erg)) * HOUR_MS;
}

/** A 'cw' handedness couples; 'ccw' does not. */
export function couples(handedness) {
  return handedness === 'cw';
}

/** Northern hemisphere (lat >= 0) is 'ccw'; southern is 'cw'. A non-finite latitude passes ('ccw'). */
export function hemisphereHandedness(latRad) {
  return latRad < 0 ? 'cw' : 'ccw';
}

const CONE_COS = Math.cos((EARTH_CONE_DEG * Math.PI) / 180);

/** True when the normal points within EARTH_CONE_DEG of the camera direction (unit vectors). */
export function facesCamera(normal, toCamera) {
  const dot = normal[0] * toCamera[0] + normal[1] * toCamera[1] + normal[2] * toCamera[2];
  if (!Number.isFinite(dot)) return false;
  return dot >= CONE_COS;
}

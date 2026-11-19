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
export const NEUTRINO_DELAY_S = LIGHT_DELAY_S;  // neutrinos leave with the light, barely slowed
export const PROTON_ONSET_SLOW_MS = 2 * 3600e3;  // tune
export const PROTON_ONSET_FAST_MS = 15 * 60e3;   // tune
export const XRAY_LOG_FLUX_MIN = -6;             // tune (C1.0 W/m^2)
export const XRAY_LOG_FLUX_MAX = Math.log10(4.5e-3);  // tune (X45)
export const PROTON_PFU_LOG_MIN = 0;             // tune
export const PROTON_PFU_LOG_MAX = 5;             // tune
// Core-to-surface photon random walk, ~170,000 yr (Mitalas & Sills 1992).
export const CORE_PHOTON_YEARS = 170000;
// Solar age at the helium flash and end of core He burning (Schroder & Smith 2008).
export const HELIUM_FLASH_YEARS = 7.59e9;
export const HE_BURN_END_YEARS = 7.70e9;

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

/** Peak GOES soft X-ray flux in W/m^2, log-interpolated C1.0 -> X45 with strength. */
export function xrayFluxWm2(erg) {
  return 10 ** lerp(XRAY_LOG_FLUX_MIN, XRAY_LOG_FLUX_MAX, strength01(erg));
}

const GOES_LETTERS = [['X', 1e-4], ['M', 1e-5], ['C', 1e-6], ['B', 1e-7], ['A', 1e-8]];

/** GOES class string for a flux; rounds to 0.1 first so nothing reads C10.0. */
export function goesClass(fluxWm2) {
  const f = Number.isFinite(fluxWm2) && fluxWm2 > 0 ? fluxWm2 : 0;
  // Rounded to 0.1 of the class unit; the letter is picked from the rounded value.
  let i = GOES_LETTERS.findIndex(([, unit]) => Math.round((f / unit) * 10) / 10 >= 1);
  if (i < 0) i = GOES_LETTERS.length - 1;
  const [letter, unit] = GOES_LETTERS[i];
  const m = Math.round((f / unit) * 10) / 10;
  return letter + (m >= 10 ? String(Math.round(m)) : m.toFixed(1));
}

/** GOES class string for a flare energy. */
export function xrayClass(erg) {
  return goesClass(xrayFluxWm2(erg));
}

/** Proton onset delay in ms: 2 h at weak, 15 min at strong, log-interpolated. */
export function protonOnsetMs(erg) {
  const logMs = lerp(Math.log10(PROTON_ONSET_SLOW_MS), Math.log10(PROTON_ONSET_FAST_MS), strength01(erg));
  return 10 ** logMs;
}

/** Peak proton flux in pfu, log-interpolated 1 -> 1e5 with strength. */
export function protonPeakPfu(erg) {
  return 10 ** lerp(PROTON_PFU_LOG_MIN, PROTON_PFU_LOG_MAX, strength01(erg));
}

/** NOAA S-scale from peak pfu (>10 MeV): S1 at 10, S2 1e2, S3 1e3, S4 1e4, S5 1e5. */
export function sScale(pfu) {
  const steps = [1e5, 1e4, 1e3, 1e2, 10];
  const n = steps.findIndex((t) => pfu >= t * (1 - 1e-9));
  return n < 0 ? 'below S1' : `S${5 - n}`;
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

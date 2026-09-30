// src/terminal/mercury/planet/mercuryThermal.js — how hot each point of Mercury is.
//
// PRECISION BOUNDARY, stated so no reader assumes more:
// - Subsolar equilibrium T_ss(r) = 700 K · √(0.307 AU / r) (≈700 K perihelion,
//   ≈570 K aphelion). Day side T = T_ss · cos^¼θ.
// - Thermal lag is a two-timescale caricature, not a regolith model: mornings
//   warm toward equilibrium with TAU_WARM_H; after sunset the surface cools from
//   T_SUNSET_K toward T_NIGHT_FLOOR_K with TAU_COOL_H. The values are chosen so
//   dusk stays liquid ~20° past sunset and dawn stays frozen ~25° after sunrise
//   (spec §3), which makes the rotation direction visible.
// - The Hg window 234.32 K / 629.88 K is the 1-ATM convention, an ARTISTIC
//   CHOICE: in vacuum liquid mercury has no boiling point and evaporates at any
//   temperature.
// mercuryPlanetShader.js mirrors surfaceTempK exactly (constants via glf).

export const HG_MELT_K = 234.32;
export const HG_BOIL_K = 629.88;

export const T_SS_PERIHELION_K = 700;
export const PERIHELION_AU = 0.307;
export const T_NIGHT_FLOOR_K = 100;
export const T_SUNSET_K = 400;
export const TAU_WARM_H = 860;
export const TAU_COOL_H = 290;
export const SOLAR_DAY_H = 4222.6;          // 175.94 Earth days
export const HOURS_PER_RAD = SOLAR_DAY_H / (2 * Math.PI);

const HALF_PI = Math.PI / 2;

export function subsolarTempK(rAU) {
  return T_SS_PERIHELION_K * Math.sqrt(PERIHELION_AU / rAU);
}

export function surfaceTempK(mu0, lonRel, cosLat, tss, heatK = 0) {
  const tset = T_SUNSET_K * Math.pow(Math.max(cosLat, 0), 0.25);
  const teq = tss * Math.pow(Math.max(mu0, 0), 0.25);
  let t;
  if (lonRel >= -HALF_PI && lonRel <= HALF_PI) {
    if (lonRel < 0) {
      const h = (lonRel + HALF_PI) * HOURS_PER_RAD;
      t = T_NIGHT_FLOOR_K + (Math.max(teq, T_NIGHT_FLOOR_K) - T_NIGHT_FLOOR_K) * (1 - Math.exp(-h / TAU_WARM_H));
    } else {
      t = Math.max(teq, tset);
    }
  } else {
    const h = (lonRel > 0 ? lonRel - HALF_PI : lonRel + 3 * HALF_PI) * HOURS_PER_RAD;
    t = T_NIGHT_FLOOR_K + (tset - T_NIGHT_FLOOR_K) * Math.exp(-h / TAU_COOL_H);
  }
  return t + heatK;
}

export function hgPhase(tK) {
  if (tK < HG_MELT_K) return 'solid';
  if (tK > HG_BOIL_K) return 'boiling';
  return 'liquid';
}

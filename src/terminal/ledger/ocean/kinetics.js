// kinetics.js — the shared reaction model of the river stage and every ocean
// cell. Rates are per simulated day. Constants are literature ranges, not
// per-site measurements (HUD legend: MODEL KINETICS · LITERATURE RANGES).

export const TAU_T_DAYS = 3;      // thermal excess e-folding time
export const TAU_N_DAYS = 60;     // nitrate uptake e-folding time
export const K_D20 = 0.23;        // BOD decay at 20 °C, 1/d (range 0.1–0.4)
export const THETA_D = 1.047;     // BOD decay temperature coefficient
export const THETA_A = 1.024;     // reaeration temperature coefficient
export const K_A_OCEAN20 = 0.2;   // ≈ 4 m/d gas-transfer velocity over a 20 m mixed layer, 1/d

export function kd(tempC) {
  return K_D20 * Math.pow(THETA_D, tempC - 20);
}

export function kaOcean(tempC) {
  return K_A_OCEAN20 * Math.pow(THETA_A, tempC - 20);
}

// O'Connor–Dobbins: ka = 3.93 v^0.5 / H^1.5 (v in m/s, H in m), at 20 °C.
export function kaRiver(velocityMs, depthM, tempC) {
  return ((3.93 * Math.sqrt(velocityMs)) / Math.pow(depthM, 1.5)) * Math.pow(THETA_A, tempC - 20);
}

// Manning: v = (1/n) R^(2/3) S^(1/2).
export function manningVelocity({ n, R, S }) {
  return (1 / n) * Math.pow(R, 2 / 3) * Math.sqrt(S);
}

// Benson & Krause (APHA 4500-O), freshwater at 1 atm, mg/L.
export function doSat(tempC) {
  const T = tempC + 273.15;
  return Math.exp(
    -139.34411 + 1.575701e5 / T - 6.642308e7 / T ** 2 + 1.2438e10 / T ** 3 - 8.621949e11 / T ** 4,
  );
}

// Zonal-mean sea-surface temperature sketch: 28 °C at the equator, ~3 °C at 78°.
export function sstClimatology(latDeg) {
  const s = Math.sin((latDeg * Math.PI) / 180);
  return 28 - 26 * s * s;
}

// Exact solution over t of dL/dt = -kd L, dD/dt = kd L - ka D (Streeter–Phelps).
// The bridge term (e^{-kd t} - e^{-ka t}) / (ka - kd) switches to a series near
// ka = kd so it stays continuous through the degenerate case.
export function sagStep(L0, D0, kdv, kav, t) {
  const eD = Math.exp(-kdv * t);
  const eA = Math.exp(-kav * t);
  const x = (kav - kdv) * t;
  const bridge = Math.abs(x) < 1e-4
    ? t * eD * (1 - x / 2 + (x * x) / 6)
    : (eD - eA) / (kav - kdv);
  return { L: L0 * eD, D: kdv * L0 * bridge + D0 * eA };
}

// Time of maximum deficit (the classic critical point). 0 when the deficit
// only recovers from the start.
export function criticalTime(L0, D0, kdv, kav) {
  if (!(L0 > 0)) return 0;
  const dk = kav - kdv;
  if (Math.abs(dk) < 1e-9) return Math.max(0, (1 / kdv) * (1 - D0 / L0));
  const arg = (kav / kdv) * (1 - (D0 * dk) / (kdv * L0));
  if (!(arg > 0)) return 0;
  return Math.max(0, Math.log(arg) / dk);
}

// State of a river parcel t days after leaving the audit site.
// kernel = { temp, do, bod, dt, nitrate } (the verdict's kernel inputs).
export function riverState(kernel, tDays, { velocityMs, depthM }) {
  const sat = doSat(kernel.temp);
  const D0 = Math.max(0, sat - kernel.do);
  const { L, D } = sagStep(kernel.bod, D0, kd(kernel.temp), kaRiver(velocityMs, depthM, kernel.temp), tDays);
  return {
    dT: kernel.dt * Math.exp(-tDays / TAU_T_DAYS),
    L,
    N: kernel.nitrate * Math.exp(-tDays / TAU_N_DAYS),
    D: Math.min(Math.max(0, D), sat),
  };
}

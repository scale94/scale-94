// src/terminal/mercury/planet/mercuryEphemeris.js — where the Sun is, for Mercury, now.
//
// PRECISION BOUNDARY, stated so no reader assumes more (spec §4, §5):
// orbit = JPL "Keplerian Elements for Approximate Positions of the Major
// Planets" (Standish), Table 1 (1800–2050), two-body, no perturbations.
// Rotation = IAU/WGCCRE 2015 Mercury model incl. the 88-day libration terms.
// UTC is used as TDB (69 s ≈ 0.005° of rotation). Verified against JPL
// Horizons to < 0.3° sub-solar longitude and < 2e-4 AU (see tests). It is
// NOT JPL-accurate and must not be presented as such.

export const AU_KM = 149597870.7;
export const SUN_RADIUS_KM = 695700;

const DAY_MS = 86400000;
const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const GAUSS_K = 0.01720209895;           // AU^1.5 / day (√GM☉)
const OBLIQUITY = 23.43928 * DEG;        // J2000 ecliptic → ICRF

// [value at J2000, rate per Julian century]; angles in degrees.
export const ELEMENTS_J2000 = {
  a:     [0.38709927,   0.00000037],
  e:     [0.20563593,   0.00001906],
  I:     [7.00497902,  -0.00594749],
  L:     [252.25032350, 149472.67411175],
  varpi: [77.45779628,  0.16047689],
  Omega: [48.33076593, -0.12534081],
};

function wrapPi(x) {
  return x - TAU * Math.floor((x + Math.PI) / TAU);
}

function solveKepler(M, e) {
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 12; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-13) break;
  }
  return E;
}

export function mercuryRotation(d, T) {
  const s = (deg) => Math.sin(deg * DEG);
  const M1 = 174.7910857 + 4.092335 * d;
  const M2 = 349.5821714 + 8.184670 * d;
  const M3 = 164.3732571 + 12.277005 * d;
  const M4 = 339.1643429 + 16.369340 * d;
  const M5 = 153.9554286 + 20.461675 * d;
  return {
    alpha0Deg: 281.0103 - 0.0328 * T,
    delta0Deg: 61.4155 - 0.0049 * T,
    WDeg: 329.5988 + 6.1385108 * d
      + 0.01067257 * s(M1) - 0.00112309 * s(M2) - 0.00011040 * s(M3)
      - 0.00002539 * s(M4) - 0.00000571 * s(M5),
  };
}

// ICRF vector → Mercury body-fixed: Rz(W) · Rx(90° − δ0) · Rz(90° + α0).
function icrfToBody([x0, y0, z0], { alpha0Deg, delta0Deg, WDeg }) {
  const A = (90 + alpha0Deg) * DEG;
  let x = Math.cos(A) * x0 + Math.sin(A) * y0;
  let y = -Math.sin(A) * x0 + Math.cos(A) * y0;
  let z = z0;
  const B = (90 - delta0Deg) * DEG;
  const y1 = Math.cos(B) * y + Math.sin(B) * z;
  const z1 = -Math.sin(B) * y + Math.cos(B) * z;
  y = y1; z = z1;
  const C = WDeg * DEG;
  const x2 = Math.cos(C) * x + Math.sin(C) * y;
  const y2 = -Math.sin(C) * x + Math.cos(C) * y;
  return [x2, y2, z];
}

export function mercuryEphemeris(tMs) {
  const d = (tMs - J2000_MS) / DAY_MS;
  const T = d / 36525;
  const el = (k) => ELEMENTS_J2000[k][0] + ELEMENTS_J2000[k][1] * T;

  const a = el('a');
  const e = el('e');
  const I = el('I') * DEG;
  const varpi = el('varpi') * DEG;
  const Om = el('Omega') * DEG;
  const w = varpi - Om;
  const M = wrapPi(el('L') * DEG - varpi);

  const E = solveKepler(M, e);
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const r = Math.hypot(xp, yp);
  const nu = Math.atan2(yp, xp);

  const cw = Math.cos(w), sw = Math.sin(w);
  const cO = Math.cos(Om), sO = Math.sin(Om);
  const cI = Math.cos(I), sI = Math.sin(I);
  const xe = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
  const ye = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
  const ze = (sw * sI) * xp + (cw * sI) * yp;

  const xq = xe;
  const yq = ye * Math.cos(OBLIQUITY) - ze * Math.sin(OBLIQUITY);
  const zq = ye * Math.sin(OBLIQUITY) + ze * Math.cos(OBLIQUITY);

  const sunFromMercury = [-xq / r, -yq / r, -zq / r];
  const [bx, by, bz] = icrfToBody(sunFromMercury, mercuryRotation(d, T));
  const lon = Math.atan2(by, bx) / DEG;

  const rdotAuDay = (GAUSS_K * e * Math.sin(nu)) / Math.sqrt(a * (1 - e * e));

  return {
    r,
    rdotKmS: (rdotAuDay * AU_KM) / 86400,
    subsolarLonDeg: ((lon % 360) + 360) % 360,
    subsolarLatDeg: Math.asin(Math.max(-1, Math.min(1, bz))) / DEG,
    sunAngularRadiusRad: Math.asin(SUN_RADIUS_KM / (r * AU_KM)),
    trueAnomalyRad: nu,
  };
}

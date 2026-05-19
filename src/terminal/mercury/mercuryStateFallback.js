// mercuryStateFallback.js — Pure-JS Mercury orbital state
//
// Mirror of getLunarAgeFallback in LunarTab.jsx. WASM is primary; this fires
// only when WASM hasn't loaded (private browsing, slow connection, error).
//
// References:
//   Meeus J., Astronomical Algorithms, 2nd ed. (1998), ch.32
//   Standish E.M., JPL Planetary Ephemerides (2000)
//   Pettengill & Dyce (1965): Mercury 3:2 spin-orbit resonance
//   Kopp & Lean (2011): Solar constant 1361 W/m²

const J2000_MS  = 946728000000;          // 2000-01-01 12:00 UTC
const DAY_MS    = 86_400_000;
const DEG       = Math.PI / 180;

// Mercury orbital elements at J2000 (Standish/JPL, ecliptic frame)
const MERCURY = {
  a:           0.38709843,                // AU
  e:           0.20563661,
  i_rad:       7.00559432 * DEG,
  L0_rad:    252.25166724 * DEG,          // mean longitude at epoch
  varpi_rad:  77.45771895 * DEG,          // longitude of perihelion
  Omega_rad:  48.33961819 * DEG,          // longitude of ascending node
  period_d:   87.9691,
  n_rad_per_day: (2 * Math.PI) / 87.9691, // mean motion
};

// Earth orbital elements (used for Earth-Mercury distance)
const EARTH = {
  a:           1.00000018,
  e:           0.01673163,
  L0_rad:    100.46457166 * DEG,
  varpi_rad: 102.93768193 * DEG,
  period_d:  365.256363,
  n_rad_per_day: (2 * Math.PI) / 365.256363,
};

export function keplerSolve(M, e) {
  // Newton-Raphson, converges in ~5 iterations for e<0.3
  let E = M;
  for (let i = 0; i < 8; i++) {
    const f  = E - e * Math.sin(E) - M;
    const fp = 1 - e * Math.cos(E);
    E = E - f / fp;
  }
  return E;
}

function normalizeRad(x) {
  const TWO_PI = 2 * Math.PI;
  let r = x % TWO_PI;
  if (r < 0) r += TWO_PI;
  return r;
}

function heliocentricStateAU(elems, daysSinceJ2000) {
  // Mean anomaly M = L − ϖ (mean longitude minus longitude of perihelion)
  const L = elems.L0_rad + elems.n_rad_per_day * daysSinceJ2000;
  const M = normalizeRad(L - elems.varpi_rad);
  const E = keplerSolve(M, elems.e);
  // True anomaly ν from eccentric anomaly E
  const cosE = Math.cos(E), sinE = Math.sin(E);
  const r = elems.a * (1 - elems.e * cosE);
  const nu = Math.atan2(Math.sqrt(1 - elems.e * elems.e) * sinE, cosE - elems.e);
  // Heliocentric ecliptic coordinates in the orbital plane (z=0 approx)
  const lon = normalizeRad(nu + elems.varpi_rad);
  return {
    r,
    nu,
    L,
    x: r * Math.cos(lon),
    y: r * Math.sin(lon),
  };
}

function daysToNextPerihelionFn(elems, daysSinceJ2000) {
  // Mercury's perihelion epoch: J2000 + a small offset.
  // Mean anomaly = 0 at perihelion. Solve for next M=0.
  const L = elems.L0_rad + elems.n_rad_per_day * daysSinceJ2000;
  const M = normalizeRad(L - elems.varpi_rad);
  // Days until M reaches 2π (next perihelion)
  const remaining = (2 * Math.PI - M) / elems.n_rad_per_day;
  return remaining;
}

function subsolarLongitudeDeg(daysSinceJ2000) {
  // Mercury's 3:2 spin-orbit resonance: sidereal rotation period = 58.6462 d
  // and orbital period = 87.9691 d. Two solar days = three sidereal days.
  // The two "hot poles" at lon 0° and 180° face the Sun alternately at perihelion.
  // Reference: anchor subsolar longitude to 0° at J2000 (good enough for art project;
  // exact phase requires Mercury rotation pole epoch from IAU 2015 report).
  const sidereal_period_d = 58.6462;
  const orbital_period_d  = 87.9691;
  const solar_day_d = 1 / (1 / sidereal_period_d - 1 / orbital_period_d);
  // Subsolar longitude advances 360° per solar day.
  const lon = (daysSinceJ2000 / solar_day_d) * 360;
  return ((lon % 360) + 360) % 360;
}

export function getMercuryStateFallback(date = new Date()) {
  const daysSinceJ2000 = (date.getTime() - J2000_MS) / DAY_MS;

  const merc  = heliocentricStateAU(MERCURY, daysSinceJ2000);
  const earth = heliocentricStateAU(EARTH,   daysSinceJ2000);

  const dx = merc.x - earth.x;
  const dy = merc.y - earth.y;
  const earthMercuryDistanceAU = Math.sqrt(dx * dx + dy * dy);

  const S0 = 1361;                                   // W/m² at 1 AU
  const ALBEDO = 0.142;                              // Bond albedo, Mercury
  const EMISSIVITY = 0.95;
  const SIGMA = 5.670374419e-8;                      // Stefan-Boltzmann

  const solarFluxWm2 = S0 / (merc.r * merc.r);
  const subsolarTempK = Math.pow(
    ((1 - ALBEDO) * solarFluxWm2) / (EMISSIVITY * SIGMA),
    0.25,
  );

  // Mercury phase angle as seen from Earth (illuminated fraction)
  const Rearth = Math.sqrt(earth.x * earth.x + earth.y * earth.y);
  const cosAlpha = (merc.r * merc.r + earthMercuryDistanceAU * earthMercuryDistanceAU - Rearth * Rearth)
    / (2 * merc.r * earthMercuryDistanceAU);
  const alpha = Math.acos(Math.max(-1, Math.min(1, cosAlpha)));
  const phaseIllumination = (1 + Math.cos(alpha)) / 2;

  return {
    heliocentricDistanceAU:  merc.r,
    trueAnomalyDeg:          (merc.nu * 180 / Math.PI + 360) % 360,
    solarFluxWm2,
    subsolarLongitudeDeg:    subsolarLongitudeDeg(daysSinceJ2000),
    subsolarTempK,
    nightsideTempK:          100,
    earthMercuryDistanceAU,
    daysToNextPerihelion:    daysToNextPerihelionFn(MERCURY, daysSinceJ2000),
    phaseIllumination,
  };
}

// instruments.js — Six observation instruments
//
// Each instrument's displayed value = baseline(orbital) × modulator(canvas).
// Baselines pull from Mercury's real orbital state; modulators pull from the
// user's live canvas controls. The canvas is the fifth element's instrument.

const MAX_ORBITAL_SPEED = 2.0;   // canvas-internal scale; tune if controls change
const REF_DENSITY       = 1200;
const REF_AU            = 0.387;
const MAX_CLOSURE_RATE  = 0.0008;   // AU/day (nominal max Earth-Mercury closure)

export function computeInstruments(mercury, canvas) {
  const {
    heliocentricDistanceAU: r,
    solarFluxWm2,
    subsolarTempK,
    earthMercuryDistanceAU: dEM,
  } = mercury;
  const {
    activePhase,
    turbulence = 0,
    density    = REF_DENSITY,
    speed      = 0.1,
    curlAmp    = 0,
    eruptStrength = 0,
    spread     = 0,
    chromatic  = 0,
    orbitalSpeed = 0,
  } = canvas;

  // 1. PROMISE HALF-LIFE (d): 28 · (r/0.387)² · (1 − turbulence)
  const promise = 28 * Math.pow(r / REF_AU, 2) * (1 - turbulence);

  // 2. ATTENTION VISCOSITY (Pa·s): 0.42·(1 − orbitalSpeed/max) · √(density/REF_DENSITY)
  const viscosity = 0.42
    * (1 - Math.min(1, orbitalSpeed / MAX_ORBITAL_SPEED))
    * Math.sqrt(density / REF_DENSITY);

  // 3. WORSHIP TEMPERATURE (K): subsolar temp · (1 + 0.4·eruptStrength) when EARTH
  const worship = subsolarTempK
    * (activePhase === 'earth' ? (1 + 0.4 * eruptStrength) : 1);

  // 4. MIGRATION DRIFT (σ): closure rate normalized · (speed/0.1)
  //   Note: without sampling two states we can't take d/dt directly; approximate
  //   as deviation from mean Earth-Mercury distance (~1.0 AU).
  //   Derivative-based MIGRATION DRIFT is a Phase 3 refinement.
  const closureProxy = (1.0 - dEM) / MAX_CLOSURE_RATE / 100;   // normalized [-2.4, +2.4]
  const drift = closureProxy * (speed / 0.1);

  // 5. GRIEF INDEX (idx): 1 − normalized(solarFlux); modulated in FLUID or AIR
  const fluxNorm = Math.min(1, solarFluxWm2 / 14500);          // 14500 ≈ perihelion peak
  const griefBase = 1 - fluxNorm;
  const griefMod = activePhase === 'fluid' ? (1 + curlAmp * 8)
    : activePhase === 'air' ? (1 + spread * 0.3)
    : 1;
  const grief = griefBase * griefMod;

  // 6. FORGETTING FLUX (bit/m²·s): 1 / dEM² · (chromatic + 0.1)
  const forgetting = (1 / (dEM * dEM)) * (chromatic + 0.1);

  return [
    { label: 'PROMISE HALF-LIFE',   unit: 'd',         value: promise,    min: 0.8,  max: 38   },
    { label: 'ATTENTION VISCOSITY', unit: 'Pa·s',      value: viscosity,  min: 0.001, max: 1.0 },
    { label: 'WORSHIP TEMPERATURE', unit: 'K',         value: worship,    min: 540,  max: 980  },
    { label: 'MIGRATION DRIFT',     unit: 'σ',         value: drift,      min: -2.4, max: 2.4  },
    { label: 'GRIEF INDEX',         unit: 'idx',       value: grief,      min: 0,    max: 1    },
    { label: 'FORGETTING FLUX',     unit: 'bit/m²·s',  value: forgetting, min: 0.4,  max: 9.2  },
  ];
}

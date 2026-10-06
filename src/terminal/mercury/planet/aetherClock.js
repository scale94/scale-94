// src/terminal/mercury/planet/aetherClock.js — one time base for the aether (mirror-sky spec §1).
//
// The four element flows and the liquid's mirror sky read the same calm-gated time t and the same four
// integrated phases, so the reflection moves at its gas's pace. Every phase integrates its own rate
// (phase += rate·dt): moving a slider changes the rate, never the phase. One instance per canvas
// (MercuryCanvas); every consumer ticks it at the top of its useFrame and the first tick per frame advances.
// Pure: no React, no THREE, no allocation per tick.

export const CLOCK_PHASES = Object.freeze(['fluid', 'thermal', 'earth', 'air']);

// Means of each flow's per-particle rate terms, U[0, 1) labels. Fog draws them with Math.random(); fluid + air
// filaments (Task 7d threads) share one rate per lane, stratified (gasStratified), so the per-lane mean is within
// 0.5/L of 0.5. Residual: the lanes' uneven particle weights shift the particle-weighted mean a little.
// aetherClock.test pins the derivations; flowClock.test pins the flow literals they come from.
export const FLUID_LANE_MEAN = 0.8;    // ParticleFlow: (0.6 + aOffset * 0.4)
export const AIR_ORBIT_MEAN = 0.75;    // AtmosphericFlow: (0.4 + aSpeed * 0.7), upper layer (ionosphere excluded)
export const AIR_LOWER_DIR = -0.85;    // AtmosphericFlow: aAlt > 0.5 ? 1.0 : -0.85
export const FIRE_LIFE_MEAN = 0.7;     // ThermalFlow: lifeMult = 0.4 + aSpeed * 0.6
export const FIRE_RISE_MEAN = 2.95;    // ThermalFlow: riseSpeed = mix(2.4, 3.5, aTemp)
export const EARTH_MASS_MEAN = 0.59;   // SedimentFlow: aMass = 20 % U[0, 0.3) + 80 % U[0.4, 1.0)
export const EARTH_SINK_RATE_K = 0.88; // SedimentFlow: sinkOffset = fract(aPhase + phase · aMass * 2.2 * 0.4)
export const EARTH_FALL = 2.4;         // SedimentFlow: settledY = spawnY - sinkOffset * 2.4

// What the mirror sky moves by, per unit of its element's phase. The flows ring the planet at about the old
// lobe radius, so a fall of d scene units sweeps d / AETHER_SKY_R in direction space.
export const AETHER_SKY_R = 1.4;
export const FLUID_SKY_RAD = 2 * 2 * Math.PI * FLUID_LANE_MEAN;   // knot-centre angle: 2φ, φ = 2π · knot phase
export const AIR_SKY_RAD = AIR_ORBIT_MEAN;                         // cyclone angle (upper layer)
export const FIRE_SKY_RISE = (FIRE_LIFE_MEAN * FIRE_RISE_MEAN) / AETHER_SKY_R;
export const EARTH_SKY_SINK = (EARTH_FALL * EARTH_SINK_RATE_K * EARTH_MASS_MEAN) / AETHER_SKY_R;

export function createAetherClock() {
  return {
    t: 0,
    phase: { fluid: 0, thermal: 0, earth: 0, air: 0 },
    rate: { fluid: 0, thermal: 0, earth: 0, air: 0 },   // applied this frame (0 under calm): streak lengths read it
    rateIn: { fluid: 0, thermal: 0, earth: 0, air: 0 }, // configured (the sliders)
    calm: false,
    stamp: NaN,
  };
}

// Render time: the sliders and calm. Mutates in place.
export function configureAetherClock(clock, { speed, orbitalSpeed, calm }) {
  clock.rateIn.fluid = speed;
  clock.rateIn.thermal = speed;
  clock.rateIn.earth = speed;
  clock.rateIn.air = orbitalSpeed;
  clock.calm = !!calm;
  return clock;
}

// Frame time: stamp = r3f's state.clock.elapsedTime, identical for every useFrame callback of one frame.
export function tickAetherClock(clock, stamp, delta) {
  if (stamp === clock.stamp) return clock;
  clock.stamp = stamp;
  const k = clock.calm ? 0 : 1;
  for (let i = 0; i < CLOCK_PHASES.length; i++) {
    const p = CLOCK_PHASES[i];
    clock.rate[p] = k * clock.rateIn[p];
    clock.phase[p] += delta * clock.rate[p];
  }
  clock.t += k * delta;
  return clock;
}

// usePhaseTransition's idle ghost opacity (idleOpacities). Ghost elements are never reflected.
export const GHOST_OPACITY = 0.12;

// Mirror weights in CLOCK_PHASES order: the active and the pending element only, each by how far its cloud
// stands above ghost level. Idle → the active at 1; a switch → the old fades as its cloud ducks, the new rises
// as its cloud floods back. No opacities → the active at 1.
export function skyWeights(activePhase, pendingPhase, opacities, out = [0, 0, 0, 0]) {
  let sum = 0;
  for (let i = 0; i < CLOCK_PHASES.length; i++) {
    const p = CLOCK_PHASES[i];
    let w = 0;
    if (p === activePhase || p === pendingPhase) {
      if (!opacities) w = p === activePhase ? 1 : 0;
      else w = Math.min(Math.max(((opacities[p] ?? 0) - GHOST_OPACITY) / (1 - GHOST_OPACITY), 0), 1);
    }
    out[i] = w;
    sum += w;
  }
  if (sum > 1) for (let i = 0; i < out.length; i++) out[i] /= sum;
  return out;
}

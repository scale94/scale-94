// src/terminal/lunar/doctrineLens.js — which kernel is speaking (spec §5.1).
// Five lenses seated around the synodic wheel. The moon selects; the sky
// modulates. Affinity is continuous rather than bucketed so dragging the
// time-scrub recompiles the doctrine smoothly instead of stepping.
import { wrappedDistance } from './synodic';

// Falloff width in days. 4.2 keeps each lens dominant over roughly a quarter
// of the wheel while leaving real contest in the overlaps, which is where the
// transit bonus is meant to decide.
export const SIGMA = 4.2;

export const LENSES = [
  {
    id: 'hudelschublade',
    kernel: 'HUDELSCHUBLADE-ROUTING-KERNEL 1.0.0',
    center: 0.0,                                   // new → waxing crescent
    planets: { Mercury: 1.0, Saturn: 0.8, Pluto: 0.5 },
    element: 'FIRE',                               // the chaos house
  },
  {
    id: 'blackhole',
    kernel: 'BLACK-HOLE-TAXONOMY-KERNEL 1.0.0',
    center: 9.5,                                   // first quarter → waxing gibbous
    planets: { Pluto: 1.0, Saturn: 0.7, Neptune: 0.6 },
    element: 'EARTH',                              // bare metal
  },
  {
    id: 'semiotic',
    kernel: 'SEMIOTIC-SYNTHESIS-KERNEL 9.9.9',
    center: 16.5,                                  // full → waning gibbous
    planets: { Mercury: 1.0, Mars: 0.7, Uranus: 0.7 },
    element: 'AIR',                                // transmission
  },
  {
    id: 'fishscale',
    kernel: 'FISH-SCALE-KERNEL 11.1.1',
    center: 22.0,                                  // last quarter — dryness 96
    planets: { Neptune: 0.9, Venus: 0.7, Pluto: 0.6 },
    element: 'WATER',                              // wetness is vitality
  },
  {
    id: 'rossignol',
    kernel: 'ROSSIGNOL-RUISENOR-NIGHTINGALE-ANDALIB-KERNEL 5.5.5.5',
    center: 26.5,                                  // waning crescent → return to new
    planets: { Jupiter: 0.9, Venus: 0.8, Sun: 0.6 },
    element: null,                                 // takes no element: it is the fifth
  },
];

// Which lens owns each phase outright. Used only by the spine bonus, which
// rewards a compiled phase that agrees with the sky rather than re-deriving
// ownership from the affinity curve.
export const PHASE_OWNER = {
  'new':             'hudelschublade',
  'waxing-crescent': 'hudelschublade',
  'first-quarter':   'blackhole',
  'waxing-gibbous':  'blackhole',
  'full':            'semiotic',
  'waning-gibbous':  'semiotic',
  'last-quarter':    'fishscale',
  'waning-crescent': 'rossignol',
};

export function phaseAffinity(center, age) {
  const d = wrappedDistance(age, center);
  return 100 * Math.exp(-(d * d) / (2 * SIGMA * SIGMA));
}

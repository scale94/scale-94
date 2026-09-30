// src/terminal/mercury/orbitNodes.js — where the four element nodes sit.
// Shared by MercurySphere (the ring and its handles) and MercuryPlanet (the
// liquid mirror reflects the elements at these exact positions).

import { ELEMENTS } from './elements';

export const ORBIT_RADIUS = 1.4;
export const PRECESSION_RATE = 0.3 * (Math.PI / 180);  // 0.3°/s in radians
export const PRECESSION_DRIFT = 0.5 * (Math.PI / 180); // 0.5° drift per full cycle

// Cardinal positions: N=air, E=fire(thermal), S=earth, W=water(fluid)
export const ORBIT_NODES = [
  { phase: 'air',     angle: Math.PI / 2,  color: ELEMENTS.air.color,     element: 'AIR',   glyph: 'air'   },
  { phase: 'thermal', angle: 0,            color: ELEMENTS.thermal.color, element: 'FIRE',  glyph: 'fire'  },
  { phase: 'earth',   angle: -Math.PI / 2, color: ELEMENTS.earth.color,   element: 'EARTH', glyph: 'earth' },
  { phase: 'fluid',   angle: Math.PI,      color: ELEMENTS.fluid.color,   element: 'WATER', glyph: 'water' },
];

export function orbitPrecessionAngle(tS) {
  const raw = PRECESSION_RATE * tS;
  const turns = Math.floor(raw / (2 * Math.PI));
  return raw - turns * 2 * Math.PI + turns * PRECESSION_DRIFT;
}

export function nodeWorldPosition(angle, precession) {
  const a = angle + precession;
  return [Math.cos(a) * ORBIT_RADIUS, Math.sin(a) * ORBIT_RADIUS, 0];
}

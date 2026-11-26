// mercuryEye.js — /MERCURY -> the masthead eye (plan row 13).
//   spin     the eye turns with the planet, live and signed: MercuryPlanet's frame loop feeds the
//            body's angular velocity here every frame (eyeDrive spin). Only the visitor's spin
//            drives it: the latch opens on a drag and closes once the coast has died below
//            SPIN_FLOOR, so the ephemeris recapture (the planet re-seating itself on the Sun's
//            yaw, no hand anywhere) never turns the eye.
//   element  a tap that lights an element node focuses the eye into that element's own
//            palette (eyeReactions 'mercury.element'); the tap that returns to neutral is not one.
// Reduced motion (calm): no drive at all (the eye keeps its static fallbacks).

import { driveSpin } from '../components/eyeDrive';

// Each element's palette: [core, deep, light] RGB 0..255, built around elements.js's hue.
export const ELEMENT_EYE_COLS = {
  air:     [[56, 189, 248], [14, 116, 144], [224, 242, 254]],   // pale cyan · deep teal · near-white sky
  thermal: [[249, 115, 22], [185, 28, 28], [254, 215, 170]],    // ember · blood-red · flame-tip cream
  fluid:   [[99, 102, 241], [30, 41, 120], [165, 180, 252]],    // indigo · abyss · pale periwinkle
  earth:   [[217, 119, 6], [120, 53, 15], [253, 224, 140]],     // amber · umber · ochre light
};

export const SPIN_GAIN = 1;      // eye rad/s per planet rad/s: the eye turns as fast as the planet
export const SPIN_MAX = 9;       // rad/s either way (the planet tops out at 12)
export const SPIN_FLOOR = 0.12;  // rad/s: below this the coast is over and the latch closes

// Signed eye spin for a body angular velocity [x, y, z] (rad/s). The sign follows the flick's
// convention (the dominant screen axis of the spin: y for a sideways drag, x for an up/down one),
// mapped so the eye's near edge travels with the planet's front surface: a fling to the right
// turns the eye clockwise. The shader's u_phase runs counterclockwise, hence the minus.
export function eyeSpinOf(w) {
  const dom = Math.abs(w[1]) >= Math.abs(w[0]) ? w[1] : w[0];
  const mag = Math.hypot(w[0], w[1], w[2]);
  const s = -(dom < 0 ? -1 : 1) * mag * SPIN_GAIN;
  return Math.max(-SPIN_MAX, Math.min(SPIN_MAX, s));
}

export function createMercuryEyeFeed() {
  return { handled: false, w: [0, 0, 0] };
}

// omega: THREE.Vector3-like {x,y,z}; dragging: the hand is on the planet; calm: reduced motion.
// Returns true while it drives the eye.
export function feedMercuryEye(omega, dragging, calm, mem) {
  if (calm || !omega) { mem.handled = false; return false; }
  mem.w[0] = omega.x; mem.w[1] = omega.y; mem.w[2] = omega.z;
  if (dragging) mem.handled = true;
  if (!mem.handled) return false;
  const mag = Math.hypot(mem.w[0], mem.w[1], mem.w[2]);
  if (!dragging && mag < SPIN_FLOOR) { mem.handled = false; return false; }
  driveSpin(eyeSpinOf(mem.w));
  return true;
}

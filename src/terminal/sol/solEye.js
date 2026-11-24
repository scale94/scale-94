// solEye.js — /SOL -> the masthead eye, live (eyeDrive channels, `driven` eyes only).
// While a region is held and stirred the eye becomes the sun's surface: convection cells
// in the solar palette (SHAPE.sun), twisted and heated by the held region's tension, its
// spin following the hand's stirring. Called every frame from SolTab's loop; when the hold
// ends the channels lapse on their own (eyeDrive HOLD_MS) and the snap's burst
// (eyeReactions 'sol.release') takes the eye from there.

import { drivePalette, driveShape, driveSpin } from '../components/eyeDrive';
import { SHAPE } from '../components/observerEyeShader';

export const SUN_COLS = [[255, 196, 70], [230, 80, 20], [255, 236, 190]];
const SPIN_GAIN = 0.6;      // eye rad/s per (2π · hand turns/s)
const SPIN_MAX = 9;         // rad/s either way
const RATE_TAU = 0.12;      // s, smoothing of the hand's stir rate (pointer events are bursty)

export function createSolEyeFeed() {
  return { turns: null, rate: 0 };
}

// hold: useSolStar().hold() -> { held, tension01, turns }; dt in seconds; mem from createSolEyeFeed.
export function feedSolEye(hold, dt, mem) {
  if (!hold || !hold.held || !(dt > 0)) { mem.turns = null; mem.rate = 0; return false; }
  const raw = mem.turns == null ? 0 : (hold.turns - mem.turns) / dt;
  mem.turns = hold.turns;
  mem.rate += (raw - mem.rate) * (1 - Math.exp(-dt / RATE_TAU));
  drivePalette(SUN_COLS[0], SUN_COLS[1], SUN_COLS[2]);
  driveShape(SHAPE.sun, 1, Math.min(1, Math.max(0, hold.tension01)), 0);
  driveSpin(Math.max(-SPIN_MAX, Math.min(SPIN_MAX, 2 * Math.PI * mem.rate * SPIN_GAIN)));
  return true;
}

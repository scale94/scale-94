// eyeReactions.js — per-piece choreography for the masthead eye (Phase 1 of the thematic
// pass). observerStore decides *that* a piece reacts (tier, tint); this table says *how*:
// a keyed timeline for ObserverEye.kick() (see its `keys` doc), an optional SHAPE, and a
// duration that can outrun the tier's default when the gesture needs the room.
//
// A piece missing here keeps its plain envelope kick. Timelines are pure data, normalised
// to 0..1 of durationMs; a final `turn` is folded into the swirl phase (no snap back).

import { KICK, SHAPE } from './observerEyeShader';

const PI = Math.PI;

// /KERNEL — the pupil becomes the chip (KernelCoreIcon: package frame, diamond die, pins).
// Contract -> the chip forms -> the die spins up -> it brakes and back-spins a quarter,
// CDJ-style -> the chip melts back to the disc. `turn` drags the nebula with the die;
// `shapeB` is the die's own angle, ending on a multiple of π/2 (the diamond is 4-fold).
function kernelKeys({ spins, turn, form = 1 }) {
  const up = spins * 2 * PI;            // die travel at the top of the spin-up
  const settle = up - PI / 2;           // the back-spin: a quarter turn back
  return [
    { t: 0.00, level: 0, shapeK: 0, turn: 0, shapeB: 0 },
    { t: 0.14, level: 1, shapeK: 0.15 * form, turn: 0.3, shapeB: 0 },         // contraction
    { t: 0.32, level: 1, shapeK: form, turn: 0.8, shapeB: 0.25 },             // the chip forms
    { t: 0.60, level: 1, shapeK: form, turn, shapeB: up },                    // spin-up
    { t: 0.74, level: 0.9, shapeK: form, turn: turn * 0.82, shapeB: settle }, // back-spin settle
    { t: 0.86, level: 0.8, shapeK: form, turn: turn * 0.82, shapeB: settle },
    { t: 1.00, level: 0, shapeK: 0, turn: turn * 0.82, shapeB: settle },
  ];
}

export const REACTIONS = {
  'kernel.load':  { kind: KICK.miosis, shape: SHAPE.kernel, durationMs: 1700, keys: kernelKeys({ spins: 1.5, turn: 7.5 }) },
  'kernel.run':   { kind: KICK.miosis, shape: SHAPE.kernel, durationMs: 2100, keys: kernelKeys({ spins: 2.5, turn: 11 }) },
  // tty0:~$ Enter: a flick, not the full ritual — a load/run that follows takes over in form.
  'kernel.enter': {
    kind: KICK.miosis, shape: SHAPE.kernel, durationMs: 900,
    keys: [
      { t: 0.00, level: 0, shapeK: 0, turn: 0, shapeB: 0 },
      { t: 0.22, level: 0.85, shapeK: 0.85, turn: 0.4, shapeB: 0 },
      { t: 0.50, level: 0.85, shapeK: 0.85, turn: 2.2, shapeB: PI / 2 + 0.6 },
      { t: 0.66, level: 0.7, shapeK: 0.85, turn: 1.8, shapeB: PI / 2 },
      { t: 1.00, level: 0, shapeK: 0, turn: 1.8, shapeB: PI / 2 },
    ],
  },
};

// The kick() options for an impulse: its plain fields, overlaid by the piece's choreography.
export function reactionKick(imp) {
  const base = { kind: imp.kind, tint: imp.tint, tint2: imp.tint2, dir: imp.dir, durationMs: imp.durationMs };
  const r = REACTIONS[imp.piece];
  return r ? { ...base, ...r } : base;
}

// eyeReactions.js — per-piece choreography for the masthead eye (Phase 1 of the thematic
// pass). observerStore decides *that* a piece reacts (tier, tint); this table says *how*:
// a keyed timeline (or a continuous `curve`) for ObserverEye.kick(), an optional SHAPE, and a
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

// /BSKY — a vortex launch. A continuous curve, not keys: keys ease to a stop at every key,
// which read as the butterfly stuttering upward. The spin catches slowly and winds up like a
// small tornado (turn ∝ u³); the wingbeat runs continuously and speeds with the spin; the
// butterfly's rise is the wind's (∝ u⁴), so it builds in the centre and is slung out over
// the top rim at peak velocity. Then the tornado spends itself: the spin coasts on in the
// SAME direction and slows to rest as the colour bleeds back to silver — one continuous
// event. No reverse brake here: the CDJ back-spin is for the mechanical tabs (/KERNEL).
const BSKY_MS = 1500;
export const BSKY_EXIT = 0.72;   // x at which the butterfly clears the rim and the coast begins
const BSKY_TURN = 4 * PI;        // the wind-up: two turns, peak ~35 rad/s at the exit
const sm = (e) => (e <= 0 ? 0 : e >= 1 ? 1 : e * e * (3 - 2 * e));
function bskyVortex(x, d) {
  const u = Math.min(1, x / BSKY_EXIT);
  const inn = sm(x / 0.08);
  const out = x <= BSKY_EXIT ? 1 : 1 - sm((x - BSKY_EXIT) / (1 - BSKY_EXIT));
  // Wind-up: turn ∝ u³ (exit rate 3T/EXIT per x). Coast: rate v0·(1-s)² over the rest, so
  // the rate is continuous at the exit and reaches exactly 0 at x = 1 (nothing left to fold).
  const L = 1 - BSKY_EXIT;
  const sc = Math.max(0, (x - BSKY_EXIT) / L);
  const v0 = (3 * BSKY_TURN) / BSKY_EXIT;
  d.turn = x <= BSKY_EXIT ? BSKY_TURN * u * u * u
    : BSKY_TURN + (v0 * L * (1 - (1 - sc) ** 3)) / 3;
  d.level = inn * out;
  d.shapeK = x < BSKY_EXIT ? inn : 0;
  d.shapeA = u * u * u * u;
  // 2.2 Hz at rest, plus the spin dragging the wings (+~5 Hz at the exit): never a held beat.
  d.shapeB = 2 * PI * 2.2 * x * (BSKY_MS / 1000) + 0.9 * d.turn;
  d.turb = 0.55 * u * u * out;
  d.focus = 0; d.gazeX = 0; d.gazeY = 0;
  return d;
}

export const REACTIONS = {
  // inhale, not flutter: a vertebra kind contracts the iris, and the butterfly needs the open pupil.
  'bsky.trend':   { kind: KICK.inhale, shape: SHAPE.butterfly, durationMs: BSKY_MS, curve: bskyVortex },
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

// eyeReactions.js — per-piece choreography for the masthead eye (Phase 1 of the thematic
// pass). observerStore decides *that* a piece reacts (tier, tint); this table says *how*:
// a keyed timeline (or a continuous `curve`) for ObserverEye.kick(), an optional SHAPE, and a
// duration that can outrun the tier's default when the gesture needs the room.
//
// A piece missing here keeps its plain envelope kick. Timelines are pure data, normalised
// to 0..1 of durationMs; a final `turn` is folded into the swirl phase (no snap back).

import { KICK, SHAPE } from './observerEyeShader';
import { SUN_COLS } from '../sol/solEye';
import { ELEMENT_EYE_COLS } from '../mercury/mercuryEye';

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

// /TRANSMISSION — broadcast. As the iris tints violet an antenna telescopes up out of the
// pupil (two extensions, a beacon node at the tip). The beacon ignites and three pulse rings
// leave the tip OUTWARD, across the iris and on past the rim, each giving the liquid a lift
// in its wake and a small forward shove. Then the mast retracts into the pupil and the colour
// bleeds back to silver. shapeA = mast extension, shapeB = broadcast clock (<0 = unlit; the
// rings sit 0.45 apart on it and fade by 1.9).
const TX_MS = 1500;
export const TX_IGNITE = 0.24;   // x at which the beacon lights and the first pulse leaves
const TX_RATE = 4.6;             // broadcast clock per x: the third pulse has faded by x ≈ 0.85
const TX_GAP = 0.45;
function transmissionBroadcast(x, d) {
  const B = x < TX_IGNITE ? -1 : (x - TX_IGNITE) * TX_RATE;
  let turn = 0, turb = 0;
  for (let i = 0; i < 3; i++) {
    const b = B - i * TX_GAP;
    turn += 0.3 * sm(b / 0.15);
    turb += B < 0 ? 0 : 0.35 * Math.exp(-((b / 0.12) ** 2));
  }
  const up = 0.55 * sm((x - 0.03) / 0.1) + 0.45 * sm((x - 0.11) / 0.1);   // telescoping, two stages
  d.shapeA = up * (1 - sm((x - 0.7) / 0.2));                               // retract
  d.shapeB = B;
  d.shapeK = sm(x / 0.06) * (1 - sm((x - 0.9) / 0.1));
  d.level = sm(x / 0.1) * (1 - sm((x - 0.82) / 0.18));
  d.turn = turn;
  d.turb = turb;
  d.focus = 0; d.gazeX = 0; d.gazeY = 0;
  return d;
}

// /ACCRETION — the eye follows the synthesis lifecycle (useCouncilCollider's reducer modes):
//   ARMED (first mind)  -> 'accretion.prime':   a quiet gravitational prime, held
//   FIRING (second)     -> 'accretion.infall':  the swallow into an event horizon, HELD
//                          for the whole ~4.1 s flight, the photon ring humming
//   SYNTHESIZED         -> 'accretion.collide': a burst out of the dark core through the
//                          ring; only then does the horizon collapse and coast to silver
//   disarm / reset / timeout / leaving the tab -> 'accretion.release': fade out, gracefully
// The held stages are long kicks (curves in seconds) that hold until the next stage
// replaces them or the release fades them; their tails are only safety nets. No reverse
// brake anywhere: a black hole is not a turntable.
export const ACC_TAG = 'accretion';
const ACC_T = 3 * PI;            // the infall wind-up
const ACC_IN = 0.78;             // s, swallow entry: spiral in, horizon open
const ACC_SPIN = 1.6;            // rad/s, the held horizon's slow forward turn
const ACC_R = 0.34;              // horizon radius (the photon ring sits at ×1.16)
const ACC_FRONT = 0.5;           // where the dark front stops

const PRIME_MS = 45000;          // the reducer's ARMED timeout
function accretionPrime(x, d) {
  const t = x * (PRIME_MS / 1000);
  const env = sm(t / 0.8) * (1 - sm((t - 43.5) / 1.5));
  d.level = 0.32 * env * (1 + 0.15 * Math.sin(t * 1.9));     // a slow expectant breath
  d.turn = 0.6 * t * sm(t / 0.8);                            // the inward pull: a slow forward draw
  d.focus = 0.1 * env;
  d.shapeK = 0; d.shapeA = 0; d.shapeB = 0; d.shapeC = 0; d.turb = 0; d.gazeX = 0; d.gazeY = 0;
  return d;
}

const SWALLOW_MS = 7500;         // safety: the flight is ~4.1 s; the collapse tail starts at 6.8 s
export function accretionSwallow(x, d) {
  const t = x * (SWALLOW_MS / 1000);
  const u = Math.min(1, t / ACC_IN);
  const v0 = (3 * ACC_T) / ACC_IN, tau = 0.25, th = Math.max(0, t - ACC_IN);
  d.turn = t <= ACC_IN ? ACC_T * u * u * u
    : ACC_T + ACC_SPIN * th + (v0 - ACC_SPIN) * tau * (1 - Math.exp(-th / tau));
  const gone = sm((t - 6.8) / 0.7);
  d.shapeA = ACC_R * sm((t - 0.3) / (ACC_IN - 0.3)) * (1 - gone);
  d.shapeB = 1.05 - (1.05 - ACC_FRONT) * u * u * (1 - gone);
  d.shapeC = 0;
  d.shapeK = sm(t / 0.09) * (1 - sm((t - 7.3) / 0.2));
  d.level = sm(t / 0.15) * (1 - gone);
  d.turb = (t <= ACC_IN ? 0.4 * u * u : 0.15 + 0.25 * Math.exp(-th / 0.3)) * (1 - gone);
  d.focus = 0; d.gazeX = 0; d.gazeY = 0;
  return d;
}

const EJECT_MS = 1700;
export const EJECT_OUT = 0.6;    // s: the burst has left the eye; the horizon starts to collapse
export function accretionEject(x, d) {
  const D = EJECT_MS / 1000, t = x * D;
  const e = Math.min(1, t / EJECT_OUT);
  d.shapeC = t < EJECT_OUT + 0.02 ? 0.02 + 1.1 * (1 - (1 - e) ** 3) : 0;   // out of the core, fast
  const c = sm((t - EJECT_OUT) / 0.65);                                    // then the collapse
  d.shapeA = ACC_R * (1 - c);
  d.shapeB = ACC_FRONT + (1.05 - ACC_FRONT) * c;
  d.shapeK = 1 - sm((t - 1.5) / 0.2);
  d.level = 1 - sm((t - 0.75) / 0.95);
  // Picks up the held horizon's forward turn and coasts it to rest, plus the burst's shove.
  d.turn = (ACC_SPIN * D * (1 - (1 - x) ** 3)) / 3 + 1.5 * sm(t / 0.5);
  d.turb = 0.5 * Math.exp(-t / 0.3);
  d.focus = 0; d.gazeX = 0; d.gazeY = 0;
  return d;
}

// /SCENT — the two accords collide, in their own colours (the impulse's tint / tint2 are the
// collider's hsl(hue, 70%, 60%) for domain A and B). The iris splits into a two-arm swirl,
// half A, half B; two lobes in those colours orbit and spiral into each other, faster as
// they close (the swirl winds up with them); they collide in a flash, three waves pulse out
// 0.15 s apart like the collider's own (accord-tinted, each weaker), and the two colours blend
// into one accord; then it coasts forward to silver.
// shapeA = lobe orbit radius, shapeB = orbit angle, shapeC = seconds since the hit (0 = not yet;
// the shader derives each wave's radius from it).
const SCENT_MS = 1900;
export const SCENT_HIT = 0.95;   // s: the lobes meet
export function scentCollide(x, d) {
  const D = SCENT_MS / 1000, t = x * D;
  const u = Math.min(1, t / SCENT_HIT);
  const pre = t < SCENT_HIT;
  d.shapeA = pre ? 0.55 * (1 - u * u) : 0;
  const B0 = 2 * PI * (0.8 * SCENT_HIT + 1.6), w1 = 2 * PI * (0.8 + 4.8 / SCENT_HIT);
  d.shapeB = pre ? 2 * PI * (0.8 * t + 1.6 * u * u * u) : B0 + w1 * 0.35 * (1 - Math.exp(-(t - SCENT_HIT) / 0.35));
  d.shapeC = pre ? 0 : t - SCENT_HIT + 1e-3;
  // The swirl winds up with the lobes (∝ u³), then coasts forward to rest by the end.
  const T = 4 * PI, v0 = (3 * T) / SCENT_HIT, L = D - SCENT_HIT, s = Math.max(0, (t - SCENT_HIT) / L);
  d.turn = pre ? T * u * u * u : T + (v0 * L * (1 - (1 - s) ** 3)) / 3;
  d.level = sm(t / 0.15) * (1 - sm((t - 1.3) / 0.6));
  d.shapeK = sm(t / 0.12) * (1 - sm((t - 1.72) / 0.18));    // the third wave clears the rim by ~1.75 s
  d.turb = pre ? 0.4 * u * u : 0.6 * Math.exp(-(t - SCENT_HIT) / 0.25);
  d.focus = 0; d.gazeX = 0; d.gazeY = 0;
  return d;
}

// /SOL — the snap. While a region is held the eye is the sun's surface (solEye.js drives it
// live: SHAPE.sun, tension twisting and heating the cells, the spin following the stir).
// The snap takes over from that: the tension lets go (the twist unwinds into a forward
// shove), a flare at the core and a solar-wind burst — a ring with radial streaks — blows
// out past the rim, then the surface melts and the spin coasts forward to silver.
// shapeA = tension, shapeC = seconds since the snap.
const SOL_MS = 1600;
export function solRelease(x, d) {
  const D = SOL_MS / 1000, t = x * D;
  d.shapeA = 0.85 * Math.exp(-t / 0.12);                  // the held twist lets go at once
  d.shapeB = 0;
  d.shapeC = t + 1e-3;
  d.shapeK = 1 - sm((t - 0.9) / 0.6);
  d.level = 1 - sm((t - 0.8) / 0.8);
  d.turn = 2.2 * sm(t / 0.35) + (2.5 * D * (1 - (1 - x) ** 3)) / 3;   // the unwinding shove, then a coast
  d.turb = 0.55 * Math.exp(-t / 0.3);
  d.focus = 0; d.gazeX = 0; d.gazeY = 0;
  return d;
}

// /SURVEILLANCE — the eye watches the packet. 'lock' (a source picked): it locks on and
// HOLDS — iris narrowed, tinted, a slow watchful breath — until the destination sends the
// packet (the trace takes over) or the route is cleared / the tab left (release). 'trace' (a packet sent): the pupil travels along the route —
// at each bounce it swings (0.22 s, never a teleport) to look along the next hop's compass
// heading, holds it while the packet crosses, flinches (a sharp contraction) at every
// interception the timeline cues, and returns to centre after the packet lands.
// data (from useInterceptSession): { heads: [[x, y] unit, screen-up = +y] per hop,
// dwellMs, hopMs, cues: [ms], durationMs }.
const SV_GAZE = 0.22;      // gaze reach (the foreshortening keeps the disc inside the canvas)
const SV_SWING = 0.22;     // s, one swing between headings
const SV_RETURN = 0.45;    // s, back to centre after landing
export function surveillanceTrace(data) {
  const heads = Array.isArray(data?.heads) ? data.heads : [];
  const dwell = (data?.dwellMs ?? 0) / 1000, hop = (data?.hopMs ?? 700) / 1000;
  const cues = (Array.isArray(data?.cues) ? data.cues : []).map((ms) => ms / 1000);
  const land = (data?.durationMs ?? 0) / 1000;
  const D = land + SV_RETURN + 0.15;
  const target = (i) => (i < 0 || i >= heads.length ? [0, 0] : [heads[i][0] * SV_GAZE, heads[i][1] * SV_GAZE]);
  const curve = (x, d) => {
    const t = x * D;
    let gx = 0, gy = 0;
    if (heads.length && t >= dwell) {
      const i = Math.min(heads.length - 1, Math.floor((t - dwell) / hop));
      const [ax, ay] = target(i - 1), [bx, by] = target(i);
      const w = sm((t - dwell - i * hop) / SV_SWING);
      gx = ax + (bx - ax) * w; gy = ay + (by - ay) * w;
    }
    const back = 1 - sm((t - land) / SV_RETURN);
    d.gazeX = gx * back; d.gazeY = gy * back;
    let flinch = 0;
    for (let k = 0; k < cues.length; k++) flinch += Math.exp(-(((t - cues[k]) / 0.08) ** 2));
    d.focus = (0.28 + 0.3 * Math.min(1, flinch)) * sm(t / 0.2) * back;
    d.level = 0.85 * sm(t / 0.15) * (1 - sm((t - land - 0.1) / (SV_RETURN + 0.05)));
    d.turn = 0; d.turb = 0; d.shapeK = 0; d.shapeA = 0; d.shapeB = 0; d.shapeC = 0;
    return d;
  };
  return { kind: KICK.watch, durationMs: Math.round(D * 1000), curve, tag: SV_TAG };
}

export const SV_TAG = 'surveillance';
const SV_LOCK_MS = 30000;        // safety tail; the trace or a release normally ends it
function surveillanceLock(x, d) {
  const t = x * (SV_LOCK_MS / 1000);
  const env = sm(t / 0.25) * (1 - sm((t - 29) / 1));
  d.focus = (0.36 + 0.04 * Math.sin(t * 2.4)) * env;     // locked on, breathing
  d.level = 0.8 * env;
  d.gazeX = 0; d.gazeY = 0; d.turn = 0; d.turb = 0; d.shapeK = 0; d.shapeA = 0; d.shapeB = 0; d.shapeC = 0;
  return d;
}

// /CRYPTOGRAPHY — the eye follows the cryptographic lifecycle (cryptoEye.js + ClassifiedTab):
//   entropy drag   -> live drive (cryptoEye): amber + the lattice build with the bits, a
//                     chaotic scramble rides the pointer; a pause holds the charge
//   keygen         -> 'crypto.keygen': the chaos settles into a tight, structured lattice
//                     humming in rhythm, HELD until the key is made (tag ACC-style 'crypto')
//   key_generated  -> 'crypto.seal' (keyed): the lattice locks on a detent, an amber seal
//                     burst rings out, the spin coasts to silver
//   file seal / unlock / verify -> 'crypto.seal': scramble, then the same detent + burst
//   reset / leaving -> 'crypto.release': fades only the held keygen
// Cipher params: shapeA = chaos, shapeB = re-deal clock (< 0: the burst, radius -B),
// shapeC = order (the lattice). A dial seating, not a turntable: no back-spin anywhere.
export const CRYPTO_TAG = 'crypto';
export const CRYPTO_COLS = [[251, 191, 36], [194, 65, 12], [253, 230, 138]];   // amber · rust · pale gold
const CRYPTO_MS = 1300;
export const CRYPTO_SNAP = 0.62;   // s: the detent (the plain seal)
const KEYED_SNAP = 0.1;            // s: the detent when the lattice was already held

function sealTail(t, snap, d) {     // detent + burst + fade, shared by both seals
  const dt = t - snap;
  d.focus = dt < 0 ? 0 : 0.42 * Math.exp(-dt / 0.12);              // seated, focused
  d.turn = 0.35 * sm(dt / 0.06);                                   // one click forward
  const e = Math.min(1, Math.max(0, dt / 0.5));
  if (dt >= 0) d.shapeB = -(0.04 + 1.15 * (1 - (1 - e) ** 3));     // the burst, out of the core
  d.shapeK = dt < 0.55 ? 1 : 1 - sm((dt - 0.55) / 0.12);
  d.level = sm(t / 0.08) * (1 - sm((dt - 0.1) / 0.55));
  d.gazeX = 0; d.gazeY = 0;
}
export function cryptoSeal(x, d) {
  const t = x * (CRYPTO_MS / 1000);
  const on = sm(t / 0.08) * (1 - sm((t - CRYPTO_SNAP) / 0.05));
  d.shapeA = on;
  d.shapeB = 14 * t;
  d.shapeC = 0;
  d.turb = 0.3 * on;
  sealTail(t, CRYPTO_SNAP, d);
  return d;
}
const KEYED_MS = 1100;
export function cryptoKeyed(x, d) {
  const t = x * (KEYED_MS / 1000);
  d.shapeA = 0;
  d.shapeB = 14 * t;
  d.shapeC = 1 - sm(t / KEYED_SNAP);                                 // the lattice locks shut
  d.turb = 0;
  sealTail(t, KEYED_SNAP, d);
  d.level = 1 - sm((t - KEYED_SNAP - 0.1) / 0.55);                   // already lit: no fade-in
  return d;
}

const KEYGEN_MS = 60000;           // safety tail; the key (or a release) normally ends it
export function cryptoKeygen(x, d) {
  const t = x * (KEYGEN_MS / 1000);
  const settle = sm(t / 0.6);                                        // chaos -> order
  const env = 1 - sm((t - 58.5) / 1.5);
  d.shapeA = 0.6 * (1 - settle) * env;
  d.shapeB = 4 * t;
  d.shapeC = settle * env;
  d.shapeK = env;
  d.level = env;
  d.focus = (0.22 + 0.05 * Math.sin(t * 13.8)) * settle * env;       // the hum: in step with the lattice
  d.turn = 0.9 * t;                                                  // a steady, structured turn
  d.turb = 0.25 * (1 - settle);
  d.gazeX = 0; d.gazeY = 0;
  return d;
}

// /CHAOS — the Feigenbaum cascade. Hand bifurcations and the right-click orthogonal shift
// ('chaos.fork') run the full, violent cascade: the swirl's lobes double 1 -> 2 -> 4 -> 8 ->
// 16 at intervals shrinking by δ ≈ 4.669 (they pile into the accumulation point), the spin
// doubling with every period; past it the figure smears into chaos, then settles to silver.
// A node pick or a resonance pair ('chaos.pick') is the modest version: one split, then it
// merges back (a period halving). shapeA = doublings, shapeB = lobe phase, shapeC = chaos.
export const FEIGEN_DELTA = 4.669201609;
const FORK_MS = 2000;
const FORK_T0 = 0.15, FORK_D1 = 0.55;                   // s: the first doubling, the first interval
export const FORK_TIMES = [0, 1, 2, 3].map((k) =>          // each interval 1/δ of the last
  FORK_T0 + (k === 0 ? 0 : FORK_D1 * (1 - FEIGEN_DELTA ** -k) / (1 - 1 / FEIGEN_DELTA)));
export const FORK_ACCUM = FORK_T0 + FORK_D1 / (1 - 1 / FEIGEN_DELTA);   // the accumulation point
const forkSplit = (k) => (k === 0 ? 0.12 : Math.min(0.12, 0.6 * FORK_D1 * FEIGEN_DELTA ** -(k - 1)));
const forkA = (t) => FORK_TIMES.reduce((s, T, k) => s + sm((t - T) / forkSplit(k)), 0);
const forkC = (t) => sm((t - FORK_ACCUM + 0.02) / 0.14);
// The spin doubles with each period (ω = 1.1 · 2^A rad/s), then coasts out over the settle.
const FORK_TURN = (() => {
  const N = 800, D = FORK_MS / 1000, out = new Float64Array(N + 1);
  let th = 0, w = 0;
  for (let i = 1; i <= N; i++) {
    const t = (i / N) * D, dt = D / N;
    const settle = 1 - sm((t - 1.25) / 0.7);
    w = 1.1 * 2 ** forkA(t) * (1 + 0.6 * forkC(t)) * settle;
    th += w * dt;
    out[i] = th;
  }
  return out;
})();
export function chaosFork(x, d) {
  const D = FORK_MS / 1000, t = x * D;
  const fi = Math.min(FORK_TURN.length - 1, Math.max(0, x * (FORK_TURN.length - 1)));
  const i0 = Math.floor(fi), i1 = Math.min(FORK_TURN.length - 1, i0 + 1);
  d.turn = FORK_TURN[i0] + (FORK_TURN[i1] - FORK_TURN[i0]) * (fi - i0);
  d.shapeA = forkA(t);
  d.shapeB = 0;
  d.shapeC = forkC(t);
  d.shapeK = 1 - sm((t - 1.35) / 0.4);
  d.level = sm(t / 0.1) * (1 - sm((t - 1.3) / 0.7));
  let kick = 0;
  for (const T of FORK_TIMES) kick += Math.exp(-(((t - T) / 0.05) ** 2));
  d.focus = 0.12 * Math.min(1.5, kick);                  // the iris flinches at every doubling
  d.turb = 0.12 * d.shapeA / 4 + 0.75 * d.shapeC * (1 - sm((t - 1.3) / 0.6));
  d.gazeX = 0; d.gazeY = 0;
  return d;
}
const PICK_MS = 1000;
export function chaosPick(x, d) {
  const t = x * (PICK_MS / 1000);
  d.shapeA = sm((t - 0.12) / 0.2) * (1 - sm((t - 0.55) / 0.25));   // one split, merged back
  d.shapeB = 0; d.shapeC = 0;
  d.shapeK = 1 - sm((t - 0.82) / 0.15);
  d.level = 0.75 * sm(t / 0.1) * (1 - sm((t - 0.6) / 0.38));
  d.turn = 0.7 * sm(t / 0.9);
  d.focus = 0.1 * Math.exp(-(((t - 0.22) / 0.06) ** 2));
  d.turb = 0; d.gazeX = 0; d.gazeY = 0;
  return d;
}

// /LEDGER — the audit pollutes the eye, as badly as the audit rules (LedgerTab):
//   the kernel rules on the hand's submit -> 'ledger.write' (data.severity 0..1, ledgerSeverity:
//                     the verdict tier shaded by the DO deficit / BOD / nitrate / thermal load):
//                     sepia-grey silt clouds in from the rim through the liquid metal, the
//                     swirl turns turbulent and dim. Clean water (APPROVED) is a brief silt
//                     whisper at the rim that settles on its own; a REJECTED river clouds in
//                     well past mid-iris; an EMERGENCY_VETO chokes the iris to the pupil, dims
//                     it deepest and churns hardest. Polluted water is HELD until the verdict.
//   the cascade's verdict lands -> 'ledger.clear': a slow release, slower the worse the water
//   a failed run / leaving the tab -> 'ledger.release': the same, quickly
// Below MURK_TINT_FROM the eye keeps its silver (no tint, so reduced motion shows nothing
// either); above it the murk's own tint takes the colour and silver steps aside (Phase 0a).
// A clearing, not a brake: no back-spin anywhere.
// shapeA = front reach, shapeB = drift clock, shapeC = density (the severity).
export const LEDGER_TAG = 'ledger';
export const MURK_COLS = [[150, 126, 94], [88, 85, 80]];   // sepia · silt grey
export const MURK_IN = 1.8;        // s: the front has come in from the rim
export const MURK_TINT_FROM = 0.25;
const MURK_MS = 30000;             // safety tail: a hold nobody releases still clears, slowly
const sev01 = (s) => (Number.isFinite(s) ? Math.min(1, Math.max(0, s)) : 0.5);
export const murkClearMs = (s) => Math.round(2500 + 6000 * sev01(s));   // 2.5 s clean … 8.5 s vetoed
export function ledgerMurk(severity) {
  const s = sev01(severity);
  const reach = 0.36 + 0.64 * s;                   // how far the front comes in (clean water: a rim band)
  const settle = 2.6 + 70 * s * s;                 // clean water settles before the verdict
  return (x, d) => {
    const t = x * (MURK_MS / 1000);
    const u = Math.min(1, t / MURK_IN);
    const env = (1 - sm((t - settle) / 1.5)) * (1 - sm((t - 24) / 6));
    const A = 1 - (1 - u) ** 3;                    // fast off the rim, easing in
    d.shapeA = reach * A;
    d.shapeB = t;
    d.shapeC = s;
    d.shapeK = sm(t / 0.3) * env;
    d.level = (0.25 + 0.75 * s) * sm(t / 0.5) * env;
    d.turb = (0.08 + 0.72 * s) * A * (0.85 + 0.15 * Math.sin(t * 2.3)) * env;   // churning, unsteady
    d.turn = (0.15 + 0.3 * s) * t + 0.22 * s * Math.sin(t * 1.3);              // forward, in lurches
    d.focus = 0; d.gazeX = 0; d.gazeY = 0;
    return d;
  };
}
function ledgerWrite(imp) {
  const s = sev01(imp.data?.severity);
  const tinted = s >= MURK_TINT_FROM;
  return {
    kind: KICK.watch, shape: SHAPE.murk, durationMs: MURK_MS, curve: ledgerMurk(s), tag: LEDGER_TAG,
    tint: tinted ? MURK_COLS[0] : null, tint2: tinted ? MURK_COLS[1] : null,
  };
}

// /MERCURY — an element node lit by a tap: the eye focuses into that element's own palette.
// The iris draws in as the colour floods over the silver, holds a beat with a slow inward
// turn, then lets go; the tinted kick's end is a return to silver, so the back-spin follows.
// (The planet's spin is not here: mercuryEye drives it live, eyeDrive spin.)
export const MERCURY_ELEMENT_MS = 1400;
function mercuryElement(x, d) {
  const t = x * (MERCURY_ELEMENT_MS / 1000);
  const out = 1 - sm((t - 0.8) / 0.6);
  d.level = sm(t / 0.18) * out;
  d.focus = 0.46 * sm(t / 0.24) * out;
  d.turn = 0.7 * sm(t / 0.9);
  d.turb = 0; d.gazeX = 0; d.gazeY = 0;
  d.shapeK = 0; d.shapeA = 0; d.shapeB = 0; d.shapeC = 0;
  return d;
}

export const REACTIONS = {
  'mercury.element': (imp) => {
    const cols = ELEMENT_EYE_COLS[imp.data?.phase];
    return cols ? { kind: KICK.inhale, durationMs: MERCURY_ELEMENT_MS, curve: mercuryElement, tint: cols[0], tint2: cols[1] } : null;
  },
  // /MERCURY: the planet's spin drives the eye live (mercuryEye); the flick still counts as the
  // act but plays nothing over it (the old shove would add a second turn on top of the coast).
  'mercury.flick': { kind: KICK.shove, durationMs: 400, keys: [{ t: 0, level: 0 }, { t: 1, level: 0 }] },
  'ledger.write':   ledgerWrite,
  'ledger.clear':   (imp) => ({ release: true, tag: LEDGER_TAG, durationMs: murkClearMs(imp.data?.severity) }),
  'ledger.release': { release: true, tag: LEDGER_TAG, durationMs: 600 },
  'chaos.fork': { kind: KICK.watch, shape: SHAPE.feigen, durationMs: FORK_MS, curve: chaosFork },
  'chaos.pick': { kind: KICK.watch, shape: SHAPE.feigen, durationMs: PICK_MS, curve: chaosPick },
  'crypto.seal': (imp) => (imp.data?.keyed
    ? { kind: KICK.watch, shape: SHAPE.cipher, durationMs: KEYED_MS, curve: cryptoKeyed, tint: CRYPTO_COLS[0], tint2: CRYPTO_COLS[1] }
    : { kind: KICK.watch, shape: SHAPE.cipher, durationMs: CRYPTO_MS, curve: cryptoSeal, tint: CRYPTO_COLS[0], tint2: CRYPTO_COLS[1] }),
  'crypto.keygen':  { kind: KICK.watch, shape: SHAPE.cipher, durationMs: KEYGEN_MS, curve: cryptoKeygen, tag: CRYPTO_TAG, tint: CRYPTO_COLS[0], tint2: CRYPTO_COLS[1] },
  'crypto.release': { release: true, tag: CRYPTO_TAG, durationMs: 600 },
  'surveillance.lock':  { kind: KICK.watch, durationMs: SV_LOCK_MS, curve: surveillanceLock, tag: SV_TAG },
  'surveillance.release': { release: true, tag: SV_TAG, durationMs: 500 },
  'surveillance.trace': (imp) => (imp.data ? surveillanceTrace(imp.data) : null),
  'sol.release': { kind: KICK.inhale, shape: SHAPE.sun, durationMs: SOL_MS, curve: solRelease, tint: SUN_COLS[0], tint2: SUN_COLS[1] },
  'scent.collide': { kind: KICK.inhale, shape: SHAPE.accord, durationMs: SCENT_MS, curve: scentCollide },
  'accretion.prime':   { kind: KICK.spiral, durationMs: PRIME_MS, curve: accretionPrime, tag: ACC_TAG },
  'accretion.infall':  { kind: KICK.spiral, shape: SHAPE.horizon, durationMs: SWALLOW_MS, curve: accretionSwallow, tag: ACC_TAG },
  'accretion.collide': { kind: KICK.spiral, shape: SHAPE.horizon, durationMs: EJECT_MS, curve: accretionEject, tag: ACC_TAG },
  'accretion.release': { release: true, tag: ACC_TAG, durationMs: 600 },
  'transmission.mark': { kind: KICK.inhale, shape: SHAPE.antenna, durationMs: TX_MS, curve: transmissionBroadcast },
  // /ECOCIDE: the drag itself drove the eye (ecocideEye); letting go clears it on the drive's
  // own ease. The release still counts as the act, but plays nothing over that fade (a plain
  // tinted envelope here would back-spin as it unwound). Keyed at level 0, the tab tint only
  // shows where the drive does not: reduced motion's static colour hold.
  'ecocide.growth': { kind: KICK.sag, durationMs: 400, keys: [{ t: 0, level: 0 }, { t: 1, level: 0 }] },
  // /LUNAR: the scrub and the compile sweep drive the moon live (lunarEye). The spine's
  // vertebra still counts as the act; it plays nothing over the sweep (the old terminator
  // sweep kick would tint and darken the moon). Reduced motion keeps its static colour hold.
  'lunar.phase': { kind: KICK.sweep, durationMs: 400, keys: [{ t: 0, level: 0 }, { t: 1, level: 0 }] },
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
  const entry = REACTIONS[imp.piece];
  const r = typeof entry === 'function' ? entry(imp) : entry;   // per-impulse choreography (a route)
  return r ? { ...base, ...r } : base;
}

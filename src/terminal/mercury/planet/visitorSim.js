// src/terminal/mercury/planet/visitorSim.js — the visitors (spec docs/superpowers/specs/2026-10-03-mercury-visitors-design.md).
//
// A tapped element falls from its node onto the planet and meets the mercury as itself:
//   water spreads into a thin film (S = γHg − γw − γHg/w ≈ +38 mN/m: it WETS Hg), or above its Leidenfrost
//     point skates as a bead on its own vapour;
//   an ember opens a Marangoni clearing (tension falls with heat, so the surface flows away from the hot spot);
//   a rock floats (ρ ≈ 2.7 against Hg's 13.5);
//   a gust dents the surface and drives cat's-paws downwind.
// Plain arrays; this module's own maths uses no three.js (mercuryImpacts, which it borrows two pure functions
// from, imports three for its quaternion helpers). MercuryPlanet owns GL: it writes a ctx every frame and drains
// out.impacts into the impulse ring, the scar map and the calm glow. Allocates nothing per frame.

import { R_SCENE } from './planetLook';
import { SUN_DIR_WORLD } from './planetFrame';
import { qRotate, qRotateInv } from './breakupFamily';
import { strikeDirWorld, localTempK } from './mercuryImpacts';
import { LIQUID_TAU } from './mercuryWaves';
import { HG_MELT_K, HG_BOIL_K } from './mercuryThermal';

export const VISITOR_SLOTS = 8;
export const MAX_PER_ELEMENT = 4;
export const T_FLIGHT = Object.freeze({ fluid: 0.75, thermal: 0.6, earth: 0.85, air: 0.65 });
export const FLIGHT_BOW = 0.35;            // mid-flight bow toward the camera, × R_SCENE: the fall never grazes the limb
export const LEIDENFROST_K = 470;          // water meeting a hotter surface never wets it
export const DETACH_OMEGA = 6;             // rad/s: a release this fast flings the residents off (every hyper pins 12)
export const DETACH_FADE_S = 0.6;
export const FADE_S = 1;                   // every resident fades over its last second
export const CALM_LIFE = 0.5;              // reduced motion: residents stay half as long
export const AIM_MAX_RAD = (35 * Math.PI) / 180;  // every landing sits within this of the sub-camera point (matrix spec §4.1)

// How long each touchdown stays, s (0 = nothing stays), and the impulse it sends into the ring (mercuryWaves kinds).
export const RESIDENT_LIFE_S = Object.freeze({
  film: 8, bead: 6, ember: 6, rock: 12, jet: 1.5, ring: 0, crater: 0,
  frost: 1.5, pool: 4, sink: 5, strip: 1.5,   // matrix: frost = FROST_CREEP_S, pool = POOL_GROW_S + POOL_FREEZE_S, sink = SINK_S
  quench: 0.6, crustpool: 4,                  // amendment A: quench = QUENCH_SPREAD_S, crustpool = POOL_GROW_S + POOL_FREEZE_S
});
// Frost and the pool ring like any strike on solid Hg (plan P-5); a rock sinking into soft crust sends nothing, nor do
// water and fire meeting the crust (amendment A5: the rind and the pool replace the crater).
export const IMPULSE_FOR = Object.freeze({
  film: 'dimple', bead: 'dimple', ember: 'marangoni', rock: 'crown', jet: 'jet', ring: 'ring', crater: '',
  frost: 'ring', pool: 'ring', sink: '', strip: 'jet', quench: '', crustpool: '',
});
// The kinds that leave a persistent mark in the scar map when their life ends (matrix spec §4, §9).
export const STAMP_FOR = Object.freeze({ frost: 'frost', pool: 'glaze', sink: 'pit', quench: 'quench', crustpool: 'glaze' });

// Bodies, scene units (R_SCENE = 0.75).
export const DROP_R = 0.028;
export const DROP_STRETCH_K = 0.08;        // a falling drop stretches this much per unit/s…
export const DROP_STRETCH_MAX = 0.6;       // …to an aspect of 1.6 at most
export const BEAD_R = 0.03;
export const BEAD_OBLATE = -0.15;          // a Leidenfrost bead sits a little squashed
export const BEAD_SHRINK = 0.6;            // and evaporates to 40 % of its radius
export const BEAD_GAP = 0.004;             // the vapour cushion under it
export const SKATE_V0 = 0.25;              // rad/s along the surface at touchdown
export const SKATE_KICK = 0.9;             // rad/s² random kicks (vapour jets venting unevenly)
export const SKATE_DAMP = 0.35;            // 1/s
export const EMBER_R = 0.018;
export const EMBER_BODY_S = 3;             // the ember itself is gone by now; its hot spot lingers
export const EMBER_T_LAUNCH_K = 1300;
export const HOT_T0_K = 1000;              // the ember and its spot at touchdown
export const HOT_COOL_K_PER_S = 80;
export const EMBER_TAIL_S = 0.08;          // the comet tail is this much of the path behind it
export const EMBER_HALO = 1.6;             // the tail's glow half-width, × EMBER_R
export const ROCK_R = 0.035;
export const ROCK_BOUND = 1.15;            // a rock is its cut planes ∩ a sphere this × r: always bounded
export const ROCK_SUBMERGED = 0.2;         // it floats ~20 % under
export const ROCK_BOB_AMP = 0.5;           // × ROCK_R: it plunges, then pops back up
export const ROCK_BOB_T = 1.2;
export const ROCK_BOB_EFOLD = 2;
export const ROCK_SPIN0 = 6;               // rad/s tumble in flight, dying on the surface
export const ROCK_SPIN_EFOLD = 1.5;
export const ROCK_SINK_S = 1;
export const GUST_TRAIL_S = 0.12;          // the gust's shimmer is this much of its path
export const GUST_W = 0.012;
export const EXO_PUFF = 0.15;              // an ember on boiling Hg lifts this much exosphere coverage…
export const EXO_PUFF_S = 1.5;             // …decaying over this

// The matrix (spec docs/superpowers/specs/2026-10-04-mercury-visitors-matrix-design.md).
export const SOFT_TAU_MIN = 0.1;           // below this the crust is hard: a rock craters instead of sinking
export const FROST_R = 0.05;               // rad: the frost patch at the end of its creep
export const FROST_CREEP_S = 1.5;
export const POOL_R = 0.035;               // rad: the melt pool at full size
export const POOL_GROW_S = 3;              // it grows while the ember burns (EMBER_BODY_S)…
export const POOL_FREEZE_S = 1;            // …then refreezes into glaze
export const SINK_S = 5;                   // a rock sinks into soft crust over this
export const PIT_R = 0.03;                 // rad
export const PIT_DEPTH_M = 600;            // true metres (the shader's uRelief exaggerates, like the craters)
export const COLLAR_H = 0.002;             // fraction of R: the crust pushed up round the sinking rock
export const PLUME_LEN = 0.12;             // scene units: the vapour streamer torn downwind
export const PLUME_LIFT = 0.35;            // how much it rises off the surface as it streams
export const PLUME_W = 0.015;
export const PLUME_GROW_S = 0.4;
// Amendment A (spec §9): water and fire on crust.
export const QUENCH_R = 0.05;              // rad: the quench rind at the end of its spread
export const QUENCH_SPREAD_S = 0.6;        // the drop flashes off the hot rock fast
export const QUENCH_STEAM_LEN = 0.06;      // scene units: the steam column it throws up (plan Q-1)
export const QUENCH_STEAM_GROW_S = 0.15;

// Surface slots (visitorFrame → the planet shader): what an element leaves IN the liquid.
export const VISIT_SURF_MAX = 4;
export const SURF_FILM = 1, SURF_HOT = 2, SURF_MENISCUS = 3, SURF_JET = 4, SURF_FROST = 5, SURF_POOL = 6, SURF_COLLAR = 7, SURF_QUENCH = 8;
export const FILM_R0 = 0.02;               // rad
export const FILM_GROW = 0.05;             // rad/√s: a spreading film's radius grows as √t
export const FILM_H0_NM = 1000;            // thickness at touchdown…
export const FILM_H1_NM = 80;              // …and at the end of its life
export const FILM_N = 1.33;
export const FILM_A = 0.35;                // interference contrast over the mirror
export const FILM_TEAR_NM = 200;           // thinner than this, the film tears into lenses
export const FILM_NOISE_FREQ = 60;
export const CLEAR_R_MAX = 0.09;           // rad
export const CLEAR_TAU_S = 1.2;
export const CLEAR_DEPTH = 0.004;          // fraction of R
export const CLEAR_DECAY_S = 2.5;
export const HOT_GAIN = 0.8;
export const MENISCUS_RING_DEPTH = 0.003;
export const JET_R = 0.06;
export const JET_DEPTH = 0.006;
export const CATSPAW_K = 140;
export const CATSPAW_AMP = 0.05;
export const CATSPAW_SPEED = 9;
// The matrix's looks on frozen Hg (planet shader).
export const FROST_ALBEDO = [0.8, 0.84, 0.9];  // rime: a cold, faintly blue white
export const FROST_ENV = 0.5;                   // how much of the nebula + node light the matte rime gathers (spec R5)
export const GLAZE_ROUGH = 0.1;                 // a refrozen pool: far smoother than polycrystalline frozen Hg
// The crust looks (amendment A, planet shader's crust path).
export const EVAPORITE_ALBEDO = [0.86, 0.84, 0.78];  // the pale ring the flashed drop leaves (its dissolved load)
export const EVAPORITE_A = 0.85;
export const EVAPORITE_EDGE = 0;      // widens both of the ring's transitions (in rind-profile units; ≤ 0.1 keeps its plateau)
export const EVAPORITE_LIFT = 0;      // 0: the ring is a flat pale albedo; 1: the crust's own lit colour brightened (texture shows)
export const EVAPORITE_GAIN = 2.2;    // …by this, tinted by EVAPORITE_ALBEDO (normalised)
export const QUENCH_DARK = 0.45;                      // the quenched glass skin darkens the rock under it…
export const QUENCH_ROUGH = 0.15;                     // …and is far smoother than it
export const GLASS_F0 = 0.04;                         // glass's normal-incidence reflectance (n ≈ 1.5)
export const POOL_RIM_H = 0.0025;               // fraction of R: the pool's meniscus lip against its frozen shore

// Light (visitorGlsl mirrors these exactly).
export const PLANCK_C2_NM_K = 1.4388e7;
export const PLANCK_REF_K = 1300;
export const GLOW_EXPO = 2000;
export const EMBER_GAIN = 3;

const LAMBDA_NM = [650, 532, 450];
const PLANCK_REF = Math.exp(PLANCK_C2_NM_K / (650 * PLANCK_REF_K)) - 1;

// Blackbody spectral radiance at 650 / 532 / 450 nm, red = 1 at PLANCK_REF_K. The exponent is clamped at 80
// so a cool spot underflows to 0 instead of overflowing a GPU float.
export function planckRGB(tK, out = [0, 0, 0]) {
  for (let k = 0; k < 3; k++) {
    const x = Math.min(PLANCK_C2_NM_K / (LAMBDA_NM[k] * Math.max(tK, 1)), 80);
    out[k] = ((650 / LAMBDA_NM[k]) ** 5 / (Math.exp(x) - 1)) * PLANCK_REF;
  }
  return out;
}

// The hue of a blackbody at tK with its brightness saturated (1 − e^(−red·GLOW_EXPO)): 900 K reads dull red,
// 700 K is black, 1300 K is full.
export function glowRGB(tK, out = [0, 0, 0]) {
  planckRGB(tK, out);
  const r = Math.max(out[0], 1e-12), g = 1 - Math.exp(-out[0] * GLOW_EXPO);
  out[0] = (out[0] / r) * g; out[1] = (out[1] / r) * g; out[2] = (out[2] / r) * g;
  return out;
}

const smooth01 = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
export const filmRadius = (a) => FILM_R0 + FILM_GROW * Math.sqrt(Math.max(a, 0));
export const filmThicknessNm = (a) => FILM_H0_NM * (FILM_H1_NM / FILM_H0_NM) ** Math.min(1, Math.max(0, a / RESIDENT_LIFE_S.film));
export const clearRadius = (a) => CLEAR_R_MAX * (1 - Math.exp(-Math.max(a, 0) / CLEAR_TAU_S));
export const clearDepth = (a) => CLEAR_DEPTH * Math.exp(-Math.max(a, 0) / CLEAR_DECAY_S);
export const hotTempK = (a) => Math.max(0, HOT_T0_K - HOT_COOL_K_PER_S * Math.max(a, 0));
export const emberFlightTempK = (s) => EMBER_T_LAUNCH_K + (HOT_T0_K - EMBER_T_LAUNCH_K) * Math.min(1, Math.max(0, s));
export const jetEnvelope = (a) => (a > 0 && a < RESIDENT_LIFE_S.jet ? Math.sin((Math.PI * a) / RESIDENT_LIFE_S.jet) : 0);
export const rockBob = (a) => -ROCK_R * ROCK_BOB_AMP * Math.exp(-a / ROCK_BOB_EFOLD) * Math.cos((2 * Math.PI * a) / ROCK_BOB_T);
export const fadeAt = (a, life) => (life > 0 ? 1 - smooth01((a - (life - FADE_S)) / FADE_S) : 0);
export const frostRadius = (a) => FROST_R * (1 - (1 - Math.min(1, Math.max(0, a / FROST_CREEP_S))) ** 2);
export const poolRadius = (a) => POOL_R * Math.sqrt(Math.min(1, Math.max(0, a / POOL_GROW_S)));
export const poolFreeze = (a) => smooth01((a - POOL_GROW_S) / POOL_FREEZE_S);
export const quenchRadius = (a) => QUENCH_R * (1 - (1 - Math.min(1, Math.max(0, a / QUENCH_SPREAD_S))) ** 2);

export function impactBranch(phase, tau, tempK) {
  if (tau < LIQUID_TAU) {
    // amendment A: water flash-quenches the hot rock; an ember re-melts a pool in it (any crust, hard or soft)
    if (phase === 'fluid') return 'quench';
    if (phase === 'thermal') return 'crustpool';
    return phase === 'earth' && tau >= SOFT_TAU_MIN ? 'sink' : 'crater';
  }
  if (tempK < HG_MELT_K) return phase === 'fluid' ? 'frost' : phase === 'thermal' ? 'pool' : 'ring';
  if (phase === 'fluid') return tempK >= LEIDENFROST_K ? 'bead' : 'film';
  if (phase === 'thermal') return 'ember';
  if (phase === 'earth') return 'rock';
  return tempK > HG_BOIL_K ? 'strip' : 'jet';
}

const FLIGHT_R = { fluid: DROP_R, thermal: EMBER_R, earth: ROCK_R, air: GUST_W };

function blank() {
  return {
    live: false, state: 'free', phase: 'fluid', kind: '', seed: 0, t0: 0, tImpact: 0, tDetach: 0, fade: 1, fade0: 1,
    start: [0, 0, 0], end: [0, 0, 0], pos: [0, 0, 0], vel: [0, 0, 0], bow: [0, 0, 0],
    dirBody: [0, 0, 1], dirWorld: [0, 0, 1], tan: [0, 0, 0], r: 0, spin: 0, tempK: 0, rng: 1,
  };
}

export function createVisitors() {
  return { v: Array.from({ length: VISITOR_SLOTS }, blank), live: 0, seq: 0 };
}

export function createVisitorCtx() {
  return {
    tS: 0, dt: 0, calm: false, tau: 0, heatK: 0, subsolarT: 0, tempOverrideK: null, detach: false,
    q: [0, 0, 0, 1], omega: [0, 0, 0], cam: [0, 0, 1], nodePos: [0, 0, 0], coreR: R_SCENE,
  };
}

export function createVisitorOut() {
  return {
    nImpacts: 0,
    impacts: Array.from({ length: VISITOR_SLOTS }, () => ({ kind: '', impulse: '', phase: '', dirBody: [0, 0, 1], dirWorld: [0, 0, 1], seed: 0, tempK: 0 })),
    // persistent marks for the scar map (frost, glaze, pit), drained by MercuryPlanet every frame
    nStamps: 0,
    stamps: Array.from({ length: VISITOR_SLOTS }, () => ({ kind: '', dirBody: [0, 0, 1], radius: 0, seed: 0 })),
  };
}

// mulberry32 on the visitor's own state: a skate is reproducible per seed.
function rand(v) {
  v.rng = (v.rng + 0x6d2b79f5) >>> 0;
  let t = v.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const _t = [0, 0, 0];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function normInto(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; v[0] /= l; v[1] /= l; v[2] /= l; return v; }
// out = vec minus its component along unit d (in place safe)
function tangentInto(vec, d, out) {
  const k = dot3(vec, d);
  out[0] = vec[0] - d[0] * k; out[1] = vec[1] - d[1] * k; out[2] = vec[2] - d[2] * k;
  return out;
}

// A free slot first; else, once an element holds MAX_PER_ELEMENT, its oldest; else the oldest overall.
export function pickVisitorSlot(buf, phase) {
  let same = 0, oldestSame = -1, oldest = -1;
  for (let i = 0; i < VISITOR_SLOTS; i++) {
    const v = buf.v[i];
    if (!v.live) continue;
    if (oldest < 0 || v.t0 < buf.v[oldest].t0) oldest = i;
    if (v.phase === phase) {
      same++;
      if (oldestSame < 0 || v.t0 < buf.v[oldestSame].t0) oldestSame = i;
    }
  }
  if (same >= MAX_PER_ELEMENT) return oldestSame;
  for (let i = 0; i < VISITOR_SLOTS; i++) if (!buf.v[i].live) return i;
  return oldest;
}

// Pull a unit landing direction to within maxRad of the camera's sub-point, keeping its azimuth about that point (the
// tapped node's side). A limb landing is foreshortened to a sliver (cos 75° ≈ 0.26); inside the cone it faces the viewer.
export function aimToward(d, cam, maxRad) {
  const cl = Math.hypot(cam[0], cam[1], cam[2]) || 1;
  const c0 = cam[0] / cl, c1 = cam[1] / cl, c2 = cam[2] / cl;
  const k = d[0] * c0 + d[1] * c1 + d[2] * c2;
  if (k >= Math.cos(maxRad)) return d;
  const u0 = d[0] - c0 * k, u1 = d[1] - c1 * k, u2 = d[2] - c2 * k;
  const ul = Math.hypot(u0, u1, u2);
  if (ul < 1e-9) { d[0] = c0; d[1] = c1; d[2] = c2; return d; }
  const cm = Math.cos(maxRad), sm = Math.sin(maxRad) / ul;
  d[0] = c0 * cm + u0 * sm; d[1] = c1 * cm + u1 * sm; d[2] = c2 * cm + u2 * sm;
  return d;
}

// Fire on crust lands in sunlight (author ruling, amendment A look pass): the refrozen glaze is a mirror, so it only reads
// under key light. At least this far above the local horizon: cos⁻¹ 0.4 ≈ 66° from the sub-solar point, sun ≈ 24° up.
export const LIT_AIM_MIN_SUN_COS = 0.4;

// Slide an in-cone landing d along the great circle toward the cone's most sunward point p* to the first point with
// dot(d, sun) ≥ minSunCos (or to p* when even p* is darker). d and p* both lie in the cone (a cap < 90°), and so does the
// arc between them. Called once at launch, so the bisection is fine.
export function litAim(d, cam, sun, maxRad, minSunCos) {
  const sd = (x0, x1, x2) => x0 * sun[0] + x1 * sun[1] + x2 * sun[2];
  if (sd(d[0], d[1], d[2]) >= minSunCos) return d;
  const cl = Math.hypot(cam[0], cam[1], cam[2]) || 1;
  const c0 = cam[0] / cl, c1 = cam[1] / cl, c2 = cam[2] / cl;
  const cs = sd(c0, c1, c2);
  const u0 = sun[0] - c0 * cs, u1 = sun[1] - c1 * cs, u2 = sun[2] - c2 * cs;
  const ul = Math.hypot(u0, u1, u2);
  let p0 = c0, p1 = c1, p2 = c2;
  if (ul > 1e-9) {
    const r = Math.min(maxRad, Math.atan2(ul, cs)), k = Math.cos(r), s = Math.sin(r) / ul;
    p0 = c0 * k + u0 * s; p1 = c1 * k + u1 * s; p2 = c2 * k + u2 * s;
  }
  if (sd(p0, p1, p2) < minSunCos) { d[0] = p0; d[1] = p1; d[2] = p2; return d; }
  const a0 = d[0], a1 = d[1], a2 = d[2];
  const om = Math.acos(Math.max(-1, Math.min(1, a0 * p0 + a1 * p1 + a2 * p2)));
  const so = Math.sin(om);
  if (so < 1e-9) { d[0] = p0; d[1] = p1; d[2] = p2; return d; }
  let lo = 0, hi = 1;
  for (let i = 0; i < 30; i++) {
    const t = (lo + hi) / 2, wa = Math.sin((1 - t) * om) / so, wb = Math.sin(t * om) / so;
    if (sd(a0 * wa + p0 * wb, a1 * wa + p1 * wb, a2 * wa + p2 * wb) >= minSunCos) hi = t; else lo = t;
  }
  const wa = Math.sin((1 - hi) * om) / so, wb = Math.sin(hi * om) / so;
  d[0] = a0 * wa + p0 * wb; d[1] = a1 * wa + p1 * wb; d[2] = a2 * wa + p2 * wb;
  const l = Math.hypot(d[0], d[1], d[2]);
  d[0] /= l; d[1] /= l; d[2] /= l;
  return d;
}

// Where the fall lands (world): the strike point 40° off the launch node toward the viewer, pulled inside the aim cone
// (aimed once at launch: strikeDirWorld allocates), at the live core radius (it changes during a hyper-fling, so every frame).
function landing(v, ctx) {
  v.end[0] = v.dirWorld[0] * ctx.coreR; v.end[1] = v.dirWorld[1] * ctx.coreR; v.end[2] = v.dirWorld[2] * ctx.coreR;
}

export function launchVisitor(buf, phase, ctx) {
  if (!Object.hasOwn(T_FLIGHT, phase)) return null;
  const v = buf.v[pickVisitorSlot(buf, phase)];
  if (!v.live) buf.live++;
  buf.seq = (buf.seq + 1) | 0;
  v.live = true; v.state = 'flight'; v.phase = phase; v.kind = '';
  v.t0 = ctx.tS; v.tImpact = 0; v.tDetach = 0; v.fade = 1; v.fade0 = 1;
  v.seed = Math.imul(buf.seq, 2654435761) >>> 0 || 1;
  v.rng = v.seed;
  v.r = FLIGHT_R[phase]; v.spin = 0; v.tempK = phase === 'thermal' ? EMBER_T_LAUNCH_K : 0;
  for (let k = 0; k < 3; k++) { v.start[k] = ctx.nodePos[k]; v.pos[k] = ctx.nodePos[k]; v.vel[k] = 0; v.tan[k] = 0; }
  const cl = Math.hypot(ctx.cam[0], ctx.cam[1], ctx.cam[2]) || 1;
  for (let k = 0; k < 3; k++) v.bow[k] = (ctx.cam[k] / cl) * FLIGHT_BOW * R_SCENE;
  strikeDirWorld(v.start, ctx.cam, v.dirWorld);
  aimToward(v.dirWorld, ctx.cam, AIM_MAX_RAD);
  // author ruling: fire on crust lands in the sunlit part of the cone, so the glaze it leaves catches key light
  if (phase === 'thermal' && ctx.tau < LIQUID_TAU) litAim(v.dirWorld, ctx.cam, SUN_DIR_WORLD, AIM_MAX_RAD, LIT_AIM_MIN_SUN_COS);
  landing(v, ctx);
  return v;
}

// The fall: eased in s² (it accelerates into the planet) along the chord, bowed toward the camera by 4s(1−s).
// Parametric, so touchdown is exactly `end` at s = 1.
export function flightPoint(v, s, out) {
  const e = s * s, b = 4 * s * (1 - s);
  for (let k = 0; k < 3; k++) out[k] = v.start[k] + (v.end[k] - v.start[k]) * e + v.bow[k] * b;
  return out;
}

export function flightVelocity(v, s, T, out) {
  const de = 2 * s, db = 4 - 8 * s;
  for (let k = 0; k < 3; k++) out[k] = ((v.end[k] - v.start[k]) * de + v.bow[k] * db) / T;
  return out;
}

const residentLife = (v, ctx) => RESIDENT_LIFE_S[v.kind] * (ctx.calm ? CALM_LIFE : 1);

export const stampRadius = (kind) => (kind === 'frost' ? FROST_R : kind === 'quench' ? QUENCH_R : kind === 'pool' || kind === 'crustpool' ? POOL_R : PIT_R);

function emitStamp(v, out) {
  if (out.nStamps >= out.stamps.length) return;
  const s = out.stamps[out.nStamps++];
  s.kind = STAMP_FOR[v.kind]; s.radius = stampRadius(v.kind); s.seed = v.seed;
  s.dirBody[0] = v.dirBody[0]; s.dirBody[1] = v.dirBody[1]; s.dirBody[2] = v.dirBody[2];
}

function stepFlight(v, ctx, out) {
  const T = T_FLIGHT[v.phase];
  const s = ctx.calm ? 1 : Math.min(1, (ctx.tS - v.t0) / T);
  landing(v, ctx);
  flightPoint(v, s, v.pos);
  flightVelocity(v, s, T, v.vel);
  if (v.phase === 'thermal') v.tempK = emberFlightTempK(s);
  if (v.phase === 'earth' && !ctx.calm) v.spin += ROCK_SPIN0 * ctx.dt;
  if (s >= 1) touchdown(v, ctx, out);
}

function touchdown(v, ctx, out) {
  const tempK = ctx.tempOverrideK ?? localTempK(v.dirWorld, SUN_DIR_WORLD, ctx.subsolarT, ctx.heatK);
  const kind = impactBranch(v.phase, ctx.tau, tempK);
  qRotateInv(ctx.q, v.dirWorld, v.dirBody);
  if (out.nImpacts < out.impacts.length) {
    const ev = out.impacts[out.nImpacts++];
    ev.kind = kind; ev.impulse = IMPULSE_FOR[kind]; ev.phase = v.phase; ev.seed = v.seed; ev.tempK = tempK;
    for (let k = 0; k < 3; k++) { ev.dirBody[k] = v.dirBody[k]; ev.dirWorld[k] = v.dirWorld[k]; }
  }
  v.kind = kind;
  v.tImpact = ctx.tS;
  if (!(RESIDENT_LIFE_S[kind] > 0)) { v.state = 'free'; return; }
  // reduced motion: no creep, growth or sinking: the mark lands at full size now
  if (ctx.calm && STAMP_FOR[kind]) { emitStamp(v, out); v.state = 'free'; return; }
  v.state = 'resident';
  // the arrival's sideways motion, carried into the body frame: a bead skates on along it, a gust blows along it
  tangentInto(v.vel, v.dirWorld, _t);
  qRotateInv(ctx.q, _t, v.tan);
  const tl = Math.hypot(v.tan[0], v.tan[1], v.tan[2]);
  const want = kind === 'bead' ? (ctx.calm ? 0 : SKATE_V0) : kind === 'jet' || kind === 'strip' ? 1 : 0;
  for (let k = 0; k < 3; k++) v.tan[k] = tl > 1e-9 ? (v.tan[k] / tl) * want : 0;
  v.r = kind === 'bead' ? BEAD_R : kind === 'rock' || kind === 'sink' ? ROCK_R : kind === 'ember' || kind === 'pool' || kind === 'crustpool' ? EMBER_R : 0;
  stepResident(v, ctx, out);
}

export function residentHeight(v, a, life, calm) {
  if (v.kind === 'bead') return 0.95 * v.r + BEAD_GAP;
  if (v.kind === 'ember' || v.kind === 'pool' || v.kind === 'crustpool') return 0.4 * v.r;
  if (v.kind === 'rock') {
    const sink = 2 * ROCK_R * smooth01((a - (life - ROCK_SINK_S)) / ROCK_SINK_S);
    return ROCK_R * (1 - 2 * ROCK_SUBMERGED) + (calm ? 0 : rockBob(a)) - sink;
  }
  if (v.kind === 'sink') {
    // into the soft crust: from its floating line until the whole bound sphere is under
    const h0 = ROCK_R * (1 - 2 * ROCK_SUBMERGED);
    return h0 - (h0 + ROCK_BOUND * ROCK_R) * smooth01(a / life);
  }
  return 0;
}

// A Leidenfrost bead on its vapour: random kicks, damped, along the surface (body frame, so it rides the spin).
function skate(v, dt) {
  const d = v.dirBody, t = v.tan;
  for (let k = 0; k < 3; k++) t[k] += (2 * rand(v) - 1) * SKATE_KICK * dt;
  tangentInto(t, d, t);
  const damp = Math.exp(-SKATE_DAMP * dt);
  for (let k = 0; k < 3; k++) { t[k] *= damp; d[k] += t[k] * dt; }
  normInto(d);
  tangentInto(t, d, t);
}

function stepResident(v, ctx, out) {
  const a = ctx.tS - v.tImpact, life = residentLife(v, ctx);
  if (a >= life) { if (STAMP_FOR[v.kind]) emitStamp(v, out); v.state = 'free'; return; }
  // the stamping kinds keep full weight until the stamp replaces them (plan P-4)
  v.fade = STAMP_FOR[v.kind] ? 1 : fadeAt(a, life);
  if (v.kind === 'bead') {
    if (!ctx.calm) skate(v, ctx.dt);
    v.r = BEAD_R * (1 - (BEAD_SHRINK * a) / life);
  } else if ((v.kind === 'rock' || v.kind === 'sink') && !ctx.calm) {
    v.spin += ROCK_SPIN0 * Math.exp(-a / ROCK_SPIN_EFOLD) * ctx.dt;
  } else if (v.kind === 'ember' || v.kind === 'pool' || v.kind === 'crustpool') {
    v.tempK = hotTempK(a);
  }
  qRotate(ctx.q, v.dirBody, v.dirWorld);
  const h = ctx.coreR + residentHeight(v, a, life, ctx.calm);
  for (let k = 0; k < 3; k++) v.pos[k] = v.dirWorld[k] * h;
}

// A hard release: everything on the surface leaves with the surface's own velocity ω × r, and fades.
function detachVisitor(v, ctx) {
  const w = ctx.omega, p = v.pos;
  v.state = 'detached';
  v.tDetach = ctx.tS;
  v.fade0 = v.fade;
  v.vel[0] = w[1] * p[2] - w[2] * p[1];
  v.vel[1] = w[2] * p[0] - w[0] * p[2];
  v.vel[2] = w[0] * p[1] - w[1] * p[0];
}

function stepDetached(v, ctx) {
  const a = ctx.tS - v.tDetach;
  if (a >= DETACH_FADE_S) { v.state = 'free'; return; }
  for (let k = 0; k < 3; k++) v.pos[k] += v.vel[k] * ctx.dt;
  // film / hot spot / jet / strip stay in the liquid while they fade (visitorFrame hasSurface): their slot rides the spin
  if (v.kind === 'film' || v.kind === 'ember' || v.kind === 'jet' || v.kind === 'strip') qRotate(ctx.q, v.dirBody, v.dirWorld);
  v.fade = v.fade0 * (1 - a / DETACH_FADE_S);
}

export function stepVisitors(buf, ctx, out) {
  out.nImpacts = 0; out.nStamps = 0;
  if (buf.live === 0) return out;
  for (let i = 0; i < VISITOR_SLOTS; i++) {
    const v = buf.v[i];
    if (!v.live) continue;
    if (v.state === 'flight') stepFlight(v, ctx, out);
    else if (v.state === 'resident') {
      // frost, the pools, the quench rind and a sinking rock are in or under the surface: a fling leaves them (plan P-3)
      if (ctx.detach && !STAMP_FOR[v.kind]) detachVisitor(v, ctx);
      else stepResident(v, ctx, out);
    }
    if (v.state === 'detached') stepDetached(v, ctx);
    if (v.state === 'free') { v.live = false; buf.live--; }
  }
  return out;
}

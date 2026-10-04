// src/terminal/mercury/planet/visitorFrame.js — live visitors → the body pass's uniform arrays + its screen rect, and the
// planet shader's surface slots (visitors spec §5.2, §5.6). Allocates nothing; idle returns before any loop.

import { qRotate } from './breakupFamily';
import {
  VISITOR_SLOTS, VISIT_SURF_MAX, SURF_FILM, SURF_HOT, SURF_MENISCUS, SURF_JET, SURF_FROST, SURF_POOL, SURF_COLLAR, DROP_R,
  DROP_STRETCH_K, DROP_STRETCH_MAX, BEAD_OBLATE, EMBER_R, EMBER_BODY_S, EMBER_TAIL_S, EMBER_HALO, ROCK_R, ROCK_BOUND,
  GUST_TRAIL_S, GUST_W, MENISCUS_RING_DEPTH, JET_R, JET_DEPTH, COLLAR_H, PLUME_LEN, PLUME_LIFT, PLUME_W, PLUME_GROW_S,
  SURF_QUENCH, quenchSteamFade, quenchSteamRise, quenchSteamRadius, quenchRadius,
  filmRadius, filmThicknessNm, clearRadius, clearDepth, hotTempK, jetEnvelope, frostRadius, poolRadius, poolFreeze,
} from './visitorSim';

export const VIS_DROP = 1, VIS_BEAD = 2, VIS_EMBER = 3, VIS_ROCK = 4, VIS_GUST = 5, VIS_PLUME = 6;
export const PLUME_STEAM = 1;              // uVisK.w on a plume: water steam (the bead's look), not Hg vapour (plan Q-1)
export const VIS_PAD_PX = 4;
export const BEAD_BOUND = 3.5;             // × r: the steam above it

export function createVisitorFrame() {
  return {
    vis: new Float32Array(VISITOR_SLOTS * 4), ax: new Float32Array(VISITOR_SLOTS * 4), k: new Float32Array(VISITOR_SLOTS * 4), n: 0,
    rect: new Float32Array([-1, -1, 1, 1]), visible: false,
    surfDir: new Float32Array(VISIT_SURF_MAX * 4), surfA: new Float32Array(VISIT_SURF_MAX * 4), surfB: new Float32Array(VISIT_SURF_MAX * 4), nSurf: 0,
    order: new Int32Array(VISITOR_SLOTS), w: new Float32Array(VISITOR_SLOTS),
  };
}

const _r = { x0: 0, y0: 0, x1: 0, y1: 0, full: false };
const _a = [0, 0, 0], _c = [0, 0, 0], _g = [0, 0, 0];

// A sphere (centre, rad) into the rect, in NDC (breakupFrame's grow, the same rule).
function grow(view, x, y, z, rad) {
  const e = view.vp;
  const X = e[0] * x + e[4] * y + e[8] * z + e[12];
  const Y = e[1] * x + e[5] * y + e[9] * z + e[13];
  const W = e[3] * x + e[7] * y + e[11] * z + e[15];
  if (W <= rad) { _r.full = true; return; }
  const rx = (rad * view.p00) / W, ry = (rad * view.p11) / W;
  _r.x0 = Math.min(_r.x0, X / W - rx); _r.x1 = Math.max(_r.x1, X / W + rx);
  _r.y0 = Math.min(_r.y0, Y / W - ry); _r.y1 = Math.max(_r.y1, Y / W + ry);
}

function unitInto(v, out) {
  const l = Math.hypot(v[0], v[1], v[2]);
  if (l < 1e-9) { out[0] = 0; out[1] = 1; out[2] = 0; return 0; }
  out[0] = v[0] / l; out[1] = v[1] / l; out[2] = v[2] / l;
  return l;
}

// A rock's tumble axis, fixed per seed.
export function rockAxis(seed, out) {
  out[0] = Math.sin(seed * 0.001 + 1.3); out[1] = Math.cos(seed * 0.0007 + 0.4); out[2] = Math.sin(seed * 0.0013 + 2.1);
  unitInto(out, out);
  return out;
}

// A seed as a small float for the shader's hashes.
export const seedFrac = (seed) => (seed % 997) + 0.5;

// bc / brad: the body's bound sphere for the rect (an ember's or gust's sits mid-trail).
function pushBody(f, view, code, p, r, ax, axW, fade, z, bc, brad, tint = 0) {
  if (f.n >= VISITOR_SLOTS || !(fade > 0)) return;
  const i = f.n++;
  f.vis[4 * i] = p[0]; f.vis[4 * i + 1] = p[1]; f.vis[4 * i + 2] = p[2]; f.vis[4 * i + 3] = r;
  f.ax[4 * i] = ax[0]; f.ax[4 * i + 1] = ax[1]; f.ax[4 * i + 2] = ax[2]; f.ax[4 * i + 3] = axW;
  f.k[4 * i] = code; f.k[4 * i + 1] = fade; f.k[4 * i + 2] = z; f.k[4 * i + 3] = tint;
  grow(view, bc[0], bc[1], bc[2], brad);
}

// A trail from p back along unit d for len: its midpoint into _c, returns its bound radius.
function trailBound(p, d, len, pad) {
  _c[0] = p[0] + d[0] * len * 0.5; _c[1] = p[1] + d[1] * len * 0.5; _c[2] = p[2] + d[2] * len * 0.5;
  return len * 0.5 + pad;
}

function packFlight(f, view, v) {
  const speed = unitInto(v.vel, _a);
  if (v.phase === 'fluid') {
    const s = Math.min(DROP_STRETCH_MAX, speed * DROP_STRETCH_K);
    pushBody(f, view, VIS_DROP, v.pos, DROP_R, _a, s, v.fade, 0, v.pos, DROP_R * (1 + s) * 1.3);
  } else if (v.phase === 'thermal') {
    _a[0] = -_a[0]; _a[1] = -_a[1]; _a[2] = -_a[2];
    const len = speed * EMBER_TAIL_S;
    pushBody(f, view, VIS_EMBER, v.pos, EMBER_R, _a, len, v.fade, v.tempK, _c, trailBound(v.pos, _a, len, 2 * EMBER_HALO * EMBER_R));
  } else if (v.phase === 'earth') {
    pushBody(f, view, VIS_ROCK, v.pos, ROCK_R, rockAxis(v.seed, _g), v.spin, v.fade, seedFrac(v.seed), v.pos, 1.2 * ROCK_BOUND * ROCK_R);
  } else {
    _a[0] = -_a[0]; _a[1] = -_a[1]; _a[2] = -_a[2];
    const len = speed * GUST_TRAIL_S;
    pushBody(f, view, VIS_GUST, v.pos, GUST_W, _a, len, v.fade, seedFrac(v.seed), _c, trailBound(v.pos, _a, len, 4 * GUST_W + ROCK_R));
  }
}

function packSettled(f, view, v, a, ctx) {
  if (v.kind === 'bead') {
    pushBody(f, view, VIS_BEAD, v.pos, v.r, v.dirWorld, BEAD_OBLATE, v.fade, 0, v.pos, BEAD_BOUND * v.r);
  } else if ((v.kind === 'ember' || v.kind === 'pool' || v.kind === 'crustpool') && a < EMBER_BODY_S) {
    const body = 1 - Math.min(1, Math.max(0, (a - (EMBER_BODY_S - 0.5)) / 0.5));
    pushBody(f, view, VIS_EMBER, v.pos, EMBER_R, v.dirWorld, 0, v.fade * body, v.tempK, v.pos, 2 * EMBER_HALO * EMBER_R);
  } else if (v.kind === 'rock' || v.kind === 'sink') {
    pushBody(f, view, VIS_ROCK, v.pos, ROCK_R, rockAxis(v.seed, _g), v.spin, v.fade, seedFrac(v.seed), v.pos, 1.2 * ROCK_BOUND * ROCK_R);
  } else if (v.kind === 'strip') {
    // Hg vapour torn off the boiling surface: a streamer along the gust, lifting as it goes
    qRotate(ctx.q, v.tan, _a);
    _a[0] += v.dirWorld[0] * PLUME_LIFT; _a[1] += v.dirWorld[1] * PLUME_LIFT; _a[2] += v.dirWorld[2] * PLUME_LIFT;
    unitInto(_a, _a);
    const len = PLUME_LEN * Math.min(1, a / PLUME_GROW_S);
    pushBody(f, view, VIS_PLUME, v.pos, PLUME_W, _a, len, v.fade, seedFrac(v.seed), _c, trailBound(v.pos, _a, len, 3 * PLUME_W));
  } else if (v.kind === 'quench') {
    // water flash-boiling off the hot rock (amendment A, A10 author ruling): a round puff of steam lifted 0.6r off the
    // rind, rising and growing as it fades. Packed: r = its radius now, axW = its rise now (the shader centres the ball at
    // pos + up·(axW + 0.6r)); pushBody drops it once the fade reaches 0, so a spent puff costs nothing.
    const r = quenchSteamRadius(a), rise = quenchSteamRise(a);
    pushBody(f, view, VIS_PLUME, v.pos, r, v.dirWorld, rise, v.fade * quenchSteamFade(a), seedFrac(v.seed), _c,
      trailBound(v.pos, v.dirWorld, rise + 1.2 * r, 3 * r), PLUME_STEAM); // the rect holds the risen, grown ball (+3r)
  }
}

// Film, hot spot, gust, strip, frost, the pools and the quench rind stay in the surface while they fade (even when flung);
// a rock's meniscus and a sinking rock's collar leave with the rock.
const hasSurface = (v) => v.kind === 'film' || v.kind === 'ember' || v.kind === 'jet' || v.kind === 'strip' || v.kind === 'frost'
  || v.kind === 'pool' || v.kind === 'crustpool' || (v.kind === 'quench' && !v.stamped)  // A10: the stamp replaces the rind
  || ((v.kind === 'rock' || v.kind === 'sink') && v.state === 'resident');

function packSurface(f, j, v, ctx) {
  const a = ctx.tS - v.tImpact, o = 4 * j;
  const D = f.surfDir, A = f.surfA, B = f.surfB;
  D[o] = v.dirWorld[0]; D[o + 1] = v.dirWorld[1]; D[o + 2] = v.dirWorld[2];
  B[o] = 0; B[o + 1] = 0; B[o + 2] = 0; B[o + 3] = 0;
  A[o + 3] = v.fade;
  if (v.kind === 'film') {
    D[o + 3] = SURF_FILM; A[o] = filmRadius(a); A[o + 1] = filmThicknessNm(a); A[o + 2] = a;
  } else if (v.kind === 'ember') {
    D[o + 3] = SURF_HOT; A[o] = clearRadius(a); A[o + 1] = clearDepth(a); A[o + 2] = hotTempK(a);
  } else if (v.kind === 'rock') {
    D[o + 3] = SURF_MENISCUS; A[o] = ROCK_R / ctx.coreR; A[o + 1] = MENISCUS_RING_DEPTH; A[o + 2] = 0;
  } else if (v.kind === 'frost') {
    D[o + 3] = SURF_FROST; A[o] = frostRadius(a); A[o + 1] = 0; A[o + 2] = seedFrac(v.seed);
  } else if (v.kind === 'pool' || v.kind === 'crustpool') {
    D[o + 3] = SURF_POOL; A[o] = poolRadius(a); A[o + 1] = poolFreeze(a); A[o + 2] = hotTempK(a);
  } else if (v.kind === 'quench') {
    D[o + 3] = SURF_QUENCH; A[o] = quenchRadius(a); A[o + 1] = 0; A[o + 2] = seedFrac(v.seed);
  } else if (v.kind === 'sink') {
    D[o + 3] = SURF_COLLAR; A[o] = ROCK_R / ctx.coreR; A[o + 1] = COLLAR_H; A[o + 2] = 0;
  } else {
    // a gust, or a gust stripping boiling Hg: the same dent and cat's-paws
    D[o + 3] = SURF_JET; A[o] = JET_R; A[o + 1] = JET_DEPTH * jetEnvelope(a); A[o + 2] = a;
    qRotate(ctx.q, v.tan, _g);
    B[o] = _g[0]; B[o + 1] = _g[1]; B[o + 2] = _g[2];
  }
}

export function packVisitors(buf, ctx, view, f) {
  f.n = 0; f.nSurf = 0; f.visible = false;
  for (let j = 0; j < VISIT_SURF_MAX; j++) f.surfA[4 * j + 3] = 0;
  if (buf.live === 0) return f;
  _r.x0 = Infinity; _r.y0 = Infinity; _r.x1 = -Infinity; _r.y1 = -Infinity; _r.full = false;
  let nc = 0;
  for (let i = 0; i < VISITOR_SLOTS; i++) {
    const v = buf.v[i];
    if (!v.live) continue;
    if (v.state === 'flight') { packFlight(f, view, v); continue; }
    packSettled(f, view, v, ctx.tS - v.tImpact, ctx);
    if (hasSurface(v)) {
      // strongest first (stable insertion by fade): a tier whose shader draws fewer slots draws the ones that show
      let j = nc++;
      while (j > 0 && f.w[j - 1] < v.fade) { f.w[j] = f.w[j - 1]; f.order[j] = f.order[j - 1]; j--; }
      f.w[j] = v.fade; f.order[j] = i;
    }
  }
  f.nSurf = Math.min(nc, VISIT_SURF_MAX);
  for (let j = 0; j < f.nSurf; j++) packSurface(f, j, buf.v[f.order[j]], ctx);
  if (f.n === 0) return f;
  let { x0, y0, x1, y1 } = _r;
  if (_r.full) { x0 = -1; y0 = -1; x1 = 1; y1 = 1; }
  const px = (2 * VIS_PAD_PX) / view.wPx, py = (2 * VIS_PAD_PX) / view.hPx;
  x0 = Math.max(-1, x0 - px); y0 = Math.max(-1, y0 - py); x1 = Math.min(1, x1 + px); y1 = Math.min(1, y1 + py);
  if (!(x1 > x0 && y1 > y0)) return f;
  f.rect[0] = x0; f.rect[1] = y0; f.rect[2] = x1; f.rect[3] = y1;
  f.visible = true;
  return f;
}

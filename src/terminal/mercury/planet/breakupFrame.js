// src/terminal/mercury/planet/breakupFrame.js — a family → the droplet shader's uniform arrays + its screen rect
// (phase-5 spec §7.1–7.2). Allocation-free after createDropFrame.

import { R_SCENE } from './planetLook';
import { TONGUE_ROOT_R, pinchRadius, wobbleOmega, rpWavelength } from './breakupPhysics';
import { chainCount, qRotate } from './breakupFamily';

export const NECK_ASYM = 0.2;        // waist shifted toward the inner body: steep cone at the outer bead, shallow inward (spec §5.2)
export const FLIGHT_STRETCH = 0.12;  // prolate stretch of a main bead at A_REF
export const A_REF = 4;              // units/s²
export const STRETCH_MAX = 0.45;
export const DROP_PAD_PX = 4;
export const BOUND_BEAD = 2;         // a bead's bound, × r × (1 + |stretch|): its neck shoulders and fillets live inside

export const pxPerUnitAt = (dist, fovDeg, heightPx) => heightPx / (2 * dist * Math.tan((fovDeg * Math.PI) / 360));
export const pxAngleOf = (fovDeg, heightPx) => (2 * Math.tan((fovDeg * Math.PI) / 360)) / heightPx;

export function createDropFrame(caps) {
  return {
    caps,
    bead: new Float32Array(caps.bodies * 4), beadAxis: new Float32Array(caps.bodies * 4),
    neck: new Float32Array(caps.necks * 4), neckR: new Float32Array(caps.necks), bridge: new Float32Array(caps.bridges * 4),
    nb: 0, nn: 0, nk: 0, rect: new Float32Array([-1, -1, 1, 1]), visible: false, areaPx: 0, pxAngle: 1e-3,
    map: new Int32Array(caps.bodies + 8),
  };
}

const _c = [0, 0, 0], _u = [0, 0, 0], _ax = [0, 0, 0];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const unitInto = (v, out) => { const l = len(v) || 1; out[0] = v[0] / l; out[1] = v[1] / l; out[2] = v[2] / l; return out; };

function pushBead(f, c, r, ax, s) {
  if (f.nb >= f.caps.bodies) return -1;
  const i = f.nb++;
  f.bead[4 * i] = c[0]; f.bead[4 * i + 1] = c[1]; f.bead[4 * i + 2] = c[2]; f.bead[4 * i + 3] = r;
  f.beadAxis[4 * i] = ax[0]; f.beadAxis[4 * i + 1] = ax[1]; f.beadAxis[4 * i + 2] = ax[2];
  f.beadAxis[4 * i + 3] = Math.max(-STRETCH_MAX, Math.min(STRETCH_MAX, s));
  return i;
}

function pushNeck(f, ia, ib, h, asym, R) {
  if (f.nn >= f.caps.necks || ia < 0) return;
  const i = f.nn++;
  f.neck[4 * i] = ia; f.neck[4 * i + 1] = ib; f.neck[4 * i + 2] = h; f.neck[4 * i + 3] = asym;
  f.neckR[i] = R;
}

function pushBridge(f, ia, ib, k, R) {
  if (f.nk >= f.caps.bridges || ia < 0) return;
  const i = f.nk++;
  f.bridge[4 * i] = ia; f.bridge[4 * i + 1] = ib; f.bridge[4 * i + 2] = k; f.bridge[4 * i + 3] = R;
}

function packHold(fam, env, f) {
  // the same span fireFamily lays the chain on (max(L, lambda)), so hold -> fire does not jump the beads
  const N = chainCount(fam.L);
  const Ls = Math.max(fam.L, rpWavelength(TONGUE_ROOT_R));
  const sp = Ls / N;
  const ax = fam.axisBody;
  for (let si = 0; si < 2; si++) {
    const sign = 1 - 2 * si;
    const first = f.nb;
    for (let k = 0; k < N; k++) {
      const d = sign * (R_SCENE + Ls - (k + 0.5) * sp);
      _c[0] = ax[0] * d; _c[1] = ax[1] * d; _c[2] = ax[2] * d;
      qRotate(env.q, _c, _c);
      pushBead(f, _c, TONGUE_ROOT_R, unitInto(_c, _u), 0);
    }
    for (let k = 0; k + 1 < N; k++) pushNeck(f, first + k, first + k + 1, TONGUE_ROOT_R, 0, 0);
    const last = first + N - 1;
    _c[0] = f.bead[4 * last]; _c[1] = f.bead[4 * last + 1]; _c[2] = f.bead[4 * last + 2];
    pushNeck(f, last, -1, TONGUE_ROOT_R, 0, env.planetRadiusAt(unitInto(_c, _u)));
  }
}

function packFired(fam, env, f) {
  const B = fam.bodies;
  for (let i = 0; i < B.length; i++) {
    const b = B[i];
    f.map[i] = -1;
    if (b.state === 'gone' || b.r < 1e-6) continue;
    let s = 0;
    unitInto(b.p, _ax);
    if (b.state === 'free' || b.state === 'merging') {
      const wob = b.wobAmp * Math.cos(wobbleOmega(b.r) * b.wobT);
      const al = len(b.a);
      const fl = FLIGHT_STRETCH * (b.r / (fam.rMain || b.r)) ** 2 * Math.min(al / A_REF, 1);
      if (Math.abs(wob) >= fl) { _ax[0] = b.wobAxis[0]; _ax[1] = b.wobAxis[1]; _ax[2] = b.wobAxis[2]; s = wob; } else if (al > 0) { unitInto(b.a, _ax); s = fl; }
    }
    f.map[i] = pushBead(f, b.p, b.r, _ax, s);
  }
  for (let ni = 0; ni < fam.necks.length; ni++) {
    const n = fam.necks[ni];
    if (!n.on) continue;
    const ia = f.map[n.a];
    if (ia < 0) continue;
    const h = pinchRadius(TONGUE_ROOT_R, fam.t, n.tSnap);
    if (n.b >= 0) {
      const ib = f.map[n.b];
      if (ib >= 0) pushNeck(f, ia, ib, h, NECK_ASYM, 0);
    } else {
      pushNeck(f, ia, -1, h, NECK_ASYM, env.planetRadiusAt(unitInto(B[n.a].p, _u)));
    }
  }
  for (let i = 0; i < B.length; i++) {
    const b = B[i], ia = f.map[i];
    if (ia < 0) continue;
    if (b.state === 'merging' && b.lead && b.bridgeB > 0) pushBridge(f, ia, f.map[b.partner], b.bridgeB, 0);
    if (b.state === 'cascade') {
      const R = env.planetRadiusAt(unitInto(b.p, _u));
      if (b.bridgeB > 0) pushBridge(f, ia, -1, b.bridgeB, R);
      if (b.neckH > 0) pushNeck(f, ia, -1, b.neckH, 0, R);
    }
  }
}

const _r = { x0: 0, y0: 0, x1: 0, y1: 0, full: false };
function grow(e, view, cx, cy, cz, rad) {
  const X = e[0] * cx + e[4] * cy + e[8] * cz + e[12];
  const Y = e[1] * cx + e[5] * cy + e[9] * cz + e[13];
  const W = e[3] * cx + e[7] * cy + e[11] * cz + e[15];
  if (W <= 1e-4) { _r.full = true; return; }
  const rx = (rad * view.p00) / W, ry = (rad * view.p11) / W;
  _r.x0 = Math.min(_r.x0, X / W - rx); _r.x1 = Math.max(_r.x1, X / W + rx);
  _r.y0 = Math.min(_r.y0, Y / W - ry); _r.y1 = Math.max(_r.y1, Y / W + ry);
}

function fitRect(f, view) {
  _r.x0 = Infinity; _r.y0 = Infinity; _r.x1 = -Infinity; _r.y1 = -Infinity; _r.full = false;
  const e = view.vp;
  for (let i = 0; i < f.nb; i++) {
    grow(e, view, f.bead[4 * i], f.bead[4 * i + 1], f.bead[4 * i + 2], BOUND_BEAD * f.bead[4 * i + 3] * (1 + Math.abs(f.beadAxis[4 * i + 3])));
  }
  for (let i = 0; i < f.nn; i++) {
    const a = f.neck[4 * i], b = f.neck[4 * i + 1];
    const ax = f.bead[4 * a], ay = f.bead[4 * a + 1], az = f.bead[4 * a + 2];
    if (b >= 0) {
      grow(e, view, (ax + f.bead[4 * b]) / 2, (ay + f.bead[4 * b + 1]) / 2, (az + f.bead[4 * b + 2]) / 2,
        0.5 * Math.hypot(ax - f.bead[4 * b], ay - f.bead[4 * b + 1], az - f.bead[4 * b + 2]) + Math.max(f.bead[4 * a + 3], f.bead[4 * b + 3]));
    } else {
      const l = Math.hypot(ax, ay, az) || 1, R = f.neckR[i];
      grow(e, view, ax / l * R, ay / l * R, az / l * R, 2 * f.neck[4 * i + 2] + f.bead[4 * a + 3]);
    }
  }
  for (let i = 0; i < f.nk; i++) {
    if (f.bridge[4 * i + 1] >= 0) continue;
    const a = f.bridge[4 * i];
    const ax = f.bead[4 * a], ay = f.bead[4 * a + 1], az = f.bead[4 * a + 2];
    const l = Math.hypot(ax, ay, az) || 1, R = f.bridge[4 * i + 3];
    grow(e, view, ax / l * R, ay / l * R, az / l * R, BOUND_BEAD * f.bead[4 * a + 3] + f.bridge[4 * i + 2]);
  }
  let { x0, y0, x1, y1 } = _r;
  if (_r.full) { x0 = -1; y0 = -1; x1 = 1; y1 = 1; }
  const px = (2 * DROP_PAD_PX) / view.wPx, py = (2 * DROP_PAD_PX) / view.hPx;
  x0 = Math.max(-1, x0 - px); y0 = Math.max(-1, y0 - py); x1 = Math.min(1, x1 + px); y1 = Math.min(1, y1 + py);
  if (!(x1 > x0 && y1 > y0)) { f.visible = false; return; }
  f.rect[0] = x0; f.rect[1] = y0; f.rect[2] = x1; f.rect[3] = y1;
  f.areaPx = ((x1 - x0) / 2) * view.wPx * ((y1 - y0) / 2) * view.hPx;
  f.visible = true;
}

export function packFamily(fam, env, f, view) {
  f.nb = 0; f.nn = 0; f.nk = 0; f.visible = false; f.areaPx = 0;
  if (fam.phase === 'hold' && fam.L > 1e-4) packHold(fam, env, f);
  else if (fam.phase === 'fired') packFired(fam, env, f);
  if (f.nb > 0) fitRect(f, view);
  return f;
}

// src/terminal/mercury/planet/breakupFamily.js — when the bead breaks, and into what
// (phase-5 spec §4.1–4.3, §5.1–5.2; plan amendments P3, P4).
// Plain arrays, no three.js: breakupBudget.js replays a family headlessly. q = [x, y, z, w], body → world.

import { MAX_OMEGA, FREEZE_HEAT_K, HEAT_LEAK_PER_S } from './mercuryBody';
import { R_SCENE } from './planetLook';
import {
  TONGUE_ROOT_R, TONGUE_MAX_R, SAT_RATIO, rpWavelength, sphereVol, radiusOfVol, capillaryTime,
} from './breakupPhysics';

export const BREAK_TAU = 1;                 // only a fully liquid planet breaks
export const MAX_MAIN_PER_TONGUE = 4;
export const SNAP_JITTER = 0.15;            // ± this × TONGUE_LAG_S on each neck's snap time (additive: order holds)
export const TONGUE_LAG_S = capillaryTime(TONGUE_ROOT_R);
export const MERGE_MARGIN_S = 4;            // every body is home this long before refreeze starts
export const MIN_RETURN_S = 6;              // never fire with less return time than this (snaps + cascade)

export function refreezeIn(heatK) {
  return heatK > FREEZE_HEAT_K ? Math.log(heatK / FREEZE_HEAT_K) / HEAT_LEAK_PER_S : 0;
}

export function qRotate(q, v, out = [0, 0, 0]) {
  const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
  const vx = v[0], vy = v[1], vz = v[2];
  const tx = 2 * (qy * vz - qz * vy), ty = 2 * (qz * vx - qx * vz), tz = 2 * (qx * vy - qy * vx);
  out[0] = vx + qw * tx + (qy * tz - qz * ty);
  out[1] = vy + qw * ty + (qz * tx - qx * tz);
  out[2] = vz + qw * tz + (qx * ty - qy * tx);
  return out;
}

const _qc = [0, 0, 0, 1];
export function qRotateInv(q, v, out = [0, 0, 0]) {
  _qc[0] = -q[0]; _qc[1] = -q[1]; _qc[2] = -q[2]; _qc[3] = q[3];
  return qRotate(_qc, v, out);
}

export function hash01(seed, k) {
  let x = Math.imul(seed | 0, 374761393) + Math.imul(k | 0, 668265263);
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function breakExcess(omega, omegaTh) {
  if (!(omega > omegaTh)) return 0;
  return Math.min(1, (omega - omegaTh) / Math.max(MAX_OMEGA - omegaTh, 1e-6));
}

export function canHold({ dragging, tau, omega, omegaTh, calm, phase }) {
  return !!dragging && !calm && tau >= BREAK_TAU && omega > omegaTh && (phase === 'idle' || phase === 'hold');
}

export function canFire({ released, tau, omega, omegaTh, calm, phase, heatK }) {
  return !!released && !calm && tau >= BREAK_TAU && omega > omegaTh && phase === 'hold'
    && refreezeIn(heatK) - MERGE_MARGIN_S >= MIN_RETURN_S;
}

export function createFamily(seed = 1) {
  return {
    phase: 'idle', seed, axisBody: [1, 0, 0], L: 0, e: 0, N: 0, s: 0, rMain: 0, rSat: 0, sat: false,
    t: 0, acc: 0, mu: 0, bodies: [], necks: [], events: [], volOut: 0, volFamily: 0, volResidual: 0, nextId: 0,
  };
}

export function addBody(fam, props) {
  const b = {
    id: fam.nextId++, state: 'attached', tongue: 0, k: 0,
    posBody: [0, 0, 0], p: [0, 0, 0], v: [0, 0, 0], a: [0, 0, 0],
    r: TONGUE_ROOT_R, rMain: TONGUE_ROOT_R, vol: 0, tFree: 0,
    wobAxis: [1, 0, 0], wobAmp: 0, wobT: 0,
    partner: -1, lead: false, mergeT: 0, mergeC: [0, 0, 0], mergeOffA: [0, 0, 0], mergeOffB: [0, 0, 0], mergeRSmall: 0, mergeVrel: 0,
    dirBody: [0, 0, 1], stage: 0, stageT: 0, stageD: 1, rK: 0, volK: 0, rNext: 0, final: false, bridgeB: 0, neckH: 0,
    ...props,
  };
  fam.bodies.push(b);
  return b;
}

export function tongueAxis(spinBody, dragBody, out = [0, 0, 0]) {
  const sl = Math.hypot(spinBody[0], spinBody[1], spinBody[2]) || 1;
  const sx = spinBody[0] / sl, sy = spinBody[1] / sl, sz = spinBody[2] / sl;
  const project = (d) => {
    const k = d[0] * sx + d[1] * sy + d[2] * sz;
    return [d[0] - k * sx, d[1] - k * sy, d[2] - k * sz];
  };
  let p = project(dragBody ?? [1, 0, 0]);
  let l = Math.hypot(p[0], p[1], p[2]);
  if (l < 1e-3) {
    p = project(Math.abs(sx) < 0.9 ? [1, 0, 0] : [0, 1, 0]);
    l = Math.hypot(p[0], p[1], p[2]);
  }
  out[0] = p[0] / l; out[1] = p[1] / l; out[2] = p[2] / l;
  return out;
}

// Mains per tongue (the single source of the N formula; allocation-free for the per-frame hold packing).
export const chainCount = (L) => Math.min(MAX_MAIN_PER_TONGUE, Math.max(1, Math.round(L / rpWavelength(TONGUE_ROOT_R))));
// The span a chain is laid on: never shorter than one wavelength (hold and fire share it, so nothing jumps).
export const chainSpan = (L) => Math.max(L, rpWavelength(TONGUE_ROOT_R));
// The main bead a pinched span of thread rolls up into (volume of a r0 cylinder of length s).
export const mainRadius = (s) => Math.cbrt(0.75 * TONGUE_ROOT_R * TONGUE_ROOT_R * s);
const perTongue = (n, sat) => n + (sat ? n - 1 : 0) + 1; // mains + satellites + the root stub

// The tier caps (maxBodies, satellites) applied to a chain: satellites go first, then mains, until both
// tongues fit. Allocation-free: fireFamily and the per-frame hold packing (breakupFrame) both use these.
export const chainSatellites = (L, maxBodies, satellites) => !!satellites && 2 * perTongue(chainCount(L), true) <= maxBodies;
export function cappedChainN(L, maxBodies, satellites) {
  const sat = chainSatellites(L, maxBodies, satellites);
  let N = chainCount(L);
  while (2 * perTongue(N, sat) > maxBodies && N > 1) N -= 1;
  return N;
}

export function chainLayout(L) {
  const N = chainCount(L);
  const s = chainSpan(L) / N;
  const rMain = mainRadius(s);
  return { N, s, rMain, rSat: SAT_RATIO * rMain };
}

// The volume of one main bead at full excess: the strike / cohesion reference.
export const DROP_V_REF = sphereVol(chainLayout(TONGUE_MAX_R).rMain);

export function holdTongue(fam, dt, e, gain) {
  const target = e * gain * TONGUE_MAX_R;
  fam.L += (target - fam.L) * (1 - Math.exp(-dt / TONGUE_LAG_S));
  fam.e = e;
}

export function fireFamily(fam, { maxBodies = 12, satellites = true } = {}) {
  const L = chainSpan(fam.L);
  const sat = chainSatellites(L, maxBodies, satellites);
  const N = cappedChainN(L, maxBodies, satellites);
  const s = L / N;
  const rMain = mainRadius(s);
  const rSat = SAT_RATIO * rMain;
  const vMain = sphereVol(rMain), vSat = sphereVol(rSat);

  fam.bodies.length = 0; fam.necks.length = 0; fam.events.length = 0;
  Object.assign(fam, { L, N, s, rMain, rSat, sat, t: 0, acc: 0, volResidual: 0 });
  let vol = 0;
  for (const sign of [1, -1]) {
    const first = fam.bodies.length;
    for (let k = 0; k < N; k++) {
      const d = R_SCENE + L - (k + 0.5) * s;
      const v = k > 0 && !sat ? vMain + vSat : vMain; // no satellites: the inner bead keeps that neck's satellite
      const ax = fam.axisBody;
      addBody(fam, { tongue: sign, k, posBody: [sign * ax[0] * d, sign * ax[1] * d, sign * ax[2] * d], vol: v, rMain: radiusOfVol(v) });
      vol += v;
    }
    for (let k = 0; k < N; k++) {
      const jit = SNAP_JITTER * (2 * hash01(fam.seed, 2 * k + (sign > 0 ? 0 : 1)) - 1);
      const tSnap = TONGUE_LAG_S * (k + 1 + jit);
      const root = k === N - 1;
      fam.necks.push({ a: first + k, b: root ? -1 : first + k + 1, tSnap, on: true, sat: !root && sat ? rSat : 0, stub: root ? rSat : 0 });
      fam.bodies[first + k].tFree = tSnap;
      if (root || sat) vol += vSat;
    }
  }
  fam.volFamily = vol;
  fam.volOut = vol;
  fam.phase = 'fired';
  return fam;
}

export function nextSnapIn(fam) {
  let m = Infinity;
  for (const n of fam.necks) if (n.on) m = Math.min(m, n.tSnap - fam.t);
  return m;
}

// src/terminal/mercury/planet/mercuryBody.js — the planet as a body you can spin.
//
// Time-based rigid rotation (spec §5): a drag grips the body toward the
// pointer's angular velocity; released, free spin damps (both damping terms applied exactly, via exp) and a critically
// damped `recapture` spring (ramped in over RECAPTURE_RAMP_S) returns it to
// the ephemeris orientation. `recapture` is honest naming: real tidal
// relaxation takes millions of years; the 3:2 lock is what the ephemeris
// orientation IS. Dissipated rotation heats a store (H += κ·max(0, |ω| − ω₀)²·dt,
// leaks λH; below ω₀ a slow stroke adds nothing, so watching the wake never holds the liquid),
// and transmutation τ ∈ [0,1] follows melt/freeze thresholds with
// hysteresis; the store is capped (HEAT_CAP_K), so liquid lingers ≤ ~40 s after a spin.
// Fixed-size substeps (≤ MAX_SUBSTEP_S) make 60 Hz and 360 Hz agree.

import * as THREE from 'three';

export const MAX_SUBSTEP_S = 1 / 480;
export const GRIP_PER_S = 18;          // how hard a drag grips the body
export const SPIN_DAMP_PER_S = 0.35;   // free-spin damping after release
export const MAX_OMEGA = 12;           // rad/s
export const RECAPTURE_OMEGA = 0.8;    // rad/s natural frequency of the return
export const RECAPTURE_RAMP_S = 4;     // inertia first, then recapture
export const HEAT_OMEGA_FLOOR = 2.5;   // rad/s (~1000 px/s on a 1000 px canvas); spin below it does not heat
export const HEAT_GAIN = 0.93;         // K per (rad/s)² of spin above the floor, per s: at MAX_OMEGA it heats as fast as the floorless 0.58 did
                                       // a stroke holds the liquid only above ω₀ + √(FREEZE·λ/κ) ≈ 3.5 rad/s
export const HEAT_LEAK_PER_S = 0.035;
export const MELT_HEAT_K = 60;
export const FREEZE_HEAT_K = 25;
export const HEAT_CAP_K = 80;          // bounds the store: even a hard spin refreezes ~40 s after release,
                                       // and night (100 K floor + cap) stays below the 234 K melt
export const TRANSMUTE_S = 3;          // τ 0 → 1 duration

const Y_AXIS = new THREE.Vector3(0, 1, 0);

export function targetFromYaw(yaw, out = new THREE.Quaternion()) {
  return out.setFromAxisAngle(Y_AXIS, yaw);
}

export function createBody(q0) {
  return {
    q: q0.clone(),
    omega: new THREE.Vector3(),
    heatK: 0,
    tau: 0,
    liquid: false,
    sinceReleaseS: Infinity,
  };
}

const _qInv = new THREE.Quaternion();
const _err = new THREE.Quaternion();
const _dq = new THREE.Quaternion();
const _e = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _mid = new THREE.Vector3();

export function rotationError(q, target, out = new THREE.Vector3()) {
  _qInv.copy(q).invert();
  _err.copy(target).multiply(_qInv);
  if (_err.w < 0) _err.set(-_err.x, -_err.y, -_err.z, -_err.w);
  const s = Math.sqrt(Math.max(0, 1 - _err.w * _err.w));
  if (s < 1e-9) return out.set(2 * _err.x, 2 * _err.y, 2 * _err.z);
  const angle = 2 * Math.acos(Math.min(1, _err.w));
  return out.set((_err.x / s) * angle, (_err.y / s) * angle, (_err.z / s) * angle);
}

const smooth01 = (x) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

function substep(b, h, dragging, omegaPtr, target) {
  const w = b.omega;
  const wx0 = w.x, wy0 = w.y, wz0 = w.z;
  if (dragging) {
    b.sinceReleaseS = 0;
    const k = 1 - Math.exp(-GRIP_PER_S * h);
    w.set(w.x + (omegaPtr[0] - w.x) * k, w.y + (omegaPtr[1] - w.y) * k, w.z + (omegaPtr[2] - w.z) * k);
  } else {
    b.sinceReleaseS += h;
    w.multiplyScalar(Math.exp(-SPIN_DAMP_PER_S * h));
    const ramp = smooth01(b.sinceReleaseS / RECAPTURE_RAMP_S);
    if (ramp > 0) {
      const K = RECAPTURE_OMEGA * RECAPTURE_OMEGA * ramp;
      const C = 2 * RECAPTURE_OMEGA * Math.sqrt(ramp);
      rotationError(b.q, target, _e);
      w.multiplyScalar(Math.exp(-C * h));
      w.set(w.x + K * _e.x * h, w.y + K * _e.y * h, w.z + K * _e.z * h);
    }
  }
  const len = w.length();
  if (len > MAX_OMEGA) w.multiplyScalar(MAX_OMEGA / len);

  // Exact axis-angle step, world frame (premultiply): constant-ω rotation is step-size independent.
  // Rotate by the substep-mean ω, not the end value: exact mean of the grip
  // exponential while dragging, trapezoid otherwise.
  if (dragging && len <= MAX_OMEGA * (1 - 1e-12)) {
    const m = (1 - Math.exp(-GRIP_PER_S * h)) / (GRIP_PER_S * h);
    _mid.set(omegaPtr[0] + (wx0 - omegaPtr[0]) * m, omegaPtr[1] + (wy0 - omegaPtr[1]) * m, omegaPtr[2] + (wz0 - omegaPtr[2]) * m);
  } else {
    _mid.set((wx0 + w.x) / 2, (wy0 + w.y) / 2, (wz0 + w.z) / 2);
  }
  const mlen = _mid.length();
  if (mlen > 0) {
    _dq.setFromAxisAngle(_axis.copy(_mid).divideScalar(mlen), mlen * h);
    b.q.premultiply(_dq).normalize();
  }

  const over = Math.max(0, Math.min(len, MAX_OMEGA) - HEAT_OMEGA_FLOOR);
  b.heatK += (HEAT_GAIN * over * over - HEAT_LEAK_PER_S * b.heatK) * h;
  if (b.heatK > HEAT_CAP_K) b.heatK = HEAT_CAP_K;
  if (b.heatK >= MELT_HEAT_K) b.liquid = true;
  else if (b.heatK <= FREEZE_HEAT_K) b.liquid = false;
  const goal = b.liquid ? 1 : 0;
  const stepTau = h / TRANSMUTE_S;
  b.tau = goal > b.tau ? Math.min(goal, b.tau + stepTau) : Math.max(goal, b.tau - stepTau);
}

// Cools the store over real time the frame clamp dropped (a hidden tab, a slow GPU): heat is a scalar
// and cannot fling the body. The freeze threshold is applied; τ still eases on stepBody's clock.
export function coolBody(b, seconds) {
  if (!(seconds > 0) || !Number.isFinite(seconds)) return b;
  b.heatK *= Math.exp(-HEAT_LEAK_PER_S * seconds);
  if (b.heatK <= FREEZE_HEAT_K) b.liquid = false;
  return b;
}

export function stepBody(b, dtS, { dragging = false, omegaPtr = [0, 0, 0], target }) {
  if (!(dtS > 0) || !Number.isFinite(dtS)) return b;
  const n = Math.max(1, Math.ceil(dtS / MAX_SUBSTEP_S - 1e-9));
  const h = dtS / n;
  for (let i = 0; i < n; i++) substep(b, h, dragging, omegaPtr, target);
  return b;
}

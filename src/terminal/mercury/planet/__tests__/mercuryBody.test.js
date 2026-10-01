// src/terminal/mercury/planet/__tests__/mercuryBody.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createBody, stepBody, coolBody, targetFromYaw, rotationError,
  MELT_HEAT_K, FREEZE_HEAT_K, MAX_OMEGA, HEAT_CAP_K, HEAT_OMEGA_FLOOR, TRANSMUTE_S,
} from '../mercuryBody';
import { rotY } from '../planetFrame';

const angleBetween = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.dot(b))));

// Time-based scenario: a firm drag at ω = (0, 8, 0) for 10 s, then release.
function run(hz, seconds, dragS = 10, omegaPtr = [0, 8, 0]) {
  const target = targetFromYaw(0.3);
  const body = createBody(target);
  const dt = 1 / hz;
  const samples = [];
  const n = Math.round(seconds * hz);
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    stepBody(body, dt, { dragging: t < dragS, omegaPtr, target });
    samples.push({ t: t + dt, tau: body.tau, heatK: body.heatK, q: body.q.clone() });
  }
  return { body, samples, target };
}
const at = (samples, t) => samples.find((s) => s.t >= t - 1e-9);

describe('mercuryBody', () => {
  it('targetFromYaw is the same rotation as planetFrame.rotY', () => {
    const q = targetFromYaw(1.1);
    const v = new THREE.Vector3(0.3, -0.4, 0.866).applyQuaternion(q);
    const r = rotY([0.3, -0.4, 0.866], 1.1);
    expect(v.x).toBeCloseTo(r[0], 12); expect(v.y).toBeCloseTo(r[1], 12); expect(v.z).toBeCloseTo(r[2], 12);
  });

  it('rotationError is zero at the target and points along the short way', () => {
    const t = targetFromYaw(0.5);
    expect(rotationError(t, t).length()).toBeLessThan(1e-9);
    const e = rotationError(targetFromYaw(0.2), t);
    expect(e.y).toBeCloseTo(0.3, 9);
    expect(Math.abs(e.x) + Math.abs(e.z)).toBeLessThan(1e-9);
  });

  it('at rest on the present it stays there, cold and solid', () => {
    const target = targetFromYaw(-2);
    const body = createBody(target);
    for (let i = 0; i < 600; i++) stepBody(body, 1 / 60, { dragging: false, omegaPtr: [0, 0, 0], target });
    expect(angleBetween(body.q, target)).toBeLessThan(1e-9);
    expect(body.heatK).toBe(0);
    expect(body.tau).toBe(0);
  });

  it('dragging grips the pointer: ω converges to omegaPtr and the body turns', () => {
    const { body } = run(60, 2, 2);
    expect(body.omega.y).toBeGreaterThan(7.9);
    expect(Math.abs(body.omega.x) + Math.abs(body.omega.z)).toBeLessThan(1e-6);
  });

  it('never spins faster than MAX_OMEGA', () => {
    const { body } = run(60, 2, 2, [0, 100, 0]);
    expect(body.omega.length()).toBeLessThanOrEqual(MAX_OMEGA + 1e-9);
  });

  it('recapture: released, it settles back to the astronomical present', () => {
    const { body, target } = run(60, 40, 3);
    expect(angleBetween(body.q, target)).toBeLessThan(0.5 * Math.PI / 180);
    expect(body.omega.length()).toBeLessThan(1e-2);
  });

  it('spin heats it; past MELT it transmutes to τ = 1', () => {
    const { samples } = run(60, 14);
    expect(at(samples, 10).heatK).toBeGreaterThan(MELT_HEAT_K);
    expect(at(samples, 13).tau).toBeGreaterThan(0.99);
  });

  it('hysteresis: liquid lingers ≥ 25 s after release, frozen by 90 s', () => {
    const { samples } = run(60, 100);
    expect(at(samples, 35).tau).toBeGreaterThan(0.99);
    expect(at(samples, 100).tau).toBe(0);
    expect(at(samples, 100).heatK).toBeLessThan(FREEZE_HEAT_K);
  });

  it('even a hard spin refreezes ~40 s after release: heat is capped', () => {
    const releaseS = 20;
    const { samples } = run(60, 90, releaseS, [0, MAX_OMEGA, 0]);
    expect(Math.max(...samples.map((s) => s.heatK))).toBeLessThanOrEqual(HEAT_CAP_K + 1e-9);
    const thaw = samples.find((s) => s.t > releaseS && s.tau < 0.99);
    expect(thaw).toBeDefined();
    expect(thaw.t - releaseS).toBeGreaterThan(33);
    expect(thaw.t - releaseS).toBeLessThan(45);
    expect(at(samples, 90).tau).toBe(0);
  });

  // A slow stroke (watching the wake) must not hold the bead liquid. ω 3 ≈ 1200 px/s on a 1000 px canvas.
  const strokeFor = (seconds, w, body, target) => {
    for (let i = 0; i < seconds * 60; i++) stepBody(body, 1 / 60, { dragging: true, omegaPtr: [0, w, 0], target });
  };

  it('a slow stroke does not hold the liquid: it refreezes under the pointer', () => {
    const target = targetFromYaw(0);
    const body = createBody(target);
    Object.assign(body, { heatK: HEAT_CAP_K, liquid: true, tau: 1 });
    strokeFor(120, 3, body, target);
    expect(body.heatK).toBeLessThan(FREEZE_HEAT_K);
    expect(body.tau).toBe(0);
  });

  it('a slow stroke from cold never melts it', () => {
    const target = targetFromYaw(0);
    const body = createBody(target);
    strokeFor(120, 3.4, body, target);
    expect(body.tau).toBe(0);
  });

  it('spin below HEAT_OMEGA_FLOOR adds no heat at all', () => {
    const target = targetFromYaw(0);
    const body = createBody(target);
    strokeFor(10, HEAT_OMEGA_FLOOR * 0.95, body, target);
    expect(body.heatK).toBe(0);
  });

  it('coolBody: real time the frame clamp dropped still cools the store (hidden tab, low fps)', () => {
    const target = targetFromYaw(0);
    const body = createBody(target);
    Object.assign(body, { heatK: HEAT_CAP_K, liquid: true, tau: 1 });
    coolBody(body, 60);
    expect(body.heatK).toBeLessThan(FREEZE_HEAT_K);
    expect(body.liquid).toBe(false);
    // τ still eases on the body's own clock: the refreeze is seen, not skipped
    expect(body.tau).toBe(1);
    for (let i = 0; i < (TRANSMUTE_S + 0.1) * 60; i++) stepBody(body, 1 / 60, { target });
    expect(body.tau).toBe(0);
  });

  it('coolBody: a short gap keeps the hysteresis (stays liquid above FREEZE)', () => {
    const body = createBody(targetFromYaw(0));
    Object.assign(body, { heatK: HEAT_CAP_K, liquid: true, tau: 1 });
    coolBody(body, 5);
    expect(body.heatK).toBeGreaterThan(FREEZE_HEAT_K);
    expect(body.liquid).toBe(true);
  });

  it('coolBody ignores zero, negative and non-finite gaps', () => {
    const body = createBody(targetFromYaw(0));
    body.heatK = 50;
    for (const s of [0, -3, NaN, Infinity]) coolBody(body, s);
    expect(body.heatK).toBe(50);
  });

  it('60 Hz and 360 Hz give the same trajectory (time-based parity)', () => {
    const a = run(60, 40).samples, b = run(360, 40).samples;
    for (const t of [1, 5, 10, 12, 20, 40]) {
      const sa = at(a, t), sb = at(b, t);
      expect(angleBetween(sa.q, sb.q)).toBeLessThan(2e-3);
      expect(Math.abs(sa.heatK - sb.heatK)).toBeLessThan(0.01 * Math.max(1, sa.heatK));
      expect(Math.abs(sa.tau - sb.tau)).toBeLessThan(0.01);
    }
  });

  it('ignores non-positive dt', () => {
    const target = targetFromYaw(0);
    const body = createBody(target);
    stepBody(body, 0, { dragging: true, omegaPtr: [0, 5, 0], target });
    stepBody(body, -1, { dragging: true, omegaPtr: [0, 5, 0], target });
    expect(body.omega.length()).toBe(0);
  });

  it('drag about world X matches the analytic left-multiplied rotation', () => {
    const q0 = targetFromYaw(0.3);
    const body = createBody(q0);
    const target = targetFromYaw(0.3);
    for (let i = 0; i < 30; i++) stepBody(body, 1 / 60, { dragging: true, omegaPtr: [2, 0, 0], target });
    const t = 0.5;
    const angle = 2 * t - (2 / 18) * (1 - Math.exp(-18 * t));
    const X = new THREE.Vector3(1, 0, 0);
    const a = new THREE.Quaternion().setFromAxisAngle(X, angle);
    const left = a.clone().multiply(q0);
    const right = q0.clone().multiply(a);
    expect(angleBetween(body.q, left)).toBeLessThan(1e-6);
    expect(angleBetween(body.q, right)).toBeGreaterThan(1e-2);
  });

  it('recapture from a tilted, off-axis state settles on the target', () => {
    const target = targetFromYaw(0.3);
    const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 1, 0).normalize(), 1.2);
    const body = createBody(tilt.multiply(targetFromYaw(0.3)));
    body.omega.set(1, -0.5, 0.7);
    for (let i = 0; i < 40 * 60; i++) stepBody(body, 1 / 60, { dragging: false, omegaPtr: [0, 0, 0], target });
    expect(angleBetween(body.q, target)).toBeLessThan(0.5 * Math.PI / 180);
    expect(body.omega.length()).toBeLessThan(1e-2);
  });

  it('60 Hz and 360 Hz agree at MAX_OMEGA, sampled mid-trajectory', () => {
    const a = run(60, 14, 10, [0, 100, 0]).samples, b = run(360, 14, 10, [0, 100, 0]).samples;
    for (const t of [5, 10]) expect(angleBetween(at(a, t).q, at(b, t).q)).toBeLessThan(2e-3);
    // free spin: the explicit recapture impulse samples an error vector rotating at up to MAX_OMEGA, an O(ωh) phase difference between substep sizes; 5e-3 rad ≈ 0.3°, invisible.
    for (const t of [11, 13]) expect(angleBetween(at(a, t).q, at(b, t).q)).toBeLessThan(5e-3);
  });

  it('rotationError is a world-frame (premultiply) rotation', () => {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 1, 0).normalize(), 1.2).multiply(targetFromYaw(0.3));
    const target = targetFromYaw(-0.4);
    const e = rotationError(q, target);
    const r = new THREE.Quaternion().setFromAxisAngle(e.clone().normalize(), e.length()).multiply(q);
    expect(angleBetween(r, target)).toBeLessThan(1e-9);
  });

  it('ignores non-finite dt', () => {
    const target = targetFromYaw(0);
    const body = createBody(target);
    stepBody(body, Infinity, { dragging: true, omegaPtr: [0, 5, 0], target });
    stepBody(body, NaN, { dragging: true, omegaPtr: [0, 5, 0], target });
    expect(body.omega.length()).toBe(0);
    expect(Number.isFinite(body.q.w)).toBe(true);
  });
});

// src/terminal/mercury/planet/__tests__/mercuryBody.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createBody, stepBody, targetFromYaw, rotationError,
  MELT_HEAT_K, FREEZE_HEAT_K, MAX_OMEGA,
} from '../mercuryBody';
import { rotY } from '../planetFrame';

const angleBetween = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.dot(b))));

// Time-based scenario: drag at ω = (0, 4, 0) for 10 s, then release.
function run(hz, seconds, dragS = 10, omegaPtr = [0, 4, 0]) {
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
    expect(body.omega.y).toBeGreaterThan(3.9);
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
});

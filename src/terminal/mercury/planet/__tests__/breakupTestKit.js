// src/terminal/mercury/planet/__tests__/breakupTestKit.js — shared fixtures for the phase-5 sim tests (not a test file).
import { createFamily, fireFamily, addBody } from '../breakupFamily';
import { stepFamily, DROP_DT } from '../breakupStep';
import { TONGUE_MAX_R, sphereVol } from '../breakupPhysics';
import { R_SCENE } from '../planetLook';

export const testEnv = (over = {}) => ({
  q: [0, 0, 0, 1], omega: [0, 8, 0], gamma: 8, kappa: 0, vRef: 1e-4, pxPerUnit: 300,
  planetRadiusAt: () => R_SCENE, ...over,
});
export const firedFamily = (opts = { maxBodies: 16, satellites: true }) => {
  const f = createFamily(1);
  f.axisBody = [1, 0, 0]; f.L = TONGUE_MAX_R; f.e = 1;
  fireFamily(f, opts);
  f.mu = 0;
  return f;
};
export const runFor = (f, seconds, env) => {
  const n = Math.round(seconds / DROP_DT);
  for (let i = 0; i < n; i++) stepFamily(f, DROP_DT, env);
};
export const freeBody = (f, p, v, r = 0.03) => addBody(f, { state: 'free', p, v, r, rMain: r, vol: sphereVol(r) });
export const muRefAt = (omegaTh) => (omegaTh * R_SCENE) ** 2 * R_SCENE; // = breakupBudget.muRef (Task 6), inlined so Task 5 runs first

// src/terminal/mercury/planet/__tests__/hyperTestKit.js — shared phase-6a fixtures (not a test file).
import { createFamily, DROP_V_REF } from '../breakupFamily';
import { fireHyper } from '../hyperFling';

export const hyperEnv0 = (omega = [0, 12, 0], pxPerUnit = 300) => ({
  q: [0, 0, 0, 1], omega, gamma: 8, kappa: 0.1, vRef: DROP_V_REF, pxPerUnit, omegaTh: 7.5,
});
// reach 1.175: desktop landscape (0.85 · 3.6 · tan 21°); target 12 s: a mid-heat return
export const firedHyper = ({ N = 16, eH = 1, seed = 3, omega = [0, 12, 0], orbitS = 3, pxPerUnit = 300, reach = 1.175, target = 12 } = {}) =>
  fireHyper(createFamily(seed), { N, eH, seed, omega, pxPerUnit, orbitS, reach, target });
export const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

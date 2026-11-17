// aurora.js — the landing of a coupled cloud, as two shader uniforms. Pure.
//
// Over a storm's window (storm01 0..1) the aurora rises over the first 10 %,
// holds, and fades over the last 30 %, on smoothsteps so nothing steps.
// Brightness follows the storm's peak strength; the 630 nm red crown only
// appears for strong storms. When storms overlap, the brightest one shows,
// and every cloud in its storm is witnessed.

import { DST_STRONG_NT } from './solPhysics';

const RISE_END = 0.1;
const FADE_START = 0.7;
const RED_FROM_NT = 400;
const RED_FULL_NT = 1000;

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** 0 -> 1 over the rise, 1 through the hold, 1 -> 0 over the fade. */
export function envelope(storm01) {
  if (!Number.isFinite(storm01) || storm01 <= 0 || storm01 >= 1) return 0;
  return smoothstep(0, RISE_END, storm01) * (1 - smoothstep(FADE_START, 1, storm01));
}

const NONE = Object.freeze({ uAurora: 0, uAuroraRed: 0, witnessIds: Object.freeze([]) });

/** statuses: cloudStatus results with their cloud's `id`. */
export function auroraUniforms(statuses) {
  let best = 0;
  let bestNt = 0;
  const witnessIds = [];
  for (const s of statuses || []) {
    if (s.phase !== 'storm') continue;
    witnessIds.push(s.id);
    const nt = Math.abs(Number.isFinite(s.stormNt) ? s.stormNt : 0);
    const peak = 0.25 + 0.75 * Math.min(1, nt / Math.abs(DST_STRONG_NT));
    const v = peak * envelope(s.storm01);
    if (v > best) { best = v; bestNt = nt; }
  }
  if (witnessIds.length === 0) return { ...NONE, witnessIds: [] };
  return { uAurora: best, uAuroraRed: smoothstep(RED_FROM_NT, RED_FULL_NT, bestNt) * best, witnessIds };
}

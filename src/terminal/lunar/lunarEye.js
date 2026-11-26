// lunarEye.js — /LUNAR -> the masthead eye (eyeDrive SHAPE.moon). The eye becomes the moon:
//   scrub    while the tab is in virtual time (the slider, a phase glyph, a phase jump: all the
//            visitor's hand), the eye is masked to the scrubbed phase, live, waxing or waning
//   compile  'compile phase →' sweeps one lunation through the eye with organic easing:
//            - in virtual time: from the scrubbed phase once round (through new and full) and
//              back onto it, so the drive picks up exactly where the sweep lands
//            - in live time: the dark new moon gathers over the silver, waxes to full, wanes
//              to new and on to the compiled accord's own phase, holds it, and lets go
//   release  'return to now' or leaving the tab: the drive lapses and the eye eases back to
//            silver on its own (a shape channel only: no palette, so no back-spin)
// Live mode never drives the eye: the moon moving on its own is not the visitor's act.
// While it drives, the store holds glances and whispers off the eye (holdEyeQuiet).
// Reduced motion: no drive at all (the eye keeps its static fallbacks).

import { driveShape } from '../components/eyeDrive';
import { SHAPE } from '../components/observerEyeShader';
import { SYNODIC_PERIOD, PHASES } from './synodic';
import { holdEyeQuiet } from '../quintessence/observerStore';

export const SWEEP_S = 2.8;        // the lunation itself
export const HOLD_S = 0.9;         // live time: the compiled phase held
export const FADE_S = 0.7;         // live time: then let go
export const LUNAR_COMPILE_MS = Math.round((SWEEP_S + HOLD_S + FADE_S) * 1000);
const GATHER_S = 0.35;             // live time: the new moon gathers over the silver

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const sm = (e) => { const x = clamp01(e); return x * x * (3 - 2 * x); };
const smoother = (e) => { const x = clamp01(e); return x * x * x * (x * (6 * x - 15) + 10); };

// Synodic age (days) -> phase 0..1.
export const phaseOfAge = (age) => {
  const p = (Number.isFinite(age) ? age : 0) / SYNODIC_PERIOD;
  return p - Math.floor(p);
};
// A phase id ('waxing-gibbous') -> the middle of its arc, 0..1.
export function phaseOfId(id) {
  const ph = PHASES.find((p) => p.id === id);
  return ph ? phaseOfAge((ph.range[0] + ph.range[1]) / 2) : 0;
}

// One compile sweep at t seconds: { u (phase, may run past 1), k (mask weight), done }.
export function sweepAt(t, { u0, u1, locked, k0 = 0 }) {
  const u = u0 + (u1 - u0) * smoother(t / SWEEP_S);
  if (locked) return { u, k: 1, done: t >= SWEEP_S };
  const k = (k0 + (1 - k0) * sm(t / GATHER_S)) * (1 - sm((t - SWEEP_S - HOLD_S) / FADE_S));
  return { u, k, done: t >= SWEEP_S + HOLD_S + FADE_S };
}

const reducedMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- the drive loop (one per page) -------------------------------------------
// rAF with a timer watchdog (as ecocideEye): a surface that throttles rAF while still
// compositing must not let the hold lapse mid-sweep.
const WATCHDOG_MS = 120;
const st = { scrub: null, sweep: null, shown: { u: 0, k: 0 }, raf: 0, timer: 0, running: false };
const now = () => performance.now();

function frame() {
  st.raf = 0; st.timer = 0;
  if (!st.running) return;
  try {
    if (st.sweep) {
      const s = sweepAt((now() - st.sweep.t0) / 1000, st.sweep);
      st.shown = { u: s.u, k: s.k };
      driveShape(SHAPE.moon, s.k, s.u);
      if (s.done) st.sweep = null;
    } else if (st.scrub !== null) {
      st.shown = { u: st.scrub, k: 1 };
      driveShape(SHAPE.moon, 1, st.scrub);
    } else {
      st.running = false;                       // nothing to hold: the drive lapses to silver
      quiet(false);
      return;
    }
  } catch (_) { /* the eye is ancillary */ }
  st.raf = requestAnimationFrame(frame);
  st.timer = setTimeout(() => { cancelAnimationFrame(st.raf); frame(); }, WATCHDOG_MS);
}
// While the moon is driven no glance or whisper starts over it (observerStore.holdEyeQuiet).
function quiet(on) { try { holdEyeQuiet(on); } catch (_) { /* ancillary */ } }
function run() {
  if (st.running) return;
  st.running = true;
  quiet(true);
  frame();
}
function halt() {
  if (st.running) quiet(false);
  st.running = false;
  cancelAnimationFrame(st.raf); clearTimeout(st.timer);
  st.raf = 0; st.timer = 0;
}

// The tab's scrub: a synodic age in days (virtual time) or null (live). A new scrub position
// takes over from a sweep in flight: the eye never fights the visitor's hand.
export function setLunarScrub(age) {
  if (reducedMotion()) return;
  const next = age === null || age === undefined || !Number.isFinite(age) ? null : phaseOfAge(age);
  if (next === st.scrub) return;
  if (next !== null) st.sweep = null;
  st.scrub = next;
  if (next !== null || st.sweep) run();
}

// 'compile phase →' on an accord card (the visitor's click), with that accord's phase id.
export function compileLunarEye(phaseId) {
  if (reducedMotion()) return;
  const locked = st.scrub !== null;
  const from = st.sweep ? st.shown.u : null;     // a sweep in flight: carry on from where it is
  let u0, u1;
  if (locked) {
    u0 = from ?? st.scrub;
    u1 = Math.floor(u0) + st.scrub + 1;          // once round, back onto the scrubbed phase
    if (u1 - u0 < 0.75) u1 += 1;
  } else {
    u0 = from ?? 0;                              // the new moon gathers over the silver
    u1 = Math.floor(u0) + 1 + phaseOfId(phaseId); // new -> full -> new -> the compiled phase
  }
  st.sweep = { t0: now(), u0, u1, locked, k0: st.sweep ? st.shown.k : 0 };
  run();
}

// Tab exit: drop everything at once; the drive's own ease takes the eye back to silver.
export function stopLunarEye() {
  halt();
  st.scrub = null; st.sweep = null; st.shown = { u: 0, k: 0 };
}

export const _lunarEyeState = () => ({ scrub: st.scrub, sweep: st.sweep && { ...st.sweep }, running: st.running });

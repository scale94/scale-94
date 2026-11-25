// ecocideEye.js — /ECOCIDE -> the masthead eye (eyeDrive), locked to the GROWTH_MANDATE value.
// While the tab holds the lock, a frame loop drives the eye from wherever the slider is
// parked, dragged or not; the eye shows the biosphere state, not the gesture:
//   0 -> 2 %     calm: slow luminous emerald over a wide pupil, cooling to silver at 2 %
//   2 -> 5 %     subsurface pressure: arterial crimson in the fluid's ridges, the pupil
//                tightening, the swirl winding into a tense shear
//   5 -> 9.5 %   breach: dark-crimson ink-blooms burst inside the metal and are smeared by
//                the rotation; a strained pinprick pupil; the fluid churns on
// The PROTECTION_PROTOCOL levers frame the iris in a luminous rim: as bright as their mean pull,
// in their accents mixed by pull, and gone (fading) once growth passes the lever gate.
// Unlocking (tab exit, reset) lets every channel lapse: the eye eases back to silver on its
// own, quietly (palette quiet: no back-spin). The slider's release reaction is silent
// (eyeReactions 'ecocide.growth').

import { driveMood, drivePalette, driveSpin, driveShape, driveRim } from '../../components/eyeDrive';
import { SHAPE } from '../../components/observerEyeShader';
import { protocolRim, LEVER_GATE } from './protectionProtocol';

export const CALM_EDGE = 2;                             // % growth: calm below, pressure above
export const BREACH = 5;                                // % growth: the planetary boundary
const TOP = 9.5;                                        // % growth: full haemorrhage
const SAGE = [[80, 225, 140], [14, 110, 66], [185, 255, 210]];  // a living green, not a grey-green

const clamp01 = (x) => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));

// growth % (0..10) -> the target look: pressure, rupture, calm 0..1; mood -1..1; spin rad/s added to the swirl;
// pal 0..1, how far the emerald takes the eye off silver.
export function ecocideLook(growth) {
  const g = Number.isFinite(growth) ? growth : 0;
  const calm = g < CALM_EDGE ? clamp01(1 - g / CALM_EDGE) : 0;
  const pressure = clamp01((g - CALM_EDGE) / (BREACH - CALM_EDGE));
  // Past the boundary the first blooms burst at once (0.35), then spread toward full.
  const rupture = g > BREACH ? 0.35 + 0.65 * clamp01((g - BREACH) / (TOP - BREACH)) : 0;
  if (calm > 0) {
    return { pressure: 0, rupture: 0, calm, mood: -calm, spin: 0.15 + 0.45 * calm, pal: 0.95 * calm };
  }
  return { pressure, rupture, calm: 0, mood: Math.min(1, 0.4 * pressure + 0.6 * rupture), spin: 1.4 * pressure + 2.6 * rupture, pal: 0 };
}

// The look on screen eases toward its target (vessels of pressure build, haemorrhage bursts
// fast and settles slowly). Fresh for each lock.
const TAU = { pressure: 0.3, ruptureUp: 0.1, ruptureDown: 0.8, calm: 0.35, rim: 0.4, rimCol: 0.25 };
const shown = { pressure: 0, rupture: 0, calm: 0, rim: 0, rimCol: [0, 0, 0], at: -Infinity };
export function resetEcocideEye() {
  shown.pressure = shown.rupture = shown.calm = shown.rim = 0; shown.rimCol = [0, 0, 0]; shown.at = -Infinity;
}

// growth % and the levers ({ key: 0..1 }) -> the rim's target: the protocol's pull, unless gated.
export function ecocideRim(growth, levers) {
  const { w, col } = protocolRim(levers);
  return { w: Number.isFinite(growth) && growth >= LEVER_GATE ? 0 : w, col };
}

const ease = (cur, tgt, dt, tau) => cur + (tgt - cur) * (1 - Math.exp(-dt / tau));

// One frame at tMs (performance clock). Returns the look as shown.
export function driveEcocideEye(growth, levers, tMs = 0) {
  const tgt = ecocideLook(growth);
  const rim = ecocideRim(growth, levers);
  const first = shown.at === -Infinity;
  const dt = first ? 0 : Math.min(0.1, Math.max(0, tMs - shown.at) / 1000);
  shown.at = tMs;
  if (first) {
    shown.pressure = tgt.pressure; shown.rupture = tgt.rupture; shown.calm = tgt.calm; shown.rim = rim.w;
    if (rim.col) shown.rimCol = rim.col.slice();
  }
  shown.pressure = ease(shown.pressure, tgt.pressure, dt, TAU.pressure);
  shown.rupture = ease(shown.rupture, tgt.rupture, dt, tgt.rupture > shown.rupture ? TAU.ruptureUp : TAU.ruptureDown);
  shown.calm = ease(shown.calm, tgt.calm, dt, TAU.calm);
  shown.rim = ease(shown.rim, rim.w, dt, TAU.rim);
  if (rim.col) for (let i = 0; i < 3; i++) shown.rimCol[i] = ease(shown.rimCol[i], rim.col[i], dt, TAU.rimCol);

  driveShape(SHAPE.vessels, 1, shown.pressure, shown.rupture, shown.calm);
  driveMood(tgt.mood);
  driveSpin(tgt.spin);
  driveRim(shown.rim, shown.rimCol);
  if (tgt.pal > 0.001) {
    const breath = 0.06 * tgt.calm * Math.sin((tMs / 1000) * 1.9);   // the calm green breathes
    drivePalette(SAGE[0], SAGE[1], SAGE[2], { w: Math.min(1, tgt.pal + breath), quiet: true });
  }
  // Under pressure the eye stays mercury: the blood is in the metal, not a new palette.
  return { ...shown, rimCol: shown.rimCol.slice() };
}

const reducedMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Lock the eye to readGrowth() (growth %) and readLevers() ({ key: 0..1 }). Returns unlock(). rAF with a timer watchdog, like
// the eye's own loop: a surface that throttles rAF while still compositing would otherwise
// let the hold lapse. Under reduced motion the eye does not take the drive at all (its own
// fallback is the static colour hold on the slider's release), so there is nothing to run.
const WATCHDOG_MS = 120;   // well inside HOLD_MS
export function lockEcocideEye(readGrowth, readLevers = () => null) {
  if (reducedMotion()) return () => {};
  let alive = true, raf = 0, timer = 0;
  resetEcocideEye();
  const tick = () => {
    if (!alive) return;
    cancelAnimationFrame(raf); clearTimeout(timer);
    try {
      driveEcocideEye(readGrowth(), readLevers(), performance.now());
    } catch (_) { /* the eye is ancillary */ }
    raf = requestAnimationFrame(tick);
    timer = setTimeout(tick, WATCHDOG_MS);
  };
  tick();
  return () => { alive = false; cancelAnimationFrame(raf); clearTimeout(timer); resetEcocideEye(); };
}

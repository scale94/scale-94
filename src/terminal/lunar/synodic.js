// src/terminal/lunar/synodic.js — shared synodic domain.
// Moved out of LunarTab.jsx so the doctrine engine can reach it without
// importing the view. Pure data + pure functions, no React, no DOM:
// same discipline as spineStore / vertebrae.

export const SYNODIC_PERIOD = 29.53058770576;

// Phase ranges tuned to astronomical convention:
// New/Full are narrow (~1.5 day windows centered on the event),
// quarters and crescents/gibbous fill the remaining arc.
export const PHASES = [
  { id: 'new',              label: 'New Moon',          glyph: '🌑', range: [0, 1.11] },
  { id: 'waxing-crescent',  label: 'Waxing Crescent',   glyph: '🌒', range: [1.11, 6.38] },
  { id: 'first-quarter',    label: 'First Quarter',     glyph: '🌓', range: [6.38, 8.77] },
  { id: 'waxing-gibbous',   label: 'Waxing Gibbous',    glyph: '🌔', range: [8.77, 13.65] },
  { id: 'full',             label: 'Full Moon',         glyph: '🌕', range: [13.65, 15.88] },
  { id: 'waning-gibbous',   label: 'Waning Gibbous',    glyph: '🌖', range: [15.88, 20.76] },
  { id: 'last-quarter',     label: 'Last Quarter',      glyph: '🌗', range: [20.76, 23.15] },
  { id: 'waning-crescent',  label: 'Waning Crescent',   glyph: '🌘', range: [23.15, 29.53] },
];

export function getPhase(age) {
  return PHASES.find(p => age >= p.range[0] && age < p.range[1]) || PHASES[0];
}

export const ASPECT_TENSION = { Conjunct: 0, Sextile: -1, Trine: -2, Square: 1, Opposite: 2 };

// Four classes the doctrine corpus is keyed on. Unknown aspects read as fused
// (zero tension) rather than throwing — a malformed aspect must not deny a reading.
export function tensionClassOf(aspectName) {
  const t = ASPECT_TENSION[aspectName] ?? 0;
  if (t <= -1) return 'harmonic';
  if (t === 0)  return 'fused';
  if (t === 1)  return 'friction';
  return 'polarity';
}

// Corpus indexing. Distinct from the lens centers in doctrineLens.js: quadrants
// pick which *text* a kernel speaks, centers pick which *kernel* speaks.
export const ARC_QUADRANTS = ['DARK-WAXING', 'LIGHT-WAXING', 'LIGHT-WANING', 'DARK-WANING'];

export function quadrantOf(age) {
  const q = Math.floor((age / SYNODIC_PERIOD) * 4);
  return ARC_QUADRANTS[Math.min(Math.max(q, 0), 3)];
}

// Distance on the wheel, not on the number line: a kernel centered on the new
// moon must score identically just before and just after it.
export function wrappedDistance(a, b, period = SYNODIC_PERIOD) {
  const d = Math.abs(((a - b) % period + period) % period);
  return Math.min(d, period - d);
}

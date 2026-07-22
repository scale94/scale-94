// src/terminal/lunar/doctrineLens.js — which kernel is speaking (spec §5.1).
// Five lenses seated around the synodic wheel. The moon selects; the sky
// modulates. Affinity is continuous rather than bucketed so dragging the
// time-scrub recompiles the doctrine smoothly instead of stepping.
import { wrappedDistance, SYNODIC_PERIOD } from './synodic';

// Falloff width in days. Not a taste knob: it is bounded above by the tightest
// centre separation on the wheel — hudelschublade (0.0) to rossignol (26.5),
// 3.031 days wrapped. For "the moon selects, the sky only modulates" to hold,
// a competitor at that separation plus BOTH maximum bonuses (transit 30 +
// spine 15) must still stay under the 100 an on-centre lens scores.
// At 2.5 that competitor holds 47.96, so 47.96 + 45 = 92.96 < 100 — the
// guarantee is structural, with ~7 points of margin. At 4.2 it held 77.1 and
// an on-centre lens could be overtaken.
export const SIGMA = 2.5;

export const LENSES = [
  {
    id: 'hudelschublade',
    kernel: 'HUDELSCHUBLADE-ROUTING-KERNEL 1.0.0',
    center: 0.0,                                   // new → waxing crescent
    planets: { Mercury: 1.0, Saturn: 0.8, Pluto: 0.5 },
    element: 'FIRE',                               // the chaos house
  },
  {
    id: 'blackhole',
    kernel: 'BLACK-HOLE-TAXONOMY-KERNEL 1.0.0',
    center: 9.5,                                   // first quarter → waxing gibbous
    planets: { Pluto: 1.0, Saturn: 0.7, Neptune: 0.6 },
    element: 'EARTH',                              // bare metal
  },
  {
    id: 'semiotic',
    kernel: 'SEMIOTIC-SYNTHESIS-KERNEL 9.9.9',
    center: 16.5,                                  // full → waning gibbous
    planets: { Mercury: 1.0, Mars: 0.7, Uranus: 0.7 },
    element: 'AIR',                                // transmission
  },
  {
    id: 'fishscale',
    kernel: 'FISH-SCALE-KERNEL 11.1.1',
    center: 22.0,                                  // last quarter — dryness 96
    planets: { Neptune: 0.9, Venus: 0.7, Pluto: 0.6 },
    element: 'WATER',                              // wetness is vitality
  },
  {
    id: 'rossignol',
    kernel: 'ROSSIGNOL-RUISENOR-NIGHTINGALE-ANDALIB-KERNEL 5.5.5.5',
    center: 26.5,                                  // waning crescent → return to new
    planets: { Jupiter: 0.9, Venus: 0.8, Sun: 0.6 },
    element: null,                                 // takes no element: it is the fifth
  },
];

// Which lens owns each phase outright. Used only by the spine bonus, which
// rewards a compiled phase that agrees with the sky rather than re-deriving
// ownership from the affinity curve.
export const PHASE_OWNER = {
  'new':             'hudelschublade',
  'waxing-crescent': 'hudelschublade',
  'first-quarter':   'blackhole',
  'waxing-gibbous':  'blackhole',
  'full':            'semiotic',
  'waning-gibbous':  'semiotic',
  'last-quarter':    'fishscale',
  'waning-crescent': 'rossignol',
};

export function phaseAffinity(center, age) {
  const d = wrappedDistance(age, center);
  return 100 * Math.exp(-(d * d) / (2 * SIGMA * SIGMA));
}

// Secondary term (spec §5.2), ceiling 30. Scaled by how tight the aspect is:
// an 8 degree orb is the widest this tab ever reports, so it pays nothing.
export function transitBonus(lens, dominant) {
  if (!dominant) return 0;
  const tightness = Math.min(Math.max(1 - dominant.orb / 8, 0), 1);
  const w1 = lens.planets[dominant.p1] ?? 0;
  const w2 = lens.planets[dominant.p2] ?? 0;
  return Math.min(30, 30 * tightness * ((w1 + w2) / 2));
}

// There is no null path. Lunar age IS the Sun-Moon elongation, so when the
// ephemeris is unavailable or nothing is within orb, the moon itself supplies
// the aspect: conjunct at new, opposite at full, square at the quarters.
// Astronomically exact, and a reading always exists.
const LUNAR_EXACT = [
  { at: 0,                     name: 'Conjunct' },
  { at: SYNODIC_PERIOD * 0.25, name: 'Square' },
  { at: SYNODIC_PERIOD * 0.5,  name: 'Opposite' },
  { at: SYNODIC_PERIOD * 0.75, name: 'Square' },
  { at: SYNODIC_PERIOD,        name: 'Conjunct' },   // closes the wheel
];

// Tertiary term (spec §5.3), ceiling 15. Reads the quintessence spine, so a
// visitor who has compiled vertebrae gets a reading tilted by their own choices.
export function spineBonus(lens, spine, currentAccord, phaseId) {
  if (!spine) return 0;
  let b = 0;
  if (lens.element && spine.element === lens.element) b += 8;
  if (spine.phase && spine.phase === currentAccord && PHASE_OWNER[phaseId] === lens.id) b += 4;
  const closed = !!(spine.trend && spine.council && spine.phase && spine.element);
  // The ring rewards the ring. 11 and not less: rossignol takes no element, so
  // it can never earn the +8, and 11 + 4 is the only route to the documented
  // cap of 15 — reachable by rossignol alone, with a closed spine, on the phase
  // it owns. Every other lens tops out at 8 + 4 = 12.
  if (closed && lens.id === 'rossignol') b += 11;
  return Math.min(b, 15);
}

// Full score for all five, highest first. Array.prototype.sort is stable, so
// an exact tie resolves to LENSES order — the documented tie-break.
export function scoreLenses({ age, phaseId, currentAccord, dominant, spine }) {
  return LENSES
    .map(lens => {
      const affinity = phaseAffinity(lens.center, age);
      const transit  = transitBonus(lens, dominant);
      const sp       = spineBonus(lens, spine, currentAccord, phaseId);
      return {
        id: lens.id, kernel: lens.kernel,
        affinity, transit, spine: sp,
        total: affinity + transit + sp,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export function synthesizeLunarAspect(age) {
  // Normalize onto the wheel before scanning: this function is fed by both a
  // WASM phase kernel and a UI slider, and an out-of-range age would otherwise
  // resolve to a confidently wrong aspect rather than an obviously wrong one.
  const a = ((age % SYNODIC_PERIOD) + SYNODIC_PERIOD) % SYNODIC_PERIOD;
  let best = LUNAR_EXACT[0];
  let bestD = Infinity;
  for (const p of LUNAR_EXACT) {
    const d = Math.abs(a - p.at);
    if (d < bestD) { bestD = d; best = p; }
  }
  // days from exact → degrees of elongation (360 per synodic period), capped
  // at the tab's own widest reported orb.
  const orb = Math.min(8, (bestD / SYNODIC_PERIOD) * 360);
  return {
    p1: 'Sun', p2: 'Moon', aspect: best.name,
    orb: Number(orb.toFixed(1)), synthetic: true,
  };
}

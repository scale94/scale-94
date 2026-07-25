// src/terminal/components/retrogradeCurve.js
// The double-sunrise excursion of Mercury's terminator during the retrograde
// event. Pure: t01 in [0,1] over the event → the terminator's signed offset
// from its true resting position, plus a violet "impossible" cue that peaks
// mid-event. A sine envelope pins both ends to zero so the event begins and
// ends exactly on the true terminator (position stays meaning).
export const RETROGRADE_MS = 5200;

export function retrogradeCurve(t01) {
  const t = Math.max(0, Math.min(1, t01));
  const env = Math.sin(Math.PI * t); // 0 → 1 → 0, pins the endpoints
  // Near t=0 the -0.62 term dominates (the +0.15 term is an order of magnitude
  // smaller and rising far more slowly), so the terminator recedes immediately
  // — the sun reverses course with no initial forward advance — then swings
  // back up past rest for the second sunrise, before the envelope settles
  // both terms back to zero at t=1.
  const walk =
    0.15 * Math.sin(Math.PI * t) -        // slow bow, shapes the swing-back past rest
    0.62 * Math.sin(2 * Math.PI * t) -    // dominant near t=0: the immediate recede/advance
    0.10 * Math.sin(4 * Math.PI * t);     // the double-sunrise ripple
  return { delta: env * walk, tint: env };
}

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
  const walk =
    0.15 * Math.sin(Math.PI * t) -        // a brief forward nudge (dawn continues)
    0.62 * Math.sin(2 * Math.PI * t) -    // the primary reversal swing (recede/advance)
    0.10 * Math.sin(4 * Math.PI * t);     // the double-sunrise ripple
  return { delta: env * walk, tint: env };
}

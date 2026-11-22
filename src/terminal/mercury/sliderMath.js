// src/terminal/mercury/sliderMath.js — the parameter sliders' value rule (MercuryControls): clamp to [min, max], snap to
// step from min, rounded so float noise never reads as a new value (a phone drag sends one change per snapped step).
export function snapSlider(v, min, max, step) {
  const c = Math.min(max, Math.max(min, v));
  const n = Math.round((c - min) / step);
  const s = Math.min(max, min + n * step);
  return Math.round(s * 1e9) / 1e9;
}

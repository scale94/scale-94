// src/terminal/mercury/planet/stageFit.js — the camera distance that keeps the element ring in frame.
//
// The handles are fixed-size HTML (MercurySphere: 92 px desktop / 104 px mobile, ×1.38 on press, plus glow),
// so the ring needs a margin in CSS PIXELS, not scene units. three's fov is vertical: the vertical half-extent
// sees tan(fov/2) per unit distance, the horizontal one tan(fov/2)·aspect. For a half-extent of h px the ring
// (radius ringR at z = 0) projects to ringR / (d·t) · h px; requiring that plus the margin to fit in h gives
// d = ringR · h / ((h − margin) · t). The shorter side wins; the camera never comes closer than minDist.

export const HANDLE_MARGIN_PX = Object.freeze({ desktop: 70, mobile: 78 });
export const MIN_AVAIL_FRAC = 0.25; // a canvas smaller than its margin still fits the ring in its central quarter

function distFor(ringR, halfPx, marginPx, t) {
  const avail = Math.max(halfPx - marginPx, halfPx * MIN_AVAIL_FRAC);
  return (ringR * halfPx) / (avail * t);
}

export function fitCameraDistance({ halfWidthPx, halfHeightPx, ringR, marginPx, fovDeg, minDist }) {
  if (!(halfWidthPx > 0) || !(halfHeightPx > 0)) return minDist;
  const t = Math.tan((fovDeg * Math.PI) / 360);
  const aspect = halfWidthPx / halfHeightPx;
  const dV = distFor(ringR, halfHeightPx, marginPx, t);
  const dH = distFor(ringR, halfWidthPx, marginPx, t * aspect);
  return Math.max(minDist, dV, dH);
}

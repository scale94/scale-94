// src/terminal/mercury/planet/mercuryMeniscus.js — the bead rim at the melt front.
//
// The crust is silicate rock and Hg does not wet it: the contact angle,
// measured through the liquid, is ~140°. Past 90° the liquid edge bulges, so
// seen from above its outermost visible tangent is vertical (the 40° undercut
// hides beneath it) and the rim rounds over onto the flat pool. The profile
// is a quarter circle of width w: at arc distance d inside the contact line,
// u = d / w and the surface tilts outward (toward the crust) by φ with
//   sin φ = sin(min(θc, 90°)) · (1 − u),   0 ≤ u < 1.
// The shader's meniscusSin() mirrors this; d comes from the front field as
// s / |∇s| (a distance estimate), and the front edge itself becomes a hard
// pixel-wide step wherever the element is liquid.

export const MENISCUS_CONTACT_DEG = 140;
export const MENISCUS_MIN_PX = 1.5;   // the rim never drawn narrower than this: it would alias
export const MENISCUS_GRAD_FLOOR = 0.05; // |∇s| floor (front units per radian) for the distance estimate

export const MENISCUS_MAX_SIN = Math.sin(Math.min(MENISCUS_CONTACT_DEG, 90) * Math.PI / 180);

export const meniscusWidth = (wRad, pxArc) => Math.max(wRad, MENISCUS_MIN_PX * pxArc);

export function meniscusSin(d, w, gain) {
  if (!(d >= 0) || !(w > 0)) return 0;
  const u = d / w;
  return u >= 1 ? 0 : Math.min(Math.max(gain, 0), 1) * MENISCUS_MAX_SIN * (1 - u);
}

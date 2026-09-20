// artParticleDraw.js — the particle layer's draw laws.
//
// Extracted so they can be pinned by a test and shared by the 2-D loop and the
// GL writer without a second copy drifting from the first. That drift is not
// hypothetical on this branch: step 4 lost a whole task to two implementations
// of one dash pattern.
//
// Every number here is the canvas's, INCLUDING the two quantisations it performs
// by accident. `hsla()` is built from a string, so `hue|0` truncates the hue and
// saturation to integers and `toFixed(3)` rounds every alpha to three decimals.
// A GL port that passes full floats is MORE precise than the thing it is
// copying, which is a parity failure in the direction nobody thinks to check —
// it makes the new layer look better rather than broken, so no gate flags it and
// no reviewer squints at it.

export const ALPHA_SCALE = 0.55;
export const FADE_IN_END = 0.15;
export const FADE_OUT_START = 0.70;
export const FADE_OUT_POWER = 2.2;
export const ALPHA_CULL = 0.004;
export const SIZE_FLOOR = 0.4;
export const GLOW_MULT = 3.5;
export const DEPTH_CULL = -0.6;
export const CORE_LIGHTNESS = 92;
export const CORE_ALPHA_SCALE = 0.8;

// The glow's radial gradient, exactly as `createRadialGradient` declares it.
// Note the knee is at 0.4, NOT the midpoint, and that the lightness falls as the
// alpha does — this is a colour ramp, not an alpha ramp. The node halo migrated
// in step 5 was single-colour, which is why ramping coverage reproduced it and
// why the same trick will not work here.
export const GLOW_STOPS = Object.freeze([
  Object.freeze({ at: 0, lightness: 82, alphaScale: 1 }),
  Object.freeze({ at: 0.4, lightness: 65, alphaScale: 0.5 }),
  Object.freeze({ at: 1, lightness: 50, alphaScale: 0 }),
]);

/** Life fade: quadratic ease-in over the first 15%, flat, then a 2.2-power
 *  ease-out over the last 30%, all scaled by 0.55. */
export function particleAlpha(lifeT) {
  let a;
  if (lifeT < FADE_IN_END) {
    const u = lifeT / FADE_IN_END;
    a = u * u;
  } else if (lifeT > FADE_OUT_START) {
    a = Math.pow(1 - (lifeT - FADE_OUT_START) / (1 - FADE_OUT_START), FADE_OUT_POWER);
  } else {
    a = 1.0;
  }
  return a * ALPHA_SCALE;
}

/** The 2-D loop's `if (alpha < 0.004) continue`. Kept as a named law because it
 *  decides the layer's INSTANCE COUNT, and an off-by-one-particle difference
 *  between the two implementations is invisible to every pixel gate here. */
export const particleVisible = (alpha) => alpha >= ALPHA_CULL;

/** `Math.max(0.4, size * scale)` — the floor keeps a far particle from
 *  collapsing to nothing, and it is load-bearing for parity because a
 *  sub-pixel disc still deposits ink. */
export const particleSize = (size, scale) => Math.max(SIZE_FLOOR, size * scale);

export const particleGlowRadius = (sz) => sz * GLOW_MULT;

/** `pp.depth < -0.6` — cull the deep back face. */
export const particleInFront = (depth) => depth >= DEPTH_CULL;

/** What `hue|0` and `sat|0` do inside the template string. */
export const quantHue = (h) => h | 0;

/** What `.toFixed(3)` does to every alpha on its way into `hsla()`. */
export const quantAlpha = (a) => Number(a.toFixed(3));

// The outer stop's EXTRAPOLATION factor, derived from the three lightnesses
// rather than written down, so it cannot drift from them.
//
// A disc instance has room for two colours and this ramp has three. It does not
// need a third, because for fixed hue and saturation the CSS HSL-to-RGB map is
// linear in lightness on each side of l = 0.5 and all three stops sit above it,
// so the outer colour lies on the line through the other two:
//
//     outer = mid + (mid - c0) * k,   k = (l_mid - l_outer) / (l_c0 - l_mid)
//
// which for 82/65/50 is 15/17. See DISC_OFF.outerK in SphereEdges.js, where the
// shader reads it.
export const GLOW_OUTER_K =
  (GLOW_STOPS[1].lightness - GLOW_STOPS[2].lightness)
  / (GLOW_STOPS[0].lightness - GLOW_STOPS[1].lightness);

// INK CORRECTION FOR A SUB-PIXEL DISC, and why particles are the first layer on
// this branch that needs one.
//
// EDGE_FRAG covers a disc with a box filter on radial distance:
//
//     clamp((R - d) / pxD + 0.5, 0, 1)
//
// which is the coverage of a STRAIGHT edge through the rim. That is right when
// R is large against a pixel and wrong when it is not, because a convex
// boundary covers less than the tangent line through the same point. Integrated
// over the plane at pxD = 1 it deposits
//
//     pi * (R^2 + 1/12)
//
// (exact for R >= 1/2, and within 0.2% below it) against a true area of pi*R^2.
// So the filter over-inks a disc by 1/12 of a pixel^2 REGARDLESS of size —
// negligible at the 8-25px of a node core or halo, and 52% at R = 0.4.
//
// MEASURED: migrating the particles raised whole-frame ink 1.6-2.7% in normal
// mode, against 0.1-0.3% for every other step-6 change against the same
// reference. Particle cores are max(0.4, size * scale), i.e. 0.4-3px — the
// first sub-pixel discs this renderer has drawn.
//
// This scales the ALPHA so the total ink matches. It does not fix the coverage
// SHAPE: the disc stays a fraction of a pixel softer at the rim than the canvas
// drew it, which for a one-pixel glowing dot is not visible and is not what
// artInk measures. The real fix is an area-accurate coverage term in the shader,
// which would also be exact for the shape and would touch every disc; that is
// recorded for a later step rather than smuggled into this one.
//
// NOT applied to the glow disc. Its ink is not pi*R^2*alpha — the ramp puts
// alpha at ~0 exactly where the over-coverage happens, at the rim — so the flat
// correction would wrongly dim it.
export const BOX_FILTER_EXCESS_PX2 = 1 / 12;

export function discInkCorrection(radius) {
  const r2 = radius * radius;
  return r2 / (r2 + BOX_FILTER_EXCESS_PX2);
}

// ── Velocity-stretched streaks ──────────────────────────────────────────────
//
// A particle's soft glow was a disc with a three-stop RADIAL ramp. It is now a
// SEGMENT from where the particle was last frame to where it is now, stretched
// along that displacement — which is what the mesh's segment branch already
// draws, with a width, a head-to-tail gradient and a gaussian shoulder. No
// shader, no new float, and the instance count per particle stays at two.
//
// ONE FIDELITY LOSS, recorded rather than hidden: the disc's ramp DARKENED as
// it faded (lightness 82 -> 65 -> 50, knee at 0.4 — see GLOW_STOPS and
// GLOW_OUTER_K). A segment's gradient runs along its LENGTH, not radially, so
// the shoulder is single-colour. Small on a spark, real, and not recoverable
// without a radial term a segment does not have.

/** How far the one-frame displacement is exaggerated. A frame's real
 *  displacement is sub-pixel at any sane speed, so an un-stretched streak is a
 *  dot; this is the knob that turns motion into a needle. Tuned by eye. */
export const STREAK_STRETCH = 5;

/** Below this stretched length in px the caller must draw the DISC instead.
 *  See `streakTail`'s note — a zero-length segment is not a disc. */
export const STREAK_MIN_PX = 0.75;

/**
 * The tail end of a particle's streak, in screen px, and whether it is long
 * enough to draw as one.
 *
 * `degenerate` is not defensive. `isDisc()` keys on the width SIGN, so a
 * segment written with `a == b` takes the SEGMENT path: `len` is 0, `dir`
 * falls back to (1,0), `t` is 0, and the cap term
 * `clamp(vAlong/pxA + 0.5) * clamp((vLen - vAlong)/pxA + 0.5)` evaluates to
 * 0.25 at the centre. The result is a faint quarter-alpha blob exactly where a
 * spark should be — a stalled particle rendering as a dimmer, wrongly-shaped
 * dot, which reads as a bug in the ecology rather than in the encoding.
 */
export function streakTail(headX, headY, prevX, prevY) {
  const dx = (headX - prevX) * STREAK_STRETCH;
  const dy = (headY - prevY) * STREAK_STRETCH;
  return {
    x: headX - dx,
    y: headY - dy,
    degenerate: Math.hypot(dx, dy) < STREAK_MIN_PX,
  };
}

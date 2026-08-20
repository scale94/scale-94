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

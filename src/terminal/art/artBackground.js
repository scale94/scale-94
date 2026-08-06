// artBackground.js — the parameters behind the sphere's background layers.
//
// Step 3 moves the bottom six layers of the sphere onto the GPU. These
// numbers were inline in ArtTab's draw loop; they are lifted here verbatim so
// that the shader and the 2D code it replaces provably read one source of
// truth, and so the decay curves are testable without a canvas.
//
// Nothing here is re-derived. Where a source comment disagreed with the
// arithmetic next to it, the arithmetic won and the discrepancy is recorded.

// ── State flash grid ────────────────────────────────────────────────────────
// Brief anthracite hex grid on bifurcation events.
export const FLASH_DECAY = 0.92;   // per frame
export const FLASH_ALPHA = 0.08;   // stroke alpha at full flash
export const FLASH_CUTOFF = 0.005; // below this the layer is skipped entirely
export const FLASH_GRID_STEP = 28; // px between hex centres

// NOTE: the draw loop labelled 0.92 "exponential decay ~200ms". It is not.
// 0.92^n <= 0.005 needs 64 frames = ~1067ms at 60fps. The comment was wrong,
// not the constant; the flash has always been a one-second fade.
export const FLASH_DURATION_FRAMES = 64;

/** One frame of flash decay. Snaps below the cutoff to exactly 0 so callers
 *  can test `> 0` and skip the whole layer rather than drawing invisible
 *  strokes forever. */
export function stepFlash(v) {
  const next = v * FLASH_DECAY;
  return next < FLASH_CUTOFF ? 0 : next;
}

// ── Clear tint ──────────────────────────────────────────────────────────────
// The ecocide bus bleeds crimson into the void as the metabolic rift rises.
export const RIFT_MAX_RED = 28;      // max added red channel, at rift 1
export const RIFT_THRESHOLD = 0.05;  // below this the clear is pure black
export const RIFT_ALPHA_IMMERSIVE = 0.32;
export const RIFT_ALPHA_NORMAL = 0.72;

/** The clear colour, as the 2D fillStyle computed it.
 *
 *  The red channel is ROUNDED, matching the original `Math.round`. Feeding a
 *  shader the unrounded value differs by under half a level — invisible to
 *  the pixel comparator, and therefore exactly the kind of drift this module
 *  exists to prevent.
 *
 *  The 0.05 threshold makes the two branches discontinuous: at rift 0.04 the
 *  rounded red would be 1, but the black branch draws 0. That one-level step
 *  is preserved rather than smoothed, because smoothing it is a change to the
 *  art made under cover of a refactor. */
export function riftTint(metabolicRift, immersive) {
  const a = immersive ? RIFT_ALPHA_IMMERSIVE : RIFT_ALPHA_NORMAL;
  const r = metabolicRift > RIFT_THRESHOLD
    ? Math.round(metabolicRift * RIFT_MAX_RED)
    : 0;
  return { r, g: 0, b: 0, a };
}

// ── Ambient beat pulse ──────────────────────────────────────────────────────
export const BEAT_DECAY = 0.88;       // per frame
export const BEAT_CUTOFF = 0.005;
export const BEAT_CORE_ALPHA = 0.14;  // amber core, rgb(251,191,36)
export const BEAT_MID_ALPHA = 0.07;   // orange mid stop at 0.6, rgb(251,140,0)
export const BEAT_CORE_RGB = [251, 191, 36];  // amber core
export const BEAT_MID_RGB = [251, 140, 0];    // orange mid
export const BEAT_MID_STOP = 0.6;             // gradient stop position of the mid colour
export const BEAT_INNER_R = 0.55;     // × sphereR — gradient inner radius
export const BEAT_BASE_R = 1.05;      // × sphereR — outer radius at rest
export const BEAT_SWELL_R = 0.18;     // × sphereR — extra outer radius at full beat

// Same class of error as the flash: the loop said "~300ms to silence" beside
// `*= 0.88`, which actually takes 42 frames = ~700ms.
export const BEAT_DURATION_FRAMES = 42;

/** Amber core alpha for a given beat phase (1 = just fired). */
export function beatPulseAlpha(beatPhase) {
  return beatPhase * BEAT_CORE_ALPHA;
}

/** Outer radius of the pulse gradient, in px, for a given sphere radius. */
export function beatPulseRadius(sphereR, beatPhase) {
  return sphereR * (BEAT_BASE_R + beatPhase * BEAT_SWELL_R);
}

// ── Temporal ghost trails ───────────────────────────────────────────────────
// Last session's node positions, drawn as faint blue-grey dots.
export const GHOST_COUNT = 31;        // hard cap in the draw loop
export const GHOST_CULL_Z = -0.3;     // rotated-z back-face cull
export const GHOST_ALPHA = 0.07;      // × depth
export const GHOST_RADIUS = 3;        // px, × projection scale
export const GHOST_RGB = [180, 180, 220];

/** Ghost alpha from rotated depth. NOT from age — the plan specified
 *  `ghostTrailAlpha(ageMs)` and there is no age term anywhere in the layer.
 *  Front-of-sphere ghosts are brighter; that is the whole effect.
 *
 *  The clamp matters more in GL than it did in 2D: between GHOST_CULL_Z and 0
 *  the 2D code drew fully transparent dots, so dropping the clamp in a shader
 *  would paint a band of negative-alpha ghosts across the back face. */
export function ghostTrailAlpha(rz) {
  return Math.max(0, rz) * GHOST_ALPHA;
}

// ── Spectral ambient (immersive only) ───────────────────────────────────────
export const AMBIENT_INNER_R = 0.3;   // × sphereR
export const AMBIENT_OUTER_R = 1.6;   // × sphereR
export const AMBIENT_GAIN = 0.10;     // × min(1, ambient alpha)
export const AMBIENT_FALLBACK_A = 0.08;
export const AMBIENT_RGB = [38, 38, 42];

/** Spectral ambient intensity from the ambient colour's alpha channel. */
export function ambientIntensity(ambientAlpha) {
  return Math.min(1, ambientAlpha ?? AMBIENT_FALLBACK_A) * AMBIENT_GAIN;
}

// ── Sphere wireframe ghost ──────────────────────────────────────────────────
// Equator + vertical great circle, as spatial anchors.
export const WIRE_ALPHA = 0.03;
export const WIRE_WIDTH = 0.5;

/** The two wireframe ellipse radii, in px, from the current rotation.
 *  Both collapse to a line when their axis faces the camera — `Math.abs` is
 *  load-bearing, without it the ellipse radius goes negative past 90°. */
export function wireframeRadii(sphereR, rx, ry) {
  return {
    equator: { rx: sphereR, ry: sphereR * Math.abs(Math.cos(rx)) },
    vertical: { rx: sphereR * Math.abs(Math.cos(ry)), ry: sphereR },
  };
}

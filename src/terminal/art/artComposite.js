// artComposite.js — numbers and layer contract for the GL bloom composite.
//
// Kept free of three.js imports so it can be unit-tested: ArtTab itself cannot
// be mounted in jsdom, so anything testable has to live outside it.

// The 2D canvas caps its backing store at 1.5x (ArtTab's ResizeObserver). The
// GL canvas must use the same number or the fullscreen quad resamples the 2D
// output instead of presenting it texel-for-texel.
export const DPR_CAP = 1.5;

export function compositeDpr(devicePixelRatio) {
  const dpr = Number(devicePixelRatio);
  if (!Number.isFinite(dpr) || dpr <= 0) return 1;
  return Math.min(dpr, DPR_CAP);
}

// Has the GL drawing buffer landed on the size the 2-D canvas is asking for?
//
// SizeSync heals a renderer that measured its container during first layout and
// stayed at 14x6, so it retries until the buffer agrees. What it retries
// AGAINST has to be a number three.js can actually produce.
// `WebGLRenderer.setSize` writes
//
//     canvas.width = Math.floor( width * pixelRatio )
//
// and this asked for `Math.round(clientWidth * ratio)` instead. Wherever that
// product lands on a half pixel the two differ by one FOR EVER and the retry
// never stops: MEASURED at window 1521 @1.5 and 1522 @1.25, about twenty
// page-wide `resize` events a second for as long as the tab is open, each one
// re-measuring and re-sizing the renderer, the camera and every render target
// the EffectComposer owns. At DPR 1.5 that is every ODD window width, and the
// normal and immersive widths are different numbers, so the toggle itself can
// flip a page into it.
//
// The match stays EXACT. A tolerance was tried first and is wrong: accepting a
// buffer one device pixel short stops the retry early, and that buffer is then
// stretched over the full CSS box, so the composite resamples the 2-D canvas
// instead of presenting it texel-for-texel — the very thing DPR_CAP exists to
// prevent. It is not invisible. MEASURED with a one-pixel slop, three runs of
// `artPresence` against two at HEAD: every prism sub-layer lost ~5% of its ink
// (chord 217.1 -> 207.3, polygon 184.1 -> 175.5, spoke 193.1 -> 185.1) and the
// star spoke's margin fell through its threshold, 25.0 -> 15.6 against 19.5.
// Asking for `floor` rather than `round` fixes the unreachable target without
// spending a single pixel of the contract.
export function glBufferSettled(bufW, bufH, cssW, cssH, ratio) {
  return bufW === Math.floor(cssW * ratio) && bufH === Math.floor(cssH * ratio);
}

// Stacking order inside the sphere container. The GL overlay covers the 2D
// canvas; the DOM labels must stay above it, so labels do not feed the bloom.
export const LAYER_Z = {
  canvas2d: 0,
  composite: 1,
  labels: 2,
  tooltip: 20,
};

// pointerEvents:'none' is load-bearing, not cosmetic — see artComposite.test.js.
//
// Anchored top-left and sized in pixels rather than `inset: 0`, because the
// sphere container is taller than the 2D canvas (it also holds the label
// overlay). r3f measures THIS element to size its renderer, so if it covered the
// whole container the GL buffer would be taller than the texture it presents and
// the composite would be vertically misaligned. SizeSync writes the exact pixel
// size each frame; these are the values before the first measurement.
export const COMPOSITE_STYLE = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  zIndex: LAYER_Z.composite,
  pointerEvents: 'none',
};

// Bright-extract bloom, always on. Threshold sits above the sphere's dim
// structural lines (edges, wireframe ghost) so only nodes, particles and fire
// cascades bloom — the old fake bloom blurred everything at 0.15 alpha, which
// is exactly why it read as a smear rather than as light.
// `levels` is the depth of the mipmap pyramid, and it decides how FAR the bloom
// reaches rather than how hard it hits. `MipmapBlurPass.setSize` halves at every
// level, so at the immersive buffer of 1920x984 eight levels run
//
//   960x492  480x246  240x123  120x62  60x31  30x16  15x8  8x4
//
// and the last two are a whole-screen average. A single bright node has far too
// little energy to show up there — MEASURED on the pinned sweep, the halo around
// one node dies at ~110 px — but the coarse levels integrate the WHOLE frame, so
// their contribution scales with total lit AREA. That is why a bundle of long
// wires can raise a milky floor across the canvas when three nodes cannot.
//
// 8 is `BloomEffect`'s own default, which is what this prop was getting
// implicitly before it was named here.
//
// 5 IS MEASURED, AGAINST A BLOOM-OFF CONTROL. `scripts/_a3bloom.mjs --fired`
// pinned one world across seven frames -- 1920x984, 103/102 edges, ry 3.617125,
// six independent boots agreeing to the last digit -- and `scripts/_a4halo.mjs`
// read the halo out of them:
//
//                          bloom off    levels 8    levels 5
//     far field 96-200 px     x1.000      x1.074      x1.006
//     p90 of the artwork     0.02745     0.03109     0.02745
//
// The pyramid's contribution to the far field is +7.4% at 8 and +0.6% at 5, and
// p90 returns EXACTLY to its bloom-off value: five levels removes essentially
// all of the wash the deep mips were painting across the black, and none of the
// near glow. The instrument carries its own null -- two runs of the same build
// agree to four decimals in the far field against an effect of up to 22% -- so
// this is signal, not a run-to-run difference.
//
// WHAT IT DOES NOT DO, said here because the next reader will assume otherwise:
// it does not dim the wire. It redistributes INWARD -- +5% at 8-16 px, +11% at
// 16-24, +22% at 24-48 -- and clipped pixels go slightly UP, 1429 -> 1442. The
// blown-out core is a separate problem with a separate lever: 869 of those
// pixels clip with the bloom entirely OFF, which is ink saturating in the RGBA8
// trail accumulator before this pass runs, and that belongs to the immersive
// trail gain (artTrail.js, RIFT_ALPHA 0.72 normal against 0.32 immersive) rather
// than to anything in this file.
//
// ── `intensity` 1.1 -> 0.6, chosen ON the frames at five levels ────────────
//
// Cutting the pyramid to five turned this into a CLEAN, ISOLATED control, which
// it was not before. MEASURED across 1.1/1.0/0.8/0.6/0.4 at five levels, same
// pinned world, against the same bloom-off frame:
//
//     far field 96-200 px   x1.001  x1.023  x1.004  x1.003  x0.993
//     p90 of the artwork    identical at every value, and to bloom-off
//     halo at 24-32 px     0.06029 0.05813 0.05344 0.04814 0.04200
//     clipped px (>=254)      1434    1424    1379    1314    1269
//
// The far field and p90 do not move with intensity at all now, so this dial
// only touches the near glow -- before the levels cut it was moving the wash
// and the glow together, and no value of it could separate them.
//
// 0.6 keeps 63% of the old added glow at 24-32 px and takes 21% off the bloom's
// contribution to clipping. It cannot go below 869, which is the ink.
//
// The author chose it by eye on `lookbook/bloom-fired-lv5-intensity-strip.png`,
// AT DPR 1, which he confirmed is the target installation. That matters and is
// not a detail: the pyramid is measured in DEVICE pixels, so the reach of five
// levels in CSS pixels scales inversely with devicePixelRatio, and `compositeDpr`
// caps at 1.5. A value picked on a 1.5x display would land ~1.5x wider on the
// exhibit's 1x projector. Picked at 1x, it transfers.
export const BLOOM = {
  luminanceThreshold: 0.28,
  luminanceSmoothing: 0.9,
  intensity: 0.6,
  mipmapBlur: true,
  radius: 0.7,
  levels: 5,
};

// Immersive only. Replaces the 2D radial-gradient vignette, which ran to
// rgba(0,0,0,0.65) at the corners.
export const VIGNETTE = {
  offset: 0.32,
  darkness: 0.65,
};

// ── The soft knee ───────────────────────────────────────────────────────────
//
// Runs at the composer TAIL, after <Bloom>. That placement is the whole design
// and it is not interchangeable with putting it in the screen pass: the bloom's
// bright-extract has to see TRUE overbright so a 30x core blooms like a 30x
// core. Compressing before the bloom makes every overbright value arrive at the
// threshold looking identical to 1.0, which is the one thing the half-float
// accumulator was bought to prevent.
//
// ── Why the curve is IDENTITY below the knee ───────────────────────────────
//
// Not for taste — for attribution. MEASURED on a 4-node cascade, bloom off, at
// the first exposure that does not clip: 63.3% of all ink never exceeds 1.0. A
// curve that touches those values moves two thirds of the art, re-bases all 21
// reference cells, and permanently costs us the ability to say which change
// moved which pixel. Constrained to identity below the knee, the change can
// only touch pixels that were already over the knee — which is the defect's own
// footprint and nothing else.
//
// ── The curve ──────────────────────────────────────────────────────────────
//
// A hyperbolic (Reinhard) shoulder, on the MAX CHANNEL:
//
//     t = x - knee,  s = 1 - knee
//     f(x) = knee + s * t / (t + s)        for x > knee
//     f(x) = x                             otherwise
//
// Three properties, all of which are load-bearing:
//
//   - f'(knee) = 1 exactly, so the join is C1 and there is no visible crease
//     where the compression starts. An exponential shoulder,
//     knee + s*(1 - exp(-t/s)), is also C1 but saturates within ~3s — it puts
//     2x and 37x on the same output level, which is precisely the "crushed to
//     white" defect rebuilt in a nicer shader.
//   - f -> 1 as x -> infinity, so nothing clips no matter how deep the pile.
//   - Applied as a scale of the max channel, NOT of luminance. A luminance
//     scale preserves hue but does not bound the channels: a saturated
//     (6, 0, 0) has luminance 1.28, and scaling by f(L)/L leaves red far above
//     1 and clipping anyway. Normalising by max(r,g,b) preserves the hue AND
//     the saturation ratios while guaranteeing the result is in gamut, which is
//     what "retain filament structure and colour fidelity" actually requires.
//
// ── What the knee value buys, and why it is a DIAL and not a constant ──────
//
// The tail is long and the display is not: 37x of range cannot be fitted into
// the top of an 8-bit ramp with all of it distinguishable. Something is crushed
// whatever we choose, and the knee decides WHAT. At knee 0.6 the band where 97%
// of the overbright actually lives resolves into separate levels:
//
//     input    1.0x   1.5x   2.0x   4.0x   8.0x   37x
//     output    204    224    232    244    250   254
//
// while a knee of 0.9 leaves 1x-8x inside four levels of each other and a knee
// of 0.25 buys structure by repainting a quarter of the frame. That is an
// aesthetic decision on a real trade, so it ships as a uniform and the author
// picks it off a strip. The default below is a starting point, not a finding.
//
// ── The units, which are linear and happen to agree with sRGB ──────────────
//
// The knee runs in the composer's linear working space. Above 1.0 that is the
// SAME number as the sRGB-encoded accumulator value, because the screen pass
// clamps its gamma conversion at 1 and carries the excess linearly — so the
// census figures quoted above can be read straight off this scale. Below 1.0
// the two diverge as usual, so a knee of 0.6 linear sits at about 0.8 in sRGB,
// i.e. higher up the ramp than it looks.
export const KNEE = {
  knee: 0.6,
  // Raising this above the frame's maximum makes the curve mathematically
  // identity everywhere, which is how the null-knee test proves the effect is
  // a no-op outside its intended range. See SphereKnee.js.
  enabled: true,
};

/**
 * The soft-knee shoulder, on a single scalar channel.
 *
 * Exported as pure arithmetic with no three.js import so it can be unit-tested
 * against the GLSL — ArtTab cannot be mounted in jsdom, so anything testable
 * has to live out here. The shader in SphereKnee.js is the same expression
 * written branchlessly; `artComposite.test.js` pins the two together.
 *
 * `knee` is intended to be in [0, 1). Two edges are handled explicitly rather
 * than left to the caller, because both are reachable and one of them is a
 * divide by zero:
 *
 *   - x <= knee is the identity. That is the contract, not an optimisation.
 *   - knee >= 1 makes s = 1 - knee zero or negative, and at knee = 1.5, x = 2
 *     the denominator t + s is EXACTLY 0. In GLSL that is an inf or a NaN
 *     reaching the screen as a driver-dependent speck. `s` is floored at a tiny
 *     positive epsilon so the curve degenerates to a hard clamp at `knee`
 *     instead of exploding.
 *
 * The NULL-KNEE configuration is therefore not knee = 1; it is a knee ABOVE any
 * value present in the frame, where `x <= knee` holds for every pixel and this
 * is provably the identity. See KNEE_NULL.
 */
export function softKnee(x, knee) {
  if (!(x > knee)) return x;
  const s = Math.max(1 - knee, 1e-6);
  const t = x - knee;
  return knee + (s * t) / (t + s);
}

/**
 * A knee above any value the frame can contain, so the shoulder is provably the
 * identity for every pixel. Used by the verification plan to show this pass is
 * a no-op outside its intended range: a capture at KNEE_NULL must be BYTE
 * IDENTICAL to a capture with the effect absent, and if it is not, the effect
 * is doing something other than what its curve says.
 *
 * The measured peak of a 4-node cascade is 37.15x, so this has five orders of
 * magnitude of headroom over the worst state anyone has produced.
 */
export const KNEE_NULL = 1e6;

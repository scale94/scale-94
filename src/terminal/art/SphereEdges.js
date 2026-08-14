// SphereEdges.js — the sphere's base edges, on the GPU.
//
// Step 4's first pixel-moving commit. The 2D draw loop no longer strokes an
// edge; it writes seventeen floats per edge into a preallocated Float32Array and
// this module draws them as one instanced quad into the backdrop target that
// SphereComposite already owns.
//
// ── What did NOT move, and must not ────────────────────────────────────────
//
// Projection, the depth sort and the per-edge state derivation all stay on the
// CPU. `edgeAt()` hit-tests against the same projected screen coordinates the
// draw loop computes; moving the projection into the vertex shader renders
// identically and kills every edge hover silently. The CPU therefore hands this
// module *screen-space endpoints in CSS px*, in the depth-sorted order it
// already had, and the shader does no 3D at all.
//
// ── Why the geometry lives in the backdrop scene ───────────────────────────
//
// Anything in r3f's scene graph is drawn to the screen by the EffectComposer.
// The edges have to land INSIDE the offscreen target, over the backdrop and
// under the 2D canvas, so they are added to the imperative backdrop scene in
// SphereComposite instead. That target is RGBA8 / NoColorSpace, so a plain
// SrcAlpha / OneMinusSrcAlpha blend there happens in sRGB byte space — which is
// what the canvas did. Blending these in three's linear working space is the
// bug that cost step 3 a rewrite and still scored 1.285 against a threshold
// of 4.
//
// ── The attribute layout ───────────────────────────────────────────────────
//
//   0–3    ax, ay, bx, by   projected endpoints, CSS px, canvas y-down
//   4–6    r, g, b          gradient stop 0 (at A), sRGB 0–1
//   7–9    r, g, b          gradient stop 1 (midpoint)
//   10–12  r, g, b          gradient stop 2 (at B)
//   13     packed alphas    a0 + a1*256 + a2*65536, each quantised to 1/255
//   14     width            stroke width in px; NEGATIVE means a pulse ring
//                           carrying -2 * radius — see the disc-sentinel note
//   15     packed flags     dashPeriod + dashDuty*256
//                             + (round(glow * glowQuant) + isOrtho*128)*65536
//   16     dash phase       px of arc length from the PATH's start to this
//                           instance's endpoint A, plus lineDashOffset — see
//                           "The 17th float" below. 0 for a solid stroke.
//
// Every packed field is an INTEGER. A float32 represents every integer below
// 2^24 exactly, and all the divisors used to unpack are powers of two, so the
// round trip is lossless — which is why the glow radius is carried in whole
// steps of `1 / glowQuant` px rather than as a fraction. The brief's
// `glow*65536` would have put a fractional field under two integer ones and
// leaked its low bits into the dash period.
//
// `glowQuant` is 8 for the source-over edge mesh below and 4 for the additive
// one — a PER-MATERIAL step, for the reason set out under "The additive twin".
// It is the one number in this table that is not the same for both meshes.
//
// ── The 17th float, and why the dash could not do without one ──────────────
//
// Task 6b puts two DASHED quadratic Béziers on this mesh (the analogy filaments
// and the chimera boundary fringes). A curve here is a run of straight
// instances, and the dash test this file shipped with was
//
//     step(mod(t * vLen, period), duty)
//
// i.e. distance from THIS INSTANCE's own endpoint A. That is exactly right for
// one straight segment and exactly wrong for a tessellated curve: every segment
// would restart the pattern at its own start, so the dashes bunch at every
// joint and the effective period collapses toward the segment length as the
// tessellation count rises. Canvas measures dash phase along the PATH's arc
// length from the path's start, and `lineDashOffset` slides the pattern along
// it. So each instance has to carry where it sits on that path.
//
// There was no room. Field 15's three bytes are full (dashPeriod, dashDuty,
// glow+isOrtho) and field 14's sign is the disc sentinel, so the phase is a
// 17th float. Extending EDGE_STRIDE from 16 to 17 leaves offsets 0-15 exactly
// where they were: every existing attribute binding, every existing writer and
// every existing reader is unmoved, and the source-over mesh's instances are
// byte-identical in the fields it writes (it never writes field 16, and a
// Float32Array is born zeroed). What it costs is the buffer: one sixteenth
// more of every instance, which on the additive mesh's fixed preallocation is
// 4.74MB -> 5.03MB before this task's own instances are counted in.
// The alternative — a second interleaved layout for the additive material — is
// a second decoder for the same data, which this file exists to avoid.
//
// The fragment then dashes with `mod(vPhase + t * vLen, period)`, and vPhase
// carries `arcLengthAtSegmentStart + lineDashOffset` REDUCED MODULO the packed
// period on the CPU (see the chimera writer in ArtTab). Reducing matters: the
// chimera's offset is `performance.now() * 0.001 * 30`, which grows without
// bound, and a float32 holding 2.6e6 px has an ulp of 0.25px — a quarter-pixel
// quantisation of the dash phase after a day of uptime. `mod` is invariant
// under it, so reducing first costs nothing and removes the drift.
//
// ── isOrtho, and why IT did not need one ───────────────────────────────────
//
// A canvas shadow's colour and alpha are set once by `ctx.shadowColor` and
// never varied per-instance the way the stroke's gradient is — fused edges use
// `hslAlpha(cMid, fuseCos * 0.6)`, the orthogonal bridge uses a fully opaque
// `hue + 30`. The flat `GLOW_K` this shipped with borrowed the gradient's own
// colour and a single alpha for both, so the ortho halo came out ~2x too dim
// and up to 120deg off in hue (see task-3-report.md's fix wave).
//
// `packFlags` rounds glow to this mesh's eighths and clamps it to [0, 127] —
// both real glow radii (fusedGlow, orthoGlow) top out at 14px, round(14*8)=112 —
// so bit 7 of that byte (bit 23 of the packed field) is provably never set by
// a real glow value. It carries `isOrtho` instead, and the shader picks the
// correct shadow alpha and colour per-instance from data it already has:
//
//   - fused:  colour = the mid stop (vC1 IS cMid already — writeHslRgb writes
//             stops[1].color there); alpha = fuseCos * 0.6, and fuseCos is
//             recovered from vGlow itself, because fusedGlow() is a bijective
//             linear map of it (fuseCos = (vGlow - FUSED_GLOW_BASE) /
//             FUSED_GLOW_SCALE). No new data needed.
//   - ortho:  alpha = 1.0 (constant); colour = hsl(hue + 30, 100%, 60%). Sat
//             and lit are compile-time constants for this shadow, and the hue
//             is the ONE thing that's per-frame, not per-instance — orthoHue
//             is time-based and identical for every ortho edge in a frame, so
//             it travels as a uniform (`uOrthoHue`), not a per-instance float.
//
// ── The travelling pulse ring, and why a NEGATIVE width means "disc" ───────
//
// An edge carrying a live cascade also fills a small disc at the pulse's
// position along it. Those rings are instances in THIS buffer, each written
// immediately after the edge it belongs to — not a second mesh — and the reason
// is draw order. The 2D loop stroked edge i, filled edge i's ring, then stroked
// edge i+1, so the rings interleave through the depth sort. A second mesh draws
// every ring after every edge, which is a different picture whenever a cascade
// is in flight. One buffer written in loop order restores the interleave for
// free, and both layers blend source-over, so one material serves.
//
// Telling the two apart costs no extra float because the stroke width's sign is
// unused: `edgeLineWidth()` is provably positive over its whole real domain (a
// constant 0.5 term, every other term non-negative, a strictly positive
// projection scale — pinned by a unit test in artEdges.test.js, since a change
// that let an edge go negative would silently start drawing it as a disc). So a
// ring writes `width = -2 * radius` and coincident endpoints, `abs()` recovers
// halfW for both cases, and `step(aPack.y, 0.0)` is the discriminator. The
// fragment shader then swaps the perpendicular box filter for a radial one.
//
// A ring's other fields are chosen so no other branch needs to know about it:
// the same rgb and alpha in all three gradient stops degenerate the gradient to
// flat (and a zero-length segment puts t at 0 regardless), and `packFlags(0, 0,
// 0)` leaves the existing `step(0.001, vGlow)` and `if (vDash.x > 0.0)` to
// switch the glow and dash terms off with no new branch.

// ── The additive twin, and the one field that could not be shared ──────────
//
// `lighter` is additive and the base edges are source-over, so the resonance
// edge and the prism chords cannot ride the mesh above: one material cannot
// carry two blends. They get a SECOND mesh over the same geometry and the same
// shader body, drawn after this one — which is also their 2D draw order, after
// every edge and every ring.
//
// Three things could not simply be shared. The shadow's colour and alpha (a
// flat gold here, derived per-instance from the isOrtho bit there) and the
// FINAL COMPOSITE — `lighter` adds the shadow beside the stroke where
// source-over stacks it underneath, so this material emits premultiplied ink;
// see COMPOSITE_ADDITIVE. Both are injected snippets, not runtime branches.
//
// The third is the glow's quantisation.
// The glow byte is seven bits (bit 7 is isOrtho), so at the edge mesh's 1/8 px
// step the largest radius representable is 127/8 = 15.875 px. That covers both
// of ITS glows — fusedGlow and orthoGlow top out at 14 — but resonanceGlow
// reaches 28, and even the DEFAULT sim of 0.5 asks for 16. Packed at 1/8 both
// come back as 15.875, silently, in the one layer the plan calls "the place a
// wrong glow falloff will show first" and which no capture state arms.
//
// So the step is per material: `glowQuant`, a uniform on the shader side and an
// argument on the packing side, single-sourced from the spec objects below. The
// additive layer uses 4 — round(28*4) = 112, the same number and the same
// headroom under 128 that round(14*8) = 112 gives the edge mesh, at a step of
// 0.25 px the falloff cannot show. The edge mesh keeps 8 and is unmoved, which
// is deliberate: changing it would shift every shipped ortho and fused glow,
// i.e. a parity change smuggled into a port task.

import * as THREE from 'three';
import {
  FUSED_GLOW_BASE, FUSED_GLOW_SCALE, ORTHO_HUE_STEP_GLOW,
  RESONANCE_GOLD, RESONANCE_SHADOW_ALPHA,
  PRISM_MAX_EFFECTS, PRISM_MAX_NODES, PRISM_SPECTRAL_FINE,
  FILAMENT_MAX_DRAWN, CHIMERA_MAX_ZONES,
} from './artEdges.js';
import { CURVE_MAX_SEGMENTS } from './artCurve.js';

/** Render an integer constant as a GLSL float literal, for injecting the
 *  artEdges.js constants into the shader source so they stay one source of
 *  truth instead of a second hand-copied magic number. */
const glslFloat = (n) => (Number.isInteger(n) ? `${n}.0` : `${n}`);

/** The same, for an rgb BYTE triple. */
const glslRgb255 = (c) => `vec3(${c.map(v => glslFloat(v / 255)).join(', ')})`;

/** Floats per edge instance. 17 since task 6b — see "The 17th float" above. */
export const EDGE_STRIDE = 17;

/** The attribute layout above, as data: each field's offset in floats from an
 *  instance's base. Exported because the buffer has a READER as well as a
 *  writer — `window.__artEdgeState().instances` publishes the raw range and the
 *  presence harness has to find the pulse rings in it. Restating `+ 14` there
 *  under a comment promising the layout is not restated is how the two drift;
 *  pair this with `isDisc()` and the harness decodes through the same names and
 *  the same sign convention this file defines. */
export const EDGE_OFF = Object.freeze({
  ax: 0, ay: 1, bx: 2, by: 3,
  c0: 4, c1: 7, c2: 10,
  alphas: 13, width: 14, flags: 15, phase: 16,
});

/** Hard cap on INSTANCES uploaded in a frame — edges and pulse rings share this
 *  buffer, so an edge can cost two. 31 core nodes give ~90 edges; the rest are
 *  spectral bridges, bone fusions and operator-forged links, all of which are
 *  handfuls. At most one ring per edge puts the worst case near 180. 1024 is
 *  64KB of scratch and cannot be reached. (The name predates the rings and is
 *  kept: renaming it churns four files for nothing.) */
export const MAX_EDGES = 1024;

/**
 * The ADDITIVE mesh's own cap, and it is three orders of magnitude larger.
 *
 * Until task 6 that buffer held two instances (the resonance halo and core) and
 * had no guard at all, because two cannot overflow 1024. The prism layer is a
 * different scale of thing: every chord is a quadratic Bézier flattened into up
 * to CURVE_MAX_SEGMENTS straight instances, and there are a lot of chords.
 *
 *   pairs       C(11,2)                                = 55
 *   curves      55 pairs x 7 spectral lines x 2 passes = 770   per effect
 *   chords      770 x 24 segments                      = 18480 per effect
 *   polygon     one closed path through 11 nodes       = 11
 *   spokes      one per node                           = 11
 *   effect      18480 + 11 + 11                        = 18502
 *   frame       4 concurrent effects x 18502 + 2 resonance strokes
 *
 * Task 6b added two more curve layers to the same stream, both capped in the
 * draw loop against the constants they are sized from (see artEdges.js):
 *
 *   filaments   96 x 2 passes x 24 segments            = 4608
 *   fringes     136 zones x 24 segments                = 3264
 *
 * = 74010 + 7872 = 81882 instances, i.e. a 5.57MB Float32Array (it was 4.74MB
 * at 74010 x 16). That is provably the worst
 * frame the sim can produce — ArtTab's spawnEffect drops the oldest effect
 * beyond four and slices each node list to eleven — and it is deliberately a
 * FIXED preallocation rather than a buffer that grows on demand: the array is
 * the GPU-bound InterleavedBuffer's own backing store (see createEdgeLayer's
 * `sharedData`), so reallocating it would silently unbind the writer from the
 * thing the GPU reads. The cost of the guarantee is 5.6MB of scratch held for a
 * layer that is usually empty; see the task report for the sizing alternative.
 *
 * Reaching this number needs four simultaneous eleven-node effects, which is
 * four clicks inside five seconds. The typical live frame is ~10000.
 */
const PRISM_PAIRS = (PRISM_MAX_NODES * (PRISM_MAX_NODES - 1)) / 2;
const PRISM_PER_EFFECT =
  PRISM_PAIRS * PRISM_SPECTRAL_FINE * 2 * CURVE_MAX_SEGMENTS   // the chord bundle
  + PRISM_MAX_NODES                                            // the closed polygon
  + PRISM_MAX_NODES;                                           // the star spokes
const ORPHAN_CURVES =
  FILAMENT_MAX_DRAWN * 2 * CURVE_MAX_SEGMENTS   // glow pass + core pass
  + CHIMERA_MAX_ZONES * CURVE_MAX_SEGMENTS;     // one pass
export const MAX_ADDITIVE_EDGES =
  2 + PRISM_MAX_EFFECTS * PRISM_PER_EFFECT + ORPHAN_CURVES;

/** How many instances a state can hold. The array's own length IS the answer,
 *  so a state and its capacity cannot drift; falls back to MAX_EDGES for the
 *  hand-built states the sync tests pass in, which carry no buffer. */
export function edgeCapacity(state) {
  return state?.data ? state.data.length / EDGE_STRIDE : MAX_EDGES;
}

/** How many glow radii the instance quad is padded by. The shoulder is
 *  exp(-2(d/g)^2), which drops below 1/255 at d = 1.66g. */
export const GLOW_REACH = 1.75;

// Steps per pixel of glow radius, per material — see the note at the top of the
// file for why these are not one number. Both are powers of two, so the packed
// field stays an integer and the float32 round trip stays lossless.
const GLOW_QUANT_SRC_OVER = 8;   // 1/8 px, max 15.875 — covers 14
const GLOW_QUANT_ADDITIVE = 4;   // 1/4 px, max 31.75  — covers 28

// GLOW_K, the flat 0.5 this shipped with, is gone: it stood in for two
// different `ctx.shadowColor` alphas (and always the wrong colour — see the
// file header). The shader now derives the real alpha and colour per-instance
// from the isOrtho bit instead of averaging them into one global uniform.

/**
 * Allocate the buffer the draw loop writes into. Once, never per frame.
 *
 * `w` and `h` are the CSS dimensions the endpoints were projected in, and they
 * are published WITH the coordinates rather than measured on the GL side. r3f's
 * own `size` comes from a ResizeObserver that is documented in SphereComposite
 * as getting stuck on this page, and SizeSync only nudges it back over several
 * frames. A stale resolution barely moves the backdrop — it is uv-addressed and
 * stays centred — but it rescales absolute pixel coordinates about the origin,
 * which throws most of the edges off-screen. Measured: at the immersive toggle
 * the edge layer vanished from the capture entirely while the backdrop looked
 * fine.
 */
export function createEdgeState(capacity = MAX_EDGES) {
  return {
    // `count` is INSTANCES, edges and rings together. `rings` counts the disc
    // instances alone and exists purely to be asserted on: a capture with no
    // live cascade scores perfect ring parity whether the layer works or has
    // been deleted, so the harness has to be able to ask whether any were
    // drawn at all. Published through window.__artEdgeState().
    //
    // `dropped` is the same idea one level down: instances a writer could not
    // fit. An over-range Float32Array write is a SILENT no-op, so without a
    // counter the failure mode is geometry that simply is not there, with the
    // count, the draw call and the buffer all agreeing nothing went wrong.
    count: 0, rings: 0, dropped: 0, w: 1, h: 1, orthoHue: 0,
    data: new Float32Array(capacity * EDGE_STRIDE),
  };
}

/**
 * HSL → sRGB, written into `out` at `o`, with exactly CSS `hsl()` semantics.
 *
 * The node palette is HSL objects with sat/lit in PERCENT (artGraph.js,
 * kernelColorMap.js) and the 2D code handed them straight to canvas as
 * `hsla()` strings. The GPU needs floats, so the conversion happens here and
 * nowhere else. Interpolation between two node colours still happens in HSL on
 * the CPU via lerpColor — a shortest-arc hue lerp takes a different path across
 * the wheel than an RGB lerp, and re-doing it in the shader would re-art the
 * midpoint of every edge.
 */
export function writeHslRgb(out, o, c) {
  writeHsl(out, o, c.hue, c.sat, c.lit);
}

/** The same conversion from loose numbers, for the ortho bridge's synthesised
 *  hues — it never had a colour object, and building one per edge per frame
 *  would put the draw loop back on the allocation path. */
export function writeHsl(out, o, hue, sat, lit) {
  const h = ((hue % 360) + 360) % 360;
  const s = Math.min(1, Math.max(0, sat / 100));
  const l = Math.min(1, Math.max(0, lit / 100));
  const a = s * Math.min(l, 1 - l);
  // The CSS Color 4 reference implementation, verbatim.
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  out[o]     = f(0);
  out[o + 1] = f(8);
  out[o + 2] = f(4);
}

/** An rgb BYTE triple into the same three floats `writeHslRgb` writes.
 *
 *  The resonance edge and the prism chords are authored as `rgba()` literals,
 *  not as the HSL objects the node palette carries, so they have no hue to
 *  convert and must not be routed through the HSL path — doing so would ask
 *  writeHsl to read 255 as a hue in degrees. */
export function writeRgb255(out, o, c) {
  out[o]     = c[0] / 255;
  out[o + 1] = c[1] / 255;
  out[o + 2] = c[2] / 255;
}

/**
 * Three alphas into one float. Each is clamped to 0–1 first, which is not
 * tidiness: `baseAlpha + pulseBoost` can exceed 1 and the canvas clamped it
 * when it parsed the `hsla()` string.
 */
export function packAlphas(a0, a1, a2) {
  const q = (a) => Math.max(0, Math.min(255, Math.round(a * 255)));
  return q(a0) + q(a1) * 256 + q(a2) * 65536;
}

/** The inverse of `packAlphas`, normalised back to 0–1. Exported so the tests
 *  exercise the exact arithmetic `EDGE_VERT` runs (see `vAlpha` there)
 *  instead of a hand-copied second implementation that could drift from it
 *  unnoticed — see the note beside `unpackFlags`. */
export function unpackAlphas(packed) {
  return {
    a0: Math.floor(packed % 256) / 255,
    a1: Math.floor((packed / 256) % 256) / 255,
    a2: Math.floor(packed / 65536) / 255,
  };
}

/**
 * A pulse ring's radius as the width field of an edge instance. The sign IS the
 * sentinel — see the file header — and the factor of two is there so the
 * shader's shared `abs(aPack.y) * 0.5` recovers the radius as its halfW.
 */
export function discWidth(radius) {
  return -2 * radius;
}

/** The discriminator, mirroring `step(aPack.y, 0.0)` in EDGE_VERT exactly —
 *  which is `<= 0`, not `< 0`: `step(edge, x)` returns 1 for `x >= edge`, so a
 *  width of exactly 0 renders as a (zero-radius) disc, not as a hairline.
 *  Exported for the same reason as `unpackFlags`: every other reader — the
 *  invariant test, the presence harness — asks THIS rather than re-deriving the
 *  sign rule. `artPresence.mjs` had already drifted to `w >= 0 -> edge`, which
 *  disagrees with the shader at exactly that boundary. */
export function isDisc(width) {
  return width <= 0;
}

/**
 * Dash pattern, glow radius and the isOrtho flag into one float. `dashPeriod`
 * is on+off and `dashDuty` is on, both in px; a period of 0 means solid.
 *
 * The glow is quantised to `1 / glowQuant` px and clamped to [0, 127] rather
 * than [0, 255], because bit 7 of that byte carries `isOrtho` instead — see the
 * file header for why that avoids a 17th float. `glowQuant` DEFAULTS to the
 * source-over edge mesh's own step so every existing call site packs the byte
 * it always packed; the additive layer passes its own (see the note at the top
 * of the file, and `ADDITIVE_LAYER.glowQuant`). Whatever the step, the
 * invariant is the same one: the material's largest real radius must round to
 * under 128, or the clamp eats it silently.
 */
export function packFlags(dashPeriod, dashDuty, glow, isOrtho = false,
                          glowQuant = GLOW_QUANT_SRC_OVER) {
  const p = Math.max(0, Math.min(255, Math.round(dashPeriod)));
  const d = Math.max(0, Math.min(255, Math.round(dashDuty)));
  const g = Math.max(0, Math.min(127, Math.round(glow * glowQuant))) + (isOrtho ? 128 : 0);
  return p + d * 256 + g * 65536;
}

/** The inverse of `packFlags`, mirroring exactly what `EDGE_VERT` unpacks
 *  (dashPeriod/dashDuty via mod/floor, glow's top bit split off as isOrtho,
 *  the rest divided by the material's `uGlowQuant`). Exported so
 *  `artEdges.test.js` cannot drift from the shader's arithmetic — see
 *  `EDGE_VERT` for the GLSL twin of this function. */
export function unpackFlags(packed, glowQuant = GLOW_QUANT_SRC_OVER) {
  const gByte = Math.floor(packed / 65536);
  return {
    dashPeriod: Math.floor(packed % 256),
    dashDuty: Math.floor((packed / 256) % 256),
    isOrtho: gByte >= 128,
    glow: (gByte % 128) / glowQuant,
  };
}

/**
 * Pack one flattened polyline into `state` as (m - 1) line-quad instances, all
 * sharing a colour, an alpha, a width and a flag word. Returns how many were
 * written.
 *
 * `pts` is `tessellateQuad`'s point list (xy pairs) and `m` its point count, so
 * segment i runs from point i to point i+1 — which is what makes the joints
 * EXACT. Both segments read the identical float, so butt caps meet with no
 * overlap and no gap. That is a correctness requirement rather than tidiness:
 * this buffer feeds the additive material, and an overlap under `lighter` adds
 * twice and beads at every joint, where the canvas stroked the whole path once
 * and composited it once.
 *
 * The gradient degenerates: the same rgb and the same alpha in all three stops,
 * so the shader's three-stop interpolation collapses to flat with no new
 * branch — the same trick the pulse rings use. `width` is written as handed in
 * and must stay POSITIVE, because a negative width is the disc sentinel.
 *
 * Anything past capacity is COUNTED into `state.dropped`, not lost: a write
 * past the end of a Float32Array is a no-op that reports nothing, so the only
 * evidence a frame was truncated is the number this keeps.
 *
 * `rgb` is a 3-float scratch (writeHsl's output), not a fresh array per call —
 * a full-strength frame runs this ~74000 times.
 *
 * ── phase0, and why the arc length is a RUNNING SUM ────────────────────────
 *
 * `phase0` is where this path starts in its dash pattern: `lineDashOffset`,
 * already reduced modulo the period by the caller. Each instance is then
 * written with `phase0 + (arc length from the path's start to its own endpoint
 * A)`, accumulated with the same `Math.hypot` over the same point list the
 * geometry is written from — so the phase and the geometry are one measurement
 * and cannot disagree.
 *
 * It must be a running sum and not `i * (total / n)`: `tessellateQuad` splits
 * at uniform PARAMETER, and equal parameter steps are not equal arc lengths on
 * anything but a straight line (the prism's near-cusp chords vary by several
 * times between their fastest and slowest segment). A constant step would
 * therefore slide the pattern against the geometry along every curve.
 *
 * The sum tracks the POLYLINE's length, which is marginally shorter than the
 * curve's — the chord of an arc always is. At this module's tessellation the
 * gap is bounded by the flatness tolerance: a segment sagging by at most
 * `tol` = 0.25px over a chord of length L is short by at most ~8tol^2/(3L),
 * i.e. ~0.02px on a 25px segment, and artCurve.test.js pins the real figure at
 * >= 0.999 of the true arc length at n = 24 (and never above it). Half a
 * percent of one dash period is not observable; using the true arc length
 * instead would make the phase disagree with the geometry that is actually
 * drawn, which is observable.
 */
export function writePolyline(state, pts, m, rgb, alpha, width, flags, phase0 = 0) {
  const cap = edgeCapacity(state);
  const data = state.data;
  const packed = packAlphas(alpha, alpha, alpha);
  let written = 0;
  let phase = phase0;
  for (let i = 0; i + 1 < m; i++) {
    if (state.count >= cap) { state.dropped += (m - 1) - i; break; }
    const o = state.count * EDGE_STRIDE;
    data[o]     = pts[i * 2];
    data[o + 1] = pts[i * 2 + 1];
    data[o + 2] = pts[i * 2 + 2];
    data[o + 3] = pts[i * 2 + 3];
    data[o + 4]  = rgb[0]; data[o + 5]  = rgb[1]; data[o + 6]  = rgb[2];
    data[o + 7]  = rgb[0]; data[o + 8]  = rgb[1]; data[o + 9]  = rgb[2];
    data[o + 10] = rgb[0]; data[o + 11] = rgb[1]; data[o + 12] = rgb[2];
    data[o + 13] = packed;
    data[o + 14] = width;
    data[o + 15] = flags;
    data[o + 16] = phase;
    phase += Math.hypot(pts[i * 2 + 2] - pts[i * 2], pts[i * 2 + 3] - pts[i * 2 + 1]);
    state.count++;
    written++;
  }
  return written;
}

// ── Shaders ────────────────────────────────────────────────────────────────
//
// A ShaderMaterial, so `position` and the matrices are declared for us. The
// matrices are unused on purpose: gl_Position is written in clip space
// directly from CSS px, which keeps the camera out of the parity argument.
// uv.y and clip y run opposite to canvas y, hence the flip.

const EDGE_VERT = /* glsl */`
  attribute vec4 aEnds;
  attribute vec3 aC0;
  attribute vec3 aC1;
  attribute vec3 aC2;
  attribute vec3 aPack;      // x = packed alphas, y = width px, z = packed flags
  attribute float aPhase;    // px into the dash pattern at this instance's A

  uniform vec2  uResolution; // CSS px, matching the 2D draw loop's coordinates
  uniform float uGlowReach;
  uniform float uGlowQuant;  // steps per px of glow radius — per material

  varying vec3  vC0;
  varying vec3  vC1;
  varying vec3  vC2;
  varying vec3  vAlpha;
  varying float vAlong;      // px from A along the segment; negative before A
  varying float vD;          // signed perpendicular distance in px
  varying float vLen;
  varying float vHalfW;
  varying vec2  vDash;
  varying float vPhase;      // px of arc length from the PATH's start, at A
  varying float vGlow;
  varying float vIsOrtho;    // 0.0 or 1.0 — same for all 4 verts of an instance
  varying float vIsDisc;     // ditto: a pulse ring, flagged by a negative width

  void main() {
    vec2 a = aEnds.xy;
    vec2 b = aEnds.zw;
    vec2 delta = b - a;
    float len = length(delta);
    vec2 dir = len > 1e-6 ? delta / len : vec2(1.0, 0.0);
    vec2 nrm = vec2(-dir.y, dir.x);

    // Unpack. Every divisor is a power of two and every field an integer, so
    // these are exact for a float32 payload below 2^24. The glow byte's top
    // bit (>=128) is isOrtho, not magnitude — see packFlags/unpackFlags in
    // SphereEdges.js, which this mirrors exactly.
    float f = aPack.z;
    float dashPeriod = floor(mod(f, 256.0));
    float dashDuty   = floor(mod(f / 256.0, 256.0));
    float gByte      = floor(f / 65536.0);
    float isOrtho    = step(127.5, gByte);
    float glow       = mod(gByte, 128.0) / uGlowQuant;

    float p = aPack.x;
    vAlpha = vec3(floor(mod(p, 256.0)),
                  floor(mod(p / 256.0, 256.0)),
                  floor(p / 65536.0)) / 255.0;

    // abs(), not max(, 0): a NEGATIVE width is a pulse ring carrying its radius
    // (see the file header and discWidth() below), and both cases want the
    // magnitude. A real edge width is provably positive, so nothing else can
    // land in the disc branch.
    float isDisc = step(aPack.y, 0.0);
    float halfW = abs(aPack.y) * 0.5;

    // Pad for the antialiasing shoulder and for however far the glow reaches.
    // The quad is expanded along the segment as well as across it, because a
    // blur bleeds past a butt cap; the fragment shader puts the cap back.
    float pad = halfW + 1.0 + glow * uGlowReach;

    float along = mix(-pad, len + pad, position.x);
    float off   = position.y * pad;
    vec2 pos = a + dir * along + nrm * off;

    vC0 = aC0; vC1 = aC1; vC2 = aC2;
    vAlong = along;
    vD = off;
    vLen = len;
    vHalfW = halfW;
    vDash = vec2(dashPeriod, dashDuty);
    // Passed through untouched: this is a PATH-space quantity, not a
    // segment-space one, and the fragment adds its own distance-along to it.
    vPhase = aPhase;
    vGlow = glow;
    vIsOrtho = isOrtho;
    vIsDisc = isDisc;

    gl_Position = vec4(pos.x / uResolution.x * 2.0 - 1.0,
                       1.0 - pos.y / uResolution.y * 2.0,
                       0.0, 1.0);
  }
`;

// The shadow's colour and alpha are the ONE thing the two materials cannot
// share, so they are injected as a snippet rather than branched on at runtime —
// the same treatment ORTHO_HUE_STEP_GLOW already gets. Each defines exactly
// `shadowAlpha` and `shadowCol`; everything around them, including the gaussian
// and its amplitude, is one body of code compiled twice.

// Source-over: derived per-instance from the isOrtho bit, out of data the
// instance already carries. See the file header.
const SHADOW_SRC_OVER = /* glsl */`
    // Fused: fuseCos * 0.6, with fuseCos recovered from vGlow — fusedGlow()
    // is a bijective linear map of it, so no extra data is needed. Ortho:
    // always 1.0 (fully opaque), matching the original ctx.shadowColor.
    float fuseCos = clamp((vGlow - ${glslFloat(FUSED_GLOW_BASE)}) / ${glslFloat(FUSED_GLOW_SCALE)}, 0.0, 1.0);
    float shadowAlpha = mix(fuseCos * 0.6, 1.0, vIsOrtho);
    // Fused shadows are the mid stop (vC1 IS cMid already, see edgeStops());
    // the ortho shadow is hue+30 at fixed S/L, reconstructed here because it is
    // the one colour that has no home in the 16-float layout otherwise.
    vec3 shadowCol = mix(vC1, hsl2rgb(mod(uOrthoHue + ${glslFloat(ORTHO_HUE_STEP_GLOW)}, 360.0), 1.0, 0.6), vIsOrtho);
`;

// Additive: one flat style for the whole layer. The resonance core is the only
// stroke here that HAS a shadow — the halo sets shadowBlur = 0 and the prism
// chords set none — and its ctx.shadowColor was a flat gold, not the gradient
// colour and not a function of anything per-instance. Those other strokes carry
// glow = 0, and the `step(0.001, vGlow)` below already zeroes the whole shadow
// term for them, so no per-instance flag is needed to tell them apart.
//
// The `* a` is the SHAPE's own alpha, and it is not decoration either. A canvas
// shadow is the blurred SHAPE bitmap tinted by shadowColor, so the stroke's
// alpha rides through it — measured directly: at lineWidth 4.2 / shadowBlur
// 22.5 / shadowColor alpha 0.9, the shadow 6px off the line reads 5, 11, 17, 23,
// 29 for stroke alphas 0.2 … 1.0, i.e. exactly linear (each value is the 8-bit
// truncation of alpha * 29). The shared amplitude below carries `shadowAlpha`
// and the geometry but not `a`, so folding it in here is what makes this
// material's glow the canvas's glow. It is done in the SNIPPET, not in the
// shared line, because the source-over edge mesh is shipped pixels: it has the
// same omission and correcting it there is a parity change this task did not
// authorise. See the report.
const SHADOW_ADDITIVE = /* glsl */`
    float shadowAlpha = ${glslFloat(RESONANCE_SHADOW_ALPHA)} * a;
    vec3 shadowCol = ${glslRgb255(RESONANCE_GOLD)};
`;

// The FINAL composite is the second thing the two materials cannot share, and
// the reason is the canvas drawing model rather than anything about this layer.
// A shadowed `ctx.stroke()` is TWO composite operations with the current
// operator — the blurred shadow image first, then the shape — so:
//
//   source-over  dst2 = col*topA + (shadowCol*botA + dst*(1-botA))*(1-topA)
//                     = col*topA + shadowCol*botA*(1-topA) + dst*(1-outA)
//   lighter      dst2 = dst + shadowCol*botA + col*topA
//
// Those associate differently. Under source-over the two operations collapse
// into a single straight-alpha (colour, coverage) pair, which is what
// SrcAlpha/OneMinusSrcAlpha then reproduces exactly. Under `lighter` they do
// NOT: the shadow is not underneath the stroke, it is added beside it. Emitting
// the source-over stack and blending it with SrcAlpha/One delivers
// `dst + col*topA + shadowCol*botA*(1-topA)`, short by `shadowCol*botA*topA` —
// invisible at high similarity, where the core saturates anyway, and ~20% of the
// red channel at sim 0, where `peak` is 0.269 against a mid alpha of 0.40 and
// nothing clips. So the additive material emits PREMULTIPLIED ink instead and
// takes One for its rgb source factor.
const COMPOSITE_SRC_OVER = /* glsl */`
    float outA = topA + botA * (1.0 - topA);
    if (outA <= 0.0) discard;
    vec3 outRGB = (col * topA + shadowCol * botA * (1.0 - topA)) / outA;

    gl_FragColor = vec4(outRGB, outA);
`;

// Premultiplied, per the derivation above: exactly the two terms the canvas
// added, in the order it added them. `outA` is still computed — it is what the
// discard tests, and the alpha channel's own factor pair (Zero/One, see
// ADDITIVE_LAYER) discards it afterwards regardless of what it holds.
//
// The halo and Task 6's chords are unaffected by the change of convention:
// they carry glow = 0, so botA is 0 and this emits `col * topA`, which is
// precisely what `SrcAlpha * (col*topA/topA)` used to deliver — with one
// rounding instead of two, which is if anything closer to what the canvas did.
const COMPOSITE_ADDITIVE = /* glsl */`
    float outA = topA + botA * (1.0 - topA);
    if (outA <= 0.0) discard;

    gl_FragColor = vec4(col * topA + shadowCol * botA, outA);
`;

const edgeFrag = (shadow, composite) => /* glsl */`
  precision highp float;

  // Time-based, not per-edge: orthoHue(now) is the same for every ortho edge
  // in a frame, so it travels once as a uniform rather than 1 of 16 floats
  // per instance. Set from SphereEdges.syncEdgeLayer.
  uniform float uOrthoHue;

  varying vec3  vC0;
  varying vec3  vC1;
  varying vec3  vC2;
  varying vec3  vAlpha;
  varying float vAlong;
  varying float vD;
  varying float vLen;
  varying float vHalfW;
  varying vec2  vDash;
  varying float vPhase;
  varying float vGlow;
  varying float vIsOrtho;
  varying float vIsDisc;

  // The CSS Color 4 reference algorithm, verbatim — the GLSL twin of
  // writeHsl() in SphereEdges.js. Used only for the ortho shadow colour,
  // whose saturation and lightness are compile-time constants (100%, 60%);
  // only the hue is dynamic.
  vec3 hsl2rgb(float h, float s, float l) {
    float a = s * min(l, 1.0 - l);
    vec3 k = mod(vec3(0.0, 8.0, 4.0) + h / 30.0, 12.0);
    return l - a * clamp(min(k - 3.0, 9.0 - k), -1.0, 1.0);
  }

  void main() {
    // Screen-space footprint of the two varyings, taken FIRST: derivatives are
    // undefined inside non-uniform control flow and there are three branches
    // below. length(vec2(dFdx, dFdy)) rather than fwidth() — fwidth is the L1
    // norm and overestimates a diagonal edge by up to 41%, which shows up as
    // uniformly fatter, brighter lines.
    float pxD = max(length(vec2(dFdx(vD), dFdy(vD))), 1e-6);
    float pxA = max(length(vec2(dFdx(vAlong), dFdy(vAlong))), 1e-6);

    float t = vLen > 1e-6 ? clamp(vAlong / vLen, 0.0, 1.0) : 0.0;

    // Three-stop gradient, interpolated NON-premultiplied exactly as a canvas
    // linear gradient does — the colour darkens toward the rim as it fades.
    vec3 col; float a;
    if (t < 0.5) { float u = t / 0.5;         col = mix(vC0, vC1, u); a = mix(vAlpha.x, vAlpha.y, u); }
    else         { float u = (t - 0.5) / 0.5; col = mix(vC1, vC2, u); a = mix(vAlpha.y, vAlpha.z, u); }

    // Box-filter coverage, not smoothstep. Edges are routinely thinner than a
    // pixel (width starts at 0.5) and a smoothstep shoulder spreads a 1px line
    // over 1.5px of ink — a systematic brightening the parity gate reads as a
    // one-sided bias. This form integrates to the true width at any scale.
    float side = clamp((vHalfW - abs(vD)) / pxD + 0.5, 0.0, 1.0);
    // Butt caps, matching ctx's default lineCap.
    float cap  = clamp(vAlong / pxA + 0.5, 0.0, 1.0)
               * clamp((vLen - vAlong) / pxA + 0.5, 0.0, 1.0);
    // A pulse ring is the SAME box filter on radial distance. Its two endpoints
    // coincide, so vAlong and vD are just the two components of the offset from
    // the disc's centre. No cap term — a disc has no ends — and no dash: its
    // packed period is 0, so the branch below is skipped anyway. Selected with
    // mix() rather than an if, so the count of non-uniform branches under the
    // derivative reads at the top of main() stays where it was.
    float disc = clamp((vHalfW - length(vec2(vAlong, vD))) / pxD + 0.5, 0.0, 1.0);
    float core = mix(side * cap, disc, vIsDisc);

    // Dash, in the same px units the canvas used, and on the CORE only: the
    // canvas dashed the stroke and then blurred it for the shadow, and a blur
    // of sigma 5 over an 8-on/4-off pattern is continuous.
    //
    // vPhase is arc length from the PATH's start plus lineDashOffset, so a
    // curve tessellated into a run of instances dashes as ONE path: segment
    // i's phase at t = 1 is segment i+1's phase at t = 0, by construction (see
    // writePolyline). Straight strokes carry vPhase = 0 and this reduces to the
    // segment-local form it replaced, byte for byte.
    if (vDash.x > 0.0) core *= step(mod(vPhase + t * vLen, vDash.x), vDash.y);

    // The shoulder standing in for ctx.shadowBlur. A canvas shadow is a real
    // gaussian of sigma = blur/2, so this is one too: exp(-d^2 / 2sigma^2) with
    // sigma = vGlow/2 is exp(-2 (d/vGlow)^2). The brief specified exp(-d/g),
    // and measured against a forced-glow capture that reads wrong — the canvas
    // halo is gone by ~1 blur radius while the exponential is still at 15% of
    // peak two radii out, so it shows as a wide flat veil instead of a halo.
    //
    // Distance is measured to the SEGMENT, not to its infinite line, so the
    // glow rounds off past the ends the way a blurred butt cap does. step()
    // rather than a branch keeps the divide defined when there is no glow.
    float dOut = max(0.0, max(-vAlong, vAlong - vLen));
    float dSeg = length(vec2(dOut, vD));
    float g = dSeg / max(vGlow, 1e-3);
    // The shadow's colour and alpha, per material. Separate from the stroke's,
    // which is the fix this shipped with: the bug it replaced used the
    // t-varying gradient colour (col) for the glow too, and a canvas shadow is
    // a FLAT colour, never a gradient.
${shadow}
    // AMPLITUDE, not a taste knob. Blurring a line of width w with sigma
    // leaves a peak of w / (sigma*sqrt(2pi)) of the original alpha; with
    // sigma = vGlow/2 that is 1.5958 * halfW / vGlow. At the 1px widths and
    // 6-14px blurs these edges actually use, that is ~7% — which is why the
    // canvas halo is invisible in a capture and a flat 0.5 was ~19x too
    // bright. min() covers the degenerate wide-line-tiny-blur case, where a
    // blur cannot raise the peak above the line's own alpha.
    //
    // shadowAlpha replaces the old flat uGlowK: it is ctx.shadowColor's own
    // alpha, taken from the instance or the material instead of averaged into
    // one constant across both.
    float peak = min(shadowAlpha * 1.5958 * vHalfW / max(vGlow, 1e-3), 1.0);
    float glow = peak * exp(-2.0 * g * g) * step(0.001, vGlow);

    // Composite the core with the glow (two distinct colours, two distinct
    // alphas) rather than blending one flat colour by a combined coverage —
    // that is what let the glow's colour bug hide in the old single-cov formula.
    // HOW they combine is per material: source-over stacks them, lighter adds
    // them side by side. See COMPOSITE_SRC_OVER / COMPOSITE_ADDITIVE.
    float topA = a * core;
    float botA = glow;
${composite}  }
`;

/**
 * The sphere's base edges and the travelling pulse rings: `ctx`'s default
 * source-over, in the target's raw sRGB bytes.
 *
 * The ALPHA channel gets its own factor pair, and that is not decoration. Since
 * the trail commit the target holds premultiplied ink whose alpha is read by
 * the screen pass to decide how much of the rift clear shows through. Without
 * this, three leaves the alpha channel on the RGB factors and the destination
 * alpha accumulates as `a*a + dst*(1-a)` — coverage squared, i.e. an edge that
 * paints its colour correctly and then lets the backdrop bleed back through
 * itself.
 */
export const SRC_OVER_LAYER = Object.freeze({
  glowQuant: GLOW_QUANT_SRC_OVER,
  shadow: SHADOW_SRC_OVER,
  composite: COMPOSITE_SRC_OVER,
  renderOrder: 1,
  blend: Object.freeze({
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  }),
});

/**
 * The resonance edge and (next) the prism chords: `ctx.globalCompositeOperation
 * = 'lighter'`.
 *
 * ── Deriving the four factors ──────────────────────────────────────────────
 *
 * The accumulator holds PREMULTIPLIED layer ink with coverage in alpha, and the
 * rift clear colour is NOT in it: the screen pass composites
 * `bg = ink.rgb + uRift * (1 - ink.a)`. On the 2D canvas, `lighter` added light
 * on top of a destination that ALREADY contained the rift clear, and it did not
 * occlude it. So the GL equivalent must
 *
 *   1. add to `ink.rgb`, and
 *   2. leave `ink.a` alone.
 *
 * This material's fragment stage emits PREMULTIPLIED ink (see
 * COMPOSITE_ADDITIVE for why it must — under `lighter` the shadow is not
 * underneath the stroke), so (1) is `One / One`: `dst.rgb + gl_FragColor.rgb`,
 * with the coverage already folded in. And (2) is `Zero / One`.
 *
 * That second pair is the one a call log cannot check and the plan warns about
 * by name. Left at three's default the alpha channel rides the RGB factors and
 * becomes `outA + dst.a` — a rising alpha, which the screen pass then reads as
 * "less rift shows here", i.e. the additive stroke would SUBTRACT the clear
 * colour from underneath itself. On the canvas that could not happen, because
 * the clear was already in the destination; `lighter` raised its alpha too and
 * nothing was watching that channel. Here something is.
 *
 * (The canvas also clamped `lighter` at 1.0 per channel, and it clamped TWICE —
 * once as the shadow landed in its 8-bit store, once as the shape did — where
 * GL clamps the single sum once at the end. For a sum of non-negative terms the
 * two agree: `min(1, a + min(1, b + d))` and `min(1, a + b + d)` are both 1
 * whenever `b + d >= 1` and both `a + b + d` otherwise. So One/One needs
 * nothing.)
 */
export const ADDITIVE_LAYER = Object.freeze({
  glowQuant: GLOW_QUANT_ADDITIVE,
  shadow: SHADOW_ADDITIVE,
  composite: COMPOSITE_ADDITIVE,
  // After the edge mesh. In the 2D loop the resonance edge is drawn after every
  // edge and every pulse ring, and the chords after it; a second mesh drawn
  // later reproduces that order exactly.
  renderOrder: 2,
  blend: Object.freeze({
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  }),
});

/**
 * Build one of the two edge meshes. Imperative, like the backdrop it joins:
 * nothing here may enter r3f's scene graph.
 *
 * `sharedData`, when passed, becomes the buffer's OWN backing array — the
 * caller (SphereComposite, via `createEdgeState()`'s array) writes directly
 * into what the GPU reads, so `syncEdgeLayer` never has to copy ~1400 floats
 * a frame into a second, redundant buffer. Falls back to a private array so
 * the function stays usable standalone (tests, any future non-shared caller).
 *
 * `spec` selects the material: the blend, the glow step, the shadow snippet and
 * the final composite. Everything else — the geometry, the vertex expansion,
 * the gradient, the box filter and the gaussian shoulder — is the same code
 * compiled twice.
 */
export function createEdgeLayer(sharedData, spec = SRC_OVER_LAYER) {
  const data = sharedData ?? new Float32Array(MAX_EDGES * EDGE_STRIDE);

  const geometry = new THREE.InstancedBufferGeometry();
  // x = position along the segment (0 at A, 1 at B), y = side (-1 / +1).
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, -1, 0,
    1, -1, 0,
    1,  1, 0,
    0,  1, 0,
  ], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);

  const buffer = new THREE.InstancedInterleavedBuffer(data, EDGE_STRIDE, 1);
  buffer.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aEnds', new THREE.InterleavedBufferAttribute(buffer, 4, 0));
  geometry.setAttribute('aC0',   new THREE.InterleavedBufferAttribute(buffer, 3, 4));
  geometry.setAttribute('aC1',   new THREE.InterleavedBufferAttribute(buffer, 3, 7));
  geometry.setAttribute('aC2',   new THREE.InterleavedBufferAttribute(buffer, 3, 10));
  geometry.setAttribute('aPack', new THREE.InterleavedBufferAttribute(buffer, 3, 13));
  // The 17th float. Bound on BOTH materials even though only the additive one
  // dashes a curve: one layout, one decoder, one shader body compiled twice —
  // and the source-over mesh never writes it, so it reads a constant 0 and its
  // dash term is byte-for-byte the segment-local one it always had.
  geometry.setAttribute('aPhase', new THREE.InterleavedBufferAttribute(buffer, 1, 16));
  geometry.instanceCount = 0;

  const uniforms = {
    uResolution: { value: new THREE.Vector2(1, 1) },
    uGlowReach:  { value: GLOW_REACH },
    uGlowQuant:  { value: spec.glowQuant },
    uOrthoHue:   { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: EDGE_VERT,
    fragmentShader: edgeFrag(spec.shadow, spec.composite),
    transparent: true,
    // See SRC_OVER_LAYER / ADDITIVE_LAYER for how each set of factors is
    // derived from what the accumulator holds.
    blending: THREE.CustomBlending,
    ...spec.blend,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = spec.renderOrder;
  mesh.visible = false;

  return {
    mesh, geometry, material, uniforms, buffer, data,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

/**
 * Sync this frame's edge state onto the mesh. Called from the backdrop pass,
 * before it renders, so the geometry can never be a frame behind the backdrop
 * it sits on.
 *
 * There is no copy here: `layer`'s buffer is built (in `createEdgeLayer`) to
 * share its backing array with `state.data` directly, so whatever the draw
 * loop wrote is already sitting in the GPU-bound buffer the instant it wrote
 * it. This function's job is only to tell WebGL a sub-range of it changed —
 * `addUpdateRange` + `needsUpdate` upload just the `count * EDGE_STRIDE`
 * floats actually written instead of the full `MAX_EDGES * EDGE_STRIDE` — and
 * to keep the mesh's visibility/instanceCount and per-frame uniforms current.
 *
 * A zero count sets `visible = false` rather than leaving one degenerate
 * instance to be rasterised.
 */
export function syncEdgeLayer(layer, state) {
  // Clamped to the STATE's own capacity, not to MAX_EDGES: the additive mesh
  // is sized for the prism layer (MAX_ADDITIVE_EDGES, ~74000) and a blanket
  // 1024 here would upload its first 1024 instances and drop the rest with the
  // count, the draw call and the buffer all agreeing nothing was wrong.
  const count = Math.min(state?.count | 0, edgeCapacity(state));
  layer.mesh.visible = count > 0;
  if (count === 0) { layer.geometry.instanceCount = 0; return; }
  layer.uniforms.uResolution.value.set(Math.max(state.w, 1), Math.max(state.h, 1));
  // orthoHue(now) is one value per frame, not per edge — see EDGE_FRAG.
  layer.uniforms.uOrthoHue.value = state.orthoHue ?? 0;

  layer.geometry.instanceCount = count;
  layer.buffer.addUpdateRange(0, count * EDGE_STRIDE);
  layer.buffer.needsUpdate = true;
}

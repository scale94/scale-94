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
  PRISM_WAVE_SEGMENTS,
  FILAMENT_MAX_DRAWN, CHIMERA_MAX_ZONES,
} from './artEdges.js';
import { CURVE_MAX_SEGMENTS } from './artCurve.js';
import { writeHsl } from './artColor.js';
export { writeHsl };

/** Render an integer constant as a GLSL float literal, for injecting the
 *  artEdges.js constants into the shader source so they stay one source of
 *  truth instead of a second hand-copied magic number. */
const glslFloat = (n) => (Number.isInteger(n) ? `${n}.0` : `${n}`);

/** The same, for an rgb BYTE triple. */
const glslRgb255 = (c) => `vec3(${c.map(v => glslFloat(v / 255)).join(', ')})`;

/** Floats per edge instance. 18 since step 7 — see "The 18th float" below. */
export const EDGE_STRIDE = 18;

/**
 * THE 18th FLOAT — a disc's own shadow colour, and the stride bump the layout
 * said the next float would cost.
 *
 * DISC_RESERVED went empty in step 6, so this is that bump, taken deliberately
 * rather than by overloading a slot. What needed it: the conductor's peer-push
 * glow is the FIRST shadowed disc this renderer draws — every writeDisc call
 * site before it passes glow = 0 — and `ctx.fill()` under a shadow paints the
 * shape in fillStyle and the blur in shadowColor, which on that layer are two
 * different colours (50%/55% against 70%/50%). The source-over material derives
 * a segment's shadow colour from vC1, but on a disc those three floats are
 * falloffInner, midStop and outerK. There is nowhere for it to go.
 *
 * ONE float, not three, on the precedent packAlphas and packFlags already set:
 * hue to 1 degree and s/l to 1% is 360 + 100*512 + 100*65536 = 6,605,160, well
 * inside float32's exact-integer range, and every divisor below is a power of
 * two so the round trip is lossless.
 *
 * A segment writes 0 here and reads nothing from it.
 */

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
  alphas: 13, width: 14, flags: 15, phase: 16, shadow: 17,
});

/** Pack an HSL triple into one float. See "The 18th float". Exact both ways. */
export function packHsl({ hue, sat, lit }) {
  const h = Math.max(0, Math.min(360, Math.round(hue)));
  const s = Math.max(0, Math.min(100, Math.round(sat)));
  const l = Math.max(0, Math.min(100, Math.round(lit)));
  return h + s * 512 + l * 65536;
}

/** The inverse, for the tests and for anything decoding a captured buffer. */
export function unpackHsl(packed) {
  const lit = Math.floor(packed / 65536);
  const rem = packed - lit * 65536;
  const sat = Math.floor(rem / 512);
  return { hue: rem - sat * 512, sat, lit };
}

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
// PRISM_WAVE_SEGMENTS, NOT CURVE_MAX_SEGMENTS. A chord carrying a travelling
// wavefront is forced to that finer tessellation so the pulse is sampled
// densely enough not to bead (see prismSegmentFade and _a18wsweep.mjs), and
// the worst case this array is sized from has to be the count the writer can
// actually reach. Sizing this from CURVE_MAX_SEGMENTS while the draw loop
// wrote 40 would not throw or warn: a Float32Array write past the end is a
// silent no-op, so the prism would simply render with pieces missing while
// `dropped` counted them and nothing else disagreed.
const PRISM_PER_EFFECT =
  PRISM_PAIRS * PRISM_SPECTRAL_FINE * 2 * PRISM_WAVE_SEGMENTS   // the chord bundle
  + PRISM_MAX_NODES                                             // the closed polygon
  + PRISM_MAX_NODES;                                            // the star spokes
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
    // `discStart` is the instance index at which discs that are NOT pulse
    // rings begin — from step 5 the node halos and cores share this buffer,
    // and they are discs too. Without it a reader scanning for `isDisc` finds
    // 31 halos and 31 cores and calls them pulse rings: artPresence's ring
    // check went from 39 motion-matched samples over 207px to 129 over 79640
    // and collapsed, on a frame where the rings themselves were fine. The
    // WRITER declares the boundary rather than the reader guessing it.
    // `worldCount` is the same idea one step further out: the instance count
    // that is projected GRAPH, before any screen-space furniture. The
    // conductor's strip is fixed to the right edge and its thumb rides a
    // continuous parameter, so a hash over the whole buffer stops answering
    // "did these two runs draw the same graph?" — see ArtTab's write site.
    // Defaults to count when nobody sets it, so a caller that never writes
    // furniture gets the whole buffer and nothing changes.
    count: 0, rings: 0, discStart: 0, worldCount: 0, dropped: 0, w: 1, h: 1, orthoHue: 0,
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
 * ── The disc branch's spare capacity ──────────────────────────────────────
 *
 * Step 5 needs a stroked RING with an inner radius, an arc sweep, an angular
 * dash and a linear radial falloff. None of that needs a wider instance,
 * because in the disc branch a large part of the 17-float layout is dead:
 *
 *   aEnds.zw  — for a disc `b == a`, so `delta` is zero; EDGE_VERT's
 *               `dir = len > 1e-6 ? delta/len : vec2(1,0)` already falls to
 *               the constant and `b` is never read for anything else.
 *   aPhase    — the dash term is `mod(vPhase + t*vLen, period)` and `vLen` is
 *               0, so it can only switch the whole instance uniformly on or
 *               off. Useless as a dash phase, free as an angle.
 *   aC1, aC2, — `t = vLen > 1e-6 ? ... : 0.0` is 0, so the three-stop gradient
 *   alphas.yz   collapses to `vC0` and `vAlpha.x` alone.
 *
 * Eight free floats, assigned below. THE INVARIANT THIS RESTS ON: a segment
 * instance must never take the disc branch, and a disc must never leak its
 * repurposed fields into the segment path. The first half is `edgeLineWidth`
 * being provably positive (see artEdges.js); the second half is EDGE_VERT
 * forcing `len` and `dir` for discs, which lands with the shader in the next
 * task. `discEncodingInvariant()` below is what a test asserts, so the two
 * halves cannot drift apart.
 *
 * A disc with rInner = 0 and a full sweep is EXACTLY the filled disc step 4
 * already ships — every field this adds is zero there — so the pulse rings
 * keep writing what they always wrote.
 */
export const DISC_OFF = Object.freeze({
  /** inner radius in px; 0 = filled disc, > 0 = annulus. Was aEnds.z. */
  inner: EDGE_OFF.bx,
  /** sweep END angle in radians; 0 means a full circle. Was aEnds.w. */
  sweepEnd: EDGE_OFF.by,
  /** sweep START angle in radians. Was aPhase. */
  sweepStart: EDGE_OFF.phase,
  /** radial-gradient inner radius in px; 0 = hard-edged, no falloff.
   *  Was aC1.x. */
  falloffInner: EDGE_OFF.c1,
  /** MID GRADIENT STOP position, 0..1 across the radius; 0 = no mid stop, so
   *  the disc keeps the single flat colour it always had. Was aC1.y.
   *
   *  Taken in step 6, from the floats the comment below promised a later step
   *  could have. The particle glow is the first disc on this branch whose 2-D
   *  gradient is a COLOUR ramp rather than an alpha one — lightness 82% to 65%
   *  to 50%, knee at 0.4 — and the node halo's trick of ramping coverage
   *  reproduces the alpha while leaving the darkening out. */
  midStop: EDGE_OFF.c1 + 1,
  /** MID stop colour, the three floats of aC2. Only read when midStop > 0. */
  midColor: EDGE_OFF.c2,
  /** OUTER stop colour, as an EXTRAPOLATION factor rather than a colour.
   *  Was aC1.z, the last of the five floats the layout reserved.
   *
   *  A three-stop ramp needs three colours and a disc has room for two. It does
   *  not need a third FLOAT TRIPLE, though, because of what the ramp actually
   *  is: the particle glow's stops share one hue and one saturation and differ
   *  only in LIGHTNESS (82%, 65%, 50%). For fixed h and s the CSS HSL-to-RGB map
   *  is linear in l on each side of l = 0.5, and all three stops sit on the
   *  upper side, so the outer colour lies on the line through the other two:
   *
   *      outer = mid + (mid - c0) * k,   k = (l_mid - l_outer) / (l_c0 - l_mid)
   *
   *  which for 82/65/50 is 15/17 = 0.8824. Exact, not an approximation — and it
   *  degrades safely: k = 0 gives outer = mid, which is the naive flat-tail
   *  behaviour, so a caller that does not know about this gets the conservative
   *  answer rather than a wrong one.
   *
   *  Only read when midStop > 0. */
  outerK: EDGE_OFF.c1 + 2,
});

/** Fields that MUST still be zero on a disc instance. There are none left: the
 *  layout reserved five floats saying "a later step can take them without a
 *  stride bump", and step 6 took all five — four for the mid gradient stop and
 *  one for the outer stop's extrapolation factor. Kept as an empty list rather
 *  than deleted, because `discEncodingInvariant` and three tests iterate it and
 *  the next step to want a float should find this note rather than the absence
 *  of one. THE NEXT ONE COSTS A STRIDE BUMP. */
export const DISC_RESERVED = Object.freeze([]);

/**
 * Write one disc or ring instance. `rInner = 0` gives a filled disc; a sweep of
 * 0 (or >= 2pi) gives a full circle.
 *
 * The CENTRE goes into `aEnds.xy` only. `aEnds.zw` is NOT set to the centre —
 * it now carries the inner radius and the sweep — which is exactly why the
 * vertex shader has to force `len` and `dir` rather than deriving them from
 * `b - a` the way it does for a segment.
 *
 * *** DO NOT WIRE THIS UNTIL THE SHADER FORCES `len`. *** The pulse ring
 * writer in ArtTab duplicates the centre into `aEnds.zw`, and that is what
 * makes `delta` zero and `len` zero today. Writing an inner radius of 0 there
 * instead leaves `delta = -centre`, so `len` becomes the distance from the
 * ORIGIN: the quad expands along a hundreds-of-pixels axis, `t` starts varying,
 * and the gradient and dash branches wake up on an instance that is supposed to
 * be flat. The encoding and the `len`/`dir` override are one change in two
 * files and must land together — which is why this ships unwired, with tests,
 * and Task 3 flips the shader and the writer in the same commit.
 */
export function writeDisc(out, o, {
  cx, cy, rOuter, rInner = 0, sweepStart = 0, sweepEnd = 0, falloffInner = 0,
  rgb, hsl, alpha, flags = 0,
  // A MID GRADIENT STOP: { at, rgb|hsl, alpha }. Omit it and every float it
  // would use is written zero, so a disc without one is byte-identical to the
  // discs this file wrote before step 6 — asserted by a test, because "the old
  // path is untouched" is exactly the claim that rots silently.
  mid = null,
  // The shadow's OWN colour, for a disc drawn under a ctx.shadowBlur. The blur
  // RADIUS still travels in `flags` (packFlags' glow byte) like a segment's;
  // this is only the colour, which a disc has no other slot for. Omit it and
  // float 17 is written zero — and the glow term is switched off by
  // step(0.001, vGlow) anyway, so a disc without a blur is unaffected.
  shadowHsl = null,
  // The outer stop's extrapolation factor — see DISC_OFF.outerK. Defaults to 0,
  // which means "outer == mid": the conservative flat tail, so a caller that
  // omits it is never silently given a wrong colour.
  outerK = 0,
  // The alpha at the OUTER rim. Only meaningful alongside `mid`; the canvas
  // gradient this models ends fully transparent, which is why it defaults to 0
  // rather than to `alpha`.
  outerAlpha = 0,
}) {
  out[o + EDGE_OFF.ax] = cx;
  out[o + EDGE_OFF.ay] = cy;
  out[o + DISC_OFF.inner] = rInner;
  out[o + DISC_OFF.sweepEnd] = sweepEnd;
  // One colour in the c0 slot; the shader reads no other stop for a disc.
  // `hsl` takes the same colour objects every other writer here takes, so a
  // call site never has to convert by hand — that conversion is exactly where
  // a second, drifting implementation would appear.
  if (hsl) writeHslRgb(out, o + EDGE_OFF.c0, hsl);
  else {
    out[o + EDGE_OFF.c0] = rgb[0];
    out[o + EDGE_OFF.c0 + 1] = rgb[1];
    out[o + EDGE_OFF.c0 + 2] = rgb[2];
  }
  out[o + DISC_OFF.falloffInner] = falloffInner;
  out[o + EDGE_OFF.shadow] = shadowHsl ? packHsl(shadowHsl) : 0;
  for (const k of DISC_RESERVED) out[o + k] = 0;
  if (mid) {
    out[o + DISC_OFF.midStop] = mid.at;
    if (mid.hsl) writeHslRgb(out, o + DISC_OFF.midColor, mid.hsl);
    else {
      out[o + DISC_OFF.midColor] = mid.rgb[0];
      out[o + DISC_OFF.midColor + 1] = mid.rgb[1];
      out[o + DISC_OFF.midColor + 2] = mid.rgb[2];
    }
    // The three stops the ramp actually has. The alpha slots were always here —
    // discs simply wrote them flat — so the alpha half of a three-stop ramp
    // costs no float at all.
    out[o + DISC_OFF.outerK] = outerK;
    out[o + EDGE_OFF.alphas] = packAlphas(alpha, mid.alpha, outerAlpha);
  } else {
    out[o + DISC_OFF.outerK] = 0;
    out[o + DISC_OFF.midStop] = 0;
    out[o + DISC_OFF.midColor] = 0;
    out[o + DISC_OFF.midColor + 1] = 0;
    out[o + DISC_OFF.midColor + 2] = 0;
    // All three alphas the same, so the gradient degenerates to flat whichever
    // branch the shader takes.
    out[o + EDGE_OFF.alphas] = packAlphas(alpha, alpha, alpha);
  }
  out[o + EDGE_OFF.width] = discWidth(rOuter);
  out[o + EDGE_OFF.flags] = flags;
  out[o + DISC_OFF.sweepStart] = sweepStart;
}

/** The inverse of `writeDisc`, for the same reason `unpackFlags` exists: the
 *  harness and the tests decode through this rather than restating `+ 14`. */
export function readDisc(data, o) {
  const width = data[o + EDGE_OFF.width];
  return {
    cx: data[o + EDGE_OFF.ax],
    cy: data[o + EDGE_OFF.ay],
    rOuter: Math.abs(width) * 0.5,
    rInner: data[o + DISC_OFF.inner],
    sweepStart: data[o + DISC_OFF.sweepStart],
    sweepEnd: data[o + DISC_OFF.sweepEnd],
    falloffInner: data[o + DISC_OFF.falloffInner],
    alpha: unpackAlphas(data[o + EDGE_OFF.alphas]).a0,
    // `null` rather than a zeroed object when there is no mid stop, so a caller
    // cannot read a stop that was never written as one sitting at 0.
    mid: data[o + DISC_OFF.midStop] > 0
      ? {
        at: data[o + DISC_OFF.midStop],
        rgb: [
          data[o + DISC_OFF.midColor],
          data[o + DISC_OFF.midColor + 1],
          data[o + DISC_OFF.midColor + 2],
        ],
        alpha: unpackAlphas(data[o + EDGE_OFF.alphas]).a1,
        outerK: data[o + DISC_OFF.outerK],
      }
      : null,
    outerAlpha: unpackAlphas(data[o + EDGE_OFF.alphas]).a2,
    isDisc: isDisc(width),
  };
}

/**
 * The property the whole encoding rests on, as a function a test can call:
 * every field this repurposes lives at an offset the SEGMENT path also uses,
 * so the two must be told apart by the width sign alone and by nothing else.
 *
 * Returns the list of violated invariants, empty when sound.
 */
export function discEncodingInvariant(data, o) {
  const bad = [];
  const width = data[o + EDGE_OFF.width];
  if (!isDisc(width)) { bad.push('not a disc: width must be <= 0'); return bad; }
  if (data[o + DISC_OFF.inner] < 0) bad.push('inner radius is negative');
  if (data[o + DISC_OFF.inner] > Math.abs(width) * 0.5) bad.push('inner radius exceeds outer');
  if (data[o + DISC_OFF.sweepEnd] < 0) bad.push('sweep end is negative');
  if (data[o + DISC_OFF.falloffInner] < 0) bad.push('falloff inner is negative');
  // A mid stop AT the rim or outside it is not a ramp, it is a division by
  // ~zero in the shader's second span. A stop at exactly 0 is how "no mid stop"
  // is spelled, so the open interval is the whole of the valid range.
  const midStop = data[o + DISC_OFF.midStop];
  if (midStop < 0 || midStop >= 1) {
    if (midStop !== 0) bad.push('mid stop is outside (0,1)');
  }
  // Colour with no stop is the failure that draws NOTHING wrong and means the
  // writer changed while the reader did not — worth naming rather than letting
  // it read as a disc that simply has no ramp.
  if (midStop === 0) {
    for (let i = 0; i < 3; i++) {
      if (data[o + DISC_OFF.midColor + i] !== 0) {
        bad.push('mid colour set with no mid stop');
        break;
      }
    }
  }
  for (const k of DISC_RESERVED) {
    if (data[o + k] !== 0) bad.push(`reserved float ${k} is not zero`);
  }
  return bad;
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
                          glowQuant = GLOW_QUANT_SRC_OVER, taper = false) {
  const p = Math.max(0, Math.min(255, Math.round(dashPeriod)));
  // SEVEN bits, not eight: bit 7 of this byte now carries the terminal-taper
  // flag, exactly as bit 7 of the glow byte carries isOrtho. Every dash duty
  // in this codebase is <= 8 ([4,3] [8,4] [3,4] [4,6] [5,4] [3,6] [3,5] [6,8]), so
  // nothing loses range. The clamp is to 127 rather than 255 so a caller with
  // an out-of-range duty cannot forge the flag.
  const d = Math.max(0, Math.min(127, Math.round(dashDuty))) + (taper ? 128 : 0);
  const g = Math.max(0, Math.min(127, Math.round(glow * glowQuant))) + (isOrtho ? 128 : 0);
  return p + d * 256 + g * 65536;
}

/** The inverse of `packFlags`, mirroring exactly what `EDGE_VERT` unpacks
 *  (dashPeriod via mod/floor, the duty byte's top bit split off as the taper
 *  flag, glow's top bit split off as isOrtho, the rest divided by the
 *  material's `uGlowQuant`). Exported so `artEdges.test.js` cannot drift from
 *  the shader's arithmetic — see `EDGE_VERT` for the GLSL twin of this
 *  function. */
export function unpackFlags(packed, glowQuant = GLOW_QUANT_SRC_OVER) {
  const gByte = Math.floor(packed / 65536);
  const dByte = Math.floor((packed / 256) % 256);
  return {
    dashPeriod: Math.floor(packed % 256),
    dashDuty: dByte % 128,
    taper: dByte >= 128,
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
 *
 * ── alphas, and why it is PER POINT ───────────────────────────────────────
 *
 * `alphas` is optional. Left null, every instance carries
 * `packAlphas(alpha, alpha, alpha)` computed ONCE outside the loop, exactly
 * as this function always did — byte for byte.
 *
 * Passed a Float32Array of length >= m, it holds one alpha PER POINT and
 * segment i is packed `(alphas[i], midpoint, alphas[i+1])`. The three-stop
 * gradient edgeFrag already interpolates along every segment then carries a
 * ramp along the whole tessellated chord, at no cost in floats: the
 * instances already exist and the stops were simply all equal.
 *
 * PER POINT, NOT PER SEGMENT, and that is load-bearing. It makes segment i's
 * END stop and segment i+1's START stop the same number BY CONSTRUCTION, so
 * the ramp is C0 across every joint — the same discipline `phase` above
 * follows, and for the same reason. A per-segment array would let adjacent
 * instances disagree at the seam, and under `lighter` a disagreement at a
 * joint beads; 24 of them read as a staircase.
 *
 * The mid stop is the ARITHMETIC MEAN of its two ends, which reconstructs a
 * linear ramp exactly. A caller composing two linear ramps (the prism
 * multiplies a depth cue by a root taper) feeds a quadratic, whose error
 * under this reconstruction is bounded by |f''|h^2/8 per segment — far under
 * the 1/255 packAlphas quantises to anyway. Do not sample the true midpoint
 * separately without measuring first.
 */
export function writePolyline(state, pts, m, rgb, alpha, width, flags,
                              phase0 = 0, alphas = null, rgbs = null) {
  const cap = edgeCapacity(state);
  const data = state.data;
  // Hoisted for the scalar path exactly as before — ONE packAlphas call for
  // the whole polyline. The ramped path cannot hoist it and pays per segment,
  // which is the only reason this is a branch rather than an unconditional
  // rewrite: the prism writes ~74000 instances in its worst frame.
  const packed = alphas === null ? packAlphas(alpha, alpha, alpha) : 0;
  // `rgb` is still the fallback and still the ONLY colour most callers pass;
  // `rgbs`, when given, is 3 floats per POINT and segment i reads points i and
  // i+1, so the ramp is C0 across every joint exactly as the alphas are.
  let written = 0;
  let phase = phase0;
  for (let i = 0; i + 1 < m; i++) {
    if (state.count >= cap) { state.dropped += (m - 1) - i; break; }
    const o = state.count * EDGE_STRIDE;
    data[o]     = pts[i * 2];
    data[o + 1] = pts[i * 2 + 1];
    data[o + 2] = pts[i * 2 + 2];
    data[o + 3] = pts[i * 2 + 3];
    // PER-POINT COLOUR, the exact twin of the per-point alpha below.
    //
    // These three slots have ALWAYS been a three-stop gradient that the
    // fragment shader interpolates along the segment; writing one rgb into all
    // three degenerates it to flat, which is what every caller did and what
    // made the prism's travelling wave read as "a light shining through
    // stained glass" -- brightness moving under a colour pinned to the wire.
    // Passing `rgbs` lights the gradient up. It costs no floats: the stops
    // were already in the layout and already bound as aC0/aC1/aC2.
    if (rgbs === null) {
      data[o + 4]  = rgb[0]; data[o + 5]  = rgb[1]; data[o + 6]  = rgb[2];
      data[o + 7]  = rgb[0]; data[o + 8]  = rgb[1]; data[o + 9]  = rgb[2];
      data[o + 10] = rgb[0]; data[o + 11] = rgb[1]; data[o + 12] = rgb[2];
    } else {
      const j0 = i * 3, j1 = j0 + 3;
      data[o + 4]  = rgbs[j0];     data[o + 5]  = rgbs[j0 + 1]; data[o + 6]  = rgbs[j0 + 2];
      data[o + 7]  = (rgbs[j0]     + rgbs[j1])     * 0.5;
      data[o + 8]  = (rgbs[j0 + 1] + rgbs[j1 + 1]) * 0.5;
      data[o + 9]  = (rgbs[j0 + 2] + rgbs[j1 + 2]) * 0.5;
      data[o + 10] = rgbs[j1];     data[o + 11] = rgbs[j1 + 1]; data[o + 12] = rgbs[j1 + 2];
    }
    // PER-POINT alphas. Segment i's END stop is segment i+1's START stop BY
    // CONSTRUCTION, so the ramp is C0 across every joint.
    data[o + 13] = alphas === null
      ? packed
      : packAlphas(alphas[i], (alphas[i] + alphas[i + 1]) * 0.5, alphas[i + 1]);
    data[o + 14] = width;
    data[o + 15] = flags;
    data[o + 16] = phase;
    // Float 17 is the disc shadow colour. A segment has none, and the buffer is
    // reused frame to frame, so leaving it would hand the next instance to land
    // here a stale colour.
    data[o + 17] = 0;
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

/** The CSS Color 4 HSL-to-RGB reference algorithm, as a GLSL snippet. It used
 *  to live only in the fragment shader; step 7 needs it in the vertex shader
 *  too, to unpack a disc's shadow colour where the attribute is still exact.
 *  Interpolating the PACKED float across the quad would not be: 6.6e6 sits
 *  where a float32 ulp is 0.5, so a floor()/mod() unpack in the fragment could
 *  land a hue one step out. Unpack early, vary the small numbers. */
const HSL2RGB_GLSL = /* glsl */`
  vec3 hsl2rgb(float h, float s, float l) {
    float a = s * min(l, 1.0 - l);
    vec3 k = mod(vec3(0.0, 8.0, 4.0) + h / 30.0, 12.0);
    return l - a * clamp(min(k - 3.0, 9.0 - k), -1.0, 1.0);
  }
`;

// ── The blurred DISC ────────────────────────────────────────────────────────
//
// A canvas shadow convolves the SHAPE with a gaussian of sigma = blur/2. For a
// stroke the shader measures distance to the SEGMENT and uses the blurred-line
// peak, w / (sigma*sqrt(2pi)). Neither survives on a disc:
//
//   - `dSeg` collapses to the radius, so the gaussian peaks at the CENTRE and
//     is already down to exp(-2) = 13.5% at the rim. A blurred disc is nearly
//     flat across its interior and falls off OUTSIDE the rim.
//   - the line peak is a different law entirely. A disc's is exact and closed:
//     B(0) = 1 - exp(-R^2 / 2 sigma^2).
//
// MEASURED against polar quadrature of the true convolution: the segment law
// is wrong by up to 0.85 in absolute coverage on the radii this layer uses.
//
// The tail is an equivalent gaussian anchored on that exact peak,
// exp(-r^2 / 2(sigma^2 + k R^2)). The moment-matched k is 0.25 (a uniform disc
// has per-axis variance R^2/4) and gives a max error of 0.085; k fitted over
// the range the caller actually occupies — R/sigma in [1.25, 2], i.e. the
// conductor's 2.5 and 4 px thumbs against sigma 2 — gives 0.0289, which at
// that layer's alpha of 0.1 is 0.74 of 255, i.e. below one 8-bit level.
//
// It is a FIT over that range, not a universal law, and it degrades outside it
// (a large disc is flat-topped, not gaussian). discShadowFit() below is the JS
// twin, and its test asserts both the range and the error against the same
// numeric integral rather than against this comment.
export const DISC_SHADOW_K = 0.37;

/** The JS twin of the shader's disc-shadow term — the coverage a canvas
 *  shadow of `blur` leaves at radius `r` from the centre of a filled disc of
 *  radius `R`, before the stroke's own alpha and shadowColor's alpha. Exists so
 *  the test can hold it against a numeric integral of the true convolution
 *  rather than against the shader's comment. */
export function discShadowFit(r, R, blur) {
  const sig2 = blur * blur * 0.25;
  const peak = 1 - Math.exp(-(R * R) / (2 * Math.max(sig2, 1e-6)));
  const tailVar = sig2 + DISC_SHADOW_K * R * R;
  return peak * Math.exp(-(r * r) / (2 * Math.max(tailVar, 1e-6)));
}

const EDGE_VERT = /* glsl */`
  attribute vec4 aEnds;
  attribute vec3 aC0;
  attribute vec3 aC1;
  attribute vec3 aC2;
  attribute vec3 aPack;      // x = packed alphas, y = width px, z = packed flags
  attribute float aPhase;    // px into the dash pattern at this instance's A
  attribute float aShadow;   // packed HSL of a disc's shadow colour; 0 on a segment

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
  varying vec3  vShadowRGB;
  varying float vPhase;      // px of arc length from the PATH's start, at A
  varying float vGlow;
  varying float vIsOrtho;    // 0.0 or 1.0 — same for all 4 verts of an instance
  varying float vTaper;      // 0.0 or 1.0 — bit 7 of the dash-duty byte
  varying float vIsDisc;     // ditto: a disc or ring, flagged by a negative width
  // The disc branch's repurposed floats. See DISC_OFF in SphereEdges.js.
  // x = inner radius px (0 = filled)   y = sweep start rad
  // z = sweep end rad (0 = full circle) w = falloff inner radius px (0 = none)
  // EVERY component is multiplied by isDisc in the vertex shader, so a segment
  // carries vec4(0) here and every branch below it collapses to what it was.
  varying vec4  vDisc;
  // xyz = the MID gradient stop's colour   w = its position, 0..1 across the
  // radius (0 = no mid stop, the flat single colour every disc had before step
  // 6). Multiplied by isDisc for the same reason vDisc is: a SEGMENT carries
  // vec4(0) and every expression that reads this collapses to what it was.
  varying vec4  vDiscMid;
  // The outer stop's extrapolation factor. See DISC_OFF.outerK — the ramp's
  // three lightnesses are collinear in RGB, so the third colour is derived
  // rather than stored.
  varying float vOuterK;

${HSL2RGB_GLSL}

  void main() {
    vec2 a = aEnds.xy;

    // Read the disc flag FIRST: a disc's aEnds.zw is not a second endpoint, it
    // is (innerRadius, sweepEnd), so deriving delta from it would give a
    // hundreds-of-pixels axis pointing at the ORIGIN. Forcing delta to zero
    // here is what keeps that data out of the segment path — and it is the
    // half of the encoding that lives in GLSL. See writeDisc().
    float isDiscV = step(aPack.y, 0.0);
    vec2 delta = mix(aEnds.zw - a, vec2(0.0), isDiscV);
    float len = length(delta);
    vec2 dir = len > 1e-6 ? delta / len : vec2(1.0, 0.0);
    vec2 nrm = vec2(-dir.y, dir.x);
    vDisc = vec4(aEnds.z, aPhase, aEnds.w, aC1.x) * isDiscV;
    vDiscMid = vec4(aC2, aC1.y) * isDiscV;
    vOuterK = aC1.z * isDiscV;

    // Unpack. Every divisor is a power of two and every field an integer, so
    // these are exact for a float32 payload below 2^24. The glow byte's top
    // bit (>=128) is isOrtho, not magnitude — see packFlags/unpackFlags in
    // SphereEdges.js, which this mirrors exactly.
    float f = aPack.z;
    float dashPeriod = floor(mod(f, 256.0));
    // The duty byte is SEVEN bits plus a flag, mirroring the glow byte above:
    // bit 7 is the terminal-taper opt-in. See packFlags/unpackFlags.
    float dutyByte   = floor(mod(f / 256.0, 256.0));
    float taperBit   = step(127.5, dutyByte);
    float dashDuty   = mod(dutyByte, 128.0);
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
    float isDisc = isDiscV;
    float halfW = abs(aPack.y) * 0.5;

    // A disc's shadow colour, unpacked here where aShadow is still exact.
    // Every divisor is a power of two, mirroring packHsl() in SphereEdges.js.
    float sl = floor(aShadow / 65536.0);
    float srem = aShadow - sl * 65536.0;
    float ss = floor(srem / 512.0);
    vShadowRGB = hsl2rgb(srem - ss * 512.0, ss / 100.0, sl / 100.0);

    // Pad for the antialiasing shoulder and for however far the glow reaches.
    // The quad is expanded along the segment as well as across it, because a
    // blur bleeds past a butt cap; the fragment shader puts the cap back.
    //
    // A disc's glow reaches further than a segment's, because its tail variance
    // carries the RADIUS as well as the blur. Falling below 1/255 of the peak
    // needs r^2 > 2(g^2/4 + k R^2) ln(255), i.e. sqrt(2.77 g^2 + 4.1 R^2) at
    // k = 0.37 — which exceeds halfW + 1 + 1.66g once R gets large, so the
    // segment's pad would clip it. step() keeps a glowless disc EXACTLY where
    // it was: every disc drawn before step 7 carries glow = 0, and a 3x wider
    // quad on all thirteen of them would be a real change smuggled in here.
    float discReach = step(0.001, glow)
      * sqrt(2.77 * glow * glow + 4.1 * halfW * halfW);
    float pad = halfW + 1.0 + mix(glow * uGlowReach, discReach, isDiscV);

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
    vTaper = taperBit;
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

    // A DISC carries its own shadow colour in float 17, and its ctx.shadowColor
    // is an opaque hsl(), so both are overridden here. Every disc drawn before
    // step 7 has glow = 0, where step(0.001, vGlow) zeroes the whole shadow
    // term, so this cannot reach any of them.
    shadowCol = mix(shadowCol, vShadowRGB, vIsDisc);
    shadowAlpha = mix(shadowAlpha, 1.0, vIsDisc);
`;

// Additive: one flat style for the whole layer. The resonance core is the only
// stroke here that HAS a shadow — the halo sets shadowBlur = 0 and the prism
// chords set none — and its ctx.shadowColor was a flat gold, not the gradient
// colour and not a function of anything per-instance. Those other strokes carry
// glow = 0, and the `step(0.001, vGlow)` below already zeroes the whole shadow
// term for them, so no per-instance flag is needed to tell them apart.
//
// `shadowAlpha` here is ctx.shadowColor's alpha ALONE. It used to read
// `* a` as well — the stroke's own alpha, which rides through a canvas shadow
// because the shadow is the blurred SHAPE bitmap tinted by shadowColor. That
// factor was correct, but it was applied HERE only because Task 5 had no
// authority to move the source-over mesh's shipped pixels, which carry the same
// omission. Task 6c had that authority: `* a` now lives in the SHARED amplitude
// line below and serves both materials. Putting it back here as well would
// square it and silently halve this layer's glow — the single most likely way
// to get this change wrong, and the reason a test asserts this snippet does not
// mention `a` at all.
const SHADOW_ADDITIVE = /* glsl */`
    float shadowAlpha = ${glslFloat(RESONANCE_SHADOW_ALPHA)};
    vec3 shadowCol = ${glslRgb255(RESONANCE_GOLD)};

    // A DISC carries its own shadow colour in float 17, and its ctx.shadowColor
    // is an opaque hsl(), so both are overridden here. Every disc drawn before
    // step 7 has glow = 0, where step(0.001, vGlow) zeroes the whole shadow
    // term, so this cannot reach any of them.
    shadowCol = mix(shadowCol, vShadowRGB, vIsDisc);
    shadowAlpha = mix(shadowAlpha, 1.0, vIsDisc);
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

// Exported so tests can build the REAL source rather than assert against a
// hand-copied string. It is compiled twice, once per material, from this one
// body -- see createEdgeLayer. Exporting costs nothing at runtime.
export const edgeFrag = (shadow, composite) => /* glsl */`
  precision highp float;

  // Time-based, not per-edge: orthoHue(now) is the same for every ortho edge
  // in a frame, so it travels once as a uniform rather than 1 of 16 floats
  // per instance. Set from SphereEdges.syncEdgeLayer.
  uniform float uOrthoHue;

  // The terminal taper's reach in px. Per frame, not per instance — the
  // opt-in is the per-instance half (vTaper).
  uniform float uTaperPx;

  // A SCALE ON THE BEAD, AND AN INSTRUMENT RATHER THAN A FEATURE. 1 is the
  // shipped path and is EXACTLY the identity -- IEEE multiplication by 1.0 is
  // exact for every finite value -- so declaring it costs the render nothing
  // and the parity reference proves that rather than this comment asserting
  // it. 0 removes every bead and is the no-bead A/B arm.
  //
  // It exists because the arm used to be a SOURCE PATCH. _a10dash.mjs rewrote
  // the beadGate statement on disk, waited for vite, and relaunched Chrome per
  // arm -- and four launches could not beat their own noise: the same build
  // shot twice differed by MORE than either treatment arm, and the floor
  // itself swung 0.08% to 0.96% between runs. So the bead's cost is still only
  // a BOUND (under ~1% of frame ink, ~0.5% of hot pixels) and not a number.
  // A uniform makes both arms reachable inside ONE page, at one seed, on one
  // rAF cycle, which is the only way a sub-1% effect becomes measurable here.
  uniform float uBeadScale;

  // THE DASH CUT'S OWN ARM SWITCH. 1 selects the box filter, which is what
  // ships; 0 selects the hard step() the box filter replaced. Both forms stay
  // compiled in, because the alternative is what this instrument used to do --
  // rewrite the statement on disk and relaunch the browser, which is how the
  // measurement ended up under its own noise floor.
  //
  // mix(), not a branch on the uniform. A uniform branch would be uniform flow
  // and legal, but mix keeps the collapse-to-arithmetic discipline the rest of
  // this shader holds, and the shipped path stays bit-exact: mix(x, y, 1.0) is
  // x*(1-1) + y*1, and step() returns 0.0 or 1.0, so the x*0 term is exactly
  // zero rather than a rounding of one.
  uniform float uDashAA;

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
  varying float vTaper;
varying float vIsDisc;
  varying vec4  vDiscMid;
  varying float vOuterK;
  varying vec4  vDisc;       // inner r, sweep start, sweep end, falloff inner
  varying vec3  vShadowRGB;  // a disc's own shadow colour, unpacked in the vertex

  // Shared with the vertex shader, which needs it to unpack vShadowRGB. Used
  // here for the ortho shadow colour, whose saturation and lightness are
  // compile-time constants (100%, 60%); only the hue is dynamic.
${HSL2RGB_GLSL}

  void main() {
    // Screen-space footprint of the two varyings, taken FIRST: derivatives are
    // undefined inside non-uniform control flow and there are three branches
    // below. length(vec2(dFdx, dFdy)) rather than fwidth() — fwidth is the L1
    // norm and overestimates a diagonal edge by up to 41%, which shows up as
    // uniformly fatter, brighter lines.
    float pxD = max(length(vec2(dFdx(vD), dFdy(vD))), 1e-6);
    float pxA = max(length(vec2(dFdx(vAlong), dFdy(vAlong))), 1e-6);

    float t = vLen > 1e-6 ? clamp(vAlong / vLen, 0.0, 1.0) : 0.0;

    // RADIUS, ANGLE AND DASH POSITION ARE HOISTED HERE, above every branch,
    // because dFdx(dashPos) is taken two statements down and derivatives are
    // undefined inside non-uniform control flow — the same rule pxD and pxA
    // follow above. They depend only on varyings, so nothing about their
    // values changes by being computed earlier.
    //
    // The atan(0,0) guard TRAVELS WITH ang and is not left behind: atan is
    // undefined at the exact centre of every filled disc, and the resulting
    // NaN survives mix() because the spec expands mix to x*(1-a)+y*a and
    // NaN*0 is NaN. step(rG, 1e-6) adds 1.0 to x only there, giving
    // atan(0, 1) = 0. mod() rather than a conditional add, so an angle of
    // exactly 0 stays 0 instead of being pushed to 2pi and out of its own
    // sweep.
    float rG = length(vec2(vAlong, vD));
    float ang = mod(atan(vD, vAlong + step(rG, 1e-6)) + 6.283185307179586,
                    6.283185307179586);
    // ctx.setLineDash walks the path CENTRELINE, so a disc dashes on the
    // band mid radius: the boundaries come out radial, as the canvas draws
    // them. r*ang would be the fragment OWN arc length, and r varies across
    // the band, so every dash end would come out slanted.
    float rMid = (vHalfW + vDisc.x) * 0.5;
    float dashPos = mix(vPhase + t * vLen, rMid * ang, vIsDisc);
    float dpxDash = max(length(vec2(dFdx(dashPos), dFdy(dashPos))), 1e-6);

    // THE DISC'S OWN GRADIENT PARAMETER, for the radial ramps step 6 needs.
    //
    // A segment runs its gradient along the stroke. A disc has no length, so
    // t is 0 and every disc drawn before step 6 collapsed to the first stop --
    // which was exactly right, because their 2-D gradients were single-colour
    // and the falloff below did the fading. The particle glow is not: it
    // DARKENS as it fades, 82% to 65% to 50% lightness, with the knee at 0.4
    // rather than the midpoint.
    //
    // So a disc carrying a mid stop drives the SAME three-stop machinery from
    // its radial coordinate, remapped so its knee lands on the 0.5 that
    // machinery splits at. One gradient implementation, not two — this file
    // already lost a task to two implementations of one dash pattern.
    float u01 = clamp(rG / max(vHalfW, 1e-6), 0.0, 1.0);
    float hasMid = step(1e-6, vDiscMid.w) * vIsDisc;
    float knee = max(vDiscMid.w, 1e-6);
    float tDisc = u01 < knee
      ? u01 / knee * 0.5
      : 0.5 + (u01 - knee) / max(1.0 - knee, 1e-6) * 0.5;
    float tg = mix(t, tDisc, hasMid);

    // The mid and outer colours, selected the same way. The outer one is
    // EXTRAPOLATED: the ramp's three lightnesses are collinear in RGB for fixed
    // hue and saturation above l = 0.5, so it lies on the line through the
    // other two. See DISC_OFF.outerK. With vOuterK = 0 this gives outer == mid,
    // the conservative flat tail.
    vec3 gC1 = mix(vC1, vDiscMid.rgb, hasMid);
    vec3 gC2 = mix(vC2, vDiscMid.rgb + (vDiscMid.rgb - vC0) * vOuterK, hasMid);

    // Three-stop gradient, interpolated NON-premultiplied exactly as a canvas
    // linear gradient does — the colour darkens toward the rim as it fades.
    vec3 col; float a;
    if (tg < 0.5) { float u = tg / 0.5;         col = mix(vC0, gC1, u); a = mix(vAlpha.x, vAlpha.y, u); }
    else          { float u = (tg - 0.5) / 0.5; col = mix(gC1, gC2, u); a = mix(vAlpha.y, vAlpha.z, u); }

    // Box-filter coverage, not smoothstep. Edges are routinely thinner than a
    // pixel (width starts at 0.5) and a smoothstep shoulder spreads a 1px line
    // over 1.5px of ink — a systematic brightening the parity gate reads as a
    // one-sided bias. This form integrates to the true width at any scale.
    float side = clamp((vHalfW - abs(vD)) / pxD + 0.5, 0.0, 1.0);
    // Butt caps, matching ctx's default lineCap.
    float cap  = clamp(vAlong / pxA + 0.5, 0.0, 1.0)
               * clamp((vLen - vAlong) / pxA + 0.5, 0.0, 1.0);
    // A disc is the SAME box filter on radial distance. Its two endpoints
    // coincide, so vAlong and vD are just the two components of the offset from
    // the centre. No cap term — a disc has no ends. Everything below is
    // selected with mix() rather than an if, so the count of non-uniform
    // branches under the derivative reads at the top of main() stays where it
    // was, and so a SEGMENT (which carries vDisc = vec4(0)) collapses through
    // each one to exactly the arithmetic it had before any of this existed.
    // Same radius the gradient above already measured -- one r, not two that
    // could drift.
    float r = rG;
    float disc = clamp((vHalfW - r) / pxD + 0.5, 0.0, 1.0);

    // ANNULUS. The hole is the same box filter with the sign flipped. The
    // step() guard is load-bearing, not defensive: with vDisc.x = 0 the inner
    // term evaluates to 0.5 at the exact centre (r = 0 gives 0/pxD + 0.5), so
    // an unguarded multiply would punch a half-lit pixel through the middle of
    // every filled disc the pulse rings draw.
    float inner = clamp((r - vDisc.x) / pxD + 0.5, 0.0, 1.0);
    disc *= mix(1.0, inner, step(1e-6, vDisc.x));

    // RADIAL FALLOFF, for the halos. Flat inside vDisc.w, then LINEAR to zero
    // at the outer radius — a createRadialGradient, NOT the gaussian shoulder
    // the glow below models. The two are different falloffs AND different
    // amplitude laws; substituting one for the other matches at exactly one
    // radius and is wrong at every other.
    float ramp = 1.0 - clamp((r - vDisc.w) / max(vHalfW - vDisc.w, 1e-6), 0.0, 1.0);
    disc *= mix(1.0, ramp, step(1e-6, vDisc.w));

    // ARC SWEEP, for the ghost ring, whose sweep angle IS its animation.
    // atan(vD, vAlong) with vD along nrm and vAlong along dir reproduces the
    // canvas angle exactly: dir is (1,0) for a disc and nrm is (0,1), which in
    // screen space points DOWN, so increasing angle runs the same way
    // ctx.arc does with anticlockwise unset.
    //
    // The shoulder is pxD/r RADIANS, i.e. one pixel of ARC LENGTH. A constant
    // radian shoulder would be a radius-dependent pixel shoulder — thick on a
    // small ring, invisible on a large one.
    // Two hazards, both guarded rather than branched:
    //   atan(0, 0) is UNDEFINED, and it is reached at the exact centre of every
    //   filled disc. The step() adds 1.0 to x only there, giving atan(0, 1) = 0.
    //   Without it a NaN escapes — and mix(x, NaN, 0.0) is NaN, not x, because
    //   the spec expands mix to x*(1-a) + y*a and NaN*0 is NaN. A segment would
    //   have inherited it through the collapse below.
    //   mod() rather than a conditional add, so an angle of exactly 0 stays 0
    //   instead of being pushed to 2pi and out of its own sweep.
    // ang is hoisted to the top of main(); see the note there for the
    // atan(0,0) guard and why it has to be computed in uniform flow.
    float aaAng = pxD / max(r, 1e-6);
    float sweep = clamp((ang - vDisc.y) / aaAng + 0.5, 0.0, 1.0)
                * clamp((vDisc.z - ang) / aaAng + 0.5, 0.0, 1.0);
    disc *= mix(1.0, sweep, step(1e-6, vDisc.z));

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
    // The dash position is arc length along whatever the instance IS: px from
    // the path start for a segment, r*theta around the circumference for a
    // disc. The segment form cannot serve a disc — vLen is 0 there, so
    // vPhase + t*vLen is a per-instance CONSTANT and the dash would switch the
    // whole ring uniformly on or off instead of dashing around it.
    // r*ang would be the fragment's OWN arc length, and r varies across the
    // band — so the same angle sits at different dash positions on the inner
    // and outer edge and every dash end comes out SLANTED. Measured on an
    // 8px band at r=40 that is about a pixel of skew, and it is visible.
    // ctx.setLineDash walks the path's CENTRELINE, so use the band's mid
    // radius: the dash boundaries come out radial, as the canvas draws them.
    // THE DASH BOUNDARY, BOX-FILTERED. It was a hard step(): the sides and
    // the caps of these lines were antialiased and the dash cut alone was
    // not, which is what read as stair-stepping on a rotating chord.
    //
    // dashP IS GUARDED AND THE GUARD IS LOAD-BEARING. mod() used to run only
    // inside the branch below; it now runs on every instance, including the
    // solid ones — and the prism packs dashPeriod = 0. mod(x, 0.0) divides
    // by zero, and a NaN here would escape through the mix()/step() collapse
    // into the whole additive layer.
    //
    // sd is the SIGNED distance to the on-interval [0, D) of a period P:
    // positive inside a dash, negative in a gap. ONE value serves two jobs —
    // the cut here, and the bead falloff below.
    //
    // Box filter, NOT smoothstep. A smoothstep shoulder spreads a 1px line
    // over 1.5px and the parity gate reads it as a one-sided brightening;
    // this form integrates to the true D/P duty and is ink-neutral by
    // construction. It also degrades correctly: as a chord rotates near
    // edge-on and dpxDash approaches P, the mask converges to a constant
    // D/P grey instead of aliasing against the pixel grid.
    float dashP = max(vDash.x, 1e-3);
    float dashD = vDash.y;
    float dashM = mod(dashPos, dashP);
    float sd = dashM < dashD
      ?  min(dashM, dashD - dashM)
      : -min(dashM - dashD, dashP - dashM);
    float dashMask = mix(step(0.0, sd), clamp(sd / dpxDash + 0.5, 0.0, 1.0), uDashAA);
    if (vDash.x > 0.0) core *= dashMask;

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
    // THE BEAD. The ortho bridges carried a real halo already -- orthoGlow is
    // 10 +/- 4px with the opaque isOrtho shadow colour -- but it was NOT gated
    // by the dash: glowSeg came from the segment distance alone, so a
    // continuous 6-14px haze ran the whole chord with hard chips of core
    // punched on top of it. That is what made them read as flat 2D overlays
    // rather than rays suspended in the volume.
    //
    // The fix is NOT a gate on the glow, which would chop the halo at the same
    // boundary as the core. It is to extend the distance the EXISTING gaussian
    // already integrates: zero inside a dash, growing through the gap, so each
    // dash gets its own blurred envelope and neighbouring halos overlap softly
    // -- which is what a blurred dashed line physically looks like, and the
    // same approximation this file already makes for segment ends.
    //
    // sd is the one the dash cut above computed. One measurement, not two that
    // could drift.
    //
    // TWO GATES, BOTH LOAD-BEARING. vIsOrtho keeps the continuous haze on
    // dashed SPECTRAL bridges, which is an author ruling -- the 1-2%
    // atmospheric bridge grounds them. (1.0 - vIsDisc) keeps beads off pulse
    // rings, which are dashed DISCS and would otherwise have their halos
    // chopped into arcs.
    float dDash = max(0.0, -sd);
    float beadGate = uBeadScale * vIsOrtho * step(0.001, vDash.x) * (1.0 - vIsDisc);
    float dOut = max(max(0.0, max(-vAlong, vAlong - vLen)), dDash * beadGate);
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
    //
    // (No backticks below this point: these lines live INSIDE the template
    // literal that builds this shader, so one would end the string.)
    //
    // a is the STROKE's own alpha, and it belongs here for both materials. A
    // canvas shadow is not a separately-coloured shape: it is the blurred SHAPE
    // bitmap tinted by shadowColor, so the shape's alpha rides through it and a
    // stroke drawn at alpha a casts a shadow a times as strong. Measured on a
    // bare canvas — lineWidth 4.2, shadowBlur 22.5, shadowColor alpha 0.9,
    // sampled 6px off the line — R reads 5, 11, 17, 23, 29 for stroke alphas
    // 0.2 … 1.0, each the 8-bit truncation of alpha * 29. Exactly linear.
    //
    // It is a and not topA: coverage is the shape being convolved and is
    // already inside the 1.5958 * halfW / blur term, so multiplying by core as
    // well would convolve it twice. Not topA, not core.
    //
    // Measured against a 2D hybrid at four stroke alphas before this factor
    // existed, the GL halo was FLAT in a where the canvas's is linear in it:
    // ortho read 8.04 / 3.39 / 1.72 / 0.99 times the canvas at a = 0.15 / 0.30
    // / 0.50 / 1.00, fused 6.19 / 3.32 / 2.00 / 1.04 — i.e. 1/a too bright,
    // agreeing at a = 1 where 1/a is 1. See the Task 6c report.
    float peak = min(shadowAlpha * a * 1.5958 * vHalfW / max(vGlow, 1e-3), 1.0);
    float glowSeg = peak * exp(-2.0 * g * g);

    // THE DISC's shadow — a different distance, a different peak and a
    // different tail. See DISC_SHADOW_K. sigma = vGlow/2 throughout, so
    // R^2/2sigma^2 is 2R^2/vGlow^2 and the tail variance is vGlow^2/4 + k R^2.
    // The stroke alpha and shadowAlpha ride through for the reason given above:
    // canvas shadow is the blurred SHAPE bitmap tinted by shadowColor.
    float sig2 = vGlow * vGlow * 0.25;
    float peakDisc = 1.0 - exp(-vHalfW * vHalfW / (2.0 * max(sig2, 1e-6)));
    float tailVar = sig2 + ${glslFloat(DISC_SHADOW_K)} * vHalfW * vHalfW;
    float glowDisc = shadowAlpha * a * peakDisc
                   * exp(-(r * r) / (2.0 * max(tailVar, 1e-6)));

    // THE TERMINAL TAPER. The shoulder fades to nothing over the last
    // uTaperPx at EACH end, so a wire dissolves into the node it reaches
    // instead of stacking a full-strength 9px halo on a 7-10px dot.
    //
    // On the GLOW only. core above is untouched, so the thread runs solid to
    // the exact centre and several wires visibly converge on one point --
    // which is what this was for, and what a fade on core would destroy.
    //
    // Multiplied by (1.0 - vIsDisc) as well as vTaper: a ring shares this
    // buffer and has no ends to taper, and its vAlong/vLen are a radius and a
    // zero. mix() rather than a branch, so an instance without the flag
    // collapses to exactly the arithmetic it had before this existed.
    float taperT = clamp(min(vAlong, vLen - vAlong) / max(uTaperPx, 1e-3), 0.0, 1.0);
    float taper = mix(1.0, taperT, vTaper * (1.0 - vIsDisc));
    float glow = mix(glowSeg, glowDisc, vIsDisc) * step(0.001, vGlow) * taper;

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
  geometry.setAttribute('aShadow', new THREE.InterleavedBufferAttribute(buffer, 1, 17));
  geometry.instanceCount = 0;

  const uniforms = {
    uResolution: { value: new THREE.Vector2(1, 1) },
    uGlowReach:  { value: GLOW_REACH },
    uGlowQuant:  { value: spec.glowQuant },
    uOrthoHue:   { value: 0 },
    uTaperPx:    { value: 0 },
    // 1, not 0: this one's identity is 1, so a caller that never sets it gets
    // the shipped bead. See the declaration in edgeFrag.
    uBeadScale:  { value: 1 },
    // 1 = box filter = shipped. See the declaration in edgeFrag.
    uDashAA:     { value: 1 },
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
  // 0 is what a caller that has not opted in gets — but it does NOT mean
  // "taper disabled", and an earlier version of this comment said it did.
  // The shader divides by max(uTaperPx, 1e-3), so at 0 the taper factor is 1
  // INSIDE the segment and 0 outside it: a hard clip of the glow at the butt
  // caps rather than a no-op. Harmless only because no additive writer sets
  // the opt-in bit today, which is precisely the case the old wording
  // promised to cover. A layer that wants the taper genuinely off must not
  // set the bit.
  layer.uniforms.uTaperPx.value = state.taperPx ?? 0;
  // `?? 1` and not `?? 0`, for the reason the declaration gives: 1 is the
  // identity and the shipped path, 0 is the no-bead arm. Getting this default
  // backwards would silently strip the beads from every frame the app draws.
  layer.uniforms.uBeadScale.value = state.beadScale ?? 1;
  // Same `?? 1` reasoning: 1 is the shipped box filter, 0 is the hard-cut arm.
  layer.uniforms.uDashAA.value = state.dashAA ?? 1;

  layer.geometry.instanceCount = count;
  layer.buffer.addUpdateRange(0, count * EDGE_STRIDE);
  layer.buffer.needsUpdate = true;
}

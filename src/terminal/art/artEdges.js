// artEdges.js — the parameters behind the sphere's edge layers.
//
// Step 4 moves edges, the resonance edge and the prism chords onto the GPU.
// These numbers were inline in ArtTab's draw loop; they are lifted here so the
// shader and the 2D code it replaces provably read one source of truth, and so
// the animated curves are testable without a canvas.
//
// Nothing here is re-derived. Where a source comment disagreed with the
// arithmetic beside it, the arithmetic won and the discrepancy is recorded —
// step 3 found three such comments.

// TWO imports, both pointing one way: artNodes.js and artColor.js each import
// nothing, so there is no cycle. The depth cue lives in artNodes because the NODE
// DISCS use it, and prismChordCue below depends on exact agreement. writeHsl lives
// in artColor to unblock the import without closing a cycle back through
// SphereEdges.js. Copying either formula here would be the second implementation
// this file's header warns about.
import { depthCueAlpha } from './artNodes.js';
import { writeHsl } from './artColor.js';

// ── Base edges ──────────────────────────────────────────────────────────────

export const SPECTRAL_DASH = [4, 3];   // computed spectral bridges
export const ORTHO_DASH = [8, 4];      // orthogonal bridge, the loud one

// Gradient end weights. The two ends of an edge are NOT symmetric, and the
// asymmetry swings with edge strength: end A fades as strength rises while end
// B brightens. A shader that fades symmetrically looks plausible and is wrong.
export const EDGE_END_A_WEIGHT = 0.4;  // a0 = base * (1 - strength * 0.4)
export const EDGE_END_B_BASE = 0.6;    // a2 = base * (0.6 + strength * 0.4)
export const EDGE_END_B_WEIGHT = 0.4;

/**
 * The three stops of an edge's linear gradient, at t = 0, 0.5, 1.
 *
 * Colours are passed through untouched — this module does not care whether
 * they are HSL triples or anything else, only where they sit and how opaque
 * they are. A canvas gradient interpolates NON-premultiplied rgba between
 * adjacent stops, so a shader reproducing this must interpolate colour and
 * alpha separately.
 */
export function edgeStops(colA, colB, cMid, baseAlpha, pulseBoost, strength) {
  const base = baseAlpha + pulseBoost;
  return [
    { t: 0,   color: colA, a: base * (1 - strength * EDGE_END_A_WEIGHT) },
    { t: 0.5, color: cMid, a: base },
    { t: 1,   color: colB, a: base * (EDGE_END_B_BASE + strength * EDGE_END_B_WEIGHT) },
  ];
}

/**
 * Stroke width in px for a base edge, from the draw loop verbatim.
 *
 * Lifted out of ArtTab because the ring layer's discriminator depends on its
 * SIGN: rings share the edge instance buffer and are told apart by a negative
 * width (see SphereEdges.js's header), which is only sound while this can never
 * return one. That invariant is testable only against the real formula, so the
 * real formula has to have a home a test can import.
 *
 * `spectralSim` and `fuseCos` are already 0 when the edge is neither, so the
 * loop's `isSpectral ? cosSim * 1.2 : 0` ternaries collapse into the products
 * with no change in value. `isOrtho` carries no magnitude and stays a flag.
 *
 * Provably > 0 over the real domain: the leading 0.5 is positive, every other
 * term is non-negative there, and `avgScale` is strictly positive (it is
 * focal / (focal + rz * sphereR) with focal = 2.8 * sphereR and rz in [-1, 1]).
 */
export function edgeLineWidth(maxEnergy, pulse, spectralSim, fuseCos, isOrtho, avgScale) {
  return (0.5 + maxEnergy * 0.8 + pulse * 1.8 + spectralSim * 1.2 + fuseCos * 2.0
    + (isOrtho ? 2.0 : 0)) * avgScale;
}

/**
 * How far back from each end of a base edge the gaussian shoulder fades out,
 * in px before `ink` scaling.
 *
 * MEASURED, at a 900x700 viewport: a base wire is a 1.15-1.30px thread wearing
 * an 8.6-9.0px gaussian coat, and a node core is 7-10px. So four wires
 * arriving at a hub stack four shoulders that are each the size of the whole
 * dot, lobed by the incident angles. That -- not the geometry, which has always
 * run centre to centre -- is why a hub looked ragged.
 *
 * The CORE thread is deliberately not tapered. It runs solid to the exact
 * centre, so with the lens in front of it the convergence is visible THROUGH
 * the glass: several wires meeting at one point, which is the thing the taper
 * was asked for in the first place.
 *
 * 14 is about 1.5x a node radius: far enough that the shoulder is already gone
 * by the silhouette rather than being cut off at it.
 */
export const EDGE_TAPER_PX = 14;

// ── Orthogonal bridge — the animated rainbow edge ───────────────────────────
export const ORTHO_TIME_SCALE = 0.0008;   // Date.now() * this = the loop's `ot`
export const ORTHO_HUE_RATE = 60;         // degrees per unit of `ot`
export const ORTHO_HUE_STEP_MID = 60;     // mid stop is +60 degrees
export const ORTHO_HUE_STEP_END = 150;    // end stop is +150
export const ORTHO_HUE_STEP_GLOW = 30;    // the glow colour is +30
export const ORTHO_GLOW_BASE = 10;
export const ORTHO_GLOW_SWING = 4;
export const ORTHO_GLOW_RATE = 3;         // × `ot`
export const ORTHO_ALPHA_BOOST = 0.3;     // added before the depth fade
export const ORTHO_MID_ALPHA_BOOST = 0.15;

// NOTE: the draw loop labels this "full rotation ~6s". It is not. The hue
// advances at 0.0008 * 60 = 0.048 deg/ms, so a full turn takes 7500ms.
export const ORTHO_ROTATION_MS = 7500;

/** Base hue of the orthogonal bridge gradient, in degrees. */
export function orthoHue(nowMs) {
  const h = (nowMs * ORTHO_TIME_SCALE * ORTHO_HUE_RATE) % 360;
  return h < 0 ? h + 360 : h;
}

/** Its glow radius in px, breathing between 6 and 14. */
export function orthoGlow(nowMs) {
  return ORTHO_GLOW_BASE
    + Math.sin(nowMs * ORTHO_TIME_SCALE * ORTHO_GLOW_RATE) * ORTHO_GLOW_SWING;
}

// ── Bone fusion — fused edges get a solid glow ──────────────────────────────
export const FUSED_GLOW_BASE = 6;
export const FUSED_GLOW_SCALE = 8;
export const FUSED_GLOW_ALPHA = 0.6;   // shadowColor alpha, × fuseCos

/** Glow radius in px for a fused edge, 6 at cos 0 rising to 14 at cos 1. */
export function fusedGlow(fuseCos) {
  return FUSED_GLOW_BASE + fuseCos * FUSED_GLOW_SCALE;
}

// ── Travelling pulse ring ───────────────────────────────────────────────────
export const PULSE_MIN_R = 2;
export const PULSE_GROWTH = 2.5;
export const PULSE_ALPHA = 0.9;        // × pulse × depthFade
export const PULSE_DRAW_CUTOFF = 0.1;  // below this the ring is skipped

/** Ring radius in px. Scaled by the projection scale of endpoint A. */
export function pulseRingRadius(pulse, scale) {
  return (PULSE_MIN_R + pulse * PULSE_GROWTH) * scale;
}

/** Where along the edge the ring sits, 0 at A and 1 at B. */
export function pulsePosition(pulse, direction) {
  return direction >= 0 ? pulse : 1 - pulse;
}

// ── Resonance edge ──────────────────────────────────────────────────────────
// TWO strokes under `lighter`, not one: a wide low-alpha halo and then a
// narrow bright core. The plan for this step described it as a single glowing
// line; porting it that way would have lost the halo, which is most of what
// makes it read as coalescence rather than as a thick edge.
export const RESONANCE_GOLD = [255, 215, 0];
export const RESONANCE_HALO_MID = [255, 255, 200];
export const RESONANCE_CORE_MID = [255, 255, 255];

export const RESONANCE_HALO_END_A = 0.06;   // + sim * 0.12
export const RESONANCE_HALO_END_K = 0.12;
export const RESONANCE_HALO_MID_A = 0.04;   // + sim * 0.10
export const RESONANCE_HALO_MID_K = 0.10;
export const RESONANCE_HALO_W = 8;          // + sim * 16, × avgScale
export const RESONANCE_HALO_W_K = 16;

export const RESONANCE_CORE_END_A = 0.55;   // + sim * 0.45
export const RESONANCE_CORE_END_K = 0.45;
export const RESONANCE_CORE_MID_A = 0.40;   // + sim * 0.55
export const RESONANCE_CORE_MID_K = 0.55;
export const RESONANCE_CORE_W = 1.5;        // + sim * 4.0, × avgScale
export const RESONANCE_CORE_W_K = 4.0;

export const RESONANCE_GLOW_BASE = 4;
export const RESONANCE_GLOW_SCALE = 24;
export const RESONANCE_DEFAULT_SIM = 0.5;   // when no result has landed yet

// `ctx.shadowColor = 'rgba(255,215,0,0.9)'` — the CORE's shadow only, and a
// flat colour rather than the gradient's. The halo sets shadowBlur = 0 and the
// prism chords have no shadow at all, so this alpha belongs to one stroke.
export const RESONANCE_SHADOW_ALPHA = 0.9;

/** Glow radius in px for the resonance core, 4 at sim 0 rising to 28 at sim 1.
 *  Twice the base edges' maximum — this is where a wrong glow falloff shows. */
export function resonanceGlow(sim) {
  return RESONANCE_GLOW_BASE + sim * RESONANCE_GLOW_SCALE;
}

/** Halo and core stroke widths in px for a given similarity and projection. */
export function resonanceWidths(sim, avgScale) {
  return {
    halo: (RESONANCE_HALO_W + sim * RESONANCE_HALO_W_K) * avgScale,
    core: (RESONANCE_CORE_W + sim * RESONANCE_CORE_W_K) * avgScale,
  };
}

/**
 * The three gradient stops of each of the resonance edge's TWO strokes.
 *
 * The twin of `edgeStops()` above, and deliberately shaped the same way, but
 * the two differ in the thing that matters: a base edge's ends are ASYMMETRIC
 * and swing apart with strength, while both of these are symmetric — stop 0 and
 * stop 2 are the same colour at the same alpha. Only the middle differs, and it
 * differs per stroke: the halo's is a pale yellow, the core's is pure white.
 *
 * Colours are rgb BYTES here, not the HSL objects the node palette carries, so
 * they must not be routed through writeHslRgb.
 */
export function resonanceStops(sim) {
  const haloEnd = RESONANCE_HALO_END_A + sim * RESONANCE_HALO_END_K;
  const coreEnd = RESONANCE_CORE_END_A + sim * RESONANCE_CORE_END_K;
  return {
    halo: {
      c0: RESONANCE_GOLD, c1: RESONANCE_HALO_MID, c2: RESONANCE_GOLD,
      a0: haloEnd, a1: RESONANCE_HALO_MID_A + sim * RESONANCE_HALO_MID_K, a2: haloEnd,
    },
    core: {
      c0: RESONANCE_GOLD, c1: RESONANCE_CORE_MID, c2: RESONANCE_GOLD,
      a0: coreEnd, a1: RESONANCE_CORE_MID_A + sim * RESONANCE_CORE_MID_K, a2: coreEnd,
    },
  };
}

// ── Prism geometry effects ──────────────────────────────────────────────────
// A command-triggered burst: `run <alias>` (or a left-click on a node) names a
// neighbourhood and the sphere draws a prismatic structure through it for
// `maxLife` frames. Three sub-layers inside one `lighter` block, and all three
// move together or not at all:
//
//   1. the chord bundle — for every PAIR of projected effect nodes, and each of
//      `spectralN` spectral lines, TWO quadratic Béziers: a wide low-alpha glow
//      pass and a sharp bright core over it;
//   2. the sacred polygon — one closed path through the nodes, when three or
//      more project;
//   3. the star spokes — one straight line from the projected sphere centre to
//      each node.
//
// The envelope (`alphaRaw`), the hue drift (`hue0`) and the `eff.life` / `live`
// bookkeeping are simulation state and stay in the draw loop. Everything here
// is the drawing arithmetic, lifted so the GPU copy and the canvas original
// provably read one source of truth — the same treatment the resonance edge got
// in task 1.

export const PRISM_SPECTRAL_FINE = 7;      // desktop
export const PRISM_SPECTRAL_COARSE = 4;    // coarse pointer
export const PRISM_HUE_STEP = 48;          // degrees between spectral lines
export const PRISM_ALPHA_K = 0.85;         // the bundle's share of the envelope
export const PRISM_ALPHA_FALLOFF = 0.07;   // per spectral line
export const PRISM_OFFSET_MID = 3;         // k at which the offset is zero
export const PRISM_OFFSET_STEP = 2.8;      // px per line, in x
export const PRISM_CP_PULL = 0.55;         // control point, toward the sphere centre
// The spectral offset lives HERE ALONE. The chord's endpoints sit on the node
// centres, so the bundle fans from a point the way dispersion actually does —
// it used to be seven parallel copies, maximally split at exactly the place
// they should have been converged (a 17px comb across a 14-20px dot).
//
// These two numbers are not a taste change: a quadratic weights its control
// point at 1/2 at t = 0.5, so the mid-chord offset is (end + 2*cp + end)/4.
// Moving the ends' 1.0 and 0.6 into the control point means 2 -> 3 and
// 1.4 -> 2.0, which leaves the mid-chord fan at exactly the 1.5x and 1.0x it
// has always been. The bundle is the same width where the rainbow reads.
export const PRISM_CP_OFF_X = 3;
export const PRISM_CP_OFF_Y = 2.0;
export const PRISM_SAT = 100;
export const PRISM_GLOW_LIT = 65;
export const PRISM_GLOW_ALPHA_K = 0.4;
export const PRISM_GLOW_W = 5;             // - k * 0.4
export const PRISM_GLOW_W_K = 0.4;
export const PRISM_CORE_LIT = 88;
export const PRISM_CORE_W = 1.2;

export const PRISM_POLY_HUE_STEP = 180;    // the polygon is the bundle's complement
export const PRISM_POLY_LIT = 88;
export const PRISM_POLY_ALPHA_K = 0.72;
export const PRISM_POLY_W = 1.6;

export const PRISM_SPOKE_SAT = 95;
export const PRISM_SPOKE_LIT = 82;
export const PRISM_SPOKE_ALPHA_K = 0.52;
export const PRISM_SPOKE_W = 0.5;

// The two limits the instance budget is computed from — see MAX_ADDITIVE_EDGES
// in SphereEdges.js. Both are enforced in ArtTab's spawnEffect: it drops the
// oldest effect beyond PRISM_MAX_EFFECTS and slices the node list to
// PRISM_MAX_NODES (6 on a coarse pointer, which is the smaller case).
export const PRISM_MAX_EFFECTS = 4;
export const PRISM_MAX_NODES = 11;

/** Lateral offset of spectral line `k`, in px. Symmetric about k = 3. */
export function prismOffset(k) {
  return (k - PRISM_OFFSET_MID) * PRISM_OFFSET_STEP;
}

/** Alpha of spectral line `k`, from the effect's envelope alpha. The glow pass
 *  takes PRISM_GLOW_ALPHA_K of this; the core pass takes it whole. */
export function prismChordAlpha(alpha, k) {
  return alpha * PRISM_ALPHA_K * (1 - k * PRISM_ALPHA_FALLOFF);
}

/** Stroke width of the glow pass for spectral line `k`. The core is constant. */
export function prismGlowWidth(k) {
  return PRISM_GLOW_W - k * PRISM_GLOW_W_K;
}

/**
 * The chord's control point, into `out` as [x, y].
 *
 * `ax..by` are the two nodes' projected positions WITHOUT the spectral offset,
 * and that is not a simplification: the draw loop takes its midpoint from the
 * bare `pA.sx`/`pB.sx` and only then adds `offset * 2` and `offset * 1.4`.
 * Deriving the midpoint from the offset endpoints instead shifts every chord's
 * control point by up to 8.4px, which reads as the bundle fanning the wrong way.
 *
 * Writes into `out` rather than returning a pair: this runs up to 770 times per
 * effect per frame and the draw loop is off the allocation path.
 */
export function prismControl(out, ax, ay, bx, by, cx, cy, offset) {
  const midX = (ax + bx) / 2, midY = (ay + by) / 2;
  out[0] = midX + (cx - midX) * PRISM_CP_PULL + offset * PRISM_CP_OFF_X;
  out[1] = midY + (cy - midY) * PRISM_CP_PULL + offset * PRISM_CP_OFF_Y;
  return out;
}

/**
 * The prism envelope's depth multiplier at arc-length fraction `t` along a
 * chord running from a node at `depthA` to one at `depthB`.
 *
 * THE PRISM WAS THE ONLY LAYER ON THE SPHERE WITH NO DEPTH TERM. Base edges
 * fade on avgDepth, node discs on depthCueAlpha, analogy filaments on
 * avgDepth; the prism drew at full envelope alpha wherever its endpoints sat
 * in Z. So a chord whose destination was on the far side arrived at FULL
 * brightness onto a disc cued down toward its 0.08 floor — energy delivered
 * where nothing visible was receiving it. Reported as the fan reading like an
 * ungrounded solar flare rather than a closed conduit between two points.
 *
 * TWO DECISIONS THAT WILL LOOK ARBITRARY:
 *
 * `t` is the ARC LENGTH fraction, not the Bezier parameter. They differ on a
 * bowed chord — tessellateQuad splits at uniform PARAMETER and the prism's
 * near-cusp chords vary several times over between their fastest and slowest
 * segment — and arc length is the one that matches what the eye reads as
 * distance travelled.
 *
 * This interpolates the CUES, not the depths. The cue clamps at a floor, and
 * a clamp does not commute with a lerp: on a chord from depth -1 to depth +1,
 * interpolating cues gives 0.62 at the midpoint while cueing an interpolated
 * depth gives 0.50. Interpolating the cues is what makes each END land on the
 * value prismDepthCue gives for that node, rather than on something that
 * depends on where the OTHER end happens to be.
 *
 * NOTE WHAT THIS DOES NOT CLAIM. An earlier version of this comment said the
 * chord end equals the cue of the DISC it lands on exactly. That was true
 * when this used depthCueAlpha directly and it is NOT true now -- see
 * PRISM_DEPTH_ALPHA_FLOOR, which deliberately lifts this layer off the disc
 * floor and makes a back-facing chord end up to 3x its own disc.
 */
export function prismChordCue(depthA, depthB, t) {
  const cA = prismDepthCue(depthA);
  const cB = prismDepthCue(depthB);
  return cA + (cB - cA) * t;
}

/**
 * How dark a prism chord may get at the back of the sphere.
 *
 * DELIBERATELY NOT DEPTH_ALPHA_FLOOR, and the difference is not a taste knob.
 * A node disc is a solid 14-20px shape; a prism chord is a 1.2px core on an
 * ADDITIVE layer. Equal alpha is not equal visibility when the footprints
 * differ by about two orders of magnitude.
 *
 * THE BINDING CONSTRAINT IS QUANTISATION, NOT THE BLOOM GATE. packAlphas
 * quantises to 1/255. At the disc floor of 0.08 a back-side GLOW-pass segment
 * at mid-envelope computes 0.5 * PRISM_ALPHA_K * PRISM_GLOW_ALPHA_K * 0.08 =
 * 0.0136, i.e. 3/255 -- which bands visibly across a 2.6-5px stroke. At 0.24
 * the same segment is 10/255 and the core pass is 26/255. (Dropping under the
 * composer's 0.28 luminanceThreshold only costs a stroke its BLOOM; it does
 * not make it invisible, so that is not the number this is set against.)
 *
 * THE COST, STATED. The clamp now engages at depth < -0.52 rather than -0.84,
 * so the back quarter of the depth range is FLAT -- no depth discrimination
 * there at all -- and front-to-back contrast falls from 12.5:1 to 4.17:1.
 * That is a third of the available dynamic range, spent to keep the far side
 * legible rather than merely present.
 */
export const PRISM_DEPTH_ALPHA_FLOOR = 0.24;

/** One node's prism-layer depth cue. Composed from depthCueAlpha rather than
 *  re-deriving it: since PRISM_DEPTH_ALPHA_FLOOR > DEPTH_ALPHA_FLOOR, taking
 *  the max of the two floors is provably identical to rebuilding the ramp with
 *  the higher one, and it leaves exactly one implementation of the cue. */
export function prismDepthCue(depth) {
  return Math.max(PRISM_DEPTH_ALPHA_FLOOR, depthCueAlpha(depth));
}

/** Where the prism's WIDE pass reaches full strength, in px of arc length from
 *  each end. Matches EDGE_TAPER_PX deliberately: the base edges' glow taper and
 *  this one are the same gesture on two layers, and a reader who finds two
 *  different numbers will reasonably assume one of them was tuned. */
export const PRISM_ROOT_TAPER_PX = 14;

/**
 * The wide pass's alpha multiplier at arc length `sFromA` along a chord of
 * total length `totalLen`. Linear from 0 at each end up to 1 at
 * PRISM_ROOT_TAPER_PX in, flat through the middle.
 *
 * WHY THE WIDE PASS ONLY. In an eleven-node effect, 140 strokes terminate on
 * ONE node centre -- 10 pairs x 7 spectral lines x 2 passes -- on an ADDITIVE
 * layer. Measured live: 60 stroke endpoints inside a single 2x2px cell against
 * a mean of 5.3 per occupied cell, roughly 11x the line's own density piled
 * into one point. The disc behind it is 14-20px wide and was being swallowed.
 * The wide pass carries about 56% of that root ink (glow 0.4 x ~3.8px against
 * core 1.0 x 1.2px), so tapering it removes that share while the 1.2px core
 * still lands on the exact node origin -- the author's ruling, and the same
 * one made for the base edges last session: taper the glow, keep the thread.
 *
 * DO NOT try to reuse the shipped EDGE_TAPER_PX shader taper for this. That
 * one multiplies the GLOW term, and the prism packs glow = 0: its `glow` is a
 * literal second stroke, not a shader shoulder. The shader taper cannot fire
 * on this layer at all.
 *
 * `totalLen / 3` IS A GUARD, NOT A TASTE KNOB. Without it a chord shorter than
 * 2 x PRISM_ROOT_TAPER_PX tapers from both ends and never reaches full alpha
 * anywhere -- a 20px chord would peak at 10/14 = 0.714 in its own middle.
 */
export function prismRootTaper(sFromA, totalLen) {
  if (!(totalLen > 1e-6)) return 1;
  const L = Math.min(PRISM_ROOT_TAPER_PX, totalLen / 3);
  if (!(L > 1e-6)) return 1;
  const d = Math.min(sFromA, totalLen - sFromA);
  return Math.min(1, d / L);
}

// ── THE LONGITUDINAL WAVEFRONT ─────────────────────────────────────────────
//
// THE LAYER HAD NO TIME TERM AT ALL. Every point's alpha was
// `lAlpha * cue(t) * taper` -- so a chord lit from root to tip simultaneously
// and the ONLY motion in the whole prism was `hue0` drifting sideways through
// a STATIC brightness ladder (PRISM_ALPHA_FALLOFF, fixed per spectral line).
// The author's report was exact: "it's a solid sheet of coloured plastic
// shifting hues across its ribs", not a charge travelling from A to B.
//
// ── WHY IT TAKES LIGHT AWAY INSTEAD OF ADDING IT ──────────────────────────
//
// THIS IS THE DECISION THE REST OF THE BLOCK HANGS ON, AND IT IS NOT A TASTE
// CALL. packAlphas clamps at 255, so an alpha driven past 1.0 saturates
// SILENTLY -- and a saturated bundle loses exactly the chromatic separation
// between the seven spectral lines that this layer exists to show. That is the
// author's own third note (the white rail "almost blows out the delicate
// chromatic separation of the outer prism chords") arriving through the
// arithmetic rather than the eye.
//
// So the crest sits at EXACTLY the alpha that shipped and the troughs are
// carved down beneath it. Three consequences, all of them load-bearing:
//
//   1. It cannot clip, so the spectral separation survives at peak.
//   2. It is provably ink-NEGATIVE -- it can only ever remove energy from the
//      composer's 0.28 luminanceThreshold, never add any. The bloom dial is
//      off limits on this project and this change cannot reach it.
//   3. Once the wave has passed, `prismWaveEnv` returns EXACTLY 0 and the
//      whole expression collapses to `a * cue * taper`, which is the sustained
//      burn the author signed off by eye BEFORE this feature existed. Not
//      approximately -- exactly, which is why that test uses `toBe` and not
//      `toBeCloseTo`. An asymptote there would be the same vacuous-property
//      trap this project has already paid for three times.
//
// ── THE SHAPE ─────────────────────────────────────────────────────────────
//
//   x   = u - t/T + phi_k * (1 - u)
//   f(x) = |x| > W ? 0 : 0.5 * (1 + cos(pi * x / W))
//
// The `(1 - u)` is the arrival damping the author asked for by name. At u = 1
// it vanishes and all seven strands are in phase -- a single synchronised
// pulse landing dead centre on the node disc. At u = 0 they are sheared by
// phi_k across the bundle. A diagonal at launch that collapses to a point at
// the target.
//
// f(x) IS EVALUATED ONCE, NOT THREE TIMES. This shipped as a decaying train
// of three and the author read the result as a ~10Hz strobe -- correctly, see
// PRISM_WAVE_SWELL for the arithmetic. The amplitude term above is now a
// single pass and the escalation lives in the envelope instead.
//
// A RAISED COSINE, not a gaussian and not a hard front, and the reason is the
// tessellation rather than taste: writePolyline reconstructs alpha as a
// straight line between per-POINT samples, so the pulse has to be band-limited
// or its crest beats against the sample grid as it moves. See
// prismSegmentFade, which is the other half of that same problem.

/** Half-width of the pulse, as a fraction of the chord. Full support is 2x
 *  this, and prismSegmentFade is set against it. */
export const PRISM_WAVE_W = 0.18;

/** Phase shear per spectral line, in the same fraction-of-chord units.
 *  MONOTONIC in k, not symmetric about the middle strand: the author asked for
 *  a "smooth diagonal wavefront across the bundle", and a symmetric offset
 *  would give a chevron. Across all seven lines the total shear is 0.30. */
export const PRISM_PHASE_STEP = 0.05;

/**
 * How far the trough is carved below the crest AT FULL SWELL. The crest is
 * always 1.0 -- see the note above on why nothing here may exceed it.
 *
 * RULED DOWN FROM 0.55 BY THE AUTHOR. At 0.55 the sleeve fell to 0.45 of the
 * sustained alpha and it "aggressively chops down into deep black between
 * states". 0.40 floors it at 0.60, and because PRISM_WAVE_SWELL now scales
 * this, the floor is only reached at the instant of arrival: averaged over a
 * transit the trough sits near 0.78, against the flat 0.45 the train held at
 * every moment it was running. About a third of the ink the train removed,
 * spent entirely on the one moment that is supposed to land.
 *
 * DO NOT RAISE IT BACK without a ruling. artPrismWave.test.js asserts the
 * floor stays at or above 0.60, which is that ruling written down.
 */
export const PRISM_WAVE_DEPTH = 0.40;

// ── Kinematics, and the lead over the white core ──────────────────────────
//
// All three numbers are EXACTLY 0.8x the strimer's (STRIMER_MS_PER_UNIT 200,
// DURATION_MIN_MS 70, DURATION_MAX_MS 160), and the uniform ratio is the
// whole point: it makes the prism pulse strictly faster than the strimer
// packet at EVERY chord length, including up at the clamp where the strimer's
// own header notes its velocity stops being constant. A lead that held at the
// median but collapsed at the clamps would disappear on exactly the longest
// chords, where it is most visible.
//
// On the measured median chord (0.642 world units, lookbook/strimer/report
// .json) that is 103ms against the packet's 128ms -- a 26ms lead. The fibre
// sleeve carries the charge, then the main rail detonates.
export const PRISM_WAVE_MS_PER_UNIT = 160;
export const PRISM_WAVE_MIN_MS = 56;
export const PRISM_WAVE_MAX_MS = 128;

/**
 * ── ONE PASS, AND THE SWELL THAT CARRIES IT ───────────────────────────────
 *
 * THE TRAIN WAS THE BUG, AND THE ARITHMETIC SAYS SO. Three pulses spaced one
 * transit apart crest any given point three times in 3 * durMs. On the
 * measured median chord that is three crests in 308ms -- a 9.7Hz repetition
 * -- and on the shortest chord (PRISM_WAVE_MIN_MS) it is 17.9Hz. The author
 * read it off the screen exactly as the numbers predict: "an aggressive
 * ~10Hz strobe/flicker rather than an intensifying pulse". A repetition rate
 * in that band reads as a stroboscope however gently each individual pulse
 * is shaped, so a softer pulse was never the fix. ONE pulse is. The
 * repetition rate is now zero by construction, and the test file pins it
 * there by counting crests at a fixed point rather than by reading a
 * constant.
 *
 * What replaces the train's sense of escalation is a CRESCENDO. The envelope
 * swells from PRISM_WAVE_SWELL at launch to 1 on arrival, so one sleeve
 * traversal gathers energy as it crosses instead of opening at full depth and
 * ringing down. The charge lands once, hardest at the far node -- which is
 * also where the seven strands come back into phase (the `(1 - u)` damping
 * above) and 26ms before the strimer's white rail detonates.
 *
 * PRISM_WAVE_SWELL IS NOT ONLY A TASTE DIAL. It is also what keeps the launch
 * from reading as an edge: a chord enters the wave at env = SWELL, so the
 * step in alpha at that instant is PRISM_WAVE_DEPTH * PRISM_WAVE_SWELL =
 * 4.0%, under the 4.3% sampling ripple the tessellation already tolerates at
 * this W (see PRISM_WAVE_SEGMENTS). Raise the floor and the moment the
 * cascade reaches each chord acquires a visible edge of its own.
 */
export const PRISM_WAVE_SWELL = 0.10;

/** How long the envelope takes to reach zero after the front lands.
 *
 *  LONGER THAN THE TRANSIT, ON PURPOSE, AND IT IS THE SLOWEST THING IN THE
 *  LAYER. The pulse leaves the chord about 0.18 * durMs after arrival; every
 *  millisecond after that is the whole sleeve lifting uniformly back to the
 *  sustained burn. The author asked for a wave that "deposits energy into the
 *  sustained burn" rather than shuttering the light -- and since the layer is
 *  subtractive it cannot put MORE light into the burn than was always there.
 *  What it can do is make the return to it the longest gesture in the effect,
 *  3.5x the attack on the median chord, so the charge reads as absorbed
 *  rather than switched off. */
export const PRISM_WAVE_TAIL_MS = 360;

/** How long a node waits per step of graph depth before its own chords launch.
 *  About one transit, so the cascade reads as causal: the clicked node fires,
 *  its neighbours light as the front reaches them, the bridges go last. */
export const PRISM_CASCADE_MS = 110;

/**
 * How finely a chord is tessellated while it is carrying a wave.
 *
 * MEASURED, and it overrode the design's own assumption. `scripts/_a18wsweep
 * .mjs` builds real chords through prismControl, tessellates them with the
 * shipped quadSegments and reports the RIPPLE -- how much the pulse's
 * reconstructed crest rises and falls purely as an artefact of where the
 * sample points land as it travels.
 *
 * The design assumed chords land near CURVE_MAX_SEGMENTS. THEY DO NOT: real
 * prism chords tessellate to n = 8-11, because quadSegments answers a
 * FLATNESS question and these bows are gentle. At n = 8 the ripple at this W
 * is 50%, which is the beading `PACKET_FRACTION` was measured against in
 * artStrimer arriving on a different layer.
 *
 * Worst-case ripple over every span and spectral line tested:
 *
 *        W=0.18   W=0.22   W=0.30
 *   n=24  11.3%     7.7%     4.2%
 *   n=32   6.6%     4.4%     2.4%
 *   n=40   4.3%     2.9%     1.6%
 *
 * 40 is the cheapest count that holds the shipped W under 5%. The author
 * chose to keep W and pay for the segments rather than widen the pulse: at
 * W = 0.30 the pulse spans 60% of the chord and reads as a swell rather than
 * a front tearing out, which is the thing this work exists to produce.
 *
 * AFFORDABLE, AND THAT WAS MEASURED TOO. `scripts/_a19budget.mjs` found the
 * additive pool 6.6% full at the provable worst case -- four concurrent
 * eleven-node effects -- with zero dropped, i.e. 15.1x headroom against the
 * 4.4x this costs. (The "~74000" in ArtTab.jsx counts inner-loop ITERATIONS,
 * not instances; the measured peak is 5408.) MAX_ADDITIVE_EDGES is derived
 * from this constant, so the preallocation tracks it automatically.
 */
export const PRISM_WAVE_SEGMENTS = 40;

/**
 * The thresholds prismSegmentFade ramps between, set from the table above:
 * full at the count the wave is actually given, off below the count where
 * ripple passes ~17%.
 *
 * THIS IS A BELT AND BRACES, NOT THE PRIMARY GUARD. The draw loop forces
 * PRISM_WAVE_SEGMENTS on any chord that is waving, so in practice the fade
 * reads 1 every time. It stays because the alternative is a silent
 * dependency: if a future caller ever tessellates a waving chord more
 * coarsely -- a mobile path, a budget cap, a bug -- the wave fades out
 * instead of staircasing, and the failure is invisible rather than ugly.
 */
export const PRISM_WAVE_SEG_FULL = 40;
export const PRISM_WAVE_SEG_NONE = 20;

/** The pulse profile: a raised cosine on |x| <= w, exactly 0
 *  outside it so a pulse cannot leak down the rest of the chord. Parameter w is the half-width. */
export function prismPulse(x, w = PRISM_WAVE_W) {
  const a = x < 0 ? -x : x;
  if (a >= w) return 0;
  return 0.5 * (1 + Math.cos(Math.PI * x / w));
}

/** Spectral line `k`'s phase shear. The twin of prismOffset, which does the
 *  same job in space; this one does it in time. Parameter step is the phase increment per line. */
export function prismPhaseOffset(k, step = PRISM_PHASE_STEP) {
  return k * step;
}

/**
 * The wavefront's amplitude at arc fraction `u` on spectral line `k`, `tMs`
 * after this chord's ORIGIN node lit, for a chord whose transit is `durMs`.
 *
 * ONE PASS. There is no loop and no pulse index any more: a point is crested
 * once, as the front sweeps through it, and never again. The escalation the
 * train used to carry is in prismWaveEnv now, where it costs one evaluation
 * per chord per frame instead of one per point. Parameters w and step are the pulse half-width and phase increment per line.
 */
export function prismWaveAmp(u, k, tMs, durMs, w = PRISM_WAVE_W, step = PRISM_PHASE_STEP) {
  return prismPulse(prismWavePhase(u, k, tMs, durMs, step), w);
}

/**
 * The signed advection coordinate itself: where the point at arc fraction `u`
 * sits RELATIVE TO THE CREST, in fractions of the chord. Zero on the crest,
 * POSITIVE ahead of it (the ground the front has not reached yet) and
 * NEGATIVE behind it.
 *
 * SPLIT OUT OF prismWaveAmp BECAUSE THE COLOUR NEEDS THE SIGN AND THE
 * AMPLITUDE THROWS IT AWAY. prismPulse is symmetric, so an amplitude of 0.6
 * says nothing about whether the front is arriving or leaving -- and a
 * chromatic front that looked the same coming and going would be a pattern
 * that pulses rather than one that flows. One arithmetic expression, two
 * readers, so the colour and the brightness cannot drift out of step: they
 * are the same number. Parameter step is the phase increment per line.
 */
export function prismWavePhase(u, k, tMs, durMs, step = PRISM_PHASE_STEP) {
  const d = durMs > 1e-6 ? durMs : 1e-6;
  const uu = u < 0 ? 0 : u > 1 ? 1 : u;
  return uu - tMs / d + prismPhaseOffset(k, step) * (1 - uu);
}

/**
 * The COLOUR's advection coordinate: `prismWavePhase` with the per-strand
 * shear removed.
 *
 * ── THE COLOUR AND THE BRIGHTNESS DELIBERATELY NO LONGER SHARE ONE PHASE ──
 *
 * The note on prismChromaBlend's original call site said they must, and the
 * reason was sound: one number means the tint cannot drift out of step with
 * the crest it belongs to. It is overridden here for a MEASURED reason, not a
 * taste one.
 *
 * prismWavePhase carries prismPhaseOffset(k) * (1 - uu), so each strand
 * reaches its crest at its own moment. Drive a UNISON COLLAPSE off that and
 * the comb folds over itself: strand 0 must travel 144deg to reach the middle
 * strand's hue while strand 1 travels only 96deg, so when the crest sits near
 * strand 0 it collapses further, OVERTAKES strand 1, and lands EXACTLY on
 * strand 1's resting hue. Measured minimum neighbour gap -31.16deg. That is
 * the "it jumps erratically between wire indices" reading this whole line of
 * work exists to remove, re-entering through a door the 0.75-step bound does
 * not cover -- that bound constrains the SIZE of a differential rotation and
 * says nothing about a collapse that overtakes.
 *
 * With a phase common to the bundle the collapse fraction is common too, and
 * the comb is monotone by construction: d(hue_k)/dk = PRISM_HUE_STEP * (1 - t),
 * which is positive for every t < 1. See prismUnisonHue.
 *
 * THE ALPHA WAVE IS NOT TOUCHED. The diagonal wavefront across the bundle is
 * the brightness's, and it stays exactly as it shipped. The shear belongs to
 * the light, not to the colour.
 */
export function prismChromaPhase(u, tMs, durMs) {
  const d = durMs > 1e-6 ? durMs : 1e-6;
  const uu = u < 0 ? 0 : u > 1 ? 1 : u;
  return uu - tMs / d;
}

// ── THE CHROMA ARMS ────────────────────────────────────────────────────────
//
// Three anchor expressions behind one switch, so the author can rule between
// them inside ONE page at one seed on one rAF cycle. See the design spec
// 2026-09-22-prism-chroma-ab-design.md for why the shipped arm is invisible:
// the bundle puts 288deg of the hue wheel on screen 2.8px apart, so a crest
// has no reference hue to be different from and no excursion of any size is
// trackable.

/** The shipped arm: hue_k + LEAD, skewed. Rotates each strand in place. */
export const PRISM_CHROMA_MODE_SHIPPED = 0;

/** Arm U: every strand gathers onto the comb's midpoint hue. */
export const PRISM_CHROMA_MODE_UNISON = 1;

/** Arm A: the crest bleaches; hues do not move at all. */
export const PRISM_CHROMA_MODE_ACHROMATIC = 2;

/**
 * Coerce an arm argument to a valid mode, or null if it is not one.
 *
 * PURE, AND IN THIS FILE, BECAUSE A HOOK THAT VALIDATES INLINE CANNOT BE
 * TESTED WITHOUT A COPY OF ITSELF -- and a test written against a copy passes
 * with the hook deleted. The window hook in ArtTab.jsx is a caller of this and
 * holds no logic of its own.
 */
export function prismChromaModeOf(v) {
  // `null` must be rejected explicitly and BEFORE coercion: Number(null) is
  // 0, which is in range and passes the integer check below, so without this
  // guard a null argument would silently resolve to the shipped arm instead
  // of being refused -- masking a caller's bug (e.g. a stale/typo'd
  // variable) as a legitimate mode switch.
  if (v === null) return null;
  const n = Number(v);
  if (!Number.isInteger(n)) return null;
  if (n < PRISM_CHROMA_MODE_SHIPPED || n > PRISM_CHROMA_MODE_ACHROMATIC) return null;
  return n;
}

/**
 * Arm A's WAKE saturation, against a leading edge of 0.
 *
 * CHOSEN, NEVER SEEN BY AN EYE.
 *
 * A grey anchor has no hue for PRISM_HUE_SKEW to act on, so arm A would look
 * identical arriving and leaving -- a pattern that pulses rather than one that
 * flows, which is exactly what PRISM_HUE_SKEW was introduced to prevent. Arm
 * A takes its direction on the saturation axis instead: the leading edge
 * bleaches to pure white and colour floods back in behind it.
 */
export const PRISM_A_WAKE_SAT = 35;

/**
 * The comb's fixed point: the spectral index every strand gathers onto.
 *
 * DERIVED FROM THE LIVE LINE COUNT, NEVER A LITERAL 3. It is 3 on
 * PRISM_SPECTRAL_FINE = 7 and 1.5 on PRISM_SPECTRAL_COARSE = 4, where NO
 * STRAND SITS ON IT AT ALL. That is not a defect -- the target is a HUE, not a
 * strand, and a coarse bundle gathers onto a colour none of its four lines is
 * wearing. A literal 3 would put the coarse target outside its own comb, on
 * the far side of its widest line.
 */
export function prismUnisonK(n) {
  return (n - 1) / 2;
}

/**
 * Strand `k`'s hue at collapse fraction `t`, for a bundle of `n` lines.
 *
 * NOT WRAPPED TO 360, deliberately. The monotonicity that makes this arm safe
 * is a statement about ORDER, and a modulo destroys the order it is asserted
 * on. The caller wraps, once, at the writeHsl boundary.
 *
 * ── WHY THIS IS SAFE AT 144deg WHEN THE SHIPPED ARM IS BOUNDED AT 34 ──────
 *
 * The 0.75-step bound exists because a crest free to rotate a full
 * PRISM_HUE_STEP wears its NEIGHBOUR's resting colour, which reads as the
 * bundle jumping between wire indices. That bound governs a DIFFERENTIAL
 * rotation: each strand moving independently past its neighbour.
 *
 * A collapse has no differential. Every strand moves toward the same point by
 * the same fraction, so
 *
 *     d(hue_k)/dk = PRISM_HUE_STEP * (1 - t)  >  0   for all t < 1
 *
 * and the comb contracts uniformly without ever crossing itself. No strand can
 * reach a neighbour's hue while the neighbour is elsewhere, because they are
 * both moving and the ordering is preserved. At t = 1 they are all equal,
 * which is the arm's whole point and cannot read as an index swap because no
 * index is singled out.
 *
 * THIS HOLDS ONLY FOR A COMMON `t`. See prismChromaPhase for what happens --
 * measured -- when the per-strand sheared amplitude is used instead.
 */
export function prismUnisonHue(hue0, k, n, t) {
  const rest = hue0 + k * PRISM_HUE_STEP;
  const target = hue0 + prismUnisonK(n) * PRISM_HUE_STEP;
  return rest + (target - rest) * t;
}

/**
 * Which way strand `k` travels under a collapse: +1 toward increasing hue, -1
 * toward decreasing, 0 for a strand already on the fixed point.
 *
 * THE SKEW MUST BE SIGNED BY THIS. Strands below the fixed point travel toward
 * increasing hue and strands above it travel toward decreasing hue, so a fixed
 * +PRISM_HUE_SKEW would make the leading edge OVERSHOOT on one half of the comb
 * and UNDERSHOOT on the other -- the two halves would read as arriving and
 * leaving at the same time, which is precisely the symmetric-tint failure
 * PRISM_HUE_SKEW exists to prevent.
 *
 * ZERO AT THE FIXED POINT, AND THAT IS NOT AN EDGE CASE TO PATCH AROUND. The
 * middle strand of a fine bundle does not move and takes no skew: it is the
 * still centre the others gather onto. On a coarse bundle the fixed point falls
 * between two lines and no strand returns 0.
 */
export function prismTravelSign(k, n) {
  const d = prismUnisonK(n) - k;
  return d > 0 ? 1 : d < 0 ? -1 : 0;
}

/**
 * How much of the wave is in force, `tMs` after the chord's origin lit: a
 * crescendo to full strength over the transit, then a long release.
 *
 * TWO LIMBS, BOTH SMOOTHSTEPPED, AND THEY ARE NOT SYMMETRIC. The swell runs
 * over one transit so the front gathers energy exactly as far as it travels;
 * the release runs over PRISM_WAVE_TAIL_MS, 3.5x longer on the median chord,
 * so the sleeve lifts back into the sustained burn slowly enough to read as
 * absorption. Attack shorter than release is the whole shape of the gesture.
 *
 * The joins at `durMs` and at `durMs + PRISM_WAVE_TAIL_MS` both have zero
 * slope on both sides -- a kink at either reads as the flick this revision
 * exists to remove. The join at t = 0 is the ONE deliberate step in the
 * layer, of height PRISM_WAVE_SWELL; see that constant for why it is small
 * enough to hide under the tessellation's own ripple.
 *
 * REACHES EXACTLY ZERO, and that is the contract the whole design rests on --
 * see the note at the top of this block. Also returns 0 for NEGATIVE t, which
 * is not defensive noise: the cascade hands a chord negative time for as long
 * as its origin node is still dark, and a chord that has not been reached yet
 * must draw exactly as it always did.
 *
 * Smoothstep through the tail rather than a linear ramp: the join at `total`
 * has zero slope on both sides, and a kink there reads as a visible flick.
 */
export function prismWaveEnv(tMs, durMs) {
  if (!(tMs >= 0)) return 0;
  const d = durMs > 1e-6 ? durMs : 1e-6;
  if (tMs <= d) {
    const x = tMs / d;
    return PRISM_WAVE_SWELL + (1 - PRISM_WAVE_SWELL) * x * x * (3 - 2 * x);
  }
  const x = (tMs - d) / PRISM_WAVE_TAIL_MS;
  if (x >= 1) return 0;
  const c = 1 - x;
  return c * c * (3 - 2 * c);
}

/**
 * The multiplier on a point's alpha. Bounded to [1 - PRISM_WAVE_DEPTH, 1] by
 * construction, and exactly 1 whenever the envelope or the segment fade is 0.
 */
export function prismWaveMix(amp, env, segFade) {
  return 1 - PRISM_WAVE_DEPTH * env * segFade * (1 - amp);
}

// ── THE CHROMATIC FRONT ────────────────────────────────────────────────────
//
// THE BRIGHTNESS TRAVELLED AND THE COLOUR DID NOT. Everything above modulates
// ALPHA along the chord while the colour stayed pinned to the strand index:
// one `writeHsl(rgb, 0, hue0 + k * PRISM_HUE_STEP, ...)` per spectral line,
// flat for the whole polyline. The author read the result exactly: "the colour
// stays pinned to the wire like a light shining through stained glass". A
// travelling brightness on a static colour IS a lamp behind glass; the glass
// is what the eye tracks.
//
// ── IT COSTS NO FLOATS, AND THAT IS NOT LUCK ──────────────────────────────
//
// The instance layout has carried THREE colour stops since it was written --
// EDGE_OFF.c0/c1/c2, at offsets 4-6, 7-9 and 10-12 -- and the fragment shader
// has always interpolated them as a three-stop linear gradient along the
// segment. `writePolyline` was writing the SAME rgb into all three, which
// degenerates that gradient to flat. So the colour ramp this needs is not a
// new capability: it is a capability the buffer has been carrying, unused, on
// every prism instance ever written. EDGE_STRIDE stays 18, the shader is not
// touched, and MAX_ADDITIVE_EDGES does not move.
//
// ── WHY THE TINT IS A HUE ROTATION AND NOT A WHITE-HOT LIFT ───────────────
//
// The author asked for the leading edge to lead with "electric cyan/white-hot".
// A lightness lift is not available on the same terms as everything else here:
// the alpha design is provably ink-NEGATIVE, so it cannot reach the composer's
// 0.28 luminanceThreshold and the bloom dial stays untouched by construction.
// COLOUR HAS NO SUCH PROOF -- even a pure hue rotation moves luminance, since
// a yellow and a blue at the same HSL lightness are not the same brightness.
// So this rotates hue at the SAME saturation and lightness the pass already
// uses, which is the smallest change that makes the colour flow, and the ink
// it costs is MEASURED rather than argued. A deliberate lightness lift is a
// separate, measured decision; it is not smuggled in here.
//
// ── AND WHY THE ROTATION IS BOUNDED ───────────────────────────────────────
//
// PRISM_HUE_STEP is 48deg. If the crest could rotate a strand's hue by a full
// step, strand k's crest would wear strand k+1's resting colour -- which is
// precisely the "it jumps erratically between wire indices" reading this whole
// line of work exists to remove, rebuilt out of the fix for it. The bound
// below keeps the largest excursion under three quarters of a step, and a test
// asserts it against PRISM_HUE_STEP rather than against a literal.

/** How far the CREST's hue sits from the strand's resting hue, in degrees. */
export const PRISM_HUE_LEAD = 24;

/** How much further the LEADING edge of the pulse runs than its trailing edge,
 *  so the front has a direction: the ground ahead is tinted `LEAD + SKEW` and
 *  the wake behind it `LEAD - SKEW`. A symmetric tint would look the same
 *  arriving and leaving, which is a pattern that pulses rather than flows. */
export const PRISM_HUE_SKEW = 10;

/**
 * Where a point sits ACROSS the pulse, from -1 at the trailing edge through 0
 * on the crest to +1 at the leading edge.
 *
 * Linear rather than smoothstepped, and it does not need to be anything else:
 * the amplitude it gets multiplied by is already 0 at both edges, so the tint
 * reaches the ends of its range only where it has no weight left to apply. Parameter w is the pulse half-width.
 */
export function prismChromaSkew(phase, w = PRISM_WAVE_W) {
  const s = phase / w;
  return s < -1 ? -1 : s > 1 ? 1 : s;
}

/** A tint anchor's hue: `side` is +1 for the leading edge, -1 for the wake. */
export function prismTintHue(hue, side) {
  return hue + PRISM_HUE_LEAD + side * PRISM_HUE_SKEW;
}

/**
 * A tint anchor's HUE, for the selected arm. `side` is +1 for the leading
 * edge and -1 for the wake.
 *
 * THE ARMS ARE ONLY THIS FUNCTION AND ITS SATURATION TWIN. Everything that
 * applies the tint -- prismChromaBlend, the per-point loop, writePolyline's
 * rgbs -- is untouched by the A/B. That is deliberate: a comparison whose two
 * halves run different machinery compares the machinery.
 */
export function prismAnchorHue(mode, hue0, k, n, side) {
  const rest = (hue0 + k * PRISM_HUE_STEP) % 360;
  if (mode === PRISM_CHROMA_MODE_UNISON) {
    // The full collapse is the ANCHOR; how far a point actually travels toward
    // it is prismChromaBlend's `amp`, exactly as for the shipped arm.
    return prismUnisonHue(hue0, k, n, 1) + side * prismTravelSign(k, n) * PRISM_HUE_SKEW;
  }
  if (mode === PRISM_CHROMA_MODE_ACHROMATIC) return rest;   // A moves saturation, not hue
  return prismTintHue(rest, side);
}

/** A tint anchor's SATURATION, for the selected arm. */
export function prismAnchorSat(mode, side) {
  if (mode !== PRISM_CHROMA_MODE_ACHROMATIC) return PRISM_SAT;
  return side > 0 ? 0 : PRISM_A_WAKE_SAT;
}

/**
 * Fill the tint-anchor buffer for a whole bundle: four anchors per spectral
 * line (lead and wake, glow pass and core pass). Returns how many it wrote.
 *
 * LIFTED OUT OF THE DRAW LOOP SO THE "ONCE PER LINE" CONTRACT IS TESTABLE.
 * It was a comment before, and a comment cannot fail. writeHsl allocates a
 * closure per call and `subarray` allocates a view per call; either one
 * evaluated per POINT puts tens of thousands of allocations a frame on a loop
 * this file keeps deliberately clear of them. A spectral line's hue depends on
 * nothing about the chord, so this runs 4n times per effect per frame against
 * the 770 writeHsl calls the base colour already spends on a full eleven-node
 * effect.
 *
 * NOT GATED ON WHETHER ANYTHING IS WAVING, for the same reason it was not
 * before: the gate costs more to decide than the work it skips.
 */
export function prismWriteAnchors(out, mode, hue0, n, coreOff) {
  for (let k = 0; k < n; k++) {
    const hL = prismAnchorHue(mode, hue0, k, n,  1);
    const hT = prismAnchorHue(mode, hue0, k, n, -1);
    const sL = prismAnchorSat(mode,  1);
    const sT = prismAnchorSat(mode, -1);
    writeHsl(out, k * 6,                hL, sL, PRISM_GLOW_LIT);
    writeHsl(out, k * 6 + 3,            hT, sT, PRISM_GLOW_LIT);
    writeHsl(out, coreOff + k * 6,      hL, sL, PRISM_CORE_LIT);
    writeHsl(out, coreOff + k * 6 + 3,  hT, sT, PRISM_CORE_LIT);
  }
  return 4 * n;
}

/**
 * The colour at one point, into `out` at offset `o`: the strand's resting
 * colour, pushed toward the travelling tint by the pulse's own amplitude.
 *
 * The two tint anchors live in `tints` at `oLead` and `oTail`, already
 * converted to rgb ONCE PER SPECTRAL LINE -- not per point.
 *
 * OFFSETS RATHER THAN TWO ARRAYS, AND THAT IS THE ALLOCATION PATH TALKING.
 * `writeHsl` allocates a closure per call, and slicing the anchors out with
 * `subarray` allocates a view per call; either one, evaluated per point, puts
 * ~74000 allocations a frame on a loop this file keeps deliberately clear of
 * them. Two lerps and six indexed reads instead. It is also why there are only
 * two anchors: the blend between them passes near the true intermediate hue,
 * slightly desaturated, and at 2 * PRISM_HUE_SKEW apart that error is not
 * visible.
 *
 * EXACTLY THE RESTING COLOUR AT amp = 0, by construction. That is the same
 * contract prismWaveMix keeps for alpha, and for the same reason: once the
 * pass is over the layer must draw precisely what the author signed off.
 */
export function prismChromaBlend(out, o, cBase, tints, oLead, oTail, amp, skew) {
  const w = (skew + 1) * 0.5;
  const t0 = tints[oTail]     + (tints[oLead]     - tints[oTail])     * w;
  const t1 = tints[oTail + 1] + (tints[oLead + 1] - tints[oTail + 1]) * w;
  const t2 = tints[oTail + 2] + (tints[oLead + 2] - tints[oTail + 2]) * w;
  out[o]     = cBase[0] + (t0 - cBase[0]) * amp;
  out[o + 1] = cBase[1] + (t1 - cBase[1]) * amp;
  out[o + 2] = cBase[2] + (t2 - cBase[2]) * amp;
}

/**
 * How much wave a chord tessellated into `n` segments may carry.
 *
 * THE NYQUIST GUARD. A pulse spanning 2W of the chord is sampled 2*W*n times,
 * and writePolyline draws a STRAIGHT LINE between those samples -- so below
 * some n the crest beats against the sample grid as it travels and the chord
 * staircases. `quadSegments` returns as few as 1 on a short or flat chord, so
 * this is not a corner case.
 *
 * Fading the wave out is the honest failure: a chord that cannot carry the
 * pulse draws exactly as it did before rather than drawing it badly. At
 * PRISM_WAVE_SEG_FULL the pulse gets 5.04 samples across its full support.
 */
export function prismSegmentFade(n) {
  if (n >= PRISM_WAVE_SEG_FULL) return 1;
  if (n <= PRISM_WAVE_SEG_NONE) return 0;
  const f = (n - PRISM_WAVE_SEG_NONE) / (PRISM_WAVE_SEG_FULL - PRISM_WAVE_SEG_NONE);
  return f * f * (3 - 2 * f);
}

/** A chord's transit in ms, from the 3D chord between its endpoints -- the
 *  same world-length measure the strimer uses, so the two layers stay in a
 *  fixed ratio under every rotation and at every chord length. */
export function prismWaveDuration(worldLen) {
  const raw = worldLen * PRISM_WAVE_MS_PER_UNIT;
  return Math.min(PRISM_WAVE_MAX_MS, Math.max(PRISM_WAVE_MIN_MS, raw));
}

/**
 * Which way a chord flows, from its two endpoints' graph depths: +1 for A->B,
 * -1 for B->A, and 0 when neither is shallower.
 *
 * The prism draws a chord between EVERY pair of effect nodes, not only pairs
 * touching the clicked one, so most chords have no origin of their own.
 * `spawnEffect` orders nodeIds as [clicked, ...neighbours, ...bridges], which
 * makes BFS depth known at spawn, and the wave runs from the shallower end.
 *
 * ZERO IS NOT A FALLBACK. Two nodes at the same depth light at the same
 * instant, so there is genuinely no direction to be had, and picking one by
 * index would invent a flow the graph does not have. The caller drives those
 * chords from BOTH ends and lets the two fronts meet in the middle.
 */
export function prismChordDir(depthA, depthB) {
  if (depthA < depthB) return 1;
  if (depthB < depthA) return -1;
  return 0;
}

/** A spoke's hue: the effect's base hue rotated by the node's bearing from the
 *  projected sphere centre, so the star reads as a colour wheel. */
export function prismSpokeHue(hue0, dx, dy) {
  return (hue0 + Math.atan2(dy, dx) * (180 / Math.PI) + 360) % 360;
}

/**
 * The control point of an arc bowed toward the projected sphere centre, into
 * `out` as [x, y]: the midpoint of AB pulled `pull` of the way to (cx, cy).
 *
 * Three layers draw this shape with three different pulls — the prism's chords
 * at 0.55 (with an extra per-spectral-line offset, hence its own function
 * above), the analogy filaments at 0.25 and the chimera fringes at 0.3. The
 * arithmetic is one line and it is written once, because the failure mode if it
 * drifts is a bundle that fans the wrong way rather than anything that looks
 * like a bug.
 */
export function arcControl(out, ax, ay, bx, by, cx, cy, pull) {
  const midX = (ax + bx) / 2, midY = (ay + by) / 2;
  out[0] = midX + (cx - midX) * pull;
  out[1] = midY + (cy - midY) * pull;
  return out;
}

// ── Analogy filaments ───────────────────────────────────────────────────────
// Golden threads between structurally similar nodes, under `lighter`. TWO
// dashed passes over the SAME quadratic: a wide diffuse glow and a sharp core
// over it — the resonance edge's shape, at a fifth of the brightness.
//
// `ctx.setLineDash([6,8])` is set before the wide pass and never reset between
// the two, and only cleared after the whole loop, so BOTH passes are dashed.
// A port that dashes only the glow looks very nearly right and is wrong.
//
// The core's width is a bare 0.8 while the glow's scales with the projection.
// That asymmetry is in the original; it is recorded here rather than tidied
// away, because tidying it would be a re-art and would show as a core that
// thickens toward the viewer.

export const FILAMENT_DEPTH_CUTOFF = -0.5;   // avgDepth below this: not drawn
export const FILAMENT_ALPHA_K = 0.65;        // strength * depthFade * this
export const FILAMENT_MIN_ALPHA = 0.01;      // below this: not drawn
export const FILAMENT_HUE_BASE = 40;         // golden, swinging 25-55
export const FILAMENT_HUE_SWING = 15;
export const FILAMENT_HUE_RATE = 0.7;        // x seconds
export const FILAMENT_HUE_NODE_K = 0.3;      // x the node INDEX — per-filament phase
export const FILAMENT_CP_PULL = 0.25;        // control point, toward the centre
export const FILAMENT_DASH = [6, 8];         // on, off — px, and NO dash offset

export const FILAMENT_GLOW_SAT = 85;
export const FILAMENT_GLOW_LIT = 65;
export const FILAMENT_GLOW_ALPHA_K = 0.35;
export const FILAMENT_GLOW_W = 3.5;          // x the mean projection scale
export const FILAMENT_CORE_SAT = 90;
export const FILAMENT_CORE_LIT = 88;
export const FILAMENT_CORE_ALPHA_K = 0.7;
export const FILAMENT_CORE_W = 0.8;          // a CONSTANT — see the note above

/** Depth fade, 0 at the far cutoff rising to 1 at the near pole. */
export function filamentDepthFade(avgDepth) {
  return Math.max(0, (avgDepth + 1) * 0.5);
}

/** A filament's envelope alpha. The glow pass takes FILAMENT_GLOW_ALPHA_K of
 *  it, the core pass FILAMENT_CORE_ALPHA_K. */
export function filamentAlpha(strength, depthFade) {
  return strength * depthFade * FILAMENT_ALPHA_K;
}

/**
 * A filament's hue, in degrees, TRUNCATED to an integer.
 *
 * The `| 0` is in the original and it is not cosmetic: it is a truncation
 * toward zero of a value that never goes negative here (25-55), so it is a
 * floor, and it quantises the shimmer to whole degrees. Keying off `iA` — the
 * node index, not the filament's position in the list — is what gives every
 * filament its own phase; a shared phase makes the whole bundle breathe as one
 * object, which is a different picture.
 */
export function filamentHue(seconds, iA) {
  return (FILAMENT_HUE_BASE
    + Math.sin(seconds * FILAMENT_HUE_RATE + iA * FILAMENT_HUE_NODE_K) * FILAMENT_HUE_SWING) | 0;
}

/** The glow pass's stroke width, scaled by the endpoints' mean projection. */
export function filamentGlowWidth(avgScale) {
  return FILAMENT_GLOW_W * avgScale;
}

// ── Chimera boundary fringes ────────────────────────────────────────────────
// Flickering interference at the border between a phase-locked cluster and a
// desynchronised one. One dashed quadratic per zone, between the two clusters'
// projected centroids, under `lighter`.
//
// The one thing here that no other layer in this file does: the dash pattern
// SCROLLS. `ctx.lineDashOffset = t * 30` slides it 30px/s along the path, which
// is why the instance buffer needed a phase field at all (see SphereEdges.js's
// "The 17th float").

export const CHIMERA_STRENGTH_K = 2;         // min(1, boundaryStrength * this)
export const CHIMERA_MIN_STRENGTH = 0.05;    // below this: not drawn
export const CHIMERA_HUE_BASE = 180;         // cyan, swinging 120-240
export const CHIMERA_HUE_SWING = 60;
export const CHIMERA_HUE_RATE = 3.5;         // x seconds
export const CHIMERA_HUE_SYNC_K = 10;        // x the A cluster's order parameter
export const CHIMERA_FLICKER_BASE = 0.4;     // 0.1 - 0.7
export const CHIMERA_FLICKER_SWING = 0.3;
export const CHIMERA_FLICKER_RATE = 7;
export const CHIMERA_FLICKER_SYNC_K = 5;     // x the B cluster's order parameter
export const CHIMERA_ALPHA_K = 0.25;
export const CHIMERA_SAT = 70;
export const CHIMERA_LIT = 60;
export const CHIMERA_W = 2;                  // + strength * CHIMERA_W_K
export const CHIMERA_W_K = 3;
export const CHIMERA_CP_PULL = 0.3;          // control point, toward the centre
export const CHIMERA_DASH = [4, 6];          // on, off — px
export const CHIMERA_DASH_RATE = 30;         // px per second of lineDashOffset

/** A zone's drawing strength, saturating at 1. */
export function chimeraStrength(boundaryStrength) {
  return Math.min(1, boundaryStrength * CHIMERA_STRENGTH_K);
}

/** Hue in degrees, truncated — the same `| 0` the filaments carry. Keyed off
 *  the A cluster's order parameter, so the colour reports which side is
 *  locked rather than merely oscillating on the clock. */
export function chimeraHue(seconds, syncA) {
  return (CHIMERA_HUE_BASE + Math.sin(seconds * CHIMERA_HUE_RATE + syncA * CHIMERA_HUE_SYNC_K)
    * CHIMERA_HUE_SWING) | 0;
}

/** The flicker multiplier, 0.1 to 0.7, at twice the hue's rate and keyed off
 *  the OTHER cluster — so hue and brightness beat against each other rather
 *  than pulsing together. */
export function chimeraFlicker(seconds, syncB) {
  return CHIMERA_FLICKER_BASE
    + Math.sin(seconds * CHIMERA_FLICKER_RATE + syncB * CHIMERA_FLICKER_SYNC_K) * CHIMERA_FLICKER_SWING;
}

/** Stroke alpha. Never clamped in the original either — the product cannot
 *  exceed 1 * 0.7 * 0.25. */
export function chimeraAlpha(strength, flicker) {
  return strength * flicker * CHIMERA_ALPHA_K;
}

/** Stroke width in px, 2 at strength 0 rising to 5 at strength 1. NOT scaled
 *  by the projection — the endpoints are cluster centroids, which have no
 *  single depth. */
export function chimeraWidth(strength) {
  return CHIMERA_W + strength * CHIMERA_W_K;
}

/** `ctx.lineDashOffset` in px at `seconds`. */
export function chimeraDashOffset(seconds) {
  return seconds * CHIMERA_DASH_RATE;
}

// ── The two orphan layers' instance budgets ─────────────────────────────────
// Read by MAX_ADDITIVE_EDGES in SphereEdges.js and ENFORCED in ArtTab's draw
// loop, exactly as PRISM_MAX_EFFECTS / PRISM_MAX_NODES are enforced in
// spawnEffect — a cap the buffer is sized from has to be a cap something
// actually applies, or it is a guess with a comment.
//
// Both are provably above what the simulation can produce today:
//
//   filaments  useAnalogicalReasoning keeps at most MAX_ANALOGIES = 6
//              analogies, and each contributes min(|A|,|B|) correspondence
//              pairs over clusters of 16, so at most 6 x 16 = 96. MEASURED at
//              96 in the live harness.
//   zones      one per ORDERED PAIR of the 17 declared clusters, C(17,2) = 136.
//              Measured peak in a 3551-frame harness run: 49.
export const FILAMENT_MAX_DRAWN = 96;
export const CHIMERA_MAX_ZONES = 136;

// ── The wire hum ────────────────────────────────────────────────────────────
//
// The graph's resting pulse. Each edge's whole length brightens and dims on a
// phase taken from its 3-D midpoint, so edges near each other in space breathe
// together and the pattern drifts across the sphere. NOTHING travels along an
// edge: a travelling highlight on this layer smears through the trail
// accumulator into a comet, which is why option A needed its own
// non-accumulating pass and this one does not.
//
// Applied as a multiply on `baseAlpha` in ArtTab's draw loop, which is the one
// scalar all four edge branches derive from. That is the entire integration —
// no shader, no 19th instance float (slot 16 is the dash phase), no pass.
//
// TWO THINGS ARE DELIBERATE AND WILL LOOK LIKE ARBITRARY CONSTANTS:
//
// `wavenumber` is NOT pi. Midpoints live on a unit sphere, so `dot(mid, axis)`
// spans [-1, 1] and `2 * wavenumber` is the phase across the diameter. At pi
// exactly one wavelength spans it, the poles sit in perfect antiphase, and the
// sphere reads as a rotating two-lobe blink — the mechanical failure in
// another costume. 2.0 puts ~0.64 of a cycle across the diameter instead.
//
// `axisPeriodMs` is not a small-integer multiple of `periodMs`. A fixed axis at
// a fixed rate is a metronome, so the axis traces a slow cone; if the two
// cycles re-phased on a low-order beat the whole pattern would visibly repeat.
//
// All five are AESTHETIC DIALS, to be chosen on frames rather than argued
// about — see `scripts/_a4hum.mjs`, which sweeps `amplitude` over one breath
// cycle the way `_a3bloom.mjs` swept the bloom.
//
// ── 2026-09-20: `amplitude` 0.15 -> 0.25 ────────────────────────────────────
//
// Raised because the effect was not visible unaided in a still, to either the
// implementer or the author — "idle the tab and feel the mesh breathe" is the
// real acceptance test, and a still frame cannot pass or fail it. MEASURED
// anyway, comparing matched frame index across amplitudes: `imm-a0-w2p0-f1`
// vs `imm-a0p22-w2p0-f1` gave meanAbs 0.3761, max 50, and 16575 pixels
// differing by more than 2 levels against ~129k lit pixels. That is a real,
// non-trivial delta already at 0.22 — the problem was never magnitude, it was
// that a single frame cannot show a breath at all.
//
// ── 2026-09-20: `periodMs` 9000 -> 11000, for GLACIALNESS ONLY ──────────────
//
// This is NOT a de-tune against the sphere's rotation, and the next reader
// will otherwise re-derive that wrong reason from the numbers alone.
// `AUTO_SPIN` (ArtTab.jsx:130) is 0.0025 rad/FRAME, so one rotation is 2513
// frames, and the spin's period in wall time is whatever the display's
// refresh rate makes it: 41.9 s at 60 Hz, 20.9 s at 120 Hz, 7.0 s at 360 Hz.
// There is no fixed `periodMs` that is reliably commensurate OR incommensurate
// with a period that changes per monitor — chasing one against the other is
// chasing a moving target. An apparent 1:1 beat measured earlier was an
// artefact of a headless capture running at ~284 fps, not a property of the
// app. 11000 was chosen purely because it reads as slower and more glacial
// than 9000 — nothing more.
// ── WHY 11000 BECAME 3500, AND WHY 0.25 CAME BACK ──────────────────────────
//
// The dated note above is kept because it is still the honest record of how
// 0.25 / 11000 was chosen. The RATE in it was superseded by looking. The
// amplitude went 0.25 -> 0.40 -> 0.25 and ended where it started, which is not
// the same as never having moved: 0.40 was what the author judged the carrier
// against, and the walk back down is measured rather than reverted. Both
// stories are below, rate first.
//
// THE HYPOTHESIS. The author reported the hum as imperceptible even with the
// sphere held STATIC, which rules out rotational masking. Two measurements
// then ruled out the other obvious causes:
//
//   - It is NOT a global dimmer. The per-edge gain spread at K = 2 is already
//     85-100% of the full swing at every point in the precession — some edges
//     sit at peak while others sit at trough. Raising K to 10 measures the
//     same, so wavenumber is not the lever.
//   - It IS reaching the render. Rotation-matched frame diffs put ~37,000
//     pixels beyond 2 levels and ~2,400-4,400 beyond 8.
//
// What is left is the PERCEPTUAL corner this lands in. A dormant edge is
// `(0.5 + maxEnergy * 0.8) * avgScale` wide — roughly 0.55 to 1.15 px, a
// sub-pixel dim line — and 11000 ms is 0.09 Hz, which is essentially DC.
// Temporal contrast sensitivity is at its floor there and spatial sensitivity
// falls off steeply for structures this thin. The effect modulates the least
// perceptible attribute of the least perceptible carrier at the least
// perceptible rate.
//
// 3500 ms is 0.29 Hz, toward a band the eye actually resolves, and it is a
// human breathing rate (3-5 s) rather than the "glacial" the design asked for
// — a word chosen at design time and never measured against anything.
//
// THE VERDICT, from the author looking at it: at 3500 / 0.40 the hum IS
// pulsing and visible, "but blink-and-you-miss-it, because the wire is too
// thin to carry it against the node bloom and grain." So the rate was HALF the
// problem and the carrier was the other half — which is what the glow shoulder
// below exists to fix. Both halves ship together; neither works alone.
//
// RULED AGAIN AFTER THE MERGE, and this is the verdict that governs: with the
// shoulder, amplitude at 0.25, and main's clock-stepped rotation underneath —
// a revolution in 41.9 s rather than the ~8.9 s a 283 fps panel was giving it,
// so roughly 4.7x more dwell per edge on the visible face — the author's read
// is "soft and gentle". That is the state these five constants are chosen for.
// The earlier 3500 / 0.40 verdict above is kept because it is the record of
// how the rate was settled, but it was taken against a sphere spinning five
// times faster and an alpha carrying the whole effect; do not quote it as the
// standing judgement.
//
// AMPLITUDE WAS WALKED BACK DOWN, 0.40 -> 0.25, ON MEASUREMENT.
//
// 0.40 was chosen while line alpha carried the entire effect. The glow
// shoulder carries it now, so the question became how much the alpha still
// contributes. Two instruments answer it, and only one of them can:
//
// THE BUFFER, which is deterministic. Rotation-matched against an
// amplitude-0 control — the only comparison that works, because rotation moves
// `depthFade` and therefore moves any alpha a trace samples — the hum's
// modulation of mean a0 is 0.0038 at 0.15, 0.0064 at 0.25, 0.0102 at 0.40.
// Per unit amplitude that is 0.0253 / 0.0256 / 0.0255: LINEAR, with no
// saturation anywhere in the range. So 0.25 buys 62% of what 0.40 buys, and
// nothing surprising happens between them.
//
// THE FRAME, which cannot resolve this. Ink swing across one pinned breath
// reads 11.27% at amplitude 0 (the shoulder alone) against 15-17% with the
// alpha, so the alpha is NOT redundant and is worth roughly a third of the
// total. But two runs of the SAME build measured 15.28% and 16.51%, a
// same-build floor of 1.23 points, which is most of the gap between 0.25 and
// 0.40. Any claim that one of them is better by ink is noise with a number
// attached — `artInk.mjs`'s own warning, paid for again here.
//
// So 0.25 is chosen on the linear buffer measurement plus the judgement that
// the alpha is a supporting actor now, NOT on a frame-level difference that
// this rig cannot see.
//
// A CORRECTION TO THE RECORD WHILE WALKING IT. The note this replaces said
// `packAlphas` CLAMPS at 255 and a bright edge "already reaches 1.41 before the
// hum", so a bigger amplitude would make the brightest edges DIP rather than
// swell — flicker, not breath. MEASURED AT REST, that is not happening: maxA0
// across the graph's edges is 0.761 at EVERY amplitude from 0.00 to 0.40,
// nowhere near the packed clamp, and identical across the sweep because the
// brightest edge is one with a live `e.pulse`, which `humGain` attenuates to
// no hum at all by design. The clamp argument may still hold in a fired
// cascade; it has not been measured there, and it is not a reason to keep the
// amplitude low in the resting sphere.
export const HUM = Object.freeze({
  amplitude:    0.25,   // +/- fraction of baseAlpha; walked down from 0.40, see above
  wavenumber:   2.0,    // radians of phase per unit of world distance
  periodMs:     3500,   // one breath; 0.29 Hz, chosen by eye over 11000's 0.09
  axisPeriodMs: 97000,  // one turn of the cone, ~27.7 breaths at 3500
  axisTilt:     1.05,   // radians off +Y; ~60 deg, neither polar nor equatorial
});

/**
 * The hum's phase at `nowMs`.
 *
 * ON THE CLOCK, NEVER ON A FRAME COUNT. A frame counter runs at double speed on
 * a 120Hz display — this repo has shipped that bug once already, in the /SCENT
 * collider. The capture harness virtualises performance.now() and advances it
 * FRAME_MS per pump, so reading the clock costs no reproducibility.
 */
export function humPhase(nowMs) {
  return (2 * Math.PI * nowMs) / HUM.periodMs;
}

/** The wave's direction at `nowMs` — a unit vector tracing a slow cone. */
export function humAxis(nowMs) {
  const theta = (2 * Math.PI * nowMs) / HUM.axisPeriodMs;
  const s = Math.sin(HUM.axisTilt);
  return { x: s * Math.cos(theta), y: Math.cos(HUM.axisTilt), z: s * Math.sin(theta) };
}

/**
 * Clamp to [0, 1]. Non-finite input (NaN, +/-Infinity, or anything else that
 * fails Number.isFinite) maps to 1, NOT 0 — see below.
 *
 * Under the old code `x < 0 ? 0 : x > 1 ? 1 : x`, NaN fails both comparisons
 * and falls through unclamped; -Infinity hits the first branch and returns 0
 * (the wrong end for our chosen treatment); +Infinity hits the second branch
 * and returns 1, which is already the correct end. `activity` is `e.pulse`, a
 * live mutable field this module does not control (useKineticEdges.js), so
 * that input class has to be handled deliberately, not assumed away.
 *
 * The two treatments are NOT interchangeable: in humGain, activity 0 means
 * full hum amplitude and activity 1 means none. Mapping corruption to 0
 * would make a bad reading force the sphere's brightest, most visible
 * behaviour with no way to distinguish it from a genuinely idle edge — the
 * failure reads as MORE motion. Mapping it to 1 makes the failure silent:
 * one edge quietly loses its hum instead. For a decorative, idle-state
 * effect, degrading toward less motion is the safer failure than degrading
 * toward an unverifiable amplitude spike, so non-finite input maps to 1.
 */
function clamp01(x) {
  if (!Number.isFinite(x)) return 1;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * The gain for one edge: 1 +/- HUM.amplitude, attenuated by `activity`.
 *
 * `mid` is the edge's 3-D midpoint, taken BEFORE projection. That is the
 * load-bearing choice in the whole design: a world-space wave is anchored to
 * the graph and rotates with it, where a screen-space one would be pinned to
 * the viewport and the sphere would appear to slide through a fixed curtain of
 * light. An antipodal edge has the origin for a midpoint, which is well
 * defined here — it simply rides the global phase.
 *
 * `activity` defaults to 0, so every existing caller and every test written
 * before this parameter existed sees IDENTICAL behaviour. At 1 it returns
 * exactly 1 — no hum at all. Values outside [0, 1] are clamped to the nearer
 * bound rather than left to overshoot the amplitude, and non-finite values
 * (NaN, +/-Infinity, or anything else `Number.isFinite` rejects) are treated
 * as 1 — no hum on that edge — not left to overshoot either; see clamp01's
 * comment for why 1 and not 0.
 *
 * WHY THIS ATTENUATES ON `pulse` (ArtTab's `e.pulse`, passed in as `activity`)
 * AND ON NOTHING ELSE — the design doc's section 7 proposed attenuating on
 * `spectralBoost + fusionBoost + pulseBoost` instead, and that reads as the
 * more complete fix. It is wrong. `spectralBoost` and `fusionBoost` are
 * PERMANENT STRUCTURAL properties of an edge — a spectral bridge is always a
 * spectral bridge, a fused bone stays fused — not events. Attenuating on them
 * would mute the hum on the sphere's brightest permanent structure, the edges
 * the eye actually rests on, and leave it only on the dim dormant edges that
 * `depthFade` has already darkened — making the hum LESS visible, not more.
 * `pulse` is the only genuinely transient term of the three: it is 1.0 the
 * instant an edge is overwritten and decays back to 0 (see `e.pulse` in
 * useKineticEdges.js), which is exactly "something just happened here, let
 * the hum step aside for it" and nothing else in `baseAlpha` means that.
 *
 * The strimer cannot flicker from this under any of the design doc's options:
 * it renders on its own non-accumulating layer, after `SourceQuad` and before
 * the composer (SphereComposite.jsx), and never touches `baseAlpha`.
 */
/**
 * The hum's signed wave for one edge, in [-1, 1], before any amplitude.
 *
 * Split out of humGain so the glow shoulder can ride the SAME wave as the
 * alpha rather than a second oscillator that would drift against it.
 */
export function humWave(mid, axis, phase) {
  const d = mid.x * axis.x + mid.y * axis.y + mid.z * axis.z;
  return Math.sin(phase - HUM.wavenumber * d);
}

// ── The breathing glow shoulder ─────────────────────────────────────────────
//
// WHY THE FLOOR IS 6 AND NOT 0, and this is the whole reason this is viable
// without touching certified shader code: EDGE_FRAG does NOT carry a shadow
// alpha. It DERIVES one from the radius, on the assumption the radius came
// from fusedGlow():
//
//     float fuseCos = clamp((vGlow - FUSED_GLOW_BASE) / FUSED_GLOW_SCALE, 0, 1);
//     float shadowAlpha = mix(fuseCos * 0.6, 1.0, vIsOrtho);
//
// FUSED_GLOW_BASE is 6, so ANY radius at or below 6 px renders shadowAlpha 0 —
// an invisible halo. A "breathe the glow from 0 to 5px" implementation would
// have produced nothing at all and read as a wiring bug, not as a dial that
// needed turning.
//
// Taken as a gift rather than worked around: over [6, 10] the derived alpha
// runs [0, 0.3], so the halo's SIZE and its INTENSITY breathe together, which
// is what a swelling glow does physically. The trough is genuinely absent
// rather than merely small, so the resting sphere is unchanged.
//
// The halo colour is vC1, the edge's own mid stop, for every non-ortho
// instance — so this tints itself and needs no colour of its own.
//
// ── WHY THE SWING IS A RATIO AND THE FLOOR IS NOT ──────────────────────────
// MEASURED (`scripts/_a8glow.mjs`, both viewports, one pinned world): the
// crest was a flat 10.000 px on a sphere of radius 410.83 AND on a phone's
// 162.83, i.e. **2.43% of the sphere on a desktop and 6.14% on a phone** —
// 2.5x wider relative to the artwork, with the breath's area swing going
// 14.18% -> 26.65%. The halo was authored against one geometry and then drawn
// at that pixel size on every other. Same class as the certified `inkScale`
// lesson: write it as a RATIO, never a literal.
//
// The FLOOR cannot take the same treatment, and this is the constraint, not an
// oversight. `FUSED_GLOW_BASE` is the shader's own zero — below it the derived
// alpha is 0 and nothing draws at all — and it is an ABSOLUTE px constant
// baked into EDGE_FRAG at build time. A strictly proportional radius would put
// a phone's crest at 10 * 162.83/410.83 = 3.96 px, under that floor, and the
// halo would not render AT ALL on the one platform this pass exists to serve.
// Size and opacity are the same dial here; there is no freedom to scale one.
//
// So the swing scales and the floor stays where the shader put it. Closing the
// rest means scaling `FUSED_GLOW_BASE`/`FUSED_GLOW_SCALE` with the sphere,
// which is certified shader code that also governs every FUSED edge's alpha.
//
// ── WHY THE SWING IS SPLIT AND NOT PURELY PROPORTIONAL ─────────────────────
// A purely proportional swing left a phone at 7.585 px and a derived alpha of
// 0.119, against the desktop's 10 and 0.3 — SMALLER AND DIMMER, on the one
// platform where the carrier was already weakest. That is this shader's doing,
// not the ratio's: opacity is welded to radius, so shrinking the halo dims it.
//
// Raising the whole swing is not a fix either, because the same number
// multiplies both geometries: giving the phone back its 0.3 needs a swing that
// puts the DESKTOP crest at 16.09 px, past `ceiling`, clamped, at alpha 0.74 —
// two and a half times the look that was actually ruled.
//
// So the swing has a FIXED part and a PROPORTIONAL part, and they sum back to
// `swingPx` exactly at `refSphereR` whatever the split — which is what pins
// the certified sphere by construction rather than by luck. `fixedShare` is
// then the only dial, and it is honest about what it trades: 0 is purely
// proportional (a phone goes dim), 1 is the absolute px literal this whole
// note exists to explain. At 0.5 the phone reads 8.79 px / alpha 0.209.
export const HUM_GLOW = Object.freeze({
  // The swing the author ruled socks/10, in px, and the sphere he ruled it on.
  // `refSphereR` IS a runtime denominator, which is the shape of the certified
  // `inkScale` trap — but not the trap itself: inkScale's literal 580 stood in
  // for a height that actually varies with width, whereas this is a fixed
  // provenance anchor, the geometry of one capture. Its own breath-phase
  // ambiguity is 0.6%, i.e. 0.02 px of swing, an eighth of the packed quantum.
  swingPx: 4,
  refSphereR: 410.83,
  // How much of the swing ignores the sphere. 0 = purely proportional and a
  // phone goes dim; 1 = the old absolute px literal. Chosen by the author.
  fixedShare: 0.5,
  // packFlags rounds glow to eighths and clamps at 127, i.e. 15.875 px. On a
  // fixed 10 px crest that clamp was unreachable arithmetic; a proportional
  // swing makes it reachable on a big enough wall, so it is clamped HERE where
  // it can be seen rather than silently inside the packing.
  ceiling: 15.875,
});

/**
 * Glow radius in px for a base edge, from the hum's own wave.
 *
 * `wave` is humWave()'s [-1, 1]. `activity` is the same transient attenuation
 * humGain takes: an edge that was just overwritten keeps its halo still rather
 * than breathing under the pulse ring travelling along it. `sphereR` is the
 * draw loop's own sphere radius, and it is REQUIRED — a default would be the
 * px literal this function exists to delete, and a missing one reads as NaN in
 * `_a8glow.mjs`'s glow probe rather than as a plausible wrong size.
 */
export function humGlowRadius(wave, activity = 0, sphereR) {
  const a = 1 - clamp01(activity);
  const { swingPx, refSphereR, fixedShare } = HUM_GLOW;
  const swing = swingPx * (fixedShare + (1 - fixedShare) * (sphereR / refSphereR));
  return Math.min(FUSED_GLOW_BASE + swing * a * (0.5 + 0.5 * wave), HUM_GLOW.ceiling);
}

export function humGain(mid, axis, phase, activity = 0) {
  const effAmplitude = HUM.amplitude * (1 - clamp01(activity));
  return 1 + effAmplitude * humWave(mid, axis, phase);
}

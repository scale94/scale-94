// artNodes.js — the parameters behind the sphere's node layers.
//
// Step 5 moves the node discs, their halos and their six rings onto the GPU.
// These numbers were inline in ArtTab's draw loop; they are lifted here so the
// shader and the 2D code it replaces provably read one source of truth, and so
// every one of them is testable without a canvas.
//
// Nothing here is re-derived. Where a source comment disagreed with the
// arithmetic beside it, the arithmetic won and the discrepancy is recorded —
// see `spectralTint`, whose hue lerp does not do what its neighbours assume.
//
// The pre-flight scan (.superpowers/sdd/step5-preflight.md) is the authority on
// what the block contains: THIRTEEN draw layers where the spec named seven.
// This module covers the maths for all of them plus the five state paths the
// spec omits. It draws nothing and imports no canvas.

// ── Depth cue, radius, core ─────────────────────────────────────────────────

/** Hover adds a flat energy bonus BEFORE radius and alpha are derived, so a
 *  hovered node is both larger and brighter from one term. */
export const HOVER_ENERGY_BONUS = 0.55;

export const NODE_RADIUS_BASE = 5;
export const NODE_RADIUS_ENERGY_K = 4;

export const DEPTH_ALPHA_FLOOR = 0.08;

/** Non-selected nodes while resonance is armed. A tenth, not a half — this is
 *  the layer that made the whole resonance capture state worth fixing. */
export const RESONANCE_DIM = 0.10;

export const CORE_ALPHA_BASE = 0.45;
export const CORE_ALPHA_ENERGY_K = 0.55;

export function nodeEnergy(baseEnergy, isHovered) {
  return baseEnergy + (isHovered ? HOVER_ENERGY_BONUS : 0);
}

/**
 * Depth cuing: nodes on the far side are dimmer, with a floor so they never
 * vanish entirely. `depth` is the projection's own -1..1 term.
 */
export function depthCueAlpha(depth) {
  return Math.max(DEPTH_ALPHA_FLOOR, (depth + 1) * 0.5);
}

/**
 * Resonance dimming, applied ON TOP of the depth cue.
 *
 * Note the gate: dimming happens when resonance is active and this node is not
 * one of the selected pair. With nothing selected `active` is false and every
 * node keeps its own alpha — which is why a capture that armed the mode but
 * selected nothing showed no dimming at all, and scored perfect parity against
 * a build with this layer deleted.
 */
export function resonanceDimmed(depthAlpha, active, isSelected) {
  return active && !isSelected ? depthAlpha * RESONANCE_DIM : depthAlpha;
}

export function nodeRadius(energy, scale) {
  return (NODE_RADIUS_BASE + energy * NODE_RADIUS_ENERGY_K) * scale;
}

/**
 * The core disc's alpha.
 *
 * A HOVERED core does not use this. The draw loop takes `renderCol.hsl`, which
 * is fully opaque, so a hovered node bypasses both this and the depth cue —
 * a back-facing hovered node is drawn at full opacity. `coreIsOpaque` names
 * that branch so the GL writer cannot forget it; it is the one place in the
 * block where depthAlpha does not reach the pixel.
 */
export function coreAlpha(energy, depthAlpha) {
  return (CORE_ALPHA_BASE + energy * CORE_ALPHA_ENERGY_K) * depthAlpha;
}

export function coreIsOpaque(isHovered) {
  return !!isHovered;
}

/**
 * WHICH colour object the core is actually drawn in — and it is not always the
 * one the halo uses.
 *
 * `hslAlpha()` reads hue/sat/lit, so a non-hovered core and the halo both get
 * the FULLY TINTED colour. A hovered core takes `renderCol.hsl`, the
 * pre-rendered string — and `spectralTint()` passes `hsl` through UNCHANGED
 * while rewriting hue and sat. So a hovered node is drawn in its PRE-SPECTRAL
 * colour while everything around it is drawn post-tint.
 *
 * That is not a rounding difference. The census measured the spectral branch
 * firing on 31 of 31 nodes in every capture state, so it is true of every
 * hovered node in the shipping build.
 *
 * `lerpColor()` by contrast RECOMPUTES `hsl`, so the bleed is present in both.
 * The split is spectral-only.
 *
 * Faithful parity means reproducing it: pass the pre-tint colour as `preTint`
 * and this returns the object whose hue/sat/lit match the string the canvas
 * would have used. A GL writer that just takes `renderCol` recolours the one
 * node the viewer is pointing at.
 */
export function coreColorSource(renderCol, preTint, isHovered) {
  return isHovered ? preTint : renderCol;
}

// ── Birth animation ─────────────────────────────────────────────────────────

export const BIRTH_MS = 400;

/** Cubic ease-out, matching CSS ease-out cubic: 1 - (1-t)^3. */
export function birthEase(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Where a newborn node is in its 400ms flight from the parent.
 *
 * Returns null once the animation is over, which is the draw loop's signal to
 * DELETE the birth entry — the caller owns that side effect, this stays pure.
 */
export function birthProgress(elapsedMs) {
  if (elapsedMs >= BIRTH_MS) return null;
  const t = elapsedMs / BIRTH_MS;
  return { t, ease: birthEase(t) };
}

/**
 * Blend a projected point from the parent's position toward the child's own.
 * Every field of the projection is interpolated, `scale` and `depth` included —
 * a newborn grows and takes on its depth cue as it travels.
 */
export function birthProject(fromP, toP, ease) {
  return {
    sx:    fromP.sx    + (toP.sx    - fromP.sx)    * ease,
    sy:    fromP.sy    + (toP.sy    - fromP.sy)    * ease,
    depth: fromP.depth + (toP.depth - fromP.depth) * ease,
    scale: fromP.scale + (toP.scale - fromP.scale) * ease,
  };
}

// ── Overwrite bleed ─────────────────────────────────────────────────────────

export const BLEED_COLOR_K = 0.7;

/** The mix factor handed to lerpColor(nodeColour, sourceColour, t). */
export function bleedMix(bleedAmount) {
  return bleedAmount * BLEED_COLOR_K;
}

// ── Spectral PCA tint ───────────────────────────────────────────────────────

export const SPECTRAL_BLEND_BASE = 0.08;
export const SPECTRAL_BLEND_FLUX_K = 0.15;
export const SPECTRAL_SAT_K = 0.3;

export function spectralBlend(flux) {
  return SPECTRAL_BLEND_BASE + flux * SPECTRAL_BLEND_FLUX_K;
}

/**
 * Hue of an RGB triple in 0..1 floats, in degrees. The draw loop's own
 * six-sector form, kept verbatim rather than routed through a library one:
 * the `% 6` sits INSIDE the multiply by 60 (`((g-b)/d + 6) % 6 * 60`), and a
 * rewrite that moves it produces the same numbers everywhere except the red
 * wrap, which is exactly where it would not be noticed.
 */
export function rgbHue(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max <= min) return 0;
  const d = max - min;
  if (max === r) return ((g - b) / d + 6) % 6 * 60;
  if (max === g) return ((b - r) / d + 2) * 60;
  return ((r - g) / d + 4) * 60;
}

/**
 * Shift a node's colour toward the spectral eigenvector's hue.
 *
 * RECORDED DISCREPANCY: the hue term is a PLAIN LINEAR LERP, not a shortest-arc
 * one. A node at hue 350 tinted toward hue 10 travels backwards through 180
 * rather than forward through 0. At the 8-23% blend this layer uses the excursion
 * is small, and it is the shipping behaviour — but a shader that interpolates
 * hue "correctly" on the circle will not match, and the mismatch appears only
 * for nodes near the red wrap. Do not fix it here; it is not this step's call.
 *
 * `lit` and `hsl` pass through untouched: the tint moves hue and saturation
 * only, and `hsl` is the pre-rendered opaque string the hovered core uses.
 */
export function spectralTint(col, spc, flux) {
  if (!spc || col.hue == null) return col;
  const blend = spectralBlend(flux);
  const r = spc[0], g = spc[1], b = spc[2];
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const hue = rgbHue(r, g, b);
  const sat = (max - min) / Math.max(max, 0.001) * 100;
  return {
    hue: col.hue + (hue - col.hue) * blend,
    sat: col.sat + (sat - col.sat) * blend * SPECTRAL_SAT_K,
    lit: col.lit,
    hsl: col.hsl,
  };
}

// ── Layer 1: the glow halo ──────────────────────────────────────────────────
//
// A createRadialGradient, NOT a shadowBlur. Alpha is flat inside the inner
// stop and falls LINEARLY to zero at the outer one. The edge mesh's existing
// glow is a gaussian shoulder modelling ctx.shadowBlur, which is a different
// falloff and a different amplitude law; substituting it here passes any
// single-radius reading and is wrong at every other radius.

export const HALO_INNER_K = 0.4;       // inner stop, as a fraction of the radius
export const HALO_REACH = 16;          // px of reach per unit energy, before scale
export const HALO_BLEED_REACH_K = 0.4;
export const HALO_ALPHA_K = 0.38;
export const HALO_BLEED_ALPHA_K = 0.25;
export const HALO_ENERGY_CUTOFF = 0.08;

/** The halo is skipped entirely below this energy unless the node is bleeding. */
export function haloDraws(energy, bleedAmount) {
  return energy > HALO_ENERGY_CUTOFF || bleedAmount > 0;
}

export function haloRadius(radius, energy, bleedAmount, scale) {
  return radius + (energy + bleedAmount * HALO_BLEED_REACH_K) * HALO_REACH * scale;
}

/** Where the gradient stops being flat. Not scaled — it rides the radius. */
export function haloInnerRadius(radius) {
  return radius * HALO_INNER_K;
}

export function haloAlpha(energy, bleedAmount, depthAlpha) {
  return (energy + bleedAmount * HALO_BLEED_ALPHA_K) * HALO_ALPHA_K * depthAlpha;
}

// ── Stroked circles, as annuli ──────────────────────────────────────────────
//
// Every ring in this block is `ctx.arc(r) + stroke` with a `lineWidth`, and a
// canvas stroke is centred ON the path: it covers r - w/2 to r + w/2. The
// shader's annulus wants those two radii, so a ring that hands `r` straight
// through as the outer radius draws something a half-width too small AND
// FILLED, which at a glance looks like a ring with a bright middle rather than
// like a bug. This is the one conversion between the two representations.

export function strokeAnnulus(radius, lineWidth) {
  const half = lineWidth * 0.5;
  return {
    rOuter: radius + half,
    // Clamped, not signed: a width wider than the diameter makes the canvas
    // stroke cover the centre, which IS a filled disc, and rInner = 0 is
    // exactly how the encoding spells that. A negative would be rejected by
    // discEncodingInvariant() instead of rendering.
    rInner: Math.max(0, radius - half),
  };
}

// ── Layer 3: the awakening beacon ring ──────────────────────────────────────
//
// Additive. Fires for ONE node (aw.beaconIdx % nodeCount) during awakening
// phase 1 only. MEASURED: that window runs from elapsed 4.1s to 8.0s of a real
// boot, and every harness capture virtualises the clock past it — no reference
// image has ever contained this layer.

export const BEACON_PULSE_BASE = 0.3;
export const BEACON_PULSE_K = 0.5;
export const BEACON_R_BASE = 6;
export const BEACON_R_PULSE_K = 6;
export const BEACON_ALPHA_K = 0.2;
export const BEACON_WIDTH = 1.5;
export const BEACON_HUE_FALLBACK = 40;
export const BEACON_SAT = 70;
export const BEACON_LIT = 65;

/** sin² rather than sin: the ring swells and returns without going dark. */
export function beaconPulse(tSeconds) {
  return BEACON_PULSE_BASE + BEACON_PULSE_K * Math.pow(Math.sin(tSeconds * 2.0), 2);
}

export function beaconRadius(radius, pulse, scale) {
  return radius + (BEACON_R_BASE + pulse * BEACON_R_PULSE_K) * scale;
}

export function beaconAlpha(pulse, depthAlpha) {
  return pulse * BEACON_ALPHA_K * depthAlpha;
}

// ── Layer 4: the chimera SYNC ring ──────────────────────────────────────────

export const CHIMERA_SYNC_ALPHA_K = 0.18;
export const CHIMERA_SYNC_R = 6;
export const CHIMERA_SYNC_WIDTH = 1.5;
export const CHIMERA_ALPHA_CUTOFF = 0.01;
export const CHIMERA_SYNC_HSL = Object.freeze({ hue: 45, sat: 90, lit: 70 });

export function chimeraSyncPulse(tSeconds, meanPhase) {
  return 0.5 + 0.5 * Math.sin(tSeconds * 2 + meanPhase);
}

/**
 * Note this can round to zero for a whole frame: under a pinned virtual clock
 * `tSeconds` is fixed, so one meanPhase puts every cluster at the trough and
 * the cutoff below drops the layer entirely. A forcing harness that does not
 * sweep the phase will capture an empty frame and believe it forced the layer
 * on — measured, in this branch, twice.
 */
export function chimeraSyncAlpha(orderParam, pulse, depthAlpha) {
  return orderParam * pulse * CHIMERA_SYNC_ALPHA_K * depthAlpha;
}

export function chimeraSyncRadius(radius, scale) {
  return radius + CHIMERA_SYNC_R * scale;
}

// ── Layer 5: the chimera FLICKER ring ───────────────────────────────────────
//
// Dashed [3,4], and the only ring whose HUE animates. The node index enters
// both the alpha and the hue, so adjacent nodes flicker out of step.

export const CHIMERA_FLICK_RATE_BASE = 5;
export const CHIMERA_FLICK_RATE_K = 8;
export const CHIMERA_FLICK_ALPHA_BASE = 0.15;
export const CHIMERA_FLICK_ALPHA_K = 0.12;
export const CHIMERA_FLICK_R = 8;
export const CHIMERA_FLICK_WIDTH = 1.0;
export const CHIMERA_FLICK_DASH = [3, 4];
export const CHIMERA_FLICK_SAT = 80;
export const CHIMERA_FLICK_LIT = 60;
export const CHIMERA_FLICK_HUE_BASE = 200;
export const CHIMERA_FLICK_HUE_SWING = 40;

export function chimeraFlickRate(orderParam) {
  return CHIMERA_FLICK_RATE_BASE + orderParam * CHIMERA_FLICK_RATE_K;
}

/** Can go NEGATIVE — the base is 0.15 and the swing is ±0.12, so it stays
 *  positive, but only just, and the cutoff below is what the draw loop gates
 *  on rather than a clamp. Kept as-is. */
export function chimeraFlickAlpha(tSeconds, rate, nodeIndex, depthAlpha) {
  return (CHIMERA_FLICK_ALPHA_BASE
    + Math.sin(tSeconds * rate + nodeIndex) * CHIMERA_FLICK_ALPHA_K) * depthAlpha;
}

export function chimeraFlickRadius(radius, scale) {
  return radius + CHIMERA_FLICK_R * scale;
}

/** Truncated to an integer with `| 0`, exactly as the draw loop does — the
 *  hue steps rather than sweeps, and that is the shipping look. */
export function chimeraFlickHue(tSeconds, nodeIndex) {
  return (CHIMERA_FLICK_HUE_BASE
    + Math.sin(tSeconds * 1.3 + nodeIndex * 0.7) * CHIMERA_FLICK_HUE_SWING) | 0;
}

// ── Layers 6 & 7: the Gestalt ghost rings ───────────────────────────────────
//
// Additive, and the inner ring is a PARTIAL ARC: its sweep angle IS the
// completion readout. Porting it as a full circle loses the entire animation
// while leaving something that still looks like a ring.

export const GHOST_CUTOFF = 0.02;
export const GHOST_R_BASE = 4;
export const GHOST_R_K = 6;
export const GHOST_OUTER_GAP = 3;
export const GHOST_INNER_ALPHA_K = 0.5;
export const GHOST_OUTER_ALPHA_K = 0.2;
export const GHOST_INNER_WIDTH = 1.5;
export const GHOST_OUTER_WIDTH = 3;
// The field names every colour object in this port carries, so these go
// straight into writeHslRgb without a second conversion — which is exactly
// where a drifting copy of the hsl-to-rgb maths would appear.
export const GHOST_INNER_HSL = Object.freeze({ hue: 180, sat: 70, lit: 75 });
export const GHOST_OUTER_HSL = Object.freeze({ hue: 180, sat: 60, lit: 85 });

/**
 * The inner ring's sweep as the ENCODING wants it, not as ctx.arc wants it.
 *
 * `writeDisc` reads a sweepEnd of 0 as "full circle" — the sentinel that lets
 * every filled disc in the buffer carry a zero there — and the shader gates its
 * whole sweep branch on `step(1e-6, sweepEnd)`. Passing 2pi instead would take
 * the branch, and the branch antialiases BOTH ends of the arc: at g = 1 the
 * start and the end land on the same angle and the seam comes out at half
 * brightness, about a pixel of it. ctx.arc(0, 2pi) has no seam. So a complete
 * ghost is written as a full circle, which is what it is.
 */
export function ghostSweepEncoded(g) {
  return g >= 1 ? 0 : ghostSweep(g);
}

export function ghostDraws(g) {
  return g > GHOST_CUTOFF;
}

export function ghostRadius(radius, g, scale) {
  return radius + GHOST_R_BASE * scale + g * GHOST_R_K * scale;
}

export function ghostOuterRadius(ghostR, scale) {
  return ghostR + GHOST_OUTER_GAP * scale;
}

export function ghostAlpha(g, depthAlpha) {
  return g * depthAlpha;
}

/** The inner ring's sweep, in radians from angle 0. The whole point of the
 *  layer. At g = 1 this is a full circle and the arc degenerates correctly. */
export function ghostSweep(g) {
  return Math.PI * 2 * g;
}

// ── Layer 9 & 10: manual fusion ─────────────────────────────────────────────

export const FUSION_PULSE_RATE = 5;
export const FUSION_R_BASE = 8;
export const FUSION_R_PULSE_K = 6;
export const FUSION_RING_WIDTH = 1.5;
export const FUSION_RING_DASH = [5, 4];
export const FUSION_RING_ALPHA_BASE = 0.55;
export const FUSION_RING_ALPHA_K = 0.45;
export const FUSION_THREAD_WIDTH = 1;
export const FUSION_THREAD_DASH = [3, 6];
export const FUSION_THREAD_ALPHA_BASE = 0.3;
export const FUSION_THREAD_ALPHA_K = 0.15;

export function fusionPulse(tSeconds) {
  return 0.5 + 0.5 * Math.sin(tSeconds * FUSION_PULSE_RATE);
}

/**
 * The ring reuses the node's OWN radius formula and then adds to it —
 * `(5 + energy*4 + 8 + pulse*6) * scale` — so it is not `nodeRadius() + k`,
 * it is the same polynomial with two more terms inside the scale multiply.
 * Written out here rather than composed, because composing it changes nothing
 * today and would silently diverge the moment NODE_RADIUS_BASE moves.
 */
export function fusionRingRadius(energy, pulse, scale) {
  return (NODE_RADIUS_BASE + energy * NODE_RADIUS_ENERGY_K
    + FUSION_R_BASE + pulse * FUSION_R_PULSE_K) * scale;
}

export function fusionRingAlpha(pulse) {
  return FUSION_RING_ALPHA_BASE + pulse * FUSION_RING_ALPHA_K;
}

/** No depth cue on the thread — it runs to the cursor, which has no depth. */
export function fusionThreadAlpha(pulse) {
  return FUSION_THREAD_ALPHA_BASE + pulse * FUSION_THREAD_ALPHA_K;
}

// ── Layers 11-13: the probe node ────────────────────────────────────────────

export const PROBE_R = 6;
export const PROBE_GLOW_K = 14;
export const PROBE_GLOW_INNER_K = 0.3;
export const PROBE_GLOW_ALPHA = 0.45;
export const PROBE_CORE_ALPHA_BASE = 0.75;
export const PROBE_CORE_ALPHA_K = 0.25;
export const PROBE_DEPTH_FLOOR = 0.12;
export const PROBE_TETHER_WIDTH = 0.9;
export const PROBE_TETHER_DASH = [3, 5];
export const PROBE_TETHER_ALPHA_K = 0.55;
export const PROBE_GLOW_RGB = [167, 139, 250];
export const PROBE_CORE_RGB = [196, 181, 253];

/** Driven by Date.now(), not performance.now() — a different clock from every
 *  other pulse in this block, and one the determinism shim pins separately. */
export function probePulse(msEpoch) {
  return (Math.sin(msEpoch * 0.003) + 1) * 0.5;
}

/** A HIGHER floor than the nodes' 0.08, and taken from the rotated z directly
 *  rather than from the projection's depth term. Both are the shipping
 *  behaviour and neither matches the node path. */
export function probeDepthAlpha(rz) {
  return Math.max(PROBE_DEPTH_FLOOR, (rz + 1) * 0.5);
}

export function probeRadius(scale) {
  return PROBE_R * scale;
}

export function probeGlowRadius(probeR, pulse, scale) {
  return probeR + pulse * PROBE_GLOW_K * scale;
}

export function probeGlowInnerRadius(probeR) {
  return probeR * PROBE_GLOW_INNER_K;
}

export function probeCoreAlpha(pulse, depthAlpha) {
  return (PROBE_CORE_ALPHA_BASE + pulse * PROBE_CORE_ALPHA_K) * depthAlpha;
}

/** Relative to the STRONGEST anchor, not to the sum: the brightest tether is
 *  always at full strength however weak the match overall. */
export function probeTetherAlpha(weight, wmax, depthAlpha) {
  return (weight / wmax) * PROBE_TETHER_ALPHA_K * depthAlpha;
}

/**
 * The weighted centroid of a probe's anchors, normalised back onto the unit
 * sphere. Returns null when nothing resolved, which is the draw loop's own
 * `wsum > 1e-12` gate.
 *
 * `anchors` arrive already collapsed onto sphere nodes, but `resolve` may still
 * return -1 for one that is off-sphere, and those contribute nothing — the
 * centroid forms from whatever is left.
 */
export function probeCentroid(anchors, resolve) {
  let wx = 0, wy = 0, wz = 0, wsum = 0, wmax = 0;
  const tethers = [];
  for (const { id, weight } of anchors) {
    const node = resolve(id);
    if (!node) continue;
    wx += node.x * weight;
    wy += node.y * weight;
    wz += node.z * weight;
    wsum += weight;
    if (weight > wmax) wmax = weight;
    tethers.push({ node, weight });
  }
  if (wsum <= 1e-12) return null;
  wx /= wsum; wy /= wsum; wz /= wsum;
  const len = Math.sqrt(wx * wx + wy * wy + wz * wz);
  if (len > 1e-12) { wx /= len; wy /= len; wz /= len; }
  return { x: wx, y: wy, z: wz, wmax, tethers };
}

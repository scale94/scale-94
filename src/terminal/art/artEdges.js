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

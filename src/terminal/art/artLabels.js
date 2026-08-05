// artLabels.js — pure label visibility and placement for the /art sphere.
//
// Extracted verbatim from ArtTab's draw loop when labels moved from canvas
// fillText to a DOM overlay. Nothing here draws; it answers "should this
// label be visible, where, and how bright", so the answer can be tested
// without a canvas and rendered by either backend.
//
// All coordinates are CSS pixels: the draw loop projects against the
// contentRect size and applies the DPR as a canvas transform, so projected
// values need no conversion for DOM positioning.

export const FIRE_FADE_IN = 0.35;
export const FIRE_HOLD_END = 2.5;
export const FIRE_FADE_OUT_END = 3.5;
export const FIRE_EXPIRY = 3.8;
export const CLUSTER_LABEL_MIN_Z = -0.2;

/**
 * fireAlphaFor — the fired-node cascade envelope.
 * The seed fires instantly; neighbours are staggered 80-200ms by index so the
 * cascade reads as propagation rather than a simultaneous flash.
 */
export function fireAlphaFor({ elapsed, isSeed, index }) {
  const delay = isSeed ? 0 : 0.08 + (index % 5) * 0.025;
  const t = elapsed - delay;

  let a;
  if (t < 0)                      a = 0;
  else if (t < FIRE_FADE_IN)      a = t / FIRE_FADE_IN;
  else if (t < FIRE_HOLD_END)     a = 1.0;
  else if (t < FIRE_FADE_OUT_END) a = 1.0 - (t - FIRE_HOLD_END);
  else                            a = 0;

  return a * (isSeed ? 0.95 : 0.80);
}

/** The cascade ref is cleared once every label in it has faded. */
export function fireExpired(elapsed) {
  return elapsed > FIRE_EXPIRY;
}

/**
 * nodeLabelState — composites three independent visibility sources (hover,
 * high energy, fired cascade) and returns the brightest, or null if the label
 * should not render at all.
 */
export function nodeLabelState({
  node, projected, index, isHovered, fired, elapsed, depthAlpha, radius,
}) {
  const isSeed = !!fired && node.id === fired.seedId;
  const inFire = !!fired && fired.neighborIds.has(node.id);
  const fireAlpha = inFire
    ? fireAlphaFor({ elapsed, isSeed, index }) * depthAlpha
    : 0;

  const showHover  = !!isHovered;
  const showEnergy = node.energy > 0.45 && projected.depth > -0.1;
  const showFire   = fireAlpha > 0.01;
  if (!showHover && !showEnergy && !showFire) return null;

  const hoverA  = showHover  ? 0.92 : 0;
  const energyA = showEnergy ? node.energy * 0.80 * depthAlpha : 0;
  const la      = Math.max(hoverA, energyA, fireAlpha);

  const fontSize = Math.round(
    ((showHover || isSeed) ? 10 : showFire ? 9 : 8) * projected.scale,
  );

  return {
    text: node.label,
    x: projected.sx,
    y: projected.sy - radius - 4,
    alpha: la * (showHover ? 1.0 : 0.82),
    fontSize,
  };
}

/**
 * clusterLabelState — the ghost labels at projected cluster anchor positions.
 * Very low alpha by design; they are atmosphere, not navigation.
 */
export function clusterLabelState({ rz, projected, text }) {
  if (rz < CLUSTER_LABEL_MIN_Z) return null;
  return {
    text: text.toUpperCase(),
    x: projected.sx,
    y: projected.sy - 52 * projected.scale,
    alpha: Math.max(0, rz) * 0.12,
    fontSize: 9,
  };
}

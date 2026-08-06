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
export const BLOOM = {
  luminanceThreshold: 0.28,
  luminanceSmoothing: 0.9,
  intensity: 1.1,
  mipmapBlur: true,
  radius: 0.7,
};

// Immersive only. Replaces the 2D radial-gradient vignette, which ran to
// rgba(0,0,0,0.65) at the corners.
export const VIGNETTE = {
  offset: 0.32,
  darkness: 0.65,
};

// artTrail.js — the arithmetic of the 2D canvas's trail accumulation.
//
// ArtTab's draw loop clears with `destination-out` and rgba(0,0,0,m), which
// multiplies existing alpha by (1 - m) rather than wiping it. Everything then
// draws source-over on the survivors, so a layer redrawn every frame settles
// well above the alpha it is drawn with. A layer that moves to the GPU draws
// into a target that IS fully rewritten each frame and silently loses this.
//
// m comes from riftTint() and is per-mode: 0.72 normal, 0.32 immersive. The
// immersive value is the one that matters — it is the exhibit mode, and 1/0.32
// is why the edges nearly vanished there when they moved to GL.

/** Fraction of existing ink that survives one frame's erase. */
export function trailSurvival(m) {
  return 1 - m;
}

/** Steady-state alpha of a layer redrawn at alpha `a` every frame. */
export function steadyState(a, m) {
  const denom = 1 - trailSurvival(m) * (1 - a);
  return denom <= 0 ? 1 : Math.min(1, a / denom);
}

/** Steady-state gain in the small-alpha limit — the headline number, 1/m. */
export function fadeGain(m) {
  return m <= 0 ? Infinity : 1 / m;
}

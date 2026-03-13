// kernelColorMap.js — Deterministic chromatic allocation for SOMA-9.4 kernel nodes.
//
// Color DNA is IMMUTABLE — every kernel ID maps to exactly one HSL color,
// forever, regardless of array ordering or re-indexing.
//
// Architecture:
//   1. 5 root categorical hues define the cluster bands (table below).
//   2. djb2 hash of the kernel ID string drives unique offsets within the band.
//   3. Saturation and Lightness are also hash-derived, staying within a
//      perceptually distinct range so all nodes remain legible on black.
//
// Cluster hue bands:
//   Ecological     Green   120°  range ±30°  →  90° – 150°
//   Synchrony      Cyan    185°  range ±25°  → 160° – 210°
//   Physics        Pink    300°  range ±25°  → 275° – 325°
//   Cryptography   Orange   30°  range ±20°  →  10° –  50°
//   DRK/Art       Purple   270°  range ±25°  → 245° – 295°

const CLUSTER_BANDS = {
  eco:    { center: 120, halfRange: 30, satMin: 60, satMax: 88, litMin: 52, litMax: 68 },
  sync:   { center: 185, halfRange: 25, satMin: 65, satMax: 90, litMin: 50, litMax: 65 },
  phys:   { center: 300, halfRange: 25, satMin: 62, satMax: 85, litMin: 52, litMax: 67 },
  crypto: { center:  30, halfRange: 20, satMin: 68, satMax: 92, litMin: 50, litMax: 64 },
  drk:    { center: 270, halfRange: 25, satMin: 55, satMax: 80, litMin: 48, litMax: 63 },
};

// djb2 — fast, low-collision, deterministic
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

// Linear interpolation helper
function lerp(a, b, t) { return a + (a - b === 0 ? 0 : (b - a) * t); }

// Normalize a hash byte to [0, 1]
function byte01(h, shift) { return ((h >>> shift) & 0xFF) / 255; }

/**
 * nodeColor(id, cluster) → { hsl, hue, sat, lit, hex }
 *
 * Returns the immutable color for any kernel node.
 * `id`      — kernel identifier string (e.g. "kuramoto")
 * `cluster` — one of: 'eco' | 'sync' | 'phys' | 'crypto' | 'drk'
 */
export function nodeColor(id, cluster) {
  const band = CLUSTER_BANDS[cluster] ?? CLUSTER_BANDS.drk;
  const h    = djb2(id);

  // Hue: center ± halfRange, driven by low 16 bits
  const hueT   = (h & 0xFFFF) / 0xFFFF;
  const hue    = ((band.center + (hueT - 0.5) * 2 * band.halfRange) % 360 + 360) % 360;

  // Saturation: satMin–satMax, driven by bits 16–23
  const sat    = lerp(band.satMin, band.satMax, byte01(h, 16));

  // Lightness: litMin–litMax, driven by bits 8–15
  const lit    = lerp(band.litMin, band.litMax, byte01(h, 8));

  const hsl    = `hsl(${hue.toFixed(1)},${sat.toFixed(1)}%,${lit.toFixed(1)}%)`;

  // Approximate hex for canvas ctx (canvas doesn't need exact hex, hsl works fine)
  return { hsl, hue, sat, lit };
}

/**
 * lerpColor(cA, cB, t) → { hue, sat, lit, hsl }
 *
 * Linear interpolation between two nodeColor results.
 * Hue uses shortest-arc interpolation to avoid spinning through 360°.
 * t=0 → pure source (cA), t=1 → pure target (cB).
 *
 * Used for edge gradient: Color_edge = lerp(source, target, influence_strength)
 */
export function lerpColor(cA, cB, t) {
  // Shortest-arc hue lerp
  let dh = cB.hue - cA.hue;
  if (dh >  180) dh -= 360;
  if (dh < -180) dh += 360;
  const hue = ((cA.hue + dh * t) + 360) % 360;
  const sat = lerp(cA.sat, cB.sat, t);
  const lit = lerp(cA.lit, cB.lit, t);
  return { hue, sat, lit, hsl: `hsl(${hue.toFixed(1)},${sat.toFixed(1)}%,${lit.toFixed(1)}%)` };
}

/**
 * hslAlpha(color, alpha) → CSS rgba-style string usable in canvas.
 * alpha ∈ [0, 1]
 */
export function hslAlpha(color, alpha) {
  return `hsla(${color.hue.toFixed(1)},${color.sat.toFixed(1)}%,${color.lit.toFixed(1)}%,${alpha.toFixed(3)})`;
}

// Export the band definitions so the legend can derive cluster representative colors
export { CLUSTER_BANDS };

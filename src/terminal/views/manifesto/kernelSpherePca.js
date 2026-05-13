// kernelSpherePca.js — 16-D → 3-D principal component projection for the manifesto sphere.
//
// Takes the legacy SOMA-9.4 feature submatrix (dims 0..15) and finds three
// orthogonal axes of maximum variance via power iteration with Gram-Schmidt
// deflation. Deterministic for a given seed; ~1ms for 272×16.

const FEATURE_DIM = 16;

function subtractMean(matrix) {
  const n = matrix.length;
  const mean = new Array(FEATURE_DIM).fill(0);
  for (const row of matrix) for (let d = 0; d < FEATURE_DIM; d++) mean[d] += row[d];
  for (let d = 0; d < FEATURE_DIM; d++) mean[d] /= n;
  return matrix.map(row => row.map((v, d) => v - mean[d]));
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm(v) {
  return Math.sqrt(dot(v, v));
}

function normalize(v) {
  const n = norm(v) || 1;
  return v.map(x => x / n);
}

// Power iteration on centered data X (n × d) to find the dominant eigenvector
// of the covariance matrix Xᵀ X. We avoid forming the d × d matrix explicitly.
function dominantAxis(centered, deflated, seed) {
  let v = new Array(FEATURE_DIM).fill(0).map((_, i) => Math.sin(seed + i * 1.7) + 0.3);
  v = normalize(v);
  for (let iter = 0; iter < 60; iter++) {
    // w = Xᵀ X v
    const w = new Array(FEATURE_DIM).fill(0);
    for (const row of centered) {
      const proj = dot(row, v);
      for (let d = 0; d < FEATURE_DIM; d++) w[d] += row[d] * proj;
    }
    // Project out the deflated subspace
    for (const u of deflated) {
      const c = dot(w, u);
      for (let d = 0; d < FEATURE_DIM; d++) w[d] -= c * u[d];
    }
    const next = normalize(w);
    const conv = Math.abs(dot(next, v));
    v = next;
    if (conv > 0.99999) break;
  }
  return v;
}

/**
 * project16Dto3D(features) — features: array of length-16 number arrays.
 * Returns { coords: [[x,y,z], ...], axes: [v1, v2, v3] }.
 * Coords are normalized so the maximum radial distance from origin is 1.
 */
export function project16Dto3D(features) {
  if (!features.length) return { coords: [], axes: [] };
  const centered = subtractMean(features);
  const axes = [];
  axes.push(dominantAxis(centered, axes, 0.1));
  axes.push(dominantAxis(centered, axes, 1.3));
  axes.push(dominantAxis(centered, axes, 2.7));

  const raw = centered.map(row => [dot(row, axes[0]), dot(row, axes[1]), dot(row, axes[2])]);
  let maxR = 0;
  for (const [x, y, z] of raw) maxR = Math.max(maxR, Math.sqrt(x*x + y*y + z*z));
  const scale = maxR > 0 ? 1 / maxR : 1;
  const coords = raw.map(([x, y, z]) => [x * scale, y * scale, z * scale]);
  return { coords, axes };
}

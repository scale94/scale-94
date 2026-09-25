// Exact Schwarzschild photon orbits, baked once (field spec §7.1).
//
// Units: r_s = 1. Orbits obey the Binet equation d²u/dφ² = −u + 1.5u²,
// u = 1/r. A ray from infinity with impact parameter b starts at u = 0,
// du/dφ = 1/b. By spherical symmetry its whole path depends on b alone, so
// the shader looks rays up in a table instead of marching them.

export const B_C = (3 * Math.sqrt(3)) / 2; // critical impact parameter: the shadow edge
export const LUT_W = 0.5;                   // sinh warp width: rows crowd around B_C
export const B_MAX = 24;
export const PHI_MAX = 3 * Math.PI;         // primary + secondary crossings fit inside
export const N_B = 512;
export const N_PHI = 512;
export const FAR = 1000;                    // "escaped" sentinel, half-float safe
export const X_MIN = Math.asinh((0 - B_C) / LUT_W);
export const X_MAX = Math.asinh((B_MAX - B_C) / LUT_W);
export const N_D = 256;
export const D_B_MAX = 16;                  // lensing tapers out by R_FOUNDATION ≈ 10.7 r_s
export const D_X_MAX = Math.asinh((D_B_MAX - B_C) / LUT_W);
export const ALPHA_CAP = 4 * Math.PI;
export const EINSTEIN_B = 3.5;

const SUBSTEPS = 4;
const FINE_STEP = 0.0005;
const BAKE_STEP = 0.002;
const ESCAPE_PHI_MAX = 8 * Math.PI;

const accel = (u) => -u + 1.5 * u * u;

// One RK4 step of (u, w = du/dφ), in place: the bake runs ~2M of these.
function rk4(s, h) {
  const { u, w } = s;
  const k1u = w,                 k1w = accel(u);
  const k2u = w + 0.5 * h * k1w, k2w = accel(u + 0.5 * h * k1u);
  const k3u = w + 0.5 * h * k2w, k3w = accel(u + 0.5 * h * k2u);
  const k4u = w + h * k3w,       k4w = accel(u + h * k3u);
  s.u = u + (h / 6) * (k1u + 2 * k2u + 2 * k3u + k4u);
  s.w = w + (h / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
}

export const rowImpact = (j) => B_C + LUT_W * Math.sinh(X_MIN + (X_MAX - X_MIN) * (j / (N_B - 1)));
export const deflectImpact = (i) => B_C + LUT_W * Math.sinh(D_X_MAX * (i / (N_D - 1)));

// r(φ) at φ_k = k·PHI_MAX/(n−1). 0 once captured (r ≤ r_s), FAR once escaped.
export function traceRay(b, n = N_PHI) {
  const out = new Float32Array(n);
  if (!(b > 1e-6)) return out; // radial ray: captured at once
  const h = PHI_MAX / (n - 1) / SUBSTEPS;
  const s = { u: 0, w: 1 / b };
  let state = 0; // 0 in flight · 1 captured · 2 escaped
  out[0] = FAR;
  for (let k = 1; k < n; k++) {
    for (let i = 0; i < SUBSTEPS && state === 0; i++) {
      rk4(s, h);
      if (s.u >= 1) state = 1;
      else if (s.u <= 0) state = 2;
    }
    out[k] = state === 1 ? 0 : state === 2 ? FAR : Math.min(1 / s.u, FAR);
  }
  return out;
}

// Total deflection α̂ = φ_escape − π. Infinity when captured, or when still
// orbiting at 8π (only within ~e^-22 of B_C).
export function deflectionAngle(b, step = FINE_STEP) {
  if (b <= B_C) return Infinity;
  const s = { u: 0, w: 1 / b };
  let phi = 0;
  while (phi < ESCAPE_PHI_MAX) {
    const uPrev = s.u;
    rk4(s, step);
    phi += step;
    if (s.u >= 1) return Infinity;
    if (s.u <= 0) return phi + step * (s.u / (uPrev - s.u)) - Math.PI; // linear zero crossing
  }
  return Infinity;
}

export function bakeGeodesicTable() {
  const data = new Float32Array(N_B * N_PHI);
  for (let j = 0; j < N_B; j++) data.set(traceRay(rowImpact(j)), j * N_PHI);
  return data;
}

export function bakeDeflectionTable() {
  const data = new Float32Array(N_D);
  for (let i = 0; i < N_D; i++) data[i] = Math.min(deflectionAngle(deflectImpact(i), BAKE_STEP), ALPHA_CAP);
  return data;
}

let cache = null;
export function geodesicTables() {
  if (!cache) {
    cache = {
      geodesic: bakeGeodesicTable(),
      deflect: bakeDeflectionTable(),
      lensD: EINSTEIN_B / deflectionAngle(EINSTEIN_B),
    };
  }
  return cache;
}

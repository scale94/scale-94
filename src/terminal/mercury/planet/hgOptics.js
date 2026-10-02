// src/terminal/mercury/planet/hgOptics.js — liquid mercury as a conductor.
//
// Hg's complex refractive index n + ik, interpolated at the sRGB primaries'
// dominant wavelengths (R 610, G 550, B 465 nm) from Inagaki, Arakawa &
// Williams, Phys. Rev. B 23, 5246 (1981), liquid Hg at room temperature
// (refractiveindex.info, main/Hg/Inagaki). conductorFresnel is the exact
// unpolarised Fresnel reflectance of a metal in vacuum; the shader's
// fresnelHg() mirrors it line for line. Normal incidence gives ≈ 0.78 in all
// three channels: quicksilver is neutral. Unlike Schlick it sags slightly
// below F0 near ~80° (the principal-angle dip of Rp) before rising to 1.

export const HG_N = [1.859, 1.552, 1.131];
export const HG_K = [5.079, 4.651, 3.990];

export function conductorFresnel(cosI, n, k) {
  const c = Math.min(Math.max(cosI, 0), 1);
  const c2 = c * c;
  const s2 = 1 - c2;
  const t0 = n * n - k * k - s2;
  const a2b2 = Math.sqrt(t0 * t0 + 4 * n * n * k * k);
  const a = Math.sqrt(Math.max(0.5 * (a2b2 + t0), 0));
  const rs = (a2b2 + c2 - 2 * a * c) / (a2b2 + c2 + 2 * a * c);
  const t1 = c2 * a2b2 + s2 * s2;
  const t2 = 2 * a * c * s2;
  const rp = rs * (t1 - t2) / (t1 + t2);
  return 0.5 * (rs + rp);
}

// Normal-incidence reflectance per channel: ((n-1)² + k²) / ((n+1)² + k²).
export const HG_F0 = HG_N.map((n, i) => ((n - 1) ** 2 + HG_K[i] ** 2) / ((n + 1) ** 2 + HG_K[i] ** 2));

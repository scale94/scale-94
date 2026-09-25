// Accretion-disk physics in r_s = 1 units (field spec §7.3–7.4, §7.8, §9 Q1).
// Every constant here is interpolated into the GLSL by councilFieldShader.js,
// so these tested functions are the shader's reference implementation.

export const INCLINATION_DEG = 80;
export const COS_I = Math.cos((INCLINATION_DEG * Math.PI) / 180);
export const SIN_I = Math.sin((INCLINATION_DEG * Math.PI) / 180);
// +1: the east (sidelined) side approaches and burns bright (§9 Q1, decided).
export const SPIN_SIGN = 1;

export const R_IN = 3;   // ISCO
export const R_OUT = 10; // just inside R_FOUNDATION at 14 u per r_s

// Novikov–Thorne-shaped emissivity: zero torque at the ISCO.
export const emissivity = (r) => (r <= R_IN ? 0 : r ** -3 * (1 - Math.sqrt(R_IN / r)));
export const R_PEAK = ((3.5 * Math.sqrt(3)) / 3) ** 2; // dF/dr = 0 → 49/12
export const F_MAX = emissivity(R_PEAK);

// Render-scale temperature (plan amendment 3): the physical F^(1/4) spans only
// 12 000 → 8 200 K here, so the exponent is fitted to reach an ember at R_OUT.
export const T_PEAK = 12000;
export const T_EXP = Math.log(1800 / T_PEAK) / Math.log(emissivity(R_OUT) / F_MAX);
export const temperature = (r) => T_PEAK * (emissivity(r) / F_MAX) ** T_EXP;

// g = 1/(1+z) for a circular Keplerian orbit (Luminet 1979), image-plane
// cos α measured from +X (east). SPIN_SIGN +1 makes the east side approach.
export function redshiftFactor(r, b, cosAlpha) {
  const onePlusZ = (1 - 1.5 / r) ** -0.5
    * (1 - SPIN_SIGN * Math.sqrt(0.5 / r ** 3) * b * cosAlpha * SIN_I);
  return 1 / Math.max(onePlusZ, 0.05);
}

// Kim et al. (2002) Planckian locus, valid 1 667–25 000 K.
export const KIM_X_LOW = [-0.2661239e9, -0.2343589e6, 0.8776956e3, 0.179910];
export const KIM_X_HIGH = [-3.0258469e9, 2.1070379e6, 0.2226347e3, 0.240390];
export const KIM_Y_1 = [-1.1063814, -1.3481102, 2.18555832, -0.20219683];
export const KIM_Y_2 = [-0.9549476, -1.37418593, 2.09137015, -0.16748867];
export const KIM_Y_3 = [3.081758, -5.8733867, 3.75112997, -0.37001483];
export const XYZ_TO_LINEAR_SRGB = [
  3.2404542, -1.5371385, -0.4985314,
  -0.969266, 1.8760108, 0.041556,
  0.0556434, -0.2040259, 1.0572252,
];

export function blackbody(Tk) {
  const T = Math.min(Math.max(Tk, 1667), 25000);
  const [a, b, c, d] = T <= 4000 ? KIM_X_LOW : KIM_X_HIGH;
  const x = a / T ** 3 + b / T ** 2 + c / T + d;
  const [e, f, g, h] = T <= 2222 ? KIM_Y_1 : T <= 4000 ? KIM_Y_2 : KIM_Y_3;
  const y = e * x ** 3 + f * x ** 2 + g * x + h;
  const X = x / y, Y = 1, Z = (1 - x - y) / y;
  const M = XYZ_TO_LINEAR_SRGB;
  const rgb = [
    M[0] * X + M[1] * Y + M[2] * Z,
    M[3] * X + M[4] * Y + M[5] * Z,
    M[6] * X + M[7] * Y + M[8] * Z,
  ].map((v) => Math.max(v, 0));
  const m = Math.max(...rgb);
  return rgb.map((v) => v / m);
}

// Relativistic jet beaming (§7.8): Doppler factor D = 1/(Γ(1 − β cos θ)).
export const JET_GAMMA = 3;
export const JET_VIEW_DEG = 60;
const JET_BETA = Math.sqrt(1 - 1 / JET_GAMMA ** 2);
const JET_COS = Math.cos((JET_VIEW_DEG * Math.PI) / 180);
export const COUNTER_JET = ((1 - JET_BETA * JET_COS) / (1 + JET_BETA * JET_COS)) ** 4;

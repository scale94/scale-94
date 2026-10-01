// src/terminal/mercury/planet/aetherLobes.js — the aether as the liquid sees it.
//
// The four element flows wrap the planet on every side, the camera side
// included (we only ever see the half behind it). The mirror reflects that
// envelope as AETHER_LOBES broad soft lights at the cube-corner directions,
// drifting slowly about the vertical. Each lobe takes one palette colour from
// every element flow, weighted by that flow's live opacity, so the active
// element floods the liquid. Palettes are copied from the flow shaders, which
// write them straight to the framebuffer (sRGB), and are linearised here
// because the planet shader encodes its own output.

export const AETHER_LOBES = 8;
export const AETHER_DRIFT_RAD_PER_S = 0.04; // one turn ≈ 2.6 min

const S = Math.sqrt(1 / 3);
export const AETHER_BASE_DIRS = [
  [S, S, S], [-S, S, S], [S, -S, S], [-S, -S, S],
  [S, S, -S], [-S, S, -S], [S, -S, -S], [-S, -S, -S],
];

export const AETHER_PHASES = ['fluid', 'thermal', 'earth', 'air'];

// sRGB, verbatim from each flow's fragment shader.
export const AETHER_PALETTES_SRGB = {
  fluid: [[1.0, 0.0, 0.667], [0.533, 0.267, 1.0], [0.0, 1.0, 0.8]],     // ParticleFlow: magenta, violet, cyan
  thermal: [[1.0, 0.82, 0.10], [1.0, 0.60, 0.05], [1.0, 0.30, 0.02]],   // ThermalFlow: flame core → ember
  earth: [[0.83, 0.56, 0.35], [0.75, 0.41, 0.13], [0.67, 0.27, 0.13]],  // SedimentFlow: sandstone, ochre, clay
  air: [[0.36, 0.64, 0.85], [0.60, 0.78, 0.92], [0.18, 0.48, 0.75]],    // AtmosphericFlow: sky, azure, stratosphere
};

export function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

const LINEAR = Object.fromEntries(
  AETHER_PHASES.map((p) => [p, AETHER_PALETTES_SRGB[p].map((rgb) => rgb.map(srgbToLinear))]),
);

const newBuffer = () => AETHER_BASE_DIRS.map(() => [0, 0, 0]);

export function aetherLobeColors(opacities, out = newBuffer()) {
  for (let i = 0; i < AETHER_LOBES; i++) {
    let r = 0, g = 0, b = 0;
    for (const p of AETHER_PHASES) {
      const o = opacities[p] ?? 0;
      const c = LINEAR[p][i % 3];
      r += o * c[0]; g += o * c[1]; b += o * c[2];
    }
    out[i][0] = r; out[i][1] = g; out[i][2] = b;
  }
  return out;
}

export function aetherLobeDirs(tS, out = newBuffer()) {
  const a = tS * AETHER_DRIFT_RAD_PER_S;
  const c = Math.cos(a), s = Math.sin(a);
  for (let i = 0; i < AETHER_LOBES; i++) {
    const [x, y, z] = AETHER_BASE_DIRS[i];
    out[i][0] = c * x + s * z;
    out[i][1] = y;
    out[i][2] = -s * x + c * z;
  }
  return out;
}

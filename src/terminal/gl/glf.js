// glf.js — JS number → GLSL float literal. Shared by every raw shader that
// interpolates constants from the JS module that owns (and tests) them.

export function glf(x) {
  const s = Number(x).toPrecision(9);
  return /[.e]/.test(s) ? s : `${s}.0`;
}

export const v3 = (a) => `vec3(${a.map(glf).join(', ')})`;
export const v4 = (a) => `vec4(${a.map(glf).join(', ')})`;

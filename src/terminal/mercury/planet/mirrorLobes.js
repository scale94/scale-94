// src/terminal/mercury/planet/mirrorLobes.js — JS twins of the liquid mirror's
// lobe maths. mercuryPlanetShader.js mirrors these exactly; the tests here pin
// the Sun's look targets numerically.

// A disc of angular radius asin(sinR) seen in a mirror of roughness rough:
// a Gaussian in angle whose width adds the disc and the GGX alpha, scaled so
// the integrated energy stays that of the disc.
export function lobe(cosA, sinR, rough) {
  const a = Math.acos(Math.min(1, Math.max(-1, cosA)));
  const alpha = rough * rough;
  const w2 = sinR * sinR + alpha * alpha;
  return (sinR * sinR / w2) * Math.exp(-a * a / w2);
}

// Highlight roll-off: ~x for small x, approaches k. Lets the true Sun radiance
// be bright enough to survive boiling without a hard clipped plateau.
export function softShoulder(x, k) {
  return k * (1 - Math.exp(-x / k));
}

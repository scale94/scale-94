// src/terminal/mercury/planet/planetFrame.js — world ↔ Mercury body frame.
//
// World +Y is Mercury's north pole (obliquity ≈ 0.03°, so the real Sun stays
// on the equator — SUN_DIR_WORLD has y = 0 on purpose). What is REAL: which
// face is lit (subsolar longitude). What is CHOSEN (spec §4): the Sun sits at
// a fixed phase angle to the camera so a gibbous planet is always on screen (the camera no longer moves).
// mercuryPlanetShader.js mirrors dirFromLonLat / uvFromLonLat exactly; it rotates by uBodyRot (body -> world), the live body orientation.

const DEG = Math.PI / 180;

export const PHASE_ANGLE_DEG = 55;

export const SUN_DIR_WORLD = Object.freeze([
  -Math.sin(PHASE_ANGLE_DEG * DEG),
  0,
  Math.cos(PHASE_ANGLE_DEG * DEG),
]);

export function dirFromLonLat(lonDeg, latDeg) {
  const l = lonDeg * DEG, p = latDeg * DEG;
  return [Math.cos(p) * Math.cos(l), Math.sin(p), -Math.cos(p) * Math.sin(l)];
}

export function lonLatFromDir([x, y, z]) {
  const lon = Math.atan2(-z, x) / DEG;
  return {
    lonDeg: ((lon % 360) + 360) % 360,
    latDeg: Math.asin(Math.max(-1, Math.min(1, y))) / DEG,
  };
}

export function rotY([x, y, z], a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [c * x + s * z, y, -s * x + c * z];
}

export function bodyYawFor(subsolarLonDeg, sunDir = SUN_DIR_WORLD) {
  const azSun = Math.atan2(-sunDir[2], sunDir[0]);
  return azSun - subsolarLonDeg * DEG;
}

export function uvFromLonLat(lonDeg, latDeg) {
  return [(((lonDeg % 360) + 360) % 360) / 360, 0.5 + latDeg / 180];
}

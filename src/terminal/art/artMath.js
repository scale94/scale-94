// artMath.js — 3D math utilities for ArtTab sphere renderer
// Pure functions, zero imports. Build rotation matrices, apply them,
// and perspective-project sphere coords onto Canvas2D.

// Build flat row-major 3×3 rotation matrix (Y then X rotation)
export function buildRotMatrix(rx, ry) {
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  return [
     cy,       0,    sy,
     sx * sy,  cx,  -sx * cy,
    -cx * sy,  sx,   cx * cy,
  ];
}

// Apply rotation matrix M to vector (x, y, z)
export function applyM(M, x, y, z) {
  return [
    M[0] * x + M[1] * y + M[2] * z,
    M[3] * x + M[4] * y + M[5] * z,
    M[6] * x + M[7] * y + M[8] * z,
  ];
}

// Perspective project rotated coords onto canvas
export function project(rx, ry, rz, w, h, sphereR, focal) {
  const denom = focal + rz * sphereR;
  const scale = Math.abs(denom) > 1e-9 ? focal / denom : 0;
  return {
    sx:    w / 2 + rx * sphereR * scale,
    sy:    h / 2 - ry * sphereR * scale,   // flip Y: canvas Y is down
    depth: rz,                              // [-1, +1] — used for alpha/size
    scale,
  };
}

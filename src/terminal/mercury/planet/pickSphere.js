// pickSphere.js — pointer → the point it touches on the bead.
// The still sphere (radius R_SCENE) is close enough for a drag point.

import * as THREE from 'three';

const _p = new THREE.Vector3();
const _d = new THREE.Vector3();

export function pickSphereDir(ndc, camera, radius, out = [0, 0, 0]) {
  _p.set(ndc[0], ndc[1], 0.5).unproject(camera);
  const o = camera.position;
  _d.copy(_p).sub(o).normalize();
  const b = o.dot(_d);
  const disc = b * b - (o.lengthSq() - radius * radius);
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  out[0] = (o.x + _d.x * t) / radius;
  out[1] = (o.y + _d.y * t) / radius;
  out[2] = (o.z + _d.z * t) / radius;
  return out;
}

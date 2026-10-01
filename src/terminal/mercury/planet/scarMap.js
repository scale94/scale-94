// src/terminal/mercury/planet/scarMap.js — the crust remembers what struck it.
//
// An equirect buffer in the BODY frame (it turns with the planet), mirroring
// the shader's uv: u = fract(lon / 2π), v = 0.5 + lat / π, row iy at
// v = (iy + 0.5) / h. Depth is in TRUE metres (the shader applies uRelief like
// the DEM). Fresh rays mature to background (space weathering, sped up to
// minutes); depth stays until the planet melts, which heals everything.
// Float32 master values, RGBA8 bytes for the GPU: R = 128 ± 127 · depth/range,
// G = ray · 255.

import { CRATER_RADIUS_RAD, RAY_REACH, craterHeightM, makeRays, rayBrightness } from './mercuryImpacts';

export const SCAR_W = 1024;
export const SCAR_H = 512;
export const SCAR_DEPTH_RANGE_M = 4000;
export const RAY_MATURE_S = 180;
export const SCAR_TICK_S = 5;   // rays mature over minutes; a 5 s step is invisible and uploads the 2 MB map 5x less often
const DEPTH_REACH = 2.5;   // crater radii; the ejecta blanket is < 1 % of the rim beyond this
const RAY_FLOOR = 1 / 512;

export function createScarMap(w = SCAR_W, h = SCAR_H) {
  const bytes = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    bytes[4 * i] = 128;
    bytes[4 * i + 3] = 255;
  }
  return { w, h, depth: new Float32Array(w * h), ray: new Float32Array(w * h), bytes, live: false, rayLive: false };
}

export function texelDir(map, ix, iy, out = [0, 0, 0]) {
  const lon = ((ix + 0.5) / map.w) * 2 * Math.PI;
  const lat = ((iy + 0.5) / map.h - 0.5) * Math.PI;
  const c = Math.cos(lat);
  out[0] = c * Math.cos(lon);
  out[1] = Math.sin(lat);
  out[2] = -c * Math.sin(lon);
  return out;
}

function encode(map, i) {
  const d = Math.max(-1, Math.min(1, map.depth[i] / SCAR_DEPTH_RANGE_M));
  map.bytes[4 * i] = Math.round(128 + d * 127);
  map.bytes[4 * i + 1] = Math.round(Math.max(0, Math.min(1, map.ray[i])) * 255);
}

const smooth01 = (x) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

const _x = [0, 0, 0];

export function stampCrater(map, d, seed) {
  const rays = makeRays(seed);
  const thMax = CRATER_RADIUS_RAD * RAY_REACH;
  const cosMax = Math.cos(thMax);
  // Tangent frame at the impact point for the ray azimuth.
  let ex = -d[2], ez = d[0];                       // cross(d, +Y): an east-ish tangent
  let el = Math.hypot(ex, ez);
  if (el < 1e-6) { ex = 1; ez = 0; el = 1; }
  const e = [ex / el, 0, ez / el];
  const n = [d[1] * e[2], d[2] * e[0] - d[0] * e[2], -d[1] * e[0]]; // cross(d, e)

  const lat0 = Math.asin(Math.max(-1, Math.min(1, d[1])));
  const lon0 = Math.atan2(-d[2], d[0]);
  const latLo = Math.max(-Math.PI / 2, lat0 - thMax), latHi = Math.min(Math.PI / 2, lat0 + thMax);
  const y0 = Math.max(0, Math.floor((latLo / Math.PI + 0.5) * map.h));
  const y1 = Math.min(map.h - 1, Math.ceil((latHi / Math.PI + 0.5) * map.h));
  const polar = Math.abs(lat0) + thMax >= Math.PI / 2 - 1e-6;
  const dLon = polar ? Math.PI : Math.min(Math.PI, thMax / Math.cos(Math.abs(lat0) + thMax));
  const cols = Math.min(map.w, Math.ceil((dLon / Math.PI) * map.w) + 2);
  const xc = Math.floor((((lon0 / (2 * Math.PI)) % 1 + 1) % 1) * map.w);
  const xs = polar ? 0 : xc - Math.ceil(cols / 2);

  let touched = 0;
  for (let iy = y0; iy <= y1; iy++) {
    for (let k = 0; k < (polar ? map.w : cols); k++) {
      const ix = (((xs + k) % map.w) + map.w) % map.w;
      texelDir(map, ix, iy, _x);
      const c = _x[0] * d[0] + _x[1] * d[1] + _x[2] * d[2];
      if (c < cosMax) continue;
      const s = Math.acos(Math.min(1, c)) / CRATER_RADIUS_RAD;
      const i = iy * map.w + ix;
      if (s <= DEPTH_REACH) {
        const over = 1 - smooth01((s - 0.8) / 0.5);  // the new crater erases the old inside its rim
        map.depth[i] = map.depth[i] * (1 - over) + craterHeightM(s);
      }
      const phi = Math.atan2(_x[0] * n[0] + _x[1] * n[1] + _x[2] * n[2], _x[0] * e[0] + _x[1] * e[1] + _x[2] * e[2]);
      const r = rayBrightness(s, phi, rays);
      if (r > map.ray[i]) map.ray[i] = r;
      encode(map, i);
      touched++;
    }
  }
  if (touched > 0) { map.live = true; map.rayLive = true; }
  return touched;
}

export function matureScars(map, dtS) {
  if (!map.rayLive) return false;
  const k = Math.exp(-dtS / RAY_MATURE_S);
  let live = false, changed = false;
  for (let i = 0; i < map.ray.length; i++) {
    if (map.ray[i] === 0) continue;
    const r = map.ray[i] * k;
    map.ray[i] = r < RAY_FLOOR ? 0 : r;
    if (map.ray[i] > 0) live = true;
    const g = Math.round(map.ray[i] * 255);
    if (g !== map.bytes[4 * i + 1]) { map.bytes[4 * i + 1] = g; changed = true; }
  }
  map.rayLive = live;
  return changed;   // true only when a byte moved: that is what costs a texture upload
}

export function healScars(map) {
  if (!map.live) return false;
  map.depth.fill(0);
  map.ray.fill(0);
  for (let i = 0; i < map.w * map.h; i++) {
    map.bytes[4 * i] = 128;
    map.bytes[4 * i + 1] = 0;
  }
  map.live = false;
  map.rayLive = false;
  return true;
}

// src/terminal/mercury/planet/scarMap.js — the crust remembers what struck it.
//
// An equirect buffer in the BODY frame (it turns with the planet), mirroring
// the shader's uv: u = fract(lon / 2π), v = 0.5 + lat / π, row iy at
// v = (iy + 0.5) / h. Depth is in TRUE metres (the shader applies uRelief like
// the DEM). Fresh rays mature to background (space weathering, sped up to
// minutes); depth stays until the planet melts, which heals everything.
// Float32 master values, RGBA8 bytes for the GPU: R = 128 ± 127 · depth/range,
// G = ray · 255. B = frost, A = glaze (the visitors' marks, matrix spec §5.2):
// bytes only, no masters; they heal where the Hg under them melts, not on the
// planet-wide melt that wipes the craters.

import { CRATER_RADIUS_RAD, RAY_REACH, craterHeightM, makeRays, rayBrightness, localTempK } from './mercuryImpacts';
import { qRotate } from './breakupFamily';
import { HG_MELT_K } from './mercuryThermal';

export const SCAR_W = 1024;
export const SCAR_H = 512;
export const SCAR_DEPTH_RANGE_M = 4000;
export const RAY_MATURE_S = 180;
export const SCAR_TICK_S = 5;   // rays mature over minutes; a 5 s step is invisible and uploads the 2 MB map 5x less often
const DEPTH_REACH = 2.5;   // crater radii; the ejecta blanket is < 1 % of the rim beyond this
const RAY_FLOOR = 1 / 512;

export function createScarMap(w = SCAR_W, h = SCAR_H) {
  const bytes = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) bytes[4 * i] = 128;
  return { w, h, depth: new Float32Array(w * h), ray: new Float32Array(w * h), bytes, live: false, rayLive: false, marksLive: false };
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
const _w = [0, 0, 0];

// Every texel within thMax of unit d: fn(i, cosToD), with that texel's direction left in _x. Returns how many it visited.
function forCap(map, d, thMax, fn) {
  const cosMax = Math.cos(thMax);
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
      fn(iy * map.w + ix, c);
      touched++;
    }
  }
  return touched;
}

export function stampCrater(map, d, seed) {
  const rays = makeRays(seed);
  // Tangent frame at the impact point for the ray azimuth.
  let ex = -d[2], ez = d[0];                       // cross(d, +Y): an east-ish tangent
  let el = Math.hypot(ex, ez);
  if (el < 1e-6) { ex = 1; ez = 0; el = 1; }
  const e = [ex / el, 0, ez / el];
  const n = [d[1] * e[2], d[2] * e[0] - d[0] * e[2], -d[1] * e[0]]; // cross(d, e)
  const touched = forCap(map, d, CRATER_RADIUS_RAD * RAY_REACH, (i, c) => {
    const s = Math.acos(Math.min(1, c)) / CRATER_RADIUS_RAD;
    if (s <= DEPTH_REACH) {
      const over = 1 - smooth01((s - 0.8) / 0.5);  // the new crater erases the old inside its rim
      map.depth[i] = map.depth[i] * (1 - over) + craterHeightM(s);
    }
    const phi = Math.atan2(_x[0] * n[0] + _x[1] * n[1] + _x[2] * n[2], _x[0] * e[0] + _x[1] * e[1] + _x[2] * e[2]);
    const r = rayBrightness(s, phi, rays);
    if (r > map.ray[i]) map.ray[i] = r;
    encode(map, i);
  });
  if (touched > 0) { map.live = true; map.rayLive = true; }
  return touched;
}

// A cheap per-texel hash in [0, 1): the frost's ragged, crystalline edge.
const texHash = (i, seed) => (Math.imul((i ^ Math.imul(seed, 0x27d4eb2d)) >>> 0, 0x9e3779b1) >>> 0) / 4294967296;

// Water frozen on contact with frozen Hg (matrix spec §4.2): B = coverage, full inside 0.7–1.0 radii, ragged out to 1.15.
export function stampFrost(map, d, radius, seed) {
  const touched = forCap(map, d, 1.2 * radius, (i, c) => {
    const s = Math.acos(Math.min(1, c)) / radius;
    const b = Math.round(255 * (1 - smooth01((s - (0.7 + 0.3 * texHash(i, seed))) / 0.15)));
    if (b > map.bytes[4 * i + 2]) map.bytes[4 * i + 2] = b;
  });
  if (touched > 0) map.marksLive = true;
  return touched;
}

// A melt pool refrozen smooth (§4.3): A = glaze, full inside 0.75 radii.
export function stampGlaze(map, d, radius) {
  const touched = forCap(map, d, radius, (i, c) => {
    const s = Math.acos(Math.min(1, c)) / radius;
    const a = Math.round(255 * (1 - smooth01((s - 0.75) / 0.25)));
    if (a > map.bytes[4 * i + 3]) map.bytes[4 * i + 3] = a;
  });
  if (touched > 0) map.marksLive = true;
  return touched;
}

// Water flash-quenched on hot crust (spec §9.3): one profile in B, read by the crust shading.
// A full core (the dark glassy skin), a half-height plateau (the pale evaporite ring), then nothing.
// s = angle / radius, h in [0, 1) jitters the outer edge. The shader's quenchProfile mirrors this exactly.
export const quenchProfile = (s, h) => 1 - 0.5 * smooth01((s - 0.55) / 0.15) - 0.5 * smooth01((s - (0.95 + 0.1 * h)) / 0.15);

export function stampQuench(map, d, radius, seed) {
  const touched = forCap(map, d, 1.25 * radius, (i, c) => {
    const s = Math.acos(Math.min(1, c)) / radius;
    const b = Math.round(255 * quenchProfile(s, texHash(i, seed)));
    if (b > map.bytes[4 * i + 2]) map.bytes[4 * i + 2] = b;
  });
  if (touched > 0) map.marksLive = true;
  return touched;
}

// Where a rock sank into soft crust (§4.4): a shallow bowl with a low collar of displaced crust (true metres).
export const pitHeightM = (s, depthM) => (s < 1 ? -depthM * (1 - s * s) : 0.15 * depthM * Math.exp(-(s - 1) / 0.25));

export function stampPit(map, d, radius, depthM) {
  const touched = forCap(map, d, 2 * radius, (i, c) => {
    map.depth[i] += pitHeightM(Math.acos(Math.min(1, c)) / radius, depthM);
    encode(map, i);
  });
  if (touched > 0) map.live = true;
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

// Frost and glaze heal where the Hg under them melts (matrix spec §5.2). Each marked texel is turned into the world frame:
// localTempK reads latitude about world Y, like the shader's freeze line (plan P-1). Unmarked texels cost a byte test.
export function healMelted(map, q, sunWorld, tssK, heatK) {
  if (!map.marksLive) return false;
  let live = false, changed = false;
  for (let iy = 0; iy < map.h; iy++) {
    for (let ix = 0; ix < map.w; ix++) {
      const o = 4 * (iy * map.w + ix);
      if (map.bytes[o + 2] === 0 && map.bytes[o + 3] === 0) continue;
      texelDir(map, ix, iy, _x);
      qRotate(q, _x, _w);
      if (localTempK(_w, sunWorld, tssK, heatK) > HG_MELT_K) {
        map.bytes[o + 2] = 0; map.bytes[o + 3] = 0; changed = true;
      } else live = true;
    }
  }
  map.marksLive = live;
  return changed;   // true only when a byte moved: that is what costs a texture upload
}

// A state change wipes every frost, quench and glaze mark (B, A); crossMarks decides when (spec §9.6).
export function clearMarks(map) {
  if (!map.marksLive) return false;
  for (let i = 0; i < map.w * map.h; i++) { map.bytes[4 * i + 2] = 0; map.bytes[4 * i + 3] = 0; }
  map.marksLive = false;
  return true;
}

// Marks last until the planet changes state (spec R3, §9.6). Crust -> liquid melts the quench rinds and the glaze with the
// crust; liquid -> crust buries the frozen-Hg frost and glaze. wasLiquid null = no previous frame: nothing to compare.
export function crossMarks(map, wasLiquid, isLiquid) {
  if (wasLiquid === null || wasLiquid === isLiquid) return false;
  return clearMarks(map);
}

// src/terminal/mercury/planet/mercuryImpacts.js — the element strikes.
//
// A tapped element strikes the planet (spec §5 Events). CHOSEN (amendment 3):
// the nodes sit on the limb plane, so a true sub-node impact is always edge-on;
// the strike lands IMPACT_TILT_DEG from the node toward the viewer, on the
// node's side of the visible face. On crust it leaves a crater with bright
// rays (scarMap.js); on liquid Hg a splash; on solid or boiling Hg a damped
// ring (mercuryWaves.js). Crater scale is artistic (~195 km radius) so it
// reads on a ~200 px disc.

import * as THREE from 'three';
import { surfaceTempK, hgPhase } from './mercuryThermal';
import { LIQUID_TAU } from './mercuryWaves';

export const IMPACT_TILT_DEG = 40;
export const CRATER_RADIUS_RAD = 0.08;
export const CRATER_DEPTH_M = 3000;     // true metres; the shader's uRelief exaggerates like the DEM
export const CRATER_RIM_M = 900;
export const EJECTA_DECAY = 0.3;        // rim → blanket e-fold, in crater radii
export const RAY_REACH = 5;             // rays end here, in crater radii
export const RAY_COUNT_MIN = 7;
export const RAY_COUNT_MAX = 12;
export const RAY_WIDTH = 0.25;          // ray half-width across, in crater radii (roughly constant along it)
export const HALO_DECAY = 0.5;          // continuous bright ejecta halo e-fold, in crater radii

export const IMPACT_MODE_AMP = { splash: 0.035, ring: 0.015, crater: 0 };
export const IMPACT_WAVE_AMP = { splash: 0.35, ring: 0.2, crater: 0 };

const DEG = Math.PI / 180;
const TAU = 2 * Math.PI;

export function strikeDirWorld(nodePos, camPos, out = [0, 0, 0]) {
  const nl = Math.hypot(nodePos[0], nodePos[1], nodePos[2]);
  const n = [nodePos[0] / nl, nodePos[1] / nl, nodePos[2] / nl];
  const cl = Math.hypot(camPos[0], camPos[1], camPos[2]);
  const v = [camPos[0] / cl, camPos[1] / cl, camPos[2] / cl];
  const nv = n[0] * v[0] + n[1] * v[1] + n[2] * v[2];
  const u = [v[0] - n[0] * nv, v[1] - n[1] * nv, v[2] - n[2] * nv];
  const ul = Math.hypot(u[0], u[1], u[2]);
  if (ul < 1e-6) {
    out[0] = n[0]; out[1] = n[1]; out[2] = n[2];
    return out;
  }
  const c = Math.cos(IMPACT_TILT_DEG * DEG), s = Math.sin(IMPACT_TILT_DEG * DEG);
  for (let i = 0; i < 3; i++) out[i] = n[i] * c + (u[i] / ul) * s;
  return out;
}

const _v = new THREE.Vector3();
const _qi = new THREE.Quaternion();

export function bodyToWorld(dir, q, out = [0, 0, 0]) {
  _v.set(dir[0], dir[1], dir[2]).applyQuaternion(q);
  out[0] = _v.x; out[1] = _v.y; out[2] = _v.z;
  return out;
}

export function worldToBody(dir, q, out = [0, 0, 0]) {
  _v.set(dir[0], dir[1], dir[2]).applyQuaternion(_qi.copy(q).invert());
  out[0] = _v.x; out[1] = _v.y; out[2] = _v.z;
  return out;
}

// The shader's per-fragment temperature at a WORLD-frame direction (the rest
// spin axis is world Y), exactly (lonSun guard, GLSL mod for lonRel). Body-frame
// inputs are wrong while the planet tumbles.
export function localTempK(d, sun, tssK, heatK) {
  const mu0 = d[0] * sun[0] + d[1] * sun[1] + d[2] * sun[2];
  const lon = Math.atan2(-d[2], d[0]);
  const lonSun = Math.hypot(sun[0], sun[2]) > 1e-4 ? Math.atan2(-sun[2], sun[0]) : 0;
  const x = lon - lonSun + Math.PI;
  const lonRel = x - TAU * Math.floor(x / TAU) - Math.PI;
  const cosLat = Math.cos(Math.asin(Math.max(-1, Math.min(1, d[1]))));
  return surfaceTempK(mu0, lonRel, cosLat, tssK, heatK);
}

export function impactKind(tau, tempK) {
  if (tau < LIQUID_TAU) return 'crater';
  return hgPhase(tempK) === 'liquid' ? 'splash' : 'ring';
}

// s = θ / CRATER_RADIUS_RAD. A parabolic bowl rising to a raised rim, then an
// ejecta blanket falling off outside.
export function craterHeightM(s) {
  if (s < 1) return -CRATER_DEPTH_M * (1 - s * s) + CRATER_RIM_M * s ** 4;
  return CRATER_RIM_M * Math.exp(-(s - 1) / EJECTA_DECAY);
}

// mulberry32: a tiny seeded PRNG so a crater's rays are reproducible.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRays(seed) {
  const r = rng(seed * 2654435761 + 1);
  const n = RAY_COUNT_MIN + Math.floor(r() * (RAY_COUNT_MAX - RAY_COUNT_MIN + 1));
  return Array.from({ length: n }, () => ({ phi: r() * TAU - Math.PI, len: 0.8 + 1.2 * r(), gain: 0.5 + 0.5 * r() }));
}

const wrapPi = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);

// Fresh-ray albedo weight at (s, azimuth phi): 1 inside the bowl; outside, a
// continuous halo plus narrow rays of roughly constant width; zero past RAY_REACH.
export function rayBrightness(s, phi, rays) {
  if (s < 1) return 1;
  if (s > RAY_REACH) return 0;
  let a = Math.exp(-(s - 1) / HALO_DECAY);
  for (const ray of rays) {
    const across = (wrapPi(phi - ray.phi) * s) / RAY_WIDTH;
    a += ray.gain * Math.exp(-across * across) * Math.exp(-(s - 1) / ray.len);
  }
  const end = 1 - Math.min(1, Math.max(0, (s - 0.8 * RAY_REACH) / (0.2 * RAY_REACH)));
  return Math.min(1, a) * end;
}

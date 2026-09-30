// riverStage.js — the Lagrangian river stage (spec §3). PARTICLES_PER_RIVER
// parcels per river, evenly spaced in travel time, advanced along the course by
// arc length at the river's velocity on the ocean's simulated clock. A parcel's
// state is the exact kinetics at its travel time (riverState), so its colour
// encodes time since discharge the way the ocean's does. Pure: no GL, no React.

import { riverState, doSat } from './kinetics';
import { haversineKm } from './sources';
import { RIVER_PALETTE } from './gpu/palette';

export const PARTICLES_PER_RIVER = 256;
export const FLOATS_PER_PARTICLE = 6; // clip x, clip y, r, g, b, a
export const GHOST_ALPHA = 0.5;

export function cumulativeKm(course) {
  const cum = new Float64Array(course.length);
  for (let p = 1; p < course.length; p++) cum[p] = cum[p - 1] + haversineKm(course[p - 1], course[p]);
  return cum;
}

// Index p (≥ 1) of the segment [p − 1, p] that holds arc length x.
function segmentAt(cum, x) {
  let p = 1;
  while (p < cum.length - 1 && cum[p] < x) p++;
  return p;
}

// [lon, lat] at arc length s (km), linear in lon/lat within a segment
// (segments are city-to-city, short on the globe). Clamped to the ends.
export function coursePoint(course, cum, s) {
  const total = cum[cum.length - 1];
  if (course.length < 2 || !(total > 0)) return [course[0][0], course[0][1]];
  const x = Math.min(Math.max(s, 0), total);
  const p = segmentAt(cum, x);
  const seg = cum[p] - cum[p - 1];
  const f = seg > 0 ? (x - cum[p - 1]) / seg : 0;
  const a = course[p - 1];
  const b = course[p];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

// The DO_MIN tick: where it sits and the screen angle of the course there
// (0° = heading east, −90° = heading north; screen y points down). A vertical
// bar rotated by angleDeg is perpendicular to the course.
export function courseTick(course, cum, s) {
  const total = cum[cum.length - 1];
  if (course.length < 2 || !(total > 0) || !Number.isFinite(s)) return null;
  const x = Math.min(Math.max(s, 0), total);
  const p = segmentAt(cum, x);
  const [lon, lat] = coursePoint(course, cum, x);
  const a = course[p - 1];
  const b = course[p];
  return { lon, lat, angleDeg: (Math.atan2(-(b[1] - a[1]), b[0] - a[0]) * 180) / Math.PI };
}

// Per-source constants for the fill. null when there is no river stage to draw
// (zero travel time or length) or the course crosses the date line (a straight
// user line to a wrapped snap cell; the HUD skips those lines too).
export function prepareRiver(src, { alpha = 1 } = {}) {
  if (!(src.travelDays > 0) || !(src.courseKm > 0)) return null;
  for (let p = 1; p < src.course.length; p++) {
    if (Math.abs(src.course[p][0] - src.course[p - 1][0]) > 180) return null;
  }
  return {
    id: src.id,
    course: src.course,
    cum: cumulativeKm(src.course),
    courseKm: src.courseKm,
    travelDays: src.travelDays,
    kernel: src.kernel,
    hyd: { velocityMs: src.velocityMs, depthM: src.depthM },
    sat: doSat(src.kernel.temp),
    alpha,
  };
}

// Smooth, slower motion (user decision 2026-09-30). A river's phase (0..1, one
// course per unit) advances with DISPLAY days (wall-time interpolated, never
// frame-counted). A course that takes ≥ MIN_CYCLE_S wall seconds at the chosen
// compression moves at literal Manning speed; a shorter one is slowed to one
// course per MIN_CYCLE_S so it glides instead of strobing. Colour stays exact
// (parcelTime → riverState): only the traverse speed is slowed. Legend:
// RIVER PARCELS ≥ 6 S PER COURSE · SLOWED · COLOUR EXACT.
export const MIN_CYCLE_S = 6;

export function advanceParcelPhase(phase, dDays, travelDays, dps) {
  if (!(dDays > 0)) return phase;
  const next = phase + dDays / Math.max(travelDays, MIN_CYCLE_S * dps);
  return next - Math.floor(next);
}

// Travel time of parcel p at river phase `phase`: evenly spaced over the
// course, wrapping at the mouth (a parcel reaching the sea respawns at the
// site). Interpolate the travel time first, then evaluate the kinetics at it.
export function parcelTime(p, phase, travelDays, n = PARTICLES_PER_RIVER) {
  const u = (p + 0.5) / n + phase;
  return (u - Math.floor(u)) * travelDays;
}

const pos = (x) => (x > 0 ? x : 0); // NaN and negatives → 0

export function particleColor(state, sat, alpha = 1, out = new Float32Array(4), off = 0) {
  const { crimson, amber, green, ref, deficitDim, minAlpha } = RIVER_PALETTE;
  const e0 = 1 - Math.exp(-pos(state.dT) / ref[0]);
  const e1 = 1 - Math.exp(-pos(state.L) / ref[1]);
  const e2 = 1 - Math.exp(-pos(state.N) / ref[2]);
  const dim = 1 - deficitDim * (sat > 0 ? Math.min(1, pos(state.D) / sat) : 0);
  for (let c = 0; c < 3; c++) {
    out[off + c] = Math.min(1, e0 * crimson[c] + e1 * amber[c] + e2 * green[c]) * dim;
  }
  out[off + 3] = alpha * (minAlpha + (1 - minAlpha) * Math.max(e0, e1, e2));
  return out;
}

// Writes FLOATS_PER_PARTICLE floats per parcel (clip-space position of the
// full equirectangular world, then RGBA) into out; returns the parcel count.
// phases[i] is rivers[i]'s phase (advanceParcelPhase).
export function fillParticles(rivers, phases, out) {
  let n = 0;
  for (let i = 0; i < rivers.length; i++) {
    const r = rivers[i];
    for (let p = 0; p < PARTICLES_PER_RIVER; p++) {
      const t = parcelTime(p, phases[i], r.travelDays);
      const [lon, lat] = coursePoint(r.course, r.cum, (t / r.travelDays) * r.courseKm);
      const o = n * FLOATS_PER_PARTICLE;
      out[o] = lon / 180;
      out[o + 1] = lat / 90;
      particleColor(riverState(r.kernel, t, r.hyd), r.sat, r.alpha, out, o + 2);
      n++;
    }
  }
  return n;
}

// The seal flare: one white vertex at `frac` (clamped to 0..1) of the course,
// written at parcel index `index`.
export function writeFlare(river, frac, out, index) {
  const f = Math.min(1, Math.max(0, frac));
  const [lon, lat] = coursePoint(river.course, river.cum, f * river.courseKm);
  const o = index * FLOATS_PER_PARTICLE;
  out[o] = lon / 180;
  out[o + 1] = lat / 90;
  out[o + 2] = 1;
  out[o + 3] = 1;
  out[o + 4] = 1;
  out[o + 5] = 1;
}

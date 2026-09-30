// sources.js — turns presets, sealed verdicts and the provisional ghost into
// ocean sources. River stage: point source, plug flow, no tributaries (HUD
// legend). Injection is physically dimensioned: ΔC = C_mouth·Q·Δt/(A_cell·H).

import { R_EARTH_KM } from './grid';
import { riverState, kd, kaRiver, criticalTime, doSat, manningVelocity } from './kinetics';
import { snapToOcean } from './landMask';
import { AUDIT_PRESETS } from '../auditPresets';
import { RIVERS } from './riverCourses';

export const MIXED_LAYER_M = 20;
export const SPLAT_SIGMA_CELLS = 1.5;
export const USER_VELOCITY_MS = 0.5;
export const USER_SNAP_RADIUS_CELLS = 64;

// Lagoon rule (spec phase-1 carry-over): a source never drains into an ocean
// basin smaller than this. Measured on the 512×256 grid (37 basins): world
// ocean 77,939 cells, Mediterranean 511, Black Sea 98, Caspian 91, Red Sea 81;
// then White Sea 20, an Arctic-Canada basin 18 and 30 basins of 1–6 cells.
// 40 keeps every real sea above and skips everything below. All nine preset
// mouths snap into basins of ≥ 81 cells, so presets are unaffected (tested).
export const MIN_SNAP_BASIN_CELLS = 40;

const snapFilter = (mask) =>
  mask.basinSize ? (k) => mask.basinSize[mask.basin[k]] >= MIN_SNAP_BASIN_CELLS : null;

const RAD = Math.PI / 180;

export function haversineKm([lon1, lat1], [lon2, lat2]) {
  const dLat = (lat2 - lat1) * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function courseLengthKm(course) {
  let km = 0;
  for (let p = 1; p < course.length; p++) km += haversineKm(course[p - 1], course[p]);
  return km;
}

// Gaussian splat over ocean cells, weights normalised to 1, so the source
// delivers exactly Q m³/s into the mixed layer. f is in 1/day.
export function splatCells(grid, land, snap, dischargeM3s, sigma = SPLAT_SIGMA_CELLS, H = MIXED_LAYER_M) {
  const r = Math.ceil(3 * sigma);
  const raw = [];
  let wsum = 0;
  for (let dj = -r; dj <= r; dj++) {
    const j = snap.j + dj;
    if (j < 0 || j >= grid.ny) continue;
    for (let di = -r; di <= r; di++) {
      const k = grid.idx(snap.i + di, j);
      if (land[k]) continue;
      const w = Math.exp(-(di * di + dj * dj) / (2 * sigma * sigma));
      raw.push({ k, j, w });
      wsum += w;
    }
  }
  return raw.map(({ k, j, w }) => {
    const area = (grid.cellKm * 1000) ** 2 * grid.cosLat[j];
    return { k, f: (dischargeM3s * 86400 * (w / wsum)) / (area * H) };
  });
}

export function buildSource(spec, grid, mask) {
  const { id, kind, course, dischargeM3s, velocityMs, depthM, snapRadius = USER_SNAP_RADIUS_CELLS } = spec;
  if (!(velocityMs > 0)) throw new Error(`buildSource(${id}): velocityMs must be > 0`);
  const kernel = {
    temp: Number(spec.kernel.temp),
    do: Number(spec.kernel.do),
    bod: Number(spec.kernel.bod),
    dt: Number(spec.kernel.dt),
    nitrate: Number(spec.kernel.nitrate),
  };
  const finite = (v) => Number.isFinite(v);
  if (!Object.values(kernel).every(finite) || !finite(dischargeM3s) || !finite(depthM)) return null;
  if (dischargeM3s < 0 || depthM <= 0) return null;
  if (!course.every((p) => p.every(finite))) return null;
  const end = course[course.length - 1];
  const snap = snapToOcean(grid, mask.land, end[0], end[1], snapRadius, snapFilter(mask));
  if (!snap) return null;

  const fullCourse = course.length === 1 ? [course[0], [snap.lon, snap.lat]] : course;
  const lengthKm = courseLengthKm(fullCourse);
  const kmPerDay = velocityMs * 86.4;
  const travelDays = lengthKm / kmPerDay;
  const hyd = { velocityMs, depthM };
  const mouth = riverState(kernel, travelDays, hyd);

  const D0 = Math.max(0, doSat(kernel.temp) - kernel.do);
  const tc = Math.min(criticalTime(kernel.bod, D0, kd(kernel.temp), kaRiver(velocityMs, depthM, kernel.temp)), travelDays);
  const atC = riverState(kernel, tc, hyd);
  const critical = {
    tDays: tc,
    kmFromSite: tc * kmPerDay,
    rkm: Math.max(0, lengthKm - tc * kmPerDay),
    doMin: Math.max(0, doSat(kernel.temp) - atC.D),
  };

  return {
    id, kind, snap, course: fullCourse, lengthKm, travelDays, mouth,
    conc: [mouth.dT, mouth.L, mouth.N, mouth.D],
    cells: splatCells(grid, mask.land, snap, dischargeM3s),
    critical, dischargeM3s,
  };
}

const num = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));

function formSpec(id, kind, lon, lat, params) {
  return {
    id, kind,
    kernel: params,
    course: [[num(lon), num(lat)]],
    dischargeM3s: num(params.flow),
    velocityMs: USER_VELOCITY_MS,
    depthM: Math.max(0.5, num(params.epi)),
  };
}

export function verdictSourceSpec(verdict) {
  const { lat, lon } = verdict.coordinates;
  return formSpec(verdict.hash, 'verdict', lon, lat, verdict.input);
}

export function ghostSourceSpec(params) {
  return formSpec('ghost', 'ghost', params.lon, params.lat, params);
}

// Preset rivers: the audited reach from site to mouth, Manning velocity, and
// the hydraulic radius as the reaeration depth. snapRadius 8: a preset mouth
// that is more than 8 cells from ocean is a data error, not a user input.
export function presetSourceSpec(preset, river = RIVERS[preset.key]) {
  return {
    id: `preset:${preset.key}`,
    kind: 'preset',
    kernel: preset,
    course: river.course,
    dischargeM3s: river.dischargeM3s,
    velocityMs: manningVelocity(river.manning),
    depthM: river.manning.R,
    snapRadius: 8,
  };
}

export function ambientSources(grid, mask) {
  return AUDIT_PRESETS
    .filter((p) => RIVERS[p.key])
    .map((p) => buildSource(presetSourceSpec(p), grid, mask))
    .filter(Boolean);
}

// Every archived verdict is a permanent source (spec decision 2). A verdict
// without usable coordinates (older records, empty form fields) or without its
// input is skipped, never guessed.
export function verdictSources(verdicts, grid, mask) {
  const out = [];
  for (const v of verdicts) {
    const c = v?.coordinates;
    if (!c || !v.input || !Number.isFinite(num(c.lat)) || !Number.isFinite(num(c.lon))) continue;
    const src = buildSource(verdictSourceSpec(v), grid, mask);
    if (src) out.push(src);
  }
  return out;
}

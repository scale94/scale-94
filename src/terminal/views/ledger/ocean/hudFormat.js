// hudFormat.js — pure text and geometry for the Ledger ocean HUD (spec §4).
// No React and no GL, so every string the HUD shows is unit-tested.

import { AUDIT_PRESETS } from '../../../ledger/auditPresets';
import { RIVERS } from '../../../ledger/ocean/riverCourses';
import { haversineKm } from '../../../ledger/ocean/sources';

export const MODE_LABEL = {
  static: 'STATIC · NO FLOAT TARGETS',
  'static-shader': 'STATIC · SIM SHADERS FAILED',
  unsupported: 'OCEAN UNAVAILABLE · NO WEBGL2',
  lost: 'OCEAN SUSPENDED · GPU CONTEXT LOST',
};

export const HUD_TITLE = 'THE OPEN LEDGER v2.0';
export const COMPRESSIONS = [1, 3, 9, 30];      // simulated days per wall second
export const DEFAULT_COMPRESSION = 9;
export const PROBE_INTERVAL_MS = 100;           // ≤ 10 Hz readPixels
export const PROBE_TAP_HOLD_MS = 5000;          // a tapped probe readout stays this long
export const COMPACT_BELOW_PX = 640;            // hero width below which the HUD collapses
export const PROBE_HINT = 'HOVER TO PROBE';
export const PROBE_NOTE = 'MODEL VALUES · NOT MEASURED';

// Spec §3 honesty notes that apply to what 3a draws.
export const LEGEND_NOTES = [
  'MODEL KINETICS · LITERATURE RANGES',
  'PRESET LOADS NARRATIVE-TUNED · NOT MEASURED',
  'CLIMATOLOGICAL CURRENTS · NOT FORECAST',
  'POINT SOURCE · PLUG FLOW · NO TRIBUTARIES',
  'USER SITES · STRAIGHT-LINE APPROX',
  'DO_SAT FRESHWATER FIT · ~20% HIGH AT SEA',
];

// The composite's channel colours (shaders.js COMPOSITE_FS CRIMSON / AMBER /
// GREEN; the deficit is an absence of light with a cyan rim).
export const LEGEND_SWATCHES = [
  { label: 'ΔT', color: 'rgb(255,23,51)' },
  { label: 'BOD', color: 'rgb(255,158,0)' },
  { label: 'NO₃', color: 'rgb(56,255,20)' },
  { label: 'DO↓', color: '#050505', ring: 'rgb(0,230,255)' },
];

// Moved verbatim from LedgerMap.jsx (deleted in 3a).
export const STATUS_COLOR = {
  APPROVED: '#22c55e',
  CONDITIONAL: '#eab308',
  REJECTED: '#ef4444',
  EMERGENCY_VETO: '#ef4444',
};
export const DEFAULT_COLOR = '#38bdf8';
export const PRESET_COLOR = '#14b8a6';

export function nextCompression(dps) {
  return COMPRESSIONS[(COMPRESSIONS.indexOf(dps) + 1) % COMPRESSIONS.length];
}

export function statusLabel(status) {
  return status ? status.replace(/_/g, ' ') : 'UNKNOWN';
}

export function summaryLine(verdicts) {
  const counts = new Map();
  for (const v of verdicts) {
    const s = v.status || 'UNKNOWN';
    counts.set(s, (counts.get(s) || 0) + 1);
  }
  const n = verdicts.length;
  const head = `${n} VERDICT${n !== 1 ? 'S' : ''} RECORDED`;
  const parts = [...counts].map(([s, c]) => `${c} ${statusLabel(s)}`);
  return parts.length ? `${head}  ·  ${parts.join('  ·  ')}` : head;
}

export function formatClock(days) {
  return `T+ ${days.toFixed(2)} d`;
}

export function formatFrame(ms) {
  return ms > 0 ? `Δt ${ms.toFixed(1)} ms · ${Math.round(1000 / ms)} Hz` : 'Δt — ms';
}

export function fmtValue(x) {
  if (!(x > 0)) return '0';
  if (x >= 100) return x.toFixed(0);
  if (x >= 1) return x.toFixed(1);
  if (x >= 0.01) return x.toFixed(2);
  return x.toExponential(1); // 3.2e-4 → '3.2e-4'
}

const fmtLat = (lat) => `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`;
const fmtLon = (lon) => `${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;

export function formatProbe(lon, lat, v, isLand) {
  const where = `${fmtLat(lat)} ${fmtLon(lon)}`;
  if (isLand) return `${where} · LAND`;
  if (!v) return `${where} · NO DATA`;
  return `${where} · ΔT ${fmtValue(v[0])} °C · BOD ${fmtValue(v[1])} · NO₃ ${fmtValue(v[2])} · DO↓ ${fmtValue(v[3])} mg/L`;
}

// Canvas CSS pixels → lon/lat. The composite is the full equirectangular
// world, north up (row 0 of the state texture is the bottom of the canvas).
export function pointerToLonLat(x, y, w, h) {
  if (!(w > 0) || !(h > 0) || x < 0 || y < 0 || x >= w || y >= h) return null;
  return { lon: -180 + (360 * x) / w, lat: 90 - (180 * y) / h };
}

export function lonLatToPct(lon, lat) {
  return { left: ((lon + 180) / 360) * 100, top: ((90 - lat) / 180) * 100 };
}

const PRESET_BY_ID = new Map(AUDIT_PRESETS.map((p) => [`preset:${p.key}`, p]));

// Ring + tooltip data per built source. Snap distance: presets from the last
// point of their RIVERS course (the mouth) to the snapped ocean cell; verdicts
// from the audit site (their course is the straight snap line).
export function describeSites(sources, verdicts = []) {
  const byHash = new Map(verdicts.map((v) => [v.hash, v]));
  return sources.map((s) => {
    const site = s.course[0];
    const snap = [s.snap.lon, s.snap.lat];
    const base = {
      id: s.id, kind: s.kind, site, snap,
      dischargeM3s: s.dischargeM3s, doMin: s.critical.doMin, rkm: s.critical.rkm,
    };
    if (s.kind === 'preset') {
      const key = s.id.slice('preset:'.length);
      return {
        ...base,
        snapKm: haversineKm(RIVERS[key].course.at(-1), snap),
        name: PRESET_BY_ID.get(s.id)?.siteName ?? key,
        status: null,
        color: PRESET_COLOR,
      };
    }
    const v = byHash.get(s.id);
    const status = v?.status ?? 'UNKNOWN';
    return {
      ...base,
      snapKm: haversineKm(site, snap),
      name: v?.input?.siteName || 'USER SITE',
      status,
      color: STATUS_COLOR[status] || DEFAULT_COLOR,
    };
  });
}

const fmtQ = (q) => (q >= 10 ? Math.round(q).toLocaleString('en-US') : q.toFixed(1));

export function tooltipLines(site) {
  const q = `Q ${fmtQ(site.dischargeM3s)} m³/s`;
  const pct = ((site.dischargeM3s / RIVERS.usa.dischargeM3s) * 100).toPrecision(2);
  return [
    site.name,
    site.kind === 'preset' ? 'AMBIENT PRESET' : statusLabel(site.status),
    site.kind === 'preset' ? q : `${q} · ${pct}% OF MISSISSIPPI`,
    `DO_MIN ${site.doMin.toFixed(1)} mg/L @ rkm ${Math.round(site.rkm)}`,
    `SNAP ${Math.round(site.snapKm)} km TO OCEAN`,
  ];
}

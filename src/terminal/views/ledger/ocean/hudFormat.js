// hudFormat.js — pure text and geometry for the Ledger ocean HUD (spec §4).
// No React and no GL, so every string the HUD shows is unit-tested.

import { ALL_AUDIT_PRESETS } from '../../../ledger/auditPresets';
import { RIVERS } from '../../../ledger/ocean/riverCourses';
import { CATALOG } from '../../../ledger/ocean/riverCatalog';
import { haversineKm } from '../../../ledger/ocean/sources';
import { cumulativeKm, courseTick } from '../../../ledger/ocean/riverStage';

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
export const PROBE_NOISE_FLOOR = 1e-6;         // |x| below this is float noise: the probe prints 0
export const RING_TAP_RADIUS_PX = 6;            // compact: a tap this close (css px) to a ring centre opens it
export const PARTICLE_PX = 2;                   // river-stage parcel size, css px
export const FLARE_PX = 7;                      // the seal flare, css px
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
  'RIVER PARCELS ≥ 6 S PER COURSE · SLOWED · COLOUR EXACT',
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
export const GHOST_COLOR = '#cbd5e1';
export const GHOST_DASH = '4 3';
export const GHOST_LABEL = 'PROVISIONAL';

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
  if (!(x >= PROBE_NOISE_FLOOR)) return '0'; // ≤ 0, NaN and float noise
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

// The id of the site whose ring centre is nearest (x, y) in a w×h canvas,
// within radiusPx (inclusive); null when none is that close.
export function pickSite(sites, x, y, w, h, radiusPx = RING_TAP_RADIUS_PX) {
  let best = null;
  let bestD = radiusPx;
  for (const s of sites) {
    const { left, top } = lonLatToPct(s.site[0], s.site[1]);
    const d = Math.hypot((left / 100) * w - x, (top / 100) * h - y);
    if (d <= bestD) { best = s.id; bestD = d; }
  }
  return best;
}

const PRESET_BY_ID = new Map(ALL_AUDIT_PRESETS.map((p) => [`preset:${p.key}`, p]));

// Ring + tooltip data per built source (presets, verdicts, and the ghost). Snap distance: presets from the last
// point of their RIVERS course (the mouth) to the snapped ocean cell; verdicts
// from the audit site (their course is the straight snap line).
// courseCssPx: the drawn course's length on screen (site → mouth, CSS px in a
// hero of `hero` size, equirectangular); null when no size is given.
export function courseCssPx(course, { width, height }) {
  let px = 0;
  for (let p = 1; p < course.length; p++) {
    px += Math.hypot(
      ((course[p][0] - course[p - 1][0]) / 360) * width,
      ((course[p][1] - course[p - 1][1]) / 180) * height,
    );
  }
  return px;
}

export function describeSites(sources, verdicts = [], ghostParams = null, hero = null) {
  const byHash = new Map(verdicts.map((v) => [v.hash, v]));
  return sources.map((s) => {
    const site = s.course[0];
    const snap = [s.snap.lon, s.snap.lat];
    const base = {
      id: s.id, kind: s.kind, site, snap, course: s.course,
      tick: courseTick(s.course, cumulativeKm(s.course), s.critical.courseKm),
      courseCssPx: hero ? courseCssPx(s.course, hero) : null,
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
    if (s.kind === 'catalog') {
      const key = s.id.slice('catalog:'.length);
      return {
        ...base,
        snapKm: haversineKm(CATALOG[key].outfall, snap),
        name: CATALOG[key].label,
        status: null,
        color: PRESET_COLOR,
      };
    }
    if (s.kind === 'ghost') {
      return {
        ...base,
        snapKm: haversineKm(site, snap),
        name: ghostParams?.siteName || 'PROVISIONAL SITE',
        status: null,
        color: GHOST_COLOR,
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

export const fmtQ = (q) => {
  if (q === 0) return '0';
  // a nonzero source must never read as zero
  if (q > 0 && q < 0.001) return '< 0.001';
  if (q >= 10) return Math.round(q).toLocaleString('en-US');
  // 0 < q < 10: 2 significant digits without exponent
  if (q >= 1) return q.toFixed(1);
  // 0 < q < 1: 3 decimals to show 2 sig figs, e.g. 0.04 → '0.040'
  return q.toFixed(3);
};

export function tooltipLines(site) {
  const q = `Q ${fmtQ(site.dischargeM3s)} m³/s`;
  const pctValue = (site.dischargeM3s / RIVERS.usa.dischargeM3s) * 100;
  let pct;
  if (pctValue > 0 && pctValue < 0.01) pct = '< 0.01'; // never exponent form
  else pct = pctValue < 10 ? pctValue.toPrecision(2) : Math.round(pctValue);
  return [
    site.name,
    site.kind === 'preset' ? 'AMBIENT PRESET' : site.kind === 'catalog' ? 'AMBIENT RIVER'
      : site.kind === 'ghost' ? GHOST_LABEL : statusLabel(site.status),
    site.kind === 'preset' || site.kind === 'catalog' ? q : `${q} · ${pct}% OF MISSISSIPPI`,
    Number.isFinite(site.doMin) && Number.isFinite(site.rkm)
      ? `DO_MIN ${site.doMin.toFixed(1)} mg/L @ rkm ${Math.round(site.rkm)}`
      : 'DO_MIN — mg/L @ rkm —',
    `SNAP ${Math.round(site.snapKm)} km TO OCEAN`,
  ];
}

// HUD text metrics. The HUD is monospace at HUD_FONT_PX with 0.12 em letter
// spacing (OceanHud); a monospace glyph advances ~0.6 em. Used where DOM
// measurement is unavailable (jsdom returns 0) or would cost a layout.
export const HUD_FONT_PX = { compact: 8, desktop: 9 };
export const HUD_LETTER_SPACING_EM = 0.12;
const HUD_ADVANCE_EM = 0.6;
const HUD_LINE_HEIGHT = 1.5;
const LABEL_GAP_PX = 3;          // between the ring box and the label
const LABEL_EDGE_PX = 16;        // the label never ends closer than this to the hero's right edge

export function hudTextWidthPx(text, fontPx) {
  return text.length * fontPx * (HUD_ADVANCE_EM + HUD_LETTER_SPACING_EM);
}

// Where the PROVISIONAL label goes (css px in the hero; x, y = the ghost ring
// centre; others = the other rings' centres). Right of the ring by default;
// on the left (same gap) if it would end beyond heroWidth − LABEL_EDGE_PX,
// shifted right by dx if that would start closer than LABEL_EDGE_PX to the
// hero's left edge. Then, if the box covers another ring (centre within the
// box grown by the ring radius), one ring diameter up, else down, preferring
// a nudge that stays inside the hero; finally, once the hero is sized, the
// box is clamped to 0 ≤ top, bottom ≤ heroHeight. Ghost label only: not a
// general repulsion system.
export function ghostLabelPlacement({
  x, y, heroWidth = Infinity, heroHeight = Infinity, ringPx, fontPx, others = [], text = GHOST_LABEL,
}) {
  const gap = ringPx / 2 + LABEL_GAP_PX;
  const w = hudTextWidthPx(text, fontPx);
  const h = fontPx * HUD_LINE_HEIGHT;
  const side = x + gap + w > heroWidth - LABEL_EDGE_PX ? 'left' : 'right';
  const flipped = x - gap - w;
  const left = side === 'right' ? x + gap : Math.max(flipped, LABEL_EDGE_PX);
  const dx = side === 'right' ? 0 : left - flipped;
  const boxAt = (dy) => ({ left, right: left + w, top: y + dy - h / 2, bottom: y + dy + h / 2 });
  const r = ringPx / 2;
  const covers = (b) => others.some(([ox, oy]) =>
    ox >= b.left - r && ox <= b.right + r && oy >= b.top - r && oy <= b.bottom + r);
  const sized = Number.isFinite(heroHeight);   // unsized (no layout yet): no vertical bound
  const inside = (b) => !sized || (b.top >= 0 && b.bottom <= heroHeight);
  let dy = 0;
  if (covers(boxAt(0))) {
    const nudges = [-ringPx, ringPx];
    dy = nudges.find((d) => inside(boxAt(d)) && !covers(boxAt(d)))
      ?? nudges.find((d) => !covers(boxAt(d)))
      ?? -ringPx;
  }
  const b = boxAt(dy);
  if (sized && b.top < 0) dy -= b.top;
  else if (sized && b.bottom > heroHeight) dy -= b.bottom - heroHeight;
  return { side, gap, dx, dy, box: boxAt(dy) };
}

export const SITES_GROUP_LABEL = 'Audit sites';
export const NOTES_TOGGLE_LABEL = 'Legend notes';

// Roving tabindex over the source rings: the next ring index for a key, or null.
export function keyStep(key, i, n) {
  if (!(n > 0)) return null;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (i + 1) % n;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (i - 1 + n) % n;
  if (key === 'Home') return 0;
  if (key === 'End') return n - 1;
  return null;
}

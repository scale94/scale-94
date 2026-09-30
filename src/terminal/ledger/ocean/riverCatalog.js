// riverCatalog.js — the ambient catalog: major global river mouths beyond the
// nine audit presets. Mouth-only sources (course = [outfall]): no river stage,
// just the plume the ocean advects. RIVERS/AUDIT_PRESETS are untouched.
// Outfalls and mean discharges are the figures in the 2026-09-30 catalog
// request; none has been checked against a cited gauge series yet, and the
// water-quality kernel is a background baseline, not a measurement.

import { doSat } from './kinetics';

const FROM_BRIEF = 'User brief 2026-09-30 (/LEDGER river catalog request); not yet checked against a cited source';
const KERNEL_NOTE = 'UNVERIFIED — near-pristine background baseline by climate band (do 92 % of saturation, bod 2, dt 0, nitrate 3), not a measurement';

// temp: 27 for |lat| < 25, 14 for 25–60, 5 above 60 (the outfall's latitude).
const baseline = (temp) => ({
  temp, do: Math.round(doSat(temp) * 0.92 * 10) / 10, bod: 2, dt: 0, nitrate: 3,
});

const entry = (label, outfall, dischargeM3s, temp, extra = '') => ({
  label,
  outfall,
  dischargeM3s,
  kernel: baseline(temp),
  sources: {
    outfall: `${FROM_BRIEF}${extra}`,
    dischargeM3s: `${FROM_BRIEF}${extra}`,
    kernel: KERNEL_NOTE,
  },
});

export const CATALOG = {
  amazon: entry('AMAZON', [-50.0, 0.0], 209000, 27, '; Macapá delta'),
  parana: entry('PARANÁ / RÍO DE LA PLATA', [-57.0, -35.0], 17200, 14, '; Río de la Plata estuary'),
  elbe: entry('ELBE', [8.7, 53.86], 870, 14, '; Cuxhaven'),
  congo: entry('CONGO', [12.35, -6.07], 41000, 27, '; Banana'),
  nile_rosetta: entry('NILE (ROSETTA)', [30.4, 31.4], 1400, 14, '; half of 2,800 m³/s — the 50/50 split between the two mouths is UNVERIFIED'),
  nile_damietta: entry('NILE (DAMIETTA)', [31.8, 31.5], 1400, 14, '; half of 2,800 m³/s — the 50/50 split between the two mouths is UNVERIFIED'),
  niger: entry('NIGER', [6.0, 4.3], 5600, 27, '; Gulf of Guinea delta'),
  st_lawrence: entry('SAINT LAWRENCE', [-67.0, 49.3], 16800, 14, '; Gulf of St. Lawrence'),
  lena: entry('LENA', [127.0, 72.0], 16800, 5, '; Laptev Sea'),
  yenisey: entry('YENISEY', [82.5, 72.5], 19600, 5, '; Kara Sea'),
  mekong: entry('MEKONG', [106.8, 10.2], 16000, 27, '; South China Sea delta'),
  yellow: entry('YELLOW (HUANG HE)', [119.2, 37.7], 2570, 14, '; Bohai Sea'),
  indus: entry('INDUS', [67.5, 24.0], 6600, 27, '; Arabian Sea'),
};

// A mouth-only source: the one-point course makes buildSource draw a short
// straight line to the snapped cell, and prepareRiver skips kind 'catalog'.
export function catalogSourceSpec(key, entry = CATALOG[key]) {
  return {
    id: `catalog:${key}`,
    kind: 'catalog',
    kernel: entry.kernel,
    course: [entry.outfall],
    dischargeM3s: entry.dischargeM3s,
    velocityMs: 1,
    depthM: 10,
    snapRadius: 8,
  };
}

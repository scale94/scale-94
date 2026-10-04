# /LEDGER River Catalog and Catchment Snapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 13 ambient catalog river sources (12 rivers, Nile as two mouths) to the ledger ocean, and route verdict/ghost sites to their own river's outfall through hand-authored catchment rings, falling back to today's nearest-ocean snap.

**Architecture:** `riverCatalog.js` holds mouth-only source data (no river stage, plume only). `catchments.js` holds 17 coarse point-in-polygon rings (12 new rivers + Rhine, Danube, Mississippi, Yangtze, Ganges–Brahmaputra). `sources.js` gets a `snapAt` field: verdict/ghost specs carry the catchment outfall, `buildSource` snaps there first (radius 8) and otherwise behaves exactly as today. No shader, advection or `RIVERS`/`AUDIT_PRESETS` change.

**Tech Stack:** plain JS modules, vitest, React (HUD), existing 512×256 `OCEAN_GRID`.

**Spec:** `docs/superpowers/specs/2026-09-30-ledger-river-catalog-catchments-design.md`

## Global Constraints

- `src/terminal/ledger/auditPresets.js`, `src/terminal/ledger/ocean/riverCourses.js` and the Mercury preset are NOT edited (verified by `git diff --stat` in Task 5). Their existing tests pass unmodified except the one site change named in Task 3.
- `ambientSources(grid, mask)` keeps returning exactly the 9 presets (`riverCourses.test.js` pins this). The world uses the new `oceanSources(grid, mask)` = 9 presets, then 13 catalog sources.
- Catalog outfalls (lon, lat) and discharges (m³/s) exactly as in the spec table; Nile 2,800 split 1,400 + 1,400.
- Every catalog and catchment datum carries a source note; kernel and ring notes start with the literal `UNVERIFIED`.
- Catalog kernels: `do` = 92 % of `doSat(temp)` rounded to 0.1, `bod` 2, `dt` 0, `nitrate` 3; `temp` 27 for |lat| < 25, 14 for 25–60, 5 above 60.
- Catchment lookup is lon/lat ray casting; no ring crosses the antimeridian; rings must not overlap each other.
- Fallback when no ring matches, or a ring's outfall does not snap: today's `snapToOcean(site, snapRadius = 64, lagoon filter)`.
- Git: work on a new branch cut from `feature/ledger-advection` (`git switch -c feature/ledger-river-catalog`). Commit local only. NEVER push (the user pushes on an explicit command). Stage explicit paths only: the working tree has unrelated modified and untracked files.
- Run tests with `npx vitest run <path>` from `F:\scale_9.4`.

---

### Task 1: River catalog data and `oceanSources`

**Files:**
- Create: `src/terminal/ledger/ocean/riverCatalog.js`
- Modify: `src/terminal/ledger/ocean/sources.js` (imports, add `catalogSources`, `oceanSources` after `ambientSources`)
- Test: `src/terminal/ledger/ocean/__tests__/riverCatalog.test.js`

**Interfaces:**
- Produces: `CATALOG` (object keyed by catalog key), `catalogSourceSpec(key, entry = CATALOG[key])` → buildSource spec with `id: 'catalog:<key>'`, `kind: 'catalog'`; in `sources.js`: `catalogSources(grid, mask)` and `oceanSources(grid, mask)`.
- Catalog keys: `amazon, parana, elbe, congo, nile_rosetta, nile_damietta, niger, st_lawrence, lena, yenisey, mekong, yellow, indus`.
- Entry shape: `{ label, outfall: [lon, lat], dischargeM3s, kernel: { temp, do, bod, dt, nitrate }, sources: { outfall, dischargeM3s, kernel } }`.

- [ ] **Step 0: Branch**

```bash
git switch -c feature/ledger-river-catalog
```

- [ ] **Step 1: Write the failing test**

Create `src/terminal/ledger/ocean/__tests__/riverCatalog.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { OCEAN_GRID } from '../grid';
import { buildLandMask } from '../landMask';
import { CATALOG, catalogSourceSpec } from '../riverCatalog';
import {
  buildSource, catalogSources, oceanSources, ambientSources, MIN_SNAP_BASIN_CELLS,
} from '../sources';
import { doSat } from '../kinetics';
import { ALL_AUDIT_PRESETS } from '../../auditPresets';

const grid = OCEAN_GRID;
const mask = buildLandMask(grid);

const BRIEF = {
  amazon: [[-50.0, 0.0], 209000],
  parana: [[-57.0, -35.0], 17200],
  elbe: [[8.7, 53.86], 870],
  congo: [[12.35, -6.07], 41000],
  nile_rosetta: [[30.4, 31.4], 1400],
  nile_damietta: [[31.8, 31.5], 1400],
  niger: [[6.0, 4.3], 5600],
  st_lawrence: [[-67.0, 49.3], 16800],
  lena: [[127.0, 72.0], 16800],
  yenisey: [[82.5, 72.5], 19600],
  mekong: [[106.8, 10.2], 16000],
  yellow: [[119.2, 37.7], 2570],
  indus: [[67.5, 24.0], 6600],
};

describe('CATALOG data', () => {
  it('has exactly the 13 briefed sources with the briefed outfall and discharge', () => {
    expect(Object.keys(CATALOG).sort()).toEqual(Object.keys(BRIEF).sort());
    for (const [key, [outfall, q]] of Object.entries(BRIEF)) {
      expect(CATALOG[key].outfall, key).toEqual(outfall);
      expect(CATALOG[key].dischargeM3s, key).toBe(q);
    }
  });

  it('splits the Nile 2,800 m3/s across its two mouths', () => {
    expect(CATALOG.nile_rosetta.dischargeM3s + CATALOG.nile_damietta.dischargeM3s).toBe(2800);
  });

  it('carries a source note on every datum and marks the kernel UNVERIFIED', () => {
    for (const [key, e] of Object.entries(CATALOG)) {
      for (const f of ['outfall', 'dischargeM3s', 'kernel']) {
        expect(typeof e.sources[f] === 'string' && e.sources[f].length > 10, `${key}.${f}`).toBe(true);
      }
      expect(e.sources.kernel.startsWith('UNVERIFIED'), key).toBe(true);
      expect(typeof e.label).toBe('string');
    }
  });

  it('uses the near-pristine climate-banded baseline kernel', () => {
    for (const [key, e] of Object.entries(CATALOG)) {
      const lat = Math.abs(e.outfall[1]);
      expect(e.kernel.temp, key).toBe(lat < 25 ? 27 : lat <= 60 ? 14 : 5);
      expect(e.kernel.do, key).toBeCloseTo(Math.round(doSat(e.kernel.temp) * 0.92 * 10) / 10, 9);
      expect([e.kernel.bod, e.kernel.dt, e.kernel.nitrate], key).toEqual([2, 0, 3]);
    }
  });
});

describe('catalog sources on the real grid', () => {
  it.each(Object.keys(BRIEF))('%s outfall snaps within 3 cells into a real sea', (key) => {
    const s = buildSource(catalogSourceSpec(key), grid, mask);
    expect(s, key).not.toBeNull();
    expect(s.snap.distCells).toBeLessThanOrEqual(3);
    expect(mask.basinSize[mask.basin[s.snap.k]]).toBeGreaterThanOrEqual(MIN_SNAP_BASIN_CELLS);
    expect(s.conc.every(Number.isFinite)).toBe(true);
    expect(s.kind).toBe('catalog');
    expect(s.id).toBe(`catalog:${key}`);
  });

  it('catalogSources builds all 13', () => {
    expect(catalogSources(grid, mask).map((s) => s.id).sort())
      .toEqual(Object.keys(BRIEF).map((k) => `catalog:${k}`).sort());
  });

  it('oceanSources = the nine presets untouched, then the catalog', () => {
    const all = oceanSources(grid, mask);
    const presets = ambientSources(grid, mask);
    expect(presets.map((s) => s.id)).toEqual(ALL_AUDIT_PRESETS.map((p) => `preset:${p.key}`));
    expect(all.slice(0, presets.length)).toEqual(presets);
    expect(all).toHaveLength(presets.length + 13);
  });

  it('the Amazon is the largest ambient discharge', () => {
    const q = oceanSources(grid, mask).map((s) => [s.id, s.dischargeM3s]).sort((a, b) => b[1] - a[1]);
    expect(q[0][0]).toBe('catalog:amazon');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/riverCatalog.test.js`
Expected: FAIL, cannot resolve `../riverCatalog`.

- [ ] **Step 3: Write `riverCatalog.js`**

```js
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
```

- [ ] **Step 4: Edit `sources.js`**

Add to the imports (after the `RIVERS` import line):

```js
import { CATALOG, catalogSourceSpec } from './riverCatalog';
```

Add directly after the `ambientSources` function:

```js
export function catalogSources(grid, mask) {
  return Object.keys(CATALOG)
    .map((key) => buildSource(catalogSourceSpec(key), grid, mask))
    .filter(Boolean);
}

// What the world draws: the nine audited presets (unchanged, first), then the
// ambient catalog. ambientSources stays presets-only (riverCourses.test pins it).
export function oceanSources(grid, mask) {
  return [...ambientSources(grid, mask), ...catalogSources(grid, mask)];
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/riverCatalog.test.js src/terminal/ledger/ocean/__tests__/sources.test.js src/terminal/ledger/ocean/__tests__/riverCourses.test.js`
Expected: all PASS (existing tests unaffected; no consumer uses `oceanSources` yet).

- [ ] **Step 6: Commit**

```bash
git add src/terminal/ledger/ocean/riverCatalog.js src/terminal/ledger/ocean/sources.js src/terminal/ledger/ocean/__tests__/riverCatalog.test.js
git commit -m "feat(ledger): ambient river catalog, 13 mouth-only sources"
```

---

### Task 2: Catchment rings and `catchmentTarget`

**Files:**
- Create: `src/terminal/ledger/ocean/catchments.js`
- Test: `src/terminal/ledger/ocean/__tests__/catchments.test.js`

**Interfaces:**
- Consumes: `CATALOG` (Task 1), `RIVERS` from `./riverCourses`.
- Produces: `CATCHMENTS` (array of `{ key, outfalls: string[], ring: [lon, lat][], sources: { ring } }`, `outfalls` are source ids `catalog:<key>` or `preset:<key>`), `catchmentTarget(lon, lat)` → `{ key, sourceId, outfall: [lon, lat] } | null`.
- The ring data below was validated before this plan was written: 0 overlaps on a 0.5° lattice and every test city below lands in exactly its ring.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/ledger/ocean/__tests__/catchments.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { CATCHMENTS, catchmentTarget } from '../catchments';
import { CATALOG } from '../riverCatalog';
import { RIVERS } from '../riverCourses';

// [name, lon, lat, ring key]
const ROUTES = [
  ['Berlin', 13.405, 52.52, 'elbe'], ['Prague', 14.42, 50.08, 'elbe'], ['Hamburg', 10.0, 53.55, 'elbe'], ['Dresden', 13.74, 51.05, 'elbe'],
  ['Manaus', -60.0217, -3.119, 'amazon'], ['Iquitos', -73.25, -3.75, 'amazon'], ['Santarem', -54.7, -2.44, 'amazon'],
  ['Kinshasa', 15.3, -4.32, 'congo'], ['Kisangani', 25.2, 0.5, 'congo'], ['Lubumbashi', 27.5, -11.66, 'congo'],
  ['Cairo', 31.24, 30.04, 'nile'], ['Khartoum', 32.53, 15.5, 'nile'], ['Kampala', 32.58, 0.35, 'nile'], ['Bahir Dar', 37.39, 11.6, 'nile'], ['Aswan', 32.9, 24.09, 'nile'],
  ['Bamako', -8.0, 12.64, 'niger'], ['Niamey', 2.11, 13.51, 'niger'], ['Abuja', 7.5, 9.08, 'niger'],
  ['Montreal', -73.57, 45.5, 'stlawrence'], ['Toronto', -79.38, 43.65, 'stlawrence'], ['Quebec', -71.2, 46.8, 'stlawrence'], ['Thunder Bay', -89.25, 48.38, 'stlawrence'], ['Milwaukee', -87.9, 43.04, 'stlawrence'],
  ['Yakutsk', 129.73, 62.03, 'lena'],
  ['Krasnoyarsk', 92.87, 56.01, 'yenisey'], ['Ulaanbaatar', 106.9, 47.9, 'yenisey'], ['Irkutsk', 104.28, 52.29, 'yenisey'],
  ['Phnom Penh', 104.92, 11.56, 'mekong'], ['Vientiane', 102.6, 17.97, 'mekong'],
  ['Lanzhou', 103.8, 36.06, 'yellow'], ['Zhengzhou', 113.65, 34.75, 'yellow'], ['Xi\'an', 108.94, 34.34, 'yellow'], ['Taiyuan', 112.55, 37.87, 'yellow'],
  ['Lahore', 74.35, 31.55, 'indus'], ['Karachi', 67.0, 24.86, 'indus'], ['Islamabad', 73.05, 33.68, 'indus'], ['Kabul', 69.2, 34.5, 'indus'],
  ['Asuncion', -57.6, -25.3, 'parana'], ['Sao Paulo', -46.63, -23.55, 'parana'], ['Buenos Aires', -58.4, -34.6, 'parana'], ['Cuiaba', -56.1, -15.6, 'parana'], ['Montevideo', -56.2, -34.85, 'parana'],
  ['Cologne', 6.96, 50.94, 'rhine'], ['Frankfurt', 8.68, 50.11, 'rhine'], ['Basel', 7.59, 47.56, 'rhine'], ['Stuttgart', 9.18, 48.78, 'rhine'], ['Nuremberg', 11.08, 49.45, 'rhine'],
  ['Vienna', 16.37, 48.21, 'danube'], ['Linz', 14.29, 48.31, 'danube'], ['Budapest', 19.04, 47.5, 'danube'], ['Belgrade', 20.46, 44.79, 'danube'], ['Munich', 11.58, 48.14, 'danube'], ['Bucharest', 26.1, 44.43, 'danube'], ['Zagreb', 15.98, 45.81, 'danube'],
  ['New Orleans', -90.07, 29.95, 'mississippi'], ['St Louis', -90.2, 38.63, 'mississippi'], ['Minneapolis', -93.27, 44.98, 'mississippi'], ['Pittsburgh', -80, 40.44, 'mississippi'], ['Memphis', -90.05, 35.15, 'mississippi'], ['Nashville', -86.78, 36.16, 'mississippi'],
  ['Wuhan', 114.3, 30.59, 'yangtze'], ['Shanghai', 121.47, 31.23, 'yangtze'], ['Chongqing', 106.55, 29.56, 'yangtze'], ['Chengdu', 104.07, 30.67, 'yangtze'], ['Nanjing', 118.8, 32.06, 'yangtze'], ['Kunming', 102.7, 25.0, 'yangtze'],
  ['Delhi', 77.2, 28.6, 'ganges'], ['Varanasi', 83.0, 25.3, 'ganges'], ['Dhaka', 90.4, 23.8, 'ganges'], ['Guwahati', 91.75, 26.14, 'ganges'], ['Lhasa', 91.1, 29.65, 'ganges'], ['Kolkata', 88.36, 22.57, 'ganges'],
];

// Outside every ring: today's nearest-ocean snap applies.
const OUTSIDE = [
  ['Suez', 32.55, 29.97], ['Arkhangelsk', 40.54, 64.54], ['Lyon', 4.83, 45.76], ['Warsaw', 21.0, 52.23],
  ['Sahara', 10, 25], ['Antarctica', 0, -80], ['mid-Atlantic', -30, 0], ['Oslo', 10.75, 59.9],
  ['Krakow', 19.9, 50.06], ['Paris', 2.35, 48.85], ['Houston', -95.4, 29.76], ['Hong Kong', 114.17, 22.3],
];

describe('catchmentTarget', () => {
  it.each(ROUTES)('%s routes to the %s ring', (name, lon, lat, key) => {
    const t = catchmentTarget(lon, lat);
    expect(t, name).not.toBeNull();
    expect(t.key, name).toBe(key);
    expect(t.outfall).toHaveLength(2);
  });

  it.each(OUTSIDE)('%s is outside every catchment', (name, lon, lat) => {
    expect(catchmentTarget(lon, lat), name).toBeNull();
  });

  it('routes Berlin to the Elbe outfall, not the Baltic', () => {
    const t = catchmentTarget(13.405, 52.52);
    expect(t.sourceId).toBe('catalog:elbe');
    expect(t.outfall).toEqual(CATALOG.elbe.outfall);
  });

  it('routes the Rhine, Danube, Mississippi, Yangtze and Ganges rings to the existing preset outfalls', () => {
    const want = { rhine: 'germany', danube: 'danube', mississippi: 'usa', yangtze: 'yangtze', ganges: 'ganges' };
    for (const [ring, preset] of Object.entries(want)) {
      const c = CATCHMENTS.find((x) => x.key === ring);
      expect(c.outfalls).toEqual([`preset:${preset}`]);
    }
    const t = catchmentTarget(6.96, 50.94);
    expect(t.sourceId).toBe('preset:germany');
    expect(t.outfall).toEqual(RIVERS.germany.course.at(-1));
  });

  it('sends the Nile to the nearer of its two mouths', () => {
    expect(catchmentTarget(30.0, 31.0).sourceId).toBe('catalog:nile_rosetta');
    expect(catchmentTarget(32.1, 30.5).sourceId).toBe('catalog:nile_damietta');
  });

  it('returns null for non-finite input', () => {
    for (const bad of [[NaN, 10], [10, NaN], [undefined, 10], [10, null]]) {
      expect(catchmentTarget(...bad)).toBeNull();
    }
  });
});

describe('CATCHMENTS data', () => {
  it('has 17 well-formed rings, none crossing the antimeridian', () => {
    expect(CATCHMENTS).toHaveLength(17);
    expect(new Set(CATCHMENTS.map((c) => c.key)).size).toBe(17);
    for (const c of CATCHMENTS) {
      expect(c.ring.length, c.key).toBeGreaterThanOrEqual(3);
      expect(c.sources.ring.startsWith('UNVERIFIED'), c.key).toBe(true);
      for (let p = 0; p < c.ring.length; p++) {
        const [lon, lat] = c.ring[p];
        expect(Number.isFinite(lon) && Number.isFinite(lat), c.key).toBe(true);
        expect(Math.abs(lon) <= 180 && Math.abs(lat) <= 90, c.key).toBe(true);
        const [plon] = c.ring[(p + c.ring.length - 1) % c.ring.length];
        expect(Math.abs(lon - plon), c.key).toBeLessThanOrEqual(180);
      }
    }
  });

  it('routes every catalog river from some ring, and every outfall id resolves', () => {
    const listed = new Set(CATCHMENTS.flatMap((c) => c.outfalls));
    for (const key of Object.keys(CATALOG)) expect(listed.has(`catalog:${key}`), key).toBe(true);
    for (const id of listed) {
      const [kind, key] = id.split(':');
      expect(kind === 'catalog' ? CATALOG[key] : RIVERS[key], id).toBeTruthy();
    }
  });

  it('has no overlapping rings (0.5° lattice over the map)', () => {
    const inRing = (x, y, r) => {
      let c = false;
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xi, yi] = r[i];
        const [xj, yj] = r[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    const overlaps = [];
    for (let x = -179.63; x < 180; x += 0.5) {
      for (let y = -77.63; y < 78; y += 0.5) {
        const hits = CATCHMENTS.filter((c) => inRing(x, y, c.ring));
        if (hits.length > 1) overlaps.push(`${x},${y}: ${hits.map((h) => h.key).join('+')}`);
      }
    }
    expect(overlaps).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/catchments.test.js`
Expected: FAIL, cannot resolve `../catchments`.

- [ ] **Step 3: Write `catchments.js`**

```js
// catchments.js — coarse, hand-authored drainage rings. A verdict or ghost site
// inside a ring drains to that river's outfall instead of the nearest ocean
// cell (the nearest cell ignores divides: Berlin, on the Spree/Havel → Elbe,
// snapped to the Baltic). Rings are planner approximations along major
// divides, not surveyed basin boundaries; where two basins meet they share
// vertices and never overlap (tested). Points outside every ring fall back to
// today's snap. Ray casting is planar in lon/lat; no ring crosses ±180°.

import { CATALOG } from './riverCatalog';
import { RIVERS } from './riverCourses';

const NOTE = 'UNVERIFIED — hand-drawn coarse ring along major drainage divides (planner approximation), not a surveyed basin boundary';

export const CATCHMENTS = [
  {
    key: 'elbe',
    outfalls: ['catalog:elbe'],
    ring: [
      [8.6, 53.95], [10.6, 53.8], [12.3, 53.6], [13.6, 53.2], [14.4, 52], [15.3, 51.2],
      [15.9, 50.3], [17, 49.9], [16.2, 49.2], [14.8, 48.8], [13.4, 48.8], [12.5, 49.7],
      [11.9, 50.2], [11, 50.6], [10.8, 51.6], [10.5, 52.4], [10.3, 53.2], [9.4, 53.6],
    ],
    sources: { ring: NOTE },
  },
  {
    key: 'rhine',
    outfalls: ['preset:germany'],
    ring: [
      [4, 51.95], [5, 52.7], [6.6, 52.9], [7.6, 52.6], [8.3, 52], [9.3, 51],
      [10, 50.5], [10.8, 50.2], [11.6, 49.9], [11.7, 49.3], [10.7, 49.3], [9.9, 48.9],
      [9.3, 48.4], [8.7, 47.8], [9.9, 47.2], [9.4, 46.6], [8.6, 46.4], [7.5, 46.4],
      [7, 46.9], [6.9, 47.6], [6.4, 47.9], [5.7, 48.5], [5.4, 49.4], [5.9, 50],
      [6, 50.7], [5.6, 51.4], [4.6, 51.7],
    ],
    sources: { ring: NOTE },
  },
  {
    key: 'danube',
    outfalls: ['preset:danube'],
    ring: [
      [29.75, 45.2], [28, 43.6], [25, 42.8], [22.8, 42.4], [21.6, 42], [20, 42.6],
      [18.7, 43.3], [17.3, 44], [15.8, 44.7], [14.6, 45.4], [13.9, 45.8], [13, 46.5],
      [11.6, 47], [10.3, 46.7], [9.9, 47.2], [8.7, 47.8], [9.3, 48.4], [9.9, 48.9],
      [10.7, 49.3], [11.7, 49.3], [12.5, 49.7], [13.4, 48.8], [14.8, 48.8], [16.2, 49.2],
      [17, 49.6], [18.6, 49.6], [20.3, 49.4], [22.3, 49.1], [23.4, 48.7], [25, 48.2],
      [26.5, 48.4], [27.8, 48.3], [28.3, 46.5],
    ],
    sources: { ring: NOTE },
  },
  {
    key: 'amazon',
    outfalls: ['catalog:amazon'],
    ring: [
      [-50, 1.5], [-52, 3], [-55, 2.5], [-59, 4], [-62, 4.5], [-64, 2.5],
      [-67, 1.5], [-72, 2], [-75.5, 1.5], [-78, -1], [-79, -5], [-77.5, -10],
      [-75, -14], [-71, -15.5], [-68.5, -18], [-65, -19.5], [-62, -18.5], [-60, -16.5],
      [-58, -15], [-55, -14.5], [-52, -15.5], [-49, -15], [-46.5, -12], [-46, -7],
      [-48, -2], [-49, -1],
    ],
    sources: { ring: NOTE },
  },
  {
    key: 'parana',
    outfalls: ['catalog:parana'],
    ring: [
      [-58.4, -34.6], [-60.6, -33.8], [-62, -31.5], [-64, -27.5], [-65.5, -24], [-65, -22],
      [-65, -19.5], [-62, -18.5], [-60, -16.5], [-58, -15], [-55, -14.5], [-52, -15.5],
      [-49, -15], [-47, -17], [-45.5, -19.5], [-45, -22.5], [-46.5, -24.5], [-48.7, -26],
      [-49.6, -28], [-51, -30], [-53.5, -32], [-55, -34], [-56, -35.1],
    ],
    sources: { ring: NOTE },
  },
  {
    key: 'congo',
    outfalls: ['catalog:congo'],
    ring: [
      [12.4, -5.9], [14, -6.5], [16, -8.5], [16.5, -10.8], [18.5, -12], [21, -13],
      [24, -12.5], [27, -12.3], [29.5, -12.5], [30.8, -10.5], [30.5, -8], [30.8, -6],
      [30.3, -4], [29.6, -2.5], [29.5, -1.5], [29.4, 0.2], [29.8, 1.5], [30.6, 2.6],
      [30.2, 4], [27.5, 4.8], [24.5, 5.2], [22, 5.5], [20, 7], [18, 5.8],
      [16.5, 4.8], [15.3, 3.5], [14.5, 2], [13.9, 0.5], [14.3, -1.8], [15, -3.6],
    ],
    sources: { ring: NOTE },
  },
  {
    key: 'nile',
    outfalls: ['catalog:nile_rosetta', 'catalog:nile_damietta'],
    ring: [
      [29.6, 31], [32.2, 31.2], [32.1, 29.5], [32.8, 27.5], [33.2, 25.5], [33.5, 23],
      [34.5, 21], [35.5, 18], [36.7, 15.5], [38, 14.5], [39.2, 13], [39.6, 11.5],
      [39.2, 10], [37.6, 8.2], [36, 7], [35.2, 5.5], [34.4, 4.2], [34, 2.5],
      [34.5, 1], [35, 0], [34.8, -1.2], [34.3, -2.3], [33, -3.2], [31.6, -3.6],
      [30.3, -4], [29.6, -2.5], [29.5, -1.5], [29.4, 0.2], [29.8, 1.5], [30.6, 2.6],
      [30.2, 4], [27.5, 4.8], [24.5, 5.2], [22, 5.5], [20, 7], [22, 10],
      [24.5, 12], [25, 15], [26.5, 18], [28.5, 22], [29.5, 26], [29, 30],
    ],
    sources: { ring: NOTE },
  },
  {
    key: 'niger',
    outfalls: ['catalog:niger'],
    ring: [
      [5.2, 4.6], [7.6, 4.6], [9, 5], [9.5, 5.8], [11, 6.4], [12.5, 7],
      [13.5, 8.5], [12.8, 10], [11.5, 10.8], [10.5, 12], [9, 12.8], [7, 13.5],
      [5, 15], [2.5, 16.5], [-1, 17], [-4, 17.5], [-6, 16], [-8, 14.8],
      [-10.5, 13.5], [-11.5, 11.5], [-10.5, 9.5], [-8.5, 8.5], [-5.5, 9.5], [-3.5, 11],
      [-1, 12.7], [1, 12], [2, 10], [3, 8.5], [4.3, 7.2],
    ],
    sources: { ring: NOTE },
  },
  {
    key: 'stlawrence',
    outfalls: ['catalog:st_lawrence'],
    ring: [
      [-65, 49], [-67.5, 50.3], [-70.5, 50], [-72.5, 49.6], [-75, 49], [-77.5, 48.2],
      [-79.5, 47.6], [-82, 48.4], [-85.5, 49.4], [-89, 48.9], [-91.5, 48.5], [-92, 46.8],
      [-90.2, 46.4], [-88.6, 45.2], [-88.6, 43.4], [-88.6, 41.6], [-87.6, 40.6], [-85.5, 40.6],
      [-84.7, 40.9], [-82.5, 40.9], [-81, 40.9], [-79.7, 41.8], [-78, 41.7], [-77.8, 41.2],
      [-76, 41.9], [-75.4, 43.5], [-74.4, 44.9], [-72, 45.4], [-70.2, 46.5], [-68.5, 47.5],
      [-67, 48.4],
    ],
    sources: { ring: NOTE },
  },
  {
    key: 'mississippi',
    outfalls: ['preset:usa'],
    ring: [
      [-89.2, 29.2], [-91.6, 29.6], [-93, 30.3], [-94.5, 32.4], [-97.5, 33.5], [-100, 34.3],
      [-103, 34.4], [-105.2, 36], [-106, 38.5], [-107.5, 41], [-110, 43], [-112.5, 44.8],
      [-113.8, 46.3], [-112.5, 48], [-110, 49], [-104, 49], [-100.5, 48.9], [-98.2, 47.2],
      [-96.5, 46], [-94.2, 47.3], [-92, 46.8], [-90.2, 46.4], [-88.6, 45.2], [-88.6, 43.4],
      [-88.6, 41.6], [-87.6, 40.6], [-85.5, 40.6], [-84.7, 40.9], [-82.5, 40.9], [-81, 40.9],
      [-79.7, 41.8], [-78, 41.7], [-77.8, 41.2], [-79.9, 39.5], [-80.3, 38.5], [-80.8, 37.6],
      [-81.6, 36.8], [-82.5, 35.8], [-83.8, 35.2], [-85.2, 34.8], [-87, 34.8], [-88.3, 34.5],
      [-88.5, 33], [-90.2, 32.3], [-90.6, 31],
    ],
    sources: { ring: NOTE },
  },
  {
    key: 'lena',
    outfalls: ['catalog:lena'],
    ring: [
      [124.5, 73.3], [129.5, 73.2], [132, 71.8], [135.5, 69], [140, 66], [140, 63],
      [138, 60], [135, 58], [130.5, 56.5], [125, 55.6], [119, 55.5], [114, 56.3],
      [110.5, 56], [107.5, 55.5], [105, 57], [104, 60], [105.5, 63.5], [108, 66.5],
      [111, 69], [113.5, 71.5], [118, 73],
    ],
    sources: { ring: NOTE },
  },
  {
    key: 'yenisey',
    outfalls: ['catalog:yenisey'],
    ring: [
      [78.5, 72], [83.5, 73.5], [88, 72], [93, 70.5], [100, 68.8], [105.5, 66.5],
      [105.5, 63.5], [104, 60], [105, 57], [107.5, 55.5], [110.5, 56], [113, 53.5],
      [111.5, 50], [110, 48.5], [106, 47.5], [101, 46.5], [97.5, 47.5], [93.5, 49.5],
      [90, 50], [88.5, 52.3], [88.5, 54.5], [88, 56.5], [86.5, 58.5], [85, 61],
      [84, 63], [84.5, 66], [82, 68.5], [79.5, 70.5],
    ],
    sources: { ring: NOTE },
  },
  {
    key: 'yangtze',
    outfalls: ['preset:yangtze'],
    ring: [
      [122, 31.6], [121, 30.7], [119.6, 30.5], [118, 29.5], [117.5, 28.5], [116.2, 25.5],
      [114.5, 25.5], [112.5, 25], [110.5, 26], [108.5, 26.5], [106.5, 26], [104.5, 25.5],
      [103, 24], [101.5, 25.5], [100, 26.5], [99.5, 28.5], [98.8, 31], [96.5, 32.6],
      [93, 33.2], [91.5, 33.8], [94, 34.4], [97.5, 34], [99.5, 33.3], [101, 32.3],
      [102.5, 32.6], [104, 33], [106, 33.5], [107.5, 33.6], [109.5, 33.4], [111.5, 33.4],
      [113, 33.4], [114.5, 32], [115.5, 31], [117, 31.5], [118.5, 32], [119.5, 32.4],
      [121, 32],
    ],
    sources: { ring: NOTE },
  },
  {
    key: 'yellow',
    outfalls: ['catalog:yellow'],
    ring: [
      [119.4, 38], [117.8, 37.6], [116.5, 36.6], [115.5, 35], [114.5, 34.6], [112.5, 34.6],
      [110, 34.3], [108, 34.3], [106.3, 34.4], [104, 34.4], [102.2, 33.8], [100, 33.4],
      [97.5, 34.3], [95.5, 35], [96.5, 36], [100, 36.8], [102, 38], [104.5, 38.5],
      [106, 40], [108, 41.3], [110.5, 41.3], [112.5, 40.6], [112, 39], [112.8, 37.5],
      [113.5, 36.6],
    ],
    sources: { ring: NOTE },
  },
  {
    key: 'mekong',
    outfalls: ['catalog:mekong'],
    ring: [
      [104.6, 8.8], [107.5, 10], [107.6, 11.6], [108.2, 13.5], [107.2, 15.5], [106, 17.5],
      [104.5, 18.8], [103.5, 20], [102.2, 21.5], [101.2, 22.7], [100, 24.5], [99.3, 27],
      [98.7, 29.3], [97.3, 31], [95.8, 32], [95.8, 30.6], [97.5, 28.5], [98.4, 25.5],
      [99.2, 22], [100.2, 20], [100.8, 18.5], [101.2, 17], [101.8, 15], [102.5, 14],
      [103.5, 12.5], [104, 10.5],
    ],
    sources: { ring: NOTE },
  },
  {
    key: 'ganges',
    outfalls: ['preset:ganges'],
    ring: [
      [92.2, 22.2], [89, 21.9], [87.3, 22], [86.5, 22.8], [84, 23.2], [82, 23.5],
      [80, 23.7], [78.5, 24.2], [75.8, 24], [75, 26], [75.8, 28], [76.3, 30],
      [77, 30.3], [78.3, 31.3], [80, 30.9], [81.5, 31.3], [85, 31.2], [88.5, 30.6],
      [90.5, 30.8], [93, 30.3], [95.3, 29.9], [96.5, 29], [97.3, 28.2], [96.5, 27.3],
      [95.5, 26.7], [94.7, 25.5], [93.7, 24], [92.7, 22.8],
    ],
    sources: { ring: NOTE },
  },
  {
    key: 'indus',
    outfalls: ['catalog:indus'],
    ring: [
      [67.3, 24.2], [68.5, 24.6], [70.5, 25.7], [72.5, 27.5], [75, 29], [76.3, 30],
      [77, 30.3], [78.3, 31.3], [80, 30.9], [81.5, 31.3], [80, 33.5], [78, 35.8],
      [75.5, 37], [72.5, 37], [71, 36.6], [69, 35.6], [68.5, 34], [68, 32.5],
      [66.8, 31], [66.3, 29.5], [66.3, 27.5], [66, 25.7],
    ],
    sources: { ring: NOTE },
  },
];

function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// 'catalog:<key>' → CATALOG outfall; 'preset:<key>' → the last point of the
// preset's RIVERS course (its mouth).
function outfallOf(id) {
  const [kind, key] = id.split(':');
  return kind === 'catalog' ? CATALOG[key].outfall : RIVERS[key].course.at(-1);
}

// The river a site drains to: { key (ring), sourceId, outfall: [lon, lat] },
// or null outside every ring. A ring with two mouths (the Nile) returns the
// nearer one (planar lon/lat distance; the mouths are 1.4° apart).
export function catchmentTarget(lon, lat) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  const c = CATCHMENTS.find((r) => inRing(lon, lat, r.ring));
  if (!c) return null;
  let best = null;
  for (const sourceId of c.outfalls) {
    const outfall = outfallOf(sourceId);
    const d = Math.hypot((outfall[0] - lon) * Math.cos((lat * Math.PI) / 180), outfall[1] - lat);
    if (!best || d < best.d) best = { d, sourceId, outfall };
  }
  return { key: c.key, sourceId: best.sourceId, outfall: best.outfall };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/catchments.test.js`
Expected: PASS (all route, outside, structure and overlap tests). If a route or overlap test fails, the ring text was mistyped: recopy that ring from this plan; do not retune geometry.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/ledger/ocean/catchments.js src/terminal/ledger/ocean/__tests__/catchments.test.js
git commit -m "feat(ledger): hand-authored catchment rings and catchmentTarget"
```

---

### Task 3: Route verdict and ghost sites through their catchment

**Files:**
- Modify: `src/terminal/ledger/ocean/sources.js` (`buildSource`, `formSpec`, imports, one new constant)
- Modify: `src/terminal/ledger/ocean/__tests__/sources.test.js` (the Linz straight-line test at line 75–89; add a describe)

**Interfaces:**
- Consumes: `catchmentTarget(lon, lat)` (Task 2).
- Produces: spec field `snapAt: [lon, lat] | null` on verdict and ghost specs; `buildSource` snaps to `snapAt` first (radius `CATCHMENT_SNAP_RADIUS_CELLS = 8`), else to the course end as before.

- [ ] **Step 1: Write the failing tests**

In `sources.test.js`, add `snapToOcean` is already imported. Add `haversineKm` is already imported. Append this describe at the end of the file:

```js
describe('catchment routing of verdict and ghost sites', () => {
  const at = (lat, lon) => verdictSourceSpec({ hash: 'c', coordinates: { lat, lon }, input: { ...kernel } });
  const built = (lat, lon) => buildSource(at(lat, lon), grid, mask);
  const kmTo = (s, [lon, lat]) => haversineKm([s.snap.lon, s.snap.lat], [lon, lat]);

  it('drains Berlin to the Elbe mouth in the North Sea, not the Baltic', () => {
    const s = built(52.52, 13.405);
    expect(kmTo(s, [8.7, 53.86])).toBeLessThan(150);
    expect(s.snap.lon).toBeLessThan(10);
  });

  it('drains Manaus to the Amazon mouth, not the Guiana coast', () => {
    const s = built(-3.119, -60.0217);
    expect(kmTo(s, [-50.0, 0.0])).toBeLessThan(150);
  });

  it('drains Kinshasa to the Congo mouth', () => {
    expect(kmTo(built(-4.32, 15.3), [12.35, -6.07])).toBeLessThan(150);
  });

  it('drains Linz down the Danube to the Black Sea (preset basin)', () => {
    const s = built(48.31, 14.29);
    expect(s.snap.lon).toBeGreaterThan(28);
    expect(s.lengthKm).toBeGreaterThan(1000);
  });

  it('falls back to the nearest-ocean snap outside every catchment', () => {
    const spec = at(52.23, 21.0);            // Warsaw: Vistula, in no ring
    expect(spec.snapAt).toBeNull();
    const s = buildSource(spec, grid, mask);
    expect(s.snap.lat).toBeGreaterThan(53);  // Baltic coast
  });

  it('falls back to the nearest-ocean snap when the catchment outfall cannot snap', () => {
    const landlocked = { ...at(52.52, 13.405), snapAt: [100, 45] };   // Mongolia: no ocean within 8 cells
    const s = buildSource(landlocked, grid, mask);
    expect(s).not.toBeNull();
    expect(s.snap.lat).toBeGreaterThan(53);                  // Berlin's own nearest-ocean snap (Baltic)
  });

  it('routes the ghost the same way', () => {
    const spec = ghostSourceSpec({ lat: '52.52', lon: '13.405', temp: '12', do: '9.5', bod: '6', dt: '3.5', nitrate: '18', epi: '2', flow: '42' });
    expect(spec.snapAt).toEqual([8.7, 53.86]);
  });

  it('carries no snapAt for a blank or non-numeric ghost', () => {
    const spec = ghostSourceSpec({ lat: '', lon: '13.4', temp: '12', do: '9.5', bod: '6', dt: '3.5', nitrate: '18', epi: '2', flow: '42' });
    expect(spec.snapAt).toBeNull();
  });
});
```

Then change the existing straight-line verdict test (`it('drains a verdict in a straight line to its snapped ocean cell, Q = submitted flow'`, currently using the file-level `verdict` const at Linz 48.31, 14.29, which now sits in the Danube ring). Replace the `verdict` const line:

```js
  const verdict = { hash: 'abc', coordinates: { lat: 48.31, lon: 14.29 }, input: { ...kernel } };
```

with:

```js
  // Warsaw: in no catchment ring, so this stays the nearest-ocean straight line.
  const verdict = { hash: 'abc', coordinates: { lat: 52.23, lon: 21.0 }, input: { ...kernel } };
```

(The test's 150–900 km bounds still hold: Warsaw to the Gulf of Gdańsk is about 300 km. The two ghost tests that use Linz only assert non-null and finite values and stay as they are.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/sources.test.js`
Expected: the new `catchment routing` tests FAIL (`snapAt` undefined, Berlin snaps to the Baltic); existing tests otherwise PASS.

- [ ] **Step 3: Implement**

In `sources.js` add to the imports:

```js
import { catchmentTarget } from './catchments';
```

Add below `USER_SNAP_RADIUS_CELLS`:

```js
// A catchment outfall is a mapped river mouth, not user input: it must sit in
// reach of the ocean the way a preset mouth does (snapRadius 8).
export const CATCHMENT_SNAP_RADIUS_CELLS = 8;
```

In `buildSource`, the destructure gains `snapAt = null`:

```js
  const {
    id, kind, course, dischargeM3s, velocityMs, depthM,
    snapRadius = USER_SNAP_RADIUS_CELLS, riverKm = null, snapAt = null,
  } = spec;
```

Replace these two lines:

```js
  const end = course[course.length - 1];
  const snap = snapToOcean(grid, mask.land, end[0], end[1], snapRadius, snapFilter(mask));
  if (!snap) return null;
```

with:

```js
  const end = course[course.length - 1];
  const filter = snapFilter(mask);
  // A site inside a catchment drains to its river's outfall; if that cell has
  // no ocean in reach (or there is no catchment) the nearest-ocean snap stands.
  const viaCatchment = Array.isArray(snapAt) && snapAt.every(finite)
    ? snapToOcean(grid, mask.land, snapAt[0], snapAt[1], CATCHMENT_SNAP_RADIUS_CELLS, filter)
    : null;
  const snap = viaCatchment ?? snapToOcean(grid, mask.land, end[0], end[1], snapRadius, filter);
  if (!snap) return null;
```

In `formSpec`, compute the target and add `snapAt`:

```js
function formSpec(id, kind, lon, lat, params) {
  const target = catchmentTarget(num(lon), num(lat));
  return {
    id, kind,
    kernel: params,
    course: [[num(lon), num(lat)]],
    dischargeM3s: num(params.flow),
    velocityMs: USER_VELOCITY_MS,
    depthM: Math.max(0.5, num(params.epi)),
    snapAt: target ? target.outfall : null,
  };
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/sources.test.js src/terminal/ledger/ocean/__tests__/riverCourses.test.js src/terminal/ledger/ocean/__tests__/catchments.test.js src/terminal/ledger/ocean/__tests__/riverCatalog.test.js`
Expected: all PASS, including the untouched lagoon tests (Suez, Arkhangelsk, Baku, Odesa, Jeddah are outside every ring) and "leaves every preset snap exactly where the unfiltered snap put it".

- [ ] **Step 5: Commit**

```bash
git add src/terminal/ledger/ocean/sources.js src/terminal/ledger/ocean/__tests__/sources.test.js
git commit -m "feat(ledger): verdict and ghost sites drain to their catchment's outfall"
```

---

### Task 4: Put the catalog in the world and the HUD

**Files:**
- Modify: `src/terminal/ledger/ocean/oceanWorld.js` (import and call)
- Modify: `src/terminal/ledger/ocean/gpu/parityProbe.js:8,105,108` (use `oceanSources`, name)
- Modify: `src/terminal/ledger/ocean/riverStage.js` (`prepareRiver` skips catalog)
- Modify: `src/terminal/views/ledger/ocean/hudFormat.js` (import, `describeSites` branch, `tooltipLines`)
- Modify: `src/terminal/views/ledger/ocean/OceanHud.jsx:266` (ring opacity)
- Test: `src/terminal/ledger/ocean/__tests__/riverStageCatalog.test.js`, `src/terminal/views/ledger/ocean/__tests__/hudFormatCatalog.test.js`

**Interfaces:**
- Consumes: `oceanSources`, `CATALOG`.
- Produces: the world's `sources` = 22 (9 presets, 13 catalog); HUD sites of `kind: 'catalog'`: `name` = `CATALOG[key].label`, `snapKm` = great-circle distance from the outfall to the snapped cell, colour `PRESET_COLOR`, tooltip label `AMBIENT RIVER`.

- [ ] **Step 1: Write the failing tests**

Create `src/terminal/ledger/ocean/__tests__/riverStageCatalog.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { OCEAN_GRID } from '../grid';
import { buildLandMask } from '../landMask';
import { oceanSources } from '../sources';
import { prepareRiver } from '../riverStage';

const grid = OCEAN_GRID;
const mask = buildLandMask(grid);

describe('river stage and the catalog', () => {
  it('draws no river-stage particles for a mouth-only catalog source', () => {
    const catalog = oceanSources(grid, mask).filter((s) => s.kind === 'catalog');
    expect(catalog).toHaveLength(13);
    for (const s of catalog) expect(prepareRiver(s), s.id).toBeNull();
  });

  it('still prepares every preset river', () => {
    const presets = oceanSources(grid, mask).filter((s) => s.kind === 'preset');
    expect(presets).toHaveLength(9);
    expect(presets.filter((s) => prepareRiver(s) !== null).length).toBeGreaterThan(0);
  });
});
```

Create `src/terminal/views/ledger/ocean/__tests__/hudFormatCatalog.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { OCEAN_GRID } from '../../../../ledger/ocean/grid';
import { buildLandMask } from '../../../../ledger/ocean/landMask';
import { oceanSources } from '../../../../ledger/ocean/sources';
import { describeSites, tooltipLines } from '../hudFormat';

const grid = OCEAN_GRID;
const mask = buildLandMask(grid);

describe('describeSites for catalog sources', () => {
  const sites = describeSites(oceanSources(grid, mask));
  const amazon = sites.find((s) => s.id === 'catalog:amazon');

  it('names the river and measures outfall → snapped cell', () => {
    expect(amazon.kind).toBe('catalog');
    expect(amazon.name).toBe('AMAZON');
    expect(amazon.status).toBeNull();
    expect(amazon.snapKm).toBeGreaterThanOrEqual(0);
    expect(amazon.snapKm).toBeLessThan(100);
  });

  it('labels the tooltip an ambient river with its discharge', () => {
    const lines = tooltipLines(amazon);
    expect(lines[0]).toBe('AMAZON');
    expect(lines[1]).toBe('AMBIENT RIVER');
    expect(lines[2]).toBe('Q 209,000 m³/s');
  });

  it('describes all 22 ambient sources', () => {
    expect(sites).toHaveLength(22);
    expect(sites.filter((s) => s.kind === 'catalog')).toHaveLength(13);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/riverStageCatalog.test.js src/terminal/views/ledger/ocean/__tests__/hudFormatCatalog.test.js`
Expected: FAIL (`prepareRiver` returns non-null for catalog; `describeSites` mis-labels catalog as a verdict named USER SITE).

- [ ] **Step 3: Implement**

`oceanWorld.js`: change `import { ambientSources } from './sources';` to `import { oceanSources } from './sources';`, change `const sources = ambientSources(grid, mask);` to `const sources = oceanSources(grid, mask);`, and update the header comment's "ambient preset sources" to "ambient preset and catalog sources".

`gpu/parityProbe.js`: change `import { ambientSources } from '../sources';` to `import { oceanSources } from '../sources';`, `const sources = ambientSources(grid, mask);` to `const sources = oceanSources(grid, mask);`, and `name: 'real 512x256, nine preset sources'` to `name: 'real 512x256, nine preset + thirteen catalog sources'`. Before editing run `grep -rn "nine preset sources" src` and update any test that matches that string.

`riverStage.js`, first line of `prepareRiver`:

```js
export function prepareRiver(src, { alpha = 1 } = {}) {
  if (src.kind === 'catalog') return null; // mouth-only: the plume is the whole picture
  if (!(src.travelDays > 0) || !(src.courseKm > 0)) return null;
```

`hudFormat.js`: add the import under the existing `RIVERS` import:

```js
import { CATALOG } from '../../../ledger/ocean/riverCatalog';
```

In `describeSites`, insert directly before the `if (s.kind === 'ghost')` branch:

```js
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
```

In `tooltipLines`, replace the two label lines:

```js
    site.kind === 'preset' ? 'AMBIENT PRESET' : site.kind === 'ghost' ? GHOST_LABEL : statusLabel(site.status),
    site.kind === 'preset' ? q : `${q} · ${pct}% OF MISSISSIPPI`,
```

with:

```js
    site.kind === 'preset' ? 'AMBIENT PRESET' : site.kind === 'catalog' ? 'AMBIENT RIVER'
      : site.kind === 'ghost' ? GHOST_LABEL : statusLabel(site.status),
    site.kind === 'preset' || site.kind === 'catalog' ? q : `${q} · ${pct}% OF MISSISSIPPI`,
```

`OceanHud.jsx:266`: change `opacity: s.kind === 'preset' ? 0.6 : 0.95,` to `opacity: s.kind === 'preset' || s.kind === 'catalog' ? 0.6 : 0.95,`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/terminal/ledger/ocean src/terminal/views/ledger/ocean`
Expected: the two new files PASS. Note the failures of any existing ocean/HUD tests that assert a count of nine sources or a Shanghai/Wuhan snap position; triage them in Task 5, do not fix them here.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/ledger/ocean/oceanWorld.js src/terminal/ledger/ocean/gpu/parityProbe.js src/terminal/ledger/ocean/riverStage.js src/terminal/views/ledger/ocean/hudFormat.js src/terminal/views/ledger/ocean/OceanHud.jsx src/terminal/ledger/ocean/__tests__/riverStageCatalog.test.js src/terminal/views/ledger/ocean/__tests__/hudFormatCatalog.test.js
git commit -m "feat(ledger): draw the catalog in the ocean world and HUD"
```

---

### Task 5: Full-suite triage, lint, frozen-preset proof, live check

**Files:**
- Modify (only if the triage below finds them): existing ledger/ocean tests whose site lies inside a catchment ring, or that count sources
- Modify: `docs/superpowers/specs/2026-09-30-ledger-river-catalog-catchments-design.md` (sync §3/§4 with what was built)

**Interfaces:** none new.

- [ ] **Step 1: Run the whole ledger surface**

Run: `npx vitest run src/terminal/ledger src/terminal/views/ledger`
Expected: PASS. If anything fails, classify each failure by cause before touching it:

1. **A test asserts nine sources / `ambientSources`-based count in the world or GPU pack** (for example a `toHaveLength(9)` on `world.sources` or the packed source texture): the world now has 22. Update the number to 22 and the comment to say "nine presets + thirteen catalog". `riverCourses.test.js` must NOT need a change (it uses `ambientSources`).
2. **A test places a verdict/ghost inside a ring and asserts a nearest-ocean snap position or SNAP km** (the Shanghai site 31.3°N 120.6°E and the Wuhan ghost 30.59°N 114.3°E lie in the Yangtze ring; Hong Kong 22.3°N 113.9°E is outside every ring): the site now drains to the Yangtze outfall. Fix by moving the test's site to a location outside every ring that keeps the test's purpose, or by asserting the new outfall snap. Either is fine; do not change `catchmentTarget` or the rings to make a test pass. State each such change in the commit message.
3. Any other failure: stop and report it; it is a real regression.

- [ ] **Step 2: Run the entire suite and lint**

Run: `npx vitest run`
Expected: PASS.

Run: `npm run lint`
Expected: 0 errors, and the warning count no higher than the ratchet in `package.json` (`--max-warnings 143`). Do not sweep unrelated warnings.

- [ ] **Step 3: Prove the presets and Mercury are frozen**

Run:

```bash
git diff --stat feature/ledger-advection -- src/terminal/ledger/auditPresets.js src/terminal/ledger/ocean/riverCourses.js
```

Expected: no output (both files identical to the branch base).

- [ ] **Step 4: Look at the live ocean before claiming it works**

Start the dev server with the repo's existing `preview_start` configuration (check `.claude/launch.json` for the name), open the `/LEDGER` ocean view, and take a screenshot with the ocean warmed up. Check, by looking, not by metric:

1. Plumes now sit off the Amazon, Congo, Niger, Nile, Saint Lawrence, Lena and Yenisey mouths, the Río de la Plata, Mekong, Indus and Bohai; Africa, the Arctic shelf and the north Atlantic are no longer dark.
2. The Amazon plume reads as the dominant Atlantic plume and does not white-out the colour scale. If it saturates, report it: the spec's remedy is a display-side clamp, NOT a change to its 209,000 m³/s.
3. The catalog rings are visible but subordinate (teal, 0.6 opacity), and hovering one shows `AMBIENT RIVER` with its Q.
4. Submit or ghost Berlin (52.52, 13.405): the line runs to the North Sea off Cuxhaven, not the Baltic. Ghost Manaus (-3.119, -60.0217): the line runs to the Amazon mouth.

Do not edit any file to make a screenshot look better in this step; report what is seen.

- [ ] **Step 5: Sync the spec with what was built**

In `docs/superpowers/specs/2026-09-30-ledger-river-catalog-catchments-design.md`:
- §3 "Edits" and §4 "ambientSources returns the 9 presets first…": replace with "`ambientSources` still returns exactly the 9 presets (a test pins it); the new `oceanSources` returns those 9 first, then the 13 catalog sources, and is what the world and the GPU parity probe use."
- §5 "Verdict and ghost sources": add "The target is carried as `snapAt` on the spec; `buildSource` snaps to it at radius 8 (`CATCHMENT_SNAP_RADIUS_CELLS`) and otherwise snaps the course end as before."
- §5 scope decision: replace the recommendation paragraph with "Included: rings for the Rhine, Danube, Mississippi, Yangtze and Ganges–Brahmaputra, routed to the existing preset outfalls (`preset:germany`, `preset:danube`, `preset:usa`, `preset:yangtze`, `preset:ganges`)."
- Add under §8: "Catalog sources also get a HUD ring and tooltip (`AMBIENT RIVER`), styled like presets at 0.6 opacity; `prepareRiver` skips `kind: 'catalog'`."
- §7 test list: change "22 sources (9 + 13)" wording is already correct; no edit.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-09-30-ledger-river-catalog-catchments-design.md
git add -u src/terminal/ledger src/terminal/views/ledger
git commit -m "test(ledger): triage for the catalog and catchment routing; spec sync"
```

(Only files under those two source directories that Steps 1–2 changed are staged by `git add -u`; confirm with `git status --short` first that no unrelated modified file, such as `.import-cache.json` or the council-field snapshot, is staged.)

- [ ] **Step 7: Report**

State plainly: tests and lint results (with counts), the frozen-preset diff result, what the screenshots showed including the Amazon saturation verdict, and any test whose site was moved and why. Do not push.

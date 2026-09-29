# Ledger Ocean — Phase 2 (GL Ocean) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the phase-1 ocean on the GPU (WebGL2 ping-pong passes that match the CPU oracle), render it through the spec's composite, drive it with the five existing audit presets as ambient sources, and put it in front of the user's eye on a dev preview page — without touching the live Ledger tab.

**Architecture:** Pure data (river courses, GPU packing) and GLSL strings live under `src/terminal/ledger/ocean/`; the GPU runner `gpu/oceanGpu.js` is plain WebGL2 with no React so the parity probe can drive it directly. `src/terminal/gl/pingPong.js` extends the shared harness with float render targets. The React view `src/terminal/views/ledger/ocean/LedgerOcean.jsx` hosts the composite on `useShaderCanvas` (strategy `'lunar'`, WebGL2) and runs the sim inside `onInit`/`draw`. Verification: jsdom tests with the recording GL stub for structure, a headless-Chrome GPU-vs-CPU parity probe for maths, and CDP screenshots for the user's visual review.

**Tech Stack:** WebGL2 / GLSL ES 3.00, React 18, vitest 4 + jsdom, the repo's `scripts/cdp.mjs` headless-Chrome driver (`--enable-unsafe-swiftshader`), Vite 8's programmatic `createServer`.

**Spec:** `docs/superpowers/specs/2026-09-29-ledger-ocean-advection-design.md` — especially "GPU contract", "Courant hotspots", "Fallbacks", "Phase-1 carry-overs". Phase 1 core: `src/terminal/ledger/ocean/*` (grid, clock, kinetics, landMask, streamFunction, referenceStep, sources).

## Plan decisions that refine the spec (flag to the user at hand-off)

1. **Float targets only.** No half-float path: phase-1 review measured user-plume increments below the half-float ulp and nitrate decay quantised ±10%. Without `EXT_color_buffer_float` the view falls back to static.
2. **Static fallback draws no plume.** It shows land/coast and `STATIC · NO FLOAT TARGETS`. The CPU oracle costs 46 ms/step, so computing a still frame at mount is not feasible; revisit only if real visitors hit this path.
3. **Sim shaders and the GPU runner live in `src/terminal/ledger/ocean/gpu/`**, not `views/…/shaders/`: they are React-free and the parity probe imports them.
4. **River data lives in `src/terminal/ledger/ocean/riverCourses.js` keyed by preset key**; `auditPresets.js` and its test stay byte-identical.
5. **`useOceanClock` becomes `oceanDriver.js`**, a pure factory (testable without React).
6. **Review surface is a dev-only page** `ledger-ocean-preview.html` (same pattern as the existing root-level `elemental-mirror-probe.html`); Vite's production build only bundles `index.html`, so neither probe page ships.

## Global Constraints

- The live Ledger tab does not change in phase 2: `src/terminal/views/LedgerTab.jsx` and everything under `src/terminal/views/ledger/` except the new `ocean/` folder stay untouched. `auditPresets.js` stays byte-identical.
- The sim never writes to the ledger: nothing new imports `verdictStore` or `ledgerBus`.
- GPU contract (spec, verbatim intent): state RGBA float per cell `[ΔT, BOD, NO₃, D]`, row 0 = south, x wraps, y clamps; velocity km/day at cell centres; back-trace `x − u·Δt/(cellKm·cos φ_dest)`, `y − v·Δt/cellKm`; manual 4-tap bilinear over **ocean texels only** (renormalised; all-land keeps own value); limiter = min/max over the same four ocean texels of the **original** state; diffusion x-term `(E+W−2C)/Δx²`, y-term `(cos_N(N−C) − cos_S(C−S))/(cos_j·Δy²)`; exact reaction with per-row `kd, ka, DO_sat`, no cap inside reaction; sources = CPU-built per-cell `Σ conc·f` texture added as `src·Δt`; guard (NaN/∞→0, ≥0, land=0, deficit ≤ DO_sat) after advect, after diffuse (applied on read by the react pass), after react+inject.
- All float textures are sampled with `texelFetch` and `NEAREST` filtering — never hardware linear filtering.
- Nothing is frame-counted; simulated time comes from `createStepClock` (wall ms × days/s).
- Existing GL call-log snapshots (`src/terminal/gl/__tests__/__snapshots__/`) must stay byte-identical: harness changes are additive. Never run `vitest -u`.
- **Mutation rule:** every test (and the parity gate) must be shown to FAIL against a deliberate break, then reverted exactly.
- Hard rule for implementers: never loosen an assertion, tolerance or threshold to get green. Measure, report BLOCKED, let the controller decide.
- Known unrelated failure: `src/terminal/art/__tests__/artComposite.test.js` (stale since main `5d222a4c`; being fixed in a separate session). Ignore it in full-suite runs.
- Test commands: single file `npx vitest run <path>`; suite `npm test`; lint `npm run lint` (0 errors, warnings ≤ 143). Shell is Git Bash.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage only the task's files. Do not push.

## File Structure

| File | Responsibility |
|---|---|
| `src/terminal/ledger/ocean/riverCourses.js` (new) | `RIVERS` keyed by preset key: course, discharge, Manning, source notes |
| `src/terminal/ledger/ocean/sources.js` (modify) | add `presetSourceSpec`, `ambientSources` |
| `src/terminal/ledger/ocean/referenceStep.js` (modify) | extract `rowConstants`, `diffusionSchedule` (behaviour unchanged) |
| `src/terminal/ledger/ocean/gpu/gpuData.js` (new) | pack static / rows / sources into RGBA float arrays |
| `src/terminal/gl/pingPong.js` (new) | float texture/target/ping-pong/readback helpers |
| `src/terminal/gl/__tests__/recordingGL.js` (modify, additive) | `RGBA32F` constant, `readPixels` method |
| `src/terminal/ledger/ocean/gpu/shaders.js` (new) | GLSL: shared header, 5 sim programs, composite |
| `scripts/oceanShaders.mjs` (new) | compile/link every program in headless Chrome |
| `src/terminal/ledger/ocean/gpu/oceanGpu.js` (new) | GPU runner: textures, programs, `step`, readback |
| `src/terminal/ledger/ocean/gpu/parityProbe.js` (new) | in-browser CPU-vs-GPU comparison |
| `ledger-ocean-probe.html` (new, root) | dev page hosting the parity probe |
| `scripts/oceanParity.mjs` (new) | starts Vite, runs the probe in headless Chrome, exits 0/1 |
| `src/terminal/ledger/ocean/gpu/palette.js` (new) | composite exposure constants (tuned by eye in Task 8) |
| `src/terminal/ledger/ocean/oceanWorld.js` (new) | memoised grid/mask/currents/packed data/ambient sources |
| `src/terminal/ledger/ocean/clock.js` (modify) | validate `setMaxSteps` |
| `src/terminal/views/ledger/ocean/oceanDriver.js` (new) | clock → sim steps, reduced-motion warm-up, sim-day counter |
| `src/terminal/views/ledger/ocean/LedgerOcean.jsx` (new) | the React view |
| `src/terminal/views/ledger/ocean/previewMain.jsx` + `ledger-ocean-preview.html` (new) | dev preview page |
| `scripts/oceanShots.mjs` (new) | CDP screenshots for the visual review |

---

### Task 1: River data for the five presets

**Files:**
- Create: `src/terminal/ledger/ocean/riverCourses.js`
- Modify: `src/terminal/ledger/ocean/sources.js` (append two exports + one import block)
- Test: `src/terminal/ledger/ocean/__tests__/riverCourses.test.js`

**Interfaces:**
- Consumes: `AUDIT_PRESETS` (`src/terminal/ledger/auditPresets.js`: objects `{ key, lat, lon, temp, do, bod, dt, epi, nitrate, flow, … }`); `buildSource(spec, grid, mask)`; `manningVelocity({ n, R, S })`.
- Produces:
  - `RIVERS: { [presetKey]: { course: [[lon, lat], …], dischargeM3s: number, manning: { n, R, S }, sources: { course: string, dischargeM3s: string, manning: string } } }`
  - `presetSourceSpec(preset, river = RIVERS[preset.key])` → spec `{ id: 'preset:<key>', kind: 'preset', kernel: preset, course, dischargeM3s, velocityMs: manningVelocity(manning), depthM: manning.R, snapRadius: 8 }`
  - `ambientSources(grid, mask)` → array of built sources, one per preset that has a `RIVERS` entry and reaches ocean.

- [ ] **Step 1: Write the failing test**

`src/terminal/ledger/ocean/__tests__/riverCourses.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { AUDIT_PRESETS } from '../../auditPresets';
import { RIVERS } from '../riverCourses';
import { OCEAN_GRID } from '../grid';
import { buildLandMask } from '../landMask';
import { manningVelocity } from '../kinetics';
import { presetSourceSpec, buildSource, ambientSources } from '../sources';

const grid = OCEAN_GRID;
const mask = buildLandMask(grid);
const hasNote = (s) => typeof s === 'string' && s.trim().length >= 12;
const PRESETS = AUDIT_PRESETS.map((p) => [p.key, p]);

describe('RIVERS', () => {
  it('covers exactly the audit presets', () => {
    expect(Object.keys(RIVERS).sort()).toEqual(AUDIT_PRESETS.map((p) => p.key).sort());
  });

  it.each(PRESETS)('%s starts at the audit site', (key, p) => {
    expect(RIVERS[key].course[0]).toEqual([p.lon, p.lat]);
    expect(RIVERS[key].course.length).toBeGreaterThanOrEqual(2);
  });

  it('carries a source note or UNVERIFIED for every numeric field', () => {
    for (const r of Object.values(RIVERS)) {
      expect(hasNote(r.sources.course)).toBe(true);
      expect(hasNote(r.sources.dischargeM3s)).toBe(true);
      expect(hasNote(r.sources.manning)).toBe(true);
      expect(Number.isFinite(r.dischargeM3s) && r.dischargeM3s > 0).toBe(true);
    }
  });

  it('flags Hamhung as unverified', () => {
    expect(RIVERS.north_korea.sources.course.startsWith('UNVERIFIED')).toBe(true);
    expect(RIVERS.north_korea.sources.dischargeM3s.startsWith('UNVERIFIED')).toBe(true);
  });

  it('gives plausible Manning velocities', () => {
    for (const r of Object.values(RIVERS)) {
      const v = manningVelocity(r.manning);
      expect(v).toBeGreaterThan(0.3);
      expect(v).toBeLessThan(2.5);
    }
  });
});

describe('preset sources', () => {
  it.each(PRESETS)('%s drains to ocean within 3 cells', (_key, p) => {
    const s = buildSource(presetSourceSpec(p), grid, mask);
    expect(s).not.toBeNull();
    expect(s.kind).toBe('preset');
    expect(s.snap.distCells).toBeLessThanOrEqual(3);
  });

  it('uses the Manning velocity and hydraulic radius', () => {
    const p = AUDIT_PRESETS.find((x) => x.key === 'usa');
    const spec = presetSourceSpec(p);
    expect(spec.id).toBe('preset:usa');
    expect(spec.velocityMs).toBeCloseTo(manningVelocity(RIVERS.usa.manning), 12);
    expect(spec.depthM).toBe(RIVERS.usa.manning.R);
    expect(spec.dischargeM3s).toBe(16570);
  });

  it('builds all five ambient sources', () => {
    expect(ambientSources(grid, mask).map((s) => s.id).sort())
      .toEqual(AUDIT_PRESETS.map((p) => `preset:${p.key}`).sort());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/riverCourses.test.js`
Expected: FAIL — cannot resolve `../riverCourses`.

- [ ] **Step 3: Create `riverCourses.js`**

```js
// riverCourses.js — river stage data for the audit presets: course from the
// audit site to the mouth, mean discharge at the mouth, and reach-averaged
// Manning parameters. Keyed by AUDIT_PRESETS key; auditPresets.js itself is
// untouched. Every number carries a source note or the literal UNVERIFIED.
// Courses are city/landmark waypoints, not surveyed thalwegs.

export const RIVERS = {
  mercury: {
    course: [[20.0088, 39.9269], [20.0311, 39.8439]],
    dischargeM3s: 50,
    manning: { n: 0.035, R: 1.5, S: 0.001 },
    sources: {
      course: 'Blue Eye spring → Bistricë mouth 39°50′38″N 20°1′52″E (Wikipedia, "Bistrica (Ionian Sea)"); straight site→mouth approximation, not traced',
      dischargeM3s: 'Bistricë 40.4–66.4 m³/s seasonal (Wikipedia); 50 used as a representative mean',
      manning: 'UNVERIFIED — assumed small spring-fed river values (n 0.035, R 1.5 m, S 1e-3)',
    },
  },
  germany: {
    course: [
      [6.9603, 50.9375], [6.7735, 51.2277], [6.7623, 51.4344], [6.6178, 51.6587],
      [6.2458, 51.8318], [5.8625, 51.8475], [5.4292, 51.8867], [4.9742, 51.8306],
      [4.6901, 51.8133], [4.4792, 51.9225], [4.1333, 51.9775],
    ],
    dischargeM3s: 2290,
    manning: { n: 0.03, R: 5, S: 0.0001 },
    sources: {
      course: 'Cologne → Düsseldorf → Duisburg → Wesel → Emmerich → Nijmegen (Waal) → Tiel → Gorinchem → Dordrecht → Rotterdam → Hook of Holland; city coordinates',
      dischargeM3s: 'Rhine annual mean 2,290 m³/s approaching the Dutch border (Wikipedia, "Rhine"); delta distributary split ignored',
      manning: 'UNVERIFIED — assumed large regulated river values (n 0.03, R 5 m, S 1e-4)',
    },
  },
  usa: {
    course: [
      [-90.0715, 29.9511], [-89.9906, 29.8547], [-89.8006, 29.5783],
      [-89.6937, 29.4805], [-89.3542, 29.2766], [-89.25, 29.15],
    ],
    dischargeM3s: 16570,
    manning: { n: 0.025, R: 15, S: 0.00002 },
    sources: {
      course: 'New Orleans → Belle Chasse → Pointe à la Hache → Port Sulphur → Venice → Head of Passes; town coordinates',
      dischargeM3s: 'Mississippi at Baton Rouge 16,570 m³/s, 2004–2022 (Wikipedia, "Mississippi River"); main stem after the Atchafalaya diversion',
      manning: 'UNVERIFIED — assumed lower-Mississippi values (n 0.025, R 15 m, S 2e-5)',
    },
  },
  brazil: {
    course: [[-39.74, -19.78], [-39.8147, -19.6558]],
    dischargeM3s: 793.7,
    manning: { n: 0.03, R: 3, S: 0.0002 },
    sources: {
      course: 'Regência audit site → Rio Doce mouth 19°39′21″S 39°48′53″W (Wikipedia, "Doce River"); straight approximation',
      dischargeM3s: 'Rio Doce basin mean 793.7 m³/s (Atlas Digital das Águas de Minas, UFV)',
      manning: 'UNVERIFIED — assumed sandy estuarine reach values (n 0.03, R 3 m, S 2e-4)',
    },
  },
  north_korea: {
    course: [[127.535, 39.9186], [127.6, 39.8]],
    dischargeM3s: 100,
    manning: { n: 0.035, R: 2, S: 0.0005 },
    sources: {
      course: 'UNVERIFIED — Hamhung → Songchon delta near Hungnam, approximate; no public survey',
      dischargeM3s: 'UNVERIFIED — no public discharge data for the Songchon; order-of-magnitude assumption',
      manning: 'UNVERIFIED — assumed short industrial river values (n 0.035, R 2 m, S 5e-4)',
    },
  },
};
```

- [ ] **Step 4: Append to `sources.js`**

Add to the import block at the top of `sources.js`:

```js
import { AUDIT_PRESETS } from '../auditPresets';
import { RIVERS } from './riverCourses';
```

and extend the existing kinetics import to include `manningVelocity`. Append at the end of the file:

```js
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/riverCourses.test.js src/terminal/ledger/ocean/__tests__/sources.test.js src/terminal/ledger/__tests__/auditPresets.test.js`
Expected: PASS. If a preset fails "drains to ocean within 3 cells", report the preset, its last vertex, and the snap result; do not move coordinates yourself.

- [ ] **Step 6: Mutation checks**

1. Swap lon/lat in the `usa` course's first vertex. "usa starts at the audit site" must FAIL. Revert.
2. Change `mercury`'s last vertex to Linz `[14.29, 48.31]`. "mercury drains to ocean within 3 cells" must FAIL. Revert.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/ledger/ocean/riverCourses.js src/terminal/ledger/ocean/sources.js src/terminal/ledger/ocean/__tests__/riverCourses.test.js
git commit -m "feat(ledger-ocean): river courses, discharge and Manning data for the five presets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Oracle helpers and GPU data packing

**Files:**
- Modify: `src/terminal/ledger/ocean/referenceStep.js` (extract two helpers; behaviour identical)
- Create: `src/terminal/ledger/ocean/gpu/gpuData.js`
- Test: `src/terminal/ledger/ocean/__tests__/gpuData.test.js`

**Interfaces:**
- Consumes: grid object (`nx, ny, n, cellKm, dlat, latOf, cosLat`), `LAT_LIMIT`, kinetics `kd, kaOcean, doSat, sstClimatology`; built sources `{ cells: [{ k, f }], conc: [4] }`.
- Produces (referenceStep.js): `rowConstants(grid)` → `Array<{ kd, ka, doSat }>` length `ny`; `diffusionSchedule(grid, dtDays, D = EDDY_DIFFUSIVITY_KM2_DAY)` → `{ sub, h }` (`sub = 0, h = 0` when `!(D > 0)`).
- Produces (gpuData.js):
  - `packStatic(grid, land, vel)` → `Float32Array(n*4)`: texel k = `[vel[2k], vel[2k+1], land[k], 0]`
  - `packRows(grid)` → `Float32Array(ny*2*4)`, a `ny × 2` texture: row 0 texel j = `[kd, ka, doSat, cosLat[j]]`; row 1 texel j = `[cosFN, cosFS, 0, 0]` where `cosFN = cos(−90 + (j+1)·dlat)`, `cosFS = cos(−90 + j·dlat)` (degrees)
  - `packSources(grid, land, sources)` → `Float32Array(n*4)`: texel k = `Σ conc[c]·f` over all sources' cells with that k; land cells stay 0

- [ ] **Step 1: Write the failing test**

`src/terminal/ledger/ocean/__tests__/gpuData.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { LAT_LIMIT } from '../grid';
import { rowConstants, diffusionSchedule } from '../referenceStep';
import { kd, kaOcean, doSat, sstClimatology } from '../kinetics';
import { packStatic, packRows, packSources } from '../gpu/gpuData';
import { syntheticWorld, uniformVelocity } from './syntheticWorld';

const { grid, mask } = syntheticWorld();
const landK = grid.idx(42, 15);
const oceanK = grid.idx(10, 16);

describe('rowConstants', () => {
  it('matches the kinetics at each row SST', () => {
    const rows = rowConstants(grid);
    expect(rows).toHaveLength(grid.ny);
    const sst = sstClimatology(grid.latOf(20));
    expect(rows[20]).toEqual({ kd: kd(sst), ka: kaOcean(sst), doSat: doSat(sst) });
  });
});

describe('diffusionSchedule', () => {
  it('keeps D·h/Δx²_min ≤ 0.2 at the narrowest simulated row', () => {
    let minDx = Infinity;
    for (let j = 0; j < grid.ny; j++) {
      if (Math.abs(grid.latOf(j)) <= LAT_LIMIT) minDx = Math.min(minDx, grid.cellKm * grid.cosLat[j]);
    }
    const { sub, h } = diffusionSchedule(grid, 0.25, 5e6);
    expect(sub).toBeGreaterThan(1);
    expect(h * sub).toBeCloseTo(0.25, 12);
    expect((5e6 * h) / (minDx * minDx)).toBeLessThanOrEqual(0.2 + 1e-12);
  });

  it('schedules nothing without diffusivity', () => {
    expect(diffusionSchedule(grid, 0.25, 0)).toEqual({ sub: 0, h: 0 });
  });
});

describe('packStatic', () => {
  it('interleaves u, v, land, 0', () => {
    const vel = uniformVelocity(grid, 3, -2);
    const data = packStatic(grid, mask.land, vel);
    expect(data).toHaveLength(grid.n * 4);
    expect(Array.from(data.slice(oceanK * 4, oceanK * 4 + 4))).toEqual([3, -2, 0, 0]);
    expect(Array.from(data.slice(landK * 4, landK * 4 + 4))).toEqual([3, -2, 1, 0]);
  });
});

describe('packRows', () => {
  it('stores rates and cosines as a ny × 2 texture', () => {
    const data = packRows(grid);
    const rows = rowConstants(grid);
    const j = 20;
    const rad = Math.PI / 180;
    expect(data).toHaveLength(grid.ny * 2 * 4);
    expect(data[j * 4]).toBeCloseTo(rows[j].kd, 6);
    expect(data[j * 4 + 1]).toBeCloseTo(rows[j].ka, 6);
    expect(data[j * 4 + 2]).toBeCloseTo(rows[j].doSat, 5);
    expect(data[j * 4 + 3]).toBeCloseTo(grid.cosLat[j], 6);
    const r1 = (grid.ny + j) * 4;
    expect(data[r1]).toBeCloseTo(Math.cos((-90 + (j + 1) * grid.dlat) * rad), 6);
    expect(data[r1 + 1]).toBeCloseTo(Math.cos((-90 + j * grid.dlat) * rad), 6);
  });
});

describe('packSources', () => {
  it('sums overlapping sources per cell and skips land', () => {
    const sources = [
      { cells: [{ k: oceanK, f: 0.5 }, { k: landK, f: 9 }], conc: [1, 2, 3, 4] },
      { cells: [{ k: oceanK, f: 0.25 }], conc: [4, 4, 4, 4] },
    ];
    const data = packSources(grid, mask.land, sources);
    expect(Array.from(data.slice(oceanK * 4, oceanK * 4 + 4))).toEqual([1.5, 2, 2.5, 3]);
    expect(Array.from(data.slice(landK * 4, landK * 4 + 4))).toEqual([0, 0, 0, 0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/gpuData.test.js`
Expected: FAIL — `rowConstants` / `diffusionSchedule` not exported, `../gpu/gpuData` missing.

- [ ] **Step 3: Extract the helpers in `referenceStep.js`**

Add these two exports (above `createOceanContext`):

```js
// Per-row reaction constants at the latitude SST climatology. Shared with the
// GPU row texture so both sides use identical numbers.
export function rowConstants(grid) {
  const rows = [];
  for (let j = 0; j < grid.ny; j++) {
    const sst = sstClimatology(grid.latOf(j));
    rows.push({ kd: kd(sst), ka: kaOcean(sst), doSat: doSat(sst) });
  }
  return rows;
}

// Diffusion substeps so D·h/Δx² ≤ 0.2 at the narrowest simulated row.
// Shared with the GPU runner so both substep identically.
export function diffusionSchedule(grid, dtDays, D = EDDY_DIFFUSIVITY_KM2_DAY) {
  if (!(D > 0)) return { sub: 0, h: 0 };
  let minDx = Infinity;
  for (let j = 0; j < grid.ny; j++) {
    if (Math.abs(grid.latOf(j)) <= LAT_LIMIT) minDx = Math.min(minDx, grid.cellKm * grid.cosLat[j]);
  }
  const sub = Math.max(1, Math.ceil((D * dtDays) / (minDx * minDx) / 0.2));
  return { sub, h: dtDays / sub };
}
```

In `createOceanContext`, replace the `rows` loop with `const rows = rowConstants(grid);`.

In `diffuse`, replace everything from `if (!(D > 0)) return;` through `const h = dtDays / sub;` with:

```js
  const { sub, h } = diffusionSchedule(grid, dtDays, D);
  if (sub === 0) return;
```

(keep `dst.set(src);` before it and the rest of the function unchanged).

- [ ] **Step 4: Create `gpu/gpuData.js`**

```js
// gpuData.js — packs the CPU-side ocean data into RGBA float arrays for the
// GPU runner. Layouts are the GPU contract in the spec; row 0 = south.

import { rowConstants } from '../referenceStep';

export function packStatic(grid, land, vel) {
  const out = new Float32Array(grid.n * 4);
  for (let k = 0; k < grid.n; k++) {
    out[k * 4] = vel[2 * k];
    out[k * 4 + 1] = vel[2 * k + 1];
    out[k * 4 + 2] = land[k];
  }
  return out;
}

// ny × 2 texture: row 0 = [kd, ka, doSat, cosLat], row 1 = [cos north face, cos south face, 0, 0].
export function packRows(grid) {
  const { ny, dlat } = grid;
  const rows = rowConstants(grid);
  const rad = Math.PI / 180;
  const out = new Float32Array(ny * 2 * 4);
  for (let j = 0; j < ny; j++) {
    out[j * 4] = rows[j].kd;
    out[j * 4 + 1] = rows[j].ka;
    out[j * 4 + 2] = rows[j].doSat;
    out[j * 4 + 3] = grid.cosLat[j];
    const q = (ny + j) * 4;
    out[q] = Math.cos((-90 + (j + 1) * dlat) * rad);
    out[q + 1] = Math.cos((-90 + j * dlat) * rad);
  }
  return out;
}

// Per-cell Σ conc·f (1/day units); the react pass adds src·Δt. Land stays 0,
// matching inject(), which skips land cells.
export function packSources(grid, land, sources) {
  const out = new Float32Array(grid.n * 4);
  for (const src of sources) {
    for (const { k, f } of src.cells) {
      if (land[k]) continue;
      for (let c = 0; c < 4; c++) out[k * 4 + c] += src.conc[c] * f;
    }
  }
  return out;
}
```

- [ ] **Step 5: Run tests to verify they pass (including phase-1 oracle tests)**

Run: `npx vitest run src/terminal/ledger/ocean`
Expected: PASS — all phase-1 tests still green (the extraction is behaviour-neutral) plus the new file.

- [ ] **Step 6: Mutation checks**

1. In `diffusionSchedule`, change `0.2` to `0.3`. "keeps D·h/Δx²_min ≤ 0.2" must FAIL. Revert.
2. In `packSources`, remove `if (land[k]) continue;`. "skips land" must FAIL. Revert.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/ledger/ocean/referenceStep.js src/terminal/ledger/ocean/gpu/gpuData.js src/terminal/ledger/ocean/__tests__/gpuData.test.js
git commit -m "feat(ledger-ocean): GPU data packing; share row constants and diffusion schedule with the oracle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Float render targets on the shared harness

**Files:**
- Create: `src/terminal/gl/pingPong.js`
- Modify: `src/terminal/gl/__tests__/recordingGL.js` (additive: one constant, one method)
- Test: `src/terminal/gl/__tests__/pingPong.test.js`

**Interfaces:**
- Consumes: a WebGL2 context (real, or `createRecordingGL({ version: 2, extensions })`).
- Produces:
  - `probeFloatTargets(gl)` → boolean (WebGL2 **and** `EXT_color_buffer_float`)
  - `createFloatTexture(gl, w, h, data = null)` → texture (RGBA32F, NEAREST, CLAMP_TO_EDGE)
  - `uploadFloatTexture(gl, tex, w, h, data)`
  - `createFloatTarget(gl, w, h, data = null)` → `{ tex, fbo, w, h }` or `null` if incomplete
  - `disposeTarget(gl, target)`
  - `createPingPong(gl, w, h, data = null)` → `{ read, write, swap(), dispose() }` or `null`
  - `readTarget(gl, target)` → `Float32Array(w*h*4)`

- [ ] **Step 1: Extend the recording stub (additive)**

In `recordingGL.js`: add `RGBA32F: 0x8814,` to `CONSTANTS` (after `RGBA16F`), and add `'readPixels'` to the end of the `V2_ONLY` array. Nothing else. Then run `npx vitest run src/terminal/gl` — expected: all existing tests pass and no snapshot file changes (`git status src/terminal/gl/__tests__/__snapshots__` shows nothing).

- [ ] **Step 2: Write the failing test**

`src/terminal/gl/__tests__/pingPong.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createRecordingGL } from './recordingGL';
import {
  probeFloatTargets, createFloatTarget, createPingPong, readTarget,
} from '../pingPong';

const withFloat = () => createRecordingGL({ version: 2, extensions: ['EXT_color_buffer_float'] });
const find = (log, name) => log.filter((e) => e[0] === name);

describe('probeFloatTargets', () => {
  it('needs WebGL2 and EXT_color_buffer_float', () => {
    expect(probeFloatTargets(createRecordingGL({ version: 2 }))).toBe(false);
    expect(probeFloatTargets(createRecordingGL({ version: 1, extensions: ['EXT_color_buffer_float'] }))).toBe(false);
    expect(probeFloatTargets(withFloat())).toBe(true);
    expect(probeFloatTargets(null)).toBe(false);
  });
});

describe('createFloatTarget', () => {
  it('builds a complete NEAREST RGBA32F target and unbinds', () => {
    const gl = withFloat();
    const t = createFloatTarget(gl, 8, 4);
    expect(t).toMatchObject({ w: 8, h: 4 });
    const log = gl.__log;
    expect(find(log, 'texImage2D')[0]).toEqual(
      ['texImage2D', gl.TEXTURE_2D, 0, gl.RGBA32F, 8, 4, 0, gl.RGBA, gl.FLOAT, null],
    );
    expect(log).toContainEqual(['texParameteri', gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST]);
    expect(log).toContainEqual(['texParameteri', gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST]);
    expect(find(log, 'framebufferTexture2D')).toHaveLength(1);
    expect(find(log, 'checkFramebufferStatus')).toHaveLength(1);
    expect(log[log.length - 1]).toEqual(['bindFramebuffer', gl.FRAMEBUFFER, null]);
  });

  it('returns null and frees both objects when the attachment is incomplete', () => {
    const gl = withFloat();
    gl.checkFramebufferStatus = () => 0;
    expect(createFloatTarget(gl, 8, 4)).toBeNull();
    expect(find(gl.__log, 'deleteFramebuffer')).toHaveLength(1);
    expect(find(gl.__log, 'deleteTexture')).toHaveLength(1);
  });
});

describe('createPingPong', () => {
  it('swaps read and write', () => {
    const pp = createPingPong(withFloat(), 4, 2);
    const r = pp.read;
    const w = pp.write;
    expect(r).not.toBe(w);
    pp.swap();
    expect(pp.read).toBe(w);
    expect(pp.write).toBe(r);
  });
});

describe('readTarget', () => {
  it('reads RGBA floats from the target framebuffer', () => {
    const gl = withFloat();
    const t = createFloatTarget(gl, 8, 4);
    gl.__log.length = 0;
    const out = readTarget(gl, t);
    expect(out).toBeInstanceOf(Float32Array);
    expect(out).toHaveLength(8 * 4 * 4);
    const rp = find(gl.__log, 'readPixels')[0];
    expect(rp.slice(0, 7)).toEqual(['readPixels', 0, 0, 8, 4, gl.RGBA, gl.FLOAT]);
    expect(gl.__log[gl.__log.length - 1]).toEqual(['bindFramebuffer', gl.FRAMEBUFFER, null]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/terminal/gl/__tests__/pingPong.test.js`
Expected: FAIL — cannot resolve `../pingPong`.

- [ ] **Step 4: Implement `pingPong.js`**

```js
// pingPong.js — float render targets for GPU simulations on the shared GL
// harness. RGBA32F everywhere; sampled with texelFetch, so NEAREST filtering
// keeps textures complete without mipmaps or OES_texture_float_linear.

export function probeFloatTargets(gl) {
  if (!gl || typeof gl.createVertexArray !== 'function') return false;
  return !!gl.getExtension('EXT_color_buffer_float');
}

export function createFloatTexture(gl, w, h, data = null) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

export function uploadFloatTexture(gl, tex, w, h, data) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data);
}

export function disposeTarget(gl, target) {
  if (!target) return;
  gl.deleteFramebuffer(target.fbo);
  gl.deleteTexture(target.tex);
}

export function createFloatTarget(gl, w, h, data = null) {
  const tex = createFloatTexture(gl, w, h, data);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!ok) {
    disposeTarget(gl, { tex, fbo });
    return null;
  }
  return { tex, fbo, w, h };
}

export function createPingPong(gl, w, h, data = null) {
  const a = createFloatTarget(gl, w, h, data);
  const b = createFloatTarget(gl, w, h, data);
  if (!a || !b) {
    disposeTarget(gl, a);
    disposeTarget(gl, b);
    return null;
  }
  let read = a;
  let write = b;
  return {
    get read() { return read; },
    get write() { return write; },
    swap() {
      const t = read;
      read = write;
      write = t;
    },
    dispose() {
      disposeTarget(gl, a);
      disposeTarget(gl, b);
    },
  };
}

export function readTarget(gl, target) {
  const out = new Float32Array(target.w * target.h * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
  gl.readPixels(0, 0, target.w, target.h, gl.RGBA, gl.FLOAT, out);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return out;
}
```

- [ ] **Step 5: Run tests to verify they pass; confirm snapshots untouched**

Run: `npx vitest run src/terminal/gl`
Expected: PASS, and `git status --short src/terminal/gl/__tests__/__snapshots__` prints nothing.

- [ ] **Step 6: Mutation checks**

1. Change `gl.NEAREST` to `gl.LINEAR` for `TEXTURE_MIN_FILTER`. "builds a complete NEAREST RGBA32F target" must FAIL. Revert.
2. In `createFloatTarget`, delete the `disposeTarget(...)` call in the `!ok` branch. "returns null and frees both objects" must FAIL. Revert.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/gl/pingPong.js src/terminal/gl/__tests__/pingPong.test.js src/terminal/gl/__tests__/recordingGL.js
git commit -m "feat(gl): float render targets and ping-pong helpers on the shared harness

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: GLSL programs and a real-compiler check

**Files:**
- Create: `src/terminal/ledger/ocean/gpu/shaders.js`
- Create: `scripts/oceanShaders.mjs`
- Test: `src/terminal/ledger/ocean/__tests__/shaders.test.js`

**Interfaces:**
- Consumes: nothing at runtime (strings only).
- Produces:
  - `SIM_VS` (fullscreen quad, attribute location 0 named `a`)
  - `SIM_PROGRAMS = { advect, correct, final, diffuse, react }`, each `{ fs: string, uniforms: string[] }` — the uniforms the runner must look up **in addition to** the shared `SHARED_UNIFORMS`
  - `SHARED_UNIFORMS = ['uStatic', 'uRows', 'uGrid', 'uCellKm']`
  - `COMPOSITE_FS`, `COMPOSITE_UNIFORMS = ['uState', 'uStatic', 'uGrid', 'uRes', 'uTime', 'uRef', 'uGain', 'uRim', 'uAberration']`
  - Texture units used by every sim program: `uSrc`/`uState` = 0, `uStatic` = 1, `uRows` = 2, `uFwd`/`uCorr`/`uSources` = 3. `uGrid` is a `vec2` (float) holding `(nx, ny)`.

- [ ] **Step 1: Write the failing test**

`src/terminal/ledger/ocean/__tests__/shaders.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  SIM_VS, SIM_PROGRAMS, SHARED_UNIFORMS, COMPOSITE_FS, COMPOSITE_UNIFORMS,
} from '../gpu/shaders';

const declares = (src, name) => new RegExp(`uniform\\s+\\w+\\s+${name}\\s*;`).test(src);

describe('ocean shaders', () => {
  it('are GLSL ES 3.00 with the quad on location 0', () => {
    expect(SIM_VS.startsWith('#version 300 es')).toBe(true);
    expect(SIM_VS).toContain('layout(location = 0) in vec2 a;');
  });

  it.each(Object.entries(SIM_PROGRAMS))('%s declares every uniform the runner sets', (_name, prog) => {
    expect(prog.fs.startsWith('#version 300 es')).toBe(true);
    for (const u of [...SHARED_UNIFORMS, ...prog.uniforms]) expect(declares(prog.fs, u)).toBe(true);
  });

  it('composite declares every uniform the view sets', () => {
    for (const u of COMPOSITE_UNIFORMS) expect(declares(COMPOSITE_FS, u)).toBe(true);
  });

  it('never samples with hardware filtering', () => {
    for (const src of [...Object.values(SIM_PROGRAMS).map((p) => p.fs), COMPOSITE_FS]) {
      expect(/\btexture\s*\(/.test(src)).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/shaders.test.js`
Expected: FAIL — cannot resolve `../gpu/shaders`.

- [ ] **Step 3: Implement `gpu/shaders.js`**

```js
// shaders.js — GLSL ES 3.00 for the Ledger ocean. Every pass is a port of
// referenceStep.js (the CPU oracle); the GPU contract in the spec is binding.
// All fetches are texelFetch: land-aware manual bilinear, never hardware
// filtering (which would blend land zeros in and sink every coast).

export const SIM_VS = `#version 300 es
layout(location = 0) in vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`;

export const SHARED_UNIFORMS = ['uStatic', 'uRows', 'uGrid', 'uCellKm'];

const COMMON = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D uStatic;  // unit 1: r = u km/d, g = v km/d, b = land (0/1)
uniform sampler2D uRows;    // unit 2: ny x 2; row 0 (kd, ka, doSat, cosLat), row 1 (cosN face, cosS face)
uniform vec2 uGrid;         // (nx, ny)
uniform float uCellKm;
out vec4 outColor;

int nxI() { return int(uGrid.x + 0.5); }
int nyI() { return int(uGrid.y + 0.5); }
int wrapI(int i) { int nx = nxI(); return i - nx * int(floor(float(i) / float(nx))); }
bool isLand(ivec2 c) { return texelFetch(uStatic, c, 0).b > 0.5; }
vec4 rowA(int j) { return texelFetch(uRows, ivec2(j, 0), 0); }
vec4 rowB(int j) { return texelFetch(uRows, ivec2(j, 1), 0); }

// Back-trace from cell c over dt days (dt < 0 traces forward), in cell units,
// using the cos-lat of the destination row.
vec2 traceFrom(ivec2 c, float dt) {
  vec2 vel = texelFetch(uStatic, c, 0).rg;
  float cosL = rowA(c.y).w;
  return vec2(float(c.x) - vel.x * dt / (uCellKm * cosL), float(c.y) - vel.y * dt / uCellKm);
}

// Land-renormalised bilinear over the four texels around p; lo/hi over the
// same OCEAN texels (zero-weight ones included). ok = false when all are land.
struct Tap { vec4 v; vec4 lo; vec4 hi; bool ok; };
Tap sample4(sampler2D field, vec2 p) {
  int ny = nyI();
  float y = clamp(p.y, 0.0, float(ny - 1));
  int i0 = int(floor(p.x));
  int j0 = min(ny - 2, int(floor(y)));
  float fx = p.x - float(i0);
  float fy = y - float(j0);
  Tap s;
  s.v = vec4(0.0);
  s.lo = vec4(1e30);
  s.hi = vec4(-1e30);
  float wsum = 0.0;
  for (int t = 0; t < 4; t++) {
    int di = t & 1;
    int dj = t >> 1;
    ivec2 q = ivec2(wrapI(i0 + di), j0 + dj);
    if (isLand(q)) continue;
    float w = (di == 1 ? fx : 1.0 - fx) * (dj == 1 ? fy : 1.0 - fy);
    vec4 val = texelFetch(field, q, 0);
    wsum += w;
    s.v += w * val;
    s.lo = min(s.lo, val);
    s.hi = max(s.hi, val);
  }
  s.ok = wsum >= 1e-9;
  if (s.ok) s.v /= wsum;
  return s;
}

// NaN/inf -> 0, clamp >= 0, deficit <= DO saturation of the row. Land is the caller's job.
vec4 guardCell(vec4 v, int j) {
  for (int c = 0; c < 4; c++) {
    float x = v[c];
    if (!(x >= 0.0 && x < 1e30)) v[c] = 0.0;
  }
  v.w = min(v.w, rowA(j).z);
  return v;
}
`;

// Semi-Lagrangian advection (BFECC forward leg).
const ADVECT_FS = `${COMMON}
uniform sampler2D uSrc;  // unit 0
uniform float uDt;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  if (isLand(c)) { outColor = vec4(0.0); return; }
  Tap s = sample4(uSrc, traceFrom(c, uDt));
  outColor = s.ok ? s.v : texelFetch(uSrc, c, 0);
}
`;

// BFECC backward leg folded with the correction: corr = s + (s - back) / 2.
const CORRECT_FS = `${COMMON}
uniform sampler2D uState; // unit 0
uniform sampler2D uFwd;   // unit 3
uniform float uDt;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 st = texelFetch(uState, c, 0);
  vec4 back = vec4(0.0);
  if (!isLand(c)) {
    Tap s = sample4(uFwd, traceFrom(c, -uDt));
    back = s.ok ? s.v : texelFetch(uFwd, c, 0);
  }
  outColor = st + 0.5 * (st - back);
}
`;

// BFECC final leg with the min/max limiter over the ORIGINAL state, then guard.
const FINAL_FS = `${COMMON}
uniform sampler2D uState; // unit 0
uniform sampler2D uCorr;  // unit 3
uniform float uDt;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  if (isLand(c)) { outColor = vec4(0.0); return; }
  vec2 p = traceFrom(c, uDt);
  Tap s0 = sample4(uState, p);
  if (!s0.ok) { outColor = guardCell(texelFetch(uState, c, 0), c.y); return; }
  Tap s1 = sample4(uCorr, p);
  outColor = guardCell(clamp(s1.v, s0.lo, s0.hi), c.y);
}
`;

// One explicit diffusion substep; y-term in flux form; land and poles mirror C.
const DIFFUSE_FS = `${COMMON}
uniform sampler2D uSrc;  // unit 0
uniform float uD;        // km^2/day
uniform float uH;        // substep, days
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  if (isLand(c)) { outColor = vec4(0.0); return; }
  int i = c.x;
  int j = c.y;
  int ny = nyI();
  vec4 C = texelFetch(uSrc, c, 0);
  ivec2 cE = ivec2(wrapI(i + 1), j);
  ivec2 cW = ivec2(wrapI(i - 1), j);
  vec4 E = isLand(cE) ? C : texelFetch(uSrc, cE, 0);
  vec4 W = isLand(cW) ? C : texelFetch(uSrc, cW, 0);
  vec4 N = C;
  if (j + 1 < ny && !isLand(ivec2(i, j + 1))) N = texelFetch(uSrc, ivec2(i, j + 1), 0);
  vec4 S = C;
  if (j - 1 >= 0 && !isLand(ivec2(i, j - 1))) S = texelFetch(uSrc, ivec2(i, j - 1), 0);
  vec4 ra = rowA(j);
  vec4 rb = rowB(j);
  float dx = uCellKm * ra.w;
  float dx2 = dx * dx;
  float dy2 = uCellKm * uCellKm;
  vec4 yTerm = (rb.x * (N - C) - rb.y * (C - S)) / (ra.w * dy2);
  outColor = C + uD * uH * ((E + W - 2.0 * C) / dx2 + yTerm);
}
`;

// Guard the diffused input, exact reaction, inject sources, guard again.
const REACT_FS = `${COMMON}
uniform sampler2D uSrc;     // unit 0
uniform sampler2D uSources; // unit 3: per-cell sum(conc * f), 1/day
uniform float uDt;
uniform float uReact;       // 1 = reactions on
uniform float uTauT;
uniform float uTauN;

// (e^{-kd t} - e^{-ka t}) / (ka - kd), with a series near ka = kd (float32-safe threshold).
float bridge(float kdv, float kav, float t) {
  float eD = exp(-kdv * t);
  float eA = exp(-kav * t);
  float x = (kav - kdv) * t;
  if (abs(x) < 1e-2) return t * eD * (1.0 - x * 0.5 + x * x / 6.0 - x * x * x / 24.0);
  return (eD - eA) / (kav - kdv);
}

void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  if (isLand(c)) { outColor = vec4(0.0); return; }
  vec4 v = guardCell(texelFetch(uSrc, c, 0), c.y);
  if (uReact > 0.5) {
    vec4 r = rowA(c.y);
    float L = v.y;
    float D = v.w;
    v.x *= exp(-uDt / uTauT);
    v.y = L * exp(-r.x * uDt);
    v.z *= exp(-uDt / uTauN);
    v.w = r.x * L * bridge(r.x, r.y, uDt) + D * exp(-r.y * uDt);
  }
  v += texelFetch(uSources, c, 0) * uDt;
  outColor = guardCell(v, c.y);
}
`;

export const SIM_PROGRAMS = {
  advect: { fs: ADVECT_FS, uniforms: ['uSrc', 'uDt'] },
  correct: { fs: CORRECT_FS, uniforms: ['uState', 'uFwd', 'uDt'] },
  final: { fs: FINAL_FS, uniforms: ['uState', 'uCorr', 'uDt'] },
  diffuse: { fs: DIFFUSE_FS, uniforms: ['uSrc', 'uD', 'uH'] },
  react: { fs: REACT_FS, uniforms: ['uSrc', 'uSources', 'uDt', 'uReact', 'uTauT', 'uTauN'] },
};

export const COMPOSITE_UNIFORMS = [
  'uState', 'uStatic', 'uGrid', 'uRes', 'uTime', 'uRef', 'uGain', 'uRim', 'uAberration',
];

// Display composite (spec §1): per-channel log exposure, additive emission,
// deficit as absence of light, cyan rim on the deficit gradient, slight
// chromatic aberration, 1-px scanline + grain dither (no bloom).
export const COMPOSITE_FS = `${COMMON}
uniform sampler2D uState;   // unit 0
uniform vec2 uRes;          // backing-store pixels
uniform float uTime;        // seconds; grain seed
uniform vec4 uRef;          // reference concentration per channel for log exposure
uniform vec4 uGain;         // exposure gain per channel (w = deficit void strength)
uniform float uRim;         // cyan rim gain
uniform float uAberration;  // chromatic offset, cells

const vec3 CRIMSON = vec3(1.0, 0.09, 0.20);
const vec3 AMBER = vec3(1.0, 0.62, 0.0);
const vec3 GREEN = vec3(0.22, 1.0, 0.08);
const vec3 CYAN = vec3(0.0, 0.90, 1.0);
const vec3 BASE = vec3(0.020);
const vec3 LAND = vec3(0.039);
const vec3 COAST = vec3(0.08, 0.72, 0.65);

vec4 stateAt(vec2 p) {
  Tap s = sample4(uState, p);
  return s.ok ? s.v : vec4(0.0);
}

float landAt(vec2 p) {
  int ny = nyI();
  float y = clamp(p.y, 0.0, float(ny - 1));
  int i0 = int(floor(p.x));
  int j0 = min(ny - 2, int(floor(y)));
  float fx = p.x - float(i0);
  float fy = y - float(j0);
  float l = 0.0;
  for (int t = 0; t < 4; t++) {
    int di = t & 1;
    int dj = t >> 1;
    float w = (di == 1 ? fx : 1.0 - fx) * (dj == 1 ? fy : 1.0 - fy);
    l += w * texelFetch(uStatic, ivec2(wrapI(i0 + di), j0 + dj), 0).b;
  }
  return l;
}

vec4 intensity(vec4 v) { return log(1.0 + max(v, vec4(0.0)) / uRef) * uGain; }
vec3 emission(vec4 I) { return (I.x * CRIMSON + I.y * AMBER + I.z * GREEN) * exp(-I.w); }

void main() {
  vec2 p = vec2(gl_FragCoord.x / uRes.x * uGrid.x - 0.5, gl_FragCoord.y / uRes.y * uGrid.y - 0.5);
  vec4 I = intensity(stateAt(p));
  vec3 e = emission(I);
  vec3 eR = emission(intensity(stateAt(p + vec2(uAberration, 0.0))));
  vec3 eB = emission(intensity(stateAt(p - vec2(uAberration, 0.0))));
  e = vec3(eR.r, e.g, eB.b);
  float gx = intensity(stateAt(p + vec2(1.0, 0.0))).w - intensity(stateAt(p - vec2(1.0, 0.0))).w;
  float gy = intensity(stateAt(p + vec2(0.0, 1.0))).w - intensity(stateAt(p - vec2(0.0, 1.0))).w;
  float rim = smoothstep(0.05, 0.4, 0.5 * length(vec2(gx, gy))) * uRim;
  vec3 col = BASE + (1.0 - exp(-e)) + rim * 0.35 * CYAN;
  float lf = landAt(p);
  col = mix(col, LAND, smoothstep(0.45, 0.55, lf));
  col += COAST * 0.22 * smoothstep(0.6, 1.0, 1.0 - abs(2.0 * lf - 1.0));
  float scan = mod(floor(gl_FragCoord.y), 2.0) < 1.0 ? 0.96 : 1.0;
  float n = fract(sin(dot(gl_FragCoord.xy + uTime * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
  outColor = vec4(col * scan + (n - 0.5) / 255.0, 1.0);
}
`;
```

- [ ] **Step 4: Create `scripts/oceanShaders.mjs`**

```js
// Compiles and links every Ledger ocean program in real headless Chrome
// (SwiftShader). jsdom has no GL, so this is where a GLSL error surfaces.
//
//   node scripts/oceanShaders.mjs
import { launch } from './cdp.mjs';
import { SIM_VS, SIM_PROGRAMS, COMPOSITE_FS } from '../src/terminal/ledger/ocean/gpu/shaders.js';

const programs = { composite: [SIM_VS, COMPOSITE_FS] };
for (const [name, p] of Object.entries(SIM_PROGRAMS)) programs[name] = [SIM_VS, p.fs];

const page = await launch({ url: 'about:blank', width: 320, height: 240 });
let failed = false;
try {
  const result = await page.eval(`(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return { __error: 'no webgl2 context' };
    const P = ${JSON.stringify(programs)};
    const out = { __extColorBufferFloat: !!gl.getExtension('EXT_color_buffer_float') };
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      return { s, ok: gl.getShaderParameter(s, gl.COMPILE_STATUS), log: gl.getShaderInfoLog(s) };
    };
    for (const [name, [vs, fs]] of Object.entries(P)) {
      const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
      const p = gl.createProgram(); gl.attachShader(p, v.s); gl.attachShader(p, f.s); gl.linkProgram(p);
      const linked = gl.getProgramParameter(p, gl.LINK_STATUS);
      out[name] = { ok: v.ok && f.ok && linked, vs: v.log, fs: f.log, link: gl.getProgramInfoLog(p) };
    }
    return out;
  })()`);
  console.log(JSON.stringify(result, null, 2));
  failed = !!result.__error || Object.entries(result).some(([k, r]) => !k.startsWith('__') && !r.ok);
} finally {
  await page.close();
}
process.exit(failed ? 1 : 0);
```

- [ ] **Step 5: Run the jsdom test and the compiler check**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/shaders.test.js`
Expected: PASS.
Run: `node scripts/oceanShaders.mjs`
Expected: exit 0; every program `"ok": true`; `__extColorBufferFloat: true`. If any program fails, fix the GLSL (not the test) and re-run; report every fix in the task report.

- [ ] **Step 6: Mutation checks**

1. In `ADVECT_FS`, rename `traceFrom` to `traceFromX` at its call site only. `node scripts/oceanShaders.mjs` must exit 1 with a compile log naming the identifier. Revert.
2. In `COMPOSITE_FS`, change `stateAt(p)` in the first `intensity(...)` call to `texture(uState, p)`. The "never samples with hardware filtering" test must FAIL. Revert.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/ledger/ocean/gpu/shaders.js scripts/oceanShaders.mjs src/terminal/ledger/ocean/__tests__/shaders.test.js
git commit -m "feat(ledger-ocean): GLSL ports of the oracle passes and the display composite

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: GPU runner

**Files:**
- Create: `src/terminal/ledger/ocean/gpu/oceanGpu.js`
- Test: `src/terminal/ledger/ocean/__tests__/oceanGpu.test.js`

**Interfaces:**
- Consumes: `buildProgram` (`src/terminal/gl/glHost.js`, default strategy `'lunar'` throws on compile/link failure); Task 3 `pingPong.js`; Task 4 `SIM_VS, SIM_PROGRAMS, SHARED_UNIFORMS`; `diffusionSchedule`, `EDDY_DIFFUSIVITY_KM2_DAY` (Task 2); `DT_DAYS`; `TAU_T_DAYS, TAU_N_DAYS`.
- Produces: `createOceanGpu(gl, { grid, staticData, rowData, vao, diffusivity = EDDY_DIFFUSIVITY_KM2_DAY, dtDays = DT_DAYS })` → `null` without float targets, else `{ step({ reactions = true } = {}), setState(Float32Array), setSources(Float32Array), readState() → Float32Array, stateTexture(), staticTexture(), dispose() }`. `step()` leaves the default framebuffer bound; the caller restores viewport, program and VAO before drawing to the canvas. The caller's VAO must have the fullscreen quad on attribute 0.

- [ ] **Step 1: Write the failing test**

`src/terminal/ledger/ocean/__tests__/oceanGpu.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createRecordingGL } from '../../../gl/__tests__/recordingGL';
import { makeGrid, DT_DAYS } from '../grid';
import { diffusionSchedule } from '../referenceStep';
import { createOceanGpu } from '../gpu/oceanGpu';

const grid = makeGrid(8, 4);
const staticData = new Float32Array(grid.n * 4);
const rowData = new Float32Array(grid.ny * 2 * 4);
const withFloat = () => createRecordingGL({ version: 2, extensions: ['EXT_color_buffer_float'] });
const make = (gl, opts = {}) => createOceanGpu(gl, { grid, staticData, rowData, vao: { __tag: 'vao:test' }, ...opts });

// Replays the WHOLE log (FBO→texture links are made at creation time), and
// for every draw at index >= from checks that the texture attached to the
// bound FBO is not bound on any texture unit (a WebGL feedback loop).
function feedback(log, from) {
  const fboTex = new Map();
  const bound = new Map();
  let fbo = null;
  let unit = 0;
  let bad = 0;
  let draws = 0;
  log.forEach(([name, ...a], idx) => {
    if (name === 'bindFramebuffer') fbo = a[1];
    else if (name === 'framebufferTexture2D') fboTex.set(fbo, a[3]);
    else if (name === 'activeTexture') unit = a[0] - 0x84c0;
    else if (name === 'bindTexture') bound.set(unit, a[1]);
    else if (name === 'drawArrays' && idx >= from) {
      draws++;
      const t = fboTex.get(fbo);
      if (t && [...bound.values()].includes(t)) bad++;
    }
  });
  return { bad, draws };
}

describe('createOceanGpu', () => {
  it('returns null without float render targets', () => {
    expect(make(createRecordingGL({ version: 2 }))).toBeNull();
  });

  it('runs 3 BFECC passes, each diffusion substep, and one react pass per step', () => {
    const gl = withFloat();
    const gpu = make(gl, { diffusivity: 5e6 });
    const { sub } = diffusionSchedule(grid, DT_DAYS, 5e6);
    expect(sub).toBeGreaterThan(1);
    const start = gl.__log.length;
    gpu.step();
    const stepLog = gl.__log.slice(start);
    expect(stepLog.filter((e) => e[0] === 'drawArrays')).toHaveLength(3 + sub + 1);
    expect(stepLog).toContainEqual(['viewport', 0, 0, 8, 4]);
    expect(stepLog[stepLog.length - 1]).toEqual(['bindFramebuffer', gl.FRAMEBUFFER, null]);
  });

  it('skips diffusion entirely when D = 0', () => {
    const gl = withFloat();
    const gpu = make(gl, { diffusivity: 0 });
    const start = gl.__log.length;
    gpu.step();
    expect(gl.__log.slice(start).filter((e) => e[0] === 'drawArrays')).toHaveLength(4);
  });

  it('never renders into a texture it is sampling', () => {
    const gl = withFloat();
    const gpu = make(gl, { diffusivity: 5e6 });
    const start = gl.__log.length;
    for (let s = 0; s < 3; s++) gpu.step();
    const { bad, draws } = feedback(gl.__log, start);
    expect(draws).toBe(3 * (3 + diffusionSchedule(grid, DT_DAYS, 5e6).sub + 1));
    expect(bad).toBe(0);
  });

  it('reads back the current state', () => {
    const gl = withFloat();
    const gpu = make(gl);
    expect(gpu.readState()).toHaveLength(grid.n * 4);
    expect(gl.__log.some((e) => e[0] === 'readPixels')).toBe(true);
  });
});
```

Note: `feedback()` must see the creation-time `framebufferTexture2D` calls to know which texture each FBO writes, so it replays the full log and only judges draws from `start` on. Passing a sliced log would make the check silently vacuous (no FBO would map to a texture).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/oceanGpu.test.js`
Expected: FAIL — cannot resolve `../gpu/oceanGpu`.

- [ ] **Step 3: Implement `gpu/oceanGpu.js`**

```js
// oceanGpu.js — the Ledger ocean on WebGL2. One step = BFECC (advect,
// correct, final) + diffusion substeps + react/inject, matching
// referenceStep.step() pass for pass. React-free so the parity probe can
// drive it directly. Texture units: 0 = state/src, 1 = static, 2 = rows,
// 3 = fwd/corr/sources.

import { buildProgram } from '../../../gl/glHost';
import {
  probeFloatTargets, createFloatTexture, createFloatTarget, createPingPong,
  disposeTarget, readTarget, uploadFloatTexture,
} from '../../../gl/pingPong';
import { DT_DAYS } from '../grid';
import { TAU_T_DAYS, TAU_N_DAYS } from '../kinetics';
import { EDDY_DIFFUSIVITY_KM2_DAY, diffusionSchedule } from '../referenceStep';
import { SIM_VS, SIM_PROGRAMS, SHARED_UNIFORMS } from './shaders';

const UNIT = { src: 0, static: 1, rows: 2, aux: 3 };
const SAMPLER_UNITS = { uSrc: UNIT.src, uState: UNIT.src, uFwd: UNIT.aux, uCorr: UNIT.aux, uSources: UNIT.aux };

export function createOceanGpu(gl, {
  grid, staticData, rowData, vao,
  diffusivity = EDDY_DIFFUSIVITY_KM2_DAY,
  dtDays = DT_DAYS,
}) {
  if (!probeFloatTargets(gl)) return null;
  const { nx, ny, n } = grid;

  const staticTex = createFloatTexture(gl, nx, ny, staticData);
  const rowsTex = createFloatTexture(gl, ny, 2, rowData);
  const sourcesTex = createFloatTexture(gl, nx, ny, new Float32Array(n * 4));
  const state = createPingPong(gl, nx, ny, new Float32Array(n * 4));
  const fwd = createFloatTarget(gl, nx, ny);
  const corr = createFloatTarget(gl, nx, ny);
  const textures = [staticTex, rowsTex, sourcesTex];
  if (!state || !fwd || !corr) {
    state?.dispose();
    disposeTarget(gl, fwd);
    disposeTarget(gl, corr);
    for (const t of textures) gl.deleteTexture(t);
    return null;
  }

  const P = {};
  for (const [name, def] of Object.entries(SIM_PROGRAMS)) {
    const prog = buildProgram(gl, SIM_VS, def.fs, { label: `ocean:${name}` });
    const U = {};
    for (const u of [...SHARED_UNIFORMS, ...def.uniforms]) U[u] = gl.getUniformLocation(prog, u);
    gl.useProgram(prog);
    gl.uniform1i(U.uStatic, UNIT.static);
    gl.uniform1i(U.uRows, UNIT.rows);
    gl.uniform2f(U.uGrid, nx, ny);
    gl.uniform1f(U.uCellKm, grid.cellKm);
    for (const u of def.uniforms) if (u in SAMPLER_UNITS) gl.uniform1i(U[u], SAMPLER_UNITS[u]);
    P[name] = { prog, U };
  }
  gl.useProgram(P.react.prog);
  gl.uniform1f(P.react.U.uTauT, TAU_T_DAYS);
  gl.uniform1f(P.react.U.uTauN, TAU_N_DAYS);

  const sched = diffusionSchedule(grid, dtDays, diffusivity);

  const bind = (unit, tex) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  };
  const draw = (target) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  return {
    step({ reactions = true } = {}) {
      gl.bindVertexArray(vao);
      gl.disable(gl.BLEND);
      gl.viewport(0, 0, nx, ny);
      bind(UNIT.static, staticTex);
      bind(UNIT.rows, rowsTex);

      gl.useProgram(P.advect.prog);
      gl.uniform1f(P.advect.U.uDt, dtDays);
      bind(UNIT.aux, sourcesTex);
      bind(UNIT.src, state.read.tex);
      draw(fwd);

      gl.useProgram(P.correct.prog);
      gl.uniform1f(P.correct.U.uDt, dtDays);
      bind(UNIT.src, state.read.tex);
      bind(UNIT.aux, fwd.tex);
      draw(corr);

      gl.useProgram(P.final.prog);
      gl.uniform1f(P.final.U.uDt, dtDays);
      bind(UNIT.src, state.read.tex);
      bind(UNIT.aux, corr.tex);
      draw(state.write);
      state.swap();

      if (sched.sub > 0) {
        gl.useProgram(P.diffuse.prog);
        gl.uniform1f(P.diffuse.U.uD, diffusivity);
        gl.uniform1f(P.diffuse.U.uH, sched.h);
        bind(UNIT.aux, sourcesTex);
        for (let s = 0; s < sched.sub; s++) {
          bind(UNIT.src, state.read.tex);
          draw(state.write);
          state.swap();
        }
      }

      gl.useProgram(P.react.prog);
      gl.uniform1f(P.react.U.uDt, dtDays);
      gl.uniform1f(P.react.U.uReact, reactions ? 1 : 0);
      bind(UNIT.src, state.read.tex);
      bind(UNIT.aux, sourcesTex);
      draw(state.write);
      state.swap();

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
    setState(data) {
      uploadFloatTexture(gl, state.read.tex, nx, ny, data);
    },
    setSources(data) {
      uploadFloatTexture(gl, sourcesTex, nx, ny, data);
    },
    readState() {
      return readTarget(gl, state.read);
    },
    stateTexture() {
      return state.read.tex;
    },
    staticTexture() {
      return staticTex;
    },
    dispose() {
      for (const { prog } of Object.values(P)) gl.deleteProgram(prog);
      state.dispose();
      disposeTarget(gl, fwd);
      disposeTarget(gl, corr);
      for (const t of textures) gl.deleteTexture(t);
    },
  };
}
```

Why unit 3 is rebound to `sourcesTex` before the advect and diffuse passes: after a step, unit 3 still holds `corr`, and the next step's advect pass renders into `fwd`; leaving `fwd` or `corr` bound anywhere while rendering into them is a feedback loop. Parking unit 3 on the read-only sources texture removes that hazard for every pass.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/oceanGpu.test.js`
Expected: PASS.

- [ ] **Step 5: Mutation checks**

1. In the final leg, change `draw(state.write)` to `draw(state.read)`. "never renders into a texture it is sampling" must FAIL. Revert.
2. Delete the `if (sched.sub > 0)` block's loop body `draw(state.write);`. "runs 3 BFECC passes, each diffusion substep…" must FAIL. Revert.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/ledger/ocean/gpu/oceanGpu.js src/terminal/ledger/ocean/__tests__/oceanGpu.test.js
git commit -m "feat(ledger-ocean): WebGL2 runner for the ocean step

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: GPU parity gate

**Files:**
- Create: `src/terminal/ledger/ocean/gpu/parityProbe.js`
- Create: `ledger-ocean-probe.html` (repository root)
- Create: `scripts/oceanParity.mjs`

**Interfaces:**
- Consumes: everything above; phase-1 `createOceanContext`, `step`, `bakeCurrents`, `buildLandMask`, `OCEAN_GRID`; `ambientSources` (Task 1); `__tests__/syntheticWorld.js` (`syntheticWorld`, `blob`).
- Produces: `runParity()` → `Promise<{ ok, cases: [{ name, ok, results: [{ step, ok, channels: [{ maxAbsCpu, maxDiff, at }] }] }] }>`; the page sets `window.__parity`; the script exits 0 only when `ok`.

Tolerances (relative to the channel's largest CPU value, floored at 1e-3): **1e-5 after step 1**, **2e-4 after the last step**. If parity fails only on tolerance (errors small and spread out, not localised at coasts/land/seams), STOP and report the numbers — do not change the tolerance.

- [ ] **Step 1: Implement `gpu/parityProbe.js`**

```js
// parityProbe.js — runs the CPU oracle and the GPU runner side by side in a
// real browser and compares their states. Dev-only (ledger-ocean-probe.html).

import { OCEAN_GRID } from '../grid';
import { buildLandMask } from '../landMask';
import { bakeCurrents } from '../streamFunction';
import { createOceanContext, step } from '../referenceStep';
import { ambientSources } from '../sources';
import { packStatic, packRows, packSources } from './gpuData';
import { createOceanGpu } from './oceanGpu';
import { syntheticWorld, blob } from '../__tests__/syntheticWorld';

const TOL_FIRST = 1e-5;
const TOL_LAST = 2e-4;
const FLOOR = 1e-3;

function compare(grid, cpu, gpu, tol) {
  const channels = [];
  let ok = true;
  for (let c = 0; c < 4; c++) {
    let maxAbsCpu = 0;
    let maxDiff = 0;
    let at = -1;
    for (let k = 0; k < grid.n; k++) {
      const a = cpu[k * 4 + c];
      const d = Math.abs(a - gpu[k * 4 + c]);
      maxAbsCpu = Math.max(maxAbsCpu, Math.abs(a));
      if (!(d <= maxDiff)) { maxDiff = d; at = k; }
    }
    const pass = maxDiff <= tol * Math.max(maxAbsCpu, FLOOR);
    ok = ok && pass;
    const i = at % grid.nx;
    const j = (at - i) / grid.nx;
    channels.push({ maxAbsCpu, maxDiff, at: at < 0 ? null : { i, j, lon: grid.lonOf(i), lat: grid.latOf(j) }, pass });
  }
  return { ok, channels };
}

function quad(gl) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return vao;
}

function runCase({ name, grid, mask, vel, init, sources, steps, diffusivity, reactions = true }) {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) throw new Error('no webgl2');
  const gpu = createOceanGpu(gl, {
    grid, staticData: packStatic(grid, mask.land, vel), rowData: packRows(grid), vao: quad(gl), diffusivity,
  });
  if (!gpu) throw new Error('no float render targets');
  gpu.setState(init);
  gpu.setSources(packSources(grid, mask.land, sources));
  const ctx = createOceanContext(grid, mask.land, vel);
  const cpu = Float32Array.from(init);
  const results = [];
  for (let s = 1; s <= steps; s++) {
    step(ctx, cpu, { sources, diffusivity, reactions });
    gpu.step({ reactions });
    if (s === 1 || s === steps) {
      results.push({ step: s, ...compare(grid, cpu, gpu.readState(), s === 1 ? TOL_FIRST : TOL_LAST) });
    }
  }
  gpu.dispose();
  return { name, ok: results.every((r) => r.ok), results };
}

function syntheticCase() {
  const { grid, mask } = syntheticWorld();
  const { vel } = bakeCurrents(grid, mask, {
    cells: [{ name: 't', lon0: 20, lon1: 120, lat0: -50, lat1: 50, sign: 1, peak: 300, eps: 0.1 }],
    acc: null,
  });
  const init = blob(grid, mask.land, 30, 16, 6, 1);
  for (let j = 13; j <= 17; j++) for (let i = 34; i <= 38; i++) init[grid.idx(i, j) * 4 + 2] = 1;
  const sources = [{ cells: [{ k: grid.idx(38, 15), f: 0.5 }], conc: [1, 2, 3, 4] }];
  return runCase({ name: 'synthetic 64x32 vortex + island, D=5e4', grid, mask, vel, init, sources, steps: 60, diffusivity: 5e4 });
}

function realCase() {
  const grid = OCEAN_GRID;
  const mask = buildLandMask(grid);
  const { vel } = bakeCurrents(grid, mask);
  const sources = ambientSources(grid, mask);
  return runCase({
    name: 'real 512x256, five preset sources', grid, mask, vel,
    init: new Float32Array(grid.n * 4), sources, steps: 40, diffusivity: undefined,
  });
}

export async function runParity() {
  const cases = [syntheticCase(), realCase()];
  return { ok: cases.every((c) => c.ok), cases };
}
```

(`diffusivity: undefined` lets both `step()` and `createOceanGpu` fall back to their shared default `EDDY_DIFFUSIVITY_KM2_DAY`.)

- [ ] **Step 2: Create `ledger-ocean-probe.html`**

```html
<!doctype html>
<!--
  LEDGER OCEAN PARITY PROBE — dev/automation only (not in the production build;
  Vite bundles only index.html). Runs the CPU oracle and the WebGL2 runner side
  by side and publishes window.__parity = { ok, cases }.
  Driven by: node scripts/oceanParity.mjs
-->
<html>
<head><meta charset="utf-8"><title>ledger ocean parity probe</title>
<style>body{background:#050505;color:#8fb;font:12px monospace;margin:12px}</style>
</head>
<body>
<pre id="out">running…</pre>
<script type="module">
import { runParity } from '/src/terminal/ledger/ocean/gpu/parityProbe.js';
const out = document.getElementById('out');
runParity()
  .then((r) => { window.__parity = r; out.textContent = JSON.stringify(r, null, 2); })
  .catch((e) => { window.__parity = { ok: false, error: String((e && e.stack) || e) }; out.textContent = window.__parity.error; });
</script>
</body>
</html>
```

- [ ] **Step 3: Create `scripts/oceanParity.mjs`**

```js
// GPU parity gate for the Ledger ocean: starts a Vite dev server, opens the
// probe page in headless Chrome (SwiftShader), prints the comparison and exits
// non-zero on any mismatch.
//
//   node scripts/oceanParity.mjs
import { createServer } from 'vite';
import { launch } from './cdp.mjs';

const server = await createServer({
  server: { port: 5199, strictPort: false, host: '127.0.0.1' },
  logLevel: 'error',
});
await server.listen();
const base = server.resolvedUrls.local[0];
let result = { ok: false, error: 'probe never reported' };
let page;
try {
  page = await launch({ url: `${base}ledger-ocean-probe.html`, width: 640, height: 480 });
  await page.waitFor('window.__parity !== undefined', { timeoutMs: 180000, label: 'parity' });
  result = JSON.parse(await page.eval('JSON.stringify(window.__parity)'));
} finally {
  if (page) await page.close();
  await server.close();
}
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
```

- [ ] **Step 4: Run the gate**

Run: `node scripts/oceanParity.mjs`
Expected: exit 0, both cases `"ok": true`. Record every channel's `maxDiff / maxAbsCpu` at step 1 and at the last step in the report. If it fails, diagnose from the `at` locations (coast? seam i=0? land? poles?) and fix the shader or runner — never the tolerance. If the failure is tolerance-only and spread out, STOP and report.

- [ ] **Step 5: Mutation checks (each must make the gate exit 1)**

1. In `FINAL_FS`, replace `clamp(s1.v, s0.lo, s0.hi)` with `s1.v`. Expected FAIL in the synthetic case (sharp pulse). Revert.
2. In `COMMON`'s `sample4`, delete `if (isLand(q)) continue;`. Expected FAIL in the real case at coastal cells. Revert.
3. In `DIFFUSE_FS`, replace the `yTerm` line with `vec4 yTerm = (N + S - 2.0 * C) / dy2;`. Expected FAIL in the synthetic case (D = 5e4). Revert.
4. In `CORRECT_FS`, change `traceFrom(c, -uDt)` to `traceFrom(c, uDt)`. Expected FAIL. Revert.

If any mutation does not fail the gate, the gate is blind to that defect: report it, and propose (do not apply) a case change that would catch it.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/ledger/ocean/gpu/parityProbe.js ledger-ocean-probe.html scripts/oceanParity.mjs
git commit -m "test(ledger-ocean): headless-Chrome GPU parity gate against the CPU oracle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The view — `LedgerOcean`

**Files:**
- Create: `src/terminal/ledger/ocean/gpu/palette.js`
- Create: `src/terminal/ledger/ocean/oceanWorld.js`
- Modify: `src/terminal/ledger/ocean/clock.js` (validate `setMaxSteps`)
- Create: `src/terminal/views/ledger/ocean/oceanDriver.js`
- Create: `src/terminal/views/ledger/ocean/LedgerOcean.jsx`
- Test: `src/terminal/ledger/ocean/__tests__/grid.test.js` (append clock tests), `src/terminal/views/ledger/ocean/__tests__/oceanDriver.test.js`, `src/terminal/views/ledger/ocean/__tests__/LedgerOcean.test.jsx`

**Interfaces:**
- Consumes: `useShaderCanvas` (`src/terminal/gl/useShaderCanvas.js`: options `version, strategy, vs, fs, uniforms, pixelSize, setStyleSize, blend, contextOptions, label, trackVisibility, watchdogMs, onInit(gl, { prog, vao, buf, canvas }), onDispose(gl), draw(host, { now, dt, tsec, hidden, reducedMotion }), onUnsupported, deps`; host = `{ gl, prog, U, vao }`); `createFloatTexture`; `createOceanGpu`; `SIM_VS, COMPOSITE_FS, COMPOSITE_UNIFORMS`; `createStepClock`; `DT_DAYS`.
- Produces:
  - `OCEAN_EXPOSURE = { ref: [4], gain: [4], rim, aberration }`
  - `getOceanWorld()` → memoised `{ grid, mask, vel, sources, staticData, rowData, ambientSourceData }`
  - `REDUCED_MOTION_DAYS = 200`; `createOceanDriver({ clock, step, dtDays = DT_DAYS })` → `{ advance(dtSec, daysPerSecond) → steps, warmupOnce(days) → steps, simDays() }`
  - `<LedgerOcean width height daysPerSecond={9} onFrame={(simDays) => …} />`

- [ ] **Step 1: Write the failing tests**

Append to `src/terminal/ledger/ocean/__tests__/grid.test.js` inside `describe('createStepClock', …)`:

```js
  it('ignores an invalid step cap', () => {
    const clock = createStepClock({ maxSteps: 8 });
    clock.setMaxSteps(NaN);
    clock.setMaxSteps(-3);
    clock.setMaxSteps(2.5);
    expect(clock.advance(1000, 30)).toBe(8);
  });

  it('reset() drops the fractional remainder; custom dtDays is honoured', () => {
    const clock = createStepClock({ dtDays: 1 });
    expect(clock.advance(500, 1.5)).toBe(0);   // 0.75 d accumulated
    clock.reset();
    expect(clock.advance(250, 1.5)).toBe(0);   // 0.375 d, not 1.125
    expect(createStepClock({ dtDays: 1 }).advance(1000, 3)).toBe(3);
  });
```

`src/terminal/views/ledger/ocean/__tests__/oceanDriver.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createStepClock } from '../../../../ledger/ocean/clock';
import { createOceanDriver, REDUCED_MOTION_DAYS } from '../oceanDriver';

const counting = () => {
  let n = 0;
  return { step: () => { n++; }, count: () => n };
};

describe('createOceanDriver', () => {
  it('turns wall seconds into clock steps and counts simulated days', () => {
    const s = counting();
    const d = createOceanDriver({ clock: createStepClock(), step: s.step });
    let total = 0;
    for (let f = 0; f < 60; f++) total += d.advance(1 / 60, 9);
    expect(total).toBe(36);
    expect(s.count()).toBe(36);
    expect(d.simDays()).toBeCloseTo(9, 9);
  });

  it('warms up once for reduced motion', () => {
    const s = counting();
    const d = createOceanDriver({ clock: createStepClock(), step: s.step });
    expect(d.warmupOnce(REDUCED_MOTION_DAYS)).toBe(800);
    expect(d.warmupOnce(REDUCED_MOTION_DAYS)).toBe(0);
    expect(s.count()).toBe(800);
    expect(d.simDays()).toBeCloseTo(200, 9);
  });
});
```

`src/terminal/views/ledger/ocean/__tests__/LedgerOcean.test.jsx`:

```jsx
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { installRecordingGL } from '../../../../gl/__tests__/recordingGL';
import LedgerOcean from '../LedgerOcean';

let rec = null;
afterEach(() => {
  cleanup();
  rec?.restore();
  rec = null;
  vi.restoreAllMocks();
});

describe('LedgerOcean', () => {
  it('runs the GPU ocean when float targets exist', () => {
    rec = installRecordingGL({ version: 2, extensions: ['EXT_color_buffer_float'] });
    render(<LedgerOcean width={512} height={256} />);
    expect(screen.getByLabelText(/Ledger ocean/)).toBeTruthy();
    expect(screen.queryByText(/STATIC · NO FLOAT TARGETS/)).toBeNull();
    expect(rec.log.some((e) => e[0] === 'framebufferTexture2D')).toBe(true);
    expect(rec.log.some((e) => e[0] === 'drawArrays')).toBe(true);
  });

  it('falls back to a static coastline without float targets', () => {
    rec = installRecordingGL({ version: 2 });
    render(<LedgerOcean width={512} height={256} />);
    expect(screen.getByText('STATIC · NO FLOAT TARGETS')).toBeTruthy();
    expect(rec.log.some((e) => e[0] === 'framebufferTexture2D')).toBe(false);
    expect(rec.log.some((e) => e[0] === 'drawArrays')).toBe(true);
  });

  it('says so when there is no WebGL2 at all', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    render(<LedgerOcean width={512} height={256} />);
    expect(screen.getByText('OCEAN UNAVAILABLE · NO WEBGL2')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/grid.test.js src/terminal/views/ledger/ocean`
Expected: FAIL — the invalid-cap test fails (NaN cap disables capping), and the two new files cannot resolve their modules.

- [ ] **Step 3: Validate `setMaxSteps` in `clock.js`**

Replace the body of `setMaxSteps(m)` with:

```js
      if (Number.isInteger(m) && m > 0) cap = m;
```

- [ ] **Step 4: Create `gpu/palette.js`**

```js
// palette.js — composite exposure. Starting values; Task 8's visual review
// with the user tunes them. ref: concentration at which a channel's log
// exposure reaches ln 2 × gain. Channels: ΔT (°C), BOD, NO₃, deficit (mg/L).
export const OCEAN_EXPOSURE = {
  ref: [0.005, 0.002, 0.01, 0.01],
  gain: [0.35, 0.35, 0.35, 0.6],
  rim: 1.0,
  aberration: 0.35,
};
```

- [ ] **Step 5: Create `oceanWorld.js`**

```js
// oceanWorld.js — the static ocean (grid, coastline, currents, packed GPU
// data, ambient preset sources), built once per session. The bake is ~0.3 s
// on a desktop; memoising keeps tab switches free.

import { OCEAN_GRID } from './grid';
import { buildLandMask } from './landMask';
import { bakeCurrents } from './streamFunction';
import { ambientSources } from './sources';
import { packStatic, packRows, packSources } from './gpu/gpuData';

let cached = null;

export function getOceanWorld() {
  if (cached) return cached;
  const grid = OCEAN_GRID;
  const mask = buildLandMask(grid);
  const { vel } = bakeCurrents(grid, mask);
  const sources = ambientSources(grid, mask);
  cached = {
    grid, mask, vel, sources,
    staticData: packStatic(grid, mask.land, vel),
    rowData: packRows(grid),
    ambientSourceData: packSources(grid, mask.land, sources),
  };
  return cached;
}
```

- [ ] **Step 6: Create `views/ledger/ocean/oceanDriver.js`**

```js
// oceanDriver.js — turns frame time into ocean steps. Wall time only (via the
// step clock), never frame counts. Reduced motion runs a one-off warm-up so
// the frozen frame shows a settled ocean, not an empty one.

import { DT_DAYS } from '../../../ledger/ocean/grid';

export const REDUCED_MOTION_DAYS = 200;

export function createOceanDriver({ clock, step, dtDays = DT_DAYS }) {
  let days = 0;
  let warmed = false;
  const run = (n) => {
    for (let s = 0; s < n; s++) step();
    days += n * dtDays;
    return n;
  };
  return {
    advance(dtSec, daysPerSecond) {
      return run(clock.advance(dtSec * 1000, daysPerSecond));
    },
    warmupOnce(targetDays) {
      if (warmed) return 0;
      warmed = true;
      return run(Math.round(targetDays / dtDays));
    },
    simDays() {
      return days;
    },
  };
}
```

- [ ] **Step 7: Create `views/ledger/ocean/LedgerOcean.jsx`**

```jsx
// LedgerOcean.jsx — the Ledger ocean: WebGL2 advection of audited discharge,
// composited on the shared harness. The sim runs inside onInit/draw; the
// ledger is never written. Without float render targets it draws the static
// coastline only; without WebGL2 it says so.

import { useMemo, useRef, useState } from 'react';
import { useShaderCanvas } from '../../../gl/useShaderCanvas';
import { createFloatTexture } from '../../../gl/pingPong';
import { getOceanWorld } from '../../../ledger/ocean/oceanWorld';
import { createOceanGpu } from '../../../ledger/ocean/gpu/oceanGpu';
import { SIM_VS, COMPOSITE_FS, COMPOSITE_UNIFORMS } from '../../../ledger/ocean/gpu/shaders';
import { OCEAN_EXPOSURE } from '../../../ledger/ocean/gpu/palette';
import { createStepClock } from '../../../ledger/ocean/clock';
import { createOceanDriver, REDUCED_MOTION_DAYS } from './oceanDriver';

const CONTEXT_OPTIONS = { alpha: false, antialias: false, premultipliedAlpha: false };

export default function LedgerOcean({ width, height, daysPerSecond = 9, onFrame = null }) {
  const canvasRef = useRef(null);
  const world = useMemo(() => getOceanWorld(), []);
  const simRef = useRef(null);
  const driverRef = useRef(null);
  const texRef = useRef(null);
  const dpsRef = useRef(daysPerSecond);
  dpsRef.current = daysPerSecond;
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const [mode, setMode] = useState('live'); // 'live' | 'static' | 'unsupported'

  useShaderCanvas(canvasRef, {
    version: 2,
    strategy: 'lunar',
    vs: SIM_VS,
    fs: COMPOSITE_FS,
    uniforms: COMPOSITE_UNIFORMS,
    pixelSize: { w: width, h: height },
    setStyleSize: true,
    blend: 'none',
    contextOptions: CONTEXT_OPTIONS,
    label: 'LedgerOcean',
    trackVisibility: true,
    onInit: (gl, { vao }) => {
      const { grid } = world;
      const sim = createOceanGpu(gl, { grid, staticData: world.staticData, rowData: world.rowData, vao });
      if (sim) {
        sim.setSources(world.ambientSourceData);
        simRef.current = sim;
        driverRef.current = createOceanDriver({ clock: createStepClock(), step: () => sim.step() });
        texRef.current = { static: sim.staticTexture(), zero: null };
      } else {
        texRef.current = {
          static: createFloatTexture(gl, grid.nx, grid.ny, world.staticData),
          zero: createFloatTexture(gl, grid.nx, grid.ny, new Float32Array(grid.n * 4)),
        };
        setMode('static');
      }
    },
    onDispose: (gl) => {
      simRef.current?.dispose();
      if (texRef.current?.zero) {
        gl.deleteTexture(texRef.current.zero);
        gl.deleteTexture(texRef.current.static);
      }
      simRef.current = null;
      driverRef.current = null;
      texRef.current = null;
    },
    draw: (host, { dt, tsec, hidden, reducedMotion }) => {
      const { gl, prog, U, vao } = host;
      const sim = simRef.current;
      const driver = driverRef.current;
      if (driver) {
        if (reducedMotion) driver.warmupOnce(REDUCED_MOTION_DAYS);
        else if (!hidden) driver.advance(dt, dpsRef.current);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.useProgram(prog);
      gl.bindVertexArray(vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sim ? sim.stateTexture() : texRef.current.zero);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, texRef.current.static);
      gl.uniform1i(U.uState, 0);
      gl.uniform1i(U.uStatic, 1);
      gl.uniform2f(U.uGrid, world.grid.nx, world.grid.ny);
      gl.uniform2f(U.uRes, gl.canvas.width, gl.canvas.height);
      gl.uniform1f(U.uTime, tsec);
      const { ref, gain, rim, aberration } = OCEAN_EXPOSURE;
      gl.uniform4f(U.uRef, ref[0], ref[1], ref[2], ref[3]);
      gl.uniform4f(U.uGain, gain[0], gain[1], gain[2], gain[3]);
      gl.uniform1f(U.uRim, rim);
      gl.uniform1f(U.uAberration, aberration);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      onFrameRef.current?.(driver ? driver.simDays() : 0);
    },
    onUnsupported: () => setMode('unsupported'),
    deps: [width, height],
  });

  return (
    <div style={{ position: 'relative', width, height, background: '#050505' }}>
      <canvas
        ref={canvasRef}
        aria-label="Ledger ocean: advection of audited discharge"
        style={{ display: mode === 'unsupported' ? 'none' : 'block', width, height }}
      />
      {mode !== 'live' && (
        <div
          style={{ position: 'absolute', left: 8, bottom: 6, font: '9px monospace', letterSpacing: '0.2em', color: 'rgba(20,184,166,0.55)' }}
        >
          {mode === 'static' ? 'STATIC · NO FLOAT TARGETS' : 'OCEAN UNAVAILABLE · NO WEBGL2'}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/grid.test.js src/terminal/views/ledger/ocean`
Expected: PASS, with pristine output (no "Not implemented: getContext" noise — the third test mocks `getContext`). If a React warning appears (e.g. setState during render), fix the component, not the test.

- [ ] **Step 9: Mutation checks**

1. In `LedgerOcean.jsx`'s `onInit`, replace `if (sim) {` with `if (false) {`. "runs the GPU ocean when float targets exist" must FAIL. Revert.
2. In `oceanDriver.js`, delete `warmed = true;`. "warms up once" must FAIL. Revert.

- [ ] **Step 10: Commit**

```bash
git add src/terminal/ledger/ocean/gpu/palette.js src/terminal/ledger/ocean/oceanWorld.js src/terminal/ledger/ocean/clock.js src/terminal/ledger/ocean/__tests__/grid.test.js src/terminal/views/ledger/ocean
git commit -m "feat(ledger-ocean): LedgerOcean view on the shared harness, driver and static fallback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Preview page, screenshots, and the user's visual review

**Files:**
- Create: `src/terminal/views/ledger/ocean/previewMain.jsx`
- Create: `ledger-ocean-preview.html` (repository root)
- Create: `scripts/oceanShots.mjs`

**Interfaces:**
- Consumes: `LedgerOcean` (Task 7), `scripts/cdp.mjs` `launch({ url, width, height, dpr })` → page with `eval`, `waitFor`, `screenshot({ path, clip })`, `close`.
- Produces: PNGs in an output directory (default `<os tmpdir>/ledger-ocean-shots`), printed paths, and `window.__ocean = { ready, simDays }` on the preview page.

- [ ] **Step 1: Create the preview entry and page**

`src/terminal/views/ledger/ocean/previewMain.jsx`:

```jsx
// Dev-only preview for the Ledger ocean (ledger-ocean-preview.html).
// Query: ?w=1024 (canvas CSS width; height = w/2) &dps=9 (simulated days per second).
import { createRoot } from 'react-dom/client';
import LedgerOcean from './LedgerOcean';

const q = new URLSearchParams(window.location.search);
const w = Number(q.get('w') || 1024);
const dps = Number(q.get('dps') || 9);
window.__ocean = { ready: false, simDays: 0 };

createRoot(document.getElementById('root')).render(
  <LedgerOcean
    width={w}
    height={w / 2}
    daysPerSecond={dps}
    onFrame={(d) => { window.__ocean.ready = true; window.__ocean.simDays = d; }}
  />,
);
```

`ledger-ocean-preview.html`:

```html
<!doctype html>
<!--
  LEDGER OCEAN PREVIEW — dev only (not in the production build). Mounts
  <LedgerOcean> standalone so the ocean can be reviewed before phase 3 puts it
  in the Ledger tab. Query: ?w=1024&dps=9. Publishes window.__ocean.
-->
<html>
<head><meta charset="utf-8"><title>ledger ocean preview</title>
<style>html,body{margin:0;background:#050505}#root{padding:16px}</style>
</head>
<body>
<div id="root"></div>
<script type="module" src="/src/terminal/views/ledger/ocean/previewMain.jsx"></script>
</body>
</html>
```

- [ ] **Step 2: Create `scripts/oceanShots.mjs`**

```js
// Screenshots of the Ledger ocean preview for visual review (headless Chrome,
// SwiftShader, DPR 2). Captures the whole world at three moments and crops of
// the four Courant hotspots and the five preset mouths.
//
//   node scripts/oceanShots.mjs [outDir] [dps]
import { createServer } from 'vite';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch } from './cdp.mjs';

const OUT = process.argv[2] || join(tmpdir(), 'ledger-ocean-shots');
const DPS = Number(process.argv[3] || 30);
const W = 1024;
const PAD = 16;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// lon/lat → CSS px inside the page (canvas at PAD, PAD; W × W/2; north up).
const toPx = (lon, lat) => [PAD + ((lon + 180) / 360) * W, PAD + ((90 - lat) / 180) * (W / 2)];
const CROPS = {
  'strait-la-perouse': [142.4, 45.4], 'strait-taiwan': [119.9, 24.9],
  'strait-korea': [129.7, 34.8], 'strait-cook': [174.5, -41.5],
  'mouth-mississippi': [-89.25, 29.15], 'mouth-rhine': [4.13, 51.98],
  'mouth-bistrice': [20.03, 39.84], 'mouth-rio-doce': [-39.81, -19.66],
  'mouth-hamhung': [127.6, 39.8],
};

await mkdir(OUT, { recursive: true });
const server = await createServer({ server: { port: 5198, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
let page;
try {
  page = await launch({ url: `${base}ledger-ocean-preview.html?w=${W}&dps=${DPS}`, width: W + 2 * PAD, height: W / 2 + 2 * PAD, dpr: 2 });
  await page.waitFor('window.__ocean && window.__ocean.ready', { timeoutMs: 60000, label: 'ocean ready' });
  const full = { x: PAD, y: PAD, width: W, height: W / 2 };
  let waited = 0;
  for (const wallS of [0, 5, 15]) {
    await sleep((wallS - waited) * 1000);
    waited = wallS;
    const days = await page.eval('window.__ocean.simDays');
    const path = join(OUT, `world-t${wallS}s-${Math.round(days)}d.png`);
    await page.screenshot({ path, clip: full });
    console.log(path);
  }
  for (const [name, [lon, lat]] of Object.entries(CROPS)) {
    const [x, y] = toPx(lon, lat);
    const clip = {
      x: Math.min(PAD + W - 120, Math.max(PAD, Math.round(x - 60))),
      y: Math.min(PAD + W / 2 - 80, Math.max(PAD, Math.round(y - 40))),
      width: 120,
      height: 80,
    };
    const path = join(OUT, `${name}.png`);
    await page.screenshot({ path, clip });
    console.log(path);
  }
} finally {
  if (page) await page.close();
  await server.close();
}
process.exit(0);
```

- [ ] **Step 3: Capture**

Run: `node scripts/oceanShots.mjs`
Expected: 12 PNG paths printed (3 world frames, 9 crops); `world-t15s-*.png` shows ~450 simulated days. Open every PNG (Read tool) and describe in the report, factually: whether plumes leave all five mouths, the colour sequence away from each mouth (crimson → amber → green), the Mississippi deficit void and cyan rim, what the four strait crops show, any banding, seams at the date line, or coastal dark halos. Do not tune `palette.js` in this task.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/views/ledger/ocean/previewMain.jsx ledger-ocean-preview.html scripts/oceanShots.mjs
git commit -m "chore(ledger-ocean): dev preview page and CDP screenshot script

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: STOP — the user's visual review**

The controller shows the screenshots to the user. Palette values, exposure, rim and aberration are tuned only on the user's direction, in follow-up commits to `gpu/palette.js` (and `COMPOSITE_FS` colour constants if asked), each re-captured with `scripts/oceanShots.mjs`. The phase gate (Task 9) runs after the user signs off on the look.

---

### Task 9: Phase gate

**Files:** none (verification only).

- [ ] **Step 1: Suite and lint**

Run: `npm test` — all green except the known `artComposite.test.js` failure (if still present on this branch).
Run: `npm run lint` — 0 errors, warnings ≤ 143.

- [ ] **Step 2: Real-GPU gates**

Run: `node scripts/oceanShaders.mjs` — exit 0.
Run: `node scripts/oceanParity.mjs` — exit 0; record final-step relative errors per channel.

- [ ] **Step 3: Boundary checks**

Run: `git diff --stat main...HEAD -- src/terminal/views/LedgerTab.jsx src/terminal/views/ledger/AuditCascade.jsx src/terminal/views/ledger/LedgerMap.jsx src/terminal/views/ledger/SubmissionForm.jsx src/terminal/ledger/auditPresets.js src/terminal/ledger/verdictStore.js src/terminal/ledger/ledgerBus.js src/terminal/gl/__tests__/__snapshots__`
Expected: empty output.

- [ ] **Step 4: Report**

Report: test count, lint count, parity numbers, shader-check result, the user's visual sign-off (with the final palette values), and every mutation that unexpectedly did NOT fail. Do not push.

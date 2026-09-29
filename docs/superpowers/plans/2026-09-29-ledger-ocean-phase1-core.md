# Ledger Ocean — Phase 1 (Pure Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the GL-free, jsdom-testable core of the Ledger ocean: grid, clock, kinetics, land mask, currents, source building, and a CPU reference step that later phases' shaders are verified against.

**Architecture:** Pure ES modules under `src/terminal/ledger/ocean/`. Every function takes a `grid` object (from `makeGrid`) so tests run on a tiny 64×32 world while production uses 512×256. No React, no WebGL, no UI changes in this phase. State layout is interleaved RGBA float (`[ΔT, BOD, NO₃, deficit]` per cell), exactly the GPU texel layout phase 2 will use.

**Tech Stack:** plain JS (ESM), vitest 4, `topojson-client` + `world-atlas/land-110m.json` (both already dependencies).

**Spec:** `docs/superpowers/specs/2026-09-29-ledger-ocean-advection-design.md`. Phases 2 (GL ocean) and 3 (integration) get their own plans after this one lands; they build on the interfaces listed in each task below.

## Global Constraints

- Grid 512×256, equirectangular, row 0 = southernmost, columns wrap east–west; simulated band 78°S–78°N (poleward rows are land).
- Fixed Δt = 0.25 simulated days. Nothing is frame-counted.
- All rates are per simulated day. Velocities are km/day.
- Channel order everywhere: `0 ΔT (°C)`, `1 BOD L (mg/L)`, `2 nitrate N (mg/L)`, `3 oxygen deficit D (mg/L)`.
- Every pass ends: NaN → 0, clamp ≥ 0, land cells = 0. Deficit capped at DO_sat.
- The sim never writes to the ledger. No file in this phase imports from `verdictStore`, `ledgerBus`, or any view.
- **Mutation rule:** every test task includes a step that breaks the implementation on purpose and confirms the test FAILS, then reverts. A test that cannot fail does not count. After reverting, `git diff` on the source file must be empty relative to the pre-mutation version.
- Test command for a single file: `npx vitest run <path>`. Full suite: `npm test`. Lint: `npm run lint`.
- Commits end with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.

## File Structure

| File | Responsibility |
|---|---|
| `src/terminal/ledger/ocean/grid.js` | `makeGrid`, `OCEAN_GRID`, constants (`R_EARTH_KM`, `LAT_LIMIT`, `DT_DAYS`) |
| `src/terminal/ledger/ocean/clock.js` | `createStepClock` — wall time → whole sim steps, capped |
| `src/terminal/ledger/ocean/kinetics.js` | rate constants, exact sag step, critical time, DO_sat, Manning, O'Connor–Dobbins, SST climatology, river state |
| `src/terminal/ledger/ocean/landMask.js` | rasteriser, component labelling, coast distance, `snapToOcean`, `buildLandMask` |
| `src/terminal/ledger/ocean/streamFunction.js` | gyre/ACC definitions, ψ on corners, Arakawa-C faces, cell-centre velocities |
| `src/terminal/ledger/ocean/referenceStep.js` | CPU oracle: BFECC+limiter advection, diffusion, reaction, injection, guards, `step` |
| `src/terminal/ledger/ocean/sources.js` | course length, splat dimensioning, `buildSource`, verdict/ghost adapters |
| `src/terminal/ledger/ocean/__tests__/*.test.js` | one test file per module |
| `src/terminal/ledger/ocean/__tests__/syntheticWorld.js` | 64×32 test world helpers |

---

### Task 1: Grid and step clock

**Files:**
- Create: `src/terminal/ledger/ocean/grid.js`
- Create: `src/terminal/ledger/ocean/clock.js`
- Test: `src/terminal/ledger/ocean/__tests__/grid.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `R_EARTH_KM = 6371`, `LAT_LIMIT = 78`, `DT_DAYS = 0.25`
  - `makeGrid(nx = 512, ny = nx / 2)` → frozen `{ nx, ny, n, dlon, dlat, cellKm, wrapI(i), idx(i, j), latOf(j), lonOf(i), cosLat: Float64Array(ny), lonLatToCell(lon, lat) → { i, j } }`. Throws unless `ny * 2 === nx`.
  - `OCEAN_GRID = makeGrid(512, 256)`
  - `createStepClock({ dtDays = DT_DAYS, maxSteps = 8 })` → `{ advance(wallMs, daysPerSecond) → integer steps, setMaxSteps(m), reset() }`

- [ ] **Step 1: Write the failing test**

`src/terminal/ledger/ocean/__tests__/grid.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { makeGrid, OCEAN_GRID, DT_DAYS } from '../grid';
import { createStepClock } from '../clock';

describe('makeGrid', () => {
  it('512×256 cells are square and ~78 km', () => {
    expect(OCEAN_GRID.nx).toBe(512);
    expect(OCEAN_GRID.ny).toBe(256);
    expect(OCEAN_GRID.n).toBe(512 * 256);
    expect(OCEAN_GRID.cellKm).toBeCloseTo(78.18, 1);
    expect(OCEAN_GRID.dlon).toBe(OCEAN_GRID.dlat);
  });

  it('rejects non-square cells', () => {
    expect(() => makeGrid(64, 40)).toThrow();
  });

  it('wraps columns east–west and clamps rows', () => {
    const g = makeGrid(64, 32);
    expect(g.wrapI(-1)).toBe(63);
    expect(g.wrapI(64)).toBe(0);
    expect(g.idx(-1, 0)).toBe(63);
    expect(g.lonLatToCell(179.99, 0).i).toBe(63);
    expect(g.lonLatToCell(-180, 0).i).toBe(0);
    expect(g.lonLatToCell(180, 0).i).toBe(0);
    expect(g.lonLatToCell(0, 95).j).toBe(31);
    expect(g.lonLatToCell(0, -95).j).toBe(0);
  });

  it('row 0 is the southernmost row; cosLat matches latOf', () => {
    const g = makeGrid(64, 32);
    expect(g.latOf(0)).toBeCloseTo(-87.1875, 9);
    expect(g.latOf(31)).toBeCloseTo(87.1875, 9);
    expect(g.lonOf(0)).toBeCloseTo(-177.1875, 9);
    expect(g.cosLat[16]).toBeCloseTo(Math.cos((g.latOf(16) * Math.PI) / 180), 12);
  });
});

describe('createStepClock', () => {
  const run = (hz, seconds, daysPerSecond) => {
    const clock = createStepClock({ maxSteps: 8 });
    let total = 0;
    const frames = Math.round(hz * seconds);
    for (let f = 0; f < frames; f++) total += clock.advance(1000 / hz, daysPerSecond);
    return total;
  };

  it('covers the same simulated time at 60 Hz, 144 Hz and 360 Hz', () => {
    expect(DT_DAYS).toBe(0.25);
    expect(run(60, 1, 9)).toBe(36);
    expect(run(360, 1, 9)).toBe(36);
    expect(run(144, 2.5, 3)).toBe(30);
  });

  it('caps one frame at maxSteps and drops the backlog instead of replaying it', () => {
    const clock = createStepClock({ maxSteps: 8 });
    expect(clock.advance(1000, 30)).toBe(8);
    expect(clock.advance(1, 30)).toBe(0);
    clock.setMaxSteps(4);
    expect(clock.advance(1000, 30)).toBe(4);
  });

  it('ignores non-positive and non-finite input', () => {
    const clock = createStepClock();
    expect(clock.advance(0, 9)).toBe(0);
    expect(clock.advance(-5, 9)).toBe(0);
    expect(clock.advance(NaN, 9)).toBe(0);
    expect(clock.advance(16, 0)).toBe(0);
    expect(clock.advance(16, Infinity)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/grid.test.js`
Expected: FAIL — cannot resolve `../grid`.

- [ ] **Step 3: Implement `grid.js`**

```js
// grid.js — the Ledger ocean's equirectangular grid.
// Row 0 is the southernmost row (matches the GL texture origin); columns wrap
// east–west. Cells are square in km only when ny = nx / 2, which is enforced.

export const R_EARTH_KM = 6371;
export const LAT_LIMIT = 78;
export const DT_DAYS = 0.25;

export function makeGrid(nx = 512, ny = nx / 2) {
  if (ny * 2 !== nx) throw new Error(`makeGrid: ny must be nx / 2 (got ${nx}×${ny})`);
  const dlon = 360 / nx;
  const dlat = 180 / ny;
  const cellKm = (2 * Math.PI * R_EARTH_KM) / nx;
  const wrapI = (i) => ((i % nx) + nx) % nx;
  const idx = (i, j) => j * nx + wrapI(i);
  const latOf = (j) => -90 + (j + 0.5) * dlat;
  const lonOf = (i) => -180 + (i + 0.5) * dlon;
  const cosLat = new Float64Array(ny);
  for (let j = 0; j < ny; j++) cosLat[j] = Math.cos((latOf(j) * Math.PI) / 180);
  const lonLatToCell = (lon, lat) => ({
    i: wrapI(Math.floor((lon + 180) / dlon)),
    j: Math.min(ny - 1, Math.max(0, Math.floor((lat + 90) / dlat))),
  });
  return Object.freeze({ nx, ny, n: nx * ny, dlon, dlat, cellKm, wrapI, idx, latOf, lonOf, cosLat, lonLatToCell });
}

export const OCEAN_GRID = makeGrid(512, 256);
```

- [ ] **Step 4: Implement `clock.js`**

```js
// clock.js — converts wall time into whole simulation steps.
// Simulated time accumulates from wall milliseconds × compression, never from
// frame counts, so 60 Hz and 360 Hz displays advance the ocean identically.
// When one frame owes more than maxSteps, the backlog is dropped: under load
// the ocean slows down rather than spiralling.

import { DT_DAYS } from './grid';

export function createStepClock({ dtDays = DT_DAYS, maxSteps = 8 } = {}) {
  let accDays = 0;
  let cap = maxSteps;
  return {
    advance(wallMs, daysPerSecond) {
      if (!(wallMs > 0) || !(daysPerSecond > 0) || !Number.isFinite(wallMs) || !Number.isFinite(daysPerSecond)) return 0;
      accDays += (wallMs / 1000) * daysPerSecond;
      const steps = Math.floor(accDays / dtDays + 1e-9);
      accDays = Math.max(0, accDays - steps * dtDays);
      if (steps > cap) {
        accDays = 0;
        return cap;
      }
      return steps;
    },
    setMaxSteps(m) {
      cap = m;
    },
    reset() {
      accDays = 0;
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/grid.test.js`
Expected: PASS (7 tests).

- [ ] **Step 6: Mutation check**

In `clock.js`, temporarily replace the body of `advance` after the guard with `return 1;` (a frame-counted clock). Run the test: the "same simulated time" test must FAIL (60 ≠ 360). Revert.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/ledger/ocean/grid.js src/terminal/ledger/ocean/clock.js src/terminal/ledger/ocean/__tests__/grid.test.js
git commit -m "feat(ledger-ocean): grid and wall-time step clock

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Kinetics

**Files:**
- Create: `src/terminal/ledger/ocean/kinetics.js`
- Test: `src/terminal/ledger/ocean/__tests__/kinetics.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Constants: `TAU_T_DAYS = 3`, `TAU_N_DAYS = 60`, `K_D20 = 0.23`, `THETA_D = 1.047`, `THETA_A = 1.024`, `K_A_OCEAN20 = 0.2`
  - `kd(tempC)`, `kaOcean(tempC)`, `kaRiver(velocityMs, depthM, tempC)` → 1/day
  - `manningVelocity({ n, R, S })` → m/s
  - `doSat(tempC)` → mg/L
  - `sstClimatology(latDeg)` → °C
  - `sagStep(L0, D0, kd, ka, tDays)` → `{ L, D }` (exact)
  - `criticalTime(L0, D0, kd, ka)` → days ≥ 0
  - `riverState(kernel, tDays, { velocityMs, depthM })` → `{ dT, L, N, D }` where `kernel = { temp, do, bod, dt, nitrate }` (numbers)

- [ ] **Step 1: Write the failing test**

`src/terminal/ledger/ocean/__tests__/kinetics.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  kd, kaRiver, manningVelocity, doSat, sstClimatology,
  sagStep, criticalTime, riverState, TAU_N_DAYS,
} from '../kinetics';

// Reference integrator: classical RK4 on dL/dt = -kd L, dD/dt = kd L - ka D.
function rk4Sag(L0, D0, kdv, kav, t, hTarget = 1e-3) {
  const n = Math.max(1, Math.round(t / hTarget));
  const h = t / n;
  const f = (L, D) => [-kdv * L, kdv * L - kav * D];
  let L = L0;
  let D = D0;
  for (let s = 0; s < n; s++) {
    const [a1, b1] = f(L, D);
    const [a2, b2] = f(L + (h / 2) * a1, D + (h / 2) * b1);
    const [a3, b3] = f(L + (h / 2) * a2, D + (h / 2) * b2);
    const [a4, b4] = f(L + h * a3, D + h * b3);
    L += (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
    D += (h / 6) * (b1 + 2 * b2 + 2 * b3 + b4);
  }
  return { L, D };
}

const close = (a, b, rel = 1e-6) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(b));

describe('sagStep', () => {
  it.each([
    ['ka > kd', 30, 2, 0.23, 0.6, 5],
    ['ka = kd (degenerate)', 30, 2, 0.3, 0.3, 5],
    ['ka < kd', 30, 2, 0.5, 0.1, 10],
    ['no BOD, deficit only', 0, 4, 0.23, 0.2, 3],
  ])('matches RK4 (%s)', (_label, L0, D0, kdv, kav, t) => {
    const exact = sagStep(L0, D0, kdv, kav, t);
    const ref = rk4Sag(L0, D0, kdv, kav, t);
    expect(close(exact.L, ref.L)).toBe(true);
    expect(close(exact.D, ref.D)).toBe(true);
  });

  it('is continuous through the degenerate case', () => {
    const at = sagStep(30, 2, 0.3, 0.3, 5).D;
    expect(Math.abs(sagStep(30, 2, 0.3, 0.3 * (1 + 1e-7), 5).D - at)).toBeLessThan(1e-9);
    expect(Math.abs(sagStep(30, 2, 0.3, 0.3 * (1 - 1e-7), 5).D - at)).toBeLessThan(1e-9);
  });

  it('stays finite for long times with ka << kd', () => {
    const s = sagStep(30, 2, 1, 0.2, 1000);
    expect(Number.isFinite(s.L)).toBe(true);
    expect(Number.isFinite(s.D)).toBe(true);
    expect(s.D).toBeCloseTo(0, 12);
  });
});

describe('criticalTime', () => {
  const numericArgmax = (L0, D0, kdv, kav) => {
    let best = 0;
    let bestD = -Infinity;
    for (let t = 0; t <= 60; t += 1e-3) {
      const { D } = sagStep(L0, D0, kdv, kav, t);
      if (D > bestD) { bestD = D; best = t; }
    }
    return best;
  };

  it.each([
    [30, 2, 0.23, 0.6],
    [30, 2, 0.3, 0.3],
    [30, 2, 0.5, 0.1],
    [1, 8, 0.23, 0.6],
  ])('matches the numerical maximum (L0=%s D0=%s kd=%s ka=%s)', (L0, D0, kdv, kav) => {
    expect(Math.abs(criticalTime(L0, D0, kdv, kav) - numericArgmax(L0, D0, kdv, kav))).toBeLessThan(2e-3);
  });

  it('is 0 without BOD', () => {
    expect(criticalTime(0, 3, 0.23, 0.6)).toBe(0);
  });
});

describe('rate helpers', () => {
  it('DO saturation follows Benson–Krause', () => {
    expect(doSat(0)).toBeCloseTo(14.62, 1);
    expect(doSat(20)).toBeCloseTo(9.09, 1);
    expect(doSat(30)).toBeCloseTo(7.56, 1);
  });

  it('BOD decay is theta-corrected', () => {
    expect(kd(20)).toBeCloseTo(0.23, 12);
    expect(kd(30)).toBeCloseTo(0.23 * 1.047 ** 10, 12);
  });

  it('Manning velocity and O\'Connor–Dobbins reaeration', () => {
    const v = manningVelocity({ n: 0.03, R: 6, S: 7e-5 });
    expect(v).toBeCloseTo(0.9208, 3);
    expect(kaRiver(v, 6, 20)).toBeCloseTo((3.93 * Math.sqrt(v)) / 6 ** 1.5, 12);
  });

  it('SST climatology spans tropical to polar', () => {
    expect(sstClimatology(0)).toBeCloseTo(28, 9);
    expect(sstClimatology(78)).toBeLessThan(5);
    expect(sstClimatology(-40)).toBeCloseTo(sstClimatology(40), 12);
  });
});

describe('riverState', () => {
  const kernel = { temp: 12, do: 9.5, bod: 6, dt: 3.5, nitrate: 18 };
  const hyd = { velocityMs: 1, depthM: 6 };

  it('starts at the kernel inputs', () => {
    const s = riverState(kernel, 0, hyd);
    expect(s.dT).toBe(3.5);
    expect(s.L).toBe(6);
    expect(s.N).toBe(18);
    expect(s.D).toBeCloseTo(Math.max(0, doSat(12) - 9.5), 12);
  });

  it('Danube worked example: ~25 d leaves a few % of BOD and ~2/3 of nitrate', () => {
    const s = riverState(kernel, 24.7, hyd);
    expect(s.L / kernel.bod).toBeLessThan(0.03);
    expect(s.N / kernel.nitrate).toBeCloseTo(Math.exp(-24.7 / TAU_N_DAYS), 12);
    expect(s.N / kernel.nitrate).toBeGreaterThan(0.6);
  });

  it('never reports a negative deficit for supersaturated input, never exceeds DO_sat', () => {
    expect(riverState({ ...kernel, do: 14 }, 0, hyd).D).toBe(0);
    const heavy = riverState({ ...kernel, bod: 100, do: 1 }, 10, { velocityMs: 0.1, depthM: 20 });
    expect(heavy.D).toBeLessThanOrEqual(doSat(12));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/kinetics.test.js`
Expected: FAIL — cannot resolve `../kinetics`.

- [ ] **Step 3: Implement `kinetics.js`**

```js
// kinetics.js — the shared reaction model of the river stage and every ocean
// cell. Rates are per simulated day. Constants are literature ranges, not
// per-site measurements (HUD legend: MODEL KINETICS · LITERATURE RANGES).

export const TAU_T_DAYS = 3;      // thermal excess e-folding time
export const TAU_N_DAYS = 60;     // nitrate uptake e-folding time
export const K_D20 = 0.23;        // BOD decay at 20 °C, 1/d (range 0.1–0.4)
export const THETA_D = 1.047;     // BOD decay temperature coefficient
export const THETA_A = 1.024;     // reaeration temperature coefficient
export const K_A_OCEAN20 = 0.2;   // ≈ 4 m/d gas-transfer velocity over a 20 m mixed layer, 1/d

export function kd(tempC) {
  return K_D20 * Math.pow(THETA_D, tempC - 20);
}

export function kaOcean(tempC) {
  return K_A_OCEAN20 * Math.pow(THETA_A, tempC - 20);
}

// O'Connor–Dobbins: ka = 3.93 v^0.5 / H^1.5 (v in m/s, H in m), at 20 °C.
export function kaRiver(velocityMs, depthM, tempC) {
  return ((3.93 * Math.sqrt(velocityMs)) / Math.pow(depthM, 1.5)) * Math.pow(THETA_A, tempC - 20);
}

// Manning: v = (1/n) R^(2/3) S^(1/2).
export function manningVelocity({ n, R, S }) {
  return (1 / n) * Math.pow(R, 2 / 3) * Math.sqrt(S);
}

// Benson & Krause (APHA 4500-O), freshwater at 1 atm, mg/L.
export function doSat(tempC) {
  const T = tempC + 273.15;
  return Math.exp(
    -139.34411 + 1.575701e5 / T - 6.642308e7 / T ** 2 + 1.2438e10 / T ** 3 - 8.621949e11 / T ** 4,
  );
}

// Zonal-mean sea-surface temperature sketch: 28 °C at the equator, ~3 °C at 78°.
export function sstClimatology(latDeg) {
  const s = Math.sin((latDeg * Math.PI) / 180);
  return 28 - 26 * s * s;
}

// Exact solution over t of dL/dt = -kd L, dD/dt = kd L - ka D (Streeter–Phelps).
// The bridge term (e^{-kd t} - e^{-ka t}) / (ka - kd) switches to a series near
// ka = kd so it stays continuous through the degenerate case.
export function sagStep(L0, D0, kdv, kav, t) {
  const eD = Math.exp(-kdv * t);
  const eA = Math.exp(-kav * t);
  const x = (kav - kdv) * t;
  const bridge = Math.abs(x) < 1e-4
    ? t * eD * (1 - x / 2 + (x * x) / 6)
    : (eD - eA) / (kav - kdv);
  return { L: L0 * eD, D: kdv * L0 * bridge + D0 * eA };
}

// Time of maximum deficit (the classic critical point). 0 when the deficit
// only recovers from the start.
export function criticalTime(L0, D0, kdv, kav) {
  if (!(L0 > 0)) return 0;
  const dk = kav - kdv;
  if (Math.abs(dk) < 1e-9) return Math.max(0, (1 / kdv) * (1 - D0 / L0));
  const arg = (kav / kdv) * (1 - (D0 * dk) / (kdv * L0));
  if (!(arg > 0)) return 0;
  return Math.max(0, Math.log(arg) / dk);
}

// State of a river parcel t days after leaving the audit site.
// kernel = { temp, do, bod, dt, nitrate } (the verdict's kernel inputs).
export function riverState(kernel, tDays, { velocityMs, depthM }) {
  const sat = doSat(kernel.temp);
  const D0 = Math.max(0, sat - kernel.do);
  const { L, D } = sagStep(kernel.bod, D0, kd(kernel.temp), kaRiver(velocityMs, depthM, kernel.temp), tDays);
  return {
    dT: kernel.dt * Math.exp(-tDays / TAU_T_DAYS),
    L,
    N: kernel.nitrate * Math.exp(-tDays / TAU_N_DAYS),
    D: Math.min(Math.max(0, D), sat),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/kinetics.test.js`
Expected: PASS (all). The RK4 loop for `t = 10` runs 10,000 steps per case; total file time should be well under 5 s.

- [ ] **Step 5: Mutation checks**

1. In `sagStep`, replace the `bridge` expression with `(eD - eA) / (kav - kdv)` unconditionally. Run: "ka = kd (degenerate)" and "continuous" must FAIL (NaN / jump). Revert.
2. In `riverState`, remove `Math.max(0, …)` from `D0`. Run: "never reports a negative deficit" must FAIL. Revert.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/ledger/ocean/kinetics.js src/terminal/ledger/ocean/__tests__/kinetics.test.js
git commit -m "feat(ledger-ocean): exact Streeter-Phelps kinetics and rate helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Land mask, components, coast distance, snapping

**Files:**
- Create: `src/terminal/ledger/ocean/landMask.js`
- Create: `src/terminal/ledger/ocean/__tests__/syntheticWorld.js`
- Test: `src/terminal/ledger/ocean/__tests__/landMask.test.js`

**Interfaces:**
- Consumes: `makeGrid`, `OCEAN_GRID`, `LAT_LIMIT` (Task 1).
- Produces:
  - `landRings(topology?)` → array of `[lon, lat][]` rings
  - `rasterizeLand(grid, rings?)` → `Uint8Array(n)`, 1 = land
  - `labelComponents(grid, isMember(k) → bool, diagonal: bool)` → `{ label: Int32Array(n) (-1 = not member), count }`
  - `analyzeLand(grid, land)` → `mask = { land, comp, compCount, basin, basinCount, dist, nearest }`. `comp` = 8-connected land component id (−1 on ocean). `basin` = 4-connected ocean component id (−1 on land). `dist` = 4-neighbour BFS distance to land in cells (0 on land, −1 if no land exists). `nearest` = component id of the nearest land cell.
  - `buildLandMask(grid)` → `analyzeLand(grid, rasterizeLand(grid))`
  - `snapToOcean(grid, land, lon, lat, maxR = 64)` → `{ i, j, k, distCells, lon, lat }` or `null`
  - Test helper `syntheticWorld({ island = true })` → `{ grid, mask }` on a 64×32 grid: polar rows land, optional island at `i 40..44, j 14..17`.

- [ ] **Step 1: Write the synthetic-world helper**

`src/terminal/ledger/ocean/__tests__/syntheticWorld.js`:

```js
// 64×32 test world: polar rows (|lat| > 78°) are land, plus an optional
// rectangular island at i 40..44, j 14..17 (lon ≈ 48°–70°E, lat ≈ 8°S–11°N).
import { makeGrid, LAT_LIMIT } from '../grid';
import { analyzeLand } from '../landMask';

export function syntheticWorld({ island = true } = {}) {
  const grid = makeGrid(64, 32);
  const land = new Uint8Array(grid.n);
  for (let j = 0; j < grid.ny; j++) {
    const polar = Math.abs(grid.latOf(j)) > LAT_LIMIT;
    for (let i = 0; i < grid.nx; i++) {
      const isl = island && i >= 40 && i <= 44 && j >= 14 && j <= 17;
      if (polar || isl) land[grid.idx(i, j)] = 1;
    }
  }
  return { grid, mask: analyzeLand(grid, land) };
}

export function uniformVelocity(grid, u, v) {
  const vel = new Float32Array(grid.n * 2);
  for (let k = 0; k < grid.n; k++) {
    vel[k * 2] = u;
    vel[k * 2 + 1] = v;
  }
  return vel;
}

// Cosine bump of radius r cells centred on (ci, cj), wrap-aware in i.
// Values go into every channel in `channels`, scaled by `peak`.
export function blob(grid, land, ci, cj, r, peak = 1, channels = [0, 1, 2, 3]) {
  const state = new Float32Array(grid.n * 4);
  for (let j = 0; j < grid.ny; j++) {
    for (let i = 0; i < grid.nx; i++) {
      let di = Math.abs(i - ci);
      di = Math.min(di, grid.nx - di);
      const d = Math.hypot(di, j - cj);
      const k = grid.idx(i, j);
      if (d >= r || land[k]) continue;
      const v = peak * 0.5 * (1 + Math.cos((Math.PI * d) / r));
      for (const c of channels) state[k * 4 + c] = v;
    }
  }
  return state;
}

// Area-weighted total of channel c over ocean cells.
export function mass(grid, land, state, c) {
  let m = 0;
  for (let j = 0; j < grid.ny; j++) {
    for (let i = 0; i < grid.nx; i++) {
      const k = j * grid.nx + i;
      if (!land[k]) m += state[k * 4 + c] * grid.cosLat[j];
    }
  }
  return m;
}
```

- [ ] **Step 2: Write the failing test**

`src/terminal/ledger/ocean/__tests__/landMask.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { OCEAN_GRID, makeGrid, LAT_LIMIT } from '../grid';
import { buildLandMask, labelComponents, analyzeLand, snapToOcean } from '../landMask';

const grid = OCEAN_GRID;
const mask = buildLandMask(grid);
const cellOf = (lon, lat) => {
  const { i, j } = grid.lonLatToCell(lon, lat);
  return grid.idx(i, j);
};
const isLand = (lon, lat) => mask.land[cellOf(lon, lat)] === 1;

// Mouths the spec names (lon, lat). All must reach ocean within 3 cells.
const MOUTHS = {
  mercury: [20.0, 39.87],       // Bistrica → Ionian Sea
  germany: [4.12, 51.98],       // Rhine, Hook of Holland
  usa: [-89.25, 29.15],         // Mississippi, Head of Passes
  brazil: [-39.82, -19.63],     // Rio Doce mouth
  north_korea: [127.65, 39.8],  // Hamhung coast
  yangtze: [121.9, 31.4],
  ganges: [89.18, 21.95],       // Sundarbans
  citarum: [107.0, -5.93],
  danube: [29.75, 45.15],       // Sulina
};

describe('rasterizeLand (real world, 512×256)', () => {
  it('classifies reference points', () => {
    expect(isLand(14.29, 48.31)).toBe(true);    // Linz
    expect(isLand(34, 43.5)).toBe(false);       // Black Sea
    expect(isLand(-150, 0)).toBe(false);        // mid-Pacific
    expect(isLand(3, 55)).toBe(false);          // North Sea
    expect(isLand(134, 40)).toBe(false);        // Sea of Japan
    expect(isLand(110, -5)).toBe(false);        // Java Sea
    expect(isLand(-90, 27)).toBe(false);        // Gulf of Mexico
  });

  it('treats everything poleward of 78° as land', () => {
    for (let j = 0; j < grid.ny; j++) {
      if (Math.abs(grid.latOf(j)) <= LAT_LIMIT) continue;
      for (let i = 0; i < grid.nx; i++) expect(mask.land[grid.idx(i, j)]).toBe(1);
    }
  });

  it('has a plausible land fraction', () => {
    let n = 0;
    for (const v of mask.land) n += v;
    const frac = n / grid.n;
    expect(frac).toBeGreaterThan(0.33);
    expect(frac).toBeLessThan(0.45);
  });
});

describe('snapToOcean (real world)', () => {
  it.each(Object.entries(MOUTHS))('%s mouth snaps within 3 cells', (_key, [lon, lat]) => {
    const s = snapToOcean(grid, mask.land, lon, lat, 8);
    expect(s).not.toBeNull();
    expect(s.distCells).toBeLessThanOrEqual(3);
    expect(mask.land[s.k]).toBe(0);
  });

  const basinAt = (lon, lat) => mask.basin[cellOf(lon, lat)];
  const snapBasin = (key) => {
    const [lon, lat] = MOUTHS[key];
    return mask.basin[snapToOcean(grid, mask.land, lon, lat, 8).k];
  };

  it('drains each river into the right water body', () => {
    expect(snapBasin('danube')).toBe(basinAt(34, 43.5));        // Black Sea
    expect(snapBasin('north_korea')).toBe(basinAt(134, 40));    // Sea of Japan
    expect(snapBasin('brazil')).toBe(basinAt(-30, -20));        // South Atlantic
    expect(snapBasin('usa')).toBe(basinAt(-90, 27));            // Gulf of Mexico
  });

  // The spec says the Bosporus is sub-grid, so Danube dye stays in the Black Sea.
  // If this fails, STOP and report: the spec's claim is wrong, not the test.
  it('keeps the Black Sea closed at this resolution', () => {
    expect(basinAt(34, 43.5)).not.toBe(basinAt(-150, 0));
  });

  it('returns null when no ocean is within reach', () => {
    expect(snapToOcean(grid, mask.land, 14.29, 48.31, 2)).toBeNull();
  });
});

describe('labelComponents and analyzeLand (synthetic)', () => {
  const g = makeGrid(8, 4);

  it('merges diagonal land only with diagonal connectivity', () => {
    const land = new Uint8Array(g.n);
    land[g.idx(1, 1)] = 1;
    land[g.idx(2, 2)] = 1;
    expect(labelComponents(g, (k) => land[k] === 1, true).count).toBe(1);
    expect(labelComponents(g, (k) => land[k] === 1, false).count).toBe(2);
  });

  it('connects components across the date line', () => {
    const land = new Uint8Array(g.n);
    land[g.idx(0, 1)] = 1;
    land[g.idx(7, 1)] = 1;
    expect(labelComponents(g, (k) => land[k] === 1, false).count).toBe(1);
  });

  it('measures coast distance with east–west wrap', () => {
    const land = new Uint8Array(g.n);
    for (let j = 0; j < g.ny; j++) land[g.idx(0, j)] = 1;
    const m = analyzeLand(g, land);
    expect(m.dist[g.idx(0, 1)]).toBe(0);
    expect(m.dist[g.idx(3, 1)]).toBe(3);
    expect(m.dist[g.idx(5, 1)]).toBe(3);
    expect(m.dist[g.idx(7, 1)]).toBe(1);
    expect(m.nearest[g.idx(4, 2)]).toBe(m.comp[g.idx(0, 2)]);
    expect(m.comp[g.idx(3, 1)]).toBe(-1);
    expect(m.basin[g.idx(0, 1)]).toBe(-1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/landMask.test.js`
Expected: FAIL — cannot resolve `../landMask`.

- [ ] **Step 4: Implement `landMask.js`**

```js
// landMask.js — the ocean's coastline, from the same Natural Earth 110m land
// that worldMapPolys draws (world-atlas/land-110m.json), rasterised in lon/lat
// with an even–odd scanline so it runs in jsdom.

import * as topojson from 'topojson-client';
import landTopology from 'world-atlas/land-110m.json';
import { LAT_LIMIT } from './grid';

export function landRings(topology = landTopology) {
  const f = topojson.feature(topology, topology.objects.land);
  const geoms = f.type === 'FeatureCollection' ? f.features.map((x) => x.geometry) : [f.geometry];
  const rings = [];
  for (const g of geoms) {
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const p of polys) for (const r of p) rings.push(r);
  }
  return rings;
}

export function rasterizeLand(grid, rings = landRings()) {
  const { nx, ny } = grid;
  const land = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    const lat = grid.latOf(j);
    if (Math.abs(lat) > LAT_LIMIT) {
      land.fill(1, j * nx, (j + 1) * nx);
      continue;
    }
    const xs = [];
    for (const r of rings) {
      for (let k = 0, m = r.length - 1; k < r.length; m = k++) {
        const [x1, y1] = r[m];
        const [x2, y2] = r[k];
        if ((y1 > lat) !== (y2 > lat)) xs.push(x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    xs.sort((a, b) => a - b);
    // Even–odd: a cell centre is land when an odd number of crossings lie east of it.
    let p = 0;
    for (let i = 0; i < nx; i++) {
      const lon = grid.lonOf(i);
      while (p < xs.length && xs[p] <= lon) p++;
      if ((xs.length - p) % 2 === 1) land[j * nx + i] = 1;
    }
  }
  return land;
}

export function labelComponents(grid, isMember, diagonal) {
  const { nx, ny, n } = grid;
  const label = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  let count = 0;
  for (let s = 0; s < n; s++) {
    if (label[s] !== -1 || !isMember(s)) continue;
    let top = 0;
    stack[top++] = s;
    label[s] = count;
    while (top > 0) {
      const k = stack[--top];
      const i = k % nx;
      const j = (k - i) / nx;
      for (let dj = -1; dj <= 1; dj++) {
        const jj = j + dj;
        if (jj < 0 || jj >= ny) continue;
        for (let di = -1; di <= 1; di++) {
          if (di === 0 && dj === 0) continue;
          if (!diagonal && di !== 0 && dj !== 0) continue;
          const kk = jj * nx + grid.wrapI(i + di);
          if (label[kk] === -1 && isMember(kk)) {
            label[kk] = count;
            stack[top++] = kk;
          }
        }
      }
    }
    count++;
  }
  return { label, count };
}

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function analyzeLand(grid, land) {
  const { nx, ny, n } = grid;
  // Land is 8-connected so that every land cell sharing a corner belongs to
  // one component — streamFunction relies on this for zero coastal flux.
  const { label: comp, count: compCount } = labelComponents(grid, (k) => land[k] === 1, true);
  const { label: basin, count: basinCount } = labelComponents(grid, (k) => land[k] === 0, false);
  const dist = new Int32Array(n).fill(-1);
  const nearest = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let k = 0; k < n; k++) {
    if (land[k]) {
      dist[k] = 0;
      nearest[k] = comp[k];
      queue[tail++] = k;
    }
  }
  while (head < tail) {
    const k = queue[head++];
    const i = k % nx;
    const j = (k - i) / nx;
    for (const [di, dj] of N4) {
      const jj = j + dj;
      if (jj < 0 || jj >= ny) continue;
      const kk = jj * nx + grid.wrapI(i + di);
      if (dist[kk] !== -1) continue;
      dist[kk] = dist[k] + 1;
      nearest[kk] = nearest[k];
      queue[tail++] = kk;
    }
  }
  return { land, comp, compCount, basin, basinCount, dist, nearest };
}

export function buildLandMask(grid) {
  return analyzeLand(grid, rasterizeLand(grid));
}

// Nearest ocean cell (Euclidean, in cells) within maxR; ties resolve to the
// first found scanning south→north, west→east, so results are deterministic.
export function snapToOcean(grid, land, lon, lat, maxR = 64) {
  const { i: ci, j: cj } = grid.lonLatToCell(lon, lat);
  let best = null;
  for (let dj = -maxR; dj <= maxR; dj++) {
    const j = cj + dj;
    if (j < 0 || j >= grid.ny) continue;
    for (let di = -maxR; di <= maxR; di++) {
      const k = grid.idx(ci + di, j);
      if (land[k]) continue;
      const d = Math.hypot(di, dj);
      if (d <= maxR && (!best || d < best.distCells)) best = { i: grid.wrapI(ci + di), j, k, distCells: d };
    }
  }
  if (!best) return null;
  return { ...best, lon: grid.lonOf(best.i), lat: grid.latOf(best.j) };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/landMask.test.js`
Expected: PASS. (Pre-plan probe measured land fraction 0.388 and every mouth ≤ 1 cell from ocean.) If "keeps the Black Sea closed" fails, stop and report to the user; do not edit the assertion.

- [ ] **Step 6: Mutation checks**

1. In `rasterizeLand`, change `=== 1` to `=== 0` in the parity test. "classifies reference points" must FAIL. Revert.
2. In `analyzeLand`, pass `false` instead of `true` for land connectivity. "merges diagonal land" still tests `labelComponents` directly, so instead run the Task 4 coast-face test later with this mutation (noted there). Revert now.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/ledger/ocean/landMask.js src/terminal/ledger/ocean/__tests__/landMask.test.js src/terminal/ledger/ocean/__tests__/syntheticWorld.js
git commit -m "feat(ledger-ocean): land mask, components, coast distance, ocean snapping

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Currents (stream function → Arakawa-C velocities)

**Files:**
- Create: `src/terminal/ledger/ocean/streamFunction.js`
- Test: `src/terminal/ledger/ocean/__tests__/streamFunction.test.js`

**Interfaces:**
- Consumes: `R_EARTH_KM` (Task 1); `mask` from `analyzeLand` / `buildLandMask` (Task 3); `syntheticWorld` helper.
- Produces:
  - `GYRE_CELLS` (array of `{ name, lon0, lon1, lat0, lat1, sign, peak, eps }`), `ACC = { latNorth, latSouth, peak }`
  - `gyrePsi(lon, lat, cells?)`, `accPsi(lat, acc?)`, `cellAmplitude(cell)`
  - `bakeCurrents(grid, mask, { cells = GYRE_CELLS, acc = ACC, rampCells = 3 })` → `{ psi: Float64Array(nx*(ny+1)), uFace: Float32Array(n), vFace: Float32Array(n), vel: Float32Array(n*2) }`
    - `psi[j*nx + i]` is the corner at lon `-180 + i·dlon`, lat `-90 + j·dlat` (south-west corner of cell (i, j)).
    - `uFace[k]` = eastward km/day on the **east** face of cell k; `vFace[k]` = northward km/day on the **north** face.
    - `vel[2k], vel[2k+1]` = cell-centre (u, v) km/day; 0 on land.

- [ ] **Step 1: Write the failing test**

`src/terminal/ledger/ocean/__tests__/streamFunction.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { OCEAN_GRID } from '../grid';
import { buildLandMask } from '../landMask';
import { bakeCurrents, GYRE_CELLS } from '../streamFunction';
import { syntheticWorld } from './syntheticWorld';

const grid = OCEAN_GRID;
const mask = buildLandMask(grid);
const cur = bakeCurrents(grid, mask);
const { nx, ny, cellKm } = grid;

const faceCos = (j) => Math.cos(((-90 + (j + 1) * grid.dlat) * Math.PI) / 180);

describe('bakeCurrents (real world)', () => {
  it('is discretely divergence-free in flux form', () => {
    let maxFlux = 0;
    let maxDiv = 0;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const east = cur.uFace[k] * cellKm;
        const west = cur.uFace[grid.idx(i - 1, j)] * cellKm;
        const north = cur.vFace[k] * cellKm * faceCos(j);
        const south = j > 0 ? cur.vFace[k - nx] * cellKm * faceCos(j - 1) : 0;
        maxFlux = Math.max(maxFlux, Math.abs(east), Math.abs(north));
        maxDiv = Math.max(maxDiv, Math.abs(east - west + north - south));
      }
    }
    expect(maxFlux).toBeGreaterThan(0);
    expect(maxDiv).toBeLessThan(1e-6 * maxFlux);
  });

  it('has exactly zero flux through every face touching land', () => {
    let bad = 0;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const kE = grid.idx(i + 1, j);
        if ((mask.land[k] || mask.land[kE]) && cur.uFace[k] !== 0) bad++;
        if (j < ny - 1 && (mask.land[k] || mask.land[k + nx]) && cur.vFace[k] !== 0) bad++;
      }
    }
    expect(bad).toBe(0);
  });

  it('is finite and bounded, with a real western boundary current', () => {
    let max = 0;
    for (let k = 0; k < grid.n; k++) {
      const s = Math.hypot(cur.vel[2 * k], cur.vel[2 * k + 1]);
      expect(Number.isFinite(s)).toBe(true);
      max = Math.max(max, s);
    }
    expect(max).toBeGreaterThan(100);
    expect(max).toBeLessThan(300); // CFL: 300 km/d × 0.25 d < one 78 km cell
  });

  it('intensifies the North Pacific gyre on its western side (Kuroshio)', () => {
    const cell = GYRE_CELLS.find((c) => c.name === 'north-pacific-subtropical');
    const width = cell.lon1 - cell.lon0;
    let west = 0;
    let east = 0;
    for (let j = 0; j < ny; j++) {
      const lat = grid.latOf(j);
      if (lat < 20 || lat > 38) continue;
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (mask.land[k]) continue;
        const dx = (((grid.lonOf(i) - cell.lon0) % 360) + 360) % 360;
        const s = Math.hypot(cur.vel[2 * k], cur.vel[2 * k + 1]);
        if (dx <= width / 3) west = Math.max(west, s);
        else if (dx >= (2 * width) / 3 && dx <= width) east = Math.max(east, s);
      }
    }
    expect(west).toBeGreaterThanOrEqual(3 * east);
  });

  const meanV = (lon0, lon1, lat0, lat1) => {
    let sum = 0;
    let count = 0;
    for (let j = 0; j < ny; j++) {
      const lat = grid.latOf(j);
      if (lat < lat0 || lat > lat1) continue;
      for (let i = 0; i < nx; i++) {
        const lon = grid.lonOf(i);
        const k = j * nx + i;
        if (lon < lon0 || lon > lon1 || mask.land[k]) continue;
        sum += cur.vel[2 * k + 1];
        count++;
      }
    }
    return sum / count;
  };

  it('runs the Kuroshio north and the Black Sea rim current south along Romania', () => {
    expect(meanV(122, 135, 25, 32)).toBeGreaterThan(0);
    expect(meanV(28, 31.5, 42.5, 45.5)).toBeLessThan(0);
  });
});

describe('bakeCurrents (synthetic world)', () => {
  it('respects a single test gyre around an island', () => {
    const { grid: g, mask: m } = syntheticWorld();
    const c = bakeCurrents(g, m, {
      cells: [{ name: 't', lon0: 20, lon1: 120, lat0: -50, lat1: 50, sign: 1, peak: 300, eps: 0.1 }],
      acc: null,
    });
    // The island sits inside the gyre, so raw ψ is non-zero around it: only
    // the coastal treatment can make these faces zero.
    let bad = 0;
    let moving = 0;
    for (let j = 0; j < g.ny; j++) {
      for (let i = 0; i < g.nx; i++) {
        const k = j * g.nx + i;
        const kE = g.idx(i + 1, j);
        if ((m.land[k] || m.land[kE]) && c.uFace[k] !== 0) bad++;
        if (j < g.ny - 1 && (m.land[k] || m.land[k + g.nx]) && c.vFace[k] !== 0) bad++;
        if (!m.land[k] && Math.hypot(c.vel[2 * k], c.vel[2 * k + 1]) > 1) moving++;
      }
    }
    expect(bad).toBe(0);
    expect(moving).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/streamFunction.test.js`
Expected: FAIL — cannot resolve `../streamFunction`.

- [ ] **Step 3: Implement `streamFunction.js`**

```js
// streamFunction.js — climatological surface currents as the curl of a
// stream function ψ, so the flow is divergence-free by construction.
// HUD legend: CLIMATOLOGICAL CURRENTS · NOT FORECAST.
//
// Sign convention: u = −∂ψ/∂y (east), v = ∂ψ/∂x (north). A positive ψ bump
// circulates clockwise — Northern-Hemisphere subtropical gyres are sign +1.

import { R_EARTH_KM } from './grid';

const DEG_KM = (Math.PI / 180) * R_EARTH_KM;

// lon1 may exceed 180 for cells crossing the antimeridian.
// peak: target speed at the western boundary (km/day). eps: Stommel
// boundary-layer width as a fraction of the cell width.
export const GYRE_CELLS = [
  { name: 'north-pacific-subtropical', lon0: 118, lon1: 245, lat0: 12, lat1: 45, sign: 1, peak: 150, eps: 0.04 },
  { name: 'north-atlantic-subtropical', lon0: -82, lon1: -8, lat0: 12, lat1: 45, sign: 1, peak: 150, eps: 0.05 },
  { name: 'south-pacific-subtropical', lon0: 150, lon1: 290, lat0: -45, lat1: -12, sign: -1, peak: 60, eps: 0.05 },
  { name: 'south-atlantic-subtropical', lon0: -52, lon1: 15, lat0: -40, lat1: -10, sign: -1, peak: 60, eps: 0.06 },
  { name: 'indian-subtropical', lon0: 32, lon1: 115, lat0: -40, lat1: -10, sign: -1, peak: 80, eps: 0.05 },
  { name: 'north-pacific-subpolar', lon0: 140, lon1: 235, lat0: 45, lat1: 62, sign: -1, peak: 40, eps: 0.08 },
  { name: 'north-atlantic-subpolar', lon0: -65, lon1: -5, lat0: 45, lat1: 65, sign: -1, peak: 40, eps: 0.08 },
  // Regional cells for the source rivers (one frozen season).
  { name: 'gulf-louisiana-texas-shelf', lon0: -98, lon1: -81, lat0: 18, lat1: 30.5, sign: -1, peak: 40, eps: 0.2 },
  { name: 'east-china-sea-shelf', lon0: 119, lon1: 131, lat0: 24, lat1: 36, sign: 1, peak: 40, eps: 0.15 },
  { name: 'east-korea-warm', lon0: 127, lon1: 142, lat0: 35, lat1: 47, sign: 1, peak: 30, eps: 0.15 },
  { name: 'north-sea', lon0: -4, lon1: 10, lat0: 51, lat1: 61, sign: -1, peak: 20, eps: 0.3 },
  { name: 'black-sea-rim', lon0: 27, lon1: 42, lat0: 40.5, lat1: 47, sign: -1, peak: 30, eps: 0.3 },
  { name: 'bay-of-bengal', lon0: 79, lon1: 95, lat0: 5, lat1: 23, sign: 1, peak: 40, eps: 0.15 },
  { name: 'java-sea', lon0: 105, lon1: 118, lat0: -8, lat1: -2.5, sign: 1, peak: 20, eps: 0.3 },
  { name: 'ionian', lon0: 15, lon1: 23, lat0: 36, lat1: 41, sign: -1, peak: 15, eps: 0.3 },
];

// Antarctic Circumpolar Current: eastward zonal band.
export const ACC = { latNorth: -45, latSouth: -65, peak: 40 };

function stommel(x, eps) {
  return (1 - x) * (1 - Math.exp(-x / eps));
}

const maxCache = new Map();
function stommelMax(eps) {
  if (!maxCache.has(eps)) {
    let m = 0;
    for (let s = 0; s <= 2000; s++) m = Math.max(m, stommel(s / 2000, eps));
    maxCache.set(eps, m);
  }
  return maxCache.get(eps);
}

function smoothstep(t) {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

// Peak |∂ψ/∂x| sits at the western edge: A · (1/eps) / max(X) / widthKm.
export function cellAmplitude(cell) {
  const width = cell.lon1 - cell.lon0;
  const midLat = (cell.lat0 + cell.lat1) / 2;
  const widthKm = width * DEG_KM * Math.cos((midLat * Math.PI) / 180);
  return cell.peak * widthKm * cell.eps * stommelMax(cell.eps);
}

export function gyrePsi(lon, lat, cells = GYRE_CELLS) {
  let psi = 0;
  for (const c of cells) {
    const width = c.lon1 - c.lon0;
    const dx = (((lon - c.lon0) % 360) + 360) % 360;
    if (dx > width) continue;
    const y = (lat - c.lat0) / (c.lat1 - c.lat0);
    if (y <= 0 || y >= 1) continue;
    psi += c.sign * cellAmplitude(c) * (stommel(dx / width, c.eps) / stommelMax(c.eps)) * Math.sin(Math.PI * y);
  }
  return psi;
}

// Rises from 0 at latNorth to A at latSouth, so u = −∂ψ/∂y is eastward.
// Smoothstep's peak slope is 1.5, which sets A from the target peak speed.
export function accPsi(lat, acc = ACC) {
  if (!acc) return 0;
  const span = acc.latNorth - acc.latSouth;
  const A = (acc.peak * span * DEG_KM) / 1.5;
  return A * smoothstep((acc.latNorth - lat) / span);
}

export function bakeCurrents(grid, mask, { cells = GYRE_CELLS, acc = ACC, rampCells = 3 } = {}) {
  const { nx, ny, n, cellKm, dlon, dlat } = grid;
  const { land, comp, compCount, dist, nearest } = mask;

  // Island rule, approximated: each land component holds the mean ACC ψ of
  // its coastal ring. Gyres are ramped to zero at every coast instead.
  const sum = new Float64Array(compCount);
  const cnt = new Float64Array(compCount);
  for (let k = 0; k < n; k++) {
    if (dist[k] !== 1) continue;
    sum[nearest[k]] += accPsi(grid.latOf(Math.floor(k / nx)), acc);
    cnt[nearest[k]] += 1;
  }
  const accC = new Float64Array(compCount);
  for (let c = 0; c < compCount; c++) accC[c] = cnt[c] ? sum[c] / cnt[c] : 0;

  const psi = new Float64Array(nx * (ny + 1));
  for (let j = 0; j <= ny; j++) {
    const lat = -90 + j * dlat;
    const aRaw = accPsi(lat, acc);
    for (let i = 0; i < nx; i++) {
      const lon = -180 + i * dlon;
      let landComp = -1;
      let minDist = Infinity;
      let nearC = -1;
      for (let t = 0; t < 4; t++) {
        const ci = i - 1 + (t & 1);
        const cj = j - 1 + (t >> 1);
        if (cj < 0 || cj >= ny) continue;
        const k = grid.idx(ci, cj);
        if (land[k]) {
          if (landComp < 0) landComp = comp[k];
        } else if (dist[k] >= 0 && dist[k] < minDist) {
          minDist = dist[k];
          nearC = nearest[k];
        }
      }
      let value;
      if (landComp >= 0) value = accC[landComp];
      else if (nearC < 0) value = gyrePsi(lon, lat, cells) + aRaw;
      else {
        const m = smoothstep((minDist - 0.5) / rampCells);
        value = m * gyrePsi(lon, lat, cells) + accC[nearC] + (aRaw - accC[nearC]) * m;
      }
      psi[j * nx + i] = value;
    }
  }

  const P = (i, j) => psi[j * nx + grid.wrapI(i)];
  const uFace = new Float32Array(n);
  const vFace = new Float32Array(n);
  for (let j = 0; j < ny; j++) {
    const cosN = Math.cos(((-90 + (j + 1) * dlat) * Math.PI) / 180);
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      uFace[k] = -(P(i + 1, j + 1) - P(i + 1, j)) / cellKm;
      vFace[k] = cosN > 1e-9 ? (P(i + 1, j + 1) - P(i, j + 1)) / (cellKm * cosN) : 0;
    }
  }

  const vel = new Float32Array(n * 2);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (land[k]) continue;
      vel[2 * k] = (uFace[grid.idx(i - 1, j)] + uFace[k]) / 2;
      vel[2 * k + 1] = ((j > 0 ? vFace[k - nx] : 0) + vFace[k]) / 2;
    }
  }
  return { psi, uFace, vFace, vel };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/streamFunction.test.js`
Expected: PASS. If "bounded" fails with max ≥ 300 km/d, report the location of the maximum (lon/lat) to the user before tuning any `peak`; a coastal-ramp jet there is a design finding, not a test problem.

- [ ] **Step 5: Mutation checks**

1. In the `vFace` line, replace `cosN` with `grid.cosLat[j]` (cell-centre cosine). "divergence-free" must FAIL. Revert.
2. Replace `if (landComp >= 0) value = accC[landComp];` with `if (landComp >= 0) value = gyrePsi(lon, lat, cells) + aRaw;`. "zero flux through every face touching land" must FAIL. Revert.
3. In `landMask.js` `analyzeLand`, set land connectivity to `false`. Run this file: "zero flux" should FAIL if any diagonal-only land contact exists on the real mask. If it still passes, note in the commit message that the 110m mask has no diagonal-only contacts (the 8-connectivity remains required for correctness). Revert.
4. Flip the sign in `vFace` (`(P(i, j + 1) - P(i + 1, j + 1))`). "Kuroshio north" must FAIL. Revert.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/ledger/ocean/streamFunction.js src/terminal/ledger/ocean/__tests__/streamFunction.test.js
git commit -m "feat(ledger-ocean): stream-function currents on an Arakawa-C grid

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: CPU reference step (the oracle)

**Files:**
- Create: `src/terminal/ledger/ocean/referenceStep.js`
- Test: `src/terminal/ledger/ocean/__tests__/referenceStep.test.js`

**Interfaces:**
- Consumes: `DT_DAYS`, `LAT_LIMIT` (Task 1); `createStepClock` (Task 1); `TAU_T_DAYS`, `TAU_N_DAYS`, `kd`, `kaOcean`, `sagStep`, `doSat`, `sstClimatology` (Task 2); `bakeCurrents` (Task 4); `syntheticWorld`, `uniformVelocity`, `blob`, `mass` helpers.
- Produces:
  - `EDDY_DIFFUSIVITY_KM2_DAY = 86.4`
  - `createOceanContext(grid, land, vel)` → `ctx` (holds grid, land, vel, per-row rates, four `Float32Array(n*4)` scratch buffers `a b c d`)
  - `advect(ctx, src, dst, dtDays)`, `advectBFECC(ctx, state, out, dtDays)`, `diffuse(ctx, src, dst, dtDays, D)`, `react(ctx, state, dtDays)`, `inject(ctx, state, sources, dtDays)`, `guard(ctx, state)`
  - `step(ctx, state, { dtDays = DT_DAYS, sources = [], reactions = true, diffusivity = EDDY_DIFFUSIVITY_KM2_DAY })` → mutates and returns `state`
  - A source (as consumed by `inject`) is `{ cells: [{ k, f }], conc: [ΔT, L, N, D] }`; per step each channel gains `conc[c] · f · dtDays`.

- [ ] **Step 1: Write the failing test**

`src/terminal/ledger/ocean/__tests__/referenceStep.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createOceanContext, step } from '../referenceStep';
import { bakeCurrents } from '../streamFunction';
import { createStepClock } from '../clock';
import { sagStep, kd, kaOcean, doSat, sstClimatology, TAU_T_DAYS, TAU_N_DAYS } from '../kinetics';
import { syntheticWorld, uniformVelocity, blob, mass } from './syntheticWorld';

const vortexCells = [{ name: 't', lon0: 20, lon1: 120, lat0: -50, lat1: 50, sign: 1, peak: 300, eps: 0.1 }];

describe('referenceStep guards', () => {
  it('survives 10k extreme steps: no NaN, no negatives, land exactly zero', () => {
    const { grid, mask } = syntheticWorld();
    const { vel } = bakeCurrents(grid, mask, { cells: vortexCells, acc: null });
    const ctx = createOceanContext(grid, mask.land, vel);
    const state = blob(grid, mask.land, 30, 16, 6, 1e6);
    const k = grid.idx(38, 15);
    const sources = [{ cells: [{ k, f: 50 }], conc: [1e4, 1e4, 1e4, 1e4] }];
    for (let s = 0; s < 10000; s++) step(ctx, state, { sources });
    for (let q = 0; q < state.length; q++) {
      expect(Number.isFinite(state[q])).toBe(true);
      expect(state[q]).toBeGreaterThanOrEqual(0);
    }
    for (let kk = 0; kk < grid.n; kk++) {
      if (!mask.land[kk]) continue;
      for (let c = 0; c < 4; c++) expect(state[kk * 4 + c]).toBe(0);
    }
    for (let j = 0; j < grid.ny; j++) {
      const cap = doSat(sstClimatology(grid.latOf(j)));
      for (let i = 0; i < grid.nx; i++) expect(state[grid.idx(i, j) * 4 + 3]).toBeLessThanOrEqual(cap + 1e-4);
    }
  }, 120000);
});

describe('BFECC limiter', () => {
  it('never overshoots a square pulse', () => {
    const { grid, mask } = syntheticWorld({ island: false });
    const { vel } = bakeCurrents(grid, mask, { cells: vortexCells, acc: null });
    const ctx = createOceanContext(grid, mask.land, vel);
    const state = new Float32Array(grid.n * 4);
    for (let j = 13; j <= 17; j++) for (let i = 28; i <= 32; i++) state[grid.idx(i, j) * 4 + 2] = 1;
    for (let s = 0; s < 200; s++) step(ctx, state, { reactions: false, diffusivity: 0 });
    let max = 0;
    for (let k = 0; k < grid.n; k++) max = Math.max(max, state[k * 4 + 2]);
    expect(max).toBeLessThanOrEqual(1 + 1e-6);
  });
});

describe('date line', () => {
  it('is seamless: a blob across the seam behaves like one mid-ocean', () => {
    const { grid, mask } = syntheticWorld({ island: false });
    const vel = uniformVelocity(grid, 300, 0);
    const run = (ci) => {
      const ctx = createOceanContext(grid, mask.land, vel);
      const state = blob(grid, mask.land, ci, 16, 4, 1);
      for (let s = 0; s < 100; s++) step(ctx, state);
      return state;
    };
    const seam = run(0);
    const mid = run(32);
    for (let j = 0; j < grid.ny; j++) {
      for (let i = 0; i < grid.nx; i++) {
        for (let c = 0; c < 4; c++) {
          const a = seam[grid.idx(i, j) * 4 + c];
          const b = mid[grid.idx(i + 32, j) * 4 + c];
          expect(Math.abs(a - b)).toBeLessThan(1e-5);
        }
      }
    }
  });
});

describe('mass', () => {
  // BFECC + limiter is not exactly conservative; the spec claims a bound.
  // If this fails, STOP and report the measured drift — do not loosen it.
  it('drifts < 2% over 1000 steps with decay off', () => {
    const { grid, mask } = syntheticWorld({ island: false });
    const { vel } = bakeCurrents(grid, mask, { cells: vortexCells, acc: null });
    const ctx = createOceanContext(grid, mask.land, vel);
    const state = blob(grid, mask.land, 28, 16, 5, 1);
    const m0 = mass(grid, mask.land, state, 2);
    for (let s = 0; s < 1000; s++) step(ctx, state, { reactions: false });
    const drift = Math.abs(mass(grid, mask.land, state, 2) - m0) / m0;
    expect(drift).toBeLessThan(0.02);
  });
});

describe('reaction and injection', () => {
  it('matches the exact kinetics cell by cell', () => {
    const { grid, mask } = syntheticWorld({ island: false });
    const ctx = createOceanContext(grid, mask.land, uniformVelocity(grid, 0, 0));
    const state = new Float32Array(grid.n * 4);
    const init = [2, 8, 5, 1];
    for (let k = 0; k < grid.n; k++) if (!mask.land[k]) for (let c = 0; c < 4; c++) state[k * 4 + c] = init[c];
    const steps = 40;
    for (let s = 0; s < steps; s++) step(ctx, state, { diffusivity: 0 });
    const t = steps * 0.25;
    for (const j of [5, 16, 26]) {
      const sst = sstClimatology(grid.latOf(j));
      const ref = sagStep(init[1], init[3], kd(sst), kaOcean(sst), t);
      const q = grid.idx(10, j) * 4;
      expect(state[q]).toBeCloseTo(init[0] * Math.exp(-t / TAU_T_DAYS), 4);
      expect(state[q + 1]).toBeCloseTo(ref.L, 4);
      expect(state[q + 2]).toBeCloseTo(init[2] * Math.exp(-t / TAU_N_DAYS), 4);
      expect(state[q + 3]).toBeCloseTo(Math.min(ref.D, doSat(sst)), 4);
    }
  });

  it('injects conc · f · dt per step', () => {
    const { grid, mask } = syntheticWorld({ island: false });
    const ctx = createOceanContext(grid, mask.land, uniformVelocity(grid, 0, 0));
    const state = new Float32Array(grid.n * 4);
    const k = grid.idx(10, 16);
    step(ctx, state, { reactions: false, diffusivity: 0, sources: [{ cells: [{ k, f: 0.01 }], conc: [1, 2, 3, 4] }] });
    for (let c = 0; c < 4; c++) expect(state[k * 4 + c]).toBeCloseTo((c + 1) * 0.01 * 0.25, 7);
  });
});

describe('frame-rate independence', () => {
  it('60 Hz and 360 Hz produce identical oceans', () => {
    const { grid, mask } = syntheticWorld();
    const { vel } = bakeCurrents(grid, mask, { cells: vortexCells, acc: null });
    const run = (hz) => {
      const ctx = createOceanContext(grid, mask.land, vel);
      const clock = createStepClock({ maxSteps: 8 });
      const state = blob(grid, mask.land, 30, 16, 6, 1);
      for (let f = 0; f < hz; f++) {
        const n = clock.advance(1000 / hz, 9);
        for (let s = 0; s < n; s++) step(ctx, state);
      }
      return state;
    };
    expect(Array.from(run(60))).toEqual(Array.from(run(360)));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/referenceStep.test.js`
Expected: FAIL — cannot resolve `../referenceStep`.

- [ ] **Step 3: Implement `referenceStep.js`**

```js
// referenceStep.js — CPU oracle for one ocean step. The GL passes in phase 2
// must reproduce this within tolerance (GPU parity gate). State is RGBA
// interleaved per cell: [ΔT, BOD, nitrate, deficit].

import { DT_DAYS, LAT_LIMIT } from './grid';
import { TAU_T_DAYS, TAU_N_DAYS, kd, kaOcean, sagStep, doSat, sstClimatology } from './kinetics';

export const EDDY_DIFFUSIVITY_KM2_DAY = 86.4; // 1000 m²/s horizontal eddy diffusivity

export function createOceanContext(grid, land, vel) {
  const rows = [];
  for (let j = 0; j < grid.ny; j++) {
    const sst = sstClimatology(grid.latOf(j));
    rows.push({ kd: kd(sst), ka: kaOcean(sst), doSat: doSat(sst) });
  }
  const size = grid.n * 4;
  return {
    grid, land, vel, rows,
    a: new Float32Array(size), b: new Float32Array(size),
    c: new Float32Array(size), d: new Float32Array(size),
  };
}

// Bilinear sample of all 4 channels at continuous cell coords (x, y), cell
// (i, j) centred at (i, j), over OCEAN texels only. Also records the min/max
// of those texels for the limiter. Returns false when all four are land.
const S = { v: new Float64Array(4), lo: new Float64Array(4), hi: new Float64Array(4) };
function sample(grid, land, field, x, yIn) {
  const { nx, ny } = grid;
  const y = Math.min(ny - 1, Math.max(0, yIn));
  const i0 = Math.floor(x);
  const j0 = Math.min(ny - 2, Math.floor(y));
  const fx = x - i0;
  const fy = y - j0;
  S.v.fill(0);
  S.lo.fill(Infinity);
  S.hi.fill(-Infinity);
  let wsum = 0;
  for (let t = 0; t < 4; t++) {
    const di = t & 1;
    const dj = t >> 1;
    const k = (j0 + dj) * nx + grid.wrapI(i0 + di);
    if (land[k]) continue;
    const w = (di ? fx : 1 - fx) * (dj ? fy : 1 - fy);
    wsum += w;
    for (let c = 0; c < 4; c++) {
      const val = field[k * 4 + c];
      S.v[c] += w * val;
      if (val < S.lo[c]) S.lo[c] = val;
      if (val > S.hi[c]) S.hi[c] = val;
    }
  }
  if (wsum < 1e-9) return false;
  for (let c = 0; c < 4; c++) S.v[c] /= wsum;
  return true;
}

function copyCell(src, dst, k) {
  for (let c = 0; c < 4; c++) dst[k * 4 + c] = src[k * 4 + c];
}

// Semi-Lagrangian: dst(x) = src(x − u·dt). Back-traces landing on land keep
// the cell's own value.
export function advect(ctx, src, dst, dtDays) {
  const { grid, land, vel } = ctx;
  const { nx, ny, cellKm, cosLat } = grid;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (land[k]) {
        dst.fill(0, k * 4, k * 4 + 4);
        continue;
      }
      const x = i - (vel[2 * k] * dtDays) / (cellKm * cosLat[j]);
      const y = j - (vel[2 * k + 1] * dtDays) / cellKm;
      if (sample(grid, land, src, x, y)) for (let c = 0; c < 4; c++) dst[k * 4 + c] = S.v[c];
      else copyCell(src, dst, k);
    }
  }
}

// BFECC with a min/max limiter: forward, backward, correct, forward again,
// then clamp to the range of the ORIGINAL field's source texels.
export function advectBFECC(ctx, state, out, dtDays) {
  const { grid, land, vel, a, b } = ctx;
  const { nx, ny, cellKm, cosLat } = grid;
  advect(ctx, state, a, dtDays);
  advect(ctx, a, b, -dtDays);
  for (let q = 0; q < b.length; q++) b[q] = state[q] + 0.5 * (state[q] - b[q]);
  const lo = new Float64Array(4);
  const hi = new Float64Array(4);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (land[k]) {
        out.fill(0, k * 4, k * 4 + 4);
        continue;
      }
      const x = i - (vel[2 * k] * dtDays) / (cellKm * cosLat[j]);
      const y = j - (vel[2 * k + 1] * dtDays) / cellKm;
      if (!sample(grid, land, state, x, y)) {
        copyCell(state, out, k);
        continue;
      }
      lo.set(S.lo);
      hi.set(S.hi);
      sample(grid, land, b, x, y);
      for (let c = 0; c < 4; c++) out[k * 4 + c] = Math.min(hi[c], Math.max(lo[c], S.v[c]));
    }
  }
}

// Explicit 5-point Laplacian, zero-flux at land (land neighbours mirror the
// centre), auto-substepped so D·h/Δx² ≤ 0.2 at the narrowest simulated row.
export function diffuse(ctx, src, dst, dtDays, D = EDDY_DIFFUSIVITY_KM2_DAY) {
  const { grid, land, d: tmp } = ctx;
  const { nx, ny, cellKm, cosLat } = grid;
  dst.set(src);
  if (!(D > 0)) return;
  let minDx = Infinity;
  for (let j = 0; j < ny; j++) {
    if (Math.abs(grid.latOf(j)) <= LAT_LIMIT) minDx = Math.min(minDx, cellKm * cosLat[j]);
  }
  const sub = Math.max(1, Math.ceil((D * dtDays) / (minDx * minDx) / 0.2));
  const h = dtDays / sub;
  const dy2 = cellKm * cellKm;
  for (let s = 0; s < sub; s++) {
    for (let j = 0; j < ny; j++) {
      const dx = cellKm * cosLat[j];
      const dx2 = dx * dx;
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (land[k]) {
          tmp.fill(0, k * 4, k * 4 + 4);
          continue;
        }
        const kE = grid.idx(i + 1, j);
        const kW = grid.idx(i - 1, j);
        const kN = j + 1 < ny ? k + nx : -1;
        const kS = j - 1 >= 0 ? k - nx : -1;
        for (let c = 0; c < 4; c++) {
          const C = dst[k * 4 + c];
          const E = land[kE] ? C : dst[kE * 4 + c];
          const W = land[kW] ? C : dst[kW * 4 + c];
          const N = kN < 0 || land[kN] ? C : dst[kN * 4 + c];
          const So = kS < 0 || land[kS] ? C : dst[kS * 4 + c];
          tmp[k * 4 + c] = C + D * h * ((E + W - 2 * C) / dx2 + (N + So - 2 * C) / dy2);
        }
      }
    }
    dst.set(tmp);
  }
}

// Exact per-cell kinetics over dt; deficit capped at DO saturation.
export function react(ctx, state, dtDays) {
  const { grid, land, rows } = ctx;
  const eT = Math.exp(-dtDays / TAU_T_DAYS);
  const eN = Math.exp(-dtDays / TAU_N_DAYS);
  for (let j = 0; j < grid.ny; j++) {
    const row = rows[j];
    for (let i = 0; i < grid.nx; i++) {
      const k = j * grid.nx + i;
      if (land[k]) continue;
      const q = k * 4;
      state[q] *= eT;
      const s = sagStep(state[q + 1], state[q + 3], row.kd, row.ka, dtDays);
      state[q + 1] = s.L;
      state[q + 2] *= eN;
      state[q + 3] = Math.min(s.D, row.doSat);
    }
  }
}

export function inject(ctx, state, sources, dtDays) {
  const { land } = ctx;
  for (const src of sources) {
    for (const { k, f } of src.cells) {
      if (land[k]) continue;
      for (let c = 0; c < 4; c++) state[k * 4 + c] += src.conc[c] * f * dtDays;
    }
  }
}

// NaN/∞ → 0, clamp ≥ 0, land = 0.
export function guard(ctx, state) {
  const { land } = ctx;
  for (let k = 0; k < land.length; k++) {
    const q = k * 4;
    if (land[k]) {
      state[q] = 0; state[q + 1] = 0; state[q + 2] = 0; state[q + 3] = 0;
      continue;
    }
    for (let c = 0; c < 4; c++) {
      const v = state[q + c];
      if (!(v >= 0 && v < 1e30)) state[q + c] = 0;
    }
  }
}

export function step(ctx, state, {
  dtDays = DT_DAYS,
  sources = [],
  reactions = true,
  diffusivity = EDDY_DIFFUSIVITY_KM2_DAY,
} = {}) {
  advectBFECC(ctx, state, ctx.c, dtDays);
  guard(ctx, ctx.c);
  diffuse(ctx, ctx.c, state, dtDays, diffusivity);
  guard(ctx, state);
  if (reactions) react(ctx, state, dtDays);
  inject(ctx, state, sources, dtDays);
  guard(ctx, state);
  return state;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/referenceStep.test.js`
Expected: PASS. If "drifts < 2%" fails, STOP and report the measured drift to the user (it decides whether the spec bound or the scheme changes). Do not change the threshold.

- [ ] **Step 5: Mutation checks**

1. In `advectBFECC`, replace the clamp line with `out[k * 4 + c] = S.v[c];`. "never overshoots" must FAIL. Revert. (If it passes, the pulse test is vacuous: widen the pulse edge sharpness or step count until the unlimited scheme overshoots, and record that in the commit message.)
2. In `sample`, replace `grid.wrapI(i0 + di)` with `Math.min(nx - 1, Math.max(0, i0 + di))`. "date line is seamless" must FAIL. Revert.
3. In `guard`, delete the `if (land[k]) { … continue; }` block. "land exactly zero" must FAIL (diffusion/injection write into land otherwise? if it still passes, also remove the land skip in `inject` and point the test source `k` at an island cell to confirm). Revert.
4. In `react`, remove `Math.min(…, row.doSat)`. The 10k-step test's DO_sat assertion must FAIL. Revert.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/ledger/ocean/referenceStep.js src/terminal/ledger/ocean/__tests__/referenceStep.test.js
git commit -m "feat(ledger-ocean): CPU reference step (BFECC + limiter, diffusion, exact reaction)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Sources (river → ocean)

**Files:**
- Create: `src/terminal/ledger/ocean/sources.js`
- Test: `src/terminal/ledger/ocean/__tests__/sources.test.js`

**Interfaces:**
- Consumes: `OCEAN_GRID` (Task 1); `riverState`, `kd`, `kaRiver`, `criticalTime`, `doSat` (Task 2); `buildLandMask`, `snapToOcean` (Task 3). Output feeds `inject` (Task 5).
- Produces:
  - Constants: `MIXED_LAYER_M = 20`, `SPLAT_SIGMA_CELLS = 1.5`, `USER_VELOCITY_MS = 0.5`, `USER_SNAP_RADIUS_CELLS = 64`
  - `haversineKm([lon, lat], [lon, lat])`, `courseLengthKm(course)`
  - `splatCells(grid, land, snap, dischargeM3s, sigma?, H?)` → `[{ k, f }]` with f in 1/day
  - `buildSource(spec, grid, mask)` → source or `null` (no ocean within `spec.snapRadius`). `spec = { id, kind: 'preset'|'verdict'|'ghost', kernel: { temp, do, bod, dt, nitrate }, course: [[lon, lat], …], dischargeM3s, velocityMs, depthM, snapRadius? }`. A one-point course becomes a straight line to its snapped ocean cell. Returns `{ id, kind, snap, course, lengthKm, travelDays, mouth: { dT, L, N, D }, conc: [dT, L, N, D], cells, critical: { tDays, kmFromSite, rkm, doMin }, dischargeM3s }`.
  - `verdictSourceSpec(verdict)`, `ghostSourceSpec(params)` → specs (Q = submitted `flow` in m³/s, v = 0.5 m/s, depth = `epi` ≥ 0.5 m)

- [ ] **Step 1: Write the failing test**

`src/terminal/ledger/ocean/__tests__/sources.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { OCEAN_GRID } from '../grid';
import { buildLandMask } from '../landMask';
import { riverState } from '../kinetics';
import {
  haversineKm, courseLengthKm, splatCells, buildSource,
  verdictSourceSpec, ghostSourceSpec, MIXED_LAYER_M,
} from '../sources';

const grid = OCEAN_GRID;
const mask = buildLandMask(grid);
const kernel = { temp: 12, do: 9.5, bod: 6, dt: 3.5, nitrate: 18, epi: 2.5, flow: 42 };

describe('geometry', () => {
  it('measures great-circle distance', () => {
    expect(haversineKm([0, 0], [1, 0])).toBeCloseTo(111.19, 1);
    expect(courseLengthKm([[0, 0], [1, 0], [2, 0]])).toBeCloseTo(222.39, 1);
    expect(courseLengthKm([[5, 5]])).toBe(0);
  });
});

describe('splatCells', () => {
  it('delivers exactly Q m³/s into the mixed layer', () => {
    const snap = { i: grid.lonLatToCell(-89.25, 29.15).i, j: grid.lonLatToCell(-89.25, 29.15).j };
    const Q = 17000;
    const cells = splatCells(grid, mask.land, snap, Q);
    let delivered = 0;
    for (const { k, f } of cells) {
      const j = Math.floor(k / grid.nx);
      const area = (grid.cellKm * 1000) ** 2 * grid.cosLat[j];
      delivered += (f * area * MIXED_LAYER_M) / 86400;
      expect(mask.land[k]).toBe(0);
    }
    expect(Math.abs(delivered - Q) / Q).toBeLessThan(1e-9);
  });
});

describe('buildSource', () => {
  const preset = {
    id: 'danube-test', kind: 'preset', kernel,
    course: [[14.29, 48.31], [29.75, 45.15]],
    dischargeM3s: 6500, velocityMs: 1, depthM: 6,
  };

  it('carries the river-stage state at travel time into the ocean', () => {
    const s = buildSource(preset, grid, mask);
    expect(s.lengthKm).toBeCloseTo(courseLengthKm(preset.course), 9);
    expect(s.travelDays).toBeCloseTo(s.lengthKm / 86.4, 9);
    const ref = riverState(kernel, s.travelDays, { velocityMs: 1, depthM: 6 });
    expect(s.mouth).toEqual(ref);
    expect(s.conc).toEqual([ref.dT, ref.L, ref.N, ref.D]);
    expect(s.cells.length).toBeGreaterThan(0);
  });

  it('places the critical point on the course with a non-negative DO minimum', () => {
    const s = buildSource({ ...preset, kernel: { ...kernel, bod: 40, do: 6 } }, grid, mask);
    expect(s.critical.tDays).toBeGreaterThan(0);
    expect(s.critical.tDays).toBeLessThanOrEqual(s.travelDays);
    expect(s.critical.rkm).toBeGreaterThanOrEqual(0);
    expect(s.critical.rkm).toBeLessThanOrEqual(s.lengthKm);
    expect(s.critical.doMin).toBeGreaterThanOrEqual(0);
  });

  it('drops a source with no ocean in reach', () => {
    expect(buildSource({ ...preset, course: [[14.29, 48.31]], snapRadius: 2 }, grid, mask)).toBeNull();
  });

  it('rejects a non-positive velocity', () => {
    expect(() => buildSource({ ...preset, velocityMs: 0 }, grid, mask)).toThrow();
  });
});

describe('user verdicts and the ghost', () => {
  const verdict = { hash: 'abc', coordinates: { lat: 48.31, lon: 14.29 }, input: { ...kernel } };

  it('drains a verdict in a straight line to its snapped ocean cell, Q = submitted flow', () => {
    const spec = verdictSourceSpec(verdict);
    expect(spec.kind).toBe('verdict');
    expect(spec.dischargeM3s).toBe(42);
    expect(spec.velocityMs).toBe(0.5);
    expect(spec.depthM).toBe(2.5);
    const s = buildSource(spec, grid, mask);
    expect(s.course).toHaveLength(2);
    expect(s.course[1]).toEqual([s.snap.lon, s.snap.lat]);
    expect(s.lengthKm).toBeGreaterThan(150);
    expect(s.lengthKm).toBeLessThan(900);
  });

  it('builds the ghost from raw form params, coercing strings', () => {
    const spec = ghostSourceSpec({ lat: '48.31', lon: '14.29', temp: '12', do: '9.5', bod: '6', dt: '3.5', nitrate: '18', epi: '0.1', flow: '42' });
    expect(spec.kind).toBe('ghost');
    expect(spec.depthM).toBe(0.5);
    const s = buildSource(spec, grid, mask);
    expect(s.conc.every((v) => Number.isFinite(v))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/sources.test.js`
Expected: FAIL — cannot resolve `../sources`.

- [ ] **Step 3: Implement `sources.js`**

```js
// sources.js — turns presets, sealed verdicts and the provisional ghost into
// ocean sources. River stage: point source, plug flow, no tributaries (HUD
// legend). Injection is physically dimensioned: ΔC = C_mouth·Q·Δt/(A_cell·H).

import { R_EARTH_KM } from './grid';
import { riverState, kd, kaRiver, criticalTime, doSat } from './kinetics';
import { snapToOcean } from './landMask';

export const MIXED_LAYER_M = 20;
export const SPLAT_SIGMA_CELLS = 1.5;
export const USER_VELOCITY_MS = 0.5;
export const USER_SNAP_RADIUS_CELLS = 64;

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
  const end = course[course.length - 1];
  const snap = snapToOcean(grid, mask.land, end[0], end[1], snapRadius);
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

function formSpec(id, kind, lon, lat, params) {
  return {
    id, kind,
    kernel: params,
    course: [[Number(lon), Number(lat)]],
    dischargeM3s: Number(params.flow),
    velocityMs: USER_VELOCITY_MS,
    depthM: Math.max(0.5, Number(params.epi)),
  };
}

export function verdictSourceSpec(verdict) {
  const { lat, lon } = verdict.coordinates;
  return formSpec(verdict.hash, 'verdict', lon, lat, verdict.input);
}

export function ghostSourceSpec(params) {
  return formSpec('ghost', 'ghost', params.lon, params.lat, params);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/ledger/ocean/__tests__/sources.test.js`
Expected: PASS.

- [ ] **Step 5: Mutation checks**

1. In `splatCells`, drop `* grid.cosLat[j]` from `area`. "delivers exactly Q" must FAIL. Revert.
2. In `buildSource`, replace `const fullCourse = …` with `const fullCourse = course;`. "straight line to its snapped ocean cell" must FAIL. Revert.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/ledger/ocean/sources.js src/terminal/ledger/ocean/__tests__/sources.test.js
git commit -m "feat(ledger-ocean): river-to-ocean sources with dimensioned injection

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Phase gate

**Files:**
- Modify: none (verification only), unless lint reports issues in the new files.

**Interfaces:**
- Consumes: everything above.
- Produces: a green phase-1 branch state for the phase-2 plan to build on.

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: all test files pass, including the pre-existing suite (`auditPresets.test.js` unchanged and green). Record the total test count in the report.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: 0 errors, and warnings do not exceed the configured `--max-warnings`. Fix any lint findings in the new `ledger/ocean` files only; do not touch unrelated files.

- [ ] **Step 3: Confirm the phase boundary**

Run: `git diff --stat main...HEAD -- src/terminal/views src/terminal/ledger/verdictStore.js src/terminal/ledger/ledgerBus.js src/terminal/ledger/auditPresets.js`
Expected: empty output — phase 1 changes no view, store, bus, or preset file.

- [ ] **Step 4: Commit lint fixes (only if Step 2 required changes)**

```bash
git add src/terminal/ledger/ocean
git commit -m "chore(ledger-ocean): lint fixes for the phase-1 core

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Do not push. Report to the user: test count, the measured mass drift, the max current speed and its location, and every mutation that unexpectedly did NOT fail.

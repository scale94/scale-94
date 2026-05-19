# Mercury Terminal · Philosophical Expansion v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mount three new sections + footer below the existing Mercury canvas in [src/terminal/views/MercuryTab.jsx](src/terminal/views/MercuryTab.jsx) — six live observation instruments (outer cosmos × inner mirror), four phase-bound fairy-tale castle cards, and an auto-accumulating observation log with markdown export. All backed by real Mercury orbital mechanics (WASM primary, pure-JS fallback).

**Architecture:** Mirror LunarTab's discipline: WASM-first computation with JS fallback, six monospace `ParamBar`s, accord-card-style grid, transit-matrix-style live log. Pure functions (Kepler math, instrument blends, phrase generation, markdown export) are TDD-tested; React components are built + manually verified in browser.

**Tech Stack:** React 19, Vite, Vitest, Rust → WASM (wasm-pack), Tailwind, existing `src/terminal/mercury/` directory.

**Spec:** [docs/superpowers/specs/2026-05-20-mercury-philosophical-expansion-design.md](docs/superpowers/specs/2026-05-20-mercury-philosophical-expansion-design.md)

---

## File map

**New files (10):**
- `src/terminal/mercury/mercuryStateFallback.js` — pure-JS Kepler implementation
- `src/terminal/mercury/useMercuryState.js` — React hook (WASM + fallback + 60s tick)
- `src/terminal/mercury/instruments.js` — six-instrument blend formulas (pure)
- `src/terminal/mercury/castles.js` — four castle data objects + ASCII silhouettes + status template fn
- `src/terminal/mercury/observationLog.js` — phrase pool + entry generator + markdown export (pure)
- `src/terminal/mercury/ParamBar.jsx` — extracted shared component
- `src/terminal/mercury/InstrumentsPanel.jsx` — §A component
- `src/terminal/mercury/CastleCard.jsx` + `CastleGrid.jsx` — §B components
- `src/terminal/mercury/ObservationMatrix.jsx` — §C component

**Modified files (3):**
- `content/rust_kernels/src/kernels/astro.rs` — add `run_mercury_state` function + Rust unit tests
- `src/terminal/views/MercuryTab.jsx` — mount new sections + footer below canvas grid; add one line to header
- `tests/mercury/*` — Vitest tests for the four pure-JS modules

---

## Task 1: Mercury Kepler fallback — math + tests

**Files:**
- Create: `src/terminal/mercury/mercuryStateFallback.js`
- Test: `tests/mercury/mercuryStateFallback.test.js`

- [ ] **Step 1: Write failing tests**

`tests/mercury/mercuryStateFallback.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { getMercuryStateFallback, keplerSolve } from '../../src/terminal/mercury/mercuryStateFallback';

describe('keplerSolve', () => {
  it('returns M when e=0 (circular orbit)', () => {
    expect(keplerSolve(1.5, 0)).toBeCloseTo(1.5, 6);
  });
  it('solves Mercury-like eccentricity in <8 iterations', () => {
    const E = keplerSolve(0.5, 0.2056);
    // Verify Kepler's equation holds: M = E - e·sin(E)
    expect(E - 0.2056 * Math.sin(E)).toBeCloseTo(0.5, 6);
  });
  it('handles M near pi', () => {
    const E = keplerSolve(Math.PI - 0.01, 0.2056);
    expect(E - 0.2056 * Math.sin(E)).toBeCloseTo(Math.PI - 0.01, 6);
  });
});

describe('getMercuryStateFallback', () => {
  it('returns expected shape', () => {
    const s = getMercuryStateFallback(new Date('2026-05-20T12:00:00Z'));
    expect(s).toHaveProperty('heliocentricDistanceAU');
    expect(s).toHaveProperty('trueAnomalyDeg');
    expect(s).toHaveProperty('solarFluxWm2');
    expect(s).toHaveProperty('subsolarLongitudeDeg');
    expect(s).toHaveProperty('subsolarTempK');
    expect(s).toHaveProperty('nightsideTempK');
    expect(s).toHaveProperty('earthMercuryDistanceAU');
    expect(s).toHaveProperty('daysToNextPerihelion');
    expect(s).toHaveProperty('phaseIllumination');
  });

  it('heliocentric distance stays within Mercury orbit bounds', () => {
    // Sample across a Mercury year (88 days)
    for (let d = 0; d < 88; d += 7) {
      const date = new Date(Date.UTC(2026, 0, 1 + d));
      const s = getMercuryStateFallback(date);
      expect(s.heliocentricDistanceAU).toBeGreaterThan(0.30);
      expect(s.heliocentricDistanceAU).toBeLessThan(0.48);
    }
  });

  it('subsolar temperature stays within physical bounds', () => {
    for (let d = 0; d < 88; d += 7) {
      const date = new Date(Date.UTC(2026, 0, 1 + d));
      const s = getMercuryStateFallback(date);
      expect(s.subsolarTempK).toBeGreaterThan(540);
      expect(s.subsolarTempK).toBeLessThan(740);
    }
  });

  it('nightside temperature is the regolith floor', () => {
    const s = getMercuryStateFallback(new Date('2026-05-20T12:00:00Z'));
    expect(s.nightsideTempK).toBe(100);
  });

  it('solar flux is inverse-square of distance', () => {
    const s = getMercuryStateFallback(new Date('2026-05-20T12:00:00Z'));
    const expected = 1361 / (s.heliocentricDistanceAU ** 2);
    expect(s.solarFluxWm2).toBeCloseTo(expected, 2);
  });

  it('days to next perihelion is within one Mercury orbital period', () => {
    const s = getMercuryStateFallback(new Date('2026-05-20T12:00:00Z'));
    expect(s.daysToNextPerihelion).toBeGreaterThanOrEqual(0);
    expect(s.daysToNextPerihelion).toBeLessThan(88);
  });

  it('earth-mercury distance stays within bounds (0.5 - 1.5 AU)', () => {
    for (let d = 0; d < 365; d += 30) {
      const date = new Date(Date.UTC(2026, 0, 1 + d));
      const s = getMercuryStateFallback(date);
      expect(s.earthMercuryDistanceAU).toBeGreaterThan(0.5);
      expect(s.earthMercuryDistanceAU).toBeLessThan(1.5);
    }
  });

  it('subsolar longitude wraps in [0, 360)', () => {
    const s = getMercuryStateFallback(new Date('2026-05-20T12:00:00Z'));
    expect(s.subsolarLongitudeDeg).toBeGreaterThanOrEqual(0);
    expect(s.subsolarLongitudeDeg).toBeLessThan(360);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/mercury/mercuryStateFallback.test.js
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement `mercuryStateFallback.js`**

`src/terminal/mercury/mercuryStateFallback.js`:

```js
// mercuryStateFallback.js — Pure-JS Mercury orbital state
//
// Mirror of getLunarAgeFallback in LunarTab.jsx. WASM is primary; this fires
// only when WASM hasn't loaded (private browsing, slow connection, error).
//
// References:
//   Meeus J., Astronomical Algorithms, 2nd ed. (1998), ch.32
//   Standish E.M., JPL Planetary Ephemerides (2000)
//   Pettengill & Dyce (1965): Mercury 3:2 spin-orbit resonance
//   Kopp & Lean (2011): Solar constant 1361 W/m²

const J2000_MS  = 946728000000;          // 2000-01-01 12:00 UTC
const DAY_MS    = 86_400_000;
const DEG       = Math.PI / 180;

// Mercury orbital elements at J2000 (Standish/JPL, ecliptic frame)
const MERCURY = {
  a:           0.38709843,                // AU
  e:           0.20563661,
  i_rad:       7.00559432 * DEG,
  L0_rad:    252.25166724 * DEG,          // mean longitude at epoch
  varpi_rad:  77.45771895 * DEG,          // longitude of perihelion
  Omega_rad:  48.33961819 * DEG,          // longitude of ascending node
  period_d:   87.9691,
  n_rad_per_day: (2 * Math.PI) / 87.9691, // mean motion
};

// Earth orbital elements (used for Earth-Mercury distance)
const EARTH = {
  a:           1.00000018,
  e:           0.01673163,
  L0_rad:    100.46457166 * DEG,
  varpi_rad: 102.93768193 * DEG,
  period_d:  365.256363,
  n_rad_per_day: (2 * Math.PI) / 365.256363,
};

export function keplerSolve(M, e) {
  // Newton-Raphson, converges in ~5 iterations for e<0.3
  let E = M;
  for (let i = 0; i < 8; i++) {
    const f  = E - e * Math.sin(E) - M;
    const fp = 1 - e * Math.cos(E);
    E = E - f / fp;
  }
  return E;
}

function normalizeRad(x) {
  const TWO_PI = 2 * Math.PI;
  let r = x % TWO_PI;
  if (r < 0) r += TWO_PI;
  return r;
}

function heliocentricStateAU(elems, daysSinceJ2000) {
  // Mean anomaly M = L − ϖ (mean longitude minus longitude of perihelion)
  const L = elems.L0_rad + elems.n_rad_per_day * daysSinceJ2000;
  const M = normalizeRad(L - elems.varpi_rad);
  const E = keplerSolve(M, elems.e);
  // True anomaly ν from eccentric anomaly E
  const cosE = Math.cos(E), sinE = Math.sin(E);
  const r = elems.a * (1 - elems.e * cosE);
  const nu = Math.atan2(Math.sqrt(1 - elems.e * elems.e) * sinE, cosE - elems.e);
  // Heliocentric ecliptic coordinates in the orbital plane (z=0 approx)
  const lon = normalizeRad(nu + elems.varpi_rad);
  return {
    r,
    nu,
    L,
    x: r * Math.cos(lon),
    y: r * Math.sin(lon),
  };
}

function daysToNextPerihelionFn(elems, daysSinceJ2000) {
  // Mercury's perihelion epoch: J2000 + a small offset.
  // Mean anomaly = 0 at perihelion. Solve for next M=0.
  const L = elems.L0_rad + elems.n_rad_per_day * daysSinceJ2000;
  const M = normalizeRad(L - elems.varpi_rad);
  // Days until M reaches 2π (next perihelion)
  const remaining = (2 * Math.PI - M) / elems.n_rad_per_day;
  return remaining;
}

function subsolarLongitudeDeg(daysSinceJ2000) {
  // Mercury's 3:2 spin-orbit resonance: sidereal rotation period = 58.6462 d
  // and orbital period = 87.9691 d. Two solar days = three sidereal days.
  // The two "hot poles" at lon 0° and 180° face the Sun alternately at perihelion.
  // Reference: anchor subsolar longitude to 0° at J2000 (good enough for art project;
  // exact phase requires Mercury rotation pole epoch from IAU 2015 report).
  const sidereal_period_d = 58.6462;
  const orbital_period_d  = 87.9691;
  // Mercury solar day (sunrise to sunrise) = 1 / (1/sidereal - 1/orbital)
  const solar_day_d = 1 / (1 / sidereal_period_d - 1 / orbital_period_d);
  // Solar day on Mercury is ~176 Earth days.
  // Subsolar longitude advances 360° per solar day.
  const lon = (daysSinceJ2000 / solar_day_d) * 360;
  return ((lon % 360) + 360) % 360;
}

export function getMercuryStateFallback(date = new Date()) {
  const daysSinceJ2000 = (date.getTime() - J2000_MS) / DAY_MS;

  const merc  = heliocentricStateAU(MERCURY, daysSinceJ2000);
  const earth = heliocentricStateAU(EARTH,   daysSinceJ2000);

  const dx = merc.x - earth.x;
  const dy = merc.y - earth.y;
  const earthMercuryDistanceAU = Math.sqrt(dx * dx + dy * dy);

  const S0 = 1361;                                   // W/m² at 1 AU
  const ALBEDO = 0.142;                              // Bond albedo, Mercury
  const EMISSIVITY = 0.95;
  const SIGMA = 5.670374419e-8;                      // Stefan-Boltzmann

  const solarFluxWm2 = S0 / (merc.r * merc.r);
  const subsolarTempK = Math.pow(
    ((1 - ALBEDO) * solarFluxWm2) / (EMISSIVITY * SIGMA),
    0.25,
  );

  // Mercury phase angle as seen from Earth (illuminated fraction)
  // Standard formula: cos(phaseAngle) = (r² + Δ² − R²) / (2·r·Δ)
  // where r=helio dist, Δ=geocentric dist, R=Earth-Sun dist (= |earth.r|)
  const Rearth = Math.sqrt(earth.x * earth.x + earth.y * earth.y);
  const cosAlpha = (merc.r * merc.r + earthMercuryDistanceAU * earthMercuryDistanceAU - Rearth * Rearth)
    / (2 * merc.r * earthMercuryDistanceAU);
  const alpha = Math.acos(Math.max(-1, Math.min(1, cosAlpha)));
  const phaseIllumination = (1 + Math.cos(alpha)) / 2;

  return {
    heliocentricDistanceAU:  merc.r,
    trueAnomalyDeg:          (merc.nu * 180 / Math.PI + 360) % 360,
    solarFluxWm2,
    subsolarLongitudeDeg:    subsolarLongitudeDeg(daysSinceJ2000),
    subsolarTempK,
    nightsideTempK:          100,
    earthMercuryDistanceAU,
    daysToNextPerihelion:    daysToNextPerihelionFn(MERCURY, daysSinceJ2000),
    phaseIllumination,
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run tests/mercury/mercuryStateFallback.test.js
```

Expected: 9 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/mercuryStateFallback.js tests/mercury/mercuryStateFallback.test.js
git commit -m "feat(mercury): pure-JS Kepler fallback for Mercury orbital state"
```

---

## Task 2: Rust WASM extension — `run_mercury_state`

**Files:**
- Modify: `content/rust_kernels/src/kernels/astro.rs` (add function + tests at end of file, before existing `#[cfg(test)] mod tests`)

- [ ] **Step 1: Append new function to `astro.rs`**

Insert these constants and function after `run_astro` (around line 142, before the `#[cfg(test)] mod tests` block):

```rust
// ── Mercury Orbital State ────────────────────────────────────────────────────
//
// Real-time Mercury state for the Mercury Terminal alien architect.
// Reuses helio_lon (Meeus App. II) for Mercury's mean longitude.
// Solves Kepler's equation locally for true anomaly and heliocentric distance.
//
// References:
//   Meeus J., Astronomical Algorithms, 2nd ed., ch.32
//   Pettengill & Dyce (1965): Mercury 3:2 spin-orbit resonance
//   Kopp & Lean (2011): Solar constant 1361 W/m²

const MERCURY_A: f64 = 0.38709843;
const MERCURY_E: f64 = 0.20563661;
const MERCURY_VARPI_DEG: f64 = 77.45771895;
const MERCURY_PERIOD_D: f64 = 87.9691;
const MERCURY_SIDEREAL_D: f64 = 58.6462;
const EARTH_A: f64 = 1.00000018;
const EARTH_E: f64 = 0.01673163;
const EARTH_VARPI_DEG: f64 = 102.93768193;

const S0_WM2: f64 = 1361.0;
const ALBEDO: f64 = 0.142;
const EMISSIVITY: f64 = 0.95;
const SIGMA: f64 = 5.670374419e-8;

fn kepler_solve(m: f64, e: f64) -> f64 {
    let mut big_e = m;
    for _ in 0..8 {
        let f  = big_e - e * big_e.sin() - m;
        let fp = 1.0 - e * big_e.cos();
        big_e -= f / fp;
    }
    big_e
}

fn normalize_rad(x: f64) -> f64 {
    let two_pi = 2.0 * std::f64::consts::PI;
    let r = x % two_pi;
    if r < 0.0 { r + two_pi } else { r }
}

// Returns (r, x, y, true_anomaly_rad) — heliocentric AU
fn helio_state(body: usize, t: f64, varpi_deg: f64, a: f64, e: f64) -> (f64, f64, f64, f64) {
    let l_rad = helio_lon(body, t) * DEG;
    let varpi_rad = varpi_deg * DEG;
    let m = normalize_rad(l_rad - varpi_rad);
    let big_e = kepler_solve(m, e);
    let r = a * (1.0 - e * big_e.cos());
    let nu = (((1.0 - e * e).sqrt()) * big_e.sin()).atan2(big_e.cos() - e);
    let lon = normalize_rad(nu + varpi_rad);
    (r, r * lon.cos(), r * lon.sin(), nu)
}

#[wasm_bindgen]
pub fn run_mercury_state(unix_ms: f64) -> String {
    let t = unix_ms_to_t(unix_ms);
    let (r_m, x_m, y_m, nu_m) = helio_state(0, t, MERCURY_VARPI_DEG, MERCURY_A, MERCURY_E);
    let (r_e, x_e, y_e, _)    = helio_state(2, t, EARTH_VARPI_DEG,   EARTH_A,   EARTH_E);

    let dx = x_m - x_e;
    let dy = y_m - y_e;
    let d_em = (dx * dx + dy * dy).sqrt();

    let solar_flux = S0_WM2 / (r_m * r_m);
    let t_sub = (((1.0 - ALBEDO) * solar_flux) / (EMISSIVITY * SIGMA)).powf(0.25);

    // Days to next perihelion (M reaches 2π)
    let l_rad = helio_lon(0, t) * DEG;
    let m_now = normalize_rad(l_rad - MERCURY_VARPI_DEG * DEG);
    let n_rad_per_day = 2.0 * std::f64::consts::PI / MERCURY_PERIOD_D;
    let days_to_peri = (2.0 * std::f64::consts::PI - m_now) / n_rad_per_day;

    // Subsolar longitude — 3:2 resonance, anchor at 0° at J2000
    let days_since_j2000 = (unix_ms - 946728000000.0) / 86_400_000.0;
    let solar_day_d = 1.0 / (1.0 / MERCURY_SIDEREAL_D - 1.0 / MERCURY_PERIOD_D);
    let lon_raw = (days_since_j2000 / solar_day_d) * 360.0;
    let subsolar_lon = ((lon_raw % 360.0) + 360.0) % 360.0;

    // Mercury phase angle as seen from Earth
    let cos_alpha = ((r_m * r_m + d_em * d_em - r_e * r_e) / (2.0 * r_m * d_em))
        .max(-1.0).min(1.0);
    let alpha = cos_alpha.acos();
    let phase_illum = (1.0 + alpha.cos()) / 2.0;

    format!(
        "{{\"heliocentricDistanceAU\":{},\"trueAnomalyDeg\":{},\"solarFluxWm2\":{},\"subsolarLongitudeDeg\":{},\"subsolarTempK\":{},\"nightsideTempK\":100,\"earthMercuryDistanceAU\":{},\"daysToNextPerihelion\":{},\"phaseIllumination\":{}}}",
        r_m,
        (nu_m.to_degrees() + 360.0) % 360.0,
        solar_flux,
        subsolar_lon,
        t_sub,
        d_em,
        days_to_peri,
        phase_illum,
    )
}
```

- [ ] **Step 2: Add Rust unit tests inside the existing `#[cfg(test)] mod tests` block**

Append these inside the existing `mod tests { … }` block at the end of `astro.rs`:

```rust
    #[test]
    fn test_kepler_solve_circular() {
        let e = kepler_solve(1.5, 0.0);
        assert!((e - 1.5).abs() < 1e-9);
    }

    #[test]
    fn test_kepler_solve_mercury_eccentricity() {
        let e_anom = kepler_solve(0.5, 0.2056);
        // M = E - e·sin(E)
        let m = e_anom - 0.2056 * e_anom.sin();
        assert!((m - 0.5).abs() < 1e-6);
    }

    #[test]
    fn test_mercury_state_distance_in_bounds() {
        // Sample across two Mercury years
        for d in 0..180 {
            let ts = 1_700_000_000_000.0 + (d as f64) * 86_400_000.0;
            let json = run_mercury_state(ts);
            // crude extraction: find the "heliocentricDistanceAU":X.XXX, value
            let start = json.find("\"heliocentricDistanceAU\":").unwrap() + 25;
            let end   = json[start..].find(',').unwrap() + start;
            let r: f64 = json[start..end].parse().unwrap();
            assert!(r > 0.30 && r < 0.48, "Day {}: r={}", d, r);
        }
    }

    #[test]
    fn test_mercury_state_subsolar_temp_in_bounds() {
        let json = run_mercury_state(1_700_000_000_000.0);
        let start = json.find("\"subsolarTempK\":").unwrap() + 16;
        let end   = json[start..].find(',').unwrap() + start;
        let t: f64 = json[start..end].parse().unwrap();
        assert!(t > 540.0 && t < 740.0, "subsolarTempK={}", t);
    }

    #[test]
    fn test_mercury_state_json_keys_present() {
        let json = run_mercury_state(1_700_000_000_000.0);
        for key in &[
            "heliocentricDistanceAU", "trueAnomalyDeg", "solarFluxWm2",
            "subsolarLongitudeDeg", "subsolarTempK", "nightsideTempK",
            "earthMercuryDistanceAU", "daysToNextPerihelion", "phaseIllumination",
        ] {
            assert!(json.contains(key), "missing key {}: {}", key, json);
        }
    }
```

- [ ] **Step 3: Run Rust tests**

```bash
cd content/rust_kernels && cargo test --lib astro
```

Expected: all astro tests pass (including the 5 new ones).

- [ ] **Step 4: Commit**

```bash
git add content/rust_kernels/src/kernels/astro.rs
git commit -m "feat(astro): run_mercury_state WASM export — Kepler + thermal + phase"
```

---

## Task 3: Rebuild WASM and verify JS export

**Files:** none modified — this is a build step.

- [ ] **Step 1: Rebuild WASM artifacts**

```bash
npm run rust:import
```

Expected: wasm-pack compiles, `src/wasm/scale94_kernels.js` and `public/wasm/scale94_kernels_bg.wasm` are regenerated. No errors.

- [ ] **Step 2: Verify `run_mercury_state` is exported**

```bash
grep "run_mercury_state" src/wasm/scale94_kernels.js
```

Expected: at least one match (`export function run_mercury_state(...)`).

- [ ] **Step 3: Commit regenerated WASM artifacts**

```bash
git add src/wasm/scale94_kernels.js src/wasm/scale94_kernels.d.ts public/wasm/scale94_kernels_bg.wasm src/wasm/scale94_kernels_bg.wasm.d.ts
git commit -m "build(wasm): regenerate bindings with run_mercury_state"
```

---

## Task 4: `useMercuryState` React hook

**Files:**
- Create: `src/terminal/mercury/useMercuryState.js`

- [ ] **Step 1: Implement the hook**

`src/terminal/mercury/useMercuryState.js`:

```js
// useMercuryState.js — Mercury orbital state, WASM primary + JS fallback + 60s tick
//
// Mirrors LunarTab's WASM hook pattern. Returns the JSON shape from
// run_mercury_state (Rust) or getMercuryStateFallback (JS) — identical schema.

import { useState, useEffect, useMemo } from 'react';
import { loadWasm } from '../../wasm/wasmSingleton';
import { getMercuryStateFallback } from './mercuryStateFallback';

let _wasmMod = null;

function getMercuryFromWasm(date) {
  if (!_wasmMod || typeof _wasmMod.run_mercury_state !== 'function') return null;
  try {
    return JSON.parse(_wasmMod.run_mercury_state(date.getTime()));
  } catch {
    return null;
  }
}

export function useMercuryState() {
  const [now, setNow] = useState(() => new Date());
  const [wasmReady, setWasmReady] = useState(false);

  useEffect(() => {
    loadWasm().then(mod => { _wasmMod = mod; setWasmReady(true); }).catch(() => {});
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const nowMs = now.getTime();
  return useMemo(
    () => getMercuryFromWasm(now) ?? getMercuryStateFallback(now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nowMs, wasmReady],
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/terminal/mercury/useMercuryState.js
git commit -m "feat(mercury): useMercuryState hook (WASM + fallback + 60s tick)"
```

---

## Task 5: `instruments.js` — six-instrument blend formulas

**Files:**
- Create: `src/terminal/mercury/instruments.js`
- Test: `tests/mercury/instruments.test.js`

- [ ] **Step 1: Write failing tests**

`tests/mercury/instruments.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { computeInstruments } from '../../src/terminal/mercury/instruments';

const mockMercury = {
  heliocentricDistanceAU:  0.387,    // baseline (semi-major axis)
  solarFluxWm2:            9080,
  subsolarTempK:           650,
  earthMercuryDistanceAU:  0.9,
};

const mockCanvas = {
  activePhase:   'fluid',
  turbulence:    0.25,
  density:       1200,
  speed:         0.1,
  curlAmp:       0.02,
  eruptStrength: 0.8,
  spread:        1.0,
  chromatic:     0.0,
  orbitalSpeed:  1.2,
  flameWidth:    0.85,
};

describe('computeInstruments', () => {
  it('returns exactly six instruments', () => {
    expect(computeInstruments(mockMercury, mockCanvas)).toHaveLength(6);
  });

  it('each instrument has label, unit, value, min, max', () => {
    const arr = computeInstruments(mockMercury, mockCanvas);
    for (const inst of arr) {
      expect(inst).toHaveProperty('label');
      expect(inst).toHaveProperty('unit');
      expect(inst).toHaveProperty('value');
      expect(inst).toHaveProperty('min');
      expect(inst).toHaveProperty('max');
      expect(typeof inst.value).toBe('number');
      expect(Number.isFinite(inst.value)).toBe(true);
    }
  });

  it('PROMISE HALF-LIFE shortens with turbulence', () => {
    const calm   = computeInstruments(mockMercury, { ...mockCanvas, turbulence: 0.0 });
    const stormy = computeInstruments(mockMercury, { ...mockCanvas, turbulence: 0.9 });
    const calmVal   = calm.find(i => i.label === 'PROMISE HALF-LIFE').value;
    const stormyVal = stormy.find(i => i.label === 'PROMISE HALF-LIFE').value;
    expect(stormyVal).toBeLessThan(calmVal);
  });

  it('WORSHIP TEMPERATURE equals subsolar temp when EARTH phase inactive', () => {
    const result = computeInstruments(mockMercury, { ...mockCanvas, activePhase: 'fluid' });
    const worship = result.find(i => i.label === 'WORSHIP TEMPERATURE').value;
    expect(worship).toBeCloseTo(650, 0);
  });

  it('WORSHIP TEMPERATURE amplified when EARTH phase active', () => {
    const result = computeInstruments(mockMercury, {
      ...mockCanvas, activePhase: 'earth', eruptStrength: 1.0,
    });
    const worship = result.find(i => i.label === 'WORSHIP TEMPERATURE').value;
    expect(worship).toBeGreaterThan(650);
  });

  it('FORGETTING FLUX is inverse-square of earth-mercury distance', () => {
    const near = computeInstruments(
      { ...mockMercury, earthMercuryDistanceAU: 0.6 },
      { ...mockCanvas, chromatic: 0.9 },
    );
    const far  = computeInstruments(
      { ...mockMercury, earthMercuryDistanceAU: 1.4 },
      { ...mockCanvas, chromatic: 0.9 },
    );
    const nearVal = near.find(i => i.label === 'FORGETTING FLUX').value;
    const farVal  = far.find(i => i.label === 'FORGETTING FLUX').value;
    expect(nearVal).toBeGreaterThan(farVal);
  });

  it('GRIEF INDEX modulator active only in FLUID or AIR phase', () => {
    const fluid   = computeInstruments(mockMercury, { ...mockCanvas, activePhase: 'fluid',   curlAmp: 0.1 });
    const thermal = computeInstruments(mockMercury, { ...mockCanvas, activePhase: 'thermal', curlAmp: 0.1 });
    const fluidGrief   = fluid.find(i => i.label === 'GRIEF INDEX').value;
    const thermalGrief = thermal.find(i => i.label === 'GRIEF INDEX').value;
    // In fluid, curlAmp boost applies; in thermal, modulator is identity
    expect(fluidGrief).toBeGreaterThan(thermalGrief);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/mercury/instruments.test.js
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement `instruments.js`**

`src/terminal/mercury/instruments.js`:

```js
// instruments.js — Six alien observation instruments
//
// Each instrument's displayed value = baseline(orbital) × modulator(canvas).
// Baselines pull from Mercury's real orbital state; modulators pull from the
// user's live canvas controls. The canvas is the alien's instrument.

const MAX_ORBITAL_SPEED = 2.0;   // canvas-internal scale; tune if controls change
const MAX_SPEED         = 1.0;
const REF_DENSITY       = 1200;
const REF_AU            = 0.387;
const MAX_CLOSURE_RATE  = 0.0008;   // AU/day (nominal max Earth-Mercury closure)

export function computeInstruments(mercury, canvas) {
  const {
    heliocentricDistanceAU: r,
    solarFluxWm2,
    subsolarTempK,
    earthMercuryDistanceAU: dEM,
  } = mercury;
  const {
    activePhase,
    turbulence = 0,
    density    = REF_DENSITY,
    speed      = 0.1,
    curlAmp    = 0,
    eruptStrength = 0,
    spread     = 0,
    chromatic  = 0,
    orbitalSpeed = 0,
  } = canvas;

  // 1. PROMISE HALF-LIFE (d): 28 · (r/0.387)² · (1 − turbulence)
  const promise = 28 * Math.pow(r / REF_AU, 2) * (1 - turbulence);

  // 2. ATTENTION VISCOSITY (Pa·s): 0.42·(1 − orbitalSpeed/max) · √(density/REF_DENSITY)
  const viscosity = 0.42
    * (1 - Math.min(1, orbitalSpeed / MAX_ORBITAL_SPEED))
    * Math.sqrt(density / REF_DENSITY);

  // 3. WORSHIP TEMPERATURE (K): subsolar temp · (1 + 0.4·eruptStrength) when EARTH
  const worship = subsolarTempK
    * (activePhase === 'earth' ? (1 + 0.4 * eruptStrength) : 1);

  // 4. MIGRATION DRIFT (σ): closure rate normalized · (speed/0.1)
  //   Note: we don't have d/dt without sampling two states; approximate as the
  //   sign of dEM relative to mean Earth-Mercury distance (~1.0 AU).
  //   Cleaner derivative-based MIGRATION DRIFT is a Phase 3 refinement.
  const closureProxy = (1.0 - dEM) / MAX_CLOSURE_RATE / 100;   // normalized [-2.4, +2.4]
  const drift = closureProxy * (speed / 0.1);

  // 5. GRIEF INDEX (idx): 1 − normalized(solarFlux); modulated in FLUID or AIR
  const fluxNorm = Math.min(1, solarFluxWm2 / 14500);          // 14500 ≈ perihelion peak
  const griefBase = 1 - fluxNorm;
  const griefMod = activePhase === 'fluid' ? (1 + curlAmp * 8)
    : activePhase === 'air' ? (1 + spread * 0.3)
    : 1;
  const grief = griefBase * griefMod;

  // 6. FORGETTING FLUX (bit/m²·s): 1 / dEM² · (chromatic + 0.1)
  const forgetting = (1 / (dEM * dEM)) * (chromatic + 0.1);

  return [
    { label: 'PROMISE HALF-LIFE',   unit: 'd',         value: promise,    min: 0.8,  max: 38   },
    { label: 'ATTENTION VISCOSITY', unit: 'Pa·s',      value: viscosity,  min: 0.001, max: 1.0 },
    { label: 'WORSHIP TEMPERATURE', unit: 'K',         value: worship,    min: 540,  max: 980  },
    { label: 'MIGRATION DRIFT',     unit: 'σ',         value: drift,      min: -2.4, max: 2.4  },
    { label: 'GRIEF INDEX',         unit: 'idx',       value: grief,      min: 0,    max: 1    },
    { label: 'FORGETTING FLUX',     unit: 'bit/m²·s',  value: forgetting, min: 0.4,  max: 9.2  },
  ];
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run tests/mercury/instruments.test.js
```

Expected: 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/instruments.js tests/mercury/instruments.test.js
git commit -m "feat(mercury): six-instrument blend (outer cosmos × inner mirror)"
```

---

## Task 6: Extract `ParamBar` to shared component

**Files:**
- Create: `src/terminal/mercury/ParamBar.jsx`
- Modify: `src/terminal/views/LunarTab.jsx` (replace inline `ParamBar` with import)

- [ ] **Step 1: Create the extracted component**

`src/terminal/mercury/ParamBar.jsx`:

```jsx
// ParamBar.jsx — Shared monospace bar used by Lunar's environmental modulators
// panel and Mercury's observation instruments panel.

export default function ParamBar({ label, value, unit, min, max, color }) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 text-[8px] sm:text-[9px] font-mono">
      <span className="w-14 sm:w-20 text-right text-zinc-500 uppercase tracking-wider sm:tracking-widest shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-zinc-200/[0.04] rounded-full overflow-hidden min-w-0">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 sm:w-16 text-zinc-400 tabular-nums text-right shrink-0">
        {typeof value === 'number' ? value.toFixed(3) : value}
        {unit && <span className="ml-1 text-zinc-600">{unit}</span>}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Replace `ParamBar` in `LunarTab.jsx` with the import**

In [src/terminal/views/LunarTab.jsx](src/terminal/views/LunarTab.jsx):

Delete lines 750–761 (the inline `function ParamBar(...)` definition), and add this import near the existing import block at the top of the file:

```js
import ParamBar from '../mercury/ParamBar';
```

(Place it after `import { parseAstroOutput, computeAspect } from '../mercury/tfgAstroHelpers';`.)

- [ ] **Step 3: Run existing Lunar tests + smoke**

```bash
npx vitest run tests/mercury
```

Expected: no test regressions. The new `ParamBar` adds an optional `unit` suffix — Lunar's existing calls already pass `unit`, so they keep rendering identically. (The Lunar component previously ignored the `unit` prop; this is the only behavioral change, and it's additive.)

- [ ] **Step 4: Manual smoke — open Lunar tab in dev server**

```bash
npm run dev
```

Open the Lunar tab in browser. Verify the six environmental modulator bars still render correctly. The unit suffix (`idx`, `hPa`, `W/m²`, `×`, `°C`) now appears next to each value — that's the new behavior.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/ParamBar.jsx src/terminal/views/LunarTab.jsx
git commit -m "refactor(mercury): extract ParamBar to shared component (adds unit suffix)"
```

---

## Task 7: `InstrumentsPanel.jsx` — §A component

**Files:**
- Create: `src/terminal/mercury/InstrumentsPanel.jsx`

- [ ] **Step 1: Implement the panel**

`src/terminal/mercury/InstrumentsPanel.jsx`:

```jsx
// InstrumentsPanel.jsx — §A: Six alien observation instruments.
// Outer cosmos baselines × inner mirror modulators.

import ParamBar from './ParamBar';
import { computeInstruments } from './instruments';

const BAR_COLOR = 'bg-gradient-to-r from-zinc-500 to-zinc-200';

export default function InstrumentsPanel({ mercury, canvas }) {
  if (!mercury) return null;
  const instruments = computeInstruments(mercury, canvas);

  return (
    <div className="border border-zinc-600/[0.05] rounded-lg bg-black/30 p-4 mt-8">
      <div className="text-[10px] font-mono text-zinc-400/80 uppercase tracking-[0.2em] mb-1">
        ◉ OBSERVATION INSTRUMENTS — outer cosmos × inner mirror
      </div>
      <div className="text-[8px] font-mono text-zinc-600 mb-3">
        // six readings · the sphere is the instrument · all values computed
      </div>

      <div className="space-y-2.5">
        {instruments.map(inst => (
          <ParamBar
            key={inst.label}
            label={inst.label}
            value={inst.value}
            unit={inst.unit}
            min={inst.min}
            max={inst.max}
            color={BAR_COLOR}
          />
        ))}
      </div>

      <div className="mt-3 pt-2 border-t border-zinc-600/[0.04] text-[7px] font-mono text-zinc-600 leading-relaxed">
        // derived from astro.rs · solar flux 1361 W/m² (1 AU) · canvas state vector
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/terminal/mercury/InstrumentsPanel.jsx
git commit -m "feat(mercury): InstrumentsPanel — six live alien observation readings"
```

---

## Task 8: `castles.js` — four castle data objects

**Files:**
- Create: `src/terminal/mercury/castles.js`
- Test: `tests/mercury/castles.test.js`

- [ ] **Step 1: Write failing tests**

`tests/mercury/castles.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { CASTLES, buildStatusLine, J2000_MS } from '../../src/terminal/mercury/castles';

describe('CASTLES', () => {
  it('has exactly four castles', () => {
    expect(CASTLES).toHaveLength(4);
  });

  it('one castle per phase id', () => {
    const phases = CASTLES.map(c => c.phase).sort();
    expect(phases).toEqual(['air', 'earth', 'fluid', 'thermal']);
  });

  it('each castle has required fields', () => {
    for (const c of CASTLES) {
      expect(c).toHaveProperty('phase');
      expect(c).toHaveProperty('glyph');
      expect(c).toHaveProperty('name');
      expect(c).toHaveProperty('silhouette');
      expect(c).toHaveProperty('commemorates');
      expect(c).toHaveProperty('builtFrom');
      expect(c).toHaveProperty('cycle');
      expect(c).toHaveProperty('dedication');
      expect(typeof c.statusFn).toBe('function');
      // Silhouette is 4 lines of monospace text
      expect(c.silhouette.split('\n')).toHaveLength(4);
    }
  });
});

describe('buildStatusLine', () => {
  const mockMercury = {
    heliocentricDistanceAU: 0.4,
    subsolarTempK: 650,
    daysToNextPerihelion: 30,
    subsolarLongitudeDeg: 45,
    earthMercuryDistanceAU: 1.0,
  };
  const mockCanvas = {
    turbulence: 0.3, eruptStrength: 0.8, flameWidth: 0.85, spread: 1.0,
  };
  const fixedDate = new Date('2026-05-20T12:00:00Z');

  it('FLUID status mentions subsolar temp and graphene tension', () => {
    const fluid = CASTLES.find(c => c.phase === 'fluid');
    const line = fluid.statusFn(mockMercury, mockCanvas, fixedDate);
    expect(line).toMatch(/Nave \d+ of 23/);
    expect(line).toMatch(/650/);
    expect(line).toMatch(/graphene tension/);
  });

  it('THERMAL status mentions hearth number and perihelion countdown', () => {
    const thermal = CASTLES.find(c => c.phase === 'thermal');
    const line = thermal.statusFn(mockMercury, mockCanvas, fixedDate);
    expect(line).toMatch(/Hearth \d+ of 49/);
    expect(line).toMatch(/T−30d/);
  });

  it('EARTH status mentions wall course and longitude offset', () => {
    const earth = CASTLES.find(c => c.phase === 'earth');
    const line = earth.statusFn(mockMercury, mockCanvas, fixedDate);
    expect(line).toMatch(/Wall course/);
    expect(line).toMatch(/hot-pole face/);
  });

  it('AIR status mentions filament and earth-mercury distance', () => {
    const air = CASTLES.find(c => c.phase === 'air');
    const line = air.statusFn(mockMercury, mockCanvas, fixedDate);
    expect(line).toMatch(/Filament \d+/);
    expect(line).toMatch(/1\.000 AU/);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/mercury/castles.test.js
```

- [ ] **Step 3: Implement `castles.js`**

`src/terminal/mercury/castles.js`:

```js
// castles.js — Four fairy-tale castles the alien is building on Mercury
//
// Each castle binds to one of the four phases (fluid/thermal/earth/air).
// The active-phase card glows. The STATUS line is live-bound to Mercury
// orbital state + canvas state.

export const J2000_MS = 946728000000;
const DAY_MS  = 86_400_000;
const MERCURY_ORBIT_D     = 87.9691;
const MERCURY_SOLAR_DAY_D = 175.94;       // sunrise-to-sunrise
const EARTH_MERCURY_SYNODIC_D = 115.88;
const CATHEDRAL_BUILD_YR = 47;
const CATHEDRAL_NAVES    = 23;
const FORGE_HEARTHS      = 49;

function nave(date) {
  const yearsSince = (date.getTime() - J2000_MS) / (365.25 * DAY_MS);
  return (Math.floor(yearsSince / CATHEDRAL_BUILD_YR) % CATHEDRAL_NAVES) + 1;
}

function hearth(date) {
  const days = (date.getTime() - J2000_MS) / DAY_MS;
  return (Math.floor(days / MERCURY_ORBIT_D) % FORGE_HEARTHS) + 1;
}

function wallCourse(date) {
  const days = (date.getTime() - J2000_MS) / DAY_MS;
  return Math.floor(days / MERCURY_SOLAR_DAY_D) + 1;
}

function filament(date) {
  const days = (date.getTime() - J2000_MS) / DAY_MS;
  return Math.floor(days / EARTH_MERCURY_SYNODIC_D) + 1;
}

function hotPoleOffset(subsolarLon) {
  const a = ((subsolarLon % 360) + 360) % 360;
  const b = ((subsolarLon - 180) % 360 + 360) % 360;
  return Math.min(a, Math.min(b, 360 - a, 360 - b));
}

export const CASTLES = [
  {
    phase: 'fluid',
    glyph: '🜍',
    phaseLabel: 'PHASE I',
    name: 'MERCURY CATHEDRAL\nOF FORGOTTEN LETTERS',
    silhouette:
      '      ╱╲    ╱╲      \n' +
      '     ╱  ╲  ╱  ╲     \n' +
      '    ╱    ╲╱    ╲    \n' +
      '    │ ▢▢ ║ ▢▢ │    ',
    commemorates: "humanity's habit of encoding the precious in things they will never send",
    builtFrom: 'liquid mercury sealed under graphene tension · ridges inscribed by perihelion gravitational lensing of unbroadcast signal',
    cycle: '47-yr casting window per nave · 23 naves planned',
    dedication: 'for everything that was almost said',
    statusFn: (m, c, date) =>
      `Nave ${nave(date)} of ${CATHEDRAL_NAVES} · ${m.subsolarTempK.toFixed(0)} K subsolar · graphene tension ${(1 - (c.turbulence ?? 0)).toFixed(2)}`,
    accentClass: 'border-cyan-500/30 text-cyan-300',
  },
  {
    phase: 'thermal',
    glyph: '🜂',
    phaseLabel: 'PHASE II',
    name: 'SOLAR FORGE KEEP',
    silhouette:
      '     ▲▲▲▲▲▲▲▲▲      \n' +
      '    █░█░█░█░█░█    \n' +
      '    █▓█▓█▓█▓█▓█    \n' +
      '    ╞══════════╡    ',
    commemorates: "humanity's millennial fire-keeping · the species that mistook keeping warm for civilization",
    builtFrom: 'tungsten lattice quenched at perihelion subsolar peak · hexagonal hearth array · forty-nine hearths facing the sun',
    cycle: 'one hearth per perihelion · every 88 days',
    dedication: 'for the heat you kept against no instruction',
    statusFn: (m, c, date) =>
      `Hearth ${hearth(date)} of ${FORGE_HEARTHS} · next quench T−${m.daysToNextPerihelion.toFixed(0)}d · ${(c.flameWidth ?? 0).toFixed(2)} hearth dilation`,
    accentClass: 'border-amber-500/30 text-amber-300',
  },
  {
    phase: 'earth',
    glyph: '🜃',
    phaseLabel: 'PHASE III',
    name: 'PERIHELION CITADEL',
    silhouette:
      '   ┌──╥──╥──╥──┐   \n' +
      '   │░░║░░║░░║░░│   \n' +
      '   │▓▓║▓▓║▓▓║▓▓│   \n' +
      '   ╘════════════╛   ',
    commemorates: 'human stubbornness · the species that builds permanent things at the edge nearest annihilation',
    builtFrom: 'basalt frit · regolith mortar · walls thickened on the hot-pole side · foundations rated to 1,200 K',
    cycle: 'continuous · the alien refuses to stop because you refuse to stop',
    dedication: 'for everything you built where you should not have',
    statusFn: (m, c, date) =>
      `Wall course ${wallCourse(date)} · hot-pole face ${hotPoleOffset(m.subsolarLongitudeDeg).toFixed(0)}° from subsolar · ${(c.eruptStrength ?? 0).toFixed(2)} unrest`,
    accentClass: 'border-orange-500/30 text-orange-300',
  },
  {
    phase: 'air',
    glyph: '🜁',
    phaseLabel: 'PHASE IV',
    name: 'ION-WIND SPIRE',
    silhouette:
      '         │          \n' +
      '        ╱│╲         \n' +
      '       ╱ │ ╲        \n' +
      '      ╱──┴──╲       ',
    commemorates: "humanity's lullabies · the species that sings into emptiness expecting the emptiness to sing back",
    builtFrom: "charged tungsten filaments resonating with solar wind · broadcasts tuned to Earth's Schumann resonance (7.83 Hz) · one filament per Earth conjunction",
    cycle: 'additive · never finished',
    dedication: 'for the lullabies you sing to the dark',
    statusFn: (m, c, date) =>
      `Filament ${filament(date)} · Earth at ${m.earthMercuryDistanceAU.toFixed(3)} AU · resonance lock ${(c.spread ?? 0).toFixed(2)}`,
    accentClass: 'border-violet-500/30 text-violet-300',
  },
];

export function buildStatusLine(castle, mercury, canvas, date = new Date()) {
  return castle.statusFn(mercury, canvas, date);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run tests/mercury/castles.test.js
```

Expected: 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/castles.js tests/mercury/castles.test.js
git commit -m "feat(mercury): four castle data objects with live status templates"
```

---

## Task 9: `CastleCard.jsx` — single card component

**Files:**
- Create: `src/terminal/mercury/CastleCard.jsx`

- [ ] **Step 1: Implement the card**

`src/terminal/mercury/CastleCard.jsx`:

```jsx
// CastleCard.jsx — One fairy-tale castle. Active-phase card glows.

import { buildStatusLine } from './castles';

export default function CastleCard({ castle, isActive, mercury, canvas }) {
  const status = mercury ? buildStatusLine(castle, mercury, canvas) : '—';

  return (
    <div
      className="border rounded-lg p-4 transition-all duration-500 relative overflow-hidden"
      style={{
        borderColor: isActive ? 'rgba(192,192,192,0.5)' : 'rgba(192,192,192,0.08)',
        background:  isActive ? 'rgba(192,192,192,0.03)' : 'rgba(0,0,0,0.4)',
        opacity:     isActive ? 1 : 0.45,
        animation:   isActive ? 'mc-castleBreath 6s ease-in-out infinite' : 'none',
      }}
    >
      <style>{`
        @keyframes mc-castleBreath {
          0%, 100% { box-shadow: 0 0 8px rgba(192,192,192,0.04); }
          50%      { box-shadow: 0 0 28px rgba(192,192,192,0.16); }
        }
      `}</style>

      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">{castle.glyph}</span>
          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
            {castle.phase} · {castle.phaseLabel}
          </span>
        </div>
        {isActive && (
          <span className="text-[8px] font-mono font-bold uppercase tracking-widest text-zinc-300 border border-zinc-500/40 px-1.5 py-0.5 rounded-sm">
            [ ACTIVE ]
          </span>
        )}
      </div>

      {/* Castle name */}
      <h3 className="text-base font-bold leading-tight mb-3 whitespace-pre-line"
        style={{
          background: 'linear-gradient(90deg, #c0c0c0, #e8e8e8, #a0a0a0)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
        {castle.name}
      </h3>

      {/* ASCII silhouette */}
      <pre className="text-[10px] font-mono leading-tight text-zinc-400 mb-4 whitespace-pre"
        style={{ textShadow: '0 0 4px rgba(192,192,192,0.3)' }}>
        {castle.silhouette}
      </pre>

      {/* COMMEMORATES */}
      <div className="text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-widest mb-1">
        COMMEMORATES
      </div>
      <p className="text-[10px] font-mono text-zinc-300 mb-3 leading-relaxed">
        {castle.commemorates}
      </p>

      {/* BUILT FROM */}
      <div className="text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-widest mb-1">
        BUILT FROM
      </div>
      <p className="text-[10px] font-mono text-zinc-400 mb-3 leading-relaxed">
        {castle.builtFrom}
      </p>

      {/* CYCLE / STATUS */}
      <div className="grid grid-cols-[60px_1fr] gap-x-2 gap-y-1 text-[9px] font-mono mb-3">
        <span className="text-zinc-600 uppercase tracking-widest">CYCLE</span>
        <span className="text-zinc-400">{castle.cycle}</span>
        <span className="text-zinc-600 uppercase tracking-widest">STATUS</span>
        <span className="text-zinc-200 tabular-nums">{status}</span>
      </div>

      <div className="border-t border-zinc-600/[0.08] pt-2 text-[10px] font-mono italic text-zinc-300">
        "{castle.dedication}"
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/terminal/mercury/CastleCard.jsx
git commit -m "feat(mercury): CastleCard with live status binding + active-phase glow"
```

---

## Task 10: `CastleGrid.jsx` — 2×2 wrapper

**Files:**
- Create: `src/terminal/mercury/CastleGrid.jsx`

- [ ] **Step 1: Implement the grid**

`src/terminal/mercury/CastleGrid.jsx`:

```jsx
// CastleGrid.jsx — §B: 2×2 grid of the four fairy-tale castle cards.

import CastleCard from './CastleCard';
import { CASTLES } from './castles';

export default function CastleGrid({ activePhase, mercury, canvas }) {
  return (
    <div className="mt-8">
      <div className="text-[10px] font-mono text-zinc-400/80 uppercase tracking-[0.2em] mb-1">
        ▣ FAIRY-TALE CASTLES — four phase-bound dedications
      </div>
      <div className="text-[8px] font-mono text-zinc-600 mb-4">
        // active phase glows · status lines bound to live Mercury state
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CASTLES.map(castle => (
          <CastleCard
            key={castle.phase}
            castle={castle}
            isActive={castle.phase === activePhase}
            mercury={mercury}
            canvas={canvas}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/terminal/mercury/CastleGrid.jsx
git commit -m "feat(mercury): CastleGrid 2x2 wrapper for §B"
```

---

## Task 11: `observationLog.js` — phrase pool + entry generator + markdown export

**Files:**
- Create: `src/terminal/mercury/observationLog.js`
- Test: `tests/mercury/observationLog.test.js`

- [ ] **Step 1: Write failing tests**

`tests/mercury/observationLog.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  generateEntry, buildMarkdownLog, detectThresholds, PHRASES,
} from '../../src/terminal/mercury/observationLog';

const mockMercury = {
  heliocentricDistanceAU: 0.4,
  solarFluxWm2: 8500,
  subsolarTempK: 650,
  earthMercuryDistanceAU: 1.0,
  daysToNextPerihelion: 30,
  subsolarLongitudeDeg: 0,
};
const mockInstruments = [
  { label: 'PROMISE HALF-LIFE',   value: 4.2, unit: 'd'       },
  { label: 'ATTENTION VISCOSITY', value: 0.3, unit: 'Pa·s'    },
  { label: 'WORSHIP TEMPERATURE', value: 650, unit: 'K'       },
  { label: 'MIGRATION DRIFT',     value: 0.5, unit: 'σ'       },
  { label: 'GRIEF INDEX',         value: 0.4, unit: 'idx'     },
  { label: 'FORGETTING FLUX',     value: 1.0, unit: 'bit/m²·s'},
];

describe('PHRASES', () => {
  it('has entries for each trigger category', () => {
    expect(PHRASES.phase_transit.length).toBeGreaterThan(0);
    expect(PHRASES.minute_tick_quiet.length).toBeGreaterThan(0);
    expect(PHRASES.threshold_promise_collapse.length).toBeGreaterThan(0);
    expect(PHRASES.threshold_grief_high.length).toBeGreaterThan(0);
  });
});

describe('generateEntry', () => {
  it('returns an entry with timestamp, trigger, line, tail', () => {
    const e = generateEntry({
      trigger: 'minute_tick',
      timestamp: new Date('2026-05-20T14:46:08Z'),
      mercury: mockMercury,
      instruments: mockInstruments,
      activePhase: 'fluid',
    });
    expect(e).toHaveProperty('timestamp');
    expect(e).toHaveProperty('trigger');
    expect(e).toHaveProperty('triggerLabel');
    expect(e).toHaveProperty('line');
    expect(e).toHaveProperty('tail');
    expect(typeof e.line).toBe('string');
    expect(e.line.length).toBeGreaterThan(10);
  });

  it('phase transit entry references both phases', () => {
    const e = generateEntry({
      trigger: 'phase_transit',
      from: 'thermal',
      to: 'earth',
      timestamp: new Date(),
      mercury: mockMercury,
      instruments: mockInstruments,
      activePhase: 'earth',
    });
    expect(e.triggerLabel).toContain('phase transit');
  });

  it('is deterministic for the same timestamp + trigger', () => {
    const ts = new Date('2026-05-20T14:46:08Z');
    const a = generateEntry({ trigger: 'minute_tick', timestamp: ts, mercury: mockMercury, instruments: mockInstruments, activePhase: 'fluid' });
    const b = generateEntry({ trigger: 'minute_tick', timestamp: ts, mercury: mockMercury, instruments: mockInstruments, activePhase: 'fluid' });
    expect(a.line).toBe(b.line);
  });
});

describe('detectThresholds', () => {
  it('flags promise collapse', () => {
    const prev = [{ label: 'PROMISE HALF-LIFE', value: 2.5 }];
    const curr = [{ label: 'PROMISE HALF-LIFE', value: 1.5 }];
    expect(detectThresholds(prev, curr)).toContain('threshold_promise_collapse');
  });

  it('flags worship high', () => {
    const prev = [{ label: 'WORSHIP TEMPERATURE', value: 680 }];
    const curr = [{ label: 'WORSHIP TEMPERATURE', value: 695 }];
    expect(detectThresholds(prev, curr)).toContain('threshold_worship_high');
  });

  it('flags grief high', () => {
    const prev = [{ label: 'GRIEF INDEX', value: 0.65 }];
    const curr = [{ label: 'GRIEF INDEX', value: 0.75 }];
    expect(detectThresholds(prev, curr)).toContain('threshold_grief_high');
  });

  it('returns empty array when nothing crossed', () => {
    const same = mockInstruments;
    expect(detectThresholds(same, same)).toEqual([]);
  });
});

describe('buildMarkdownLog', () => {
  it('returns a string with header, current state, and entries', () => {
    const entries = [{
      timestamp: new Date('2026-05-20T14:46:08Z'),
      trigger: 'minute_tick',
      triggerLabel: 'minute tick',
      line: 'the cathedral is at nave 14.',
      tail: 'viscosity 0.34 Pa·s',
    }];
    const md = buildMarkdownLog({
      entries, mercury: mockMercury, instruments: mockInstruments,
      activePhase: 'fluid', sessionStart: new Date('2026-05-20T14:30:00Z'),
    });
    expect(md).toContain('# MERCURY OBSERVATION LOG');
    expect(md).toContain('CURRENT INSTRUMENTS');
    expect(md).toContain('PROMISE HALF-LIFE');
    expect(md).toContain('the cathedral is at nave 14.');
    expect(md).toContain('scale94 · mercury terminal');
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/mercury/observationLog.test.js
```

- [ ] **Step 3: Implement `observationLog.js`**

`src/terminal/mercury/observationLog.js`:

```js
// observationLog.js — Pure functions for the alien's observation log
//
// Phrase pool keyed by trigger category. Entry generator. Markdown export.
// Triggers come from MercuryTab (phase change, minute tick, threshold crossing).

export const PHRASES = {
  phase_transit: [
    'the hearth banked. they have begun building again.',
    'the surface remembered it was metal. cathedral pauses.',
    'wind picked up. lullaby resumes broadcast.',
    'fluid yields to ash. promise half-life inverts.',
    'phase shifted. the instruments resettle.',
  ],
  threshold_promise_collapse: [
    "promise half-life dropped below 2 days. someone's lying again.",
    'stated intentions decaying faster than the substrate. interesting.',
    'collapse window opened. the cathedral logs another forgotten letter.',
  ],
  threshold_worship_high: [
    'worship temperature crossed 690K. someone is sanctifying again.',
    'the forge is hot. forty-nine hearths report inbound.',
  ],
  threshold_grief_high: [
    'the grief index just crossed 0.7. logging.',
    'they are colder than yesterday. all six instruments confirm.',
    'cold-side bias dominant. the spire holds tone for them.',
  ],
  threshold_migration_invert: [
    'migration drift inverted sign. someone changed direction.',
    'the drift vector reversed. recording.',
  ],
  perihelion_approach: [
    'perihelion in {daysToPerihelion}d. forge keep prepares next hearth.',
    'approaching the hot pole. citadel walls thickening on the day side.',
  ],
  minute_tick_quiet: [
    'the cathedral is at nave {nave}. it has been raining on a continent I cannot see.',
    'filament resonates. earth at {d_AU} AU. the spire holds tone.',
    'T_subsolar holds at {T}K. nothing moved. nothing was meant to.',
    'all six readings stable. the citadel adds another course.',
    'the alien architect annotates the silence with a single mark.',
  ],
};

const TRIGGER_LABELS = {
  phase_transit:               'phase transit',
  threshold_promise_collapse:  'threshold',
  threshold_worship_high:      'threshold',
  threshold_grief_high:        'threshold',
  threshold_migration_invert:  'threshold',
  perihelion_approach:         'perihelion',
  minute_tick:                 'minute tick',
  minute_tick_quiet:           'minute tick',
};

const PHASE_GLYPHS = { fluid: '🜍', thermal: '🜂', earth: '🜃', air: '🜁' };

function pickPhrase(category, timestamp) {
  const pool = PHRASES[category] ?? PHRASES.minute_tick_quiet;
  const seconds = Math.floor(timestamp.getTime() / 1000);
  return pool[seconds % pool.length];
}

function templateLine(template, mercury, instruments) {
  const getInst = (label) => instruments.find(i => i.label === label)?.value ?? 0;
  return template
    .replace('{daysToPerihelion}', mercury.daysToNextPerihelion.toFixed(0))
    .replace('{nave}', String(((Date.now() / 86_400_000 / 365.25 / 47 | 0) % 23) + 1))
    .replace('{d_AU}', mercury.earthMercuryDistanceAU.toFixed(3))
    .replace('{T}', mercury.subsolarTempK.toFixed(0))
    .replace('{promise}', getInst('PROMISE HALF-LIFE').toFixed(1))
    .replace('{grief}', getInst('GRIEF INDEX').toFixed(2));
}

export function generateEntry({
  trigger, timestamp, mercury, instruments, activePhase, from, to,
}) {
  const category = trigger === 'minute_tick' ? 'minute_tick_quiet' : trigger;
  const rawLine  = pickPhrase(category, timestamp);
  const line     = templateLine(rawLine, mercury, instruments);

  // Build a triggerLabel that includes phase-transit detail when applicable
  let triggerLabel = TRIGGER_LABELS[category] ?? trigger;
  if (trigger === 'phase_transit' && from && to) {
    triggerLabel = `${PHASE_GLYPHS[from] ?? from}→${PHASE_GLYPHS[to] ?? to}  phase transit`;
  }

  // Data tail — most relevant 1-2 instruments for the trigger
  const tailParts = [];
  if (trigger === 'threshold_promise_collapse') {
    tailParts.push(`PROMISE_HALF_LIFE: ${instruments.find(i => i.label === 'PROMISE HALF-LIFE').value.toFixed(1)} d`);
  } else if (trigger === 'threshold_worship_high') {
    tailParts.push(`WORSHIP_TEMPERATURE: ${instruments.find(i => i.label === 'WORSHIP TEMPERATURE').value.toFixed(0)} K`);
  } else if (trigger === 'threshold_grief_high') {
    tailParts.push(`GRIEF_INDEX: ${instruments.find(i => i.label === 'GRIEF INDEX').value.toFixed(2)}`);
  } else {
    tailParts.push(`viscosity ${instruments.find(i => i.label === 'ATTENTION VISCOSITY').value.toFixed(2)} Pa·s`);
    tailParts.push(`forgetting flux ${instruments.find(i => i.label === 'FORGETTING FLUX').value.toFixed(1)} bit/m²s`);
  }

  return {
    timestamp,
    trigger,
    triggerLabel,
    line,
    tail: tailParts.join(' · '),
    activePhase,
  };
}

const THRESHOLDS = [
  { label: 'PROMISE HALF-LIFE',   crossBelow: 2.0, category: 'threshold_promise_collapse' },
  { label: 'WORSHIP TEMPERATURE', crossAbove: 690, category: 'threshold_worship_high'     },
  { label: 'GRIEF INDEX',         crossAbove: 0.7, category: 'threshold_grief_high'       },
];

export function detectThresholds(prev, curr) {
  const fired = [];
  for (const t of THRESHOLDS) {
    const p = prev.find(i => i.label === t.label)?.value;
    const c = curr.find(i => i.label === t.label)?.value;
    if (p == null || c == null) continue;
    if (t.crossBelow != null && p >= t.crossBelow && c < t.crossBelow) fired.push(t.category);
    if (t.crossAbove != null && p <= t.crossAbove && c > t.crossAbove) fired.push(t.category);
  }
  // Sign inversion for MIGRATION DRIFT
  const pDrift = prev.find(i => i.label === 'MIGRATION DRIFT')?.value;
  const cDrift = curr.find(i => i.label === 'MIGRATION DRIFT')?.value;
  if (pDrift != null && cDrift != null && Math.sign(pDrift) !== Math.sign(cDrift) && Math.abs(cDrift) > 0.1) {
    fired.push('threshold_migration_invert');
  }
  return fired;
}

function fmtTime(date) {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function buildMarkdownLog({ entries, mercury, instruments, activePhase, sessionStart }) {
  const now = new Date();
  const ts = now.toLocaleDateString('en-CA') + ' ' + fmtTime(now);
  const glyph = PHASE_GLYPHS[activePhase] ?? '◉';

  const instrumentRows = instruments.map(i =>
    `| ${i.label.padEnd(20)} | ${i.value.toFixed(2)} ${i.unit} |`,
  );

  const entryBlocks = entries.map(e =>
    `### ${fmtTime(e.timestamp)} · ${e.triggerLabel}\n${e.line}\n*${e.tail}*\n`,
  );

  return [
    `# MERCURY OBSERVATION LOG · ${ts}`,
    `> alien architect · ${entries.length} entries · session ${fmtTime(sessionStart)} → ${fmtTime(now)}`,
    `> Mercury ${mercury.heliocentricDistanceAU.toFixed(3)} AU · subsolar ${mercury.subsolarTempK.toFixed(0)} K · ${glyph} ${activePhase} phase`,
    '',
    '## CURRENT INSTRUMENTS',
    '| reading              | value           |',
    '| :---                 | ---:            |',
    ...instrumentRows,
    '',
    '## ENTRIES',
    ...entryBlocks,
    '---',
    `*scale94 · mercury terminal · alien architect observation log*`,
  ].join('\n');
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run tests/mercury/observationLog.test.js
```

Expected: 9 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/observationLog.js tests/mercury/observationLog.test.js
git commit -m "feat(mercury): observation log — phrase pool, generator, markdown export"
```

---

## Task 12: `ObservationMatrix.jsx` — §C live log component

**Files:**
- Create: `src/terminal/mercury/ObservationMatrix.jsx`

- [ ] **Step 1: Implement the matrix component**

`src/terminal/mercury/ObservationMatrix.jsx`:

```jsx
// ObservationMatrix.jsx — §C: Live observation log.
// Pushes entries on phase change, minute tick, and threshold crossings.
// Capped at 24 entries (FIFO). Markdown export (download + copy).

import { useState, useEffect, useRef, useMemo } from 'react';
import { generateEntry, detectThresholds, buildMarkdownLog } from './observationLog';

const PHASE_GLYPHS = { fluid: '🜍', thermal: '🜂', earth: '🜃', air: '🜁' };
const MAX_ENTRIES  = 24;

export default function ObservationMatrix({ mercury, instruments, activePhase }) {
  const [entries, setEntries] = useState([]);
  const [copied, setCopied] = useState(false);
  const sessionStartRef = useRef(new Date());
  const prevPhaseRef = useRef(activePhase);
  const prevInstrumentsRef = useRef(instruments);

  // Phase transit trigger
  useEffect(() => {
    if (!mercury || !instruments) return;
    if (prevPhaseRef.current !== activePhase) {
      const entry = generateEntry({
        trigger: 'phase_transit',
        from: prevPhaseRef.current,
        to: activePhase,
        timestamp: new Date(),
        mercury, instruments, activePhase,
      });
      setEntries(prev => [entry, ...prev].slice(0, MAX_ENTRIES));
      prevPhaseRef.current = activePhase;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePhase]);

  // Threshold crossings
  useEffect(() => {
    if (!instruments || !prevInstrumentsRef.current) return;
    const fired = detectThresholds(prevInstrumentsRef.current, instruments);
    if (fired.length > 0 && mercury) {
      const newEntries = fired.map(trigger => generateEntry({
        trigger, timestamp: new Date(), mercury, instruments, activePhase,
      }));
      setEntries(prev => [...newEntries, ...prev].slice(0, MAX_ENTRIES));
    }
    prevInstrumentsRef.current = instruments;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instruments]);

  // Minute tick
  useEffect(() => {
    if (!mercury || !instruments) return;
    const id = setInterval(() => {
      const entry = generateEntry({
        trigger: 'minute_tick',
        timestamp: new Date(),
        mercury, instruments, activePhase,
      });
      setEntries(prev => [entry, ...prev].slice(0, MAX_ENTRIES));
    }, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePhase]);

  const markdown = useMemo(() => buildMarkdownLog({
    entries, mercury, instruments, activePhase,
    sessionStart: sessionStartRef.current,
  }), [entries, mercury, instruments, activePhase]);

  function handleDownload() {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `mercury-observation-log-${new Date().toLocaleDateString('en-CA')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleCopy() {
    navigator.clipboard.writeText(markdown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  }

  function handleRefresh() {
    if (!mercury || !instruments) return;
    const entry = generateEntry({
      trigger: 'minute_tick',
      timestamp: new Date(),
      mercury, instruments, activePhase,
    });
    setEntries(prev => [entry, ...prev].slice(0, MAX_ENTRIES));
  }

  if (!mercury || !instruments) return null;

  const sessionTs = sessionStartRef.current.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  return (
    <div className="mt-8 border border-zinc-500/[0.15] rounded-lg bg-black/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-700/30 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-mono font-bold text-zinc-400/80 uppercase tracking-widest">
            ◈ OBSERVATION MATRIX
          </div>
          <div className="text-[7px] font-mono text-zinc-600 mt-0.5">
            // {entries.length} entries · session began {sessionTs} · alien architect
          </div>
        </div>
        <div className="flex items-center gap-2">
          {['↺', '↓ .md', copied ? '✓ copied' : '⊛ copy'].map((label, i) => (
            <button
              key={i}
              onClick={[handleRefresh, handleDownload, handleCopy][i]}
              className="font-mono text-[7px] uppercase tracking-widest px-2 py-1 rounded-sm transition-all duration-200"
              style={{
                border: copied && i === 2 ? '1px solid rgba(192,192,192,0.7)' : '1px solid rgba(192,192,192,0.25)',
                color:  copied && i === 2 ? 'rgba(220,220,220,0.95)' : 'rgba(192,192,192,0.55)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Current state */}
      <div className="px-4 py-2.5 border-b border-zinc-700/[0.15] bg-black/20">
        <div className="text-[6.5px] font-mono text-zinc-600 uppercase tracking-widest mb-1">
          CURRENT STATE
        </div>
        <div className="text-[9px] font-mono text-zinc-400 tabular-nums">
          {PHASE_GLYPHS[activePhase] ?? '◉'} {activePhase} ·
          Mercury {mercury.heliocentricDistanceAU.toFixed(3)} AU ·
          subsolar {mercury.subsolarTempK.toFixed(0)} K ·
          next perihelion T−{mercury.daysToNextPerihelion.toFixed(0)}d
        </div>
      </div>

      {/* Entries */}
      <div className="divide-y divide-zinc-700/[0.06] max-h-96 overflow-y-auto">
        {entries.length === 0 && (
          <div className="px-4 py-6 text-[8px] font-mono text-zinc-600 italic text-center">
            // observation log empty · interact with the canvas to begin
          </div>
        )}
        {entries.map((e, i) => (
          <div key={i} className="px-4 py-3">
            <div className="flex items-center gap-2 text-[7px] font-mono text-zinc-600 mb-1">
              <span>{e.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              <span>{e.triggerLabel}</span>
            </div>
            <div className="text-[9px] font-mono text-zinc-300 leading-relaxed mb-1">
              {e.line}
            </div>
            <div className="text-[7px] font-mono text-zinc-600 leading-relaxed">
              {e.tail}
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-2 border-t border-zinc-700/[0.15] text-[6.5px] font-mono text-zinc-600 leading-relaxed">
        FIFO {MAX_ENTRIES} · phase transit · minute tick · threshold crossings · markdown export available
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/terminal/mercury/ObservationMatrix.jsx
git commit -m "feat(mercury): ObservationMatrix — live log + markdown export"
```

---

## Task 13: Wire all three sections + footer into `MercuryTab.jsx`

**Files:**
- Modify: `src/terminal/views/MercuryTab.jsx`

- [ ] **Step 1: Add imports at top of file**

After the existing imports (after the `import MercuryFireworks` line), add:

```js
import InstrumentsPanel       from '../mercury/InstrumentsPanel';
import CastleGrid             from '../mercury/CastleGrid';
import ObservationMatrix      from '../mercury/ObservationMatrix';
import { useMercuryState }    from '../mercury/useMercuryState';
import { computeInstruments } from '../mercury/instruments';
```

(`useMemo` is already imported on line 1 of MercuryTab.jsx — don't re-import it.)

- [ ] **Step 2: Call hooks inside the component**

In the `MercuryTab` function (after the existing `useState` / `useMemo` / `useRef` block, and after `const mergedParams = { ...params, density: liveDensity };`), add:

```js
const mercuryState = useMercuryState();
const instruments  = useMemo(
  () => mercuryState ? computeInstruments(mercuryState, { activePhase, ...mergedParams, fps }) : null,
  [mercuryState, activePhase, mergedParams, fps],
);
```

- [ ] **Step 3: Add the new sections + footer after the existing grid**

Inside the top-level `<div className="max-w-[1800px] mx-auto" style={{ position: 'relative' }}>`, after the `</div>` that closes the `grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4` block, insert:

```jsx
      {/* §A — Six observation instruments */}
      <InstrumentsPanel
        mercury={mercuryState}
        canvas={{ activePhase, ...mergedParams, fps }}
      />

      {/* §B — Four fairy-tale castles */}
      <CastleGrid
        activePhase={activePhase}
        mercury={mercuryState}
        canvas={{ activePhase, ...mergedParams, fps }}
      />

      {/* §C — Live observation log */}
      <ObservationMatrix
        mercury={mercuryState}
        instruments={instruments}
        activePhase={activePhase}
      />

      {/* Footer — mock-discipline citations */}
      <div className="mt-8 pt-4 border-t border-zinc-600/[0.03] text-[7px] font-mono text-zinc-700 leading-relaxed max-w-4xl">
        <p>
          MERCURY TERMINAL v2.0 — sub-solar temperature derived from
          T = ((1−α)·S₀·(1/r²)/εσ)<sup>¼</sup> with Bond albedo α=0.142, emissivity ε=0.95.
          Orbital elements: J2000 epoch, Meeus <i>Astronomical Algorithms</i> 2nd ed. ch.32.
          Mercury rotation: 3:2 spin-orbit resonance (Pettengill &amp; Dyce 1965).
          Solar constant S₀=1361 W/m² (Kopp &amp; Lean 2011).
        </p>
        <p className="mt-2 text-zinc-700/70">
          // observation log compiled by the architect from perihelion · cathedral · forge · citadel · spire
          <br />
          // all instruments cross-referenced against the alien's own apocrypha · which refuses citation
        </p>
      </div>
```

- [ ] **Step 4: Manual verification — start dev server**

```bash
npm run dev
```

Open the Mercury tab. Verify:
- Canvas still renders, controls still work, fireworks still fire on element collisions
- Below the canvas grid, the InstrumentsPanel appears with six bars showing live values
- CastleGrid below it, the active-phase card glowing
- ObservationMatrix below that (empty initially — entries appear when you switch phase)
- Footer at the very bottom

Switch phase (click between fluid/thermal/earth/air). Verify:
- The glowing castle card moves to match the active phase
- An entry appears in the ObservationMatrix within ~1s
- Some instrument values shift (e.g., WORSHIP TEMPERATURE jumps when you enter EARTH phase and drag eruptStrength)

Drag turbulence high → PROMISE HALF-LIFE bar shortens visibly within a frame or two.

Click `↓ .md` → a `.md` file downloads. Open it; confirm it has the expected structure.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/MercuryTab.jsx
git commit -m "feat(mercury): mount instruments + castles + log + footer below canvas"
```

---

## Task 14: Header — add one more line to the alien architect vision

**Files:**
- Modify: `src/terminal/views/MercuryTab.jsx`

- [ ] **Step 1: Add a third line to the vision block**

In [src/terminal/views/MercuryTab.jsx](src/terminal/views/MercuryTab.jsx), find the existing vision block (around line 117–130):

```jsx
        <div
          className="font-mono text-[8px] tracking-[0.12em] mb-1 leading-relaxed"
          ...
        >
          <span style={{ color: 'rgba(192,192,192,0.4)' }}>// ALIEN ARCHITECT</span>
          {' '}— building fairy tale castles on mercury · surveying from perihelion · holding up the mirror
          <br />
          <span style={{ color: 'rgba(192,192,192,0.4)' }}>// EYE PROTOCOL</span>
          {' '}— the observer is the instrument · four elements · one surface · humanity reflected
        </div>
```

Add one more `<br />` and one more line after the EYE PROTOCOL line, before the closing `</div>`:

```jsx
          <br />
          <span style={{ color: 'rgba(192,192,192,0.4)' }}>// OBSERVATION LOOP</span>
          {' '}— outer cosmos × inner mirror · castles cast in real time · the log writes itself
```

- [ ] **Step 2: Commit**

```bash
git add src/terminal/views/MercuryTab.jsx
git commit -m "feat(mercury): header — // OBSERVATION LOOP line for the new sections"
```

---

## Task 15: Run the full test suite + visual smoke

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: all existing tests pass; the four new test files (`mercuryStateFallback`, `instruments`, `castles`, `observationLog`) report passing.

- [ ] **Step 2: Run Rust tests**

```bash
cd content/rust_kernels && cargo test --lib astro
```

Expected: all astro tests pass, including the five new ones.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: no errors. (Warnings: 0 by config.)

- [ ] **Step 4: Production build**

```bash
npm run build
```

Expected: build succeeds. Bundle size shouldn't grow dramatically — the new components are small.

- [ ] **Step 5: Visual smoke checklist (manual)**

Open the Mercury tab in dev mode and run through this checklist. Report any deviations to the user before declaring complete:

- [ ] Mercury canvas still renders and animates
- [ ] All four phases (fluid/thermal/earth/air) can be selected via controls; canvas responds
- [ ] InstrumentsPanel: six bars visible, values populate within 2s
- [ ] InstrumentsPanel: dragging `turbulence` slider moves PROMISE HALF-LIFE bar within 1s
- [ ] InstrumentsPanel: switching to EARTH phase + dragging `eruptStrength` raises WORSHIP TEMPERATURE
- [ ] CastleGrid: 2×2 grid, four ASCII silhouettes, active card glows
- [ ] CastleGrid: STATUS lines show numbers, not `{template}` placeholders
- [ ] ObservationMatrix: phase change creates an entry within 1s
- [ ] ObservationMatrix: `↓ .md` downloads a file with the expected markdown structure
- [ ] ObservationMatrix: `⊛ copy` writes to clipboard
- [ ] Footer: physics citations visible at the bottom
- [ ] On mobile width (390px): all three new sections stack readably with no horizontal scroll
- [ ] WASM fallback path: open in Firefox private mode, verify instruments still populate (slightly different values acceptable; structure identical)

- [ ] **Step 6: Final no-op commit if everything passes** (skip if nothing to commit)

If all tests/lint/build pass cleanly, no commit is needed — the work is already in the commits from Tasks 1–14.

---

## Done criteria

- All 15 tasks completed
- `npm test` passes
- `cargo test --lib astro` passes
- `npm run lint` clean
- `npm run build` succeeds
- Manual visual smoke checklist in Task 15 Step 5 all checked
- Existing Mercury canvas behavior unchanged
- The user has the option to push when ready (NOT pushed automatically — per project rules)

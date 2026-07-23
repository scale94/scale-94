# Lunar Shader Moon (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/LUNAR` tab's still-image canvas moon with a WebGL2 moon that nods, swells, and reorganises its own surface as the viewer's eye dark-adapts — shipping alongside the canvas moon behind a persisted toggle.

**Architecture:** Two GPU passes on one canvas. Pass A bakes an equirectangular selenographic normal+albedo+mare texture once at mount; Pass B lights it per frame from a fullscreen quad. Two pure JS modules (`lunarEphemeris`, `darkAdaptation`) hold all the testable logic; the React component is a thin WebGL host.

**Tech Stack:** React 19, raw WebGL2 (no three/r3f — a single-pass fragment shader does not need a scene graph, and this avoids the inline-uniform upload hazard hit during the nebula work), Vitest + jsdom, Tailwind.

**Spec:** `docs/superpowers/specs/2026-07-22-lunar-shader-moon-design.md`
**Branch:** `feature/lunar-shader-moon` (already created, spec committed at `8ca9690`)

## Global Constraints

- **Never delete the canvas moon.** It is moved to its own module in Task 3 and stays reachable via the toggle. Deletion is the author's call after live review.
- **Test command is `npm test`** (`vitest run`). Tests live in `src/terminal/lunar/__tests__/*.test.{js,jsx}`.
- **Every React test that calls `render()` must call `cleanup()`.** Phase 1 shipped two `render()` calls without it.
- **A passing test proves nothing until it has been watched to fail.** Every task runs the test before the implementation and records the failure message.
- **rAF trap:** a hidden browser pane suspends `requestAnimationFrame`, so this moon does not render at all — not slowly, at all. Before any CDP screenshot, **drop `--disable-gpu`** from the scripts in `C:\Users\raul-\.claude\projects\F--scale-9-4\tools\` (or add `--enable-unsafe-swiftshader`), or you will capture a black canvas and diagnose a shader bug that does not exist.
- **Periods (exact values, used verbatim):** synodic `29.53058770576` d, anomalistic `27.55454988` d, draconic `27.21222082` d.
- **localStorage key:** `lunar_moon_renderer_v1`, values `'canvas' | 'shader'`, default `'shader'`.
- **No import from `compileLunarDoctrine` or `kernelHoroscope`.** Moon and register stay decoupled (spec §13).

---

## File Structure

| file | responsibility | task |
| :--- | :--- | :--- |
| `src/terminal/lunar/lunarEphemeris.js` | pure — Meeus linear angles, scrub↔time, libration, apparent size | 1 |
| `src/terminal/lunar/darkAdaptation.js` | pure — adapt state step function | 2 |
| `src/terminal/lunar/LunarCanvasMoon.jsx` | the existing canvas moon, moved out of `LunarTab.jsx` unchanged | 3 |
| `src/terminal/lunar/glContext.js` | pure-ish — context creation, shader compile/link with error surfacing | 3 |
| `src/terminal/lunar/LunarShaderMoon.jsx` | WebGL2 host: rAF loop, uniforms, adaptation, fallback | 3 |
| `src/terminal/lunar/MoonRendererToggle.jsx` | persisted renderer switch + SCOTOPIC meter | 3, 6 |
| `src/terminal/lunar/moonShader.js` | GLSL sources as exported strings | 4–8 |
| `src/terminal/views/LunarTab.jsx` | imports + mount points only | 3, 7 |

---

## Task 1: `lunarEphemeris.js` — the clock

**Files:**
- Create: `src/terminal/lunar/lunarEphemeris.js`
- Test: `src/terminal/lunar/__tests__/lunarEphemeris.test.js`

**Interfaces:**
- Consumes: `SYNODIC_PERIOD` from `../synodic` (already exists, value `29.53058770576`)
- Produces:
  - `ANOMALISTIC_MONTH: number`, `DRACONIC_MONTH: number`, `DAY_MS: number`
  - `meanAnomaly(t: number): number` — radians, `[0, 2π)`
  - `argOfLatitude(t: number): number` — radians, `[0, 2π)`
  - `meanElongation(t: number): number` — radians, `[0, 2π)`
  - `libration(t: number): { lon: number, lat: number }` — **radians**
  - `distanceKm(t: number): number`
  - `apparentRadiusScale(t: number): number` — 1.0 at mean distance
  - `apparentDiameterArcmin(t: number): number`
  - `timestampForScrub(scrubAge: number, liveAge: number, now: number): number`

**Divergence from spec §6, deliberate:** the spec's `libration()` returned `{ lon, lat, pa }`. Position angle is dropped. There is no defensible two-term model for it, and inventing one would violate the §6.3 precision boundary this module's docblock states. Two angles is what is real and testable.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/lunar/__tests__/lunarEphemeris.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { SYNODIC_PERIOD } from '../synodic';
import {
  ANOMALISTIC_MONTH, DRACONIC_MONTH, DAY_MS,
  meanAnomaly, argOfLatitude, meanElongation,
  libration, distanceKm, apparentRadiusScale, apparentDiameterArcmin,
  timestampForScrub,
} from '../lunarEphemeris';

const T0 = Date.UTC(2026, 6, 22, 12, 0, 0);
const TAU = Math.PI * 2;

// Measure the period of an angle function by counting wraps over a long sweep.
// Measure the period from the span between the FIRST and LAST wrap, divided by
// the number of complete cycles in that span. Dividing total days by an integer
// wrap count instead (the obvious version) quantizes: over 4000 days it is off
// by up to 0.19 days, enough to pass or fail on luck rather than correctness.
function measuredPeriod(fn, days = 4000, stepDays = 0.01) {
  let prev = fn(T0);
  let first = null;
  let last = null;
  let wraps = 0;
  for (let d = stepDays; d <= days; d += stepDays) {
    const v = fn(T0 + d * DAY_MS);
    if (v < prev) {
      if (first === null) first = d;
      last = d;
      wraps++;
    }
    prev = v;
  }
  return (last - first) / (wraps - 1);
}

describe('lunarEphemeris — periods', () => {
  it('exposes the three month lengths', () => {
    expect(ANOMALISTIC_MONTH).toBeCloseTo(27.55454988, 8);
    expect(DRACONIC_MONTH).toBeCloseTo(27.21222082, 8);
  });

  it('mean anomaly runs on the anomalistic month', () => {
    expect(measuredPeriod(meanAnomaly)).toBeCloseTo(ANOMALISTIC_MONTH, 2);
  });

  it('argument of latitude runs on the draconic month', () => {
    expect(measuredPeriod(argOfLatitude)).toBeCloseTo(DRACONIC_MONTH, 2);
  });

  it('mean elongation runs on the synodic month', () => {
    expect(measuredPeriod(meanElongation)).toBeCloseTo(SYNODIC_PERIOD, 2);
  });

  it('keeps all three angles normalised to [0, 2pi)', () => {
    for (let d = 0; d < 500; d += 3.3) {
      const t = T0 + d * DAY_MS;
      for (const v of [meanAnomaly(t), argOfLatitude(t), meanElongation(t)]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(TAU);
      }
    }
  });
});

describe('lunarEphemeris — libration', () => {
  it('stays inside the optical libration envelope', () => {
    let maxLon = 0, maxLat = 0;
    for (let d = 0; d < 2000; d += 0.05) {
      const { lon, lat } = libration(T0 + d * DAY_MS);
      maxLon = Math.max(maxLon, Math.abs(lon));
      maxLat = Math.max(maxLat, Math.abs(lat));
    }
    const degLon = (maxLon * 180) / Math.PI;
    const degLat = (maxLat * 180) / Math.PI;
    expect(degLon).toBeGreaterThan(7.0);
    expect(degLon).toBeLessThan(8.2);
    expect(degLat).toBeGreaterThan(6.4);
    expect(degLat).toBeLessThan(7.0);
  });

  it('returns radians, not degrees', () => {
    // 8 degrees is 0.14 rad; a degrees bug would blow past 1.0 immediately.
    for (let d = 0; d < 60; d += 0.7) {
      const { lon, lat } = libration(T0 + d * DAY_MS);
      expect(Math.abs(lon)).toBeLessThan(0.2);
      expect(Math.abs(lat)).toBeLessThan(0.2);
    }
  });
});

describe('lunarEphemeris — apparent size', () => {
  it('sweeps the real perigee-apogee angular range', () => {
    let min = Infinity, max = -Infinity;
    for (let d = 0; d < 2000; d += 0.05) {
      const a = apparentDiameterArcmin(T0 + d * DAY_MS);
      min = Math.min(min, a);
      max = Math.max(max, a);
    }
    expect(min).toBeGreaterThan(28.8);
    expect(min).toBeLessThan(29.8);
    expect(max).toBeGreaterThan(32.9);
    expect(max).toBeLessThan(33.8);
    expect(max / min).toBeGreaterThan(1.10);   // the swell is at least 10%
  });

  it('keeps distance inside plausible lunar bounds', () => {
    for (let d = 0; d < 800; d += 0.3) {
      const km = distanceKm(T0 + d * DAY_MS);
      expect(km).toBeGreaterThan(355000);
      expect(km).toBeLessThan(410000);
    }
  });

  it('apparentRadiusScale is 1.0 at the mean distance', () => {
    // Find a moment where distance crosses the mean, scale must be ~1 there.
    for (let d = 0; d < 60; d += 0.01) {
      const t = T0 + d * DAY_MS;
      if (Math.abs(distanceKm(t) - 385000.56) < 200) {
        expect(apparentRadiusScale(t)).toBeCloseTo(1.0, 2);
        return;
      }
    }
    throw new Error('never crossed the mean distance');
  });
});

describe('lunarEphemeris — scrub as clock', () => {
  const NOW = T0;

  it('returns now when the scrub sits on the live age', () => {
    expect(timestampForScrub(10.0, 10.0, NOW)).toBe(NOW);
  });

  it('always maps forward, never backward', () => {
    for (let live = 0; live < SYNODIC_PERIOD; live += 1.1) {
      for (let scrub = 0; scrub < SYNODIC_PERIOD; scrub += 1.7) {
        expect(timestampForScrub(scrub, live, NOW)).toBeGreaterThanOrEqual(NOW);
      }
    }
  });

  it('never projects more than one synodic month ahead', () => {
    for (let scrub = 0; scrub < SYNODIC_PERIOD; scrub += 0.13) {
      const dt = (timestampForScrub(scrub, 3.0, NOW) - NOW) / DAY_MS;
      expect(dt).toBeLessThan(SYNODIC_PERIOD + 1e-9);
    }
  });

  it('is monotonic in scrub age within a cycle, with exactly one wrap', () => {
    const live = 7.5;
    let wraps = 0;
    let prev = timestampForScrub(0, live, NOW);
    for (let scrub = 0.05; scrub < SYNODIC_PERIOD; scrub += 0.05) {
      const t = timestampForScrub(scrub, live, NOW);
      if (t < prev) wraps++;
      prev = t;
    }
    expect(wraps).toBe(1);
  });

  it('the three periods do not realign inside five years', () => {
    // If they aliased, the moon would visibly repeat. Check no instant in a
    // 5-year sweep reproduces the t=0 state of all three angles at once.
    const ref = [meanAnomaly(T0), argOfLatitude(T0), meanElongation(T0)];
    let collisions = 0;
    for (let d = 1; d < 365 * 5; d += 0.05) {
      const t = T0 + d * DAY_MS;
      const now3 = [meanAnomaly(t), argOfLatitude(t), meanElongation(t)];
      if (now3.every((v, i) => Math.abs(v - ref[i]) < 0.01)) collisions++;
    }
    expect(collisions).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lunarEphemeris`
Expected: FAIL — `Failed to resolve import "../lunarEphemeris"`.

- [ ] **Step 3: Write the implementation**

Create `src/terminal/lunar/lunarEphemeris.js`:

```js
// lunarEphemeris.js — the moon's three clocks.
//
// PRECISION BOUNDARY, stated so no reader assumes more (spec §6.3):
// this is a simplified analytic model using the *linear* terms of Meeus,
// Astronomical Algorithms ch. 47, plus the two largest periodic terms of the
// distance expansion. It has the right amplitudes, the right periods, and the
// right beating between them. It is NOT JPL-accurate in absolute position and
// must not be presented as such. The tab's "NO ESOTERICISM / CITED" stance is
// a claim about mechanism, not about arcseconds.
//
// Substituting real ELP terms later changes this file and nothing else.

import { SYNODIC_PERIOD } from './synodic';

export const DAY_MS = 86400000;
export const ANOMALISTIC_MONTH = 27.55454988;
export const DRACONIC_MONTH = 27.21222082;

const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const JULIAN_CENTURY_MS = 36525 * DAY_MS;
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

// Mean distance and the two largest periodic terms (Meeus 47.a, km).
const MEAN_DISTANCE_KM = 385000.56;
const TERM_ANOMALY_KM = 20905.355;   // eccentricity
const TERM_EVECTION_KM = 3699.111;   // evection
const LUNAR_RADIUS_KM = 1737.4;

function julianCenturies(t) {
  return (t - J2000_MS) / JULIAN_CENTURY_MS;
}

function norm(rad) {
  const r = rad % TAU;
  return r < 0 ? r + TAU : r;
}

/** Moon's mean anomaly M — the anomalistic clock. */
export function meanAnomaly(t) {
  const T = julianCenturies(t);
  return norm((134.9633964 + 477198.8675055 * T) * DEG);
}

/** Moon's argument of latitude F — the draconic clock. */
export function argOfLatitude(t) {
  const T = julianCenturies(t);
  return norm((93.2720950 + 483202.0175233 * T) * DEG);
}

/** Mean elongation D — the synodic clock. */
export function meanElongation(t) {
  const T = julianCenturies(t);
  return norm((297.8501921 + 445267.1114034 * T) * DEG);
}

/**
 * Optical libration, radians.
 *
 * Longitude libration IS the equation of the centre: the moon's orbital speed
 * varies with anomaly while its rotation is uniform, so it appears to lead and
 * lag. Two terms, the second (evection) is what carries the envelope past 7deg.
 * Latitude libration comes from the 6.68deg tilt of the lunar equator to the
 * ecliptic, and so tracks the argument of latitude.
 */
export function libration(t) {
  const M = meanAnomaly(t);
  const D = meanElongation(t);
  const F = argOfLatitude(t);
  const lonDeg = 6.289 * Math.sin(M) + 1.274 * Math.sin(2 * D - M);
  const latDeg = 6.68 * Math.sin(F);
  return { lon: lonDeg * DEG, lat: latDeg * DEG };
}

/** Earth-Moon distance in km. */
export function distanceKm(t) {
  const M = meanAnomaly(t);
  const D = meanElongation(t);
  return (
    MEAN_DISTANCE_KM -
    TERM_ANOMALY_KM * Math.cos(M) -
    TERM_EVECTION_KM * Math.cos(2 * D - M)
  );
}

/** Disc scale factor, 1.0 at mean distance. Drives the perigee swell. */
export function apparentRadiusScale(t) {
  return MEAN_DISTANCE_KM / distanceKm(t);
}

/** Apparent angular diameter in arcminutes. */
export function apparentDiameterArcmin(t) {
  const rad = 2 * Math.atan(LUNAR_RADIUS_KM / distanceKm(t));
  return (rad * 180 * 60) / Math.PI;
}

/**
 * The scrub is a clock.
 *
 * Anchored on the tab's own live age rather than recomputed from an epoch, so
 * there is no seam between live mode and scrub mode even though LunarTab's
 * live age comes from the WASM path. Always projects forward.
 */
export function timestampForScrub(scrubAge, liveAge, now) {
  let delta = scrubAge - liveAge;
  if (delta < 0) delta += SYNODIC_PERIOD;
  return now + delta * DAY_MS;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lunarEphemeris`
Expected: PASS, 12 tests.

If `measuredPeriod` is off, the linear coefficient is wrong — each one is `360 * 36525 / month_length`, so it is checkable by hand. Do not adjust the tolerance to make it pass.

- [ ] **Step 5: Watch a test fail on purpose**

Temporarily change `6.289` to `62.89` in `libration`. Run `npm test -- lunarEphemeris`. The "returns radians, not degrees" and envelope tests must both fail. Revert.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/lunar/lunarEphemeris.js src/terminal/lunar/__tests__/lunarEphemeris.test.js
git commit -m "feat(lunar): add the moon's three clocks as a pure module"
```

---

## Task 2: `darkAdaptation.js` — the eye

**Files:**
- Create: `src/terminal/lunar/darkAdaptation.js`
- Test: `src/terminal/lunar/__tests__/darkAdaptation.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `TAU_SECONDS = 5`, `BLEACH_THRESHOLD = 0.15`, `BLEACH_FACTOR = 0.15`, `REST_EPSILON = 0.002`
  - `adaptCeiling(illumination: number): number`
  - `createAdaptState(illumination: number): { adapt: number, lastIllum: number }`
  - `stepAdapt(state, opts: { dt, illumination, hidden?, reducedMotion? }): { adapt, lastIllum }`
  - `isAtRest(state, illumination): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/terminal/lunar/__tests__/darkAdaptation.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  TAU_SECONDS, BLEACH_THRESHOLD, BLEACH_FACTOR,
  adaptCeiling, createAdaptState, stepAdapt, isAtRest,
} from '../darkAdaptation';

describe('darkAdaptation — ceiling', () => {
  it('falls as illumination rises', () => {
    expect(adaptCeiling(0)).toBeCloseTo(1.0, 6);
    expect(adaptCeiling(1)).toBeCloseTo(0.15, 6);
    expect(adaptCeiling(0.5)).toBeCloseTo(0.575, 6);
  });

  it('clamps illumination outside [0,1]', () => {
    expect(adaptCeiling(-3)).toBeCloseTo(1.0, 6);
    expect(adaptCeiling(9)).toBeCloseTo(0.15, 6);
  });
});

describe('darkAdaptation — ramp shape', () => {
  it('reaches 63% of ceiling after one time constant', () => {
    let s = createAdaptState(0);
    s = stepAdapt(s, { dt: TAU_SECONDS, illumination: 0 });
    expect(s.adapt).toBeCloseTo(1 - Math.exp(-1), 4);   // 0.6321
  });

  it('is frame-rate independent', () => {
    // One 5s step must equal fifty 0.1s steps.
    let coarse = createAdaptState(0);
    coarse = stepAdapt(coarse, { dt: 5, illumination: 0 });
    let fine = createAdaptState(0);
    for (let i = 0; i < 50; i++) fine = stepAdapt(fine, { dt: 0.1, illumination: 0 });
    expect(fine.adapt).toBeCloseTo(coarse.adapt, 6);
  });

  it('approaches but never exceeds the ceiling', () => {
    let s = createAdaptState(0.4);
    const ceiling = adaptCeiling(0.4);
    for (let i = 0; i < 2000; i++) s = stepAdapt(s, { dt: 0.1, illumination: 0.4 });
    expect(s.adapt).toBeLessThanOrEqual(ceiling);
    expect(s.adapt).toBeCloseTo(ceiling, 5);
  });

  it('clamps down when the ceiling drops beneath the current value', () => {
    let s = createAdaptState(0);
    for (let i = 0; i < 500; i++) s = stepAdapt(s, { dt: 0.1, illumination: 0 });
    expect(s.adapt).toBeGreaterThan(0.9);
    // Illumination creeps up in sub-threshold steps: no bleach, but the
    // ceiling must still pull it down.
    for (let i = 0; i < 20; i++) {
      s = stepAdapt(s, { dt: 0.016, illumination: Math.min(1, i * 0.05) });
    }
    expect(s.adapt).toBeLessThanOrEqual(adaptCeiling(0.95) + 1e-9);
  });
});

describe('darkAdaptation — bleach', () => {
  function adapted() {
    let s = createAdaptState(0);
    for (let i = 0; i < 500; i++) s = stepAdapt(s, { dt: 0.1, illumination: 0 });
    return s;
  }

  it('fires on a jump strictly greater than the threshold', () => {
    const before = adapted();
    const after = stepAdapt(before, { dt: 0.016, illumination: BLEACH_THRESHOLD + 0.01 });
    expect(after.adapt).toBeLessThan(before.adapt * BLEACH_FACTOR * 1.5);
  });

  it('does NOT fire at exactly the threshold', () => {
    const before = adapted();
    const after = stepAdapt(before, { dt: 0.016, illumination: BLEACH_THRESHOLD });
    // No bleach: adapt is pulled down to the new ceiling and no further. A
    // bleach would have multiplied by BLEACH_FACTOR first, landing near 0.15.
    // Assert against the ceiling, not against `before` -- the clamp moves
    // adapt too, so comparing to `before` conflates the two causes.
    expect(after.adapt).toBeCloseTo(adaptCeiling(BLEACH_THRESHOLD), 3);
  });

  it('does not fire when illumination drops', () => {
    let s = createAdaptState(0.9);
    s = stepAdapt(s, { dt: 5, illumination: 0.9 });
    const before = s.adapt;
    const after = stepAdapt(s, { dt: 0.016, illumination: 0.1 });
    expect(after.adapt).toBeGreaterThanOrEqual(before);
  });

  it('rebuilds after a bleach', () => {
    let s = adapted();
    s = stepAdapt(s, { dt: 0.016, illumination: 0.9 });
    const bleached = s.adapt;
    for (let i = 0; i < 300; i++) s = stepAdapt(s, { dt: 0.1, illumination: 0 });
    expect(s.adapt).toBeGreaterThan(bleached * 5);
  });
});

describe('darkAdaptation — freeze and reduced motion', () => {
  it('freezes while hidden without resetting', () => {
    let s = createAdaptState(0);
    for (let i = 0; i < 100; i++) s = stepAdapt(s, { dt: 0.1, illumination: 0 });
    const held = s.adapt;
    for (let i = 0; i < 100; i++) {
      s = stepAdapt(s, { dt: 0.1, illumination: 0, hidden: true });
    }
    expect(s.adapt).toBe(held);
  });

  it('does not bleach on the frame it becomes visible again', () => {
    let s = createAdaptState(0);
    for (let i = 0; i < 500; i++) s = stepAdapt(s, { dt: 0.1, illumination: 0 });
    const held = s.adapt;
    s = stepAdapt(s, { dt: 60, illumination: 0, hidden: true });
    s = stepAdapt(s, { dt: 0.016, illumination: 0 });
    expect(s.adapt).toBeGreaterThan(held * 0.9);
  });

  it('pins at the ceiling under reduced motion', () => {
    const s = stepAdapt(createAdaptState(0.3), {
      dt: 0.016, illumination: 0.3, reducedMotion: true,
    });
    expect(s.adapt).toBeCloseTo(adaptCeiling(0.3), 6);
  });
});

describe('darkAdaptation — rest detection', () => {
  it('is not at rest while still ramping', () => {
    const s = createAdaptState(0);
    expect(isAtRest(s, 0)).toBe(false);
  });

  it('is at rest once settled', () => {
    let s = createAdaptState(0);
    for (let i = 0; i < 1000; i++) s = stepAdapt(s, { dt: 0.1, illumination: 0 });
    expect(isAtRest(s, 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- darkAdaptation`
Expected: FAIL — `Failed to resolve import "../darkAdaptation"`.

- [ ] **Step 3: Write the implementation**

Create `src/terminal/lunar/darkAdaptation.js`:

```js
// darkAdaptation.js — the viewer's eye as state.
//
// Rod recovery is steeply nonlinear, so this is an exponential approach rather
// than the linear ramp the original spec carried: feedback arrives inside the
// first second and the last of it never quite lands. Frame-rate independent by
// construction -- the (1 - exp(-dt/tau)) form composes correctly under any dt.

export const TAU_SECONDS = 5;
export const BLEACH_THRESHOLD = 0.15;
export const BLEACH_FACTOR = 0.15;
export const REST_EPSILON = 0.002;

const CEILING_SLOPE = 0.85;

/** You cannot dark-adapt in front of a full moon. */
export function adaptCeiling(illumination) {
  const i = Math.max(0, Math.min(1, illumination));
  return 1 - CEILING_SLOPE * i;
}

export function createAdaptState(illumination) {
  return { adapt: 0, lastIllum: Math.max(0, Math.min(1, illumination)) };
}

export function stepAdapt(state, { dt, illumination, hidden = false, reducedMotion = false }) {
  const illum = Math.max(0, Math.min(1, illumination));
  const ceiling = adaptCeiling(illum);

  if (reducedMotion) return { adapt: ceiling, lastIllum: illum };

  // Hidden freezes both values. Holding lastIllum is what stops the first
  // visible frame from reading as a jump and bleaching you for no reason.
  if (hidden) return { adapt: state.adapt, lastIllum: state.lastIllum };

  let adapt = state.adapt;

  // Bleach only on a jump *toward* light. Strictly greater than threshold.
  if (illum - state.lastIllum > BLEACH_THRESHOLD) adapt *= BLEACH_FACTOR;

  adapt += (ceiling - adapt) * (1 - Math.exp(-dt / TAU_SECONDS));
  adapt = Math.max(0, Math.min(ceiling, adapt));

  return { adapt, lastIllum: illum };
}

/** Drives the 30fps idle throttle in LunarShaderMoon. */
export function isAtRest(state, illumination) {
  return Math.abs(adaptCeiling(illumination) - state.adapt) < REST_EPSILON;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- darkAdaptation`
Expected: PASS, 14 tests.

- [ ] **Step 5: Mutation check — watch three tests fail**

Make each change, run `npm test -- darkAdaptation`, confirm the named test fails, then revert:

| mutation | test that must fail |
| :--- | :--- |
| `>` → `>=` in the bleach condition | "does NOT fire at exactly the threshold" |
| `hidden` branch returns `{ adapt: state.adapt, lastIllum: illum }` | "does not bleach on the frame it becomes visible again" |
| `(1 - Math.exp(-dt / TAU_SECONDS))` → `dt / TAU_SECONDS` | "is frame-rate independent" |

If any of these still passes, that test is a false negative and must be fixed before committing.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/lunar/darkAdaptation.js src/terminal/lunar/__tests__/darkAdaptation.test.js
git commit -m "feat(lunar): add dark adaptation as a pure step function"
```

---

## Task 3: WebGL host, fallback, toggle, mount

Deliverable: a **flat violet disc** rendered by WebGL2 in the moon's slot, switchable back to the canvas moon. No surface, no lighting yet. This exists so every later task is visible in a browser.

**Files:**
- Create: `src/terminal/lunar/LunarCanvasMoon.jsx` (moved code, unchanged behaviour)
- Create: `src/terminal/lunar/glContext.js`
- Create: `src/terminal/lunar/moonShader.js`
- Create: `src/terminal/lunar/LunarShaderMoon.jsx`
- Create: `src/terminal/lunar/MoonRendererToggle.jsx`
- Modify: `src/terminal/views/LunarTab.jsx` — delete lines 152-460 (`hash` … `LunarCanvas`), add imports, swap the mount at line 1243
- Test: `src/terminal/lunar/__tests__/LunarShaderMoon.test.jsx`

**Interfaces:**
- Consumes: `createAdaptState`, `stepAdapt`, `isAtRest` (Task 2)
- Produces:
  - `glContext.js`: `createGL(canvas) → WebGL2RenderingContext | null`, `buildProgram(gl, vsSrc, fsSrc) → WebGLProgram` (throws `Error` with the info log on failure)
  - `moonShader.js`: `QUAD_VS: string`, `MOON_FS: string`
  - `LunarShaderMoon.jsx` default export, props `{ lunarAge, illumination, timestamp, size }`
  - `MoonRendererToggle.jsx`: default export props `{ value, onChange }`; named `MOON_RENDERER_KEY = 'lunar_moon_renderer_v1'`, `readRenderer(): 'canvas'|'shader'`, `writeRenderer(v): void`
  - `LunarCanvasMoon.jsx` default export `LunarCanvas`, props `{ lunarAge }` (unchanged); named export `MARE_BASINS`

- [ ] **Step 1: Move the canvas moon out, unchanged**

Cut `src/terminal/views/LunarTab.jsx` lines 152-460 (the block from the `// ── Photorealistic Moon + Starfield (Canvas) ──` banner through the end of `function LunarCanvas`) into a new file `src/terminal/lunar/LunarCanvasMoon.jsx`. Prepend:

```jsx
// LunarCanvasMoon.jsx — the original canvas moon, moved verbatim out of
// LunarTab.jsx so LunarShaderMoon can fall back to it. Behaviour unchanged.
// Not deleted, and not to be deleted: that is the author's call after review.

import React, { useEffect, useRef } from 'react';
import { SYNODIC_PERIOD } from './synodic';
```

Export `MARE_BASINS` (add `export` before `const MARE_BASINS`) and `export default LunarCanvas` at the end.

In `LunarTab.jsx`, add near the other lunar imports:

```jsx
import LunarCanvas from '../lunar/LunarCanvasMoon';
```

- [ ] **Step 2: Verify the move changed nothing**

Run: `npm test`
Expected: the full suite still passes at its Phase 1 count (670 passing). A move is not allowed to change a number.

Commit this on its own so the diff stays readable:

```bash
git add -A
git commit -m "refactor(lunar): extract the canvas moon to its own module"
```

- [ ] **Step 3: Write the failing host test**

Create `src/terminal/lunar/__tests__/LunarShaderMoon.test.jsx`:

```jsx
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import LunarShaderMoon from '../LunarShaderMoon';

// Minimal WebGL2 stub: enough for buildProgram + one draw, and it records
// whether the context was ever asked for.
function stubGL() {
  const noop = () => {};
  return {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
    ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLE_STRIP: 8,
    TEXTURE_2D: 9, TEXTURE0: 10, RGBA: 11, UNSIGNED_BYTE: 12,
    COLOR_ATTACHMENT0: 13, FRAMEBUFFER: 14, CLAMP_TO_EDGE: 15, LINEAR: 16,
    TEXTURE_WRAP_S: 17, TEXTURE_WRAP_T: 18, TEXTURE_MIN_FILTER: 19,
    TEXTURE_MAG_FILTER: 20, RGBA8: 21, REPEAT: 22,
    createShader: () => ({}), shaderSource: noop, compileShader: noop,
    getShaderParameter: () => true, getShaderInfoLog: () => '',
    createProgram: () => ({}), attachShader: noop, linkProgram: noop,
    getProgramParameter: () => true, getProgramInfoLog: () => '',
    deleteShader: noop, deleteProgram: noop, useProgram: noop,
    createBuffer: () => ({}), bindBuffer: noop, bufferData: noop,
    createVertexArray: () => ({}), bindVertexArray: noop,
    getAttribLocation: () => 0, enableVertexAttribArray: noop,
    vertexAttribPointer: noop,
    getUniformLocation: () => ({}),
    uniform1f: noop, uniform2f: noop, uniform1i: noop,
    createTexture: () => ({}), bindTexture: noop, texImage2D: noop,
    texParameteri: noop, activeTexture: noop, texStorage2D: noop,
    createFramebuffer: () => ({}), bindFramebuffer: noop,
    framebufferTexture2D: noop, deleteFramebuffer: noop, deleteTexture: noop,
    deleteVertexArray: noop, deleteBuffer: noop,
    viewport: noop, clearColor: noop, clear: noop, drawArrays: noop,
    disable: noop, enable: noop, blendFunc: noop,
    COLOR_BUFFER_BIT: 100, BLEND: 101, DEPTH_TEST: 102,
    ONE: 103, ONE_MINUS_SRC_ALPHA: 104,
  };
}

const PROPS = { lunarAge: 7.4, illumination: 0.5, timestamp: Date.UTC(2026, 6, 22), size: 340 };

let originalGetContext;

beforeEach(() => {
  originalGetContext = HTMLCanvasElement.prototype.getContext;
});

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  cleanup();
  vi.restoreAllMocks();
});

describe('LunarShaderMoon — fallback', () => {
  it('renders the canvas moon when webgl2 is unavailable', () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
    const { container } = render(<LunarShaderMoon {...PROPS} />);
    expect(container.querySelector('[data-moon-renderer="canvas"]')).toBeTruthy();
    expect(container.querySelector('[data-moon-renderer="shader"]')).toBeNull();
  });

  it('renders the shader path when webgl2 is available', () => {
    HTMLCanvasElement.prototype.getContext = vi.fn((type) =>
      type === 'webgl2' ? stubGL() : null
    );
    const { container } = render(<LunarShaderMoon {...PROPS} />);
    expect(container.querySelector('[data-moon-renderer="shader"]')).toBeTruthy();
  });
});

describe('LunarShaderMoon — teardown', () => {
  it('cancels rAF and removes every listener on unmount', () => {
    HTMLCanvasElement.prototype.getContext = vi.fn((type) =>
      type === 'webgl2' ? stubGL() : null
    );
    const cancel = vi.spyOn(window, 'cancelAnimationFrame');
    const removed = [];
    const realRemove = document.removeEventListener.bind(document);
    vi.spyOn(document, 'removeEventListener').mockImplementation((type, fn, opt) => {
      removed.push(type);
      return realRemove(type, fn, opt);
    });

    const { unmount } = render(<LunarShaderMoon {...PROPS} />);
    unmount();

    expect(cancel).toHaveBeenCalled();
    expect(removed).toContain('visibilitychange');
  });

  it('adds and removes the same number of document listeners', () => {
    HTMLCanvasElement.prototype.getContext = vi.fn((type) =>
      type === 'webgl2' ? stubGL() : null
    );
    const added = [];
    const removed = [];
    const realAdd = document.addEventListener.bind(document);
    const realRemove = document.removeEventListener.bind(document);
    vi.spyOn(document, 'addEventListener').mockImplementation((t, f, o) => {
      added.push(t); return realAdd(t, f, o);
    });
    vi.spyOn(document, 'removeEventListener').mockImplementation((t, f, o) => {
      removed.push(t); return realRemove(t, f, o);
    });

    const { unmount } = render(<LunarShaderMoon {...PROPS} />);
    const addedDuringMount = [...added];
    unmount();

    for (const type of addedDuringMount) expect(removed).toContain(type);
  });
});
```

Also create `src/terminal/lunar/__tests__/MoonRendererToggle.test.jsx`:

```jsx
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import MoonRendererToggle, {
  MOON_RENDERER_KEY, readRenderer, writeRenderer,
} from '../MoonRendererToggle';

afterEach(() => { localStorage.clear(); cleanup(); });

describe('MoonRendererToggle', () => {
  it('defaults to shader when nothing is stored', () => {
    expect(readRenderer()).toBe('shader');
  });

  it('round-trips through localStorage', () => {
    writeRenderer('canvas');
    expect(localStorage.getItem(MOON_RENDERER_KEY)).toBe('canvas');
    expect(readRenderer()).toBe('canvas');
  });

  it('ignores a corrupted stored value', () => {
    localStorage.setItem(MOON_RENDERER_KEY, 'banana');
    expect(readRenderer()).toBe('shader');
  });

  it('survives localStorage throwing', () => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('quota'); };
    expect(() => writeRenderer('canvas')).not.toThrow();
    Storage.prototype.setItem = real;
  });

  it('calls onChange with the other renderer when clicked', () => {
    let got = null;
    const { getByRole } = render(
      <MoonRendererToggle value="shader" onChange={(v) => { got = v; }} />
    );
    fireEvent.click(getByRole('button'));
    expect(got).toBe('canvas');
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm test -- LunarShaderMoon MoonRendererToggle`
Expected: FAIL — `Failed to resolve import "../LunarShaderMoon"`.

- [ ] **Step 5: Write `glContext.js`**

```js
// glContext.js — WebGL2 context creation and program building.
// Surfaces GLSL errors as thrown JS errors with the driver's info log intact,
// because a silently-null program renders a black canvas that looks exactly
// like the hidden-pane rAF trap.

export function createGL(canvas) {
  return canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
  });
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    const kind = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
    throw new Error(`[moonShader] ${kind} shader failed to compile:\n${log}`);
  }
  return sh;
}

export function buildProgram(gl, vsSrc, fsSrc) {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`[moonShader] program failed to link:\n${log}`);
  }
  return prog;
}
```

- [ ] **Step 6: Write `moonShader.js` (placeholder disc)**

```js
// moonShader.js — GLSL sources. Grown task by task; this is the flat-disc
// stage that exists so the host can be verified before any surface work.

export const QUAD_VS = `#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vScreen;
void main() {
  vScreen = aPos;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

export const MOON_FS = `#version 300 es
precision highp float;
in vec2 vScreen;
uniform float uRadius;
out vec4 fragColor;

void main() {
  float r = length(vScreen);
  if (r > uRadius) discard;
  fragColor = vec4(0.55, 0.48, 0.85, 1.0);
}`;
```

- [ ] **Step 7: Write `LunarShaderMoon.jsx`**

```jsx
// LunarShaderMoon.jsx — WebGL2 host for the shader moon.
//
// Owns: the GL context, the rAF loop, the adaptation state, and the fallback.
// Owns no maths. Everything computable lives in lunarEphemeris.js and
// darkAdaptation.js so it can be tested without a GPU.

import React, { useEffect, useRef, useState } from 'react';
import { createGL, buildProgram } from './glContext';
import { QUAD_VS, MOON_FS } from './moonShader';
import { createAdaptState, stepAdapt, isAtRest } from './darkAdaptation';
import LunarCanvas from './LunarCanvasMoon';

const REST_FRAME_MS = 1000 / 30;

export default function LunarShaderMoon({ lunarAge, illumination, timestamp, size = 340 }) {
  const canvasRef = useRef(null);
  const [supported, setSupported] = useState(() => {
    if (typeof document === 'undefined') return false;
    const probe = document.createElement('canvas');
    return !!createGL(probe);
  });

  // Live props read by the rAF loop without re-running the effect.
  const propsRef = useRef({ lunarAge, illumination, timestamp });
  propsRef.current = { lunarAge, illumination, timestamp };

  useEffect(() => {
    if (!supported) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = createGL(canvas);
    if (!gl) { setSupported(false); return; }

    let prog;
    try {
      prog = buildProgram(gl, QUAD_VS, MOON_FS);
    } catch (err) {
      console.error(err);
      setSupported(false);
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Fullscreen triangle strip.
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(prog);
    const uRadius = gl.getUniformLocation(prog, 'uRadius');

    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let adaptState = createAdaptState(illumination);
    let raf = 0;
    let hidden = document.hidden;
    let lastT = 0;
    let lastDraw = 0;

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = lastT ? Math.min((now - lastT) / 1000, 0.25) : 0;
      lastT = now;

      const live = propsRef.current;
      adaptState = stepAdapt(adaptState, {
        dt, illumination: live.illumination, hidden, reducedMotion,
      });

      // 30fps idle throttle once adaptation has settled (spec section 9).
      if (isAtRest(adaptState, live.illumination) && now - lastDraw < REST_FRAME_MS) return;
      lastDraw = now;

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uRadius, 0.78);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    raf = requestAnimationFrame(frame);

    function onVisibility() {
      hidden = document.hidden;
      if (!hidden) lastT = 0;   // do not bill the user for time spent away
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
      gl.deleteVertexArray(vao);
    };
  }, [supported, size]);

  if (!supported) {
    return (
      <div data-moon-renderer="canvas" className="w-full flex justify-center">
        <LunarCanvas lunarAge={lunarAge} />
      </div>
    );
  }

  return (
    <div data-moon-renderer="shader" className="w-full flex justify-center">
      <canvas ref={canvasRef} />
    </div>
  );
}
```

- [ ] **Step 8: Write `MoonRendererToggle.jsx`**

```jsx
// MoonRendererToggle.jsx — persisted switch between the canvas and shader moon.
// The SCOTOPIC meter joins this file in Task 6.

import React from 'react';

export const MOON_RENDERER_KEY = 'lunar_moon_renderer_v1';
const VALID = ['canvas', 'shader'];

export function readRenderer() {
  try {
    const v = localStorage.getItem(MOON_RENDERER_KEY);
    return VALID.includes(v) ? v : 'shader';
  } catch {
    return 'shader';
  }
}

export function writeRenderer(v) {
  if (!VALID.includes(v)) return;
  try { localStorage.setItem(MOON_RENDERER_KEY, v); } catch { /* private mode */ }
}

export default function MoonRendererToggle({ value, onChange }) {
  const other = value === 'shader' ? 'canvas' : 'shader';
  return (
    <button
      type="button"
      onClick={() => onChange(other)}
      className="text-[8px] font-mono uppercase tracking-widest text-violet-400/70 hover:text-violet-300 transition-colors"
    >
      renderer · {value}
    </button>
  );
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npm test -- LunarShaderMoon MoonRendererToggle`
Expected: PASS, 9 tests.

- [ ] **Step 10: Mount in `LunarTab.jsx`**

Replace the moon mount (was `LunarTab.jsx:1243`, now shifted by the Task 3 Step 1 extraction) — find `<LunarCanvas lunarAge={currentAge} />` inside the `{/* Photorealistic Moon */}` block and replace with:

```jsx
{moonRenderer === 'shader'
  ? <LunarShaderMoon
      lunarAge={currentAge}
      illumination={illumination}
      timestamp={moonTimestamp}
      size={340}
    />
  : <LunarCanvas lunarAge={currentAge} />}
<MoonRendererToggle value={moonRenderer} onChange={(v) => { setMoonRenderer(v); writeRenderer(v); }} />
```

Add to the imports:

```jsx
import LunarShaderMoon from '../lunar/LunarShaderMoon';
import MoonRendererToggle, { readRenderer, writeRenderer } from '../lunar/MoonRendererToggle';
```

Add near the other `useState` calls in `LunarTab`:

```jsx
const [moonRenderer, setMoonRenderer] = useState(readRenderer);
```

`moonTimestamp` is wired in Task 7. For now, immediately above the `return (`:

```jsx
const moonTimestamp = Date.now();   // becomes scrub-aware in Task 7
```

- [ ] **Step 11: Verify in the browser**

Start the dev server via `preview_start` (never `npm run dev` in Bash). Navigate to the LUNAR tab.

Expected: a flat violet disc where the moon was, and a `RENDERER · SHADER` control beneath it. Clicking it returns the canvas moon and survives a reload.

Check `read_console_messages` for `[moonShader]` errors. If the canvas is black rather than violet, re-read the rAF trap in Global Constraints before assuming a shader bug.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(lunar): WebGL2 moon host with canvas fallback and persisted toggle"
```

---

## Task 4: The bake pass — the surface

Deliverable: the disc shows a real lunar surface, flat-lit from the front. No phase yet.

**Files:**
- Modify: `src/terminal/lunar/moonShader.js` — add `BAKE_FS`, extend `MOON_FS`
- Modify: `src/terminal/lunar/LunarShaderMoon.jsx` — bake once into a texture, bind it

**Interfaces:**
- Consumes: `MARE_BASINS` from `./LunarCanvasMoon` (Task 3)
- Produces: `BAKE_FS: string`, `bakeSize(): [number, number]`. Texture layout, relied on by Tasks 5–8:

| channel | contents |
| :--- | :--- |
| `R`, `G` | tangent-space normal `x`, `y`, encoded `*0.5+0.5`. `z` is reconstructed as `sqrt(1-x²-y²)` — always positive for a height field. |
| `B` | albedo, `[0.06, 0.86]` |
| `A` | mare fraction, `[0, 1]` — drives the spectral tint in Task 6 |

- [ ] **Step 1: Add the bake shader to `moonShader.js`**

```js
// Shared GLSL: hashes, value noise, fbm. Prepended to both fragment shaders.
const NOISE_GLSL = `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
vec2 hash22(vec2 p) {
  return vec2(hash21(p), hash21(p + 19.19));
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p, int octaves) {
  float v = 0.0, amp = 1.0, total = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    v += vnoise(p) * amp;
    total += amp;
    amp *= 0.5;
    p *= 2.1;
  }
  return v / total;
}`;

export const BAKE_FS = `#version 300 es
precision highp float;
in vec2 vScreen;
out vec4 fragColor;

const float PI = 3.14159265359;
${NOISE_GLSL}

// lat, lon, radius, depth -- ported from LunarCanvasMoon's MARE_BASINS.
const int N_MARE = 9;
const vec4 MARE[9] = vec4[9](
  vec4( 0.15, -0.30, 0.25, 0.35),
  vec4( 0.12,  0.20, 0.18, 0.30),
  vec4(-0.05,  0.35, 0.20, 0.28),
  vec4(-0.20,  0.00, 0.15, 0.25),
  vec4( 0.40, -0.10, 0.12, 0.22),
  vec4(-0.10, -0.50, 0.14, 0.20),
  vec4( 0.02, -0.55, 0.22, 0.32),
  vec4(-0.30,  0.30, 0.12, 0.18),
  vec4( 0.08,  0.50, 0.10, 0.15)
);

float mareFraction(vec2 ll) {
  float m = 0.0;
  for (int i = 0; i < N_MARE; i++) {
    vec4 b = MARE[i];
    float dist = length(vec2(ll.y - b.x, ll.x - b.y));
    if (dist < b.z) {
      float f = 1.0 - dist / b.z;
      float edge = fbm(ll * 12.0 + b.x * 7.0, 3) * 0.6 + 0.7;
      m = max(m, smoothstep(0.0, 0.55, f) * edge);
    }
  }
  return clamp(m, 0.0, 1.0);
}

// Craters with a power-law size-frequency distribution.
//
// Radius is drawn as r = rmin * u^(-1/2) from uniform u, which gives
// P(R > r) proportional to r^-2 -- the observed lunar N ~ D^-2. This is what
// stops the surface reading as noise: fixed-frequency stamping (what the
// canvas moon does) produces a visible lattice.
float craters(vec2 p, float freq, float amp, float seed) {
  vec2 g = p * freq;
  vec2 gi = floor(g);
  float h = 0.0;
  for (int oy = -1; oy <= 1; oy++) {
    for (int ox = -1; ox <= 1; ox++) {
      vec2 cell = gi + vec2(float(ox), float(oy));
      vec2 c = cell + hash22(cell + seed) * 0.9 + 0.05;
      float u = max(hash21(cell + seed + 7.7), 0.03);
      float r = clamp(0.10 * pow(u, -0.5), 0.10, 0.58);
      float d = length(g - c) / r;
      if (d < 1.0) {
        float floorTerm = -(1.0 - d * d) * 0.7;
        float rim = exp(-pow((d - 0.88) / 0.11, 2.0)) * 0.95;
        h += amp * (floorTerm + rim) * (0.4 + r);
      } else if (d < 1.7) {
        h += amp * 0.10 * (0.4 + r) * exp(-(d - 1.0) * 3.0);
      }
    }
  }
  return h;
}

float heightAt(vec2 ll) {
  float h = fbm(ll * 4.0 + 10.0, 5) * 0.22;
  h -= mareFraction(ll) * 0.16;
  h += craters(ll, 6.0,  0.100, 1.0);
  h += craters(ll, 16.0, 0.048, 2.0);
  h += craters(ll, 44.0, 0.021, 3.0);
  return h;
}

void main() {
  // vScreen is -1..1; map to lon in [-PI, PI], lat in [-PI/2, PI/2].
  vec2 ll = vec2(vScreen.x * PI, vScreen.y * PI * 0.5);

  // Longitude epsilon widens toward the poles so the gradient stays isotropic.
  float cosLat = max(cos(ll.y), 0.15);
  float epsLon = 0.0016 / cosLat;
  float epsLat = 0.0016;

  float hL = heightAt(ll - vec2(epsLon, 0.0));
  float hR = heightAt(ll + vec2(epsLon, 0.0));
  float hD = heightAt(ll - vec2(0.0, epsLat));
  float hU = heightAt(ll + vec2(0.0, epsLat));

  const float RELIEF = 0.014;
  vec3 n = normalize(vec3(
    -(hR - hL) / (2.0 * epsLon) * RELIEF,
    -(hU - hD) / (2.0 * epsLat) * RELIEF,
    1.0
  ));

  float mare = mareFraction(ll);
  float rough = fbm(ll * 4.0 + 10.0, 5);
  float albedo = clamp(0.58 + rough * 0.14 - mare * 0.33, 0.06, 0.86);

  // Fresh large craters throw bright ray systems.
  albedo += clamp(craters(ll, 6.0, 0.10, 1.0), 0.0, 0.06) * 1.4;

  fragColor = vec4(n.xy * 0.5 + 0.5, clamp(albedo, 0.06, 0.86), mare);
}`;

/** 2048x1024 desktop, halved on narrow viewports. */
export function bakeSize() {
  const wide = typeof window !== 'undefined' && window.innerWidth >= 768;
  return wide ? [2048, 1024] : [1024, 512];
}
```

- [ ] **Step 2: Extend `MOON_FS` to sample the texture**

Replace the placeholder `MOON_FS` in `moonShader.js`:

```js
export const MOON_FS = `#version 300 es
precision highp float;
in vec2 vScreen;
uniform sampler2D uSurface;
uniform float uRadius;
out vec4 fragColor;

const float PI = 3.14159265359;
const float TAU = 6.28318530718;

void main() {
  vec2 p = vScreen / uRadius;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;

  vec3 N = vec3(p, sqrt(max(0.0, 1.0 - r2)));
  float lon = atan(N.x, N.z);
  float lat = asin(clamp(N.y, -1.0, 1.0));
  vec2 uv = vec2(lon / TAU + 0.5, lat / PI + 0.5);

  vec4 surf = texture(uSurface, uv);
  vec2 nxy = surf.rg * 2.0 - 1.0;
  vec3 nT = vec3(nxy, sqrt(max(0.0, 1.0 - dot(nxy, nxy))));
  float albedo = surf.b;

  // Flat frontal light for this task -- phase arrives in Task 5.
  fragColor = vec4(vec3(albedo * (0.55 + 0.45 * nT.z)), 1.0);
}`;
```

- [ ] **Step 3: Bake into a texture in `LunarShaderMoon.jsx`**

Inside the effect, after `buildProgram(gl, QUAD_VS, MOON_FS)` and before the rAF loop:

```jsx
    // ── Pass A: bake the selenographic surface, once ──
    const bakeProg = buildProgram(gl, QUAD_VS, BAKE_FS);
    const [bw, bh] = bakeSize();
    const surfaceTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, surfaceTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, bw, bh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);       // lon wraps
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); // lat does not

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, surfaceTex, 0);
    gl.viewport(0, 0, bw, bh);
    gl.useProgram(bakeProg);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fbo);
    gl.deleteProgram(bakeProg);
    gl.viewport(0, 0, canvas.width, canvas.height);
```

The `aPos` attribute must be bound for `bakeProg` too — move the VAO/buffer setup **above** the bake block and call `gl.getAttribLocation` for each program, or (simpler, and what to do here) bind location 0 in both by declaring `layout(location = 0) in vec2 aPos;` in `QUAD_VS`. Do the latter: change `QUAD_VS`'s `in vec2 aPos;` to `layout(location = 0) in vec2 aPos;` and use `gl.enableVertexAttribArray(0)` / `gl.vertexAttribPointer(0, ...)` instead of querying.

Bind the texture before drawing in `frame`:

```jsx
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, surfaceTex);
      gl.uniform1i(uSurface, 0);
```

with `const uSurface = gl.getUniformLocation(prog, 'uSurface');` alongside `uRadius`, and add `gl.deleteTexture(surfaceTex);` to the cleanup return.

Add to the imports: `import { QUAD_VS, MOON_FS, BAKE_FS, bakeSize } from './moonShader';`

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS. The stub GL in the Task 3 test already covers `texImage2D`, `createFramebuffer`, and `framebufferTexture2D`; if a method is missing the test will throw with its name — add it to the stub as a no-op.

- [ ] **Step 5: Verify in the browser — this is the task that can miss**

Screenshot the disc. Judge three things, in order:

1. **Do craters read as craters?** Bowl, raised rim, ejecta. If it reads as noise, the crater profile is wrong — adjust `rim`'s width (`0.11`) and the floor term before touching anything else.
2. **Is there a visible lattice?** Any regular grid means the jitter or the power law is wrong. This is the hard-fail condition.
3. **Are the mare recognisable?** Imbrium and Serenitatis should read as distinct dark plains, not smudges.

`RELIEF = 0.014` is the tuning knob for how pronounced the relief is; it will look wrong until Task 5 gives it grazing light, so do not over-tune it here.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(lunar): bake the selenographic surface with power-law craters"
```

---

## Task 5: Lighting — phase, relief, Lommel-Seeliger, opposition surge

Deliverable: the moon has a phase, the terminator has relief, and the full moon is flat and hot rather than a shaded ball.

**Files:**
- Modify: `src/terminal/lunar/moonShader.js` — `MOON_FS`
- Modify: `src/terminal/lunar/LunarShaderMoon.jsx` — pass `uAge`

**Interfaces:**
- Consumes: `SYNODIC_PERIOD` (as a GLSL constant), the Task 4 texture layout
- Produces: uniforms `uAge` (float, days), used by Tasks 6–8

- [ ] **Step 1: Replace the lighting block in `MOON_FS`**

Keep everything through `float albedo = surf.b;`, then replace the final line with:

```glsl
  // Tangent frame on the sphere, so the baked normal perturbs the real normal.
  vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), N));
  vec3 B = cross(N, T);
  vec3 Np = normalize(nT.x * T + nT.y * B + nT.z * N);

  // Sun direction from synodic age. Matches the canvas moon's convention:
  // age 0 puts the sun behind the moon, age 14.77 puts it behind the viewer.
  float phase = uAge / 29.53058770576 * TAU;
  vec3 L = normalize(vec3(-sin(phase), 0.0, -cos(phase)));
  vec3 V = vec3(0.0, 0.0, 1.0);

  // Lommel-Seeliger, not Lambert. This is why a real full moon is a flat disc
  // edge to edge instead of a lit ball with a dark rim.
  float mu0 = max(dot(Np, L), 0.0);
  float mu  = max(dot(Np, V), 0.0);
  float ls  = 2.0 * mu0 / max(mu0 + mu, 1e-4);

  // Opposition surge: shadow-hiding among regolith grains spikes the
  // brightness within a few degrees of zero phase angle.
  float alpha = acos(clamp(-cos(phase), -1.0, 1.0));
  float surge = 1.0 + 0.55 * exp(-alpha / 0.075);

  float Ld = albedo * ls * surge;
  fragColor = vec4(vec3(Ld), 1.0);
}
```

Add the uniform declaration near the top of `MOON_FS`:

```glsl
uniform float uAge;
```

- [ ] **Step 2: Pass `uAge` from the host**

In `LunarShaderMoon.jsx`, alongside `uRadius`:

```jsx
    const uAge = gl.getUniformLocation(prog, 'uAge');
```

and in `frame`, before `drawArrays`:

```jsx
      gl.uniform1f(uAge, live.lunarAge);
```

`lunarAge` changes every frame while scrubbing, which is exactly why it is read from `propsRef` rather than closed over.

- [ ] **Step 3: Run the suite**

Run: `npm test`
Expected: PASS, unchanged count.

- [ ] **Step 4: Verify in the browser at four ages**

Use the time-scrub. Capture at day 0 (new), 7.4 (first quarter), 14.8 (full), 22.1 (last quarter).

| age | expected |
| :--- | :--- |
| 0.0 | disc essentially black (earthshine is Task 6) |
| 7.4 | half lit; **crater rims casting long shadows at the terminator** — this is the thing the canvas moon cannot do |
| 14.8 | near-uniform brightness edge to edge, noticeably hotter than at 13 or 17 |
| 22.1 | mirror of 7.4, lit on the other side |

If day 14.8 looks like a shaded ball with a dark rim, `ls` is wrong — check the `2.0 *` factor and that `V` is `(0,0,1)`.

If the terminator shadows are invisible, raise `RELIEF` in `BAKE_FS` (Task 4, currently `0.014`) rather than changing the lighting.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(lunar): phase lighting with Lommel-Seeliger and opposition surge"
```

---

## Task 6: The mesopic split — earthshine, Purkinje, dither, SCOTOPIC meter

Deliverable: the dark half is no longer empty, the terminator becomes a hue boundary, and sitting still changes what you see.

**Files:**
- Modify: `src/terminal/lunar/moonShader.js` — `MOON_FS`
- Modify: `src/terminal/lunar/LunarShaderMoon.jsx` — `uIllum`, `uAdapt`, `uPurkinje`, `uTime`, adapt reporting
- Modify: `src/terminal/lunar/MoonRendererToggle.jsx` — add `ScotopicMeter`
- Modify: `src/terminal/views/LunarTab.jsx` — mount the meter
- Test: extend `src/terminal/lunar/__tests__/MoonRendererToggle.test.jsx`

**Interfaces:**
- Consumes: `ParamBar` from `../mercury/ParamBar` (props `{ label, value, unit, min, max, color }`)
- Produces:
  - `MoonRendererToggle.jsx` named export `ScotopicMeter({ adapt })`
  - `LunarShaderMoon` gains prop `onAdaptChange?: (adapt: number) => void`

**Honest note on the Purkinje amplification.** A physically-scaled V′(λ) reweight moves mare and highlands about 1.5% relative — highland albedo is ~2.4× mare albedo, so nothing swaps. The mechanism below is real; `uPurkinje` above 1.0 is an **amplification**, not a citation. At 1.0 the effect is contrast compression. Inversion needs roughly 3.0. Ship whichever the author picks after looking; do not describe an amplified value as physical.

- [ ] **Step 1: Add the colour block to `MOON_FS`**

Add uniforms:

```glsl
uniform float uIllum;
uniform float uAdapt;
uniform float uPurkinje;
uniform float uTime;
```

Replace `float Ld = albedo * ls * surge; fragColor = ...` with:

```glsl
  float Ld = albedo * ls * surge;

  // Earthshine. Earth is behind the viewer and full when the moon is new, so
  // this is frontal fill -- near-flat across the disc, not a shaded sphere.
  // That flatness is why the real old-moon-in-the-new-moon's-arms reads as a
  // disc. The half the sun refuses is not empty.
  float earthPhase = 1.0 - uIllum;
  float Le = albedo * 0.075 * pow(earthPhase, 1.6)
           * (0.55 + 0.45 * N.z) * (0.20 + 0.80 * uAdapt);

  float Y = Ld + Le;

  // Spectral reflectance: warm anorthosite highlands, bluish basalt mare.
  const vec3 HIGHLAND = vec3(1.00, 0.965, 0.905);
  const vec3 MARE_TINT = vec3(0.855, 0.900, 1.000);
  vec3 refl = mix(HIGHLAND, MARE_TINT, surf.a);

  // Mesopic split. Luminance decides which visual system renders the pixel,
  // and the thresholds RISE with adaptation, so the scotopic zone climbs up
  // into the lit side the longer you sit still.
  float yLo = mix(0.012, 0.10, uAdapt);
  float yHi = mix(0.100, 0.32, uAdapt);
  float s = 1.0 - smoothstep(yLo, yHi, Y);

  // Purkinje shift: rod sensitivity peaks at 507nm, not 555nm. Reds darken,
  // blues brighten. uPurkinje > 1.0 exaggerates past the physical value.
  vec3 vPrime = mix(vec3(1.0), vec3(0.42, 1.00, 1.62), uPurkinje);
  float scotLum = dot(refl * vPrime, vec3(0.33333));

  const vec3 VISUAL_PURPLE = vec3(0.60, 0.53, 1.00);
  vec3 photopic = refl * Y;
  vec3 scotopic = VISUAL_PURPLE * scotLum * Y;
  vec3 col = mix(photopic, scotopic, s);

  // Triangular dither. Violet gradients over near-black is the worst case for
  // OLED banding, which this project has already been bitten by.
  float d1 = hash21(gl_FragCoord.xy + uTime);
  float d2 = hash21(gl_FragCoord.xy + uTime + 31.7);
  col += (d1 + d2 - 1.0) / 255.0;

  fragColor = vec4(max(col, vec3(0.0)), 1.0);
}
```

`MOON_FS` now needs the noise helpers. Change its declaration to interpolate them the same way `BAKE_FS` does — insert `${NOISE_GLSL}` after the `const float TAU` line and convert `MOON_FS` to a template literal if it is not already.

- [ ] **Step 2: Wire the uniforms and report adapt**

In `LunarShaderMoon.jsx`, add to the props: `onAdaptChange`. Alongside the other locations:

```jsx
    const uIllum = gl.getUniformLocation(prog, 'uIllum');
    const uAdapt = gl.getUniformLocation(prog, 'uAdapt');
    const uPurkinje = gl.getUniformLocation(prog, 'uPurkinje');
    const uTime = gl.getUniformLocation(prog, 'uTime');
```

In `frame`, before `drawArrays`:

```jsx
      gl.uniform1f(uIllum, live.illumination);
      gl.uniform1f(uAdapt, adaptState.adapt);
      gl.uniform1f(uPurkinje, 1.0);   // author's call after review; 3.0 inverts
      gl.uniform1f(uTime, now * 0.001);
```

Report adapt to React at ~10Hz so the meter moves without re-rendering every frame:

```jsx
      if (now - lastReport > 100) {
        lastReport = now;
        const cb = propsRef.current.onAdaptChange;
        if (cb) cb(adaptState.adapt);
      }
```

with `let lastReport = 0;` beside `lastDraw`, and `onAdaptChange` added to the `propsRef.current` assignment.

- [ ] **Step 3: Write the failing meter test**

Append to `src/terminal/lunar/__tests__/MoonRendererToggle.test.jsx`:

```jsx
import { ScotopicMeter } from '../MoonRendererToggle';

describe('ScotopicMeter', () => {
  it('renders the SCOTOPIC label', () => {
    const { getByText } = render(<ScotopicMeter adapt={0.4} />);
    expect(getByText(/SCOTOPIC/i)).toBeTruthy();
  });

  it('shows the adapt value to three places', () => {
    const { getByText } = render(<ScotopicMeter adapt={0.4} />);
    expect(getByText('0.400')).toBeTruthy();
  });

  it('clamps a value above one', () => {
    const { container } = render(<ScotopicMeter adapt={3} />);
    const fill = container.querySelector('[style*="width"]');
    expect(fill.style.width).toBe('100%');
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npm test -- MoonRendererToggle`
Expected: FAIL — `ScotopicMeter is not a function` / undefined export.

- [ ] **Step 5: Add `ScotopicMeter`**

In `MoonRendererToggle.jsx`:

```jsx
import ParamBar from '../mercury/ParamBar';

/**
 * Without this the 25-second adaptation ramp reads as "nothing is happening",
 * which is a UX failure rather than a subtlety.
 */
export function ScotopicMeter({ adapt }) {
  return (
    <div className="w-full max-w-[340px] px-2">
      <ParamBar
        label="SCOTOPIC"
        value={Math.max(0, Math.min(1, adapt))}
        min={0}
        max={1}
        color="bg-violet-500/70"
      />
    </div>
  );
}
```

- [ ] **Step 6: Mount it in `LunarTab.jsx`**

Add `const [moonAdapt, setMoonAdapt] = useState(0);` beside `moonRenderer`, pass `onAdaptChange={setMoonAdapt}` to `LunarShaderMoon`, and render `{moonRenderer === 'shader' && <ScotopicMeter adapt={moonAdapt} />}` directly beneath the moon. Extend the import to `import MoonRendererToggle, { ScotopicMeter, readRenderer, writeRenderer } from '../lunar/MoonRendererToggle';`

- [ ] **Step 7: Run the suite**

Run: `npm test`
Expected: PASS, +3 tests.

- [ ] **Step 8: Verify the interaction in the browser**

1. Scrub to day 1.5 (thin crescent). **Do not touch anything for 30 seconds.**
   Expected: the SCOTOPIC bar climbs fast then slows; the unlit face emerges from black into violet; the terminator develops a visible hue transition rather than only a brightness edge.
2. Scrub sharply to day 14.8.
   Expected: SCOTOPIC collapses to near zero **in one frame**, and the violet is gone.
3. Scrub back to 1.5 and watch it rebuild.
4. Zoom the screenshot on the earthshine region and check for banding rings. If present, the dither is not reaching the output — confirm `col` is written after the dither add.
5. Try `uPurkinje` at `3.0` and capture the same crescent for comparison. Keep both captures; this is the author's call.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(lunar): mesopic split, earthshine, Purkinje shift, SCOTOPIC meter"
```

---

## Task 7: Libration, the perigee swell, and the scrub as a clock

Deliverable: the moon nods and changes size, and the scrub drives real time.

**Files:**
- Modify: `src/terminal/lunar/moonShader.js` — `MOON_FS`
- Modify: `src/terminal/lunar/LunarShaderMoon.jsx` — `uLibration`, `uRadius` from ephemeris
- Modify: `src/terminal/views/LunarTab.jsx` — real `moonTimestamp`

**Interfaces:**
- Consumes: `libration`, `apparentRadiusScale`, `timestampForScrub` (Task 1)
- Produces: uniform `uLibration` (vec2, radians); `uRadius` becomes dynamic

- [ ] **Step 1: Rotate the sampling direction in `MOON_FS`**

Add `uniform vec2 uLibration;` and replace the lon/lat derivation:

```glsl
  // Libration: rotate the view-space normal into selenographic coordinates.
  // The moon nods; the texture does not move under it.
  float cl = cos(-uLibration.y), sl = sin(-uLibration.y);
  vec3 S = vec3(N.x, cl * N.y - sl * N.z, sl * N.y + cl * N.z);
  float co = cos(-uLibration.x), so = sin(-uLibration.x);
  S = vec3(co * S.x + so * S.z, S.y, -so * S.x + co * S.z);

  float lon = atan(S.x, S.z);
  float lat = asin(clamp(S.y, -1.0, 1.0));
  vec2 uv = vec2(lon / TAU + 0.5, lat / PI + 0.5);
```

`N` stays the lighting normal — only the *sampling* direction is librated, which is correct: the sun does not move because the moon nodded.

- [ ] **Step 2: Drive the uniforms from the ephemeris**

In `LunarShaderMoon.jsx`, import `{ libration, apparentRadiusScale }` from `./lunarEphemeris`, add `const uLibration = gl.getUniformLocation(prog, 'uLibration');`, and in `frame`:

```jsx
      const lib = libration(live.timestamp);
      gl.uniform2f(uLibration, lib.lon, lib.lat);
      // 0.78 is the disc's share of the canvas at mean distance; the ephemeris
      // scale carries the perigee-apogee swell on top of it.
      gl.uniform1f(uRadius, 0.78 * apparentRadiusScale(live.timestamp));
```

Delete the fixed `gl.uniform1f(uRadius, 0.78);` from Task 3.

- [ ] **Step 3: Make the scrub a clock in `LunarTab.jsx`**

Replace `const moonTimestamp = Date.now();` with:

```jsx
// The scrub is a clock: it maps to a real forward timestamp so the moon's
// libration and apparent size run on their own periods (anomalistic and
// draconic) rather than on the synodic one the scrub sweeps. Anchored on the
// tab's own live age so there is no seam between live and scrubbed mode.
const moonTimestamp = useMemo(
  () => (isScrubbing ? timestampForScrub(scrubAge, liveAge, Date.now()) : Date.now()),
  [isScrubbing, scrubAge, liveAge]
);
```

Import: `import { timestampForScrub } from '../lunar/lunarEphemeris';`

Nothing else reads `moonTimestamp`. The transit matrix and the doctrine register continue to consume `currentAge` exactly as before — verify by grepping that `moonTimestamp` appears only in this definition and in the `LunarShaderMoon` prop.

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: PASS, unchanged count.

- [ ] **Step 5: Verify in the browser**

1. Drag the scrub slowly from 0 to 29.5 and back. Expected: the disc **visibly changes size** across the sweep, and surface features near the limb rotate into and out of view. Craters at the eastern limb should disappear round the edge and return.
2. Drag the scrub through several full cycles. Expected: the moon is never in the same state twice at the same phase — the three periods do not realign.
3. Confirm the doctrine register still hard-cuts at its usual seams and the transit matrix is unchanged. If either moved, `moonTimestamp` has leaked.
4. Check the disc never clips the canvas at maximum swell. If it does, lower `0.78` to `0.74`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(lunar): libration, perigee swell, and the scrub as a real clock"
```

---

## Task 8: The sky, and unboxing it

Deliverable: no visible frame. The moon sits in space rather than in a rounded rectangle.

**Files:**
- Modify: `src/terminal/lunar/moonShader.js` — `MOON_FS`
- Modify: `src/terminal/lunar/LunarShaderMoon.jsx` — blending, canvas sizing

- [ ] **Step 1: Restructure `MOON_FS` so the sky renders under the disc**

Delete these three lines from the top of `main()` — all three, not just the discard:

```glsl
  vec2 p = vScreen / uRadius;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;
```

and put this in their place. The sky is now always evaluated and the disc becomes a branch:

```glsl
  // ── Sky ──
  vec3 sky = vec3(0.0);
  float skyAlpha = 0.0;

  // Starfield: procedural, no buffers. Brightness climbs with adaptation --
  // the longer you sit in the dark, the more stars there are.
  vec2 sc = vScreen * 22.0;
  vec2 si = floor(sc);
  vec2 sf = fract(sc) - hash22(si);
  float starMag = hash21(si + 3.3);
  if (starMag > 0.86) {
    float d = length(sf);
    float tw = 0.72 + 0.28 * sin(uTime * (0.5 + starMag) * 2.0 + starMag * 40.0);
    float star = exp(-d * d * 90.0) * (starMag - 0.86) / 0.14;
    vec3 temp = mix(vec3(0.78, 0.84, 1.0), vec3(1.0, 0.95, 0.86), hash21(si + 9.1));
    float b = star * tw * (0.35 + 0.65 * uAdapt);
    sky += temp * b;
    skyAlpha = max(skyAlpha, b);
  }

  // Chromatic corona: the three channels fall off at slightly different radii,
  // so the halo disperses instead of gradient-stopping.
  float rr = length(vScreen);
  vec3 coronaR = vec3(exp(-pow(max(rr - uRadius, 0.0) / 0.30, 1.6)), 0.0, 0.0);
  vec3 coronaG = vec3(0.0, exp(-pow(max(rr - uRadius, 0.0) / 0.34, 1.6)), 0.0);
  vec3 coronaB = vec3(0.0, 0.0, exp(-pow(max(rr - uRadius, 0.0) / 0.41, 1.6)));
  vec3 corona = (coronaR + coronaG + coronaB)
              * vec3(0.55, 0.48, 1.0) * 0.075 * (0.35 + 0.65 * uIllum);
  sky += corona;
  skyAlpha = max(skyAlpha, max(corona.r, max(corona.g, corona.b)) * 3.0);

  // Alpha falls to zero INSIDE the canvas bounds, so there is no edge to see.
  float vignette = 1.0 - smoothstep(0.55, 1.0, rr);
  sky *= vignette;
  skyAlpha *= vignette;

  vec2 p = vScreen / uRadius;
  float r2 = dot(p, p);
  if (r2 > 1.0) {
    fragColor = vec4(sky, clamp(skyAlpha, 0.0, 1.0));
    return;
  }
```

and at the end of the disc branch, output `vec4(max(col, vec3(0.0)) + sky * 0.4, 1.0)`.

- [ ] **Step 2: Enable alpha blending and grow the canvas**

In `LunarShaderMoon.jsx`, after `gl.useProgram(prog)`:

```jsx
    gl.enable(gl.BLEND);
    // Premultiplied alpha -- the context was created with premultipliedAlpha.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
```

and grow the drawing surface so the falloff has room:

```jsx
    const canvasPx = Math.round(size * 1.25);
    canvas.width = canvasPx * dpr;
    canvas.height = canvasPx * dpr;
    canvas.style.width = `${canvasPx}px`;
    canvas.style.height = `${canvasPx}px`;
```

Wrap the canvas in a negative margin so the larger element does not push the layout:

```jsx
    <div data-moon-renderer="shader" className="w-full flex justify-center -my-8">
      <canvas ref={canvasRef} />
    </div>
```

**No `rounded-lg`, no background class, no opaque clear colour.** `gl.clearColor(0, 0, 0, 0)` from Task 3 is already correct and must stay.

- [ ] **Step 2b: Freeze the twinkle under reduced motion**

`uTime` now drives star twinkle, which is animation and must stop when the user has asked for less of it. Spec §7.1 says reduced motion means "no ramp, no libration drift"; twinkle falls under the same rule. The `reducedMotion` const already exists in the effect from Task 3. In `frame`, replace the Task 6 line:

```jsx
      gl.uniform1f(uTime, now * 0.001);
```

with:

```jsx
      // Frozen under reduced motion: stars stop twinkling. The dither pattern
      // going static with it is fine -- a fixed dither is still a dither.
      gl.uniform1f(uTime, reducedMotion ? 0 : now * 0.001);
```

Verify by emulating `prefers-reduced-motion: reduce` in the browser: the stars must hold still, the SCOTOPIC bar must sit pinned at the ceiling, and the moon must still respond to the scrub.

- [ ] **Step 3: Run the suite**

Run: `npm test`
Expected: PASS. Add `enable`, `blendFunc`, `BLEND`, `ONE`, `ONE_MINUS_SRC_ALPHA` to the stub GL if the teardown test throws.

- [ ] **Step 4: Verify in the browser**

1. Screenshot the LUNAR tab at desktop width. Expected: **no visible edge anywhere around the moon.** The starfield fades into the page background. If a square or a rounded rect is visible, either a Tailwind class survived or the vignette range is wrong.
2. Confirm the phase selector ring, the phase label, and the illumination readout below the moon are not overlapped by the `-my-8`.
3. Resize to 375px. Expected: no horizontal overflow, disc still centred, canvas still fits the column.
4. Sit at a crescent for 30 seconds. Expected: **stars fill in** as adaptation climbs, alongside the earthshine.
5. Toggle to the canvas renderer and back. Expected: no layout jump beyond the size difference, no leaked context (check `read_console_messages` for WebGL context-loss warnings after ~10 toggles).

- [ ] **Step 5: Full verification pass**

Run: `npm test`
Expected: full suite green. Record the count and compare against the Phase 1 baseline of 670 — it should be 670 plus roughly 38 new tests.

Run: `npm run lint`
Expected: clean, zero warnings (the script uses `--max-warnings 0`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(lunar): starfield, chromatic corona, and an unboxed sky"
```

---

## Post-implementation

Do **not** merge, and do **not** push. Both are the author's explicit call
(`feedback_no_push_without_verification`). Present:

1. Side-by-side captures, canvas vs shader, at ages 0 / 7.4 / 14.8 / 22.1.
2. The 30-second adaptation sequence at a crescent, three frames.
3. The `uPurkinje = 1.0` vs `3.0` comparison from Task 6 Step 8.
4. An explicit ask on the two open aesthetic calls: the Purkinje amplification
   value, and whether the canvas moon is now deletable.

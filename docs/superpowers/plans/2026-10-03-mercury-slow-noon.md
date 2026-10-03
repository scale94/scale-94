# THE SLOW NOON Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Caloris solar-day rosette dial ("THE SLOW NOON") in the /mercury sidebar whose hover (desktop) or tap (touch, 4 s) draws three hairlines on the planet: the Hg freeze line, the Caloris ring, a sub-solar tick.

**Architecture:** A pure model (`planet/slowNoon.js`) computes Caloris time, the rosette, the retrograde window and the readouts from `mercuryEphemeris.js`. A React SVG dial renders it and raises a boolean `overlay`, which MercuryTab → MercuryCanvas → MercuryPlanet turn into one eased uniform `uOverlay`. The planet shader draws the marks only inside `if (uOverlay > 0.0)`; the fields and their derivatives are computed before the shader's `discard`.

**Tech Stack:** React 19, three / @react-three/fiber (RawShaderMaterial, GLSL 3), vitest 4 + jsdom, CDP probe scripts (`scripts/cdp.mjs`, `.superpowers/sdd/tools/openMercury.mjs`).

**Spec:** `docs/superpowers/specs/2026-10-03-mercury-slow-noon-design.md`

## Global Constraints

- Branch: `feature/mercury-slow-noon` (already checked out, spec commit 183044a6). Never push without an explicit author command.
- Never stage `.import-cache.json`, `src/terminal/views/manifesto/__tests__/__snapshots__/councilField.test.jsx.snap` or `baseline/` (pre-existing dirt). Stage files by explicit path only.
- Caloris: centre 162.7°E, 31.5°N, angular radius 18.2°.
- Name: `THE SLOW NOON`. Readout lines: `HH:MM · <PHASE> AT CALORIS` / `SUN <r> AU · <1/r>× EARTH'S SKY · RECEDING|APPROACHING` / `SUN STANDS IN <n> d · <PHASE> AT PERIHELION` or, inside the window, `THE SUN TURNS BACK · DAY k OF n`.
- Tap reveal: 4000 ms. Overlay fade: 0.25 s; snap under reduced motion (`calm`).
- At rest (`uOverlay = 0`) the planet must be unchanged: the shader source with the slow-noon lines removed must equal the pre-change snapshot byte for byte, and every new shader statement that writes colour sits inside `if (uOverlay > 0.0)`.
- Draw calls unchanged; no new meshes.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Lint: `npm run lint` → 0 errors, warnings ≤ 137 (do not add exhaustive-deps warnings).
- Test runner: `npx vitest run <path>`; the full suite has one known failure (artComposite `compositeDpr`), anything else is a regression.

## File Structure

| File | Responsibility |
| --- | --- |
| Create `src/terminal/mercury/planet/slowNoon.js` | Pure model: Caloris hour, phase word, retrograde window, state, rosette and loupe paths, readouts, overlay constants, `stepOverlay`. |
| Create `src/terminal/mercury/planet/__tests__/slowNoon.test.js` | Model tests against the real ephemeris. |
| Modify `src/terminal/mercury/planet/mercuryPlanetShader.js` | `uOverlay`, `uCaloris`, constants, `hairline()`, field block before `discard`, composite block. |
| Create `src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.pre-slow-noon.fs.glsl` | Frozen copy of the pre-change full fragment shader (parity reference). |
| Modify `src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js` | Slow-noon contract + strip parity test. |
| Modify `src/terminal/mercury/MercuryPlanet.jsx` | `overlay` prop, uniforms, eased `uOverlay`. |
| Modify `src/terminal/mercury/MercuryCanvas.jsx` | Pass `overlay` through. |
| Modify `src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js` | Wiring source checks. |
| Create `src/terminal/mercury/useOverlayReveal.js` | Hover / tap-reveal pointer handlers. |
| Create `src/terminal/mercury/__tests__/useOverlayReveal.test.jsx` | Gesture tests (fake timers). |
| Create `src/terminal/mercury/SlowNoonDial.jsx` | SVG rosette dial + readouts; exports `dialXY`, `loupeXY`. |
| Create `src/terminal/mercury/__tests__/SlowNoonDial.test.jsx` | Geometry + render tests. |
| Modify `src/terminal/views/MercuryTab.jsx` | Overlay state, dial in sidebar, prop to canvas. |
| Create `.superpowers/sdd/tools/slowNoonShot.mjs` (gitignored, not committed) | Live look sheet probe. |

---

### Task 1: The Slow Noon model

**Files:**
- Create: `src/terminal/mercury/planet/slowNoon.js`
- Test: `src/terminal/mercury/planet/__tests__/slowNoon.test.js`

**Interfaces:**
- Consumes: `mercuryEphemeris(tMs) -> { r, rdotKmS, subsolarLonDeg, ... }` (`./mercuryEphemeris`); `dirFromLonLat(lonDeg, latDeg)`, `rotY(v, a)`, `bodyYawFor(subsolarLonDeg)` (`./planetFrame`).
- Produces (all named exports of `slowNoon.js`):
  - `DAY_MS = 86400000`, `TRAIL_DAYS = 15`, `SOLAR_DAY_D = 175.9421`, `SLOW_NOON_REFRESH_MS = 10000`
  - `CALORIS = { lonDeg: 162.7, latDeg: 31.5, angRadDeg: 18.2 }`, `CALORIS_DIR_BODY: [x, y, z]`, `CALORIS_ANG_RAD: number`
  - `OVERLAY_LINE_LIN = [0.55, 0.57, 0.62]`, `OVERLAY_ALPHA = 0.85`, `SUBSOLAR_TICK_PX = 6`, `OVERLAY_FADE_S = 0.25`
  - `calorisHour(subsolarLonDeg) -> hour in [0, 24)`
  - `phaseWord(hour) -> 'NIGHT'|'DAWN'|'MORNING'|'NOON'|'AFTERNOON'|'DUSK'`
  - `sunLonRate(tMs) -> deg/day` (negative normally, positive while the Sun turns back)
  - `retroWindow(nowMs) -> { startMs, endMs, periMs } | null`
  - `slowNoonState(nowMs) -> { hour, phaseWord, rAU, sunScale, receding, retro: { startMs, endMs, periMs, active, days, dayIndex, periHour } | null, daysToRetro, calorisFacing }`
  - `rosettePath(centerMs, stepDays = 0.25) -> [{ t, hour, rAU }]` (one solar day centred on `centerMs`)
  - `loupePath(retro, padDays = 1.5) -> [{ t, hour, rAU }]`
  - `formatReadouts(state) -> [line1, line2, line3]`
  - `stepOverlay(value, goal, dtS, calm) -> number`

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/mercury/planet/__tests__/slowNoon.test.js — THE SLOW NOON model (spec 2026-10-03).
import { describe, it, expect } from 'vitest';
import {
  DAY_MS, SOLAR_DAY_D, CALORIS, CALORIS_DIR_BODY, CALORIS_ANG_RAD, OVERLAY_FADE_S,
  calorisHour, phaseWord, sunLonRate, retroWindow, slowNoonState, rosettePath, loupePath,
  formatReadouts, stepOverlay,
} from '../slowNoon';
import { mercuryEphemeris } from '../mercuryEphemeris';
import { dirFromLonLat } from '../planetFrame';

const NOW = Date.UTC(2026, 9, 3, 12);           // 2026-10-03T12:00Z
const IN_RETRO = Date.UTC(2026, 10, 10);         // 2026-11-10T00:00Z
const day = (iso) => Date.parse(iso);

describe('Caloris clock', () => {
  it('is 12:00 when the Sun is over Caloris and 06:00 a quarter turn before', () => {
    expect(calorisHour(CALORIS.lonDeg)).toBeCloseTo(12, 10);
    expect(calorisHour(CALORIS.lonDeg + 90)).toBeCloseTo(6, 10);
    expect(calorisHour(CALORIS.lonDeg - 90)).toBeCloseTo(18, 10);
    expect(calorisHour(CALORIS.lonDeg + 180)).toBeCloseTo(0, 10);
  });

  it('names the hour', () => {
    expect(phaseWord(3)).toBe('NIGHT');
    expect(phaseWord(6)).toBe('DAWN');
    expect(phaseWord(9)).toBe('MORNING');
    expect(phaseWord(12)).toBe('NOON');
    expect(phaseWord(15)).toBe('AFTERNOON');
    expect(phaseWord(18)).toBe('DUSK');
    expect(phaseWord(20)).toBe('NIGHT');
  });

  it('reads 06:12 (dawn) at Caloris on 2026-10-03T12:00Z, 0.461 AU, approaching', () => {
    const s = slowNoonState(NOW);
    expect(Math.abs(s.hour - (6 + 12 / 60))).toBeLessThan(2 / 60);
    expect(s.phaseWord).toBe('DAWN');
    expect(s.rAU).toBeCloseTo(0.4615, 3);
    expect(s.sunScale).toBeCloseTo(1 / s.rAU, 12);
    expect(s.receding).toBe(false);
  });

  it('Caloris is on the far side today and faces the camera on 2026-12-01', () => {
    expect(slowNoonState(NOW).calorisFacing).toBe(false);
    expect(slowNoonState(Date.UTC(2026, 11, 1)).calorisFacing).toBe(true);
  });
});

describe('the Sun turns back', () => {
  it('normally moves west (rate < 0), and east inside the window', () => {
    expect(sunLonRate(NOW)).toBeLessThan(0);
    expect(sunLonRate(IN_RETRO)).toBeGreaterThan(0);
  });

  it('finds the 2026-11 window around the 2026-11-10 perihelion', () => {
    const w = retroWindow(NOW);
    expect(Math.abs(w.startMs - day('2026-11-06T12:00Z')) / DAY_MS).toBeLessThan(0.75);
    expect(Math.abs(w.endMs - day('2026-11-14T12:00Z')) / DAY_MS).toBeLessThan(0.75);
    expect(Math.abs(w.periMs - day('2026-11-10T08:38Z')) / DAY_MS).toBeLessThan(0.1);
    expect(mercuryEphemeris(w.periMs).r).toBeLessThan(mercuryEphemeris(w.periMs - DAY_MS).r);
    expect(mercuryEphemeris(w.periMs).r).toBeLessThan(mercuryEphemeris(w.periMs + DAY_MS).r);
  });

  it('inside the window returns the same window, active, counting days', () => {
    const before = slowNoonState(NOW);
    const s = slowNoonState(IN_RETRO);
    expect(Math.abs(s.retro.startMs - before.retro.startMs)).toBeLessThan(2 * 3600000);
    expect(s.retro.active).toBe(true);
    expect(s.retro.days).toBe(8);
    expect(s.retro.dayIndex).toBe(4);
    expect(s.daysToRetro).toBe(0);
  });

  it('counts days to the next window', () => {
    expect(slowNoonState(NOW).daysToRetro).toBe(34);
  });

  it('the Caloris hour only runs backwards inside the window', () => {
    const w = retroWindow(NOW);
    let prev = slowNoonState(NOW).hour;
    for (let t = NOW + DAY_MS / 4; t < w.endMs + 5 * DAY_MS; t += DAY_MS / 4) {
      const h = calorisHour(mercuryEphemeris(t).subsolarLonDeg);
      const inside = t > w.startMs + DAY_MS / 4 && t < w.endMs - DAY_MS / 4;
      const outside = t < w.startMs - DAY_MS / 4 || t > w.endMs + DAY_MS / 4;
      if (inside) expect(h).toBeLessThan(prev);
      if (outside) expect(h).toBeGreaterThan(prev);
      prev = h;
    }
  });
});

describe('the rosette', () => {
  it('closes after one solar day (the 3:2 resonance)', () => {
    const a = mercuryEphemeris(NOW), b = mercuryEphemeris(NOW + SOLAR_DAY_D * DAY_MS);
    expect(Math.abs(calorisHour(a.subsolarLonDeg) - calorisHour(b.subsolarLonDeg))).toBeLessThan(0.05);
    expect(Math.abs(a.r - b.r)).toBeLessThan(1e-4);
  });

  it('rosettePath spans one solar day centred on its argument', () => {
    const p = rosettePath(NOW);
    expect(p.length).toBe(Math.floor(SOLAR_DAY_D / 0.25) + 1);
    expect((p[p.length - 1].t - p[0].t) / DAY_MS).toBeCloseTo(Math.floor(SOLAR_DAY_D / 0.25) * 0.25, 6);
    expect(Math.abs((p[0].t + p[p.length - 1].t) / 2 - NOW) / DAY_MS).toBeLessThan(0.25);
    const minima = p.filter((q, i) => i > 0 && i < p.length - 1 && q.rAU < p[i - 1].rAU && q.rAU <= p[i + 1].rAU);
    expect(minima.length).toBe(2);
  });

  it('loupePath covers the window with padding', () => {
    const w = retroWindow(NOW);
    const p = loupePath(w);
    expect(p[0].t).toBeCloseTo(w.startMs - 1.5 * DAY_MS, -3);
    expect(p[p.length - 1].t).toBeGreaterThan(w.endMs + 1.4 * DAY_MS);
  });
});

describe('readouts', () => {
  it('today', () => {
    expect(formatReadouts(slowNoonState(NOW))).toEqual([
      '06:12 · DAWN AT CALORIS',
      "SUN 0.461 AU · 2.2× EARTH'S SKY · APPROACHING",
      'SUN STANDS IN 34 d · MORNING AT PERIHELION',
    ]);
  });

  it('inside the window', () => {
    expect(formatReadouts(slowNoonState(IN_RETRO))[2]).toBe('THE SUN TURNS BACK · DAY 4 OF 8');
  });
});

describe('overlay constants and easing', () => {
  it('Caloris direction is the body-frame unit vector at 162.7E 31.5N', () => {
    expect(CALORIS_DIR_BODY).toEqual(dirFromLonLat(162.7, 31.5));
    expect(Math.hypot(...CALORIS_DIR_BODY)).toBeCloseTo(1, 12);
    expect(CALORIS_ANG_RAD).toBeCloseTo(18.2 * Math.PI / 180, 12);
  });

  it('stepOverlay eases linearly over OVERLAY_FADE_S and snaps when calm', () => {
    expect(stepOverlay(0, 1, OVERLAY_FADE_S / 2, false)).toBeCloseTo(0.5, 12);
    expect(stepOverlay(0.9, 1, 1, false)).toBe(1);
    expect(stepOverlay(1, 0, OVERLAY_FADE_S / 4, false)).toBeCloseTo(0.75, 12);
    expect(stepOverlay(0.1, 0, 1, false)).toBe(0);
    expect(stepOverlay(0, 1, 0.001, true)).toBe(1);
    expect(stepOverlay(1, 0, 0.001, true)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/slowNoon.test.js`
Expected: FAIL, `Failed to resolve import "../slowNoon"`.

- [ ] **Step 3: Write the implementation**

```js
// src/terminal/mercury/planet/slowNoon.js — THE SLOW NOON: one day at Caloris, made readable.
//
// The Sun sits at a fixed phase angle to the camera (planetFrame.js), so the disc centre is
// always mid-afternoon; the readable clock is a PLACE. Caloris (162.7E 31.5N) lies near the 180°
// hot pole: perihelion falls in its late morning, where the Sun stands and turns back.
// Hour = 12 + hour angle / 15°, 24 Mercury-hours per 176-day solar day. Everything is derived from
// mercuryEphemeris.js (its precision boundary applies). Spec: 2026-10-03-mercury-slow-noon-design.md.

import { mercuryEphemeris } from './mercuryEphemeris';
import { dirFromLonLat, rotY, bodyYawFor } from './planetFrame';

export const DAY_MS = 86400000;
export const SOLAR_DAY_D = 175.9421;
export const TRAIL_DAYS = 15;
export const SLOW_NOON_REFRESH_MS = 10000;

export const CALORIS = Object.freeze({ lonDeg: 162.7, latDeg: 31.5, angRadDeg: 18.2 });
export const CALORIS_DIR_BODY = Object.freeze(dirFromLonLat(CALORIS.lonDeg, CALORIS.latDeg));
export const CALORIS_ANG_RAD = CALORIS.angRadDeg * Math.PI / 180;

// Hairlines on the planet (mercuryPlanetShader.js): linear colour, opacity, tick arm in px.
export const OVERLAY_LINE_LIN = Object.freeze([0.55, 0.57, 0.62]);
export const OVERLAY_ALPHA = 0.85;
export const SUBSOLAR_TICK_PX = 6;
export const OVERLAY_FADE_S = 0.25;

const SCAN_STEP_MS = 0.05 * DAY_MS;
const SCAN_SPAN_MS = 120 * DAY_MS;
const BISECT_MS = 3600000;

const wrap180 = (x) => x - 360 * Math.floor((x + 180) / 360);

export function calorisHour(subsolarLonDeg) {
  const h = 12 + wrap180(CALORIS.lonDeg - subsolarLonDeg) / 15;
  return ((h % 24) + 24) % 24;
}

export function phaseWord(hour) {
  if (hour < 5.5 || hour >= 18.5) return 'NIGHT';
  if (hour < 6.5) return 'DAWN';
  if (hour < 11.5) return 'MORNING';
  if (hour < 12.5) return 'NOON';
  if (hour < 17.5) return 'AFTERNOON';
  return 'DUSK';
}

// The Sun's motion over the surface, deg/day: negative normally, positive while it turns back.
export function sunLonRate(tMs) {
  const h = 0.01 * DAY_MS;
  return wrap180(mercuryEphemeris(tMs + h).subsolarLonDeg - mercuryEphemeris(tMs - h).subsolarLonDeg) / 0.02;
}

const turningBack = (tMs) => sunLonRate(tMs) > 0;

// Bisect the sign change of turningBack inside [aMs, bMs] to under an hour.
function edge(aMs, bMs) {
  const want = turningBack(bMs);
  while (bMs - aMs > BISECT_MS) {
    const m = (aMs + bMs) / 2;
    if (turningBack(m) === want) bMs = m; else aMs = m;
  }
  return (aMs + bMs) / 2;
}

// The window that contains nowMs, else the next one (null if none within SCAN_SPAN_MS).
export function retroWindow(nowMs) {
  let t = nowMs;
  if (turningBack(t)) {
    while (turningBack(t - SCAN_STEP_MS)) t -= SCAN_STEP_MS;
    t -= SCAN_STEP_MS;
  } else {
    while (!turningBack(t + SCAN_STEP_MS)) {
      t += SCAN_STEP_MS;
      if (t - nowMs > SCAN_SPAN_MS) return null;
    }
  }
  const startMs = edge(t, t + SCAN_STEP_MS);
  let e = startMs + SCAN_STEP_MS;
  while (turningBack(e)) e += SCAN_STEP_MS;
  const endMs = edge(e - SCAN_STEP_MS, e);
  let periMs = startMs, rMin = Infinity;
  for (let x = startMs; x <= endMs; x += SCAN_STEP_MS) {
    const r = mercuryEphemeris(x).r;
    if (r < rMin) { rMin = r; periMs = x; }
  }
  return { startMs, endMs, periMs };
}

export function slowNoonState(nowMs) {
  const eph = mercuryEphemeris(nowMs);
  const hour = calorisHour(eph.subsolarLonDeg);
  const w = retroWindow(nowMs);
  const active = !!w && nowMs >= w.startMs && nowMs < w.endMs;
  // Facing = at the HOME orientation (the ephemeris yaw), not a live drag; camera on +Z.
  const cal = rotY(CALORIS_DIR_BODY, bodyYawFor(eph.subsolarLonDeg));
  return {
    hour,
    phaseWord: phaseWord(hour),
    rAU: eph.r,
    sunScale: 1 / eph.r,
    receding: eph.rdotKmS > 0,
    retro: w && {
      ...w,
      active,
      days: Math.round((w.endMs - w.startMs) / DAY_MS),
      dayIndex: active ? Math.floor((nowMs - w.startMs) / DAY_MS) + 1 : 0,
      periHour: calorisHour(mercuryEphemeris(w.periMs).subsolarLonDeg),
    },
    daysToRetro: !w ? null : active ? 0 : Math.ceil((w.startMs - nowMs) / DAY_MS),
    calorisFacing: cal[2] > 0,
  };
}

function sample(tMs) {
  const e = mercuryEphemeris(tMs);
  return { t: tMs, hour: calorisHour(e.subsolarLonDeg), rAU: e.r };
}

export function rosettePath(centerMs, stepDays = 0.25) {
  const pts = [];
  const half = SOLAR_DAY_D / 2;
  const n = Math.floor(SOLAR_DAY_D / stepDays);
  for (let i = 0; i <= n; i++) pts.push(sample(centerMs + (i * stepDays - half) * DAY_MS));
  return pts;
}

export function loupePath({ startMs, endMs }, padDays = 1.5) {
  const pts = [];
  for (let t = startMs - padDays * DAY_MS; t <= endMs + padDays * DAY_MS; t += SCAN_STEP_MS) pts.push(sample(t));
  return pts;
}

function hhmm(hour) {
  const m = Math.floor(hour * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function formatReadouts(s) {
  const l1 = `${hhmm(s.hour)} · ${s.phaseWord} AT CALORIS`;
  const l2 = `SUN ${s.rAU.toFixed(3)} AU · ${s.sunScale.toFixed(1)}× EARTH'S SKY · ${s.receding ? 'RECEDING' : 'APPROACHING'}`;
  let l3 = '';
  if (s.retro?.active) l3 = `THE SUN TURNS BACK · DAY ${s.retro.dayIndex} OF ${s.retro.days}`;
  else if (s.retro) l3 = `SUN STANDS IN ${s.daysToRetro} d · ${phaseWord(s.retro.periHour)} AT PERIHELION`;
  return [l1, l2, l3];
}

// Linear ease of the overlay toward goal over OVERLAY_FADE_S; reduced motion snaps.
export function stepOverlay(value, goal, dtS, calm) {
  if (calm) return goal;
  const k = dtS / OVERLAY_FADE_S;
  return value < goal ? Math.min(goal, value + k) : Math.max(goal, value - k);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/slowNoon.test.js`
Expected: PASS (all tests). If `rosettePath spans...` fails on length, the implementation must keep `n = Math.floor(SOLAR_DAY_D / stepDays)` (703 steps at 0.25 d → 704 points).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/planet/slowNoon.js src/terminal/mercury/planet/__tests__/slowNoon.test.js
git commit -m "feat(mercury): THE SLOW NOON model: Caloris hour, retrograde window, rosette, readouts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Shader hairlines (freeze line, Caloris ring, sub-solar tick)

**Files:**
- Create: `src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.pre-slow-noon.fs.glsl` (frozen copy)
- Modify: `src/terminal/mercury/planet/mercuryPlanetShader.js` (imports; `PLANET_UNIFORMS` ~l.53-61; uniforms ~l.140; constants after `const float T_SUNSET_K` ~l.162; after `surfaceTempK` ~l.292; after `float pxArc = length(fwidth(xw));` ~l.522; before `vec3 col = max(colLin, 0.0);` ~l.635)
- Modify: `src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`
- Update: `src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.full.fs.glsl`

**Interfaces:**
- Consumes: from `./slowNoon`: `CALORIS_ANG_RAD`, `OVERLAY_LINE_LIN`, `OVERLAY_ALPHA`, `SUBSOLAR_TICK_PX`.
- Produces: fragment uniforms `uOverlay` (float, 0..1) and `uCaloris` (vec3, body frame), both in `PLANET_UNIFORMS`. Every inserted shader line either ends with `// slow-noon` or sits between `// <slow-noon>` and `// </slow-noon>` lines.

- [ ] **Step 1: Confirm the shader test is green at HEAD and freeze the reference**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`
Expected: PASS. Then:

```bash
git show HEAD:src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.full.fs.glsl > src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.pre-slow-noon.fs.glsl
```

- [ ] **Step 2: Write the failing tests** (append to `mercuryPlanetShader.test.js`; add `import { readFileSync } from 'node:fs';` and `import { CALORIS_ANG_RAD, OVERLAY_LINE_LIN, OVERLAY_ALPHA, SUBSOLAR_TICK_PX } from '../slowNoon';` to the imports at the top)

```js
// THE SLOW NOON (spec 2026-10-03): hairlines exist only behind uOverlay; removing them restores the old shader.
const stripSlowNoon = (src) => {
  const out = [];
  let inBlock = false;
  for (const line of src.split('\n')) {
    if (line.includes('// <slow-noon>')) { inBlock = true; continue; }
    if (line.includes('// </slow-noon>')) { inBlock = false; continue; }
    if (inBlock || line.includes('// slow-noon')) continue;
    out.push(line);
  }
  return out.join('\n');
};

describe('THE SLOW NOON hairlines', () => {
  it('stripping the slow-noon lines gives back the pre-change shader byte for byte', () => {
    const pre = readFileSync(new URL('./__snapshots__/planetShader.pre-slow-noon.fs.glsl', import.meta.url), 'utf8');
    expect(stripSlowNoon(PLANET_FS)).toBe(pre);
  });

  it('declares uOverlay and uCaloris and interpolates the constants from slowNoon.js', () => {
    expect(PLANET_UNIFORMS).toContain('uOverlay');
    expect(PLANET_UNIFORMS).toContain('uCaloris');
    expect(PLANET_FS).toContain('uniform float uOverlay; // slow-noon');
    expect(PLANET_FS).toContain('uniform vec3 uCaloris; // slow-noon');
    expect(PLANET_FS).toContain(`const float CALORIS_ANG_RAD = ${glf(CALORIS_ANG_RAD)}; // slow-noon`);
    expect(PLANET_FS).toContain(`const vec3 OVERLAY_LINE = ${v3(OVERLAY_LINE_LIN)}; // slow-noon`);
    expect(PLANET_FS).toContain(`const float OVERLAY_ALPHA = ${glf(OVERLAY_ALPHA)}; // slow-noon`);
    expect(PLANET_FS).toContain(`const float SUBSOLAR_TICK_PX = ${glf(SUBSOLAR_TICK_PX)}; // slow-noon`);
  });

  it('takes every overlay derivative before the discard, inside a uniform branch', () => {
    const fieldsAt = PLANET_FS.indexOf('if (uOverlay > 0.0) { // slow-noon fields');
    const discardAt = PLANET_FS.indexOf('if (disc < -fw) discard;');
    expect(fieldsAt).toBeGreaterThan(0);
    expect(fieldsAt).toBeLessThan(discardAt);
    const block = PLANET_FS.slice(fieldsAt, discardAt);
    expect(block).toContain('fwidth(tOv)');
    expect(block).toContain('fwidth(dCal)');
    // the freeze line uses the very temperature the liquid uses
    expect(block).toContain('surfaceTempK(dot(xb, Lb), lonRelOv, sqrt(max(1.0 - xw.y * xw.y, 0.0)), uSubsolarT, uHeatK)');
    expect(PLANET_FS.slice(discardAt)).not.toMatch(/fwidth\((tOv|dCal|aOv|bOv)\)/);
  });

  it('writes colour only behind uOverlay > 0 and before the sRGB encode', () => {
    const compAt = PLANET_FS.indexOf('if (uOverlay > 0.0) { // slow-noon composite');
    expect(compAt).toBeGreaterThan(PLANET_FS.indexOf('if (disc < -fw) discard;'));
    expect(compAt).toBeLessThan(PLANET_FS.indexOf('vec3 col = max(colLin, 0.0);'));
    expect(PLANET_FS).toContain('colLin = mix(colLin, OVERLAY_LINE, uOverlay * OVERLAY_ALPHA * max(max(ovFreeze, ovRing), ovTick));');
  });

  it('every tier and the calm variant carry the hairlines', () => {
    for (const tier of TIER_NAMES) for (const calm of [false, true]) {
      const fs = buildPlanetShader({ tier, calm }).fs;
      expect(fs).toContain('if (uOverlay > 0.0) { // slow-noon fields');
      expect(fs).toContain('if (uOverlay > 0.0) { // slow-noon composite');
    }
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`
Expected: the five new tests FAIL (strip parity passes trivially only if nothing was inserted; the others fail on missing strings). Pre-existing tests still PASS.

- [ ] **Step 4: Implement in `mercuryPlanetShader.js`**

4a. Imports (after the `mercuryThermal` import block):

```js
import { CALORIS_ANG_RAD, OVERLAY_LINE_LIN, OVERLAY_ALPHA, SUBSOLAR_TICK_PX } from './slowNoon';
```

4b. `PLANET_UNIFORMS`: change the last line `'uRoughLiquid', 'uMeniscus', 'uMeniscusW', 'uCoreR',` to

```js
  'uRoughLiquid', 'uMeniscus', 'uMeniscusW', 'uCoreR',
  'uOverlay', 'uCaloris',
```

4c. Uniform declarations: replace the line `uniform float uMeniscus;` with

```glsl
uniform float uMeniscus;
uniform float uOverlay; // slow-noon
uniform vec3 uCaloris; // slow-noon
```

4d. Constants: replace `const float T_SUNSET_K = ${glf(T_SUNSET_K)};` with

```glsl
const float T_SUNSET_K = ${glf(T_SUNSET_K)};
const float CALORIS_ANG_RAD = ${glf(CALORIS_ANG_RAD)}; // slow-noon
const vec3 OVERLAY_LINE = ${v3(OVERLAY_LINE_LIN)}; // slow-noon
const float OVERLAY_ALPHA = ${glf(OVERLAY_ALPHA)}; // slow-noon
const float SUBSOLAR_TICK_PX = ${glf(SUBSOLAR_TICK_PX)}; // slow-noon
```

4e. After the closing `}` of `surfaceTempK` (the line `  return t + heatK;` then `}`), insert:

```glsl
// <slow-noon>
// THE SLOW NOON (slowNoon.js): a ~1 px line where field d crosses zero, w = its per-pixel change.
float hairline(float d, float w) {
  return 1.0 - clamp(abs(d) / max(w, 1e-6), 0.0, 1.0);
}
// </slow-noon>
```

4f. Replace the line `  float pxArc = length(fwidth(xw));` with:

```glsl
  float pxArc = length(fwidth(xw));
  // <slow-noon>
  // THE SLOW NOON hairlines: fields and derivatives here, in a uniform branch before the discard.
  float ovFreeze = 0.0, ovRing = 0.0, ovTick = 0.0;
  if (uOverlay > 0.0) { // slow-noon fields
    float lonSunOv = length(uSunDir.xz) > 1e-4 ? atan(-uSunDir.z, uSunDir.x) : 0.0;
    float lonRelOv = mod(atan(-xw.z, xw.x) - lonSunOv + PI, TAU) - PI;
    float tOv = surfaceTempK(dot(xb, Lb), lonRelOv, sqrt(max(1.0 - xw.y * xw.y, 0.0)), uSubsolarT, uHeatK);
    ovFreeze = hairline(tOv - HG_MELT_K, fwidth(tOv));
    float dCal = acos(clamp(dot(xb, uCaloris), -1.0, 1.0)) - CALORIS_ANG_RAD;
    ovRing = hairline(dCal, fwidth(dCal));
    vec3 eOv = normalize(vec3(uSunDir.z, 0.0, -uSunDir.x));
    float aOv = dot(xw, eOv), bOv = xw.y, armOv = SUBSOLAR_TICK_PX * pxArc;
    float faceOv = step(0.0, dot(xw, uSunDir));
    ovTick = faceOv * max(hairline(aOv, fwidth(aOv)) * step(abs(bOv), armOv),
                          hairline(bOv, fwidth(bOv)) * step(abs(aOv), armOv));
  }
  // </slow-noon>
```

4g. Replace the line `  vec3 col = max(colLin, 0.0);` with:

```glsl
  // <slow-noon>
  if (uOverlay > 0.0) { // slow-noon composite
    colLin = mix(colLin, OVERLAY_LINE, uOverlay * OVERLAY_ALPHA * max(max(ovFreeze, ovRing), ovTick));
  }
  // </slow-noon>
  vec3 col = max(colLin, 0.0);
```

Note: `Lb`, `xb`, `xw`, `PI`, `TAU`, `HG_MELT_K` and `surfaceTempK` are all defined above these points (check with a search if a tier variant reorders; it does not today).

- [ ] **Step 5: Update the full-shader file snapshot and run the tests**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js -u`
Then: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`
Expected: PASS. Then `git diff --stat src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.full.fs.glsl` shows only insertions (no `-` lines other than the diff header): `git diff src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.full.fs.glsl | grep '^-[^-]'` prints nothing.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/mercury/planet/mercuryPlanetShader.js src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.full.fs.glsl src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.pre-slow-noon.fs.glsl
git commit -m "feat(mercury): slow-noon hairlines in the planet shader: freeze isotherm, Caloris ring, sub-solar tick behind uOverlay

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Planet wiring (uniforms, easing, overlay prop)

**Files:**
- Modify: `src/terminal/mercury/MercuryPlanet.jsx` (imports; signature l.266; uniforms object ~l.305-345; `useFrame` after `u.uMeniscusW.value = PLANET_TUNE.meniscusW;` ~l.460)
- Modify: `src/terminal/mercury/MercuryCanvas.jsx` (signature l.24-29; `<MercuryPlanet` ~l.134)
- Modify: `src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js`

**Interfaces:**
- Consumes: `CALORIS_DIR_BODY`, `stepOverlay(value, goal, dtS, calm)` from `./planet/slowNoon`; uniforms `uOverlay`, `uCaloris` (Task 2).
- Produces: `MercuryCanvas({ ..., overlay = false })` and `MercuryPlanet({ ..., overlay = false })`.

- [ ] **Step 1: Write the failing test** (append to `mercuryPlanetUniforms.test.js`; add `import canvasSrc from '../MercuryCanvas.jsx?raw';` at the top)

```js
describe('THE SLOW NOON wiring', () => {
  it('MercuryPlanet owns uOverlay / uCaloris and eases the overlay every frame', () => {
    expect(planetSrc).toContain("import { CALORIS_DIR_BODY, stepOverlay } from './planet/slowNoon';");
    expect(planetSrc).toContain("export default function MercuryPlanet({ isMobile = false, tier = 'full', calm = false, emitters = {}, strikes = null, overlay = false }) {");
    expect(planetSrc).toContain('uOverlay: { value: 0 },');
    expect(planetSrc).toContain('uCaloris: { value: new THREE.Vector3(...CALORIS_DIR_BODY) },');
    expect(planetSrc).toContain('u.uOverlay.value = stepOverlay(u.uOverlay.value, overlay ? 1 : 0, delta, calm);');
  });

  it('MercuryCanvas passes overlay through', () => {
    expect(canvasSrc).toMatch(/overlay = false,/);
    expect(canvasSrc).toContain('overlay={overlay}');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js`
Expected: the two new tests FAIL.

- [ ] **Step 3: Implement**

`MercuryPlanet.jsx`:
- Add after `import useDropletField from './useDropletField';`:

```js
import { CALORIS_DIR_BODY, stepOverlay } from './planet/slowNoon';
```

- Signature:

```js
export default function MercuryPlanet({ isMobile = false, tier = 'full', calm = false, emitters = {}, strikes = null, overlay = false }) {
```

- In the uniforms object, after `uMeniscusW: { value: PLANET_TUNE.meniscusW },`:

```js
      uOverlay: { value: 0 },
      uCaloris: { value: new THREE.Vector3(...CALORIS_DIR_BODY) },
```

- In `useFrame`, after `u.uMeniscusW.value = PLANET_TUNE.meniscusW;`:

```js
    u.uOverlay.value = stepOverlay(u.uOverlay.value, overlay ? 1 : 0, delta, calm);
```

`MercuryCanvas.jsx`:
- Signature: add `overlay = false,` after `onElementFired = null,`.
- In `<MercuryPlanet`, after `calm={calm}` add `overlay={overlay}`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/MercuryPlanet.jsx src/terminal/mercury/MercuryCanvas.jsx src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js
git commit -m "feat(mercury): overlay prop eases uOverlay (snaps under calm); uCaloris body-frame constant

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The dial (reveal gesture + SVG rosette)

**Files:**
- Create: `src/terminal/mercury/useOverlayReveal.js`
- Create: `src/terminal/mercury/SlowNoonDial.jsx`
- Test: `src/terminal/mercury/__tests__/useOverlayReveal.test.jsx`, `src/terminal/mercury/__tests__/SlowNoonDial.test.jsx`

**Interfaces:**
- Consumes: from `./planet/slowNoon`: `slowNoonState`, `rosettePath`, `loupePath`, `formatReadouts`, `TRAIL_DAYS`, `DAY_MS`, `SLOW_NOON_REFRESH_MS`; `DEV_OVERRIDES` from `./mercuryTuning`.
- Produces:
  - `REVEAL_TAP_MS = 4000`, `useOverlayReveal(onOverlay) -> { onPointerEnter, onPointerLeave, onPointerUp }`
  - `SlowNoonDial({ onOverlay })` default export; named `DIAL`, `LOUPE`, `dialXY(hour, rAU) -> [x, y]`, `loupeXY(p, peri) -> [x, y]`.

- [ ] **Step 1: Write the failing gesture test**

```jsx
// src/terminal/mercury/__tests__/useOverlayReveal.test.jsx — hover on desktop, tap-reveal on touch.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useOverlayReveal, REVEAL_TAP_MS } from '../useOverlayReveal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container, root, api, calls;

function Probe() {
  api = useOverlayReveal((v) => calls.push(v));
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Probe />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('useOverlayReveal', () => {
  it('mouse: enter shows, leave hides', () => {
    act(() => api.onPointerEnter({ pointerType: 'mouse' }));
    act(() => api.onPointerLeave({ pointerType: 'mouse' }));
    expect(calls).toEqual([true, false]);
  });

  it('touch: enter/leave are ignored; a tap shows for REVEAL_TAP_MS', () => {
    act(() => api.onPointerEnter({ pointerType: 'touch' }));
    act(() => api.onPointerUp({ pointerType: 'touch' }));
    expect(calls).toEqual([true]);
    act(() => vi.advanceTimersByTime(REVEAL_TAP_MS - 1));
    expect(calls).toEqual([true]);
    act(() => vi.advanceTimersByTime(1));
    expect(calls).toEqual([true, false]);
    act(() => api.onPointerLeave({ pointerType: 'touch' }));
    expect(calls).toEqual([true, false]);
  });

  it('a second tap restarts the 4 s', () => {
    act(() => api.onPointerUp({ pointerType: 'touch' }));
    act(() => vi.advanceTimersByTime(3000));
    act(() => api.onPointerUp({ pointerType: 'pen' }));
    act(() => vi.advanceTimersByTime(3000));
    expect(calls).toEqual([true, true]);
    act(() => vi.advanceTimersByTime(1000));
    expect(calls).toEqual([true, true, false]);
  });

  it('mouse pointerup does nothing', () => {
    act(() => api.onPointerUp({ pointerType: 'mouse' }));
    expect(calls).toEqual([]);
  });

  it('unmounting while shown hides', () => {
    act(() => api.onPointerUp({ pointerType: 'touch' }));
    act(() => root.unmount());
    root = createRoot(container); // afterEach unmounts again
    expect(calls).toEqual([true, false]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/terminal/mercury/__tests__/useOverlayReveal.test.jsx`
Expected: FAIL, cannot resolve `../useOverlayReveal`.

- [ ] **Step 3: Implement `useOverlayReveal.js`**

```js
// useOverlayReveal — THE SLOW NOON's link gesture: hover on a mouse, a 4 s reveal on a tap
// (touch / pen have no hover). Spec 2026-10-03 §2.

import { useEffect, useRef } from 'react';

export const REVEAL_TAP_MS = 4000;

const isTouch = (e) => e.pointerType === 'touch' || e.pointerType === 'pen';

export function useOverlayReveal(onOverlay) {
  const cb = useRef(onOverlay);
  const timer = useRef(null);
  const shown = useRef(false);
  useEffect(() => { cb.current = onOverlay; }, [onOverlay]);

  const set = (v) => { shown.current = v; cb.current(v); };
  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };

  // Unmounting while shown hides (aliases keep react-hooks from flagging ref reads in cleanup).
  useEffect(() => {
    const t = timer, s = shown, c = cb;
    return () => { if (t.current) clearTimeout(t.current); if (s.current) c.current(false); };
  }, []);

  return {
    onPointerEnter: (e) => { if (!isTouch(e)) set(true); },
    onPointerLeave: (e) => { if (!isTouch(e)) set(false); },
    onPointerUp: (e) => {
      if (!isTouch(e)) return;
      clear();
      set(true);
      timer.current = setTimeout(() => { timer.current = null; set(false); }, REVEAL_TAP_MS);
    },
  };
}
```

Run `npx eslint src/terminal/mercury/useOverlayReveal.js src/terminal/mercury/SlowNoonDial.jsx` after Step 7: expected 0 errors and 0 warnings for both files.

- [ ] **Step 4: Run gesture tests**

Run: `npx vitest run src/terminal/mercury/__tests__/useOverlayReveal.test.jsx`
Expected: PASS.

- [ ] **Step 5: Write the failing dial test**

```jsx
// src/terminal/mercury/__tests__/SlowNoonDial.test.jsx — THE SLOW NOON dial geometry and render.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import SlowNoonDial, { DIAL, LOUPE, dialXY, loupeXY } from '../SlowNoonDial';
import { DEV_OVERRIDES } from '../mercuryTuning';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('dial geometry', () => {
  it('noon at the top, dawn left, dusk right, midnight bottom', () => {
    const r = 0.38;
    const [nx, ny] = dialXY(12, r), [dx, dy] = dialXY(6, r), [ex, ey] = dialXY(18, r), [mx, my] = dialXY(0, r);
    expect(nx).toBeCloseTo(DIAL.c, 9); expect(ny).toBeLessThan(DIAL.c);
    expect(dx).toBeLessThan(DIAL.c); expect(dy).toBeCloseTo(DIAL.c, 9);
    expect(ex).toBeGreaterThan(DIAL.c); expect(ey).toBeCloseTo(DIAL.c, 9);
    expect(mx).toBeCloseTo(DIAL.c, 9); expect(my).toBeGreaterThan(DIAL.c);
  });

  it('radius grows with distance from the Sun', () => {
    const near = DIAL.c - dialXY(12, 0.31)[1], far = DIAL.c - dialXY(12, 0.46)[1];
    expect(far).toBeGreaterThan(near);
    expect(DIAL.c - dialXY(12, DIAL.rMinAU)[1]).toBeCloseTo(DIAL.rIn, 9);
  });

  it('the loupe centres on perihelion and magnifies the hour angle x22', () => {
    const peri = { hour: 10.85, rAU: 0.3075 };
    expect(loupeXY(peri, peri)).toEqual([LOUPE.x, LOUPE.y]);
    const [x] = loupeXY({ hour: 10.85 + 1 / 15, rAU: 0.3075 }, peri); // +1 degree of hour angle
    expect(x - LOUPE.x).toBeCloseTo(LOUPE.degPx, 9);
  });
});

describe('SlowNoonDial render', () => {
  let container, root;
  beforeEach(() => {
    DEV_OVERRIDES.dateMs = Date.UTC(2026, 9, 3, 12);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    DEV_OVERRIDES.dateMs = null;
  });

  it('shows the name and the three readouts for 2026-10-03', () => {
    act(() => root.render(<SlowNoonDial onOverlay={() => {}} />));
    const text = container.textContent;
    expect(text).toContain('THE SLOW NOON');
    expect(text).toContain('06:12 · DAWN AT CALORIS');
    expect(text).toContain("SUN 0.461 AU · 2.2× EARTH'S SKY · APPROACHING");
    expect(text).toContain('SUN STANDS IN 34 d · MORNING AT PERIHELION');
  });

  it('dims the hand while Caloris is on the far side', () => {
    act(() => root.render(<SlowNoonDial onOverlay={() => {}} />));
    expect(container.querySelector('[data-slow-noon-hand]').getAttribute('opacity')).toBe('0.35');
  });

  it('draws two perihelion rings and a loupe', () => {
    act(() => root.render(<SlowNoonDial onOverlay={() => {}} />));
    expect(container.querySelectorAll('[data-slow-noon-peri]').length).toBe(2);
    expect(container.querySelector('[data-slow-noon-loupe] path')).not.toBeNull();
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/terminal/mercury/__tests__/SlowNoonDial.test.jsx`
Expected: FAIL, cannot resolve `../SlowNoonDial`.

- [ ] **Step 7: Implement `SlowNoonDial.jsx`**

```jsx
// SlowNoonDial.jsx — THE SLOW NOON: one day at Caloris as a resonance rosette (spec 2026-10-03).
// Angle = Caloris local time (noon top, dawn left); radius = distance to the Sun. The 3:2 spin-orbit
// resonance closes the trace into two lobes with two perihelion pinches; a x22 loupe shows the real
// retrograde loop. Hover (or tap on touch) draws the matching hairlines on the planet.

import { useEffect, useMemo, useState } from 'react';
import {
  slowNoonState, rosettePath, loupePath, formatReadouts, TRAIL_DAYS, DAY_MS, SLOW_NOON_REFRESH_MS,
} from './planet/slowNoon';
import { DEV_OVERRIDES } from './mercuryTuning';
import { useOverlayReveal } from './useOverlayReveal';

export const DIAL = Object.freeze({ c: 150, ring: 140, label: 128, rIn: 40, rSpan: 95, rMinAU: 0.30, rMaxAU: 0.47 });
export const LOUPE = Object.freeze({ x: 248, y: 246, r: 44, degPx: 22, auPx: 1500 });

const INK = { day: '#1c1a14', night: '#0a0c16', ring: '#3a3f4a', tick: '#8a8f9a', label: '#9aa0ad',
  path: '#5b6170', trail: '#cfd5e0', gold: '#e8c27a', hand: '#ffffff', loupeBg: '#07080d' };
const HAND_DIM = 0.35;

const angle = (hour) => (hour / 24) * 2 * Math.PI + Math.PI / 2;
const ringXY = (hour, R) => [DIAL.c + R * Math.cos(angle(hour)), DIAL.c + R * Math.sin(angle(hour))];

export function dialXY(hour, rAU) {
  const R = DIAL.rIn + ((rAU - DIAL.rMinAU) / (DIAL.rMaxAU - DIAL.rMinAU)) * DIAL.rSpan;
  return ringXY(hour, R);
}

const wrap12 = (h) => h - 24 * Math.floor((h + 12) / 24);

export function loupeXY(p, peri) {
  return [LOUPE.x + wrap12(p.hour - peri.hour) * 15 * LOUPE.degPx, LOUPE.y - (p.rAU - peri.rAU) * LOUPE.auPx];
}

// Polyline through points; null breaks the line.
function pathD(points) {
  let d = '', pen = false;
  for (const p of points) {
    if (!p) { pen = false; continue; }
    d += `${pen ? 'L' : 'M'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
    pen = true;
  }
  return d;
}

const halfDisc = (from, to) => {
  const [x0, y0] = ringXY(from, DIAL.ring), [x1, y1] = ringXY(to, DIAL.ring);
  return `M${x0} ${y0} A${DIAL.ring} ${DIAL.ring} 0 0 1 ${x1} ${y1} Z`;
};

const readNow = () => DEV_OVERRIDES.dateMs ?? Date.now();

export default function SlowNoonDial({ onOverlay }) {
  const [nowMs, setNowMs] = useState(readNow);
  useEffect(() => {
    const id = setInterval(() => setNowMs(readNow()), SLOW_NOON_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const dayKey = Math.floor(nowMs / DAY_MS);
  const path = useMemo(() => rosettePath(dayKey * DAY_MS), [dayKey]);
  const { state, loupe } = useMemo(() => {
    const s = slowNoonState(nowMs);
    return { state: s, loupe: s.retro ? loupePath(s.retro) : null };
  }, [nowMs]);
  const reveal = useOverlayReveal(onOverlay);
  const lines = formatReadouts(state);

  const here = { t: nowMs, hour: state.hour, rAU: state.rAU };
  const trail = [...path.filter((p) => p.t >= nowMs - TRAIL_DAYS * DAY_MS && p.t < nowMs), here];
  const peris = path.filter((p, i) => i > 0 && i < path.length - 1 && p.rAU < path[i - 1].rAU && p.rAU <= path[i + 1].rAU);
  const [hx, hy] = dialXY(state.hour, state.rAU);

  let loupeD = '';
  if (loupe) {
    const peri = loupe.reduce((a, b) => (b.rAU < a.rAU ? b : a));
    loupeD = pathD(loupe.map((p) => {
      const xy = loupeXY(p, peri);
      return Math.hypot(xy[0] - LOUPE.x, xy[1] - LOUPE.y) < LOUPE.r - 1 ? xy : null;
    }));
  }

  const ticks = [];
  for (let i = 0; i < 24; i++) {
    const major = i % 6 === 0;
    const [x1, y1] = ringXY(i, DIAL.ring), [x2, y2] = ringXY(i, DIAL.ring - (major ? 10 : 4));
    ticks.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK.tick} strokeWidth={major ? 1.2 : 0.6} />);
  }
  const label = (hour, text) => {
    const [x, y] = ringXY(hour, DIAL.label);
    return <text key={text} x={x} y={y} fill={INK.label} fontSize="8" fontFamily="monospace" textAnchor="middle" dominantBaseline="middle" letterSpacing="1.5">{text}</text>;
  };

  return (
    <div
      className="border border-zinc-600/[0.05] rounded-lg bg-black/30 p-3 mt-4 select-none"
      role="group"
      aria-label={`The Slow Noon. ${lines.join('. ')}`}
      style={{ touchAction: 'manipulation' }}
      {...reveal}
    >
      <div className="text-[10px] font-mono text-zinc-400/80 uppercase tracking-[0.2em] mb-1">◉ THE SLOW NOON</div>
      <div className="text-[8px] font-mono text-zinc-600 mb-2">{'// one day at Caloris · 176 Earth days · radius = distance to the Sun'}</div>
      <svg viewBox="0 0 300 300" className="w-full h-auto" aria-hidden="true">
        <path d={halfDisc(6, 18)} fill={INK.day} />
        <path d={halfDisc(18, 6)} fill={INK.night} />
        <circle cx={DIAL.c} cy={DIAL.c} r={DIAL.ring} fill="none" stroke={INK.ring} />
        {ticks}
        {label(12, 'NOON')}{label(6, 'DAWN')}{label(18, 'DUSK')}{label(0, 'MIDNIGHT')}
        <path d={pathD(path.map((p) => dialXY(p.hour, p.rAU)))} fill="none" stroke={INK.path} strokeWidth="0.8" />
        {peris.map((p) => {
          const [x, y] = dialXY(p.hour, p.rAU);
          return <circle key={p.t} data-slow-noon-peri="" cx={x} cy={y} r="9" fill="none" stroke={INK.gold} strokeWidth="0.7" strokeDasharray="2 2" />;
        })}
        <g data-slow-noon-hand="" opacity={state.calorisFacing ? 1 : HAND_DIM}>
          <path d={pathD(trail.map((p) => dialXY(p.hour, p.rAU)))} fill="none" stroke={INK.trail} strokeWidth="1.4" />
          <circle cx={hx} cy={hy} r="3.2" fill={INK.hand} />
        </g>
        {loupe && (
          <g data-slow-noon-loupe="">
            <circle cx={LOUPE.x} cy={LOUPE.y} r={LOUPE.r} fill={INK.loupeBg} stroke={INK.gold} strokeWidth="0.7" />
            <path d={loupeD} fill="none" stroke={INK.gold} strokeWidth="1" />
            <text x={LOUPE.x} y="298" fill={INK.gold} fontSize="7" fontFamily="monospace" textAnchor="middle">×22 · THE SUN STANDS, TURNS BACK</text>
          </g>
        )}
      </svg>
      <div className="mt-2 space-y-0.5 text-[9px] font-mono text-zinc-400 uppercase tracking-[0.12em]">
        {lines.map((l) => <div key={l}>{l}</div>)}
      </div>
    </div>
  );
}
```

Note: the readout `d` in `SUN STANDS IN 34 d` is lower-case in the model; the container's `uppercase` class only changes display, `textContent` keeps `d`, which is what the test asserts.

- [ ] **Step 8: Run dial tests**

Run: `npx vitest run src/terminal/mercury/__tests__/SlowNoonDial.test.jsx src/terminal/mercury/__tests__/useOverlayReveal.test.jsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/terminal/mercury/useOverlayReveal.js src/terminal/mercury/SlowNoonDial.jsx src/terminal/mercury/__tests__/useOverlayReveal.test.jsx src/terminal/mercury/__tests__/SlowNoonDial.test.jsx
git commit -m "feat(mercury): THE SLOW NOON dial: Caloris resonance rosette, x22 retrograde loupe, hover / tap reveal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Place the dial in the /mercury sidebar

**Files:**
- Modify: `src/terminal/views/MercuryTab.jsx` (imports l.1-14; state block ~l.46-50; sidebar `<div className="order-last lg:order-first">` ~l.180; `<MercuryCanvas` ~l.202)
- Test: `src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js` (append source checks)

**Interfaces:**
- Consumes: `SlowNoonDial({ onOverlay })` (Task 4), `MercuryCanvas({ overlay })` (Task 3).

- [ ] **Step 1: Write the failing test** (append; add `import tabSrc from '../../views/MercuryTab.jsx?raw';` at the top)

```js
describe('THE SLOW NOON placement', () => {
  it('MercuryTab holds the overlay state, renders the dial under the controls, and feeds the canvas', () => {
    expect(tabSrc).toContain("import SlowNoonDial           from '../mercury/SlowNoonDial';");
    expect(tabSrc).toContain('const [slowNoonOverlay, setSlowNoonOverlay] = useState(false);');
    expect(tabSrc).toContain('<SlowNoonDial onOverlay={setSlowNoonOverlay} />');
    expect(tabSrc).toContain('overlay={slowNoonOverlay}');
    expect(tabSrc.indexOf('<SlowNoonDial')).toBeGreaterThan(tabSrc.indexOf('<MercuryControls'));
    expect(tabSrc.indexOf('<SlowNoonDial')).toBeLessThan(tabSrc.indexOf('<MercuryCanvas'));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js`
Expected: the new test FAILS.

- [ ] **Step 3: Implement in `MercuryTab.jsx`**

- After `import InstrumentsPanel       from '../mercury/InstrumentsPanel';` add:

```js
import SlowNoonDial           from '../mercury/SlowNoonDial';
```

- After `const [fps, setFps]                 = useState(0);` add:

```js
  const [slowNoonOverlay, setSlowNoonOverlay] = useState(false);
```

- In the sidebar block, after the closing `/>` of `<MercuryControls ... />` and before that block's closing `</div>`, add:

```jsx
          <SlowNoonDial onOverlay={setSlowNoonOverlay} />
```

- In `<MercuryCanvas`, after `onElementFired={handleElementFired}` add:

```jsx
            overlay={slowNoonOverlay}
```

- [ ] **Step 4: Run the mercury suites**

Run: `npx vitest run src/terminal/mercury src/terminal/views`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/MercuryTab.jsx src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js
git commit -m "feat(mercury): THE SLOW NOON in the sidebar under the controls, linked to the planet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Live verification (look sheet, longitude check, gates)

**Files:**
- Create: `.superpowers/sdd/tools/slowNoonShot.mjs` (gitignored; not committed)
- Append: `.superpowers/sdd/progress.md` (gitignored notes)

- [ ] **Step 1: Start the dev server** (preview tool, config `scale94-dev-5175` from `.claude/launch.json`; the probe expects port 5175).

- [ ] **Step 2: Write the probe**

```js
// THE SLOW NOON look sheet: rest, hover today, hover in the retrograde week, hover after a melt,
// phone tap reveal. node slowNoonShot.mjs -> OUT/slownoon-*.png
import { openMercury, sleep, OUT } from './openMercury.mjs';
const { launch } = await import(new URL('file:///F:/scale_9.4/scripts/cdp.mjs'));

const dialRect = (page) => page.eval(`(() => { const d = document.querySelector('[aria-label^="The Slow Noon"]'); d.scrollIntoView({ block: 'center' }); const r = d.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })()`);
const overlay = (page) => page.eval(`(() => { let v = null; window.__mercury.scene.traverse((o) => { const u = o.material && o.material.uniforms; if (u && u.uOverlay) v = +u.uOverlay.value.toFixed(3); }); return v; })()`);

const page = await launch({ url: 'about:blank', width: 1600, height: 1000 });
try {
  const m = await openMercury(page);
  await page.waitFor('!!window.__mercuryTune', { timeoutMs: 30000, label: '__mercuryTune' });
  const d = await dialRect(page);
  const away = [d[0] + d[2] + 400, d[1] - 200];
  await page.hover(...away); await sleep(600);
  console.log('rest overlay', await overlay(page)); await m.shot(`${OUT}/slownoon-1-rest.png`);
  await page.hover(d[0] + d[2] / 2, d[1] + d[3] / 2); await sleep(600);
  console.log('hover overlay', await overlay(page)); await m.shot(`${OUT}/slownoon-2-hover-today.png`);
  await page.hover(...away); await sleep(600);
  console.log('unhover overlay', await overlay(page));
  await page.eval(`window.__mercuryTune.dateOverride(Date.UTC(2026, 10, 10)); 1`); await sleep(11000);
  await page.hover(d[0] + d[2] / 2, d[1] + d[3] / 2); await sleep(600);
  await m.shot(`${OUT}/slownoon-3-hover-retro.png`);
  await page.screenshot({ path: `${OUT}/slownoon-3b-dial-retro.png`, clip: { x: d[0], y: d[1], width: d[2], height: d[3], scale: 1 } });
  await page.eval(`window.__mercuryTune.dateOverride(Date.UTC(2026, 11, 1)); 1`); await sleep(11000);
  await page.hover(d[0] + d[2] / 2, d[1] + d[3] / 2); await sleep(600);
  await m.shot(`${OUT}/slownoon-4-hover-caloris-noon.png`);
  await page.hover(...away); await m.melt(25); await sleep(1500);
  await page.hover(d[0] + d[2] / 2, d[1] + d[3] / 2); await sleep(600);
  await m.shot(`${OUT}/slownoon-5-hover-after-spin.png`);
  console.log('errors', JSON.stringify(await m.errors()));
  await page.setViewport(390, 844, 3); await page.enableTouch(); await sleep(1500);
  const p = await dialRect(page);
  await page.touch('touchStart', p[0] + p[2] / 2, p[1] + p[3] / 2); await page.touch('touchEnd', p[0] + p[2] / 2, p[1] + p[3] / 2);
  await sleep(800); console.log('tap overlay', await overlay(page));
  await page.screenshot({ path: `${OUT}/slownoon-6-phone-tap.png` });
  await sleep(4500); console.log('after 4 s overlay', await overlay(page));
} catch (e) { console.error('FAIL', e.message); } finally { await page.close(); process.exit(0); }
```

If `page.touch`'s signature differs, read `scripts/cdp.mjs:249` and adapt the two calls; do not change cdp.mjs.

- [ ] **Step 3: Run it and read the numbers**

Run: `node .superpowers/sdd/tools/slowNoonShot.mjs`
Expected console: `rest overlay 0`, `hover overlay 1`, `unhover overlay 0`, `errors []`, `tap overlay 1`, `after 4 s overlay 0`.

- [ ] **Step 4: Look at every frame (Read the PNGs) and check**
  1. Rest frame shows no lines.
  2. Hover today: sub-solar cross left of centre; freeze line(s); NO Caloris ring (far side, dial hand dimmed).
  3. 2026-12-01 hover: the Caloris ring sits on the visible Caloris basin (large circular basin, smooth floor) near the sub-solar point. **This is the longitude-convention check (spec §5.1).** If the ring sits on a different spot, the map is west-positive: change `CALORIS_DIR_BODY` to `dirFromLonLat(360 - CALORIS.lonDeg, CALORIS.latDeg)` and `calorisHour` to use the same longitude, re-run Task 1/2 tests (update expected values), and record the finding.
  4. Retro-week dial crop: the hand sits in the lower pinch region of the morning side, readout line 3 reads `THE SUN TURNS BACK · DAY 4 OF 8`.
  5. After the spin: the freeze line has moved relative to frame 4 (spin heat).
  6. Freeze line on bare crust (frames 2-4): decide with the author whether it stays (spec §3.4).
  Build a sheet with `node .superpowers/sdd/tools/mkSheet.mjs` (read its header for usage) as `look/52-slow-noon.png`.

- [ ] **Step 5: Gates**

Run: `npx vitest run` — expected: everything passes except the known artComposite `compositeDpr` failure.
Run: `npm run lint` — expected: 0 errors, warnings ≤ 137.
Draw calls: in the probe page, `window.__mercury.gl.info.render.calls` at rest and while hovering must both equal the pre-change value (11 per the last smoke).

- [ ] **Step 6: Record and stop for the author**

Append a section to `.superpowers/sdd/progress.md` with commit ids, the probe numbers, the longitude verdict, the crust-freeze-line question and the sheet path. Do not push. Hand the sheet to the author for the look call.

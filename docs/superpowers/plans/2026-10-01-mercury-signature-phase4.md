# /MERCURY phase 4 — the Sun's signature + gem pass: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** /MERCURY holds 60 fps on the author's phone. It honours reduced motion, it boils like a real bead of mercury, and it carries the Sun's signature: a sodium tail whose brightness follows Mercury's true radial velocity.

**Architecture:**
- **Tiers are shader variants.** A pure `planetQuality.js` names the tiers. `buildPlanetShader({ tier, calm })` interpolates per-tier loop counts into the existing `const int`s, so the `full` variant stays byte-identical to today's shader.
- **`CALM` threads through three layers:** the body integrator (a direct turn), the shader variant (no impulse loops, a strike glow), and the frame loop (frozen aether and exosphere clocks).
- **Roil** is a pure `mercuryRoil.js` mirrored in GLSL. A bubble pop is the existing `rippleSlope`, miniaturised.
- **The exosphere** is its own additive box mesh with a pure `mercuryExosphere.js` (brightness law, density, box fit) and its own small shader.
- **A dev-only perf HUD** (`?perf=1`) reads frame times into a ring buffer, with no React state per frame.

**Tech Stack:** three 0.183 `RawShaderMaterial` (GLSL 3), @react-three/fiber 9, vitest 4, @testing-library/react. Constants reach GLSL via `glf()` / `v3()` (`src/terminal/gl/glf.js`). Live checks use headless Chrome over CDP (`scripts/cdp.mjs`).

**Spec:** `docs/superpowers/specs/2026-10-01-mercury-signature-phase4-design.md` (decisions D1–D9). Master spec: `2026-09-30-mercury-gem-polish-design.md`, Amendments 1–4.

## Spec refinements (found while planning; Task 1 writes them into the spec)

- **R1, roil seams (§6).** Sum **every** active pop within reach, not just "the two nearest" (F1/F2). The 2×2×2 cell neighbourhood `floor(p − 0.5) + {0,1}³` provably contains every site that can reach `p` when `POP_JITTER + POP_REACH < 1`. The sum is therefore exactly continuous across cell boundaries. Pops are sparse, so on average fewer than one is evaluated per fragment: the same cost as F1/F2, and no seams at any density.
- **R2, pop scale (§6).** At `WAVE_PLAYBACK` the splash front moves at about 2.9 rad/s, so a real-dispersion pop cannot live 0.6 s inside a ~0.03 rad reach. A pop is therefore **the splash train miniaturised**:
  `popSlope(th, age) = POP_AMP · rippleSlope(th · POP_SCALE, age · POP_TIME, pxArc · POP_SCALE)` × windows,
  with `POP_SCALE = POP_REF_TH / POP_REACH_RAD` and `POP_TIME = POP_REF_TH / (WAVE_C_FRONT · POP_LIFE_S)`, so the front reaches the edge of the reach exactly at end of life. This is a stated convention, like Amendment 3's two playback speeds.
- **R3, tail-peak test (§7, §9).** `g/r²` does not peak exactly at the |v_r| maxima, because r changes too. The test asserts what is true: B at perihelion (v_r ≈ 0) is below B at the date of maximum |v_r|.

## Global Constraints

- **Branch** `feature/mercury-signature` (off `feature/mercury-surface` @ `25da0614`). Never push. Never touch `main`.
- **Commit trailer, exactly:** `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Not your own model name.
- **Never stage** `.import-cache.json`, `docs/superpowers/specs/2026-09-25-council-field-accretion-design.md`, `docs/superpowers/plans/2026-10-01-mercury-planet-phase1.md`, `src/terminal/views/manifesto/__tests__/__snapshots__/councilField.test.jsx.snap`, `baseline/*`, `scripts/_*`, `debug_dots*.mjs`, `test-output.txt`, `lookbook/`, `package-lock.json`, or `.superpowers/sdd/tools/out/*`. Stage by explicit path only. Never use `git add -A` or `git add .`.
- **Shader constants:** every physical or look constant in GLSL is interpolated from its JS owner with `glf()` / `v3()` and pinned by a test. Never hand-type a number that a module owns.
- **No per-frame allocation in `useFrame`.** Preallocate. A per-event allocation (a strike) or an allocation at 4 Hz (the HUD) is fine.
- **The `full` shader is byte-identical through Tasks 1–3.** `__tests__/__snapshots__/planetShader.full.fs.glsl` pins it. Only Task 4 (roil) changes the full FS, and it updates the snapshot deliberately with `-u`.
- **No derivatives (`dFdx`/`dFdy`/`fwidth`)** inside a loop with `continue`, inside a non-uniform branch, or after `discard`. All existing derivative calls stay where they are.
- **Lint:** `npm run lint` stays at **0 errors and ≤ 137 warnings** (measured 2026-10-01). Do not sweep exhaustive-deps.
- **Tests:** `npx vitest run src/terminal/mercury` is green after every task.
- **Look values are hypotheses.** The new knobs (`roilGain`, `exoGain`) default to 1. Pop spacing and life, the tail gains and `TAIL_B_FLOOR` are starting values the author tunes live.
- **Live checks:** a dev server on `http://localhost:5175` (`preview_start` name `scale94-dev-5175`; if another chat already holds that port, reuse the running server). Headless CDP only; the in-app pane runs at 0 fps. Screenshot before diagnosing anything visual.
- **Probe console capture:** `page.consoleErrors()` only sees `Log.entryAdded`. Three's shader errors go through `console.error`, so probes install the `window.__errs` hook from `openMercury.mjs` (Task 1).

## File map

| File | Status | Responsibility |
|---|---|---|
| `src/terminal/mercury/planet/planetQuality.js` | Create | Tier table, `pickTier`, URL overrides, `impulseOrder` (strongest-first slot order) |
| `src/terminal/mercury/planet/perfStats.js` | Create | Frame-time ring buffer, windowed percentiles, still/liquid split, `PERF_INFO` live readout |
| `src/terminal/mercury/MercuryPerfHud.jsx` | Create | Dev-only HUD: `useFrame` sampling, 4 Hz DOM overlay |
| `src/terminal/mercury/planet/mercuryPlanetShader.js` | Modify | `buildPlanetShader({ tier, calm })`, `CALM` glow, roil GLSL, `uRoilGain` |
| `src/terminal/mercury/planet/mercuryBody.js` | Modify | `calm` path: direct turn, no carried ω, overdamped recapture |
| `src/terminal/mercury/useCalm.js` | Create | `prefers-reduced-motion` (live) + `?calm=1` override |
| `src/terminal/mercury/planet/mercuryImpacts.js` | Modify | `calmGlow(age)` envelope + constants |
| `src/terminal/mercury/planet/mercuryRoil.js` | Create | Pop field: `hash13`, `popDensity`, `popSlope`, `roilTilt` (JS mirror of GLSL) |
| `src/terminal/mercury/planet/mercuryExosphere.js` | Create | `gNa`, `tailBrightness`, `tailLength`, `boilCoverage`, `haloColumn`, `tailDensity`, `exoBox` |
| `src/terminal/mercury/planet/exosphereShader.js` | Create | Exosphere VS/FS, uniform list |
| `src/terminal/mercury/MercuryExosphere.jsx` | Create | Additive box mesh, uniform writes |
| `src/terminal/mercury/planet/planetLook.js` | Modify | `PLANET_TUNE.roilGain`, `PLANET_TUNE.exoGain` |
| `src/terminal/mercury/mercuryTuning.js` | Modify | `DEV_OVERRIDES.dateMs` + `__mercuryTune.dateOverride(ms)` |
| `src/terminal/mercury/MercuryPlanet.jsx` | Modify | tier/calm props, slot order, calm wiring, roil gain, exosphere state, `PERF_INFO` |
| `src/terminal/mercury/MercuryCanvas.jsx` | Modify | `pickTier`, DPR from tier, `useCalm`, HUD mount |
| `.superpowers/sdd/tools/openMercury.mjs` | Create | Shared probe boot (open app, open tab, centre, state reader, error hook) |
| `.superpowers/sdd/tools/{tierProbe,calmProbe,boilProbe,exoProbe}.mjs` | Create | Live checks |
| Tests under `src/terminal/mercury/planet/__tests__/` and `src/terminal/mercury/__tests__/` | Create / Modify | See each task |

---

### Task 1: Quality tiers, tiered shader build, perf HUD

**Files:**
- Create: `src/terminal/mercury/planet/planetQuality.js`, `src/terminal/mercury/planet/perfStats.js`, `src/terminal/mercury/MercuryPerfHud.jsx`, `.superpowers/sdd/tools/openMercury.mjs`, `.superpowers/sdd/tools/tierProbe.mjs`
- Create tests: `src/terminal/mercury/planet/__tests__/planetQuality.test.js`, `src/terminal/mercury/planet/__tests__/perfStats.test.js`
- Modify: `src/terminal/mercury/planet/mercuryPlanetShader.js`, `src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`, `src/terminal/mercury/MercuryPlanet.jsx`, `src/terminal/mercury/MercuryCanvas.jsx`, `docs/superpowers/specs/2026-10-01-mercury-signature-phase4-design.md`

**Interfaces:**
- Produces:
  - `TIERS: { full|phone|lite: { dprMax, rippleSlots, shadowSteps, roil: 'pops'|'noise', exoSteps } }`
  - `TIER_NAMES`
  - `pickTier({ isMobile, search }) → 'full'|'phone'|'lite'`
  - `calmOverride(search) → boolean`
  - `perfHudOn(search) → boolean`
  - `impulseOrder(frame, n, out) → out` (indices, strongest first)
  - `buildPlanetShader({ tier = 'full' } = {}) → { vs, fs }`
  - `createPerfStats(capacity?)`, `pushFrame(stats, tS, dtS, liquid)`, `summarize(stats, nowS, { liquid } = {}) → { n, p50, p95, max, fps }` (ms)
  - `PERF_INFO` (a mutable `{ tau, heatK, coverage, tailB, vrKmS }`)
  - `<MercuryPerfHud tier calm />`
  - `<MercuryPlanet tier />`
  - probe helper `openMercury(page, query) → { cx, cy, shot(name, S?), st(), errors() }`

- [ ] **Step 1: Pin today's shader before touching it (parity snapshot)**

Add at the end of `src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`, inside the top-level `describe`, before its closing `});`:

```js
  it('the full variant is byte-identical to the pinned shader (phase-4 parity)', async () => {
    await expect(PLANET_FS).toMatchFileSnapshot('./__snapshots__/planetShader.full.fs.glsl');
    await expect(PLANET_VS).toMatchFileSnapshot('./__snapshots__/planetShader.full.vs.glsl');
  });
```

- [ ] **Step 2: Run it once to write the snapshot from the CURRENT code**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`
Expected: PASS, and two new files appear: `src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.full.fs.glsl` and `….vs.glsl`. If the run reports "obsolete/new snapshot not written" (CI mode), rerun with `-u`.

- [ ] **Step 3: Write the failing tier tests**

Create `src/terminal/mercury/planet/__tests__/planetQuality.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { TIERS, TIER_NAMES, pickTier, calmOverride, perfHudOn, impulseOrder } from '../planetQuality';
import { SHADOW_STEPS } from '../planetLook';
import { IMPULSE_SLOTS, createImpulseFrame } from '../mercuryWaves';

describe('planetQuality', () => {
  it('names three tiers; full is exactly today\'s shader budget', () => {
    expect(TIER_NAMES).toEqual(['full', 'phone', 'lite']);
    expect(TIERS.full.shadowSteps).toBe(SHADOW_STEPS);
    expect(TIERS.full.rippleSlots).toBe(IMPULSE_SLOTS);
    expect(TIERS.full.dprMax).toBe(2);
  });

  it('each tier costs no more than the one above it on every axis', () => {
    const order = ['full', 'phone', 'lite'];
    for (let i = 1; i < order.length; i++) {
      const hi = TIERS[order[i - 1]], lo = TIERS[order[i]];
      for (const k of ['dprMax', 'rippleSlots', 'shadowSteps', 'exoSteps']) expect(lo[k]).toBeLessThanOrEqual(hi[k]);
    }
    expect(TIERS.lite.roil).toBe('noise');
    expect(TIERS.phone.roil).toBe('pops');
  });

  it('pickTier: device class by default, ?tier= overrides, junk is ignored', () => {
    expect(pickTier({ isMobile: false, search: '' })).toBe('full');
    expect(pickTier({ isMobile: true, search: '' })).toBe('phone');
    expect(pickTier({ isMobile: false, search: '?tier=lite' })).toBe('lite');
    expect(pickTier({ isMobile: true, search: '?perf=1&tier=full' })).toBe('full');
    expect(pickTier({ isMobile: true, search: '?tier=ultra' })).toBe('phone');
    expect(pickTier()).toBe('full');
  });

  it('calmOverride and perfHudOn read their flags', () => {
    expect(calmOverride('?calm=1')).toBe(true);
    expect(calmOverride('?calm=0')).toBe(false);
    expect(calmOverride('')).toBe(false);
    expect(perfHudOn('?tier=phone&perf=1')).toBe(true);
    expect(perfHudOn('?perf=yes')).toBe(false);
  });

  it('impulseOrder: strongest slot first (modes + ripple), stable on ties, no allocation', () => {
    const f = createImpulseFrame();
    f.wave[2 * 3 + 1] = 0.3;          // slot 3: ripple 0.3
    f.mode[3 * 5] = -0.5;             // slot 5: mode 0.5
    f.mode[3 * 1 + 2] = 0.1;          // slot 1: mode 0.1
    const out = new Array(IMPULSE_SLOTS).fill(-1);
    const r = impulseOrder(f, IMPULSE_SLOTS, out);
    expect(r).toBe(out);
    expect(out.slice(0, 3)).toEqual([5, 3, 1]);
    expect(out.slice(3)).toEqual([0, 2, 4, 6, 7]);
  });
});
```

- [ ] **Step 4: Run to see it fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/planetQuality.test.js`
Expected: FAIL, "Failed to resolve import ../planetQuality".

- [ ] **Step 5: Write `planetQuality.js`**

Create `src/terminal/mercury/planet/planetQuality.js`:

```js
// src/terminal/mercury/planet/planetQuality.js — what each device class can afford
// (phase-4 spec §3). A tier is a shader variant (its loop counts are compile-time
// consts) plus a DPR cap. Fixed per device class, never switched at runtime (D3);
// ?tier= overrides it for HUD sessions. The phone column is set from the author's
// phone HUD (checkpoint 1), not guessed.

import { SHADOW_STEPS } from './planetLook';
import { IMPULSE_SLOTS } from './mercuryWaves';

export const TIERS = Object.freeze({
  full: Object.freeze({ dprMax: 2, rippleSlots: IMPULSE_SLOTS, shadowSteps: SHADOW_STEPS, roil: 'pops', exoSteps: 16 }),
  phone: Object.freeze({ dprMax: 1.5, rippleSlots: 4, shadowSteps: 6, roil: 'pops', exoSteps: 8 }),
  lite: Object.freeze({ dprMax: 1, rippleSlots: 2, shadowSteps: 0, roil: 'noise', exoSteps: 0 }),
});
export const TIER_NAMES = Object.keys(TIERS);

function param(search, key) {
  try { return new URLSearchParams(search ?? '').get(key); } catch { return null; }
}

export function pickTier({ isMobile = false, search = '' } = {}) {
  const forced = param(search, 'tier');
  if (forced && Object.hasOwn(TIERS, forced)) return forced;
  return isMobile ? 'phone' : 'full';
}

export const calmOverride = (search = '') => param(search, 'calm') === '1';
export const perfHudOn = (search = '') => param(search, 'perf') === '1';

function slotStrength(frame, i) {
  return Math.abs(frame.mode[3 * i]) + Math.abs(frame.mode[3 * i + 1]) + Math.abs(frame.mode[3 * i + 2])
    + Math.abs(frame.wave[2 * i + 1]);
}

// Impulse slots ordered strongest first, so a tier whose shader draws only k slots
// draws the k that show. Stable insertion sort into a preallocated out; allocates nothing.
export function impulseOrder(frame, n, out) {
  for (let i = 0; i < n; i++) {
    const s = slotStrength(frame, i);
    let j = i;
    while (j > 0 && slotStrength(frame, out[j - 1]) < s) { out[j] = out[j - 1]; j--; }
    out[j] = i;
  }
  return out;
}
```

- [ ] **Step 6: Run the tier tests**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/planetQuality.test.js`
Expected: PASS (5 tests).

- [ ] **Step 7: Write the failing variant tests**

Add to the imports at the top of `mercuryPlanetShader.test.js`:

```js
import { buildPlanetShader } from '../mercuryPlanetShader';
import { TIERS, TIER_NAMES } from '../planetQuality';
```

Add inside the `describe`:

```js
  it('buildPlanetShader: full is PLANET_FS/VS exactly; each tier sets its loop counts', () => {
    const full = buildPlanetShader();
    expect(full.fs).toBe(PLANET_FS);
    expect(full.vs).toBe(PLANET_VS);
    expect(buildPlanetShader({ tier: 'full' }).fs).toBe(PLANET_FS);
    for (const tier of TIER_NAMES) {
      const { fs } = buildPlanetShader({ tier });
      expect(fs).toContain(`const int SHADOW_STEPS = ${TIERS[tier].shadowSteps};`);
      expect(fs).toContain(`const int IMPULSE_SLOTS = ${TIERS[tier].rippleSlots};`);
      // the uniform arrays stay full-size: JS always writes IMPULSE_SLOTS slots, strongest first
      expect(fs).toContain(`uniform vec3 uImpDir[${IMPULSE_SLOTS}];`);
    }
    expect(() => buildPlanetShader({ tier: 'ultra' })).toThrow(/unknown tier/);
  });

  it('a tier without a shadow march never calls castShadow', () => {
    const lite = buildPlanetShader({ tier: 'lite' }).fs;
    expect(lite).toContain('if (false && mu0g > -uSunSinR && mu0g < SHADOW_ZONE)');
    expect(PLANET_FS).toContain('if (uHasMaps > 0.5 && mu0g > -uSunSinR && mu0g < SHADOW_ZONE)');
  });
```

- [ ] **Step 8: Run to see it fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`
Expected: FAIL, "buildPlanetShader is not a function" (or not exported).

- [ ] **Step 9: Make the fragment shader a function of the tier**

In `src/terminal/mercury/planet/mercuryPlanetShader.js`:

(a) Add to the imports:
```js
import { TIERS } from './planetQuality';
```

(b) Replace the line
```js
export const PLANET_FS = /* glsl */ `precision highp float;
```
with
```js
function planetFs(q) {
  return /* glsl */ `precision highp float;
```

(c) Replace
```glsl
const int SHADOW_STEPS = ${SHADOW_STEPS};
```
with
```glsl
const int SHADOW_STEPS = ${q.shadowSteps};
```

(d) Replace
```glsl
const int IMPULSE_SLOTS = ${IMPULSE_SLOTS};
```
with
```glsl
const int IMPULSE_SLOTS = ${q.rippleSlots};
```
Leave the three `uniform … uImp…[${IMPULSE_SLOTS}];` lines untouched; they keep the JS constant (8).

(e) Replace
```glsl
  if (uHasMaps > 0.5 && mu0g > -uSunSinR && mu0g < SHADOW_ZONE) {
```
with
```glsl
  if (${q.shadowSteps > 0 ? 'uHasMaps > 0.5' : 'false'} && mu0g > -uSunSinR && mu0g < SHADOW_ZONE) {
```

(f) Replace the final two lines of the file
```js
}
`;
```
(the end of the FS template) with
```js
}
`;
}

export const PLANET_FS = planetFs(TIERS.full);

// A tier is a shader variant: loop counts are compile-time consts (phase-4 spec §3).
export function buildPlanetShader({ tier = 'full' } = {}) {
  const q = TIERS[tier];
  if (!q) throw new Error(`buildPlanetShader: unknown tier "${tier}"`);
  return { vs: PLANET_VS, fs: tier === 'full' ? PLANET_FS : planetFs(q) };
}
```

`SHADOW_STEPS` is still imported from `planetLook` and used by `planetQuality`. If lint flags it as unused in the shader module, remove it from that import list only.

- [ ] **Step 10: Run the shader tests (parity included)**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`
Expected: PASS, including "byte-identical to the pinned shader". If parity fails, diff `PLANET_FS` against the snapshot file; the only allowed edits are (b)–(f), and for `full` they must reproduce the old text exactly.

- [ ] **Step 11: Write the failing perf-stats tests**

Create `src/terminal/mercury/planet/__tests__/perfStats.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createPerfStats, pushFrame, summarize, PERF_WINDOW_S, PERF_INFO } from '../perfStats';

describe('perfStats', () => {
  it('percentiles in ms over the window, fps from p50', () => {
    const s = createPerfStats(256);
    for (let i = 0; i < 100; i++) pushFrame(s, i * 0.01, (i < 90 ? 10 : 30) / 1000, false);
    const r = summarize(s, 0.99);
    expect(r.n).toBe(100);
    expect(r.p50).toBeCloseTo(10, 6);
    expect(r.p95).toBeCloseTo(30, 6);
    expect(r.max).toBeCloseTo(30, 6);
    expect(r.fps).toBeCloseTo(100, 6);
  });

  it('only frames inside PERF_WINDOW_S count', () => {
    const s = createPerfStats(256);
    pushFrame(s, 0, 0.5, false);                 // old hitch
    for (let i = 1; i <= 10; i++) pushFrame(s, 10 + i * 0.016, 0.016, false);
    const r = summarize(s, 10 + 10 * 0.016);
    expect(r.n).toBe(10);
    expect(r.max).toBeCloseTo(16, 6);
    expect(PERF_WINDOW_S).toBe(2);
  });

  it('splits still and liquid frames', () => {
    const s = createPerfStats(64);
    for (let i = 0; i < 10; i++) pushFrame(s, i * 0.01, 0.008, false);
    for (let i = 10; i < 20; i++) pushFrame(s, i * 0.01, 0.02, true);
    expect(summarize(s, 0.2, { liquid: false }).p50).toBeCloseTo(8, 6);
    expect(summarize(s, 0.2, { liquid: true }).p50).toBeCloseTo(20, 6);
    expect(summarize(s, 0.2).n).toBe(20);
  });

  it('wraps without losing the newest frames; empty summary is zeros', () => {
    const s = createPerfStats(8);
    expect(summarize(s, 0)).toEqual({ n: 0, p50: 0, p95: 0, max: 0, fps: 0 });
    for (let i = 0; i < 20; i++) pushFrame(s, i * 0.01, (i + 1) / 1000, false);
    const r = summarize(s, 0.19);
    expect(r.n).toBe(8);
    expect(r.max).toBeCloseTo(20, 6);
  });

  it('PERF_INFO is a plain mutable readout', () => {
    expect(Object.keys(PERF_INFO).sort()).toEqual(['coverage', 'heatK', 'tailB', 'tau', 'vrKmS']);
  });
});
```

- [ ] **Step 12: Run to see it fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/perfStats.test.js`
Expected: FAIL, "Failed to resolve import ../perfStats".

- [ ] **Step 13: Write `perfStats.js`**

Create `src/terminal/mercury/planet/perfStats.js`:

```js
// src/terminal/mercury/planet/perfStats.js — frame-time statistics for the dev perf HUD
// (phase-4 spec §4). A preallocated ring buffer filled from useFrame (no allocation per
// frame); summaries run at the HUD's 4 Hz. The still/liquid split exists because the
// liquid branch is the expensive state and an average would hide it.

export const PERF_WINDOW_S = 2;

// Live readout the frame loop writes and the HUD (and probes, via window.__mercuryPerf) read.
export const PERF_INFO = { tau: 0, heatK: 0, coverage: 0, tailB: 0, vrKmS: 0 };

export function createPerfStats(capacity = 1024) {
  return {
    cap: capacity,
    t: new Float64Array(capacity),
    dt: new Float32Array(capacity),
    liquid: new Uint8Array(capacity),
    head: 0,
    count: 0,
    scratch: new Float32Array(capacity),
  };
}

export function pushFrame(s, tS, dtS, liquid) {
  s.t[s.head] = tS;
  s.dt[s.head] = dtS;
  s.liquid[s.head] = liquid ? 1 : 0;
  s.head = (s.head + 1) % s.cap;
  if (s.count < s.cap) s.count++;
}

const pick = (sorted, n, p) => sorted[Math.min(n - 1, Math.floor(p * n))];

export function summarize(s, nowS, { liquid } = {}) {
  let n = 0;
  for (let k = 0; k < s.count; k++) {
    const i = (s.head - 1 - k + s.cap) % s.cap;
    if (nowS - s.t[i] > PERF_WINDOW_S) break;
    if (liquid !== undefined && (s.liquid[i] === 1) !== liquid) continue;
    s.scratch[n++] = s.dt[i] * 1000;
  }
  if (n === 0) return { n: 0, p50: 0, p95: 0, max: 0, fps: 0 };
  const sorted = s.scratch.subarray(0, n).sort();
  const p50 = pick(sorted, n, 0.5);
  return { n, p50, p95: pick(sorted, n, 0.95), max: sorted[n - 1], fps: p50 > 0 ? 1000 / p50 : 0 };
}
```

- [ ] **Step 14: Run the perf-stats tests**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/perfStats.test.js`
Expected: PASS (5 tests).

- [ ] **Step 15: Write the HUD component**

Create `src/terminal/mercury/MercuryPerfHud.jsx`:

```jsx
// MercuryPerfHud.jsx — dev-only perf HUD for /MERCURY (phase-4 spec §4), mounted with ?perf=1.
// Samples frame delta inside useFrame into a ring buffer (no React state per frame) and
// writes a fixed DOM overlay at 4 Hz. The author reads or screenshots it on their phone.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { createPerfStats, pushFrame, summarize, PERF_INFO } from './planet/perfStats';

const fmt = (r) => (r.n ? `${r.p50.toFixed(1)} / ${r.p95.toFixed(1)} / ${r.max.toFixed(1)} ms  (${r.fps.toFixed(0)} fps, n=${r.n})` : '—');

export default function MercuryPerfHud({ tier, calm }) {
  const gl = useThree((s) => s.gl);
  const stats = useMemo(() => createPerfStats(), []);
  const lastT = useRef(0);

  useFrame(({ clock }, delta) => {
    lastT.current = clock.elapsedTime;
    pushFrame(stats, clock.elapsedTime, delta, PERF_INFO.tau > 0);
  });

  useEffect(() => {
    const el = document.createElement('pre');
    Object.assign(el.style, {
      position: 'fixed', left: '8px', bottom: '8px', zIndex: 2147483647, margin: 0, padding: '6px 8px',
      font: '11px/1.35 ui-monospace, monospace', color: '#cfe', background: 'rgba(0,0,0,0.72)',
      pointerEvents: 'none', whiteSpace: 'pre',
    });
    el.dataset.mercuryPerfHud = '1';
    document.body.appendChild(el);
    const id = setInterval(() => {
      const now = lastT.current;
      const c = gl.domElement;
      el.textContent = [
        `tier ${tier}${calm ? ' +CALM' : ''}  dpr ${gl.getPixelRatio().toFixed(2)}  ${c.width}×${c.height}px`,
        `all     p50/p95/max ${fmt(summarize(stats, now))}`,
        `still   p50/p95/max ${fmt(summarize(stats, now, { liquid: false }))}`,
        `liquid  p50/p95/max ${fmt(summarize(stats, now, { liquid: true }))}`,
        `τ ${PERF_INFO.tau.toFixed(2)}  heat ${PERF_INFO.heatK.toFixed(1)} K  boil ${(PERF_INFO.coverage * 100).toFixed(0)}%`,
        `tail B ${PERF_INFO.tailB.toFixed(2)}  v_r ${PERF_INFO.vrKmS.toFixed(1)} km/s`,
      ].join('\n');
    }, 250);
    return () => { clearInterval(id); el.remove(); };
  }, [gl, stats, tier, calm]);

  return null;
}
```

- [ ] **Step 16: Wire the tier, slot order and readout into `MercuryPlanet.jsx`**

In `src/terminal/mercury/MercuryPlanet.jsx`:

(a) Replace `import { PLANET_VS, PLANET_FS } from './planet/mercuryPlanetShader';` with:
```js
import { buildPlanetShader } from './planet/mercuryPlanetShader';
import { impulseOrder } from './planet/planetQuality';
import { PERF_INFO } from './planet/perfStats';
```

(b) Change the signature to:
```js
export default function MercuryPlanet({ isMobile = false, tier = 'full', emitters = {}, strikes = null }) {
```

(c) Directly above `const material = useMemo(() => new THREE.RawShaderMaterial({`, add:
```js
  const shader = useMemo(() => buildPlanetShader({ tier }), [tier]);
```
Inside the material, set `vertexShader: shader.vs,` and `fragmentShader: shader.fs,`. Change the material's dependency array to `[isMobile, init, body, scarTex, shader]`.

(d) In the DEV effect, replace
```js
    if (import.meta.env.DEV) registerTuningRig();
```
with
```js
    if (import.meta.env.DEV) { registerTuningRig(); window.__mercuryPerf = PERF_INFO; }
```

(e) In the `surf` useMemo object, add the field `order: Array.from({ length: IMPULSE_SLOTS }, (_, i) => i),`.

(f) Directly after `u.uHeatK.value = body.heatK;`, add:
```js
    PERF_INFO.tau = body.tau;
    PERF_INFO.heatK = body.heatK;
```

(g) Replace the uniform-write loop
```js
    for (let i = 0; i < IMPULSE_SLOTS; i++) {
      const slot = surf.impulses.slots[i];
      bodyToWorld(slot.dir, body.q, surf.w);
      slipDirWorld(surf.w, slot.dirWorld0, slot.slip, surf.w);
      u.uImpDir.value[i].set(surf.w[0], surf.w[1], surf.w[2]);
      u.uImpMode.value[i].set(surf.frame.mode[3 * i], surf.frame.mode[3 * i + 1], surf.frame.mode[3 * i + 2]);
      u.uImpWave.value[i].set(surf.frame.wave[2 * i], surf.frame.wave[2 * i + 1]);
    }
```
with
```js
    // Strongest first: a tier whose shader loops over fewer slots draws the ones that show.
    impulseOrder(surf.frame, IMPULSE_SLOTS, surf.order);
    for (let j = 0; j < IMPULSE_SLOTS; j++) {
      const i = surf.order[j];
      const slot = surf.impulses.slots[i];
      bodyToWorld(slot.dir, body.q, surf.w);
      slipDirWorld(surf.w, slot.dirWorld0, slot.slip, surf.w);
      u.uImpDir.value[j].set(surf.w[0], surf.w[1], surf.w[2]);
      u.uImpMode.value[j].set(surf.frame.mode[3 * i], surf.frame.mode[3 * i + 1], surf.frame.mode[3 * i + 2]);
      u.uImpWave.value[j].set(surf.frame.wave[2 * i], surf.frame.wave[2 * i + 1]);
    }
```

- [ ] **Step 17: Wire the tier, DPR and HUD into `MercuryCanvas.jsx`**

In `src/terminal/mercury/MercuryCanvas.jsx`:

(a) Add imports:
```js
import MercuryPerfHud from './MercuryPerfHud';
import { TIERS, pickTier, perfHudOn } from './planet/planetQuality';
```

(b) Below `const GHOST_DENSITY = …;` add:
```js
const SEARCH = typeof window !== 'undefined' ? window.location.search : '';
const TIER = pickTier({ isMobile, search: SEARCH });
const PERF_HUD = import.meta.env.DEV && perfHudOn(SEARCH);
```

(c) Replace `const dpr = isMobile ? [1, 1.5] : [1, 2];` with:
```js
  const dpr = [1, TIERS[TIER].dprMax];
```

(d) In `<MercuryPlanet`, add the prop `tier={TIER}` after `isMobile={isMobile}`.

(e) Directly after the closing `/>` of `<MercurySphere … />`, add:
```jsx
        {PERF_HUD && <MercuryPerfHud tier={TIER} calm={false} />}
```

- [ ] **Step 18: Run the mercury suite and lint**

Run: `npx vitest run src/terminal/mercury`
Expected: all green.
Run: `npm run lint`
Expected: `0 errors`, warnings ≤ 137.

- [ ] **Step 19: Write the shared probe boot**

Create `.superpowers/sdd/tools/openMercury.mjs`:

```js
// Shared boot for /MERCURY live probes: open the app with a query, open the Mercury tab,
// centre its canvas, hook console.error (three's shader errors never reach Log.entryAdded).
export const OUT = 'F:/scale_9.4/.superpowers/sdd/tools/out';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function openMercury(page, query = '') {
  await page.goto(`http://localhost:5175/${query}`, { waitMs: 500 });
  await page.eval(`window.__errs = []; { const e = console.error.bind(console); console.error = (...a) => { window.__errs.push(a.map(String).join(' ')); e(...a); }; } 1`);
  await page.waitFor(`!!document.querySelector('button')`, { label: 'app' });
  await sleep(1000);
  await page.waitFor(`!document.body.innerText.includes('sys::boot_sequence')`, { timeoutMs: 40000, label: 'boot done' });
  await sleep(2600);
  const findGrab = `[...document.querySelectorAll('canvas')].find(c => c.style.cursor === 'grab' || c.style.cursor === 'grabbing')`;
  const btn = await page.eval(`(() => { const b = document.querySelector('[aria-label^="Open Mercury"]'); const r = b.getBoundingClientRect(); return [r.x + r.width/2, r.y + r.height/2]; })()`);
  await page.click(btn[0], btn[1]);
  await page.waitFor(`!!${findGrab}`, { timeoutMs: 20000, label: 'mercury canvas' });
  await sleep(4000);
  await page.eval(`(${findGrab}).scrollIntoView({block:'center'}); 1`);
  await sleep(500);
  const b = await page.eval(`(() => { const b = (${findGrab}).getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; })()`);
  const cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2;
  return {
    cx, cy, rect: b,
    shot: (path, S = 560) => page.screenshot({ path, clip: { x: cx - S / 2, y: cy - S / 2, width: S, height: S, scale: 1 } }),
    st: () => page.eval(`(() => { let o = null; window.__mercury.scene.traverse((m) => { const u = m.material && m.material.uniforms; if (u && u.uSurfOn) o = { tau: +u.uTau.value.toFixed(3), heat: +u.uHeatK.value.toFixed(1), surfOn: u.uSurfOn.value }; }); return { ...o, perf: window.__mercuryPerf ? { ...window.__mercuryPerf } : null }; })()`),
    errors: () => page.eval(`[...window.__errs, ...window.__mercury.gl.info.programs.filter(p => p.diagnostics && !p.diagnostics.runnable).map(p => 'PROGRAM NOT RUNNABLE: ' + p.name)]`),
    async melt(n = 25) {
      for (let i = 0; i < n; i++) {
        const d = await page.drag(cx - 250, cy + (i % 3 - 1) * 60, cx + 250, cy + (i % 3 - 1) * 60, 8);
        await d.release(); await sleep(40);
      }
    },
  };
}
```

- [ ] **Step 20: Write the tier probe**

Create `.superpowers/sdd/tools/tierProbe.mjs`:

```js
// Each tier compiles, renders and shows the HUD: melt, screenshot, report errors + HUD text.
// usage: node .superpowers/sdd/tools/tierProbe.mjs [tag]
import { openMercury, OUT, sleep } from './openMercury.mjs';
const { launch } = await import(new URL('file:///F:/scale_9.4/scripts/cdp.mjs'));
const TAG = process.argv[2] ?? 'tier1';
let bad = 0;
for (const tier of ['full', 'phone', 'lite']) {
  const page = await launch({ url: 'about:blank', width: 1600, height: 1000 });
  try {
    const m = await openMercury(page, `?tier=${tier}&perf=1`);
    await m.shot(`${OUT}/${TAG}-${tier}-still.png`);
    await m.melt();
    await sleep(1500);
    await m.shot(`${OUT}/${TAG}-${tier}-liquid.png`);
    const hud = await page.eval(`document.querySelector('[data-mercury-perf-hud]')?.textContent ?? 'NO HUD'`);
    const errs = await m.errors();
    console.log(`--- ${tier}`, JSON.stringify(await m.st()));
    console.log(hud);
    if (errs.length) { bad++; console.log('ERRORS', errs); }
  } catch (e) { bad++; console.error('FAIL', tier, e.message); } finally { await page.close(); }
}
process.exit(bad ? 1 : 0);
```

- [ ] **Step 21: Run the tier probe and look at the frames**

Run: `node .superpowers/sdd/tools/tierProbe.mjs tier1`
Expected:
- exit 0;
- for each tier, a HUD block whose first line names that tier;
- `τ` near 1 after the melt;
- no `ERRORS` lines.

Then open `out/tier1-full-liquid.png`, `-phone-liquid.png` and `-lite-liquid.png` and check: full looks as before; lite has no crater shadows near the terminator; all three show the liquid mirror.

- [ ] **Step 22: Record R1–R3 in the spec**

Append to `docs/superpowers/specs/2026-10-01-mercury-signature-phase4-design.md`:

```markdown

## 12. Refinements from planning (2026-10-01)

- **R1 (§6):** the shader sums every active pop within reach, not just F1/F2. The 2×2×2 neighbourhood `floor(p − 0.5) + {0,1}³` contains every site that can reach `p` when `POP_JITTER + POP_REACH < 1`, so the sum is exactly seam-free. Pops are sparse, so the cost matches F1/F2.
- **R2 (§6):** a pop is the splash train miniaturised: `rippleSlope(th·POP_SCALE, age·POP_TIME, pxArc·POP_SCALE)`. At `WAVE_PLAYBACK` real dispersion cannot keep a 0.6 s pop inside its ~0.03 rad reach. This is a third stated playback convention.
- **R3 (§7, §9):** `g/r²` does not peak exactly at the |v_r| maxima. The test asserts that B at perihelion (v_r ≈ 0) is below B at the date of maximum |v_r|.
```

- [ ] **Step 23: Commit**

```bash
git add src/terminal/mercury/planet/planetQuality.js src/terminal/mercury/planet/perfStats.js src/terminal/mercury/MercuryPerfHud.jsx src/terminal/mercury/planet/mercuryPlanetShader.js src/terminal/mercury/MercuryPlanet.jsx src/terminal/mercury/MercuryCanvas.jsx src/terminal/mercury/planet/__tests__/planetQuality.test.js src/terminal/mercury/planet/__tests__/perfStats.test.js src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.full.fs.glsl src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.full.vs.glsl .superpowers/sdd/tools/openMercury.mjs .superpowers/sdd/tools/tierProbe.mjs docs/superpowers/specs/2026-10-01-mercury-signature-phase4-design.md
git commit -m "feat(mercury): quality tiers as shader variants, strongest-first slots, dev perf HUD

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Checkpoint 1 — the author's phone sets the `phone` tier (author gate)

**Files:**
- Modify: `src/terminal/mercury/planet/planetQuality.js` (the `phone` row only)

**Interfaces:**
- Consumes: the HUD from Task 1.
- Produces: measured `TIERS.phone` values that later tasks budget against.

- [ ] **Step 1: Serve the dev build on the LAN**

The HUD is dev-only, so the phone must load the dev server. The author runs this in their own terminal (it binds a LAN address):

```bash
npm run dev -- --host --port 5176
```

Vite prints a `Network:` URL, e.g. `http://192.168.x.y:5176/`.

- [ ] **Step 2: Hand the author the exact protocol (in chat)**

Send them:
1. On the phone, open `<Network URL>?perf=1`, then open the Mercury tab.
2. **Still:** wait 5 s and screenshot the HUD.
3. **Liquid:** flick the planet hard about 10 times until it turns to mirror, wait 2 s, and screenshot.
4. **Hard spin:** keep flicking for 5 s and screenshot mid-spin.
5. Repeat steps 2–4 with `?perf=1&tier=lite`. That gives the floor.

- [ ] **Step 3: Set the `phone` row from the screenshots**

Rule: the `phone` row must hold **liquid p95 ≤ 16.7 ms** (D1: 60 fps).
- If the phone already meets that, keep the row as written.
- If not, step down in this order, re-measuring after each: `shadowSteps` 6 → 3 → 0, then `rippleSlots` 4 → 2, then `dprMax` 1.5 → 1.25 → 1.
- If even `lite` misses, stop and report the numbers to the author. Do not change the `full` look.

Edit only the `phone:` line in `planetQuality.js`, and add a comment with the measured numbers and the date, e.g.:

```js
  // measured 2026-10-0x on the author's phone: still p95 X ms, liquid p95 Y ms, spin p95 Z ms
  phone: Object.freeze({ dprMax: 1.5, rippleSlots: 4, shadowSteps: 6, roil: 'pops', exoSteps: 8 }),
```

- [ ] **Step 4: Re-run the tier tests and commit**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/planetQuality.test.js`
Expected: PASS (the monotonicity test still holds).

```bash
git add src/terminal/mercury/planet/planetQuality.js
git commit -m "perf(mercury): phone tier set from the author's phone HUD (checkpoint 1)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Reduced motion (`CALM`)

**Files:**
- Create: `src/terminal/mercury/useCalm.js`, `src/terminal/mercury/__tests__/useCalm.test.jsx`, `.superpowers/sdd/tools/calmProbe.mjs`
- Modify: `src/terminal/mercury/planet/mercuryBody.js`, `src/terminal/mercury/planet/__tests__/mercuryBody.test.js`, `src/terminal/mercury/planet/mercuryImpacts.js`, `src/terminal/mercury/planet/__tests__/mercuryImpacts.test.js`, `src/terminal/mercury/planet/mercuryPlanetShader.js`, `src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`, `src/terminal/mercury/MercuryPlanet.jsx`, `src/terminal/mercury/MercuryCanvas.jsx`

**Interfaces:**
- Consumes: `calmOverride(search)` (Task 1), `buildPlanetShader` (Task 1).
- Produces:
  - `stepBody(b, dt, { dragging, omegaPtr, target, calm })`
  - `RECAPTURE_CALM_OMEGA`, `RECAPTURE_CALM_ZETA`
  - `useCalm() → boolean`, `CALM_QUERY`
  - `calmGlow(ageS) → number`, `CALM_GLOW_S`, `CALM_GLOW_RAD`, `CALM_GLOW_GAIN`
  - `buildPlanetShader({ tier, calm })`
  - `PLANET_CALM_UNIFORMS` (`PLANET_UNIFORMS` + `'uGlow'`)
  - `<MercuryPlanet calm />`

- [ ] **Step 1: Write the failing body tests**

In `src/terminal/mercury/planet/__tests__/mercuryBody.test.js`, extend the import list with `RECAPTURE_CALM_OMEGA` and `RECAPTURE_CALM_ZETA`, then add inside the `describe`:

```js
  describe('calm (reduced motion)', () => {
    it('a drag turns the body 1:1 with the pointer: no grip lag', () => {
      const target = targetFromYaw(0.3);
      const body = createBody(target);
      for (let i = 0; i < 60; i++) stepBody(body, 1 / 60, { dragging: true, omegaPtr: [0, 2, 0], target, calm: true });
      expect(angleBetween(body.q, targetFromYaw(2.3))).toBeLessThan(1e-9);
    });

    it('release carries no spin: ω is zeroed, then only the slow return moves it', () => {
      const target = targetFromYaw(0);
      const body = createBody(target);
      for (let i = 0; i < 30; i++) stepBody(body, 1 / 60, { dragging: true, omegaPtr: [0, 4, 0], target, calm: true });
      stepBody(body, 1 / 60, { dragging: false, target, calm: true });
      const K = RECAPTURE_CALM_OMEGA ** 2;
      expect(body.omega.length()).toBeLessThan(K * 2 * (1 / 60) + 1e-9); // ≤ K·|error|·dt, error ≤ 2 rad
    });

    it('the return is overdamped: the angle to the present never grows, and it settles', () => {
      expect(RECAPTURE_CALM_ZETA).toBeGreaterThan(1);
      const target = targetFromYaw(0);
      const body = createBody(target);
      for (let i = 0; i < 45; i++) stepBody(body, 1 / 60, { dragging: true, omegaPtr: [1.5, 2, 0], target, calm: true });
      let prev = angleBetween(body.q, target);
      for (let i = 0; i < 40 * 60; i++) {
        stepBody(body, 1 / 60, { dragging: false, target, calm: true });
        const a = angleBetween(body.q, target);
        expect(a).toBeLessThanOrEqual(prev + 1e-12);
        prev = a;
      }
      expect(prev).toBeLessThan(0.5 * Math.PI / 180);
    });

    it('a vigorous hand still melts it, and it still refreezes', () => {
      const target = targetFromYaw(0);
      const body = createBody(target);
      for (let i = 0; i < 10 * 60; i++) stepBody(body, 1 / 60, { dragging: true, omegaPtr: [0, 8, 0], target, calm: true });
      for (let i = 0; i < 3 * 60; i++) stepBody(body, 1 / 60, { dragging: false, target, calm: true });
      expect(body.tau).toBe(1);
      for (let i = 0; i < 90 * 60; i++) stepBody(body, 1 / 60, { dragging: false, target, calm: true });
      expect(body.tau).toBe(0);
    });

    it('60 Hz and 360 Hz agree in calm', () => {
      const go = (hz) => {
        const target = targetFromYaw(0.2);
        const body = createBody(target);
        for (let i = 0; i < 2 * hz; i++) stepBody(body, 1 / hz, { dragging: true, omegaPtr: [0.7, 3, 0], target, calm: true });
        for (let i = 0; i < 5 * hz; i++) stepBody(body, 1 / hz, { dragging: false, target, calm: true });
        return body;
      };
      const a = go(60), b = go(360);
      expect(angleBetween(a.q, b.q)).toBeLessThan(2e-3);
      expect(Math.abs(a.heatK - b.heatK)).toBeLessThan(0.01 * Math.max(1, a.heatK));
    });
  });
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryBody.test.js`
Expected: FAIL. The calm tests fail: `RECAPTURE_CALM_OMEGA` is undefined, or the 1:1 test misses because of grip lag.

- [ ] **Step 3: Implement the calm path in `mercuryBody.js`**

(a) Below `export const TRANSMUTE_S = 3;`, add:
```js
// Reduced motion (phase-4 spec §5): the hand turns the body directly; nothing spins on.
export const RECAPTURE_CALM_OMEGA = 1.2; // rad/s natural frequency of the calm return…
export const RECAPTURE_CALM_ZETA = 2;    // …overdamped: it eases home, never overshoots
```

(b) In `createBody`, add `held: false,` after `sinceReleaseS: Infinity,`.

(c) Change `function substep(b, h, dragging, omegaPtr, target) {` to `function substep(b, h, dragging, omegaPtr, target, calm) {`. Replace its first block, from `if (dragging) {` through the closing `}` of the `else` (just before `const len = w.length();`), with:

```js
  if (dragging && calm) {
    // The pointer turns the body 1:1; ω is the hand's, kept only for the heat store.
    b.sinceReleaseS = 0;
    b.held = true;
    w.set(omegaPtr[0], omegaPtr[1], omegaPtr[2]);
  } else if (dragging) {
    b.sinceReleaseS = 0;
    b.held = false;
    const k = 1 - Math.exp(-GRIP_PER_S * h);
    w.set(w.x + (omegaPtr[0] - w.x) * k, w.y + (omegaPtr[1] - w.y) * k, w.z + (omegaPtr[2] - w.z) * k);
  } else if (calm) {
    if (b.held) { w.set(0, 0, 0); b.held = false; } // release: nothing is flung
    b.sinceReleaseS += h;
    const K = RECAPTURE_CALM_OMEGA * RECAPTURE_CALM_OMEGA;
    const C = 2 * RECAPTURE_CALM_ZETA * RECAPTURE_CALM_OMEGA;
    rotationError(b.q, target, _e);
    w.multiplyScalar(Math.exp(-C * h));
    w.set(w.x + K * _e.x * h, w.y + K * _e.y * h, w.z + K * _e.z * h);
  } else {
    b.sinceReleaseS += h;
    w.multiplyScalar(Math.exp(-SPIN_DAMP_PER_S * h));
    const ramp = smooth01(b.sinceReleaseS / RECAPTURE_RAMP_S);
    if (ramp > 0) {
      const K = RECAPTURE_OMEGA * RECAPTURE_OMEGA * ramp;
      const C = 2 * RECAPTURE_OMEGA * Math.sqrt(ramp);
      rotationError(b.q, target, _e);
      w.multiplyScalar(Math.exp(-C * h));
      w.set(w.x + K * _e.x * h, w.y + K * _e.y * h, w.z + K * _e.z * h);
    }
  }
```

(d) Replace
```js
  if (dragging && len <= MAX_OMEGA * (1 - 1e-12)) {
```
with
```js
  if (dragging && calm) {
    _mid.copy(w); // 1:1 with the (clamped) pointer
  } else if (dragging && len <= MAX_OMEGA * (1 - 1e-12)) {
```

(e) Replace the `stepBody` export with:
```js
export function stepBody(b, dtS, { dragging = false, omegaPtr = [0, 0, 0], target, calm = false }) {
  if (!(dtS > 0) || !Number.isFinite(dtS)) return b;
  const n = Math.max(1, Math.ceil(dtS / MAX_SUBSTEP_S - 1e-9));
  const h = dtS / n;
  for (let i = 0; i < n; i++) substep(b, h, dragging, omegaPtr, target, calm);
  return b;
}
```

- [ ] **Step 4: Run the body tests**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryBody.test.js`
Expected: PASS (all existing tests plus 5 calm tests).

- [ ] **Step 5: Write the failing `calmGlow` test**

Add to `src/terminal/mercury/planet/__tests__/mercuryImpacts.test.js` (extend its import from `'../mercuryImpacts'` with `calmGlow, CALM_GLOW_S, CALM_GLOW_GAIN`):

```js
describe('calmGlow (reduced-motion strike answer)', () => {
  it('is a smooth in-out bump over CALM_GLOW_S, zero outside', () => {
    expect(calmGlow(-0.01)).toBe(0);
    expect(calmGlow(0)).toBe(0);
    expect(calmGlow(CALM_GLOW_S / 2)).toBeCloseTo(CALM_GLOW_GAIN, 12);
    expect(calmGlow(CALM_GLOW_S)).toBe(0);
    expect(calmGlow(Infinity)).toBe(0);
    expect(calmGlow(0.25 * CALM_GLOW_S)).toBeCloseTo(calmGlow(0.75 * CALM_GLOW_S), 12);
    expect(CALM_GLOW_S).toBe(0.4);
  });
});
```

- [ ] **Step 6: Run to see it fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryImpacts.test.js`
Expected: FAIL, "calmGlow is not a function".

- [ ] **Step 7: Implement `calmGlow`**

Append to `src/terminal/mercury/planet/mercuryImpacts.js`:

```js
// Reduced motion (phase-4 spec §5): a strike on the element brightens the impact point
// for CALM_GLOW_S (a sin² bump, smooth in and out) instead of ringing.
export const CALM_GLOW_S = 0.4;
export const CALM_GLOW_RAD = 0.12;   // angular radius of the glow (Gaussian σ), rad
export const CALM_GLOW_GAIN = 0.6;   // linear radiance added at the peak

export function calmGlow(ageS) {
  if (!(ageS > 0) || ageS >= CALM_GLOW_S) return 0;
  const s = Math.sin((Math.PI * ageS) / CALM_GLOW_S);
  return CALM_GLOW_GAIN * s * s;
}
```

- [ ] **Step 8: Run the impacts tests**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryImpacts.test.js`
Expected: PASS.

- [ ] **Step 9: Write the failing calm-shader tests**

In `mercuryPlanetShader.test.js`, extend the import from `'../mercuryPlanetShader'` with `PLANET_CALM_UNIFORMS`, add `import { CALM_GLOW_RAD } from '../mercuryImpacts';`, then add inside the `describe`:

```js
  it('the CALM variant compiles out every impulse loop and adds only the strike glow', () => {
    const calm = buildPlanetShader({ calm: true }).fs;
    expect(calm).toContain('const int IMPULSE_SLOTS = 0;');
    expect(calm).toContain('uniform vec4 uGlow;');
    expect(calm).toContain(`const float CALM_GLOW_RAD = ${glf(CALM_GLOW_RAD)};`);
    expect(calm).toMatch(/colLin \+= fluid \* uGlow\.w \* exp\(/);
    expect(PLANET_FS).not.toContain('uGlow');
    expect(buildPlanetShader({ tier: 'full', calm: false }).fs).toBe(PLANET_FS);
    for (const tier of TIER_NAMES) expect(buildPlanetShader({ tier, calm: true }).fs).toContain('const int IMPULSE_SLOTS = 0;');
  });

  it('declares exactly PLANET_CALM_UNIFORMS in the CALM variant', () => {
    const fs = buildPlanetShader({ calm: true }).fs;
    const names = declared(fs).filter((u) => !PLANET_BUILTINS.includes(u));
    expect([...names].sort()).toEqual([...PLANET_CALM_UNIFORMS].sort());
    expect(PLANET_CALM_UNIFORMS).toEqual([...PLANET_UNIFORMS, 'uGlow']);
  });
```

- [ ] **Step 10: Run to see it fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`
Expected: FAIL. `PLANET_CALM_UNIFORMS` is undefined, and the calm FS lacks `uGlow`.

- [ ] **Step 11: Add the CALM variant to the shader**

In `mercuryPlanetShader.js`:

(a) Add the import:
```js
import { CALM_GLOW_RAD } from './mercuryImpacts';
```

(b) Below the `PLANET_UNIFORMS` array, add:
```js
export const PLANET_CALM_UNIFORMS = [...PLANET_UNIFORMS, 'uGlow'];
```

(c) Change `function planetFs(q) {` to `function planetFs(q, calm = false) {`.

(d) Replace
```glsl
uniform vec4 uBulge;
```
with
```glsl
uniform vec4 uBulge;${calm ? '\nuniform vec4 uGlow;' : ''}
```

(e) Replace
```glsl
const int IMPULSE_SLOTS = ${q.rippleSlots};
```
with
```glsl
const int IMPULSE_SLOTS = ${calm ? 0 : q.rippleSlots};
```

(f) Replace
```glsl
const float DIMPLE_NORM = 2.3316;
```
with
```glsl
const float DIMPLE_NORM = 2.3316;${calm ? `\nconst float CALM_GLOW_RAD = ${glf(CALM_GLOW_RAD)};` : ''}
```

(g) Replace
```glsl
      colLin = mix(colLin, mix(solid, liquid, liquidW), fluid);
```
with
```glsl
      colLin = mix(colLin, mix(solid, liquid, liquidW), fluid);${calm ? '\n      colLin += fluid * uGlow.w * exp(-(1.0 - dot(xw, uGlow.xyz)) / (CALM_GLOW_RAD * CALM_GLOW_RAD));' : ''}
```
(`1 − cos θ ≈ θ²/2`, so this is a Gaussian of σ = `CALM_GLOW_RAD`.)

(h) Replace `buildPlanetShader` with:
```js
export function buildPlanetShader({ tier = 'full', calm = false } = {}) {
  const q = TIERS[tier];
  if (!q) throw new Error(`buildPlanetShader: unknown tier "${tier}"`);
  return { vs: PLANET_VS, fs: tier === 'full' && !calm ? PLANET_FS : planetFs(q, calm) };
}
```

- [ ] **Step 12: Run the shader tests (parity included)**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`
Expected: PASS. The full parity snapshot is unchanged.

- [ ] **Step 13: Write the failing `useCalm` test**

Create `src/terminal/mercury/__tests__/useCalm.test.jsx`:

```jsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useCalm, { CALM_QUERY } from '../useCalm';

function mockMatchMedia(initial) {
  const listeners = new Set();
  const mq = {
    matches: initial,
    media: CALM_QUERY,
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
  };
  window.matchMedia = vi.fn(() => mq);
  return { mq, listeners, set(v) { mq.matches = v; listeners.forEach((fn) => fn({ matches: v })); } };
}

describe('useCalm', () => {
  const realMM = window.matchMedia;
  afterEach(() => { window.matchMedia = realMM; window.history.replaceState(null, '', '/'); });

  it('reads prefers-reduced-motion and follows an OS toggle live', () => {
    const m = mockMatchMedia(false);
    const { result, unmount } = renderHook(() => useCalm());
    expect(result.current).toBe(false);
    act(() => m.set(true));
    expect(result.current).toBe(true);
    unmount();
    expect(m.listeners.size).toBe(0);
  });

  it('?calm=1 forces it on (probes)', () => {
    mockMatchMedia(false);
    window.history.replaceState(null, '', '/?calm=1');
    const { result } = renderHook(() => useCalm());
    expect(result.current).toBe(true);
  });

  it('no matchMedia: off, no crash', () => {
    window.matchMedia = undefined;
    const { result } = renderHook(() => useCalm());
    expect(result.current).toBe(false);
  });
});
```

- [ ] **Step 14: Run to see it fail**

Run: `npx vitest run src/terminal/mercury/__tests__/useCalm.test.jsx`
Expected: FAIL, "Failed to resolve import ../useCalm".

- [ ] **Step 15: Write `useCalm.js`**

Create `src/terminal/mercury/useCalm.js`:

```js
// useCalm — reduced motion for /MERCURY (phase-4 spec §5): prefers-reduced-motion, read
// live (an OS toggle applies at once), or ?calm=1 for probes.

import { useEffect, useState } from 'react';
import { calmOverride } from './planet/planetQuality';

export const CALM_QUERY = '(prefers-reduced-motion: reduce)';

function readCalm() {
  if (typeof window === 'undefined') return false;
  if (calmOverride(window.location.search)) return true;
  return !!window.matchMedia?.(CALM_QUERY)?.matches;
}

export default function useCalm() {
  const [calm, setCalm] = useState(readCalm);
  useEffect(() => {
    const mq = typeof window !== 'undefined' ? window.matchMedia?.(CALM_QUERY) : null;
    if (!mq) return undefined;
    const onChange = () => setCalm(readCalm());
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return calm;
}
```

- [ ] **Step 16: Run the hook test**

Run: `npx vitest run src/terminal/mercury/__tests__/useCalm.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 17: Wire `CALM` into `MercuryPlanet.jsx`**

(a) Extend the `mercuryImpacts` import with `calmGlow`.

(b) Signature:
```js
export default function MercuryPlanet({ isMobile = false, tier = 'full', calm = false, emitters = {}, strikes = null }) {
```

(c) Change `const shader = useMemo(() => buildPlanetShader({ tier }), [tier]);` to:
```js
  const shader = useMemo(() => buildPlanetShader({ tier, calm }), [tier, calm]);
```

(d) In the material's `uniforms`, after `uBulge: …,` add:
```js
      uGlow: { value: new THREE.Vector4(0, 0, 1, 0) },
```

(e) In the `surf` object, add:
```js
    aetherT: 0,
    glowT0: -Infinity,
    glowDirBody: [0, 0, 1],
```

(f) Replace
```js
    stepBody(body, stepS, { dragging, omegaPtr, target });
```
with
```js
    stepBody(body, stepS, { dragging, omegaPtr, target, calm });
```

(g) In the strike loop, replace
```js
      } else {
        addImpulse(surf.impulses, { dirBody: surf.b, tS: t, mode: IMPACT_MODE_AMP[kind], wave: IMPACT_WAVE_AMP[kind], kind });
      }
```
with
```js
      } else if (calm) {
        surf.glowT0 = t; // reduced motion: the tap brightens the point instead of ringing
        surf.glowDirBody[0] = surf.b[0]; surf.glowDirBody[1] = surf.b[1]; surf.glowDirBody[2] = surf.b[2];
      } else {
        addImpulse(surf.impulses, { dirBody: surf.b, tS: t, mode: IMPACT_MODE_AMP[kind], wave: IMPACT_WAVE_AMP[kind], kind });
      }
```

(h) Replace
```js
    const imp = wakeImpulse(surf.wake, surf.wakeArgs);
```
with
```js
    const imp = calm ? null : wakeImpulse(surf.wake, surf.wakeArgs);
```

(i) Replace
```js
    spinBulge(body.omega, body.tau * PLANET_TUNE.modeGain, surf.bulge);
    u.uBulge.value.set(surf.bulge[0], surf.bulge[1], surf.bulge[2], surf.bulge[3]);
    u.uSurfOn.value = surf.frame.any || Math.abs(surf.bulge[3]) > 1e-5 ? 1 : 0;
```
with
```js
    spinBulge(body.omega, calm ? 0 : body.tau * PLANET_TUNE.modeGain, surf.bulge);
    u.uBulge.value.set(surf.bulge[0], surf.bulge[1], surf.bulge[2], surf.bulge[3]);
    u.uSurfOn.value = !calm && (surf.frame.any || Math.abs(surf.bulge[3]) > 1e-5) ? 1 : 0;
    if (calm) {
      bodyToWorld(surf.glowDirBody, body.q, surf.w);
      u.uGlow.value.set(surf.w[0], surf.w[1], surf.w[2], calmGlow(t - surf.glowT0));
    }
```

(j) Replace
```js
    aetherLobeDirs(t, aether.dirs);
```
with
```js
    if (!calm) surf.aetherT += delta; // reduced motion freezes the streak drift (D5)
    aetherLobeDirs(surf.aetherT, aether.dirs);
```
(With `calm` never on, `surf.aetherT` accumulates the same deltas that make up `clock.elapsedTime`, so today's drift is unchanged.)

- [ ] **Step 18: Wire `useCalm` into `MercuryCanvas.jsx`**

(a) Add `import useCalm from './useCalm';`.

(b) At the top of the component body, before `const dpr = …`, add:
```js
  const calm = useCalm();
```

(c) In `<MercuryPlanet`, add `calm={calm}` after `tier={TIER}`.

(d) Change the HUD line to `{PERF_HUD && <MercuryPerfHud tier={TIER} calm={calm} />}`.

- [ ] **Step 19: Run the suite and lint**

Run: `npx vitest run src/terminal/mercury`, then `npm run lint`
Expected: green; 0 errors; warnings ≤ 137.

- [ ] **Step 20: Write the calm probe**

Create `.superpowers/sdd/tools/calmProbe.mjs`:

```js
// CALM: the planet follows the hand, melts to a STILL mirror (no ripples: uSurfOn stays 0),
// and stops dead on release, easing home. usage: node .superpowers/sdd/tools/calmProbe.mjs [tag]
import { openMercury, OUT, sleep } from './openMercury.mjs';
const { launch } = await import(new URL('file:///F:/scale_9.4/scripts/cdp.mjs'));
const TAG = process.argv[2] ?? 'calm1';
const page = await launch({ url: 'about:blank', width: 1600, height: 1000 });
let bad = 0;
try {
  const m = await openMercury(page, '?calm=1&perf=1');
  await m.melt(30);
  let surfSeen = 0;
  for (let k = 0; k < 6; k++) { const s = await m.st(); surfSeen += s.surfOn; await m.shot(`${OUT}/${TAG}-liquid${k}.png`); await sleep(300); }
  // a slow drag mid-liquid: no wake rings may appear
  const d = await page.drag(m.cx - 150, m.cy, m.cx + 150, m.cy, 40);
  await m.shot(`${OUT}/${TAG}-dragging.png`);
  await d.release();
  await m.shot(`${OUT}/${TAG}-release0.png`);
  await sleep(250);
  await m.shot(`${OUT}/${TAG}-release250.png`);
  const s = await m.st();
  console.log('state', JSON.stringify(s), 'surfOn seen', surfSeen);
  if (surfSeen !== 0 || s.surfOn !== 0) { bad++; console.log('FAIL: impulses active under CALM'); }
  const errs = await m.errors();
  if (errs.length) { bad++; console.log('ERRORS', errs); }
} catch (e) { bad++; console.error('FAIL', e.message); } finally { await page.close(); process.exit(bad ? 1 : 0); }
```

- [ ] **Step 21: Run the calm probe and look at the frames**

Run: `node .superpowers/sdd/tools/calmProbe.mjs calm1`
Expected:
- exit 0, `surfOn seen 0`, τ ≈ 1;
- `calm1-liquid*.png` show a mirror with **no ripple rings**;
- the aether streaks sit in the same place across `liquid0`…`liquid5` (drift frozen);
- `release0` and `release250` are nearly identical (no fling).

Then run the regressions, each against its reference run:
- `node .superpowers/sdd/tools/refreezeProbe.mjs rf-t3`: τ falls to 0 around t33–36 s, as in `rf-fix`.
- `node .superpowers/sdd/tools/tumbleDense.mjs td-t3`: no matte cap, as in `td2`.

- [ ] **Step 22: Commit**

```bash
git add src/terminal/mercury/useCalm.js src/terminal/mercury/__tests__/useCalm.test.jsx src/terminal/mercury/planet/mercuryBody.js src/terminal/mercury/planet/__tests__/mercuryBody.test.js src/terminal/mercury/planet/mercuryImpacts.js src/terminal/mercury/planet/__tests__/mercuryImpacts.test.js src/terminal/mercury/planet/mercuryPlanetShader.js src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js src/terminal/mercury/MercuryPlanet.jsx src/terminal/mercury/MercuryCanvas.jsx .superpowers/sdd/tools/calmProbe.mjs
git commit -m "feat(mercury): reduced motion — the hand turns the planet, the liquid stays still, the aether holds

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Boiling roil (bubble-collapse pops)

**Files:**
- Create: `src/terminal/mercury/planet/mercuryRoil.js`, `src/terminal/mercury/planet/__tests__/mercuryRoil.test.js`, `.superpowers/sdd/tools/boilProbe.mjs`
- Modify: `src/terminal/mercury/planet/mercuryPlanetShader.js`, `src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js` (and its full-FS snapshot, deliberately), `src/terminal/mercury/planet/planetLook.js`, `src/terminal/mercury/MercuryPlanet.jsx`

**Interfaces:**
- Consumes:
  - `rippleSlope(th, age, pxArc)`, `WAVE_C_FRONT` from `mercuryWaves.js`;
  - `TIERS[tier].roil`;
  - `planetFs(q, calm)`.
- Produces:
  - `hash13(x, y, z)`, `popDensity(superheatK)`, `popSlope(th, age, pxArc)`, `roilTilt(x, tS, superheatK, pxArc) → { g: [3], act }`;
  - constants `POP_FREQ, POP_JITTER, POP_REACH, POP_REACH_RAD, POP_REF_TH, POP_SCALE, POP_LIFE_S, POP_TIME, POP_P_MIN, POP_P_MAX, POP_DENSITY_K, POP_AMP, POP_SALTS, ROIL_LITE_FREQ, ROIL_LITE_SPEED, ROIL_LITE_AMP`;
  - uniform `uRoilGain`;
  - `PLANET_TUNE.roilGain`.

- [ ] **Step 1: Write the failing roil tests**

Create `src/terminal/mercury/planet/__tests__/mercuryRoil.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  hash13, popDensity, popSlope, roilTilt,
  POP_FREQ, POP_JITTER, POP_REACH, POP_REACH_RAD, POP_REF_TH, POP_SCALE, POP_LIFE_S, POP_TIME,
} from '../mercuryRoil';
import { WAVE_C_FRONT } from '../mercuryWaves';

const norm = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };
// deterministic PRNG for sampling (mulberry32)
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

describe('mercuryRoil', () => {
  it('hash13 is deterministic and in [0, 1)', () => {
    const r = rng(1);
    for (let i = 0; i < 500; i++) {
      const p = [r() * 40 - 20, r() * 40 - 20, r() * 40 - 20];
      const h = hash13(...p);
      expect(h).toBe(hash13(...p));
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });

  it('popDensity: 0 at and below the boil point, rising steadily, below 1', () => {
    expect(popDensity(0)).toBe(0);
    expect(popDensity(-20)).toBe(0);
    let prev = 0;
    for (let dT = 5; dT <= 200; dT += 5) {
      const d = popDensity(dT);
      expect(d).toBeGreaterThan(prev);
      expect(d).toBeLessThan(1);
      prev = d;
    }
  });

  it('the miniature: the front reaches the edge of the reach exactly at end of life (R2)', () => {
    expect(POP_SCALE * POP_REACH_RAD).toBeCloseTo(POP_REF_TH, 12);
    expect(WAVE_C_FRONT * POP_LIFE_S * POP_TIME).toBeCloseTo(POP_REF_TH, 12);
    expect(POP_REACH_RAD).toBeCloseTo(POP_REACH / POP_FREQ, 12);
  });

  it('containment: no slope beyond the reach or after the life', () => {
    for (const age of [0.01, 0.1, 0.3, 0.55]) {
      expect(popSlope(POP_REACH_RAD, age, 0)).toBe(0);
      expect(popSlope(POP_REACH_RAD * 1.5, age, 0)).toBe(0);
    }
    expect(popSlope(0.3 * POP_REACH_RAD, POP_LIFE_S, 0)).toBe(0);
    expect(popSlope(0.3 * POP_REACH_RAD, POP_LIFE_S + 1, 0)).toBe(0);
    expect(Math.abs(popSlope(0.2 * POP_REACH_RAD, 0.1, 0))).toBeGreaterThan(0);
  });

  it('no pops below the boil point', () => {
    const r = rng(2);
    for (let i = 0; i < 200; i++) {
      const x = norm([r() - 0.5, r() - 0.5, r() - 0.5]);
      const { g, act } = roilTilt(x, r() * 100, -1, 0.002);
      expect(g).toEqual([0, 0, 0]);
      expect(act).toBe(0);
    }
  });

  it('more superheat, more surface boiling (a steady onset, no hard line)', () => {
    const r = rng(3);
    const xs = Array.from({ length: 4000 }, () => norm([r() - 0.5, r() - 0.5, r() - 0.5]));
    const busy = (dT) => xs.filter((x) => roilTilt(x, 7.3, dT, 0.002).act > 0).length;
    const a = busy(10), b = busy(60), c = busy(150);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it('the slope is tangent to the sphere and activity stays in [0, 1]', () => {
    const r = rng(4);
    for (let i = 0; i < 2000; i++) {
      const x = norm([r() - 0.5, r() - 0.5, r() - 0.5]);
      const { g, act } = roilTilt(x, r() * 50, 150, 0.002);
      expect(Math.abs(g[0] * x[0] + g[1] * x[1] + g[2] * x[2])).toBeLessThan(1e-9);
      expect(act).toBeGreaterThanOrEqual(0);
      expect(act).toBeLessThanOrEqual(1);
    }
  });

  it('seam-free (R1): continuous across every cell boundary, at full density', () => {
    expect(POP_JITTER + POP_REACH).toBeLessThan(1);
    const r = rng(5);
    let compared = 0;
    // A unit vector whose p.x = x·POP_FREQ is exactly px (y, z rescaled to stay on the sphere).
    const onSphere = (px, y, z) => {
      const x0 = px / POP_FREQ;
      const k = Math.sqrt(1 - x0 * x0) / Math.hypot(y, z);
      return [x0, y * k, z * k];
    };
    for (let i = 0; i < 3000; i++) {
      const x = norm([r() - 0.5, r() - 0.5, r() - 0.5]);
      // the nearest x-boundary of the 2×2×2 neighbourhood: p.x − 0.5 an integer
      const bx = Math.round(x[0] * POP_FREQ - 0.5) + 0.5;
      if (Math.abs(bx / POP_FREQ) > 0.98) continue;
      const xA = onSphere(bx - 1e-7, x[1], x[2]), xB = onSphere(bx + 1e-7, x[1], x[2]);
      const t = r() * 30;
      const A = roilTilt(xA, t, 200, 0.002), B = roilTilt(xB, t, 200, 0.002);
      if (A.act === 0 && B.act === 0) continue;
      compared++;
      for (let k = 0; k < 3; k++) expect(Math.abs(A.g[k] - B.g[k])).toBeLessThan(1e-3);
    }
    expect(compared).toBeGreaterThan(50);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryRoil.test.js`
Expected: FAIL, "Failed to resolve import ../mercuryRoil".

- [ ] **Step 3: Write `mercuryRoil.js`**

Create `src/terminal/mercury/planet/mercuryRoil.js`:

```js
// src/terminal/mercury/planet/mercuryRoil.js — the boil zone as bubble-collapse pops
// (phase-4 spec §6 + refinements R1, R2).
//
// CONVENTIONS, stated so no reader assumes more:
// - Pops live in the BODY frame on a 3D cell lattice over x·POP_FREQ (≈ 0.07 rad
//   spacing). Each cell has a hashed site (jitter ±POP_JITTER), a hashed period in
//   [POP_P_MIN, POP_P_MAX] and phase; it is active iff its hash < popDensity(T − T_boil),
//   so the boil front fades in as sparse pops and thickens toward noon.
// - A pop is the splash's dispersive train (mercuryWaves.rippleSlope), MINIATURISED:
//   arc × POP_SCALE, time × POP_TIME, so its front reaches POP_REACH_RAD exactly at
//   POP_LIFE_S. Real capillary dispersion at WAVE_PLAYBACK would cross the reach in
//   milliseconds; this is a third stated playback convention (spec R2).
// - Every active pop within reach is summed. The 2×2×2 neighbourhood floor(p − 0.5)
//   + {0,1}³ holds every site that can reach p while POP_JITTER + POP_REACH < 1, so the
//   field is exactly continuous across cell boundaries (spec R1).
// - Ring distance is the 3D lattice distance / POP_FREQ (a sphere ∩ ball circle), which
//   is what makes the containment exact.
// mercuryPlanetShader.js mirrors hash13, popDensity, popSlope and roilTilt exactly
// (constants via glf; the GLSL hash runs in float32, so values agree in law, not bit).

import { rippleSlope, WAVE_C_FRONT } from './mercuryWaves';

export const POP_FREQ = 14;              // cells per unit of the body frame (spacing ≈ 0.071 rad)
export const POP_JITTER = 0.25;          // site jitter, ± cell units
export const POP_REACH = 0.45;           // ring reach, cell units (POP_JITTER + POP_REACH < 1)
export const POP_REACH_RAD = POP_REACH / POP_FREQ;
export const POP_REF_TH = 0.5;           // the splash arc (rad) the miniature's reach maps to
export const POP_SCALE = POP_REF_TH / POP_REACH_RAD;
export const POP_LIFE_S = 0.6;
export const POP_TIME = POP_REF_TH / (WAVE_C_FRONT * POP_LIFE_S);
export const POP_P_MIN = 1.5;            // s between one cell's pops…
export const POP_P_MAX = 4;              // …hashed per cell in this range
export const POP_DENSITY_K = 60;         // superheat (K) for 1 − 1/e of cells active
export const POP_AMP = 0.12;             // slope gain of one pop (× PLANET_TUNE.roilGain)
export const POP_SALTS = Object.freeze({
  active: [17.13, 3.71, 5.29],
  period: [31.7, 11.3, 2.9],
  phase: [47.3, 23.1, 13.7],
  x: [0, 0, 0],
  y: [19.19, 7.77, 1.11],
  z: [5.55, 29.3, 37.7],
});
// lite tier: one octave of animated value noise instead of pops
export const ROIL_LITE_FREQ = 40;
export const ROIL_LITE_SPEED = 1.5;
export const ROIL_LITE_AMP = 0.08;

const fract = (x) => x - Math.floor(x);
const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// mercuryPlanetShader's hash13, in JS.
export function hash13(x, y, z) {
  let px = fract(x * 0.1031), py = fract(y * 0.1031), pz = fract(z * 0.1031);
  const d = px * (pz + 31.32) + py * (py + 31.32) + pz * (px + 31.32);
  px += d; py += d; pz += d;
  return fract((px + py) * pz);
}

export function popDensity(superheatK) {
  return superheatK > 0 ? 1 - Math.exp(-superheatK / POP_DENSITY_K) : 0;
}

export function popSlope(th, age, pxArc) {
  if (th >= POP_REACH_RAD || age >= POP_LIFE_S) return 0;
  const w = 1 - smoothstep(0.7 * POP_REACH_RAD, POP_REACH_RAD, th);
  const life = 1 - smoothstep(0.7 * POP_LIFE_S, POP_LIFE_S, age);
  return POP_AMP * w * life * rippleSlope(th * POP_SCALE, Math.max(age * POP_TIME, 1e-3), pxArc * POP_SCALE);
}

const salted = (c, s) => hash13(c[0] + s[0], c[1] + s[1], c[2] + s[2]);

// Tangential slope of the pop field at unit body-frame x (subtract from the normal,
// like waveTilt), plus local pop activity in [0, 1] for the roughness patches.
export function roilTilt(x, tS, superheatK, pxArc) {
  const g = [0, 0, 0];
  let act = 0;
  const dens = popDensity(superheatK);
  if (dens <= 0) return { g, act };
  const p = [x[0] * POP_FREQ, x[1] * POP_FREQ, x[2] * POP_FREQ];
  const base = [Math.floor(p[0] - 0.5), Math.floor(p[1] - 0.5), Math.floor(p[2] - 0.5)];
  const c = [0, 0, 0];
  for (let i = 0; i < 8; i++) {
    c[0] = base[0] + (i & 1); c[1] = base[1] + ((i >> 1) & 1); c[2] = base[2] + ((i >> 2) & 1);
    if (salted(c, POP_SALTS.active) >= dens) continue;
    const period = POP_P_MIN + (POP_P_MAX - POP_P_MIN) * salted(c, POP_SALTS.period);
    const t = tS + salted(c, POP_SALTS.phase) * period;
    const age = t - period * Math.floor(t / period);
    if (age >= POP_LIFE_S) continue;
    const sx = c[0] + 0.5 + (salted(c, POP_SALTS.x) - 0.5) * 2 * POP_JITTER;
    const sy = c[1] + 0.5 + (salted(c, POP_SALTS.y) - 0.5) * 2 * POP_JITTER;
    const sz = c[2] + 0.5 + (salted(c, POP_SALTS.z) - 0.5) * 2 * POP_JITTER;
    const dx = p[0] - sx, dy = p[1] - sy, dz = p[2] - sz;
    const d = Math.hypot(dx, dy, dz);
    if (d >= POP_REACH) continue;
    const r = dx * x[0] + dy * x[1] + dz * x[2];
    const tx = dx - x[0] * r, ty = dy - x[1] * r, tz = dz - x[2] * r;
    const tl = Math.hypot(tx, ty, tz);
    if (tl < 1e-5) continue;
    const s = popSlope(d / POP_FREQ, age, pxArc) / tl;
    g[0] += s * tx; g[1] += s * ty; g[2] += s * tz;
    act += (1 - d / POP_REACH) * Math.exp((-3 * age) / POP_LIFE_S);
  }
  return { g, act: Math.min(act, 1) };
}
```

- [ ] **Step 4: Run the roil tests**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryRoil.test.js`
Expected: PASS (8 tests).
If "more superheat, more boiling" sees `a = 0`, the sample is too small at dT = 10: raise the sample count to 8000; never loosen the monotonic assertion.

- [ ] **Step 5: Write the failing roil-shader tests**

In `mercuryPlanetShader.test.js`, add the import:

```js
import {
  POP_FREQ, POP_JITTER, POP_REACH, POP_REACH_RAD, POP_SCALE, POP_LIFE_S, POP_TIME, POP_P_MIN, POP_P_MAX,
  POP_DENSITY_K, POP_AMP, POP_SALTS, ROIL_LITE_FREQ, ROIL_LITE_SPEED, ROIL_LITE_AMP,
} from '../mercuryRoil';
```

Add inside the `describe`:

```js
  it('roil: pop constants from mercuryRoil, mirrored functions, motion and mode per variant', () => {
    for (const [name, value] of Object.entries({
      POP_FREQ, POP_JITTER, POP_REACH, POP_REACH_RAD, POP_SCALE, POP_LIFE_S, POP_TIME, POP_P_MIN, POP_P_MAX,
      POP_DENSITY_K, POP_AMP, ROIL_LITE_FREQ, ROIL_LITE_SPEED, ROIL_LITE_AMP,
    })) expect(PLANET_FS).toContain(`const float ${name} = ${glf(value)};`);
    for (const [k, s] of Object.entries(POP_SALTS)) expect(PLANET_FS).toContain(`const vec3 POP_SALT_${k.toUpperCase()} = ${v3(s)};`);
    expect(PLANET_FS).toContain('float popSlope(float th, float age, float pxArc)');
    expect(PLANET_FS).toContain('vec3 roilTilt(vec3 xb, float t, float dT, float pxArc, out float act)');
    expect(PLANET_FS).toContain('const int ROIL_POPS = 1;');
    expect(PLANET_FS).toContain('const float ROIL_MOTION = 1.0;');
    expect(buildPlanetShader({ tier: 'lite' }).fs).toContain('const int ROIL_POPS = 0;');
    expect(buildPlanetShader({ calm: true }).fs).toContain('const float ROIL_MOTION = 0.0;');
    expect(PLANET_FS).toContain('uniform float uRoilGain;');
    expect(PLANET_UNIFORMS).toContain('uRoilGain');
    // coherence loss: active pops scatter more; the 0.14 floor is ROUGH_LIQUID's
    expect(PLANET_FS).toContain('mix(ROUGH_LIQUID, ROUGH_BOIL, boilW * (0.5 + 0.5 * popAct))');
  });

  it('roil runs only in the boil band and never takes a derivative', () => {
    expect(PLANET_FS).toMatch(/if \(boilW > 0\.0\) \{\s*vec3 rt;/);
    const roilFns = PLANET_FS.slice(PLANET_FS.indexOf('float popDensity('), PLANET_FS.indexOf('void main()'));
    expect(roilFns).not.toMatch(/dFd[xy]|fwidth/);
  });
```

- [ ] **Step 6: Run to see it fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`
Expected: FAIL on the two roil tests (constants absent).

- [ ] **Step 7: Add roil to the shader**

In `mercuryPlanetShader.js`:

(a) Add the import:
```js
import {
  POP_FREQ, POP_JITTER, POP_REACH, POP_REACH_RAD, POP_SCALE, POP_LIFE_S, POP_TIME, POP_P_MIN, POP_P_MAX,
  POP_DENSITY_K, POP_AMP, POP_SALTS, ROIL_LITE_FREQ, ROIL_LITE_SPEED, ROIL_LITE_AMP,
} from './mercuryRoil';
```

(b) Append `'uRoilGain'` to the last line of `PLANET_UNIFORMS`, so it reads `'uSurfOn', 'uImpDir', 'uImpMode', 'uImpWave', 'uBulge', 'uRoilGain',`.

(c) Directly above `const AETHER_SHAPE_GLSL = …`, add:
```js
const POP_SALT_GLSL = Object.entries(POP_SALTS).map(([k, s]) => `const vec3 POP_SALT_${k.toUpperCase()} = ${v3(s)};`).join('\n');
```

(d) Replace (calm-aware line from Task 3)
```glsl
uniform vec4 uBulge;${calm ? '\nuniform vec4 uGlow;' : ''}
```
with
```glsl
uniform vec4 uBulge;
uniform float uRoilGain;${calm ? '\nuniform vec4 uGlow;' : ''}
```

(e) Directly after the `const float DIMPLE_NORM = 2.3316;${…}` line, add:
```glsl
const float POP_FREQ = ${glf(POP_FREQ)};
const float POP_JITTER = ${glf(POP_JITTER)};
const float POP_REACH = ${glf(POP_REACH)};
const float POP_REACH_RAD = ${glf(POP_REACH_RAD)};
const float POP_SCALE = ${glf(POP_SCALE)};
const float POP_LIFE_S = ${glf(POP_LIFE_S)};
const float POP_TIME = ${glf(POP_TIME)};
const float POP_P_MIN = ${glf(POP_P_MIN)};
const float POP_P_MAX = ${glf(POP_P_MAX)};
const float POP_DENSITY_K = ${glf(POP_DENSITY_K)};
const float POP_AMP = ${glf(POP_AMP)};
${POP_SALT_GLSL}
const float ROIL_LITE_FREQ = ${glf(ROIL_LITE_FREQ)};
const float ROIL_LITE_SPEED = ${glf(ROIL_LITE_SPEED)};
const float ROIL_LITE_AMP = ${glf(ROIL_LITE_AMP)};
const int ROIL_POPS = ${q.roil === 'pops' ? 1 : 0};
const float ROIL_MOTION = ${calm ? '0.0' : '1.0'};
```

(f) Directly above `void main() {` **in the fragment template** (the second `void main()` in the file; anchor after `vec3 waveTilt(` … its closing `}`), add:
```glsl
// mercuryRoil, exactly (phase-4 spec §6, R1, R2): the boil band as bubble-collapse pops.
float popDensity(float dT) { return dT > 0.0 ? 1.0 - exp(-dT / POP_DENSITY_K) : 0.0; }

float popSlope(float th, float age, float pxArc) {
  if (th >= POP_REACH_RAD || age >= POP_LIFE_S) return 0.0;
  float w = 1.0 - smoothstep(0.7 * POP_REACH_RAD, POP_REACH_RAD, th);
  float life = 1.0 - smoothstep(0.7 * POP_LIFE_S, POP_LIFE_S, age);
  return POP_AMP * w * life * rippleSlope(th * POP_SCALE, max(age * POP_TIME, 1e-3), pxArc * POP_SCALE);
}

// Tangential slope (body frame) of every active pop within reach, plus local activity.
// No derivatives in here (it has continue).
vec3 roilTilt(vec3 xb, float t, float dT, float pxArc, out float act) {
  act = 0.0;
  vec3 g = vec3(0.0);
  float dens = popDensity(dT);
  if (dens <= 0.0) return g;
  vec3 p = xb * POP_FREQ;
  vec3 base = floor(p - 0.5);
  for (int i = 0; i < 8; i++) {
    vec3 c = base + vec3(float(i & 1), float((i >> 1) & 1), float((i >> 2) & 1));
    if (hash13(c + POP_SALT_ACTIVE) >= dens) continue;
    float period = POP_P_MIN + (POP_P_MAX - POP_P_MIN) * hash13(c + POP_SALT_PERIOD);
    float tc = t + hash13(c + POP_SALT_PHASE) * period;
    float age = tc - period * floor(tc / period);
    if (age >= POP_LIFE_S) continue;
    vec3 site = c + 0.5 + (vec3(hash13(c + POP_SALT_X), hash13(c + POP_SALT_Y), hash13(c + POP_SALT_Z)) - 0.5) * (2.0 * POP_JITTER);
    vec3 dv = p - site;
    float d = length(dv);
    if (d >= POP_REACH) continue;
    vec3 tang = dv - xb * dot(dv, xb);
    float tl = length(tang);
    if (tl < 1e-5) continue;
    g += popSlope(d / POP_FREQ, age, pxArc) * tang / tl;
    act += (1.0 - d / POP_REACH) * exp(-3.0 * age / POP_LIFE_S);
  }
  act = min(act, 1.0);
  return g;
}

// lite tier: one octave of animated value noise, tangential.
vec3 roilNoiseTilt(vec3 xb, float t) {
  vec3 p = xb * ROIL_LITE_FREQ + vec3(0.0, t * ROIL_LITE_SPEED, 0.0);
  vec3 g = vec3(vnoise3(p), vnoise3(p + vec3(31.4, 0.0, 0.0)), vnoise3(p + vec3(0.0, 47.2, 0.0))) - 0.5;
  return ROIL_LITE_AMP * (g - xb * dot(g, xb));
}
```

(g) Replace
```glsl
      nW = normalize(nW - fluid * waveTilt(xw, pxArc, warp));
      vec3 R = reflect(rd, nW);
```
with
```glsl
      nW = normalize(nW - fluid * waveTilt(xw, pxArc, warp));
      float popAct = 0.0;
      if (boilW > 0.0) {
        vec3 rt;
        if (ROIL_POPS == 1) rt = roilTilt(xb, uTime * ROIL_MOTION, T - HG_BOIL_K, pxArc, popAct);
        else { rt = roilNoiseTilt(xb, uTime * ROIL_MOTION); popAct = 0.5; }
        nW = normalize(nW - (fluid * boilW * uRoilGain * ROIL_MOTION) * (uBodyRot * rt));
      }
      vec3 R = reflect(rd, nW);
```

(h) Replace
```glsl
        liquid = F * envRadiance(R, mix(ROUGH_LIQUID, ROUGH_BOIL, boilW), hit, nW);
```
with
```glsl
        liquid = F * envRadiance(R, mix(ROUGH_LIQUID, ROUGH_BOIL, boilW * (0.5 + 0.5 * popAct)), hit, nW);
```

- [ ] **Step 8: Update the parity snapshot deliberately, then run the shader tests**

This task changes the full FS by design.
Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js -u`
Then run without `-u`: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`
Expected: PASS.
Then run `git diff --stat src/terminal/mercury/planet/__tests__/__snapshots__/` and confirm that only `planetShader.full.fs.glsl` changed, and that its diff contains only the roil additions (b)–(h).

- [ ] **Step 9: Add the look knob and wire the uniform**

(a) In `src/terminal/mercury/planet/planetLook.js`, add to `PLANET_TUNE` after `waveGain: 1,`:
```js
  roilGain: 1,       // boil-zone bubble-pop slope (mercuryRoil.POP_AMP × this)
```

(b) In `MercuryPlanet.jsx`, add to the material's uniforms after `uRayGain: …,`:
```js
      uRoilGain: { value: PLANET_TUNE.roilGain },
```
and in `useFrame`, after `u.uRayGain.value = PLANET_TUNE.rayGain;`:
```js
    u.uRoilGain.value = PLANET_TUNE.roilGain;
```

- [ ] **Step 10: Run the suite and lint**

Run: `npx vitest run src/terminal/mercury`, then `npm run lint`
Expected: green; 0 errors; warnings ≤ 137.

- [ ] **Step 11: Write the boil probe**

Create `.superpowers/sdd/tools/boilProbe.mjs`:

```js
// Boil zone: heat at the cap, then a contact sheet of the sunlit (left) half over time.
// usage: node .superpowers/sdd/tools/boilProbe.mjs [tag] [query]
import { openMercury, OUT, sleep } from './openMercury.mjs';
const { launch } = await import(new URL('file:///F:/scale_9.4/scripts/cdp.mjs'));
const sharp = (await import('node:module')).createRequire('F:/scale_9.4/package.json')('sharp');
const TAG = process.argv[2] ?? 'boil1';
const QUERY = process.argv[3] ?? '';
const page = await launch({ url: 'about:blank', width: 1600, height: 1000 });
let bad = 0;
try {
  const m = await openMercury(page, QUERY);
  await m.melt(30);
  await sleep(3500); // τ → 1, bead settles
  const files = [];
  for (let k = 0; k < 8; k++) {
    const f = `${OUT}/${TAG}-f${k}.png`;
    await page.screenshot({ path: f, clip: { x: m.cx - 280, y: m.cy - 140, width: 280, height: 280, scale: 1 } });
    files.push(f);
    await sleep(120);
  }
  const W = 280;
  await sharp({ create: { width: W * 4, height: W * 2, channels: 3, background: '#000' } })
    .composite(files.map((input, i) => ({ input, left: (i % 4) * W, top: Math.floor(i / 4) * W })))
    .png().toFile(`${OUT}/${TAG}-sheet.png`);
  console.log('state', JSON.stringify(await m.st()));
  const errs = await m.errors();
  if (errs.length) { bad++; console.log('ERRORS', errs); }
} catch (e) { bad++; console.error('FAIL', e.message); } finally { await page.close(); process.exit(bad ? 1 : 0); }
```

- [ ] **Step 12: Run the boil probe on each tier and look**

Run:
- `node .superpowers/sdd/tools/boilProbe.mjs boil1`
- `node .superpowers/sdd/tools/boilProbe.mjs boil1-lite "?tier=lite"`
- `node .superpowers/sdd/tools/boilProbe.mjs boil1-calm "?calm=1"`

Expected: exit 0, τ ≈ 1, and the sheets show:
- **full:** pock-marked, patchy mirror in the noon zone, the pattern changing frame to frame, with **no grid and no bands**. Further from noon there should be fewer pops.
- **lite:** a soft shimmer.
- **calm:** a static pattern that is identical across frames.

If the pops can't be seen at all, the knob is `__mercuryTune.planet.roilGain` (try 3). Record it as an author-tuning item; don't change `POP_AMP` here.
Then regressions: `refreezeProbe.mjs rf-t4` (unchanged timeline) and `slowStrokeProbe.mjs ss-t4 3` (refreezes under the stroke).

- [ ] **Step 13: Commit**

```bash
git add src/terminal/mercury/planet/mercuryRoil.js src/terminal/mercury/planet/__tests__/mercuryRoil.test.js src/terminal/mercury/planet/mercuryPlanetShader.js src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.full.fs.glsl src/terminal/mercury/planet/planetLook.js src/terminal/mercury/MercuryPlanet.jsx .superpowers/sdd/tools/boilProbe.mjs
git commit -m "feat(mercury): the boil zone pops — miniature capillary trains, seam-free, patchy coherence loss

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Exosphere — sodium tail + Hg vapour haze

**Files:**
- Create: `src/terminal/mercury/planet/mercuryExosphere.js`, `src/terminal/mercury/planet/exosphereShader.js`, `src/terminal/mercury/MercuryExosphere.jsx`, `src/terminal/mercury/planet/__tests__/mercuryExosphere.test.js`, `src/terminal/mercury/planet/__tests__/exosphereShader.test.js`, `.superpowers/sdd/tools/exoProbe.mjs`
- Modify: `src/terminal/mercury/MercuryPlanet.jsx`, `src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js`, `src/terminal/mercury/planet/planetLook.js`, `src/terminal/mercury/mercuryTuning.js`

**Interfaces:**
- Consumes:
  - `mercuryEphemeris(tMs) → { r, rdotKmS, … }`;
  - `HG_BOIL_K`;
  - `SUN_DIR_WORLD`, `R_SCENE`;
  - `TIERS[tier].exoSteps`;
  - `PERF_INFO`.
- Produces:
  - `gNa(vKmS)`, `tailBrightness(tMs)`, `tailLength(B)`, `boilCoverage(tau, heatK, tssK)`, `haloColumn(b, H)`, `tailDensity(P, B, L)`, `exoBox(L) → { s0, s1, width }`;
  - constants (below), `TAIL_AXIS`;
  - `buildExosphereShader({ steps }) → { vs, fs }`, `EXO_UNIFORMS`;
  - `<MercuryExosphere exo tier />`, where `exo` is the mutable `{ B, L, coverage, time, boxDirty }`;
  - `planetEphemerisUniforms(nowMs)` gains `tailB` and `vrKmS`;
  - `DEV_OVERRIDES.dateMs`, `__mercuryTune.dateOverride(ms)`;
  - `PLANET_TUNE.exoGain`.

- [ ] **Step 1: Write the failing exosphere tests**

Create `src/terminal/mercury/planet/__tests__/mercuryExosphere.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  gNa, tailBrightness, tailLength, boilCoverage, haloColumn, tailDensity, exoBox,
  TAIL_B_FLOOR, TAIL_L_MIN, TAIL_L_MAX, TAIL_AXIS, H_NA, HALO_REACH_H, TAIL_REACH_L,
} from '../mercuryExosphere';
import { mercuryEphemeris } from '../mercuryEphemeris';
import { SUN_DIR_WORLD } from '../planetFrame';
import { R_SCENE } from '../planetLook';
import { HG_BOIL_K } from '../mercuryThermal';

const DAY = 86400000;
const T0 = Date.UTC(2026, 0, 1);
const sweep = Array.from({ length: 880 }, (_, i) => T0 + i * 0.1 * DAY);

describe('mercuryExosphere', () => {
  it('gNa: dimmest in the Fraunhofer core (v_r = 0), rising with |v_r|, saturating at 1', () => {
    expect(gNa(0)).toBeLessThan(gNa(2));
    let prev = gNa(0);
    for (let v = 1; v <= 12; v++) { expect(gNa(v)).toBeGreaterThan(prev); prev = gNa(v); }
    expect(gNa(-5)).toBe(gNa(5));
    expect(gNa(30)).toBeCloseTo(1, 6);
  });

  it('tailBrightness: within [floor, 1] over an orbit, peak 1, floor actually reached or above', () => {
    const B = sweep.map(tailBrightness);
    expect(Math.min(...B)).toBeGreaterThanOrEqual(TAIL_B_FLOOR);
    expect(Math.max(...B)).toBeCloseTo(1, 3);
    expect(TAIL_B_FLOOR).toBe(0.15);
  });

  it('R3: dimmer at perihelion (v_r ≈ 0) than at the date of max |v_r|', () => {
    const eph = sweep.map((t) => ({ t, ...mercuryEphemeris(t) }));
    const peri = eph.reduce((a, b) => (b.r < a.r ? b : a));
    const fast = eph.reduce((a, b) => (Math.abs(b.rdotKmS) > Math.abs(a.rdotKmS) ? b : a));
    expect(tailBrightness(peri.t)).toBeLessThan(tailBrightness(fast.t));
  });

  it('tailLength grows with B between its bounds', () => {
    expect(tailLength(0)).toBeCloseTo(TAIL_L_MIN, 12);
    expect(tailLength(1)).toBeCloseTo(TAIL_L_MAX, 12);
    expect(tailLength(0.6)).toBeGreaterThan(tailLength(0.3));
  });

  it('TAIL_AXIS is anti-sunward in the world frame', () => {
    for (let k = 0; k < 3; k++) expect(TAIL_AXIS[k]).toBeCloseTo(-SUN_DIR_WORLD[k], 12);
  });

  it('boilCoverage: 0 when crust or too cool; grows with heat; never above a hemisphere', () => {
    expect(boilCoverage(0, 80, 700)).toBe(0);
    expect(boilCoverage(1, 0, 570)).toBe(0);                // aphelion noon 570 K < 630 K
    const lo = boilCoverage(1, 0, 700), hi = boilCoverage(1, 60, 700);
    expect(lo).toBeGreaterThan(0);
    expect(hi).toBeGreaterThan(lo);
    expect(boilCoverage(1, HG_BOIL_K + 1, 700)).toBe(0.5);
    expect(boilCoverage(0.5, 60, 700)).toBeCloseTo(hi / 2, 12);
  });

  it('haloColumn: zero over the disc, decaying outside the limb', () => {
    expect(haloColumn(0.5 * R_SCENE, H_NA)).toBe(0);
    expect(haloColumn(R_SCENE, H_NA)).toBe(0);
    const a = haloColumn(R_SCENE * 1.01, H_NA), b = haloColumn(R_SCENE * 1.2, H_NA);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(0);
  });

  it('tailDensity: zero inside the planet and sunward of it; falls downstream and off-axis', () => {
    const a = TAIL_AXIS, L = tailLength(1);
    const at = (s, off = 0) => [a[0] * s, a[1] * s + off, a[2] * s];
    expect(tailDensity(at(0.5 * R_SCENE), 1, L)).toBe(0);
    expect(tailDensity(at(-2 * R_SCENE), 1, L)).toBe(0);
    expect(tailDensity(at(2 * R_SCENE), 1, L)).toBeGreaterThan(tailDensity(at(4 * R_SCENE), 1, L));
    expect(tailDensity(at(2 * R_SCENE), 1, L)).toBeGreaterThan(tailDensity(at(2 * R_SCENE, 0.5), 1, L));
    expect(tailDensity(at(2 * R_SCENE), 0.5, L)).toBeCloseTo(0.5 * tailDensity(at(2 * R_SCENE), 1, L), 12);
  });

  it('exoBox encloses the halo and the tail out to TAIL_REACH_L lengths', () => {
    for (const B of [0, 0.5, 1]) {
      const L = tailLength(B);
      const { s0, s1, width } = exoBox(L);
      const halo = R_SCENE + HALO_REACH_H * H_NA;
      expect(s0).toBeLessThanOrEqual(-halo);
      expect(s1).toBeGreaterThanOrEqual(TAIL_REACH_L * L);
      expect(width / 2).toBeGreaterThanOrEqual(halo);
    }
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryExosphere.test.js`
Expected: FAIL, "Failed to resolve import ../mercuryExosphere".

- [ ] **Step 3: Write `mercuryExosphere.js`**

Create `src/terminal/mercury/planet/mercuryExosphere.js`:

```js
// src/terminal/mercury/planet/mercuryExosphere.js — the Sun's signature: Mercury's sodium
// tail and, while the bead boils, a faint Hg vapour haze at the limb (phase-4 spec §7).
//
// PRECISION BOUNDARY, stated so no reader assumes more:
// - The Na tail is pushed by radiation pressure (resonant scattering of the Na D lines),
//   so its brightness ∝ g(|v_r|)/r². g is a FITTED SHAPE of the solar Fraunhofer line core
//   (dimmest at v_r = 0, saturating by |v_r| ≈ 8–10 km/s), a stated convention (D9), NOT
//   the Killen et al. tabulated g-factors.
// - B is normalised to the orbit's peak and floored at TAIL_B_FLOOR (D6), so the tab
//   always carries a trace of the tail. Its length scales with B: a weak tail is short.
// - Hg vapour coverage is analytic: the boiling cap where T_ss·cos^¼θ + heat > T_boil
//   (mercuryThermal's day law, the 1-atm convention). It drives the colourless limb haze.
// - Scene units throughout (R_SCENE = the planet). exosphereShader.js mirrors haloColumn
//   and tailDensity (constants via glf).

import { mercuryEphemeris } from './mercuryEphemeris';
import { HG_BOIL_K } from './mercuryThermal';
import { SUN_DIR_WORLD } from './planetFrame';
import { R_SCENE } from './planetLook';

export const NA_G_V0_KMS = 5;            // Doppler half-width of the fitted line core
export const NA_G_MIN = 0.2;             // relative g at v_r = 0
export const TAIL_B_FLOOR = 0.15;
export const TAIL_L_MIN = 1.5 * R_SCENE; // e-fold length of the tail at B = 0…
export const TAIL_L_MAX = 6 * R_SCENE;   // …and at B = 1
export const TAIL_REACH_L = 3;           // the box runs the tail out to 3 e-folds
export const TAIL_W0 = 0.5 * R_SCENE;    // Gaussian half-width at the root…
export const TAIL_SPREAD = 0.2;          // …widening downstream (per unit s)
export const TAIL_WIDTH_SIGMA = 3;       // the box holds ±3σ of the cross-section
export const H_NA = 0.12 * R_SCENE;      // Na halo scale height
export const H_HG = 0.05 * R_SCENE;      // Hg vapour scale height (thinner, heavier)
export const HALO_REACH_H = 6;           // the box holds the halo out to 6 scale heights
export const NA_COL = [1.0, 0.55, 0.12]; // linear, 589 nm
export const HG_COL = [0.75, 0.8, 0.9];  // linear, colourless-cool
export const NA_HALO_GAIN = 0.05;        // radiance per unit column (× PLANET_TUNE.exoGain)
export const NA_TAIL_GAIN = 0.04;
export const HG_GAIN = 0.03;
export const STREAM_AMP = 0.35;          // streamer noise depth along the tail
export const STREAM_FREQ_S = 1.5;        // along the axis, per scene unit
export const STREAM_FREQ_P = 3;          // across it
export const STREAM_SPEED = 0.06;        // scene units / s, downstream (frozen under CALM)
export const TAIL_AXIS = Object.freeze(SUN_DIR_WORLD.map((c) => -c));

const DAY_MS = 86400000;

export function gNa(vKmS) {
  const x = vKmS / NA_G_V0_KMS;
  return NA_G_MIN + (1 - NA_G_MIN) * (1 - Math.exp(-x * x));
}

function rawB(tMs) {
  const e = mercuryEphemeris(tMs);
  return gNa(Math.abs(e.rdotKmS)) / (e.r * e.r);
}

// The orbit's peak, sampled once over one orbit (the elements drift negligibly per century).
const B_MAX = (() => {
  let m = 0;
  const t0 = Date.UTC(2026, 0, 1);
  for (let i = 0; i < 880; i++) m = Math.max(m, rawB(t0 + i * 0.1 * DAY_MS));
  return m;
})();

export function tailBrightness(tMs) {
  return Math.min(1, Math.max(TAIL_B_FLOOR, rawB(tMs) / B_MAX));
}

export function tailLength(B) {
  return TAIL_L_MIN + (TAIL_L_MAX - TAIL_L_MIN) * B;
}

export function boilCoverage(tau, heatK, tssK) {
  if (!(tau > 0) || !(tssK > 0)) return 0;
  const ratio = (HG_BOIL_K - heatK) / tssK;
  if (ratio >= 1) return 0;
  const cosB = ratio <= 0 ? 0 : ratio ** 4;
  return (tau * (1 - cosB)) / 2;
}

// Line-of-sight column through exp(−(r−R)/H), impact parameter b (Chapman's grazing
// approximation). Over the disc the planet is opaque and the box is depth-rejected: 0.
export function haloColumn(b, H) {
  if (b <= R_SCENE) return 0;
  return Math.exp(-(b - R_SCENE) / H) * Math.sqrt(2 * Math.PI * b * H);
}

// Tail number density at world point P (no streamer noise; the shader adds it).
export function tailDensity(P, B, L) {
  const s = P[0] * TAIL_AXIS[0] + P[1] * TAIL_AXIS[1] + P[2] * TAIL_AXIS[2];
  const r2 = P[0] * P[0] + P[1] * P[1] + P[2] * P[2];
  if (s <= 0 || r2 <= R_SCENE * R_SCENE) return 0;
  const rho2 = r2 - s * s;
  const w = TAIL_W0 + TAIL_SPREAD * s;
  return B * Math.exp(-s / L) * Math.exp(-rho2 / (2 * w * w));
}

// The box around halo + tail, along TAIL_AXIS: from s0 to s1, square cross-section width.
export function exoBox(L) {
  const halo = R_SCENE + HALO_REACH_H * H_NA;
  const s0 = -halo;
  const s1 = Math.max(TAIL_REACH_L * L, halo);
  const width = 2 * Math.max(halo, TAIL_WIDTH_SIGMA * (TAIL_W0 + TAIL_SPREAD * s1));
  return { s0, s1, width };
}
```

- [ ] **Step 4: Run the exosphere tests**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryExosphere.test.js`
Expected: PASS (9 tests).

- [ ] **Step 5: Write the failing exosphere-shader tests**

Create `src/terminal/mercury/planet/__tests__/exosphereShader.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildExosphereShader, EXO_UNIFORMS, EXO_BUILTINS } from '../exosphereShader';
import { glf, v3 } from '../../../gl/glf';
import { R_SCENE } from '../planetLook';
import * as X from '../mercuryExosphere';
import { TIERS } from '../planetQuality';

const declared = (src) => [...src.matchAll(/^uniform\s+\w+\s+(\w+)(?:\[\d+\])?;/gm)].map((m) => m[1]);

describe('exosphereShader', () => {
  it('raw GLSL 3, exactly its uniforms', () => {
    const { vs, fs } = buildExosphereShader({ steps: 16 });
    for (const s of [vs, fs]) { expect(s).not.toMatch(/#version|#include/); }
    const names = declared(fs).filter((u) => !EXO_BUILTINS.includes(u));
    expect([...names].sort()).toEqual([...EXO_UNIFORMS].sort());
  });

  it('interpolates every constant from mercuryExosphere', () => {
    const { fs } = buildExosphereShader({ steps: 16 });
    for (const name of ['TAIL_W0', 'TAIL_SPREAD', 'H_NA', 'H_HG', 'NA_HALO_GAIN', 'NA_TAIL_GAIN', 'HG_GAIN',
      'STREAM_AMP', 'STREAM_FREQ_S', 'STREAM_FREQ_P', 'STREAM_SPEED']) {
      expect(fs).toContain(`const float ${name} = ${glf(X[name])};`);
    }
    expect(fs).toContain(`const float R_SCENE = ${glf(R_SCENE)};`);
    expect(fs).toContain(`const vec3 NA_COL = ${v3(X.NA_COL)};`);
    expect(fs).toContain(`const vec3 HG_COL = ${v3(X.HG_COL)};`);
  });

  it('march steps per tier; lite keeps only the closed-form halo', () => {
    for (const t of Object.values(TIERS)) expect(buildExosphereShader({ steps: t.exoSteps }).fs).toContain(`const int EXO_STEPS = ${t.exoSteps};`);
  });

  it('mirrors haloColumn and tailDensity, dithers its output', () => {
    const { fs } = buildExosphereShader({ steps: 8 });
    expect(fs).toContain('float haloColumn(float b, float H)');
    expect(fs).toContain('float tailDensity(vec3 P)');
    expect(fs).toMatch(/\/ 255\.0/);
  });
});
```

- [ ] **Step 6: Run to see it fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/exosphereShader.test.js`
Expected: FAIL, "Failed to resolve import ../exosphereShader".

- [ ] **Step 7: Write `exosphereShader.js`**

Create `src/terminal/mercury/planet/exosphereShader.js`:

```js
// src/terminal/mercury/planet/exosphereShader.js — the exosphere box (phase-4 spec §7).
// Back faces of a box around halo + tail; the fragment clips its view ray to the box,
// adds the closed-form halo columns (Na + Hg vapour), and marches the Na tail with
// EXO_STEPS jittered samples. Additive, depth-tested against the planet (which writes
// gl_FragDepth), never writes depth. Constants from mercuryExosphere (glf).

import { glf, v3 } from '../../gl/glf';
import { R_SCENE } from './planetLook';
import {
  TAIL_W0, TAIL_SPREAD, H_NA, H_HG, NA_HALO_GAIN, NA_TAIL_GAIN, HG_GAIN, NA_COL, HG_COL,
  STREAM_AMP, STREAM_FREQ_S, STREAM_FREQ_P, STREAM_SPEED,
} from './mercuryExosphere';

export const EXO_BUILTINS = ['modelMatrix', 'viewMatrix', 'projectionMatrix', 'cameraPosition'];
export const EXO_UNIFORMS = ['uWorldToBox', 'uTailAxis', 'uTailB', 'uTailL', 'uCoverage', 'uExoTime', 'uExoGain'];

const EXO_VS = /* glsl */ `in vec3 position;

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;

out vec3 vWorld;

void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const exoFs = (steps) => /* glsl */ `precision highp float;

in vec3 vWorld;
layout(location = 0) out vec4 fragColor;

uniform vec3 cameraPosition;
uniform mat4 uWorldToBox;
uniform vec3 uTailAxis;
uniform float uTailB;
uniform float uTailL;
uniform float uCoverage;
uniform float uExoTime;
uniform float uExoGain;

const float TAU = 6.28318530717959;
const float R_SCENE = ${glf(R_SCENE)};
const float TAIL_W0 = ${glf(TAIL_W0)};
const float TAIL_SPREAD = ${glf(TAIL_SPREAD)};
const float H_NA = ${glf(H_NA)};
const float H_HG = ${glf(H_HG)};
const float NA_HALO_GAIN = ${glf(NA_HALO_GAIN)};
const float NA_TAIL_GAIN = ${glf(NA_TAIL_GAIN)};
const float HG_GAIN = ${glf(HG_GAIN)};
const vec3 NA_COL = ${v3(NA_COL)};
const vec3 HG_COL = ${v3(HG_COL)};
const float STREAM_AMP = ${glf(STREAM_AMP)};
const float STREAM_FREQ_S = ${glf(STREAM_FREQ_S)};
const float STREAM_FREQ_P = ${glf(STREAM_FREQ_P)};
const float STREAM_SPEED = ${glf(STREAM_SPEED)};
const int EXO_STEPS = ${steps};

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

float vnoise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), u.x),
        mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),
    mix(mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), u.x),
        mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), u.x), u.y), u.z);
}

// mercuryExosphere.haloColumn, exactly.
float haloColumn(float b, float H) {
  if (b <= R_SCENE) return 0.0;
  return exp(-(b - R_SCENE) / H) * sqrt(TAU * b * H);
}

// mercuryExosphere.tailDensity, plus a streamer noise drifting downstream.
float tailDensity(vec3 P) {
  float s = dot(P, uTailAxis);
  float r2 = dot(P, P);
  if (s <= 0.0 || r2 <= R_SCENE * R_SCENE) return 0.0;
  vec3 perp = P - uTailAxis * s;
  float w = TAIL_W0 + TAIL_SPREAD * s;
  float n = uTailB * exp(-s / uTailL) * exp(-dot(perp, perp) / (2.0 * w * w));
  float st = vnoise3(vec3((s - uExoTime * STREAM_SPEED) * STREAM_FREQ_S, 0.0, 0.0) + perp * STREAM_FREQ_P);
  return n * (1.0 + STREAM_AMP * (2.0 * st - 1.0));
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorld - ro);

  // Halo columns: closed form along the whole line of sight (one back face per pixel).
  float bq = dot(ro, rd);
  float b = length(ro - rd * bq);
  vec3 col = (NA_HALO_GAIN * uTailB * haloColumn(b, H_NA)) * NA_COL
           + (HG_GAIN * uCoverage * haloColumn(b, H_HG)) * HG_COL;

  if (EXO_STEPS > 0) {
    vec3 o = (uWorldToBox * vec4(ro, 1.0)).xyz;
    vec3 d = (uWorldToBox * vec4(rd, 0.0)).xyz;
    vec3 inv = 1.0 / (d + vec3(1e-9) * (step(vec3(0.0), d) * 2.0 - 1.0));
    vec3 t0 = (vec3(-0.5) - o) * inv;
    vec3 t1 = (vec3(0.5) - o) * inv;
    vec3 tmin = min(t0, t1), tmax = max(t0, t1);
    float tN = max(max(max(tmin.x, tmin.y), tmin.z), 0.0);
    float tF = min(min(tmax.x, tmax.y), tmax.z);
    float disc = bq * bq - (dot(ro, ro) - R_SCENE * R_SCENE);
    if (disc > 0.0) { float tS = -bq - sqrt(disc); if (tS > 0.0) tF = min(tF, tS); }
    if (tF > tN) {
      float dt = (tF - tN) / float(EXO_STEPS);
      float j = hash13(vec3(gl_FragCoord.xy, fract(uExoTime) * 61.0));
      float acc = 0.0;
      for (int i = 0; i < EXO_STEPS; i++) acc += tailDensity(ro + rd * (tN + (float(i) + j) * dt));
      col += (NA_TAIL_GAIN * acc * dt) * NA_COL;
    }
  }

  col = max(col * uExoGain, 0.0);
  vec3 srgb = mix(col * 12.92, 1.055 * pow(col, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), col));
  float dith = (fract(sin(dot(gl_FragCoord.xy + fract(uExoTime) * 61.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  fragColor = vec4(srgb + dith, 1.0);
}
`;

export function buildExosphereShader({ steps }) {
  return { vs: EXO_VS, fs: exoFs(steps) };
}
```

- [ ] **Step 8: Run the exosphere-shader tests**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/exosphereShader.test.js`
Expected: PASS (4 tests).

- [ ] **Step 9: Write the failing ephemeris-uniform test**

Add to `src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js`, inside its `describe` (add `import { tailBrightness } from '../planet/mercuryExosphere';` at the top):

```js
  it('carries the tail brightness and radial velocity for the exosphere', () => {
    const t = Date.UTC(2026, 9, 1, 12);
    const u = planetEphemerisUniforms(t);
    expect(u.tailB).toBe(tailBrightness(t));
    expect(u.vrKmS).toBe(mercuryEphemeris(t).rdotKmS);
  });
```

(`mercuryEphemeris` is already imported in that file; if it isn't, add `import { mercuryEphemeris } from '../planet/mercuryEphemeris';`.)

- [ ] **Step 10: Run to see it fail**

Run: `npx vitest run src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js`
Expected: FAIL; `u.tailB` is undefined.

- [ ] **Step 11: Extend `planetEphemerisUniforms`, add the dev date override and the look knob**

(a) In `MercuryPlanet.jsx`, add `import { tailBrightness, tailLength, boilCoverage } from './planet/mercuryExosphere';` and extend the `planetEphemerisUniforms` return object with:
```js
    tailB: tailBrightness(nowMs),
    vrKmS: eph.rdotKmS,
```

(b) In `src/terminal/mercury/mercuryTuning.js`, below the `TUNE` object, add:
```js
// Dev-only overrides the frame loop reads (probes): a fixed instant for the ephemeris.
export const DEV_OVERRIDES = { dateMs: null };
```
and inside `window.__mercuryTune = { … }` add:
```js
    // Pin the ephemeris to an instant (ms since epoch), or null for now. Probes sweep the tail with it.
    dateOverride(ms) { DEV_OVERRIDES.dateMs = ms ?? null; return `date = ${ms == null ? 'now' : new Date(ms).toISOString()}`; },
```

(c) In `planetLook.js`, add to `PLANET_TUNE` after `roilGain: 1,`:
```js
  exoGain: 1,        // sodium tail + Hg vapour haze brightness
```

- [ ] **Step 12: Run the uniform test**

Run: `npx vitest run src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js`
Expected: PASS.

- [ ] **Step 13: Write `MercuryExosphere.jsx`**

Create `src/terminal/mercury/MercuryExosphere.jsx`:

```jsx
// MercuryExosphere.jsx — the sodium tail + Hg vapour haze box (phase-4 spec §7).
// MercuryPlanet owns the state (`exo`, a mutable object it writes every frame); this
// component only fits the box on change and writes uniforms. Additive, depth-tested,
// never writes depth. No allocation per frame.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildExosphereShader } from './planet/exosphereShader';
import { TAIL_AXIS, exoBox } from './planet/mercuryExosphere';
import { TIERS } from './planet/planetQuality';
import { PLANET_TUNE } from './planet/planetLook';

export default function MercuryExosphere({ exo, tier = 'full' }) {
  const steps = TIERS[tier].exoSteps;
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const shader = useMemo(() => buildExosphereShader({ steps }), [steps]);
  const material = useMemo(() => new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: shader.vs,
    fragmentShader: shader.fs,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    uniforms: {
      uWorldToBox: { value: new THREE.Matrix4() },
      uTailAxis: { value: new THREE.Vector3(...TAIL_AXIS) },
      uTailB: { value: exo.B },
      uTailL: { value: exo.L },
      uCoverage: { value: 0 },
      uExoTime: { value: 0 },
      uExoGain: { value: PLANET_TUNE.exoGain },
    },
  }), [shader, exo]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  const mesh = useRef(null);
  const fit = useMemo(() => {
    const a = new THREE.Vector3(...TAIL_AXIS);
    const u = new THREE.Vector3(0, 1, 0).cross(a).normalize();
    const v = new THREE.Vector3().crossVectors(a, u);
    return { a, u, v, m: new THREE.Matrix4(), scale: new THREE.Vector3(), pos: new THREE.Vector3() };
  }, []);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const un = material.uniforms;
    if (exo.boxDirty) {
      const { s0, s1, width } = exoBox(exo.L);
      fit.m.makeBasis(fit.a, fit.u, fit.v);
      fit.m.scale(fit.scale.set(s1 - s0, width, width));
      fit.m.setPosition(fit.pos.copy(fit.a).multiplyScalar((s0 + s1) / 2));
      m.matrix.copy(fit.m);
      m.matrixWorldNeedsUpdate = true;
      un.uWorldToBox.value.copy(fit.m).invert();
      exo.boxDirty = false;
    }
    un.uTailB.value = exo.B;
    un.uTailL.value = exo.L;
    un.uCoverage.value = exo.coverage;
    un.uExoTime.value = exo.time;
    un.uExoGain.value = PLANET_TUNE.exoGain;
  });

  return <mesh ref={mesh} geometry={geometry} material={material} matrixAutoUpdate={false} frustumCulled={false} />;
}
```

- [ ] **Step 14: Drive the exosphere from `MercuryPlanet.jsx`**

(a) Add `import MercuryExosphere from './MercuryExosphere';` and extend the `mercuryTuning` import to `import { registerTuningRig, DEV_OVERRIDES } from './mercuryTuning';`.

(b) Below `const body = useMemo(() => createBody(target), [target]);`, add:
```js
  // The exosphere's state (MercuryExosphere reads it every frame; written here, allocation-free).
  const exo = useMemo(() => ({ B: init.tailB, L: tailLength(init.tailB), coverage: 0, time: 0, boxDirty: true }), [init]);
```

(c) In the ephemeris tick, replace
```js
      const e = planetEphemerisUniforms(Date.now());
```
with
```js
      const e = planetEphemerisUniforms(DEV_OVERRIDES.dateMs ?? Date.now());
```
and after `u.uSubsolarT.value = e.subsolarT;` add:
```js
      exo.B = e.tailB;
      const L = tailLength(e.tailB);
      if (Math.abs(L - exo.L) > 1e-4) { exo.L = L; exo.boxDirty = true; }
      PERF_INFO.tailB = e.tailB;
      PERF_INFO.vrKmS = e.vrKmS;
```

(d) After `PERF_INFO.heatK = body.heatK;`, add:
```js
    exo.coverage = boilCoverage(body.tau, body.heatK, u.uSubsolarT.value);
    if (!calm) exo.time += stepS; // the streamers hold still under reduced motion
    PERF_INFO.coverage = exo.coverage;
```

(e) Replace the component's return
```jsx
  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
```
with
```jsx
  return (
    <>
      <mesh geometry={geometry} material={material} frustumCulled={false} />
      <MercuryExosphere exo={exo} tier={tier} />
    </>
  );
```

- [ ] **Step 15: Run the suite and lint**

Run: `npx vitest run src/terminal/mercury`, then `npm run lint`
Expected: green; 0 errors; warnings ≤ 137.

- [ ] **Step 16: Write the exosphere probe**

Create `.superpowers/sdd/tools/exoProbe.mjs`:

```js
// The tail across one orbit: pin the ephemeris to 8 instants, screenshot the whole canvas,
// print B and v_r. Then melt at a hot instant and check the Hg haze appears with boiling.
// usage: node .superpowers/sdd/tools/exoProbe.mjs [tag] [query]
import { openMercury, OUT, sleep } from './openMercury.mjs';
const { launch } = await import(new URL('file:///F:/scale_9.4/scripts/cdp.mjs'));
const TAG = process.argv[2] ?? 'exo1';
const QUERY = process.argv[3] ?? '?perf=1';
const DAY = 86400000, T0 = Date.UTC(2026, 9, 1);
const page = await launch({ url: 'about:blank', width: 1600, height: 1000 });
let bad = 0;
try {
  const m = await openMercury(page, QUERY);
  const wide = (name) => page.screenshot({ path: `${OUT}/${TAG}-${name}.png`, clip: { x: m.cx - 500, y: m.cy - 300, width: 1000, height: 600, scale: 1 } });
  const Bs = [];
  for (let k = 0; k < 8; k++) {
    const t = T0 + k * 11 * DAY;
    await page.eval(`window.__mercuryTune.dateOverride(${t}); 1`);
    await sleep(2500); // ephemeris tick (1 s) + the recapture settling the new orientation
    const s = await m.st();
    Bs.push(s.perf.tailB);
    console.log(new Date(t).toISOString().slice(0, 10), 'B', s.perf.tailB.toFixed(3), 'v_r', s.perf.vrKmS.toFixed(2));
    await wide(`d${k}`);
  }
  if (Math.max(...Bs) - Math.min(...Bs) < 0.1) { bad++; console.log('FAIL: tail brightness does not swing over the orbit'); }
  await m.melt(30);
  await sleep(2000);
  const s = await m.st();
  console.log('boiling coverage', s.perf.coverage.toFixed(3));
  await wide('boiling');
  const errs = await m.errors();
  if (errs.length) { bad++; console.log('ERRORS', errs); }
} catch (e) { bad++; console.error('FAIL', e.message); } finally { await page.close(); process.exit(bad ? 1 : 0); }
```

- [ ] **Step 17: Run the exosphere probe on each tier and look**

Run:
- `node .superpowers/sdd/tools/exoProbe.mjs exo1`
- `node .superpowers/sdd/tools/exoProbe.mjs exo1-lite "?perf=1&tier=lite"`

Expected:
- exit 0;
- B swings by ≥ 0.1 across the 8 dates and never drops below 0.15;
- `exo1-d*.png` show a faint orange glow leaving the **right-rear** limb, foreshortened away from the camera, longer and brighter on high-B dates;
- a thin warm rim at the limb;
- **no bands** in the glow's fall-off;
- `exo1-boiling.png` shows coverage > 0 when the subsolar T is high enough. Coverage 0 can be correct near aphelion, so check the logged value against `boilCoverage`, not the picture alone;
- lite: rim only, no tail.

If the tail is invisible or blown out, record the `__mercuryTune.planet.exoGain` value that reads right (try 0.3–4) for the author's tuning pass. Do not change the module gains in this task.

- [ ] **Step 18: Commit**

```bash
git add src/terminal/mercury/planet/mercuryExosphere.js src/terminal/mercury/planet/exosphereShader.js src/terminal/mercury/MercuryExosphere.jsx src/terminal/mercury/planet/__tests__/mercuryExosphere.test.js src/terminal/mercury/planet/__tests__/exosphereShader.test.js src/terminal/mercury/MercuryPlanet.jsx src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js src/terminal/mercury/planet/planetLook.js src/terminal/mercury/mercuryTuning.js .superpowers/sdd/tools/exoProbe.mjs
git commit -m "feat(mercury): the Sun's signature — sodium tail from the true radial velocity, Hg haze while boiling

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Checkpoint 2 — the phone with roil and tail on (author gate)

**Files:**
- Modify: `src/terminal/mercury/planet/planetQuality.js` (the `phone` row only, if needed)

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: a `phone` tier that holds 60 fps with everything on.

- [ ] **Step 1: Re-run the Task 2 protocol**

Same LAN dev server, same five screenshots (still / liquid / hard spin, then `tier=lite`). Add one more: **boiling at noon**. Melt, keep flicking for 10 s so heat sits at the cap, then screenshot.

- [ ] **Step 2: Cut along tier axes only**

Rule: liquid and boiling p95 ≤ 16.7 ms on `phone`. If it misses, step down in this order, re-measuring after each:
1. `exoSteps` 8 → 4 → 0;
2. `shadowSteps`;
3. `rippleSlots`;
4. `roil` `'pops'` → `'noise'`;
5. `dprMax`.

Never change `full`, the module constants, or the look. Update the measured-numbers comment on the `phone` row.

- [ ] **Step 3: Test and commit (only if the row changed)**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/planetQuality.test.js`
Expected: PASS.

```bash
git add src/terminal/mercury/planet/planetQuality.js
git commit -m "perf(mercury): phone tier re-measured with roil and the exosphere on (checkpoint 2)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The author's tuning pass + handover

**Files:**
- Modify: `src/terminal/mercury/planet/planetLook.js` (`PLANET_TUNE` values the author settles), `.superpowers/sdd/HANDOVER-mercury-body.md`
- Possibly modify: `src/terminal/mercury/planet/mercuryRoil.js` (`POP_FREQ`, `POP_LIFE_S`), `src/terminal/mercury/planet/mercuryExosphere.js` (`TAIL_B_FLOOR`), and only on the author's explicit word.

**Interfaces:**
- Consumes: everything above.
- Produces: committed look values and an updated handover.

- [ ] **Step 1: Give the author the live knobs (in chat)**

In the dev console on the Mercury tab:

```js
__mercuryTune.planet.roilGain = 1      // pop strength
__mercuryTune.planet.exoGain = 1       // tail + haze brightness
__mercuryTune.planet.modeGain = 1      // carried from phase 3: body wobble
__mercuryTune.dateOverride(Date.UTC(2026, 9, 12))  // see the tail on another date; null for now
__mercuryTune.export()                 // hand the block back
```

Open items carried from phase 3, raised in the same message:
- the drag dimple reads as a lens (weaken it for `wake` only?);
- `modeGain`;
- crater subtlety (`rayGain`).

- [ ] **Step 2: Commit the values they hand back**

Copy the exported `PLANET_TUNE` values into `planetLook.js`. If they ask for a different pop spacing or life, or a different tail floor, change `POP_FREQ` / `POP_LIFE_S` / `TAIL_B_FLOOR`. The derived constants (`POP_REACH_RAD`, `POP_SCALE`, `POP_TIME`) follow automatically. Then run `npx vitest run src/terminal/mercury`. A change to the roil module also changes the full FS, so update the snapshot with `-u` and check its diff touches only those constants. Then run `npm run lint`.

```bash
git add src/terminal/mercury/planet/planetLook.js
git commit -m "tune(mercury): phase-4 look values from the author's pass

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Add `mercuryRoil.js`, `mercuryExosphere.js` and the snapshot to the `git add` only if they changed.)

- [ ] **Step 3: Update the handover**

At the top of `.superpowers/sdd/HANDOVER-mercury-body.md`'s RESUME HERE, record:
- the phase-4 commits and branch state (not pushed);
- the measured `phone` numbers;
- the probe tags (`tier1`, `calm1`, `boil1*`, `exo1*`);
- any tuning items left open.

Commit:

```bash
git add .superpowers/sdd/HANDOVER-mercury-body.md
git commit -m "docs(mercury): phase 4 handover

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Self-review (done while writing)

**Spec coverage:**

| Spec | Task |
|---|---|
| §3 tiers and parity | 1 |
| §4 HUD | 1 |
| Checkpoint 1 | 2 |
| §5 CALM: body, shader, aether (D5), strikes, exosphere frozen | 3; exosphere time in 5 |
| §6 roil, plus R1/R2 | 4 |
| §7 exosphere, plus R3 | 5 |
| §8 checkpoint 2 | 6 |
| Tuning | 7 |
| §9 probes and regressions | inside 1, 3, 4, 5 |

**Names checked across tasks:** `buildPlanetShader({ tier, calm })`, `planetFs(q, calm)`, `TIERS[..].exoSteps`, `PERF_INFO.{tau, heatK, coverage, tailB, vrKmS}`, `exo.{B, L, coverage, time, boxDirty}`, `DEV_OVERRIDES.dateMs`, `stepS` (from the refreeze fix, `MercuryPlanet.jsx:213`), `surf.aetherT`, `calmGlow`.

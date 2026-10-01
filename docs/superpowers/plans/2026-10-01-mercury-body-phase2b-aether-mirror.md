# Mercury Body Phase 2b — Aether Mirror Implementation Plan

> Note: Task 2/3 describe 8 cube-corner lobes; the author's look rounds replaced them with 16 flow streaks — see the spec's Amendment 2.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The transmuted liquid stops reading as black glass. It reflects the aether that wraps the planet, the four elements wash broad tints across it, the boiling Sun becomes a bright sheen that tightens to a pinpoint as it cools, the night side is a cold low-luminance silver/indigo, and the liquid refreezes about 40 s after a spin.

**Why (live look, 2026-10-01):** after a hard spin the whole disc was a black mirror. Three causes:
1. The mirror could reflect only the Sun, four point-like emitters and black space. A mirror ball mostly shows what is *in front of it*, so the disc centre reflected empty space behind the camera.
2. The Sun lobe already conserves energy. At ROUGH_BOIL 0.4 the Sun's 0.7° disc spreads ~180× wider, so its peak falls from ~72 (clipped white) to ~0.1 (grey smudge). The Sun gain was tuned only to make the sharp pinpoint clip, so there was no headroom left.
3. A hard spin saturated the heat store at ~290 K. Heat adds to the surface temperature everywhere, so even the 100 K night floor exceeded the 234 K melt point. The whole globe went liquid, and it lingered ~70 s.

**Architecture:** these are all analytic additions to the existing raw-GLSL planet shader. A new tested JS module, `aetherLobes.js`, owns 8 soft lobes at the cube-corner directions. They drift slowly about the vertical, and their colours come from the four flow palettes weighted by live element opacity. A second new module, `mirrorLobes.js`, is a JS twin of the shader's `lobe()` plus a `softShoulder()` roll-off, so the Sun targets can be tested numerically. A heat cap in `mercuryBody.js` bounds the linger.

**Tech Stack:** three.js RawShaderMaterial (GLSL3), @react-three/fiber, vitest.

## Global Constraints

- Raw GLSL only: `RawShaderMaterial` with `glslVersion: THREE.GLSL3`. No `onBeforeCompile`, no `#include`, no three shader chunks. Shader strings must NOT contain `#version`.
- Every physical constant lives in a tested JS module and reaches the shader via `glf()` / `v3()`. Look constants the author tunes are uniforms fed from `PLANET_TUNE`, never baked.
- Per-frame values are written to uniforms inside `useFrame`, never through React state.
- Time-based, never frame-counted. The body integrator must give the same trajectory at 60 Hz and 360 Hz (parity test).
- Never `pow()` a possibly-negative base. Never name a variable `half`.
- No red incandescence, no bloom. **No cubemap, no PMREM.** The mirror reflects: the Sun disc, the four element emitters, and the aether as `AETHER_LOBES = 8` analytic soft lobes wrapping the planet on every side, camera side included (author decision 2026-10-01, supersedes "only the Sun, four emitters, black space").
- **Night side** (author decision 2026-10-01, supersedes "stays near-black"): a cold, deep, low-luminance silver/indigo. The aether is attenuated to `AETHER_NIGHT` with `NIGHT_TINT`, keyed on the *surface normal's* Sun-facing (`dot(nW, uSunDir)`), never on the reflection direction. It stays clearly darker than the day side and is never black glass.
- Liquid roughness is never below 0.14.
- Liquid refreezes ~40 s after release, even after a hard spin (`HEAT_CAP_K`, author decision 2026-10-01).
- The 234.32 K / 629.88 K window is a stated artistic convention (1-atm values; in vacuum Hg has no boiling point). It says so in the module header.
- The return to the present is named `recapture`, never "tidal".
- `PLANET_TUNE.relief` stays 12 (author decision, 2026-10-01).
- Confidential author context is never written into code, comments, commits or copy.
- Lint gate: `npm run lint` must stay at 0 errors and not exceed 137 warnings. Pre-existing unrelated test failure: `src/terminal/art/__tests__/artComposite.test.js` "caps a coarse pointer at 1" (not ours).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push. Never stage `.import-cache.json`, `docs/superpowers/specs/2026-09-25-council-field-accretion-design.md`, `src/terminal/views/manifesto/__tests__/__snapshots__/councilField.test.jsx.snap`, `baseline/*`, `scripts/_*`.

## File Structure

| File | Responsibility |
|---|---|
| `src/terminal/mercury/planet/mercuryBody.js` (modify) | `HEAT_CAP_K`: bounds the heat store, and with it the linger. |
| `src/terminal/mercury/planet/aetherLobes.js` (create) | The aether as the mirror sees it: 8 lobe directions (time drift) and colours (live opacities × flow palettes, linearised). |
| `src/terminal/mercury/planet/mirrorLobes.js` (create) | JS twins of the shader's `lobe()` and `softShoulder()`, used to test the Sun targets. |
| `src/terminal/mercury/planet/planetLook.js` (modify) | New look constants and PLANET_TUNE entries. |
| `src/terminal/mercury/planet/mercuryPlanetShader.js` (modify) | Aether lobes, night tint, wider and horizon-masked emitters, Sun shoulder, frozen-Hg aether ambient, two guards. |
| `src/terminal/mercury/MercuryPlanet.jsx` (modify) | Writes the aether uniforms in `useFrame`. |
| `docs/superpowers/specs/2026-09-30-mercury-gem-polish-design.md` (modify) | An amendment section recording the 2026-10-01 author decisions. |

---

### Task 1: Heat cap (linger ~40 s) + spec amendment

**Files:**
- Modify: `src/terminal/mercury/planet/mercuryBody.js` (header comment lines 8–10, constants block, `substep` heat line ~103)
- Test: `src/terminal/mercury/planet/__tests__/mercuryBody.test.js`
- Modify: `docs/superpowers/specs/2026-09-30-mercury-gem-polish-design.md` (append a section)

**Interfaces:**
- Produces: `export const HEAT_CAP_K = 80;` from `mercuryBody.js`. Nothing else changes shape.

- [ ] **Step 1: Write the failing test.** In `mercuryBody.test.js`, add `HEAT_CAP_K` to the existing import from `'../mercuryBody'`. Then add this test inside `describe('mercuryBody', …)`, after the existing hysteresis test:

```js
  it('even a hard spin refreezes ~40 s after release: heat is capped', () => {
    const releaseS = 20;
    const { samples } = run(60, 90, releaseS, [0, MAX_OMEGA, 0]);
    expect(Math.max(...samples.map((s) => s.heatK))).toBeLessThanOrEqual(HEAT_CAP_K + 1e-9);
    const thaw = samples.find((s) => s.t > releaseS && s.tau < 0.99);
    expect(thaw).toBeDefined();
    expect(thaw.t - releaseS).toBeGreaterThan(33);
    expect(thaw.t - releaseS).toBeLessThan(45);
    expect(at(samples, 90).tau).toBe(0);
  });
```

- [ ] **Step 2: Run it and watch it fail.**
Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryBody.test.js`
Expected: FAIL. `HEAT_CAP_K` is undefined, so `toBeLessThanOrEqual(NaN)` fails.

- [ ] **Step 3: Implement.** In `mercuryBody.js`, add the constant after `FREEZE_HEAT_K`:

```js
export const HEAT_CAP_K = 80;          // bounds the store: even a hard spin refreezes ~40 s after release,
                                       // and night (100 K floor + cap) stays below the 234 K melt
```

In `substep`, directly after the line `b.heatK += (HEAT_GAIN * w.lengthSq() - HEAT_LEAK_PER_S * b.heatK) * h;`, add:

```js
  if (b.heatK > HEAT_CAP_K) b.heatK = HEAT_CAP_K;
```

In the header comment, replace `hysteresis, so liquid lingers ~30–60 s after a spin.` with:

```js
// hysteresis; the store is capped (HEAT_CAP_K), so liquid lingers ≤ ~40 s after a spin.
```

- [ ] **Step 4: Run the body tests.**
Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryBody.test.js`
Expected: all PASS, including the existing "lingers ≥ 25 s, frozen by 90 s" and the 60/360 Hz parity tests. If the new test's thaw time falls outside 33–45 s, move `HEAT_CAP_K` within [70, 95] until it lands near 38–40 s. Report the measured thaw time and the final value. Never widen the test window.

- [ ] **Step 5: Amend the spec.** Append to the end of `docs/superpowers/specs/2026-09-30-mercury-gem-polish-design.md`:

```markdown

## Amendment 2026-10-01 — after the phase-2 live look (author decisions)

The first live render of phase 2 showed the transmuted liquid as a black glass ball. The author decided:

1. **The aether is reflected.** "Liquid metal wrapped in an alchemical aether": the aether surrounds the planet on every side, including the camera side we never see. The mirror reflects it as 8 analytic soft lobes coloured by the live element flows. Still no cubemap, no PMREM. This supersedes "reflects only the Sun, the four elements, and black space".
2. **Night side** is a cold, deep, low-luminance silver/indigo: the aether attenuated on the night hemisphere via the surface normal's Sun-facing. Clearly darker than day, never black glass. This supersedes "night side stays near-black".
3. **Element reflections** are widened so the elements wash broad tints across the liquid, not grazing rims.
4. **Boiling Sun glint:** a broad bright sheen in the boil zone that tightens to a pinpoint as the surface cools (brighter true Sun radiance + a soft highlight shoulder; the lobe already conserves energy).
5. **Linger** ~40 s, even after a hard spin (heat store capped). This supersedes "~30–60 s".

Note: F0 was already real mercury (0.76–0.78). Reflectance multiplies what is reflected, so the fix is what the liquid sees, not F0.
```

- [ ] **Step 6: Commit.**

```bash
git add src/terminal/mercury/planet/mercuryBody.js src/terminal/mercury/planet/__tests__/mercuryBody.test.js docs/superpowers/specs/2026-09-30-mercury-gem-polish-design.md
git commit -m "feat(mercury): heat is capped — even a hard spin refreezes ~40 s after release; spec amendment for the aether mirror

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The aether and mirror-lobe modules (pure JS, tested)

**Files:**
- Create: `src/terminal/mercury/planet/aetherLobes.js`
- Create: `src/terminal/mercury/planet/mirrorLobes.js`
- Modify: `src/terminal/mercury/planet/planetLook.js` (add constants; change `PLANET_TUNE`)
- Test: `src/terminal/mercury/planet/__tests__/aetherLobes.test.js` (create)
- Test: `src/terminal/mercury/planet/__tests__/mirrorLobes.test.js` (create)

**Interfaces:**
- Produces (`aetherLobes.js`): `AETHER_LOBES = 8`, `AETHER_DRIFT_RAD_PER_S`, `AETHER_BASE_DIRS: number[8][3]`, `AETHER_PHASES = ['fluid','thermal','earth','air']`, `AETHER_PALETTES_SRGB`, `srgbToLinear(c: number): number`, `aetherLobeColors(opacities: {fluid?,thermal?,earth?,air?: number}, out?: number[8][3]): number[8][3]` (mutates and returns `out`), `aetherLobeDirs(tS: number, out?: number[8][3]): number[8][3]` (mutates and returns `out`).
- Produces (`mirrorLobes.js`): `lobe(cosA, sinR, rough): number`, `softShoulder(x, k): number`.
- Produces (`planetLook.js`): `EMIT_MIN_SIN`, `EMIT_HORIZON_SOFT`, `SUN_SHOULDER`, `AETHER_SIN_W`, `AETHER_NIGHT`, `AETHER_DAY_LO`, `AETHER_DAY_HI`, `AETHER_DIFFUSE`, `NIGHT_TINT`; `PLANET_TUNE.sunGlint = 120`, `PLANET_TUNE.aetherGain = 1.0`.

- [ ] **Step 1: Write the failing tests.** Create `src/terminal/mercury/planet/__tests__/mirrorLobes.test.js`:

```js
// src/terminal/mercury/planet/__tests__/mirrorLobes.test.js
import { describe, it, expect } from 'vitest';
import { lobe, softShoulder } from '../mirrorLobes';
import { ROUGH_LIQUID, ROUGH_BOIL, SUN_SHOULDER, PLANET_TUNE } from '../planetLook';

// The Sun seen from Mercury at mean distance: 0.2666° / 0.387 AU ≈ 0.689°.
const SUN_SIN_R = Math.sin((0.2666 / 0.387) * Math.PI / 180);
// Display-linear Sun term at irradiance 1 (mean distance), angle a (rad) off the mirror direction.
const sunAt = (a, rough) =>
  softShoulder(PLANET_TUNE.sunGlint * PLANET_TUNE.exposure * lobe(Math.cos(a), SUN_SIN_R, rough), SUN_SHOULDER);

describe('mirrorLobes', () => {
  it('lobe conserves the disc energy: peak × width² is roughness-independent', () => {
    const e = (r) => lobe(1, 0.3, r) * (0.3 ** 2 + (r * r) ** 2);
    expect(e(0.14)).toBeCloseTo(0.09, 9);
    expect(e(0.4)).toBeCloseTo(0.09, 9);
  });

  it('softShoulder is ~identity when small, never exceeds k, and is monotone', () => {
    expect(softShoulder(0.01, 3)).toBeCloseTo(0.01, 4);
    expect(softShoulder(1e6, 3)).toBeLessThanOrEqual(3);
    expect(softShoulder(2, 3)).toBeLessThan(softShoulder(3, 3));
  });

  it('boiling Sun is a bright broad sheen, not a grey smudge', () => {
    expect(sunAt(0, ROUGH_BOIL)).toBeGreaterThan(0.9);
    expect(sunAt(0.1, ROUGH_BOIL)).toBeGreaterThan(0.5);
  });

  it('cooled liquid Sun is a saturated pinpoint', () => {
    expect(sunAt(0, ROUGH_LIQUID)).toBeGreaterThan(0.95 * SUN_SHOULDER);
    expect(sunAt(0.1, ROUGH_LIQUID)).toBeLessThan(0.05);
  });
});
```

Create `src/terminal/mercury/planet/__tests__/aetherLobes.test.js`:

```js
// src/terminal/mercury/planet/__tests__/aetherLobes.test.js
import { describe, it, expect } from 'vitest';
import {
  AETHER_LOBES, AETHER_DRIFT_RAD_PER_S, AETHER_BASE_DIRS, AETHER_PHASES, AETHER_PALETTES_SRGB,
  srgbToLinear, aetherLobeColors, aetherLobeDirs,
} from '../aetherLobes';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.sqrt(dot(a, a));

describe('aetherLobes', () => {
  it('8 unit lobes wrap the planet: camera side (+z) and far side, ≥ 70° apart', () => {
    expect(AETHER_BASE_DIRS).toHaveLength(AETHER_LOBES);
    expect(AETHER_LOBES).toBe(8);
    for (const d of AETHER_BASE_DIRS) expect(len(d)).toBeCloseTo(1, 12);
    expect(AETHER_BASE_DIRS.some((d) => d[2] > 0.5)).toBe(true);
    expect(AETHER_BASE_DIRS.some((d) => d[2] < -0.5)).toBe(true);
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
      expect(Math.acos(dot(AETHER_BASE_DIRS[i], AETHER_BASE_DIRS[j]))).toBeGreaterThanOrEqual(70 * Math.PI / 180);
    }
  });

  it('srgbToLinear is the IEC 61966-2-1 curve', () => {
    expect(srgbToLinear(0)).toBe(0);
    expect(srgbToLinear(1)).toBeCloseTo(1, 12);
    expect(srgbToLinear(0.5)).toBeCloseTo(0.21404, 4);
    expect(srgbToLinear(0.04)).toBeCloseTo(0.04 / 12.92, 12);
  });

  it('palettes are three sRGB colours per element flow', () => {
    expect(AETHER_PHASES).toEqual(['fluid', 'thermal', 'earth', 'air']);
    for (const p of AETHER_PHASES) expect(AETHER_PALETTES_SRGB[p]).toHaveLength(3);
  });

  it('no aether, no colour', () => {
    for (const c of aetherLobeColors({})) expect(c).toEqual([0, 0, 0]);
  });

  it('lobe i takes palette entry i % 3 of each element, weighted by its opacity', () => {
    const cols = aetherLobeColors({ fluid: 0.45 });
    const mag = AETHER_PALETTES_SRGB.fluid[0].map(srgbToLinear);
    cols[0].forEach((v, k) => expect(v).toBeCloseTo(0.45 * mag[k], 12));
    const cyan = AETHER_PALETTES_SRGB.fluid[2].map(srgbToLinear);
    cols[5].forEach((v, k) => expect(v).toBeCloseTo(0.45 * cyan[k], 12));
  });

  it('the active element dominates the ghosts', () => {
    const cols = aetherLobeColors({ fluid: 0.45, thermal: 0.12, earth: 0.12, air: 0.12 });
    const ghostOnly = aetherLobeColors({ thermal: 0.12, earth: 0.12, air: 0.12 });
    const sum = (cs) => cs.reduce((s, c) => s + c[0] + c[1] + c[2], 0);
    expect(sum(cols) - sum(ghostOnly)).toBeGreaterThan(sum(ghostOnly));
  });

  it('writes into a caller-owned buffer (no per-frame allocation)', () => {
    const out = AETHER_BASE_DIRS.map(() => [9, 9, 9]);
    expect(aetherLobeColors({ air: 0.2 }, out)).toBe(out);
    const dirs = AETHER_BASE_DIRS.map(() => [0, 0, 0]);
    expect(aetherLobeDirs(3, dirs)).toBe(dirs);
  });

  it('the lobes drift about the vertical, by time not frames', () => {
    const d0 = aetherLobeDirs(0);
    d0.forEach((d, i) => d.forEach((v, k) => expect(v).toBeCloseTo(AETHER_BASE_DIRS[i][k], 12)));
    const quarter = (Math.PI / 2) / AETHER_DRIFT_RAD_PER_S;
    const dq = aetherLobeDirs(quarter);
    dq.forEach((d, i) => {
      const b = AETHER_BASE_DIRS[i];
      expect(d[1]).toBeCloseTo(b[1], 12);                       // y unchanged
      expect(d[0] * b[0] + d[2] * b[2]).toBeCloseTo(0, 9);      // xz turned 90°
      expect(len(d)).toBeCloseTo(1, 12);
    });
    expect(AETHER_DRIFT_RAD_PER_S).toBeGreaterThan(0);
    expect(AETHER_DRIFT_RAD_PER_S).toBeLessThan(0.1);           // slow: a cycle takes minutes
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**
Run: `npx vitest run src/terminal/mercury/planet/__tests__/aetherLobes.test.js src/terminal/mercury/planet/__tests__/mirrorLobes.test.js`
Expected: FAIL. The modules are not found.

- [ ] **Step 3: Add the look constants.** In `planetLook.js`, after the `EMIT_RADIUS` line, add:

```js
export const EMIT_MIN_SIN = 0.6;              // element reflections ≥ ~37° wide: they wash the liquid, not rim it
export const EMIT_HORIZON_SOFT = 0.1;         // an element below the local horizon is not reflected
export const SUN_SHOULDER = 3;                // linear; the Sun term rolls off softly instead of clipping
// The aether (spec amendment 2026-10-01): soft lobes wrapping the planet on every side.
export const AETHER_SIN_W = 0.68;             // lobe width (sin of ~43°): neighbours overlap into an envelope
export const AETHER_NIGHT = 0.2;              // aether strength left on the night hemisphere
export const AETHER_DAY_LO = -0.15;           // dot(normal, Sun) where the night attenuation is full…
export const AETHER_DAY_HI = 0.25;            // …and where full day strength is reached
export const AETHER_DIFFUSE = 0.35;           // frozen Hg's matte response to the aether
export const NIGHT_TINT = [0.62, 0.68, 1.0];  // cold indigo cast on the night side's aether
```

In `PLANET_TUNE`, change `sunGlint: 8,` and add `aetherGain` after `emitGain`:

```js
  sunGlint: 120,     // liquid mirror: Sun-disc radiance gain (soft-shouldered; boil sheen ≈ 1, cooled pinpoint saturates)
  emitGain: 1.5,     // liquid mirror: element-emitter reflection gain
  aetherGain: 1.0,   // liquid mirror + frozen ambient: aether envelope gain
```

- [ ] **Step 4: Create `mirrorLobes.js`.**

```js
// src/terminal/mercury/planet/mirrorLobes.js — JS twins of the liquid mirror's
// lobe maths. mercuryPlanetShader.js mirrors these exactly; the tests here pin
// the Sun's look targets numerically.

// A disc of angular radius asin(sinR) seen in a mirror of roughness rough:
// a Gaussian in angle whose width adds the disc and the GGX alpha, scaled so
// the integrated energy stays that of the disc.
export function lobe(cosA, sinR, rough) {
  const a = Math.acos(Math.min(1, Math.max(-1, cosA)));
  const alpha = rough * rough;
  const w2 = sinR * sinR + alpha * alpha;
  return (sinR * sinR / w2) * Math.exp(-a * a / w2);
}

// Highlight roll-off: ~x for small x, approaches k. Lets the true Sun radiance
// be bright enough to survive boiling without a hard clipped plateau.
export function softShoulder(x, k) {
  return k * (1 - Math.exp(-x / k));
}
```

- [ ] **Step 5: Create `aetherLobes.js`.**

```js
// src/terminal/mercury/planet/aetherLobes.js — the aether as the liquid sees it.
//
// The four element flows wrap the planet on every side, the camera side
// included (we only ever see the half behind it). The mirror reflects that
// envelope as AETHER_LOBES broad soft lights at the cube-corner directions,
// drifting slowly about the vertical. Each lobe takes one palette colour from
// every element flow, weighted by that flow's live opacity, so the active
// element floods the liquid. Palettes are copied from the flow shaders, which
// write them straight to the framebuffer (sRGB), and are linearised here
// because the planet shader encodes its own output.

export const AETHER_LOBES = 8;
export const AETHER_DRIFT_RAD_PER_S = 0.04; // one turn ≈ 2.6 min

const S = 1 / Math.sqrt(3);
export const AETHER_BASE_DIRS = [
  [S, S, S], [-S, S, S], [S, -S, S], [-S, -S, S],
  [S, S, -S], [-S, S, -S], [S, -S, -S], [-S, -S, -S],
];

export const AETHER_PHASES = ['fluid', 'thermal', 'earth', 'air'];

// sRGB, verbatim from each flow's fragment shader.
export const AETHER_PALETTES_SRGB = {
  fluid: [[1.0, 0.0, 0.667], [0.533, 0.267, 1.0], [0.0, 1.0, 0.8]],     // ParticleFlow: magenta, violet, cyan
  thermal: [[1.0, 0.82, 0.10], [1.0, 0.60, 0.05], [1.0, 0.30, 0.02]],   // ThermalFlow: flame core → ember
  earth: [[0.83, 0.56, 0.35], [0.75, 0.41, 0.13], [0.67, 0.27, 0.13]],  // SedimentFlow: sandstone, ochre, clay
  air: [[0.36, 0.64, 0.85], [0.60, 0.78, 0.92], [0.18, 0.48, 0.75]],    // AtmosphericFlow: sky, azure, stratosphere
};

export function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

const LINEAR = Object.fromEntries(
  AETHER_PHASES.map((p) => [p, AETHER_PALETTES_SRGB[p].map((rgb) => rgb.map(srgbToLinear))]),
);

const newBuffer = () => AETHER_BASE_DIRS.map(() => [0, 0, 0]);

export function aetherLobeColors(opacities, out = newBuffer()) {
  for (let i = 0; i < AETHER_LOBES; i++) {
    let r = 0, g = 0, b = 0;
    for (const p of AETHER_PHASES) {
      const o = opacities[p] ?? 0;
      const c = LINEAR[p][i % 3];
      r += o * c[0]; g += o * c[1]; b += o * c[2];
    }
    out[i][0] = r; out[i][1] = g; out[i][2] = b;
  }
  return out;
}

export function aetherLobeDirs(tS, out = newBuffer()) {
  const a = tS * AETHER_DRIFT_RAD_PER_S;
  const c = Math.cos(a), s = Math.sin(a);
  for (let i = 0; i < AETHER_LOBES; i++) {
    const [x, y, z] = AETHER_BASE_DIRS[i];
    out[i][0] = c * x + s * z;
    out[i][1] = y;
    out[i][2] = -s * x + c * z;
  }
  return out;
}
```

- [ ] **Step 6: Run the new tests, plus the shader contract test** (planetLook changed).
Run: `npx vitest run src/terminal/mercury/planet/__tests__/aetherLobes.test.js src/terminal/mercury/planet/__tests__/mirrorLobes.test.js src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`
Expected: all PASS.

- [ ] **Step 7: Commit.**

```bash
git add src/terminal/mercury/planet/aetherLobes.js src/terminal/mercury/planet/mirrorLobes.js src/terminal/mercury/planet/planetLook.js src/terminal/mercury/planet/__tests__/aetherLobes.test.js src/terminal/mercury/planet/__tests__/mirrorLobes.test.js
git commit -m "feat(mercury): the aether as the liquid sees it — 8 drifting lobes coloured by the live flows; tested Sun lobe and soft shoulder

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Shader + wiring — the liquid reflects the aether

**Files:**
- Modify: `src/terminal/mercury/planet/mercuryPlanetShader.js`
- Modify: `src/terminal/mercury/MercuryPlanet.jsx`
- Test: `src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`

**Interfaces:**
- Consumes: from `planetLook.js`: `EMIT_MIN_SIN`, `EMIT_HORIZON_SOFT`, `SUN_SHOULDER`, `AETHER_SIN_W`, `AETHER_NIGHT`, `AETHER_DAY_LO`, `AETHER_DAY_HI`, `AETHER_DIFFUSE`, `NIGHT_TINT`, `PLANET_TUNE.aetherGain`. From `aetherLobes.js`: `AETHER_LOBES`, `AETHER_BASE_DIRS`, `aetherLobeColors(opacities, out)`, `aetherLobeDirs(tS, out)`. The GLSL `lobe()` and `softShoulder()` must stay character-for-character the maths of `mirrorLobes.js`.
- Produces: new uniforms `uAethDir[8]` (vec3, world frame), `uAethCol[8]` (vec3, linear), `uAetherGain` (float).

- [ ] **Step 1: Write the failing shader-contract tests.** In `mercuryPlanetShader.test.js`, extend the `planetLook` import with `EMIT_MIN_SIN, EMIT_HORIZON_SOFT, SUN_SHOULDER, AETHER_SIN_W, AETHER_NIGHT, AETHER_DAY_LO, AETHER_DAY_HI, AETHER_DIFFUSE, NIGHT_TINT`, and add `import { AETHER_LOBES } from '../aetherLobes';`. In the existing "interpolates every physical constant" test, add `EMIT_MIN_SIN, EMIT_HORIZON_SOFT, SUN_SHOULDER, AETHER_SIN_W, AETHER_NIGHT, AETHER_DAY_LO, AETHER_DAY_HI, AETHER_DIFFUSE` to the object. After the `SOLID_HG_ALBEDO` expectation, add:

```js
    expect(PLANET_FS).toContain(`const vec3 NIGHT_TINT = ${v3(NIGHT_TINT)};`);
    expect(PLANET_FS).toContain(`const int AETHER_LOBES = ${AETHER_LOBES};`);
```

Then add these tests at the end of the `describe`:

```js
  it('reflects the aether as AETHER_LOBES soft lobes, attenuated on the night side by the surface normal', () => {
    expect(PLANET_FS).toContain(`uniform vec3 uAethDir[${AETHER_LOBES}];`);
    expect(PLANET_FS).toContain(`uniform vec3 uAethCol[${AETHER_LOBES}];`);
    expect(PLANET_FS).toContain('uniform float uAetherGain;');
    expect(PLANET_FS).toMatch(/float dayW = smoothstep\(AETHER_DAY_LO, AETHER_DAY_HI, dot\(nW, uSunDir\)\);/);
    expect(PLANET_FS).toMatch(/lobe\(dot\(R, uAethDir\[i\]\), AETHER_SIN_W, rough\)/);
    expect(PLANET_FS).toMatch(/vec3 liquid = F \* envRadiance\(R, [^;]*, hit, nW\);/);
    expect(PLANET_FS).toMatch(/\+ aetherDiffuse\(nW\)/);
  });

  it('mirrors mirrorLobes.js: same lobe and soft shoulder maths; the Sun goes through the shoulder', () => {
    expect(PLANET_FS).toContain('return (sinR * sinR / w2) * exp(-a * a / w2);');
    expect(PLANET_FS).toContain('float softShoulder(float x, float k) { return k * (1.0 - exp(-x / k)); }');
    expect(PLANET_FS).toMatch(/softShoulder\(uSunGlint \* uSunIrr \* uExposure \* lobe\(dot\(R, uSunDir\), uSunSinR, rough\), SUN_SHOULDER\)/);
  });

  it('widens and horizon-masks the element reflections', () => {
    expect(PLANET_FS).toContain('float sinE = clamp(EMIT_RADIUS / dist, EMIT_MIN_SIN, 0.99);');
    expect(PLANET_FS).toMatch(/smoothstep\(-EMIT_HORIZON_SOFT, EMIT_HORIZON_SOFT, dot\(nW, dir\)\)/);
  });

  it('guards the Sun longitude at the body pole and gates facet sparkle by the terminator', () => {
    expect(PLANET_FS).toContain('float lonSun = length(Lb.xz) > 1e-4 ? atan(-Lb.z, Lb.x) : 0.0;');
    expect(PLANET_FS).toMatch(/float glint = [^;]*\* term;/);
  });
```

- [ ] **Step 2: Run and watch them fail.**
Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`
Expected: FAIL on the new constants, uniforms and functions. The uniform-set test also fails once the uniforms are declared but not listed; that is fixed in Step 3.

- [ ] **Step 3: Shader edits** in `mercuryPlanetShader.js`:

(a) Header comment: replace the line `// mirror that reflects only the Sun and the four element emitters.` with:

```js
// mirror that reflects the Sun, the four element emitters, and the aether that
// wraps the planet (8 analytic lobes, aetherLobes.js; spec amendment 2026-10-01).
```

(b) Imports: extend the `./planetLook` import with `EMIT_MIN_SIN, EMIT_HORIZON_SOFT, SUN_SHOULDER, AETHER_SIN_W, AETHER_NIGHT, AETHER_DAY_LO, AETHER_DAY_HI, AETHER_DIFFUSE, NIGHT_TINT`. Add:

```js
import { AETHER_LOBES } from './aetherLobes';
```

(c) `PLANET_UNIFORMS`: append `'uAethDir', 'uAethCol', 'uAetherGain'`.

(d) In `PLANET_FS`, after `uniform float uEmitGain;` add:

```glsl
uniform vec3 uAethDir[${AETHER_LOBES}];
uniform vec3 uAethCol[${AETHER_LOBES}];
uniform float uAetherGain;
```

After `const float PHASE_BLEND_K = ${glf(PHASE_BLEND_K)};` add:

```glsl
const float EMIT_MIN_SIN = ${glf(EMIT_MIN_SIN)};
const float EMIT_HORIZON_SOFT = ${glf(EMIT_HORIZON_SOFT)};
const float SUN_SHOULDER = ${glf(SUN_SHOULDER)};
const int AETHER_LOBES = ${AETHER_LOBES};
const float AETHER_SIN_W = ${glf(AETHER_SIN_W)};
const float AETHER_NIGHT = ${glf(AETHER_NIGHT)};
const float AETHER_DAY_LO = ${glf(AETHER_DAY_LO)};
const float AETHER_DAY_HI = ${glf(AETHER_DAY_HI)};
const float AETHER_DIFFUSE = ${glf(AETHER_DIFFUSE)};
const vec3 NIGHT_TINT = ${v3(NIGHT_TINT)};
```

(e) Replace the whole `envRadiance` function (comment `// Only what exists in the frame…` through its closing brace) with:

```glsl
// Highlight roll-off (mirrorLobes.softShoulder).
float softShoulder(float x, float k) { return k * (1.0 - exp(-x / k)); }

// Night attenuation of the aether, keyed on the SURFACE facing the Sun (not
// the reflection direction): full day strength from AETHER_DAY_HI, a cold
// indigo AETHER_NIGHT below AETHER_DAY_LO.
vec3 aetherTint(vec3 nW) {
  float dayW = smoothstep(AETHER_DAY_LO, AETHER_DAY_HI, dot(nW, uSunDir));
  return mix(AETHER_NIGHT * NIGHT_TINT, vec3(1.0), dayW);
}

// What the liquid sees: the Sun disc, the four elements, and the aether that
// wraps the planet on every side. Analytic; no cubemap.
vec3 envRadiance(vec3 R, float rough, vec3 P, vec3 nW) {
  vec3 c = vec3(softShoulder(uSunGlint * uSunIrr * uExposure * lobe(dot(R, uSunDir), uSunSinR, rough), SUN_SHOULDER));
  for (int i = 0; i < 4; i++) {
    vec3 d = uEmitPos[i] - P;
    float dist = max(length(d), 1e-3);
    vec3 dir = d / dist;
    float sinE = clamp(EMIT_RADIUS / dist, EMIT_MIN_SIN, 0.99);
    float above = smoothstep(-EMIT_HORIZON_SOFT, EMIT_HORIZON_SOFT, dot(nW, dir));
    c += uEmitCol[i] * (uEmitGain * above * lobe(dot(R, dir), sinE, rough));
  }
  vec3 a = vec3(0.0);
  for (int i = 0; i < AETHER_LOBES; i++) a += uAethCol[i] * lobe(dot(R, uAethDir[i]), AETHER_SIN_W, rough);
  return c + uAetherGain * aetherTint(nW) * a;
}

// Frozen Hg is matte: it takes the aether as a soft wrap-around ambient.
vec3 aetherDiffuse(vec3 nW) {
  vec3 a = vec3(0.0);
  for (int i = 0; i < AETHER_LOBES; i++) {
    float k = 0.5 + 0.5 * dot(nW, uAethDir[i]);
    a += uAethCol[i] * (k * k);
  }
  return uAetherGain * AETHER_DIFFUSE * aetherTint(nW) * a;
}
```

(f) In `main()`, transmutation block: replace `float lonSun = atan(-Lb.z, Lb.x);` with:

```glsl
    float lonSun = length(Lb.xz) > 1e-4 ? atan(-Lb.z, Lb.x) : 0.0;
```

Replace `vec3 liquid = F * envRadiance(R, mix(ROUGH_LIQUID, ROUGH_BOIL, boilW), hit);` with:

```glsl
    vec3 liquid = F * envRadiance(R, mix(ROUGH_LIQUID, ROUGH_BOIL, boilW), hit, nW);
```

Replace the `glint` and `solid` lines with:

```glsl
    float glint = step(1.0 - SPARKLE_DENSITY, facet) * smoothstep(SPARKLE_COS, 1.0, dot(R, uSunDir)) * term;
    vec3 solid = SOLID_HG_ALBEDO * (sunI * max(dot(nW, uSunDir), 0.0) * term + uNightFloor + aetherDiffuse(nW))
      + vec3(glint * SPARKLE_GAIN * sunI);
```

- [ ] **Step 4: Wire the uniforms** in `MercuryPlanet.jsx`. Add the import:

```js
import { AETHER_BASE_DIRS, aetherLobeColors, aetherLobeDirs } from './planet/aetherLobes';
```

In the material's `uniforms`, after `uEmitGain`, add:

```js
      uAethDir: { value: AETHER_BASE_DIRS.map((d) => new THREE.Vector3(...d)) },
      uAethCol: { value: AETHER_BASE_DIRS.map(() => new THREE.Vector3()) },
      uAetherGain: { value: PLANET_TUNE.aetherGain },
```

Next to `const emitRef = useRef(emitters);`, add per-mount scratch buffers (allocated once, mutated per frame):

```js
  const aether = useMemo(() => ({
    dirs: AETHER_BASE_DIRS.map((d) => [...d]),
    cols: AETHER_BASE_DIRS.map(() => [0, 0, 0]),
  }), []);
```

In `useFrame`, after `u.uEmitGain.value = PLANET_TUNE.emitGain;` add `u.uAetherGain.value = PLANET_TUNE.aetherGain;`. At the end of the `useFrame` body, after the `ORBIT_NODES.forEach(...)` block, add:

```js
    aetherLobeDirs(t, aether.dirs);
    aetherLobeColors(emitRef.current, aether.cols);
    for (let i = 0; i < aether.dirs.length; i++) {
      u.uAethDir.value[i].set(aether.dirs[i][0], aether.dirs[i][1], aether.dirs[i][2]);
      u.uAethCol.value[i].set(aether.cols[i][0], aether.cols[i][1], aether.cols[i][2]);
    }
```

- [ ] **Step 5: Run the mercury tests, the full suite, lint, build.**
Run: `npx vitest run src/terminal/mercury` → expected: all PASS.
Run: `npm test` → expected: all pass except the pre-existing `artComposite.test.js` "caps a coarse pointer at 1".
Run: `npm run lint` → expected: 0 errors, ≤ 137 warnings.
Run: `npm run build` → expected: success.

- [ ] **Step 6: Commit.**

```bash
git add src/terminal/mercury/planet/mercuryPlanetShader.js src/terminal/mercury/MercuryPlanet.jsx src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js
git commit -m "feat(mercury): the liquid reflects the aether that wraps it — wide element washes, a boiling Sun sheen that tightens as it cools, a cold indigo night

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Live look (controller)

Run the headless CDP script (session scratchpad `bodyLive2.mjs`, pattern in HANDOVER: headless Chrome with `--enable-unsafe-swiftshader`, open Mercury via the eye's `aria-label="Open Mercury — observer view"`). Check:
- (a) At rest it looks like phase 1.
- (b) A drag spins it.
- (c) After a sustained spin:
  - the liquid shows aether colour across the whole disc, not only the rims;
  - the boiling noon is a bright sheen;
  - the cooled liquid shows a pinpoint Sun;
  - the night is a cold silver/indigo, clearly darker than the day side;
  - the dawn is frozen.
- (d) The liquid refreezes ~40 s after release.
- (e) Tapping an element node switches the aether, and the liquid's tint follows. Pick the handle inside the canvas rect.

Watch the console for WebGLProgram errors. Judge brightness on the render. `PLANET_TUNE.aetherGain` / `sunGlint` / `emitGain` are live-tunable via `__mercuryTune.planet`; change defaults only on the author's call.

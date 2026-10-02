# /MERCURY Phase 5 — Breakup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A hard flick of the fully liquid planet stretches two tongues, snaps them into beads on release, lets the beads fly, find each other and merge, and brings every drop home through a partial-coalescence cascade before refreeze.

**Architecture:** The simulation is a CPU-side, three.js-free JS family. It has four modules: `breakupPhysics` (laws), `breakupFamily` (trigger and layout), `breakupStep` (life cycle) and `breakupBudget` (return-time solve). It is packed each frame into uniform arrays (`breakupFrame`) for one raymarched SDF impostor (`dropletShader` plus the `useDropletField` hook). The droplets reuse the planet's quicksilver mirror through a shared GLSL chunk (`hgMirrorGlsl`), and that chunk is lifted out of the planet shader with the planet's pinned snapshot unchanged byte for byte.

**Tech Stack:** React Three Fiber, three.js `RawShaderMaterial` (GLSL3), vitest, headless Chrome over CDP (`scripts/cdp.mjs`, `.superpowers/sdd/tools/openMercury.mjs`).

**Spec:** `docs/superpowers/specs/2026-10-02-mercury-breakup-phase5-design.md` (Amendment 5), **including §10 "Plan-time amendments" P1–P6.** That section was written with this plan and needs the author's OK before Task 2.

## Global Constraints

- Branch `feature/mercury-breakup`, off `feature/mercury-meniscus` @ `efe0820d`. **Never push**; push only on the author's explicit command.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Subagents get this trailer wrong. Check it after every commit, and amend if the unpushed tip is wrong.
- **Never stage:** `.import-cache.json`, `docs/superpowers/specs/2026-09-25-council-field-accretion-design.md`, `docs/superpowers/plans/2026-10-01-mercury-planet-phase1.md`, the councilField snapshot, `baseline/*`, `scripts/_*`, `package-lock.json` (restore it if a tool touched it).
- Lint gate: `npx eslint <touched files>` must report **0 errors and no new warnings** (the repo warning ratchet is 153). Don't sweep `exhaustive-deps`.
- The full suite `npx vitest run` has **one pre-existing failure**: `src/terminal/art/__tests__/artComposite.test.js > compositeDpr` (1.5 vs 1). It is unrelated; leave it. Any *other* failure is yours.
- `PLANET_FS` (the full-tier planet fragment shader) must stay **byte-identical** to `src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.full.fs.glsl`. **Never run vitest with `-u` in this phase.**
- The sim modules (`breakupPhysics`, `breakupFamily`, `breakupStep`, `breakupBudget`, `breakupFrame`) import **no three.js**. Vectors are `[x, y, z]` arrays and quaternions are `[x, y, z, w]` (body → world, the same convention as `mercuryBody.q`).
- Frame-loop code (`MercuryPlanet.jsx` `useFrame`) allocates nothing per frame on the idle and hold paths. Allocation at fire time and on snap/merge events is fine.
- Scene units: the planet radius is `R_SCENE = 0.75` and stands for `DROP_R_M = 1 cm` of Hg. Display time is seconds on screen.
- Live checks run headless over CDP against the dev server on :5175. **Never use the in-app browser pane**: it runs rAF at 0 fps.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/terminal/mercury/planet/hgMirrorGlsl.js` (new) | The quicksilver mirror GLSL (`fresnelHg`, `envRadiance` and helpers) and its declarations, shared by the planet and droplet shaders. |
| `src/terminal/mercury/planet/breakupPhysics.js` (new) | Units and laws: droplet playback, t_c, Rayleigh–Plateau λ, pinch, bridge, Taylor–Culick, l = 2 wobble, Σ. |
| `src/terminal/mercury/planet/breakupFamily.js` (new) | Family state, quaternion helpers, trigger (`canHold`/`canFire`), tongue axis, chain layout, hold lag, `fireFamily`. |
| `src/terminal/mercury/planet/breakupStep.js` (new) | `stepFamily`: snaps, launch, flight, cohesion, bead–bead merges, the planet cascade, events. |
| `src/terminal/mercury/planet/breakupBudget.js` (new) | Refreeze-budget return target and the incremental μ bisection solver (headless replay). |
| `src/terminal/mercury/planet/breakupFrame.js` (new) | Family → `Float32Array` uniform payload plus the screen rectangle. |
| `src/terminal/mercury/planet/dropletShader.js` (new) | The SDF impostor VS/FS per tier. |
| `src/terminal/mercury/useDropletField.js` (new) | The droplet material (sharing the planet's mirror uniform objects), the mesh ref and `upload()`. |
| `src/terminal/mercury/planet/mercuryPlanetShader.js` (modify) | Interpolate the shared chunks (byte-identical output). |
| `src/terminal/mercury/planet/planetQuality.js` (modify) | `drop` caps per tier. |
| `src/terminal/mercury/planet/planetLook.js` (modify) | Phase-5 knobs in `PLANET_TUNE`. |
| `src/terminal/mercury/MercuryPlanet.jsx` (modify) | Wire hold, fire, step, events, pack and upload; render the droplet mesh. |
| `src/terminal/mercury/mercuryTuning.js` (modify) | Dev overrides and rig: `dropTime`, `breakNow`, `holdAt`. |
| `src/terminal/mercury/planet/perfStats.js`, `src/terminal/mercury/MercuryPerfHud.jsx` (modify) | HUD readout: primitives, rectangle area, Σ. |
| `.superpowers/sdd/tools/breakSmoke.mjs`, `.superpowers/sdd/tools/breakupLive.mjs` (new) | Live smoke test, timeline strip, zooms, idle draw calls. |

---

### Task 1: Shared quicksilver mirror chunk (pure refactor)

**Files:**
- Create: `src/terminal/mercury/planet/hgMirrorGlsl.js`
- Modify: `src/terminal/mercury/planet/mercuryPlanetShader.js` (the `AETHER_SHAPE_GLSL` const near line 61, the `fresnelHg` function, and the block from `// A disc of angular radius` to the end of `envRadiance`)
- Test: `src/terminal/mercury/planet/__tests__/hgMirrorGlsl.test.js`

**Interfaces:**
- Produces:
  - `HG_MIRROR_UNIFORMS: string[]`
  - `HG_MIRROR_DECLS_GLSL: string`
  - `HG_FRESNEL_GLSL: string` (defines `vec3 fresnelHg(float cosI)`)
  - `HG_ENV_GLSL: string` (defines `vec3 envRadiance(vec3 R, float rough, vec3 P, vec3 nW)` plus `lobe`, `softShoulder`, `aetherShoulder`, `aetherTint`, `aetherHue`, `aetherStreak`, `aetherStreakColor`)
  - `AETHER_SHAPE_GLSL: string`

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/mercury/planet/__tests__/hgMirrorGlsl.test.js
import { describe, it, expect } from 'vitest';
import { PLANET_FS, PLANET_UNIFORMS } from '../mercuryPlanetShader';
import {
  HG_MIRROR_UNIFORMS, HG_MIRROR_DECLS_GLSL, HG_FRESNEL_GLSL, HG_ENV_GLSL, AETHER_SHAPE_GLSL,
} from '../hgMirrorGlsl';

describe('hgMirrorGlsl — one mirror for the planet and its droplets', () => {
  it('the planet shader is built from the shared chunks, verbatim', () => {
    expect(PLANET_FS).toContain(HG_FRESNEL_GLSL);
    expect(PLANET_FS).toContain(HG_ENV_GLSL);
    expect(PLANET_FS).toContain(AETHER_SHAPE_GLSL);
  });

  it('every declaration the chunks need is a line of the planet shader (no drift)', () => {
    const lines = new Set(PLANET_FS.split('\n'));
    for (const l of HG_MIRROR_DECLS_GLSL.split('\n')) expect(lines.has(l), l).toBe(true);
  });

  it('the shared uniforms are planet uniforms (the droplets share their objects)', () => {
    for (const u of HG_MIRROR_UNIFORMS) expect(PLANET_UNIFORMS).toContain(u);
    for (const u of HG_MIRROR_UNIFORMS) expect(HG_MIRROR_DECLS_GLSL).toMatch(new RegExp(`uniform \\w+ ${u}[\\[;]`));
  });

  it('defines the two entry points', () => {
    expect(HG_FRESNEL_GLSL).toContain('vec3 fresnelHg(float cosI) {');
    expect(HG_ENV_GLSL).toContain('vec3 envRadiance(vec3 R, float rough, vec3 P, vec3 nW) {');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/hgMirrorGlsl.test.js`
Expected: FAIL with `Failed to resolve import "../hgMirrorGlsl"`.

- [ ] **Step 3: Create `hgMirrorGlsl.js` by MOVING text out of the planet shader**

Open `src/terminal/mercury/planet/mercuryPlanetShader.js`. Cut each block below **character for character**: comments, blank lines inside the block and indentation included. The planet shader's output must not change by a single byte.

1. `HG_FRESNEL_GLSL` runs from the first character of `// hgOptics.conductorFresnel, exactly:` to the closing `}` of `fresnelHg`. Exclude the newline after the `}`.
2. `HG_ENV_GLSL` runs from the first character of `// A disc of angular radius asin(sinR) seen in a mirror of roughness rough:` to the closing `}` of `envRadiance`. Exclude the newline after the `}`. The block contains `lobe`, `softShoulder`, `aetherShoulder`, `aetherTint`, `aetherHue`, `aetherStreak`, `aetherStreakColor` and `envRadiance`, in that order. It stops **before** `// Frozen Hg is matte`, so `aetherDiffuse` stays in the planet.
3. Move `const AETHER_SHAPE_GLSL = …;` (the module-level const near line 61) here as an export, unchanged.

The new file has this shape. The two template-literal bodies are the exact text you cut (shown here as it stands at `efe0820d`):

```js
// src/terminal/mercury/planet/hgMirrorGlsl.js — the quicksilver mirror, shared by the planet and the droplets.
//
// mercuryPlanetShader.js interpolates HG_FRESNEL_GLSL and HG_ENV_GLSL exactly where its own text
// used to hold them, so PLANET_FS stays byte-identical (pinned snapshot). HG_MIRROR_DECLS_GLSL is
// what those chunks read; every one of its lines is also a line of PLANET_FS (tested), so the
// droplets (dropletShader.js) can never drift from the planet's mirror.

import { glf, v3 } from '../../gl/glf';
import { HG_N, HG_K } from './hgOptics';
import { AETHER_LOBES, AETHER_SHAPES } from './aetherLobes';
import {
  EMIT_RADIUS, EMIT_MIN_SIN, EMIT_HORIZON_SOFT, SUN_SHOULDER, AETHER_NIGHT, AETHER_DAY_LO, AETHER_DAY_HI,
  NIGHT_TINT, AETHER_FRINGE_LO, AETHER_FRINGE_HI, AETHER_SHOULDER,
} from './planetLook';

export const AETHER_SHAPE_GLSL = `const vec2 AETHER_SHAPE[${AETHER_LOBES}] = vec2[${AETHER_LOBES}](${AETHER_SHAPES.map(([w, s]) => `vec2(${glf(w)}, ${glf(s)})`).join(', ')});`;

export const HG_MIRROR_UNIFORMS = [
  'uSunDir', 'uSunIrr', 'uSunSinR', 'uExposure', 'uEmitPos', 'uEmitCol', 'uSunGlint', 'uEmitGain',
  'uAethDir', 'uAethCol', 'uAetherGain', 'uAetherSinW', 'uAetherSilver', 'uAetherEdge', 'uAetherStretch',
  'uAetherCurve', 'uAetherCore', 'uRoughLiquid',
];

export const HG_MIRROR_DECLS_GLSL = [
  'uniform vec3 uSunDir;',
  'uniform float uSunIrr;',
  'uniform float uSunSinR;',
  'uniform float uExposure;',
  'uniform vec3 uEmitPos[4];',
  'uniform vec3 uEmitCol[4];',
  'uniform float uSunGlint;',
  'uniform float uEmitGain;',
  `uniform vec3 uAethDir[${AETHER_LOBES}];`,
  `uniform vec3 uAethCol[${AETHER_LOBES}];`,
  'uniform float uAetherGain;',
  'uniform float uAetherSinW;',
  'uniform float uAetherSilver;',
  'uniform float uAetherEdge;',
  'uniform float uAetherStretch;',
  'uniform float uAetherCurve;',
  'uniform float uAetherCore;',
  'uniform float uRoughLiquid;',
  `const vec3 HG_N = ${v3(HG_N)};`,
  `const vec3 HG_K = ${v3(HG_K)};`,
  `const float EMIT_RADIUS = ${glf(EMIT_RADIUS)};`,
  `const float EMIT_MIN_SIN = ${glf(EMIT_MIN_SIN)};`,
  `const float EMIT_HORIZON_SOFT = ${glf(EMIT_HORIZON_SOFT)};`,
  `const float SUN_SHOULDER = ${glf(SUN_SHOULDER)};`,
  `const int AETHER_LOBES = ${AETHER_LOBES};`,
  AETHER_SHAPE_GLSL,
  `const float AETHER_NIGHT = ${glf(AETHER_NIGHT)};`,
  `const float AETHER_DAY_LO = ${glf(AETHER_DAY_LO)};`,
  `const float AETHER_DAY_HI = ${glf(AETHER_DAY_HI)};`,
  `const float AETHER_FRINGE_LO = ${glf(AETHER_FRINGE_LO)};`,
  `const float AETHER_FRINGE_HI = ${glf(AETHER_FRINGE_HI)};`,
  `const float AETHER_SHOULDER = ${glf(AETHER_SHOULDER)};`,
  `const vec3 NIGHT_TINT = ${v3(NIGHT_TINT)};`,
].join('\n');

export const HG_FRESNEL_GLSL = `// hgOptics.conductorFresnel, exactly: unpolarised reflectance of a metal (n + ik) in vacuum.
vec3 fresnelHg(float cosI) {
  float c = clamp(cosI, 0.0, 1.0);
  float c2 = c * c;
  float s2 = 1.0 - c2;
  vec3 t0 = HG_N * HG_N - HG_K * HG_K - s2;
  vec3 a2b2 = sqrt(t0 * t0 + 4.0 * HG_N * HG_N * HG_K * HG_K);
  vec3 a = sqrt(max(0.5 * (a2b2 + t0), 0.0));
  vec3 rs = (a2b2 + c2 - 2.0 * a * c) / (a2b2 + c2 + 2.0 * a * c);
  vec3 t1 = c2 * a2b2 + s2 * s2;
  vec3 t2 = 2.0 * a * c * s2;
  vec3 rp = rs * (t1 - t2) / (t1 + t2);
  return 0.5 * (rs + rp);
}`;

export const HG_ENV_GLSL = `// A disc of angular radius asin(sinR) seen in a mirror of roughness rough:
// a Gaussian in angle whose width adds the disc and the GGX alpha, scaled so
// the integrated energy stays that of the disc.
float lobe(float cosA, float sinR, float rough) {
  float a = acos(clamp(cosA, -1.0, 1.0));
  float alpha = rough * rough;
  float w2 = sinR * sinR + alpha * alpha;
  return (sinR * sinR / w2) * exp(-a * a / w2);
}

// Highlight roll-off (mirrorLobes.softShoulder).
float softShoulder(float x, float k) { return k * (1.0 - exp(-x / k)); }

vec3 aetherShoulder(vec3 x) {
  return vec3(softShoulder(x.r, AETHER_SHOULDER), softShoulder(x.g, AETHER_SHOULDER), softShoulder(x.b, AETHER_SHOULDER));
}

// Night attenuation of the aether, keyed on the SURFACE facing the Sun (not
// the reflection direction): full day strength from AETHER_DAY_HI, a cold
// indigo AETHER_NIGHT below AETHER_DAY_LO.
vec3 aetherTint(vec3 nW) {
  float dayW = smoothstep(AETHER_DAY_LO, AETHER_DAY_HI, dot(nW, uSunDir));
  return mix(AETHER_NIGHT * NIGHT_TINT, vec3(1.0), dayW);
}

// An aether lobe's colour, pulled toward neutral silver by uAetherSilver:
// the metal stays quicksilver and the aether only tints it.
vec3 aetherHue(vec3 col) {
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  return mix(col, vec3(l), uAetherSilver);
}

// One aether streak in the mirror: an elongated lobe around d, stretched along
// the orbital flow (azimuth about +Y). Returns (intensity, fringe):
// intensity = a super-Gaussian silhouette (uAetherEdge: the meniscus edge's
// hardness) × a curved body inside it (uAetherCurve: brightest at the centre);
// fringe = 0 in the core, 1 at the edge, where the aether colour lives.
vec2 aetherStreak(vec3 R, vec3 d, vec2 shape, float rough) {
  float facing = dot(R, d);
  if (facing <= 0.0) return vec2(0.0);
  vec3 flow = normalize(cross(vec3(0.0, 1.0, 0.0), d));
  vec3 bn = cross(d, flow);
  float alpha = rough * rough;
  float wA = uAetherSinW * shape.x;
  float across = sqrt(wA * wA + alpha * alpha);
  float along = across * (1.0 + (shape.y - 1.0) * uAetherStretch);
  float u = dot(R, flow) / along;
  float v = dot(R, bn) / across;
  float d2 = u * u + v * v;
  float silhouette = exp(-pow(d2, max(uAetherEdge, 0.5)));
  float body = exp(-uAetherCurve * d2);
  return vec2(smoothstep(0.0, 0.15, facing) * silhouette * body, smoothstep(AETHER_FRINGE_LO, AETHER_FRINGE_HI, d2));
}

// A streak's colour at fringe f: a near-white specular core (neutral, at the
// colour's brightest channel × uAetherCore) giving way to the aether hue at
// the meniscus edge. Chrome reflects coloured light this way without going milky.
vec3 aetherStreakColor(vec3 col, float f) {
  float peak = max(col.r, max(col.g, col.b));
  return mix(vec3(peak * uAetherCore), aetherHue(col), f);
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
  for (int i = 0; i < AETHER_LOBES; i++) {
    vec2 s = aetherStreak(R, uAethDir[i], AETHER_SHAPE[i], rough);
    a += aetherStreakColor(uAethCol[i], s.y) * s.x;
  }
  return c + aetherTint(nW) * aetherShoulder(uAetherGain * a);
}`;
```

The two chunk bodies above are copied from `efe0820d`. If the planet file differs from them when you cut, **the planet file wins**: the parity snapshot decides.

- [ ] **Step 4: Point the planet shader at the chunks**

In `mercuryPlanetShader.js`:
- Add `import { HG_FRESNEL_GLSL, HG_ENV_GLSL, AETHER_SHAPE_GLSL } from './hgMirrorGlsl';` and delete the local `AETHER_SHAPE_GLSL` const.
- Where `fresnelHg` was, write `${HG_FRESNEL_GLSL}`.
- Where the lobe…envRadiance block was, write `${HG_ENV_GLSL}`.

The text around each placeholder (blank lines before and after) stays as it was. Leave the imports of planetLook constants that are still used elsewhere in the planet text. Remove any that are now unused only if ESLint flags them; it won't, since the decls in the planet text still interpolate them.

- [ ] **Step 5: Run the tests (snapshot without `-u`)**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/hgMirrorGlsl.test.js src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`
Expected: PASS, including `the full variant is byte-identical to the pinned shader (phase-4 parity)`.

If the parity test fails, the cut was not exact. Diff the file with `git diff --no-index` against the snapshot and fix whitespace. **Do not update the snapshot.**

- [ ] **Step 6: Lint and commit**

```bash
npx eslint src/terminal/mercury/planet/hgMirrorGlsl.js src/terminal/mercury/planet/mercuryPlanetShader.js src/terminal/mercury/planet/__tests__/hgMirrorGlsl.test.js
git add src/terminal/mercury/planet/hgMirrorGlsl.js src/terminal/mercury/planet/mercuryPlanetShader.js src/terminal/mercury/planet/__tests__/hgMirrorGlsl.test.js
git commit -m "refactor(mercury): lift the quicksilver mirror into hgMirrorGlsl (PLANET_FS byte-identical)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Breakup physics laws

**Files:**
- Create: `src/terminal/mercury/planet/breakupPhysics.js`
- Test: `src/terminal/mercury/planet/__tests__/breakupPhysics.test.js`

**Interfaces:**
- Consumes: `HG_SIGMA_N_PER_M`, `HG_RHO_KG_M3`, `DROP_R_M`, `MODE_PLAYBACK` (`mercuryWaves.js`); `R_SCENE` (`planetLook.js`).
- Produces:
  - Constants: `M_PER_UNIT`, `TONGUE_ROOT_R`, `TONGUE_MAX_R`, `RP_LAMBDA_PER_R`, `SAT_RATIO`, `DAUGHTER_RATIO`, `PINCH_EXP`, `BRIDGE_C`, `PX_FLOOR`, `DROP_TC_ANCHOR_S`, `DROP_PLAYBACK`
  - Functions: `sphereVol(r)`, `radiusOfVol(v)`, `capillaryTimeReal(r)`, `capillaryTime(r)`, `rpWavelength(r0)`, `pinchRadius(h0, t, t0)`, `bridgeRadius(rSmall, t)`, `bridgeTime(rSmall)`, `taylorCulick(h)`, `wobbleOmega(r)`, `sigmaRatio(omega)`
  - All lengths are scene units; all times are display seconds.

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/mercury/planet/__tests__/breakupPhysics.test.js
import { describe, it, expect } from 'vitest';
import {
  M_PER_UNIT, TONGUE_ROOT_R, DROP_PLAYBACK, DROP_TC_ANCHOR_S, RP_LAMBDA_PER_R, BRIDGE_C,
  capillaryTime, rpWavelength, pinchRadius, bridgeRadius, bridgeTime, taylorCulick, wobbleOmega,
  sigmaRatio, sphereVol, radiusOfVol,
} from '../breakupPhysics';
import { DROP_R_M, MODE_PLAYBACK } from '../mercuryWaves';
import { R_SCENE } from '../planetLook';

describe('breakupPhysics — the laws the breakup runs on', () => {
  it('the planet is the 1 cm bead', () => {
    expect(M_PER_UNIT * R_SCENE).toBeCloseTo(DROP_R_M, 12);
  });

  it('droplets get their own playback (P1), anchored at the thread', () => {
    expect(capillaryTime(TONGUE_ROOT_R)).toBeCloseTo(DROP_TC_ANCHOR_S, 9);
    expect(DROP_PLAYBACK).toBeLessThan(MODE_PLAYBACK / 10);
  });

  it('capillary time scales as r^1.5 inside the family', () => {
    expect(capillaryTime(4 * TONGUE_ROOT_R) / capillaryTime(TONGUE_ROOT_R)).toBeCloseTo(8, 9);
  });

  it('Rayleigh–Plateau: λ ≈ 9.02 r0', () => {
    expect(rpWavelength(0.01)).toBeCloseTo(RP_LAMBDA_PER_R * 0.01, 12);
  });

  it('inviscid pinch-off thins as (t0 − t)^(2/3)', () => {
    expect(pinchRadius(1, 0, 1)).toBe(1);
    expect(pinchRadius(1, 1, 1)).toBe(0);
    expect(pinchRadius(1, 2, 1)).toBe(0);
    const t0 = 0.4;
    expect(pinchRadius(1, t0 - 0.2, t0) / pinchRadius(1, t0 - 0.1, t0)).toBeCloseTo(2 ** (2 / 3), 9);
  });

  it('inertial coalescence: the bridge grows as √t and reaches the small radius at bridgeTime', () => {
    const r = 0.03;
    expect(bridgeRadius(r, bridgeTime(r))).toBeCloseTo(r, 9);
    expect(bridgeRadius(r, 0.4) / bridgeRadius(r, 0.1)).toBeCloseTo(2, 9);
    expect(bridgeTime(r) / capillaryTime(r)).toBeCloseTo(1 / (BRIDGE_C * BRIDGE_C), 9);
    expect(bridgeRadius(r, 0)).toBe(0);
  });

  it('Taylor–Culick retracts √2 h per capillary time', () => {
    const h = TONGUE_ROOT_R;
    expect(taylorCulick(h) * capillaryTime(h)).toBeCloseTo(Math.SQRT2 * h, 9);
  });

  it('a bead rings in ℓ = 2 at ω₂ t_c = √8', () => {
    expect(wobbleOmega(0.02) * capillaryTime(0.02)).toBeCloseTo(Math.sqrt(8), 9);
  });

  it('Σ = ρω²R³/8σ crosses the fission branch (~0.46) near 11.5 rad/s', () => {
    expect(sigmaRatio(11.47)).toBeGreaterThan(0.45);
    expect(sigmaRatio(11.47)).toBeLessThan(0.47);
    expect(sigmaRatio(7.5)).toBeLessThan(0.2);
  });

  it('volume ↔ radius round-trips', () => {
    expect(radiusOfVol(sphereVol(0.037))).toBeCloseTo(0.037, 12);
    expect(radiusOfVol(-1)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/breakupPhysics.test.js`
Expected: FAIL with `Failed to resolve import "../breakupPhysics"`.

- [ ] **Step 3: Implement**

```js
// src/terminal/mercury/planet/breakupPhysics.js — the laws the breakup runs on (phase-5 spec §3, §5, §6).
//
// CONVENTION (plan amendment P1): the droplets are ~20× smaller than the 1 cm planet bead, so at
// MODE_PLAYBACK their pinch-off and coalescence would be over in a frame or two. Like the body
// modes (1/6) and the ripples (1/40), the droplet family gets its own playback, DROP_PLAYBACK,
// anchored so the thread's capillary time reads DROP_TC_ANCHOR_S on screen. Inside the family the
// physics holds: every duration is t_c(r) ∝ r^1.5 or a fixed multiple of it.
// Lengths are scene units (R_SCENE = the 1 cm bead); times are display seconds.

import { HG_SIGMA_N_PER_M as SIGMA, HG_RHO_KG_M3 as RHO, DROP_R_M } from './mercuryWaves';
import { R_SCENE } from './planetLook';

export const M_PER_UNIT = DROP_R_M / R_SCENE;
export const TONGUE_ROOT_R = 0.025 * R_SCENE;   // thread radius r0 (≈ 5 px on desktop)
export const TONGUE_MAX_R = 0.8 * R_SCENE;      // tongue length at full excess (P4)
export const RP_LAMBDA_PER_R = 9.02;            // fastest-growing Rayleigh–Plateau wavelength / thread radius
export const SAT_RATIO = 0.3;                   // satellite radius / main bead radius
export const DAUGHTER_RATIO = 0.5;              // partial coalescence: daughter radius / parent
export const PINCH_EXP = 2 / 3;                 // inviscid pinch-off: h ∝ (t0 − t)^(2/3)
export const BRIDGE_C = 1.6;                    // inertial coalescence prefactor
export const PX_FLOOR = 1.5;                    // nothing is a distinct body below this many px of radius
export const DROP_TC_ANCHOR_S = 0.4;            // the thread's capillary time on screen

export const sphereVol = (r) => (4 / 3) * Math.PI * r * r * r;
export const radiusOfVol = (v) => Math.cbrt((3 * Math.max(v, 0)) / (4 * Math.PI));

export function capillaryTimeReal(r) {
  const m = r * M_PER_UNIT;
  return Math.sqrt((RHO * m * m * m) / SIGMA);
}

export const DROP_PLAYBACK = capillaryTimeReal(TONGUE_ROOT_R) / DROP_TC_ANCHOR_S; // real s per display s (≈ 1/300)
export const capillaryTime = (r) => capillaryTimeReal(r) / DROP_PLAYBACK;
export const rpWavelength = (r0) => RP_LAMBDA_PER_R * r0;

export function pinchRadius(h0, t, t0) {
  if (!(t > 0)) return h0;
  if (t >= t0) return 0;
  return h0 * ((t0 - t) / t0) ** PINCH_EXP;
}

export function bridgeRadius(rSmall, t) {
  if (!(t > 0)) return 0;
  const m = rSmall * M_PER_UNIT;
  return (BRIDGE_C * ((SIGMA * m) / RHO) ** 0.25 * Math.sqrt(t * DROP_PLAYBACK)) / M_PER_UNIT;
}

export function bridgeTime(rSmall) {
  const m = rSmall * M_PER_UNIT;
  return (m / (BRIDGE_C * ((SIGMA * m) / RHO) ** 0.25)) ** 2 / DROP_PLAYBACK;
}

// Retraction speed of a cut liquid end, scene units per display s.
export function taylorCulick(h) {
  return (Math.sqrt((2 * SIGMA) / (RHO * h * M_PER_UNIT)) * DROP_PLAYBACK) / M_PER_UNIT;
}

// Rayleigh ℓ = 2 frequency of a bead of radius r, rad per display s.
export function wobbleOmega(r) {
  const m = r * M_PER_UNIT;
  return Math.sqrt((8 * SIGMA) / (RHO * m * m * m)) * DROP_PLAYBACK;
}

// The rotating-drop ratio for the 1 cm planet bead at on-screen spin ω (HUD readout; D4).
export function sigmaRatio(omega) {
  return (RHO * omega * omega * DROP_R_M ** 3) / (8 * SIGMA);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/breakupPhysics.test.js`
Expected: PASS, 10 tests.

- [ ] **Step 5: Lint and commit**

```bash
npx eslint src/terminal/mercury/planet/breakupPhysics.js src/terminal/mercury/planet/__tests__/breakupPhysics.test.js
git add src/terminal/mercury/planet/breakupPhysics.js src/terminal/mercury/planet/__tests__/breakupPhysics.test.js
git commit -m "feat(mercury): breakup physics laws (droplet playback, pinch, bridge, Taylor-Culick, wobble)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Family, trigger and layout

**Files:**
- Create: `src/terminal/mercury/planet/breakupFamily.js`
- Test: `src/terminal/mercury/planet/__tests__/breakupFamily.test.js`

**Interfaces:**
- Consumes: everything from Task 2; `MAX_OMEGA`, `FREEZE_HEAT_K`, `HEAT_LEAK_PER_S` (`mercuryBody.js`); `R_SCENE`.
- Produces:
  - Constants: `BREAK_TAU`, `MAX_MAIN_PER_TONGUE`, `SNAP_JITTER`, `TONGUE_LAG_S`, `MERGE_MARGIN_S`, `MIN_RETURN_S`, `DROP_V_REF`
  - Functions: `refreezeIn(heatK)`, `qRotate(q, v, out)`, `qRotateInv(q, v, out)`, `hash01(seed, k)`, `breakExcess(omega, omegaTh)`, `canHold({dragging, tau, omega, omegaTh, calm, phase})`, `canFire({released, tau, omega, omegaTh, calm, phase, heatK})`, `createFamily(seed)`, `addBody(fam, props) → body`, `tongueAxis(spinBody, dragBody|null, out)`, `chainLayout(L) → {N, s, rMain, rSat}`, `holdTongue(fam, dt, e, gain)`, `fireFamily(fam, {maxBodies, satellites})`, `nextSnapIn(fam)`
  - Family fields: `phase` ('idle'|'hold'|'fired'), `seed`, `axisBody`, `L`, `e`, `N`, `s`, `rMain`, `rSat`, `sat`, `t`, `acc`, `mu`, `bodies[]`, `necks[]`, `events[]`, `volOut`, `volFamily`, `volResidual`, `nextId`
  - Body fields (all set by `addBody`): `id`, `state` ('attached'|'free'|'merging'|'cascade'|'gone'), `tongue`, `k`, `posBody`, `p`, `v`, `a`, `r`, `rMain`, `vol`, `tFree`, `wobAxis`, `wobAmp`, `wobT`, `partner`, `lead`, `mergeT`, `mergeC`, `mergeOffA`, `mergeOffB`, `mergeRSmall`, `mergeVrel`, `dirBody`, `stage`, `stageT`, `stageD`, `rK`, `volK`, `rNext`, `final`, `bridgeB`, `neckH`
  - Neck fields: `a` (body index), `b` (body index or −1 = planet), `tSnap`, `on`, `sat` (satellite radius or 0), `stub` (stub radius, root only)

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/mercury/planet/__tests__/breakupFamily.test.js
import { describe, it, expect } from 'vitest';
import {
  refreezeIn, qRotate, qRotateInv, breakExcess, canHold, canFire, createFamily, tongueAxis, chainLayout,
  holdTongue, fireFamily, nextSnapIn, TONGUE_LAG_S, SNAP_JITTER, MIN_RETURN_S, MERGE_MARGIN_S, MAX_MAIN_PER_TONGUE,
} from '../breakupFamily';
import { TONGUE_ROOT_R, TONGUE_MAX_R, rpWavelength, sphereVol } from '../breakupPhysics';
import { MAX_OMEGA } from '../mercuryBody';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const fired = (opts = {}, L = TONGUE_MAX_R) => {
  const f = createFamily(1);
  f.axisBody = [1, 0, 0];
  f.L = L;
  f.e = 1;
  return fireFamily(f, opts);
};

describe('breakupFamily — when the bead breaks, and into what', () => {
  it('quaternion helpers rotate and invert', () => {
    const s = Math.SQRT1_2, q = [0, s, 0, s]; // +90° about Y: x → −z
    const v = qRotate(q, [1, 0, 0]);
    expect(v[0]).toBeCloseTo(0, 12); expect(v[2]).toBeCloseTo(-1, 12);
    const back = qRotateInv(q, v);
    expect(back[0]).toBeCloseTo(1, 12); expect(back[2]).toBeCloseTo(0, 12);
  });

  it('excess is 0 at or below threshold, 1 at MAX_OMEGA, monotonic', () => {
    expect(breakExcess(7.5, 7.5)).toBe(0);
    expect(breakExcess(5, 7.5)).toBe(0);
    expect(breakExcess(MAX_OMEGA, 7.5)).toBe(1);
    expect(breakExcess(9, 7.5)).toBeLessThan(breakExcess(10, 7.5));
  });

  it('refreeze clock is the heat store\'s own decay', () => {
    expect(refreezeIn(80)).toBeCloseTo(Math.log(80 / 25) / 0.035, 9);
    expect(refreezeIn(25)).toBe(0);
  });

  it('holds only while dragging a fully liquid planet past threshold, never under CALM', () => {
    const ok = { dragging: true, tau: 1, omega: 9, omegaTh: 7.5, calm: false, phase: 'idle' };
    expect(canHold(ok)).toBe(true);
    expect(canHold({ ...ok, dragging: false })).toBe(false);
    expect(canHold({ ...ok, tau: 0.99 })).toBe(false);
    expect(canHold({ ...ok, omega: 7 })).toBe(false);
    expect(canHold({ ...ok, calm: true })).toBe(false);
    expect(canHold({ ...ok, phase: 'fired' })).toBe(false);
  });

  it('fires only on release from a hold, with enough time before refreeze', () => {
    const ok = { released: true, tau: 1, omega: 9, omegaTh: 7.5, calm: false, phase: 'hold', heatK: 80 };
    expect(canFire(ok)).toBe(true);
    expect(canFire({ ...ok, released: false })).toBe(false);
    expect(canFire({ ...ok, phase: 'idle' })).toBe(false);
    expect(canFire({ ...ok, phase: 'fired' })).toBe(false);
    const tooLate = 25 * Math.exp(0.035 * (MERGE_MARGIN_S + MIN_RETURN_S - 0.5));
    expect(canFire({ ...ok, heatK: tooLate })).toBe(false);
  });

  it('tongues sit on the spin equator, under the hand', () => {
    const a = tongueAxis([0, 1, 0], [0.6, 0.8, 0]);
    expect(Math.hypot(...a)).toBeCloseTo(1, 12);
    expect(dot(a, [0, 1, 0])).toBeCloseTo(0, 12);
    expect(a[0]).toBeCloseTo(1, 12);
    const b = tongueAxis([0, 1, 0], [0, 1, 0]); // drag point on the axis → any equatorial direction
    expect(dot(b, [0, 1, 0])).toBeCloseTo(0, 12);
    expect(Math.hypot(...tongueAxis([0, 0, 2], null))).toBeCloseTo(1, 12);
  });

  it('chain layout: bead count from λ, one wavelength of thread per main bead', () => {
    expect(chainLayout(0.01).N).toBe(1);
    expect(chainLayout(TONGUE_MAX_R).N).toBe(MAX_MAIN_PER_TONGUE);
    const { N, s, rMain } = chainLayout(TONGUE_MAX_R);
    expect(sphereVol(rMain)).toBeCloseTo(Math.PI * TONGUE_ROOT_R ** 2 * s, 12);
    expect(N * s).toBeCloseTo(TONGUE_MAX_R, 12);
  });

  it('the tongue loads with a capillary-time lag', () => {
    const f = createFamily(1);
    holdTongue(f, TONGUE_LAG_S, 1, 1);
    expect(f.L / TONGUE_MAX_R).toBeCloseTo(1 - Math.exp(-1), 9);
  });

  it('fires two opposed tongues; volume counted before anything flies', () => {
    const f = fired({ maxBodies: 16, satellites: true });
    expect(f.phase).toBe('fired');
    expect(f.N).toBe(4);
    const mains = f.bodies;
    expect(mains.length).toBe(8);
    for (let k = 0; k < 4; k++) {
      const a = mains[k].posBody, b = mains[4 + k].posBody;
      expect(a[0] + b[0]).toBeCloseTo(0, 12);
    }
    const expected = 8 * sphereVol(f.rMain) + 2 * 3 * sphereVol(f.rSat) + 2 * sphereVol(f.rSat);
    expect(f.volFamily).toBeCloseTo(expected, 15);
    expect(f.volOut).toBe(f.volFamily);
  });

  it('caps: satellites go first (their volume folded into the inner beads), then main beads', () => {
    const withSat = fired({ maxBodies: 16, satellites: true });
    const capped = fired({ maxBodies: 12, satellites: true });
    expect(capped.sat).toBe(false);
    expect(capped.N).toBe(4);
    expect(capped.volFamily).toBeCloseTo(withSat.volFamily, 15);
    const lite = fired({ maxBodies: 6, satellites: false });
    expect(lite.N).toBe(2);
    expect(2 * (lite.N + 1)).toBeLessThanOrEqual(6);
  });

  it('snaps: tip first, root last, spaced ≈ t_c with bounded jitter', () => {
    const f = fired({ maxBodies: 16 });
    for (const sign of [0, 1]) {
      const ns = f.necks.slice(sign * f.N, sign * f.N + f.N);
      expect(ns[ns.length - 1].b).toBe(-1);
      for (let k = 0; k < ns.length; k++) {
        expect(Math.abs(ns[k].tSnap / TONGUE_LAG_S - (k + 1))).toBeLessThanOrEqual(SNAP_JITTER + 1e-12);
        if (k > 0) expect(ns[k].tSnap).toBeGreaterThan(ns[k - 1].tSnap);
      }
    }
    expect(nextSnapIn(f)).toBeCloseTo(Math.min(...f.necks.map((n) => n.tSnap)), 12);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(fired({ maxBodies: 16 }))).toBe(JSON.stringify(fired({ maxBodies: 16 })));
  });

  it('a short tongue still makes one bead of one wavelength', () => {
    const f = fired({ maxBodies: 16 }, 0.001);
    expect(f.N).toBe(1);
    expect(f.L).toBeCloseTo(rpWavelength(TONGUE_ROOT_R), 12);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/breakupFamily.test.js`
Expected: FAIL with `Failed to resolve import "../breakupFamily"`.

- [ ] **Step 3: Implement**

```js
// src/terminal/mercury/planet/breakupFamily.js — when the bead breaks, and into what
// (phase-5 spec §4.1–4.3, §5.1–5.2; plan amendments P3, P4).
// Plain arrays, no three.js: breakupBudget.js replays a family headlessly. q = [x, y, z, w], body → world.

import { MAX_OMEGA, FREEZE_HEAT_K, HEAT_LEAK_PER_S } from './mercuryBody';
import { R_SCENE } from './planetLook';
import {
  TONGUE_ROOT_R, TONGUE_MAX_R, SAT_RATIO, rpWavelength, sphereVol, radiusOfVol, capillaryTime,
} from './breakupPhysics';

export const BREAK_TAU = 1;                 // only a fully liquid planet breaks
export const MAX_MAIN_PER_TONGUE = 4;
export const SNAP_JITTER = 0.15;            // ± this × TONGUE_LAG_S on each neck's snap time (additive: order holds)
export const TONGUE_LAG_S = capillaryTime(TONGUE_ROOT_R);
export const MERGE_MARGIN_S = 4;            // every body is home this long before refreeze starts
export const MIN_RETURN_S = 6;              // never fire with less return time than this (snaps + cascade)

export function refreezeIn(heatK) {
  return heatK > FREEZE_HEAT_K ? Math.log(heatK / FREEZE_HEAT_K) / HEAT_LEAK_PER_S : 0;
}

export function qRotate(q, v, out = [0, 0, 0]) {
  const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
  const vx = v[0], vy = v[1], vz = v[2];
  const tx = 2 * (qy * vz - qz * vy), ty = 2 * (qz * vx - qx * vz), tz = 2 * (qx * vy - qy * vx);
  out[0] = vx + qw * tx + (qy * tz - qz * ty);
  out[1] = vy + qw * ty + (qz * tx - qx * tz);
  out[2] = vz + qw * tz + (qx * ty - qy * tx);
  return out;
}

const _qc = [0, 0, 0, 1];
export function qRotateInv(q, v, out = [0, 0, 0]) {
  _qc[0] = -q[0]; _qc[1] = -q[1]; _qc[2] = -q[2]; _qc[3] = q[3];
  return qRotate(_qc, v, out);
}

export function hash01(seed, k) {
  let x = Math.imul(seed | 0, 374761393) + Math.imul(k | 0, 668265263);
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function breakExcess(omega, omegaTh) {
  if (!(omega > omegaTh)) return 0;
  return Math.min(1, (omega - omegaTh) / Math.max(MAX_OMEGA - omegaTh, 1e-6));
}

export function canHold({ dragging, tau, omega, omegaTh, calm, phase }) {
  return !!dragging && !calm && tau >= BREAK_TAU && omega > omegaTh && (phase === 'idle' || phase === 'hold');
}

export function canFire({ released, tau, omega, omegaTh, calm, phase, heatK }) {
  return !!released && !calm && tau >= BREAK_TAU && omega > omegaTh && phase === 'hold'
    && refreezeIn(heatK) - MERGE_MARGIN_S >= MIN_RETURN_S;
}

export function createFamily(seed = 1) {
  return {
    phase: 'idle', seed, axisBody: [1, 0, 0], L: 0, e: 0, N: 0, s: 0, rMain: 0, rSat: 0, sat: false,
    t: 0, acc: 0, mu: 0, bodies: [], necks: [], events: [], volOut: 0, volFamily: 0, volResidual: 0, nextId: 0,
  };
}

export function addBody(fam, props) {
  const b = {
    id: fam.nextId++, state: 'attached', tongue: 0, k: 0,
    posBody: [0, 0, 0], p: [0, 0, 0], v: [0, 0, 0], a: [0, 0, 0],
    r: TONGUE_ROOT_R, rMain: TONGUE_ROOT_R, vol: 0, tFree: 0,
    wobAxis: [1, 0, 0], wobAmp: 0, wobT: 0,
    partner: -1, lead: false, mergeT: 0, mergeC: [0, 0, 0], mergeOffA: [0, 0, 0], mergeOffB: [0, 0, 0], mergeRSmall: 0, mergeVrel: 0,
    dirBody: [0, 0, 1], stage: 0, stageT: 0, stageD: 1, rK: 0, volK: 0, rNext: 0, final: false, bridgeB: 0, neckH: 0,
    ...props,
  };
  fam.bodies.push(b);
  return b;
}

export function tongueAxis(spinBody, dragBody, out = [0, 0, 0]) {
  const sl = Math.hypot(spinBody[0], spinBody[1], spinBody[2]) || 1;
  const sx = spinBody[0] / sl, sy = spinBody[1] / sl, sz = spinBody[2] / sl;
  const project = (d) => {
    const k = d[0] * sx + d[1] * sy + d[2] * sz;
    return [d[0] - k * sx, d[1] - k * sy, d[2] - k * sz];
  };
  let p = project(dragBody ?? [1, 0, 0]);
  let l = Math.hypot(p[0], p[1], p[2]);
  if (l < 1e-3) {
    p = project(Math.abs(sx) < 0.9 ? [1, 0, 0] : [0, 1, 0]);
    l = Math.hypot(p[0], p[1], p[2]);
  }
  out[0] = p[0] / l; out[1] = p[1] / l; out[2] = p[2] / l;
  return out;
}

export function chainLayout(L) {
  const lambda = rpWavelength(TONGUE_ROOT_R);
  const N = Math.min(MAX_MAIN_PER_TONGUE, Math.max(1, Math.round(L / lambda)));
  const s = Math.max(L, lambda) / N;
  const rMain = Math.cbrt(0.75 * TONGUE_ROOT_R * TONGUE_ROOT_R * s);
  return { N, s, rMain, rSat: SAT_RATIO * rMain };
}

// The volume of one main bead at full excess: the strike / cohesion reference.
export const DROP_V_REF = sphereVol(chainLayout(TONGUE_MAX_R).rMain);

export function holdTongue(fam, dt, e, gain) {
  const target = e * gain * TONGUE_MAX_R;
  fam.L += (target - fam.L) * (1 - Math.exp(-dt / TONGUE_LAG_S));
  fam.e = e;
}

export function fireFamily(fam, { maxBodies = 12, satellites = true } = {}) {
  const L = Math.max(fam.L, rpWavelength(TONGUE_ROOT_R));
  let N = chainLayout(L).N;
  const perTongue = (n, sat) => n + (sat ? n - 1 : 0) + 1; // mains + satellites + the root stub
  let sat = satellites;
  if (2 * perTongue(N, sat) > maxBodies) sat = false;
  while (2 * perTongue(N, sat) > maxBodies && N > 1) N -= 1;
  const s = L / N;
  const rMain = Math.cbrt(0.75 * TONGUE_ROOT_R * TONGUE_ROOT_R * s);
  const rSat = SAT_RATIO * rMain;
  const vMain = sphereVol(rMain), vSat = sphereVol(rSat);

  fam.bodies.length = 0; fam.necks.length = 0; fam.events.length = 0;
  Object.assign(fam, { L, N, s, rMain, rSat, sat, t: 0, acc: 0, volResidual: 0 });
  let vol = 0;
  for (const sign of [1, -1]) {
    const first = fam.bodies.length;
    for (let k = 0; k < N; k++) {
      const d = R_SCENE + L - (k + 0.5) * s;
      const v = k > 0 && !sat ? vMain + vSat : vMain; // no satellites: the inner bead keeps that neck's satellite
      const ax = fam.axisBody;
      addBody(fam, { tongue: sign, k, posBody: [sign * ax[0] * d, sign * ax[1] * d, sign * ax[2] * d], vol: v, rMain: radiusOfVol(v) });
      vol += v;
    }
    for (let k = 0; k < N; k++) {
      const jit = SNAP_JITTER * (2 * hash01(fam.seed, 2 * k + (sign > 0 ? 0 : 1)) - 1);
      const tSnap = TONGUE_LAG_S * (k + 1 + jit);
      const root = k === N - 1;
      fam.necks.push({ a: first + k, b: root ? -1 : first + k + 1, tSnap, on: true, sat: !root && sat ? rSat : 0, stub: root ? rSat : 0 });
      fam.bodies[first + k].tFree = tSnap;
      if (root || sat) vol += vSat;
    }
  }
  fam.volFamily = vol;
  fam.volOut = vol;
  fam.phase = 'fired';
  return fam;
}

export function nextSnapIn(fam) {
  let m = Infinity;
  for (const n of fam.necks) if (n.on) m = Math.min(m, n.tSnap - fam.t);
  return m;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/breakupFamily.test.js`
Expected: PASS, 13 tests.

- [ ] **Step 5: Lint and commit**

```bash
npx eslint src/terminal/mercury/planet/breakupFamily.js src/terminal/mercury/planet/__tests__/breakupFamily.test.js
git add src/terminal/mercury/planet/breakupFamily.js src/terminal/mercury/planet/__tests__/breakupFamily.test.js
git commit -m "feat(mercury): breakup family - trigger on release, opposed tongues, RP chain layout, caps

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Step I — snaps, launch, flight

**Files:**
- Create: `src/terminal/mercury/planet/breakupStep.js`
- Test: `src/terminal/mercury/planet/__tests__/breakupStep.test.js`, fixtures in `src/terminal/mercury/planet/__tests__/breakupTestKit.js`

**Interfaces:**
- Consumes: Tasks 2–3; `IMPACT_MODE_AMP`, `IMPACT_WAVE_AMP` (`mercuryImpacts.js`).
- Produces:
  - Constants: `DROP_DT`, `WOB_BIRTH`, `WOB_IMPACT_K`, `WOB_MAX`, `WOB_DAMP_PER_TC`, `HOP_K`, `DRAIN_SHARE`, `SINK`, `HOP_NECK`, `HOP_NECK_T`, `STRIKE_V_REF`, `COHESION_SOFT`
  - `stepFamily(fam, dt, env)`
  - `env = { q:[4], omega:[3] world rad/s, gamma, kappa, vRef, pxPerUnit, planetRadiusAt(dirWorld) → number }`; `fam.mu` is the central pull
  - Events pushed to `fam.events`: `{ kind: 'splash'|'ring', dir:[3] world unit, mode, wave }`

This task writes the whole module (merge and cascade included, because `substep` calls them), but tests **only** snaps, launch and flight. Task 5 adds the merge/cascade tests.

- [ ] **Step 1: Write the shared test kit and the failing test**

Test helpers live in a non-test module so other test files can import them without re-registering tests:

```js
// src/terminal/mercury/planet/__tests__/breakupTestKit.js — shared fixtures for the phase-5 sim tests (not a test file).
import { createFamily, fireFamily, addBody } from '../breakupFamily';
import { stepFamily, DROP_DT } from '../breakupStep';
import { TONGUE_MAX_R, sphereVol } from '../breakupPhysics';
import { R_SCENE } from '../planetLook';

export const testEnv = (over = {}) => ({
  q: [0, 0, 0, 1], omega: [0, 8, 0], gamma: 8, kappa: 0, vRef: 1e-4, pxPerUnit: 300,
  planetRadiusAt: () => R_SCENE, ...over,
});
export const firedFamily = (opts = { maxBodies: 16, satellites: true }) => {
  const f = createFamily(1);
  f.axisBody = [1, 0, 0]; f.L = TONGUE_MAX_R; f.e = 1;
  fireFamily(f, opts);
  f.mu = 0;
  return f;
};
export const runFor = (f, seconds, env) => {
  const n = Math.round(seconds / DROP_DT);
  for (let i = 0; i < n; i++) stepFamily(f, DROP_DT, env);
};
export const freeBody = (f, p, v, r = 0.03) => addBody(f, { state: 'free', p, v, r, rMain: r, vol: sphereVol(r) });
export const muRefAt = (omegaTh) => (omegaTh * R_SCENE) ** 2 * R_SCENE; // = breakupBudget.muRef (Task 6), inlined so Task 5 runs first
```

```js
// src/terminal/mercury/planet/__tests__/breakupStep.test.js
import { describe, it, expect } from 'vitest';
import { createFamily, qRotate, TONGUE_LAG_S } from '../breakupFamily';
import { DROP_DT, WOB_BIRTH } from '../breakupStep';
import { IMPACT_MODE_AMP } from '../mercuryImpacts';
import { testEnv, firedFamily, runFor, freeBody } from './breakupTestKit';

const len = (v) => Math.hypot(v[0], v[1], v[2]);

describe('breakupStep I — snaps, launch, flight', () => {
  it('before the tip snaps every bead rides the body rigidly and swells from the thread', () => {
    const f = firedFamily();
    const s = Math.SQRT1_2, env = testEnv({ q: [0, s, 0, s] });
    runFor(f, 0.5 * TONGUE_LAG_S, env);
    for (const b of f.bodies) expect(b.state).toBe('attached');
    const want = qRotate(env.q, f.bodies[0].posBody);
    expect(f.bodies[0].p[2]).toBeCloseTo(want[2], 12);
    expect(f.bodies[0].r).toBeGreaterThan(0.0187);
    expect(f.bodies[0].r).toBeLessThan(f.bodies[0].rMain);
  });

  it('the tip launches with the surface velocity ω × x', () => {
    const f = firedFamily();
    const env = testEnv({ gamma: 0 });
    runFor(f, f.necks[0].tSnap + 0.5 * DROP_DT, env);
    const tip = f.bodies[0];
    expect(tip.state).toBe('free');
    expect(tip.wobAmp).toBeLessThanOrEqual(WOB_BIRTH);
    const speed = 8 * Math.hypot(tip.p[0], tip.p[2]);
    expect(len(tip.v) / speed).toBeCloseTo(1, 1);
  });

  it('each inter-bead snap leaves a satellite; the root goes last, drains a stub, and the planet flinches', () => {
    const f = firedFamily();
    const env = testEnv();
    const lastSnap = Math.max(...f.necks.map((n) => n.tSnap));
    runFor(f, lastSnap + 2 * DROP_DT, env);
    expect(f.necks.every((n) => !n.on)).toBe(true);
    expect(f.bodies.length).toBe(16);
    const rings = f.events.filter((e) => e.kind === 'ring');
    expect(rings.length).toBe(2);
    expect(rings[0].mode).toBeCloseTo(IMPACT_MODE_AMP.ring * f.e, 12);
    expect(f.bodies.filter((b) => b.state === 'cascade' && b.final).length).toBeGreaterThanOrEqual(1);
  });

  it('flight: a circular orbit holds with no drag (integrator sanity)', () => {
    const f = createFamily(1);
    f.phase = 'fired'; f.mu = 2;
    const b = freeBody(f, [1, 0, 0], [0, 0, Math.sqrt(2)]);
    f.volOut = b.vol;
    runFor(f, (2 * Math.PI) / Math.sqrt(2), testEnv({ gamma: 0 }));
    expect(len(b.p)).toBeCloseTo(1, 2);
  });

  it('the aether drag bleeds speed as e^(−γt)', () => {
    const f = createFamily(1);
    f.phase = 'fired'; f.mu = 0;
    const b = freeBody(f, [2, 0, 0], [0, 0, 1]);
    runFor(f, 1, testEnv({ gamma: 2 }));
    expect(len(b.v)).toBeCloseTo(Math.exp(-2), 2);
  });

  it('cohesion draws beads toward each other', () => {
    const f = createFamily(1);
    f.phase = 'fired'; f.mu = 0;
    const a = freeBody(f, [2, 0, 0.3], [0, 0, 0]);
    const b = freeBody(f, [2, 0, -0.3], [0, 0, 0]);
    runFor(f, 1, testEnv({ gamma: 4, kappa: 0.03, vRef: a.vol }));
    expect(Math.abs(a.p[2] - b.p[2])).toBeLessThan(0.6);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/breakupStep.test.js`
Expected: FAIL with `Failed to resolve import "../breakupStep"`.

- [ ] **Step 3: Implement the whole module**

```js
// src/terminal/mercury/planet/breakupStep.js — the family's life after release
// (phase-5 spec §4.4–4.5, §5.2–5.5, §6; plan amendment P2).
// Fixed DROP_DT substeps (deterministic). Events go to fam.events for MercuryPlanet to ring the planet with.

import { IMPACT_MODE_AMP, IMPACT_WAVE_AMP } from './mercuryImpacts';
import {
  TONGUE_ROOT_R, DAUGHTER_RATIO, PX_FLOOR, capillaryTime, bridgeRadius, pinchRadius, taylorCulick, sphereVol, radiusOfVol,
} from './breakupPhysics';
import { qRotate, qRotateInv, addBody } from './breakupFamily';

export const DROP_DT = 1 / 120;
export const WOB_BIRTH = 0.25;       // ℓ = 2 amplitude a fresh bead is born with (fraction of r)
export const WOB_IMPACT_K = 0.08;    // extra amplitude per unit/s of merge speed
export const WOB_MAX = 0.35;
export const WOB_DAMP_PER_TC = 0.35; // wobble decay per own capillary time (≈ 3 visible rings)
export const HOP_K = 2;              // daughter hop height, in daughter radii
export const DRAIN_SHARE = 0.5;      // share of a cascade stage spent draining (the rest is the hop)
export const SINK = 0.6;             // how far a draining bead sinks toward the surface, × its radius
export const HOP_NECK = 0.6;         // daughter–planet neck at lift-off, × daughter radius…
export const HOP_NECK_T = 0.3;       // …pinched off by this share of the hop
export const STRIKE_V_REF = 0.5;     // normal speed (units/s) for a full-strength strike
export const COHESION_SOFT = 1;      // cohesion softening, × (ra + rb)

const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const unit = (v, out) => { const l = len(v) || 1; out[0] = v[0] / l; out[1] = v[1] / l; out[2] = v[2] / l; return out; };
const cross = (a, b, out) => {
  const x = a[1] * b[2] - a[2] * b[1], y = a[2] * b[0] - a[0] * b[2], z = a[0] * b[1] - a[1] * b[0];
  out[0] = x; out[1] = y; out[2] = z; return out;
};
const _u = [0, 0, 0];
const flies = (b) => b.state === 'free' || (b.state === 'merging' && b.lead);

export function stepFamily(fam, dt, env) {
  if (fam.phase !== 'fired' || !(dt > 0)) return fam;
  fam.acc += dt;
  while (fam.acc >= DROP_DT - 1e-12 && fam.phase === 'fired') {
    fam.acc -= DROP_DT;
    substep(fam, DROP_DT, env);
  }
  return fam;
}

function substep(fam, h, env) {
  fam.t += h;
  snapNecks(fam, env);
  for (const b of fam.bodies) {
    if (b.state !== 'attached') continue;
    qRotate(env.q, b.posBody, b.p);
    b.r = TONGUE_ROOT_R + (b.rMain - TONGUE_ROOT_R) * smooth(fam.t / b.tFree);
  }
  flight(fam, h, env);
  mergeStep(fam, h);
  collide(fam, env);
  cascadeStep(fam, h, env);
  for (const b of fam.bodies) {
    if (b.state !== 'free' || b.wobAmp <= 0) continue;
    b.wobT += h;
    b.wobAmp *= Math.exp((-h * WOB_DAMP_PER_TC) / capillaryTime(b.r));
  }
  if (fam.necks.every((n) => !n.on) && fam.bodies.every((b) => b.state === 'gone')) {
    fam.volResidual = fam.volOut;
    fam.volOut = 0;
    fam.phase = 'idle';
  }
}

function launch(b, env) {
  if (b.state !== 'attached') return;
  b.state = 'free';
  b.r = b.rMain;
  cross(env.omega, b.p, b.v);
  unit(b.p, b.wobAxis);
  b.wobAmp = WOB_BIRTH;
  b.wobT = 0;
}

function snapNecks(fam, env) {
  for (const n of fam.necks) {
    if (!n.on || fam.t < n.tSnap) continue;
    n.on = false;
    const a = fam.bodies[n.a];
    if (n.b >= 0) {
      if (n.sat > 0) {
        const pb = fam.bodies[n.b].p;
        const w = [(a.p[0] + pb[0]) / 2, (a.p[1] + pb[1]) / 2, (a.p[2] + pb[2]) / 2];
        const s = addBody(fam, { state: 'free', p: w, r: n.sat, rMain: n.sat, vol: sphereVol(n.sat), wobAmp: WOB_BIRTH });
        cross(env.omega, w, s.v);
        unit([a.p[0] - pb[0], a.p[1] - pb[1], a.p[2] - pb[2]], s.wobAxis);
      }
    } else {
      // The root lets go last: its stub retracts into the planet at the Taylor–Culick speed, and the planet flinches.
      unit(a.p, _u);
      const R = env.planetRadiusAt(_u);
      const st = addBody(fam, {
        state: 'cascade', r: n.stub, rMain: n.stub, vol: sphereVol(n.stub), rK: n.stub, volK: sphereVol(n.stub),
        rNext: 0, final: true, stageD: (2 * n.stub) / taylorCulick(TONGUE_ROOT_R), p: [_u[0] * R, _u[1] * R, _u[2] * R],
      });
      qRotateInv(env.q, _u, st.dirBody);
      fam.events.push({ kind: 'ring', dir: [_u[0], _u[1], _u[2]], mode: IMPACT_MODE_AMP.ring * fam.e, wave: 0.5 * IMPACT_WAVE_AMP.ring * fam.e });
    }
    launch(a, env);
  }
}

function flight(fam, h, env) {
  const B = fam.bodies;
  for (let i = 0; i < B.length; i++) {
    const b = B[i];
    if (!flies(b)) continue;
    const x = b.state === 'free' ? b.p : b.mergeC;
    const r2 = x[0] * x[0] + x[1] * x[1] + x[2] * x[2];
    const r3 = r2 * Math.sqrt(r2);
    let ax = (-fam.mu * x[0]) / r3 - env.gamma * b.v[0];
    let ay = (-fam.mu * x[1]) / r3 - env.gamma * b.v[1];
    let az = (-fam.mu * x[2]) / r3 - env.gamma * b.v[2];
    if (env.kappa > 0) {
      for (let j = 0; j < B.length; j++) {
        const o = B[j];
        if (j === i || !flies(o)) continue;
        const y = o.state === 'free' ? o.p : o.mergeC;
        const vo = o.state === 'free' ? o.vol : o.vol + B[o.partner].vol;
        const dx = y[0] - x[0], dy = y[1] - x[1], dz = y[2] - x[2];
        const soft = COHESION_SOFT * (b.r + o.r);
        const q = dx * dx + dy * dy + dz * dz + soft * soft;
        const f = (env.kappa * (vo / env.vRef)) / (q * Math.sqrt(q));
        ax += f * dx; ay += f * dy; az += f * dz;
      }
    }
    b.a[0] = ax; b.a[1] = ay; b.a[2] = az;
    b.v[0] += ax * h; b.v[1] += ay * h; b.v[2] += az * h;
    x[0] += b.v[0] * h; x[1] += b.v[1] * h; x[2] += b.v[2] * h;
  }
}

function startMerge(fam, i, j) {
  const b = fam.bodies[i], o = fam.bodies[j];
  const V = b.vol + o.vol;
  let rel = 0;
  for (let c = 0; c < 3; c++) {
    b.mergeC[c] = (b.vol * b.p[c] + o.vol * o.p[c]) / V;
    b.mergeOffA[c] = b.p[c] - b.mergeC[c];
    b.mergeOffB[c] = o.p[c] - b.mergeC[c];
    rel += (b.v[c] - o.v[c]) ** 2;
    b.v[c] = (b.vol * b.v[c] + o.vol * o.v[c]) / V;
  }
  b.mergeVrel = Math.sqrt(rel);
  b.mergeRSmall = Math.min(b.r, o.r);
  b.mergeT = 0; b.bridgeB = 0;
  b.state = 'merging'; b.lead = true; b.partner = j;
  o.state = 'merging'; o.lead = false; o.partner = i;
}

function finishMerge(fam, b) {
  const o = fam.bodies[b.partner];
  const ax = [b.mergeOffA[0] - b.mergeOffB[0], b.mergeOffA[1] - b.mergeOffB[1], b.mergeOffA[2] - b.mergeOffB[2]];
  if (len(ax) > 1e-9) unit(ax, b.wobAxis);
  b.vol += o.vol; o.vol = 0; o.state = 'gone'; o.partner = -1;
  b.r = radiusOfVol(b.vol); b.rMain = b.r;
  b.p[0] = b.mergeC[0]; b.p[1] = b.mergeC[1]; b.p[2] = b.mergeC[2];
  b.wobAmp = Math.min(WOB_MAX, 0.5 * WOB_BIRTH + WOB_IMPACT_K * b.mergeVrel);
  b.wobT = 0;
  b.state = 'free'; b.lead = false; b.partner = -1; b.bridgeB = 0;
}

function mergeStep(fam, h) {
  for (const b of fam.bodies) {
    if (b.state !== 'merging' || !b.lead) continue;
    const o = fam.bodies[b.partner];
    b.mergeT += h;
    const s = Math.min(1, bridgeRadius(b.mergeRSmall, b.mergeT) / b.mergeRSmall);
    b.bridgeB = s * b.mergeRSmall;
    for (let c = 0; c < 3; c++) {
      b.p[c] = b.mergeC[c] + b.mergeOffA[c] * (1 - s);
      o.p[c] = b.mergeC[c] + b.mergeOffB[c] * (1 - s);
    }
    if (s >= 1) finishMerge(fam, b);
  }
}

function strike(fam, b, dir, vn, env) {
  const vd = b.final ? b.volK : b.volK * (1 - DAUGHTER_RATIO ** 3);
  const s = Math.min(1, (vd / env.vRef) * (0.5 + 0.5 * Math.min(1, Math.max(vn, 0) / STRIKE_V_REF)));
  fam.events.push({ kind: 'splash', dir: [dir[0], dir[1], dir[2]], mode: IMPACT_MODE_AMP.splash * s, wave: IMPACT_WAVE_AMP.splash * s });
}

function startCascade(fam, b, env, vn) {
  unit(b.p, _u);
  b.state = 'cascade';
  qRotateInv(env.q, _u, b.dirBody);
  b.stage = 0; b.stageT = 0;
  b.rK = b.r; b.volK = b.vol; b.rNext = DAUGHTER_RATIO * b.r;
  b.final = b.rNext * env.pxPerUnit < PX_FLOOR;
  b.stageD = capillaryTime(b.rK);
  b.v[0] = b.v[1] = b.v[2] = 0; b.wobAmp = 0;
  strike(fam, b, _u, vn, env);
}

function collide(fam, env) {
  const B = fam.bodies;
  for (let i = 0; i < B.length; i++) {
    if (B[i].state !== 'free') continue;
    for (let j = i + 1; j < B.length; j++) {
      const a = B[i], o = B[j];
      if (o.state !== 'free') continue;
      const d = Math.hypot(a.p[0] - o.p[0], a.p[1] - o.p[1], a.p[2] - o.p[2]);
      if (d < a.r + o.r) {
        if (a.vol >= o.vol) startMerge(fam, i, j); else startMerge(fam, j, i);
        break;
      }
    }
  }
  for (const b of B) {
    if (b.state === 'free') {
      unit(b.p, _u);
      if (len(b.p) - b.r <= env.planetRadiusAt(_u)) startCascade(fam, b, env, -(b.v[0] * _u[0] + b.v[1] * _u[1] + b.v[2] * _u[2]));
    } else if (b.state === 'merging' && b.lead) {
      unit(b.mergeC, _u);
      const rr = radiusOfVol(b.vol + B[b.partner].vol);
      if (len(b.mergeC) - rr <= env.planetRadiusAt(_u)) {
        const vn = -(b.v[0] * _u[0] + b.v[1] * _u[1] + b.v[2] * _u[2]);
        finishMerge(fam, b);
        startCascade(fam, b, env, vn);
      }
    }
  }
}

function drainTo(fam, b, vol) {
  const v = Math.max(vol, 0);
  fam.volOut -= b.vol - v;
  b.vol = v;
  b.r = radiusOfVol(v);
}

function cascadeStep(fam, h, env) {
  for (const b of fam.bodies) {
    if (b.state !== 'cascade') continue;
    qRotate(env.q, b.dirBody, _u);
    const R = env.planetRadiusAt(_u);
    b.stageT += h;
    const u = b.stageT / b.stageD;
    const vN = b.final ? 0 : b.volK * DAUGHTER_RATIO ** 3;
    let lift;
    if (b.final || u < DRAIN_SHARE) {
      const du = b.final ? u : u / DRAIN_SHARE;
      drainTo(fam, b, b.volK - (b.volK - vN) * smooth(du));
      b.bridgeB = Math.min(b.rK, bridgeRadius(b.rK, b.stageT));
      b.neckH = 0;
      lift = b.r * (1 - SINK * smooth(du));
    } else {
      drainTo(fam, b, vN);
      const w = (u - DRAIN_SHARE) / (1 - DRAIN_SHARE);
      b.bridgeB = 0;
      b.neckH = pinchRadius(HOP_NECK * b.r, w, HOP_NECK_T);
      lift = b.r + HOP_K * b.r * Math.sin(Math.PI * Math.min(w, 1));
    }
    b.p[0] = _u[0] * (R + lift); b.p[1] = _u[1] * (R + lift); b.p[2] = _u[2] * (R + lift);
    if (u < 1) continue;
    if (b.final) {
      drainTo(fam, b, 0);
      b.state = 'gone'; b.bridgeB = 0; b.neckH = 0;
      continue;
    }
    const hopV = (Math.PI * HOP_K * b.r) / ((1 - DRAIN_SHARE) * b.stageD);
    b.stage += 1; b.rK = b.r; b.volK = b.vol; b.rNext = DAUGHTER_RATIO * b.rK;
    b.final = b.rNext * env.pxPerUnit < PX_FLOOR;
    b.stageT = 0; b.stageD = capillaryTime(b.rK);
    strike(fam, b, _u, hopV, env);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/breakupStep.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Lint and commit**

```bash
npx eslint src/terminal/mercury/planet/breakupStep.js src/terminal/mercury/planet/__tests__/breakupStep.test.js src/terminal/mercury/planet/__tests__/breakupTestKit.js
git add src/terminal/mercury/planet/breakupStep.js src/terminal/mercury/planet/__tests__/breakupStep.test.js src/terminal/mercury/planet/__tests__/breakupTestKit.js
git commit -m "feat(mercury): breakup step - staggered snaps, satellites, stub recoil, flight with drag and cohesion

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Step II — merges, cascade, life cycle (tests)

**Files:**
- Test: `src/terminal/mercury/planet/__tests__/breakupMerge.test.js`
- Modify (only if a test exposes a defect): `src/terminal/mercury/planet/breakupStep.js`

**Interfaces:**
- Consumes: Task 4's `stepFamily` and `DROP_DT`; `breakupTestKit.js` (`testEnv`, `firedFamily`, `runFor`, `freeBody`, `muRefAt`).

- [ ] **Step 1: Write the tests**

```js
// src/terminal/mercury/planet/__tests__/breakupMerge.test.js
import { describe, it, expect } from 'vitest';
import { createFamily } from '../breakupFamily';
import { stepFamily, DROP_DT } from '../breakupStep';
import { sphereVol, bridgeRadius, bridgeTime, capillaryTime, DAUGHTER_RATIO } from '../breakupPhysics';
import { R_SCENE } from '../planetLook';
import { testEnv, firedFamily, runFor, freeBody, muRefAt } from './breakupTestKit';

describe('breakupStep II — merges and the cascade', () => {
  it('beads that touch in flight merge fully: volume and momentum conserved, bridge = r_b(t)', () => {
    const f = createFamily(1);
    f.phase = 'fired'; f.mu = 0;
    const a = freeBody(f, [2, 0, 0.024], [0, 0, -0.2]);        // centres 0.048 apart < 0.03 + 0.02: touching
    const b = freeBody(f, [2, 0, -0.024], [0, 0, 0.2], 0.02);
    f.volOut = a.vol + b.vol;
    const env = testEnv({ gamma: 0 });
    const P0 = [0, 1, 2].map((c) => a.vol * a.v[c] + b.vol * b.v[c]);
    stepFamily(f, DROP_DT, env);
    const lead = f.bodies.find((x) => x.state === 'merging' && x.lead);
    expect(lead).toBeDefined();
    runFor(f, 0.25 * bridgeTime(0.02), env);
    expect(lead.bridgeB).toBeCloseTo(bridgeRadius(0.02, lead.mergeT), 12);
    runFor(f, bridgeTime(0.02), env);
    const alive = f.bodies.filter((x) => x.state !== 'gone');
    expect(alive.length).toBe(1);
    expect(alive[0].vol).toBeCloseTo(sphereVol(0.03) + sphereVol(0.02), 15);
    const V = alive[0].vol;
    for (let c = 0; c < 3; c++) expect(V * alive[0].v[c]).toBeCloseTo(P0[c], 12);
    expect(alive[0].wobAmp).toBeGreaterThan(0);
  });

  it('a bead landing on the planet cascades: halving daughters, t_c stages, one strike each, stops at the px floor', () => {
    const f = createFamily(1);
    f.phase = 'fired'; f.mu = 0;
    const r = 0.03;
    const b = freeBody(f, [R_SCENE + r - 0.001, 0, 0], [-0.2, 0, 0], r);
    f.volOut = b.vol;
    const env = testEnv({ gamma: 0, omega: [0, 0, 0], pxPerUnit: 300 });
    const strikes = [];
    for (let i = 0; i < 2000 && f.phase === 'fired'; i++) {
      stepFamily(f, DROP_DT, env);
      for (const e of f.events) strikes.push({ t: f.t, ...e });
      f.events.length = 0;
    }
    expect(f.phase).toBe('idle');
    // r·px: 9 → 4.5 → 2.25 → (1.125 < 1.5): stages 0, 1, 2; stage 2 merges fully
    expect(strikes.map((s) => s.kind)).toEqual(['splash', 'splash', 'splash']);
    expect(strikes[1].mode).toBeLessThan(strikes[0].mode);
    expect(strikes[2].mode).toBeLessThan(strikes[1].mode);
    expect(strikes[1].t - strikes[0].t).toBeCloseTo(capillaryTime(r), 1);
    expect(strikes[2].t - strikes[1].t).toBeCloseTo(capillaryTime(DAUGHTER_RATIO * r), 1);
    expect(Math.abs(f.volResidual)).toBeLessThan(1e-12 * sphereVol(r));
  });

  it('a full family comes home: idle, every drop drained back, volume exact', () => {
    const f = firedFamily();
    f.mu = 50 * muRefAt(7.5);
    const env = testEnv({ gamma: 8, kappa: 0.03, vRef: sphereVol(f.rMain) });
    let events = 0;
    for (let i = 0; i < 120 / DROP_DT && f.phase === 'fired'; i++) {
      stepFamily(f, DROP_DT, env);
      for (const e of f.events) { expect(Number.isFinite(e.mode)).toBe(true); events++; }
      f.events.length = 0;
    }
    expect(f.phase).toBe('idle');
    expect(events).toBeGreaterThan(2);
    expect(Math.abs(f.volResidual)).toBeLessThan(1e-12 * f.volFamily);
  });
});
```

- [ ] **Step 2: Run**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/breakupMerge.test.js`
Expected: PASS, 3 tests.

If the cascade timing assertions fail by exactly one stage, check `startCascade`/`cascadeStep` against spec §6.3 before touching the numbers. The expected stage count follows from r·px = 9 → 4.5 → 2.25 → 1.125.

- [ ] **Step 3: Commit**

```bash
git add src/terminal/mercury/planet/__tests__/breakupMerge.test.js
git commit -m "test(mercury): breakup merges, partial-coalescence cascade, full life cycle volume

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Budget — return target and μ solver

**Files:**
- Create: `src/terminal/mercury/planet/breakupBudget.js`
- Test: `src/terminal/mercury/planet/__tests__/breakupBudget.test.js`

**Interfaces:**
- Consumes: `stepFamily`, `DROP_DT` (Task 4); `MERGE_MARGIN_S`, `MIN_RETURN_S`, `refreezeIn` (Task 3); `SPIN_DAMP_PER_S` (`mercuryBody.js`).
- Produces:
  - Constants: `MU_ITERS`, `MU_SPAN`, `T_MAX_FACTOR`, `SOLVER_ITERS_PER_FRAME`
  - Functions: `muRef(omegaTh)`, `returnTarget(heatK, drift)`, `headlessEnv(env0)` (its `.at(t)` updates `.q`/`.omega`), `cloneFamily(fam)`, `absorbTime(template, env0, mu, tMax)`, `createMuSolver(template, env0, target)`, `stepMuSolver(s, iters)`, `finishMuSolver(s)`
  - `env0` also carries `omegaTh`. Solver fields: `{ lo, hi, it, best, done, template, env0, target }`.

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/mercury/planet/__tests__/breakupBudget.test.js
import { describe, it, expect } from 'vitest';
import {
  muRef, returnTarget, headlessEnv, absorbTime, createMuSolver, stepMuSolver, finishMuSolver,
} from '../breakupBudget';
import {
  createFamily, fireFamily, breakExcess, tongueAxis, refreezeIn, MIN_RETURN_S, MERGE_MARGIN_S, DROP_V_REF,
} from '../breakupFamily';
import { TONGUE_MAX_R } from '../breakupPhysics';
import { SPIN_DAMP_PER_S } from '../mercuryBody';

const famAt = (omega, yaw) => {
  const f = createFamily(1);
  tongueAxis([0, 1, 0], [Math.cos(yaw), 0, Math.sin(yaw)], f.axisBody);
  f.L = breakExcess(omega, 7.5) * TONGUE_MAX_R;
  f.e = breakExcess(omega, 7.5);
  return fireFamily(f, { maxBodies: 12, satellites: true });
};
const env0At = (omega, yaw) => ({
  q: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)], omega: [0, omega, 0], gamma: 8, kappa: 0.03,
  vRef: DROP_V_REF, pxPerUnit: 300, omegaTh: 7.5,
});

describe('breakupBudget — the 40 s linger is the budget', () => {
  it('return target: the drift wish, capped by refreeze − margin, floored at MIN_RETURN_S', () => {
    expect(returnTarget(80, 14)).toBe(14);
    expect(returnTarget(80, 100)).toBeCloseTo(refreezeIn(80) - MERGE_MARGIN_S, 9);
    expect(returnTarget(27, 14)).toBe(MIN_RETURN_S);
  });

  it('the headless replay decays the spin like the body does', () => {
    const env = headlessEnv(env0At(12, 0.3));
    env.at(2);
    expect(Math.hypot(...env.omega)).toBeCloseTo(12 * Math.exp(-SPIN_DAMP_PER_S * 2), 9);
    expect(Math.hypot(...env.q)).toBeCloseTo(1, 12);
  });

  it('a strong pull brings everyone home; a feeble one does not within tMax', () => {
    const f = famAt(12, 0);
    expect(absorbTime(f, env0At(12, 0), 1000 * muRef(7.5), 60)).toBeLessThan(60);
    expect(absorbTime(f, env0At(12, 0), 1e-6 * muRef(7.5), 5)).toBe(Infinity);
  });

  it('over a sweep of releases the solved pull lands the last drop on time, and no sooner than needed', () => {
    for (const omega of [8, 10, 12]) {
      for (const heat of [60, 70, 80]) {
        for (const yaw of [0, 2.1, 4.2]) {
          const f = famAt(omega, yaw);
          const e0 = env0At(omega, yaw);
          const target = returnTarget(heat, 14);
          const s = createMuSolver(f, e0, target);
          finishMuSolver(s);
          expect(s.done).toBe(true);
          expect(absorbTime(f, e0, s.best, target * 2)).toBeLessThanOrEqual(target + 1e-9);
        }
      }
    }
    const f = famAt(12, 0), e0 = env0At(12, 0);
    const s = createMuSolver(f, e0, 14);
    finishMuSolver(s);
    expect(absorbTime(f, e0, s.best / 1.5, 28)).toBeGreaterThan(14); // gentlest pull the budget allows
  }, 120000);

  it('one solver iteration stays cheap enough to amortise across frames', () => {
    const s = createMuSolver(famAt(12, 0), env0At(12, 0), 14);
    stepMuSolver(s, 1);
    const t0 = performance.now();
    stepMuSolver(s, 3);
    expect((performance.now() - t0) / 3).toBeLessThan(8); // spec target 4 ms on the dev desktop; slack for CI noise
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/breakupBudget.test.js`
Expected: FAIL with `Failed to resolve import "../breakupBudget"`.

- [ ] **Step 3: Implement**

```js
// src/terminal/mercury/planet/breakupBudget.js — the ~40 s liquid linger as a budget, not a schedule
// (phase-5 spec §4.4; plan amendment P2). The drag is fixed (it keeps the beads on screen); the
// central pull μ is solved by bisection on a headless replay so the LAST drop is fully absorbed by
// the return target. The solver runs a couple of iterations per frame, before the first neck snaps.

import { SPIN_DAMP_PER_S } from './mercuryBody';
import { R_SCENE } from './planetLook';
import { MERGE_MARGIN_S, MIN_RETURN_S, refreezeIn } from './breakupFamily';
import { stepFamily, DROP_DT } from './breakupStep';

export const MU_ITERS = 16;
export const MU_SPAN = 1e3;              // bracket: muRef / MU_SPAN … muRef × MU_SPAN (log space)
export const T_MAX_FACTOR = 2;           // a trial gives up at this × the target
export const SOLVER_ITERS_PER_FRAME = 2;

// A bead launched at the threshold surface speed (ω_th R) is exactly on a circular orbit.
export const muRef = (omegaTh) => (omegaTh * R_SCENE) ** 2 * R_SCENE;

export const returnTarget = (heatK, drift) =>
  Math.max(MIN_RETURN_S, Math.min(drift, refreezeIn(heatK) - MERGE_MARGIN_S));

const qMul = (a, b, out) => {
  const ax = a[0], ay = a[1], az = a[2], aw = a[3], bx = b[0], by = b[1], bz = b[2], bw = b[3];
  out[0] = aw * bx + ax * bw + ay * bz - az * by;
  out[1] = aw * by - ax * bz + ay * bw + az * bx;
  out[2] = aw * bz + ax * by - ay * bx + az * bw;
  out[3] = aw * bw - ax * bx - ay * by - az * bz;
  return out;
};

// The replay's world: free spin decays about a fixed axis (recapture ignored — the margin covers it),
// and the planet is the rest sphere.
export function headlessEnv(env0) {
  const w0 = [...env0.omega];
  const W = Math.hypot(w0[0], w0[1], w0[2]);
  const axis = W > 0 ? [w0[0] / W, w0[1] / W, w0[2] / W] : [0, 1, 0];
  const q0 = [...env0.q];
  const dq = [0, 0, 0, 1];
  const env = {
    gamma: env0.gamma, kappa: env0.kappa, vRef: env0.vRef, pxPerUnit: env0.pxPerUnit,
    q: [...q0], omega: [...w0], planetRadiusAt: () => R_SCENE,
  };
  env.at = (t) => {
    const f = Math.exp(-SPIN_DAMP_PER_S * t);
    const th = (W * (1 - f)) / SPIN_DAMP_PER_S;
    const s = Math.sin(th / 2);
    dq[0] = axis[0] * s; dq[1] = axis[1] * s; dq[2] = axis[2] * s; dq[3] = Math.cos(th / 2);
    qMul(dq, q0, env.q);
    env.omega[0] = w0[0] * f; env.omega[1] = w0[1] * f; env.omega[2] = w0[2] * f;
  };
  return env;
}

export const cloneFamily = (fam) => structuredClone(fam);

export function absorbTime(template, env0, mu, tMax) {
  const fam = cloneFamily(template);
  fam.mu = mu;
  const env = headlessEnv(env0);
  while (fam.phase === 'fired' && fam.t < tMax) {
    env.at(fam.t);
    stepFamily(fam, DROP_DT, env);
    fam.events.length = 0;
  }
  return fam.phase === 'fired' ? Infinity : fam.t;
}

export function createMuSolver(template, env0, target) {
  const m = muRef(env0.omegaTh);
  return {
    lo: Math.log(m / MU_SPAN), hi: Math.log(m * MU_SPAN), it: 0, best: m * MU_SPAN, done: false, target,
    template: cloneFamily(template),
    env0: { q: [...env0.q], omega: [...env0.omega], gamma: env0.gamma, kappa: env0.kappa, vRef: env0.vRef, pxPerUnit: env0.pxPerUnit, omegaTh: env0.omegaTh },
  };
}

// Bisection toward the smallest μ (the slowest drift) that still lands the last drop by the target.
export function stepMuSolver(s, iters = SOLVER_ITERS_PER_FRAME) {
  for (let i = 0; i < iters && !s.done; i++) {
    const mid = 0.5 * (s.lo + s.hi);
    const mu = Math.exp(mid);
    const T = absorbTime(s.template, s.env0, mu, s.target * T_MAX_FACTOR);
    if (T <= s.target) { s.best = mu; s.hi = mid; } else s.lo = mid;
    if (++s.it >= MU_ITERS) s.done = true;
  }
  return s;
}

export function finishMuSolver(s) {
  while (!s.done) stepMuSolver(s, MU_ITERS);
  return s;
}
```

- [ ] **Step 4: Run Tasks 5 and 6 tests**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/breakupBudget.test.js`
Expected: PASS (5 tests).

If the sweep fails because `best` stays at the top of the bracket (`muRef × MU_SPAN`) and still misses the target, the fixed part (snap sequence plus cascade) exceeds the target. Report it; do not raise `MU_SPAN` blindly.

- [ ] **Step 5: Lint and commit**

```bash
npx eslint src/terminal/mercury/planet/breakupBudget.js src/terminal/mercury/planet/__tests__/breakupBudget.test.js
git add src/terminal/mercury/planet/breakupBudget.js src/terminal/mercury/planet/__tests__/breakupBudget.test.js
git commit -m "feat(mercury): breakup budget - refreeze-capped return target, incremental mu bisection on a headless replay

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Frame packing and screen rect

**Files:**
- Create: `src/terminal/mercury/planet/breakupFrame.js`
- Test: `src/terminal/mercury/planet/__tests__/breakupFrame.test.js`

**Interfaces:**
- Consumes: `chainLayout`, `qRotate` (Task 3); `TONGUE_ROOT_R`, `pinchRadius`, `wobbleOmega` (Task 2).
- Produces:
  - Constants: `NECK_ASYM`, `FLIGHT_STRETCH`, `A_REF`, `STRETCH_MAX`, `DROP_PAD_PX`, `BOUND_BEAD`
  - Functions: `pxPerUnitAt(dist, fovDeg, heightPx)`, `pxAngleOf(fovDeg, heightPx)`, `createDropFrame(caps)`, `packFamily(fam, env, frame, view)`
  - `caps = { bodies, necks, bridges }`. `view = { vp: Float32Array(16) column-major proj×view, p00, p11, wPx, hPx }`.
  - Frame fields: `bead`, `beadAxis` (vec4 × bodies), `neck` (vec4: ia, ib|−1, h, asym), `neckR` (float), `bridge` (vec4: ia, ib|−1, blend, planetR), `nb`, `nn`, `nk`, `rect` [x0, y0, x1, y1] NDC, `visible`, `areaPx`, `pxAngle`.

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/mercury/planet/__tests__/breakupFrame.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createDropFrame, packFamily, pxPerUnitAt } from '../breakupFrame';
import { createFamily, addBody, chainLayout } from '../breakupFamily';
import { TONGUE_ROOT_R, TONGUE_MAX_R, sphereVol } from '../breakupPhysics';
import { R_SCENE } from '../planetLook';
import { testEnv, firedFamily } from './breakupTestKit';

const caps = { bodies: 12, necks: 10, bridges: 12 };
function viewOf(z = 3.6) {
  const cam = new THREE.PerspectiveCamera(42, 1.6, 0.1, 100);
  cam.position.set(0, 0, z); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const m = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  return { vp: Float32Array.from(m.elements), p00: cam.projectionMatrix.elements[0], p11: cam.projectionMatrix.elements[5], wPx: 1600, hPx: 1000 };
}

describe('breakupFrame — a family to the droplet shader', () => {
  it('idle draws nothing', () => {
    const f = createDropFrame(caps);
    packFamily(createFamily(1), testEnv(), f, viewOf());
    expect(f.visible).toBe(false);
    expect(f.nb).toBe(0);
  });

  it('hold: two thread chains of r0 beads, each rooted to the planet', () => {
    const fam = createFamily(1);
    fam.phase = 'hold'; fam.L = TONGUE_MAX_R; fam.axisBody = [1, 0, 0];
    const f = createDropFrame(caps);
    packFamily(fam, testEnv(), f, viewOf());
    const { N } = chainLayout(TONGUE_MAX_R);
    expect(f.nb).toBe(2 * N);
    expect(f.nn).toBe(2 * N);
    for (let i = 0; i < f.nb; i++) expect(f.bead[4 * i + 3]).toBeCloseTo(TONGUE_ROOT_R, 7);
    const roots = [...Array(f.nn).keys()].filter((i) => f.neck[4 * i + 1] === -1);
    expect(roots.length).toBe(2);
    for (const i of roots) expect(f.neckR[i]).toBeCloseTo(R_SCENE, 7);
    expect(f.visible).toBe(true);
  });

  it('fired: necks thin by the pinch law; snapped necks are gone; caps never overflow', () => {
    const fam = firedFamily({ maxBodies: 12, satellites: true });
    fam.t = 0.5 * fam.necks[0].tSnap;
    for (const b of fam.bodies) b.p = [...b.posBody];
    const f = createDropFrame(caps);
    packFamily(fam, testEnv(), f, viewOf());
    expect(f.neck[2]).toBeLessThan(TONGUE_ROOT_R);
    expect(f.neck[2]).toBeGreaterThan(0);
    fam.necks[0].on = false;
    packFamily(fam, testEnv(), f, viewOf());
    expect(f.nn).toBe(fam.necks.length - 1);
    expect(f.nb).toBeLessThanOrEqual(caps.bodies);
  });

  it('a merging pair gets a bridge; a cascading bead gets a planet bridge at the live radius', () => {
    const fam = createFamily(1);
    fam.phase = 'fired'; fam.rMain = 0.03;
    const a = addBody(fam, { state: 'merging', lead: true, partner: 1, p: [2, 0, 0.02], r: 0.03, vol: sphereVol(0.03), bridgeB: 0.01 });
    addBody(fam, { state: 'merging', lead: false, partner: 0, p: [2, 0, -0.02], r: 0.02, vol: sphereVol(0.02) });
    addBody(fam, { state: 'cascade', p: [0, R_SCENE + 0.02, 0], r: 0.02, vol: sphereVol(0.02), bridgeB: 0.005 });
    const f = createDropFrame(caps);
    packFamily(fam, testEnv({ planetRadiusAt: () => 0.76 }), f, viewOf());
    expect(f.nk).toBe(2);
    expect(f.bridge[2]).toBeCloseTo(a.bridgeB, 7);
    expect(f.bridge[4 + 1]).toBe(-1);
    expect(f.bridge[4 + 3]).toBeCloseTo(0.76, 7);
  });

  it('the rect holds every bead on screen, inside NDC, with an area', () => {
    const fam = createFamily(1);
    fam.phase = 'fired'; fam.rMain = 0.03;
    addBody(fam, { state: 'free', p: [1.2, 0.3, 0], r: 0.03, vol: sphereVol(0.03) });
    addBody(fam, { state: 'free', p: [-1.0, -0.2, 0.4], r: 0.03, vol: sphereVol(0.03) });
    const f = createDropFrame(caps);
    const view = viewOf();
    packFamily(fam, testEnv(), f, view);
    const [x0, y0, x1, y1] = f.rect;
    for (const b of fam.bodies) {
      const v = new THREE.Vector4(...b.p, 1).applyMatrix4(new THREE.Matrix4().fromArray(view.vp));
      expect(v.x / v.w).toBeGreaterThan(x0); expect(v.x / v.w).toBeLessThan(x1);
      expect(v.y / v.w).toBeGreaterThan(y0); expect(v.y / v.w).toBeLessThan(y1);
    }
    expect(x0).toBeGreaterThanOrEqual(-1); expect(y1).toBeLessThanOrEqual(1);
    expect(f.areaPx).toBeGreaterThan(0);
  });

  it('px per scene unit at the planet distance', () => {
    expect(pxPerUnitAt(3.6, 42, 1000)).toBeCloseTo(1000 / (2 * 3.6 * Math.tan((21 * Math.PI) / 180)), 9);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/breakupFrame.test.js`
Expected: FAIL with `Failed to resolve import "../breakupFrame"`.

- [ ] **Step 3: Implement**

```js
// src/terminal/mercury/planet/breakupFrame.js — a family → the droplet shader's uniform arrays + its screen rect
// (phase-5 spec §7.1–7.2). Allocation-free after createDropFrame.

import { R_SCENE } from './planetLook';
import { TONGUE_ROOT_R, pinchRadius, wobbleOmega } from './breakupPhysics';
import { chainLayout, qRotate } from './breakupFamily';

export const NECK_ASYM = 0.2;        // waist shifted toward the inner body: steep cone at the outer bead, shallow inward (spec §5.2)
export const FLIGHT_STRETCH = 0.12;  // prolate stretch of a main bead at A_REF
export const A_REF = 4;              // units/s²
export const STRETCH_MAX = 0.45;
export const DROP_PAD_PX = 4;
export const BOUND_BEAD = 2;         // a bead's bound, × r × (1 + |stretch|): its neck shoulders and fillets live inside

export const pxPerUnitAt = (dist, fovDeg, heightPx) => heightPx / (2 * dist * Math.tan((fovDeg * Math.PI) / 360));
export const pxAngleOf = (fovDeg, heightPx) => (2 * Math.tan((fovDeg * Math.PI) / 360)) / heightPx;

export function createDropFrame(caps) {
  return {
    caps,
    bead: new Float32Array(caps.bodies * 4), beadAxis: new Float32Array(caps.bodies * 4),
    neck: new Float32Array(caps.necks * 4), neckR: new Float32Array(caps.necks), bridge: new Float32Array(caps.bridges * 4),
    nb: 0, nn: 0, nk: 0, rect: new Float32Array([-1, -1, 1, 1]), visible: false, areaPx: 0, pxAngle: 1e-3,
    map: new Int32Array(caps.bodies + 8),
  };
}

const _c = [0, 0, 0], _u = [0, 0, 0], _ax = [0, 0, 0];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const unitInto = (v, out) => { const l = len(v) || 1; out[0] = v[0] / l; out[1] = v[1] / l; out[2] = v[2] / l; return out; };

function pushBead(f, c, r, ax, s) {
  if (f.nb >= f.caps.bodies) return -1;
  const i = f.nb++;
  f.bead[4 * i] = c[0]; f.bead[4 * i + 1] = c[1]; f.bead[4 * i + 2] = c[2]; f.bead[4 * i + 3] = r;
  f.beadAxis[4 * i] = ax[0]; f.beadAxis[4 * i + 1] = ax[1]; f.beadAxis[4 * i + 2] = ax[2];
  f.beadAxis[4 * i + 3] = Math.max(-STRETCH_MAX, Math.min(STRETCH_MAX, s));
  return i;
}

function pushNeck(f, ia, ib, h, asym, R) {
  if (f.nn >= f.caps.necks || ia < 0) return;
  const i = f.nn++;
  f.neck[4 * i] = ia; f.neck[4 * i + 1] = ib; f.neck[4 * i + 2] = h; f.neck[4 * i + 3] = asym;
  f.neckR[i] = R;
}

function pushBridge(f, ia, ib, k, R) {
  if (f.nk >= f.caps.bridges || ia < 0) return;
  const i = f.nk++;
  f.bridge[4 * i] = ia; f.bridge[4 * i + 1] = ib; f.bridge[4 * i + 2] = k; f.bridge[4 * i + 3] = R;
}

function packHold(fam, env, f) {
  const { N } = chainLayout(fam.L);
  const sp = fam.L / N;
  const ax = fam.axisBody;
  for (const sign of [1, -1]) {
    const first = f.nb;
    for (let k = 0; k < N; k++) {
      const d = sign * (R_SCENE + fam.L - (k + 0.5) * sp);
      _c[0] = ax[0] * d; _c[1] = ax[1] * d; _c[2] = ax[2] * d;
      qRotate(env.q, _c, _c);
      pushBead(f, _c, TONGUE_ROOT_R, unitInto(_c, _u), 0);
    }
    for (let k = 0; k + 1 < N; k++) pushNeck(f, first + k, first + k + 1, TONGUE_ROOT_R, 0, 0);
    const last = first + N - 1;
    _c[0] = f.bead[4 * last]; _c[1] = f.bead[4 * last + 1]; _c[2] = f.bead[4 * last + 2];
    pushNeck(f, last, -1, TONGUE_ROOT_R, 0, env.planetRadiusAt(unitInto(_c, _u)));
  }
}

function packFired(fam, env, f) {
  const B = fam.bodies;
  for (let i = 0; i < B.length; i++) {
    const b = B[i];
    f.map[i] = -1;
    if (b.state === 'gone' || b.r < 1e-6) continue;
    let s = 0;
    unitInto(b.p, _ax);
    if (b.state === 'free' || b.state === 'merging') {
      const wob = b.wobAmp * Math.cos(wobbleOmega(b.r) * b.wobT);
      const al = len(b.a);
      const fl = FLIGHT_STRETCH * (b.r / (fam.rMain || b.r)) ** 2 * Math.min(al / A_REF, 1);
      if (Math.abs(wob) >= fl) { _ax[0] = b.wobAxis[0]; _ax[1] = b.wobAxis[1]; _ax[2] = b.wobAxis[2]; s = wob; } else if (al > 0) { unitInto(b.a, _ax); s = fl; }
    }
    f.map[i] = pushBead(f, b.p, b.r, _ax, s);
  }
  for (const n of fam.necks) {
    if (!n.on) continue;
    const ia = f.map[n.a];
    if (ia < 0) continue;
    const h = pinchRadius(TONGUE_ROOT_R, fam.t, n.tSnap);
    if (n.b >= 0) {
      const ib = f.map[n.b];
      if (ib >= 0) pushNeck(f, ia, ib, h, NECK_ASYM, 0);
    } else {
      pushNeck(f, ia, -1, h, NECK_ASYM, env.planetRadiusAt(unitInto(B[n.a].p, _u)));
    }
  }
  for (let i = 0; i < B.length; i++) {
    const b = B[i], ia = f.map[i];
    if (ia < 0) continue;
    if (b.state === 'merging' && b.lead && b.bridgeB > 0) pushBridge(f, ia, f.map[b.partner], b.bridgeB, 0);
    if (b.state === 'cascade') {
      const R = env.planetRadiusAt(unitInto(b.p, _u));
      if (b.bridgeB > 0) pushBridge(f, ia, -1, b.bridgeB, R);
      if (b.neckH > 0) pushNeck(f, ia, -1, b.neckH, 0, R);
    }
  }
}

function fitRect(f, view) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, full = false;
  const e = view.vp;
  const grow = (cx, cy, cz, rad) => {
    const X = e[0] * cx + e[4] * cy + e[8] * cz + e[12];
    const Y = e[1] * cx + e[5] * cy + e[9] * cz + e[13];
    const W = e[3] * cx + e[7] * cy + e[11] * cz + e[15];
    if (W <= 1e-4) { full = true; return; }
    const rx = (rad * view.p00) / W, ry = (rad * view.p11) / W;
    x0 = Math.min(x0, X / W - rx); x1 = Math.max(x1, X / W + rx);
    y0 = Math.min(y0, Y / W - ry); y1 = Math.max(y1, Y / W + ry);
  };
  for (let i = 0; i < f.nb; i++) {
    grow(f.bead[4 * i], f.bead[4 * i + 1], f.bead[4 * i + 2], BOUND_BEAD * f.bead[4 * i + 3] * (1 + Math.abs(f.beadAxis[4 * i + 3])));
  }
  for (let i = 0; i < f.nn; i++) {
    const a = f.neck[4 * i], b = f.neck[4 * i + 1];
    const ax = f.bead[4 * a], ay = f.bead[4 * a + 1], az = f.bead[4 * a + 2];
    if (b >= 0) {
      grow((ax + f.bead[4 * b]) / 2, (ay + f.bead[4 * b + 1]) / 2, (az + f.bead[4 * b + 2]) / 2,
        0.5 * Math.hypot(ax - f.bead[4 * b], ay - f.bead[4 * b + 1], az - f.bead[4 * b + 2]) + Math.max(f.bead[4 * a + 3], f.bead[4 * b + 3]));
    } else {
      const l = Math.hypot(ax, ay, az) || 1, R = f.neckR[i];
      grow(ax / l * R, ay / l * R, az / l * R, 2 * f.neck[4 * i + 2] + f.bead[4 * a + 3]);
    }
  }
  for (let i = 0; i < f.nk; i++) {
    if (f.bridge[4 * i + 1] >= 0) continue;
    const a = f.bridge[4 * i];
    const ax = f.bead[4 * a], ay = f.bead[4 * a + 1], az = f.bead[4 * a + 2];
    const l = Math.hypot(ax, ay, az) || 1, R = f.bridge[4 * i + 3];
    grow(ax / l * R, ay / l * R, az / l * R, BOUND_BEAD * f.bead[4 * a + 3] + f.bridge[4 * i + 2]);
  }
  if (full) { x0 = -1; y0 = -1; x1 = 1; y1 = 1; }
  const px = (2 * DROP_PAD_PX) / view.wPx, py = (2 * DROP_PAD_PX) / view.hPx;
  x0 = Math.max(-1, x0 - px); y0 = Math.max(-1, y0 - py); x1 = Math.min(1, x1 + px); y1 = Math.min(1, y1 + py);
  if (!(x1 > x0 && y1 > y0)) { f.visible = false; return; }
  f.rect[0] = x0; f.rect[1] = y0; f.rect[2] = x1; f.rect[3] = y1;
  f.areaPx = ((x1 - x0) / 2) * view.wPx * ((y1 - y0) / 2) * view.hPx;
  f.visible = true;
}

export function packFamily(fam, env, f, view) {
  f.nb = 0; f.nn = 0; f.nk = 0; f.visible = false; f.areaPx = 0;
  if (fam.phase === 'hold' && fam.L > 1e-4) packHold(fam, env, f);
  else if (fam.phase === 'fired') packFired(fam, env, f);
  if (f.nb > 0) fitRect(f, view);
  return f;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/breakupFrame.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Lint and commit**

```bash
npx eslint src/terminal/mercury/planet/breakupFrame.js src/terminal/mercury/planet/__tests__/breakupFrame.test.js
git add src/terminal/mercury/planet/breakupFrame.js src/terminal/mercury/planet/__tests__/breakupFrame.test.js
git commit -m "feat(mercury): breakup frame packing - beads, pinching necks, bridges, screen rect

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Tier caps and the droplet SDF shader

**Files:**
- Modify: `src/terminal/mercury/planet/planetQuality.js` (the `TIERS` object)
- Modify: `src/terminal/mercury/planet/__tests__/planetQuality.test.js`
- Create: `src/terminal/mercury/planet/dropletShader.js`
- Test: `src/terminal/mercury/planet/__tests__/dropletShader.test.js`

**Interfaces:**
- Consumes: the `HG_*` chunks (Task 1), `BOUND_BEAD` (Task 7), `TIERS`.
- Produces:
  - `TIERS[t].drop = { bodies, necks, bridges, steps, satellites }`
  - `NECK_BLEND`, `NECK_SHOULDER`, `ROOT_FLARE`, `HIT_PX`, `DROPLET_OWN_UNIFORMS`, `DROPLET_UNIFORMS`, `DROPLET_VS`, `buildDropletShader({ tier }) → { vs, fs }`

- [ ] **Step 1: Write the failing tests**

Add to `planetQuality.test.js`, inside its `describe`:

```js
  it('droplet caps per tier (phase-5 spec §7.7)', () => {
    expect(TIERS.full.drop).toEqual({ bodies: 12, necks: 10, bridges: 12, steps: 48, satellites: true });
    expect(TIERS.phone.drop).toEqual({ bodies: 8, necks: 6, bridges: 8, steps: 32, satellites: true });
    expect(TIERS.lite.drop).toEqual({ bodies: 6, necks: 4, bridges: 6, steps: 24, satellites: false });
  });
```

Create `dropletShader.test.js`:

```js
// src/terminal/mercury/planet/__tests__/dropletShader.test.js
import { describe, it, expect } from 'vitest';
import { buildDropletShader, DROPLET_UNIFORMS, DROPLET_VS, NECK_BLEND } from '../dropletShader';
import { HG_MIRROR_DECLS_GLSL, HG_FRESNEL_GLSL, HG_ENV_GLSL } from '../hgMirrorGlsl';
import { TIERS, TIER_NAMES } from '../planetQuality';
import { BOUND_BEAD } from '../breakupFrame';
import { glf } from '../../../gl/glf';

describe('dropletShader — the family as one SDF impostor', () => {
  it('builds per tier with that tier\'s caps and march budget', () => {
    for (const t of TIER_NAMES) {
      const { fs, vs } = buildDropletShader({ tier: t });
      const d = TIERS[t].drop;
      expect(vs).toBe(DROPLET_VS);
      expect(fs).toContain(`uniform vec4 uBead[${d.bodies}];`);
      expect(fs).toContain(`uniform vec4 uNeck[${d.necks}];`);
      expect(fs).toContain(`uniform float uNeckR[${d.necks}];`);
      expect(fs).toContain(`uniform vec4 uBridge[${d.bridges}];`);
      expect(fs).toContain(`const int STEPS = ${d.steps};`);
    }
    expect(() => buildDropletShader({ tier: 'ultra' })).toThrow();
  });

  it('is the same quicksilver as the planet', () => {
    const { fs } = buildDropletShader();
    expect(fs).toContain(HG_MIRROR_DECLS_GLSL);
    expect(fs).toContain(HG_FRESNEL_GLSL);
    expect(fs).toContain(HG_ENV_GLSL);
    expect(fs).toContain('vec3 col = max(fresnelHg(NoV) * envRadiance(R, uRoughLiquid, p, n), 0.0);');
  });

  it('surface tension in the SDF: necks blend at their own radius; separate bodies use a hard min', () => {
    const { fs } = buildDropletShader();
    expect(fs).toContain(`const float NECK_BLEND = ${glf(NECK_BLEND)};`);
    expect(fs).toContain('float k = h * NECK_BLEND;');
    expect(fs).toContain('d = min(d, sdEll(p, uBead[i], uBeadAxis[i]));');
    // volume-preserving prolate ellipsoid: ra·rp² = r³
    expect(fs).toContain('float ra = b.w * (1.0 + ax.w);');
    expect(fs).toContain('float rp = b.w * inversesqrt(1.0 + ax.w);');
  });

  it('bounds match the CPU rect, the bare planet is left to the planet pass, depth is written', () => {
    const { fs } = buildDropletShader();
    expect(fs).toContain(`const float BOUND_BEAD = ${glf(BOUND_BEAD)};`);
    expect(fs).toContain('if (gPlanetOnly > 0.5) discard;');
    expect(fs).toContain('gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);');
  });

  it('declares every uniform it lists', () => {
    const { fs, vs } = buildDropletShader();
    for (const u of DROPLET_UNIFORMS) expect(fs + vs).toMatch(new RegExp(`uniform \\w+ ${u}[\\[;]`));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/planetQuality.test.js src/terminal/mercury/planet/__tests__/dropletShader.test.js`
Expected: FAIL (`TIERS.full.drop` undefined; `../dropletShader` unresolved).

- [ ] **Step 3: Add the caps to `TIERS`**

In `planetQuality.js`, append a `drop` field to each tier's `Object.freeze({...})`:
- full: `drop: Object.freeze({ bodies: 12, necks: 10, bridges: 12, steps: 48, satellites: true })`
- phone: `drop: Object.freeze({ bodies: 8, necks: 6, bridges: 8, steps: 32, satellites: true })` (starting point; set from the author's HUD)
- lite: `drop: Object.freeze({ bodies: 6, necks: 4, bridges: 6, steps: 24, satellites: false })`

Add one line to the header comment: `// drop: the phase-5 droplet field's caps (spec §7.7).`

- [ ] **Step 4: Create `dropletShader.js`**

```js
// src/terminal/mercury/planet/dropletShader.js — the breakup family as one raymarched SDF impostor (phase-5 spec §7).
// Beads are volume-preserving ellipsoids, necks asymmetric round cones, the planet a sphere at its live radius
// that enters only through roots and bridges. Shading is the planet's own mirror (hgMirrorGlsl).

import { glf } from '../../gl/glf';
import { TIERS } from './planetQuality';
import { BOUND_BEAD } from './breakupFrame';
import { HG_MIRROR_DECLS_GLSL, HG_FRESNEL_GLSL, HG_ENV_GLSL, HG_MIRROR_UNIFORMS } from './hgMirrorGlsl';

export const NECK_BLEND = 1;      // smooth-union radius across a neck, × the neck's own radius (surface tension)
export const NECK_SHOULDER = 0.6; // a neck cone ends inside its bead at this × the bead radius
export const ROOT_FLARE = 2;      // a root neck flares to this × its radius where it meets the planet
export const HIT_PX = 0.25;       // a march hit is within this fraction of a pixel

export const DROPLET_OWN_UNIFORMS = ['uRect', 'uBead', 'uBeadAxis', 'uNeck', 'uNeckR', 'uBridge', 'uCounts', 'uPxAngle', 'uTime'];
export const DROPLET_UNIFORMS = [...DROPLET_OWN_UNIFORMS, ...HG_MIRROR_UNIFORMS];

export const DROPLET_VS = /* glsl */ `in vec3 position;

uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform vec4 uRect;

out vec3 vFar;

void main() {
  // The quad covers only the family's screen rect (breakupFrame.fitRect); each corner's far point gives the ray.
  vec2 ndc = mix(uRect.xy, uRect.zw, position.xy * 0.5 + 0.5);
  vec4 f = inverse(projectionMatrix * viewMatrix) * vec4(ndc, 1.0, 1.0);
  vFar = f.xyz / f.w;
  gl_Position = vec4(ndc, 0.0, 1.0);
}
`;

export function buildDropletShader({ tier = 'full' } = {}) {
  const q = TIERS[tier];
  if (!q) throw new Error(`buildDropletShader: unknown tier "${tier}"`);
  const d = q.drop;
  const fs = /* glsl */ `precision highp float;

in vec3 vFar;
layout(location = 0) out vec4 fragColor;

uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 cameraPosition;
uniform vec4 uBead[${d.bodies}];
uniform vec4 uBeadAxis[${d.bodies}];
uniform vec4 uNeck[${d.necks}];
uniform float uNeckR[${d.necks}];
uniform vec4 uBridge[${d.bridges}];
uniform vec3 uCounts;
uniform float uPxAngle;
uniform float uTime;
${HG_MIRROR_DECLS_GLSL}

const int NB = ${d.bodies};
const int NN = ${d.necks};
const int NK = ${d.bridges};
const int STEPS = ${d.steps};
const float NECK_BLEND = ${glf(NECK_BLEND)};
const float NECK_SHOULDER = ${glf(NECK_SHOULDER)};
const float ROOT_FLARE = ${glf(ROOT_FLARE)};
const float BOUND_BEAD = ${glf(BOUND_BEAD)};
const float HIT_PX = ${glf(HIT_PX)};

${HG_FRESNEL_GLSL}

${HG_ENV_GLSL}

// A bead: a prolate (or oblate) ellipsoid of revolution about ax.xyz, stretch ax.w, volume kept (ra·rp² = r³).
// Inigo Quilez's bound for ellipsoids.
float sdEll(vec3 p, vec4 b, vec4 ax) {
  vec3 q = p - b.xyz;
  float pa = dot(q, ax.xyz);
  float pp = length(q - ax.xyz * pa);
  float ra = b.w * (1.0 + ax.w);
  float rp = b.w * inversesqrt(1.0 + ax.w);
  float k0 = length(vec2(pa / ra, pp / rp));
  float k1 = length(vec2(pa / (ra * ra), pp / (rp * rp)));
  return k1 > 1e-8 ? k0 * (k0 - 1.0) / k1 : -min(ra, rp);
}

// Exact round cone between spheres (a, r1) and (b, r2) (Inigo Quilez).
float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2) {
  vec3 ba = b - a;
  float l2 = dot(ba, ba);
  float rr = r1 - r2;
  float a2 = l2 - rr * rr;
  float il2 = 1.0 / l2;
  vec3 pa = p - a;
  float y = dot(pa, ba);
  float z = y - l2;
  vec3 xv = pa * l2 - ba * y;
  float x2 = dot(xv, xv);
  float y2 = y * y * l2;
  float z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

float smin(float a, float b, float k) {
  if (k <= 0.0) return min(a, b);
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

void neckEnds(int i, out vec3 a, out float ra, out vec3 b, out float rb) {
  vec4 n = uNeck[i];
  int ia = int(n.x);
  int ib = int(n.y);
  a = uBead[ia].xyz;
  ra = uBead[ia].w;
  if (ib < 0) { b = normalize(a) * uNeckR[i]; rb = n.z * ROOT_FLARE; }
  else { b = uBead[ib].xyz; rb = uBead[ib].w; }
}

float gPlanetOnly;

float map(vec3 p) {
  int nb = int(uCounts.x);
  int nn = int(uCounts.y);
  int nk = int(uCounts.z);
  float d = 1e9;
  gPlanetOnly = 0.0;
  for (int i = 0; i < NB; i++) {
    if (i >= nb) break;
    d = min(d, sdEll(p, uBead[i], uBeadAxis[i]));
  }
  // Necks: surface tension rounds a neck into its beads (smooth union, k = the neck's own radius).
  for (int i = 0; i < NN; i++) {
    if (i >= nn) break;
    vec4 n = uNeck[i];
    float h = n.z;
    if (h <= 0.0) continue;
    vec3 a, b;
    float ra, rb;
    neckEnds(i, a, ra, b, rb);
    vec3 w = mix(a, b, 0.5 + n.w);
    float dn = min(sdRoundCone(p, a, w, ra * NECK_SHOULDER, h), sdRoundCone(p, w, b, h, rb * NECK_SHOULDER));
    float k = h * NECK_BLEND;
    int ia = int(n.x);
    int ib = int(n.y);
    float pairA = smin(sdEll(p, uBead[ia], uBeadAxis[ia]), dn, k);
    float pair;
    bool planetOnly = false;
    if (ib < 0) {
      float dP = length(p) - uNeckR[i];
      pair = smin(pairA, dP, k);
      planetOnly = pairA - dP > k;
    } else {
      pair = smin(pairA, sdEll(p, uBead[ib], uBeadAxis[ib]), k);
    }
    if (pair < d) { d = pair; gPlanetOnly = planetOnly ? 1.0 : 0.0; }
  }
  // Bridges: a coalescence neck growing as √t (breakupPhysics.bridgeRadius) IS the blend radius.
  for (int i = 0; i < NK; i++) {
    if (i >= nk) break;
    vec4 br = uBridge[i];
    float k = br.z;
    if (k <= 0.0) continue;
    int ia = int(br.x);
    int ib = int(br.y);
    float da = sdEll(p, uBead[ia], uBeadAxis[ia]);
    float db = ib < 0 ? length(p) - br.w : sdEll(p, uBead[ib], uBeadAxis[ib]);
    float pair = smin(da, db, k);
    if (pair < d) { d = pair; gPlanetOnly = (ib < 0 && da - db > k) ? 1.0 : 0.0; }
  }
  return d;
}

vec3 calcNormal(vec3 p, float e) {
  const vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * map(p + k.xyy * e) + k.yyx * map(p + k.yyx * e) + k.yxy * map(p + k.yxy * e) + k.xxx * map(p + k.xxx * e));
}

void boundHit(vec3 ro, vec3 rd, vec3 c, float rad, inout float t0, inout float t1) {
  vec3 oc = ro - c;
  float b = dot(oc, rd);
  float disc = b * b - (dot(oc, oc) - rad * rad);
  if (disc <= 0.0) return;
  float s = sqrt(disc);
  t0 = min(t0, -b - s);
  t1 = max(t1, -b + s);
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vFar - ro);
  int nb = int(uCounts.x);
  int nn = int(uCounts.y);
  int nk = int(uCounts.z);

  // Per-ray bounds (the same rules as breakupFrame.fitRect): most of the rect costs a few dot products.
  float t0 = 1e9;
  float t1 = -1e9;
  for (int i = 0; i < NB; i++) {
    if (i >= nb) break;
    vec4 b = uBead[i];
    boundHit(ro, rd, b.xyz, BOUND_BEAD * b.w * (1.0 + abs(uBeadAxis[i].w)), t0, t1);
  }
  for (int i = 0; i < NN; i++) {
    if (i >= nn) break;
    vec3 a, b;
    float ra, rb;
    neckEnds(i, a, ra, b, rb);
    boundHit(ro, rd, 0.5 * (a + b), 0.5 * length(b - a) + max(ra, rb), t0, t1);
  }
  for (int i = 0; i < NK; i++) {
    if (i >= nk) break;
    vec4 br = uBridge[i];
    if (br.y >= 0.0) continue;
    vec4 a = uBead[int(br.x)];
    boundHit(ro, rd, normalize(a.xyz) * br.w, BOUND_BEAD * a.w + br.z, t0, t1);
  }
  if (t1 < t0) discard;

  float t = max(t0, 0.0);
  bool hit = false;
  float bestR = 1e9;
  float bestT = t;
  for (int i = 0; i < STEPS; i++) {
    float d = map(ro + rd * t);
    float px = t * uPxAngle;
    float r = d / px;
    if (r < bestR) { bestR = r; bestT = t; }
    if (d < HIT_PX * px) { hit = true; break; }
    t += d;
    if (t > t1) break;
  }
  // Silhouette AA: a near miss within a pixel still covers part of it (as the planet's edge does).
  float cov = hit ? 1.0 : clamp(1.0 - bestR, 0.0, 1.0);
  if (cov <= 0.0) discard;
  float tt = hit ? t : bestT;
  vec3 p = ro + rd * tt;
  map(p);
  if (gPlanetOnly > 0.5) discard; // bare planet: the planet pass draws it, with all its detail

  vec3 n = calcNormal(p, max(0.5 * tt * uPxAngle, 1e-5));
  float NoV = clamp(dot(n, -rd), 0.0, 1.0);
  vec3 R = reflect(rd, n);
  vec3 col = max(fresnelHg(NoV) * envRadiance(R, uRoughLiquid, p, n), 0.0);
  // The planet's output stage (mercuryPlanetShader main), so the two passes meet without a seam in tone.
  vec3 srgb = mix(col * 12.92, 1.055 * pow(col, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), col));
  float dith = (fract(sin(dot(gl_FragCoord.xy + fract(uTime) * 61.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  vec4 clip = projectionMatrix * viewMatrix * vec4(p, 1.0);
  gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);
  fragColor = vec4(srgb + dith, cov);
}
`;
  return { vs: DROPLET_VS, fs };
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/planetQuality.test.js src/terminal/mercury/planet/__tests__/dropletShader.test.js src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`
Expected: PASS. The planet parity snapshot is still unchanged.

- [ ] **Step 6: Lint and commit**

```bash
npx eslint src/terminal/mercury/planet/planetQuality.js src/terminal/mercury/planet/dropletShader.js src/terminal/mercury/planet/__tests__/planetQuality.test.js src/terminal/mercury/planet/__tests__/dropletShader.test.js
git add src/terminal/mercury/planet/planetQuality.js src/terminal/mercury/planet/dropletShader.js src/terminal/mercury/planet/__tests__/planetQuality.test.js src/terminal/mercury/planet/__tests__/dropletShader.test.js
git commit -m "feat(mercury): droplet SDF impostor shader + per-tier droplet caps

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Wire it into the planet (knobs, rig, HUD, field, frame loop)

**Files:**
- Create: `src/terminal/mercury/useDropletField.js`
- Modify: `src/terminal/mercury/planet/planetLook.js` (`PLANET_TUNE`)
- Modify: `src/terminal/mercury/mercuryTuning.js` (`DEV_OVERRIDES` and the rig)
- Modify: `src/terminal/mercury/planet/perfStats.js` (`PERF_INFO`)
- Modify: `src/terminal/mercury/MercuryPerfHud.jsx` (one HUD line)
- Modify: `src/terminal/mercury/MercuryPlanet.jsx`
- Create: `.superpowers/sdd/tools/breakSmoke.mjs`

**Interfaces:**
- Consumes: everything above.
- Produces (dev only):
  - `window.__mercuryDrop` (the `drop` state object, with `.fam` and `.frame`)
  - `__mercuryTune.dropTime(scale|null)`, `__mercuryTune.breakNow(omega = 12)`, `__mercuryTune.holdAt(omega|null)`
  - `PERF_INFO.dropPrims`, `dropAreaPx`, `sigma`

- [ ] **Step 1: Knobs**

In `planetLook.js`, append to `PLANET_TUNE`, after `meniscusW`:

```js
  breakOmega: 7.5,   // phase 5: breakup threshold, rad/s on screen (Σ ≈ 0.20 there; the true fission branch is ~11.5)
  breakGain: 1,      // tongue length at full excess, × TONGUE_MAX_R
  dropDrag: 8,       // aether drag γ on flying drops, 1/s (sets how far a fling travels)
  dropCohesion: 0.03, // bead–bead pull (units³/s² per DROP_V_REF of volume): how readily drops find each other
  dropDrift: 14,     // wished return time, s (capped by refreeze − MERGE_MARGIN_S; the pull is solved to meet it)
```

- [ ] **Step 2: Dev overrides and rig**

In `mercuryTuning.js`, change the overrides line and add three rig methods after `dateOverride`:

```js
// Dev-only overrides the frame loop reads (probes): a fixed instant for the ephemeris; the droplet
// family's clock scale (0 freezes it); a breakup fired on demand; a held tongue at a given ω.
export const DEV_OVERRIDES = { dateMs: null, dropTimeScale: null, breakNow: null, holdOmega: null };
```

```js
    // Phase 5 probes (need τ = 1): slow / freeze the droplet clock, fire a breakup, hold the tongues out.
    dropTime(scale) { DEV_OVERRIDES.dropTimeScale = scale ?? null; return `drop time × ${scale ?? 1}`; },
    breakNow(omega = 12) { DEV_OVERRIDES.breakNow = omega; return `break at ${omega} rad/s`; },
    holdAt(omega) { DEV_OVERRIDES.holdOmega = omega ?? null; return omega == null ? 'hold released' : `holding at ${omega} rad/s`; },
```

- [ ] **Step 3: HUD fields**

In `perfStats.js`: `export const PERF_INFO = { tau: 0, heatK: 0, coverage: 0, tailB: 0, vrKmS: 0, dropPrims: 0, dropAreaPx: 0, sigma: 0 };`

In `MercuryPerfHud.jsx`, after the `tail B` line in the array:

```js
        `drops ${PERF_INFO.dropPrims} prims  ${(PERF_INFO.dropAreaPx / 1000).toFixed(0)}k px²  Σ ${PERF_INFO.sigma.toFixed(2)}`,
```

- [ ] **Step 4: Create `useDropletField.js`**

```js
// useDropletField.js — the phase-5 droplet SDF pass (spec §7): its material, mesh ref and per-frame upload.
// MercuryPlanet calls upload() at the end of its own useFrame, after packFamily, so the field never
// lags the sim (a child's useFrame would run first). The mirror uniforms ARE the planet material's
// objects: one source of truth for the Sun, the elements and the aether.

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { buildDropletShader } from './planet/dropletShader';
import { HG_MIRROR_UNIFORMS } from './planet/hgMirrorGlsl';

export default function useDropletField({ tier, isMobile, planetMaterial, caps }) {
  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), []);
  const shader = useMemo(() => buildDropletShader({ tier }), [tier]);
  const material = useMemo(() => {
    const vec4s = (n) => Array.from({ length: n }, () => new THREE.Vector4());
    const uniforms = {
      uRect: { value: new THREE.Vector4(-1, -1, 1, 1) },
      uBead: { value: vec4s(caps.bodies) },
      uBeadAxis: { value: vec4s(caps.bodies) },
      uNeck: { value: vec4s(caps.necks) },
      uNeckR: { value: new Float32Array(caps.necks) },
      uBridge: { value: vec4s(caps.bridges) },
      uCounts: { value: new THREE.Vector3() },
      uPxAngle: { value: 1e-3 },
      uTime: { value: 0 },
    };
    for (const name of HG_MIRROR_UNIFORMS) uniforms[name] = planetMaterial.uniforms[name];
    return new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: shader.vs, fragmentShader: shader.fs, uniforms, alphaToCoverage: !isMobile,
    });
  }, [shader, planetMaterial, caps, isMobile]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const meshRef = useRef(null);

  const upload = (frame, tS) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.visible = frame.visible;
    if (!frame.visible) return;
    const u = material.uniforms;
    u.uRect.value.set(frame.rect[0], frame.rect[1], frame.rect[2], frame.rect[3]);
    for (let i = 0; i < frame.nb; i++) {
      u.uBead.value[i].fromArray(frame.bead, 4 * i);
      u.uBeadAxis.value[i].fromArray(frame.beadAxis, 4 * i);
    }
    for (let i = 0; i < frame.nn; i++) u.uNeck.value[i].fromArray(frame.neck, 4 * i);
    u.uNeckR.value.set(frame.neckR);
    for (let i = 0; i < frame.nk; i++) u.uBridge.value[i].fromArray(frame.bridge, 4 * i);
    u.uCounts.value.set(frame.nb, frame.nn, frame.nk);
    u.uPxAngle.value = frame.pxAngle;
    u.uTime.value = tS;
  };

  return { geometry, material, meshRef, upload };
}
```

- [ ] **Step 5: Wire `MercuryPlanet.jsx`**

5a. Imports (add):

```js
import { TIERS } from './planet/planetQuality';
import { shapeHeight } from './planet/mercuryWaves'; // add to the existing mercuryWaves import list instead
import {
  createFamily, canHold, canFire, breakExcess, tongueAxis, holdTongue, fireFamily, nextSnapIn, qRotateInv, DROP_V_REF,
} from './planet/breakupFamily';
import { TONGUE_MAX_R, sigmaRatio } from './planet/breakupPhysics';
import { stepFamily } from './planet/breakupStep';
import { muRef, returnTarget, createMuSolver, stepMuSolver, finishMuSolver, SOLVER_ITERS_PER_FRAME } from './planet/breakupBudget';
import { createDropFrame, packFamily, pxPerUnitAt, pxAngleOf } from './planet/breakupFrame';
import useDropletField from './useDropletField';
```

Add `shapeHeight` to the existing `from './planet/mercuryWaves'` import; don't import it twice. `TIERS` may already be imported alongside `impulseOrder`; extend that import.

5b. A module-level helper below `loadMap`:

```js
// Phase 5: release → a family, a provisional pull, and the budget solver (it lands before the first neck snaps).
function fireDrop(drop, omega, heatK) {
  const fam = drop.fam;
  fam.e = breakExcess(omega, drop.env.omegaTh);
  fireFamily(fam, { maxBodies: drop.frame.caps.bodies, satellites: drop.frame.caps.satellites });
  fam.mu = muRef(drop.env.omegaTh);
  drop.solver = createMuSolver(fam, drop.env, returnTarget(heatK, PLANET_TUNE.dropDrift));
}
```

5c. Inside the component, after `const bufferH = …`:

```js
  const bufferW = useThree((s) => s.size.width * s.viewport.dpr);
```

Add to the `surf` memo object: `dirsW: Array.from({ length: IMPULSE_SLOTS }, () => [0, 0, 1]),`

After the `surf` memo:

```js
  // Phase 5 state: the droplet family, its solver, the packed frame, the sim's view of the world.
  const drop = useMemo(() => {
    const d = {
      fam: createFamily(1), solver: null, frame: createDropFrame(TIERS[tier].drop), spinBody: [0, 0, 0],
      env: { q: [0, 0, 0, 1], omega: [0, 0, 0], gamma: 0, kappa: 0, vRef: DROP_V_REF, pxPerUnit: 1, omegaTh: 7.5, planetRadiusAt: null },
      view: { vp: new Float32Array(16), p00: 1, p11: 1, wPx: 1, hPx: 1 }, m: new THREE.Matrix4(),
    };
    // The planet's live surface (body modes + bulge) where a drop lands: the shader's shapeH, mirrored.
    d.env.planetRadiusAt = (dir) => R_SCENE * (1 + shapeHeight(dir, surf.dirsW, surf.frame.mode, surf.bulge));
    return d;
  }, [tier, surf]);
  const field = useDropletField({ tier, isMobile, planetMaterial: material, caps: TIERS[tier].drop });
  useEffect(() => { if (import.meta.env.DEV) window.__mercuryDrop = drop; }, [drop]);
```

5d. In the per-slot loop that writes `uImpDir`, record the world direction per **slot** (after `slipDirWorld(...)`):

```js
      surf.dirsW[i][0] = surf.w[0]; surf.dirsW[i][1] = surf.w[1]; surf.dirsW[i][2] = surf.w[2];
```

5e. Insert this block right after the line `u.uSurfOn.value = !calm && (surf.frame.any || …) ? 1 : 0;` and before `if (calm) {`:

```js
    // --- Phase 5: breakup (spec 2026-10-02) ---
    const fam = drop.fam;
    if (calm) {
      if (fam.phase !== 'idle') { Object.assign(fam, createFamily(fam.seed)); drop.solver = null; }
      drop.frame.visible = false;
    } else {
      const env = drop.env;
      env.q[0] = body.q.x; env.q[1] = body.q.y; env.q[2] = body.q.z; env.q[3] = body.q.w;
      env.omega[0] = body.omega.x; env.omega[1] = body.omega.y; env.omega[2] = body.omega.z;
      env.gamma = PLANET_TUNE.dropDrag;
      env.kappa = PLANET_TUNE.dropCohesion;
      env.omegaTh = PLANET_TUNE.breakOmega;
      env.pxPerUnit = pxPerUnitAt(camera.position.length(), camera.fov, bufferH);
      const dropDt = stepS * (DEV_OVERRIDES.dropTimeScale ?? 1);
      let omega = body.omega.length();
      let holding = dragging;
      if (DEV_OVERRIDES.holdOmega != null && fam.phase !== 'fired') { holding = true; omega = DEV_OVERRIDES.holdOmega; }
      if (DEV_OVERRIDES.breakNow != null) {
        const w = DEV_OVERRIDES.breakNow;
        DEV_OVERRIDES.breakNow = null;
        if (fam.phase !== 'fired' && body.tau >= 1) {
          // Dev rig: fire as if released at w rad/s about the current spin axis (world Y at rest).
          const l = Math.hypot(env.omega[0], env.omega[1], env.omega[2]);
          if (l > 1e-6) { env.omega[0] *= w / l; env.omega[1] *= w / l; env.omega[2] *= w / l; } else { env.omega[0] = 0; env.omega[1] = w; env.omega[2] = 0; }
          if (fam.phase === 'idle') {
            qRotateInv(env.q, env.omega, drop.spinBody);
            tongueAxis(drop.spinBody, null, fam.axisBody);
            fam.L = breakExcess(w, env.omegaTh) * PLANET_TUNE.breakGain * TONGUE_MAX_R;
          }
          fam.phase = 'hold';
          fireDrop(drop, w, body.heatK);
        }
      }
      if (fam.phase === 'idle' || fam.phase === 'hold') {
        const st = { tau: body.tau, omega, omegaTh: env.omegaTh, calm, phase: fam.phase };
        if (canFire({ ...st, released: ds.released, heatK: body.heatK })) {
          fireDrop(drop, omega, body.heatK);
        } else if (canHold({ ...st, dragging: holding })) {
          if (fam.phase === 'idle') {
            fam.phase = 'hold';
            qRotateInv(env.q, env.omega, drop.spinBody);
            tongueAxis(drop.spinBody, surf.hasDragDir ? surf.dragDirBody : null, fam.axisBody);
          }
          holdTongue(fam, dropDt, breakExcess(omega, env.omegaTh), PLANET_TUNE.breakGain);
        } else if (fam.phase === 'hold') {
          holdTongue(fam, dropDt, 0, PLANET_TUNE.breakGain);
          if (fam.L < 1e-4) { fam.L = 0; fam.phase = 'idle'; }
        }
      }
      if (fam.phase === 'fired') {
        const sv = drop.solver;
        if (sv && !sv.done) {
          stepMuSolver(sv, SOLVER_ITERS_PER_FRAME);
          if (!sv.done && nextSnapIn(fam) < 2 * dropDt) finishMuSolver(sv); // never let a drop fly on a provisional pull
          if (sv.done) fam.mu = sv.best;
        }
        stepFamily(fam, dropDt, env);
        for (const ev of fam.events) {
          worldToBody(ev.dir, body.q, surf.b);
          addImpulse(surf.impulses, { dirBody: surf.b, tS: t, mode: ev.mode, wave: ev.wave, kind: ev.kind });
        }
        fam.events.length = 0;
      }
      drop.m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      drop.view.vp.set(drop.m.elements);
      drop.view.p00 = camera.projectionMatrix.elements[0];
      drop.view.p11 = camera.projectionMatrix.elements[5];
      drop.view.wPx = bufferW;
      drop.view.hPx = bufferH;
      packFamily(fam, env, drop.frame, drop.view);
      drop.frame.pxAngle = pxAngleOf(camera.fov, bufferH);
      PERF_INFO.dropPrims = drop.frame.nb + drop.frame.nn + drop.frame.nk;
      PERF_INFO.dropAreaPx = drop.frame.areaPx;
      PERF_INFO.sigma = sigmaRatio(omega);
    }
    field.upload(drop.frame, t);
```

The `{ ...st, … }` spreads allocate a small object on the idle path. Hoist `st` into `surf` (`surf.dropSt`) and assign its fields in place if the allocation probe flags it. Hold paths are rare, so measure before optimising.

5f. Render the droplet mesh after the planet mesh:

```jsx
      <mesh geometry={geometry} material={material} frustumCulled={false} />
      <mesh ref={field.meshRef} geometry={field.geometry} material={field.material} frustumCulled={false} visible={false} />
      <MercuryExosphere exo={exo} tier={tier} />
```

- [ ] **Step 6: Unit suite plus lint**

Run: `npx vitest run src/terminal/mercury`
Expected: all pass. If `perfStats.test.js` pins `PERF_INFO`'s keys, add the three new keys to that pin.

Run: `npx eslint src/terminal/mercury/MercuryPlanet.jsx src/terminal/mercury/useDropletField.js src/terminal/mercury/mercuryTuning.js src/terminal/mercury/MercuryPerfHud.jsx src/terminal/mercury/planet/perfStats.js src/terminal/mercury/planet/planetLook.js`
Expected: 0 errors. The existing `react-refresh/only-export-components` warning at `MercuryPlanet.jsx:40` predates this work and is the only warning.

- [ ] **Step 7: Live smoke test**

Create `.superpowers/sdd/tools/breakSmoke.mjs`:

```js
// Phase 5 smoke: the droplet program compiles and runs, idle costs no draw call, a forced
// breakup flies and comes home before refreeze. node breakSmoke.mjs
import { openMercury, sleep } from './openMercury.mjs';
const { launch } = await import(new URL('file:///F:/scale_9.4/scripts/cdp.mjs'));
const page = await launch({ url: 'about:blank', width: 1600, height: 1000 });
const calls = () => page.eval(`new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res(window.__mercury.gl.info.render.calls))))`, { awaitPromise: true });
try {
  const m = await openMercury(page);
  const idle0 = await calls();
  await m.melt(25);
  await sleep(12000);
  console.log('state', JSON.stringify(await m.st()));
  const idle1 = await calls();
  console.log('draw calls idle before/after melt', idle0, idle1);
  await page.eval(`window.__mercuryTune.breakNow(12); 1`);
  let peak = 0, firedSeen = false, t0 = Date.now(), last = null;
  while (Date.now() - t0 < 45000) {
    last = await page.eval(`(() => { const f = window.__mercuryDrop.fam; return { phase: f.phase, t: +f.t.toFixed(2), n: f.bodies.filter((b) => b.state !== 'gone').length, prims: window.__mercuryPerf.dropPrims, mu: f.mu, volOut: f.volOut, resid: f.volResidual }; })()`);
    if (last.phase === 'fired') firedSeen = true;
    peak = Math.max(peak, last.prims);
    if (firedSeen && last.phase === 'idle') break;
    await sleep(250);
  }
  const during = firedSeen ? 'ok' : 'NEVER FIRED';
  console.log('fired:', during, 'peak prims', peak, 'end', JSON.stringify(last), 'secs', ((Date.now() - t0) / 1000).toFixed(1));
  console.log('draw calls idle after family', await calls());
  console.log('errors', JSON.stringify(await m.errors()));
} catch (e) { console.error('FAIL', e.message); } finally { await page.close(); process.exit(0); }
```

Run the dev server via `preview_start` with name `scale94-dev-5175`, unless :5175 already answers HTTP 200. Then run `node .superpowers/sdd/tools/breakSmoke.mjs`.

Expected:
- `fired: ok`
- `peak prims` > 0
- the end phase is `idle` with `|resid|` tiny
- `errors []` (the ANGLE `X3577 isnan/isinf` warnings are benign)
- idle draw calls after the family equal the idle draw calls before it

- [ ] **Step 8: Commit**

```bash
git add src/terminal/mercury/useDropletField.js src/terminal/mercury/MercuryPlanet.jsx src/terminal/mercury/mercuryTuning.js src/terminal/mercury/MercuryPerfHud.jsx src/terminal/mercury/planet/perfStats.js src/terminal/mercury/planet/planetLook.js .superpowers/sdd/tools/breakSmoke.mjs
git commit -m "feat(mercury): phase 5 breakup wired - hold, fire on release, solved return, droplet field, rig + HUD

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

If `.superpowers/sdd/tools/` is untracked in git (check with `git ls-files .superpowers/sdd/tools | head -1`), leave `breakSmoke.mjs` out of the `git add`.

---

### Task 10: Live look — timeline strip, zooms, seam (author checkpoint)

**Files:**
- Create: `.superpowers/sdd/tools/breakupLive.mjs`
- Output: `.superpowers/sdd/look/21-breakup-timeline.png`, `.superpowers/sdd/look/22-breakup-zoom2x.png`

- [ ] **Step 1: Write the probe**

```js
// Phase 5 live look: melt, hold the tongues out, fire a maximal breakup, and capture a labelled timeline
// at family events (the droplet clock is slowed so frames land), then 2× zooms of a pinching neck,
// a bridge and the planet seam. node breakupLive.mjs [tag] [omega]
import { openMercury, OUT, sleep } from './openMercury.mjs';
const { launch } = await import(new URL('file:///F:/scale_9.4/scripts/cdp.mjs'));
const { readFile } = await import('node:fs/promises');
const TAG = process.argv[2] ?? 'b1';
const OMEGA = Number(process.argv[3] ?? 12);
const page = await launch({ url: 'about:blank', width: 1600, height: 1000 });
const famState = `(() => { const f = window.__mercuryDrop.fam; const c = (s) => f.bodies.filter((b) => b.state === s).length;
  return { phase: f.phase, t: f.t, free: c('free'), merging: c('merging'), cascade: c('cascade'),
    stage: Math.max(0, ...f.bodies.filter((b) => b.state === 'cascade').map((b) => b.stage)), prims: window.__mercuryPerf.dropPrims }; })()`;
// Screen point of a world position (for the zoom crops).
const toScreen = (expr) => page.eval(`(() => { const s = window.__mercury; const p = ${expr}; if (!p) return null;
  const v = s.camera.position.clone().set(p[0], p[1], p[2]).project(s.camera); const r = s.gl.domElement.getBoundingClientRect();
  return [r.x + (v.x * 0.5 + 0.5) * r.width, r.y + (0.5 - v.y * 0.5) * r.height]; })()`);
try {
  const m = await openMercury(page);
  await m.melt(25);
  await sleep(12000);
  const files = [];
  const shot = async (label) => { const f = `${OUT}/brk-${TAG}-${files.length}.png`; await m.shot(f, 700); files.push([label, f]); console.log('shot', label); };
  await page.eval(`window.__mercuryTune.holdAt(${OMEGA}); 1`);
  await sleep(1500);
  await shot(`hold ω${OMEGA}`);
  await page.eval(`window.__mercuryTune.holdAt(null); window.__mercuryTune.dropTime(0.25); window.__mercuryTune.breakNow(${OMEGA}); 1`);
  const want = [
    ['tip snapped', (s) => s.free >= 1],
    ['chain snapping', (s) => s.free >= 3],
    ['flight', (s) => s.t > 2.5 && s.free >= 2],
    ['bridge', (s) => s.merging > 0],
    ['cascade', (s) => s.cascade > 0 && s.stage >= 1],
    ['rest', (s) => s.phase === 'idle'],
  ];
  let wi = 0, zoomNeck = null, zoomBridge = null;
  const t0 = Date.now();
  while (wi < want.length && Date.now() - t0 < 240000) {
    const s = await page.eval(famState);
    if (!zoomNeck && s.free >= 1 && s.free < 3) {
      zoomNeck = await toScreen(`(() => { const f = window.__mercuryDrop.fam; const n = f.necks.find((x) => x.on && x.b >= 0); return n ? f.bodies[n.a].p.map((c, i) => (c + f.bodies[n.b].p[i]) / 2) : null; })()`);
      if (zoomNeck) { await page.screenshot({ path: `${OUT}/brk-${TAG}-zneck.png`, clip: { x: zoomNeck[0] - 70, y: zoomNeck[1] - 70, width: 140, height: 140, scale: 2 } }); }
    }
    if (!zoomBridge && s.merging > 0) {
      zoomBridge = await toScreen(`(() => { const b = window.__mercuryDrop.fam.bodies.find((x) => x.state === 'merging' && x.lead); return b ? b.mergeC : null; })()`);
      if (zoomBridge) { await page.screenshot({ path: `${OUT}/brk-${TAG}-zbridge.png`, clip: { x: zoomBridge[0] - 70, y: zoomBridge[1] - 70, width: 140, height: 140, scale: 2 } }); }
    }
    if (want[wi][1](s)) { await shot(`${want[wi][0]} t=${s.t.toFixed(2)} prims=${s.prims}`); wi++; }
    await sleep(50);
  }
  console.log('reached', wi, 'of', want.length, 'in', ((Date.now() - t0) / 1000).toFixed(0), 's');
  const tiles = await Promise.all(files.map(async ([l, f]) => [l, 'data:image/png;base64,' + (await readFile(f)).toString('base64')]));
  const cols = 4, rows = Math.ceil(tiles.length / cols), T = 420;
  await page.setViewport(cols * T, rows * (T + 28));
  await page.eval(`(() => { document.documentElement.innerHTML = '<body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(${cols},${T}px);font:14px monospace;color:#ddd"></body>';
    for (const [l, s] of ${JSON.stringify(tiles)}) { const d = document.createElement('div'); d.innerHTML = '<div style="height:28px;line-height:28px;padding-left:8px">' + l + '</div><img src="' + s + '" style="width:${T}px;height:${T}px;display:block">'; document.body.appendChild(d); } return 1; })()`);
  await sleep(800);
  await page.screenshot({ path: `${OUT}/sheet-brk-${TAG}.png` });
  console.log('sheet', `${OUT}/sheet-brk-${TAG}.png`);
  console.log('errors', JSON.stringify(await m.errors()));
} catch (e) { console.error('FAIL', e.message); } finally { await page.close(); process.exit(0); }
```

- [ ] **Step 2: Run it and LOOK at the outputs before claiming anything**

Run: `node .superpowers/sdd/tools/breakupLive.mjs b1 12`

Open `out/sheet-brk-b1.png`, `out/brk-b1-zneck.png` and `out/brk-b1-zbridge.png` with the Read tool. Check each against the spec, and write down what you *see*, not what the code intends:
- **Hold:** two opposed tongues with the meniscus quality of the planet (mirror, not flat grey).
- **Snap:** visible necking, tip first. Neck asymmetry is visible at 2×.
- **Flight:** the beads stay on screen. If they leave the frame, note how far.
- **Bridge:** it opens fast, then slows. No crease.
- **Cascade:** a daughter hops and each touchdown rings the planet.
- **Seam:** no double-draw ring or depth fighting where a root or bridge meets the planet.
- **Rest:** the field is gone.

- [ ] **Step 3: Copy the sheets into the look log**

```bash
cp .superpowers/sdd/tools/out/sheet-brk-b1.png .superpowers/sdd/look/21-breakup-timeline.png
cp .superpowers/sdd/tools/out/brk-b1-zneck.png .superpowers/sdd/look/22-breakup-zoom-neck.png
cp .superpowers/sdd/tools/out/brk-b1-zbridge.png .superpowers/sdd/look/23-breakup-zoom-bridge.png
```

- [ ] **Step 4: AUTHOR CHECKPOINT**

Send the sheets to the author with the observations from Step 2. Open look calls to put to them:
- `breakOmega` (7.5)
- `dropDrag` (excursion)
- `dropCohesion` (do beads find each other before landing?)
- `dropDrift` (14 s)
- `DROP_TC_ANCHOR_S` (0.4 s pace)
- `NECK_ASYM` (0.2) direction

Tune live via `__mercuryTune.planet` and `__mercuryTune.dropTime`. Commit the constants the author chooses as `tune(mercury): …` commits, one knob per commit, with the sheet that justified each.

---

### Task 11: Phone check (author)

- [ ] **Step 1:** The author opens `/mercury?perf=1` on their phone, melts the planet, flicks hard and releases.
- [ ] **Step 2:** The author reports the HUD p50 frame time during a maximal breakup against idle, with a screenshot. **Pass:** ≤ 1.5 ms added, still 120 fps (spec §7.8).
- [ ] **Step 3:** On a miss, lower `TIERS.phone.drop.steps` first (32 → 24), then `bodies`/`necks`. Commit each change with the HUD numbers in the message, and update the `planetQuality.test.js` pin to match.
- [ ] **Step 4:** Update `.superpowers/sdd/progress.md` and the memory file `project_mercury_meniscus.md` (Phase 5 state). **No push** without the author's command.

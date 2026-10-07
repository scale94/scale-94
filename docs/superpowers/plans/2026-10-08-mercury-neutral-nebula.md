# Mercury Neutral Nebula Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the resting liquid-mercury mirror a colourless baked nebula environment, behind a live switch beside the
existing studio sky (`PLANET_TUNE.neutralNebula`: 0 studio, 1 nebula, between = mix).

**Architecture:** An analytic generator (`skyNebulaGen`, GLSL, bake-time only) is rendered once at mount into a
half-float mipmapped cube render target. The shared mirror chunk (`aetherSky` → `skyNeutral`) samples it with one
`textureLod`, rotated by a CPU-built `mat3` on the calm-gated sky clock, and mixes it with the untouched studio by a
uniform. The four mirror shaders get the new uniforms through `HG_MIRROR_UNIFORMS` (shared by reference).

**Tech Stack:** three r183 (`WebGLCubeRenderTarget`, `CubeCamera`, `RawShaderMaterial` GLSL3), @react-three/fiber 9,
vitest (`npm test`), CDP probe tools in `.superpowers/sdd/tools/` (dev server `http://localhost:5175`).

Spec: `docs/superpowers/specs/2026-10-08-mercury-neutral-nebula-design.md`.

## Global Constraints

- Branch `feature/mercury-stage`, commit per task, **never push** (author pushes on explicit command only).
- `neutralNebula` default **0** (studio); with it at 0 the studio's rendered output is unchanged.
- Colourless: the nebula is `vec3(L)`; hue enters only through an element sky (`uSkyW`).
- `fresnelHg`, `ROUGH_LIQUID` (0.14), `AETHER_SHOULDER`, element skies: **not touched**.
- No per-fragment noise for the nebula in the frame loop: one `textureLod` per mirror fragment.
- No half-float render target → no bake, `uNeutralNebula` forced to 0, one `console.warn`.
- GLSL names in shared chunks are collision-safe (`sky*` / `neb*` / `NEBULA_*` prefixes).
- Constants live in the JS module that owns them and reach GLSL via `glf` / `v3` (`src/terminal/gl/glf.js`).
- Histogram gates (spec §3, solid-angle weighted, linear): share < 0.005 **≥ 0.50**; share in [0.02, 0.15] **0.25–0.45**;
  share > 1 **0.001–0.006**; mean **0.020–0.035**; peak / median **≥ 300**.
- Deviation from spec §2, agreed here: **no `NEBULA_TILT`** — the drift is about world +Y like the studio, and the
  view axis is +Z, so a tilt adds nothing (YAGNI). The spec was amended with this plan.

## File Structure

| file | responsibility |
|---|---|
| `src/terminal/mercury/planet/aetherSky.js` (modify) | export `SKY_NOISE_GLSL` (extracted, byte-identical); studio body → `skyStudio`; new `skyNeutral(R, k)` mix; `SKY_MEAN.nebula`; `NEBULA_MAX_LOD` |
| `src/terminal/mercury/planet/nebulaSky.js` (create) | generator constants, `NEBULA_GEN_GLSL`, bake shaders `NEBULA_BAKE_VS/FS`, `nebulaRotation(t)` (pure) |
| `src/terminal/mercury/nebulaBake.js` (create) | three-side: `canBakeNebula(gl)`, `bakeNebula(gl) → { texture, dispose }` |
| `src/terminal/mercury/planet/hgMirrorGlsl.js` (modify) | 3 new shared uniforms + decls |
| `src/terminal/mercury/planet/mercuryPlanetShader.js` (modify) | planet declares + lists the 3 uniforms |
| `src/terminal/mercury/planet/planetLook.js` (modify) | `PLANET_TUNE.neutralNebula: 0` |
| `src/terminal/mercury/MercuryPlanet.jsx` (modify) | uniforms, bake at mount (layout effect), per-frame switch + rotation upload |
| tests in `src/terminal/mercury/planet/__tests__/` | `aetherSky.test.js`, `nebulaSky.test.js` (create), `hgMirrorGlsl.test.js`, snapshots |
| `.superpowers/sdd/tools/ms-mean.mjs` (modify) | declare the new uniforms so `AETHER_SKY_GLSL` still compiles standalone |
| `.superpowers/sdd/tools/nebula-hist.mjs` (create) | histogram + mean of the generator |
| `.superpowers/sdd/tools/neutral-nebula-sheet.mjs` (create) | live look sheet studio / mix / nebula |

---

### Task 1: Extract the shared sky noise (no behaviour change)

The bake shader needs the same value noise and fBm as the mirror. Extract it once so both read one string.

**Files:**
- Modify: `src/terminal/mercury/planet/aetherSky.js`
- Test: `src/terminal/mercury/planet/__tests__/aetherSky.test.js`

**Interfaces:**
- Produces: `export const SKY_NOISE_GLSL: string` — defines `skyHash(vec3)`, `skyNoise(vec3)`, `skyFbm(vec3, float nOct)`;
  requires `const int SKY_OCTAVES` declared before it.

- [ ] **Step 1: Write the failing test** — append inside `describe('aetherSky', …)` in `aetherSky.test.js`, and add
  `SKY_NOISE_GLSL` to the import list from `'../aetherSky'`:

```js
  it('the sky noise is one shared chunk (the nebula bake reuses it verbatim)', () => {
    expect(SKY_NOISE_GLSL).toContain('float skyHash(vec3 p) {');
    expect(SKY_NOISE_GLSL).toContain('float skyNoise(vec3 x) {');
    expect(SKY_NOISE_GLSL).toContain('float skyFbm(vec3 p, float nOct) {');
    expect(AETHER_SKY_GLSL).toContain(SKY_NOISE_GLSL);
    expect(AETHER_SKY_GLSL.split('float skyHash(').length).toBe(2); // defined once
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/aetherSky.test.js`
Expected: FAIL — `SKY_NOISE_GLSL` is undefined (`expected undefined to contain …`).

- [ ] **Step 3: Implement** — in `aetherSky.js`, cut the text from `float skyHash(vec3 p)` through the closing `}` of
  `skyFbm` (the 22 lines between `const vec3 SKY_MEAN_NEUTRAL = …;` + blank line and `vec3 skyRotZ(`) into a new export
  placed **above** `export const AETHER_SKY_GLSL`, and interpolate it back at the same spot. The text must be
  character-identical, including the two comment lines above `skyFbm`:

```js
// Value noise + fBm on an octave budget, shared by the mirror sky and the neutral-nebula bake (nebulaSky.js).
// Needs `const int SKY_OCTAVES` declared before it.
export const SKY_NOISE_GLSL = /* glsl */ `float skyHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float skyNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(skyHash(i), skyHash(i + vec3(1, 0, 0)), f.x), mix(skyHash(i + vec3(0, 1, 0)), skyHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(skyHash(i + vec3(0, 0, 1)), skyHash(i + vec3(1, 0, 1)), f.x), mix(skyHash(i + vec3(0, 1, 1)), skyHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
// fBm on an octave budget nOct (float): octaves past it contribute their mean, so a rougher mirror keeps the
// same brightness with less detail.
float skyFbm(vec3 p, float nOct) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < SKY_OCTAVES; i++) {
    float w = clamp(nOct - float(i), 0.0, 1.0);
    s += a * (w > 0.0 ? mix(0.5, skyNoise(p), w) : 0.5);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}`;
```

  and inside `AETHER_SKY_GLSL`, where those lines were:

```js
const vec3 SKY_MEAN_NEUTRAL = ${v3(SKY_MEAN.neutral)};

${SKY_NOISE_GLSL}
vec3 skyRotZ(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(c * v.x - s * v.y, s * v.x + c * v.y, v.z); }
```

- [ ] **Step 4: Run the whole suite — snapshots must NOT change**

Run: `npx vitest run src/terminal/mercury`
Expected: PASS, including `planetShader.full.fs.glsl` / `pre-slow-noon` / `pre-visitors` file snapshots untouched
(`git status --short src/terminal/mercury/planet/__tests__/__snapshots__` prints nothing). If a snapshot fails, the
extraction is not byte-identical — fix the string, never re-pin here.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/planet/aetherSky.js src/terminal/mercury/planet/__tests__/aetherSky.test.js
git commit -m "refactor(mercury): neutral nebula T1 — sky noise extracted as SKY_NOISE_GLSL (byte-identical, snapshots unchanged)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Nebula generator, bake, and rotation

**Files:**
- Create: `src/terminal/mercury/planet/nebulaSky.js`
- Create: `src/terminal/mercury/nebulaBake.js`
- Create: `src/terminal/mercury/planet/__tests__/nebulaSky.test.js`

**Interfaces:**
- Consumes: `SKY_NOISE_GLSL` (Task 1), `NEUTRAL_SKY_DRIFT` (aetherSky.js, 0.02).
- Produces (nebulaSky.js): `NEBULA_FACE = 256`, `NEBULA_GEN_GLSL` (defines `vec3 skyNebulaGen(vec3 D)`),
  `NEBULA_BAKE_VS`, `NEBULA_BAKE_FS`, `nebulaRotation(t: number): number[9]` (row-major, for `THREE.Matrix3.set(...)`),
  all `NEBULA_*` constants.
- Produces (nebulaBake.js): `canBakeNebula(renderer: THREE.WebGLRenderer): boolean`,
  `bakeNebula(renderer): { texture: THREE.CubeTexture, dispose(): void }`.

- [ ] **Step 1: Write the failing tests** — `src/terminal/mercury/planet/__tests__/nebulaSky.test.js`:

```js
// Neutral nebula (spec 2026-10-08): bake-time generator + the rigid drift rotation.
import { describe, it, expect } from 'vitest';
import { glf } from '../../../gl/glf';
import {
  NEBULA_FACE, NEBULA_GEN_GLSL, NEBULA_BAKE_VS, NEBULA_BAKE_FS, nebulaRotation,
  NEBULA_FLOOR, NEBULA_VOID_SCALE, NEBULA_VOID_LO, NEBULA_VOID_HI, NEBULA_WISP_SCALE, NEBULA_WISP_WARP,
  NEBULA_WISP_POW, NEBULA_WISP_BASE, NEBULA_WISP_GAIN, NEBULA_STAR_CELLS, NEBULA_STAR_RATE, NEBULA_STAR_SIGMA,
  NEBULA_STAR_MIN, NEBULA_STAR_MAX, NEBULA_HALO_W, NEBULA_HALO_GAIN,
} from '../nebulaSky';
import { SKY_NOISE_GLSL, NEUTRAL_SKY_DRIFT } from '../aetherSky';

const apply = (m, v) => [0, 1, 2].map((r) => m[3 * r] * v[0] + m[3 * r + 1] * v[1] + m[3 * r + 2] * v[2]);

describe('nebulaSky', () => {
  it('every constant reaches the generator', () => {
    for (const [n, v] of Object.entries({ NEBULA_FLOOR, NEBULA_VOID_SCALE, NEBULA_VOID_LO, NEBULA_VOID_HI,
      NEBULA_WISP_SCALE, NEBULA_WISP_WARP, NEBULA_WISP_POW, NEBULA_WISP_BASE, NEBULA_WISP_GAIN, NEBULA_STAR_CELLS,
      NEBULA_STAR_RATE, NEBULA_STAR_SIGMA, NEBULA_STAR_MIN, NEBULA_STAR_MAX, NEBULA_HALO_W, NEBULA_HALO_GAIN })) {
      expect(NEBULA_GEN_GLSL).toContain(`const float ${n} = ${glf(v)};`);
    }
  });

  it('colourless, built on the shared sky noise, full octaves', () => {
    expect(NEBULA_GEN_GLSL).toContain(SKY_NOISE_GLSL);
    expect(NEBULA_GEN_GLSL).toContain('const int SKY_OCTAVES = 5;');
    expect(NEBULA_GEN_GLSL).toContain('vec3 skyNebulaGen(vec3 D) {');
    expect(NEBULA_GEN_GLSL).toContain('return vec3(L);');
    expect(NEBULA_GEN_GLSL).not.toMatch(/uniform/); // bake-time pure function of direction
  });

  it('stars: sparse, sharp cores reaching the shoulder; 27-cell neighbourhood so halos never clip', () => {
    expect(NEBULA_STAR_RATE).toBeGreaterThan(0.99);
    expect(NEBULA_STAR_MIN).toBeGreaterThanOrEqual(3);
    expect(NEBULA_STAR_MAX).toBeLessThanOrEqual(8);
    const texel = (Math.PI / 2) / NEBULA_FACE;
    expect(NEBULA_STAR_SIGMA / texel).toBeGreaterThan(1.2);
    expect(NEBULA_STAR_SIGMA / texel).toBeLessThan(2.5);
    expect(NEBULA_GEN_GLSL).toContain('for (int dz = -1; dz <= 1; dz++)');
  });

  it('void floor darker than the studio floor (obsidian pockets)', () => {
    expect(NEBULA_FLOOR).toBeLessThan(0.004);
  });

  it('bake shaders: direction from the unit sphere, generator output', () => {
    expect(NEBULA_BAKE_VS).toContain('vDir = position;');
    expect(NEBULA_BAKE_FS).toContain(NEBULA_GEN_GLSL);
    expect(NEBULA_BAKE_FS).toContain('o = vec4(skyNebulaGen(normalize(vDir)), 1.0);');
  });

  it('nebulaRotation: orthonormal, identity at t 0, drifts like the studio (az - NEUTRAL_SKY_DRIFT · t)', () => {
    const I = nebulaRotation(0);
    expect(I.map((x) => +x.toFixed(12) + 0)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const t = 13.7, m = nebulaRotation(t);
    const R = apply(m, [1, 0, 0]);
    expect(Math.atan2(R[2], R[0])).toBeCloseTo(-NEUTRAL_SKY_DRIFT * t, 10);
    expect(apply(m, [0, 1, 0])).toEqual([0, 1, 0]);
    for (const v of [[1, 0, 0], [0, 0, 1], [0.3, -0.5, 0.81]]) {
      const a = apply(m, v);
      expect(Math.hypot(...a)).toBeCloseTo(Math.hypot(...v), 12);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/nebulaSky.test.js`
Expected: FAIL — `Failed to resolve import "../nebulaSky"`.

- [ ] **Step 3: Implement `src/terminal/mercury/planet/nebulaSky.js`**

```js
// src/terminal/mercury/planet/nebulaSky.js — the neutral nebula (spec 2026-10-08-mercury-neutral-nebula-design.md).
//
// What the resting mirror sees when PLANET_TUNE.neutralNebula is up: a colourless deep-space field, specified by its
// luminance histogram (a mirror of an even sky reads matte; of a mostly black one, black glass). Three layers:
//   void   — low-frequency fBm through a smoothstep: the density mask m; outside it, obsidian (NEBULA_FLOOR);
//   wisps  — ridged, domain-warped fBm inside m: the gunmetal band;
//   stars  — sparse Gaussian cores bright enough to reach the shoulder (white), each with a faint halo.
// skyNebulaGen runs at BAKE time only (nebulaBake.js renders it into a mipmapped half-float cube map); the frame loop
// pays one textureLod (aetherSky.skyNeutral). Starting values; tuned against .superpowers/sdd/tools/nebula-hist.mjs.

import { glf } from '../../gl/glf';
import { SKY_NOISE_GLSL, SKY_OCTAVES, NEUTRAL_SKY_DRIFT } from './aetherSky';

export const NEBULA_FACE = 256;          // cube face size (px); 512 is the open author call if cores read soft
export const NEBULA_FLOOR = 0.002;       // void radiance (studio floor is 0.004)
export const NEBULA_VOID_SCALE = 1.3;    // void mask frequency (direction units)
export const NEBULA_VOID_LO = 0.5;       // mask smoothstep: fBm below → void
export const NEBULA_VOID_HI = 0.68;      // fBm above → full density
export const NEBULA_WISP_SCALE = 3;      // wisp frequency
export const NEBULA_WISP_WARP = 1.2;     // domain-warp amplitude
export const NEBULA_WISP_POW = 6;        // ridge sharpness (edges are what read as a mirror)
export const NEBULA_WISP_BASE = 0.02;    // dense-but-off-ridge radiance
export const NEBULA_WISP_GAIN = 0.13;    // ridge radiance on top of the base
export const NEBULA_STAR_CELLS = 40;     // star lattice cells per direction unit
export const NEBULA_STAR_RATE = 0.997;   // hash above this lights a cell (~100 stars on the sphere)
export const NEBULA_STAR_SIGMA = 0.009;  // core Gaussian width (rad) ≈ 1.5 texels at NEBULA_FACE 256
export const NEBULA_STAR_MIN = 3;        // core peak range: into AETHER_SHOULDER, so the cores read white
export const NEBULA_STAR_MAX = 8;
export const NEBULA_HALO_W = 6;          // halo width × sigma
export const NEBULA_HALO_GAIN = 0.02;    // halo peak × core peak

export const NEBULA_GEN_GLSL = /* glsl */ `// ── neutral nebula generator (nebulaSky.js), bake-time only ──
const int SKY_OCTAVES = ${SKY_OCTAVES};
const float NEBULA_FLOOR = ${glf(NEBULA_FLOOR)};
const float NEBULA_VOID_SCALE = ${glf(NEBULA_VOID_SCALE)};
const float NEBULA_VOID_LO = ${glf(NEBULA_VOID_LO)};
const float NEBULA_VOID_HI = ${glf(NEBULA_VOID_HI)};
const float NEBULA_WISP_SCALE = ${glf(NEBULA_WISP_SCALE)};
const float NEBULA_WISP_WARP = ${glf(NEBULA_WISP_WARP)};
const float NEBULA_WISP_POW = ${glf(NEBULA_WISP_POW)};
const float NEBULA_WISP_BASE = ${glf(NEBULA_WISP_BASE)};
const float NEBULA_WISP_GAIN = ${glf(NEBULA_WISP_GAIN)};
const float NEBULA_STAR_CELLS = ${glf(NEBULA_STAR_CELLS)};
const float NEBULA_STAR_RATE = ${glf(NEBULA_STAR_RATE)};
const float NEBULA_STAR_SIGMA = ${glf(NEBULA_STAR_SIGMA)};
const float NEBULA_STAR_MIN = ${glf(NEBULA_STAR_MIN)};
const float NEBULA_STAR_MAX = ${glf(NEBULA_STAR_MAX)};
const float NEBULA_HALO_W = ${glf(NEBULA_HALO_W)};
const float NEBULA_HALO_GAIN = ${glf(NEBULA_HALO_GAIN)};

${SKY_NOISE_GLSL}

// Stars on a 3D lattice around the unit sphere; the 27-cell neighbourhood keeps halos (wider than a cell) whole.
float nebStars(vec3 D) {
  vec3 g = D * NEBULA_STAR_CELLS;
  vec3 gi = floor(g);
  float s = 0.0;
  for (int dz = -1; dz <= 1; dz++)
  for (int dy = -1; dy <= 1; dy++)
  for (int dx = -1; dx <= 1; dx++) {
    vec3 c = gi + vec3(float(dx), float(dy), float(dz));
    float h = skyHash(c);
    if (h <= NEBULA_STAR_RATE) continue;
    vec3 j = vec3(skyHash(c + 17.0), skyHash(c + 41.0), skyHash(c + 73.0)) - 0.5;
    vec3 sd = normalize(c + 0.5 + 0.8 * j);
    float d = length(D - sd); // chord ≈ angle at these sizes
    float peak = mix(NEBULA_STAR_MIN, NEBULA_STAR_MAX, skyHash(c + 101.0));
    float core = exp(-(d * d) / (NEBULA_STAR_SIGMA * NEBULA_STAR_SIGMA));
    float hw = NEBULA_STAR_SIGMA * NEBULA_HALO_W;
    float halo = NEBULA_HALO_GAIN * exp(-(d * d) / (hw * hw));
    s += peak * (core + halo);
  }
  return s;
}

vec3 skyNebulaGen(vec3 D) {
  float m = smoothstep(NEBULA_VOID_LO, NEBULA_VOID_HI, skyFbm(D * NEBULA_VOID_SCALE + vec3(3.1, 7.4, 1.9), 3.0));
  vec3 q = D * NEBULA_WISP_SCALE;
  vec3 w = vec3(skyFbm(q + vec3(0.0, 0.0, 0.0), 3.0), skyFbm(q + vec3(5.2, 1.3, 2.8), 3.0), skyFbm(q + vec3(2.1, 7.7, 4.4), 3.0));
  float n = skyFbm(q + NEBULA_WISP_WARP * 2.0 * (w - 0.5), 4.0);
  float ridge = pow(1.0 - abs(n * 2.0 - 1.0), NEBULA_WISP_POW);
  float L = mix(NEBULA_FLOOR, NEBULA_WISP_BASE + NEBULA_WISP_GAIN * ridge, m);
  L += nebStars(D) * (0.3 + 0.7 * m);
  return vec3(L);
}`;

// Bake pass: a BackSide unit sphere at the cube camera's origin; the direction is the object-space position.
export const NEBULA_BAKE_VS = /* glsl */ `precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
in vec3 position;
out vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const NEBULA_BAKE_FS = /* glsl */ `precision highp float;
in vec3 vDir;
out vec4 o;
${NEBULA_GEN_GLSL}
void main() {
  o = vec4(skyNebulaGen(normalize(vDir)), 1.0);
}`;

// The lookup rotation for the frame loop (row-major, for THREE.Matrix3.set): a rigid turn about world +Y that samples
// the baked sky at az - NEUTRAL_SKY_DRIFT · t, the studio's drift. t is the calm-gated sky clock (calm freezes it).
export function nebulaRotation(t) {
  const th = NEUTRAL_SKY_DRIFT * t;
  const c = Math.cos(th), s = Math.sin(th);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/nebulaSky.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Implement `src/terminal/mercury/nebulaBake.js`** (three-side; verified live in Task 3)

```js
// src/terminal/mercury/nebulaBake.js — renders the neutral nebula generator (planet/nebulaSky.js) once into a
// half-float, mipmapped cube map. The mips are what a rougher mirror samples (aetherSky.skyNeutral, NEBULA_MAX_LOD).
import * as THREE from 'three';
import { NEBULA_FACE, NEBULA_BAKE_VS, NEBULA_BAKE_FS } from './planet/nebulaSky';

// A half-float colour attachment needs one of these on WebGL2; without it the switch stays on the studio.
export function canBakeNebula(renderer) {
  const ctx = renderer.getContext();
  return !!(ctx.getExtension('EXT_color_buffer_half_float') || ctx.getExtension('EXT_color_buffer_float'));
}

export function bakeNebula(renderer) {
  const rt = new THREE.WebGLCubeRenderTarget(NEBULA_FACE, {
    type: THREE.HalfFloatType,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
  });
  const geo = new THREE.SphereGeometry(1, 64, 32);
  const mat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: NEBULA_BAKE_VS, fragmentShader: NEBULA_BAKE_FS,
    side: THREE.BackSide, depthTest: false, depthWrite: false,
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geo, mat));
  const cam = new THREE.CubeCamera(0.1, 10, rt);
  cam.update(renderer, scene); // restores the renderer's previous target; mips are generated by the last face's render
  geo.dispose();
  mat.dispose();
  return { texture: rt.texture, dispose: () => rt.dispose() };
}
```

- [ ] **Step 6: Commit**

```bash
git add src/terminal/mercury/planet/nebulaSky.js src/terminal/mercury/nebulaBake.js src/terminal/mercury/planet/__tests__/nebulaSky.test.js
git commit -m "feat(mercury): neutral nebula T2 — colourless generator (void / ridged wisps / stars), cube bake, studio-rate rotation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The switch in the mirror + wiring

**Files:**
- Modify: `src/terminal/mercury/planet/aetherSky.js` (studio → `skyStudio`, new `skyNeutral(R, k)`, `NEBULA_MAX_LOD`,
  `SKY_MEAN.nebula`, header comment)
- Modify: `src/terminal/mercury/planet/hgMirrorGlsl.js:17-36`
- Modify: `src/terminal/mercury/planet/mercuryPlanetShader.js:63,133`
- Modify: `src/terminal/mercury/planet/planetLook.js:64` (add `neutralNebula` after `neutralSky`)
- Modify: `src/terminal/mercury/MercuryPlanet.jsx` (uniform block ~l.346, an effect after l.371, upload ~l.493, sky
  clock block ~l.695)
- Modify: `.superpowers/sdd/tools/ms-mean.mjs` (fragment uniform line)
- Test: `aetherSky.test.js`, `hgMirrorGlsl.test.js`, the three `planetShader.*.fs.glsl` snapshots

**Interfaces:**
- Consumes: `nebulaRotation`, `canBakeNebula`, `bakeNebula` (Task 2).
- Produces: uniforms `uNeutralNebula: float`, `uNebulaRot: mat3`, `uNebulaMap: samplerCube` in `HG_MIRROR_UNIFORMS`
  and `PLANET_UNIFORMS`; `PLANET_TUNE.neutralNebula` (0); `SKY_MEAN.nebula` (vec3, re-measured in Task 4);
  `NEBULA_MAX_LOD = 6`; GLSL `vec3 skyStudio(vec3 R)`, `vec3 skyNeutral(vec3 R, float k)`.

- [ ] **Step 1: Update the tests first.** In `aetherSky.test.js`, add `NEBULA_MAX_LOD` to the `'../aetherSky'` import and
  replace the test `'neutral weight fills what the element skies leave; evaluated only above SKY_W_MIN'` with:

```js
    it('neutral weight fills what the element skies leave; evaluated only above SKY_W_MIN', () => {
      expect(AETHER_SKY_GLSL).toContain('float wN = uNeutralSky * clamp(1.0 - (uSkyW.x + uSkyW.y + uSkyW.z + uSkyW.w), 0.0, 1.0);');
      expect(AETHER_SKY_GLSL).toContain('vec3 skyStudio(vec3 R) {');
      expect(AETHER_SKY_GLSL).toContain('vec3 skyNeutral(vec3 R, float k) {');
      expect(AETHER_SKY_GLSL).toContain('mean += wN * mix(SKY_MEAN_NEUTRAL, SKY_MEAN_NEBULA, uNeutralNebula);');
      expect(AETHER_SKY_GLSL).toContain('if (wN > SKY_W_MIN) s += wN * skyNeutral(R, k);');
    });

    it('studio / nebula switch: each side evaluated only when it has weight; nebula = one rotated textureLod', () => {
      expect(AETHER_SKY_GLSL).toContain('if (uNeutralNebula < 1.0) c += (1.0 - uNeutralNebula) * skyStudio(R);');
      expect(AETHER_SKY_GLSL).toContain('if (uNeutralNebula > 0.0) c += uNeutralNebula * textureLod(uNebulaMap, uNebulaRot * R, k * NEBULA_MAX_LOD).rgb;');
      expect(AETHER_SKY_GLSL).toContain(`const float NEBULA_MAX_LOD = ${glf(NEBULA_MAX_LOD)};`);
      expect(AETHER_SKY_GLSL.match(/textureLod\(/g)).toHaveLength(1);
      expect(SKY_MEAN.nebula).toHaveLength(3);
      expect(SKY_MEAN.nebula[0]).toBe(SKY_MEAN.nebula[1]);
      expect(SKY_MEAN.nebula[1]).toBe(SKY_MEAN.nebula[2]);
    });

    it('the nebula switch is a mirror uniform, studio by default (author rules after the look sheet)', () => {
      for (const u of ['uNeutralNebula', 'uNebulaRot', 'uNebulaMap']) {
        expect(HG_MIRROR_UNIFORMS).toContain(u);
        expect(PLANET_UNIFORMS).toContain(u);
      }
      expect(PLANET_TUNE.neutralNebula).toBe(0);
    });
```

  In the test `'no noise, rigid drift on the calm-gated sky clock'`, change the slice end so it covers the studio only:
  `AETHER_SKY_GLSL.indexOf('vec3 skyNeutral(vec3 R, float k)')` instead of `AETHER_SKY_GLSL.indexOf('// The active element')`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/aetherSky.test.js`
Expected: FAIL on the three changed/new tests (`skyStudio` missing, `SKY_MEAN.nebula` undefined, `neutralNebula` undefined).

- [ ] **Step 3: Implement in `aetherSky.js`**

  (a) Header comment, last line: `// Needs (declared by HG_MIRROR_DECLS_GLSL): uSkyT, uSkyPhase, uSkyW, uNeutralSky, uNeutralNebula, uNebulaRot,\n// uNebulaMap, uSunDir.`

  (b) After `NEUTRAL_MEAN`, add:

```js
// Neutral nebula (spec 2026-10-08): the baked cube map (nebulaSky.js / nebulaBake.js) is sampled at mip k · this, so a
// rougher mirror sees it blurred on its way to SKY_MEAN.nebula (k = 1 returns the mean before any lookup).
export const NEBULA_MAX_LOD = 6;
```

  (c) In `SKY_MEAN`, after `neutral`, add (studio's analytic mean as the starting value; Task 4 replaces it with the
  measured one):

```js
  nebula: [NEUTRAL_MEAN, NEUTRAL_MEAN, NEUTRAL_MEAN], // measured by nebula-hist.mjs (neutral nebula Task 4)
```

  (d) In `AETHER_SKY_GLSL` after `const vec3 SKY_MEAN_NEUTRAL = …;` add:

```glsl
const vec3 SKY_MEAN_NEBULA = ${v3(SKY_MEAN.nebula)};
const float NEBULA_MAX_LOD = ${glf(NEBULA_MAX_LOD)};
```

  (e) Replace the studio function header and add the switch. The block from the comment
  `// Neutral (resting mirror): a studio.` to the end of `skyNeutral` becomes:

```glsl
// Neutral studio (option B): deep-space black, a thin horizon line, three soft-edged strips turning
// rigidly with the calm-gated sky clock. No noise: the edges are what make the liquid read as a mirror.
float skyNeutralStrip(float az, float c) {
  float d = abs(mod(az - c + 3.14159265, 6.28318531) - 3.14159265);
  return smoothstep(NEUTRAL_STRIP_HW + NEUTRAL_STRIP_SOFT, NEUTRAL_STRIP_HW - NEUTRAL_STRIP_SOFT, d);
}
vec3 skyStudio(vec3 R) {
  float hz = R.y / NEUTRAL_HORIZON_W;
  float L = NEUTRAL_SKY_FLOOR + NEUTRAL_HORIZON_LUM * exp(-hz * hz);
  float az = atan(R.z, R.x) - NEUTRAL_SKY_DRIFT * uSkyT;
  float span = smoothstep(NEUTRAL_STRIP_Y0 - NEUTRAL_STRIP_YSOFT, NEUTRAL_STRIP_Y0 + NEUTRAL_STRIP_YSOFT, R.y)
             * smoothstep(NEUTRAL_STRIP_Y1 + NEUTRAL_STRIP_YSOFT, NEUTRAL_STRIP_Y1 - NEUTRAL_STRIP_YSOFT, R.y);
  float strips = skyNeutralStrip(az, NEUTRAL_STRIP_AZ.x) + skyNeutralStrip(az, NEUTRAL_STRIP_AZ.y) + skyNeutralStrip(az, NEUTRAL_STRIP_AZ.z);
  L += NEUTRAL_STRIP_LUM * span * strips;
  return vec3(L);
}

// The resting mirror's sky: the studio, the baked nebula (one textureLod, rotated on the sky clock, mip by roughness
// weight k), or a mix by uNeutralNebula. Each side is evaluated only when it has weight (uniform branch: coherent).
vec3 skyNeutral(vec3 R, float k) {
  vec3 c = vec3(0.0);
  if (uNeutralNebula < 1.0) c += (1.0 - uNeutralNebula) * skyStudio(R);
  if (uNeutralNebula > 0.0) c += uNeutralNebula * textureLod(uNebulaMap, uNebulaRot * R, k * NEBULA_MAX_LOD).rgb;
  return c;
}
```

  (f) In `aetherSky(R, rough)`: `mean += wN * SKY_MEAN_NEUTRAL;` → `mean += wN * mix(SKY_MEAN_NEUTRAL, SKY_MEAN_NEBULA, uNeutralNebula);`
  and `if (wN > SKY_W_MIN) s += wN * skyNeutral(R, nOct);` → `if (wN > SKY_W_MIN) s += wN * skyNeutral(R, k);`.

- [ ] **Step 4: Declare the uniforms.**

  `hgMirrorGlsl.js` — in `HG_MIRROR_UNIFORMS` after `'uNeutralSky',` add `'uNeutralNebula', 'uNebulaRot', 'uNebulaMap',`;
  in `HG_MIRROR_DECLS_GLSL` after `'uniform float uNeutralSky;',` add:

```js
  'uniform float uNeutralNebula;',
  'uniform mat3 uNebulaRot;',
  'uniform samplerCube uNebulaMap;',
```

  `mercuryPlanetShader.js` — in `PLANET_UNIFORMS` line 63 after `'uNeutralSky',` add `'uNeutralNebula', 'uNebulaRot', 'uNebulaMap',`;
  after line 133 `uniform float uNeutralSky;` add the same three declaration lines (no quotes).

  `planetLook.js` — after the `neutralSky` line:

```js
  neutralNebula: 0,  // resting mirror: 0 = studio (option B, ruled 2026-10-07), 1 = baked neutral nebula, between = mix (spec 2026-10-08)
```

  `.superpowers/sdd/tools/ms-mean.mjs` — in the `fs` string, after `uniform float uNeutralSky;` add
  ` uniform float uNeutralNebula; uniform mat3 uNebulaRot; uniform samplerCube uNebulaMap;` (it sets none of them: 0 = studio).

- [ ] **Step 5: Run the unit suite; review then re-pin the snapshots**

Run: `npx vitest run src/terminal/mercury`
Expected: all pass except the three `planetShader.*.fs.glsl` file snapshots. Then:

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js -u` and
`git diff --stat src/terminal/mercury/planet/__tests__/__snapshots__` then `git diff src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.full.fs.glsl`
Expected diff, and nothing else: the 3 uniform lines, `SKY_MEAN_NEBULA` + `NEBULA_MAX_LOD` consts, the studio rename
`skyNeutral(vec3 R, float nOct)` → `skyStudio(vec3 R)` with its comment, the new `skyNeutral(R, k)`, and the two edited
lines in `aetherSky`. Re-run `npx vitest run src/terminal/mercury` → PASS.

- [ ] **Step 6: Wire `MercuryPlanet.jsx`.** Imports at the top:

```js
import { nebulaRotation } from './planet/nebulaSky';
import { canBakeNebula, bakeNebula } from './nebulaBake';
```

  In the `uniforms` block after `uNeutralSky: …,`:

```js
      uNeutralNebula: { value: 0 },
      uNebulaRot: { value: new THREE.Matrix3() },
      uNebulaMap: { value: null },
```

  After `useEffect(() => () => material.dispose(), [material]);` (l.371):

```js
  // Neutral nebula (spec 2026-10-08): bake once per renderer + material; without a half-float target the switch stays
  // on the studio. The droplets / beads / visitors share these uniform objects, so they see the same map.
  const nebulaOk = useRef(false);
  useLayoutEffect(() => {
    if (!canBakeNebula(gl)) {
      console.warn('[mercury] no half-float render target: neutral nebula off, studio only');
      nebulaOk.current = false;
      return undefined;
    }
    const neb = bakeNebula(gl);
    material.uniforms.uNebulaMap.value = neb.texture;
    nebulaOk.current = true;
    return () => { nebulaOk.current = false; material.uniforms.uNebulaMap.value = null; neb.dispose(); };
  }, [gl, material]);
```

  In `useFrame` after `u.uNeutralSky.value = PLANET_TUNE.neutralSky;`:

```js
    u.uNeutralNebula.value = nebulaOk.current ? Math.min(Math.max(PLANET_TUNE.neutralNebula, 0), 1) : 0;
```

  Inside `if (aetherClock) { … }` after `u.uSkyT.value = aetherClock.t;`:

```js
      u.uNebulaRot.value.set(...nebulaRotation(aetherClock.t));
```

- [ ] **Step 7: Live compile + switch check.** Make sure the dev server answers on :5175 (if CDP says "refused to
  connect", restart it — the app can stop it between turns). Create `.superpowers/sdd/tools/neutral-nebula-live.mjs`:

```js
// Neutral nebula T3: both modes compile in every mirror material; the switch changes the planet; the map is baked.
import { openMercury, OUT, sleep } from './openMercury.mjs';
const { launch } = await import(new URL('file:///F:/scale_9.4/scripts/cdp.mjs'));
const page = await launch({ url: 'about:blank', width: 1600, height: 1000 });
const out = [];
try {
  const m = await openMercury(page, '');
  await sleep(2000);
  out.push({ baked: await page.eval(`(() => { let v = null; window.__mercury.scene.traverse((o) => { const u = o.material && o.material.uniforms; if (u && u.uNebulaMap && u.uSurfOn) v = !!u.uNebulaMap.value; }); return v; })()`) });
  for (const v of [0, 1, 0.5]) {
    await page.eval(`window.__mercuryTune.planet.neutralNebula = ${v}; 1`); await sleep(800);
    await m.shot(`${OUT}/nneb-live-${v}.png`, 700);
  }
  await page.eval(`window.__mercuryTune.planet.neutralNebula = 0; 1`);
  out.push({ errors: await m.errors() });
} catch (e) { out.push({ FAIL: e.message }); } finally { console.log(JSON.stringify(out)); await page.close(); process.exit(0); }
```

Run: `node .superpowers/sdd/tools/neutral-nebula-live.mjs`
Expected: `{"baked":true}` and `{"errors":[]}`. Then **Read** `out/nneb-live-0.png` and `out/nneb-live-1.png` (look before
judging): 0 must match the studio (`out/nsky-1.png` framing), 1 must show a dark nebula on the ball (not black, not
uniform grey). If 1 is black, check mip generation / the `uNebulaMap` binding before tuning anything.

- [ ] **Step 8: Commit**

```bash
git add src/terminal/mercury/planet/aetherSky.js src/terminal/mercury/planet/hgMirrorGlsl.js src/terminal/mercury/planet/mercuryPlanetShader.js src/terminal/mercury/planet/planetLook.js src/terminal/mercury/MercuryPlanet.jsx src/terminal/mercury/planet/__tests__ .superpowers/sdd/tools/ms-mean.mjs .superpowers/sdd/tools/neutral-nebula-live.mjs
git commit -m "feat(mercury): neutral nebula T3 — studio/nebula switch in the shared mirror (neutralNebula, default studio), baked at mount

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Histogram gate + measured mean

**Files:**
- Create: `.superpowers/sdd/tools/nebula-hist.mjs`
- Modify: `src/terminal/mercury/planet/nebulaSky.js` (constants, only if a gate fails)
- Modify: `src/terminal/mercury/planet/aetherSky.js` (`SKY_MEAN.nebula` → measured)
- Test: `src/terminal/mercury/planet/__tests__/aetherSky.test.js`, snapshots

**Interfaces:**
- Consumes: `NEBULA_GEN_GLSL` (served live from `/src/terminal/mercury/planet/nebulaSky.js`).
- Produces: `SKY_MEAN.nebula` = measured mean (all three channels equal).

- [ ] **Step 1: Write the tool** `.superpowers/sdd/tools/nebula-hist.mjs`:

```js
// Neutral nebula T4: the generator's luminance histogram over the sphere (solid-angle weighted), against the spec §3
// gates. Renders skyNebulaGen into a 1024x512 equirect RGBA32F target with raw WebGL2 (same recipe as ms-mean.mjs).
const { launch } = await import(new URL('file:///F:/scale_9.4/scripts/cdp.mjs'));
const page = await launch({ url: 'about:blank', width: 800, height: 600 });
try {
  await page.goto('http://localhost:5175/', { waitMs: 500 });
  await new Promise((r) => setTimeout(r, 3000));
  const res = await page.eval(`(async () => {
    const { NEBULA_GEN_GLSL } = await import('/src/terminal/mercury/planet/nebulaSky.js');
    const W = 1024, H = 512;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const gl = cv.getContext('webgl2');
    if (!gl.getExtension('EXT_color_buffer_float')) return 'no float target';
    const vs = '#version 300 es\\nin vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
    const fs = '#version 300 es\\nprecision highp float;\\nuniform vec2 uRes;\\n' + NEBULA_GEN_GLSL +
      '\\nout vec4 o; void main(){ vec2 uv = gl_FragCoord.xy / uRes; float lon = (uv.x * 2.0 - 1.0) * 3.14159265; float lat = (uv.y - 0.5) * 3.14159265; vec3 R = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon)); o = vec4(skyNebulaGen(R), 1.0); }';
    const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr); gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, W, H, 0, gl.RGBA, gl.FLOAT, null);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, W, H); gl.uniform2f(gl.getUniformLocation(pr, 'uRes'), W, H);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const px = new Float32Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.FLOAT, px);
    const L = [], wts = []; let wsum = 0, acc = 0, peak = 0, colour = 0;
    for (let y = 0; y < H; y++) { const cw = Math.cos(((y + 0.5) / H - 0.5) * Math.PI); for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; const l = px[i]; colour = Math.max(colour, Math.abs(px[i] - px[i + 1]), Math.abs(px[i + 1] - px[i + 2])); L.push(l); wts.push(cw); wsum += cw; acc += l * cw; peak = Math.max(peak, l); } }
    let lo = 0, mid = 0, hi = 0; for (let i = 0; i < L.length; i++) { if (L[i] < 0.005) lo += wts[i]; if (L[i] >= 0.02 && L[i] <= 0.15) mid += wts[i]; if (L[i] > 1) hi += wts[i]; }
    const idx = L.map((_, i) => i).sort((a, b) => L[a] - L[b]); let c = 0, median = 0; for (const i of idx) { c += wts[i]; if (c >= wsum / 2) { median = L[i]; break; } }
    const r = (v) => +v.toPrecision(4);
    const st = { below005: r(lo / wsum), band002_015: r(mid / wsum), above1: r(hi / wsum), mean: r(acc / wsum), median: r(median), peak: r(peak), peakOverMedian: r(peak / Math.max(median, 1e-6)), colour: r(colour) };
    st.gates = { below005: st.below005 >= 0.5, band: st.band002_015 >= 0.25 && st.band002_015 <= 0.45, above1: st.above1 >= 0.001 && st.above1 <= 0.006, mean: st.mean >= 0.02 && st.mean <= 0.035, contrast: st.peakOverMedian >= 300, colourless: st.colour === 0 };
    return st;
  })()`);
  console.log(JSON.stringify(res));
} finally { await page.close(); process.exit(0); }
```

- [ ] **Step 2: Run it**

Run: `node .superpowers/sdd/tools/nebula-hist.mjs`
Expected: one JSON line with `gates`. Record it in `.superpowers/sdd/progress.md` under a new `## Neutral nebula` section.

- [ ] **Step 3: Tune until every gate is true** — change only `nebulaSky.js` constants, one knob per run, re-run Step 2:
  - `below005` low → raise `NEBULA_VOID_LO` / `NEBULA_VOID_HI` by 0.02 together;
  - `band002_015` low → raise `NEBULA_WISP_GAIN` (0.02 steps) or lower `NEBULA_WISP_POW` (1 step); high → the reverse;
  - `above1` high → raise `NEBULA_STAR_RATE` toward 0.999; low → lower toward 0.995;
  - `mean` out of range → `NEBULA_WISP_BASE` (0.005 steps);
  - `contrast` low → lower `NEBULA_FLOOR` (not below 0.001).
  Update the `nebulaSky.test.js` bounds only if a ruled constant leaves them, and say why in the commit.

- [ ] **Step 4: Write the measured mean** — in `aetherSky.js` set
  `nebula: [M, M, M], // measured 2026-10-08 by nebula-hist.mjs (1024x512 equirect, solid-angle weighted)` with `M` = the
  tool's `mean`, and add to `aetherSky.test.js` inside the switch describe:

```js
    it("SKY_MEAN.nebula is the measured mean, in the studio's range (frost / crust ambient does not jump between modes)", () => {
      expect(SKY_MEAN.nebula[0]).toBeGreaterThanOrEqual(0.02);
      expect(SKY_MEAN.nebula[0]).toBeLessThanOrEqual(0.035);
      expect(Math.abs(SKY_MEAN.nebula[0] - SKY_MEAN.neutral[0]) / SKY_MEAN.neutral[0]).toBeLessThan(0.3);
    });
```

- [ ] **Step 5: Run + re-pin** (only the `SKY_MEAN_NEBULA` line may change in the snapshots)

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js -u` then `git diff src/terminal/mercury/planet/__tests__/__snapshots__` (one line per file) then `npx vitest run src/terminal/mercury`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/mercury/planet .superpowers/sdd/tools/nebula-hist.mjs .superpowers/sdd/progress.md
git commit -m "feat(mercury): neutral nebula T4 — histogram gates pass (void/band/stars/mean/contrast), SKY_MEAN.nebula measured

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Look sheet for the author's ruling

**Files:**
- Create: `.superpowers/sdd/tools/neutral-nebula-sheet.mjs`

**Interfaces:**
- Consumes: `openMercury` (`shot`, `melt`, `errors`), `window.__mercuryTune.planet.{neutralNebula, roughLiquid}`.
- Produces: `out/nneb-sheet.png` (3 columns studio / 0.5 / nebula × 3 rows rest / after melt / rough 0.4).

- [ ] **Step 1: Write the tool**

```js
// Neutral nebula T5: contact sheet for the author — columns studio / mix / nebula; rows rest, just after a melt
// (ripples on the mirror), rough 0.4 (the mip path a frozen or crusted mirror takes).
import sharp from 'sharp';
import { openMercury, OUT, sleep } from './openMercury.mjs';
const { launch } = await import(new URL('file:///F:/scale_9.4/scripts/cdp.mjs'));
const page = await launch({ url: 'about:blank', width: 1600, height: 1000 });
const MODES = [0, 0.5, 1]; const S = 700; const T = 420; const out = []; const files = [];
const tune = (k, v) => page.eval(`window.__mercuryTune.planet.${k} = ${v}; 1`);
try {
  const m = await openMercury(page, '');
  await sleep(2000);
  const rough0 = await page.eval('window.__mercuryTune.planet.roughLiquid');
  for (const row of ['rest', 'melt', 'rough']) {
    for (const v of MODES) {
      await tune('neutralNebula', v);
      await tune('roughLiquid', row === 'rough' ? 0.4 : rough0);
      if (row === 'melt') await m.melt(); else await sleep(800);
      const p = `${OUT}/nneb-${row}-${v}.png`; await m.shot(p, S); files.push(p);
    }
  }
  await tune('roughLiquid', rough0); await tune('neutralNebula', 0);
  const imgs = await Promise.all(files.map((f) => sharp(f).resize(T, T).toBuffer()));
  await sharp({ create: { width: T * 3, height: T * 3, channels: 3, background: '#000' } })
    .composite(imgs.map((b, i) => ({ input: b, left: (i % 3) * T, top: Math.floor(i / 3) * T }))).png().toFile(`${OUT}/nneb-sheet.png`);
  out.push(`${OUT}/nneb-sheet.png`, { errors: await m.errors() });
} catch (e) { out.push({ FAIL: e.message }); } finally { console.log(JSON.stringify(out)); await page.close(); process.exit(0); }
```

- [ ] **Step 2: Run it and look**

Run: `node .superpowers/sdd/tools/neutral-nebula-sheet.mjs`
Expected: `{"errors":[]}`. **Read** `out/nneb-sheet.png`. Check, and write the answers to `progress.md`:
  - nebula column: void pockets read black, wisps read gunmetal, stars read white points — not a uniform grey;
  - melt row: ripples visible across the whole ball in the nebula column (not only where a strip crosses);
  - rough row: the nebula column is blurred, not black and not banded at cube-face seams;
  - studio column identical to `out/nsky-1.png` in character.
  If the rough row shows face seams, report it (do not fix silently) — seamless cube filtering is a WebGL2 default.

- [ ] **Step 3: Commit**

```bash
git add .superpowers/sdd/tools/neutral-nebula-sheet.mjs .superpowers/sdd/progress.md
git commit -m "chore(mercury): neutral nebula T5 — studio / mix / nebula look sheet (rest, melt, rough) for the author

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Hand to the author** (not agent work): the sheet for the default-mode ruling; the phone gate (60 fps at
  rest with `neutralNebula` 1 vs 0; bake time at mount) before any push. The switch stays 0 until ruled.

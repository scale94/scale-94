# Mercury Aether Light + Hg Beads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The water, earth and air flows become sunlit matter (per-element scattering, the planet's shadow cylinder, a floor), the planet's mirror reflects them the same way, and a sparse population of true liquid-Hg beads — shaded by the planet's own mirror code — rides the active element's flow.

**Architecture:** One pure module `planet/aetherLight.js` holds the light model twice (JS for tests and the mirror lobes, GLSL chunks for the flows and the beads) — the `planetWindow.js` pattern. The beads are a pure JS sim (`planet/hgBeads.js`) + a point-sprite sphere-impostor shader (`planet/hgBeadShader.js`) that interpolates the existing `hgMirrorGlsl` chunks, wired by a hook (`useHgBeads.js`) that shares the planet material's mirror uniforms exactly as `useDropletField.js` does.

**Tech Stack:** React 19, @react-three/fiber 9, three.js (ShaderMaterial, GLSL1 flows / GLSL3 beads), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-04-mercury-aether-light-beads-design.md`

## Global Constraints

- Branch `feature/mercury-stage`. **Never push** without the author's explicit push command.
- Author decisions (verbatim from the spec): **both layers** (lit element matter + Hg beads); bead sources = **ambient trickle + interaction bursts**, the active element carries all of them; lighting = **per-element physical scattering, a floor so the flows never go fully black, a soft penumbra (never a hard edge — banded/mechanical is a hard fail)**; fallback approved: shared curl-noise bead motion if per-element advection costs too much on the phone.
- Fire (`thermal`) stays emissive: no phase, no shadow.
- Flows: motion, palettes and slider knobs unchanged. Thermal flow source unchanged.
- `hgMirrorGlsl.js` is NOT edited (the planet's fragment shader snapshot must stay byte-identical). Beads interpolate its chunks.
- Bead caps: `full 256`, `phone 64`, `lite 32` (in `TIERS`). Zero per-frame allocation in sims and hooks (preallocate; mutate in place).
- Calm (reduced motion): ambient trickle and drift freeze; bursts still spawn but don't advect.
- `PLANET_TUNE` defaults: `aetherFloor: 0.2`, `aetherPenumbra: 0.08` (scene units; planet radius 0.75).
- Geometry facts this plan relies on: `SUN_DIR_WORLD = (−sin55°, 0, cos55°)` fixed in world; camera on +Z looking at the origin (distance fitted, ≥ 3.6); planet radius `R_SCENE · drop.coreScale`; flows are `THREE.Points` at world positions with `ShaderMaterial` (three injects `viewMatrix` and `cameraPosition` into both stages).
- Phase functions are **normalised at the camera's own scattering angle** (`COS_REF = −SUN_DIR_WORLD.z`): a particle near the centre keeps today's brightness, the light model only redistributes around it, capped at `LIT_MAX = 2.5`. (With the Sun at 55° the dominant visible effect is the shadow lane and a gentle left–right gradient; that is expected, not a bug.)
- Lint gate: `npm run lint` 0 errors; warnings ≤ 153; don't sweep `exhaustive-deps`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit `.import-cache.json` or untracked `baseline/` folders.

---

### Task 1: The light model — `planet/aetherLight.js`

**Files:**
- Create: `src/terminal/mercury/planet/aetherLight.js`
- Modify: `src/terminal/mercury/planet/planetLook.js` (two `PLANET_TUNE` keys)
- Test: `src/terminal/mercury/planet/__tests__/aetherLight.test.js`

**Interfaces:**
- Produces:
  - `AETHER_ELEMENT_LIGHT` = `{ fluid: {g:0.6,surge:0,ray:0}, earth: {g:-0.3,surge:0.35,ray:0}, air: {g:0,surge:0,ray:1} }`
  - `LIT_MAX = 2.5`, `COS_REF = -SUN_DIR_WORLD[2]`
  - `litPhase(params, cosT) → number`, `litRef(element) → number`
  - `shadowFactor(rel[3], sun[3], R, pen) → 0..1` (rel = point − planet centre; any frame)
  - `aetherLightAt(element, p[3], viewer[3], { floor, pen, R, sun = SUN_DIR_WORLD }) → number` (1 for `thermal`)
  - GLSL: `AETHER_SHADOW_GLSL` (defines `float aetherShadow(vec3 rel, vec3 s, float R, float pen)`), `AETHER_LIGHT_VS` (defines `void aetherLightVS(vec3 mv, float pointSizePx)`; requires `uViewportPx` declared earlier — `PLANET_WINDOW_VS` does), `aetherLightFS(element) → string` (defines `float aetherLight()`; uniforms `uSunDirW`, `uLitFloor`, `uLitPen`, `uPlanetRadius`)
  - `PLANET_TUNE.aetherFloor = 0.2`, `PLANET_TUNE.aetherPenumbra = 0.08`

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/mercury/planet/__tests__/aetherLight.test.js
import { describe, it, expect } from 'vitest';
import {
  AETHER_ELEMENT_LIGHT, LIT_MAX, COS_REF, litPhase, litRef, shadowFactor, aetherLightAt,
  AETHER_SHADOW_GLSL, AETHER_LIGHT_VS, aetherLightFS,
} from '../aetherLight';
import { SUN_DIR_WORLD } from '../planetFrame';
import { PLANET_TUNE } from '../planetLook';
import { glf } from '../../../gl/glf';

const S = SUN_DIR_WORLD;
const scale = (v, k) => v.map((c) => c * k);
const add = (a, b) => a.map((c, i) => c + b[i]);
const OPT = { floor: 0.2, pen: 0.08, R: 0.75 };
const CAM = [0, 0, 4.4];

describe('shadowFactor (the planet shadow cylinder, anti-sunward)', () => {
  it('sunward side is always lit; the anti-sunward axis is umbra', () => {
    expect(shadowFactor(scale(S, 2), S, 0.75, 0.08)).toBe(1);
    expect(shadowFactor(scale(S, -2), S, 0.75, 0.08)).toBe(0);
  });
  it('outside the cylinder is lit; the penumbra is monotonic and soft', () => {
    const perp = [0, 1, 0]; // ⟂ to the Sun (S has y = 0)
    const at = (radial) => shadowFactor(add(scale(S, -1.5), scale(perp, radial)), S, 0.75, 0.08);
    expect(at(0.75 + 0.2)).toBe(1);
    expect(at(0.75 - 0.2)).toBe(0);
    const samples = [0.67, 0.70, 0.73, 0.75, 0.77, 0.80, 0.83].map(at);
    for (let i = 1; i < samples.length; i++) expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
    expect(at(0.75)).toBeCloseTo(0.5, 6);
  });
});

describe('phase functions', () => {
  it('water scatters forward, earth backward (with an opposition surge), air is symmetric', () => {
    const { fluid, earth, air } = AETHER_ELEMENT_LIGHT;
    expect(litPhase(fluid, 0.9)).toBeGreaterThan(litPhase(fluid, -0.9));
    expect(litPhase(earth, -0.9)).toBeGreaterThan(litPhase(earth, 0.9));
    expect(litPhase(earth, -1)).toBeGreaterThan(litPhase(earth, -0.8) * 1.1);
    expect(litPhase(air, 0.6)).toBeCloseTo(litPhase(air, -0.6), 12);
  });
  it('is normalised at the camera scattering angle', () => {
    expect(COS_REF).toBeCloseTo(-Math.cos((55 * Math.PI) / 180), 12);
    for (const el of ['fluid', 'earth', 'air']) expect(litPhase(AETHER_ELEMENT_LIGHT[el], COS_REF) / litRef(el)).toBeCloseTo(1, 12);
  });
});

describe('aetherLightAt', () => {
  it('a lit particle on the camera axis keeps exactly today\'s brightness', () => {
    for (const el of ['fluid', 'earth', 'air']) expect(aetherLightAt(el, [0, 0, 1.5], CAM, OPT)).toBeCloseTo(1, 12);
  });
  it('umbra falls to the floor, never below', () => {
    for (const el of ['fluid', 'earth', 'air']) expect(aetherLightAt(el, scale(S, -2), CAM, OPT)).toBeCloseTo(0.2, 12);
  });
  it('is capped at floor + (1 − floor) · LIT_MAX', () => {
    const far = [-30, 0, 30]; // a viewer placed to force strong forward scattering for water
    expect(aetherLightAt('fluid', [0.5, 0, 0], far, OPT)).toBeLessThanOrEqual(0.2 + 0.8 * LIT_MAX + 1e-12);
  });
  it('fire is emissive: always 1', () => {
    expect(aetherLightAt('thermal', scale(S, -2), CAM, OPT)).toBe(1);
  });
});

describe('GLSL chunks', () => {
  it('shadow chunk is the JS shadowFactor', () => {
    expect(AETHER_SHADOW_GLSL).toContain('float aetherShadow(vec3 rel, vec3 s, float R, float pen)');
    expect(AETHER_SHADOW_GLSL).toContain('smoothstep(R - pen, R + pen, radial)');
  });
  it('vertex chunk reconstructs the sprite size in view units', () => {
    expect(AETHER_LIGHT_VS).toContain('void aetherLightVS(vec3 mv, float pointSizePx)');
    expect(AETHER_LIGHT_VS).toContain('pointSizePx * 2.0 * (-mv.z) / (projectionMatrix[1][1] * uViewportPx.y)');
  });
  it('fragment chunk bakes each element\'s constants', () => {
    const fs = aetherLightFS('earth');
    expect(fs).toContain('float aetherLight()');
    expect(fs).toContain(`const float LIT_G = ${glf(-0.3)};`);
    expect(fs).toContain(`const float LIT_REF = ${glf(litRef('earth'))};`);
    expect(fs).toContain(AETHER_SHADOW_GLSL);
    expect(() => aetherLightFS('thermal')).toThrow(/emissive/);
  });
  it('tunables live in PLANET_TUNE', () => {
    expect(PLANET_TUNE.aetherFloor).toBe(0.2);
    expect(PLANET_TUNE.aetherPenumbra).toBe(0.08);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/aetherLight.test.js`
Expected: FAIL — cannot resolve `../aetherLight`.

- [ ] **Step 3: Add the tunables** — in `src/terminal/mercury/planet/planetLook.js`, inside `PLANET_TUNE` directly after the `aetherCore: 3,` line:

```js
  aetherFloor: 0.2,     // lit element flows never fall below this × their colour (umbra, worst phase) — aetherLight.js
  aetherPenumbra: 0.08, // half-width of the planet shadow cylinder's soft edge, scene units (planet radius 0.75)
```

- [ ] **Step 4: Write the module**

```js
// src/terminal/mercury/planet/aetherLight.js — the element flows as sunlit matter (aether spec §1).
//
// Water (mist) scatters forward, earth (regolith dust) backward with an opposition surge, air (gas) is
// Rayleigh-symmetric; fire makes its own light and is never passed through here. Every lit flow goes dark
// in the planet's shadow — a cylinder of the planet's radius running anti-sunward from its centre — with a
// soft penumbra, and never below a floor. Phase functions are normalised at the camera's own scattering
// angle, so a particle near the centre keeps today's look; the model only redistributes around it.
// GLSL mirrors the JS exactly (the planetWindow.js pattern); the JS feeds the tests and the mirror lobes.

import { glf } from '../../gl/glf';
import { SUN_DIR_WORLD } from './planetFrame';

export const AETHER_ELEMENT_LIGHT = Object.freeze({
  fluid: Object.freeze({ g: 0.6, surge: 0, ray: 0 }),   // mist: forward Henyey–Greenstein
  earth: Object.freeze({ g: -0.3, surge: 0.35, ray: 0 }), // dust: backward HG + opposition surge
  air: Object.freeze({ g: 0, surge: 0, ray: 1 }),       // gas: Rayleigh (1 + cos²)
});
export const LIT_MAX = 2.5;
export const SURGE_W = 0.08; // opposition-surge width in (1 + cos θ)
export const COS_REF = -SUN_DIR_WORLD[2]; // camera on +Z: cos θ = dot(−sun, +Z)

// cos θ: θ is the scattering angle between the incoming sunlight (−sun) and the way to the viewer.
export function litPhase({ g, surge, ray }, c) {
  const hg = (1 - g * g) / Math.max(1 + g * g - 2 * g * c, 1e-4) ** 1.5;
  const rayleigh = 0.75 * (1 + c * c);
  return hg + (rayleigh - hg) * ray + surge * Math.exp(-(1 + c) / SURGE_W);
}
export const litRef = (element) => litPhase(AETHER_ELEMENT_LIGHT[element], COS_REF);

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function shadowFactor(rel, sun, R, pen) {
  const along = -dot(rel, sun); // > 0: anti-sunward of the centre
  if (along <= 0) return 1;
  const px = rel[0] + along * sun[0], py = rel[1] + along * sun[1], pz = rel[2] + along * sun[2];
  return smoothstep(R - pen, R + pen, Math.hypot(px, py, pz));
}

export function aetherLightAt(element, p, viewer, { floor, pen, R, sun = SUN_DIR_WORLD }) {
  const params = AETHER_ELEMENT_LIGHT[element];
  if (!params) return 1; // fire, or anything not lit
  const vx = viewer[0] - p[0], vy = viewer[1] - p[1], vz = viewer[2] - p[2];
  const vl = Math.hypot(vx, vy, vz) || 1;
  const c = -(sun[0] * vx + sun[1] * vy + sun[2] * vz) / vl;
  const ph = Math.min(LIT_MAX, litPhase(params, c) / litRef(element));
  return floor + (1 - floor) * shadowFactor(p, sun, R, pen) * ph;
}

export const AETHER_SHADOW_GLSL = /* glsl */ `
float aetherShadow(vec3 rel, vec3 s, float R, float pen) {
  float along = -dot(rel, s);
  if (along <= 0.0) return 1.0;
  float radial = length(rel + along * s);
  return smoothstep(R - pen, R + pen, radial);
}
`;

// Needs uViewportPx (declared by PLANET_WINDOW_VS, which every flow includes first).
export const AETHER_LIGHT_VS = /* glsl */ `
varying vec3 vLitC;
varying float vLitDiam;
void aetherLightVS(vec3 mv, float pointSizePx) {
  vLitC = mv;
  vLitDiam = pointSizePx * 2.0 * (-mv.z) / (projectionMatrix[1][1] * uViewportPx.y);
}
`;

// Per FRAGMENT, not per sprite: a sprite can be wider than the planet, so the shadow edge must cross it.
export function aetherLightFS(element) {
  const p = AETHER_ELEMENT_LIGHT[element];
  if (!p) throw new Error(`aetherLightFS: '${element}' is emissive or unknown`);
  return /* glsl */ `
uniform vec3 uSunDirW;
uniform float uLitFloor;
uniform float uLitPen;
uniform float uPlanetRadius;
varying vec3 vLitC;
varying float vLitDiam;
const float LIT_G = ${glf(p.g)};
const float LIT_SURGE = ${glf(p.surge)};
const float LIT_RAY = ${glf(p.ray)};
const float LIT_REF = ${glf(litRef(element))};
const float LIT_MAX = ${glf(LIT_MAX)};
const float SURGE_W = ${glf(SURGE_W)};
${AETHER_SHADOW_GLSL}
float litPhase(float c) {
  float hg = (1.0 - LIT_G * LIT_G) / pow(max(1.0 + LIT_G * LIT_G - 2.0 * LIT_G * c, 1e-4), 1.5);
  float rayleigh = 0.75 * (1.0 + c * c);
  return mix(hg, rayleigh, LIT_RAY) + LIT_SURGE * exp(-(1.0 + c) / SURGE_W);
}
float aetherLight() {
  vec2 o = (gl_PointCoord - 0.5) * vLitDiam;
  vec3 p = vLitC + vec3(o.x, -o.y, 0.0);
  vec3 s = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
  vec3 c = (viewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float sh = aetherShadow(p - c, s, uPlanetRadius, uLitPen);
  float ph = min(LIT_MAX, litPhase(dot(-s, normalize(-p))) / LIT_REF);
  return uLitFloor + (1.0 - uLitFloor) * sh * ph;
}
`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/aetherLight.test.js`
Expected: PASS. Then `npx vitest run src/terminal/mercury` — all pass (adding keys to `PLANET_TUNE` must not change any snapshot; if a test enumerates `PLANET_TUNE` keys, add the two keys to its expectation).

- [ ] **Step 6: Commit**

```bash
git add src/terminal/mercury/planet/aetherLight.js src/terminal/mercury/planet/__tests__/aetherLight.test.js src/terminal/mercury/planet/planetLook.js
git commit -m "feat(mercury): aetherLight — per-element scattering, the planet's shadow cylinder and a floor (JS + GLSL)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Light the water, earth and air flows

**Files:**
- Modify: `src/terminal/fluid/ParticleFlow.jsx`, `src/terminal/earth/SedimentFlow.jsx`, `src/terminal/air/AtmosphericFlow.jsx`
- Test: `src/terminal/mercury/planet/__tests__/flowLight.test.js`

**Interfaces:**
- Consumes (Task 1): `AETHER_LIGHT_VS`, `aetherLightFS(element)`, `PLANET_TUNE.aetherFloor`, `PLANET_TUNE.aetherPenumbra`; `SUN_DIR_WORLD` from `src/terminal/mercury/planet/planetFrame.js`.
- Produces: each lit flow's material has uniforms `uSunDirW`, `uLitFloor`, `uLitPen` (and keeps `uPlanetRadius`, `uViewportPx`).

The change is the same in each of the three files (thermal is NOT touched):

1. Imports (next to the existing `planetWindow` import):
```js
import { AETHER_LIGHT_VS, aetherLightFS } from '../mercury/planet/aetherLight';
import { SUN_DIR_WORLD } from '../mercury/planet/planetFrame';
import { PLANET_TUNE } from '../mercury/planet/planetLook';
```
(If the file already imports from `planetLook` — e.g. `R_SCENE` — add `PLANET_TUNE` to that import instead of a second line.)

2. Vertex shader: directly after the `${PLANET_WINDOW_VS}` line add `${AETHER_LIGHT_VS}`; directly after the existing `planetWindowVS(...)` call add, with the same argument:
   - ParticleFlow: `aetherLightVS(mvPosition.xyz, gl_PointSize);`
   - SedimentFlow / AtmosphericFlow: `aetherLightVS(mvPos.xyz, gl_PointSize);` (use the variable name the file's `planetWindowVS` call uses)

3. Fragment shader: directly after the `${PLANET_WINDOW_FS}` line add `${aetherLightFS('fluid')}` / `${aetherLightFS('earth')}` / `${aetherLightFS('air')}`; directly before the final `gl_FragColor = …` line add `color *= aetherLight();` (ParticleFlow) or `col *= aetherLight();` (SedimentFlow, AtmosphericFlow). Alpha is untouched — matter in shadow still occludes what lies behind it.

4. Uniforms (in the lazy `useState(() => ({ … }))` object, after `uPlanetRadius`):
```js
    uSunDirW: { value: new THREE.Vector3(...SUN_DIR_WORLD) },
    uLitFloor: { value: PLANET_TUNE.aetherFloor },
    uLitPen: { value: PLANET_TUNE.aetherPenumbra },
```
If a flow's uniform object lacks `uPlanetRadius`, add `uPlanetRadius: { value: R_SCENE },` (importing `R_SCENE` from `planetLook`).

5. In `useFrame`, next to the other `mat.uniforms.…value = …` writes:
```js
      mat.uniforms.uLitFloor.value = PLANET_TUNE.aetherFloor;
      mat.uniforms.uLitPen.value = PLANET_TUNE.aetherPenumbra;
```

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/mercury/planet/__tests__/flowLight.test.js
// The lit flows carry the aether light; fire stays emissive. Read from the sources (the dropletOrder.test.js idiom).
import { describe, it, expect } from 'vitest';
import particleSrc from '../../../fluid/ParticleFlow.jsx?raw';
import thermalSrc from '../../../thermal/ThermalFlow.jsx?raw';
import sedimentSrc from '../../../earth/SedimentFlow.jsx?raw';
import atmoSrc from '../../../air/AtmosphericFlow.jsx?raw';

const LIT = { fluid: [particleSrc, 'color'], earth: [sedimentSrc, 'col'], air: [atmoSrc, 'col'] };

describe('flows as sunlit matter', () => {
  for (const [el, [src, v]] of Object.entries(LIT)) {
    it(`${el}: vertex + fragment chunks, the multiply before gl_FragColor, live uniforms`, () => {
      expect(src).toContain('${AETHER_LIGHT_VS}');
      expect(src).toMatch(/aetherLightVS\(mv\w*\.xyz, gl_PointSize\);/);
      expect(src).toContain(`\${aetherLightFS('${el}')}`);
      const fs = src.slice(src.indexOf('const fragmentShader'));
      const mul = fs.indexOf(`${v} *= aetherLight();`);
      expect(mul).toBeGreaterThan(0);
      expect(mul).toBeLessThan(fs.indexOf('gl_FragColor'));
      expect(src).toContain('uSunDirW: { value: new THREE.Vector3(...SUN_DIR_WORLD) }');
      expect(src).toContain('mat.uniforms.uLitFloor.value = PLANET_TUNE.aetherFloor;');
      expect(src).toContain('mat.uniforms.uLitPen.value = PLANET_TUNE.aetherPenumbra;');
      expect(src).toMatch(/uPlanetRadius:\s*\{\s*value:/);
    });
  }
  it('fire is untouched: it makes its own light', () => {
    expect(thermalSrc).not.toMatch(/aetherLight/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/flowLight.test.js`
Expected: FAIL (no chunk in any flow).

- [ ] **Step 3: Apply the five edits above to the three flow files.**

- [ ] **Step 4: Run tests and lint**

Run: `npx vitest run src/terminal/mercury src/terminal/fluid src/terminal/earth src/terminal/air`
Expected: PASS (incl. `dropletOrder.test.js`, `exosphereOrder.test.js` — flows still have no `renderOrder`).
Run: `npm run lint` — 0 errors, warnings ≤ 153.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/fluid/ParticleFlow.jsx src/terminal/earth/SedimentFlow.jsx src/terminal/air/AtmosphericFlow.jsx src/terminal/mercury/planet/__tests__/flowLight.test.js
git commit -m "feat(mercury): water, earth and air flows lit by the Sun — scattering, the shadow lane, a floor; fire stays emissive

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The mirror reflects the lit flows

**Files:**
- Modify: `src/terminal/mercury/planet/aetherLobes.js` (`aetherLobeColors` gains optional lighting; export `mulberry32`)
- Modify: `src/terminal/mercury/MercuryPlanet.jsx` (the `aetherLobeColors(...)` call, ~line 677; the `aether` memo, ~line 378)
- Test: `src/terminal/mercury/planet/__tests__/aetherLobes.test.js` (append)

**Interfaces:**
- Consumes (Task 1): `aetherLightAt(element, p, viewer, { floor, pen, R })`.
- Produces: `aetherLobeColors(opacities, out = newBuffer(), dirs = null, light = null)` — with `dirs` and `light` (`{ floor, pen, R }`), each element's weight in lobe i is multiplied by `aetherLightAt(element, dirs[i]·AETHER_LOBE_R, [0,0,0], light)` (viewer = the planet: the mirror sees the flows from the centre). `export const AETHER_LOBE_R = 1.4` (the orbit radius — where the element flows live). `export function mulberry32(seed)` (Task 4 reuses it).

- [ ] **Step 1: Write the failing test** (append to `aetherLobes.test.js`; add `AETHER_LOBE_R`, `AETHER_BASE_DIRS`, `mulberry32` to its import from `'../aetherLobes'`, and import `aetherLightAt` from `'../aetherLight'`)

```js
describe('aetherLobeColors — the mirror sees the lit flows', () => {
  const light = { floor: 0.2, pen: 0.08, R: 0.75 };
  it('without dirs it is unchanged (back-compatible)', () => {
    const a = aetherLobeColors({ fluid: 0.45, air: 0.12 });
    const b = aetherLobeColors({ fluid: 0.45, air: 0.12 }, undefined, null, null);
    expect(b).toEqual(a);
  });
  it('each lit element is weighted by its light at the lobe; fire is not', () => {
    const dirs = AETHER_BASE_DIRS;
    const plain = aetherLobeColors({ fluid: 0.45, thermal: 0.12 });
    const lit = aetherLobeColors({ fluid: 0.45, thermal: 0.12 }, undefined, dirs, light);
    const fireOnly = aetherLobeColors({ thermal: 0.12 }, undefined, dirs, light);
    const fluidOnlyPlain = aetherLobeColors({ fluid: 0.45 });
    for (let i = 0; i < dirs.length; i++) {
      const k = aetherLightAt('fluid', dirs[i].map((c) => c * AETHER_LOBE_R), [0, 0, 0], light);
      for (let ch = 0; ch < 3; ch++) {
        expect(lit[i][ch]).toBeCloseTo(fireOnly[i][ch] + k * fluidOnlyPlain[i][ch], 12);
      }
    }
    expect(lit).not.toEqual(plain);
  });
  it('mulberry32 is exported and deterministic', () => {
    const a = mulberry32(7), b = mulberry32(7);
    expect(a()).toBe(b());
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/aetherLobes.test.js`
Expected: FAIL (`AETHER_LOBE_R` / `mulberry32` not exported).

- [ ] **Step 3: Implement in `aetherLobes.js`**

Change `function mulberry32(seed)` to `export function mulberry32(seed)`. Add the import at the top and replace `aetherLobeColors`:

```js
import { aetherLightAt } from './aetherLight';

// The flows live on the orbit ring; the mirror sees them from the planet (viewer at the centre).
export const AETHER_LOBE_R = 1.4;
const ORIGIN = Object.freeze([0, 0, 0]);
const lobeP = [0, 0, 0];

export function aetherLobeColors(opacities, out = newBuffer(), dirs = null, light = null) {
  for (let i = 0; i < AETHER_LOBES; i++) {
    if (dirs && light) {
      lobeP[0] = dirs[i][0] * AETHER_LOBE_R; lobeP[1] = dirs[i][1] * AETHER_LOBE_R; lobeP[2] = dirs[i][2] * AETHER_LOBE_R;
    }
    let r = 0, g = 0, b = 0;
    for (const p of AETHER_PHASES) {
      const o = (opacities[p] ?? 0) * (dirs && light ? aetherLightAt(p, lobeP, ORIGIN, light) : 1);
      const c = LINEAR[p][i % 3];
      r += o * c[0]; g += o * c[1]; b += o * c[2];
    }
    out[i][0] = r; out[i][1] = g; out[i][2] = b;
  }
  return out;
}
```

(`aetherLightAt` returns 1 for `thermal`, so fire is unweighted.) Check `aetherLight.js` does not import `aetherLobes.js` (it must not — no cycle).

- [ ] **Step 4: Wire it in `MercuryPlanet.jsx`**

In the `aether` memo (~line 378), add a reusable light object next to `dirs`/`cols`:

```js
    light: { floor: PLANET_TUNE.aetherFloor, pen: PLANET_TUNE.aetherPenumbra, R: R_SCENE },
```

Replace the per-frame call (~line 677):

```js
    aether.light.floor = PLANET_TUNE.aetherFloor;
    aether.light.pen = PLANET_TUNE.aetherPenumbra;
    aether.light.R = R_SCENE * drop.coreScale;
    aetherLobeColors(emitRef.current, aether.cols, aether.dirs, aether.light);
```

- [ ] **Step 5: Run tests + lint**

Run: `npx vitest run src/terminal/mercury` — all PASS (the planet shader snapshot is unchanged: only uniform VALUES change).
Run: `npm run lint` — 0 errors, warnings ≤ 153.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/mercury/planet/aetherLobes.js src/terminal/mercury/planet/__tests__/aetherLobes.test.js src/terminal/mercury/MercuryPlanet.jsx
git commit -m "feat(mercury): the liquid mirror reflects the flows as lit — the shadow lane reaches the aether lobes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The bead sim — `planet/hgBeads.js` (+ tier caps)

**Files:**
- Create: `src/terminal/mercury/planet/hgBeads.js`
- Modify: `src/terminal/mercury/planet/planetQuality.js` (`beads` per tier)
- Test: `src/terminal/mercury/planet/__tests__/hgBeads.test.js`; append to `planetQuality.test.js`

**Interfaces:**
- Consumes: `mulberry32` from `./aetherLobes` (Task 3); `SUN_DIR_WORLD` from `./planetFrame`.
- Produces:
  - `createBeads(cap, seed = 0x6867) → b` with `b.cap`, `b.n`, `b.pos: Float32Array(cap*3)`, `b.vel: Float32Array(cap*3)`, `b.r: Float32Array(cap)`, `b.age: Float32Array(cap)`, `b.acc` (ambient accumulator), `b.rng`; packed outputs `b.outPos: Float32Array(cap*3)`, `b.outBead: Float32Array(cap*2)` (radius, alpha).
  - `spawnBead(b, x, y, z, vx, vy, vz, r)` (evicts the oldest when full)
  - `spawnFling(b, omega[3], coreR, n)`, `spawnSplash(b, dirW[3], coreR, n)`
  - `stepBeads(b, dt, ctx)` with `ctx = { phase, coreR, calm, liquid, boil }` → returns `b.n`; writes `outPos`/`outBead` for `0..n-1`.
  - Constants: `BEAD_R_MIN = 0.004`, `BEAD_R_MAX = 0.012`, `AMBIENT_RATE = 6`, `BOIL_GAIN = 4`, `BEAD_LIFE = 8`, `BEAD_FADE = 1.5`, `G_BEAD = 0.12`, `DRAG = 1.5`, `EVAP_RATE = 0.004`, `FLING_N = 24`, `SPLASH_N = 6`, `FLING_GAIN = 1.1`.
  - `TIERS.full.beads = 256`, `TIERS.phone.beads = 64`, `TIERS.lite.beads = 32`.

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/mercury/planet/__tests__/hgBeads.test.js
import { describe, it, expect } from 'vitest';
import {
  createBeads, spawnBead, spawnFling, spawnSplash, stepBeads,
  AMBIENT_RATE, BEAD_LIFE, BEAD_R_MIN, EVAP_RATE, FLING_N,
} from '../hgBeads';
import { SUN_DIR_WORLD } from '../planetFrame';

const CTX = { phase: 'air', coreR: 0.75, calm: false, liquid: true, boil: 0 };
const run = (b, seconds, ctx = CTX, dt = 1 / 60) => { for (let t = 0; t < seconds; t += dt) stepBeads(b, dt, ctx); return b.n; };

describe('hgBeads sim', () => {
  it('ambient trickle settles near rate × life (a few dozen), off the sunlit side', () => {
    const b = createBeads(256);
    run(b, 1 / 60);
    const n = run(b, 20);
    expect(n).toBeGreaterThan(AMBIENT_RATE * BEAD_LIFE * 0.5);
    expect(n).toBeLessThanOrEqual(AMBIENT_RATE * BEAD_LIFE * 1.3);
  });
  it('a frozen planet sheds nothing; boiling sheds more', () => {
    const frozen = createBeads(256); run(frozen, 5, { ...CTX, liquid: false });
    expect(frozen.n).toBe(0);
    const boiling = createBeads(256); run(boiling, 2, { ...CTX, boil: 1 });
    const still = createBeads(256); run(still, 2, CTX);
    expect(boiling.n).toBeGreaterThan(still.n * 2);
  });
  it('new ambient beads leave from the sunward hemisphere', () => {
    const b = createBeads(256);
    run(b, 0.5, { ...CTX, phase: 'none' }); // no flow: gravity is radial, so a bead keeps its direction
    for (let i = 0; i < b.n; i++) {
      const d = [b.pos[3 * i], b.pos[3 * i + 1], b.pos[3 * i + 2]];
      expect(d[0] * SUN_DIR_WORLD[0] + d[2] * SUN_DIR_WORLD[2]).toBeGreaterThan(0);
    }
  });
  it('the cap holds and the oldest bead is evicted first', () => {
    const b = createBeads(4);
    for (let k = 0; k < 4; k++) { spawnBead(b, k, 0, 2, 0, 0, 0, 0.01); b.age[k] = 10 - k; }
    spawnBead(b, 9, 0, 2, 0, 0, 0, 0.01);
    expect(b.n).toBe(4);
    const xs = Array.from(b.pos.filter((_, i) => i % 3 === 0));
    expect(xs).not.toContain(0); // age 10 was the oldest
    expect(xs).toContain(9);
  });
  it('a fling throws FLING_N beads tangentially around the spin axis', () => {
    const b = createBeads(256);
    spawnFling(b, [0, 3, 0], 0.75, FLING_N);
    expect(b.n).toBe(FLING_N);
    for (let i = 0; i < b.n; i++) {
      expect(Math.abs(b.pos[3 * i + 1])).toBeLessThan(1e-6); // on the equator of the spin
      const tangential = b.pos[3 * i] * b.vel[3 * i + 2] - b.pos[3 * i + 2] * b.vel[3 * i];
      expect(Math.sign(tangential)).toBe(-1); // ω = +Y: v = ω × p
    }
  });
  it('a bead that falls back into the planet merges (is removed)', () => {
    const b = createBeads(8);
    spawnBead(b, 0, 0, 0.8, 0, 0, -2, 0.01);
    run(b, 0.2, { ...CTX, liquid: false }); // no trickle, so the count is only this bead
    expect(b.n).toBe(0);
  });
  it('fire evaporates beads', () => {
    const b = createBeads(8);
    spawnBead(b, 0, 1.2, 0, 0, 0, 0, BEAD_R_MIN * 1.5);
    run(b, (BEAD_R_MIN * 1.5) / EVAP_RATE + 0.5, { ...CTX, phase: 'thermal', liquid: false });
    expect(b.n).toBe(0);
  });
  it('calm: no trickle, splashes spawn but do not move', () => {
    const b = createBeads(16);
    spawnSplash(b, [1, 0, 0], 0.75, 3);
    const x0 = b.pos[0];
    run(b, 1, { ...CTX, calm: true });
    expect(b.n).toBe(3);
    expect(b.pos[0]).toBe(x0);
  });
  it('packs position and (radius, alpha) into reused buffers', () => {
    const b = createBeads(8);
    const p = b.outPos, q = b.outBead;
    spawnBead(b, 0.1, 1.5, 0.2, 0, 0, 0, 0.01);
    stepBeads(b, 1 / 60, { ...CTX, liquid: false });
    expect(b.outPos).toBe(p); expect(b.outBead).toBe(q);
    expect(b.outBead[0]).toBeCloseTo(0.01, 6);
    expect(b.outBead[1]).toBeGreaterThan(0);
  });
});
```

Append to `planetQuality.test.js` (inside its first `describe`):

```js
  it('bead caps per tier', () => {
    expect(TIERS.full.beads).toBe(256);
    expect(TIERS.phone.beads).toBe(64);
    expect(TIERS.lite.beads).toBe(32);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/hgBeads.test.js src/terminal/mercury/planet/__tests__/planetQuality.test.js`
Expected: FAIL (module missing; `beads` undefined).

- [ ] **Step 3: Tier caps** — in `planetQuality.js` add `beads: 256,` to `full`, `beads: 64,` to `phone`, `beads: 32,` to `lite` (inside each `Object.freeze({ … })`, after `exoSteps`).

- [ ] **Step 4: Write the sim**

```js
// src/terminal/mercury/planet/hgBeads.js — liquid Hg beads in the aether (aether spec §3): sources, motion, sinks.
// Pure (no three). Sources: an ambient trickle off the sunlit liquid surface (the planet's slow loss to space,
// × boiling), fling bursts tangential to the spin, splashes at liquid visitor impacts. Motion: gravity toward
// the planet + drag toward the ACTIVE element's flow velocity. Sinks: life (fade), fire (evaporation), re-entry
// (merge), the cap (oldest first). Preallocated typed arrays; nothing allocates per frame.

import { mulberry32 } from './aetherLobes';
import { SUN_DIR_WORLD } from './planetFrame';

export const BEAD_R_MIN = 0.004;  // scene units (~1 px at the fitted desktop camera)
export const BEAD_R_MAX = 0.012;  // ~3 px
export const AMBIENT_RATE = 6;    // beads/s off the sunlit surface → ~AMBIENT_RATE · BEAD_LIFE alive
export const BOIL_GAIN = 4;       // boiling multiplies the trickle by (1 + BOIL_GAIN · coverage)
export const BEAD_LIFE = 8;       // s
export const BEAD_FADE = 1.5;     // s of fade-in at birth and fade-out before BEAD_LIFE
export const G_BEAD = 0.12;       // GM in scene units: escape speed at r 0.75 ≈ 0.57
export const DRAG = 1.5;          // 1/s toward the active element's flow velocity
export const EVAP_RATE = 0.004;   // radius loss per second in fire
export const FLING_N = 24;
export const SPLASH_N = 6;
export const FLING_GAIN = 1.1;    // × (ω × r) at release
const AMBIENT_V = [0.15, 0.35];   // launch speed range (scene units/s), along the surface normal
const SPLASH_V = 0.35;
const SUN_MIN = 0.2;              // ambient sources: dot(normal, Sun) above this

export function createBeads(cap, seed = 0x6867) {
  return {
    cap, n: 0, acc: 0, rng: mulberry32(seed),
    pos: new Float32Array(cap * 3), vel: new Float32Array(cap * 3),
    r: new Float32Array(cap), age: new Float32Array(cap),
    outPos: new Float32Array(cap * 3), outBead: new Float32Array(cap * 2),
  };
}

function oldest(b) {
  let k = 0;
  for (let i = 1; i < b.n; i++) if (b.age[i] > b.age[k]) k = i;
  return k;
}

export function spawnBead(b, x, y, z, vx, vy, vz, r) {
  const i = b.n < b.cap ? b.n++ : oldest(b);
  b.pos[3 * i] = x; b.pos[3 * i + 1] = y; b.pos[3 * i + 2] = z;
  b.vel[3 * i] = vx; b.vel[3 * i + 1] = vy; b.vel[3 * i + 2] = vz;
  b.r[i] = r; b.age[i] = 0;
}

function remove(b, i) {
  const last = --b.n;
  if (i === last) return;
  for (let c = 0; c < 3; c++) { b.pos[3 * i + c] = b.pos[3 * last + c]; b.vel[3 * i + c] = b.vel[3 * last + c]; }
  b.r[i] = b.r[last]; b.age[i] = b.age[last];
}

const radius = (b) => BEAD_R_MIN + (BEAD_R_MAX - BEAD_R_MIN) * b.rng() * b.rng(); // skewed small

export function spawnFling(b, omega, coreR, n = FLING_N) {
  const w = Math.hypot(omega[0], omega[1], omega[2]);
  const ax = w > 1e-6 ? omega[0] / w : 0, ay = w > 1e-6 ? omega[1] / w : 1, az = w > 1e-6 ? omega[2] / w : 0;
  // u ⟂ axis (cross with the least-aligned world axis), v = axis × u
  let ux = 0, uy = 0, uz = 0;
  if (Math.abs(ay) < 0.9) { ux = az; uz = -ax; } else { uy = -az; uz = ay; } // axis × Y or axis × X
  const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
  const vx = ay * uz - az * uy, vy = az * ux - ax * uz, vz = ax * uy - ay * ux;
  const R = coreR * 1.02;
  for (let k = 0; k < n; k++) {
    const phi = b.rng() * 2 * Math.PI, c = Math.cos(phi), s = Math.sin(phi);
    const dx = ux * c + vx * s, dy = uy * c + vy * s, dz = uz * c + vz * s;
    const px = dx * R, py = dy * R, pz = dz * R;
    const wx = omega[0] * FLING_GAIN, wy = omega[1] * FLING_GAIN, wz = omega[2] * FLING_GAIN;
    spawnBead(b, px, py, pz, wy * pz - wz * py + dx * 0.1, wz * px - wx * pz + dy * 0.1, wx * py - wy * px + dz * 0.1, radius(b));
  }
}

export function spawnSplash(b, dirW, coreR, n = SPLASH_N) {
  const R = coreR * 1.02;
  for (let k = 0; k < n; k++) {
    const j = () => (b.rng() - 0.5) * 0.3;
    spawnBead(b, dirW[0] * R, dirW[1] * R, dirW[2] * R,
      (dirW[0] + j()) * SPLASH_V, (dirW[1] + j()) * SPLASH_V, (dirW[2] + j()) * SPLASH_V, radius(b));
  }
}

function spawnAmbient(b, coreR) {
  let x, y, z, l;
  do { x = b.rng() * 2 - 1; y = b.rng() * 2 - 1; z = b.rng() * 2 - 1; l = Math.hypot(x, y, z); }
  while (l > 1 || l < 1e-3 || (x * SUN_DIR_WORLD[0] + y * SUN_DIR_WORLD[1] + z * SUN_DIR_WORLD[2]) / l < SUN_MIN);
  x /= l; y /= l; z /= l;
  const v = AMBIENT_V[0] + (AMBIENT_V[1] - AMBIENT_V[0]) * b.rng();
  spawnBead(b, x * coreR * 1.02, y * coreR * 1.02, z * coreR * 1.02, x * v, y * v, z * v, radius(b));
}

// The active element's flow velocity at p (scene units/s), written into f. A simplified mirror of each flow.
const f = [0, 0, 0];
function flowVel(phase, x, y, z, age) {
  f[0] = 0; f[1] = 0; f[2] = 0;
  if (phase === 'air') { f[0] = -0.8 * z; f[2] = 0.8 * x; }                       // orbit about +Y
  else if (phase === 'fluid') { f[0] = -0.4 * z; f[2] = 0.4 * x; f[1] = 0.25 * Math.sin(3 * Math.atan2(z, x) + age); } // swirl + undulation
  else if (phase === 'earth') { const l = Math.hypot(x, y, z) || 1; f[0] = 0.15 * x / l; f[1] = 0.15 * y / l; f[2] = 0.15 * z / l; } // lofted dust
  else if (phase === 'thermal') { f[1] = 0.4; }                                    // updraft
}

export function stepBeads(b, dt, ctx) {
  const { phase, coreR, calm, liquid, boil } = ctx;
  if (!calm && liquid) {
    b.acc += AMBIENT_RATE * (1 + BOIL_GAIN * boil) * dt;
    while (b.acc >= 1) { b.acc -= 1; spawnAmbient(b, coreR); }
  }
  for (let i = b.n - 1; i >= 0; i--) {
    b.age[i] += dt;
    if (!calm) {
      const x = b.pos[3 * i], y = b.pos[3 * i + 1], z = b.pos[3 * i + 2];
      const r2 = x * x + y * y + z * z, rl = Math.sqrt(r2) || 1, g = G_BEAD / (r2 * rl);
      flowVel(phase, x, y, z, b.age[i]);
      for (let c = 0; c < 3; c++) {
        const p = b.pos[3 * i + c];
        b.vel[3 * i + c] += (-g * p + DRAG * (f[c] - b.vel[3 * i + c])) * dt;
        b.pos[3 * i + c] += b.vel[3 * i + c] * dt;
      }
      if (phase === 'thermal') b.r[i] -= EVAP_RATE * dt;
    }
    const x = b.pos[3 * i], y = b.pos[3 * i + 1], z = b.pos[3 * i + 2];
    const inside = x * x + y * y + z * z < coreR * coreR;
    if (b.age[i] > BEAD_LIFE || b.r[i] <= 0 || (inside && b.age[i] > 0.05)) remove(b, i);
  }
  for (let i = 0; i < b.n; i++) {
    b.outPos[3 * i] = b.pos[3 * i]; b.outPos[3 * i + 1] = b.pos[3 * i + 1]; b.outPos[3 * i + 2] = b.pos[3 * i + 2];
    const a = Math.min(1, b.age[i] / 0.15, (BEAD_LIFE - b.age[i]) / BEAD_FADE);
    b.outBead[2 * i] = b.r[i]; b.outBead[2 * i + 1] = Math.max(0, a);
  }
  return b.n;
}
```

Note on `inside && age > 0.05`: newborn beads start at 1.02·coreR, so a bead is only merged after it has genuinely fallen back. The "calm: splashes do not move" test relies on the `!calm` guard around integration. The fling test's tangential sign: for ω = +Y, v = ω × p = (ω·pz, 0, −ω·px), so `x·vz − z·vx = −ω(x² + z²) < 0`.

- [ ] **Step 5: Run to verify they pass**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/hgBeads.test.js src/terminal/mercury/planet/__tests__/planetQuality.test.js`
Expected: PASS. If the ambient-range test fails by a small margin, report the measured count — do NOT retune constants silently.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/mercury/planet/hgBeads.js src/terminal/mercury/planet/__tests__/hgBeads.test.js src/terminal/mercury/planet/planetQuality.js src/terminal/mercury/planet/__tests__/planetQuality.test.js
git commit -m "feat(mercury): Hg bead sim — sunlit trickle, fling and splash bursts, carried by the active element; tier caps

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The bead shader — `planet/hgBeadShader.js`

**Files:**
- Create: `src/terminal/mercury/planet/hgBeadShader.js`
- Test: `src/terminal/mercury/planet/__tests__/hgBeadShader.test.js`

**Interfaces:**
- Consumes: `HG_MIRROR_DECLS_GLSL`, `HG_FRESNEL_GLSL`, `HG_ENV_GLSL` from `./hgMirrorGlsl`; `AETHER_SHADOW_GLSL` (Task 1); `EXO_RENDER_ORDER` from `./exosphereShader`; `DROPLET_RENDER_ORDER` from `./dropletShader`; `FALLBACK_ALBEDO` from `./planetLook`.
- Produces: `BEAD_VS`, `BEAD_FS` (strings), `BEAD_MATERIAL` (`{ transparent: true, depthTest: true, depthWrite: false, blending: THREE.NormalBlending }`), `BEAD_RENDER_ORDER = DROPLET_RENDER_ORDER + 1`, `BEAD_MIN_PX = 1.5`, `SUN_TERM_GLSL` (the exact Sun-lobe expression of `envRadiance`), `BEAD_UNIFORMS_OWN = ['uViewportPx', 'uPlanetR', 'uLitPen', 'uSunGlint']`.

The beads use three's GLSL3 mode (`glslVersion: THREE.GLSL3` on a `ShaderMaterial`): `HG_MIRROR_DECLS_GLSL` contains an array constructor (`vec2[16](…)`) that GLSL ES 1.0 rejects. Three maps `attribute`/`varying`/`gl_FragColor` in GLSL3 mode, so the shader is written in that idiom.

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/mercury/planet/__tests__/hgBeadShader.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { BEAD_VS, BEAD_FS, BEAD_MATERIAL, BEAD_RENDER_ORDER, BEAD_MIN_PX, SUN_TERM_GLSL } from '../hgBeadShader';
import { HG_MIRROR_DECLS_GLSL, HG_FRESNEL_GLSL, HG_ENV_GLSL } from '../hgMirrorGlsl';
import { AETHER_SHADOW_GLSL } from '../aetherLight';
import { DROPLET_RENDER_ORDER } from '../dropletShader';

describe('Hg bead shader', () => {
  it('is the planet\'s mirror, by construction', () => {
    for (const chunk of [HG_MIRROR_DECLS_GLSL, HG_FRESNEL_GLSL, HG_ENV_GLSL, AETHER_SHADOW_GLSL]) expect(BEAD_FS).toContain(chunk);
    expect(BEAD_FS).toContain('fresnelHg(');
    expect(BEAD_FS).toContain('envRadiance(R, uRoughLiquid, P, n)');
  });
  it('the shadowed Sun term is the envRadiance Sun term, verbatim (drift guard)', () => {
    expect(HG_ENV_GLSL).toContain(SUN_TERM_GLSL);
    expect(BEAD_FS).toContain(SUN_TERM_GLSL);
  });
  it('a sphere impostor: disc discard, view normal to world, sub-pixel beads by coverage', () => {
    expect(BEAD_FS).toContain('if (d2 > 1.0) discard;');
    expect(BEAD_FS).toContain('transpose(mat3(viewMatrix))');
    expect(BEAD_VS).toContain(`max(px, ${BEAD_MIN_PX.toFixed(1)})`);
  });
  it('draws after the droplets, depth-tested, never writes depth', () => {
    expect(BEAD_RENDER_ORDER).toBeGreaterThan(DROPLET_RENDER_ORDER);
    expect(BEAD_MATERIAL).toEqual({ transparent: true, depthTest: true, depthWrite: false, blending: THREE.NormalBlending });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/hgBeadShader.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Write the shader module**

```js
// src/terminal/mercury/planet/hgBeadShader.js — liquid Hg beads as point-sprite sphere impostors (aether spec §3).
// Shaded by the planet's own mirror (hgMirrorGlsl, interpolated verbatim): exact Hg Fresnel × the analytic sky
// (Sun disc, element emitters, aether lobes). In the planet's shadow the Sun term is removed; a reflected ray that
// hits the planet sees its lit regolith instead of the sky. Solid: depth-tested, but never cleared by planetWindow.

import * as THREE from 'three';
import { glf, v3 } from '../../gl/glf';
import { HG_MIRROR_DECLS_GLSL, HG_FRESNEL_GLSL, HG_ENV_GLSL } from './hgMirrorGlsl';
import { AETHER_SHADOW_GLSL } from './aetherLight';
import { DROPLET_RENDER_ORDER } from './dropletShader';
import { FALLBACK_ALBEDO } from './planetLook';

export const BEAD_MIN_PX = 1.5;
export const BEAD_RENDER_ORDER = DROPLET_RENDER_ORDER + 1;
export const BEAD_MATERIAL = Object.freeze({ transparent: true, depthTest: true, depthWrite: false, blending: THREE.NormalBlending });
export const BEAD_UNIFORMS_OWN = ['uViewportPx', 'uPlanetR', 'uLitPen', 'uSunGlint'];
// The first line of envRadiance, verbatim (the test pins it against HG_ENV_GLSL).
export const SUN_TERM_GLSL = 'vec3(softShoulder(uSunGlint * uSunIrr * uExposure * lobe(dot(R, uSunDir), uSunSinR, rough), SUN_SHOULDER))';

export const BEAD_VS = /* glsl */ `
uniform vec2 uViewportPx;
attribute vec2 aBead; // radius (scene units), alpha
varying vec3 vC;
varying float vR;
varying float vA;
varying float vCover;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float px = 2.0 * aBead.x * 0.5 * uViewportPx.y * projectionMatrix[1][1] / -mv.z;
  vCover = clamp(px / ${BEAD_MIN_PX.toFixed(1)}, 0.0, 1.0);
  gl_PointSize = max(px, ${BEAD_MIN_PX.toFixed(1)});
  vC = (modelMatrix * vec4(position, 1.0)).xyz;
  vR = aBead.x;
  vA = aBead.y;
  gl_Position = projectionMatrix * mv;
}
`;

export const BEAD_FS = /* glsl */ `
${HG_MIRROR_DECLS_GLSL}
${HG_FRESNEL_GLSL}
${HG_ENV_GLSL}
${AETHER_SHADOW_GLSL}
uniform float uPlanetR;
uniform float uLitPen;
varying vec3 vC;
varying float vR;
varying float vA;
varying float vCover;
const vec3 PLANET_ALBEDO = ${v3(FALLBACK_ALBEDO)};

vec3 sunTerm(vec3 R, float rough) {
  return ${SUN_TERM_GLSL};
}

// The reflected ray from P hits the planet → its lit regolith replaces the sky behind it.
vec4 planetInMirror(vec3 P, vec3 R) {
  float b = dot(P, R);
  float c = dot(P, P) - uPlanetR * uPlanetR;
  float disc = b * b - c;
  if (disc <= 0.0) return vec4(0.0);
  float t = -b - sqrt(disc);
  if (t <= 0.0) return vec4(0.0);
  vec3 hn = normalize(P + t * R);
  return vec4(PLANET_ALBEDO * uSunIrr * uExposure * max(dot(hn, uSunDir), 0.0), 1.0);
}

void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  q.y = -q.y;
  float d2 = dot(q, q);
  if (d2 > 1.0) discard;
  vec3 n = normalize(transpose(mat3(viewMatrix)) * vec3(q, sqrt(1.0 - d2)));
  vec3 P = vC + n * vR;
  vec3 V = normalize(cameraPosition - P);
  vec3 R = reflect(-V, n);
  float sh = aetherShadow(vC, uSunDir, uPlanetR, uLitPen);
  vec3 env = envRadiance(R, uRoughLiquid, P, n) - (1.0 - sh) * sunTerm(R, uRoughLiquid);
  vec4 pl = planetInMirror(P, R);
  env = mix(env, pl.rgb * sh, pl.a);
  vec3 col = max(fresnelHg(dot(n, V)) * env, 0.0);
  float edge = 1.0 - smoothstep(1.0 - 2.0 / gl_PointSize, 1.0, sqrt(d2)); // antialiased rim
  gl_FragColor = vec4(col * uExposure, vA * vCover * vCover * edge);
}
`;
```

Note `col * uExposure`: check against `dropletShader.js` how the planet/droplets apply exposure and output encoding — if `dropletShader.js` already multiplies by `uExposure` inside the terms (the Sun term does) and outputs `col` directly, then output `col` without the extra `* uExposure` to match. Use exactly the droplet pass's final-colour convention (read `dropletShader.js` around its `gl_FragColor`/output line) and state which in the report.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/hgBeadShader.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/planet/hgBeadShader.js src/terminal/mercury/planet/__tests__/hgBeadShader.test.js
git commit -m "feat(mercury): Hg bead shader — sphere impostors in the planet's own mirror; glint out in the shadow lane

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Wire the beads into the planet

**Files:**
- Create: `src/terminal/mercury/useHgBeads.js`
- Modify: `src/terminal/mercury/MercuryPlanet.jsx` (prop `activePhase`; hook; fling + splash + trickle; step; render)
- Modify: `src/terminal/mercury/MercuryCanvas.jsx` (pass `activePhase` to `MercuryPlanet`)
- Test: `src/terminal/mercury/__tests__/hgBeadsWiring.test.js`

**Interfaces:**
- Consumes: Task 4 (`createBeads`, `stepBeads`, `spawnFling`, `spawnSplash`, `FLING_N`, `SPLASH_N`), Task 5 (`BEAD_VS`, `BEAD_FS`, `BEAD_MATERIAL`, `BEAD_RENDER_ORDER`), `HG_MIRROR_UNIFORMS` from `./planet/hgMirrorGlsl`, `TIERS`, `PLANET_TUNE`, `bodyToWorld` from `./planet/mercuryImpacts`.
- Produces: `useHgBeads({ tier, planetMaterial }) → { geometry, material, renderOrder, sim, upload(gl, coreR) }`.

- [ ] **Step 1: Write the failing wiring test**

```js
// src/terminal/mercury/__tests__/hgBeadsWiring.test.js — source-level wiring (the repo's idiom for r3f glue).
import { describe, it, expect } from 'vitest';
import hookSrc from '../useHgBeads.js?raw';
import planetSrc from '../MercuryPlanet.jsx?raw';
import canvasSrc from '../MercuryCanvas.jsx?raw';

describe('Hg beads wiring', () => {
  it('the hook shares the planet mirror uniforms and sets GLSL3', () => {
    expect(hookSrc).toContain('for (const name of HG_MIRROR_UNIFORMS) uniforms[name] = planetMaterial.uniforms[name];');
    expect(hookSrc).toContain('glslVersion: THREE.GLSL3');
    expect(hookSrc).toContain('...BEAD_MATERIAL');
    expect(hookSrc).toContain('TIERS[tier].beads');
    expect(hookSrc).toContain('setDrawRange(0, n)');
  });
  it('the planet feeds all three sources and steps once per frame', () => {
    expect(planetSrc).toContain('useHgBeads({ tier, planetMaterial: material })');
    expect(planetSrc).toMatch(/spawnFling\(beads\.sim, /);
    expect(planetSrc).toMatch(/spawnSplash\(beads\.sim, /);
    expect(planetSrc).toMatch(/stepBeads\(beads\.sim, delta, beadCtx\)/);
    expect(planetSrc).toContain('<points geometry={beads.geometry} material={beads.material} renderOrder={beads.renderOrder} frustumCulled={false} />');
  });
  it('the canvas tells the planet which element is active', () => {
    expect(canvasSrc).toMatch(/<MercuryPlanet[\s\S]*?activePhase=\{activePhase\}/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/terminal/mercury/__tests__/hgBeadsWiring.test.js`
Expected: FAIL.

- [ ] **Step 3: Write the hook**

```js
// src/terminal/mercury/useHgBeads.js — the Hg bead pass: sim state, geometry, material and the per-frame upload.
// MercuryPlanet steps the sim at the end of its own useFrame (after the fling/splash sources), then calls upload().
// The mirror uniforms ARE the planet material's objects (one source of truth for the Sun, the elements and the
// aether), except the beads' own glint gain — the useDropletField pattern.

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { createBeads } from './planet/hgBeads';
import { BEAD_VS, BEAD_FS, BEAD_MATERIAL, BEAD_RENDER_ORDER } from './planet/hgBeadShader';
import { HG_MIRROR_UNIFORMS } from './planet/hgMirrorGlsl';
import { TIERS } from './planet/planetQuality';
import { PLANET_TUNE, R_SCENE } from './planet/planetLook';

export default function useHgBeads({ tier, planetMaterial }) {
  const cap = TIERS[tier].beads;
  const sim = useMemo(() => createBeads(cap), [cap]);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(sim.outPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aBead', new THREE.BufferAttribute(sim.outBead, 2).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    return g;
  }, [sim]);
  const material = useMemo(() => {
    const uniforms = {
      uViewportPx: { value: new THREE.Vector2(1, 1) },
      uPlanetR: { value: R_SCENE },
      uLitPen: { value: PLANET_TUNE.aetherPenumbra },
    };
    for (const name of HG_MIRROR_UNIFORMS) uniforms[name] = planetMaterial.uniforms[name];
    uniforms.uSunGlint = { value: planetMaterial.uniforms.uSunGlint.value }; // own: × PLANET_TUNE.beadGlint (upload)
    return new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: BEAD_VS,
      fragmentShader: BEAD_FS,
      uniforms,
      ...BEAD_MATERIAL,
    });
  }, [planetMaterial]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  const upload = (gl, coreR) => {
    const n = sim.n;
    geometry.setDrawRange(0, n);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aBead.needsUpdate = true;
    const u = material.uniforms;
    gl.getDrawingBufferSize(u.uViewportPx.value);
    u.uPlanetR.value = coreR;
    u.uLitPen.value = PLANET_TUNE.aetherPenumbra;
    u.uSunGlint.value = planetMaterial.uniforms.uSunGlint.value * PLANET_TUNE.beadGlint;
  };

  return { geometry, material, renderOrder: BEAD_RENDER_ORDER, sim, upload };
}
```

(Uploading the full arrays each frame is ≤ 256 × 5 floats; `addUpdateRange` is an optimisation not needed at this size.)

- [ ] **Step 4: Wire `MercuryPlanet.jsx`**

a. Imports:
```js
import useHgBeads from './useHgBeads';
import { spawnFling, spawnSplash, stepBeads, FLING_N, SPLASH_N } from './planet/hgBeads';
```
(`bodyToWorld` — add to the existing `./planet/mercuryImpacts` import if not already imported there.)

b. Props: add `activePhase = 'fluid'` to the component's destructured props.

c. After the planet `material` exists (next to the `useDropletField` / `useVisitorField` calls):
```js
  const beads = useHgBeads({ tier, planetMaterial: material });
  const beadCtx = useMemo(() => ({ phase: 'fluid', coreR: R_SCENE, calm: false, liquid: true, boil: 0, lastFam: 'idle', dirW: [0, 0, 0], omega: [0, 0, 0] }), []);
```

d. Fling: in `useFrame`, directly AFTER the whole drop/fire block (the `if (fam.phase === 'idle' || fam.phase === 'hold') { … }` block and the dev-rig blocks above it), add:
```js
    // A fresh fling (any path: release, hyper, dev rig) throws Hg beads off the spin equator.
    if (fam.phase === 'fired' && beadCtx.lastFam !== 'fired' && !calm) {
      beadCtx.omega[0] = body.omega.x; beadCtx.omega[1] = body.omega.y; beadCtx.omega[2] = body.omega.z;
      spawnFling(beads.sim, beadCtx.omega, R_SCENE * drop.coreScale, FLING_N);
    }
    beadCtx.lastFam = fam.phase;
```
(Use the variable that holds the family in that scope — `fam` / `drop.fam`; read the surrounding code.)

e. Splash: in the visitor impacts loop, inside the final `else if (ev.impulse) { … }` branch (liquid impacts; not the frozen `ring` branch, not `calm`), add:
```js
        bodyToWorld(ev.dirBody, body.q, beadCtx.dirW);
        spawnSplash(beads.sim, beadCtx.dirW, R_SCENE * drop.coreScale, SPLASH_N);
```

f. Step + upload: at the very end of `useFrame` (after the aether lobe loop):
```js
    beadCtx.phase = activePhase;
    beadCtx.coreR = R_SCENE * drop.coreScale;
    beadCtx.calm = calm;
    beadCtx.liquid = body.tau >= LIQUID_TAU;
    beadCtx.boil = exo.coverage;
    stepBeads(beads.sim, delta, beadCtx);
    beads.upload(gl, beadCtx.coreR);
```
(`LIQUID_TAU`, `gl`, `exo`, `body`, `drop`, `calm` are already in scope — verify names in the file; `gl` is `useThree((s) => s.gl)`.)

g. Render, after `<MercuryExosphere … />`:
```jsx
      <points geometry={beads.geometry} material={beads.material} renderOrder={beads.renderOrder} frustumCulled={false} />
```

- [ ] **Step 5: Wire `MercuryCanvas.jsx`** — add `activePhase={activePhase}` to the `<MercuryPlanet … />` props.

- [ ] **Step 6: Run tests + lint**

Run: `npx vitest run src/terminal/mercury` — all PASS.
Run: `npm run lint` — 0 errors, warnings ≤ 153.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/mercury/useHgBeads.js src/terminal/mercury/MercuryPlanet.jsx src/terminal/mercury/MercuryCanvas.jsx src/terminal/mercury/__tests__/hgBeadsWiring.test.js
git commit -m "feat(mercury): Hg beads in the scene — the trickle, flings and splashes, carried by the active element

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Live verification (controller)

**Files:** none unless a defect is found (then: fix in a new commit, re-run the covering tests).

- [ ] **Step 1:** Ensure the browser pane is VISIBLE (a hidden pane suspends rAF: the canvas never draws, transitions freeze mid-scale). `preview_start { name: "scale94-dev" }`, open Mercury (`[aria-label="Open Mercury — observer view"]` on desktop). If the pane cannot be shown, use the CDP recipe from memory (`--enable-unsafe-swiftshader`) instead, or ask the author to look on :5173.

- [ ] **Step 2: Compile check** — `read_console_messages` with `onlyErrors: true`: no `THREE.WebGLProgram` shader errors (flows and beads).

- [ ] **Step 3: Screenshots, looked at before any conclusion:**
  1. the shadow lane: lit flows darken anti-sunward behind the planet, coinciding with the amber sodium tail; the edge is soft (no band);
  2. beads: `window.__mercury` → count via the beads' draw range; a bead in front of the planet shows its glint on the sunward (left) side;
  3. a fling (dev rig `DEV_OVERRIDES.breakNow` if exposed on `window`, else a real fast spin-drag) → a burst carried by the active element; switch element (click a handle) and watch the carry change;
  4. thermal active → beads shrink away.

- [ ] **Step 4: Perf** — `?perf=1` HUD on desktop: record p50/p95 frame time with the beads drawing, then with the bead `points` object set `visible = false` from the console (find it in `window.__mercury.scene` by `renderOrder === BEAD_RENDER_ORDER`), same view, same element. Report both. Phone: the author's gate.

- [ ] **Step 5: Full suite + lint**, then report to the author with the screenshots and numbers. Do not push.

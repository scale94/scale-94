# Council Field — Gravitational Accretion Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only WebGL2 layer under the Council Ring SVG that renders a Schwarzschild black hole with an 80°-inclined Keplerian accretion disk, a lensed tether/bridge filament, and infall/flash/jet dynamics timed by the existing 2D collider clock.

**Architecture:** Three pure JS modules bake data (geodesic lookup tables, disk physics, the matter noise texture) and map collider state to uniforms. A GLSL fragment shader, whose constants are interpolated from those modules, does one full-screen pass. `CouncilField.jsx` hosts it through the shared `useShaderCanvas` harness. It reads `simRef`/`uiRef` from `useCouncilCollider`, which gains only two additive exports, and composites with premultiplied source-over between the 2D canvas and the SVG.

**Tech Stack:** React 19, WebGL2 (GLSL ES 3.00), the shared GL harness in `src/terminal/gl/`, Vitest 4 + jsdom + @testing-library/react, the recording GL stub (`src/terminal/gl/__tests__/recordingGL.js`, `driveFrames.js`).

**Spec:** `docs/superpowers/specs/2026-09-25-council-field-accretion-design.md` (rev 2 + Q1 decision). Task 1 appends the plan-time amendments listed below.

## Global Constraints

- **Logic freeze.** Collision, synthesis, ledger, bus and state-machine behaviour stays byte-identical. The only permitted edit to `src/terminal/views/manifesto/useCouncilCollider.js` is (a) `export const COLLIDER_TIMING = { T_INFALL, T_FLASH, T_EJECT, T_COOLDOWN };` and (b) adding `simRef` and `uiRef` to the returned object.
- **Harness profile.** WebGL2 through `useShaderCanvas`: `version: 2`, `strategy: 'lunar'`, `contextOptions { alpha: true, premultipliedAlpha: true, antialias: false }`, `blend: 'premultiplied'`, `trackVisibility: true`, `watchdogMs: 40`, `deps: []`.
- **Resolution.** Full harness DPR (the harness caps at 2). No reduced-resolution path. GPU budget under 1.0 ms per frame at 1440 CSS width, DPR 2.
- **Geometry.** Coordinates are viewBox `-170 0 980 640`, ring centre `(320, 320)`, `R_SEAT = 220`, `R_FOUNDATION = 150`. One r_s is 14 u. The disk spans 3–10 r_s. `b_c = 3√3/2 r_s`.
- **Orientation.** Inclination `i = 80°`. `SPIN_SIGN = +1`: the east (sidelined) side approaches and burns bright.
- **Composite.** Premultiplied source-over. Shadow pixels output `(0,0,0,1)`, emissive pixels `(rgb, max(rgb))`, empty pixels `(0,0,0,0)`.
- **Snapshots.** Snapshots are captured once and never refreshed with `vitest -u`.
- **Lint gate.** `npm run lint` must pass: 0 errors, warnings ≤ 153.
- **Git.** Never push. Every commit message ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Plan-time amendments to the spec (Task 1 writes these into the spec)

1. **§2, reason 1 is factually wrong.** Today the 2D collider does **not** run under reduced motion (`useCouncilCollider.js` gate: `if (mq.matches) { setRunning(false); return; }`), so reduced-motion users already cannot fire a collision. The architecture still stands on reasons 2 (no-WebGL resilience) and 3 (timing policy). The reduced-motion gap predates this work and is out of scope.
2. **§7.1 tables.**
   - `u_geodesic` is R16F (one channel). The capture (0) and escape (FAR) sentinels make the proposed G channel redundant.
   - `u_deflect` is 256 wide, not 1024. Deflection is smooth away from `b_c`, where the sinh warp already concentrates samples, and baking 1024 escape integrations breaks the 30 ms budget.
3. **§7.4 temperature exponent.**
   - The physical `T ∝ F^{1/4}` spans only 12 000 K → 8 200 K across 3–10 r_s, so it can never reach the ember at the outer edge that §7.4 also asks for.
   - The plan uses `T = T_PEAK · (F/F_MAX)^{T_EXP}`, with `T_EXP ≈ 1.237` fitted so that `T(10 r_s) = 1 800 K`. This keeps the Novikov–Thorne peak location (49/12 r_s) and the zero-torque inner edge. It is render-scale, not physical.
4. **§5 uniforms added.**
   - `u_flow` (vec4: `tau0, tau1, seed0, seed1`) and `u_flow_w`: flow phases are computed in float64 JS, because float32 `fract(t/T)` in GLSL degrades after long uptimes.
   - `u_lens_d`: the source distance that sets the Einstein radius to 3.5 r_s.
5. **§6 refinements.**
   - SYNTHESIZED at rest draws no bridge. A permanent bridge would also appear on a hydrated reload that never flew.
   - A user cycle's COOLDOWN keeps intensity 1, and an ambient COOLDOWN keeps 0.4, so the disk boost relaxes instead of snapping. No filament is drawn in COOLDOWN.
6. **§10.4 weak-field test.** "`2 r_s/b` within 1% at b = 50" is wrong: the second-order term alone is 2.9% there. The plan tests `2 r_s/b` within 0.5% at b = 500, and the third-order expansion `4x + (15π/4)x² + (128/3)x³` (x = M/b) within 0.1% at b = 50.
7. **§7.4 blackbody range.** The Kim et al. (2002) Planckian-locus fit is valid from 1 667 to 25 000 K, not 1 000–40 000 K. Temperatures are clamped to that range.

## File Structure

All new source lives beside the ring, following the flat `council*.js` pattern in `src/terminal/views/manifesto/`:

| File | Responsibility |
|---|---|
| `useCouncilCollider.js` (modify) | + `COLLIDER_TIMING` export; + `simRef`/`uiRef` in the return value. Nothing else. |
| `councilGeodesics.js` (new) | Binet RK4 integrator, capture/escape tracing, the deflection angle, baked + cached tables, `LENS_D`. |
| `councilFieldPhysics.js` (new) | Inclination and spin constants, emissivity, temperature, redshift factor, blackbody fit, counter-jet ratio. The single source for shader constants. |
| `councilMatter.js` (new) | Periodic value-noise bake (R8 512²), Keplerian angular velocity, two-layer flow phases. |
| `councilFieldUniforms.js` (new) | `readFieldUniforms` (spec §6 mapping), `hexToLinear`, and the JS mirrors of the GLSL infall arm and jet head. |
| `councilFieldShader.js` (new) | `FIELD_VS`, `FIELD_FS` (template-interpolated constants), `FIELD_UNIFORMS`, `glf`. |
| `CouncilField.jsx` (new) | Harness host: texture upload, per-frame uniform paint, resize, reduced-motion snap, liveness callback. |
| `CouncilRing.jsx` (modify) | Mounts `CouncilField`, tracks the fine pointer in viewBox space, isolates the cell, hides `◉` while live. |
| `src/terminal/gl/__tests__/recordingGL.js` (modify) | + `R8`, `R16F`, `RED` constants. It records calls only, so no existing snapshot changes. |

Tests live in `src/terminal/views/manifesto/__tests__/`.

---

### Task 1: Collider read-only seam + spec amendments

**Files:**
- Modify: `src/terminal/views/manifesto/useCouncilCollider.js:20` (add export after the timing line) and `:341-352` (return object)
- Modify: `docs/superpowers/specs/2026-09-25-council-field-accretion-design.md` (§2 reason 1; append §12)
- Test: `src/terminal/views/manifesto/__tests__/colliderSeam.test.jsx`

**Interfaces:**
- Produces: `COLLIDER_TIMING: { T_INFALL: 2600, T_FLASH: 380, T_EJECT: 1100, T_COOLDOWN: 3200 }`. The object returned by `useCouncilCollider(...)` gains `simRef` (a ref to `{ phase, t0, pair: [seatIdxA, seatIdxB] | null, product: { angle, targetR, boundaryR, color } | null, ordinal, particles, userPair, isUser? }`) and `uiRef` (a ref to `{ mode: 'AMBIENT'|'ARMED'|'FIRING'|'SYNTHESIZED', armedDim, pair: [dimA, dimB] | null, record }`). Note that `sim.pair` holds **seat indexes into `seated`**, while `ui.pair` and `ui.armedDim` hold **dimIndex** values.

- [ ] **Step 1: Write the failing test**

```jsx
// src/terminal/views/manifesto/__tests__/colliderSeam.test.jsx
import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useCouncilCollider, COLLIDER_TIMING } from '../useCouncilCollider';

describe('useCouncilCollider read-only seam (field spec §2)', () => {
  beforeEach(() => localStorage.clear());

  it('exports the loop timing unchanged', () => {
    expect(COLLIDER_TIMING).toEqual({ T_INFALL: 2600, T_FLASH: 380, T_EJECT: 1100, T_COOLDOWN: 3200 });
  });

  it('exposes the sim and ui refs it already holds', () => {
    const { result } = renderHook(() => useCouncilCollider({ seated: [], enabled: false }));
    expect(result.current.simRef.current).toMatchObject({ phase: 'IDLE', pair: null });
    expect(result.current.uiRef.current.mode).toBe('AMBIENT');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/colliderSeam.test.jsx`
Expected: FAIL. `COLLIDER_TIMING` is undefined and `result.current.simRef` is undefined.

- [ ] **Step 3: Add the two exports (nothing else)**

In `useCouncilCollider.js`, directly after line 20 (`const T_INFALL = 2600, T_FLASH = 380, T_EJECT = 1100, T_COOLDOWN = 3200;`) add:

```js
// Read-only mirror for the accretion field (CouncilField). The loop below
// still reads the local constants; this object is never consulted by it.
export const COLLIDER_TIMING = { T_INFALL, T_FLASH, T_EJECT, T_COOLDOWN };
```

In the returned object at the end of the hook, add two fields after `canvasRef,`:

```js
  return {
    canvasRef,
    simRef, // read-only for CouncilField — never write through it
    uiRef,  // read-only for CouncilField — never write through it
    mode: ui.mode,
```

- [ ] **Step 4: Run the seam test and the untouched collider suites**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/`
Expected: PASS, including `councilCollider`, `councilSynthesis`, `councilLedger` and `councilStateMachine`, with zero edits to their files.

- [ ] **Step 5: Audit the diff**

Run: `git diff --stat src/terminal/views/manifesto/useCouncilCollider.js && git diff src/terminal/views/manifesto/useCouncilCollider.js`
Expected: `1 file changed, 5 insertions(+)`, and the hunks show only the export block and the two return fields.

- [ ] **Step 6: Write the spec amendments**

In the spec, replace:

```
1. `haltOnReducedMotion` would stop it — synthesis would never complete.
```

with:

```
1. ~~`haltOnReducedMotion` would stop it — synthesis would never complete.~~
   **Corrected at plan time:** the 2D collider already does not run under
   reduced motion (`if (mq.matches) { setRunning(false); return; }`), so this
   reason was false. The design stands on reasons 2 and 3. The pre-existing
   reduced-motion gap (no collisions possible) is out of scope.
```

Then append the section below to the end of the spec. Paste amendments 1–7 from this plan's **Plan-time amendments to the spec** section verbatim as the numbered list under the heading.

```markdown
## 12. Plan-time amendments (2026-09-25)

Recorded while writing the implementation plan
(`docs/superpowers/plans/2026-09-25-council-field-accretion.md`), which
lists each with its reason:
```

- [ ] **Step 7: Commit**

```bash
git add src/terminal/views/manifesto/useCouncilCollider.js src/terminal/views/manifesto/__tests__/colliderSeam.test.jsx docs/superpowers/specs/2026-09-25-council-field-accretion-design.md
git commit -m "feat(manifesto): expose collider sim/ui refs + timing for the accretion field" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Schwarzschild geodesic tables

**Files:**
- Create: `src/terminal/views/manifesto/councilGeodesics.js`
- Test: `src/terminal/views/manifesto/__tests__/councilGeodesics.test.js`

**Interfaces:**
- Produces: `B_C, LUT_W, B_MAX, PHI_MAX, N_B (512), N_PHI (512), FAR (1000), X_MIN, X_MAX, N_D (256), D_B_MAX (16), D_X_MAX, ALPHA_CAP, EINSTEIN_B (3.5)`
- Produces: `rowImpact(j) → b`, `deflectImpact(i) → b`, `traceRay(b, n = N_PHI) → Float32Array` (r per φ sample, 0 = captured, FAR = escaped), and `deflectionAngle(b, step = 0.0005) → number | Infinity`.
- Produces: `bakeGeodesicTable() → Float32Array(N_B*N_PHI)` in row-major order (row = b), `bakeDeflectionTable() → Float32Array(N_D)`, and `geodesicTables() → { geodesic, deflect, lensD }` (cached).

- [ ] **Step 1: Write the failing tests**

```js
// src/terminal/views/manifesto/__tests__/councilGeodesics.test.js
import { describe, it, expect } from 'vitest';
import {
  B_C, FAR, N_B, N_PHI, EINSTEIN_B,
  rowImpact, deflectImpact, traceRay, deflectionAngle,
  bakeGeodesicTable, bakeDeflectionTable, geodesicTables,
} from '../councilGeodesics';

describe('councilGeodesics — Schwarzschild photon orbits (spec §7.1, §10.4)', () => {
  it('places the capture threshold at b_c = 3√3/2 r_s within 0.1%', () => {
    let lo = 2.4, hi = 2.8; // lo is captured, hi escapes
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (deflectionAngle(mid) === Infinity) lo = mid; else hi = mid;
    }
    expect(Math.abs(hi - B_C) / B_C).toBeLessThan(1e-3);
  });

  it('matches weak-field deflection 2 r_s / b within 0.5% at b = 500', () => {
    expect(Math.abs(deflectionAngle(500) / (2 / 500) - 1)).toBeLessThan(5e-3);
  });

  it('matches the third-order expansion within 0.1% at b = 50', () => {
    const x = 0.5 / 50; // M/b with r_s = 1
    const expected = 4 * x + ((15 * Math.PI) / 4) * x ** 2 + (128 / 3) * x ** 3;
    expect(Math.abs(deflectionAngle(50) / expected - 1)).toBeLessThan(1e-3);
  });

  it('winds more than 2π just outside b_c, matching the strong-deflection limit', () => {
    const b = B_C + 1e-3;
    const bozza = -Math.log(b / B_C - 1) + Math.log(216 * (7 - 4 * Math.sqrt(3))) - Math.PI;
    const a = deflectionAngle(b);
    expect(a).toBeGreaterThan(2 * Math.PI);
    expect(Math.abs(a / bozza - 1)).toBeLessThan(5e-3);
  });

  it('warps rows so b = 0 at row 0, b = 24 at the last row, and deflection starts at b_c', () => {
    expect(rowImpact(0)).toBeCloseTo(0, 9);
    expect(rowImpact(N_B - 1)).toBeCloseTo(24, 9);
    expect(deflectImpact(0)).toBeCloseTo(B_C, 12);
  });

  it('traces captured rays to 0, escaped rays to FAR, and bends periapsis inside b', () => {
    expect(traceRay(1.0)[N_PHI - 1]).toBe(0);
    expect(traceRay(20)[N_PHI - 1]).toBe(FAR);
    const peri = Math.min(...traceRay(8));
    expect(peri).toBeLessThan(8);
    expect(peri).toBeGreaterThan(6.5);
  });

  it('bakes bit-identical tables', () => {
    expect(bakeGeodesicTable()).toEqual(bakeGeodesicTable());
    expect(bakeDeflectionTable()).toEqual(bakeDeflectionTable());
  });

  it('bakes deflection at the coarse step within 1e-4 of the fine integrator', () => {
    const t = bakeDeflectionTable();
    for (const i of [8, 64, 128, 255]) {
      const fine = Math.min(deflectionAngle(deflectImpact(i)), 4 * Math.PI);
      expect(Math.abs(t[i] - fine)).toBeLessThan(1e-4 * Math.max(1, fine));
    }
  });

  it('sets the lens distance so the Einstein ring sits at 3.5 r_s', () => {
    const { lensD } = geodesicTables();
    expect(Math.abs(EINSTEIN_B - lensD * deflectionAngle(EINSTEIN_B))).toBeLessThan(1e-9);
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilGeodesics.test.js`
Expected: FAIL with "Failed to resolve import ../councilGeodesics".

- [ ] **Step 3: Implement**

```js
// src/terminal/views/manifesto/councilGeodesics.js
// Exact Schwarzschild photon orbits, baked once (field spec §7.1).
//
// Units: r_s = 1. Orbits obey the Binet equation d²u/dφ² = −u + 1.5u²,
// u = 1/r. A ray from infinity with impact parameter b starts at u = 0,
// du/dφ = 1/b. By spherical symmetry its whole path depends on b alone, so
// the shader looks rays up in a table instead of marching them.

export const B_C = (3 * Math.sqrt(3)) / 2; // critical impact parameter: the shadow edge
export const LUT_W = 0.5;                   // sinh warp width: rows crowd around B_C
export const B_MAX = 24;
export const PHI_MAX = 3 * Math.PI;         // primary + secondary crossings fit inside
export const N_B = 512;
export const N_PHI = 512;
export const FAR = 1000;                    // "escaped" sentinel, half-float safe
export const X_MIN = Math.asinh((0 - B_C) / LUT_W);
export const X_MAX = Math.asinh((B_MAX - B_C) / LUT_W);
export const N_D = 256;
export const D_B_MAX = 16;                  // lensing tapers out by R_FOUNDATION ≈ 10.7 r_s
export const D_X_MAX = Math.asinh((D_B_MAX - B_C) / LUT_W);
export const ALPHA_CAP = 4 * Math.PI;
export const EINSTEIN_B = 3.5;

const SUBSTEPS = 4;
const FINE_STEP = 0.0005;
const BAKE_STEP = 0.002;
const ESCAPE_PHI_MAX = 8 * Math.PI;

const accel = (u) => -u + 1.5 * u * u;

// One RK4 step of (u, w = du/dφ), in place: the bake runs ~2M of these.
function rk4(s, h) {
  const { u, w } = s;
  const k1u = w,                 k1w = accel(u);
  const k2u = w + 0.5 * h * k1w, k2w = accel(u + 0.5 * h * k1u);
  const k3u = w + 0.5 * h * k2w, k3w = accel(u + 0.5 * h * k2u);
  const k4u = w + h * k3w,       k4w = accel(u + h * k3u);
  s.u = u + (h / 6) * (k1u + 2 * k2u + 2 * k3u + k4u);
  s.w = w + (h / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
}

export const rowImpact = (j) => B_C + LUT_W * Math.sinh(X_MIN + (X_MAX - X_MIN) * (j / (N_B - 1)));
export const deflectImpact = (i) => B_C + LUT_W * Math.sinh(D_X_MAX * (i / (N_D - 1)));

// r(φ) at φ_k = k·PHI_MAX/(n−1). 0 once captured (r ≤ r_s), FAR once escaped.
export function traceRay(b, n = N_PHI) {
  const out = new Float32Array(n);
  if (!(b > 1e-6)) return out; // radial ray: captured at once
  const h = PHI_MAX / (n - 1) / SUBSTEPS;
  const s = { u: 0, w: 1 / b };
  let state = 0; // 0 in flight · 1 captured · 2 escaped
  out[0] = FAR;
  for (let k = 1; k < n; k++) {
    for (let i = 0; i < SUBSTEPS && state === 0; i++) {
      rk4(s, h);
      if (s.u >= 1) state = 1;
      else if (s.u <= 0) state = 2;
    }
    out[k] = state === 1 ? 0 : state === 2 ? FAR : Math.min(1 / s.u, FAR);
  }
  return out;
}

// Total deflection α̂ = φ_escape − π. Infinity when captured, or when still
// orbiting at 8π (only within ~e^-22 of B_C).
export function deflectionAngle(b, step = FINE_STEP) {
  if (b <= B_C) return Infinity;
  const s = { u: 0, w: 1 / b };
  let phi = 0;
  while (phi < ESCAPE_PHI_MAX) {
    const uPrev = s.u;
    rk4(s, step);
    phi += step;
    if (s.u >= 1) return Infinity;
    if (s.u <= 0) return phi + step * (s.u / (uPrev - s.u)) - Math.PI; // linear zero crossing
  }
  return Infinity;
}

export function bakeGeodesicTable() {
  const data = new Float32Array(N_B * N_PHI);
  for (let j = 0; j < N_B; j++) data.set(traceRay(rowImpact(j)), j * N_PHI);
  return data;
}

export function bakeDeflectionTable() {
  const data = new Float32Array(N_D);
  for (let i = 0; i < N_D; i++) data[i] = Math.min(deflectionAngle(deflectImpact(i), BAKE_STEP), ALPHA_CAP);
  return data;
}

let cache = null;
export function geodesicTables() {
  if (!cache) {
    cache = {
      geodesic: bakeGeodesicTable(),
      deflect: bakeDeflectionTable(),
      lensD: EINSTEIN_B / deflectionAngle(EINSTEIN_B),
    };
  }
  return cache;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilGeodesics.test.js`
Expected: PASS, 9 tests. If the Bozza test misses by a hair, do **not** loosen it past 1%. Report the measured ratio instead, because it is the check that the photon-ring physics is right.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/manifesto/councilGeodesics.js src/terminal/views/manifesto/__tests__/councilGeodesics.test.js
git commit -m "feat(manifesto): bake exact Schwarzschild geodesic + deflection tables" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Disk physics — emissivity, temperature, redshift, blackbody, jet beaming

**Files:**
- Create: `src/terminal/views/manifesto/councilFieldPhysics.js`
- Test: `src/terminal/views/manifesto/__tests__/councilFieldPhysics.test.js`

**Interfaces:**
- Produces: `INCLINATION_DEG (80), COS_I, SIN_I, SPIN_SIGN (1), R_IN (3), R_OUT (10), R_PEAK, F_MAX, T_PEAK (12000), T_EXP, JET_GAMMA (3), JET_VIEW_DEG (60), COUNTER_JET`
- Produces: `emissivity(r)`, `temperature(r)`, `redshiftFactor(r, b, cosAlpha) → g`, `blackbody(T) → [r,g,b]` (linear, max = 1)
- Produces: the coefficient arrays `KIM_X_LOW, KIM_X_HIGH, KIM_Y_1, KIM_Y_2, KIM_Y_3, XYZ_TO_LINEAR_SRGB`, consumed by the shader template in Task 6.

- [ ] **Step 1: Write the failing tests**

```js
// src/terminal/views/manifesto/__tests__/councilFieldPhysics.test.js
import { describe, it, expect } from 'vitest';
import {
  emissivity, F_MAX, R_PEAK, R_IN, R_OUT, temperature, T_PEAK,
  redshiftFactor, blackbody, COUNTER_JET, SPIN_SIGN,
} from '../councilFieldPhysics';

describe('councilFieldPhysics (spec §7.3–7.4, §7.8, §9 Q1)', () => {
  it('emissivity is zero at the ISCO and peaks at 49/12 r_s', () => {
    expect(emissivity(R_IN)).toBe(0);
    expect(R_PEAK).toBeCloseTo(49 / 12, 12);
    expect(emissivity(R_PEAK - 0.01)).toBeLessThan(F_MAX);
    expect(emissivity(R_PEAK + 0.01)).toBeLessThan(F_MAX);
  });

  it('runs 12 000 K at the emissivity peak down to an 1 800 K ember at the outer edge', () => {
    expect(temperature(R_PEAK)).toBeCloseTo(T_PEAK, 6);
    expect(temperature(R_OUT)).toBeCloseTo(1800, 6);
  });

  it('blueshifts the east (sidelined) side and redshifts the west for SPIN_SIGN +1', () => {
    expect(SPIN_SIGN).toBe(1);
    const east = redshiftFactor(4, 5, +1);
    const west = redshiftFactor(4, 5, -1);
    expect(east).toBeGreaterThan(1);
    expect(west).toBeLessThan(1);
    expect((east / west) ** 4).toBeGreaterThan(30);
  });

  it('reduces to pure gravitational redshift with no line-of-sight velocity', () => {
    expect(redshiftFactor(3, 5, 0)).toBeCloseTo(Math.sqrt(0.5), 12);
  });

  it('maps temperature to blue-white, near-white and ember along the Planckian locus', () => {
    const hot = blackbody(12000);
    expect(hot[2]).toBe(1);
    expect(hot[0]).toBeLessThan(0.8);
    expect(Math.min(...blackbody(6500))).toBeGreaterThan(0.8);
    const ember = blackbody(2000);
    expect(ember[0]).toBe(1);
    expect(ember[1]).toBeLessThan(0.4);
    expect(ember[2]).toBeLessThan(0.05);
  });

  it('dims the counter-jet to ~1.7% (Γ = 3, 60° to the line of sight)', () => {
    expect(COUNTER_JET).toBeCloseTo(0.0166, 3);
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilFieldPhysics.test.js`
Expected: FAIL with "Failed to resolve import ../councilFieldPhysics".

- [ ] **Step 3: Implement**

```js
// src/terminal/views/manifesto/councilFieldPhysics.js
// Accretion-disk physics in r_s = 1 units (field spec §7.3–7.4, §7.8, §9 Q1).
// Every constant here is interpolated into the GLSL by councilFieldShader.js,
// so these tested functions are the shader's reference implementation.

export const INCLINATION_DEG = 80;
export const COS_I = Math.cos((INCLINATION_DEG * Math.PI) / 180);
export const SIN_I = Math.sin((INCLINATION_DEG * Math.PI) / 180);
// +1: the east (sidelined) side approaches and burns bright (§9 Q1, decided).
export const SPIN_SIGN = 1;

export const R_IN = 3;   // ISCO
export const R_OUT = 10; // just inside R_FOUNDATION at 14 u per r_s

// Novikov–Thorne-shaped emissivity: zero torque at the ISCO.
export const emissivity = (r) => (r <= R_IN ? 0 : r ** -3 * (1 - Math.sqrt(R_IN / r)));
export const R_PEAK = ((3.5 * Math.sqrt(3)) / 3) ** 2; // dF/dr = 0 → 49/12
export const F_MAX = emissivity(R_PEAK);

// Render-scale temperature (plan amendment 3): the physical F^(1/4) spans only
// 12 000 → 8 200 K here, so the exponent is fitted to reach an ember at R_OUT.
export const T_PEAK = 12000;
export const T_EXP = Math.log(1800 / T_PEAK) / Math.log(emissivity(R_OUT) / F_MAX);
export const temperature = (r) => T_PEAK * (emissivity(r) / F_MAX) ** T_EXP;

// g = 1/(1+z) for a circular Keplerian orbit (Luminet 1979), image-plane
// cos α measured from +X (east). SPIN_SIGN +1 makes the east side approach.
export function redshiftFactor(r, b, cosAlpha) {
  const onePlusZ = (1 - 1.5 / r) ** -0.5
    * (1 - SPIN_SIGN * Math.sqrt(0.5 / r ** 3) * b * cosAlpha * SIN_I);
  return 1 / Math.max(onePlusZ, 0.05);
}

// Kim et al. (2002) Planckian locus, valid 1 667–25 000 K.
export const KIM_X_LOW = [-0.2661239e9, -0.2343589e6, 0.8776956e3, 0.179910];
export const KIM_X_HIGH = [-3.0258469e9, 2.1070379e6, 0.2226347e3, 0.240390];
export const KIM_Y_1 = [-1.1063814, -1.3481102, 2.18555832, -0.20219683];
export const KIM_Y_2 = [-0.9549476, -1.37418593, 2.09137015, -0.16748867];
export const KIM_Y_3 = [3.081758, -5.8733867, 3.75112997, -0.37001483];
export const XYZ_TO_LINEAR_SRGB = [
  3.2404542, -1.5371385, -0.4985314,
  -0.969266, 1.8760108, 0.041556,
  0.0556434, -0.2040259, 1.0572252,
];

export function blackbody(Tk) {
  const T = Math.min(Math.max(Tk, 1667), 25000);
  const [a, b, c, d] = T <= 4000 ? KIM_X_LOW : KIM_X_HIGH;
  const x = a / T ** 3 + b / T ** 2 + c / T + d;
  const [e, f, g, h] = T <= 2222 ? KIM_Y_1 : T <= 4000 ? KIM_Y_2 : KIM_Y_3;
  const y = e * x ** 3 + f * x ** 2 + g * x + h;
  const X = x / y, Y = 1, Z = (1 - x - y) / y;
  const M = XYZ_TO_LINEAR_SRGB;
  const rgb = [
    M[0] * X + M[1] * Y + M[2] * Z,
    M[3] * X + M[4] * Y + M[5] * Z,
    M[6] * X + M[7] * Y + M[8] * Z,
  ].map((v) => Math.max(v, 0));
  const m = Math.max(...rgb);
  return rgb.map((v) => v / m);
}

// Relativistic jet beaming (§7.8): Doppler factor D = 1/(Γ(1 − β cos θ)).
export const JET_GAMMA = 3;
export const JET_VIEW_DEG = 60;
const JET_BETA = Math.sqrt(1 - 1 / JET_GAMMA ** 2);
const JET_COS = Math.cos((JET_VIEW_DEG * Math.PI) / 180);
export const COUNTER_JET = ((1 - JET_BETA * JET_COS) / (1 + JET_BETA * JET_COS)) ** 4;
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilFieldPhysics.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/manifesto/councilFieldPhysics.js src/terminal/views/manifesto/__tests__/councilFieldPhysics.test.js
git commit -m "feat(manifesto): accretion disk physics — emissivity, redshift, blackbody, jet beaming" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Disk matter — tileable noise and bounded Keplerian flow

**Files:**
- Create: `src/terminal/views/manifesto/councilMatter.js`
- Test: `src/terminal/views/manifesto/__tests__/councilMatter.test.js`

**Interfaces:**
- Consumes: `mulberry32(seed) → () => number in [0,1)` from `./councilCollider`.
- Produces: `MATTER_N (512)`, `T_FLOW (14)`, `INNER_PERIOD_S (7)`, `OMEGA_ISCO_VIS`, `omegaVis(r)`, `makePeriodicNoise(seed) → (x, y) => number in [0,1]`, `bakeMatterTexture(seed?) → Uint8Array(512*512)`, `matterTexture()` (cached), and `flowLayers(tSec) → { tau0, tau1, seed0, seed1, w0 }`.

- [ ] **Step 1: Write the failing tests**

```js
// src/terminal/views/manifesto/__tests__/councilMatter.test.js
import { describe, it, expect } from 'vitest';
import {
  MATTER_N, T_FLOW, OMEGA_ISCO_VIS, omegaVis,
  makePeriodicNoise, bakeMatterTexture, flowLayers,
} from '../councilMatter';

describe('councilMatter (spec §7.3)', () => {
  it('tiles the noise in both axes', () => {
    const f = makePeriodicNoise(7);
    for (const [x, y] of [[0.3, 5.7], [100.25, 311.5], [511.9, 0.1]]) {
      expect(f(x + MATTER_N, y)).toBeCloseTo(f(x, y), 9);
      expect(f(x, y + MATTER_N)).toBeCloseTo(f(x, y), 9);
    }
  });

  it('bakes a deterministic, full-range 8-bit texture', () => {
    const a = bakeMatterTexture();
    expect(a).toEqual(bakeMatterTexture());
    expect(a.length).toBe(MATTER_N * MATTER_N);
    let lo = 255, hi = 0;
    for (const v of a) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    expect(lo).toBeLessThan(40);
    expect(hi).toBeGreaterThan(215);
  });

  it('turns the ISCO in 7 s and the outer edge in ~43 s (Keplerian Ω ∝ r^-3/2)', () => {
    expect(omegaVis(3)).toBeCloseTo(OMEGA_ISCO_VIS, 12);
    expect((2 * Math.PI) / omegaVis(10)).toBeCloseTo(7 * (10 / 3) ** 1.5, 9);
  });

  it('keeps each layer younger than one flow period at any uptime (no wind-up)', () => {
    for (const t of [0, 60, 3600, 86400]) {
      const f = flowLayers(t);
      for (const tau of [f.tau0, f.tau1]) {
        expect(tau).toBeGreaterThanOrEqual(0);
        expect(tau).toBeLessThan(T_FLOW);
      }
    }
    expect(flowLayers(86400).tau0).toBeCloseTo(6, 9); // 86400 − 14·6171, exact in float64
  });

  it('crossfades with a triangle weight: layer 0 silent at reset, full at mid-life', () => {
    expect(flowLayers(0).w0).toBe(0);
    expect(flowLayers(T_FLOW / 2).w0).toBe(1);
  });

  it('re-seeds a layer only while its weight is zero (no visible pop)', () => {
    const k = 5;
    const b0 = flowLayers(k * T_FLOW - 1e-6), a0 = flowLayers(k * T_FLOW + 1e-6);
    expect(a0.seed0).not.toBe(b0.seed0);
    expect(a0.seed1).toBe(b0.seed1);
    expect(b0.w0).toBeLessThan(1e-6);
    expect(a0.w0).toBeLessThan(1e-6);

    const mid = k * T_FLOW + T_FLOW / 2;
    const b1 = flowLayers(mid - 1e-6), a1 = flowLayers(mid + 1e-6);
    expect(a1.seed1).not.toBe(b1.seed1);
    expect(a1.seed0).toBe(b1.seed0);
    expect(1 - b1.w0).toBeLessThan(1e-6);
    expect(1 - a1.w0).toBeLessThan(1e-6);
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilMatter.test.js`
Expected: FAIL with "Failed to resolve import ../councilMatter".

- [ ] **Step 3: Implement**

```js
// src/terminal/views/manifesto/councilMatter.js
// Disk matter for the accretion field (field spec §7.3): a tileable noise
// texture sampled in (log r, ψ), advected by Keplerian shear through two
// crossfaded flow layers so the shear can never wind up.

import { mulberry32 } from './councilCollider';

export const MATTER_N = 512;
export const T_FLOW = 14;            // s: one flow layer's lifetime
export const INNER_PERIOD_S = 7;     // ISCO orbital period on screen
export const OMEGA_ISCO_VIS = (2 * Math.PI) / INNER_PERIOD_S;
export const omegaVis = (r) => OMEGA_ISCO_VIS * (r / 3) ** -1.5;

const OCTAVES = [8, 16, 32, 64];     // lattice periods; each divides MATTER_N → tileable
const CONTRAST = 2.2;
const smooth = (t) => t * t * (3 - 2 * t);

export function makePeriodicNoise(seed = 0x5ca1e94) {
  const rand = mulberry32(seed);
  const grids = OCTAVES.map((p) => {
    const g = new Float32Array(p * p);
    for (let i = 0; i < g.length; i++) g[i] = rand();
    return { p, g, cell: MATTER_N / p };
  });
  const norm = OCTAVES.reduce((s, _, k) => s + 0.5 ** k, 0);
  return (x, y) => {
    let v = 0;
    grids.forEach(({ p, g, cell }, k) => {
      const fx = x / cell, fy = y / cell;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = smooth(fx - x0), ty = smooth(fy - y0);
      const at = (ix, iy) => g[(((iy % p) + p) % p) * p + (((ix % p) + p) % p)];
      const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
      const bot = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
      v += 0.5 ** k * (top + (bot - top) * ty);
    });
    return v / norm;
  };
}

export function bakeMatterTexture(seed) {
  const noise = makePeriodicNoise(seed);
  const out = new Uint8Array(MATTER_N * MATTER_N);
  for (let y = 0; y < MATTER_N; y++) {
    for (let x = 0; x < MATTER_N; x++) {
      const v = (noise(x, y) - 0.5) * CONTRAST + 0.5;
      out[y * MATTER_N + x] = Math.round(Math.min(1, Math.max(0, v)) * 255);
    }
  }
  return out;
}

let cache = null;
export const matterTexture = () => (cache ??= bakeMatterTexture());

// Two layers half a period apart. Each advects for at most T_FLOW seconds,
// then re-seeds exactly when its triangle weight is zero. Computed in float64
// here (not in GLSL) so days of uptime never erode the phase.
export function flowLayers(tSec) {
  const q0 = tSec / T_FLOW;
  const q1 = q0 + 0.5;
  const p0 = q0 - Math.floor(q0);
  const p1 = q1 - Math.floor(q1);
  return {
    tau0: p0 * T_FLOW,
    tau1: p1 * T_FLOW,
    seed0: mulberry32(Math.floor(q0) * 2 + 1)(),
    seed1: mulberry32(Math.floor(q1) * 2 + 2)(),
    w0: 1 - Math.abs(2 * p0 - 1),
  };
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilMatter.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/manifesto/councilMatter.js src/terminal/views/manifesto/__tests__/councilMatter.test.js
git commit -m "feat(manifesto): tileable disk matter + two-layer Keplerian flow without wind-up" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Uniform mapping and GL path mirrors

**Files:**
- Create: `src/terminal/views/manifesto/councilFieldUniforms.js`
- Test: `src/terminal/views/manifesto/__tests__/councilFieldUniforms.test.js`
- Test: `src/terminal/views/manifesto/__tests__/councilFieldPaths.test.js`

**Interfaces:**
- Consumes: `COLLIDER_TIMING` (Task 1), `flowLayers` (Task 4), `polarToXY` from `./councilRingMath`.
- Produces:
  - `UI_MODE = { AMBIENT: 0, ARMED: 1, FIRING: 2, SYNTHESIZED: 3 }` and `ANIM_PHASE = { IDLE: 0, INFALL: 1, FLASH: 2, EJECT: 3, COOLDOWN: 4 }`
  - `AMBIENT_INTENSITY (0.4)`, `SPIRAL_DEG`, `toRing(x, y) → [nx, ny]`, `hexToLinear(hex) → [r,g,b]`
  - `readFieldUniforms(sim, ui, seated, pointer | null, nowMs)`, returning:
    `{ time, uiMode, animPhase, phaseT, phaseMs, seatA:[2], seatB:[2], colorA:[3], colorB:[3], pointer:[2], pointerLive, intensity, eject:[angleRad, targetR, sign], ejectColor:[3], flow:[tau0,tau1,seed0,seed1], flowW }`
  - `infallArmPoint(seatAngleDeg, prog) → {x,y}`, `seatAngleFromXY(x, y) → deg`, `jetHead(eject, phaseT) → {x,y}`
- `seated` entries need `{ dimIndex, angle, hue }` (CouncilRing's `useSeatedMinds`). `pointer` is `{ x, y }` in viewBox units, or null.

- [ ] **Step 1: Write the failing mapping tests**

```js
// src/terminal/views/manifesto/__tests__/councilFieldUniforms.test.js
import { describe, it, expect } from 'vitest';
import {
  readFieldUniforms, hexToLinear, UI_MODE, ANIM_PHASE, AMBIENT_INTENSITY,
} from '../councilFieldUniforms';

const SEATED = [
  { dimIndex: 3, angle: 270, hue: '#FF0088' }, // seat 0: west, (100, 320)
  { dimIndex: 9, angle: 90, hue: '#00FFAA' },  // seat 1: east, (540, 320)
  { dimIndex: 4, angle: 250, hue: '#FFD700' }, // seat 2
];
const WEST_X = 270 / 980; // (100 + 170) / 980
const EAST_X = 710 / 980; // (540 + 170) / 980
const sim = (over = {}) => ({ phase: 'IDLE', t0: 1000, pair: null, product: null, isUser: false, ...over });
const ui = (over = {}) => ({ mode: 'AMBIENT', armedDim: null, pair: null, record: null, ...over });
const RAINBOW = ['#FF0088', '#FF3300', '#FF8C00', '#FFD700', '#AAFF00', '#00FFAA', '#00AAFF', '#0044FF', '#7700FF'];

describe('readFieldUniforms — seat resolution (spec §6 + plan amendment 5)', () => {
  it('AMBIENT with no pair: filament off, disk only', () => {
    const u = readFieldUniforms(sim(), ui(), SEATED, null, 5000);
    expect(u.uiMode).toBe(UI_MODE.AMBIENT);
    expect(u.animPhase).toBe(ANIM_PHASE.IDLE);
    expect(u.intensity).toBe(0);
  });

  it('AMBIENT in flight: sim pair (seat indexes) at ambient intensity', () => {
    const u = readFieldUniforms(sim({ phase: 'INFALL', pair: [0, 1] }), ui(), SEATED, null, 2300);
    expect(u.seatA[0]).toBeCloseTo(WEST_X, 12);
    expect(u.seatA[1]).toBeCloseTo(0.5, 12);
    expect(u.seatB[0]).toBeCloseTo(EAST_X, 12);
    expect(u.intensity).toBe(AMBIENT_INTENSITY);
    expect(u.animPhase).toBe(ANIM_PHASE.INFALL);
    expect(u.phaseT).toBeCloseTo(0.5, 12);
    expect(u.phaseMs).toBe(1300);
  });

  it('AMBIENT cooldown keeps intensity so the disk boost relaxes instead of snapping', () => {
    const u = readFieldUniforms(sim({ phase: 'COOLDOWN', pair: [0, 1] }), ui(), SEATED, null, 2600);
    expect(u.animPhase).toBe(ANIM_PHASE.COOLDOWN);
    expect(u.intensity).toBe(AMBIENT_INTENSITY);
  });

  it('AMBIENT idle between cycles: filament off even with a stale pair', () => {
    const u = readFieldUniforms(sim({ phase: 'IDLE', pair: [0, 1] }), ui(), SEATED, null, 9000);
    expect(u.intensity).toBe(0);
  });

  it('ARMED with a live pointer: tether from the armed seat to the pointer, anim forced idle', () => {
    const u = readFieldUniforms(
      sim({ phase: 'INFALL', pair: [0, 1] }), ui({ mode: 'ARMED', armedDim: 4 }),
      SEATED, { x: 320, y: 0 }, 2000,
    );
    expect(u.uiMode).toBe(UI_MODE.ARMED);
    expect(u.animPhase).toBe(ANIM_PHASE.IDLE);
    expect(u.seatB).toEqual([0.5, 1]);
    expect(u.pointerLive).toBe(1);
    expect(u.colorB).toEqual(u.colorA);
    expect(u.intensity).toBe(1);
  });

  it('ARMED with no fine pointer: the filament collapses onto seat A', () => {
    const u = readFieldUniforms(sim(), ui({ mode: 'ARMED', armedDim: 3 }), SEATED, null, 2000);
    expect(u.seatB).toEqual(u.seatA);
    expect(u.pointerLive).toBe(0);
  });

  it('FIRING while the sim finishes an ambient cycle: static bridge from ui.pair', () => {
    const u = readFieldUniforms(
      sim({ phase: 'INFALL', pair: [2, 1], isUser: false }), ui({ mode: 'FIRING', pair: [3, 9] }),
      SEATED, null, 2000,
    );
    expect(u.seatA[0]).toBeCloseTo(WEST_X, 12); // dim 3 → seat 0, not sim seat 2
    expect(u.animPhase).toBe(ANIM_PHASE.IDLE);
    expect(u.intensity).toBe(1);
  });

  it('FIRING user flight: the sim pair and product drive the dynamics', () => {
    const product = { angle: 90, targetR: 318, boundaryR: 290, color: '#00FFAA' };
    const u = readFieldUniforms(
      sim({ phase: 'FLASH', pair: [0, 1], isUser: true, product }), ui({ mode: 'FIRING', pair: [3, 9] }),
      SEATED, null, 1190,
    );
    expect(u.animPhase).toBe(ANIM_PHASE.FLASH);
    expect(u.phaseT).toBeCloseTo(0.5, 12);
    expect(u.eject).toEqual([0, 318, 1]);
    expect(u.ejectColor).toEqual(hexToLinear('#00FFAA'));
    expect(u.intensity).toBe(1);
  });

  it('SYNTHESIZED at rest draws no bridge; its cooldown still relaxes the boost', () => {
    const rest = readFieldUniforms(sim({ phase: 'IDLE', pair: [0, 1], isUser: true }), ui({ mode: 'SYNTHESIZED', pair: [3, 9] }), SEATED, null, 9000);
    expect(rest.intensity).toBe(0);
    const cool = readFieldUniforms(sim({ phase: 'COOLDOWN', pair: [0, 1], isUser: true }), ui({ mode: 'SYNTHESIZED', pair: [3, 9] }), SEATED, null, 2000);
    expect(cool.animPhase).toBe(ANIM_PHASE.COOLDOWN);
    expect(cool.intensity).toBe(1);
  });

  it('clamps phase_t to [0, 1] and leaves phase_ms raw', () => {
    const early = readFieldUniforms(sim({ phase: 'INFALL', pair: [0, 1] }), ui(), SEATED, null, 900);
    expect(early.phaseT).toBe(0);
    expect(early.phaseMs).toBe(-100);
    const late = readFieldUniforms(sim({ phase: 'INFALL', pair: [0, 1] }), ui(), SEATED, null, 9000);
    expect(late.phaseT).toBe(1);
    expect(late.phaseMs).toBe(8000);
  });

  it('marks a foundation ejection with sign −1', () => {
    const product = { angle: 270, targetR: 150, boundaryR: 150, color: '#FF0088' };
    const u = readFieldUniforms(sim({ phase: 'EJECT', pair: [0, 1], product }), ui(), SEATED, null, 1500);
    expect(u.eject[2]).toBe(-1);
    expect(u.eject[0]).toBeCloseTo(Math.PI, 12);
  });

  it('computes the flow layers from the same clock', () => {
    const u = readFieldUniforms(sim(), ui(), SEATED, null, 7000);
    expect(u.time).toBe(7);
    expect(u.flow[0]).toBeCloseTo(7, 9);
    expect(u.flowW).toBeCloseTo(1, 9);
  });
});

describe('hexToLinear', () => {
  it('decodes sRGB to linear light', () => {
    const [r, g, b] = hexToLinear('#FFD700');
    expect(r).toBe(1);
    expect(g).toBeCloseTo(0.6795, 3);
    expect(b).toBe(0);
  });

  it('keeps every rainbow hue in [0, 1] with a saturated channel', () => {
    for (const hex of RAINBOW) {
      const c = hexToLinear(hex);
      for (const v of c) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
      expect(Math.max(...c)).toBe(1);
    }
  });
});
```

- [ ] **Step 2: Write the failing path-coherence tests**

```js
// src/terminal/views/manifesto/__tests__/councilFieldPaths.test.js
import { describe, it, expect } from 'vitest';
import raw from '../useCouncilCollider.js?raw';
import { polarToXY, seatAngle } from '../councilRingMath';
import { infallArmPoint, jetHead, seatAngleFromXY } from '../councilFieldUniforms';

const ANGLES = [...Array(8)].flatMap((_, i) => [seatAngle(i, 'canon'), seatAngle(i, 'sidelined')]);

describe('GL paths mirror the 2D collider exactly (spec §7.6, §7.8, §10.3)', () => {
  it('tripwire: the 2D formulas mirrored below are still the ones in the loop', () => {
    for (const line of [
      'const R_FOUNDATION = 150, R_SEAT = 220, R_CEILING = 290;',
      'const SPIRAL_GAIN = 0.9;',
      'const easeInCubic = (t) => t * t * t;',
      'const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);',
      'delay: jitter(s * streamN + i, sim.ordinal) * 900,',
      'wobble: (jitter(s * streamN + i + 500, sim.ordinal) - 0.5) * 14,',
      'const r = R_SEAT * (1 - easeInCubic(prog));',
      '+ (SPIRAL_GAIN * 180 / Math.PI) * (1 - r / R_SEAT);',
      'const r = sim.product.targetR * easeOutCubic(prog);',
      'const { x, y } = polarToXY(sim.product.angle, r, CX, CY);',
    ]) {
      expect(raw).toContain(line);
    }
  });

  it('infall arm centreline matches the 2D particle path (wobble 0) to 1e-6 u, all 16 seats', () => {
    for (const angle of ANGLES) {
      const seat = polarToXY(angle, 220, 320, 320);
      const derived = seatAngleFromXY(seat.x, seat.y); // the shader derives it this way
      for (let k = 0; k <= 20; k++) {
        const prog = k / 20;
        const r = 220 * (1 - prog ** 3);                              // the 2D loop, verbatim
        const theta = angle + 0 * prog + ((0.9 * 180) / Math.PI) * (1 - r / 220);
        const want = polarToXY(theta, r, 320, 320);
        const got = infallArmPoint(derived, prog);
        expect(Math.abs(got.x - want.x)).toBeLessThan(1e-6);
        expect(Math.abs(got.y - want.y)).toBeLessThan(1e-6);
      }
    }
  });

  it('jet head sits on the 2D product dot to 1e-6 u', () => {
    for (const angle of ANGLES) {
      for (const targetR of [150, 318]) {
        for (const t of [0, 0.3, 0.77, 1]) {
          const eject = [((angle - 90) * Math.PI) / 180, targetR, 1];
          const want = polarToXY(angle, targetR * (1 - Math.pow(1 - t, 3)), 320, 320);
          const got = jetHead(eject, t);
          expect(Math.abs(got.x - want.x)).toBeLessThan(1e-6);
          expect(Math.abs(got.y - want.y)).toBeLessThan(1e-6);
        }
      }
    }
  });
});
```

- [ ] **Step 3: Run both and confirm they fail**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilFieldUniforms.test.js src/terminal/views/manifesto/__tests__/councilFieldPaths.test.js`
Expected: FAIL with "Failed to resolve import ../councilFieldUniforms". The tripwire alone would pass.

- [ ] **Step 4: Implement**

```js
// src/terminal/views/manifesto/councilFieldUniforms.js
// Collider state → accretion-field uniforms (field spec §5, §6), plus the JS
// mirrors of the GLSL infall arm and jet head that pin them to the 2D loop.
// Pure: reads sim/ui snapshots, never writes them.

import { polarToXY } from './councilRingMath';
import { COLLIDER_TIMING } from './useCouncilCollider';
import { flowLayers } from './councilMatter';

const CX = 320, CY = 320, R_SEAT = 220;
const VIEW_X0 = -170, VIEW_W = 980, VIEW_H = 640;
const FOUNDATION_COLOR = '#FF0088';
const PHASE_MS = {
  INFALL: COLLIDER_TIMING.T_INFALL,
  FLASH: COLLIDER_TIMING.T_FLASH,
  EJECT: COLLIDER_TIMING.T_EJECT,
  COOLDOWN: COLLIDER_TIMING.T_COOLDOWN,
};
const FLIGHT = new Set(['INFALL', 'FLASH', 'EJECT', 'COOLDOWN']);

export const UI_MODE = { AMBIENT: 0, ARMED: 1, FIRING: 2, SYNTHESIZED: 3 };
export const ANIM_PHASE = { IDLE: 0, INFALL: 1, FLASH: 2, EJECT: 3, COOLDOWN: 4 };
export const AMBIENT_INTENSITY = 0.4;
export const SPIRAL_DEG = (0.9 * 180) / Math.PI; // SPIRAL_GAIN in degrees

export const toRing = (x, y) => [(x - VIEW_X0) / VIEW_W, 1 - y / VIEW_H];

export function hexToLinear(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
}

const seatXY = (mind) => polarToXY(mind.angle, R_SEAT, CX, CY);
const byDim = (seated, d) => seated.find((m) => m.dimIndex === d) ?? null;

export function readFieldUniforms(sim, ui, seated, pointer, nowMs) {
  const f = flowLayers(nowMs / 1000);
  const u = {
    time: nowMs / 1000,
    uiMode: UI_MODE[ui.mode] ?? UI_MODE.AMBIENT,
    animPhase: ANIM_PHASE.IDLE,
    phaseT: 0,
    phaseMs: 0,
    seatA: [0, 0], seatB: [0, 0],
    colorA: [0, 0, 0], colorB: [0, 0, 0],
    pointer: pointer ? toRing(pointer.x, pointer.y) : [0, 0],
    pointerLive: pointer ? 1 : 0,
    intensity: 0,
    eject: [0, 0, 0], ejectColor: [0, 0, 0],
    flow: [f.tau0, f.tau1, f.seed0, f.seed1],
    flowW: f.w0,
  };

  const setPair = (mA, mB) => {
    const a = seatXY(mA), b = seatXY(mB);
    u.seatA = toRing(a.x, a.y);
    u.seatB = toRing(b.x, b.y);
    u.colorA = hexToLinear(mA.hue);
    u.colorB = hexToLinear(mB.hue);
  };
  const setAnim = () => {
    u.animPhase = ANIM_PHASE[sim.phase] ?? ANIM_PHASE.IDLE;
    const dur = PHASE_MS[sim.phase];
    u.phaseMs = dur ? nowMs - sim.t0 : 0;
    u.phaseT = dur ? Math.min(1, Math.max(0, (nowMs - sim.t0) / dur)) : 0;
    if (sim.product) {
      u.eject = [
        ((sim.product.angle - 90) * Math.PI) / 180,
        sim.product.targetR,
        sim.product.color === FOUNDATION_COLOR ? -1 : 1,
      ];
      u.ejectColor = hexToLinear(sim.product.color);
    }
  };
  const simPair = sim.pair ? [seated[sim.pair[0]], seated[sim.pair[1]]] : null;

  // §6 rule 1 — the filament belongs to the armed mind; in-flight ambient
  // collisions stay 2D-only.
  if (ui.mode === 'ARMED') {
    const m = byDim(seated, ui.armedDim);
    if (!m) return u;
    setPair(m, m);
    if (pointer) u.seatB = u.pointer;
    u.intensity = 1;
    return u;
  }

  // §6 rule 2 — a user flight drives dynamics; an ambient cycle still in the
  // air under FIRING shows the user's pair as a static bridge instead.
  if (ui.mode === 'FIRING') {
    if (sim.isUser && simPair) {
      setPair(...simPair);
      setAnim();
    } else {
      const [dA, dB] = ui.pair ?? [];
      const mA = byDim(seated, dA), mB = byDim(seated, dB);
      if (!mA || !mB) return u;
      setPair(mA, mB);
    }
    u.intensity = 1;
    return u;
  }

  // Plan amendment 5 — SYNTHESIZED rests without a bridge; only the user
  // cycle's cooldown carries through so the disk boost can relax.
  if (ui.mode === 'SYNTHESIZED') {
    if (sim.isUser && simPair && sim.phase === 'COOLDOWN') {
      setPair(...simPair);
      setAnim();
      u.intensity = 1;
    }
    return u;
  }

  // §6 rules 3–4 — AMBIENT: flight phases at ambient intensity, else off.
  if (simPair && FLIGHT.has(sim.phase)) {
    setPair(...simPair);
    setAnim();
    u.intensity = AMBIENT_INTENSITY;
  }
  return u;
}

// ── JS mirrors of the GLSL geometry (tested against the 2D loop) ───────────

export const seatAngleFromXY = (x, y) => (Math.atan2(y - CY, x - CX) * 180) / Math.PI + 90;

export function infallArmPoint(seatAngleDeg, prog) {
  const r = R_SEAT * (1 - prog ** 3);
  const th = seatAngleDeg + SPIRAL_DEG * (1 - r / R_SEAT);
  const rad = ((th - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

export function jetHead(eject, phaseT) {
  const L = eject[1] * (1 - (1 - phaseT) ** 3);
  return { x: CX + L * Math.cos(eject[0]), y: CY + L * Math.sin(eject[0]) };
}
```

- [ ] **Step 5: Run both and confirm they pass**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilFieldUniforms.test.js src/terminal/views/manifesto/__tests__/councilFieldPaths.test.js`
Expected: PASS, 14 + 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/views/manifesto/councilFieldUniforms.js src/terminal/views/manifesto/__tests__/councilFieldUniforms.test.js src/terminal/views/manifesto/__tests__/councilFieldPaths.test.js
git commit -m "feat(manifesto): map collider state to field uniforms; pin GL paths to the 2D loop" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The fragment shader

**Files:**
- Create: `src/terminal/views/manifesto/councilFieldShader.js`
- Test: `src/terminal/views/manifesto/__tests__/councilFieldShader.test.js`

**Interfaces:**
- Consumes: constants from Tasks 1–5 (see the imports below).
- Produces: `FIELD_VS`, `FIELD_FS` (strings), `FIELD_UNIFORMS` (string[], the host harvest list), and `glf(x) → string` (a GLSL float literal).
- Sampler units: `u_geodesic` → 0, `u_deflect` → 1, `u_matter` → 2.
- jsdom cannot compile GLSL. Compilation is proven in Task 9 in the real browser, where the `'lunar'` strategy throws the driver's log on failure and CouncilField falls back to not-live.

- [ ] **Step 1: Write the failing contract tests**

```js
// src/terminal/views/manifesto/__tests__/councilFieldShader.test.js
import { describe, it, expect } from 'vitest';
import { FIELD_VS, FIELD_FS, FIELD_UNIFORMS, glf } from '../councilFieldShader';
import { B_C, LUT_W, X_MIN, X_MAX, PHI_MAX, D_X_MAX, FAR } from '../councilGeodesics';
import { COS_I, SIN_I, SPIN_SIGN, F_MAX, T_PEAK, T_EXP, COUNTER_JET } from '../councilFieldPhysics';
import { OMEGA_ISCO_VIS } from '../councilMatter';
import { SPIRAL_DEG } from '../councilFieldUniforms';

const declared = [...FIELD_FS.matchAll(/^uniform\s+\w+\s+(\w+);/gm)].map((m) => m[1]);

describe('councilFieldShader contract (spec §5, §7)', () => {
  it('is GLSL ES 3.00 in both stages', () => {
    expect(FIELD_VS.startsWith('#version 300 es\n')).toBe(true);
    expect(FIELD_FS.startsWith('#version 300 es\n')).toBe(true);
  });

  it('declares exactly the uniforms the host harvests, once each', () => {
    expect([...declared].sort()).toEqual([...FIELD_UNIFORMS].sort());
    expect(new Set(declared).size).toBe(declared.length);
  });

  it('interpolates every physical constant from its JS owner', () => {
    for (const [name, value] of Object.entries({
      B_C, LUT_W, X_MIN, X_MAX, PHI_MAX, D_X_MAX, FAR,
      COS_I, SIN_I, SPIN: SPIN_SIGN, F_MAX, T_PEAK, T_EXP, COUNTER_JET,
      OMEGA_ISCO_VIS, SPIRAL_DEG,
    })) {
      expect(FIELD_FS).toContain(`const float ${name} = ${glf(value)};`);
    }
  });

  it('formats GLSL float literals with a decimal point or exponent', () => {
    expect(glf(1000)).toBe('1000.00000');
    expect(glf(0.5)).toBe('0.500000000');
    expect(glf(-266123900)).toBe('-266123900.0');
    expect(glf(-3.0258469e9)).toMatch(/e\+9$/);
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilFieldShader.test.js`
Expected: FAIL with "Failed to resolve import ../councilFieldShader".

- [ ] **Step 3: Implement**

```js
// src/terminal/views/manifesto/councilFieldShader.js
// The accretion-field fragment pass (field spec §7). Constants are
// interpolated from the JS modules that own and test them, so the shader
// and its mirrors cannot drift.

import { COLLIDER_TIMING } from './useCouncilCollider';
import { B_C, LUT_W, X_MIN, X_MAX, PHI_MAX, N_B, N_PHI, N_D, D_X_MAX, FAR } from './councilGeodesics';
import {
  COS_I, SIN_I, SPIN_SIGN, R_IN, R_OUT, F_MAX, T_PEAK, T_EXP, COUNTER_JET,
  KIM_X_LOW, KIM_X_HIGH, KIM_Y_1, KIM_Y_2, KIM_Y_3, XYZ_TO_LINEAR_SRGB,
} from './councilFieldPhysics';
import { OMEGA_ISCO_VIS } from './councilMatter';
import { SPIRAL_DEG } from './councilFieldUniforms';

export function glf(x) {
  const s = Number(x).toPrecision(9);
  return /[.e]/.test(s) ? s : `${s}.0`;
}
const v4 = (a) => `vec4(${a.map(glf).join(', ')})`;
const v3 = (a) => `vec3(${a.map(glf).join(', ')})`;
const M = XYZ_TO_LINEAR_SRGB;

export const FIELD_UNIFORMS = [
  'u_resolution', 'u_time', 'u_ui_mode', 'u_anim_phase', 'u_phase_t', 'u_phase_ms',
  'u_seatA', 'u_seatB', 'u_colorA', 'u_colorB', 'u_pointer', 'u_pointer_live',
  'u_intensity', 'u_eject', 'u_eject_color', 'u_flow', 'u_flow_w', 'u_lens_d',
  'u_geodesic', 'u_deflect', 'u_matter',
];

export const FIELD_VS = `#version 300 es
layout(location = 0) in vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`;

export const FIELD_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

uniform vec2 u_resolution;
uniform float u_time;
uniform int u_ui_mode;
uniform int u_anim_phase;
uniform float u_phase_t;
uniform float u_phase_ms;
uniform vec2 u_seatA;
uniform vec2 u_seatB;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform vec2 u_pointer;
uniform float u_pointer_live;
uniform float u_intensity;
uniform vec3 u_eject;
uniform vec3 u_eject_color;
uniform vec4 u_flow;
uniform float u_flow_w;
uniform float u_lens_d;
uniform sampler2D u_geodesic;
uniform sampler2D u_deflect;
uniform sampler2D u_matter;

out vec4 fragColor;

const float PI = 3.14159265359;
const float TAU = 6.28318530718;
const vec2 CENTER = vec2(320.0, 320.0);
const float R_S_U = 14.0;
const float R_SEAT = 220.0;
const float R_FOUNDATION = 150.0;
const float VIEW_X0 = -170.0;
const float VIEW_W = 980.0;
const float VIEW_H = 640.0;

const float B_C = ${glf(B_C)};
const float LUT_W = ${glf(LUT_W)};
const float X_MIN = ${glf(X_MIN)};
const float X_MAX = ${glf(X_MAX)};
const float PHI_MAX = ${glf(PHI_MAX)};
const float D_X_MAX = ${glf(D_X_MAX)};
const float FAR = ${glf(FAR)};
const float N_B = ${glf(N_B)};
const float N_PHI = ${glf(N_PHI)};
const float N_D = ${glf(N_D)};

const float COS_I = ${glf(COS_I)};
const float SIN_I = ${glf(SIN_I)};
const float SPIN = ${glf(SPIN_SIGN)};
const float R_IN = ${glf(R_IN)};
const float R_OUT = ${glf(R_OUT)};
const float F_MAX = ${glf(F_MAX)};
const float T_PEAK = ${glf(T_PEAK)};
const float T_EXP = ${glf(T_EXP)};
const float DISK_GAIN = 1.6;
const float OMEGA_ISCO_VIS = ${glf(OMEGA_ISCO_VIS)};
const float COUNTER_JET = ${glf(COUNTER_JET)};

const float T_INFALL = ${glf(COLLIDER_TIMING.T_INFALL)};
const float DELAY_MAX = 900.0;
const float WOBBLE_DEG = 7.0;
const float SPIRAL_DEG = ${glf(SPIRAL_DEG)};
const int ARM_SEGMENTS = 24;

const vec4 KXL = ${v4(KIM_X_LOW)};
const vec4 KXH = ${v4(KIM_X_HIGH)};
const vec4 KY1 = ${v4(KIM_Y_1)};
const vec4 KY2 = ${v4(KIM_Y_2)};
const vec4 KY3 = ${v4(KIM_Y_3)};
const vec3 MR = ${v3(M.slice(0, 3))};
const vec3 MG = ${v3(M.slice(3, 6))};
const vec3 MB = ${v3(M.slice(6, 9))};

// ── lookup tables ──────────────────────────────────────────────────────────
float lutCoord(float f, float n) { return clamp(f, 0.0, 1.0) * (n - 1.0) / n + 0.5 / n; }

float rayRadius(float b, float phi) {
  if (phi > PHI_MAX) return FAR;
  float x = asinh((b - B_C) / LUT_W);
  float row = lutCoord((x - X_MIN) / (X_MAX - X_MIN), N_B);
  return texture(u_geodesic, vec2(lutCoord(phi / PHI_MAX, N_PHI), row)).r;
}

float deflection(float b) {
  float x = asinh((b - B_C) / LUT_W);
  return texture(u_deflect, vec2(lutCoord(x / D_X_MAX, N_D), 0.5)).r;
}

// ── colour ─────────────────────────────────────────────────────────────────
vec3 blackbody(float Tk) {
  float T = clamp(Tk, 1667.0, 25000.0);
  float T2 = T * T;
  float T3 = T2 * T;
  vec4 kx = T <= 4000.0 ? KXL : KXH;
  float x = kx.x / T3 + kx.y / T2 + kx.z / T + kx.w;
  vec4 ky = T <= 2222.0 ? KY1 : (T <= 4000.0 ? KY2 : KY3);
  float y = ky.x * x * x * x + ky.y * x * x + ky.z * x + ky.w;
  vec3 XYZ = vec3(x / y, 1.0, (1.0 - x - y) / y);
  vec3 rgb = max(vec3(dot(MR, XYZ), dot(MG, XYZ), dot(MB, XYZ)), 0.0);
  return rgb / max(max(rgb.r, rgb.g), max(rgb.b, 1e-6));
}

// ── disk matter (§7.3) ─────────────────────────────────────────────────────
float matterLayer(float lr, float psi, float seed) {
  vec2 uv = vec2(psi / TAU + seed, lr * 2.0 + seed * 0.37);
  float coarse = texture(u_matter, uv).r;
  float fine = texture(u_matter, uv * vec2(3.0, 4.0) + 0.5).r;
  return coarse * 0.65 + fine * 0.35;
}

float matter(float r, float psi) {
  float om = OMEGA_ISCO_VIS * pow(r / R_IN, -1.5);
  float lr = log(r / R_IN) / log(R_OUT / R_IN);
  float n0 = matterLayer(lr, psi + SPIN * om * u_flow.x, u_flow.z);
  float n1 = matterLayer(lr, psi + SPIN * om * u_flow.y, u_flow.w);
  float w0 = u_flow_w;
  float w1 = 1.0 - w0;
  float n = 0.5 + (w0 * (n0 - 0.5) + w1 * (n1 - 0.5)) * inversesqrt(w0 * w0 + w1 * w1);
  return clamp(n, 0.0, 1.0);
}

// ── disk emission (§7.3–7.4) ───────────────────────────────────────────────
vec3 diskEmission(float r, float psi, float b, float cosA) {
  float F = pow(r, -3.0) * (1.0 - sqrt(R_IN / r));
  float Fn = max(F, 0.0) / F_MAX;
  float om = sqrt(0.5 / (r * r * r));
  float onePlusZ = inversesqrt(1.0 - 1.5 / r) * (1.0 - SPIN * om * b * cosA * SIN_I);
  float g = 1.0 / max(onePlusZ, 0.05);
  float T = T_PEAK * pow(Fn, T_EXP) * g;
  float m = matter(r, psi);
  float I = g * g * g * g * Fn * pow(m, 1.6) * DISK_GAIN;
  return blackbody(T) * I;
}

// Primary (n = 0) then secondary (n = 1) disk-plane crossing (§7.2). The
// first crossing that lands on the disk wins: the disk is optically thick.
vec4 diskAt(float b, float cosA, float sinA, float shiftU, out float nHit) {
  nHit = -1.0;
  float bs = max(b + shiftU / R_S_U, 0.0);
  float phi0 = atan(COS_I, -sinA * SIN_I);
  for (int n = 0; n < 2; n++) {
    float phi = phi0 + float(n) * PI;
    float r = rayRadius(bs, phi);
    if (r >= R_IN && r <= R_OUT) {
      nHit = float(n);
      float sp = sin(phi);
      float cp = cos(phi);
      float psi = atan(sp * sinA * COS_I - cp * SIN_I, sp * cosA);
      return vec4(diskEmission(r, psi, bs, cosA), 1.0);
    }
  }
  return vec4(0.0);
}

// ── filaments (§7.5) ───────────────────────────────────────────────────────
vec2 lensSource(vec2 p) {
  vec2 q = p - CENTER;
  float rq = length(q);
  float b = rq / R_S_U;
  if (b <= B_C) return vec2(1.0e5);
  float taper = 1.0 - smoothstep(0.6 * R_FOUNDATION, R_FOUNDATION, rq);
  if (taper <= 0.0) return p;
  float beta = b - u_lens_d * deflection(b);
  return CENTER + (q / rq) * mix(b, beta, taper) * R_S_U;
}

float segDist(vec2 p, vec2 a, vec2 b, out float h) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

vec3 filament(vec2 src, vec2 A, vec2 B, vec3 cA, vec3 cB, float gain) {
  float h;
  float d = segDist(src, A, B, h);
  if (d > 30.0) return vec3(0.0);
  float core = exp(-d * d);
  float halo = exp(-(d * d) / 25.0);
  float pulse = 1.0 + 0.15 * sin(h * length(B - A) * 0.4 - u_time * 6.0);
  vec3 c = mix(cA, cB, h);
  return (c * (halo * 0.6 + core) + vec3(core * 0.8)) * pulse * gain;
}

vec3 seatDisc(vec2 p, vec2 S, vec3 c, float radius) {
  vec2 d = p - S;
  return c * exp(-dot(d, d) / (radius * radius)) * 1.2;
}

// ── infall sheath (§7.6): the envelope of the 2D particle streams ──────────
vec2 armPoint(float angDeg, float prog) {
  float r = R_SEAT * (1.0 - prog * prog * prog);
  float th = angDeg + SPIRAL_DEG * (1.0 - r / R_SEAT);
  float rad = radians(th - 90.0);
  return CENTER + r * vec2(cos(rad), sin(rad));
}

vec3 infallArm(vec2 p, vec2 seat, vec3 col) {
  float lead = clamp(u_phase_ms / T_INFALL, 0.0, 1.0);
  float trail = clamp((u_phase_ms - DELAY_MAX) / T_INFALL, 0.0, 1.0);
  if (lead <= 0.0) return vec3(0.0);
  vec2 q = p - CENTER;
  float rq = length(q);
  float rLead = R_SEAT * (1.0 - lead * lead * lead);
  float rTrail = R_SEAT * (1.0 - trail * trail * trail);
  if (rq < rLead - 30.0 || rq > rTrail + 30.0) return vec3(0.0);
  vec2 s0 = seat - CENTER;
  float ang = degrees(atan(s0.y, s0.x)) + 90.0;
  if (rq > 40.0) {
    float pixAng = degrees(atan(q.y, q.x)) + 90.0;
    float delta = mod(pixAng - ang + 540.0, 360.0) - 180.0;
    if (delta < -20.0 || delta > SPIRAL_DEG + 20.0) return vec3(0.0);
  }
  float best = 1.0e9;
  float bestProg = trail;
  vec2 prev = armPoint(ang, trail);
  for (int k = 1; k <= ARM_SEGMENTS; k++) {
    float p0 = mix(trail, lead, float(k - 1) / float(ARM_SEGMENTS));
    float p1 = mix(trail, lead, float(k) / float(ARM_SEGMENTS));
    vec2 cur = armPoint(ang, p1);
    float h;
    float d = segDist(p, prev, cur, h);
    if (d < best) { best = d; bestProg = mix(p0, p1, h); }
    prev = cur;
  }
  float rr = R_SEAT * (1.0 - bestProg * bestProg * bestProg);
  float spread = rr * radians(WOBBLE_DEG) * bestProg;
  float width = spread + 5.0;
  float glow = exp(-(best * best) / (width * width));
  float coreLine = exp(-(best * best) / (spread * spread + 1.0));
  vec2 hd = p - armPoint(ang, lead);
  float head = exp(-dot(hd, hd) / 36.0);
  return col * (glow * 0.55 + coreLine * 0.35) + vec3(head * 0.9);
}

// ── flash (§7.7) and jet (§7.8) ────────────────────────────────────────────
vec3 flashCore(float rq, float t) {
  float shift = 1.8 * (1.0 - t);
  float rc = B_C * R_S_U * (1.0 + 2.5 * t);
  float k = 6.0 * (1.0 - t) * (1.0 - t);
  float rr = rq + shift;
  float rb = max(rq - shift, 0.0);
  float c2 = rc * rc;
  return k * vec3(exp(-rr * rr / c2), exp(-rq * rq / c2), exp(-rb * rb / c2));
}

vec3 jet(vec2 p, float t) {
  vec2 ax = vec2(cos(u_eject.x), sin(u_eject.x));
  float L = u_eject.y * (1.0 - pow(1.0 - t, 3.0));
  float fade = pow(1.0 - t, 1.5);
  vec2 q = p - CENTER;
  vec3 acc = vec3(0.0);
  for (int side = 0; side < 2; side++) {
    vec2 axis = side == 0 ? ax : -ax;
    float gain = side == 0 ? 1.0 : COUNTER_JET;
    float s = dot(q, axis);
    if (s < -8.0 || s > L + 12.0) continue;
    float perp = length(q - axis * s);
    float w = max(s, 0.0) * tan(radians(3.0)) + 1.0;
    float body = sqrt(max(1.0 - max(s, 0.0) / max(L, 1e-3), 0.0)) * exp(-(perp * perp) / (w * w));
    vec2 hd = q - axis * L;
    float knot = exp(-dot(hd, hd) / 49.0);
    acc += gain * (u_eject_color * body + mix(u_eject_color, vec3(1.0), 0.7) * knot * 2.0);
  }
  return acc * fade;
}

// ── finish (§7.9) ──────────────────────────────────────────────────────────
float bayer4(vec2 fc) {
  ivec2 i = ivec2(mod(fc, 4.0));
  const float M4[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0,
                                 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (M4[i.x + i.y * 4] + 0.5) / 16.0;
}

vec2 ringToView(vec2 n) { return vec2(n.x * VIEW_W + VIEW_X0, (1.0 - n.y) * VIEW_H); }

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = vec2(uv.x * VIEW_W + VIEW_X0, (1.0 - uv.y) * VIEW_H);
  vec2 q = p - CENTER;
  float rq = length(q);
  float b = rq / R_S_U;
  vec2 dir = rq > 1e-4 ? vec2(q.x, -q.y) / rq : vec2(1.0, 0.0); // image plane, +Y up

  int ph = u_anim_phase;
  float t = u_phase_t;
  float boost = 1.0;
  if (ph == 1) boost += 1.2 * t * u_intensity;
  else if (ph == 2 || ph == 3) boost += 1.2 * u_intensity;
  else if (ph == 4) boost += 1.2 * (1.0 - t) * u_intensity;

  vec3 disk = vec3(0.0);
  bool shadow = false;
  if (b < R_OUT + 0.5) {
    float nG;
    vec4 dG = diskAt(b, dir.x, dir.y, 0.0, nG);
    if (ph == 2 && u_intensity > 0.0) {
      float shift = 1.8 * (1.0 - t);
      float nR;
      float nB;
      vec4 dR = diskAt(b, dir.x, dir.y, shift, nR);
      vec4 dB = diskAt(b, dir.x, dir.y, -shift, nB);
      float flare = 1.0 + 8.0 * (1.0 - t) * (1.0 - t);
      disk = vec3(dR.r * (nR == 1.0 ? flare : 1.0),
                  dG.g * (nG == 1.0 ? flare : 1.0),
                  dB.b * (nB == 1.0 ? flare : 1.0));
    } else {
      disk = dG.rgb;
    }
    disk *= boost;
    shadow = dG.a < 0.5 && b < B_C;
  }

  vec3 fx = vec3(0.0);
  vec3 core = vec3(0.0);
  if (u_intensity > 0.0) {
    vec2 A = ringToView(u_seatA);
    vec2 B = ringToView(u_seatB);
    if (u_ui_mode == 1) {
      if (u_pointer_live > 0.5) fx += filament(lensSource(p), A, B, u_colorA, u_colorA, 1.0);
      float breathe = 9.0 * (1.0 + 0.3 * sin(u_time * 3.0));
      fx += seatDisc(p, A, u_colorA, u_pointer_live > 0.5 ? 9.0 : breathe);
    } else {
      float bridge = ph == 0 ? 1.0 : (ph == 1 ? 1.0 - smoothstep(0.0, 0.25, t) : 0.0);
      if (bridge > 0.0) {
        fx += filament(lensSource(p), A, B, u_colorA, u_colorB, 1.8 * bridge);
        fx += (seatDisc(p, A, u_colorA, 9.0) + seatDisc(p, B, u_colorB, 9.0)) * bridge;
      }
      if (ph == 1) fx += infallArm(p, A, u_colorA) + infallArm(p, B, u_colorB);
      if (ph == 2) core = flashCore(rq, t);
      if (ph == 3) fx += jet(p, t);
    }
    fx *= u_intensity;
    core *= u_intensity;
  }

  vec3 emissive = shadow ? core : disk + fx + core;
  vec3 c = 1.0 - exp(-1.4 * emissive);
  c = pow(c, vec3(1.0 / 2.2));
  float a = shadow ? 1.0 : max(max(c.r, c.g), c.b);
  if (a > 0.0) c += (bayer4(gl_FragCoord.xy) - 0.5) / 255.0;
  c = clamp(c, 0.0, a);
  fragColor = vec4(c, a);
}
`;
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilFieldShader.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/manifesto/councilFieldShader.js src/terminal/views/manifesto/__tests__/councilFieldShader.test.js
git commit -m "feat(manifesto): accretion-field fragment shader with JS-owned constants" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: CouncilField host component

**Files:**
- Modify: `src/terminal/gl/__tests__/recordingGL.js` (the `CONSTANTS` object)
- Create: `src/terminal/views/manifesto/CouncilField.jsx`
- Test: `src/terminal/views/manifesto/__tests__/councilField.test.jsx`

**Interfaces:**
- Consumes: `useShaderCanvas` (`src/terminal/gl/useShaderCanvas.js`), Tasks 2–6.
- Produces: `<CouncilField simRef uiRef seated pointerRef mode onLiveChange />`
  - `onLiveChange(boolean)` is called after mount: `true` if the GL host exists, `false` otherwise (no WebGL2, or a shader compile/link failure).
  - The component renders one `<canvas>` absolutely positioned at `inset: 0` with `pointer-events: none`.

- [ ] **Step 1: Teach the recording stub the three texture enums**

In `src/terminal/gl/__tests__/recordingGL.js`, add to `CONSTANTS` directly after the `RGBA16F: 0x881a, HALF_FLOAT: 0x140b, FRAMEBUFFER_COMPLETE: 0x8cd5,` line:

```js
  R8: 0x8229, R16F: 0x822d, RED: 0x1903,
```

Then run the GL kit to confirm the change is inert:

Run: `npx vitest run src/terminal/gl src/terminal/collider`
Expected: PASS with no snapshot changes (the stub records calls, not constants).

- [ ] **Step 2: Write the failing component tests**

```jsx
// src/terminal/views/manifesto/__tests__/councilField.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { driveFrames } from '../../../gl/__tests__/driveFrames';
import { installRecordingGL } from '../../../gl/__tests__/recordingGL';
import CouncilField from '../CouncilField';

const SEATED = [
  { dimIndex: 3, angle: 270, hue: '#FF0088' },
  { dimIndex: 9, angle: 90, hue: '#00FFAA' },
];
const FLASH = {
  sim: { phase: 'FLASH', t0: 0, pair: [0, 1], isUser: true, product: { angle: 90, targetR: 318, boundaryR: 290, color: '#00FFAA' } },
  ui: { mode: 'FIRING', armedDim: null, pair: [3, 9], record: null },
};

function refs({ sim, ui }) {
  return {
    simRef: { current: { t0: 0, pair: null, product: null, ordinal: 0, particles: [], userPair: null, ...sim } },
    uiRef: { current: ui },
    pointerRef: { current: null },
  };
}

function drive(state = FLASH, frames = 3) {
  const r = refs(state);
  return driveFrames(() => {
    const out = render(
      <CouncilField {...r} seated={SEATED} mode={state.ui.mode} onLiveChange={() => {}} />,
    );
    return { unmount: out.unmount, rerender: out.rerender };
  }, { frames, version: 2 });
}

function fnv(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
// Texture uploads serialise to megabytes; freeze them as length + hash.
const compact = (lines) => lines.map((l) => (l.length > 400 ? `${l.slice(0, l.indexOf('('))}(#${l.length}:${fnv(l)})` : l));

describe('CouncilField GL traffic (spec §8, §10.6)', () => {
  it('uploads two R16F lookup tables and one R8 matter texture at init', () => {
    const tex = drive().init.filter((l) => l.startsWith('texImage2D('));
    expect(tex).toHaveLength(3);
    expect(tex.filter((l) => l.startsWith(`texImage2D(${0x0de1}, 0, ${0x822d},`))).toHaveLength(2);
    expect(tex.filter((l) => l.startsWith(`texImage2D(${0x0de1}, 0, ${0x8229},`))).toHaveLength(1);
  });

  it('draws one full-screen pass per frame into a cleared transparent target', () => {
    const { frames } = drive();
    expect(frames.filter((l) => l === 'drawArrays(5, 0, 4)')).toHaveLength(3);
    expect(frames.filter((l) => l === 'clearColor(0, 0, 0, 0)')).toHaveLength(3);
  });

  it('binds the three samplers to units 0, 1, 2', () => {
    const { frames } = drive();
    expect(frames.some((l) => /^uniform1i\(".*:u_geodesic", 0\)$/.test(l))).toBe(true);
    expect(frames.some((l) => /^uniform1i\(".*:u_deflect", 1\)$/.test(l))).toBe(true);
    expect(frames.some((l) => /^uniform1i\(".*:u_matter", 2\)$/.test(l))).toBe(true);
  });

  it('freezes the init + FLASH frame call log', () => {
    const { init, frames } = drive();
    expect({ init: compact(init), frames: compact(frames) }).toMatchSnapshot();
  });
});

describe('CouncilField liveness', () => {
  it('reports live when WebGL2 exists', () => {
    const rec = installRecordingGL({ version: 2 });
    try {
      const spy = vi.fn();
      const r = refs(FLASH);
      const { unmount } = render(<CouncilField {...r} seated={SEATED} mode="FIRING" onLiveChange={spy} />);
      expect(spy).toHaveBeenLastCalledWith(true);
      unmount();
    } finally {
      rec.restore();
    }
  });

  it('reports not-live, and owns no GL, when WebGL2 is unavailable', () => {
    const spy = vi.fn();
    const r = refs(FLASH);
    render(<CouncilField {...r} seated={SEATED} mode="FIRING" onLiveChange={spy} />);
    expect(spy).toHaveBeenLastCalledWith(false);
    expect(spy).not.toHaveBeenCalledWith(true);
  });
});
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilField.test.jsx`
Expected: FAIL with "Failed to resolve import ../CouncilField".

- [ ] **Step 4: Implement**

```jsx
// src/terminal/views/manifesto/CouncilField.jsx
// The read-only accretion-field layer under the Council Ring SVG
// (docs/superpowers/specs/2026-09-25-council-field-accretion-design.md).
// It reads collider state through refs and never writes it. With no WebGL2,
// or a shader that fails to build, it owns no GL and reports not-live; the
// ring then behaves exactly as before.

import { useEffect, useRef } from 'react';
import { useShaderCanvas } from '../../gl/useShaderCanvas';
import { FIELD_VS, FIELD_FS, FIELD_UNIFORMS } from './councilFieldShader';
import { geodesicTables, N_B, N_PHI, N_D } from './councilGeodesics';
import { matterTexture, MATTER_N } from './councilMatter';
import { readFieldUniforms } from './councilFieldUniforms';

const CONTEXT_OPTIONS = { alpha: true, premultipliedAlpha: true, antialias: false };

function makeTexture(gl, unit, w, h, internal, format, type, data, wrap) {
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  return tex;
}

// Scalar uniform forms only: no per-frame allocation, and the recording
// stub logs every value (it prints plain arrays as "<obj>").
function paint(gl, U, u, lensD) {
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(U.u_resolution, gl.canvas.width, gl.canvas.height);
  gl.uniform1f(U.u_time, u.time);
  gl.uniform1i(U.u_ui_mode, u.uiMode);
  gl.uniform1i(U.u_anim_phase, u.animPhase);
  gl.uniform1f(U.u_phase_t, u.phaseT);
  gl.uniform1f(U.u_phase_ms, u.phaseMs);
  gl.uniform2f(U.u_seatA, u.seatA[0], u.seatA[1]);
  gl.uniform2f(U.u_seatB, u.seatB[0], u.seatB[1]);
  gl.uniform3f(U.u_colorA, u.colorA[0], u.colorA[1], u.colorA[2]);
  gl.uniform3f(U.u_colorB, u.colorB[0], u.colorB[1], u.colorB[2]);
  gl.uniform2f(U.u_pointer, u.pointer[0], u.pointer[1]);
  gl.uniform1f(U.u_pointer_live, u.pointerLive);
  gl.uniform1f(U.u_intensity, u.intensity);
  gl.uniform3f(U.u_eject, u.eject[0], u.eject[1], u.eject[2]);
  gl.uniform3f(U.u_eject_color, u.ejectColor[0], u.ejectColor[1], u.ejectColor[2]);
  gl.uniform4f(U.u_flow, u.flow[0], u.flow[1], u.flow[2], u.flow[3]);
  gl.uniform1f(U.u_flow_w, u.flowW);
  gl.uniform1f(U.u_lens_d, lensD);
  gl.uniform1i(U.u_geodesic, 0);
  gl.uniform1i(U.u_deflect, 1);
  gl.uniform1i(U.u_matter, 2);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

export default function CouncilField({ simRef, uiRef, seated, pointerRef, mode, onLiveChange }) {
  const canvasRef = useRef(null);
  const texRef = useRef([]);
  const lensRef = useRef(0);

  // `seated` is captured once (deps: []). CouncilRing memoizes it with [] deps,
  // which the collider already depends on, so it is referentially stable.
  const { snap, hostRef } = useShaderCanvas(canvasRef, {
    version: 2,
    contextOptions: CONTEXT_OPTIONS,
    strategy: 'lunar',
    blend: 'premultiplied',
    vs: FIELD_VS,
    fs: FIELD_FS,
    uniforms: FIELD_UNIFORMS,
    pixelSize: { w: 980, h: 640 }, // corrected by the ResizeObserver below
    setStyleSize: false,
    label: 'councilField',
    loseContextOnDispose: true,
    watchdogMs: 40,
    trackVisibility: true,
    initialDraw: false,
    haltOnReducedMotion: true,

    onInit(gl) {
      const { geodesic, deflect, lensD } = geodesicTables();
      lensRef.current = lensD;
      texRef.current = [
        makeTexture(gl, 0, N_PHI, N_B, gl.R16F, gl.RED, gl.FLOAT, geodesic, gl.CLAMP_TO_EDGE),
        makeTexture(gl, 1, N_D, 1, gl.R16F, gl.RED, gl.FLOAT, deflect, gl.CLAMP_TO_EDGE),
        makeTexture(gl, 2, MATTER_N, MATTER_N, gl.R8, gl.RED, gl.UNSIGNED_BYTE, matterTexture(), gl.REPEAT),
      ];
    },

    onDispose(gl) {
      for (const t of texRef.current) gl.deleteTexture(t);
      texRef.current = [];
    },

    draw(host, { now }) {
      const u = readFieldUniforms(simRef.current, uiRef.current, seated, pointerRef.current, now);
      paint(host.gl, host.U, u, lensRef.current);
    },

    // Reduced motion: the loop never starts, so this is the only frame.
    onSnap(host) {
      const u = readFieldUniforms(simRef.current, uiRef.current, seated, pointerRef.current, performance.now());
      paint(host.gl, host.U, u, lensRef.current);
    },

    deps: [],
  });

  // Declared after useShaderCanvas: its effect has already built (or failed
  // to build) the host by the time this runs.
  useEffect(() => {
    onLiveChange?.(hostRef.current != null);
  }, [hostRef, onLiveChange]);

  // Reduced motion repaints only on demand; a UI-mode change is such a demand.
  // snap() is a no-op while the loop runs.
  useEffect(() => { snap(); }, [mode, snap]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      const host = hostRef.current;
      const w = el.clientWidth, h = el.clientHeight;
      if (!host || !w || !h) return;
      host.resize(w, h);
      snap(); // setting canvas.width cleared the buffer
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [hostRef, snap]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="council-field"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}
```

- [ ] **Step 5: Run the tests, writing the snapshot exactly once**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilField.test.jsx`
Expected: PASS, 6 tests, and `1 written` for the snapshot.

Inspect `src/terminal/views/manifesto/__tests__/__snapshots__/councilField.test.jsx.snap`:
- the three `texImage2D(#…)` lines are compacted;
- the `u_anim_phase` value is `2` in every frame;
- the `u_phase_t` values rise.

From now on, never pass `-u`.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/gl/__tests__/recordingGL.js src/terminal/views/manifesto/CouncilField.jsx src/terminal/views/manifesto/__tests__/councilField.test.jsx src/terminal/views/manifesto/__tests__/__snapshots__/councilField.test.jsx.snap
git commit -m "feat(manifesto): CouncilField harness host with frozen GL call log" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Mount the field in CouncilRing

**Files:**
- Modify: `src/terminal/views/manifesto/CouncilRing.jsx`:
  - line 1 (imports)
  - lines 95–105 (`RingScaffold`)
  - lines 107–118 (hook state)
  - lines 157–180 (torus cell)
- Test: `src/terminal/views/manifesto/__tests__/councilRingField.test.jsx`

**Interfaces:**
- Consumes: `CouncilField` (Task 7), `collider.simRef` and `collider.uiRef` (Task 1).
- Produces: a torus cell with `isolation: isolate` whose children are `[2D canvas, field canvas, svg]`. `◉` is hidden while the field is live. `pointerRef.current` holds `{ x, y }` in viewBox units while a mouse or pen hovers the cell, and `null` otherwise.

- [ ] **Step 1: Write the failing integration tests**

```jsx
// src/terminal/views/manifesto/__tests__/councilRingField.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { installRecordingGL } from '../../../gl/__tests__/recordingGL';
import CouncilRing from '../CouncilRing';

beforeEach(() => {
  localStorage.clear();
  // jsdom has neither; the collider gate reads both on mount.
  vi.stubGlobal('matchMedia', (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
});
afterEach(() => vi.unstubAllGlobals());

describe('CouncilRing × CouncilField (spec §3, §7.9)', () => {
  it('stacks the 2D canvas, the field canvas, then the SVG inside an isolated cell', () => {
    const { container } = render(<CouncilRing />);
    const cell = container.querySelector('svg[viewBox="-170 0 980 640"]').parentElement;
    expect(cell.style.isolation).toBe('isolate');
    expect([...cell.children].map((n) => n.tagName.toLowerCase())).toEqual(['canvas', 'canvas', 'svg']);
  });

  it('keeps the ◉ glyph when WebGL2 is unavailable', () => {
    render(<CouncilRing />);
    expect(screen.getByText('◉')).toBeTruthy();
  });

  it('hides the ◉ glyph once the field is live', async () => {
    const rec = installRecordingGL({ version: 2 });
    try {
      render(<CouncilRing />);
      await waitFor(() => expect(screen.queryByText('◉')).toBeNull());
    } finally {
      rec.restore();
    }
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilRingField.test.jsx`
Expected: FAIL. The cell has two children (`canvas`, `svg`) and no `isolation`, and `◉` never disappears.

- [ ] **Step 3: Implement the four edits in `CouncilRing.jsx`**

Edit 1, the imports (line 1 and after line 8):

```jsx
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
```

```jsx
import CouncilField from './CouncilField';
```

Edit 2, replace `RingScaffold`:

```jsx
function RingScaffold({ showCore = true }) {
  return (
    <g>
      <circle cx={CX} cy={CY} r={R_CEILING} fill="none" stroke="#00FFAA" strokeWidth={1} strokeOpacity={0.28} />
      <circle cx={CX} cy={CY} r={R_FOUNDATION} fill="none" stroke="#FF0088" strokeWidth={1} strokeOpacity={0.28} />
      <text x={CX} y={CY - R_CEILING - 8} textAnchor="middle" fontFamily={MONO} fontSize={10} fill="#00FFAA" fillOpacity={0.6} letterSpacing="0.25em">BIOPHYSICAL CEILING</text>
      <text x={CX} y={CY + R_FOUNDATION + 16} textAnchor="middle" fontFamily={MONO} fontSize={9} fill="#FF0088" fillOpacity={0.6} letterSpacing="0.2em">SOCIAL FOUNDATION</text>
      {/* The rendered event horizon replaces the glyph while CouncilField is live (spec §7.9). */}
      {showCore && <text x={CX} y={CY + 6} textAnchor="middle" fontFamily={MONO} fontSize={22} fill="#7788cc" fillOpacity={0.4}>◉</text>}
    </g>
  );
}
```

Edit 3, in `CouncilRing()` directly after `const openDossier = useCallback((mind) => setSelected(mind), []);` add:

```jsx
  // Accretion field (CouncilField): liveness hides the ◉ glyph; the pointer
  // ref feeds the ARMED tether in viewBox units, fine pointers only.
  const [fieldLive, setFieldLive] = useState(false);
  const svgRef = useRef(null);
  const pointerRef = useRef(null);
  const onPointerMove = useCallback((e) => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    const ctm = svgRef.current?.getScreenCTM?.();
    if (!ctm) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    pointerRef.current = { x: pt.x, y: pt.y };
  }, []);
  const onPointerLeave = useCallback(() => { pointerRef.current = null; }, []);
```

Edit 4, replace the torus cell (the `<div style={{ position: 'relative', minWidth: 0, overflow: 'hidden' }}>` block through its closing `</div>`):

```jsx
          <div
            style={{ position: 'relative', minWidth: 0, overflow: 'hidden', isolation: 'isolate' }}
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
          >
            <canvas
              ref={collider.canvasRef}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            />
            {/* Read-only accretion field between the 2D collider and the SVG
                (spec docs/superpowers/specs/2026-09-25-council-field-accretion-design.md). */}
            <CouncilField
              simRef={collider.simRef}
              uiRef={collider.uiRef}
              seated={seated}
              pointerRef={pointerRef}
              mode={collider.mode}
              onLiveChange={setFieldLive}
            />
            {/* viewBox widened horizontally (−170..810) so long anchor labels on both
                arcs (e.g. "Nicholas Georgescu-Roegen", "D'Arcy Wentworth Thompson")
                have margin and are not clipped by the SVG edge; ring stays centered on 320. */}
            <svg ref={svgRef} viewBox="-170 0 980 640" style={{ width: '100%', height: 'auto', display: 'block', position: 'relative' }}>
              <RingScaffold showCore={!fieldLive} />
              {seated.map(m => (
                <Node
                  key={m.dimIndex}
                  mind={m}
                  active={
                    collider.mode === 'ARMED'
                      ? collider.armedMind?.dimIndex === m.dimIndex
                      : collider.activePairIds.includes(m.dimIndex)
                  }
                  onSelect={handleSelect}
                  showLabel={!isMobile}
                />
              ))}
            </svg>
          </div>
```

- [ ] **Step 4: Run the integration tests, then the full suite and lint**

Run: `npx vitest run src/terminal/views/manifesto/__tests__/councilRingField.test.jsx`
Expected: PASS, 3 tests.

Run: `npm test`
Expected: all files pass. That is the pre-plan count (129 files / 1691 tests) plus the new files: colliderSeam 2, geodesics 9, physics 6, matter 6, uniforms 14, paths 3, shader 4, field 6, ringField 3.

Run: `npm run lint`
Expected: 0 errors, warnings ≤ 153.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/manifesto/CouncilRing.jsx src/terminal/views/manifesto/__tests__/councilRingField.test.jsx
git commit -m "feat(manifesto): mount the accretion field under the Council Ring" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Browser verification, GPU budget, visual sign-off

No new code unless a check fails. If one does, fix it in the owning module, re-run that module's tests, commit with a `fix(manifesto): …` message, and repeat the check. Take screenshots **before** diagnosing any visual issue.

**Files:** none planned.

- [ ] **Step 1: Start the dev server and open the tab at desktop width**

- `preview_start` with `{ name: "scale94-dev" }`.
- `resize_window` to 1440 × 900.
- Wait out the boot sequence: `find "Manifesto"` returns a button.
- Run in the page via `javascript_tool`: `document.querySelector('button[aria-label="Manifesto"]').click()`.

- [ ] **Step 2: Prove the shader compiled**

Run `read_console_messages` with `onlyErrors: true`. Expected: no `[councilField]` error. If one is present, the driver log names the GLSL line: fix it in `councilFieldShader.js` and re-run Task 6's tests.

Then run in the page:

```js
!!document.querySelector('[data-testid="council-field"]') &&
  ![...document.querySelectorAll('svg text')].some(t => t.textContent === '◉')
```

Expected: `true`, which means the field is live and the glyph is hidden.

- [ ] **Step 3: Screenshot every state**

Drive each state with `javascript_tool`, using node test ids (`[data-testid="node-N"]`, dispatch `click`), and take one screenshot each:

1. AMBIENT: the disk and shadow at rest. The east side should be bright and blue-white, the west a dim ember. The lensed far-side hump should be visible over and under the shadow.
2. ARMED + tether: click one node, then move the pointer across the cell with `computer` `hover` at 3 positions. The tether should follow, and wrap around the shadow when the pointer is behind it.
3. Bridge, opposite seats: arm a west seat and fire the east seat directly across. Screenshot within 100 ms of the second click. Expected: two Einstein arcs around the shadow.
4. Mid-INFALL (~1.3 s after firing): the 2D particles should sit inside the arm sheaths and vanish at the shadow edge.
5. FLASH (~2.7–3.0 s): a white core with RGB fringes and the photon-ring flare.
6. EJECT (~3.2–4.0 s): the jet knot should sit on the 2D product dot, with a faint counter-jet opposite.
7. SYNTHESIZED: the synthesis panel should appear below the ring (the logic freeze holds end to end).

Repeat 1, 2 and 4 at `resize_window` preset `mobile` (375 × 812). Expected: no horizontal overflow, the field scaled with the cell, no tether on touch (a standing pulse at seat A instead).

- [ ] **Step 4: Measure the GPU cost at 1440 / DPR 2**

Run in the page (this times one extra full-screen draw with the live program and uniforms):

```js
const c = document.querySelector('[data-testid="council-field"]');
const gl = c.getContext('webgl2');
const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
if (!ext) 'timer query unavailable';
else {
  const samples = [];
  for (let i = 0; i < 20; i++) {
    const q = gl.createQuery();
    gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.endQuery(ext.TIME_ELAPSED_EXT);
    await new Promise(r => setTimeout(r, 50));
    if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) && !gl.getParameter(ext.GPU_DISJOINT_EXT))
      samples.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
    gl.deleteQuery(q);
  }
  ({ w: c.width, h: c.height, dpr: devicePixelRatio, ms: samples.sort((a, b) => a - b) });
}
```

- Measure in AMBIENT, and again during INFALL (the most expensive state, with arms plus disk).
- Expected median: under 1.0 ms.
- If the pane reports `timer query unavailable`, record that fact and hand the measurement to the owner (Chrome Performance panel, GPU track). Do not claim the budget is met.
- If over budget, cut per-pixel work (drop the `fine` matter fetch, tighten the arm wedge) and **never** the resolution. Re-measure.

- [ ] **Step 5: Crossfade and banding check**

In AMBIENT, take 30 screenshots 2 s apart (60 s). Check them for:
- a periodic brightness pulse every 7 s (the flow crossfade);
- visible stepped rings in the disk's dark falloff (banding).

Then ask the owner to watch 60 s live. Their eye is the final gate for "hypnotic, not mechanical".

- [ ] **Step 6: Reset and report**

- `resize_window` preset `desktop`.
- Run `npm test` and `npm run lint` one final time.
- Report to the owner: the screenshots, the GPU numbers (or their absence, stated plainly), and `git log --oneline` for the branch.
- Do not push.

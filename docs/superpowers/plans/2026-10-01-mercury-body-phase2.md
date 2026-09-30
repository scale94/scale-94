# /MERCURY Phase 2 — The Body — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The planet becomes a body you can spin. Dragging applies torque; the body has inertia; on release it settles back to the astronomical present. Spin heats it, and past a threshold it transmutes into quicksilver. The Sun sets each point's phase: solid on the night side, a liquid mirror across the day and trailing into dusk, boiling near noon. The liquid reflects only what exists: the Sun's disc and the four aether elements. OrbitControls and MercuryEnvironment are removed.

**Architecture:** Three new pure modules own the physics and are unit-tested:
- `mercuryThermal.js`: surface temperature and the Hg phase window.
- `mercuryBody.js`: a time-based rigid-body integrator with heat, hysteresis and recapture.
- `mercuryDrag.js`: pointer → angular velocity.

`orbitNodes.js` takes the element-node layout out of `MercurySphere.jsx` so the shader can reflect the same nodes. The raw shader swaps its yaw for a full body rotation matrix and gains a transmutation layer. All constants come from those modules through `glf()`. `MercuryPlanet.jsx` steps the body inside `useFrame` and writes uniforms. The camera is fixed.

**Tech Stack:** React 19, @react-three/fiber 9, three 0.183 (math classes in pure modules are fine; tests run in jsdom), Vitest 4, @testing-library/react 16.

**Spec:** `docs/superpowers/specs/2026-09-30-mercury-gem-polish-design.md` — §2 (decisions 3–8), §3 (corrections table), §5 (modules, shading 2–3, removed), §7 item 2.

**Base:** local `main` @ `2097bb79` (phase 1 merged). Work on a new branch `feature/mercury-body` created from `main`.

## Global Constraints

- Raw GLSL only: `RawShaderMaterial` with `glslVersion: THREE.GLSL3`. No `onBeforeCompile`, no `#include`, no three shader chunks. Shader strings must NOT contain `#version`.
- Every physical constant lives in a tested JS module and reaches the shader via `glf()` / `v3()`. Look constants the author tunes are uniforms fed from `PLANET_TUNE`, never baked.
- Per-frame values are written to uniforms inside `useFrame`, never through React state.
- Time-based, never frame-counted. The body integrator must give the same trajectory at 60 Hz and 360 Hz (parity test).
- Never `pow()` a possibly-negative base. Never name a variable `half`.
- No red incandescence, no bloom. Night side stays near-black. No cubemap, no PMREM, no passive environment reflections: the mirror reflects only the Sun disc, the four element emitters, and black space.
- Liquid roughness is never below 0.14 (the black-mirror trap).
- The 234.32 K / 629.88 K window is a stated artistic convention (1-atm values; in vacuum Hg has no boiling point). It says so in the module header.
- The return to the present is named `recapture`, never "tidal".
- `PLANET_TUNE.relief` stays 12 (author decision, 2026-10-01).
- Confidential author context is never written into code, comments, commits or copy.
- Lint gate: `npm run lint` must stay at 0 errors and not exceed 137 warnings. Pre-existing unrelated test failure: `src/terminal/art/__tests__/artComposite.test.js` "caps a coarse pointer at 1" (not ours).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push.

## Out of scope (later phases)
Body modes, capillary waves, spin bulge, impacts, scars (phase 3). Boiling roil, sodium tail, reduced motion, mobile perf pass (phase 4). The element tap still does not strike the planet until phase 3. `elements.resolveEnvState` becomes unused but stays (covered by `elements.test.js`); removing it belongs to a later cleanup.

## File Structure

| File | Responsibility |
|---|---|
| Create `src/terminal/mercury/planet/mercuryThermal.js` | Subsolar temperature, surface temperature with thermal lag, Hg phase window |
| Create `src/terminal/mercury/planet/mercuryBody.js` | Rigid-body integrator: grip, damping, recapture, heat store, transmutation τ |
| Create `src/terminal/mercury/planet/mercuryDrag.js` | Pointer deltas → angular velocity; drag tracker state machine |
| Create `src/terminal/mercury/useMercuryDrag.js` | DOM pointer wiring for the tracker |
| Create `src/terminal/mercury/orbitNodes.js` | Element node layout + precession (shared by ring and shader) |
| Modify `src/terminal/mercury/MercurySphere.jsx` | Use `orbitNodes.js` |
| Modify `src/terminal/mercury/planet/planetLook.js` | Optics constants, `PLANET_TUNE.sunGlint/emitGain`, drop `ORBIT_LIMITS` |
| Modify `src/terminal/mercury/planet/mercuryPlanetShader.js` | Body rotation matrix, transmutation, Hg phases, analytic reflections |
| Modify `src/terminal/mercury/planet/planetFrame.js` | Drop `sunDirForCamera` (camera is fixed now) |
| Modify `src/terminal/mercury/MercuryPlanet.jsx` | Step body, drag, emitters, tuning-rig registration |
| Modify `src/terminal/mercury/MercuryCanvas.jsx` | Remove OrbitControls, env, lights; pass emitters |
| Modify `src/terminal/mercury/mercuryTuning.js` | Drop env-only knobs |
| Delete `src/terminal/mercury/MercuryEnvironment.jsx`, `src/terminal/mercury/__tests__/mercuryEnvironment.test.js` | Spec §5 "Removed" |

---

### Task 1: Thermal model

**Files:**
- Create: `src/terminal/mercury/planet/mercuryThermal.js`
- Test: `src/terminal/mercury/planet/__tests__/mercuryThermal.test.js`

**Interfaces:**
- Produces: constants `HG_MELT_K = 234.32`, `HG_BOIL_K = 629.88`, `T_SS_PERIHELION_K = 700`, `PERIHELION_AU = 0.307`, `T_NIGHT_FLOOR_K = 100`, `T_SUNSET_K = 400`, `TAU_WARM_H = 860`, `TAU_COOL_H = 290`, `SOLAR_DAY_H = 4222.6`, `HOURS_PER_RAD`; `subsolarTempK(rAU) → K`; `surfaceTempK(mu0, lonRelRad, cosLat, tssK, heatK = 0) → K` (positional, mirrored exactly in GLSL by Task 5); `hgPhase(tK) → 'solid' | 'liquid' | 'boiling'`.
- Convention: `lonRelRad` is the body longitude relative to the subsolar longitude, wrapped to (−π, π]; positive = east of the subsolar point = afternoon (Mercury rotates prograde, so the Sun moves west across the sky).

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/mercury/planet/__tests__/mercuryThermal.test.js
import { describe, it, expect } from 'vitest';
import {
  HG_MELT_K, HG_BOIL_K, T_NIGHT_FLOOR_K, HOURS_PER_RAD, SOLAR_DAY_H,
  subsolarTempK, surfaceTempK, hgPhase,
} from '../mercuryThermal';

const D = Math.PI / 180;
const eq = (lonDeg, tss, heat = 0) => surfaceTempK(Math.cos(lonDeg * D), lonDeg * D, 1, tss, heat);

describe('mercuryThermal', () => {
  it('subsolar temperature: ~700 K at perihelion, ~568 K at aphelion', () => {
    expect(subsolarTempK(0.307)).toBeCloseTo(700, 6);
    expect(subsolarTempK(0.4667)).toBeCloseTo(567.7, 0);
  });

  it('HOURS_PER_RAD is the 176-day solar day over 2π', () => {
    expect(HOURS_PER_RAD).toBeCloseTo(SOLAR_DAY_H / (2 * Math.PI), 12);
  });

  it('noon at perihelion boils; the boil line sits near 49° (spec §3)', () => {
    expect(hgPhase(eq(0, 700))).toBe('boiling');
    expect(hgPhase(eq(40, 700))).toBe('boiling');
    expect(hgPhase(eq(55, 700))).toBe('liquid');
  });

  it('at aphelion the Sun alone cannot boil it; spin heat can', () => {
    const tss = subsolarTempK(0.4667);
    expect(hgPhase(eq(0, tss))).toBe('liquid');
    expect(hgPhase(eq(0, tss, 80))).toBe('boiling');
  });

  it('dusk trails liquid past sunset, then freezes', () => {
    expect(hgPhase(eq(105, 700))).toBe('liquid');  // 15° past the dusk terminator
    expect(hgPhase(eq(120, 700))).toBe('solid');   // 30° past
  });

  it('dawn is frozen where the matching afternoon is liquid (rotation direction visible)', () => {
    expect(hgPhase(eq(-80, 700))).toBe('solid');   // 10° after sunrise
    expect(hgPhase(eq(80, 700))).toBe('liquid');   // 10° before sunset
    expect(hgPhase(eq(-60, 700))).toBe('liquid');  // warmed by 30° after sunrise
  });

  it('is continuous across both terminators', () => {
    const e = 1e-7;
    expect(Math.abs(eq(90 - e / D, 700) - eq(90 + e / D, 700))).toBeLessThan(0.01);
    expect(Math.abs(eq(-90 - e / D, 700) - eq(-90 + e / D, 700))).toBeLessThan(0.5);
  });

  it('the end of the long night sits at the floor', () => {
    expect(eq(-95, 700)).toBeLessThan(T_NIGHT_FLOOR_K + 1);        // just before dawn
    expect(eq(-95, 700)).toBeGreaterThanOrEqual(T_NIGHT_FLOOR_K);
  });

  it('spin heat adds uniformly', () => {
    expect(eq(150, 700, 50) - eq(150, 700, 0)).toBeCloseTo(50, 9);
  });

  it('hgPhase uses the 1-atm window', () => {
    expect(hgPhase(HG_MELT_K - 0.01)).toBe('solid');
    expect(hgPhase(HG_MELT_K + 0.01)).toBe('liquid');
    expect(hgPhase(HG_BOIL_K + 0.01)).toBe('boiling');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryThermal.test.js`
Expected: FAIL — cannot resolve `../mercuryThermal`.

- [ ] **Step 3: Write the implementation**

```js
// src/terminal/mercury/planet/mercuryThermal.js — how hot each point of Mercury is.
//
// PRECISION BOUNDARY, stated so no reader assumes more:
// - Subsolar equilibrium T_ss(r) = 700 K · √(0.307 AU / r) (≈700 K perihelion,
//   ≈570 K aphelion). Day side T = T_ss · cos^¼θ.
// - Thermal lag is a two-timescale caricature, not a regolith model: mornings
//   warm toward equilibrium with TAU_WARM_H; after sunset the surface cools from
//   T_SUNSET_K toward T_NIGHT_FLOOR_K with TAU_COOL_H. The values are chosen so
//   dusk stays liquid ~20° past sunset and dawn stays frozen ~25° after sunrise
//   (spec §3), which makes the rotation direction visible.
// - The Hg window 234.32 K / 629.88 K is the 1-ATM convention, an ARTISTIC
//   CHOICE: in vacuum liquid mercury has no boiling point and evaporates at any
//   temperature.
// mercuryPlanetShader.js mirrors surfaceTempK exactly (constants via glf).

export const HG_MELT_K = 234.32;
export const HG_BOIL_K = 629.88;

export const T_SS_PERIHELION_K = 700;
export const PERIHELION_AU = 0.307;
export const T_NIGHT_FLOOR_K = 100;
export const T_SUNSET_K = 400;
export const TAU_WARM_H = 860;
export const TAU_COOL_H = 290;
export const SOLAR_DAY_H = 4222.6;          // 175.94 Earth days
export const HOURS_PER_RAD = SOLAR_DAY_H / (2 * Math.PI);

const HALF_PI = Math.PI / 2;

export function subsolarTempK(rAU) {
  return T_SS_PERIHELION_K * Math.sqrt(PERIHELION_AU / rAU);
}

export function surfaceTempK(mu0, lonRel, cosLat, tss, heatK = 0) {
  const tset = T_SUNSET_K * Math.pow(Math.max(cosLat, 0), 0.25);
  const teq = tss * Math.pow(Math.max(mu0, 0), 0.25);
  let t;
  if (lonRel >= -HALF_PI && lonRel <= HALF_PI) {
    if (lonRel < 0) {
      const h = (lonRel + HALF_PI) * HOURS_PER_RAD;
      t = T_NIGHT_FLOOR_K + (Math.max(teq, T_NIGHT_FLOOR_K) - T_NIGHT_FLOOR_K) * (1 - Math.exp(-h / TAU_WARM_H));
    } else {
      t = Math.max(teq, tset);
    }
  } else {
    const h = (lonRel > 0 ? lonRel - HALF_PI : lonRel + 3 * HALF_PI) * HOURS_PER_RAD;
    t = T_NIGHT_FLOOR_K + (tset - T_NIGHT_FLOOR_K) * Math.exp(-h / TAU_COOL_H);
  }
  return t + heatK;
}

export function hgPhase(tK) {
  if (tK < HG_MELT_K) return 'solid';
  if (tK > HG_BOIL_K) return 'boiling';
  return 'liquid';
}
```

Hand check: at +15° past dusk, h = 0.2618·672.1 = 176 h, so T = 100 + 300·e^(−0.607) = 263 K (liquid). At +30°, T = 189 K (solid). At −80°, h = 117 h, teq = 452, so T = 100 + 352·(1 − e^(−0.136)) = 145 K (solid). At −60°, T = 264 K (liquid).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryThermal.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/planet/mercuryThermal.js src/terminal/mercury/planet/__tests__/mercuryThermal.test.js
git commit -m "feat(mercury): thermal model — subsolar T, thermal lag, 1-atm Hg window

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The body integrator

**Files:**
- Create: `src/terminal/mercury/planet/mercuryBody.js`
- Test: `src/terminal/mercury/planet/__tests__/mercuryBody.test.js`

**Interfaces:**
- Produces:
  - Constants: `MAX_SUBSTEP_S = 1/480`, `GRIP_PER_S = 18`, `SPIN_DAMP_PER_S = 0.35`, `MAX_OMEGA = 12`, `RECAPTURE_OMEGA = 0.8`, `RECAPTURE_RAMP_S = 4`, `HEAT_GAIN = 0.58`, `HEAT_LEAK_PER_S = 0.035`, `MELT_HEAT_K = 60`, `FREEZE_HEAT_K = 25`, `TRANSMUTE_S = 3`.
  - `targetFromYaw(yaw, out?) → THREE.Quaternion`: a rotation about world +Y, the same rotation as `planetFrame.rotY`.
  - `createBody(q0: THREE.Quaternion) → { q, omega: THREE.Vector3, heatK, tau, liquid, sinceReleaseS }`.
  - `stepBody(body, dtS, { dragging, omegaPtr: [x,y,z], target: THREE.Quaternion }) → body` (mutates).
  - `rotationError(q, target, out?) → THREE.Vector3`: the world-frame axis·angle that turns q onto target.
- Frame: `body.q` rotates body → world. The shader's `uBodyRot` is its matrix. ω is world-frame, so dq/dt = ½ (ω, 0) ⊗ q.

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/mercury/planet/__tests__/mercuryBody.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createBody, stepBody, targetFromYaw, rotationError,
  MELT_HEAT_K, FREEZE_HEAT_K, MAX_OMEGA,
} from '../mercuryBody';
import { rotY } from '../planetFrame';

const angleBetween = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.dot(b))));

// Time-based scenario: drag at ω = (0, 4, 0) for 10 s, then release.
function run(hz, seconds, dragS = 10, omegaPtr = [0, 4, 0]) {
  const target = targetFromYaw(0.3);
  const body = createBody(target);
  const dt = 1 / hz;
  const samples = [];
  const n = Math.round(seconds * hz);
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    stepBody(body, dt, { dragging: t < dragS, omegaPtr, target });
    samples.push({ t: t + dt, tau: body.tau, heatK: body.heatK, q: body.q.clone() });
  }
  return { body, samples, target };
}
const at = (samples, t) => samples.find((s) => s.t >= t - 1e-9);

describe('mercuryBody', () => {
  it('targetFromYaw is the same rotation as planetFrame.rotY', () => {
    const q = targetFromYaw(1.1);
    const v = new THREE.Vector3(0.3, -0.4, 0.866).applyQuaternion(q);
    const r = rotY([0.3, -0.4, 0.866], 1.1);
    expect(v.x).toBeCloseTo(r[0], 12); expect(v.y).toBeCloseTo(r[1], 12); expect(v.z).toBeCloseTo(r[2], 12);
  });

  it('rotationError is zero at the target and points along the short way', () => {
    const t = targetFromYaw(0.5);
    expect(rotationError(t, t).length()).toBeLessThan(1e-9);
    const e = rotationError(targetFromYaw(0.2), t);
    expect(e.y).toBeCloseTo(0.3, 9);
    expect(Math.abs(e.x) + Math.abs(e.z)).toBeLessThan(1e-9);
  });

  it('at rest on the present it stays there, cold and solid', () => {
    const target = targetFromYaw(-2);
    const body = createBody(target);
    for (let i = 0; i < 600; i++) stepBody(body, 1 / 60, { dragging: false, omegaPtr: [0, 0, 0], target });
    expect(angleBetween(body.q, target)).toBeLessThan(1e-9);
    expect(body.heatK).toBe(0);
    expect(body.tau).toBe(0);
  });

  it('dragging grips the pointer: ω converges to omegaPtr and the body turns', () => {
    const { body } = run(60, 2, 2);
    expect(body.omega.y).toBeGreaterThan(3.9);
    expect(Math.abs(body.omega.x) + Math.abs(body.omega.z)).toBeLessThan(1e-6);
  });

  it('never spins faster than MAX_OMEGA', () => {
    const { body } = run(60, 2, 2, [0, 100, 0]);
    expect(body.omega.length()).toBeLessThanOrEqual(MAX_OMEGA + 1e-9);
  });

  it('recapture: released, it settles back to the astronomical present', () => {
    const { body, target } = run(60, 40, 3);
    expect(angleBetween(body.q, target)).toBeLessThan(0.5 * Math.PI / 180);
    expect(body.omega.length()).toBeLessThan(1e-2);
  });

  it('spin heats it; past MELT it transmutes to τ = 1', () => {
    const { samples } = run(60, 14);
    expect(at(samples, 10).heatK).toBeGreaterThan(MELT_HEAT_K);
    expect(at(samples, 13).tau).toBeGreaterThan(0.99);
  });

  it('hysteresis: liquid lingers ≥ 25 s after release, frozen by 90 s', () => {
    const { samples } = run(60, 100);
    expect(at(samples, 35).tau).toBeGreaterThan(0.99);
    expect(at(samples, 100).tau).toBe(0);
    expect(at(samples, 100).heatK).toBeLessThan(FREEZE_HEAT_K);
  });

  it('60 Hz and 360 Hz give the same trajectory (time-based parity)', () => {
    const a = run(60, 40).samples, b = run(360, 40).samples;
    for (const t of [1, 5, 10, 12, 20, 40]) {
      const sa = at(a, t), sb = at(b, t);
      expect(angleBetween(sa.q, sb.q)).toBeLessThan(2e-3);
      expect(Math.abs(sa.heatK - sb.heatK)).toBeLessThan(0.01 * Math.max(1, sa.heatK));
      expect(Math.abs(sa.tau - sb.tau)).toBeLessThan(0.01);
    }
  });

  it('ignores non-positive dt', () => {
    const target = targetFromYaw(0);
    const body = createBody(target);
    stepBody(body, 0, { dragging: true, omegaPtr: [0, 5, 0], target });
    stepBody(body, -1, { dragging: true, omegaPtr: [0, 5, 0], target });
    expect(body.omega.length()).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryBody.test.js`
Expected: FAIL — cannot resolve `../mercuryBody`.

- [ ] **Step 3: Write the implementation**

```js
// src/terminal/mercury/planet/mercuryBody.js — the planet as a body you can spin.
//
// Time-based rigid rotation (spec §5): a drag grips the body toward the
// pointer's angular velocity; released, free spin damps and a critically
// damped `recapture` spring (ramped in over RECAPTURE_RAMP_S) returns it to
// the ephemeris orientation. `recapture` is honest naming: real tidal
// relaxation takes millions of years; the 3:2 lock is what the ephemeris
// orientation IS. Dissipated rotation heats a store (H += κ|ω|²dt, leaks λH),
// and transmutation τ ∈ [0,1] follows melt/freeze thresholds with
// hysteresis, so liquid lingers ~30–60 s after a spin.
// Fixed-size substeps (≤ MAX_SUBSTEP_S) make 60 Hz and 360 Hz agree.

import * as THREE from 'three';

export const MAX_SUBSTEP_S = 1 / 480;
export const GRIP_PER_S = 18;          // how hard a drag grips the body
export const SPIN_DAMP_PER_S = 0.35;   // free-spin damping after release
export const MAX_OMEGA = 12;           // rad/s
export const RECAPTURE_OMEGA = 0.8;    // rad/s natural frequency of the return
export const RECAPTURE_RAMP_S = 4;     // inertia first, then recapture
export const HEAT_GAIN = 0.58;         // K per (rad/s)² per s
export const HEAT_LEAK_PER_S = 0.035;
export const MELT_HEAT_K = 60;
export const FREEZE_HEAT_K = 25;
export const TRANSMUTE_S = 3;          // τ 0 → 1 duration

const Y_AXIS = new THREE.Vector3(0, 1, 0);

export function targetFromYaw(yaw, out = new THREE.Quaternion()) {
  return out.setFromAxisAngle(Y_AXIS, yaw);
}

export function createBody(q0) {
  return {
    q: q0.clone(),
    omega: new THREE.Vector3(),
    heatK: 0,
    tau: 0,
    liquid: false,
    sinceReleaseS: Infinity,
  };
}

const _qInv = new THREE.Quaternion();
const _err = new THREE.Quaternion();
const _dq = new THREE.Quaternion();
const _e = new THREE.Vector3();

export function rotationError(q, target, out = new THREE.Vector3()) {
  _qInv.copy(q).invert();
  _err.copy(target).multiply(_qInv);
  if (_err.w < 0) _err.set(-_err.x, -_err.y, -_err.z, -_err.w);
  const s = Math.sqrt(Math.max(0, 1 - _err.w * _err.w));
  if (s < 1e-9) return out.set(2 * _err.x, 2 * _err.y, 2 * _err.z);
  const angle = 2 * Math.acos(Math.min(1, _err.w));
  return out.set((_err.x / s) * angle, (_err.y / s) * angle, (_err.z / s) * angle);
}

const smooth01 = (x) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

function substep(b, h, dragging, omegaPtr, target) {
  const w = b.omega;
  if (dragging) {
    b.sinceReleaseS = 0;
    const k = 1 - Math.exp(-GRIP_PER_S * h);
    w.set(w.x + (omegaPtr[0] - w.x) * k, w.y + (omegaPtr[1] - w.y) * k, w.z + (omegaPtr[2] - w.z) * k);
  } else {
    b.sinceReleaseS += h;
    w.multiplyScalar(Math.exp(-SPIN_DAMP_PER_S * h));
    const ramp = smooth01(b.sinceReleaseS / RECAPTURE_RAMP_S);
    if (ramp > 0) {
      const K = RECAPTURE_OMEGA * RECAPTURE_OMEGA * ramp;
      const C = 2 * RECAPTURE_OMEGA * Math.sqrt(ramp);
      rotationError(b.q, target, _e);
      w.set(w.x + (K * _e.x - C * w.x) * h, w.y + (K * _e.y - C * w.y) * h, w.z + (K * _e.z - C * w.z) * h);
    }
  }
  const len = w.length();
  if (len > MAX_OMEGA) w.multiplyScalar(MAX_OMEGA / len);

  // dq/dt = ½ (ω, 0) ⊗ q — world-frame angular velocity.
  _dq.set(w.x, w.y, w.z, 0).multiply(b.q);
  b.q.set(b.q.x + 0.5 * h * _dq.x, b.q.y + 0.5 * h * _dq.y, b.q.z + 0.5 * h * _dq.z, b.q.w + 0.5 * h * _dq.w).normalize();

  b.heatK += (HEAT_GAIN * w.lengthSq() - HEAT_LEAK_PER_S * b.heatK) * h;
  if (b.heatK >= MELT_HEAT_K) b.liquid = true;
  else if (b.heatK <= FREEZE_HEAT_K) b.liquid = false;
  const goal = b.liquid ? 1 : 0;
  const stepTau = h / TRANSMUTE_S;
  b.tau = goal > b.tau ? Math.min(goal, b.tau + stepTau) : Math.max(goal, b.tau - stepTau);
}

export function stepBody(b, dtS, { dragging = false, omegaPtr = [0, 0, 0], target }) {
  if (!(dtS > 0)) return b;
  const n = Math.max(1, Math.ceil(dtS / MAX_SUBSTEP_S - 1e-9));
  const h = dtS / n;
  for (let i = 0; i < n; i++) substep(b, h, dragging, omegaPtr, target);
  return b;
}
```

Hand check (hysteresis test): Hss at ω = 4 is 0.58·16/0.035 = 265 K. After 10 s, H = 265·(1 − e^(−0.35)) ≈ 78 K, so it melts at about 7.3 s and τ = 1 by about 10.3 s. After release the heat decays about as 78·e^(−0.035·t). It reaches 25 K at about 32 s after release (t ≈ 42 s), so it is still liquid at t = 35 s. τ then falls over 3 s and is 0 well before t = 100 s.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryBody.test.js`
Expected: PASS. If ONLY the hysteresis timing test fails by a few seconds, report the measured τ/heat at t = 35 s and t = 100 s rather than changing the constants or the test. Do not loosen the parity tolerance.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/planet/mercuryBody.js src/terminal/mercury/planet/__tests__/mercuryBody.test.js
git commit -m "feat(mercury): the body — grip, inertia, recapture, heat store, transmutation hysteresis

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Shared orbit-node layout

**Files:**
- Create: `src/terminal/mercury/orbitNodes.js`
- Modify: `src/terminal/mercury/MercurySphere.jsx`
- Test: `src/terminal/mercury/__tests__/orbitNodes.test.js`

**Interfaces:**
- Produces: `ORBIT_RADIUS = 1.4`, `PRECESSION_RATE`, `PRECESSION_DRIFT`, `ORBIT_NODES: Array<{ phase, angle, color, element, glyph }>` (same four entries and order as today), `orbitPrecessionAngle(tS) → rad`, `nodeWorldPosition(angle, precession) → [x, y, 0]`.
- Why: the shader (Task 5/6) reflects the element nodes at their real positions. The ring and the shader must share one source.

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/mercury/__tests__/orbitNodes.test.js
import { describe, it, expect } from 'vitest';
import {
  ORBIT_RADIUS, ORBIT_NODES, PRECESSION_RATE, PRECESSION_DRIFT, orbitPrecessionAngle, nodeWorldPosition,
} from '../orbitNodes';
import { ELEMENTS } from '../elements';

describe('orbitNodes', () => {
  it('keeps the four element nodes in their cardinal places', () => {
    expect(ORBIT_NODES.map((n) => [n.phase, n.angle])).toEqual([
      ['air', Math.PI / 2], ['thermal', 0], ['earth', -Math.PI / 2], ['fluid', Math.PI],
    ]);
    for (const n of ORBIT_NODES) expect(n.color).toBe(ELEMENTS[n.phase].color);
  });

  it('precesses at PRECESSION_RATE and adds PRECESSION_DRIFT per full turn', () => {
    expect(orbitPrecessionAngle(0)).toBe(0);
    expect(orbitPrecessionAngle(10)).toBeCloseTo(PRECESSION_RATE * 10, 12);
    const turn = (2 * Math.PI) / PRECESSION_RATE;
    expect(orbitPrecessionAngle(turn + 1)).toBeCloseTo(PRECESSION_DRIFT + PRECESSION_RATE, 9);
  });

  it('places a node on the ring, rotated by the precession (ring rotation.z)', () => {
    const [x, y, z] = nodeWorldPosition(0, Math.PI / 2);
    expect(x).toBeCloseTo(0, 12);
    expect(y).toBeCloseTo(ORBIT_RADIUS, 12);
    expect(z).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/mercury/__tests__/orbitNodes.test.js`
Expected: FAIL — cannot resolve `../orbitNodes`.

- [ ] **Step 3: Write `orbitNodes.js`**

```js
// src/terminal/mercury/orbitNodes.js — where the four element nodes sit.
// Shared by MercurySphere (the ring and its handles) and MercuryPlanet (the
// liquid mirror reflects the elements at these exact positions).

import { ELEMENTS } from './elements';

export const ORBIT_RADIUS = 1.4;
export const PRECESSION_RATE = 0.3 * (Math.PI / 180);  // 0.3°/s in radians
export const PRECESSION_DRIFT = 0.5 * (Math.PI / 180); // 0.5° drift per full cycle

// Cardinal positions: N=air, E=fire(thermal), S=earth, W=water(fluid)
export const ORBIT_NODES = [
  { phase: 'air',     angle: Math.PI / 2,  color: ELEMENTS.air.color,     element: 'AIR',   glyph: 'air'   },
  { phase: 'thermal', angle: 0,            color: ELEMENTS.thermal.color, element: 'FIRE',  glyph: 'fire'  },
  { phase: 'earth',   angle: -Math.PI / 2, color: ELEMENTS.earth.color,   element: 'EARTH', glyph: 'earth' },
  { phase: 'fluid',   angle: Math.PI,      color: ELEMENTS.fluid.color,   element: 'WATER', glyph: 'water' },
];

export function orbitPrecessionAngle(tS) {
  const raw = PRECESSION_RATE * tS;
  const turns = Math.floor(raw / (2 * Math.PI));
  return raw - turns * 2 * Math.PI + turns * PRECESSION_DRIFT;
}

export function nodeWorldPosition(angle, precession) {
  const a = angle + precession;
  return [Math.cos(a) * ORBIT_RADIUS, Math.sin(a) * ORBIT_RADIUS, 0];
}
```

- [ ] **Step 4: Refactor `MercurySphere.jsx` onto it**

Delete the local `ORBIT_NODES` array, including its two cardinal-position comment lines above it, and the local `ORBIT_RADIUS`, `PRECESSION_RATE` and `PRECESSION_DRIFT` constants. Add:

```js
import { ORBIT_NODES, ORBIT_RADIUS, orbitPrecessionAngle } from './orbitNodes';
```

Remove `orbitAngleRef` and `cycleCountRef`. Replace the `useFrame` body with:

```jsx
  useFrame(({ clock }) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = orbitPrecessionAngle(clock.elapsedTime);
    }
  });
```

If `ELEMENTS` is no longer used in the file after this, remove its import. Leave everything else untouched: `ElementGlyph`, the ring, the thread and the handles.

- [ ] **Step 5: Run tests + lint**

Run: `npx vitest run src/terminal/mercury && npx eslint src/terminal/mercury/orbitNodes.js src/terminal/mercury/MercurySphere.jsx`
Expected: PASS, no lint errors/warnings on these files.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/mercury/orbitNodes.js src/terminal/mercury/__tests__/orbitNodes.test.js src/terminal/mercury/MercurySphere.jsx
git commit -m "refactor(mercury): one source for the element-node layout and precession

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Drag → angular velocity

**Files:**
- Create: `src/terminal/mercury/planet/mercuryDrag.js`
- Create: `src/terminal/mercury/useMercuryDrag.js`
- Test: `src/terminal/mercury/planet/__tests__/mercuryDrag.test.js`, `src/terminal/mercury/__tests__/useMercuryDrag.test.jsx`

**Interfaces:**
- Produces:
  - Constants: `DRAG_RAD_PER_HEIGHT = 2.5`, `POINTER_HOLD_MS = 60`, `MIN_POINTER_DT_S = 1/240`.
  - `pointerOmega(dxPx, dyPx, dtS, heightPx) → [wx, wy, 0]`. Dragging right spins about +Y (the front surface moves right); dragging down spins about +X (the front surface moves down).
  - `createDragTracker() → { down(x, y, tMs), move(x, y, tMs, heightPx), up(), sample(nowMs) → { dragging, omegaPtr: [x,y,z] } }`. A held but unmoving pointer grips at ω = 0 after `POINTER_HOLD_MS`.
  - `useMercuryDrag(el) → tracker`: binds pointerdown/move/up/cancel on `el`, sets cursor grab/grabbing, and captures the pointer.

- [ ] **Step 1: Write the failing tests**

```js
// src/terminal/mercury/planet/__tests__/mercuryDrag.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { pointerOmega, createDragTracker, DRAG_RAD_PER_HEIGHT, POINTER_HOLD_MS, MIN_POINTER_DT_S } from '../mercuryDrag';

describe('pointerOmega', () => {
  it('a full-height drag in one second spins DRAG_RAD_PER_HEIGHT rad/s', () => {
    expect(pointerOmega(0, 800, 1, 800)).toEqual([DRAG_RAD_PER_HEIGHT, 0, 0]);
    expect(pointerOmega(800, 0, 1, 800)).toEqual([0, DRAG_RAD_PER_HEIGHT, 0]);
  });

  it('dragging right moves the front surface right; dragging down moves it down', () => {
    const front = new THREE.Vector3(0, 0, 1);
    const [, wy] = pointerOmega(10, 0, 0.1, 800);
    const right = front.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), wy * 0.01);
    expect(right.x).toBeGreaterThan(0);
    const [wx] = pointerOmega(0, 10, 0.1, 800);
    const down = front.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), wx * 0.01);
    expect(down.y).toBeLessThan(0);
  });

  it('floors dt so coalesced events cannot explode', () => {
    expect(pointerOmega(0, 10, 0, 800)[0]).toBeCloseTo((10 * DRAG_RAD_PER_HEIGHT) / 800 / MIN_POINTER_DT_S, 9);
  });
});

describe('createDragTracker', () => {
  it('idle → not dragging, zero ω', () => {
    expect(createDragTracker().sample(0)).toEqual({ dragging: false, omegaPtr: [0, 0, 0] });
  });

  it('down/move reports the pointer ω; up releases', () => {
    const d = createDragTracker();
    d.down(100, 100, 0);
    d.move(180, 100, 100, 800);
    const s = d.sample(110);
    expect(s.dragging).toBe(true);
    expect(s.omegaPtr[1]).toBeCloseTo((80 * DRAG_RAD_PER_HEIGHT) / 800 / 0.1, 9);
    d.up();
    expect(d.sample(120)).toEqual({ dragging: false, omegaPtr: [0, 0, 0] });
  });

  it('a held, unmoving pointer grips at zero ω', () => {
    const d = createDragTracker();
    d.down(0, 0, 0);
    d.move(50, 0, 16, 800);
    expect(d.sample(16 + POINTER_HOLD_MS + 1)).toEqual({ dragging: true, omegaPtr: [0, 0, 0] });
  });

  it('move without down is ignored', () => {
    const d = createDragTracker();
    d.move(50, 0, 16, 800);
    expect(d.sample(20)).toEqual({ dragging: false, omegaPtr: [0, 0, 0] });
  });
});
```

```jsx
// src/terminal/mercury/__tests__/useMercuryDrag.test.jsx
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import useMercuryDrag from '../useMercuryDrag';

const ev = (type, props) => Object.assign(new Event(type), { button: 0, pointerId: 1, ...props });

describe('useMercuryDrag', () => {
  it('wires pointer events on the element into the tracker and cleans up', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'clientHeight', { value: 800 });
    const { result, unmount } = renderHook(() => useMercuryDrag(el));
    expect(el.style.cursor).toBe('grab');
    el.dispatchEvent(ev('pointerdown', { clientX: 0, clientY: 0 }));
    expect(el.style.cursor).toBe('grabbing');
    expect(result.current.sample(performance.now()).dragging).toBe(true);
    el.dispatchEvent(ev('pointerup', {}));
    expect(result.current.sample(performance.now()).dragging).toBe(false);
    unmount();
    el.dispatchEvent(ev('pointerdown', { clientX: 0, clientY: 0 }));
    expect(result.current.sample(performance.now()).dragging).toBe(false);
  });

  it('ignores secondary buttons', () => {
    const el = document.createElement('div');
    const { result } = renderHook(() => useMercuryDrag(el));
    el.dispatchEvent(ev('pointerdown', { button: 2, clientX: 0, clientY: 0 }));
    expect(result.current.sample(performance.now()).dragging).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryDrag.test.js src/terminal/mercury/__tests__/useMercuryDrag.test.jsx`
Expected: FAIL — cannot resolve `../mercuryDrag` / `../useMercuryDrag`.

- [ ] **Step 3: Write the implementation**

```js
// src/terminal/mercury/planet/mercuryDrag.js — a drag on the canvas → the
// angular velocity the body is gripped toward (mercuryBody.stepBody).
// Screen y grows downward: dragging down spins about +X, which carries the
// front surface down; dragging right spins about +Y, carrying it right.

export const DRAG_RAD_PER_HEIGHT = 2.5; // a full-canvas-height drag turns the body 2.5 rad
export const POINTER_HOLD_MS = 60;      // no move for this long = holding still
export const MIN_POINTER_DT_S = 1 / 240;

const ZERO = Object.freeze([0, 0, 0]);

export function pointerOmega(dxPx, dyPx, dtS, heightPx) {
  const k = DRAG_RAD_PER_HEIGHT / Math.max(heightPx, 1) / Math.max(dtS, MIN_POINTER_DT_S);
  return [dyPx * k, dxPx * k, 0];
}

export function createDragTracker() {
  const s = { dragging: false, x: 0, y: 0, tMs: 0, lastMoveMs: 0, omega: ZERO };
  return {
    down(x, y, tMs) {
      Object.assign(s, { dragging: true, x, y, tMs, lastMoveMs: tMs, omega: ZERO });
    },
    move(x, y, tMs, heightPx) {
      if (!s.dragging) return;
      s.omega = pointerOmega(x - s.x, y - s.y, (tMs - s.tMs) / 1000, heightPx);
      Object.assign(s, { x, y, tMs, lastMoveMs: tMs });
    },
    up() {
      s.dragging = false;
      s.omega = ZERO;
    },
    sample(nowMs) {
      const held = nowMs - s.lastMoveMs > POINTER_HOLD_MS;
      return { dragging: s.dragging, omegaPtr: s.dragging && !held ? [...s.omega] : [0, 0, 0] };
    },
  };
}
```

```js
// src/terminal/mercury/useMercuryDrag.js — binds pointer events on the canvas
// to a drag tracker. The element handles (drei <Html>) live in a sibling
// overlay, so tapping a node never starts a drag.

import { useEffect, useMemo } from 'react';
import { createDragTracker } from './planet/mercuryDrag';

export default function useMercuryDrag(el) {
  const tracker = useMemo(() => createDragTracker(), []);

  useEffect(() => {
    if (!el) return undefined;
    el.style.cursor = 'grab';
    const onDown = (e) => {
      if (e.button !== 0 || e.isPrimary === false) return;
      el.setPointerCapture?.(e.pointerId);
      el.style.cursor = 'grabbing';
      tracker.down(e.clientX, e.clientY, performance.now());
    };
    const onMove = (e) => tracker.move(e.clientX, e.clientY, performance.now(), el.clientHeight);
    const onUp = (e) => {
      el.releasePointerCapture?.(e.pointerId);
      el.style.cursor = 'grab';
      tracker.up();
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.style.cursor = '';
      tracker.up();
    };
  }, [el, tracker]);

  return tracker;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryDrag.test.js src/terminal/mercury/__tests__/useMercuryDrag.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/planet/mercuryDrag.js src/terminal/mercury/useMercuryDrag.js src/terminal/mercury/planet/__tests__/mercuryDrag.test.js src/terminal/mercury/__tests__/useMercuryDrag.test.jsx
git commit -m "feat(mercury): drag grips the body — pointer to angular velocity

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The shader — body rotation, transmutation, three phases of the element, analytic reflections

**Files:**
- Modify: `src/terminal/mercury/planet/planetLook.js`
- Modify: `src/terminal/mercury/planet/mercuryPlanetShader.js`
- Test: `src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`

**Interfaces:**
- Consumes: Task 1 constants (`HG_MELT_K`, `HG_BOIL_K`, `T_NIGHT_FLOOR_K`, `T_SUNSET_K`, `TAU_WARM_H`, `TAU_COOL_H`, `HOURS_PER_RAD`).
- Produces:
  - New `planetLook.js` exports: `HG_F0 = [0.76, 0.77, 0.78]`, `ROUGH_LIQUID = 0.14`, `ROUGH_BOIL = 0.4`, `SOLID_HG_ALBEDO = [0.52, 0.53, 0.55]`, `SPARKLE_CELLS = 700`, `SPARKLE_DENSITY = 0.004`, `SPARKLE_COS = 0.97`, `SPARKLE_GAIN = 3`, `EMIT_RADIUS = 0.5`, `FRONT_EDGE = 0.12`, `FRONT_SOFT = 0.03`, `FRONT_NOISE_FREQ = 6`, `PHASE_BLEND_K = 8`.
  - `PLANET_TUNE` gains `sunGlint: 8`, `emitGain: 1.5`. `relief` stays 12.
  - `ORBIT_LIMITS` is removed; its only consumer goes in Task 6.
  - `PLANET_UNIFORMS` becomes `['uAlbedo','uDem','uHasMaps','uSunDir','uBodyRot','uSunIrr','uSunSinR','uDemTexel','uTime','uExposure','uRelief','uNightFloor','uTau','uHeatK','uSubsolarT','uEmitPos','uEmitCol','uSunGlint','uEmitGain']`. `uBodyRot` is a `mat3`, body → world, from `mercuryBody.q`. `uEmitPos` and `uEmitCol` are `vec3[4]` in `ORBIT_NODES` order; each colour is linear and pre-multiplied by its live opacity.
- Frame change: `nb = ng * uBodyRot` (i.e. transpose(M)·ng), replacing `rotY(ng, −uBodyYaw)`. `uBodyRot = R_y(yaw)` reproduces phase 1 exactly. `rotY()` is no longer needed in GLSL and is removed.

- [ ] **Step 1: Add the constants to `planetLook.js`**

Delete the `ORBIT_LIMITS` line. After `FALLBACK_ALBEDO`, add:

```js
// Quicksilver (spec §3, §5 shading 3). Physical-ish; baked via glf.
export const HG_F0 = [0.76, 0.77, 0.78];      // liquid Hg normal-incidence reflectance, near-neutral
export const ROUGH_LIQUID = 0.14;             // never lower: a sharper mirror of black space is black glass
export const ROUGH_BOIL = 0.4;                // boiling breaks the mirror's coherence
export const SOLID_HG_ALBEDO = [0.52, 0.53, 0.55]; // frozen Hg: matte crystalline silver (linear)
export const SPARKLE_CELLS = 700;             // facet cells around the equator
export const SPARKLE_DENSITY = 0.004;         // fraction of facets that can glint
export const SPARKLE_COS = 0.97;              // glint lobe: reflection within ~14° of the Sun
export const SPARKLE_GAIN = 3;
export const EMIT_RADIUS = 0.5;               // scene units — each element reflects as a soft area light
export const FRONT_EDGE = 0.12;               // transmutation front noise amplitude (in front units)
export const FRONT_SOFT = 0.03;               // front edge softness; must stay < FRONT_EDGE / 2
export const FRONT_NOISE_FREQ = 6;
export const PHASE_BLEND_K = 8;               // K either side of melt/boil for the phase blend
```

In `PLANET_TUNE`, after `nightFloor`, add:

```js
  sunGlint: 8,       // liquid mirror: Sun-disc reflection gain
  emitGain: 1.5,     // liquid mirror: element-emitter reflection gain
```

- [ ] **Step 2: Update the failing shader contract test**

Replace the file `src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js` with:

```js
// src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js
import { describe, it, expect } from 'vitest';
import { PLANET_VS, PLANET_FS, PLANET_UNIFORMS, PLANET_BUILTINS, DEM_LSB_M } from '../mercuryPlanetShader';
import { glf, v3 } from '../../../gl/glf';
import {
  R_SCENE, R_MERCURY_M, SHADOW_STEPS, SHADOW_REACH_RAD, SHADOW_SOFT_M, SHADOW_ZONE,
  SHADOW_SOFT_LSB, SHADOW_BIAS_LSB, HG_F0, ROUGH_LIQUID, ROUGH_BOIL, SOLID_HG_ALBEDO,
  SPARKLE_CELLS, SPARKLE_DENSITY, SPARKLE_COS, SPARKLE_GAIN, EMIT_RADIUS,
  FRONT_EDGE, FRONT_SOFT, FRONT_NOISE_FREQ, PHASE_BLEND_K,
} from '../planetLook';
import {
  HG_MELT_K, HG_BOIL_K, T_NIGHT_FLOOR_K, T_SUNSET_K, TAU_WARM_H, TAU_COOL_H, HOURS_PER_RAD,
} from '../mercuryThermal';
import { DEM_MIN_M, DEM_MAX_M } from '../mercuryMaps.generated';

const declared = (src) => [...src.matchAll(/^uniform\s+\w+\s+(\w+)(?:\[\d+\])?;/gm)].map((m) => m[1]);

describe('mercuryPlanetShader contract', () => {
  it('is raw GLSL 3 for three: no #version (three prepends it), no #include', () => {
    for (const s of [PLANET_VS, PLANET_FS]) {
      expect(s).not.toMatch(/#version/);
      expect(s).not.toMatch(/#include/);
    }
    expect(PLANET_VS).toMatch(/^in vec3 position;/m);
    expect(PLANET_FS).toMatch(/out vec4 fragColor;/);
  });

  it('declares exactly PLANET_UNIFORMS plus three built-ins in the fragment stage', () => {
    const fs = declared(PLANET_FS).filter((u) => !PLANET_BUILTINS.includes(u));
    expect([...fs].sort()).toEqual([...PLANET_UNIFORMS].sort());
    expect(new Set(declared(PLANET_FS)).size).toBe(declared(PLANET_FS).length);
  });

  it('interpolates every physical constant from its JS owner', () => {
    for (const [name, value] of Object.entries({
      R_SCENE, R_MERCURY_M, DEM_MIN_M, DEM_MAX_M, SHADOW_REACH_RAD, SHADOW_SOFT_M, SHADOW_ZONE,
      SHADOW_SOFT_LSB, SHADOW_BIAS_LSB, DEM_LSB_M,
      HG_MELT_K, HG_BOIL_K, T_NIGHT_FLOOR_K, T_SUNSET_K, TAU_WARM_H, TAU_COOL_H, HOURS_PER_RAD,
      ROUGH_LIQUID, ROUGH_BOIL, SPARKLE_CELLS, SPARKLE_DENSITY, SPARKLE_COS, SPARKLE_GAIN, EMIT_RADIUS,
      FRONT_EDGE, FRONT_SOFT, FRONT_NOISE_FREQ, PHASE_BLEND_K,
    })) {
      expect(PLANET_FS).toContain(`const float ${name} = ${glf(value)};`);
    }
    expect(PLANET_FS).toContain(`const vec3 HG_F0 = ${v3(HG_F0)};`);
    expect(PLANET_FS).toContain(`const vec3 SOLID_HG_ALBEDO = ${v3(SOLID_HG_ALBEDO)};`);
    expect(PLANET_FS).toContain(`const int SHADOW_STEPS = ${SHADOW_STEPS};`);
    expect(PLANET_VS).toContain(`const float R_SCENE = ${glf(R_SCENE)};`);
  });

  it('DEM_LSB_M is one 8-bit DEM step in true metres', () => {
    expect(DEM_LSB_M).toBe((DEM_MAX_M - DEM_MIN_M) / 255);
  });

  it('scales shadow softness and bias with relief', () => {
    expect(PLANET_FS).toMatch(/float soft = [^;]*\* max\(uRelief, 1e-3\);/);
    expect(PLANET_FS).toMatch(/float bias = [^;]*\* uRelief;/);
  });

  it('never lets the liquid mirror go sharper than roughness 0.14; front softness < half its edge', () => {
    expect(ROUGH_LIQUID).toBeGreaterThanOrEqual(0.14);
    expect(FRONT_SOFT).toBeLessThan(FRONT_EDGE / 2);
  });

  it('rotates by the body matrix, reflects four emitters, and mirrors the thermal model', () => {
    expect(PLANET_FS).toContain('uniform mat3 uBodyRot;');
    expect(PLANET_FS).toContain('uniform vec3 uEmitPos[4];');
    expect(PLANET_FS).toContain('uniform vec3 uEmitCol[4];');
    expect(PLANET_FS).toContain('vec3 nb = ng * uBodyRot;');
    expect(PLANET_FS).toMatch(/float surfaceTempK\(float mu0, float lonRel, float cosLat, float tss, float heatK\)/);
    expect(PLANET_FS).not.toMatch(/uBodyYaw/);
  });

  it('writes depth and never uses reserved or unsafe constructs', () => {
    expect(PLANET_FS).toContain('gl_FragDepth');
    for (const s of [PLANET_VS, PLANET_FS]) {
      expect(s).not.toMatch(/\bhalf\b/);
      expect(s).not.toMatch(/gl_FragColor/);
    }
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`
Expected: FAIL (missing uniforms/constants, `uBodyYaw` still present).

- [ ] **Step 4: Rewrite the shader module**

Update the header comment's last sentence to: "Phase 2: a body rotation matrix (mercuryBody), a transmutation front, three phases of the element by local temperature (mercuryThermal), and a liquid mirror that reflects only the Sun and the four element emitters." Replace the imports and `PLANET_UNIFORMS` with:

```js
import { glf, v3 } from '../../gl/glf';
import {
  R_SCENE, R_MERCURY_M, SHADOW_STEPS, SHADOW_REACH_RAD, SHADOW_SOFT_M, SHADOW_ZONE, SHADOW_SOFT_LSB, SHADOW_BIAS_LSB,
  FALLBACK_ALBEDO, HG_F0, ROUGH_LIQUID, ROUGH_BOIL, SOLID_HG_ALBEDO, SPARKLE_CELLS, SPARKLE_DENSITY, SPARKLE_COS,
  SPARKLE_GAIN, EMIT_RADIUS, FRONT_EDGE, FRONT_SOFT, FRONT_NOISE_FREQ, PHASE_BLEND_K,
} from './planetLook';
import {
  HG_MELT_K, HG_BOIL_K, T_NIGHT_FLOOR_K, T_SUNSET_K, TAU_WARM_H, TAU_COOL_H, HOURS_PER_RAD,
} from './mercuryThermal';
import { DEM_MIN_M, DEM_MAX_M } from './mercuryMaps.generated';
```

```js
export const PLANET_UNIFORMS = [
  'uAlbedo', 'uDem', 'uHasMaps', 'uSunDir', 'uBodyRot', 'uSunIrr', 'uSunSinR',
  'uDemTexel', 'uTime', 'uExposure', 'uRelief', 'uNightFloor',
  'uTau', 'uHeatK', 'uSubsolarT', 'uEmitPos', 'uEmitCol', 'uSunGlint', 'uEmitGain',
];
```

`DEM_LSB_M`, `PLANET_BUILTINS` and `PLANET_VS` stay unchanged. Replace `PLANET_FS` entirely with:

```js
export const PLANET_FS = /* glsl */ `precision highp float;
precision highp sampler2D;

in vec3 vWorld;
layout(location = 0) out vec4 fragColor;

uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 cameraPosition;
uniform sampler2D uAlbedo;
uniform sampler2D uDem;
uniform float uHasMaps;
uniform vec3 uSunDir;
uniform mat3 uBodyRot;
uniform float uSunIrr;
uniform float uSunSinR;
uniform vec2 uDemTexel;
uniform float uTime;
uniform float uExposure;
uniform float uRelief;
uniform float uNightFloor;
uniform float uTau;
uniform float uHeatK;
uniform float uSubsolarT;
uniform vec3 uEmitPos[4];
uniform vec3 uEmitCol[4];
uniform float uSunGlint;
uniform float uEmitGain;

const float PI = 3.14159265358979;
const float TAU = 6.28318530717959;
const float HALF_PI = 1.57079632679490;
const float R_SCENE = ${glf(R_SCENE)};
const float R_MERCURY_M = ${glf(R_MERCURY_M)};
const float DEM_MIN_M = ${glf(DEM_MIN_M)};
const float DEM_MAX_M = ${glf(DEM_MAX_M)};
const int SHADOW_STEPS = ${SHADOW_STEPS};
const float SHADOW_REACH_RAD = ${glf(SHADOW_REACH_RAD)};
const float SHADOW_SOFT_M = ${glf(SHADOW_SOFT_M)};
const float SHADOW_ZONE = ${glf(SHADOW_ZONE)};
const float DEM_LSB_M = ${glf(DEM_LSB_M)};
const float SHADOW_SOFT_LSB = ${glf(SHADOW_SOFT_LSB)};
const float SHADOW_BIAS_LSB = ${glf(SHADOW_BIAS_LSB)};
const vec3 FALLBACK_ALBEDO = ${v3(FALLBACK_ALBEDO)};

const float HG_MELT_K = ${glf(HG_MELT_K)};
const float HG_BOIL_K = ${glf(HG_BOIL_K)};
const float T_NIGHT_FLOOR_K = ${glf(T_NIGHT_FLOOR_K)};
const float T_SUNSET_K = ${glf(T_SUNSET_K)};
const float TAU_WARM_H = ${glf(TAU_WARM_H)};
const float TAU_COOL_H = ${glf(TAU_COOL_H)};
const float HOURS_PER_RAD = ${glf(HOURS_PER_RAD)};
const vec3 HG_F0 = ${v3(HG_F0)};
const float ROUGH_LIQUID = ${glf(ROUGH_LIQUID)};
const float ROUGH_BOIL = ${glf(ROUGH_BOIL)};
const vec3 SOLID_HG_ALBEDO = ${v3(SOLID_HG_ALBEDO)};
const float SPARKLE_CELLS = ${glf(SPARKLE_CELLS)};
const float SPARKLE_DENSITY = ${glf(SPARKLE_DENSITY)};
const float SPARKLE_COS = ${glf(SPARKLE_COS)};
const float SPARKLE_GAIN = ${glf(SPARKLE_GAIN)};
const float EMIT_RADIUS = ${glf(EMIT_RADIUS)};
const float FRONT_EDGE = ${glf(FRONT_EDGE)};
const float FRONT_SOFT = ${glf(FRONT_SOFT)};
const float FRONT_NOISE_FREQ = ${glf(FRONT_NOISE_FREQ)};
const float PHASE_BLEND_K = ${glf(PHASE_BLEND_K)};

float heightAt(vec2 uv, vec2 gx, vec2 gy) {
  return mix(DEM_MIN_M, DEM_MAX_M, textureGrad(uDem, vec2(fract(uv.x), uv.y), gx, gy).r);
}

// March toward the Sun over the (exaggerated) heightfield. Terrain height is
// measured against the tangent plane, so the sphere's curvature drops away
// as (xR)^2 / 2R; the sunlight ray rises as xR * tan(elevation). Softness and
// march bias scale with relief and floor at DEM quantisation steps, so the
// dither and 8-bit stepping never swamp the penumbra at high exaggeration.
float castShadow(vec2 uv, vec3 nb, vec3 Lb, float h0, float cosLat, vec3 east, vec3 north, vec2 gx, vec2 gy) {
  vec3 tdir = Lb - nb * dot(Lb, nb);
  float tl = length(tdir);
  if (tl < 1e-4) return 1.0;
  tdir /= tl;
  float tanE = dot(Lb, nb) / tl;
  vec2 duv = vec2(dot(tdir, east) / (TAU * cosLat), dot(tdir, north) / PI);
  float vis = 1.0;
  float soft = max(SHADOW_SOFT_M, SHADOW_SOFT_LSB * DEM_LSB_M) * max(uRelief, 1e-3);
  float bias = SHADOW_BIAS_LSB * DEM_LSB_M * uRelief;
  for (int k = 1; k <= SHADOW_STEPS; k++) {
    float f = float(k) / float(SHADOW_STEPS);
    float x = SHADOW_REACH_RAD * f * f;
    float hk = heightAt(uv + duv * x, gx, gy);
    float xm = x * R_MERCURY_M;
    float terrain = hk * uRelief - xm * xm / (2.0 * R_MERCURY_M);
    float ray = h0 * uRelief + xm * tanE + bias;
    vis = min(vis, smoothstep(-soft, soft, ray - terrain));
  }
  return vis;
}

// mercuryThermal.surfaceTempK, exactly.
float surfaceTempK(float mu0, float lonRel, float cosLat, float tss, float heatK) {
  float tset = T_SUNSET_K * pow(max(cosLat, 0.0), 0.25);
  float teq = tss * pow(max(mu0, 0.0), 0.25);
  float t;
  if (lonRel >= -HALF_PI && lonRel <= HALF_PI) {
    if (lonRel < 0.0) {
      float h = (lonRel + HALF_PI) * HOURS_PER_RAD;
      t = T_NIGHT_FLOOR_K + (max(teq, T_NIGHT_FLOOR_K) - T_NIGHT_FLOOR_K) * (1.0 - exp(-h / TAU_WARM_H));
    } else {
      t = max(teq, tset);
    }
  } else {
    float h = (lonRel > 0.0 ? lonRel - HALF_PI : lonRel + 3.0 * HALF_PI) * HOURS_PER_RAD;
    t = T_NIGHT_FLOOR_K + (tset - T_NIGHT_FLOOR_K) * exp(-h / TAU_COOL_H);
  }
  return t + heatK;
}

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

// A disc of angular radius asin(sinR) seen in a mirror of roughness rough:
// a Gaussian in angle whose width adds the disc and the GGX alpha, scaled so
// the integrated energy stays that of the disc.
float lobe(float cosA, float sinR, float rough) {
  float a = acos(clamp(cosA, -1.0, 1.0));
  float alpha = rough * rough;
  float w2 = sinR * sinR + alpha * alpha;
  return (sinR * sinR / w2) * exp(-a * a / w2);
}

// Only what exists in the frame: the Sun, the four elements, black space.
vec3 envRadiance(vec3 R, float rough, vec3 P) {
  vec3 c = vec3(uSunGlint * uSunIrr * uExposure * lobe(dot(R, uSunDir), uSunSinR, rough));
  for (int i = 0; i < 4; i++) {
    vec3 d = uEmitPos[i] - P;
    float dist = max(length(d), 1e-3);
    float sinE = min(EMIT_RADIUS / dist, 0.99);
    c += uEmitCol[i] * (uEmitGain * lobe(dot(R, d / dist), sinE, rough));
  }
  return c;
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorld - ro);
  float b = dot(ro, rd);
  float disc = b * b - (dot(ro, ro) - R_SCENE * R_SCENE);
  float fw = max(fwidth(disc), 1e-6);
  float coverage = clamp(disc / fw + 0.5, 0.0, 1.0);

  // Shade the nearest point even for near-misses so derivatives stay defined
  // across the silhouette; discard only after all dFdx/dFdy calls.
  float t = -b - sqrt(max(disc, 0.0));
  vec3 hit = ro + rd * t;
  vec3 ng = normalize(hit);

  // uBodyRot is body → world (mercuryBody.q); v * M = transpose(M) * v.
  vec3 nb = ng * uBodyRot;
  vec3 Lb = uSunDir * uBodyRot;
  vec3 Vb = -rd * uBodyRot;
  float lat = asin(clamp(nb.y, -1.0, 1.0));
  float lon = atan(-nb.z, nb.x);
  vec2 uv = vec2(fract(lon / TAU), 0.5 + lat / PI);

  // Seam-safe gradients: take whichever of u / u+0.5 is continuous here.
  vec2 gx = dFdx(uv), gy = dFdy(uv);
  vec2 uvS = vec2(fract(uv.x + 0.5), uv.y);
  vec2 gxS = dFdx(uvS), gyS = dFdy(uvS);
  if (abs(gxS.x) + abs(gyS.x) < abs(gx.x) + abs(gy.x)) { gx.x = gxS.x; gy.x = gyS.x; }

  if (disc < -fw) discard;

  vec4 clip = projectionMatrix * viewMatrix * vec4(hit, 1.0);
  gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);

  float cosLat = max(cos(lat), 0.02);
  vec3 east = vec3(-sin(lon), 0.0, -cos(lon));
  vec3 north = vec3(-sin(lat) * cos(lon), cos(lat), sin(lat) * sin(lon));

  vec3 albedo = FALLBACK_ALBEDO;
  vec3 n = nb;
  float h0 = 0.0;
  if (uHasMaps > 0.5) {
    albedo = textureGrad(uAlbedo, uv, gx, gy).rgb;
    h0 = heightAt(uv, gx, gy);
    float hE = heightAt(uv + vec2(uDemTexel.x, 0.0), gx, gy) - heightAt(uv - vec2(uDemTexel.x, 0.0), gx, gy);
    float hN = heightAt(uv + vec2(0.0, uDemTexel.y), gx, gy) - heightAt(uv - vec2(0.0, uDemTexel.y), gx, gy);
    float distE = 2.0 * uDemTexel.x * TAU * R_MERCURY_M * cosLat;
    float distN = 2.0 * uDemTexel.y * PI * R_MERCURY_M;
    n = normalize(nb - east * (hE * uRelief / distE) - north * (hN * uRelief / distN));
  }

  // No atmosphere: the terminator is as soft as the Sun's disc is wide.
  float mu0g = dot(nb, Lb);
  float term = smoothstep(-uSunSinR, uSunSinR, mu0g);
  float mu0 = max(dot(n, Lb), 0.0);
  float mu = max(dot(n, Vb), 1e-3);
  float ls = 2.0 * mu0 / (mu0 + mu + 1e-4); // Lommel–Seeliger, 1 at normal incidence

  float vis = 1.0;
  if (uHasMaps > 0.5 && mu0g > -uSunSinR && mu0g < SHADOW_ZONE) {
    vis = castShadow(uv, nb, Lb, h0, cosLat, east, north, gx, gy);
    vis = mix(vis, 1.0, smoothstep(0.7 * SHADOW_ZONE, SHADOW_ZONE, mu0g));
  }

  vec3 colLin = albedo * (uSunIrr * uExposure * ls * term * vis + uNightFloor);

  // Transmutation: the front advances from the subsolar point outward
  // (noise-edged) and retreats the same way on refreeze. Inside it the crust
  // relief flattens into fluid and the element takes its phase from the
  // local temperature: solid at night, a liquid mirror by day and into dusk,
  // boiling near noon.
  if (uTau > 0.0) {
    float front = 1.0 - acos(clamp(mu0g, -1.0, 1.0)) / PI;
    float edgeN = (vnoise3(nb * FRONT_NOISE_FREQ) - 0.5) * FRONT_EDGE;
    float thr = 1.0 + FRONT_EDGE - uTau * (1.0 + 2.0 * FRONT_EDGE);
    float fluid = smoothstep(thr - FRONT_SOFT, thr + FRONT_SOFT, front + edgeN);

    float lonSun = atan(-Lb.z, Lb.x);
    float lonRel = mod(lon - lonSun + PI, TAU) - PI;
    float T = surfaceTempK(mu0g, lonRel, cos(lat), uSubsolarT, uHeatK);
    float liquidW = smoothstep(HG_MELT_K - PHASE_BLEND_K, HG_MELT_K + PHASE_BLEND_K, T);
    float boilW = smoothstep(HG_BOIL_K - PHASE_BLEND_K, HG_BOIL_K + PHASE_BLEND_K, T);

    vec3 nW = uBodyRot * normalize(mix(n, nb, fluid));
    vec3 R = reflect(rd, nW);
    float NoV = clamp(dot(nW, -rd), 0.0, 1.0);
    vec3 F = HG_F0 + (1.0 - HG_F0) * pow(1.0 - NoV, 5.0);
    vec3 liquid = F * envRadiance(R, mix(ROUGH_LIQUID, ROUGH_BOIL, boilW), hit);

    float sunI = uSunIrr * uExposure;
    float facet = hash13(vec3(floor(uv * vec2(2.0 * SPARKLE_CELLS, SPARKLE_CELLS)), 7.0));
    float glint = step(1.0 - SPARKLE_DENSITY, facet) * smoothstep(SPARKLE_COS, 1.0, dot(R, uSunDir));
    vec3 solid = SOLID_HG_ALBEDO * (sunI * max(dot(nW, uSunDir), 0.0) * term + uNightFloor)
      + vec3(glint * SPARKLE_GAIN * sunI);

    colLin = mix(colLin, mix(solid, liquid, liquidW), fluid);
  }

  vec3 col = max(colLin, 0.0);
  vec3 srgb = mix(col * 12.92, 1.055 * pow(col, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), col));
  float dith = (fract(sin(dot(gl_FragCoord.xy + fract(uTime) * 61.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  fragColor = vec4(srgb + dith, coverage);
}
`;
```

Safety notes (check, don't change):
- Every `pow()` base is ≥ 0: `max(cosLat,0)`, `max(mu0,0)`, `1 − NoV` with NoV clamped to [0,1], and `col` clamped by `max`.
- `uTau` is a uniform, so the branch is uniform control flow. The branch contains no derivative calls.
- At τ = 0 the threshold is 1 + E and `front + edgeN` ≤ 1 + E/2 < thr − FRONT_SOFT, so there is no fluid. At τ = 1, thr = −E, so the whole globe is fluid.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/terminal/mercury/planet src/terminal/views/manifesto`
Expected: PASS.

Note: `MercuryPlanet.jsx` still sets `uBodyYaw` and lacks the new uniforms until Task 6. That is harmless for unit tests. Do not start the dev server in this task.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/mercury/planet/planetLook.js src/terminal/mercury/planet/mercuryPlanetShader.js src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js
git commit -m "feat(mercury): shader — body rotation, transmutation front, three phases of the element, analytic reflections

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Wire the body; remove OrbitControls, MercuryEnvironment, lights

**Files:**
- Modify: `src/terminal/mercury/MercuryPlanet.jsx`
- Modify: `src/terminal/mercury/MercuryCanvas.jsx`
- Modify: `src/terminal/mercury/mercuryTuning.js`
- Modify: `src/terminal/mercury/planet/planetFrame.js`, `src/terminal/mercury/planet/__tests__/planetFrame.test.js`
- Modify: `src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js`
- Delete: `src/terminal/mercury/MercuryEnvironment.jsx`, `src/terminal/mercury/__tests__/mercuryEnvironment.test.js`

**Interfaces:**
- Consumes:
  - Task 1: `subsolarTempK`.
  - Task 2: `createBody`, `stepBody`, `targetFromYaw`.
  - Task 3: `ORBIT_NODES`, `orbitPrecessionAngle`, `nodeWorldPosition`.
  - Task 4: `useMercuryDrag`.
  - Task 5: the uniform list and `PLANET_TUNE.sunGlint` / `emitGain`.
- Produces:
  - `<MercuryPlanet isMobile emitters={{ fluid, thermal, earth, air }} />`, where the emitters are the live aether opacities (0..1).
  - `planetEphemerisUniforms(nowMs) → { yaw, irr, sinR, subsolarLonDeg, subsolarT }`.

- [ ] **Step 1: Update the uniforms test (failing)**

Replace `src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js` with:

```js
import { describe, it, expect } from 'vitest';
import { planetEphemerisUniforms } from '../MercuryPlanet';
import { mercuryEphemeris } from '../planet/mercuryEphemeris';
import { bodyYawFor } from '../planet/planetFrame';
import { subsolarTempK } from '../planet/mercuryThermal';

describe('planetEphemerisUniforms', () => {
  const t = Date.UTC(2026, 9, 1);
  it('feeds yaw from the live subsolar longitude (Sun fixed in the world)', () => {
    const eph = mercuryEphemeris(t);
    const u = planetEphemerisUniforms(t);
    expect(u.yaw).toBeCloseTo(bodyYawFor(eph.subsolarLonDeg), 12);
    expect(u.subsolarLonDeg).toBe(eph.subsolarLonDeg);
  });
  it('irradiance is (MEAN_R/r)^2 and stays inside the orbital range 0.69–1.59', () => {
    const u = planetEphemerisUniforms(t);
    expect(u.irr).toBeCloseTo((0.387098 / mercuryEphemeris(t).r) ** 2, 12);
    expect(u.irr).toBeGreaterThan(0.68);
    expect(u.irr).toBeLessThan(1.6);
  });
  it('sinR is the sine of the Sun angular radius', () => {
    expect(planetEphemerisUniforms(t).sinR).toBeCloseTo(Math.sin(mercuryEphemeris(t).sunAngularRadiusRad), 12);
  });
  it('subsolarT comes from the thermal model at the live distance', () => {
    expect(planetEphemerisUniforms(t).subsolarT).toBe(subsolarTempK(mercuryEphemeris(t).r));
  });
});
```

In `planetFrame.test.js` delete every test (and import) that references `sunDirForCamera`.

Run: `npx vitest run src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js`
Expected: FAIL (`subsolarT` undefined).

- [ ] **Step 2: Drop `sunDirForCamera` from `planetFrame.js`**

Delete the `sunDirForCamera` function and its comment. Restore the header's "CHOSEN" sentence to: "What is CHOSEN (spec §4): the Sun sits at a fixed phase angle to the camera so a gibbous planet is always on screen (the camera no longer moves)."

- [ ] **Step 3: Rewrite `MercuryPlanet.jsx`**

```jsx
// MercuryPlanet.jsx — the planet under the real Sun, and the body you can spin
// (spec 2026-09-30, phases 1–2).
// Owns: impostor mesh, raw material, map loading, the body (drag → torque →
// inertia → recapture, heat, transmutation), per-frame uniform writes.
// All maths lives in ./planet/* and ./orbitNodes (tested); this file only wires it to GL.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { PLANET_VS, PLANET_FS } from './planet/mercuryPlanetShader';
import { mercuryEphemeris } from './planet/mercuryEphemeris';
import { SUN_DIR_WORLD, bodyYawFor } from './planet/planetFrame';
import { PLANET_TUNE, MEAN_R_AU } from './planet/planetLook';
import { MAPS } from './planet/mercuryMaps.generated';
import { subsolarTempK } from './planet/mercuryThermal';
import { createBody, stepBody, targetFromYaw } from './planet/mercuryBody';
import { ORBIT_NODES, orbitPrecessionAngle, nodeWorldPosition } from './orbitNodes';
import useMercuryDrag from './useMercuryDrag';
import { registerTuningRig } from './mercuryTuning';

const EPHEMERIS_REFRESH_S = 1;
const MAX_FRAME_DT_S = 0.1; // a backgrounded tab must not fling the body
const EMIT_COLORS = ORBIT_NODES.map((n) => new THREE.Color(n.color)); // linear

export function planetEphemerisUniforms(nowMs) {
  const eph = mercuryEphemeris(nowMs);
  return {
    yaw: bodyYawFor(eph.subsolarLonDeg),
    irr: (MEAN_R_AU / eph.r) ** 2,
    sinR: Math.sin(eph.sunAngularRadiusRad),
    subsolarLonDeg: eph.subsolarLonDeg,
    subsolarT: subsolarTempK(eph.r),
  };
}

function loadMap(loader, url, srgb) {
  return new Promise((resolve, reject) => {
    loader.load(url, (tex) => {
      tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = 4;
      tex.needsUpdate = true;
      resolve(tex);
    }, undefined, reject);
  });
}

export default function MercuryPlanet({ isMobile = false, emitters = {} }) {
  const gl = useThree((s) => s.gl);
  const drag = useMercuryDrag(gl.domElement);
  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), []);

  const init = useMemo(() => planetEphemerisUniforms(Date.now()), []);
  const target = useMemo(() => targetFromYaw(init.yaw), [init]);
  const body = useMemo(() => createBody(target), [target]);
  const m4 = useMemo(() => new THREE.Matrix4(), []);

  const material = useMemo(() => new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: PLANET_VS,
    fragmentShader: PLANET_FS,
    alphaToCoverage: !isMobile,
    uniforms: {
      uAlbedo: { value: null },
      uDem: { value: null },
      uHasMaps: { value: 0 },
      uSunDir: { value: new THREE.Vector3(...SUN_DIR_WORLD) },
      uBodyRot: { value: new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(body.q)) },
      uSunIrr: { value: init.irr },
      uSunSinR: { value: init.sinR },
      uDemTexel: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uExposure: { value: PLANET_TUNE.exposure },
      uRelief: { value: PLANET_TUNE.relief },
      uNightFloor: { value: PLANET_TUNE.nightFloor },
      uTau: { value: 0 },
      uHeatK: { value: 0 },
      uSubsolarT: { value: init.subsolarT },
      uEmitPos: { value: ORBIT_NODES.map(() => new THREE.Vector3()) },
      uEmitCol: { value: ORBIT_NODES.map(() => new THREE.Vector3()) },
      uSunGlint: { value: PLANET_TUNE.sunGlint },
      uEmitGain: { value: PLANET_TUNE.emitGain },
    },
  }), [isMobile, init, body]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  // Dev-only console tuning rig (window.__mercuryTune). Zero prod footprint.
  useEffect(() => {
    if (import.meta.env.DEV) registerTuningRig();
  }, []);

  const emitRef = useRef(emitters);
  useEffect(() => { emitRef.current = emitters; }, [emitters]);

  useEffect(() => {
    const set = isMobile ? MAPS.mobile : MAPS.desktop;
    const loader = new THREE.TextureLoader();
    let disposed = false;
    let textures = [];
    Promise.all([loadMap(loader, set.albedo, true), loadMap(loader, set.dem, false)])
      .then(([albedo, dem]) => {
        textures = [albedo, dem];
        if (disposed) { textures.forEach((t) => t.dispose()); return; }
        const u = material.uniforms;
        u.uAlbedo.value = albedo;
        u.uDem.value = dem;
        u.uDemTexel.value.set(1 / set.demSize[0], 1 / set.demSize[1]);
        u.uHasMaps.value = 1;
      })
      .catch((err) => console.error('[mercury] planet maps failed; flat fallback stays', err));
    return () => { disposed = true; textures.forEach((t) => t.dispose()); };
  }, [material, isMobile]);

  const nextEphemeris = useRef(0);
  useFrame(({ clock }, delta) => {
    const u = material.uniforms;
    const t = clock.elapsedTime;
    u.uTime.value = t;
    u.uExposure.value = PLANET_TUNE.exposure;
    u.uRelief.value = PLANET_TUNE.relief;
    u.uNightFloor.value = PLANET_TUNE.nightFloor;
    u.uSunGlint.value = PLANET_TUNE.sunGlint;
    u.uEmitGain.value = PLANET_TUNE.emitGain;
    if (t >= nextEphemeris.current) {
      nextEphemeris.current = t + EPHEMERIS_REFRESH_S;
      const e = planetEphemerisUniforms(Date.now());
      targetFromYaw(e.yaw, target);
      u.uSunIrr.value = e.irr;
      u.uSunSinR.value = e.sinR;
      u.uSubsolarT.value = e.subsolarT;
    }

    const { dragging, omegaPtr } = drag.sample(performance.now());
    stepBody(body, Math.min(delta, MAX_FRAME_DT_S), { dragging, omegaPtr, target });
    u.uBodyRot.value.setFromMatrix4(m4.makeRotationFromQuaternion(body.q));
    u.uTau.value = body.tau;
    u.uHeatK.value = body.heatK;

    const precession = orbitPrecessionAngle(t);
    ORBIT_NODES.forEach((node, i) => {
      const [x, y, z] = nodeWorldPosition(node.angle, precession);
      u.uEmitPos.value[i].set(x, y, z);
      const o = emitRef.current[node.phase] ?? 0;
      const c = EMIT_COLORS[i];
      u.uEmitCol.value[i].set(c.r * o, c.g * o, c.b * o);
    });
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}
```

- [ ] **Step 4: Rewire `MercuryCanvas.jsx`**

- Imports:
  - Remove `OrbitControls` (the `@react-three/drei` import line goes entirely if nothing else uses it) and `MercuryEnvironment`.
  - Change `import { CAMERA_DIST, ORBIT_LIMITS } from './planet/planetLook';` to `import { CAMERA_DIST } from './planet/planetLook';`.
  - Change `import { Suspense, useRef, useCallback } from 'react';` to `import { Suspense, useCallback } from 'react';`.
- Delete `controlsRef`, `idleTimer`, `handleInteractionStart` and `handleInteractionEnd`.
- Delete the `<ambientLight>`, both `<pointLight>` elements and the whole `<MercuryEnvironment … />` element.
- Delete the whole `<OrbitControls … />` element.
- Replace `<MercuryPlanet isMobile={isMobile} />` with:

```jsx
        <MercuryPlanet
          isMobile={isMobile}
          emitters={{
            fluid: opacityFor('fluid'),
            thermal: opacityFor('thermal'),
            earth: opacityFor('earth'),
            air: opacityFor('air'),
          }}
        />
```

Leave everything else untouched: the flows, `planetWindow={1}`, MercurySphere and `onCreated`.

- [ ] **Step 5: Retire the env-only tuning knobs in `mercuryTuning.js`**

- Remove these keys and their comments from `TUNE`: `chromaGain`, `floorGain`, `stratumGain`, `blobGain`, `moonGain`, `breatheSpeed`, `breatheAmp`, `horizonLift`. Keep `duckActive`, `duckGhost`, `condenseBite` and `condenseSizeBite`.
- In the header usage comment:
  - Replace the `__mercuryTune.set('chromaGain', 0.8)` example line with `//   __mercuryTune.set('duckActive', 0.08)     // cloud parting depth`, and delete the now-duplicate `duckActive` line.
  - Add `//   __mercuryTune.planet.relief = 8               // planet look, live`.
- Change the header's first paragraph to say TUNE holds the aether's tunable constants.
- Change `// Called from MercuryEnvironment (dev only).` to `// Called from MercuryPlanet (dev only).`

- [ ] **Step 6: Delete the environment**

```bash
git rm src/terminal/mercury/MercuryEnvironment.jsx src/terminal/mercury/__tests__/mercuryEnvironment.test.js
```

Then run `grep -rn "MercuryEnvironment\|sunDirForCamera\|ORBIT_LIMITS\|chromaGain" src`. Expected: no hits.

- [ ] **Step 7: Full suite, lint, build**

Run: `npm test`
Expected: all pass except the pre-existing `artComposite.test.js` "caps a coarse pointer at 1".

Run: `npm run lint`
Expected: 0 errors, ≤ 137 warnings.

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/terminal/mercury/MercuryPlanet.jsx src/terminal/mercury/MercuryCanvas.jsx src/terminal/mercury/mercuryTuning.js src/terminal/mercury/planet/planetFrame.js src/terminal/mercury/planet/__tests__/planetFrame.test.js src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js
git commit -m "feat(mercury): the body is live — drag spins it, recapture returns it, spin transmutes it; OrbitControls and the env cubemap go

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Look at it (controller; hard rule: screenshot before any theory)

**Files:** none unless defects are found.

- [ ] **Step 1:** `preview_start` `scale94-dev-5175` (5174 may be held by another chat). Set `resize_window` to 1600×1000 and navigate to `/mercury`. Wait for the boot intro, then dispatch `g`,`m` KeyboardEvents until 4 canvases exist. **Full reload after every code change**: a failed Vite HMR keeps the old module live. If canvas 3 is 133×80, re-apply `resize_window` and dispatch `resize`.
- [ ] **Step 2:** `read_console_messages` with `onlyErrors`: expect no WebGLProgram errors.
- [ ] **Step 3:** Probe frames with `canvas.toDataURL()` inside a SINGLE `requestAnimationFrame` (a double rAF grabs a cleared buffer), drawn into a fixed overlay crop (the pane has no zoom). Check:
  - (a) At rest the planet looks exactly as phase 1, and the camera no longer auto-orbits.
  - (b) A synthetic drag spins the body. Dispatch `pointerdown`/`pointermove`/`pointerup` on canvas 3 with `clientX/clientY`, moving ~40 px every 16 ms for 8 s.
  - (c) τ rises and the day side becomes a mirror with a Sun glint and coloured element rims. The night side is matte silver, dawn is frozen, and dusk is liquid.
  - (d) After release the planet returns to its ephemeris face within ~10 s, and the liquid lingers ≥ 25 s, then refreezes from the night side.
  - (e) Tapping an element node still switches the aether and does not start a drag.
- [ ] **Step 4:** If the pane cannot show motion, say so and ask the author to check in their browser and on their phone. Tuning knobs: `__mercuryTune.planet.sunGlint`, `.emitGain`.
- [ ] **Step 5:** Report with screenshots. Do not push.

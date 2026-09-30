# /MERCURY Phase 1 — The Planet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the grey `meshPhysicalMaterial` ball in /MERCURY with a raw-GLSL planet: MESSENGER enhanced-colour albedo, USGS DEM relief with cast crater shadows, lit by the real Sun from a live UTC ephemeris, with the camera closer and a clear window through the aether.

**Architecture:** A camera-facing impostor quad with a `RawShaderMaterial` (GLSL 300 es) ray-intersects the sphere, writes `gl_FragDepth`, and shades from two equirect textures. Pure JS modules own every physical constant (ephemeris, frame maths, look) and are unit-tested; the shader interpolates them with `glf()` exactly like /ACCRETION. A one-off Node script turns the USGS GeoTIFFs into web textures plus a generated constants module.

**Tech Stack:** React 19, @react-three/fiber 9, three 0.183, Vitest 4 (jsdom), Node ≥18 scripts; new devDependencies `geotiff`, `sharp` (script only, never bundled).

**Spec:** `docs/superpowers/specs/2026-09-30-mercury-gem-polish-design.md` (§5, §6, §7 phase 1).

## Global Constraints

- Raw GLSL only: `RawShaderMaterial` with `glslVersion: THREE.GLSL3`. No `onBeforeCompile`, no `#include`, no three shader chunks. Shader strings must NOT contain `#version` (three prepends it for GLSL3).
- Every physical constant lives in a tested JS module and reaches the shader via `glf()`; look constants the author tunes are uniforms fed from `PLANET_TUNE` (never baked).
- Per-frame values are written to uniforms inside `useFrame`, never through React state.
- Time-based, never frame-counted.
- Never `pow()` a possibly-negative base (GLSL UB → NaN on mobile). Never name a variable `half` (reserved in GLSL ES).
- No red incandescence, no bloom. Night side is near-black.
- Texture budget: desktop ≤ 4.5 MB total, mobile ≤ 1.5 MB total.
- Credit line visible in the tab: `MESSENGER MDIS · USGS ASTROGEOLOGY`.
- Confidential author context is never written into code, comments, commits or copy.
- Lint gate: `npm run lint` must not exceed its current warning count.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push.

## Out of scope for phase 1 (later phases)
Drag-torque/OrbitControls removal, heat/transmutation, reflections, waves, impacts, sodium tail, `MercuryEnvironment` removal. **Known interim regression:** the element-tap chrome flash had the sphere as its target; with the sphere gone the tap still switches the aether, ring and nodes, but the planet does not react until phase 3 (impacts). OrbitControls stays, so orbiting the camera changes the phase angle until phase 2.

## File Structure

| File | Responsibility |
|---|---|
| Create `src/terminal/gl/glf.js` | GLSL float-literal formatter shared by all raw shaders |
| Modify `src/terminal/views/manifesto/councilFieldShader.js` | import/re-export `glf` from `gl/glf.js` (no behaviour change) |
| Create `src/terminal/mercury/planet/mercuryEphemeris.js` | Keplerian orbit + IAU rotation → r, ṙ, subsolar lon/lat, Sun angular radius |
| Create `src/terminal/mercury/planet/planetFrame.js` | World↔body frame maths, fixed phase-angle Sun direction, lon/lat↔uv |
| Create `src/terminal/mercury/planet/planetLook.js` | Scene radius, Mercury radius, shadow constants, camera distances, `PLANET_TUNE` |
| Create `scripts/mercury-maps/lib.mjs` | Pure raster helpers (box downsample, longitude roll, dithered 8-bit quantise) |
| Create `scripts/mercury-maps/build.mjs` | Download USGS GeoTIFFs, resample, encode WebP, write generated module |
| Create `src/terminal/mercury/planet/mercuryMaps.generated.js` | GENERATED: DEM range, map URLs and sizes |
| Create `public/mercury/*.webp` | GENERATED textures |
| Create `src/terminal/mercury/planet/mercuryPlanetShader.js` | `PLANET_VS`, `PLANET_FS`, `PLANET_UNIFORMS` |
| Create `src/terminal/mercury/planet/planetWindow.js` | `PLANET_WINDOW_GLSL` snippet for the aether flows |
| Create `src/terminal/mercury/MercuryPlanet.jsx` | Impostor mesh, textures, uniforms in `useFrame` |
| Modify `src/terminal/mercury/MercurySphere.jsx` | Remove sphere mesh, lights, squash; keep ring, thread, nodes |
| Modify `src/terminal/mercury/MercuryCanvas.jsx` | Mount planet, camera distances, window on flows |
| Modify `src/terminal/mercury/mercuryTuning.js` | Expose `PLANET_TUNE` in the dev rig + export block |
| Modify 4 flows: `fluid/ParticleFlow.jsx`, `thermal/ThermalFlow.jsx`, `earth/SedimentFlow.jsx`, `air/AtmosphericFlow.jsx` | Opt-in `planetWindow` prop |
| Modify `src/terminal/views/MercuryTab.jsx` | Credit line |
| Tests in `src/terminal/mercury/planet/__tests__/`, `src/terminal/gl/__tests__/`, `tests/` | as listed per task |

---

### Task 1: Mercury ephemeris

**Files:**
- Create: `src/terminal/mercury/planet/mercuryEphemeris.js`
- Test: `src/terminal/mercury/planet/__tests__/mercuryEphemeris.test.js`

**Interfaces:**
- Produces: `mercuryEphemeris(tMs: number) → { r: number /*AU*/, rdotKmS: number, subsolarLonDeg: number /*0..360 east*/, subsolarLatDeg: number, sunAngularRadiusRad: number, trueAnomalyRad: number }`; `mercuryRotation(dDays: number, T: number) → { alpha0Deg, delta0Deg, WDeg }`; constants `AU_KM`, `SUN_RADIUS_KM`.

Reference values are from JPL Horizons (observer 500@399, quantities 15,19; Horizons longitudes are WEST-positive for Mercury, converted here as `east = 360 − west`):

| UTC | SunSub-LON (W) | → east | r (AU) | ṙ (km/s) |
|---|---|---|---|---|
| 2000-01-01 12:00 | 265.543855 | 94.456145 | 0.466468841931 | 0.6185367 |
| 2025-01-01 00:00 | 210.821504 | 149.178496 | 0.420276859525 | 8.2420807 |
| 2026-10-01 00:00 | 102.139377 | 257.860623 | 0.464866555993 | −1.7490483 |
| 2026-12-26 00:00 | 275.496645 | 84.503355 | 0.466316966154 | −0.7998683 |

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/mercury/planet/__tests__/mercuryEphemeris.test.js
import { describe, it, expect } from 'vitest';
import { mercuryEphemeris } from '../mercuryEphemeris';

// JPL Horizons, observer 500@399, QUANTITIES 15,19. East = 360 − Horizons west.
const HORIZONS = [
  { utc: Date.UTC(2000, 0, 1, 12), lonE: 94.456145,  r: 0.466468841931, rdot:  0.6185367 },
  { utc: Date.UTC(2025, 0, 1, 0),  lonE: 149.178496, r: 0.420276859525, rdot:  8.2420807 },
  { utc: Date.UTC(2026, 9, 1, 0),  lonE: 257.860623, r: 0.464866555993, rdot: -1.7490483 },
  { utc: Date.UTC(2026, 11, 26, 0), lonE: 84.503355, r: 0.466316966154, rdot: -0.7998683 },
];

const angDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

describe('mercuryEphemeris vs JPL Horizons', () => {
  for (const ref of HORIZONS) {
    const iso = new Date(ref.utc).toISOString();
    it(`matches heliocentric range at ${iso}`, () => {
      expect(Math.abs(mercuryEphemeris(ref.utc).r - ref.r)).toBeLessThan(2e-4);
    });
    it(`matches range-rate at ${iso}`, () => {
      expect(Math.abs(mercuryEphemeris(ref.utc).rdotKmS - ref.rdot)).toBeLessThan(0.05);
    });
    it(`matches sub-solar east longitude at ${iso}`, () => {
      expect(angDiff(mercuryEphemeris(ref.utc).subsolarLonDeg, ref.lonE)).toBeLessThan(0.3);
    });
    it(`keeps the Sun on the equator at ${iso} (obliquity ~0)`, () => {
      expect(Math.abs(mercuryEphemeris(ref.utc).subsolarLatDeg)).toBeLessThan(0.1);
    });
  }

  it('spans perihelion 0.3075 AU to aphelion 0.4667 AU over one orbit', () => {
    let lo = Infinity, hi = -Infinity;
    const t0 = Date.UTC(2026, 0, 1);
    for (let h = 0; h < 88 * 24; h += 1) {
      const { r } = mercuryEphemeris(t0 + h * 3600e3);
      lo = Math.min(lo, r); hi = Math.max(hi, r);
    }
    expect(lo).toBeCloseTo(0.3075, 3);
    expect(hi).toBeCloseTo(0.4667, 3);
  });

  it('puts the subsolar point on a hot pole (0° or 180°) at perihelion — the 3:2 lock', () => {
    let best = { r: Infinity, t: 0 };
    const t0 = Date.UTC(2026, 0, 1);
    for (let m = 0; m < 88 * 24 * 60; m += 10) {
      const t = t0 + m * 60e3;
      const { r } = mercuryEphemeris(t);
      if (r < best.r) best = { r, t };
    }
    const lon = mercuryEphemeris(best.t).subsolarLonDeg;
    expect(Math.min(angDiff(lon, 0), angDiff(lon, 180))).toBeLessThan(1.0);
  });

  it('gives the Sun an angular radius of ~0.87° at perihelion and ~0.57° at aphelion', () => {
    const deg = (x) => (x * 180) / Math.PI;
    let lo = Infinity, hi = -Infinity;
    const t0 = Date.UTC(2026, 0, 1);
    for (let h = 0; h < 88 * 24; h += 6) {
      const a = deg(mercuryEphemeris(t0 + h * 3600e3).sunAngularRadiusRad);
      lo = Math.min(lo, a); hi = Math.max(hi, a);
    }
    expect(hi).toBeCloseTo(0.866, 1);
    expect(lo).toBeCloseTo(0.571, 1);
  });
});
```

Sun radius 695 700 km at 0.3075 AU → 0.866°, at 0.4667 AU → 0.571°.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryEphemeris.test.js`
Expected: FAIL — cannot resolve `../mercuryEphemeris`.

- [ ] **Step 3: Write the implementation**

```js
// src/terminal/mercury/planet/mercuryEphemeris.js — where the Sun is, for Mercury, now.
//
// PRECISION BOUNDARY, stated so no reader assumes more (spec §4, §5):
// orbit = JPL "Keplerian Elements for Approximate Positions of the Major
// Planets" (Standish), Table 1 (1800–2050), two-body, no perturbations.
// Rotation = IAU/WGCCRE 2015 Mercury model incl. the 88-day libration terms.
// UTC is used as TDB (69 s ≈ 0.005° of rotation). Verified against JPL
// Horizons to < 0.3° sub-solar longitude and < 2e-4 AU (see tests). It is
// NOT JPL-accurate and must not be presented as such.

export const AU_KM = 149597870.7;
export const SUN_RADIUS_KM = 695700;

const DAY_MS = 86400000;
const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const GAUSS_K = 0.01720209895;           // AU^1.5 / day (√GM☉)
const OBLIQUITY = 23.43928 * DEG;        // J2000 ecliptic → ICRF

// [value at J2000, rate per Julian century]; angles in degrees.
export const ELEMENTS_J2000 = {
  a:     [0.38709927,   0.00000037],
  e:     [0.20563593,   0.00001906],
  I:     [7.00497902,  -0.00594749],
  L:     [252.25032350, 149472.67411175],
  varpi: [77.45779628,  0.16047689],
  Omega: [48.33076593, -0.12534081],
};

function wrapPi(x) {
  return x - TAU * Math.floor((x + Math.PI) / TAU);
}

function solveKepler(M, e) {
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 12; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-13) break;
  }
  return E;
}

export function mercuryRotation(d, T) {
  const s = (deg) => Math.sin(deg * DEG);
  const M1 = 174.7910857 + 4.092335 * d;
  const M2 = 349.5821714 + 8.184670 * d;
  const M3 = 164.3732571 + 12.277005 * d;
  const M4 = 339.1643429 + 16.369340 * d;
  const M5 = 153.9554286 + 20.461675 * d;
  return {
    alpha0Deg: 281.0103 - 0.0328 * T,
    delta0Deg: 61.4155 - 0.0049 * T,
    WDeg: 329.5988 + 6.1385108 * d
      + 0.01067257 * s(M1) - 0.00112309 * s(M2) - 0.00011040 * s(M3)
      - 0.00002539 * s(M4) - 0.00000571 * s(M5),
  };
}

// ICRF vector → Mercury body-fixed: Rz(W) · Rx(90° − δ0) · Rz(90° + α0).
function icrfToBody([x0, y0, z0], { alpha0Deg, delta0Deg, WDeg }) {
  const A = (90 + alpha0Deg) * DEG;
  let x = Math.cos(A) * x0 + Math.sin(A) * y0;
  let y = -Math.sin(A) * x0 + Math.cos(A) * y0;
  let z = z0;
  const B = (90 - delta0Deg) * DEG;
  const y1 = Math.cos(B) * y + Math.sin(B) * z;
  const z1 = -Math.sin(B) * y + Math.cos(B) * z;
  y = y1; z = z1;
  const C = WDeg * DEG;
  const x2 = Math.cos(C) * x + Math.sin(C) * y;
  const y2 = -Math.sin(C) * x + Math.cos(C) * y;
  return [x2, y2, z];
}

export function mercuryEphemeris(tMs) {
  const d = (tMs - J2000_MS) / DAY_MS;
  const T = d / 36525;
  const el = (k) => ELEMENTS_J2000[k][0] + ELEMENTS_J2000[k][1] * T;

  const a = el('a');
  const e = el('e');
  const I = el('I') * DEG;
  const varpi = el('varpi') * DEG;
  const Om = el('Omega') * DEG;
  const w = varpi - Om;
  const M = wrapPi(el('L') * DEG - varpi);

  const E = solveKepler(M, e);
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const r = Math.hypot(xp, yp);
  const nu = Math.atan2(yp, xp);

  const cw = Math.cos(w), sw = Math.sin(w);
  const cO = Math.cos(Om), sO = Math.sin(Om);
  const cI = Math.cos(I), sI = Math.sin(I);
  const xe = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
  const ye = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
  const ze = (sw * sI) * xp + (cw * sI) * yp;

  const xq = xe;
  const yq = ye * Math.cos(OBLIQUITY) - ze * Math.sin(OBLIQUITY);
  const zq = ye * Math.sin(OBLIQUITY) + ze * Math.cos(OBLIQUITY);

  const sunFromMercury = [-xq / r, -yq / r, -zq / r];
  const [bx, by, bz] = icrfToBody(sunFromMercury, mercuryRotation(d, T));
  const lon = Math.atan2(by, bx) / DEG;

  const rdotAuDay = (GAUSS_K * e * Math.sin(nu)) / Math.sqrt(a * (1 - e * e));

  return {
    r,
    rdotKmS: (rdotAuDay * AU_KM) / 86400,
    subsolarLonDeg: ((lon % 360) + 360) % 360,
    subsolarLatDeg: Math.asin(Math.max(-1, Math.min(1, bz))) / DEG,
    sunAngularRadiusRad: Math.asin(SUN_RADIUS_KM / (r * AU_KM)),
    trueAnomalyRad: nu,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryEphemeris.test.js`
Expected: PASS (all). If ONLY the longitude tests fail by a constant offset near 180° or a mirrored sign, the body-frame convention is flipped: check `icrfToBody` rotation directions against IAU (frame rotations, not vector rotations) — do not loosen the tolerance.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/planet/mercuryEphemeris.js src/terminal/mercury/planet/__tests__/mercuryEphemeris.test.js
git commit -m "feat(mercury): live ephemeris — Keplerian orbit + IAU rotation, checked against JPL Horizons

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Planet frame, look constants, tuning rig

**Files:**
- Create: `src/terminal/mercury/planet/planetFrame.js`
- Create: `src/terminal/mercury/planet/planetLook.js`
- Modify: `src/terminal/mercury/mercuryTuning.js` (rig + export)
- Test: `src/terminal/mercury/planet/__tests__/planetFrame.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `planetFrame.js`: `PHASE_ANGLE_DEG = 55`, `SUN_DIR_WORLD: readonly [x,y,z]`, `dirFromLonLat(lonDeg, latDeg) → [x,y,z]`, `lonLatFromDir([x,y,z]) → { lonDeg /*0..360*/, latDeg }`, `rotY([x,y,z], a) → [x,y,z]`, `bodyYawFor(subsolarLonDeg, sunDir = SUN_DIR_WORLD) → radians`, `uvFromLonLat(lonDeg, latDeg) → [u, v]`.
  - `planetLook.js`: `R_SCENE = 0.75`, `R_MERCURY_M = 2439400`, `MEAN_R_AU = 0.387098`, `SHADOW_STEPS = 12`, `SHADOW_REACH_RAD = 0.03`, `SHADOW_SOFT_M = 300`, `SHADOW_ZONE = 0.35`, `FALLBACK_ALBEDO = [0.16, 0.15, 0.14]`, `CAMERA_DIST = { desktop: 3.6, mobile: 4.6 }`, `ORBIT_LIMITS = { min: 2.2, max: 5.5 }`, mutable `PLANET_TUNE = { exposure, relief, nightFloor }`.

Frame convention (the shader mirrors it exactly): world +Y = Mercury's north pole; body direction for east longitude λ, latitude φ is `(cosφ cosλ, sinφ, −cosφ sinλ)`; `world = rotY(body, yaw)` with `rotY(v,a) = (c·x + s·z, y, −s·x + c·z)`. Texture: `u = λ/360`, `v = 0.5 + φ/180` (three's default `flipY` puts the image's top row — north — at v = 1).

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/mercury/planet/__tests__/planetFrame.test.js
import { describe, it, expect } from 'vitest';
import {
  PHASE_ANGLE_DEG, SUN_DIR_WORLD, dirFromLonLat, lonLatFromDir, rotY, bodyYawFor, uvFromLonLat,
} from '../planetFrame';

const close3 = (a, b, eps = 1e-9) => a.forEach((x, i) => expect(Math.abs(x - b[i])).toBeLessThan(eps));
const deg = (r) => (r * 180) / Math.PI;

describe('planetFrame', () => {
  it('SUN_DIR_WORLD is a unit vector in the equatorial plane at the fixed phase angle to the camera (+Z)', () => {
    const [x, y, z] = SUN_DIR_WORLD;
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 12);
    expect(y).toBe(0);
    expect(deg(Math.acos(z))).toBeCloseTo(PHASE_ANGLE_DEG, 9);
    expect(x).toBeLessThan(0); // Sun on the viewer's left
  });

  it('dirFromLonLat and lonLatFromDir are inverses (east-positive, 0..360)', () => {
    for (const [lon, lat] of [[0, 0], [90, 0], [200, 30], [359, -60]]) {
      const back = lonLatFromDir(dirFromLonLat(lon, lat));
      expect(back.lonDeg).toBeCloseTo(lon, 9);
      expect(back.latDeg).toBeCloseTo(lat, 9);
    }
  });

  it('east longitude increases counter-clockwise seen from north (+Y): 90°E is −Z', () => {
    close3(dirFromLonLat(90, 0), [0, 0, -1], 1e-12);
  });

  it('bodyYawFor rotates the subsolar point onto the Sun direction', () => {
    for (const lon of [0, 94.456145, 257.860623, 359.9]) {
      const yaw = bodyYawFor(lon);
      close3(rotY(dirFromLonLat(lon, 0), yaw), SUN_DIR_WORLD, 1e-9);
      expect(lonLatFromDir(rotY(SUN_DIR_WORLD, -yaw)).lonDeg).toBeCloseTo(lon, 6);
    }
  });

  it('uvFromLonLat: lon 0 → u 0, 90°E → u 0.25; north pole → v 1, south pole → v 0', () => {
    expect(uvFromLonLat(0, 0)).toEqual([0, 0.5]);
    expect(uvFromLonLat(90, 0)[0]).toBeCloseTo(0.25, 12);
    expect(uvFromLonLat(0, 90)[1]).toBe(1);
    expect(uvFromLonLat(0, -90)[1]).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/planetFrame.test.js`
Expected: FAIL — cannot resolve `../planetFrame`.

- [ ] **Step 3: Write the implementation**

```js
// src/terminal/mercury/planet/planetFrame.js — world ↔ Mercury body frame.
//
// World +Y is Mercury's north pole (obliquity ≈ 0.03°, so the real Sun stays
// on the equator — SUN_DIR_WORLD has y = 0 on purpose). What is REAL: which
// face is lit (subsolar longitude). What is CHOSEN (spec §4): the Sun sits at
// a fixed phase angle to the camera so a gibbous planet is always on screen.
// mercuryPlanetShader.js mirrors rotY / dirFromLonLat / uvFromLonLat exactly.

const DEG = Math.PI / 180;

export const PHASE_ANGLE_DEG = 55;

export const SUN_DIR_WORLD = Object.freeze([
  -Math.sin(PHASE_ANGLE_DEG * DEG),
  0,
  Math.cos(PHASE_ANGLE_DEG * DEG),
]);

export function dirFromLonLat(lonDeg, latDeg) {
  const l = lonDeg * DEG, p = latDeg * DEG;
  return [Math.cos(p) * Math.cos(l), Math.sin(p), -Math.cos(p) * Math.sin(l)];
}

export function lonLatFromDir([x, y, z]) {
  const lon = Math.atan2(-z, x) / DEG;
  return {
    lonDeg: ((lon % 360) + 360) % 360,
    latDeg: Math.asin(Math.max(-1, Math.min(1, y))) / DEG,
  };
}

export function rotY([x, y, z], a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [c * x + s * z, y, -s * x + c * z];
}

export function bodyYawFor(subsolarLonDeg, sunDir = SUN_DIR_WORLD) {
  const azSun = Math.atan2(-sunDir[2], sunDir[0]);
  return azSun - subsolarLonDeg * DEG;
}

export function uvFromLonLat(lonDeg, latDeg) {
  return [(((lonDeg % 360) + 360) % 360) / 360, 0.5 + latDeg / 180];
}
```

```js
// src/terminal/mercury/planet/planetLook.js — the planet's constants.
//
// Physical/structural constants are baked into the shader via glf().
// PLANET_TUNE values are HYPOTHESES until the author tunes them live
// (__mercuryTune.planet.exposure = …) and exports; they reach the shader as
// uniforms re-read every frame, so pokes are authoritative.

export const R_SCENE = 0.75;            // scene units — unchanged from the old sphere
export const R_MERCURY_M = 2439400;     // USGS DEM datum radius
export const MEAN_R_AU = 0.387098;      // semi-major axis; irradiance = (MEAN_R_AU / r)^2

// Cast crater shadows: a short heightfield march toward the Sun near the terminator.
export const SHADOW_STEPS = 12;
export const SHADOW_REACH_RAD = 0.03;   // ~73 km of arc
export const SHADOW_SOFT_M = 300;       // edge softness in (exaggerated) metres
export const SHADOW_ZONE = 0.35;        // only march where the Sun is lower than ~20°

export const FALLBACK_ALBEDO = [0.16, 0.15, 0.14]; // linear; true-colour grey-brown until maps load

export const CAMERA_DIST = { desktop: 3.6, mobile: 4.6 };
export const ORBIT_LIMITS = { min: 2.2, max: 5.5 };

export const PLANET_TUNE = {
  exposure: 2.2,     // Sun irradiance multiplier at mean distance
  relief: 12,        // DEM vertical exaggeration (normals + shadows)
  nightFloor: 0.006, // faint albedo floor so the night limb is not a hole
};
```

Then in `src/terminal/mercury/mercuryTuning.js`:

Add after the existing `import { ELEMENTS, NEUTRAL_NIGHT } from './elements';`:

```js
import { PLANET_TUNE } from './planet/planetLook';
```

Inside `window.__mercuryTune = { … }`, after `neutral: NEUTRAL_NIGHT,` add:

```js
    // Planet look — live, MercuryPlanet re-reads it every frame.
    planet: PLANET_TUNE,
```

In `export()`, replace the `const block = …` statement with:

```js
      const planet = Object.entries(PLANET_TUNE)
        .map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`).join('\n');
      const block = `--- COMMITTED CONSTANTS (hand this block to Sophie) ---\n` +
        `TUNE = {\n${lines}\n}\n` +
        `ELEMENTS = {\n${els}\n}\n` +
        `NEUTRAL_NIGHT.color = '${NEUTRAL_NIGHT.color}'\n` +
        `PLANET_TUNE = {\n${planet}\n}`;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/planetFrame.test.js src/terminal/mercury/__tests__`
Expected: PASS (new file + existing mercury tests unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/planet/planetFrame.js src/terminal/mercury/planet/planetLook.js src/terminal/mercury/mercuryTuning.js src/terminal/mercury/planet/__tests__/planetFrame.test.js
git commit -m "feat(mercury): planet frame maths, look constants, PLANET_TUNE in the dev rig

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: USGS map pipeline

**Files:**
- Create: `scripts/mercury-maps/lib.mjs`
- Create: `scripts/mercury-maps/build.mjs`
- Create (generated): `src/terminal/mercury/planet/mercuryMaps.generated.js`, `public/mercury/albedo-4608.webp`, `public/mercury/albedo-2304.webp`, `public/mercury/dem-2304.webp`, `public/mercury/dem-1152.webp`
- Modify: `.gitignore` (add `.cache/`), `package.json` (devDependencies `geotiff`, `sharp`)
- Test: `tests/mercuryMapsLib.test.js`

**Interfaces:**
- Produces (lib): `boxDownsample(src: TypedArray, w, h, channels, f) → Float32Array` (size `(w/f)*(h/f)*channels`, requires `w % f === 0 && h % f === 0`); `rollToLonZero(data, w, h, channels, lonStartDeg) → same type` (column 0 starts at 0°E); `quantise8Dithered(values: Float32Array, min, max) → Uint8Array` (deterministic ±0.5 LSB dither); `minMax(values, isValid = () => true) → { min, max }`.
- Produces (generated module): `DEM_MIN_M: number`, `DEM_MAX_M: number`, `MAPS = { desktop: { albedo, dem, demSize: [w,h] }, mobile: { … } }`.

Sources (public domain; credit NASA/JHUAPL/Carnegie, USGS Astrogeology):
- Enhanced colour: `https://planetarymaps.usgs.gov/mosaic/Mercury_MESSENGER_MDIS_Basemap_EnhancedColor_Mosaic_Global_665m.tif` — 23040×11520, 8-bit ×3, simple cylindrical, positive east, **759 MB**.
- DEM: `https://planetarymaps.usgs.gov/mosaic/Mercury_Messenger_USGS_DEM_Global_665m_v2.tif` — 23040×11520, 16-bit, metres vs 2 439 400 m datum, equirectangular, 0–360 domain, **~506 MB**.

- [ ] **Step 1: Write the failing test**

```js
// tests/mercuryMapsLib.test.js
import { describe, it, expect } from 'vitest';
import { boxDownsample, rollToLonZero, quantise8Dithered, minMax } from '../scripts/mercury-maps/lib.mjs';

describe('mercury map lib', () => {
  it('boxDownsample averages f×f blocks per channel', () => {
    // 4×2, 1 channel → 2×1
    const src = new Uint8Array([0, 2, 10, 10, 4, 6, 20, 40]);
    expect(Array.from(boxDownsample(src, 4, 2, 1, 2))).toEqual([3, 20]);
  });

  it('boxDownsample keeps channels interleaved', () => {
    const src = new Uint8Array([0, 100, 2, 100, 4, 100, 6, 100]); // 2×2, 2 ch
    expect(Array.from(boxDownsample(src, 2, 2, 2, 2))).toEqual([3, 100]);
  });

  it('boxDownsample rejects non-integer factors', () => {
    expect(() => boxDownsample(new Uint8Array(6), 3, 2, 1, 2)).toThrow();
  });

  it('rollToLonZero moves the 0°E column to column 0 for a −180° start', () => {
    const src = new Uint8Array([1, 2, 3, 4]); // 4×1, columns at -135,-45,45,135
    expect(Array.from(rollToLonZero(src, 4, 1, 1, -180))).toEqual([3, 4, 1, 2]);
  });

  it('rollToLonZero is identity for a 0° start', () => {
    const src = new Uint8Array([1, 2, 3, 4]);
    expect(Array.from(rollToLonZero(src, 4, 1, 1, 0))).toEqual([1, 2, 3, 4]);
  });

  it('quantise8Dithered maps min→0, max→255 and stays within ±1 LSB of the ideal', () => {
    const v = new Float32Array(1000).map((_, i) => -5000 + (i / 999) * 10000);
    const q = quantise8Dithered(v, -5000, 5000);
    expect(q[0]).toBe(0);
    expect(q[999]).toBe(255);
    for (let i = 0; i < v.length; i++) {
      const ideal = ((v[i] + 5000) / 10000) * 255;
      expect(Math.abs(q[i] - ideal)).toBeLessThanOrEqual(1);
    }
  });

  it('quantise8Dithered is deterministic', () => {
    const v = new Float32Array([1, 2, 3, 4.5]);
    expect(Array.from(quantise8Dithered(v, 0, 10))).toEqual(Array.from(quantise8Dithered(v, 0, 10)));
  });

  it('minMax skips invalid samples', () => {
    expect(minMax(new Int16Array([-32768, -10, 50]), (x) => x > -32768)).toEqual({ min: -10, max: 50 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/mercuryMapsLib.test.js`
Expected: FAIL — cannot resolve `../scripts/mercury-maps/lib.mjs`.

- [ ] **Step 3: Write the lib**

```js
// scripts/mercury-maps/lib.mjs — pure raster helpers for build.mjs (tested).

export function boxDownsample(src, w, h, channels, f) {
  if (w % f !== 0 || h % f !== 0) throw new Error(`factor ${f} must divide ${w}×${h}`);
  const ow = w / f, oh = h / f;
  const out = new Float32Array(ow * oh * channels);
  const inv = 1 / (f * f);
  for (let oy = 0; oy < oh; oy++) {
    for (let ox = 0; ox < ow; ox++) {
      for (let c = 0; c < channels; c++) {
        let sum = 0;
        for (let dy = 0; dy < f; dy++) {
          const row = (oy * f + dy) * w;
          for (let dx = 0; dx < f; dx++) sum += src[(row + ox * f + dx) * channels + c];
        }
        out[(oy * ow + ox) * channels + c] = sum * inv;
      }
    }
  }
  return out;
}

export function rollToLonZero(data, w, h, channels, lonStartDeg) {
  const shift = Math.round((((-lonStartDeg % 360) + 360) % 360) / 360 * w) % w;
  if (shift === 0) return data;
  const out = new data.constructor(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const src = (y * w + ((x + shift) % w)) * channels;
      const dst = (y * w + x) * channels;
      for (let c = 0; c < channels; c++) out[dst + c] = data[src + c];
    }
  }
  return out;
}

// Deterministic ±0.5 LSB dither: kills terracing when the shader exaggerates relief.
export function quantise8Dithered(values, min, max) {
  const out = new Uint8Array(values.length);
  const scale = 255 / (max - min);
  for (let i = 0; i < values.length; i++) {
    const h = Math.sin(i * 12.9898) * 43758.5453;
    const noise = (h - Math.floor(h)) - 0.5;
    const q = Math.round((values[i] - min) * scale + noise);
    out[i] = q < 0 ? 0 : q > 255 ? 255 : q;
  }
  return out;
}

export function minMax(values, isValid = () => true) {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!isValid(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}
```

Check: `rollToLonZero` for start −180 on 4 columns → shift = round(180/360·4) = 2, out[0] = data[2] = 3, as the test expects.

Note `quantise8Dithered` at the exact endpoints: i = 0 → noise = frac(0) − 0.5 = −0.5 → round(−0.5) = −0 → 0 ✓; i = 999 → value 255 + noise ∈ [−0.5, 0.5) → clamps to ≤ 255, rounds to 255 unless noise < −0.5 (impossible) ✓.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/mercuryMapsLib.test.js`
Expected: PASS.

- [ ] **Step 5: Install script-only deps and ignore the cache**

```bash
npm install --save-dev geotiff sharp
```

Append to `.gitignore`:

```
# USGS source rasters for scripts/mercury-maps (~1.3 GB, never commit)
.cache/
```

- [ ] **Step 6: Write the build script**

```js
// scripts/mercury-maps/build.mjs — USGS MESSENGER rasters → web textures.
//
// One-off, NOT runtime. Downloads ~1.3 GB into .cache/usgs (skipped if present),
// box-downsamples by exact integer factors, encodes WebP, writes
// src/terminal/mercury/planet/mercuryMaps.generated.js. Re-run to regenerate.
// Data: NASA/JHUAPL/Carnegie MESSENGER MDIS; USGS Astrogeology. Public domain.
//
//   node scripts/mercury-maps/build.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fromFile } from 'geotiff';
import sharp from 'sharp';
import { boxDownsample, rollToLonZero, quantise8Dithered, minMax } from './lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CACHE = path.join(ROOT, '.cache', 'usgs');
const OUT = path.join(ROOT, 'public', 'mercury');
const GEN = path.join(ROOT, 'src', 'terminal', 'mercury', 'planet', 'mercuryMaps.generated.js');

const SRC = {
  albedo: 'https://planetarymaps.usgs.gov/mosaic/Mercury_MESSENGER_MDIS_Basemap_EnhancedColor_Mosaic_Global_665m.tif',
  dem: 'https://planetarymaps.usgs.gov/mosaic/Mercury_Messenger_USGS_DEM_Global_665m_v2.tif',
};
const DATUM_M = 2439400;
const BUDGET = { desktop: 4.5e6, mobile: 1.5e6 };
// Exact integer factors of 23040×11520.
const SIZES = {
  desktop: { albedoF: 5, demF: 10 },  // albedo 4608×2304, dem 2304×1152
  mobile:  { albedoF: 10, demF: 20 }, // albedo 2304×1152, dem 1152×576
};

async function download(url) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, path.basename(url));
  if (fs.existsSync(file)) return file;
  console.log(`downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(file + '.part'));
  fs.renameSync(file + '.part', file);
  return file;
}

async function readRaster(file) {
  const tiff = await fromFile(file);
  const img = await tiff.getImage();
  const w = img.getWidth(), h = img.getHeight(), channels = img.getSamplesPerPixel();
  const [x0] = img.getBoundingBox(); // metres on the datum sphere
  const lonStartDeg = (x0 / DATUM_M) * (180 / Math.PI);
  const data = await img.readRasters({ interleave: true });
  console.log(`${path.basename(file)}: ${w}×${h}×${channels}, lon start ${lonStartDeg.toFixed(3)}°`);
  return { w, h, channels, data: rollToLonZero(data, w, h, channels, lonStartDeg) };
}

const toU8 = (f32) => Uint8Array.from(f32, (v) => Math.max(0, Math.min(255, Math.round(v))));

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const albedo = await readRaster(await download(SRC.albedo));
  const dem = await readRaster(await download(SRC.dem));
  if (albedo.channels < 3) throw new Error('enhanced colour mosaic must have 3 bands');

  const NODATA = (v) => v > -20000 && v < 20000;
  for (let i = 0; i < dem.data.length; i++) if (!NODATA(dem.data[i])) dem.data[i] = 0;
  const { min, max } = minMax(dem.data);
  console.log(`DEM range ${min} … ${max} m`);

  const manifest = {};
  for (const [tier, { albedoF, demF }] of Object.entries(SIZES)) {
    const aw = albedo.w / albedoF, ah = albedo.h / albedoF;
    const dw = dem.w / demF, dh = dem.h / demF;
    const rgb = toU8(boxDownsample(albedo.data, albedo.w, albedo.h, albedo.channels, albedoF));
    const rgb3 = albedo.channels === 3 ? rgb : Uint8Array.from({ length: aw * ah * 3 }, (_, i) => rgb[Math.floor(i / 3) * albedo.channels + (i % 3)]);
    const albedoName = `albedo-${aw}.webp`;
    await sharp(Buffer.from(rgb3), { raw: { width: aw, height: ah, channels: 3 }, limitInputPixels: false })
      .webp({ quality: 88, effort: 6 }).toFile(path.join(OUT, albedoName));

    const h8 = quantise8Dithered(boxDownsample(dem.data, dem.w, dem.h, 1, demF), min, max);
    const demName = `dem-${dw}.webp`;
    await sharp(Buffer.from(h8), { raw: { width: dw, height: dh, channels: 1 }, limitInputPixels: false })
      .webp({ lossless: true, effort: 6 }).toFile(path.join(OUT, demName));

    const bytes = fs.statSync(path.join(OUT, albedoName)).size + fs.statSync(path.join(OUT, demName)).size;
    console.log(`${tier}: ${albedoName} + ${demName} = ${(bytes / 1e6).toFixed(2)} MB`);
    if (bytes > BUDGET[tier]) throw new Error(`${tier} maps ${bytes} B exceed budget ${BUDGET[tier]} B`);
    manifest[tier] = { albedo: `/mercury/${albedoName}`, dem: `/mercury/${demName}`, demSize: [dw, dh] };
  }

  fs.writeFileSync(GEN, `// GENERATED by scripts/mercury-maps/build.mjs — do not edit by hand.
// Source: MESSENGER MDIS enhanced-colour mosaic + USGS global DEM 665 m (public domain).

export const DEM_MIN_M = ${min};
export const DEM_MAX_M = ${max};

export const MAPS = ${JSON.stringify(manifest, null, 2)};
`);
  console.log(`wrote ${path.relative(ROOT, GEN)}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 7: ASK THE AUTHOR before downloading** — "This downloads ~1.3 GB from planetarymaps.usgs.gov into `.cache/usgs/`. OK?" Wait for a clear yes.

- [ ] **Step 8: Run the script**

Run: `node scripts/mercury-maps/build.mjs`
Expected: prints both rasters as `23040×11520`, a DEM range roughly −5500 … +4500 m, both tiers under budget, and `wrote src/terminal/mercury/planet/mercuryMaps.generated.js`.
If a tier is over budget: lower albedo `quality` in steps of 4 (not below 76) and re-run. If `readRasters` runs out of memory: run with `node --max-old-space-size=8192`.

- [ ] **Step 9: Eyeball the output** — open `public/mercury/albedo-2304.webp` with the Read tool. Expected: the enhanced-colour globe, north up, and lon 0 at the left edge (Caloris basin — the big orange-tan disc — at about 162°E, i.e. ~45% from the left, northern hemisphere). Open `dem-1152.webp`: grey relief, same framing. If Caloris is near 5–10% or the right edge instead, the roll is wrong — fix before continuing.

- [ ] **Step 10: Commit**

```bash
git add .gitignore package.json package-lock.json scripts/mercury-maps tests/mercuryMapsLib.test.js public/mercury src/terminal/mercury/planet/mercuryMaps.generated.js
git commit -m "feat(mercury): USGS MESSENGER enhanced-colour + DEM texture pipeline

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The planet shader

**Files:**
- Create: `src/terminal/gl/glf.js`
- Modify: `src/terminal/views/manifesto/councilFieldShader.js:15-18` (the `glf` definition)
- Create: `src/terminal/mercury/planet/mercuryPlanetShader.js`
- Test: `src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`

**Interfaces:**
- Consumes: `planetLook.js` constants (Task 2), `DEM_MIN_M`, `DEM_MAX_M` (Task 3).
- Produces: `glf(x) → string`, `v3([a,b,c]) → string` from `gl/glf.js`; `PLANET_VS`, `PLANET_FS`, `PLANET_UNIFORMS: string[]` (non-builtin uniforms), `PLANET_BUILTINS = ['viewMatrix','projectionMatrix','cameraPosition']`.

- [ ] **Step 1: Extract `glf`**

Create `src/terminal/gl/glf.js`:

```js
// glf.js — JS number → GLSL float literal. Shared by every raw shader that
// interpolates constants from the JS module that owns (and tests) them.

export function glf(x) {
  const s = Number(x).toPrecision(9);
  return /[.e]/.test(s) ? s : `${s}.0`;
}

export const v3 = (a) => `vec3(${a.map(glf).join(', ')})`;
export const v4 = (a) => `vec4(${a.map(glf).join(', ')})`;
```

In `src/terminal/views/manifesto/councilFieldShader.js`, replace

```js
export function glf(x) {
  const s = Number(x).toPrecision(9);
  return /[.e]/.test(s) ? s : `${s}.0`;
}
const v4 = (a) => `vec4(${a.map(glf).join(', ')})`;
const v3 = (a) => `vec3(${a.map(glf).join(', ')})`;
```

with

```js
import { glf, v3, v4 } from '../../gl/glf';

export { glf };
```

(Move that import up with the other imports at the top of the file.)

Run: `npx vitest run src/terminal/views/manifesto`
Expected: PASS — /ACCRETION unchanged.

- [ ] **Step 2: Write the failing shader contract test**

```js
// src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js
import { describe, it, expect } from 'vitest';
import { PLANET_VS, PLANET_FS, PLANET_UNIFORMS, PLANET_BUILTINS } from '../mercuryPlanetShader';
import { glf } from '../../../gl/glf';
import {
  R_SCENE, R_MERCURY_M, SHADOW_STEPS, SHADOW_REACH_RAD, SHADOW_SOFT_M, SHADOW_ZONE,
} from '../planetLook';
import { DEM_MIN_M, DEM_MAX_M } from '../mercuryMaps.generated';

const declared = (src) => [...src.matchAll(/^uniform\s+\w+\s+(\w+);/gm)].map((m) => m[1]);

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
    })) {
      expect(PLANET_FS).toContain(`const float ${name} = ${glf(value)};`);
    }
    expect(PLANET_FS).toContain(`const int SHADOW_STEPS = ${SHADOW_STEPS};`);
    expect(PLANET_VS).toContain(`const float R_SCENE = ${glf(R_SCENE)};`);
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

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`
Expected: FAIL — cannot resolve `../mercuryPlanetShader`.

- [ ] **Step 4: Write the shader module**

```js
// src/terminal/mercury/planet/mercuryPlanetShader.js — Mercury, from the bare metal.
//
// An impostor quad ray-intersects the sphere, writes gl_FragDepth (so the
// aether sorts in front of and behind it), and shades from two equirect maps:
// MESSENGER enhanced colour + USGS DEM. Airless-body photometry
// (Lommel–Seeliger), a penumbra as wide as the real Sun's disc, cast crater
// shadows near the terminator. Constants come from the modules that own and
// test them (glf), exactly like /ACCRETION. Frame convention = planetFrame.js.

import { glf, v3 } from '../../gl/glf';
import {
  R_SCENE, R_MERCURY_M, SHADOW_STEPS, SHADOW_REACH_RAD, SHADOW_SOFT_M, SHADOW_ZONE, FALLBACK_ALBEDO,
} from './planetLook';
import { DEM_MIN_M, DEM_MAX_M } from './mercuryMaps.generated';

export const PLANET_BUILTINS = ['viewMatrix', 'projectionMatrix', 'cameraPosition'];

export const PLANET_UNIFORMS = [
  'uAlbedo', 'uDem', 'uHasMaps', 'uSunDir', 'uBodyYaw', 'uSunIrr', 'uSunSinR',
  'uDemTexel', 'uTime', 'uExposure', 'uRelief', 'uNightFloor',
];

export const PLANET_VS = /* glsl */ `in vec3 position;

uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 cameraPosition;

out vec3 vWorld;

const float R_SCENE = ${glf(R_SCENE)};

void main() {
  // Billboard at the centre plane, sized to the perspective silhouette + margin.
  float d = length(cameraPosition);
  float ext = R_SCENE * d / sqrt(max(d * d - R_SCENE * R_SCENE, 1e-4)) * 1.08;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vWorld = (right * position.x + up * position.y) * ext;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}
`;

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
uniform float uBodyYaw;
uniform float uSunIrr;
uniform float uSunSinR;
uniform vec2 uDemTexel;
uniform float uTime;
uniform float uExposure;
uniform float uRelief;
uniform float uNightFloor;

const float PI = 3.14159265358979;
const float TAU = 6.28318530717959;
const float R_SCENE = ${glf(R_SCENE)};
const float R_MERCURY_M = ${glf(R_MERCURY_M)};
const float DEM_MIN_M = ${glf(DEM_MIN_M)};
const float DEM_MAX_M = ${glf(DEM_MAX_M)};
const int SHADOW_STEPS = ${SHADOW_STEPS};
const float SHADOW_REACH_RAD = ${glf(SHADOW_REACH_RAD)};
const float SHADOW_SOFT_M = ${glf(SHADOW_SOFT_M)};
const float SHADOW_ZONE = ${glf(SHADOW_ZONE)};
const vec3 FALLBACK_ALBEDO = ${v3(FALLBACK_ALBEDO)};

// planetFrame.rotY
vec3 rotY(vec3 v, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
}

float heightAt(vec2 uv, vec2 gx, vec2 gy) {
  return mix(DEM_MIN_M, DEM_MAX_M, textureGrad(uDem, vec2(fract(uv.x), uv.y), gx, gy).r);
}

// March toward the Sun over the (exaggerated) heightfield. Terrain height is
// measured against the tangent plane, so the sphere's curvature drops away
// as (xR)^2 / 2R; the sunlight ray rises as xR * tan(elevation).
float castShadow(vec2 uv, vec3 nb, vec3 Lb, float h0, float cosLat, vec3 east, vec3 north, vec2 gx, vec2 gy) {
  vec3 tdir = Lb - nb * dot(Lb, nb);
  float tl = length(tdir);
  if (tl < 1e-4) return 1.0;
  tdir /= tl;
  float tanE = dot(Lb, nb) / tl;
  vec2 duv = vec2(dot(tdir, east) / (TAU * cosLat), dot(tdir, north) / PI);
  float vis = 1.0;
  for (int k = 1; k <= SHADOW_STEPS; k++) {
    float f = float(k) / float(SHADOW_STEPS);
    float x = SHADOW_REACH_RAD * f * f;
    float hk = heightAt(uv + duv * x, gx, gy);
    float xm = x * R_MERCURY_M;
    float terrain = hk * uRelief - xm * xm / (2.0 * R_MERCURY_M);
    float ray = h0 * uRelief + xm * tanE;
    vis = min(vis, smoothstep(-SHADOW_SOFT_M, SHADOW_SOFT_M, ray - terrain));
  }
  return vis;
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

  vec3 nb = rotY(ng, -uBodyYaw);
  vec3 Lb = rotY(uSunDir, -uBodyYaw);
  vec3 Vb = rotY(-rd, -uBodyYaw);
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
  }

  vec3 col = max(albedo * (uSunIrr * uExposure * ls * term * vis + uNightFloor), 0.0);
  vec3 srgb = mix(col * 12.92, 1.055 * pow(col, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), col));
  float dith = (fract(sin(dot(gl_FragCoord.xy + fract(uTime) * 61.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  fragColor = vec4(srgb + dith, coverage);
}
`;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/terminal/mercury/planet src/terminal/views/manifesto`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/gl/glf.js src/terminal/views/manifesto/councilFieldShader.js src/terminal/mercury/planet/mercuryPlanetShader.js src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js
git commit -m "feat(mercury): raw GLSL planet shader — impostor, DEM relief, cast shadows, real-Sun penumbra

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Mount the planet; retire the sphere mesh; camera closer; credit

**Files:**
- Create: `src/terminal/mercury/MercuryPlanet.jsx`
- Modify: `src/terminal/mercury/MercurySphere.jsx` (lines 1–219 region)
- Modify: `src/terminal/mercury/MercuryCanvas.jsx`
- Modify: `src/terminal/views/MercuryTab.jsx:190-208`
- Test: `src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js`

**Interfaces:**
- Consumes: `mercuryEphemeris` (Task 1), `SUN_DIR_WORLD`, `bodyYawFor` (Task 2), `PLANET_TUNE`, `MEAN_R_AU`, `CAMERA_DIST`, `ORBIT_LIMITS` (Task 2), `MAPS` (Task 3), `PLANET_VS`, `PLANET_FS` (Task 4).
- Produces: `<MercuryPlanet isMobile />`; exported pure helper `planetEphemerisUniforms(nowMs) → { yaw, irr, sinR }`.

- [ ] **Step 1: Write the failing test** (the pure part; the GL part is verified in Task 7)

```js
// src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js
import { describe, it, expect } from 'vitest';
import { planetEphemerisUniforms } from '../MercuryPlanet';
import { mercuryEphemeris } from '../planet/mercuryEphemeris';
import { bodyYawFor } from '../planet/planetFrame';

describe('planetEphemerisUniforms', () => {
  const t = Date.UTC(2026, 9, 1);
  it('feeds yaw from the live subsolar longitude', () => {
    expect(planetEphemerisUniforms(t).yaw).toBeCloseTo(bodyYawFor(mercuryEphemeris(t).subsolarLonDeg), 12);
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js`
Expected: FAIL — cannot resolve `../MercuryPlanet`.

- [ ] **Step 3: Write `MercuryPlanet.jsx`**

```jsx
// MercuryPlanet.jsx — the planet under the real Sun (spec 2026-09-30, phase 1).
// Owns: impostor mesh, raw material, map loading, per-frame uniform writes.
// All maths lives in ./planet/* (tested); this file only wires it to GL.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PLANET_VS, PLANET_FS } from './planet/mercuryPlanetShader';
import { mercuryEphemeris } from './planet/mercuryEphemeris';
import { SUN_DIR_WORLD, bodyYawFor } from './planet/planetFrame';
import { PLANET_TUNE, MEAN_R_AU } from './planet/planetLook';
import { MAPS } from './planet/mercuryMaps.generated';

const EPHEMERIS_REFRESH_S = 1;

export function planetEphemerisUniforms(nowMs) {
  const eph = mercuryEphemeris(nowMs);
  return {
    yaw: bodyYawFor(eph.subsolarLonDeg),
    irr: (MEAN_R_AU / eph.r) ** 2,
    sinR: Math.sin(eph.sunAngularRadiusRad),
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

export default function MercuryPlanet({ isMobile = false }) {
  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), []);

  const material = useMemo(() => {
    const e = planetEphemerisUniforms(Date.now());
    return new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: PLANET_VS,
      fragmentShader: PLANET_FS,
      alphaToCoverage: !isMobile,
      uniforms: {
        uAlbedo: { value: null },
        uDem: { value: null },
        uHasMaps: { value: 0 },
        uSunDir: { value: new THREE.Vector3(...SUN_DIR_WORLD) },
        uBodyYaw: { value: e.yaw },
        uSunIrr: { value: e.irr },
        uSunSinR: { value: e.sinR },
        uDemTexel: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uExposure: { value: PLANET_TUNE.exposure },
        uRelief: { value: PLANET_TUNE.relief },
        uNightFloor: { value: PLANET_TUNE.nightFloor },
      },
    });
  }, [isMobile]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

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
  useFrame(({ clock }) => {
    const u = material.uniforms;
    const t = clock.elapsedTime;
    u.uTime.value = t;
    u.uExposure.value = PLANET_TUNE.exposure;
    u.uRelief.value = PLANET_TUNE.relief;
    u.uNightFloor.value = PLANET_TUNE.nightFloor;
    if (t >= nextEphemeris.current) {
      nextEphemeris.current = t + EPHEMERIS_REFRESH_S;
      const e = planetEphemerisUniforms(Date.now());
      u.uBodyYaw.value = e.yaw;
      u.uSunIrr.value = e.irr;
      u.uSunSinR.value = e.sinR;
    }
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js`
Expected: PASS.

- [ ] **Step 5: Retire the sphere mesh in `MercurySphere.jsx`**

Change the props destructure — remove `sargScore = 1.0,` (the planet no longer uses it).

Replace everything from `const sphereRef  = useRef();` down to and including the closing `</mesh>` of the "Mercury sphere — planet ↔ liquid Hg material transition" block (currently lines 73–219) with:

```jsx
  const ringRef    = useRef();
  const orbitAngleRef = useRef(0);
  const cycleCountRef = useRef(0);

  // Click burst state for handle animation
  const [pressedPhase, setPressedPhase] = useState(null);

  const litPhase = pendingPhase ?? activePhase;

  // The planet itself is MercuryPlanet (raw shader, real Sun). This component
  // keeps the orbit ring, the mercury thread and the element handles.
  useFrame((_, delta) => {
    orbitAngleRef.current += PRECESSION_RATE * delta;
    if (orbitAngleRef.current >= Math.PI * 2) {
      cycleCountRef.current++;
      orbitAngleRef.current -= Math.PI * 2;
      orbitAngleRef.current += PRECESSION_DRIFT;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = orbitAngleRef.current;
    }
  });

  return (
    <group>
```

Leave the rest (orbit ring group, thread, nodes, closing tags) untouched. Update the file's top comment lines 7–8 to:

```js
// Orbit ring, mercury thread and elemental handles. The planet is MercuryPlanet.
```

- [ ] **Step 6: Wire `MercuryCanvas.jsx`**

Add imports:

```js
import MercuryPlanet   from './MercuryPlanet';
import { CAMERA_DIST, ORBIT_LIMITS } from './planet/planetLook';
```

Change the `camera` prop:

```jsx
      camera={{ position: [0, 0, isMobile ? CAMERA_DIST.mobile : CAMERA_DIST.desktop], fov: isMobile ? 48 : 42 }}
```

Immediately before `<MercurySphere`, add:

```jsx
        <MercuryPlanet isMobile={isMobile} />
```

Remove the `sargScore={sargScore}` line from the `<MercurySphere …>` props, and remove `sargScore = 1.0,` from `MercuryCanvas`'s own props destructure. In `MercuryTab.jsx` remove `sargScore={1.0}` from `<MercuryCanvas …>`.

In `<OrbitControls …>` change:

```jsx
          minDistance={ORBIT_LIMITS.min}
          maxDistance={ORBIT_LIMITS.max}
```

- [ ] **Step 7: Credit line in `MercuryTab.jsx`**

On the canvas wrapper `div` (the one whose style has `background: '#000'`, `touchAction: 'none'`), add `position: 'relative',` to its `style`. After `<MercuryCanvas … />` and before that div closes, add:

```jsx
          <span
            className="absolute bottom-2 right-3 pointer-events-none select-none font-mono uppercase"
            style={{ fontSize: 9, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.28)' }}
          >
            MESSENGER MDIS · USGS ASTROGEOLOGY
          </span>
```

- [ ] **Step 8: Run the full suite, lint and build**

Run: `npm test`
Expected: PASS (no regressions; if a MercurySphere/MercuryCanvas snapshot or prop test references `sargScore` or the sphere mesh, update it to the new structure — do not delete coverage).

Run: `npm run lint`
Expected: exits 0 (no new errors; warnings not above the cap).

Run: `npm run build`
Expected: succeeds; `dist/mercury/*.webp` present.

- [ ] **Step 9: Commit**

```bash
git add src/terminal/mercury/MercuryPlanet.jsx src/terminal/mercury/MercurySphere.jsx src/terminal/mercury/MercuryCanvas.jsx src/terminal/views/MercuryTab.jsx src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js
git commit -m "feat(mercury): the planet under the real Sun replaces the grey ball; camera closer; data credit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: A clear window through the aether

**Files:**
- Create: `src/terminal/mercury/planet/planetWindow.js`
- Modify: `src/terminal/fluid/ParticleFlow.jsx`, `src/terminal/thermal/ThermalFlow.jsx`, `src/terminal/earth/SedimentFlow.jsx`, `src/terminal/air/AtmosphericFlow.jsx`
- Modify: `src/terminal/mercury/MercuryCanvas.jsx`
- Test: `src/terminal/mercury/planet/__tests__/planetWindow.test.js`

**Interfaces:**
- Consumes: `R_SCENE` (Task 2).
- Produces: `PLANET_WINDOW_GLSL` (declares `uniform float uPlanetWindow; uniform float uPlanetRadius;` and `float planetWindow(vec3 mv)`), `planetWindowJS(mv:[x,y,z], centreView:[x,y,z], radius, strength) → number` (JS mirror for tests). Each flow gains prop `planetWindow = 0` (off by default — FluidScene/ThermalScene/EarthScene/AirScene are unaffected).

Why geometric: `mercuryTuning.js:31-33` — per-sprite opacity "fights overlap logarithmically … can never empty the sky alone".

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/mercury/planet/__tests__/planetWindow.test.js
import { describe, it, expect } from 'vitest';
import { PLANET_WINDOW_GLSL, planetWindowJS } from '../planetWindow';

const C = [0, 0, -3.6]; // planet centre in view space (camera at origin looking −Z)
const R = 0.75;

describe('planetWindow', () => {
  it('declares its uniforms and function', () => {
    expect(PLANET_WINDOW_GLSL).toMatch(/uniform float uPlanetWindow;/);
    expect(PLANET_WINDOW_GLSL).toMatch(/uniform float uPlanetRadius;/);
    expect(PLANET_WINDOW_GLSL).toMatch(/float planetWindow\(vec3 mv\)/);
  });
  it('is fully transparent for a particle in front of the planet face', () => {
    expect(planetWindowJS([0, 0, -2.5], C, R, 1)).toBe(0);
  });
  it('leaves particles beside the planet (the halo) untouched', () => {
    expect(planetWindowJS([2.0, 0, -2.5], C, R, 1)).toBe(1);
  });
  it('leaves particles behind the centre plane to the depth test', () => {
    expect(planetWindowJS([0, 0, -4.0], C, R, 1)).toBe(1);
  });
  it('is a no-op when strength is 0', () => {
    expect(planetWindowJS([0, 0, -2.5], C, R, 0)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/planetWindow.test.js`
Expected: FAIL — cannot resolve `../planetWindow`.

- [ ] **Step 3: Write the snippet + JS mirror**

```js
// planetWindow.js — clears aether particles that sit between the camera and
// the planet's face, so the flows read as a halo, not fog over the surface.
// Geometric on purpose: opacity alone can never empty overlapping sprites
// (mercuryTuning.js). Behind-the-planet particles are left to the depth test
// (MercuryPlanet writes gl_FragDepth). planetWindowJS mirrors it for tests.

const EDGE_IN = 0.92;   // × radius: fully cleared inside this
const EDGE_OUT = 1.12;  // × radius: untouched beyond this (+ up to EDGE_JITTER)
const EDGE_JITTER = 0.18;

export const PLANET_WINDOW_GLSL = /* glsl */ `
uniform float uPlanetWindow;
uniform float uPlanetRadius;
float planetWindow(vec3 mv) {
  if (uPlanetWindow <= 0.0) return 1.0;
  vec3 c = (viewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float cl = length(c);
  vec3 ch = c / cl;
  float along = dot(mv, ch);
  if (along <= 0.0 || along >= cl) return 1.0;
  float lateral = length(mv - ch * along) * cl / along;
  float n = fract(sin(dot(mv, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  float edge = uPlanetRadius * (${EDGE_OUT.toFixed(2)} + ${EDGE_JITTER.toFixed(2)} * n);
  return mix(1.0, smoothstep(uPlanetRadius * ${EDGE_IN.toFixed(2)}, edge, lateral), uPlanetWindow);
}
`;

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Deterministic mirror (jitter fixed at its maximum so tests are exact).
export function planetWindowJS(mv, c, radius, strength) {
  if (strength <= 0) return 1;
  const cl = Math.hypot(...c);
  const ch = c.map((x) => x / cl);
  const along = mv[0] * ch[0] + mv[1] * ch[1] + mv[2] * ch[2];
  if (along <= 0 || along >= cl) return 1;
  const lat = Math.hypot(...mv.map((x, i) => x - ch[i] * along)) * cl / along;
  const w = smoothstep(radius * EDGE_IN, radius * (EDGE_OUT + EDGE_JITTER), lat);
  return 1 + (w - 1) * strength;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/planetWindow.test.js`
Expected: PASS.

- [ ] **Step 5: Wire each of the four flows** (same four edits in each file; the view-position variable is `mvPosition` in `ParticleFlow.jsx` and `mvPos` in the other three)

(a) Import at top:

```js
import { PLANET_WINDOW_GLSL } from '../mercury/planet/planetWindow';
import { R_SCENE } from '../mercury/planet/planetLook';
```

(b) Vertex shader: change the opening of the template from `` /* glsl */ ` `` + first uniform line to insert the snippet and a varying right after the backtick:

```js
const vertexShader = /* glsl */ `
  ${PLANET_WINDOW_GLSL}
  varying float vWindow;
```

(keep every existing line that followed). Immediately after the line that assigns `gl_Position = projectionMatrix * mvPosition;` (or `* mvPos;`), add:

- `ParticleFlow.jsx`: `vWindow = planetWindow(mvPosition.xyz);`
- `ThermalFlow.jsx`, `SedimentFlow.jsx`, `AtmosphericFlow.jsx`: `vWindow = planetWindow(mvPos.xyz);`

(c) Fragment shader: add `varying float vWindow;` next to the other varyings, and multiply the alpha term in the final `gl_FragColor` by `vWindow`:
- `ParticleFlow.jsx:183` → `gl_FragColor = vec4(color, (alpha * 0.95 * uOpacity) * vWindow + dither);`
- `ThermalFlow.jsx:196` → `gl_FragColor = vec4(col, (finalAlpha * uOpacity) * vWindow + dither);`
- `SedimentFlow.jsx:187` → `gl_FragColor = vec4(col, (alpha * vAlpha * (0.5 + (1.0 - vStrata) * 0.4) * uOpacity) * vWindow + dither);`
- `AtmosphericFlow.jsx:184` → `gl_FragColor = vec4(col, (alpha * alphaScale * uOpacity) * vWindow + dither);`

(d) Props + uniforms: add `planetWindow = 0,` to the component's props (next to `condenseSizeBite = 0.6,`); add to the uniforms object `uPlanetWindow: { value: planetWindow }, uPlanetRadius: { value: R_SCENE },`; in the existing effect that updates `uOpacity`/`uCondense`, add `mat.uniforms.uPlanetWindow.value = planetWindow;` and add `planetWindow` to that effect's dependency array.

- [ ] **Step 6: Turn it on only in Mercury** — in `MercuryCanvas.jsx`, add `planetWindow={1}` to each of `<ParticleFlow>`, `<ThermalFlow>`, `<SedimentFlow>`, `<AtmosphericFlow>`.

- [ ] **Step 7: Run suite + lint**

Run: `npm test && npm run lint`
Expected: PASS / exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/terminal/mercury/planet/planetWindow.js src/terminal/mercury/planet/__tests__/planetWindow.test.js src/terminal/fluid/ParticleFlow.jsx src/terminal/thermal/ThermalFlow.jsx src/terminal/earth/SedimentFlow.jsx src/terminal/air/AtmosphericFlow.jsx src/terminal/mercury/MercuryCanvas.jsx
git commit -m "feat(mercury): geometric window through the aether — halo, not fog over the face

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Look at it (hard rule: screenshot before any theory)

**Files:** none unless defects are found.

- [ ] **Step 1: Start the dev server** — `preview_start` with `{ name: "scale94-dev" }` (port 5174). Resize the tab first (`resize_window` 1600×1000) — the embedded pane cannot boot R3F at 0×0.

- [ ] **Step 2: Navigate to /mercury** — dispatch `g` then `m` as synthetic `KeyboardEvent`s on `window` via `javascript_tool` (computer-tool keys don't reach React), or click the /MERCURY nav button.

- [ ] **Step 3: Check the console** — `read_console_messages` with `onlyErrors: true`. Expected: no `THREE.WebGLProgram` shader errors, no map-load errors. A shader error here means fix `mercuryPlanetShader.js` and re-run Task 4's tests.

- [ ] **Step 4: Screenshot** — expected: enhanced-colour Mercury, gibbous, lit from the left, a crisp terminator with black crater shadows along it, aether reading as a halo around (not over) the face, orbit ring and element handles intact, credit line bottom-right. If the pane won't render R3F, say so and ask the author for a screenshot from their browser — do not substitute pixel statistics.

- [ ] **Step 5: Cross-check the real Sun** — in the console: `(await import('/src/terminal/mercury/planet/mercuryEphemeris.js')).mercuryEphemeris(Date.now())`. Note `subsolarLonDeg`; the terrain facing the Sun should match that longitude on the USGS map (e.g. Caloris ≈ 162°E lit only when the subsolar longitude is within ~90° of it).

- [ ] **Step 6: Hand to the author for tuning** — ask them to view in their real browser (360 Hz panel, QD-OLED) and on their phone, and tune live:

```js
__mercuryTune.planet.exposure = 2.6
__mercuryTune.planet.relief = 16
__mercuryTune.planet.nightFloor = 0.004
__mercuryTune.export()
```

Commit the exported values into `PLANET_TUNE` in `planetLook.js` only after the author exports them.

- [ ] **Step 7: Report** — screenshot + console result + what the author chose. Do not push.

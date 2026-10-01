# /MERCURY phase 3 — the surface: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The transmuted planet behaves like a bead of mercury, and the crust remembers what struck it.
- **Body modes** wobble the silhouette after a strike or a release.
- **Spin flattens** the bead.
- **Capillary ripples** run out from strikes and from the drag point.
- **Element strikes** on the crust leave bright-rayed craters that mature over minutes and heal when the planet melts.

**Architecture:**
- **JS owns every temporal and physical number.** Three pure, unit-tested modules do this:
  - `mercuryWaves.js`: the Rayleigh modes, capillary dispersion, an 8-slot impulse ring buffer, the spin bulge and the drag wake.
  - `mercuryImpacts.js`: where a strike lands, what kind of strike it is, and the crater and ray profiles.
  - `scarMap.js`: a CPU equirect buffer that is stamped, matured and healed, then uploaded as an RGBA8 `DataTexture`.
- **The shader stays stateless.** It reads per-impulse amplitudes and ages, re-intersects the deformed bead radially, tilts the normal for ripples, and adds scar height and ray albedo through the existing `heightAt`.
- **At rest the planet is pixel-identical to phase 2.** Every new term is exactly zero when `uSurfOn = 0` and the scar map is neutral.

**Tech Stack:** three 0.183 `RawShaderMaterial` (GLSL 3), @react-three/fiber, vitest. Constants reach GLSL through `glf()` (`src/terminal/gl/glf.js`).

**Spec:** `docs/superpowers/specs/2026-09-30-mercury-gem-polish-design.md` §5 (`mercuryWaves.js`, `mercuryImpacts.js`, scar map, Events) and §7 phase 3. **Amendment 3** of that file states every convention this plan uses; read it first.

## Global Constraints

- **Branch** `feature/mercury-surface` (off local main `f967c537`). Never push. Never touch `main`.
- **Commit trailer, exactly:** `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Not your own model name.
- **Never stage** `.import-cache.json`, `docs/superpowers/specs/2026-09-25-council-field-accretion-design.md`, `docs/superpowers/plans/2026-10-01-mercury-planet-phase1.md`, `src/terminal/views/manifesto/__tests__/__snapshots__/councilField.test.jsx.snap`, `baseline/*`, `scripts/_*`, `debug_dots*.mjs`, `test-output.txt`, `lookbook/`, or `package-lock.json`. Stage files by explicit path only. Never use `git add -A` or `git add .`.
- **Shader constants:** every physical constant in GLSL is interpolated from its JS owner with `glf()` / `v3()` and pinned by a test (the /ACCRETION pattern). Never hand-type a number that a module owns.
- **No per-frame allocation in `useFrame`:** preallocate the vectors and arrays. A per-event allocation (a strike, or a wake impulse every 0.16 s) is acceptable.
- **Phase-2 pixels unchanged at rest:** when `uSurfOn = 0` and the scar map is neutral, the shader output must equal phase 2 (same expressions, same order where it matters).
- **No derivatives (`dFdx`/`dFdy`/`fwidth`) inside or after a loop with `continue`, or inside non-uniform branches.** All existing derivative calls stay where they are, before `discard`.
- **Lint:** `npm run lint` must stay at 0 errors with warnings ≤ 137 (unchanged). Do not sweep exhaustive-deps.
- **Tests:** `npx vitest run src/terminal/mercury` must be green. The full `npm test` has exactly one pre-existing unrelated failure (`artComposite.test.js` "caps a coarse pointer at 1"); nothing else may fail.
- **Look values are hypotheses.** The new `PLANET_TUNE` knobs (`modeGain`, `waveGain`, `rayGain`) default to 1 and are tuned live by the author.

## File map

| File | Status | Responsibility |
|---|---|---|
| `src/terminal/mercury/planet/mercuryWaves.js` | Create | Bead physics: mode ω/γ, capillary dispersion, impulse ring buffer, per-frame amplitudes, spin bulge, drag wake, JS mirror of the shader shape |
| `src/terminal/mercury/planet/mercuryImpacts.js` | Create | Strike direction, world↔body, local temperature at a point, impact kind, crater height profile, ray pattern |
| `src/terminal/mercury/planet/scarMap.js` | Create | Equirect CPU scar buffer (depth m, ray 0–1) → RGBA8 bytes; stamp, mature, heal |
| `src/terminal/mercury/planet/pickSphere.js` | Create | Pointer NDC → world direction on the bead, or null |
| `src/terminal/mercury/planet/mercuryDrag.js` | Modify | Tracker remembers the pointer NDC and latches a release |
| `src/terminal/mercury/useMercuryDrag.js` | Modify | Feeds client→NDC into the tracker |
| `src/terminal/mercury/planet/planetLook.js` | Modify | `RAY_ALBEDO`; `PLANET_TUNE.modeGain/waveGain/rayGain` |
| `src/terminal/mercury/planet/mercuryPlanetShader.js` | Modify | Scar height + ray albedo; bead shape, re-intersection, shape normal, ripple tilt |
| `src/terminal/mercury/MercuryPlanet.jsx` | Modify | Scar texture, impulses, strikes, wake, uniforms |
| `src/terminal/mercury/MercuryCanvas.jsx` | Modify | Strike queue from the element handles to the planet |
| tests in `src/terminal/mercury/planet/__tests__/` | Create/Modify | One test file per module, plus the shader contract |

Task order: 1 → 2 → 3 → 4 are independent pure modules. Task 5 needs 3. Task 6 needs 1. Task 7 needs everything. Task 8 is the controller's live check.

---

### Task 1: `mercuryWaves.js` — the bead's physics

**Files:**
- Create: `src/terminal/mercury/planet/mercuryWaves.js`
- Test: `src/terminal/mercury/planet/__tests__/mercuryWaves.test.js`

**Interfaces:**
- Consumes: `MAX_OMEGA` from `./mercuryBody` (12 rad/s).
- Produces (Tasks 6 and 7 rely on these exact names):
  - constants `IMPULSE_SLOTS` (8), `SHAPE_MAX` (0.06), `SHAPE_ITERS` (3), `WAVE_KR`, `WAVE_C_PHASE`, `WAVE_C_GROUP`, `WAVE_PACKET_RAD`, `WAVE_SPREAD_FLOOR`, `LIQUID_TAU` (0.5)
  - `createImpulses()` → `{ slots: Array<{active, dir:[x,y,z] (body frame), t0, mode, wave, kind}>, next }`
  - `addImpulse(buf, { dirBody, tS, mode = 0, wave = 0, kind = 'splash' })` → the slot
  - `createImpulseFrame()` → `{ mode: Float32Array(24), wave: Float32Array(16), any: false }`
  - `impulseFrame(buf, tS, { modeScale = 1, waveScale = 1 }, out)` → `out`. Per slot i: `mode[3i..3i+2]` = (a₂, a₃, a₄) as a fraction of R; `wave[2i]` = age in s; `wave[2i+1]` = slope amplitude.
  - `spinBulge(omega /* {x,y,z} or [x,y,z] */, scale, out = [0,1,0,0])` → `[ax, ay, az, a2]`
  - `createWake()`, `wakeImpulse(wake, { tS, dragging, released, ptrOmega, bodyOmega, tau })` → `{ kind, mode, wave } | null`
  - `shapeHeight(x, dirs, modes, bulge)`: the JS mirror of the shader's `shapeH`

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/mercury/planet/__tests__/mercuryWaves.test.js
import { describe, it, expect } from 'vitest';
import {
  MODE_OMEGA, MODE_GAMMA, MODE_WEIGHTS, rayleighOmega, capillaryOmega, DROP_R_M,
  WAVE_KR, WAVE_C_PHASE, WAVE_C_GROUP, IMPULSE_SLOTS, IMPULSE_LIFE_S, WAVE_DAMP_PER_S,
  legendre, dLegendre, modeResponse, createImpulses, addImpulse, createImpulseFrame, impulseFrame,
  spinBulge, BULGE_MAX, SHAPE_MAX, shapeHeight, createWake, wakeImpulse, WAKE_EVERY_S, LIQUID_TAU,
  RELEASE_MODE_AMP, WAKE_WAVE_AMP,
} from '../mercuryWaves';
import { MAX_OMEGA } from '../mercuryBody';

const fib = (n) => Array.from({ length: n }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / n;
  const r = Math.sqrt(1 - y * y);
  const a = i * Math.PI * (3 - Math.sqrt(5));
  return [r * Math.cos(a), y, r * Math.sin(a)];
});

describe('Rayleigh body modes of the bead', () => {
  it('frequency ratios are 1 : 1.936 : 3 (ℓ = 2, 3, 4)', () => {
    expect(MODE_OMEGA[1] / MODE_OMEGA[0]).toBeCloseTo(Math.sqrt(30 / 8), 9);
    expect(MODE_OMEGA[1] / MODE_OMEGA[0]).toBeCloseTo(1.936, 3);
    expect(MODE_OMEGA[2] / MODE_OMEGA[0]).toBeCloseTo(3, 9);
  });

  it('damping ratios are 1 : 2.8 : 5.4 (Lamb)', () => {
    expect(MODE_GAMMA[1] / MODE_GAMMA[0]).toBeCloseTo(2.8, 9);
    expect(MODE_GAMMA[2] / MODE_GAMMA[0]).toBeCloseTo(5.4, 9);
  });

  it('a real 1 cm Hg bead rings at ~16.9 rad/s; shown slowed so ℓ=2 reads in 1.5–3 s', () => {
    expect(rayleighOmega(2, DROP_R_M)).toBeCloseTo(16.93, 1);
    const period = (2 * Math.PI) / MODE_OMEGA[0];
    expect(period).toBeGreaterThan(1.5);
    expect(period).toBeLessThan(3);
  });

  it('an impulse starts at rest, dents inward first, and has decayed by IMPULSE_LIFE_S', () => {
    expect(modeResponse(0, 0)).toBe(0);
    expect(modeResponse(0, 0.05)).toBeLessThan(0);
    expect(Math.abs(modeResponse(0, IMPULSE_LIFE_S))).toBeLessThan(0.01 * MODE_WEIGHTS[0]);
  });
});

describe('capillary ripples', () => {
  it('obey ω² = σk³/ρ: doubling k multiplies ω by 2^1.5', () => {
    expect(capillaryOmega(2000) / capillaryOmega(1000)).toBeCloseTo(2 ** 1.5, 9);
  });

  it('group speed is 1.5 × phase speed; a ring reaches 90° of arc in 0.5–1.5 s', () => {
    expect(WAVE_C_GROUP / WAVE_C_PHASE).toBeCloseTo(1.5, 12);
    const t90 = (Math.PI / 2) / WAVE_C_GROUP;
    expect(t90).toBeGreaterThan(0.5);
    expect(t90).toBeLessThan(1.5);
    expect(WAVE_KR).toBeGreaterThan(8);
  });
});

describe('Legendre polynomials', () => {
  it('match the closed forms and their derivatives match finite differences', () => {
    expect(legendre(2, 1)).toBe(1);
    expect(legendre(3, 1)).toBe(1);
    expect(legendre(4, 1)).toBe(1);
    expect(legendre(2, 0)).toBe(-0.5);
    for (const l of [2, 3, 4]) {
      for (const m of [-0.9, -0.3, 0.2, 0.7]) {
        const fd = (legendre(l, m + 1e-6) - legendre(l, m - 1e-6)) / 2e-6;
        expect(dLegendre(l, m)).toBeCloseTo(fd, 5);
      }
    }
  });
});

describe('impulse ring buffer', () => {
  it('holds IMPULSE_SLOTS impulses and overwrites the oldest', () => {
    const buf = createImpulses();
    expect(buf.slots).toHaveLength(IMPULSE_SLOTS);
    for (let i = 0; i < IMPULSE_SLOTS + 1; i++) addImpulse(buf, { dirBody: [0, 0, 1], tS: i, mode: 0.01 * (i + 1) });
    expect(buf.slots[0].t0).toBe(IMPULSE_SLOTS);
    expect(buf.slots[1].t0).toBe(1);
  });

  it('impulseFrame scales, ages and retires; empty means any = false', () => {
    const buf = createImpulses();
    const out = createImpulseFrame();
    impulseFrame(buf, 0, {}, out);
    expect(out.any).toBe(false);
    addImpulse(buf, { dirBody: [1, 0, 0], tS: 10, mode: 0.03, wave: 0.3, kind: 'splash' });
    impulseFrame(buf, 10.1, { modeScale: 0.5, waveScale: 2 }, out);
    expect(out.any).toBe(true);
    // Float32 storage: compare to 6 digits.
    expect(out.mode[0]).toBeCloseTo(0.03 * 0.5 * modeResponse(0, 0.1), 6);
    expect(out.mode[2]).toBeCloseTo(0.03 * 0.5 * modeResponse(2, 0.1), 6);
    expect(out.wave[0]).toBeCloseTo(0.1, 6);
    expect(out.wave[1]).toBeCloseTo(0.3 * 2 * Math.exp(-WAVE_DAMP_PER_S.splash * 0.1), 6);
    impulseFrame(buf, 10 + IMPULSE_LIFE_S + 0.01, {}, out);
    expect(out.any).toBe(false);
    expect(buf.slots[0].active).toBe(false);
    expect(out.mode[0]).toBe(0);
    expect(out.wave[1]).toBe(0);
  });

  it('a ring on solid/boiling Hg is damped harder than a splash', () => {
    expect(WAVE_DAMP_PER_S.ring).toBeGreaterThan(WAVE_DAMP_PER_S.splash);
  });

  it('a wave packet fades out before it reaches the antipode', () => {
    const buf = createImpulses();
    const out = createImpulseFrame();
    addImpulse(buf, { dirBody: [1, 0, 0], tS: 0, wave: 1 });
    impulseFrame(buf, Math.PI / WAVE_C_GROUP, {}, out);
    expect(out.wave[1]).toBe(0);
  });
});

describe('the bead keeps its volume', () => {
  it('modes and bulge integrate to zero over the sphere (ℓ ≥ 2)', () => {
    const dirs = [[1, 0, 0], [0, 0.6, 0.8], [0, 0, 1], [0, 1, 0], [0.6, 0, -0.8], [0, -1, 0], [-1, 0, 0], [0, 0, -1]];
    const modes = new Float32Array(IMPULSE_SLOTS * 3).map((_, i) => 0.004 * Math.sin(i + 1));
    const pts = fib(20000);
    const mean = pts.reduce((s, x) => s + shapeHeight(x, dirs, modes, [0, 1, 0, -0.01]), 0) / pts.length;
    // An ℓ = 0 (volume) term of this size would give a mean ~4e-3; quadrature noise is ~1e-5.
    expect(Math.abs(mean)).toBeLessThan(1e-4);
  });

  it('shapeHeight is clamped to ±SHAPE_MAX', () => {
    const dirs = Array.from({ length: IMPULSE_SLOTS }, () => [0, 0, 1]);
    const modes = new Float32Array(IMPULSE_SLOTS * 3).fill(1);
    expect(shapeHeight([0, 0, 1], dirs, modes, [0, 1, 0, 0])).toBe(SHAPE_MAX);
  });
});

describe('spin bulge', () => {
  it('is zero when still or solid', () => {
    expect(spinBulge([0, 0, 0], 1)[3]).toBe(0);
    expect(spinBulge([0, 3, 0], 0)[3]).toBe(0);
  });

  it('flattens along the spin axis (a2 < 0 ⇒ poles in, equator out) and saturates at BULGE_MAX', () => {
    const b = spinBulge({ x: 0, y: 2, z: 0 }, 1);
    expect(b.slice(0, 3)).toEqual([0, 1, 0]);
    expect(b[3]).toBeLessThan(0);
    expect(spinBulge([0, MAX_OMEGA, 0], 1)[3]).toBeGreaterThanOrEqual(-BULGE_MAX);
    expect(spinBulge([0, MAX_OMEGA, 0], 1)[3]).toBeLessThan(-0.99 * BULGE_MAX);
    const slow = spinBulge([0, 0.05, 0], 1)[3];
    expect(slow).toBeCloseTo(-(2 / 3) * (0.05 / MODE_OMEGA[0]) ** 2, 4);
  });
});

describe('drag wake', () => {
  it('emits nothing on a solid planet', () => {
    const w = createWake();
    expect(wakeImpulse(w, { tS: 1, dragging: true, released: false, ptrOmega: 5, bodyOmega: 5, tau: LIQUID_TAU - 0.01 })).toBeNull();
  });

  it('emits wake ripples at most every WAKE_EVERY_S while the pointer moves', () => {
    const w = createWake();
    const a = wakeImpulse(w, { tS: 1, dragging: true, released: false, ptrOmega: 100, bodyOmega: 5, tau: 1 });
    expect(a).toEqual({ kind: 'wake', mode: 0, wave: WAKE_WAVE_AMP });
    expect(wakeImpulse(w, { tS: 1 + WAKE_EVERY_S / 2, dragging: true, released: false, ptrOmega: 5, bodyOmega: 5, tau: 1 })).toBeNull();
    expect(wakeImpulse(w, { tS: 1 + WAKE_EVERY_S + 1e-9, dragging: true, released: false, ptrOmega: 5, bodyOmega: 5, tau: 1 })).not.toBeNull();
    expect(wakeImpulse(w, { tS: 9, dragging: true, released: false, ptrOmega: 0, bodyOmega: 5, tau: 1 })).toBeNull();
  });

  it('a release sloshes the body modes in proportion to the spin', () => {
    const w = createWake();
    const r = wakeImpulse(w, { tS: 1, dragging: false, released: true, ptrOmega: 0, bodyOmega: MAX_OMEGA / 2, tau: 1 });
    expect(r).toEqual({ kind: 'ring', mode: RELEASE_MODE_AMP / 2, wave: 0 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryWaves.test.js`
Expected: FAIL (`Failed to resolve import "../mercuryWaves"`).

- [ ] **Step 3: Write the implementation**

```js
// src/terminal/mercury/planet/mercuryWaves.js — the transmuted planet as a bead of mercury.
//
// CONVENTIONS (spec amendment 3), stated so no reader assumes more:
// - The liquid planet is read as a DROP_R_M = 1 cm bead of real Hg (σ, ρ below).
//   Body modes ℓ = 2, 3, 4 use Rayleigh's drop frequencies
//   ω_ℓ² = ℓ(ℓ−1)(ℓ+2)·σ/(ρR³) (ratios 1 : 1.936 : 3) and Lamb's viscous
//   damping ratios γ_ℓ ∝ (ℓ−1)(2ℓ+1) (1 : 2.8 : 5.4).
// - A real bead rings and ripples too fast to see: modes are shown at
//   MODE_PLAYBACK, capillary ripples at WAVE_PLAYBACK. Within each family the
//   physics holds (ratios; ω² = σk³/ρ; group speed = 1.5 × phase speed).
// - Damping is EFFECTIVE (an oxide skin): Hg's bulk viscosity would ring ℓ = 2
//   for minutes. MODE_GAMMA2_PER_S sets ℓ = 2; Lamb's ratios give the rest.
// - Spin bulge: a rotating drop's ℓ = 2 response a₂ = −(2/3)(Ω/ω₂)², soft-capped
//   at BULGE_MAX (past the Rayleigh fission limit a planet does not fission).
// The shader (mercuryPlanetShader.js) reads per-impulse amplitudes from
// impulseFrame and mirrors shapeHeight / legendre exactly; it does no time maths.

import { MAX_OMEGA } from './mercuryBody';

export const HG_SIGMA_N_PER_M = 0.485;
export const HG_RHO_KG_M3 = 13534;
export const DROP_R_M = 0.01;
export const MODE_PLAYBACK = 1 / 6;
export const WAVE_PLAYBACK = 1 / 24;

export const MODE_L = [2, 3, 4];
export const MODE_GAMMA2_PER_S = 0.8;
export const MODE_WEIGHTS = [1, 0.6, 0.35];  // how an impulse shares itself across ℓ = 2, 3, 4

export const IMPULSE_SLOTS = 8;
export const IMPULSE_LIFE_S = 6;              // ℓ = 2 is below 1 % by then
export const SHAPE_MAX = 0.06;                // |h| cap, fraction of R; the impostor quad has this margin
export const SHAPE_ITERS = 3;                 // radial re-intersection steps in the shader
export const BULGE_MAX = 0.04;

export const WAVE_KR = 24;                    // packet centre wavenumber × R (wavelength ≈ 0.26 R)
export const WAVE_PACKET_RAD = 0.35;          // packet envelope half-width, radians of arc
export const WAVE_SPREAD_FLOOR = 0.15;        // 1/√sinθ spreading, normalised to 1 inside this
export const WAVE_DAMP_PER_S = { splash: 1.0, wake: 1.6, ring: 3.0 };

export const LIQUID_TAU = 0.5;                // the bead is "liquid" for strikes and wakes above this τ
export const WAKE_EVERY_S = 0.16;
export const WAKE_WAVE_AMP = 0.12;
export const WAKE_FULL_OMEGA = 6;             // pointer ω (rad/s) for a full-strength wake
export const RELEASE_MODE_AMP = 0.03;

export function rayleighOmega(l, rM = DROP_R_M) {
  return Math.sqrt((l * (l - 1) * (l + 2) * HG_SIGMA_N_PER_M) / (HG_RHO_KG_M3 * rM ** 3));
}

export function capillaryOmega(kPerM) {
  return Math.sqrt((HG_SIGMA_N_PER_M * kPerM ** 3) / HG_RHO_KG_M3);
}

export const MODE_OMEGA = MODE_L.map((l) => MODE_PLAYBACK * rayleighOmega(l));
export const MODE_GAMMA = MODE_L.map((l) => (MODE_GAMMA2_PER_S * (l - 1) * (2 * l + 1)) / 5);

// Phase and group speed in radians of arc per second (ω/k divided by R).
export const WAVE_C_PHASE = (WAVE_PLAYBACK * capillaryOmega(WAVE_KR / DROP_R_M)) / WAVE_KR;
export const WAVE_C_GROUP = 1.5 * WAVE_C_PHASE;

export function legendre(l, m) {
  if (l === 2) return 0.5 * (3 * m * m - 1);
  if (l === 3) return 0.5 * (5 * m * m * m - 3 * m);
  const m2 = m * m;
  return 0.125 * (35 * m2 * m2 - 30 * m2 + 3);
}

export function dLegendre(l, m) {
  if (l === 2) return 3 * m;
  if (l === 3) return 0.5 * (15 * m * m - 3);
  return 0.5 * (35 * m * m * m - 15 * m);
}

// Mode j (0 → ℓ=2) of a unit impulse at age t: a dent first, then rebound, decaying.
export function modeResponse(j, ageS) {
  return -MODE_WEIGHTS[j] * Math.exp(-MODE_GAMMA[j] * ageS) * Math.sin(MODE_OMEGA[j] * ageS);
}

export function createImpulses() {
  return {
    slots: Array.from({ length: IMPULSE_SLOTS }, () => ({ active: false, dir: [0, 0, 1], t0: 0, mode: 0, wave: 0, kind: 'splash' })),
    next: 0,
  };
}

export function addImpulse(buf, { dirBody, tS, mode = 0, wave = 0, kind = 'splash' }) {
  const s = buf.slots[buf.next];
  s.active = true;
  s.dir[0] = dirBody[0]; s.dir[1] = dirBody[1]; s.dir[2] = dirBody[2];
  s.t0 = tS;
  s.mode = mode;
  s.wave = wave;
  s.kind = kind;
  buf.next = (buf.next + 1) % IMPULSE_SLOTS;
  return s;
}

export function createImpulseFrame() {
  return { mode: new Float32Array(IMPULSE_SLOTS * 3), wave: new Float32Array(IMPULSE_SLOTS * 2), any: false };
}

const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// The ripple must not refocus at the antipode: fade as its centre nears it.
const antipodeFade = (ageS) => 1 - smoothstep(0.75 * Math.PI, Math.PI, WAVE_C_GROUP * ageS);

export function impulseFrame(buf, tS, { modeScale = 1, waveScale = 1 } = {}, out) {
  out.any = false;
  for (let i = 0; i < IMPULSE_SLOTS; i++) {
    const s = buf.slots[i];
    const age = tS - s.t0;
    if (s.active && age > IMPULSE_LIFE_S) s.active = false;
    if (!s.active || age < 0) {
      out.mode[3 * i] = 0; out.mode[3 * i + 1] = 0; out.mode[3 * i + 2] = 0;
      out.wave[2 * i] = 0; out.wave[2 * i + 1] = 0;
      continue;
    }
    for (let j = 0; j < 3; j++) out.mode[3 * i + j] = s.mode * modeScale * modeResponse(j, age);
    const waveAmp = s.wave * waveScale * Math.exp(-WAVE_DAMP_PER_S[s.kind] * age) * antipodeFade(age);
    out.wave[2 * i] = age;
    out.wave[2 * i + 1] = waveAmp;
    if (Math.abs(out.mode[3 * i]) + Math.abs(out.mode[3 * i + 1]) + Math.abs(out.mode[3 * i + 2]) + waveAmp > 1e-5) out.any = true;
  }
  return out;
}

export function spinBulge(omega, scale, out = [0, 1, 0, 0]) {
  const wx = omega.x ?? omega[0], wy = omega.y ?? omega[1], wz = omega.z ?? omega[2];
  const W = Math.hypot(wx, wy, wz);
  if (W < 1e-6 || !(scale > 0)) {
    out[0] = 0; out[1] = 1; out[2] = 0; out[3] = 0;
    return out;
  }
  const x = (2 / 3) * (W / MODE_OMEGA[0]) ** 2;
  out[0] = wx / W; out[1] = wy / W; out[2] = wz / W;
  out[3] = -scale * BULGE_MAX * (1 - Math.exp(-x / BULGE_MAX));
  return out;
}

// JS mirror of the shader's shapeH (world-frame unit x; dirs world-frame).
export function shapeHeight(x, dirs, modes, bulge) {
  const mb = x[0] * bulge[0] + x[1] * bulge[1] + x[2] * bulge[2];
  let h = bulge[3] * legendre(2, mb);
  for (let i = 0; i < IMPULSE_SLOTS; i++) {
    const d = dirs[i];
    const m = x[0] * d[0] + x[1] * d[1] + x[2] * d[2];
    h += modes[3 * i] * legendre(2, m) + modes[3 * i + 1] * legendre(3, m) + modes[3 * i + 2] * legendre(4, m);
  }
  return Math.min(SHAPE_MAX, Math.max(-SHAPE_MAX, h));
}

export function createWake() {
  return { lastS: -Infinity };
}

// What the drag does to the liquid this frame: a ring of ripples from the drag
// point every WAKE_EVERY_S while the pointer moves, and a slosh of the body
// modes on release. Nothing while the planet is crust.
export function wakeImpulse(wake, { tS, dragging, released, ptrOmega, bodyOmega, tau }) {
  if (tau < LIQUID_TAU) return null;
  if (released) return { kind: 'ring', mode: RELEASE_MODE_AMP * Math.min(1, bodyOmega / MAX_OMEGA), wave: 0 };
  if (!dragging || !(ptrOmega > 0) || tS - wake.lastS < WAKE_EVERY_S) return null;
  wake.lastS = tS;
  return { kind: 'wake', mode: 0, wave: WAKE_WAVE_AMP * Math.min(1, ptrOmega / WAKE_FULL_OMEGA) };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryWaves.test.js`
Expected: PASS. If the wave-crossing range fails, the constants were mistyped: with `WAVE_KR` 24 and `WAVE_PLAYBACK` 1/24, `WAVE_C_GROUP` ≈ 1.83 rad/s, so t90 ≈ 0.86 s. Do not change the test bounds.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/planet/mercuryWaves.js src/terminal/mercury/planet/__tests__/mercuryWaves.test.js
git commit -m "feat(mercury): the bead's physics — Rayleigh modes, capillary ripples, impulse buffer, spin bulge, drag wake

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `mercuryImpacts.js` — where a strike lands and what it leaves

**Files:**
- Create: `src/terminal/mercury/planet/mercuryImpacts.js`
- Test: `src/terminal/mercury/planet/__tests__/mercuryImpacts.test.js`

**Interfaces:**
- Consumes: `surfaceTempK`, `hgPhase` from `./mercuryThermal`; `LIQUID_TAU` from `./mercuryWaves`. Task 1 must be committed first.
- Produces:
  - `IMPACT_TILT_DEG` (40), `CRATER_RADIUS_RAD` (0.08), `CRATER_DEPTH_M` (3000), `CRATER_RIM_M` (900), `RAY_REACH` (5)
  - `IMPACT_MODE_AMP`, `IMPACT_WAVE_AMP`: objects keyed by `'splash' | 'ring' | 'crater'`
  - `strikeDirWorld(nodePos, camPos, out = [0,0,0])` → unit world direction
  - `worldToBody(dir, q, out = [0,0,0])`, `bodyToWorld(dir, q, out = [0,0,0])`; `q` is a `THREE.Quaternion` (body → world, the same as `mercuryBody.q`)
  - `localTempK(dirBody, sunBody, tssK, heatK)` → K, the same as the shader's per-fragment temperature
  - `impactKind(tau, tempK)` → `'crater' | 'splash' | 'ring'`
  - `craterHeightM(s)`: height in true metres at s = θ/`CRATER_RADIUS_RAD`
  - `makeRays(seed)` → `Array<{ phi, len, gain }>`
  - `rayBrightness(s, phi, rays)` → 0–1

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/mercury/planet/__tests__/mercuryImpacts.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  IMPACT_TILT_DEG, CRATER_DEPTH_M, CRATER_RIM_M, RAY_REACH, IMPACT_MODE_AMP, IMPACT_WAVE_AMP,
  strikeDirWorld, worldToBody, bodyToWorld, localTempK, impactKind, craterHeightM, makeRays, rayBrightness,
  RAY_COUNT_MIN, RAY_COUNT_MAX,
} from '../mercuryImpacts';
import { surfaceTempK } from '../mercuryThermal';

const DEG = Math.PI / 180;

describe('strikeDirWorld', () => {
  it('lands IMPACT_TILT_DEG from the node toward the viewer', () => {
    const cam = [0, 0, 3.6];
    const d = strikeDirWorld([1.4, 0, 0], cam);
    expect(d[0]).toBeCloseTo(Math.cos(IMPACT_TILT_DEG * DEG), 9);
    expect(d[1]).toBeCloseTo(0, 9);
    expect(d[2]).toBeCloseTo(Math.sin(IMPACT_TILT_DEG * DEG), 9);
    const up = strikeDirWorld([0, 1.4, 0], cam);
    expect(up[1]).toBeCloseTo(Math.cos(IMPACT_TILT_DEG * DEG), 9);
    expect(Math.hypot(...up)).toBeCloseTo(1, 12);
  });

  it('falls back to the node direction if the node is in line with the camera', () => {
    expect(strikeDirWorld([0, 0, 2], [0, 0, 3.6])).toEqual([0, 0, 1]);
  });
});

describe('frames', () => {
  it('worldToBody inverts bodyToWorld (and matches the shader: body = Mᵀ·world)', () => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, -1.1, 0.7));
    const v = [0.2, -0.5, 0.84];
    const back = worldToBody(bodyToWorld(v, q), q);
    for (let i = 0; i < 3; i++) expect(back[i]).toBeCloseTo(v[i], 12);
    const M = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q));
    const w = new THREE.Vector3(...v).applyMatrix3(M.clone().transpose());
    const b = worldToBody(v, q);
    expect(b[0]).toBeCloseTo(w.x, 12);
    expect(b[1]).toBeCloseTo(w.y, 12);
    expect(b[2]).toBeCloseTo(w.z, 12);
  });
});

describe('localTempK', () => {
  it('is the subsolar temperature (plus spin heat) under the Sun', () => {
    const sun = [Math.cos(0.4), 0, -Math.sin(0.4)];
    expect(localTempK(sun, sun, 600, 20)).toBeCloseTo(surfaceTempK(1, 0, 1, 600, 20), 9);
  });

  it('is night-cold at the antisolar point', () => {
    expect(localTempK([-1, 0, 0], [1, 0, 0], 600, 0)).toBeLessThan(200);
  });
});

describe('impactKind', () => {
  it('crust → crater; liquid → splash; solid or boiling Hg → damped ring', () => {
    expect(impactKind(0.2, 400)).toBe('crater');
    expect(impactKind(1, 400)).toBe('splash');
    expect(impactKind(1, 150)).toBe('ring');
    expect(impactKind(1, 700)).toBe('ring');
    expect(IMPACT_MODE_AMP.crater).toBe(0);
    expect(IMPACT_WAVE_AMP.crater).toBe(0);
    expect(IMPACT_WAVE_AMP.splash).toBeGreaterThan(IMPACT_WAVE_AMP.ring);
  });
});

describe('crater profile', () => {
  it('a bowl CRATER_DEPTH_M deep, continuous at the rim, fading to zero far out', () => {
    expect(craterHeightM(0)).toBe(-CRATER_DEPTH_M);
    expect(craterHeightM(1 - 1e-9)).toBeCloseTo(CRATER_RIM_M, 3);
    expect(craterHeightM(1 + 1e-9)).toBeCloseTo(CRATER_RIM_M, 3);
    expect(Math.abs(craterHeightM(2.5))).toBeLessThan(0.01 * CRATER_RIM_M);
  });
});

describe('rays', () => {
  it('are deterministic per seed with RAY_COUNT_MIN..MAX rays', () => {
    expect(makeRays(7)).toEqual(makeRays(7));
    expect(makeRays(7)).not.toEqual(makeRays(8));
    for (let s = 0; s < 20; s++) {
      const n = makeRays(s).length;
      expect(n).toBeGreaterThanOrEqual(RAY_COUNT_MIN);
      expect(n).toBeLessThanOrEqual(RAY_COUNT_MAX);
    }
  });

  it('fresh inside, brighter along a ray than between rays, gone past RAY_REACH, never above 1', () => {
    const rays = [{ phi: 0, len: 1.5, gain: 1 }];
    expect(rayBrightness(0.5, 1, rays)).toBe(1);
    expect(rayBrightness(2.5, 0, rays)).toBeGreaterThan(rayBrightness(2.5, Math.PI, rays) + 0.2);
    expect(rayBrightness(RAY_REACH + 0.01, 0, rays)).toBe(0);
    for (let s = 0; s <= RAY_REACH; s += 0.1) {
      for (let p = -Math.PI; p < Math.PI; p += 0.2) expect(rayBrightness(s, p, makeRays(3))).toBeLessThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryImpacts.test.js`
Expected: FAIL (`Failed to resolve import "../mercuryImpacts"`).

- [ ] **Step 3: Write the implementation**

```js
// src/terminal/mercury/planet/mercuryImpacts.js — the element strikes.
//
// A tapped element strikes the planet (spec §5 Events). CHOSEN (amendment 3):
// the nodes sit on the limb plane, so a true sub-node impact is always edge-on;
// the strike lands IMPACT_TILT_DEG from the node toward the viewer, on the
// node's side of the visible face. On crust it leaves a crater with bright
// rays (scarMap.js); on liquid Hg a splash; on solid or boiling Hg a damped
// ring (mercuryWaves.js). Crater scale is artistic (~195 km radius) so it
// reads on a ~200 px disc.

import * as THREE from 'three';
import { surfaceTempK, hgPhase } from './mercuryThermal';
import { LIQUID_TAU } from './mercuryWaves';

export const IMPACT_TILT_DEG = 40;
export const CRATER_RADIUS_RAD = 0.08;
export const CRATER_DEPTH_M = 3000;     // true metres; the shader's uRelief exaggerates like the DEM
export const CRATER_RIM_M = 900;
export const EJECTA_DECAY = 0.3;        // rim → blanket e-fold, in crater radii
export const RAY_REACH = 5;             // rays end here, in crater radii
export const RAY_COUNT_MIN = 7;
export const RAY_COUNT_MAX = 12;
export const RAY_WIDTH = 0.25;          // ray half-width across, in crater radii (roughly constant along it)
export const HALO_DECAY = 0.5;          // continuous bright ejecta halo e-fold, in crater radii

export const IMPACT_MODE_AMP = { splash: 0.035, ring: 0.015, crater: 0 };
export const IMPACT_WAVE_AMP = { splash: 0.35, ring: 0.2, crater: 0 };

const DEG = Math.PI / 180;
const TAU = 2 * Math.PI;

export function strikeDirWorld(nodePos, camPos, out = [0, 0, 0]) {
  const nl = Math.hypot(nodePos[0], nodePos[1], nodePos[2]);
  const n = [nodePos[0] / nl, nodePos[1] / nl, nodePos[2] / nl];
  const cl = Math.hypot(camPos[0], camPos[1], camPos[2]);
  const v = [camPos[0] / cl, camPos[1] / cl, camPos[2] / cl];
  const nv = n[0] * v[0] + n[1] * v[1] + n[2] * v[2];
  const u = [v[0] - n[0] * nv, v[1] - n[1] * nv, v[2] - n[2] * nv];
  const ul = Math.hypot(u[0], u[1], u[2]);
  if (ul < 1e-6) {
    out[0] = n[0]; out[1] = n[1]; out[2] = n[2];
    return out;
  }
  const c = Math.cos(IMPACT_TILT_DEG * DEG), s = Math.sin(IMPACT_TILT_DEG * DEG);
  for (let i = 0; i < 3; i++) out[i] = n[i] * c + (u[i] / ul) * s;
  return out;
}

const _v = new THREE.Vector3();
const _qi = new THREE.Quaternion();

export function bodyToWorld(dir, q, out = [0, 0, 0]) {
  _v.set(dir[0], dir[1], dir[2]).applyQuaternion(q);
  out[0] = _v.x; out[1] = _v.y; out[2] = _v.z;
  return out;
}

export function worldToBody(dir, q, out = [0, 0, 0]) {
  _v.set(dir[0], dir[1], dir[2]).applyQuaternion(_qi.copy(q).invert());
  out[0] = _v.x; out[1] = _v.y; out[2] = _v.z;
  return out;
}

// The shader's per-fragment temperature at a body-frame direction, exactly
// (lonSun guard, GLSL mod for lonRel).
export function localTempK(d, sun, tssK, heatK) {
  const mu0 = d[0] * sun[0] + d[1] * sun[1] + d[2] * sun[2];
  const lon = Math.atan2(-d[2], d[0]);
  const lonSun = Math.hypot(sun[0], sun[2]) > 1e-4 ? Math.atan2(-sun[2], sun[0]) : 0;
  const x = lon - lonSun + Math.PI;
  const lonRel = x - TAU * Math.floor(x / TAU) - Math.PI;
  const cosLat = Math.cos(Math.asin(Math.max(-1, Math.min(1, d[1]))));
  return surfaceTempK(mu0, lonRel, cosLat, tssK, heatK);
}

export function impactKind(tau, tempK) {
  if (tau < LIQUID_TAU) return 'crater';
  return hgPhase(tempK) === 'liquid' ? 'splash' : 'ring';
}

// s = θ / CRATER_RADIUS_RAD. A parabolic bowl rising to a raised rim, then an
// ejecta blanket falling off outside.
export function craterHeightM(s) {
  if (s < 1) return -CRATER_DEPTH_M * (1 - s * s) + CRATER_RIM_M * s ** 4;
  return CRATER_RIM_M * Math.exp(-(s - 1) / EJECTA_DECAY);
}

// mulberry32: a tiny seeded PRNG so a crater's rays are reproducible.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRays(seed) {
  const r = rng(seed * 2654435761 + 1);
  const n = RAY_COUNT_MIN + Math.floor(r() * (RAY_COUNT_MAX - RAY_COUNT_MIN + 1));
  return Array.from({ length: n }, () => ({ phi: r() * TAU - Math.PI, len: 0.8 + 1.2 * r(), gain: 0.5 + 0.5 * r() }));
}

const wrapPi = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);

// Fresh-ray albedo weight at (s, azimuth phi): 1 inside the bowl; outside, a
// continuous halo plus narrow rays of roughly constant width; zero past RAY_REACH.
export function rayBrightness(s, phi, rays) {
  if (s < 1) return 1;
  if (s > RAY_REACH) return 0;
  let a = Math.exp(-(s - 1) / HALO_DECAY);
  for (const ray of rays) {
    const across = (wrapPi(phi - ray.phi) * s) / RAY_WIDTH;
    a += ray.gain * Math.exp(-across * across) * Math.exp(-(s - 1) / ray.len);
  }
  const end = 1 - Math.min(1, Math.max(0, (s - 0.8 * RAY_REACH) / (0.2 * RAY_REACH)));
  return Math.min(1, a) * end;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryImpacts.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/planet/mercuryImpacts.js src/terminal/mercury/planet/__tests__/mercuryImpacts.test.js
git commit -m "feat(mercury): element strikes — landing point, impact kind, crater profile, rays

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `scarMap.js` — the crust remembers

**Files:**
- Create: `src/terminal/mercury/planet/scarMap.js`
- Test: `src/terminal/mercury/planet/__tests__/scarMap.test.js`

**Interfaces:**
- Consumes (Task 2): `CRATER_RADIUS_RAD`, `RAY_REACH`, `craterHeightM`, `makeRays`, `rayBrightness`. From `./planetFrame`: `lonLatFromDir`, `uvFromLonLat` (tests only).
- Produces:
  - `SCAR_W` (1024), `SCAR_H` (512), `SCAR_DEPTH_RANGE_M` (4000), `RAY_MATURE_S` (180), `SCAR_TICK_S` (1)
  - `createScarMap(w = SCAR_W, h = SCAR_H)` → `{ w, h, depth: Float32Array, ray: Float32Array, bytes: Uint8Array(w*h*4), live, rayLive }`
  - `texelDir(map, ix, iy, out = [0,0,0])` → body-frame unit direction of the texel centre
  - `stampCrater(map, dirBody, seed)` → number of texels touched
  - `matureScars(map, dtS)` → `true` if the bytes changed
  - `healScars(map)` → `true` if the bytes changed
- Byte encoding (Task 5's shader decodes it): `R = round(128 + clamp(depth / SCAR_DEPTH_RANGE_M, −1, 1) · 127)`, `G = round(clamp(ray, 0, 1) · 255)`, `B = 0`, `A = 255`. Row `iy` holds v = (iy + 0.5)/h (texture `flipY = false`). Column `ix` holds u = (ix + 0.5)/w. This matches the shader's `uv = (fract(lon/TAU), 0.5 + lat/PI)`.

- [ ] **Step 1: Write the failing test**

```js
// src/terminal/mercury/planet/__tests__/scarMap.test.js
import { describe, it, expect } from 'vitest';
import {
  createScarMap, texelDir, stampCrater, matureScars, healScars, SCAR_DEPTH_RANGE_M, RAY_MATURE_S,
} from '../scarMap';
import { CRATER_DEPTH_M, CRATER_RADIUS_RAD, RAY_REACH } from '../mercuryImpacts';
import { dirFromLonLat, lonLatFromDir, uvFromLonLat } from '../planetFrame';

const idx = (m, ix, iy) => iy * m.w + ix;
const nearest = (m, d) => {
  const { lonDeg, latDeg } = lonLatFromDir(d);
  const [u, v] = uvFromLonLat(lonDeg, latDeg);
  return [Math.min(m.w - 1, Math.floor(u * m.w)), Math.min(m.h - 1, Math.floor(v * m.h))];
};

describe('scar map', () => {
  it('texelDir mirrors the shader uv mapping', () => {
    const m = createScarMap(256, 128);
    for (const [ix, iy] of [[0, 0], [17, 90], [255, 127], [128, 64]]) {
      const { lonDeg, latDeg } = lonLatFromDir(texelDir(m, ix, iy));
      const [u, v] = uvFromLonLat(lonDeg, latDeg);
      expect(u).toBeCloseTo((ix + 0.5) / m.w, 9);
      expect(v).toBeCloseTo((iy + 0.5) / m.h, 9);
    }
  });

  it('starts neutral: R 128, G 0, A 255, nothing live', () => {
    const m = createScarMap(64, 32);
    expect(m.live).toBe(false);
    for (let i = 0; i < m.w * m.h; i++) {
      expect(m.bytes[4 * i]).toBe(128);
      expect(m.bytes[4 * i + 1]).toBe(0);
      expect(m.bytes[4 * i + 3]).toBe(255);
    }
  });

  it('stamps a bowl and fresh rays, encoded into the bytes, and nothing beyond the ray reach', () => {
    const m = createScarMap();
    const d = dirFromLonLat(40, 10);
    expect(stampCrater(m, d, 1)).toBeGreaterThan(100);
    const [cx, cy] = nearest(m, d);
    const i = idx(m, cx, cy);
    expect(m.depth[i]).toBeLessThan(-0.95 * CRATER_DEPTH_M);
    expect(m.ray[i]).toBe(1);
    expect(m.bytes[4 * i]).toBe(Math.round(128 + (m.depth[i] / SCAR_DEPTH_RANGE_M) * 127));
    expect(m.bytes[4 * i + 1]).toBe(255);
    const far = dirFromLonLat(40 + (RAY_REACH * CRATER_RADIUS_RAD * 1.2 * 180) / Math.PI / Math.cos(10 * Math.PI / 180), 10);
    const [fx, fy] = nearest(m, far);
    expect(m.depth[idx(m, fx, fy)]).toBe(0);
    expect(m.ray[idx(m, fx, fy)]).toBe(0);
    expect(m.live).toBe(true);
  });

  it('a new crater overprints the old one instead of digging twice as deep', () => {
    const m = createScarMap();
    const d = dirFromLonLat(200, -20);
    stampCrater(m, d, 1);
    stampCrater(m, d, 2);
    const [cx, cy] = nearest(m, d);
    expect(m.depth[idx(m, cx, cy)]).toBeGreaterThan(-1.05 * CRATER_DEPTH_M);
  });

  it('wraps across the 0/360° seam and survives the pole', () => {
    const m = createScarMap();
    stampCrater(m, dirFromLonLat(0.5, 0), 3);
    const row = Math.floor(m.h / 2);
    expect(m.depth[idx(m, 0, row)]).toBeLessThan(0);
    expect(m.depth[idx(m, m.w - 1, row)]).toBeLessThan(0);
    expect(() => stampCrater(m, dirFromLonLat(10, 87), 4)).not.toThrow();
    expect(m.ray[idx(m, 0, m.h - 1)]).toBeGreaterThan(0);
  });

  it('rays mature by exp(-dt/RAY_MATURE_S); depth stays; nothing to do when no rays are live', () => {
    const m = createScarMap();
    const d = dirFromLonLat(100, 0);
    stampCrater(m, d, 5);
    const [cx, cy] = nearest(m, d);
    const i = idx(m, cx, cy);
    const depth = m.depth[i];
    expect(matureScars(m, 60)).toBe(true);
    expect(m.ray[i]).toBeCloseTo(Math.exp(-60 / RAY_MATURE_S), 5);
    expect(m.depth[i]).toBe(depth);
    expect(m.bytes[4 * i + 1]).toBe(Math.round(m.ray[i] * 255));
    expect(matureScars(createScarMap(32, 16), 60)).toBe(false);
  });

  it('heals completely, once', () => {
    const m = createScarMap(256, 128);
    stampCrater(m, dirFromLonLat(10, 10), 6);
    expect(healScars(m)).toBe(true);
    expect(m.live).toBe(false);
    expect(m.depth.every((x) => x === 0)).toBe(true);
    expect(m.ray.every((x) => x === 0)).toBe(true);
    expect(m.bytes[0]).toBe(128);
    expect(healScars(m)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/scarMap.test.js`
Expected: FAIL (`Failed to resolve import "../scarMap"`).

- [ ] **Step 3: Write the implementation**

```js
// src/terminal/mercury/planet/scarMap.js — the crust remembers what struck it.
//
// An equirect buffer in the BODY frame (it turns with the planet), mirroring
// the shader's uv: u = fract(lon / 2π), v = 0.5 + lat / π, row iy at
// v = (iy + 0.5) / h. Depth is in TRUE metres (the shader applies uRelief like
// the DEM). Fresh rays mature to background (space weathering, sped up to
// minutes); depth stays until the planet melts, which heals everything.
// Float32 master values, RGBA8 bytes for the GPU: R = 128 ± 127 · depth/range,
// G = ray · 255.

import { CRATER_RADIUS_RAD, RAY_REACH, craterHeightM, makeRays, rayBrightness } from './mercuryImpacts';

export const SCAR_W = 1024;
export const SCAR_H = 512;
export const SCAR_DEPTH_RANGE_M = 4000;
export const RAY_MATURE_S = 180;
export const SCAR_TICK_S = 1;
const DEPTH_REACH = 2.5;   // crater radii; the ejecta blanket is < 1 % of the rim beyond this
const RAY_FLOOR = 1 / 512;

export function createScarMap(w = SCAR_W, h = SCAR_H) {
  const bytes = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    bytes[4 * i] = 128;
    bytes[4 * i + 3] = 255;
  }
  return { w, h, depth: new Float32Array(w * h), ray: new Float32Array(w * h), bytes, live: false, rayLive: false };
}

export function texelDir(map, ix, iy, out = [0, 0, 0]) {
  const lon = ((ix + 0.5) / map.w) * 2 * Math.PI;
  const lat = ((iy + 0.5) / map.h - 0.5) * Math.PI;
  const c = Math.cos(lat);
  out[0] = c * Math.cos(lon);
  out[1] = Math.sin(lat);
  out[2] = -c * Math.sin(lon);
  return out;
}

function encode(map, i) {
  const d = Math.max(-1, Math.min(1, map.depth[i] / SCAR_DEPTH_RANGE_M));
  map.bytes[4 * i] = Math.round(128 + d * 127);
  map.bytes[4 * i + 1] = Math.round(Math.max(0, Math.min(1, map.ray[i])) * 255);
}

const smooth01 = (x) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

const _x = [0, 0, 0];

export function stampCrater(map, d, seed) {
  const rays = makeRays(seed);
  const thMax = CRATER_RADIUS_RAD * RAY_REACH;
  const cosMax = Math.cos(thMax);
  // Tangent frame at the impact point for the ray azimuth.
  let ex = -d[2], ez = d[0];                       // cross(d, +Y): an east-ish tangent
  let el = Math.hypot(ex, ez);
  if (el < 1e-6) { ex = 1; ez = 0; el = 1; }
  const e = [ex / el, 0, ez / el];
  const n = [d[1] * e[2], d[2] * e[0] - d[0] * e[2], -d[1] * e[0]]; // cross(d, e)

  const lat0 = Math.asin(Math.max(-1, Math.min(1, d[1])));
  const lon0 = Math.atan2(-d[2], d[0]);
  const latLo = Math.max(-Math.PI / 2, lat0 - thMax), latHi = Math.min(Math.PI / 2, lat0 + thMax);
  const y0 = Math.max(0, Math.floor((latLo / Math.PI + 0.5) * map.h));
  const y1 = Math.min(map.h - 1, Math.ceil((latHi / Math.PI + 0.5) * map.h));
  const polar = Math.abs(lat0) + thMax >= Math.PI / 2 - 1e-6;
  const dLon = polar ? Math.PI : Math.min(Math.PI, thMax / Math.cos(Math.abs(lat0) + thMax));
  const cols = Math.min(map.w, Math.ceil((dLon / Math.PI) * map.w) + 2);
  const xc = Math.floor((((lon0 / (2 * Math.PI)) % 1 + 1) % 1) * map.w);
  const xs = polar ? 0 : xc - Math.ceil(cols / 2);

  let touched = 0;
  for (let iy = y0; iy <= y1; iy++) {
    for (let k = 0; k < (polar ? map.w : cols); k++) {
      const ix = (((xs + k) % map.w) + map.w) % map.w;
      texelDir(map, ix, iy, _x);
      const c = _x[0] * d[0] + _x[1] * d[1] + _x[2] * d[2];
      if (c < cosMax) continue;
      const s = Math.acos(Math.min(1, c)) / CRATER_RADIUS_RAD;
      const i = iy * map.w + ix;
      if (s <= DEPTH_REACH) {
        const over = 1 - smooth01((s - 0.8) / 0.5);  // the new crater erases the old inside its rim
        map.depth[i] = map.depth[i] * (1 - over) + craterHeightM(s);
      }
      const phi = Math.atan2(_x[0] * n[0] + _x[1] * n[1] + _x[2] * n[2], _x[0] * e[0] + _x[1] * e[1] + _x[2] * e[2]);
      const r = rayBrightness(s, phi, rays);
      if (r > map.ray[i]) map.ray[i] = r;
      encode(map, i);
      touched++;
    }
  }
  if (touched > 0) { map.live = true; map.rayLive = true; }
  return touched;
}

export function matureScars(map, dtS) {
  if (!map.rayLive) return false;
  const k = Math.exp(-dtS / RAY_MATURE_S);
  let live = false;
  for (let i = 0; i < map.ray.length; i++) {
    if (map.ray[i] === 0) continue;
    const r = map.ray[i] * k;
    map.ray[i] = r < RAY_FLOOR ? 0 : r;
    if (map.ray[i] > 0) live = true;
    map.bytes[4 * i + 1] = Math.round(map.ray[i] * 255);
  }
  map.rayLive = live;
  return true;
}

export function healScars(map) {
  if (!map.live) return false;
  map.depth.fill(0);
  map.ray.fill(0);
  for (let i = 0; i < map.w * map.h; i++) {
    map.bytes[4 * i] = 128;
    map.bytes[4 * i + 1] = 0;
  }
  map.live = false;
  map.rayLive = false;
  return true;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/scarMap.test.js`
Expected: PASS. If the "far" texel test fails, check the column range (`dLon`/`cols`) first, not the profile.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/planet/scarMap.js src/terminal/mercury/planet/__tests__/scarMap.test.js
git commit -m "feat(mercury): scar map — stamped craters, maturing rays, healed by the melt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Where the pointer touches the bead

**Files:**
- Create: `src/terminal/mercury/planet/pickSphere.js`
- Modify: `src/terminal/mercury/planet/mercuryDrag.js`
- Modify: `src/terminal/mercury/useMercuryDrag.js`
- Test: `src/terminal/mercury/planet/__tests__/pickSphere.test.js`
- Test: `src/terminal/mercury/planet/__tests__/mercuryDrag.test.js` (append)

**Interfaces:**
- Produces:
  - `pickSphereDir(ndc /* [x,y] */, camera, radius, out = [0,0,0])` → unit world direction of the near hit, or `null`
  - Tracker gains `aim(nx, ny)`. `sample()`'s result gains `ndc: [x, y]`, `aimed: boolean` and `released: boolean`. `released` is true on exactly one `sample()` after `up()` ends a drag.

- [ ] **Step 1: Write the failing tests**

```js
// src/terminal/mercury/planet/__tests__/pickSphere.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { pickSphereDir } from '../pickSphere';

function cam() {
  const c = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  c.position.set(0, 0, 3.6);
  c.lookAt(0, 0, 0);
  c.updateMatrixWorld();
  c.updateProjectionMatrix();
  return c;
}

describe('pickSphereDir', () => {
  it('the screen centre touches the front pole', () => {
    const d = pickSphereDir([0, 0], cam(), 0.75);
    expect(d[0]).toBeCloseTo(0, 9);
    expect(d[1]).toBeCloseTo(0, 9);
    expect(d[2]).toBeCloseTo(1, 9);
  });

  it('off-centre hits are unit, on the near side, on the pointer side; misses are null', () => {
    const d = pickSphereDir([0.2, -0.1], cam(), 0.75);
    expect(Math.hypot(...d)).toBeCloseTo(1, 12);
    expect(d[2]).toBeGreaterThan(0);
    expect(d[0]).toBeGreaterThan(0);
    expect(d[1]).toBeLessThan(0);
    expect(pickSphereDir([0.9, 0.9], cam(), 0.75)).toBeNull();
  });
});
```

Append to `src/terminal/mercury/planet/__tests__/mercuryDrag.test.js`:

```js
describe('drag point and release', () => {
  it('remembers the last aim and latches one release per drag', () => {
    const d = createDragTracker();
    expect(d.sample(0).aimed).toBe(false);
    d.down(0, 0, 0);
    d.aim(0.25, -0.5);
    let s = d.sample(1);
    expect(s.aimed).toBe(true);
    expect(s.ndc).toEqual([0.25, -0.5]);
    expect(s.released).toBe(false);
    d.up();
    expect(d.sample(2).released).toBe(true);
    expect(d.sample(3).released).toBe(false);
    d.up(); // a stray up with no drag is not a release
    expect(d.sample(4).released).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/pickSphere.test.js src/terminal/mercury/planet/__tests__/mercuryDrag.test.js`
Expected: FAIL (`pickSphere` is unresolved; `d.aim is not a function`).

- [ ] **Step 3: Implement**

```js
// src/terminal/mercury/planet/pickSphere.js — pointer → the point it touches on the bead.
// The still sphere (radius R_SCENE) is close enough for a drag point.

import * as THREE from 'three';

const _p = new THREE.Vector3();
const _d = new THREE.Vector3();

export function pickSphereDir(ndc, camera, radius, out = [0, 0, 0]) {
  _p.set(ndc[0], ndc[1], 0.5).unproject(camera);
  const o = camera.position;
  _d.copy(_p).sub(o).normalize();
  const b = o.dot(_d);
  const disc = b * b - (o.lengthSq() - radius * radius);
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  out[0] = (o.x + _d.x * t) / radius;
  out[1] = (o.y + _d.y * t) / radius;
  out[2] = (o.z + _d.z * t) / radius;
  return out;
}
```

In `mercuryDrag.js`, replace `createDragTracker` with:

```js
export function createDragTracker() {
  // wx/wy/wT: where and when the current velocity window started.
  const s = { dragging: false, wx: 0, wy: 0, wT: 0, lastMoveMs: 0, omega: ZERO, nx: 0, ny: 0, aimed: false, released: false };
  // One result object, refilled every sample() so the render loop allocates nothing.
  const result = { dragging: false, omegaPtr: [0, 0, 0], ndc: [0, 0], aimed: false, released: false };
  return {
    down(x, y, tMs) {
      Object.assign(s, { dragging: true, wx: x, wy: y, wT: tMs, lastMoveMs: tMs, omega: ZERO });
    },
    move(x, y, tMs, heightPx) {
      if (!s.dragging) return;
      s.lastMoveMs = tMs;
      if (tMs - s.wT < VELOCITY_WINDOW_MS) return;
      s.omega = pointerOmega(x - s.wx, y - s.wy, (tMs - s.wT) / 1000, heightPx);
      Object.assign(s, { wx: x, wy: y, wT: tMs });
    },
    // Where the pointer is, in normalised device coordinates (for the drag point on the bead).
    aim(nx, ny) {
      s.nx = nx;
      s.ny = ny;
      s.aimed = true;
    },
    up() {
      if (s.dragging) s.released = true;
      s.dragging = false;
      s.omega = ZERO;
    },
    sample(nowMs) {
      const live = s.dragging && nowMs - s.lastMoveMs <= POINTER_HOLD_MS;
      result.dragging = s.dragging;
      result.omegaPtr[0] = live ? s.omega[0] : 0;
      result.omegaPtr[1] = live ? s.omega[1] : 0;
      result.omegaPtr[2] = live ? s.omega[2] : 0;
      result.ndc[0] = s.nx;
      result.ndc[1] = s.ny;
      result.aimed = s.aimed;
      result.released = s.released;
      s.released = false;
      return result;
    },
  };
}
```

In `useMercuryDrag.js`, add an `aim` helper inside the effect and call it from `onDown` (after `tracker.down(...)`) and from `onMove` (after the pointer-id guard, before `tracker.move(...)`):

```js
    const aim = (e) => {
      const r = el.getBoundingClientRect();
      tracker.aim(((e.clientX - r.left) / Math.max(r.width, 1)) * 2 - 1, 1 - ((e.clientY - r.top) / Math.max(r.height, 1)) * 2);
    };
```

The resulting handlers:

```js
    const onDown = (e) => {
      if (e.button !== 0 || e.isPrimary === false) return;
      if (activePointerIdRef.current !== null) return; // ignore second pointerdown
      activePointerIdRef.current = e.pointerId;
      el.setPointerCapture?.(e.pointerId);
      el.style.cursor = 'grabbing';
      tracker.down(e.clientX, e.clientY, e.timeStamp);
      aim(e);
    };
    const onMove = (e) => {
      if (e.pointerId !== activePointerIdRef.current) return;
      aim(e);
      tracker.move(e.clientX, e.clientY, e.timeStamp, el.clientHeight);
    };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/pickSphere.test.js src/terminal/mercury/planet/__tests__/mercuryDrag.test.js`
Expected: PASS, including every pre-existing drag test.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/planet/pickSphere.js src/terminal/mercury/planet/mercuryDrag.js src/terminal/mercury/useMercuryDrag.js src/terminal/mercury/planet/__tests__/pickSphere.test.js src/terminal/mercury/planet/__tests__/mercuryDrag.test.js
git commit -m "feat(mercury): the drag point on the bead — pointer NDC, one release latch, sphere pick

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Scars in the shader (height, shadows, fresh rays)

**Files:**
- Modify: `src/terminal/mercury/planet/planetLook.js`
- Modify: `src/terminal/mercury/planet/mercuryPlanetShader.js`
- Modify: `src/terminal/mercury/MercuryPlanet.jsx`
- Test: `src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js` (append)

**Interfaces:**
- Consumes (Task 3): `SCAR_DEPTH_RANGE_M`, `createScarMap`.
- Produces: the uniforms `uScar` (sampler2D) and `uRayGain` (float); `RAY_ALBEDO` in `planetLook.js`; `PLANET_TUNE.rayGain`. `MercuryPlanet.jsx` gains `scar` (the CPU map) and `scarTex` (a `THREE.DataTexture`) via `useMemo`. Task 7 stamps into `scar` and sets `scarTex.needsUpdate = true`.

- [ ] **Step 1: Write the failing test** (append inside the existing `describe` in `mercuryPlanetShader.test.js`; add the imports at the top)

```js
// add to imports:
import { SCAR_DEPTH_RANGE_M } from '../scarMap';
import { RAY_ALBEDO } from '../planetLook';
```

```js
  it('adds the scar map to the terrain height (so craters cast shadows) and fresh rays to the albedo', () => {
    expect(PLANET_UNIFORMS).toEqual(expect.arrayContaining(['uScar', 'uRayGain']));
    expect(PLANET_FS).toContain(`const float SCAR_DEPTH_RANGE_M = ${glf(SCAR_DEPTH_RANGE_M)};`);
    expect(PLANET_FS).toContain(`const vec3 RAY_ALBEDO = ${v3(RAY_ALBEDO)};`);
    expect(PLANET_FS).toContain('return (textureGrad(uScar, vec2(fract(uv.x), uv.y), gx, gy).r * 255.0 - 128.0) / 127.0 * SCAR_DEPTH_RANGE_M;');
    expect(PLANET_FS).toContain('return mix(DEM_MIN_M, DEM_MAX_M, textureGrad(uDem, vec2(fract(uv.x), uv.y), gx, gy).r) + scarHeightM(uv, gx, gy);');
    expect(PLANET_FS).toContain('albedo = mix(albedo, RAY_ALBEDO, clamp(textureGrad(uScar, uv, gx, gy).g * uRayGain, 0.0, 1.0));');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`
Expected: FAIL (`RAY_ALBEDO` is undefined; the shader strings are missing).

- [ ] **Step 3: Implement**

`planetLook.js`: add after `FALLBACK_ALBEDO`:

```js
export const RAY_ALBEDO = [0.42, 0.4, 0.38];  // fresh ejecta (linear): immature regolith is ~2.5× the background
```

and add to `PLANET_TUNE`, after `aetherCore`:

```js
  rayGain: 1,        // fresh crater-ray brightness (scar map G channel)
```

`mercuryPlanetShader.js`:
1. Add the imports: `import { SCAR_DEPTH_RANGE_M } from './scarMap';`, and `RAY_ALBEDO` to the `./planetLook` import list.
2. Append `'uScar', 'uRayGain'` to `PLANET_UNIFORMS`.
3. In `PLANET_FS`, add the uniform declarations after `uniform float uAetherCore;`:

```glsl
uniform sampler2D uScar;
uniform float uRayGain;
```

4. Add the constants after `const vec3 NIGHT_TINT = ${v3(NIGHT_TINT)};`:

```glsl
const float SCAR_DEPTH_RANGE_M = ${glf(SCAR_DEPTH_RANGE_M)};
const vec3 RAY_ALBEDO = ${v3(RAY_ALBEDO)};
```

5. Replace `heightAt` with:

```glsl
// Crater depth from the scar map, true metres (scarMap.js encoding).
float scarHeightM(vec2 uv, vec2 gx, vec2 gy) {
  return (textureGrad(uScar, vec2(fract(uv.x), uv.y), gx, gy).r * 255.0 - 128.0) / 127.0 * SCAR_DEPTH_RANGE_M;
}

float heightAt(vec2 uv, vec2 gx, vec2 gy) {
  return mix(DEM_MIN_M, DEM_MAX_M, textureGrad(uDem, vec2(fract(uv.x), uv.y), gx, gy).r) + scarHeightM(uv, gx, gy);
}
```

6. In `main()`, directly after the closing `}` of the `if (uHasMaps > 0.5) { … }` block that computes `albedo`/`n`, add:

```glsl
  // Fresh crater rays brighten the crust; they mature back to background (scarMap.js).
  albedo = mix(albedo, RAY_ALBEDO, clamp(textureGrad(uScar, uv, gx, gy).g * uRayGain, 0.0, 1.0));
```

A neutral scar map (R = 128, G = 0) adds exactly 0 m and 0 ray, so a fresh planet is unchanged.

`MercuryPlanet.jsx`:
1. Import `createScarMap` from `./planet/scarMap`.
2. Before the `material` `useMemo`, add:

```js
  // The crust's memory (scarMap.js): a CPU buffer uploaded as RGBA8. Neutral = no scars.
  const scar = useMemo(() => createScarMap(), []);
  const scarTex = useMemo(() => {
    const tex = new THREE.DataTexture(scar.bytes, scar.w, scar.h, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.colorSpace = THREE.NoColorSpace;
    tex.flipY = false;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }, [scar]);
  useEffect(() => () => scarTex.dispose(), [scarTex]);
```

3. Add `uScar: { value: scarTex }, uRayGain: { value: PLANET_TUNE.rayGain },` to the uniforms, and add `scarTex` to the material `useMemo` deps: `[isMobile, init, body, scarTex]`.
4. In `useFrame`, next to the other knob reads: `u.uRayGain.value = PLANET_TUNE.rayGain;`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/terminal/mercury`
Expected: PASS (the contract test sees `uScar`/`uRayGain` declared and listed).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/planet/planetLook.js src/terminal/mercury/planet/mercuryPlanetShader.js src/terminal/mercury/MercuryPlanet.jsx src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js
git commit -m "feat(mercury): scars in the shader — crater height in the terrain and its shadows, fresh-ray albedo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The moving bead in the shader (modes, bulge, ripples)

**Files:**
- Modify: `src/terminal/mercury/planet/mercuryPlanetShader.js`
- Modify: `src/terminal/mercury/MercuryPlanet.jsx` (uniform defaults only)
- Test: `src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js` (append)

**Interfaces:**
- Consumes (Task 1): `IMPULSE_SLOTS`, `SHAPE_MAX`, `SHAPE_ITERS`, `WAVE_KR`, `WAVE_C_PHASE`, `WAVE_C_GROUP`, `WAVE_PACKET_RAD`, `WAVE_SPREAD_FLOOR`.
- Produces the uniforms (Task 7 writes them every frame):
  - `uSurfOn` (float, 0/1)
  - `uImpDir[8]` (vec3, world-frame unit)
  - `uImpMode[8]` (vec3: a₂, a₃, a₄)
  - `uImpWave[8]` (vec2: age s, slope amplitude)
  - `uBulge` (vec4: world axis, a₂)

- [ ] **Step 1: Write the failing test** (append inside the `describe`; add the imports)

```js
// add to imports:
import {
  IMPULSE_SLOTS, SHAPE_MAX, SHAPE_ITERS, WAVE_KR, WAVE_C_PHASE, WAVE_C_GROUP, WAVE_PACKET_RAD, WAVE_SPREAD_FLOOR,
} from '../mercuryWaves';
```

```js
  it('moves the bead: modes + bulge reshape the silhouette, ripples tilt the normal; constants from mercuryWaves', () => {
    expect(PLANET_UNIFORMS).toEqual(expect.arrayContaining(['uSurfOn', 'uImpDir', 'uImpMode', 'uImpWave', 'uBulge']));
    expect(PLANET_FS).toContain(`uniform vec3 uImpDir[${IMPULSE_SLOTS}];`);
    expect(PLANET_FS).toContain(`uniform vec3 uImpMode[${IMPULSE_SLOTS}];`);
    expect(PLANET_FS).toContain(`uniform vec2 uImpWave[${IMPULSE_SLOTS}];`);
    expect(PLANET_FS).toContain(`const int IMPULSE_SLOTS = ${IMPULSE_SLOTS};`);
    expect(PLANET_FS).toContain(`const int SHAPE_ITERS = ${SHAPE_ITERS};`);
    for (const [name, value] of Object.entries({ SHAPE_MAX, WAVE_KR, WAVE_C_PHASE, WAVE_C_GROUP, WAVE_PACKET_RAD, WAVE_SPREAD_FLOOR })) {
      expect(PLANET_FS).toContain(`const float ${name} = ${glf(value)};`);
    }
    expect(PLANET_VS).toContain(`const float SHAPE_MAX = ${glf(SHAPE_MAX)};`);
    expect(PLANET_VS).toContain('float rb = R_SCENE * (1.0 + SHAPE_MAX);');
  });

  it('mirrors mercuryWaves: Legendre P2..P4, their derivatives, and shapeHeight', () => {
    expect(PLANET_FS).toContain('float P2(float m) { return 0.5 * (3.0 * m * m - 1.0); }');
    expect(PLANET_FS).toContain('float P3(float m) { return 0.5 * (5.0 * m * m * m - 3.0 * m); }');
    expect(PLANET_FS).toContain('float P4(float m) { float m2 = m * m; return 0.125 * (35.0 * m2 * m2 - 30.0 * m2 + 3.0); }');
    expect(PLANET_FS).toContain('float dP2(float m) { return 3.0 * m; }');
    expect(PLANET_FS).toContain('float dP3(float m) { return 0.5 * (15.0 * m * m - 3.0); }');
    expect(PLANET_FS).toContain('float dP4(float m) { return 0.5 * (35.0 * m * m * m - 15.0 * m); }');
    expect(PLANET_FS).toContain('float h = uBulge.w * P2(dot(x, uBulge.xyz));');
    expect(PLANET_FS).toContain('h += dot(uImpMode[i], vec3(P2(m), P3(m), P4(m)));');
    expect(PLANET_FS).toContain('return clamp(h, -SHAPE_MAX, SHAPE_MAX);');
  });

  it('a still bead is the phase-2 sphere: shape gated by uSurfOn, silhouette from the closest-approach radius', () => {
    expect(PLANET_FS).toContain('if (uSurfOn < 0.5) return 0.0;');
    expect(PLANET_FS).toContain('float rl = R_SCENE * (1.0 + shapeH(pl > 1e-6 ? pc / pl : -rd));');
    expect(PLANET_FS).toContain('float disc = b * b - (dot(ro, ro) - rl * rl);');
    expect(PLANET_FS).toContain('for (int k = 0; k < SHAPE_ITERS; k++) {');
    expect(PLANET_FS).toContain('vec3 ng = normalize(xw - shapeGrad(xw) / (1.0 + shapeH(xw)));');
    expect(PLANET_FS).toContain('vec3 xb = xw * uBodyRot;');
    expect(PLANET_FS).toContain('float lat = asin(clamp(xb.y, -1.0, 1.0));');
    expect(PLANET_FS).toContain('float lon = atan(-xb.z, xb.x);');
  });

  it('the front and temperature follow the material point (xb); the ripples tilt the fluid normal', () => {
    expect(PLANET_FS).toContain('float mu0x = dot(xb, Lb);');
    expect(PLANET_FS).toContain('float front = 1.0 - acos(clamp(mu0x, -1.0, 1.0)) / PI;');
    expect(PLANET_FS).toContain('float edgeN = (vnoise3(xb * FRONT_NOISE_FREQ) - 0.5) * FRONT_EDGE;');
    expect(PLANET_FS).toContain('float T = surfaceTempK(mu0x, lonRel, cos(lat), uSubsolarT, uHeatK);');
    expect(PLANET_FS).toContain('float u = (th - WAVE_C_GROUP * age) / WAVE_PACKET_RAD;');
    expect(PLANET_FS).toContain('float slope = A * exp(-u * u) * sin(WAVE_KR * (th - WAVE_C_PHASE * age)) * sqrt(WAVE_SPREAD_FLOOR / max(s, WAVE_SPREAD_FLOOR));');
    expect(PLANET_FS).toContain('nW = normalize(nW - fluid * waveTilt(xw));');
  });

  it('keeps every derivative before the first loop and the discard', () => {
    const main = PLANET_FS.slice(PLANET_FS.indexOf('void main()'));
    const firstLoop = main.indexOf('for (');
    const lastDeriv = Math.max(main.lastIndexOf('fwidth('), main.lastIndexOf('dFdx('), main.lastIndexOf('dFdy('));
    expect(lastDeriv).toBeLessThan(main.indexOf('discard'));
    // the shape refinement loop is uniform control flow; derivatives may follow it,
    // but none may appear inside helper loops that use continue:
    const waveFn = PLANET_FS.slice(PLANET_FS.indexOf('vec3 waveTilt('), PLANET_FS.indexOf('void main()'));
    expect(waveFn).not.toMatch(/dFd[xy]|fwidth/);
    expect(firstLoop).toBeGreaterThan(-1);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`
Expected: FAIL (the new strings are missing).

- [ ] **Step 3: Implement**

In `mercuryPlanetShader.js`:

1. Imports:

```js
import {
  IMPULSE_SLOTS, SHAPE_MAX, SHAPE_ITERS, WAVE_KR, WAVE_C_PHASE, WAVE_C_GROUP, WAVE_PACKET_RAD, WAVE_SPREAD_FLOOR,
} from './mercuryWaves';
```

2. Append `'uSurfOn', 'uImpDir', 'uImpMode', 'uImpWave', 'uBulge'` to `PLANET_UNIFORMS`.

3. Extend the header comment with one line: `// Phase 3: the transmuted planet is a bead (mercuryWaves.js) — body modes and spin bulge move the silhouette, capillary ripples tilt the normal — and the crust keeps a scar map (scarMap.js).`

4. In `PLANET_VS`, after `const float R_SCENE …;`, add `const float SHAPE_MAX = ${glf(SHAPE_MAX)};`. Replace the `ext` line with:

```glsl
  float rb = R_SCENE * (1.0 + SHAPE_MAX); // room for the moving bead
  float ext = rb * d / sqrt(max(d * d - rb * rb, 1e-4)) * 1.08;
```

5. In `PLANET_FS`, after the `uRayGain` declaration (from Task 5), add:

```glsl
uniform float uSurfOn;
uniform vec3 uImpDir[${IMPULSE_SLOTS}];
uniform vec3 uImpMode[${IMPULSE_SLOTS}];
uniform vec2 uImpWave[${IMPULSE_SLOTS}];
uniform vec4 uBulge;
```

and after the `RAY_ALBEDO` constant:

```glsl
const int IMPULSE_SLOTS = ${IMPULSE_SLOTS};
const int SHAPE_ITERS = ${SHAPE_ITERS};
const float SHAPE_MAX = ${glf(SHAPE_MAX)};
const float WAVE_KR = ${glf(WAVE_KR)};
const float WAVE_C_PHASE = ${glf(WAVE_C_PHASE)};
const float WAVE_C_GROUP = ${glf(WAVE_C_GROUP)};
const float WAVE_PACKET_RAD = ${glf(WAVE_PACKET_RAD)};
const float WAVE_SPREAD_FLOOR = ${glf(WAVE_SPREAD_FLOOR)};
```

6. Add these functions directly before `void main() {`:

```glsl
// The bead (mercuryWaves.js): Legendre modes ℓ = 2, 3, 4 about each impulse
// direction, plus the spin bulge about the spin axis. x is a world-frame unit
// vector; h is a fraction of R, clamped to ±SHAPE_MAX (the quad's margin).
float P2(float m) { return 0.5 * (3.0 * m * m - 1.0); }
float P3(float m) { return 0.5 * (5.0 * m * m * m - 3.0 * m); }
float P4(float m) { float m2 = m * m; return 0.125 * (35.0 * m2 * m2 - 30.0 * m2 + 3.0); }
float dP2(float m) { return 3.0 * m; }
float dP3(float m) { return 0.5 * (15.0 * m * m - 3.0); }
float dP4(float m) { return 0.5 * (35.0 * m * m * m - 15.0 * m); }

float shapeH(vec3 x) {
  if (uSurfOn < 0.5) return 0.0;
  float h = uBulge.w * P2(dot(x, uBulge.xyz));
  for (int i = 0; i < IMPULSE_SLOTS; i++) {
    float m = dot(x, uImpDir[i]);
    h += dot(uImpMode[i], vec3(P2(m), P3(m), P4(m)));
  }
  return clamp(h, -SHAPE_MAX, SHAPE_MAX);
}

// Tangential gradient of shapeH on the unit sphere.
vec3 shapeGrad(vec3 x) {
  if (uSurfOn < 0.5) return vec3(0.0);
  float mb = dot(x, uBulge.xyz);
  vec3 g = uBulge.w * dP2(mb) * (uBulge.xyz - mb * x);
  for (int i = 0; i < IMPULSE_SLOTS; i++) {
    vec3 d = uImpDir[i];
    float m = dot(x, d);
    g += dot(uImpMode[i], vec3(dP2(m), dP3(m), dP4(m))) * (d - m * x);
  }
  return g;
}

// Capillary ripple packets running out from each impulse: a Gaussian envelope
// at the group speed, crests at the phase speed (capillary: crests run
// backward through the packet), 1/√sinθ spreading normalised inside
// WAVE_SPREAD_FLOOR. Returns the tangential slope to subtract from the normal.
// No derivatives in here (it has continue).
vec3 waveTilt(vec3 x) {
  vec3 g = vec3(0.0);
  if (uSurfOn < 0.5) return g;
  for (int i = 0; i < IMPULSE_SLOTS; i++) {
    float A = uImpWave[i].y;
    if (A == 0.0) continue;
    float age = uImpWave[i].x;
    vec3 d = uImpDir[i];
    float m = clamp(dot(x, d), -1.0, 1.0);
    float s = sqrt(max(1.0 - m * m, 0.0));
    if (s < 1e-4) continue;
    float th = acos(m);
    float u = (th - WAVE_C_GROUP * age) / WAVE_PACKET_RAD;
    float slope = A * exp(-u * u) * sin(WAVE_KR * (th - WAVE_C_PHASE * age)) * sqrt(WAVE_SPREAD_FLOOR / max(s, WAVE_SPREAD_FLOOR));
    g += slope * (x * m - d) / s;
  }
  return g;
}
```

7. In `main()`, replace everything from `vec3 ro = cameraPosition;` through `float lon = atan(-nb.z, nb.x);` with:

```glsl
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorld - ro);
  float b = dot(ro, rd);
  // The silhouette: the bead's radius toward the ray's closest approach
  // (exactly R_SCENE when the surface is still, i.e. the phase-2 sphere).
  vec3 pc = ro - rd * b;
  float pl = length(pc);
  float rl = R_SCENE * (1.0 + shapeH(pl > 1e-6 ? pc / pl : -rd));
  float disc = b * b - (dot(ro, ro) - rl * rl);
  float fw = max(fwidth(disc), 1e-6);
  float coverage = clamp(disc / fw + 0.5, 0.0, 1.0);

  // Shade the nearest point even for near-misses so derivatives stay defined
  // across the silhouette; discard only after all dFdx/dFdy calls.
  float t = -b - sqrt(max(disc, 0.0));
  vec3 hit = ro + rd * t;
  // On a moving bead, re-intersect the sphere of the local radius at the hit
  // (radial fixed point; the shape is low-order and ≤ SHAPE_MAX). Uniform branch.
  if (uSurfOn > 0.5) {
    for (int k = 0; k < SHAPE_ITERS; k++) {
      float rk = R_SCENE * (1.0 + shapeH(normalize(hit)));
      t = -b - sqrt(max(b * b - (dot(ro, ro) - rk * rk), 0.0));
      hit = ro + rd * t;
    }
  }
  vec3 xw = normalize(hit);
  vec3 ng = normalize(xw - shapeGrad(xw) / (1.0 + shapeH(xw)));

  // uBodyRot is body → world (mercuryBody.q); v * M = transpose(M) * v.
  // xb: WHERE on the body (maps, front, temperature); nb: which way the surface faces (light).
  vec3 xb = xw * uBodyRot;
  vec3 nb = ng * uBodyRot;
  vec3 Lb = uSunDir * uBodyRot;
  vec3 Vb = -rd * uBodyRot;
  float lat = asin(clamp(xb.y, -1.0, 1.0));
  float lon = atan(-xb.z, xb.x);
```

8. In the transmutation block, replace:

```glsl
    float front = 1.0 - acos(clamp(mu0g, -1.0, 1.0)) / PI;
    float edgeN = (vnoise3(nb * FRONT_NOISE_FREQ) - 0.5) * FRONT_EDGE;
```

with:

```glsl
    float mu0x = dot(xb, Lb);
    float front = 1.0 - acos(clamp(mu0x, -1.0, 1.0)) / PI;
    float edgeN = (vnoise3(xb * FRONT_NOISE_FREQ) - 0.5) * FRONT_EDGE;
```

Then replace `float T = surfaceTempK(mu0g, lonRel, cos(lat), uSubsolarT, uHeatK);` with `float T = surfaceTempK(mu0x, lonRel, cos(lat), uSubsolarT, uHeatK);`.
Then, directly after `vec3 nW = uBodyRot * normalize(mix(n, nb, fluid));`, add:

```glsl
      nW = normalize(nW - fluid * waveTilt(xw));
```

With `uSurfOn = 0`: `rl = R_SCENE`, the loop is skipped, `ng = xw = normalize(hit)`, `xb = nb`, and `waveTilt` returns 0. That is the phase-2 shader.

In `MercuryPlanet.jsx`:
1. Import `IMPULSE_SLOTS` from `./planet/mercuryWaves`.
2. Add these zero-default uniforms (Task 7 drives them):

```js
      uSurfOn: { value: 0 },
      uImpDir: { value: Array.from({ length: IMPULSE_SLOTS }, () => new THREE.Vector3(0, 0, 1)) },
      uImpMode: { value: Array.from({ length: IMPULSE_SLOTS }, () => new THREE.Vector3()) },
      uImpWave: { value: Array.from({ length: IMPULSE_SLOTS }, () => new THREE.Vector2()) },
      uBulge: { value: new THREE.Vector4(0, 1, 0, 0) },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/terminal/mercury`
Expected: PASS, including every pre-existing pin. `'vec3 nb = ng * uBodyRot;'` is still present.

- [ ] **Step 5: Build check (catches template-literal/JS errors; GLSL compiles in Task 8)**

Run: `npm run build`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/mercury/planet/mercuryPlanetShader.js src/terminal/mercury/MercuryPlanet.jsx src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js
git commit -m "feat(mercury): the moving bead in the shader — modes and bulge on the silhouette, capillary ripples on the normal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Wire strikes, wake, scars and the bead into the frame loop

**Files:**
- Modify: `src/terminal/mercury/MercuryPlanet.jsx`
- Modify: `src/terminal/mercury/MercuryCanvas.jsx`
- Modify: `src/terminal/mercury/planet/planetLook.js` (`modeGain`, `waveGain`)

**Interfaces:**
- Consumes everything above.
- `MercuryPlanet` gains the prop `strikes` (a React ref whose `.current` is an array of phase strings). It drains the array every frame.
- `MercuryCanvas` creates the ref and pushes the phase on every element fire.

- [ ] **Step 1: `planetLook.js` knobs** (add to `PLANET_TUNE`, after `rayGain`)

```js
  modeGain: 1,       // body-mode + spin-bulge amplitude (the bead's wobble)
  waveGain: 1,       // capillary ripple slope
```

- [ ] **Step 2: `MercuryCanvas.jsx`: the strike queue**

Add `useRef` to the React import: `import { Suspense, useCallback, useRef } from 'react';`. After `handleNodeTap`, add:

```js
  // Element strikes for the planet (MercuryPlanet drains this every frame).
  // onElementFired fires once per press; onNodeTap fires on both pointerdown and click.
  const strikesRef = useRef([]);
  const handleElementFired = useCallback((phase, x, y) => {
    strikesRef.current.push(phase);
    onElementFired?.(phase, x, y);
  }, [onElementFired]);
```

Pass `strikes={strikesRef}` to `<MercuryPlanet …>`. Change `<MercurySphere … onElementFired={onElementFired} …>` to `onElementFired={handleElementFired}`.

- [ ] **Step 3: `MercuryPlanet.jsx`: imports, state and the frame loop**

Imports to add:

```js
import { R_SCENE } from './planet/planetLook';   // merge into the existing planetLook import
import {
  IMPULSE_SLOTS, createImpulses, addImpulse, createImpulseFrame, impulseFrame, spinBulge, createWake, wakeImpulse,
} from './planet/mercuryWaves';               // merge with Task 6's IMPULSE_SLOTS import
import {
  IMPACT_MODE_AMP, IMPACT_WAVE_AMP, strikeDirWorld, worldToBody, bodyToWorld, localTempK, impactKind,
} from './planet/mercuryImpacts';
import { createScarMap, stampCrater, matureScars, healScars, SCAR_TICK_S } from './planet/scarMap'; // merge with Task 5's import
import { pickSphereDir } from './planet/pickSphere';
```

Signature: `export default function MercuryPlanet({ isMobile = false, emitters = {}, strikes = null }) {`. Read the camera: `const camera = useThree((s) => s.camera);`.

After the `aether` `useMemo`, add the preallocated per-frame state:

```js
  // Phase 3 state: the bead's impulses, the drag wake, the scar clock. Preallocated; useFrame allocates nothing.
  const surf = useMemo(() => ({
    impulses: createImpulses(),
    frame: createImpulseFrame(),
    wake: createWake(),
    bulge: [0, 1, 0, 0],
    seed: 1,
    scarClock: 0,
    dragDirBody: [0, 0, 1],
    hasDragDir: false,
    w: [0, 0, 0],
    b: [0, 0, 0],
    sunB: [0, 0, 0],
    nodePos: [0, 0, 0],
    cam: [0, 0, 0],
  }), []);
```

In `useFrame`, keep everything up to and including `u.uHeatK.value = body.heatK;`. Change the `drag.sample` line so the result is kept as `ds` (the destructuring stays valid):

```js
    const ds = drag.sample(performance.now());
    const { dragging, omegaPtr } = ds;
```

Then, after `u.uHeatK.value = body.heatK;`, insert:

```js
    // --- Phase 3: strikes, wake, scars, the bead ---
    const precession = orbitPrecessionAngle(t);
    worldToBody(SUN_DIR_WORLD, body.q, surf.sunB);
    surf.cam[0] = camera.position.x; surf.cam[1] = camera.position.y; surf.cam[2] = camera.position.z;

    const queue = strikes?.current;
    let scarDirty = false;
    while (queue && queue.length > 0) {
      const phase = queue.shift();
      const node = ORBIT_NODES.find((n) => n.phase === phase);
      if (!node) continue;
      const p = nodeWorldPosition(node.angle, precession);
      surf.nodePos[0] = p[0]; surf.nodePos[1] = p[1]; surf.nodePos[2] = p[2];
      strikeDirWorld(surf.nodePos, surf.cam, surf.w);
      worldToBody(surf.w, body.q, surf.b);
      const kind = impactKind(body.tau, localTempK(surf.b, surf.sunB, u.uSubsolarT.value, body.heatK));
      if (kind === 'crater') {
        stampCrater(scar, surf.b, surf.seed++);
        scarDirty = true;
      } else {
        addImpulse(surf.impulses, { dirBody: surf.b, tS: t, mode: IMPACT_MODE_AMP[kind], wave: IMPACT_WAVE_AMP[kind], kind });
      }
    }

    if ((ds.dragging || ds.released) && ds.aimed && pickSphereDir(ds.ndc, camera, R_SCENE, surf.w)) {
      worldToBody(surf.w, body.q, surf.dragDirBody);
      surf.hasDragDir = true;
    }
    const ptrOmega = Math.hypot(omegaPtr[0], omegaPtr[1], omegaPtr[2]);
    const imp = wakeImpulse(surf.wake, {
      tS: t, dragging, released: ds.released, ptrOmega, bodyOmega: body.omega.length(), tau: body.tau,
    });
    if (imp && surf.hasDragDir) addImpulse(surf.impulses, { dirBody: surf.dragDirBody, tS: t, ...imp });
    if (ds.released) surf.hasDragDir = false;

    if (body.tau >= 1 && healScars(scar)) scarDirty = true;
    surf.scarClock += Math.min(delta, MAX_FRAME_DT_S);
    if (surf.scarClock >= SCAR_TICK_S) {
      if (matureScars(scar, surf.scarClock)) scarDirty = true;
      surf.scarClock = 0;
    }
    if (scarDirty) scarTex.needsUpdate = true;

    impulseFrame(surf.impulses, t, { modeScale: body.tau * PLANET_TUNE.modeGain, waveScale: PLANET_TUNE.waveGain }, surf.frame);
    for (let i = 0; i < IMPULSE_SLOTS; i++) {
      bodyToWorld(surf.impulses.slots[i].dir, body.q, surf.w);
      u.uImpDir.value[i].set(surf.w[0], surf.w[1], surf.w[2]);
      u.uImpMode.value[i].set(surf.frame.mode[3 * i], surf.frame.mode[3 * i + 1], surf.frame.mode[3 * i + 2]);
      u.uImpWave.value[i].set(surf.frame.wave[2 * i], surf.frame.wave[2 * i + 1]);
    }
    spinBulge(body.omega, body.tau * PLANET_TUNE.modeGain, surf.bulge);
    u.uBulge.value.set(surf.bulge[0], surf.bulge[1], surf.bulge[2], surf.bulge[3]);
    u.uSurfOn.value = surf.frame.any || Math.abs(surf.bulge[3]) > 1e-5 ? 1 : 0;
```

Then **delete** the now-duplicate `const precession = orbitPrecessionAngle(t);` line that preceded `ORBIT_NODES.forEach(...)`. The emitter loop reuses the `precession` declared above.

Add `SUN_DIR_WORLD` (already imported) and `orbitPrecessionAngle` (already imported); no new import is needed for them. `nodeWorldPosition` returns a fresh array (a known deferred minor). It is called only on a strike, which is rare, so this is acceptable.

- [ ] **Step 4: Tests, lint, build**

Run: `npx vitest run src/terminal/mercury` → PASS.
Run: `npm run lint` → 0 errors, warnings ≤ 137. If `react-hooks/exhaustive-deps` flags `scarTex`/`camera`/`strikes` in `useFrame`, ignore it: `useFrame` is not a hook with deps. If it flags a `useMemo`, add the dependency.
Run: `npm run build` → success.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/MercuryPlanet.jsx src/terminal/mercury/MercuryCanvas.jsx src/terminal/mercury/planet/planetLook.js
git commit -m "feat(mercury): strikes crater the crust and splash the liquid; the drag leaves a wake; the bead wobbles and flattens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Live check (controller, not a subagent)

Headless Chrome over CDP against the dev server on :5175, using `.superpowers/sdd/tools/` (see `HANDOVER-mercury-body.md` → Live-look toolkit). Screenshot first, theory second. Save frames to `.superpowers/sdd/look/19…`.

- [ ] (a) **Rest:** the planet is pixel-identical to phase 2 (look/18). The shader compiles; only ANGLE X3577 warnings appear.
- [ ] (b) **FIRE tap at rest:** a crater with rays on the right-hand face at ~0.77 R. Frames at 0.2 s and 60 s show the rays dimming. A terminator-side crater casts a shadow.
- [ ] (c) **Spin to liquid:** the scars are gone once τ = 1. The silhouette flattens while spinning. On release the bead sloshes, then settles over ~3–5 s.
- [ ] (d) **Tap while liquid:** a splash ring runs out (frames every 0.1 s for 1 s), and the limb wobbles by a few px.
- [ ] (e) **Drag on the liquid:** a wake of rings from the drag point.
- [ ] (f) **Console:** 0 errors. Write a ledger entry in `.superpowers/sdd/progress.md`.
- [ ] (g) **Author look round:** `modeGain`, `waveGain` and `rayGain` via `__mercuryTune.planet`, plus the conventions of spec amendment 3 (impact tilt, the two playback speeds, crater size).

---

## Self-review (done while writing)

- **Spec §7 phase 3 coverage:**
  - body modes (T1, T6, T7) ✓
  - capillary waves (T1, T6, T7) ✓
  - impacts/craters (T2, T3, T5, T7) ✓
  - scar map (T3, T5, T7) ✓
- **§5 Events:**
  - tap → crater, splash or damped ring (T2 `impactKind`, T7) ✓
  - drag → waves from the drag point (T4, T7 wake) ✓
  - melting erases scars (T7 heal at τ = 1) ✓
- **§5 shading:**
  - the spin bulge (T1, T6) ✓
  - scars on top of the crust (T5) ✓
- **Deferred to phase 4** (per §7): sodium tail, boiling roil, mobile perf, reduced motion.
- **Types and names are consistent across tasks:**
  - `IMPULSE_SLOTS`, `impulseFrame(buf, tS, {modeScale, waveScale}, out)`, `spinBulge(omega, scale, out)`, `wakeImpulse(wake, {...})`
  - `worldToBody`/`bodyToWorld(dir, q, out)`, `stampCrater(map, dirBody, seed)`, `pickSphereDir(ndc, camera, radius, out)`
  - the uniform names in T6 match T7.

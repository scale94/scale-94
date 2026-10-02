# /MERCURY Phase 6a: Hyper-Fling simulation, implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A hard fling with the spin pinned at `MAX_OMEGA` and a fast release pointer disrupts the planet into a micro-core plus a swarm of beads that swirl as a disc and spiral home through the Phase 5 cascade before refreeze, rendered by the existing droplet SDF at today's tier caps (16 full / 8 phone).

**Architecture:** A new pure module `planet/hyperFling.js` owns the trigger, the mass split, the launch and the core scale. `breakupStep.js` gains the aether-vortex acceleration (`hyperAccel`), a birth grace and `cascadeDuration`. `breakupBudget.js` gains test-particle trials, the generalised solver (log-μ for Phase 5, log-η for hyper) and the containment solve. The planet and exosphere shaders read a live core radius `uCoreR`. `MercuryPlanet.jsx` wires the trigger, the solver deadline, the core scale and the `hyperNow` rig.

**Tech Stack:** JavaScript (ESM), React Three Fiber, three.js `RawShaderMaterial` (GLSL 3), vitest 4, headless CDP probes in `.superpowers/sdd/tools/` (gitignored).

**Spec:** `docs/superpowers/specs/2026-10-02-mercury-hyperfling-phase6-design.md` (with Amendments V1–V3), §3 and §7.

## Plan-time amendments (need the author's OK at handoff)

- **A1, reach floor (phone portrait).** In portrait the planet fills ~81 % of the half-width (`rVis` ≈ 0.92 against R 0.75), so containing to `HYPER_VIS_K · rVis` (0.78) leaves no room for a disc at all. Containment uses `hyperReach(rVis) = max(HYPER_VIS_K · rVis, HYPER_REACH_MIN_R · R)` with `HYPER_REACH_MIN_R` 1.25. In phone portrait, beads may cross the side edges of the screen while they orbit. The alternative is the camera dolly, which the author left out of scope.
- **A2, constants home.** `ETA_LO/ETA_HI/ETA_ITERS` and the containment constants live in `hyperFling.js` (not `breakupBudget.js`): `breakupBudget` imports them, and `hyperFling` never imports `breakupBudget`, so there is no import cycle.
- **A3, exosphere core radius.** The exosphere reads `exo.coreR`, a field on the `exo` state object `MercuryPlanet` already shares with it, instead of a new module singleton `LIVE_CORE`.

## Global Constraints

- All sim modules stay three.js-free and pure; vectors `[x, y, z]`, quaternions `[x, y, z, w]` body → world.
- Phase 5 behaviour is unchanged for non-hyper families: every existing test in `src/terminal/mercury/planet/__tests__/breakup*.test.js` keeps passing unmodified.
- Idle and hold paths allocate nothing per frame (fire time may allocate).
- `MAX_OMEGA` is not raised. Lite tier never hyper-flings (`HYPER_N.lite = 0`).
- Invariant: `Σ V_beads + V_core = V0` to 1e-9 relative at fire.
- Invariant: the swarm's volume-weighted mean velocity is 0 at fire (`|Σ V v| / Σ V < 1e-9`).
- Lint gate: `npm run lint` stays at 0 errors and within `--max-warnings 143`; do not sweep `react-hooks/exhaustive-deps`.
- Known pre-existing failure, not ours: `artComposite.test.js > compositeDpr`.
- Nothing is pushed without the author's explicit command. Commit on `feature/mercury-hyper`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Headless probes run on CDP port :5175 only; the in-app browser pane runs rAF at 0 fps and cannot verify motion.

## File map

| File | Responsibility |
|---|---|
| `src/terminal/mercury/planet/mercuryDrag.js` | release pointer ω (`releaseOmegaPtr`), measured over `PTR_WINDOW_MS` |
| `src/terminal/mercury/useMercuryDrag.js` | passes the event time to `tracker.up` |
| `src/terminal/mercury/planet/hyperFling.js` (new) | constants, trigger, mass split, `fireHyper`, `hyperMu`, `hyperReach`, `coreScale` |
| `src/terminal/mercury/planet/breakupFamily.js` | hyper fields on the family; `fireFamily` resets them |
| `src/terminal/mercury/planet/breakupStep.js` | `hyperAccel`, grace in `collide`, `cascadeDuration` |
| `src/terminal/mercury/planet/breakupBudget.js` | particle trials, generalised solver, `solveContainment`, `particleTurns` |
| `src/terminal/mercury/planet/mercuryPlanetShader.js` | `uCoreR` in VS and FS |
| `src/terminal/mercury/planet/exosphereShader.js`, `mercuryExosphere.js`, `MercuryExosphere.jsx` | `uCoreR`, the JS mirrors' `rCore` |
| `src/terminal/mercury/planet/planetLook.js` | `PLANET_TUNE.hyperRadial`, `hyperOrbit` |
| `src/terminal/mercury/mercuryTuning.js` | `hyperNow` rig |
| `src/terminal/mercury/MercuryPlanet.jsx` | wiring |
| tests: `mercuryDrag.test.js`, `hyperFling.test.js`, `hyperStep.test.js`, `hyperBudget.test.js`, `hyperSweep.test.js`, `hyperTestKit.js` (all in `planet/__tests__/`) | |

Run one test file with: `npx vitest run src/terminal/mercury/planet/__tests__/<file>`.

---

### Task 1: Release pointer ω readout

Gate 0 needs this readout before anything else: the author's swipes set `V_HYPER` from it.

**Files:**
- Modify: `src/terminal/mercury/planet/mercuryDrag.js`
- Modify: `src/terminal/mercury/useMercuryDrag.js` (the `endDrag` handler)
- Modify: `src/terminal/mercury/MercuryPlanet.jsx` (the `drop` useMemo, `stepDrop`)
- Test: `src/terminal/mercury/planet/__tests__/mercuryDrag.test.js`

**Interfaces:**
- Produces: `PTR_WINDOW_MS = 60`; `tracker.up(tMs?)`; `sample()` result gains `releaseOmegaPtr` (rad/s, nonzero only on the release frame); `drop.lastRelease = { omega, ptrOmega, eH, hyper }` written on every release (`eH`/`hyper` stay 0/false until Task 7).

- [ ] **Step 1: Write the failing tests** (append to `mercuryDrag.test.js`; add `PTR_WINDOW_MS` to its import from `'../mercuryDrag'`)

```js
describe('release pointer ω (phase 6 trigger)', () => {
  const H = 800;
  it('is the pointer ω over the last PTR_WINDOW_MS before release, reported once on the release frame', () => {
    const d = createDragTracker();
    d.down(0, 0, 0);
    for (let t = 10; t <= 200; t += 10) d.move(3 * t, 0, t, H); // 3 px/ms
    d.up(200);
    const r = d.sample(201);
    expect(r.released).toBe(true);
    expect(r.releaseOmegaPtr).toBeCloseTo((DRAG_RAD_PER_HEIGHT / H) * 3000, 6);
    expect(d.sample(202).releaseOmegaPtr).toBe(0);
  });

  it('only the last window counts: a slow drag ending in a fast flick reads the flick', () => {
    const d = createDragTracker();
    d.down(0, 0, 0);
    for (let t = 10; t <= 300; t += 10) d.move(0.5 * t, 0, t, H);
    for (let t = 310; t <= 300 + PTR_WINDOW_MS; t += 10) d.move(150 + 4 * (t - 300), 0, t, H);
    d.up(300 + PTR_WINDOW_MS);
    expect(d.sample(400).releaseOmegaPtr).toBeCloseTo((DRAG_RAD_PER_HEIGHT / H) * 4000, 6);
  });

  it('a pointer held still past POINTER_HOLD_MS before letting go reads 0', () => {
    const d = createDragTracker();
    d.down(0, 0, 0);
    for (let t = 10; t <= 100; t += 10) d.move(3 * t, 0, t, H);
    d.up(100 + POINTER_HOLD_MS + 1);
    expect(d.sample(300).releaseOmegaPtr).toBe(0);
  });

  it('a tap with no move reads 0, and up() without a time still works', () => {
    const d = createDragTracker();
    d.down(5, 5, 0);
    d.up();
    const r = d.sample(10);
    expect(r.released).toBe(true);
    expect(r.releaseOmegaPtr).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryDrag.test.js`
Expected: FAIL (`PTR_WINDOW_MS` is undefined; `releaseOmegaPtr` is undefined).

- [ ] **Step 3: Implement in `mercuryDrag.js`**

Add the constants after `VELOCITY_WINDOW_MS`:

```js
export const PTR_WINDOW_MS = 60; // phase 6: the release pointer ω is the displacement over this long before release
const RING = 64;                 // move samples kept for it (a 1 kHz pointer still spans the window)
```

Replace `createDragTracker` with:

```js
export function createDragTracker() {
  // wx/wy/wT: where and when the current velocity window started.
  const s = { dragging: false, wx: 0, wy: 0, wT: 0, lastMoveMs: 0, omega: ZERO, nx: 0, ny: 0, aimed: false, released: false, heightPx: 1, releaseOmega: 0 };
  // The last RING pointer samples (preallocated ring) for the release pointer ω.
  const ring = { x: new Float64Array(RING), y: new Float64Array(RING), t: new Float64Array(RING), n: 0, head: 0 };
  const push = (x, y, tMs) => {
    ring.x[ring.head] = x; ring.y[ring.head] = y; ring.t[ring.head] = tMs;
    ring.head = (ring.head + 1) % RING;
    ring.n = Math.min(ring.n + 1, RING);
  };
  // |pointer ω| from the oldest sample inside PTR_WINDOW_MS of the newest one to the newest one.
  const releaseOmegaOf = (upMs) => {
    if (ring.n < 2 || upMs - s.lastMoveMs > POINTER_HOLD_MS) return 0;
    const iN = (ring.head - 1 + RING) % RING;
    let iO = iN;
    for (let k = 1; k < ring.n; k++) {
      const i = (ring.head - 1 - k + 2 * RING) % RING;
      if (ring.t[iN] - ring.t[i] > PTR_WINDOW_MS) break;
      iO = i;
    }
    if (iO === iN) return 0;
    const w = pointerOmega(ring.x[iN] - ring.x[iO], ring.y[iN] - ring.y[iO], (ring.t[iN] - ring.t[iO]) / 1000, s.heightPx);
    return Math.hypot(w[0], w[1]);
  };
  // One result object, refilled every sample() so the render loop allocates nothing.
  const result = { dragging: false, omegaPtr: [0, 0, 0], ndc: [0, 0], aimed: false, released: false, releaseOmegaPtr: 0 };
  return {
    down(x, y, tMs) {
      Object.assign(s, { dragging: true, wx: x, wy: y, wT: tMs, lastMoveMs: tMs, omega: ZERO, releaseOmega: 0 });
      ring.n = 0; ring.head = 0;
      push(x, y, tMs);
    },
    move(x, y, tMs, heightPx) {
      if (!s.dragging) return;
      s.lastMoveMs = tMs;
      s.heightPx = heightPx;
      push(x, y, tMs);
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
    up(tMs = s.lastMoveMs) {
      if (s.dragging) {
        s.released = true;
        s.releaseOmega = releaseOmegaOf(tMs);
      }
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
      result.releaseOmegaPtr = s.released ? s.releaseOmega : 0;
      s.released = false;
      return result;
    },
  };
}
```

In `useMercuryDrag.js`, in `endDrag`, change `tracker.up();` to `tracker.up(e.timeStamp);` (leave the cleanup's `tracker.up()` as it is).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryDrag.test.js`
Expected: PASS (all old and new tests).

- [ ] **Step 5: Write the readout in `MercuryPlanet.jsx`**

In the `drop` useMemo object literal, after `fam: createFamily(1), solver: null, warned: false,`, add:

```js
      lastRelease: { omega: 0, ptrOmega: 0, eH: 0, hyper: false }, // phase 6: every release, for Gate 0 and the HUD
```

In `stepDrop`, in the `else` (not calm) branch, directly after `env.pxPerUnit = pxPerUnitAt(...)`, add:

```js
    if (ds.released) {
      const lr = drop.lastRelease;
      lr.omega = body.omega.length(); lr.ptrOmega = ds.releaseOmegaPtr; lr.eH = 0; lr.hyper = false;
    }
```

- [ ] **Step 6: Run the suite and lint**

Run: `npx vitest run src/terminal/mercury` then `npm run lint`
Expected: PASS (except the known `compositeDpr`); lint 0 errors, warnings ≤ 143.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/mercury/planet/mercuryDrag.js src/terminal/mercury/useMercuryDrag.js src/terminal/mercury/MercuryPlanet.jsx src/terminal/mercury/planet/__tests__/mercuryDrag.test.js
git commit -m "feat(mercury): release pointer omega readout (phase 6a, Gate 0)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: CHECKPOINT, Gate 0 (author).** Ask the author to run, on desktop and the OnePlus 9 Pro, `/mercury?perf=1&gpu=1`, melt, then:
  1. Phase 5 GPU baseline: `__mercuryTune.breakNow(12)` with 4–6 beads on screen; note the gpu line.
  2. After a real hard fling, `__mercuryDrop.solver.substeps` is nonzero; note why the liquid frame reads 16.7 ms on the 120 Hz panel.
  3. ~10 hardest mouse swipes and ~10 hardest thumb flings, reading `__mercuryDrop.lastRelease.ptrOmega` after each.
  Record the numbers in `.superpowers/sdd/progress.md`. Set `V_HYPER` to about the 30th percentile of the hard-swipe readings and `V_HYPER_SPAN` to (max − `V_HYPER`) in Task 2's constants (or in a one-line follow-up commit if Task 2 is already done). Work may continue on provisional values (`V_HYPER` 30, `V_HYPER_SPAN` 30) while waiting.

---

### Task 2: `hyperFling.js`: constants, trigger, mass split

**Files:**
- Create: `src/terminal/mercury/planet/hyperFling.js`
- Test: `src/terminal/mercury/planet/__tests__/hyperFling.test.js`

**Interfaces:**
- Consumes: `MAX_OMEGA` (`mercuryBody`), `R_SCENE` (`planetLook`), `PX_FLOOR`, `sphereVol` (`breakupPhysics`).
- Produces (later tasks import these exact names): `HYPER_OMEGA_FRAC, V_HYPER, V_HYPER_SPAN, F_CORE_MAX, F_CORE_MIN, HYPER_N, HYPER_FRAG_N, HYPER_R_MAX_K, HYPER_EQ_BIAS, HYPER_GRACE_S, T_BURST, HYPER_VIS_K, HYPER_REACH_MIN_R, HYPER_GAMMA_MAX, HYPER_GAMMA_ITERS, HYPER_CONTAIN_K, HYPER_CONTAIN_S, ETA_LO, ETA_HI, ETA_ITERS, V0`; `hyperEnergy(ptrOmega) → number`; `canHyper({ omega, ptrOmega, nMax }) → boolean`; `mulberry32(seed) → () => number`; `gammaMean1(rng, n) → number`; `splitMass(N, eH, seed, pxPerUnit) → { fC, rC0, vFrag, rBar, radii: number[] }`; `hyperMu(orbitS) → number`; `hyperReach(rVis) → number`.

- [ ] **Step 1: Write the failing tests** (`hyperFling.test.js`)

```js
// src/terminal/mercury/planet/__tests__/hyperFling.test.js — phase 6a: trigger, mass split, launch
import { describe, it, expect } from 'vitest';
import {
  canHyper, hyperEnergy, splitMass, gammaMean1, mulberry32, hyperMu, hyperReach,
  V0, V_HYPER, V_HYPER_SPAN, HYPER_OMEGA_FRAC, F_CORE_MAX, F_CORE_MIN, HYPER_R_MAX_K, HYPER_VIS_K, HYPER_REACH_MIN_R,
} from '../hyperFling';
import { MAX_OMEGA } from '../mercuryBody';
import { PX_FLOOR, sphereVol } from '../breakupPhysics';
import { R_SCENE } from '../planetLook';

const volOf = (rs) => rs.reduce((a, r) => a + sphereVol(r), 0);

describe('hyperFling trigger', () => {
  it('fires only with the spin pinned at the cap AND a fast release pointer, never on lite', () => {
    const w = HYPER_OMEGA_FRAC * MAX_OMEGA;
    expect(canHyper({ omega: w, ptrOmega: V_HYPER, nMax: 16 })).toBe(true);
    expect(canHyper({ omega: w - 0.01, ptrOmega: 1e3, nMax: 16 })).toBe(false);
    expect(canHyper({ omega: MAX_OMEGA, ptrOmega: V_HYPER - 0.01, nMax: 16 })).toBe(false);
    expect(canHyper({ omega: MAX_OMEGA, ptrOmega: 1e3, nMax: 0 })).toBe(false);
  });

  it('eH ramps 0 → 1 over V_HYPER_SPAN', () => {
    expect(hyperEnergy(0)).toBe(0);
    expect(hyperEnergy(V_HYPER)).toBe(0);
    expect(hyperEnergy(V_HYPER + V_HYPER_SPAN / 2)).toBeCloseTo(0.5, 12);
    expect(hyperEnergy(1e6)).toBe(1);
  });
});

describe('splitMass (Villermaux gamma spread, exact volume)', () => {
  it('conserves V0 to 1e-9 and respects the floor and the relative ceiling', () => {
    for (const N of [8, 14, 16, 32]) for (const eH of [0, 0.5, 1]) for (let seed = 1; seed <= 5; seed++) {
      const m = splitMass(N, eH, seed, 300);
      expect(m.radii.length).toBe(N);
      expect(Math.abs(volOf(m.radii) + m.fC * V0 - V0) / V0).toBeLessThan(1e-9);
      for (const r of m.radii) {
        expect(r).toBeGreaterThanOrEqual((PX_FLOOR / 300) * (1 - 1e-9));
        expect(r).toBeLessThanOrEqual(HYPER_R_MAX_K * m.rBar * (1 + 1e-9));
      }
    }
  });

  it('the core keeps F_CORE_MAX at eH 0 and F_CORE_MIN at eH 1; rC0 = R ∛fC', () => {
    const a = splitMass(16, 0, 1, 300), b = splitMass(16, 1, 1, 300);
    expect(a.fC).toBeCloseTo(F_CORE_MAX, 12);
    expect(b.fC).toBeCloseTo(F_CORE_MIN, 12);
    expect(b.rC0).toBeCloseTo(R_SCENE * Math.cbrt(F_CORE_MIN), 12);
  });

  it('is deterministic per seed and differs between seeds', () => {
    expect(splitMass(16, 1, 7, 300).radii).toEqual(splitMass(16, 1, 7, 300).radii);
    expect(splitMass(16, 1, 7, 300).radii).not.toEqual(splitMass(16, 1, 8, 300).radii);
  });

  it('reads as organic quicksilver: radius CV 0.3–0.65 (gamma n = 4 gives 0.5 before clamps)', () => {
    let cv = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const r = splitMass(32, 1, seed, 300).radii;
      const mean = r.reduce((a, x) => a + x, 0) / r.length;
      const sd = Math.sqrt(r.reduce((a, x) => a + (x - mean) ** 2, 0) / r.length);
      cv += sd / mean / 20;
    }
    expect(cv).toBeGreaterThan(0.3);
    expect(cv).toBeLessThan(0.65);
  });

  it('gammaMean1 has mean 1 and variance 1/n', () => {
    const rng = mulberry32(7);
    let s = 0, s2 = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) { const x = gammaMean1(rng, 4); s += x; s2 += x * x; }
    const mean = s / n;
    expect(mean).toBeCloseTo(1, 1);
    expect(s2 / n - mean * mean).toBeGreaterThan(0.23);
    expect(s2 / n - mean * mean).toBeLessThan(0.27);
  });
});

describe('hyperFling knobs', () => {
  it('μ is the orbit period at the old surface: 4π²R³/P²', () => {
    expect(hyperMu(3.5)).toBeCloseTo((4 * Math.PI ** 2 * R_SCENE ** 3) / 3.5 ** 2, 12);
  });
  it('reach: HYPER_VIS_K · rVis, floored at HYPER_REACH_MIN_R · R (plan amendment A1)', () => {
    expect(hyperReach(1.38)).toBeCloseTo(HYPER_VIS_K * 1.38, 12);
    expect(hyperReach(0.92)).toBeCloseTo(HYPER_REACH_MIN_R * R_SCENE, 12);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/hyperFling.test.js`
Expected: FAIL (cannot resolve `../hyperFling`).

- [ ] **Step 3: Create `hyperFling.js`**

```js
// src/terminal/mercury/planet/hyperFling.js — the hyper-fling: the core itself breaks (phase-6 spec §3,
// Amendments V1–V3; plan amendments A1–A2). Pure and three.js-free like the phase-5 sim: breakupBudget replays
// a hyper family on test particles. Vectors [x, y, z] in the world frame.

import { MAX_OMEGA } from './mercuryBody';
import { R_SCENE } from './planetLook';
import { PX_FLOOR, sphereVol } from './breakupPhysics';

// Trigger (§3.1, V2). V_HYPER / V_HYPER_SPAN are provisional until the Gate 0 swipe readout sets them.
export const HYPER_OMEGA_FRAC = 0.98;  // the spin must be pinned at the cap…
export const V_HYPER = 30;             // …and the release pointer ω (rad/s, mercuryDrag) at least this
export const V_HYPER_SPAN = 30;        // eH ramps 0 → 1 over this much more
// Mass split (§3.2).
export const F_CORE_MAX = 0.08;        // the micro-core's share of V0 at eH 0…
export const F_CORE_MIN = 0.03;        // …and at eH 1
export const HYPER_N = Object.freeze({ full: 32, phone: 14, lite: 0 }); // 6a clamps these to TIERS[t].drop.bodies
export const HYPER_FRAG_N = 4;         // gamma shape of the radius spread (ligament-mediated fragmentation)
export const HYPER_R_MAX_K = 1.8;      // the largest bead, × the volume-mean radius r̄ (relative: absolute caps cannot conserve at N 8)
// Launch (§3.3, V3).
export const HYPER_EQ_BIAS = 0.4;      // latitude squeeze toward the spin equator
export const HYPER_GRACE_S = 0.25;     // no collision of any kind before this (beads are born touching)
export const T_BURST = 0.15;           // the core shrinks to its share over this long
// Return (§3.5, V1) and its solves (§3.6; plan amendment A2: they live here, breakupBudget imports them).
export const HYPER_VIS_K = 0.85;       // stay inside this share of the visible half-extent…
export const HYPER_REACH_MIN_R = 1.25; // …but never contain tighter than this × R (plan amendment A1: phone portrait)
export const HYPER_GAMMA_MAX = 500;    // containment drag bracket top, 1/s
export const HYPER_GAMMA_ITERS = 10;
export const HYPER_CONTAIN_K = 4;      // the fastest beads set the excursion
export const HYPER_CONTAIN_S = 3;      // replayed this long at η = 0 (the widest orbits)
export const ETA_LO = 1e-3;            // headwind bracket: ln-bisection over [ETA_LO, ETA_HI]
export const ETA_HI = 1;               // (η = 1: a still aether, plain drag; also the provisional value while solving)
export const ETA_ITERS = 8;            // final ratio 1000^(1/256) ≈ 1.027

export const V0 = sphereVol(R_SCENE);

export const hyperEnergy = (ptrOmega) => Math.min(1, Math.max(0, (ptrOmega - V_HYPER) / V_HYPER_SPAN));

export function canHyper({ omega, ptrOmega, nMax }) {
  return nMax > 0 && omega >= HYPER_OMEGA_FRAC * MAX_OMEGA && ptrOmega >= V_HYPER;
}

// Deterministic per seed, so the live family and every solver replay see the same swarm.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Gamma(n, mean 1) for integer n (Erlang): the mean of n unit exponentials.
export function gammaMean1(rng, n) {
  let s = 0;
  for (let k = 0; k < n; k++) s -= Math.log(1 - rng());
  return s / n;
}

// The micro-core's share and the beads' radii (§3.2): a gamma spread rescaled to the exact fragment volume,
// floor/ceiling-clamped with the rest renormalised until nothing more clamps.
export function splitMass(N, eH, seed, pxPerUnit) {
  const fC = F_CORE_MAX + (F_CORE_MIN - F_CORE_MAX) * eH;
  const vFrag = (1 - fC) * V0;
  const rng = mulberry32(seed);
  const radii = new Array(N);
  for (let i = 0; i < N; i++) radii[i] = gammaMean1(rng, HYPER_FRAG_N);
  const rBar = Math.cbrt(vFrag / (N * (4 / 3) * Math.PI));
  const lo = PX_FLOOR / pxPerUnit, hi = HYPER_R_MAX_K * rBar;
  const fixed = new Array(N).fill(false);
  for (let pass = 0; pass < 16; pass++) {
    let vFix = 0, vFree = 0;
    for (let i = 0; i < N; i++) { if (fixed[i]) vFix += sphereVol(radii[i]); else vFree += sphereVol(radii[i]); }
    if (!(vFree > 0)) break;
    const k = Math.cbrt((vFrag - vFix) / vFree);
    let clamped = false;
    for (let i = 0; i < N; i++) {
      if (fixed[i]) continue;
      radii[i] *= k;
      if (radii[i] < lo) { radii[i] = lo; fixed[i] = true; clamped = true; } else if (radii[i] > hi) { radii[i] = hi; fixed[i] = true; clamped = true; }
    }
    if (!clamped) break;
  }
  return { fC, rC0: R_SCENE * Math.cbrt(fC), vFrag, rBar, radii };
}

// The pull is set by a look knob, not solved (V1): the orbital period at the old surface.
export const hyperMu = (orbitS) => (4 * Math.PI * Math.PI * R_SCENE ** 3) / (orbitS * orbitS);

// How far out a bead may orbit (§3.5; plan amendment A1).
export const hyperReach = (rVis) => Math.max(HYPER_VIS_K * rVis, HYPER_REACH_MIN_R * R_SCENE);
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/hyperFling.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/planet/hyperFling.js src/terminal/mercury/planet/__tests__/hyperFling.test.js
git commit -m "feat(mercury): hyper-fling trigger and mass split (phase 6a)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Step hooks: vortex acceleration, birth grace, `cascadeDuration`

**Files:**
- Modify: `src/terminal/mercury/planet/breakupFamily.js` (`createFamily`, `fireFamily`)
- Modify: `src/terminal/mercury/planet/breakupStep.js` (`flight`, `collide`, new exports)
- Test: `src/terminal/mercury/planet/__tests__/hyperStep.test.js`

**Interfaces:**
- Produces: family fields `hyper` (false), `tGrace` (0), `rC0` (0), `axisL` ([0, 0, 1]), `gammaH` (0), `eta` (0); `hyperAccel(mu, eta, gamma, L, x, y, z, vx, vy, vz, out) → out`; `cascadeDuration(r, pxPerUnit) → seconds`.

- [ ] **Step 1: Write the failing tests** (`hyperStep.test.js`)

```js
// src/terminal/mercury/planet/__tests__/hyperStep.test.js — phase 6a: the vortex return, the grace, the cascade clock
import { describe, it, expect } from 'vitest';
import { createFamily, fireFamily } from '../breakupFamily';
import { stepFamily, DROP_DT, hyperAccel, cascadeDuration } from '../breakupStep';
import { TONGUE_MAX_R } from '../breakupPhysics';
import { R_SCENE } from '../planetLook';
import { testEnv, freeBody, runFor } from './breakupTestKit';

const hyperFam = (over = {}) => {
  const f = createFamily(1);
  Object.assign(f, { phase: 'fired', hyper: true, mu: 1, eta: 0, gammaH: 10, axisL: [0, 0, 1], tGrace: 0, rC0: 0.3 }, over);
  return f;
};
const coreEnv = (f) => testEnv({ planetRadiusAt: () => f.rC0 });

describe('hyper family fields', () => {
  it('a new family is not hyper, and a phase-5 fire clears a stale hyper flag', () => {
    const f = createFamily(1);
    expect(f.hyper).toBe(false);
    expect(f.tGrace).toBe(0);
    Object.assign(f, { hyper: true, tGrace: 1, axisBody: [1, 0, 0], L: TONGUE_MAX_R, e: 1 });
    fireFamily(f, { maxBodies: 16, satellites: true });
    expect(f.hyper).toBe(false);
    expect(f.tGrace).toBe(0);
  });
});

describe('hyperAccel (drag toward the aether vortex)', () => {
  it('at the vortex velocity there is no drag: pure gravity', () => {
    const out = hyperAccel(1, 0, 10, [0, 0, 1], 1, 0, 0, 0, 1, 0, [0, 0, 0]);
    expect(out[0]).toBeCloseTo(-1, 12);
    expect(out[1]).toBeCloseTo(0, 12);
    expect(out[2]).toBeCloseTo(0, 12);
  });
  it('at rest the vortex drags the bead along (L̂ × x), slowed by the headwind (1 − η)', () => {
    const out = hyperAccel(1, 0.25, 10, [0, 0, 1], 1, 0, 0, 0, 0, 0, [0, 0, 0]);
    expect(out[0]).toBeCloseTo(-1, 12);
    expect(out[1]).toBeCloseTo(10 * 0.75, 12);
  });
});

describe('the vortex return in stepFamily', () => {
  it('η = 0 holds a circular orbit', () => {
    const f = hyperFam();
    const r0 = 0.9, vc = Math.sqrt(1 / r0);
    const b = freeBody(f, [r0, 0, 0], [0, vc, 0], 0.05);
    runFor(f, 3, coreEnv(f));
    expect(Math.hypot(...b.p)).toBeGreaterThan(r0 * 0.99);
    expect(Math.hypot(...b.p)).toBeLessThan(r0 * 1.01);
  });
  it('the drag kills out-of-plane motion: the excursion stays within ~vz/γ and dies away toward the disc ⊥ L̂', () => {
    // vertical motion is overdamped (γ ≫ Ω): the speed dies in ~1/γ, the offset decays at ~Ω²/γ (slowly)
    const f = hyperFam();
    const b = freeBody(f, [0.9, 0, 0], [0, Math.sqrt(1 / 0.9), 0.5], 0.05);
    let zMax = 0;
    for (let i = 0; i < 3 / DROP_DT; i++) { stepFamily(f, DROP_DT, coreEnv(f)); zMax = Math.max(zMax, Math.abs(b.p[2])); }
    expect(zMax).toBeLessThan(0.06);
    expect(Math.abs(b.p[2])).toBeLessThan(0.8 * zMax);
    expect(Math.abs(b.v[2])).toBeLessThan(0.02);
  });
  it('a headwind spirals the bead inward', () => {
    const f = hyperFam({ eta: 0.1 });
    const b = freeBody(f, [0.9, 0, 0], [0, Math.sqrt(1 / 0.9), 0], 0.05);
    runFor(f, 3, coreEnv(f));
    expect(Math.hypot(...b.p)).toBeLessThan(0.88);
  });
});

describe('birth grace (V3)', () => {
  it('no bead–bead merge and no core strike before tGrace; both after', () => {
    const f = hyperFam({ mu: 0, gammaH: 1000, tGrace: 0.25 });
    const a = freeBody(f, [0.6, 0, 0], [0, 0, 0], 0.1);
    const o = freeBody(f, [0.65, 0, 0], [0, 0, 0], 0.1);
    const c = freeBody(f, [0, 0.35, 0], [0, 0, 0], 0.1);
    const env = coreEnv(f);
    runFor(f, 0.2, env);
    expect([a.state, o.state, c.state]).toEqual(['free', 'free', 'free']);
    runFor(f, 0.1, env);
    expect(a.state === 'free' && o.state === 'free').toBe(false);
    expect(c.state).not.toBe('free');
  });
});

describe('cascadeDuration', () => {
  it('matches a live partial-coalescence cascade', () => {
    const f = createFamily(1);
    f.phase = 'fired'; f.mu = 0;
    const r = 0.04;
    const b = freeBody(f, [R_SCENE + r + 1e-3, 0, 0], [-0.5, 0, 0], r);
    const env = testEnv({ gamma: 0 });
    let t0 = -1, t1 = -1;
    for (let i = 0; i < 2000 && t1 < 0; i++) {
      stepFamily(f, DROP_DT, env);
      if (t0 < 0 && b.state === 'cascade') t0 = f.t;
      if (b.state === 'gone') t1 = f.t;
    }
    expect(t0).toBeGreaterThan(0);
    expect(t1).toBeGreaterThan(t0);
    expect(Math.abs(t1 - t0 - cascadeDuration(r, env.pxPerUnit))).toBeLessThan(5 * DROP_DT);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/hyperStep.test.js`
Expected: FAIL (`hyperAccel` / `cascadeDuration` are not exported; `f.hyper` is undefined).

- [ ] **Step 3: Implement the family fields** in `breakupFamily.js`

In `createFamily`'s returned object, after `volResidual: 0, nextId: 0,`, add:

```js
    // phase 6 (hyper-fling): off for a phase-5 family
    hyper: false, tGrace: 0, rC0: 0, axisL: [0, 0, 1], gammaH: 0, eta: 0,
```

In `fireFamily`, change
`Object.assign(fam, { L, N, s, rMain, rSat, sat, t: 0, acc: 0, volResidual: 0 });`
to
`Object.assign(fam, { L, N, s, rMain, rSat, sat, t: 0, acc: 0, volResidual: 0, hyper: false, tGrace: 0 });`

- [ ] **Step 4: Implement the step hooks** in `breakupStep.js`

Add after the `flies` helper:

```js
const _acc = [0, 0, 0];

// The hyper acceleration (phase-6 spec §3.5, V1): gravity plus drag toward an aether vortex about L̂ that turns a
// little slower than orbital speed, u = (1 − η) √(μ/r) (L̂ × x)/r. Scalars in, `out` written: the live flight
// and the solver's test particles share it, so their paths agree.
export function hyperAccel(mu, eta, gamma, L, x, y, z, vx, vy, vz, out) {
  const r2 = x * x + y * y + z * z;
  const r = Math.sqrt(r2);
  const r3 = r2 * r;
  const k = ((1 - eta) * Math.sqrt(mu / r)) / r;
  const ux = k * (L[1] * z - L[2] * y), uy = k * (L[2] * x - L[0] * z), uz = k * (L[0] * y - L[1] * x);
  out[0] = (-mu * x) / r3 - gamma * (vx - ux);
  out[1] = (-mu * y) / r3 - gamma * (vy - uy);
  out[2] = (-mu * z) / r3 - gamma * (vz - uz);
  return out;
}

// How long a bead of radius r takes from first touching the planet to gone: the cascadeStep stage sequence
// (each stage one capillary time of its parent; the last when the next daughter would fall under PX_FLOOR).
export function cascadeDuration(r, pxPerUnit) {
  let rK = r, T = 0;
  for (;;) {
    T += capillaryTime(rK);
    const rNext = DAUGHTER_RATIO * rK;
    if (rNext * pxPerUnit < PX_FLOOR) return T;
    rK = rNext;
  }
}
```

In `flight`, replace the three lines that start `let ax = (-fam.mu * x[0]) / r3 - env.gamma * b.v[0];` (through `let az = …`) with:

```js
    let ax, ay, az;
    if (fam.hyper) {
      hyperAccel(fam.mu, fam.eta, fam.gammaH, fam.axisL, x[0], x[1], x[2], b.v[0], b.v[1], b.v[2], _acc);
      ax = _acc[0]; ay = _acc[1]; az = _acc[2];
    } else {
      ax = (-fam.mu * x[0]) / r3 - env.gamma * b.v[0];
      ay = (-fam.mu * x[1]) / r3 - env.gamma * b.v[1];
      az = (-fam.mu * x[2]) / r3 - env.gamma * b.v[2];
    }
```

(`r2`/`r3` stay computed above it; the non-hyper path uses them as before.)

In `collide`, make the first statement of the function body:

```js
  if (fam.t < fam.tGrace) return; // phase 6: hyper beads are born touching each other and the core (V3)
```

- [ ] **Step 5: Run the new and the Phase 5 tests**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/hyperStep.test.js src/terminal/mercury/planet/__tests__/breakupStep.test.js src/terminal/mercury/planet/__tests__/breakupMerge.test.js src/terminal/mercury/planet/__tests__/breakupFamily.test.js src/terminal/mercury/planet/__tests__/breakupBudget.test.js`
Expected: PASS, with no Phase 5 test modified.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/mercury/planet/breakupFamily.js src/terminal/mercury/planet/breakupStep.js src/terminal/mercury/planet/__tests__/hyperStep.test.js
git commit -m "feat(mercury): aether-vortex return, birth grace, cascade clock (phase 6a)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `fireHyper` and `coreScale`

**Files:**
- Modify: `src/terminal/mercury/planet/hyperFling.js`
- Test: `src/terminal/mercury/planet/__tests__/hyperFling.test.js`

**Interfaces:**
- Consumes: `addBody` (`breakupFamily`), `WOB_BIRTH` (`breakupStep`), Task 2's `splitMass`, `hyperMu`, `mulberry32`.
- Produces: `fireHyper(fam, { N, eH, seed, omega, pxPerUnit, vR0, orbitS, gammaFloor }) → fam`, which sets `phase 'fired'`, `hyper true`, `bodies` (all `'free'`), `necks []`, `mu`, `eta = ETA_HI`, `gammaH = gammaFloor`, `axisL`, `rC0`, `tGrace`, `volOut`, `volFamily`. Also `coreScale(fam) → s ∈ (0, 1]`.

- [ ] **Step 1: Write the failing tests** (append to `hyperFling.test.js`; extend the import from `'../hyperFling'` with `fireHyper, coreScale, ETA_HI, HYPER_GRACE_S, T_BURST`, and add `import { createFamily } from '../breakupFamily';`)

```js
const fireAt = (over = {}) => fireHyper(createFamily(1), {
  N: 16, eH: 1, seed: 3, omega: [0, 12, 0], pxPerUnit: 300, vR0: 2, orbitS: 3.5, gammaFloor: 8, ...over,
});
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe('fireHyper (launch)', () => {
  it('lays out N free beads inside the old surface, all fragment volume out, the core waiting', () => {
    const f = fireAt();
    expect(f.phase).toBe('fired');
    expect(f.hyper).toBe(true);
    expect(f.necks.length).toBe(0);
    expect(f.bodies.length).toBe(16);
    let v = 0;
    for (const b of f.bodies) {
      expect(b.state).toBe('free');
      expect(Math.hypot(...b.p)).toBeCloseTo(R_SCENE - b.r, 9);
      v += b.vol;
    }
    expect(f.volOut).toBeCloseTo(v, 12);
    expect(Math.abs(v + F_CORE_MIN * V0 - V0) / V0).toBeLessThan(1e-9);
    expect(f.rC0).toBeCloseTo(R_SCENE * Math.cbrt(F_CORE_MIN), 12);
    expect(f.tGrace).toBe(HYPER_GRACE_S);
  });

  it('the swarm centre of mass is still', () => {
    const f = fireAt();
    const m = [0, 0, 0];
    let V = 0;
    for (const b of f.bodies) { for (let c = 0; c < 3; c++) m[c] += b.vol * b.v[c]; V += b.vol; }
    expect(Math.hypot(...m) / V).toBeLessThan(1e-9);
  });

  it('swirls with the spin: L̂ ≈ ω̂, and beads hug the spin equator', () => {
    const f = fireAt();
    expect(dot(f.axisL, [0, 1, 0])).toBeGreaterThan(0.9);
    const meanCos = f.bodies.reduce((a, b) => a + Math.abs(b.p[1]) / Math.hypot(...b.p), 0) / f.bodies.length;
    expect(meanCos).toBeLessThan(0.4); // a uniform sphere gives 0.5
  });

  it('small beads fly out faster', () => {
    const f = fireAt();
    const radial = (b) => dot(b.v, b.p) / Math.hypot(...b.p);
    const byR = [...f.bodies].sort((a, b) => a.r - b.r);
    expect(radial(byR[0])).toBeGreaterThan(radial(byR[byR.length - 1]));
  });

  it('pull from the orbit knob, provisional headwind and floor drag, same seed → same swarm', () => {
    const f = fireAt();
    expect(f.mu).toBeCloseTo(hyperMu(3.5), 12);
    expect(f.eta).toBe(ETA_HI);
    expect(f.gammaH).toBe(8);
    expect(fireAt().bodies.map((b) => b.p)).toEqual(f.bodies.map((b) => b.p));
  });
});

describe('coreScale', () => {
  it('1 for a phase-5 or idle family; eases to ∛(1 − volOut/V0) over T_BURST; regrows as volume drains back', () => {
    expect(coreScale(createFamily(1))).toBe(1);
    const f = fireAt();
    expect(coreScale(f)).toBe(1);
    f.t = T_BURST;
    expect(coreScale(f)).toBeCloseTo(Math.cbrt(F_CORE_MIN), 9);
    f.volOut *= 0.5;
    expect(coreScale(f)).toBeCloseTo(Math.cbrt(1 - (1 - F_CORE_MIN) * 0.5), 9);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/hyperFling.test.js`
Expected: FAIL (`fireHyper` is not exported).

- [ ] **Step 3: Implement** (append to `hyperFling.js`; add to its imports `import { addBody } from './breakupFamily';` and `import { WOB_BIRTH } from './breakupStep';`)

```js
const len3 = (v) => Math.hypot(v[0], v[1], v[2]);

// The launch (§3.3): N beads on a jittered Fibonacci sphere squeezed toward the spin equator, born just inside
// the old surface, flung at ω × p plus a radial burst (small beads faster), the swarm's mean velocity removed so
// its centre of mass stays at the pull's centre. Sets the vortex axis L̂, the pull and provisional drag/headwind;
// the caller solves the containment drag (breakupBudget.solveContainment) and the headwind (the μ/η solver).
export function fireHyper(fam, { N, eH, seed, omega, pxPerUnit, vR0, orbitS, gammaFloor }) {
  const m = splitMass(N, eH, seed, pxPerUnit);
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const W = len3(omega);
  const z = W > 1e-6 ? [omega[0] / W, omega[1] / W, omega[2] / W] : [0, 1, 0];
  const a = Math.abs(z[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const xr = [a[1] * z[2] - a[2] * z[1], a[2] * z[0] - a[0] * z[2], a[0] * z[1] - a[1] * z[0]];
  const xl = len3(xr);
  const x = [xr[0] / xl, xr[1] / xl, xr[2] / xl];
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];

  fam.bodies.length = 0; fam.necks.length = 0; fam.events.length = 0;
  Object.assign(fam, {
    phase: 'fired', hyper: true, t: 0, acc: 0, volResidual: 0, L: 0, e: 0, N, seed,
    tGrace: HYPER_GRACE_S, rC0: m.rC0, mu: hyperMu(orbitS), eta: ETA_HI, gammaH: gammaFloor,
  });
  const golden = Math.PI * (3 - Math.sqrt(5));
  let V = 0;
  const mv = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    const r = m.radii[i];
    const c0 = Math.min(1, Math.max(-1, 1 - (2 * (i + 0.5)) / N + (rng() - 0.5) * (2 / N)));
    const c = (1 - HYPER_EQ_BIAS) * c0;
    const s = Math.sqrt(1 - c * c);
    const ph = i * golden + 0.5 * rng();
    const d = [
      x[0] * s * Math.cos(ph) + y[0] * s * Math.sin(ph) + z[0] * c,
      x[1] * s * Math.cos(ph) + y[1] * s * Math.sin(ph) + z[1] * c,
      x[2] * s * Math.cos(ph) + y[2] * s * Math.sin(ph) + z[2] * c,
    ];
    const rho = R_SCENE - r;
    const p = [d[0] * rho, d[1] * rho, d[2] * rho];
    const vr = vR0 * (1 + eH) * Math.sqrt(m.rBar / r);
    const v = [
      omega[1] * p[2] - omega[2] * p[1] + vr * d[0],
      omega[2] * p[0] - omega[0] * p[2] + vr * d[1],
      omega[0] * p[1] - omega[1] * p[0] + vr * d[2],
    ];
    const vol = sphereVol(r);
    addBody(fam, { state: 'free', p, v, r, rMain: r, vol, tFree: 0, wobAmp: WOB_BIRTH, wobAxis: [d[0], d[1], d[2]] });
    for (let k = 0; k < 3; k++) mv[k] += vol * v[k];
    V += vol;
  }
  const Lm = [0, 0, 0];
  for (const b of fam.bodies) {
    for (let k = 0; k < 3; k++) b.v[k] -= mv[k] / V;
    Lm[0] += b.vol * (b.p[1] * b.v[2] - b.p[2] * b.v[1]);
    Lm[1] += b.vol * (b.p[2] * b.v[0] - b.p[0] * b.v[2]);
    Lm[2] += b.vol * (b.p[0] * b.v[1] - b.p[1] * b.v[0]);
  }
  const ll = len3(Lm);
  fam.axisL = ll > 1e-12 ? [Lm[0] / ll, Lm[1] / ll, Lm[2] / ll] : [z[0], z[1], z[2]];
  fam.volFamily = V;
  fam.volOut = V;
  return fam;
}

// The planet's visible scale (§3.4): 1 unless a hyper family is out; eased to the core's share over T_BURST,
// then the core regrows as the cascade drains beads back into it (fam.volOut falls).
export function coreScale(fam) {
  if (!fam.hyper || fam.phase !== 'fired') return 1;
  const sTrue = Math.cbrt(Math.max(V0 - fam.volOut, 0) / V0);
  const u = Math.min(1, fam.t / T_BURST);
  return 1 + (sTrue - 1) * u * u * (3 - 2 * u);
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/hyperFling.test.js src/terminal/mercury/planet/__tests__/hyperStep.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/planet/hyperFling.js src/terminal/mercury/planet/__tests__/hyperFling.test.js
git commit -m "feat(mercury): hyper launch (swirl, equator bias, still centre of mass) and core scale (phase 6a)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Test-particle trials, the generalised solver, containment

**Files:**
- Modify: `src/terminal/mercury/planet/breakupBudget.js`
- Create: `src/terminal/mercury/planet/__tests__/hyperTestKit.js`
- Test: `src/terminal/mercury/planet/__tests__/hyperBudget.test.js`

**Interfaces:**
- Consumes: `hyperAccel`, `cascadeDuration`, `DROP_DT` (`breakupStep`); from `hyperFling`: `ETA_LO, ETA_HI, ETA_ITERS, HYPER_GAMMA_MAX, HYPER_GAMMA_ITERS, HYPER_CONTAIN_K, HYPER_CONTAIN_S`.
- Produces:
  - `PARTICLES_PER_UNIT`;
  - `trialWeight(fam) → int`;
  - `beginParticles(template, pxPerUnit, { eta, gamma, tMax, only?, track? }) → trial`;
  - `runParticles(trial, budget) → units`;
  - `particleTurns(template, pxPerUnit, eta, tMax) → number[]`;
  - `solveContainment(fam, pxPerUnit, reach, gFloor) → γ`;
  - solver objects gain `kind` (`'mu' | 'eta'`), `iters`, `maxExtra`, `weight`. `best` is the solved μ or η.

- [ ] **Step 1: Write the kit** (`hyperTestKit.js`)

```js
// src/terminal/mercury/planet/__tests__/hyperTestKit.js — shared phase-6a fixtures (not a test file).
import { createFamily, DROP_V_REF } from '../breakupFamily';
import { fireHyper } from '../hyperFling';

export const hyperEnv0 = (omega = [0, 12, 0], pxPerUnit = 300) => ({
  q: [0, 0, 0, 1], omega, gamma: 8, kappa: 0.1, vRef: DROP_V_REF, pxPerUnit, omegaTh: 7.5,
});
export const firedHyper = ({ N = 16, eH = 1, seed = 3, omega = [0, 12, 0], vR0 = 2, orbitS = 3.5, pxPerUnit = 300 } = {}) =>
  fireHyper(createFamily(seed), { N, eH, seed, omega, pxPerUnit, vR0, orbitS, gammaFloor: 8 });
export const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
```

- [ ] **Step 2: Write the failing tests** (`hyperBudget.test.js`)

```js
// src/terminal/mercury/planet/__tests__/hyperBudget.test.js — phase 6a: test particles, the headwind solve, containment
import { describe, it, expect } from 'vitest';
import {
  beginParticles, runParticles, particleTurns, trialWeight, solveContainment, createMuSolver, finishMuSolver,
  solverBudget, SOLVER_SUBSTEPS_PER_FRAME, PARTICLES_PER_UNIT,
} from '../breakupBudget';
import { createFamily } from '../breakupFamily';
import { stepFamily, DROP_DT, cascadeDuration } from '../breakupStep';
import { ETA_LO, ETA_HI, HYPER_CONTAIN_K, HYPER_CONTAIN_S } from '../hyperFling';
import { testEnv, freeBody } from './breakupTestKit';
import { hyperEnv0, firedHyper } from './hyperTestKit';

const oneBead = (eta) => {
  const f = createFamily(1);
  Object.assign(f, { phase: 'fired', hyper: true, mu: 1, eta, gammaH: 10, axisL: [0, 0, 1], tGrace: 0.25, rC0: 0.3 });
  freeBody(f, [0.9, 0, 0], [0, Math.sqrt(1 / 0.9), 0], 0.05);
  return f;
};

describe('test particles replay the live hyper flight', () => {
  it('a lone bead arrives at the same time in the live family and the particle trial', () => {
    const live = oneBead(0.3);
    const tr = beginParticles(oneBead(0.3), 300, { eta: 0.3, gamma: 10, tMax: 60 });
    runParticles(tr, Infinity);
    const env = testEnv({ kappa: 0, planetRadiusAt: () => live.rC0 });
    let tArr = -1;
    for (let i = 0; i < 60 / DROP_DT && tArr < 0; i++) {
      stepFamily(live, DROP_DT, env);
      if (live.bodies[0].state === 'cascade') tArr = live.t;
    }
    expect(tArr).toBeGreaterThan(0);
    expect(Math.abs(tr.out[0] - cascadeDuration(0.05, 300) - tArr)).toBeLessThan(2 * DROP_DT);
  });

  it('a stronger headwind brings the swarm home sooner', () => {
    const f = firedHyper();
    const T = (eta) => { const tr = beginParticles(f, 300, { eta, gamma: 10, tMax: 60 }); runParticles(tr, Infinity); return tr.tEnd; };
    expect(T(0.3)).toBeLessThan(T(0.05));
  });

  it('counts turns about L̂: one orbital period at η = 0 is one turn', () => {
    const f = oneBead(0);
    const period = 2 * Math.PI * Math.sqrt(0.9 ** 3 / 1);
    const turns = particleTurns(f, 300, 0, period);
    expect(turns[0]).toBeGreaterThan(0.97);
    expect(turns[0]).toBeLessThan(1.03);
  });
});

describe('the headwind solver (log-η bisection)', () => {
  it('lands the swarm by the target with the smallest η that does', () => {
    const f = firedHyper();
    f.gammaH = 10;
    const s = finishMuSolver(createMuSolver(f, hyperEnv0(), 12));
    expect(s.kind).toBe('eta');
    expect(s.landed).toBe(true);
    expect(s.best).toBeGreaterThanOrEqual(ETA_LO);
    expect(s.best).toBeLessThanOrEqual(ETA_HI);
    const T = (eta) => { const tr = beginParticles(f, 300, { eta, gamma: 10, tMax: 12 }); runParticles(tr, Infinity); return tr.left === 0 ? tr.tEnd : Infinity; };
    expect(T(s.best)).toBeLessThanOrEqual(12);
    if (s.best / 1.05 > ETA_LO) expect(T(s.best / 1.05)).toBeGreaterThan(12);
  });

  it('weights a particle substep by ceil(N / PARTICLES_PER_UNIT) phase-5 substeps', () => {
    const f = firedHyper({ N: 32 });
    expect(trialWeight(f)).toBe(Math.ceil(32 / PARTICLES_PER_UNIT));
    expect(trialWeight(createFamily(1))).toBe(1);
    const s = createMuSolver(f, hyperEnv0(), 12);
    expect(solverBudget(s, 1e9)).toBe(SOLVER_SUBSTEPS_PER_FRAME);
  });
});

describe('solveContainment', () => {
  it('keeps the fastest beads inside the reach, with the least drag that does', () => {
    const f = firedHyper();
    const reach = 1.17;
    const g = solveContainment(f, 300, reach, 8);
    expect(g).toBeGreaterThanOrEqual(8);
    const fastest = f.bodies.map((b, i) => i).sort((i, j) => Math.hypot(...f.bodies[j].v) - Math.hypot(...f.bodies[i].v)).slice(0, HYPER_CONTAIN_K);
    const rMax = (gm) => { const tr = beginParticles(f, 300, { eta: 0, gamma: gm, tMax: HYPER_CONTAIN_S, only: fastest }); runParticles(tr, Infinity); return tr.rMax; };
    expect(rMax(g)).toBeLessThanOrEqual(reach * (1 + 1e-9));
    if (g > 8 * 1.3) expect(rMax(g / 1.3)).toBeGreaterThan(reach);
  });
});

describe.skipIf(!process.env.HYPER_BENCH)('bench: PARTICLES_PER_UNIT', () => {
  it('measures a phase-5 substep against one particle step', async () => {
    const { firedFamily } = await import('./breakupTestKit');
    const fam = firedFamily({ maxBodies: 16, satellites: true });
    const env = testEnv({ kappa: 0.1 });
    for (let i = 0; i < 60; i++) stepFamily(fam, DROP_DT, env); // past the first snaps
    let t0 = performance.now();
    const n5 = 20000;
    for (let i = 0; i < n5; i++) { if (fam.phase !== 'fired') break; stepFamily(fam, DROP_DT, env); }
    const us5 = ((performance.now() - t0) * 1000) / n5;
    const f = firedHyper({ N: 32 });
    f.mu = 0; // no pull: nobody arrives, so every step carries all 32 particles
    const tr = beginParticles(f, 300, { eta: 0.1, gamma: 10, tMax: 1e9 });
    t0 = performance.now();
    runParticles(tr, 20000 * trialWeight(f));
    const usP = ((performance.now() - t0) * 1000) / ((tr.n / tr.w) * tr.count);
    console.log(`phase-5 substep ${us5.toFixed(2)} us; particle step ${usP.toFixed(3)} us; particles per unit ${(us5 / usP).toFixed(0)}`);
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/hyperBudget.test.js`
Expected: FAIL (`beginParticles` etc. are not exported).

- [ ] **Step 4: Implement in `breakupBudget.js`**

Update the imports:

```js
import { stepFamily, DROP_DT, hyperAccel, cascadeDuration } from './breakupStep';
import {
  ETA_LO, ETA_HI, ETA_ITERS, HYPER_GAMMA_MAX, HYPER_GAMMA_ITERS, HYPER_CONTAIN_K, HYPER_CONTAIN_S,
} from './hyperFling';
```

Add after `SOLVER_SUBSTEPS_MAX`:

```js
// Phase 6 (hyper): a test-particle substep for N beads costs ceil(N / PARTICLES_PER_UNIT) budget units, a unit
// being ~one phase-5 substep of cost (re-measured with HYPER_BENCH=1; see the plan's Task 5).
export const PARTICLES_PER_UNIT = 16;
export const trialWeight = (fam) => (fam.hyper ? Math.ceil(fam.bodies.length / PARTICLES_PER_UNIT) : 1);
```

Replace everything from the comment `// One resumable trial:` through the end of `solverBudget` with the block below. The block re-includes `absorbTime` unchanged; `finishMuSolver`, below `solverBudget`, stays as it is:

```js
// Phase 6: the hyper family replayed on independent test particles (spec §3.6): gravity + the vortex drag
// (breakupStep.hyperAccel, so the paths agree with the live flight), no cohesion, no merges, no bead–bead
// collisions; a bead arrives at the smallest core after the grace and its cascade is added in closed form.
// Every simplification makes it arrive later, so the solved headwind errs early.
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const _pa = [0, 0, 0];

export function beginParticles(template, pxPerUnit, { eta, gamma, tMax, only = null, track = false }) {
  const B = template.bodies;
  const idx = only ?? B.map((_, i) => i);
  const n = idx.length;
  const L = template.axisL;
  const e1 = unit3(cross3(Math.abs(L[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], L));
  const e2 = cross3(L, e1);
  const tr = {
    kind: 'particles', x: eta, eta, gamma, tMax, n: 0, ext: false, t: 0, w: trialWeight(template),
    mu: template.mu, L: [L[0], L[1], L[2]], rC0: template.rC0, tGrace: template.tGrace, pxPerUnit,
    count: n, left: n, tEnd: 0, rMax: 0, track, e1, e2,
    p: new Float64Array(3 * n), v: new Float64Array(3 * n), r: new Float64Array(n), out: new Float64Array(n).fill(-1),
    ang: new Float64Array(n), turns: new Float64Array(n),
  };
  for (let k = 0; k < n; k++) {
    const b = B[idx[k]];
    for (let c = 0; c < 3; c++) { tr.p[3 * k + c] = b.p[c]; tr.v[3 * k + c] = b.v[c]; }
    tr.r[k] = b.r;
    if (track) tr.ang[k] = Math.atan2(b.p[0] * e2[0] + b.p[1] * e2[1] + b.p[2] * e2[2], b.p[0] * e1[0] + b.p[1] * e1[1] + b.p[2] * e1[2]);
  }
  return tr;
}

const particlesRunning = (tr) => tr.left > 0 && tr.t < tr.tMax;
const particlesTime = (tr) => (tr.left === 0 ? tr.tEnd : Infinity);

// Runs whole particle substeps while `budget` units allow; returns the units spent.
export function runParticles(tr, budget) {
  let n = 0;
  const P = tr.p, V = tr.v, h = DROP_DT;
  while (n + tr.w <= budget && particlesRunning(tr)) {
    tr.t += h;
    for (let i = 0; i < tr.count; i++) {
      if (tr.out[i] >= 0) continue;
      const j = 3 * i;
      hyperAccel(tr.mu, tr.eta, tr.gamma, tr.L, P[j], P[j + 1], P[j + 2], V[j], V[j + 1], V[j + 2], _pa);
      V[j] += _pa[0] * h; V[j + 1] += _pa[1] * h; V[j + 2] += _pa[2] * h;
      P[j] += V[j] * h; P[j + 1] += V[j + 1] * h; P[j + 2] += V[j + 2] * h;
      const r = Math.hypot(P[j], P[j + 1], P[j + 2]);
      if (r > tr.rMax) tr.rMax = r;
      if (tr.track) {
        const e1 = tr.e1, e2 = tr.e2;
        const an = Math.atan2(P[j] * e2[0] + P[j + 1] * e2[1] + P[j + 2] * e2[2], P[j] * e1[0] + P[j + 1] * e1[1] + P[j + 2] * e1[2]);
        let d = an - tr.ang[i];
        if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI;
        tr.turns[i] += d;
        tr.ang[i] = an;
      }
      if (tr.t >= tr.tGrace && r <= tr.rC0 + tr.r[i]) {
        const T = tr.t + cascadeDuration(tr.r[i], tr.pxPerUnit);
        tr.out[i] = T;
        tr.left--;
        if (T > tr.tEnd) tr.tEnd = T;
      }
    }
    n += tr.w;
  }
  tr.n += n;
  return n;
}

// Turns about L̂ each bead makes before it arrives (or by tMax): the spiral gate's measure (spec §3.5).
export function particleTurns(template, pxPerUnit, eta, tMax) {
  const tr = beginParticles(template, pxPerUnit, { eta, gamma: template.gammaH, tMax, track: true });
  runParticles(tr, Infinity);
  return Array.from(tr.turns, (a) => Math.abs(a) / (2 * Math.PI));
}

// The containment drag (spec §3.5): the least γ in [gFloor, HYPER_GAMMA_MAX] that keeps the HYPER_CONTAIN_K
// fastest beads within `reach` over HYPER_CONTAIN_S at η = 0 (the widest orbits). Run at fire, synchronously.
export function solveContainment(fam, pxPerUnit, reach, gFloor) {
  const B = fam.bodies;
  const sp = (i) => Math.hypot(B[i].v[0], B[i].v[1], B[i].v[2]);
  const only = B.map((_, i) => i).sort((i, j) => sp(j) - sp(i)).slice(0, HYPER_CONTAIN_K);
  const fits = (g) => {
    const tr = beginParticles(fam, pxPerUnit, { eta: 0, gamma: g, tMax: HYPER_CONTAIN_S, only });
    runParticles(tr, Infinity);
    return tr.rMax <= reach;
  };
  if (fits(gFloor)) return gFloor;
  if (!fits(HYPER_GAMMA_MAX)) return HYPER_GAMMA_MAX;
  let lo = Math.log(gFloor), hi = Math.log(HYPER_GAMMA_MAX);
  for (let i = 0; i < HYPER_GAMMA_ITERS; i++) {
    const m = 0.5 * (lo + hi);
    if (fits(Math.exp(m))) hi = m; else lo = m;
  }
  return Math.exp(hi);
}

// One resumable trial: a phase-5 family replayed at a fixed μ, or a hyper family as test particles at a fixed η.
// `x` is the trialled value either way. The single replay loop (absorbTime and the solver both use it).
function beginTrial(template, env0, x, tMax) {
  if (template.hyper) return beginParticles(template, env0.pxPerUnit, { eta: x, gamma: template.gammaH, tMax });
  const fam = cloneFamily(template);
  fam.mu = x;
  return { kind: 'family', fam, env: headlessEnv(env0), x, tMax, n: 0, ext: false };
}
const trialRunning = (tr) => (tr.kind === 'particles' ? particlesRunning(tr) : tr.fam.phase === 'fired' && tr.fam.t < tr.tMax);
// Runs up to `budget` units; returns how many it ran (a family substep is one unit).
function runTrial(tr, budget) {
  if (tr.kind === 'particles') return runParticles(tr, budget);
  let n = 0;
  while (n < budget && trialRunning(tr)) {
    tr.env.at(tr.fam.t);
    stepFamily(tr.fam, DROP_DT, tr.env);
    tr.fam.events.length = 0;
    n++;
  }
  tr.n += n;
  return n;
}
const trialTime = (tr) => {
  if (tr.kind === 'particles') return particlesTime(tr);
  return tr.fam.phase === 'fired' ? Infinity : tr.fam.t;
};

export function absorbTime(template, env0, mu, tMax) {
  const tr = beginTrial(template, env0, mu, tMax);
  runTrial(tr, Infinity);
  return trialTime(tr);
}

// Solver fields: { kind, iters, maxExtra, weight, lo, hi, it, best, done, landed, extra, top, substeps, trial,
// template, env0, target }. kind 'mu' (phase 5): ln-μ bisection with an upward climb. kind 'eta' (hyper,
// spec §3.6): ln-η bisection over [ETA_LO, ETA_HI], no climb. `landed` is true when `best` was verified (a
// replay brought the last drop home by the target). If it is false after `done`, `best` is the largest value
// tried (μ) or ETA_HI (η), and the caller treats the return as best-effort.
export function createMuSolver(template, env0, target) {
  const hyper = !!template.hyper;
  const m = muRef(env0.omegaTh) * MU_CENTER;
  const lo = hyper ? Math.log(ETA_LO) : Math.log(m / MU_SPAN);
  const hi = hyper ? Math.log(ETA_HI) : Math.log(m * MU_SPAN);
  return {
    kind: hyper ? 'eta' : 'mu', iters: hyper ? ETA_ITERS : MU_ITERS, maxExtra: hyper ? 0 : MU_EXTRA, weight: trialWeight(template),
    lo, hi, it: 0, best: Math.exp(hi), done: false, target,
    landed: false, extra: 0, top: hi,
    substeps: 0, trial: null,
    template: cloneFamily(template),
    env0: { q: [...env0.q], omega: [...env0.omega], gamma: env0.gamma, kappa: env0.kappa, vRef: env0.vRef, pxPerUnit: env0.pxPerUnit, omegaTh: env0.omegaTh },
  };
}

// Bisection toward the smallest value (the slowest return) that still lands the last drop by the target. For μ,
// if the MU_ITERS bisection trials landed nothing, climb geometrically from the bracket top (at most MU_EXTRA
// trials). `budget` is in units; an in-progress trial resumes on the next call.
export function stepMuSolver(s, budget = SOLVER_SUBSTEPS_PER_FRAME) {
  let left = budget;
  while (left > 0 && !s.done) {
    if (!s.trial) {
      const ext = s.it >= s.iters;
      const x = ext ? Math.exp(s.top + (s.extra + 1) * Math.log(MU_EXTRA_K)) : Math.exp(0.5 * (s.lo + s.hi));
      s.trial = beginTrial(s.template, s.env0, x, s.target * T_MAX_FACTOR);
      s.trial.ext = ext;
    }
    const n = runTrial(s.trial, left);
    left -= n;
    s.substeps += n;
    if (trialRunning(s.trial)) break; // out of budget mid-trial
    const tr = s.trial;
    const ok = trialTime(tr) <= s.target;
    s.trial = null;
    if (tr.ext) {
      s.extra++;
      if (ok) { s.best = tr.x; s.landed = true; s.done = true; } else {
        s.best = tr.x; // largest tried so far
        if (s.extra >= s.maxExtra) s.done = true;
      }
    } else {
      if (ok) { s.best = tr.x; s.landed = true; s.hi = Math.log(tr.x); } else s.lo = Math.log(tr.x);
      if (++s.it >= s.iters && (s.landed || s.maxExtra === 0)) s.done = true;
    }
  }
  return s;
}

// Units to run this frame so the solve finishes within `framesLeft` frames (front-loaded: the remaining work is
// bounded above by every pending trial running to the target). Clamped to [SOLVER_SUBSTEPS_PER_FRAME,
// SOLVER_SUBSTEPS_MAX]. A solver that cannot make it still gets finishMuSolver as the last resort.
export function solverBudget(s, framesLeft) {
  if (s.done) return 0;
  const perTrial = (Math.ceil((s.target * T_MAX_FACTOR) / DROP_DT) + 2) * s.weight; // +2: float accumulation of t can overshoot by a step
  const trialsLeft = s.it < s.iters ? s.iters - s.it : Math.max(0, s.maxExtra - s.extra);
  const est = Math.max(0, trialsLeft * perTrial - (s.trial ? s.trial.n : 0));
  const base = Math.ceil(est / Math.max(1, framesLeft));
  return Math.min(SOLVER_SUBSTEPS_MAX, Math.max(SOLVER_SUBSTEPS_PER_FRAME, base));
}
```

Update the file's header comment to add one line: `// Phase 6 (hyper): the same solver bisects the aether headwind η on test particles (spec §3.6).`

- [ ] **Step 5: Run the new and the Phase 5 budget tests**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/hyperBudget.test.js src/terminal/mercury/planet/__tests__/breakupBudget.test.js`
Expected: PASS, with no Phase 5 test modified. If a Phase 5 test reads `tr.mu` or the old solver field set, stop and report it; do not edit the Phase 5 test.

- [ ] **Step 6: Measure `PARTICLES_PER_UNIT`**

Run (PowerShell): `$env:HYPER_BENCH='1'; npx vitest run src/terminal/mercury/planet/__tests__/hyperBudget.test.js -t bench; Remove-Item Env:HYPER_BENCH`
Read the `particles per unit` line. Set `PARTICLES_PER_UNIT` to that value rounded down to a multiple of 16, clamped to [16, 512]. Append the measured µs figures to its comment, e.g. `// 2026-10-02 dev desktop: phase-5 substep 4.1 us, particle step 0.05 us`. Re-run Step 5.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/mercury/planet/breakupBudget.js src/terminal/mercury/planet/__tests__/hyperBudget.test.js src/terminal/mercury/planet/__tests__/hyperTestKit.js
git commit -m "feat(mercury): test-particle trials, headwind solver, containment drag (phase 6a)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Live core radius in the planet and exosphere shaders (`uCoreR`)

**Files:**
- Modify: `src/terminal/mercury/planet/mercuryPlanetShader.js`
- Modify: `src/terminal/mercury/planet/exosphereShader.js`, `src/terminal/mercury/planet/mercuryExosphere.js`, `src/terminal/mercury/MercuryExosphere.jsx`
- Modify: `src/terminal/mercury/MercuryPlanet.jsx` (planet uniforms, the `exo` literal)
- Test: `src/terminal/mercury/planet/__tests__/mercuryExosphere.test.js`, the planet shader file snapshots

**Interfaces:**
- Produces: the planet uniform `uCoreR` (world radius, default `R_SCENE`); the exosphere uniform `uCoreR`; `exo.coreR`; `haloColumn(b, H, rCore = R_SCENE)`, `tailDensity(P, B, L, rCore = R_SCENE)`.

- [ ] **Step 1: Write the failing JS mirror test** (append inside the existing exosphere describe in `mercuryExosphere.test.js`)

```js
  it('phase 6: the halo and the tail start at the live core radius', () => {
    const r = 0.4 * R_SCENE;
    expect(haloColumn(0.5 * R_SCENE, H_NA, r)).toBeGreaterThan(0);
    expect(haloColumn(0.39 * R_SCENE, H_NA, r)).toBe(0);
    expect(haloColumn(1.2 * R_SCENE, H_NA)).toBe(haloColumn(1.2 * R_SCENE, H_NA, R_SCENE));
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryExosphere.test.js`
Expected: FAIL (the first assertion: `haloColumn` ignores its third argument).

- [ ] **Step 3: Implement the JS mirrors** in `mercuryExosphere.js`

```js
export function haloColumn(b, H, rCore = R_SCENE) {
  if (b <= rCore) return 0;
  return Math.exp(-(b - rCore) / H) * Math.sqrt(2 * Math.PI * b * H);
}
```

and in `tailDensity`, change the signature to `export function tailDensity(P, B, L, rCore = R_SCENE)` and its guard to `if (s <= 0 || r2 <= rCore * rCore) return 0;`. Update both comments to say "phase 6: the live core radius (rCore) during a hyper-fling".

- [ ] **Step 4: Implement the exosphere shader** (`exosphereShader.js`)

- Add `'uCoreR'` to `EXO_UNIFORMS`.
- Add `uniform float uCoreR;` on the line after `uniform float uExoGain;`.
- In GLSL `haloColumn`: `if (b <= uCoreR) return 0.0;` and `return exp(-(b - uCoreR) / H) * sqrt(TAU * b * H);`.
- In GLSL `tailDensity`: `if (s <= 0.0 || r2 <= uCoreR * uCoreR) return 0.0;`.
- In `main`: `float disc = bq * bq - (dot(ro, ro) - uCoreR * uCoreR);`.
- Keep the `const float R_SCENE` line; its test pins it.

In `MercuryExosphere.jsx`: change the planetLook import to `import { PLANET_TUNE, R_SCENE } from './planet/planetLook';`, add `uCoreR: { value: exo.coreR ?? R_SCENE },` to the uniforms, and add `un.uCoreR.value = exo.coreR ?? R_SCENE;` after `un.uExoGain.value = PLANET_TUNE.exoGain;` in `useFrame`.

In `MercuryPlanet.jsx`, change the `exo` literal to:
`const exo = useMemo(() => ({ B: init.tailB, L: tailLength(init.tailB), coverage: 0, time: 0, boxDirty: true, coreR: R_SCENE }), [init]);`

- [ ] **Step 5: Implement the planet shader** (`mercuryPlanetShader.js`)

- Add `'uCoreR'` to `PLANET_UNIFORMS`, after `'uMeniscusW'`.
- VS: replace
  ```
  uniform vec3 cameraPosition;

  out vec3 vWorld;
  ```
  with
  ```
  uniform vec3 cameraPosition;
  uniform float uCoreR;

  out vec3 vWorld;
  ```
  and replace `float rb = R_SCENE * (1.0 + SHAPE_MAX); // room for the moving bead` with `float rb = uCoreR * (1.0 + SHAPE_MAX); // room for the moving bead (uCoreR: the live core, phase 6)`.
- FS: replace `uniform float uSurfOn;` with `uniform float uSurfOn;\nuniform float uCoreR; // phase 6: the live core radius (R_SCENE except during a hyper-fling)`.
- FS `main`: `float rl = uCoreR * (1.0 + shapeH(pl > 1e-6 ? pc / pl : -rd));` and `float rk = uCoreR * (1.0 + shapeH(normalize(hit)));`. Change the comment `(exactly R_SCENE when the surface is still, i.e. the phase-2 sphere).` to `(exactly uCoreR when the surface is still, i.e. the phase-2 sphere at its live size).`

In `MercuryPlanet.jsx`'s material uniforms, add `uCoreR: { value: R_SCENE },` after `uTau: { value: 0 },`.

- [ ] **Step 6: Run the shader tests; regenerate the planet file snapshots**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js src/terminal/mercury/planet/__tests__/exosphereShader.test.js src/terminal/mercury/planet/__tests__/mercuryExosphere.test.js src/terminal/mercury/planet/__tests__/hgMirrorGlsl.test.js`
Expected: only the two file-snapshot assertions fail. Then run `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js -u` and inspect the snapshot diff:

Run: `git diff --stat src/terminal/mercury/planet/__tests__/__snapshots__/ ; git diff src/terminal/mercury/planet/__tests__/__snapshots__/`
Expected: VS +1 uniform line and the `rb` line; FS +1 uniform line, the comment line, and the `rl`/`rk` lines. Nothing else. If anything else changed, stop and report.

- [ ] **Step 7: Headless compile check**

Run: `node .superpowers/sdd/tools/dropCompile.mjs` (with the dev server on :5175, per `openMercury.mjs`)
Expected: all three tiers compile; no GL errors logged.

- [ ] **Step 8: Commit (the snapshots in their own commit)**

```bash
git add src/terminal/mercury/planet/mercuryPlanetShader.js src/terminal/mercury/planet/exosphereShader.js src/terminal/mercury/planet/mercuryExosphere.js src/terminal/mercury/MercuryExosphere.jsx src/terminal/mercury/MercuryPlanet.jsx src/terminal/mercury/planet/__tests__/mercuryExosphere.test.js
git commit -m "feat(mercury): live core radius uCoreR in the planet and exosphere (phase 6a)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git add src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.full.fs.glsl src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.full.vs.glsl
git commit -m "test(mercury): planet shader snapshots for uCoreR (reviewed: 5 intended lines)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Wiring: trigger, fire, solver deadline, core scale, `hyperNow`

**Files:**
- Modify: `src/terminal/mercury/MercuryPlanet.jsx`
- Modify: `src/terminal/mercury/mercuryTuning.js`
- Modify: `src/terminal/mercury/planet/planetLook.js`

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: `PLANET_TUNE.hyperRadial` (2, scene units/s), `PLANET_TUNE.hyperOrbit` (3.5 s); `__mercuryTune.hyperNow(eH = 1)`; `drop.coreScale`; `drop.hyperN`.

- [ ] **Step 1: The knobs** (`planetLook.js`, append to `PLANET_TUNE` after `dropDrift`)

```js
  hyperRadial: 2,    // phase 6: radial burst of a hyper-fling bead, scene units/s (× (1 + eH), small beads faster)
  hyperOrbit: 3.5,   // phase 6: orbital period at the old surface, s: sets the pull, so the turns of the spiral home
```

In `mercuryTuning.js`: change `DEV_OVERRIDES` to `{ dateMs: null, dropTimeScale: null, breakNow: null, holdOmega: null, hyperNow: null }`, and add after `holdAt(…)`:

```js
    // Phase 6: fire a hyper-fling at fling energy eH (0..1) as if released with the spin pinned at MAX_OMEGA.
    hyperNow(eH = 1) { DEV_OVERRIDES.hyperNow = eH; return `hyper-fling at eH ${eH}`; },
```

- [ ] **Step 2: Imports and state** (`MercuryPlanet.jsx`)

- Change the breakupBudget import to `import { muRef, returnTarget, createMuSolver, stepMuSolver, solverBudget, finishMuSolver, solveContainment } from './planet/breakupBudget';`.
- Change the mercuryBody import to `import { createBody, stepBody, coolBody, targetFromYaw, MAX_OMEGA } from './planet/mercuryBody';`.
- Add `import { canHyper, hyperEnergy, fireHyper, coreScale, hyperReach, HYPER_N, V_HYPER, V_HYPER_SPAN } from './planet/hyperFling';`.
- In the `drop` useMemo literal, after the `lastRelease` line from Task 1, add `coreScale: 1, fires: 0, hyperN: Math.min(HYPER_N[tier] ?? 0, TIERS[tier].drop.bodies), // phase 6`.
- Change the `planetRadiusAt` line to
  `d.env.planetRadiusAt = (dir) => R_SCENE * d.coreScale * (1 + shapeHeight(dir, surf.dirsW, surf.frame.mode, surf.bulge));`

- [ ] **Step 3: Fire helpers** (`MercuryPlanet.jsx`, after `fireDrop`)

```js
// Phase 6: release with the spin pinned and a fast pointer → the core itself breaks. The containment drag is solved
// now (synchronously, 4 fastest beads); the headwind η by the sliced solver before the birth grace ends.
function fireHyperDrop(drop, eH, heatK, camera, bufferW, bufferH, t) {
  const fam = drop.fam, env = drop.env;
  const rVis = camera.position.length() * Math.tan((camera.fov * Math.PI) / 360) * Math.min(1, bufferW / Math.max(bufferH, 1));
  drop.fires = (drop.fires + 1) | 0;
  const seed = (Math.imul(drop.fires, 2654435761) ^ Math.floor(t * 1000)) >>> 0 || 1;
  fireHyper(fam, {
    N: drop.hyperN, eH, seed, omega: env.omega, pxPerUnit: env.pxPerUnit,
    vR0: PLANET_TUNE.hyperRadial, orbitS: PLANET_TUNE.hyperOrbit, gammaFloor: PLANET_TUNE.dropDrag,
  });
  fam.gammaH = solveContainment(fam, env.pxPerUnit, hyperReach(rVis), PLANET_TUNE.dropDrag);
  drop.solver = createMuSolver(fam, env, returnTarget(heatK, PLANET_TUNE.dropDrift));
  drop.warned = false;
}

// Dev rig: spin the body at w rad/s about its current axis (world Y from rest) as a fresh release. The beads launch
// at ω × p (breakupStep / fireHyper), so without this they would leave a still planet the solver saw spinning.
function rigSpin(env, body, w) {
  const l = Math.hypot(env.omega[0], env.omega[1], env.omega[2]);
  if (l > 1e-6) { env.omega[0] *= w / l; env.omega[1] *= w / l; env.omega[2] *= w / l; } else { env.omega[0] = 0; env.omega[1] = w; env.omega[2] = 0; }
  body.omega.set(env.omega[0], env.omega[1], env.omega[2]);
  body.sinceReleaseS = 0; // a fresh release: inertia first, recapture ramps in (mercuryBody)
}
```

In the `breakNow` block, replace all the lines from `// Dev rig: fire as if released at w rad/s…` through `body.sinceReleaseS = 0; // a fresh release…` (the omega rescale, the two comment lines and `body.omega.set`) with:

```js
        // Dev rig: fire as if released at w rad/s about the current spin axis (world Y at rest), really spinning the body.
        rigSpin(env, body, w);
```

- [ ] **Step 4: The `hyperNow` rig, the trigger, the deadline** (`stepDrop`)

After the whole `if (DEV_OVERRIDES.breakNow != null) { … }` block, add:

```js
    if (DEV_OVERRIDES.hyperNow != null) {
      const eH = DEV_OVERRIDES.hyperNow;
      DEV_OVERRIDES.hyperNow = null;
      if (fam.phase !== 'fired' && body.tau >= 1 && drop.hyperN > 0) {
        rigSpin(env, body, MAX_OMEGA);
        omega = MAX_OMEGA;
        const lr = drop.lastRelease;
        lr.omega = MAX_OMEGA; lr.ptrOmega = V_HYPER + eH * V_HYPER_SPAN; lr.eH = eH; lr.hyper = true;
        fireHyperDrop(drop, eH, body.heatK, camera, bufferW, bufferH, t);
      }
    }
```

Replace `if (canFire(st)) {\n        fireDrop(drop, omega, body.heatK);\n      }` with:

```js
      if (canFire(st)) {
        const lr = drop.lastRelease;
        lr.eH = hyperEnergy(lr.ptrOmega);
        lr.hyper = canHyper({ omega, ptrOmega: lr.ptrOmega, nMax: drop.hyperN });
        if (lr.hyper) fireHyperDrop(drop, lr.eH, body.heatK, camera, bufferW, bufferH, t);
        else fireDrop(drop, omega, body.heatK);
      }
```

In the `fam.phase === 'fired'` block, replace

```js
        stepMuSolver(sv, solverBudget(sv, Math.max(1, Math.floor(nextSnapIn(fam) / dropDt))));
        // never let a drop fly on a provisional pull: this frame can advance the family by up to dropDt plus one
        // leftover DROP_DT substep (stepFamily's accumulator), so finish whenever the next snap is inside that
        if (!sv.done && nextSnapIn(fam) < dropDt + DROP_DT) finishMuSolver(sv);
        if (sv.done) {
          fam.mu = sv.best;
```

with

```js
        // phase 5: due at the first neck snap; phase 6 (no necks): due when the birth grace ends (spec §3.6)
        const due = fam.hyper ? fam.tGrace - fam.t : nextSnapIn(fam);
        stepMuSolver(sv, solverBudget(sv, Math.max(1, Math.floor(due / dropDt))));
        // never let a drop fly on a provisional pull: this frame can advance the family by up to dropDt plus one
        // leftover DROP_DT substep (stepFamily's accumulator), so finish whenever the deadline is inside that
        if (!sv.done && due < dropDt + DROP_DT) finishMuSolver(sv);
        if (sv.done) {
          if (fam.hyper) fam.eta = sv.best; else fam.mu = sv.best;
```

and change the DEV warning text to name the solved quantity:

```js
            console.warn(fam.hyper
              ? `[mercury] hyper-fling: no headwind up to eta ${sv.best.toPrecision(3)} lands the swarm by the ${sv.target.toFixed(1)} s target (hyperOrbit ${PLANET_TUNE.hyperOrbit}); it may come home late`
              : `[mercury] breakup: no pull up to mu ${sv.best.toPrecision(3)} lands the drops by the ${sv.target.toFixed(1)} s target (dropDrag ${PLANET_TUNE.dropDrag}); they may come home late`);
```

At the very end of `stepDrop` (after the `if (calm) { … } else { … }`), add:

```js
  drop.coreScale = coreScale(fam); // phase 6: the planet's live size (1 unless a hyper family is out)
```

- [ ] **Step 5: Push the core scale to the render** (`useFrame`)

Directly after `stepDrop(drop, da);`, add:

```js
    u.uCoreR.value = R_SCENE * drop.coreScale;
    exo.coreR = R_SCENE * drop.coreScale;
```

Change the drag pick to `pickSphereDir(ds.ndc, camera, R_SCENE * drop.coreScale, surf.w)`.

- [ ] **Step 6: Suite and lint**

Run: `npx vitest run src/terminal/mercury` then `npm run lint`
Expected: PASS (except the known `compositeDpr`); lint 0 errors, warnings ≤ 143.

- [ ] **Step 7: Headless smoke probe** (create `.superpowers/sdd/tools/hyperSmoke.mjs`; the folder is gitignored)

```js
// Phase 6a smoke: a forced hyper-fling fires, the core shrinks and regrows, the swarm comes home before refreeze,
// idle costs no extra draw call. node hyperSmoke.mjs   (frames → OUT/hyper-*.png; NOSHOT=1 for true timing)
import { openMercury, sleep, OUT } from './openMercury.mjs';
const { launch } = await import(new URL('file:///F:/scale_9.4/scripts/cdp.mjs'));
const page = await launch({ url: 'about:blank', width: 1600, height: 1000 });
const calls = () => page.eval(`new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res(window.__mercury.gl.info.render.calls))))`, { awaitPromise: true });
try {
  const m = await openMercury(page);
  const idle0 = await calls();
  await m.melt(25);
  await sleep(12000);
  await m.shot(`${OUT}/hyper-0-before.png`);
  await page.eval(`window.__mercuryTune.hyperNow(1); 1`);
  let firedSeen = false, sMin = 1, rMaxSeen = 0, t0 = Date.now(), last = null;
  const shots = process.env.NOSHOT ? [] : [0.1, 0.3, 1, 3, 6];
  while (Date.now() - t0 < 60000) {
    last = await page.eval(`(() => { const d = window.__mercuryDrop, f = d.fam; const live = f.bodies.filter((b) => b.state !== 'gone');
      return { phase: f.phase, hyper: f.hyper, t: +f.t.toFixed(2), n: live.length, s: +d.coreScale.toFixed(3), eta: f.eta, gammaH: +f.gammaH.toFixed(2),
        rMax: +Math.max(0, ...live.map((b) => Math.hypot(...b.p))).toFixed(3), volOut: f.volOut }; })()`);
    if (last.phase === 'fired' && last.hyper) firedSeen = true;
    if (firedSeen) { sMin = Math.min(sMin, last.s); rMaxSeen = Math.max(rMaxSeen, last.rMax); }
    if (firedSeen && shots.length && last.t >= shots[0]) {
      const at = shots.shift();
      await page.eval(`window.__mercuryTune.dropTime(0); 1`);
      await sleep(300);
      await m.shot(`${OUT}/hyper-${at}s.png`);
      console.log(`shot t=${at}s`, JSON.stringify(last));
      await page.eval(`window.__mercuryTune.dropTime(null); 1`);
    }
    if (firedSeen && last.phase === 'idle') break;
    await sleep(250);
  }
  console.log('fired:', firedSeen ? 'ok' : 'NEVER FIRED', 'core scale min', sMin, 'max bead radius seen', rMaxSeen, 'end', JSON.stringify(last), 'secs', ((Date.now() - t0) / 1000).toFixed(1));
  console.log('lastRelease', JSON.stringify(await page.eval(`window.__mercuryDrop.lastRelease`)));
  console.log('solver', JSON.stringify(await page.eval(`(() => { const s = window.__mercuryDrop.solver; return s && { kind: s.kind, done: s.done, landed: s.landed, best: s.best, target: s.target, substeps: s.substeps }; })()`)));
  console.log('draw calls idle before / after family', idle0, await calls());
  console.log('errors', JSON.stringify(await m.errors()));
} catch (e) { console.error('FAIL', e.message); } finally { await page.close(); process.exit(0); }
```

Run: `node .superpowers/sdd/tools/hyperSmoke.mjs` then `NOSHOT=1 node .superpowers/sdd/tools/hyperSmoke.mjs` (PowerShell: `$env:NOSHOT='1'; node …; Remove-Item Env:NOSHOT`).
Expected:
- `fired: ok`;
- `core scale min` ≈ ∛F_CORE_MIN ≈ 0.31;
- solver `kind: 'eta'`, `done: true`, `landed: true`;
- the NOSHOT run ends `idle` within the target (≤ 14 s plus the cascade);
- draw calls idle before = after (11);
- `errors []`.

Look at `hyper-*.png` before claiming anything about the look (memory rule: screenshot before diagnosing).

- [ ] **Step 8: Commit**

```bash
git add src/terminal/mercury/MercuryPlanet.jsx src/terminal/mercury/mercuryTuning.js src/terminal/mercury/planet/planetLook.js
git commit -m "feat(mercury): wire the hyper-fling (trigger, containment, headwind deadline, core scale, hyperNow rig) (phase 6a)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Sweep, spiral gate, look sheet

**Files:**
- Create: `src/terminal/mercury/planet/__tests__/hyperSweep.test.js`
- Modify: `.superpowers/sdd/progress.md` (ledger; not committed if gitignored. Check `git check-ignore`)

**Interfaces:**
- Consumes: `hyperTestKit`, `fireHyper`, `solveContainment`, `particleTurns`, the solver, `PLANET_TUNE`, `CAMERA_DIST`, `CAMERA_FOV_DEG`.

- [ ] **Step 1: Write the sweep and the permanent gate** (`hyperSweep.test.js`)

```js
// src/terminal/mercury/planet/__tests__/hyperSweep.test.js — phase 6a acceptance (spec §3.5–3.6).
// The full sweep: HYPER_SWEEP=1 npx vitest run src/terminal/mercury/planet/__tests__/hyperSweep.test.js
import { describe, it, expect } from 'vitest';
import { createFamily, DROP_V_REF } from '../breakupFamily';
import { returnTarget, createMuSolver, finishMuSolver, particleTurns, beginParticles, runParticles, solveContainment } from '../breakupBudget';
import { fireHyper, hyperReach, HYPER_N } from '../hyperFling';
import { PLANET_TUNE, CAMERA_DIST, CAMERA_FOV_DEG } from '../planetLook';
import { median } from './hyperTestKit';

const TURNS_MIN = 1.5;
const rVisOf = (cam, aspect) => CAMERA_DIST[cam] * Math.tan((CAMERA_FOV_DEG[cam] * Math.PI) / 360) * Math.min(1, aspect);
const VIEWS = { desktop: rVisOf('desktop', 1.6), phone: rVisOf('mobile', 0.45) };
const AXES = { y: [0, 12, 0], x: [12, 0, 0], xy: [12 / Math.SQRT2, 12 / Math.SQRT2, 0] };

function hyperCase({ N, eH, seed, axis, heat, view, pxPerUnit = 300 }) {
  const omega = AXES[axis];
  const f = fireHyper(createFamily(seed), {
    N, eH, seed, omega, pxPerUnit, vR0: PLANET_TUNE.hyperRadial, orbitS: PLANET_TUNE.hyperOrbit, gammaFloor: PLANET_TUNE.dropDrag,
  });
  const reach = hyperReach(VIEWS[view]);
  f.gammaH = solveContainment(f, pxPerUnit, reach, PLANET_TUNE.dropDrag);
  const env0 = { q: [0, 0, 0, 1], omega, gamma: PLANET_TUNE.dropDrag, kappa: PLANET_TUNE.dropCohesion, vRef: DROP_V_REF, pxPerUnit, omegaTh: PLANET_TUNE.breakOmega };
  const target = returnTarget(heat, PLANET_TUNE.dropDrift);
  const s = finishMuSolver(createMuSolver(f, env0, target));
  const tr = beginParticles(f, pxPerUnit, { eta: s.best, gamma: f.gammaH, tMax: target });
  runParticles(tr, Infinity);
  return { landed: s.landed, eta: s.best, gamma: f.gammaH, turns: median(particleTurns(f, pxPerUnit, s.best, target)), rMax: tr.rMax, reach, target };
}

describe('hyper-fling acceptance (a fixed sample)', () => {
  const cases = [
    { N: 16, eH: 1, seed: 1, axis: 'y', heat: 80, view: 'desktop' },
    { N: 16, eH: 0, seed: 2, axis: 'xy', heat: 120, view: 'desktop' },
    { N: 8, eH: 1, seed: 3, axis: 'y', heat: 80, view: 'phone' },
    { N: 8, eH: 0.5, seed: 4, axis: 'x', heat: 40, view: 'phone' },
  ];
  for (const c of cases) {
    it(`lands, spirals and stays contained: ${JSON.stringify(c)}`, () => {
      const r = hyperCase(c);
      expect(r.landed).toBe(true);
      expect(r.turns).toBeGreaterThanOrEqual(TURNS_MIN);
      expect(r.rMax).toBeLessThanOrEqual(r.reach * (1 + 1e-9));
    });
  }
});

describe.skipIf(!process.env.HYPER_SWEEP)('hyper-fling sweep (spec §3.6)', () => {
  it('100 % land, median turns ≥ 1.5, containment holds', () => {
    const rows = [];
    for (const view of ['desktop', 'phone']) for (const N of [8, 14, 16, 32].filter((n) => n <= HYPER_N.full))
      for (const eH of [0, 0.5, 1]) for (const axis of Object.keys(AXES)) for (const heat of [28, 60, 120]) for (let seed = 1; seed <= 20; seed++)
        rows.push({ view, N, eH, axis, heat, seed, ...hyperCase({ N, eH, seed, axis, heat, view }) });
    const bad = rows.filter((r) => !r.landed || r.rMax > r.reach * (1 + 1e-9));
    const turns = rows.map((r) => r.turns);
    const eta = rows.map((r) => r.eta), gam = rows.map((r) => r.gamma);
    console.log(`cases ${rows.length}; not landed / uncontained ${bad.length}; turns median ${median(turns).toFixed(2)} min ${Math.min(...turns).toFixed(2)};`
      + ` eta ${Math.min(...eta).toExponential(2)}..${Math.max(...eta).toExponential(2)}; gamma ${Math.min(...gam).toFixed(1)}..${Math.max(...gam).toFixed(1)}`);
    for (const v of ['desktop', 'phone']) {
      const t = rows.filter((r) => r.view === v).map((r) => r.turns);
      console.log(`${v}: turns median ${median(t).toFixed(2)} min ${Math.min(...t).toFixed(2)}`);
    }
    expect(bad).toEqual([]);
    expect(median(turns)).toBeGreaterThanOrEqual(TURNS_MIN);
  }, 1_800_000); // ~4300 cases: minutes, not the 5 s default
});
```

- [ ] **Step 2: Run the fixed sample**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/hyperSweep.test.js`
Expected: 4 PASS, sweep skipped. **If a case fails the turns gate, do not change `TURNS_MIN` or the physics.** Record the case and its numbers, then go to Step 4's decision.

- [ ] **Step 3: Run the full sweep**

Run (PowerShell): `$env:HYPER_SWEEP='1'; npx vitest run src/terminal/mercury/planet/__tests__/hyperSweep.test.js; Remove-Item Env:HYPER_SWEEP`
Expected: PASS. Record the printed lines (cases, failures, turns median/min per view, η and γ ranges) in `.superpowers/sdd/progress.md` under "Mercury hyper-fling phase 6a".

- [ ] **Step 4: Decision point (only if Step 2 or 3 failed)**

Stop and report to the author with the numbers. The knobs are look decisions, theirs, not the implementer's:
- **Too few turns:** lower `PLANET_TUNE.hyperOrbit`. A shorter period means a stronger pull and more turns; simulated 3 s → ~4.5 turns, 4.5 s → ~2.8.
- **Not landing at a short target (low heat):** expected near `MIN_RETURN_S`. Report which heats fail.
- **Uncontained:** the reach floor (amendment A1) is the lever.

- [ ] **Step 5: Look sheet**

Run `node .superpowers/sdd/tools/hyperSmoke.mjs` (frames at 0.1, 0.3, 1, 3, 6 s). Then build a sheet with the existing `mkSheet` tool from `.superpowers/sdd/tools/` into `.superpowers/sdd/look/44-hyper-6a.png`. **Look at the sheet** and write down what it shows: the burst, the shrunken core, the disc, the spiral, the merges, the return. Note honestly that a full-screen rect is being raymarched for 16 beads; 6b's impostors fix that.

- [ ] **Step 6: Full verification**

Run: `npx vitest run` then `npm run lint`
Expected: everything passes except the known `compositeDpr`; lint 0 errors, warnings ≤ 143.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/mercury/planet/__tests__/hyperSweep.test.js
git commit -m "test(mercury): hyper-fling acceptance sample and sweep (phase 6a)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: CHECKPOINT, the author's look call.** Hand over the sheet, the sweep numbers and the Gate 0 numbers. Phase 6a is done when the author approves the look. Do not push; wait for an explicit push command.

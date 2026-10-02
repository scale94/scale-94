# /MERCURY Phase 6a revision (Amendment V4): small beads, aimed disc launch, orbit-then-gather

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the 6a hyper-fling from a clump of planet-sized blobs into a disc of small beads that swirls intact, then spirals home and coalesces, at today's tier caps.

**Architecture:** `planet/hyperFling.js` sizes the beads from a radius knob (≈ 1 % of the planet flies) and aims each bead's launch so it settles inside the annulus between the core and the frame, at a fixed drag; the containment solve is deleted. The family gains `tHang`: before it the vortex has no headwind and cohesion is off (the disc), after it the solved headwind and cohesion bring the swarm home. The live flight (`breakupStep.flight`) and the solver's test particles (`breakupBudget.runParticles`) apply the same schedule.

**Tech Stack:** JavaScript (ESM), React Three Fiber, vitest 4, headless CDP probes in `.superpowers/sdd/tools/` (gitignored).

**Spec:** `docs/superpowers/specs/2026-10-02-mercury-hyperfling-phase6-design.md` §10 (Amendment V4, commit `44cfbed3`). Where §3/§9 disagree with §10, §10 governs.

**Starting point:** branch `feature/mercury-hyper` @ `44cfbed3` (6a tasks 1–7 plus `dfde0035`). The uncommitted `src/terminal/mercury/planet/__tests__/hyperSweep.test.js` from the first Task 8 is deleted in Task 1 and rewritten in Task 3.

## Global Constraints

- All sim modules stay three.js-free and pure; vectors `[x, y, z]`, quaternions `[x, y, z, w]` body → world.
- Phase 5 behaviour is unchanged for non-hyper families: every existing test in `src/terminal/mercury/planet/__tests__/breakup*.test.js` keeps passing unmodified.
- Idle and hold paths allocate nothing per frame (fire time may allocate).
- `MAX_OMEGA` is not raised. Lite tier never hyper-flings (`HYPER_N.lite = 0`).
- Invariant: `Σ V_beads + V_core = V0` to 1e-9 relative at fire.
- Momentum: the core balances the swarm (spec §10.2, review 2026-10-03); the swarm-only zero-mean invariant is dropped.
- Live flight and test particles share `hyperAccel(mu, eta, gamma, L, x, y, z, vx, vy, vz, rC, h, out)` and the same η schedule, so their paths agree.
- V4 values: `HYPER_RBAR_LO` 0.06, `HYPER_RBAR_HI` 0.08 (× R), `HYPER_EQ_BIAS` 0.64, `HYPER_GAMMA` 20, `HYPER_AIM_S` 0.6, `HYPER_HANG_K` 0.5, `HYPER_REACH_MIN_R` 1.45, `PLANET_TUNE.hyperOrbit` 3.
- Lint gate: `npm run lint` stays at 0 errors and within `--max-warnings 143`; do not sweep `react-hooks/exhaustive-deps`.
- Known pre-existing failure, not ours: `artComposite.test.js > compositeDpr`.
- Nothing is pushed without the author's explicit command. Commit on `feature/mercury-hyper`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- The working tree has unrelated modified/untracked files (`.import-cache.json`, a phase-5 spec doc, `src/terminal/views/manifesto/__tests__/__snapshots__/councilField.test.jsx.snap`, `baseline/` dirs). Never stage them.
- Headless probes run on CDP port :5175 only; the in-app browser pane runs rAF at 0 fps and cannot verify motion.

## File map

| File | Change |
|---|---|
| `src/terminal/mercury/planet/hyperFling.js` | V4 constants; `splitMass` from the radius knob; `fireHyper` aimed launch (`aimKick`), `axisL = ω̂`, `gammaH = HYPER_GAMMA`, `tHang` |
| `src/terminal/mercury/planet/breakupFamily.js` | family field `tHang` (default 0; `fireFamily` resets it) |
| `src/terminal/mercury/planet/breakupBudget.js` | delete `solveContainment` (Task 1); particle η schedule (Task 2) |
| `src/terminal/mercury/planet/breakupStep.js` | flight η and cohesion schedule (Task 2) |
| `src/terminal/mercury/planet/planetLook.js` | delete `hyperRadial` (Task 1); `hyperOrbit` 3 (Task 2) |
| `src/terminal/mercury/MercuryPlanet.jsx` | `fireHyperDrop` passes `reach`/`target`, no containment (Task 1); solver deadline `tHang` (Task 2) |
| tests: `hyperFling.test.js`, `hyperBudget.test.js`, `hyperStep.test.js`, `hyperTestKit.js`, `hyperSweep.test.js` | |

Run one test file with: `npx vitest run src/terminal/mercury/planet/__tests__/<file>`.

---

### Task 1: Small beads and the aimed launch (containment solve removed)

**Files:**
- Modify: `src/terminal/mercury/planet/hyperFling.js`
- Modify: `src/terminal/mercury/planet/breakupFamily.js:64` (createFamily) and `:158` (fireFamily reset)
- Modify: `src/terminal/mercury/planet/breakupBudget.js` (delete `solveContainment` and its constant imports)
- Modify: `src/terminal/mercury/planet/planetLook.js:80` (delete `hyperRadial`)
- Modify: `src/terminal/mercury/MercuryPlanet.jsx` (`fireHyperDrop`, the breakupBudget import)
- Modify: `src/terminal/mercury/planet/__tests__/hyperTestKit.js`, `hyperFling.test.js`, `hyperBudget.test.js`, `hyperStep.test.js`
- Delete: `src/terminal/mercury/planet/__tests__/hyperSweep.test.js` (uncommitted; Task 3 rewrites it)

**Interfaces:**
- Consumes: `hyperAccel(mu, eta, gamma, L, x, y, z, vx, vy, vz, rC, h, out)`, `DROP_DT`, `cascadeDuration`, `WOB_BIRTH` (`breakupStep`); `addBody` (`breakupFamily`); `sphereVol`, `PX_FLOOR` (`breakupPhysics`).
- Produces:
  - constants `HYPER_RBAR_LO` 0.06, `HYPER_RBAR_HI` 0.08, `HYPER_EQ_BIAS` 0.64, `HYPER_GAMMA` 20, `HYPER_AIM_S` 0.6, `HYPER_HANG_K` 0.5, `HYPER_REACH_MIN_R` 1.45. Removed: `F_CORE_MAX`, `F_CORE_MIN`, `HYPER_GAMMA_MAX`, `HYPER_GAMMA_ITERS`, `HYPER_CONTAIN_K`, `HYPER_CONTAIN_S`, `solveContainment`, `PLANET_TUNE.hyperRadial`.
  - `splitMass(N, eH, seed, pxPerUnit) → { fC, rC0, vFrag, rBar, radii }` (same shape; `rBar` from the knob).
  - `fireHyper(fam, { N, eH, seed, omega, pxPerUnit, orbitS, reach, target }) → fam`, setting `axisL = ω̂`, `gammaH = HYPER_GAMMA`, `tHang = HYPER_HANG_K · target`, `eta = ETA_HI` (provisional).
  - family field `tHang` (0 on a new or phase-5 family).
  - test kit: `firedHyper({ N = 16, eH = 1, seed = 3, omega = [0, 12, 0], orbitS = 3, pxPerUnit = 300, reach = 1.175, target = 12 })`.

- [ ] **Step 1: Update the test kit**

Replace the body of `src/terminal/mercury/planet/__tests__/hyperTestKit.js` below its header comment with:

```js
import { createFamily, DROP_V_REF } from '../breakupFamily';
import { fireHyper } from '../hyperFling';

export const hyperEnv0 = (omega = [0, 12, 0], pxPerUnit = 300) => ({
  q: [0, 0, 0, 1], omega, gamma: 8, kappa: 0.1, vRef: DROP_V_REF, pxPerUnit, omegaTh: 7.5,
});
// reach 1.175: desktop landscape (0.85 · 3.6 · tan 21°); target 12 s: a mid-heat return
export const firedHyper = ({ N = 16, eH = 1, seed = 3, omega = [0, 12, 0], orbitS = 3, pxPerUnit = 300, reach = 1.175, target = 12 } = {}) =>
  fireHyper(createFamily(seed), { N, eH, seed, omega, pxPerUnit, orbitS, reach, target });
export const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
```

- [ ] **Step 2: Write the failing hyperFling tests**

In `src/terminal/mercury/planet/__tests__/hyperFling.test.js`:

(a) Replace the import block from `'../hyperFling'` with:

```js
import {
  canHyper, hyperEnergy, splitMass, gammaMean1, mulberry32, hyperMu, hyperReach,
  fireHyper, coreScale, ETA_HI, HYPER_GRACE_S, T_BURST, HYPER_GAMMA, HYPER_AIM_S, HYPER_HANG_K,
  V0, V_HYPER, V_HYPER_SPAN, HYPER_OMEGA_FRAC, HYPER_RBAR_LO, HYPER_RBAR_HI, HYPER_R_MAX_K, HYPER_VIS_K, HYPER_REACH_MIN_R,
} from '../hyperFling';
import { hyperAccel, DROP_DT } from '../breakupStep';
```

(b) Replace the test `'the core keeps F_CORE_MAX at eH 0 and F_CORE_MIN at eH 1; rC0 = R ∛fC'` with:

```js
  it('the bead size is the knob: r̄ = R · lerp(RBAR_LO, RBAR_HI, eH); ~1 % of the planet flies; rC0 = R ∛fC', () => {
    const a = splitMass(16, 0, 1, 300), b = splitMass(16, 1, 1, 300);
    expect(a.rBar).toBeCloseTo(R_SCENE * HYPER_RBAR_LO, 12);
    expect(b.rBar).toBeCloseTo(R_SCENE * HYPER_RBAR_HI, 12);
    expect(b.fC).toBeCloseTo(1 - (16 * sphereVol(b.rBar)) / V0, 12);
    expect(b.fC).toBeGreaterThan(0.98);
    expect(b.rC0).toBeCloseTo(R_SCENE * Math.cbrt(b.fC), 12);
  });
```

(c) Replace `const fireAt = …` with:

```js
const REACH = 1.175;
const fireAt = (over = {}) => fireHyper(createFamily(1), {
  N: 16, eH: 1, seed: 3, omega: [0, 12, 0], pxPerUnit: 300, orbitS: 3, reach: REACH, target: 12, ...over,
});
```

(d) Replace the whole `describe('fireHyper (launch)', …)` block with:

```js
describe('fireHyper (aimed launch, spec §10.2)', () => {
  it('lays out N free beads inside the old surface, all fragment volume out, the core waiting', () => {
    const f = fireAt();
    const m = splitMass(16, 1, 3, 300);
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
    expect(Math.abs(v + m.fC * V0 - V0) / V0).toBeLessThan(1e-9);
    expect(f.rC0).toBeCloseTo(m.rC0, 12);
    expect(f.tGrace).toBe(HYPER_GRACE_S);
  });

  it('the swarm centre of mass is still', () => {
    const f = fireAt();
    const m = [0, 0, 0];
    let V = 0;
    for (const b of f.bodies) { for (let c = 0; c < 3; c++) m[c] += b.vol * b.v[c]; V += b.vol; }
    expect(Math.hypot(...m) / V).toBeLessThan(1e-9);
  });

  it('the vortex axis is the spin axis, and the beads hug the spin plane', () => {
    const f = fireAt();
    expect(f.axisL).toEqual([0, 1, 0]);
    const meanCos = f.bodies.reduce((a, b) => a + Math.abs(b.p[1]) / Math.hypot(...b.p), 0) / f.bodies.length;
    expect(meanCos).toBeLessThan(0.25); // a uniform sphere gives 0.5; HYPER_EQ_BIAS 0.64 gives ~0.18
  });

  it('every bead settles in the annulus between the core and the reach after HYPER_AIM_S', () => {
    for (const seed of [3, 4, 5]) {
      const f = fireAt({ seed });
      const a = [0, 0, 0];
      for (const b of f.bodies) {
        const p = [...b.p], v = [...b.v];
        for (let i = 0; i < Math.round(HYPER_AIM_S / DROP_DT); i++) {
          hyperAccel(f.mu, 0, f.gammaH, f.axisL, p[0], p[1], p[2], v[0], v[1], v[2], f.rC0, DROP_DT, a);
          for (let c = 0; c < 3; c++) { v[c] += a[c] * DROP_DT; p[c] += v[c] * DROP_DT; }
        }
        const r = Math.hypot(...p);
        expect(r, `seed ${seed} bead r ${b.r}`).toBeGreaterThan(f.rC0 + 1.5 * b.r); // clear of the core
        expect(r, `seed ${seed} bead r ${b.r}`).toBeLessThan(REACH - b.r + 0.01);
      }
    }
  });

  it('pull from the orbit knob, fixed drag, hang from the target, provisional headwind, same seed same swarm', () => {
    const f = fireAt();
    expect(f.mu).toBeCloseTo(hyperMu(3), 12);
    expect(f.gammaH).toBe(HYPER_GAMMA);
    expect(f.tHang).toBeCloseTo(HYPER_HANG_K * 12, 12);
    expect(f.eta).toBe(ETA_HI);
    expect(fireAt().bodies.map((b) => b.v)).toEqual(f.bodies.map((b) => b.v));
  });
});
```

(e) Replace the `coreScale` test body with:

```js
  it('1 for a phase-5 or idle family; eases to cbrt(1 - volOut/V0) over T_BURST; regrows as volume drains back', () => {
    expect(coreScale(createFamily(1))).toBe(1);
    const f = fireAt();
    expect(coreScale(f)).toBe(1);
    f.t = T_BURST;
    expect(coreScale(f)).toBeCloseTo(Math.cbrt(1 - f.volOut / V0), 9);
    f.volOut *= 0.5;
    expect(coreScale(f)).toBeCloseTo(Math.cbrt(1 - f.volOut / V0), 9);
  });
```

In `src/terminal/mercury/planet/__tests__/hyperStep.test.js`, in the test `'a new family is not hyper, and a phase-5 fire clears a stale hyper flag'`, add `expect(f.tHang).toBe(0);` after `expect(f.tGrace).toBe(0);` (both places), and add `tHang: 3` to the `Object.assign(f, { hyper: true, … })` that makes the stale family.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/hyperFling.test.js src/terminal/mercury/planet/__tests__/hyperStep.test.js`
Expected: FAIL (`HYPER_RBAR_LO`, `HYPER_GAMMA`, `HYPER_AIM_S`, `HYPER_HANG_K` undefined; `f.tHang` undefined).

- [ ] **Step 4: Family field `tHang`**

In `src/terminal/mercury/planet/breakupFamily.js`, `createFamily` (line ~64): change
`hyper: false, tGrace: 0, rC0: 0, axisL: [0, 0, 1], gammaH: 0, eta: 0, vRefH: 0,`
to
`hyper: false, tGrace: 0, tHang: 0, rC0: 0, axisL: [0, 0, 1], gammaH: 0, eta: 0, vRefH: 0,`
and in `fireFamily` (line ~158) change `hyper: false, tGrace: 0, tcScale: 1, vRefH: 0 });` to `hyper: false, tGrace: 0, tHang: 0, tcScale: 1, vRefH: 0 });`.

- [ ] **Step 5: hyperFling.js constants**

Change the import line `import { WOB_BIRTH, cascadeDuration } from './breakupStep';` to:

```js
import { WOB_BIRTH, DROP_DT, hyperAccel, cascadeDuration } from './breakupStep';
```

Replace the two `F_CORE_*` lines with:

```js
export const HYPER_RBAR_LO = 0.06;     // the beads' volume-mean radius × R at eH 0… (V4 §10.1: the size is the knob,
export const HYPER_RBAR_HI = 0.08;     // …and at eH 1; ≈ 0.4–1.2 % of the planet flies, the core keeps the rest)
```

Change `HYPER_EQ_BIAS` to `0.64` with comment `// latitude squeeze toward the spin plane (V4: the simulated disc)`.

Change `HYPER_REACH_MIN_R` to `1.45` with comment `// …but never contain tighter than this × R (V4: a full-size core leaves no annulus at 1.25 in phone portrait)`.

Replace the four lines `HYPER_GAMMA_MAX`, `HYPER_GAMMA_ITERS`, `HYPER_CONTAIN_K`, `HYPER_CONTAIN_S` with:

```js
export const HYPER_GAMMA = 20;         // the vortex drag, 1/s (V4: fixed; explicit drag is stable below 2/h ≈ 240)
export const HYPER_AIM_S = 0.6;        // each bead's launch is aimed to settle at its radius after this long (§10.2)
export const HYPER_HANG_K = 0.5;       // the disc orbits for this share of the return target before the gather (§10.3)
```

Update the header comment's first line to mention Amendment V4: `// … (phase-6 spec §3, Amendments V1–V4; plan amendments A1–A2).`

- [ ] **Step 6: `splitMass` from the radius knob**

Replace the first four lines of `splitMass`'s body (from `const fC = …` through `const rBar = …`) so the function begins:

```js
export function splitMass(N, eH, seed, pxPerUnit) {
  const rBar = R_SCENE * (HYPER_RBAR_LO + (HYPER_RBAR_HI - HYPER_RBAR_LO) * eH);
  const vFrag = N * sphereVol(rBar);
  const fC = 1 - vFrag / V0;
  const rng = mulberry32(seed);
  const radii = new Array(N);
  for (let i = 0; i < N; i++) radii[i] = gammaMean1(rng, HYPER_FRAG_N);
  const lo = PX_FLOOR / pxPerUnit, hi = HYPER_R_MAX_K * rBar;
```

(the clamp-and-renormalise loop and the return are unchanged). `V0` is declared above `splitMass`; if it is declared below, move `export const V0 = sphereVol(R_SCENE);` up to just after the constants.

- [ ] **Step 7: The aimed launch**

Replace the comment block above `fireHyper` and the whole `fireHyper` function with:

```js
// A bead's radial kick so that, launched at ω × p + k p̂ and replayed alone under the vortex at η 0 for HYPER_AIM_S,
// it ends at radius rT (§10.2). The settle radius rises with k, so bisect. Fire time only; scratch is module-level.
const AIM_K_LO = -5, AIM_K_HI = 40, AIM_ITERS = 20;
const AIM_STEPS = Math.round(HYPER_AIM_S / DROP_DT);
const _ap = [0, 0, 0], _av = [0, 0, 0], _aa = [0, 0, 0];
function aimKick(mu, L, rC, p, d, omega, rT) {
  const settle = (k) => {
    for (let c = 0; c < 3; c++) _ap[c] = p[c];
    _av[0] = omega[1] * p[2] - omega[2] * p[1] + k * d[0];
    _av[1] = omega[2] * p[0] - omega[0] * p[2] + k * d[1];
    _av[2] = omega[0] * p[1] - omega[1] * p[0] + k * d[2];
    for (let i = 0; i < AIM_STEPS; i++) {
      hyperAccel(mu, 0, HYPER_GAMMA, L, _ap[0], _ap[1], _ap[2], _av[0], _av[1], _av[2], rC, DROP_DT, _aa);
      for (let c = 0; c < 3; c++) { _av[c] += _aa[c] * DROP_DT; _ap[c] += _av[c] * DROP_DT; }
    }
    return len3(_ap);
  };
  let lo = AIM_K_LO, hi = AIM_K_HI;
  for (let it = 0; it < AIM_ITERS; it++) {
    const mid = 0.5 * (lo + hi);
    if (settle(mid) < rT) lo = mid; else hi = mid;
  }
  return hi;
}

// The launch (§3.3, V4 §10.2): N small beads on a jittered Fibonacci sphere squeezed toward the spin plane, born
// just inside the old surface, each aimed to settle at a seeded radius in the annulus between the core and the
// reach; the swarm's mean velocity removed so its centre of mass stays at the pull's centre. The vortex axis is the
// spin axis, the drag is fixed, the hang is a share of the return target; the caller solves the gather headwind.
export function fireHyper(fam, { N, eH, seed, omega, pxPerUnit, orbitS, reach, target }) {
  const m = splitMass(N, eH, seed, pxPerUnit);
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const W = len3(omega);
  const z = W > 1e-6 ? [omega[0] / W, omega[1] / W, omega[2] / W] : [0, 1, 0];
  const a = Math.abs(z[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const xr = [a[1] * z[2] - a[2] * z[1], a[2] * z[0] - a[0] * z[2], a[0] * z[1] - a[1] * z[0]];
  const xl = len3(xr);
  const x = [xr[0] / xl, xr[1] / xl, xr[2] / xl];
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  const mu = hyperMu(orbitS);

  fam.bodies.length = 0; fam.necks.length = 0; fam.events.length = 0;
  Object.assign(fam, {
    phase: 'fired', hyper: true, t: 0, acc: 0, volResidual: 0, L: 0, e: 0, N, seed,
    tGrace: HYPER_GRACE_S, tHang: HYPER_HANG_K * target, rC0: m.rC0, mu, eta: ETA_HI, gammaH: HYPER_GAMMA,
    axisL: [z[0], z[1], z[2]],
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
    const lo = m.rC0 + 2.2 * r + 0.02, hi = reach - r - 0.03;
    const rT = hi > lo ? lo + (hi - lo) * rng() : lo;
    const k = aimKick(mu, fam.axisL, m.rC0, p, d, omega, rT);
    const v = [
      omega[1] * p[2] - omega[2] * p[1] + k * d[0],
      omega[2] * p[0] - omega[0] * p[2] + k * d[1],
      omega[0] * p[1] - omega[1] * p[0] + k * d[2],
    ];
    const vol = sphereVol(r);
    addBody(fam, { state: 'free', p, v, r, rMain: r, vol, tFree: 0, wobAmp: WOB_BIRTH, wobAxis: [d[0], d[1], d[2]] });
    for (let q = 0; q < 3; q++) mv[q] += vol * v[q];
    V += vol;
  }
  for (const b of fam.bodies) for (let q = 0; q < 3; q++) b.v[q] -= mv[q] / V;
  fam.volFamily = V;
  fam.volOut = V;
  fam.vRefH = V / N; // cohesion's reference volume for this family: its mean bead (breakupStep.flight)
  let rMax = 0;
  for (const b of fam.bodies) if (b.r > rMax) rMax = b.r;
  fam.tcScale = Math.min(1, HYPER_CASCADE_S / cascadeDuration(rMax, pxPerUnit));
  return fam;
}
```

(`len3` is the existing helper above `fireHyper`; keep it.)

- [ ] **Step 8: Delete the containment solve**

In `src/terminal/mercury/planet/breakupBudget.js`: delete the `solveContainment` function and its two-line comment above it, and remove `HYPER_GAMMA_MAX, HYPER_GAMMA_ITERS, HYPER_CONTAIN_K, HYPER_CONTAIN_S` from the `'./hyperFling'` import (keep `ETA_LO, ETA_HI, ETA_ITERS`).

In `src/terminal/mercury/planet/__tests__/hyperBudget.test.js`:
- remove `solveContainment` from the `'../breakupBudget'` import and `HYPER_CONTAIN_K, HYPER_CONTAIN_S, HYPER_GAMMA_MAX` from the `'../hyperFling'` import; add `HYPER_GAMMA` to it;
- delete the whole `describe('solveContainment', …)` block;
- in `'fireHyper scales the largest bead cascade to HYPER_CASCADE_S'` (small V4 beads may already cascade within HYPER_CASCADE_S, so tcScale can be 1), replace the last line `expect(cascadeDuration(rMax, 300, f.tcScale)).toBeCloseTo(HYPER_CASCADE_S, 9);` with:

```js
    if (cascadeDuration(rMax, 300) > HYPER_CASCADE_S) expect(cascadeDuration(rMax, 300, f.tcScale)).toBeCloseTo(HYPER_CASCADE_S, 9);
    else expect(f.tcScale).toBe(1);
```

- replace the whole `describe('stability at the drag bracket top', …)` block with:

```js
describe('the fixed vortex drag', () => {
  it('sits well inside the explicit-drag stability bound γ · h < 2', () => {
    expect(HYPER_GAMMA * DROP_DT).toBeLessThan(1);
  });
});
```

In `src/terminal/mercury/planet/__tests__/hyperStep.test.js`:
- change the hyperFling import to `import { coreScale, hyperReach } from '../hyperFling';` and the breakupBudget import to `import { createMuSolver, finishMuSolver } from '../breakupBudget';`;
- in the test `'over 20 seeds no FREE bead leaves 1.02 · reach …'`: rename it to `'over 20 seeds no FREE bead leaves 1.02 · reach in the first 3 s, and every family comes home by 30 s'`; change `const f = firedHyper({ N: 32, seed });` to `const f = firedHyper({ N: 32, seed, reach, target: 14 });`; delete the line `f.gammaH = solveContainment(f, env0.pxPerUnit, reach, 8);`; change `if (f.t <= HYPER_CONTAIN_S)` to `if (f.t <= 3)`; change its comment to `// free flight only: merging pairs and cascade hops ride the core (HOP_K · r), not the aim`.

Delete the uncommitted file `src/terminal/mercury/planet/__tests__/hyperSweep.test.js` (`Remove-Item src/terminal/mercury/planet/__tests__/hyperSweep.test.js`).

- [ ] **Step 9: Wiring and knob**

In `src/terminal/mercury/planet/planetLook.js` delete the line `hyperRadial: 2, …`.

In `src/terminal/mercury/MercuryPlanet.jsx`:
- remove `, solveContainment` from the `'./planet/breakupBudget'` import;
- replace the comment above `fireHyperDrop` and its body with:

```js
// Phase 6 (V4): release with the spin pinned and a fast pointer → a spray of small beads aimed into a disc. The gather
// headwind η is solved by the sliced solver before the hang ends.
function fireHyperDrop(drop, eH, heatK, camera, bufferW, bufferH, t) {
  const fam = drop.fam, env = drop.env;
  const rVis = camera.position.length() * Math.tan((camera.fov * Math.PI) / 360) * Math.min(1, bufferW / Math.max(bufferH, 1));
  drop.fires = (drop.fires + 1) | 0;
  const seed = (Math.imul(drop.fires, 2654435761) ^ Math.floor(t * 1000)) >>> 0 || 1;
  const target = returnTarget(heatK, PLANET_TUNE.dropDrift);
  fireHyper(fam, {
    N: drop.hyperN, eH, seed, omega: env.omega, pxPerUnit: env.pxPerUnit,
    orbitS: PLANET_TUNE.hyperOrbit, reach: hyperReach(rVis), target,
  });
  drop.solver = createMuSolver(fam, env, target);
  drop.warned = false;
}
```

- [ ] **Step 10: Run the tests**

Run: `npx vitest run src/terminal/mercury`
Expected: PASS. If `'every bead settles in the annulus …'` fails, record which seed/bead and its settle radius versus the bounds, and stop (BLOCKED): do not change the bounds or constants.

- [ ] **Step 11: Lint and commit**

Run: `npm run lint` (0 errors, ≤ 143 warnings). Then:

```bash
git add src/terminal/mercury/planet/hyperFling.js src/terminal/mercury/planet/breakupFamily.js src/terminal/mercury/planet/breakupBudget.js src/terminal/mercury/planet/planetLook.js src/terminal/mercury/MercuryPlanet.jsx src/terminal/mercury/planet/__tests__/hyperTestKit.js src/terminal/mercury/planet/__tests__/hyperFling.test.js src/terminal/mercury/planet/__tests__/hyperBudget.test.js src/terminal/mercury/planet/__tests__/hyperStep.test.js
git commit -m "feat(mercury): hyper-fling V4 launch: small beads aimed into a disc, fixed drag, containment solve removed (phase 6a)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Orbit, then gather

**Files:**
- Modify: `src/terminal/mercury/planet/breakupStep.js` (`flight`)
- Modify: `src/terminal/mercury/planet/breakupBudget.js` (`beginParticles`, `runParticles`)
- Modify: `src/terminal/mercury/planet/planetLook.js` (`hyperOrbit`)
- Modify: `src/terminal/mercury/MercuryPlanet.jsx` (solver deadline)
- Test: `src/terminal/mercury/planet/__tests__/hyperStep.test.js`, `hyperBudget.test.js`

**Interfaces:**
- Consumes: family field `tHang` (Task 1), `fam.eta` (the solved gather headwind), `env.kappa`.
- Produces: the schedule `hang = fam.hyper && fam.t < fam.tHang` → η 0 and κ 0; else `fam.eta` and `env.kappa`. Test-particle trials carry `tr.tHang` (from `template.tHang ?? 0`) and use η 0 while `tr.t < tr.tHang`. Both increment `t` before computing the acceleration, so the schedules line up step for step.

- [ ] **Step 1: Write the failing tests**

Append to `src/terminal/mercury/planet/__tests__/hyperStep.test.js`:

```js
describe('orbit, then gather (V4 §10.3)', () => {
  it('before tHang the headwind is off: a circular orbit holds; after it the bead spirals in', () => {
    const f = hyperFam({ eta: 0.3, tHang: 2 });
    const r0 = 0.9;
    const b = freeBody(f, [r0, 0, 0], [0, Math.sqrt(1 / r0), 0], 0.05);
    runFor(f, 1.9, coreEnv(f));
    expect(Math.hypot(...b.p)).toBeGreaterThan(r0 * 0.99);
    runFor(f, 1.5, coreEnv(f));
    expect(Math.hypot(...b.p)).toBeLessThan(r0 * 0.95);
  });

  it('before tHang cohesion is off; after it, it pulls', () => {
    const mk = () => {
      const f = hyperFam({ mu: 0, gammaH: 0, tHang: 0.5, vRefH: 1e-3 });
      const a = freeBody(f, [0.9, 0, 0], [0, 0, 0], 0.02);
      const o = freeBody(f, [0.9, 0.3, 0], [0, 0, 0], 0.02);
      return { f, a, o };
    };
    const env = (f) => testEnv({ kappa: 0.1, planetRadiusAt: () => f.rC0 });
    const s = mk();
    runFor(s.f, 0.45, env(s.f));
    expect(Math.hypot(...s.a.v)).toBe(0);
    runFor(s.f, 0.2, env(s.f));
    expect(s.a.v[1]).toBeGreaterThan(0); // pulled toward o
  });
});
```

Append to `src/terminal/mercury/planet/__tests__/hyperBudget.test.js`:

```js
describe('test particles follow the orbit-then-gather schedule', () => {
  it('a lone bead arrives at the same time live and in the trial with a hang', () => {
    const mk = () => { const f = oneBead(0.3); f.tHang = 2; return f; };
    const live = mk();
    const tr = beginParticles(mk(), 300, { eta: 0.3, gamma: 10, tMax: 60 });
    runParticles(tr, Infinity);
    const env = testEnv({ kappa: 0, planetRadiusAt: () => live.rC0 });
    let tArr = -1;
    for (let i = 0; i < 60 / DROP_DT && tArr < 0; i++) {
      stepFamily(live, DROP_DT, env);
      if (live.bodies[0].state === 'cascade') tArr = live.t;
    }
    expect(tArr).toBeGreaterThan(2);
    expect(Math.abs(tr.out[0] - cascadeDuration(0.05, 300) - tArr)).toBeLessThan(2 * DROP_DT);
  });

  it('a hang delays the arrival by about the hang', () => {
    const T = (tHang) => { const f = oneBead(0.3); f.tHang = tHang; const tr = beginParticles(f, 300, { eta: 0.3, gamma: 10, tMax: 60 }); runParticles(tr, Infinity); return tr.tEnd; };
    expect(T(3) - T(0)).toBeGreaterThan(2.5);
    expect(T(3) - T(0)).toBeLessThan(3.5);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/hyperStep.test.js src/terminal/mercury/planet/__tests__/hyperBudget.test.js`
Expected: FAIL (the orbit decays before tHang; cohesion acts before tHang; the trial ignores tHang).

- [ ] **Step 3: The live schedule**

In `src/terminal/mercury/planet/breakupStep.js`, `flight`: after the line `const vRef = fam.hyper ? fam.vRefH : env.vRef;` add:

```js
  // V4 §10.3: a hyper family orbits as a disc until tHang (no headwind, no cohesion), then gathers
  const hang = fam.hyper && fam.t < fam.tHang;
  const eta = hang ? 0 : fam.eta;
  const kappa = hang ? 0 : env.kappa;
```

In the hyper branch change `hyperAccel(fam.mu, fam.eta, …` to `hyperAccel(fam.mu, eta, …`. Change `if (env.kappa > 0) {` to `if (kappa > 0) {` and, inside the cohesion loop, `(env.kappa * (vo / vRef))` to `(kappa * (vo / vRef))`. For a phase-5 family `hang` is false, so `kappa === env.kappa` and nothing changes.

- [ ] **Step 4: The particle schedule**

In `src/terminal/mercury/planet/breakupBudget.js`, `beginParticles`: in the `tr` object literal, after `tGrace: template.tGrace,` add `tHang: template.tHang ?? 0,`. In `runParticles`, right after `tr.t += h;` add:

```js
    const eta = tr.t < tr.tHang ? 0 : tr.eta; // V4 §10.3: the same orbit-then-gather schedule as the live flight
```

and change `hyperAccel(tr.mu, tr.eta, …` to `hyperAccel(tr.mu, eta, …`.

- [ ] **Step 5: Knob and solver deadline**

In `src/terminal/mercury/planet/planetLook.js` change `hyperOrbit: 3.5,` to `hyperOrbit: 3,` and its comment to `// phase 6: orbital period at the old surface, s: sets the pull, so the turns of the disc (V4: 3 passes the gate)`.

In `src/terminal/mercury/MercuryPlanet.jsx`, in the fired branch, replace

```js
        // phase 5: due at the first neck snap; phase 6 (no necks): due when the birth grace ends (spec §3.6)
        const due = fam.hyper ? fam.tGrace - fam.t : nextSnapIn(fam);
```

with

```js
        // phase 5: due at the first neck snap; phase 6: due when the hang ends (η is unused before it, V4 §10.3)
        const due = fam.hyper ? fam.tHang - fam.t : nextSnapIn(fam);
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/terminal/mercury`
Expected: PASS (all Phase 5 `breakup*.test.js` unmodified and passing).

- [ ] **Step 7: Lint and commit**

Run: `npm run lint`. Then:

```bash
git add src/terminal/mercury/planet/breakupStep.js src/terminal/mercury/planet/breakupBudget.js src/terminal/mercury/planet/planetLook.js src/terminal/mercury/MercuryPlanet.jsx src/terminal/mercury/planet/__tests__/hyperStep.test.js src/terminal/mercury/planet/__tests__/hyperBudget.test.js
git commit -m "feat(mercury): hyper-fling orbit-then-gather: no headwind or cohesion until tHang, solver due at tHang, hyperOrbit 3 (phase 6a V4)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Sweep, spiral gate, live smoke, look sheet

**Files:**
- Create: `src/terminal/mercury/planet/__tests__/hyperSweep.test.js`
- Tools (gitignored): `.superpowers/sdd/tools/hyperSmoke.mjs` (exists from the first Task 8; extend it)

**Interfaces:**
- Consumes: `fireHyper` (Task 1 signature), `returnTarget`, `createMuSolver`, `finishMuSolver`, `particleTurns`, `beginParticles`, `runParticles` (`breakupBudget`), `hyperReach`, `HYPER_N` (`hyperFling`), `PLANET_TUNE`, `CAMERA_DIST`, `CAMERA_FOV_DEG` (`planetLook`).
- Produces: the permanent gate (4 fixed cases) and the opt-in full sweep.

- [ ] **Step 1: Write the sweep and the gate**

Create `src/terminal/mercury/planet/__tests__/hyperSweep.test.js`:

```js
// src/terminal/mercury/planet/__tests__/hyperSweep.test.js — phase 6a acceptance (spec §10.5).
// The full sweep: $env:HYPER_SWEEP='1'; npx vitest run src/terminal/mercury/planet/__tests__/hyperSweep.test.js
import { describe, it, expect } from 'vitest';
import { createFamily, DROP_V_REF } from '../breakupFamily';
import { returnTarget, createMuSolver, finishMuSolver, particleTurns, beginParticles, runParticles } from '../breakupBudget';
import { fireHyper, hyperReach, HYPER_N } from '../hyperFling';
import { PLANET_TUNE, CAMERA_DIST, CAMERA_FOV_DEG } from '../planetLook';
import { median } from './hyperTestKit';

const TURNS_MIN = 1.5;
const rVisOf = (cam, aspect) => CAMERA_DIST[cam] * Math.tan((CAMERA_FOV_DEG[cam] * Math.PI) / 360) * Math.min(1, aspect);
const VIEWS = { desktop: rVisOf('desktop', 1.6), phone: rVisOf('mobile', 0.45) };
const AXES = { y: [0, 12, 0], x: [12, 0, 0], xy: [12 / Math.SQRT2, 12 / Math.SQRT2, 0] };

function hyperCase({ N, eH, seed, axis, heat, view, pxPerUnit = 300 }) {
  const omega = AXES[axis];
  const reach = hyperReach(VIEWS[view]);
  const target = returnTarget(heat, PLANET_TUNE.dropDrift);
  const f = fireHyper(createFamily(seed), { N, eH, seed, omega, pxPerUnit, orbitS: PLANET_TUNE.hyperOrbit, reach, target });
  const env0 = { q: [0, 0, 0, 1], omega, gamma: PLANET_TUNE.dropDrag, kappa: PLANET_TUNE.dropCohesion, vRef: DROP_V_REF, pxPerUnit, omegaTh: PLANET_TUNE.breakOmega };
  const s = finishMuSolver(createMuSolver(f, env0, target));
  const tr = beginParticles(f, pxPerUnit, { eta: s.best, gamma: f.gammaH, tMax: target });
  runParticles(tr, Infinity);
  return { landed: s.landed, eta: s.best, turns: median(particleTurns(f, pxPerUnit, s.best, target)), rMax: tr.rMax, reach, target };
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

describe.skipIf(!process.env.HYPER_SWEEP)('hyper-fling sweep (spec §10.5)', () => {
  it('100 % land, median turns ≥ 1.5, containment holds', () => {
    const rows = [];
    for (const view of ['desktop', 'phone']) for (const N of [8, 14, 16].filter((n) => n <= HYPER_N.full))
      for (const eH of [0, 0.5, 1]) for (const axis of Object.keys(AXES)) for (const heat of [28, 60, 120]) for (let seed = 1; seed <= 20; seed++)
        rows.push({ view, N, eH, axis, heat, seed, ...hyperCase({ N, eH, seed, axis, heat, view }) });
    const bad = rows.filter((r) => !r.landed || r.rMax > r.reach * (1 + 1e-9));
    const turns = rows.map((r) => r.turns), eta = rows.map((r) => r.eta);
    console.log(`cases ${rows.length}; not landed / uncontained ${bad.length}; turns median ${median(turns).toFixed(2)} min ${Math.min(...turns).toFixed(2)};`
      + ` eta ${Math.min(...eta).toExponential(2)}..${Math.max(...eta).toExponential(2)}`);
    for (const v of ['desktop', 'phone']) {
      const t = rows.filter((r) => r.view === v).map((r) => r.turns);
      console.log(`${v}: turns median ${median(t).toFixed(2)} min ${Math.min(...t).toFixed(2)}`);
    }
    for (const h of [28, 60, 120]) console.log(`heat ${h}: not landed ${rows.filter((r) => r.heat === h && !r.landed).length}`);
    expect(bad).toEqual([]);
    expect(median(turns)).toBeGreaterThanOrEqual(TURNS_MIN);
  }, 1_800_000);
});
```

(N 32 is gone from the sweep: `drop.hyperN` clamps to the tier caps, 16 full / 8 phone.)

- [ ] **Step 2: Run the fixed sample**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/hyperSweep.test.js`
Expected: 4 PASS, sweep skipped. **If a case fails, do not change `TURNS_MIN`, the knobs or the physics.** Record the case and its numbers and go to Step 4.

- [ ] **Step 3: Run the full sweep**

Run (PowerShell): `$env:HYPER_SWEEP='1'; npx vitest run src/terminal/mercury/planet/__tests__/hyperSweep.test.js; Remove-Item Env:HYPER_SWEEP`
Expected: PASS. Record the printed lines in `.superpowers/sdd/progress.md` under the phase 6a heading.

- [ ] **Step 4: Decision point (only if Step 2 or 3 failed)**

Stop and report the numbers. Knobs are the author's: `hyperOrbit` (shorter → more turns), `HYPER_HANG_K`, `HYPER_RBAR_*`, `HYPER_REACH_MIN_R`. Heat-28 non-landings near `MIN_RETURN_S` are expected to be the hard case; report which heats fail.

- [ ] **Step 5: Live smoke and look sheet**

Extend `.superpowers/sdd/tools/hyperSmoke.mjs` (CDP :5175, `--enable-unsafe-swiftshader`, wait until `window.__mercuryTune` exists) so that after `__mercuryTune.hyperNow(1)` it records, per run: `__mercuryDrop.solver` (`kind`, `best`, `landed`), the family's `tHang`, time to idle versus the target, the maximum |p| of free beads, the number of merge starts (count transitions of bodies into `state === 'merging'`), live turns per bead about `fam.axisL` (accumulate the in-plane angle of free beads each frame; report the median), console errors, and draw calls before and after. Run it 3 times (no shot) and once with frames at 0.25, 1, 3, 6, 9, 12 s. Build a sheet with the existing `mkSheet` tool into `.superpowers/sdd/look/45-hyper-6a-v4.png` at a width that keeps every bead in frame. **Look at the sheet** and write down frame by frame what it shows: the burst, the disc, the swirl, the gather, merges, the return, any artefact. Be honest, not promotional.

- [ ] **Step 6: Full verification**

Run: `npx vitest run` then `npm run lint`
Expected: everything passes except the known `compositeDpr`; lint 0 errors, warnings ≤ 143.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/mercury/planet/__tests__/hyperSweep.test.js
git commit -m "test(mercury): hyper-fling V4 acceptance: fixed gate + opt-in sweep (phase 6a)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: CHECKPOINT, the author's look call.** Hand over the sheet, the sweep numbers, the live smoke numbers and the Gate 0 status. Phase 6a is done when the author approves the look. Do not push; wait for an explicit push command.

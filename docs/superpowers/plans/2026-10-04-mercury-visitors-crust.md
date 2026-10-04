# Mercury Visitors Matrix — Amendment A (Water and Fire on Crust) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Water and fire meet the crust as themselves, inside the 35° aim cone.
- Water on any crust flash-boils into a **quench rind**: a pale evaporite ring round a dark glassy core.
- Fire on any crust re-melts a small **Hg pool in the rock**, which refreezes into a polished **glaze** disc.
- The marks last until the planet changes state.
- The cold-limb aim is reverted.

**Architecture:** The new kinds `quench` and `crustpool` extend the matrix units built by plan
`2026-10-04-mercury-visitors-matrix.md` (Tasks 1–8 there). `crustpool` reuses the pool's slot and ember.
- `visitorSim.js` gets the crust branch, the residents and the stamps.
- `scarMap.js` gets the quench stamp in byte B and a state-crossing wipe.
- `visitorFrame.js` gets the quench slot and its steam.
- The planet shader gets:
  - the crust-path marks
  - the live quench
  - the pool opening in the rock
  - the refreezing pool's glaze
- `MercuryPlanet.jsx` drains quench stamps, wipes marks on a liquid/crust crossing, and runs `healMelted` only while liquid.

**Tech Stack:** React 19 + @react-three/fiber, three r183 RawShaderMaterial (GLSL3), vitest. CDP probe tools live in
`.superpowers/sdd/tools/` (gitignored scratch) and need the dev server on :5175.

**Spec:** `docs/superpowers/specs/2026-10-04-mercury-visitors-matrix-design.md` §9 (amendment A, commit 3b7b5c39).
The branch is `feature/mercury-matrix`, at HEAD 3b7b5c39 when this plan was written.

## Global Constraints

- **Phase 3/5 tables stay byte-identical:**
  - `IMPACT_MODE_AMP = { splash: 0.035, ring: 0.015, crater: 0 }`
  - `IMPACT_WAVE_AMP = { splash: 0.35, ring: 0.2, crater: 0 }`
  - `WAVE_DAMP_PER_S` keeps `splash: 1.0, wake: 1.6, ring: 3.0`
- **Unchanged behaviour:**
  - Phase 1 on liquid and boiling Hg: film, bead, ember, rock and jet keep their constants and looks.
  - The matrix's sink, strip, frost and pool keep their behaviour.
  - Frost and pool on frozen Hg stay built but dormant (spec A4).
- **Every landing uses the 35° aim** (`AIM_MAX_RAD`, spec A2). No other aim path may exist.
- **Idle cost is zero:**
  - With no live visitor, `stepVisitors` and `packVisitors` return before any loop.
  - With no marks, `healMelted`, `clearMarks` and the crossing wipe do nothing.
  - The per-frame step and pack paths allocate nothing. A launch or a stamp may allocate.
- **Shader parity:** stripping every `// visitors` line and every `// <visitors>` … `// </visitors>` block from `PLANET_FS`
  must give back `src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.pre-visitors.fs.glsl` byte for byte.
  - Never edit a line that has no visitors marker.
  - Every GLSL line added to `main()` carries `// visitors`.
- **Calm variant:**
  - It compiles `VISIT_SLOTS = 0`.
  - Reduced motion means no spread, growth or sinking: the stamping kinds stamp at touchdown.
  - The persistent marks still draw (`uMarksOn`).
- **Surface slots per tier** are unchanged: full 4, phone 2, lite 1. JS still writes `VISIT_SURF_MAX = 4`.
- **Lint gate:** `npm run lint` must pass (0 errors, warnings under the `--max-warnings` in package.json). Do not sweep
  `exhaustive-deps`.
- **Commits:**
  - One commit per task on `feature/mercury-matrix`.
  - Every message ends with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Stage files by path only: never `.import-cache.json`, `src/terminal/views/manifesto/__tests__/__snapshots__/councilField.test.jsx.snap`
    or `baseline/`.
  - **Never push.**
- **Tests:** run with `npx vitest run <path>` from the repo root `F:\scale_9.4`. Run the whole `src/terminal/mercury` before
  each commit.

## Plan decisions (spec clarifications, each recorded in a code comment)

- **Q-1:** The quench's steam is a short vertical `VIS_PLUME` streamer.
  - The spec says "the bead's steam body", but the bead's steam is drawn inside `VIS_BEAD` and cannot be drawn on its own.
  - The plume is the visitor pass's free vapour body.
- **Q-2:** `crustpool` packs exactly like `pool`: the ember body plus a `SURF_POOL` slot.
  - The shader tells crust from transmuted Hg by the local transmutation weight (`visFluid`), not by a slot code.
  - Inside the transmuted region the existing `liquidW` raise draws it. Outside, a new crust overlay draws it.
- **Q-3:** Glaze on crust is drawn as a smooth **frozen-Hg** disc, because the re-melted crust became Hg and then refroze:
  - `SOLID_HG_ALBEDO` diffuse;
  - `SOLID_HG_SPECULAR · fresnelHg · aetherMirror(R, GLAZE_ROUGH)`.

  While the pool refreezes (`A.y` 0 → 1) the same look fades in through `visitPoolSolid`, so the stamp at the end of its
  life replaces it with no dip (matrix P-4).
- **Q-4:** The crust marks fetch the scar texel themselves.
  - The existing crust fetch line (`albedo = mix(albedo, RAY_ALBEDO, …)`) is not a visitors line.
  - Sharing it would break parity, so the extra fetch is gated on `uMarksOn`.
- **Q-5:** The R5 dark-side check (spec §9.8) spins the planet gently after stamping, so the body's rotation carries a rind
  toward the night limb.
  - The aim keeps every *landing* on the day side.
  - A drag of `melt(6)` stays below `MELT_HEAT_K`, so the planet stays crust.
- **Q-6:** Frozen-Hg frost and the quench share byte B, with different profiles.
  - The state-crossing wipe means they never coexist across a transition.
  - A dormant frost mark seen through crust pixels of a partly transmuted planet decodes as a quench. That is accepted:
    the frost branch is dormant.
- **Q-7:** The live rind gets its own slot code, `SURF_QUENCH = 8`. The spec says it reuses `SURF_FROST`, but:
  - `visitFrost` paints the frozen-Hg path, and the rind needs the quench profile (core plus ring) in the crust path.
  - A separate code keeps each reader to one look.
  - Slot counts per tier are unchanged.

## File map

| File | Status | Responsibility |
|------|--------|----------------|
| `src/terminal/mercury/planet/visitorSim.js` | modify | revert cold aim; crust branch; `quench` / `crustpool` residents, stamps, look constants |
| `src/terminal/mercury/planet/scarMap.js` | modify | `quenchProfile`, `stampQuench`, `crossMarks` |
| `src/terminal/mercury/planet/visitorFrame.js` | modify | `SURF_QUENCH` slot, quench steam, `crustpool` as `pool` |
| `src/terminal/mercury/planet/mercuryPlanetShader.js` | modify | crust marks, live quench, crust pool overlay, refreezing glaze |
| `src/terminal/mercury/MercuryPlanet.jsx` | modify | quench drain, crossing wipe, liquid-only `healMelted` |
| tests under `src/terminal/mercury/**/__tests__/` | create/modify | per task |
| `docs/superpowers/plans/2026-10-04-mercury-visitors-matrix.md` | modify (Task 1) | note P-6/P-7 superseded |
| `.superpowers/sdd/tools/visitorCrustSheet.mjs` | create (gitignored) | look sheet |

---

### Task 1: Revert the cold-limb aim

**Files:**
- Revert: commits `44d077d8` and `918487fd`. Together they touch `src/terminal/mercury/planet/visitorSim.js`,
  `src/terminal/mercury/planet/__tests__/visitorColdAim.test.js` and
  `docs/superpowers/plans/2026-10-04-mercury-visitors-matrix.md`.
- Modify: `src/terminal/mercury/planet/__tests__/visitorAim.test.js`
- Modify: `docs/superpowers/plans/2026-10-04-mercury-visitors-matrix.md` (one note)

**Interfaces:**
- Consumes: `launchVisitor`, `AIM_MAX_RAD` and `aimToward` (unchanged), and `ctxFor` from `visitorTestKit`.
- Produces: `visitorSim` no longer exports `coldLimbAim`, `COLD_AIM_MAX_RAD`, `COLD_AIM_MARGIN_K` or
  `COLD_AIM_HORIZON_PAD_RAD`. Every landing goes through `aimToward(…, AIM_MAX_RAD)`.

- [ ] **Step 1: Write the failing test.** Append inside the existing `describe` in
  `src/terminal/mercury/planet/__tests__/visitorAim.test.js`. The file already defines `len` and `ang`, and already
  imports `createVisitors`, `launchVisitor`, `AIM_MAX_RAD` and `ctxFor`. Add `import * as SIM from '../visitorSim';` to its
  imports.

```js
  it('water and fire on a cool liquid planet still land inside the cone (amendment A2: no cold-limb aim)', () => {
    for (const phase of ['fluid', 'thermal']) {
      const ctx = ctxFor(phase);
      ctx.tempOverrideK = null; ctx.tau = 1; ctx.heatK = 30; ctx.subsolarT = 572;
      const v = launchVisitor(createVisitors(), phase, ctx);
      expect(ang(v.dirWorld, [0, 0, 1])).toBeLessThanOrEqual(AIM_MAX_RAD + 1e-9);
    }
    expect(SIM.coldLimbAim).toBeUndefined();
    expect(SIM.COLD_AIM_MAX_RAD).toBeUndefined();
  });
```

- [ ] **Step 2: Run it and confirm it fails.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/visitorAim.test.js`
  - Expected: FAIL. The landing is ~64° out, and `coldLimbAim` is defined.

- [ ] **Step 3: Revert without committing.**
  - Run: `git revert --no-commit 44d077d8 918487fd`
  - Expected: no conflicts.
    - `visitorColdAim.test.js` is deleted.
    - The cold-aim block and its launch gate are gone from `visitorSim.js`.
    - The plan doc's P-6 strike and P-7 lines are gone.
  - If a conflict appears, resolve it by keeping HEAD's content everywhere *except* the cold-aim lines, then `git add` the
    files.

- [ ] **Step 4: Add the supersession note.** In `docs/superpowers/plans/2026-10-04-mercury-visitors-matrix.md`, append
  this line directly under the `- **P-6:** …` bullet (the last bullet of "Plan decisions"):

```markdown
- **Superseded (2026-10-04):** P-6's premise proved false live (the aim cone never reaches frozen Hg). The interim cold-limb aim (P-7) was reverted. Water and fire now meet the crust instead: spec §9 (amendment A), plan `2026-10-04-mercury-visitors-crust.md`.
```

- [ ] **Step 5: Run the tests and confirm they pass.**
  - Run: `npx vitest run src/terminal/mercury`
  - Expected: PASS, including the new aim test, with no failures from the deleted `visitorColdAim.test.js`.
  - Run: `npm run lint`. Expected: 0 errors.

- [ ] **Step 6: Commit.**

```bash
git add src/terminal/mercury/planet/visitorSim.js src/terminal/mercury/planet/__tests__/visitorAim.test.js docs/superpowers/plans/2026-10-04-mercury-visitors-matrix.md
git rm --cached --ignore-unmatch src/terminal/mercury/planet/__tests__/visitorColdAim.test.js
git commit -m "revert(mercury): visitors matrix — drop the cold-limb aim (amendment A2: every landing inside the 35 deg cone)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The crust branch, the quench and crust-pool residents, their stamps

**Files:**
- Modify: `src/terminal/mercury/planet/visitorSim.js`
- Modify: `src/terminal/mercury/planet/__tests__/visitorMatrix.test.js` (the crust branch assertions and the `STAMP_FOR` equality)
- Modify: `src/terminal/mercury/planet/__tests__/visitorSim.test.js` (one crust assertion)
- Test: `src/terminal/mercury/planet/__tests__/visitorCrust.test.js` (create)

**Interfaces:**
- Consumes: `impactBranch`, `RESIDENT_LIFE_S`, `IMPULSE_FOR`, `STAMP_FOR`, `stampRadius`, `touchdown`, `residentHeight`
  and `stepResident` (all in `visitorSim.js`); `runCollect` and `ctxFor` from `visitorTestKit`.
- Produces (later tasks rely on these exact names):
  - The kinds `'quench'` and `'crustpool'`.
  - `STAMP_FOR.quench === 'quench'` and `STAMP_FOR.crustpool === 'glaze'`.
  - `IMPULSE_FOR.quench === ''` and `IMPULSE_FOR.crustpool === ''`.
  - The constants:
    - `QUENCH_R` (0.05 rad)
    - `QUENCH_SPREAD_S` (0.6)
    - `QUENCH_STEAM_LEN` (0.06)
    - `QUENCH_STEAM_GROW_S` (0.15)
    - `SURF_QUENCH` (8)
  - The look constants:
    - `EVAPORITE_ALBEDO` `[0.86, 0.84, 0.78]`
    - `EVAPORITE_A` (0.85)
    - `QUENCH_DARK` (0.45)
    - `QUENCH_ROUGH` (0.15)
    - `GLASS_F0` (0.04)
  - `quenchRadius(a) → rad`
  - `stampRadius('quench') === QUENCH_R` and `stampRadius('crustpool') === POOL_R`

- [ ] **Step 1: Write the failing test.** Create `src/terminal/mercury/planet/__tests__/visitorCrust.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  createVisitors, createVisitorOut, launchVisitor, stepVisitors, impactBranch, residentHeight, stampRadius,
  RESIDENT_LIFE_S, IMPULSE_FOR, STAMP_FOR, T_FLIGHT, SOFT_TAU_MIN, POOL_R, POOL_GROW_S, POOL_FREEZE_S, EMBER_R,
  QUENCH_R, QUENCH_SPREAD_S, SURF_QUENCH, hotTempK, quenchRadius,
} from '../visitorSim';
import { LIQUID_TAU } from '../mercuryWaves';
import { ctxFor, runTo, runCollect } from './visitorTestKit';

function landedOnCrust(phase, tau = 0) {
  const buf = createVisitors();
  const ctx = ctxFor(phase, 400);
  ctx.tau = tau;
  const v = launchVisitor(buf, phase, ctx);
  const got = runCollect(buf, ctx, createVisitorOut(), T_FLIGHT[phase] + ctx.dt);
  return { buf, ctx, v, got };
}

describe('amendment A — water and fire on crust (matrix spec §9)', () => {
  it('the crust row: water quenches, fire re-melts a pool, earth sinks or craters, air craters', () => {
    for (const tau of [0, SOFT_TAU_MIN - 0.01, SOFT_TAU_MIN, LIQUID_TAU - 0.01]) {
      expect(impactBranch('fluid', tau, 400)).toBe('quench');
      expect(impactBranch('thermal', tau, 400)).toBe('crustpool');
      expect(impactBranch('air', tau, 400)).toBe('crater');
    }
    expect(impactBranch('earth', SOFT_TAU_MIN - 0.01, 400)).toBe('crater');
    expect(impactBranch('earth', SOFT_TAU_MIN, 400)).toBe('sink');
    expect(impactBranch('fluid', LIQUID_TAU, 400)).toBe('film');
    expect(impactBranch('thermal', LIQUID_TAU, 400)).toBe('ember');
  });
  it('the tables: lifetimes, no impulse (no crater), stamps and their radii', () => {
    expect(RESIDENT_LIFE_S).toMatchObject({ quench: QUENCH_SPREAD_S, crustpool: POOL_GROW_S + POOL_FREEZE_S });
    expect(IMPULSE_FOR).toMatchObject({ quench: '', crustpool: '' });
    expect(STAMP_FOR).toMatchObject({ quench: 'quench', crustpool: 'glaze' });
    expect(stampRadius('quench')).toBe(QUENCH_R);
    expect(stampRadius('crustpool')).toBe(POOL_R);
    expect(SURF_QUENCH).toBe(8);
  });
  it('the rind spreads from 0 to QUENCH_R over QUENCH_SPREAD_S, monotone', () => {
    expect(quenchRadius(0)).toBe(0);
    expect(quenchRadius(QUENCH_SPREAD_S)).toBeCloseTo(QUENCH_R, 12);
    expect(quenchRadius(10)).toBeCloseTo(QUENCH_R, 12);
    let prev = -1;
    for (let a = 0; a <= QUENCH_SPREAD_S; a += 0.05) { const r = quenchRadius(a); expect(r).toBeGreaterThanOrEqual(prev); prev = r; }
  });
  it('water on crust: one quench touchdown with no impulse, one quench stamp at the end of the spread', () => {
    const { buf, ctx, v, got } = landedOnCrust('fluid');
    expect(got.impacts).toHaveLength(1);
    expect(got.impacts[0].kind).toBe('quench');
    expect(got.impacts[0].impulse).toBe('');
    expect(v.state).toBe('resident');
    expect(v.fade).toBe(1);
    const later = runCollect(buf, ctx, createVisitorOut(), v.tImpact + QUENCH_SPREAD_S + 0.1);
    expect(later.stamps).toHaveLength(1);
    expect(later.stamps[0]).toMatchObject({ kind: 'quench', radius: QUENCH_R, seed: v.seed });
    expect(Math.abs(later.stamps[0].at - (v.tImpact + QUENCH_SPREAD_S))).toBeLessThanOrEqual(ctx.dt + 1e-9);
    expect(buf.live).toBe(0);
  });
  it('fire on crust: the ember sits in its pool, cools like a free ember, and stamps glaze when its life ends', () => {
    const { buf, ctx, v } = landedOnCrust('thermal', 0.3);
    expect(v.kind).toBe('crustpool');
    expect(v.r).toBe(EMBER_R);
    runTo(buf, ctx, createVisitorOut(), v.tImpact + 1);
    expect(v.tempK).toBeCloseTo(hotTempK(ctx.tS - v.tImpact), 6);
    expect(residentHeight(v, 1, RESIDENT_LIFE_S.crustpool, false)).toBeCloseTo(0.4 * EMBER_R, 12);
    expect(v.fade).toBe(1);
    const later = runCollect(buf, ctx, createVisitorOut(), v.tImpact + RESIDENT_LIFE_S.crustpool + 0.1);
    expect(later.stamps).toHaveLength(1);
    expect(later.stamps[0]).toMatchObject({ kind: 'glaze', radius: POOL_R });
  });
  it('a fling leaves the rind and the pool where they are (they are in the rock)', () => {
    for (const phase of ['fluid', 'thermal']) {
      const { buf, ctx, v } = landedOnCrust(phase);
      ctx.detach = true; ctx.omega = [0, 12, 0];
      ctx.tS += ctx.dt;
      stepVisitors(buf, ctx, createVisitorOut());
      expect(v.state).toBe('resident');
    }
  });
  it('reduced motion: both stamp at touchdown', () => {
    for (const [phase, kind] of [['fluid', 'quench'], ['thermal', 'glaze']]) {
      const buf = createVisitors();
      const ctx = ctxFor(phase, 400);
      ctx.tau = 0; ctx.calm = true;
      launchVisitor(buf, phase, ctx);
      const got = runCollect(buf, ctx, createVisitorOut(), 2 * ctx.dt);
      expect(got.stamps).toHaveLength(1);
      expect(got.stamps[0].kind).toBe(kind);
      expect(buf.live).toBe(0);
    }
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/visitorCrust.test.js`
  - Expected: FAIL (`quenchRadius` is not a function, and the kinds come out as `crater`).

- [ ] **Step 3: Implement it in `visitorSim.js`.**

  First, the tables at the top of the file. Replace the `RESIDENT_LIFE_S`, `IMPULSE_FOR` and `STAMP_FOR` blocks with:

```js
// How long each touchdown stays, s (0 = nothing stays), and the impulse it sends into the ring (mercuryWaves kinds).
export const RESIDENT_LIFE_S = Object.freeze({
  film: 8, bead: 6, ember: 6, rock: 12, jet: 1.5, ring: 0, crater: 0,
  frost: 1.5, pool: 4, sink: 5, strip: 1.5,   // matrix: frost = FROST_CREEP_S, pool = POOL_GROW_S + POOL_FREEZE_S, sink = SINK_S
  quench: 0.6, crustpool: 4,                  // amendment A: quench = QUENCH_SPREAD_S, crustpool = POOL_GROW_S + POOL_FREEZE_S
});
// Frost and the pool ring like any strike on solid Hg (plan P-5); a rock sinking into soft crust sends nothing, nor do
// water and fire meeting the crust (amendment A5: the rind and the pool replace the crater).
export const IMPULSE_FOR = Object.freeze({
  film: 'dimple', bead: 'dimple', ember: 'marangoni', rock: 'crown', jet: 'jet', ring: 'ring', crater: '',
  frost: 'ring', pool: 'ring', sink: '', strip: 'jet', quench: '', crustpool: '',
});
// The kinds that leave a persistent mark in the scar map when their life ends (matrix spec §4, §9).
export const STAMP_FOR = Object.freeze({ frost: 'frost', pool: 'glaze', sink: 'pit', quench: 'quench', crustpool: 'glaze' });
```

  Next, the constants. Directly after the line `export const PLUME_GROW_S = 0.4;`, add:

```js
// Amendment A (spec §9): water and fire on crust.
export const QUENCH_R = 0.05;              // rad: the quench rind at the end of its spread
export const QUENCH_SPREAD_S = 0.6;        // the drop flashes off the hot rock fast
export const QUENCH_STEAM_LEN = 0.06;      // scene units: the steam column it throws up (plan Q-1)
export const QUENCH_STEAM_GROW_S = 0.15;
```

  Change the surface-slot line to:

```js
export const SURF_FILM = 1, SURF_HOT = 2, SURF_MENISCUS = 3, SURF_JET = 4, SURF_FROST = 5, SURF_POOL = 6, SURF_COLLAR = 7, SURF_QUENCH = 8;
```

  After the line `export const POOL_RIM_H = 0.0025; …`, add:

```js
// The crust looks (amendment A, planet shader's crust path).
export const EVAPORITE_ALBEDO = [0.86, 0.84, 0.78];  // the pale ring the flashed drop leaves (its dissolved load)
export const EVAPORITE_A = 0.85;
export const QUENCH_DARK = 0.45;                      // the quenched glass skin darkens the rock under it…
export const QUENCH_ROUGH = 0.15;                     // …and is far smoother than it
export const GLASS_F0 = 0.04;                         // glass's normal-incidence reflectance (n ≈ 1.5)
```

  After `export const poolFreeze = …;`, add:

```js
export const quenchRadius = (a) => QUENCH_R * (1 - (1 - Math.min(1, Math.max(0, a / QUENCH_SPREAD_S))) ** 2);
```

  Replace `impactBranch` with:

```js
export function impactBranch(phase, tau, tempK) {
  if (tau < LIQUID_TAU) {
    // amendment A: water flash-quenches the hot rock; an ember re-melts a pool in it (any crust, hard or soft)
    if (phase === 'fluid') return 'quench';
    if (phase === 'thermal') return 'crustpool';
    return phase === 'earth' && tau >= SOFT_TAU_MIN ? 'sink' : 'crater';
  }
  if (tempK < HG_MELT_K) return phase === 'fluid' ? 'frost' : phase === 'thermal' ? 'pool' : 'ring';
  if (phase === 'fluid') return tempK >= LEIDENFROST_K ? 'bead' : 'film';
  if (phase === 'thermal') return 'ember';
  if (phase === 'earth') return 'rock';
  return tempK > HG_BOIL_K ? 'strip' : 'jet';
}
```

  Replace `stampRadius` with:

```js
export const stampRadius = (kind) => (kind === 'frost' ? FROST_R : kind === 'quench' ? QUENCH_R : kind === 'pool' || kind === 'crustpool' ? POOL_R : PIT_R);
```

  In `touchdown`, replace the line beginning `v.r = kind === 'bead' ? …` with:

```js
  v.r = kind === 'bead' ? BEAD_R : kind === 'rock' || kind === 'sink' ? ROCK_R : kind === 'ember' || kind === 'pool' || kind === 'crustpool' ? EMBER_R : 0;
```

  In `residentHeight`, replace `if (v.kind === 'ember' || v.kind === 'pool') return 0.4 * v.r;` with:

```js
  if (v.kind === 'ember' || v.kind === 'pool' || v.kind === 'crustpool') return 0.4 * v.r;
```

  In `stepResident`, replace `} else if (v.kind === 'ember' || v.kind === 'pool') {` with:

```js
  } else if (v.kind === 'ember' || v.kind === 'pool' || v.kind === 'crustpool') {
```

  Finally, update the comment in `stepVisitors` that says
  `// frost, the pool and a sinking rock are in or under the surface: a fling leaves them (plan P-3)` to:

```js
      // frost, the pools, the quench rind and a sinking rock are in or under the surface: a fling leaves them (plan P-3)
```

- [ ] **Step 4: Update the existing assertions that pinned "everything craters on crust."**

  In `src/terminal/mercury/planet/__tests__/visitorMatrix.test.js`, replace the test
  `'hard crust craters everything; soft crust sinks a rock and craters the rest'` with:

```js
  it('crust: water quenches, fire re-melts, a rock sinks into soft crust or craters hard crust, air craters (amendment A)', () => {
    expect(impactBranch('fluid', SOFT_TAU_MIN - 0.01, 400)).toBe('quench');
    expect(impactBranch('thermal', SOFT_TAU_MIN - 0.01, 400)).toBe('crustpool');
    expect(impactBranch('earth', SOFT_TAU_MIN - 0.01, 400)).toBe('crater');
    expect(impactBranch('air', SOFT_TAU_MIN - 0.01, 400)).toBe('crater');
    expect(impactBranch('earth', SOFT_TAU_MIN, 400)).toBe('sink');
    expect(impactBranch('earth', LIQUID_TAU - 0.01, 400)).toBe('sink');
    expect(impactBranch('air', 0.3, 400)).toBe('crater');
    expect(impactBranch('earth', LIQUID_TAU, 400)).toBe('rock');
  });
```

  In the same file, replace `expect(STAMP_FOR).toEqual({ frost: 'frost', pool: 'glaze', sink: 'pit' });` with:

```js
    expect(STAMP_FOR).toEqual({ frost: 'frost', pool: 'glaze', sink: 'pit', quench: 'quench', crustpool: 'glaze' });
```

  In `src/terminal/mercury/planet/__tests__/visitorSim.test.js`, replace
  `expect(impactBranch('fluid', LIQUID_TAU - 0.01, 400)).toBe('crater');` with:

```js
    expect(impactBranch('air', LIQUID_TAU - 0.01, 400)).toBe('crater');
```

- [ ] **Step 5: Run the tests and confirm they pass.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/visitorCrust.test.js`. Expected: PASS (7 tests).
  - Run: `npx vitest run src/terminal/mercury`. Expected: PASS. If another test pinned crust → crater for water or fire,
    update it exactly as in Step 4 and list it in the report.
  - Run: `npm run lint`. Expected: 0 errors.

- [ ] **Step 6: Commit.**

```bash
git add src/terminal/mercury/planet/visitorSim.js src/terminal/mercury/planet/__tests__/visitorCrust.test.js src/terminal/mercury/planet/__tests__/visitorMatrix.test.js src/terminal/mercury/planet/__tests__/visitorSim.test.js
git commit -m "feat(mercury): visitors matrix A1 — water quenches and fire re-melts a pool on any crust; their residents and stamps

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Scar map — the quench stamp and the state-crossing wipe

**Files:**
- Modify: `src/terminal/mercury/planet/scarMap.js`
- Test: `src/terminal/mercury/planet/__tests__/scarCrust.test.js` (create)

**Interfaces:**
- Consumes: the internal `forCap(map, d, capRad, (i, c) => …) → touched`, the internal `texHash(i, seed)` and
  `smooth01`, and the existing `clearMarks(map) → changed`.
- Produces:
  - `quenchProfile(s, h) → [0, 1]`, where `s` = angle / radius and `h` ∈ [0, 1) is the edge jitter. Its shape:
    - core = 1 for s < 0.55;
    - ring plateau = 0.5 for 0.7 < s < 0.95 + 0.1h;
    - 0 beyond 1.1 + 0.1h.
  - `stampQuench(map, d, radius, seed) → touched`. It writes byte B (max-combine) and sets `marksLive`.
  - `crossMarks(map, wasLiquid, isLiquid) → changed`. It wipes B and A when a boolean side changed. A `wasLiquid` of
    `null` (first frame) never wipes.

- [ ] **Step 1: Write the failing test.** Create `src/terminal/mercury/planet/__tests__/scarCrust.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createScarMap, stampQuench, stampGlaze, quenchProfile, crossMarks, texelDir } from '../scarMap';

const D = [0, 0, 1];
const angTo = (m, i) => { const d = texelDir(m, i % m.w, Math.floor(i / m.w)); return Math.acos(Math.min(1, d[0] * D[0] + d[1] * D[1] + d[2] * D[2])); };

describe('scar map — amendment A', () => {
  it('quenchProfile: a full core, a half-height evaporite plateau, nothing beyond 1.1 (+ jitter)', () => {
    expect(quenchProfile(0, 0)).toBe(1);
    expect(quenchProfile(0.5, 0.9)).toBe(1);
    expect(quenchProfile(0.8, 0)).toBeCloseTo(0.5, 12);
    expect(quenchProfile(0.94, 0)).toBeCloseTo(0.5, 12);
    expect(quenchProfile(1.1, 0)).toBeCloseTo(0, 12);
    expect(quenchProfile(1.15, 0.5)).toBeCloseTo(0, 12);
    expect(quenchProfile(1.05, 1)).toBeCloseTo(0.5, 12);
  });
  it('stampQuench writes only B, with the profile (core 255, ring ~128), and sets marksLive', () => {
    const m = createScarMap(512, 256);
    const before = Array.from(m.bytes);
    const r = 0.2;
    expect(stampQuench(m, D, r, 7)).toBeGreaterThan(0);
    expect(m.marksLive).toBe(true);
    let core = 0, ring = 0;
    for (let i = 0; i < m.w * m.h; i++) {
      expect(m.bytes[4 * i]).toBe(before[4 * i]);
      expect(m.bytes[4 * i + 1]).toBe(before[4 * i + 1]);
      expect(m.bytes[4 * i + 3]).toBe(before[4 * i + 3]);
      const s = angTo(m, i) / r, b = m.bytes[4 * i + 2];
      if (s < 0.5) { expect(b).toBe(255); core++; }
      if (s > 0.72 && s < 0.93) { expect(b).toBeGreaterThanOrEqual(126); expect(b).toBeLessThanOrEqual(129); ring++; }
      if (s > 1.25) expect(b).toBe(0);
    }
    expect(core).toBeGreaterThan(10);
    expect(ring).toBeGreaterThan(10);
  });
  it('stampQuench max-combines (a second, smaller stamp never lowers a texel)', () => {
    const m = createScarMap(256, 128);
    stampQuench(m, D, 0.2, 1);
    const first = Array.from(m.bytes);
    stampQuench(m, D, 0.1, 2);
    for (let i = 0; i < m.w * m.h; i++) expect(m.bytes[4 * i + 2]).toBeGreaterThanOrEqual(first[4 * i + 2]);
  });
  it('crossMarks wipes B and A only when the liquid/crust side changes, in either direction', () => {
    const m = createScarMap(64, 32);
    stampQuench(m, D, 0.3, 1);
    stampGlaze(m, D, 0.3);
    expect(crossMarks(m, null, false)).toBe(false);   // first frame: nothing to compare against
    expect(crossMarks(m, false, false)).toBe(false);  // still crust: the rinds stay
    expect(m.marksLive).toBe(true);
    expect(crossMarks(m, false, true)).toBe(true);    // re-melt: the rinds and the glaze melt away with the crust
    expect(m.marksLive).toBe(false);
    for (let i = 0; i < m.w * m.h; i++) { expect(m.bytes[4 * i + 2]).toBe(0); expect(m.bytes[4 * i + 3]).toBe(0); }
    stampGlaze(m, D, 0.3);
    expect(crossMarks(m, true, true)).toBe(false);
    expect(crossMarks(m, true, false)).toBe(true);    // re-crust: frozen-Hg marks are buried
    expect(crossMarks(m, false, true)).toBe(false);   // nothing left to wipe
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/scarCrust.test.js`
  - Expected: FAIL (`stampQuench` is not a function).

- [ ] **Step 3: Implement it in `scarMap.js`.** Directly after `stampGlaze` (it ends `return touched;\n}`), add:

```js
// Water flash-quenched on hot crust (spec §9.3): one profile in B, read by the crust shading.
// A full core (the dark glassy skin), a half-height plateau (the pale evaporite ring), then nothing.
// s = angle / radius, h ∈ [0, 1) jitters the outer edge. The shader's quenchProfile mirrors this exactly.
export const quenchProfile = (s, h) => 1 - 0.5 * smooth01((s - 0.55) / 0.15) - 0.5 * smooth01((s - (0.95 + 0.1 * h)) / 0.15);

export function stampQuench(map, d, radius, seed) {
  const touched = forCap(map, d, 1.25 * radius, (i, c) => {
    const s = Math.acos(Math.min(1, c)) / radius;
    const b = Math.round(255 * quenchProfile(s, texHash(i, seed)));
    if (b > map.bytes[4 * i + 2]) map.bytes[4 * i + 2] = b;
  });
  if (touched > 0) map.marksLive = true;
  return touched;
}
```

  Directly after `clearMarks` (it ends `return true;\n}`, or whatever its current final return is), add:

```js
// Marks last until the planet changes state (spec R3, §9.6). Crust → liquid melts the quench rinds and the glaze with the
// crust; liquid → crust buries the frozen-Hg frost and glaze. wasLiquid null = no previous frame: nothing to compare.
export function crossMarks(map, wasLiquid, isLiquid) {
  if (wasLiquid === null || wasLiquid === isLiquid) return false;
  return clearMarks(map);
}
```

  Update `clearMarks`'s comment line, `// The planet froze back to crust: a state change wipes every mark (plan P-2).`, to:

```js
// A state change wipes every frost, quench and glaze mark (B, A); crossMarks decides when (spec §9.6).
```

- [ ] **Step 4: Run the tests and confirm they pass.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/scarCrust.test.js src/terminal/mercury/planet/__tests__/scarMap.test.js`
  - Expected: PASS.
  - Then run `npx vitest run src/terminal/mercury` and `npm run lint` (0 errors).

- [ ] **Step 5: Commit.**

```bash
git add src/terminal/mercury/planet/scarMap.js src/terminal/mercury/planet/__tests__/scarCrust.test.js
git commit -m "feat(mercury): visitors matrix A2 — scar map: the quench rind in B, marks wiped when the planet changes state

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: visitorFrame — the quench slot and steam, the crust pool

**Files:**
- Modify: `src/terminal/mercury/planet/visitorFrame.js`
- Test: `src/terminal/mercury/planet/__tests__/visitorCrustFrame.test.js` (create)

**Interfaces:**
- Consumes (from Task 2):
  - `SURF_QUENCH`, `QUENCH_STEAM_LEN`, `QUENCH_STEAM_GROW_S`, `RESIDENT_LIFE_S` and `quenchRadius` from `visitorSim`
  - the kinds `'quench'` and `'crustpool'`
- Produces:
  - **Quench slot:** `surfDir.w = SURF_QUENCH` and `surfA = (quenchRadius(a), 0, seedFrac(seed), fade)`.
  - **Quench body:** one `VIS_PLUME` with:
    - axis = `dirWorld` (straight up)
    - length `QUENCH_STEAM_LEN · min(1, a / QUENCH_STEAM_GROW_S)`
    - fade `v.fade · (1 − a / RESIDENT_LIFE_S.quench)`
  - **Crust pool:** packs exactly like `pool`: the ember body while `a < EMBER_BODY_S`, plus the `SURF_POOL` slot
    `(poolRadius, poolFreeze, hotTempK)`.

- [ ] **Step 1: Write the failing test.** Create `src/terminal/mercury/planet/__tests__/visitorCrustFrame.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createVisitors, createVisitorOut, launchVisitor, T_FLIGHT, EMBER_BODY_S, QUENCH_STEAM_LEN, QUENCH_STEAM_GROW_S,
  RESIDENT_LIFE_S, SURF_QUENCH, SURF_POOL, quenchRadius, poolRadius, poolFreeze, hotTempK,
} from '../visitorSim';
import { createVisitorFrame, packVisitors, seedFrac, VIS_EMBER, VIS_PLUME } from '../visitorFrame';
import { ctxFor, runTo } from './visitorTestKit';

function viewOf() {
  const cam = new THREE.PerspectiveCamera(40, 1.6, 0.1, 100);
  cam.position.set(0, 0, 3.6); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const m = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  return { vp: new Float32Array(m.elements), p00: cam.projectionMatrix.elements[0], p11: cam.projectionMatrix.elements[5], wPx: 1600, hPx: 1000 };
}

function packedOnCrust(phase, a) {
  const buf = createVisitors();
  const ctx = ctxFor(phase, 400);
  ctx.tau = 0;
  const v = launchVisitor(buf, phase, ctx);
  runTo(buf, ctx, createVisitorOut(), T_FLIGHT[phase] + ctx.dt);
  runTo(buf, ctx, createVisitorOut(), v.tImpact + a);
  const f = packVisitors(buf, ctx, viewOf(), createVisitorFrame());
  return { v, f, ctx, age: ctx.tS - v.tImpact };
}

describe('visitorFrame — amendment A', () => {
  it('a spreading quench: one SURF_QUENCH slot at its live radius, full weight, seeded', () => {
    const { v, f, age } = packedOnCrust('fluid', 0.3);
    expect(f.nSurf).toBe(1);
    expect(f.surfDir[3]).toBe(SURF_QUENCH);
    expect(f.surfA[0]).toBeCloseTo(quenchRadius(age), 6);
    expect(f.surfA[1]).toBe(0);
    expect(f.surfA[2]).toBeCloseTo(seedFrac(v.seed), 3);
    expect(f.surfA[3]).toBe(1);
  });
  it('its steam: a vertical plume, grown, fading over the spread', () => {
    const { v, f, age } = packedOnCrust('fluid', 0.3);
    expect(f.n).toBe(1);
    expect(f.k[0]).toBe(VIS_PLUME);
    const ax = [f.ax[0], f.ax[1], f.ax[2]];
    const dot = ax[0] * v.dirWorld[0] + ax[1] * v.dirWorld[1] + ax[2] * v.dirWorld[2];
    expect(dot).toBeCloseTo(1, 5);
    expect(f.ax[3]).toBeCloseTo(QUENCH_STEAM_LEN * Math.min(1, age / QUENCH_STEAM_GROW_S), 6);
    expect(f.k[1]).toBeCloseTo(1 - age / RESIDENT_LIFE_S.quench, 5);
    expect(f.k[1]).toBeGreaterThan(0);
    expect(f.k[1]).toBeLessThan(1);
  });
  it('a crust pool packs like the frozen-Hg pool: its ember, then the refreezing SURF_POOL slot', () => {
    const early = packedOnCrust('thermal', 1);
    expect(early.f.n).toBe(1);
    expect(early.f.k[0]).toBe(VIS_EMBER);
    expect(early.f.surfDir[3]).toBe(SURF_POOL);
    expect(early.f.surfA[0]).toBeCloseTo(poolRadius(early.age), 6);
    expect(early.f.surfA[2]).toBeCloseTo(hotTempK(early.age), 3);
    expect(early.f.surfA[3]).toBe(1);
    const late = packedOnCrust('thermal', 3.5);
    expect(late.age).toBeGreaterThan(EMBER_BODY_S);
    expect(late.f.n).toBe(0);
    expect(late.f.surfA[1]).toBeCloseTo(poolFreeze(late.age), 6);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/visitorCrustFrame.test.js`
  - Expected: FAIL (`nSurf` is 0 for the quench, and the crust pool has no slot).

- [ ] **Step 3: Implement it in `visitorFrame.js`.**

  Add `SURF_QUENCH, QUENCH_STEAM_LEN, QUENCH_STEAM_GROW_S, RESIDENT_LIFE_S, quenchRadius` to the import list from
  `'./visitorSim'`.

  In `packSettled`, replace `} else if ((v.kind === 'ember' || v.kind === 'pool') && a < EMBER_BODY_S) {` with:

```js
  } else if ((v.kind === 'ember' || v.kind === 'pool' || v.kind === 'crustpool') && a < EMBER_BODY_S) {
```

  In `packSettled`, add this branch after the `strip` branch (before its closing `}`):

```js
  } else if (v.kind === 'quench') {
    // water flash-boiling off the hot rock (amendment A): a short column of steam straight up, gone by the stamp
    // (plan Q-1: the visitor pass's free vapour body; the bead's steam is drawn inside the bead)
    const len = QUENCH_STEAM_LEN * Math.min(1, a / QUENCH_STEAM_GROW_S);
    const steam = v.fade * (1 - Math.min(1, a / RESIDENT_LIFE_S.quench));
    pushBody(f, view, VIS_PLUME, v.pos, PLUME_W, v.dirWorld, len, steam, seedFrac(v.seed), _c, trailBound(v.pos, v.dirWorld, len, 3 * PLUME_W));
```

  Replace `hasSurface` (and update its comment) with:

```js
// Film, hot spot, gust, strip, frost, the pools and the quench rind stay in the surface while they fade (even when flung);
// a rock's meniscus and a sinking rock's collar leave with the rock.
const hasSurface = (v) => v.kind === 'film' || v.kind === 'ember' || v.kind === 'jet' || v.kind === 'strip' || v.kind === 'frost'
  || v.kind === 'pool' || v.kind === 'crustpool' || v.kind === 'quench'
  || ((v.kind === 'rock' || v.kind === 'sink') && v.state === 'resident');
```

  In `packSurface`, replace `} else if (v.kind === 'pool') {` with:

```js
  } else if (v.kind === 'pool' || v.kind === 'crustpool') {
```

  Add this branch before the `} else if (v.kind === 'sink') {` branch:

```js
  } else if (v.kind === 'quench') {
    D[o + 3] = SURF_QUENCH; A[o] = quenchRadius(a); A[o + 1] = 0; A[o + 2] = seedFrac(v.seed);
```

- [ ] **Step 4: Run the tests and confirm they pass.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/visitorCrustFrame.test.js src/terminal/mercury/planet/__tests__/visitorMatrixFrame.test.js src/terminal/mercury/planet/__tests__/visitorFrame.test.js`
  - Expected: PASS.
  - Then run `npx vitest run src/terminal/mercury` and `npm run lint` (0 errors).

- [ ] **Step 5: Commit.**

```bash
git add src/terminal/mercury/planet/visitorFrame.js src/terminal/mercury/planet/__tests__/visitorCrustFrame.test.js
git commit -m "feat(mercury): visitors matrix A3 — frame: the quench slot and its steam, the crust pool packed like the pool

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Planet shader — marks on the crust, the live quench, the pool in the rock

**Files:**
- Modify: `src/terminal/mercury/planet/mercuryPlanetShader.js`
- Modify: `src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js` (append a `describe`)
- Snapshot: `src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.full.fs.glsl` (regenerated with `-u`; the
  pre-visitors snapshot must NOT change)
- Create (gitignored, not committed): nothing; reuse `.superpowers/sdd/tools/matrixCompile.mjs`

**Interfaces:**
- Consumes:
  - From Task 2: `SURF_QUENCH`, `EVAPORITE_ALBEDO`, `EVAPORITE_A`, `QUENCH_DARK`, `QUENCH_ROUGH` and `GLASS_F0`.
  - From Task 4: the slot layouts.
    - quench: `A = (radius, 0, seedFrac, weight)`
    - pool: `A = (radius, freeze 0→1, tempK, weight)`
  - From Task 3: the scar map's byte B (quench profile) and byte A (glaze).
- Produces (GLSL, inside the visitors block):
  - `quenchProfile(s, h)` (mirrors scarMap's)
  - `visitQuench(x)`
  - `visitPoolSolid(x)`
  - `visitCrustMarks(col, uv, gx, gy, P, x, nW, rd, light, sunHg)`
  - in `main()`: `visFluid`, the crust-marks call, and the crust-pool overlay

- [ ] **Step 1: Write the failing test.** Append to `src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`.
  Add `SURF_QUENCH, EVAPORITE_ALBEDO, EVAPORITE_A, QUENCH_DARK, QUENCH_ROUGH, GLASS_F0` to its import from
  `'../visitorSim'`. It already imports `glf`, `v3`, `PLANET_FS` and `buildPlanetShader`; check and add any that are
  missing.

```js
describe('visitors matrix amendment A: marks on the crust, the live quench, the pool in the rock', () => {
  it('interpolates the crust look constants from visitorSim', () => {
    for (const [name, value] of Object.entries({ EVAPORITE_A, QUENCH_DARK, QUENCH_ROUGH, GLASS_F0 })) {
      expect(PLANET_FS).toContain(`const float ${name} = ${glf(value)};`);
    }
    expect(PLANET_FS).toContain(`const vec3 EVAPORITE_ALBEDO = ${v3(EVAPORITE_ALBEDO)};`);
  });
  it('mirrors scarMap.quenchProfile and reads the quench slot', () => {
    expect(PLANET_FS).toContain('return 1.0 - 0.5 * smoothstep(0.55, 0.7, s) - 0.5 * smoothstep(0.95 + 0.1 * h, 1.1 + 0.1 * h, s);');
    expect(PLANET_FS).toContain(`D.w != ${glf(SURF_QUENCH)}`);
  });
  it('marks the crust after its light, before the transmutation; captures the fluid weight; opens the pool in the rock after it', () => {
    const main = PLANET_FS.slice(PLANET_FS.indexOf('void main()'));
    const crustLight = main.indexOf('vec3 colLin = albedo * (uSunIrr * uExposure * ls * term * vis + uNightFloor);');
    const marks = main.indexOf('colLin = visitCrustMarks(colLin, uv, gx, gy, hit, xw, nWc, rd, uSunIrr * uExposure * ls * term * vis, uSunIrr * uExposure * max(dot(nWc, uSunDir), 0.0) * term); // visitors');
    const front = main.indexOf('if (uTau > 0.0) {');
    const capture = main.indexOf('visFluid = fluid; // visitors');
    const emit = main.indexOf('colLin += fluid * liquidW * visEmit; // visitors');
    const overlay = main.indexOf('float crustPool = visitPool(xw) * (1.0 - visFluid); // visitors');
    const slowNoon = main.indexOf('if (uOverlay > 0.0) { // slow-noon composite');
    expect(crustLight).toBeGreaterThan(0);
    expect(marks).toBeGreaterThan(crustLight);
    expect(marks).toBeLessThan(front);
    expect(capture).toBeGreaterThan(emit);
    expect(overlay).toBeGreaterThan(capture);
    expect(overlay).toBeLessThan(slowNoon);
  });
  it('the calm variant still draws the crust marks, with no live slots', () => {
    const fs = buildPlanetShader({ tier: 'full', calm: true }).fs;
    expect(fs).toContain('const int VISIT_SLOTS = 0;');
    expect(fs).toContain('colLin = visitCrustMarks(');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`
  - Expected: FAIL (the new strings are absent).

- [ ] **Step 3: Implement the constants and functions.**

  Add `SURF_QUENCH, EVAPORITE_ALBEDO, EVAPORITE_A, QUENCH_DARK, QUENCH_ROUGH, GLASS_F0` to the `visitorSim` import at the top
  of `mercuryPlanetShader.js`.

  Inside the `// <visitors>` block, directly after the line `const float POOL_RIM_H = ${glf(POOL_RIM_H)};`, add:

```glsl
const vec3 EVAPORITE_ALBEDO = ${v3(EVAPORITE_ALBEDO)};
const float EVAPORITE_A = ${glf(EVAPORITE_A)};
const float QUENCH_DARK = ${glf(QUENCH_DARK)};
const float QUENCH_ROUGH = ${glf(QUENCH_ROUGH)};
const float GLASS_F0 = ${glf(GLASS_F0)};
```

  Inside the `// <visitors>` block, directly before the `// </visitors>` line (that is, after `visitMarks`), add:

```glsl
// Amendment A: water and fire on the crust. The quench rind's profile, exactly scarMap.quenchProfile: a full core (the dark
// glassy skin), a half-height plateau (the pale evaporite ring), then nothing. s = angle / radius, h jitters the outer edge.
float quenchProfile(float s, float h) {
  return 1.0 - 0.5 * smoothstep(0.55, 0.7, s) - 0.5 * smoothstep(0.95 + 0.1 * h, 1.1 + 0.1 * h, s);
}

// The quench spreading (SURF_QUENCH): the same profile at its live radius.
float visitQuench(vec3 x) {
  float q = 0.0;
  for (int i = 0; i < VISIT_SLOTS; i++) {
    vec4 D = uVisitDir[i];
    vec4 A = uVisitA[i];
    if (A.w <= 0.0 || D.w != ${glf(SURF_QUENCH)}) continue;
    float r = max(A.x, 1e-4);
    float th = acos(clamp(dot(x, D.xyz), -1.0, 1.0));
    if (th >= 1.25 * r) continue;
    q = max(q, A.w * quenchProfile(th / r, vnoise3(x * 90.0 + A.z)));
  }
  return q;
}

// The frozen share of a refreezing pool (SURF_POOL, A.y 0 liquid -> 1 frozen): its glaze fades in before the stamp (plan Q-3).
float visitPoolSolid(vec3 x) {
  float s = 0.0;
  for (int i = 0; i < VISIT_SLOTS; i++) {
    vec4 D = uVisitDir[i];
    vec4 A = uVisitA[i];
    if (A.w <= 0.0 || D.w != ${glf(SURF_POOL)}) continue;
    float th = acos(clamp(dot(x, D.xyz), -1.0, 1.0));
    s = max(s, A.w * A.y * (1.0 - smoothstep(0.85 * A.x, A.x, th)));
  }
  return s;
}

// The crust's marks (spec §9.3, §9.4): B = the quench rind, A = glaze (a refrozen Hg disc set in the rock, plan Q-3).
// nW: the crust's world normal; light: its Sun term (Lommel-Seeliger, terminator, shadow); sunHg: Lambert for the Hg disc.
// Each look is gated on its own coverage, so an unmarked texel pays one fetch (plan Q-4).
vec3 visitCrustMarks(vec3 col, vec2 uv, vec2 gx, vec2 gy, vec3 P, vec3 x, vec3 nW, vec3 rd, float light, float sunHg) {
  vec2 m = uMarksOn > 0.5 ? textureGrad(uScar, uv, gx, gy).ba : vec2(0.0);
  float b = max(m.x, visitQuench(x));
  float g = max(m.y, visitPoolSolid(x));
  if (b <= 0.0 && g <= 0.0) return col;
  vec3 R = reflect(rd, nW);
  float NoV = clamp(dot(nW, -rd), 0.0, 1.0);
  if (b > 0.0) {
    float core = smoothstep(0.7, 0.9, b);
    float ring = smoothstep(0.15, 0.4, b) * (1.0 - smoothstep(0.6, 0.8, b));
    if (core > 0.0) {
      float F = GLASS_F0 + (1.0 - GLASS_F0) * pow(1.0 - NoV, 5.0);
      col = mix(col, col * QUENCH_DARK + F * envRadiance(R, QUENCH_ROUGH, P, nW), core);
    }
    if (ring > 0.0) {
      col = mix(col, EVAPORITE_ALBEDO * (light + uNightFloor + FROST_ENV * envRadiance(nW, 1.0, P, nW)), EVAPORITE_A * ring);
    }
  }
  if (g > 0.0) {
    vec3 hg = SOLID_HG_ALBEDO * (sunHg + uNightFloor) + SOLID_HG_SPECULAR * fresnelHg(NoV) * aetherMirror(R, GLAZE_ROUGH, nW);
    col = mix(col, hg, g);
  }
  return col;
}
```

- [ ] **Step 4: Implement the `main()` hooks.** Every line carries `// visitors`, and no existing line is edited.

  (a) Directly after the line `vec3 colLin = albedo * (uSunIrr * uExposure * ls * term * vis + uNightFloor);`, insert:

```glsl
  vec3 nWc = normalize(uBodyRot * n); // visitors
  if (uMarksOn > 0.5 || uVisitOn > 0.5) colLin = visitCrustMarks(colLin, uv, gx, gy, hit, xw, nWc, rd, uSunIrr * uExposure * ls * term * vis, uSunIrr * uExposure * max(dot(nWc, uSunDir), 0.0) * term); // visitors
  float visFluid = 0.0; // visitors
```

  (b) Directly after the line `colLin += fluid * liquidW * visEmit; // visitors`, insert:

```glsl
      visFluid = fluid; // visitors
```

  (c) Find the end of the transmutation block: the line `  }` that closes `if (uTau > 0.0) {`, immediately before the
  blank line and `  // <slow-noon>` that opens the slow-noon composite. Directly after that closing `  }`, insert:

```glsl
  if (uVisitOn > 0.5) { // visitors
    float crustPool = visitPool(xw) * (1.0 - visFluid); // visitors
    if (crustPool > 0.0) { // visitors
      vec3 nP = normalize(ng - visitTilt(xw, pxArc)); // visitors
      float NoVP = clamp(dot(nP, -rd), 0.0, 1.0); // visitors
      vec3 emitP; // visitors
      vec3 tintP = visitTint(xw, NoVP, emitP); // visitors
      colLin = mix(colLin, fresnelHg(NoVP) * envRadiance(reflect(rd, nP), uRoughLiquid, hit, nP) * tintP + emitP, crustPool); // visitors
    } // visitors
  } // visitors
```

  Note: an ember re-melting crust opens real liquid Hg (plan Q-2). Inside the transmuted region the existing
  `liquidW = max(liquidW, visitPool(xw))` line already draws it, and `(1.0 − visFluid)` keeps the two from stacking.

- [ ] **Step 5: Update the snapshot and run the tests.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js -u`
  - Then `git status --short src/terminal/mercury/planet/__tests__/__snapshots__/`. Expected: only `planetShader.full.fs.glsl`
    changed. If `planetShader.pre-visitors.fs.glsl` changed, a line is unmarked: `git checkout` that file, fix the marker
    and re-run.
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js` (without `-u`).
    Expected: PASS, including the parity strip test.

- [ ] **Step 6: Check the GPU compile.** This needs the dev server on :5175: `preview_start` with
  `scale94-dev-5175` if it is not running.
  - Run: `node .superpowers/sdd/tools/matrixCompile.mjs`
  - Expected: `ok: true` with empty logs for full, full+calm, phone, phone+calm, lite, lite+calm and visitors.
  - If a log names an error, fix the GLSL (types, float literals, declare-before-use) and re-run Steps 5–6.

- [ ] **Step 7: Run the suite and commit.**
  - Run: `npx vitest run src/terminal/mercury` (PASS) and `npm run lint` (0 errors).

```bash
git add src/terminal/mercury/planet/mercuryPlanetShader.js src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.full.fs.glsl
git commit -m "feat(mercury): visitors matrix A4 — planet shader: quench rinds and glaze on the crust, the pool opens in the rock

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Wire the quench drain, the crossing wipe and the liquid-only heal into MercuryPlanet

**Files:**
- Modify: `src/terminal/mercury/MercuryPlanet.jsx`
- Modify: `src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js` (the `visitors matrix wiring` describe)

**Interfaces:**
- Consumes:
  - `stampQuench(map, d, radius, seed)` and `crossMarks(map, wasLiquid, isLiquid)` from Task 3.
  - The stamp kind `'quench'` from Task 2.
  - The existing `LIQUID_TAU` import and `surf` object (its fields are declared near `scarClock: 0,` at ~line 392).
- Produces: marks that persist on crust, are wiped on any liquid/crust crossing, and are healed by temperature only while
  the planet is liquid.

- [ ] **Step 1: Write the failing test.** In `src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js`, inside
  `describe('visitors matrix wiring', …)`:
  - Replace the line `expect(planetSrc).toContain('if (body.tau < LIQUID_TAU && clearMarks(scar)) scarDirty = true;');` with
    the four lines below.
  - Replace the `healMelted` assertion line with the fifth line below.
  - Add the sixth line to the first test (the drain).

```js
    expect(planetSrc).toContain('const liquidNow = body.tau >= LIQUID_TAU;');
    expect(planetSrc).toContain('if (crossMarks(scar, surf.marksLiquid, liquidNow)) scarDirty = true;');
    expect(planetSrc).toContain('surf.marksLiquid = liquidNow;');
    expect(planetSrc).toContain('marksLiquid: null,');
    expect(planetSrc).toContain('if (liquidNow && healMelted(scar, vc.q, SUN_DIR_WORLD, vc.subsolarT, body.heatK)) scarDirty = true;');
    expect(planetSrc).toContain("else if (st.kind === 'quench') stampQuench(scar, st.dirBody, st.radius, st.seed);");
```

  Also add an order check to the first test:

```js
    expect(planetSrc.indexOf('surf.marksLiquid = liquidNow;')).toBeLessThan(planetSrc.indexOf('if (scarDirty) scarTex.needsUpdate = true;'));
    expect(planetSrc).not.toContain('clearMarks(scar)');
```

- [ ] **Step 2: Run it and confirm it fails.**
  - Run: `npx vitest run src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js`
  - Expected: FAIL.

- [ ] **Step 3: Implement it in `MercuryPlanet.jsx`.**

  In the `scarMap` import, replace `clearMarks` with `crossMarks`, and add `stampQuench`:

```js
  createScarMap, stampCrater, stampFrost, stampQuench, stampGlaze, stampPit, matureScars, healScars, healMelted, crossMarks, SCAR_TICK_S,
```

  In the `surf` object literal, directly after `scarClock: 0,`, add:

```js
    marksLiquid: null,   // the liquid/crust side last frame: marks clear when it changes (matrix spec §9.6)
```

  Replace the stamp drain's body with:

```js
      if (st.kind === 'frost') stampFrost(scar, st.dirBody, st.radius, st.seed);
      else if (st.kind === 'quench') stampQuench(scar, st.dirBody, st.radius, st.seed);
      else if (st.kind === 'glaze') stampGlaze(scar, st.dirBody, st.radius);
      else stampPit(scar, st.dirBody, st.radius, PIT_DEPTH_M);
```

  Replace:

```js
    if (body.tau < LIQUID_TAU && clearMarks(scar)) scarDirty = true;
```

  with:

```js
    // Marks last until the planet changes state (spec R3, §9.6): crust -> liquid melts the rinds and glaze,
    // liquid -> crust buries the frozen-Hg frost and glaze.
    const liquidNow = body.tau >= LIQUID_TAU;
    if (crossMarks(scar, surf.marksLiquid, liquidNow)) scarDirty = true;
    surf.marksLiquid = liquidNow;
```

  Replace:

```js
      if (healMelted(scar, vc.q, SUN_DIR_WORLD, vc.subsolarT, body.heatK)) scarDirty = true;
```

  with:

```js
      // only while liquid: on crust every mark sits on ≥ ~390 K rock and would be erased on the next tick (spec §9.6)
      if (liquidNow && healMelted(scar, vc.q, SUN_DIR_WORLD, vc.subsolarT, body.heatK)) scarDirty = true;
```

  Also update the comment just above that line, which begins `// frost and glaze go where the Hg under them has melted`,
  to read `// frozen-Hg frost and glaze go where the Hg under them has melted (the shader already hides them there; this frees the bytes)`.

- [ ] **Step 4: Run the tests and confirm they pass.**
  - Run: `npx vitest run src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js`. Expected: PASS.
  - Run: `npx vitest run src/terminal/mercury` (PASS) and `npm run lint` (0 errors).

- [ ] **Step 5: Live smoke.** With the dev server on :5175, run `node .superpowers/sdd/tools/matrixCompile.mjs`.
  Expected: all `ok: true`.

- [ ] **Step 6: Commit.**

```bash
git add src/terminal/mercury/MercuryPlanet.jsx src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js
git commit -m "feat(mercury): visitors matrix A5 — wire the quench stamp; marks clear on a state crossing; heal by temperature only while liquid

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Look sheet, persistence and wipe check, live verification

**Files:**
- Create (gitignored scratch, not committed): `.superpowers/sdd/tools/visitorCrustSheet.mjs`

**Interfaces:**
- Consumes:
  - the dev rig: `__mercuryTune.strike` and `visitTime`
  - `window.__mercuryVisitors` (`buf`, `ctx`, `clock`)
  - `window.__mercuryScar`
  - `openMercury.mjs` (`openMercury`, `sleep`, `OUT`; `m.melt`, `m.shot` and `m.errors`)
  - `mkSheet.mjs`
  - `vmCrop.mjs` (the crop/zoom tiler written during the matrix plan's Task 9)
- Produces: `.superpowers/sdd/tools/out/vc-<TAG>-*.png`, a tiled sheet with zoom crops, and a report with every checklist
  item judged.

- [ ] **Step 1: Write the capture script.** Create `.superpowers/sdd/tools/visitorCrustSheet.mjs`:

```js
// Amendment A look sheet (matrix spec §9.8). At rest the planet is crust (tau 0): water and fire strike inside the cone.
// Then: marks persist across scar ticks; a gentle spin carries a rind toward the night limb (plan Q-5); a re-melt wipes them.
// node visitorCrustSheet.mjs  ->  OUT/vc-<TAG>-*.png ; prints MKSHEET args and a JSON log. Needs the dev server on :5175.
import { openMercury, sleep, OUT } from './openMercury.mjs';
const { launch } = await import(new URL('file:///F:/scale_9.4/scripts/cdp.mjs'));
const TAG = process.env.TAG || 'a1';
const T_FLIGHT = { fluid: 0.75, thermal: 0.6 };
const page = await launch({ url: 'about:blank', width: 1600, height: 1000 });
const files = [], log = [];
const clock = () => page.eval('window.__mercuryVisitors.clock');
const tau = () => page.eval('window.__mercuryVisitors.ctx.tau');
const marked = () => page.eval('(() => { const b = window.__mercuryScar.bytes; let n = 0; for (let i = 2; i < b.length; i += 4) if (b[i] || b[i + 1]) n++; return n; })()');
async function shotAt(m, c0, simS, name) {
  while ((await clock()) < c0 + simS) await sleep(15);
  await page.eval('window.__mercuryTune.visitTime(0); 1');
  await sleep(250);
  const f = `${OUT}/vc-${TAG}-${name}.png`;
  await m.shot(f, 420);
  files.push(`${name}=${f}`);
  await page.eval('window.__mercuryTune.visitTime(null); 1');
}
async function strikeAndShoot(m, phase, offs, label) {
  const c0 = await clock();
  await page.eval(`window.__mercuryTune.strike('${phase}'); 1`);
  await sleep(1000 * (T_FLIGHT[phase] + 0.05));
  const v = await page.eval(`(() => { const v = window.__mercuryVisitors.buf.v.find((v) => v.live && v.phase === '${phase}'); return v ? { kind: v.kind, dir: v.dirWorld.slice() } : null; })()`);
  log.push({ label, tau: await tau(), kind: v && v.kind, dirWorld: v && v.dir });
  for (const off of offs) await shotAt(m, c0, T_FLIGHT[phase] + off, `${label}+${off}s`);
}
try {
  const m = await openMercury(page);
  await page.waitFor('!!window.__mercuryTune && !!window.__mercuryVisitors && !!window.__mercuryScar', { timeoutMs: 30000, label: 'rig' });
  log.push({ label: 'rest', tau: await tau(), marks: await marked() });
  await strikeAndShoot(m, 'fluid', [0.05, 0.3, 0.7, 5], 'quench');
  await strikeAndShoot(m, 'thermal', [0.1, 1.5, 3.5, 4.3, 5], 'crustpool');
  log.push({ label: 'marks after quench + pool', marks: await marked() });
  await sleep(11000);                                   // two scar ticks at rest: the marks must stay
  log.push({ label: 'marks after 2 ticks at rest', marks: await marked(), tau: await tau() });
  await shotAt(m, await clock(), 0.05, 'rest+11s');
  await m.melt(6); await sleep(2500);                   // a gentle spin (stays crust): the marks ride the body (Q-5)
  log.push({ label: 'after gentle spin', marks: await marked(), tau: await tau() });
  await shotAt(m, await clock(), 0.05, 'spun');
  await m.melt(25);
  const t0 = Date.now();
  while ((await tau()) < 0.5 && Date.now() - t0 < 20000) await sleep(100);
  await sleep(300);
  log.push({ label: 'marks after re-melt', marks: await marked(), tau: await tau() });
  await shotAt(m, await clock(), 0.05, 'remelted');
  console.log('errors', JSON.stringify(await m.errors()));
  console.log('LOG', JSON.stringify(log, null, 1));
  console.log('MKSHEET', files.join(' '));
} catch (e) { console.error('FAIL', e.message); } finally { await page.close(); process.exit(0); }
```

- [ ] **Step 2: Capture and tile.**
  - With the dev server running: `node .superpowers/sdd/tools/visitorCrustSheet.mjs`.
  - Then: `node .superpowers/sdd/tools/mkSheet.mjs .superpowers/sdd/tools/out/vc-a1-sheet.png 4 420 <the MKSHEET args>`.
  - Use `vmCrop.mjs` to make 4–5× zoom crops around each landing point; the LOG gives `dirWorld`.
  - Expected:
    - `errors []`
    - LOG `rest` has τ < 0.5
    - the kinds are `quench` and `crustpool`
    - `marks after quench + pool` > 0
    - `marks after 2 ticks at rest` equals it, unchanged
    - `after gentle spin` keeps τ < 0.5 and the same marks
    - `marks after re-melt` = 0
  - If the helpers differ from what the script assumes, adapt minimally and list every deviation.
  - **Look at the sheet and the crops yourself before reporting** (Read the PNGs). Judge each item pass / fail / can't
    tell, and say what you see:
    - Both land well inside the disc, not at the limb.
    - The quench shows a puff of steam at touchdown, spreads in ~0.6 s, and leaves a dark glassy core in a pale ring
      that reads against the crust.
    - The crust pool shows a liquid mirror disc with its rim, opened in the rock around the ember. It grows, then turns
      into a polished frozen-Hg disc, with no dip at the stamp (+3.5 s vs +4.3 s).
    - The marks persist at rest and ride the spin. Note how a rind reads as it approaches the night limb (R5).
    - The re-melt frame shows no rinds or glaze.
  - Anything that fails goes to superpowers:systematic-debugging (read the code, probe live state), not constant-twiddling by
    guess. Report the diagnosis and a proposed fix; do not change source files in this task.

- [ ] **Step 3: Regression spot-checks.**
  - Open `/mercury?calm=1` with `openMercury(page, '?calm=1')`. Strike water and fire at rest.
    - Check: the rind and the glaze appear at full size at touchdown, with no spread, and `__mercuryScar` has marks.
    - Check: there are no console errors.
  - Run the hyper smoke: `NOSHOT=1 node .superpowers/sdd/tools/hyperSmoke.mjs`.
    - Expected: it still fires, gathers and comes home, with no new console errors.
  - Run `node .superpowers/sdd/tools/matrixCompile.mjs`. Expected: all ok.

- [ ] **Step 4: Report.** Write the sheet path, the per-item look judgement, the LOG, the calm check, the hyper smoke and
  any deviations to the task report. Do not commit the gitignored tools.

  The controller hands the sheet to the author for the gates:
  - **Look call** (socks/∞): the rind and the glaze on the crust, and whether the dark-side rind reads (R5).
  - **Phone:** still 120 while the sphere is in motion with crust marks present at rest. The crust path now pays one scar
    fetch whenever `uMarksOn` is set, which at rest can be indefinitely.

  Do **not** push.

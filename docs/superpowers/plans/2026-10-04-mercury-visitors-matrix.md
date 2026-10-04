# Mercury Visitors Phase 2 (Element × State Matrix) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four new element × state pairings, each meeting the planet as itself:
- water on frozen Hg → frost
- fire on frozen Hg → a melt pool that refreezes into glaze
- earth on soft crust → the rock sinks
- air on boiling Hg → vapour stripping

Frost, glaze and the pit persist in the scar map until the planet changes state. Every landing is pulled to within 35° of the
centre of the visible face.

**Architecture:** This extends the phase 1 visitor units:
- `visitorSim.js`:
  - a new branch table
  - residents for the four new kinds
  - the landing aim
  - an `out.stamps` list of persistent-mark events
- `scarMap.js`:
  - frost in byte B, glaze in byte A, the pit in the depth channel
  - a shared cap iterator
  - `healMelted` / `clearMarks`
- `visitorFrame.js`:
  - three new surface-slot kinds (frost front, melt pool, crust collar)
  - a vapour-plume body
- Planet shader:
  - draws the marks and the slots, all `// visitors`-marked
  - shader parity holds
- `visitorShader.js`: draws the plume.
- `MercuryPlanet.jsx`: drains stamps into the scar map and runs the heal sweeps.

**Tech Stack:** React 19 + @react-three/fiber, three r183 RawShaderMaterial (GLSL3), vitest. CDP probe tools live in
`.superpowers/sdd/tools/` (gitignored scratch) and need the dev server on :5175.

**Spec:** `docs/superpowers/specs/2026-10-04-mercury-visitors-matrix-design.md` (commit 8070a5cf). Branch `feature/mercury-matrix`.

## Global Constraints

- **Phase 3/5 tables stay byte-identical:**
  - `IMPACT_MODE_AMP = { splash: 0.035, ring: 0.015, crater: 0 }`
  - `IMPACT_WAVE_AMP = { splash: 0.35, ring: 0.2, crater: 0 }`
  - `WAVE_DAMP_PER_S` keeps `splash: 1.0, wake: 1.6, ring: 3.0`
- **Phase 1 behaviour on liquid and boiling Hg is unchanged.** film, bead, ember, rock and jet keep their constants and looks;
  only their landing point moves (the aim).
- **Idle cost is zero:**
  - With no live visitor, `stepVisitors` and `packVisitors` return before any loop.
  - With no marks, `healMelted` and `clearMarks` return before any loop.
  - The per-frame step and pack paths allocate nothing. A launch or a stamp may allocate.
- **Shader parity:** stripping every `// visitors` line and every `// <visitors>` … `// </visitors>` block from `PLANET_FS`
  must give back `src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.pre-visitors.fs.glsl` byte for byte.
- **Calm variant:** compiles `VISIT_SLOTS = 0`.
  - Reduced motion means no creep, growth or sinking: stamping kinds stamp at touchdown.
  - The persistent marks still draw (`uMarksOn`).
- **Surface slots per tier** are unchanged: full 4, phone 2, lite 1. JS still writes `VISIT_SURF_MAX = 4`.
- **Lint gate:** `npm run lint` must pass (0 errors, warnings under the `--max-warnings` in package.json). Do not sweep
  `exhaustive-deps`.
- **Commits:** one commit per task on `feature/mercury-matrix`. Every message ends with the trailer
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **Never push.**
- **Tests:** run with `npx vitest run <path>` from the repo root `F:\scale_9.4`.

## Plan decisions (spec clarifications, each recorded in a code comment)

- **P-1:** `healMelted` turns each *marked texel* into the world frame and calls `localTempK` there. It does not turn the Sun into the
  body frame (spec §5.2 wording). `localTempK` reads latitude about world Y, exactly like the shader's freeze line, so this is
  the consistent choice.
- **P-2:** `clearMarks` clears frost and glaze when τ falls below `LIQUID_TAU`. Refreezing to crust is a state change (R3).
- **P-3:** frost, the pool and a sinking rock do not detach on a fling (they are in or under the surface). A strip detaches like a jet.
- **P-4:** frost, pool and sink keep full weight (`fade = 1`) until they stamp, so the stamp replaces the live slot with no dip.
- **P-5:** frost and the pool ring on touchdown (`IMPULSE_FOR = 'ring'`), like any strike on solid Hg today. A sink sends no impulse.
- **P-6:** on the visible face, frozen Hg mostly exists while a melted planet cools. The near side faces the Sun at a ~55° phase,
  and the aim cone is 35°. That is physically right: frost and pools are a cool-down event. The look sheet waits for it rather
  than faking it. A `visitTemp` override picks the branch, but the shader still draws frost only where the Hg is really solid.
  **Premise struck (Task 9 live check):** the 35° cone is always the afternoon side, where the sunset floor holds Hg at about
  390 K or more, so `frost` and `pool` never fired for a real tap. Superseded by P-7.
- **P-7:** water and fire aim at the cold limb when frozen Hg exists on the visible disc (author decision 2026-10-04). On a
  liquid planet with no temperature override, `fluid` and `thermal` search from the 35° cone edge out to 80° along the
  anti-sun great circle for the first spot at least 10 K below `HG_MELT_K`, and land there. If none exists, or for every
  other element or state, the 35° aim applies unchanged.

## File map

| File | Status | Responsibility |
|------|--------|----------------|
| `src/terminal/mercury/planet/visitorSim.js` | modify | aim, branch table, new residents, stamps |
| `src/terminal/mercury/planet/scarMap.js` | modify | cap iterator, frost / glaze / pit stamps, heal sweeps |
| `src/terminal/mercury/planet/visitorFrame.js` | modify | frost / pool / collar slots, pool ember, sinking rock, plume body |
| `src/terminal/mercury/planet/mercuryPlanetShader.js` | modify | `uMarksOn`, marks on solid Hg, pool, crust collar |
| `src/terminal/mercury/planet/visitorShader.js` | modify | `VIS_PLUME` |
| `src/terminal/mercury/MercuryPlanet.jsx` | modify | stamps → scar map, heal sweeps, `uMarksOn`, strip puff |
| `src/terminal/mercury/planet/__tests__/visitorTestKit.js` | modify | `runCollect` |
| tests under `src/terminal/mercury/**/__tests__/` | create/modify | per task |
| `.superpowers/sdd/tools/matrixCompile.mjs`, `visitorMatrixSheet.mjs` | create (gitignored) | GPU compile check, look sheet |

---

### Task 1: The landing aim

**Files:**
- Modify: `src/terminal/mercury/planet/visitorSim.js`
- Modify: `src/terminal/mercury/planet/__tests__/visitorSim.test.js` (one existing assertion)
- Test: `src/terminal/mercury/planet/__tests__/visitorAim.test.js` (create)

**Interfaces:**
- Consumes: `strikeDirWorld(nodePos, camPos, out)` from `mercuryImpacts`; `ctx.cam` (world camera position, planet at the origin).
- Produces:
  - `AIM_MAX_RAD` (35° in rad)
  - `aimToward(d, cam, maxRad) → d` (in place, unit `d`)
  - `launchVisitor` now lands at `aimToward(strikeDirWorld(node, cam), cam, AIM_MAX_RAD)`

- [ ] **Step 1: Write the failing test.** Create `src/terminal/mercury/planet/__tests__/visitorAim.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createVisitors, launchVisitor, aimToward, AIM_MAX_RAD, T_FLIGHT } from '../visitorSim';
import { ctxFor } from './visitorTestKit';

const len = (v) => Math.hypot(v[0], v[1], v[2]);
const ang = (a, b) => Math.acos(Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (len(a) * len(b))));

describe('visitors matrix — the landing aim (matrix spec §4.1)', () => {
  it('is 35 degrees', () => {
    expect(AIM_MAX_RAD).toBeCloseTo((35 * Math.PI) / 180, 12);
  });
  it('leaves a landing already inside the cone alone', () => {
    const d = [0, Math.sin(0.3), Math.cos(0.3)];
    const want = [...d];
    aimToward(d, [0, 0, 3.6], AIM_MAX_RAD);
    expect(d).toEqual(want);
  });
  it('pulls a far landing onto the cone edge, keeping its azimuth about the sub-camera point', () => {
    const d = [Math.sin(1.2), 0, Math.cos(1.2)];
    aimToward(d, [0, 0, 3.6], AIM_MAX_RAD);
    expect(ang(d, [0, 0, 1])).toBeCloseTo(AIM_MAX_RAD, 9);
    expect(d[1]).toBeCloseTo(0, 12);
    expect(d[0]).toBeGreaterThan(0);
    expect(len(d)).toBeCloseTo(1, 12);
  });
  it('an antipodal landing falls to the sub-camera point', () => {
    const d = [0, 0, -1];
    aimToward(d, [0, 0, 3.6], AIM_MAX_RAD);
    expect(d).toEqual([0, 0, 1]);
  });
  it('every node lands inside the cone and on its own side, for several cameras', () => {
    for (const cam of [[0, 0, 3.6], [1.2, 0.8, 3.2], [-2, 1, 2.5]]) {
      const cl = len(cam);
      const c = cam.map((x) => x / cl);
      const off = (p) => { const k = p[0] * c[0] + p[1] * c[1] + p[2] * c[2]; return [p[0] - c[0] * k, p[1] - c[1] * k, p[2] - c[2] * k]; };
      for (const phase of Object.keys(T_FLIGHT)) {
        const ctx = ctxFor(phase);
        ctx.cam = cam;
        const v = launchVisitor(createVisitors(), phase, ctx);
        expect(ang(v.dirWorld, cam)).toBeLessThanOrEqual(AIM_MAX_RAD + 1e-9);
        const a = off(v.dirWorld), b = off(ctx.nodePos);
        expect(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]).toBeGreaterThan(0);
      }
    }
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/visitorAim.test.js`
  - Expected: FAIL, because `aimToward` / `AIM_MAX_RAD` are not exported.

- [ ] **Step 3: Implement.** In `src/terminal/mercury/planet/visitorSim.js`:
  - Add after the `CALM_LIFE` line:

```js
export const AIM_MAX_RAD = (35 * Math.PI) / 180;  // every landing sits within this of the sub-camera point (matrix spec §4.1)
```

  - Add this function directly above `function landing(v, ctx) {`:

```js
// Pull a unit landing direction to within maxRad of the camera's sub-point, keeping its azimuth about that point (the
// tapped node's side). A limb landing is foreshortened to a sliver (cos 75° ≈ 0.26); inside the cone it faces the viewer.
export function aimToward(d, cam, maxRad) {
  const cl = Math.hypot(cam[0], cam[1], cam[2]) || 1;
  const c0 = cam[0] / cl, c1 = cam[1] / cl, c2 = cam[2] / cl;
  const k = d[0] * c0 + d[1] * c1 + d[2] * c2;
  if (k >= Math.cos(maxRad)) return d;
  const u0 = d[0] - c0 * k, u1 = d[1] - c1 * k, u2 = d[2] - c2 * k;
  const ul = Math.hypot(u0, u1, u2);
  if (ul < 1e-9) { d[0] = c0; d[1] = c1; d[2] = c2; return d; }
  const cm = Math.cos(maxRad), sm = Math.sin(maxRad) / ul;
  d[0] = c0 * cm + u0 * sm; d[1] = c1 * cm + u1 * sm; d[2] = c2 * cm + u2 * sm;
  return d;
}
```

  - Replace the comment above `function landing(v, ctx) {` with:

```js
// Where the fall lands (world): the strike point 40° off the launch node toward the viewer, pulled inside the aim cone
// (aimed once at launch: strikeDirWorld allocates), at the live core radius (it changes during a hyper-fling, so every frame).
```

  - In `launchVisitor`, replace `  strikeDirWorld(v.start, ctx.cam, v.dirWorld);` with:

```js
  strikeDirWorld(v.start, ctx.cam, v.dirWorld);
  aimToward(v.dirWorld, ctx.cam, AIM_MAX_RAD);
```

  - In `src/terminal/mercury/planet/__tests__/visitorSim.test.js`:
    - Add `aimToward, AIM_MAX_RAD,` to the import from `'../visitorSim'`.
    - Change the test title `'touches down exactly at T_FLIGHT, on the strike point (40 deg off the node, toward the viewer)'`
      to `'touches down exactly at T_FLIGHT, on the aimed strike point'`.
    - Replace `      const want = strikeDirWorld(ctx.nodePos, ctx.cam);` with
      `      const want = aimToward(strikeDirWorld(ctx.nodePos, ctx.cam), ctx.cam, AIM_MAX_RAD);`.

- [ ] **Step 4: Run the tests and confirm they pass.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/visitorAim.test.js src/terminal/mercury/planet/__tests__/visitorSim.test.js src/terminal/mercury/planet/__tests__/visitorResidents.test.js src/terminal/mercury/planet/__tests__/visitorFrame.test.js`
  - Expected: PASS.
  - If `'the fall never enters the planet before touchdown'` fails, the new aim makes the chord cut the planet. That is a real
    defect, not a test to loosen: stop and report NEEDS_CONTEXT with the failing `s` and `|p|`.
  - Run: `npm run lint`. Expected: 0 errors.

- [ ] **Step 5: Commit.**

```bash
git add src/terminal/mercury/planet/visitorSim.js src/terminal/mercury/planet/__tests__/visitorAim.test.js src/terminal/mercury/planet/__tests__/visitorSim.test.js
git commit -m "feat(mercury): visitors matrix 1 — landings pulled within 35 deg of the sub-camera point, on the node's side

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The matrix branch table and the four new residents

**Files:**
- Modify: `src/terminal/mercury/planet/visitorSim.js`
- Test: `src/terminal/mercury/planet/__tests__/visitorMatrix.test.js` (create)

**Interfaces:**
- Consumes: `HG_BOIL_K` from `mercuryThermal`; `LIQUID_TAU`; the existing resident machinery.
- Produces (later tasks rely on these exact names):
  - Constants:
    - `SOFT_TAU_MIN`, `FROST_R`, `FROST_CREEP_S`, `POOL_R`, `POOL_GROW_S`, `POOL_FREEZE_S`, `SINK_S`, `PIT_R`, `PIT_DEPTH_M`
    - `COLLAR_H`, `PLUME_LEN`, `PLUME_LIFT`, `PLUME_W`, `PLUME_GROW_S`
    - `SURF_FROST = 5`, `SURF_POOL = 6`, `SURF_COLLAR = 7`
  - `RESIDENT_LIFE_S` gains `frost`, `pool`, `sink` and `strip`; `IMPULSE_FOR` gains the same four.
  - `STAMP_FOR = { frost: 'frost', pool: 'glaze', sink: 'pit' }`
  - `impactBranch(phase, tau, tempK)` can also return `'frost' | 'pool' | 'sink' | 'strip'`.
  - Growth helpers:
    - `frostRadius(a)`: rad, 0 → `FROST_R` over `FROST_CREEP_S`, ease-out
    - `poolRadius(a)`: rad, √ growth to `POOL_R` at `POOL_GROW_S`
    - `poolFreeze(a)`: 0 liquid → 1 refrozen over `POOL_FREEZE_S` after `POOL_GROW_S`
  - `residentHeight` handles `pool` (like an ember) and `sink`.

- [ ] **Step 1: Write the failing test.** Create `src/terminal/mercury/planet/__tests__/visitorMatrix.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  createVisitors, createVisitorOut, launchVisitor, stepVisitors, impactBranch, residentHeight, RESIDENT_LIFE_S, IMPULSE_FOR,
  STAMP_FOR, T_FLIGHT, SOFT_TAU_MIN, FROST_R, FROST_CREEP_S, POOL_R, POOL_GROW_S, POOL_FREEZE_S, SINK_S, ROCK_R, ROCK_BOUND,
  ROCK_SUBMERGED, frostRadius, poolRadius, poolFreeze, hotTempK,
} from '../visitorSim';
import { HG_MELT_K, HG_BOIL_K } from '../mercuryThermal';
import { LIQUID_TAU } from '../mercuryWaves';
import { ctxFor, runTo } from './visitorTestKit';

const ELEMENTS = ['fluid', 'thermal', 'earth', 'air'];

function landed(phase, tempK, tau = 1) {
  const buf = createVisitors();
  const ctx = ctxFor(phase, tempK);
  ctx.tau = tau;
  const v = launchVisitor(buf, phase, ctx);
  runTo(buf, ctx, createVisitorOut(), T_FLIGHT[phase] + ctx.dt);
  return { buf, ctx, v };
}

describe('visitors matrix — the branch table (matrix spec §3, §4)', () => {
  it('hard crust craters everything; soft crust sinks a rock and craters the rest', () => {
    for (const p of ELEMENTS) expect(impactBranch(p, SOFT_TAU_MIN - 0.01, 400)).toBe('crater');
    expect(impactBranch('earth', SOFT_TAU_MIN, 400)).toBe('sink');
    expect(impactBranch('earth', LIQUID_TAU - 0.01, 400)).toBe('sink');
    for (const p of ['fluid', 'thermal', 'air']) expect(impactBranch(p, 0.3, 400)).toBe('crater');
    expect(impactBranch('earth', LIQUID_TAU, 400)).toBe('rock');
  });
  it('frozen Hg: water frosts, fire melts a pool, earth and air still ring', () => {
    const T = HG_MELT_K - 0.01;
    expect(impactBranch('fluid', 1, T)).toBe('frost');
    expect(impactBranch('thermal', 1, T)).toBe('pool');
    expect(impactBranch('earth', 1, T)).toBe('ring');
    expect(impactBranch('air', 1, T)).toBe('ring');
    expect(impactBranch('fluid', 1, HG_MELT_K)).toBe('film');
    expect(impactBranch('thermal', 1, HG_MELT_K)).toBe('ember');
  });
  it('boiling Hg strips vapour under a gust; the other elements keep their phase 1 reactions', () => {
    expect(impactBranch('air', 1, HG_BOIL_K + 0.01)).toBe('strip');
    expect(impactBranch('air', 1, HG_BOIL_K)).toBe('jet');
    expect(impactBranch('fluid', 1, HG_BOIL_K + 1)).toBe('bead');
    expect(impactBranch('thermal', 1, HG_BOIL_K + 1)).toBe('ember');
    expect(impactBranch('earth', 1, HG_BOIL_K + 1)).toBe('rock');
  });
  it('every new kind has a lifetime and an impulse; the stamping kinds name their stamp', () => {
    expect(RESIDENT_LIFE_S).toMatchObject({ frost: FROST_CREEP_S, pool: POOL_GROW_S + POOL_FREEZE_S, sink: SINK_S, strip: RESIDENT_LIFE_S.jet });
    expect(IMPULSE_FOR).toMatchObject({ frost: 'ring', pool: 'ring', sink: '', strip: 'jet' });
    expect(STAMP_FOR).toEqual({ frost: 'frost', pool: 'glaze', sink: 'pit' });
  });
});

describe('visitors matrix — the residents', () => {
  it('each new kind lands as itself and lives its RESIDENT_LIFE_S', () => {
    for (const [phase, T, tau, kind] of [['fluid', 200, 1, 'frost'], ['thermal', 200, 1, 'pool'], ['earth', 400, 0.3, 'sink'], ['air', 700, 1, 'strip']]) {
      const { buf, ctx, v } = landed(phase, T, tau);
      expect(v.kind).toBe(kind);
      expect(v.state).toBe('resident');
      runTo(buf, ctx, createVisitorOut(), v.tImpact + RESIDENT_LIFE_S[kind] - 0.1);
      expect(v.live).toBe(true);
      runTo(buf, ctx, createVisitorOut(), v.tImpact + RESIDENT_LIFE_S[kind] + 0.1);
      expect(v.live).toBe(false);
    }
  });
  it('frost, pool and sink hold full weight until they stamp; a strip fades like a jet', () => {
    for (const [phase, T, tau] of [['fluid', 200, 1], ['thermal', 200, 1], ['earth', 400, 0.3]]) {
      const { buf, ctx, v } = landed(phase, T, tau);
      runTo(buf, ctx, createVisitorOut(), v.tImpact + RESIDENT_LIFE_S[v.kind] - 0.2);
      expect(v.fade).toBe(1);
    }
    const { buf, ctx, v } = landed('air', 700);
    runTo(buf, ctx, createVisitorOut(), v.tImpact + RESIDENT_LIFE_S.strip - 0.2);
    expect(v.fade).toBeLessThan(1);
  });
  it('the frost creeps out to FROST_R; the pool grows to POOL_R, then refreezes', () => {
    expect(frostRadius(0)).toBe(0);
    expect(frostRadius(FROST_CREEP_S / 2)).toBeLessThan(frostRadius(FROST_CREEP_S * 0.9));
    expect(frostRadius(FROST_CREEP_S)).toBeCloseTo(FROST_R, 12);
    expect(frostRadius(3 * FROST_CREEP_S)).toBeCloseTo(FROST_R, 12);
    expect(poolRadius(0)).toBe(0);
    expect(poolRadius(POOL_GROW_S / 2)).toBeLessThan(poolRadius(POOL_GROW_S));
    expect(poolRadius(POOL_GROW_S)).toBeCloseTo(POOL_R, 12);
    expect(poolRadius(2 * POOL_GROW_S)).toBeCloseTo(POOL_R, 12);
    expect(poolFreeze(POOL_GROW_S)).toBe(0);
    expect(poolFreeze(POOL_GROW_S + POOL_FREEZE_S / 2)).toBeCloseTo(0.5, 9);
    expect(poolFreeze(POOL_GROW_S + POOL_FREEZE_S)).toBe(1);
  });
  it("the pool's ember cools like a free ember", () => {
    const { buf, ctx, v } = landed('thermal', 200);
    runTo(buf, ctx, createVisitorOut(), v.tImpact + 1);
    expect(v.tempK).toBeCloseTo(hotTempK(ctx.tS - v.tImpact), 6);
  });
  it('a sinking rock goes from its floating height to fully under the crust, monotonically', () => {
    const v = { kind: 'sink' };
    const life = RESIDENT_LIFE_S.sink;
    expect(residentHeight(v, 0, life, false)).toBeCloseTo(ROCK_R * (1 - 2 * ROCK_SUBMERGED), 12);
    expect(residentHeight(v, life, life, false)).toBeCloseTo(-ROCK_BOUND * ROCK_R, 12);
    let prev = Infinity;
    for (let a = 0; a <= life + 1e-9; a += 0.25) {
      const h = residentHeight(v, a, life, false);
      expect(h).toBeLessThanOrEqual(prev + 1e-12);
      prev = h;
    }
  });
  it('frost, pool and a sinking rock stay put through a fling; a strip is flung with the rest (plan P-3)', () => {
    for (const [phase, T, tau, want] of [['fluid', 200, 1, 'resident'], ['thermal', 200, 1, 'resident'], ['earth', 400, 0.3, 'resident'], ['air', 700, 1, 'detached']]) {
      const { buf, ctx, v } = landed(phase, T, tau);
      ctx.detach = true; ctx.omega = [0, 12, 0];
      ctx.tS += ctx.dt;
      stepVisitors(buf, ctx, createVisitorOut());
      expect(v.state).toBe(want);
    }
  });
  it('a strip carries a unit gust direction along the surface', () => {
    const { v } = landed('air', 700);
    const t = v.tan, d = v.dirBody;
    expect(Math.hypot(t[0], t[1], t[2])).toBeCloseTo(1, 9);
    expect(t[0] * d[0] + t[1] * d[1] + t[2] * d[2]).toBeCloseTo(0, 9);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/visitorMatrix.test.js`
  - Expected: FAIL (missing exports).

- [ ] **Step 3: Implement.** In `src/terminal/mercury/planet/visitorSim.js`:
  - Change the import `import { HG_MELT_K } from './mercuryThermal';` to
    `import { HG_MELT_K, HG_BOIL_K } from './mercuryThermal';`.
  - Replace the `RESIDENT_LIFE_S` and `IMPULSE_FOR` lines with:

```js
export const RESIDENT_LIFE_S = Object.freeze({
  film: 8, bead: 6, ember: 6, rock: 12, jet: 1.5, ring: 0, crater: 0,
  frost: 1.5, pool: 4, sink: 5, strip: 1.5,   // matrix: frost = FROST_CREEP_S, pool = POOL_GROW_S + POOL_FREEZE_S, sink = SINK_S
});
// Frost and the pool ring like any strike on solid Hg (plan P-5); a rock sinking into soft crust sends nothing.
export const IMPULSE_FOR = Object.freeze({
  film: 'dimple', bead: 'dimple', ember: 'marangoni', rock: 'crown', jet: 'jet', ring: 'ring', crater: '',
  frost: 'ring', pool: 'ring', sink: '', strip: 'jet',
});
// The kinds that leave a persistent mark in the scar map when their life ends (matrix spec §4).
export const STAMP_FOR = Object.freeze({ frost: 'frost', pool: 'glaze', sink: 'pit' });
```

  - Add after the `EXO_PUFF_S` line:

```js

// The matrix (spec docs/superpowers/specs/2026-10-04-mercury-visitors-matrix-design.md).
export const SOFT_TAU_MIN = 0.1;           // below this the crust is hard: a rock craters instead of sinking
export const FROST_R = 0.05;               // rad: the frost patch at the end of its creep
export const FROST_CREEP_S = 1.5;
export const POOL_R = 0.035;               // rad: the melt pool at full size
export const POOL_GROW_S = 3;              // it grows while the ember burns (EMBER_BODY_S)…
export const POOL_FREEZE_S = 1;            // …then refreezes into glaze
export const SINK_S = 5;                   // a rock sinks into soft crust over this
export const PIT_R = 0.03;                 // rad
export const PIT_DEPTH_M = 600;            // true metres (the shader's uRelief exaggerates, like the craters)
export const COLLAR_H = 0.002;             // fraction of R: the crust pushed up round the sinking rock
export const PLUME_LEN = 0.12;             // scene units: the vapour streamer torn downwind
export const PLUME_LIFT = 0.35;            // how much it rises off the surface as it streams
export const PLUME_W = 0.015;
export const PLUME_GROW_S = 0.4;
```

  - Replace `export const SURF_FILM = 1, SURF_HOT = 2, SURF_MENISCUS = 3, SURF_JET = 4;` with:

```js
export const SURF_FILM = 1, SURF_HOT = 2, SURF_MENISCUS = 3, SURF_JET = 4, SURF_FROST = 5, SURF_POOL = 6, SURF_COLLAR = 7;
```

  - Add after the `fadeAt` helper line:

```js
export const frostRadius = (a) => FROST_R * (1 - (1 - Math.min(1, Math.max(0, a / FROST_CREEP_S))) ** 2);
export const poolRadius = (a) => POOL_R * Math.sqrt(Math.min(1, Math.max(0, a / POOL_GROW_S)));
export const poolFreeze = (a) => smooth01((a - POOL_GROW_S) / POOL_FREEZE_S);
```

  - Replace the whole `impactBranch` function with:

```js
export function impactBranch(phase, tau, tempK) {
  if (tau < LIQUID_TAU) return phase === 'earth' && tau >= SOFT_TAU_MIN ? 'sink' : 'crater';
  if (tempK < HG_MELT_K) return phase === 'fluid' ? 'frost' : phase === 'thermal' ? 'pool' : 'ring';
  if (phase === 'fluid') return tempK >= LEIDENFROST_K ? 'bead' : 'film';
  if (phase === 'thermal') return 'ember';
  if (phase === 'earth') return 'rock';
  return tempK > HG_BOIL_K ? 'strip' : 'jet';
}
```

  - In `touchdown`, replace these three consecutive lines:
    - `  const want = kind === 'bead' …`
    - `  for (let k = 0; k < 3; k++) v.tan[k] = …`
    - `  v.r = kind === 'bead' …`

    with:

```js
  const want = kind === 'bead' ? (ctx.calm ? 0 : SKATE_V0) : kind === 'jet' || kind === 'strip' ? 1 : 0;
  for (let k = 0; k < 3; k++) v.tan[k] = tl > 1e-9 ? (v.tan[k] / tl) * want : 0;
  v.r = kind === 'bead' ? BEAD_R : kind === 'rock' || kind === 'sink' ? ROCK_R : kind === 'ember' || kind === 'pool' ? EMBER_R : 0;
```
  - Replace the whole `residentHeight` function with:

```js
export function residentHeight(v, a, life, calm) {
  if (v.kind === 'bead') return 0.95 * v.r + BEAD_GAP;
  if (v.kind === 'ember' || v.kind === 'pool') return 0.4 * v.r;
  if (v.kind === 'rock') {
    const sink = 2 * ROCK_R * smooth01((a - (life - ROCK_SINK_S)) / ROCK_SINK_S);
    return ROCK_R * (1 - 2 * ROCK_SUBMERGED) + (calm ? 0 : rockBob(a)) - sink;
  }
  if (v.kind === 'sink') {
    // into the soft crust: from its floating line until the whole bound sphere is under
    const h0 = ROCK_R * (1 - 2 * ROCK_SUBMERGED);
    return h0 - (h0 + ROCK_BOUND * ROCK_R) * smooth01(a / life);
  }
  return 0;
}
```

  - In `stepResident`, replace the lines from `  v.fade = fadeAt(a, life);` to the closing `}` of the `else if (v.kind === 'ember')` branch with:

```js
  // the stamping kinds keep full weight until the stamp replaces them (plan P-4)
  v.fade = STAMP_FOR[v.kind] ? 1 : fadeAt(a, life);
  if (v.kind === 'bead') {
    if (!ctx.calm) skate(v, ctx.dt);
    v.r = BEAD_R * (1 - (BEAD_SHRINK * a) / life);
  } else if ((v.kind === 'rock' || v.kind === 'sink') && !ctx.calm) {
    v.spin += ROCK_SPIN0 * Math.exp(-a / ROCK_SPIN_EFOLD) * ctx.dt;
  } else if (v.kind === 'ember' || v.kind === 'pool') {
    v.tempK = hotTempK(a);
  }
```

  - In `stepDetached`, replace
    `  if (v.kind === 'film' || v.kind === 'ember' || v.kind === 'jet') qRotate(ctx.q, v.dirBody, v.dirWorld);` with
    `  if (v.kind === 'film' || v.kind === 'ember' || v.kind === 'jet' || v.kind === 'strip') qRotate(ctx.q, v.dirBody, v.dirWorld);`
    and add `/ strip` after `jet` in the comment above it.
  - In `stepVisitors`, replace `      if (ctx.detach) detachVisitor(v, ctx);` with:

```js
      // frost, the pool and a sinking rock are in or under the surface: a fling leaves them (plan P-3)
      if (ctx.detach && !STAMP_FOR[v.kind]) detachVisitor(v, ctx);
```

- [ ] **Step 4: Run the tests and confirm they pass.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/visitorMatrix.test.js src/terminal/mercury/planet/__tests__/visitorSim.test.js src/terminal/mercury/planet/__tests__/visitorResidents.test.js src/terminal/mercury/planet/__tests__/visitorFrame.test.js src/terminal/mercury/planet/__tests__/visitorAim.test.js`
  - Expected: PASS.
  - Run: `npm run lint`. Expected: 0 errors.

- [ ] **Step 5: Commit.**

```bash
git add src/terminal/mercury/planet/visitorSim.js src/terminal/mercury/planet/__tests__/visitorMatrix.test.js
git commit -m "feat(mercury): visitors matrix 2 — frost, melt pool, sinking rock and vapour strip residents; the branch table

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Stamp events

**Files:**
- Modify: `src/terminal/mercury/planet/visitorSim.js`
- Modify: `src/terminal/mercury/planet/__tests__/visitorTestKit.js`
- Test: `src/terminal/mercury/planet/__tests__/visitorStamps.test.js` (create)

**Interfaces:**
- Consumes: `STAMP_FOR`, `FROST_R`, `POOL_R`, `PIT_R` (Task 2).
- Produces:
  - `createVisitorOut()` gains `nStamps` and `stamps: { kind: 'frost'|'glaze'|'pit', dirBody[3], radius, seed }[VISITOR_SLOTS]`.
  - `stepVisitors` resets `out.nStamps = 0` and emits one stamp when a frost / pool / sink resident's life ends. Under `ctx.calm`
    it emits at touchdown instead and frees the visitor.
  - `stampRadius(kind) → rad`.
  - Test kit: `runCollect(buf, ctx, out, untilS) → { impacts, stamps }`, each entry with `at`.

- [ ] **Step 1: Write the failing test.**
  - Append to `src/terminal/mercury/planet/__tests__/visitorTestKit.js`:

```js

// Like runTo, but collects the persistent-mark stamps too.
export function runCollect(buf, ctx, out, untilS) {
  const impacts = [], stamps = [];
  while (ctx.tS < untilS - 1e-9) {
    ctx.tS += ctx.dt;
    stepVisitors(buf, ctx, out);
    for (let i = 0; i < out.nImpacts; i++) {
      const e = out.impacts[i];
      impacts.push({ ...e, dirBody: [...e.dirBody], dirWorld: [...e.dirWorld], at: ctx.tS });
    }
    for (let i = 0; i < out.nStamps; i++) {
      const s = out.stamps[i];
      stamps.push({ ...s, dirBody: [...s.dirBody], at: ctx.tS });
    }
  }
  return { impacts, stamps };
}
```

  - Create `src/terminal/mercury/planet/__tests__/visitorStamps.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  createVisitors, createVisitorOut, launchVisitor, stepVisitors, stampRadius, T_FLIGHT, RESIDENT_LIFE_S, FROST_R, POOL_R, PIT_R,
} from '../visitorSim';
import { ctxFor, runCollect } from './visitorTestKit';

function strike(phase, tempK, tau, runForS, calm = false) {
  const buf = createVisitors();
  const ctx = ctxFor(phase, tempK);
  ctx.tau = tau; ctx.calm = calm;
  launchVisitor(buf, phase, ctx);
  return { ...runCollect(buf, ctx, createVisitorOut(), T_FLIGHT[phase] + runForS), buf, ctx };
}

describe('visitors matrix — stamp events (matrix spec §4, §5.1)', () => {
  it('names a radius per stamping kind', () => {
    expect(stampRadius('frost')).toBe(FROST_R);
    expect(stampRadius('pool')).toBe(POOL_R);
    expect(stampRadius('sink')).toBe(PIT_R);
  });
  for (const [phase, T, tau, resident, kind, radius] of [
    ['fluid', 200, 1, 'frost', 'frost', FROST_R],
    ['thermal', 200, 1, 'pool', 'glaze', POOL_R],
    ['earth', 400, 0.3, 'sink', 'pit', PIT_R],
  ]) {
    it(`${resident} stamps ${kind} once, when its life ends, where it landed`, () => {
      const { impacts, stamps, buf } = strike(phase, T, tau, RESIDENT_LIFE_S[resident] + 1);
      expect(impacts).toHaveLength(1);
      expect(stamps).toHaveLength(1);
      expect(stamps[0]).toMatchObject({ kind, radius, seed: impacts[0].seed });
      expect(stamps[0].at).toBeGreaterThanOrEqual(impacts[0].at + RESIDENT_LIFE_S[resident] - 1e-9);
      expect(stamps[0].at).toBeLessThanOrEqual(impacts[0].at + RESIDENT_LIFE_S[resident] + 1 / 60 + 1e-9);
      for (let k = 0; k < 3; k++) expect(stamps[0].dirBody[k]).toBeCloseTo(impacts[0].dirBody[k], 12);
      expect(buf.live).toBe(0);
    });
    it(`reduced motion: ${resident} stamps ${kind} at touchdown and is gone`, () => {
      const { impacts, stamps, buf } = strike(phase, T, tau, 0.5, true);
      expect(stamps).toHaveLength(1);
      expect(stamps[0].kind).toBe(kind);
      expect(stamps[0].at).toBe(impacts[0].at);
      expect(buf.live).toBe(0);
    });
  }
  it('nothing on liquid or boiling Hg stamps', () => {
    for (const [phase, T] of [['fluid', 400], ['fluid', 600], ['thermal', 400], ['earth', 400], ['air', 400], ['air', 700]]) {
      expect(strike(phase, T, 1, 15).stamps).toHaveLength(0);
    }
  });
  it('idle: stepVisitors with nothing live clears the stamp count', () => {
    const out = createVisitorOut();
    out.nStamps = 3;
    stepVisitors(createVisitors(), ctxFor('fluid'), out);
    expect(out.nStamps).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/visitorStamps.test.js`
  - Expected: FAIL (`stampRadius` is missing, and no stamps are emitted).

- [ ] **Step 3: Implement.** In `src/terminal/mercury/planet/visitorSim.js`:
  - Replace the whole `createVisitorOut` function with:

```js
export function createVisitorOut() {
  return {
    nImpacts: 0,
    impacts: Array.from({ length: VISITOR_SLOTS }, () => ({ kind: '', impulse: '', phase: '', dirBody: [0, 0, 1], dirWorld: [0, 0, 1], seed: 0, tempK: 0 })),
    // persistent marks for the scar map (frost, glaze, pit), drained by MercuryPlanet every frame
    nStamps: 0,
    stamps: Array.from({ length: VISITOR_SLOTS }, () => ({ kind: '', dirBody: [0, 0, 1], radius: 0, seed: 0 })),
  };
}
```

  - Add above `function stepFlight(v, ctx, out) {`:

```js
export const stampRadius = (kind) => (kind === 'frost' ? FROST_R : kind === 'pool' ? POOL_R : PIT_R);

function emitStamp(v, out) {
  if (out.nStamps >= out.stamps.length) return;
  const s = out.stamps[out.nStamps++];
  s.kind = STAMP_FOR[v.kind]; s.radius = stampRadius(v.kind); s.seed = v.seed;
  s.dirBody[0] = v.dirBody[0]; s.dirBody[1] = v.dirBody[1]; s.dirBody[2] = v.dirBody[2];
}
```

  - In `touchdown`, replace `  if (!(RESIDENT_LIFE_S[kind] > 0)) { v.state = 'free'; return; }` with:

```js
  if (!(RESIDENT_LIFE_S[kind] > 0)) { v.state = 'free'; return; }
  // reduced motion: no creep, growth or sinking: the mark lands at full size now
  if (ctx.calm && STAMP_FOR[kind]) { emitStamp(v, out); v.state = 'free'; return; }
```

  - In `touchdown`, replace the last line `  stepResident(v, ctx);` with `  stepResident(v, ctx, out);`.
  - Change `function stepResident(v, ctx) {` to `function stepResident(v, ctx, out) {`, and replace its first expiry line
    `  if (a >= life) { v.state = 'free'; return; }` with:

```js
  if (a >= life) { if (STAMP_FOR[v.kind]) emitStamp(v, out); v.state = 'free'; return; }
```

  - In `stepVisitors`:
    - Replace `  out.nImpacts = 0;` with `  out.nImpacts = 0; out.nStamps = 0;`.
    - Replace `      else stepResident(v, ctx);` with `      else stepResident(v, ctx, out);`.

- [ ] **Step 4: Run the tests and confirm they pass.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/`
  - Expected: PASS.
  - Run: `npm run lint`. Expected: 0 errors.

- [ ] **Step 5: Commit.**

```bash
git add src/terminal/mercury/planet/visitorSim.js src/terminal/mercury/planet/__tests__/visitorTestKit.js src/terminal/mercury/planet/__tests__/visitorStamps.test.js
git commit -m "feat(mercury): visitors matrix 3 — stamp events: frost, glaze and pit when the resident's life ends (calm: at touchdown)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Scar map marks — frost, glaze, pit, and their healing

**Files:**
- Modify: `src/terminal/mercury/planet/scarMap.js`
- Modify: `src/terminal/mercury/planet/__tests__/scarMap.test.js`

**Interfaces:**
- Consumes: `qRotate(q, v, out)` from `breakupFamily` (`q = [x, y, z, w]`, body → world); `localTempK(d, sun, tssK, heatK)` from
  `mercuryImpacts`; `HG_MELT_K` from `mercuryThermal`.
- Produces:
  - `createScarMap` with A = 0, plus `marksLive: false`
  - `stampFrost(map, d, radiusRad, seed) → touched`: byte B
  - `stampGlaze(map, d, radiusRad) → touched`: byte A
  - `stampPit(map, d, radiusRad, depthM) → touched`: depth, then R
  - `pitHeightM(s, depthM)`
  - `healMelted(map, q, sunWorld, tssK, heatK) → changed`
  - `clearMarks(map) → changed`
  - `stampCrater` behaviour unchanged (now built on the shared cap iterator)

- [ ] **Step 1: Write the failing test.**
  - In `src/terminal/mercury/planet/__tests__/scarMap.test.js`, find the existing test `'starts neutral: R 128, G 0, A 255, nothing live'`.
    - Change its title to `'starts neutral: R 128, G 0, B 0, A 0, nothing live'`.
    - Change `expect(m.bytes[4 * i + 3]).toBe(255);` to `expect(m.bytes[4 * i + 3]).toBe(0);`.
    - Add `expect(m.bytes[4 * i + 2]).toBe(0);` next to it, and `expect(m.marksLive).toBe(false);` after the loop.
  - Extend that file's import from `'../scarMap'` with `stampFrost, stampGlaze, stampPit, pitHeightM, healMelted, clearMarks`.
  - Add these imports:

```js
import { qRotate } from '../breakupFamily';
import { localTempK } from '../mercuryImpacts';
import { HG_MELT_K } from '../mercuryThermal';
```

  - Append:

```js
describe('scarMap — the visitors marks (matrix spec §5.2)', () => {
  const nearest = (m, d) => {
    let best = -2, bi = 0;
    const p = [0, 0, 0];
    for (let iy = 0; iy < m.h; iy++) for (let ix = 0; ix < m.w; ix++) {
      texelDir(m, ix, iy, p);
      const c = p[0] * d[0] + p[1] * d[1] + p[2] * d[2];
      if (c > best) { best = c; bi = iy * m.w + ix; }
    }
    return bi;
  };
  const angleTo = (m, i, d) => {
    const p = texelDir(m, i % m.w, Math.floor(i / m.w));
    return Math.acos(Math.min(1, p[0] * d[0] + p[1] * d[1] + p[2] * d[2]));
  };
  const D = [0, 0, 1];

  it('frost writes only B: full at its centre, nothing past 1.2 radii', () => {
    const m = createScarMap(512, 256);
    const before = m.bytes.slice();
    expect(stampFrost(m, D, 0.05, 7)).toBeGreaterThan(0);
    expect(m.marksLive).toBe(true);
    expect(m.live).toBe(false);
    let other = 0, far = 0;
    for (let i = 0; i < m.w * m.h; i++) {
      if (m.bytes[4 * i] !== before[4 * i] || m.bytes[4 * i + 1] !== before[4 * i + 1] || m.bytes[4 * i + 3] !== before[4 * i + 3]) other++;
      if (m.bytes[4 * i + 2] > 0 && angleTo(m, i, D) > 1.2 * 0.05 + 1e-9) far++;
    }
    expect(other).toBe(0);
    expect(far).toBe(0);
    expect(m.bytes[4 * nearest(m, D) + 2]).toBe(255);
  });
  it('glaze writes only A, full at its centre', () => {
    const m = createScarMap(512, 256);
    const before = m.bytes.slice();
    expect(stampGlaze(m, D, 0.035)).toBeGreaterThan(0);
    expect(m.marksLive).toBe(true);
    let other = 0;
    for (let i = 0; i < m.w * m.h; i++) {
      if (m.bytes[4 * i] !== before[4 * i] || m.bytes[4 * i + 1] !== before[4 * i + 1] || m.bytes[4 * i + 2] !== before[4 * i + 2]) other++;
    }
    expect(other).toBe(0);
    expect(m.bytes[4 * nearest(m, D) + 3]).toBe(255);
  });
  it('a pit is a shallow bowl in the depth channel, with a low collar; no rays', () => {
    expect(pitHeightM(0, 600)).toBe(-600);
    expect(pitHeightM(1, 600)).toBeCloseTo(90, 9);
    expect(pitHeightM(3, 600)).toBeLessThan(pitHeightM(1.2, 600));
    const m = createScarMap(512, 256);
    expect(stampPit(m, D, 0.03, 600)).toBeGreaterThan(0);
    expect(m.live).toBe(true);
    expect(m.marksLive).toBe(false);
    const i = nearest(m, D);
    expect(m.depth[i]).toBeLessThan(-500);
    expect(m.bytes[4 * i]).toBeLessThan(128);
    expect(m.ray.every((r) => r === 0)).toBe(true);
  });
  it('the melt wipe of craters leaves frost and glaze alone', () => {
    const m = createScarMap(256, 128);
    stampCrater(m, [1, 0, 0], 3);
    stampFrost(m, D, 0.1, 1);
    stampGlaze(m, [0, 1, 0], 0.1);
    const ba = (i) => [m.bytes[4 * i + 2], m.bytes[4 * i + 3]];
    const before = Array.from({ length: m.w * m.h }, (_, i) => ba(i));
    expect(healScars(m)).toBe(true);
    for (let i = 0; i < m.w * m.h; i++) expect(ba(i)).toEqual(before[i]);
    expect(m.marksLive).toBe(true);
  });
  it('clearMarks wipes frost and glaze; with none it does nothing', () => {
    const m = createScarMap(64, 32);
    expect(clearMarks(m)).toBe(false);
    stampFrost(m, D, 0.3, 1);
    stampGlaze(m, D, 0.3);
    expect(clearMarks(m)).toBe(true);
    expect(m.marksLive).toBe(false);
    for (let i = 0; i < m.w * m.h; i++) { expect(m.bytes[4 * i + 2]).toBe(0); expect(m.bytes[4 * i + 3]).toBe(0); }
  });
  it('healMelted clears exactly the marked texels where the Hg under them is liquid, in the world frame', () => {
    const sun = [1, 0, 0], tss = 700, heat = 0;
    expect(localTempK([1, 0, 0], sun, tss, heat)).toBeGreaterThan(HG_MELT_K);   // preconditions: noon is hot…
    expect(localTempK([-1, 0, 0], sun, tss, heat)).toBeLessThan(HG_MELT_K);     // …midnight is frozen
    const m = createScarMap(256, 128);
    stampFrost(m, [1, 0, 0], 0.1, 1);
    stampGlaze(m, [-1, 0, 0], 0.1);
    const marked = [];
    for (let i = 0; i < m.w * m.h; i++) if (m.bytes[4 * i + 2] || m.bytes[4 * i + 3]) marked.push(i);
    const q = [0, 0, 0, 1];
    expect(healMelted(m, q, sun, tss, heat)).toBe(true);
    let cleared = 0, kept = 0;
    const w = [0, 0, 0];
    for (const i of marked) {
      qRotate(q, texelDir(m, i % m.w, Math.floor(i / m.w)), w);
      const hot = localTempK(w, sun, tss, heat) > HG_MELT_K;
      const gone = m.bytes[4 * i + 2] === 0 && m.bytes[4 * i + 3] === 0;
      expect(gone).toBe(hot);
      if (gone) cleared++; else kept++;
    }
    expect(cleared).toBeGreaterThan(0);
    expect(kept).toBeGreaterThan(0);
    expect(m.marksLive).toBe(true);
    // turn the body half a revolution about Y: the midnight glaze now faces the Sun and melts
    expect(healMelted(m, [0, 1, 0, 0], sun, tss, heat)).toBe(true);
    expect(m.marksLive).toBe(false);
    expect(healMelted(m, q, sun, tss, heat)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/scarMap.test.js`
  - Expected: FAIL (missing exports, and A is still 255).

- [ ] **Step 3: Implement.** In `src/terminal/mercury/planet/scarMap.js`:
  - Replace the header comment's last two lines (`// Float32 master values, RGBA8 bytes for the GPU: R = 128 ± 127 · depth/range,` and
    `// G = ray · 255.`) with:

```js
// Float32 master values, RGBA8 bytes for the GPU: R = 128 ± 127 · depth/range,
// G = ray · 255. B = frost, A = glaze (the visitors' marks, matrix spec §5.2):
// bytes only, no masters; they heal where the Hg under them melts, not on the
// planet-wide melt that wipes the craters.
```

  - Replace `import { CRATER_RADIUS_RAD, RAY_REACH, craterHeightM, makeRays, rayBrightness } from './mercuryImpacts';` with:

```js
import { CRATER_RADIUS_RAD, RAY_REACH, craterHeightM, makeRays, rayBrightness, localTempK } from './mercuryImpacts';
import { qRotate } from './breakupFamily';
import { HG_MELT_K } from './mercuryThermal';
```

  - Replace the whole `createScarMap` function with:

```js
export function createScarMap(w = SCAR_W, h = SCAR_H) {
  const bytes = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) bytes[4 * i] = 128;
  return { w, h, depth: new Float32Array(w * h), ray: new Float32Array(w * h), bytes, live: false, rayLive: false, marksLive: false };
}
```

  - Replace the whole `stampCrater` function (from `const _x = [0, 0, 0];` through its closing `}`) with:

```js
const _x = [0, 0, 0];
const _w = [0, 0, 0];

// Every texel within thMax of unit d: fn(i, cosToD), with that texel's direction left in _x. Returns how many it visited.
function forCap(map, d, thMax, fn) {
  const cosMax = Math.cos(thMax);
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
      fn(iy * map.w + ix, c);
      touched++;
    }
  }
  return touched;
}

export function stampCrater(map, d, seed) {
  const rays = makeRays(seed);
  // Tangent frame at the impact point for the ray azimuth.
  let ex = -d[2], ez = d[0];                       // cross(d, +Y): an east-ish tangent
  let el = Math.hypot(ex, ez);
  if (el < 1e-6) { ex = 1; ez = 0; el = 1; }
  const e = [ex / el, 0, ez / el];
  const n = [d[1] * e[2], d[2] * e[0] - d[0] * e[2], -d[1] * e[0]]; // cross(d, e)
  const touched = forCap(map, d, CRATER_RADIUS_RAD * RAY_REACH, (i, c) => {
    const s = Math.acos(Math.min(1, c)) / CRATER_RADIUS_RAD;
    if (s <= DEPTH_REACH) {
      const over = 1 - smooth01((s - 0.8) / 0.5);  // the new crater erases the old inside its rim
      map.depth[i] = map.depth[i] * (1 - over) + craterHeightM(s);
    }
    const phi = Math.atan2(_x[0] * n[0] + _x[1] * n[1] + _x[2] * n[2], _x[0] * e[0] + _x[1] * e[1] + _x[2] * e[2]);
    const r = rayBrightness(s, phi, rays);
    if (r > map.ray[i]) map.ray[i] = r;
    encode(map, i);
  });
  if (touched > 0) { map.live = true; map.rayLive = true; }
  return touched;
}

// A cheap per-texel hash in [0, 1): the frost's ragged, crystalline edge.
const texHash = (i, seed) => (Math.imul((i ^ Math.imul(seed, 0x27d4eb2d)) >>> 0, 0x9e3779b1) >>> 0) / 4294967296;

// Water frozen on contact with frozen Hg (matrix spec §4.2): B = coverage, full inside 0.7–1.0 radii, ragged out to 1.15.
export function stampFrost(map, d, radius, seed) {
  const touched = forCap(map, d, 1.2 * radius, (i, c) => {
    const s = Math.acos(Math.min(1, c)) / radius;
    const b = Math.round(255 * (1 - smooth01((s - (0.7 + 0.3 * texHash(i, seed))) / 0.15)));
    if (b > map.bytes[4 * i + 2]) map.bytes[4 * i + 2] = b;
  });
  if (touched > 0) map.marksLive = true;
  return touched;
}

// A melt pool refrozen smooth (§4.3): A = glaze, full inside 0.75 radii.
export function stampGlaze(map, d, radius) {
  const touched = forCap(map, d, radius, (i, c) => {
    const s = Math.acos(Math.min(1, c)) / radius;
    const a = Math.round(255 * (1 - smooth01((s - 0.75) / 0.25)));
    if (a > map.bytes[4 * i + 3]) map.bytes[4 * i + 3] = a;
  });
  if (touched > 0) map.marksLive = true;
  return touched;
}

// Where a rock sank into soft crust (§4.4): a shallow bowl with a low collar of displaced crust (true metres).
export const pitHeightM = (s, depthM) => (s < 1 ? -depthM * (1 - s * s) : 0.15 * depthM * Math.exp(-(s - 1) / 0.25));

export function stampPit(map, d, radius, depthM) {
  const touched = forCap(map, d, 2 * radius, (i, c) => {
    map.depth[i] += pitHeightM(Math.acos(Math.min(1, c)) / radius, depthM);
    encode(map, i);
  });
  if (touched > 0) map.live = true;
  return touched;
}
```

  - Append at the end of the file:

```js

// Frost and glaze heal where the Hg under them melts (matrix spec §5.2). Each marked texel is turned into the world frame:
// localTempK reads latitude about world Y, like the shader's freeze line (plan P-1). Unmarked texels cost a byte test.
export function healMelted(map, q, sunWorld, tssK, heatK) {
  if (!map.marksLive) return false;
  let live = false, changed = false;
  for (let iy = 0; iy < map.h; iy++) {
    for (let ix = 0; ix < map.w; ix++) {
      const o = 4 * (iy * map.w + ix);
      if (map.bytes[o + 2] === 0 && map.bytes[o + 3] === 0) continue;
      texelDir(map, ix, iy, _x);
      qRotate(q, _x, _w);
      if (localTempK(_w, sunWorld, tssK, heatK) > HG_MELT_K) {
        map.bytes[o + 2] = 0; map.bytes[o + 3] = 0; changed = true;
      } else live = true;
    }
  }
  map.marksLive = live;
  return changed;   // true only when a byte moved: that is what costs a texture upload
}

// The planet froze back to crust: a state change wipes every mark (plan P-2).
export function clearMarks(map) {
  if (!map.marksLive) return false;
  for (let i = 0; i < map.w * map.h; i++) { map.bytes[4 * i + 2] = 0; map.bytes[4 * i + 3] = 0; }
  map.marksLive = false;
  return true;
}
```

  - Check that `breakupFamily.js` does not import `scarMap.js` (that would be a cycle):
    `grep -n "scarMap" src/terminal/mercury/planet/breakupFamily.js`. Expected: no output.

- [ ] **Step 4: Run the tests and confirm they pass.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/scarMap.test.js src/terminal/mercury/planet/__tests__/mercuryImpacts.test.js`
  - Expected: PASS. All pre-existing crater tests still pass unchanged; that is the refactor's safety net.
  - Run: `npm run lint`. Expected: 0 errors.

- [ ] **Step 5: Commit.**

```bash
git add src/terminal/mercury/planet/scarMap.js src/terminal/mercury/planet/__tests__/scarMap.test.js
git commit -m "feat(mercury): visitors matrix 4 — scar map marks: frost (B), glaze (A), pit; heal where the Hg melts, clear on crust

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: visitorFrame — the new slots and bodies

**Files:**
- Modify: `src/terminal/mercury/planet/visitorFrame.js`
- Test: `src/terminal/mercury/planet/__tests__/visitorMatrixFrame.test.js` (create)

**Interfaces:**
- Consumes: Task 2's constants and helpers; `qRotate`.
- Produces:
  - `VIS_PLUME = 6`
  - Surface-slot layouts (`uVisitDir.w` = kind; `uVisitA` = (x, y, z, weight)):
    - `SURF_FROST`: (`frostRadius(a)`, 0, `seedFrac(seed)`, 1)
    - `SURF_POOL`: (`poolRadius(a)`, `poolFreeze(a)`, `hotTempK(a)`, 1)
    - `SURF_COLLAR`: (`ROCK_R / coreR`, `COLLAR_H`, 0, 1)
    - a strip uses the `SURF_JET` layout
  - Bodies:
    - a pool draws the phase 1 ember body
    - a sinking rock draws `VIS_ROCK`
    - a strip draws `VIS_PLUME`, packed as:
      - `vis`: (pos, `PLUME_W`)
      - `ax`: (unit downwind-and-up axis, length)
      - `k`: (`VIS_PLUME`, fade, `seedFrac(seed)`, 0)

- [ ] **Step 1: Write the failing test.** Create `src/terminal/mercury/planet/__tests__/visitorMatrixFrame.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createVisitors, createVisitorOut, launchVisitor, T_FLIGHT, EMBER_BODY_S, ROCK_R, COLLAR_H, PLUME_LEN, PLUME_W,
  SURF_FROST, SURF_POOL, SURF_COLLAR, SURF_JET, frostRadius, poolRadius, poolFreeze, hotTempK,
} from '../visitorSim';
import { createVisitorFrame, packVisitors, seedFrac, VIS_EMBER, VIS_ROCK, VIS_PLUME } from '../visitorFrame';
import { ctxFor, runTo } from './visitorTestKit';

function viewOf() {
  const cam = new THREE.PerspectiveCamera(40, 1.6, 0.1, 100);
  cam.position.set(0, 0, 3.6); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const m = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  return { vp: new Float32Array(m.elements), p00: cam.projectionMatrix.elements[0], p11: cam.projectionMatrix.elements[5], wPx: 1600, hPx: 1000 };
}

// Land one visitor and run it to `a` s after its touchdown; pack.
function packedAt(phase, tempK, tau, a) {
  const buf = createVisitors();
  const ctx = ctxFor(phase, tempK);
  ctx.tau = tau;
  const v = launchVisitor(buf, phase, ctx);
  runTo(buf, ctx, createVisitorOut(), T_FLIGHT[phase] + ctx.dt);
  runTo(buf, ctx, createVisitorOut(), v.tImpact + a);
  const f = packVisitors(buf, ctx, viewOf(), createVisitorFrame());
  return { v, f, ctx, age: ctx.tS - v.tImpact };
}

describe('visitorFrame — the matrix slots and bodies', () => {
  it('a creeping frost: one SURF_FROST slot at its live radius, no body', () => {
    const { v, f, age } = packedAt('fluid', 200, 1, 0.75);
    expect(f.n).toBe(0);
    expect(f.nSurf).toBe(1);
    expect(f.surfDir[3]).toBe(SURF_FROST);
    expect(f.surfA[0]).toBeCloseTo(frostRadius(age), 6);
    expect(f.surfA[2]).toBeCloseTo(seedFrac(v.seed), 3);
    expect(f.surfA[3]).toBe(1);
  });
  it('a growing pool: SURF_POOL at its radius, still liquid, its ember glowing in it', () => {
    const { f, age } = packedAt('thermal', 200, 1, 1);
    expect(f.surfDir[3]).toBe(SURF_POOL);
    expect(f.surfA[0]).toBeCloseTo(poolRadius(age), 6);
    expect(f.surfA[1]).toBe(0);
    expect(f.surfA[2]).toBeCloseTo(hotTempK(age), 3);
    expect(f.n).toBe(1);
    expect(f.k[0]).toBe(VIS_EMBER);
  });
  it('a refreezing pool: the ember is gone, the pool part frozen', () => {
    const { f, age } = packedAt('thermal', 200, 1, 3.5);
    expect(age).toBeGreaterThan(EMBER_BODY_S);
    expect(f.n).toBe(0);
    expect(f.surfA[1]).toBeCloseTo(poolFreeze(age), 6);
    expect(f.surfA[1]).toBeGreaterThan(0);
    expect(f.surfA[1]).toBeLessThan(1);
  });
  it('a sinking rock: the rock body and a crust collar', () => {
    const { f, ctx } = packedAt('earth', 400, 0.3, 2);
    expect(f.n).toBe(1);
    expect(f.k[0]).toBe(VIS_ROCK);
    expect(f.surfDir[3]).toBe(SURF_COLLAR);
    expect(f.surfA[0]).toBeCloseTo(ROCK_R / ctx.coreR, 9);
    expect(f.surfA[1]).toBeCloseTo(COLLAR_H, 9);
  });
  it('a strip: a vapour plume lifting downwind, and the gust slot', () => {
    const { v, f } = packedAt('air', 700, 1, 0.5);
    expect(f.n).toBe(1);
    expect(f.k[0]).toBe(VIS_PLUME);
    expect(f.vis[3]).toBeCloseTo(PLUME_W, 9);
    const ax = [f.ax[0], f.ax[1], f.ax[2]];
    expect(Math.hypot(...ax)).toBeCloseTo(1, 5);
    expect(ax[0] * v.dirWorld[0] + ax[1] * v.dirWorld[1] + ax[2] * v.dirWorld[2]).toBeGreaterThan(0);
    expect(f.ax[3]).toBeGreaterThan(0);
    expect(f.ax[3]).toBeLessThanOrEqual(PLUME_LEN + 1e-9);
    expect(f.surfDir[3]).toBe(SURF_JET);
    expect(f.visible).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/visitorMatrixFrame.test.js`
  - Expected: FAIL (`VIS_PLUME` is missing, and the new kinds pack nothing).

- [ ] **Step 3: Implement.** In `src/terminal/mercury/planet/visitorFrame.js`:
  - Replace the import block from `'./visitorSim'` with:

```js
import {
  VISITOR_SLOTS, VISIT_SURF_MAX, SURF_FILM, SURF_HOT, SURF_MENISCUS, SURF_JET, SURF_FROST, SURF_POOL, SURF_COLLAR, DROP_R,
  DROP_STRETCH_K, DROP_STRETCH_MAX, BEAD_OBLATE, EMBER_R, EMBER_BODY_S, EMBER_TAIL_S, EMBER_HALO, ROCK_R, ROCK_BOUND,
  GUST_TRAIL_S, GUST_W, MENISCUS_RING_DEPTH, JET_R, JET_DEPTH, COLLAR_H, PLUME_LEN, PLUME_LIFT, PLUME_W, PLUME_GROW_S,
  filmRadius, filmThicknessNm, clearRadius, clearDepth, hotTempK, jetEnvelope, frostRadius, poolRadius, poolFreeze,
} from './visitorSim';
```

  - Replace `export const VIS_DROP = 1, VIS_BEAD = 2, VIS_EMBER = 3, VIS_ROCK = 4, VIS_GUST = 5;` with:

```js
export const VIS_DROP = 1, VIS_BEAD = 2, VIS_EMBER = 3, VIS_ROCK = 4, VIS_GUST = 5, VIS_PLUME = 6;
```

  - Replace the whole `packSettled` function with:

```js
function packSettled(f, view, v, a, ctx) {
  if (v.kind === 'bead') {
    pushBody(f, view, VIS_BEAD, v.pos, v.r, v.dirWorld, BEAD_OBLATE, v.fade, 0, v.pos, BEAD_BOUND * v.r);
  } else if ((v.kind === 'ember' || v.kind === 'pool') && a < EMBER_BODY_S) {
    const body = 1 - Math.min(1, Math.max(0, (a - (EMBER_BODY_S - 0.5)) / 0.5));
    pushBody(f, view, VIS_EMBER, v.pos, EMBER_R, v.dirWorld, 0, v.fade * body, v.tempK, v.pos, 2 * EMBER_HALO * EMBER_R);
  } else if (v.kind === 'rock' || v.kind === 'sink') {
    pushBody(f, view, VIS_ROCK, v.pos, ROCK_R, rockAxis(v.seed, _g), v.spin, v.fade, seedFrac(v.seed), v.pos, 1.2 * ROCK_BOUND * ROCK_R);
  } else if (v.kind === 'strip') {
    // Hg vapour torn off the boiling surface: a streamer along the gust, lifting as it goes
    qRotate(ctx.q, v.tan, _a);
    _a[0] += v.dirWorld[0] * PLUME_LIFT; _a[1] += v.dirWorld[1] * PLUME_LIFT; _a[2] += v.dirWorld[2] * PLUME_LIFT;
    unitInto(_a, _a);
    const len = PLUME_LEN * Math.min(1, a / PLUME_GROW_S);
    pushBody(f, view, VIS_PLUME, v.pos, PLUME_W, _a, len, v.fade, seedFrac(v.seed), _c, trailBound(v.pos, _a, len, 3 * PLUME_W));
  }
}
```

  - Replace the `hasSurface` line and its comment with:

```js
// Film, hot spot, gust, strip, frost and pool stay in the surface while they fade (even when flung); a rock's meniscus
// and a sinking rock's collar leave with the rock.
const hasSurface = (v) => v.kind === 'film' || v.kind === 'ember' || v.kind === 'jet' || v.kind === 'strip' || v.kind === 'frost'
  || v.kind === 'pool' || ((v.kind === 'rock' || v.kind === 'sink') && v.state === 'resident');
```

  - In `packSurface`, replace everything from `  if (v.kind === 'film') {` to the function's closing `}` with:

```js
  if (v.kind === 'film') {
    D[o + 3] = SURF_FILM; A[o] = filmRadius(a); A[o + 1] = filmThicknessNm(a); A[o + 2] = a;
  } else if (v.kind === 'ember') {
    D[o + 3] = SURF_HOT; A[o] = clearRadius(a); A[o + 1] = clearDepth(a); A[o + 2] = hotTempK(a);
  } else if (v.kind === 'rock') {
    D[o + 3] = SURF_MENISCUS; A[o] = ROCK_R / ctx.coreR; A[o + 1] = MENISCUS_RING_DEPTH; A[o + 2] = 0;
  } else if (v.kind === 'frost') {
    D[o + 3] = SURF_FROST; A[o] = frostRadius(a); A[o + 1] = 0; A[o + 2] = seedFrac(v.seed);
  } else if (v.kind === 'pool') {
    D[o + 3] = SURF_POOL; A[o] = poolRadius(a); A[o + 1] = poolFreeze(a); A[o + 2] = hotTempK(a);
  } else if (v.kind === 'sink') {
    D[o + 3] = SURF_COLLAR; A[o] = ROCK_R / ctx.coreR; A[o + 1] = COLLAR_H; A[o + 2] = 0;
  } else {
    // a gust, or a gust stripping boiling Hg: the same dent and cat's-paws
    D[o + 3] = SURF_JET; A[o] = JET_R; A[o + 1] = JET_DEPTH * jetEnvelope(a); A[o + 2] = a;
    qRotate(ctx.q, v.tan, _g);
    B[o] = _g[0]; B[o + 1] = _g[1]; B[o + 2] = _g[2];
  }
}
```

  - In `packVisitors`, replace `    packSettled(f, view, v, ctx.tS - v.tImpact);` with
    `    packSettled(f, view, v, ctx.tS - v.tImpact, ctx);`.

- [ ] **Step 4: Run the tests and confirm they pass.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/`
  - Expected: PASS.
  - Run: `npm run lint`. Expected: 0 errors.

- [ ] **Step 5: Commit.**

```bash
git add src/terminal/mercury/planet/visitorFrame.js src/terminal/mercury/planet/__tests__/visitorMatrixFrame.test.js
git commit -m "feat(mercury): visitors matrix 5 — frame: frost front, melt pool, crust collar slots; pool ember, sinking rock, vapour plume

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Planet shader — marks on frozen Hg, the pool, the crust collar

**Files:**
- Modify: `src/terminal/mercury/planet/visitorSim.js` (look constants)
- Modify: `src/terminal/mercury/planet/mercuryPlanetShader.js`
- Modify: `src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.full.fs.glsl` (regenerated)
- Test: `src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js` (append)
- Create (gitignored, not committed): `.superpowers/sdd/tools/matrixCompile.mjs`

**Interfaces:**
- Consumes:
  - the slot layouts from Task 5
  - the scar texture's `.b` (frost) and `.a` (glaze) from Task 4
  - `frozenAether`, `aetherMirror`, `envRadiance`, `fresnelHg`, `SOLID_HG_SPECULAR` (all declared above the visitors block)
- Produces:
  - Uniform `uMarksOn` (float; 1 while the scar map has marks), declared and listed in `PLANET_UNIFORMS`.
  - Look constants exported from `visitorSim.js`: `FROST_ALBEDO`, `FROST_ENV`, `GLAZE_ROUGH`, `POOL_RIM_H`.
  - GLSL functions in the visitors block: `visitFrost`, `visitPool`, `visitCrustTilt`, `visitMarks`.

- [ ] **Step 1: Write the failing test.** Append to `src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`:
  - Add `FROST_ALBEDO, FROST_ENV, GLAZE_ROUGH, POOL_RIM_H, SURF_HOT, SURF_FROST, SURF_POOL, SURF_COLLAR` to an import from
    `'../visitorSim'`. Merge them into the existing import from that module if there is one.
  - Make sure `v3` is imported from `'../../../gl/glf'` alongside `glf`.

```js
describe('visitors matrix: marks on frozen Hg, the pool, the crust collar', () => {
  it('declares uMarksOn (marked) and lists it', () => {
    expect(PLANET_FS).toContain('uniform float uMarksOn; // visitors');
    expect(PLANET_UNIFORMS).toContain('uMarksOn');
  });
  it('interpolates the look constants from visitorSim', () => {
    for (const [name, value] of Object.entries({ FROST_ENV, GLAZE_ROUGH, POOL_RIM_H })) {
      expect(PLANET_FS).toContain(`const float ${name} = ${glf(value)};`);
    }
    expect(PLANET_FS).toContain(`const vec3 FROST_ALBEDO = ${v3(FROST_ALBEDO)};`);
  });
  it('the pool turns frozen Hg liquid before the contact line is drawn; marks paint the solid branch; the collar tilts the crust', () => {
    const main = PLANET_FS.slice(PLANET_FS.indexOf('void main()'));
    const lw = main.indexOf('float liquidW = smoothstep(');
    const pool = main.indexOf('if (uVisitOn > 0.5) liquidW = max(liquidW, visitPool(xw)); // visitors');
    const fluidMix = main.indexOf('fluid = mix(fluidSoft, fluidHard, liquidW * clamp(uMeniscus, 0.0, 1.0));');
    expect(pool).toBeGreaterThan(lw);
    expect(pool).toBeLessThan(fluidMix);
    const solidEnd = main.indexOf('+ frozenAether(R, nW, NoV) + vec3(glint * SPARKLE_GAIN * sunI);');
    const marks = main.indexOf('if (uMarksOn > 0.5 || uVisitOn > 0.5) solid = visitMarks(solid, uv, gx, gy, hit, xw, R, nW, NoV, sunI * max(dot(nW, uSunDir), 0.0) * term); // visitors');
    const mixL = main.indexOf('colLin = mix(colLin, mix(solid, liquid, liquidW), fluid);');
    expect(marks).toBeGreaterThan(solidEnd);
    expect(marks).toBeLessThan(mixL);
    const relief = main.indexOf('n = normalize(nb - east');
    const crust = main.indexOf('if (uVisitOn > 0.5) n = normalize(n - transpose(uBodyRot) * visitCrustTilt(xw)); // visitors');
    const rays = main.indexOf('// Fresh crater rays brighten the crust');
    expect(crust).toBeGreaterThan(relief);
    expect(crust).toBeLessThan(rays);
  });
  it('the calm variant still draws the persistent marks, with no live slots', () => {
    const fs = buildPlanetShader({ tier: 'full', calm: true }).fs;
    expect(fs).toContain('const int VISIT_SLOTS = 0;');
    expect(fs).toContain('solid = visitMarks(');
  });
  it('the pool glows like a hot spot; the frost, pool and collar slots each have a reader', () => {
    expect(PLANET_FS).toContain(`D.w == ${glf(SURF_HOT)} || D.w == ${glf(SURF_POOL)}`);
    for (const c of [SURF_FROST, SURF_POOL, SURF_COLLAR]) expect(PLANET_FS).toContain(`D.w != ${glf(c)}`);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`
  - Expected: FAIL in "visitors matrix" (missing exports and lines).

- [ ] **Step 3: Implement.**
  - In `src/terminal/mercury/planet/visitorSim.js`, add after the `CATSPAW_SPEED` line:

```js
// The matrix's looks on frozen Hg (planet shader).
export const FROST_ALBEDO = [0.8, 0.84, 0.9];  // rime: a cold, faintly blue white
export const FROST_ENV = 0.5;                   // how much of the nebula + node light the matte rime gathers (spec R5)
export const GLAZE_ROUGH = 0.1;                 // a refrozen pool: far smoother than polycrystalline frozen Hg
export const POOL_RIM_H = 0.0025;               // fraction of R: the pool's meniscus lip against its frozen shore
```

  - In `src/terminal/mercury/planet/mercuryPlanetShader.js`:
    - Add `FROST_ALBEDO, FROST_ENV, GLAZE_ROUGH, POOL_RIM_H, SURF_FROST, SURF_POOL, SURF_COLLAR` to the existing import from
      `'./visitorSim'`.
    - In `PLANET_UNIFORMS`, change `'uVisitOn', 'uVisitDir', 'uVisitA', 'uVisitB',` to
      `'uVisitOn', 'uVisitDir', 'uVisitA', 'uVisitB', 'uMarksOn',`.
    - After the line `uniform vec4 uVisitB[${VISIT_SURF_MAX}]; // visitors`, add:

```glsl
uniform float uMarksOn; // visitors
```

    - Inside the `// <visitors>` block, after `const float JET_DEPTH = ${glf(JET_DEPTH)};`, add:

```glsl
const vec3 FROST_ALBEDO = ${v3(FROST_ALBEDO)};
const float FROST_ENV = ${glf(FROST_ENV)};
const float GLAZE_ROUGH = ${glf(GLAZE_ROUGH)};
const float POOL_RIM_H = ${glf(POOL_RIM_H)};
```

    - In `visitTilt`, insert this branch directly before the line `    } else if (D.w == ${glf(SURF_JET)}) {`:

```glsl
    } else if (D.w == ${glf(SURF_POOL)}) {
      // the melt pool's meniscus: a raised lip where the liquid meets its frozen shore, gone as it refreezes
      sl = -visDent(th, A.x, 0.2 * A.x, POOL_RIM_H * (1.0 - A.y));
```

    - In `visitTint`, change `    } else if (D.w == ${glf(SURF_HOT)}) {` to
      `    } else if (D.w == ${glf(SURF_HOT)} || D.w == ${glf(SURF_POOL)}) {`.
    - Directly before the line `// </visitors>`, add:

```glsl

// The frost front creeping out (SURF_FROST): coverage on frozen Hg, its edge ragged like rime.
float visitFrost(vec3 x) {
  float cov = 0.0;
  for (int i = 0; i < VISIT_SLOTS; i++) {
    vec4 D = uVisitDir[i];
    vec4 A = uVisitA[i];
    if (A.w <= 0.0 || D.w != ${glf(SURF_FROST)}) continue;
    float th = acos(clamp(dot(x, D.xyz), -1.0, 1.0));
    float edge = max(A.x, 1e-4) * (0.75 + 0.5 * vnoise3(x * 90.0 + A.z));
    cov = max(cov, A.w * (1.0 - smoothstep(0.8 * edge, edge, th)));
  }
  return cov;
}

// The melt pool (SURF_POOL): how liquid the frozen surface is here, until it refreezes (A.y: 0 liquid → 1 frozen).
float visitPool(vec3 x) {
  float liq = 0.0;
  for (int i = 0; i < VISIT_SLOTS; i++) {
    vec4 D = uVisitDir[i];
    vec4 A = uVisitA[i];
    if (A.w <= 0.0 || D.w != ${glf(SURF_POOL)}) continue;
    float th = acos(clamp(dot(x, D.xyz), -1.0, 1.0));
    liq = max(liq, A.w * (1.0 - A.y) * (1.0 - smoothstep(0.85 * A.x, A.x, th)));
  }
  return liq;
}

// The crust pushed up round a sinking rock (SURF_COLLAR): a slope for the crust normal, world frame.
vec3 visitCrustTilt(vec3 x) {
  vec3 g = vec3(0.0);
  for (int i = 0; i < VISIT_SLOTS; i++) {
    vec4 D = uVisitDir[i];
    vec4 A = uVisitA[i];
    if (A.w <= 0.0 || D.w != ${glf(SURF_COLLAR)}) continue;
    float m = clamp(dot(x, D.xyz), -1.0, 1.0);
    float s = sqrt(max(1.0 - m * m, 0.0));
    if (s < 1e-4) continue;
    g -= A.w * visDent(acos(m), 1.3 * A.x, 0.5 * A.x, A.y) * (x * m - D.xyz) / s;
  }
  return g;
}

// Frost and glaze on frozen Hg: the scar map's B / A (stamped, persistent) and the live frost front.
vec3 visitMarks(vec3 solid, vec2 uv, vec2 gx, vec2 gy, vec3 P, vec3 x, vec3 R, vec3 nW, float NoV, float sunLit) {
  vec2 m = uMarksOn > 0.5 ? textureGrad(uScar, uv, gx, gy).ba : vec2(0.0);
  // glaze: the refrozen pool is smoother than the polycrystalline Hg around it
  vec3 glazed = solid - frozenAether(R, nW, NoV) + SOLID_HG_SPECULAR * fresnelHg(NoV) * aetherMirror(R, GLAZE_ROUGH, nW);
  solid = mix(solid, glazed, m.y);
  // frost: matte rime, lit by the Sun where it reaches and by the nebula and the element nodes (spec R5)
  float frost = max(m.x, visitFrost(x));
  vec3 rime = FROST_ALBEDO * (sunLit + uNightFloor + FROST_ENV * envRadiance(nW, 1.0, P, nW));
  return mix(solid, rime, frost);
}
```

    - In `main()`, after the closing `}` of the `if (uHasMaps > 0.5) { … }` block and before the line
      `  // Fresh crater rays brighten the crust; they mature back to background (scarMap.js).`, add:

```glsl
  if (uVisitOn > 0.5) n = normalize(n - transpose(uBodyRot) * visitCrustTilt(xw)); // visitors
```

    - In `main()`, directly after the line `      float liquidW = smoothstep(HG_MELT_K - PHASE_BLEND_K, HG_MELT_K + PHASE_BLEND_K, T);`, add:

```glsl
      if (uVisitOn > 0.5) liquidW = max(liquidW, visitPool(xw)); // visitors
```

    - In `main()`, inside `if (liquidW < 1.0) {`, directly after the two-line statement ending
      `+ frozenAether(R, nW, NoV) + vec3(glint * SPARKLE_GAIN * sunI);`, add:

```glsl
        if (uMarksOn > 0.5 || uVisitOn > 0.5) solid = visitMarks(solid, uv, gx, gy, hit, xw, R, nW, NoV, sunI * max(dot(nW, uSunDir), 0.0) * term); // visitors
```

  - Regenerate the full-tier snapshot:
    - Run `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js -u`.
    - Then `git diff --stat src/terminal/mercury/planet/__tests__/__snapshots__/`.
    - Expected: only `planetShader.full.fs.glsl` changes, and every added or changed line in it contains `visitors` or sits inside
      the `// <visitors>` block. `planetShader.pre-visitors.fs.glsl` must NOT change. If it does, revert it and fix the marking.
  - GPU compile check. Create `.superpowers/sdd/tools/matrixCompile.mjs`:

```js
// Compile + link the planet shader (every tier, calm and not) and the visitor body pass in headless WebGL2.
// Needs the dev server on :5175 (it serves the modules).
const { launch } = await import(new URL('file:///F:/scale_9.4/scripts/cdp.mjs'));
const page = await launch({ url: 'about:blank', width: 400, height: 300 });
try {
  await page.goto('http://localhost:5175/', { waitMs: 500 });
  const out = await page.eval(`(async () => {
    const P = await import('/src/terminal/mercury/planet/mercuryPlanetShader.js');
    const V = await import('/src/terminal/mercury/planet/visitorShader.js');
    const gl = document.createElement('canvas').getContext('webgl2');
    const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, '#version 300 es' + String.fromCharCode(10) + src); gl.compileShader(o);
      return { o, ok: gl.getShaderParameter(o, gl.COMPILE_STATUS), log: gl.getShaderInfoLog(o) }; };
    const link = (vsSrc, fsSrc) => { const vs = sh(gl.VERTEX_SHADER, vsSrc), fs = sh(gl.FRAGMENT_SHADER, fsSrc);
      const p = gl.createProgram(); gl.attachShader(p, vs.o); gl.attachShader(p, fs.o); gl.linkProgram(p);
      return { ok: !!(vs.ok && fs.ok && gl.getProgramParameter(p, gl.LINK_STATUS)), log: [vs.log, fs.log, gl.getProgramInfoLog(p)].filter(Boolean).join(' | ') }; };
    const res = {};
    for (const tier of ['full', 'phone', 'lite']) for (const calm of [false, true]) {
      const s = P.buildPlanetShader({ tier, calm });
      res[tier + (calm ? '+calm' : '')] = link(s.vs, s.fs);
    }
    const v = V.buildVisitorShader();
    res.visitors = link(v.vs, v.fs);
    return res; })()`, { awaitPromise: true });
  console.log(JSON.stringify(out, null, 1));
} catch (e) { console.error('FAIL', e.message); } finally { await page.close(); process.exit(0); }
```

    - The Vite dev server must be running on :5175. If it is not, report NEEDS_CONTEXT; do not start one.
    - Run: `node .superpowers/sdd/tools/matrixCompile.mjs`.
    - Expected: every entry `"ok": true` with an empty `log`. If headless Chrome needs it, check how `scripts/cdp.mjs` launches
      (`--enable-unsafe-swiftshader`). Fix any GLSL error in the visitors block; that is in scope.

- [ ] **Step 4: Run the tests and confirm they pass.**
  - Run: `npx vitest run src/terminal/mercury/`
  - Expected: PASS, including the existing strip-parity test `'stripping the visitor lines gives back the pre-visitors shader byte for byte'`.
  - Run: `npm run lint`. Expected: 0 errors.

- [ ] **Step 5: Commit.** (The compile tool is gitignored scratch; put its output in your report.)

```bash
git add src/terminal/mercury/planet/visitorSim.js src/terminal/mercury/planet/mercuryPlanetShader.js src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.full.fs.glsl
git commit -m "feat(mercury): visitors matrix 6 — planet shader: frost and glaze on frozen Hg, the melt pool, the crust collar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The vapour plume in the body pass

**Files:**
- Modify: `src/terminal/mercury/planet/visitorShader.js`
- Test: `src/terminal/mercury/planet/__tests__/visitorShader.test.js` (append)

**Interfaces:**
- Consumes:
  - `VIS_PLUME` and its packing from Task 5:
    - `uVis`: (pos, `PLUME_W`)
    - `uVisAx`: (unit axis, length)
    - `uVisK`: (code, fade, seed, 0)
  - the existing `raySeg`, `gauss`, `vn3`, and the glow accumulation (`gP`, `gA`, `gT`)
- Produces: `PLUME_A`, `PLUME_COL` exported from `visitorShader.js`; a `VIS_PLUME` branch.

- [ ] **Step 1: Write the failing test.** Append to `src/terminal/mercury/planet/__tests__/visitorShader.test.js`, and add
  `PLUME_A, PLUME_COL` to its import from `'../visitorShader'` and `VIS_PLUME` to its import from `'../visitorFrame'`:

```js
describe('visitors matrix: the vapour plume', () => {
  it('draws VIS_PLUME as a translucent streamer with its own constants', () => {
    const { fs } = buildVisitorShader();
    expect(fs).toContain(`const int VIS_PLUME = ${VIS_PLUME};`);
    expect(fs).toContain(`const float PLUME_A = ${glf(PLUME_A)};`);
    expect(fs).toContain(`const vec3 PLUME_COL = ${v3(PLUME_COL)};`);
    expect(fs).toContain('} else if (kind == VIS_PLUME) {');
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/visitorShader.test.js`
  - Expected: FAIL.

- [ ] **Step 3: Implement.** In `src/terminal/mercury/planet/visitorShader.js`:
  - In the header comment, after the line `//   gust: a faint chromatic shimmer plus dust motes (true background refraction would need a scene copy).`, add:

```js
//   plume (matrix): Hg vapour stripped off boiling mercury by a gust, a pale streamer widening downwind.
```

  - Change the import from `'./visitorFrame'` to
    `import { VIS_DROP, VIS_BEAD, VIS_EMBER, VIS_ROCK, VIS_GUST, VIS_PLUME } from './visitorFrame';`.
  - Add after `export const MOTE_COL = [0.5, 0.48, 0.45];`:

```js
export const PLUME_A = 0.2;
export const PLUME_COL = [0.62, 0.68, 0.78];
```

  - In the GLSL, after `const int VIS_GUST = ${VIS_GUST};`, add `const int VIS_PLUME = ${VIS_PLUME};`.
  - In the GLSL, after `const vec3 MOTE_COL = ${v3(MOTE_COL)};`, add:

```glsl
const float PLUME_A = ${glf(PLUME_A)};
const vec3 PLUME_COL = ${v3(PLUME_COL)};
```

  - In `main()`, the `VIS_GUST` branch ends with its motes loop's `      }` and then the chain's closing `    }`, directly before
    the outer loop's own closing `  }` and the line `  if (alpha <= 0.0 && gA <= 1e-4) discard;`. Replace that chain-closing
    `    }` with the block below, which ends with its own `    }`:

```glsl
    } else if (kind == VIS_PLUME) {
      // Hg vapour stripped off boiling mercury: a pale streamer, widening and thinning downwind
      vec3 b = c + X.xyz * X.w;
      float u, tr;
      float d = raySeg(ro, rd, c, b, u, tr);
      float wd = r * (0.6 + 1.8 * u);
      float a = clamp(PLUME_A * fade * gauss(d / wd) * (1.0 - u * u) * (0.6 + 0.4 * vn3((ro + rd * tr - c) / r * 0.8 - X.xyz * (uTime * 2.0) + K.z)), 0.0, 1.0);
      gP += PLUME_COL * a; gA = 1.0 - (1.0 - gA) * (1.0 - a); gT = min(gT, tr);
    }
```

  - Run the compile check from Task 6 (`node .superpowers/sdd/tools/matrixCompile.mjs`, dev server on :5175).
    Expected: `visitors` `"ok": true`, empty log.

- [ ] **Step 4: Run the tests and confirm they pass.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/visitorShader.test.js src/terminal/mercury/__tests__/useVisitorField.test.js`
  - Expected: PASS.
  - Run: `npm run lint`. Expected: 0 errors.

- [ ] **Step 5: Commit.**

```bash
git add src/terminal/mercury/planet/visitorShader.js src/terminal/mercury/planet/__tests__/visitorShader.test.js
git commit -m "feat(mercury): visitors matrix 7 — the vapour plume a gust strips off boiling mercury

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Wire stamps, healing and the marks uniform into MercuryPlanet

**Files:**
- Modify: `src/terminal/mercury/MercuryPlanet.jsx`
- Test: `src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js` (append)

**Interfaces:**
- Consumes:
  - `vis.out.nStamps` / `vis.out.stamps` (Task 3)
  - `stampFrost`, `stampGlaze`, `stampPit`, `healMelted`, `clearMarks`, `scar.marksLive` (Task 4)
  - `PIT_DEPTH_M` (Task 2)
  - `uMarksOn` (Task 6)
- Produces:
  - stamps drained into the scar map every frame (also under calm)
  - frost and glaze healed on the 5 s scar tick and cleared when τ < `LIQUID_TAU`
  - `uMarksOn`
  - a strip's exosphere puff
  - the dev global `window.__mercuryScar`

- [ ] **Step 1: Write the failing test.** Append to `src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js`:

```js
describe('visitors matrix wiring', () => {
  it('drains the stamps into the scar map, under calm too', () => {
    const drain = planetSrc.indexOf('for (let k = 0; k < vis.out.nStamps; k++) {');
    expect(drain).toBeGreaterThan(planetSrc.indexOf('stepVisitors(vis.buf, vc, vis.out);'));
    expect(planetSrc).toContain("if (st.kind === 'frost') stampFrost(scar, st.dirBody, st.radius, st.seed);");
    expect(planetSrc).toContain("else if (st.kind === 'glaze') stampGlaze(scar, st.dirBody, st.radius);");
    expect(planetSrc).toContain('else stampPit(scar, st.dirBody, st.radius, PIT_DEPTH_M);');
  });
  it('rings frost and the pool like solid Hg, sends nothing for a sink, puffs the exosphere for a strip', () => {
    expect(planetSrc).toContain("} else if (ev.impulse === 'ring') {");
    expect(planetSrc).toContain('} else if (ev.impulse) {');
    expect(planetSrc).toContain("if (ev.kind === 'strip') vis.exoPuff = EXO_PUFF;");
  });
  it('heals marks where the Hg melts on the scar tick, clears them on crust, and gates the shader on them', () => {
    expect(planetSrc).toContain('if (healMelted(scar, vc.q, SUN_DIR_WORLD, vc.subsolarT, body.heatK)) scarDirty = true;');
    expect(planetSrc).toContain('if (body.tau < LIQUID_TAU && clearMarks(scar)) scarDirty = true;');
    expect(planetSrc).toContain('uMarksOn: { value: 0 },');
    expect(planetSrc).toContain('u.uMarksOn.value = scar.marksLive ? 1 : 0;');
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails.**
  - Run: `npx vitest run src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js`
  - Expected: FAIL in "visitors matrix wiring".

- [ ] **Step 3: Implement.** In `src/terminal/mercury/MercuryPlanet.jsx`:
  - Replace `import { createScarMap, stampCrater, matureScars, healScars, SCAR_TICK_S } from './planet/scarMap';` with:

```js
import {
  createScarMap, stampCrater, stampFrost, stampGlaze, stampPit, matureScars, healScars, healMelted, clearMarks, SCAR_TICK_S,
} from './planet/scarMap';
```

  - Add `LIQUID_TAU,` to the existing import from `'./planet/mercuryWaves'`, unless it is already imported.
  - Add `PIT_DEPTH_M,` to the existing import from `'./planet/visitorSim'`.
  - After the line `  useEffect(() => () => scarTex.dispose(), [scarTex]);`, add:

```js
  useEffect(() => { if (import.meta.env.DEV) window.__mercuryScar = scar; }, [scar]); // probes read the marks
```

  - In the uniforms object, after the `uVisitB: …` line, add:

```js
      uMarksOn: { value: 0 },
```

  - In the touchdown drain, replace:

```js
      } else if (ev.kind === 'ring') {
        addImpulse(surf.impulses, { dirBody: ev.dirBody, tS: t, mode: IMPACT_MODE_AMP.ring, wave: IMPACT_WAVE_AMP.ring, kind: 'ring' });
      } else {
        const a = VISITOR_IMPACT[ev.impulse];
        addImpulse(surf.impulses, { dirBody: ev.dirBody, tS: t, mode: a.mode, wave: a.wave, kind: ev.impulse });
        if (ev.phase === 'thermal' && ev.tempK > HG_BOIL_K) vis.exoPuff = EXO_PUFF;
      }
    }
```

    with:

```js
      } else if (ev.impulse === 'ring') {
        // frozen Hg rings, frost and melt pools included (plan P-5)
        addImpulse(surf.impulses, { dirBody: ev.dirBody, tS: t, mode: IMPACT_MODE_AMP.ring, wave: IMPACT_WAVE_AMP.ring, kind: 'ring' });
      } else if (ev.impulse) {
        const a = VISITOR_IMPACT[ev.impulse];
        addImpulse(surf.impulses, { dirBody: ev.dirBody, tS: t, mode: a.mode, wave: a.wave, kind: ev.impulse });
        if (ev.phase === 'thermal' && ev.tempK > HG_BOIL_K) vis.exoPuff = EXO_PUFF;
        if (ev.kind === 'strip') vis.exoPuff = EXO_PUFF; // a gust strips vapour off boiling Hg into the exosphere
      }
    }
    // Persistent marks (frost, glaze, pit): stamped even under reduced motion; a mark is not motion.
    for (let k = 0; k < vis.out.nStamps; k++) {
      const st = vis.out.stamps[k];
      if (st.kind === 'frost') stampFrost(scar, st.dirBody, st.radius, st.seed);
      else if (st.kind === 'glaze') stampGlaze(scar, st.dirBody, st.radius);
      else stampPit(scar, st.dirBody, st.radius, PIT_DEPTH_M);
      scarDirty = true;
    }
```

  - Replace:

```js
    if (body.tau >= 1 && healScars(scar)) scarDirty = true;
    surf.scarClock += Math.min(delta, MAX_FRAME_DT_S);
    if (surf.scarClock >= SCAR_TICK_S) {
      if (matureScars(scar, surf.scarClock)) scarDirty = true;
      surf.scarClock = 0;
    }
    if (scarDirty) scarTex.needsUpdate = true;
```

    with:

```js
    if (body.tau >= 1 && healScars(scar)) scarDirty = true;
    if (body.tau < LIQUID_TAU && clearMarks(scar)) scarDirty = true;
    surf.scarClock += Math.min(delta, MAX_FRAME_DT_S);
    if (surf.scarClock >= SCAR_TICK_S) {
      if (matureScars(scar, surf.scarClock)) scarDirty = true;
      // frost and glaze go where the Hg under them has melted (the shader already hides them there; this frees the bytes)
      if (healMelted(scar, vc.q, SUN_DIR_WORLD, vc.subsolarT, body.heatK)) scarDirty = true;
      surf.scarClock = 0;
    }
    if (scarDirty) scarTex.needsUpdate = true;
    u.uMarksOn.value = scar.marksLive ? 1 : 0;
```

- [ ] **Step 4: Run the tests and confirm they pass.**
  - Run: `npx vitest run src/terminal/mercury/`
  - Expected: PASS.
  - Run: `npm run lint`. Expected: 0 errors.
  - Live smoke (dev server on :5175, CDP; you may reuse `.superpowers/sdd/tools/visitorLive.mjs` patterns and `openMercury.mjs`):
    - Open Mercury, then `__mercuryTune.strike('fluid')`, `('thermal')`, `('earth')` and `('air')`.
    - Expected:
      - no console errors and no `PROGRAM NOT RUNNABLE`
      - `window.__mercury.gl.info.programs.filter(p => p.diagnostics && !p.diagnostics.runnable).length === 0`
      - once every visitor is gone: `__mercuryVisitors.buf.live === 0`, `__mercuryVisitors.frame.visible === false`, and the planet's
        `uVisitOn === 0`
    - Put the probe output in your report.

- [ ] **Step 5: Commit.**

```bash
git add src/terminal/mercury/MercuryPlanet.jsx src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js
git commit -m "feat(mercury): visitors matrix 8 — wire stamps into the scar map, heal and clear the marks, uMarksOn, the strip's puff

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Look sheet, heal check, live verification

**Files:**
- Create (gitignored scratch, not committed): `.superpowers/sdd/tools/visitorMatrixSheet.mjs`

**Interfaces:**
- Consumes:
  - the dev rig (`__mercuryTune.strike`, `visitTemp`, `visitTime`)
  - `window.__mercuryVisitors` (`buf`, `ctx`, `clock`)
  - `window.__mercuryScar`
  - `openMercury.mjs` (`melt`, `shot`, `errors`, `st`)
  - `mkSheet.mjs`
- Produces: `.superpowers/sdd/tools/out/vm-<TAG>-*.png`, a tiled sheet, and a report with every checklist item judged.

- [ ] **Step 1: Write the capture script.** Create `.superpowers/sdd/tools/visitorMatrixSheet.mjs`:

```js
// Visitors matrix look sheet (matrix spec §6). Each pairing waits for its real state (plan P-6): frozen Hg at the aim point
// while a melted planet cools, soft crust while it melts, boiling Hg near noon. It falls back to a visitTemp pin only if the
// state never arrives (logged). Also: phase 1's liquid reactions re-shot with the new aim, and the heal check.
// node visitorMatrixSheet.mjs  →  OUT/vm-<TAG>-*.png ; prints MKSHEET args and a JSON log. Needs the dev server on :5175.
import { openMercury, sleep, OUT } from './openMercury.mjs';
const { launch } = await import(new URL('file:///F:/scale_9.4/scripts/cdp.mjs'));
const TAG = process.env.TAG || 'p1';
const T_FLIGHT = { fluid: 0.75, thermal: 0.6, earth: 0.85, air: 0.65 };
const page = await launch({ url: 'about:blank', width: 1600, height: 1000 });
const files = [], log = [];
const clock = () => page.eval('window.__mercuryVisitors.clock');
// tau, and the local temperature at the sub-camera point (every landing is within 35° of it)
const state = () => page.eval(`(async () => {
  const I = await import('/src/terminal/mercury/planet/mercuryImpacts.js');
  const F = await import('/src/terminal/mercury/planet/planetFrame.js');
  const c = window.__mercuryVisitors.ctx, l = Math.hypot(...c.cam);
  return { tau: c.tau, T: I.localTempK(c.cam.map((x) => x / l), F.SUN_DIR_WORLD, c.subsolarT, c.heatK) };
})()`, { awaitPromise: true });
async function waitFor(pred, label, timeoutS) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutS * 1000) { const s = await state(); if (pred(s)) return s; await sleep(250); }
  log.push({ label, timedOut: true, last: await state() });
  return null;
}
async function shotAt(m, c0, simS, name) {
  while ((await clock()) < c0 + simS) await sleep(15);
  await page.eval('window.__mercuryTune.visitTime(0); 1');
  await sleep(250);
  const f = `${OUT}/vm-${TAG}-${name}.png`;
  await m.shot(f, 420);
  files.push(`${name}=${f}`);
  await page.eval('window.__mercuryTune.visitTime(null); 1');
}
async function strikeAndShoot(m, phase, offs, label) {
  const c0 = await clock();
  await page.eval(`window.__mercuryTune.strike('${phase}'); 1`);
  for (const off of offs) await shotAt(m, c0, T_FLIGHT[phase] + off, `${label}+${off}s`);
  const kind = await page.eval(`(window.__mercuryVisitors.buf.v.find((v) => v.live && v.phase === '${phase}') || {}).kind || 'gone'`);
  log.push({ label, kind });
}
const marked = () => page.eval('(() => { const b = window.__mercuryScar.bytes; let n = 0; for (let i = 2; i < b.length; i += 4) if (b[i] || b[i + 1]) n++; return n; })()');
try {
  const m = await openMercury(page);
  await page.waitFor('!!window.__mercuryTune && !!window.__mercuryVisitors && !!window.__mercuryScar', { timeoutMs: 30000, label: 'rig' });
  // soft crust: strike earth while tau climbs through [0.15, 0.4]
  await m.melt(6);
  if (await waitFor((s) => s.tau >= 0.15 && s.tau <= 0.4, 'soft crust', 40)) await strikeAndShoot(m, 'earth', [0.1, 2.5, 5.2, 10], 'sink');
  // liquid: phase 1 re-shot with the aim
  await m.melt(25); await sleep(4000);
  for (const [phase, label] of [['fluid', 'film'], ['thermal', 'ember'], ['earth', 'rock'], ['air', 'jet']]) await strikeAndShoot(m, phase, [1], `aim-${label}`);
  // boiling at the aim point (else pin the branch, logged)
  await m.melt(25);
  if (!(await waitFor((s) => s.tau >= 0.99 && s.T > 640, 'boiling at aim', 15))) await page.eval('window.__mercuryTune.visitTemp(700); 1');
  await strikeAndShoot(m, 'air', [0.1, 0.5, 1.0], 'strip');
  await page.eval('window.__mercuryTune.visitTemp(null); 1');
  // frozen at the aim point: the cool-down after a melt (plan P-6)
  const frozen = await waitFor((s) => s.tau >= 0.6 && s.T < 225, 'frozen at aim', 120);
  if (!frozen) await page.eval('window.__mercuryTune.visitTemp(200); 1');
  await strikeAndShoot(m, 'fluid', [0.1, 0.75, 1.6, 10], 'frost');
  await strikeAndShoot(m, 'thermal', [0.1, 1.5, 4.2, 10], 'pool');
  await page.eval('window.__mercuryTune.visitTemp(null); 1');
  log.push({ label: 'marks after frost+glaze', texels: await marked() });
  // heal: spin it hot again, wait past a scar tick; the marks must be gone and stay gone
  await m.melt(25); await sleep(7000);
  log.push({ label: 'marks after re-melt + tick', texels: await marked() });
  await shotAt(m, await clock(), 0.05, 'healed');
  console.log('errors', JSON.stringify(await m.errors()));
  console.log('LOG', JSON.stringify(log, null, 1));
  console.log('MKSHEET', files.join(' '));
} catch (e) { console.error('FAIL', e.message); } finally { await page.close(); process.exit(0); }
```

- [ ] **Step 2: Capture and tile.**
  - With the dev server running: `node .superpowers/sdd/tools/visitorMatrixSheet.mjs`.
  - Then: `node .superpowers/sdd/tools/mkSheet.mjs .superpowers/sdd/tools/out/vm-p1-sheet.png 4 420 <the MKSHEET args>`.
  - Expected: `errors []`.
  - Expected: the LOG shows the kinds `sink`, `film`, `ember`, `rock`, `jet`, `strip`, `frost` and `pool`, with no `timedOut`.
    Any timeout means the state was pinned or skipped. Say which, and say whether that frame is valid. A pinned frost on liquid Hg
    is invisible by design.
  - Expected: `marks after frost+glaze` > 0 and `marks after re-melt + tick` = 0.
  - If the helpers differ from what the script assumes (rig names, `m.melt` / `m.shot`, `mkSheet` arguments), adapt minimally
    and list every deviation.
  - **Look at the sheet yourself before reporting** (Read the PNG; zoom crops are fine). Judge each item pass / fail / can't tell,
    and say what you see:
    - The aim: phase 1's film, ember, rock and gust now land well inside the disc, not at the limb.
    - The dark-mirror case: a film landing near the disc centre is still readable. If it vanishes on black, say so.
    - The sinking rock goes down over ~5 s with a collar, and leaves a shallow pit.
    - The vapour plume streams downwind off the gust dent and fades.
    - Frost creeps out white over ~1.5 s and stays. Note how it reads lit only by the nebula and the nodes (spec R5).
    - The pool shows a liquid mirror disc around the ember, grows, then refreezes into a visibly glassier patch.
    - The heal frame shows the frost and glaze gone after the re-melt.
  - Anything that fails goes to superpowers:systematic-debugging (read the code, probe live state), not constant-twiddling by
    guess. Report the diagnosis and a proposed fix; do not change source files in this task.

- [ ] **Step 3: Regression spot-checks.**
  - Open `/mercury?calm=1` with `openMercury(page, '?calm=1')`.
    - Check: `node .superpowers/sdd/tools/matrixCompile.mjs` is still all ok.
    - Melt, wait for the frozen state as above, and strike water. Check that the frost appears at full size at touchdown with no
      creep, `__mercuryScar` has marks, and there are no console errors.
  - Run the hyper smoke: `NOSHOT=1 node .superpowers/sdd/tools/hyperSmoke.mjs`.
    - Expected: it still fires, gathers and comes home, with no new console errors.

- [ ] **Step 4: Report.** Write the sheet path, the per-item look judgement, the LOG, the calm check and the hyper smoke to your
  report. Do not commit the gitignored tools.

  The controller hands the sheet to the author for the gates:
  - **Look call** (socks/∞), including whether the frost lit by the nebula and the nodes reads, or needs the faint self-glow (R5).
  - **Phone:** still 120 while the sphere is in motion, with marks on the surface.

  Do **not** push.

# Mercury Visitors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tapped element falls from its node onto the Mercury planet and meets the liquid mercury as itself:
- water spreads into a thin interference film, or skates as a Leidenfrost bead on hot Hg
- an ember opens a Marangoni clearing
- a rock floats and bobs
- a gust dents the surface and drives cat's-paws

The screen-space fireworks are deleted.

**Architecture:** The work is split into units:

- **`visitorSim.js`:** plain-array state machine (flight → touchdown → resident → detached → free) plus every physical
  constant and helper.
- **`visitorFrame.js`:** packs live visitors into
  - body uniforms + a screen rect for a new blended impostor pass (`visitorShader.js` via `useVisitorField.js`)
  - up to 4 *surface slots* the planet shader draws as part of the mirror: film optics, hot clearing, rock meniscus,
    jet dent + cat's-paws.

  Touchdowns are drained by `MercuryPlanet.jsx` into the existing impulse ring (new kinds), the scar map, or the calm glow.

**Tech Stack:** React 19 + @react-three/fiber, three r183 RawShaderMaterial (GLSL3), vitest. CDP probe tools live in
`.superpowers/sdd/tools/` and need the dev server on :5175.

**Spec:** `docs/superpowers/specs/2026-10-03-mercury-visitors-design.md` (commit 3544be0e). Branch `feature/mercury-visitors`.

## Global Constraints

- **Phase 3/5 tables stay byte-identical:**
  - `IMPACT_MODE_AMP = { splash: 0.035, ring: 0.015, crater: 0 }`
  - `IMPACT_WAVE_AMP = { splash: 0.35, ring: 0.2, crater: 0 }`
  - `WAVE_DAMP_PER_S` keeps `splash: 1.0, wake: 1.6, ring: 3.0`
  - Do not touch breakup / hyper amplitudes.
- **Idle cost is zero:** with no live visitor, `stepVisitors` and `packVisitors` return before any loop, the body mesh is
  `visible = false`, and `uVisitOn = 0`. The per-frame step and pack paths allocate nothing. A launch may allocate,
  like today's strike drain does.
- **Shader parity:** stripping every `// visitors` line and every `// <visitors>` … `// </visitors>` block from `PLANET_FS`
  must give back the pre-change shader byte for byte.
- **Calm variant:** compiles `VISIT_SLOTS = 0`. Reduced motion means no flight, no skate, no bob, half lifetimes.
- **Surface slots per tier:** full 4, phone 2, lite 1. JS always writes `VISIT_SURF_MAX = 4` slots, strongest first.
- **Lint gate:** `npm run lint` must pass (0 errors, warnings under the `--max-warnings` in package.json). Do not sweep
  `exhaustive-deps`.
- **Commits:** commit per task on `feature/mercury-visitors`. **Never push** (the author gives an explicit push command).
- **Tests:** run with `npx vitest run <path>` from the repo root `F:\scale_9.4`.

## Spec deviations (decided here, each recorded in code comments)

- **D-1 (§5.5):** the body pass is one quad over the visitors' union screen rect, with analytic intersections per kind
  (ellipsoid, convex rock, ray–segment glow). It does not use instanced SDF quads. It **blends** (`NormalBlending`, depth
  write off, `gl_FragDepth` still written for the depth test), because the ember tail, steam and gust shimmer are
  translucent. It has no alpha-to-coverage. Rock faces get 4 rays per pixel instead.
- **D-2 (§5.4 measured decision):** cat's-paws cannot use the impulse `slip`. `slipDirWorld` only blends a ring's
  *centre* between body-carried and world-fixed; it cannot make a ripple anisotropic. The cat's-paws are a surface-slot
  term with an explicit gust direction (`uVisitB`).
- **D-3:** the Marangoni clearing and its outward rim are a surface-slot term. The shader's impulse dimple has a fixed
  `WAVE_DIMPLE_S = 0.12 s` life, too short for a ~6 s clearing. The `marangoni` impulse is only the soft hit ring (dimple
  weight 0).
- **D-4:** boiling Hg counts as liquid for visitors (today `impactKind` sends boiling to `ring`). §4 describes Leidenfrost
  and the exosphere puff on boiling Hg.
- **D-5:** the lite tier gets 1 surface slot; the spec named only full and phone.

## File map

| File | Status | Responsibility |
|------|--------|----------------|
| `src/terminal/mercury/MercuryFireworks.jsx` | delete | — |
| `src/terminal/mercury/fireworksUtils.js` | delete | — |
| `src/terminal/views/MercuryTab.jsx` | modify | drop the fireworks mount and wiring |
| `src/terminal/mercury/MercuryCanvas.jsx` | modify | press → `strikesRef` only |
| `src/terminal/mercury/planet/mercuryWaves.js` | modify | new kinds' damping + `KIND_DIMPLE` table |
| `src/terminal/mercury/planet/mercuryImpacts.js` | modify | `VISITOR_IMPACT` amplitudes |
| `src/terminal/mercury/planet/visitorSim.js` | create | constants, helpers, state machine |
| `src/terminal/mercury/planet/visitorFrame.js` | create | pack bodies + rect + surface slots |
| `src/terminal/mercury/planet/visitorGlsl.js` | create | shared GLSL: blackbody `visPlanck` / `visGlow` |
| `src/terminal/mercury/planet/mercuryPlanetShader.js` | modify | surface slots, `// visitors`-marked |
| `src/terminal/mercury/planet/planetQuality.js` | modify | `visitSlots` per tier |
| `src/terminal/mercury/planet/visitorShader.js` | create | the body impostor |
| `src/terminal/mercury/useVisitorField.js` | create | material, mesh ref, upload |
| `src/terminal/mercury/MercuryPlanet.jsx` | modify | wire sim → impulses / scars / glow / uniforms / pass |
| `src/terminal/mercury/mercuryTuning.js` | modify | dev rig: `strike`, `visitTemp`, `visitTime` |
| `.superpowers/sdd/tools/visitorSheet.mjs` | create | look-sheet capture |
| tests under `src/terminal/mercury/**/__tests__/` | create/modify | per task |

---

### Task 1: Remove the screen-space fireworks

**Files:**
- Delete: `src/terminal/mercury/MercuryFireworks.jsx`, `src/terminal/mercury/fireworksUtils.js`
- Modify: `src/terminal/views/MercuryTab.jsx`, `src/terminal/mercury/MercuryCanvas.jsx`
- Test: `src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js` (append)

**Interfaces:**
- Produces: `MercuryCanvas` no longer takes `onElementFired`. A node press pushes its phase into `strikesRef` (max 8
  queued); `MercuryPlanet` drains it, unchanged.

- [ ] **Step 1: Write the failing test.** Append to `src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js`
  (`tabSrc` and `canvasSrc` are already imported there):

```js
describe('visitors: the screen-space fireworks are gone', () => {
  it('MercuryTab mounts no fireworks and passes no element-fired handler', () => {
    expect(tabSrc).not.toMatch(/MercuryFireworks|fireworksRef|handleElementFired|onElementFired/);
  });
  it('a node press still queues a strike for the planet, and only that', () => {
    expect(canvasSrc).toContain('if (strikesRef.current.length < 8) strikesRef.current.push(phase);');
    expect(canvasSrc).toContain('onElementFired={handleElementFired}');
    expect(canvasSrc).not.toMatch(/onElementFired\?\.\(/);
  });
  it('the fireworks modules are deleted', () => {
    const modules = Object.keys(import.meta.glob('../*.{js,jsx}'));
    expect(modules.some((p) => /ireworks/.test(p))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails.**
  - Run: `npx vitest run src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js`
  - Expected: 3 FAILs in "the screen-space fireworks are gone".

- [ ] **Step 3: Implement.**
  - Delete the two files: `git rm src/terminal/mercury/MercuryFireworks.jsx src/terminal/mercury/fireworksUtils.js`
  - In `MercuryTab.jsx`:
    - Remove the line `import MercuryFireworks from '../mercury/MercuryFireworks';`.
    - Remove these four lines:
      ```js
        const fireworksRef = useRef(null);
        const handleElementFired = useCallback((element, screenX, screenY) => {
          fireworksRef.current?.fire(element, screenX, screenY);
        }, []);
      ```
    - Remove the line `      <MercuryFireworks ref={fireworksRef} />`.
    - Remove the prop line `            onElementFired={handleElementFired}` from `<MercuryCanvas … />`.
    - `useRef` / `useCallback` stay imported (`sealRef`, `revealSeal` and `handleParamsChange` still use them).
  - In `MercuryCanvas.jsx`:
    - Remove `  onElementFired = null,` from the props.
    - Replace the strike callback block with:

```js
  // Element strikes for the planet (MercuryPlanet drains this every frame and launches a visitor per strike).
  // The press fires once per pointerdown; onNodeTap fires on both pointerdown and click.
  const strikesRef = useRef([]);
  const handleElementFired = useCallback((phase) => {
    if (strikesRef.current.length < 8) strikesRef.current.push(phase);
  }, []);
```

- [ ] **Step 4: Run the tests and confirm they pass.**
  - Run: `npx vitest run src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js`
  - Expected: PASS.
  - Run: `npm run lint`
  - Expected: 0 errors.

- [ ] **Step 5: Commit.**

```bash
git add -A src/terminal/mercury/MercuryFireworks.jsx src/terminal/mercury/fireworksUtils.js src/terminal/views/MercuryTab.jsx src/terminal/mercury/MercuryCanvas.jsx src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js
git commit -m "feat(mercury): visitors 1 — remove the screen-space fireworks; a press only queues the strike

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Impulse kinds for the visitors' touchdowns

**Files:**
- Modify: `src/terminal/mercury/planet/mercuryWaves.js` (`WAVE_DAMP_PER_S`, a new `KIND_DIMPLE`, `impulseFrame`)
- Modify: `src/terminal/mercury/planet/mercuryImpacts.js` (a new `VISITOR_IMPACT`)
- Test: `src/terminal/mercury/planet/__tests__/visitorImpulses.test.js` (create)

**Interfaces:**
- Produces:
  - `WAVE_DAMP_PER_S.{dimple, crown, marangoni, jet}`
  - `KIND_DIMPLE: { wake, dimple, crown, marangoni, jet }`; kinds not listed weigh 1
  - `VISITOR_IMPACT: { dimple|crown|marangoni|jet: { mode, wave } }`

- [ ] **Step 1: Write the failing test.** Create `src/terminal/mercury/planet/__tests__/visitorImpulses.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  WAVE_DAMP_PER_S, KIND_DIMPLE, WAKE_DIMPLE_GAIN, createImpulses, addImpulse, createImpulseFrame, impulseFrame,
} from '../mercuryWaves';
import { VISITOR_IMPACT, IMPACT_MODE_AMP, IMPACT_WAVE_AMP } from '../mercuryImpacts';

const KINDS = ['dimple', 'crown', 'marangoni', 'jet'];

describe('visitor impulse kinds', () => {
  it('every visitor kind has a damping rate, a dimple weight and amplitudes', () => {
    for (const k of KINDS) {
      expect(WAVE_DAMP_PER_S[k]).toBeGreaterThan(0);
      expect(KIND_DIMPLE[k]).toBeGreaterThanOrEqual(0);
      expect(VISITOR_IMPACT[k].mode).toBeGreaterThanOrEqual(0);
      expect(VISITOR_IMPACT[k].wave).toBeGreaterThan(0);
    }
  });
  it('leaves the phase-3/5 tables untouched', () => {
    expect(IMPACT_MODE_AMP).toEqual({ splash: 0.035, ring: 0.015, crater: 0 });
    expect(IMPACT_WAVE_AMP).toEqual({ splash: 0.35, ring: 0.2, crater: 0 });
    expect([WAVE_DAMP_PER_S.splash, WAVE_DAMP_PER_S.wake, WAVE_DAMP_PER_S.ring]).toEqual([1.0, 1.6, 3.0]);
    expect(KIND_DIMPLE.wake).toBe(WAKE_DIMPLE_GAIN);
  });
  it('water hits with a third of a splash ripple; earth pushes 1.5x a splash mode', () => {
    expect(VISITOR_IMPACT.dimple.wave).toBeCloseTo(IMPACT_WAVE_AMP.splash / 3, 2);
    expect(VISITOR_IMPACT.crown.mode).toBeCloseTo(1.5 * IMPACT_MODE_AMP.splash, 3);
  });
  it('the Marangoni hit has no snap dimple (its clearing is a surface slot, plan D-3)', () => {
    expect(KIND_DIMPLE.marangoni).toBe(0);
    expect(VISITOR_IMPACT.marangoni.mode).toBe(0);
  });
  it('impulseFrame writes the per-kind dimple weight; splash and wake unchanged', () => {
    const buf = createImpulses();
    const f = createImpulseFrame();
    for (const kind of ['splash', 'wake', 'marangoni', 'crown']) addImpulse(buf, { dirBody: [0, 0, 1], tS: 0, wave: 0.1, kind });
    impulseFrame(buf, 0.1, {}, f);
    [1, WAKE_DIMPLE_GAIN, 0, KIND_DIMPLE.crown].forEach((v, i) => expect(f.dimple[i]).toBeCloseTo(v, 6));
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/visitorImpulses.test.js`
  - Expected: FAIL (`KIND_DIMPLE` and `VISITOR_IMPACT` are undefined).

- [ ] **Step 3: Implement.** In `mercuryWaves.js`:
  - Replace the `WAVE_DAMP_PER_S` line with:

```js
// Visitors (spec 2026-10-03 §5.4): dimple = a water drop (soft, dies fast), crown = a rock's splash, marangoni = an ember's
// soft hit ring (its clearing is a surface slot, plan D-3), jet = a gust's touch (its dent and cat's-paws are a surface slot).
export const WAVE_DAMP_PER_S = { splash: 1.0, wake: 1.6, ring: 3.0, dimple: 1.8, crown: 1.0, marangoni: 0.9, jet: 2.5 };
```

  - Directly after the `WAKE_DIMPLE_GAIN` export, add:

```js
// The snap dimple's weight per impulse kind (impulseFrame → frame.dimple → uImpWave.z). Kinds not listed weigh 1
// (splash, ring, pops). The Marangoni hit has none: the clearing it opens lives far longer than the 0.12 s snap.
export const KIND_DIMPLE = { wake: WAKE_DIMPLE_GAIN, dimple: 0.6, crown: 1.4, marangoni: 0, jet: 1.0 };
```

  - In `impulseFrame`, replace `out.dimple[i] = s.kind === 'wake' ? WAKE_DIMPLE_GAIN : 1;` with:

```js
    out.dimple[i] = KIND_DIMPLE[s.kind] ?? 1;
```

  - In `mercuryImpacts.js`, after the `IMPACT_WAVE_AMP` line, add:

```js
// The visitors' touchdowns (visitors spec §4): only the HIT. Everything that lasts (film, clearing, meniscus, dent)
// is a surface slot (visitorFrame → the planet shader). Water is 13.5x lighter than Hg: a third of a splash's ripple.
// A rock lands heavy: 1.5x a splash's mode push.
export const VISITOR_IMPACT = Object.freeze({
  dimple: Object.freeze({ mode: 0.008, wave: 0.12 }),
  crown: Object.freeze({ mode: 0.0525, wave: 0.45 }),
  marangoni: Object.freeze({ mode: 0, wave: 0.1 }),
  jet: Object.freeze({ mode: 0.006, wave: 0.06 }),
});
```

- [ ] **Step 4: Run the tests and confirm they pass.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/visitorImpulses.test.js src/terminal/mercury/planet/__tests__/mercuryWaves.test.js src/terminal/mercury/planet/__tests__/mercuryImpacts.test.js`
  - Expected: all PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/terminal/mercury/planet/mercuryWaves.js src/terminal/mercury/planet/mercuryImpacts.js src/terminal/mercury/planet/__tests__/visitorImpulses.test.js
git commit -m "feat(mercury): visitors 2 — impulse kinds dimple / crown / marangoni / jet; phase-3/5 tables untouched

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `visitorSim` core: constants, pool, launch, the fall, touchdown

**Files:**
- Create: `src/terminal/mercury/planet/visitorSim.js`
- Test: `src/terminal/mercury/planet/__tests__/visitorSim.test.js` (create)
- Test helper: `src/terminal/mercury/planet/__tests__/visitorTestKit.js` (create; Tasks 4–5 import it, like
  `breakupTestKit.js`)

**Interfaces:**
- Consumes:
  - `strikeDirWorld(nodePos, camPos, out)` and `localTempK(d, sun, tssK, heatK)` from `mercuryImpacts`
  - `qRotate(q, v, out)` / `qRotateInv(q, v, out)` from `breakupFamily`; `q` is `[x, y, z, w]`, body → world
  - `SUN_DIR_WORLD`, `R_SCENE`, `LIQUID_TAU`, `HG_MELT_K`
- Produces (later tasks rely on these exact names):
  - `createVisitors() → { v: Visitor[8], live, seq }`
  - `createVisitorCtx() → { tS, dt, calm, tau, heatK, subsolarT, tempOverrideK, detach, q[4], omega[3], cam[3], nodePos[3], coreR }`
  - `createVisitorOut() → { nImpacts, impacts: { kind, impulse, phase, dirBody[3], dirWorld[3], seed, tempK }[8] }`
  - `launchVisitor(buf, phase, ctx) → Visitor | null`
  - `stepVisitors(buf, ctx, out) → out`
  - `pickVisitorSlot(buf, phase) → index`
  - `flightPoint(v, s, out)`, `flightVelocity(v, s, T, out)`
  - `impactBranch(phase, tau, tempK) → 'crater'|'ring'|'film'|'bead'|'ember'|'rock'|'jet'`
  - Visitor fields: `live, state ('free'|'flight'|'resident'|'detached'), phase, kind, seed, t0, tImpact, tDetach, fade,
    fade0, start[3], end[3], pos[3], vel[3], bow[3], dirBody[3], dirWorld[3], tan[3], r, spin, tempK, rng`
  - All constants listed in Step 3.

- [ ] **Step 1: Write the failing test.** First create the helper
  `src/terminal/mercury/planet/__tests__/visitorTestKit.js`:

```js
// Shared by the visitor tests: a ctx at a node, and a fixed-step run that collects touchdowns.
import { createVisitorCtx, stepVisitors } from '../visitorSim';
import { ORBIT_NODES, nodeWorldPosition } from '../../orbitNodes';

export function ctxFor(phase, tempK = 400) {
  const ctx = createVisitorCtx();
  ctx.cam = [0, 0, 3.6]; ctx.tau = 1; ctx.dt = 1 / 60; ctx.tempOverrideK = tempK;
  const node = ORBIT_NODES.find((n) => n.phase === phase);
  const p = nodeWorldPosition(node.angle, 0);
  ctx.nodePos = [p[0], p[1], p[2]];
  return ctx;
}

export function runTo(buf, ctx, out, untilS) {
  const events = [];
  while (ctx.tS < untilS - 1e-9) {
    ctx.tS += ctx.dt;
    stepVisitors(buf, ctx, out);
    for (let i = 0; i < out.nImpacts; i++) {
      const e = out.impacts[i];
      events.push({ ...e, dirBody: [...e.dirBody], dirWorld: [...e.dirWorld], at: ctx.tS });
    }
  }
  return events;
}
```

  Then create `src/terminal/mercury/planet/__tests__/visitorSim.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  createVisitors, createVisitorOut, launchVisitor, stepVisitors, pickVisitorSlot, flightPoint,
  impactBranch, VISITOR_SLOTS, MAX_PER_ELEMENT, T_FLIGHT, LEIDENFROST_K,
} from '../visitorSim';
import { strikeDirWorld } from '../mercuryImpacts';
import { R_SCENE } from '../planetLook';
import { HG_MELT_K } from '../mercuryThermal';
import { LIQUID_TAU } from '../mercuryWaves';
import { ctxFor, runTo } from './visitorTestKit';

const len = (v) => Math.hypot(v[0], v[1], v[2]);

describe('visitorSim — launch and the fall', () => {
  it('a launch starts at the node, in flight', () => {
    const buf = createVisitors();
    const ctx = ctxFor('fluid');
    const v = launchVisitor(buf, 'fluid', ctx);
    expect(v.state).toBe('flight');
    expect(buf.live).toBe(1);
    expect(v.pos).toEqual(ctx.nodePos);
  });
  it('an unknown phase launches nothing', () => {
    expect(launchVisitor(createVisitors(), 'aether', ctxFor('fluid'))).toBeNull();
  });
  it('touches down exactly at T_FLIGHT, on the strike point (40 deg off the node, toward the viewer)', () => {
    for (const phase of Object.keys(T_FLIGHT)) {
      const buf = createVisitors();
      const ctx = ctxFor(phase);
      launchVisitor(buf, phase, ctx);
      const ev = runTo(buf, ctx, createVisitorOut(), 2);
      expect(ev).toHaveLength(1);
      expect(ev[0].at).toBeGreaterThanOrEqual(T_FLIGHT[phase] - 1e-9);
      expect(ev[0].at).toBeLessThanOrEqual(T_FLIGHT[phase] + ctx.dt + 1e-9);
      const want = strikeDirWorld(ctx.nodePos, ctx.cam);
      for (let k = 0; k < 3; k++) expect(ev[0].dirWorld[k]).toBeCloseTo(want[k], 9);
    }
  });
  it('the fall never enters the planet before touchdown, and accelerates', () => {
    const buf = createVisitors();
    const ctx = ctxFor('earth');
    const v = launchVisitor(buf, 'earth', ctx);
    const p = [0, 0, 0], q = [0, 0, 0];
    for (let s = 0.02; s < 0.999; s += 0.02) expect(len(flightPoint(v, s, p))).toBeGreaterThan(R_SCENE);
    const step = (s) => { flightPoint(v, s, p); flightPoint(v, s + 0.05, q); return Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]); };
    expect(step(0.85)).toBeGreaterThan(step(0.15));
  });
  it('reduced motion: no fall, touchdown on the first step', () => {
    const buf = createVisitors();
    const ctx = ctxFor('fluid');
    ctx.calm = true;
    launchVisitor(buf, 'fluid', ctx);
    const out = createVisitorOut();
    ctx.tS += ctx.dt;
    stepVisitors(buf, ctx, out);
    expect(out.nImpacts).toBe(1);
  });
});

describe('visitorSim — what the touchdown is', () => {
  it('branches on crust, frozen Hg, then the element (water by its Leidenfrost point)', () => {
    expect(impactBranch('fluid', LIQUID_TAU - 0.01, 400)).toBe('crater');
    expect(impactBranch('earth', 1, HG_MELT_K - 1)).toBe('ring');
    expect(impactBranch('fluid', 1, LEIDENFROST_K - 1)).toBe('film');
    expect(impactBranch('fluid', 1, LEIDENFROST_K)).toBe('bead');
    expect(impactBranch('fluid', 1, 700)).toBe('bead');      // boiling Hg is liquid for visitors (plan D-4)
    expect(impactBranch('thermal', 1, 400)).toBe('ember');
    expect(impactBranch('earth', 1, 400)).toBe('rock');
    expect(impactBranch('air', 1, 400)).toBe('jet');
  });
  it('a crater or a frozen ring leaves nothing behind', () => {
    const buf = createVisitors();
    const ctx = ctxFor('earth');
    ctx.tau = 0;
    launchVisitor(buf, 'earth', ctx);
    const ev = runTo(buf, ctx, createVisitorOut(), 1);
    expect(ev[0].kind).toBe('crater');
    expect(ev[0].impulse).toBe('');
    expect(buf.live).toBe(0);
  });
  it('the touchdown reports the impulse, the phase, the seed and the temperature', () => {
    const buf = createVisitors();
    const ctx = ctxFor('thermal', 650);
    launchVisitor(buf, 'thermal', ctx);
    const [e] = runTo(buf, ctx, createVisitorOut(), 1);
    expect(e).toMatchObject({ kind: 'ember', impulse: 'marangoni', phase: 'thermal', tempK: 650 });
    expect(e.seed).toBeGreaterThan(0);
  });
});

describe('visitorSim — the pool', () => {
  it('holds at most MAX_PER_ELEMENT of one element: the oldest of that element gives way', () => {
    const buf = createVisitors();
    const ctx = ctxFor('fluid');
    const first = launchVisitor(buf, 'fluid', ctx);
    for (let i = 1; i < MAX_PER_ELEMENT; i++) { ctx.tS += 0.01; launchVisitor(buf, 'fluid', ctx); }
    ctx.tS += 0.01;
    const idx = pickVisitorSlot(buf, 'fluid');
    expect(buf.v[idx]).toBe(first);
    launchVisitor(buf, 'fluid', ctx);
    expect(buf.v.filter((v) => v.live && v.phase === 'fluid')).toHaveLength(MAX_PER_ELEMENT);
  });
  it('a full pool gives way oldest first', () => {
    const buf = createVisitors();
    const phases = ['fluid', 'thermal', 'earth', 'air'];
    const ctx = ctxFor('fluid');
    for (let i = 0; i < VISITOR_SLOTS; i++) { ctx.tS = i * 0.01; launchVisitor(buf, phases[i % 4], ctx); }
    expect(buf.live).toBe(VISITOR_SLOTS);
    const oldest = buf.v.reduce((a, b) => (b.t0 < a.t0 ? b : a));
    expect(buf.v[pickVisitorSlot(buf, 'earth')]).toBe(oldest);
  });
  it('idle: stepVisitors with nothing live does nothing', () => {
    const buf = createVisitors();
    const out = createVisitorOut();
    out.nImpacts = 5;
    const ctx = ctxFor('fluid');
    expect(stepVisitors(buf, ctx, out)).toBe(out);
    expect(out.nImpacts).toBe(0);
    expect(buf.v.every((v) => v.state === 'free')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/visitorSim.test.js`
  - Expected: FAIL (module not found).

- [ ] **Step 3: Implement.** Create `src/terminal/mercury/planet/visitorSim.js`:

```js
// src/terminal/mercury/planet/visitorSim.js — the visitors (spec docs/superpowers/specs/2026-10-03-mercury-visitors-design.md).
//
// A tapped element falls from its node onto the planet and meets the mercury as itself:
//   water spreads into a thin film (S = γHg − γw − γHg/w ≈ +38 mN/m: it WETS Hg), or above its Leidenfrost
//     point skates as a bead on its own vapour;
//   an ember opens a Marangoni clearing (tension falls with heat, so the surface flows away from the hot spot);
//   a rock floats (ρ ≈ 2.7 against Hg's 13.5);
//   a gust dents the surface and drives cat's-paws downwind.
// Plain arrays; this module's own maths uses no three.js (mercuryImpacts, which it borrows two pure functions
// from, imports three for its quaternion helpers). MercuryPlanet owns GL: it writes a ctx every frame and drains
// out.impacts into the impulse ring, the scar map and the calm glow. Allocates nothing per frame.

import { R_SCENE } from './planetLook';
import { SUN_DIR_WORLD } from './planetFrame';
import { qRotate, qRotateInv } from './breakupFamily';
import { strikeDirWorld, localTempK } from './mercuryImpacts';
import { LIQUID_TAU } from './mercuryWaves';
import { HG_MELT_K } from './mercuryThermal';

export const VISITOR_SLOTS = 8;
export const MAX_PER_ELEMENT = 4;
export const T_FLIGHT = Object.freeze({ fluid: 0.75, thermal: 0.6, earth: 0.85, air: 0.65 });
export const FLIGHT_BOW = 0.35;            // mid-flight bow toward the camera, × R_SCENE: the fall never grazes the limb
export const LEIDENFROST_K = 470;          // water meeting a hotter surface never wets it
export const DETACH_OMEGA = 6;             // rad/s: a release this fast flings the residents off (every hyper pins 12)
export const DETACH_FADE_S = 0.6;
export const FADE_S = 1;                   // every resident fades over its last second
export const CALM_LIFE = 0.5;              // reduced motion: residents stay half as long

// How long each touchdown stays, s (0 = nothing stays), and the impulse it sends into the ring (mercuryWaves kinds).
export const RESIDENT_LIFE_S = Object.freeze({ film: 8, bead: 6, ember: 6, rock: 12, jet: 1.5, ring: 0, crater: 0 });
export const IMPULSE_FOR = Object.freeze({ film: 'dimple', bead: 'dimple', ember: 'marangoni', rock: 'crown', jet: 'jet', ring: 'ring', crater: '' });

// Bodies, scene units (R_SCENE = 0.75).
export const DROP_R = 0.028;
export const DROP_STRETCH_K = 0.08;        // a falling drop stretches this much per unit/s…
export const DROP_STRETCH_MAX = 0.6;       // …to an aspect of 1.6 at most
export const BEAD_R = 0.03;
export const BEAD_OBLATE = -0.15;          // a Leidenfrost bead sits a little squashed
export const BEAD_SHRINK = 0.6;            // and evaporates to 40 % of its radius
export const BEAD_GAP = 0.004;             // the vapour cushion under it
export const SKATE_V0 = 0.25;              // rad/s along the surface at touchdown
export const SKATE_KICK = 0.9;             // rad/s² random kicks (vapour jets venting unevenly)
export const SKATE_DAMP = 0.35;            // 1/s
export const EMBER_R = 0.018;
export const EMBER_BODY_S = 3;             // the ember itself is gone by now; its hot spot lingers
export const EMBER_T_LAUNCH_K = 1300;
export const HOT_T0_K = 1000;              // the ember and its spot at touchdown
export const HOT_COOL_K_PER_S = 80;
export const EMBER_TAIL_S = 0.08;          // the comet tail is this much of the path behind it
export const EMBER_HALO = 1.6;             // the tail's glow half-width, × EMBER_R
export const ROCK_R = 0.035;
export const ROCK_BOUND = 1.15;            // a rock is its cut planes ∩ a sphere this × r: always bounded
export const ROCK_SUBMERGED = 0.2;         // it floats ~20 % under
export const ROCK_BOB_AMP = 0.5;           // × ROCK_R: it plunges, then pops back up
export const ROCK_BOB_T = 1.2;
export const ROCK_BOB_EFOLD = 2;
export const ROCK_SPIN0 = 6;               // rad/s tumble in flight, dying on the surface
export const ROCK_SPIN_EFOLD = 1.5;
export const ROCK_SINK_S = 1;
export const GUST_TRAIL_S = 0.12;          // the gust's shimmer is this much of its path
export const GUST_W = 0.012;
export const EXO_PUFF = 0.15;              // an ember on boiling Hg lifts this much exosphere coverage…
export const EXO_PUFF_S = 1.5;             // …decaying over this

// Surface slots (visitorFrame → the planet shader): what an element leaves IN the liquid.
export const VISIT_SURF_MAX = 4;
export const SURF_FILM = 1, SURF_HOT = 2, SURF_MENISCUS = 3, SURF_JET = 4;
export const FILM_R0 = 0.02;               // rad
export const FILM_GROW = 0.05;             // rad/√s: a spreading film's radius grows as √t
export const FILM_H0_NM = 1000;            // thickness at touchdown…
export const FILM_H1_NM = 80;              // …and at the end of its life
export const FILM_N = 1.33;
export const FILM_A = 0.35;                // interference contrast over the mirror
export const FILM_TEAR_NM = 200;           // thinner than this, the film tears into lenses
export const FILM_NOISE_FREQ = 60;
export const CLEAR_R_MAX = 0.09;           // rad
export const CLEAR_TAU_S = 1.2;
export const CLEAR_DEPTH = 0.004;          // fraction of R
export const CLEAR_DECAY_S = 2.5;
export const HOT_GAIN = 0.8;
export const MENISCUS_RING_DEPTH = 0.003;
export const JET_R = 0.06;
export const JET_DEPTH = 0.006;
export const CATSPAW_K = 140;
export const CATSPAW_AMP = 0.05;
export const CATSPAW_SPEED = 9;

// Light (visitorGlsl mirrors these exactly).
export const PLANCK_C2_NM_K = 1.4388e7;
export const PLANCK_REF_K = 1300;
export const GLOW_EXPO = 2000;
export const EMBER_GAIN = 3;

const LAMBDA_NM = [650, 532, 450];
const PLANCK_REF = Math.exp(PLANCK_C2_NM_K / (650 * PLANCK_REF_K)) - 1;

// Blackbody spectral radiance at 650 / 532 / 450 nm, red = 1 at PLANCK_REF_K. The exponent is clamped at 80
// so a cool spot underflows to 0 instead of overflowing a GPU float.
export function planckRGB(tK, out = [0, 0, 0]) {
  for (let k = 0; k < 3; k++) {
    const x = Math.min(PLANCK_C2_NM_K / (LAMBDA_NM[k] * Math.max(tK, 1)), 80);
    out[k] = ((650 / LAMBDA_NM[k]) ** 5 / (Math.exp(x) - 1)) * PLANCK_REF;
  }
  return out;
}

// The hue of a blackbody at tK with its brightness saturated (1 − e^(−red·GLOW_EXPO)): 900 K reads dull red,
// 700 K is black, 1300 K is full.
export function glowRGB(tK, out = [0, 0, 0]) {
  planckRGB(tK, out);
  const r = Math.max(out[0], 1e-12), g = 1 - Math.exp(-out[0] * GLOW_EXPO);
  out[0] = (out[0] / r) * g; out[1] = (out[1] / r) * g; out[2] = (out[2] / r) * g;
  return out;
}

const smooth01 = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
export const filmRadius = (a) => FILM_R0 + FILM_GROW * Math.sqrt(Math.max(a, 0));
export const filmThicknessNm = (a) => FILM_H0_NM * (FILM_H1_NM / FILM_H0_NM) ** Math.min(1, Math.max(0, a / RESIDENT_LIFE_S.film));
export const clearRadius = (a) => CLEAR_R_MAX * (1 - Math.exp(-Math.max(a, 0) / CLEAR_TAU_S));
export const clearDepth = (a) => CLEAR_DEPTH * Math.exp(-Math.max(a, 0) / CLEAR_DECAY_S);
export const hotTempK = (a) => Math.max(0, HOT_T0_K - HOT_COOL_K_PER_S * Math.max(a, 0));
export const emberFlightTempK = (s) => EMBER_T_LAUNCH_K + (HOT_T0_K - EMBER_T_LAUNCH_K) * Math.min(1, Math.max(0, s));
export const jetEnvelope = (a) => (a > 0 && a < RESIDENT_LIFE_S.jet ? Math.sin((Math.PI * a) / RESIDENT_LIFE_S.jet) : 0);
export const rockBob = (a) => -ROCK_R * ROCK_BOB_AMP * Math.exp(-a / ROCK_BOB_EFOLD) * Math.cos((2 * Math.PI * a) / ROCK_BOB_T);
export const fadeAt = (a, life) => (life > 0 ? 1 - smooth01((a - (life - FADE_S)) / FADE_S) : 0);

export function impactBranch(phase, tau, tempK) {
  if (tau < LIQUID_TAU) return 'crater';
  if (tempK < HG_MELT_K) return 'ring';
  if (phase === 'fluid') return tempK >= LEIDENFROST_K ? 'bead' : 'film';
  if (phase === 'thermal') return 'ember';
  if (phase === 'earth') return 'rock';
  return 'jet';
}

const FLIGHT_R = { fluid: DROP_R, thermal: EMBER_R, earth: ROCK_R, air: GUST_W };

function blank() {
  return {
    live: false, state: 'free', phase: 'fluid', kind: '', seed: 0, t0: 0, tImpact: 0, tDetach: 0, fade: 1, fade0: 1,
    start: [0, 0, 0], end: [0, 0, 0], pos: [0, 0, 0], vel: [0, 0, 0], bow: [0, 0, 0],
    dirBody: [0, 0, 1], dirWorld: [0, 0, 1], tan: [0, 0, 0], r: 0, spin: 0, tempK: 0, rng: 1,
  };
}

export function createVisitors() {
  return { v: Array.from({ length: VISITOR_SLOTS }, blank), live: 0, seq: 0 };
}

export function createVisitorCtx() {
  return {
    tS: 0, dt: 0, calm: false, tau: 0, heatK: 0, subsolarT: 0, tempOverrideK: null, detach: false,
    q: [0, 0, 0, 1], omega: [0, 0, 0], cam: [0, 0, 1], nodePos: [0, 0, 0], coreR: R_SCENE,
  };
}

export function createVisitorOut() {
  return {
    nImpacts: 0,
    impacts: Array.from({ length: VISITOR_SLOTS }, () => ({ kind: '', impulse: '', phase: '', dirBody: [0, 0, 1], dirWorld: [0, 0, 1], seed: 0, tempK: 0 })),
  };
}

// mulberry32 on the visitor's own state: a skate is reproducible per seed.
function rand(v) {
  v.rng = (v.rng + 0x6d2b79f5) >>> 0;
  let t = v.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const _t = [0, 0, 0];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function normInto(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; v[0] /= l; v[1] /= l; v[2] /= l; return v; }
// out = vec minus its component along unit d (in place safe)
function tangentInto(vec, d, out) {
  const k = dot3(vec, d);
  out[0] = vec[0] - d[0] * k; out[1] = vec[1] - d[1] * k; out[2] = vec[2] - d[2] * k;
  return out;
}

// A free slot first; else, once an element holds MAX_PER_ELEMENT, its oldest; else the oldest overall.
export function pickVisitorSlot(buf, phase) {
  let same = 0, oldestSame = -1, oldest = -1;
  for (let i = 0; i < VISITOR_SLOTS; i++) {
    const v = buf.v[i];
    if (!v.live) continue;
    if (oldest < 0 || v.t0 < buf.v[oldest].t0) oldest = i;
    if (v.phase === phase) {
      same++;
      if (oldestSame < 0 || v.t0 < buf.v[oldestSame].t0) oldestSame = i;
    }
  }
  if (same >= MAX_PER_ELEMENT) return oldestSame;
  for (let i = 0; i < VISITOR_SLOTS; i++) if (!buf.v[i].live) return i;
  return oldest;
}

// Where the fall lands (world): today's strike point, 40° off the launch node toward the viewer (aimed once at launch:
// strikeDirWorld allocates), at the live core radius (it changes during a hyper-fling, so every frame).
function landing(v, ctx) {
  v.end[0] = v.dirWorld[0] * ctx.coreR; v.end[1] = v.dirWorld[1] * ctx.coreR; v.end[2] = v.dirWorld[2] * ctx.coreR;
}

export function launchVisitor(buf, phase, ctx) {
  if (!Object.hasOwn(T_FLIGHT, phase)) return null;
  const v = buf.v[pickVisitorSlot(buf, phase)];
  if (!v.live) buf.live++;
  buf.seq = (buf.seq + 1) | 0;
  v.live = true; v.state = 'flight'; v.phase = phase; v.kind = '';
  v.t0 = ctx.tS; v.tImpact = 0; v.tDetach = 0; v.fade = 1; v.fade0 = 1;
  v.seed = Math.imul(buf.seq, 2654435761) >>> 0 || 1;
  v.rng = v.seed;
  v.r = FLIGHT_R[phase]; v.spin = 0; v.tempK = phase === 'thermal' ? EMBER_T_LAUNCH_K : 0;
  for (let k = 0; k < 3; k++) { v.start[k] = ctx.nodePos[k]; v.pos[k] = ctx.nodePos[k]; v.vel[k] = 0; v.tan[k] = 0; }
  const cl = Math.hypot(ctx.cam[0], ctx.cam[1], ctx.cam[2]) || 1;
  for (let k = 0; k < 3; k++) v.bow[k] = (ctx.cam[k] / cl) * FLIGHT_BOW * R_SCENE;
  strikeDirWorld(v.start, ctx.cam, v.dirWorld);
  landing(v, ctx);
  return v;
}

// The fall: eased in s² (it accelerates into the planet) along the chord, bowed toward the camera by 4s(1−s).
// Parametric, so touchdown is exactly `end` at s = 1.
export function flightPoint(v, s, out) {
  const e = s * s, b = 4 * s * (1 - s);
  for (let k = 0; k < 3; k++) out[k] = v.start[k] + (v.end[k] - v.start[k]) * e + v.bow[k] * b;
  return out;
}

export function flightVelocity(v, s, T, out) {
  const de = 2 * s, db = 4 - 8 * s;
  for (let k = 0; k < 3; k++) out[k] = ((v.end[k] - v.start[k]) * de + v.bow[k] * db) / T;
  return out;
}

const residentLife = (v, ctx) => RESIDENT_LIFE_S[v.kind] * (ctx.calm ? CALM_LIFE : 1);

function stepFlight(v, ctx, out) {
  const T = T_FLIGHT[v.phase];
  const s = ctx.calm ? 1 : Math.min(1, (ctx.tS - v.t0) / T);
  landing(v, ctx);
  flightPoint(v, s, v.pos);
  flightVelocity(v, s, T, v.vel);
  if (v.phase === 'thermal') v.tempK = emberFlightTempK(s);
  if (v.phase === 'earth' && !ctx.calm) v.spin += ROCK_SPIN0 * ctx.dt;
  if (s >= 1) touchdown(v, ctx, out);
}

function touchdown(v, ctx, out) {
  const tempK = ctx.tempOverrideK ?? localTempK(v.dirWorld, SUN_DIR_WORLD, ctx.subsolarT, ctx.heatK);
  const kind = impactBranch(v.phase, ctx.tau, tempK);
  qRotateInv(ctx.q, v.dirWorld, v.dirBody);
  if (out.nImpacts < out.impacts.length) {
    const ev = out.impacts[out.nImpacts++];
    ev.kind = kind; ev.impulse = IMPULSE_FOR[kind]; ev.phase = v.phase; ev.seed = v.seed; ev.tempK = tempK;
    for (let k = 0; k < 3; k++) { ev.dirBody[k] = v.dirBody[k]; ev.dirWorld[k] = v.dirWorld[k]; }
  }
  v.kind = kind;
  v.tImpact = ctx.tS;
  if (!(RESIDENT_LIFE_S[kind] > 0)) { v.state = 'free'; return; }
  v.state = 'resident';
  // the arrival's sideways motion, carried into the body frame: a bead skates on along it, a gust blows along it
  tangentInto(v.vel, v.dirWorld, _t);
  qRotateInv(ctx.q, _t, v.tan);
  const tl = Math.hypot(v.tan[0], v.tan[1], v.tan[2]);
  const want = kind === 'bead' ? (ctx.calm ? 0 : SKATE_V0) : kind === 'jet' ? 1 : 0;
  for (let k = 0; k < 3; k++) v.tan[k] = tl > 1e-9 ? (v.tan[k] / tl) * want : 0;
  v.r = kind === 'bead' ? BEAD_R : kind === 'rock' ? ROCK_R : kind === 'ember' ? EMBER_R : 0;
  stepResident(v, ctx);
}

export function residentHeight(v, a, life, calm) {
  if (v.kind === 'bead') return 0.95 * v.r + BEAD_GAP;
  if (v.kind === 'ember') return 0.4 * v.r;
  if (v.kind === 'rock') {
    const sink = 2 * ROCK_R * smooth01((a - (life - ROCK_SINK_S)) / ROCK_SINK_S);
    return ROCK_R * (1 - 2 * ROCK_SUBMERGED) + (calm ? 0 : rockBob(a)) - sink;
  }
  return 0;
}

// A Leidenfrost bead on its vapour: random kicks, damped, along the surface (body frame, so it rides the spin).
function skate(v, dt) {
  const d = v.dirBody, t = v.tan;
  for (let k = 0; k < 3; k++) t[k] += (2 * rand(v) - 1) * SKATE_KICK * dt;
  tangentInto(t, d, t);
  const damp = Math.exp(-SKATE_DAMP * dt);
  for (let k = 0; k < 3; k++) { t[k] *= damp; d[k] += t[k] * dt; }
  normInto(d);
  tangentInto(t, d, t);
}

function stepResident(v, ctx) {
  const a = ctx.tS - v.tImpact, life = residentLife(v, ctx);
  if (a >= life) { v.state = 'free'; return; }
  v.fade = fadeAt(a, life);
  if (v.kind === 'bead') {
    if (!ctx.calm) skate(v, ctx.dt);
    v.r = BEAD_R * (1 - (BEAD_SHRINK * a) / life);
  } else if (v.kind === 'rock' && !ctx.calm) {
    v.spin += ROCK_SPIN0 * Math.exp(-a / ROCK_SPIN_EFOLD) * ctx.dt;
  } else if (v.kind === 'ember') {
    v.tempK = hotTempK(a);
  }
  qRotate(ctx.q, v.dirBody, v.dirWorld);
  const h = ctx.coreR + residentHeight(v, a, life, ctx.calm);
  for (let k = 0; k < 3; k++) v.pos[k] = v.dirWorld[k] * h;
}

// A hard release: everything on the surface leaves with the surface's own velocity ω × r, and fades.
function detachVisitor(v, ctx) {
  const w = ctx.omega, p = v.pos;
  v.state = 'detached';
  v.tDetach = ctx.tS;
  v.fade0 = v.fade;
  v.vel[0] = w[1] * p[2] - w[2] * p[1];
  v.vel[1] = w[2] * p[0] - w[0] * p[2];
  v.vel[2] = w[0] * p[1] - w[1] * p[0];
}

function stepDetached(v, ctx) {
  const a = ctx.tS - v.tDetach;
  if (a >= DETACH_FADE_S) { v.state = 'free'; return; }
  for (let k = 0; k < 3; k++) v.pos[k] += v.vel[k] * ctx.dt;
  v.fade = v.fade0 * (1 - a / DETACH_FADE_S);
}

export function stepVisitors(buf, ctx, out) {
  out.nImpacts = 0;
  if (buf.live === 0) return out;
  for (let i = 0; i < VISITOR_SLOTS; i++) {
    const v = buf.v[i];
    if (!v.live) continue;
    if (v.state === 'flight') stepFlight(v, ctx, out);
    else if (v.state === 'resident') {
      if (ctx.detach) detachVisitor(v, ctx);
      else stepResident(v, ctx);
    }
    if (v.state === 'detached') stepDetached(v, ctx);
    if (v.state === 'free') { v.live = false; buf.live--; }
  }
  return out;
}
```

- [ ] **Step 4: Run the test and confirm it passes.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/visitorSim.test.js`
  - Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/terminal/mercury/planet/visitorSim.js src/terminal/mercury/planet/__tests__/visitorSim.test.js src/terminal/mercury/planet/__tests__/visitorTestKit.js
git commit -m "feat(mercury): visitors 3 — visitorSim: pool, the parametric fall, touchdown branches

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `visitorSim` residents: lifetimes, skate, bob, ember, detach, reduced motion, light

Task 3 already wrote the code. This task pins its behaviour with tests and fixes anything they expose.

**Files:**
- Test: `src/terminal/mercury/planet/__tests__/visitorResidents.test.js` (create)
- Modify (only if a test exposes a defect): `src/terminal/mercury/planet/visitorSim.js`

**Interfaces:**
- Consumes: everything Task 3 produced; `ctxFor` / `runTo` from `visitorTestKit.js`.

- [ ] **Step 1: Write the tests.** Create `src/terminal/mercury/planet/__tests__/visitorResidents.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  createVisitors, createVisitorOut, launchVisitor, stepVisitors, residentHeight, filmRadius, filmThicknessNm,
  hotTempK, jetEnvelope, planckRGB, glowRGB, fadeAt, T_FLIGHT, RESIDENT_LIFE_S, BEAD_R, BEAD_SHRINK, ROCK_R,
  ROCK_SUBMERGED, ROCK_BOB_T, DETACH_FADE_S, CALM_LIFE, FILM_H0_NM, FILM_H1_NM, HOT_T0_K, FADE_S,
} from '../visitorSim';
import { ctxFor, runTo } from './visitorTestKit';

const angle = (a, b) => Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
const landed = (phase, tempK, extra = 0) => {
  const buf = createVisitors();
  const ctx = ctxFor(phase, tempK);
  const v = launchVisitor(buf, phase, ctx);
  runTo(buf, ctx, createVisitorOut(), T_FLIGHT[phase] + ctx.dt + extra);
  return { buf, ctx, v };
};

describe('residents live, then fade, then free their slot', () => {
  it('each kind lives its RESIDENT_LIFE_S after touchdown', () => {
    for (const [phase, temp, kind] of [['fluid', 400, 'film'], ['fluid', 600, 'bead'], ['thermal', 400, 'ember'], ['earth', 400, 'rock'], ['air', 400, 'jet']]) {
      const { buf, ctx, v } = landed(phase, temp);
      expect(v.kind).toBe(kind);
      runTo(buf, ctx, createVisitorOut(), ctx.tS + RESIDENT_LIFE_S[kind] - 0.1);
      expect(v.live).toBe(true);
      runTo(buf, ctx, createVisitorOut(), ctx.tS + 0.2);
      expect(v.live).toBe(false);
      expect(buf.live).toBe(0);
    }
  });
  it('fade is 1 until the last second, then smoothly 0', () => {
    expect(fadeAt(0, 8)).toBe(1);
    expect(fadeAt(8 - FADE_S - 0.01, 8)).toBe(1);
    expect(fadeAt(8 - FADE_S / 2, 8)).toBeCloseTo(0.5, 6);
    expect(fadeAt(8, 8)).toBe(0);
  });
});

describe('water', () => {
  it('a film spreads as sqrt(t) and thins from 1 um to 80 nm', () => {
    expect(filmRadius(4) - filmRadius(0)).toBeCloseTo(2 * (filmRadius(1) - filmRadius(0)), 9);
    expect(filmThicknessNm(0)).toBe(FILM_H0_NM);
    expect(filmThicknessNm(RESIDENT_LIFE_S.film)).toBeCloseTo(FILM_H1_NM, 6);
    expect(filmThicknessNm(4)).toBeLessThan(filmThicknessNm(2));
  });
  it('a Leidenfrost bead skates along the surface, shrinking, and hovers on its gap', () => {
    const { buf, ctx, v } = landed('fluid', 600);
    const d0 = [...v.dirBody];
    runTo(buf, ctx, createVisitorOut(), ctx.tS + 3);
    expect(angle(d0, v.dirBody)).toBeGreaterThan(0.05);
    expect(v.r).toBeLessThan(BEAD_R);
    expect(v.r).toBeGreaterThan(BEAD_R * (1 - BEAD_SHRINK));
    expect(Math.hypot(...v.pos)).toBeGreaterThan(ctx.coreR + v.r * 0.9);
  });
  it('the skate is reproducible per seed', () => {
    const a = landed('fluid', 600, 2), b = landed('fluid', 600, 2);
    expect(a.v.dirBody).toEqual(b.v.dirBody);
  });
});

describe('earth, fire, air', () => {
  it('a rock plunges, pops up past its float line, and sinks at the end', () => {
    const rest = ROCK_R * (1 - 2 * ROCK_SUBMERGED);
    const rock = { kind: 'rock', r: ROCK_R };
    expect(residentHeight(rock, 0, 12, false)).toBeLessThan(rest);
    expect(residentHeight(rock, ROCK_BOB_T / 2, 12, false)).toBeGreaterThan(rest);
    expect(residentHeight(rock, 11.99, 12, false)).toBeLessThan(rest - ROCK_R);
    expect(residentHeight(rock, 0, 12, true)).toBeCloseTo(rest, 12);
  });
  it('the ember spot cools linearly from its touchdown temperature', () => {
    expect(hotTempK(0)).toBe(HOT_T0_K);
    expect(hotTempK(1) - hotTempK(2)).toBeCloseTo(hotTempK(0) - hotTempK(1), 9);
    expect(hotTempK(100)).toBe(0);
  });
  it('a gust stores a unit body-frame direction and a jet envelope that is 0 at both ends', () => {
    const { v } = landed('air', 400);
    expect(Math.hypot(...v.tan)).toBeCloseTo(1, 9);
    expect(jetEnvelope(0)).toBe(0);
    expect(jetEnvelope(RESIDENT_LIFE_S.jet)).toBe(0);
    expect(jetEnvelope(RESIDENT_LIFE_S.jet / 2)).toBeCloseTo(1, 9);
  });
});

describe('the residents ride the body and leave on a fling', () => {
  it('a film keeps its body-frame spot while the planet turns under it', () => {
    const { buf, ctx, v } = landed('fluid', 400);
    const b0 = [...v.dirBody], w0 = [...v.dirWorld];
    ctx.q = [0, Math.SQRT1_2, 0, Math.SQRT1_2]; // 90 deg about world Y
    runTo(buf, ctx, createVisitorOut(), ctx.tS + 0.1);
    expect(v.dirBody).toEqual(b0);
    expect(angle(w0, v.dirWorld)).toBeGreaterThan(0.5);
  });
  it('a hard release flings a rock off with the surface velocity and frees it after DETACH_FADE_S', () => {
    const { buf, ctx, v } = landed('earth', 400, 1);
    ctx.omega = [0, 8, 0];
    ctx.detach = true;
    const p = [...v.pos];
    ctx.tS += ctx.dt;
    stepVisitors(buf, ctx, createVisitorOut());
    expect(v.state).toBe('detached');
    expect(v.vel[0]).toBeCloseTo(8 * p[2], 9);
    expect(v.vel[2]).toBeCloseTo(-8 * p[0], 9);
    ctx.detach = false;
    runTo(buf, ctx, createVisitorOut(), ctx.tS + DETACH_FADE_S + 0.05);
    expect(buf.live).toBe(0);
  });
  it('reduced motion: the bead never moves and lives half as long', () => {
    const buf = createVisitors();
    const ctx = ctxFor('fluid', 600);
    ctx.calm = true;
    const v = launchVisitor(buf, 'fluid', ctx);
    runTo(buf, ctx, createVisitorOut(), 0.1);
    const d0 = [...v.dirBody];
    runTo(buf, ctx, createVisitorOut(), RESIDENT_LIFE_S.bead * CALM_LIFE - 0.1);
    expect(v.dirBody).toEqual(d0);
    runTo(buf, ctx, createVisitorOut(), RESIDENT_LIFE_S.bead * CALM_LIFE + 0.2);
    expect(v.live).toBe(false);
  });
});

describe('light', () => {
  it('Planck: red is 1 at 1300 K and a hotter body is bluer', () => {
    expect(planckRGB(1300)[0]).toBeCloseTo(1, 9);
    const c9 = planckRGB(900), c13 = planckRGB(1300);
    expect(c13[2] / c13[0]).toBeGreaterThan(c9[2] / c9[0]);
  });
  it('glow: 700 K is black, 900 K is dull red, 1300 K is full', () => {
    expect(glowRGB(700)[0]).toBeLessThan(0.01);
    const g9 = glowRGB(900);
    expect(g9[0]).toBeGreaterThan(0.3);
    expect(g9[0]).toBeLessThan(0.9);
    expect(g9[1]).toBeLessThan(g9[0] * 0.2);
    expect(glowRGB(1300)[0]).toBeCloseTo(1, 6);
  });
});
```

- [ ] **Step 2: Run the tests.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/visitorResidents.test.js`
  - Expected: PASS.
  - If a test fails, fix `visitorSim.js` (not the test) unless the test contradicts the spec. Record any fix in the
    commit message.

- [ ] **Step 3: Commit.**

```bash
git add src/terminal/mercury/planet/__tests__/visitorResidents.test.js src/terminal/mercury/planet/visitorSim.js
git commit -m "test(mercury): visitors 4 — residents: lifetimes, skate, bob, ember, detach, calm, blackbody

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `visitorFrame`: bodies, screen rect, surface slots

**Files:**
- Create: `src/terminal/mercury/planet/visitorFrame.js`
- Test: `src/terminal/mercury/planet/__tests__/visitorFrame.test.js` (create)

**Interfaces:**
- Consumes: the Visitor fields and constants from Task 3.
- Produces:
  - `VIS_DROP=1, VIS_BEAD=2, VIS_EMBER=3, VIS_ROCK=4, VIS_GUST=5`
  - `createVisitorFrame() → { vis, ax, k: Float32Array(32), n, rect: Float32Array(4), visible, surfDir, surfA, surfB: Float32Array(16), nSurf, order: Int32Array(8), w: Float32Array(8) }`
  - `packVisitors(buf, ctx, view, frame) → frame`, where
    `view = { vp: Float32Array(16) /* projection·view, column-major */, p00, p11, wPx, hPx }`
  - `rockAxis(seed, out)`, `seedFrac(seed)`
  - Body record per index i:
    - `vis[4i..]` = (centre xyz, r)
    - `ax[4i..]` = (axis xyz, w). w is the stretch for a drop or bead, the tail length for an ember, the spin angle for
      a rock, the trail length for a gust.
    - `k[4i..]` = (code, fade, tempK for an ember or seedFrac for a rock or gust, 0)
  - Surface slot j:
    - `surfDir[4j..]` = (world dir, SURF_* code)
    - `surfA[4j..]` = (radius rad, p1, p2, weight); weight 0 means off
    - `surfB[4j..]` = (gust world dir, 0)

- [ ] **Step 1: Write the failing test.** Create `src/terminal/mercury/planet/__tests__/visitorFrame.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createVisitors, createVisitorOut, launchVisitor, filmRadius, filmThicknessNm, T_FLIGHT, VISIT_SURF_MAX,
  SURF_FILM, SURF_HOT, SURF_MENISCUS, SURF_JET, DROP_STRETCH_MAX, EMBER_BODY_S, ROCK_R } from '../visitorSim';
import { createVisitorFrame, packVisitors, VIS_DROP, VIS_EMBER, VIS_ROCK, VIS_GUST } from '../visitorFrame';
import { ctxFor, runTo } from './visitorTestKit';

function viewOf() {
  const cam = new THREE.PerspectiveCamera(40, 1.6, 0.1, 100);
  cam.position.set(0, 0, 3.6); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const m = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  return { vp: new Float32Array(m.elements), p00: cam.projectionMatrix.elements[0], p11: cam.projectionMatrix.elements[5], wPx: 1600, hPx: 1000, m };
}
const ndc = (view, p) => new THREE.Vector3(...p).applyMatrix4(view.m);

describe('visitorFrame', () => {
  it('nothing live: invisible, no surface slot', () => {
    const f = createVisitorFrame();
    f.surfA[3] = 1;
    packVisitors(createVisitors(), ctxFor('fluid'), viewOf(), f);
    expect(f.visible).toBe(false);
    expect(f.n).toBe(0);
    expect(f.nSurf).toBe(0);
    expect(f.surfA[3]).toBe(0);
  });
  it('a falling drop: one VIS_DROP stretched along its velocity, inside the rect', () => {
    const buf = createVisitors();
    const ctx = ctxFor('fluid');
    const v = launchVisitor(buf, 'fluid', ctx);
    runTo(buf, ctx, createVisitorOut(), 0.6);
    const view = viewOf();
    const f = packVisitors(buf, ctx, view, createVisitorFrame());
    expect(f.n).toBe(1);
    expect(f.k[0]).toBe(VIS_DROP);
    expect(f.ax[3]).toBeGreaterThan(0);
    expect(f.ax[3]).toBeLessThanOrEqual(DROP_STRETCH_MAX);
    const sp = Math.hypot(...v.vel);
    for (let k = 0; k < 3; k++) expect(f.ax[k]).toBeCloseTo(v.vel[k] / sp, 5);
    const c = ndc(view, v.pos);
    expect(c.x).toBeGreaterThan(f.rect[0]); expect(c.x).toBeLessThan(f.rect[2]);
    expect(c.y).toBeGreaterThan(f.rect[1]); expect(c.y).toBeLessThan(f.rect[3]);
    expect(f.visible).toBe(true);
  });
  it('an ember in flight trails its tail behind it; a gust carries its seed', () => {
    for (const [phase, code] of [['thermal', VIS_EMBER], ['air', VIS_GUST]]) {
      const buf = createVisitors();
      const ctx = ctxFor(phase);
      const v = launchVisitor(buf, phase, ctx);
      runTo(buf, ctx, createVisitorOut(), 0.4);
      const f = packVisitors(buf, ctx, viewOf(), createVisitorFrame());
      expect(f.k[0]).toBe(code);
      expect(f.ax[0] * v.vel[0] + f.ax[1] * v.vel[1] + f.ax[2] * v.vel[2]).toBeLessThan(0);
      expect(f.ax[3]).toBeGreaterThan(0);
    }
  });
  it('a film is a surface slot only: world dir, radius, thickness, age, fade', () => {
    const buf = createVisitors();
    const ctx = ctxFor('fluid', 400);
    const v = launchVisitor(buf, 'fluid', ctx);
    runTo(buf, ctx, createVisitorOut(), T_FLIGHT.fluid + 2);
    const f = packVisitors(buf, ctx, viewOf(), createVisitorFrame());
    const a = ctx.tS - v.tImpact;
    expect(f.n).toBe(0);
    expect(f.nSurf).toBe(1);
    expect(f.surfDir[3]).toBe(SURF_FILM);
    for (let k = 0; k < 3; k++) expect(f.surfDir[k]).toBeCloseTo(v.dirWorld[k], 6);
    expect(f.surfA[0]).toBeCloseTo(filmRadius(a), 6);
    expect(f.surfA[1]).toBeCloseTo(filmThicknessNm(a), 3);
    expect(f.surfA[3]).toBeCloseTo(v.fade, 6);
  });
  it('a floating rock: a body and its meniscus; flung off, the body stays and the meniscus goes', () => {
    const buf = createVisitors();
    const ctx = ctxFor('earth', 400);
    launchVisitor(buf, 'earth', ctx);
    runTo(buf, ctx, createVisitorOut(), T_FLIGHT.earth + 1);
    let f = packVisitors(buf, ctx, viewOf(), createVisitorFrame());
    expect(f.k[0]).toBe(VIS_ROCK);
    expect(f.surfDir[3]).toBe(SURF_MENISCUS);
    expect(f.surfA[0]).toBeCloseTo(ROCK_R / ctx.coreR, 9);
    ctx.omega = [0, 8, 0]; ctx.detach = true;
    runTo(buf, ctx, createVisitorOut(), ctx.tS + ctx.dt);
    f = packVisitors(buf, ctx, viewOf(), createVisitorFrame());
    expect(f.n).toBe(1);
    expect(f.nSurf).toBe(0);
  });
  it('an ember: body until EMBER_BODY_S, its hot spot after', () => {
    const buf = createVisitors();
    const ctx = ctxFor('thermal', 400);
    launchVisitor(buf, 'thermal', ctx);
    runTo(buf, ctx, createVisitorOut(), T_FLIGHT.thermal + 1);
    let f = packVisitors(buf, ctx, viewOf(), createVisitorFrame());
    expect(f.k[0]).toBe(VIS_EMBER);
    expect(f.surfDir[3]).toBe(SURF_HOT);
    runTo(buf, ctx, createVisitorOut(), T_FLIGHT.thermal + EMBER_BODY_S + 0.1);
    f = packVisitors(buf, ctx, viewOf(), createVisitorFrame());
    expect(f.n).toBe(0);
    expect(f.surfDir[3]).toBe(SURF_HOT);
  });
  it('a gust slot carries its downwind direction in world space', () => {
    const buf = createVisitors();
    const ctx = ctxFor('air', 400);
    launchVisitor(buf, 'air', ctx);
    runTo(buf, ctx, createVisitorOut(), T_FLIGHT.air + 0.5);
    const f = packVisitors(buf, ctx, viewOf(), createVisitorFrame());
    expect(f.surfDir[3]).toBe(SURF_JET);
    expect(Math.hypot(f.surfB[0], f.surfB[1], f.surfB[2])).toBeCloseTo(1, 5);
    expect(f.surfA[1]).toBeGreaterThan(0);
  });
  it('more than VISIT_SURF_MAX candidates: the strongest (by fade) go first', () => {
    const buf = createVisitors();
    const ctx = ctxFor('fluid', 400);
    for (let i = 0; i < 6; i++) { launchVisitor(buf, i % 2 ? 'thermal' : 'fluid', ctx); ctx.tS += 0.4; }
    runTo(buf, ctx, createVisitorOut(), 7.6);
    const f = packVisitors(buf, ctx, viewOf(), createVisitorFrame());
    expect(f.nSurf).toBe(VISIT_SURF_MAX);
    for (let j = 1; j < VISIT_SURF_MAX; j++) expect(f.surfA[4 * j + 3]).toBeLessThanOrEqual(f.surfA[4 * (j - 1) + 3]);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/visitorFrame.test.js`
  - Expected: FAIL (module not found).

- [ ] **Step 3: Implement.** Create `src/terminal/mercury/planet/visitorFrame.js`:

```js
// src/terminal/mercury/planet/visitorFrame.js — live visitors → the body pass's uniform arrays + its screen rect, and the
// planet shader's surface slots (visitors spec §5.2, §5.6). Allocates nothing; idle returns before any loop.

import { qRotate } from './breakupFamily';
import {
  VISITOR_SLOTS, VISIT_SURF_MAX, SURF_FILM, SURF_HOT, SURF_MENISCUS, SURF_JET, DROP_R, DROP_STRETCH_K, DROP_STRETCH_MAX,
  BEAD_OBLATE, EMBER_R, EMBER_BODY_S, EMBER_TAIL_S, EMBER_HALO, ROCK_R, ROCK_BOUND, GUST_TRAIL_S, GUST_W,
  MENISCUS_RING_DEPTH, JET_R, JET_DEPTH, filmRadius, filmThicknessNm, clearRadius, clearDepth, hotTempK, jetEnvelope,
} from './visitorSim';

export const VIS_DROP = 1, VIS_BEAD = 2, VIS_EMBER = 3, VIS_ROCK = 4, VIS_GUST = 5;
export const VIS_PAD_PX = 4;
export const BEAD_BOUND = 3.5;             // × r: the steam above it

export function createVisitorFrame() {
  return {
    vis: new Float32Array(VISITOR_SLOTS * 4), ax: new Float32Array(VISITOR_SLOTS * 4), k: new Float32Array(VISITOR_SLOTS * 4), n: 0,
    rect: new Float32Array([-1, -1, 1, 1]), visible: false,
    surfDir: new Float32Array(VISIT_SURF_MAX * 4), surfA: new Float32Array(VISIT_SURF_MAX * 4), surfB: new Float32Array(VISIT_SURF_MAX * 4), nSurf: 0,
    order: new Int32Array(VISITOR_SLOTS), w: new Float32Array(VISITOR_SLOTS),
  };
}

const _r = { x0: 0, y0: 0, x1: 0, y1: 0, full: false };
const _a = [0, 0, 0], _c = [0, 0, 0], _g = [0, 0, 0];

// A sphere (centre, rad) into the rect, in NDC (breakupFrame's grow, the same rule).
function grow(view, x, y, z, rad) {
  const e = view.vp;
  const X = e[0] * x + e[4] * y + e[8] * z + e[12];
  const Y = e[1] * x + e[5] * y + e[9] * z + e[13];
  const W = e[3] * x + e[7] * y + e[11] * z + e[15];
  if (W <= rad) { _r.full = true; return; }
  const rx = (rad * view.p00) / W, ry = (rad * view.p11) / W;
  _r.x0 = Math.min(_r.x0, X / W - rx); _r.x1 = Math.max(_r.x1, X / W + rx);
  _r.y0 = Math.min(_r.y0, Y / W - ry); _r.y1 = Math.max(_r.y1, Y / W + ry);
}

function unitInto(v, out) {
  const l = Math.hypot(v[0], v[1], v[2]);
  if (l < 1e-9) { out[0] = 0; out[1] = 1; out[2] = 0; return 0; }
  out[0] = v[0] / l; out[1] = v[1] / l; out[2] = v[2] / l;
  return l;
}

// A rock's tumble axis, fixed per seed.
export function rockAxis(seed, out) {
  out[0] = Math.sin(seed * 0.001 + 1.3); out[1] = Math.cos(seed * 0.0007 + 0.4); out[2] = Math.sin(seed * 0.0013 + 2.1);
  unitInto(out, out);
  return out;
}

// A seed as a small float for the shader's hashes.
export const seedFrac = (seed) => (seed % 997) + 0.5;

// bc / brad: the body's bound sphere for the rect (an ember's or gust's sits mid-trail).
function pushBody(f, view, code, p, r, ax, axW, fade, z, bc, brad) {
  if (f.n >= VISITOR_SLOTS || !(fade > 0)) return;
  const i = f.n++;
  f.vis[4 * i] = p[0]; f.vis[4 * i + 1] = p[1]; f.vis[4 * i + 2] = p[2]; f.vis[4 * i + 3] = r;
  f.ax[4 * i] = ax[0]; f.ax[4 * i + 1] = ax[1]; f.ax[4 * i + 2] = ax[2]; f.ax[4 * i + 3] = axW;
  f.k[4 * i] = code; f.k[4 * i + 1] = fade; f.k[4 * i + 2] = z; f.k[4 * i + 3] = 0;
  grow(view, bc[0], bc[1], bc[2], brad);
}

// A trail from p back along unit d for len: its midpoint into _c, returns its bound radius.
function trailBound(p, d, len, pad) {
  _c[0] = p[0] + d[0] * len * 0.5; _c[1] = p[1] + d[1] * len * 0.5; _c[2] = p[2] + d[2] * len * 0.5;
  return len * 0.5 + pad;
}

function packFlight(f, view, v) {
  const speed = unitInto(v.vel, _a);
  if (v.phase === 'fluid') {
    const s = Math.min(DROP_STRETCH_MAX, speed * DROP_STRETCH_K);
    pushBody(f, view, VIS_DROP, v.pos, DROP_R, _a, s, v.fade, 0, v.pos, DROP_R * (1 + s) * 1.3);
  } else if (v.phase === 'thermal') {
    _a[0] = -_a[0]; _a[1] = -_a[1]; _a[2] = -_a[2];
    const len = speed * EMBER_TAIL_S;
    pushBody(f, view, VIS_EMBER, v.pos, EMBER_R, _a, len, v.fade, v.tempK, _c, trailBound(v.pos, _a, len, 2 * EMBER_HALO * EMBER_R));
  } else if (v.phase === 'earth') {
    pushBody(f, view, VIS_ROCK, v.pos, ROCK_R, rockAxis(v.seed, _g), v.spin, v.fade, seedFrac(v.seed), v.pos, 1.2 * ROCK_BOUND * ROCK_R);
  } else {
    _a[0] = -_a[0]; _a[1] = -_a[1]; _a[2] = -_a[2];
    const len = speed * GUST_TRAIL_S;
    pushBody(f, view, VIS_GUST, v.pos, GUST_W, _a, len, v.fade, seedFrac(v.seed), _c, trailBound(v.pos, _a, len, 4 * GUST_W + ROCK_R));
  }
}

function packSettled(f, view, v, a) {
  if (v.kind === 'bead') {
    pushBody(f, view, VIS_BEAD, v.pos, v.r, v.dirWorld, BEAD_OBLATE, v.fade, 0, v.pos, BEAD_BOUND * v.r);
  } else if (v.kind === 'ember' && a < EMBER_BODY_S) {
    const body = 1 - Math.min(1, Math.max(0, (a - (EMBER_BODY_S - 0.5)) / 0.5));
    pushBody(f, view, VIS_EMBER, v.pos, EMBER_R, v.dirWorld, 0, v.fade * body, v.tempK, v.pos, 2 * EMBER_HALO * EMBER_R);
  } else if (v.kind === 'rock') {
    pushBody(f, view, VIS_ROCK, v.pos, ROCK_R, rockAxis(v.seed, _g), v.spin, v.fade, seedFrac(v.seed), v.pos, 1.2 * ROCK_BOUND * ROCK_R);
  }
}

// Film, hot spot and jet stay in the liquid while they fade (even when flung); a rock's meniscus leaves with the rock.
const hasSurface = (v) => v.kind === 'film' || v.kind === 'ember' || v.kind === 'jet' || (v.kind === 'rock' && v.state === 'resident');

function packSurface(f, j, v, ctx) {
  const a = ctx.tS - v.tImpact, o = 4 * j;
  const D = f.surfDir, A = f.surfA, B = f.surfB;
  D[o] = v.dirWorld[0]; D[o + 1] = v.dirWorld[1]; D[o + 2] = v.dirWorld[2];
  B[o] = 0; B[o + 1] = 0; B[o + 2] = 0; B[o + 3] = 0;
  A[o + 3] = v.fade;
  if (v.kind === 'film') {
    D[o + 3] = SURF_FILM; A[o] = filmRadius(a); A[o + 1] = filmThicknessNm(a); A[o + 2] = a;
  } else if (v.kind === 'ember') {
    D[o + 3] = SURF_HOT; A[o] = clearRadius(a); A[o + 1] = clearDepth(a); A[o + 2] = hotTempK(a);
  } else if (v.kind === 'rock') {
    D[o + 3] = SURF_MENISCUS; A[o] = ROCK_R / ctx.coreR; A[o + 1] = MENISCUS_RING_DEPTH; A[o + 2] = 0;
  } else {
    D[o + 3] = SURF_JET; A[o] = JET_R; A[o + 1] = JET_DEPTH * jetEnvelope(a); A[o + 2] = a;
    qRotate(ctx.q, v.tan, _g);
    B[o] = _g[0]; B[o + 1] = _g[1]; B[o + 2] = _g[2];
  }
}

export function packVisitors(buf, ctx, view, f) {
  f.n = 0; f.nSurf = 0; f.visible = false;
  for (let j = 0; j < VISIT_SURF_MAX; j++) f.surfA[4 * j + 3] = 0;
  if (buf.live === 0) return f;
  _r.x0 = Infinity; _r.y0 = Infinity; _r.x1 = -Infinity; _r.y1 = -Infinity; _r.full = false;
  let nc = 0;
  for (let i = 0; i < VISITOR_SLOTS; i++) {
    const v = buf.v[i];
    if (!v.live) continue;
    if (v.state === 'flight') { packFlight(f, view, v); continue; }
    packSettled(f, view, v, ctx.tS - v.tImpact);
    if (hasSurface(v)) {
      // strongest first (stable insertion by fade): a tier whose shader draws fewer slots draws the ones that show
      let j = nc++;
      while (j > 0 && f.w[j - 1] < v.fade) { f.w[j] = f.w[j - 1]; f.order[j] = f.order[j - 1]; j--; }
      f.w[j] = v.fade; f.order[j] = i;
    }
  }
  f.nSurf = Math.min(nc, VISIT_SURF_MAX);
  for (let j = 0; j < f.nSurf; j++) packSurface(f, j, buf.v[f.order[j]], ctx);
  if (f.n === 0) return f;
  let { x0, y0, x1, y1 } = _r;
  if (_r.full) { x0 = -1; y0 = -1; x1 = 1; y1 = 1; }
  const px = (2 * VIS_PAD_PX) / view.wPx, py = (2 * VIS_PAD_PX) / view.hPx;
  x0 = Math.max(-1, x0 - px); y0 = Math.max(-1, y0 - py); x1 = Math.min(1, x1 + px); y1 = Math.min(1, y1 + py);
  if (!(x1 > x0 && y1 > y0)) return f;
  f.rect[0] = x0; f.rect[1] = y0; f.rect[2] = x1; f.rect[3] = y1;
  f.visible = true;
  return f;
}
```

- [ ] **Step 4: Run the tests and confirm they pass.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/visitorFrame.test.js src/terminal/mercury/planet/__tests__/visitorSim.test.js src/terminal/mercury/planet/__tests__/visitorResidents.test.js`
  - Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/terminal/mercury/planet/visitorFrame.js src/terminal/mercury/planet/__tests__/visitorFrame.test.js
git commit -m "feat(mercury): visitors 5 — visitorFrame: body arrays, screen rect, strongest-first surface slots

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Planet shader surface slots (film optics, hot clearing, rock meniscus, jet + cat's-paws)

**Files:**
- Create: `src/terminal/mercury/planet/visitorGlsl.js`
- Modify: `src/terminal/mercury/planet/mercuryPlanetShader.js`, `src/terminal/mercury/planet/planetQuality.js`
- Create: `src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.pre-visitors.fs.glsl` (a copy of the current
  pinned full shader)
- Modify tests: `src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`,
  `src/terminal/mercury/planet/__tests__/planetQuality.test.js`
- Update the pinned snapshot: `__snapshots__/planetShader.full.fs.glsl` (only after the strip test passes)

**Interfaces:**
- Consumes: `VISIT_SURF_MAX`, `SURF_*` codes and the film / hot / catspaw constants from `visitorSim`.
- Produces:
  - Uniforms `uVisitOn` (float), `uVisitDir[4]`, `uVisitA[4]`, `uVisitB[4]` (vec4), added to `PLANET_UNIFORMS`
  - `TIERS.*.visitSlots` (full 4, phone 2, lite 1)
  - `VISIT_LIGHT_GLSL` with `vec3 visPlanck(float tK)` / `vec3 visGlow(float tK)`, also used by Task 7

- [ ] **Step 1: Pin the pre-change shader.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js`
  - Expected: PASS. This proves `planetShader.full.fs.glsl` equals the current `PLANET_FS`.
  - Then run: `cp src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.full.fs.glsl src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.pre-visitors.fs.glsl`

- [ ] **Step 2: Write the failing tests.**
  - In `planetQuality.test.js`, add inside its top-level describe:

```js
  it('visitor surface slots per tier: full 4, phone 2, lite 1 (never more than JS writes)', () => {
    expect([TIERS.full.visitSlots, TIERS.phone.visitSlots, TIERS.lite.visitSlots]).toEqual([4, 2, 1]);
    for (const t of TIER_NAMES) expect(TIERS[t].visitSlots).toBeLessThanOrEqual(VISIT_SURF_MAX);
  });
```

  - Add `import { VISIT_SURF_MAX } from '../visitorSim';` to that file's imports. Also make sure `TIER_NAMES` is imported
    there; it is used on line 8.
  - In `mercuryPlanetShader.test.js`:
    - Add the imports:

```js
import { VISIT_SURF_MAX, FILM_N, FILM_A, FILM_TEAR_NM, FILM_NOISE_FREQ, HOT_GAIN, CATSPAW_K, CATSPAW_AMP, CATSPAW_SPEED, JET_DEPTH, PLANCK_C2_NM_K, GLOW_EXPO } from '../visitorSim';
import { PLANCK_REF, VISIT_LIGHT_GLSL } from '../visitorGlsl';
```

    - Directly above `const stripSlowNoon = …` add:

```js
// Visitors (spec 2026-10-03): every visitor line is marked; removing them restores the pre-visitors shader.
const stripVisitors = (src) => {
  const out = [];
  let inBlock = false;
  for (const line of src.split('\n')) {
    if (line.includes('// <visitors>')) { inBlock = true; continue; }
    if (line.includes('// </visitors>')) { inBlock = false; continue; }
    if (inBlock || line.includes('// visitors')) continue;
    out.push(line);
  }
  return out.join('\n');
};
```

    - Change the slow-noon parity assertion to `expect(stripSlowNoon(stripVisitors(PLANET_FS))).toBe(pre);`.
    - Append:

```js
describe('visitors: surface slots', () => {
  it('stripping the visitor lines gives back the pre-visitors shader byte for byte', () => {
    const pre = readFileSync(resolve(__dirname, '__snapshots__/planetShader.pre-visitors.fs.glsl'), 'utf8');
    expect(stripVisitors(PLANET_FS)).toBe(pre);
  });
  it('declares the slot uniforms (marked) and interpolates the constants from visitorSim', () => {
    expect(PLANET_FS).toContain('uniform float uVisitOn; // visitors');
    for (const n of ['uVisitDir', 'uVisitA', 'uVisitB']) expect(PLANET_FS).toContain(`uniform vec4 ${n}[${VISIT_SURF_MAX}]; // visitors`);
    for (const [name, value] of Object.entries({ FILM_N, FILM_A, FILM_TEAR_NM, FILM_NOISE_FREQ, HOT_GAIN, CATSPAW_K, CATSPAW_AMP, CATSPAW_SPEED, JET_DEPTH })) {
      expect(PLANET_FS).toContain(`const float ${name} = ${glf(value)};`);
    }
    expect(PLANET_FS).toContain(VISIT_LIGHT_GLSL);
    expect(VISIT_LIGHT_GLSL).toContain(`const float PLANCK_C2_NM_K = ${glf(PLANCK_C2_NM_K)};`);
    expect(VISIT_LIGHT_GLSL).toContain(`const float PLANCK_REF = ${glf(PLANCK_REF)};`);
    expect(VISIT_LIGHT_GLSL).toContain(`const float GLOW_EXPO = ${glf(GLOW_EXPO)};`);
  });
  it('each tier loops its own slot count; the CALM variant compiles them out', () => {
    for (const tier of TIER_NAMES) expect(buildPlanetShader({ tier }).fs).toContain(`const int VISIT_SLOTS = ${TIERS[tier].visitSlots};`);
    for (const tier of TIER_NAMES) expect(buildPlanetShader({ tier, calm: true }).fs).toContain('const int VISIT_SLOTS = 0;');
  });
  it('tilts the normal before the reflection, tints after NoV, emits inside the fluid branch', () => {
    const main = PLANET_FS.slice(PLANET_FS.indexOf('void main()'));
    const tilt = main.indexOf('nW = normalize(nW - fluid * visitTilt(xw, pxArc)); // visitors');
    const refl = main.indexOf('vec3 R = reflect(rd, nW);');
    const nov = main.indexOf('float NoV = clamp(dot(nW, -rd), 0.0, 1.0);');
    const tint = main.indexOf('visTint = visitTint(xw, NoV, visEmit); // visitors');
    const mul = main.indexOf('liquid *= visTint; // visitors');
    const mix = main.indexOf('colLin = mix(colLin, mix(solid, liquid, liquidW), fluid);');
    const emit = main.indexOf('colLin += fluid * liquidW * visEmit; // visitors');
    expect(tilt).toBeGreaterThan(-1);
    expect(tilt).toBeLessThan(refl);
    expect(tint).toBeGreaterThan(nov);
    expect(mul).toBeGreaterThan(tint);
    expect(mul).toBeLessThan(mix);
    expect(emit).toBeGreaterThan(mix);
  });
  it('the slot functions take no screen derivatives (they loop with continue)', () => {
    const block = PLANET_FS.slice(PLANET_FS.indexOf('// <visitors>'), PLANET_FS.indexOf('// </visitors>'));
    expect(block.length).toBeGreaterThan(100);
    expect(block).not.toMatch(/dFd[xy]|fwidth/);
  });
});
```

- [ ] **Step 3: Run the tests and confirm they fail.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js src/terminal/mercury/planet/__tests__/planetQuality.test.js`
  - Expected: FAIL (`visitorGlsl` is missing, there are no `visitSlots`, there are no visitor lines).

- [ ] **Step 4: Implement.**
  - Create `src/terminal/mercury/planet/visitorGlsl.js`:

```js
// src/terminal/mercury/planet/visitorGlsl.js — GLSL shared by the planet's surface slots and the visitors' body pass.
// visitorSim.planckRGB / glowRGB, exactly (tested there; the constants here are interpolated from it).

import { glf } from '../../gl/glf';
import { PLANCK_C2_NM_K, PLANCK_REF_K, GLOW_EXPO } from './visitorSim';

export const PLANCK_REF = Math.exp(PLANCK_C2_NM_K / (650 * PLANCK_REF_K)) - 1;

export const VISIT_LIGHT_GLSL = `// Blackbody at 650 / 532 / 450 nm, red = 1 at ${PLANCK_REF_K} K; the exponent clamps at 80 (a cool spot underflows to 0).
const float PLANCK_C2_NM_K = ${glf(PLANCK_C2_NM_K)};
const float PLANCK_REF = ${glf(PLANCK_REF)};
const float GLOW_EXPO = ${glf(GLOW_EXPO)};
vec3 visPlanck(float tK) {
  vec3 lam = vec3(650.0, 532.0, 450.0);
  vec3 x = min(PLANCK_C2_NM_K / (lam * max(tK, 1.0)), vec3(80.0));
  return pow(vec3(650.0) / lam, vec3(5.0)) / (exp(x) - 1.0) * PLANCK_REF;
}
// Its hue, brightness saturated: 700 K black, 900 K dull red, 1300 K full.
vec3 visGlow(float tK) {
  vec3 b = visPlanck(tK);
  return b / max(b.r, 1e-12) * (1.0 - exp(-b.r * GLOW_EXPO));
}`;
```

  - In `planetQuality.js`, add `visitSlots: 4,` to `full`, `visitSlots: 2,` to `phone` and `visitSlots: 1,` to `lite`
    (inside each `Object.freeze({ … })`, after `rippleSlots`).
  - In `mercuryPlanetShader.js`:
    1. Add these imports:

```js
import {
  VISIT_SURF_MAX, SURF_FILM, SURF_HOT, SURF_MENISCUS, SURF_JET, FILM_N, FILM_A, FILM_TEAR_NM, FILM_NOISE_FREQ, HOT_GAIN,
  CATSPAW_K, CATSPAW_AMP, CATSPAW_SPEED, JET_DEPTH,
} from './visitorSim';
import { VISIT_LIGHT_GLSL } from './visitorGlsl';
```

    2. Append `'uVisitOn', 'uVisitDir', 'uVisitA', 'uVisitB',` to the `PLANET_UNIFORMS` array, after `'uOverlay', 'uCaloris',`.
    3. In `planetFs`, directly after the line `uniform vec3 uCaloris; // slow-noon`, insert:

```glsl
uniform float uVisitOn; // visitors
uniform vec4 uVisitDir[${VISIT_SURF_MAX}]; // visitors
uniform vec4 uVisitA[${VISIT_SURF_MAX}]; // visitors
uniform vec4 uVisitB[${VISIT_SURF_MAX}]; // visitors
```

    4. Directly before the line `void main() {` (after `roilNoiseTilt`), insert:

```glsl
// <visitors>
// The visitors' surface slots (visitorFrame): what an element leaves IN the liquid, drawn as part of the mirror.
// uVisitDir: world dir + kind (1 film, 2 hot clearing, 3 rock meniscus, 4 gust); uVisitA: (radius rad, p1, p2, weight);
// uVisitB: the gust's world direction. No derivatives in here (they loop with continue).
const int VISIT_SLOTS = ${calm ? 0 : q.visitSlots};
const float FILM_N = ${glf(FILM_N)};
const float FILM_A = ${glf(FILM_A)};
const float FILM_TEAR_NM = ${glf(FILM_TEAR_NM)};
const float FILM_NOISE_FREQ = ${glf(FILM_NOISE_FREQ)};
const float HOT_GAIN = ${glf(HOT_GAIN)};
const float CATSPAW_K = ${glf(CATSPAW_K)};
const float CATSPAW_AMP = ${glf(CATSPAW_AMP)};
const float CATSPAW_SPEED = ${glf(CATSPAW_SPEED)};
const float JET_DEPTH = ${glf(JET_DEPTH)};
${VISIT_LIGHT_GLSL}

// The slope (dh/dθ) of a depression depth·exp(−((θ − c)/w)²); negate it for a raised ring.
float visDent(float th, float c, float w, float depth) {
  float u = (th - c) / max(w, 1e-4);
  return depth * 2.0 * u / max(w, 1e-4) * exp(-u * u);
}

// Tangential slope to subtract from the liquid's normal (like waveTilt).
vec3 visitTilt(vec3 x, float pxArc) {
  vec3 g = vec3(0.0);
  for (int i = 0; i < VISIT_SLOTS; i++) {
    vec4 D = uVisitDir[i];
    vec4 A = uVisitA[i];
    if (A.w <= 0.0) continue;
    float m = clamp(dot(x, D.xyz), -1.0, 1.0);
    float s = sqrt(max(1.0 - m * m, 0.0));
    if (s < 1e-4) continue;
    float th = acos(m);
    vec3 tOut = (x * m - D.xyz) / s;
    float sl = 0.0;
    if (D.w == ${glf(SURF_HOT)}) {
      // Marangoni: tension falls where it is hot, the surface flows away: a clearing, its rim pushed outward
      sl = visDent(th, 0.0, A.x, A.y) - visDent(th, A.x, 0.35 * A.x, 0.5 * A.y);
    } else if (D.w == ${glf(SURF_MENISCUS)}) {
      // a floating rock presses a meniscus ring into the liquid just outside its contact line
      sl = visDent(th, 1.15 * A.x, 0.4 * A.x, A.y);
    } else if (D.w == ${glf(SURF_JET)}) {
      // a gust: the dent under it, cat's-paws running downwind (plan D-2: an explicit direction, not the impulse slip)
      sl = visDent(th, 0.0, A.x, A.y);
      vec3 G = uVisitB[i].xyz - x * dot(uVisitB[i].xyz, x);
      float gl = length(G);
      if (gl > 1e-4) {
        G /= gl;
        float down = smoothstep(-0.2, 0.6, dot(tOut, G));
        float ph = CATSPAW_K * dot(x, uVisitB[i].xyz) - CATSPAW_SPEED * A.z;
        float amp = CATSPAW_AMP * A.w * down * exp(-th * th / (9.0 * A.x * A.x)) * (A.y / JET_DEPTH)
          * bandAA(CATSPAW_K, pxArc) * (0.6 + 0.4 * vnoise3(x * 40.0 + D.xyz * 7.0));
        g += amp * sin(ph) * G;
      }
    }
    g += A.w * sl * tOut;
  }
  return g;
}

// The film's interference over the mirror (a factor) and the hot spots' glow (emit, linear radiance).
vec3 visitTint(vec3 x, float NoV, out vec3 emit) {
  vec3 tint = vec3(1.0);
  emit = vec3(0.0);
  for (int i = 0; i < VISIT_SLOTS; i++) {
    vec4 D = uVisitDir[i];
    vec4 A = uVisitA[i];
    if (A.w <= 0.0) continue;
    float th = acos(clamp(dot(x, D.xyz), -1.0, 1.0));
    if (D.w == ${glf(SURF_FILM)}) {
      // water WETS mercury (S ≈ +38 mN/m): a thin film, thicker at its centre, torn into lenses once it is thin
      float r = max(A.x, 1e-3);
      if (th >= r) continue;
      float u = th / r;
      float hNm = A.y * (1.0 - 0.6 * u * u);
      float tear = smoothstep(0.35, 0.65, vnoise3(x * FILM_NOISE_FREQ + D.xyz * 13.0) + 0.5 * (FILM_TEAR_NM - hNm) / FILM_TEAR_NM);
      float cov = A.w * (1.0 - smoothstep(0.8, 1.0, u)) * (1.0 - tear);
      float cosT = sqrt(max(1.0 - (1.0 - NoV * NoV) / (FILM_N * FILM_N), 0.0));
      vec3 delta = 4.0 * PI * FILM_N * hNm * cosT / vec3(650.0, 532.0, 450.0);
      tint *= mix(vec3(1.0), 1.0 - FILM_A * cos(delta), cov);
    } else if (D.w == ${glf(SURF_HOT)}) {
      emit += A.w * HOT_GAIN * visGlow(A.z) * exp(-th * th / (0.36 * max(A.x * A.x, 4e-4)));
    }
  }
  return tint;
}
// </visitors>
```

  `glf(2)` renders as `2.00000000`, a valid GLSL float, so `D.w == 2.00000000` compares an exact small float that JS wrote.

    5. In `main`, directly before `vec3 R = reflect(rd, nW);`, insert:

```glsl
      vec3 visTint = vec3(1.0), visEmit = vec3(0.0); // visitors
      if (uVisitOn > 0.5) nW = normalize(nW - fluid * visitTilt(xw, pxArc)); // visitors
```

    6. Directly after `float NoV = clamp(dot(nW, -rd), 0.0, 1.0);`, insert:

```glsl
      if (uVisitOn > 0.5) visTint = visitTint(xw, NoV, visEmit); // visitors
```

    7. Directly after the closing `}` of `if (liquidW > 0.0) { liquid = fresnelHg(…) … }`, insert:

```glsl
      liquid *= visTint; // visitors
```

    8. Directly after the line that begins `colLin = mix(colLin, mix(solid, liquid, liquidW), fluid);` (the one that ends
       with the `${calm ? …}` interpolation), insert as its own line:

```glsl
      colLin += fluid * liquidW * visEmit; // visitors
```

- [ ] **Step 5: Run the tests.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js src/terminal/mercury/planet/__tests__/planetQuality.test.js`
  - Expected: every test PASSes **except** "the full variant is byte-identical to the pinned shader". The strip test
    proves that diff is visitor lines only.
  - Update the pinned snapshot deliberately:
    `npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js -u`
  - Then run `git diff --stat src/terminal/mercury/planet/__tests__/__snapshots__/`. Expected: only `planetShader.full.fs.glsl`
    changes, and every added line in its diff is a visitor line (spot-check with `git diff`).
  - Then run the whole planet suite: `npx vitest run src/terminal/mercury/planet`. Expected: PASS (hgMirrorGlsl, droplet
    and slow-noon tests included).

- [ ] **Step 6: Commit.**

```bash
git add src/terminal/mercury/planet/visitorGlsl.js src/terminal/mercury/planet/mercuryPlanetShader.js src/terminal/mercury/planet/planetQuality.js src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js src/terminal/mercury/planet/__tests__/planetQuality.test.js src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.full.fs.glsl src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.pre-visitors.fs.glsl
git commit -m "feat(mercury): visitors 6 — planet surface slots: thin-film interference, Marangoni clearing, rock meniscus, gust cat's-paws

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The visitors' body pass (`visitorShader.js` + `useVisitorField.js`)

**Files:**
- Create: `src/terminal/mercury/planet/visitorShader.js`, `src/terminal/mercury/useVisitorField.js`
- Test: `src/terminal/mercury/planet/__tests__/visitorShader.test.js` (create)

**Interfaces:**
- Consumes:
  - `DROPLET_VS` and `DROPLET_RENDER_ORDER` from `dropletShader`
  - `HG_MIRROR_DECLS_GLSL`, `HG_FRESNEL_GLSL`, `HG_ENV_GLSL` and `HG_MIRROR_UNIFORMS` from `hgMirrorGlsl`
  - `VISIT_LIGHT_GLSL`
  - the `VIS_*` codes and the frame layout from Task 5
- Produces:
  - `buildVisitorShader() → { vs, fs }`, `VISITOR_UNIFORMS`, `VISITOR_MATERIAL`, `VISITOR_RENDER_ORDER`
  - `useVisitorField({ planetMaterial }) → { geometry, material, meshRef, renderOrder, upload(frame, tS, pxAngle) }`

- [ ] **Step 1: Write the failing test.** Create `src/terminal/mercury/planet/__tests__/visitorShader.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { glf, v3 } from '../../../gl/glf';
import {
  buildVisitorShader, VISITOR_UNIFORMS, VISITOR_MATERIAL, VISITOR_RENDER_ORDER, WATER_N, WATER_F0, WATER_TINT,
  ROCK_PLANES, ROCK_AA, GAP_DARK, STEAM_A, GUST_A,
} from '../visitorShader';
import { DROPLET_RENDER_ORDER, DROPLET_VS } from '../dropletShader';
import { HG_MIRROR_DECLS_GLSL } from '../hgMirrorGlsl';
import { VISIT_LIGHT_GLSL } from '../visitorGlsl';
import { VISITOR_SLOTS, EMBER_GAIN, EMBER_HALO, ROCK_BOUND } from '../visitorSim';
import { VIS_DROP, VIS_BEAD, VIS_EMBER, VIS_ROCK, VIS_GUST } from '../visitorFrame';

const declared = (src) => [...src.matchAll(/^uniform\s+\w+\s+(\w+)(?:\[\d+\])?;/gm)].map((m) => m[1]);
const { vs, fs } = buildVisitorShader();

describe('visitorShader — the visitors as analytic bodies', () => {
  it('shares the droplets\' rect vertex stage and draws after them', () => {
    expect(vs).toBe(DROPLET_VS);
    expect(VISITOR_RENDER_ORDER).toBe(DROPLET_RENDER_ORDER + 1);
  });
  it('blends (translucent glow, steam, shimmer: plan D-1), depth-tests, never writes depth', () => {
    expect(VISITOR_MATERIAL).toMatchObject({ transparent: true, blending: THREE.NormalBlending, depthTest: true, depthWrite: false });
    expect(fs).toContain('gl_FragDepth =');
  });
  it('declares exactly VISITOR_UNIFORMS plus the three built-ins', () => {
    const names = declared(fs).filter((u) => !['viewMatrix', 'projectionMatrix', 'cameraPosition'].includes(u));
    expect([...names].sort()).toEqual([...VISITOR_UNIFORMS].sort());
    expect(fs).toContain(`uniform vec4 uVis[${VISITOR_SLOTS}];`);
  });
  it('is the planet\'s own mirror and light', () => {
    expect(fs).toContain(HG_MIRROR_DECLS_GLSL);
    expect(fs).toContain(VISIT_LIGHT_GLSL);
    expect(fs).toMatch(/fresnelHg\(/);
    expect(fs).toMatch(/envRadiance\(/);
  });
  it('water: n 1.33 Fresnel, the bent ray meets the planet\'s mirror (no scene copy)', () => {
    expect(WATER_F0).toBeCloseTo(((WATER_N - 1) / (WATER_N + 1)) ** 2, 12);
    expect(fs).toContain(`const float WATER_F0 = ${glf(WATER_F0)};`);
    expect(fs).toContain(`const vec3 WATER_TINT = ${v3(WATER_TINT)};`);
    expect(fs).toMatch(/refract\(rd, n, 1\.0 \/ WATER_N\)/);
    expect(fs).toMatch(/uCoreR \* uCoreR/);
  });
  it('interpolates its constants', () => {
    for (const [name, value] of Object.entries({ EMBER_GAIN, EMBER_HALO, ROCK_BOUND, GAP_DARK, STEAM_A, GUST_A })) {
      expect(fs).toContain(`const float ${name} = ${glf(value)};`);
    }
    for (const [name, value] of Object.entries({ ROCK_PLANES, ROCK_AA, VIS_DROP, VIS_BEAD, VIS_EMBER, VIS_ROCK, VIS_GUST })) {
      expect(fs).toContain(`const int ${name} = ${value};`);
    }
  });
  it('takes no screen derivatives anywhere (it discards per pixel)', () => {
    expect(fs).not.toMatch(/dFd[xy]|fwidth/);
    expect(fs).toMatch(/\bdiscard;/);
  });
  it('is GLSL 3 without #version / #include', () => {
    expect(fs).not.toMatch(/#version|#include/);
    expect(fs).toMatch(/out vec4 fragColor;/);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/visitorShader.test.js`
  - Expected: FAIL (module not found).

- [ ] **Step 3: Implement.**
  - Create `src/terminal/mercury/planet/visitorShader.js`:

```js
// src/terminal/mercury/planet/visitorShader.js — the visitors' bodies (visitors spec §5.5, §6.1), analytic per kind
// in one quad over their screen rect (visitorFrame):
//   drop / Leidenfrost bead: a water ellipsoid; its bent ray meets the planet and is shaded with the planet's
//     own mirror, so the lens shows the real mercury under it, without a scene copy;
//   ember: a blackbody core and a comet tail;
//   rock: cut planes ∩ a sphere, 4 rays per pixel on the rock only;
//   gust: a faint chromatic shimmer plus dust motes (true background refraction would need a scene copy).
// Plan D-1: unlike the droplets this pass BLENDS (the tail, steam and shimmer are translucent): depth test on, depth
// write off, gl_FragDepth still sorts each fragment against the planet. No screen derivatives (it discards per pixel).

import * as THREE from 'three';
import { glf, v3 } from '../../gl/glf';
import { HG_MIRROR_DECLS_GLSL, HG_FRESNEL_GLSL, HG_ENV_GLSL, HG_MIRROR_UNIFORMS } from './hgMirrorGlsl';
import { DROPLET_VS, DROPLET_RENDER_ORDER } from './dropletShader';
import { VISIT_LIGHT_GLSL } from './visitorGlsl';
import { VISITOR_SLOTS, EMBER_GAIN, EMBER_HALO, ROCK_BOUND } from './visitorSim';
import { VIS_DROP, VIS_BEAD, VIS_EMBER, VIS_ROCK, VIS_GUST } from './visitorFrame';

export const VISITOR_RENDER_ORDER = DROPLET_RENDER_ORDER + 1;
export const VISITOR_MATERIAL = Object.freeze({ transparent: true, blending: THREE.NormalBlending, depthTest: true, depthWrite: false });

export const WATER_N = 1.33;
export const WATER_F0 = ((WATER_N - 1) / (WATER_N + 1)) ** 2;
export const WATER_ROUGH = 0.05;
export const WATER_TINT = [0.96, 0.985, 1.0];
export const GAP_DARK = 0.25;              // the vapour gap under a Leidenfrost bead, at its darkest
export const STEAM_A = 0.18;
export const STEAM_COL = [0.35, 0.37, 0.4];
export const ROCK_PLANES = 7;
export const ROCK_AA = 4;
export const ROCK_ALBEDO = [0.11, 0.105, 0.1];
export const ROCK_AMBIENT = 0.02;
export const ROCK_RIM = 0.15;
export const GUST_A = 0.22;
export const GUST_COL = [0.75, 0.88, 1.0];
export const MOTES = 4;
export const MOTE_COL = [0.5, 0.48, 0.45];

export const VISITOR_OWN_UNIFORMS = ['uRect', 'uVis', 'uVisAx', 'uVisK', 'uVisN', 'uPxAngle', 'uTime', 'uCoreR'];
export const VISITOR_UNIFORMS = [...VISITOR_OWN_UNIFORMS, ...HG_MIRROR_UNIFORMS];

export function buildVisitorShader() {
  const N = VISITOR_SLOTS;
  const fs = /* glsl */ `precision highp float;

in vec3 vFar;
layout(location = 0) out vec4 fragColor;

uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 cameraPosition;
uniform vec4 uRect;
uniform vec4 uVis[${N}];
uniform vec4 uVisAx[${N}];
uniform vec4 uVisK[${N}];
uniform float uVisN;
uniform float uPxAngle;
uniform float uTime;
uniform float uCoreR;
${HG_MIRROR_DECLS_GLSL}

const float PI = 3.14159265358979;
const int NV = ${N};
const int VIS_DROP = ${VIS_DROP};
const int VIS_BEAD = ${VIS_BEAD};
const int VIS_EMBER = ${VIS_EMBER};
const int VIS_ROCK = ${VIS_ROCK};
const int VIS_GUST = ${VIS_GUST};
const int ROCK_PLANES = ${ROCK_PLANES};
const int ROCK_AA = ${ROCK_AA};
const int MOTES = ${MOTES};
const float WATER_N = ${glf(WATER_N)};
const float WATER_F0 = ${glf(WATER_F0)};
const float WATER_ROUGH = ${glf(WATER_ROUGH)};
const vec3 WATER_TINT = ${v3(WATER_TINT)};
const float GAP_DARK = ${glf(GAP_DARK)};
const float STEAM_A = ${glf(STEAM_A)};
const vec3 STEAM_COL = ${v3(STEAM_COL)};
const float EMBER_GAIN = ${glf(EMBER_GAIN)};
const float EMBER_HALO = ${glf(EMBER_HALO)};
const float ROCK_BOUND = ${glf(ROCK_BOUND)};
const vec3 ROCK_ALBEDO = ${v3(ROCK_ALBEDO)};
const float ROCK_AMBIENT = ${glf(ROCK_AMBIENT)};
const float ROCK_RIM = ${glf(ROCK_RIM)};
const float GUST_A = ${glf(GUST_A)};
const vec3 GUST_COL = ${v3(GUST_COL)};
const vec3 MOTE_COL = ${v3(MOTE_COL)};

${HG_FRESNEL_GLSL}

${HG_ENV_GLSL}

${VISIT_LIGHT_GLSL}

float hash11(float n) { return fract(sin(n) * 43758.5453123); }
float gauss(float x) { return exp(-x * x); }
float vn3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n = dot(i, vec3(1.0, 57.0, 113.0));
  return mix(mix(mix(hash11(n), hash11(n + 1.0), f.x), mix(hash11(n + 57.0), hash11(n + 58.0), f.x), f.y),
             mix(mix(hash11(n + 113.0), hash11(n + 114.0), f.x), mix(hash11(n + 170.0), hash11(n + 171.0), f.x), f.y), f.z);
}
vec3 rotAxis(vec3 v, vec3 k, float a) {
  float c = cos(a), s = sin(a);
  return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
}

// Ray vs an ellipsoid of revolution about unit a (stretch s: ra = r(1+s), rp = r/√(1+s), volume kept), solved in the
// space where it is the unit sphere. miss: signed distance from the silhouette, in units of rp (< 0 inside).
float hitEll(vec3 ro, vec3 rd, vec3 c, float r, vec3 a, float s, out vec3 n, out float miss) {
  float ra = r * (1.0 + s);
  float rp = r * inversesqrt(1.0 + s);
  vec3 o = ro - c;
  vec3 O = a * dot(o, a) / ra + (o - a * dot(o, a)) / rp;
  vec3 D = a * dot(rd, a) / ra + (rd - a * dot(rd, a)) / rp;
  float A = dot(D, D);
  float B = dot(O, D);
  float h = B * B - A * (dot(O, O) - 1.0);
  miss = (length(O - D * (B / A)) - 1.0) * rp;
  n = vec3(0.0, 0.0, 1.0);
  if (h < 0.0) return -1.0;
  float t = (-B - sqrt(h)) / A;
  vec3 P = O + D * t;
  n = normalize(a * dot(P, a) / ra + (P - a * dot(P, a)) / rp);
  return t;
}

// Closest distance between the ray and the segment a→b; u: where along it (0..1); tr: the ray's t there.
float raySeg(vec3 ro, vec3 rd, vec3 a, vec3 b, out float u, out float tr) {
  vec3 ba = b - a;
  vec3 oa = ro - a;
  float baba = dot(ba, ba), bard = dot(ba, rd), baoa = dot(ba, oa), rdoa = dot(rd, oa);
  float den = baba - bard * bard;
  u = den > 1e-12 ? clamp((baoa - bard * rdoa) / den, 0.0, 1.0) : 0.0;
  tr = max(u * bard - rdoa, 0.0);
  return length(oa + rd * tr - ba * u);
}

// A rock: ROCK_PLANES seeded cut planes ∩ a sphere of ROCK_BOUND·r (always bounded), tumbled by ang about ax.
float hitRock(vec3 ro, vec3 rd, vec3 c, float r, vec3 ax, float ang, float seed, out vec3 n) {
  vec3 o = rotAxis(ro - c, ax, -ang);
  vec3 d = rotAxis(rd, ax, -ang);
  float rb = ROCK_BOUND * r;
  float b = dot(o, d);
  float h = b * b - (dot(o, o) - rb * rb);
  n = vec3(0.0, 0.0, 1.0);
  if (h < 0.0) return -1.0;
  float sq = sqrt(h);
  float tN = -b - sq;
  float tF = -b + sq;
  vec3 nN = (o + d * tN) / rb;
  for (int k = 0; k < ROCK_PLANES; k++) {
    float fk = float(k);
    vec3 pn = normalize(vec3(hash11(seed + fk * 3.1), hash11(seed + fk * 7.7 + 1.3), hash11(seed + fk * 5.3 + 2.9)) - 0.5);
    float pd = r * (0.72 + 0.2 * hash11(seed + fk * 11.3 + 4.1));
    float dn = dot(d, pn);
    float on = dot(o, pn) - pd;
    if (abs(dn) < 1e-8) { if (on > 0.0) return -1.0; continue; }
    float tk = -on / dn;
    if (dn < 0.0) { if (tk > tN) { tN = tk; nN = pn; } } else { tF = min(tF, tk); }
  }
  if (tN > tF || tF < 0.0) return -1.0;
  n = rotAxis(nN, ax, ang);
  return tN;
}

vec3 shadeWater(vec3 p, vec3 n, vec3 rd) {
  float NoV = clamp(dot(n, -rd), 0.0, 1.0);
  float F = WATER_F0 + (1.0 - WATER_F0) * pow(1.0 - NoV, 5.0);
  vec3 refl = envRadiance(reflect(rd, n), WATER_ROUGH, p, n);
  // through the drop: two refractions through a near-sphere ≈ the entry turn taken twice; what the bent ray meets
  // is the planet, shaded with the planet's own mirror
  vec3 bent = normalize(rd + 2.0 * (refract(rd, n, 1.0 / WATER_N) - rd));
  vec3 behind = vec3(0.0);
  float b = dot(p, bent);
  float h = b * b - (dot(p, p) - uCoreR * uCoreR);
  if (h > 0.0 && -b - sqrt(h) > 0.0) {
    vec3 q = p + bent * (-b - sqrt(h));
    vec3 nq = normalize(q);
    behind = fresnelHg(clamp(dot(nq, -bent), 0.0, 1.0)) * envRadiance(reflect(bent, nq), uRoughLiquid, q, nq);
  }
  return F * refl + (1.0 - F) * WATER_TINT * behind;
}

vec3 shadeRock(vec3 p, vec3 n, vec3 rd) {
  float sun = max(dot(n, uSunDir), 0.0);
  float rim = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 3.0);
  // Lambert in sunlight; the grazing rim catches the mirror it floats on
  return ROCK_ALBEDO * (uSunIrr * uExposure * sun + ROCK_AMBIENT) + ROCK_RIM * rim * fresnelHg(0.5) * envRadiance(reflect(rd, n), 0.5, p, n);
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vFar - ro);
  int n = int(uVisN + 0.5);
  vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  // the nearest solid body (water, ember core, rock) …
  float bestT = 1e9;
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  // … and every translucent glow (ember tail, steam, gust, motes), premultiplied
  vec3 gP = vec3(0.0);
  float gA = 0.0;
  float gT = 1e9;
  for (int i = 0; i < NV; i++) {
    if (i >= n) break;
    vec4 V = uVis[i];
    vec4 X = uVisAx[i];
    vec4 K = uVisK[i];
    int kind = int(K.x + 0.5);
    float fade = K.y;
    vec3 c = V.xyz;
    float r = V.w;
    float px = max(length(c - ro) * uPxAngle, 1e-6);
    vec3 nrm;
    float miss;
    if (kind == VIS_DROP || kind == VIS_BEAD) {
      float t = hitEll(ro, rd, c, r, X.xyz, X.w, nrm, miss);
      if (t > 0.0 && t < bestT) {
        vec3 p = ro + rd * t;
        vec3 s = shadeWater(p, nrm, rd);
        // the vapour cushion: a Leidenfrost bead's underside goes dark where it nearly touches
        if (kind == VIS_BEAD) s *= mix(GAP_DARK, 1.0, smoothstep(0.0, 0.5 * r, length(p) - uCoreR));
        bestT = t;
        col = s;
        alpha = fade * clamp(0.5 - miss / px, 0.0, 1.0);
      }
      if (kind == VIS_BEAD) {
        vec3 q = c + X.xyz * (1.8 * r);
        float tq = max(dot(q - ro, rd), 0.0);
        vec3 pq = ro + rd * tq;
        float a = clamp(STEAM_A * fade * gauss(length(pq - q) / (1.6 * r)) * vn3((pq - c) / r * 1.5 - X.xyz * (uTime * 1.2)), 0.0, 1.0);
        gP += STEAM_COL * a; gA = 1.0 - (1.0 - gA) * (1.0 - a); gT = min(gT, tq);
      }
    } else if (kind == VIS_EMBER) {
      vec3 g = visGlow(K.z) * EMBER_GAIN;
      float t = hitEll(ro, rd, c, r, vec3(0.0, 1.0, 0.0), 0.0, nrm, miss);
      if (t > 0.0 && t < bestT) { bestT = t; col = g; alpha = fade * clamp(0.5 - miss / px, 0.0, 1.0); }
      float u, tr;
      float d = raySeg(ro, rd, c, c + X.xyz * X.w, u, tr);
      float a = clamp(0.8 * fade * gauss(d / (EMBER_HALO * r)) * (1.0 - u), 0.0, 1.0);
      gP += g * a; gA = 1.0 - (1.0 - gA) * (1.0 - a); gT = min(gT, tr);
    } else if (kind == VIS_ROCK) {
      float hits = 0.0;
      float tS = 1e9;
      vec3 nS = vec3(0.0, 0.0, 1.0);
      for (int k = 0; k < ROCK_AA; k++) {
        vec2 o = vec2(float(k & 1), float(k >> 1)) - 0.5;
        o = vec2(0.75 * o.x + 0.25 * o.y, 0.75 * o.y - 0.25 * o.x); // rotated grid
        vec3 rk = normalize(rd + (camR * o.x + camU * o.y) * uPxAngle);
        vec3 nk;
        float tk = hitRock(ro, rk, c, r, X.xyz, X.w, K.z, nk);
        if (tk > 0.0) { hits += 1.0; if (tk < tS) { tS = tk; nS = nk; } }
      }
      if (hits > 0.0 && tS < bestT) {
        bestT = tS;
        col = shadeRock(ro + rd * tS, nS, rd);
        alpha = fade * hits / float(ROCK_AA);
      }
    } else if (kind == VIS_GUST) {
      vec3 b = c + X.xyz * X.w;
      float u, tr;
      float d = raySeg(ro, rd, c, b, u, tr);
      float w = d / r;
      float a = clamp(GUST_A * fade * gauss(w) * (1.0 - u) * (0.7 + 0.3 * sin(40.0 * u - 30.0 * uTime)), 0.0, 1.0);
      // chromatic: the bent light splits faintly, warm at the edge, cool at the core
      vec3 sh = GUST_COL * mix(vec3(0.8, 0.9, 1.0), vec3(1.0, 0.9, 0.8), clamp(w, 0.0, 1.0));
      gP += sh * a; gA = 1.0 - (1.0 - gA) * (1.0 - a); gT = min(gT, tr);
      vec3 side = normalize(cross(X.xyz, camU) + vec3(1e-5));
      for (int m = 0; m < MOTES; m++) {
        float fm = float(m);
        vec3 pm = mix(c, b, hash11(K.z + fm * 1.7)) + side * (2.0 * r * (hash11(K.z + fm * 3.1) - 0.5));
        float tm = max(dot(pm - ro, rd), 0.0);
        float am = clamp(fade * gauss(length(ro + rd * tm - pm) / (1.2 * max(tm * uPxAngle, 1e-6))), 0.0, 1.0);
        gP += MOTE_COL * am; gA = 1.0 - (1.0 - gA) * (1.0 - am); gT = min(gT, tm);
      }
    }
  }
  if (alpha <= 0.0 && gA <= 1e-4) discard;
  vec3 gC = gP / max(gA, 1e-6);
  vec3 outC;
  float outA;
  if (alpha > 0.0 && gT < bestT) {          // glow in front of the body
    outA = gA + alpha * (1.0 - gA);
    outC = (gC * gA + col * alpha * (1.0 - gA)) / max(outA, 1e-6);
  } else if (alpha > 0.0) {                 // the body hides any glow behind it
    outA = alpha;
    outC = col;
  } else {
    outA = gA;
    outC = gC;
  }
  vec3 pD = ro + rd * (alpha > 0.0 ? bestT : gT);
  vec4 clip = projectionMatrix * viewMatrix * vec4(pD, 1.0);
  gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);
  // the planet's output stage, so the passes meet without a seam in tone
  vec3 cl = max(outC, 0.0);
  vec3 srgb = mix(cl * 12.92, 1.055 * pow(cl, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), cl));
  float dith = (fract(sin(dot(gl_FragCoord.xy + fract(uTime) * 61.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  fragColor = vec4(srgb + dith, clamp(outA, 0.0, 1.0));
}
`;
  return { vs: DROPLET_VS, fs };
}
```

  - Create `src/terminal/mercury/useVisitorField.js`:

```js
// useVisitorField.js — the visitors' body pass (visitors spec §5.5): its material, mesh ref and per-frame upload.
// MercuryPlanet calls upload() after packVisitors in its own useFrame (a child's useFrame would run first and lag a
// frame). The mirror uniforms and uCoreR ARE the planet material's objects (one source of truth), as in useDropletField.

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { buildVisitorShader, VISITOR_MATERIAL, VISITOR_RENDER_ORDER } from './planet/visitorShader';
import { HG_MIRROR_UNIFORMS } from './planet/hgMirrorGlsl';
import { VISITOR_SLOTS } from './planet/visitorSim';

export default function useVisitorField({ planetMaterial }) {
  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), []);
  const shader = useMemo(() => buildVisitorShader(), []);
  const material = useMemo(() => {
    const vec4s = () => Array.from({ length: VISITOR_SLOTS }, () => new THREE.Vector4());
    const uniforms = {
      uRect: { value: new THREE.Vector4(-1, -1, 1, 1) },
      uVis: { value: vec4s() },
      uVisAx: { value: vec4s() },
      uVisK: { value: vec4s() },
      uVisN: { value: 0 },
      uPxAngle: { value: 1e-3 },
      uTime: { value: 0 },
      uCoreR: planetMaterial.uniforms.uCoreR,
    };
    for (const name of HG_MIRROR_UNIFORMS) uniforms[name] = planetMaterial.uniforms[name];
    return new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: shader.vs, fragmentShader: shader.fs, uniforms, ...VISITOR_MATERIAL });
  }, [shader, planetMaterial]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const meshRef = useRef(null);

  const upload = (frame, tS, pxAngle) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.visible = frame.visible;
    if (!frame.visible) return;
    const u = material.uniforms;
    u.uRect.value.set(frame.rect[0], frame.rect[1], frame.rect[2], frame.rect[3]);
    for (let i = 0; i < frame.n; i++) {
      u.uVis.value[i].fromArray(frame.vis, 4 * i);
      u.uVisAx.value[i].fromArray(frame.ax, 4 * i);
      u.uVisK.value[i].fromArray(frame.k, 4 * i);
    }
    u.uVisN.value = frame.n;
    u.uPxAngle.value = pxAngle;
    u.uTime.value = tS;
  };

  return { geometry, material, meshRef, renderOrder: VISITOR_RENDER_ORDER, upload };
}
```

- [ ] **Step 4: Run the test and confirm it passes.**
  - Run: `npx vitest run src/terminal/mercury/planet/__tests__/visitorShader.test.js`
  - Expected: PASS.
  - GLSL compile is checked live in Task 8 Step 5 (`m.errors()`), because vitest has no GL.

- [ ] **Step 5: Commit.**

```bash
git add src/terminal/mercury/planet/visitorShader.js src/terminal/mercury/useVisitorField.js src/terminal/mercury/planet/__tests__/visitorShader.test.js
git commit -m "feat(mercury): visitors 7 — body pass: water lens on the planet's own mirror, blackbody ember, faceted rock, gust shimmer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Wire it into `MercuryPlanet` and the dev rig

**Files:**
- Modify: `src/terminal/mercury/MercuryPlanet.jsx`, `src/terminal/mercury/mercuryTuning.js`
- Test: `src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js` (append)

**Interfaces:**
- Consumes: everything above.
- Produces:
  - Dev rig `__mercuryTune.strike(phase)`, `.visitTemp(K|null)`, `.visitTime(scale|null)`
  - `window.__mercuryVisitors` (dev)
  - `DEV_OVERRIDES.{ strikeQueue: [], visitTempK: null, visitTimeScale: null }`

- [ ] **Step 1: Write the failing test.** Append to `mercuryPlanetUniforms.test.js`:

```js
describe('visitors wiring', () => {
  it('a strike launches a visitor; the touchdown, not the tap, hits the surface', () => {
    expect(planetSrc).toContain('launchVisitor(vis.buf, phase, vc);');
    expect(planetSrc).toContain('stepVisitors(vis.buf, vc, vis.out);');
    expect(planetSrc).not.toMatch(/strikeDirWorld\(|impactKind\(/);
    expect(planetSrc).toContain('const a = VISITOR_IMPACT[ev.impulse];');
    expect(planetSrc).toContain('stampCrater(scar, ev.dirBody, surf.seed++);');
  });
  it('owns the surface-slot uniforms and gates them on live slots', () => {
    expect(planetSrc).toContain('uVisitOn: { value: 0 },');
    expect(planetSrc).toContain('u.uVisitOn.value = vis.frame.nSurf > 0 ? 1 : 0;');
    for (const n of ['uVisitDir', 'uVisitA', 'uVisitB']) expect(planetSrc).toContain(`u.${n}.value[j].fromArray(`);
  });
  it('mounts the body pass hidden; upload shows it', () => {
    expect(planetSrc).toContain('const visField = useVisitorField({ planetMaterial: material });');
    expect(planetSrc).toContain('<mesh ref={visField.meshRef} geometry={visField.geometry} material={visField.material} renderOrder={visField.renderOrder} frustumCulled={false} visible={false} />');
    expect(planetSrc).toContain('visField.upload(vis.frame, t, pxAngleOf(camera.fov, bufferH));');
  });
  it('a hard release or any hyper flings the residents; an ember on boiling Hg puffs the exosphere', () => {
    expect(planetSrc).toContain('vc.detach = (ds.released && body.omega.length() > DETACH_OMEGA) || DEV_OVERRIDES.breakNow != null || DEV_OVERRIDES.hyperNow != null;');
    expect(planetSrc).toContain("if (ev.phase === 'thermal' && ev.tempK > HG_BOIL_K) vis.exoPuff = EXO_PUFF;");
    expect(planetSrc).toContain('exo.coverage = Math.min(1, boilCoverage(body.tau, body.heatK, u.uSubsolarT.value) + vis.exoPuff);');
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails.**
  - Run: `npx vitest run src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js`
  - Expected: FAIL in "visitors wiring".

- [ ] **Step 3: Implement.**
  - In `mercuryTuning.js`:
    - Replace the `DEV_OVERRIDES` line with:

```js
export const DEV_OVERRIDES = {
  dateMs: null, dropTimeScale: null, breakNow: null, holdOmega: null, hyperNow: null,
  strikeQueue: [], visitTempK: null, visitTimeScale: null, // visitors: rig strikes, touchdown T pin, visitor clock scale
};
```

    - Inside `window.__mercuryTune = { … }`, after `hyperNow(…)`, add:

```js
    // Visitors: launch an element as if its node was tapped; pin the touchdown temperature (null = the live one);
    // scale the visitors' clock (0 freezes them for a look sheet; the impulses keep running on the planet's clock).
    strike(phase = 'fluid') { DEV_OVERRIDES.strikeQueue.push(phase); return `strike ${phase}`; },
    visitTemp(k) { DEV_OVERRIDES.visitTempK = k ?? null; return `visitor touchdown T = ${k ?? 'live'}`; },
    visitTime(scale) { DEV_OVERRIDES.visitTimeScale = scale ?? null; return `visitor time x ${scale ?? 1}`; },
```

  - In `MercuryPlanet.jsx`:
    1. Imports:
       - `import { subsolarTempK } from './planet/mercuryThermal';` → `import { subsolarTempK, HG_BOIL_K } from './planet/mercuryThermal';`
       - The `mercuryImpacts` import becomes:

```js
import {
  IMPACT_MODE_AMP, IMPACT_WAVE_AMP, VISITOR_IMPACT, worldToBody, bodyToWorld, calmGlow,
} from './planet/mercuryImpacts';
```

       - Add:

```js
import {
  createVisitors, createVisitorCtx, createVisitorOut, launchVisitor, stepVisitors, DETACH_OMEGA, EXO_PUFF, EXO_PUFF_S, VISIT_SURF_MAX,
} from './planet/visitorSim';
import { createVisitorFrame, packVisitors } from './planet/visitorFrame';
import useVisitorField from './useVisitorField';
```

    2. In the material's `uniforms`, after `uGlow: …,`, add:

```js
      uVisitOn: { value: 0 },
      uVisitDir: { value: Array.from({ length: VISIT_SURF_MAX }, () => new THREE.Vector4(0, 0, 1, 0)) },
      uVisitA: { value: Array.from({ length: VISIT_SURF_MAX }, () => new THREE.Vector4()) },
      uVisitB: { value: Array.from({ length: VISIT_SURF_MAX }, () => new THREE.Vector4()) },
```

    3. After the line `useEffect(() => { if (import.meta.env.DEV) window.__mercuryDrop = drop; }, [drop]);`, add:

```js
  // Visitors (spec 2026-10-03): the tapped element falls onto the planet and stays a while. Preallocated; idle is free.
  const vis = useMemo(() => ({
    buf: createVisitors(), ctx: createVisitorCtx(), out: createVisitorOut(), frame: createVisitorFrame(),
    view: { vp: new Float32Array(16), p00: 1, p11: 1, wPx: 1, hPx: 1 }, m: new THREE.Matrix4(),
    clock: 0, exoPuff: 0,
  }), []);
  const visField = useVisitorField({ planetMaterial: material });
  useEffect(() => { if (import.meta.env.DEV) window.__mercuryVisitors = vis; }, [vis]);
```

    4. Replace `    exo.coverage = boilCoverage(body.tau, body.heatK, u.uSubsolarT.value);` with:

```js
    exo.coverage = Math.min(1, boilCoverage(body.tau, body.heatK, u.uSubsolarT.value) + vis.exoPuff);
    vis.exoPuff *= Math.exp(-stepS / EXO_PUFF_S);
```

    5. Replace the whole block from `    const queue = strikes?.current;` through the closing `    }` of its `while` loop
       (old lines 497–517) with:

```js
    const queue = strikes?.current;
    let scarDirty = false;
    // Visitors: a strike launches the element; its touchdown (on a later frame) is what reaches the surface.
    const vc = vis.ctx;
    const visScale = DEV_OVERRIDES.visitTimeScale ?? 1;
    vis.clock += stepS * visScale;
    vc.tS = vis.clock; vc.dt = stepS * visScale; vc.calm = calm;
    vc.tau = body.tau; vc.heatK = body.heatK; vc.subsolarT = u.uSubsolarT.value; vc.tempOverrideK = DEV_OVERRIDES.visitTempK;
    vc.q[0] = body.q.x; vc.q[1] = body.q.y; vc.q[2] = body.q.z; vc.q[3] = body.q.w;
    vc.omega[0] = body.omega.x; vc.omega[1] = body.omega.y; vc.omega[2] = body.omega.z;
    vc.cam[0] = surf.cam[0]; vc.cam[1] = surf.cam[1]; vc.cam[2] = surf.cam[2];
    vc.coreR = R_SCENE * drop.coreScale;
    // a hard release flings the residents off (every hyper pins the spin at MAX_OMEGA, past DETACH_OMEGA)
    vc.detach = (ds.released && body.omega.length() > DETACH_OMEGA) || DEV_OVERRIDES.breakNow != null || DEV_OVERRIDES.hyperNow != null;
    const devQ = DEV_OVERRIDES.strikeQueue;
    while ((queue && queue.length > 0) || devQ.length > 0) {
      const phase = queue && queue.length > 0 ? queue.shift() : devQ.shift();
      const node = ORBIT_NODES.find((n) => n.phase === phase);
      if (!node) continue;
      const p = nodeWorldPosition(node.angle, precession);
      vc.nodePos[0] = p[0]; vc.nodePos[1] = p[1]; vc.nodePos[2] = p[2];
      launchVisitor(vis.buf, phase, vc);
    }
    stepVisitors(vis.buf, vc, vis.out);
    for (let k = 0; k < vis.out.nImpacts; k++) {
      const ev = vis.out.impacts[k];
      if (ev.kind === 'crater') {
        stampCrater(scar, ev.dirBody, surf.seed++);
        scarDirty = true;
      } else if (calm) {
        surf.glowT0 = t; // reduced motion: the touchdown brightens the point instead of ringing
        surf.glowDirBody[0] = ev.dirBody[0]; surf.glowDirBody[1] = ev.dirBody[1]; surf.glowDirBody[2] = ev.dirBody[2];
      } else if (ev.kind === 'ring') {
        addImpulse(surf.impulses, { dirBody: ev.dirBody, tS: t, mode: IMPACT_MODE_AMP.ring, wave: IMPACT_WAVE_AMP.ring, kind: 'ring' });
      } else {
        const a = VISITOR_IMPACT[ev.impulse];
        addImpulse(surf.impulses, { dirBody: ev.dirBody, tS: t, mode: a.mode, wave: a.wave, kind: ev.impulse });
        if (ev.phase === 'thermal' && ev.tempK > HG_BOIL_K) vis.exoPuff = EXO_PUFF;
      }
    }
```

    6. Directly after `    field.upload(drop.frame, t);`, add:

```js
    // Visitors' bodies and surface slots (after stepDrop: the core size is this frame's).
    if (vis.buf.live > 0) {
      vis.m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      vis.view.vp.set(vis.m.elements);
      vis.view.p00 = camera.projectionMatrix.elements[0];
      vis.view.p11 = camera.projectionMatrix.elements[5];
      vis.view.wPx = bufferW;
      vis.view.hPx = bufferH;
    }
    packVisitors(vis.buf, vc, vis.view, vis.frame);
    visField.upload(vis.frame, t, pxAngleOf(camera.fov, bufferH));
    for (let j = 0; j < VISIT_SURF_MAX; j++) {
      u.uVisitDir.value[j].fromArray(vis.frame.surfDir, 4 * j);
      u.uVisitA.value[j].fromArray(vis.frame.surfA, 4 * j);
      u.uVisitB.value[j].fromArray(vis.frame.surfB, 4 * j);
    }
    u.uVisitOn.value = vis.frame.nSurf > 0 ? 1 : 0;
```

    7. In the returned JSX, after the droplet field `<mesh … />`, add:

```jsx
      <mesh ref={visField.meshRef} geometry={visField.geometry} material={visField.material} renderOrder={visField.renderOrder} frustumCulled={false} visible={false} />
```

    8. `surf.nodePos` is now unused by the drain. Leave the field (harmless) or delete it from the `surf` memo, whichever
       keeps lint clean. Make sure nothing else still imports `strikeDirWorld`, `localTempK` or `impactKind` into this file.

- [ ] **Step 4: Run the tests, lint and build.**
  - `npx vitest run src/terminal/mercury` — expected: PASS.
  - `npm run lint` — expected: 0 errors, warnings under the limit.
  - `npm test` — expected: PASS (the whole repo).
  - `npm run build` — expected: succeeds.

- [ ] **Step 5: Live check.**
  - Start the dev server with preview_start (`launch.json` name for Vite on 5175; add one if missing:
    `{"name":"vite","runtimeExecutable":"npm","runtimeArgs":["run","dev"],"port":5175}`).
  - Open `/`, open the Mercury tab, then in the console run `__mercuryTune.strike('earth')`.
  - Check `read_console_messages` with `onlyErrors`. Expected: no `PROGRAM NOT RUNNABLE` and no shader compile errors.
  - Then run
    `window.__mercury.gl.info.programs.filter(p => p.diagnostics && !p.diagnostics.runnable).length`.
    Expected: `0`.
  - Idle check: once every visitor has gone, `__mercuryVisitors.buf.live === 0`, `__mercuryVisitors.frame.visible === false`
    and the planet's `uVisitOn` is `0`. Read it via
    `(() => { let o; __mercury.scene.traverse((m) => { if (m.material?.uniforms?.uVisitOn) o = m.material.uniforms.uVisitOn.value; }); return o; })()`.
  - Take a screenshot of a strike mid-flight and after touchdown.

- [ ] **Step 6: Commit.**

```bash
git add src/terminal/mercury/MercuryPlanet.jsx src/terminal/mercury/mercuryTuning.js src/terminal/mercury/__tests__/mercuryPlanetUniforms.test.js
git commit -m "feat(mercury): visitors 8 — wire the visitors: strike → fall → touchdown → impulses / scars / glow / slots / body pass

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Look sheet, live verification, author gates

**Files:**
- Create: `.superpowers/sdd/tools/visitorSheet.mjs`

- [ ] **Step 1: Write the capture script.** Create `.superpowers/sdd/tools/visitorSheet.mjs`:

```js
// Visitors look sheet: each element at touchdown + 0.1 / 1 / 4 / 8 s, water on a cool (film) and a hot (Leidenfrost)
// surface, a 4-tap burst, a fling detach. node visitorSheet.mjs (frames → OUT/vis-<tag>-*.png; prints mkSheet args).
// Needs the dev server on :5175. Ages are on the visitors' own clock (it is frozen for each shot).
import { openMercury, sleep, OUT } from './openMercury.mjs';
const { launch } = await import(new URL('file:///F:/scale_9.4/scripts/cdp.mjs'));
const TAG = process.env.TAG || 'p1';
const T_FLIGHT = { fluid: 0.75, thermal: 0.6, earth: 0.85, air: 0.65 };
const OFFS = (process.env.OFFS || '0.1,1,4,8').split(',').map(Number);
const CASES = [['fluid', 400, 'film'], ['fluid', 600, 'leiden'], ['thermal', 'null', 'fire'], ['earth', 'null', 'earth'], ['air', 'null', 'air']];
const page = await launch({ url: 'about:blank', width: 1600, height: 1000 });
const files = [];
const clock = () => page.eval('window.__mercuryVisitors.clock');
async function shotAt(m, c0, simS, name) {
  while ((await clock()) < c0 + simS) await sleep(15);
  await page.eval('window.__mercuryTune.visitTime(0); 1');
  await sleep(250);
  const f = `${OUT}/vis-${TAG}-${name}.png`;
  await m.shot(f, 420);
  files.push(`${name}=${f}`);
  await page.eval('window.__mercuryTune.visitTime(null); 1');
}
try {
  const m = await openMercury(page);
  await page.waitFor('!!window.__mercuryTune && !!window.__mercuryVisitors', { timeoutMs: 30000, label: 'rig' });
  await m.melt(25);
  await sleep(12000);
  for (const [phase, temp, label] of CASES) {
    await page.eval(`window.__mercuryTune.visitTemp(${temp}); 1`);
    const c0 = await clock();
    await page.eval(`window.__mercuryTune.strike('${phase}'); 1`);
    for (const off of OFFS) await shotAt(m, c0, T_FLIGHT[phase] + off, `${label}+${off}s`);
    await page.eval(`(async () => { while (window.__mercuryVisitors.buf.live > 0) await new Promise((r) => setTimeout(r, 100)); return 1; })()`, { awaitPromise: true });
  }
  await page.eval('window.__mercuryTune.visitTemp(null); 1');
  let c0 = await clock();
  await page.eval("['fluid','thermal','earth','air'].forEach((p) => window.__mercuryTune.strike(p)); 1");
  await shotAt(m, c0, 1.6, 'burst+1s');
  await sleep(9000);
  c0 = await clock();
  await page.eval("window.__mercuryTune.strike('earth'); 1");
  await shotAt(m, c0, 2.5, 'fling-before');
  await page.eval('window.__mercuryTune.breakNow(12); 1');
  await shotAt(m, c0, 2.8, 'fling+0.3s');
  console.log('errors', JSON.stringify(await m.errors()));
  console.log('MKSHEET', files.join(' '));
} finally { await page.close(); process.exit(0); }
```

- [ ] **Step 2: Capture and tile.**
  - With the dev server running: `node .superpowers/sdd/tools/visitorSheet.mjs`
  - Then `node .superpowers/sdd/tools/mkSheet.mjs .superpowers/sdd/tools/out/vis-p1-sheet.png 4 420 <the MKSHEET args>`.
  - Expected: `errors []`.
  - **Look at the sheet yourself before reporting** (memory rule: screenshot before theorising). Check each of these:
    - The drop visibly falls into the strike point.
    - The film shows interference colour, then tears into lenses by +4 s.
    - The Leidenfrost bead has moved by +4 s, with a dark gap line and faint steam.
    - The ember glows, with a clearing ring around it.
    - The rock floats with a meniscus ring.
    - The gust frame shows a dent and downwind ripples.
    - The burst shows 4 coexisting reactions.
    - The fling frame shows the rock leaving the limb.
  - Anything wrong goes to superpowers:systematic-debugging, not to constant-twiddling by guess.

- [ ] **Step 3: Regression spot-checks.**
  - Open `/mercury?calm=1`, strike each element, and confirm: no flight, glow at touchdown, static residents. Use
    `read_console_messages` for errors.
  - Run the existing hyper smoke with `NOSHOT=1 node .superpowers/sdd/tools/hyperSmoke.mjs`. Expected: it still fires,
    gathers and comes home, with no new console errors.

- [ ] **Step 4: Hand to the author.** Send the sheet with SendUserFile. The author's gates (not runnable by an agent):
  - **The look call (socks/∞)** on the sheet, and live on desktop.
  - **Phone gate:** on the OnePlus 9 Pro, `/mercury?perf=1`, a burst of 4 rapid taps (mixed elements). It must hold
    120 fps p50 (phase-4 baseline p50 8.5 ms). If it doesn't, the spec §7 fallback is:
    - phone `visitSlots` drops to 1
    - `shadeWater` skips the re-intersection on phone (env only)

    That fallback is a follow-up commit, not part of this plan.

- [ ] **Step 5: Commit the tool.**

```bash
git add .superpowers/sdd/tools/visitorSheet.mjs
git commit -m "chore(mercury): visitors 9 — look-sheet capture (elements x ages, burst, fling)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Do **not** push. Report the branch state, the sheet and the open author gates.

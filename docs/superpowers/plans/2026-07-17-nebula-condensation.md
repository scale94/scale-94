# Nebula Condensation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** During Mercury phase transitions the particle field physically contracts into the drop (occluded by its silhouette) and the new element's cloud is exhaled back out — the transition becomes one breath.

**Architecture:** `usePhaseTransition` emits a per-phase `phaseCondense` signal (pure envelope, unit-tested). `MercuryCanvas` scales it by `TUNE.condenseBite` and feeds a `condense` prop to the four flows. Each flow's vertex shader contracts its post-sim `pos` by `(1 − c²)` and slims `gl_PointSize`. Motion sims untouched.

**Tech Stack:** React 19, R3F 9, three 0.183, vitest 4. Dev server `scale94-dev` (port 5174).

**Spec:** `docs/superpowers/specs/2026-07-17-nebula-condensation-design.md`

## Global Constraints

- Flow motion sims (turbulence/curl/orbit position logic) untouched — contraction applies to the **post-sim `pos` variable**, never the raw `position` attribute.
- Sphere material, env shader, `BEAT_MS` durations: untouched.
- `condenseBite` is applied in ONE place (`condenseFor` in MercuryCanvas); shaders receive the final value.
- Lint gate: touched files clean under `npx eslint <files> --report-unused-disable-directives --max-warnings 0` (repo-wide baseline is broken — 417 pre-existing errors — and is not your problem).
- Never push. Branch `feature/nebula-condensation`.

---

### Task 0: Branch

- [ ] **Step 1:** `git checkout -b feature/nebula-condensation`
Expected: `Switched to a new branch 'feature/nebula-condensation'`

---

### Task 1: TUNE knobs

**Files:**
- Modify: `src/terminal/mercury/mercuryTuning.js`

**Interfaces:**
- Produces: `TUNE.condenseBite` (1.0), `TUNE.condenseSizeBite` (0.6); `duckActive`/`duckGhost` relaxed. The rig (`KNOBS = Object.keys(TUNE)`) picks new knobs up automatically — verify, don't rebuild.

- [ ] **Step 1: Edit the TUNE table**

In `mercuryTuning.js`, replace the two duck entries and append the condense knobs so the block reads:

```js
  // usePhaseTransition cloud parting (the clouds part for the mirror).
  // Geometry (condensation) does the clearing now; opacity is an accent —
  // per-sprite alpha fights overlap logarithmically (coverage ~ 1-(1-a)^N)
  // and can never empty the sky alone.
  duckActive:   0.10,  // active phase's cloud opacity during the beats
  duckGhost:    0.03,  // ghost phases' opacity during the beats

  // Nebula condensation (the breath): pos *= 1 - c^2 in the flow shaders.
  condenseBite:     1.0,  // max contraction; 0 disables live from the rig
  condenseSizeBite: 0.6,  // sprite slimming en route into the drop
```

(The `0.008`/`0.004` values and their comment lines are replaced.)

- [ ] **Step 2: Gates**

Run: `npx vitest run && npx eslint src/terminal/mercury/mercuryTuning.js --report-unused-disable-directives --max-warnings 0`
Expected: 54 files / 503 tests pass (no test pins duck literals), lint exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/terminal/mercury/mercuryTuning.js
git commit -m "feat(mercury): condensation knobs; opacity ducks relax to accent role"
```

---

### Task 2: The condense envelope (`usePhaseTransition`)

**Files:**
- Modify: `src/terminal/mercury/usePhaseTransition.js`
- Test: `src/terminal/mercury/__tests__/condenseEnvelope.test.js` (new)

**Interfaces:**
- Produces: `condenseEnvelope(beat, easedT) -> number 0..1` (pure, exported); hook return gains `phaseCondense` — object keyed by PHASES, all values equal to the current envelope value (per-phase shape is deliberate spec headroom).

- [ ] **Step 1: Write the failing tests**

Create `src/terminal/mercury/__tests__/condenseEnvelope.test.js`:

```js
// src/terminal/mercury/__tests__/condenseEnvelope.test.js — the breath's
// pure envelope: inhale on consolidating, hold, exhale on emerging.
import { describe, it, expect } from 'vitest';
import { condenseEnvelope } from '../usePhaseTransition';

describe('condenseEnvelope', () => {
  it('idle: 0', () => {
    expect(condenseEnvelope('idle', 0)).toBe(0);
  });

  it('consolidating: rises with eased t (the inhale)', () => {
    expect(condenseEnvelope('consolidating', 0)).toBe(0);
    expect(condenseEnvelope('consolidating', 0.5)).toBe(0.5);
    expect(condenseEnvelope('consolidating', 1)).toBe(1);
  });

  it('elongating and flowing: held at 1 (sky empty, flash owns the frame)', () => {
    expect(condenseEnvelope('elongating', 0.3)).toBe(1);
    expect(condenseEnvelope('flowing', 0.9)).toBe(1);
  });

  it('emerging: falls with eased t (the exhale — launch fast, settle slow)', () => {
    expect(condenseEnvelope('emerging', 0)).toBe(1);
    expect(condenseEnvelope('emerging', 0.5)).toBe(0.5);
    expect(condenseEnvelope('emerging', 1)).toBe(0);
  });

  it('continuity at both seams: idle==consolidating start, emerging end==idle', () => {
    expect(condenseEnvelope('consolidating', 0)).toBe(condenseEnvelope('idle', 0));
    expect(condenseEnvelope('emerging', 1)).toBe(condenseEnvelope('idle', 0));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/terminal/mercury/__tests__/condenseEnvelope.test.js`
Expected: FAIL — `condenseEnvelope` is not exported.

- [ ] **Step 3: Implement**

In `usePhaseTransition.js`:

Add below the existing `easeOut` helper:

```js
// The breath's envelope: how contracted the nebula is (0 = home, 1 = inside
// the drop) for a given beat and its already-eased progress. Pure — exported
// for tests; the hook feeds it the same eased t it uses for opacities.
export function condenseEnvelope(beat, easedT) {
  if (beat === 'consolidating') return easedT;          // inhale
  if (beat === 'elongating' || beat === 'flowing') return 1; // held — flash owns the frame
  if (beat === 'emerging') return 1 - easedT;           // exhale: launch fast, settle slow
  return 0;                                             // idle
}

function condenseAll(value) {
  return Object.fromEntries(PHASES.map(p => [p, value]));
}
```

Wire it through the hook:

1. `anim` initial state gains `phaseCondense: condenseAll(0),` (next to `phaseOpacities`).
2. In the **consolidating** branch, after the opacities assignment:
   `a.phaseCondense = condenseAll(condenseEnvelope('consolidating', t));`
3. In the **elongating** branch add: `a.phaseCondense = condenseAll(1);`
   In the **flowing** branch add: `a.phaseCondense = condenseAll(1);`
   (Those beats don't currently touch opacities, but condense must be explicit —
   the consolidating branch's last write is t≈1 already; the explicit hold keeps
   the envelope's contract visible in the code.)
4. In the **emerging** branch, after the opacities assignment:
   `a.phaseCondense = condenseAll(condenseEnvelope('emerging', t));`
   and inside its completion block (where `a.beat = 'idle'` is set) add
   `a.phaseCondense = condenseAll(0);`.
5. Hook return gains `phaseCondense: a.phaseCondense,`.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run`
Expected: 55 files / 508 tests pass.

- [ ] **Step 5: Lint + commit**

Run: `npx eslint src/terminal/mercury/usePhaseTransition.js src/terminal/mercury/__tests__/condenseEnvelope.test.js --report-unused-disable-directives --max-warnings 0`
Expected: exit 0.

```bash
git add src/terminal/mercury/usePhaseTransition.js src/terminal/mercury/__tests__/condenseEnvelope.test.js
git commit -m "feat(mercury): condense envelope — inhale, hold, exhale on the existing beats"
```

---

### Task 3: Canvas plumbing (`MercuryCanvas`)

**Files:**
- Modify: `src/terminal/mercury/MercuryCanvas.jsx`

**Interfaces:**
- Consumes: `phaseCondense` from Task 2, `TUNE.condenseBite`/`TUNE.condenseSizeBite` from Task 1.
- Produces: each flow receives `condense` (final, bite-applied) and `condenseSizeBite` props (flows implement them in Task 4 — this task may merge-order-depend on Task 4 for the props to exist; passing unknown props to function components is harmless, so Task 3 and 4 are safe in either order).

- [ ] **Step 1: Wire the props**

In `MercuryCanvas.jsx`:

Add to the imports: `import { TUNE } from './mercuryTuning';`

Destructure `phaseCondense` from the `usePhaseTransition('fluid')` call (alongside `phaseOpacities`).

Add beside `opacityFor`:

```js
  // Condensation: bite applied HERE, once — shaders receive the final value.
  const condenseFor = (phase) => phaseCondense[phase] * TUNE.condenseBite;
```

Each of the four flow elements (`ParticleFlow`, `ThermalFlow`, `SedimentFlow`, `AtmosphericFlow`) gains two props:

```jsx
          condense={condenseFor('fluid')}          // ('thermal' / 'earth' / 'air' respectively)
          condenseSizeBite={TUNE.condenseSizeBite}
```

- [ ] **Step 2: Gates**

Run: `npx vitest run` → all pass. `npx eslint src/terminal/mercury/MercuryCanvas.jsx --report-unused-disable-directives --max-warnings 0` → the 5 pre-existing `react/no-unknown-property` errors on the light JSX (lines ~72-74) are the known baseline; NO NEW errors beyond those 5.

- [ ] **Step 3: Commit**

```bash
git add src/terminal/mercury/MercuryCanvas.jsx
git commit -m "feat(mercury): canvas feeds condense signal to the four flows"
```

---

### Task 4: The four flow shaders

**Files:**
- Modify: `src/terminal/fluid/ParticleFlow.jsx`, `src/terminal/thermal/ThermalFlow.jsx`, `src/terminal/earth/SedimentFlow.jsx`, `src/terminal/air/AtmosphericFlow.jsx`

**Interfaces:**
- Consumes: `condense` + `condenseSizeBite` props from Task 3.
- Produces: visual behavior only.

Each file gets the SAME four edits. Apply the contraction to the **post-sim `pos`**, immediately before the `modelViewMatrix` line — NOT to the raw `position` attribute (that would bypass the motion sim). All four points objects sit at the scene origin, so local contraction pulls into the drop; verify while editing that no flow's `<points>` carries a `position` offset (spec §Named risks — if one does, STOP and report BLOCKED with the filename).

**Edit A — vertex shader uniforms:** add to each vertex shader's uniform declarations:

```glsl
uniform float uCondense;
uniform float uCondenseSizeBite;
```

**Edit B — contraction.** Insert directly ABOVE each file's model-view line, and multiply the existing `gl_PointSize` expression. Exact anchors per file:

`ParticleFlow.jsx` (anchor lines currently ~139-140):
```glsl
    // Nebula condensation: contract the post-sim field into the drop.
    // Squared ease = gravity well (slow drift, fast swallow); the sphere's
    // depth buffer occludes arrivals. Applies to pos, NOT the raw attribute.
    pos *= 1.0 - uCondense * uCondense;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (1.5 + aRadius * 2.0) * (300.0 / -mvPosition.z) * (1.0 - uCondense * uCondenseSizeBite);
```

`ThermalFlow.jsx` (anchor ~143-145; the slim factor multiplies AFTER the min so the cap shrinks too):
```glsl
    pos *= 1.0 - uCondense * uCondense;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    float depth  = max(-mvPos.z, 0.5);
    gl_PointSize = min(baseSize * sizeFactor * emberShrink * (80.0 / depth), uPointSizeMax) * (1.0 - uCondense * uCondenseSizeBite);
```

`SedimentFlow.jsx` (anchor ~133-134):
```glsl
    pos *= 1.0 - uCondense * uCondense;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = baseSize * ageFactor * (280.0 / -mvPos.z) * (1.0 - uCondense * uCondenseSizeBite);
```

`AtmosphericFlow.jsx` (anchor ~122-123):
```glsl
    pos *= 1.0 - uCondense * uCondense;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = baseSize * (260.0 / -mvPos.z) * (1.0 - uCondense * uCondenseSizeBite);
```

(Put the three-line comment from the ParticleFlow snippet on the FIRST file only; the other three get a one-liner: `// Nebula condensation — see ParticleFlow.jsx for the physics note.`)

**Edit C — component props + uniform init.** Each component signature gains `condense = 0, condenseSizeBite = 0.6,` (beside `opacityMultiplier = 1`). Each `uniforms` init block (the one containing `uOpacity: { value: opacityMultiplier }`) gains:

```js
          uCondense:         { value: condense },
          uCondenseSizeBite: { value: condenseSizeBite },
```

**Edit D — per-frame feed.** Each `useFrame` uniform block (the one containing `mat.uniforms.uOpacity.value = ...`) gains:

```js
      mat.uniforms.uCondense.value         = condense;
      mat.uniforms.uCondenseSizeBite.value = condenseSizeBite;
```

- [ ] **Step 1:** Apply all four edits to `ParticleFlow.jsx`.
- [ ] **Step 2:** Apply all four edits to `ThermalFlow.jsx`.
- [ ] **Step 3:** Apply all four edits to `SedimentFlow.jsx`.
- [ ] **Step 4:** Apply all four edits to `AtmosphericFlow.jsx`.
- [ ] **Step 5: Gates**

Run: `npx vitest run` → all pass.
Run: `npx eslint src/terminal/fluid/ParticleFlow.jsx src/terminal/thermal/ThermalFlow.jsx src/terminal/earth/SedimentFlow.jsx src/terminal/air/AtmosphericFlow.jsx --report-unused-disable-directives --max-warnings 0`
Expected: no NEW errors vs the same command on the pre-edit files (run it on `git stash`-clean state first to capture the baseline count, then compare — these files may carry pre-existing R3F baseline errors).

- [ ] **Step 6: Commit**

```bash
git add src/terminal/fluid/ParticleFlow.jsx src/terminal/thermal/ThermalFlow.jsx src/terminal/earth/SedimentFlow.jsx src/terminal/air/AtmosphericFlow.jsx
git commit -m "feat(flows): nebula condensation — the field contracts into the drop"
```

---

### Task 5: Verification (controller-executed)

The embedded pane cannot render R3F; verification runs through the established
headless-Chrome CDP harness (controller's scratchpad scripts from the elemental-
mirror pass). Protocol:

- [ ] **Step 1: Chain proof.** Live-trace `uCondense` on all four Points materials
  through a slowed transition (temporary `BEAT_MS` ×10, working tree only,
  reverted after): expect idle `[0,0,0,0]` → held `[1,1,1,1]` (× condenseBite) →
  recovered `[0,0,0,0]`. Same method as the uOpacity trace.
- [ ] **Step 2: Composition proof.** Slow-mo CDP captures: inhale-mid (field
  visibly contracting), hold (sky EMPTY — the claim that motivated this feature),
  exhale-mid (new cloud bursting from the drop), settled. Plus one naked-drop
  capture for the sphere's health.
- [ ] **Step 3: Full-speed captures** at normal BEAT_MS inside the hold window
  (~420ms post-tap) — the sky must read as cleared even at 800ms pace.
- [ ] **Step 4: Hygiene.** BEAT_MS reverted (`git status` clean except intended),
  `npx vitest run` green, rig knobs verified live (`condenseBite: 0` restores
  the old behavior).
- [ ] **Step 5:** Hand to the user for the full-speed eye test. **Never push.**

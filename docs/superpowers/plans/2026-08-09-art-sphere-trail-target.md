# Art Sphere Trail Target Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the frame-to-frame ink accumulation that every layer had while it lived on the 2D canvas, and that each layer silently loses the moment it moves to the GPU — measured at ~1.39× in normal mode and ~3.13× in immersive, where it currently makes the edge graph nearly invisible.

**Architecture:** The 2D canvas is an *accumulator*. Its per-frame `destination-out` erase multiplies existing alpha by `(1 - m)` and everything then draws source-over on top of the survivors, so a layer redrawn at alpha `a` every frame settles at `a / (1 - (1-m)(1-a))`, not `a`. GL layers draw into a target that is fully rewritten each frame, so they settle at `a`. This plan adds a ping-pong accumulation target inside the existing offscreen `NoColorSpace` sRGB chain: each frame the previous accumulator is faded by `(1 - m)` and the migrated layers draw over it in sRGB, exactly as the canvas did. The screen pass then samples the accumulator instead of the backdrop directly.

**Tech Stack:** react-three-fiber 9.5, three 0.183, @react-three/postprocessing 3.0.4, Vitest 4, CDP harness (`scripts/artBaseline.mjs`, `artCompare.mjs`, `artSmoke.mjs`, `artPresence.mjs`).

## Global Constraints

- **IMMERSIVE IS THE EXHIBIT MODE** (author, 2026-08-09). The Ars Electronica installation runs immersive. Weight every parity judgement toward `immersive-on`, not `idle`. This inverts the working assumption of steps 1–3. A regression visible only in immersive is a blocking regression.
- **Faithful parity first. Do not re-art.** If a layer looks better after a change, that is a bug until the author says otherwise.
- **Projection, depth sort and hit-testing stay on the CPU.** Edge hit-testing reads projected screen coordinates from `ArtTab.jsx`. Do not touch it.
- **Everything in the offscreen chain blends in sRGB byte space.** All targets are `RGBAFormat` / `UnsignedByteType` / `THREE.NoColorSpace`, and the single `srgbToLinear` conversion stays where it is, on the finished pixel in the screen pass. **Doing the feedback blend in linear is the step-3 trap wearing a new hat, and it will pass the gate**: the precedent scored 1.285 against a threshold of 4 while individual cells nearly doubled.
- **Never run vitest with `-u` / `--update`.**
- **Do not push. Do not merge.** The author decides.
- **Never `git add -A`.** Each task commits only its own named files. Never commit anything under `baseline/`.
- Commit trailer: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- Gates, all of which must pass before any commit:
  - `npx vitest run` — **1025 tests / 108 files**
  - `npm run lint` — 0 errors, warnings ≤ 153 (currently 145; **a new warning is yours, fix it, do not raise the ratchet**)
  - `npm run build`
  - `node scripts/artSmoke.mjs` — 10/10
  - `node scripts/artPresence.mjs` — 4/4
- `ArtTab.jsx` cannot be mounted in jsdom. Unit tests cover extracted pure modules only and are **not** parity evidence.

## The numbers this plan exists to restore

`ArtTab.jsx:797-799` erases with `destination-out` and `rgba(0,0,0,tint.a)`. `tint.a` comes from `riftTint()` in `src/terminal/art/artBackground.js:56`:

| | `RIFT_ALPHA_*` (`m`) | survives per frame `(1-m)` | small-`a` gain `1/m` |
|---|---|---|---|
| normal | `RIFT_ALPHA_NORMAL = 0.72` | 0.28 | **1.389×** |
| immersive | `RIFT_ALPHA_IMMERSIVE = 0.32` | 0.68 | **3.125×** |

Steady state for a layer redrawn at alpha `a` every frame:

```
A = a / (1 - (1-m)(1-a))
```

The independently measured edge deficits — ~78% of canvas ink in normal, ~3.1× in immersive — match `1/0.72 = 1.389` and `1/0.32 = 3.125` to two decimals. The mechanism is not in doubt. **What is in doubt is which layers are affected**, which is Task 1.

## The gate, and why it cannot see this

`artCompare.mjs` thresholds a 32×18 (576-cell) mean-luminance signature at 4.0. Thin lines occupy a small fraction of a cell, so a 22% ink loss on the edges dilutes to well under one unit of cell mean — it scored **21/21 green** on a change that removed a fifth of the ink. The signed cell counts did register it (more negative than positive cells in 15 of 18 meaningful rows) but nothing thresholds on that.

**Two consequences, both binding on every task here:**

1. **Report the mean signed delta and the ± cell balance, never magnitude alone.**
2. **The comparator cannot approve this work.** Ink measurement against the pre-migration 2D reference is the evidence. Build the instrument first (Task 1), then trust it.

The boot fingerprint is **not deterministic** (8 relaunches, 8 distinct fingerprints), so comparing against a committed baseline measures code change plus boot race, inseparably. Standard procedure, per the author:

```bash
git stash push -- <only the files this task changed>
node scripts/artBaseline.mjs --out baseline/ctrl
git stash pop
node scripts/artBaseline.mjs --out baseline/wip
node scripts/artCompare.mjs baseline/ctrl baseline/wip     # the gate
```

Noise floor is ~±0.25. `immersive-off` states are blank frames and prove nothing — discount them explicitly every time.

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/artInk.mjs` | **Create.** The measuring instrument: steady-state ink per layer group, per mode, against a reference capture set. Task 1's deliverable and the only real gate for Tasks 3–5. |
| `src/terminal/art/artTrail.js` | **Create.** Pure. The fade arithmetic — `trailSurvival(m)`, `steadyState(a, m)`, `fadeGain(m)` — lifted from `riftTint`/the clear so the GL and 2D versions cannot drift. |
| `src/terminal/art/__tests__/artTrail.test.js` | **Create.** Unit tests for the above. |
| `src/terminal/art/SphereTrail.js` | **Create.** The ping-pong accumulation targets, the fade pass, and their lifecycle. Imperative, like `SphereEdges.js` — it lives outside r3f's scene graph. |
| `src/terminal/art/SphereComposite.jsx` | **Modify.** Own the accumulator, drive the fade + layer passes in the right order, and point the screen pass at the accumulator. |
| `src/terminal/views/ArtTab.jsx` | **Modify.** Publish `tint.a` (the erase alpha) into the GL state so the fade uses the real per-mode value rather than a copy. |
| `scripts/artPresence.mjs` | **Modify.** Add a steady-state accumulation check — the layer is invisible to the comparator by construction. |

---

### Task 1: `artInk.mjs` — build the instrument before touching the render path

**Do this first and commit it separately.** Every later task in this plan is gated on numbers this script produces, and the project's recurring failure is trusting an instrument that was never validated. This task changes no rendering code at all.

`baseline/art-sphere-2d/` is the **pre-migration 2D reference** — captured when every layer still lived on the canvas and therefore still accumulated. It is the ground truth for what the sphere is supposed to look like.

**Files:**
- Create: `scripts/artInk.mjs`

**Interfaces:**
- Produces: `node scripts/artInk.mjs <refDir> <newDir>` printing, per state and per mode, total ink, ink inside the sphere disc, and a ratio `new/ref`; exit 0 always (it is a measuring tool, not a gate).
- Consumes: `scripts/_png.mjs` (dependency-free PNG decode, already used by `artCompare.mjs`).

- [ ] **Step 1: Read how the comparator decodes and where the sphere is.** Read `scripts/artCompare.mjs` and `scripts/_png.mjs`. Reuse their decode path exactly — do not write a second PNG decoder.

- [ ] **Step 2: Define "ink" and justify it in a comment.** Ink is summed luminance above the local background, not mean luminance — the mean is what hid the edge deficit. Compute per image:

```js
// Ink: total luminance above a floor, summed over pixels. A MEAN over the
// frame is what let a 22% edge loss score 21/21 green — thin lines occupy a
// few percent of any cell, so averaging destroys exactly the signal we need.
// Summing preserves it: half as much ink is half the number.
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const FLOOR = 6;              // below this is capture noise on a black field
let ink = 0, lit = 0;
for (const px of pixels) {
  const L = lum(px.r, px.g, px.b);
  if (L > FLOOR) { ink += L - FLOOR; lit++; }
}
```

Report `ink`, `lit` (pixel count above floor) and `ink/lit` (mean brightness of lit pixels) separately. The three answer different questions: a layer that lost accumulation loses `ink` and `ink/lit` while keeping `lit` roughly constant; a layer that was deleted loses `lit` too.

- [ ] **Step 3: Add a disc mask.** Everything that matters is inside the sphere. Take the sphere centre as the image centre and the radius from the reference manifest if present, else `0.42 * min(w, h)`. Report ink both whole-frame and disc-only, because labels sit outside the disc and would otherwise dilute the reading.

- [ ] **Step 4: Print a table keyed by state, flagging the modes.** One row per capture state, columns `ink_ref`, `ink_new`, `ratio`, `lit_ref`, `lit_new`, `meanLit_ref`, `meanLit_new`. Mark `immersive-on` rows clearly — that is the exhibit mode and the row that matters most. Mark `immersive-off` rows as `(blank — proves nothing)`.

- [ ] **Step 5: Validate the instrument against a known answer.** Run it against a reference set compared with itself:

```bash
node scripts/artInk.mjs baseline/art-sphere-2d baseline/art-sphere-2d
```

Expected: every ratio exactly `1.000`. **If it is not 1.000, the instrument is wrong — fix it before believing anything else it says.** This is not a formality: the step-3 comparator was measuring the wrong image entirely and nobody noticed until a provable identity scored mean 6.3.

- [ ] **Step 6: Measure the actual deficit and record it.** Capture the current code and compare against the pre-migration reference:

```bash
node scripts/artBaseline.mjs --out baseline/wip
node scripts/artInk.mjs baseline/art-sphere-2d baseline/wip
```

Write the full table into `.superpowers/sdd/trail-deficit.md` with a plain-language reading. **The question this answers, and the reason the task exists: did the step-3 BACKGROUND layers lose accumulation too, or only the edges?** The wireframe is alpha 0.03 and the glows are all small-alpha, which is exactly where `1/m` amplification is largest — so the hypothesis is that they did and the comparator could not see it. Steps 1–3 of this project were all signed off against that comparator.

State the answer explicitly as one of:
- *Edges only* — Tasks 3 and 4 route the edge layer alone.
- *Edges and backdrop* — Task 4 routes the backdrop too, and step 3's "verified" status needs a correction recorded in the spec.
- *Neither / something else* — **stop and escalate to the author.** If the numbers do not match `1.389` and `3.125`, the model in this plan is wrong and building on it would be building on a guess.

Note the confound and control for it: `baseline/art-sphere-2d` predates the real-bloom change of step 2, so absolute ink differs for reasons that have nothing to do with trails.

> **CORRECTION, applied after Task 1 ran.** This step originally said to compare the ratio between modes and expect them to differ by `3.125/1.389 = 2.25×`. **That criterion was mis-derived and must not be used.** It assumes the migrated layers are 100% of frame ink; they are ~10–20% of it, so a per-layer 3.125× loss surfaces as a 7–14% total drop — a cross ratio around 0.86–0.93. The real captures measured 0.92 and 0.86, which *confirms* the model rather than refuting it. The tests that actually settled it were: per-luminance-band histograms (the loss sits in the faintest band and its mass reappears below the floor — dimming with mass conserved, not deletion), the mode asymmetry (identical commit, nothing in normal mode), and a radial profile against each layer's known footprint.

**ANSWER, measured: *edges and backdrop*.** Step 3's background layers lost accumulation too. Isolating the step-3 commit alone (bloom on both sides, so it cancels), immersive-on loses **44% of its lit pixels** against a ±3% noise floor, entirely in the faintest band, with the mass reappearing sub-floor — and nothing at all happens in normal mode.

The **wireframe is positively confirmed** from its own constants, not by correlation: `WIRE_ALPHA = 0.03` white accumulates to `0.03 / (1 − 0.68 × 0.97) = 0.0881` at `m = 0.32` — luminance 22.5 — and lands at 7.65 without accumulation, predicting a drop of ~14.8 on a thin locus at exactly `r = sphereR`. Measured in the 0.85–1.05 annulus: **2207 pixels down by >15, against 207 in an identical-code noise pair**; 574 vs 12 down by >30.

The competing hypothesis was excluded on the same data: the spectral ambient is immersive-only, so a too-dim port of that one layer predicts the same signature. But `1.2 < r/sphereR < 1.6` is the ambient's exclusive territory (beat stops at 1.23, wireframe at 1.0, ghosts ≤1.0) and the loss there is `+0.032 / −0.005 / −0.007 / −0.012` luminance with **zero** pixels dropped by more than 5. The loss is also non-monotonic — it peaks at 0.9–1.0 where the ambient's own shape is down to 0.25 — so no single gradient explains it.

**Residuals, explicitly not closed:** this confirms the wireframe and excludes the ambient; it does *not* individually confirm all six background layers. A mis-ported beat pulse covers 0–1.23 and is excluded only by shape, not footprint. Genesis, exergy and flash were inactive in these frames, so the measurement says nothing about them either way.

- [ ] **Step 7: Commit**

```bash
git add scripts/artInk.mjs
git commit -m "feat(art): measure steady-state ink per layer group"
```

---

### Task 2: `artTrail.js` — the fade arithmetic, extracted and tested

Pure module, real unit tests, no rendering. Same reason `artEdges.js` went first in step 4: extracting the numbers before writing shaders is what stops the GL version drifting from the 2D code it replaces.

**Files:**
- Create: `src/terminal/art/artTrail.js`
- Test: `src/terminal/art/__tests__/artTrail.test.js`

**Interfaces:**
- Consumes: `RIFT_ALPHA_NORMAL`, `RIFT_ALPHA_IMMERSIVE` from `./artBackground`.
- Produces:
  - `trailSurvival(m) => number` — `1 - m`, the fraction of existing ink surviving one frame
  - `steadyState(a, m) => number` — `a / (1 - (1-m)(1-a))`
  - `fadeGain(m) => number` — `steadyState(a, m) / a` in the small-`a` limit, i.e. `1 / m`

- [ ] **Step 1: Write the failing test**

```js
// artTrail.test.js — the arithmetic behind the GL trail accumulator.
//
// The 2D canvas erases alpha by `m` each frame and redraws over the
// survivors, so a layer drawn at alpha `a` settles ABOVE `a`. Any layer that
// moves to the GPU loses this unless the GPU reproduces it. Measured on the
// edges: ~1.39x normal, ~3.13x immersive — which is exactly 1/m.

import { describe, it, expect } from 'vitest';
import { trailSurvival, steadyState, fadeGain } from '../artTrail';
import { RIFT_ALPHA_NORMAL, RIFT_ALPHA_IMMERSIVE } from '../artBackground';

describe('trailSurvival', () => {
  it('is the complement of the erase alpha', () => {
    expect(trailSurvival(0.72)).toBeCloseTo(0.28, 10);
    expect(trailSurvival(0.32)).toBeCloseTo(0.68, 10);
  });
});

describe('steadyState', () => {
  it('is a fixed point: feeding it back reproduces itself', () => {
    // The definition, stated independently of the closed form: fade the
    // steady state and draw `a` over it, and you must land on it again.
    for (const m of [0.72, 0.32, 0.5]) {
      for (const a of [0.03, 0.2, 0.6]) {
        const A = steadyState(a, m);
        const next = a + A * (1 - m) * (1 - a);
        expect(next).toBeCloseTo(A, 10);
      }
    }
  });

  it('never exceeds 1, even for a slow fade and a strong layer', () => {
    expect(steadyState(0.9, 0.01)).toBeLessThanOrEqual(1);
    expect(steadyState(1, 0.01)).toBeCloseTo(1, 10);
  });

  it('is the identity when the erase is total', () => {
    // m = 1 wipes everything, so there is nothing to accumulate onto.
    expect(steadyState(0.3, 1)).toBeCloseTo(0.3, 10);
  });
});

describe('fadeGain', () => {
  it('reproduces the two measured deficits', () => {
    // These are the whole reason this module exists. 1/0.72 and 1/0.32 are
    // the ~1.4x and ~3.1x measured off the real render.
    expect(fadeGain(RIFT_ALPHA_NORMAL)).toBeCloseTo(1.389, 3);
    expect(fadeGain(RIFT_ALPHA_IMMERSIVE)).toBeCloseTo(3.125, 3);
  });

  it('shows immersive accumulates 2.25x harder than normal', () => {
    const ratio = fadeGain(RIFT_ALPHA_IMMERSIVE) / fadeGain(RIFT_ALPHA_NORMAL);
    expect(ratio).toBeCloseTo(2.25, 2);
  });

  it('agrees with steadyState in the small-alpha limit', () => {
    const m = 0.32, a = 1e-4;
    expect(steadyState(a, m) / a).toBeCloseTo(fadeGain(m), 3);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/terminal/art/__tests__/artTrail.test.js
```

Expected: FAIL, `Failed to resolve import "../artTrail"`.

- [ ] **Step 3: Implement `artTrail.js`.**

```js
// artTrail.js — the arithmetic of the 2D canvas's trail accumulation.
//
// ArtTab's draw loop clears with `destination-out` and rgba(0,0,0,m), which
// multiplies existing alpha by (1 - m) rather than wiping it. Everything then
// draws source-over on the survivors, so a layer redrawn every frame settles
// well above the alpha it is drawn with. A layer that moves to the GPU draws
// into a target that IS fully rewritten each frame and silently loses this.
//
// m comes from riftTint() and is per-mode: 0.72 normal, 0.32 immersive. The
// immersive value is the one that matters — it is the exhibit mode, and 1/0.32
// is why the edges nearly vanished there when they moved to GL.

/** Fraction of existing ink that survives one frame's erase. */
export function trailSurvival(m) {
  return 1 - m;
}

/** Steady-state alpha of a layer redrawn at alpha `a` every frame. */
export function steadyState(a, m) {
  const denom = 1 - trailSurvival(m) * (1 - a);
  return denom <= 0 ? 1 : Math.min(1, a / denom);
}

/** Steady-state gain in the small-alpha limit — the headline number, 1/m. */
export function fadeGain(m) {
  return m <= 0 ? Infinity : 1 / m;
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
npx vitest run src/terminal/art/__tests__/artTrail.test.js
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/art/artTrail.js src/terminal/art/__tests__/artTrail.test.js
git commit -m "feat(art): extract the trail accumulation arithmetic"
```

---

### Task 3: the accumulator pipeline, accumulating nothing

**Do this before routing any layer through it.** This is the risky architectural change, and doing it with zero layers routed means a parity failure has exactly one candidate cause. This is the ordering step 3's plan got wrong and step 4's plan got right; keep it.

At the end of this task the render must be **pixel-identical to today**, because the accumulator is built, ping-ponged and sampled, but the fade is set to wipe (`survival = 0`), which makes it a pass-through.

**Files:**
- Create: `src/terminal/art/SphereTrail.js`
- Modify: `src/terminal/art/SphereComposite.jsx`

**Interfaces:**
- Consumes: `trailSurvival` from `./artTrail`.
- Produces:
  - `createTrail()` → `{ targets: [rtA, rtB], fadeMesh, fadeUniforms, read, write, swap(), setSize(w, h), dispose() }`
  - `renderTrailFade(gl, trail, survival)` — draws `read` into `write` scaled by `survival`, leaving `write` bound.

- [ ] **Step 1: Build the ping-pong targets.** Two `THREE.WebGLRenderTarget`s, both `RGBAFormat`, `UnsignedByteType`, `depthBuffer: false`, `stencilBuffer: false`, and **`texture.colorSpace = THREE.NoColorSpace` on both**. Size both from the drawing buffer (`gl.domElement.width/height`), reconciled per frame exactly as `createBackdrop` already does — `setSize` early-exits when dimensions match, so the check is two integer compares.

**Tagging either target `SRGBColorSpace` re-creates the step-3 blend bug.** The sampler would decode on read, the feedback would compound in linear space, and the result would be systematically brighter — and it would pass the threshold.

- [ ] **Step 2: Write the fade pass.** A fullscreen quad that reads `read` and writes it back scaled. Straight multiply in sRGB byte space, no conversion:

```glsl
precision highp float;
uniform sampler2D uPrev;
uniform float uSurvival;    // 1 - m; 0 makes this a wipe
varying vec2 vUv;
void main() {
  // Raw sRGB values in, raw sRGB values out. The 2D canvas faded in byte
  // space and so does this. Converting here is the step-3 trap.
  vec4 prev = texture2D(uPrev, vUv);
  gl_FragColor = vec4(prev.rgb, prev.a) * uSurvival;
}
```

Material: `depthTest: false`, `depthWrite: false`, `toneMapped: false`, `blending: THREE.NoBlending` — this pass **replaces** the destination, it does not blend with it.

- [ ] **Step 3: Wire it into the frame, as a pass-through.** In `SphereComposite.jsx`'s backdrop `useFrame`, before the existing backdrop render: swap the ping-pong, render the fade into `write` with `survival` hard-coded to `0.0`, then render the backdrop scene into `write` as it currently renders into the backdrop target. The screen pass samples `trail.write.texture` instead of `backdrop.target.texture`.

With `survival = 0` the fade writes black and the backdrop then paints over all of it, so the output is identical to today. That is the point: **this commit must measure as identity.**

- [ ] **Step 4: Verify identity.**

```bash
git stash push -- src/terminal/art/SphereTrail.js src/terminal/art/SphereComposite.jsx
node scripts/artBaseline.mjs --out baseline/ctrl
git stash pop
node scripts/artBaseline.mjs --out baseline/wip
node scripts/artCompare.mjs baseline/ctrl baseline/wip
node scripts/artInk.mjs baseline/ctrl baseline/wip
```

Expected: comparator 21/21 with means at the noise floor and a signed mean near zero, **and `artInk` ratios of 1.00 ± 0.02 on every non-blank state.** The ink instrument is the stronger check here and it is why Task 1 came first.

- [ ] **Step 5: Confirm the presence suite still passes.** Every background layer now routes through one more target; if it is misconfigured they fail together.

```bash
node scripts/artPresence.mjs
```

Expected: 4/4 RENDERS.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/art/SphereTrail.js src/terminal/art/SphereComposite.jsx
git commit -m "feat(art): add a ping-pong accumulation target, fading to nothing"
```

---

### Task 4: publish the real erase alpha and turn the fade on

**Files:**
- Modify: `src/terminal/views/ArtTab.jsx`, `src/terminal/art/SphereComposite.jsx`, `src/terminal/art/SphereTrail.js`

The fade must use the **same** `m` the 2D canvas used on the same frame, read from the same place, not a second copy of the constant. `ArtTab.jsx:794` already computes `const tint = riftTint(metabolicRift, immersiveRef.current)` and publishes `tint` to `bgStateRef.current.rift`. The alpha is on that object and is currently ignored by the GL side.

- [ ] **Step 1: Publish it.** `bgStateRef.current.rift` already carries `.a`. Confirm by reading `syncBackgroundUniforms` in `SphereBackground.js` — it reads `rift.r/g/b` and drops `.a`. Do not add a second field; read `state.rift.a` where the fade is driven.

- [ ] **Step 2: Drive the fade from it.** Replace the hard-coded `0.0` with `trailSurvival(state.rift.a)`. Guard the first frame, before any state is published, with `survival = 0` — a wipe — rather than a default constant. **A wrong default here is a silently wrong brightness, and it will pass the threshold.**

- [ ] **Step 3: Route both the edge layer and the backdrop layers into the accumulator.** Task 1 measured *edges and backdrop*, so this is settled — see its ANSWER block above. The correction to step 3's "verified" record is part of this commit's message.

**But the rift base colour must NOT accumulate, and this is the subtlety that will bite.** `sphereBackground()` starts from `vec3 col = uRift` and then composites layers over it. `uRift` is not a layer — it is the clear colour, the thing the canvas's semi-transparent fill both faded *and* repainted every frame. Feeding it through the accumulator would compound the background itself by `1/m` and wash the whole frame out, which no gate here would catch as anything other than "brighter".

So split the backdrop shader's output: the rift base is written fresh each frame as the accumulator's floor, and only the layers above it accumulate. Concretely, the accumulator holds *ink over the rift*, and the fade multiplies that ink, not the base. Verify this specifically — a frame with every layer inactive (normal mode, no beat, no flash) must be **exactly** the rift colour, unchanged from today, at every pixel. If it drifts brighter over the first 40 frames, the base is accumulating.

- [ ] **Step 4: Gate it, ink first.**

```bash
git stash push -- src/terminal/views/ArtTab.jsx src/terminal/art/SphereComposite.jsx src/terminal/art/SphereTrail.js
node scripts/artBaseline.mjs --out baseline/ctrl
git stash pop
node scripts/artBaseline.mjs --out baseline/wip
node scripts/artInk.mjs baseline/art-sphere-2d baseline/wip     # THE gate: vs the pre-migration 2D truth
node scripts/artInk.mjs baseline/ctrl baseline/wip              # what this commit changed
node scripts/artCompare.mjs baseline/ctrl baseline/wip
```

Expected: ink ratio against `baseline/art-sphere-2d` moves toward 1.0 on the routed layers, **and the immersive rows move furthest** — they had the most to regain. The comparator will legitimately go over threshold on `immersive-on`; that is the change working, not failing. Record the numbers.

- [ ] **Step 5: Look at it.** Open `baseline/wip/*__immersive-on.png` and `baseline/art-sphere-2d/*__immersive-on.png` side by side at full size. The edge graph must be readable again. **A number that says 1.0 while the picture is wrong means the instrument is wrong** — this project has been there four times.

- [ ] **Step 6: Commit** with the ink table and the routing decision in the message.

---

### Task 5: presence check, cost, and the record

**Files:**
- Modify: `scripts/artPresence.mjs`, `docs/superpowers/specs/2026-08-04-art-sphere-webgl-design.md`, `.superpowers/sdd/progress.md`

- [ ] **Step 1: Add a steady-state accumulation presence check.** The comparator cannot see this layer, so it needs a bespoke check like the five before it. Measure the thing that is actually distinctive: **ink must RISE over the first frames after a reset and then settle**, which a non-accumulating render cannot do.

```
__artHarnessReset()          // pins rotation to rx=0.18, ry=0
measure ink at frame 1
pump ~30 frames
measure ink at frame 30
assert ink(30) / ink(1) is within 15% of fadeGain(m) for the current mode
```

**Compute the expected magnitude before choosing the metric.** A mean over the sphere disc was 65× too coarse for the ghost trails and reported a working layer as broken. Run it in immersive, where the expected ratio is 3.125 and the signal is largest.

- [ ] **Step 2: Run the full presence suite.** `node scripts/artPresence.mjs` — expect 5/5.

- [ ] **Step 3: Measure frame time**, headed on the real GPU:

```bash
node scripts/artFrameTime.mjs --seconds 10 --out baseline/art-sphere-trail
```

Compare against step 3's idle p50 2.1 ms / p95 11.9 ms / p99 15.4 ms. This adds a ping-pong target and one more full-screen pass per frame, which is a real cost. **If p99 crosses the 16.7 ms budget, say so plainly rather than explaining it away** — the fallback is to fold the fade into the backdrop shader's first instruction instead of a separate pass, which costs a texture read but no extra bind.

- [ ] **Step 4: Capture the reference.** `artBaseline.mjs` pins a boot fingerprint per manifest, so capture fresh to `baseline/art-sphere-trail`; do not overwrite step 3's.

- [ ] **Step 5: Record** in `baseline/art-sphere-trail/README.md`, the spec, and `.superpowers/sdd/progress.md`: the ink tables, the cost delta, the routing decision and why, **and — if Task 1 found the backdrop also lost accumulation — an explicit correction to step 3's "verified" status**, because that would mean three signed-off steps were measured with an instrument blind to this class of error.

---

## Self-review notes

- **Spec coverage.** The spec's step 6 lists "particles and the trail feedback buffer"; this plan pulls the trail feedback buffer forward on the author's instruction and leaves particles in step 6. Everything else in step 6 is untouched.
- **Deliberately not covered.** Pulse rings, the resonance edge and the prism chords (step 4 Tasks 4–6, resumed after this); nodes (step 5); particles (step 6).
- **Risk 1 — the routing decision is genuinely undetermined.** Task 4 Step 3 branches on Task 1's measurement, and the plan cannot resolve it in advance without guessing. That is deliberate: guessing here means either leaving the edges dim or brightening the whole backdrop by `1/m`, and both would pass the comparator. If Task 1's numbers do not match the model, Task 1 Step 6 says stop and escalate — take that seriously.
- **Risk 2 — 8-bit feedback quantisation.** A ping-pong accumulator reads its own 8-bit output every frame, so quantisation error compounds rather than staying bounded. At `survival = 0.68` a value decays to zero in ~40 frames regardless, so the error cannot accumulate indefinitely, but faint layers (the wireframe is alpha 0.03) may band or die early. The existing OLED-banding backlog is the same population. If Task 4 Step 5's visual check shows banding in the faint layers, the fix is `HalfFloatType` on both targets with `NoColorSpace` unchanged — it satisfies the no-sRGB-decode requirement identically at full precision, and it is a one-token change.
- **Risk 3 — the accumulator holds ink from before a resize.** `setSize` on a render target does not preserve contents, so a resize wipes the trail. That is correct behaviour (the 2D canvas also loses its contents on resize) and needs no handling, but do not "fix" it.
- **Risk 4 — mode changes mid-run.** `m` jumps from 0.72 to 0.32 the moment immersive toggles, and the accumulator will take ~40 frames to settle to the new steady state. The 2D canvas did exactly the same thing, so this is faithful. Do not smooth it.

# Art Sphere Step 3 — Background Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the bottom six layers of the sphere off Canvas2D and onto the GPU, beneath the 2D layer: genesis glow, state flash grid, spectral ambient, sphere wireframe ghost, temporal ghost trails, and the ambient beat pulse.

**Architecture:** `SphereComposite` gains a second scene rendered *before* the 2D quad. The 2D canvas's clear becomes a `destination-out` transparent decay so the GL background shows through it. Projection, depth sort and hit-testing stay on the CPU — the background layers are screen-space or take already-projected coordinates as uniforms.

**Tech Stack:** react-three-fiber 9.5, three 0.183, @react-three/postprocessing 3.0.4, Vitest 4, CDP harness (`scripts/artBaseline.mjs` + `scripts/artCompare.mjs`).

## Global Constraints

- **Projection, depth sort and hit-testing stay on the CPU.** 272 nodes is a trivial per-frame upload. Moving projection into a vertex shader renders fine while every interaction silently dies.
- **Faithful parity first, locked as a fallback, then push.** Do not re-art.
- Bloom always on; immersive keeps Voronoi + spectral ambient + vignette.
- Each migrated layer becomes its own module under `src/terminal/art/`.
- **Never run vitest with `-u` / `--update`.**
- **Do not push.** The author decides.
- Gates: `npx vitest run` (976 tests / 106 files), `npm run lint` (0 errors, warnings ≤ 153), `npm run build`.
- `ArtTab.jsx` cannot be mounted in jsdom. Unit tests cover extracted pure modules only and are **not** parity evidence.

## The gate

Reference: `baseline/art-sphere-step2/` (captured with GL live). Compare with:

```bash
node scripts/artBaseline.mjs --out baseline/art-sphere-step3
node scripts/artCompare.mjs baseline/art-sphere-step2 baseline/art-sphere-step3
```

Threshold 4.0 on a 32×18 mean-luminance signature; measured noise floor is under 2. Read `baseline/art-sphere-step2/README.md` before trusting a result — it documents why the gate is a tolerance and not a hash, and which state (`immersive-off`) proves nothing because it is blank.

**This step legitimately changes pixels.** Unlike step 2, parity here means *looks the same*, not *is the same*: the layers are being re-implemented on the GPU. Expect to iterate on the comparator output and to look at PNGs. A state going *over* threshold is a prompt to look, not an automatic failure — but you must look, and say which it was.

**Known temporary state:** two trail decays coexist from step 3 to step 6 (the GL background's own history buffer and the 2D canvas's `destination-out` fade) and must be tuned to match. This resolves itself at step 6.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/terminal/art/artBackground.js` | **Create.** Pure. Per-layer parameters and the decay/alpha maths lifted verbatim from the draw loop, so they can be unit-tested and so the GL and 2D versions provably share one source of truth. |
| `src/terminal/art/__tests__/artBackground.test.js` | **Create.** Unit tests for the above. |
| `src/terminal/art/SphereBackground.jsx` | **Create.** The GL background: a fullscreen shader quad drawing genesis glow, flash grid, spectral ambient, wireframe ghost, ghost trails and beat pulse from uniforms. |
| `src/terminal/art/SphereComposite.jsx` | **Modify.** Render `SphereBackground` before the 2D quad; give the 2D quad `transparent` + correct blending so the background shows through. |
| `src/terminal/views/ArtTab.jsx` | **Modify.** Clear becomes `destination-out`; delete the six migrated blocks; publish their state to a ref the GL layer reads. |

---

### Task 1: `artBackground.js` — lift the parameters out of the draw loop

Do this first and separately. It is the only part with real unit tests, and extracting the numbers *before* writing shaders is what stops the GL version quietly drifting from the 2D one.

**Files:**
- Create: `src/terminal/art/artBackground.js`
- Test: `src/terminal/art/__tests__/artBackground.test.js`

**Interfaces:**
- Produces:
  - `FLASH_DECAY = 0.92`, `FLASH_ALPHA = 0.08`, `FLASH_CUTOFF = 0.005`, `FLASH_GRID_STEP = 28`
  - `stepFlash(v: number) => number` — one frame of decay, snapping below cutoff to 0.
  - `riftTint(metabolicRift: number, immersive: boolean) => { r, g, b, a }` — the clear colour, including the `0.32` vs `0.72` immersive split.
  - `beatPulseAlpha(beatPhase: number) => number`
  - `ghostTrailAlpha(ageMs: number) => number`

Read the exact constants out of `ArtTab.jsx`'s draw loop (`drawGenesisGlow` call site, the `bgFlashRef` block at ~`:782`, the wireframe ghost at ~`:820`, beat pulse at ~`:837`, ghost trails at ~`:850`) and copy them, do not re-derive them.

- [ ] **Step 1: Write the failing test**

```js
// artBackground.test.js — the numbers behind the GL background layers.
//
// These were inline in a 3130-line draw loop. They are extracted so the GPU
// version and the (temporarily still-2D) version cannot drift apart silently,
// and so the decay curves can be tested without a canvas.

import { describe, it, expect } from 'vitest';
import {
  FLASH_DECAY, FLASH_CUTOFF, stepFlash, riftTint,
} from '../artBackground';

describe('stepFlash', () => {
  it('decays geometrically at the rate the draw loop used', () => {
    expect(stepFlash(1)).toBeCloseTo(FLASH_DECAY, 10);
    expect(stepFlash(0.5)).toBeCloseTo(0.5 * FLASH_DECAY, 10);
  });

  it('snaps to exactly zero below the cutoff so the layer can be skipped', () => {
    expect(stepFlash(FLASH_CUTOFF * 0.9)).toBe(0);
    expect(stepFlash(0)).toBe(0);
  });

  it('reaches the cutoff in roughly 200ms of 60fps frames', () => {
    // The draw loop's comment claims ~200ms; hold it to that.
    let v = 1, frames = 0;
    while (v > 0 && frames < 1000) { v = stepFlash(v); frames++; }
    const ms = frames * (1000 / 60);
    expect(ms).toBeGreaterThan(120);
    expect(ms).toBeLessThan(320);
  });
});

describe('riftTint', () => {
  it('is more transparent in immersive so the GL background reads through', () => {
    expect(riftTint(0, true).a).toBeLessThan(riftTint(0, false).a);
    expect(riftTint(0, true).a).toBeCloseTo(0.32, 5);
    expect(riftTint(0, false).a).toBeCloseTo(0.72, 5);
  });

  it('bleeds red in proportion to the metabolic rift, capped at +28', () => {
    expect(riftTint(0, false).r).toBe(0);
    expect(riftTint(1, false).r).toBe(28);
    expect(riftTint(0.5, false).r).toBe(14);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/terminal/art/__tests__/artBackground.test.js
```

Expected: FAIL, `Failed to resolve import "../artBackground"`.

- [ ] **Step 3: Implement `artBackground.js`** with the constants copied from the draw loop, and `stepFlash` / `riftTint` as the tests describe.

- [ ] **Step 4: Run it and watch it pass.** If the 200ms assertion fails, do **not** loosen it without checking the real decay against the draw loop first — that assertion is a check on your reading of the original.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/art/artBackground.js src/terminal/art/__tests__/artBackground.test.js
git commit -m "feat(art): extract background layer parameters from the draw loop"
```

---

### Task 2: `SphereBackground.jsx` — the GL layer, one layer at a time

**Files:**
- Create: `src/terminal/art/SphereBackground.jsx`
- Modify: `src/terminal/art/SphereComposite.jsx`

**Interfaces:**
- Consumes: `artBackground.js`; a `stateRef` prop carrying `{ flash, rift, immersive, beatPhase, ghosts, wireframe }` published each frame by ArtTab.
- Produces: default export `SphereBackground({ stateRef })`, rendered inside `<Canvas>` **before** `SourceQuad`.

**Migrate one layer per commit, in this order** — cheapest and most isolated first, so a parity failure always has one candidate cause:

1. state flash grid (screen-space, no projection)
2. genesis glow (radial, centre + radius uniforms)
3. beat pulse (radial, one scalar)
4. sphere wireframe ghost (needs the rotation matrix as a uniform)
5. spectral ambient (immersive-gated)
6. temporal ghost trails (needs projected positions — upload them, do not project in the shader)

After **each** layer:

- [ ] Delete that layer's 2D block from `ArtTab.jsx`.
- [ ] Run `node scripts/artBaseline.mjs --out baseline/wip && node scripts/artCompare.mjs baseline/art-sphere-step2 baseline/wip`
- [ ] **Look at the PNGs.** The comparator tells you *that* something moved, never *what*. A layer rendered at the wrong blend mode can score under threshold and still look wrong.
- [ ] Commit with the measured mean/max in the message.

---

### Task 3: The `destination-out` clear

Do this **last**, not first. Until every background layer is on the GPU, the 2D canvas must stay opaque or the layers still on it will smear against a transparent backdrop.

**Files:**
- Modify: `src/terminal/views/ArtTab.jsx` (the clear at ~`:755`), `src/terminal/art/SphereComposite.jsx` (the 2D quad's material).

- [ ] **Step 1:** Change the clear from `fillRect` with the rift tint to `globalCompositeOperation = 'destination-out'` with an alpha equal to the current fade, then restore.
- [ ] **Step 2:** Set the 2D quad's material `transparent: true` and confirm the composite's `alpha: false` / `premultipliedAlpha: false` still hold. **This is the premultipliedAlpha trap the spec names** — a wrong setting here produces an identical GL call log with visibly different output, so judge it on pixels.
- [ ] **Step 3:** Tune the two trail decays to match. They will not match on the first try. Record the values chosen and note that step 6 removes the duplication.
- [ ] **Step 4:** Full gate run, look at every state, commit.

---

### Task 4: Verify, measure, record

- [ ] **Interaction smoke test.** Re-run the step-2 smoke script: hover, click, drag, shift-click resonance, **touch long-press fusion**, immersive on/off, and `elementFromPoint` at the sphere centre resolving to the 2D canvas. 9/9 or explain each failure.
- [ ] **Frame time**, headed on the real GPU:

```bash
node scripts/artFrameTime.mjs --seconds 10 --out baseline/art-sphere-step3
```

Compare against step 2's idle p50 2.6 ms / p95 12.5 ms / p99 18.1 ms. Step 3 should *reduce* 2D draw cost — six layers leave the loop. If it does not, say so plainly rather than explaining it away; the p99 already crosses the 16.7 ms budget and step 3 is the first chance to pull it back.
- [ ] **Record** in `baseline/art-sphere-step3/README.md`, the spec's Step 3 section, and `.superpowers/sdd/progress.md`: the comparator table, the cost delta, the two trail-decay values, and anything the plan got wrong.
- [ ] **Line count.** `wc -l src/terminal/views/ArtTab.jsx` — it is ~3140 now and must go *down*. If it has not, the layers were copied rather than moved.

---

## Self-review notes

- **Spec coverage.** §5 Step 3 requires all six layers (Task 2), the `destination-out` clear at this step and not step 2 (Task 3), and names the two-coexisting-decays state (Task 3 Step 3). §6 verification: pixel comparison (Task 2 per layer, Task 4), interaction smoke test (Task 4). §7: ArtTab must shrink (Task 4).
- **Deliberately not covered.** Edges (step 4), nodes (step 5), particles and the trail feedback buffer (step 6), and §3.2's full loop reconciliation.
- **Risk.** The ghost trails need projected positions. Uploading them per frame is the whole point of the CPU-projection invariant; if that starts to look expensive, upload less often rather than moving projection to the GPU.

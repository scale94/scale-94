# Art Sphere Step 5 — Nodes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all thirteen node-layer draw calls off Canvas2D and onto the GPU
as instanced quads, retiring the last `createRadialGradient` and the last
`ctx.arc` from the draw loop. After this step the only 2D content left is the
particle ecology, which step 6 takes.

**Architecture:** No new mesh and no new shader. The step-4 edge instance format
already carries a **filled disc** primitive (a negative width is the sentinel —
`discWidth()` / `isDisc()`), and the disc branch leaves a large part of the
17-float layout provably dead. The annulus, the arc sweep, the angular dash and
the radial-gradient falloff are all encoded into those dead floats, so
`EDGE_STRIDE` does not change, no buffer is reallocated, and both existing
materials (`SRC_OVER_LAYER`, `ADDITIVE_LAYER`) are reused as-is.

**Tech Stack:** react-three-fiber 9.5, three 0.183, @react-three/postprocessing 3.0.4, Vitest 4, CDP harness (`scripts/artBaseline.mjs`, `artCompare.mjs`, `artInk.mjs`, `artSmoke.mjs`, `artPresence.mjs`).

**Pre-flight scan:** `.superpowers/sdd/step5-preflight.md` (commit `06842e2` in the
sdd ledger) is the authority on what this block contains. It found **thirteen**
draw layers where the spec named seven, plus five state paths the spec omits.
Read it before Task 1.

---

## Global Constraints

- **Projection, depth sort and hit-testing stay on the CPU.** Node hit-testing
  (`nodeAt()`) reads the projected screen coordinates. This is unchanged.
- **Faithful parity first.** Do not re-art. If a layer looks better after the
  port, that is a bug until the author says otherwise.
- **Never run vitest with `-u` / `--update`. Never `git add -A`.** Stage only
  your own files; other sessions touch this repo. Re-read anything in
  `scripts/` before editing it.
- **Backticks inside the GLSL template literals in `SphereEdges.js` terminate
  the string.** Do not put them in comments there.
- `.superpowers/sdd` is its own git repo with `.gitignore = *`; ledger files
  need `git add -f` and a separate commit.
- **Do not push or merge.** The author decides.
- Gates, all of which must pass before a commit:
  - `npx vitest run` — 1118 tests / 110 files
  - `npm run lint` — 0 errors, warnings ≤ 153 (currently 144; **a new warning is
    yours, fix it, do not raise the ratchet**)
  - `npm run build`
  - `node scripts/artSmoke.mjs` — 10/10
  - `node scripts/artPresence.mjs` — 10/10
- `ArtTab.jsx` cannot be mounted in jsdom. Unit tests cover extracted pure
  modules only and are **not** parity evidence.

## What this branch has already proved, that this step must not relearn

1. **Ask what the gate can actually SEE before quoting it.** Six layers scored
   green while structurally invisible to the comparator. For step 5 the count is
   **eight of thirteen** (§5 of the pre-flight scan). Task 1 exists because of
   this and must not be deferred.
2. **`__pump(n)` never yields.** It runs n rAF callbacks in one synchronous
   loop, so nothing driven by a promise continuation, the React scheduler or a
   worker message is reachable at any pump count — only frames interleaved with
   yields (`await page.pump(1)` in a loop). Both the fusion long-press and the
   probe are async; instrument them accordingly.
3. **Measure the SHAPE of a defect, not its size.** "Flat in alpha where the
   canvas is linear in alpha" is what identified the missing `* a` in step 4.
   The halo falloff in Task 4 is the same class of hazard.
4. **Signed mean, not `|abs|`.** `|abs|` can be smaller across a real change
   than in a same-build null. Always capture a same-build null before quoting a
   delta.
5. **Never compare against a committed baseline for a parity claim** — the boot
   fingerprint is not deterministic. Use a same-session control capture.
6. **Coordinates go stale.** The sphere rotates during a 90-frame hover sweep,
   so a point clicked after the sweep can land on empty canvas. This is the bug
   `481b4d4` fixes and Task 1 carries.

## The gate

Reference: a **same-session control**, captured from the build immediately
before each task's change. Never `baseline/art-sphere-step4/`.

```bash
node scripts/artBaseline.mjs --out baseline/t5ctrl
node scripts/artBaseline.mjs --out baseline/t5wip
node scripts/artCompare.mjs baseline/t5ctrl baseline/t5wip
node scripts/artInk.mjs     baseline/t5ctrl baseline/t5wip
```

The dev server is `.claude/launch.json` → `scale94-dev` on port 5174. Drive the
browser through `scripts/cdp.mjs`, **never the browser pane** (it reports
`document.hidden`, which suspends rAF).

`artSmoke` scored 9/10 once in six runs and its summary now names the failing
check. If that flake surfaces, **capture the name** rather than re-running until
it passes.

**This step legitimately changes pixels.** A state going over threshold is a
prompt to look at the PNGs, not an automatic failure — but you must look, and
say which it was.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/terminal/art/artNodes.js` | **Create.** Pure. Radius, depth-cue alpha, resonance dimming, core alpha, bleed and spectral-tint maths, plus every ring's radius/width/dash/sweep law — lifted verbatim from the draw loop so the GL and 2D versions cannot drift. |
| `src/terminal/art/__tests__/artNodes.test.js` | **Create.** Unit tests for the above. |
| `src/terminal/art/SphereEdges.js` | **Modify.** Extend the disc branch of `EDGE_VERT` / `EDGE_FRAG` with inner radius, arc sweep, angular dash and the radial-gradient falloff. Add `ringWidth()` / `writeRing()` / `writeHaloDisc()` writers and their inverses. **No stride change.** |
| `src/terminal/art/__tests__/artEdges.test.js` | **Modify.** Extend the layout-invariant test to cover the new disc-branch encoding. |
| `src/terminal/art/artAwakening.js` | **Modify.** `drawBeaconRing` becomes `beaconRingState` — returns the ring's parameters or null; it stops touching `ctx`. |
| `src/terminal/views/ArtTab.jsx` | **Modify.** Delete `:1564`–`:1646` and `:1665`–`:1770`; write node instances into the two edge buffers instead. Add the Task-1 harness hooks. |
| `scripts/artBaseline.mjs` | **Modify.** Carry `481b4d4`'s resonance fix. |
| `scripts/artPresence.mjs` | **Modify.** Add presence checks for the layers Task 1 makes forceable. |
| `scripts/_nodeShot.mjs` | **Create, untracked.** The forcing-capture driver, on the `_ampShot.mjs` pattern. |

---

## The instance encoding (read before Task 3)

In the disc branch of the current shader these fields are **provably dead**:

- `aEnds.zw` — for a disc `b == a`, so `delta` is zero and
  `dir = len > 1e-6 ? delta/len : vec2(1,0)` already falls to the constant.
- `aPhase` — the dash term is `mod(vPhase + t*vLen, period)` and `vLen == 0`,
  so it can only switch the whole instance uniformly on or off.
- `aC1`, `aC2`, and `vAlpha.y` / `vAlpha.z` — `t = vLen > 1e-6 ? … : 0.0` is 0,
  so the gradient collapses to `vC0` and `vAlpha.x` alone.

That is **eight** free floats. The proposed assignment:

| Field | Disc meaning |
|---|---|
| `aPack.y` | `-2 * outerRadius` (unchanged — the sign is still the sentinel) |
| `aEnds.z` | inner radius in px; `0` = filled disc, `> 0` = annulus |
| `aEnds.w` | sweep end angle in radians; `0` means full circle (`2π`) |
| `aPhase` | sweep **start** angle in radians |
| `aC1.x` | halo falloff inner radius (`0` = no gradient, hard-edged) |
| `aC1.y`, `aC1.z`, `aC2` | reserved, must be written as 0 |

`len` and `dir` must be forced in the vertex shader
(`len = mix(len, 0.0, isDisc)`, `dir = mix(dir, vec2(1.0, 0.0), isDisc)`) so
that repurposing `aEnds.zw` cannot leak into the segment path. **The invariant
test in Task 3 is what makes this safe** — the same role
`unpackFlags`/`isDisc` already play.

> This encoding is the plan's proposal, not a proven fact. Task 3 proves it or
> replaces it. If it does not hold, a stride bump to 18 is the fallback and it
> is not a disaster — `edgeCapacity()` already derives capacity from the state.

---

## The ordering hazard (read before Task 5)

Per node the 2D order is
`halo(src-over) → core(src-over) → beacon(lighter) → chimera(src-over) → ghost(lighter)`,
and the nodes are depth-sorted with the near ones drawn **last**.

Two meshes means two passes, so every additive node ring would land on top of
**every** src-over node disc, including nearer ones that occlude it today.

**The decision:** follow the step-4 pulse-ring precedent (`ArtTab.jsx:1256`) —
write each node's src-over instances into `eg` and its additive instances into
`ag` in the same iteration, preserving relative order **within** each stream,
and accept that the additive stream still composites after the src-over one.
This is exactly what step 4 already does for the filaments, chimera fringes and
prism, so it is not a new compromise; but it **is** a behaviour change where a
near disc overlaps a far node's beacon or ghost ring.

**Task 5 must measure that specific case**, not assume it. Force two overlapping
nodes with a beacon on the far one, capture with and without, and report the
signed delta. If it reads, the fallback is a depth-sorted single additive pass
keyed on the node's own depth — record the finding either way.

---

## Tasks

### Task 1: the instruments, before any node code moves

Eight of thirteen layers are invisible to every existing gate. This task builds
the ability to see them. **Nothing in Tasks 2–8 may be verified against a gate
that cannot see the layer it changed.**

- [ ] Carry `481b4d4` onto this branch (cherry-pick or re-derive): the
      `resonance` capture state must select **two distinct** nodes. Both
      `findNode()` calls at `artBaseline.mjs:366` / `:370` currently run the same
      unskipped 9×5 scan and return the same hit. Mind the coordinate-staleness
      trap — the sphere rotates during the sweep, so re-hover immediately before
      the click rather than reusing a point found 90 frames earlier.
- [ ] `window.__artSetChimera(map)` — write `reasoningRef.current.clusterSync`
      directly. `__artSetAnalogy` writes `filaments`/`zones` only and cannot
      reach the sync/flicker rings.
- [ ] `window.__artSetGhostNodes(arr)` — write `reasoningRef.current.ghostNodes`.
      Distinct from the existing `__artSetGhosts`, which is ghost **trails**;
      name it so the two cannot be confused at a call site.
- [ ] `window.__artForceFusion(idA, cursorXY)` — set `fusionSourceRef` and
      `fusionCursorRef` without a real long-press.
- [ ] `window.__artForceProbe(query, anchors)` — set `probeNodeRef` without the
      async probe round-trip.
- [ ] `window.__artForceBirth(parentId)` — push a `birthMap` entry so the 400 ms
      birth lerp is reachable.
- [ ] Delete all of the above in the same teardown block as the existing hooks
      (`ArtTab.jsx:2013`).
- [ ] `scripts/_nodeShot.mjs` (untracked): force each state, then capture. Model
      it on `scripts/_ampShot.mjs`.
- [ ] **Measure the two unknowns** and record the answers in the task report:
      does the `idle` capture land inside awakening phase 1 (`elapsed ∈ [4s, 8s)`
      and `!aw.interacted`)? Does `getSpectralColor(i)` return non-null during a
      capture? Both are currently guesses and the plan must not carry guesses.
- [ ] Gates green. Commit.

### Task 2: `artNodes.js` — lift the node parameters out of the draw loop

- [ ] Extract, verbatim: `radius = (5 + energy*4) * scale`; `energy += 0.55` on
      hover; `depthAlpha = max(0.08, (depth+1)*0.5)`; resonance dimming `*0.10`;
      `coreAlpha = (0.45 + energy*0.55) * depthAlpha`; the bleed `lerpColor`; the
      spectral tint (blend `0.08 + flux*0.15`, sat term `*0.3`); and the
      **hovered core's fully opaque bypass** of both alphas.
- [ ] Extract every ring's law: halo (`haloR`, the `0.4r` inner stop, alpha
      `(energy + bleed*0.25) * 0.38 * depthAlpha`), beacon, chimera sync,
      chimera flicker, ghost inner (including the `2π·g` sweep), ghost outer,
      fusion pulse ring.
- [ ] Extract the birth-animation ease `1 - (1-t)³` over 400 ms.
- [ ] Unit tests for all of it. These are drift guards, **not** parity evidence.
- [ ] `ArtTab.jsx` calls the new module; the 2D draw calls still run. **Pixels
      must not move.** Capture a control and a wip and show a null-level delta.
- [ ] Gates green. Commit.

### Task 3: the annulus, the sweep, the angular dash and the falloff

- [ ] Extend the disc branch of `EDGE_VERT` / `EDGE_FRAG` per the encoding
      section above. Force `len`/`dir` in the vertex shader.
- [ ] **Annulus:** the disc coverage term becomes an inner **and** outer box
      filter — `clamp((rOuter - d)/pxD + 0.5, 0, 1) * clamp((d - rInner)/pxD + 0.5, 0, 1)`
      — keeping the box filter, not a smoothstep, for the reason step 3 recorded.
- [ ] **Arc sweep:** angular coverage from `atan(vD, vAlong)` against the
      start/end angles, antialiased in **arc-length** units (`r * dθ`), not in
      radians — a fixed radian shoulder is a radius-dependent pixel shoulder.
- [ ] **Angular dash:** the same `mod(...)` pattern the segment path uses, over
      arc length `r * θ` instead of `vPhase + t * vLen`.
- [ ] **Radial-gradient falloff:** alpha flat inside `aC1.x`, then **linear** to
      zero at the outer radius. This is a `createRadialGradient`, **not** a
      gaussian — the existing glow shoulder models `ctx.shadowBlur` and is the
      wrong shape and the wrong amplitude law for this.
- [ ] Extend the layout-invariant test so the JS writers and the GLSL cannot
      drift, exactly as `unpackFlags` / `isDisc` already do.
- [ ] **Nothing is drawn with these yet.** The gate must show a null-level
      delta. If it does not, the segment path has been disturbed.
- [ ] Gates green. Commit.

### Task 4: core discs and glow halos

The three layers a gate can already see. Port them first so the new primitive is
proven where the comparator has teeth.

- [ ] Node core → filled disc instance (`aEnds.z = 0`). Include the hovered
      node's opaque bypass.
- [ ] Node glow halo → gradient disc (`aC1.x = radius * 0.4`).
- [ ] Delete `ArtTab.jsx:1564`–`:1582`.
- [ ] **Measure the halo's SHAPE, not its size.** Sample the halo's alpha along
      a radial line at several radii and compare the profile against the 2D
      control. A gaussian standing in for a linear ramp passes any
      single-radius reading. Report the profile, not a scalar.
- [ ] `artCompare` + `artInk` against a same-session control. `idle` and `hover`
      both carry real signal here; quote the **signed** mean.
- [ ] Gates green. Commit.

### Task 5: the beacon and chimera rings

- [ ] `drawBeaconRing` → `beaconRingState` in `artAwakening.js`; it returns
      parameters and stops touching `ctx`.
- [ ] Beacon ring → annulus instance in the **additive** stream.
- [ ] Chimera sync ring → annulus, src-over, solid.
- [ ] Chimera flicker ring → annulus, src-over, **angular dash `[3,4]`**.
- [ ] Delete `ArtTab.jsx:1583`–`:1621` and the body of `drawBeaconRing`.
- [ ] **Measure the ordering hazard** described above: force two overlapping
      nodes with a beacon on the far one, capture with and against, report the
      signed delta, and state plainly whether the additive-after-everything
      composite reads. Record the finding either way.
- [ ] Presence checks in `artPresence.mjs` for the beacon ring and both chimera
      rings, using the Task-1 hooks. Compute the expected magnitude **first** —
      a metric too coarse for the signal is the documented failure mode.
- [ ] Gates green. Commit.

### Task 6: the ghost rings

- [ ] Ghost inner ring → annulus, additive, **arc sweep `0 → 2π·g`**. The sweep
      is the animation; a full ring here is a silent loss of the whole readout.
- [ ] Ghost outer ring → annulus, additive, width `3 * scale`.
- [ ] Delete `ArtTab.jsx:1623`–`:1646`.
- [ ] Presence check driven by `__artSetGhostNodes`, sweeping `g` across at
      least three values so the **sweep angle** is what is measured, not merely
      the ring's presence.
- [ ] Gates green. Commit.

### Task 7: the tail — the two orphan strokes and the probe

The author's standing call: these land **here**, after the nodes, never before.
Both terminate on node discs and the GL composite renders under the 2D canvas,
so moving them earlier would put them behind every disc they touch.

- [ ] Fusion source pulse ring → annulus, src-over, **angular dash `[5,4]`**.
- [ ] Fusion cursor thread → ordinary straight segment, dash `[3,6]`. No shader
      change.
- [ ] Probe tethers → straight segments, dash `[3,5]`, per-anchor alpha
      `weight/wmax`. No shader change.
- [ ] Probe glow halo → gradient disc (`aC1.x = probeR * 0.3`).
- [ ] Probe core → filled disc.
- [ ] Delete `ArtTab.jsx:1665`–`:1770`, leaving the two `nextLabels` pushes
      (those are DOM and stay).
- [ ] Presence checks for both, driven by `__artForceFusion` and
      `__artForceProbe`. Remember `__pump` does not yield — step frames with
      `await page.pump(1)` in a loop.
- [ ] Gates green. Commit.

### Task 8: verify, measure, record

- [ ] Full gate sweep at all three scales, against a same-session control.
- [ ] Frame-time comparison against the step-4 numbers in
      `baseline/art-sphere-step4/README.md`.
- [ ] Confirm every layer in §1 of the pre-flight scan is either on the GPU or
      explicitly accounted for. The node block must contain **no** `ctx.arc`,
      `ctx.fill`, `ctx.stroke`, `createRadialGradient` or `setLineDash`.
- [ ] Write `baseline/art-sphere-step5/README.md` in the shape of the step-4
      record: what is on the GPU, **what the gates still cannot see**, the
      frame-time numbers, and every finding.
- [ ] Update the spec's §Step 5 with an annotated block recording what the
      one-paragraph description got wrong, matching the §Step 4 precedent.
- [ ] Update `.superpowers/sdd/progress.md`.
- [ ] Report to the author. **Do not push or merge.**

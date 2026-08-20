# /art sphere — step 5 reference (nodes complete)

> **SUPERSEDED AS A MEASUREMENT REFERENCE.** Step 6 is measured against
> `baseline/art-sphere-step5-certified/`, captured at `9661dfa` by the harness
> fixed in `2adc482` and carrying a five-run same-build null in its manifest.
> This set was captured by a harness that could not repeat itself — see the
> correction block below — so no parity claim may be measured against it.
>
> It is kept, unchanged, because four task reports quote numbers taken against
> it, and it remains the accurate record of **what step 5 is**: the thirteen
> node layers, the blend classes, the census, and the immersive correction. Only
> the reproducibility of its own pictures is superseded.
>
> The two sets do not match pixel-for-pixel and that is not a regression: this
> one holds an arbitrary draw of the awakening's breath phase, the new one holds
> phase 0. Same build — the entire app diff between them is 45 lines of
> DEV-gated harness getters.

Captured on `fix/art-sphere-index-space` at `39204b4` with the whole node slice
on the GPU. This was the reference **step 6 (particles)** was to be measured
against.

```bash
node scripts/artBaseline.mjs --out baseline/<name>
node scripts/artCompare.mjs baseline/art-sphere-step5 baseline/<name>
node scripts/artInk.mjs     baseline/art-sphere-step5 baseline/<name>
```

**Do not compare against a committed baseline for a parity claim.** The boot
fingerprint is not deterministic, so per-change parity uses a same-session
control capture. This set is a reference for what step 5 looks like, not a byte
gate. **And do not read the two immersive rows of any comparison at all** — see
"The immersive rows are not a measurement", below, which is the largest finding
of this step and retires a question three tasks carried.

## What is on the GPU now

All thirteen node draw layers, in draw-loop order. The block is
`ArtTab.jsx:1563`–`:1972` (`── Nodes` to just before `── Idle ambient particle
emission`).

| # | layer | site | primitive | stream |
|---|-------|------|-----------|--------|
| 1 | glow halo | `:1649` | disc + radial-gradient falloff | `eg` src-over |
| 2 | core disc | `:1666` | filled disc | `eg` src-over |
| 3 | awakening beacon ring | `:1691` | annulus | **`ag` additive** |
| 4 | chimera sync ring | `:1720` | annulus | `eg` src-over |
| 5 | chimera flicker ring | `:1736` | annulus + angular dash | `eg` src-over |
| 6 | ghost inner ring | `:1769` | annulus + **arc sweep** | **`ag` additive** |
| 7 | ghost outer ring | `:1784` | annulus | **`ag` additive** |
| 8 | node label | `:1806` | `nextLabels` | DOM (`SphereLabels.jsx`) |
| 9 | fusion source pulse ring | `:1859` | annulus + angular dash | `eg` src-over |
| 10 | fusion cursor thread | `:1879` | polyline, dashed | `eg` src-over |
| 11 | probe tethers | `:1921` | polyline ×3, dashed | `eg` src-over |
| 12 | probe glow halo | `:1936` | disc + radial-gradient falloff | `eg` src-over |
| 13 | probe core | `:1950` | filled disc | `eg` src-over |

Every blend class is preserved: the three layers that used `lighter` go to
`ADDITIVE_LAYER`, the rest to `SRC_OVER_LAYER`, both written from inside the
node loop so the 2D draw order survives.

Five per-node state paths shape the instance data and are all instrumented in
the census: birth lerp `:1595`, resonance dimming `:1611`, overwrite bleed
`:1620`, spectral tint `:1630`, hovered-core opaque bypass `:1674`.

**No new mesh and no new shader.** The annulus, the angular dash, the arc sweep
and the radial falloff were encoded into floats the disc branch left provably
dead, so `EDGE_STRIDE` is unchanged, no buffer was reallocated, and both
existing materials are reused as-is. Nothing after task 3 touched the shader.

Still 2D, for step 6: the particle ecology and the conductor.

## The node block contains no canvas API at all

Stronger than the plan's criterion, which asked only for no `ctx.arc`,
`ctx.fill`, `ctx.stroke`, `createRadialGradient` or `setLineDash`:

```
awk 'NR>=1563 && NR<=1972' src/terminal/views/ArtTab.jsx \
  | grep -vE '^\s*//' | grep -c "ctx\."      ->  0
```

Zero `ctx.` references of any kind outside comments. The three grep hits inside
the range (`:1647`, `:1856`, `:1928`) are comments explaining the ports.

Four live calls survive in the file — `createRadialGradient` at `:2005`, `arc`
and `fill` at `:2011`/`:2012` and `:2017`/`:2018`. All four are in the
**particle render**, which is step 6's business and correctly out of scope.
`ctx.stroke`, `createLinearGradient`, `quadraticCurveTo` and `ctx.shadowColor`
return zero hits anywhere in the file.

**§Step 4's outstanding author's call is closed.** The two straight-line strokes
that "no step owns" — the fusion-cursor thread and the probe-centroid tethers —
landed here in task 7 (`9a79f83`), as layers 10 and 11 above.

## THE IMMERSIVE ROWS ARE NOT A MEASUREMENT

> **CORRECTED AND FIXED, post-step-5 task 1.** The finding below stands: these
> two rows carried no information, and every number quoted from them was noise.
> **Its stated MECHANISM is wrong in both halves**, and both were falsifiable
> from artifacts already on disk when it was written:
>
> * *"It is a different rotation."* It is not. `rot` is now readable from
>   `window.__artBgState()` and recorded per shot; two runs whose `immersive-off`
>   frames correlated 0.047 held **identical `rx` and `ry` at every state**. The
>   camera never moved. The WORLD was in a different configuration.
> * *"A screenshot yields, so real frames run across it."* No `draw` runs
>   outside `__pump` — after `__virtualize()` the shim queues rAF rather than
>   scheduling it. Measured directly: real vsync frames do tick across a
>   screenshot and **not one of them draws**. `shot()` screenshots in every
>   state anyway, which the 0.90–0.97 rows already disproved.
>
> The real causes were **four**, and all of them are the same shape — something
> outside the pump budget deciding what the world looks like, which a gate that
> only pins the clock cannot see:
>
> 1. `__artHarnessReset` never cleared the awakening's `breathPhase` or
>    `particleFrameRef`, mount-time per-frame counters the real-timed boot
>    leaves at an arbitrary value. `breathPhase` scales `sphereR`, which scales
>    every node position. This is the frame-0 divergence.
> 2. The fired-cascade block's frame budget is not a constant, and every later
>    state inherited the difference.
> 3. The immersive resize landed on either side of the 600-frame settle by
>    chance. `forceResize()` itself is sound; calling it *after* the settle left
>    the settle's size to a coin flip. This is the only part of the original
>    diagnosis that survived.
> 4. The resonance sweep's input race, which put two frames of hover damping
>    between two runs and became a different world three states later.
>
> All four are fixed. Measured over **five** full capture runs, ten pairs per
> cell: worst pair anywhere **0.977**, every immersive cell **≥ 0.988**. One
> pair is not evidence when the fault is intermittent — three of those four were
> each found *after* a clean 21/21 pair had already been recorded. Full account:
> `.superpowers/sdd/post-step5-task1-report.md`.
>
> Consequence for this reference set: it was captured by a harness that could
> not repeat itself, and it contains one arbitrary draw of the breath phase.
> Re-capture before measuring step 6 against it.

The most important thing in this record, and it invalidates a chain of numbers
four tasks long rather than adding to it.

**`artBaseline`'s `immersive-on` and `immersive-off` states are not reproducible
run to run on identical code.** Full-resolution luminance correlation between
two capture runs of the *same build*, four minutes apart
(`baseline/t5t4wip` vs `baseline/t5t4null`, `scripts/_t8immRot.mjs`):

| state | same-build null | any cross-build pair | verdict |
|---|---|---|---|
| `idle` and the other normal states | **0.970** | 0.78 – 0.98 | reproducible |
| `immersive-on` | **0.610** | 0.60 – 0.66 | **null == signal** |
| `immersive-off` | **0.082** | 0.045 – 0.07 | uncorrelated |

The same-build null is *indistinguishable from a cross-build comparison*. So the
immersive rows carry no information about a code change, at any effect size.

**It is a different rotation, not a rendering difference.** Verified by looking:
`t5t4wip` and `t5t4null` show entirely different faces of the sphere, and across
eight capture sets the `immersive-on` shot falls into distinct rotational
groups that do not track the build — `t5t4null` (task 4) is at the same rotation
as `t8wip` (HEAD), while `t5t4wip` (the same build as `t5t4null`) is at the same
rotation as `t8ctrl` (pre-step-5).

**The virtualised clock cannot see it, which is why nothing caught it.** The
`awakening.elapsedS` recorded at every shot matches between the two same-build
runs to within 0.13 s, constant from `idle` onward — the pump budget really is
identical, exactly as `artBaseline`'s header claims. Rotation accrues per rAF
frame; `elapsedS` is virtual-clock derived; the two decouple wherever real
frames run outside the pump budget.

**The mechanism, and the evidence for it.** The only two states that diverge are
the only two that call `forceResize()`, which takes a throwaway `page.screenshot`
to force a `ResizeObserver` delivery. `__pump(n)` never yields, but a screenshot
does, and rAF is unthrottled in headless (~350 fps), so an uncontrolled number of
real frames runs across that yield. The damage scales with the number of calls:
one for `immersive-on` (r 0.61), two for `immersive-off` (r 0.08). Same family as
the `__pump`-never-yields trap that step 4 recorded.

### What that does to the immersive deficit the last four tasks carried

Task 4 §5a reported an immersive ink loss of 0.69–0.74 and 0.78–0.84 and named
its column: "`artInk` on the sphere **disc**". Tasks 5, 6 and 7 each compared
against that disc-column band and each read "inside the null".

**`trail-deficit.md` §1 had already ruled that column inadmissible in immersive**,
in writing, before any of it:

> "In immersive the sphere grows *past* the disc edge, and a few pixels of drift
> then swing content across the boundary: measured run-to-run on identical code,
> immersive **disc** ink moves by up to **12%** while immersive **frame** ink
> moves by under **2%**. So every immersive number quoted below is a frame
> number."

Confirmed independently here: at `immersive-on` laptop@1x the sphere's radius is
~385 px and `artInk`'s disc is `0.42 × 900 = 378` px, so the sphere really does
overhang the boundary. Nobody made an arithmetic error — the rule was written
once and then not carried into the reports that inherited the number. And "a few
pixels of drift" understates the cause by a long way: it is a wholly different
rotation.

Measured same-build null, identical code, both columns:

| column | normal | **exhibit (immersive)** |
|---|---|---|
| `disc` | 0.988 – 1.000 | **1.048 – 1.211** |
| `frame` | 0.995 – 1.002 | **1.012 – 1.071** |

The immersive disc column swings ±21% on identical code. Task 4's 0.69–0.84 is
16–31% from unity. **The "deficit" is the same order as the column's own null and
was measured between two frames that are not the same picture.**

**Verdict: not pinned, not still open — unanswerable by this instrument, and
retired.** *(Post-step-5 task 1: still retired, but on this second ground only.
The first ground — that the immersive rows carry no information — is now void;
they are reproducible. `trail-deficit.md` §1's ruling on the disc column is
untouched, and that is what task 4 measured on.)* It should not be inherited by step 6. If it is ever reopened it needs
a spatial null (same region, same frame, layer on vs off), which is what task 7's
probe null already demonstrates is possible.

The full runs are kept beside this README: `ink-same-build-null.txt` (identical
code) and `ink-step5-vs-prestep5.txt` (the step-wide comparison).

## Parity, against a same-session control for the WHOLE of step 5

Not a per-task control. `baseline/t8ctrl` is the pre-step-5 app source
(`fc2909a`: `ArtTab.jsx`, `SphereEdges.js`, `artAwakening.js`) served from a
detached worktree in the same session, captured with HEAD's harness. The control
manifest records `layers: no census` on all 21 shots, which is positive proof
the old source was really being served rather than a stale HMR cache.

```
node scripts/artCompare.mjs baseline/t8ctrl baseline/t8wip
21/21 states within threshold 4     means 0.037 – 1.366
```

`artInk`, admissible columns only — normal-mode `disc`, which is the sharper
instrument there and is reproducible:

| scale | step 5 rollup | same-build null |
|---|---|---|
| laptop@1x | 1.019 | 0.988 |
| laptop@2x | 1.024 | 1.000 |
| projector@1x | 1.027 | 0.988 |

Per state the ranges overlap (signal 0.993–1.064, null 0.947–1.009), so this is
a **weak** signal: consistent in sign on all three scales, of the order of the
per-state noise, about +2%. It is in the same direction as task 4's measured
~8%-brighter GL core interior. Worth one line, not a section — and note it is
the *opposite* sign from the deficit everyone was chasing.

Immersive frame ink (the admissible immersive column) reads 1.004 / 1.009 /
0.938 against a same-build null of 1.012 / 1.038 / 1.071. Inside it.

## What the gate could NOT see in this step

The recurring failure mode of this branch, and step 5 is its worst instance.
This table is **measured from the node census across all 21 shots**, not
predicted:

| layer | states (of 7) containing it |
|---|---|
| halo, core, spectral | all 7 |
| chimeraSync | all 7 |
| coreHover | hover, fired-cascade |
| resonanceDim | resonance |
| bleed | fired-cascade |
| **beacon** | **none** |
| **chimeraFlicker** | **none** |
| **ghostInner / ghostOuter** | **none** |
| **fusionRing / fusionThread** | **none** |
| **probeTether / probeHalo / probeCore** | **none** |
| **birth** | **none** |

**Nine of the thirteen draw layers appear in no capture state at any scale.**
`artCompare 21/21` across a change to any of them means nothing. They are
covered instead by `artPresence`'s bespoke checks (19/19) and by
`scripts/_nodeShot.mjs`'s forcing hooks, which measure the layer rather than the
frame — precisely because the comparator cannot.

Two of the pre-flight scan's §5 predictions resolved the *good* way and one the
bad way, all now measured rather than assumed:

- **`bleed` is covered** — the pre-flight said "NO, no state triggers an
  overwrite". `fired-cascade` does.
- **`resonanceDim` is covered** — the pre-flight said "NO (probably)", because
  the resonance state shift-clicked the same node twice. `fc2909a` landed as a
  step-5 prerequisite and the state now selects two distinct nodes; the census
  confirms the branch fires.
- **`spectral` is covered** — the pre-flight said "UNKNOWN, must be measured".
  31 of 31 nodes take the branch in every state.
- **`beacon` and `chimeraFlicker` are NOT** — both were "UNKNOWN". Measured:
  zero in all 21 shots.

**The beacon ring has never been in a reference image, and it is not a near
miss.** It draws for one node while awakening is in phase 1, `elapsed ∈ [4 s,
8 s)`. `_nodeShot.mjs` confirms it does draw on a real boot (phase 1 observed at
t = 4.05 s through 7.64 s, `beacon=1`). Every `artBaseline` idle shot lands at
**elapsed 102.27 s, phase 3** — 25× past the window.

Carried from step 4 and still true:

- **Fused edges and orthogonal bridges appear in no capture state at all**
  (nothing runs `bone`, nothing forges a bridge).
- **The analogy filaments have never drawn in any build** — `fil.nodeA` indexes
  the 272-node corpus while the draw loop indexes the 31-node sphere.
  Deliberately unfixed: making an invisible layer appear is a visual change, not
  a port.
- Immersive **is** fullscreen now (`31bff8a`, an ancestor of HEAD) — asserted in
  every capture, and the PNGs are 1520×900 / 3040×1800 / 1920×1080. Any
  immersive baseline older than that fix is invalid for a different reason than
  the one above.

## Frame time — and a units correction

**Read the renderer field before quoting a delta.** `baseline/art-sphere-step4`
contains numbers from *both* instruments and they are 2–3× apart:
`frametime-headed-gpu.json` is `"headed chrome, real GPU"`, while
`manifest.json`'s `drawCostMs` is `"headless … swiftshader (software GL)"`.
Comparing a headless p50 against the README's headed table reports a 2.5×
regression that is entirely the software rasteriser.

Headed, real GPU, same session, 10 s per state, sphere 1446×580 — **draw cost
ms**:

| | mean | p50 | p95 | p99 |
|---|---|---|---|---|
| **idle** step 4 (`65e62b8`, 2026-08-16) | 2.75 | 1.9 | 11.3 | 15.2 |
| idle — pre-step-5 control (today) | 2.81 | 2.0 | 11.4 | 14.8 |
| **idle — step 5, HEAD** | **2.73** | **2.0** | **11.4** | **14.7** |
| drag — pre-step-5 control | 2.87 | 2.2 | 11.7 | 14.4 |
| **drag — step 5, HEAD** | **2.73** | **2.0** | **11.5** | **13.6** |
| immersive — pre-step-5 control | 2.26 | 1.5 | 10.9 | 12.8 |
| **immersive — step 5, HEAD** | **2.36** | **1.7** | **11.0** | **13.4** |
| *this run's own drift* (`idleAfter` − `idle`) | *−0.39* | *−0.3* | *−0.3* | *−1.1* |

**Step 5 is cost-neutral.** Idle −2.8%, drag −4.9%, immersive +4.4% — every one
of them smaller than the run's own drift control, which moves the mean by −13%
between two measurements of the *same* state 40 s apart. Say it plainly: the
instrument cannot resolve a difference this small, and there is no reason to
expect one, because the node layers went into buffers the edge slice already
uploads.

Worth recording as a validation: step 4's headed idle mean reproduces three days
later on the pre-step-5 build (2.75 → 2.81). The headed instrument is stable;
the immersive pixel column is not.

Headless (software GL), same session, from the manifests — the like-for-like
successor to task 7's quoted figures, which were this instrument's
projector row:

| projector@1x, headless | idle p50/p95 | drag | immersive |
|---|---|---|---|
| pre-step-5 control | 5.8 / 16.1 | 6.1 / 15.8 | 9.1 / 18.4 |
| step 5, HEAD | 5.3 / 16.2 | 5.1 / 14.7 | 8.3 / 18.0 |

## Gates at capture

```
npx vitest run                 1188 passed / 111 files
npm run lint                   0 errors, 144 warnings   (ratchet 153)
npm run build                  clean
node scripts/artSmoke.mjs      9/10 — see below
node scripts/artPresence.mjs   19/19
node scripts/artCompare.mjs baseline/t8ctrl baseline/t8wip    21/21 within 4
node scripts/_t7tail.mjs       18/18      node scripts/_t6ghost.mjs  16/16
node scripts/_t5rings.mjs      14/14      node scripts/_t3disc.mjs   20/20
```

`artSmoke` scored **9/10**, failing `3b hover between nodes reports an edge —
no edge found on the probe grid`. This is the recorded flake: it fails about one
run in three, on the WIP build *and* on the control with the source stashed. Name
captured rather than re-run to green. Its failure mode — a fixed probe grid on a
rotating sphere — is the same coordinate-staleness family as the bug `fc2909a`
fixed in `artBaseline`, and it is now the last flaky gate on the branch.

One environment note, so it is not mistaken for a defect next time: the first
`artSmoke` run of the session died on `waitFor timed out: sphere` (not `boot`).
The dev-server log showed `new dependencies optimized … reloading` — a one-time
cold Vite dep-optimize force-reloading the page mid-boot. Warm the cache first.

## Scratch instruments this step leaves behind

All untracked, all in `scripts/`:

- `_nodeShot.mjs --tag X` — forces all thirteen layers, prints the census and
  the coverage table above. Two counts (`chimeraSync`, `chimeraFlicker`) vary
  run to run on an identical build.
- `_t8align.mjs A B` — full-resolution luminance correlation per state between
  two capture sets. The instrument that found the immersive finding. Run it
  before quoting any ratio from a new pair.
- `_t8immRot.mjs <state> <sets…>` — the same correlation as a matrix across
  many sets, which is what showed the rotational grouping.
- `_t7tail.mjs`, `_t6ghost.mjs`, `_t5rings.mjs`, `_t3disc.mjs` — the per-task
  layer proofs.
- `_crop.mjs in out x y w h [scale]` — so a 2 px ring can be looked at.

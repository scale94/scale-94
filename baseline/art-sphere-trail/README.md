# /art sphere — trail-accumulation reference

Captured on `fix/art-sphere-index-space` at `31bff8a`, with the GL layers'
frame-to-frame ink accumulation restored (step 4 Tasks 1–3 plus the trail
sub-project, pulled forward from step 6 on the author's call).

```bash
node scripts/artBaseline.mjs --out baseline/<name>
node scripts/artCompare.mjs baseline/art-sphere-trail baseline/<name>   # the gate
node scripts/artInk.mjs     baseline/art-sphere-trail baseline/<name>   # the stronger instrument
node scripts/artPresence.mjs                                            # 5/5
```

## THIS IS THE FIRST VALID IMMERSIVE CAPTURE SET

Immersive mode was never fullscreen. `.tab-fade-v2` animates with `fill-mode:
both`, so it permanently retained its 100% keyframe — `filter: brightness(1)
blur(0px)` and `transform: translateY(0)`. Both are **visually identity**, and
both establish a containing block for `position: fixed` descendants, so /art's
`fixed inset-0` immersive container resolved `inset: 0` against the tab wrapper
instead of the viewport. Fixed in `31bff8a` (`backwards` instead of `both`).

It was pre-existing since before the migration, and **no pixel gate could ever
have caught it**: every gate compares captures *of the canvas*, and the canvas
was consistently the wrong size in all of them. Verified in this set:

| scale | non-immersive states | `immersive-on` here | `immersive-on` in every earlier set |
|---|---|---|---|
| laptop-1520x900@1x | 1446×580 | **1520×900** | 1456×540 |
| laptop-1520x900@2x | 2892×1160 | **3040×1800** | 2912×1080 |
| projector-1920x1080@1x | 1800×580 | **1920×1080** | 1800×324 |

The projector row is the exhibit: **1920×1080, the whole panel**, against 1800×324
— 3.3× the drawing area. Every committed `immersive-on` baseline before this one,
including `baseline/art-sphere-2d`, is invalid, and `artInk` correctly refuses to
print a ratio for those rows (`GEOMETRY MISMATCH … NOT COMPARABLE`).

`immersive-off` is no longer blank either, for an unrelated reason: Task 4 added
a forced-resize dance to `artBaseline.mjs` (throwaway capture → `pump(150)`), so
the shot now lands after the sphere has repainted rather than on the last frame
before the resize. Its ink is 14–19× the step-3 figure and 0.98× `t4wip`'s, which
is where that jump comes from. `artInk` still labels it "blank — proves nothing";
that label is now stale but conservative.

## What the trail is, and what it was worth

The 2D canvas never wiped. It cleared with `destination-out` and
`rgba(0,0,0,m)` — a **partial alpha erase** — so everything drawn after it
compounded. A layer redrawn at alpha `a` every frame settles at

```
steadyState(a, m) = a / (1 - (1 - m)(1 - a))          src/terminal/art/artTrail.js
fadeGain(m)       = 1 / m                             ← the a -> 0 limit only
```

`m` is per-mode: **0.72 normal, 0.32 immersive**, so the small-alpha standing
gains are **1.389×** and **3.125×**. A layer that moved to the GPU drew into a
target that *was* fully rewritten each frame and lost that silently — no error,
no missing geometry, just less light.

Restored with a ping-pong `NoColorSpace` accumulator (`SphereTrail.js`). The rift
base is deliberately **not** in it: `sphereBackgroundInk()` yields premultiplied
layer ink with coverage in alpha, and the base enters once in the screen pass as
`ink.rgb + uRift * (1 - ink.a)`. Pushing the clear through the accumulator would
multiply the whole frame by `1/m`, which every instrument here reads as nothing
worse than "brighter".

## The fifth presence check — TRAIL ACCUMULATION

The comparator cannot see this layer, so it gets a bespoke check like the four
before it. What is distinctive is not brightness — a wrong constant is also
brighter — but that ink must **rise** over the first frames after a layer
switches on, at a rate set by the mode's own clear alpha.

**Whole-frame ink cannot be the metric.** The rift base and the 2D canvas are
large constants that do not rise, and they drag any whole-frame ratio toward 1.0
whatever the accumulator is doing. So the metric is a *difference* against the
same frame with one layer off, and every constant subtracts out.

The probe is the **exergy pulse**: the only migrated layer that is a clean step
function of a harness hook, with no easing and no time term, large in area, and
drawn at a genuinely small alpha. That last one is not optional — the stacked
ghosts the check above uses reach alpha 0.89, where the gain is 1.08.

| mode | m | drawn alpha | ratio f30/f1 | asserted `g(0.06)` — a **bound** | model `R(m)` | `fadeGain(m)` |
|---|---|---|---|---|---|---|
| normal | 0.72 | 0.06 at centre → 0 at rim | **1.386–1.408** | 1.357 (+2.1…+3.8%) | 1.370 (+1.2…+2.8%) | 1.389 (−0.2…+1.4%) |
| immersive | 0.32 | 0.06 at centre → 0 at rim | **2.675–2.723** | 2.772 (−1.8…−3.5%) | 2.905 (−6.3…−7.9%) | 3.125 (−12.9…−14.4%) |

*(seven runs of the normal row, six of the immersive one — the immersive spread
2.675 / 2.675 / 2.675 / 2.679 / 2.685 / 2.723 is this measurement's run-to-run
noise, i.e. ±0.9%.)*

**`fadeGain` is the wrong target and the plan's "within 15% of `fadeGain(m)`"
would have been a coin flip** — it passes immersive by 0.7 percentage points. The
check asserts on `steadyState(exergyAlpha(1), m)/exergyAlpha(1)` instead, the same
tested arithmetic the renderer fades with.

### The asserted number is a lower bound, and the measurement sits *below* it

Read this before trusting the −3.5% in that table. The pulse is a **gradient**,
and the gain `g(a) = 1/(1 − (1−m)(1−a))` *rises* as `a` falls, so the asserted
`g(0.06)` — computed at the centre alpha, the largest alpha anywhere on the disc
— is the **smallest** gain the pulse can show. It is a strict lower bound, not
the expectation.

The expectation is the ink-weighted average over the gradient. With `a(u) =
0.06u`, `u = 1 − t`, first-frame ink `∝ u²` and disc area element `∝ (1−u)du`:

```
R(m) = ∫₀¹ u²(1-u)·g(0.06u) du ÷ ∫₀¹ u²(1-u) du       denominator = 1/12
R(0.32) = 0.2420 / 0.08333 = 2.905        R(0.72) = 1.370
```

So: model **2.905**, bound **2.772**, measured **2.675–2.723**. The measurement is
6–8% under the model and **1.8–3.5% under its own lower bound** — the model is
violated, and that is recorded here rather than tuned away. Two mechanisms,
neither of them measured yet:

1. **8-bit quantisation moves the reading toward the bound.** Ink is read from a
   quantised composite. Over most of the pulse's area the per-pixel first-frame
   value is order *one byte*; where it rounds to 0 the faint outer annulus —
   precisely the high-gain, small-`a` region — never enters either frame. That
   drags the expectation from 2.905 down toward 2.772. It cannot push below it.
2. **The same rounding biases the ratio down.** Round-to-nearest lifts a
   0.5–1.5-byte frame-1 pixel proportionally more than its ~2.9× larger frame-30
   counterpart, so `s1` is inflated relative to `s30`. This is the leading
   candidate for the residual 3.5%; channel saturation at the pulse centre, where
   the composite is already brightest, clips the magenta lean at frame 30 and not
   at frame 1, and points the same way.

What the check therefore defends is the **shape** — immersive in 2.7–3.1 against
normal in 1.36–1.41, a measured separation of **1.90–1.94×** against a predicted
2.04–2.12× — not a three-digit constant. `TOLERANCE = 0.15` brackets
[2.675, 2.905] with room, deliberately.

**If this number moves, suspect the buffer format first.** `HalfFloatType` on the
accumulator is a one-token change already on the backlog for the OLED banding
(plan Risk 2). It removes the quantisation floor, so it should move immersive
*up* toward 2.905 — that would be the model finally being satisfied, not a
regression. Whoever makes that change should expect this row to move and should
not re-tune the tolerance to hide it.

Both modes are asserted, and that is load-bearing: `survival` is read per-frame
from the tint the 2D canvas erased with (`state.rift.a`), and hard-coding it to
either mode's value still passes in that mode. **And each row asserts the mode it
claims to be.** Reading `m` from the page and computing `expected` from that same
read is self-fulfilling: if the immersive toggle lands but the mode never
engages, `m` stays 0.72, `expected` becomes 1.357, the ratio reads ~1.39 and the
row goes green *labelled immersive*. So the rows now also assert `m ===
RIFT_ALPHA_NORMAL` / `RIFT_ALPHA_IMMERSIVE`, that the two `m` differ, that the
sphere grew, and that it reached ≥98% of the viewport. Verified by forcing the
failure: with the toggle click suppressed, the row reports `MODE NEVER ENGAGED —
expected m=0.32`, `1446x580 -> 1446x580 DID NOT GROW`, `NOT FILLED`, and the run
exits **4/5** non-zero. Note what that same row read on its own terms: **dev
1.0%** — the tightest deviation in the whole table. Before this fix it was the
greenest row in the check while the exhibit mode had never once been entered.

`MAX_DRIFT` is 0.02, not the 0.10 it shipped with. Drift does not cancel in the
ratio — `s30` absorbs the whole 30-frame drift against `off1`, `s1` about 1/30 of
it — so 0.10 could have eaten two thirds of the 0.15 tolerance budget on its own.
Measured drift is 0.13–0.58%, so 0.02 leaves 3.4× headroom over the worst reading
in six runs.

The check also validates its own instrument. The virtual clock advances one frame
per pump, so the sim is *not* frozen and the frame drifts under the measurement.
That drift is measured over an identical 30-frame window with the layer off:
**0.14–0.55% of the first frame's signal**, three orders below it, and it is part
of the verdict rather than a footnote.

Reproducibility: normal 1.386 / 1.390 / 1.390 / 1.391 / 1.406 / 1.406 / 1.408,
immersive 2.675 / 2.675 / 2.675 / 2.679 / 2.685 / 2.723.

## Ink — step 3 → this set

`node scripts/artInk.mjs baseline/art-sphere-step3 baseline/art-sphere-trail`,
mode rollup (`immersive-on` excluded on every row — geometry, see above):

| scale | [frame] normal | [disc] normal |
|---|---|---|
| laptop-1520x900@1x | 1.014 | 1.027 |
| laptop-1520x900@2x | 1.006 | 0.990 |
| projector-1920x1080@1x | 1.016 | 1.032 |

Normal mode barely moves, and that is expected rather than disappointing:
at `survival = 0.28` the trail tail is 1–2 frames long (`round(13×0.28)=4`,
`round(4×0.28)=1`, gone) and lands **below artInk's noise floor of 6**, so the
instrument cannot see most of what normal mode regains even though it is there.
The exhibit-mode measurement is Task 4's same-session control pair
(`t4ctrl` → `t4wip`), which is the only apples-to-apples reading of the trail
itself:

| | normal | **exhibit** | cross |
|---|---|---|---|
| [disc] laptop@2x | 1.043 | **1.588** | 1.523 |
| [frame] laptop@2x | 1.047 | **1.383** | 1.320 |
| [disc] projector | 1.094 | **1.254** | 1.147 |
| [frame] projector | 1.068 | **1.188** | 1.112 |

Exhibit mode moved 4–13× further than normal mode, which is the shape the
arithmetic predicts. Whole-frame is reported beside disc throughout, because
disc-only ink in immersive has ±12% run-to-run noise — the same size as some
signals.

Against `t4wip` (same code, different session) this set reads **0.996–1.022** on
every normal-mode rollup, inside the documented ±1.5% capture noise.

## The comparator is blind, and here is the sharpest proof yet

`node scripts/artCompare.mjs baseline/art-sphere-step3 baseline/art-sphere-trail`
→ **21/21 within threshold 4**, max mean 2.524.

It scored green across a pair whose `immersive-on` frames are **1800×324 vs
1920×1080** — a different picture of a different amount of world, 3.3× the
pixels — and only nudged the mean to 2.5. A 32×18 mean-luminance signature
resamples geometry away and averages thin content into its cell's dark majority.
This is the same instrument that scored a measured 22% edge-ink loss as 21/21
green. **Use `artInk.mjs` and the presence checks; the comparator answers "did
anything move", never "is it right".**

## Cost

Headed Chrome, real GPU, `scripts/artFrameTime.mjs --seconds 10`, draw cost in
ms against a 16.7 ms budget. Measured against a **same-session control**: a
worktree at `6401a7b` (the last commit before the accumulator existed) served on
a second port, runs interleaved.

**Provenance of `frametime-headed-gpu.json` in this directory.** It is the *last
trail run of that interleaved series* — run 7, the "run pair 2 / this build"
column in both tables below (idle 2.1 / 12.2 / 15.6, immersive 1.8 / 11.5 /
14.2). It records `"gitCommit": null` because the script depended on
`BASELINE_COMMIT` being exported and it was not, which left the file
indistinguishable from a control-worktree run of the same script. **The value has
deliberately not been hand-edited** — a provenance field written by hand is worth
less than one that is missing. The script now derives commit, branch and
tracked-dirty state from `git` itself, so any future capture carries them; the
fix is verified by scratch runs recording
`c8284e4 / fix/art-sphere-index-space / dirty`. This file stays as captured at
`31bff8a`, which is what `manifest.json` beside it records.

| idle draw cost | ctrl `6401a7b` | this build |
|---|---|---|
| run pair 1 | 2.2 / 12.2 / **15.9** | 2.1 / 12.1 / **15.2** |
| run pair 2 | 2.1 / 12.3 / **16.3** | 2.1 / 12.2 / **15.6** |

*(p50 / p95 / p99)*

**The accumulator's cost is at or below the noise floor** — this build is
fractionally *faster* at p99 in both interleaved pairs. Step 3's recorded idle
figures (2.1 / 11.9 / 15.4) reproduce exactly.

`artFrameTime.mjs` now measures **immersive** too, which it never has:

| immersive draw cost | ctrl (1456×324, letterboxed) | this build (1520×900, real) |
|---|---|---|
| run pair 1 | 1.8 / 11.6 / **14.8** | 1.8 / 11.6 / **14.1** |
| run pair 2 | 1.8 / 11.7 / **15.1** | 1.8 / 11.5 / **14.2** |

The exhibit mode draws 1.6× the pixels of the non-immersive states and is
**inside the noise of them**, which is the useful finding: cost here is not
simply pixel-bound.

### It read *cheapest*, and that was a confounded reading — retracted

This section previously said the exhibit mode is "the cheapest of the three
states … which says the p99 tail is not pixel-bound". That does not survive.
**Immersive is measured last in every run**, on a machine that warms
monotonically over the first ~5 minutes of a session with ±5 ms of p99 spread on
identical code, and there was no re-measurement of idle at the end. An
always-last state reading lowest is exactly what warm-up alone predicts.

`artFrameTime.mjs` now carries the drift control that would have caught it: a
**fourth** window, idle again, measured after leaving immersive, with the
difference recorded as `drift` in the JSON and printed. Two runs of it on this
build (draw cost p50 / p95 / p99):

| run | idle | drag | immersive | idle again | p99 drift |
|---|---|---|---|---|---|
| A | 2.3 / 12.6 / 18.4 | 2.4 / 12.6 / 17.3 | 2.4 / 14.1 / **18.3** | 2.2 / 14.6 / 17.8 | −0.6 |
| B | 2.6 / 15.1 / 18.9 | 3.2 / 16.0 / 20.7 | 2.7 / 15.7 / **19.0** | 2.5 / 15.6 / 19.2 | +0.3 |

Immersive is **not** the cheapest state in either: it lands on top of idle (+0.1
and −0.1 at p99) while costing +1.5 and +0.6 at p95 — and the p95 drift over run
A alone is +2.0, larger than that. Both the old "cheapest" claim and any p95
ordering are inside this instrument's own drift. (These two runs are a drift
measurement, not a re-baselining: they were taken on a busier machine, ~3 ms
higher at p99 across every state, which is the warm-up caveat restated.)

**What the data supports:** the three states are indistinguishable at p50 and
p99, and immersive is at most slightly more expensive at p95 despite 1.6× the
pixels. So the p99 tail is not proportional to pixel count — it is GC, texture
upload or the bloom mip chain — but "immersive is cheapest" was warm-up.
The script now prints a ⚠ whenever |p99 drift| reaches half the spread between
states, i.e. whenever a run cannot support an ordering claim at all. Run A trips
it.

**Said plainly, because the plan asked for it plainly:** the first three runs of
the session read p99 **19.1 / 20.0** on this build and **16.4** on the control,
i.e. over budget on both. They converged downward over ~5 minutes of warm-up on
both builds equally. So p99 *does* cross 16.7 ms on a cold or loaded machine —
but it crossed it on the pre-trail build too, and the trail is not why. Run-to-run
spread at p99 is ±5 ms on identical code, which dwarfs anything this commit did;
p50 (2.1 ms) and p95 (12.2 ms) are stable and well inside budget. **No routing
change.** The fallback — folding the fade into the backdrop shader's first
instruction, trading a bind for a texture read — is not needed and would buy
nothing measurable.

## Corrections to step 3's sign-off

Recorded here because three signed-off steps were measured with instruments blind
to this class of error.

1. **Step 3's background layers lost accumulation too, not just step 4's edges.**
   Task 1 measured it: immersive-on was losing **44% of lit pixels**, all in the
   faintest band, with the mass reappearing below the floor — dimming with mass
   conserved, not deletion. The loss peaks at `0.9–1.0 × sphereR`, the wireframe
   radius, where `WIRE_ALPHA = 0.03` predicts a 22.5 → 7.65 luminance drop once
   accumulation is gone. Step 3's "COMPLETE / verified" status was true for
   *placement* and false for *weight*: every one of its seven layers rendered in
   the right place at roughly a third of the light it should carry in immersive.
   Full evidence in `.superpowers/sdd/trail-deficit.md`.
2. **Step 3's cost figures stand.** Re-measured against a same-session control
   above; the p50/p95/p99 it recorded reproduce.
3. **Step 3's immersive parity claims never measured immersive.** See the
   geometry table at the top. Its `immersive-on` rows described a 1800×324 strip.

## Dev-only harness hooks

All inside `if (!import.meta.env.DEV) return`, so the bundler drops them:

- `__artHarnessReset()` — resets rotation, positions, particles; pins rotation to `rx=0.18, ry=0`
- `__artSetEcocide({ metabolicRift, exergyRate })` — the bus is module-scoped and unreachable otherwise
- `__artSetGhosts(positions?)` — seeds last session's positions; no argument synthesises a ring
- `__artBgState()` / `__artEdgeState()` — read back what the draw loop last published

## Gates at capture

`npx vitest run` 1032 / 109 files · `npm run lint` 0 errors, 145 warnings
(ratchet 153) · `npm run build` clean · `node scripts/artSmoke.mjs` 10/10 ·
`node scripts/artPresence.mjs` **5/5** · `node scripts/artCompare.mjs` 21/21.

## Known-bad states

`immersive-off` now carries a fully painted sphere (see above) and is no longer
the "proves nothing" frame its label claims. Boot fingerprints are **not**
reproducible (8 relaunches, 8 fingerprints), so `artBaseline.mjs --out <dir>`
over an existing `manifest.json` will re-gate on an unreachable fingerprint and
fail after 8 tries — `rm -rf` the output directory before every re-capture.

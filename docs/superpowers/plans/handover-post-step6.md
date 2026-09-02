**SUPERSEDED by `handover-post-step7.md`.** Kept because it holds the
step-6 account and the conductor pre-flight. Start from the newer file.

Continue the /art sphere Canvas2D→WebGL migration on `fix/art-sphere-index-space`
(F:\scale_9.4).

**Steps 5, 6 and 7 are COMPLETE.** Every node layer, the whole particle ecology
and the Bifurcation Conductor are on the GPU. **`ArtTab.jsx` is down to two
`ctx.` sites** — `setTransform` and the `destination-out` clear — and no layer
draws to the canvas. The spec's "the 2-D canvas is now empty" is finally true.

STATE: the last CODE commit is **`f5ae8a5`**; every commit after it is
documentation, and this file is the newest of them. Tracked tree clean. The
branch is 20+ commits ahead of `origin/fix/art-sphere-index-space` — run
`git log --oneline origin/fix/art-sphere-index-space..HEAD` for the exact list
rather than trusting a number written down here. The ledger `.superpowers/sdd`
is its own private repo (`scale-94-notes`), ahead at `4abbce0`. `main` is
untouched at `a54ea3e`.

**Do not push, do not merge, do not touch `main`.** The author protects `main`
from unstable code and will not merge this until the whole refactor is complete,
confirmed and stable. Report to him and he decides. A new push needs a new
explicit command.

`.superpowers/sdd` has `.gitignore = *`, so ledger files need `git add -f` and a
separate commit in that repo. The untracked `scripts/_*` (57) and `baseline/*`
(142 dirs) scratch files are deliberate; leave them until item 5.

READ FIRST, in this order:
1. `.superpowers/sdd/step6-report.md` — what step 6 moved, the two gates that
   were reading the layer it removed, and the ink finding it could not explain.
2. `baseline/art-sphere-step5-certified/README.md` — the reference everything is
   measured against.
3. `.superpowers/sdd/post-step5-task2-report.md` and `-task3-report.md` — why the
   null is a gate, and the shared-RNG root cause.
4. `.superpowers/sdd/progress.md`, last section — the ledger's own backlog.
5. `docs/superpowers/specs/2026-08-04-art-sphere-webgl-design.md` §Step 6 — it
   carries a correction block at the top now; read that before the paragraph it
   corrects.

---

## THE ONE THING THAT CHANGES HOW YOU MEASURE

**A capture set must prove it repeats before anything measured on it may be
quoted.** `scripts/artNull.mjs` computes the same-build null — worst-pair
luminance correlation at full resolution, per cell, across N captures of one
build — and `artNull … --write <dir>` stamps the result into that set's manifest
as `repro`. `artCompare` refuses to print `ok` for a row whose set carries no
certificate. Three sets minimum, five for a reference.

**This is not theory: the gate refused the step-5 reference three times and was
right every time**, and it refused step 6's first refactor proof, which is how
the live immersive race was found. If you are reaching for `--ungated`, that is
the history you are betting against.

```bash
node scripts/artBaseline.mjs --out baseline/wip-a        # and -b, -c
node scripts/artNull.mjs baseline/wip-a baseline/wip-b baseline/wip-c --write baseline/wip-a
node scripts/artCompare.mjs baseline/art-sphere-step5-certified baseline/wip-a
node scripts/artInk.mjs     baseline/art-sphere-step5-certified baseline/wip-a
```

`--write-partial` certifies only the cells that repeat and marks the rest, so one
bad cell does not block twenty good ones. Use it for the immersive race (item 3),
never to lower the bar.

**Read the manifest's `view` before quoting any row.** It records rotation, drag
velocity, hovered node, sphere radius, both buffer sizes, `arch` (whether the
temporal archaeology had loaded), and **`world`** — an FNV hash over the edge
layer's written instance range, i.e. the projected geometry. Two runs with the
same `world` drew the same graph. That field turned a hunt into a location;
without it the manifest agreed on everything while the pictures did not.

---

## THE WORK, in order

### 1. THE IMMERSIVE RACE — the only thing standing between here and 21/21

Step 7's parity run certified **19 of 21** cells. Both refusals were
`immersive-off`, at 2x and at the projector scale, and this is the same race the
last three sessions could not close. It is now the top item because nothing else
blocks a full certificate.

**What step 7 added to the picture, from three fresh sets:**

- `immersive-on` is **bit-identical across all three sets at all three scales**
  (`7a133196`, `43b76b01`). Only `immersive-off` diverges. Earlier write-ups say
  the race "hits `immersive-on` and `immersive-off` at all three scales" — on
  this evidence `immersive-on` is clean, so either it has been fixed or the
  earlier claim was over-general. **Check before inheriting it.**
- At the projector scale one set drew **121 edges against 123**. That is a
  genuinely different graph, not a numeric wobble — a stronger signal than
  earlier rounds recorded, and it means the divergence happens BEFORE the edge
  set is decided.
- At 2x the edge count was identical (134) with three distinct world hashes, so
  the same graph came out at different coordinates. **Those two are different
  failures and may have different causes** — do not assume one fix covers both.

Everything the older item said still stands: `--scale` is a ~6x harsher test, so
measure with three-scale captures; `_t9trace.mjs` mirrors the immersive window
faithfully and costs ~1 minute against a capture's four; and `3551885`'s
write-up claims a fix its own call sites cannot deliver, so what actually
changed between `7f5f2ce` and now is **not established**.

**The measured detail, carried forward from the older item 3:**

Three attempts have not closed it. What is measured:

| launch | divergent sets |
|---|---|
| three-scale | **1 in 20** |
| single-scale `--scale` | **6 in 20** |

**`--scale` is not merely a faster test, it is a ~6× harsher one.** Its own
documentation says it costs "none of the extra information", which is false: it
changes the launch context (a cold first browser launch instead of the second of
three) and that changes a real-time race. **Measure with three-scale captures.**

It hits `immersive-on` and `immersive-off` at all three scales — three different
cells across one session — always bit-identical through the five earlier states,
always at identical `rot`, `sphereR`, buffer sizes and edge count. Two worlds,
`4d369bc6` and `3d36d7e1`, in a stable ratio.

**A correction to `3551885`'s write-up:** those two hashes are the pair seen at
`7f5f2ce`, i.e. *before* the sweep that was written up as completing the fix, and
that sweep's four call sites plausibly never execute during a capture at all
(`useAssociativeField:213` is init, `:272` fires only on numerical escape near
r = 4, and the two in `useAnalogicalReasoning` need an analogy probe). The sweep
was right in principle and is very unlikely to be what fixed this cell. What did
change between `7f5f2ce` and now is **not established**.

`scripts/_t9trace.mjs` now mirrors the capture's immersive window faithfully — it
had omitted the real `hover(away)` input, its 25 ms settle, and the 600-frame
pump between the two shots, which is why it reported 1740 identical frames while
the capture it stood in for was splitting 3 in 8. It costs ~1 minute a run
against a capture's four. **That is the instrument to reach for.**

### 2. The ink excess step 6 could not explain

Normal-mode whole-frame ink is **+1.6% to +2.7%** after the particle migration,
against **1.001–1.003** for step 6's provably inert changes measured the same way
against the same reference. So it is the particle layer.

It tracks particle count and size — projector: 1.006 at 12 particles, 1.017 at
89, **1.055 at fired-cascade's 147**, which also emits the largest, node-burst
particles — and it **flips sign in immersive** (frame 0.997), where the standing
gain is 3.125× rather than 1.389×. **That points at the accumulation path, not
the rasteriser.**

**One hypothesis is already tested and REFUTED — do not spend it again.** The
shader's straight-edge box filter over-inks a disc by 1/12 px² (52% at R = 0.4,
nothing at a node's 8–25 px), and particle cores are the first sub-pixel discs
here. The mechanism is real and is now corrected. It moved the frame ratios by
**nothing**, because particle cores are ~2% of frame ink so an 8% correction on
them is 0.16% of the frame. The arithmetic would have said so before three
capture sets were spent on it: *check whether a mechanism's MAGNITUDE can account
for the observation before you go and measure it.*

### 3. The spoke's 1.098 GL/2D ratio — never actually gated

Step 4 task 6 measured the star spokes **9.8% brighter in GL than in 2D** and the
controller dissented: a ~10% bright sub-layer must not be baked into the
reference. It was recorded as "carried forward as a TASK 7 GATE".

**It was never gated.** `4cff695` touched only baselines, the spec,
`artBaseline.mjs` and `artSmoke.mjs`. So the 1.098 is baked into
`baseline/art-sphere-step4/`, `baseline/art-sphere-step5/` **and
`baseline/art-sphere-step5-certified/`**.

Verify it still reproduces before acting — it is weeks old and `65e62b8` changed
the same amplitude family under it. **Trap: `grep 1.098` is useless**; that
string appears in `trail-deficit.md` as unrelated ink ratios. Also open from that
task: the 1.526 px notch, and whether `CURVE_MAX_SEGMENTS = 24` binding routinely
is silently coarsening the flatness guarantee.

### 4. A whole-branch review, and then the sweep

Never run, and the debt is large. Unreviewed: step 4 task 6 (its reviewer was
killed twice), `cbf22f1` from a parallel session, step 5 tasks 1–8, and this
session's `9661dfa`, `7f5f2ce`, `3551885`, `dd14af6`, `08a9ea5`, `590a9da`,
`dd4bf46`, `fbd73de`, `e6728f6`. **Review `7f5f2ce`/`3551885` hardest** — they
change what the artwork draws its randomness from — and `dd4bf46`, which is the
first shader change since step 4.

Then sweep the `baseline/` dirs (161 now) and the `scripts/_*` (60 now). Keep the instruments the
records reference: `_t8align`, `_t8immRot`, `_nodeShot`, `_t7tail`, `_t6ghost`,
`_t5rings`, `_t3disc`, `_crop`, `_t9matrix`, `_t9trace` (takes `W H DPR` now),
`_t9tracediff`, `_t9frames`, `_t9cross`, `_t9force`, `_t9shotnull`, `_t9resize`,
`_t9drift`, `_t9dims`, `_s6probe`. Keep as evidence until the reports settle:
`s6bis-*` and `s6t23-*` (the 8-vs-8 bisect that exonerated step 6), `t3w-*`/
`t3r-*` (the flag-off/flag-on control pair), `s9ref-b..e` and `s7ref-b..e` (the
certificates name them).

---

## WHAT THIS BRANCH HAS LEARNED

- **A layer that leaves the 2-D canvas can break an INSTRUMENT rather than a
  picture.** Step 7's port refused 12 of 21 cells at pixel correlations up to
  0.9996: the world hash is an FNV over the whole edge buffer, and moving the
  conductor into it put a CONTINUOUS quantity (the thumb rides the Feigenbaum r)
  inside a hash whose question is discrete. The tell was that every failing cell
  had an identical edge count and a varying conductorY, and every passing one had
  conductorY clamped to exactly 1. Fixed by `eg.worldCount` — **the writer
  declares the boundary, the reader does not guess it**, as `discStart` already
  does. When you move a layer, ask what reads the buffer, not just what draws it.
- **`scripts/` is not linted and not tested, so every constant copied into it is
  a live trap.** `artSmoke` carried `S = 17` and step 7's stride bump made its
  edge hit-test scan misaligned floats — a healthy sphere reading as a dead
  hover, 3 failures in 3 runs. `artPresence` was immune because it IMPORTS
  `EDGE_STRIDE`. That is the whole difference. Third time on this branch.
- **Check a fitted law's RANGE, and say it is a fit.** The disc-shadow term is
  accurate to 0.0289 over `R/sigma in [1.25, 2]` and degrades outside it; the
  test asserts the range as well as the error, so the next caller cannot quietly
  inherit a number that was never measured for them.
- **Ask what the gate can actually SEE before quoting it.** Nine of thirteen node
  layers were in no capture state; particles were in none until step 6; the
  conductor is in none now. This is the defining failure mode and it has recurred
  seven times.
- **Check a mechanism's MAGNITUDE against the observation before measuring it.**
  Step 6 spent three capture sets confirming a real mechanism that could only
  account for 0.16% of a 2% effect.
- **One clean null is not evidence when the fault is intermittent.** Five clean
  sets certified a reference whose race was still live at ~5% on that path.
- **A record that states a mechanism can be wrong, and inherited wrongly.** Task
  1's diagnosis was falsifiable from artifacts on disk; `3551885`'s write-up
  claims a fix its own call sites cannot deliver; the world hash was added on a
  belief that turned out false and says so in the file.
- **Read the instrument's own documentation before quoting its output.**
  `determinism.mjs` carried the entire root cause of the RNG bug in a comment.
- **Look at the render before theorising.**
- **A layer can give itself a null** — clear it, step ONE frame, the difference
  IS the layer.
- **Measure the SHAPE, not the size.** Signed mean, not `|abs|`.
- **Every threshold must be a contrast, never an absolute level.**
- `__pump(n)` **never yields**; a screenshot and a real-time sleep both cost ZERO
  frames, but they cost a yield, which is when real browser tasks land.
- **A bare CLI flag must not swallow the next token** — `artNull`'s parser did,
  and would have silently dropped a capture set from a null.
- **Backticks inside a template literal terminate the string.** Known for the
  GLSL in `SphereEdges.js`; it bit again in `determinism.mjs`, again in step 6,
  and TWICE in step 7 — once in a shader comment and once in a comment inside
  `artBaseline`'s page-eval string, which cost a 12-minute capture. Writing it
  down has not been enough; grep the hunk for a backtick before running.
- **`artNull`'s `--write-partial` is a BARE flag.** The directory belongs to
  `--write`: `... a b c --write a --write-partial`. Passing the directory to
  `--write-partial` silently makes it a fourth capture set and writes nothing.
- **`cd` in a Bash call persists** — use absolute paths.
- **Do not edit source while a capture is running.** The dev server serves live
  files; a mid-run HMR swap makes the set untrustworthy. Discard and re-run.
- **Restore a `git stash`/`git checkout` in its own command**, never chained
  after a long loop that may time out.
- Long-running captures: fresh log filename each run, and wait on the **artifact**
  (`manifest.json`), never a log line.
- Never run vitest with `-u`. Never `git add -A`. Re-read anything in `scripts/`
  before editing it.

## GATES (all green at `f5ae8a5`)

```
npx vitest run          1273 passed / 115 files
npm run lint            0 errors, 145 warnings (ratchet 153 — a new warning is YOURS)
npm run build           clean
node scripts/artSmoke.mjs        10/10
node scripts/artPresence.mjs     19/19
```

`npm run lint` is `eslint . --ext js,jsx` and **does not lint `.mjs` at all** —
`scripts/` has never been in the lint gate.

`artPresence`'s `GENESIS GLOW` and `FLASH GRID` are intermittent: GENESIS GLOW
failed once in three runs at an unmodified tree this session. **Capture the name**
rather than re-running until green, and measure its rate at unmodified HEAD
before assuming a failure is yours.

`--reseed-per-callback` on `artBaseline` and `__reseedEachCallback` in
`determinism.mjs` are a **DIAGNOSTIC, default off**. They change which random
values the app sees, so a set captured with them is a different picture, not a
more reproducible one. Never capture a reference with them.

## The rig

Dev server is `.claude/launch.json` → `scale94-dev` on port 5174. Drive the
browser through `scripts/cdp.mjs`, **never the browser pane** (it reports
`document.hidden`, which suspends rAF).

A `waitFor timed out: boot` is a dead dev server. A `waitFor timed out: sphere`
on a first run in a fresh worktree is the one-time cold Vite dep-optimize
reloading the page mid-boot — warm the cache and re-run.

A three-scale capture takes **3m50s**; five of them, which a reference needs, is
about twenty minutes. Run them in the background and wait on the artifact.

Work as a critical senior dev: no yes-machine, push back when the evidence says
so, and look at the render before theorising about a visual bug. **Do not push or
merge — report to the author and he decides.**

Continue the /art sphere Canvas2D→WebGL migration on `fix/art-sphere-index-space`
(F:\scale_9.4). Supersedes `handover-post-step6.md`.

**PHASE 1 IS FUNCTIONALLY COMPLETE.** Every node layer, the whole particle
ecology and the Bifurcation Conductor are on the GPU. `ArtTab.jsx` holds exactly
two `ctx.` sites — `setTransform` and the `destination-out` clear that drives the
trail fade — and **no layer draws to the canvas**.

STATE: the last CODE commit is **`f5ae8a5`**; everything after it is
documentation, and this file is the newest. Tracked tree clean. Run
`git log --oneline origin/fix/art-sphere-index-space..HEAD` for the exact list
rather than trusting a number written here. The ledger `.superpowers/sdd` is its
own private repo (`scale-94-notes`), ahead at `7869c2a`. `main` is untouched at
`a54ea3e`.

**Do not push, do not merge, do not touch `main`.** The author protects `main`
from unstable code and will not merge until the refactor is complete, confirmed
and stable. Report to him and he decides. A new push needs a new explicit
command.

`.superpowers/sdd` has `.gitignore = *`, so ledger files need `git add -f` and a
separate commit in that repo. The untracked `scripts/_*` (56) and `baseline/*`
(161 dirs) scratch files are deliberate; leave them until item 4.

READ FIRST, in this order:
1. `.superpowers/sdd/step7-report.md` — the conductor, the 18th float, the disc
   shadow, and the world hash the port broke.
2. `.superpowers/sdd/step6-report.md` — the particles, and the ink finding
   nobody has explained.
3. `baseline/art-sphere-step5-certified/README.md` — the reference everything is
   measured against.
4. `.superpowers/sdd/post-step5-task2-report.md` and `-task3-report.md` — why
   the null is a gate, and the shared-RNG root cause.
5. `docs/superpowers/specs/2026-08-04-art-sphere-webgl-design.md` — carries
   correction blocks at the top; read those before the paragraphs they correct.

---

## THE ONE THING THAT CHANGES HOW YOU MEASURE

**A capture set must prove it repeats before anything measured on it may be
quoted.** `scripts/artNull.mjs` computes the same-build null — worst-pair
luminance correlation at full resolution, per cell, across N captures of one
build — and stamps the result into the set's manifest as `repro`. `artCompare`
refuses to print `ok` for a row whose set carries no certificate. Three sets
minimum, five for a reference.

```bash
node scripts/artBaseline.mjs --out baseline/wip-a        # and -b, -c
node scripts/artNull.mjs baseline/wip-a baseline/wip-b baseline/wip-c --write baseline/wip-a
node scripts/artCompare.mjs baseline/art-sphere-step5-certified baseline/wip-a
node scripts/artInk.mjs     baseline/art-sphere-step5-certified baseline/wip-a
```

**`--write-partial` is a BARE flag.** The directory belongs to `--write`:
`... a b c --write a --write-partial`. Passing the directory to
`--write-partial` silently makes it a fourth capture set and writes nothing.
Use partial for the immersive race (item 1), never to lower the bar.

**Read the manifest's `view` before quoting any row.** It records rotation, drag
velocity, hovered node, sphere radius, both buffer sizes, `arch`, and **`world`**
— an FNV hash over the edge layer's instance range. Two runs with the same
`world` drew the same graph.

**`world` now hashes a PREFIX, not the whole buffer.** `eg.worldCount` is the
instance index where projected geometry ends and screen-space furniture begins.
This exists because step 7's port broke the hash: the conductor's thumb rides
the Feigenbaum r, so putting it inside the buffer put a continuous quantity
inside a discrete question, and 12 of 21 cells refused to certify at pixel
correlations up to 0.9996. If you move another layer into that buffer, ask
whether it belongs before or after `worldCount`.

---

## THE WORK, in order

### 1. THE IMMERSIVE RACE — the only thing between here and 21/21

Step 7's parity run certified **19 of 21**. Both refusals were `immersive-off`,
at 2x and at the projector scale. Four sessions have failed to close it.

**What step 7 added, from three fresh sets — check it before inheriting older
claims:**

- `immersive-on` was **bit-identical across all three sets at all three scales**
  (`7a133196`, `43b76b01`). Only `immersive-off` diverged. Earlier write-ups say
  the race hits *both* immersive states at all three scales. On this evidence
  that is over-general — either it was fixed or it was never right.
- At the projector scale one set drew **121 edges against 123**. A genuinely
  different graph, so the divergence happens BEFORE the edge set is decided.
- At 2x the edge count was identical (134) with three distinct world hashes: the
  same graph at different coordinates. **Those are two different failures and
  may have two different causes.** Do not assume one fix covers both.

Older, still true: `--scale` is a ~6x harsher test (6-in-20 divergent sets
against 1-in-20 for three-scale), so **measure with three-scale captures**;
`_t9trace.mjs` mirrors the immersive window faithfully and costs ~1 minute
against a capture's four; and `3551885`'s write-up claims a fix its own call
sites cannot deliver, so what actually changed between `7f5f2ce` and now is
**not established**.

### 2. The particle ink excess step 6 could not explain

Normal-mode whole-frame ink runs **+1.3% to +2.5%** against the certified
reference (step 7 measured 1.013–1.025; step 6 measured 1.017–1.032). Step 6's
provably inert changes measured 1.001–1.003 the same way, so it is the particle
migration. **Step 7 added none of its own** — the conductor is a 1.5px disc at
alpha 0.03 outside the sphere's disc.

It tracks particle count and size — 1.006 at 12 particles, 1.017 at 89, **1.050
at fired-cascade's 147** — and it **flips sign in immersive** (frame 0.998),
where the standing gain is 3.125× rather than 1.389×. **That points at the
accumulation path, not the rasteriser.**

**One hypothesis is tested and REFUTED — do not spend it again.** The shader's
straight-edge box filter over-inks a disc by 1/12 px², which is 52% at R = 0.4.
Real, corrected, and it moved the frame ratios by **nothing**, because particle
cores are ~2% of frame ink. *Check whether a mechanism's MAGNITUDE can account
for the observation before you go and measure it.*

### 3. The spoke's 1.098 GL/2D ratio — never actually gated

Step 4 task 6 measured the star spokes **9.8% brighter in GL than in 2D** and
the controller dissented: a ~10% bright sub-layer must not be baked into the
reference. It was recorded as "carried forward as a TASK 7 GATE".

**It was never gated.** `4cff695` touched only baselines, the spec,
`artBaseline.mjs` and `artSmoke.mjs`. So the 1.098 is baked into
`baseline/art-sphere-step4/`, `baseline/art-sphere-step5/` **and
`baseline/art-sphere-step5-certified/`**.

Verify it still reproduces before acting — it is weeks old and `65e62b8` changed
the same amplitude family under it. **Trap: `grep 1.098` is useless**; that
string appears in `trail-deficit.md` as unrelated ink ratios. Also open: the
1.526 px notch, and whether `CURVE_MAX_SEGMENTS = 24` binding routinely is
silently coarsening the flatness guarantee.

### 4. A whole-branch review, and then the sweep

Never run, and the debt is large. Unreviewed: step 4 task 6 (its reviewer was
killed twice), `cbf22f1` from a parallel session, step 5 tasks 1–8, and
`9661dfa`, `7f5f2ce`, `3551885`, `dd14af6`, `08a9ea5`, `590a9da`, `dd4bf46`,
`fbd73de`, `e6728f6`, `0dea8ed`, `e09ad1e`, `f5ae8a5`. **Review `7f5f2ce` /
`3551885` hardest** — they change what the artwork draws its randomness from —
then `dd4bf46` and `e09ad1e`, the two shader changes.

Then sweep 161 `baseline/` dirs and 56 `scripts/_*`. Keep the instruments the
records reference: `_t8align`, `_t8immRot`, `_nodeShot`, `_t7tail`, `_t6ghost`,
`_t5rings`, `_t3disc`, `_crop`, `_t9matrix`, `_t9trace` (takes `W H DPR`),
`_t9tracediff`, `_t9frames`, `_t9cross`, `_t9force`, `_t9shotnull`, `_t9resize`,
`_t9drift`, `_t9dims`, `_s6probe`, `_s7probe`, `_s7look`, `_s7disc`, `_s7fit`,
`_lookbook`. Keep as evidence until the reports settle: `s6bis-*`, `s6t23-*`,
`t3w-*`/`t3r-*`, `s9ref-b..e`, `s7ref-b..e`, `s7cond-*` (the world-hash failure)
and `s7cond2-*` (the certified candidate).

### 5. THE AUTHOR'S CALL — what phase 1's end actually means

The spec says *"the 2-D canvas is now empty: delete it, its texture and the
composite quad. Phase 1 ends here."* It is now empty of LAYERS, but the
`destination-out` clear still drives the trail fade and `setTransform` still
sets the DPR. **Deleting the canvas is therefore a real change to how the trail
works, not a deletion** — the GL trail accumulator would have to take over the
fade entirely. Do not do it as tidy-up. Cost it, put it to the author.

Also open and his to decide: **immersive is not fullscreen** — the top
navigation bar stays visible (see `lookbook/6-immersive.png`). This is
long-standing and recorded, but immersive is the exhibit mode, so it is worth an
explicit decision rather than another inheritance.

---

## WHAT THIS BRANCH HAS LEARNED

- **A layer that leaves the 2-D canvas can break an INSTRUMENT rather than a
  picture.** The world hash is over the edge buffer; moving the conductor in put
  a continuous quantity inside a discrete question. The tell was that every
  failing cell had an identical edge count and a varying `conductorY`, and every
  passing one had `conductorY` clamped to exactly 1. **When you move a layer,
  ask what READS the buffer, not just what draws it.**
- **`scripts/` is not linted and not tested, so every constant copied into it is
  a live trap.** `artSmoke` carried `S = 17`; the stride bump made its edge
  hit-test scan misaligned floats — a healthy sphere reading as a dead hover, 3
  failures in 3 runs. `artPresence` was immune because it IMPORTS `EDGE_STRIDE`.
  Third time on this branch.
- **Ask what the gate can actually SEE before quoting it.** Nine of thirteen
  node layers were in no capture state; particles were in none until step 6; the
  conductor was in none until step 7. Seven recurrences.
- **State a fitted law's RANGE, and say it is a fit.** The disc-shadow term is
  accurate to 0.0289 over `R/sigma in [1.25, 2]` and degrades outside it; the
  test asserts the range as well as the error.
- **Check a mechanism's MAGNITUDE against the observation before measuring it.**
- **One clean null is not evidence when the fault is intermittent.**
- **A record that states a mechanism can be wrong, and inherited wrongly.**
- **Read the instrument's own documentation before quoting its output.**
- **Look at the render before theorising.**
- **A layer can give itself a null** — clear it, step ONE frame, the difference
  IS the layer.
- **Measure the SHAPE, not the size.** Signed mean, not `|abs|`.
- **Every threshold must be a contrast, never an absolute level.**
- `__pump(n)` **never yields**; a screenshot and a real-time sleep both cost ZERO
  frames, but they cost a yield, which is when real browser tasks land. The
  immersive toggle needs click → force layout → real sleep → pump(1) → settle.
  Getting this wrong renders labels with no geometry, which is what it looks
  like when the GL buffer never resized.
- **Backticks inside a template literal terminate the string.** Known for the
  GLSL in `SphereEdges.js`; it bit again in `determinism.mjs`, in step 6, and
  TWICE in step 7 — once in a shader comment, once in a comment inside
  `artBaseline`'s page-eval string, which cost a 12-minute capture. **Writing it
  down has not been enough; grep the hunk for a backtick before running.**
- **`cd` in a Bash call persists** — use absolute paths.
- **Do not edit source while a capture is running.**
- Long-running captures: fresh log filename each run, wait on the **artifact**
  (`manifest.json`), never a log line. A `nohup ... &` wrapper exits instantly,
  so its "completed" notification is the WRAPPER, not the work.
- Never run vitest with `-u`. Never `git add -A`. Re-read anything in `scripts/`
  before editing it.

## GATES (all green at `f5ae8a5`, re-verified 2026-09-02)

```
npx vitest run          1273 passed / 115 files
npm run lint            0 errors, 145 warnings (ratchet 153 — a new warning is YOURS)
npm run build           clean
node scripts/artSmoke.mjs        10/10
node scripts/artPresence.mjs     19/19
node scripts/_s7probe.mjs        11/11   (needs the dev server)
```

`npm run lint` is `eslint . --ext js,jsx` and **does not lint `.mjs` at all** —
`scripts/` has never been in the lint gate.

`artPresence`'s `GENESIS GLOW` and `FLASH GRID` are intermittent. **Capture the
name** rather than re-running until green, and measure its rate at unmodified
HEAD before assuming a failure is yours.

`--reseed-per-callback` and `__reseedEachCallback` are a **DIAGNOSTIC, default
off**. A set captured with them is a different picture, not a more reproducible
one. Never capture a reference with them.

## The rig

Dev server is `.claude/launch.json` → `scale94-dev` on port 5174. Drive the
browser through `scripts/cdp.mjs`, **never the browser pane** (it reports
`document.hidden`, which suspends rAF).

A `waitFor timed out: boot` is a dead dev server. A `waitFor timed out: sphere`
on a first run in a fresh worktree is the one-time cold Vite dep-optimize
reloading the page mid-boot — warm the cache and re-run.

A three-scale capture takes **3m50s**; three of them is about twelve minutes,
five about twenty. Run them in the background and wait on the artifact.

`scripts/_lookbook.mjs` writes `lookbook/*.png` — the sphere in six states
including the conductor's peer-push glow, which needs 3+ live visitors and can
only be seen by forcing it. Use it when the author wants to look at something.

Work as a critical senior dev: no yes-machine, push back when the evidence says
so, and look at the render before theorising about a visual bug. **Do not push
or merge — report to the author and he decides.**

Continue the /art sphere work on `fix/art-sphere-index-space` (F:\scale_9.4).
Supersedes `handover-post-step7.md`, whose five open items are all still open —
the session between them fixed three defects and closed none of the five.

**PHASE 1 IS FUNCTIONALLY COMPLETE.** Every node layer, the whole particle
ecology and the Bifurcation Conductor are on the GPU. `ArtTab.jsx` holds exactly
two `ctx.` sites — `setTransform` and the `destination-out` clear that drives the
trail fade — and no layer draws to the canvas.

STATE: the last code commit is **`0fdae8d`**. Tracked tree clean. Run
`git log --oneline origin/fix/art-sphere-index-space..HEAD` for the exact list
rather than trusting a number written here. `main` is untouched at `a54ea3e`.
The ledger `.superpowers/sdd` is its own private repo (`scale-94-notes`) at
`7869c2a`, and **it has no entry for the three fixes below** — their evidence
lives in the commit messages instead. Decide whether that is acceptable before
item 4's review, not after.

**The author has seen this build in a live browser and approved it:** "looks
pretty much identical to what's live". That is the stability bar met, not the
visual bar — see item 5.

**Do not push, do not merge, do not touch `main`.** The author protects `main`
from unstable code and will not merge until the refactor is complete, confirmed
and stable. Report to him and he decides. A new push needs a new explicit
command.

`.superpowers/sdd` has `.gitignore = *`, so ledger files need `git add -f` and a
separate commit in that repo. The untracked `scripts/_*` (72) and `baseline/*`
(161 dirs) scratch files are deliberate; leave them until item 4.

READ FIRST, in this order:
1. `.superpowers/sdd/step7-report.md` — the conductor, the 18th float, the disc
   shadow, and the world hash the port broke.
2. `.superpowers/sdd/step6-report.md` — the particles, and the ink finding
   nobody has explained.
3. `git show 0fdae8d 7861912 c075540` — the three fixes, each carrying its own
   measurements. `0fdae8d`'s message is the important one: it records a fix I
   shipped that was WRONG and the gate that caught it.
4. `baseline/art-sphere-step5-certified/README.md` — the reference everything is
   measured against.
5. `.superpowers/sdd/post-step5-task1-report.md` and `-task2-`/`-task3-` — why
   the null is a gate, the shared-RNG root cause, and §2c, which is the single
   most misquoted paragraph on this branch (see "the reports describe the
   harness" below).
6. `docs/superpowers/specs/2026-08-04-art-sphere-webgl-design.md` — carries
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
— an FNV hash over the edge layer's instance range, a PREFIX ending at
`eg.worldCount`. Two runs with the same `world` drew the same graph. If you move
another layer into that buffer, ask whether it belongs before or after
`worldCount`.

---

## THE REPORTS DESCRIBE THE HARNESS. THEY ARE NOT BUG REPORTS ABOUT THE APP.

Read this before you act on any symptom quoted out of this branch's documents,
because a whole session went into it.

Two regressions were reported against `f5ae8a5` with confident mechanisms
attached — a dead fired cascade blamed on "the stride bump / float
misalignment", and an immersive "ResizeObserver / layout desync". **Neither
reproduced.** Both mechanisms were lifted verbatim from this branch's own
write-ups, and in both the original is a HARNESS failure that cannot occur in a
live browser:

- the stride trap was `artSmoke` carrying a hand-copied `S = 17` across step 7's
  bump to `EDGE_STRIDE = 18`. A script defect, already fixed. `__artEdgeState`
  publishes `stride` precisely so an in-page reader cannot drift.
- post-step5-task1 §2c's "the resize stays at the old size for the whole
  600-frame batch" happens **because `__pump` never yields**. A real browser
  yields every frame by definition. The handover's "click → force layout → real
  sleep → pump(1) → settle" is a capture-script recipe, not a bug.

What was measured instead, across 1520/1521/2560 wide, 900/1440 tall, at DPR
1/1.25/1.5: the cascade fires on every hover-confirmed click (rings 3, additive
burst 1.4–5.2x) in normal mode, inside immersive and after toggling back; and
after a live toggle the 2-D CSS box, the 2-D buffer, the GL buffer, the GL CSS
box, `__artEdgeState().w/h` and the window all agree within 100 ms.

**A second report described the discs and particles freezing while the wireframe
kept rotating. That did not reproduce either, and it is still open** — see "what
is unresolved" at the end. The instrument built for it is the reusable part:
`scripts/_y5sync.mjs` asks, for every disc and particle the app PUBLISHED this
frame, whether there is ink at those coordinates, with the LINE layer as its
control. That is a direct test of "the overlay came loose from the projection".
It reads 84–100% for discs and 87–98% for particles through the toggle, after a
drag and over soaks — always at or above the control.

**And the trap that cost the most: `scripts/artFreezeProbe.js` aside, my own
"reproduced!" was a measurement artefact.** I reported 22–25% of bright pixels
frozen in immersive. It was the NAV BAR. Immersive is not fullscreen, the fixed
container runs underneath the top navigation, and that permanently-static text
lands inside the sphere crop. Split by row band: artwork 0.04–0.16%, nav strip
77–87%. **Any immersive pixel statistic must exclude the top ~160 device rows or
it is measuring chrome.**

**Headless Chrome here uses the real NVIDIA ANGLE/D3D11 driver**, not
SwiftShader — `--enable-unsafe-swiftshader` is a fallback, not a forcing flag.
"My rig is software, the author's is not" is not an available explanation for a
difference. Confirm with `WEBGL_debug_renderer_info` rather than assuming either
way.

---

## THE WORK, in order

### 1. THE IMMERSIVE RACE — the only thing between here and 21/21

Step 7's parity run certified **19 of 21**. Both refusals were `immersive-off`,
at 2x and at the projector scale. Four sessions have failed to close it.

**From three fresh sets at step 7 — check before inheriting older claims:**

- `immersive-on` was **bit-identical across all three sets at all three scales**
  (`7a133196`, `43b76b01`). Only `immersive-off` diverged. Earlier write-ups say
  the race hits *both* immersive states at all three scales. On this evidence
  that is over-general — either it was fixed or it was never right.
- At the projector scale one set drew **121 edges against 123**. A genuinely
  different graph, so the divergence happens BEFORE the edge set is decided.
- At 2x the edge count was identical (134) with three distinct world hashes: the
  same graph at different coordinates. **Those are two different failures and
  may have two different causes.** Do not assume one fix covers both.

**NEW, and check it first:** `0fdae8d` changed when `SizeSync` stops dispatching
resizes, which is resize behaviour inside the window this race lives in. It
*should* be inert at all three capture scales — at 1520@1 and 1920@1 the ratio
is 1, and at 1520@2 `compositeDpr` caps to 1.5 and 1446 × 1.5 = 2169.0 exactly,
so `floor` and the old `round` agree — but that is arithmetic, not a
measurement. Run `node scripts/_x6sizesync.mjs <dpr>` at each capture geometry
and confirm `resizesIn3s` is 0 and unchanged before you re-capture anything.

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
migration. Step 7 added none of its own.

It tracks particle count and size — 1.006 at 12 particles, 1.017 at 89, **1.050
at fired-cascade's 147** — and it **flips sign in immersive** (frame 0.998),
where the standing gain is 3.125× rather than 1.389×. **That points at the
accumulation path, not the rasteriser.**

**One hypothesis is tested and REFUTED — do not spend it again.** The shader's
straight-edge box filter over-inks a disc by 1/12 px², which is 52% at R = 0.4.
Real, corrected, and it moved the frame ratios by **nothing**, because particle
cores are ~2% of frame ink. *Check whether a mechanism's MAGNITUDE can account
for the observation before you go and measure it.*

**A second candidate is now on the table.** `0fdae8d` proved that a GL buffer one
device pixel short of the 2-D canvas resamples the composite and costs every
prism sub-layer ~5% of its ink — a whole-frame ink shift from a sub-pixel size
disagreement. Before hunting the accumulation path again, confirm the capture
geometries were texel-exact when the 1.013–1.025 numbers were taken. If they
were not, part of the excess may be this and not the particles.

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

Not to be confused with `artPresence`'s star-spoke presence check, which is a
different measurement and reads 25.03–25.08 against a 19.5 bar at HEAD.

### 4. A whole-branch review, and then the sweep

Never run, and the debt is large. Unreviewed: step 4 task 6 (its reviewer was
killed twice), `cbf22f1` from a parallel session, step 5 tasks 1–8, and
`9661dfa`, `7f5f2ce`, `3551885`, `dd14af6`, `08a9ea5`, `590a9da`, `dd4bf46`,
`fbd73de`, `e6728f6`, `0dea8ed`, `e09ad1e`, `f5ae8a5`, **`c075540`, `7861912`,
`0fdae8d`**. **Review `7f5f2ce` / `3551885` hardest** — they change what the
artwork draws its randomness from — then `dd4bf46` and `e09ad1e`, the two shader
changes, then `0fdae8d`, which changes when the renderer stops resizing.

**THE SWEEP IS DONE, 2026-09-18** — 77 baseline sets, 35 instruments and one
stray `scratch_head.txt` removed, 342.8 MB; 90 baseline sets and 38 instruments
kept. The keep set was DERIVED from the records rather than taken from the list
below, and three rules had to be added because a literal name match would have
deleted evidence: **stem matching** (`progress.md` names replicate groups as
`s6ref`/`s8ref`, never `s6ref-a` — that is the 1-in-20 three-scale statistic this
handover quotes), **series integrity** (`t3f-1..4` is one null, so keeping only
the member a sentence named destroys it), and **`repro.dirs` awareness** —
`artInk`'s new floor and `artCompare`'s certificate both read those directories,
so sweeping one now silently costs its set the floor it was certified against.
Verified after: `artCompare` still reads 19/21 admissible and both ink floors
still resolve. The list below is kept as the record of what was protected.

Sweep the 161 `baseline/` dirs and 72 `scripts/_*`. Keep the instruments the
records reference: `_t8align`, `_t8immRot`, `_nodeShot`, `_t7tail`, `_t6ghost`,
`_t5rings`, `_t3disc`, `_crop`, `_t9matrix`, `_t9trace` (takes `W H DPR`),
`_t9tracediff`, `_t9frames`, `_t9cross`, `_t9force`, `_t9shotnull`, `_t9resize`,
`_t9drift`, `_t9dims`, `_s6probe`, `_s7probe`, `_s7look`, `_s7disc`, `_s7fit`,
`_lookbook`, and from this session **`_y5sync`** (published-vs-drawn overlay
sync, the good one), `_x6sizesync` and `_x7storm` (the resize-settle counters
that found `0fdae8d`), `_x9dragsmall` (the drag/click isolation) and
`_x_pngwrite` (a PNG encoder; `_png.mjs` only decodes).

**`_prismMeasure` and `_nullPatch` are KEEP, and sweeping them would close item 3
permanently.** They are the only instruments that can produce either half of the
spoke's 1.098 — `_prismMeasure` is where `artPresence`'s PRISM GEOMETRY band
statistic was developed and is what measured the GL and 2-D columns, and
`_nullPatch` is the suppression rig those columns were measured through. Neither
was in this list before the item-4 audit noticed it. **`_nullPatch` WRITES TO
`src/terminal/art/SphereEdges.js`** — it splices a width-gated `discard` into
`COMPOSITE_ADDITIVE` — so a session that dies while it is applied leaves the
shader patched in tracked source. Check `git status` after using it; `node
scripts/_nullPatch.mjs off` reverts.

`artFreezeProbe.js` has
no `_` prefix on purpose — it is the author-facing DevTools probe and should not
be swept. Keep as evidence until the reports settle: `s6bis-*`, `s6t23-*`,
`t3w-*`/`t3r-*`, `s9ref-b..e`, `s7ref-b..e`, `s7cond-*` (the world-hash failure),
`s7cond2-*` (the certified candidate) and `_y3mask` (the nav-strip artefact).

### 5. THE AUTHOR'S CALLS — three now, not two

**a. Too much bloom in immersive.** His words, this build, in a live browser. He
has explicitly deferred it: *"visual upgrades are the next once all of this is
stable"*. Do not fold it into a stability fix. `BLOOM` lives in
`src/terminal/art/artComposite.js` and is unit-tested for its contract, not its
values.

**b. The immersive scaling law, measured this session.** On the toggle,
`sphereR` goes 240.7 → 376.0 (**1.562×**) while the node disc radius goes 1.029×
and the edge line width 0.982×. `project()` returns
`scale = FOCAL_K / (FOCAL_K + rz)`, independent of `sphereR`, so **the cage grows
and the ink does not** — proportionally sparser and thinner, worse the taller the
display (1.79× at 1040, ~3× on a projector). This is very likely behind the
first report's "sparse, oversized outer cage". It is a composition question, and
it belongs with (a) in the visual phase.

**c. Deleting the 2-D canvas.** The spec says *"the 2-D canvas is now empty:
delete it, its texture and the composite quad. Phase 1 ends here."* It is empty
of LAYERS, but the `destination-out` clear still drives the trail fade and
`setTransform` still sets the DPR. **Deleting it is therefore a real change to
how the trail works, not a deletion** — the GL trail accumulator would have to
take over the fade entirely. Do not do it as tidy-up. Cost it, put it to him.

**d. Immersive is not fullscreen** — the top navigation bar stays visible (see
`lookbook/6-immersive.png`, and the nav strip in `baseline/_y3mask/*-mask.png`,
which is what it costs a measurement). Long-standing and recorded, but immersive
is the exhibit mode, so it deserves an explicit decision rather than another
inheritance.

---

## WHAT IS UNRESOLVED AND WAITING ON THE AUTHOR

He reported, on a clean single dev instance, that **the node discs and particles
detach from the rotating sphere and freeze "like a static 2D screenshot over the
rotating geometry" while the wireframe keeps turning.** It did not reproduce
here in any configuration (see above), and the three fixes since may have
removed the condition — before `0fdae8d`, at DPR 1.5 **every odd window width**
put the page into ~20 page-wide `resize` events a second, and the normal and
immersive canvas widths are different numbers, so the toggle itself flipped a
page in and out of it.

`scripts/artFreezeProbe.js` was left with him: paste into DevTools while it is
wrong, and it separates the only three places the failure can live — the loop
stopped / the CPU stopped moving those primitives while lines move / the CPU is
fine and the screen disagrees. **Ask for that output plus his
`devicePixelRatio` and window size before hunting.** If he reports it is gone,
say so explicitly in the ledger rather than letting it lapse.

---

## WHAT THIS BRANCH HAS LEARNED

- **A tolerance is not free on this layer.** Fixing `SizeSync`'s unreachable
  target with a ±1 device-pixel slop settles the retry on a buffer one pixel
  short, which is then stretched over the CSS box: the composite RESAMPLES the
  2-D canvas instead of presenting it texel-for-texel. `artPresence` saw it at
  once — every prism sub-layer lost ~5% of its ink and the star spoke fell 25.03
  → 15.65 against a 19.5 bar, 3/3 runs against 2 clean at HEAD. **Run
  `artPresence` before believing a resize change is cosmetic.**
- **Ask a gate for a number the system can actually produce.** `SizeSync`
  retried against `Math.round(w * ratio)`; three writes `Math.floor`. The buffer
  was right and the check could never say so.
- **A report can inherit a mechanism from your own notes.** Two confident bug
  reports quoted this branch's harness write-ups as app defects. Reproduce
  before accepting a mechanism, however well-sourced it sounds.
- **A statistic taken over the wrong window is not evidence.** 22% "frozen ink"
  was the nav bar. Crop deliberately, and say what the crop excludes.
- **One clean null is not evidence when the fault is intermittent** — and its
  twin: 3 runs failing where 2 passed is a SIGNAL, not a flake. Both cost time
  here.
- **A layer that leaves the 2-D canvas can break an INSTRUMENT rather than a
  picture.** The world hash is over the edge buffer; moving the conductor in put
  a continuous quantity inside a discrete question. **When you move a layer, ask
  what READS the buffer, not just what draws it.**
- **`scripts/` is not linted and not tested, so every constant copied into it is
  a live trap.** `artSmoke` carried `S = 17`; the stride bump made its edge
  hit-test scan misaligned floats. `artPresence` was immune because it IMPORTS
  `EDGE_STRIDE`. Third time on this branch.
- **Ask what the gate can actually SEE before quoting it.** Nine of thirteen
  node layers were in no capture state; particles were in none until step 6; the
  conductor was in none until step 7. Seven recurrences — and it is why
  `artSmoke` 5b ships with 5c, a positive control proving a real click makes the
  same counter non-zero.
- **State a fitted law's RANGE, and say it is a fit.**
- **Check a mechanism's MAGNITUDE against the observation before measuring it.**
- **A record that states a mechanism can be wrong, and inherited wrongly.**
- **Read the instrument's own documentation before quoting its output.**
- **Look at the render before theorising.**
- **A layer can give itself a null** — clear it, step ONE frame, the difference
  IS the layer.
- **Measure the SHAPE, not the size.** Signed mean, not `|abs|`.
- **Every threshold must be a contrast, never an absolute level.**
- `__pump(n)` **never yields**; a screenshot and a real-time sleep both cost ZERO
  frames, but they cost a yield, which is when real browser tasks land.
- **Backticks inside a template literal terminate the string.** Known for the
  GLSL in `SphereEdges.js`; it bit again in `determinism.mjs`, in step 6, and
  TWICE in step 7. **Writing it down has not been enough; grep the hunk for a
  backtick before running.**
- **`cd` in a Bash call persists** — use absolute paths.
- **Do not edit source while a capture is running.**
- Long-running captures: fresh log filename each run, wait on the **artifact**
  (`manifest.json`), never a log line. A `nohup ... &` wrapper exits instantly,
  so its "completed" notification is the WRAPPER, not the work.
- Never run vitest with `-u`. Never `git add -A`. Re-read anything in `scripts/`
  before editing it.

## GATES (all green, re-verified 2026-09-18 after the item-4 audit)

```
npx vitest run          1279 passed / 115 files   (1278 at 0fdae8d; +1 is the
                        writePolyline stride test — see below)
npm run lint            0 errors, 145 warnings (ratchet 153 — a new warning is YOURS)
npm run build           clean
node scripts/artSmoke.mjs        12/12   (5b/5c are new — the drag/click regression)
node scripts/artPresence.mjs     19/19   (twice)
node scripts/_s7probe.mjs        11/11   (needs the dev server)
```

**Three instrument changes from the item-4 audit, committed on this branch and
NOT pushed.** Full findings in
`docs/superpowers/plans/audit-item4-shaders-and-rng.md`.

- **`artEdges.test.js` — the writePolyline stride test.** `writePolyline` spells
  its fields as LITERAL offsets while only the base uses `EDGE_STRIDE`, so the
  next stride bump would leave a stale float in a reused slot and no gate could
  see it. The test fills the buffer with a sentinel and names any offset in
  `[0, EDGE_STRIDE)` that survives. Proven to catch it: comment out
  `data[o + 17] = 0` and it fails naming float 17 on all three instances.
- **`artBaseline.mjs` — the renderer is PROBED now, not asserted.** The manifest
  carried a hardcoded "software GL / SwiftShader" string. It was false:
  `WEBGL_debug_renderer_info` reads **`ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Ti
  … Direct3D11, D3D11)`**. Probed last, after every shot, so its `page.eval`
  yield cannot move a picture; recorded per scale and once at the top, with the
  command line moved to `launchFlags` where it belongs. Note `gitCommit` is still
  `null` in every manifest — nothing sets `BASELINE_COMMIT`, so no set records
  which build it is.
- **`artInk.mjs` — every ratio now prints its SAME-BUILD FLOOR.** `artNull`
  certifies luminance CORRELATION; `artInk` measures summed INK; the certificate
  never said anything about the second. Measured: three sets of ONE build read
  0.972 at laptop@1x `immersive-on` and 1.030 at projector `idle` — the latter at
  an *agreeing world hash* with a passing null, 45,534 lit pixels against 31,385.
  The floor comes from `repro.dirs`, which `artNull` already stamps, so no new
  captures are needed. `--null a,b,c` overrides, `--no-null` turns it off.
  **Consequence for item 2, and it cuts both ways:** the mode ROLLUP clears its
  floor at all three scales (1.013/1.020/1.025 against ±0.009/±0.005/±0.008), so
  the excess is real — but per cell the same comparison reads **20 SIGNAL, 22
  noise of 42 rows**. `idle`, `hover`, `mid-drag` and `resonance` at laptop@1x
  and projector are indistinguishable from re-running the same build. The excess
  is `fired-cascade` + laptop@2x + laptop@1x immersive, not a uniform band.

`npm run lint` is `eslint . --ext js,jsx` and **does not lint `.mjs` at all** —
`scripts/` has never been in the lint gate. It DOES lint `scripts/**/*.js` as
Node, which is why `artFreezeProbe.js` carries an `eslint-env browser` line.

`artPresence`'s `GENESIS GLOW` and `FLASH GRID` are intermittent. **Capture the
name** rather than re-running until green, and measure its rate at unmodified
HEAD before assuming a failure is yours. `PRISM GEOMETRY` and `CHIMERA SYNC
RING` are NOT in that set — when they failed here it was a real regression.

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

**"No CDP page target on :PORT after 30000ms" was a real bug, fixed in
`c075540`** — every launch in a process shared one debug port, so Chrome N+1
could be told to bind a port Chrome N had not released. It cost five
`artPresence` runs in one session, dying at a different launch each time, which
is exactly why it read as an unexplained flake worth re-running past. If it
returns, it is not the same bug and it deserves a look.

A three-scale capture takes **3m50s**; three of them is about twelve minutes,
five about twenty. Run them in the background and wait on the artifact.

`scripts/_lookbook.mjs` writes `lookbook/*.png` — the sphere in six states
including the conductor's peer-push glow, which needs 3+ live visitors and can
only be seen by forcing it. Use it when the author wants to look at something.

Work as a critical senior dev: no yes-machine, push back when the evidence says
so, and look at the render before theorising about a visual bug. **Do not push
or merge — report to the author and he decides.**

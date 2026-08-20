Continue the /art sphere Canvas2D→WebGL migration on `fix/art-sphere-index-space`
(F:\scale_9.4).

**Step 5 (nodes) is COMPLETE. Handover items 1 and 2 are COMPLETE.** Step 6
(particles) is next, and it now has a reference it is allowed to be measured
against — which took three attempts and produced the two largest fixes on the
branch.

STATE: HEAD `dd14af6`, tracked tree clean, **9 commits ahead of
`origin/fix/art-sphere-index-space`**. The ledger `.superpowers/sdd` is its own
private repo (`scale-94-notes`), ahead at `50f01b9`. `main` is untouched at
`a54ea3e`.

**Do not push, do not merge, do not touch `main`.** The author protects `main`
from unstable code and will not merge this until the whole refactor is complete,
confirmed and stable. Report to him and he decides. A new push needs a new
explicit command.

`.superpowers/sdd` has `.gitignore = *`, so ledger files need `git add -f` and a
separate commit in that repo. The untracked `scripts/_*` and `baseline/*` scratch
files are deliberate; leave them until the sweep.

READ FIRST, in this order:
1. `.superpowers/sdd/post-step5-task3-report.md` — the shared-RNG root cause,
   what was ruled out and how, and the two mistakes made inside the fix.
2. `baseline/art-sphere-step5-certified/README.md` — the reference step 6 is
   measured against, and why it does not match the old one pixel-for-pixel.
3. `.superpowers/sdd/post-step5-task2-report.md` — why the null is a gate and
   why three sets is the floor.
4. `.superpowers/sdd/progress.md`, last section — the ledger's own backlog.
5. `docs/superpowers/specs/2026-08-04-art-sphere-webgl-design.md` §Step 6 —
   **and see item 1 below before believing it.**
6. `docs/superpowers/plans/handover-post-task1.md` and the per-task reports —
   history only.

---

## THE ONE THING THAT CHANGES HOW YOU MEASURE

**A capture set must now prove it repeats before anything measured on it may be
quoted.** `scripts/artNull.mjs` computes the same-build null — worst-pair
luminance correlation at full resolution, per cell, across N captures of one
build — and `artNull … --write <dir>` stamps the result into that set's
manifest as `repro`. `artCompare` refuses to print `ok` for a row whose set
carries no certificate.

Three sets minimum, five for a reference. One pair only diverges when exactly
one of the two runs is bad — 2p(1−p), which is 0.44 at p=1/3, a coin flip.

**This is not theory. The gate refused the step-5 reference three times and was
right every time.** Item 2 was one command of work; it became the two biggest
fixes on the branch because the gate would not sign a set that could not repeat
itself. If you are tempted to reach for `--ungated`, that is the history you are
betting against.

Certifying is once per build, not once per comparison:

```bash
node scripts/artBaseline.mjs --out baseline/wip-a       # and -b, -c
node scripts/artNull.mjs baseline/wip-a baseline/wip-b baseline/wip-c --write baseline/wip-a
node scripts/artCompare.mjs baseline/art-sphere-step5-certified baseline/wip-a
```

**And read the manifest's `view` before quoting any row.** It now records
rotation, drag velocity, hovered node, sphere radius, both buffer sizes,
`arch` (whether the temporal archaeology had loaded), and **`world`** — an FNV
hash over the edge layer's whole written instance range, i.e. the projected
geometry. Two runs with the same `world` drew the same graph. That field is what
turned a hunt into a location; without it the manifest agreed on everything
while the pictures disagreed completely.

---

## THE WORK, in order

### 1. Step 6 — particles, and the spec is wrong about what follows

Measured against `baseline/art-sphere-step5-certified/`. Pre-flight is already
done and is in `progress.md`; the short version:

- The live block is `ArtTab.jsx:1979`–`:2021`: `ctx.save()`,
  `globalCompositeOperation = 'lighter'`, a `createRadialGradient` glow disc and
  an `hsla` core disc per particle, `ctx.restore()`.
- **Particles are NOT the last 2D content.** `ArtTab.jsx:2024` calls
  `drawConductor(ctx, …)` → `artAwakening.js`, **28 `ctx.` calls**. The spec's
  "the 2-D canvas is now empty: delete it, its texture and the composite quad"
  is **wrong for the third time on this branch**.
  `baseline/art-sphere-step5/README.md` already said so — "Still 2D, for step 6:
  the particle ecology **and the conductor**". The SPEC is the stale document.
- The whole remaining 2D surface is four sites: `:931` `setTransform`,
  `:947`–`:951` the `destination-out` clear, the particle block, the conductor.
- **Clear `_idleHueDrift` (`artParticles.js:67`) FIRST.** A module-level
  mount-time accumulator `__artHarnessReset` does not touch — same class as
  `breathPhase` and `particleFrameRef`, which task 1 fixed. It was MEASURED not
  to move the captured frames (per-channel means agree to 0.1% across four runs,
  because node cores and halos dominate the lit pixels) and so deliberately left
  alone. But it sets particle **hue**, luminance correlation is nearly blind to
  hue, and **step 6 is the one measurement it would corrupt.** Fix it as its own
  change with its own measurement, then re-capture the reference.
- Write the plan document. Every prior step got one, and the spec's
  one-paragraph description has understated the block **every single time** —
  seven layers where there were thirteen in step 5, "ordinary line segments"
  where there were quadratic Béziers over three sub-layers in step 4.

Particles draw with `lighter` across the whole disc and are, by `artInk`'s own
accumulation arithmetic, the layer with the most to lose in a move to a fully
rewritten target.

### 2. The spoke's 1.098 GL/2D ratio — never actually gated

Step 4 task 6 measured the star spokes **9.8% brighter in GL than in 2D** and
the controller registered a dissent: a ~10% bright sub-layer must not be baked
into the reference steps 5 and 6 are measured against. It was recorded as
"carried forward as a TASK 7 GATE".

**It was never gated.** `4cff695` touched only baselines, the spec,
`artBaseline.mjs` and `artSmoke.mjs`. So the 1.098 is baked into
`baseline/art-sphere-step4/`, `baseline/art-sphere-step5/` **and now
`baseline/art-sphere-step5-certified/`**.

Verify it still reproduces before acting — it is weeks old, `65e62b8` changed
the same amplitude family under it, and it was measured on a harness that could
not repeat itself. **Trap: `grep 1.098` is useless.** That string appears in
`trail-deficit.md` as unrelated ink ratios. Also still open from that task: the
1.526 px notch, and whether `CURVE_MAX_SEGMENTS = 24` binding routinely is
silently coarsening the flatness guarantee.

### 3. A whole-branch review before the branch is finished

Never run, and the debt has grown:
- Step 4 task 6 was **accepted without review** (its reviewer was killed twice).
- `cbf22f1` (the GHOST TRAILS presence repair) landed from a parallel session
  and was never reviewed.
- Step 5 tasks 1–8 have had no review pass at all.
- `2adc482`, `9661dfa`, `7f5f2ce`, `3551885`, `dd14af6` — none reviewed. Between
  them they touch the app's random stream, four hooks, the determinism shim, the
  capture harness and both comparators. **`7f5f2ce`/`3551885` are the ones to
  review hardest**: they change what the artwork draws from.

### 4. Sweep the scratch before the branch is finished

~110 untracked `baseline/` dirs and ~55 `scripts/_*` files. Housekeeping, last.

Keep the instruments the records reference: `_t8align.mjs`, `_t8immRot.mjs`,
`_nodeShot.mjs`, `_t7tail.mjs`, `_t6ghost.mjs`, `_t5rings.mjs`, `_t3disc.mjs`,
`_crop.mjs`, `_t9matrix.mjs`, `_t9trace.mjs` (now takes `W H DPR` arguments),
`_t9tracediff.mjs`, `_t9frames.mjs`, `_t9cross.mjs`, `_t9force.mjs`,
`_t9shotnull.mjs`, `_t9resize.mjs`, `_t9drift.mjs`, `_t9dims.mjs`.

Keep as evidence until the reports are settled: `baseline/s5ref-*` (the sets
that exposed the RNG fault), `baseline/t3w-*` and `baseline/t3r-*` (the
flag-off/flag-on control pair), `baseline/s7ref-b..e` (the reference's own
replicates — the certificate names them).

---

## WHAT THIS BRANCH HAS LEARNED — all of it still applies

- **Ask what the gate can actually SEE before quoting it.** Nine of thirteen
  node layers were in no capture state. This is the branch's defining failure
  mode and it has now recurred at the level of a whole capture *state* and again
  at the level of the *random stream*.
- **A same-build null before any ratio — and more than one pair of runs.** This
  is now enforced, not advisory.
- **Look at the render before theorising.** Task 3's images showed nodes in
  different places while every recorded field said the runs agreed; that is what
  ruled out "the immersive frame is blank anyway".
- **A record that states a mechanism can be wrong, and inherited wrongly.**
  Task 1's whole premise was a two-clause diagnosis falsifiable from artifacts
  already on disk. Task 3 added its own: the world hash was introduced on the
  belief that it caught something the correlation missed, and it did not. That
  is written into the file rather than quietly dropped.
- **Read the instrument's own documentation before quoting its output.**
  `determinism.mjs` had the entire root cause of task 3 in a comment — "the app
  should own a private RNG" — written by whoever wrote the shim.
- **Read the `renderer` field before quoting a frame-time delta.**
  `baseline/art-sphere-step4/` holds numbers from two instruments 2–3× apart.
- **The forcing hook always moves more than its layer.**
- **A layer can give itself a null** — clear it, step ONE frame, the difference
  IS the layer.
- **Measure the SHAPE, not the size.** Signed mean, not `|abs|`.
- **Every threshold must be a contrast, never an absolute level.**
- `__pump(n)` **never yields** — step with `await page.pump(1)` in a loop.
- **A screenshot and a real-time sleep both cost ZERO frames** (measured). What
  they cost is a yield, which is when real browser tasks land.
- **A retry that can exit on half its condition is not a retry.**
- **A bare CLI flag must not swallow the next token.** `artNull`'s parser skipped
  the argument after any `--` token, so adding one valueless flag would have
  silently dropped a capture directory from a null.
- Never run vitest with `-u`. Never `git add -A`. Re-read anything in `scripts/`
  before editing it.
- **Backticks inside a template literal terminate the string.** Known for the
  GLSL in `SphereEdges.js`; it bit again in `determinism.mjs`, whose whole shim
  is one template literal.
- **`cd` in a Bash call persists.** A `cd .superpowers/sdd` made three later
  commands report a missing `baseline/` directory. Use absolute paths.
- Long-running captures: give each background run a **fresh log filename**, and
  wait on the **artifact** (`manifest.json`), never a log line.
- A `git checkout HEAD -- <file>` used to test a baseline **must be restored in
  its own command**, not chained after a long-running loop.

## GATES (all green at `dd14af6`)

```
npx vitest run          1215 passed / 113 files
npm run lint            0 errors, 144 warnings (ratchet 153 — a new warning is YOURS)
npm run build           clean
node scripts/artSmoke.mjs        10/10
node scripts/artPresence.mjs     19/19
node scripts/artBaseline.mjs --out baseline/<name> [--scale NAME]
node scripts/artNull.mjs    baseline/<a> <b> <c> [--write <a>] [--write-partial]
node scripts/artCompare.mjs baseline/art-sphere-step5-certified baseline/<wip>
node scripts/artInk.mjs     baseline/art-sphere-step5-certified baseline/<wip>
```

`npm run lint` is `eslint . --ext js,jsx` and therefore **does not lint `.mjs`
at all** — `scripts/` has never been in the lint gate. Know that before trusting
"0 errors" about anything in that directory.

`--scale NAME` restricts a capture to one scale. A reference must be captured at
all three; the flag is for iterating on the harness. **Note that a single-scale
run is a WEAKER test than a three-scale run** — the 1-in-5 residual fault in
task 3 never appeared in four single-scale runs and appeared immediately in
three-scale ones.

`--reseed-per-callback` on `artBaseline` and `__reseedEachCallback` in the shim
are a **DIAGNOSTIC, default off**. They change which random values the app sees,
so a set captured with them is a different picture, not a more reproducible one.
Never capture a reference with them.

`artPresence`'s `GENESIS GLOW` and `FLASH GRID` have each failed once
historically and passed on the next run at the same HEAD with nothing changed.
If one surfaces, **capture the name** rather than re-running until green — and
if a check fails, measure its rate at unmodified HEAD before assuming it is
yours.

## The rig

Dev server is `.claude/launch.json` → `scale94-dev` on port 5174. Drive the
browser through `scripts/cdp.mjs`, **never the browser pane** (it reports
`document.hidden`, which suspends rAF).

A `waitFor timed out: boot` is a dead dev server. A `waitFor timed out: sphere`
on the first run in a fresh worktree is the one-time cold Vite dep-optimize
force-reloading the page mid-boot — warm the cache and re-run.

A full three-scale capture takes **3m50s**. Five of them, which is what a
reference needs, is about twenty minutes. Run them in the background and wait on
the artifact.

Work as a critical senior dev: no yes-machine, push back when the evidence says
so, and look at the render before theorising about a visual bug. **Do not push
or merge — report to the author and he decides.**

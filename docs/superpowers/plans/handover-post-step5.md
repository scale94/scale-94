Continue the /art sphere Canvas2D→WebGL migration on `fix/art-sphere-index-space` (F:\scale_9.4).

**Step 5 (nodes) is COMPLETE.** All thirteen node draw layers are on the GPU and
the node block holds no canvas call at all. Step 6 (particles) is the last 2D
content in the draw loop.

STATE: HEAD `86fa009`, tracked tree clean, **1 commit ahead of
`origin/fix/art-sphere-index-space`** (the nightly). The ledger `.superpowers/sdd`
is its own private repo (`scale-94-notes`), also 1 commit ahead at `56aad78`.

**Do not push, do not merge, do not touch `main`.** The author protects `main`
from unstable code and will not merge this until the whole refactor is complete,
confirmed and stable — possibly not until the visual-upgrade phase after it.
Report to him and he decides. A new push needs a new explicit command.

`.superpowers/sdd` has `.gitignore = *`, so ledger files need `git add -f` and a
separate commit in that repo. The untracked `scripts/_*` and `baseline/*` scratch
files are deliberate; leave them.

READ FIRST, in this order:
1. `baseline/art-sphere-step5/README.md` — the step-5 record. **The section
   "THE IMMERSIVE ROWS ARE NOT A MEASUREMENT" governs every task below.**
2. `.superpowers/sdd/step5-task8-report.md` — the method, the wrong conclusion
   that was nearly filed, and what caught it.
3. `.superpowers/sdd/progress.md`, last section — the ledger's own backlog.
4. `docs/superpowers/specs/2026-08-04-art-sphere-webgl-design.md` §Step 5 and
   §Step 6.
5. Earlier per-task reports `step5-task1-report.md` … `task8` only for history.

---

## THE ONE THING THAT CHANGES HOW YOU MEASURE

> **RESOLVED — task 1, done. Read this section for the lesson, not the state.**
> The capture is reproducible now: five full runs of one build, ten pairs per
> cell, worst pair anywhere **0.977**, every immersive cell **≥ 0.988**. The
> mechanism recorded below is **wrong in both halves** — rotation was identical
> in the runs that scored 0.047, and a screenshot costs exactly zero frames.
> There were four real causes and they were all the same shape: something
> outside the pump budget deciding what the world looks like. Full account:
> `.superpowers/sdd/post-step5-task1-report.md`.
>
> What still applies: **every reference baseline on this branch predates the
> fix**, including `baseline/art-sphere-step4/` and `art-sphere-step5/`. They
> each contain one arbitrary draw of the breath phase. Re-capture a control
> before measuring step 6 against anything — and note that `__artHarnessReset`
> lives in `ArtTab.jsx`, so a source-swap control at an old commit is still
> jittery unless the reset patch is carried onto the swapped-in source.

**`artBaseline`'s `immersive-on` and `immersive-off` states are not reproducible
run to run on IDENTICAL CODE.** Full-resolution luminance correlation between two
runs of the same build, four minutes apart:

| state | same-build null | any cross-build pair |
|---|---|---|
| `idle` and the other normal states | **0.970** | 0.78 – 0.98 |
| `immersive-on` | **0.610** | 0.60 – 0.66 |
| `immersive-off` | **0.082** | 0.045 – 0.07 |

The same-build null is **indistinguishable from a cross-build comparison**, so
those two rows carry no information about a code change at any effect size. It is
a different sphere **rotation**; the virtualised clock cannot see it because
rotation accrues per rAF frame while `elapsedS` is virtual.

~~**Do not quote `immersive-on` or `immersive-off` from `artCompare` or
`artInk` until task 1 below is done.**~~ Task 1 is done; both rows are
measurable. Quote them against a same-build null, as with any other row.

**The immersive ink deficit tasks 4–7 carried is RETIRED.** Do not re-raise it,
do not re-measure it with another whole-frame ratio, do not treat it as a
blocker. It died twice: once on the reproducibility above, and once because task
4 measured it on `artInk`'s **disc** column, which `trail-deficit.md` §1 had
already ruled inadmissible in immersive. Reopening it needs a **spatial null** —
same region, same frame, layer on vs off — which task 7's probe null shows is
achievable.

---

## THE WORK, in the author's priority order

### 1. ~~Fix `forceResize()` determinism in `scripts/artBaseline.mjs`~~ — DONE

Done. `forceResize()` was not the defect; its ORDER was one of four causes. See
`.superpowers/sdd/post-step5-task1-report.md`. The task text below is kept
because its reasoning about *why* this had to come before step 6 still holds,
and because its "do not re-derive the mechanism" instruction is the thing that
would have kept the wrong diagnosis alive — the mechanism it told the next
session to trust was falsifiable from artifacts already on disk.

Two defects were found and fixed on the way, both worth knowing about: the
`hover` state had stopped containing `coreHover` at the projector scale (it now
shoots at detection and asserts the layer from the census), and `artPresence`'s
filament/zone retry could exit on half its condition, which reads exactly like a
broken CHIMERA FRINGES layer — that one fires at unmodified HEAD too.

**Original task text follows.**

This is the author's call already flagged and it comes first, before step 6.

**Why first, not later.** Step 6 moves the particle ecology, which draws with
`lighter` across the whole disc and is by `artInk`'s own accumulation arithmetic
the layer with the most to lose from a move to a fully-rewritten target.
Measuring it through a blind immersive column repeats exactly what steps 4 and 5
just spent four tasks discovering. And immersive is the mode the Ars Electronica
piece installs in — this is the row `artInk` itself marks "the row that matters
most", and it has never once been readable.

**The mechanism, already diagnosed — do not re-derive it.** The only two states
that diverge are the only two that call `forceResize()` (`artBaseline.mjs` ~`:493`),
which takes a throwaway `page.screenshot` to force a `ResizeObserver` delivery.
`__pump(n)` never yields; a screenshot does; rAF is unthrottled in headless
(~350 fps). An uncontrolled number of real frames runs across that yield. Damage
scales with the call count: one for `immersive-on` (r 0.61), two for
`immersive-off` (r 0.08).

Read the long comment block above `forceResize` before touching it. It documents
a real trap it already solved (the shot landing on the wrong side of the trail
target's reallocation) and a fix that must not be regressed.

**Acceptance:** `scripts/_t8align.mjs A B` on two capture runs of one build reads
comparably for `immersive-on`/`immersive-off` as it does for `idle` (~0.95+). Not
"looks better" — measured, against a same-build null, at all three scales.

**Do not** solve it by deleting the immersive states or by widening a tolerance.
"When a metric is too coarse for its signal, fix the metric, not the bar."

### 2. Fold the same-build-null check into `artCompare` — cheap, high leverage — NEXT

Now the highest-priority open item. Note what task 1 added to the case for it:
three of the four causes were each found *after* a clean 21/21 pair had already
been recorded, so a single A-vs-B null is not enough — `scripts/_t9matrix.mjs`
correlates one state across many sets and is what actually caught the
intermittent ones. Whatever goes into `artCompare` should have that shape.


`scripts/_t8align.mjs` (untracked) is the instrument that found the above. Make
its check part of the gate so a state that is not reproducible **cannot be quoted
as a measurement** by a future session. This is the structural fix for the failure
mode that has now cost this branch six gate-blind layers and four tasks of
argument about a number that was never admissible.

Can be done alongside task 1; same file family, same session.

### 3. Step 6 — particles, the last 2D content

Spec §Step 6. The trail half is already DONE (pulled forward, 2026-08-10). Only
the particle migration is left, then "the 2-D canvas is now empty: delete it, its
texture and the composite quad" — and **check that claim before acting on it**;
it was wrong at the end of step 4 and cost step 5 two extra layers.

Follow the shape every step on this branch has used: a **pre-flight scan** of the
actual block before the plan (`ArtTab.jsx:1973`–`:2020` and `artParticles.js`),
because the spec's one-paragraph description has understated the block **every
single time** — seven layers where there were thirteen in step 5, "ordinary line
segments" where there were quadratic Béziers over three sub-layers in step 4.
Write the plan document; every prior step got one.

### 4. The spoke's 1.098 GL/2D ratio — never actually gated

Step 4 task 6 measured the star spokes rendering **9.8% brighter in GL than in
2D** and the controller registered a dissent: "a ~10% bright sub-layer must not
be baked into" the reference baseline that steps 5 and 6 are measured against. It
was recorded as "carried forward as a TASK 7 GATE".

**It was never gated.** `4cff695` (step 4 task 7) touched only baselines, the
spec, `artBaseline.mjs` and `artSmoke.mjs`. It never touched the spoke. So the
1.098 is baked into `baseline/art-sphere-step4/` **and** into
`baseline/art-sphere-step5/`, and every parity claim since has been measured
against a reference containing it. Also still open from that task: the 1.526 px
notch, and whether `CURVE_MAX_SEGMENTS = 24` binding routinely is silently
coarsening the flatness guarantee.

Verify the finding still reproduces before acting — it is three weeks old and the
shader has changed under it (`65e62b8` fixed the glow's missing stroke alpha,
which is the same amplitude family).

### 5. A whole-branch review before the branch is finished

Never run, and the debt is real:
- Step 4 task 6 was **accepted without review** (its reviewer was killed twice).
- `cbf22f1` (the GHOST TRAILS presence repair) landed from a parallel session and
  was never reviewed. **Note:** `progress.md:1549`'s "repair the ghost presence
  check's metric" is a **stale duplicate** — that work is done; what is open is
  the review of it.
- Step 5 tasks 1–8 have had no review pass at all.

### 6. Sweep the scratch before the branch is finished

~45 untracked `baseline/` dirs and ~40 `scripts/_*` files. Housekeeping, last.
Keep the instruments the records reference (`_t8align.mjs`, `_t8immRot.mjs`,
`_nodeShot.mjs`, `_t7tail.mjs`, `_t6ghost.mjs`, `_t5rings.mjs`, `_t3disc.mjs`,
`_crop.mjs`); the rest are per-task probes.

---

## IN FLIGHT — do not duplicate, and mind the collision

**`artSmoke` 3b edge-probe flake** is being fixed in a separate session the author
started (2026-08-19). It touches `scripts/artSmoke.mjs`. If your work touches
that file, coordinate or wait — this repo has been sabotaged before by two
sessions writing the same file, and a stopped agent leaves a tree that looks like
a defect.

The flake: `3b hover between nodes reports an edge — no edge found on the probe
grid`, about one run in three, on the WIP build **and** on the control with the
source stashed. A fixed probe grid on a rotating sphere — the same
coordinate-staleness family as `fc2909a`.

---

## WHAT THIS BRANCH HAS LEARNED — all of it still applies

- **Ask what the gate can actually SEE before quoting it.** Nine of thirteen node
  layers were in no capture state. This is the branch's defining failure mode and
  it has now recurred at the level of a whole capture *state*, not just a layer.
- **A same-build null before any ratio, and check the null is not the signal.**
  Four tasks compared against "null bands" without ever asking whether the two
  frames were the same picture.
- **Look at the render before theorising.** Task 8's headline finding was three
  scales of perfectly consistent numbers pointing the wrong way; opening two PNGs
  killed it in a minute.
- **Read the instrument's own documentation before quoting its output.**
  `trail-deficit.md` §1 had the rule that would have prevented all of it.
- **Read the `renderer` field before quoting a frame-time delta.**
  `baseline/art-sphere-step4/` holds numbers from two instruments 2–3× apart.
- **The forcing hook always moves more than its layer.** Held for four hooks
  across four consecutive tasks.
- **A layer can give itself a null** — task 7's probe is the cleanest on the
  branch: clear it, step ONE frame, the difference IS the layer.
- **Pool a dashed layer's samples across instances rather than voting per
  instance.**
- **Measure the SHAPE, not the size.** Signed mean, not `|abs|`.
- **Every threshold must be a contrast, never an absolute level** — the composite
  blooms.
- **Prove a law where there is a lever, not where the layer happens to draw.**
- `__pump(n)` **never yields** — step with `await page.pump(1)` in a loop. This is
  now implicated in two separate findings.
- Never run vitest with `-u`. Never `git add -A`. Re-read anything in `scripts/`
  before editing it.
- Backticks inside the GLSL template literals in `SphereEdges.js` terminate the
  string.

## GATES (all green at `86fa009`)

```
npx vitest run          1188 passed / 111 files
npm run lint            0 errors, 144 warnings (ratchet 153 — a new warning is YOURS, fix it)
npm run build           clean
node scripts/artSmoke.mjs        10/10   (see the 3b flake above)
node scripts/artPresence.mjs     19/19
node scripts/artBaseline.mjs --out baseline/<ctrl|wip>
node scripts/artCompare.mjs baseline/<ctrl> baseline/<wip>
node scripts/artInk.mjs     baseline/<ctrl> baseline/<wip>
node scripts/_t8align.mjs   baseline/<ctrl> baseline/<wip>   <-- run this FIRST
```

**KNOWN FLAKES, measured, not yours.** `artSmoke`'s `3b` (above). `artPresence`'s
`GENESIS GLOW` and `FLASH GRID` have each failed once and passed on the next run
at the same HEAD with nothing changed. If one surfaces, **capture the name**
rather than re-running until green.

## The rig

Dev server is `.claude/launch.json` → `scale94-dev` on port 5174. Drive the
browser through `scripts/cdp.mjs`, **never the browser pane** (it reports
`document.hidden`, which suspends rAF).

A `waitFor timed out: boot` is a dead dev server. A `waitFor timed out: sphere`
on the first run in a fresh worktree is the one-time cold Vite dep-optimize
force-reloading the page mid-boot (`new dependencies optimized … reloading` in
the server log) — warm the cache and re-run.

**For a step-wide control capture**, the method task 8 used and that works: check
a detached worktree out at the older commit, serve it, and swap only the app
files, leaving the harness at HEAD. `artBaseline`'s census hook is guarded, so a
pre-step-5 control records `layers: no census` on all 21 shots — **positive proof
the old source is really being served rather than a stale HMR cache.** Carry a
check of that shape into any future source-swap comparison.

Work as a critical senior dev: no yes-machine, push back when the evidence says
so, and look at the render before theorising about a visual bug. **Do not push or
merge — report to the author and he decides.**

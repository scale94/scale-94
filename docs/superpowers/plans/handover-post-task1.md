Continue the /art sphere Canvas2D→WebGL migration on `fix/art-sphere-index-space` (F:\scale_9.4).

**Step 5 (nodes) is COMPLETE. Post-step-5 task 1 (capture reproducibility) is
COMPLETE.** Step 6 (particles) is the last 2D content in the draw loop.

STATE: HEAD `2adc482`, tracked tree clean, **4 commits ahead of
`origin/fix/art-sphere-index-space`**. The ledger `.superpowers/sdd` is its own
private repo (`scale-94-notes`), 2 ahead at `1389ff2`. `main` is untouched at
`a54ea3e`.

**Do not push, do not merge, do not touch `main`.** The author protects `main`
from unstable code and will not merge this until the whole refactor is complete,
confirmed and stable — possibly not until the visual-upgrade phase after it.
Report to him and he decides. A new push needs a new explicit command.

`.superpowers/sdd` has `.gitignore = *`, so ledger files need `git add -f` and a
separate commit in that repo. The untracked `scripts/_*` and `baseline/*` scratch
files are deliberate; leave them until task 6.

READ FIRST, in this order:
1. `.superpowers/sdd/post-step5-task1-report.md` — what the capture harness was
   actually doing, why the record's diagnosis was wrong, and the measurement
   rule that now governs every number on this branch.
2. `baseline/art-sphere-step5/README.md` — the step-5 record. Its §"THE
   IMMERSIVE ROWS ARE NOT A MEASUREMENT" now opens with a correction block;
   read that before the section it corrects.
3. `.superpowers/sdd/progress.md`, last section — the ledger's own backlog.
4. `docs/superpowers/specs/2026-08-04-art-sphere-webgl-design.md` §Step 6.
5. `docs/superpowers/plans/handover-post-step5.md` and the per-task reports
   `step5-task1-report.md` … `task8` — history only.

---

## THE ONE THING THAT CHANGES HOW YOU MEASURE

The capture harness could not repeat itself, and for four tasks nobody asked it
to. `immersive-off` correlated **0.047** between two runs of ONE build — the
same number two *unrelated* states score — while every clock the harness
recorded agreed to four decimal places.

That is fixed (`2adc482`). Five full capture runs, ten pairs per cell, 21 cells:
**worst pair anywhere 0.977, every immersive cell ≥ 0.988.** Four causes, and
they were all one shape: **something outside the pump budget deciding what the
world looks like.** A gate that only pins the clock cannot see any of them.

Three things to carry forward, and they are worth more than the fix:

- **One A-vs-B null is not evidence when the fault is intermittent.** Three of
  those four causes were each found *after* a clean 21/21 pair had already been
  recorded and written up. Use `scripts/_t9matrix.mjs` (one state correlated
  across MANY capture sets) — a fault that fires one run in three hides
  perfectly in a single pair.
- **Reach for `scripts/_t9trace.mjs` + `_t9tracediff.mjs` before theorising.**
  A recorder registered as a virtual rAF runs once per pumped frame after the
  app's draw; the diff prints the first frame at which two runs differ, *per
  field*. It found the root cause in one run of each build, after hours had gone
  into a mechanism that was wrong.
- **Do not add an unproven change beside a proven one.** Task 1 threw in a
  re-drawn `beaconIdx` as "same family". It consumes a value `initState()` would
  have taken, shifts every draw after it, and took `artPresence` from 19/19 to
  15/19. One change at a time, each with its own measurement.

**And read the manifest's `view` field before quoting any row.** It now records
rotation, drag velocity, hovered node, sphere radius and both buffer sizes per
shot. It is what turned three of those four causes from a guess into a location.

**The immersive ink deficit stays RETIRED** — do not re-raise it. Its first
ground is now void (those rows are measurable), but its second stands untouched:
`trail-deficit.md` §1 rules `artInk`'s **disc** column inadmissible in immersive,
and that is the column task 4 measured on. Reopening it needs a spatial null —
same region, same frame, layer on vs off.

---

## THE WORK, in order

### 1. Fold the same-build-null check into `artCompare` — do this first

`scripts/_t8align.mjs` is the instrument that found the fault. Make its check
part of the gate, so a state that is not reproducible **cannot be quoted as a
measurement** by a future session. This is the structural fix for the failure
mode that has now cost this branch six gate-blind layers, a whole capture state,
and four tasks of argument about a number that was never admissible.

**Task 1 sharpened the requirement, so do not just port `_t8align`:** a single
A-vs-B null passes while an intermittent fault is live. The gate wants the
`_t9matrix.mjs` shape — one state across several sets — or, at minimum, it must
refuse to report a row green off one pair. Decide and justify which.

Cheap, high leverage, and it protects everything below it.

### 2. Re-capture the reference baseline with the fixed harness — before step 6

**Every reference baseline on this branch predates `2adc482`** and holds one
arbitrary draw of the breath phase. They are honest pictures of their builds,
but they were taken by a harness that could not repeat itself, so any parity
claim measured against them inherits that.

The one that matters: **step 6 must be measured against a step-5 reference
captured by the fixed harness.** Step 5 is HEAD, so that is just a clean capture
at `2adc482` — no source swap needed. Do it before you touch the particle block,
and keep it beside the step-5 record.

`baseline/art-sphere-step4/` is a lower priority and needs the source-swap
method. **If you do use that method, note the trap task 1 exposed:**
`__artHarnessReset` lives in `ArtTab.jsx`, i.e. in the **app**, not the harness.
Swapping old app source back in while keeping the harness at HEAD therefore
gives you a control that is *still jittery* while the WIP is stable — you would
be comparing a stable set against an unstable one. The reset patch has to be
carried onto the swapped-in source, and the `layers: no census` proof does
**not** detect its absence.

### 3. Step 6 — particles, the last 2D content

Spec §Step 6. The trail half is already DONE (pulled forward, 2026-08-10). Only
the particle migration is left. The live block is `ArtTab.jsx:1978`–`:2020`:
`ctx.save()`, `globalCompositeOperation = 'lighter'`, a `createRadialGradient`
glow disc and an `hsla` core disc per particle, `ctx.restore()`. That is the
whole remaining canvas surface.

Then the spec says "the 2-D canvas is now empty: delete it, its texture and the
composite quad" — and **check that claim before acting on it**; it was wrong at
the end of step 4 and cost step 5 two extra layers. `grep -n "ctx\." ArtTab.jsx`
and read every hit, including the ones above line 1900 that are inside comments.

Follow the shape every step on this branch has used: a **pre-flight scan** of the
actual block before the plan (`ArtTab.jsx:1978`–`:2020` and `artParticles.js`),
because the spec's one-paragraph description has understated the block **every
single time** — seven layers where there were thirteen in step 5, "ordinary line
segments" where there were quadratic Béziers over three sub-layers in step 4.
Write the plan document; every prior step got one.

Particles draw with `lighter` across the whole disc and are, by `artInk`'s own
accumulation arithmetic, the layer with the most to lose in a move to a fully
rewritten target. Measure them properly — you now can.

### 4. The spoke's 1.098 GL/2D ratio — never actually gated

Step 4 task 6 measured the star spokes rendering **9.8% brighter in GL than in
2D** and the controller registered a dissent: "a ~10% bright sub-layer must not
be baked into" the reference baseline that steps 5 and 6 are measured against.
It was recorded as "carried forward as a TASK 7 GATE".

**It was never gated.** `4cff695` (step 4 task 7) touched only baselines, the
spec, `artBaseline.mjs` and `artSmoke.mjs`. It never touched the spoke. So the
1.098 is baked into `baseline/art-sphere-step4/` **and** into
`baseline/art-sphere-step5/`. Also still open from that task: the 1.526 px notch,
and whether `CURVE_MAX_SEGMENTS = 24` binding routinely is silently coarsening
the flatness guarantee.

Verify the finding still reproduces before acting — it is weeks old, `65e62b8`
changed the same amplitude family under it, and the harness it was measured with
was not reproducible.

### 5. A whole-branch review before the branch is finished

Never run, and the debt is real:
- Step 4 task 6 was **accepted without review** (its reviewer was killed twice).
- `cbf22f1` (the GHOST TRAILS presence repair) landed from a parallel session and
  was never reviewed.
- Step 5 tasks 1–8 have had no review pass at all.
- `2adc482` (task 1) has had no review pass. It touches the app's dev-only
  harness reset, `artBaseline.mjs` and `artPresence.mjs`.

### 6. Sweep the scratch before the branch is finished

~86 untracked `baseline/` dirs (37 of them `t9*` from task 1) and ~50
`scripts/_*` files. Housekeeping, last.

Keep the instruments the records reference: `_t8align.mjs`, `_t8immRot.mjs`,
`_nodeShot.mjs`, `_t7tail.mjs`, `_t6ghost.mjs`, `_t5rings.mjs`, `_t3disc.mjs`,
`_crop.mjs`, and task 1's `_t9matrix.mjs`, `_t9trace.mjs`, `_t9tracediff.mjs`,
`_t9frames.mjs`, `_t9cross.mjs`, `_t9force.mjs`, `_t9shotnull.mjs`,
`_t9resize.mjs`, `_t9drift.mjs`, `_t9dims.mjs`. The rest are per-task probes.

---

## WHAT THIS BRANCH HAS LEARNED — all of it still applies

- **Ask what the gate can actually SEE before quoting it.** Nine of thirteen node
  layers were in no capture state. This is the branch's defining failure mode and
  it has recurred at the level of a whole capture *state*.
- **A same-build null before any ratio — and more than one pair of runs.**
- **Look at the render before theorising.** Task 8's headline finding was three
  scales of perfectly consistent numbers pointing the wrong way; opening two PNGs
  killed it in a minute. Task 1 confirmed the world had moved by opening two
  PNGs, then spent hours on the wrong cause anyway because it did not check
  whether the *camera* had moved until much later.
- **A record that states a mechanism can be wrong, and inherited wrongly.**
  Task 1's whole premise was a two-clause diagnosis that was falsifiable from
  artifacts already on disk, carried into a handover that said "do not
  re-derive it".
- **Read the instrument's own documentation before quoting its output.**
  `trail-deficit.md` §1 had the rule that would have prevented four reports.
- **Read the `renderer` field before quoting a frame-time delta.**
  `baseline/art-sphere-step4/` holds numbers from two instruments 2–3× apart.
- **The forcing hook always moves more than its layer.**
- **A layer can give itself a null** — task 7's probe is the cleanest on the
  branch: clear it, step ONE frame, the difference IS the layer.
- **Pool a dashed layer's samples across instances rather than voting per
  instance.**
- **Measure the SHAPE, not the size.** Signed mean, not `|abs|`.
- **Every threshold must be a contrast, never an absolute level** — the composite
  blooms.
- **Prove a law where there is a lever, not where the layer happens to draw.**
- `__pump(n)` **never yields** — step with `await page.pump(1)` in a loop. Now
  implicated in three separate findings: no promise, React commit or
  ResizeObserver delivery can land inside a pump batch.
- **A screenshot and a real-time sleep both cost ZERO frames** (measured). What
  they *do* cost is a yield, which is when real browser tasks land.
- **A retry that can exit on half its condition is not a retry.**
  `artPresence`'s filament/zone loop broke on the sum of two lists; a partial
  result ended it and the empty half read as a broken layer.
- Never run vitest with `-u`. Never `git add -A`. Re-read anything in `scripts/`
  before editing it.
- Backticks inside the GLSL template literals in `SphereEdges.js` terminate the
  string.
- Long-running captures: give each background run a **fresh log filename**. A
  stale log from a previous run satisfied a wait condition and produced a
  comparison against a directory that did not exist.
- A `git checkout HEAD -- <file>` used to test a baseline **must be restored in
  its own command**, not chained after a long-running loop. One such chain timed
  out before the restore ran and three subsequent "verification" runs silently
  measured HEAD instead of the working tree.

## GATES (all green at `2adc482`)

```
npx vitest run          1188 passed / 111 files
npm run lint            0 errors, 144 warnings (ratchet 153 — a new warning is YOURS, fix it)
npm run build           clean
node scripts/artSmoke.mjs        10/10
node scripts/artPresence.mjs     19/19   (5 consecutive runs)
node scripts/artBaseline.mjs --out baseline/<ctrl|wip> [--scale NAME]
node scripts/artCompare.mjs baseline/<ctrl> baseline/<wip>
node scripts/artInk.mjs     baseline/<ctrl> baseline/<wip>
node scripts/_t8align.mjs   baseline/<ctrl> baseline/<wip>   <-- run this FIRST
node scripts/_t9matrix.mjs  <state> <scale> <set> <set> ...  <-- and this, over several runs
```

`--scale NAME` restricts a capture to one of the three scales. A reference set
must always be captured at all three; the flag is for iterating on the harness,
where three of everything is three times the wait and none of the extra
information.

**The `artSmoke` 3b flake is FIXED** and landed as `1330763` from the parallel
session; that session is finished and `scripts/artSmoke.mjs` is no longer
contended. `artPresence`'s `GENESIS GLOW` and `FLASH GRID` have each failed once
historically and passed on the next run at the same HEAD with nothing changed.
If one surfaces, **capture the name** rather than re-running until green — and
if a check fails, measure its rate at unmodified HEAD before assuming it is
yours. Task 1 did that and found one failure that was pre-existing.

## The rig

Dev server is `.claude/launch.json` → `scale94-dev` on port 5174. Drive the
browser through `scripts/cdp.mjs`, **never the browser pane** (it reports
`document.hidden`, which suspends rAF).

A `waitFor timed out: boot` is a dead dev server. A `waitFor timed out: sphere`
on the first run in a fresh worktree is the one-time cold Vite dep-optimize
force-reloading the page mid-boot (`new dependencies optimized … reloading` in
the server log) — warm the cache and re-run.

A full three-scale capture takes several minutes; run pairs in the background
and wait on the **artifact** (`baseline/<dir>/manifest.json`), not on a log line.

Work as a critical senior dev: no yes-machine, push back when the evidence says
so, and look at the render before theorising about a visual bug. **Do not push or
merge — report to the author and he decides.**

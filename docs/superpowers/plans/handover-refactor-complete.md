# Handover — the WebGL refactor is COMPLETE and CERTIFIED, and not merged

Continue the /art sphere work on `fix/art-sphere-index-space` in `F:\scale_9.4`.

NAMING: the nav label /CHAOS and the route ~/system/art are the SAME TAB.
`ArtTab.jsx` is the sphere.

---

## THE ANSWER TO "ARE WE DONE"

**The Canvas2D → WebGL migration is functionally complete.** Every visual layer
draws on the GPU; the conductor was the last 2-D layer and went across in
`e09ad1e`. Phase 1 is certified 21/21 against a reference captured at current
code. All gates are green. Nothing open blocks visual work.

**The refactor is not CLOSED, because it has not merged.** That is a decision,
not a task. Items 2 and 3 are open but are measurement disputes, not defects.

Do not re-litigate the migration. Do not re-run item 4. Start visual work.

## STATE, verified at the time of writing

    HEAD                 1df137b      tree CLEAN
    origin/fix/...       09cc8c9      TWO unpushed: 8a2c6fb 1df137b
    main (local)         a54ea3e      untouched, 123 commits behind HEAD
    origin/main          811f290      LOCAL MAIN IS BEHIND — fetch before merging

Untracked `baseline/*`, `scripts/_*` and `lookbook/*` are deliberate. The ledger
`.superpowers/sdd` is its own private repo (`.gitignore = *`, needs `git add -f`)
and is CURRENT as of `1c429cf`.

**DO NOT push without a new explicit command** — verification approval is not
push consent. DO NOT merge. DO NOT touch `main`. Never `git add -A`. Never run
vitest with `-u`.

## THE REFERENCE — read this before quoting any number

**`baseline/art-sphere-phase1-bloom-ink-certified` at `b8ad97f` is the live
reference.** Five sets, 21/21 at floor 0.95, worst 0.9791. Siblings
`p1bref-b..e`, named in `repro.dirs`; `artInk` reads them for its ink floor, so
do not sweep them.

**It re-bases ALL 21 cells**, unlike the previous two references which each moved
three. Its README says so first, and says why. A reader who pattern-matches the
three-cell story will mis-read every quiet row.

`8a2c6fb` and `1df137b` land after it and move no captured pixel (`nodeAt` is
hit-testing; `dimsRef` affects only pre-resize frames; the other is docs), so the
reference is still valid at HEAD.

## GATES

    npx vitest run                 expect 1292 / 116 files
    npm run lint                   expect 0 errors, 145 warnings (ratchet 153)
    npm run build                  expect clean
    node scripts/artSmoke.mjs      expect 12/12
    node scripts/_s7probe.mjs      expect 11/11
    node scripts/artPresence.mjs   expect 19/19 — BUT SEE BELOW

**`artPresence` FLASH GRID cannot be trusted as a gate.** It has TWO independent
instabilities: the `quiet` baseline is bimodal (2.524 or 2.705, never between)
against a 0.3 bar, AND the right-click trigger varies — the same quiet of 2.525
produced `lit` 2.923 (pass) and 2.737 (fail). **Clean HEAD fails it roughly one
run in two.** A miss here is not a regression; re-run before believing it.

Separately: artPresence passed 19/19 through a 45% bloom intensity cut with the
star spoke reading UP. Every statistic it takes is a CONTRAST against a displaced
control, so a composite change lifts the layer and its control together. **It
cannot see a composite change in either direction.**

## WHAT IS CLOSED

**Item 1** — the immersive race. `57f0d44`. One observation deliberately left
open (callback 5 entering 30 draws late, once, never reproduced in 28 runs);
`baseline/_z1init-NOTES.md` has the arithmetic. Not closed, not established.

**Item 5a** — the bloom. `d1936f2` cut the pyramid 8→5 levels off a bloom-OFF
control; `7899b7a` cut intensity 1.1→0.6. Cutting the pyramid FIRST is what made
the intensity dial mean one thing.

**Item 5b** — the ink scale. `b8ad97f`. `project()`'s scale cancels `sphereR`, so
the cage grew with the display and the ink did not. `inkScale(w,h)` is written as
a RATIO — never a literal 580, which would under-ink a 600px window by a third —
and is EXACTLY 1 in normal mode, confirmed by world hash `OFF=94356b54`.
Divergence 1.393/1.757 → **1.03–1.05 on the line median**, which is the statistic
to trust: 40/40 lines in both modes, against a disc population of 93 vs 75–83.

**Item 4** — the whole-branch review. Both halves done. Two findings fixed in
`8a2c6fb`; two pre-existing on `main` recorded and backlogged.

## WHAT IS OPEN, ranked

**1. THE MERGE.** The only thing between here and done. `main` is 123 commits
behind and local `main` is behind `origin/main`. His call, not a task to start.

**2. The immersive trail gain — his next pass, and the one with a number.**
`RIFT_ALPHA` is 0.72 normal against 0.32 immersive, a 3.125× standing gain into
an RGBA8 accumulator. 869 of the fired state's 1429 clipped pixels clip with the
bloom entirely OFF, i.e. upstream of the post stack. **Item 5b roughly DOUBLED
the ink in exhibit mode** (`artInk` frame ratio 2.040 at the projector), so this
got more urgent, not less. That is the number to start from.

**3. His two `inkScale` dials, deferred not decided.** It ships full strength and
unclamped. A clamp at `>= 1` only protects a window shorter than its own
normal-mode canvas (at 600×400 the ink goes thinner) — no exhibit display reaches
it. Either decision re-bases the same three `immersive-on` cells.

**4. Items 2 and 3**, unchanged. See `handover-post-step7-fixes.md`. Item 3 can
NEVER be gated by `artPresence` — see above, which strengthens that.

**5. Backlogged, pre-existing on `main`:** `useAnalogicalReasoning` declares
`const N = NODES.length; // 31` and NODES is the **272-entry corpus**, so 23 of
31 sphere nodes read another node's chimera and ghost state (the first 8
coincide, which is why it survived). A task chip exists. Fixing it changes which
nodes animate — a visual decision. Also `artAwakening.js:43`'s
`(col?.hue ?? 30 + 90) % 360`, which binds as `(col?.hue ?? 120) % 360` and kills
the genesis burst's hue drift.

**6. Not started:** `luminanceThreshold` (0.28) never swept; a composite dither
for 8-bit banding on black — the bloom pyramid is already half-float, so that
belongs in the screen pass and nowhere else.

## THE DEAD 2-D PATH — attempted, backed out, DO NOT RETRY BLIND

Nothing draws to the sphere's 2-D canvas any more, yet `SourceQuad` still uploads
it as a `CanvasTexture` **every rendered frame** — its own comment calls that
"the whole cost of the composite".

Removing it is **provably safe at the pixel level**: `scripts/_u1src.mjs` (KEEP)
measured **max alpha 0 over 13.7M pixels, six states, two geometries**, and the
screen pass's `mix(bg, src.rgb, src.a)` returns `bg` EXACTLY at `src.a = 0`. It
gated clean.

**It still failed, on DETERMINISM not pixels.** Three capture sets of the removal
build failed `artNull`: **laptop@2x `immersive-on`, worst 0.2103, TWO DISTINCT
WORLD HASHES**. Every other cell 0.9818–1.0000. A shader edit cannot move a world
hash — but removing a per-frame upload changes TIMING, and item 1's race is a
browser task landing between two ResizeObserver callbacks that each end in an
`initState()` re-scattering 31 nodes from 124 `artRandom` draws.

**NOT ATTRIBUTED.** `_z2burst` read 4/4 identical worlds on the removal build,
but it is not the instrument that failed, and **the clean-HEAD control was never
run**. Backed out on the author's call: pure optimisation, no visual benefit, and
a trustworthy harness beats frame budget before visual iteration. Evidence:
`baseline/_u1kill-a..c`. **If retried, run the clean-HEAD control FIRST.**

## WHAT THIS SESSION LEARNED

- **`canvasHash` and `shotHash` BOTH lie about change.** `canvasHash` reads the
  same value for six visually different states (it hashes the near-empty 2-D
  canvas) and reports 21/21 IDENTICAL across two different builds. `shotHash`
  differs in all 21 cells AND between two runs of one build. Geometry is
  `view.world.hash`, pixels are `artCompare`, ink is `artInk`.
- **Read `artInk` per state, never the mode rollup.** The rollup is sum-weighted
  and `fired-cascade` drags a whole row; the tool says so itself.
- **Four reported regressions on this branch have not reproduced.** Two more this
  session: artPresence's FLASH GRID and the handover's "9–14 px top clearance",
  which reads 1.0 at clean HEAD too. Every one was resolved by measuring the same
  thing on clean HEAD. **One stash and one run.** Do that before believing a diff
  caused anything.
- **Backticks terminate the GLSL template literal.** A comment containing
  `` `mix(...)` `` inside the shader string broke the build. The shader now says
  so in place.
- **`artBaseline` stamps `BASELINE_COMMIT` with no dirty-tree check**, so a
  capture from a dirty tree stamps a commit that does not contain the code.
  Commit first, then capture.

## THE RIG

Dev server: `.claude/launch.json`, `scale94-dev` on port 5174. Drive Chrome via
`scripts/cdp.mjs`. **NEVER the browser pane** — it reports `document.hidden`,
which suspends rAF and freezes the sphere.

A three-scale capture is ~3m20s; five sets plus certification ~18 minutes. Wait
on `manifest.json`, never a log line. Fresh output directory per run. Never
capture a reference with `--reseed-per-callback`.

`scripts/_a3bloom.mjs` and `scripts/_nullPatch.mjs` PATCH TRACKED SOURCE and
restore in a `finally` — **check `git status` after using either.**

---

Work as a critical senior dev: no yes-machine, push back when the evidence says
so, and look at the render before theorising about a visual bug. Report to the
author and he decides.

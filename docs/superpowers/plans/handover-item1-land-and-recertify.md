Continue the /art sphere WebGL work on `fix/art-sphere-index-space` in
F:\scale_9.4.

NOTE ON NAMING: the nav label /Chaos and the route ~/system/art are the SAME
TAB. `ArtTab.jsx` is the sphere. Phase 1 is functionally complete — one
`<canvas>`, two `ctx.` sites (setTransform, and the destination-out clear that
drives the trail fade).

Your job is ONE sequence: land a two-line fix whose mechanism is already
measured, then re-establish the reference it invalidates. Do not re-derive the
mechanism. It cost a session roughly 40 probe runs and it is settled.

READ FIRST, in this order — the first two are the ones that matter:
1. `baseline/_z1init-NOTES.md` — what was measured, which set is which build,
   and the retraction. Short.
2. `git show 4c50376` — the instrument's commit message, which carries the
   whole finding.
3. `docs/superpowers/plans/handover-post-step7-fixes.md` — items 2-5, the
   gates block, the rig, and "what this branch has learned".
4. `docs/superpowers/plans/audit-item4-shaders-and-rng.md` sections 5b and 6 —
   the defect this fixes, and the lead that found it.
5. `.superpowers/sdd/post-step5-task2-report.md` — why the null is a gate and
   why three sets is the floor. You are about to run it in anger.
6. `baseline/art-sphere-step5-certified/README.md` — how a reference README is
   written. Yours must be written the same way.

STATE: HEAD `46fcb8c`, tracked tree clean, THREE commits unpushed
(`4c50376`, `43f8f14`, `46fcb8c`). `main` untouched at `a54ea3e`, and LOCAL
MAIN IS BEHIND `origin/main` at `811f290` — fetch before ever merging. Ledger
`.superpowers/sdd` is its own private repo, clean, at `3eec897` (needs
`git add -f`; its .gitignore is `*`).

DO NOT push. DO NOT merge. DO NOT touch `main`. DO NOT run vitest with `-u`.
NEVER `git add -A`. Backticks inside a template literal terminate the GLSL
string — grep every hunk before running. Use absolute paths in subshells; `cd`
in a Bash call persists. Do not edit source while a capture is running.

--------------------------------------------------------------------------
THE FINDING, so you do not re-measure it
--------------------------------------------------------------------------

On `immersive-off` the ResizeObserver fires TWICE with no pumped frame between
the two callbacks, so no reseed between them. Each callback ends in
`initState()`, which re-scatters all 31 nodes from 124 `artRandom` draws.

React evaluates the `useRef({ beaconIdx: Math.floor(artRandom() * ...) })`
object literal on EVERY render and discards all but the first, so every render
of ArtTab takes one draw. Whether one lands in that gap decides whether the
second re-scatter starts one draw later.

MEASURED, 21 runs at 1520x900@2x: exactly TWO immersive-off worlds, never
three. `a0c3af39` on a gap of 125 draws (19 runs), `280ffe40` on a gap of 124
(2 runs). Both divergent runs landed on the same hash. It is a switch with two
positions, not a chaotic process — which corrects the record's "three distinct
world hashes".

Hoisting the draw makes it render-INDEPENDENT: 28 recorded runs of the patched
build, one world, gap 124 every time — including two runs that took no render
across the gap where their siblings took one.

Unresolved and NOT blocking: one run once showed callback 5 entering 30 draws
late. Never reproduced in 28 recorded runs. `_z1init-NOTES.md` carries the
detection-power arithmetic — ruled out at 8%, not at 3%. Do not record it as
closed and do not record it as established.

--------------------------------------------------------------------------
STEP 1 — LAND THE PATCH
--------------------------------------------------------------------------

`src/terminal/views/ArtTab.jsx`, the `awakeningRef` declaration (~line 319).
Replace the eager initializer with a lazy one:

    const awakeningRef = useRef(null);
    if (awakeningRef.current === null) awakeningRef.current = {
      ... unchanged body ...
    };

LAZY INITIALIZER, NOT A PINNED CONSTANT. post-step5-task1 says "if it is ever
worth pinning, pin it to a CONSTANT" — that note is about the harness RESET,
not this site. A constant kills the beacon's per-page-load randomness, which is
visible intent in awakening phase 1. Lazy keeps exactly the one mount draw the
artwork wants and removes only the accidental ones. For the capture the two are
identical anyway, because the reset re-seeds after mount.

Write the commit message with the measurement in it, as this branch does.

--------------------------------------------------------------------------
STEP 2 — GATES, and one acceptance check better than all of them
--------------------------------------------------------------------------

Dev server: `.claude/launch.json` gives `scale94-dev` on port 5174. Drive
Chrome through `scripts/cdp.mjs`, NEVER the browser pane (it reports
document.hidden, which suspends rAF).

    npx vitest run                 expect 1279 / 115 files
    npm run lint                   expect 0 errors, 145 warnings (ratchet 153)
    npm run build                  expect clean
    node scripts/artSmoke.mjs      expect 12/12
    node scripts/_s7probe.mjs      expect 11/11

THEN THE REAL CHECK. `scripts/_z2burst.mjs` reproduces the patched build's
world exactly. Run it and read it with `_z2read.mjs`:

    node scripts/_z2burst.mjs baseline/_z3land-a.json 1520 900 2
    node scripts/_z2read.mjs  baseline/_z3land-a.json

EXPECT, and these are hard numbers from 28 runs of this exact patch:

    on=a606cf38/134   OFF=94356b54/134   initState calls=7
    callback entries: #4 42   #5 42   #6 166        gap 5->6 = 124

If those numbers appear, the patch is correct and item 1's mechanism is closed.
If `OFF` reads `a0c3af39` or the gap is 125, the patch did not take.

--------------------------------------------------------------------------
STEP 3 — THE REFERENCE. Read this whole section before capturing anything.
--------------------------------------------------------------------------

A DECISION FIRST, and getting it wrong wastes the entire capture. There are two
different things called "re-capture the reference":

 (a) Re-capture `baseline/art-sphere-step5-certified` — a worktree at
     `3551885` WITH this patch applied — which preserves the step-5-vs-step-7
     PARITY comparison that items 2 and 3 are measured on.
 (b) Capture a NEW step-7-plus-patch reference for everything that comes after,
     and leave the historical step-5 parity numbers frozen where they are.

**Do (b).** Item 1 is a question about REPRODUCIBILITY, not parity, and the
instrument for it is `artNull`, which needs only one build. Phase 1 is
complete, so a step-7 reference is what phase 2 needs anyway.

**But run this check first, because it may make (a) unnecessary rather than
skipped.** The patch should change ONLY the immersive cells: the normal states
involve no resize, so no between-frame `initState`, so nothing displaces them.
Evidence — at `pre immersive-on click` the world is `50d32e49` on BOTH the
patched and the unpatched build. So compare the new sets' per-cell world hashes
against `baseline/s7cond2-a/manifest.json`. If `idle`, `hover`, `mid-drag`,
`fired-cascade` and `resonance` hash IDENTICALLY, every existing parity and ink
number still stands and only the two immersive rows are re-based. **Say so
explicitly in the new README either way** — it is the single most useful fact
the next session can inherit.

Then capture. FIVE sets for a reference; three is the floor:

    BASELINE_COMMIT=$(git rev-parse HEAD) node scripts/artBaseline.mjs --out baseline/NAME-a
    ... and -b -c -d -e
    node scripts/artNull.mjs baseline/NAME-a baseline/NAME-b baseline/NAME-c \
         baseline/NAME-d baseline/NAME-e --write baseline/NAME-a

SET `BASELINE_COMMIT`. `gitCommit` is null in every manifest on disk because
nothing has ever set it, so no capture set records which build it is. Fix it
here rather than inheriting it.

Capture notes that cost time if you miss them: a three-scale capture is
**3m50s**, five is about twenty minutes — run them in the background and wait
on the ARTIFACT (`manifest.json`), never a log line; a `nohup ... &` wrapper
exits instantly, so its "completed" notice is the WRAPPER, not the work. Use a
FRESH output directory per run (re-running into an existing one asks it to
relaunch until it matches a boot fingerprint it will not hit again) and a fresh
log filename. `--write-partial` is a BARE flag; the directory belongs to
`--write`. Never capture a reference with `--reseed-per-callback` /
`__reseedEachCallback` — a diagnostic, and it produces a different picture, not
a truer one.

ACCEPTANCE: `artNull` certifies **21/21** at floor 0.95, all 21 cells agreeing
on the world hash, INCLUDING both `immersive-off` rows — those are the two that
have never certified and they are the whole point. Quote the worst pair; the
old reference's was 0.9775.

If the gate REFUSES, that is a result, not a setback. It has refused a
reference three times on this branch and been right all three times, and each
refusal found a real fault. A refusal at `immersive-off` specifically is the
3%-rate second source — capture its world hashes and hand them back rather than
re-running past it.

Write `baseline/NAME/README.md` on the step-5-certified README's model: why
this set exists, what changed and why the old one is not a regression, the
same-build null table, and what the null does NOT cover.

--------------------------------------------------------------------------
STEP 4 — RE-MEASURE THE artPresence RATE AGAINST THE NEW WORLD
--------------------------------------------------------------------------

Not optional and not a formality. `artPresence`'s probes are TUNED to the world
`artRandom` produces: post-step5-task3 measured ONE displaced draw taking it
19/19 to 15/19 (RESONANCE EDGE, PRISM GEOMETRY, ANALOGY FILAMENTS, CHIMERA
FRINGES). The world has now moved. A failure after this patch is not evidence
of a regression until its RATE is known.

Run it **five times** at the patched build and record WHICH checks fail, by
name, not just the score:

    node scripts/artPresence.mjs        x5

Prior, for comparison: 19/19 twice at `0fdae8d`, 19/19 twice at `faa872d`, and
19/19 once at `46fcb8c`. `GENESIS GLOW` and `FLASH GRID` are
known-intermittent — capture the name rather than re-running until green.
`PRISM GEOMETRY` and `CHIMERA SYNC RING` are NOT in that set: when they have
failed it has always been a real regression, and PRISM GEOMETRY in particular
is the canary for composite resampling (`0fdae8d`: the spoke fell 25.03 to
15.65 against a 19.5 bar when the GL buffer went one device pixel short).

If a check now fails repeatably, do NOT retune the threshold to make it pass.
Item 3 documents exactly that circularity — `artPresence`'s spoke threshold is
already calibrated on the number it would have to judge. Report it.

--------------------------------------------------------------------------
STEP 5 — REPORT
--------------------------------------------------------------------------

Report back with: the four `_z2burst` acceptance numbers; the `artNull` verdict
with the worst pair and whether both immersive rows certified; whether the five
normal-state world hashes matched `s7cond2-a` (the "is the patch
immersive-only?" question); and the `artPresence` rate over five runs, by check
name.

Then STOP. Do not push, do not merge — report and the author decides. A push
needs a new explicit command.

Write a ledger entry in `.superpowers/sdd` (`git add -f`, separate commit in
that repo). The three fixes before this one have no ledger entry and their
evidence lives only in commit messages; do not make that four.

--------------------------------------------------------------------------
WHAT ELSE IS OPEN — do not fold any of it into this work
--------------------------------------------------------------------------

Item 2 (the particle ink excess, re-scoped: real at the mode rollup, noise in
20 of 42 per-cell rows), item 3 (the spoke's 1.098, which needs a worktree at
`cbf22f1` and cannot be gated by `artPresence`), item 4 (12 of ~20 commits
still unreviewed), item 5 (the author's calls: bloom in immersive, the
immersive scaling law, deleting the 2-D canvas, immersive not being
fullscreen). All are in `handover-post-step7-fixes.md`. The author has deferred
the visual ones until this is stable.

Work as a critical senior dev: no yes-machine, push back when the evidence says
so, and look at the render before theorising about a visual bug.

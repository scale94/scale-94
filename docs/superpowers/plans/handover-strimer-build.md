# Handover — build the strimer wavefront

Continue the /art sphere work on `fix/art-sphere-index-space` in `F:\scale_9.4`.

NAMING: the nav label /CHAOS and the route ~/system/art are the SAME TAB.
`ArtTab.jsx` is the sphere.

---

## THIS JOB STARTS WITH CODE. THE DESIGN IS DONE.

Unlike the handover before it, this one hands you a finished spec and a
task-by-task plan, both approved by the author and both committed:

    docs/superpowers/specs/2026-09-20-strimer-wavefront-design.md   5309b90
    docs/superpowers/plans/2026-09-20-strimer-wavefront.md          0c9c76b

**The author chose SUBAGENT-DRIVEN execution.** Use
`superpowers:subagent-driven-development`: a fresh subagent per task, two-stage
review between tasks. Five tasks, ordered so that a failure has exactly one
candidate cause.

Read the spec's §1 before dispatching anything. Three of its four measurements
killed an earlier version of this design, and a subagent that has not read them
will cheerfully rebuild the version that was killed.

## STATE YOU ARE INHERITING — AND A CORRECTION TO THE LAST HANDOVER

Branch `fix/art-sphere-index-space`, **2 commits ahead of its origin**
(`5309b90`, `0c9c76b` — both docs). `src/` HAS NOT BEEN TOUCHED since
`b506462`. Verified this session:

    118 test files, 1316 tests pass
    npm run lint — 0 errors, 145 warnings against a 153 ratchet
    git status — clean of tracked changes

**THE PREVIOUS HANDOVER IS WRONG ABOUT `main`, IN BOTH HALVES.** It says
"`main` is UNTOUCHED and is behind `origin/main`; fetch before any merge." I
fetched. The truth:

    git rev-list --left-right --count origin/main...main   ->   0    19

`main` is **19 commits AHEAD** of `origin/main` and **0 behind**. It is not
untouched — it carries two merges (`a54ea3e` the lint gate,
`020eece` the art-sphere groundwork) and seventeen commits under them. So
merging this branch into `main` would compound unpushed work, and pushing
`main` would publish nineteen commits at once, not one.

This also retires a line in memory: the lint-gate work IS merged to local
`main` at `a54ea3e`, not "NOT merged" as recorded.

**Do not merge. Do not push.** Verification approval is not push consent and
never has been. Ask.

## WHAT THE TWO PROBES MEASURED, IN ONE PAGE

Both are committed and both patch tracked source. The spec has the full
account; this is what a subagent needs to not undo.

`scripts/_s1wake.mjs` — a stacked disc on the existing **additive edge mesh**.
`scripts/_s2layer.mjs` — a capsule on the **new non-accumulating layer**.

**The 18-float edge layout cannot express ink above 1.0.** `writeHsl` clamps,
`packAlphas` quantises alpha to a byte, `COMPOSITE_ADDITIVE`'s factors are all
≤ 1. One additive instance maxes at exactly 1.0 per channel. The handover
before this one says the ">1.0 blinding head" is possible now because the
accumulator went half-float — that is half true, and the false half would cost
a session. **The headroom is in the target, never in the writer.** The prism
reaches its measured 37x by stacking 770 coincident curves.

**On the additive mesh, head brightness IS tail length in immersive.** That
mesh draws into the trail accumulator (measured survival 0.21–0.24 normal,
0.48–0.59 immersive), and the knee then compresses the decaying residual so it
reads *flat*: a stack-3 head held **98% / 96% / 87%** of peak for three frames
after it stopped being drawn, where stack 1 fell 73% / 41% / 22%. Brighter
head, longer afterimage. That is why the strimer is not on that mesh.

**A point head at this speed strobes into beads.** 41px of travel per frame
against a 6px head — it never overlaps itself. Immersive showed the entire
trajectory lit at once. The per-frame stride is **17% of the edge**, which is
exactly the packet length the brief already asked for, so `PACKET_FRACTION`
is the anti-aliasing requirement and not a taste knob. Photographed.

**The chosen layer clears in ONE frame, in both modes.** 0.80 → 0.020 normal,
0.78 → 0.027 immersive, both at the simulation's noise floor. Measured peak
through bloom+knee: 0.907 / 0.967 / 0.979 at gain 1 / 2.4 / 4.

## THE ONE CLAIM WORTH BEING RIGHT ABOUT

Because the layer clears in one frame, any frame shot ≥2 frames past arrival is
identical to the pre-click frame — and every existing capture state shoots far
later (`artBaseline` waits 20–24 frames for the pulse rings; `_a3bloom --live`
uses 14/26/44).

**So the strimer may not move the reference at all,** and
`baseline/art-sphere-phase2-bloom-dial-certified` at `d69ce75` may keep its
attribution intact. Task 5 tests that FIRST, before any re-base. Verify it. Do
not assume it, and do not re-base pre-emptively — re-basing twice is how
attribution is lost.

## TRAPS

**Look at the render before theorising about a visual bug.** Standing rule.
It earned its keep again this session: the bead necklace was invisible to every
number I had and obvious in the first frame I looked at.

**`_s1wake` and `_s2layer` PATCH TRACKED SOURCE** and restore in a `finally`,
as `_a3bloom` and `_nullPatch` do. A hard kill beats the restore.
`git status -- src/` after either. Never run them during a capture.

**A dynamic `import()` of one of those scripts EXECUTES it.** I did this inside
a `node -e` one-liner meant only to inspect the file; it patched `ArtTab.jsx`
and drove two browser cells before I noticed. The `finally` held. Check
anyway.

**Piping a probe to `head -3` SIGPIPEs node mid-run.** The restore still fired;
the analysis pass did not, and the run looked like a crash.

**The screenshot spans the WINDOW; edge coordinates are in CANVAS px.** My
first sampler read a strip of page chrome and produced a whole table of
confident garbage whose "peak" never tracked the packet and did not move when
the head's brightness tripled. Read the canvas rect from the page — measured
`+32,+317` normal and `+0,+96` immersive at 1520x900. **Never fit the offset
afterwards:** a one-frame presentation lag and a coordinate offset fit the
same trajectory equally well, and I briefly believed the wrong one. With the
rect read properly there is **no lag**.

**The immersive toggle is an icon button with no `innerText`.** Match
`title` and `aria-label` too, as `_a3bloom` does, or a rig dies after the
normal cells.

**three 0.183 replaced `updateRange = {offset, count}` with
`addUpdateRange(offset, count)`.** The old form uploads nothing while the
instance count, the draw call and the material all look correct. Mirror
`syncEdgeLayer` exactly. This is already fixed in the plan; do not let a
subagent "simplify" it back.

**`artCompare` at threshold 4 can pass a change that is obvious by eye** — it
passed the whole bloom dial move 21/21. It is a tripwire, not a verdict.
`artInk` ratios can read flat while the picture is transformed; read `lit` and
`meanLit` beside every ratio. The frame strip is the gate.

**The `immersive-off` cell's world hash is unstable across boots.** If it is
your one failing cell, re-capture before concluding anything.

**Use `scripts/cdp.mjs`, never the browser pane, and never `--disable-gpu`.**

## WHAT NOT TO DO

- Do not put the strimer on the additive edge mesh. Measured, rejected, and
  the spec records why in numbers.
- Do not make the head a saturated colour. The knee scales all three channels
  equally and can never whiten one. The head is white; the neon is the tail.
- Do not drive anything here with a frame counter. It runs at double speed on
  the author's 120Hz display — the /SCENT bug. `determinism.mjs` virtualises
  `performance.now()`, so time-based is also the reproducible choice.
- Do not write `NODE_COLORS` straight into this layer. Its buffer is LINEAR
  and `NODE_COLORS` is sRGB; `hslToLinearRgb` exists for exactly this.
- Do not make `BLOOM` mode-dependent. Measured, killed.
- Do not build the dither. Deliberately unbuilt; the author ruled the film
  grain stays.
- Do not widen scope to the standing wave. Its own spec, deliberately.
- Do not merge, do not push.

## THE DIALS, AND THE HONEST GAP

Three values are aesthetic and belong to the author, chosen on frames:
`HEAD_GAIN` (2.4), `PACKET_FRACTION` (0.17), rail gain (0.08, never swept).

**Gain and packet length are NOT orthogonal** — measured span grew 0.114 →
0.139 → 0.165 across gains 1 → 2.4 → 4, because the bloom halo widens with the
head. Sweep them together.

`STRIMER_MS_PER_UNIT = 200` is **an initial value, not a measured one.** I
could not get the settled chord distribution without another source patch, so
the design clamps every duration into [70, 160]ms — which makes a wrong value
survivable rather than absurd — and Task 4's rig reports the real transits so
it can be set with evidence. Say so when you report; do not let it read as
measured.

## ONE BEHAVIOUR THAT WILL LOOK LIKE A BUG AND IS NOT

The **first click of a session** lights neighbours slightly ahead of its
packets. That is the first-touch crescendo at `ArtTab.jsx:3030-3034`, a
separate once-per-session `+0.5` that lives outside `fireNode` and is a
deliberate flourish rather than the per-click confirmation. Left alone on
purpose and listed in the plan's out-of-scope section.

## THE OTHER OPEN ITEMS, IN RANK ORDER AFTER THIS

The standing wave (needs its own brainstorm), the merge question — which now
means "nineteen unpushed commits on `main`", not "main is behind" — the
deliberately unbuilt dither, item 3, and the `useAnalogicalReasoning`
N=31-vs-272 bug.

Still open on purpose and NOT a defect: **`levels 3`** reads as more definition
rather than harshness. Frames: `lookbook/opt-normal-f26.png`,
`opt-imm-f26.png`, panel 3.

Adjacent and untouched: ArtTab's left-click builds its label cascade from
`ADJ` (272 nodes) while the sphere fires over `SPHERE_ADJ` (31 nodes, 40
edges, max degree 4). The two disagree about who a node's neighbours are. It
may be deliberate. The arrival change in the plan's Task 2 sits right next to
it, so a subagent will see it — tell it not to fix it.

## THE FRAMES ARE NOT IN THE REPO

`lookbook/` is untracked, as it is for every capture here, so `lookbook/wake/`
and `lookbook/layer/` — including the two montages this design was approved on
— exist only on this machine. The two probe scripts ARE committed and
regenerate everything from a pinned world. If the pictures are gone, re-run.
**Do not quote a number from the spec against frames you have not
reproduced.**

---

Work as a critical senior dev: no yes-machine, push back when the evidence says
so, and look at the render before theorising about a visual bug. Report to the
author and he decides.

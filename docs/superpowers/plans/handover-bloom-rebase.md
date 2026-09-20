# Handover — the reference re-base, and nothing else

> **DISCHARGED 2026-09-19.** Five sets captured at `d69ce75`, certified 21/21 at
> floor 0.95, worst 0.9767. The live reference is now
> `baseline/art-sphere-phase2-bloom-dial-certified`, and its README is the
> record — read that, not this, for the numbers.
>
> **Two of this file's predictions were wrong, and the README says so in
> detail.** (a) `artCompare` phase 1 -> phase 2 came back **21/21 ADMISSIBLE**,
> so the premise that a stale reference "will read this as a regression" never
> held — that instrument cannot see a composite change of this size, which this
> file documents as a trap four paragraphs after predicting it. (b) Ink went
> **UP** in normal mode, not down; step 4's stop-and-investigate fired, and the
> investigation found the prediction mis-derived rather than the capture bad.
> Phase 1 predates the knee work, so phase 1 -> phase 2 is knee + dial, not the
> dial. Isolated against `_knee-final-a` at `dc54693`, the dial is normal
> **+1.3 to +18.4%** and exhibit **flat (all three cells grade `noise`)**.
>
> One thing this file did not carry forward from phase 1's README:
> `artBaseline` stamps `gitCommit` from `BASELINE_COMMIT` and nothing else. The
> first capture came back `null` and was discarded. Left unfixed on purpose —
> see the README's trap section.
>
> The rest of this file is kept as the record of what was asked for.

Continue the /art sphere work on `fix/art-sphere-index-space` in `F:\scale_9.4`.

NAMING: the nav label /CHAOS and the route ~/system/art are the SAME TAB.
`ArtTab.jsx` is the sphere.

This file supersedes `handover-bloom-knee.md` for the re-base only. That file is
still correct about the knee, the black floor, the bloom dial and the open
items, and its item 1 is where the dial numbers live. Read it for context, not
for instructions.

---

## THE JOB, IN ONE LINE

`BLOOM` moved, so the reference no longer describes the build. Capture a new
reference — **five sets, one capture event** — certify it with `artNull`, and
stamp the certificate in. Do not change a pixel of `src/` while doing it.

## WHY IT IS BLOCKING, SAID PLAINLY

    reference   baseline/art-sphere-phase1-bloom-ink-certified   at b8ad97f
    HEAD        b506462   intensity 0.6 -> 1.1, levels 5 -> 4

That commit MOVES THE FRAME, deliberately and with the author's sign-off. So
**`artCompare` against the old reference will report a regression and it is not
one.** Until the re-base lands, no parity number on this branch means anything,
and every later step inherits that. This is the whole reason the previous
session deferred it: re-basing twice is how attribution is lost, and the dial was
still open. It is closed now.

## STATE YOU ARE INHERITING

Branch `fix/art-sphere-index-space`, **six commits, NOT PUSHED, `main`
UNTOUCHED.** Do not push without a new explicit command — verification approval
is not push consent.

    ea00596  test(art): a normal-mode path and a live cascade for the sweep
    4be24be  test(art): the third bloom dial, and a way to hold the other two
    5e72430  docs(art): rewrite item 1 on frames that contain a cascade
    6944243  docs(art): f26/f44, the normal-mode levels pass, option 3 dropped
    91cb136  docs(art): the option-3 trap, and two qualifiers
    b506462  feat(art): intensity 1.1 and levels 4, chosen on the frames

`src/` is clean and 1305 tests pass at `b506462`. The only `src/` change in the
whole stretch is the two values in `artComposite.js`; everything else is rig and
docs. **Start from a clean tree and keep it clean** — see the first trap.

## WHAT A REFERENCE IS HERE

Read `scripts/artNull.mjs`'s header before starting. Its argument is the thing
that makes this job what it is, and you should not take it from me second-hand.

The short version: a capture set is 21 cells — **3 scales x 7 states**.

    laptop-1520x900@1x    laptop-1520x900@2x    projector-1920x1080@1x

A reference must be captured at **all three**. `--scale` exists for iterating on
the harness, not for this.

**FIVE SETS, NOT TWO.** Two sets is one pair, and one pair is not evidence when
the fault is intermittent: at p=1/3 a single pair diverges only 44% of the time,
three sets 67%, five sets 86%. Three of the four historical faults were each
found AFTER a clean 21/21 single-pair null had been recorded and written up.
`MIN_SETS` is 3; a REFERENCE — captured once, then quoted for weeks — uses five.

The existing reference is the shape to copy:

    repro: { sets: 5, floor: 0.95, cells: 21, certified: 21,
             worst: 0.9791, partial: false, detectionPower: 0.864 }
    dirs:  art-sphere-phase1-bloom-ink-certified + p1bref-{b,c,d,e}

## THE PROCEDURE

Dev server on `http://localhost:5174/`. Use `cdp.mjs`, **never the browser
pane**. One set at a time; they are separate boots by design.

**1. Confirm the tree is clean and you are at `b506462` or later.**

    git status --short src/ && git log --oneline -1

**2. Capture five sets.** Suggested names, following the existing convention —
the primary carries the certificate, the four siblings are the evidence:

    node scripts/artBaseline.mjs --out baseline/art-sphere-phase2-bloom-dial-certified
    node scripts/artBaseline.mjs --out baseline/p2ref-b
    node scripts/artBaseline.mjs --out baseline/p2ref-c
    node scripts/artBaseline.mjs --out baseline/p2ref-d
    node scripts/artBaseline.mjs --out baseline/p2ref-e

No `--scale`. Each writes a `manifest.json` stamped with `gitCommit`; check after
the first that it reads `b506462` (or your later HEAD) and not something stale,
because nothing enforces it.

**3. Certify.** Floor 0.95, as the existing reference used:

    node scripts/artNull.mjs \
      baseline/art-sphere-phase2-bloom-dial-certified \
      baseline/p2ref-b baseline/p2ref-c baseline/p2ref-d baseline/p2ref-e \
      --floor 0.95 --write baseline/art-sphere-phase2-bloom-dial-certified

**ACCEPT ONLY 21/21.** If a cell fails, do NOT reach for `--write-partial` as a
first move — read the traps, because there is a known cell that does this and a
known reason.

**4. Record the move, do not hide it.** With the new reference certified, run the
OLD reference against the NEW one and keep the output:

    node scripts/artCompare.mjs \
      baseline/art-sphere-phase1-bloom-ink-certified \
      baseline/art-sphere-phase2-bloom-dial-certified
    node scripts/artInk.mjs \
      baseline/art-sphere-phase1-bloom-ink-certified \
      baseline/art-sphere-phase2-bloom-dial-certified

This is **expected to be non-`ok`** — it is the measurement of what the dial
change did across all 21 cells, which nobody has yet. `artInk` should move
coherently and in a predictable direction: `levels 4` cuts the glow footprint
(immersive lit px fell 622k -> 453k on the pinned probe) while raising the hot
core, so expect ink DOWN, and the drop larger in immersive than in normal. **If
ink goes UP, stop and investigate** — that contradicts the probe, and it would
mean something is wrong with the capture rather than with the finding.

**5. Commit the new sets and the numbers**, and say in the message that the old
reference is superseded rather than wrong. Leave both on disk.

## TRAPS, AND THE FIRST ONE WILL BITE YOU

**`artBaseline` STAMPS `BASELINE_COMMIT` WITH NO DIRTY-TREE CHECK.** A capture
taken with modified `src/` is labelled with the last commit and is a lie that
survives on disk for weeks. **Commit before capturing, and `git status` after.**

**Several rig scripts PATCH TRACKED SOURCE and restore in a `finally`** —
`_a3bloom`, `_b2peak`, `_b3strip`, `_nullPatch`. A hard kill beats the restore.
Do not run any of them during the re-base, and if one has been run, `git status`
before you capture anything.

**THE `immersive-off` CELL'S WORLD HASH IS NOT STABLE ACROSS BOOTS.** This is the
long-standing race and it lands on that cell: world hash `be882152` against
`5d6f91d8` at IDENTICAL rotation and sphereR. A fragment shader cannot move a
world hash. It reproduced again in this stretch on a different script — a
`--live` immersive sweep came back `world pinned: NO` with 105/104 edges against
104/103, and the identical command pinned on the retry. **If `immersive-off` is
your one failing cell, re-capture that set before concluding anything.** Five
sets exist precisely so one bad run is visible instead of averaged in.

**`artCompare` AT THRESHOLD 4 CAN PASS A CHANGE THAT IS OBVIOUS BY EYE.** It is a
mean over a 32x18 signature; a 5000x halo covering <1% of frame area moved two or
three of 576 cells and averaged away. `artPresence` is structurally blind to
composite changes, and its FLASH GRID is bimodal at its threshold. `canvasHash`
and `shotHash` BOTH lie about change. **For composite work the real gate is a
frame strip**; these are tripwires, not verdicts. For THIS job `artNull` is the
gate, because reproducibility is exactly what it measures.

**A HARNESS-RESET WORLD IS ~20x DIMMER THAN A LIVE BOOT** (19,328 lit px against
439,596). Relevant if you go looking at capture frames and think they look wrong.

## WHAT NOT TO DO

- **Do not touch `src/`.** If the re-base makes you want to change a value, that
  is a separate decision and a separate session. The whole point of a reference
  is that it describes a build you did not edit while describing it.
- **Do not re-base twice.** If something is unsettled, stop and say so rather
  than capturing "for now".
- **Do not delete the old reference.** It is the attribution for everything
  before `b506462`.
- **Do not push.**
- The `baseline/_*` directories are scratch from the dial work and are untracked.
  Ignore them; they are not sets.

## AFTER IT LANDS

`handover-bloom-knee.md` item 1 is CLOSED by `b506462`, and its "a re-base is
owed" line is what you just discharged — update both. The open items after this
are, in that file's ranking: **the strimer wavefront** (item 2, the author's
design, and the HDR headroom its ">1.0 blinding head" needs now exists), the
merge, the deliberately-unbuilt dither, and item 3 plus the
`useAnalogicalReasoning` N=31-vs-272 bug.

One aesthetic thread was left open on purpose and is NOT a defect: `levels 3`
reads as more definition rather than harshness — tighter halos, blacker gaps,
sharper strands. It is a direction for both modes at once, not a fix for
anything, and it is worth a look on its own terms if the author wants it.
Frames: `lookbook/opt-normal-f26.png`, `opt-imm-f26.png`, panel 3.

---

Work as a critical senior dev: no yes-machine, push back when the evidence says
so, and look at the render before theorising about a visual bug. Report to the
author and he decides.

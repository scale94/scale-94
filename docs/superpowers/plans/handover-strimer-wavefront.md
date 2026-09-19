# Handover — the strimer wavefront

Continue the /art sphere work on `fix/art-sphere-index-space` in `F:\scale_9.4`.

NAMING: the nav label /CHAOS and the route ~/system/art are the SAME TAB.
`ArtTab.jsx` is the sphere.

---

## READ THIS FIRST: THIS JOB DOES NOT START WITH CODE

**The strimer is the author's design, and almost none of it is written down.**
I searched the whole repo — `src/`, `docs/`, `.superpowers/`, every brainstorm
artefact — and the word "strimer" appears in exactly three places: two handover
files and a reference README, all of them quoting the same five lines.

Those five lines are the entire written record:

> **2. THE STRIMER WAVEFRONT.** The author's design, and the HDR headroom its
> ">1.0 blinding head" needs now exists — it was literally impossible before,
> the accumulator had no values above 1.0. Decision already taken: **keep the
> prism and tame it** (done), and add the strimer as the kinetic "signal" crack
> on the same left-click, with the prism fan as the structural "resonance" body.
> Resonance-adjacent straight edges get a slow bidirectional standing wave.
>
> — `handover-bloom-knee.md`, item 2

**So the first move is `superpowers:brainstorming` with the author, not a
plan and not a probe.** Anything else is inventing his artwork for him, and
this project has a standing directive against exactly that: propose, measure,
report, and *he* decides. A hypothesis that sounds mechanical is the most
believable kind and two of them died on checking in the last stretch alone.

## WHAT THE FIVE LINES ACTUALLY PIN DOWN

Worth separating, because it is less than it looks:

**Decided, do not relitigate:**
- The prism fan STAYS and has been tamed. The strimer is *added alongside* it,
  not a replacement.
- Both live on the **same left-click**. The prism fan is the structural
  "resonance" body; the strimer is the kinetic "signal" crack.
- Resonance-adjacent **straight** edges get a slow **bidirectional standing
  wave** — a different effect from the travelling crack, on a different set of
  edges.

**Named but undefined — these are the brainstorm questions:**
- What a "blinding head" is, numerically. How far above 1.0, how wide, how it
  falls off behind. The knee at 0.6 will compress whatever it is (see below).
- Speed, and whether it is constant or eased. Does it traverse an edge, a path
  through the graph, or the whole cascade front at once?
- What it does at a node — stop, branch, reflect, pass through?
- Colour. Does it take the edge's hue, the ortho hue rotation, or its own?
- Whether it exists in normal mode, immersive mode, or both, and at what
  relative strength. Every dial on this branch turned out to be mode-sensitive.
- What "slow" and "bidirectional" mean for the standing wave, and which edges
  count as "resonance-adjacent".

Do not answer any of these from this document. Get them from him.

## WHY IT IS POSSIBLE NOW AND WAS NOT BEFORE

This is the one piece of real engineering context the five lines carry, and it
is correct.

`SphereTrail` is **RGBA16F / HalfFloatType / NoColorSpace** (`SphereTrail.js:138`).
It used to be RGBA8. The additive layer blends INTO that target, so in RGBA8
every value saturated at 1.0 *before anything downstream sampled it* — a
">1.0 blinding head" had nowhere to exist. It does now.

Three things that came with the headroom and will shape the strimer:

- **`SphereKnee`** — max-channel Reinhard, mounted LAST in the composer, knee
  0.6. Identity below the knee, compression above. A head deliberately pushed
  above 1.0 is exactly what this curve exists to tame, so **design the head and
  the knee together or you will tune one against the other.**
- **`srgbToLinear` is clamped at 1** and carries the excess linearly. The
  unclamped version extrapolated 37x into 5170x. Do not un-clamp it.
- **`BLOOM` is `intensity` 1.1 / `levels` 4** (`artComposite.js:224,227`),
  chosen on frames 2026-09-20. `levels` is the lever, `intensity` is not, and
  clipping distinguishes neither. **`BLOOM` is mode-blind on purpose** — a
  mode-dependent `levels` was proposed and the data killed it.

**One stale claim to retire.** Phase 1's README says the immersive trail gain is
urgent because `RIFT_ALPHA` is "a 3.125x standing gain into an RGBA8
accumulator". The accumulator is not RGBA8 any more, so the *clipping* half of
that is solved. The gain itself is still real and still unexamined:
`RIFT_ALPHA_NORMAL 0.72` against `RIFT_ALPHA_IMMERSIVE 0.32`
(`artBackground.js:42-43`), and exhibit mode now carries ~2x the ink it did.
Treat it as an open exposure question, not as a clipping bug.

## WHERE IT ATTACHES

Read these before proposing anything; I have not designed against them, only
located them.

    src/terminal/art/artEdges.js      the pure edge math — `edgeStops`,
                                      `edgeLineWidth`, `pulseRingRadius`, the
                                      ORTHO_* hue/glow rotation. Heavily
                                      tested; this is where a wavefront's
                                      position-along-edge term would live.
    src/terminal/art/SphereEdges.js   the r3f edge draw
    src/terminal/art/artTrail.js      the fade arithmetic, extracted + tested
    src/terminal/art/SphereTrail.js   the RGBA16F accumulator
    src/terminal/art/artComposite.js  BLOOM + KNEE constants and their record
    src/terminal/art/SphereKnee.js    the shoulder
    src/terminal/art/artBackground.js RIFT_ALPHA_*

`artEdges.js` already carries dash patterns, per-end alpha weights and a
time-driven hue rotation, so an edge in this codebase is not a plain line — the
strimer has to compose with what is already animating there.

## STATE YOU ARE INHERITING

Branch `fix/art-sphere-index-space`, **NOT PUSHED, `main` UNTOUCHED.** `main` is
also behind `origin/main`; fetch before any merge. Do not push without an
explicit command — verification approval is not push consent.

    b69c650  fix(art): derive a capture's commit from git, not from an env var
    551e9fc  test(art): re-base the reference onto the bloom dial, five sets
    d69ce75  docs(art): the handover for the reference re-base
    b506462  feat(art): intensity 1.1 and levels 4, chosen on the frames

Clean tree, **1316 tests pass**, lint gate 0 errors / 145 warnings against a 153
ratchet. `src/` has not been touched since `b506462`.

**THE LIVE REFERENCE IS `baseline/art-sphere-phase2-bloom-dial-certified` at
`d69ce75`** — five sets, 21/21 at floor 0.95, worst 0.9767. **Read its README
before quoting any parity number.** It also records two predictions from the
previous handover that measurement killed, which is the tone to work in.

Phase 1 at `b8ad97f` stays on disk as the attribution for everything before
`b506462`. Superseded, not wrong. Its siblings and `p2ref-b..e` are untracked
but named in `repro.dirs`; sweeping one costs a reference its ink floor.

## THE GATES, AND ONE THING TO PLAN FOR UP FRONT

**A shipped strimer WILL re-base the reference again.** It is a composite and
edge change on states the capture covers. That is expected and fine — plan the
capture into the work rather than discovering it as a debt, and re-base ONCE,
after the dials are settled. Re-basing twice is how attribution is lost.

    artNull      the gate for reproducibility. 5 sets for a reference, 3 min.
    artCompare   a tripwire, NOT a verdict for composite work.
    artInk       carries a same-build floor; read `lit` and `meanLit` beside
                 every ratio, never the ratio alone.
    frame strip  THE real gate for anything visual.

**`artCompare` at threshold 4 can pass a change that is obvious by eye**, and it
just did: the whole bloom dial move came back 21/21 ADMISSIBLE. It is a mean
over a 32x18 signature. `artPresence` is structurally blind to composite
changes, and `canvasHash` and `shotHash` both lie about change.

**`artInk` ratios can read flat while the picture is transformed.** Exhibit mode
under the dial: total ink unmoved, lit pixels down, mean luminance nearly
doubled. A ratio of sums cannot see a redistribution — which is precisely the
shape a travelling bright head has.

## TRAPS

**Look at the render before theorising about a visual bug.** Standing rule, paid
for with five wrong causal claims in one night. Proxy metrics lie.

**Several rig scripts PATCH TRACKED SOURCE and restore in a `finally`** —
`_a3bloom`, `_b2peak`, `_b3strip`, `_nullPatch`. A hard kill beats the restore.
`git status` after running any of them, and never during a capture.

**`artBaseline` now records `gitDirty` and warns before Chrome launches**
(`b69c650`, `scripts/_git.mjs`). Believe the warning; a capture on a dirty tree
is labelled with a commit that does not contain it.

**The `immersive-off` cell's world hash is unstable across boots** — `be882152`
against `5d6f91d8` at identical rotation. It did not bite once in the five
phase-2 sets, which is not a fix. If it is your one failing cell, re-capture
before concluding anything.

**A harness-reset world is ~20x dimmer than a live boot** (19,328 lit px against
439,596). Relevant the moment you go looking at capture frames.

**Measure a cascade that is actually in frame.** The old bloom sweep shot 160
frames after the click with the fans decayed out, in immersive only, and its
conclusions were wrong for a whole session. `_a3bloom --live --normal` spends
the bright pass BEFORE the fire and shoots f14/f26/f44 in one boot. A strimer is
a *transient*, so this trap is aimed directly at it — a wavefront that has
already passed is not in the frame you are grading.

**Use `cdp.mjs`, never the browser pane**, and never `--disable-gpu`.

## WHAT NOT TO DO

- Do not design the strimer in this document or the next one. Brainstorm first.
- Do not build the dither (design 2.4/2.5). It is deliberately unbuilt: a
  one-level correction under ~3.5 levels of CSS film grain, provably invisible.
  The author ruled the grain STAYS. Do not re-litigate the black floor.
- Do not make `BLOOM` mode-dependent. Measured, killed.
- Do not choose any bloom-adjacent value on clipping. The knee caps output
  whatever the bloom adds.
- Do not push, and do not merge without asking.

## THE OTHER OPEN ITEMS, IN RANK ORDER AFTER THIS

The merge (fetch first — `main` is behind `origin/main`), the deliberately
unbuilt dither, item 3, and the `useAnalogicalReasoning` N=31-vs-272 bug.

One aesthetic thread is open on purpose and is NOT a defect: **`levels 3`** reads
as more definition rather than harshness — tighter halos, blacker gaps, sharper
strands, a direction for both modes at once. Frames:
`lookbook/opt-normal-f26.png`, `opt-imm-f26.png`, panel 3.

---

Work as a critical senior dev: no yes-machine, push back when the evidence says
so, and look at the render before theorising about a visual bug. Report to the
author and he decides.

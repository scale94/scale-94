# Handover — the bloom/clipping work is DONE and unmerged; the strimer is next

Continue the /art sphere work on `fix/art-sphere-index-space` in `F:\scale_9.4`.

NAMING: the nav label /CHAOS and the route ~/system/art are the SAME TAB.
`ArtTab.jsx` is the sphere. This handover supersedes
`handover-refactor-complete.md` for everything about the composite; that file is
still correct about the migration, the rig and the older items.

---

## WHAT THIS SESSION DID

Closed **item 2** (the blown-out multi-hit cascade) and **half of the black
floor**, with every step attributed rather than dialled. Four commits:

    f5bd2fc  feat(art): give the accumulator headroom
    b10073a  fix(art): clamp the gamma extrapolation
    e250e0f  feat(art): the soft-knee shoulder at the composer tail
    dc54693  docs(art): record 0.6 as the chosen knee

**NOT PUSHED. `main` UNTOUCHED.** Do not push without a new explicit command —
verification approval is not push consent.

## THE THREE CAUSES, BECAUSE "THE BLOOM WAS TOO STRONG" IS WRONG

The blowout had three independent causes and only the third is what anyone
would have guessed. Attributing them separately is what made each fixable.

**1. The RGBA8 blend-unit clamp.** The additive layer blends INTO the trail
accumulator, so every overlapping ribbon saturated at 255 *before the bloom pass
ever sampled it*. No downstream shader can recover that — the information is
destroyed in the blend unit. `SphereTrail` is now `HalfFloatType`; `colorSpace`
stays `NoColorSpace`, and that distinction is the whole safety argument. The
step-3 trap the file warns about is the COLOUR SPACE TAG, not the storage type.

**2. The unclamped gamma extrapolation — THE BIG ONE, and it was invisible
before (1).** `COMPOSITE_FRAG` ended with `srgbToLinear(srgb)`, which is defined
on [0,1]. Above 1 its high branch `pow((c + 0.055)/1.055, 2.4)` is an
extrapolation nobody chose: **37x becomes 5170x**. While the accumulator clamped
at 1.0 the branch was unreachable; (1) made it reachable and the bloom started
receiving thousands of times white. Now clamped at 1 with the excess carried
linearly, so overbright enters the post stack proportionally.

**3. No shoulder.** Added, at the composer tail. See below.

## THE NUMBERS TO START FROM

MEASURED on a pinned 4-node prism cascade, bloom off, film grain suppressed, at
the first exposure stop that does not clip (`scripts/_b2peak.mjs`):

    normal mode      36.7% of all ink exceeds 1.0     peak 37.15x
                     >2x 2460   >4x 731   >8x 215   >16x 40   >32x 5
    immersive        still clipping at a 64x stop     peak >64x

**76% of the overbright lies between 1x and 2x.** That is what sets the knee's
working range, and why compressing harder buys almost nothing.

**63.3% of the ink never exceeds 1.0.** That is the parity argument for identity
below the knee, and it is not negotiable: a curve touching those values moves
two thirds of the art and costs the ability to attribute anything later.

## THE KNEE

`SphereKnee.js`, mounted LAST in the `EffectComposer` — after `<Bloom>` so the
bright-extract sees true overbright, after `<Vignette>` so corners are darkened
before compression rather than after.

    t = x - knee,  s = 1 - knee
    f(x) = knee + s * t / (t + s)     for x > knee,  else identity

Applied as a scale of the **max channel**, not luminance: a luminance scale
preserves hue but does not bound the channels, so a saturated (6,0,0) still
clips. `f'(knee) = 1` exactly, so there is no crease. An exponential shoulder is
also C1 but saturates within ~3s and puts 2x and 37x on one output level — the
same defect in a nicer shader.

**knee = 0.6, chosen off `lookbook/knee-strip/` by the author.** Clipped px on
one pinned cascade:

                     no knee    0.9     0.6    0.45    0.3
    normal              9310   1073       5       0      0
    immersive          96421  37486     748     221     49

Immersive is the harsher case by ~10x and the transformation there is far more
dramatic than in normal mode — without the knee the exhibit fans are almost
entirely white with only fringe chroma; at 0.6 every filament reads as a
separate strand. The 748 that remain are the resonance bar and node cores, which
are meant to be at the ceiling.

`KNEE.knee` is a uniform and `KNEE_NULL` (1e6) is the provable identity.

## THE REFERENCE, AND WHERE PARITY STANDS

**`baseline/art-sphere-phase1-bloom-ink-certified` at `b8ad97f` is STILL the
live reference. It has NOT been re-based, deliberately** — re-basing twice is
how attribution is lost, and the bloom dial is still open.

The final state is captured and certified as a candidate:
`baseline/_knee-final-a` (+ `-b`, `-c` for its null), stamped `dc54693`.

    artNull      21/21 reproducible at floor 0.95, worst 0.9818
    artCompare   21/21 ADMISSIBLE — inside threshold 4 AND known to repeat
                 mean 0.014-0.486, max <= 24.7, all three scales

**The final state is CLOSER to the reference than the intermediate half-float
state was** (means up to 0.486 against 3.013 at `f5bd2fc`): the clamp and the
knee moved the frame back toward the reference while fixing the defect.

`artInk` moves coherently and in opposite directions, which is the signature to
expect: **normal +7 to +11%** (energy that used to be clipped away now
survives), **exhibit -4 to -8%** (the far larger overbright there is being
compressed). 40 SIGNAL / 2 noise of 42 graded rows.

**A re-base is owed once the bloom dial is settled** — one capture, five sets,
not two captures.

## THE NULL-KNEE TEST (design section 3.3) — PASSED

At `KNEE_NULL` the `step()` is 0 and the scale is exactly 1.0, so the pass is
provably a no-op. Against the pre-knee build, projector, all seven cells: mean
0.041-0.060, max <= 3.4, world hashes identical — at the same-build noise floor.
Re-run this whenever the shader changes; it separates "did I break the pipeline"
from "do I like the curve".

## WHAT IS OPEN, ranked

**1. THE BLOOM DIALS — swept, and the finding is that there is nothing to fix.**

MEASURED on `_a3bloom --fired` (pinned world, ry 3.60625, same fired nodes at
every value), sweeping `intensity` across more than 6x:

    intensity    0.25    0.6    0.8    1.1    1.5
    clipped        5      5      5      5      6
    white          0      0      0      0      0
    ink          3.72M  4.57M  5.04M  5.35M  6.37M

**`intensity` no longer controls clipping at all.** The knee caps the output
whatever the bloom adds, so the dial now buys glow volume and nothing else. That
is the independence the after-bloom placement was chosen for, now confirmed.

The consequence is the actionable part: `artComposite.js` records that intensity
was cut **1.1 -> 0.6 specifically because of the blowout** in immersive ("too
much bloom in immersive", the author's words). That blowout is gone, so the
reason for the cut is gone. 1.1 was re-checked at the sweep and is viable again
— the resonance bar reads as a luminous tube with its colour intact, structural
lines stay clean, the void stays black.

**LEFT AT 0.6. The value is an aesthetic call and the author has not made it.**
Frames for both are in `lookbook/bloom-fired-lv5-i0p6.png` and `-i1p1.png`, plus
crops `lookbook/dial-0p6-crop.png` / `dial-1p1-crop.png`. Whatever is chosen,
choose it on the frames — clipping cannot distinguish them.

`luminanceThreshold` (0.28) has STILL never been swept. It is not urgent: its
job is a binary gate above the dim structural lines and it still does that. What
changed is the range above the gate, which is intensity's axis, not its own.

**2. THE STRIMER WAVEFRONT.** The author's design, and the HDR headroom its
">1.0 blinding head" needs now exists — it was literally impossible before, the
accumulator had no values above 1.0. Decision already taken: **keep the prism
and tame it** (done), and add the strimer as the kinetic "signal" crack on the
same left-click, with the prism fan as the structural "resonance" body.
Resonance-adjacent straight edges get a slow bidirectional standing wave.

**3. THE MERGE.** Unchanged. `main` is behind `origin/main`; fetch first.

**4. The dither (design 2.4/2.5), designed and deliberately unbuilt.** IGN,
TPDF, one LSB, gated by `smoothstep(0.0, 1.5/255.0, luma)` so true black stays
exactly 0. It is a one-level correction and the film grain is ~3.5 levels of
white noise on top, so it is provably invisible until that changes. Do not build
it without re-measuring that relationship first.

**5. Item 3, and the `useAnalogicalReasoning` N=31-vs-272 bug.** Unchanged from
the previous handover.

## THE BLACK FLOOR — SPLIT IN TWO, AND THE ANSWER SURPRISED EVERYONE

The brief said "a persistent milky halo/dome over the void". There is no dome.

**The veil is CSS, not the shader.** `src/index.css:416`, `.crt-overlay::before`
— an SVG feTurbulence **white** film grain at `opacity: 0.025`, `position:
fixed`, `z-index: 9999`, painted over the entire viewport ABOVE the GL canvas.
Same page, one rule toggled:

    as shipping        mean floor 3.522    px at #000000: 0     (of 2.07M)
    grain off          mean floor 0.748    px at #000000: 1,760,306

It is 100% of why the void is never #000000. The tell was that the screenshot
CORNERS — outside the canvas, where no shader runs — jittered 1..4.

**AUTHOR'S RULING: the grain stays, site-wide, untouched.** It is the carrier
wave and the "damp" of the piece (Axioms 01/02); scale94 is an explorable OS,
not a kiosk locked to /CHAOS, and sanding it flat for a sterile #000000 would
break coherence with the terminal tabs. **Do not re-litigate this.** The
#000000 goal is dropped, deliberately.

**The other half WAS a real bug, and is fixed.** The fade writes
`prev * survival` with NoBlending, so an RGBA8 target requantises every frame
with round-to-nearest, making a stored v a FIXED POINT whenever `v <= 0.5/m`:

    normal     m = 0.72   0.5/m = 0.694   nothing sticks
    immersive  m = 0.32   0.5/m = 1.563   v = 1 STICKS FOR EVER

MEASURED with the grain disabled: 330,511 px at exactly 1/255 in immersive
against 32,301 in normal, and after a further 1200 frames — ~28 half-lives — the
population had RISEN to 339,985. A third of the exhibit frame pinned one level
off black, permanently. Half-float has no requantisation, so `f5bd2fc` removed
it for free.

## TRAPS THIS SESSION PAID FOR

**`artCompare` at threshold 4 can pass a change that is obvious by eye.** It is
a mean over a 32x18 signature; the 5000x halo covered <1% of frame area, moved
two or three of 576 cells, and averaged away. It said `ok` on a frame anyone
would flag instantly. Combined with `artPresence` being structurally blind to
composite changes, **the real gate for composite work is a frame strip**, with
`artCompare` and `artInk` as tripwires, not as the verdict.

**The `immersive-off` cell's WORLD HASH is not stable across boots.** A
null-knee capture read immersive-off at 20x the noise floor and did not
reproduce: world hash `be882152` against `5d6f91d8` in two other runs, at
IDENTICAL rotation (ry agreeing to fifteen digits) and identical sphereR. A
fragment shader cannot move a world hash. **This is item 1's race, which the
previous handover records as one observation never reproduced in 28 runs — it
reproduces, and it lands on this cell.** One stash and one run before believing
any immersive-off regression.

**Screen recordings cannot measure a black floor.** h.264 4:2:0 has its own
floor of 2-3 across the whole frame including the corners, and its chroma is
subsampled into nothing at that luma — so "the dome reads neutral, therefore it
is not the amber beat pulse" is exactly the proxy-metric inference this repo
keeps getting burned by. Measure in the app.

**A measurement whose own premise is untested will lie.** `_b2peak` needed FOUR
corrections before its numbers meant anything: the film grain contaminated the
exposure stop; the bright pass ran AFTER the fire so the shutter opened on a
decayed cascade; the clip test required all three channels (the test for
"crushed to white", not for headroom) so a saturated red filament scored zero
while `max` sat on 255; and the percentile population was thresholded on raw
level, so it selected different pixels at every exposure. The script carries all
four in its header.

**A harness-reset world is ~20x dimmer than a live boot.** 19,328 lit px against
439,596 in the author's own recording. `_a3bloom`'s header says this and it is
still easy to walk into. Use its bright-pass hooks, BEFORE the fire.

## THE RIG — additions

    scripts/_b1dome.mjs    the dome discriminator (head / nobloom / nobeat)
    scripts/_b2peak.mjs    the exposure-stop peak probe + overbright census
    scripts/_b3strip.mjs   the knee strip; patches KNEE.knee, one key per frame

All three PATCH TRACKED SOURCE and restore in a `finally`. **`git status` after
using any of them.** `_b3strip`'s console labels still say "peak probe" and
"exposure stop" — vestigial from the script it was derived from, harmless, the
`clipped` column is the live one.

Everything else — `cdp.mjs`, never the browser pane, wait on `manifest.json`,
fresh output dir, commit before capturing because `artBaseline` stamps
`BASELINE_COMMIT` with no dirty-tree check — is unchanged.

---

Work as a critical senior dev: no yes-machine, push back when the evidence says
so, and look at the render before theorising about a visual bug. Report to the
author and he decides.

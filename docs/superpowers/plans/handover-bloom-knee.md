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

## WHAT THE FOLLOW-UP SESSION DID, 2026-09-19

Re-measured **item 1**, the open bloom dial, and found that the frames this file
offered for that decision did not contain a cascade — or normal mode. Two rig
commits, no change to `artComposite.js` and no value chosen:

    ea00596  test(art): a normal-mode path and a live cascade for the sweep
    4be24be  test(art): the third bloom dial, and a way to hold the other two

**ALSO NOT PUSHED.** Item 1 below is rewritten on the new measurements and the
old table is gone; the traps it cost are in their own subsection.

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

**1. THE BLOOM DIALS — RE-MEASURED 2026-09-19. The old finding was taken off
frames with no cascade in them. `levels` is the lever; `intensity` alone is
not, and the gate is not.**

The first thing re-measuring produced was the reason the old numbers said what
they said. See THE DECAYED CASCADE in the traps below: every frame this sweep
had ever produced was immersive AND shot 160 frames after the click, by which
time the prism fans are gone. The old table was comparing a resonance bar, node
cores and a cage — not the blowout the dial exists to control.

`scripts/_a3bloom.mjs` now takes `--normal`, `--live`, `--threshold` and
`--hold=k=v`; see THE RIG below. With the cascade actually in frame the picture
changes.

**CLIPPING STILL DOES NOT DISTINGUISH THE DIALS, and that part held.**
Immersive, live cascade, frame 14: 772 clipped px at 0.6 against 979 at 1.1, of
2.07M, zero pure white at either. Normal mode: 7 and 19. The knee caps the
output whatever the bloom adds, exactly as the after-bloom placement was chosen
for. **Do not choose on clipping**, in either mode.

**WHAT THE DIAL MOVES IS THE FIELD BETWEEN THE STRANDS.** Measured PAIRED — the
pixel set fixed once from the reference frame and those same pixels read in
every other frame. Thresholding each frame on its own level instead lets the
population move underneath the mean, and it did: see the traps.

    intensity 0.6 -> 1.1     interstitial mean      vs 0.6
    immersive                55.5 -> 72.9           +31.4%
    normal                   37.8 -> 49.7           +31.5%

The same proportional lift in both modes. What differs is where it STARTS —
immersive at 55.5, normal at 37.8 — so the same 31% lands immersive at 72.9,
and that is why the exhibit fans read milky at 1.1 while normal mode merely
reads brighter.

**`luminanceThreshold` IS NOT THE LEVER. SWEPT, AND THE ANSWER IS NO.** The
hypothesis was that the fill is dim ink passing the 0.28 gate and being
amplified, so a higher gate would let intensity rise without lifting the field.
Immersive, live, intensity HELD at 1.1:

    gate            0.28     0.4     0.55    0.7
    interstitial   +31.5%  +28.8%  +26.1%  +22.2%
    hot px          83379   82119   79567   77100
    ink            59.88M  59.54M  58.00M  56.82M

Two and a half times the gate recovers less than a third of the wash, and it
does not recover it SELECTIVELY — hot px and ink fall with it, so it is dimming
the bloom generally. The hypothesis was wrong: the strands filling those gaps
are far above any gate in this range, and what spreads their energy sideways is
the mipmap pyramid, which a gate cannot touch. The old note here said the gate
was "not urgent" because "the range above the gate is intensity's axis, not its
own". The first half is right for the wrong reason and the second half is the
error — the axis that matters is neither.

**`levels` IS THE LEVER, and it is selective.** Same world, same offset,
intensity HELD at 1.1:

    levels           5 (i0.6)      5       4       3       2
    hot px              72071   83378   85720   84694   82243
    lit px             573989  621973  453146  344704  272671
    ink                50.56M  59.95M  50.27M  41.44M  34.49M
    interior  mid            —  +31.2%   -9.4%  -41.4%  -65.8%
    interior  close          —  +31.3%   +9.7%  -26.7%  -60.4%

ONE LEVEL removes the whole wash — +31% becomes -9% in the open interior — and
hot px goes UP while it does. That is the selectivity the gate could not
produce.

**The two rects disagree, and the disagreement IS the mechanism.** At levels 4
the open interior lands BELOW the shipping frame and the space between adjacent
strands lands slightly above it. The deep mips are what reach across the open
interior; removing one kills the mid-range spread and barely touches the
close-in skirt. A far-void rect beside the sphere returned ZERO px in the haze
band at every setting — the far field is already at grain level and none of
these three dials touch it.

**THE SHORTLIST, and it is a shortlist, not a choice.** `levels 4 + intensity
1.1` carries the SAME TOTAL INK as shipping (50.27M against 50.56M),
redistributed into 19% more hot core with a slightly cleaner open interior.
`levels 3 + intensity 1.1` is clearly darker than shipping at both radii with
the cores still up, but the glow footprint shrinks 40% (574k -> 345k lit px),
which is a change to the piece rather than a dial. `levels 2` reads hard-edged
— the blue node loses its bloom entirely — and is not worth pursuing.

**STILL AT intensity 0.6, levels 5. `artComposite.js` WAS NOT TOUCHED.** On the
evidence, stay at 0.6 if nothing else moves, because at 1.1 the interior wash
cannot be tuned away with the gate. If the glow at 1.1 is wanted, `levels 4` is
how to have it.

**WHAT THIS DOES NOT ESTABLISH.** One pinned world, one frame offset (14), two
rects chosen by hand, and immersive only for the gate and levels sweeps. Enough
to say `levels` is the lever and to shortlist 4 and 3; NOT enough to certify a
value. Choosing wants f26/f44 and a normal-mode pass.

Frames, all in `lookbook/`, 0.6 left / 1.1 right unless stated:

    normal-live-dial-fan.png  -fan2.png  -ridge.png   normal mode, 2 panels
    imm-dial-fanL.png  -fanR.png  -ridge.png          immersive, 2 panels
    thresh-fanL.png  thresh-ridge.png                 the gate, 5 panels
    levels-fanL.png  levels-ridge.png                 levels, 5 panels

The OLD decision frames `lookbook/bloom-fired-lv5-i0p6.png` / `-i1p1.png` and
the crops `dial-0p6-crop.png` / `dial-1p1-crop.png` are kept, but they are
immersive frames of a decayed cascade. **Do not decide anything on them.**

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

## TRAPS PAID FOR, BY SESSION

### Paid for on 2026-09-19, re-measuring item 1

**THE DECAYED CASCADE — the sweep was not looking at the cascade.** `_a3bloom
--fired` spent 70 pumps and then a 90-frame bright pass before the shutter: 160
frames after the click, and a prism effect lives `maxLife`. `_b2peak`'s header
ALREADY RECORDS this as one of its four corrections, and excuses `_a3bloom` on
the grounds that it is comparative — every frame decays equally, so the
comparison survives. **That excuse holds for a NUMBER and fails for a PICTURE**,
and item 1's whole instruction was "choose it on the frames". MEASURED, normal
mode, moving the bright pass BEFORE the fire: lit px 165,205 -> 307,398 and ink
5.83M -> 14.46M. More than half the frame was missing. An excuse that is valid
for one use of an instrument is not valid for another, and the excuse was
written down where it looked like a clearance.

**AND EVERY FRAME IT HAD EVER PRODUCED WAS IMMERSIVE.** `clickImmersive` was
unconditional. Nothing in the run output said so and the filenames did not carry
it, so the two frames the previous version of this file offered as the
normal-mode decision set are both exhibit frames. **A flag with no name in the
output is a flag nobody can check.**

**THE IMMERSIVE WORLD DOES NOT PIN EVERY RUN.** The first `--live` immersive
sweep returned `world pinned: NO` — 105/104 edges against 104/103, ry 3.5285
against 3.537, and a COMPLETELY different resonance pair and fired set. Not
comparable; those frames were discarded unlooked-at. The second run of the
identical command pinned, and pinned onto the SAME world as the two sweeps after
it, which is what let five configurations be compared across four separate runs.
This is item 1's race again. The script's own pinning check caught it — believe
it, and never crop a pair it has refused.

**A PROXY BUILT ON A LEVEL THRESHOLD SELECTS DIFFERENT PIXELS AT EVERY
SETTING.** The first interstitial measurement gated each frame on its own max
channel in [8,120] and reported a population that FELL from 108,712 to 92,751 px
at an IDENTICAL mean of 55.5 — because raising the dial pushed pixels out
through the ceiling. Fix the population ONCE from the reference frame and read
those same pixels everywhere; paired, the same comparison reads +31.4%. This is
`_b2peak`'s fourth correction reappearing in a different script, which is the
tell that it is a FAMILY and not an incident.

**THE NULL IS CHEAP HERE AND IT IS WORTH TAKING.** Two independent boots at an
identical configuration read 72.9 and 73.0, and a third later read 72.8, on the
paired measure — a noise floor of ~0.1 against effects up to 31%. Both came
free: one from a `--hold` run whose filename collided with an earlier frame, one
from re-shooting `levels 5` inside the levels sweep. Take the free null every
time; it is what makes a 9% row quotable.

### Paid for earlier

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

`_a3bloom.mjs` gained four flags on 2026-09-19 (`ea00596`, `4be24be`):

    --normal        skip the immersive toggle. The pumped budget is held at
                    750 either way, so the mode is the only thing that moves
    --live          bright pass BEFORE the fire, then shots at frames
                    14/26/44 inside ONE boot, so the cascade is in the frame
    --threshold     sweep luminanceThreshold, the third dial
    --hold=k=v      pin a dial that is NOT being swept, e.g.
                    --hold=intensity=1.1, so the gate can be asked its
                    question at an intensity worth gating

The default path is untouched and byte-identical in behaviour, so the frames
already in `lookbook/` stay reproducible. The name now carries all three dials;
`-t` appears only when the gate is in play. **A REMAINING HOLE:** a HELD value
looks identical to a source value in the name, so `--hold=intensity=1.1` with a
levels sweep writes `bloom-live-fired-lv5-i1p1-*` and overwrites an earlier
frame at the same true configuration. Harmless when the configuration really is
identical — it was used as a null — but copy anything worth keeping before a
held run.

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

# CHAOS prism — the chromatic front A/B, measured and ruled

**Date:** 2026-09-22
**Branch:** `feature/chaos-prism-depth-dash-beads`
**Spec:** `docs/superpowers/specs/2026-09-22-prism-chroma-ab-design.md`
**Plan:** `docs/superpowers/plans/2026-09-22-prism-chroma-ab.md`
**Status:** **RULED. Arm A ships, defaulted locally at `9fcc61e6`. NOT merged, NOT pushed.**

---

## 1. The ruling

The author looked at all three arms live, flipping `__artSetChromaMode` on the
running site. **Mode 2 — the achromatic lead — wins.** His words are the
record:

| arm | verdict |
|---|---|
| **1 — unison** | **REJECTED. "The coagulation problem."** "The bundle loses its internal filament tension and coagulates into a single, somewhat muddy, opaque ribbon sheet... it looks like a flat polygonal sail. In a sparse terminal system built on crisp lines and skeletal data nodes, Mode 1 adds visual weight without adding structural clarity." |
| **0 — shipped** | "Competent and safe." But its flaw is **directional ambiguity, not invisibility**: "every strand in the bundle shares roughly equal perceptual priority... there is no clear visual anchor telling the visual cortex where the kinetic energy actually originates." |
| **2 — achromatic** | **SHIPS. "The Kinetic Razor."** "Bleaching the saturation on the lead strand turns the front edge of the wave into a white-hot, ionized rail... you instantly perceive that this edge is moving fast enough to burn off its chromatic weight, dragging the rich, saturated spectral wake behind it." |

---

## 2. TWO OF THE DESIGN'S CENTRAL CALLS WERE REVERSED BY HIS EYE

### 2a. THE COMB'S DIVERSITY IS THE STRUCTURE, NOT THE PROBLEM

The spec's entire diagnosis was that seven lines spanning 288deg of the hue
wheel leave the crest with no reference hue to differ from, and that the fix
was to remove that diversity — gather the comb onto one hue. **Arm U was the
design's centrepiece and it is the WORST of the three.** He calls the comb's
spread "internal filament tension" and collapsing it destroys the layer:
seven lines at one hue stop being seven lines and become a sheet.

**The lesson generalises past this layer.** The diagnosis correctly identified
that hue contrast was unavailable, and correctly identified the two dimensions
that were free — unison and achromatic. It then ranked them by an information
argument (which state is furthest from the resting field) when the binding
constraint was a STRUCTURAL one (which state preserves the layer's read as
discrete strings). Nothing measured could have caught that. Only the eye could.

### 2b. THE +13.6% LUMINANCE IS THE MECHANISM, NOT A COST

Task 6 measured arm A costing **1.854x** on the glow pass against the shipped
rotation's **1.632x**, worst case at hue 240 where Rec.709 weights blue at
0.0722. It was reported as a penalty, with `PRISM_A_WAKE_SAT` named as the
dial to pull it back down.

**That framing was wrong and the author reversed it.** "Against your deep void
background, it provides the exact high-contrast punch needed to separate the
active cascade from the idling background constellation... it gives the bundle
a rigid skeletal backbone that makes the whole structure look razor-sharp
rather than hazy."

**DO NOT TUNE ARM A'S LUMINANCE DOWN.** It is load-bearing.

---

## 3. Dials, by provenance

| dial | value | provenance |
|---|---|---|
| default arm | `PRISM_CHROMA_MODE_ACHROMATIC` (2) | **RULED 2026-09-22, live, by eye** |
| `PRISM_A_WAKE_SAT` | 35 | **SEEN AND APPROVED IN SITU, BUT NEVER SWEPT.** Ruled, not optimised — he approved the arm and the dial came along with it. The first thing to try if A is ever revisited. |
| `PRISM_HUE_LEAD` / `PRISM_HUE_SKEW` | 24 / 10 | unchanged; arm 0 only, still reachable |
| `PRISM_UNISON_K` | `(n-1)/2` | arm 1 only, **ruled out aesthetically but deliberately left reachable** |

---

## 4. THE PARITY REFERENCE IS NOW STALE BY DESIGN

The whole point of defaulting to mode 0 was that the reference cut at
`33bda07e` stayed valid. **Shipping arm A deliberately breaks that.** The
reference no longer describes what the app draws and is **owed a re-cut**. It
was already owed one for three other layers (strimer depth cue, prism clock,
prism wavefront); this is the fourth. `fired-cascade` is where all four land.

**Set `BASELINE_COMMIT` when re-cutting.** Unset records `gitCommit: null` and
the reference is unattributable.

---

## 5. What the measurement was worth, honestly

**The buffer-level gate was worth everything.** It proved all three arms alive
and distinct, reproduced twice, straight from `__artEdgeState()`:

| arm | hue excursion | min saturation |
|---|---|---|
| 0 | 23.9deg (= `PRISM_HUE_LEAD`) | 0.212 |
| 1 | -144.0deg (= 3 x `PRISM_HUE_STEP`) | 0.069 |
| 2 | 0.0deg — moves no hue, by design | 0.056 |

Those land on the source constants exactly. Without that gate the A/B could
have been three views of one arm and nobody would have known.

**THE PIXEL-LEVEL R METRIC WAS WORTH NOTHING, AND FAILED FIVE TIMES IN ONE
CLASS: the measurement was not of the thing being compared.**

1. R measured WHOLE-FRAME while the spec itself required the BUNDLE.
2. The gate compared a bundle number against a whole-frame band.
3. Its replacement gated on absolute repeatability (+/-0.10) with no reference
   to the ~0.5 effect size it existed to protect.
4. The films shot a DIFFERENT SPAWN per arm — different nodes, geometry and
   `hue0` — so `_a23combR.mjs`'s three-arm table is confounded. **Its finding
   that arm U's R measured LOWER than shipped must not be quoted.**
5. The controlled re-film verified matching effect ids and sub-pixel bbox
   agreement — **and renders an EMPTY SPHERE.** The determinism shim suppresses
   the draw, and the verification checked buffer state without ever checking
   that a pixel was drawn. Its ages are also offset one frame per arm.

**DO NOT RULE ON ANY FILM IN `lookbook/chromaAB/`.** Neither set is valid.
The ruling above came from the author flipping the live switch, which is what
the switch was built for and what should have been offered first.

**The generalisable rule: for a perceptual A/B, build the SWITCH and hand it
to the eye. Do not build the METRIC.** Five attempts at an instrument cost
more than the feature did and produced one confounded number; the switch
produced a decisive ruling in one sitting.

---

## 6. Process findings — five plan defects, all caught by implementers who ran the check

Every one was found because a subagent ran a step, saw it fail, and reported
it rather than ticking it off.

1. **A falsification that did not falsify.** Task 2's mutation had the sign
   backwards: `(1 - 0.12|d|)` gives the outer strands a SMALLER fraction and
   keeps them behind, min gap **+6.18deg, test passes**. The fold needs
   `(1 + 0.12|d|)`, min gap **-28.03deg**. A falsification that does not
   falsify certifies the test it failed to break.
2. **A real import cycle.** `artEdges.js` importing `writeHsl` from
   `SphereEdges.js` closes a loop — `SphereEdges.js` imports four `PRISM_`
   constants back and consumes them at module TOP LEVEL to size its buffer, so
   the back-import puts them in the temporal dead zone. A crash, not a smell.
   Fixed by a leaf `src/terminal/art/artColor.js` that imports nothing.
3. **A validator contradicting its own test.** `Number(null) === 0`, a valid
   mode, so the brief's verbatim test failed against the brief's verbatim
   implementation.
4. **A vacuous hook test**, caught in the pre-flight scan: it built a local
   copy of the validator and asserted against the copy, so deleting the hook
   would have left it green — while its own comment cited the vacuous-hook
   lesson. Fixed by extracting `prismChromaModeOf` where it is real.
5. **An uncontrolled A/B**, caught by looking at the frames.

**Arm 0's bit-identity was ESTABLISHED, not assumed:** the reviewer
re-implemented the deleted anchor loop and diffed **1 344 000 cells** against
`prismWriteAnchors` mode 0 — **0 mismatches**.

---

## 7. Still open

1. **The parity re-cut.** Section 4. Now four layers deep.
2. **NARROW THE PACKET — the author's own second point, still the strongest
   uncontested win, and untouched.** Support is `2 * PRISM_WAVE_W` = 36% of
   the chord, and the per-strand shear adds 0.30, so the BUNDLE-LEVEL packet
   is **0.66 of the chord**. That, not `PRISM_WAVE_W`, is why the whole chord
   appears to change at once. `W` and `PRISM_PHASE_STEP` must move together;
   `W = 0.09` drops Nyquist sampling from 5.04 to ~2.5 across the support and
   would silently FADE THE WAVE OUT under the `PRISM_WAVE_SEG_FULL` guard;
   raising `PRISM_WAVE_SEGMENTS` spends instances `_a19budget.mjs` must
   re-price. **His ruling sharpens the target: he named mode 0's flaw as
   DIRECTIONAL AMBIGUITY, and a narrower packet is directional.**
3. **`PRISM_A_WAKE_SAT` has never been swept.** Section 3.
4. **`_a23combR.mjs` samples a fresh spawn per arm.** Confound 4. Either fix
   it or delete it; leaving a confounded instrument in `scripts/` invites
   someone to quote it.
5. **Mode 1 is ruled out but still reachable.** A future pass may delete it.
6. Mobile fps re-measurement, carried from two prior handovers.
7. **The disc<->streak ink discontinuity (~38x)** — still unruled, still needs
   an author ruling before any code.

# CHAOS prism — the chromatic front's second attempt, as an A/B

**Date:** 2026-09-22
**Branch:** `feature/chaos-prism-depth-dash-beads`, on top of `4bd9a887`
**Status:** approved, ready for a plan

The author's ruling against `b4ce9e4e`: the 24.4deg hue excursion is
perceptually invisible, and the request was to open the throttle to 120deg+ of
hue contrast, narrow the packet, and let the leading edge punch up in
saturation and luminance.

**THE SYMPTOM IS REAL. THE MECHANISM THE RULING NAMES IS NOT, AND THAT CHANGES
THE FIX.** The ruling attributes the invisibility to the bloom pass and
additive blending washing hue out to white. Measured against real frames, the
image is not washing out and no pass is destroying chroma. The layer at fault
is the seven-line comb itself.

---

## 0. What was measured, before anything was designed

Frames filmed with `scripts/_a21wavefilm.mjs` at 1520x900 dpr 1 against the dev
build at `4bd9a887`. Sixteen frames spanning one pass, ages 70ms to 921ms.
Pixels with max channel >= 0.35 only, so the background and the film grain are
excluded.

| question | answer | how |
|---|---|---|
| delivered saturation, median | **0.33** | HSV sat over bundle pixels, 16 frames |
| delivered saturation, p90 / max | **0.60-0.75 / 0.99** | same |
| 30deg hue bins occupied, per frame | **11-12 of 12** | >2% of hued pixels per bin |
| circular concentration R | **0.03-0.32** | 1 = one hue, 0 = all hues |
| hue spread p05 -> p95 | **~280-320deg** | per frame |
| core pass share of crest ink | **43.2%** | `alpha x width`, glow vs core |
| single-strand chroma at L=65 | **0.700** | S=100, CSS Color 4 conversion |
| single-strand chroma at L=88 (core) | **0.240** | same |

### Three explanations killed by those numbers

- **"The bloom pass washes the hue out."** `SphereKnee.js` is a MAX-CHANNEL
  Reinhard: it divides all three channels by one factor, so it preserves hue
  and saturation ratios exactly, and its own comment says so. Bloom's blur is
  linear, so a coherent rotation of the inputs rotates the output unchanged.
  Neither pass can be the cause.
- **"Additive blending sums the bundle to white."** The first model written
  this session assumed the bloom blur integrates the 2.8px fan into one kernel
  and predicted a delivered saturation of 0.14. **THE PIXELS FALSIFIED IT AT
  0.33 MEDIAN AND 0.75 AT p90.** The strands stay spatially resolved on
  screen; the filmed frame shows seven individually saturated wires. The model
  was recorded and discarded rather than quietly corrected, because its
  prediction was the one that would have justified the ruling.
- **"The excursion is too small."** A larger excursion does not help, for the
  reason in section 1. This is the ruling's own hypothesis, and the data
  refuses it.

---

## 1. Root cause: the crest has no reference hue

`PRISM_HUE_STEP` is 48deg across `PRISM_SPECTRAL_FINE` = 7 lines, so the bundle
puts **288deg of the hue wheel on screen simultaneously, 2.8px apart**. The
measurement above says the same thing from the other end: 11-12 of 12 hue bins
occupied every frame, circular concentration as low as 0.03.

**A HUE EXCURSION IS ONLY READABLE AGAINST A FIELD THAT IS NOT ALREADY WEARING
EVERY HUE.** When strand `k`'s crest rotates by any delta, it moves to a colour
some other strand in the same bundle is already wearing, adjacent to it, at
that instant. The eye has no reference against which to measure the excursion.

This is why the magnitude is not the lever. It is also the third time on this
branch that a reported symptom named the wrong layer.

### The neutral-axis hole, which the ruling would have to cross

Sweeping `PRISM_HUE_LEAD` against the existing per-strand shear, the summed
bundle passes THROUGH the neutral axis:

| LEAD | 12 | 24 | 36 | 48 | 60 | 72 | 96 | 120 | 180 |
|---|---|---|---|---|---|---|---|---|---|
| min delivered sat | 0.101 | 0.065 | **0.043** | **0.016** | **0.028** | 0.060 | 0.104 | 0.152 | 0.228 |

The minimum sits at **LEAD = 48deg, which is exactly one `PRISM_HUE_STEP`** —
the rotated comb aliases onto itself and cancels. In the 36-72deg band the
sum's hue angle is mathematically meaningless and flips chaotically between
samples. **THE RULING'S TARGET CANNOT BE REACHED BY DIALLING THE EXISTING
CONSTANT UP**, because the path from 24 to 120 runs through that hole.

Also recorded: at the shipped LEAD = 24 the crest's delivered saturation is
**0.076 against a resting 0.138**. The current design does not merely fail to
be visible — it makes the crest the LEAST chromatic point on the chord.

---

## 2. What is actually available: the two unoccupied dimensions

Against a field that is maximally varied in hue and already ~0.33 saturated,
two states are not present in the resting image and therefore carry contrast:

- **Unison** — all seven strands agreeing on one hue. The rainbow gathers into
  one colour and disperses again.
- **Achromatic** — no hue at all. White is the one colour the rainbow does not
  contain.

Both are reached by changing what the tint ANCHOR is, not by changing the
machinery that applies it. Both were ruled by the author on 2026-09-22.

### Rejected, and why

- **Raising `PRISM_SAT`.** Already 100. There is nothing above it.
- **Lifting crest lightness ("white-hot").** Chroma at S=100 is 1.000 at L=50,
  0.700 at L=65 and **0.240 at L=88**. A luminance spike and a chromatic
  packet are the same pixel fighting each other, and the core pass already
  sits at L=88 carrying 43.2% of the crest ink. The author ruled arm A onto
  the SATURATION axis at constant lightness, which also keeps the design
  inside the ink-negative argument and leaves the bloom dial untouched by
  construction. **A LIGHTNESS LIFT REMAINS A SEPARATE, UNMEASURED DECISION.
  DO NOT SMUGGLE ONE IN.**

---

## 3. THE COMB FOLDS — the defect found in arm U before any code was written

Arm U collapses every strand toward the middle strand's hue,
`hue0 + 3 * PRISM_HUE_STEP`. Written as a common collapse fraction `t`:

```
hue_k(t) = hue_k + (target - hue_k) * t
d(hue_k)/dk = PRISM_HUE_STEP * (1 - t) > 0   for all t < 1
```

Ordering is strictly preserved and the spacing contracts uniformly. **MEASURED
MINIMUM NEIGHBOUR GAP OVER ALL t: 0.000deg. THE COMB NEVER SELF-CROSSES.**

**BUT THE TINT IS WIRED TO THE SHEARED PER-STRAND AMPLITUDE, AND THAT BREAKS
THE THEOREM.** `prismWavePhase` carries `prismPhaseOffset(k) * (1 - uu)`, so
each strand collapses by its own `amp[k]` rather than a common `t`. Strand 0
must travel +144deg to reach the target while strand 1 travels only +96deg, so
when the crest sits near strand 0 it collapses further than strand 1 does and
overtakes it:

| quantity | value |
|---|---|
| min neighbour gap, sheared collapse | **-31.16deg** |
| the comb at that instant | `[127, 96, 102, 144, 192, 240, 288]` |
| closest approach to a MOVED neighbour's resting hue | **0.0deg** |

Strand 0 lands EXACTLY on strand 1's resting hue. That is the "it jumps
erratically between wire indices" reading this whole line of work exists to
remove, re-entering through a door the 0.75-step bound does not cover — the
bound constrains the SIZE of a differential rotation and says nothing about a
collapse that overtakes.

### The fix is structural, not a dial

**THE SHEAR BELONGS TO THE BRIGHTNESS, NOT TO THE COLOUR.** Both arms drive
their chroma from the UN-SHEARED longitudinal phase — the same expression with
the `prismPhaseOffset(k)` term dropped:

```
chroma phase = uu - tMs / durMs          (k-independent)
alpha  phase = uu - tMs / durMs + prismPhaseOffset(k) * (1 - uu)   (unchanged)
```

The alpha wave keeps its diagonal wavefront exactly as shipped. The colour
collapses in unison, which is what "unison" means. Theorem A then applies and
U is monotone by construction.

**IT ALSO MAKES THE A/B AN A/B.** With both arms on the un-sheared phase the
two treatments differ in exactly ONE variable — the chroma axis. Leaving U
sheared and A un-sheared would have confounded the comparison, because A moves
saturation and cannot fold regardless.

---

## 4. The design

### 4.1 The anchors, which is the whole change

`prismChromaBlend` is NOT touched. It already takes offsets into a flat array
of two anchors and lerps between them; it stays exactly as it landed in
`b4ce9e4e`, and the per-point hot loop gains nothing. All that changes is how
the two anchors per spectral line are computed, once per line per frame.

| arm | anchor hue | anchor sat | directionality |
|---|---|---|---|
| **0 — shipped** | `hue_k + PRISM_HUE_LEAD ± PRISM_HUE_SKEW` | `PRISM_SAT` | ±SKEW on hue |
| **U — unison** | `hue0 + PRISM_UNISON_K * PRISM_HUE_STEP`, skewed along travel | `PRISM_SAT` | ±SKEW **signed by each strand's own direction of travel** |
| **A — achromatic** | `hue_k`, unmoved | lead **0**, wake `PRISM_A_WAKE_SAT` | asymmetric BLEACH |

**ARM A NEEDS ITS DIRECTION ON THE SATURATION AXIS, AND THAT IS NOT A
FLOURISH.** A grey anchor has no hue for `PRISM_HUE_SKEW` to act on, so an A
built on the hue skew alone would look identical arriving and leaving — a
pattern that pulses rather than one that flows, which is precisely what
`PRISM_HUE_SKEW` was introduced to prevent. The leading edge bleaches to pure
white and colour floods back in behind it.

**THE SKEW MUST BE SIGNED BY THE DIRECTION OF TRAVEL, NOT APPLIED AS A FIXED
`+SKEW`.** Strands below the fixed point travel toward increasing hue and
strands above it travel toward decreasing hue. A fixed `+PRISM_HUE_SKEW` would
make the leading edge OVERSHOOT on one half of the comb and UNDERSHOOT on the
other, so the two halves would read as arriving and leaving at the same time.
The anchor is `target + travelSign(k) * PRISM_HUE_SKEW` for the lead and
`target - travelSign(k) * PRISM_HUE_SKEW` for the wake, where `travelSign(k)`
is the sign of `target - hue_k`.

**ARM U'S FIXED POINT HAS EXACTLY ZERO EXCURSION**, because it is the fixed
point of its own collapse. That is correct and it is a test: on the fine path
`excursion(k = PRISM_UNISON_K)` is 0, and `excursion(k=0)` and `excursion(k=6)`
are equal in magnitude and opposite in sign. **`travelSign` IS 0 AT THE FIXED
POINT**, so that strand takes no skew either — it is the still centre of the
gather, which is the correct reading and must be pinned rather than patched
around.

### 4.2 New constants

| constant | value | provenance |
|---|---|---|
| `PRISM_CHROMA_MODE_SHIPPED` | 0 | the identity; see 4.3 |
| `PRISM_CHROMA_MODE_UNISON` | 1 | arm U |
| `PRISM_CHROMA_MODE_ACHROMATIC` | 2 | arm A |
| `PRISM_UNISON_K` | `(n - 1) / 2` | the comb's midpoint, ruled by the author 2026-09-22 |
| `PRISM_A_WAKE_SAT` | 35 | **CHOSEN, never seen by an eye** |

**`PRISM_UNISON_K` IS DERIVED FROM THE LIVE LINE COUNT `n`, NEVER WRITTEN AS A
LITERAL 3.** It is 3 on `PRISM_SPECTRAL_FINE` = 7, and **1.5 on
`PRISM_SPECTRAL_COARSE` = 4** — where no strand sits at the fixed point at all.
That is not a defect: the target is a HUE, not a strand, and a coarse bundle
gathers onto a colour none of its four lines is wearing. A literal 3 would put
the coarse pointer's target outside its own comb entirely, on the far side of
its widest line, and the test matrix must cover both line counts for exactly
this reason.

### 4.3 The switch, following the bead precedent exactly

`24803fc0` established the shape and its reasoning stands verbatim here: a
source patch per arm means a vite rebuild and a Chrome relaunch per arm, and
`_a10dash.mjs` proved four such launches could not beat their own noise — the
same build shot twice differed by more than either treatment arm.

- a ref the draw loop already copies onto the effect each frame,
- `window.__artSetChromaMode(n)` which **RETURNS THE VALUE IT SET**, so a
  caller can assert the flip landed rather than assume it did — the contract
  `__artSetOrthogonal` was given after the vacuous-hook lesson,
- takes effect on the NEXT DRAW: no re-render, no rebuild, no relaunch, one
  page, one seed, one rAF cycle.

**THE DEFAULT IS 0 AND THAT IS LOAD-BEARING.** 0 selects the shipped anchor
expression, so the shipped path runs the identical code it runs today and the
parity reference cut at `33bda07e` is untouched. Getting the default wrong
would silently repaint every cascade the app draws. The declaration and the
`?? 0` both carry the reason, and a test pins each.

### 4.4 Testing

Written before the implementation, per the project's standing practice.

| property | why it is not vacuous |
|---|---|
| **U's comb is monotone in k at every collapse fraction** | this is the defect of section 3; delete the un-sheared phase and it must FAIL |
| U's fixed-point strand excursion is exactly 0, and its `travelSign` is 0 | pins the still centre |
| **every U property holds on `PRISM_SPECTRAL_COARSE` = 4 too** | the fixed point is 1.5 there and no strand sits on it; a literal 3 passes the fine path and breaks the coarse one |
| U's outer strands are equal and opposite | pins the symmetry |
| A leaves every hue unmoved | A must not be a rotation in disguise |
| A's lead and wake saturations differ | the anti-pulse contract of 4.1 |
| both arms return EXACTLY the resting colour at amp 0 | same contract `prismWaveMix` keeps for alpha |
| mode 0 is byte-identical to the shipped expression | the parity argument of 4.3 |
| anchors are computed once per spectral line, not per point | the allocation trap of `b4ce9e4e` |
| `__artSetChromaMode` returns what it set | the vacuous-hook lesson |

**EVERY PROPERTY TEST HERE MUST BE FALSIFIED AGAINST THE UNFIXED CODE BEFORE
IT IS BELIEVED.** A `toBeCloseTo` on a converged value has passed with the
mechanism deleted three times on this project. For each test: delete the
mechanism, confirm the test FAILS, restore.

### 4.5 Measurement

| instrument | answers | status |
|---|---|---|
| `_a23combR.mjs` | circular concentration R and delivered saturation per arm, on filmed frames | **NEW** — built from the ad-hoc script used in section 0 |
| `_a22chroma.mjs` part 1 | extended to bound arm A's luminance cost on the saturation axis | extend |
| `_a21wavefilm.mjs` | frames per arm, at one seed, via the mode switch | reuse |

**R IS THE RIGHT NUMBER AND THAT IS THE POINT OF SECTION 1.** It measures
precisely "does this field have a reference hue". U should drive R from ~0.03
toward 1.0 at the crest; A should drive delivered saturation down while the
value holds. This project has had no visibility metric for a chromatic packet;
this is it.

**THE MEASUREMENT IN SECTION 0 WAS WHOLE-FRAME**, so it includes the nodes and
the base edges, not the bundle alone. `_a23combR.mjs` must clip to the bundle's
own region before its numbers are quoted against a crest.

---

## 5. Explicitly not in scope

1. **Narrowing the packet.** The ruling's second point is correct and is the
   strongest of the three, but it is a SEPARATE change and folding it in would
   confound the A/B. Recorded for the plan that follows this one: the support
   is `2 * PRISM_WAVE_W` = 36% of the chord, and the per-strand shear adds
   0.30, so the BUNDLE-LEVEL packet is **0.66 of the chord** — that, not
   `PRISM_WAVE_W`, is why the whole chord appears to change at once. `W` and
   `PRISM_PHASE_STEP` must move together, `W = 0.09` drops the Nyquist
   sampling from 5.04 to ~2.5 across the support and would silently fade the
   wave out under the `PRISM_WAVE_SEG_FULL` guard, and raising
   `PRISM_WAVE_SEGMENTS` to compensate spends instances that `_a19budget.mjs`
   must be re-run to price.
2. **A lightness lift on the crest.** Section 2. Unmeasured, and ruled onto
   the saturation axis instead.
3. **Re-cutting the parity reference.** Mode 0 is the shipped path, so nothing
   here moves it. The re-cut still owed from the branch handover is unaffected.
4. **Shipping either arm.** This design ends at a ruling, not at a merge.

---

## 6. Traps carried in from earlier sessions that apply directly here

- **`edgeFrag` IS A JS TEMPLATE LITERAL.** No backticks in any comment added to
  it. Recorded three commits before it bit again at `24803fc0`.
- **`effects[0]` IS THE OLDEST EFFECT**, and a spawn takes a render to reach
  `geomEffectsRef`. Read the youngest and confirm the spawn.
- **"THE LARGEST DISC" IS THE MOST LIT NODE, NOT THE NEAREST.** Try several
  discs and confirm the spawn.
- **NEVER TOUCH THE WORKING TREE WHILE A BASELINE RUN IS IN FLIGHT.** vite HMRs
  the edit into the page; the tell is two different `gitCommit` stamps across
  the manifests.
- **`artCompare` IS STRUCTURALLY BLIND TO THIS CLASS OF CHANGE.** 21/21
  ADMISSIBLE proves only that the 60fps frame did not move. It cannot rule an
  A/B and must not be quoted as though it had.

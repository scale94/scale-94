# Handover — CHAOS prism longitudinal wavefront

**Written 2026-09-22.** Paste-ready for a fresh session.

> **REVISED 2026-09-22, AFTER THE AUTHOR LOOKED.** He saw the finished wave
> and ruled the three-pulse train out: it read as "an aggressive ~10Hz
> strobe/flicker rather than an intensifying pulse". The train is gone —
> one pass, a crescendo envelope, a shallower trough and a longer release,
> at `44b52b88`. **Sections 4, 5 and 6 below are updated; everything else
> in this document still describes the layer as it stands.**
>
> **REVISED AGAIN THE SAME DAY.** He looked at the single pass and reported
> that the COLOUR was still static along the chord — "pinned to the wire
> like a light shining through stained glass". The colour now advects on the
> same coordinate the brightness rides, at `b4ce9e4e`. See §11.

Sibling document: `handover-chaos-prism-dash.md`. **That one still holds** for
the prism depth cue, root taper, dash beads and the phase-4 parity reference —
read its §4 and §7 before touching anything. This one covers only what changed
on 2026-09-22, and it **supersedes that document's item 4 mobile note** only
insofar as the cost model changed; the measurement is still owed.

---

## 1. Git state

| fact | value |
|---|---|
| branch | `feature/chaos-prism-depth-dash-beads` |
| HEAD | `b4ce9e4e` |
| forked from | `main` at `09e86f44` |
| ahead / behind main | **31 / 0** |
| `main` vs `origin/main` | **0 / 0** — in sync |
| tracked tree | **clean** |
| tests | **1549 passing, 122 files** |
| lint | **0 errors / 146 warnings** (146 is main's own count) |
| pushed? | **NO. Nothing on this branch is pushed.** |

```
b4ce9e4e feat(chaos): advect the prism's colour along the chord, not just its light
6deb145b docs(chaos): revise the wavefront handover for the single pass
44b52b88 fix(chaos): collapse the prism train to one intensifying pass
63a043e1 docs(chaos): hand over the prism wavefront, dials marked by provenance
5a850395 fix(chaos): force the tessellation the wavefront needs, and watch it shear
49a7351a feat(chaos): give the prism a longitudinal wavefront, and measure what it costs
77d5612c fix(chaos): the prism envelope was counting draws, not measuring time
9723f946 feat(strimer): give the brightest layer on the sphere a depth term
876aa577 <- the previous session's HEAD
```

Spec for the earlier work:
`docs/superpowers/specs/2026-09-21-chaos-prism-depth-dash-beads-design.md`.
**The wavefront has NO spec file.** The design was agreed in conversation and
lives in commit `49a7351a`'s message and in the block comment at
`artEdges.js:427`. If a spec is wanted, write it from those.

---

## 2. What the author actually asked for, and what was wrong

He asked to refine the prism chords into a Lian Li Strimer style
**longitudinal** flow, reporting that the animation "jumps erratically between
wire indices" rather than propagating from node A to node B.

**HIS REPORT WAS EXACTLY RIGHT, AND IT IS THE FIRST ONE ON THIS BRANCH THAT
WAS.** The previous four reports each named the wrong layer (see the sibling
handover's §4.3–§4.7). This one did not, and the reason is worth keeping:

- **The prism had no time term at all.** Every point's alpha was
  `lAlpha * cue(tt) * taper`. Nothing in the layer read a clock, so nothing
  travelled.
- **Its only motion was lateral.** `hue = (hue0 + k * 48) % 360` with `hue0`
  drifting over the effect's life, against a **static** brightness ladder
  (`PRISM_ALPHA_FALLOFF` 0.07/line, fixed). The slots never move; the colours
  slide through them, so a given colour appears to hop from strand k to k+1.
  After his second look he put it better than the code comment does: *"a solid
  sheet of coloured plastic shifting hues across its ribs."*

**AND THE ENVELOPE WAS FRAME-COUNTED.** `eff.life++` advanced once per rendered
frame while `eff.maxLife` counts AUTHORED frames, so the whole layer ran at
refresh-rate/60 tempo — **6x on his 360Hz panel**. A degree-4 click authored for
3.5s lived 0.59s. **This is the fifth place on this project where a per-draw
counter was found standing in for a clock.** Fixed at `77d5612c`; he looked and
confirmed the decay curve now "feels substantial".

---

## 3. The design, and the one decision everything hangs on

```
x    = u - t/T + phi_k * (1 - u)
f(x) = |x| > W ? 0 : 0.5 * (1 + cos(pi * x / W))
```

`(1 - u)` is the arrival damping: at `u = 1` it vanishes and all seven strands
land as one synchronised pulse; at `u = 0` they are sheared into a diagonal.

### IT IS SUBTRACTIVE, AND THAT IS NOT A TASTE CALL

`packAlphas` **clamps at 255**, so an alpha driven past 1.0 saturates silently —
and a saturated bundle loses exactly the chromatic separation between the seven
spectral lines that this layer exists to show. That is the author's own third
note (the white rail "almost blows out the delicate chromatic separation")
arriving through the arithmetic rather than the eye.

So the crest sits at **exactly** the alpha that shipped and the troughs are
carved beneath it:

```js
alf[i] = a * cue * wave * taper
wave   = 1 - PRISM_WAVE_DEPTH * env * segFade * (1 - amp)
```

Three consequences, all load-bearing:

1. **It cannot clip.** Bounded to `[1 - PRISM_WAVE_DEPTH, 1]` by construction.
2. **It is provably ink-NEGATIVE.** It can only remove energy from the
   composer's `0.28` luminanceThreshold. **The bloom dial is off limits on this
   project and this change cannot reach it.**
3. **`prismTrainEnv` returns EXACTLY 0 after the train**, so the expression
   collapses to `a * cue * taper` — the sustained burn the author signed off by
   eye BEFORE this feature existed, unchanged. That test uses `toBe`, not
   `toBeCloseTo`, deliberately: an asymptote there is the vacuous-property trap
   this project has already paid for three times.

**Do not make this additive to "get more punch".** The punch has to come from
`PRISM_WAVE_DEPTH` or from the sustained alpha, not from exceeding 1.0.

---

## 4. Every dial, where it came from, and whether anyone has looked

All in `src/terminal/art/artEdges.js`.

| constant | line | value | provenance |
|---|---|---|---|
| `PRISM_WAVE_W` | 484 | 0.18 | **AUTHOR-APPROVED** by name |
| `PRISM_PHASE_STEP` | 490 | 0.05 | **CHOSEN, never ruled** |
| `PRISM_WAVE_DEPTH` | 507 | 0.40 | **AUTHOR-RULED DOWN** from 0.55 |
| `PRISM_WAVE_MS_PER_UNIT` | 522 | 160 | derived: 0.8x strimer |
| `PRISM_WAVE_MIN_MS` | 523 | 56 | derived: 0.8x strimer |
| `PRISM_WAVE_MAX_MS` | 524 | 128 | derived: 0.8x strimer |
| `PRISM_WAVE_SWELL` | 555 | 0.10 | **BOUNDED** — `DEPTH * SWELL` < the 4.3% ripple |
| `PRISM_WAVE_TAIL_MS` | 568 | 360 | **CHOSEN** — 3.5x the median transit |
| `PRISM_CASCADE_MS` | 573 | 110 | **CHOSEN** — "about one transit" |
| `PRISM_WAVE_SEGMENTS` | 609 | 40 | **MEASURED**, then author-chosen |
| `PRISM_WAVE_SEG_FULL` | 623 | 40 | **MEASURED** |
| `PRISM_WAVE_SEG_NONE` | 624 | 20 | **MEASURED** |

**`PRISM_TRAIN_PULSES`, `PRISM_TRAIN_DECAY` AND `PRISM_TRAIN_TAIL_MS` NO
LONGER EXIST**, and `prismTrainEnv` is `prismWaveEnv`. The train was the
defect, not a dial on it: three crests one transit apart strobe a point at
1/durMs, 9.7Hz on the median chord. Setting a pulse count to 1 would have
left the mechanism in place, so the loop is gone instead, and the test that
guards it counts crests at a fixed point on the chord rather than reading a
constant — no reintroduced train passes it under any name.

**THE 0.8 RATIO IS NOT THREE SEPARATE NUMBERS.** `MS_PER_UNIT` and **both**
clamps are exactly 0.8x the strimer's (200 / 70 / 160). The uniform ratio is
the point: it makes the prism pulse strictly faster than the strimer packet at
**every** chord length, including up at the clamp where the strimer's own header
notes its velocity stops being constant. `artPrismWave.test.js` asserts this
against `packetDuration` imported from `artStrimer.js`, so an edit to **either**
file that closes the gap fails a test. On the measured median chord (0.642 world
units) the lead is ~26ms.

---

## 5. What is verified, and how

### Verified by measurement

| claim | evidence |
|---|---|
| the envelope is now clock-driven | `_a17prismclock.mjs`: `d(life)/d(draw)` 1.0000 -> 0.2757, `d(life)/d(ms)*16.667` 4.5993 -> 0.9942, a 2.00s effect 0.43s -> **2.01s** |
| the crest travels | `_a20wavetrace.mjs`: 0.320 -> 0.852 across one transit, in the GPU-bound buffer |
| the strands are sheared | 6/6 monotonic steps across k |
| **the shear collapses on arrival** | spread **0.294 -> 0.076**; closed form predicts 0.291 at tau=0.32 |
| the trough depth matches the closed form | **0.600 measured at t=53ms**, against 0.771 predicted for the wave times 0.778 measured for the depth cue it multiplies |
| the tessellation is forced | 40 segments on every waving chord |
| it fits the buffer | capacity 131162, peak **11290 (8.6%)**, **0 dropped** |

### The full shear table, for comparison after any tweak

```
 age(ms)   k=0     k=1     k=2     k=3     k=4     k=5     k=6   spread  mono
     44   0.320   0.262   0.252   0.176   0.148   0.051   0.026   0.294   6/6
     58   0.483   0.445   0.430   0.374   0.320   0.270   0.263   0.220   6/6
     70   0.598   0.583   0.544   0.507   0.470   0.435   0.381   0.217   6/6
     79   0.646   0.631   0.617   0.578   0.540   0.528   0.491   0.154   6/6
     86   0.695   0.681   0.668   0.656   0.617   0.605   0.567   0.128   6/6
    103   0.852   0.845   0.808   0.831   0.824   0.784   0.777   0.076   5/6
```

### NOT verified — say so rather than implying otherwise

- **`artCompare` was NOT run, on purpose, twice.** For the clock fix it is
  *structurally blind*: `determinism.mjs` advances `performance.now()` by
  exactly `FRAME_MS` per `__pump`, so `_dtFrames` is exactly 1.0 under capture
  and the changed line is bit-identical to the old one there. An ADMISSIBLE
  verdict would be produced just as readily by deleting the fix. For the
  wavefront, the sibling handover's §4.6 already records the phase-4 reference
  as **stale for the strimer layer**, and `fired-cascade` is the one capture
  state that left-clicks — so a compare would now show **three** overlaid
  changes and adjudicate none of them.
- **Mobile fps.** Coarse pointers get 4 spectral lines x 6 nodes, so the
  40-segment forcing costs far less there — **but that is arithmetic, not a
  measurement.** Still owed, and the figure on record predates the whole fix
  wave.
- **The author has not looked at the wave MOVING since the revision.** He
  looked at the three-pulse version and ruled it out, so `PRISM_WAVE_DEPTH`
  and the removal of the train follow from that ruling — but
  `PRISM_WAVE_SWELL` and `PRISM_WAVE_TAIL_MS` have never been seen by an eye.
- **Nine mutations of the revised design were run and every one fails 1-3
  tests**: the train restored, a flat envelope, a linear swell, a linear
  release, the old depth, a raised floor, an asymptotic release, a short
  release, and the arrival damping dropped.
- **THE EARLIEST FRAME `_a21wavefilm` CAN REACH IS ~55ms.** A click plus the
  eval that confirms the spawn costs that much, so the first half of a 103ms
  transit is not photographable by this route. Ages 0 and 30 report NO SPAWN
  rather than being guessed at.

---

## 6. Open items

1. **THE DIALS IN §4 NOT MARKED AUTHOR-RULED.** In the order most likely
   to need moving:
   - `PRISM_WAVE_SWELL` (0.10) — how much of the wave is present at launch.
     **It has a ceiling, not just a taste range**: `DEPTH * SWELL` must stay
     under the 4.3% tessellation ripple or the cascade's arrival at each chord
     acquires a visible edge of its own. At the shipped depth that caps it
     near 0.107.
   - `PRISM_WAVE_TAIL_MS` (360) — how long the sleeve takes to lift back into
     the sustained burn. Longer reads as absorption, shorter as a switch.
   - **`PRISM_WAVE_DEPTH` (0.40) IS RULED.** Do not walk it back up to chase
     punch; a test asserts the sleeve floor stays at or above 0.60. The punch
     is supposed to come from the crescendo.
   - `PRISM_PHASE_STEP` (0.05) — the diagonal's angle. **Judge it by the shear
     COLLAPSE, not the launch**: the launch spread is 0.294, the arrival 0.076.
     If the strands look ragged when they land, this is the dial.
   - `PRISM_CASCADE_MS` (110) — how fast the burst spreads outward through the
     graph.
   - The train's echo dials are gone; there are no echoes to ring out.
2. **`PRISM_WAVE_SEGMENTS` IS COUPLED TO TWO OTHER PLACES. Do not move it
   alone.** `MAX_ADDITIVE_EDGES` (`SphereEdges.js`) derives from it, and
   `PRISM_SCRATCH_SEGMENTS` (`ArtTab.jsx`) takes the max of it and
   `CURVE_MAX_SEGMENTS`. **`tessellateQuad` has NO bounds check and a
   Float32Array write past the end is a SILENT no-op**, so undersizing either
   drops the tail of every long chord while nothing throws and nothing warns.
   Re-run `_a19budget.mjs` after any change and confirm `dropped` is still 0.
3. **If `PRISM_WAVE_W` moves, `PRISM_WAVE_SEGMENTS` must be re-derived.** Run
   `_a18wsweep.mjs`; its table is the whole argument. Worst-case ripple:

   | | W=0.18 | W=0.22 | W=0.30 |
   |---|---|---|---|
   | n=24 | 11.3% | 7.7% | 4.2% |
   | n=32 | 6.6% | 4.4% | 2.4% |
   | n=40 | **4.3%** | 2.9% | 1.6% |

4. **The parity reference wants re-cutting once the wave is ruled** — not
   before. It will then be stale for three layers at once (strimer depth cue,
   prism clock, prism wavefront), and `fired-cascade` is where all three land.
5. **Mobile fps re-measurement** (carried from the sibling handover's item 4).
   `scripts/mobileFps.mjs` defaults to the dead 5174 origin — pass
   `--url http://localhost:5173/`.
6. **The disc<->streak ink discontinuity** (~38x) is still unruled. Sibling
   handover item 4, first half. **Needs an author ruling before any code.**
7. **ON HOLD — the dynamic strand MERGE / PINCH artifact.** Sibling handover
   §4.7. Do not reopen without being asked. **Note its correction: the layer to
   refactor is `prismControl` in `artEdges.js`, NOT the strimer.**

---


---

## 11. The chromatic front — what changed, and what it may not do

**`b4ce9e4e`.** The author's report after the single pass landed: the wave was
firing but "the colour remains completely static along the chord ... pinned to
the wire like a light shining through stained glass".

**HE WAS RIGHT AT THE BUFFER LEVEL, AND THE FIX COST NO FLOATS.** The instance
layout has carried THREE colour stops since it was written — `EDGE_OFF.c0`,
`c1`, `c2` at offsets 4-6, 7-9 and 10-12 — and `edgeFrag` has always
interpolated them as a three-stop gradient along the segment. `writePolyline`
was writing the same rgb into all three, which degenerates that gradient to
flat. Every prism instance ever written has been carrying an unused colour
ramp. **`EDGE_STRIDE` stays 18, the shader is untouched, `MAX_ADDITIVE_EDGES`
does not move.** `writePolyline` takes an optional `rgbs` (3 floats per POINT),
the exact twin of its existing `alphas`.

### The new dials

| constant | value | provenance |
|---|---|---|
| `PRISM_HUE_LEAD` | 24 | **CHOSEN, never seen by an eye** |
| `PRISM_HUE_SKEW` | 10 | **CHOSEN, never seen by an eye** |

**BOTH ARE BOUNDED, NOT JUST CHOSEN.** `LEAD + SKEW` must stay under 0.75 of
`PRISM_HUE_STEP` (48deg), because a crest free to rotate a full step wears the
NEIGHBOURING strand's resting colour — which is the "it jumps erratically
between wire indices" reading this whole line of work exists to remove,
rebuilt out of the fix for it. A test asserts it against `PRISM_HUE_STEP`,
never against a literal.

### The two things deliberately NOT done

1. **NOT `fract(u * CYCLES - progress)`.** The author suggested repeating
   colour bands as one option. They would put a SPATIAL periodicity back onto
   a layer whose TEMPORAL periodicity was removed one commit earlier for
   reading as a ~10Hz strobe. The tint is bound to the single crest instead.
2. **NOT a white-hot / electric-cyan lift, and this one is still open.** The
   alpha design is provably ink-NEGATIVE and therefore cannot reach the
   composer's 0.28 `luminanceThreshold`; **colour carries no such proof**,
   since a yellow and a blue at the same HSL lightness are not the same
   brightness. So the rotation is at the SAME sat and lit, and its cost is
   MEASURED: worst case **1.632x brighter on the glow pass, 1.120x on the
   core**, and only ON THE CREST (`_a22chroma.mjs` part 1, which needs no
   browser). **A lightness lift is a separate decision and wants a ruling
   plus its own measurement — do not smuggle one in.**

### Verified

| claim | evidence |
|---|---|
| the colour is ramped in the GPU-bound buffer | 38-70 runs with `c0 != c2`, measured two independent ways |
| the ramp GROWS as the pass develops | hue excursion 4.8deg -> 24.4deg with rising `life` — the weight includes `env`, so that growth IS the crescendo |
| it stays inside its bound | widest seen 24.4deg against a 34deg design max and a 48deg spectral step |
| it returns to the resting colour | excursion back to **exactly 0** once the pass is over |
| nine mutations each fail 1-3 tests | tint ignoring amplitude, symmetric tint, phase losing its sign, unclamped skew, full-step rotation, asymptotic tint, a train back in the amplitude, stops written flat, `rgbs` ignored |

**NOT verified: the author has not looked at it moving.**

### Traps paid for in section 11

- **`writeHsl` ALLOCATES A CLOSURE PER CALL**, and so does `subarray`. Either
  one evaluated per point puts ~74000 allocations a frame on a draw loop this
  project keeps deliberately clear of them. The tint anchors are converted
  ONCE PER SPECTRAL LINE (a line's hue does not depend on the chord) and
  `prismChromaBlend` takes OFFSETS into a flat array, not sliced views.
- **`effects[0]` IS THE OLDEST EFFECT.** A spawn-confirmation loop that reads
  it sees the PREVIOUS effect still running, rejects it as "not mine", and
  throws away ten good clicks in a row. Read the youngest.
- **A SPAWN TAKES A RENDER TO REACH `geomEffectsRef`.** Reading `life`
  immediately after the click looks exactly like a click that missed.
- **"THE LARGEST DISC" IS THE MOST LIT NODE, NOT THE NEAREST.** The layer
  inflates a disc when its node fires, so the pick wanders the sphere and
  lands on the far side where clicks are ignored. "Nearest the projected
  centre" is no better in principle — a sphere projects its near and far
  poles onto the same point — but it is what measurably works under CDP.
  Stop guessing: try several discs and CONFIRM THE SPAWN.
- **A POSITIONAL ARGUMENT IN THE WRONG SLOT PASSED THE EYE AND FAILED THE
  TEST.** `writePolyline(..., 0, null, c)` put the colour array in `alphas`.
  The per-point colour test caught it immediately, which is the whole case
  for writing the liveness test before believing the wiring.

## 7. Instruments added this session

All take `[W] [H] [DPR] [PORT]` and want the dev server on **5173**.

| script | answers |
|---|---|
| `_a17prismclock.mjs` | frame-counted or clock-driven? **Reusable for ANY refresh-rate bug on this project.** |
| `_a18wsweep.mjs` | how finely must a chord be tessellated to carry a pulse of half-width W? Pure, no browser. |
| `_a19budget.mjs` | how much room is left in the additive pool? |
| `_a20wavetrace.mjs` | is the wave actually in the GPU-bound buffer, and is it sheared? **Its sample loop is too slow for a single 100ms pass — it now catches one in-flight frame, not six.** |
| `_a22chroma.mjs` | is the COLOUR advecting, and what does the tint cost in light? Part 1 is a pure luminance bound and needs no browser. |
| `_a21wavefilm.mjs` | what does one pass LOOK like at a chosen age? One click per frame, the age measured off the clock. Three traps paid for inside: the sphere rotates out from under a cached coordinate; "the largest disc" is the most LIT node, not the nearest one; and a synthetic `MouseEvent` spawns nothing at all, so the click must go through CDP's input domain. |

New harness hook: `window.__artGeomState()` — live effects with `life` /
`maxLife`, plus the additive pool's `count` / `dropped` / `capacity`.
**Deliberately not `__artEdgeState`**, which serialises the whole buffer and
would cost more than the frame being timed.

---

## 8. Traps paid for this session — all of them cost real time

- **THE PARITY HARNESS IS STRUCTURALLY BLIND TO REFRESH-RATE BUGS.** Stated
  again because it is the one most likely to be forgotten. Prove rate with
  `_a17prismclock.mjs` on the **real** clock, and **falsify against the unfixed
  code first** — that is what makes the after-run mean anything.
- **"~74000" IN `ArtTab.jsx` COUNTS INNER-LOOP ITERATIONS, NOT INSTANCES.** The
  measured peak is 5408 / 81882. That misreading nearly sent this session to a
  shader rewrite it did not need.
- **A SWEEP AGAINST A UNIFORM GRID WOULD HAVE BEEN OPTIMISTIC.**
  `tessellateQuad` splits at uniform PARAMETER and these segments differ
  several-fold in arc length. Optimistic is the wrong direction for a guard, so
  `_a18wsweep` builds real chords through `prismControl`.
- **FOUR INSTRUMENT DEFECTS, EVERY ONE PRODUCING CREDIBLE NUMBERS FIRST:**
  1. tracking "the longest run" per frame — once `n` is forced, **hundreds
     tie**, so consecutive samples described *different chords* and the crest
     sequence was not a trajectory at all;
  2. filtering short runs and then addressing spectral lines **by position** —
     any drop shifts every later index. Fixed by decoding `k` from
     `prismGlowWidth`'s own `5 - 0.4k`, which is order-independent;
  3. reading min/max over the whole run, which measures the **root taper**
     (alpha -> 0 at both ends), not the wave — it reported a trough of exactly
     0.000 on frames with no wave at all;
  4. sampling the shear ~900ms after the click, when the ~570ms train was long
     over and every crest sat at u ~ 1.0 — it was measuring the depth cue's
     ramp.
- **MUTATION-TEST EVERY PROPERTY TEST.** All 27 were run against 7 deliberate
  mutations; each fails 1–3 tests. **Back the file up to the scratchpad first —
  `git checkout --` restores to the last COMMIT and destroys uncommitted work.**
- **ONE OF MY OWN TESTS WAS MIS-SPECIFIED AND PASSED ANYWAY.** The
  decaying-train test took the max amplitude over the *whole chord* at
  `t = n*dur`, which is dominated by pulse n-1 **arriving** at the far end at
  full amplitude — it compared the wrong two pulses and would have passed a
  train that never decayed. It measures at the origin now.
- **`filter(Boolean)` RENUMBERS.** The prism's `effProj` used it; adding a
  parallel depth array meant the depths could no longer be looked up by the
  same index, and **half the bundle would have flowed the wrong way.** Three
  parallel arrays now, built in one loop.
- **CHECK THE PRINTED LINT COUNT, AND DIFF IT.** Warnings went 146 -> 148 and
  the two were in the new **test** file (unused imports), not the source. A
  `git stash` of only the source files proved the source added zero. Both were
  fixed by adding the test those imports deserved.

---

## 9. Recovery CLI

```bash
cd /f/scale_9.4
git checkout feature/chaos-prism-depth-dash-beads
git log --oneline main..HEAD
npx vitest run
npm run lint
```

Dev server (the working entry, **not** `scale94-dev`, which passes `--port 5174`
against a `strictPort: true` config):

```bash
npm run dev
```

With it up on 5173:

```bash
node scripts/_a20wavetrace.mjs
```

```bash
node scripts/_a18wsweep.mjs
```

---

## 10. Standing constraints

- **Do not merge. Do not push.** Verification approval is not push consent.
- **Never run vitest with `-u` / `--update`.**
- Each task commits only its own named files — **never `git add -A`**.
- **`EDGE_STRIDE` stays 18.**
- **The bloom dial is off limits**: `BLOOM.intensity`, `BLOOM.levels`,
  `BLOOM.luminanceThreshold`, `KNEE.knee`. Bring numbers, do not turn a dial.
- **Never edit tracked source while an `artBaseline`/`artCompare` capture is
  running** — Vite HMRs the edit into the page and the tell is two different
  `gitCommit` stamps across manifests.
- **`main` lives in a worktree** (`.claude/worktrees/vigilant-shaw-b8bf39`), so
  `git checkout main` from the repo root FAILS. Merge from that worktree, and
  quote a merge size with `git rev-list --count main..BRANCH` — never by adding
  deltas.

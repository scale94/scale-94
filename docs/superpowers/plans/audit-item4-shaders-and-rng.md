# Item 4 audit — the two shader commits, the two randomness commits, and what
# they do and do not explain

Read-only session on `fix/art-sphere-index-space` at `faa872d`. No code edited.
`main` untouched at `a54ea3e`. Nothing pushed, nothing merged.

Scope actually covered: the four commits the handover names as "review hardest"
(`7f5f2ce`, `3551885`, `dd4bf46`, `e09ad1e`) plus the three post-step-7 fixes
(`c075540`, `7861912`, `0fdae8d`) and `e6728f6`. That is **8 of the ~20 commits
item 4 lists as unreviewed**. `cbf22f1`, step 4 task 6, step 5 tasks 1–8,
`9661dfa`, `dd14af6`, `08a9ea5`, `590a9da`, `fbd73de`, `0dea8ed`, `f5ae8a5` are
**not covered here** and remain unreviewed.

---

## GATES AT `faa872d`, run first, all green

```
npx vitest run           1278 passed / 115 files            exit 0
npm run lint             0 errors, 145 warnings             exit 0   (ratchet 153)
dev server :5174         HTTP 200  (was NOT running; started via scale94-dev)
node scripts/artSmoke.mjs        12/12, console errors 0    exit 0
node scripts/_s7probe.mjs        11/11, all four sub-layers both directions
```

`_s7probe` detail, for the record: world boundary forced `count=137
worldCount=133 beyond=4 drawn=4`; dormant `103/102/1/1`; peer-push drift 0.0232
against an organic control of 0.0038.

Every number matches the handover's gate block exactly. Nothing regressed.

---

## 1. THE HEADLINE — the ink finding has never had a null, and it needs one

This is the most consequential thing in the audit and it was measured, not
argued. It bears directly on item 2 and it changes what item 2 is.

`artNull` certifies a capture set by **worst-pair luminance correlation**.
Item 2's finding is about **summed ink**. Those are not the same question, and
nobody has ever measured the second one's noise floor.

I measured it, from PNGs already on disk — `artInk` between two sets of the
**same build** (`s7cond2-a` vs `-b`, and `-a` vs `-c`), which should read 1.000
on every row if ink repeats:

| cell | a vs b | a vs c | null certificate for that cell |
|---|---|---|---|
| laptop@1x `immersive-on` | **0.972** | 1.001 | 0.9945 PASS, world agrees |
| laptop@1x `mid-drag` | **0.988** | 1.000 | PASS |
| laptop@1x `resonance` | 1.011 | 1.011 | PASS |
| projector `idle` | 1.010 | **1.030** | 0.9796 PASS, world agrees |
| projector `immersive-off` | **0.978** | 0.999 | (uncertified cell) |
| laptop@2x — every state | **1.000** | 0.999–1.002 | PASS |

**The same-build ink spread at laptop@1x and projector reaches ±3%.** The
"particle ink excess" the branch has carried for two steps is +1.3% to +2.5%.
At those two scales the finding sits inside its own noise floor.

The clearest single case: projector `idle`, same build, same **world hash**
(`a39ed7c6`, agreeing across all three sets), null 0.9796 PASS — and set c has
**45,534 lit pixels against a's 31,385**, a 45% difference, at mean luminance
14.74 against 20.77. A faint full-field wash, present in one set of three,
invisible to a luminance correlation and worth +3% of frame ink.

**What survives.** laptop@2x is genuinely tight: a-vs-b reads 1.000 on all seven
states, several byte-identical. At that scale the excess against the reference
is real — `idle` 1.016/1.017/1.015 against a null of 1.000. And `fired-cascade`
is above the null at every scale (1.037–1.056 against a null of 1.005–1.008).

**So item 2 should be restated as:** a reproducible excess at laptop@2x and in
`fired-cascade` everywhere, and an unresolved ink-reproducibility problem at
laptop@1x and projector that has been read as signal. Before anything else is
hunted, `artInk` needs the same treatment `artCompare` got in post-step-5
task 2 — a same-build floor, quoted next to every ratio.

> **CORRECTION, after building that floor into `artInk` — and it softens the
> paragraph above.** I wrote "at those two scales the finding sits inside its own
> noise floor" from per-cell pairs. With the floor implemented and computed over
> every same-build pair on both sides (the reference has FIVE replicates on disk,
> `s7ref-b..e`, i.e. ten pairs — a wider net than the three I had used), the
> **mode rollup is tighter than any individual cell**, because summing five
> states averages the per-cell wobble out. `s7cond2-a` against the certified
> reference:
>
> | normal-mode frame | ratio | floor |
> |---|---|---|
> | laptop@1x | 1.013 | ±0.009 |
> | laptop@2x | 1.020 | ±0.005 |
> | projector | 1.025 | ±0.008 |
>
> **The rollup clears its floor at all three scales**, and so does step 6's
> (`s6fix-a`: 1.023/1.017/1.032 against ±0.011/±0.005/±0.008). So the headline
> excess IS a signal — my "inside the noise" reading was drawn from the quiet
> individual states and does not carry to the rollup.
>
> What stands unchanged: the *per-cell* rows are a mixture. Over the whole
> `s7cond2-a` comparison the tool now reads **20 SIGNAL, 22 noise of 42 graded
> rows** — so `idle`, `hover`, `mid-drag` and `resonance` at laptop@1x and
> projector are genuinely indistinguishable from re-running the same build, and
> quoting them as part of a "+1.3% to +2.5% everywhere" band was wrong. The
> excess is real; its *shape* is `fired-cascade` plus laptop@2x plus laptop@1x
> immersive, not a uniform band.

## 2. Two further corrections to how item 2 is currently quoted

**a. "It flips sign in immersive" is true at two scales of three.** Reproduced
across all three step-7 sets:

| `immersive-on` frame | set a | set b | set c |
|---|---|---|---|
| laptop-1520x900@1x | **1.054** | **1.025** | **1.056** |
| laptop-1520x900@2x | 0.996 | 0.996 | 0.996 |
| projector-1920x1080@1x | 0.998 | 0.989 | 0.997 |

At laptop@1x immersive is the **largest excess anywhere in the set** — larger
than any normal-mode state. The record quotes the projector's 0.998 as "the"
immersive figure and infers from it: *"it flips sign in immersive, where the
standing gain is 3.125× rather than 1.389× — that points at the accumulation
path, not the rasteriser."*

The gain `m` is per **mode**, not per **scale**. If the accumulation path were
the mechanism it would act the same way at all three scales. It does not; the
sign is scale-dependent. On this evidence the inference runs the other way —
toward something resolution-dependent, i.e. coverage/rasterisation — or toward
§1's noise. Either way the accumulation-path conclusion is not supported by the
full table it was drawn from.

**b. The "+1.3% to +2.5% normal-mode" band is a sum-weighted rollup dominated by
one state.** `artInk`'s "normal ratio" sums ink across the five normal states.
At laptop@1x `fired-cascade` is 41% of that sum and reads 1.037; the other four
states read 0.994–1.007. The rollup's 1.013 is essentially fired-cascade's 1.037
diluted. Step 6's own per-state table said this plainly (idle 1.006 … cascade
1.055); the handover's one-line summary flattens it into a band that reads as
"everywhere". It is not everywhere. It is mostly the cascade.

## 3. The handover's second candidate for item 2 is CLOSED — measured

> *"`0fdae8d` proved that a GL buffer one device pixel short of the 2-D canvas
> resamples the composite … confirm the capture geometries were texel-exact when
> the 1.013–1.025 numbers were taken."*

They were. Every manifest records `view.canvas` and `view.gl` per shot. Across
**every capture set on disk that carries both: 1,337 shots in 87 sets, zero
mismatches** — including `art-sphere-step5-certified` (0/21), `s6fix-a/b/c`
(where 1.017–1.032 was taken) and `s7cond2-a/b/c` (where 1.013–1.025 was taken).

The resampling mechanism accounts for **none** of the ink excess. Do not spend
it again. (41 older sets — `art-sphere-step2/3/4/5`, `t5*` — predate the `view`
record and cannot be checked; none of them are the reference or the candidates
for these numbers.)

---

## 4. THE TWO SHADER COMMITS — `dd4bf46` and `e09ad1e`

Both are inert for everything that does not opt in, **by construction and not by
assertion**, and I traced each gate rather than trusting the commit message.

### `dd4bf46` — the disc's mid gradient stop

The collapse is real. A segment carries `vDiscMid = vec4(0)` and `vIsDisc = 0`,
so `hasMid = step(1e-6, vDiscMid.w) * vIsDisc = 0`, so `tg = mix(t, tDisc, 0) = t`,
`gC1 = vC1`, `gC2 = vC2` — bit-for-bit the two-branch ramp it had. A disc with
no mid stop takes the same path. No division by zero anywhere on the dead
branch: `knee = max(vDiscMid.w, 1e-6)` and `max(1.0 - knee, 1e-6)` both guard,
so no NaN can leak through the `mix`. `float r = rG` reuses the radius the
gradient already measured instead of computing a second one — strictly better
than what it replaced.

Measured inert at 1.001–1.003 at the time. Consistent with what I read.

**One cosmetic defect introduced here and still present:** the fragment
shader's `varying float vIsDisc;` lost its two-space indent (`SphereEdges.js`
line 1113, sitting flush-left among indented neighbours). GLSL does not care.
Worth a one-character fix whenever that file is next touched; not worth a commit
of its own.

### `e09ad1e` — the conductor, the 18th float, the blurred disc

The two shader overrides it adds —

```glsl
shadowCol   = mix(shadowCol,   vShadowRGB, vIsDisc);
shadowAlpha = mix(shadowAlpha, 1.0,        vIsDisc);
```

— fire on **every** disc, not just the conductor's. I traced whether that can
reach any other layer. It cannot, and here is the whole chain:

- `shadowCol` and `shadowAlpha` are consumed in exactly two places: `glowSeg`
  and `glowDisc`, both of which are multiplied into `float glow = mix(glowSeg,
  glowDisc, vIsDisc) * step(0.001, vGlow)`, and `botA = glow`. The final
  composites (`col*topA + shadowCol*botA*(1-topA)` and `col*topA +
  shadowCol*botA`) therefore carry `shadowCol` only through `botA`.
- So a disc with `glow = 0` is untouched. I checked every flag constant rather
  than the commit's claim: `BEACON_FLAGS`, `PARTICLE_FLAGS`, `GHOST_FLAGS`,
  `CHIMERA_SYNC_FLAGS`, `CHIMERA_FLICK_FLAGS`, `FUSION_RING_FLAGS`,
  `PROBE_FLAGS`, `CONDUCTOR_FLAGS` — all `packFlags(…, glow = 0)`.
  `CONDUCTOR_GLOW_FLAGS` is the sole exception and is the layer this was for.
- The vertex pad is gated the same way: `discReach = step(0.001, glow) * …`, so
  a glowless disc keeps `pad = halfW + 1.0` exactly.

`packHsl` is sound over its whole domain: max payload 6,605,160 < 2²⁴, every
divisor a power of two, and no field can overflow into the next (hue ≤ 360 <
512, sat ≤ 100, `100 × 512 = 51,200 < 65,536`). Round-tripped over the corners
in a test.

`writeDisc` writes all 18 floats through `EDGE_OFF`/`DISC_OFF` symbols. Good
hygiene, no drift possible.

**The one real latent defect I found in tracked source.** `writePolyline`
(`src/terminal/art/SphereEdges.js:783–795`) writes its fields as **literal
offsets** — `data[o + 14]`, `…15`, `…16`, and the new `data[o + 17] = 0`. Only
the base uses `EDGE_STRIDE`. The float-17 line exists precisely because a stale
value in a reused buffer slot is a real failure, and the same reasoning will
apply to float 18 — which `artNodes`' and `artEdges`' own tests say is coming.
Nothing in the suite would catch its absence: the stride test pins `EDGE_STRIDE`
and `EDGE_OFF` as literals, and no test asserts that `writePolyline` writes
every offset below the stride.

This is the branch's own recurring lesson (`artSmoke`'s `S = 17`, three times
now) — except this copy is inside `src/`, which *is* linted and tested, and the
gate still cannot see it. **Cheap fix, one test:** write a polyline into a buffer
pre-filled with a sentinel and assert every float in `[0, EDGE_STRIDE)` was
overwritten. That converts the next stride bump from a silent visual defect into
a red test. Recommended, not done — no code edited this session.

### Bloom and template strings, since both were asked about

- **Bloom is untouched by every commit on this branch since step 2.** `BLOOM`
  was written once at `2dd8c91` (`luminanceThreshold 0.28`, `intensity 1.1`,
  `radius 0.7`) and has never been modified. `0fdae8d` is the only later commit
  touching `artComposite.js` and it only *adds* `glBufferSettled`. The author's
  "too much bloom in immersive" is a judgement on the original step-2 values,
  not drift. Item 5a stands exactly as written.
- **Template strings are clean.** Backtick counts are even in `SphereEdges.js`
  (372), `SphereComposite.jsx` (50), `artComposite.js` (14) and
  `determinism.mjs` (2); the only backticks on lines inside a `/* glsl */`
  block are the eight block delimiters themselves. And the empirical proof
  beats the grep: `artSmoke` and `_s7probe` both render real frames through
  these shaders in a real browser, so nothing is truncated.

---

## 5. THE TWO RANDOMNESS COMMITS — `7f5f2ce` and `3551885`

### They cannot be a cause of the ink drift, and this is structural

`baseline/art-sphere-step5-certified` was captured at **`3551885`** — i.e. after
both RNG commits. `s6fix-*` and `s7cond2-*` are later still. **Both sides of
every ink ratio in item 2 share the same RNG regime.** The RNG commits predate
the reference and cannot contribute to a ratio measured against it. Closed.

### The fix itself is sound

`artRandom.js` is a clean mulberry32, seeded from `Math.random()` at module load
so production variety is genuinely unchanged; `ART_SEED` is the shim's own
`SEED`, which is why `idle`/`hover`/`mid-drag` hash identically to the pre-change
control. `seedArtRandom(0)` falls back rather than degenerating, and that is
tested. The sweep is complete: **zero** direct `Math.random()` calls remain
anywhere in `src/terminal/art/`, `ArtTab.jsx`, `useSomaGraph.js`,
`useAssociativeField.js` or `useAnalogicalReasoning.js` outside `artRandom.js`'s
own seed line and comments. `determinism.mjs` pins both streams on the same beat,
so `__reseed()` still means what every harness uses it to mean.

Minor, pre-existing, not a regression: `[...occludePool].sort(() => artRandom()
- 0.5)` in `useAnalogicalReasoning.js:480` is not a valid shuffle — an
inconsistent comparator makes the permutation depend on V8's sort algorithm,
which switches on array length. It is deterministic for a fixed engine and a
fixed stream, so it does not threaten reproducibility here. Noted, not a finding.

### Two defects the commit left behind

**a. A stale comment that will mislead the next reader.** `ArtTab.jsx:2283` still
reads *"`beaconIdx` is a third leak of this family — drawn from `Math.random` at
mount, i.e. before the shim is virtual"*. `7f5f2ce` changed that very line:
`ArtTab.jsx:324` now draws it from `artRandom()`. The paragraph's *conclusion*
(leave it alone; re-drawing it inside the reset cost 19/19 → 15/19) is still
correct, but its stated reason is now false, and this branch has been bitten
repeatedly by a mechanism inherited from its own notes.

**b. A real coupling, and it is in the production invariant the commit was
written for.** `beaconIdx` is drawn inside a `useRef({ … })` **initializer**.
React evaluates that object literal on **every render** and discards all but the
first — so **every re-render of `ArtTab` consumes one draw from the sphere's
private stream.** In the harness this is masked: `determinism.mjs` reseeds
`artRandom` at the start of every pumped frame. In production nothing reseeds,
so the artwork's world advances by React's render count — a tooltip, a HUD tick,
a peer-presence update, the immersive toggle. That is precisely the property
`artRandom.js`'s header claims to have established:

> *"the world now depends only on the simulation and its seed, and not on when
> the GPU layer happened to allocate an object. For an install that has to run
> unattended for months, that is worth having on its own terms."*

The GPU no longer displaces the stream; React does. Magnitude is sufficient by
the branch's own measurement — task 1 recorded that **one** displaced beacon
draw took `artPresence` from 19/19 to 15/19. Two-line fix (hoist the draw, or
use a lazy initializer), but it changes the world and therefore every reference,
so it is a decision, not a tidy-up. **Not done.**

---

## 6. A LEAD FOR ITEM 1 — stated as a hypothesis, NOT measured

Item 1 was explicitly out of scope this session and I did not run a capture. But
the audit walked into a mechanism that is not on the handover's list of
considered causes and fits its evidence, so it is recorded rather than lost.

`ArtTab.jsx:786–805` — the `ResizeObserver` callback ends with **`initState()`**.
`initState` (`useSomaGraph.js:74`) re-scatters all 31 nodes, consuming **four
`artRandom()` draws per node — 124 draws — and writing an entirely new layout**.
This code is byte-identical on `main`; it is inherited, not introduced here.

So **every immersive toggle re-scatters the graph**, in both directions, from
whatever offset the stream happens to be at. And that callback is a real browser
task: it can only land across a yield, never inside `__pump`.

The capture sequence makes the two immersive states structurally asymmetric
(`artBaseline.mjs:717–733`):

```
__reseed(); __artHarnessReset();     <-- pins the stream AND calls initState()
pump(240); hover(away); settle(); pump(30)
click Immersive;  deliverResize('immersive-on');   pump(749);  shot   <-- reset was 270 frames ago
pump(600)
click Immersive;  deliverResize('immersive-off');  pump(749);  shot   <-- NO reset, 1349 frames later
```

`immersive-on` gets a freshly pinned world 270 frames earlier. `immersive-off`
inherits 1,349 frames of stochastic evolution and then takes a second out-of-band
`initState()`. If the observer fires **once or twice** — a layout/scheduling
detail, not a simulation one — the node layout is completely different, not
perturbed. That is exactly the signature the handover reports and cannot
explain: *"at the projector scale one set drew 121 edges against 123. A
genuinely different graph, so the divergence happens BEFORE the edge set is
decided."* It also explains why `immersive-on` is bit-identical across all three
sets while `immersive-off` alone diverges.

It does **not** explain the second failure — 2x, identical edge count (134),
three distinct world hashes. The handover is right that those are two failures.

Corroboration already in the record, unread at the time: post-step-5 task 3
found `_t9trace` reporting the world bit-identical for 1,740 frames with **only
`rnd`, the stream offset, differing** — and called it *"a dead end and in fact
the answer, unread."*

**The cheap test, before any capture:** add a dev-only counter publishing
`initState`'s call count and the stream offset at entry; run three immersive
captures; compare the log at the `immersive-off` `deliverResize`. If the call
count or the entry offset differs between sets, the divergence is located and
the fix is small (pin the stream around the observer's `initState`, or stop the
observer re-initialising the world on a pure resize). One run of `_t9trace`
costs a minute against a capture's four.

---

## 7. ITEM 3 — the spoke's 1.098 is more expensive to discharge than it reads

Two things the handover does not say.

**a. `artPresence`'s spoke check cannot gate it, and the reason is circular.**
The handover says the two are "a different measurement". The *statistic* is in
fact the same construction — band-excess in luminance 0–255, from the same
method (`scripts/_prismMeasure.mjs`). Step 4 task 6's table reads GL 25.25/25.36
against 2-D 22.89/23.21 → 1.098; `artPresence` reads 25.03–25.08 today. Same
number, same scale.

What differs is the **comparison**, and that is the problem. `artPresence`
compares the GL excess against an absolute threshold of **19.5**, whose stated
derivation is *"19.5 sits 25% under the live figure"* — where "the live figure"
is 26.0, the GL value under dispute. **The gate is calibrated on the number it
would have to judge.** If the GL spoke is 9.8% bright, so is its threshold.
`artPresence` passing 19/19 has never been, and can never be, evidence that the
1.098 is gone.

**b. There is no 2-D oracle left, so it cannot be re-measured from HEAD.**
`drawConductor` is the only 2-D layer function kept in the source. The 2-D prism
path was deleted when it moved to GL. Re-measuring 1.098 needs a **second
worktree at `cbf22f1`** (the last commit before `1174991` put the prism on the
GPU) plus the hybrid arrangement task 6 used — not just running an instrument at
HEAD. That is a real cost and should be put to the author before it is spent.

**c. A sweep hazard, and it is urgent for item 4's second half.**
`scripts/_prismMeasure.mjs` and `scripts/_nullPatch.mjs` are the **only**
instruments that can produce either half of the 1.098, and **neither is in the
handover's keep-list.** Sweeping the 77 `scripts/_*` files as written would
destroy the only means of discharging item 3. Add both to the keep-list before
the sweep.

Separately, `_nullPatch.mjs` **writes to `src/terminal/art/SphereEdges.js`** — a
scratch instrument that mutates tracked source and leaves a `discard` in the
shader if the session running it dies. The tree is clean now (checked), but that
is a trap worth a line in its own header and in the handover.

---

## 8. One instrument defect worth fixing before the next capture

Every manifest on disk records

```json
"renderer": "headless chrome --headless=new --enable-unsafe-swiftshader (software GL)"
```

That string is **hardcoded in `artBaseline.mjs`**, not probed. The handover
states the opposite and is right: *"Headless Chrome here uses the real NVIDIA
ANGLE/D3D11 driver, not SwiftShader … Confirm with `WEBGL_debug_renderer_info`
rather than assuming either way."* Every set on disk therefore carries a false
statement about its own renderer, in the field a future session would read to
answer exactly that question. Replace it with the actual
`WEBGL_debug_renderer_info` string.

> **DONE, and the answer settles it.** `artBaseline` now probes the composite's
> existing GL context — last, after every shot, so the extra `page.eval`'s yield
> cannot move a picture — and records the result per scale and once at the top.
> One scale captured to verify:
>
> ```
> ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Ti (0x00002782) Direct3D11 vs_5_0 ps_5_0, D3D11)
> vendor  Google Inc. (NVIDIA)      WEBGL_debug_renderer_info  exposed
> masked  WebKit WebGL / WebKit     version  WebGL 2.0 (OpenGL ES 3.0 Chromium)
> ```
>
> **Real hardware. The hardcoded SwiftShader string was false for every set on
> disk**, and the masked values (`WebKit WebGL`) are exactly as useless as the
> handover implies, which is why the unmasked extension is the only answer worth
> recording. `launchFlags` now carries the command line separately, as a fact
> about how Chrome was started and not a claim about what drew.
>
> That verification run also re-measured the world at laptop@1x: **all seven
> world hashes and edge counts identical to `s7cond2-a`**, `immersive-off`
> included (`ff08bd06` / 134). So `7861912`, `0fdae8d` and this change leave the
> world untouched at that scale — one run, not a certificate, but it is the first
> `immersive-off` agreement anyone has recorded since step 7.

**A gap this exposed, not yet fixed:** `gitCommit` is `null` in every manifest on
disk. It is read from `process.env.BASELINE_COMMIT`, which nothing sets. So no
capture set records which build it is — "same build" is inferred from timestamps
and the world hash. `artInk`'s new floor checks the world hash per cell for that
reason and marks a mixed-world group with `?`, but the real fix is to have
`artBaseline` read `git rev-parse HEAD` itself.

---

## WHAT WAS DONE AFTER THIS AUDIT, and what was not

Done in the same session, gates green after each (`vitest 1279/115`, `lint 0
errors / 145 warnings`):

1. **The `writePolyline` stride test** — `artEdges.test.js`. Fills the buffer
   with a `-9999` sentinel, writes a 3-segment polyline, and names every offset
   in `[0, EDGE_STRIDE)` that survived. A sentinel and not zero, because the
   buffer is born zeroed and float 17 is written zero *on purpose* — zero cannot
   tell those two apart. It carries a positive control (the sentinel must still
   be readable in the instance nobody wrote) and it was **proven to catch the
   defect**: with `data[o + 17] = 0` commented out it fails naming `instance 0
   float 17`, `instance 1 float 17`, `instance 2 float 17`, and passes with it
   restored.
2. **`_prismMeasure` and `_nullPatch` added to the handover's keep-list**, with
   the source-mutation warning and the `node scripts/_nullPatch.mjs off` revert.
3. **`artBaseline` probes the renderer** (above).
4. **`artInk` carries a same-build floor** — §1's recommendation, implemented.
   Replicates come from `repro.dirs`, which `artNull` already stamps, so no new
   captures were needed; the floor is the worst |ratio−1| over every same-build
   pair in both directions, per (scale, state, region), and the worse of the two
   sides is the one applied. New `floor` and `read` columns, a floor on each
   mode rollup, and a tally. Verified against a hand computation (laptop@1x
   `immersive-on`, candidate side: sets b-vs-c give 1.030, and the tool prints
   ±0.030) and against the file's own validation — a set compared with itself
   reads 1.000 on every row and **0 SIGNAL / 42 noise**.

Not done, and still open:

- Committed on `fix/art-sphere-index-space` and **NOT pushed**. Nothing merged,
  `main` untouched at `a54ea3e`. A push needs a new explicit command.
- Item 1 not attempted. §6 is a lead, not a result.
- 12 of the ~20 commits item 4 names remain unreviewed (list at the top).
- The sweep is **DONE** (2026-09-18): 77 baseline sets, 35 instruments and one
  stray file removed, 342.8 MB; 90 sets and 38 instruments kept, `_prismMeasure`
  and `_nullPatch` among them. The keep set was derived from the records, and
  three rules had to be added on the way — stem matching, series integrity, and
  `repro.dirs` awareness. Details in the ledger, `item4-audit-report.md` §9.
- §5a's stale `beaconIdx` comment and §5b's per-render draw — both untouched;
  §5b changes the world and is the author's call, not a tidy-up.
- §4's flush-left `varying float vIsDisc;` — left alone rather than spend a
  commit on whitespace in a shader.
- `gitCommit` still null in the manifest (above).

## RECOMMENDED ORDER, for the author to decide

1. **Give `artInk` a same-build floor** (§1). It is the cheapest change with the
   largest effect on what the branch believes, and item 2 cannot be read until
   it exists.
2. **The `writePolyline` stride test** (§4). One test, catches the next bump.
3. **Correct the record** — the stale `beaconIdx` comment (§5a), the
   "flips sign in immersive" line (§2a), the manifest's renderer string (§8).
4. **Add `_prismMeasure` and `_nullPatch` to the keep-list** (§7c) before any
   sweep.
5. **The `initState` counter** (§6) — one dev-only counter, then three captures,
   before anything else is tried on item 1.
6. `beaconIdx`'s per-render draw (§5b) is a decision, not a fix: it changes the
   world and therefore every reference.

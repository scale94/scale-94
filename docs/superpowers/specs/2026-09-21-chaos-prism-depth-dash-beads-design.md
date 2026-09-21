# CHAOS sphere — prism depth, root taper, and dash beads

**Date:** 2026-09-21
**Branch:** `feature/chaos-prism-depth-dash-beads`, off `main` at `09e86f44`
**Status:** approved, ready for a plan

Three defects reported by the author against the live sphere, diagnosed against
running code rather than the screenshot alone.

---

## 0. What was measured, before anything was designed

All figures from the live dev build at `09e86f44`, 1366×580 canvas, dpr 1.

| question | answer | how |
|---|---|---|
| strokes converging on one node centre, 11-node effect | **140** | `10 pairs × 7 spectral lines × 2 passes` |
| endpoints inside one 2×2px cell, live | **60** | clustering `additive.instances` endpoints on a 2px grid |
| mean endpoints per occupied cell | **5.3** | 7664 endpoints / 1438 cells |
| additive instances dropped | **0** | `__artEdgeState().additive.dropped`, every frame sampled |
| additive capacity | **81 882** | `MAX_ADDITIVE_EDGES`, sized for the provable worst case |
| endpoint load symmetry | **60/60/45/45/45/45** | top six cells — no hub asymmetry |

### Three explanations killed by those numbers

- **Buffer overflow.** `dropped` is 0 and the buffer is sized for four concurrent
  eleven-node effects. The tail is not being clipped.
- **Unconverged endpoints.** Both ends already terminate on the node centre
  (`x0 = pA.sx`, `x1 = pB.sx`), shipped last session. At low envelope alpha the
  bundles are visibly closed at both ends.
- **Energy dividing 10:1 between root and tails.** The prism draws ALL PAIRS, so
  every node in an effect is an endpoint of the same number of bundles. Measured
  symmetric. This was the author's own hypothesis and mine; the data refused it.

---

## 1. Root cause of items 1 and 2: one missing mechanism

### 1a. The prism is the only layer with no depth term

| layer | depth term | site |
|---|---|---|
| base edges | `avgDepth` | `ArtTab.jsx:1472` |
| node discs | `depthCueAlpha(p.depth)` | `ArtTab.jsx:1897` |
| analogy filaments | `avgDepth` | `ArtTab.jsx:1303` |
| **prism chords** | **none** | `ArtTab.jsx:1729–1855` |

`alpha = alphaRaw * (eff.intensity ?? 1.0)` and nothing else. A chord whose
destination node is on the far side of the sphere therefore arrives at FULL
envelope alpha onto a disc that `depthCueAlpha` has cued down toward its floor of
`0.08`. That is the "ungrounded solar flare": energy delivered to a point where
nothing visible is receiving it.

The same fact drives the root bleed — a full-alpha bundle will always swallow a
depth-cued disc.

### 1b. The taper shipped last session is structurally blind to this layer

`EDGE_TAPER_PX` multiplies the **shader glow** term in `edgeFrag`. The prism
packs `PRISM_FLAGS = packFlags(0, 0, 0, false, ADDITIVE_LAYER.glowQuant)` —
**glow = 0**. The prism's "glow" is not a shader shoulder at all; it is a literal
second, wider stroke (`prismGlowWidth(k)` = 5.0 down to 2.6px) drawn over a
1.2px core. Do not attempt to reuse the existing taper here. It cannot fire.

### 1c. The mechanism both defects need

A chord is ALREADY tessellated into up to `CURVE_MAX_SEGMENTS = 24` separate
instances, and `edgeFrag` ALREADY interpolates a three-stop alpha along each
segment (`a = mix(vAlpha.x, vAlpha.y, u)` / `mix(vAlpha.y, vAlpha.z, u)`).
What is missing is only the plumbing to vary alpha per segment:
`writePolyline` computes `packAlphas(alpha, alpha, alpha)` ONCE, outside its
loop, and writes that one value to every instance.

Add per-segment alpha and both defects are addressable with **zero extra
instances**. `EDGE_STRIDE` STAYS 18. No task in this spec may widen the layout.

`writePolyline` also already accumulates arc length per segment for the dash
phase (`phase += Math.hypot(...)`). The root taper needs arc length from each
end. Reuse that accumulation; do not compute a second one that could drift.

---

## 2. §1 — Per-segment alpha plumbing

Extend the EXISTING function rather than adding a second one. This file's own
header records that it "already lost a task to two implementations of one dash
pattern"; a parallel `writePolylineRamped` would be that mistake again.

```js
export function writePolyline(state, pts, m, rgb, alpha, width, flags,
                              phase0 = 0, alphas = null)
```

- `alphas === null` → today's path exactly, including hoisting
  `packAlphas(alpha, alpha, alpha)` out of the loop. Byte-for-byte unchanged.
- `alphas` non-null → a `Float32Array` of **per-POINT** alphas, length ≥ `m`.
  Segment `i` packs `packAlphas(alphas[i], (alphas[i] + alphas[i+1]) / 2, alphas[i+1])`.

**Per-point, not per-segment, and that is load-bearing.** It makes segment `i`'s
end stop equal segment `i+1`'s start stop BY CONSTRUCTION, so the ramp is C0
across every joint. A per-segment array would produce a visible 24-step
staircase at exactly the joints the dash phase was built to hide.

**Approximation, stated rather than hidden.** The shipped alpha is the product of
a depth ramp (linear in arc length) and a taper ramp (linear in arc length), so
the true curve is QUADRATIC while the reconstruction is two linear halves per
segment. Error over one segment is bounded by `|f''| h² / 8`; with 24 segments on
a chord this is far below the `1/255` quantisation `packAlphas` imposes anyway.
Do not "fix" this by sampling the midpoint separately without measuring first.

**Quantisation caveat, real and worth watching.** `packAlphas` quantises to
`1/255`. A back-side glow-pass segment can reach
`0.5 × PRISM_ALPHA_K 0.85 × PRISM_GLOW_ALPHA_K 0.4 × cue 0.08 ≈ 0.0136`,
i.e. `3/255`. Back chords will band. If banding is visible, the answer is NOT a
wider instance — it is raising `DEPTH_ALPHA_FLOOR` for this layer only, and that
is an author call, not an implementer call.

### Scratch

One preallocated `Float32Array(CURVE_MAX_SEGMENTS + 1)` beside `prismPtsRef`,
`prismCtrlRef`, `prismRgbRef`. The draw loop must not allocate.

---

## 3. §2 — Depth cue on the prism

```js
export const PRISM_DEPTH_ALPHA_FLOOR = 0.24;

/** One node's prism-layer depth cue. */
export function prismDepthCue(depth) {
  return Math.max(PRISM_DEPTH_ALPHA_FLOOR, depthCueAlpha(depth));
}

/** Envelope multiplier at arc-length fraction t (0 at A, 1 at B). */
export function prismChordCue(depthA, depthB, t) {
  const cA = prismDepthCue(depthA);
  const cB = prismDepthCue(depthB);
  return cA + (cB - cA) * t;
}
```

### AMENDED AFTER TASK 2, ON THE AUTHOR'S RULING

The first shipped version used `depthCueAlpha` directly, at the disc floor of
`0.08`. In the browser the fan read as gutted rather than quieter, and the
author ruled the prism off the disc floor: **`PRISM_DEPTH_ALPHA_FLOOR = 0.24`**.

**The binding constraint is quantisation, not the bloom gate.** Falling under
the composer's `0.28 luminanceThreshold` only costs a stroke its BLOOM; it
still renders. What actually kills a back chord is `packAlphas`' `1/255`: at
the disc floor a back-side glow-pass segment computes
`0.5 × 0.85 × 0.4 × 0.08 = 0.0136` — **3/255**, which bands across a 2.6–5px
stroke. At `0.24` it is 10/255 and the core pass is 26/255.

A disc is a solid 14–20px shape; a chord is a 1.2px core on an ADDITIVE layer.
Equal alpha is not equal visibility when the footprints differ by about two
orders of magnitude.

**Two consequences, both deliberate.** The clamp now engages at `depth < -0.52`
rather than `-0.84`, so the back QUARTER of the depth range is flat — no depth
discrimination there — and front-to-back contrast falls from 12.5:1 to 4.17:1.

**And it retires the invariant that justified interpolating cues.** The
paragraph below said interpolating cues makes each end match the disc it lands
on EXACTLY. That is no longer true: a back-facing chord end is now 3× its own
disc, by design. The reason to interpolate cues rather than depths still
stands — a clamp does not commute with a lerp — but the justification is now
perceptual matching, not numerical equality. The source comment was rewritten
to say so.

`t` is **arc length from A divided by total arc length**, not the Bézier
parameter. The two differ on a bowed chord and arc length is the one that
matches what the eye reads as distance travelled.

Interpolate the **cue**, not the depth. The cue is linear in depth except where
its floor clamps, and a clamp does not commute with a lerp — on a chord from
depth −1 to +1 the midpoint is 0.62 one way and 0.50 the other. (Superseded in
part by the amendment above: the end no longer equals the DISC's cue.)

Applies to BOTH passes (glow and core) and to the polygon and spokes as well —
they are the same layer and the same inconsistency. Spokes run from the sphere
centre to a node; use `prismDepthCue(0)` at the centre end.

---

## 4. §3 — Root taper on the wide pass

```js
export const PRISM_ROOT_TAPER_PX = 14;   // matches EDGE_TAPER_PX, deliberately

export function prismRootTaper(sFromA, totalLen) {
  if (!(totalLen > 1e-6)) return 1;
  const L = Math.min(PRISM_ROOT_TAPER_PX, totalLen / 3);
  if (!(L > 1e-6)) return 1;
  const d = Math.min(sFromA, totalLen - sFromA);
  return Math.min(1, d / L);
}
```

- **`totalLen / 3` is a guard, not a taste knob.** Without it a short chord
  between two nearby nodes tapers from both ends and vanishes in the middle.
- **Applied to the WIDE pass only.** The 1.2px core lands on the exact node
  origin at full cued alpha. This is the author's explicit ruling and matches
  the base-edge ruling from last session ("taper the glow, keep the thread").
- The degenerate `totalLen === 0` case returns 1 — coincident nodes produce
  zero-length segments that deposit no ink anyway.

### The limit, stated up front

The wide pass carries roughly **56%** of the root ink
(`glow 0.4 × ~3.8px ≈ 1.52` against `core 1.0 × 1.2px = 1.2`). Tapering it
removes that share, and the depth cue removes more. **70 core strokes still
converge on the centre** in an 11-node effect.

**Ruling already given: do not touch the core pass in this spec.** Ship §1–§3,
measure the post-taper root under live additive accumulation, and only if the
disc boundary still blows to pure white bring a secondary core attenuation back
to the author as a separate decision.

---

## 5. §4 — Dash antialiasing

Today: `core *= step(mod(dashPos, vDash.x), vDash.y)`. A hard binary cut. The
line's sides and caps ARE box-filtered; only the dash boundary is not.

```glsl
// P IS GUARDED, AND THE GUARD IS LOAD-BEARING — see the NaN note below.
float P  = max(vDash.x, 1e-3);
float D  = vDash.y;
float m  = mod(dashPos, P);
// Signed distance to the on-interval, periodic. Positive inside a dash.
float sd = (m < D) ? min(m, D - m) : -min(m - D, P - m);
float dashMask = clamp(sd / dpxDash + 0.5, 0.0, 1.0);
```

with, in the top block beside `pxD` and `pxA`:

```glsl
float dpxDash = max(length(vec2(dFdx(dashPos), dFdy(dashPos))), 1e-6);
```

### The NaN hazard this introduces, and its guard

Today `mod(dashPos, vDash.x)` runs ONLY inside `if (vDash.x > 0.0)`. Hoisting it
to uniform flow for the derivative means it now runs on **every instance**,
including the solid ones that pack `dashPeriod = 0` — the prism packs exactly
that. `mod(x, 0.0)` is a division by zero and produces NaN or an
implementation-defined value.

A NaN here does not stay local. This file already documents the mechanism:
`mix(x, NaN, 0.0)` is NaN, not `x`, because the spec expands `mix` to
`x*(1-a) + y*a` and `NaN * 0` is NaN. A solid prism chord would inherit it
through the very `mix`/`step` collapse that keeps the branch count down, and
the whole additive layer would go black or white depending on the driver.

`max(vDash.x, 1e-3)` costs one ALU op and removes the class entirely. The
existing `if (vDash.x > 0.0)` still decides whether the mask is APPLIED; the
guard only keeps the arithmetic finite when it is not.

- **Box filter, NOT smoothstep**, and this is not a style preference. This
  file's own comment records that a smoothstep shoulder spreads a 1px line over
  1.5px and the parity gate reads it as a one-sided brightening. The box form
  integrates to the true duty cycle, so the antialiasing is ink-neutral by
  construction.
- **Both edges.** A naive one-sided filter antialiases the falling edge at `D`
  and leaves the rising edge at the wrap hard. The signed-distance form above
  handles both because `mod` discontinuity is absorbed into the `m ≥ D` branch.
- **Foreshortening.** When a chord rotates near edge-on, `dpxDash` grows. As
  `dpxDash → P` the mask converges to a constant `D/P` grey rather than
  aliasing against the pixel grid. This is believed to be the real source of the
  reported "varying dot lengths" — the pattern is currently beating against the
  raster. Verify it before claiming it fixed.

### Derivative placement — a hard implementation constraint

`edgeFrag` takes `pxD` and `pxA` in the FIRST two statements of `main()`,
with a comment that derivatives are undefined inside non-uniform control flow
and there are branches below. `dashPos` must be computed and differentiated in
that same top block, unconditionally, BEFORE `if (vDash.x > 0.0)`.

`dashPos` depends on `vPhase`, `t`, `vLen`, `rMid` and `ang`. All are
computable in uniform flow. `ang` carries the `atan(0,0)` guard
(`+ step(r, 1e-6)`) — that guard must move WITH it, not be left behind. Moving
`ang` earlier must not change its value; assert that.

---

## 6. §5 — Dash beads (orthogonal bridges only)

The reported "zero photon density" is half right and the wrong half is the
useful one. Ortho edges DO carry a glow: `orthoGlow(now)` = `10 ± 4px` with the
opaque `isOrtho` shadow colour. **But it is not gated by the dash.** `glowSeg`
is computed from segment distance alone, so there is a continuous 6–14px haze
along the whole chord with hard chips of core punched on top. That is what makes
them read as flat 2D overlays.

The bead falls out of the same `sd` the antialiasing computes:

```glsl
float dDash = max(0.0, -sd);                 // 0 inside a dash, grows in a gap
float beadGate = vIsOrtho * step(0.001, vDash.x) * (1.0 - vIsDisc);
float dOut = max(max(-vAlong, vAlong - vLen), dDash * beadGate);
```

Inside a dash `dDash` is 0 and nothing changes. In a gap it grows, so the
existing gaussian `exp(-2(d/g)²)` gives each dash a real blurred envelope and
neighbouring halos overlap softly — which is what a blurred dashed line
physically looks like, and the same approximation this file already makes for
segment ends.

### Two gates, both load-bearing

- **`vIsOrtho`.** Spectral bridges keep their continuous halo across their own
  gaps. That is an explicit author ruling from last session — "the 1-2%
  atmospheric bridge visually grounds them" — and it was made about spectral
  bridges at 1–2% alpha, not about ortho at `isOrtho` opacity. The ruling
  stands where it was made.
- **`(1.0 - vIsDisc)`.** Pulse rings are DASHED DISCS (`EDGE_FRAG` has a whole
  `rMid * ang` branch for them). They are not ortho bridges and must not grow
  beads. Without this gate a ring's halo would be chopped into arcs.

---

## 7. Risk being tracked: bloom

Gating the ortho halo REMOVES light from the gaps, and ortho is the brightest
halo family on the sphere. This can move `hot` pixel count against the
composer's `0.28` luminanceThreshold.

- Measure ink / lit / ink-per-lit / hot, both modes, before and after, with the
  same-build A/B method `scripts/_a9lens.mjs` established: hold the original
  bytes IN MEMORY, patch a constant in tracked source, shoot, restore, compare
  at a matched frame index. **Never `git checkout -- <file>` to restore** — it
  restores to the last COMMIT, not to pre-patch bytes, and it destroyed an
  in-progress edit last session.
- New instrument: `scripts/_a10dash.mjs`.
- **`BLOOM.intensity`, `BLOOM.levels`, `BLOOM.luminanceThreshold` and
  `KNEE.knee` are OFF LIMITS.** If the numbers say the bloom moved, bring the
  numbers to the author. Do not turn a dial.

---

## 8. Testing discipline

Three traps this project has already paid for. All three are in scope here
because every law in this spec has a limit or a degenerate case.

1. **The vacuous property test — this would be its FOURTH appearance.** Last
   session `toBeCloseTo(1, 6)` on an asymptote passed with the mechanism
   DELETED. Every no-op assertion in §1 must be PAIRED with a positive
   assertion that the mechanism is live: asserting "constant `alphas` reproduces
   the scalar path byte-for-byte" passes trivially if `alphas` is ignored
   entirely. **For each law, delete the mechanism and confirm the test FAILS.**
   State in the task report that this was done.
2. **Float32 precision.** `toBeCloseTo(_, 9)` is unsatisfiable — it demands
   5e-10 where one float32 ULP near 0.06 is 3.725e-9. Precision 7 is the
   working ceiling.
3. **Never edit tracked source while an `artBaseline` / `artCompare` capture is
   running.** Vite HMRs the edit into the page mid-run and the tell is two
   different `gitCommit` stamps across the manifests.

Shader changes cannot be unit tested. Cover them with instance-buffer
assertions (per-segment alphas ramp monotonically toward each end; a dashed
ortho instance and a dashed spectral instance differ in exactly the gated term)
plus the browser measurement in §7.

---

## 9. Sequence

| # | task | visual change | gate |
|---|---|---|---|
| 1 | per-segment alpha plumbing | **none — bit-identical** | byte-compare both paths, AND prove a non-constant ramp differs |
| 2 | depth cue on the prism | yes | unit tests on `prismDepthCue` |
| 3 | root taper on the wide pass | yes | unit tests on `prismRootTaper`, incl. the `/3` clamp and `totalLen = 0` |
| 4 | dash antialiasing | yes | `ang` value unchanged after the move; ink-neutrality measured |
| 5 | dash beads, ortho only | yes | ring and spectral instances provably untouched |
| 6 | measure, author looks, re-cut the reference | — | `BASELINE_COMMIT` MUST be set or the reference stamps `gitCommit: null` |

Task 1 being a provable no-op is the safety property of the whole sequence: it
separates "the plumbing is wrong" from "the law is wrong".

## 10. Constraints in force

- **Do not merge. Do not push.** Verification approval is not push consent.
- **Never run vitest with `-u` / `--update`.**
- Each task commits only its own named files — **never `git add -A`**.
- **`EDGE_STRIDE` stays 18.** No task may widen the instance layout.
- The bloom dial is off limits; see §7.

## 11. Out of scope, deliberately

- The analogy filaments. They draw **0 of 96** because `fil.nodeA/nodeB` are
  corpus indices (272 nodes) tested against the sphere's ~31. Pre-existing,
  measured, documented at the call site. Repairing it would make an invisible
  layer appear — a visual change, not a fix, and its own decision.
- Any change to the core pass at the root. See "The limit, stated up front" in
  section 4 (§3 — Root taper): the author's ruling is to measure first.
- The disc↔streak threshold discontinuity (~38× ink jump) carried over from the
  previous branch. Still unruled.

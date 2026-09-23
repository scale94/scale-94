# /SCENT — Stereochemical Collider

Date: 2026-09-24
Status: design approved section by section, awaiting written-spec review
Branch: `feature/scent-stereochemical-collider` (from `main` @ `11e7dd8d`)
Supersedes: the rendering sections (§5) of `2026-07-28-scent-collider-gl-design.md`

Replaces what the collision chamber *draws*. The phase graph, the durations, the
props contract and everything outside `src/terminal/collider/` stay as they are,
apart from two new props.

---

## 1. What exists today, and what is actually wrong with it

The chamber (`collider/ColliderChamber.jsx`) is two GL passes on the shared
harness: an analytic field shader over glHost's quad, then 4096 stateless
`gl.POINTS` whose motion is closed-form in the vertex shader
(`particleShader.js`) from a 4-float seed plus elapsed time.

**The "inverted vector" is not caused by the helix.** The helix radius already
tightens toward the core (`pow(1.0 - s, 1.7)`, `particleShader.js:84`). What
makes the core bloom is three other things:

1. the curl turbulence amplitude is `2.0 + 9.0 * s * uEase`, so it grows toward
   the core and with acceleration;
2. sprite size grows with `uEase`;
3. the primitive is a soft round sprite, which cannot draw a 1px line.

**A second defect in the same code:** `s = fract(birth + uPhaseT * speed)`,
with `speed` a function of `uEase(t)`. Position is speed × time rather than the
integral of speed, so the effective velocity is `speed + t·speed'`. At T−0 that
is `≈2.2 + 1.8·1.6·(3/1.8) ≈ 7.0` against an authored ≈2.2: the streams arrive
at roughly three times their intended speed.

**The post-impact image** is a radial spark burst, a cross-shaped debris jet, a
chimera orbit ring, and amber rising vapor. The author reads this as
combustion / cartoon sulfur.

**Zero-allocation guardrail is already broken:** `phaseTiming()` returns a new
object every frame (`{ ...INERT, progress, ease }`).

---

## 2. Non-goals

- No change to the phase graph or the durations: `ACCELERATE_MS = 1800`,
  `COLLIDE_MS = 2500`, and `usePhaseAdvance` remains the only clock-driven
  transition.
- No change to the DOM overlay (labels, novelty bar, cos θ / θ readouts).
- No change to `LatentCollider.jsx` beyond computing and passing `massA` /
  `massB` (§8).
- No change to `src/terminal/gl/` (glHost, frameLoop, useShaderCanvas).
- **No change to the chamber background.** `bg-black/60` is part of the visual
  identity (author's ruling). Wherever this spec says something fades to black,
  it means *to zero emission and zero coverage*. The canvas becomes fully
  transparent over the existing background.
- No redesign of idle / selecting. The ambient drift keeps its behaviour and
  only changes primitive (§4.2).
- No new dependencies.

---

## 3. Light budget: accumulate in half-float, then apply a max-channel knee

Author requirement: overlapping ribbons must not blow the core out into a solid
white blob.

**This reverses the July design on purpose.** 2026-07-28 §5.2 rejected an
offscreen target and relied on additive saturation to white as free bloom. That
look is now ruled against.

### 3.1 Why a knee alone is not enough

The /art sphere work (`project_art_bloom_knee`) established that an RGBA8
target clamps at 255 *inside the blend unit*. No shader after that can recover
the colour. The ribbons have to sum above 1.0 without clipping first.

### 3.2 Pipeline

1. Bind `accum`, an RGBA16F texture at the canvas's backing size, and clear it
   to 0.
2. Draw the field pass, then the streak pass, then the cage pass into it, all
   with additive blending `(ONE, ONE)`.
3. Bind the default framebuffer and run the **composite pass** (blend
   disabled), a fullscreen quad sampling `accum`:
   - `m = max(rgb)`. If `m > knee`, scale rgb by `f(m)/m` with
     `f = knee + s·t/(t+s)`, `t = m − knee`, `s = 1 − knee`, **`knee = 0.6`**.
     This is identity below the knee and approaches 1.0 asymptotically.
   - It compresses by the max channel, not luminance, so a saturated core
     stays its own hue (a luminance scale leaves `(6,0,0)` clipping).
   - Output is premultiplied: `rgb` as above,
     `alpha = clamp(max(max(rgb), accum.a), 0, 1)`. `accum.a` carries only the
     Schlieren shadow coverage (§6.3). The colour passes write alpha 0.

The accumulator is **cleared every frame**. It is not a feedback or trail
buffer, so every frame remains a pure function of (seeds, props, elapsed).

### 3.3 Capability and fallback

- An RGBA16F render target needs `EXT_color_buffer_float`, checked once in
  `onInit`. Blending into half-float needs nothing further. Only 32F would
  need `EXT_float_blend`, and this spec does not use it.
- **Fallback, when the extension is absent:** draw every pass straight into the
  default framebuffer with screen blending `(ONE, ONE_MINUS_SRC_COLOR)`.
  - The result approaches white smoothly and never hits a hard plateau.
  - Schlieren shadow lobes are skipped, so the rings are bright-only.
  - `data-chamber-accum="half-float" | "screen"` on the wrapper records which
    path ran.
- The existing no-WebGL2 gradient fallback is unchanged.

### 3.4 Known limit, stated honestly

The knee prevents *clipping plateaus*. It cannot stop **complementary hues
from adding up to neutral**: red plus cyan at equal strength is `(1,1,1)`
before any curve.

Mitigations are structural:

- At the core the pinched beams are sub-pixel, so they overlap over very little
  area.
- Cross-half cage bonds use a *hue-space* blend of the two hues, not a sum of
  their RGB.

This must be checked by eye on a near-complementary pair, e.g. FEIGEN (hue 0)
× GRAPHN (hue 170).

---

## 4. Primitive: instanced streak segments

`gl.POINTS` is retired from the chamber. Every piece of matter is a
**screen-space segment expanded into a ribbon**:

- `drawArraysInstanced(TRIANGLE_STRIP, 0, 4, N)`, with the four corners taken
  from `gl_VertexID`.
- Per-instance attributes use `vertexAttribDivisor(…, 1)`.
- The vertex shader computes a head position `p(t)` and a tail position
  `p(t − τ)`, and pushes the corners out along the segment's normal by
  `halfWidth + 1 device px` of anti-aliasing margin.
- The fragment shader computes coverage analytically from the distance to the
  segment. This gives a correct 1-device-px anti-aliased edge at any width,
  including widths below 1px, where alpha scales with width instead of the
  line breaking into beads.
- Widths are authored in CSS px and converted with `uPx` (device px per CSS
  px). This is the lesson from the `gl_PointSize` trap, applied to ribbons.
- Taper: `alpha *= mix(tailAlpha, 1, u)` along the segment, where `u` runs
  from 0 at the tail to 1 at the head, so a needle has a bright head and a
  zero-width tail.

### 4.1 Seed dimensions

The seed buffer (`particleSeeds.js`, 4096 × `lane, birth, h1, h2`) is kept.

**Any additional per-instance random value comes from an in-shader integer hash
of `gl_InstanceID`,** never from `fract(h * k)` of an existing component.
That would be trap 2 (one seed component driving two spatial degrees of
freedom, which collapses the population to a 1-D locus).

### 4.2 Idle / selecting

Same drift, speed and gating as today (`step(0.94, h1) * 0.35`). The only
change is the primitive: each particle becomes a short, faint streak.

---

## 5. Ingress: the pinch (phase `accelerating`, 0–1800 ms)

### 5.1 Mass

`collider/domainMass.js`:

```
raw(f)  = f[11] − f[4]              // weight − volatility
mass(d) = rank of raw(FEATURES[node(d)]) among all collider domains / (n − 1)
```

- Ties get the average rank.
- The result is in [0,1], deterministic, and computed once at module load.
- Rank normalisation is required because the raw values skew volatile (mean
  `f[4]` = 0.35, mean `f[11]` = 0.19 over the 272 feature rows). Without it,
  nearly every domain would braid.
- Every domain id has a `DOMAIN_SPHERE_MAP` entry, so mass is available at
  selection time, before `collide()` resolves.
- An unselected side uses 0.5.

Uploaded as `uMass = (massA, massB)`.

### 5.2 Travel, with speed integrated properly

`s ∈ [0,1)` runs from the wall (0) to the core (1):

```
phase(t) = birth + v0·t + v1·T·p(t)⁴/4        // p = t/T, T = 1.8s, ∫(t/T)³dt = T·p⁴/4
s        = fract(phase(t))
```

- `v0 = 0.35 + 0.45·h1`, and `v1 = 1.6` (today's gain).
- Position is the integral of speed, so the streak length (`p(t) − p(t−τ)`)
  is the true velocity.
- **Once `t > T`, which happens when WASM resolves late, `p` is clamped to 1
  and velocity is constant.** The beams hold in a stable pinched loop until
  impact, and that hold must look good indefinitely.

### 5.3 Envelope (the inversion)

```
W(s)  = W_wall · exp(−κ·s)        W_wall = 70 CSS px,  κ = mix(1.5, 6.0, ease)
turb  = curl(...) · (1 − s)² · (1 − ease) · A_turb
```

- The beam starts as a diffuse cloud at the wall and ends at about 0.5 px at
  the core at T−0.
- Turbulence lives out at the wall and dies toward the core. This is the exact
  inverse of today's `2 + 9·s·ease`.
- `ease = p³`, as today.

### 5.4 Mass signature (continuous in m, per side)

| | heavy, m → 1 | volatile, m → 0 |
|---|---|---|
| form | single dense ribbon | 3-strand braid, a helix seen side-on |
| transverse motion | flutter at 2–3 cycles over the full travel, large amplitude | 12–18 cycles over the full travel, tight radius |
| width | ~1.4 CSS px | ~0.7 CSS px |
| depth cue | none | brightness × (0.6 + 0.4·sin(helix)), so strands visibly cross over and under |

Transverse offset is `W(s) · (lane·spread + flutter/braid term)`. Because the
whole thing is scaled by `W(s)`, the variance goes to zero at T−0 automatically.

### 5.5 Streak length

`τ_streak` is fixed, so length is proportional to speed. Near the core at full
velocity the streaks become needles without any special case.

Ingress and egress alpha ramps at `s → 0` and `s → 1` are kept from today's
code, because they prevent pop-in at the wall and pop-out at the core.

---

## 6. Collision (phase `colliding`, 0–2500 ms)

### 6.0 Timeline

All constants live in JS (§9.1).

| ms | event |
|---|---|
| 0 | Beams extinguish (hard cut on the phase switch, by design). Shock launches. Core glint (≤ 40 ms). |
| 0–120 | Docking: the cage snaps together. |
| 0–350 | Shock expands and fades. |
| 120–620 | Ringdown. |
| 500–650 | Bonds fail (staggered). |
| 500–750 | Needle launches. |
| ≤ 1150 | Last needle fully gone (the needle envelope is exactly 0 from 1200). |
| 600 / 780 / 960 | Schlieren rings 1 / 2 / 3 launch. |
| **≥ 2400** | **Every emission and coverage exactly 0.** The parent hard-cuts to `result` at 2500, so anything still lit would pop. |

**Impact locus:** `c + (Δx, 0)` with `Δx = 40 CSS px · (massA − massB)`. The
heavier beam carries more momentum, so the impact lands toward the lighter
side. The shock, cage, needles and rings all share this centre.

### 6.1 Shockwave (field shader)

- **Shape:** a diamond (L1-norm distance field) with an **aspect of 1.8 : 1**,
  wide along the beam axis. It is not a circle. The 220 px chamber would clip
  a tall shape almost at once.
- **Radius:** `R(t) = 0.42·width · (1 − e^(−t/90ms))`.
- **Front:** 1 device px, analytic anti-aliasing.
- **Fresnel fringes:** three fainter lines behind the front, at
  `R − 6px·√n` with alpha `0.5/n` for `n = 1..3`. The `√n` spacing is
  Fresnel-zone spacing, and it is what makes this read as optics rather than
  an outline.
- **Fade:** `(1 − t/350)²`.
- **Core glint:** a radius of about 6 px, at most 40 ms, passed through the
  knee.
- **Removed:** the full-screen white flash (35%). The shock line is the flash.

### 6.2 The cage: a truncated octahedron (sodalite cage)

`collider/cageTopology.js`:

- The 24 vertices are all permutations of `(0, ±1, ±2)`.
- The 36 bonds are the vertex pairs at distance √2.
- Faces: 8 hexagons (the benzene read) and 6 squares.
- It is built once. The bond buffer holds `(i, j)` index pairs as instance
  attributes. The rest positions are a `vec3[24]` uniform.
- Draw: 36 bond ribbons (1 CSS px) plus 24 vertex quads (2–3 CSS px bright
  discs).

**Frame and projection:**

- Perspective, with the camera about 4 cage radii away.
- Cage radius about 60 CSS px.
- Alpha and width fall off with depth.

**Initial orientation:**

- A fixed tilt, chosen so the plane `x = 0` splits the vertices **12 / 12**.
  A test asserts this.
- Slow tumble.
- Spin handedness is `sign(massA − massB)` (with 0 treated as +). That gives
  the pair a real chirality.

**Docking, 0–120 ms:**

- Vertices with `x < 0` fly in from beam A's tip and vertices with `x > 0` from
  beam B's tip, each in its own beam's hue.
- They settle on a slightly under-damped spring with about 8% overshoot.
- A bond's alpha is `min(arrival_i, arrival_j)`.
- A bond joining the two halves takes a hue-space blend of hueA and hueB.

**Pressure:**

- The x axis starts squashed to 0.6.
- It relaxes to 1.0 as `1 − e^(−(t−120)/250ms)`, so the pressure visibly
  bleeds out during the ringdown.

**Ringdown, 120–620 ms.** Four modes, with frequency ratios taken from real
benzene vibrational modes:

| mode | benzene | f₀ at m̄ = 0 | τ | shape | amplitude (× cage R) |
|---|---|---|---|---|---|
| C–H stretch | 3062 cm⁻¹ | 18 Hz | 80 ms | per-vertex, along a hashed bond direction | 0.06 |
| C=C stretch | 1596 cm⁻¹ | 9.4 Hz | 180 ms | quadrupolar (x, −y, 0) | 0.05 |
| ring breathing | 992 cm⁻¹ | 5.8 Hz | 450 ms | radial | 0.08 |
| out-of-plane bend | 673 cm⁻¹ | 4.0 Hz | 350 ms | torsion about the collision axis, angle ∝ x/R | 0.12 rad |

- **Mass pitch.** Harmonic oscillator, `ω ∝ 1/√m`, so frequency is
  `f = f₀ / √(1 + 1.5·m̄)`, where `m̄` is the mean mass. The **ceiling is
  pinned at the lightest mass**, so no mode ever exceeds 18 Hz.
- **Hard constraint: nothing above 18 Hz.** Most viewers run 60 Hz. Anything
  above about 20 Hz aliases into a slow wobble. The fury comes from amplitude,
  incommensurate modes and fast decay.
- **Hard constraint: the vibration moves geometry, never brightness.** The
  cage does not strobe, which keeps it clear of flash-rate accessibility
  limits.
- Amplitudes are starting values, to be tuned by eye.

**Bond failure, 500–650 ms:**

- Each bond's break time comes from a hash of its index.
- On break, the two halves retract into their vertices over 30 ms.
- Vertices fade out over 650–750 ms as the needles leave.

### 6.3 Evaporation: the needles are the parameter trace

The 16 dimension beams (`buildBeams`, `LatentCollider.jsx:1070`; set at the
start of `colliding`, `:1453`) stop being a separate field-shader burst. They
drive the needles instead.

- **Population:** a fixed partition of the 4096 instances, chosen by hash.
  Everything outside the partition has alpha 0 in this phase. The gate goes in
  the alpha, not the branch (trap 3).
- **Sector:** `k ∈ 0..15`, with the direction set to the beam angle plus a
  jitter of ±π/16. The sector and the jitter come from different hash
  dimensions (trap 2).
- **Alive** if `hash < mag_k · density(m̄)`. An `idle` dimension (mag 0) emits
  nothing. The gaps in the corona are that collision's signature.
- **Hue:** `beams[k].hue` (convergence A+60°, divergence B+300°, paradox 350°).
- **Launch:** `t₀ = 500 + 250·hash`, from the cage surface along the sector
  direction.
- **Kinematics:** `r(t) = (v₀/k)(1 − e^(−k·age))`, with `v₀ = 600…1400` CSS
  px/s (its own hash) and light drag. `τ_streak = 35 ms` gives streaks of
  20–60 px.
- **Width and fade:** 0.6 CSS px, tapered. Alpha `e^(−age/τ_e)` with
  `τ_e = 60…140 ms`, multiplied by the JS needle envelope, which is exactly 0
  from 1200 ms.
- **Mass:** `density(m̄)` and `v₀` both fall as the mean mass rises. Volatile
  pairs crackle; heavy pairs shed a few slow needles.
- `beams[k].lifespanMs` is ignored. `buildBeams` is not modified.
- `uBeams` moves from the field program to the streak program. `uBeamT` is
  deleted.

### 6.4 Schlieren fronts (field shader)

- **Two to three rings.** Ring 3's weight is `smoothstep(0.3, 0.7, m̄)`.
  Continuous, so a ring never pops in or out.
- **Launches** at 600, 780 and 960 ms.
- **Slow on purpose.** Radius `R_k·(1 − e^(−age/600ms))` with
  `R_k = (0.22, 0.34, 0.46)·width` on the x axis, at the same 1.8 : 1 aspect.
  The outer rings may leave the frame vertically.
- **Shape:** a rounded hexagon, inheriting the cage's symmetry, blended into an
  ellipse as `p` rises. The residue forgets the molecule.
- **Profile:** a knife-edge Schlieren pair.
  - Outer lobe: a bright band 1 device px wide, into rgb.
  - Inner lobe: a shadow band 1 device px wide, into `accum.a`. The composite
    outputs that as coverage with no colour, which darkens the existing
    background along a hairline.
  - The shadow lobe is skipped on the screen-blend fallback.
- **Chromatic dispersion:** the R, G and B channels are evaluated at radius
  offsets `+δ, 0, −δ` with `δ = mix(0.5, 1.5, p)` device px.
- **Fade:** `(1 − p)²` from launch to 2400 ms, reaching exactly 0 emission and
  0 coverage.

### 6.5 Removed

- The spark radial burst.
- The orthogonal debris jet.
- The chimera orbit.
- The amber vapor.
- `ring1` / `ring2`.
- The full-screen flash.
- The field shader's 16-beam loop.
- `shake`.
- `uBurst.w`.

### 6.6 Kept in the field shader

The grid, the central zone glow (blended hue, ambient, present in every phase),
the crosshair and the beamlines. The zone glow is identity, not smoke, and it
gives the rings something to rise out of.

---

## 7. Reduced motion

`onSnap` paints one permanent frame. The single `SNAP_ELAPSED_MS` becomes one
value per phase:

| phase | snap ms | frame |
|---|---|---|
| accelerating | 1800 | fully pinched filaments |
| colliding | 1300 | needles gone, 2–3 rings clearly visible, no shock, no glint |
| others | 1800 | ambient, as today |

---

## 8. Contracts

**`ColliderChamber` props.** All the existing props are unchanged. The
additions are **`massA`, `massB`** (numbers in [0,1], defaulting to 0.5).

**`LatentCollider.jsx`.** It imports `domainMass` and passes those two props.
Nothing else in the file changes. The following are untouched:

- the phase graph and `usePhaseAdvance`
- `colliderBus` events
- `onPolarity`, `kernelRunHistoryRef` and the ledger path
- `buildBeams`
- the overlay

**`src/terminal/gl/`: no diff.**

- The accumulator, the instanced programs and the composite live in the
  chamber's `onInit` / `onDispose`, the same pattern as `LunarShaderMoon`'s
  own FBO.
- The composite reuses `host.vao` (the fullscreen quad).
- Resize: the `accum` texture is reallocated only in the `ResizeObserver`
  path, never per frame.
- Dispose: the texture, framebuffer, all three extra programs, their VAOs and
  buffers are deleted. `loseContextOnDispose` stays.

**Zero allocation per frame.**

- `phaseTiming(phase, ms, out)` writes into a caller-owned object that
  `ColliderChamber` preallocates once.
- `beamBuf`, the uniform arrays and the mass values are all preallocated or
  prop-derived.
- `paint()` creates no objects, arrays or closures.

**Dev-only scrub hook.**

- `window.__scentScrub(phase, ms)` pins the painted phase and elapsed time.
  `window.__scentScrub(null)` releases it.
- It exists only under `import.meta.env.DEV`, so production builds contain no
  such surface.
- It works because every frame is a pure function of (phase, ms).

---

## 9. Testing

### 9.1 Single source of truth

Every timing and shape constant lives in `colliderPhases.js`, or in a sibling
constants module:

- the timeline in §6.0
- mode frequencies, decays and amplitudes
- ring radii and launch times
- shock constants, the knee, and W_wall / κ

The constants are interpolated into the GLSL template strings. The per-frame
envelopes are computed in JS and uploaded as uniforms: shock, glint, cage,
needle, and rings[3]. So the tested functions *are* the rendered envelopes.

### 9.2 Unit tests

**Every new test is mutation-checked before it counts:** break the code, see
the test go red, restore. The July branch's worst defect was a test that could
never fail.

- **`cageTopology`:** V = 24, E = 36, every vertex has degree 3, 8 hexagons and
  6 squares, V − E + F = 2, every bond length is √2, and the initial
  orientation splits the vertices 12/12 by sign of x.
- **`domainMass`:** values in [0,1]. Monotonic in `raw`. Ties averaged.
  Deterministic. Defined for every domain id.
- **`colliderPhases`:**
  - every envelope is exactly 0 at `ms ≥ 2400`
  - the needle envelope is exactly 0 at `ms ≥ 1200`
  - the shock is 0 at `ms ≥ 350`
  - ring 3 weight is continuous in m̄
  - `phaseTiming` returns the same `out` object on every call
- **Frequency ceiling:** the highest mode frequency over `m̄ ∈ [0,1]` is
  ≤ 18 Hz, and it is reached at m̄ = 0.
- **`shaderContract.test.js`:**
  - extended to the streak, cage and composite programs
  - declared uniforms equal the harvested set
  - `#version 300 es` comes first
  - no `gl_FragColor`
  - no `gl_PointSize` anywhere in the chamber
- **Overlay and `usePhaseAdvance` tests:** must pass unmodified.
- **Reduced-motion test:** updated to the per-phase snap times.
- **`recordingGL`:** gains `drawArraysInstanced` and `vertexAttribDivisor`.
  Nothing existing calls them, so the change is additive.

### 9.3 Snapshots

- The chamber parity snapshot is **re-captured once, deliberately, in a
  commit of its own**. The output is entirely new, so it cannot match.
- Every other glParity snapshot must stay **byte-identical**. That is the proof
  that nothing shared changed.
- `vitest -u` is used for the chamber file only.

### 9.4 Looking (before any claim)

Headless Chrome over CDP with `--enable-unsafe-swiftshader` (never
`--disable-gpu`), driven by `__scentScrub`, at **DPR 1 and DPR 2**.

**Contact sheet of eight instants:**

1. idle wall cloud (selected, accelerating 200 ms)
2. T−0 pinch (accelerating 1790 ms)
3. docking (colliding 60 ms)
4. ringdown peak (colliding 250 ms)
5. bond failure (colliding 560 ms)
6. needle crackle (colliding 700 ms)
7. rings (colliding 1300 ms)
8. fully dark (colliding 2450 ms)

The sheet is sent to the author before anything else is claimed.

**Eye checks named in advance:**

- the near-complementary pair (§3.4)
- a heavy × heavy pair and a volatile × volatile pair
- 1 px hairline crawl at DPR 1 while in motion
- the Schlieren shadow lobe against `bg-black/60`

Then the author's own look on real hardware (360 Hz panel). **Nothing is
pushed without an explicit push command.**

---

## 10. Files

| file | change |
|---|---|
| `collider/domainMass.js` | new |
| `collider/cageTopology.js` | new |
| `collider/accumTarget.js` | new: capability check, create / resize / delete of the RGBA16F target |
| `collider/streakShader.js` | new; replaces `particleShader.js` (deleted) |
| `collider/cageShader.js` | new |
| `collider/compositeShader.js` | new: knee plus shadow-coverage output |
| `collider/fieldShader.js` | rewritten: shock, glint, rings; beam loop, flash and ring1/2 removed |
| `collider/colliderPhases.js` | rewritten timeline, out-parameter, envelopes |
| `collider/ColliderChamber.jsx` | pass structure, props, per-phase snap, scrub hook |
| `collider/particleSeeds.js` | unchanged |
| `views/LatentCollider.jsx` | `massA` / `massB` props only |
| `gl/__tests__/recordingGL.js` | two stub methods, additive |
| `collider/__tests__/*` | per §9 |

---

## 11. July leftovers: ruled

From 2026-07-28 §10.1 / §10.2:

| item | ruling |
|---|---|
| converging domain orbs | **superseded**: the diffuse mass cloud at each wall is their successor |
| impact screen shake | **deleted**, with its `colliderPhases` field and test. Shake smears 1 px hairlines; the off-centre shock carries the impact |
| cosine arc | **cut**: cos θ is already a DOM readout |
| `uBurst.w` uploaded and unread | **gone**: `uBurst` is redesigned |
| population mix 45/10/25/20 | **moot**: those populations no longer exist |

---

## 12. Risks

- **Complementary-hue neutral sums at the core (§3.4).** Mitigated
  structurally. Needs an eye check.
- **1 px hairline crawl at DPR 1 during motion.** The anti-aliasing margin
  helps. Needs an eye check.
- **`EXT_color_buffer_float` missing on some mobile GPUs.** The fallback path
  is specified, and the `data-chamber-accum` attribute makes it observable.
- **Mode amplitudes, ring radii, W_wall and κ are starting values.** Tuning is
  expected, and the scrub hook exists to make tuning cheap.

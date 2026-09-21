# Chaos sphere: the lens, the convergence and the filaments

**Date:** 2026-09-20
**Branch:** `feature/chaos-lens-convergence-filaments` (cut from `main` @ a21d8cf5, which is level with `origin/main`)
**Status:** design approved, sequence fixed

Three upgrades to the CHAOS tab's sphere (`src/terminal/views/ArtTab.jsx` and
`src/terminal/art/*`), in the order they ship:

1. **Prism convergence** — the spectral chord bundle terminates at a point
   instead of a comb.
2. **The lens** — the clickable node discs become smoked glass.
3. **The wire taper** — a base edge's glow dissolves as it enters a node; the
   thread does not.
4. **The filaments** — particles get range, arrival and velocity stretching.

---

## 0 · What was measured, and what it falsifies

Every claim below was read off the live instance buffer (`__artEdgeState()`) at
a 900x700 viewport in the idle state, not inferred from the source.

| quantity | measured |
| --- | --- |
| base edges | 40, max degree 4 |
| node core radius | 7–10 px |
| base wire core width | 1.15–1.30 px |
| base wire glow shoulder | **8.6–9.0 px** |
| end alphas at one hub | 0.055 / 0.059 / 0.110 / **0.122** |
| prism endpoint fan | **+/-8.4 px in x, +/-5.0 px in y** |

Three consequences, and one refutation:

- **A wire is a 1.2 px thread wearing a 9 px coat.** At a 7–10 px node, the
  glow is the size of the whole dot. The hub does not look ragged because the
  geometry misses; it looks ragged because what arrives is bigger than what it
  arrives at.
- **The 2.2x end-alpha spread is authored.** `edgeStops` in `artEdges.js` says
  so explicitly: end A fades as strength rises while end B brightens, and "a
  shader that fades symmetrically looks plausible and is wrong". It is a
  directional readout of edge strength. It is **not** to be symmetrised.
- **The butt-cap pinwheel is not visible today** — 1.2 px against a 7–10 px
  core hides it — and *becomes* visible the moment section 2 lands. It is
  handled by section 3, not by section 2.
- **REFUTED: "edge endpoints are anchored to the node perimeter."** The base
  edge writer at `ArtTab.jsx:1512` writes `pA.sx, pA.sy, pB.sx, pB.sy` —
  centre to centre, no perimeter anchoring, no tangent offsets. Anchoring the
  termination to **C** is already the shipping behaviour and would change
  nothing. The layer that *does* fan its endpoints is the prism (section 1).

### The particle pool, measured

Drag is `PARTICLE_DRAG = 0.964` per authored frame, so velocity e-folds in
**27.8 frames**, against lifespans of 60–300. Total displacement is
`v0 / (1 - DRAG)` = `27.8 * v0`:

| emitter | `v0` | total travel | context |
| --- | --- | --- | --- |
| `emitEdgeParticles` | `0.002 * abs(B-A)` | **0.044 units** | edge is ~0.8 long, so **5.5% of its wire** |
| `emitNodeBurst` | 0.003–0.012 | 0.083–0.33 | a real pop, then a stall |
| `emitIdleParticles` | 0.0005–0.0017 | 0.014–0.047 | effectively static |

**Every particle in the system is motionless for 60–90% of its visible life.**
The traffic-on-the-wires layer already exists and is already wired
(`ArtTab.jsx:1073`), already seeded along the edge, already aimed A to B with
the hue blending from node A's colour to node B's. It travels 5.5% of one edge
and dies.

This is why velocity stretching cannot ship on its own: applied to today's
pool it would show a streak at birth and dots thereafter, advertising the
stall rather than hiding it.

---

## 1 · Prism convergence

### The defect

`ArtTab.jsx:1779-1780`:

```js
const x0 = pA.sx + offset, y0 = pA.sy + offset * PRISM_END_OFF_Y;
const x1 = pB.sx + offset, y1 = pB.sy + offset * PRISM_END_OFF_Y;
```

`prismOffset(k) = (k - 3) * 2.8`, so seven spectral lines are **rigidly
translated** by -8.4 .. +8.4 px in x and -5.0 .. +5.0 in y. That is a 17 px
comb landing on a 14–20 px dot.

The control point is offset harder (`PRISM_CP_OFF_X = 2`, `PRISM_CP_OFF_Y =
1.4`) than the ends (1 and 0.6), so the bundle is only 1.5x wider at mid-chord
than at its ends. Dispersion originates at a point and separates along the
path; this is seven parallel copies, maximally split exactly where they should
be converged. The shape is wrong for the thing it imitates.

### The change

Endpoints go to `pA.sx, pA.sy` / `pB.sx, pB.sy` exactly. The offset moves into
the control point, chosen so the mid-chord fan width is **preserved exactly**.
A quadratic weights its control point at 1/2 at `t = 0.5`, so the mid-chord
offset contribution is `(end + 2*cp + end) / 4`:

| axis | today | after | mid-chord factor |
| --- | --- | --- | --- |
| x | end 1, cp 2 | end 0, cp **3** | `(1+4+1)/4 = 1.5` -> `(0+6+0)/4 = 1.5` |
| y | end 0.6, cp 1.4 | end 0, cp **2.0** | `(0.6+2.8+0.6)/4 = 1.0` -> `(0+4+0)/4 = 1.0` |

- `PRISM_CP_OFF_X`: 2 -> 3
- `PRISM_CP_OFF_Y`: 1.4 -> 2.0
- `PRISM_END_OFF_Y`: removed, along with its import in `ArtTab.jsx`

`prismControl`'s existing note — that the midpoint is taken from the
*unshifted* endpoints — becomes trivially true rather than a caveat. The
sacred polygon and the star spokes already used unshifted positions, so all
three prism sub-layers finally agree on where a node is.

### Risks

- The curve changes shape, so `quadSegments` may return a different `n` per
  chord. The ceiling (24) and therefore `MAX_ADDITIVE_EDGES` are unaffected,
  but `ag.dropped` must be asserted to stay at 0 on a full-strength frame.
- Visible change: the reference moves.

---

## 2 · The lens

### The change

One call site: the core disc at `ArtTab.jsx:1937`. Today it writes a flat
alpha. It becomes a three-stop radial ramp with **rising** alpha, driving the
machinery step 6 built for the particle glow (`DISC_OFF.midStop`,
`DISC_OFF.midColor`, `DISC_OFF.outerK`, `packAlphas`).

| stop | position | alpha |
| --- | --- | --- |
| centre | 0 | `coreAlpha(energy, depthAlpha) * LENS_CENTER_K` |
| knee | `LENS_KNEE` | `coreAlpha(...) * LENS_KNEE_K` |
| rim | 1 | `coreAlpha(...) * LENS_RIM_K` |

Colour is **identical at all three stops** and `outerK = 0`, so
`outer == mid == c0` and only opacity moves. No hue shift, no darkening — this
is an alpha ramp expressed through a colour-ramp encoding, and writing the same
colour three times is what keeps it one.

Four constants land in `artNodes.js` beside the existing core laws, so they are
testable without a canvas:

```
LENS_CENTER_K   ~0.35   interior opacity, as a fraction of today's flat alpha
LENS_KNEE       ~0.45   the shoulder's position across the radius, 0..1
LENS_KNEE_K     ~0.62   alpha at the knee
LENS_RIM_K      ~1.00   rim opacity — 1.0 keeps today's presence at the edge
```

These approximate `alpha(u) = a_rim + (a_ctr - a_rim)(1 - u^2)` with two linear
spans. The fit is not exact and does not need to be; `LENS_KNEE` is the
shoulder control (0.45 = broad smoked field, 0.75 = tight rim) and all four are
tuned on the render.

### Unchanged, on purpose

- **The halo.** Authored decision: the lens is *self-lit smoked glass*, not a
  window. The interior fills with the node's own glow rather than the network
  behind it.
- **`coreIsOpaque(isHovered)`.** A hovered core still writes `alpha: 1` and
  still takes its colour from `_preTint` (before the spectral tint). Glass at
  rest, solid under the cursor — a free affordance, and it protects the
  clickable target.
- **`depthCueAlpha`.** `coreAlpha` already carries `depthAlpha` and the lens
  scales it, so back-facing nodes still recede.

### Invariants to respect

`discEncodingInvariant()` requires `midStop` in the open interval (0,1), and
flags a mid colour written with no mid stop. Both are satisfied; a test should
assert a lens instance passes it.

### Risk: ink

Node cores are 31 discs of 7–10 px and a meaningful ink source. Bloom is at
`intensity 1.1 / levels 4` with the Reinhard knee at 0.6 — a calibration that
cost a great deal to reach (see `project_art_bloom_knee`). **Measure whole-frame
ink before and after with `artInk`, in both normal and immersive mode, and
report the delta.** Do not touch the bloom dial without showing the numbers
first.

---

## 3 · The wire taper

### The change

A base edge's 9 px gaussian shoulder fades to nothing over its last
`EDGE_TAPER_PX` while the 1.2 px core thread runs solid to the exact centre.

Three parts, **no new floats and no stride bump**:

1. **`uTaperPx`** — a new uniform on `SRC_OVER_LAYER`, set from
   `EDGE_TAPER_PX * ink` (start at 14 px, about 1.5x a node radius),
   alongside the existing `uOrthoHue`.
2. **Bit 7 of the dash-duty byte** — the per-instance opt-in. `packFlags`
   packs `dashDuty` at x256 and every dash duty in the codebase maxes at 8
   (`[4,3] [8,4] [3,4] [5,4] [3,6] [3,5] [6,8]`), so bit 7 of that byte is
   free. This is the same trick `isOrtho` already plays in bit 7 of the glow
   byte. `packFlags`, `unpackFlags` and `EDGE_VERT`'s unpack each mask the
   duty to 127 and split the bit off.
3. **The fragment** — the gaussian shoulder's amplitude is multiplied by
   `clamp(min(vAlong, vLen - vAlong) / uTaperPx, 0.0, 1.0)`, gated on the bit.
   The `side * cap` core term is untouched.

The four base-edge branches (ortho / fused / spectral / default) all write
`ed[o + 15]` directly, so the bit is OR'd in once after the branch rather than
in each.

### Why not symmetrise the end alphas

The 2.2x spread is authored and documented (section 0). Symmetrising would
delete a directional information channel to fix a cosmetic problem. The taper
fixes the cosmetics anyway: it hides the spread at the hub, where it looked
ragged, and keeps it in the body of the wire, where it reads.

### What this also fixes

The butt-cap pinwheel that section 2 would otherwise expose. With the glow
gone, four 1.2 px threads meet at a single point under the lens — which is
precisely the "merge into a single dot right at the centre" the work was
asked for.

### Scope

Source-over base edges only. The bit and the uniform make the additive layer's
terminating strokes (resonance edge, prism after section 1) a later, cheap
extension; they are not in this pass.

---

## 4 · The filaments

Three changes to the particle pool, in order, each separately visible.

### 4a · Range

`emitEdgeParticles` launches at about **18x** today's speed. The exact figure
falls out of the drag: total travel is `v0 / (1 - DRAG)` = `v0 / 0.036`, so
traversing an edge of length `L` needs `v0 = 0.036 * L` against today's
`0.002 * L`. The particle decelerates into its arrival rather than stalling at
5.5%; by frame 60 it is ~89% of the way.

Idle and burst emitters are re-tuned by eye afterwards, not by this formula —
they have no target to arrive at.

### 4b · Arrival

Four new SoA arrays in `createParticlePool`: `txs`, `tys`, `tzs` (target
position) and `pulls` (strength). Emitters with no target write `pull = 0` and
behave exactly as today.

The pull is an **exponential approach on position**:

```
P += (T - P) * (1 - k^dt)
```

This is deliberately the *same law* as the existing hue blend in
`stepParticles`, and for the same reason: it **composes exactly** — N sub-steps
of `dt/N` equal one step of `dt` — so no refresh rate is privileged.

A spring force (`v += (T - P) * PULL * dt`) does **not** compose, and that is
precisely the trap that hid the rate bug in the cadence work: *a dt=1 parity
test can never catch a rate bug*, because the broken and correct factors are
equal at dt=1. Only the composition law catches it. **The test for this term
must assert composition, not the dt=1 value.**

### 4c · Streaks

Each particle's **glow disc** is replaced by a **segment** from its previous
projected position to its current one, stretched along the displacement. The
segment branch already supplies width, a head-to-tail three-stop gradient and
a gaussian shoulder — no shader work, no new floats. Three new SoA arrays hold
the previous position (it cannot be derived from velocity once 4b lands,
because displacement is no longer `v * move`).

Instances per particle stay at **2**: the streak segment plus the existing core
disc at the head. `MAX_ADDITIVE_EDGES` is unchanged, and the existing
`ag.count + 1 >= MAX_ADDITIVE_EDGES` break still guards the budget.

**Two guards, specified rather than discovered:**

- **A zero-length segment is not a disc.** `isDisc()` keys on the width *sign*,
  so a stalled particle written with `a == b` takes the segment path with
  `len = 0`: `dir` falls back to `(1,0)`, `t = 0`, and the cap term evaluates
  to `0.25` at `vAlong = 0` — a faint quarter-alpha blob. The streak length is
  floored, with a fallback to the disc path below threshold.
- **The glow's colour ramp does not survive.** Today's particle glow *darkens*
  as it fades (lightness 82 -> 65 -> 50, knee at 0.4, via `GLOW_STOPS` and
  `GLOW_OUTER_K`). A segment's gradient runs along its length, not radially, so
  the shoulder will be single-colour. This is a real fidelity loss, small on a
  spark, and recorded rather than hidden.

### Rejected from the original proposal

- **Stateless analytic GPU trajectories.** 400 particles of CPU SoA is not a
  cost; the parity and determinism instruments read CPU state and would go
  blind; the drag is *exponential*, not ballistic, so `P0 + v0*t + a*t^2/2` is
  the wrong integral (the right closed form already exists as
  `driftOverFrames`); and the device-drift problem it solves does not exist
  here, because there is no GPGPU.
- **Luminance-knee interaction.** The numbers quoted are right
  (`luminanceThreshold` is 0.28) but the mechanism is backwards.
  `luminanceThreshold` was swept during the bloom-dial work and is **not** the
  lever; `levels` is. And the Reinhard knee at `KNEE.knee = 0.6` sits at the
  composer tail specifically to stop anything above ~1.0 blowing out. Asking
  impact sparks to exceed 1.0 for "blinding streaks" asks for the exact
  behaviour that knee was installed to remove. If impacts should read hotter,
  the lever is area and duration, not amplitude.

---

## 5 · Sequence, verification and risk

### Sequence

**prism -> lens -> taper -> particles.** Smallest and most visible first. Each
is independently shippable and independently lookable, which matters because
the look is ruled by eye, not by a gate.

The order is not arbitrary: the taper (3) fixes a pinwheel that the lens (2)
exposes, and the streaks (4c) are worthless without the range and arrival
(4a/4b) beneath them.

### Verification

- `npm test` green at every step; new laws get tests in
  `artNodes.test.js`, `artEdges.test.js`, `SphereEdges`'s disc-invariant tests
  and `artParticles.test.js`.
- The 4b attraction term gets a **composition test** (N sub-steps == one whole
  step), not a dt=1 value test.
- `npm run lint` — check the *printed* error count, never a piped tail. A piped
  lint has already masked errors into a commit on this project.
- Browser verification on every step, at a real viewport, before claiming
  anything about the look.

### Known risks

1. **All four sections move pixels, so the reference is re-cut.** `artCompare`
   is a regression net, not proof of the look: it has passed blatantly visible
   changes before, and it virtualises the clock at exactly 1000/60 so it is
   structurally blind to refresh-rate behaviour. 21/21 ADMISSIBLE proves the
   60 fps frame did not move, nothing more.
2. **Ink and bloom** (section 2). Measure, report, do not unilaterally dial.
3. **Mobile cost is unmeasured on this branch already**, and both the prism and
   the particles touch it. Measure at a coarse-pointer viewport rather than
   assume; `PRISM_SPECTRAL_COARSE = 4` is the mobile path.
4. **Never touch the working tree while `artBaseline` is running.** Vite will
   HMR the edit into the page mid-capture; the tell is two different
   `gitCommit` stamps across the manifests.

---

## Amendment (2026-09-21) — two claims in §4c were wrong

Recorded here rather than silently edited, because the wrong sentences were
copied out of this document into two code comments and a commit message, and
anyone reusing §4c would copy them again.

**1. The streak has NO gaussian shoulder.** §4c says "the segment branch
already supplies width, a head-to-tail three-stop gradient and a gaussian
shoulder". The first two are true; the third is not. `PARTICLE_FLAGS` is
`packFlags(0, 0, 0, ...)`, so the glow byte is zero, and `edgeFrag` gates the
entire shoulder term behind `step(0.001, vGlow)`. Neither particle arm has ever
had one.

The recorded fidelity loss was therefore understated. It is not only the
ramp's radial *darkening* (82 → 65 → 50 lightness) but the radial softness
entirely: the disc's half-width was `3.5 * sz` and the segment's is `sz / 2`,
about **seven times thinner**. What replaces a soft round glow is a hard
box-filtered line. §3's taper claims about a gaussian shoulder are correct and
unaffected — base edges really do carry one.

**Consequence still open for the author:** the disc↔streak fallback is a ~38x
ink discontinuity, so a particle whose per-frame displacement hovers near
`STREAK_MIN_PX` alternates between a soft blob and a near-invisible hairline.
Remedies (a hysteresis band, or a streak width that preserves the glow
footprint) change how particles look and are not the implementer's to pick.

**2. §4a's launch speed was derived for the wrong quantity, twice.**
"traversing an edge of length `L` needs `v0 = 0.036 * L`" ignores two things
the shipped code does:

- the emitter seeds at `t = artRandom()` *along* the edge, so a particle only
  has `(1 - t) * L` left to cover — sizing for the whole edge made it asymptote
  to `t + 1` and overshoot the node by `t` (measured peak 1.364 at t = 0.75);
- §4b's arrival term aims at the same point, so drag and pull **superpose** —
  and both production call sites take `pull = 1`, so the `(1 - t)` correction
  alone still peaked at 1.124.

The exact form, with `e = T - x`, `p` the per-frame pull and `r = D / (1 - p)`:
choosing `v0 = e0 * (1 - r)` collapses the recursion to `e_n = e0 * D^n`, which
never changes sign — the particle cannot pass the node at any point in its
life, at any pull. It reduces to `1 - D` at `pull = 0`. Shipped as
`edgeLaunchK(pull)`.

Exact at `dt = 1` only: drift and pull each compose but are interleaved and do
not commute, so a residual peak of ~5e-6 of an edge survives at the shipped
`pull = 1` and `dt = 1/6`. That is ~0.0015px on a 300px edge, and it is pinned
by a test as a bound rather than left implicit.

# /MERCURY phase 5 — breakup: fling, flight, coalescence

Date: 2026-10-02 · Branch: `feature/mercury-breakup` (off `feature/mercury-meniscus` @ `efe0820d`) · Status: APPROVED in sections by the author, awaiting review of this written spec

Master spec: `2026-09-30-mercury-gem-polish-design.md` (this document is its **Amendment 5**). Amendments 1–4 stay binding, as does the meniscus work (`efe0820d`: exact Hg conductor Fresnel, non-wetting rim). Origin: the author's "Liquid Mercury Realism & Droplet Dispersal" amendment, §3 (Rayleigh–Plateau pinch-off), parked as Phase 5 on 2026-10-02.

## 1. Scope

A hard flick of the liquid planet throws off beads that fly, find each other, and come home in a realistic merge, all inside the existing ~40 s liquid linger. Five parts:

1. **Simulation:** `mercuryBreakup.js`, a CPU module.
2. **Shape language:** tongue → neck → snap.
3. **Merge:** bridge growth, bead–bead coalescence, and the partial-coalescence cascade into the planet.
4. **Rendering:** a `DropletField` SDF impostor pass and a shared mirror GLSL chunk.
5. **Testing and the phone check.**

## 2. Author decisions (this session)

| # | Decision |
|---|---|
| D1 | The moment is a **fling** (option A). The planet stays one body; satellites leave and come back. No fission of the planet itself. |
| D2 | The beads do **not** snap back on a timer. The return is dynamic: they drift, find each other, and merge in a realistic animation. |
| D3 | The **~40 s liquid linger is the budget**, not a schedule. Every bead must be fully home before refreeze starts; inside that window the motion is free. |
| D4 | **Trigger = option C:** physical scaling with a tunable threshold. `breakOmega` is a knob, default 7.5 rad/s. The amount (tongue length, bead count) follows the excess past threshold. |
| D5 | Breakup **fires on release**. While the hand holds the planet, the tongues stretch; letting go snaps them. |
| D6 | **Rendering approach 1:** one raymarched SDF pass for the whole droplet system. Smooth union stands in for surface tension. |

## 3. Constants and conventions

- **The bead.** `DROP_R_M` = 1 cm of Hg, σ = 0.485 N/m, ρ = 13534 kg/m³ (`mercuryWaves.js`).
- **Display time.** Capillary motion is shown at 1/6 speed (Amendment 3). The capillary time √(ρR³/σ) is 0.167 s real, so **t_c ≈ 1.0 s on screen**. Every duration below derives from t_c(r) = √(ρr³/σ) × 6 at the body's own radius r. None is hand-picked.
- **Physical threshold, for reference.** A rotating 1 cm Hg drop loses axisymmetric stability at ρΩ²R³/8σ ≈ 0.46, so Ω_c ≈ 11.5 rad/s. D4 puts the default threshold below this on purpose. The HUD reports the live ratio Σ = ρω²R³/8σ, so the physics stays readable.
- **Refreeze clock** (`mercuryBody.js`). After release the heat store decays as H(t) = H₀·e^(−0.035 t). Refreeze begins at H = `FREEZE_HEAT_K` (25 K), so t_freeze = ln(H₀/25)/0.035. From the 80 K cap that is 33.2 s; then the 3 s front retreat follows.
- **Pixel floor.** As with the meniscus, nothing is drawn or simulated as a distinct body below **1.5 px**.

## 4. Simulation — `src/terminal/mercury/planet/mercuryBreakup.js`

Pure functions on a JS-side state, unit-tested; the shader only reads the per-frame output.

### 4.1 Trigger

A family fires **on pointer release** when all of these hold:
- τ = 1 (fully liquid);
- |ω| at release > `PLANET_TUNE.breakOmega` (default 7.5 rad/s);
- no family is in flight;
- not `CALM`.

Excess: e = clamp((|ω| − ω_th)/(`MAX_OMEGA` − ω_th), 0, 1).

### 4.2 Shape of the event

- **Two opposed tongues.** A spinning drop's first unstable mode is l = 2, so the tongues sit on the spin equator along the existing bulge's lobe axis (`spinBulge`), one at each end.
- **Tongue length:** L = e · `breakGain` · `TONGUE_MAX_R`, with `TONGUE_MAX_R` = 1.6 R. Thread radius r₀ = `TONGUE_ROOT_R` = 0.04 R (≈ 9 px on desktop).
- **Bead count:** Rayleigh–Plateau's fastest-growing wavelength is λ ≈ 9.02 r₀. With r₀ = 0.04 R, λ ≈ 0.36 R, so N_main = clamp(round(L/λ), 1, 4) per tongue reaches 4 at e = 1. Each main bead takes one wavelength of thread: r_main = (¾ r₀² λ)^(1/3) ≈ 0.076 R (≈ 17 px on desktop). One satellite of radius ≈ 0.3 r_main sits between neighbouring main beads.
- **Cap:** total bodies ≤ the tier cap (§7.4). Satellites are dropped first, with their volume folded into their neighbours.
- **Volume conservation:** the planet's live radius becomes ∛(R³ − Σrᵢ³) and is restored as volume drains back (§6.4). At the maximum family this is ≈ 0.1 % of R. It is kept for correctness and is not meant to be visible.

### 4.3 Launch

Each bead is born at its position along the tongue, with that point's rigid-body velocity ω × x (tangent to the spin), plus the tongue's stretch speed.

### 4.4 Flight and the budget

- **Forces:** each body feels a central pull a = −μ·x̂/|x|² toward the planet centre (the planetary reading of the return), plus linear aether drag −γ·v.
- **Budget solve at release.**
  - B = t_freeze(H at release) − `MERGE_MARGIN_S` (4 s).
  - The module integrates the family forward headlessly (deterministic fixed step; ≤ 12 bodies) and bisects γ until the **last body is fully absorbed**, cascade included (§6.3), by B.
  - **Cost:** target < 4 ms on desktop. No bead flies before its neck pinches (≥ one t_c after release), so the solve may be spread over the first frames of the snap sequence; a test pins the cost.
  - **μ** = `dropPull` · (ω_th R)² · R, so a bead launched at the threshold surface speed is exactly on a circular orbit. Faster launches go out on wide or even unbound paths, and the solved drag brings them home. γ is the only solved quantity.
- **Re-spin mid-flight:** heat rises, so the true budget only grows. Bodies arrive early and nothing is re-solved.
- **Determinism:** the same release state (ω vector, orientation, heat, tier) gives the same family.

### 4.5 Collisions

- **Body–body:** centre distance < r₁ + r₂ starts a bead–bead merge (§6.2).
- **Body–planet:** distance to the planet's **live** surface (shape including modes and bulge, via `shapeHeight`) ≤ r starts a planet merge (§6.3).

### 4.6 Out of scope

- One family at a time.
- No breakup from a partly liquid planet.
- Droplets never touch the crust and cast no shadows.
- The pointer drives only the planet.

## 5. Shape language

Three SDF primitives: **beads** (ellipsoids), **necks** (asymmetric tapered cones), and the **planet** (a sphere at the live radius, used only near roots and contacts).

1. **Hold.** While dragging with |ω| > ω_th, the l = 2 bulge grows into the two tongues (tapered capsules rooted in the surface, turning with the body). Length follows the live e. Below threshold the tongues relax back into the bulge and the existing body modes take over.
2. **Release.**
   - Each tongue becomes a chain: main beads at spacing λ, joined by necks.
   - **Neck law (inviscid pinch-off):** h(t) = h₀·((t₀ − t)/t₀)^(2/3) with t₀ ≈ t_c(r₀).
   - **Neck shape:** asymmetric double cone, ~113° on one side and ~18° on the other (Day, Hinch & Lister 1998).
3. **Order.**
   - The tip pinches first (end-pinching).
   - The necks snap working inward, spaced ≈ t_c with a bounded per-neck hash jitter (±15 %).
   - The **root neck snaps last.** Its stub retracts into the planet at the Taylor–Culick speed v = √(2σ/ρh) and fires a recoil impulse through `addImpulse` (kind `'ring'`), so the planet flinches as it lets go.
4. **Snap.** Each cut end rounds into its bead, and one satellite forms from the neck's material. A new bead is born stretched and rings in its l = 2 mode at the Rayleigh frequency ω₂ = √(8σ/ρr³) (via `rayleighOmega`), damped with `WAVE_VISC_PER_S`'s convention.
5. **Flight stretch.** Each bead stays prolate along its acceleration. The stretch scales with r² (a Bond-like ratio), so large beads stretch visibly and small ones stay round.
6. **Surface-tension rule for the SDF.** Smooth union (blend radius = local neck or bridge radius) applies **only** across a neck or a contact. Separate bodies use a hard `min`, so they never blob together at a distance.

## 6. Merge

### 6.1 Bridge growth (inertial coalescence)

At contact a bridge opens with radius r_b(t) = 1.6·(σR/ρ)^(1/4)·t^(1/2), where R is the smaller body's radius. In the SDF, r_b is the smooth-union blend radius at that contact.

### 6.2 Bead meets bead: full merge

- The centres converge while volume (r³) and momentum are conserved.
- The merged bead is born stretched along the impact line and rings down in l = 2. Amplitude follows impact speed; frequency is the Rayleigh frequency at the new radius.
- Comparable drops in vacuum merge fully; there is no cascade here.

### 6.3 Bead meets planet: partial-coalescence cascade

Hg's Ohnesorge number (~10⁻³) is far below the ~0.02 partial-coalescence threshold, so a landing bead does not merge in one go.

- **Each stage:**
  1. the bridge opens;
  2. about half the volume drains into the planet;
  3. a **daughter of radius ≈ 0.5 r** pinches off and hops up under the same central pull;
  4. the daughter lands again.
- **Stage duration** scales with t_c(r) ∝ r^1.5, so each stage takes ≈ 0.35× as long as the last.
- **Stop rule:** when a daughter would fall below 1.5 px, that stage merges fully.
- **Every touchdown** fires a strike through `addImpulse` (kind `'splash'`). Mode and wave amplitudes come from drained mass × normal speed.
- **Duration:** a full cascade takes ≈ 1.5 t_c(r_main) ≈ 1.5 s on screen, inside the 4 s margin. The §4.4 solve includes it.

### 6.4 Bookkeeping

- Drained volume returns to the planet's live radius stage by stage.
- When the last body is absorbed, the radius is exactly R again.
- The family then clears, and a new breakup may fire.

## 7. Rendering — `DropletField`

### 7.1 Mesh

- One impostor quad, re-fitted each frame to the **screen-space bounding rectangle** of the live primitives (each bounding sphere is projected on the CPU, then the union rectangle is padded by a few pixels).
- `visible = false` whenever no family or tongue is live. The material is a plain `ShaderMaterial` with no FBO.
- The plan includes a check that idle `gl.info.render.calls` is unchanged, guarding against the phase-4 hidden-FBO trap.

### 7.2 Uniforms

| Uniform | Contents |
|---|---|
| `uBead[N]` | centre, radius |
| `uBeadAxis[N]` | stretch direction, stretch amount |
| `uNeck[M]` | endpoint indices, radius, asymmetry |
| `uBridge[K]` | contact pair, blend radius r_b |
| `uPlanetContact` | the planet as a sphere at its live radius; enters only neck-root and bridge terms |

Live counts are uniforms. Loop bounds are compile-time tier constants.

### 7.3 March

1. **Per-ray pre-pass:** analytic ray–bounding-sphere tests give the interval [t_min, t_max]. A ray that hits no bound is discarded before marching.
2. **Sphere tracing** inside the interval. Primitives are an ellipsoid bound-SDF and the asymmetric cone. They combine with a hard `min` between separate bodies and a polynomial smooth-min (k = local neck or bridge radius) across necks and contacts.
3. **Normals** come from a 4-tap tetrahedral gradient.
4. **Silhouette AA:** coverage comes from the final distance over the pixel footprint, as with the planet's edge.
5. **Shading:** liquid only. `fresnelHg(NoV) · envRadiance(R, uRoughLiquid, …)`; no crust, no boil.

### 7.4 Seam with the planet

- A smooth union lies outside both of its inputs. So wherever a root or bridge swells out of the planet, the SDF surface is nearer and wins the depth test (both passes write `gl_FragDepth`).
- Where the SDF hit is on the bare planet sphere with zero blend weight, the fragment **discards**, and the planet pass shows with full detail (map, waves, meniscus).

### 7.5 Shared mirror chunk (targeted refactor)

- `fresnelHg`, `envRadiance`, the aether streak functions and the sRGB/dither output move from `mercuryPlanetShader.js` into one shared GLSL module used by both shaders.
- The planet's byte-identical snapshot must still pass after the move (a pure refactor) **before** any droplet code lands.

### 7.6 Sorting

Droplets share the planet's render slot and depth convention. The aether sorts around them as it does around the planet; the exosphere still draws after the nebula.

### 7.7 Tiers

| Tier | Bodies | Necks | Steps | Satellites |
|---|---|---|---|---|
| `full` | 12 | 10 | 48 | yes |
| `phone` | 8 | 6 | 32 | yes (starting point; set from the author's HUD) |
| `lite` | 6 | 4 | 24 | no (volume folded into the main beads) |
| `CALM` | breakup disabled | | | |

### 7.8 Budget

- On the author's phone, a **worst-case breakup frame adds ≤ 1.5 ms** of p50 frame time over idle (today: p50 ≈ 8.5 ms, 120 fps).
- The perf HUD (`?perf=1`) gains a readout of live primitive count and rectangle area.

### 7.9 Knobs (`PLANET_TUNE`, live via `__mercuryTune.planet`)

| Knob | Default | Meaning |
|---|---|---|
| `breakOmega` | 7.5 | trigger threshold, rad/s |
| `breakGain` | 1 | scales tongue length (L) |
| `dropPull` | 1 | scales the central pull μ (§4.4) |

## 8. Testing

### 8.1 JS physics (vitest)

`mercuryBreakup.test.js` plus additions to `mercuryWaves`/`mercuryBody` tests where an API grows.

- **Trigger:**
  - no fire below threshold, on hold, at τ < 1, under `CALM`, or with a family in flight;
  - fires on release above threshold;
  - e is monotonic in |ω|.
- **Shape:** opposed pair perpendicular to the spin axis; N follows L/λ clamped to 1–4 per tongue; totals ≤ tier cap; satellite volume is folded, not lost.
- **Pinch:** h ∝ (t₀ − t)^(2/3); tip first, root last; snap spacing ≈ t_c within the jitter bound.
- **Solve cost:** the γ bisection at the maximum family stays under the §4.4 target.
- **Volume:** conserved through breakup, merge and every cascade stage (relative error < 1e-9); the planet radius is exactly R when the family clears.
- **Budget:** over a sweep of release states (|ω| ∈ (ω_th, 12], H ∈ [60, 80] K, random orientations), the last body is fully absorbed by t_freeze − 4 s. A mid-flight re-spin never breaks this.
- **Merge:**
  - r_b ∝ √t;
  - bead–bead merges conserve momentum and volume;
  - the cascade halves r per stage, scales duration by ~0.35×, and stops at the 1.5 px floor;
  - each touchdown emits one impulse sized by drained mass × normal speed.
- **Determinism:** identical inputs give identical families.

### 8.2 Shader contracts

- GLSL mirrors the JS exactly: the neck law, smooth-min radius rule, ellipsoid SDF and stretch are pinned as strings (the `rippleSlope`/`meniscusSin` convention).
- The planet snapshot stays byte-identical across the §7.5 refactor commit.
- Tier constants are pinned, and the `CALM` variant compiles without the breakup path.

### 8.3 Live look (headless CDP)

- **`breakupLive.mjs`** fires a scripted hard flick and release, pins the sim clock through the dev rig, and writes a **timeline strip**:
  1. hold (tongues loaded);
  2. snap sequence (tip → root);
  3. mid-flight (stretch along acceleration);
  4. first bead–bead bridge;
  5. planet cascade;
  6. rest.
- It also writes 2× nearest-neighbour zooms of a neck at pinch, a bridge opening, and the planet/bridge seam (looking for double-draw or depth fighting).

### 8.4 Performance

- Headless: idle `gl.info.render.calls` is unchanged with no family.
- **The author's phone is the judge.** Through the HUD, compare p50 during a maximal breakup against idle. Pass: ≤ 1.5 ms added and 120 fps held.
- On a miss, reduce steps, then caps, through the tier table.

## 9. Process

- Plan via writing-plans, executed subagent-driven (as in Phases 3–4).
- Every look claim is settled on rendered sheets before it reaches the phone.
- Push only on the author's command.

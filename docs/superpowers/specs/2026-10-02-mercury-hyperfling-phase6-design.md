# /MERCURY Phase 6: Hyper-Fling (core disruption, spiral return, rebirth), design

Status: design approved section by section with the author, 2026-10-02. Amendments V1 (vortex return, solve η),
V2 (release pointer ω) and V3 (grace covers core strikes) approved the same day, found while planning 6a. Umbrella spec for three sub-projects
(6a sim, 6b render, 6c rebirth), each with its own plan written after the previous one lands.
Base: `main` @ `6217594a` (Phase 5 = `17879011` + PR 12). Branch: `feature/mercury-hyper`.
Prior art: `2026-10-02-mercury-breakup-phase5-design.md` (Amendment 5, §10 P1–P6) and
`.superpowers/sdd/HANDOVER-mercury-breakup.md`.

## 1. Intent

A hard fling (Phase 5) pulls two tongues and snaps them into beads. A **hyper-fling** disrupts the core itself:
the planet collapses to a micro-core while 92–97 % of its volume scatters as a swarm of quicksilver beads with
an organic size spread. The swarm swirls as a disc about the spin axis, spirals back in under a central pull and a
swirling aether whose headwind is solved for the return, coalesces bead into bead on the way, and rebuilds the planet through the Phase 5 cascade, ending in one
squash-and-rebound ring-down of the reborn core and a closing slam, all before refreeze.

## 2. Corrections to the originating brief (recorded so they are not re-proposed)

1. **"ω > 16–18" cannot fire.** `MAX_OMEGA = 12` (`mercuryBody.js`) clamps the spin, and the excess law, heat law
   and μ bracket are calibrated to it. Real swipes peaked at ω 10.5–11.4. The trigger is a pointer-speed tier
   on top of a pinned spin (§3.1). `MAX_OMEGA` is not raised.
2. **The phone gate does not establish headroom.** The reported run has JS p95 and frametime only. The new cost
   is GPU, and a 16.7 ms liquid frame on a 120 Hz panel (this phone previously measured p50 8.5 ms at 120 fps)
   is half rate, a likely GPU bind. Phone JS p95 0.7–0.9 ms below the desktop worst (1.9 ms) also needs the
   solver confirmed as having run. See Gate 0 (§7).
3. **Plain drag cannot make a spiral on this screen** (Amendment V1, simulated 2026-10-02). The planet fills most of
   the frame: a bead has ~0.42 scene units (0.56 R) beyond the old surface on desktop and ~0.12 on phone portrait.
   Containing the burst with drag (constant or a high→low schedule) also kills the tangential speed, and a solver
   that picks the weakest pull that lands picks the most radial path: 0.01–0.06 turns before landing. An
   "underdamped" test passes while the beads move in a line. The return is instead a drag toward a slightly
   sub-orbital aether vortex (§3.5), which gave 2.7–5.8 turns, contained and on target.
4. **The Phase 5 replay does not scale.** Cohesion and collision are O(N²): 36 bodies cost ~5× per substep against
   16, so ~16 ms per frame at the 800-substep ceiling. The hyper solver uses independent test particles (§3.6).

## 3. Simulation (sub-project 6a)

All new sim code is three.js-free and pure, in the Phase 5 style (vectors `[x,y,z]`, quaternions `[x,y,z,w]`).
New module `planet/hyperFling.js` (trigger, mass split, launch, vortex, containment drag, core scale); the
test-particle trial lives with the solver in `breakupBudget.js`; the Phase 5 modules gain only the hooks named in §6.

### 3.1 Trigger

At release, a hyper-fling fires instead of the Phase 5 fling when **both** hold:

- `|ω| ≥ HYPER_OMEGA_FRAC · MAX_OMEGA` (0.98), and
- `vPtr ≥ V_HYPER`, where `vPtr` is the **release pointer ω**: the pointer's displacement over the last
  `PTR_WINDOW_S` (0.06 s) before release, through `mercuryDrag.pointerOmega` (rad/s, canvas-height-normalised,
  so DPR-independent). It is the same unit as the body spin but is never clamped, so a hard swipe reads above
  `MAX_OMEGA` (Amendment V2: replaces "R/s via pxPerUnit", which needed a second calibration for no gain).

Fling energy: `eH = clamp((vPtr − V_HYPER) / V_HYPER_SPAN, 0, 1)`.

`V_HYPER` and `V_HYPER_SPAN` are set from the Gate 0 swipe readout (§7), not guessed. Lite tier
(`TIERS.lite`) never hyper-flings and falls back to the Phase 5 max fling. A two-finger trigger is out of scope.

DEV readout: `window.__mercuryDrop.lastRelease = { omega, vPtr, eH, hyper }`, written on every release.

### 3.2 Mass split

- Core fraction: `fC = lerp(F_CORE_MAX, F_CORE_MIN, eH)`, `F_CORE_MAX` 0.08, `F_CORE_MIN` 0.03.
  Core radius `rC0 = R · fC^(1/3)` (0.31–0.43 R). Fragment volume `V_frag = (1 − fC) · V0`, `V0 = (4/3)πR³`.
- Fragment count: `N = min(HYPER_N[tier], TIERS[tier].drop.bodies)` in 6a (so 16 full, 8 phone);
  6b raises the effective cap to `HYPER_N` = { full 32, phone 14 } via the impostor path.
- Radii (Villermaux ligament-mediated fragmentation): `x_i ~ Gamma(shape HYPER_FRAG_N = 4, mean 1)`,
  drawn from a seeded mulberry32. The seed is derived from the release (the family carries it) so the live run
  and every replay see the same swarm. Then `r_i = x_i · (V_frag / Σ (4/3)π x_j³)^(1/3)`.
- Clamps, then renormalise, two passes:
  - floor `r_i ≥ PX_FLOOR / pxPerUnit`;
  - ceiling `r_i ≤ HYPER_R_MAX_K · r̄`, `HYPER_R_MAX_K` 1.8, `r̄ = (V_frag / (N · (4/3)π))^(1/3)`
    (relative, not absolute: at N = 8, r̄ ≈ 0.49 R, so any absolute cap below that cannot conserve volume).
  - Clamped radii are frozen and the remaining radii are rescaled to restore `V_frag`.
- **Invariant:** `Σ V_i + V_core = V0` to 1e-9 relative.

### 3.3 Launch

- Placement: N points on a Fibonacci sphere, jittered by the seed, with latitude compressed toward the spin
  equator: `cosθ' = (1 − HYPER_EQ_BIAS) · cosθ`, `HYPER_EQ_BIAS` 0.4, then renormalised. Bead i is born at
  radius `ρ_i = R − r_i` on that direction (inside the old surface: the shrinking planet uncovers it, §3.4).
- Velocity: `v_i = ω × p_i + v_r,i · p̂_i`, with `v_r,i = V_R0 · (1 + eH) · (r̄ / r_i)^(1/2)`
  (small beads fly faster). `V_R0` is a look knob in `PLANET_TUNE` (`hyperRadial`).
- Momentum: subtract the volume-weighted mean velocity from every bead, so the swarm's centre of mass stays at
  the origin, μ's centre. Test: `|Σ V_i v_i| / Σ V_i < 1e-9`.
- Birth grace: no collision of any kind (bead–bead merges and bead–core strikes) for `t < HYPER_GRACE_S`
  (0.25 s). Born adjacent on a shell, the beads would otherwise merge on frame one, and a bead born at `R − r_i`
  can already touch the micro-core (`R − 2 r_i < rC0` for large beads). Radial velocity separates them inside
  the grace (Amendment V3: the grace covers core strikes too). The solver's arrivals obey the same grace.
- Swarm axis `L̂`: the unit total angular momentum `Σ V_i (p_i × v_i)`, stored on the family at fire (used by
  §5.3 and §5.4). Because `ω × p` sets one swirl sense, the swarm reads as a disc about ≈ `ω̂`.

### 3.4 Core shrink

- `fam.volOut = V_frag` at fire (the Phase 5 bookkeeping field, now large).
- Planet scale `sTrue = ((V0 − fam.volOut) / V0)^(1/3)`. Visible scale eases in:
  `s = lerp(1, sTrue, smooth(t / T_BURST))`, `T_BURST` 0.15 s; after the burst `s = sTrue`, which then
  grows continuously as the cascade drains beads back (`drainTo` is already smooth).
- Every consumer of the planet radius takes `s`. Inventory (done while planning 6a, 2026-10-02):
  - **Scaled:** the planet VS impostor size (`rb`) and the FS silhouette and re-intersection radii (`rl`, `rk`),
    through a new `uCoreR` uniform (world radius `s · R_SCENE`); the exosphere FS halo columns, tail cut-off and
    planet occlusion, through its own `uCoreR` (JS mirrors `haloColumn` / `tailDensity` take an optional
    `rCore`); `env.planetRadiusAt` (× `s`); the drag pick sphere (`pickSphereDir` radius × `s`).
  - **Scale-free (angular or relative):** body modes, bulge, ripples and impulse waves (fractions of the radius),
    meniscus, scar map, DEM relief and self-shadow, emitter nodes (fixed in space).
  - **Not scaled, accepted:** the roil pop calibration `subsolarPxArc` (a static screen calibration at R).
  - `PLANET_FS` / `PLANET_VS` change; their file snapshots are regenerated in their own reviewed commit.
  - The exosphere is a sibling component: it reads the live core radius from a module singleton
    (`LIVE_CORE.r`, written by `MercuryPlanet` each frame), one frame of lag at most.

### 3.5 Return: drag toward an aether vortex (Amendment V1)

The aether swirls about the swarm axis `L̂` a little slower than orbital speed:

`u(p) = (1 − η) · sqrt(μ / r) · (L̂ × p) / r`, `r = |p|`

and a hyper bead feels `a = −μ p / r³ − γ (v − u(p))` (+ Phase 5 cohesion in the live sim).

- Drag relative to the vortex pulls every bead onto a near-circular orbit within ~1/γ, and pulls it into the
  plane perpendicular to `L̂`, so the swarm flattens into a disc. The headwind `η` bleeds angular momentum, so
  the orbits decay inward: the inspiral of dust in a gas disc. Near the poles of `L̂` the vortex fades and beads
  fall nearly straight in.
- `μ` is set, not solved: `μ = 4π² R³ / HYPER_ORBIT_S²`, the orbital period at the old surface, a look knob
  (`PLANET_TUNE.hyperOrbit`, initial 3.5 s; simulated 3 s → ~4.5 turns, 4.5 s → ~2.8 turns).
- `γ` is constant per fling, solved **at fire** for containment: bisect `ln γ` in
  [`PLANET_TUNE.dropDrag`, `HYPER_GAMMA_MAX` 500], `HYPER_GAMMA_ITERS` 10, on a test-particle replay
  (§3.6) of the `HYPER_CONTAIN_K` (4) fastest beads with `η = 0` (the widest orbits) over `HYPER_CONTAIN_S`
  (3 s), for `max |p| ≤ HYPER_VIS_K · rVis`. `HYPER_VIS_K` 0.85; `rVis` = the smaller world half-extent of the
  view at the origin's depth. Simulated: γ 8.6–15.4.
- **Spiral gate** (measured, not assumed): in the §3.6 sweep, the median bead makes ≥ `HYPER_TURNS_MIN` (1.5)
  turns about `L̂` before it arrives. The knob that moves it is `hyperOrbit`.

### 3.6 Headwind solver on test particles

- State: per bead `(p, v)` only, under §3.5's acceleration with no cohesion, no merges, no bead–bead collisions;
  O(N) per substep at `DROP_DT` 1/120, the same semi-implicit Euler as `breakupStep.flight`.
- Arrival: bead i arrives when `t ≥ HYPER_GRACE_S` and `|p| ≤ rC0 + r_i` (the smallest core). Its return time
  is the arrival time plus `cascadeDuration(r_i, pxPerUnit)`, a closed-form helper that must match the
  `cascadeStep` stage sequence (tested against a real `stepFamily` cascade). `T(η) = max_i T_i`.
- **Solved variable: `η`, not `μ`.** Bisect `ln η` in [`ETA_LO` 1e-3, `ETA_HI` 1], `ETA_ITERS` 8, for the
  smallest `η` (the slowest inspiral, the most turns) with `T(η) ≤ returnTarget`. No upward climb: if `η = 1`
  does not land, `best = 1`, `landed = false`, one DEV warning. If `ETA_LO` lands, `best = ETA_LO`.
- **Why this bound is safe:** gravity and the vortex drag are mass-independent, so merges cannot bend the
  centre-of-mass path; a merge averages velocities inelastically and only removes energy; mutual cohesion pulls
  toward the swarm centroid, which §3.3 pins at the origin; the smallest core makes every path longest. So the
  solved `η` errs early, the side Phase 5 already accepts.
- Reuses `stepMuSolver`'s slicing, `landed` semantics and `solverBudget`, generalised to a per-solver parameter
  (log-μ for Phase 5, log-η for hyper). A test-particle substep for N beads is budgeted as
  `ceil(N / PARTICLES_PER_UNIT)` Phase 5 substeps (`PARTICLES_PER_UNIT` 16, re-measured in 6a so a unit stays
  ≈ one Phase 5 substep of cost), so the [350, 800] clamp stays meaningful.
- Deadline: there are no necks, so the solve must be done by `HYPER_GRACE_S` (beads fly on a provisional
  `η = ETA_HI` meanwhile, when the drag dominates anyway); `finishMuSolver` is the last resort, as in Phase 5.
- Sweep (6a): `eH ∈ {0, 0.5, 1}`, 20 seeds, N ∈ {8, 14, 16, 32}, 3 spin axes, heat 28–120, desktop and
  phone `rVis`. Acceptance: 100 % land, the spiral gate holds, containment holds in the live replay.
- `returnTarget` is unchanged: `min(dropDrift, refreeze − 4 s)`.
- Live sim stays the full `stepFamily` (cohesion, merges, cascade). At N = 36, ~1300 pairs × 1–2 substeps per
  frame is trivial.

### 3.7 Dev rig

`__mercuryTune.hyperNow(eH = 1)`: spins the body to `MAX_OMEGA`, restarts its release clock and fires a hyper
release with a synthetic `vPtr`, aimed like `breakNow`.

## 4. Rendering (sub-project 6b)

### 4.1 Per-frame split (`breakupFrame`)

- **Solo**: free, not merging, in no neck or bridge, and no other body within `BOUND_BEAD` contact range.
  Solo bodies go to the impostor list.
- **Coupled**: everything else, into the existing SDF uniform arrays under the existing caps
  (full 16/10/12, phone 8/6/8), which now apply to coupled bodies only.
- New tier field `TIERS[t].drop.impostors`: full 36, phone 16, lite 0.
- During a hyper-fling the coupled set is the merging pairs (typically 2–6 bodies); one SDF rect still covers them.
- Overflow (more merging pairs than the SDF cap): extra pairs draw as two overlapping impostors, no bridge.
- Allocation-free, preallocated Float32Arrays, spy-tested like `breakupFrame` today.

### 4.2 Impostor pass (`planet/beadImpostorShader.js`, new)

- Instanced quad; per-instance `iBead` (xyz, r) and `iAxis` (axis xyz, stretch A).
- VS: the quad is the projected bounding sphere of radius `r · max(1 + A, 1/√(1 + A))` plus 1 px AA margin;
  beads behind the near plane are culled.
- FS: exact ray–spheroid intersection (scale along the axis by 1/ra, across by 1/rp, unit-sphere quadratic) with
  `ra = r(1 + A)`, `rp = r/√(1 + A)`, exactly `sdEll`'s definitions, so a bead switching paths does not jump.
  Normal from the gradient of the quadratic form. A miss within a pixel gets partial coverage from its miss
  distance in px (the SDF edge rule, alpha-to-coverage).
- Shading: the SDF FS's tail moves into a shared `DROPLET_SHADE_GLSL` (fresnelHg, envRadiance, rim, sRGB, dither,
  `gl_FragDepth`). On the impostor path the rim is always on and `rB = r`. **The SDF FS rebuilt from the shared
  chunk stays byte-identical to its current snapshot.**
- Material: `DROPLET_MATERIAL` and `DROPLET_RENDER_ORDER`, as the SDF pass. The planet still occludes beads.
- One extra draw call while any solo bead exists; idle stays 11 draw calls (`breakSmoke.mjs` pin).

### 4.3 Planet during dispersion

The planet stays drawn. At `s ≈ 0.35` it shades ~12 % of its usual pixels, which returns the budget without hiding it.

### 4.4 Cost model and gate

Impostor cost is one quadratic per covered pixel, independent of N. Gate (phone, `&gpu=1`): with 14 impostors and
2 merging pairs on screen, GPU time ≤ the Gate 0 Phase 5 baseline + 1 ms, and the frame holds the panel rate
(120 Hz), not 60.

## 5. Rebirth (sub-project 6c)

### 5.1 Arrivals

Arriving beads use the Phase 5 cascade unchanged (strike, drain, hop, daughters) against the core at its live
radius `s · R`. The core grows continuously with `fam.volOut`.

### 5.2 Event merge and eviction

- Arrival events in one frame within `EVENT_MERGE_RAD` (0.3 rad) of each other are summed by strength into one
  event (direction strength-weighted).
- With all impulse slots full, the weakest remaining impulse is evicted, never one stronger than the incoming event.

### 5.3 Rebirth oscillator

One dedicated ℓ = 2 mode about `L̂`, outside the impulse slots. State `(a, ȧ)`, `a` a fraction of the live radius:

- `ä + 2 γ_rb ȧ + ω₂(s)² a = 0`, driven by impulses at each arrival strike:
  `ȧ += K_RB · (V_i · vn_i / V0) · (−2 · P2(û_i · L̂))`.
  An equatorial arrival (`P2 = −1/2`) kicks `a` positive (prolate along `L̂`), so a spiral infall squeezes the
  equator, then rebounds oblate (the pancake) and rings down. A polar arrival kicks the other way.
- `ω₂(s) = MODE_OMEGA[0] · s^(−3/2)` (Rayleigh ω ∝ r^(−3/2)): a small reborn core wobbles fast, and the ringing
  slows as it fills. Existing impulse-mode frequencies are not scaled (out of scope).
- `γ_rb` is chosen so `|a| < 0.01` within 3.5 s of the last arrival (inside the 4 s refreeze margin).
- Shape: `h = clamp(h_existing, ±SHAPE_MAX) + clamp(a, ±REBIRTH_MAX) · P2(x · L̂)`, `REBIRTH_MAX` 0.12.
  The planet impostor margin is dynamic, `SHAPE_MAX + |a|` (not a permanent 0.18, which would cost ~24 % more
  planet pixels at rest). The JS `shapeHeight` mirror and the shader `shapeH` change together; the existing
  parity test covers both. `PLANET_FS`'s snapshot is updated in its own reviewed commit.
- **Risk gate:** with `SHAPE_ITERS` 3, the radial re-intersection silhouette error at `|a| = REBIRTH_MAX` must
  stay under 0.5 px (checked with the JS mirror). If it fails, `REBIRTH_MAX` drops to 0.08; shader iterations
  are not raised.

### 5.4 Closing slam

The first time `fam.volOut < SLAM_FRAC · V0` (0.10), two full-strength `ring` events fire at `±L̂`. The rings
cross the core and collide at the equator where the last beads land. Two slots, once per hyper-fling.

## 6. Module changes

| File | Change |
|---|---|
| `planet/hyperFling.js` (new) | trigger, eH, mass split, `fireHyper` (launch, momentum removal, `L̂`, μ, containment γ), `coreScale`, `LIVE_CORE` |
| `planet/breakupFamily.js` | family fields `hyper`, `tGrace`, `rC0`, `axisL`, `gammaH`, `eta`; `fireFamily` resets them |
| `planet/breakupStep.js` | vortex acceleration when hyper (`hyperAccel`); all collisions skipped while `t < tGrace`; core radius `s · R` arrives via `env.planetRadiusAt`; `cascadeDuration`; arrival impulses into the rebirth oscillator (6c) |
| `planet/breakupBudget.js` | test-particle trials; solver generalised to a parameter (log-μ or log-η); `solverBudget` weights particle substeps; `solveContainment` |
| `planet/breakupFrame.js` | solo/coupled split, impostor arrays (6b); visible core scale `s` |
| `planet/dropletShader.js` | tail extracted to `DROPLET_SHADE_GLSL`; FS text unchanged |
| `planet/beadImpostorShader.js` (new) | §4.2 |
| `useDropletField.js` | impostor mesh and upload beside the SDF mesh |
| `planet/planetQuality.js` | `drop.impostors`, `HYPER_N` |
| `planet/planetLook.js` | `PLANET_TUNE.hyperRadial` and hyper look knobs |
| `planet/mercuryWaves.js` | rebirth term in `shapeHeight`, event merge, weakest eviction (6c) |
| planet shader | `shapeH` rebirth term, dynamic margin, radius scale `s` (only if the inventory says it must) |
| `MercuryPlanet.jsx` | pointer-speed window, trigger branch, `lastRelease`, `hyperNow`, wiring |

## 7. Order of work and gates

**Gate 0 (author's phone and swipes, before code):**
1. Phone `&gpu=1` on Phase 5 with 4–6 beads: the GPU baseline for §4.4.
2. Confirm the HUD shows nonzero solver substeps after release, and find why the liquid frame is 16.7 ms on the
   120 Hz panel. If Phase 5 is already GPU-bound, 6b's budget is re-set before it is planned.
3. ~10 hard mouse swipes and ~10 hard thumb flings with the `lastRelease` readout (added as 6a task 1) to set
   `V_HYPER` and `V_HYPER_SPAN`.

**6a (sim):** readout → mass split → launch and vortex step → test-particle solver and containment → core scale
(shader `uCoreR`) → wiring and `hyperNow` → sweep. Ships with N clamped to the current caps (16/8) on the current SDF march.
Gates: volume invariant, momentum invariant, sweep 100 % landed, spiral gate (median ≥ 1.5 turns), containment, `breakSmoke`, a look sheet,
the author's look call.

**6b (render):** shared shade chunk (snapshot unchanged) → split → impostor pass → raise N to 32/14.
Gates: ray–spheroid CPU port agrees with an `sdEll` march within `HIT_PX`; solo↔coupled classification tests;
`dropCompile.mjs` on all three tiers; idle draw calls 11; the §4.4 phone gate.

**6c (rebirth):** event merge and eviction → rebirth oscillator → closing slam.
Gates: volume invariant per substep including draining beads; `s(t)` has no frame-to-frame jump above 1 %;
oscillator sign (prolate then oblate under equatorial inflow); `|a| < 0.01` by refreeze − 0.5 s across the seed
sweep; merged events never exceed the slot count; no eviction of a stronger impulse; the re-intersection check;
the author's look call.

Process per sub-project: plan → SDD → look sheet → author look check. Nothing is pushed without the author's command.

## 8. Out of scope

Two-finger trigger; hyper-fling on lite tier; aiming the fling (handover's open P3 question); scaling the
existing impulse-mode frequencies with `s`; raising `MAX_OMEGA`.

## 9. Constants (initial values; look knobs marked *)

| Name | Value | Where |
|---|---|---|
| `HYPER_OMEGA_FRAC` | 0.98 | hyperFling |
| `PTR_WINDOW_S` | 0.06 s | hyperFling |
| `V_HYPER`, `V_HYPER_SPAN` | from Gate 0 | hyperFling |
| `F_CORE_MAX`, `F_CORE_MIN` | 0.08, 0.03 | hyperFling |
| `HYPER_N` | full 32, phone 14 (6a: clamped to 16/8) | planetQuality |
| `HYPER_FRAG_N` | 4 | hyperFling |
| `HYPER_R_MAX_K` | 1.8 × r̄ | hyperFling |
| `HYPER_EQ_BIAS` | 0.4 | hyperFling |
| `hyperRadial` (V_R0)* | from the look sheet | PLANET_TUNE |
| `HYPER_GRACE_S` | 0.25 s | hyperFling |
| `T_BURST` | 0.15 s | hyperFling |
| `hyperOrbit`* (`HYPER_ORBIT_S`) | 3.5 s | PLANET_TUNE |
| `HYPER_GAMMA_MAX`, `HYPER_GAMMA_ITERS` | 500, 10 | hyperFling |
| `HYPER_CONTAIN_K`, `HYPER_CONTAIN_S` | 4, 3 s | hyperFling |
| `HYPER_TURNS_MIN` | 1.5 | sweep gate |
| `HYPER_VIS_K` | 0.85 | hyperFling |
| `ETA_LO`, `ETA_HI`, `ETA_ITERS` | 1e-3, 1, 8 | breakupBudget |
| `PARTICLES_PER_UNIT` | 16 (re-measured) | breakupBudget |
| `drop.impostors` | full 36, phone 16, lite 0 | planetQuality |
| `EVENT_MERGE_RAD` | 0.3 rad | mercuryWaves |
| `K_RB`*, `γ_rb` | look; ring-down ≤ 3.5 s | hyperFling |
| `REBIRTH_MAX` | 0.12 (fallback 0.08) | mercuryWaves |
| `SLAM_FRAC` | 0.10 | hyperFling |

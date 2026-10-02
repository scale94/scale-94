# /MERCURY Phase 6: Hyper-Fling (core disruption, spiral return, rebirth), design

Status: design approved section by section with the author, 2026-10-02. Umbrella spec for three sub-projects
(6a sim, 6b render, 6c rebirth), each with its own plan written after the previous one lands.
Base: `main` @ `6217594a` (Phase 5 = `17879011` + PR 12). Branch: `feature/mercury-hyper`.
Prior art: `2026-10-02-mercury-breakup-phase5-design.md` (Amendment 5, §10 P1–P6) and
`.superpowers/sdd/HANDOVER-mercury-breakup.md`.

## 1. Intent

A hard fling (Phase 5) pulls two tongues and snaps them into beads. A **hyper-fling** disrupts the core itself:
the planet collapses to a micro-core while 92–97 % of its volume scatters as a swarm of quicksilver beads with
an organic size spread. The swarm swirls as a disc about the spin axis, spirals back in under a solved central
pull, coalesces bead into bead on the way, and rebuilds the planet through the Phase 5 cascade, ending in one
squash-and-rebound ring-down of the reborn core and a closing slam, all before refreeze.

## 2. Corrections to the originating brief (recorded so they are not re-proposed)

1. **"ω > 16–18" cannot fire.** `MAX_OMEGA = 12` (`mercuryBody.js`) clamps the spin, and the excess law, heat law
   and μ bracket are calibrated to it. Real swipes peaked at ω 10.5–11.4. The trigger is a pointer-speed tier
   on top of a pinned spin (§3.1). `MAX_OMEGA` is not raised.
2. **The phone gate does not establish headroom.** The reported run has JS p95 and frametime only. The new cost
   is GPU, and a 16.7 ms liquid frame on a 120 Hz panel (this phone previously measured p50 8.5 ms at 120 fps)
   is half rate, a likely GPU bind. Phone JS p95 0.7–0.9 ms below the desktop worst (1.9 ms) also needs the
   solver confirmed as having run. See Gate 0 (§7).
3. **At γ = 8 there is no slingshot.** Velocity e-folds in 0.125 s, so beads stop within ~0.4 s and creep home at
   terminal speed μ/(γr²). Curved returns need the drag schedule of §3.5.
4. **The Phase 5 replay does not scale.** Cohesion and collision are O(N²): 36 bodies cost ~5× per substep against
   16, so ~16 ms per frame at the 800-substep ceiling. The hyper solver uses independent test particles (§3.6).

## 3. Simulation (sub-project 6a)

All new sim code is three.js-free and pure, in the Phase 5 style (vectors `[x,y,z]`, quaternions `[x,y,z,w]`).
New module `planet/hyperFling.js` (trigger, mass split, launch, drag schedule, test-particle solver); the
Phase 5 modules gain only the hooks named in §6.

### 3.1 Trigger

At release, a hyper-fling fires instead of the Phase 5 fling when **both** hold:

- `|ω| ≥ HYPER_OMEGA_FRAC · MAX_OMEGA` (0.98), and
- `vPtr ≥ V_HYPER`, where `vPtr` is the pointer speed averaged over the last `PTR_WINDOW_S` (0.06 s) before
  release, converted px/s → R/s via `pxPerUnit` and `R_SCENE` (so it is DPR- and zoom-independent).

Fling energy: `eH = clamp((vPtr − V_HYPER) / V_HYPER_SPAN, 0, 1)`.

`V_HYPER` and `V_HYPER_SPAN` are set from the Gate 0 swipe readout (§7), not guessed. Lite tier
(`TIERS.lite`) never hyper-flings and falls back to the Phase 5 max fling. A two-finger trigger is out of scope.

DEV readout: `window.__mercuryDrop.lastRelease = { omega, vPtr, eH, hyper }`, written on every release.

### 3.2 Mass split

- Core fraction: `fC = lerp(F_CORE_MAX, F_CORE_MIN, eH)`, `F_CORE_MAX` 0.08, `F_CORE_MIN` 0.03.
  Core radius `rC0 = R · fC^(1/3)` (0.31–0.43 R). Fragment volume `V_frag = (1 − fC) · V0`, `V0 = (4/3)πR³`.
- Fragment count: `N = min(HYPER_N[tier], TIERS[tier].drop.bodies)` in 6a (so 16 full, 8 phone);
  6b raises the effective cap to `HYPER_N` = { full 32, phone 14 } via the impostor path.
- Radii (Villermaux ligament-mediated fragmentation): `x_i ~ Gamma(shape HYPER_GAMMA_N = 4, mean 1)`,
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
- Birth grace: no bead–bead collision or merge for `t < HYPER_GRACE_S` (0.25 s). Born adjacent on a shell, the
  beads would otherwise merge on frame one; radial velocity separates them inside the grace.
- Swarm axis `L̂`: the unit total angular momentum `Σ V_i (p_i × v_i)`, stored on the family at fire (used by
  §5.3 and §5.4). Because `ω × p` sets one swirl sense, the swarm reads as a disc about ≈ `ω̂`.

### 3.4 Core shrink

- `fam.volOut = V_frag` at fire (the Phase 5 bookkeeping field, now large).
- Planet scale `sTrue = ((V0 − fam.volOut) / V0)^(1/3)`. Visible scale eases in:
  `s = lerp(1, sTrue, smooth(t / T_BURST))`, `T_BURST` 0.15 s; after the burst `s = sTrue`, which then
  grows continuously as the cascade drains beads back (`drainTo` is already smooth).
- Every consumer of the planet radius takes `s`. Task 6a-2 inventories them before anything is scaled
  (at least: `planetRadiusAt`, the planet impostor rect, shadow, ripples and impulse waves, exosphere,
  meniscus, scar map, nodes). Prefer the existing radius uniforms and mesh scale; if `PLANET_FS` must change,
  its snapshot is updated in its own reviewed commit.

### 3.5 Drag schedule

`γ(t) = γ_lo + (γ_hi − γ_lo) · e^(−t / τ_γ)`, `γ_lo` (`HYPER_GAMMA_LO`) 1.5, `τ_γ` (`HYPER_GAMMA_TAU`) 0.5 s.

- `γ_hi` is solved at fire so the fastest bead stays on screen: a 1-D drag-only integration (μ ignored, so it is
  an upper bound on excursion) of the fastest bead, bisected for
  `excursion = HYPER_VIS_K · rVis − R`, `HYPER_VIS_K` 0.85, `rVis` the smaller world half-extent of the view at
  the origin's depth. Floor: `γ_hi ≥ PLANET_TUNE.dropDrag` (8).
- The live `stepFamily` reads `γ(fam.t)` from `env` instead of the constant when the family is hyper.
- **Spiral condition** (tested): `γ_lo < 2 · sqrt(μ / r_m³)`, `r_m` the median bead radius at t = 3 τ_γ.
  If it fails at the solved μ, the return is overdamped and the look is wrong; the test pins it across the sweep.

### 3.6 μ solver on test particles

- State: per bead `(p, v)` only, under `−μ p/|p|³ − γ(t) v`. No cohesion, no merges, no collisions; O(N) per
  substep at `DROP_DT` 1/120.
- Arrival: bead i arrives when `|p| ≤ rC0 + r_i` (the smallest core). Its return time is the arrival time plus
  `cascadeDuration(r_i, pxPerUnit)`, a closed-form helper that must match the `cascadeStep` stage sequence
  (tested against a real `stepFamily` cascade). Trial return time `T(μ) = max_i T_i`.
- **Why this bound is safe:** μ/r² and linear drag are mass-independent, so merges cannot bend the centre-of-mass
  path; a merge averages velocities inelastically and only removes energy; mutual cohesion pulls toward the
  swarm centroid, which §3.3 pins at the origin; the smallest core makes every path longest. So the solved μ errs
  early, the side Phase 5 already accepts.
- Reuses `stepMuSolver`'s bisection, extra-climb and `landed` semantics and `solverBudget` slicing. A test-particle
  substep for N beads is budgeted as `ceil(N / 16)` Phase 5 substeps, so the existing [350, 800] clamp stays
  meaningful. Expected cost: 6 × 1680 × 32 ≈ 3.2 × 10⁵ particle-steps, under 1 ms per frame across the ~20
  frames before the solve is needed.
- New bracket centre `MU_CENTER_H` from a sweep: `eH ∈ {0, 0.5, 1}`, 20 seeds, N ∈ {8, 14, 16, 32}, 6 yaws,
  heat 28–120. Acceptance: 100 % land, ≥ 3× margin each side, as in Phase 5.
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
| `planet/hyperFling.js` (new) | trigger, eH, mass split, launch, momentum removal, `L̂`, `γ(t)` and `γ_hi` solve, test-particle trial, `cascadeDuration` |
| `planet/breakupFamily.js` | `fireHyper(fam, …)` beside `fireFamily`; family fields `hyper`, `seed`, `L`, `gammaHi`, `tGrace` |
| `planet/breakupStep.js` | `γ(fam.t)` when hyper; collision/merge skipped while `t < tGrace`; core radius `s · R` via `env.planetRadiusAt`; arrival impulses into the rebirth oscillator (6c) |
| `planet/breakupBudget.js` | solver accepts a trial kind (family replay or test particles); `solverBudget` weights test-particle substeps by `ceil(N/16)`; `MU_CENTER_H` |
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

**6a (sim):** readout → R-consumer inventory → mass split → launch → core scale → drag schedule → test-particle
solver and sweep → `hyperNow`. Ships with N clamped to the current caps (16/8) on the current SDF march.
Gates: volume invariant, momentum invariant, sweep 100 % landed, spiral condition, `breakSmoke`, a look sheet,
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
| `HYPER_GAMMA_N` | 4 | hyperFling |
| `HYPER_R_MAX_K` | 1.8 × r̄ | hyperFling |
| `HYPER_EQ_BIAS` | 0.4 | hyperFling |
| `hyperRadial` (V_R0)* | from the look sheet | PLANET_TUNE |
| `HYPER_GRACE_S` | 0.25 s | hyperFling |
| `T_BURST` | 0.15 s | hyperFling |
| `HYPER_GAMMA_LO`*, `HYPER_GAMMA_TAU`* | 1.5, 0.5 s | hyperFling |
| `HYPER_VIS_K` | 0.85 | hyperFling |
| `MU_CENTER_H` | from the sweep | breakupBudget |
| `drop.impostors` | full 36, phone 16, lite 0 | planetQuality |
| `EVENT_MERGE_RAD` | 0.3 rad | mercuryWaves |
| `K_RB`*, `γ_rb` | look; ring-down ≤ 3.5 s | hyperFling |
| `REBIRTH_MAX` | 0.12 (fallback 0.08) | mercuryWaves |
| `SLAM_FRAC` | 0.10 | hyperFling |

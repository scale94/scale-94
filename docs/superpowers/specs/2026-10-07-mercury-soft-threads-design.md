# /mercury sub-project B: soft threads (fluid + air filaments, air mirror sky)

Date: 2026-10-07 · Branch: feature/mercury-stage (after neutral state A, 819877ac) · Status: draft for author review

## Why

The fluid and air threads read as rigid vector strokes, not atmosphere. Live baseline
(`.superpowers/sdd/tools/out/thread-base-sheet.png`, probe `thread-look.mjs`, layers isolated):

- **Filaments (main culprit).** A 1–2 px hairline, hard edge (`smoothstep(1.0, 0.3, d)` fluid, `smoothstep(1.0, 0.0, d)`
  air), constant width and near-constant brightness along the whole loop. Fluid threads are stacked near-ellipses on the
  torus knot (a wireframe atom); air threads are wobbly closed rings. Fluid colour is saturated neon (each lane its own
  hue, `laneHue`), drawn on top of the fog rather than out of it.
- **Air mirror sky (secondary).** `skyAirLayer` stretches its noise by `R.y * 8.0`, so the mirror sees streaks
  squeezed into horizontal latitude ribbons, with a narrow equatorial seam between the two rigid layers
  (`AIR_SHEAR_BAND` 0.12).
- The fog and the fluid mirror sky already read as atmosphere. They stay as they are.

Author scope ruling 2026-10-07: option A, both layers.

## Constraints carried from earlier rounds (do not regress)

1. **No position scatter across the thread.** Cross-lane jitter was cut in 7f/7g (`FLUID_SIGMA_R` 0.03 → 0.0075,
   `AIR_SIGMA_ALT` 0.006 → 0.0015) because neighbours offset sideways made a staircase. Fray and thickness variation
   are therefore **rendered** (the sprite profile), never particle spread.
2. **Every path term lives in the shared chain.** A warp must be evaluated inside the function both the particle and its
   lane neighbours go through (`fluidFilAt` / the air `airDisplace` chain), or the path secant and the gap-closing break
   (7e: dashes hatched across the thread).
3. **Low frequency only along the path.** A warp crossed at orbital speed with a short wavelength turns 16–24× dashes
   into straight chords ("pick-up sticks", look i). Warp wavelength along the thread ≥ 4 neighbour gaps.
4. **Calm = frozen threads.** Everything new runs on the flow's calm-gated time (`uTime` from the aether clock).
5. **Rigid sky regions.** An advected sky term needs a rigid per-region map; unbounded phase × spatial shear makes bands.
   The air warp is applied in each layer's rotating frame, after the rotation.
6. **Additive filaments.** Premultiplied output stays alpha 0 for filaments (`gasOut`): they add light, never darken
   the fog.

## §1 Filament cross-section: soft Gaussian with halo (shared, `GAS_STREAK_FS`)

- New `gasFilProfile(d)`, with `d` in core half-widths as today: `exp(-FIL_PROFILE_K · d²)`. Fluid and air both use it,
  so their two hand profiles go away (fog keeps its own sprite and profile).
- The sprite's half-width grows by `uFilHalo` (tune `filHalo`, default 2.5) so the tail is drawn, not clipped.
  `gasStreakDist` divides by the core half-width, so `d` stays in core units while the quad gets wider.
- **Light conservation.** `FIL_PROFILE_K` and the peak are chosen so the cross-integrated light of a thread at
  default width equals the old fluid profile's. The thread gets softer, not dimmer or brighter overall. This is checked
  numerically in a unit test against a JS mirror of both profiles.
- Taper (`gasTaper`) and the bent dash (`vStreakDir`/`vStreakDir2`) are unchanged.
- The length caps (`aspectMax`, `FIL_GAP_ASPECT`, `GAS_PX_FLOOR`) stay keyed to the **core** width; only the quad
  grows. Otherwise a halo would also lengthen every dash.
- Air's old profile (`smoothstep(1, 0, d)`) carried 1.0 core half-width of light, fluid's 1.3 (corrected 2026-10-07, final
  review: the earlier text had the direction backwards). With the shared profile air's total light rises ~30 % and its peak
  drops 1.0 → 0.73. `airFilGain` is re-checked in the look round, not silently re-scaled.
- Cost: filament fill area scales ~linearly with `filHalo` (dash length ≫ width). It goes on the phone-gate list. The
  `uPointMax` guard still applies to `w + L`, with `w` now the haloed width.

## §2 Thickness and luminance breathing along the thread: the rendered fray

- An along-lane noise `f(lane, along, t)` on the existing seamless mask coordinate (`gasThreadCoord`), offset from the
  luminance mask so the two decorrelate. It slowly evolves on `uTime · MASK_EVOLVE`.
- Width factor `mix(1 − filWidthVar, 1 + filFray, f)` on the core width (tune `filWidthVar` 0.35, `filFray` 2.0). Where
  `f` is high the thread opens into a diffuse ribbon; where it is low it pinches to a bright core.
- **Light conserved across width changes:** the alpha is scaled by `1 / widthFactor`, so a frayed stretch is wider and
  dimmer, a pinched one narrow and bright. It reads as a dense core dissolving into the fog, not as a fatter stroke.
- The existing along-lane luminance breath (`maskDepth`, now 0.3) gets a look-round range of 0.3–0.6.
- Evaluated per vertex (one more `snoise` per filament vertex) and passed as a varying. No fragment noise.

## §3 Domain-warped paths: loops that drift instead of repeating

- **Fluid.** Inside `fluidFilAt` and the filament branch of `main`, add a low-frequency world-space curl field:
  `FIL_WARP_AMP · curlNoise(pos · FIL_WARP_FREQ + uTime · FIL_WARP_RATE)`. It is Eulerian: each lane passes through
  different parts of the field, so the stacked ellipses separate, bend and drift apart, and the shapes slowly change.
  It applies to filaments only; the fog keeps its existing motion.
- **Air.** The same field, added to the filament branch of `airDisplace` (after the tilt and wander, before the damped
  curl), with its own amplitude, so the tilted rings stop reading as closed rigid hoops.
- The tune keys `filWarp` (amplitude scale, default 1) and the `FIL_WARP_FREQ` / `FIL_WARP_RATE` constants are pinned by
  a test against constraint 3: the wavelength along the thread ≥ 4 × the 95th-percentile neighbour gap in world units,
  per flow, at desktop and phone counts.
- Prev position: the warp goes through the same chain at the prev phase (as the y-noise and wander already do), so the
  speed part of the dash follows the warped path.

## §4 Colour: the core of the fog, not neon on top

Shared `gasFilTint(color, d)`, applied after the flow picks its colour:

- **Edge desaturation.** The colour moves toward its own luminance as `d` grows:
  `mix(color, vec3(luma), filEdgeDesat · smoothstep(0.5, 2.0, d))` (tune `filEdgeDesat`, default 0.45).
- **Hot core.** A small lift toward white at `d < 0.5`: `filCoreLift` 0.15.
- **Fluid lane hue.** `laneHue` is scaled by `FLUID_LANE_HUE_SPREAD` 0.25 (from 1.0). A thread sits near the fog hue
  around it instead of being an independent neon colour; neighbouring threads still differ slightly.
- Air keeps its altitude palette (already pale). Only the edge desaturation applies.

## §5 Air mirror sky (`aetherSky.js`, `skyAirLayer` / `skyAir`)

- **Latitude stretch.** `R.y * 8.0` becomes `R.y * AIR_SKY_LAT`, default 3.5 (look range 2.5–5). The streaks still run
  along the orbit, but are thicker and less ruled.
- **Warp.** Before sampling, in the layer's frame (constraint 5): `ph += AIR_SKY_WARP · (skyFbm(w) − 0.5)` and
  `y += AIR_SKY_WARP_Y · (skyFbm(w + 7.3) − 0.5)`, where `w = vec3(cos ph, sin ph, R.y · 1.5) · 1.2 + uSkyT · 0.03`. That
  is periodic in the angle (no seam) and evolves on the calm-gated sky clock. Octave budget: `min(nOct, 3)`.
- **Line sharpness.** `pow(…, 18.0)` becomes `pow(…, AIR_SKY_LINE_POW)`, default 10: softer streak edges.
- **Spherical envelope.** `smoothstep(0.95, 0.2, abs(R.y))` (a flat plateau ±0.2, then a shoulder) becomes
  `pow(max(1 − R.y², 0), AIR_SKY_ENV_POW)` (cos^2k of latitude, smooth everywhere, k default 1.5).
- **Layer seam.** `AIR_SHEAR_BAND` 0.12 → 0.25, a softer equatorial cross-fade. Both layers are still rigid; no shear.
- `SKY_MEAN.air` is re-measured with `ms-mean.mjs` (same recipe as 2026-10-05) and the planet-shader snapshots
  regenerated by swapping the chunk text, as for neutralSky.

## Tuning surface

Every look knob is on `window.__mercuryTune.planet` for the look round: `filHalo`, `filWidthVar`, `filFray`, `filWarp`,
`filEdgeDesat`, `filCoreLift`, `maskDepth`, and for the sky `airSkyLat`, `airSkyWarp` (uniforms, not consts, until ruled).
After the author's look call the sky knobs become consts again, so the sky stays branch-free.

## Out of scope

Fog sprites and the fog look; thermal and earth flows; the fluid, thermal and earth mirror skies; the neutral sky;
shader compile/precompile (left in place, validated in the phone gate); thread lane counts and placement (`gasThreads`).

## Testing

- **Unit (vitest):** light conservation of `gasFilProfile` vs the old fluid profile (numeric integral); width-factor ×
  alpha = constant light; warp wavelength vs the neighbour-gap p95 per flow and tier (uses `particleFlowBuffers` /
  `atmosphericFlowBuffers`); air sky envelope smooth (no plateau) and periodic warp (sample at φ and φ + 2π); new tune
  keys wired to uniforms. Source pins only where the house idiom already uses them.
- **Snapshots:** the planet-shader snapshots (full, pre-slow-noon, pre-visitors) are updated by chunk swap; no other
  diff.
- **Live (controller, :5175):** `thread-look.mjs` before/after sheets per element with layers isolated, a 1:1 crop, and
  a calm pair (frames identical, threads continuous, no staircase). Look the sheets over before asking for the author's
  call.
- **Phone gate (with A's):** filament fill cost at `filHalo`, extra per-vertex noise (warp curl + fray), first-tap link.

## Order

1. §1 + §4 (shared fragment): the biggest visible change, isolated, light-conserving.
2. §2 fray (per-vertex varying).
3. §3 warp, fluid then air (path chain + constraint tests).
4. §5 air mirror sky + mean re-measure + snapshots.
5. Look round on the knobs; author call; freeze defaults.

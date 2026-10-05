# Mercury aether — Hg glitter dust (bead look round 2)

Date: 2026-10-05 · Branch: `feature/mercury-stage` · Sub-project 1 of 3 of "the circulating field"
(next: element-gas filaments; then one shared velocity field for gas + beads)

## Problem

After bead look round 1 (`1bf90e04`, `47bbea42`) the Hg beads read as heavy chrome marbles, not fine
energetic ejecta:

- **Every bead sparkles every frame.** The guaranteed analytic glint is correct for a perfect mirror
  sphere — it shows the Sun from every view — and a glint that never flickers reads as a ball bearing.
- **Every speck carries a dark body** (`BEAD_BODY_SUBPX` 0.35 below 2 px): a grey core under the spark.
- **Few, uniform beads:** ~48 alive (`AMBIENT_RATE` 6 × `BEAD_LIFE` 8), radius 1–3 px with a mild
  `rng·rng` skew; caps 256 / 64 / 32 (full / phone / lite) are far from used.
- **Flings cling to the limb** (live: r 0.82 → 0.97 over 2 s). Release velocity is ~all tangential
  (ω×r · 1.1, radial 0.1); `FLING_DRAG_BOOST` 4/s + `DRAG` 1.5/s relaxes it into the element flow in
  ~0.18 s, and every flow circulates around the planet or barely lofts, so the throw never leaves.

## Decisions (author, 2026-10-05)

- **Target read: glitter dust** (option 1): many tiny specks, mostly invisible at any instant, each
  sparking briefly; a shimmer more than objects. The rare big bead stays a solid silver pearl.
- **Approach B:** one sim, one draw call; dust and pearls split by size; wobble-gated glint for dust.
- **Fling free-flight** folded in (it is where the dust is most visible).
- Gas filaments, the shared field, evaporation → Hg emission-line vapour, and speed streaks on fast
  beads are **out of scope**.

## §1 Population

Spawn radius (all sources: ambient, fling, splash) draws from one two-population distribution:

| Class | Share | Radius (scene units) | ≈ px, fitted desktop camera | Within-class distribution |
|---|---|---|---|---|
| Dust | 95 % (`PEARL_P` = 0.05) | 0.0015 – 0.006 | 0.4 – 1.5 | skewed small: `min + range · u·u` |
| Pearl | 5 % | 0.012 – 0.02 | 3 – 5 | uniform |

`BEAD_R_MIN` / `BEAD_R_MAX` are replaced by `DUST_R = [0.0015, 0.006]` and `PEARL_R = [0.012, 0.02]`.

**Shading switches by on-screen size, not radius:** `kPearl = smoothstep(2, 4, vPx_true)`, where
`vPx_true` is the unclamped projected diameter (the shader's `px`, before the 1.5 px `BEAD_MIN_PX`
floor). This holds on the phone's farther camera and for a bead drifting toward the camera.

**Count:** `AMBIENT_RATE` 6 → 18 (≈ 144 alive on desktop). Boiling keeps its `(1 + BOIL_GAIN · boil)`
multiplier; at the cap the oldest bead is evicted (already near its fade). `FLING_N` 24 → 48.

**Per-tier budget:** `stepBeads` ctx gains `rateScale` from the quality tier.

| Tier | `rateScale` | `beads` cap |
|---|---|---|
| full | 1 | 256 (unchanged) |
| phone | 0.55 (≈ 80 alive) | 64 → **128** |
| lite | 0.3 | 32 (unchanged) |

`rateScale` scales the ambient trickle only. Fling and splash counts are not scaled; the cap bounds them.

## §2 The wobble glint

**Physics anchor.** A free droplet oscillates in its shape modes. The two lowest (l = 2, 3) have
Rayleigh frequency ∝ √(l(l−1)(l+2)), a ratio √30 / √8 ≈ 1.94, and both ∝ r^−1.5. The deformation moves
the specular point and changes its curvature, so the Sun's spark flares and dies. Two incommensurate
modes never phase-lock, which gives aperiodic twinkle, not a metronome. The rates are scaled for
legibility; real droplets this size ring far faster.

**Model.** Two phases φ₂, φ₃ ∈ [0, 2π) are drawn at spawn (new `ph2`, `ph3` Float32Arrays, swapped in
`remove`). Per frame, in `stepBeads`:

```
w2   = 2π · WOBBLE_HZ_REF · (WOBBLE_R_REF / r)^1.5,  clamped to 2π · [WOBBLE_HZ_MIN, WOBBLE_HZ_MAX]
s    = 0.6 · sin(w2 · age + φ₂) + 0.4 · sin(WOBBLE_RATIO · w2 · age + φ₃)
gate = max(0, s)^WOBBLE_K
```

| Constant | Value |
|---|---|
| `WOBBLE_HZ_REF` | 0.8 |
| `WOBBLE_R_REF` | 0.012 |
| `WOBBLE_HZ_MIN` / `MAX` | 0.5 / 5 (dust lives at the clamp: shimmer, not strobe, at 360 Hz) |
| `WOBBLE_RATIO` | 1.94 (`Math.sqrt(30 / 8)`) |
| `WOBBLE_K` | 6 (spark; dark ~80 % of the time) |

`r` here is the bead's current radius (it shrinks under fire evaporation, so the wobble quickens as it
boils away). `gate ∈ [0, 1]`.

**Upload.** `outBead` goes from 2 to 3 floats per bead: (radius, alpha, gate); `createBeads` allocates
`cap * 3`. The `aBead` attribute becomes `vec3` (`useHgBeads` binds it with item size 3).

**Shading** (`hgBeadShader.js`, blended by `kPearl`):

| | Dust (`kPearl` 0) | Pearl (`kPearl` 1) |
|---|---|---|
| Body | 0 | today's mirror body (`aBody`, unchanged) |
| Glint gain | `uDustSparkle · gate` | `uBeadSparkle · mix(0.85, 1.0, gate)` |

- **New uniform `uDustSparkle`**, `PLANET_TUNE.dustSparkle` default 1.5, appended to
  `BEAD_UNIFORMS_OWN`. Glint stays capped at `BEAD_GLINT_MAX` 1.5.
- **Body:** `aBody *= kPearl`. `BEAD_BODY_SUBPX` and its ramp are removed (`kPearl` replaces them).
- **Double-glint fix** (open minor from round 1): the analytic glint is multiplied by
  `1 − smoothstep(4, 6, vPx)`. Above 6 px the resolved Sun lobe in `envRadiance` is the only glint.
- The planet-shadow term `sh` already multiplies the glint: glitter goes dark in the shadow lane and
  lights up crossing the terminator. No new code.

## §3 Fling free-flight

Replace the post-fling drag boost with a free-flight window:

```
drag(age) = DRAG · (free ? 1 − exp(−age / FLING_FREE_T) : 1)      FLING_FREE_T = 0.5 s
```

- At release the bead is ballistic (gravity only) and flies along the tangent line, so its radius grows
  as √(r² + (vt)²). It has 63 % of normal drag by 0.5 s and is fully in the element flow by ≈ 1.5 s.
- Radial launch kick 0.1 → `FLING_RADIAL` 0.25.
- `FLING_DRAG_BOOST`, `FLING_DRAG_T` and the `boost` array are removed; a `free` Uint8Array
  (1 = flung) replaces `boost` and is swapped in `remove`. Ambient and splash beads have `free` 0.
- `FLING_V_MAX` 2.25 is kept.
- Expected (not yet measured): at a 1.5 u/s release, r ≈ 1.4 at t = 1 s.

## Testing and verification

1. **Unit (pure, `hgBeads`):**
   - The spawn split over 10 000 draws is 5 % ± 1 % pearls, and every radius is inside its class range.
   - `rateScale` scales the ambient count (0.55 → ≈ 0.55 × spawns over 10 s).
   - The gate is in [0, 1] over many frames, and the w2 clamp holds at both ends.
   - Aperiodicity: a bead's gate sampled at 60 Hz over 10 s has no lag in [0.1, 5] s with
     autocorrelation > 0.9.
   - Fling: with fixed ω, a flung bead's max r over 1 s is > 1.3 · coreR, in each of the 4 phases.
     This replaces the round-1 cap-only fling test.
2. **Shader tests:** `aBead` is vec3; `uDustSparkle` is declared and in `BEAD_UNIFORMS_OWN`;
   `BEAD_BODY_SUBPX` is gone; the double-glint fade is present.
3. **GPU compile, live (CDP):** 0 errors at boot and after a fling. This is mandatory: round 1's
   float/vec3 error passed read-review.
4. **Look sheet (controller views it):**
   - Ambient field × 4 elements.
   - A fling at 0.3 / 1.0 / 2.0 s.
   - `dustSparkle` A/B at 0.8 / 1.5 / cap.
   - A pearl at 4–6 px (one glint).
   - A ~1 s frame strip, to confirm aperiodic twinkle with no banding.
5. **Author hardware:** the desktop perf HUD at 360 Hz (twinkle judged there), and the phone frame
   rate while boiling at the 128 cap.

## Files

- `src/terminal/mercury/planet/hgBeads.js`: population, rate scale, wobble gate, free-flight.
- `src/terminal/mercury/planet/hgBeadShader.js`: vec3 `aBead`, `kPearl`, dust glint, double-glint fade.
- `src/terminal/mercury/useHgBeads.js`: `aBead` item size 3, `uDustSparkle`.
- `src/terminal/mercury/MercuryPlanet.jsx`: `beadCtx.rateScale = TIERS[tier].beadRate`.
- `src/terminal/mercury/planet/planetQuality.js`: phone `beads` 128, per-tier `beadRate`.
- `src/terminal/mercury/planet/planetLook.js`: `dustSparkle`.
- Tests beside each file.

# Mercury Visitors — Phase 2: the Element × State Matrix (design)

**Status:** approved in brainstorming 2026-10-04. Branch `feature/mercury-matrix` (off `origin/main` 09ed1cb0).
**Builds on:** `docs/superpowers/specs/2026-10-03-mercury-visitors-design.md` (phase 1, live on main). Its §9 listed this work.

## 1. Problem

Phase 1 gives each element one signature reaction on **liquid** Hg. On every other planet state, a visitor still falls and
then fires the old fallback:
- a crater on crust
- a damped ring on frozen Hg

Phase 1's look sheet also showed that every reaction lands near the limb. The aim runs from the tapped node toward the camera,
so a ~14 px reaction at 75–80° from the disc centre is foreshortened to a 3–4 px sliver (cos 75° ≈ 0.26).

## 2. Scope (author rulings)

| # | Question | Ruling |
|---|----------|--------|
| R1 | Readability | **Matrix + landing-aim fix only.** Physical sizes stay. Size grows only where the physics gives it (√t film spread, frost creep). No base-scale bump. |
| R2 | Which cells | **The four named pairings now.** The solid-crust row (every element on crust) is its own later phase. |
| R3 | Mark lifetime | **Until the planet changes state.** Frost and glaze persist until the Hg under them melts. The pit persists like a crater. The live moments (sinking, stripping) stay short-lived. |
| R4 | Storage | **Extend the scar map** (approach 1): B = frost, A = glaze. No new texture. |
| R5 | Frost light | **Nebula + node light first** (diffuse `envRadiance`, plus the Sun where it reaches). Self-glow is the fallback only if the look call fails. |

The four pairings:
1. water on frozen Hg → **frost**
2. fire on frozen Hg → **melt pool, then glaze**
3. earth on soft crust → **sinking**
4. air on boiling Hg → **vapour stripping**

Every other cell keeps today's behaviour:
- earth or air on frozen Hg → ring
- any element on crust (τ below the soft floor) → crater
- the phase 1 reactions on liquid and boiling Hg are unchanged

## 3. State definitions (as the code has them)

- τ (`body.tau`) runs from 0 (crust) to 1 (liquid). It eases toward `body.liquid ? 1 : 0`.
- Frozen Hg is **local**. `localTempK(d, sun, tssK, heatK)` gives the surface temperature at a direction. The night side of a melted
  planet (τ = 1) is frozen wherever that temperature is below `HG_MELT_K` (234.32 K). Day-side liquid and night-side ice coexist.
- Boiling: local T > `HG_BOIL_K` (629.88 K). Phase 1 rule D-4 still holds: boiling counts as liquid for visitors.
- **Soft crust:** `SOFT_TAU_MIN ≤ τ < LIQUID_TAU` (0.5), with `SOFT_TAU_MIN ≈ 0.1`. Below the floor is hard crust, which still craters.
- **Healing trap:** today `healScars` runs every frame while τ ≥ 1, and frozen Hg exists at τ = 1. That wipe is only safe for
  frost and glaze because `healScars` writes only R and G (§5.2). Frost and glaze heal by local temperature instead.

## 4. Behaviour

### 4.1 Landing aim (applies to every visitor, phase 1 included)
- At launch, the landing direction is pulled to within **35°** of the sub-camera point, the centre of the visible face.
- It stays on the tapped node's side: rotate the phase 1 landing direction toward the sub-camera point until the angle is ≤ 35°.
- The parametric fall's bow absorbs the longer path. This runs at launch time only; launch may allocate, as in phase 1.

### 4.2 Water on frozen Hg — frost
- At < 234 K the drop freezes on contact.
- A frost patch creeps outward as a dendritic front over **~1.5 s**. It is drawn live through a new surface-slot kind
  (`SURF_FROST`), with radius growing toward `FROST_R` and a ragged, seeded edge.
- At the end of the creep, the visitor emits a **stamp event** `{ kind: 'frost', dirBody, radius, seed }`, and the visitor frees.
- Look: matte white, fully rough. It breaks the mirror, so it reads even where the mirror reflects black.
- Light: diffuse `envRadiance` (nebula + element nodes) plus Lambert sunlight where the Sun reaches (R5).

### 4.3 Fire on frozen Hg — melt pool, then glaze
- The ember lands and melts a liquid pool around itself. The pool's radius grows over **~3 s** while the ember burns, toward `POOL_R`.
- Drawn as `SURF_POOL`: a liquid-Hg mirror disc inside the solid surface, with a meniscus rim.
- The ember body is the phase 1 ember.
- When the ember's life ends, it emits `{ kind: 'glaze', dirBody, radius: current pool radius, seed }`. The pool has refrozen smooth.
- Glaze look: lower roughness than the surrounding frozen Hg, a visibly glassier patch.

### 4.4 Earth on soft crust — sinking
- The rock lands on the half-molten crust and sinks over **~5 s**: its submersion rises from `ROCK_SUBMERGED` (0.2) to 1.
- It pushes up a collar ring (`SURF_COLLAR`; a shallow raised ring, like the meniscus with the opposite sign).
- At the end it emits `{ kind: 'pit', dirBody, radius, seed }`: a small, shallow depression stamped through the crater-depth path.
- The pit heals like a crater (τ ≥ 1 wipe).

### 4.5 Air on boiling Hg — vapour stripping
- The phase 1 gust: jet slot dent plus cat's-paws, unchanged.
- Added: a translucent **vapour plume** torn downwind, a new body kind in the visitor pass, styled like the existing steam.
  Life is the jet's 1.5 s.
- Touchdown adds `EXO_PUFF` to the exosphere coverage, like the ember on boiling Hg.

### 4.6 Reduced motion (`calm`)
- No creep, growth or sinking animation. The mark appears at full size and stamps at touchdown.
- Stamps still land: a persistent mark is not motion.
- The plume is static and fades at half life, matching the phase 1 calm rules.
- Calm compiles `VISIT_SLOTS = 0`. The live slots don't draw, but stamps do.

## 5. Architecture

### 5.1 `visitorSim.js`
- `impactBranch(phase, tau, tempK)` gains four outcomes:
  - `frost`: fluid, frozen
  - `pool`: thermal, frozen
  - `sink`: earth, soft crust
  - `strip`: air, boiling
- New residents for these kinds. Lifetimes in `RESIDENT_LIFE_S`, plus creep, growth and sink constants.
- `createVisitorOut()` gains a `stamps` list (preallocated, like `impacts`): `{ kind, dirBody[3], radius, seed }`.
- Landing aim: the launch path applies the 35° pull (§4.1), with the constant `AIM_MAX_RAD`.
- Idle cost stays zero: `stepVisitors` still returns before any loop when `live === 0`.

### 5.2 `scarMap.js`
- B = frost coverage (0..255) and A = glaze (0..255), written **directly into `bytes`**. No float masters, no new memory.
- `createScarMap` sets A to **0** (was 255). The shader has never read A.
- New functions:
  - `stampFrost(map, d, radius, seed)`
  - `stampGlaze(map, d, radius, seed)`
  - `stampPit(map, d, radius, seed)`: reuses the crater-depth write, smaller and shallower, no rays
- New flag `marksLive` (frost or glaze present). `healScars` keeps its rule and writes only R and G, so it leaves B and A alone.
- New `healMelted(map, sunBody, tssK, heatK)`: a sweep that zeroes B and A where `localTempK(texelDir) > HG_MELT_K`.
  - The Sun is turned into the body frame once per sweep.
  - It runs on the existing `SCAR_TICK_S` (5 s) tick, only while `marksLive`.
  - Cost bound: it skips texels whose B and A are both 0 before any trig (as `matureScars` skips `ray === 0`), so only marked
    texels pay for `localTempK`. A full temperature pass over all 524k texels every 5 s would hitch the phone.
  - It returns true only when a byte changed (that is what costs an upload).

### 5.3 Planet shader (`mercuryPlanetShader.js`)
- On solid (frozen) Hg, it reads the scar sample's `.b` and `.a`:
  - **frost:** mixes toward white, roughness 1, diffuse env plus sun
  - **glaze:** lowers roughness
- New surface-slot kind codes: `SURF_FROST`, `SURF_POOL`, `SURF_COLLAR`. Stripping reuses `SURF_JET`.
- Every addition is `// visitors`-marked. The parity strip test still restores the pre-change shader byte for byte.
- Slot counts per tier are unchanged (full 4, phone 2, lite 1, calm 0).

### 5.4 Visitor body pass (`visitorShader.js`)
- The sinking rock reuses the rock intersection with a submersion parameter.
- The pool's ember reuses the ember.
- New body kind `VIS_PLUME`: a translucent downwind streak (like the bead's steam), composited by the existing coverage-over rule.

### 5.5 `MercuryPlanet.jsx`
- Drains `out.stamps` into the stamp functions and sets `scarDirty`, as crater stamps already do.
- On the scar tick, calls `healMelted` while `marksLive`.
- `strip` touchdowns set `vis.exoPuff`.

### 5.6 Units
Lifetime, creep and sink timings use the visitors' clock.

## 6. Testing

Unit tests, in the vitest source and behaviour style of phase 1:
- **Branch table:** every element × state cell, including the edges:
  - `SOFT_TAU_MIN`
  - `LIQUID_TAU`
  - exactly `HG_MELT_K` and `HG_BOIL_K`
  - air vs other elements on boiling Hg
- **Aim:** for every orbit node and several camera positions, the landing is ≤ 35° from the sub-camera point and on the node's side.
- **Stamps:**
  - frost stamps once, at creep end
  - glaze stamps once, at ember death
  - pit stamps once, at sink end
  - calm stamps at touchdown
  - liquid Hg never stamps
- **Scar map:**
  - each stamp writes only its channel
  - `healScars` leaves B and A
  - `healMelted` clears exactly the texels above `HG_MELT_K`, including a rotated-body case
  - no sweep when `!marksLive`
- **Shader:** the parity strip test, slot codes, and the calm variant's slot count.
- **Idle:** the phase 1 zero-loop, zero-allocation guarantees still hold.

Live checks (CDP, the dev server on :5175, tools in `.superpowers/sdd/tools/`):
- Every tier compiles and links, with and without calm.
- A look sheet for each pairing at touchdown / mid-animation / just after the stamp / +10 s. It includes:
  - the dark-mirror case (a landing at disc centre)
  - night-side frost lighting
  - phase 1's liquid reactions re-shot with the new aim
- Heal: frost a night patch, spin it hot, and confirm the frost is gone and stays gone after it refreezes.

## 7. Author gates

- **Look call** (socks/∞), on the sheet and live. It decides whether nebula + node-lit frost reads, or needs the faint self-glow (R5).
- **Phone:** still 120 while the sphere is in motion, now with marks present (one more texture-channel read).

## 8. Out of scope

- The solid-crust row (next phase).
- The other unlisted cells (they keep today's ring or crater).
- Frost surviving as floating ice between 234 K and 273 K.
- Marks that fade on a timer.
- Any base-size increase.

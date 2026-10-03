# Mercury visitors: the elements meet the mercury (phase 1)

Date: 2026-10-03 · Branch: `feature/mercury-visitors` (stacked on `feature/mercury-slow-noon`) · Status: design approved by the author

## 1. Problem

A tap on an element node currently does two unrelated things:

1. **Screen-space fireworks** (`MercuryFireworks.jsx`, `fireworksUtils.js`). These are 5–8 2D rockets that fly from the node to random
   points in the *top 35% of the screen*, away from the planet, and burst there.
2. **A planet strike** (`MercuryPlanet.jsx`, strike drain). An impulse lands at the same instant, `IMPACT_TILT_DEG` (40°) off the node.
   Nothing travels to it. Its response (splash / ring / crater) depends only on the planet's thermal state (`impactKind`) and
   **ignores which element was tapped**.

The animation flies away from the thing it should hit, and the hit doesn't know what hit it.

## 2. Goal

The tap launches the element itself. It falls from its node onto the planet, and the impact and aftermath are the physics of
**that element meeting mercury**. One event, end to end, in the scene.

Scope of this phase (author ruling "C: A now, the matrix later"): one signature reaction per element **on liquid Hg**, plus the one
state split that is the point of the physics (water: spreading film vs Leidenfrost). The full element × state matrix
(crust / frozen / liquid / boiling) is **phase 2**.

## 3. Decisions (author rulings)

| # | Question | Ruling |
|---|----------|--------|
| D1 | Screen-space fireworks | **Removed** entirely; the in-scene flight is the animation |
| D2 | Reaction depth | One signature reaction per element on liquid Hg now; matrix later |
| D3 | Resident lifetime | **Short-lived residents**, ~6–12 s; ride the body frame; flingable; ≤ 4 per element |
| D4 | Flight | **Gravity-curved fall**, 0.6–0.9 s, lands at today's strike point; per-element carrier |
| D5 | Architecture | **New visitors pass** (sim + impostor + planet-shader surface slots); Phase 5 droplet code untouched |
| D6 | Water | **Spreading thin film** below ~470 K, **Leidenfrost bead** above (corrects the first "water beads" pitch) |

### Physics check behind D6

Spreading coefficient of water on clean Hg: S = γ_Hg − γ_w − γ_Hg/w ≈ 485 − 72 − 375 ≈ **+38 mN/m > 0**, so water **wets and spreads**
on mercury the way oil spreads on a puddle. It does not bead. Above water's Leidenfrost point (~470 K surface) the drop never
touches; it rides its own vapour cushion. Mercury's liquid range is 234–630 K, so the day side straddles both regimes.

The other elements:
- Rock (ρ ≈ 2.7–3) and even iron (7.9) **float** on Hg (13.5).
- Surface tension falls with temperature, so a hot spot drives a **Marangoni** flow *outward* (toward high tension).
- A gas jet presses a cavity and raises wind ripples downstream.

## 4. Per-element behaviour (liquid Hg, τ ≥ `LIQUID_TAU`)

Every flight lands at the existing strike point (`strikeDirWorld`: 40° off the node, toward the viewer). That point is recomputed
against the turning planet up to touchdown.

### WATER: a falling drop
- **Impact:** a `dimple` impulse. It is a shallow dent with a soft low wave at about ⅓ of today's splash wave amplitude, because the
  drop is 13.5× lighter than the liquid it hits.
- **Local surface T < 470 K (spreads):**
  - The drop flattens into a **thin film decal** whose radius grows as ~√t.
  - Thickness h runs from ~1 µm at touchdown to ~80 nm at 8 s.
  - It shows physical thin-film interference colours (§6.2).
  - Around 4 s, noise thresholds on h tear the film into a ring of small lenses.
  - It is gone by ~8 s (evaporated).
- **Local surface T ≥ 470 K (Leidenfrost):**
  - It never wets. It becomes a **skating bead** resident that does a damped random skate on the surface.
  - It leaves faint steam wisps, shrinks as it evaporates, and is gone in ~6 s.
- **Threshold:** `LEIDENFROST_K = 470`, evaluated with `localTempK` at the landing direction at touchdown.

### FIRE: an ember
- **Impact:** the ember sticks as a **hot spot** for ~3 s.
- **Reaction:**
  - A `marangoni` impulse: a shallow **clearing** opens at the spot, and a raised rim travels outward.
  - A blackbody tint (§6.2) cools with the spot.
  - It heals by ~6 s. There is no resident body after the ember dies (~3 s).
- **On boiling Hg (local T > 630 K):** it also adds a short puff to the existing exosphere coverage. This is a small transient
  bump, not a new system.

### EARTH: a tumbling shard
- **Impact:** a `crown` impulse, a heavy short splash with a mode push of ~1.5× today's splash mode amplitude.
- **Reaction:**
  - The shard **pops back up and floats**, ~20% submerged.
  - It presses a **meniscus ring** decal into the surface.
  - It bobs with a damped sinusoid (period ~1.2 s, e-fold ~2 s) and rides the spin.
  - It sinks into a fade at ~12 s.

### AIR: a gust
- **Flight:** no body. A faint chromatic shimmer line plus a few carried dust motes trace the path (§6.1; honest
  substitute for true background refraction, which would need a scene copy).
- **Impact:** a `jet` impulse.
  - The surface **dents under the jet** for ~1.5 s.
  - **Cat's-paw ripples** drift across the surface along the gust's arrival direction. This is the only *directional*
    wave kind.
- **Aftermath:** nothing stays.

### Outside liquid Hg (unchanged until phase 2)
- **Crust** (τ < `LIQUID_TAU`): the carrier still flies, then today's `stampCrater` fires for every element.
- **Frozen / solid Hg** (`impactKind` → `ring`): the carrier still flies, then today's damped ring fires.

### Detach (all residents)
When the body's ω passes the fling threshold, or a hyper fires (`fam.hyper`), every resident switches to the world frame with
velocity ω × r. It flies off the limb and fades over ~0.6 s.

### Reduced motion (`calm`)
- No flight and no skate or bob.
- The visitor appears at the landing point with today's glow (`surf.glowT0` path).
- Residents are static and fade at half their normal lifetime.
- No impulses fire (unchanged rule).

## 5. Architecture

### 5.1 Removed
- `src/terminal/mercury/MercuryFireworks.jsx` and `src/terminal/mercury/fireworksUtils.js`. Both are deleted; nothing else imports
  them. (`PALETTES` there is local, and `WorldMap.jsx` has its own.)
- `MercuryTab.jsx`: the `fireworksRef`, `handleElementFired`, the `<MercuryFireworks/>` mount, and the `onElementFired` prop pass.
- **Kept:**
  - The node's press burst in `MercurySphere` (scale + glow). It is the launch moment.
  - `onElementFired` → `strikesRef` in `MercuryCanvas`. The input path is unchanged; only its consumer changes.

### 5.2 `planet/visitorSim.js` (new, plain JS, no three.js)
Headless-testable, in the same style as `breakupFamily.js`. It has a fixed pool of `VISITOR_SLOTS = 8`, `MAX_PER_ELEMENT = 4`, and
evicts the oldest of the same element.

The state machine for each visitor:

| State | What happens |
|-------|--------------|
| `flight` | **Parametric** gravity fall, not integrated, so the touchdown time and place are exact and tests are deterministic. Start: `nodeWorldPosition(node.angle, precession)` at launch. End: `R_SCENE · strikeDirWorld(...)`, recomputed each frame. Progress eases in t² (accelerating), and the path bows toward the camera. `T_FLIGHT` is per element within 0.6–0.9 s (water 0.75, fire 0.6, earth 0.85, air 0.65). |
| `impact` | One frame. Picks the branch from `impactKind(τ, localTempK(...))` and, for water, `LEIDENFROST_K`. Emits the impulse (§5.4) and enters `resident` or `fade`. |
| `resident` | Body-frame direction + small tangent velocity, so drag carries it. Per-kind update: film radius/thickness, bead skate (damped random walk), rock bob, ember cooling. |
| `detached` | World-frame ballistic with ω × r, fading. |
| `fade` → free | Slot released. |

- **API:** `createVisitors()`, `launchVisitor(buf, phase, tS, ctx)`, `stepVisitors(buf, tS, dt, ctx, out)`. `ctx` holds q, ω,
  τ, heatK, sun, cam and calm. `out` holds instance data for the impostor plus the surface slots for the planet shader, strongest
  first, using `impulseOrder`-style ordering.
- **Idle:** zero allocations and zero work when no visitor is live.

### 5.3 `MercuryPlanet.jsx` changes
- The strike drain calls `launchVisitor` instead of `addImpulse` / `stampCrater` directly. The crater, ring and glow paths move
  into the sim's `impact` step, and their behaviour there is unchanged.
- It calls `stepVisitors` each frame, writes the impostor instance buffer, and writes the `uVisit*` uniforms.
- Detach reads the existing drag/release state and the hyper-fired flag. No new input plumbing.

### 5.4 `planet/mercuryWaves.js`: new impulse kinds
Add `dimple`, `crown`, `marangoni` and `jet` to the kind tables (`WAVE_DAMP_PER_S`, dimple gain), with amplitudes in a new
`VISITOR_IMPACT` table in `mercuryImpacts.js`. `IMPACT_MODE_AMP` / `IMPACT_WAVE_AMP` and all Phase 5 amplitudes stay untouched.

- `marangoni` has a **negative** centre dimple (a clearing), and its rim travels outward.
- `jet` needs a direction: it reuses `dirWorld0` / `slip`, which the `wake` kind already uses, so the cat's-paws drift along the
  gust. If `slip` can't express the drift cleanly, the plan adds one per-slot tangent vector. That is a measured decision in the plan,
  not a spec placeholder: the plan must try `slip` first and record the result.

### 5.5 `planet/visitorShader.js` (new): the impostor pass
- One instanced quad per live visitor (≤ 8), using the droplets' contract: transparent list, `NoBlending`, depth test/write,
  alpha-to-coverage, `gl_FragDepth`.
- `renderOrder = DROPLET_RENDER_ORDER + 1`.
- Mesh `visible = false` when no visitor needs a body.

### 5.6 Planet shader surface slots
- New uniforms `uVisitDir[n]`, `uVisitA[n]`, `uVisitB[n]` (kind, radius, thickness/temperature, age), with
  `n = VISIT_SURF_SLOTS` per tier: full 4, phone 2. The tier table lives in `planetQuality`.
- Gated by `uVisitOn` exactly as `uSurfOn` gates impulses; compiled to 0 slots under `calm`.
- Draws the film decal, the hot tint and the rock meniscus ring **as part of the mirror**, before the mirror's final compose. The
  decal is surface optics, not a sticker on top.

## 6. Rendering

### 6.1 Impostor bodies
- **Water drop / Leidenfrost bead:**
  - An ellipsoid SDF stretched along velocity (aspect ≤ 1.6), shaded as clear water with n = 1.33 Fresnel.
  - **Refraction without a scene copy:** the refracted ray is re-intersected with the planet sphere and shaded with the same
    `hgMirrorGlsl` functions, so the lens shows the real mercury under it, distorted.
  - The Leidenfrost bead adds a dark vapour-gap line at contact and a soft contact shadow.
- **Ember:** an emissive core + a tail capsule along −v. Blackbody colour cools from ~1300 K at launch to ~900 K at impact, then
  continues as the hot-spot tint.
- **Rock:** an intersection of 5–7 seeded cut planes (faceted). Regolith albedo matches the crust; sun Lambert + a thin rim. The
  submerged part is clipped by the Hg surface plane at its contact.
- **Air:** a faint, low-alpha chromatic shimmer line along the path + 3–5 dust motes. This is the documented compromise.
- **Dark rim:** reuse the droplets' `RIM_PX` silhouette band, so small bodies don't vanish into the nebula (same reason as Phase 5).

### 6.2 Surface optics (planet shader)
- **Thin film:**
  - Phase difference δ = 4π · n_w · h · cosθ_t / λ, evaluated at λ = 650 / 532 / 450 nm.
  - Reflectance modulation is 1 − A·cos(δ) per channel over the Hg mirror (A ≈ 0.35, tuned on the look sheet).
  - h(r, t) is thicker at the centre, thinning with age.
  - Breakup: `smoothstep` on h + low-frequency noise once h < ~200 nm.
- **Hot spot:** a Planck-ratio blackbody tint (3-channel approximation) weighted by the spot's temperature, added in emission so it
  reads on the night side too.
- **Rock meniscus ring:** a ring depression around the contact radius. It reuses `mercuryMeniscus` Fresnel/rim terms so the ring
  catches light the way the planet's limb meniscus does.

## 7. Performance

- **Idle cost is zero:** the pass is hidden, `uVisitOn = 0`, and the sim early-outs.
- **Worst case:** 8 instanced quads + `VISIT_SURF_SLOTS` surface terms per fragment.
- **Phone gate:** on the OnePlus 9 Pro under `?perf=1`, a burst of 4 rapid taps (mixed elements) must hold **120 fps p50** (today's
  phase-4 baseline p50 8.5 ms). If not, phone drops to 1 surface slot and simpler water refraction (no re-intersection, mirror env
  only).

## 8. Testing

- **`visitorSim` unit tests:**
  - Flight touches down exactly at the (recomputed) strike direction at `T_FLIGHT`.
  - Per-element caps and oldest-eviction.
  - The `LEIDENFROST_K` branch on both sides.
  - Crust and frozen paths reproduce today's crater/ring calls.
  - Detach on ω threshold and on hyper.
  - The calm path (no flight, static, half life).
  - Idle does zero work.
- **Impulse kinds:** amplitudes and decay for `dimple / crown / marangoni / jet`. `marangoni` centre is negative; Phase 5 tables
  are unchanged (an equality test against today's values).
- **Planet shader parity:** with `uVisitOn = 0`, the shader matches the frozen pre-change **source-strip snapshot** (the THE SLOW
  NOON gate; live pixels differ through dither). Existing shader snapshot tests are updated deliberately, not blindly.
- **Fireworks removal:** no remaining imports; MercuryTab renders; `onElementFired` still feeds `strikesRef`.
- **Look sheet (author gate):**
  - Each element on the day side and the night side, frames at impact, +0.1, +1, +4 and +8 s.
  - Plus a 4-tap burst and a fling-detach.
  - Author's look call is the bar (socks/∞).
- **Phone gate:** §7.

## 9. Out of scope (phase 2: the matrix)

The remaining element × state pairs:
- water on frozen Hg (frost)
- fire on frozen Hg (melt pool)
- earth on soft crust (sinking)
- air on boiling Hg (vapour stripping)
- every element on crust beyond today's crater

They get their own spec once phase 1 passes the look and phone gates.

## 10. Separate, not part of this spec

The pasted layout note (move the fluid sliders down to sit with THE SLOW NOON) is a small, independent sidebar tweak:
- Its "relieves pressure on the planet" and "drag freedom" claims don't hold: the controls sit in their own 280 px grid column.
- Its dead-zone point is fair. It is to be checked against a screenshot and handled on its own.

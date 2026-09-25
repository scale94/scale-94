# Council Field — Gravitational Accretion Pass (design)

**Date:** 2026-09-25 · **Branch:** `feature/manifesto-visual-upgrade`
**Scope:** a read-only WebGL fragment layer under the Council Ring SVG. No
change to collision, synthesis, ledger, bus or state-machine behaviour.

## 1. Goal

Give the Council Ring the visual weight of the WebGL tabs (Luna, Chaos) with a
single fragment pass: a lensed photon ring at the centre, a filament that
tethers the armed mind to the cursor and then bridges the pair, and collision
dynamics (infall, detonation, jet) choreographed to the collider's own clock.

## 2. Hard constraint — the 2D loop stays the clock

`useCouncilCollider`'s Canvas2D rAF loop is not only a painter. It advances
the sim phases, calls `collide()` and opens the synthesis gate
(`completeUserSynthesis`) when EJECT completes. That loop is not moved, not
re-timed and not re-drawn. Reasons it cannot move into `useShaderCanvas`:

1. ~~`haltOnReducedMotion` would stop it — synthesis would never complete.~~
   **Corrected at plan time:** the 2D collider already does not run under
   reduced motion (`if (mq.matches) { setRunning(false); return; }`), so this
   reason was false. The design stands on reasons 2 and 3. The pre-existing
   reduced-motion gap (no collisions possible) is out of scope.
2. No WebGL (old GPU, lost context) would take the collider down with it.
3. The harness watchdog / visibility policy would shift phase timing.

The new layer is a **reader**. It observes sim + UI state through refs and
never writes to them.

### Allowed changes to `useCouncilCollider.js` (additive only)

- Return `simRef` and `uiRef` alongside the existing fields.
- Export the existing timing constants as
  `COLLIDER_TIMING = { T_INFALL, T_FLASH, T_EJECT, T_COOLDOWN }` (values
  unchanged; the local constants remain the ones the loop reads).

Nothing else in the file changes. Verified by: the existing collider,
synthesis, ledger and state-machine suites pass unmodified, and
`git diff` on the file shows only those two additions.

## 3. Layering

```
<div relative, overflow:hidden, isolation:isolate>   ← existing torus cell
  <canvas 2D>        unchanged (opaque #04040a, phosphor wash, particles)
  <canvas GL>        NEW — CouncilField, premultiplied source-over, pointer-events:none
  <svg>              unchanged except §7.9 (scaffold, nodes, labels, hit targets)
```

**Amended 2026-09-25 (rev 2).** Rev 1 composited with `mix-blend-mode:
screen`. Screen can only add light, so the event-horizon shadow could never
occlude the 2D infall particles — gold dots would render *inside* the
horizon. Rev 2 composites the GL canvas with ordinary premultiplied
source-over (the canvas default with `premultipliedAlpha: true`):

- emissive pixels output `(rgb, a = max(rgb))` — reads as additive glow;
- shadow pixels output `(0, 0, 0, a_shadow)` — genuinely occludes the 2D
  layer, so particles vanish as they cross the horizon;
- everywhere else outputs `(0,0,0,0)` — the 2D layer shows through untouched.

The 2D layer is therefore no longer pixel-identical *where the GL field is
opaque*; that is the point (§7.8). Its logic and drawing code are unchanged.
If WebGL is unavailable (`onUnsupported`), CouncilField renders nothing and
the ring behaves exactly as today.

## 4. Coordinate space

All shader geometry is in **SVG viewBox units** (`-170 0 980 640`), the same
space as `CX=320, CY=320, R_FOUNDATION=150, R_SEAT=220, R_CEILING=290`. The
canvas covers the torus cell, whose aspect equals the SVG's.

- Uniforms carry normalized ring space: `n = ((x + 170) / 980, 1 − y / 640)`.
- The shader converts back per-fragment:
  `p = vec2(uv.x * 980.0 − 170.0, (1.0 − uv.y) * 640.0)`.

## 5. Uniforms

| Uniform | Type | Source | Notes |
|---|---|---|---|
| `u_resolution` | vec2 | backing-store px | from `gl.canvas` |
| `u_time` | float | seconds, harness `tsec` | ambient motion only; never phase timing |
| `u_ui_mode` | int | `uiRef.mode` | 0 AMBIENT · 1 ARMED · 2 FIRING · 3 SYNTHESIZED |
| `u_anim_phase` | int | `simRef.phase` | 0 IDLE · 1 INFALL · 2 FLASH · 3 EJECT · 4 COOLDOWN |
| `u_phase_t` | float | `(now − sim.t0) / T_phase`, clamped 0..1 | IDLE → 0. INFALL uses `T_INFALL` (particle delays make the 2D infall end up to 900 ms later; the filament reaches the horizon at 1.0 and holds) |
| `u_seatA`, `u_seatB` | vec2 | seat positions, normalized (§4) | resolution rules §6 |
| `u_colorA`, `u_colorB` | vec3 | the seat's `arcHue` hex → linear 0..1 RGB | honours the data model; no invented "element" |
| `u_pointer` | vec2 | cursor in normalized ring space | via `svg.getScreenCTM().inverse()`; written to a ref on `pointermove`, no React state |
| `u_pointer_live` | float | 1 when a fine pointer is over the cell, else 0 | touch devices never set it |
| `u_intensity` | float | 1.0 user cycle · 0.4 ambient cycle | `sim.isUser` |
| `u_eject` | vec3 | (product angle rad, product targetR, 1 ceiling / −1 foundation) | aligns the jet with the 2D ejecta; **added beyond the agreed list — needed, see §9** |
| `u_eject_color` | vec3 | `sim.product.color` → RGB | #00FFAA ceiling · #FF0088 foundation |
| `u_phase_ms` | float | `now − sim.t0` in ms, unclamped | rev 2: the infall sheath needs raw elapsed time because particle delays (0–900 ms) outrun `u_phase_t` |
| `u_geodesic` | sampler2D | baked once (§7.1) | RG16F, LINEAR — r(b, φ) along each ray |
| `u_deflect` | sampler2D | baked once (§7.1) | R16F 1024×1, LINEAR — total deflection α̂(b) |
| `u_matter` | sampler2D | baked once (§7.3) | R8 512×512, REPEAT — tileable noise in (log r, ψ) |

Mapping lives in one pure function, `readFieldUniforms(sim, ui, seated,
pointer, nowMs)`, returning plain arrays/numbers. It is the unit-tested seam;
`draw` only uploads what it returns.

`now` for `u_phase_t` is the rAF timestamp, the same clock the 2D loop uses
for `sim.t0`.

## 6. Seat resolution (deterministic priority)

1. **ARMED** — A = armed mind's seat. B = `u_pointer` if `u_pointer_live`,
   else B = A (filament collapses; a standing pulse at A remains).
   An in-flight ambient collision continues in the 2D layer only; the GL
   filament belongs to the armed mind.
2. **FIRING / SYNTHESIZED** — if `sim.isUser`, A, B = `sim.pair` seats and
   the anim phase drives dynamics. If the sim is still finishing an ambient
   cycle (`!sim.isUser`), A, B = `ui.pair` seats (looked up by dimIndex) as a
   static bridge with `u_anim_phase` forced to IDLE, so an ambient pair is
   never drawn at user intensity.
3. **AMBIENT with a live sim pair** — A, B = `sim.pair` seats, `u_intensity`
   0.4.
4. **No pair** (`sim.pair == null`, or IDLE / COOLDOWN in AMBIENT) —
   filament off; photon ring still renders.

## 7. Visual payload (rev 2 — replaces rev 1's reticle)

### 7.0 Scene geometry

A Schwarzschild black hole at the ring centre `(CX, CY)`, seen by a distant
observer at inclination `i` to the disk axis.

| Quantity | Value | viewBox units |
|---|---|---|
| `r_s` (Schwarzschild radius) | — | 14 u |
| photon-sphere orbit | 1.5 r_s | 21 u (not directly visible) |
| shadow edge on screen, `b_c = (3√3/2) r_s` | 2.598 r_s | 36.4 u |
| disk inner edge (ISCO) | 3 r_s | 42 u |
| disk outer edge | 10 r_s | 140 u — just inside `R_FOUNDATION` (150) |
| inclination `i` | 80° (decided, §9 Q1) | — |

Rev 1 placed its bright ring at 1.5 r_s *on screen*. That was wrong: 1.5 r_s
is the orbit radius, and its image is the shadow edge at `b_c`. Rev 2 derives
every on-screen radius from the geodesic tables below, never by hand.

Nodes and labels (R_SEAT = 220 u) sit well outside the disk. Beyond
r = 160 u, nothing in §7 except the filament and jet may exceed linear
luminance 0.10.

### 7.1 Geodesic tables — exact Schwarzschild, baked once

Photon orbits obey the Binet equation `d²u/dφ² = −u + (3/2) r_s u²`, with
`u = 1/r`. Because the metric is spherically symmetric, a ray's whole path
depends only on its impact parameter `b`, so lensing is precomputed rather
than ray-marched:

- **`u_geodesic` (512 × 512, RG16F).**
  - Rows: `b` from 0 to 24 r_s, sampled as `b = b_c + w·sinh(x)` so rows
    concentrate at the photon ring, where higher-order images are
    exponentially thin.
  - Columns: orbital angle `φ` from 0 to 3π.
  - R: `r(b, φ)` in r_s units, 0 once captured (r ≤ r_s).
  - G: the sign of `dr/dφ`, so outbound and inbound crossings can be told
    apart.
- **`u_deflect` (1024 × 1, R16F).** Total deflection `α̂(b)` for escaping
  rays (b > b_c), used for background sources (§7.5).

`councilGeodesics.js` integrates both tables on the CPU at first mount:
pure JS, RK4 at a fixed step Δφ = 0.004, deterministic. It caches them at
module level, and `onInit` uploads them.

- Budget: under 30 ms, once.
- RG16F and R16F textures support LINEAR filtering in core WebGL2, so no
  float-linear extension is needed.

### 7.2 The disk image — primary and secondary

Take an image-plane pixel at offset `(X, Y)` from the centre, in r_s units:
`b = |(X, Y)|`, `α = atan2(Y, X)`. The ray's orbital plane meets the
inclined disk plane at orbital angle
`γ = arccos( cos α / sqrt(cos²α + cot²i) )` (Luminet 1979, eq. 10).

- **Primary image (n = 0):** sample `r0 = r(b, γ)`.
- **Secondary image (n = 1):** sample `r1 = r(b, γ + π)`. This ray wraps
  behind the hole and shows the far side of the disk from underneath. It is
  the thin inner ring hugging the shadow, and it is where the caustic
  structure lives.
- **n = 2** is skipped: its width is about e^{−2π} of n = 1's, which is
  sub-pixel at this scale even at DPR 2.

A crossing counts when `3 ≤ r_n ≤ 10` and the ray has not been captured
before reaching `γ + nπ`. Emission from both images is summed; where both
land on the disk, the primary occludes the secondary.

If `b < b_c` and the ray crosses no disk, the pixel is **shadow** and
outputs `(0,0,0,1)`. The shadow edge is never drawn explicitly; it emerges
from the table.

### 7.3 Disk matter — Keplerian shear without wind-up

- **Rotation.** Angular velocity `Ω(r) = Ω_isco · (r/3)^{−3/2}`, so
  `v ∝ r^{−1/2}`. The inner edge takes 7 s per orbit and the outer edge
  ~43 s: slow enough to watch, never frantic.
- **Matter.** Sampled from `u_matter`, a tileable noise baked at init in
  `(log r, ψ)` coordinates, where ψ is the disk azimuth of the crossing
  point, derived from α, i and n. Two octaves take two fetches at different
  scales. Using log r stretches filaments into the spiral streaks of a
  sheared disk.
- **Wind-up.** Advecting directly by `ψ − Ω(r)·t` lets the shear grow
  without bound. Within minutes neighbouring radii are thousands of radians
  apart, the texture aliases into moiré, and the disk looks *banded*. The fix
  uses two flow layers offset by half a period (`T_flow = 14 s`):
  - each layer is re-seeded while its weight is zero;
  - the layers are crossfaded with a triangle weight and the contrast is
    renormalised, so the crossfade does not pulse;
  - winding is therefore bounded to at most one `T_flow`.
- **Radial falloff.** Novikov–Thorne-shaped emissivity
  `F(r) ∝ r^{−3} (1 − sqrt(3/r))`. It is zero at the ISCO, peaks near
  4.1 r_s and decays outward, giving a soft inner lip instead of a hard edge.

### 7.4 Temperature, Doppler beaming, gravitational redshift

- **Temperature:** `T(r) ∝ r^{−3/4} (1 − sqrt(3/r))^{1/4}`, normalised to a
  peak of ≈ 12 000 K. This is a render scale, not astrophysical units.
- **Redshift factor** for a circular Keplerian orbit seen at inclination i
  (Luminet 1979), in r_s units:
  `1 + z = (1 − 3/(2r))^{−1/2} · (1 + sqrt(1/(2r³)) · b · sin i · sin α)`,
  and `g = 1/(1+z)`.
- **Observed:** `T_obs = g · T(r)` and `I = g⁴ · F(r) · matter`. The
  approaching side is brighter *and* bluer, the receding side dimmer and
  redder, and the inner edge shows gravitational redshift.
- **Colour:** `T_obs` goes through an analytic blackbody-to-linear-sRGB fit
  along the Planckian locus (1 000–40 000 K). The inner edge is blue-white
  and the outer edge a deep accretion ember (≈1 800 K, around `#6b1a05`).
  There are no hand-picked gradient stops.

### 7.5 Tether and bridge — lensed background sources

The tether (ARMED: seat A → `u_pointer`) and the bridge (pair locked: A ↔ B)
live in the diagram plane. The shader treats that plane as a **background
source behind the hole**:

- Each pixel's source-plane position is found by un-deflecting along its
  impact direction by `α̂(b)` from `u_deflect`. The source distance is chosen
  so the Einstein radius is ≈ 3.5 r_s.
- The lens term tapers to zero by `r = R_FOUNDATION`, so filament endpoints
  stay pinned exactly to the SVG node centres.
- **Intended consequence:** a bridge between near-opposite seats passes
  through the centre and is lensed into two Einstein arcs around the shadow.
  A tether whose cursor passes behind the hole wraps around it.
- **Filament profile:** a distance-field core (1 u) plus a halo
  `exp(−d²/σ²)` with σ = 5 u.
  - The tether is `u_colorA` with a white core.
  - The bridge runs `u_colorA → u_colorB` by arc length, with 9 u endpoint
    discs.
  - A travelling tension pulse, `sin(s·0.4 − u_time·6)`, swings brightness
    by ±15%.

### 7.6 INFALL — the filament becomes the particle streams' sheath

In the 2D draw loop of `useCouncilCollider.js`, each particle follows an
exact path. Angles are in degrees, using the `polarToXY` convention
(clockwise from 12 o'clock):

```
r     = R_SEAT · (1 − easeInCubic(prog))
θ     = seat.angle + wobble·prog + (SPIRAL_GAIN·180/π)·(1 − r/R_SEAT)
prog  = (t − delay) / T_INFALL
delay ∈ [0, 900] ms,  wobble ∈ [−7°, +7°]
```

The GL infall does not approximate this path. It **is** the path's envelope:

- There are two spiral arms, one per seat, each following that same `θ(r)`
  curve. Each arm runs from the leading particle (`delay = 0`, from
  `u_phase_ms`) back to the trailing one (`delay = 900`).
- An arm's half-width equals the wobble spread at that radius (`7°·prog`,
  converted to u) plus the 5 u halo, so every 2D particle stays inside its
  arm's glow.
- The arm heads accelerate inward on the same `easeInCubic`. At `b_c` they
  vanish into the shadow, together with the 2D particles, which the shadow
  now occludes (§3 rev 2).
- The disk brightens by `× (1 + 1.2·u_phase_t)` as matter feeds it.

Test §10.3 ports the path to a JS mirror of the GLSL and asserts it matches
the 2D loop's `(x, y)` to within 1e-6 u across the phase.

### 7.7 FLASH — detonation at the horizon

- **White-hot core.** A Gaussian with radius `r_c = b_c·(1 + 2.5·t)` and a
  peak linear luminance of 6.0 before tone-mapping. It clips to white and
  engulfs the 2D gold dot (radius ≤ 48 u).
- **Chromatic aberration.** The disk and core are evaluated three times,
  with R and B shifted radially by `±1.8 u·(1 − t)`. That triples the disk
  cost, but only for FLASH's 380 ms.
- **Photon-ring flare.** The n = 1 image brightens by `× (1 + 8·(1−t)²)`, a
  ring of light racing around the shadow.

### 7.8 EJECT — relativistic jet

- **Axis and head.** The jet runs along `u_eject.x`, with its head at
  `u_eject.y · easeOutCubic(u_phase_t)`: the same position as the 2D product
  dot.
- **Profile.** A cone with a 3° half-angle and emission
  `∝ (1 − s/L)^{0.5}` along its length. The 7 u knot at the head is larger
  than the 2D dot (≤ 4.5 u), so it envelops the dot.
- **Beaming.** The jet is relativistic (Γ ≈ 3):
  - the approaching jet takes `D⁴` Doppler boosting;
  - the counter-jet takes the receding factor, leaving it at ~1% brightness,
    faint but present.
- **Colour.** `u_eject_color`, pushed to white in the knot core.
- **Dissipation.** Emission decays as `(1 − u_phase_t)^{1.5}`. The boundary
  flash at the ceiling or foundation stays in the 2D layer, which already
  draws it.

### 7.9 Finish

- Tone-map with `1 − exp(−1.4·c)`, then apply a ±0.5/255 ordered dither
  before output.
- Output is premultiplied, per §3 rev 2.
- **SVG change (visual only):** `RingScaffold`'s centre glyph `◉` is hidden
  while CouncilField is live, because the rendered shadow replaces it. It
  stays when WebGL is unavailable.

## 8. Lifecycle (shared harness)

`CouncilField.jsx` uses `useShaderCanvas` with the ColliderChamber profile:
`version: 2`, `strategy: 'lunar'`, `contextOptions { alpha: true,
premultipliedAlpha: true, antialias: false }`, `blend: 'premultiplied'`,
`trackVisibility: true`, `watchdogMs: 40`, `deps: []`. Props reach `draw`
only through refs. A `ResizeObserver` on the cell calls `host.resize(w, h)`
(height = `w · 640/980`), then `snap()`.

- **`onInit`** uploads the three baked textures (§7.1, §7.3).
- **`onDispose`** deletes them before the host deletes the program.
- **Reduced motion:** the harness loop halts and `onSnap` paints one frame:
  the disk at `t = 0`, plus a static filament if ARMED or locked. It
  re-snaps whenever the UI mode changes. The 2D collider and synthesis are
  unaffected.
- **Mobile / touch:** `u_pointer_live` stays 0, so ARMED shows a standing
  pulse at A.

### 8.1 Performance contract — full DPR, no downsampling

- The field renders at the harness DPR on every frame. There is **no**
  reduced-resolution fallback.
- **Budget: < 1.0 ms of GPU time per frame** at 1440 CSS width and DPR 2
  (a field of ≈ 1.8 × 1.2 Mpx).
- **Per-pixel cost when fully lit:**
  - 2 geodesic fetches (n = 0, 1)
  - 1 deflection fetch
  - 4 matter fetches (2 octaves × 2 flow layers)
  - about 120 ALU ops
- **Early-outs:**
  - disk math is skipped for `b > 10.5 r_s` outside the infall and jet
    regions;
  - filament math is skipped outside its bounding capsule;
  - jet math is skipped outside its cone's bounding box.
- **Measurement:** use `EXT_disjoint_timer_query_webgl2` where the browser
  exposes it; otherwise use the Chrome Performance panel's GPU track, on the
  owner's machine.
- **If over budget:** reduce per-pixel work (drop to one noise octave,
  tighten the early-outs), **never** resolution.
- **Existing DPR cap:** `glHost` already caps DPR at 2 for every GL surface
  in the terminal, so phones at DPR 3 render at 2, as Luna and Scent do
  today. This spec does not change that cap.

## 9. Decisions and flagged deviations

**Q1 — Inclination: DECIDED 2026-09-25, `i = 80°`** (the Gargantua
silhouette; `i = 30°` was the alternative, rejected). Consequences written
into the design:

- **Orientation.** The disk's line of nodes is horizontal, so its major axis
  points at the west (canon) and east (sidelined) hemispheres. Projected, the
  disk is a thin band (`cos 80° ≈ 0.17`) spanning ±140 u. The lensed far
  side arcs over *and* under the shadow; the secondary image sits as a thin
  ring on the shadow edge.
- **Beaming is extreme at this angle, and stays physical.** At the ISCO,
  the Luminet factor gives `g ≈ 1.5` on the approaching side and `g ≈ 0.46`
  on the receding side, a `g⁴` ratio of ≈ 125×.
  - The approaching side clips to blue-white under the tone-map.
  - The receding side falls to a faint deep-ember glow.
  - This is not softened. Interstellar dropped Doppler for legibility; this
    spec keeps it, as the NASA visualisations do.
- **Which side approaches** is set by one sign (`u_spin_sign`, a
  compile-time constant). Default `+1`: the **east (sidelined)** side
  approaches and burns bright, so the instrument readers the species
  sidelined are the ones rushing toward the viewer. Flipping it hands the
  bright side to the canon builders. This thematic default is open to veto
  at spec review.
- **Collision with the ring furniture.**
  - The band's horizontal extent (±140 u) stops 10 u short of the
    social-foundation circle.
  - The lensed hump rises to ≈ 105 u above and below the centre, inside the
    seat radius (220 u).
  - The 2D infall spirals cross the band. The §7.6 sheaths therefore pass in
    front of the disk: filaments are composited over disk emission, never
    occluded by it.
- **γ formula.** At `i = 80°`, `cot²i ≈ 0.031`, so `γ` stays close to `α`
  except near `α = ±90°`, where the table resolution already concentrates.

**Flagged deviations** from the agreed uniform list:

- `u_ui_mode` has four values (AMBIENT, ARMED, FIRING, SYNTHESIZED), the
  state machine's real modes; there is no `IDLE` UI mode.
- `u_eject` and `u_eject_color` are added. Without them the jet cannot line
  up with the 2D ejecta.
- `u_pointer_live` is added, to tell "cursor at (0,0)" from "no cursor".
- `u_phase_ms` and three sampler uniforms are added (rev 2, §5).
- The §3 composite changes from screen to premultiplied source-over
  (rev 2).

## 10. Testing

1. **Logic invariance.** The collider, synthesis, ledger and state-machine
   suites pass with zero edits to their test files. A diff audit of
   `useCouncilCollider.js` shows only the two additions from §2.
2. **`readFieldUniforms` unit tests:**
   - every (ui mode × anim phase) cell of §6;
   - `u_phase_t` clamping at each phase boundary;
   - hex → RGB for all 9 rainbow hues;
   - pointer-live gating;
   - ambient vs user intensity.
3. **Path coherence.** The JS mirror of the GLSL infall-arm curve matches
   the 2D particle path to within 1e-6 u for all 16 seats. The jet head
   matches the 2D product position to the same tolerance.
4. **Geodesic physics (`councilGeodesics.js`):**
   - the capture threshold lands at `b_c = 3√3/2 r_s` within 0.1%;
   - weak-field deflection matches `2 r_s / b` within 1% at b = 50 r_s;
   - a ray at `b = b_c + 1e-3` winds more than 2π before escaping;
   - two bakes are bit-identical.
5. **Wind-up bound.** The matter-coordinate function stays within one
   `T_flow` of shear at t = 0, 60 s, 3 600 s and 86 400 s.
6. **GL call-log snapshot**, using the harness method (`recordingGL` +
   `driveFrames`): init, texture upload and a short frame run, captured once
   and frozen.
7. **Unsupported path.** When `getContext` returns null, CouncilField renders
   nothing, `◉` stays, and the existing ring tests pass.
8. **Browser verification** at 1440 and 375 width:
   - screenshots of AMBIENT, ARMED with the tether following the cursor, the
     bridge (including an opposite-seat Einstein-arc case), mid-INFALL with
     the particles inside the sheaths, FLASH and EJECT;
   - one full user collision through to SYNTHESIZED, confirming the
     synthesis panel still appears;
   - a 60 s screen recording, checked by eye for crossfade pulsing and
     banding;
   - a GPU frame-time reading against §8.1.

## 11. Out of scope

- Moving the *drawing* of particles, flash or ejecta out of the 2D layer.
  Rev 2 envelops and occludes them instead.
- A bloom or post-processing chain (the three.js stack).
- The Kerr (spinning) metric. Schwarzschild only.
- Kernel Manual switchboard styling (separate spec).
- Any change to `expand()` or `collide()` (locked; see the council-ring
  record).

## 12. Plan-time amendments (2026-09-25)

Recorded while writing the implementation plan
(`docs/superpowers/plans/2026-09-25-council-field-accretion.md`), which
lists each with its reason:

1. **§2, reason 1 is factually wrong.** Today the 2D collider does **not** run under reduced motion (`useCouncilCollider.js` gate: `if (mq.matches) { setRunning(false); return; }`), so reduced-motion users already cannot fire a collision. The architecture still stands on reasons 2 (no-WebGL resilience) and 3 (timing policy). The reduced-motion gap predates this work and is out of scope.
2. **§7.1 tables.**
   - `u_geodesic` is R16F (one channel). The capture (0) and escape (FAR) sentinels make the proposed G channel redundant.
   - `u_deflect` is 256 wide, not 1024. Deflection is smooth away from `b_c`, where the sinh warp already concentrates samples, and baking 1024 escape integrations breaks the 30 ms budget.
3. **§7.4 temperature exponent.**
   - The physical `T ∝ F^{1/4}` spans only 12 000 K → 8 200 K across 3–10 r_s, so it can never reach the ember at the outer edge that §7.4 also asks for.
   - The plan uses `T = T_PEAK · (F/F_MAX)^{T_EXP}`, with `T_EXP ≈ 1.237` fitted so that `T(10 r_s) = 1 800 K`. This keeps the Novikov–Thorne peak location (49/12 r_s) and the zero-torque inner edge. It is render-scale, not physical.
4. **§5 uniforms added.**
   - `u_flow` (vec4: `tau0, tau1, seed0, seed1`) and `u_flow_w`: flow phases are computed in float64 JS, because float32 `fract(t/T)` in GLSL degrades after long uptimes.
   - `u_lens_d`: the source distance that sets the Einstein radius to 3.5 r_s.
5. **§6 refinements.**
   - SYNTHESIZED at rest draws no bridge. A permanent bridge would also appear on a hydrated reload that never flew.
   - A user cycle's COOLDOWN keeps intensity 1, and an ambient COOLDOWN keeps 0.4, so the disk boost relaxes instead of snapping. No filament is drawn in COOLDOWN.
6. **§10.4 weak-field test.** "`2 r_s/b` within 1% at b = 50" is wrong: the second-order term alone is 2.9% there. The plan tests `2 r_s/b` within 0.5% at b = 500, and the third-order expansion `4x + (15π/4)x² + (128/3)x³` (x = M/b) within 0.1% at b = 50.
7. **§7.4 blackbody range.** The Kim et al. (2002) Planckian-locus fit is valid from 1 667 to 25 000 K, not 1 000–40 000 K. Temperatures are clamped to that range.
8. **§7.2 / §7.4 angle convention (fix wave, 2026-09-25).** The shader measures the image-plane angle α from +X (east, along the line of nodes), not from the axis Luminet (1979) uses, so the formulas as written in §7.2 and §7.4 appear rotated by π/2 in the code (`α_Luminet = α + π/2`):
   - §7.2's `γ = arccos(cos α / sqrt(cos²α + cot²i))` becomes `phi0 = atan(COS_I, −sinA·SIN_I)` in `diskAt` (the same angle: `cos γ = −sin α · sin i / sqrt(cos²i + sin²α · sin²i)`).
   - §7.4's Doppler term `sin i · sin α` becomes `SIN_I · cosA` in `diskEmission` and in `redshiftFactor` (councilFieldPhysics.js).
   - This is deliberate: it puts the line of nodes on the horizontal (§9 Q1), with the approaching side east. Do not "fix" the shader back to the §7 formulas as written.

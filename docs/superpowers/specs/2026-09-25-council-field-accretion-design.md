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

1. `haltOnReducedMotion` would stop it — synthesis would never complete.
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
  <canvas GL>        NEW — CouncilField, mix-blend-mode: screen, pointer-events:none
  <svg>              unchanged (scaffold, nodes, labels, hit targets)
```

The GL canvas clears to transparent black each frame and is composited with
`screen`, so it can only add light. The 2D output beneath is pixel-identical
to today. `isolation: isolate` on the cell keeps the blend from reaching
page content outside the ring. If WebGL is unavailable (`onUnsupported`),
CouncilField renders nothing and the ring behaves exactly as today.

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

## 7. Visual payload

Composition order inside the fragment shader (all additive, then one
tone-map):

**7.1 Lensed grid + photon ring (always on).**
A faint polar grid (rings every 20 u, 16 spokes aligned to the seat angles)
is sampled through a gravitational deflection
`p' = p − dir · (k · rs² / max(r, rs))` pulling toward `(CX, CY)`, with
`rs` ≈ 18 u. Grid luminance ≤ 0.05 and fades out before `R_SEAT − 20` so
node labels keep their contrast. The photon ring is a thin (≈1.2 u) bright
annulus at `r ≈ 1.5 rs`, Doppler-brightened on one side
(`1 + 0.35·cos(θ − u_time·0.2)`), slowly precessing. It sits over the
existing `◉` glyph.

**7.2 Tether (ARMED).**
A geodesic from A to B: the straight chord bent toward the centre by the same
deflection field (sampled as a quadratic Bézier whose control point is the
chord midpoint pulled toward CX,CY by `k / dist_to_centre`). Core width
≈1 u, soft halo ≈6 u, colour gradient `u_colorA → white → u_colorA`
(single mind), with a travelling tension pulse (`sin(s·40 − u_time·6)`
modulating brightness ±15%).

**7.3 Bridge (pair locked).**
Same geodesic, dual colour `u_colorA → u_colorB`, core brightness ×1.8,
glowing endpoint discs (radius ≈9 u) in each seat's colour.

**7.4 INFALL** (`u_phase_t` 0→1): the Bézier control point slides from the
chord midpoint to the centre along `easeInCubic` (the curve the 2D particles
use), so the filament is dragged into the horizon. Filament width narrows
1→0.3; the photon ring brightens ×(1 + 1.5·t).

**7.5 FLASH** (`u_phase_t` 0→1): white-hot core, radius
`rs · (1 + 3·t)`, brightness `(1 − t)²`. Chromatic aberration: the core and
photon ring are evaluated three times with radial offsets
(R +1.5 u·(1−t), G 0, B −1.5 u·(1−t)). Only during FLASH, so the 3× cost is
bounded to 380 ms.

**7.6 EJECT** (`u_phase_t` 0→1): a relativistic jet along `u_eject.x`,
reaching `u_eject.y · easeOutCubic(t)` (the 2D product's path), colour
`u_eject_color`, a tapered cone (half-angle 4°) with a bright knot at the
head and `(1 − t)` dissipation along the length. On the opposite side, a
fainter counter-jet at 30% intensity.

**7.7 COOLDOWN** — filament off; photon ring relaxes back to baseline over
the phase.

**7.8 Finish.** Tone-map `1 − exp(−c · 1.4)`, then ±0.5/255 ordered-dither
before output (dark radial gradients on a near-black ground band otherwise).
Output premultiplied; alpha = max channel.

## 8. Lifecycle (shared harness)

`CouncilField.jsx` uses `useShaderCanvas` with the ColliderChamber profile:
`version: 2`, `strategy: 'lunar'`, `contextOptions { alpha: true,
premultipliedAlpha: true, antialias: false }`, `blend: 'premultiplied'`,
`trackVisibility: true`, `watchdogMs: 40`, `deps: []`. Props reach `draw`
only through refs. A `ResizeObserver` on the cell calls `host.resize(w, h)`
(height = `w · 640/980`), then `snap()`.

**Reduced motion:** the harness loop halts; `onSnap` paints one frame —
photon ring and, if ARMED/locked, a static filament. Re-snapped on UI-mode
change. The 2D collider and synthesis are unaffected (they never depended on
the harness).

**Mobile / touch:** `u_pointer_live` stays 0, so ARMED shows the standing
pulse at A; the bridge and collision dynamics render as on desktop.

## 9. Deviations from the agreed uniform list (flagged)

- `u_ui_mode` has four values (AMBIENT, ARMED, FIRING, SYNTHESIZED) — the
  state machine's real modes; there is no `IDLE` UI mode.
- `u_eject` + `u_eject_color` added: without them the jet cannot align with
  the 2D ejecta's angle, radius and trajectory colour.
- `u_pointer_live` added: distinguishes "cursor at (0,0)" from "no cursor".

## 10. Testing

1. **Logic invariance:** collider / synthesis / ledger / state-machine suites
   pass with zero edits to their test files. Diff audit of
   `useCouncilCollider.js` = the two additions in §2 only.
2. **`readFieldUniforms` unit tests:** every (ui mode × anim phase) cell of
   the seat-resolution table (§6); `u_phase_t` clamping at each phase
   boundary using `COLLIDER_TIMING`; hex→RGB for all 9 rainbow hues;
   pointer-live gating; ambient vs user intensity.
3. **GL call-log snapshot** (harness method: `recordingGL` + `driveFrames`)
   for init + a short frame run, captured once and frozen.
4. **Unsupported path:** `getContext` → null ⇒ CouncilField renders nothing,
   ring still arms/fires/synthesizes (existing ring tests).
5. **Browser verification** at 1440 and 375 wide: screenshots of AMBIENT,
   ARMED + tether following the cursor, bridge, INFALL mid-phase, FLASH,
   EJECT; one full user collision to SYNTHESIZED confirming the synthesis
   panel still appears; frame-time check (target: GL pass < 4 ms at 1440 on
   the owner's 360 Hz panel; if over, render the field at DPR 1).

## 11. Out of scope

- Moving particles, flash or ejecta out of the 2D layer.
- Bloom / post chain (three.js stack). The tone-map + halo terms stand in.
- Kernel Manual switchboard styling (separate spec).
- Any change to `expand()` / `collide()` (see council-ring memory: locked).

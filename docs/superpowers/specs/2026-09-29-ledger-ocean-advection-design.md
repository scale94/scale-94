# Ledger Ocean — Advection Field Design

**Date:** 2026-09-29
**Status:** Approved in brainstorming, pending spec review
**Branch:** `feature/ledger-advection`
**Origin:** draft prompt "ledger tab visual upgrades brainstorming" (Wren persona), critiqued and reworked

## Problem

The `/system/ledger` hero is `LedgerMap`: a static SVG world map with pulsing
verdict dots. Pollution reads as a point. Nothing shows that a discharge goes
anywhere — that local BOD, heat and nitrate leave the river and enter a shared
ocean.

## Goal

Replace the hero with a real-time advection–diffusion–reaction ocean driven by
the ledger's own verdicts. Every audited river drains into it; each pollutant
fades at its own physical rate, so plumes separate into colour bands as they
travel. The ocean becomes the physical ledger: the cumulative account of every
unpaid debt.

## Locked decisions

| # | Decision | Rejected |
|---|---|---|
| 1 | **Verdict drives the plume; the sim never writes back.** Verdicts stay the CHRONOS kernel's hashed output. The draft's "plume density feeds back into verdicts" would make the hash certify a shader. | sim as recorded instrument; feedback loop |
| 2 | **Sources = ambient baseline + the visitor's ledger.** The 9 presets always inject (dim); every archived verdict is a permanent brighter source. A first visit is never a dead ocean. | active-case only; presets only |
| 3 | **Name stays LEDGER.** Route `/system/ledger`, internal id `ledger`, `LedgerSealIcon` unchanged. The header carries the new identity. | OUTFALL, EFFLUENT, ADVECTION |
| 4 | **Flat equirectangular world, east–west periodic.** Whole ocean visible; a Yangtze plume can be followed across the Pacific in one frame. | globe; flat+globe toggle |
| 5 | **The form is the slider.** Unsubmitted form values drive a dashed provisional "ghost" source live; submit seals it. Sealed sources are immutable. Time compression is a separate viewing control. | what-if sliders on sealed sources; no controls |
| 6 | **Raw WebGL2 on the shared GL harness**, with a CPU reference step as test oracle. | R3F + drei `useFBO`; CPU-only sim |
| 7 | **Danube included**, course starting at Linz (Ars Electronica). | — |

## 1. State and colour

One RGBA float texture, 512×256. Each channel is an audit quantity with its
own physical rate. All rates are per **simulated day**; time compression only
maps wall-seconds to days, it never changes physics.

| ch | quantity | kinetics | colour |
|---|---|---|---|
| R | thermal excess ΔT (°C over ambient) | relaxation, e-folding τ_T ≈ 3 d — fades **first** | chemical crimson |
| G | BOD load L (mg/L) | first-order decay k_d(T) = k_d20 · 1.047^(T−20) | toxic amber |
| B | nitrate N (mg/L) | slow uptake, e-folding τ_N ≈ 60 d — travels **furthest** | radioactive green |
| A | oxygen deficit D (mg/L) | dD/dt = k_d·L − k_a·D (Streeter–Phelps reaction) | rendered as **absence of light** |

Streeter–Phelps' familiar sag-vs-distance curve assumes plug flow in a
channel, but its reaction is a local linear ODE. The river stage and every
ocean cell run the **same kinetics**; only transport differs.

Composite pass:

- Additive emission of R/G/B channel colours, each through a per-channel
  logarithmic exposure (ocean concentrations are genuinely dilute; log
  exposure keeps them visible without faking magnitudes). HDR sum tonemapped;
  full overlap near a mouth goes near-white.
- Deficit darkens emission toward the abyssal base (`#050505`–`#080808`), so
  a dead zone reads as a void inside its plume.
- A thin bioluminescent-cyan rim traces the deficit field's gradient
  magnitude: the boundary where oxygenated water begins.
- Slight chromatic aberration and 1-px scanline grain. **No bloom.**
- Land: flat near-black with the coastline drawn from `worldMapPolys` at low
  alpha.

Emergent read: at the mouth all channels overlap (white-hot); downstream
crimson dies within days, amber stretches along the current, a long green
tail outlives both. Colour encodes time-since-discharge because the maths
does, not because it is painted.

## 2. Ocean: grid, currents, numerics

### Grid

- 512×256 cells, equirectangular, ~78 km per cell at the equator.
- Simulated band 78°S–78°N; poleward rows are land (ice), keeping the cos φ
  metric bounded.
- x wraps (`REPEAT`); y clamps.
- Land mask rasterised once from `worldMapPolys` by a pure-JS scanline
  rasteriser (runs in jsdom).

### Currents: stream function

u = curl ψ, so the flow is divergence-free by construction.

- ψ = sum of analytic cells:
  - Subtropical gyres: N/S Pacific, N/S Atlantic, Indian. Stommel form, so
    western boundary currents (Kuroshio, Gulf Stream, Brazil Current) come out
    narrow and fast from the maths.
  - Subpolar gyres: N Pacific, N Atlantic.
  - Antarctic Circumpolar Current as a zonal band near 55°S.
  - Regional cells for the source rivers: Gulf Loop Current (Mississippi),
    East China Sea shelf drift toward the Kuroshio (Yangtze), Tsushima Current
    up the Sea of Japan (Hamhung), North Sea anticlockwise circulation
    (Rhine), Bay of Bengal (Ganges), Java Sea (Citarum), Black Sea Rim Current
    — anticlockwise (Danube), Brazil Current shelf (Rio Doce), Ionian coastal
    drift (Blue Eye / Bistrica).
- ψ is multiplied by a coastal ramp m ∈ [0,1] (0 on land, 1 at ~3 cells
  offshore) **before** the curl, making every coastline a streamline: no
  flow into land.
- Discretisation: ψ on cell corners, velocity on cell faces (Arakawa-C), so
  discrete divergence is zero to rounding. Cell-centre velocities for the
  back-trace are face averages.
- Units: km/day, with the cos φ metric applied to the zonal component when
  converting to cells/day.
- Baked once on the CPU at mount into an RG float texture.
- The Bay of Bengal and Java Sea currents are monsoon-reversing; one season is
  frozen. HUD legend states `CLIMATOLOGICAL CURRENTS · NOT FORECAST`.
- The Bosporus is sub-grid, so the Black Sea is closed at this resolution and
  Danube dye accumulates there (true to its long residence time).

### Step

Fixed Δt = 0.25 simulated days. Three passes per step:

1. **Advect** — BFECC (forward/back error-compensated semi-Lagrangian) with a
   min/max limiter clamping each result to its four bilinear source texels.
   Keeps filaments sharp; the limiter prevents overshoot and negatives. A
   back-trace landing on land returns the cell's own value.
2. **Diffuse** — explicit 5-point Laplacian; land neighbours mirror the centre
   value (zero-flux). Auto-substeps so D·Δt/Δx² ≤ 0.2.
3. **React + inject** — exact closed-form solution over Δt (exponentials for
   R/G/B; the Streeter–Phelps two-exponential term for A, with the k_d = k_a
   degenerate case handled explicitly), stable at any Δt. Source splats added
   here (§3).

Every pass ends: NaN → 0 (`x != x`), clamp ≥ 0, land cells = 0.

### Clock

- `wall Δt × compression` accumulates into an integer number of sim steps,
  capped at 8 per frame (4 if the rolling frame time exceeds 20 ms).
- **Nothing is frame-counted.** A 60 Hz and a 360 Hz stream covering the same
  wall time produce identical states (tested).
- Compression presets: `1 s = 1 d / 3 d / 9 d / 30 d`, default 9 d.

### Fallbacks

- WebGL2 + `EXT_color_buffer_float` (+ `OES_texture_float_linear` for
  bilinear sampling; without it, sample manually in-shader).
- Else `EXT_color_buffer_half_float` with half-float targets.
- Else: a still frame computed by the CPU oracle at mount, displayed as a
  texture, with the HUD reading `STATIC · NO FLOAT TARGETS`.
- `prefers-reduced-motion`: the oracle-equivalent GPU run of ~200 simulated
  days at mount, then frozen on that state.
- Context loss and hidden-pane suspension come from `frameLoop` / `glHost`.

## 3. Rivers and sources

### Preset data

The existing kernel fields in `auditPresets.js` stay **byte-identical**. Each
preset gains a `river` block:

```js
river: {
  course: [[lon, lat], ...],   // audit site → mouth, ~15–40 vertices
  dischargeM3s: 6500,          // real mean discharge at the mouth
  manning: { n: 0.03, R: 6, S: 0.00007 },  // reach-averaged
  sources: { course: '…', dischargeM3s: '…', manning: '…' }, // or 'UNVERIFIED'
}
```

Every numeric field carries a source note or the literal `'UNVERIFIED'`
(Hamhung already has no public data).

### The 9 sources

Existing 5 (kernel values unchanged; `river` block added):

| key | audit site → mouth | approx. Q (m³/s), to source |
|---|---|---|
| `mercury` | Blue Eye → Bistrica → Ionian Sea near Sarandë | ~18 |
| `germany` | Rhine at Cologne → Hook of Holland | ~2,300 |
| `usa` | Mississippi at New Orleans → Head of Passes (~29.15°N, 89.25°W) | ~17,000 |
| `brazil` | Rio Doce at Regência (site is the mouth; course length 0) | ~900 |
| `north_korea` | Hamhung → Sea of Japan (short course) | UNVERIFIED |

New 4 (kernel values derived in phase 3 by the 2026-07-19 method: tuned
against `severityEngine.js` thresholds toward a stated tone):

| key | site → mouth | target tone | approx. Q, to source |
|---|---|---|---|
| `yangtze` | Yangtze estuary (31.23°N, 121.47°E) → East China Sea | critical | ~30,000 |
| `ganges` | Sundarbans (21.95°N, 89.18°E) → Bay of Bengal | critical | see note |
| `citarum` | Citarum lower basin (6.12°S, 107.03°E) → Java Sea | critical | small; to source |
| `danube` | **Linz** (48.31°N, 14.29°E) → Sulina mouth (~45.15°N, 29.75°E) | safe/stress | ~6,500 |

- Ganges note: the Sundarbans distributaries carry far less than the combined
  Ganges–Brahmaputra–Meghna outflow (~38,000 m³/s, which exits mainly via the
  Meghna estuary further east). Phase 3 picks one honestly: either keep the
  Sundarbans site with its distributary Q, or move the mouth to the Meghna and
  use the combined Q. It will not pair the Sundarbans site with the combined Q.
- Danube: HUD counts river kilometres from Linz (~rkm 2135, **verify in phase
  3**) to 0 at the sea.
- Danube: the preset is tuned to present-day conditions. The NW Black Sea
  shelf hypoxia of the 1970s–80s largely recovered after Danube nutrient loads
  fell from the 1990s: the set's one repaid debt.
- Danube: the Black Sea's deep water is **naturally** anoxic (stratification),
  not Danube-caused, and the sim is surface-only. The spec and legend make no
  claim about the deep basin.
- The draft's Rio Doce coordinate (`-39.74 W`, a double negative) and "verified
  high-precision" Hamhung claim are not carried over.

### River stage (Lagrangian)

- Velocity: v = (1/n) · R^(2/3) · S^(1/2) (Manning), per river.
- ~256 particles per river, spawned at the audit site, advanced by arc length
  s along the course at v on the same compressed clock as the ocean.
- A particle's state is the exact kinetics at travel time t = s / v, starting
  from the verdict's kernel inputs (`temp`, `dt`, `bod`, `nitrate`; initial
  deficit = max(0, DO_sat(temp) − `do`), since supersaturated input must not
  produce a negative deficit). Rendered with the §1 palette.
- The critical point t_c (maximum deficit) is drawn as a tick on the course,
  with a HUD readout, e.g. `DO_MIN 3.1 mg/L @ rkm 1840`.
- Legend states `POINT SOURCE · PLUG FLOW · NO TRIBUTARIES`.
- Worked example (Danube): ~25 d travel from Linz leaves ~0.3% of BOD at the
  delta while nitrate arrives nearly intact, so the Danube's Black Sea plume is
  almost entirely green. That is the Danube's actual legacy there.

### Ocean injection

- The mouth snaps to the nearest ocean cell.
- A Gaussian splat (σ ≈ 1.5 cells) is added each step at a physically
  dimensioned rate:

  ΔC = C_mouth · Q · Δt / (A_cell · H), with H = 20 m mixed-layer depth and
  A_cell the cos φ-corrected cell area.

- C_mouth is the river-stage state at the mouth (t = course length / v) for
  all four channels; ΔT injects the same way (heat as a tracer), and the
  deficit carried out of the river seeds the ocean deficit.

### User verdicts and the ghost

- Course: straight line from the audit site to its snapped ocean cell. The
  snap line is drawn and doubles as the river stage. Legend: `STRAIGHT-LINE
  APPROX`. Default v = 0.5 m/s, since the form has no slope field.
- Q = the submitted `flow` taken literally in m³/s (the form's own unit). A
  small site makes a small plume. The HUD states the comparison, e.g. `Q 42
  m³/s · 0.25% OF MISSISSIPPI`. No visual inflation.
- The ghost follows the same rules, drawn dashed and labelled `PROVISIONAL`.

### Honesty notes (legend + spec)

- Kinetic constants are literature ranges, not per-site measurements:
  `MODEL KINETICS · LITERATURE RANGES`.
- Preset concentrations are the 2026-07-19 **narrative-tuned** kernel values
  (e.g. Mississippi BOD 27 mg/L is far above measured). Per decision 1 the
  ocean draws what the verdict says, so absolute ocean concentrations inherit
  that tuning. The dimensioning is internally consistent; it is not a claim of
  measured loads. The probe readout carries the same legend.

## 4. The tab

### Hero

- `LedgerTab` replaces `LedgerMap`, `LedgerParticles` and the eclipse overlay
  with `<LedgerOcean>` in the same hero slot (full world at 2:1; the existing
  vignette stays).
- `LedgerMap.jsx`, `LedgerParticles.jsx`, the eclipse keyframes
  (`lt-eclipse*`) and the `toMapXY` burst plumbing in `LedgerTab` are deleted.
  `CoordinatePicker` is untouched.

### Seal (replaces the eclipse)

1. While `AuditCascade` runs, the ocean clock eases to near-stop over ~0.6 s:
   the world holds still while the kernel rules.
2. On `onComplete`, the ghost source seals: dashes close to solid, particles
   take the kernel's final values, one flare travels the course to the mouth.
3. The clock eases back; the new plume starts entering the ocean.

`ledgerBus` `VERDICT_ISSUED` and the observatory emit are unchanged.

### HUD

Monospace, overlaid; pointer events only on controls.

- **Top-left:** sim clock `T+ 184.25 d`; compression control (click cycles
  1/3/9/30 d per s); frame monitor `Δt 2.8 ms · 357 Hz`.
- **Top-right:** `THE OPEN LEDGER v2.0`.
- **Bottom-left:** the existing verdict-count summary line; the legend line.
- **Bottom-right:** cursor probe. A 1-px `readPixels` throttled to 10 Hz,
  showing `31.2°N 122.8°E · ΔT 0.02 °C · BOD 0.14 · NO₃ 0.8 · DO↓ 0.3 mg/L`.
- **Sources:** status-coloured ring at each audit site (`STATUS_COLOR` kept);
  DO_MIN tick; hover tooltip with site, status, Q, DO_MIN point, snap
  distance.

### Header

- Eyebrow: `The Open Ledger v2.0`.
- h1: `HYDROLOGICAL AUDIT & OUTFALL DISPERSION`.
- Subtitle keeps "The equations are the authority." and adds one closing line:
  "Every verdict drains somewhere. The ocean keeps the account." (Proposal;
  strike in review if too much.)

### Form

- `SubmissionForm` gains `onDraftChange(params)`. Every **valid** edit updates
  the ghost (coalesced to one update per animation frame); invalid values
  freeze the ghost at its last valid state.
- Preset row grows from 5 to 9.

### Mobile

- Same grid and 2:1 aspect.
- HUD collapses to top-left (clock) and bottom-left (legend).
- The probe works on tap.
- Step cap drops to 4 under load (§2 Clock).

## 5. Modules

### Pure core (no GL; jsdom-testable) — `src/terminal/ledger/ocean/`

| file | responsibility |
|---|---|
| `kinetics.js` | rate constants; exact Δt step for all 4 channels; river state at travel time t; critical-point t_c; DO_sat(T) |
| `streamFunction.js` | gyre + regional cell definitions; ψ on corners; baked face and centre velocities |
| `landMask.js` | scanline rasteriser of `worldMapPolys` onto the grid; `snapToOcean(lon, lat)` |
| `sources.js` | presets + verdicts + ghost → source list (course, snap, Q, C_mouth, splat rate) |
| `referenceStep.js` | CPU oracle of one full step (BFECC + limiter, diffusion, reaction + injection, guards) |
| `riverCourses.js` | the 9 polylines, each with a source note |

`auditPresets.js` gains the `river` blocks and 4 presets.

### Harness extension — `src/terminal/gl/pingPong.js`

- Probes float / half-float render-target support.
- Creates, swaps and disposes texture+FBO pairs.
- Sim programs are built with the existing `buildProgram` inside
  `createShaderHost`'s `onInit`.
- The host's single display program and all existing consumers are unchanged.

### View — `src/terminal/views/ledger/ocean/`

| file | responsibility |
|---|---|
| `LedgerOcean.jsx` | orchestrator: host, ping-pong, passes, particles, HUD mount |
| `useOceanClock.js` | accumulator, step cap, cascade ease-down/up |
| `OceanHud.jsx` | HUD overlay, probe, tooltips |
| `shaders/` | `advect`, `diffuse`, `react`, `composite`, `particles` |

## 6. Testing

Every test below must be shown to **fail against a deliberately broken
implementation** before it counts. This repo has shipped vacuous GL tests
three times.

- **Kinetics:**
  - Closed form matches fine RK4 integration of the ODEs to 1e-6.
  - t_c formula matches the numerical maximum.
  - k_d = k_a degenerate case is finite and continuous.
  - θ correction matches textbook values.
- **Currents:**
  - Discrete divergence < 1e-6 in every cell.
  - Zero normal flow on every coast face.
  - Western intensification: peak Kuroshio speed ≥ 3× the eastern-boundary
    speed of the same gyre.
- **Mask and snap:**
  - Linz is land; mid-Pacific and Black Sea are ocean.
  - All 9 mouths snap to ocean within 3 cells.
  - Hamhung snaps to the Sea of Japan and Rio Doce to the Atlantic.
- **Oracle:**
  - No NaN or negative values after 10k steps with extreme inputs.
  - Land exactly 0.
  - Field continuous across the date line.
  - With decay off and no sources, mass drift < 2% over 1000 steps (BFECC +
    limiter is not exactly conservative; this is a bound, not a zero claim).
  - 60 Hz vs 360 Hz frame streams produce identical states.
- **Presets:**
  - Every `river` numeric field has a source note or `'UNVERIFIED'`.
  - Existing `auditPresets.test.js` passes unchanged.
  - All 9 presets pass `validateSubmission`.
- **GPU parity (the gate that tests maths, not GL calls):**
  - A CDP script (swiftshader recipe from the /SCENT collider work) runs N
    steps on GPU and oracle and compares readbacks within tolerance.
  - Removing the limiter or the land guard must make it fail.
- **Visual:** screenshot the rendered output before any visual claim.

## 7. Phases

Each phase ends in a working, green state.

1. **Pure core:**
   - `ledger/ocean/*` and the oracle, with all §6 core tests.
   - No UI change.
2. **GL ocean:**
   - `pingPong.js`, shaders, and `LedgerOcean` rendering the existing 5
     presets as ambient sources.
   - GPU parity passing.
   - Reviewed on the branch; the tab still shows the old hero.
3. **Integration:**
   - River-stage particles.
   - The 4 new presets with sourced data.
   - HUD, form ghost, seal, header.
   - Delete `LedgerMap` / `LedgerParticles` / eclipse.

## Out of scope (phase-2 backlog)

- Zoom loupe for short rivers (Citarum, Hamhung ≈ a few px); reuse the
  /surveillance EU-loupe pattern.
- Seasonal (monsoon) current toggle.
- Per-channel isolation toggles.
- Globe projection.

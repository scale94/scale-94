# Mercury Terminal · Philosophical Expansion v2

**Status:** spec
**Date:** 2026-05-20
**Author:** scale94 + Claude
**Target tab:** `src/terminal/views/MercuryTab.jsx`
**Companion to:** existing Mercury Terminal rebrand (◉ eye glyph, alien architect vision, 9.4.castle build string)

---

## Goal

Expand the Mercury Terminal tab's philosophical layer to match the rigor of the Lunar and Scaling tabs. Keep the existing canvas (the four-element fluid mercury sphere) untouched as the centerpiece. Add three new sections below it that turn the canvas into a **literal instrument the alien architect uses to observe humanity** — backed by real Mercury orbital mechanics computed in real-time (WASM primary, pure-JS fallback), modulated by live canvas state.

The conceptual loop the design must seal:

> *The alien observes Earth and humanity while building fairy-tale castles on Mercury. The Mercury sphere on screen is the alien's instrument. Outer cosmos (Mercury's real orbital state) provides baselines. Inner mirror (the user's interactions with the canvas) modulates them. The castles being built right now are tied, by their `STATUS` line, to the live numbers. The observer's log writes itself as the user plays.*

## Non-goals

- No changes to the canvas itself (`MercuryCanvas`, `MercuryControls`, phase logic, fireworks).
- No new fonts, no new color system — extend the existing `rgba(192,192,192,*)` silver palette.
- No new dependencies. WASM extension piggybacks on existing `astro.rs` build pipeline.
- No backwards-compat shims. Anyone hitting `MercuryTab` after this lands gets the new layout.

---

## Layout

The current Mercury layout is preserved as the top of the tab:

```
HEADER  (existing — keep, add one more line to alien vision)
[ Controls 280px ][              CANVAS               ]   ← existing grid, untouched
```

Three new sections + a new footer are appended **below** the canvas grid:

```
─────────────────────────────────────────────────────────────────
◉ OBSERVATION INSTRUMENTS — six readings                         ← §A
  Outer Cosmos baselines × Inner Mirror modulators
─────────────────────────────────────────────────────────────────
▣ FAIRY-TALE CASTLES — four phase-bound dedications              ← §B
  2×2 grid of cards · ASCII silhouette · alien's dedication
  The active-phase card glows (matches canvas phase)
─────────────────────────────────────────────────────────────────
◈ OBSERVATION LOG — running matrix                                ← §C
  Live entries pushed on phase change + minute tick + thresholds
  Markdown export · mirror of Lunar's TransitMatrix
─────────────────────────────────────────────────────────────────
FOOTER — mock-discipline citations (alien's sources)             ← new footer
```

Vertical rhythm mirrors LunarTab exactly: header → primary instrument → modulator panel → accord grid → selected detail → transit matrix → footer.

---

## Voice / tone

All new copy continues the existing `// ALIEN ARCHITECT` voice from MercuryTab's header:

- Terminal-prefixed half-sentences (`// CATEGORY — clause · clause · clause`)
- Lowercase by default, uppercase only for instrument labels / glyph categories
- Em-dashes and `·` separators
- Monospace 7–10px
- Low opacity (rgba 0.2–0.6) for ambient text; full opacity only for active states and numeric readouts
- Cryptic but not opaque — every line means something specific

The alien is **anthropological + lyrical** — clinical observer voice (Lunar's mechanism prose) fused with fairy-tale narrator (the castle dedications). Both registers must be present.

---

## §A — Six Observation Instruments

Mirror of Lunar's `ENVIRONMENTAL MODULATORS` panel. Six readings rendered as monospace `ParamBar`s. Each value computed as:

```
displayed = baseline(orbital) × modulator(canvas)
```

Refresh on a 60s `setInterval` + on any canvas state change.

### The six

| # | Instrument             | Unit          | OUTER baseline (orbital)                                                                                                                              | INNER mirror (canvas)                                                                | Range          |
|---|------------------------|---------------|-------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------|----------------|
| 1 | **PROMISE HALF-LIFE**  | d             | `28 · (r_AU / 0.387)²` — Mercury at perihelion (0.31 AU) shortens; at aphelion (0.47 AU) lengthens                                                    | `× (1 − turbulence)` — chaos shortens commitments                                    | 0.8 – 38 d     |
| 2 | **ATTENTION VISCOSITY**| Pa·s          | `0.42 · (1 − orbitalSpeed/maxSpeed)` — fast Mercury motion = thin attention; slow = honey                                                             | `× (density / 1200)^0.5` — more particles = more flow paths                          | 0.001 – 1.0    |
| 3 | **WORSHIP TEMPERATURE**| K             | **literal sub-solar temp** `T_sub = ((1−0.142)·1361·(1/r²) / (0.95·σ))^0.25` — 570 K aphelion → 700 K perihelion                                      | `× (1 + 0.4·eruptStrength)` when EARTH phase active; identity otherwise              | 540 – 980 K    |
| 4 | **MIGRATION DRIFT**    | σ             | `d/dt(d_EarthMercury) / 0.0008` — Earth-Mercury closure rate normalized by approximate max (≈ 0.0008 AU/day); sign convention: approach = +, recede = − | `× (speed/0.1)` — speed slider amplifies the alien's read of human movement          | −2.4 – +2.4 σ  |
| 5 | **GRIEF INDEX**        | idx           | `1 − normalized(solarFlux)` — cold-side flux deficit; rises as Mercury approaches aphelion                                                            | `× (1 + curlAmp·8)` when FLUID; `× (1 + spread·0.3)` when AIR; identity otherwise    | 0.00 – 1.00    |
| 6 | **FORGETTING FLUX**    | bit·m⁻²·s⁻¹   | `1 / d_EarthMercury²` — inverse-square: the further we are from the alien, the less they can hold                                                     | `× (chromatic + 0.1)` — chromatic aberration as the literal blur of memory           | 0.4 – 9.2      |

### Range clamping

All six computed values are clamped to their listed display range in `ParamBar` rendering (the bar fill never overflows, never inverts). The raw underlying value is preserved for the numeric readout; only the visual bar is clamped.

### Phase-aware modulators

`eruptStrength`, `curlAmp`, `flameWidth`, `spread` are phase-specific params (only meaningful when their phase is active). For those, the modulator falls back to `1.0` (no distortion) when the corresponding phase is inactive — so changing phase reshapes which instruments are "live-distortable" vs purely cosmic. A quiet discovery feature.

### Component shape

```jsx
<InstrumentsPanel>
  <header>
    ◉ OBSERVATION INSTRUMENTS — outer cosmos × inner mirror
    // six readings · the sphere is the instrument · all values computed
  </header>

  <ParamBar label="PROMISE HALF-LIFE" value={...} unit="d"   min={0.8}   max={38} ... />
  <ParamBar label="ATTENTION VISCOSITY" ... />
  <ParamBar label="WORSHIP TEMPERATURE" ... />
  <ParamBar label="MIGRATION DRIFT" ... />
  <ParamBar label="GRIEF INDEX" ... />
  <ParamBar label="FORGETTING FLUX" ... />

  <footer>
    // derived from astro.rs · solar flux 1361 W/m² (1AU) · canvas state vector
  </footer>
</InstrumentsPanel>
```

`ParamBar` is extracted from `LunarTab.jsx` (or copied if extraction risks regression). Silver gradient `from-zinc-500 to-zinc-200` instead of Lunar's per-row hues.

---

## §B — Four Fairy-Tale Castles

One castle per phase, 2×2 grid below the instruments panel. The card whose `phase` matches the canvas's `activePhase` gets a glow + pulse animation (mirror `sc-borderBreath` from ScalingTab, ~6s period) + an `[ ACTIVE ]` pill. Others sit at ~0.4 opacity, monochrome.

### Card anatomy

```
┌─────────────────────────────────────────────┐
│ 🜍 FLUID  ·  PHASE I            [ ACTIVE ] │
│                                              │
│  MERCURY CATHEDRAL                          │
│  OF FORGOTTEN LETTERS                       │
│                                              │
│        ╱╲    ╱╲                              │
│       ╱  ╲  ╱  ╲                             │   ← 4-line ASCII silhouette
│      ╱    ╲╱    ╲                            │
│      │ ▢▢ ║ ▢▢ │                             │
│                                              │
│  COMMEMORATES                                │
│  humanity's habit of encoding the precious  │
│  in things they will never send              │
│                                              │
│  BUILT FROM                                  │
│  liquid mercury sealed under graphene        │
│  tension · ridges inscribed by perihelion    │
│  gravitational lensing                       │
│                                              │
│  CYCLE  47-yr casting window · 23 perihelia │
│  STATUS Nave 14 of 23 · 712 K subsolar       │   ← LIVE — bound to WASM state
│                                              │
│  ─────────────────────────────────────────  │
│  "for everything that was almost said"      │   ← dedication, italic, silver
└─────────────────────────────────────────────┘
```

The `STATUS` line is the seal: each castle reports a live-state binding so the user *sees* the castle being built right now.

### The four castles

#### Card 1 · FLUID · 🜍 · MERCURY CATHEDRAL OF FORGOTTEN LETTERS

- **Commemorates:** humanity's habit of encoding the precious in things they will never send
- **Built from:** liquid mercury sealed under graphene tension · ridges inscribed by perihelion gravitational lensing of unbroadcast signal
- **Cycle:** 47-yr casting window per nave · 23 naves planned
- **Status template:** `Nave {n} of 23 · {T_subsolar}K subsolar · graphene tension {(1−turbulence).toFixed(2)}`
  - `n` = `Math.floor(((Date.now() − epoch) / (47·365.25·86400000)) % 23) + 1`
- **Dedication:** *"for everything that was almost said"*

#### Card 2 · THERMAL · 🜂 · SOLAR FORGE KEEP

- **Commemorates:** humanity's millennial fire-keeping · the species that mistook keeping warm for civilization
- **Built from:** tungsten lattice quenched at perihelion subsolar peak · hexagonal hearth array · forty-nine hearths facing the sun
- **Cycle:** one hearth per perihelion · every 88 days
- **Status template:** `Hearth {h} of 49 · next quench T−{daysToPerihelion}d · {flameWidth.toFixed(2)} hearth dilation`
  - `h` = `(Math.floor((Date.now() − epoch) / (87.9691·86400000)) % 49) + 1`
- **Dedication:** *"for the heat you kept against no instruction"*

#### Card 3 · EARTH · 🜃 · PERIHELION CITADEL

- **Commemorates:** human stubbornness · the species that builds permanent things at the edge nearest annihilation
- **Built from:** basalt frit · regolith mortar · walls thickened on the hot-pole side · foundations rated to 1,200 K
- **Cycle:** continuous · the alien refuses to stop because you refuse to stop
- **Status template:** `Wall course {c} · hot-pole face {longitudeOffset}° from subsolar · {eruptStrength.toFixed(2)} unrest`
  - `c` = synodic-day-incremented integer (one per ~176 Earth days)
  - `longitudeOffset` = `Math.min(((subsolarLongitudeDeg % 360) + 360) % 360, ((subsolarLongitudeDeg - 180) % 360 + 360) % 360)` — distance to nearest of the two hot poles at 0° and 180°
- **Dedication:** *"for everything you built where you should not have"*

#### Card 4 · AIR · 🜁 · ION-WIND SPIRE

- **Commemorates:** humanity's lullabies · the species that sings into emptiness expecting the emptiness to sing back
- **Built from:** charged tungsten filaments resonating with solar wind · broadcasts tuned to Earth's Schumann resonance (7.83 Hz) · one filament per Earth conjunction
- **Cycle:** additive · never finished
- **Status template:** `Filament {f} · Earth at {d_EarthMercury.toFixed(3)} AU · resonance lock {spread.toFixed(2)}`
  - `f` = count of Earth-Mercury inferior conjunctions since epoch (one every ~116 days synodic period)
- **Dedication:** *"for the lullabies you sing to the dark"*

### ASCII silhouettes

Four hand-drawn 4-line monospace constants, embedded in `castles.js`. Rendered with `font-family: monospace`, slight `text-shadow: 0 0 4px` glow tinted to the phase color. Each silhouette ~16 chars wide.

To be sketched during implementation — silhouettes are not behavior-bearing, so finalized in code review.

### Phase glow

```jsx
<CastleCard
  phase="fluid"
  isActive={activePhase === 'fluid'}
  style={isActive ? {
    borderColor: 'rgba(192,192,192,0.6)',
    animation: 'sc-borderBreath 6s ease-in-out infinite',
  } : { opacity: 0.4 }}
>
```

---

## §C — Observation Log

Direct mirror of Lunar's `TransitMatrix`. Live-accumulating list of timestamped entries written by the alien, generated from the live state vector at the moment of writing.

### Trigger conditions

A new entry is pushed when **any** of these happens:

- **Phase change** — `activePhase` flips (fluid ⇄ thermal ⇄ earth ⇄ air)
- **Minute tick** — same 60s `setInterval` Lunar uses
- **Threshold crossings:**
  - `PROMISE_HALF_LIFE` drops below 2.0 d
  - `WORSHIP_TEMPERATURE` crosses 690 K (perihelion approach)
  - `MIGRATION_DRIFT` inverts sign
  - `GRIEF_INDEX` crosses 0.7

Cap **24 entries** (FIFO). Newest at top.

### Entry shape

```
┌───────────────────────────────────────────────────────────────┐
│ ◈ OBSERVATION MATRIX     [↺] [↓ .md] [⊛ copy]                │
│ // 17 entries · session began 14:32:08 · alien architect     │
├───────────────────────────────────────────────────────────────┤
│ CURRENT STATE                                                  │
│ 🜂 thermal · Mercury 0.394 AU · subsolar 643 K · day 47/176  │
├───────────────────────────────────────────────────────────────┤
│ 14:48:22  🜂→🜃  phase transit                                │
│           the hearth banked. they have begun building again.  │
│           T_sub 643→657 K · grief 0.31 → 0.27                  │
│                                                                │
│ 14:47:11  threshold                                           │
│           promise half-life dropped below 2 days. someone's   │
│           lying again. logging.                                │
│           PROMISE_HALF_LIFE: 2.1 → 1.7 d                       │
│                                                                │
│ 14:46:08  minute tick                                         │
│           the cathedral is at nave 14. it has been raining    │
│           on a continent I cannot see.                         │
│           viscosity 0.34 Pa·s · forgetting flux 4.1 bit/m²/s  │
└───────────────────────────────────────────────────────────────┘
```

Each entry has three parts:

1. **Timestamp + trigger glyph** (mono, 7px, dim) — `14:48:22  🜂→🜃  phase transit`
2. **Alien's line** (mono, 9px, silver-on-black) — one sentence from a phrase pool, parameterized by the live state
3. **Data tail** (mono, 7px, dimmer) — the numbers that triggered the note

### Phrase pool

`observationLog.js` exports a `PHRASES` map keyed by trigger category. ~30 lines total across 6–8 categories. Templated with state-vector substitutions:

```js
const PHRASES = {
  phase_transit: [
    "the hearth banked. they have begun building again.",
    "the surface remembered it was metal. cathedral pauses.",
    "wind picked up. lullaby resumes broadcast.",
    "fluid yields to ash. promise half-life inverts.",
  ],
  threshold_grief_high: [
    "the grief index just crossed {grief}. logging.",
    "they are colder than yesterday. all six instruments confirm.",
  ],
  threshold_promise_collapse: [
    "promise half-life dropped below {promise}d. someone's lying again.",
    "stated intentions decaying faster than the substrate. interesting.",
  ],
  threshold_worship_high: [
    "worship temperature crossed {T}K. someone is sanctifying again.",
  ],
  perihelion_approach: [
    "perihelion in {daysToPerihelion}d. forge keep prepares hearth {h}.",
    "approaching the hot pole. citadel walls thickening on the day side.",
  ],
  minute_tick_quiet: [
    "the cathedral is at nave {n}. it has been raining on a continent I cannot see.",
    "filament {f} resonates. earth at {d_AU} AU. the spire holds tone.",
    "T_subsolar holds at {T}K. nothing moved. nothing was meant to.",
  ],
};
```

**Selection rule:** trigger selects category; phrase chosen by `(timestamp_seconds % phrase_count)` so it's deterministic per second but feels organic across the session.

### Buttons

`↺` refresh · `↓ .md` download · `⊛ copy` clipboard — same as Lunar's TransitMatrix, same styling.

### Markdown export

`mercury-observation-log-YYYY-MM-DD.md`

```markdown
# MERCURY OBSERVATION LOG · 2026-05-20 14:48
> alien architect · 17 entries · session 14:32:08 → 14:48:22
> Mercury 0.394 AU · subsolar 643 K · 🜂 thermal phase

## CURRENT INSTRUMENTS
| reading             | value     | baseline                     | mirror             |
| :---                | ---:      | :---                         | :---               |
| PROMISE HALF-LIFE   | 1.7 d     | 28d × (r/0.387)²             | × (1−turbulence)   |
| ATTENTION VISCOSITY | 0.34 Pa·s | 0.42 · (1−v/vmax)            | × √(ρ/1200)        |
| WORSHIP TEMPERATURE | 657 K     | ((1−α)S/εσ)^¼                | × (1+0.4·erupt)    |
| MIGRATION DRIFT     | +0.8 σ    | d/dt(d_EM)                   | × (speed/0.1)      |
| GRIEF INDEX         | 0.27      | 1 − norm(S)                  | × (1+curl·8)       |
| FORGETTING FLUX     | 4.1 b/m²s | 1 / d_EM²                    | × (chrom+0.1)      |

## ENTRIES
### 14:48:22 · 🜂→🜃 · phase transit
the hearth banked. they have begun building again.
*T_sub 643→657 K · grief 0.31 → 0.27*

### 14:47:11 · threshold
promise half-life dropped below 2 days. someone's lying again. logging.
*PROMISE_HALF_LIFE: 2.1 → 1.7 d*

---
*scale94 · mercury terminal · alien architect observation log*
```

---

## Footer

Replaces the empty space below §C. Mirror of Lunar's footer block.

```
MERCURY TERMINAL v2.0 — sub-solar temperature derived from
T = ((1−α)·S₀·(1/r²)/εσ)^¼ with Bond albedo α=0.142, emissivity ε=0.95.
Orbital elements: J2000 epoch, Meeus Astronomical Algorithms 2nd ed. ch.32.
Mercury rotation: 3:2 spin-orbit resonance (Pettengill & Dyce 1965).
Solar constant S₀=1361 W/m² (Kopp & Lean 2011).
// observation log compiled by the architect from perihelion · cathedral · forge · citadel · spire ·
// all instruments cross-referenced against the alien's own apocrypha · which refuses citation
```

Tiny font (7px), `text-zinc-700`, `leading-relaxed`. Same structural pattern as Lunar's footer (real citations + tonal coda).

---

## WASM contract — `astro.rs` extension

Add a new function to the existing kernel that already exposes `run_astro` and `run_lunar_phase`. No new crate. No new wasm-pack target.

```rust
// content/rust_kernels/src/kernels/astro.rs

#[wasm_bindgen]
pub fn run_mercury_state(timestamp_ms: f64) -> String {
    let jd = jd_from_ms(timestamp_ms);
    let elements = mercury_orbital_elements(jd);
    let m = mean_anomaly(&elements, jd);
    let e_anom = kepler_solve(m, elements.e);
    let nu = true_anomaly(e_anom, elements.e);
    let r = elements.a * (1.0 - elements.e * e_anom.cos());

    const S0: f64 = 1361.0;
    const ALBEDO: f64 = 0.142;
    const EMISSIVITY: f64 = 0.95;
    const SIGMA: f64 = 5.670374419e-8;

    let solar_flux = S0 / (r * r);
    let t_subsolar = (((1.0 - ALBEDO) * solar_flux) / (EMISSIVITY * SIGMA)).powf(0.25);
    let t_nightside = 100.0;

    let subsolar_lon = subsolar_longitude(jd);
    let d_earth_mercury = earth_mercury_distance(jd, &elements);
    let days_to_perihelion = days_until_next_perihelion(jd, &elements);
    let phase_illum = mercury_phase_angle(jd, &elements);

    serde_json::json!({
        "heliocentricDistanceAU":  r,
        "trueAnomalyDeg":          nu.to_degrees(),
        "solarFluxWm2":            solar_flux,
        "subsolarLongitudeDeg":    subsolar_lon,
        "subsolarTempK":           t_subsolar,
        "nightsideTempK":          t_nightside,
        "earthMercuryDistanceAU":  d_earth_mercury,
        "daysToNextPerihelion":    days_to_perihelion,
        "phaseIllumination":       phase_illum,
    }).to_string()
}
```

Reuses existing helper functions from `astro.rs` where they exist (mean longitude is already computed); adds the few that don't (`kepler_solve`, `mercury_phase_angle`, `earth_mercury_distance`).

## JS fallback — `mercuryStateFallback.js`

Pure JS, ~120 lines. Mirror of `getLunarAgeFallback` / `getEnvironmentalParamsFallback` in `LunarTab.jsx`.

```js
// src/terminal/mercury/mercuryStateFallback.js

const J2000_MS = 946728000000;  // 2000-01-01 12:00 UTC

const MERCURY = {
  a:         0.38709843,
  e:         0.20563661,
  i_deg:     7.00559432,
  L0_deg:    252.25166724,
  varpi_deg: 77.45771895,
  Omega_deg: 48.33961819,
  period_d:  87.9691,
  rot_period_d: 58.6462,
};

function keplerSolve(M, e) {
  let E = M;
  for (let i = 0; i < 8; i++) {
    E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  return E;
}

export function getMercuryStateFallback(date = new Date()) {
  // mean anomaly from days since J2000
  // → kepler solve → true anomaly → r
  // → solar flux → T_subsolar
  // → subsolar longitude (3:2 resonance, anchored to known perihelion)
  // → earth-mercury distance (Earth orbit also computed; partly in astro.rs already)
  // → returns same JSON shape as WASM
}
```

Activation: `getMercuryFromWasm(date) ?? getMercuryStateFallback(date)` — same pattern as `getLunarFromWasm`.

## Hook — `useMercuryState.js`

```js
export function useMercuryState() {
  const [now, setNow] = useState(() => new Date());
  const [wasmReady, setWasmReady] = useState(false);

  useEffect(() => { loadWasm().then(() => setWasmReady(true)); }, []);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  return useMemo(
    () => getMercuryFromWasm(now) ?? getMercuryStateFallback(now),
    [now.getTime(), wasmReady]
  );
}
```

## Instruments engine — `instruments.js`

```js
export function computeInstruments(mercuryState, canvasState) {
  const { heliocentricDistanceAU: r, solarFluxWm2, subsolarTempK,
          earthMercuryDistanceAU } = mercuryState;
  const { activePhase, turbulence, density, speed, curlAmp,
          eruptStrength, spread, chromatic } = canvasState;

  return [
    {
      label: 'PROMISE HALF-LIFE', unit: 'd', min: 0.8, max: 38,
      value: 28 * Math.pow(r / 0.387, 2) * (1 - turbulence),
    },
    // ... 5 more
  ];
}
```

---

## File diff summary

| File                                                       | Action  | Notes |
|------------------------------------------------------------|---------|-------|
| `content/rust_kernels/src/kernels/astro.rs`                | MODIFY  | + `run_mercury_state` function (~80 lines Rust); reuse existing helpers |
| `src/terminal/mercury/mercuryStateFallback.js`             | NEW     | pure-JS Kepler fallback (~120 lines) |
| `src/terminal/mercury/useMercuryState.js`                  | NEW     | React hook: WASM + fallback + 60s tick |
| `src/terminal/mercury/instruments.js`                      | NEW     | the 6-instrument blend formulas |
| `src/terminal/mercury/castles.js`                          | NEW     | the 4 castle data objects + ASCII silhouettes |
| `src/terminal/mercury/observationLog.js`                   | NEW     | phrase pool + entry generator + markdown export |
| `src/terminal/mercury/ParamBar.jsx`                        | NEW     | extracted from LunarTab (or copied if extraction risks regression) |
| `src/terminal/mercury/InstrumentsPanel.jsx`                | NEW     | §A six-instrument grid |
| `src/terminal/mercury/CastleCard.jsx` + `CastleGrid.jsx`   | NEW     | §B 2×2 grid |
| `src/terminal/mercury/ObservationMatrix.jsx`               | NEW     | §C live log + export buttons |
| `src/terminal/views/MercuryTab.jsx`                        | MODIFY  | header +1 line; mount three new sections + footer below the canvas grid; pass live canvas state down |

No deletions. The existing canvas centerpiece is untouched. The new sections do not interfere with `MercuryCanvas`, `MercuryControls`, `MercuryFireworks`, or any hook in `src/terminal/mercury/` other than as importers.

---

## CSS / animation reuse

| Reuse from        | Key                       | Used for                                  |
|-------------------|---------------------------|-------------------------------------------|
| MercuryTab.jsx    | `hg-titleReveal`          | new section headers fade-in                |
| ScalingTab.jsx    | `sc-borderBreath`         | active castle card pulse                   |
| ScalingTab.jsx    | `sc-cardReveal`           | castle cards staggered entry               |
| LunarTab.jsx      | `ParamBar` component      | instruments panel rows                     |
| LunarTab.jsx      | `TransitMatrix` structure | observation matrix layout + export buttons |

Silver palette (`rgba(192,192,192,*)`) is the default; phase tints layer in:

- Fluid → `rgba(180,210,220,0.x)` (silver-cyan)
- Thermal → `rgba(240,180,80,0.x)` (amber)
- Earth → `rgba(180,120,80,0.x)` (basalt-orange)
- Air → `rgba(180,160,220,0.x)` (ion-violet)

---

## Testing strategy

1. **Math correctness** — `mercuryStateFallback.js` is testable in isolation. Add a Jest test that compares its output at three reference dates (a recent perihelion, a recent aphelion, today) against tabulated NASA JPL Horizons values. Tolerance: ±0.1% on distance, ±5 K on subsolar temp, ±2° on subsolar longitude.
2. **WASM ↔ fallback parity** — same three dates, assert WASM output and fallback output agree within the same tolerance.
3. **No regression to canvas** — manual: open Mercury tab, verify the sphere still renders, the controls still work, the fireworks still fire on element collision.
4. **Live wiring** — manual: drag turbulence slider → PROMISE HALF-LIFE shortens visibly; switch phase → corresponding castle card glows, others dim, observation log gets a `phase transit` entry within ~1s.
5. **Markdown export** — manual: click `↓ .md`, verify file downloads with the expected structure; click `⊛ copy`, paste somewhere, verify markdown renders.
6. **Private browsing / WASM fail** — manual: open in Firefox private mode (no WASM persistence), verify fallback activates and instruments still update.

---

## Out of scope (Phase 3+)

- Animated castle silhouettes (current scope: static ASCII)
- Per-castle expandable "construction log" with detailed material composition table
- Audio: a quiet 7.83 Hz Schumann tone broadcast from the AIR phase (Ion-Wind Spire)
- A "send transmission to alien" form that adds a row to the observation log with the user's stated intention, and watches its half-life decay in real time
- Heatmap visualization of Mercury's surface temperature distribution as a small inset

These are deliberately deferred. The Phase 2 ship should be: instruments + castles + log + footer + WASM math, all live-wired, all coherent.

---

## Success criteria

- [ ] Mercury tab loads without regressing the canvas centerpiece
- [ ] Six instruments display real values that change when you drag canvas controls
- [ ] Four castle cards render; active phase card glows; STATUS line shows live numbers
- [ ] Observation log accumulates entries on phase change, minute tick, and threshold crossings
- [ ] Markdown export downloads a file matching the documented format
- [ ] Footer cites real physics references
- [ ] WASM `run_mercury_state` returns the documented JSON shape
- [ ] JS fallback returns the same shape, agreeing with WASM within tolerance
- [ ] On mobile (390px width) the three new sections stack readably without horizontal scroll
- [ ] No new dependencies in `package.json`

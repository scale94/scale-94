# Transit Matrix Kernel — Design Spec

**Status:** Approved for implementation by Sonnet 4.6
**Author:** Claude Opus 4.7
**Date:** 2026-05-14
**Target file:** `content/rust_kernels/src/kernels/transit_matrix.rs`
**Export:** `run_transit_matrix(unix_ms: f64, layers: u32) -> String`

---

## 1. Context

The Transit Matrix currently lives in JS at [`src/terminal/views/LunarTab.jsx`](../../../src/terminal/views/LunarTab.jsx) lines 838–1009. It:

1. Calls `run_astro(Date.now())` (Rust) to get geocentric ecliptic longitudes.
2. Parses the text output into `{sign, degree, retrograde}` records.
3. Runs a JS pairwise loop computing five Ptolemaic aspects (☌ ⚹ □ △ ☍) with a flat 8° orb.
4. Looks up "readings" in a JS `READING_OVERRIDES` table; falls back to template strings.
5. Renders a panel + downloads a Markdown report.

The kernel proposed here moves the **astrology engine** into Rust and leaves only **rendering** in JS. The kernel adds seven layers of computation the current JS does not perform, each gated by a bit flag in `layers`. Sonnet 4.6 is the implementor; this spec contains every constant table, formula, and bound needed to write the file without inventing astrology.

---

## 2. Public API

```rust
#[wasm_bindgen]
pub fn run_transit_matrix(unix_ms: f64, layers: u32) -> String
```

`layers` is a bitmask. Setting bit N enables layer N. Layers are computed independently; a layer not requested is omitted from the output JSON.

| Bit | Constant         | Layer                  |
|-----|------------------|------------------------|
| 0x01 | `LAYER_POSITIONS`    | Geocentric positions + retrograde + speed + declination |
| 0x02 | `LAYER_ASPECTS`      | Pairwise Ptolemaic aspects with differential orbs |
| 0x04 | `LAYER_HARMONICS`    | H5/H7/H9 + minor aspects (semisextile, semisquare, sesquisquare, quincunx) |
| 0x08 | `LAYER_MIDPOINTS`    | Halfsum tree + 8th-harmonic midpoint contacts (Ebertin) |
| 0x10 | `LAYER_DECLINATIONS` | Parallels & contraparallels in equatorial coords |
| 0x20 | `LAYER_ANTISCIA`     | Solstice-axis reflections (antiscia, contra-antiscia) |
| 0x40 | `LAYER_DIGNITIES`    | Essential dignities (Lilly scoring: rulership, exaltation, detriment, fall, triplicity, term, face) |
| 0x80 | `LAYER_LUNATION`     | Synodic angle, 8-fold phase, window detection, days-since-new, next-new-Moon JDE |

`run_transit_matrix(unix_ms, 0xFF)` returns all eight layers.

**JS-side convention:** `useTransits` in `LunarTab.jsx` will call with `0xFF` and select what to render. The bitmask exists so future panels (a cheap header strip, etc.) can ask for a subset cheaply.

---

## 3. Architecture & Code Reuse

- Pure `f64` math. **No new crate dependencies.**
- JSON output built with `std::fmt::Write` into a `String` (matches the pattern in `lunar.rs` — no `serde_json`).
- Reuses fundamental-argument helpers from `lunar.rs` where applicable (Moon mean longitude, elongation, etc.). Extract via `pub(crate) fn` if needed; do not duplicate.
- Reuses `astro.rs`'s `geocentric_lon`, `is_retrograde`. Promote them to `pub(crate)` and import. Do not copy-paste the L2 correction term table — that's a maintenance trap.
- Module registered in `kernels/mod.rs`:
  ```rust
  pub mod transit_matrix;  // run_transit_matrix (Ptolemaic + harmonic + midpoint + decl + antiscia + dignity + lunation)
  ```

---

## 4. Bodies & Indexing

Ten bodies, indices match `astro.rs`:

| Idx | Body    | Glyph | Class            |
|----:|---------|-------|------------------|
| 0   | Mercury | ☿     | personal         |
| 1   | Venus   | ♀     | personal         |
| 2   | Sun     | ☉     | luminary         |
| 3   | Mars    | ♂     | personal         |
| 4   | Jupiter | ♃     | social           |
| 5   | Saturn  | ♄     | social           |
| 6   | Uranus  | ⛢     | outer            |
| 7   | Neptune | ♆     | outer            |
| 8   | Pluto   | ♇     | outer            |
| 9   | Moon    | ☽     | luminary         |

JSON uses the name strings (`"Sun"`, `"Moon"`, …) to match the existing JS `PLANET_DATA` keys.

---

## 5. Layer Specs

### 5.1 LAYER_POSITIONS (0x01)

For each body:

- `lon`: geocentric ecliptic longitude (degrees, 0–360). Use `astro::geocentric_lon`.
- `lat`: geocentric ecliptic latitude (degrees, signed). Approximation rules below.
- `decl`: equatorial declination (degrees, signed). Computed via:
  ```
  ε = mean_obliquity(T)
  δ = arcsin( sin(lat)·cos(ε) + cos(lat)·sin(ε)·sin(lon) )
  ```
  Mean obliquity (Meeus Ch.22, IAU 1980):
  ```
  ε = 23°26′21.448″ − 46.8150″·T − 0.00059″·T² + 0.001813″·T³
  ```
  with `T = (JDE − 2451545.0) / 36525.0`.
- `sign`: zodiac sign name from `lon` (`(lon / 30) as usize`, mapped: Aries, Taurus, …, Pisces).
- `deg`: degree within sign (`lon % 30`).
- `ret`: retrograde flag from `astro::is_retrograde` (Sun, Moon always false).
- `speed`: degrees per day. Compute `(lon(t + 0.5d) − lon(t − 0.5d))` with wraparound handling. Sign matches direction (negative = retrograde).

**Ecliptic latitude approximation:**
- **Moon:** Use Meeus Ch.47 latitude formula (5 leading terms is enough — full formula is fine if helper already exists in `lunar.rs`). Range ±5.15°.
- **All planets including Sun:** Use `lat = 0.0`. The maximum geocentric ecliptic latitudes are:
  Mercury ±7°, Venus ±3.4°, Mars ±1.8°, Jupiter ±1.3°, Saturn ±2.5°, Uranus ±0.8°, Neptune ±1.8°, Pluto ±17°.
  For Pluto specifically the error in declination from `lat=0` can reach ~6°; this is acceptable for the art-project use case and documented as a known limitation in the kernel header comment. **Do not** implement VSOP87 latitude terms in this spec — out of scope.

**Daily speed reference values** (degrees/day, mean):
- Moon 13.18, Sun 0.99, Mercury 1.38, Venus 1.20, Mars 0.52, Jupiter 0.083, Saturn 0.033, Uranus 0.012, Neptune 0.006, Pluto 0.004.
These aren't hard-coded — derive from the finite-difference computation above.

---

### 5.2 LAYER_ASPECTS (0x02)

Five Ptolemaic aspects: Conjunct (0°), Sextile (60°), Square (90°), Trine (120°), Opposite (180°).

**Differential orbs by body class & aspect class:**

| Body class       | Conjunct/Opp | Square/Trine | Sextile |
|------------------|-------------:|-------------:|--------:|
| Luminary (Sun, Moon)             | 10° | 9° | 6° |
| Personal (Mercury, Venus, Mars)  | 8°  | 7° | 5° |
| Social (Jupiter, Saturn)         | 7°  | 6° | 4° |
| Outer (Uranus, Neptune, Pluto)   | 6°  | 5° | 3° |

For a pair (A, B), the **max orb** is the **larger** of A's orb and B's orb for that aspect class. Standard practice.

**Applying vs separating:**
A pair is "applying" if the angular separation is *decreasing* in time, else "separating". Detect by recomputing the absolute angle delta at `unix_ms + 86400000.0` (one day later) and comparing.

**Output fields per aspect:**
```
{ "a": "Sun", "b": "Moon", "kind": "Conjunct",
  "exact_deg": 0.0, "orb_deg": 4.21, "max_orb": 10.0, "applying": true }
```

`orb_deg` is the absolute deviation from exact, in degrees, to 2 decimals. Sort output by `orb_deg` ascending.

---

### 5.3 LAYER_HARMONICS (0x04)

Aspects beyond Ptolemaic. Each has an exact angle; orb max is **2°** for all harmonics (uniform — they're tighter aspects).

| Kind           | Exact (°)         | Harmonic |
|----------------|-------------------|---------:|
| Semisextile    | 30°               | 12       |
| Semisquare     | 45°               | 8        |
| Quintile       | 72°               | 5        |
| Sesquisquare   | 135°              | 8        |
| Biquintile     | 144°              | 5        |
| Quincunx       | 150°              | 12       |
| Septile        | 360/7 ≈ 51.4286°  | 7        |
| Biseptile      | 720/7 ≈ 102.8571° | 7        |
| Triseptile     | 1080/7 ≈ 154.2857°| 7        |
| Novile         | 40°               | 9        |
| Binovile       | 80°               | 9        |

Output schema mirrors aspects:
```
{ "a": "Mercury", "b": "Jupiter", "kind": "Quintile",
  "harmonic": 5, "exact_deg": 72.0, "orb_deg": 0.81 }
```

---

### 5.4 LAYER_MIDPOINTS (0x08)

**Halfsum tree.** For every ordered pair (A, B) with `idx(A) < idx(B)`, compute:
```
midpoint(A,B) = ((lon_A + lon_B) / 2)  if |lon_A − lon_B| ≤ 180°
              else ((lon_A + lon_B) / 2 + 180°) mod 360°
```
(The standard "shorter-arc" midpoint.)

Output every midpoint:
```
{ "a": "Sun", "b": "Moon", "lon": 156.72,
  "sign": "Virgo", "deg": 6.72 }
```

**Midpoint contacts (Ebertin's 8th-harmonic structure).** For each midpoint M and each third planet P (P ≠ A, P ≠ B), check whether P sits within **1.5° orb** of M *modulo 45°* (i.e., on the 8th-harmonic dial). Eight-harmonic axis positions of M are: M, M+45°, M+90°, M+135°, M+180°, M+225°, M+270°, M+315°.

A contact is reported when the smallest angular distance from P to any of those eight positions is ≤ 1.5°:
```
{ "planet": "Mars", "midpoint": ["Sun", "Moon"],
  "orb_deg": 1.12, "harmonic": 8 }
```

Sort `midpoint_contacts` by orb ascending. Cap at 64 entries (defensive — the full enumeration is 10·45 = 450 candidates, vast majority will fall outside orb).

---

### 5.5 LAYER_DECLINATIONS (0x10)

Requires LAYER_POSITIONS values; if `LAYER_DECLINATIONS` is requested without POSITIONS, compute declinations internally but do not emit the positions JSON.

**Per-body output** (only if LAYER_POSITIONS is *not* set; otherwise declinations live in the positions records):
```
{ "body": "Mars", "decl": 23.4, "out_of_bounds": true }
```
`out_of_bounds`: `|decl| > 23.44°` (beyond the tropics). Astrologically significant — flag it.

**Parallels and contraparallels.** For every pair (A, B) with idx(A) < idx(B):

- **Parallel:** `|decl_A − decl_B| ≤ 1°`. Same hemisphere.
- **Contraparallel:** `|decl_A + decl_B| ≤ 1°`. Opposite hemispheres, mirrored magnitude.

Emit:
```
{ "a": "Mars", "b": "Saturn", "kind": "Parallel", "orb_deg": 0.42 }
```

**Pluto exclusion.** Because the kernel uses `lat = 0` for planets, Pluto's declination can be off by up to ~6° (Pluto's true ecliptic latitude reaches ±17°). At a 1° parallel orb this would generate false positives and false negatives. **Skip all parallel/contraparallel checks involving Pluto.** Document the exclusion in the JSON via a top-level field `"parallels_note": "pluto_excluded_lat_approx"` when LAYER_DECLINATIONS is requested. If a future revision adds Pluto's true latitude (VSOP87 or analytic), remove the exclusion and drop the note.

---

### 5.6 LAYER_ANTISCIA (0x20)

Antiscia axis: 0°♋–0°♑ (longitudes 90° and 270°). Antiscion of `λ` is `(180° − λ) mod 360°`.

- **Antiscia** between A and B when `(lon_A + lon_B) mod 360° ∈ [179°, 181°]` (orb 1°).
- **Contra-antiscia** between A and B when `(lon_A + lon_B) mod 360° ∈ [359°, 360°] ∪ [0°, 1°]` (orb 1°). Axis is 0°♈–0°♎.

Emit:
```
{ "a": "Venus", "b": "Pluto", "kind": "Antiscia", "orb_deg": 0.63 }
```
`orb_deg` is the distance from exact (180° for antiscia, 0°/360° for contra).

---

### 5.7 LAYER_DIGNITIES (0x40)

Per-body essential dignity. **Sect:** determined by Sun above/below horizon, but without a location we treat **day sect** = Sun in zodiac longitude `[0°, 180°]` past Aries 0° crossing? — No: a kernel without geolocation cannot determine diurnal/nocturnal sect properly. **Convention for this kernel:** sect is determined by whether the Sun's geocentric ecliptic longitude is in a "day chart" zodiac half — but that is meaningless without horizon. So instead: **sect = day if the call site's local time hour ∈ [6, 18) else night**, but we don't have local time either.

**Resolution:** the kernel cannot know sect. It returns **both** triplicity rulers (day and night), and the JS side picks based on `Date` local-hour heuristic if/when displayed. In the JSON, triplicity is reported as the *day* ruler unless overridden; spec the field as `triplicity_day` and `triplicity_night` to be unambiguous.

**Tables.**

#### Rulership / Exaltation / Detriment / Fall

| Body    | Rules                  | Exalted in (deg)  | Detriment           | Fall in (deg)     |
|---------|------------------------|--------------------|---------------------|-------------------|
| Sun     | Leo                    | Aries (19°)        | Aquarius            | Libra (19°)       |
| Moon    | Cancer                 | Taurus (3°)        | Capricorn           | Scorpio (3°)      |
| Mercury | Gemini, Virgo          | Virgo (15°)        | Sagittarius, Pisces | Pisces (15°)      |
| Venus   | Taurus, Libra          | Pisces (27°)       | Scorpio, Aries      | Virgo (27°)       |
| Mars    | Aries, Scorpio         | Capricorn (28°)    | Libra, Taurus       | Cancer (28°)      |
| Jupiter | Sagittarius, Pisces    | Cancer (15°)       | Gemini, Virgo       | Capricorn (15°)   |
| Saturn  | Capricorn, Aquarius    | Libra (21°)        | Cancer, Leo         | Aries (21°)       |
| Uranus  | Aquarius (modern)      | —                  | Leo                 | —                 |
| Neptune | Pisces (modern)        | —                  | Virgo               | —                 |
| Pluto   | Scorpio (modern)       | —                  | Taurus              | —                 |

**Rule:** A body in its rulership sign earns +5. In its exaltation sign and within ±5° of the exaltation degree earns +4 (outside ±5° but still in the sign: +3, exaltation-by-sign). Detriment: −5. Fall: −4 in fall sign (±5° of the listed degree).

Outer-planet rulerships are **modern** — disable them when reporting traditional dignity. The kernel emits both: `score_traditional` and `score_modern`. The JS side decides which to display. (Cheap to compute, real conceptual choice — document it.)

#### Triplicity (Dorothean, Lilly's version)

| Triplicity (signs) | Day ruler | Night ruler | Participating |
|--------------------|-----------|-------------|---------------|
| Fire (Aries, Leo, Sag)        | Sun     | Jupiter | Saturn  |
| Earth (Taurus, Virgo, Cap)    | Venus   | Moon    | Mars    |
| Air (Gemini, Libra, Aqu)      | Saturn  | Mercury | Jupiter |
| Water (Cancer, Scorpio, Pis)  | Mars    | Mars    | Moon    |

Score +3 if the body is the day or night ruler of its triplicity (kernel emits both), +0 otherwise.

#### Egyptian Terms (Bounds)

Five segments per sign, each ruled by one of Mercury/Venus/Mars/Jupiter/Saturn. Term boundaries in degrees from start of sign:

| Sign        | Term1 (ruler, 0→)       | Term2     | Term3     | Term4     | Term5      |
|-------------|--------------------------|-----------|-----------|-----------|------------|
| Aries       | Jupiter 0–6  | Venus 6–12  | Mercury 12–20 | Mars 20–25 | Saturn 25–30 |
| Taurus      | Venus 0–8    | Mercury 8–14| Jupiter 14–22 | Saturn 22–27 | Mars 27–30   |
| Gemini      | Mercury 0–6  | Jupiter 6–12| Venus 12–17  | Mars 17–24 | Saturn 24–30 |
| Cancer      | Mars 0–7     | Venus 7–13  | Mercury 13–19| Jupiter 19–26 | Saturn 26–30 |
| Leo         | Jupiter 0–6  | Venus 6–11  | Saturn 11–18 | Mercury 18–24 | Mars 24–30   |
| Virgo       | Mercury 0–7  | Venus 7–17  | Jupiter 17–21| Mars 21–28 | Saturn 28–30 |
| Libra       | Saturn 0–6   | Mercury 6–14| Jupiter 14–21| Venus 21–28 | Mars 28–30   |
| Scorpio     | Mars 0–7     | Venus 7–11  | Mercury 11–19| Jupiter 19–24 | Saturn 24–30 |
| Sagittarius | Jupiter 0–12 | Venus 12–17 | Mercury 17–21| Saturn 21–26 | Mars 26–30   |
| Capricorn   | Mercury 0–7  | Jupiter 7–14| Venus 14–22  | Saturn 22–26 | Mars 26–30   |
| Aquarius    | Mercury 0–7  | Venus 7–13  | Jupiter 13–20| Mars 20–25 | Saturn 25–30 |
| Pisces      | Venus 0–12   | Jupiter 12–16| Mercury 16–19| Mars 19–28 | Saturn 28–30 |

If the body is the term ruler of its position: +2.

#### Faces (Decans, Chaldean order)

10° segments per sign. Chaldean order starting Aries 0°: Mars, Sun, Venus, Mercury, Moon, Saturn, Jupiter, Mars, Sun, Venus, … (cycles through 7 in that order, repeating).

| Sign        | 0–10°    | 10–20°  | 20–30°  |
|-------------|----------|---------|---------|
| Aries       | Mars     | Sun     | Venus   |
| Taurus      | Mercury  | Moon    | Saturn  |
| Gemini      | Jupiter  | Mars    | Sun     |
| Cancer      | Venus    | Mercury | Moon    |
| Leo         | Saturn   | Jupiter | Mars    |
| Virgo       | Sun      | Venus   | Mercury |
| Libra       | Moon     | Saturn  | Jupiter |
| Scorpio     | Mars     | Sun     | Venus   |
| Sagittarius | Mercury  | Moon    | Saturn  |
| Capricorn   | Jupiter  | Mars    | Sun     |
| Aquarius    | Venus    | Mercury | Moon    |
| Pisces      | Saturn   | Jupiter | Mars    |

If the body is the face ruler of its decan: +1.

#### Score totals

```
score = (+5 if rulership) + (+4 if exalt±5°, else +3 if exalt sign only)
      + (+3 if triplicity_day or triplicity_night, picked per chart sect)
      + (+2 if term)
      + (+1 if face)
      − 5 if detriment
      − 4 if fall±5°, else −3 if fall sign only
```

If a body has **no** essential dignity at all (not in rulership/exaltation/triplicity/term/face of its position), set `peregrine: true` and `score: -5`. (Lilly: a peregrine planet is treated as in detriment.)

Emit per body:
```
{ "body": "Sun", "sign": "Taurus", "deg": 23.42,
  "rulership": null, "exaltation": null,
  "detriment": null, "fall": null,
  "triplicity_day": null, "triplicity_night": null,
  "term": "Saturn", "face": "Saturn",
  "score_traditional": 3, "score_modern": 3, "peregrine": false }
```

The `*_traditional` / `*_modern` distinction lets the JS panel switch between Lilly-school and modern-school readings without recomputing.

---

### 5.8 LAYER_LUNATION (0x80)

- `synodic_angle`: `(moon_lon − sun_lon) mod 360°`, in degrees.
- `phase_8fold`: one of `"New"`, `"Waxing Crescent"`, `"First Quarter"`, `"Waxing Gibbous"`, `"Full"`, `"Waning Gibbous"`, `"Last Quarter"`, `"Waning Crescent"`. Cardinal phases (`New`, `First Quarter`, `Full`, `Last Quarter`) are emitted only when the synodic angle is within **6°** of exact (a ~0.45-day window).
- `window`: `"new"` / `"first_quarter"` / `"full"` / `"last_quarter"` if currently within that 6° window, else `null`.
- `illumination`: f32 ∈ [0, 1], approximation `(1 − cos(synodic_angle)) / 2`. Sufficient (deviates from true Meeus illumination by <2% at non-cardinal phases — same magnitude as our `lat=0` planet declination error).
- `days_since_new`: forward Δ from most recent New Moon, in days. Approximate via `synodic_angle / 360° × 29.530588`.
- `next_new_jde`: Julian Ephemeris Date of the next New Moon. Use Meeus Ch.49 truncated:
  ```
  k = floor( (year_decimal − 2000) × 12.3685 )      // approximate k for next new
  JDE = 2451550.09766 + 29.530588861·k
         + 0.00015437·T² − 0.000000150·T³ + 0.00000000073·T⁴
  ```
  where `T = k / 1236.85`. Round forward so that `JDE > current_JDE`.

  **Polish terms:** apply Meeus Table 49.A periodic corrections (M, M', F, Ω terms) — the leading three terms are sufficient (~5-minute accuracy). Full Table 49.A is preferred if Sonnet wants to add it; minimum requirement is the three leading sine terms.

---

## 6. JSON Output Schema

The output is a single JSON object. Fields are present iff their layer bit is set. Layer-independent metadata is always present.

```jsonc
{
  "epoch_ms": 1747200000000,
  "jde": 2461174.5,
  "layers": 255,

  "positions": [ /* LAYER_POSITIONS */
    { "body": "Sun", "lon": 53.42, "lat": 0.0,
      "decl": 19.51, "sign": "Taurus", "deg": 23.42,
      "ret": false, "speed": 0.962 }
  ],

  "aspects": [ /* LAYER_ASPECTS, sorted by orb_deg asc */
    { "a": "Sun", "b": "Moon", "kind": "Conjunct",
      "exact_deg": 0.0, "orb_deg": 4.21,
      "max_orb": 10.0, "applying": true }
  ],

  "harmonics": [ /* LAYER_HARMONICS, sorted by orb_deg asc */
    { "a": "Mercury", "b": "Jupiter", "kind": "Quintile",
      "harmonic": 5, "exact_deg": 72.0, "orb_deg": 0.81 }
  ],

  "midpoints": [ /* LAYER_MIDPOINTS — all 45 pairs */
    { "a": "Sun", "b": "Moon", "lon": 156.72,
      "sign": "Virgo", "deg": 6.72 }
  ],

  "midpoint_contacts": [ /* LAYER_MIDPOINTS, sorted by orb_deg asc, cap 64 */
    { "planet": "Mars", "midpoint": ["Sun", "Moon"],
      "orb_deg": 1.12, "harmonic": 8 }
  ],

  "parallels": [ /* LAYER_DECLINATIONS — Pluto excluded, see spec §5.5 */
    { "a": "Mars", "b": "Saturn", "kind": "Parallel", "orb_deg": 0.42 }
  ],
  "parallels_note": "pluto_excluded_lat_approx",  /* LAYER_DECLINATIONS */

  "antiscia": [ /* LAYER_ANTISCIA */
    { "a": "Venus", "b": "Pluto", "kind": "Antiscia", "orb_deg": 0.63 }
  ],

  "dignities": [ /* LAYER_DIGNITIES, one per body */
    { "body": "Sun", "sign": "Taurus", "deg": 23.42,
      "rulership": null, "exaltation": null,
      "detriment": null, "fall": null,
      "triplicity_day": null, "triplicity_night": null,
      "term": "Saturn", "face": "Saturn",
      "score_traditional": 3, "score_modern": 3,
      "peregrine": false }
  ],

  "lunation": { /* LAYER_LUNATION */
    "synodic_angle": 47.18,
    "phase_8fold": "Waxing Crescent",
    "window": null,
    "illumination": 0.179,
    "days_since_new": 3.87,
    "next_new_jde": 2461177.39
  }
}
```

**Layer-independent fields:** `epoch_ms`, `jde`, `layers` (echoed back).

---

## 7. Sign & Glyph Tables

```rust
const SIGN_NAMES: [&str; 12] = [
    "Aries", "Taurus", "Gemini", "Cancer",
    "Leo", "Virgo", "Libra", "Scorpio",
    "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];
```

Glyph rendering is JS-side responsibility — the kernel emits sign names only.

---

## 8. JS Integration Changes

After the kernel is implemented:

**In `LunarTab.jsx`:**

1. Replace the body of `useTransits` (lines 918–940) with a single call:
   ```js
   const matrix = JSON.parse(_wasmMod.run_transit_matrix(Date.now(), 0xFF));
   setData({ matrix });
   ```
2. Replace `parseAstroOutput` consumption with reading `matrix.positions`.
3. Replace the JS pairwise aspect loop with reading `matrix.aspects`.
4. Aspect reading text (`READING_OVERRIDES` + `aspectReading`) **stays in JS**. The kernel emits *what* the configurations are; the JS renders *how they read*. This keeps poetic-prose authoring in TS/JS where the artist edits.
5. New panels (harmonics, midpoint contacts, antiscia, parallels, dignity scores, lunation window) added below the existing aspect list. Sonnet to write minimal panels — copy the visual style of the current TransitMatrix component.

**Out of scope:** the `READING_OVERRIDES` table itself. Not migrating that to Rust. Reason: it's poetry, not math.

---

## 9. Acceptance Criteria

A correct implementation satisfies:

1. **API:** `run_transit_matrix(unix_ms, layers)` is `#[wasm_bindgen]`-exported, accepts `f64` + `u32`, returns `String`. Module registered in `kernels/mod.rs`.
2. **Compatibility (intentional divergence):** the new differential orbs are *deliberately* tighter than JS's flat 8° for outer-planet pairs (Uranus/Neptune/Pluto: conjunct/opposition 6°, square/trine 5°, sextile 3°). A JS-listed aspect involving only outer planets may be absent from `matrix.aspects` — this is correct, not a regression. For any pair involving at least one luminary or personal planet (Sun, Moon, Mercury, Venus, Mars), the new orbs are at-least-as-permissive as the old 8° flat, so every such JS-listed aspect must still appear. Verified by running both side-by-side on three dates: now, 2026-01-01, 2027-07-04.
3. **Position parity:** `matrix.positions[i].lon` matches `run_astro` parsed longitude within 0.001°.
4. **Lunation parity:** `matrix.lunation.illumination` matches `run_lunar_phase().illumination` within 0.02 (2%).
5. **JSON validity:** output parses with `JSON.parse` in JS for all `layers ∈ {0x01, 0x02, …, 0xFF}`. Fields absent when bit clear.
6. **Performance:** `run_transit_matrix(now, 0xFF)` completes in <10ms on a 2024-era browser (Chrome + WASM). The pairwise loops are O(90) at worst — well within budget.
7. **No new deps:** `Cargo.toml` unchanged.
8. **Dignity totals:** Sun in Leo returns `score_traditional` = 5 (rulership). Mars in Cancer at 28° returns `score_traditional` = −4 (fall, within ±5° of exact fall degree). Moon at 3° Taurus returns `score_traditional` = 4 (exaltation, within ±5°). These three are smoke tests.
9. **Sect handling:** dignity scoring emits both `triplicity_day` and `triplicity_night`; JS picks. No location-dependent computation in the kernel.

---

## 10. Out of Scope (YAGNI)

- Asteroids: Chiron, Ceres, Vesta, Pallas, Juno.
- Lunar nodes (North/South Node).
- Arabic Parts (Part of Fortune, Spirit, etc.).
- Fixed stars (Algol, Regulus, Spica, etc.).
- House cusps (would require geolocation — explicitly disclaimed).
- Synastry, composite charts, progressions, solar/lunar returns.
- Profections, firdaria, zodiacal releasing, primary directions.
- VSOP87 ecliptic latitude for planets (use `lat=0` approximation; document precision in header).
- Stationary-point detection (retrograde-go-direct timing).

If the user later wants any of these, they get their own kernel.

---

## 11. Header Comment for the .rs file

Sonnet should open the file with a comment block matching the codebase style. Suggested content:

```rust
// kernels/transit_matrix.rs — Astrological Transit Matrix Engine
//
// Computes the complete current-sky astrological state in a single WASM call:
// Ptolemaic aspects with differential orbs, harmonic aspects (H5/H7/H9 + minor),
// midpoint trees with 8th-harmonic contact detection (Ebertin),
// declination parallels & contraparallels, antiscia & contra-antiscia,
// essential dignities scored on Lilly's −5..+5 scale (both traditional and
// modern rulerships), and full 8-fold lunation phase + windowing.
//
// Input:  Unix timestamp (ms, f64) and a layer bitmask (u32).
// Output: JSON string. See docs/superpowers/specs/2026-05-14-transit-matrix-kernel-design.md
//
// Astronomy: reuses geocentric_lon and is_retrograde from kernels::astro.
// Ecliptic latitude is approximated as 0 for all planets (max error in
// declination ~6° for Pluto, <2° for inner planets — sufficient for the
// 1° parallel-detection orb at the art-project precision level documented
// in the spec). The Moon uses its true ecliptic latitude from kernels::lunar.
//
// References:
//   Lilly, W., Christian Astrology, 1647.
//   Ebertin, R., Combination of Stellar Influences, 1940.
//   Meeus, J., Astronomical Algorithms, 2nd ed., Willmann-Bell, 1998.
//   Ptolemy, Tetrabiblos, c. 150 AD.
```

---

*End of spec. Sonnet 4.6: write `transit_matrix.rs` to this schema. Do not improvise dignity tables, orb tables, or aspect angles — they are exhaustively specified above. If something is genuinely missing, surface it; do not guess.*

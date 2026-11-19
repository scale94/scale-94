# /SOL — the Delay Stack and the Forge That Cannot Make Gold — design (2026-11-19)

Builds on `docs/superpowers/specs/2026-11-15-sol-design.md` (the star, the stir, the snap, the cloud clock, the
aurora). Branch `feature/sol`, which has passed all three gates. **[author]** marks the author's decisions,
**[call]** marks mine, open to correction at review or at the look round.

## 0. Intent

/SOL is visually finished but thin on information next to the other flagship tabs. This layer adds density
without adding a second verb. One snap now leaves a **stack of true arrival clocks**, one per messenger a real
flare releases. It also leaves a **ledger of fused matter**: what the core had to fuse to pay for the release,
and what this star will fuse later. Gold is never in that ledger. Every number is real physics or an honest,
labelled equivalence. The piece's critique is still the delay itself. Nothing on screen explains it.

## 1. Goals, non-goals, anti-goals

**Goals**
- Every Earth-directed snap (every cloud) shows five messengers on their true clocks: neutrinos, light/X-ray,
  energetic protons, the cloud, the core photon **[author]**.
- Every cloud makes offerings to the Vial (the sealed kernel compiled by `quintessence/compileKernel.js`):
  helium when its proton clock resolves; carbon and oxygen dated at the Sun's future helium flash **[author]**.
- Gold (Au, Z = 79) is a permanent, dark, empty row. It is never forged, never dated and never explained
  **[author]**.
- No snap stored before this layer is lost. Clouds already in `localStorage` gain their stacks and offerings
  retroactively.

**Non-goals**
- No change to the star, the shader, the stir, the snap, transit physics, coupling or the aurora.
- `mercury/elements.js` is untouched **[author]**. It is the four-element mirror palette (AIR, FIRE, WATER,
  EARTH), not a periodic table, and its colours are tuned against a probe.
- No live space-weather data and no network calls (that was pitch 4, which was not chosen).
- No Altar UI change: the Vial receives everything through the existing periphery path (§7).

**Anti-goals** (failure even if it works)
- A dashboard. The HUD must still read as something the star gives off: terminal type, numbers, one-line states.
- A stated moral. No sentence says why gold is missing, what the delays mean, or anything about civilization.
- Dishonest physics. A figure that is a model rather than a measurement is either an equivalence named as one,
  or inside a range the literature supports (§3).
- A timer that lies about the past: nothing shows as arrived before its true moment, and the kernel never knows
  more than the visitor (same rule as the cloud's orientation).

## 2. Standing rule revision **[author]**

The 2026-11-15 rule "one verb only; no buttons, no sliders, no moralizing text" is **revoked**. Austere terminal
controls, view toggles, and concise poetic or technical text are allowed where they serve the Delay Stack or the
Forge. Still in force: no stated moral (§1), the site's terminal aesthetic, and the stir as the only way to
*make* anything happen. The new controls only change what you *read*.

## 3. The physics

### 3.1 Frame of reference **[call]**

The hand is at the star. A snap is the event at the Sun at `t₀ = cloud.launchedAt`. Every messenger's clock runs
from `t₀` to its **arrival at Earth**. This matches how clouds already work (transit counted from launch).

It changes the meaning of one approved line. Today, `LIGHT · 8 min 19 s OLD` appears at the snap (Earth frame).
Under this layer the light gets its own countdown and, **on arrival**, reads `arrived · 8 min 19 s old`. The
"already stale on arrival" idea is kept and now lands at the true moment. *Alternative if the author prefers the
Gate-2 wording at the snap:* keep the old line at the snap and drop the light countdown. The rest of this spec
doesn't change either way.

### 3.2 The five messengers

All are derived from `launchedAt` and `energyErg`, the facts the cloud store already persists. `s` =
`strength01(erg)` from `solPhysics.js` (0 at 1e29 erg, 1 at 5e32 erg).

| # | Messenger | Arrives at Earth | Resolves to | Basis |
|---|---|---|---|---|
| 1 | **Neutrinos** | `t₀ + 499 s` | `undetected` **[author]** | Flare neutrinos (pion decay in the flare) are predicted, never detected; Super-K/Borexino searches give upper limits only. Travel ≈ c; the sub-second lag behind light is not shown. |
| 2 | **Light / X-ray** | `t₀ + 499 s` | `arrived · 8 min 19 s old` and the flare's X-ray class | Class is a log map of strength **[call, tune]**: peak flux `10^lerp(−6, log10 4.5e−3, s)` W/m², i.e. C1.0 at 1e29 erg to X45 at 5e32 erg (X45 ≈ the Cliver & Dietrich 2013 estimate for Carrington 1859). Shown as GOES class letter + one decimal (`M3.2`, `X12`). |
| 3 | **Energetic protons** | `t₀ + 499 s + onset`, onset log-lerped **2 h → 15 min** as `s` goes 0 → 1 **[call, tune]** | NOAA S-scale reading: peak ≥10 MeV flux log-lerped **1 → 10⁵ pfu**; below 10 pfu reads `below S1` **[call, tune]** | Relativistic protons from strong events arrive within ~10–20 min of the flash; shock-accelerated onsets from weaker events take hours. A simplification (magnetic connectivity is ignored), within the observed range. |
| 4 | **The cloud** | as built (17.6–72 h) | as built: orientation read, landing, aurora | unchanged |
| 5 | **Core photon** | `t₀ + 170 000 yr` **[call]** | never resolves in practice; shown as a calendar year | Random-walk escape time from the core, Mitalas & Sills (1992) ≈ 1.7×10⁵ yr (estimates span 10⁴–10⁵+ yr; the constant is cited in code). **[author]** Meaning: the light the core is making *at the moment of the stir* reaches the photosphere then. It is not the flare's energy (flares run on magnetic energy), and the wording must not claim it is. |

Constant names **[call]**: `NEUTRINO_DELAY_S = LIGHT_DELAY_S`, `PROTON_ONSET_SLOW_MS`, `PROTON_ONSET_FAST_MS`,
`XRAY_LOG_FLUX_MIN/MAX`, `PROTON_PFU_LOG_MIN/MAX`, `CORE_PHOTON_YEARS = 170_000`, all in `solPhysics.js` next to
the existing constants.

### 3.3 The forge: what each release cost the core

A flare's energy is magnetic. The forge never claims the snap *fused* anything. Each figure is an **equivalence**:
the mass a given reaction must make to release the snap's energy `E`. Mass defects are from atomic masses
(H 1.007825 u, ⁴He 4.002603 u, ¹²C 12 u, ¹⁶O 15.994915 u):

| Row | Reaction | J released per kg of product | At 5e32 erg | At 1e29 erg | When it is offered |
|---|---|---|---|---|---|
| **H** (spent) | fuel for the He row | — (H mass = He mass × 1.00717) | 7.8e10 kg | 1.6e7 kg | with He |
| **He** (Z 2) | 4 ¹H → ⁴He (pp chain / CNO) | 6.444e14 | 7.8e10 kg | 1.6e7 kg | **now**: when the proton clock resolves **[author]** |
| **C** (Z 6) | 3 ⁴He → ¹²C (triple-alpha) | 5.849e13 | 8.5e11 kg | 1.7e8 kg | **dated**: the helium flash, `t₀ + 7.59 Gyr` |
| **O** (Z 8) | ¹²C + ⁴He → ¹⁶O | 4.320e13 | 1.2e12 kg | 2.3e8 kg | **dated**: end of core helium burning, `t₀ + 7.70 Gyr` |
| **Au** (Z 79) | — | — | — | — | **never**. Dark row, no value, no date, no text **[author]** |

- **Correction to my earlier message.** I said carbon and oxygen come "~5 billion years" out. That's when the
  core runs out of hydrogen. Triple-alpha starts at the **helium flash at the tip of the red-giant branch, about
  7.6 Gyr from now** (Schröder & Smith 2008: RGB tip at solar age 12.17 Gyr; today is 4.57 Gyr). Oxygen builds
  during core helium burning, roughly 0.1 Gyr after that. These are the honest dates and they go in as constants
  `HELIUM_FLASH_YEARS = 7.59e9`, `HE_BURN_END_YEARS = 7.70e9` **[call]**.
- **Why helium travels with the protons.** Energetic-particle events and the solar wind carry helium nuclei
  (alpha particles) alongside the protons, so the helium offering arrives with the particle front. The *amount*
  offered is the fusion equivalent, not the trace that physically arrives. The wording keeps those two apart.
- **No iron row [call].** The table lists the elements this star will ever make, plus gold. Adding Fe as a second
  "never" would weaken gold's silence. Nitrogen (a CNO by-product) is also left out to keep the table to five rows.
- **Self-snaps feed the forge.** Clouds with `origin: 'star'` cost the core the same as hand-wound ones.

### 3.4 Time beyond `Date` **[call: hard constraint]**

The JS `Date` range ends in the year 275 760, and `7.59e9 yr` in ms (≈2.4e20) overflows `u64`. Dated offerings and
the core photon are therefore computed and stored as **calendar years (Number) by plain arithmetic**:
`yearOf(launchedAt) + CORE_PHOTON_YEARS`. They are never built with `new Date(...)` or as epoch ms, and they
compile into the kernel as `i64` years.

## 4. Approaches

| | Approach | Trade-off |
|---|---|---|
| **A (chosen) [call]** | **Derive everything** from existing cloud records with pure functions `messengers(cloud, now)` and `offerings(cloud)`. One small new store holds only the forge archive (§5.2). | The `sol_clouds_v1` schema doesn't change, so old clouds work retroactively. All timing is testable with an injected `now`, the same pattern as `cloudClock`. Cost: the archive needs care when old clouds are swept. |
| B | Store each messenger and offering as its own persisted record. | Duplicates the clock, needs a schema migration, and can drift from the wall clock. Rejected. |
| C | Event-driven: fire "arrived" events to the Vial when timers expire. | Breaks while the page is closed (no timer runs), which defeats the clock. Rejected. |

## 5. Modules

### 5.1 `src/terminal/sol/delayStack.js` (new, pure)

`messengers(cloud, now)` returns the five messengers in order, each with
`{ key, arrivesAt | arrivesYear, arrived, etaMs, reading }`. `reading` is `null` until `arrived`, so nothing
leaks ahead of the clock. The cloud entry reuses `cloudStatus` for its own fields. Clock-behind-launch and
non-finite `now` follow `cloudStatus`'s rule (read as the launch moment). Also exports `xrayClass(erg)`,
`protonOnsetMs(erg)` and `sScale(erg)`.

### 5.2 `src/terminal/sol/forge.js` (new) and the forge archive

- `FORGE_TABLE`: the five rows of §3.3 (symbol, Z, name, J/kg, offer rule). Au has `offer: null`.
- `offerings(cloud)`: `{ H, He, C, O }` masses in kg; `He`/`H` carry `deliveredAt` (= proton arrival);
  `C`/`O` carry `datedYear`.
- `forgeLedger(clouds, archive, now)`: totals = archive + the live sum over current clouds. Helium (and spent
  hydrogen) count only for clouds whose proton clock has resolved. C/O count from the snap, because the *date*
  is knowable at once: a dated entry is not a delivered one. The year shown for C/O is the latest across
  contributing clouds.
- **Archive [call]**: `localStorage` key `sol_forge_v1`, holding `{ He, H, C, O, n }` totals already folded in, in
  the same tolerant, bus-adjacent style as `cloudStore` (volatile if storage is refused, listens to `storage`
  events from other tabs). `cloudStore.sweep` and the in-flight cap call a fold hook **before** a cloud leaves
  the list:
  - a swept (landed) cloud folds He + H + C + O;
  - a cloud dropped by the 16-in-flight cap folds He + H only if its proton clock had resolved, and C + O
    always (the snap happened, so the core still owes them).
  Folding is keyed so a cloud can't be folded twice (fold, then remove, in one `commit`).
- Clearing site data loses the archive with the clouds. That's accepted, as with the clouds.

### 5.3 `compileKernel.js` and periphery: the Vial

`snapshotSol(now)` gains `forge: forgeLedger(...)` and, per in-flight/landed entry, the resolved messenger
readings (null where unarrived). `periphery.js` passes it through unchanged.

- **`house_sol`** (`solDescribe`): appends the forge, e.g.
  `… · He 7.8e10 kg delivered · C, O dated 7.59 Gyr`. Before any proton clock resolves: `He owed`.
  The `visits` and `never witnessed` strings stay exactly as they are (existing tests pin them).
- **`sol_telemetry`**: `SolCloud` gains `neutrinos: Option<&str>` (`None` → `Some("undetected")`),
  `xray: Option<&str>`, `protons: Option<&str>`, `core_light_year: i64`. A new block follows it:

```rust
/// FORGE — what the core paid.
struct Offering { symbol: &'static str, z: u8, kg: f64, delivered: bool, year: Option<i64> }
const SOL_FORGE: &[Offering] = &[
    Offering { symbol: "He", z: 2, kg: 7.76e10, delivered: true,  year: None },
    Offering { symbol: "C",  z: 6, kg: 8.55e11, delivered: false, year: Some(7590002026) },
    Offering { symbol: "O",  z: 8, kg: 1.16e12, delivered: false, year: Some(7700002026) },
];
const AU: Option<Offering> = None;
```

  `const AU: Option<Offering> = None;` is emitted in **every** compile that has a sol house, with no comment
  beside it. With no sol data, the forge block is omitted (the existing `/* never witnessed */` stays).
- Rule kept: the kernel never knows more than the visitor. He is `delivered: false` until the proton clock
  resolves, and messenger readings are `None` until their arrival.

## 6. HUD

Same panel, typography and voice as today (`SolHud.jsx`, `hudFormat.js`). Two views behind a terminal toggle
**[call]**: `[ CLOCKS ]  FORGE`. Clicking switches; the choice is remembered per viewer in `localStorage`
(try/catch, default CLOCKS).

**CLOCKS.** The existing rows (MAGNETIC TENSION, LAST RELEASE), then the **selected cloud's full stack**. By
default the newest cloud is selected. Every other cloud keeps its compact `IN FLIGHT hh:mm:ss · unread` row;
clicking or tapping a compact row selects it. Landings keep their one-line states.

```
MAGNETIC TENSION                     1840 G
LAST RELEASE                     3.1e32 erg
─ 17:42:09 ───────────────────────────────
NEUTRINOS          arrived · undetected
LIGHT              arrived · 8 min 19 s old · X28
PROTONS            00:06:41
CLOUD              20:31:52 · unread
CORE LIGHT         surfaces CE 172 026
───────────────────────────────────────────
IN FLIGHT          44:02:17 · unread
arrived · southward · coupled · −640 nT
```

**FORGE.** The ledger totals, then the dark row:

```
H    spent        7.8e10 kg
He   2            7.8e10 kg
C    6            8.5e11 kg     CE 7 590 002 026
O    8            1.2e12 kg     CE 7 700 002 026
Au   79
```

- The `Au 79` row is drawn at very low contrast (about the luminance of the panel border) with no value, date or
  hover text. It is present from the first visit, even before any snap.
- Before any snap, FORGE shows the five rows with no values (`—`).
- Countdowns use `formatEta` (seconds round up). Years use thin-space grouping and a `CE` prefix **[call, look
  round]**.
- Wording is the builder's, within these rules: one-line states, numbers, no sentence of meaning. The exact strings
  go to the author's look round.
- Under reduced motion nothing changes (the HUD is text). The panel must fit a 375 px phone without horizontal
  scroll. Long years may wrap to a second line rather than overflow.

## 7. What is not touched

`mercury/elements.js`, `QuintessenceAltar.jsx` (its `SolWitness` lines stay as they are), the shader, the aurora,
transit physics, coupling, the `sol_clouds_v1` schema, `/LUNAR`, `/MERCURY` rendering, `/ECOCIDE`.

## 8. Privacy

There is one new on-device key (`sol_forge_v1`, totals only, never sent anywhere) plus the viewer's
CLOCKS/FORGE preference. The privacy statement already has the author-ruled line about the on-device cloud store.
The builder checks that the line still covers a second key and **reports** if it doesn't. No rewording without
the author.

## 9. Verification

- Unit tests (injected `now`): each messenger's arrival and the null-until-arrived rule; `xrayClass` endpoints
  (C1.0 at 1e29, X45 at 5e32); proton onset and S-scale endpoints; offering masses against §3.3 to 3 significant
  figures; year arithmetic past the `Date` range; the fold-once archive across sweep and the in-flight cap;
  cross-tab `storage` reload of the archive; a pre-existing `sol_clouds_v1` payload gaining stacks
  retroactively.
- `compileKernel` tests: existing `house_sol` / `sol_telemetry` strings unchanged for the visits and
  never-witnessed cases; the forge block and `const AU: Option<Offering> = None;` present with sol data; He
  `delivered: false` before proton arrival.
- Lint: 0 errors, warnings ratchet not raised.
- **One author gate (Gate 4) [call]**: the HUD in both views on desktop and a real phone, with clouds at several
  stages (via the DEV hatch), to judge wording, the dark Au row, and whether it reads as a dashboard.
- Nothing is pushed without the author's explicit instruction.

## 10. Calls for the author to check

1. Frame of reference: the hand is at the star, so the light gets a countdown and the "old" line moves to its
   arrival (§3.1).
2. X-ray class map C1.0 → X45; proton onset 2 h → 15 min; S-scale 1 → 10⁵ pfu (all "tune").
3. Core photon constant 170 000 yr (Mitalas & Sills), shown as a CE year.
4. Helium-flash dates 7.59 / 7.70 Gyr (corrects my earlier "~5 Gyr").
5. Forge rows H(spent), He, C, O, Au. No Fe, no N.
6. C/O count from the snap as *dated* entries; He only after the protons arrive.
7. Forge archive key `sol_forge_v1` and the fold rules on sweep and cap.
8. CLOCKS / FORGE toggle, newest cloud expanded, compact rows selectable.
9. Au row dim and silent from the first visit, before any snap.
10. Altar UI unchanged; the Vial is fed only through the compiled kernel.

## 11. Left to the builder

Exact HUD wording and spacing within §6; module split inside `src/terminal/sol/`; how the toggle and row selection
are styled (terminal, no new icon set); the tick rate of the countdowns (≥1 Hz while visible; the harness's
visibility rules apply); rounding of masses in the HUD (two significant figures) vs the kernel (three).

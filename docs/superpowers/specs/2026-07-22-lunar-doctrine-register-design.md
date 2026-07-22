# LUNAR DOCTRINE REGISTER — design

**Date:** 2026-07-22
**Tab:** `/LUNAR` — LUNAR FRAGRANCE PROTOCOL ([src/terminal/views/LunarTab.jsx](../../../src/terminal/views/LunarTab.jsx))
**Status:** approved design, pending implementation plan

---

## 1. Problem

The lunar tab computes a great deal and concludes nothing. It has a Meeus phase
engine, a Swiss-Ephemeris transit matrix, eight accords, a synodic scrub and a
spine hook — and it never says anything decisive. The moon phase modulates
fragrance chemistry and stops there.

Two additions:

1. A **doctrine register** — a decisive, moon-phase-driven reading compiled
   through the five lore kernels. Not newspaper astrology: the kernels' own
   `Plato / Promo / Paradox` dialectic, resolving to one imperative.
2. A **WebGL moon** with real terminator relief, earthshine and dark
   adaptation, shipping alongside the existing canvas moon behind a toggle.

## 2. Source discipline (binding constraint)

The register's corpus derives from source material held outside this repository.

**This document and all shipped copy encode the *shape* only.** No events, no
persons, no places, no institutions, no substances, no biography — in the spec,
in the corpus, in comments, or in commit messages. The kernels' own published
theses (live on scale94.com) are fair material; their sources are not.

Existing precedent for the register's framing is already in-tree:
[kernelDoctrines.js](../../../src/terminal/data/kernelDoctrines.js) — *"the
alchemy to the theory's chemistry, astrology to its astronomy."* The doctrine
register is that same move, one level up.

## 3. Thesis

The synodic cycle is the arc between **being seen** and **seeing** — which is
the site's own SURVEIL→OBSERVE inversion, rendered as an orbit.

| | full moon | new moon |
| :--- | :--- | :--- |
| accord | MAXIMUM PROJECTION | DARK INCUBATION |
| melatonin | peak suppression | peak |
| `DRYNESS` (asceticism axis) | 62 | **12 — wettest, most alive** |
| state | seen by everyone, blind | unseen, sees |

The register never promises arrival. There is no ascent in it. What changes
across the cycle is not the amount of light but the **adaptation of the eye** —
so directives speak to conduct and to seeing, never to becoming.

`DRYNESS` in [lunarAccords.js](../../../src/terminal/data/lunarAccords.js)
already encodes the axis: it climbs monotonically 12 → 96 across three quarters,
peaks at MINERAL STILLNESS (last quarter, lowest sillage of all eight accords),
and then **breaks** — 96 → 85 → 12. The cycle completes the full desiccation,
reaches the monument, and refuses it. That refusal is the register's spine.

## 4. The five lenses

Each kernel is an encryption scheme. One is a disclosure.

| kernel | cipher | axis |
| :--- | :--- | :--- |
| FISH-SCALE-KERNEL 11.1.1 | counterfeit — the cut disguised as texture | the monument reached and refused; purity is desiccation |
| HUDELSCHUBLADE-ROUTING-KERNEL 1.0.0 | entropy — value in plain sight, unlocked, protected by search cost | chaos is not absence of order, it is order with no cheap inverse |
| BLACK-HOLE-TAXONOMY-KERNEL 1.0.0 | depth — the substrate nobody reads | the asymptote; the exit is to stop orbiting, not to arrive |
| SEMIOTIC-SYNTHESIS-KERNEL 9.9.9 | homophony — sound holds, payload recompiles at each border | untouchability bought with the body; maximum projection, zero vision |
| ROSSIGNOL-…-KERNEL 5.5.5.5 | **none — it publishes** | the ring closes; one song, four tongues, identical response |

ROSSIGNOL takes no element in §5.3: it *is* the fifth. It scores off a complete
spine instead.

## 5. Lens engine — `compileLunarDoctrine.js`

Pure function, no React, no DOM:

```
compileLunarDoctrine({ age, illumination, phaseId, transits, planets, spine })
  → { kernel, axis, plato, promo, paradox, directive, coda, provenance, scores }
```

### 5.1 Phase affinity (primary — the moon dominates)

Continuous, not bucketed, so the scrub recompiles smoothly rather than stepping.
Each kernel has a center on the synodic wheel; affinity falls off by wrapped
angular distance.

| kernel | center (days) | sits at |
| :--- | ---: | :--- |
| HUDELSCHUBLADE | 0.0 | new → waxing crescent |
| BLACK HOLE | 9.5 | first quarter → waxing gibbous |
| SEMIOTIC 9.9.9 | 16.5 | full → waning gibbous |
| FISH SCALE | 22.0 | last quarter (dryness 96) |
| ROSSIGNOL | 26.5 | waning crescent → return to new |

```
d = wrappedDistance(age, center, SYNODIC_PERIOD)   // ≤ 14.77
affinity = 100 * exp(-(d*d) / (2 * SIGMA*SIGMA))   // SIGMA = 2.5
```

Wrapping is load-bearing: HUDELSCHUBLADE at center 0.0 must score identically at
age 0.1 and age 29.4.

### 5.2 Transit modulation (secondary — 0…30)

The dominant transit is `transits[0]` (already orb-sorted in `useTransits`).
Each kernel holds planetary weights; the bonus is their sum over the aspect's
two bodies, scaled by orb tightness.

```
tightness = clamp(1 - orb / 8, 0, 1)
bonus     = 30 * tightness * (w[p1] + w[p2]) / 2
```

| kernel | weighted bodies |
| :--- | :--- |
| HUDELSCHUBLADE | Mercury 1.0 · Saturn 0.8 · Pluto 0.5 |
| BLACK HOLE | Pluto 1.0 · Saturn 0.7 · Neptune 0.6 |
| SEMIOTIC 9.9.9 | Mercury 1.0 · Mars 0.7 · Uranus 0.7 |
| FISH SCALE | Neptune 0.9 · Venus 0.7 · Pluto 0.6 |
| ROSSIGNOL | Jupiter 0.9 · Venus 0.8 · Sun 0.6 |

The binding constraint is the tightest centre separation on the wheel —
HUDELSCHUBLADE (0.0) to ROSSIGNOL (26.5), 3.031 days. At σ = 2.5 a rival that
close scores 47.98, so even carrying both maximum bonuses it reaches 92.98 and
cannot overturn a lens sitting on its centre (100). σ is calibrated to that
seam and is not independently choosable — an earlier draft used 4.2, where the
same rival held 77.1 and the guarantee was false. The bonus *can* decide the
overlap zones, which is exactly the intent: the moon selects, the sky breaks
ties.

**No-transit path.** If WASM is unavailable or no aspect is within orb, there is
no null branch: lunar age *is* the Sun–Moon elongation, so synthesise
`☉ ⊕ ☽` conjunct at new, `☍` opposite at full, `□` at the quarters, with orb
derived from distance to the exact phase. Astronomically correct, and a reading
always exists.

### 5.3 Spine bonus (0…15)

Reads `getSpine()` from
[spineStore.js](../../../src/terminal/quintessence/spineStore.js).

- element → kernel, following the established element↔house mapping:
  FIRE → HUDELSCHUBLADE (chaos), AIR → SEMIOTIC 9.9.9 (transmission),
  WATER → FISH SCALE (wetness), EARTH → BLACK HOLE (bare metal). **+8**
- `spine.phase` matches the current accord → **+4** to the kernel owning that arc.
- all four vertebrae marked → **+11 to ROSSIGNOL only** (the closed ring).

Bonuses sum, capped at 15 — so a fully-marked spine can lift ROSSIGNOL by the
full 15 while any other kernel tops out at 12.

### 5.4 Selection

Highest total wins. Deterministic tie-break: fixed kernel order (the §4 table
order). The function is pure — identical inputs always yield an identical
reading.

## 6. Corpus — `data/kernelHoroscope.js`

Pure data, no imports beyond `lunarAccords`. Slot structure per kernel:

| slot | keyed by | count |
| :--- | :--- | ---: |
| `axis` | — | 1 |
| `plato` / `promo` | arc quadrant (4) | 8 |
| `paradox` | aspect tension class (4) | 4 |
| `directive` | arc quadrant (4) | 4 |
| `coda` | spine complete / partial | 2 |

≈ 19 strings × 5 kernels ≈ **95 authored strings**. (Larger than the ~60 first
estimated; the arc-quadrant dimension is what grew it, and it is what keeps the
same kernel from reading identically at new moon and at last quarter.)

**Arc quadrants** (corpus indexing, distinct from the §5.1 centers):

```
Q0 DARK-WAXING   age  0.00 –  7.38
Q1 LIGHT-WAXING  age  7.38 – 14.77
Q2 LIGHT-WANING  age 14.77 – 22.15
Q3 DARK-WANING   age 22.15 – 29.53
```

**Tension classes**, reusing `ASPECT_TENSION` already in
[LunarTab.jsx](../../../src/terminal/views/LunarTab.jsx):
`harmonic (t ≤ -1)` · `fused (t = 0)` · `friction (t = 1)` · `polarity (t = 2)`.

**Directive rules.** One sentence. Imperative mood, one verb, one object. No
hedging, no "may", no "invites". It must be possible to be wrong — that is what
makes it worth reading. No directive promises arrival or transformation; they
address conduct and seeing.

## 7. Render — `lunar/DoctrineRegister.jsx`

```
◈ DOCTRINE REGISTER
  the alchemy to the chemistry above · astrology to its astronomy

  LENS  HUDELSCHUBLADE-ROUTING-KERNEL 1.0.0
        selected by new moon × ☿ □ ♄ orb 1.2°

  PLATO    …
  PROMO    …
  PARADOX  …

  ⟶  <one imperative>

  moon 3.1% ↑ · day 1.4 · dryness 12 · ☿□♄ 1.2° · spine FIRE / DARK INCUBATION
```

Mounts between the selected-accord detail block and `<TransitMatrix>`. Recompiles
live off `currentAge`, so **dragging the existing time-scrub recompiles the
doctrine** — a second life for a control that already ships.

Header badge gains a third line beneath the existing two, so the register does
not read as a contradiction of `⊘ NO ESOTERICISM · CITED`:

```
◈ DOCTRINE REGISTER · DECLARED
```

**Cross-link.** When the lens is HUDELSCHUBLADE, render a `↗ house: chaos` line
in the same idiom as the existing OCK family cross-link, reading
`snapshotPeriphery().art`. This is the previously unplugged wire between the
kernel's entropy thesis and the Feigenbaum tab.

## 8. Shader moon — `lunar/LunarShaderMoon.jsx` + `lunar/moonShader.js`

Raw WebGL2, one program, one fullscreen quad, GLSL held in its own module. Not
r3f — a single-pass 340px fragment shader does not need a scene graph, and this
avoids the inline-uniform upload hazard hit during the nebula work.

### 8.1 Fragment pipeline

1. disc intersect; `discard` outside
2. sphere normal `N`
3. selenographic lon/lat from `N`
4. height field: FBM highlands − mare basins (port `MARE_BASINS` as a GLSL const
   array) − multi-scale craters
5. **normal perturbation** from the height gradient (±ε in lon/lat) → `Np`.
   This is the terminator relief: crater rims cast long shadows where
   `dot(Np, L) → 0`. The canvas path cannot do this — it shades a smooth sphere
   with albedo painted on.
6. sun direction `L` from `uLunarAge`; `lambert = max(0, dot(Np, L))`
7. albedo: highland/mare mix, near-neutral silver — the lit face stays honest
8. **earthshine** on the unlit region:
   `E = pow(1 - illum, 1.6) * uAdapt`, violet-weighted, soft-wrapped around the
   limb. Physically correct (brightest at new moon) and doctrinally exact: the
   half the sun refuses is not empty.
9. limb darkening
10. **chromatic corona** — R/G/B radial falloffs at slightly different radii,
    violet-biased, so the halo disperses rather than gradient-stops
11. starfield, count and brightness scaled by `uAdapt`

### 8.2 Dark adaptation

The pigment of scotopic vision is called visual purple. It bleaches in light and
regenerates only in darkness. That is the interaction:

- `adapt ∈ [0, ceiling]`, `ceiling = 1 - 0.85 * illumination`
- rises toward `ceiling` at `dt / 25` — full adaptation ≈ 25 s
- **bleach**: an illumination jump > 0.15 in one frame (i.e. a scrub toward
  full) drops `adapt` instantly to `adapt * 0.15`
- tab hidden → freeze, do not reset (you are not in the light)
- `prefers-reduced-motion` → pin `adapt` at `ceiling`, no ramp

Sit still at new moon and the violet unlit half emerges out of nothing over ~25 s
while the starfield fills in. Scrub to full and it is gone in a frame, and has to
rebuild. The longer you stay in the dark, the more you see.

### 8.3 SCOTOPIC meter — **in**

A `SCOTOPIC ▁▂▃▄▅▆▇█` readout below the moon, violet fill, reading `adapt`, in
the visual language `ParamBar` already establishes on this tab.

Decided in rather than left optional: without it the adaptation ramp reads as
*nothing is happening*, which is a UX failure rather than a subtlety. It is one
component and one uniform read — trivially removable if it proves noisy.

### 8.4 Toggle

`localStorage['lunar_moon_renderer_v1'] ∈ { 'canvas', 'shader' }`.

Default `shader` during evaluation so the comparison is the default experience.
Whether the canvas path is deleted is **the author's call after live browser
review** — not a decision this spec makes. If `getContext('webgl2')` returns
null, fall back to canvas regardless of the stored setting.

## 9. Files

| file | role |
| :--- | :--- |
| `data/kernelHoroscope.js` | authored corpus, pure data |
| `lunar/compileLunarDoctrine.js` | pure compile function (§5) |
| `lunar/DoctrineRegister.jsx` | the reading (§7) |
| `lunar/moonShader.js` | GLSL sources as strings |
| `lunar/LunarShaderMoon.jsx` | WebGL host, adaptation state, fallback |
| `lunar/MoonRendererToggle.jsx` | persisted switch + SCOTOPIC meter |

`LunarTab.jsx` gains imports, two mount points, and one pure extraction:
`SYNODIC_PERIOD`, `PHASES`, `getPhase` and `ASPECT_TENSION` move to
`lunar/synodic.js` because they are module-private and the engine needs them.
No new logic, no behaviour change. Nothing existing is deleted.

## 10. Testing

`compileLunarDoctrine.test.js`
- determinism: identical inputs → identical output
- all five kernels are reachable across a swept 0…29.53 arc
- no `undefined` / empty string over a sampled grid of (age × tension × spine)
- wrap: affinity at age 0.1 ≈ affinity at age 29.4 for HUDELSCHUBLADE
- no-transit path synthesises the Sun–Moon aspect and still returns a reading
- transit bonus cannot overturn a kernel sitting on its center

`kernelHoroscope.test.js` (corpus completeness)
- every kernel has all 19 slots filled, no empty strings
- no duplicate directives across the corpus

`LunarShaderMoon.test.jsx`
- falls back to canvas when `getContext('webgl2')` returns null
- `adapt` clamps to `[0, ceiling]`; illumination jump bleaches
- unmount cancels rAF **and** removes every listener (the pointer-listener
  unmount leak from the ecocide work must not be repeated here)

## 11. Out of scope

- birth-chart / natal input — the tab's "current sky only" stance stands
- changes to `TransitMatrix`, `LUNAR_ACCORDS`, or `DRYNESS` values
- deleting the canvas moon (author's call, post-review)
- WebGL for the ecocide map (tracked separately)

## 12. Sequencing

This is two deliverables sharing one tab and one thesis. They are coupled by
doctrine (earthshine *is* the HUDELSCHUBLADE reading rendered in light) but not
by code — nothing in §8 imports anything from §5. Implement as two phases,
each independently shippable and independently reviewable:

- **Phase 1 — register.** §5 – §7 + the §10 tests for them. Canvas moon untouched.
- **Phase 2 — shader moon.** §8 + its tests. Register untouched.

Phase 1 first: it is the thing that was asked for, and it does not gate on a
judgement call about killing the canvas moon.

## 13. Open items

None. SCOTOPIC resolved in §8.3; canvas deletion is explicitly deferred to live
review rather than left ambiguous.

# Ecocide Tab — The Regenerative Mirror

**Date:** 2026-07-20
**Status:** Approved design, pre-implementation
**Surface:** `src/terminal/views/EcocideTab.jsx` (+ new WebGL life-field, + eco kernel-doc texts)

---

## 1. Context & Problem

The Ecocide tab is a one-axis morality play. `GROWTH_MANDATE` is the only lever, and
the design is an intentional **double-bind trap** — the source literally states "There is
no winning move. Grow and destroy, or retreat and collapse." Dropping below 2.0% growth
fires escalating social-collapse penalties.

Two structural weaknesses:

1. **The map is a one-way ratchet.** The country-cell system (`countryCells`, driven by
   `driftMult`/`scaleMult` phase arrays that are zero at HOMEOSTASIS and only climb) can
   *only* fracture. There is no branch where cells heal, re-green, knit, or bloom. Do the
   right thing and — accurately to the user's complaint — **nothing happens.** This is
   ecologically false: protected/restored ecosystems visibly flourish.

2. **Two of the three featured eco texts are weak.** The biocenosis kernel
   (`BIODIVERSITY-PROMPT-1.0.1.md`, "FLORA 1.0 // THE BIOCOENOSIS BUILD") is genuinely
   strong — real, specific, expert (his actual ~360qm plot, *Lacerta agilis* 13 km away,
   *Chelostoma rapunculi* on *Campanula*, "Trachtfließband," planned neglect). The other
   two (`ATMOSPHERIC-SIM-KERNEL`, `GAIA-SCALE-KERNEL`) are old / AI-assisted hedge-voice
   and fall far below that bar.

## 2. Thesis — "Degrowth is the key"

The core reconciliation between the tab's existing nihilism and the new regenerative
vision: **healing is real but gated on taming throughput.**

> You cannot greenwash your way out. Max every protection lever while still chasing 5%
> growth and **nothing heals.** The protection levers are inert until growth drops toward
> steady-state. Only when throughput is tamed does restoration unlock and the world
> visibly comes back. The reward is real, but earned — not a switch.

This keeps the growth axis nihilistic (the tab keeps its teeth), ties cleanly into the
Daly steady-state kernel, and makes the 2.0% mandate marker flip meaning: it stops being
"the floor you're punished for dropping below" and becomes "the ceiling you must drop
below to escape."

## 3. The Five-Lever Model

Growth stays as the throughput/extraction axis + the gate. Four protection levers join it.
Five levers total — one poison-tipped throughput axis, four protection axes — mirrors the
site's quintessence / fifth-element symmetry.

| Lever | Range | Role |
| :--- | :--- | :--- |
| **GROWTH** | 0–10% (existing) | Throughput/extraction **and** the degrowth gate. |
| **TOXICITY_CAP** | 0–1 | Throttle on pollution / emissions / chemical load. Drives the poison-color channel, semi-independent of raw death. |
| **SANCTUARY** | 0–1 | Protected + rewilded extent. Passive recovery — "leave it alone" at planet scale. |
| **RESTORATION** | 0–1 | Active regeneration. **The bloom engine** — the lever that makes visibly good things appear. |
| **NATIVE_BIODIVERSITY** | 0–1 | *Richness* of recovery — species density, palette variety, corridor webs. Not magnitude; quality. |

### 3.1 Signed vitality

The whole model collapses to a single signed state `v ∈ [−1, +1]`:

- **−1** = void / dead (today's FINAL_STATE)
- **0** = HOMEOSTASIS — present-day stressed baseline; the sim starts here
- **+1** = FLOURISHING — superbloom, beyond baseline

### 3.2 The forces (client-side integrator)

```
Extraction  E  = growthToGdp(growth, degradation) − 1          // structural damage (exists today)
Toxicity    T  = E · (1 − toxicityCap)                          // poison channel — color-rot, semi-independent
Gate        G  = 1 − smoothstep(1.5%, 3.0%, growth)            // THE DEGROWTH KEY. ~0 above 3%, opens below 2%
Healing     H  = G · (sanctuary·0.35 + restoration·0.65)        // inert until G opens; restoration dominates
Richness    R  = nativeBiodiversity                             // palette variety / species density of the bloom

dv/dt = H·kʜ − (E·k₁ + T·k₂)          // clamp v ∈ [−1, +1]
```

`G` is the thesis in one line: at 5% growth `G≈0` → `H≈0` → nothing heals regardless of
protection sliders (the greenwash trap, mechanically true). Below 2% growth `G` opens, `H`
overtakes damage, `v` climbs positive, the world blooms. `R` never adds to `H` magnitude —
it modulates how *alive* (varied, species-rich) the bloom reads.

### 3.3 The double-bind reframe

Today the double-bind fires social-collapse penalties on sub-2% growth with no escape. New
rule: **the protection levers buy down the social penalty.**

- Degrowth *alone* (low growth, protections low) → unemployment riots — the honest
  political cost of naive contraction. Penalty fires at full strength (existing behavior).
- Degrowth *with* sanctuary/restoration funded → a just transition — penalty mitigated,
  scaled down by `(sanctuary + restoration)`.

"There is no winning move" becomes "there is exactly one narrow, expensive, real path" —
which *is* degrowth economics. The trap keeps its teeth for the naive player and rewards
the sophisticated one.

### 3.4 Engine risk (explicit)

The current sim only degrades. `run_ecocide` (WASM) and the JS fallback integrator are both
one-directional ratchets — neither models regeneration. Signed vitality means the healing
branch is **new integrator code**. Plan: extend the JS integrator to be bidirectional and
treat the WASM kernel as the collapse-only fast path (or add a client-side healing term).
The math in 3.2 is the real new engine, not a tweak to the existing tick.

## 4. The Bidirectional World

The map becomes a phase ladder that runs both ways, mirrored around HOMEOSTASIS:

```
FINAL ← COLLAPSE ← OVERSHOOT ← EXTRACTION ← [HOMEOSTASIS] → RECOVERY → REWILDING → FLOURISHING → ABUNDANCE
 red/void ........ existing collapse ........ green baseline ........ new bloom mirror ........ gold/superbloom
```

Positive phase names approved: **RECOVERY / REWILDING / FLOURISHING / ABUNDANCE.**
Existing collapse phases and `PHASE_LABEL`/`PHASE_COLOR` extend into a positive mirror
(green → gold palette) rather than being replaced.

Two composited layers, both reading `v`:

### 4.1 SVG country-cells (the skeleton) — Phase 1

The existing fracture/drift/redden logic runs in *reverse* for `v > 0`:

- Cells knit inward past baseline (the `driftMult`/`scaleMult` arrays gain negative-phase
  entries, or `v`-signed equivalents).
- Borders soften and **brighten green** — a *knitting lattice*, the literal inverse of
  today's separating lattice.
- The ecological stress-hotspots (`ECO_HOTSPOTS`) flip from red stress → sanctuary-green
  as `v` climbs.
- The fill-color ramp extends past baseline green into vivid/varied life (modulated by `R`).

This half reuses the existing engine, unclamped into positive territory. It alone delivers
"do the right thing → something visibly happens" and is the entire Phase 1 payoff.

### 4.2 WebGL / r3f life-field (the soul) — Phase 2

A **Gray-Scott reaction-diffusion** field, GPU-driven (same lineage as the nebula / mercury
shader work), composited with the SVG. Thematically exact: RD / Turing patterns are
*literally* how biological pattern forms.

- **Landmask is non-negotiable.** The RD field is masked to the continents — the country
  geometry is rendered to a mask texture so life grows *on land*, not ocean. Without this
  the field reads as an abstract lava-lamp shader (the documented failure mode), not Earth.
- **Seeded from real restoration geography.** Bloom fronts originate from the same
  `ECO_HOTSPOTS` (Amazon, Congo, Borneo…) — now bloom origins instead of stress points.
- `restoration` seeds/accelerates the spreading bloom fronts.
- `nativeBiodiversity` (`R`) controls palette variety and species density so high-bio
  recovery looks *richly* different from monoculture green.
- The ocean clears to living blue; the graticule warms. This is the full mirror-world
  identity.

**Risk:** making the field read as *Earth* and not *abstract pretty shader*. Mitigation is
the landmask + hotspot seeding above. Verify in the real browser (per the user's standing
"look before diagnosing" rule) before calling it done.

## 5. The Governance Mirror

The left rail is currently the 13 Paradoxes (Seraphine governance) — pure collapse theater.
Under a bidirectional world it is only half a story.

- **Collapse half (keep as-is):** the 13 paradoxes activate and tip to VIOLATED as `v`
  goes negative. Untouched.
- **Flourish half (new, Phase 3 / stretch):** as `v` climbs positive, a **Regeneration
  Doctrine** rail fades in on the same real estate — principles that light up green as
  they're *satisfied* rather than tripping red. Drawn from FLORA's six axioms (Autochthony,
  Trophism, Micro-limnology, Lithosphere, Phenology, Planned Neglect) + the harvested
  **Long-Time Veto**. The same panel that indicts on the way down affirms on the way up.
- **SARG** needs no inversion — it already rises with coherence. It simply gets to breathe
  into its high range for the first time (today nothing ever pushes it up).

Phased as **stretch, not launch-blocking** — cheap once the phase ladder exists (it reuses
the paradox-panel pattern, run positive).

## 6. The Texts — levers-as-doctrines trio

Principle: **each featured eco text IS a lever cluster.** The tab stops being "a viz with
articles bolted on" and becomes one coherent object — five levers, three doctrines, one
bidirectional world.

| Text | Disposition | Becomes |
| :--- | :--- | :--- |
| **FLORA / BIOCOENOSIS** (`BIODIVERSITY-PROMPT-1.0.1.md`) | **Keep** | The Restoration + Native-biodiversity doctrine. Untouched — it is the bar. |
| **ATMOSPHERIC-SIM** (`ATMOSPHERIC-SIM-KERNEL-3.0.0.md`) | **Overhaul** | The **Sanctuary + Toxicity** doctrine. Kill the three-CLI-var hedge-voice. Rewrite FLORA-grade: named protected biomes, real toxic-load mechanisms (nitrogen deposition, PFAS, ocean-acidification pH figures), the actual policy of leaving-alone. |
| **GAIA-SCALE** (`GAIA-SCALE-KERNEL-5.5.5.md`) | **Chop from ecocide + harvest** | Remove from the eco index (it's a sovereignty kernel — relocate its tags to the panopticon/sovereignty layer). Harvest **only** the Long-Time Veto ("Does this action mortgage the future to pay for the present?") into a new **degrowth / steady-state doctrine**, with DALY-SIM seeding the economics. |

**Overhaul standard (hard rule):** real, specific, named, expert-level. No generic advice,
no AI hedge-voice. Measured against FLORA. Both new/overhauled texts are drafted in-chat for
the user's line-edit before anything ships — no auto-generated prose committed to the repo.

## 7. Slider UX

- **GROWTH_MANDATE stays the hero lever** (it's the gate) — prominent, as today.
- The four protection levers live in a **PROTECTION PROTOCOL** cluster, **collapsed by
  default**, that expands. Keeps the first read clean (the tab already fights for mobile
  space) and rewards engagement.
- All five levers are functionally wired regardless of collapsed/expanded state.

## 8. Phasing

Each phase is independently shippable and browser-verifiable.

1. **Phase 1 — The engine.** Signed-vitality bidirectional integrator; all 5 sliders wired;
   the gate + double-bind reframe; phase ladder both ways; SVG map runs in reverse
   (§4.1). Fully playable — healing visible via SVG-reverse, no shader yet. Delivers the
   core "do the right thing → something happens."
2. **Phase 2 — The soul.** The WebGL/r3f Gray-Scott life-field (§4.2), landmasked, seeded
   from the hotspots. Where the socks land. Built and verified in isolation.
3. **Phase 3 — The words + the encore.** Overhaul ATMOSPHERIC; write the degrowth doctrine;
   chop/relocate GAIA (§6); the Regeneration Doctrine rail (§5).

## 9. Testing / Verification

- **Engine:** unit-test the integrator — assert `G≈0` at 5% growth kills healing even with
  all protections maxed (the greenwash invariant); assert `v` climbs positive only below
  the gate threshold; assert the double-bind penalty scales down with sanctuary+restoration.
- **Map:** browser-verified via the preview — screenshot HOMEOSTASIS, a collapse trajectory,
  and a flourish trajectory. Confirm the life-field is landmasked (blooms on land, not
  ocean) before claiming Phase 2 done.
- **Texts:** user line-edits both drafts in-chat before commit.
- Existing tests touching ecocide (`periphery.test.js` phase-name contract, observatory
  emit) must stay green — the positive phase names must extend `PHASE_NAME` without breaking
  the existing HOMEOSTASIS/EXTRACTION/OVERSHOOT/COLLAPSE/FINAL contract.

## 10. Out of Scope

- No push without explicit user command (standing rule).
- The collapse machinery (13 paradoxes, viral timeline, error flood) is **kept**, not
  gutted — this is a tenfold *addition*, not a rewrite of the existing identity.
- Relocating GAIA-SCALE's non-eco content into the sovereignty layer is noted but its full
  re-home is not specified here (only its removal from the eco index).

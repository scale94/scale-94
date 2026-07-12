# CHAOS — the Feigenbaum Fade as the Visible Twin of the Quintessence Cascade

**Date:** 2026-07-12
**Status:** Approved
**Branch context:** nightly/quintessence-groundwork

## 0. The buried irony this design reveals

The Feigenbaum Fade tab and the quintessence compiler already run the same
mathematics in parallel, without ever speaking about it:

- The compiler maps trend velocity → `r` in the logistic map's interesting band
  (2.8–4.0) via `trendToPressure`, and the PLATA/PLOMO verdict threshold
  (bpm 160) sits exactly at the Feigenbaum point
  `R_CHAOS = 3.569945671877` (`src/terminal/quintessence/engineWitness.js`).
- The sphere's Hopfield field carries its own live `r`, Lyapunov exponent, and
  phase regime; visitor scroll entropy pushes `r` toward 3.999 in the draw loop
  (`src/terminal/views/ArtTab.jsx`, `useAssociativeField`).

The butterfly loop is likewise already complete in code, just unspoken: a
Bluesky trend (the butterfly logo, literally) is the injection payload, its
velocity becomes `r`, and whether that `r` crosses the Feigenbaum point decides
the verdict. A butterfly flaps on Bluesky and the kernel's verdict changes.

This design does not add the mythic↔scientific bridge (alchemy↔chemistry,
astrology↔astronomy). It reveals the one already present.

## 1. Scope & the untouchable core

**The canvas is sacred.** Sphere rendering, node density, particle ecology,
draw-loop code, audio, and sphere physics are not modified by any part of this
design. The visual design is locked at its current state.

Changes live exclusively in:

- Tab chrome (React DOM around the canvas)
- The quintessence compiler chain (`periphery.js`, `compileKernel.js`,
  `taxonomyRegistry.js`, `engineWitness.js` consumers)
- Mercury altar / ReliquaryView
- KernelTab fifth slot
- Boot sequence / nav labels / command aliases
- `kernelCitations.js` (doctrine lines)

## 2. The rename (surface + vial)

### Visitor-facing surfaces say CHAOS

- Boot sequence line: `feigenbaum_fade` field renders `chaos`
  (`src/terminal/components/BootSequence.jsx:18`).
- Mobile nav button aria-label `Art` → `Chaos`
  (`src/terminal/App.jsx:1531`).
- Keyboard-hint row: `['a','art']` → `['a','chaos']` — the `a` binding is
  unchanged (`src/terminal/App.jsx:1572`).
- Command alias: `chaos` added to the alias map, resolving to the existing
  `art` action (`src/terminal/hooks/useCommandDispatch.js:31`).

### Internal keys are frozen (no persisted-data breakage)

- Route stays `~/system/art`; `activeTab` stays `'art'`.
- Existing observatory events stay `art_*`; `periphery.art` keeps its key.
- Persisted journal/totals data remains valid.

### The vial adopts the name

- `house_art` → `house_chaos` in the `PeripheralWitness` struct and its
  `houseLine` call (`src/terminal/quintessence/compileKernel.js:192,205`).
- ReliquaryView slot label `house: art` → `house: chaos`
  (`src/terminal/quintessence/ReliquaryView.jsx:119`).
- `taxonomyRegistry.js`: ownership key `house_art` → `house_chaos`.
- Tests updated: `compileKernel.test.js`, `taxonomyRegistry.test.js`,
  `periphery.test.js` (assertions on the house name).
- Previously sealed artifacts keep saying `house_art`. They are sealed;
  that is the point.

### Ownership decision (locked)

**AESTHETICS keeps ownership of `house_chaos`.** Chaos is the method; beauty
is the discipline that reads it. Transferring to MATHEMATICS or PHYSICS would
collapse the tab into a raw math simulator and lose the project's core
tension: rigorous deterministic mathematics capturing something viscerally
human. The AESTHETICS detail line adopts cascade vocabulary.

## 3. house_chaos: the full resonance ceremony

The sphere testifies its actual dynamics, not just interaction counts.

### New witness data

- On each Hopfield phase transition, the tab emits one gaze event carrying
  `{ r, lyapunov, regime }` via the existing `onPhaseTransition` hook in
  `useAssociativeField` — event-driven, no polling. Event kind stays in the
  `art_*` namespace (internal keys frozen), e.g. `art_regime`.
- `periphery.art` gains `lastR`, `lyapunov`, `regime` (nullable, like all
  witness fields).

### The Δr line

At compile time the compiler computes the trend-driven `r` (existing). It now
also reads the sphere's last witnessed `r` and compiles the divergence:

```
house_chaos: Some("chimera fused ×1 · 14 bifurcations · resonance 0.83
                   · sphere r 3.72 λ +0.021 CHAOTIC"),
/// the sphere ran ahead of the world by Δr +0.31 — the visitor's hand
/// crossed r∞ before the network did
```

- Δr = sphere `r` − engine `r`, signed, rendered with direction language
  ("ran ahead of the world" / "trailed the world").
- If the sphere was never phase-witnessed, the Δr line compiles as absence
  ("the twin cascade never spoke") — Option::None doctrine preserved.
- Determinism holds for free: new periphery fields enter the canonical hash
  like every other witness. No `Math.random()`; mulberry32 only.

### Value statement

Today the tab contributes one count-line to the vial. After this change it is
the only house whose testimony shares an axis with the verdict itself — the
strongest single house in the periphery.

## 4. Twin-cascade HUD strip (tab chrome)

One instrument line in the chrome below the canvas, terminal-styled to match
existing status indicators (NOT drawn on the canvas):

```
CASCADE ∷ sphere r=3.412 λ=−0.08 PERIODIC │ engine r=∅ unwitnessed │ r∞=3.5699
```

- Sphere side reads live `phaseR` / `phaseLyap` / `phaseRegime` state already
  present in ArtTab.
- Engine side reads the armed spine's trend if one exists (post-trend-pick),
  mapping through `trendToPressure`; otherwise `∅ unwitnessed`.
- When both sides are live, a `Δr` field appears.
- This is the visible bridge to compilation: the visitor watches their own
  hand (sphere r) race the world (engine r) toward the Feigenbaum point that
  decides PLATA/PLOMO.

## 5. Terminal output: the mythic register

The KERNEL OUTPUT block keeps its `theory:` citations untouched and gains one
paired `doctrine:` line per kernel — the alchemy to the theory's chemistry:

```
theory:
hopfield (1982) — neural networks and physical systems, PNAS 79
doctrine:
the cue is a summons · the basin is a séance · memory is a place the field falls into
```

- Implementation: a `doctrine` field added alongside `kernelCitations.js`
  entries; the log formatter prints it after the theory block when present.
- Scope v1: the 25 sphere kernels only.
- The 25 doctrine lines are content work staged for the operator's editing —
  the plan delivers placeholder-free drafts, the operator refines voice.

## 6. Altar-side echo

The reliquary's `house: chaos` slot shows the sphere's waiting testimony
pre-compile — e.g. `sphere r 3.72 · Δr +0.31` when both cascades are
witnessed — so the visitor sees what will be sealed before they forge.

## 7. Break-the-seal + [compile]

In the KernelTab fifth slot's sealed branch (`KernelTab.jsx:810`), `[compile]`
joins `[load ↗]`:

- Clicking `[compile]` flips the slot into a one-beat inline confirm state:
  `break seal 0x3F2A? [forge anew] · [keep]`
- Only `forge anew` clears the sealed artifact and navigates to the Mercury
  altar to re-arm. `[keep]` (or clicking away) restores the sealed slot.
- Misclicks cost nothing; the seal keeps its gravity. One vial exists at a
  time — no lineage shelf, no silent overwrite.

## 8. Verification

- **Unit tests:** periphery chaos fields (present/absent), compileKernel's
  three `house_chaos` states + Δr present/absent lines, taxonomy registry
  ownership, seal-breaking flow (clear + re-arm).
- **Browser pass** (the "is the functionality flawless" check) at the end of
  implementation: cue firing, resonance mode, manual fusion, bifurcation, the
  new HUD strip states (∅ / live / Δr), doctrine lines in the log, and one
  full compile round-trip including break-the-seal.
- Calibration: this is an art project — reasonable confidence ships;
  no over-verification.

## 9. Explicitly out of scope

- Any canvas/rendering/physics/audio change
- Deep rename (route, activeTab key, event namespace migration)
- Reliquary lineage / artifact history storage
- Doctrine lines for non-sphere kernels (v2 if wanted)

# THE ACADEMIC & MYTHIC REGISTRY · Taxonomy Lens Layer — Design Spec

- **Date:** 2026-07-11
- **Status:** APPROVED PENDING USER REVIEW
- **Parent:** 2026-07-09-kernel-of-art-quintessence-compiler-design.md (the compiler this layer deepens)
- **Vision source:** "3.0.0 the grand vision" §1 — *Integrate the Academic & Mythic Registry*: the quintessence kernel as the translation layer between humanities, soft sciences, and mythic archetypal structures, via a clean structural object-mapping schema.
- **Framing:** Quintessence register throughout. No alien. The faculty reads; it does not surveil.

---

## 1 · Purpose

The compiled `KERNEL_OF_QUINTESSENCE.rs` currently speaks with two 4-line fragment pools. This layer replaces that thin voice with a **faculty of 15 disciplines** — the full cross-disciplinary taxonomy from the grand vision — so that every structure in the artifact is *read by* the discipline that owns its subject matter. The registry is the vision's requested "structural JSON or dynamic object-mapping schema," implemented as one pure-data module consumed by both the compiler and the reliquary UI.

The artifact's shape does not change. Its doc-comments become the lens layer: each compiled structure gains one tagged disciplinary reading of the visitor's actual value.

## 2 · Decisions already made (brainstorm outcomes, 2026-07-11)

| Question | Decision |
|---|---|
| Form in artifact | **Lenses in the doc-comments.** No dedicated `mod academy` block; the taxonomy is the interpretive voice, not a data receipt. |
| Lens distribution | **Owned structures + element tint.** Fixed discipline→structure ownership; the chosen element inflects the register of all fragments. |
| UI scope | **Artifact + reliquary schematic annotation.** Each pre-compile slot shows `read by ⟨DISCIPLINE⟩`. No new UI surface. |
| Architecture | **Registry data module + shared resolver** (`taxonomyRegistry.js`), consumed by `compileKernel.js` and `ReliquaryView.jsx` — the `engineWitness.js` precedent: shared so voice and UI can never disagree. |

## 3 · Lens form

A lens renders as one tagged doc-comment line inside the existing structure comments:

```rust
/// ⟨SEMIOTICS⟩ the sign outran its referent · velocity 3.20 read as panic
```

- Single disciplines: `⟨SEMIOTICS⟩`, `⟨PHILOSOPHY⟩`, `⟨HISTORY⟩` …
- Overlap-matrix pairs carry the double tag: `⟨ASTRONOMY ⇄ ASTROLOGY⟩`, `⟨CHEMISTRY ⇄ ALCHEMY⟩`, `⟨COGNITIVE SCIENCE ⇄ MYTHOLOGY⟩`, `⟨LINGUISTICS ⇄ HERMETICS⟩`.
- A lens reads the visitor's **actual value** (banded — see §5), never generic flavor text.
- Empty periphery houses keep `HOUSE EMPTY — never witnessed` and gain the owning discipline's **absence-reading** on the same line block (e.g. Religious Studies on unvisited ciphers: *the sealed volumes were never approached*).

## 4 · The ownership map (all 15 disciplines, each exactly once-or-more)

| Kernel structure | Owning discipline | Tier | Band input |
|---|---|---|---|
| Header vial line (replaces `VIAL_LINES`) | **Literature & Philology** | Humanities | — (tint + seed only) |
| `ShlomoState` daemon | **Cognitive Science ⇄ Mythology** | Overlap | daemon (TheMask/TheDevil) |
| `Pirarucu` armor + dryness (replaces part of the Narcos/armor comments) | **Chemistry ⇄ Alchemy** | Overlap | dryness 0–100 |
| `Narcos` payload (replaces `CORRUPTION_LINES`) | **Semiotics** | Soft sciences | trend velocity |
| `use core::…` imports (the kernel's grammar) | **Linguistics** | Soft sciences | — (the artifact's own syntax read as a dead tongue that executes) |
| `Sokushinbutsu` entropy lock | **Astronomy ⇄ Astrology** | Overlap | lunar illumination (or unread) |
| `NecromanticEngine` | **Psychology** | Soft sciences | bpm (160 = chaos onset) |
| Council pair line | **Philosophy** | Humanities | paradox count |
| Council directive line | **Linguistics ⇄ Hermetics** | Overlap | — (the directive is quoted; the lens frames it as executed cipher) |
| `PlataOPlomo` verdict | **Economics** | Soft sciences | verdict (Plata/Plomo) |
| `PeripheralWitness` struct intro | **Anthropology** | Soft sciences | count of filled houses |
| house: ciphers | **Religious Studies** | Humanities | verifies/unlocks/sealed (or absent) |
| house: transmissions + ledger | **History** | Humanities | ledger depth (or absent) |
| house: essences | **Aesthetics** | Humanities | collisions/crystallized (or absent) |
| houses: ecocide / privacy / surveillance | **Sociology** | Soft sciences | visit counts (or absent) |

**Unlensed by design:** `mod engine_witness` — its claim is "computed, not narrated"; the faculty does not annotate what compiled Rust executed. The panic handler also stays verbatim (genome inheritance).

Multi-slot owners emit **one lens line for the group**, placed above the first owned house line: Sociology reads its three houses as one reading of the visitor's institutional exposure; History reads transmissions + ledger as one reading of the visitor's record — never near-duplicate lines per house. In the reliquary, every owned slot still shows its `read by ⟨TAG⟩` annotation individually.

## 5 · Element tint and banding

The spine element inflects the register of **every** lens:

| Element | Tint register |
|---|---|
| FIRE | mythic-active — verbs of ignition, will, execution |
| WATER | alchemical-dissolving — solution, dissolution, tincture |
| AIR | semiotic-analytic — signs, syntax, measurement |
| EARTH | historical-material — strata, sediment, record |

Selection order per lens: **band first, tint second, seeded pick third.**

1. `bands(value)` maps the owned datum to a named band (e.g. velocity `<1 murmur / <3 current / else panic`; dryness thirds; illumination quarters; bpm `<160 calcifying / ≥160 chaotic`; paradox `0 / 1 / >1`). Band functions live in the registry entry, are total (handle null → `absent`), and are unit-tested at edges.
2. The band's pool holds fragments per tint, **≥2 variants each**, picked with the existing hash-seeded `mulberry32` rng — same determinism discipline as today's `pick(rng, …)`.
3. Values are interpolated into the fragment (`· velocity 3.20 read as panic`), so identical bands still show the visitor's exact number.

## 6 · Architecture

New module: `src/terminal/quintessence/taxonomyRegistry.js` — pure data + resolver, no React, no bus.

```js
export const TAXONOMY = [
  {
    id: 'semiotics',
    tier: 'SOFT_SCIENCES',        // HUMANITIES | SOFT_SCIENCES | OVERLAP_MATRIX
    tag: 'SEMIOTICS',             // pairs use e.g. 'ASTRONOMY ⇄ ASTROLOGY'
    owns: ['narcos_payload'],     // slot ids, shared with ReliquaryView's slot list
    bands: (ctx) => ...,          // ctx → band name; null-safe; returns 'absent' for empty houses
    pools: { /* [band]: { FIRE: [...], WATER: [...], AIR: [...], EARTH: [...] } */ },
  },
  // … 15 entries
];

// Deterministic: slot → owner → band(ctx) → tint(element) → seeded pick → tagged line.
// Unknown slot / missing pool → tint-neutral fallback fragment. Never throws.
export function lensFor(slotId, ctx, rng) { ... }
export function ownerOf(slotId) { ... }   // for the reliquary annotation
```

**`compileKernel.js` changes:** delete `VIAL_LINES` / `CORRUPTION_LINES`; call `lensFor(...)` at each lensed structure. Canonical-hash inputs unchanged — lens resolution happens after the hash exists, so existing hashes' determinism discipline is untouched (artifact text changes, therefore artifact hashes change; that is expected and versioned by BUILD, not a migration concern — the reliquary holds one kernel at a time and recompiles overwrite).

**`ReliquaryView.jsx` changes:** each schematic slot gains a right-aligned `read by ⟨TAG⟩` annotation via `ownerOf(slotId)`; slot ids are added to the existing `slot(...)` entries so UI and compiler share the vocabulary. Obeys existing monument/Fade-Doctrine styling; no pure white.

Data flow (unchanged): source tabs → spineStore/observatoryBus → altar → `compileKernel` (now consulting `taxonomyRegistry`) → localStorage → reliquary.

## 7 · Error handling

- Unknown slot id or missing band/tint pool → discipline tag + tint-neutral fallback fragment. Never throws, never blocks a compile.
- Null/absent periphery values → the `absent` band (the discipline's absence-reading). Empty houses stay `None`.
- Registry import failure is not handled specially — it is pure data in the same bundle; if it cannot load, the app itself cannot.

## 8 · Testing

- `taxonomyRegistry.test.js`:
  - **Completeness:** all 15 disciplines present; the three tiers populated (5 humanities, 6 soft sciences, 4 overlap pairs); every lensed artifact slot has exactly one owner; every band pool carries all four tints, each with ≥2 fragments (absence pools included for periphery-owned lenses).
  - **Determinism:** same ctx + seed → identical line, twice.
  - **Band edges:** velocity/dryness/illumination/bpm/paradox boundary values land in the documented band; bpm 160 → chaotic (mirrors the Plata threshold).
  - **Fallback:** unknown slot returns tagged fallback, does not throw.
- `compileKernel.test.js` additions: compiled source contains every expected `⟨…⟩` tag exactly where owned; `engine_witness` block contains no `⟨` tag; existing determinism tests still pass.
- Component smoke: reliquary schematic shows `read by ⟨…⟩` per slot in both filled and awaiting states.
- Follows existing patterns in `src/terminal/quintessence/__tests__/`.

## 9 · Voice constraints

- Quintessence / fifth-element register. **No alien**, anywhere, including fragment pools.
- Terminal vocabulary: `compile`, `seal`, `deposit`, `witness`, `read` — never `generate`, `submit`, `save`, `analyze`.
- Fragments are readings of the visitor's data in each discipline's own idiom — a semiotician's sentence must be distinguishable from a sociologist's. Anthropological-lyrical baseline; discipline flavor on top; element tint as inflection, not costume.

## 10 · Non-goals

1. **Full registry panel** — a browsable taxonomy surface (Mercury- or Kernel-side) is its own future spec.
2. **Periphery deepening** — richer `/art`, `/ecocide`, ledger, scaling representation beyond visit witnesses stays separate (grand vision remainder).
3. **Rust/WASM changes** — none; `engine_witness` intentionally unlensed.
4. **New bus events or spine fields** — the registry reads only what already flows.
5. **Chimera glyph, kernel sharing** — unchanged from parent spec's non-goals.

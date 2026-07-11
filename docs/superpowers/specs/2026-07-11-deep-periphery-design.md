# DEEP PERIPHERY · The Four Houses Learn to Speak — Design Spec

- **Date:** 2026-07-11
- **Status:** APPROVED PENDING USER REVIEW
- **Parent:** 2026-07-09-kernel-of-art-quintessence-compiler-design.md (§3.4 empty houses, §7 loose-end bus emits) and 2026-07-11-academic-mythic-registry-design.md (lens layer; non-goal #2 now in scope)
- **Vision source:** "3.0.0 the grand vision" — the underrepresented tabs `/art`, `/ecocide`, ledger, scaling wired into the central kernel with real data depth.
- **Framing:** Quintessence register. No alien. Absence is data; presence now carries testimony.

---

## 1 · Purpose

The peripheral witness currently reduces four of the site's richest surfaces to `entered N×` — and `/art` (the vector sphere, the site's largest single component) is not witnessed at all. This feature bridges each tab's most telling signal onto `observatoryBus` and compiles it into the kernel, so a visitor who fused a chimera, ran the ecocide simulation to collapse, or drew a cascade verdict carries that testimony out in the vial.

## 2 · Decisions already made (brainstorm outcomes, 2026-07-11)

| Question | Decision |
|---|---|
| Witness depth | **One rich house per tab.** One Option field carrying the tab's most telling signal — a portrait, not a telemetry dump. |
| Ownership | **NEW `house_art` read by AESTHETICS** (grouped with `essences`, same multi-slot rule as HISTORY/SOCIOLOGY); **`house_ecocide` and `house_ledger` enriched in place** (SOCIOLOGY and HISTORY keep their seats); **scaling gets no new house** — its deliberate choice already runs deep in the spine; only its dead `scaling_visit` channel is wired. |
| Bridging | **Direct emits.** Each tab calls `observatoryBus.emit(...)` at the moment its internal event already fires. No bridge modules, no internal-bus exports. |
| Fragments | **No new lens pools.** The existing tinted fragments cover the enriched readings; only `detail` functions and one `owns`/band update change in the registry. |

## 3 · New bus vocabulary (all under existing categories)

| Emit | From | Reducer effect on `totals` |
|---|---|---|
| `gaze / art_resonance { sim }` | ArtTab, where `setResonanceResult(result)` fires with a non-null result (~ArtTab.jsx:1895) | `gaze.art.resonances++`, `gaze.art.lastSim = sim` |
| `gaze / art_bifurcation { total }` | ArtTab, both bifurcation spawn sites (~ArtTab.jsx:544, :2239) | `gaze.art.bifurcations = total` (latest running total wins) |
| `gaze / art_chimera {}` | ArtTab, where `setChimeraActive` first becomes truthy (~ArtTab.jsx:664) | `gaze.art.chimeras++` |
| `gaze / ecocide_phase { phase, metabolicRift, exergyRate }` | EcocideTab, beside `ecocideBus.emit` (EcocideTab.jsx:484) | `gaze.lastEcocide = payload` |
| `transmissions / verdict_issued { verdict }` | LedgerTab, beside `ledgerBus.emit` (LedgerTab.jsx:179) | `transmissions.verdict = verdict` |
| `gaze / scaling_visit {}` | ScalingTab, mount effect (the reducer for this kind already exists — the emitter never did) | `gaze.lastScaling = payload` (existing reducer line) |

`gaze.art` initializes lazily on first art event (`{ resonances: 0, lastSim: null, bifurcations: 0, chimeras: 0 }`); `makeTotals()` gains `lastEcocide: null` on gaze and `verdict: null` on transmissions so the shape is declared, not implicit.

All emits are fire-and-forget through the bus's existing listener try/catch. Emitting must never affect tab behavior — one added line per site, no refactors inside the tabs.

## 4 · Periphery snapshot (additive)

`snapshotPeriphery()` gains three nullable fields; every existing field keeps its exact shape (house visit-counts stay plain numbers):

```js
{
  // …existing fields unchanged…
  art:          gaze.art ? { resonances, lastSim, bifurcations, chimeras }
                : (tabsVisited.art > 0 ? { visits: tabsVisited.art } : null),
  ecocideSim:   gaze.lastEcocide ? { phase, rift: metabolicRift } : null,
  ledgerVerdict: transmissions.verdict ?? null,
}
```

The art fallback distinguishes "entered the sphere but never touched it" (visits-only object) from "never came" (`null`). `exergyRate` is witnessed on the bus but not compiled — the phase + rift pair is the portrait; YAGNI.

## 5 · The artifact

### 5.1 Struct

`PeripheralWitness` gains `house_art`, placed adjacent to `essences` so AESTHETICS reads its pair with one grouped lens. Field order becomes: `ciphers, transmissions, house_ledger, essences, house_art, house_ecocide, house_privacy, house_surveillance` (struct definition AND const literal).

### 5.2 House lines

- `house_art`: interactions witnessed → `Some("chimera fused ×1 · 14 bifurcations · resonance 0.83")` (omitting zero-count parts); visits-only → `Some("entered 2× · the sphere untouched")`; never → `None`.
- `house_ledger`: `Some("entered 1× · verdict GUILTY")` — verdict part only when `ledgerVerdict` exists. A verdict with zero recorded visits still compiles the house (the verdict IS a visit witnessed).
- `house_ecocide`: `Some("entered 3× · phase COLLAPSE · metabolic rift 0.72")` — sim part only when `ecocideSim` exists; same visit-less rule.
- `house_privacy` / `house_surveillance`: unchanged.

### 5.3 Registry

- `aesthetics.owns` gains `house_art`; its band becomes `(essences || art) ? 'witnessed' : 'absent'` (entering the sphere counts as witnessing form, even untouched); its `detail` interpolates what was witnessed, first match wins: art interactions (`1 chimera · resonance 0.83`) → essences (`2 crystallized`) → visits-only art (`the sphere seen, unengaged`) → null.
- `sociology.detail` gains the sim reading when present: `metabolic rift ${rift.toFixed(2)} at ${phase}`.
- `history.detail` gains the verdict when present: `the cascade ruled ${verdict}`.
- No new fragment pools; no new disciplines; `engine_witness` stays unlensed.

### 5.4 Witness depth

`filledHouses` counts the new art house: denominator becomes **9** (anthropology detail text updates). Bands shift one notch: `sparse < 3 / attended < 7 / dense ≥ 7`. `max_layers` (engine coupling) picks the extra house up automatically via witness depth — no engine changes.

## 6 · Reliquary

One new schematic row between essences and ecocide: `slot('house_art', 'house: art', …)` with preview from the art field (`'1 chimera'` / `'entered 2×'`), annotated `read by ⟨AESTHETICS⟩` via the existing `ownerOf` path. Ecocide/ledger row previews enriched the same way as their house lines (abridged). AESTHETICS annotation count goes 1→2.

## 7 · Error handling

- Dead bus → all three new periphery fields `null` → houses compile `None`/thin exactly as today. Never blocks, never throws.
- Malformed payloads (missing `sim`, non-numeric `rift`) → the reducer stores what it gets; periphery normalizes defensively (numbers or the part is omitted from the compiled line).
- Emits inside tabs are one-liners guarded by the bus itself; a throwing subscriber cannot break ArtTab's render loop (existing bus guarantee).

## 8 · Testing

- `observatoryBus.test.js` additions: each new kind reduces correctly; `gaze.art` lazy init; running-total semantics for `art_bifurcation`; shape declared in `makeTotals`.
- `periphery.test.js` additions: art three-state (interactions / visits-only / never); `ecocideSim` + `ledgerVerdict` present/absent; existing fields byte-identical.
- `compileKernel.test.js`: fixtures gain the new fields; `house_art` renders all three states; enriched ecocide/ledger lines; `of 9` in the anthropology detail; determinism holds.
- `taxonomyRegistry.test.js`: aesthetics band truth table (essences×art), new detail functions, band edges for the shifted anthropology notches (2/3/7).
- `reliquaryView.test.jsx`: AESTHETICS ×2; the new row renders in both filled and awaiting states.
- Tab emit sites: no component tests for ArtTab/EcocideTab/LedgerTab (3k-line canvas components; the bus reducer tests cover the contract) — ScalingTab's mount emit gets a smoke assertion only if a ScalingTab test file already exists; otherwise skip (art-project calibration).

## 9 · Voice constraints

Unchanged from the registry spec: quintessence register, no alien, `compile/seal/deposit/witness/read` vocabulary. New house-line copy ("the sphere untouched", "the cascade ruled…") follows the existing houseLine idiom.

## 10 · Non-goals

1. UI changes inside the four tabs (emits only).
2. Compiling `exergyRate`, art query/analogy counts, or gestalt quality — witnessed later if ever needed.
3. New lens fragment pools or disciplines.
4. Rust/WASM changes.
5. A rich scaling house (deliberate choice already in the spine).
6. TFGSphere's dormant `sphere_clicked` TODO (separate surface, separate decision).

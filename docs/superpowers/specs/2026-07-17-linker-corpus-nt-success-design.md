# THE LINKER — Corpus Wiring + nt success

**Date:** 2026-07-17
**Status:** Approved (design approved in-session; Seraphine sign-off on the art side)
**Terminology:** **nt success** — the initial life choice made at eighteen; the default
build target, fixed at link time. Defined once here; all future docs use lowercase
"nt success" without re-definition.

## 1 · Doctrine

The quintessence artifact gains a linker. Every build forks from the same fork
point; **TARGET 0: nt_success** is the default build — the only target that ships
without documentation, and the one target the quintessence compiler never links.

The kernel corpus in `src/terminal/data/kernelBuilds.js` (43 entries, computed at
compile time — never hardcoded) becomes the library of *documented divergences*
from TARGET 0. The visitor's session links only the divergences they actually
touched. A visitor who never opens the encyclopedia still compiles a non-nt
artifact: the empty-corpus render states that the artifact's own existence is
already proof of divergence.

Two corpus contact verbs, in the site's Some/None gradient:

- **consulted** — the divergence's documentation was opened.
- **linked** — the divergence's engine was executed. Linked wins ties; a build
  appears in exactly one list.

## 2 · Witness plumbing (no new run-path code)

Existing events carry almost everything:

| Verb | Event | Payload id | Where emitted |
|---|---|---|---|
| consulted | `transmissions / kernel_loaded` | kernelBuilds **build id** | `App.jsx` `handleKernelClick` (already exists) |
| consulted | `gaze / kernel_consulted` | **articleId** | `App.jsx` `handleNav`, kernel-tab branch (ONE new emit) |
| linked (join) | `transmissions / kernel_completed` | **wasm alias** | `useCommandDispatch` (already exists, untouched) |

The wasm alias map (`resolveWasmAlias`) is many-to-one and lossy, so the run path
cannot name a corpus entry. Therefore **linked is a join, not an emit**: a corpus
build is linked iff it was consulted AND `resolveWasmAlias(buildId)` appears in
the session's completed-run aliases. Doctrine reading: you opened the divergence's
documentation and executed its engine; the linker binds the two.

### Bus reducer (`observatoryBus.js`)

- `transmissions.kernelsLoaded = {}` — accumulate `kernel_loaded` ids (skip `'—'`).
- `transmissions.ranAliases = {}` — accumulate `kernel_completed` ids (skip `'—'`).
- `gaze.kernelsConsulted = {}` — accumulate `kernel_consulted` articleIds.

Session-scoped, in-memory, like every other witness. No persistence. No KernelTab
UI changes.

## 3 · Periphery (`periphery.js`)

New nullable `corpus` field, resolved against `kernelBuilds` (imported pure data)
and `resolveWasmAlias`:

```js
corpus: {
  linked:    ['BOSONIC-KERNEL-3.0.0', ...],  // consulted ∧ alias ran
  consulted: ['SOMA-KERNEL-5.5.0', ...],     // consulted only
  total: 43,                                  // kernelBuilds.length
} | null                                      // encyclopedia never touched
```

- Consulted set = union of `kernelsLoaded` build ids and `kernelsConsulted`
  articleIds mapped to builds. Ids that resolve to no corpus entry are ignored
  (sphere kernels are already witnessed in `house_chaos`).
- Ordering follows `kernelBuilds` order — deterministic.
- `corpus` is part of periphery, therefore **hashed**: witness data, not voice.
  The `null` field joins the canonical form like every other nullable house.
  (Hash identity across code versions was never a property — `compiledAt` is
  hashed, so no two compiles ever share a hash.)
- The linker is an organ, not a house: `filledHouses` and the anthropology
  band ("of 9 houses") are untouched.

## 4 · Artifact block (`compileKernel.js`)

New section between THE PERIPHERAL WITNESS and the panic handler:

```rust
/// **THE LINKER** — every build forks from the same fork point.
/// TARGET 0: nt_success · fixed at eighteen · ships without documentation.
/// ⟨SOCIOLOGY ⇄ ECONOMICS⟩ <lensFor('linker')>
/// corpus: 43 documented divergences from TARGET 0 · linked 2 · consulted 1
extern crate bosonic_kernel_3_0_0;       // trust is a condensate
extern crate surveillance_tracker;       // the gaze compiles to self-discipline
// consulted, never linked: SOMA-KERNEL-5.5.0
const TARGET_LINKED: Option<&str> = None; // nt_success — NEVER LINKED HERE
```

Rendering rules:

- Crate name = `build.name.toLowerCase()`.
- Doctrine comment = `doctrineFor(build.id)` from `kernelDoctrines.js`;
  unmatched → `// undoctrined · the divergence is its own gloss`.
- `status: 'DEPRECATED'` → append `// DEPRECATED — a divergence later abandoned`.
- `lore: true` → append `// genome chapter — ancestry, not divergence`.
- Extern lines cap at 7 seeded picks from the linked set (mulberry32 rng, fixed
  call order); overflow renders `// +N more linked`.
- Consulted-only builds render as one comment line each (same cap logic, shared
  budget is NOT shared — consulted lines cap at 7 independently).
- `corpus: null` → empty-house render:
  `// THE ARCHIVE UNENTERED — 43 divergences unread · only TARGET 0 remains —`
  `// and this artifact is already not it`
  plus the `TARGET_LINKED: None` const, which renders in every variant.

## 5 · Taxonomy (`taxonomyRegistry.js`) — the registry completes to sixteen

`band` is per-discipline, so `linker` gets its own entry: a fifth overlap pair,
**SOCIOLOGY ⇄ ECONOMICS** — the discipline that reads normative tracks and prices
them. The registry grows 15 → **16**, mirroring THE SIXTEEN council ring. Header
comment updates from "Fifteen disciplines … four ⇄ overlap pairs" to "Sixteen
disciplines … five ⇄ overlap pairs (the registry completes to the council's
sixteen)".

```js
{
  id: 'sociology_economics',
  tier: 'OVERLAP_MATRIX',
  tag: 'SOCIOLOGY ⇄ ECONOMICS',
  owns: ['linker'],
  band: (ctx) => {
    const c = ctx?.periphery?.corpus;
    return !c ? 'unopened' : (c.linked?.length ? 'linked' : 'consulted');
  },
  detail: (ctx) => c ? `${linked} linked · ${consulted} consulted · of ${total}` : null,
  pools: { unopened | consulted | linked } × { FIRE WATER AIR EARTH } × 2,
}
```

24 new pool lines, first-draft quality (same bar as the chaos doctrine lines),
voiced on default tracks / divergence / linkage.

## 6 · Tests

Extend existing suites, same patterns:

- **observatoryBus.test.js** — `kernelsLoaded` / `ranAliases` / `kernelsConsulted`
  accumulation; placeholder `'—'` skipped.
- **periphery.test.js** — corpus `null` when untouched; consulted via both event
  paths; linked join through `resolveWasmAlias`; non-corpus ids ignored;
  linked-wins-ties.
- **compileKernel.test.js** — linker block renders deterministically (same
  inputs + `compiledAt` → same source); cap + overflow line; DEPRECATED and
  lore annotations; doctrine fallback; empty-house render;
  `TARGET_LINKED: None` in every variant.
- **taxonomyRegistry.test.js** — band selection unopened/consulted/linked;
  `ownerOf('linker')`; 16-discipline count.

## Out of scope

- Persistence of corpus contact across sessions.
- KernelTab visual changes.
- Bespoke doctrine lines for all 43 corpus ids (pattern coverage + fallback only).
- Any push to origin (per standing rule: never without explicit command).

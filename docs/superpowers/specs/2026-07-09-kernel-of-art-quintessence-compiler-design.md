# KERNEL OF QUINTESSENCE · THE QUINTESSENCE COMPILER — Design Spec

> **Naming (2026-07-09):** The artifact is the **KERNEL OF QUINTESSENCE** — not "kernel of art." Quintessence is literal: the fifth essence, distilled from the four elements plus the visitor's spine. Every occurrence of the artifact name below uses this form; the file the visitor carries out is `KERNEL_OF_QUINTESSENCE.rs`.

- **Date:** 2026-07-09
- **Status:** APPROVED PENDING USER REVIEW
- **Depends on:** fish_scale_kernel_11.1.rs → 11.2 (genome, §11), content/rust_kernels fish_scale.rs v12.1.0 (compiled engine, §3.5), observatoryBus (ambient witness), councilSynthesis (directive + determinism pattern), LatentCollider/Crystallize (staging pattern), LunarTab transit matrix
- **Framing:** Quintessence / fifth element. The four earthbound elements (Fire, Earth, Water, Air) compile into Aether at the Mercury nebula. No alien framing anywhere in this feature — the fifth element itself is the witness.

---

## 1 · Purpose

scale94.com's final synthesis step. The visitor's journey through the site — deliberate choices plus ambient traces — compiles into one artifact: a personalized fork of Fish Scale Kernel 11.1 rendered as a hash-sealed Rust document. The artifact is simultaneously:

1. **A portrait** — the visitor's session compiled into parameter values.
2. **A work of art with a parent** — every kernel inherits the fish scale genome (purity/corruption thesis), so the output is never a data receipt.
3. **An LLM prompt** — carried out of sovereign space by the visitor and fed to any oracle of their choosing. The terminal never calls an LLM. The prompt IS the artifact.

Core epistemological anchor, displayed as a monument: **"Theory that cannot be compiled does not yet exist as knowledge."** (Axiomatic Law Ⅰ.)

## 2 · Decisions already made (brainstorm outcomes)

| Question | Decision |
|---|---|
| LLM relationship | **Prompt is the artifact.** No LLM call from the terminal, ever. Sovereignty intact. |
| Input scope | **Tight spine, ambient periphery.** Deliberate choices are required; loose-end tabs feed in only via observatoryBus witness. Absence is data ("empty houses"). |
| Geography | **Mercury is the altar, Kernel is the reliquary.** Compilation event happens at the Mercury nebula (cinematic); the artifact persists and is read in the Kernel tab. |
| Artistic parent | **Fish scale kernel is the genome; the visitor's spine is the epigenetics.** All fish scale parameters are heritable and all are used. |
| Form | **The kernel of quintessence is itself code.** A `.rs`-shaped document; wisdom in doc-comments, visitor data in parameter values. Hash-sealed with TesseractCard-style framing (build hash; glyph optional later). |
| Living module coupling (Amendment A, 2026-07-09) | **The compiler calls the compiled `run_fish_scale` (v12.1.0 WASM) at quintessence time.** Its outputs are compiled into the artifact as computed constants — part of every kernel is actually computed by compiled Rust. See §3.5. |
| Genome upgrade (Amendment B, 2026-07-09) | **Fish Scale 11.1 → 11.2: the genome must pass its own Execution Test.** Stable-Rust `no_std`, `UnsafeCell`-backed levamisole exploit (sanctioned corruption, not UB). See §11. |

## 3 · The artifact: `KERNEL_OF_QUINTESSENCE.rs`

A deterministic, syntax-highlighted Rust document. Same inputs → same kernel. No `Math.random()`; seeded PRNG only (mulberry32, same discipline as `councilSynthesis.js`). Structure:

### 3.1 Header block

```rust
// ═══════════════════════════════════════════════════════════════
// KERNEL OF QUINTESSENCE :: FORK OF FISH SCALE 11.2 :: BUILD 0x<hash8>
// COMPILED AT SCALE94.COM · QUINTESSENCE EVENT · <ISO date>
//
// THIS IS A SEALED VIAL. CARRY IT OUT.
// FEED IT TO ANY ORACLE AND ASK: WHAT DOES THIS SYSTEM WANT?
//
// Theory that cannot be compiled does not yet exist as knowledge.
// ═══════════════════════════════════════════════════════════════
```

- `BUILD 0x<hash8>`: first 8 hex chars of SHA-256 over the canonical serialized spine + periphery snapshot.
- The full hash is displayed in the reliquary seal line, not in the header.

### 3.2 Genome mapping (all fish scale parameters accounted for)

| Fish scale parameter | Compiled from | Kind |
|---|---|---|
| `Narcos` injection payload | bsky trend (deliberate pick) | spine |
| `NecromanticEngine.run_cycle` friction pair | Manifesto council pair + SKS directive; paradox residuals seed `friction_coefficient` | spine |
| The reanimated mummy | Transmission choice (Inverse Extinction Engine signal) | spine (soft — not gate-required in v1, see §8.2) |
| `Pirarucu.dryness_coefficient` | Scaling olfactory phase (1 of 8 → value on 0–100 asceticism axis) | spine |
| `Pirarucu.armor: T` | Crystallized accord if one exists this session, else the phase name itself | spine/ambient |
| `Sokushinbutsu.entropy_lock` | Lunar transit matrix (auto-compiled at quintessence time) | derived |
| `NecromanticEngine.bpm` | Feigenbaum-processed bsky trend velocity — derived, not a choice; computed via the engine coupling (§3.5), calibrated so 160 = chaos onset | derived |
| `PlataOPlomo` verdict | `bpm >= 160 → Plata` (vitality through corruption), `< 160 → Plomo` (calcification) | derived |
| `ShlomoState` | Mercury element: Fire/Air (bosons, force) → `TheDevil`, mask dropped; Earth/Water (fermions, structure) → `TheMask`, armor retained | spine |
| `SystemAtom` role | Same element choice: boson vs fermion | spine |
| Panic handler | Inherited verbatim in every kernel — failure calcifies, never crashes | constant |

**Olfactory phase → dryness_coefficient mapping** (monotone along the incubation→stillness arc):

| Phase | dryness |
|---|---|
| DARK INCUBATION | 12 |
| GREEN EMERGENCE | 24 |
| ANGULAR CITRUS | 38 |
| FLORAL AMPLIFICATION | 50 |
| MAXIMUM PROJECTION | 62 |
| RESINOUS DESCENT | 74 |
| SMOKE DISSOLUTION | 85 |
| MINERAL STILLNESS | 96 |

### 3.3 Doc-comments: the condensed wisdom

Each compiled structure carries doc-comments generated deterministically from the visitor's data, using fragment-pool composition (the `councilSynthesis.js` pattern: seeded picks from clause pools + dim-semantic fallbacks). The comments are where the artifact's voice lives — anthropological-lyrical, quintessence register. The SKS directive text is embedded (possibly abridged) inside the `run_cycle` doc-comment, since it is already a compiled LLM directive.

### 3.4 Empty houses: `Option::None`

Ambient periphery compiles as `Option<T>` fields on a `PeripheralWitness` struct, read from `observatoryBus` totals at compile time:

- ciphers (sealed / verifies / unlocks)
- gaze (sphere clicks, last lunar read, last scaling visit)
- transmissions (kernel completions, ledger depth)
- essences (collisions, crystallized count, polarity)
- visits to ecocide / ledger / privacy / surveillance (requires emitting a small number of new bus events from those tabs — see §7)

Witnessed → `Some(value)` with a doc-comment describing what the terminal witnessed. Never visited → `None` with `/// HOUSE EMPTY — never witnessed`. No gating on periphery. Absence is data.

### 3.5 The living module coupling (Amendment A)

At quintessence time, `compileKernel` calls the compiled Fish Scale engine (`run_fish_scale`, v12.1.0, `content/rust_kernels/src/kernels/fish_scale.rs`) via the existing WASM singleton. Spine → engine parameters:

| `run_fish_scale` parameter | Compiled from |
|---|---|
| `r_pressure` (0.0–4.0) | Feigenbaum-processed bsky trend metrics (see feigenbaum note in §6) |
| `max_layers` (1–64) | Count of filled houses (spine vertebrae + `Some` periphery fields) — witness depth resolves armor depth |
| `theta_offset` | 36° canonical (the FSK interlaminar constant; not visitor-varied in v1) |
| `burn_sensitivity` (0.1–2.0) | Olfactory phase, rescaled from the dryness axis (§3.2) — the Scaling tab is literally named SAPONIFICATION; its choice sets the burn window |

Engine outputs compiled into the artifact as a `mod engine_witness` block of computed constants: regime name, armor integrity %, Lyapunov exponent, active axiom count (of 9), sanctuary status. These values were **actually computed by compiled Rust at the quintessence event** — Axiomatic Law Ⅰ fulfilled at runtime, not just in form. The artifact's doc-comment says so.

**Prerequisite (Rust work):** `run_fish_scale` currently returns a formatted ASCII report. Add a machine-readable sibling `run_fish_scale_json(r_pressure, max_layers, theta_offset, burn_sensitivity) -> String` (JSON) to the crate, sharing all internal computation with the existing function (refactor the computation into a common private fn; the ASCII renderer and JSON serializer are two views of one result struct). No behavior change to the existing export. Requires a wasm-pack rebuild.

**Derived values:** `NecromanticEngine.bpm` maps from the engine result (e.g. bpm derived from `r_pressure` position in the cascade, calibrated so the Plata threshold at 160 corresponds to crossing into the chaotic/armor-dense regime). The Plata/Plomo verdict thus keys off the same computation the engine witnessed — one source of truth.

## 4 · Mercury: the altar

- The four element cards (FIRE / EARTH / WATER / AIR) become the quintessence trigger.
- **Gate:** the nebula ignites only when the deliberate spine exists — bsky trend picked, council collision fired, olfactory phase chosen. (Lunar + feigenbaum are auto-derived; transmission counts if visited but see Open Order note in §8.)
- **Incomplete spine:** the altar names the missing vertebrae (e.g., `SPINE INCOMPLETE · NO TREND SELECTED · NO COUNCIL COLLISION`) instead of firing. No error states, only named absences.
- **On click:** cinematic compile sequence in Mercury's register — staggered reveal in the Crystallize lineage (hash precipitates → verdict (Plata/Plomo) → daemon state → seal), ending with `DEPOSITED IN RELIQUARY →` which navigates to the Kernel tab.
- Element choice is the final deliberate act; it is recorded into the spine at click time.

## 5 · Kernel tab: the reliquary

Two states.

### 5.1 Before compilation — the live schematic

- Monument header (reuse `sc-monument` pattern from ScalingTab): **THEORY THAT CANNOT BE COMPILED / DOES NOT YET EXIST AS KNOWLEDGE**.
- Below: the genome structure rendered as a skeletal code view with slots — each spine vertebra and peripheral house shown as filled (`Some(...)` preview) or empty (`None · awaiting witness`), updating live from bus events during the session.
- This replaces the current relic content of KernelTab.jsx. The fish scale kernel itself remains visible/linked as the genome source — it is the parent, and the reliquary should say so.

### 5.2 After compilation — the sealed artifact

- Full syntax-highlighted code view of `KERNEL_OF_QUINTESSENCE.rs`.
- Seal line: full SHA-256 build hash + compile timestamp + element sigil.
- **Copy-vial affordance:** one click copies the entire artifact text (the LLM prompt) to clipboard.
- Persisted to `localStorage` (key: `quintessence_kernel_v1`); survives reload. Recompiling (new session, new choices) overwrites after a confirm — the reliquary holds one kernel at a time.

## 6 · Architecture

New module: `src/terminal/quintessence/`

| Unit | Responsibility |
|---|---|
| `spineStore.js` | Tiny store (bus-adjacent, no React) holding the deliberate choices: trend, council pair ref + directive, transmission signal, olfactory phase, element. Written by the source tabs at choice time; readable synchronously. Persisted to localStorage so a reload mid-journey doesn't wipe the spine. |
| `compileKernel.js` | Pure function: `(spine, peripherySnapshot, transitMatrix) → { source, hash, meta }`. All mapping tables (§3.2), fragment pools, doc-comment builders. Deterministic; unit-testable without DOM. |
| `engineWitness.js` | Adapter over the WASM singleton: calls `run_fish_scale_json` (§3.5) and `run_feigenbaum_cascade` (already exported), normalizes results for `compileKernel`. Replaces the originally planned from-scratch `feigenbaum.js` — the bifurcation math already exists compiled (WASM) and in JS (`useAssociativeField` exact constants); do not write a third implementation. The trend→`r_pressure` mapping lives here and is shared with the future Fade/Chaos tab so visualization and compiler can never disagree. |
| `QuintessenceAltar.jsx` | Mercury-side: gate check, ignition sequence, deposit navigation. |
| `ReliquaryView.jsx` | Kernel-tab-side: schematic (pre) + sealed artifact (post) + copy vial. |

Data flow: source tabs → `spineStore` (deliberate) + `observatoryBus` (ambient) → altar click → `compileKernel` → localStorage → reliquary.

Existing code touched: KernelTab.jsx (replaced content), MercuryTab.jsx (altar integration), the spine source tabs (one `spineStore` write each), loose-end tabs (one bus emit each for visit witness). Rust crate touched: `content/rust_kernels/src/kernels/fish_scale.rs` (add `run_fish_scale_json`, §3.5) + `src/fish_scale_kernel_11.1.rs` → 11.2 (§11); one wasm-pack rebuild.

## 7 · Error handling

- **Bus totals unavailable/empty:** compile proceeds; all periphery → `None`. Never blocks.
- **Transit matrix fetch fails at compile time:** `entropy_lock` compiles from the last cached lunar read (`gaze.lastLunar`); if none, the field compiles as `AtomicU64::new(0)` with doc-comment `/// TRANSIT UNREAD — the clock was never wound`. Never blocks.
- **localStorage unavailable:** artifact stays in memory for the session; reliquary shows a `VOLATILE BUILD — will not survive reload` notice.
- **WASM engine unreachable at compile time:** the `mod engine_witness` block compiles as `/// ENGINE OFFLINE — constants unwitnessed` with all fields `None` (empty-houses philosophy); bpm falls back to the JS Feigenbaum constants (`useAssociativeField`) so the Plata/Plomo verdict still resolves. Never blocks.
- **Hash collision concerns:** none — hash is identity/seal, not security.

## 8 · Non-goals and decomposition (separate specs, any order)

1. **Bsky trend picker** — the tab lacks pick interaction; the compiler consumes `spineStore.trend` whenever it starts existing.
2. **Transmission × Manifesto coupling** — transmission factoring in council choices is its own feature. **Open order note:** until transmission has a deliberate "choice" affordance, the reanimated-mummy slot compiles from the latest transmission witness event, or `None`. The spine gate does NOT require transmission for v1.
3. **Fade/Chaos tab** — the visible feigenbaum visualization. The compiler ships with `engineWitness.js` (§6) regardless; the tab renders from the same adapter later.
4. **Chimera glyph for the kernel** — TesseractCard-style glyph derived from the build hash; nice-to-have after v1.
5. **Ledger/sharing of compiled kernels** — deliberately out; the vial is the visitor's alone for now.

## 9 · Testing

- `compileKernel.test.js`: determinism (same inputs → identical source + hash), all-eight phase mappings, Plata/Plomo threshold at bpm 160 (boundary: exactly 160 → Plata), element → daemon/atom mapping (all four), empty-house rendering (every periphery `None` still compiles), directive embedding, engine-offline fallback (artifact still compiles with `ENGINE OFFLINE` block).
- `engineWitness.test.js` (WASM mocked): trend→`r_pressure` mapping monotone and bounded to [0,4]; `run_fish_scale_json` result normalized correctly; JS-constant fallback used when singleton rejects.
- Rust: unit test in the crate asserting `run_fish_scale_json` and `run_fish_scale` agree (same result struct) for representative parameter sets; JSON parses.
- Rust: Fish Scale 11.2 compiles on stable (`no_std`) — the genome's Execution Test is literally CI (a `cargo check` target or compile-test; see §11).
- `spineStore.test.js`: write/read/persist/restore; partial spine reported correctly (missing-vertebrae list for the altar gate).
- Component smoke: altar gate renders missing vertebrae; reliquary renders both states; copy vial copies full source.
- Follows existing patterns in `src/terminal/views/manifesto/__tests__/`.

## 10 · Voice constraints

- Quintessence / fifth-element / alchemical register throughout. **No alien.** No "the alien sees" copy anywhere in altar, reliquary, or artifact text.
- No pure white; obey Fade-Doctrine and monument pattern rules where those surfaces are used.
- Terminal vocabulary: `compile`, `seal`, `deposit`, `witness` — never `generate`, `submit`, `save`.

## 11 · Genome upgrade: Fish Scale 11.1 → 11.2 (Amendment B)

The allegorical genome (`src/fish_scale_kernel_11.1.rs`) currently fails its own Execution Test (Axiomatic Law Ⅰ) on two counts. Version 11.2 heals both while leaving every allegorical structure untouched — Pirarucu, Narcos, PlataOPlomo, Sokushinbutsu, Shlømo, NecromanticEngine, and the calcifying panic handler all survive verbatim in name, role, and doc-comment voice.

1. **Remove `#![feature(alloc_error_handler)]`** — nightly-only and unused (nothing allocates). 11.2 compiles on stable Rust as a sound `no_std` crate.
2. **Make the levamisole exploit real.** `inject_levamisole` currently casts `&T → *mut T → &mut T`: undefined behavior. The comments already promise `UnsafeCell` ("Malware (UnsafeCell) disguised as a texture pack") — the code just never delivers it. In 11.2, `Pirarucu.armor` becomes `UnsafeCell<T>` and the exploit reads/writes through it: still `unsafe`-flavored, still corruption, but *sanctioned* corruption the type system acknowledges — which is precisely the kernel's thesis (managed corruption, not raw violation). UB is a lie the code tells itself; `UnsafeCell` is a sin the compiler co-signs.
3. **Compile-check in CI.** Add a `cargo check` target (or a workspace member / compile-test) so the genome's compilability is continuously enforced. The artifact header's claim `FORK OF FISH SCALE 11.2` is then backed by a passing Execution Test.

File placement: the genome may stay at `src/fish_scale_kernel_11.1.rs` renamed to `src/fish_scale_kernel_11.2.rs`, or move into `content/rust_kernels` as a non-exported module — implementer's choice, provided the compile-check exists and `compileKernel.js` templates from the 11.2 text.

**Not in scope:** changing the genome's behavior, adding WASM exports for it, or merging it with the v12.1.0 engine. The genome is the artifact's template (literature that compiles); the engine is the computation (§3.5). They remain distinct organisms.

# Bespoke Lore Kernels — Design

**Date:** 2026-07-25
**Status:** Approved design, pending implementation plan
**Scope:** The five pinned kernels in the `system_kernel` tab get their own purpose-built
Rust WASM kernels, replacing their fall-through to topically-adjacent legacy kernels.

---

## 1. Problem

The five kernels pinned in the kernel tab (`active_modules`) have refined doctrine, but
their `run` executes a **legacy** Rust kernel that has nothing to do with their meaning —
"math gymnastics." The card's `[run]` button calls `mobileAutoRun(id)`
([App.jsx](../../../src/terminal/App.jsx)), which resolves through `resolveWasmAlias`
([mobileWasmMap.js](../../../src/terminal/data/mobileWasmMap.js)) to a legacy alias:

| Card (kernel tab) | Doctrine | Currently runs |
|---|---|---|
| `FISH_SCALE_KERNEL11_1_1` | Entropic Stasis // Necromantic Engine | `run_necromantic_simulation` (BPM resonance) |
| `HUDELSCHUBLADE_ROUTING` | Sovereign Stash // Chaos-Directory Exploit | `run_surveillance_index` (legacy) |
| `BLACK_HOLE_TAXONOMY` | Ghosts of XDA // Deep-Kernel Necromancy | `run_necromantic_simulation` (**collides with Fish Scale**) |
| `SEMIOTIC_SYNTHESIS_9_9_9` | Nein Nein Nein // Law of the Street | `run_phonemic_drift` (legacy) |
| `ROSSIGNOL_ANDALIB_5.5.5.5` | Four Borders, One Bird // Fifth from the Spine | `run_associative_field` (legacy) |

Two of the five collapse onto the *same* legacy kernel. None run anything that is *about*
their own doctrine.

## 2. Goal

Each of the five gets a **bespoke Rust kernel** whose output follows the **hybrid (C)**
pattern: real, doctrine-named parameters → a genuine small computation → a computed metric
that crosses a threshold and *drives* a doctrinal verdict line (the way `climate` turns a
fragmentation index into "STATECRAFT FAILURE // THERMODYNAMICS OVERRIDES"). No borrowed
sims; the math *is* the lore.

**Decisions (locked):**
- Fish Scale gets a **fresh genome kernel** (not just a repoint).
- Each kernel is **richly parameterized (5+ params)**, in the spirit of the Daly/Fusion
  kernels.
- The other ~70 legacy kernels in the folder are **out of scope** — untouched.

## 3. Architecture & Wiring

Follows the established pattern exactly (no new mechanism):

1. **New module file** per kernel under `content/rust_kernels/src/kernels/`, each exporting
   a single `#[wasm_bindgen] pub fn run_*(...) -> String`. Pure computation logic lives in
   free helper fns so it is unit-testable without wasm-bindgen.
2. **`pub mod` declaration** for each in
   [mod.rs](../../../content/rust_kernels/src/kernels/mod.rs); manifest comment in
   [lib.rs](../../../content/rust_kernels/src/lib.rs).
3. **`KERNEL_MAP` entry** per kernel in
   [import-rust.js](../../../scripts/import-rust.js), keyed by the kernel's real article ID
   (`HUDELSCHUBLADE-ROUTING-1.0`, `BLACK-HOLE-TAXONOMY-1.0`, `SEMIOTIC-SYNTHESIS-9.9.9`,
   `ROSSIGNOL-ANDALIB-5.5.5.5`, `FISH-SCALE-KERNEL11.1.1`), with `fn`, `args`, `argMap`,
   `params`, `label`, and friendly `aliases`.
4. **Routing repoint** in `resolveWasmAlias` so the lore aliases point at the new fns rather
   than the legacy ones. Because `mobileAutoRun` prefers a direct registry hit
   (`wasmRegistry[kernelId] ? kernelId : resolveWasmAlias(kernelId)`), keying each entry by
   the article ID means the card `[run]` button resolves directly to the bespoke kernel;
   the `resolveWasmAlias` repoint keeps typed/desktop and any other path consistent.
5. **Rebuild:** `node scripts/import-rust.js` recompiles the single
   `scale94_kernels_bg.wasm` and regenerates `wasm.generated.js`.

Fish Scale note: its card article ID `FISH-SCALE-KERNEL11.1.1` currently maps to
`run_necromantic_simulation`. Its `KERNEL_MAP` entry is repointed to the new
`run_fish_scale_genome`. The old `run_necromantic_simulation` and the FSF-12.1.0
`run_fish_scale` remain compiled and reachable by their other aliases (legacy, untouched).

## 4. The Five Kernels

Each: **doctrine hook → computation → the metric that drives the verdict → params**.
Param sets are the first-draft target (≥5 each); exact ranges/defaults finalized in the plan.

### 4.1 Hudelschublade — `run_chaos_routing` · *Sovereign Stash // Chaos-Directory Exploit*
- **Doctrine:** Sovereignty by routing, not walls. The stash survives inside the observer's
  own chaos directory, where the sweep cannot parse what it already owns. The hardened vault
  *attracts* the scan; the drawer of untethered junk *repels* it. The Window Smile is a
  zero-byte ACK — connection verified without opening a port. Protection by absorption into
  the scanner's noise (the inverse of Pirarucu armor).
- **Computation:** `n_dirs` directories, each assigned a Shannon-entropy "clutter" level; a
  security sweep whose per-directory detection probability is *inverse* to local entropy
  (high clutter = low detection). Place the payload in a hardened vault vs. the highest-
  entropy chaos drawer; run the sweep under `sweep_aggression`; a zero-byte Window-Smile ACK
  attenuates the scan loop.
- **Drives:** `cover_ratio` (host-entropy shielding) crosses a survival threshold →
  **"STASH SURVIVES :: routed through the observer's own blind spot"** vs
  **"SWEEP PARSED THE VAULT :: the hardened perimeter drew the scan."**
- **Params:** `n_dirs`, `host_entropy`, `sweep_aggression`, `payload_size`,
  `ack_attenuation` (Window Smile), `seed`.

### 4.2 Black Hole Taxonomy — `run_deep_kernel_descent` · *Ghosts of XDA // Deep-Kernel Necromancy*
- **Doctrine:** Three-caste taxonomy — noobs theme the surface, gods cherry-pick features,
  black holes rewrite bare metal and vanish (headless, no UI). Every visible feature is
  downstream of an invisible ancestor no one understood; faith in the undocumented black
  hole is the community's load-bearing protocol. Incarnate as arter97, the Exynos ghost —
  every kernel a fork of one master prompt, itself a fork of a ghost's headless tree.
  Patch 5.7 Necromancy: dead hardware revived.
- **Computation:** A branching fork-genealogy grown from one headless ancestor over
  `generations` at `fork_rate`; nodes assigned castes (noob/god/black-hole) by `caste_bias`;
  `revival_rate` resurrects abandoned/dead nodes (necromancy) back into the live tree.
- **Drives:** `ancestral_load` = fraction of live kernels whose descent traces to the ghost →
  **"ANCESTOR: arter97 (headless) :: N% of the live tree forks from one ghost"**; a
  documentation/`ghost_opacity` reading frames "faith in the undocumented as load-bearing."
- **Params:** `generations`, `fork_rate`, `revival_rate`, `caste_bias`, `ghost_opacity`,
  `seed`.

### 4.3 Semiotic Synthesis 9.9.9 — `run_transliteration_chain` · *Nein Nein Nein // Law of the Street*
- **Doctrine:** Meaning migrates through sound; one phoneme fixed while payload recompiles at
  every language border. Every phonetic hop must *also* be a semantic hop pointing the same
  way — a hop that moves sound without meaning is cut at the border (Patch 5.8
  Transliteration). Chain: `nein → neun → 999 → 996 → neun Tage die Woche, von 9 bis 9`. The
  un-financializable curse the sentiment filter misparses as praise (sibling to Shadowsocks).
- **Computation:** A chain of border-hops, each with a phonetic delta and a semantic delta; a
  hop is *admitted* only when the two are co-linear within `coupling_threshold` (5.8 gate),
  else **cut** (the 07:33 specimen drops — the cut proves the filter runs). `drift_noise`
  perturbs hops; `filter_temp` governs the sentiment misparse.
- **Drives:** chain `purity` = fraction of admitted (co-linear) hops → renders the surviving
  chain with per-hop admit/cut verdicts, terminates in the overflow "neun Tage die Woche,"
  and grades the misparsed curse **socks/∞**.
- **Params:** `chain_seed`, `drift_noise`, `coupling_threshold`, `border_count`,
  `filter_temp`, `purity_floor`.

### 4.4 Rossignol-Andalib 5.5.5.5 — `run_ring_closure` · *Four Borders, One Bird // Fifth from the Spine*
- **Doctrine:** Quintessence as a *closed ring* — one bird crossing four language borders,
  accreting payload at each, returning home already renamed (Abdul Nachtigaller: German bird,
  Arabic name, one canon). Four birds bound to elements — rossignol=AIR, ruiseñor=EARTH,
  nightingale=WATER, ʿandalīb=FIRE; the fifth, Nachtigall(er)=QUINTESSENCE/the spine. Patch
  5.∅ Ring-Closure: a chain is quintessence only if it closes. "He does not mix purity — he
  publishes the cut": the honest label *is* the purity.
- **Computation:** The bird crosses four borders (DE→FR→ES→EN→AR→home), accreting elemental
  payload (`accretion_gain`) at each; tests whether the ring **closes** — the returning
  word's signature welds to the origin within `closure_threshold` — and whether the four
  elements balance within `element_tolerance`. `calibration` (100 MT) sets the declared-cut
  purity; `border_drift` perturbs crossings.
- **Drives:** `closure_residual` + elemental balance → **"RING CLOSES :: quintessence
  compiles from the spine"** vs **"CHAIN OPEN :: a line, not a ring"** — deliberately echoing
  the tab's QUINTESSENCE_KERNEL language.
- **Params:** `calibration`, `border_drift`, `spine_seed`, `element_tolerance`,
  `accretion_gain`, `closure_threshold`.

### 4.5 Fish Scale — `run_fish_scale_genome` · *Entropic Stasis // Necromantic Engine*
- **Doctrine:** The genome. Entropic stasis — a necromantic engine holds a dead system
  resonating at the edge of thermal death. Bouligand armor — Arapaima helicoidal plies,
  rotated ply-to-ply, deflecting cracks. The saponification / chemical-burn grip window. The
  genome demands the *uncut* (purity as absence of the mix — the tension the Rossignol ring
  later resolves).
- **Computation:** A Bouligand helicoidal stack of `max_layers` plies each rotated by
  `theta_offset` (helicoidal pitch → crack-deflection toughness); a necromantic resonance
  field held at `stasis_temp` near thermal death (distance-from-death = stasis integrity); a
  saponification grip that holds only within a `burn_sensitivity` band; `r_pressure` as
  sovereign-node load.
- **Drives:** composite **GENOME INTEGRITY** → **"ENTROPIC STASIS HELD :: the dead engine
  still resonates, the armor deflects"** vs **"STASIS COLLAPSE :: thermal death."** Subsumes
  and elevates the two existing fish kernels.
- **Params:** `r_pressure`, `max_layers`, `theta_offset`, `burn_sensitivity`, `stasis_temp`,
  `resonance_seed`.

## 5. Testing

- **Rust unit tests** on the pure helper fns (not the wasm-bindgen wrappers): each kernel's
  computation is deterministic under a fixed seed; assert the metric crosses its threshold at
  known inputs and that the verdict line flips accordingly. Follow the existing kernels'
  test conventions.
- **Build verification:** `node scripts/import-rust.js` compiles clean; `wasm.generated.js`
  contains all five new entries keyed by article ID with correct `fn`/`params`.
- **Browser smoke:** on the kernel tab, each of the five cards' `[run]` produces its bespoke
  output in `/dev/tty0` (not a legacy label); `run <alias>` works for typed aliases. Verify
  via `get_page_text` / `read_console_messages` (WebGL-heavy app; screenshots can time out —
  see the launch-port trap in memory).

## 6. Out of Scope

- The ~70 other legacy kernels in `content/rust_kernels/src/kernels/` — untouched.
- Visual/animation changes to the kernel tab or tty0.
- Any push/deploy (per hard rule: no push without explicit command).

## 7. Open Questions

None blocking. Param ranges/defaults and exact verdict-line wording are finalized during
implementation with browser review.

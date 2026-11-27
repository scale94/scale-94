# Scent as Aether — P3 (The Altar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Kernel of Quintessence compile the only thing that opens the sealed accord, and turn what it opens into a weighable formula on the compiled artifact.
- `ignite()` unseals `spine.scent` before compiling; every non-`ok` state is named and the altar cools.
- `modulators.js` reads the altar element, `/LUNAR`, `/SOL` and `/CHAOS` into the engine's inputs, with one named log line per source.
- `compileKernel` receives the opened accord as an argument and runs the formula engine inside the pure compile path. The artifact gains `formula`.
- The reveal (spec §8, C over B): poetry condenses into material rows, each resolving out of its own slice of the real ciphertext.
- The reliquary shows the formula; artifacts from before the feature read `// sealed before the aether`.

**Architecture:**
- Pure modules (no React, DOM, GL, WASM or WebCrypto): `scent/modulators.js`, `scent/accordFormula.js`, `mercury/revealSchedule.js`. Thin bridge: `lib/openAccordForAltar.js` (WASM + WebCrypto + vault through injected deps, never throws). Thin hosts: `QuintessenceAltar.jsx`, `mercury/AccordReveal.jsx`, `ReliquaryView.jsx`.
- `compileKernel` stays pure and deterministic. The opened accord enters through `opts.accord`; it is **not** a hash input (spec §5.3: the hash covers the spine, which carries the envelope, not the plaintext).
- Nothing is signed in P3. P4 adds ML-DSA signing at ignite (the `SIGNED` stage), `dossierPayload`, the dossier and the verifier.

**Tech Stack:** React 18 + Vite; Vitest (jsdom, fake timers); ESLint. Real WASM in Node via `tests/helpers/loadWasmNode.js` (P2).

**Spec:** `docs/superpowers/specs/2026-11-27-scent-aether-design.md` (P3 = §12 fourth bullet; §3 decisions 14, 17, 18; §5.3; §5.4; §6.3, §6.6–6.9; §7.2–7.3; §8; §10; §13).

**Builds on:** the P2 ledger `.superpowers/sdd/2026-11-27-scent-aether-p2/progress.md` (rulings 6/T4/T5/T6 especially: boot-time orphaning, `isScentMarked`, unseal's fp-first ordering).

## Global Constraints

- Spec §2: *Real cryptography only. Every label in every artifact names the primitive that actually ran.* Byte counts on screen come from `envelopeSizes()` of the envelope that was opened, never constants.
- Spec decision 13: *anything that reads like a lab measurement is either calculated from cited data or cut; conceptual maths never uses physical units.* Every gram, %, CAS and IFRA figure on screen is read from the computed `formula` object; the reveal renders, it never computes or invents.
- `unsealAccord()` never throws through to the UI. The altar handles `'ok'`, `'orphaned'`, `'tampered'`, `'malformed'`, `'no-webcrypto'` (and the bridge's own `'wasm-unavailable'`) by name.
- **Only an envelope that opens compiles a formula.** No path fills `formula` from the card, the manifest or a fixture.
- Opened vial (decision 17): the decrypted formula is stored in plain text on `quintessence_kernel_v1` and never re-sealed. The **chaos salt is not stored**; it is zeroed once the formula is computed.
- The compile hash input is unchanged: `{ spine, periphery, engine, compiledAt }`. An accord never changes the hash.
- A compile without an accord (tests, pre-feature callers) produces **byte-identical** `source` and `meta` to today.
- Layer colours, exact: top `#6cc6d4`, heart `#d98a46`, base `#c8a556`. Gold `#fcd34d` only on `◈ BUILD` and `FORMULA` lines. No white at rest anywhere.
- Flash: ~80 ms, white, on the resolving characters only, snapping to the resting colour. Never more than 3 flash onsets in any 1 s window (WCAG 2.3.1). `prefers-reduced-motion` → instant, no flash.
- Engine log copy already pinned by P1 (`/SOL unwitnessed — the sun left the top notes alone`, `/CHAOS periphery unwitnessed — default reach`) stays exact when a reading is absent.
- New pure modules contain no React, DOM, GL, WASM or WebCrypto; bridges contain no React.
- Lint gate: `npm run lint` (`--max-warnings 143`) passes.
- Snapshots: never `vitest -u` except where a task names the file and the allowed-change list. The report includes the full `.snap` diff.
- Branch `feature/scent-aether-p3`, cut from `feature/scent-aether-p2` at `a91399dd`. Commit per task. **Never push.** The author pushes.
- Leave `.import-cache.json`, `baseline/` and `docs/superpowers/research/` untracked.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Rulings in this plan (for the author's review before execution)

1. **Unseal first, then the stages.** `ignite()` opens the envelope right after the overwrite confirm and before stage 0, so a failure costs nothing and never shows a stage that didn't happen. The reveal's `ACCORD UNSEALED` line is shown after `SEALED`, as spec §8 orders it; by then it is a true past-tense statement.
2. **Non-`ok` states at the altar** (one `role="status"` line, then the altar cools; no compile, no `kernel_sealed`):
   - `orphaned` → `reconcileScent(currentFp|null)`; the mark falls; line `SEAL ORPHANED — the key evaporated` (P2's exact copy).
   - `tampered` / `malformed` → new `markScentBroken()` in `spineStore`: the mark falls and `missingVertebrae()` reads `SEAL BROKEN — the accord would not open`. The visitor re-crystallizes. Without it the altar would stay armed on an accord that can never open.
   - `no-webcrypto` / `wasm-unavailable` → `THE ACCORD CANNOT OPEN ON THIS ORIGIN — no WebCrypto` or `… — the kernel did not load`; spine untouched (the key may be fine). Spec §6.6: never brick, cool down.
3. **Modulator mappings** (spec §13 leaves them to the builder; each is linear, clamped, documented in `modulators.js` and pinned by tests):
   - **/LUNAR → rest weeks:** `restWeeks = 2 + round(6 × (dryness − 12) / (96 − 12))`, using the existing `drynessFor(spine.phase)` (12 DARK INCUBATION → 2 weeks … 96 MINERAL STILLNESS → 8 weeks). Log names the phase: `/LUNAR SMOKE DISSOLUTION → 7 weeks in the dark`.
   - **/SOL → tilt:** position of the most recent release on the store's own log-energy scale, `t = (log10 E − 29) / (log10 5e32 − 29)`, `solTilt = 2t − 1` (positive = toward top). A feeble release sinks weight to the base; a large one lifts the top. `{ visits }` only (nothing left the star) and `null` → no tilt, named: the P1 line for null; `/SOL entered — nothing left the star, the top notes left alone` for visits-only.
   - **/CHAOS periphery → reach:** from the sphere's Lyapunov exponent λ: `reach = 0.05 + 0.25 × clamp(λ / ln 2, 0, 1)` (ordered sphere barely drifts, fully chaotic logistic map reaches 0.30). λ absent but `lastR` present → `clamp((r − 3) / 1, 0, 1)` in place of the λ term. Visits-only or null → default reach, P1 line.
4. **The engine's log names the reading.** `computeFormula` accepts optional `modulators.labels = { lunar, sol, chaos }` and, when present, uses them verbatim for those three lines. Absent labels keep every P1 string exactly (P1 tests untouched). This keeps "one line per source" in the engine instead of a second log in the altar.
5. **Both batches compile.** `formula = { batches: { small, large }, … }`, both computed from the one opened accord at ignite. The salt is not stored (Global Constraints), so a batch chosen later couldn't be recomputed; computing both costs one more pure call. The reveal shows `small` (7.00 g / 10 ml, decision 11); the reliquary toggles.
6. **`formula` shape on the artifact:** `{ v:1, state:'ok', batches:{small,large}, notes, envelope:{ kem, kdf, aead, ctBytes, aeadBytes, fp }, sources }`, where `notes` is `baseAccord.notes` (every note → material mapping, spec §6.9) and `sources` is the modulator readings that ran. A batch the engine cannot satisfy stores `{ state:'infeasible', reason }` for that batch (from `FormulaInfeasible.message`); the compile still seals and the reliquary names it. A formula is never faked to fill the slot.
7. **The kernel source gains one block, only when an accord opened:** `/// **THE FIFTH** — the sealed accord, opened once at this compile.` followed by `mod sealed_accord { … }` listing the small batch's rows as `Row { name, cas, layer, stock, grams }` consts, the strength and rest window. No accord → no block, and `source` is byte-identical to today (pinned).
8. **The reveal's bytes are `aead_ct`**, the AES-256-GCM ciphertext that literally held the accord. Row *i* of *n* resolves out of hex of bytes `[⌊i·L/n⌋, ⌊(i+1)·L/n⌋)` of `aead_ct` (length L). The header line also names the ML-KEM ct by its decoded size: `ENVELOPE · ML-KEM-768 CT (1088 B) · AES-256-GCM · {aeadBytes} B`.
9. **Flash pacing:** a row sweeps left → right in its resting layer colour; when its grams land, the last ≤4 resolving characters flash white for 80 ms and snap. One flash onset per row, rows ≥ 350 ms apart (≤ 2.86 onsets/s). Notes take 250 ms each, modulator lines 300 ms each. A material that appears under two notes condenses under the first and is shown as `↳ {name} (above)` under the later ones. A held pointer (≥ 400 ms) or `Esc` anywhere on the reveal skips to the end. Typical accords (8–14 rows) add ~3.5–5.5 s; the schedule caps the added time at 6 s by tightening note/modulator pacing, never row spacing.
10. **`notifyAltarStage` stays 0–5.** The eye does not react to the reveal stages; extending its stage vocabulary is a separate eye change.
11. **No `SIGNED` stage in P3.** Spec §8 lists it, but nothing signs until P4, and a stage line is a claim. P3's additions are `ACCORD UNSEALED` and `FORMULA MODULATED`.
12. **`dossierPayload` is P4.** Spec §5.3 lists it on the artifact; P3 stores only `formula`, which P4's payload will be built from.

## Review Focus

1. **The hash is accord-blind.** Same spine/periphery/engine/compiledAt with and without `opts.accord` → identical `hash` and identical `meta`. Pinned in Task 2.
2. **No accord → byte-identical source.** A fixture compile's `source` SHA-256 is captured **before** Task 2's edit and asserted after. Pinned in Task 2.
3. **A tampered or swapped envelope at ignite** never compiles, never fills `formula`, and leaves the altar re-armable only after a new crystallize. Pinned in Task 3 (real WASM: flip a byte of `aead_ct` in `spine.scent.envelope`, then ignite).
4. **Every number the reveal and reliquary print is in `formula`.** A render test walks every rendered digit run in the reveal/reliquary formula section and finds it in the serialized `formula` (or `envelope` sizes). Pinned in Tasks 5 and 6.
5. **Flash limit.** For every fixture accord (and a 30-row stress accord) the schedule has no 1 s window with more than 3 flash onsets; reduced motion has zero. Pinned in Task 4.
6. **The salt dies.** After ignite the stored artifact JSON contains no base64 of the salt, and the salt buffer reads all zero. Pinned in Task 3.

---

### Task 1: `modulators.js` and named engine lines

**Files:**
- Create: `src/terminal/scent/modulators.js`
- Modify: `src/terminal/scent/formulaEngine.js` (optional `modulators.labels`, ruling 4)
- Test: `src/terminal/scent/__tests__/modulators.test.js`; extend `formulaModulators.test.js`

**Interfaces:**
- Consumes: `drynessFor` (`data/lunarAccords.js`), `E_MIN_ERG`/`E_MAX_ERG` (`sol/solPhysics.js`), `CHAOS_REACH_RANGE` (formula engine).
- Produces: `readModulators({ element, phase, periphery }) → { element, restWeeks, solTilt: number|null, chaosReach: number|null, labels: { lunar, sol, chaos }, sources: { lunar:{phase,dryness}, sol:{lastReleaseErg}|{visits}|null, chaos:{lyapunov}|{lastR}|{visits}|null } }`. Throws `RangeError` on a missing element or phase (both are gated at the altar; a throw here is a bug, not a state).

- [ ] **Step 1: Write the failing tests:** the eight phases map to rest weeks 2…8 by ruling 3 (table test, both ends exact); unknown phase uses `drynessFor`'s 50 → 5 weeks; sol at `E_MIN_ERG` → −1, `E_MAX_ERG` → +1, `sqrt` of the two (log midpoint) → 0; visits-only and null sol → `solTilt: null` with the two named lines; λ ≤ 0 → 0.05, λ = ln 2 → 0.30, λ absent + r = 3.5 → 0.175; chaos visits-only/null → `null`; every output reach lies in `CHAOS_REACH_RANGE`; `computeFormula` with `labels` uses them verbatim; without `labels`, every P1 log string is unchanged (re-run the P1 table).
- [ ] **Step 2: Run** `npx vitest run src/terminal/scent`. Expected: new tests fail.
- [ ] **Step 3: Implement.** Labels are built from the same numbers that become modulators (one source of truth).
- [ ] **Step 4: Run** `npx vitest run src/terminal/scent`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(scent): modulators — /LUNAR rest window, /SOL tilt, /CHAOS reach, each named in the formula log`

### Task 2: The formula enters the compile

**Files:**
- Create: `src/terminal/scent/accordFormula.js` (pure: `(opened, spine, periphery, envelopeMeta) → formula`, ruling 6)
- Modify: `src/terminal/quintessence/compileKernel.js` (`opts.accord`; `artifact.formula`; ruling 7 block)
- Test: `src/terminal/scent/__tests__/accordFormula.test.js`; extend `src/terminal/quintessence/__tests__/compileKernel.test.js`

**Interfaces:**
- Consumes: `readModulators` (Task 1), `computeFormula`, `BATCHES`, `MATERIALS`.
- Produces:
  - `buildAccordFormula({ baseAccord, salt }, { element, phase, periphery }, envelopeMeta) → Formula` (ruling 6). Never throws for an infeasible batch (stores `{state:'infeasible', reason}`); still throws on programmer errors (bad salt length).
  - `compileKernel(spine, periphery, engine, { compiledAt, accord })` where `accord = { baseAccord, salt, envelopeMeta }`. Returns `{ source, hash, meta, formula? }`; `formula` absent when `accord` is absent.

- [ ] **Step 0: Pin the present.** Before editing, add a test that compiles the existing fixture and asserts the SHA-256 of `source` and the JSON of `meta` against literals captured now (Review Focus 2). Run it green on the unmodified code and commit nothing yet.
- [ ] **Step 1: Write the failing tests:** accord present → `formula.batches.small` and `.large` both satisfy every P1 invariant (bands, strength ±0.5 pt, IFRA, ≥ 0.05 g, top-up ≥ 0); `formula.notes` deep-equals `baseAccord.notes`; same inputs → same formula (deterministic); hash and meta identical with and without accord (Review Focus 1); the `THE FIFTH` block lists exactly the small batch's rows, grams to 2 dp; no accord → source hash literal unchanged; an accord the engine can't satisfy → that batch `{state:'infeasible'}` and the compile still returns; the serialized artifact contains no base64 of the salt.
- [ ] **Step 2: Run** `npx vitest run src/terminal/scent src/terminal/quintessence`. Expected: new tests fail, Step 0's test passes.
- [ ] **Step 3: Implement.** The formula is computed after the hash; the source block is appended after the witness/linker blocks and before the panic handler.
- [ ] **Step 4: Run** the same. Expected: PASS.
- [ ] **Step 5: Commit** `feat(quintessence): the opened accord compiles into a two-batch formula on the artifact; hash stays accord-blind`

### Task 3: Unseal at ignite

**Files:**
- Create: `src/terminal/lib/openAccordForAltar.js` (bridge, never throws)
- Modify: `src/terminal/quintessence/spineStore.js` (`markScentBroken`, `SCENT_BROKEN` line; `setScent` clears `broken`)
- Modify: `src/terminal/quintessence/vertebrae.js` (`isScentMarked` also false when `broken`)
- Modify: `src/terminal/mercury/QuintessenceAltar.jsx` (ruling 1/2 flow; `opts.accord` into `compileKernel`; zero the salt)
- Test: `src/terminal/lib/__tests__/openAccordForAltar.test.js` (real WASM + Node WebCrypto + in-memory vault, as P2), extend `spineStore.test.js`, `vertebrae.test.js`, `src/terminal/mercury/__tests__/quintessenceAltar.test.jsx`

**Interfaces:**
- Consumes: `unsealAccord`, `envelopeSizes` (P2), `getVault`/`aetherDeps` (P2), `reconcileScent`.
- Produces:
  - `openAccordForAltar(spine, { loadWasm, getVault, subtle }) → Promise<{ state:'ok', baseAccord, salt, envelopeMeta } | { state:'orphaned'|'tampered'|'malformed'|'no-webcrypto'|'wasm-unavailable', line }>`, where `line` is the ruling 2 copy. Applies the spine side-effects of ruling 2 itself (`reconcileScent` / `markScentBroken`).
  - `SCENT_BROKEN = 'SEAL BROKEN — the accord would not open'`; `markScentBroken()`; `missingVertebrae()` fourth entry precedence: absent → orphaned → broken.

- [ ] **Step 1: Write the failing tests:** a real seal (P2 `sealAccordForSpine`) then `openAccordForAltar` → `ok` with the sealed base accord; one byte of `aead_ct` flipped → `tampered`, mark falls, `missingVertebrae()` ends with `SEAL BROKEN…` (Review Focus 3); vault rotated → `orphaned`, P2 line; `subtle` undefined → `no-webcrypto`, spine untouched; `loadWasm` rejects → `wasm-unavailable`, spine untouched; resolves (never rejects) on every case; recrystallize after broken clears it. Altar (jsdom, stubbed bridge): non-ok → the status line renders, no stage line renders, `compileKernel` is not called, `kernel_ignite_ended {sealed:false}` fires; ok → `compileKernel` receives `opts.accord`; after ignite the salt buffer is all zero and `localStorage[quintessence_kernel_v1]` has `formula` and no salt (Review Focus 6).
- [ ] **Step 2: Run** `npx vitest run src/terminal/lib src/terminal/quintessence src/terminal/mercury`. Expected: new tests fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`. Expected: PASS, no snapshot written.
- [ ] **Step 5: Commit** `feat(altar): ignite opens the sealed accord first; orphaned, broken and insecure seals are named and the altar cools`

### Task 4: `revealSchedule.js`

**Files:**
- Create: `src/terminal/mercury/revealSchedule.js` (pure)
- Test: `src/terminal/mercury/__tests__/revealSchedule.test.js`

**Interfaces:**
- Consumes: `formula` (Task 2), the envelope's `aead_ct` bytes (decoded by the host).
- Produces: `buildReveal({ formula, aeadBytes, reducedMotion }) → { header, steps: Step[], totalMs }` where `Step = { at, kind:'header'|'note'|'row'|'ref'|'mod'|'stage', text, layer?, bytesHex?, sweepMs?, flashAt? }` and `frameAt(reveal, t) → per-step { shown, resolvedChars, flashing }` (pure, so the component only renders). Ruling 8 slices, ruling 9 pacing.

- [ ] **Step 1: Write the failing tests:** each row's `bytesHex` is the hex of exactly its ruling 8 slice of the given bytes (and slices tile `aead_ct` with no gap or overlap); `frameAt` at t → resolved characters are a left prefix, the rest is that row's hex; flash windows are 80 ms; no 1 s window has > 3 onsets, for every fixture accord and a 30-row stress accord (Review Focus 5); `totalMs` adds ≤ 6 s; `reducedMotion` → `totalMs 0`, zero flashes, everything resolved at t=0; a material under two notes yields one `row` and one `ref`; the header's byte numbers equal the inputs.
- [ ] **Step 2: Run** the file. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it. Expected: PASS.
- [ ] **Step 5: Commit** `feat(altar): reveal schedule — rows resolve from their own slice of the ciphertext, ≤3 flashes per second`

### Task 5: `AccordReveal.jsx` at the altar

**Files:**
- Create: `src/terminal/mercury/AccordReveal.jsx`
- Modify: `src/terminal/mercury/QuintessenceAltar.jsx` (stage 6 shows the reveal before `◈ BUILD`; stage list gains `ACCORD UNSEALED`, `FORMULA MODULATED`)
- Test: `src/terminal/mercury/__tests__/accordReveal.test.jsx`; extend `quintessenceAltar.test.jsx` and `src/terminal/collider/__tests__/honesty.test.js` (or a new `altarHonesty.test.js`)

**Interfaces:**
- Consumes: `buildReveal`/`frameAt` (Task 4), `formula` (Task 2), `matchMedia('(prefers-reduced-motion: reduce)')`.
- Produces: `<AccordReveal formula aeadBytes onDone />`, rAF-driven, `aria-live="polite"` announcing each note and the final line only (not every character).

- [ ] **Step 1: Write the failing tests** (fake timers + a stubbed rAF): the header text equals `ENVELOPE · ML-KEM-768 CT ({ctBytes} B) · AES-256-GCM · {aeadBytes} B` from the formula's `envelope`; each row renders `name … grams` with a flexing dotted leader, grams `white-space: nowrap`, name truncates (`min-width:0`/`text-overflow:ellipsis`), CAS + stock on the second line; computed colours per layer are the exact hexes; no element has a resting colour of `#fff`/`white`/`rgb(255, 255, 255)` once `onDone` has fired; gold appears only on `◈ BUILD` and `FORMULA` lines; reduced motion renders the end state immediately; a 400 ms hold or `Esc` skips to the end; every digit run in the rendered formula is found in the serialized formula (Review Focus 4); an artifact without `formula` (engine-only compile) goes straight to `◈ BUILD` as today.
- [ ] **Step 2: Run** `npx vitest run src/terminal/mercury`. Expected: FAIL.
- [ ] **Step 3: Implement.** Resting text is never white; white exists only inside a flash window.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(altar): the reveal — poetry condenses into chemistry over the real ciphertext bytes`

### Task 6: The reliquary shows the formula

**Files:**
- Modify: `src/terminal/quintessence/ReliquaryView.jsx` (formula bench view above the source)
- Create (if the component grows past ~120 lines): `src/terminal/quintessence/FormulaBench.jsx`
- Test: extend `src/terminal/quintessence/__tests__/reliquaryView.test.jsx`

**Interfaces:**
- Consumes: `loadSealedArtifact()`; `artifact.formula` (Task 2).
- Produces: the post-compile reliquary renders, in order: `FORMULA · {type} · {actualPct} % concentrate` (gold), a batch toggle `7.00 g / 10 ml` · `10.00 g / 15 ml`, rows grouped by layer (same narrow layout as Task 5), `ethanol top-up {alcoholGrams} g`, the weighed layer split, the IFRA results, every note → material mapping, the modulation log, and the envelope line. `// sealed before the aether` when `formula` is absent; `FORMULA INFEASIBLE AT {batch} — {reason}` for an infeasible batch.

- [ ] **Step 1: Write the failing tests:** artifact with formula → rows, top-up and split render from `batches.small`; the toggle switches to `large` and every gram changes to the large batch's values; legacy artifact (no `formula`) → `// sealed before the aether` and the source view unchanged; infeasible batch → the named line and no rows for it; every rendered digit run is in the formula (Review Focus 4); no resting white; the schematic's `sealed_accord` slot is unchanged.
- [ ] **Step 2: Run** `npx vitest run src/terminal/quintessence`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(reliquary): the opened vial — bench formula, batch toggle, note mappings, modulation log`

### Task 7: Docs and the milestone gate

**Files:**
- Modify: `CHANGELOG.md` (one P3 entry)
- Append: `.superpowers/sdd/2026-11-27-scent-aether-p3/progress.md` (ledger, P4 handover)

- [ ] **Step 1: Gate:** `cargo test` (in `content/rust_kernels`), `npx vitest run`, `npm run lint`, `npm run build`. Expected: all pass. Report test counts and the lint warning count.
- [ ] **Step 2: Browser check** (preview server; real WASM, WebCrypto, IndexedDB): crystallize at `/SCENT` → arm all four marks → hold an element → the reveal runs (header bytes match the envelope; rows resolve; ≤3 flashes/s by eye and by a `performance.now()` log of flash onsets) → `◈ BUILD` → reliquary shows the formula, toggle works; reduced motion (emulated) snaps; flip one char of `spine.scent.envelope.aead_ct` in localStorage, reload, ignite → `SEAL BROKEN…`, altar cools; clear IndexedDB, reload → orphaned line; a stored pre-feature artifact → `// sealed before the aether`. Phone-width screenshot of the reveal end state (narrow layout). Unregister the dev service worker first (P2 Task 8 trap).
- [ ] **Step 3: Write the docs.**
- [ ] **Step 4: Commit** `docs(scent): P3 changelog — the altar opens the accord`

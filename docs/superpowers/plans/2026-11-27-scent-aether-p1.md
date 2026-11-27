# Scent as Aether — P1 (Honest Chemistry) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure fragrance-formula layer and make `/SCENT` honest. That means:
- a cited kit table
- note → material interpretation
- a base-accord builder
- a formula engine whose every invariant is tested
- every physical-sounding number on the card and in the manifest either computed from cited data or cut

**Architecture:**
- New pure modules go in `src/terminal/scent/` (no React, DOM, GL, WASM or WebCrypto).
- The engine is developed against a **fixture kit** in tests. The real kit table lands last (Task 6), and only after the author signs off on the research track's table.
- The honesty sweep edits `collider/manifest.js`, `collider/perfumeCard.js` and the `/SCENT` view. Its snapshot changes are deliberate, and every changed snapshot line must trace to the allowed-change list below.
- Nothing in P1 runs at the altar. P3 wires the engine into `ignite()`. P2 brings the seal and the chaos salt.

**Tech Stack:** React 18 + Vite, Vitest (jsdom), ESLint.

**Spec:** `docs/superpowers/specs/2026-11-27-scent-aether-design.md` (P1 = §12 second bullet; §5.1, §5.4, §6.9, §7, §10).
**Depends on:** the research track deliverables in `docs/superpowers/research/scent-kit/` (`materials.draft.json`, `note-mapping.draft.md`, `sources.md`), signed off by the author before Task 6 starts.

## Global Constraints

- Governing rule (spec decision 13): *anything that reads like a lab measurement is either calculated from cited data or cut; conceptual maths never uses physical units.*
- Kit values (CAS numbers, IFRA limits, solubility) come only from the author-approved research table. **No chemistry value is ever typed from memory.** The fixture kit in tests uses obviously fictional names and ids (`fx-…`) and is never imported by product code.
- Element → target concentrate: AIR 4%, WATER 10%, EARTH 18%, FIRE 25%. Actual strength is within ±0.5 percentage points of the target.
- Layer bands (shares of the concentrate): top 15–25%, heart 30–40%, base 40–55%. The split sums to exactly 100%.
- Batches: 7.00 g / 10 ml (default) and 10.00 g / 15 ml. Fill uses density 0.789 g/ml, and batch ÷ 0.789 ≤ 90% of the nominal volume.
- Every weighed amount is ≥ 0.05 g, with stepping neat → 10% → 1% (only the stocks the material has). Grams are rounded to 0.01, and totals are recomputed from the rounded values.
- Neat % in the finished bottle = grams × stock ÷ batch × 100, and it is ≤ `ifraCat4MaxPct` for every material, checked **after** all modulation and rounding.
- `PERF_NOTES` is not rewritten (spec §6.9).
- New modules in `src/terminal/scent/` contain no React, DOM, GL, WASM or WebCrypto.
- Lint gate: `npm run lint` (max warnings 143) passes. Remove every import that a deletion leaves unused.
- Snapshot rule: `vitest -u` may be run **only** in Task 4, only on the two named parity files, and only after the code change. The report must include the full `.snap` diff, and every changed line must map to an item on Task 4's allowed-change list. Everywhere else, never `-u`.
- Branch: `feature/scent-aether-p1`, cut from local `main` at `0afd4219` or later. Commit per task. **Never push.** The author pushes.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Rulings in this plan (for the author's review before execution)

1. **The vault panel is removed until P2, not relabelled.** This covers the card's "ENCRYPTED MOLECULAR FORMULA", `ShimmeringCipher` and the manifest's `## ENCRYPTED FORMULA`. The spec allows either option, but a relabelled panel would still display a fake SG, flash point and maceration as its payload. With it go `buildEncryptedFormula`, `CAS_REGISTRY` and `publicProfile`. This closes M4 provisionally.
2. **CONC, LOADING, LONGEVITY, MACERATION, EVAP CURVE and FLASH POINT are cut from `/SCENT`.** The spec's replacement for the flash point (ethanol's cited value plus "highly flammable") belongs with the formula's safety block (§7.4): it is shown wherever a formula is shown (P3 reveal, P4 dossier). The research track was asked to cite it. Their honest replacements (element strength, concentrate %, the `/LUNAR` rest window, the real layer split) only exist once the altar compiles a formula (P3). Until then, the manifest says so in one line: `STRENGTH     set at the altar by your element`.
3. **The `SPACE` line reports the path that actually ran.**
   - WASM collisions (domains < 32): `16-D · expanded to 1536` (the spec's wording).
   - JS collisions (domains ≥ 32): `32-D feature tensor`, because that path computes cosine over 32-D `FEATURES` (`LatentCollider.jsx:617-621`).
   - The four `/SCENT` UI labels that say "1536-D" follow the same rule.
4. **`P(RECOLL) < 10⁻⁷⁷` becomes `HASH SHA-256 · deterministic — the same collision yields the same hash`.** Per-seal uniqueness arrives with P2's salt.
5. **The engine takes normalised modulators.** P3 owns the mapping from spine and periphery readings (lunar dryness, the `/SOL` reading, `/CHAOS` art) to those numbers.
6. **Drop counts are not in P1.** They need a cited drop mass; the research track was asked for one. P4 adds them, marked as an approximation, if one is found.

## Review Focus

1. **Several notes mapping to the same material** should give one row with summed parts, not duplicates. Pinned in Task 3.
2. **A material whose neat dose is below 0.05 g even at its weakest stock** drops out and is logged, and the strength still lands within ±0.5 pt by redistributing within its layer. Pinned in Task 1.
3. **Rounding drift:** Σ weighed grams + alcohol must equal the batch exactly (no 6.99 / 7.01 totals). Pinned in Task 1, for both batches and all four elements.
4. **An IFRA ceiling breached only after the chaos micro-shifts or the `/SOL` tilt** must still be capped (checked after modulation). Pinned in Task 2, with maximum reach and tilt.
5. **Real cards that can't be satisfied** (a layer with no materials, or IFRA caps leaving a layer unfillable) are a hard error, not a silent bad formula. The coverage test runs every fixture card × element × batch × extreme modulators through the real kit. Pinned in Task 6.

---

### Task 1: Formula engine core

**Files:**
- Create: `src/terminal/scent/formulaEngine.js`
- Test: `src/terminal/scent/__tests__/formulaEngine.test.js`
- Test fixture: `src/terminal/scent/__tests__/kitFixture.js`, which exports `FX_KIT`. It has 9 fictional materials, 3 per layer. Mix their stocks (`[1.0]`, `[0.5]`, `[0.1, 0.01]`), give one a binding `ifraCat4MaxPct` (e.g. 0.2) and one a 1%-only stock with tiny parts. The file also exports `FX_ACCORD`, a base accord using all 9.

**Interfaces:**
- Produces:
  - `TARGET_PCT = { AIR: 4, WATER: 10, EARTH: 18, FIRE: 25 }`
  - `BANDS = { top: [15, 25], heart: [30, 40], base: [40, 55] }`
  - `BATCHES = { small: { grams: 7.00, vialMl: 10 }, large: { grams: 10.00, vialMl: 15 } }`
  - `MIN_WEIGH_G = 0.05`, `ETHANOL_G_PER_ML = 0.789`, `FILL_MAX = 0.9`
  - `class FormulaInfeasible extends Error { layer, materialId }`
  - `computeFormula({ baseAccord, salt, modulators, batch, kit }) → formula`
    - `baseAccord: { rows: [{ materialId, parts }] }`. The layer comes from the kit row.
    - `salt: Uint8Array(32)`
    - `modulators: { element, solTilt?, restWeeks, chaosReach? }`. In Task 1, only `element` and `restWeeks` are used; `solTilt` and `chaosReach` are treated as absent.
    - `batch`: one of `BATCHES`
    - `kit`: an array of kit rows (the §7.1 schema)
    - `formula`: `{ element, targetPct, actualPct, batch, fillMl, rows: [{ materialId, name, cas, layer, stock, grams, neatPct }], alcoholGrams, layerSplit: { top, heart, base }, restWeeks, ifra: [{ materialId, neatPct, limitPct, ok }], dropped: [{ materialId, reason }], log: [string] }`

- [ ] **Step 1: Write the failing tests**

  `describe('computeFormula core')`. Use `FX_KIT`, `FX_ACCORD`, an all-zero salt and `restWeeks: 4`. Each `it.each` runs over the 4 elements × 2 batches:
  - `actualPct within ±0.5 of TARGET_PCT[element]`
  - `layerSplit sums to 100 (|Σ−100| < 1e-9) and each share is inside BANDS`
  - `every row has grams >= 0.05 and grams*100 is an integer (0.01 g rounding)`
  - `Σ rows.grams + alcoholGrams === batch.grams to 0.01` (Review Focus 3)
  - `alcoholGrams >= 0`
  - `every ifra entry ok and neatPct <= limitPct; neatPct recomputed from rounded grams`
  - `fillMl === batch.grams / 0.789 and fillMl <= 0.9 * vialMl`
  - `stock stepping`: the row whose neat dose is under 0.05 g at stock 1.0 is weighed from its weaker stock (assert `stock < 1`)
  - `drop-out` (Review Focus 2): the 1%-only fixture material with tiny parts appears in `dropped` with a reason, appears in `log`, and `actualPct` is still within ±0.5
  - `restWeeks outside 2–8 or non-integer throws RangeError`
  - `unknown element throws RangeError`
  - `deterministic: same inputs → deep-equal formula`

- [ ] **Step 2: Run and see them fail**

  Run: `npx vitest run src/terminal/scent/__tests__/formulaEngine.test.js`

  Expected: FAIL (the module is missing).

- [ ] **Step 3: Implement `computeFormula` in `formulaEngine.js`**

  The algorithm is fixed, because the tests alone don't determine it:
  1. Layer shares start from Σparts per layer. Project them into `BANDS` so they sum to 100: clamp to the bands, then distribute the residual across the layers that still have room, in proportion to that room, and repeat until the residual is below 1e-12.
  2. Concentrate grams = `batch.grams × TARGET_PCT / 100`. A row's neat grams = concentrate × layer share × the row's share of its layer's parts.
  3. IFRA: when neat % exceeds the limit, cap the row at the limit and give the excess to the uncapped rows in the same layer, in proportion to their parts. If no uncapped row is left in that layer, throw `FormulaInfeasible`.
  4. Stock: for each row, use the strongest stock `s` in `material.stocks` (sorted descending) with `neat / s ≥ 0.05`. If none qualifies, the row drops out (`dropped`, plus a log line) and its neat grams go to its layer's remaining rows. If a layer is left empty, throw `FormulaInfeasible`.
  5. Round weighed grams to 0.01, then recompute neat % and `actualPct` from the rounded values. `alcoholGrams = round2(batch − Σ grams)`. Solvent carried in by the stocks already counts as alcohol, because weighed stock grams include it.
  6. If the rounding pushed any row over its IFRA limit, step that row down by 0.01 g and give 0.01 g to the alcohol. Then re-check.
  7. The first log line is `ELEMENT ${element} → ${typeName} · ${targetPct.toFixed(1)}% concentrate`, with type names Eau de Cologne / Eau de Toilette / Eau de Parfum / Extrait. After it comes one line per step-down or drop-out, then `/LUNAR → ${restWeeks} weeks in the dark`.

- [ ] **Step 4: Run the tests**

  Run: `npx vitest run src/terminal/scent`

  Expected: PASS.

- [ ] **Step 5: Commit**

  `feat(scent): formula engine core with tested invariants`

---

### Task 2: Modulators in the engine

**Files:**
- Modify: `src/terminal/scent/formulaEngine.js`
- Test: `src/terminal/scent/__tests__/formulaModulators.test.js`

**Interfaces:**
- Consumes: `computeFormula` and `FX_KIT` / `FX_ACCORD` from Task 1.
- Produces (exported from `formulaEngine.js`):
  - `SOL_MAX_SHIFT_PT = 5`
  - `CHAOS_DEFAULT_REACH = 0.15`
  - `CHAOS_REACH_RANGE = [0.05, 0.30]`
  - `modulators.solTilt`: a number in [−1, 1] (−1 moves weight to the top, +1 to the base), or `null`/absent.
  - `modulators.chaosReach`: a number in `CHAOS_REACH_RANGE`, or `null`/absent, meaning the default.

- [ ] **Step 1: Write the failing tests**
  - `solTilt +1 moves ≤5 pt from top to base, staying inside BANDS`
  - `solTilt −1 does the reverse`
  - `null solTilt logs exactly '/SOL unwitnessed — the sun left the top notes alone' and leaves the split equal to Task 1's`
  - `salt micro-shifts: two different salts → different row grams, same layerSplit`
  - `each row's within-layer share moves by at most ±reach relative to the unshifted share`
  - `all-zero salt with reach r is still bounded`
  - `chaosReach null logs '/CHAOS periphery unwitnessed — default reach' and uses 0.15`
  - `chaosReach outside [0.05, 0.30] throws RangeError`
  - Review Focus 4: `with solTilt ±1 and chaosReach 0.30 across 16 random salts × 4 elements × 2 batches, every Task 1 invariant still holds (IFRA ok after modulation)`
  - `log has exactly one line per source, in the order ELEMENT, /SOL, /LUNAR, /CHAOS`, plus any step and drop lines after them

- [ ] **Step 2: Run and see them fail**

  Run: `npx vitest run src/terminal/scent/__tests__/formulaModulators.test.js`

  Expected: FAIL.

- [ ] **Step 3: Implement the modulators**
  - Apply the tilt after the band projection: move `solTilt × SOL_MAX_SHIFT_PT` points between top and base, clamped to the bands. Log it as `/SOL → top ${±x.x} pt / base ${±x.x} pt`.
  - Chaos runs before the IFRA pass. Each row's parts become `parts × (1 + reach × u)`, where `u = salt[i % 32] / 127.5 − 1` and `i` is the row's index in `baseAccord.rows`. Then renormalise within the layer. Log it as `/CHAOS salt → ±${(reach*100).toFixed(0)}% per-row drift`.

- [ ] **Step 4: Run the tests**

  Run: `npx vitest run src/terminal/scent`

  Expected: PASS, including Task 1's tests unchanged.

- [ ] **Step 5: Commit**

  `feat(scent): sol, lunar and chaos modulators with a per-source log`

---

### Task 3: Base accord from a card

**Files:**
- Create: `src/terminal/scent/baseAccord.js`
- Test: `src/terminal/scent/__tests__/baseAccord.test.js`, plus a fixture mapping `FX_NOTE_MATERIALS` added to `kitFixture.js`

**Interfaces:**
- Consumes: the card shape from `collider/perfumeCard.js` `buildPerfumeCard` (`topNotes`, `heartNotes`, `baseNotes`: arrays of note names) and `FX_KIT`.
- Produces: `buildBaseAccord(card, noteMaterials, kit) → { rows: [{ materialId, parts }], notes: [{ note, cardLayer, materials: [{ materialId, parts }] }] }`
  - `noteMaterials` has the shape `{ [noteName]: [{ materialId, parts }] }`.
  - Each card note contributes a total weight of 1, split by its mapping's relative parts.
  - Duplicate materials are merged and their parts summed.
  - `notes` keeps the poetic note → material mapping, for the reveal and the dossier (spec §6.9).

- [ ] **Step 1: Write the failing tests**
  - `every card note appears in notes, in card order`
  - `a note mapping to 2 materials at parts 3:1 contributes 0.75 / 0.25`
  - Review Focus 1: `two notes mapping to the same material → one row, parts summed`
  - `unmapped note throws Error naming the note`
  - `materialId missing from kit throws Error naming it`
  - `output feeds computeFormula`: `fixtureCard = buildPerfumeCard(FIXTURES[0].domA, FIXTURES[0].domB, FIXTURES[0].result)` (from `collider/`). `FX_NOTE_MATERIALS` maps exactly that card's notes onto `FX_KIT` ids. Then `buildBaseAccord(fixtureCard, FX_NOTE_MATERIALS, FX_KIT)` → `computeFormula` passes Task 1's invariants.

- [ ] **Step 2: Run and see them fail**

  Run: `npx vitest run src/terminal/scent/__tests__/baseAccord.test.js`

  Expected: FAIL.

- [ ] **Step 3: Implement `buildBaseAccord`**

- [ ] **Step 4: Run the tests**

  Run: `npx vitest run src/terminal/scent`

  Expected: PASS.

- [ ] **Step 5: Commit**

  `feat(scent): build the base accord from a card's poetic notes`

---

### Task 4: Honesty sweep (pure modules and manifest)

**Files:**
- Modify: `src/terminal/collider/perfumeCard.js`
  - Delete `CAS_REGISTRY` and `buildEncryptedFormula`.
  - `buildTesseractProfile` returns `{ hash, dims, viability }`: no `publicProfile`, no `encryptedFormula`.
- Modify: `src/terminal/collider/manifest.js`
- Modify: `src/terminal/views/LatentCollider.jsx`. **Only** remove the vault panel, because it reads `tesseract.encryptedFormula`, so this commit has to drop both together or the card crashes. That means the `ENCRYPTED MOLECULAR FORMULA` block, `ShimmeringCipher`, `cipherRows`, the `FORMULA VAULTED` overlay with "decrypted only at point of physical synthesis", and the `SG / FP / MAC` footer, plus any keyframes and helpers this leaves unused (lint will name them). Before deleting, grep for every other `encryptedFormula` / `publicProfile` reader in `src`.
- Modify: `src/terminal/collider/__tests__/fixtures.js`. Convergence, divergence and paradoxes become real-shaped objects (`{ name, contrib, vA, vB, delta }` and `{ name, residual, original }`), so the manifest test's enrichment shim can go.
- Modify: `src/terminal/collider/__tests__/manifest.parity.test.js`. Drop the enrichment shim and rename the cases to drop the "no living" wording. Both changes are allowed because this task rewrites the snapshots deliberately.
- Snapshots: `__snapshots__/perfumeCard.parity.test.js.snap` and `__snapshots__/manifest.parity.test.js.snap`
- Modify: `src/terminal/collider/__tests__/shopRetired.test.js`. Rename it to `honesty.test.js` with `git mv` and extend it (step 1).

**Interfaces:**
- Produces: `generateManifestMarkdown(card, tesseract, result = null, narrative = null) → string`. The signature is unchanged; `tesseract` is now `{ hash, dims, viability }`.
- Produces: `result.space` is read when present; see Task 5. The values are `'16-D · expanded to 1536'` and `'32-D feature tensor'`, with `—` when absent.

**Allowed snapshot changes (the complete list; anything else is a defect):**
- (a) `buildTesseractProfile` snapshots lose `publicProfile` and `encryptedFormula`.
- (b) Their `dims` change because of the fixture convergence reshape.
- (c) In the manifest:
  - These ACCORD lines go: `CONC`, `LONGEVITY`, `EVAP CURVE` (both occurrences, and the FISH SCALE `EVAP CURVE` block), `LOADING`, `FLASH POINT`, `SG` and `MACERATION`.
  - The line `STRENGTH     set at the altar by your element` is added.
- (d) `SPACE          1536-dimensional · OCK v1.1.0` → `SPACE          ${result?.space ?? '—'} · OCK v1.1.0`
- (e) `P(RECOLL)      < 10⁻⁷⁷` → `HASH           SHA-256 · deterministic — the same collision yields the same hash`
- (f) The `## ENCRYPTED FORMULA` section is removed in full, including its `---` separator.
- (g) Snapshot keys renamed (the test-name change).
- (h) Values that change because of the fixture reshape (b), inside the convergence, divergence and paradox lines.

- [ ] **Step 1: Extend the structural test (`honesty.test.js`)**

  These must NOT appear in `manifest.js`, `perfumeCard.js` or `LatentCollider.jsx`:
  - `'10⁻⁷⁷'`, `'RSA-OAEP'`, `'INTEGRITY BOUND'`
  - `'FLASH POINT'`, `'MACERATION'`, `'EVAP CURVE'`, `'LONGEVITY'`
  - `'specificGravity'`, `'CAS_REGISTRY'`, `'buildEncryptedFormula'`, `'publicProfile'`
  - `'1536-dimensional'`, `'1536-D'`
  - `'physical synthesis'`, `'SOMA SHOP'`, `'ShimmeringCipher'`

  Keep all of the existing shop assertions.

- [ ] **Step 2: Run it**

  Run: `npx vitest run src/terminal/collider/__tests__/honesty.test.js`

  Expected: FAIL, listing the strings. In `LatentCollider.jsx`, `'physical synthesis'`, `'ShimmeringCipher'`, `'specificGravity'` and `'publicProfile'` are enforced in this task. The other view strings stay failing until Task 5, so mark those assertions `it.todo` here and switch them on in Task 5.

- [ ] **Step 3: Edit `perfumeCard.js`, `manifest.js` and the fixtures as listed**

- [ ] **Step 4: Rewrite the two parity snapshots, deliberately**

  Run: `npx vitest run src/terminal/collider/__tests__/perfumeCard.parity.test.js src/terminal/collider/__tests__/manifest.parity.test.js -u`

  Then run: `git diff --stat -- '*.snap'` and `git diff -- '*.snap'`

  Paste the full snapshot diff into the report, annotating every hunk with its allowed-change letter (a–h).

- [ ] **Step 5: Run the gate**

  Run: `npx vitest run src/terminal/collider && npm test && npm run lint`

  Expected: PASS, with 0 snapshots written or updated on this second run and 0 obsolete.

- [ ] **Step 6: Commit**

  `feat(scent): honesty sweep in the card model and manifest; vault payload removed until P2`

---

### Task 5: Honesty sweep (`/SCENT` view and P0 carry-over)

**Files:**
- Modify: `src/terminal/views/LatentCollider.jsx`
- Modify: `src/terminal/App.jsx:302` and `src/terminal/hooks/useCommandDispatch.js:290,306`: delete the write-only `kernelRunHistoryRef` and its two pushes. Before deleting, confirm with grep that nothing reads it.
- Modify: `src/terminal/lib/sovereignty.js`: delete the unused `transitTag` and its test cases in `tests/sovereignty.test.js:128-136`.
- Modify: `package.json` / lockfile: `npm uninstall @upstash/redis`, only after `grep -rn "@upstash/redis" api src tests scripts` returns nothing.
- Modify test: `src/terminal/collider/__tests__/honesty.test.js` (switch on the Task 4 `it.todo`s)

**Interfaces:**
- Consumes: `buildTesseractProfile → { hash, dims, viability }` (Task 4).
- Produces: `result.space` is set in the collision code, in both branches. It is `'16-D · expanded to 1536'` on the WASM path (domains < 32) and `'32-D feature tensor'` on the JS path (domains ≥ 32, `LatentCollider.jsx:617`).

**What changes in the view (the copy is fixed; Task 4 already removed the vault panel):**
- **Properties strips** (both of them: the CrystallizeCard strip and the TesseractCard strip): `LONGEVITY` is replaced by `OLFACTIVE` with the value `${card.dom.toUpperCase()} × ${card.sec.toUpperCase()}`.
- **The evaporation block:**
  - The header `EVAPORATION CURVE` becomes `VOLATILITY TIERS · conceptual`.
  - The subs become `citrus · high volatility`, `floral · medium volatility` and `resinous · low volatility`.
  - The `<15min / 4hr / days` timings are gone.
- **The "1536-D" labels** (`:893`, `:929`, `:1243`, `:1528`):
  - `:893` becomes `// ${result?.space ?? '16-D · expanded to 1536'} CROSS-ATTENTION SYNTHESIS · …`, with the rest of the line unchanged.
  - `:929` becomes `16-D vector intersection · expanded to 1536 · cross-attention synthesis`.
  - `:1243` gets the label `cos(θ)`, with the sub showing `θ` and the `result.space` text.
  - `:1528`'s fallback becomes `§8 vector space`.
- **The `SHOP_MANIFEST` panel (`:99`, `:1692-1722`):** the header `ᛊ⚗ᛟ SOMA SHOP — TESSERACT KEY EXCHANGE` becomes `ᛊ⚗ᛟ SOMA — TESSERACT KEY LEDGER`. The items and their visuals stay. *(Author's request: rename or remove the "SHOP" wording. This plan renames it; delete the panel instead if the author prefers.)*

- [ ] **Step 1: Switch on the view assertions in `honesty.test.js`, and add:**
  - `LatentCollider.jsx` contains `'VOLATILITY TIERS'` and `"'32-D feature tensor'"`
  - `App.jsx` and `useCommandDispatch.js` don't contain `kernelRunHistoryRef`
  - `package.json` doesn't contain `@upstash/redis`

- [ ] **Step 2: Run it**

  Run: `npx vitest run src/terminal/collider/__tests__/honesty.test.js`

  Expected: FAIL.

- [ ] **Step 3: Make the view edits and carry-over deletions listed above**

- [ ] **Step 4: Run the gate**

  Run: `npm test && npm run lint && npm run build`

  Expected: PASS. No snapshot is written or updated.

- [ ] **Step 5: Browser check**

  Use the preview tools on this checkout's dev server.

  On `/SCENT`:
  1. Collide a WASM pair (e.g. MYCEL × KANT) and crystallize:
     - There is no vault panel.
     - The strip shows OLFACTIVE.
     - The volatility labels have no timings.
     - The header names the 16-D space.
  2. Collide a planet pair (e.g. ☉ × ♄): the header and the manifest `SPACE` line say `32-D feature tensor`.
  3. Download the manifest and check it for the allowed-change lines (c–f).
  4. Toggle the sovereign view on and off: redaction still renders.
  5. Console: no errors.
  6. Screenshot the card.

- [ ] **Step 6: Commit**

  `feat(scent): honest /SCENT card; P0 dead code removed`

---

### Task 6: The kit table and note interpretation (gated on author sign-off)

**Precondition:** the author has approved `docs/superpowers/research/scent-kit/materials.draft.json` and `note-mapping.draft.md`. If they aren't approved, stop and report BLOCKED. Don't transcribe an unapproved table.

**Files:**
- Create: `src/terminal/scent/materials.js`, exporting `MATERIALS`, a frozen array of the approved rows in the §7.1 schema, sources included. Transcribe verbatim from the approved JSON.
- Create: `src/terminal/scent/noteInterpretation.js`, exporting `NOTE_MATERIALS` from the approved mapping (shape as in Task 3).
- Create: `src/terminal/scent/casCheck.js`, exporting `isValidCas(cas: string) → boolean`. It checks the format `\d{2,7}-\d{2}-\d` and the check digit: Σ(digitᵢ × positionᵢ from the right, excluding the check digit) mod 10.
- Test: `src/terminal/scent/__tests__/materials.test.js`
- Test: `src/terminal/scent/__tests__/formulaCoverage.test.js`
- Modify: `CHANGELOG.md` (one entry: honest chemistry, the kit, the engine, the vault payload removed until P2)
- Modify: `docs/ARCHITECTURE.md` (untracked: edit in place, never `git add`). Add the `scent/` module row and update the `LatentCollider.jsx` line count.
- Modify: `.superpowers/security-audit-report.md` (git-ignored). M4 becomes "closed provisionally (scent-aether P1: payload removed); final closure P2".

**Interfaces:**
- Consumes: `computeFormula` (Tasks 1–2), `buildBaseAccord` (Task 3), and `buildPerfumeCard` plus `FIXTURES` from `collider/`.
- Produces: `MATERIALS` and `NOTE_MATERIALS`, which P3 uses as the engine's `kit` and `noteMaterials`.

- [ ] **Step 1: Write the failing tests (`materials.test.js`)**
  - `isValidCas`: '64-17-5' (ethanol) is true; '64-17-6' is false; a malformed string is false.
  - `every MATERIALS row has id, name, cas, layer ∈ {top, heart, base}, role, non-empty stocks ⊂ {1.0, 0.5, 0.1, 0.01}, and ifraCat4MaxPct as a number or null`
  - `every row has sources.casSource {name, url, accessed}`
  - `every row has sources.ifraSource, or a citation that it is unrestricted`
  - `every solid has solubility and a solubilitySource`
  - `every cas passes isValidCas`
  - `no duplicate id and no duplicate cas`
  - `every name in PERF_NOTES (all layers and families) has a NOTE_MATERIALS entry`
  - `every NOTE_MATERIALS materialId exists in MATERIALS`
  - `fixture names never leak`: no `MATERIALS` id starts with `fx-`

- [ ] **Step 2: Write the coverage test (`formulaCoverage.test.js`; Review Focus 5)**

  Run every `PERF_NOTES` combination reachable from the P0 `FIXTURES` through `buildPerfumeCard → buildBaseAccord(card, NOTE_MATERIALS, MATERIALS)`. Do the same for one synthetic card per family that uses every note of that family. Each goes through `computeFormula` across:
  - the 4 elements
  - the 2 batches
  - `solTilt` ∈ {−1, 0, 1}
  - `chaosReach` ∈ {0.05, 0.30}
  - 4 fixed salts

  Expect no `FormulaInfeasible`, and every Task 1 invariant holds.

- [ ] **Step 3: Run and see them fail**

  Run: `npx vitest run src/terminal/scent`

  Expected: FAIL (the modules are missing).

- [ ] **Step 4: Create the three modules from the approved research files**

- [ ] **Step 5: Run the tests**

  Run: `npx vitest run src/terminal/scent`

  Expected: PASS.

  If the coverage test finds an infeasible combination, don't tweak the engine or invent values. Report DONE_WITH_CONCERNS with the failing card, element and batch. The fix is a mapping or kit change that the author approves.

- [ ] **Step 6: Run the full gate**

  Run: `npm test && npm run lint && npm run build`

  Expected: PASS.

- [ ] **Step 7: Commit**

  `feat(scent): cited kit table and note interpretation; full-coverage formula test`
